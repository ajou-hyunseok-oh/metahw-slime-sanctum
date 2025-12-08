// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 07, 2025

import { Behaviour } from 'Behaviour';
import { Events } from 'Events';
import { AudioGizmo, Component, Entity, ParticleGizmo, Player, PropTypes, CodeBlockEvents, Vec3, Quaternion } from 'horizon/core';
import { MatchStateManager } from 'MatchStateManager';
import { PlayerManager } from 'PlayerManager';
import type { LootItemSpawner } from 'LootItemSpawner';

// 아이템 종류 정의
export enum ItemType {
  Coin = "coin",
  Gem = "gem",
  HealthPotion = "healthPotion",
  DefenceUpPotion = "defenceUpPotion",
  AttackSpeedUpPotion = "attackSpeedUpPotion",
}

export enum ItemState {
  Spawned = "spawned",
  Floating = "floating",
  Collected = "collected",
}

// LootItem 클래스: 아이템 관련 로직 담당
export class LootItem extends Behaviour<typeof LootItem> {
  static propsDefinition = {
    vfxSparkle: { type: PropTypes.Entity, default: undefined },
    coinEntity: { type: PropTypes.Entity, default: undefined },
    gemEntity: { type: PropTypes.Entity, default: undefined },
    healthPotionEntity: { type: PropTypes.Entity, default: undefined },
    defenceUpPotionEntity: { type: PropTypes.Entity, default: undefined },
    attackSpeedUpPotionEntity: { type: PropTypes.Entity, default: undefined },
    sfxCoin: { type: PropTypes.Entity, default: undefined },
    sfxGem: { type: PropTypes.Entity, default: undefined },
    sfxHealthPotion: { type: PropTypes.Entity, default: undefined },
    sfxDefenceUpPotion: { type: PropTypes.Entity, default: undefined },
    sfxAttackSpeedUpPotion: { type: PropTypes.Entity, default: undefined },
  };

  private itemType: ItemType = ItemType.Coin;
  private itemEntity?: Entity;
  private vfxSparkle?: ParticleGizmo;
  private sfxCollect?: AudioGizmo;
  private owningSpawner?: LootItemSpawner;
  private isActive: boolean = false;
  private state: ItemState = ItemState.Collected;
  private recycleTimer?: number;
  private bobTime: number = 0;
  private baseItemPos?: Vec3;
  private baseItemRot?: Quaternion;
  private spawnStartPos?: Vec3;
  private spawnTargetPos?: Vec3;
  private spawnElapsed: number = 0;
  private readonly bobAmplitude: number = 0.12;
  private readonly bobSpeed: number = 2.5;
  private readonly rotSpeed: number = 0.8;
  private readonly spawnDuration: number = 0.55; // 비행 연출 시간
  private readonly spawnArcHeight: number = 0.6;

  private static attackBuffTimers: Map<number, number> = new Map();

  // 초기화 시 비주얼 이펙트 로딩
  Start() {
    this.vfxSparkle = this.props.vfxSparkle?.as(ParticleGizmo);

    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerEnterTrigger, this.OnPlayerCollision.bind(this));
  }

  Update(deltaTime: number) {
    if (!this.isActive || !this.itemEntity) {
      return;
    }

    if (this.state === ItemState.Spawned && this.spawnStartPos && this.spawnTargetPos) {
      this.spawnElapsed += deltaTime;
      const t = Math.min(1, this.spawnElapsed / this.spawnDuration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const pos = new Vec3(
        this.spawnStartPos.x + (this.spawnTargetPos.x - this.spawnStartPos.x) * eased,
        this.spawnStartPos.y +
          (this.spawnTargetPos.y - this.spawnStartPos.y) * eased +
          Math.sin(Math.PI * eased) * this.spawnArcHeight,
        this.spawnStartPos.z + (this.spawnTargetPos.z - this.spawnStartPos.z) * eased
      );
      this.itemEntity.position.set(pos);

      if (t >= 1) {
        this.state = ItemState.Floating;
        this.bobTime = 0;
        this.baseItemPos = this.spawnTargetPos;
        this.baseItemRot = this.itemEntity.rotation.get();
        this.spawnStartPos = undefined;
        this.spawnTargetPos = undefined;
        this.refreshSparkleState();
      }
      return;
    }

    if (this.state !== ItemState.Floating || !this.baseItemPos || !this.baseItemRot) {
      return;
    }

    this.bobTime += deltaTime;
    const yOffset = Math.sin(this.bobTime * this.bobSpeed) * this.bobAmplitude;
    const newPos = new Vec3(this.baseItemPos.x, this.baseItemPos.y + yOffset, this.baseItemPos.z);
    this.itemEntity.position.set(newPos);

    const rot = Quaternion.fromAxisAngle(new Vec3(0, 1, 0), this.bobTime * this.rotSpeed);
    this.itemEntity.rotation.set(Quaternion.mul(this.baseItemRot, rot));

    this.syncSparklePosition();
  }

  // 아이템 타입 설정 및 관련 엔티티/이펙트 로딩
  public setItemType(itemType: ItemType, activate: boolean = true) {
    this.itemType = itemType;

    switch (itemType) {
      case ItemType.Coin:
        this.itemEntity = this.props.coinEntity?.as(Entity);
        this.sfxCollect = this.props.sfxCoin?.as(AudioGizmo);
        break;
      case ItemType.Gem:
        this.itemEntity = this.props.gemEntity?.as(Entity);
        this.sfxCollect = this.props.sfxGem?.as(AudioGizmo);
        break;
      case ItemType.HealthPotion:
        this.itemEntity = this.props.healthPotionEntity?.as(Entity);
        this.sfxCollect = this.props.sfxHealthPotion?.as(AudioGizmo);
        break;
      case ItemType.DefenceUpPotion:
        this.itemEntity = this.props.defenceUpPotionEntity?.as(Entity);
        this.sfxCollect = this.props.sfxDefenceUpPotion?.as(AudioGizmo);
        break;
      case ItemType.AttackSpeedUpPotion:
        this.itemEntity = this.props.attackSpeedUpPotionEntity?.as(Entity);
        this.sfxCollect = this.props.sfxAttackSpeedUpPotion?.as(AudioGizmo);
        break;
      default:
        this.itemEntity = undefined;
        this.sfxCollect = undefined;
    }

    if (activate) {
      this.setActive(true);
    }
  }

  public beginSpawn(origin: Vec3, target: Vec3, rotation: Quaternion) {
    this.state = ItemState.Spawned;
    this.spawnStartPos = origin;
    this.spawnTargetPos = target;
    this.spawnElapsed = 0;

    this.entity.rotation.set(rotation);
    this.entity.position.set(origin);
    this.setActive(true, false); // 충돌 없이 연출만 수행, 플로팅 기준점은 도착 시 세팅
    this.refreshSparkleState(); // Spawned 구간에서는 비활성화
  }

  // 아이템 획득 시 호출
  public collect(player?: Player) {
    if (!this.isActive) return;

    this.state = ItemState.Collected;
    this.setActive(false);
    this.refreshSparkleState();
    
    if (this.sfxCollect) {
      this.sfxCollect.play();
    }

    if (player) {
      this.sendNetworkBroadcastEvent(Events.lootPickup, { player, loot: this.itemType });
    }

    // 사운드가 끝나기 전에 바로 재활용되지 않도록 짧게 지연
    this.recycleTimer = this.async.setTimeout(() => {
      this.recycleTimer = undefined;
      this.owningSpawner?.recycle(this.entity);
    }, 1000);
  }

  // 아이템 활성화/비활성화 및 이펙트 관리
  public setActive(active: boolean, setFloatingBase: boolean = true) {
    this.isActive = active;

    // 재활용 타이머가 남아 있을 때 새로 활성화되면 정리
    if (active && this.recycleTimer !== undefined) {
      this.async.clearTimeout(this.recycleTimer);
      this.recycleTimer = undefined;
    }

    if (this.itemEntity) {
      this.itemEntity.visible.set(active);
      if (active) {
        // 풀에서 복귀할 때 항상 보이도록 루트 가시성도 보장
        try {
          this.entity.visible.set(true);
        } catch (_) {}

        if (setFloatingBase) {
          this.bobTime = 0;
          this.baseItemPos = this.itemEntity.position.get();
          this.baseItemRot = this.itemEntity.rotation.get();
          this.state = ItemState.Floating;
        }
      }
    }

    this.refreshSparkleState();
  }

  public assignSpawner(spawner: LootItemSpawner) {
    this.owningSpawner = spawner;
  }

  protected override OnPlayerCollision(target: Player | Entity) {
    if (!(target instanceof Player)) return; // 플레이어가 아닌 충돌은 무시
    if (this.state !== ItemState.Floating) return; // 비행 중 또는 회수 중에는 무시
    this.handlePickup(target);
  }

  private handlePickup(player: Player) {
    if (!this.isActive) return;

    this.applyEffect(player);
    this.collect(player);
  }

  private applyEffect(player: Player) {
    const match = MatchStateManager.instance;

    switch (this.itemType) {
      case ItemType.Coin:
        this.grantCurrency(player, 'coins', 5);
        break;
      case ItemType.Gem:
        this.grantCurrency(player, 'gems', 1);
        break;
      case ItemType.HealthPotion:
        match?.adjustHp(player, 30);
        break;
      case ItemType.DefenceUpPotion:
        this.boostDefense(player, 2);
        break;
      case ItemType.AttackSpeedUpPotion:
        this.applyAttackSpeedBuff(player, 1, 15000);
        break;
    }
  }

  private grantCurrency(player: Player, key: 'coins' | 'gems', amount: number) {
    const manager = PlayerManager.instance;
    if (!manager) return;

    const stats = manager.getPersistentStats(player);
    if (!stats) return;

    stats[key] = Math.max(0, (stats[key] ?? 0) + amount);
    manager.sendNetworkEvent(player, Events.playerPersistentStatsUpdate, stats);
  }

  private boostDefense(player: Player, amount: number) {
    const match = MatchStateManager.instance;
    if (!match) return;

    const state = match.getStats(player);
    if (!state) return;

    match.patchStats(player, { defense: state.defense + amount });
  }

  private applyAttackSpeedBuff(player: Player, bonusLevel: number, durationMs: number) {
    const match = MatchStateManager.instance;
    if (!match) return;

    const state = match.getStats(player);
    if (!state) return;

    // 기존 타이머가 있으면 갱신
    const existingTimer = LootItem.attackBuffTimers.get(player.id);
    if (existingTimer !== undefined) {
      this.async.clearTimeout(existingTimer);
    }

    match.patchStats(player, {
      meleeAttackLevel: state.meleeAttackLevel + bonusLevel,
      rangedAttackLevel: state.rangedAttackLevel + bonusLevel,
      magicAttackLevel: state.magicAttackLevel + bonusLevel,
    });

    const timer = this.async.setTimeout(() => {
      this.revertAttackSpeedBuff(player, bonusLevel);
    }, durationMs);

    LootItem.attackBuffTimers.set(player.id, timer);
  }

  private revertAttackSpeedBuff(player: Player, bonusLevel: number) {
    const match = MatchStateManager.instance;
    if (!match) return;

    const state = match.getStats(player);
    if (!state) return;

    match.patchStats(player, {
      meleeAttackLevel: Math.max(0, state.meleeAttackLevel - bonusLevel),
      rangedAttackLevel: Math.max(0, state.rangedAttackLevel - bonusLevel),
      magicAttackLevel: Math.max(0, state.magicAttackLevel - bonusLevel),
    });

    LootItem.attackBuffTimers.delete(player.id);
  }

  private refreshSparkleState() {
    if (!this.vfxSparkle) return;

    if (this.isActive && this.state === ItemState.Floating) {
      this.vfxSparkle.play();
      this.syncSparklePosition();
      return;
    }

    this.vfxSparkle.stop();
  }

  private syncSparklePosition() {
    if (!this.vfxSparkle || !this.itemEntity) return;
    const vfxEntity = (this.vfxSparkle as any).entity as Entity | undefined;
    if (vfxEntity) {
      vfxEntity.position.set(this.itemEntity.position.get());
    }
  }
}

Component.register(LootItem);
