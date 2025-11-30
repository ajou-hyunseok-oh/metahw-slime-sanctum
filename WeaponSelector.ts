// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on November 30, 2025

import { Behaviour, BehaviourFinder } from 'Behaviour';
import { Component, Player, PropTypes } from 'horizon/core';

export class WeaponSelector extends Behaviour<typeof WeaponSelector> {
  static propsDefinition = {
    meleeLv1Asset: { type: PropTypes.Asset, default: null },
    meleeLv2Asset: { type: PropTypes.Asset, default: null },
    meleeLv3Asset: { type: PropTypes.Asset, default: null },    
    rangedLv1Asset: { type: PropTypes.Asset, default: null },
    rangedLv2Asset: { type: PropTypes.Asset, default: null },
    rangedLv3Asset: { type: PropTypes.Asset, default: null },    
    magicLv1Asset: { type: PropTypes.Asset, default: null },
    magicLv2Asset: { type: PropTypes.Asset, default: null },
    magicLv3Asset: { type: PropTypes.Asset, default: null },    
  };

  Start() {}
}
Component.register(WeaponSelector);