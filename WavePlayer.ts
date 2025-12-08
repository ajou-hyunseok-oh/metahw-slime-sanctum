import { Behaviour, BehaviourFinder } from 'Behaviour';
import { CodeBlockEvents, Component, Entity, Player, PropTypes, NetworkEvent, AudioGizmo, ParticleGizmo } from 'horizon/core';
import { SlimeSpawnController } from 'SlimeSpawnController';
import { WAVE_DATA, WavePlan, WAVE_CORE_HP } from 'GameBalanceData';
import { Events } from 'Events';
import { PlayerPersistentVariables } from 'PlayerPersistentVariables';
import { PlayerManager, TeamType } from 'PlayerManager';
import { EntityHPUpdateEvent } from "HPProgressView";
import { MatchStateManager } from 'MatchStateManager';

enum WaveState {
  Ready = "Ready",
  WaveRunning = "WaveRunning",
  CoreTargeting = "CoreTargeting",
  WaveEnd = "WaveEnd",
  MatchEnd = "MatchEnd"
}

export class WavePlayer extends Behaviour<typeof WavePlayer> {
  static propsDefinition = {
    slimeSpawner: { type: PropTypes.Entity },
    coreNoesisUIEntity: { type: PropTypes.Entity },
    coreExpVFXEntity: { type: PropTypes.Entity },
    coreExpSFXEntity: { type: PropTypes.Entity },
  };

  private slimeSpawnController: SlimeSpawnController | null = null;
  private ppv: PlayerPersistentVariables | null = null;
  
  private currentState: WaveState = WaveState.Ready;
  private currentWave: number = 1;  
  private currentCoreHP: number = WAVE_CORE_HP;
  private myTeam: TeamType = TeamType.None;
  private isSpawning: boolean = false;

  public Initialize() {
    this.ResetGame();
  }
  
  preStart() {
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerEnterTrigger, this.OnPlayerEnterTrigger.bind(this));
    this.connectNetworkBroadcastEvent(Events.coreDestroyed, this.OnCoreDestroyed.bind(this));
    this.connectNetworkEvent(this.entity, Events.gameReset, this.ResetGame.bind(this));
    this.connectNetworkBroadcastEvent(Events.coreHit, this.OnCoreHit.bind(this));
  }

  start() {
    this.slimeSpawnController = BehaviourFinder.GetBehaviour<SlimeSpawnController>(this.props.slimeSpawner) ?? null;
    this.ppv = new PlayerPersistentVariables(this.world);
  }

  Update(deltaTime: number) {    
    if (this.currentState === WaveState.WaveRunning) {
        // 소환이 끝났고, 모든 슬라임이 처치되었는지 확인
        const activeCount = this.slimeSpawnController?.getActiveSlimeCount() ?? 0;
        if (!this.isSpawning && activeCount <= 0) {
            this.WaveClear();
        }
    } else if (this.currentState === WaveState.CoreTargeting) {
        // 모든 슬라임이 처치되었는지 확인
        const activeCount = this.slimeSpawnController?.getActiveSlimeCount() ?? 0;
        if (activeCount <= 0) {
            this.WaveClear();
        }
    }
  }

  private ReportWaveStart(waveIndex: number) {
    const players = PlayerManager.instance.getTeamPlayers(this.myTeam);
    players.forEach(p => {
        this.sendNetworkEvent(p, Events.waveStart, { wave: waveIndex, remainingSeconds: 3 });
    });
  }

  OnPlayerEnterTrigger(player: Player) {    
    if (this.currentState === WaveState.Ready) {        
        console.log(`[WavePlayer] Player ${player.name.get()} entered trigger. Starting Wave 1.`);        
        this.myTeam = PlayerManager.instance.getPlayerTeam(player);
        this.StartWave(1);
    }
  }

  private async StartWave(waveIndex: number) {
    if (waveIndex > WAVE_DATA.length) {
        console.log("[WavePlayer] All waves completed!");
        this.currentState = WaveState.MatchEnd; 
        
        // 승리 처리 (결과 정산)
        if (MatchStateManager.instance) {
            MatchStateManager.instance.notifyTeamVictory(this.myTeam);
        }
        return;
    }

    this.currentWave = waveIndex;

    const waveData = WAVE_DATA.find(w => w.wave === waveIndex);
    if (!waveData) {
        console.error(`[WavePlayer] Wave data not found for wave ${waveIndex}`);
        return;
    }    

    this.currentState = WaveState.WaveRunning;    

    this.ReportWaveStart(waveIndex);

    // Update 루프 대신 setTimeout으로 정확한 시간에 트리거 (데이터 기반 Duration 사용)
    this.async.setTimeout(() => {
        // 웨이브가 바뀌지 않았고, 여전히 진행 중일 때만 실행
        if (this.currentWave === waveIndex && this.currentState === WaveState.WaveRunning) {
            this.StartCoreTargeting();
        }
    }, waveData.duration * 1000);

    // 몬스터 소환
    this.isSpawning = true;
    await this.slimeSpawnController?.spawnWave(waveData, waveData.spawnCount);
    this.isSpawning = false;
  }

  private StartCoreTargeting() {
    console.log(`[WavePlayer] Wave ${this.currentWave} Time Over! Calling slimeSpawnController.targetCore()`);
    this.currentState = WaveState.CoreTargeting;
    if (this.slimeSpawnController) {
        this.slimeSpawnController.targetCore();
    } else {
        console.error("[WavePlayer] slimeSpawnController is null in StartCoreTargeting!");
    }
  }

  private WaveClear() {
    console.log(`[WavePlayer] Wave ${this.currentWave} Cleared!`);
    this.currentState = WaveState.WaveEnd;    

    // 플레이어 기록 저장
    this.UpdatePlayerRecords();

    // MatchStateManager에 현재 웨이브 진행 상황 업데이트
    const players = PlayerManager.instance.getTeamPlayers(this.myTeam);
    players.forEach(player => {
        MatchStateManager.instance.setWaveProgress(player, this.currentWave);
    });

    // 다음 웨이브 준비
    this.async.setTimeout(() => {
        this.StartWave(this.currentWave + 1);
    }, 5000); 
  }

  private UpdatePlayerRecords() {
    if (!this.ppv) return;

    // 현재 팀원들만 대상으로 기록 갱신
    const players = PlayerManager.instance.getTeamPlayers(this.myTeam);
    players.forEach(player => {
        const stats = this.ppv!.load(player);
        if (stats.bestWaves < this.currentWave) {
            stats.bestWaves = this.currentWave;
            this.ppv!.save(player, stats);
            this.sendNetworkEvent(player, Events.playerPersistentStatsUpdate, stats);
        }
    });
  }

  private OnCoreHit(data: { damage: number }) {
    if (this.currentState !== WaveState.WaveRunning && this.currentState !== WaveState.CoreTargeting) return;
    if (this.currentCoreHP <= 0) return;

    this.currentCoreHP = Math.max(0, this.currentCoreHP - data.damage);
    
    // UI Update
    const coreNoesisUIEntity = this.props.coreNoesisUIEntity;
    if (coreNoesisUIEntity) {
        const scaledCurrent = (this.currentCoreHP / WAVE_CORE_HP) * 100;
        this.sendNetworkEvent(coreNoesisUIEntity, EntityHPUpdateEvent, { current: scaledCurrent, max: 100 });
    }

    // Broadcast Under Attack (Visuals/Sound)
    this.sendNetworkBroadcastEvent(Events.coreUnderAttack, { currentHp: this.currentCoreHP, maxHp: WAVE_CORE_HP });

    if (this.currentCoreHP <= 0) {
        this.sendNetworkBroadcastEvent(Events.coreDestroyed, {});
        this.OnCoreDestroyed();
    }
  }

  private OnCoreDestroyed() {
    console.log("[WavePlayer] Core destroyed! Game Over.");
    this.currentState = WaveState.MatchEnd;
    
    // Play Effects (SFX/VFX)
    if (this.props.coreExpSFXEntity) {
        this.props.coreExpSFXEntity.as(AudioGizmo)?.play();
    }
    if (this.props.coreExpVFXEntity) {
        this.props.coreExpVFXEntity.as(ParticleGizmo)?.play();
    }

    // Kill all slimes
    this.slimeSpawnController?.killAllSlimes();

    // MatchStateManager를 통해 패배 처리 (결과창 표시 포함)
    if (MatchStateManager.instance) {
        MatchStateManager.instance.notifyTeamDefeat(this.myTeam);
    }

    // Reset Game after delay? or Wait for user input in DeathPage
    // For now, let's just show the death page.
  }

  private ResetGame() {
    this.currentState = WaveState.Ready;
    this.currentCoreHP = WAVE_CORE_HP;
    this.currentWave = 1;

    const coreNoesisUIEntity = this.props.coreNoesisUIEntity;
    if (coreNoesisUIEntity) {
        // UI 게이지는 0~100 범위로 정규화하여 전달
        const scaledCurrent = (this.currentCoreHP / WAVE_CORE_HP) * 100;
        this.sendNetworkEvent(coreNoesisUIEntity, EntityHPUpdateEvent, { current: scaledCurrent, max: 100 });
    }
  }
}
Component.register(WavePlayer);