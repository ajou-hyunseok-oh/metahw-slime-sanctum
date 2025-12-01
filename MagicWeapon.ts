import * as hz from 'horizon/core';
import { WeaponBase } from 'WeaponBase';

class MagicWeapon extends WeaponBase {
  protected override getWeaponLogPrefix(): string {
    return '[MagicWeapon]';
  }
}
hz.Component.register(MagicWeapon);