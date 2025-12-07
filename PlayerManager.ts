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
import { TeamType } from 'GameConstants';

export enum PlayerMode {
  Lobby = "Lobby",
  Match = "Match",
}

type ManagedPlayerState = {
  mode: PlayerMode;
  team: TeamType;
};

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
  private playerPersistentVariables: PlayerPersistentVariables | undefined;
  private playerPersistentCache = new Map<number, PersistentVariables>();
  private matchStateManager: MatchStateManager | undefined;

  Awake() {
    PlayerManager.instance = this;
  }

  Start() {
    this.weaponSelector = WeaponSelector.Instance ?? undefined;
    this.playerPersistentVariables = new PlayerPersistentVariables(this.world);
    this.matchStateManager = MatchStateManager.instance;
    if (!this.matchStateManager) {
      console.warn('[PlayerManager] MatchStateManager 인스턴스를 찾을 수 없습니다. 매치 상태 추적이 비활성화됩니다.');
    }
    this.connectNetworkBroadcastEvent(playerModeRequestEvent, this.onPlayerModeRequest.bind(this));
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerEnterWorld, this.onPlayerEnterWorld.bind(this));
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerExitWorld, this.onPlayerExitWorld.bind(this));
    this.connectNetworkBroadcastEvent(
      playerPersistentStatsRequestEvent,
      this.onPlayerPersistentStatsRequest.bind(this)
    );
  }

  public setPlayerMode(player: Player, mode: PlayerMode) {
    const state = this.getOrCreatePlayerState(player);
    if (state.mode === mode) {
      return;
    }

    state.mode = mode;
    this.onPlayerModeChanged(player, mode);
  }

  public setPlayerTeam(player: Player, team: TeamType) {
    const state = this.getOrCreatePlayerState(player);
    state.team = team;
  }

  private getOrCreatePlayerState(player: Player): ManagedPlayerState {
    let state = this.playerStates.get(player.id);
    if (!state) {
      state = { mode: PlayerMode.Lobby, team: TeamType.None };
      this.playerStates.set(player.id, state);
    }
    return state;
  }

  private onPlayerModeChanged(player: Player, mode: PlayerMode) {
    this.notifyPlayerMode(player, mode);

    const state = this.getOrCreatePlayerState(player);

    switch (mode) {
      case PlayerMode.Lobby:
        console.log(`[PlayerManager] ${player.name.get()} -> Lobby`);
        this.matchStateManager?.exitMatch(player);
        break;
      case PlayerMode.Match:
        console.log(`[PlayerManager] ${player.name.get()} -> Match (Team: ${state.team})`);
        this.matchStateManager?.enterMatch(player, { team: state.team });        
        break;
    }
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
    // Debug Log
    console.log(`[PlayerManager] notifyPlayerMode called for ${player.name.get()}. Mode: ${mode}`);

    this.sendNetworkEvent(player, playerModeChangedEvent, { mode });

    // Request Audio Playback based on mode
    const soundId = mode === PlayerMode.Lobby ? 'Lobby' : 'Match';
    
    console.log(`[PlayerManager] Broadcasting playClientAudio event for ${player.name.get()}. SoundId: ${soundId}`);
    this.sendNetworkBroadcastEvent(Events.playClientAudio, { playerId: player.id, soundId });
  }

  public getPersistentStats(player: Player): PersistentVariables | null {
    return this.playerPersistentCache.get(player.id) ?? null;
  }

  private onPlayerEnterWorld(player: Player) {
    this.setPlayerMode(player, PlayerMode.Lobby);
    if (this.playerPersistentVariables) {
      const variables = this.playerPersistentVariables.load(player);
      this.playerPersistentCache.set(player.id, variables);
      //console.log(`[PlayerManager] Loaded persistent stats for ${player.name.get()}`);
      this.sendPersistentStats(player, variables);
    }
  }

  private onPlayerExitWorld(player: Player) {
    const cached = this.playerPersistentCache.get(player.id);
    if (cached && this.playerPersistentVariables) {
      this.playerPersistentVariables.save(player, cached);
      console.log(`[PlayerManager] Saved persistent stats for ${player.name.get()}`);
      this.playerPersistentCache.delete(player.id);
    }
    this.matchStateManager?.exitMatch(player);
  }

  private onPlayerPersistentStatsRequest(data: { playerId: number }) {
    const player = this.world.getPlayers().find((p) => p.id === data.playerId);
    if (!player) {
      return;
    }
    this.sendPersistentStats(player);
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