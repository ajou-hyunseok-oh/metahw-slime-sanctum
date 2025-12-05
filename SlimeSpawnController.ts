import { Behaviour, BehaviourFinder } from 'Behaviour';
import { Component, Entity, Player, PropTypes, Quaternion, Vec3 } from 'horizon/core';
import { SlimeObjectPool, SlimeType } from 'SlimeObjectPool';

export class SlimeSpawnController extends Behaviour<typeof SlimeSpawnController> {
  static propsDefinition = {
    slimeObjectPool: { type: PropTypes.Entity },    
  };

  private slimeObjectPool: SlimeObjectPool | null = null;  
  
  // Test
  private spawnInterval: number | null = null;
  
  Start() {
    this.slimeObjectPool = BehaviourFinder.GetBehaviour<SlimeObjectPool>(this.props.slimeObjectPool) ?? null;
    
    // 1초 주기로 슬라임 스폰 시작
    this.spawnInterval = this.async.setInterval(() => {
      this.getRandomSlimeAsset();      
    }, 2000);
  }

  private getRandomSlimeAsset() {
    const randomType = Math.floor(Math.random() * 3) as SlimeType;
    this.slimeObjectPool!.spawn(randomType, new Vec3(0, 0, 0), Quaternion.one);    
  }  
}
Component.register(SlimeSpawnController); 