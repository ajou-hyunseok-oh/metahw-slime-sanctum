import * as hz from 'horizon/core';
import { WeaponBase } from 'WeaponBase';
import { rangedAttackRequestEvent } from 'RangedWeaponEvents';

type RangedWeaponProps = WeaponBase['props'] & {
  attackRange?: number;
  verticalTolerance?: number;
  attackArcDegrees?: number;
  maxTargetsPerShot?: number;
};

class RangedWeapon extends WeaponBase {
  static override propsDefinition = {
    ...WeaponBase.propsDefinition,
    attackRange: { type: hz.PropTypes.Number, default: 10 },
    attackArcDegrees: { type: hz.PropTypes.Number, default: 90 },
    verticalTolerance: { type: hz.PropTypes.Number, default: 1.5 },
    maxTargetsPerShot: { type: hz.PropTypes.Number, default: 5 },
  };

  private get rangedProps(): RangedWeaponProps {
    return this.props as RangedWeaponProps;
  }

  protected override getWeaponLogPrefix(): string {
    return '[RangedWeapon]';
  }

  protected override onAttackTriggered(player: hz.Player) {
    super.onAttackTriggered(player);
    this.sendNetworkBroadcastEvent(rangedAttackRequestEvent, {
      playerId: player.id,
      weaponEntityId: this.getEntityIdString(),
      params: {
        range: this.getAttackRange(),
        arc: this.getAttackArcDegrees(),
        verticalTolerance: this.getVerticalTolerance(),
        maxTargets: this.getMaxTargetsPerShot(),
      },
    });
  }

  private getAttackRange(): number {
    const configured = this.rangedProps.attackRange ?? RangedWeapon.propsDefinition.attackRange.default;
    return Math.max(0, configured);
  }

  private getAttackArcDegrees(): number {
    const configuredDegrees = this.rangedProps.attackArcDegrees ?? RangedWeapon.propsDefinition.attackArcDegrees.default;
    return Math.min(Math.max(configuredDegrees, 1), 180);
  }

  private getVerticalTolerance(): number {
    const configured = this.rangedProps.verticalTolerance ?? RangedWeapon.propsDefinition.verticalTolerance.default;
    return Math.max(0, configured);
  }

  private getMaxTargetsPerShot(): number {
    const configured = this.rangedProps.maxTargetsPerShot ?? RangedWeapon.propsDefinition.maxTargetsPerShot.default;
    return Math.max(1, Math.floor(configured));
  }

  private cachedEntityId?: string;
  private getEntityIdString(): string {
    if (!this.cachedEntityId) {
      this.cachedEntityId = this.entity.id.toString();
    }
    return this.cachedEntityId;
  }
}
hz.Component.register(RangedWeapon);