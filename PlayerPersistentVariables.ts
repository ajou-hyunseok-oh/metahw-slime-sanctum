// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 02, 2025

import * as hz from 'horizon/core';
const VG_CURRENCY = 'Currency';
const CURRENCY_COINS = `Coins`;
const CURRENCY_GEMS = `Gems`;
const VG_PLAY = 'Play';
const PLAY_BEST_WAVES = `BestWaves`;
const PLAY_KilledSlimes = `KilledSlimes`;

export type PersistentVariables = {
  coins: number;
  gems: number;
  bestWaves: number;
  killedSlimes: number;
};

export class PlayerPersistentVariables {
  constructor(private readonly world: hz.World) {}

  load(player: hz.Player): PersistentVariables {
    const coins = this.world.persistentStorage.getPlayerVariable<number>(player, `${VG_CURRENCY}:${CURRENCY_COINS}`);
    const gems = this.world.persistentStorage.getPlayerVariable<number>(player, `${VG_CURRENCY}:${CURRENCY_GEMS}`);
    const bestWaves = this.world.persistentStorage.getPlayerVariable<number>(player, `${VG_PLAY}:${PLAY_BEST_WAVES}`);
    const killedSlimes = this.world.persistentStorage.getPlayerVariable<number>(player, `${VG_PLAY}:${PLAY_KilledSlimes}`);
    
    return {
      coins,
      gems,
      bestWaves,
      killedSlimes,
    };
  }

  save(player: hz.Player, variables: PersistentVariables): void {
    this.world.persistentStorage.setPlayerVariable(player, `${VG_CURRENCY}:${CURRENCY_COINS}`, variables.coins);
    this.world.persistentStorage.setPlayerVariable(player, `${VG_CURRENCY}:${CURRENCY_GEMS}`, variables.gems);
    this.world.persistentStorage.setPlayerVariable(player, `${VG_PLAY}:${PLAY_BEST_WAVES}`, variables.bestWaves);
    this.world.persistentStorage.setPlayerVariable(player, `${VG_PLAY}:${PLAY_KilledSlimes}`, variables.killedSlimes);
  }  
}