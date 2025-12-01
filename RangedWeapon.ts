import * as hz from 'horizon/core';
import { WeaponBase } from 'WeaponBase';

class RangedWeapon extends WeaponBase {
  protected override getWeaponLogPrefix(): string {
    return '[RangedWeapon]';
  }
}
hz.Component.register(RangedWeapon);