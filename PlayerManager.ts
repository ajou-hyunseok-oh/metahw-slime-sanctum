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
import { MatchPageViewEvent } from 'MatchPageView';
import { LobbyPageViewEvent } from 'LobbyPageView';

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


export const PlayerStartEvent = new NetworkEvent<{player: Player}>("PlayerStartEvent");

const playerModeChangedEvent = (Events as unknown as {
  playerModeChanged: NetworkEvent<{ mode: string }>;
}).playerModeChanged;

const playerModeRequestEvent = (Events as unknown as {
  playerModeRequest: NetworkEvent<{ playerId: number }>;
}).playerModeRequest;

const playerPersistentStatsRequestEvent = (Events as unknown as {
  playerPersistentStatsRequest: NetworkEvent<{ playerId: number }>;
}).playerPersistentStatsRequest;

const playerPersistentStatsUpdateEvent = (Events as unknown as {
  playerPersistentStatsUpdate: NetworkEvent<PersistentVariables>;
}).playerPersistentStatsUpdate;

const playerShowResultsEvent = (Events as unknown as {
  playerShowResults: NetworkEvent<{player: Player, score: number, placement?: number}>;
}).playerShowResults;

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

    this.connectNetworkBroadcastEvent(playerModeRequestEvent, this.onPlayerModeRequest.bind(this));    
    this.connectNetworkBroadcastEvent(playerPersistentStatsRequestEvent, this.onPlayerPersistentStatsRequest.bind(this));
    this.connectNetworkEvent(this.world.getLocalPlayer(), playerShowResultsEvent, this.onPlayerShowResults.bind(this));

    this.connectNetworkBroadcastEvent(PlayerStartEvent, (data: {player: Player}) => {
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
      this.sendPersistentStats(player, variables);
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
        this.sendNetworkEvent(player, LobbyPageViewEvent, {enabled: true});
        this.sendNetworkEvent(player, MatchPageViewEvent, {enabled: false});        
        this.matchStateManager?.exitMatch(player);
        break;
      case PlayerMode.Match:
        const team = this.getPlayerTeam(player);        
        this.matchStateManager?.enterMatch(player, { team: team });        
        this.sendNetworkEvent(player, LobbyPageViewEvent, {enabled: false});
        this.sendNetworkEvent(player, MatchPageViewEvent, {enabled: true});        
        break;
    }
  }

  private onPlayerModeRequest(data: { playerId: number }) {
    const player = this.world.getPlayers().find((p) => p.id === data.playerId);
    if (!player) {
      return;
    }

    const mode = this.getPlayerMode(player);    
  }

  /*
  private notifyPlayerMode(player: Player, mode: PlayerMode) {
    // Debug Log
    console.log(`[PlayerManager] notifyPlayerMode called for ${player.name.get()}. Mode: ${mode}`);

    this.sendNetworkEvent(player, playerModeChangedEvent, { mode });

    // Request Audio Playback based on mode
    const soundId = mode === PlayerMode.Lobby ? 'Lobby' : 'Match';
    
    console.log(`[PlayerManager] Broadcasting playClientAudio event for ${player.name.get()}. SoundId: ${soundId}`);
    this.sendNetworkBroadcastEvent(Events.playClientAudio, { playerId: player.id, soundId });
  }
  */

  public getPersistentStats(player: Player): PersistentVariables | null {
    return this.playerPersistentCache.get(player.id) ?? null;
  }  

  private onPlayerPersistentStatsRequest(data: { playerId: number }) {
    const player = this.world.getPlayers().find((p) => p.id === data.playerId);
    if (!player) {
      return;
    }
    this.sendPersistentStats(player);
  }

  private onPlayerShowResults(data: {player: Player, score: number, placement?: number}) {
    console.log(`[PlayerManager] Game Over! Score: ${data.score}, Waves: ${data.placement ?? 0}`);
  }

  private sendPersistentStats(player: Player, stats?: PersistentVariables) {
    const payload = stats ?? this.playerPersistentCache.get(player.id);
    if (!payload) {
      return;
    }
    this.sendNetworkEvent(player, playerPersistentStatsUpdateEvent, payload);
  }
}
Component.register(PlayerManager);