// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on November 30, 2025

import { Behaviour, BehaviourFinder } from 'Behaviour';
import { Asset, Component, Entity, PropTypes, Quaternion, Vec3 } from 'horizon/core';
import { ObjectPool } from 'ObjectPool';
import { NpcAgent } from 'NpcAgent';

const DEFAULT_ZONE_POOL_PLAN = {
  blue: 35,
  pink: 12,
  king: 3,
};

export class WavePlayer extends Behaviour<typeof WavePlayer>{
  static propsDefinition = {
    slimeAsset0: { type: PropTypes.Asset }, // Blue Slime
    slimeAsset1: { type: PropTypes.Asset }, // Pink Slime
    slimeAsset2: { type: PropTypes.Asset }, // King Slime
    fixedSpawnSpotId0: { type: PropTypes.Number, default: 0 },
    fixedSpawnSpotId1: { type: PropTypes.Number, default: 1 },
    fixedSpawnSpotId2: { type: PropTypes.Number, default: 2 },
  }    


  public async spawnWaveSlimes(waveIndex: number, spawnPoint: Entity) {
    if (waveIndex < 1 || waveIndex > 20) {
      console.error("[WavePlayer] Invalid wave index: ", waveIndex);
      return;
    }

    const waveData = WaveSpawnData[waveIndex - 1];
    const slimeCount = waveData.slimeCount;
    const slimeTypes = waveData.slimeTypes;

    if (!this.props.slimeAsset0) {
      console.error("[WavePlayer] Slime asset is not set");
      return;
    }    
  }

  private readonly zonePoolInitialized = new Set<number>();
  private readonly zonePoolEntities = new Map<number, Entity[]>();

  public async activateZoneObjectPool(zoneId: number, objectPoolEntity: Entity | null) {
    if (!objectPoolEntity) {
      console.warn(`[WavePlayer] No ObjectPool entity provided for zone ${zoneId}`);
      return;
    }

    if (this.zonePoolInitialized.has(zoneId)) {
      return;
    }

    const objectPool = BehaviourFinder.GetBehaviour<ObjectPool>(objectPoolEntity);
    if (!objectPool) {
      console.error(`[WavePlayer] Provided ObjectPool entity for zone ${zoneId} is missing ObjectPool behaviour.`);
      return;
    }

    const plan = this.getPoolPlanForZone(zoneId);
    const spawnTasks: Promise<void>[] = [];
    const pooledEntities: Entity[] = [];

    const blueAsset = this.props.slimeAsset0;
    const pinkAsset = this.props.slimeAsset1;
    const kingAsset = this.props.slimeAsset2;

    if (!blueAsset || !pinkAsset || !kingAsset) {
      console.error("[WavePlayer] Slime assets are not fully assigned. Cannot activate pool.");
      return;
    }

    spawnTasks.push(
      ...this.createPoolSpawnTasks(objectPool, blueAsset, plan.blue, pooledEntities),
      ...this.createPoolSpawnTasks(objectPool, pinkAsset, plan.pink, pooledEntities),
      ...this.createPoolSpawnTasks(objectPool, kingAsset, plan.king, pooledEntities),
    );

    try {
      await Promise.all(spawnTasks);
      this.zonePoolInitialized.add(zoneId);
       this.zonePoolEntities.set(zoneId, pooledEntities);
      console.log(`[WavePlayer] Zone ${zoneId} pool primed with blue=${plan.blue}, pink=${plan.pink}, king=${plan.king}`);
    } catch (error) {
      console.error(`[WavePlayer] Failed to prime pool for zone ${zoneId}`, error);
    }
  }

  public deactivateZoneObjectPool(zoneId: number, objectPoolEntity: Entity | null) {
    const pooledEntities = this.zonePoolEntities.get(zoneId);
    if (!pooledEntities || pooledEntities.length === 0) {
      return;
    }

    if (!objectPoolEntity) {
      console.warn(`[WavePlayer] No ObjectPool entity provided to deactivate zone ${zoneId}`);
      return;
    }

    const objectPool = BehaviourFinder.GetBehaviour<ObjectPool>(objectPoolEntity);
    if (!objectPool) {
      console.error(`[WavePlayer] Provided ObjectPool entity for zone ${zoneId} is missing ObjectPool behaviour.`);
      return;
    }

    pooledEntities.forEach((entity) => {
      objectPool.removeEntity(entity);
      this.world.deleteAsset(entity);
    });

    this.zonePoolInitialized.delete(zoneId);
    this.zonePoolEntities.delete(zoneId);
    console.log(`[WavePlayer] Zone ${zoneId} pool drained.`);
  }

  private getPoolPlanForZone(_zoneId: number) {
    return { ...DEFAULT_ZONE_POOL_PLAN };
  }

  private createPoolSpawnTasks(objectPool: ObjectPool, asset: Asset, count: number, pooledEntities: Entity[]): Promise<void>[] {
    const parkingSpot = new Vec3(0, -9999, 0);
    const rotation = Quaternion.fromEuler(Vec3.zero);
    const tasks: Promise<void>[] = [];

    for (let i = 0; i < count; i++) {
      const task = this.world.spawnAsset(asset, parkingSpot, rotation).then((entities) => {
        entities.forEach((entity) => {
          objectPool.addEntity(entity);
          this.tagEntityWithPool(entity, objectPool);
          pooledEntities.push(entity);
        });
      });
      tasks.push(task);
    }

    return tasks;
  }

  private tagEntityWithPool(entity: Entity, pool: ObjectPool) {
    const npcAgent = BehaviourFinder.GetBehaviour<NpcAgent<any>>(entity);
    npcAgent?.assignOwningPool(pool);
    npcAgent?.prepareForPoolStorage();
  }
}
Component.register(WavePlayer);

const FixedSpawnData = [
  {
    fixedSpawnId: 0,
    slimeCounts: [1, 1, 1],
  },
  {
    fixedSpawnId: 1,
    slimeCounts: [3, 2, 1],
  },
  {
    fixedSpawnId: 2,
    slimeCounts: [5, 3, 2],
  },
];

const WaveSpawnData = [
  {
    waveIndex: 1,
    slimeCount: [5, 0, 0],
    slimeTypes: [0, 1, 2],
  },
  {
    waveIndex: 2,
    slimeCount: [5, 0, 0],
    slimeTypes: [0, 1, 2],
  },
  {
    waveIndex: 3,
    slimeCount: [5, 0, 0],
    slimeTypes: [0, 1, 2],
  },
  {
    waveIndex: 4,
    slimeCount: [5, 0, 0],
    slimeTypes: [0, 1, 2],
  },
  {
    waveIndex: 5,
    slimeCount: [5, 0, 0],
    slimeTypes: [0, 1, 2],
  },
  {
    waveIndex: 6,
    slimeCount: [5, 0, 0],
    slimeTypes: [0, 1, 2],
  },
  {
    waveIndex: 7,
    slimeCount: [5, 0, 0],
    slimeTypes: [0, 1, 2],
  },
  {
    waveIndex: 8,
    slimeCount: [5, 0, 0],
    slimeTypes: [0, 1, 2],
  },
  {
    waveIndex: 9,
    slimeCount: [5, 0, 0],
    slimeTypes: [0, 1, 2],
  },
  {
    waveIndex: 10,
    slimeCount: [5, 0, 0],
    slimeTypes: [0, 1, 2], 
  },
  {
    waveIndex: 11,
    slimeCount: [5, 0, 0],
    slimeTypes: [0, 1, 2],
  },
  {
    waveIndex: 12,
    slimeCount: [5, 0, 0],
    slimeTypes: [0, 1, 2],
  },
  {
    waveIndex: 13,
    slimeCount: [5, 0, 0],
    slimeTypes: [0, 1, 2],
  },
  {
    waveIndex: 14,
    slimeCount: [5, 0, 0],
    slimeTypes: [0, 1, 2],
  },
  {
    waveIndex: 15,
    slimeCount: [5, 0, 0],
    slimeTypes: [0, 1, 2],
  },
  {
    waveIndex: 16,
    slimeCount: [5, 0, 0],
    slimeTypes: [0, 1, 2],
  },
  {
    waveIndex: 17,
    slimeCount: [5, 0, 0],
    slimeTypes: [0, 1, 2],
  },
  {
    waveIndex: 18,
    slimeCount: [5, 0, 0],
    slimeTypes: [0, 1, 2],
  },
  {
    waveIndex: 19,
    slimeCount: [5, 0, 0],
    slimeTypes: [0, 1, 2],
  },
  {
    waveIndex: 20,
    slimeCount: [5, 0, 0],
    slimeTypes: [0, 1, 2], 
  },
]