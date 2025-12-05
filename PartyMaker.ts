// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 04, 2025

import { Behaviour, BehaviourFinder } from 'Behaviour';
import { CodeBlockEvents, Component, Entity, Player, PropTypes, Vec3, Quaternion, SpawnPointGizmo, TextGizmo } from 'horizon/core';
import { SublevelController } from 'SublevelController';
import { PlayerManager, PlayerMode } from 'PlayerManager';

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
  private readonly TIMER_TICK_MS: number = 10;
  private playersInTeam: Player[] = [];
  private isTimerRunning: boolean = false;
  private isMatchStarted: boolean = false;
  private timerValueMs: number = 0;
  private timerEndTimestamp: number = 0;
  private timer: any = null;


  Awake() {
    if (this.props.trigger) {
      this.connectCodeBlockEvent(this.props.trigger, CodeBlockEvents.OnPlayerEnterTrigger, this.onPlayerEnterTrigger.bind(this));
      this.connectCodeBlockEvent(this.props.trigger, CodeBlockEvents.OnPlayerExitTrigger, this.onPlayerExitTrigger.bind(this));
    } 
  }

  Start() {
    this.updateMatch(false);
  }

  onPlayerEnterTrigger(player: Player) {
    console.log(`Player ${player.name.get()} entered team${this.props.teamId}.`);
    if (this.isMatchStarted) {
      return;
    }

    if (this.playersInTeam.some(p => p.id === player.id)) {
      return;
    }

    if (this.playersInTeam.length >= this.MAX_PLAYERS_IN_TEAM) {
      return;
    }

    this.playersInTeam.push(player);
    this.updateNoTeam();

    if (this.isTimerRunning == false) {
      this.startTimer();
    }
  }

  onPlayerExitTrigger(player: Player) {
    if (this.isMatchStarted) {
      return;
    }

    console.log(`Player ${player.name.get()} exited team${this.props.teamId}.`);
    const index = this.playersInTeam.findIndex(p => p.id === player.id);
    if (index !== -1) {
      this.playersInTeam.splice(index, 1);
      this.updateNoTeam();
    }

    if (this.playersInTeam.length === 0) {
      this.stopTimer();
      this.updateMatch(false);
    }
  }

  private startTimer() {
    if (this.isTimerRunning || this.isMatchStarted || this.playersInTeam.length === 0) {
      return;
    }

    if (this.timer) {
      this.async.clearInterval(this.timer);
      this.timer = null;
    }

    this.isTimerRunning = true;
    this.timerValueMs = Math.max(0, (this.props.countdownDuration ?? 0) * 1000);
    this.timerEndTimestamp = Date.now() + this.timerValueMs;
    this.updateTimer();

    if (this.timerValueMs === 0) {
      this.stopTimer(false);
      this.startMatch();
      return;
    }

    this.timer = this.async.setInterval(() => {
      if (!this.isTimerRunning) {
        return;
      }

      if (this.playersInTeam.length === 0) {
        this.stopTimer();
        this.updateMatch(false);
        return;
      }

      this.timerValueMs = Math.max(0, this.timerEndTimestamp - Date.now());
      this.updateTimer();

      if (this.timerValueMs === 0) {
        this.stopTimer(false);
        this.startMatch();
      }
    }, this.TIMER_TICK_MS);
  }

  private stopTimer(clearDisplay: boolean = true) {
    if (!this.isTimerRunning && !this.timer) {
      return;
    }

    this.isTimerRunning = false;
    this.timerValueMs = 0;
    this.timerEndTimestamp = 0;

    if (this.timer) {
      this.async.clearInterval(this.timer);
      this.timer = null;
    }

    if (clearDisplay && !this.isMatchStarted) {
      this.props.timerTextGizmo!.as(TextGizmo).text.set("");
    }
  }

  private startMatch() {
    if (this.isMatchStarted) {
      return;
    }

    this.isMatchStarted = true;
    this.updateMatch(true);
    this.loadSublevel();     
  }

  private finishMatch() {
    this.isMatchStarted = false;
    this.updateMatch(false);
    this.playersInTeam.forEach((player) => {
      // 로비로 이동
      const spawnGizmo = this.props.lobbySpawnPoint!.as(SpawnPointGizmo);
      if (spawnGizmo) {
        spawnGizmo.teleportPlayer(player);
      }

      PlayerManager.instance.setPlayerMode(player, PlayerMode.Lobby);
    });
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

  private updateTimer() {
    // 남은 시간을 SS.HH 형식(초.100분의 1초)으로 변환
    const totalHundredths = Math.floor(this.timerValueMs / 10);
    const seconds = Math.floor(totalHundredths / 100);
    const hundredths = totalHundredths % 100;
    const formattedTime = `${seconds.toString().padStart(2, '0')}:${hundredths
      .toString()
      .padStart(2, '0')}`;
    this.props.timerTextGizmo!.as(TextGizmo).text.set(formattedTime);
  }

  private updateNoTeam() {
    const noTeamText = `(${this.playersInTeam.length}/${this.MAX_PLAYERS_IN_TEAM})`;
    this.props.noTeamTextGizmo!.as(TextGizmo).text.set(noTeamText);
  }

  private updateMatch(isPlaying: boolean) {  
    if (isPlaying) {
      this.props.timerTextGizmo!.as(TextGizmo).text.set("Sanctum Exploration in Progress");
      this.props.noTeamTextGizmo!.as(TextGizmo).text.set("");
    } else {
      this.props.timerTextGizmo!.as(TextGizmo).text.set("");
      this.props.noTeamTextGizmo!.as(TextGizmo).text.set("");
    }
  }
}
Component.register(PartyMaker);