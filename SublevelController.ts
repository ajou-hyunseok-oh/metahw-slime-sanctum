// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 06, 2025 

import { Behaviour, BehaviourFinder } from 'Behaviour';
import { Component, CodeBlockEvents, Entity, PropTypes, Player, SpawnPointGizmo, TriggerGizmo, Asset, Vec3, Quaternion } from 'horizon/core';
import { SublevelEntity } from 'horizon/world_streaming';
import { PlayerManager, PlayerMode } from 'PlayerManager';
import { Events } from 'Events';
import { LoadingPageViewEvent } from 'LoadingPageView';
import { SlimeSpawnController } from 'SlimeSpawnController';
import { MatchStateManager } from 'MatchStateManager';
import { TeamType } from 'GameConstants';
import { WeaponSelector, WeaponType } from 'WeaponSelector';

export class SublevelController extends Behaviour<typeof SublevelController> {
  static propsDefinition = {
    sublevel: { type: PropTypes.Entity },
    startingZoneTrigger: { type: PropTypes.Entity },
    sanctumCutscene: { type: PropTypes.Entity },
    slimeSpawnController: { type: PropTypes.Entity },
    assignedTeam: { type: PropTypes.String, default: 'East' },
    levelUpView1: { type: PropTypes.Entity },
    levelUpView2: { type: PropTypes.Entity },
    levelUpView3: { type: PropTypes.Entity },
    levelUpView4: { type: PropTypes.Entity },
  };

  private coreEntities: Entity[] = [];
  private fixedSpawnEntities: Entity[] = [];
  private spawnEntities: Entity[] = [];
  private slimeSpawnController: SlimeSpawnController | null = null;
  private playerSlots: Map<number, number> = new Map(); // PlayerID -> Slot Index (0~3)
  
  Awake() {    
    this.connectCodeBlockEvent(this.props.startingZoneTrigger!, CodeBlockEvents.OnPlayerEnterTrigger, this.onPlayerEnterStartingZone.bind(this));
  }

  Start() {
    this.slimeSpawnController = BehaviourFinder.GetBehaviour<SlimeSpawnController>(this.props.slimeSpawnController) ?? null;
    this.playerSlots.clear();
  }
  
  public load(players: Player[]) {
    for (const player of players) {
      console.log(`[SublevelController] Player ${player.name.get()} is loading...`);
    }


    const sublevel = this.props.sublevel!.as(SublevelEntity);
    if (!sublevel) {
      console.warn(`[SublevelController] No valid SublevelEntity assigned!`);
      return;
    }
    
    players.forEach((player) => { this.sendNetworkEvent(player, LoadingPageViewEvent, { enabled: true }); });

    this.props.startingZoneTrigger!.as(TriggerGizmo).enabled.set(false);

    sublevel.activate()
      .then(async () => {
        const startingPoint = await this.waitForEntity(sublevel, "StartingPoint", 10, 200);
        if (!startingPoint) {
          console.error("[SublevelController] Failed to find StartingPoint.");
          players.forEach((player) => { this.sendNetworkEvent(player, LoadingPageViewEvent, { enabled: false }); });        
          return;
        }        

        // 주요 지점 검색
        const spotsReady = await this.findSpots(sublevel);
        players.forEach((player) => { this.sendNetworkEvent(player, Events.loadingProgressUpdate, { progress: 10 }); });
        await this.slimeSpawnController!.spawnSanctum(this.fixedSpawnEntities, this.spawnEntities, this.coreEntities[0]!, players, 10);        
        // 모든 스폰 완료 후 100% 전송
        players.forEach((player) => { this.sendNetworkEvent(player, Events.loadingProgressUpdate, { progress: 100 }); });        
        this.teleportPlayersToStartingPoint(players, startingPoint.as(SpawnPointGizmo));        
        // Trigger 활성화 (플레이어 도착 감지용)
        this.props.startingZoneTrigger!.as(TriggerGizmo).enabled.set(true);        
      })
      .catch((error) => {        
        players.forEach((player) => { this.sendNetworkEvent(player, LoadingPageViewEvent, { enabled: false }); });        
      });
  }

  private waitForEntity(root: Entity, name: string, attempts: number, interval: number): Promise<Entity | null> {
    return new Promise((resolve) => {
      const check = (remainingAttempts: number) => {
        const found = this.findChildEntity(root, name);
        if (found) {
          resolve(found);
          return;
        }

        if (remainingAttempts > 0) {
          this.async.setTimeout(() => {
            check(remainingAttempts - 1);
          }, interval);
        } else {
          console.error(`[SublevelController] Failed to find entity '${name}' after multiple attempts.`);
          resolve(null);
        }
      };

      check(attempts);
    });
  }

  private findChildEntity(root: Entity, name: string): Entity | null {
    const queue: Entity[] = [root];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.name.get() === name) {
        return current;
      }

      const children = current.children.get();
      for (const child of children) {
        queue.push(child);
      }
    }

    return null;
  }

  private async findSpots(sublevel: SublevelEntity): Promise<boolean> {
    const levelEntity = await this.waitForEntity(sublevel, "[Level]", 10, 200);
    if (!levelEntity) {
      console.warn("[SublevelController] '[Level]' entity could not be located after teleport.");
      return false;
    }

    const targetNames = ["[Core]", "[FixedSpawn]", "[Spawn]"];
    const grouped = this.collectChildEntitiesByName(levelEntity, targetNames);
    targetNames.forEach((name) => {
      const entities = grouped[name] ?? [];
      const sharedArray = this.getSharedArrayByName(name);
      if (!sharedArray) {
        console.warn(`[SublevelController] No shared array registered for ${name}.`);
        return;
      }
      sharedArray.length = 0;
      sharedArray.push(...entities);
      //sharedArray.forEach((entity, index) => { console.log(`[SublevelController]   - (${index}) ${entity.name.get()}`); });
    });

    return true;
  }

  private collectChildEntitiesByName(root: Entity, targetNames: string[]): Record<string, Entity[]> {
    const grouped: Record<string, Entity[]> = {};
    const targets = new Set(targetNames);
    const queue: Entity[] = [...root.children.get()];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentName = current.name.get();
      const baseName = this.getMatchingBaseName(currentName, targets);
      if (baseName) {
        if (!grouped[baseName]) {
          grouped[baseName] = [];
        }
        grouped[baseName].push(current);
      }

      const children = current.children.get();
      for (const child of children) {
        queue.push(child);
      }
    }

    return grouped;
  }

  private getMatchingBaseName(actualName: string, targets: Set<string>): string | null {
    if (targets.has(actualName)) {
      return actualName;
    }

    const match = actualName.match(/^(\[[^\]]+\])(?:\s*\((\d+)\)|\s+(\d+))$/);
    if (!match) {
      return null;
    }

    const baseName = match[1];
    return targets.has(baseName) ? baseName : null;
  }

  private getSharedArrayByName(name: string): Entity[] | null {
    switch (name) {
      case "[Core]":
        return this.coreEntities;
      case "[FixedSpawn]":
        return this.fixedSpawnEntities;
      case "[Spawn]":
        return this.spawnEntities;
      default:
        return null;
    }
  }

  private teleportPlayersToStartingPoint(players: Player[], startingPoint?: SpawnPointGizmo | null) {
    if (!startingPoint) {
      console.error("[SublevelController] StartingPoint is not a SpawnPointGizmo!");
      return;
    }

    players.forEach((player) => {
      startingPoint.teleportPlayer(player);
      // PlayerManager.instance.setPlayerMode(player, PlayerMode.Match); // onPlayerEnterStartingZone에서 처리하도록 주석 처리
    });
  }

  private onPlayerEnterStartingZone(player: Player) {            

    // 팀 할당 및 매치 시작
    const teamStr = this.props.assignedTeam;
    let team = TeamType.None;
    if (teamStr === 'East') team = TeamType.East;
    else if (teamStr === 'West') team = TeamType.West;
    
    console.log(`[SublevelController] Player ${player.name.get()} entered starting zone. Team: ${team}`);
    PlayerManager.instance.setPlayerTeam(player, team);
    PlayerManager.instance.setPlayerMode(player, PlayerMode.Match);

    this.sendNetworkEvent(player, LoadingPageViewEvent, { enabled: false });
    
    // 예시: 초기화된 스탯 정보 확인 및 후속 로직 실행
    const stats = MatchStateManager.instance.getStats(player);
    if (stats) {
      console.log(`[SublevelController] Match initialized for ${player.name.get()}. HP: ${stats.hpCurrent}/${stats.hpMax}`);
      this.sendNetworkEvent(player, Events.playerAudioRequest, { player: player, soundId: 'Match' });
      
      this.sendNetworkEvent(player, Events.matchPageView, { enabled: true });

      // UI 슬롯 할당 및 초기화 (최대 4인)
      let slotIndex = this.playerSlots.get(player.id);
      if (slotIndex === undefined) {
          // 빈 슬롯 찾기 (0~3)
          const usedSlots = Array.from(this.playerSlots.values());
          for (let i = 0; i < 4; i++) {
              if (!usedSlots.includes(i)) {
                  slotIndex = i;
                  this.playerSlots.set(player.id, slotIndex);
                  break;
              }
          }
      }

      if (slotIndex !== undefined) {
          let uiEntity: Entity | undefined;
          switch (slotIndex) {
              case 0: uiEntity = this.props.levelUpView1; break;
              case 1: uiEntity = this.props.levelUpView2; break;
              case 2: uiEntity = this.props.levelUpView3; break;
              case 3: uiEntity = this.props.levelUpView4; break;
          }

          if (uiEntity) {
              console.log(`[SublevelController] Assigned LevelUpView_${slotIndex + 1} to player ${player.name.get()} (ID: ${player.id})`);
              // 해당 UI 엔티티에게 소유자 정보 전송
              this.sendNetworkEvent(uiEntity, Events.setOwner, { 
                  playerId: player.id, 
                  playerName: player.name.get() 
              });
          } else {
              console.warn(`[SublevelController] LevelUpView entity for slot ${slotIndex} is not assigned.`);
          }
      } else {
          console.warn(`[SublevelController] No available UI slots for player ${player.name.get()}`);
      }
    }

    
    /*
    const cutsceneEntity = this.props.sanctumCutscene;
    if (!cutsceneEntity) {
      console.warn('SublevelController: sanctumCutscene prop missing');
      return;
    }

    //this.sendLocalEvent(cutsceneEntity, CutsceneEvents.OnStartCutscene, {player});*/
  }
}
Component.register(SublevelController);