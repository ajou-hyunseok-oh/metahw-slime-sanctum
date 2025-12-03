// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on November 28, 2025

import { Behaviour, BehaviourFinder } from 'Behaviour';
import { Asset, Component, Entity, PropTypes } from 'horizon/core';
import { WavePlayer } from 'WavePlayer';

export type LevelControllerSetupPayload = {
  coreEntities: Entity[];
  fixedSpawnEntities: Entity[];
  spawnEntities: Entity[];
};

export class LevelController extends Behaviour<typeof LevelController> {
  static propsDefinition = {
    wavePlayer: { type: PropTypes.Entity },
    objectPool: { type: PropTypes.Entity },
  };

  public coreEntities: Entity[] = [];
  public fixedSpawnEntities: Entity[] = [];
  public spawnEntities: Entity[] = [];

  private waveCount: number = 0;

  public Setup(payload: LevelControllerSetupPayload) {
    this.coreEntities = [...payload.coreEntities];
    this.fixedSpawnEntities = [...payload.fixedSpawnEntities];
    this.spawnEntities = [...payload.spawnEntities];

    console.log("[LevelController] Setup complete.");
    console.log(`[LevelController] Core count: ${this.coreEntities.length}`);
    console.log(`[LevelController] FixedSpawn count: ${this.fixedSpawnEntities.length}`);
    console.log(`[LevelController] Spawn count: ${this.spawnEntities.length}`);

    this.setupFixedSlimes();
  }

  setupFixedSlimes() {
    const wavePlayerEntity = this.props.wavePlayer;
    if (!wavePlayerEntity) {
      console.warn("[LevelController] waveConfig entity prop is not assigned.");
      return;
    }

    const wavePlayer = BehaviourFinder.GetBehaviour<WavePlayer>(wavePlayerEntity);
    if (!wavePlayer) {
      console.error("[LevelController] Assigned wavePlayer entity is missing WavePlayer behaviour.");
      return;
    }


    const objectPool = this.props.objectPool;
    if (!objectPool) {
      console.error("[LevelController] ObjectPool entity prop is not assigned.");
      return;
    }

    // 기존 고정 스폰 로직은 제거하고, 추후 구역별 알고리즘 실행 시 사용하도록 풀만 확보
    // 현재는 WavePlayer에서 별도 메서드로 관리하므로 여기서는 아무 것도 하지 않는다.
  }
}

Component.register(LevelController);