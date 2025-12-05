// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 02, 2025

import { Component, NetworkEvent, Player } from 'horizon/core';
import { NoesisGizmo } from 'horizon/noesis';
import { Events } from 'Events';
import { PlayerMode } from 'PlayerManager';
import type { MatchStateUpdatePayload } from 'MatchStateManager';

const playerModeChangedEvent = (Events as unknown as {
  playerModeChanged: NetworkEvent<{ mode: string }>;
}).playerModeChanged;

const matchStateRequestEvent = (Events as unknown as {
  matchStateRequest: NetworkEvent<{ playerId: number }>;
}).matchStateRequest;

const matchStateUpdateEvent = (Events as unknown as {
  matchStateUpdate: NetworkEvent<MatchStateUpdatePayload>;
}).matchStateUpdate;

/**
 * This is an example of a NoesisUI component that can be used in a world.
 * It's default execution mode is "Shared" which means it will be executed on the server and all of the clients.
 */
class MatchPageView extends Component<typeof MatchPageView> {

  start() {
    const localPlayer = this.world.getLocalPlayer();
    const serverPlayer = this.world.getServerPlayer();

    if (localPlayer && serverPlayer && localPlayer.id === serverPlayer.id) {
      console.log('[TitlePageView] Server context detected; skipping client UI logic.');
      return;
    }

    this.startClient();
  }

  private startClient() {
    const localPlayer = this.world.getLocalPlayer();

    this.connectNetworkEvent(localPlayer, playerModeChangedEvent, payload => {
      const isMatch = payload.mode === PlayerMode.Match;
      this.setVisibility(isMatch, localPlayer);
    });

    this.connectNetworkEvent(localPlayer, matchStateUpdateEvent, payload => {
      if (payload.playerId !== localPlayer.id) {
        return;
      }
      this.onMatchStatsUpdated(payload);
    });

    this.setVisibility(false, localPlayer);
  }

  private setVisibility(visible: boolean, player: Player) {
    this.entity.visible.set(visible);

    if (visible) {
      this.requestMatchStats(player);
    }
  }

  private requestMatchStats(player: Player) {
    this.sendNetworkBroadcastEvent(matchStateRequestEvent, { playerId: player.id });
  }

  private onMatchStatsUpdated(stats: MatchStateUpdatePayload) {
    const dataContext = {
      CurrentHP: stats.hpCurrent,      
      MaxHP: stats.hpMax,
      HPText: `${stats.hpCurrent}/${stats.hpMax}`,
      MeleeLevel: stats.meleeAttackLevel,
      RangedLevel: stats.rangedAttackLevel,
      MagicLevel: stats.magicAttackLevel,
      DefenceLevel: stats.defense,
    };

    this.entity.as(NoesisGizmo).dataContext = dataContext;
  }

  private createEmptyDataContext() {
    return {
      CurrentHP: 0,
      MaxHP: 0,
      HPText: `${0}/${0}`,
      DefenceLevel: 0,
      MeleeLevel: 0,
      RangedLevel: 0,
      MagicLevel: 0
    };
  }
}

Component.register(MatchPageView);
