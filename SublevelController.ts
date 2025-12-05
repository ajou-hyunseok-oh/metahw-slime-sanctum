// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 04, 2025

import { Behaviour } from 'Behaviour';
import { Component, CodeBlockEvents, Entity, PropTypes, Player, SpawnPointGizmo, TriggerGizmo } from 'horizon/core';
import { SublevelEntity } from 'horizon/world_streaming';
import { PlayerManager, PlayerMode } from 'PlayerManager';
import { LoadingStartEvent, LoadingProgressUpdateEvent, LoadingCompleteEvent } from 'LoadingEvents';
import { CutsceneEvents } from 'SanctumCutscene';
export class SublevelController extends Behaviour<typeof SublevelController> {
  static propsDefinition = {
    sublevel: { type: PropTypes.Entity },
    startingZoneTrigger: { type: PropTypes.Entity },
    sanctumCutscene: { type: PropTypes.Entity },
  };

  private coreEntities: Entity[] = [];
  private fixedSpawnEntities: Entity[] = [];
  private spawnEntities: Entity[] = [];

  Awake() {
    this.connectCodeBlockEvent(this.props.startingZoneTrigger!, CodeBlockEvents.OnPlayerEnterTrigger, this.onPlayerEnterStartingZone.bind(this));
  }
  
  public load(players: Player[]) {
    const sublevel = this.props.sublevel!.as(SublevelEntity);
    if (!sublevel) {
      console.warn(`[PartyMaker] No valid SublevelEntity assigned!`);
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
          console.error("[PartyMaker] Failed to find StartingPoint.");
          this.completeLoading(players, false);
          return;
        }

        this.teleportPlayersToStartingPoint(players, startingPoint.as(SpawnPointGizmo));
        this.sendLoadingProgress(players, 50);

        // 주요 지점 검색
        const spotsReady = await this.findSpots(sublevel);

        // 오브젝트 풀 초기화
        // 고정 슬라임 스폰
        // 끝나면 로딩 완료
        
        const loadSuccessful = !!spotsReady;
        this.completeLoading(players, loadSuccessful);

        // 고정 카메라 연출 시작:  이벤트 발생
        // 고정 카메리 연출이 끝나면 시작 지점 트리거 활성화 이벤트 진행
        this.props.startingZoneTrigger!.as(TriggerGizmo).enabled.set(true);
      })
      .catch((error) => {
        console.error(`[PartyMaker] Failed to activate sublevel: ${error}`);
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
          console.error(`[PartyMaker] Failed to find entity '${name}' after multiple attempts.`);
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
      console.warn("[PartyMaker] '[Level]' entity could not be located after teleport.");
      return false;
    }

    const targetNames = ["[Core]", "[FixedSpawn]", "[Spawn]"];
    const grouped = this.collectChildEntitiesByName(levelEntity, targetNames);
    targetNames.forEach((name) => {
      const entities = grouped[name] ?? [];
      const sharedArray = this.getSharedArrayByName(name);
      if (!sharedArray) {
        console.warn(`[PartyMaker] No shared array registered for ${name}.`);
        return;
      }
      sharedArray.length = 0;
      sharedArray.push(...entities);
      sharedArray.forEach((entity, index) => {
        console.log(`[PartyMaker]   - (${index}) ${entity.name.get()}`);
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
      console.error("[PartyMaker] StartingPoint is not a SpawnPointGizmo!");
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
    console.log(`[SublevelController::onPlayerEnterStartingZone] Player ${player.name.get()} entered starting zone.`);
    const cutsceneEntity = this.props.sanctumCutscene;
    if (!cutsceneEntity) {
      console.warn('SanctumCutsceneTrigger: sanctumCutscene prop missing');
      return;
    }

    this.sendLocalEvent(cutsceneEntity, CutsceneEvents.OnStartCutscene, {player});
  }
}
Component.register(SublevelController);