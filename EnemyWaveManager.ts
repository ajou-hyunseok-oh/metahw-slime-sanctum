// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on November 28, 2025

import { Behaviour, BehaviourFinder } from "Behaviour";
import { Component, Entity, NetworkEvent, PropTypes } from "horizon/core";
import { Events } from "Events";
import { INpcAgent, NpcAgent } from "NpcAgent";
import { EnemyWaveConfig } from "EnemyWaveConfig";
import { PlayerManager } from "PlayerManager";
import { WaveManagerNetworkEvents } from "Events";

export class EnemyWaveManager extends Behaviour<typeof EnemyWaveManager> {
  static propsDefinition = {};

  public name : string = "";

  start() {

  }
}
Component.register(EnemyWaveManager);