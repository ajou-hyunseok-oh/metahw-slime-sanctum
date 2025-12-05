import { Behaviour, BehaviourFinder } from 'Behaviour';
import { Component, Entity, Player, PropTypes, Quaternion, Vec3 } from 'horizon/core';
import { SlimeObjectPool, SlimeType } from 'SlimeObjectPool';

export class SlimeSpawnController extends Behaviour<typeof SlimeSpawnController> {
  static propsDefinition = {
    slimeObjectPool: { type: PropTypes.Entity },
    blueAsset: { type: PropTypes.Asset, default: undefined },
    pinkAsset: { type: PropTypes.Asset, default: undefined },
    kingAsset: { type: PropTypes.Asset, default: undefined }    
  };

  private slimeObjectPool: SlimeObjectPool | null = null;  
  
  // Test
  private spawnInterval: number | null = null;
  
  Start() {
    this.slimeObjectPool = BehaviourFinder.GetBehaviour<SlimeObjectPool>(this.props.slimeObjectPool) ?? null;
    
    // 1초 주기로 슬라임 스폰 시작
    this.spawnInterval = this.async.setInterval(() => {
      console.warn('spawnInterval');
      void this.getRandomSlimeAsset();
    }, 1000);
  }

  private async getRandomSlimeAsset() {
    const randomType = ['blue', 'pink', 'king'][Math.floor(Math.random() * 3)];

    switch (randomType) {
      case 'blue': this.slimeObjectPool?.spawn(SlimeType.Blue, this.getRandomVector3(), new Quaternion(0, 0, 0, 1));       break;
      case 'pink': this.slimeObjectPool?.spawn(SlimeType.Pink, this.getRandomVector3(), new Quaternion(0, 0, 0, 1));       break;
      case 'king': this.slimeObjectPool?.spawn(SlimeType.King, this.getRandomVector3(), new Quaternion(0, 0, 0, 1));       break;
    }
  }

  private getRandomVector3(): Vec3 {
    return new Vec3(Math.random() * 10 - 5, Math.random() * 10 - 5, Math.random() * 10 - 5);
  }
}
Component.register(SlimeSpawnController);