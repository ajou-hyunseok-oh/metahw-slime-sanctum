// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 01, 2025

import * as hz from 'horizon/core';
import { Events } from 'Events';
import { PlayerMode } from 'PlayerManager';

const playerModeChangedEvent = (Events as unknown as {
  playerModeChanged: hz.NetworkEvent<{ mode: string }>;
}).playerModeChanged;

const playerModeRequestEvent = (Events as unknown as {
  playerModeRequest: hz.NetworkEvent<{ playerId: number }>;
}).playerModeRequest;

class MeleeWeapon extends hz.Component<typeof MeleeWeapon> {
  static propsDefinition = {
    attackTargets: { type: hz.PropTypes.EntityArray },
    attackRange: { type: hz.PropTypes.Number, default: 5 },
    attackCooldownMs: { type: hz.PropTypes.Number, default: 500 },
  };

  private localPlayer: hz.Player | undefined;
  private currentMode: PlayerMode | undefined;
  private lastAttackMs = 0;

  start() {
    if (!this.isLocalContext()) {
      return;
    }

    this.localPlayer = this.world.getLocalPlayer();
    if (!this.localPlayer) {
      console.warn('[MeleeWeapon] Local player not found.');
      return;
    }

    this.connectNetworkEvent(this.localPlayer, playerModeChangedEvent, (data: { mode: string }) => {
      this.handlePlayerModeChanged(data.mode);
    });
    this.requestPlayerMode();

    this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnIndexTriggerDown, this.onAttackInput.bind(this));
  }

  private onAttackInput(player: hz.Player) {
    if (!this.isLocalPlayer(player)) {
      return;
    }

    if (!this.isMatchMode(player)) {
      return;
    }

    const now = Date.now();
    if (now - this.lastAttackMs < this.props.attackCooldownMs) {
      return;
    }

    this.lastAttackMs = now;
    this.playAttackAnimation(player);

    const target = this.findAttackTarget(player);
    if (target) {
      this.sendAttackEvent(player, target);
    } else {
      console.log(`[MeleeWeapon] ${player.name.get()} attacked without target.`);
    }
  }

  private isLocalPlayer(player: hz.Player): boolean {
    try {
      const local = this.world.getLocalPlayer();
      return local?.id === player.id;
    } catch {
      return false;
    }
  }

  private isMatchMode(player: hz.Player): boolean {
    return this.currentMode === PlayerMode.Match;
  }

  private findAttackTarget(player: hz.Player): hz.Entity | undefined {
    const targets = this.getConfiguredTargets();
    if (targets.length === 0) {
      return undefined;
    }

    const attackRange = this.props.attackRange;
    const attackRangeSq = attackRange * attackRange;
    const playerPos = player.position.get();

    let closest: { entity: hz.Entity; distanceSq: number } | undefined;
    for (const target of targets) {
      const targetPos = target.position.get();
      const distanceSq = playerPos.distanceSquared(targetPos);
      if (distanceSq > attackRangeSq) {
        continue;
      }

      if (!closest || distanceSq < closest.distanceSq) {
        closest = { entity: target, distanceSq };
      }
    }

    return closest?.entity ?? targets[0];
  }

  private sendAttackEvent(player: hz.Player, target: hz.Entity) {
    const targetPos = target.position.get();
    const playerPos = player.position.get();

    let hitNormal = playerPos.clone().sub(targetPos);
    if (hitNormal.magnitudeSquared() === 0) {
      hitNormal = new hz.Vec3(0, 1, 0);
    } else {
      hitNormal = hitNormal.normalize();
    }

    this.sendNetworkEvent(target, Events.axeHit, {
      hitPos: targetPos.clone(),
      hitNormal,
      fromPlayer: player,
    });
  }

  private getConfiguredTargets(): hz.Entity[] {
    return (this.props.attackTargets ?? []).filter(
      (entity): entity is hz.Entity => entity !== undefined && entity !== null
    );
  }

  private playAttackAnimation(player: hz.Player) {
    try {
      player.playAvatarGripPoseAnimationByName(hz.AvatarGripPoseAnimationNames.Fire);
    } catch (error) {
      console.warn('[MeleeWeapon] Failed to play attack animation:', error);
    }
  }

  private handlePlayerModeChanged(mode: string) {
    if (mode === PlayerMode.Match) {
      this.currentMode = PlayerMode.Match;
    } else if (mode === PlayerMode.Lobby) {
      this.currentMode = PlayerMode.Lobby;
    } else {
      this.currentMode = undefined;
    }
  }

  private requestPlayerMode() {
    if (!this.localPlayer) {
      return;
    }

    this.sendNetworkBroadcastEvent(playerModeRequestEvent, { playerId: this.localPlayer.id });
  }

  private isLocalContext(): boolean {
    try {
      const local = this.world.getLocalPlayer();
      const server = this.world.getServerPlayer();
      return local?.id !== server?.id;
    } catch (error) {
      console.warn('[MeleeWeapon] Failed to verify local context:', error);
      return false;
    }
  }
}
hz.Component.register(MeleeWeapon);