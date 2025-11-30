// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on November 28, 2025

import { Behaviour, BehaviourFinder } from 'Behaviour';
import { GamePlayers } from 'GamePlayers';
import { Component, Player, PropTypes } from 'horizon/core';
import { WeaponSelector, WeaponType } from 'WeaponSelector';

export enum PlayerMode {
  Lobby = "Lobby",
  Match = "Match",
}

type ManagedPlayerState = {
  mode: PlayerMode;
};

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

  // Singleton
  static instance: PlayerManager;
  private weaponSelector: WeaponSelector | undefined;

  private readonly playerStates = new Map<number, ManagedPlayerState>();
  public gamePlayers: GamePlayers = new GamePlayers();

  Awake() {
    PlayerManager.instance = this;
  }

  Start() {
    this.weaponSelector = WeaponSelector.Instance ?? undefined;
  }

  public setPlayerMode(player: Player, mode: PlayerMode) {
    const state = this.getOrCreatePlayerState(player);
    if (state.mode === mode) {
      return;
    }

    state.mode = mode;
    this.onPlayerModeChanged(player, mode);
  }

  private getOrCreatePlayerState(player: Player): ManagedPlayerState {
    let state = this.playerStates.get(player.id);
    if (!state) {
      state = { mode: PlayerMode.Lobby };
      this.playerStates.set(player.id, state);
    }
    return state;
  }

  private onPlayerModeChanged(player: Player, mode: PlayerMode) {
    switch (mode) {
      case PlayerMode.Lobby:
        console.log(`[PlayerManager] ${player.name.get()} -> Lobby`);
        break;
      case PlayerMode.Match:
        console.log(`[PlayerManager] ${player.name.get()} -> Match`);
        this.grantMatchStartingWeapon(player);
        break;
    }
  }

  private grantMatchStartingWeapon(player: Player) {
    if (!this.weaponSelector) {
      console.warn('[PlayerManager] WeaponSelector가 준비되지 않았습니다.');
      return;
    }

    this.weaponSelector.grabWeapon(WeaponType.Melee, 1, player);
  }
}
Component.register(PlayerManager);