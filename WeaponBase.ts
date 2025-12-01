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

export abstract class WeaponBase extends hz.Component<typeof WeaponBase> {
  static propsDefinition = {
    attackCooldownMs: { type: hz.PropTypes.Number, default: 500 },
  };

  protected localPlayer: hz.Player | undefined;
  private currentMode: PlayerMode | undefined;
  private lastAttackMs = 0;

  start() {
    if (!this.isLocalContext()) {
      return;
    }

    this.localPlayer = this.world.getLocalPlayer();
    if (!this.localPlayer) {
      console.warn(`${this.getWeaponLogPrefix()} Local player not found.`);
      return;
    }

    this.connectNetworkEvent(this.localPlayer, playerModeChangedEvent, ({ mode }) => this.handlePlayerModeChanged(mode));
    this.requestPlayerMode();
    this.registerInputEvents();
  }

  protected getWeaponLogPrefix(): string {
    return '[Weapon]';
  }

  protected getAttackAnimationName(): string {
    return hz.AvatarGripPoseAnimationNames.Fire;
  }

  protected getAttackCooldownMs(): number {
    return this.props.attackCooldownMs ?? WeaponBase.propsDefinition.attackCooldownMs.default;
  }

  protected onAttackTriggered(player: hz.Player) {
    // Subclasses override to implement projectile/target logic.
  }

  private registerInputEvents() {
    this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnIndexTriggerDown, (player: hz.Player) => {
      if (!this.localPlayer || player.id !== this.localPlayer.id) {
        return;
      }

      this.handleAttackInput(player);
    });
  }

  private handleAttackInput(player: hz.Player) {
    if (!this.canAttack()) {
      return;
    }

    const now = Date.now();
    if (now - this.lastAttackMs < this.getAttackCooldownMs()) {
      return;
    }

    this.lastAttackMs = now;
    console.log(`${this.getWeaponLogPrefix()} ${player.name.get()} attack input detected.`);
    this.playAttackAnimation(player);
    this.onAttackTriggered(player);
  }

  private canAttack(): boolean {
    return this.localPlayer !== undefined && this.currentMode === PlayerMode.Match;
  }

  private playAttackAnimation(player: hz.Player) {
    try {
      player.playAvatarGripPoseAnimationByName(this.getAttackAnimationName());
    } catch (error) {
      console.warn(`${this.getWeaponLogPrefix()} Failed to play attack animation:`, error);
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
      console.warn(`${this.getWeaponLogPrefix()} Failed to verify local context:`, error);
      return false;
    }
  }
}