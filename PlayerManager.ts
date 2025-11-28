// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on November 28, 2025

import { Behaviour, BehaviourFinder } from 'Behaviour';
import { Events } from 'Events';
import { GameConstants } from 'GameConstants';
import { GamePlayers } from 'GamePlayers';
import { PlayerData } from 'PlayerData';
import { HapticFeedback, HapticHand, HapticType } from 'HapticFeedback';
import { CodeBlockEvents, Component, Player, PropTypes, SpawnPointGizmo, Vec3 } from 'horizon/core';
import { ObjectPool } from 'ObjectPool';

export class PlayerManager extends Behaviour<typeof PlayerManager> {
  static propsDefinition = {
    matchSpawnPoint: { type: PropTypes.Entity },
    lobbySpawnPoint: { type: PropTypes.Entity },
    playerMaxHp: { type: PropTypes.Number, default: 100 },
    respawnInvincibibilityMs: { type: PropTypes.Number, default: 3000 },
    playerStartAmmo: { type: PropTypes.Number, default: 10 },
    knockbackForceOnHit : { type: PropTypes.Number, default: 0 },
    hitScream : { type: PropTypes.Entity },
    hudPool: { type: PropTypes.Entity },
  };

  private hudPool: ObjectPool | undefined;

  // Singleton
  static instance: PlayerManager;

  // We can use our helpful Utils class to easily manage players
  public gamePlayers: GamePlayers = new GamePlayers();

  Awake() {
  }

  Start() {    
  }
}
Component.register(PlayerManager);