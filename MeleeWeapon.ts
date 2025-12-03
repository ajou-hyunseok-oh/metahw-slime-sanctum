// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 01, 2025

import * as hz from 'horizon/core';
import { WeaponBase } from 'WeaponBase';
import { meleeAttackRequestEvent, MeleeAttackRequestPayload } from 'MeleeWeaponEvents';

type MeleeWeaponProps = WeaponBase['props'] & {
  attackRange?: number;
  attackArcDegrees?: number;
  verticalTolerance?: number;
  maxTargetsPerSwing?: number;
};

class MeleeWeapon extends WeaponBase {
  static override propsDefinition = {
    ...WeaponBase.propsDefinition,
    attackRange: { type: hz.PropTypes.Number, default: 3 },
    attackArcDegrees: { type: hz.PropTypes.Number, default: 90 },
    verticalTolerance: { type: hz.PropTypes.Number, default: 1.5 },
    maxTargetsPerSwing: { type: hz.PropTypes.Number, default: 5 },
  };

  private cachedEntityId?: string;
  private get meleeProps(): MeleeWeaponProps {
    return this.props as MeleeWeaponProps;
  }

  protected override getWeaponLogPrefix(): string {
    return '[MeleeWeapon]';
  }

  protected override onAttackTriggered(player: hz.Player) {
    super.onAttackTriggered(player);
    this.sendNetworkBroadcastEvent(meleeAttackRequestEvent, {
      playerId: player.id,
      weaponEntityId: this.getEntityIdString(),
      params: {
        range: this.getAttackRange(),
        arc: this.getAttackArcDegrees(),
        verticalTolerance: this.getVerticalTolerance(),
        maxTargets: this.getMaxTargetsPerSwing(),
      },
    });
  }

  private getAttackRange(): number {
    const configured = this.meleeProps.attackRange ?? MeleeWeapon.propsDefinition.attackRange.default;
    return Math.max(0, configured);
  }

  private getAttackArcDegrees(): number {
    const configuredDegrees = this.meleeProps.attackArcDegrees ?? MeleeWeapon.propsDefinition.attackArcDegrees.default;
    return Math.min(Math.max(configuredDegrees, 1), 180);
  }

  private getVerticalTolerance(): number {
    const configured = this.meleeProps.verticalTolerance ?? MeleeWeapon.propsDefinition.verticalTolerance.default;
    return Math.max(0, configured);
  }

  private getMaxTargetsPerSwing(): number {
    const configured = this.meleeProps.maxTargetsPerSwing ?? MeleeWeapon.propsDefinition.maxTargetsPerSwing.default;
    return Math.max(1, Math.floor(configured));
  }

  private getEntityIdString(): string {
    if (!this.cachedEntityId) {
      this.cachedEntityId = this.entity.id.toString();
    }
    return this.cachedEntityId;
  }
}
hz.Component.register(MeleeWeapon);