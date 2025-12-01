// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 01, 2025

import * as hz from 'horizon/core';
import { WeaponBase } from 'WeaponBase';

class MeleeWeapon extends WeaponBase {
  protected override getWeaponLogPrefix(): string {
    return '[MeleeWeapon]';
  }
}
hz.Component.register(MeleeWeapon);