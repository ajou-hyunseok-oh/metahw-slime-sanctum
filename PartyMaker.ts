import { Behaviour, BehaviourFinder } from 'Behaviour';
import { CodeBlockEvents, Component, Entity, Player, PropTypes, Vec3, Quaternion, SpawnPointGizmo, TextGizmo, NetworkEvent } from 'horizon/core';
import { SublevelController } from 'SublevelController';
import { PlayerManager, PlayerMode } from 'PlayerManager';
import { Events } from 'Events';
import { MatchStateManager } from 'MatchStateManager';

// 네트워크 이벤트 데이터 구조 정의
type PartyStateData = {
  playerNames: string[];
  isMatchStarted: boolean;
  timerEndTime: number; // 타이머 종료 타임스탬프 (0이면 타이머 꺼짐)
};

// 상태 동기화를 위한 이벤트
const PartyStateEvent = new NetworkEvent<PartyStateData>("PartyStateEvent");

class PartyMaker extends Behaviour<typeof PartyMaker> {  
  static propsDefinition = {
    teamId: { type: PropTypes.Number },
    countdownDuration: { type: PropTypes.Number, default: 10 },
    timerTextGizmo: { type: PropTypes.Entity },
    noTeamTextGizmo: { type: PropTypes.Entity },
    trigger: { type: PropTypes.Entity, default: undefined},    
    sublevelControl: { type: PropTypes.Entity },
    lobbySpawnPoint: { type: PropTypes.Entity },
  };

  private readonly MAX_PLAYERS_IN_TEAM: number = 4;
  private readonly TIMER_TICK_MS: number = 50; // 클라이언트 업데이트 주기
  
  // 서버 로직용 변수
  private playersInTeam: Player[] = [];
  private isMatchStarted: boolean = false;
  private timerEndTimestamp: number = 0;
  private timer: any = null;

  // 클라이언트 표시용 변수
  private clientTimerEndTime: number = 0;

  Awake() {
    // 트리거 이벤트는 서버(호스트)에서만 처리하도록 함
    if (this.props.trigger) {
      this.connectCodeBlockEvent(this.props.trigger, CodeBlockEvents.OnPlayerEnterTrigger, this.onPlayerEnterTrigger.bind(this));
      this.connectCodeBlockEvent(this.props.trigger, CodeBlockEvents.OnPlayerExitTrigger, this.onPlayerExitTrigger.bind(this));
    } 
  }

  Start() {
    const isServer = this.world.getLocalPlayer().id === this.world.getServerPlayer().id;

    if (isServer) {
      // 서버: 초기 상태 전송
      this.broadcastState();
      
      // 로비 복귀 요청 처리
      this.connectNetworkBroadcastEvent(Events.returnToLobby, this.onPlayerReturnToLobby.bind(this));
    } else {
      // 클라이언트: 상태 수신 대기
      this.connectNetworkEvent(this.world.getLocalPlayer(), PartyStateEvent, (data) => {
        this.onStateUpdate(data);
      });
    }

    // 클라이언트 사이드 타이머 업데이트 (부드러운 표시를 위해 각 클라이언트가 독립적으로 계산)
    this.async.setInterval(() => {
      this.updateClientTimer();
    }, this.TIMER_TICK_MS);
  }

  // --- [Server Side Logic] ---

  onPlayerEnterTrigger(player: Player) {
    // 서버인지 확인 (안전장치)
    if (this.world.getLocalPlayer().id !== this.world.getServerPlayer().id) return;

    console.log(`Player ${player.name.get()} entered team${this.props.teamId}.`);
    if (this.isMatchStarted) return;
    if (this.playersInTeam.some(p => p.id === player.id)) return;
    if (this.playersInTeam.length >= this.MAX_PLAYERS_IN_TEAM) return;

    this.playersInTeam.push(player);
    
    // 첫 플레이어 입장 시 타이머 시작
    if (this.playersInTeam.length === 1 && this.timerEndTimestamp === 0) {
      this.startTimer();
    } else {
      // 상태 업데이트 브로드캐스트
      this.broadcastState();
    }
  }

  onPlayerExitTrigger(player: Player) {
    if (this.world.getLocalPlayer().id !== this.world.getServerPlayer().id) return;
    if (this.isMatchStarted) return;

    console.log(`Player ${player.name.get()} exited team${this.props.teamId}.`);
    const index = this.playersInTeam.findIndex(p => p.id === player.id);
    if (index !== -1) {
      this.playersInTeam.splice(index, 1);
      
      if (this.playersInTeam.length === 0) {
        this.stopTimer(); // 타이머 중지 및 상태 전송
      } else {
        this.broadcastState();
      }
    }
  }

  private startTimer() {
    const durationMs = (this.props.countdownDuration ?? 0) * 1000;
    this.timerEndTimestamp = Date.now() + durationMs;
    
    this.broadcastState(); // 타이머 시작 알림

    // 서버 내부 타이머 로직 (매치 시작 체크용)
    if (this.timer) this.async.clearInterval(this.timer);
    this.timer = this.async.setInterval(() => {
      if (this.playersInTeam.length === 0) {
        this.stopTimer();
        return;
      }

      if (Date.now() >= this.timerEndTimestamp) {
        this.stopTimer(false);
        this.startMatch();
      }
    }, 100); // 서버 체크는 0.1초 단위면 충분
  }

  private stopTimer(clearDisplay: boolean = true) {
    if (this.timer) {
      this.async.clearInterval(this.timer);
      this.timer = null;
    }
    this.timerEndTimestamp = 0;
    this.broadcastState();
  }

  private startMatch() {
    if (this.isMatchStarted) return;

    this.isMatchStarted = true;
    this.broadcastState(); // 매치 시작 알림    
    this.loadSublevel();     
  }

  // 모든 클라이언트에게 현재 상태 전송
  private broadcastState() {
    const playerNames = this.playersInTeam.map(p => p.name.get());
    const data: PartyStateData = {
      playerNames: playerNames,
      isMatchStarted: this.isMatchStarted,
      timerEndTime: this.timerEndTimestamp
    };

    // 로컬(서버 자신) 업데이트
    this.onStateUpdate(data);
    // 리모트(다른 클라이언트) 업데이트
    this.sendNetworkBroadcastEvent(PartyStateEvent, data);
  }

  // --- [Client Side Logic (Display)] ---

  private onStateUpdate(data: PartyStateData) {
    this.clientTimerEndTime = data.timerEndTime;

    // 1. 매치 상태 표시
    if (data.isMatchStarted) {
      this.props.timerTextGizmo!.as(TextGizmo).text.set("Sanctum Exploration in Progress");
      this.props.noTeamTextGizmo!.as(TextGizmo).text.set("");
      return;
    }

    // 2. 팀 구성원 표시 (이름 목록 포함)
    const currentCount = data.playerNames.length;
    let statusText = `Team (${currentCount}/${this.MAX_PLAYERS_IN_TEAM})`;
    if (currentCount > 0) {
      statusText += `\n${data.playerNames.join(', ')}`;
    }
    this.props.noTeamTextGizmo!.as(TextGizmo).text.set(statusText);

    // 3. 타이머가 꺼져있으면 텍스트 클리어
    if (this.clientTimerEndTime === 0) {
       this.props.timerTextGizmo!.as(TextGizmo).text.set("");
    }
  }

  private updateClientTimer() {
    // 타이머가 돌고 있고, 매치가 시작되지 않았을 때만 갱신
    if (this.clientTimerEndTime > 0 && !this.isMatchStarted) {
      const timeLeft = Math.max(0, this.clientTimerEndTime - Date.now());
      
      // 시간 포맷팅 (SS.hh)
      const totalHundredths = Math.floor(timeLeft / 10);
      const seconds = Math.floor(totalHundredths / 100);
      const hundredths = totalHundredths % 100;
      const formattedTime = `${seconds.toString().padStart(2, '0')}:${hundredths.toString().padStart(2, '0')}`;
      
      this.props.timerTextGizmo!.as(TextGizmo).text.set(formattedTime);

      // 클라이언트 시각에서 타이머가 0이 되면 (서버가 곧 매치 시작 이벤트를 보낼 것임)
      if (timeLeft === 0) {
        this.clientTimerEndTime = 0; // 로컬 타이머 정지
      }
    }
  }

  private onPlayerReturnToLobby(data: { player: Player }) {
    const player = data.player;
    console.log(`[PartyMaker] Player ${player.name.get()} returning to lobby.`);

    // 1. 파티 목록에서 제거
    const index = this.playersInTeam.findIndex(p => p.id === player.id);
    if (index !== -1) {
      this.playersInTeam.splice(index, 1);
      this.broadcastState();
    }

    // 2. 플레이어 상태 정리 (MatchState)
    if (MatchStateManager.instance) {
      MatchStateManager.instance.exitMatch(player);
    }

    // 3. 로비로 이동 및 모드 변경
    const spawnGizmo = this.props.lobbySpawnPoint!.as(SpawnPointGizmo);
    if (spawnGizmo) {
      spawnGizmo.teleportPlayer(player);
    }
    PlayerManager.instance.setPlayerMode(player, PlayerMode.Lobby);

    // 4. BGM 및 UI 처리는 ResultPageView와 PlayerManager 상태 변경에 따라 클라이언트에서 처리됨
    // 명시적으로 로비 BGM 요청
    this.sendNetworkEvent(player, Events.playerAudioRequest, { player, soundId: 'Lobby' });

    // 5. 파티원이 모두 나갔으면 매치 상태 완전 초기화
    if (this.playersInTeam.length === 0) {
      console.log(`[PartyMaker] All players left. Resetting party state.`);
      this.isMatchStarted = false;
      this.stopTimer(); // 타이머 및 상태 초기화
    }
  }
  
  private loadSublevel() {
    const controllerEntity = this.props.sublevelControl;
    if (!controllerEntity) {
      console.warn("[PartyMaker] SublevelController entity is not assigned.");
      return;
    }
    const controller = BehaviourFinder.GetBehaviour<SublevelController>(controllerEntity);
    if (!controller) {
      console.error("[PartyMaker] SublevelController behaviour not found on the assigned entity.");
      return;
    }
    controller.load(this.playersInTeam);
  }
}
Component.register(PartyMaker);