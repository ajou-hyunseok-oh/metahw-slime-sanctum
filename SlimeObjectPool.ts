import { Behaviour, BehaviourFinder } from 'Behaviour';
import { Component, Entity, PropTypes, Quaternion, Vec3 } from 'horizon/core';

export const PullSize = {
  Blue: 4,
  Pink: 3,
  King: 2,
} as const;

export enum SlimeType {
  Blue = 0,
  Pink,
  King
}

export interface ISlimeObject {
  onAllocate(position: Vec3, rotation: Quaternion): void;
  onFree(): void;
  slimeType: SlimeType;
}

class PoolState {
  public allocatedEntities: Set<Entity> = new Set<Entity>();
  public freeEntities: Set<Entity> = new Set<Entity>();
  public pendingCount: number = 0;
  
  constructor(public limit: number, public asset: any) {}

  get totalCount(): number {
    return this.allocatedEntities.size + this.freeEntities.size + this.pendingCount;
  }
}

export class SlimeObjectPool extends Behaviour<typeof SlimeObjectPool> {
  static propsDefinition = {
    blueAsset: { type: PropTypes.Asset, default: undefined },
    pinkAsset: { type: PropTypes.Asset, default: undefined },
    kingAsset: { type: PropTypes.Asset, default: undefined }
  };

  private pools: Map<SlimeType, PoolState> = new Map();

  Start() {
    // 각 타입별 풀 상태 초기화
    this.pools.set(SlimeType.Blue, new PoolState(PullSize.Blue, this.props.blueAsset));
    this.pools.set(SlimeType.Pink, new PoolState(PullSize.Pink, this.props.pinkAsset));
    this.pools.set(SlimeType.King, new PoolState(PullSize.King, this.props.kingAsset));
  }

  public spawn(type: SlimeType, position: Vec3, rotation: Quaternion) {
    const pool = this.pools.get(type);
    if (!pool) {
      console.error(`[SlimeObjectPool] Unknown SlimeType: ${type}`);
      return;
    }

    // 1. 여유 공간이 있는 경우 (생성 중인 것 포함) -> 신규 생성
    if (pool.totalCount < pool.limit) {
      this.createNewEntity(pool, type, position, rotation);
      return;
    }

    // 2. 풀이 가득 찬 경우 -> 재사용
    // 2-1. 대기 중(Free)인 엔티티가 있으면 우선 사용
    if (pool.freeEntities.size > 0) {
      const entity = pool.freeEntities.values().next().value;
      this.reuseEntity(pool, entity, position, rotation);
      return;
    }

    // 2-2. 대기 중인 게 없으면, 사용 중(Allocated)인 가장 오래된 엔티티 강제 회수 (Circular Reuse)
    if (pool.allocatedEntities.size > 0) {
      const entity = pool.allocatedEntities.values().next().value;
      
      // 강제 회수 절차: Free -> Allocate
      const slimeObject = this.getSlimeObject(entity);
      if (slimeObject) {
        slimeObject.onFree(); // 먼저 해제 로직 수행
        
        // 기존 allocated에서 제거하지 않고 위치만 맨 뒤로 보내기 위해 삭제 후 다시 추가
        // (Set은 삽입 순서를 유지하므로, 다시 add하면 가장 최근 것으로 갱신됨)
        pool.allocatedEntities.delete(entity);
        pool.allocatedEntities.add(entity);
        
        slimeObject.onAllocate(position, rotation);
      }
      return;
    }

    // 2-3. Free도 없고 Allocated도 없는데 Full인 경우 (즉, 모든 슬롯이 Pending 상태)
    // 이 경우엔 뺏어올 엔티티가 없으므로 이번 스폰 요청은 스킵합니다.
    console.warn(`[SlimeObjectPool] All entities are pending creation for type ${type}. Skipping spawn.`);
  }

  private createNewEntity(pool: PoolState, type: SlimeType, position: Vec3, rotation: Quaternion) {
    if (!pool.asset) {
      console.warn(`[SlimeObjectPool] Asset not assigned for type ${type}`);
      return;
    }

    pool.pendingCount++; // 생성 시작 마킹

    this.world.spawnAsset(pool.asset, position, rotation).then(([entity]) => {
      pool.pendingCount--; // 생성 완료 해제
      
      // 생성된 엔티티 등록 및 초기화
      pool.allocatedEntities.add(entity);
      
      const slimeObject = this.getSlimeObject(entity);
      if (slimeObject) {
        slimeObject.onAllocate(position, rotation);
      } else {
        console.error(`[SlimeObjectPool] Spawned entity does not have ISlimeObject implementation.`);
      }
    }).catch((err) => {
      console.error(`[SlimeObjectPool] Failed to spawn asset: ${err}`);
      pool.pendingCount--; // 실패 시에도 카운트 감소
    });
  }

  private reuseEntity(pool: PoolState, entity: Entity, position: Vec3, rotation: Quaternion) {
    // Free 상태에서 Allocated 상태로 전환
    pool.freeEntities.delete(entity);
    pool.allocatedEntities.add(entity);

    const slimeObject = this.getSlimeObject(entity);
    if (slimeObject) {
      slimeObject.onAllocate(position, rotation);
    }
  }

  // 외부에서 엔티티가 파괴되거나 수동으로 반환될 때 호출될 수 있음
  public free(entity: Entity | undefined | null) {
    if (!entity) return;

    const slimeObject = this.getSlimeObject(entity);
    if (!slimeObject) return;

    const pool = this.pools.get(slimeObject.slimeType);
    if (!pool) return;

    // Allocated 목록에 있다면 Free로 이동
    if (pool.allocatedEntities.has(entity)) {
      pool.allocatedEntities.delete(entity);
      pool.freeEntities.add(entity);
      slimeObject.onFree();
    }
  }

  // 헬퍼: 엔티티에서 스크립트(ISlimeObject) 가져오기
  private getSlimeObject(entity: Entity): ISlimeObject | null {
    return BehaviourFinder.GetBehaviour(entity) as unknown as ISlimeObject;
  }
}

Component.register(SlimeObjectPool);
