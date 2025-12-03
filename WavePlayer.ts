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

type WaveSpawnPlan = {
  wave: number;
  maxBluePerZone: number;
  pinkChance: number;
  kingChance: number;
  intervalSeconds: number;
  waveScaling: number;
};

type ZoneWaveState = {
  zoneId: number;
  currentWave: number;
  nextWaveTime: number;
  activeBlue: number;
  activePink: number;
  activeKing: number;
  breachInProgress: boolean;
};

const WAVE_BALANCE_TABLE: WaveSpawnPlan[] = [
  { wave: 1, maxBluePerZone: 12, pinkChance: 0.05, kingChance: 0.0, intervalSeconds: 45, waveScaling: 1.0 },
  { wave: 2, maxBluePerZone: 14, pinkChance: 0.08, kingChance: 0.0, intervalSeconds: 42, waveScaling: 1.05 },
  { wave: 3, maxBluePerZone: 16, pinkChance: 0.10, kingChance: 0.01, intervalSeconds: 40, waveScaling: 1.1 },
  { wave: 4, maxBluePerZone: 17, pinkChance: 0.12, kingChance: 0.02, intervalSeconds: 38, waveScaling: 1.15 },
  { wave: 5, maxBluePerZone: 18, pinkChance: 0.15, kingChance: 0.03, intervalSeconds: 36, waveScaling: 1.2 },
  { wave: 6, maxBluePerZone: 19, pinkChance: 0.17, kingChance: 0.04, intervalSeconds: 34, waveScaling: 1.25 },
  { wave: 7, maxBluePerZone: 20, pinkChance: 0.19, kingChance: 0.05, intervalSeconds: 32, waveScaling: 1.3 },
  { wave: 8, maxBluePerZone: 20, pinkChance: 0.22, kingChance: 0.06, intervalSeconds: 30, waveScaling: 1.35 },
  { wave: 9, maxBluePerZone: 21, pinkChance: 0.24, kingChance: 0.07, intervalSeconds: 29, waveScaling: 1.4 },
  { wave: 10, maxBluePerZone: 22, pinkChance: 0.26, kingChance: 0.08, intervalSeconds: 28, waveScaling: 1.45 },
  { wave: 11, maxBluePerZone: 22, pinkChance: 0.28, kingChance: 0.09, intervalSeconds: 27, waveScaling: 1.5 },
  { wave: 12, maxBluePerZone: 23, pinkChance: 0.30, kingChance: 0.10, intervalSeconds: 26, waveScaling: 1.55 },
  { wave: 13, maxBluePerZone: 23, pinkChance: 0.32, kingChance: 0.12, intervalSeconds: 25, waveScaling: 1.6 },
  { wave: 14, maxBluePerZone: 24, pinkChance: 0.34, kingChance: 0.14, intervalSeconds: 24, waveScaling: 1.65 },
  { wave: 15, maxBluePerZone: 24, pinkChance: 0.36, kingChance: 0.16, intervalSeconds: 23, waveScaling: 1.7 },
  { wave: 16, maxBluePerZone: 24, pinkChance: 0.38, kingChance: 0.18, intervalSeconds: 22, waveScaling: 1.75 },
  { wave: 17, maxBluePerZone: 24, pinkChance: 0.40, kingChance: 0.20, intervalSeconds: 21, waveScaling: 1.8 },
  { wave: 18, maxBluePerZone: 24, pinkChance: 0.42, kingChance: 0.22, intervalSeconds: 20, waveScaling: 1.85 },
  { wave: 19, maxBluePerZone: 24, pinkChance: 0.44, kingChance: 0.24, intervalSeconds: 19, waveScaling: 1.9 },
  { wave: 20, maxBluePerZone: 24, pinkChance: 0.46, kingChance: 0.26, intervalSeconds: 18, waveScaling: 2.0 },
];

export class WavePlayer extends Behaviour<typeof WavePlayer>{
  static propsDefinition = {
    slimeAsset0: { type: PropTypes.Asset }, // Blue Slime
    slimeAsset1: { type: PropTypes.Asset }, // Pink Slime
    slimeAsset2: { type: PropTypes.Asset }, // King Slime
    fixedSpawnSpotId0: { type: PropTypes.Number, default: 0 },
    fixedSpawnSpotId1: { type: PropTypes.Number, default: 1 },
    fixedSpawnSpotId2: { type: PropTypes.Number, default: 2 },
  }    


  public getWavePlan(waveIndex: number): WaveSpawnPlan | null {
    if (waveIndex < 1 || waveIndex > WAVE_BALANCE_TABLE.length) {
      console.error("[WavePlayer] Invalid wave index: ", waveIndex);
      return null;
    }
    return WAVE_BALANCE_TABLE[waveIndex - 1];
  }

  private readonly zonePoolInitialized = new Set<number>();
  private readonly zonePoolEntities = new Map<number, Entity[]>();
  private readonly zoneWaveStates = new Map<number, ZoneWaveState>();

  public async activateZoneObjectPool(zoneId: number, objectPoolEntity: Entity | null, fixedSpawnEntities: Entity[] = []) {
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
      this.initializeZoneState(zoneId);
      this.spawnInitialFixedSlimes(zoneId, objectPool, fixedSpawnEntities);
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
    this.zoneWaveStates.delete(zoneId);
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

  private initializeZoneState(zoneId: number) {
    const now = Date.now();
    const initialState: ZoneWaveState = {
      zoneId,
      currentWave: 1,
      nextWaveTime: now,
      activeBlue: 0,
      activePink: 0,
      activeKing: 0,
      breachInProgress: false,
    };
    this.zoneWaveStates.set(zoneId, initialState);
  }

  private spawnInitialFixedSlimes(zoneId: number, pool: ObjectPool, fixedSpawnEntities: Entity[]) {
    if (!fixedSpawnEntities || fixedSpawnEntities.length === 0) {
      return;
    }

    const MAX_INITIAL = 9;
    let spawned = 0;

    for (const spawnPoint of fixedSpawnEntities) {
      if (spawned >= MAX_INITIAL) {
        break;
      }

      const remaining = MAX_INITIAL - spawned;
      const randomCount = 1 + Math.floor(Math.random() * 3);
      const spawnCount = Math.min(remaining, randomCount);

      for (let i = 0; i < spawnCount; i++) {
        if (spawned >= MAX_INITIAL) {
          break;
        }
        const position = spawnPoint.position.get();
        const rotation = spawnPoint.rotation.get();
        const allocated = pool.allocate(position, rotation, null);
        if (!allocated) {
          console.warn("[WavePlayer] Not enough pooled slimes to populate fixed spawn.");
          return;
        }
        spawned += 1;
        this.adjustZoneActiveCount(zoneId, "blue", 1);
      }
    }
  }

  private adjustZoneActiveCount(zoneId: number, type: "blue" | "pink" | "king", delta: number) {
    const state = this.zoneWaveStates.get(zoneId);
    if (!state) {
      return;
    }

    switch (type) {
      case "blue":
        state.activeBlue = Math.max(0, state.activeBlue + delta);
        break;
      case "pink":
        state.activePink = Math.max(0, state.activePink + delta);
        break;
      case "king":
        state.activeKing = Math.max(0, state.activeKing + delta);
        break;
    }
  }
}
Component.register(WavePlayer);