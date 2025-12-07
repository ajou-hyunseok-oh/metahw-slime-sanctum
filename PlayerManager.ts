// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on November 28, 2025

import { Behaviour } from 'Behaviour';
import { Events } from 'Events';
import { CodeBlockEvents, Component, NetworkEvent, Player, PropTypes } from 'horizon/core';
import { WeaponSelector, WeaponType } from 'WeaponSelector';
import { PlayerPersistentVariables, PersistentVariables } from 'PlayerPersistentVariables';
import { MatchStateManager } from 'MatchStateManager';

export enum PlayerMode {
  None = "None",
  Lobby = "Lobby",
  Match = "Match",
}

export enum TeamType {
  None = "None",
  East = "East",
  West = "West",
}

type PlayerState = {
  mode: PlayerMode;
  team: TeamType;
};

export class PlayerManager extends Behaviour<typeof PlayerManager> {
  static propsDefinition = {
    matchSpawnPoint: { type: PropTypes.Entity },
    lobbySpawnPoint: { type: PropTypes.Entity },                        
  };

  // Singleton
  static instance: PlayerManager;

  private weaponSelector: WeaponSelector | undefined;
  private readonly playerStateMap = new Map<number, PlayerState>();
  private playerPersistentVariables: PlayerPersistentVariables | undefined;
  private playerPersistentCache = new Map<number, PersistentVariables>();
  private matchStateManager: MatchStateManager | undefined;

  Awake() {
    PlayerManager.instance = this;
  }

  Start() {    
    this.playerPersistentVariables = new PlayerPersistentVariables(this.world);
    this.matchStateManager = MatchStateManager.instance!;
    this.weaponSelector = WeaponSelector.Instance ?? undefined;

    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerEnterWorld, this.onPlayerEnterWorld.bind(this));
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerExitWorld, this.onPlayerExitWorld.bind(this));

    this.connectNetworkBroadcastEvent(Events.playerPersistentStatsRequest, this.onPlayerPersistentStatsRequest.bind(this));    

    this.connectNetworkBroadcastEvent(Events.playerStart, (data: {player: Player}) => {
      const player = data.player;
      console.log(`[PlayerManager] PlayerStartEvent received for ${player.name.get()}`);
      this.setPlayerMode(player, PlayerMode.Lobby);
    });
  }

  private onPlayerEnterWorld(player: Player) {    
    this.createPlayerState(player);

    if (this.playerPersistentVariables) {
      const variables = this.playerPersistentVariables.load(player);
      this.playerPersistentCache.set(player.id, variables);
    }
  }

  private onPlayerExitWorld(player: Player) {
    const cached = this.playerPersistentCache.get(player.id);
    if (cached && this.playerPersistentVariables) {
      this.playerPersistentVariables.save(player, cached);      
      this.playerPersistentCache.delete(player.id);
    }
    this.matchStateManager?.exitMatch(player);
  }

  private createPlayerState(player: Player) {    
    const newState: PlayerState = { mode: PlayerMode.None, team: TeamType.None };
    this.playerStateMap.set(player.id, newState);    
  }

  private getPlayerState(player: Player): PlayerState {
    let state = this.playerStateMap.get(player.id);
    if (!state) {
      state = { mode: PlayerMode.Lobby, team: TeamType.None };
      this.playerStateMap.set(player.id, state);
    }
    return state;
  }

  public getPlayerMode(player: Player): PlayerMode {
    return this.getPlayerState(player).mode;
  }

  public setPlayerMode(player: Player, mode: PlayerMode) {
    const state = this.getPlayerState(player);    
    if (mode === state.mode) {
      return;
    }

    state.mode = mode;
    this.onPlayerModeChanged(player, mode);
  }

  public getPlayerTeam(player: Player): TeamType {
    return this.getPlayerState(player).team;
  }

  public setPlayerTeam(player: Player, team: TeamType) {
    const state = this.getPlayerState(player);
    state.team = team;
  }  

  private onPlayerModeChanged(player: Player, mode: PlayerMode) {    
    switch (mode) {
      case PlayerMode.Lobby:        
        this.sendNetworkEvent(player, Events.lobbyPageView, {enabled: true});
        this.sendNetworkEvent(player, Events.matchPageView, {enabled: false});
        this.sendNetworkEvent(player, Events.playerAudioRequest, { player: player, soundId: 'Lobby' });
        this.matchStateManager?.exitMatch(player);
        break;
      case PlayerMode.Match:
        const team = this.getPlayerTeam(player);        
        this.matchStateManager?.enterMatch(player, { team: team });        
        this.sendNetworkEvent(player, Events.lobbyPageView, {enabled: false});
        this.sendNetworkEvent(player, Events.matchPageView, {enabled: true});
        this.sendNetworkEvent(player, Events.playerAudioRequest, { player: player, soundId: 'Match' });
        break;
    }
  }

  public getPersistentStats(player: Player): PersistentVariables | null {
    return this.playerPersistentCache.get(player.id) ?? null;
  }  

  private onPlayerPersistentStatsRequest(data: { playerId: number }) {
    const player = this.world.getPlayers().find((p) => p.id === data.playerId);
    if (!player) {
      return;
    }

    const stats = this.getPersistentStats(player);
    if (!stats) {
      return;
    }

    this.sendNetworkEvent(player, Events.playerPersistentStatsUpdate, stats);
  }
}
Component.register(PlayerManager);