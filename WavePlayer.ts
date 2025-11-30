// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on November 30, 2025

import { Behaviour, BehaviourFinder } from 'Behaviour';
import { Asset, Component, Entity, PropTypes } from 'horizon/core';
import { ObjectPool } from 'ObjectPool';

const FIXED_SPAWN_DELAY_MS = 150;
const FIXED_SPAWN_SCATTER_RADIUS = 2;

export class WavePlayer extends Behaviour<typeof WavePlayer>{
  static propsDefinition = {
    slimeAsset0: { type: PropTypes.Asset }, // Blue Slime
    slimeAsset1: { type: PropTypes.Asset }, // Pink Slime
    slimeAsset2: { type: PropTypes.Asset }, // King Slime
    fixedSpawnSpotId0: { type: PropTypes.Number, default: 0 },
    fixedSpawnSpotId1: { type: PropTypes.Number, default: 1 },
    fixedSpawnSpotId2: { type: PropTypes.Number, default: 2 },
  }    


  Start() {}

  // Fixed Spawn
  // 맵 진입 시 1회 생성

  // Spawn
  // 매 웨이브마다 생성
  // 단계별 웨이브 데이터 20단계 까지
  // 몬스터 종류, 마리 수
  // 웨이브 정보(코어 호출 시간)
  public async spawnFixedSlimes(objectPool: Entity, spawnPoint: Entity, index: number) {
    if (!objectPool) {
      console.error("[WavePlayer] ObjectPool entity is not set");
      return;
    }

    const objectPoolBehaviour = BehaviourFinder.GetBehaviour<ObjectPool>(objectPool);
    if (!objectPoolBehaviour) {
      console.error("[WavePlayer] ObjectPool behaviour is not set");
      return;
    }

    const fixedSpawnData = FixedSpawnData[index];
    if (!fixedSpawnData) {
      console.error(`[WavePlayer] Invalid fixed spawn data index: ${index}`);
      return;
    }

    const slimeAssets = [this.props.slimeAsset0, this.props.slimeAsset1, this.props.slimeAsset2];
    const spawnCounts = fixedSpawnData.slimeCounts ?? [];
    let spawnOrder = 0;

    for (let slimeType = 0; slimeType < slimeAssets.length; slimeType++) {
      const slimeAsset = slimeAssets[slimeType];
      const typeCount = spawnCounts[slimeType] ?? 0;

      if (!slimeAsset || typeCount <= 0) {
        continue;
      }

      for (let countIndex = 0; countIndex < typeCount; countIndex++) {
        const delay = spawnOrder * FIXED_SPAWN_DELAY_MS;
        this.async.setTimeout(() => {
          const spawnPosition = this.getScatteredSpawnPosition(spawnPoint);
          this.world.spawnAsset(slimeAsset, spawnPosition, spawnPoint.rotation.get()).then((entities) => {
            entities.forEach((entity) => {
              objectPoolBehaviour.addEntity(entity);
            });
          });
        }, delay);

        spawnOrder += 1;
      }
    }
  }

  private getScatteredSpawnPosition(spawnPoint: Entity) {
    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * FIXED_SPAWN_SCATTER_RADIUS;
    const forwardOffset = spawnPoint.forward.get().mul(Math.cos(angle) * radius);
    const rightOffset = spawnPoint.right.get().mul(Math.sin(angle) * radius);
    const spawnOffset = forwardOffset.add(rightOffset);
    return spawnPoint.position.get().add(spawnOffset);
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