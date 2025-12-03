// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on November 28, 2025

import { Behaviour, BehaviourFinder } from 'Behaviour';
import { EnemyWaveManager } from 'EnemyWaveManager';
import { Events, WaveManagerNetworkEvents } from 'Events';
import { CodeBlockEvents, Component, Player, PropTypes } from 'horizon/core';
import { PlayerManager, PlayerMode } from 'PlayerManager';

class CombatStarter extends Behaviour<typeof CombatStarter> {
  static propsDefinition = {
    waveManager: {type: PropTypes.Entity},    
  };

  Start() {
    this.connectCodeBlockEvent(
      this.entity,
      CodeBlockEvents.OnPlayerEnterTrigger,
      (player: Player) => {
        var managerName = (BehaviourFinder.GetBehaviour(this.props.waveManager!) as EnemyWaveManager).name;
        this.sendNetworkEvent(this.props.waveManager!, WaveManagerNetworkEvents.StartWaveGroup, {waveGroupName: managerName});
        PlayerManager.instance.setPlayerMode(player, PlayerMode.Match);
        console.log("[CombatStarter] Player entered combat area");
      }
    );

    this.connectNetworkBroadcastEvent(Events.gameReset, (data) => {      
      console.log("[CombatStarter] Game reset ");
    });
  }
}
Component.register(CombatStarter);