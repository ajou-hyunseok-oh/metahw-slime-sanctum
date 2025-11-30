// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on November 28, 2025

import { Behaviour, BehaviourFinder } from 'Behaviour';
import { CodeBlockEvents, Component, Entity, Player, PropTypes, Vec3, Quaternion, SpawnPointGizmo, TextGizmo } from 'horizon/core';
import { SublevelEntity } from 'horizon/world_streaming';
import { LevelController } from 'LevelController';  

class PartyMaker extends Behaviour<typeof PartyMaker> {
  static propsDefinition = {
    teamId: { type: PropTypes.Number },
    countdownDuration: { type: PropTypes.Number, default: 10 },
    countdownTextGizmo: { type: PropTypes.Entity },
    subLevelEntity: { type: PropTypes.Entity },
    levelControllerEntity: { type: PropTypes.Entity },
  };

  public static coreEntities: Entity[] = [];
  public static fixedSpawnEntities: Entity[] = [];
  public static spawnEntities: Entity[] = [];

  private playersInTeam: Player[] = [];
  private isCountdownRunning: boolean = false;
  private currentCountdownValue: number = 0;
  private countdownTimer: any = null;
  public isPlaying: boolean = false;

  Awake() {
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerEnterTrigger, this.onPlayerEnterTrigger.bind(this));
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerExitTrigger, this.onPlayerExitTrigger.bind(this));
  }

  Start() {
    this.isCountdownRunning = false;
    this.currentCountdownValue = 0;
    this.props.countdownTextGizmo!.as(TextGizmo).text.set("");
    this.isPlaying = false;
  }

  onPlayerEnterTrigger(player: Player) {
    //console.log(`Player ${player.name.get()} entered team${this.props.teamId}.`);

    if (!this.playersInTeam.some(p => p.id === player.id)) {
      this.playersInTeam.push(player);
    }

    if (!this.isCountdownRunning && this.playersInTeam.length > 0) {
      this.startCountdown();
    }
  }

  onPlayerExitTrigger(player: Player) {
    //console.log(`Player ${player.name.get()} exited team${this.props.teamId}.`);

    const index = this.playersInTeam.findIndex(p => p.id === player.id);
    if (index !== -1) {
      this.playersInTeam.splice(index, 1);
    }

    if (this.playersInTeam.length === 0) {
      this.stopCountdown();
    }
  }

  startCountdown() {
    if (this.isCountdownRunning) return;

    this.isCountdownRunning = true;
    this.currentCountdownValue = this.props.countdownDuration;

    this.updateCountdownDisplay();

    this.countdownTimer = this.async.setInterval(() => {
      this.currentCountdownValue--;
      if (this.currentCountdownValue <= 0) {
        this.finishCountdown();
      } else {
        this.updateCountdownDisplay();
      }
    }, 1000);
  }

  stopCountdown() {
    if (!this.isCountdownRunning) return;

    this.isCountdownRunning = false;
    this.currentCountdownValue = 0;
    this.props.countdownTextGizmo!.as(TextGizmo).text.set("");

    if (this.countdownTimer) {
      this.async.clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  updateCountdownDisplay() {
    this.props.countdownTextGizmo!.as(TextGizmo).text.set(`${this.currentCountdownValue}`);
  }

  finishCountdown() {
    this.isCountdownRunning = false;
    if (this.countdownTimer) {
      this.async.clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    this.props.countdownTextGizmo!.as(TextGizmo).text.set("0");
    this.activateSubLevel();
  }

  activateSubLevel() {
    const sublevel = this.props.subLevelEntity?.as(SublevelEntity);

    if (!sublevel) {
      console.warn(`[PartyMaker] No valid SublevelEntity assigned!`);
      return;
    }

    //console.log(`[PartyMaker] Activating sublevel: ${sublevel.name.get()}`);

    sublevel.activate().then(() => {
      console.log(`[PartyMaker] Sublevel activated. Waiting for StartingPoint...`);
      this.waitForEntity(sublevel, "StartingPoint", 10, 200).then((startingPoint) => {
        if (startingPoint) {
          this.teleportPlayersToSublevel(sublevel, startingPoint);
        } else {
          console.error("[PartyMaker] Failed to find StartingPoint.");
        }
      });
    }).catch((error) => {
      console.error(`[PartyMaker] Failed to activate sublevel: ${error}`);
    });
  }

  teleportPlayersToSublevel(sublevel: SublevelEntity, startingPoint: Entity) {
    const spawnGizmo = startingPoint.as(SpawnPointGizmo);
    if (!spawnGizmo) {
      console.error("[PartyMaker] StartingPoint is not a SpawnPointGizmo!");
      return;
    }

    this.playersInTeam.forEach((player) => {
      spawnGizmo.teleportPlayer(player);
    });

    console.log(`[PartyMaker] Teleported ${this.playersInTeam.length} players to StartingPoint.`);
    this.isPlaying = true;

    this.waitForEntity(sublevel, "[Level]", 10, 200).then((levelEntity) => {
      if (levelEntity) {
        console.log("[PartyMaker] '[Level]' entity located successfully after teleport.");
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
          console.log(`[PartyMaker] ${name} count under [Level]: ${sharedArray.length}`);
          sharedArray.forEach((entity, index) => {
            console.log(`[PartyMaker]   - (${index}) ${entity.name.get()}`);
          });
        });
        this.configureLevelController();
      } else {
        console.warn("[PartyMaker] '[Level]' entity could not be located after teleport.");
      }
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
        return PartyMaker.coreEntities;
      case "[FixedSpawn]":
        return PartyMaker.fixedSpawnEntities;
      case "[Spawn]":
        return PartyMaker.spawnEntities;
      default:
        return null;
    }
  }

  private configureLevelController() {
    const controllerEntity = this.props.levelControllerEntity;
    if (!controllerEntity) {
      console.warn("[PartyMaker] No LevelController entity assigned.");
      return;
    }

    const controller = BehaviourFinder.GetBehaviour<LevelController>(controllerEntity);
    if (!controller) {
      console.error("[PartyMaker] Assigned LevelController entity is missing LevelController behaviour.");
      return;
    }

    controller.Setup({
      coreEntities: PartyMaker.coreEntities,
      fixedSpawnEntities: PartyMaker.fixedSpawnEntities,
      spawnEntities: PartyMaker.spawnEntities,
    });
  }
}
Component.register(PartyMaker);