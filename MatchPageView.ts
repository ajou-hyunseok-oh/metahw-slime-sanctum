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
    if (!this.shouldRunLocally()) {
      console.log('[MatchPageView] Server context detected; skipping client UI logic.');
      return;
    }

    const localPlayer = this.world.getLocalPlayer();
    if (!localPlayer) {
      console.warn('[MatchPageView] No local player available.');
      return;
    }    

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
      MinHP: stats.hpMax,
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
      HpCurrent: 0,
      HpMax: 0,
      Defense: 0,
      MeleeLevel: 0,
      RangedLevel: 0,
      MagicLevel: 0,
      SlimeKills: 0,
      WavesSurvived: 0,
    };
  }

  private shouldRunLocally(): boolean {
    try {
      const localPlayer = this.world.getLocalPlayer();
      const serverPlayer = this.world.getServerPlayer();
      return !!localPlayer && !!serverPlayer && localPlayer.id !== serverPlayer.id;
    } catch {
      return false;
    }
  }
}

Component.register(MatchPageView);
