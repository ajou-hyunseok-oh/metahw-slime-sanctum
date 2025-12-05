// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 06, 2025 

import { Behaviour, BehaviourFinder } from 'Behaviour';
import { Component, Entity, Player, PropTypes, Quaternion, Vec3 } from 'horizon/core';
import { SlimeObjectPool, SlimeType, PullSize } from 'SlimeObjectPool';
import { LoadingProgressUpdateEvent } from 'LoadingEvents';

export class SlimeSpawnController extends Behaviour<typeof SlimeSpawnController> {
  static propsDefinition = {
    slimeObjectPool: { type: PropTypes.Entity },    
  };

  private slimeObjectPool: SlimeObjectPool | null = null;
  private coreEntity: Entity | null = null;
  private fixedSpawnEntities: Entity[] = [];
  private waveSpawnEntities: Entity[] = [];
  
  Start() {
    this.slimeObjectPool = BehaviourFinder.GetBehaviour<SlimeObjectPool>(this.props.slimeObjectPool) ?? null;    
  }

  public async spawnSanctum(fixedSpawnEntities: Entity[], waveSpawnEntities: Entity[], coreEntities: Entity, players: Player[], startProgress: number) {    
    // reference copy
    this.coreEntity = coreEntities;
    this.fixedSpawnEntities = fixedSpawnEntities;
    this.waveSpawnEntities = waveSpawnEntities;    
    
    // 전체 80%를 전체 블루 슬라임 수로 나누어 균등하게 할당
    const progressStep = 80 / PullSize.Blue;

    const nextProgress = await this.spawnFixedSlimes(players, startProgress, progressStep);
    await this.spawnWaveSlimes(players, nextProgress, progressStep);
  }

  private async spawnFixedSlimes(players: Player[], startProgress: number, step: number): Promise<number> {
    let currentProgress = startProgress;

    for (const entity of this.fixedSpawnEntities) {
      for (let i = 0; i < 3; i++) {
        this.slimeObjectPool?.spawn(SlimeType.Blue, entity.position.get(), entity.rotation.get());
        
        // Update progress
        currentProgress += step;
        // 99%까지만 진행, 100%는 텔레포트 직전에 SublevelController에서 처리
        const displayProgress = Math.min(Math.floor(currentProgress), 99);

        players.forEach(player => {
          this.sendNetworkEvent(player, LoadingProgressUpdateEvent, { progress: displayProgress });
        });

        // Small delay for visual effect
        await new Promise(resolve => this.async.setTimeout(resolve, 100)); 
      }
    }
    return currentProgress;
  }

  private async spawnWaveSlimes(players: Player[], startProgress: number, step: number) {
    const alreadySpawned = this.fixedSpawnEntities.length * 3;
    const maxCount = PullSize.Blue;
    const remainingCount = Math.max(0, maxCount - alreadySpawned);

    if (remainingCount <= 0) {
      return;
    }

    let currentProgress = startProgress;

    for (let i = 0; i < remainingCount; i++) {
      // waveSpawnEntities 위치를 순환하며 사용
      const spawnEntity = this.waveSpawnEntities[i % this.waveSpawnEntities.length];
      if (spawnEntity) {
        this.slimeObjectPool?.spawn(SlimeType.Blue, spawnEntity.position.get(), spawnEntity.rotation.get());
      }

      currentProgress += step;
      players.forEach(player => {
        this.sendNetworkEvent(player, LoadingProgressUpdateEvent, { progress: Math.min(Math.floor(currentProgress), 99) });
      });

      await new Promise(resolve => this.async.setTimeout(resolve, 100));
    }
  }
}
Component.register(SlimeSpawnController);