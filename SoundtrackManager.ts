// Copyright (c) Meta Platforms, Inc. and affiliates.

// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import { Behaviour } from 'Behaviour';
import { Events } from 'Events';
import { PlayerMode, PlayerManager } from 'PlayerManager';
import { AudioGizmo, Component, Player, PropTypes } from 'horizon/core';


export class SoundtrackManager extends Behaviour<typeof SoundtrackManager> {
  static propsDefinition = {
    lobbyMusic: {type: PropTypes.Entity},
    matchMusic: {type: PropTypes.Entity},    
    gameEndStinger: {type: PropTypes.Entity},
  };

  private tracks = new Map<string, AudioGizmo>();
  private currentBgm: AudioGizmo | null = null;  

  Start() {
    // 1. 오디오 기즈모 등록
    if (this.props.lobbyMusic) {
      this.tracks.set('Lobby', this.props.lobbyMusic.as(AudioGizmo));
    }
    if (this.props.matchMusic) {
      this.tracks.set('Match', this.props.matchMusic.as(AudioGizmo));
    }
    if (this.props.gameEndStinger) {
      this.tracks.set('GameEnd', this.props.gameEndStinger.as(AudioGizmo));
    }


    this.connectNetworkBroadcastEvent(Events.playerAudioRequest, this.onPlayerAudioRequest.bind(this));
    this.handleAudioRequest('Lobby');
  }

  private onPlayerAudioRequest(data: { player: Player, soundId: string }) {
    this.handleAudioRequest(data.soundId);
  }
  
  private handleAudioRequest(soundId: string) {
    if (!this.tracks.has(soundId)) {
      return;
    }

    if (this.currentBgm) {
      this.currentBgm.stop();
      this.currentBgm = null;
    }  

    const audio: AudioGizmo | undefined = this.tracks.get(soundId);
    if (audio) {
      audio.play();      
      this.currentBgm = audio;
    }
  }
}
Component.register(SoundtrackManager);
