// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on November 30, 2025

import { Behaviour } from 'Behaviour';
import { Component, CodeBlockEvents, Player } from 'horizon/core';
import { PlayerManager, PlayerMode } from 'PlayerManager';

class StartingZone extends Behaviour<typeof StartingZone> {
  static propsDefinition = {};  

  Awake() {
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerEnterTrigger, this.onPlayerEnterTrigger.bind(this));
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerExitTrigger, this.onPlayerExitTrigger.bind(this));    
  }

  onPlayerEnterTrigger(player: Player) {
    console.log(`Player ${player.name.get()} entered.`);
    PlayerManager.instance.setPlayerMode(player, PlayerMode.Match);    
  }

  onPlayerExitTrigger(player: Player) {
    console.log(`Player ${player.name.get()} exited.`);    
  }
}
Component.register(StartingZone);