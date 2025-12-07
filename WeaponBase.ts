// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 01, 2025

import * as hz from 'horizon/core';

export abstract class WeaponBase extends hz.Component<typeof WeaponBase> {
  static propsDefinition = {
  };

  protected localPlayer: hz.Player | undefined;
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

    this.registerInputEvents();
  }

  protected getWeaponLogPrefix(): string {
    return '[Weapon]';
  }

  protected getAttackAnimationName(): string {
    return hz.AvatarGripPoseAnimationNames.Fire;
  }

  protected getAttackCooldownMs(): number {
    return 500;
  }

  protected onAttackTriggered(player: hz.Player) {
    // Subclasses override to implement projectile/target logic.
  }

  private registerInputEvents() {
    this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnIndexTriggerDown, (player: hz.Player) => {
      console.log(`[WeaponBase] OnIndexTriggerDown: ${player.name.get()}`);
      if (!this.localPlayer || player.id !== this.localPlayer.id) {
        return;
      }

      this.handleAttackInput(player);
    });
  }

  private handleAttackInput(player: hz.Player) {
    console.log(`[WeaponBase] handleAttackInput ${player.name.get()}`);
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
    return this.localPlayer !== undefined;
  }

  private playAttackAnimation(player: hz.Player) {
    try {
      player.playAvatarGripPoseAnimationByName(this.getAttackAnimationName());
    } catch (error) {
      console.warn(`${this.getWeaponLogPrefix()} Failed to play attack animation:`, error);
    }
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
