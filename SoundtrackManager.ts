// Copyright (c) Meta Platforms, Inc. and affiliates.

// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import { Behaviour } from 'Behaviour';
import { Events } from 'Events';
import { PlayerMode, PlayerManager } from 'PlayerManager';
import { AudioGizmo, Component, NetworkEvent, PropTypes } from 'horizon/core';

export class SoundtrackManager extends Behaviour<typeof SoundtrackManager> {
  static propsDefinition = {
    lobbyMusic: {type: PropTypes.Entity},
    matchMusic: {type: PropTypes.Entity},    
    gameEndStinger: {type: PropTypes.Entity},
  };

  private tracks = new Map<string, AudioGizmo>();
  private currentBgm: AudioGizmo | null = null;
  private checkInterval: any = null;
  private currentMode: string = "";

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

    // 2. 이벤트 리스너 등록 (즉시 실행)
    this.registerEventListeners();

    // 3. 상태 감시 (Polling) 시작 - 0.5초마다 실행
    // 네트워크 이벤트 유실 시에도 상태에 맞춰 음악을 재생하기 위한 안전장치
    this.checkInterval = this.async.setInterval(() => this.checkState(), 500);
  }

  private registerEventListeners() {  
    // Broadcast 이벤트 수신 (서버가 보낸 오디오 재생 요청 처리)
    this.connectNetworkBroadcastEvent(Events.playClientAudio, (data) => {
        // [참고] 개별 플레이어 제어가 필요한 경우 아래 주석을 해제하여 ID를 검사하세요.
        /*
        const localPlayer = this.world.getLocalPlayer();
        if (!localPlayer || data.playerId !== localPlayer.id) return;
        */
        
        // 요청된 사운드 재생 처리
        this.handleAudioRequest(data.soundId);
    });
  }

  private checkState() {
    // 클라이언트 환경에서만 실행
    const localPlayer = this.world.getLocalPlayer();
    if (!localPlayer) return;

    if (!PlayerManager.instance) return;

    // PlayerManager로부터 현재 플레이어의 실제 모드를 확인
    const realMode = PlayerManager.instance.getPlayerMode(localPlayer);
    
    // 현재 재생 중인 모드와 실제 모드가 다르면 동기화
    if (this.currentMode !== realMode) {
        this.currentMode = realMode;
        
        // 모드에 맞는 음악 재생
        if (realMode === PlayerMode.Lobby) {
            this.handleAudioRequest('Lobby');
        } else if (realMode === PlayerMode.Match) {
            this.handleAudioRequest('Match');
        }
    }
  }
  
  private handleAudioRequest(soundId: string) {
    if (!this.tracks.has(soundId)) {
      return;
    }

    const audio = this.tracks.get(soundId)!;

    if (soundId === 'Lobby' || soundId === 'Match') {
      // BGM 로직: 이미 재생 중인 곡이면 무시
      if (this.currentBgm === audio) return;
      
      // 이전 BGM 정지
      if (this.currentBgm) {
        this.currentBgm.stop();
      }

      // 새 BGM 재생
      audio.play();
      this.currentBgm = audio;

    } else {
      // 효과음(SFX) 로직: 즉시 재생 (중첩 방지를 위해 stop 후 play)
      audio.stop(); 
      audio.play();
      
      // 게임 종료 효과음일 경우 BGM을 멈춤
      if (soundId === 'GameEnd') {
        this.currentBgm?.stop();
        this.currentBgm = null;
      }
    }
  }
}
Component.register(SoundtrackManager);
