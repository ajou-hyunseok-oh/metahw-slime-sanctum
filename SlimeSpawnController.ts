// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 06, 2025 

import { Behaviour, BehaviourFinder } from 'Behaviour';
import { Component, Entity, Player, PropTypes, Quaternion, Vec3 } from 'horizon/core';
import { SlimeObjectPool, SlimeType, PullSize } from 'SlimeObjectPool';
import { Events } from 'Events';
import { WavePlan } from 'GameBalanceData';
import { SlimeAgent, SlimeState } from 'SlimeAgent';

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

    console.log(`[SlimeSpawnController] waveSpawnEntities: ${this.waveSpawnEntities.length}`);
  }

  public async spawnSanctum(fixedSpawnEntities: Entity[], waveSpawnEntities: Entity[], coreEntities: Entity, players: Player[], startProgress: number) {    
    // reference copy
    this.coreEntity = coreEntities;
    this.fixedSpawnEntities = fixedSpawnEntities;
    this.waveSpawnEntities = waveSpawnEntities;    
        
    const progressStep = 80 / this.fixedSpawnEntities.length * 3; // 3 is the number of blue slimes per fixed spawn entity
    await this.spawnFixedSlimes(players, startProgress, progressStep);    
  }

  public async spawnWave(wavePlan: WavePlan) {
    if (this.waveSpawnEntities.length === 0) return;
    const waveBuffer = {
      modelScaling: wavePlan.modelScaling ?? 1,
      damageScaling: wavePlan.damageScaling ?? 1,
      healthScaling: wavePlan.healthScaling ?? 1,
    };

    for (let i = 0; i < wavePlan.turn; i++) {
      // 블루 슬라임은 count 만큼 소환 이후 더이상 소환하지 않는다.    
      for (let j = 0; j < this.waveSpawnEntities.length; j++) {
        if (Math.random() < wavePlan.pinkChance) {
          const spawnPos = this.getRandomSpawnPosition(this.waveSpawnEntities[j].position.get());
          this.slimeObjectPool?.spawn(SlimeType.Pink, spawnPos, this.waveSpawnEntities[j].rotation.get(), waveBuffer);
          await new Promise(resolve => this.async.setTimeout(resolve, 500));
        }

        for (let i = 0; i < 6; i++) {          
          const spawnPos = this.getRandomSpawnPosition(this.waveSpawnEntities[j].position.get());
          this.slimeObjectPool?.spawn(SlimeType.Blue, spawnPos, this.waveSpawnEntities[j].rotation.get(), waveBuffer);
          await new Promise(resolve => this.async.setTimeout(resolve, 500));
        }              

        if (Math.random() < wavePlan.kingChance) {
          const spawnPos = this.getRandomSpawnPosition(this.waveSpawnEntities[j].position.get());
          this.slimeObjectPool?.spawn(SlimeType.King, spawnPos, this.waveSpawnEntities[j].rotation.get(), waveBuffer);
          await new Promise(resolve => this.async.setTimeout(resolve, 500));
        }

        await new Promise(resolve => this.async.setTimeout(resolve, 3000));
      }

      await new Promise(resolve => this.async.setTimeout(resolve, 5000));
    }    
  }

  public targetCore() {
    if (!this.coreEntity) return;
    
    const activeAgents = SlimeAgent.getActiveAgents();
    activeAgents.forEach(agent => {
        agent.assignCore(this.coreEntity);
        agent.triggerCoreAttack();
    });
  }

  public getActiveSlimeCount(): number {
    const activeAgents = SlimeAgent.getActiveAgents();
    // 죽지 않은 슬라임만 카운트
    return activeAgents.filter(agent => !agent.isDead).length;
  }

  public killAllSlimes() {
    const activeAgents = SlimeAgent.getActiveAgents();
    activeAgents.forEach(agent => {
        if (!agent.isDead) {
            agent.changeState(SlimeState.Dead);
        }
    });
  }

  private async spawnFixedSlimes(players: Player[], startProgress: number, step: number): Promise<number> {
    let currentProgress = startProgress;

    for (const entity of this.fixedSpawnEntities) {
      for (let i = 0; i < 3; i++) {
        const spawnPos = this.getRandomSpawnPosition(entity.position.get());
        this.slimeObjectPool?.spawn(SlimeType.Blue, spawnPos, entity.rotation.get());
        
        // Update progress
        currentProgress += step;
        // 99%까지만 진행, 100%는 텔레포트 직전에 SublevelController에서 처리
        const displayProgress = Math.min(Math.floor(currentProgress), 99);
        players.forEach(player => { this.sendNetworkEvent(player, Events.loadingProgressUpdate, { progress: displayProgress }); });

        // Small delay for visual effect
        await new Promise(resolve => this.async.setTimeout(resolve, 100)); 
      }
    }
    return currentProgress;
  }

  private getRandomSpawnPosition(origin: Vec3): Vec3 {
    const radius = 1.0; // 스폰 반경
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * radius;
    return new Vec3(
        origin.x + Math.cos(angle) * distance, 
        origin.y, 
        origin.z + Math.sin(angle) * distance
    );
  }
}
Component.register(SlimeSpawnController);