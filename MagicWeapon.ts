import * as hz from 'horizon/core';
import { magicAttackRequestEvent } from 'MagicWeaponEvents';
import { WeaponBase } from 'WeaponBase';

type MagicWeaponProps = WeaponBase['props'] & {
  attackRange?: number;
  verticalTolerance?: number;
  attackArcDegrees?: number;
  maxTargetsPerShot?: number;
  effectRadius?: number;
  launcher?: hz.Entity;
  projectileSpeed?: number;
};

class MagicWeapon extends WeaponBase {
  static override propsDefinition = {
    ...WeaponBase.propsDefinition,
    attackRange: { type: hz.PropTypes.Number, default: 12 },
    attackArcDegrees: { type: hz.PropTypes.Number, default: 90 },
    verticalTolerance: { type: hz.PropTypes.Number, default: 1.5 },
    maxTargetsPerShot: { type: hz.PropTypes.Number, default: 5 },
    effectRadius: { type: hz.PropTypes.Number, default: 4 },
    launcher: { type: hz.PropTypes.Entity },
    projectileSpeed: { type: hz.PropTypes.Number, default: 50 },
  };

  private get magicProps(): MagicWeaponProps {
    return this.props as MagicWeaponProps;
  }

  protected override getWeaponLogPrefix(): string {
    return '[MagicWeapon]';
  }

  protected override onAttackTriggered(player: hz.Player) {
    super.onAttackTriggered(player);
    this.launchProjectileLocally();
    this.sendNetworkBroadcastEvent(magicAttackRequestEvent, {
      playerId: player.id,
      weaponEntityId: this.getEntityIdString(),
      params: {
        range: this.getAttackRange(),
        arc: this.getAttackArcDegrees(),
        verticalTolerance: this.getVerticalTolerance(),
        maxTargets: this.getMaxTargetsPerShot(),
        effectRadius: this.getEffectRadius(),
      },
    });
  }

  private getAttackRange(): number {
    const configured = this.magicProps.attackRange ?? MagicWeapon.propsDefinition.attackRange.default;
    return Math.max(0, configured);
  }

  private getAttackArcDegrees(): number {
    const configuredDegrees = this.magicProps.attackArcDegrees ?? MagicWeapon.propsDefinition.attackArcDegrees.default;
    return Math.min(Math.max(configuredDegrees, 1), 180);
  }

  private getVerticalTolerance(): number {
    const configured = this.magicProps.verticalTolerance ?? MagicWeapon.propsDefinition.verticalTolerance.default;
    return Math.max(0, configured);
  }

  private getMaxTargetsPerShot(): number {
    const configured = this.magicProps.maxTargetsPerShot ?? MagicWeapon.propsDefinition.maxTargetsPerShot.default;
    return Math.max(1, Math.floor(configured));
  }

  private getEffectRadius(): number {
    const configured = this.magicProps.effectRadius ?? MagicWeapon.propsDefinition.effectRadius.default;
    return Math.max(0.5, configured);
  }

  private getProjectileSpeed(): number {
    const configured = this.magicProps.projectileSpeed ?? MagicWeapon.propsDefinition.projectileSpeed.default;
    return Math.max(1, configured);
  }

  private cachedLauncher: hz.ProjectileLauncherGizmo | null = null;
  private launcherResolved = false;
  private getLauncherGizmo(): hz.ProjectileLauncherGizmo | null {
    if (!this.launcherResolved) {
      const launcherEntity = this.magicProps.launcher;
      this.cachedLauncher = launcherEntity?.as(hz.ProjectileLauncherGizmo) ?? null;
      this.launcherResolved = true;
      if (!this.cachedLauncher) {
        console.warn(`${this.getWeaponLogPrefix()} Projectile launcher gizmo is not assigned.`);
      }
    }
    return this.cachedLauncher;
  }

  private launchProjectileLocally() {
    const launcher = this.getLauncherGizmo();
    if (!launcher) {
      return;
    }

    try {
      launcher.launch({ speed: this.getProjectileSpeed() });
    } catch (error) {
      console.warn(`${this.getWeaponLogPrefix()} Failed to launch projectile:`, error);
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
hz.Component.register(MagicWeapon);