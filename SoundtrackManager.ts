// Copyright (c) Meta Platforms, Inc. and affiliates.

// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import { Behaviour } from 'Behaviour';
import { Events } from 'Events';
import { PlayerMode, PlayerManager } from 'PlayerManager';
import { AudioGizmo, Component, NetworkEvent, PropTypes } from 'horizon/core';

const playerModeChangedEvent = (Events as unknown as {
  playerModeChanged: NetworkEvent<{ mode: string }>;
}).playerModeChanged;

export enum SountrackStates {
  Lobby,
  Match,  
}

export enum SountrackOneOffs {
  Death,
}

export class SoundtrackManager extends Behaviour<typeof SoundtrackManager> {
  static propsDefinition = {
    lobbyMusic: {type: PropTypes.Entity},
    matchMusic: {type: PropTypes.Entity},
    deathStinger: {type: PropTypes.Entity},
  };

  private stateTracks = new Map<SountrackStates, AudioGizmo | null>();
  private oneOffTracks = new Map<SountrackOneOffs, AudioGizmo | null>();
  private currentTrack: AudioGizmo | null = null;

  Start() {
    if (this.props.lobbyMusic) {
      this.stateTracks.set(SountrackStates.Lobby, this.props.lobbyMusic.as(AudioGizmo));
    }
    
    if (this.props.matchMusic) {
      this.stateTracks.set(SountrackStates.Match, this.props.matchMusic.as(AudioGizmo));
    }

    if (this.props.deathStinger) {
      this.oneOffTracks.set(SountrackOneOffs.Death, this.props.deathStinger.as(AudioGizmo));
    }

    //this.playMusicState(SountrackStates.Lobby);
    this.initialize();
  }

  private async initialize() {
    // Wait for PlayerManager instance to be available
    let retries = 0;
    while (!PlayerManager.instance && retries < 50) {
      await this.delay(100); // Wait 100ms
      retries++;
    }

    if (!PlayerManager.instance) {
      console.error('[SoundtrackManager] Failed to find PlayerManager instance after retries.');
      return;
    }

    this.registerEventListeners();

    // Initial state sync
    const localPlayer = this.world.getLocalPlayer();
    if (localPlayer) {
      // Client-side PlayerManager might not have the synced state.
      // Request the current mode from the Server.
      this.sendNetworkBroadcastEvent(Events.playerModeRequest, { playerId: localPlayer.id });
      console.log('[SoundtrackManager] Requested initial player mode from server.');
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => this.async.setTimeout(() => resolve(), ms));
  }

  private registerEventListeners() {  
    const localPlayer = this.world.getLocalPlayer();
    if (localPlayer) {
      console.log('[SoundtrackManager] Listening for events on LocalPlayer.');
      
      // Player Mode Changed (Lobby <-> Match)
      // WeaponBase.ts, LobbyPageView.ts 등 다른 스크립트들이 localPlayer를 통해 이벤트를 수신하고 있으므로 이를 따릅니다.
      this.connectNetworkEvent(localPlayer, playerModeChangedEvent, (data) => {
        console.log(`[SoundtrackManager] Mode changed to: ${data.mode}`);
        if (data.mode === PlayerMode.Lobby) {
          this.playMusicState(SountrackStates.Lobby);
        } else if (data.mode === PlayerMode.Match) {
          this.playMusicState(SountrackStates.Match);
        }
      });
    } else {
      console.error('[SoundtrackManager] LocalPlayer not found!');
    }
  }
  
  private playMusicState(state: SountrackStates) {
    this.currentTrack?.stop();

    if (this.stateTracks.has(state)) {
      const audio = this.stateTracks.get(state);
      if (audio) {
        audio.play();
        this.currentTrack = audio;
      }
    }
  }

  private playOneOff(oneOff: SountrackOneOffs) {
    if (this.oneOffTracks.has(oneOff)) {
      const audio = this.oneOffTracks.get(oneOff);
      if (audio) {
        audio.play();
      }
    }
  }
}
Component.register(SoundtrackManager);
