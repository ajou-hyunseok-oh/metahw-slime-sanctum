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
  }

  public async spawnSanctum(fixedSpawnEntities: Entity[], waveSpawnEntities: Entity[], coreEntities: Entity, players: Player[], startProgress: number) {    
    // reference copy
    this.coreEntity = coreEntities;
    this.fixedSpawnEntities = fixedSpawnEntities;
    this.waveSpawnEntities = waveSpawnEntities;    
    
    // 전체 80%를 전체 블루 슬라임 수로 나누어 균등하게 할당
    const progressStep = 80 / PullSize.Blue;

    const nextProgress = await this.spawnFixedSlimes(players, startProgress, progressStep);
    
  }

  public async spawnWave(wavePlan: WavePlan, count: number) {
    if (this.waveSpawnEntities.length === 0) return;

    // 웨이브별 몬스터 구성 확률 적용
    // count만큼 소환하되, waveSpawnEntities 위치를 순회하며 소환
    // 한 번에 너무 많이 소환하면 부하가 걸릴 수 있으므로 약간의 텀을 줄 수도 있음.
    // 여기서는 일단 단순하게 순차 소환 (필요시 async delay 추가)

    for (let i = 0; i < count; i++) {
        const spawnPoint = this.waveSpawnEntities[i % this.waveSpawnEntities.length];
        const type = this.determineSlimeType(wavePlan);
        
        this.slimeObjectPool?.spawn(type, spawnPoint.position.get(), spawnPoint.rotation.get());
        
        // 약간의 간격을 두고 소환하여 겹침 방지 및 부하 분산
        if (i % 5 === 0) {
            await new Promise(resolve => this.async.setTimeout(resolve, 50));
        }
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

  private determineSlimeType(plan: WavePlan): SlimeType {
    const rand = Math.random();
    if (rand < plan.kingChance) {
        return SlimeType.King;
    } else if (rand < plan.kingChance + plan.pinkChance) {
        return SlimeType.Pink;
    } else {
        return SlimeType.Blue;
    }
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
        players.forEach(player => { this.sendNetworkEvent(player, Events.loadingProgressUpdate, { progress: displayProgress }); });

        // Small delay for visual effect
        await new Promise(resolve => this.async.setTimeout(resolve, 100)); 
      }
    }
    return currentProgress;
  }
}
Component.register(SlimeSpawnController);