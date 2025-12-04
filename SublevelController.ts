// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 04, 2025

import { Behaviour } from 'Behaviour';
import { Component, Entity, PropTypes, Player, SpawnPointGizmo } from 'horizon/core';
import { SublevelEntity } from 'horizon/world_streaming';
import { PlayerManager, PlayerMode } from 'PlayerManager';
import { LoadingStartEvent } from 'LoadingEvents';

export class SublevelController extends Behaviour<typeof SublevelController> {
  static propsDefinition = {
    sublevel: { type: PropTypes.Entity },
  };
  
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

    sublevel.activate().then(() => {      
      this.waitForEntity(sublevel, "StartingPoint", 10, 200).then((startingPoint) => {
        if (startingPoint) {          
          players.forEach((player) => {
            const spawnGizmo = startingPoint.as(SpawnPointGizmo);
            if (spawnGizmo) {
              spawnGizmo.teleportPlayer(player);
              PlayerManager.instance.setPlayerMode(player, PlayerMode.Match);
            }
          });

        } else {
          console.error("[PartyMaker] Failed to find StartingPoint.");
        }
      });
    }).catch((error) => {
      console.error(`[PartyMaker] Failed to activate sublevel: ${error}`);
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
}
Component.register(SublevelController);