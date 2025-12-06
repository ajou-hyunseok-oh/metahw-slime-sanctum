// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 06, 2025

import * as hz from 'horizon/core';
import { WeaponBase } from 'WeaponBase';
import { weaponAttackRequestEvent } from 'WeaponEvents';
import { WeaponType, WEAPON_BASE_STATS, getWeaponStats } from 'GameBalanceData';
import { MatchStateManager } from 'MatchStateManager';
import { AudioGizmo, ParticleGizmo } from 'horizon/core';

export class Weapon extends WeaponBase {
  static override propsDefinition = {
    ...WeaponBase.propsDefinition,
    weaponType: { type: hz.PropTypes.String, default: 'Melee' },
    fireSFX: { type: hz.PropTypes.Entity },
    muzzleFlash: { type: hz.PropTypes.Entity },
  };

  private get weaponType(): WeaponType {
    return ((this.props as any).weaponType as WeaponType) || WeaponType.Melee;
  }

  protected override getWeaponLogPrefix(): string {
    return `[Weapon:${this.weaponType}]`;
  }

  protected override getAttackCooldownMs(): number {
    if (!this.localPlayer) {
      return super.getAttackCooldownMs();
    }

    const matchManager = MatchStateManager.instance;
    if (!matchManager) {
      return super.getAttackCooldownMs();
    }

    const stats = matchManager.getStats(this.localPlayer);
    if (!stats) {
      return super.getAttackCooldownMs();
    }

    let level = 1;
    switch (this.weaponType) {
      case WeaponType.Melee: level = stats.meleeAttackLevel ?? 1; break;
      case WeaponType.Ranged: level = stats.rangedAttackLevel ?? 1; break;
      case WeaponType.Magic: level = stats.magicAttackLevel ?? 1; break;
    }

    const weaponStats = getWeaponStats(this.weaponType, level);
    return weaponStats.cooldown * 1000;
  }

  protected override onAttackTriggered(player: hz.Player) {
    super.onAttackTriggered(player);

    this.playEffects();

    const baseStats = WEAPON_BASE_STATS[this.weaponType];
    
    console.log(`[Weapon] Sending attack request for ${this.weaponType}. Range: ${baseStats.attackRange}`);

    this.sendNetworkBroadcastEvent(weaponAttackRequestEvent, {
      playerId: player.id,
      weaponEntityId: this.getEntityIdString(),
      weaponType: this.weaponType,
      params: {
        range: baseStats.attackRange,
        arc: baseStats.attackArcDegrees,
        verticalTolerance: baseStats.verticalTolerance,
        maxTargets: baseStats.maxTargetsPerShot,
        effectRadius: baseStats.splashRadius,
      },
    });
  }

  private playEffects() {
    const fireSFX = (this.props as any).fireSFX as hz.Entity;
    if (fireSFX) {
      fireSFX.as(AudioGizmo)?.play();
    }

    const muzzleFlash = (this.props as any).muzzleFlash as hz.Entity;
    if (muzzleFlash) {
      muzzleFlash.as(ParticleGizmo)?.play();
    }
  }

  private cachedEntityId?: string;
  private getEntityIdString(): string {
    if (!this.cachedEntityId) {
      this.cachedEntityId = this.entity.id.toString();
    }
    return this.cachedEntityId;
  }
}
hz.Component.register(Weapon);