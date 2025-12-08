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
    fireSFX1: { type: hz.PropTypes.Entity, default: undefined },
    fireSFX2: { type: hz.PropTypes.Entity, default: undefined },
    fireSFX3: { type: hz.PropTypes.Entity, default: undefined },
    fireSFX4: { type: hz.PropTypes.Entity, default: undefined },
    fireVFX: { type: hz.PropTypes.Entity, default: undefined },
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

  private fireSfxCycleIndex = 0;

  private playEffects() {
    const fireSfxEntities = this.getAvailableFireSfx();
    if (fireSfxEntities.length > 0) {
      const sfxToPlay = fireSfxEntities[this.fireSfxCycleIndex % fireSfxEntities.length];
      sfxToPlay.as(AudioGizmo)?.play();
      this.fireSfxCycleIndex = (this.fireSfxCycleIndex + 1) % fireSfxEntities.length;
    }

    const muzzleFlash = (this.props as any).muzzleFlash as hz.Entity;
    if (muzzleFlash) {
      muzzleFlash.as(ParticleGizmo)?.play();
    }

    const fireVFX = (this.props as any).fireVFX as hz.Entity;
    if (fireVFX) {
      fireVFX.as(ParticleGizmo)?.play();
    }
  }

  /**
   * fireSFX1~4 혹은 기존 fireSFX 필드 중 설정된 사운드만 반환
   * 순환 재생을 위해 순서 유지
   */
  private getAvailableFireSfx(): hz.Entity[] {
    const props = this.props as any;
    const sfxList: (hz.Entity | undefined)[] = [
      props.fireSFX1,
      props.fireSFX2,
      props.fireSFX3,
      props.fireSFX4,      
    ];

    return sfxList.filter((sfx): sfx is hz.Entity => !!sfx);
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