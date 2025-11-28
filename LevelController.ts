// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on November 28, 2025

import { Behaviour } from 'Behaviour';
import { Entity } from 'horizon/core';

export type LevelControllerSetupPayload = {
  coreEntities: Entity[];
  fixedSpawnEntities: Entity[];
  spawnEntities: Entity[];
};

class LevelController extends Behaviour<typeof LevelController> {
  public coreEntities: Entity[] = [];
  public fixedSpawnEntities: Entity[] = [];
  public spawnEntities: Entity[] = [];

  public Setup(payload: LevelControllerSetupPayload) {
    this.coreEntities = [...payload.coreEntities];
    this.fixedSpawnEntities = [...payload.fixedSpawnEntities];
    this.spawnEntities = [...payload.spawnEntities];

    console.log("[LevelController] Setup complete.");
    console.log(`[LevelController] Core count: ${this.coreEntities.length}`);
    console.log(`[LevelController] FixedSpawn count: ${this.fixedSpawnEntities.length}`);
    console.log(`[LevelController] Spawn count: ${this.spawnEntities.length}`);
  }
}

Behaviour.register(LevelController);
export default LevelController;