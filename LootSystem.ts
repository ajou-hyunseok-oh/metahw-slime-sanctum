// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on November 28, 2025

import { Behaviour, BehaviourFinder } from 'Behaviour';
import { Component, Entity, PropTypes, Quaternion, Vec3 } from 'horizon/core';
import { ILootTable } from 'ILootTable';

export class LootSystem extends Behaviour<typeof LootSystem> {
  static propsDefinition = {
    lootMinimumHeight: {type: PropTypes.Number, default: 0.5},
  };

  static instance : LootSystem | undefined;

  Awake() {
    LootSystem.instance = this;
  }

  public dropLoot(lootTable : Entity, position : Vec3, rotation : Quaternion, force : boolean = false) {
    var lootDropTable = BehaviourFinder.GetBehaviour<ILootTable>(lootTable);

    if (position.y < this.props.lootMinimumHeight) {
      position.y = this.props.lootMinimumHeight;
    }

    if (force || (lootDropTable?.shouldDropItem() ?? false)) {
      lootDropTable?.dropRandomItem(position, rotation);
    }
  }
}
Component.register(LootSystem);
