// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on November 28, 2025

import { Behaviour, BehaviourFinder } from 'Behaviour';
import { GamePlayers } from 'GamePlayers';
import { Events } from 'Events';
import { Component, NetworkEvent, Player, PropTypes } from 'horizon/core';
import { WeaponSelector, WeaponType } from 'WeaponSelector';

export enum PlayerMode {
  Lobby = "Lobby",
  Match = "Match",
}

type ManagedPlayerState = {
  mode: PlayerMode;
};

const playerModeChangedEvent = (Events as unknown as {
  playerModeChanged: NetworkEvent<{ mode: string }>;
}).playerModeChanged;

const playerModeRequestEvent = (Events as unknown as {
  playerModeRequest: NetworkEvent<{ playerId: number }>;
}).playerModeRequest;

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
    this.connectNetworkBroadcastEvent(playerModeRequestEvent, this.onPlayerModeRequest.bind(this));
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
    this.notifyPlayerMode(player, mode);

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

  public getPlayerMode(player: Player): PlayerMode {
    return this.getOrCreatePlayerState(player).mode;
  }

  private onPlayerModeRequest(data: { playerId: number }) {
    const player = this.world.getPlayers().find((p) => p.id === data.playerId);
    if (!player) {
      return;
    }

    const mode = this.getPlayerMode(player);
    this.notifyPlayerMode(player, mode);
  }

  private notifyPlayerMode(player: Player, mode: PlayerMode) {
    this.sendNetworkEvent(player, playerModeChangedEvent, { mode });
  }
}
Component.register(PlayerManager);