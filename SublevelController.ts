// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 06, 2025 

import { Behaviour, BehaviourFinder } from 'Behaviour';
import { Component, CodeBlockEvents, Entity, PropTypes, Player, SpawnPointGizmo, TriggerGizmo } from 'horizon/core';
import { SublevelEntity } from 'horizon/world_streaming';
import { PlayerManager, PlayerMode } from 'PlayerManager';
import { LoadingStartEvent, LoadingProgressUpdateEvent, LoadingCompleteEvent } from 'LoadingEvents';
import { CutsceneEvents } from 'SanctumCutscene';
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
  };

  private coreEntities: Entity[] = [];
  private fixedSpawnEntities: Entity[] = [];
  private spawnEntities: Entity[] = [];
  private slimeSpawnController: SlimeSpawnController | null = null;
  
  Awake() {    
    this.connectCodeBlockEvent(this.props.startingZoneTrigger!, CodeBlockEvents.OnPlayerEnterTrigger, this.onPlayerEnterStartingZone.bind(this));
  }

  Start() {
    this.slimeSpawnController = BehaviourFinder.GetBehaviour<SlimeSpawnController>(this.props.slimeSpawnController) ?? null;
  }
  
  public load(players: Player[]) {
    const sublevel = this.props.sublevel!.as(SublevelEntity);
    if (!sublevel) {
      console.warn(`[SublevelController] No valid SublevelEntity assigned!`);
      return;
    }

    // LoadingStartEvent 이벤트 발생
    players.forEach((player) => {
      this.sendNetworkEvent(player, LoadingStartEvent, {});
    });

    this.props.startingZoneTrigger!.as(TriggerGizmo).enabled.set(false);

    sublevel.activate()
      .then(async () => {
        const startingPoint = await this.waitForEntity(sublevel, "StartingPoint", 10, 200);
        if (!startingPoint) {
          console.error("[SublevelController] Failed to find StartingPoint.");
          this.completeLoading(players, false);
          return;
        }        

        // 주요 지점 검색
        const spotsReady = await this.findSpots(sublevel);
        this.sendLoadingProgress(players, 10);
        await this.slimeSpawnController!.spawnSanctum(this.fixedSpawnEntities, this.spawnEntities, this.coreEntities[0]!, players, 10);        
        // 모든 스폰 완료 후 100% 전송
        this.sendLoadingProgress(players, 100);        
        this.teleportPlayersToStartingPoint(players, startingPoint.as(SpawnPointGizmo));        
        // Trigger 활성화 (플레이어 도착 감지용)
        this.props.startingZoneTrigger!.as(TriggerGizmo).enabled.set(true);        
      })
      .catch((error) => {
        console.error(`[SublevelController] Failed to activate sublevel: ${error}`);
        this.completeLoading(players, false);
        // 모두 로비 스폰지점으로.
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
      sharedArray.forEach((entity, index) => {
        console.log(`[SublevelController]   - (${index}) ${entity.name.get()}`);
      });
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
      PlayerManager.instance.setPlayerMode(player, PlayerMode.Match);
    });
  }

  private sendLoadingProgress(players: Player[], progress: number) {
    players.forEach((player) => {
      this.sendNetworkEvent(player, LoadingProgressUpdateEvent, { progress });
    });
  }

  private completeLoading(players: Player[], success: boolean) {
    this.sendLoadingProgress(players, success ? 100 : 0);
    players.forEach((player) => {
      this.sendNetworkEvent(player, LoadingCompleteEvent, {});
    });
  }

  private onPlayerEnterStartingZone(player: Player) {    
    // 플레이어가 시작 지점에 도착했으므로 로딩 완료 처리 (화면 닫기)
    this.sendNetworkEvent(player, LoadingCompleteEvent, {});

    // 팀 할당 및 매치 시작
    const teamStr = this.props.assignedTeam;
    let team = TeamType.None;
    if (teamStr === 'East') team = TeamType.East;
    else if (teamStr === 'West') team = TeamType.West;
    
    console.log(`[SublevelController] Player ${player.name.get()} entered starting zone. Team: ${team}`);
    PlayerManager.instance.setPlayerTeam(player, team);
    PlayerManager.instance.setPlayerMode(player, PlayerMode.Match);

    // [매치 데이터 초기화 완료 시점]
    // PlayerManager.setPlayerMode(..., Match) 내부에서 MatchStateManager.enterMatch()가 동기적으로 호출됩니다.
    // 따라서 바로 아래 라인부터는 매치 데이터가 초기화된 상태입니다.
    
    // 예시: 초기화된 스탯 정보 확인 및 후속 로직 실행
    const stats = MatchStateManager.instance.getStats(player);
    if (stats) {
      console.log(`[SublevelController] Match initialized for ${player.name.get()}. HP: ${stats.hpCurrent}/${stats.hpMax}`);
      
      // 플레이어의 근접 공격 레벨을 1로 설정 (무기 지급 조건 충족)
      MatchStateManager.instance.setCombatAttributes(player, { meleeAttackLevel: 1 });

      // 1레벨 무기 지급
      if (WeaponSelector.Instance) {
        WeaponSelector.Instance.grabWeapon(WeaponType.Melee, 1, player);
      } else {
        console.warn('[SublevelController] WeaponSelector instance not found.');
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