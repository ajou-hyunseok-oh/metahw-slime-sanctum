// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 07, 2025

import { Behaviour, BehaviourFinder } from "Behaviour";
import { Component, Entity, PropTypes, Quaternion, Vec3 } from "horizon/core";
import { ItemType, LootItem } from "LootItem";
import { SlimeType } from "SlimeObjectPool";

export class LootItemSpawner extends Behaviour<typeof LootItemSpawner> {
  static propsDefinition = {
    itemAsset: { type: PropTypes.Asset, default: undefined },
    poolLimit: { type: PropTypes.Number, default: 24 },
  };

  /** 전역에서 접근 가능한 싱글턴 인스턴스 */
  public static instance: LootItemSpawner | undefined;

  private readonly allocatedEntities: Set<Entity> = new Set();
  private readonly freeEntities: Set<Entity> = new Set();
  private pendingCount: number = 0;
  private readonly poolRestingPosition: Vec3 = new Vec3(0, -9999, 0);
  private readonly scatterRadius: number = 0.8;

  /** 슬라임 타입별 드롭 테이블 (가중치 합산 방식) */
  private readonly dropTables: Record<SlimeType, { type: ItemType | null; weight: number }[]> = {
    [SlimeType.Blue]: [
      { type: ItemType.Coin, weight: 90 },
      { type: ItemType.Gem, weight: 0 },
      { type: ItemType.HealthPotion, weight: 10 },
      { type: ItemType.DefenceUpPotion, weight: 0 },
      { type: ItemType.AttackSpeedUpPotion, weight: 0 },
      { type: null, weight: 0 }, // 드롭 없음
    ],
    [SlimeType.Pink]: [
      { type: ItemType.Coin, weight: 50 },
      { type: ItemType.Gem, weight: 10 },
      { type: ItemType.HealthPotion, weight: 30 },
      { type: ItemType.DefenceUpPotion, weight: 5 },
      { type: ItemType.AttackSpeedUpPotion, weight: 5 },
      { type: null, weight: 0 },
    ],
    [SlimeType.King]: [
      { type: ItemType.Coin, weight: 0 },
      { type: ItemType.Gem, weight: 50 },
      { type: ItemType.HealthPotion, weight: 20 },
      { type: ItemType.DefenceUpPotion, weight: 15 },
      { type: ItemType.AttackSpeedUpPotion, weight: 15 },
      { type: null, weight: 0 },
    ],
  };

  protected Awake(): void {
    LootItemSpawner.instance = this;
  }

  Start() {}

  /**
   * 슬라임 사망 시 호출되어 해당 타입의 드롭 테이블에 따라 아이템을 스폰한다.
   */
  public spawnForSlime(slimeType: SlimeType, position: Vec3, rotation?: Quaternion) {
    const itemType = this.rollDrop(slimeType);
    if (!itemType) {
      return; // 드롭이 없는 케이스
    }

    const spawnRotation = rotation ?? this.entity.rotation.get();
    this.spawnItem(itemType, position, spawnRotation);
  }

  /**
   * 풀 관리: 가용 엔티티를 찾아 스폰하거나 부족하면 생성, 풀이 가득 차면 재할당.
   */
  private spawnItem(itemType: ItemType, position: Vec3, rotation: Quaternion) {
    // 1) Free 슬롯 우선 사용
    if (this.freeEntities.size > 0) {
      const entity = this.freeEntities.values().next().value;
      this.freeEntities.delete(entity);
      this.allocatedEntities.add(entity);
      this.configureLootEntity(entity, itemType, position, rotation);
      return;
    }

    const totalCount = this.allocatedEntities.size + this.freeEntities.size + this.pendingCount;
    const limit = Math.max(1, this.props.poolLimit ?? 24);

    // 2) 풀이 가득 차지 않았으면 새로 생성
    if (totalCount < limit) {
      this.createLootEntity(itemType, position, rotation);
      return;
    }

    // 3) 풀이 가득 찼으면 가장 오래된 Allocated 엔티티 재사용 (Set의 삽입 순서 활용)
    const oldest = this.allocatedEntities.values().next().value as Entity | undefined;
    if (oldest) {
      this.allocatedEntities.delete(oldest);
      this.allocatedEntities.add(oldest); // 순서를 최신으로 갱신
      this.configureLootEntity(oldest, itemType, position, rotation);
      return;
    }

    // 4) 모든 슬롯이 Pending 상태인 경우에는 이번 요청 스킵
    console.warn("[LootItemSpawner] 모든 슬롯이 생성 대기 상태입니다. 이번 스폰을 스킵합니다.");
  }

  private createLootEntity(itemType: ItemType, position: Vec3, rotation: Quaternion) {
    if (!this.props.itemAsset) {
      console.warn("[LootItemSpawner] itemAsset 이 지정되지 않아 아이템을 스폰할 수 없습니다.");
      return;
    }

    this.pendingCount++;
    this.world
      .spawnAsset(this.props.itemAsset, position, rotation)
      .then((spawned) => {
        this.pendingCount--;
        if (!spawned || spawned.length === 0) {
          console.warn("[LootItemSpawner] spawnAsset 결과가 비어 있습니다.");
          return;
        }

        // 스폰된 엔티티 중 LootItem Behaviour 를 가진 것을 우선 선택
        const entity = this.pickLootEntity(spawned);
        if (!entity) {
          console.warn("[LootItemSpawner] LootItem Behaviour 를 찾지 못했습니다.");
          return;
        }

        this.allocatedEntities.add(entity);
        this.configureLootEntity(entity, itemType, position, rotation);
      })
      .catch((err) => {
        this.pendingCount--;
        console.error("[LootItemSpawner] 아이템 스폰 실패:", err);
      });
  }

  private configureLootEntity(entity: Entity, itemType: ItemType, position: Vec3, rotation: Quaternion) {
    const loot = this.getLootBehaviour(entity);
    if (!loot) {
      console.warn("[LootItemSpawner] 대상 엔티티에서 LootItem 을 찾지 못했습니다.");
      return;
    }

    const origin = position.add(new Vec3(0, 0.2, 0));
    const target = this.getScatterPosition(origin);

    loot.assignSpawner(this);
    loot.setItemType(itemType, false);
    loot.beginSpawn(origin, target, rotation);
  }

  private pickLootEntity(entities: Entity[]): Entity | undefined {
    for (const ent of entities) {
      const behaviour = this.getLootBehaviour(ent);
      if (behaviour) {
        return ent;
      }
    }
    // LootItem 이 없는 경우 첫 번째 엔티티라도 반환해둔다 (디버깅용)
    return entities[0];
  }

  private getLootBehaviour(entity: Entity): LootItem | undefined {
    const behaviour = BehaviourFinder.GetBehaviour<LootItem>(entity);
    return behaviour as LootItem | undefined;
  }

  /**
   * LootItem 이 자신을 풀로 반환할 때 호출된다.
   */
  public recycle(entity: Entity | null | undefined) {
    if (!entity) return;

    if (!this.allocatedEntities.has(entity) && !this.freeEntities.has(entity)) {
      // 외부에서 스폰된 엔티티일 수 있으므로 경고만 남기고 종료
      console.warn("[LootItemSpawner] 알 수 없는 엔티티가 반환되었습니다.");
      return;
    }

    this.allocatedEntities.delete(entity);
    this.freeEntities.add(entity);
    entity.position.set(this.poolRestingPosition);
  }

  /**
   * 슬라임 타입별 드롭 가중치 테이블을 통해 아이템 타입을 결정한다.
   */
  private rollDrop(slimeType: SlimeType): ItemType | null {
    const table = this.dropTables[slimeType] ?? this.dropTables[SlimeType.Blue];
    const total = table.reduce((sum, entry) => sum + entry.weight, 0);
    if (total <= 0) {
      return null;
    }

    let roll = Math.random() * total;
    for (const entry of table) {
      roll -= entry.weight;
      if (roll <= 0) {
        return entry.type;
      }
    }
    // 폴백
    return table[table.length - 1].type;
  }

  private getScatterPosition(base: Vec3): Vec3 {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.sqrt(Math.random()) * this.scatterRadius;
    const offsetX = Math.cos(angle) * radius;
    const offsetZ = Math.sin(angle) * radius;
    return new Vec3(base.x + offsetX, base.y, base.z + offsetZ);
  }
}
Component.register(LootItemSpawner);