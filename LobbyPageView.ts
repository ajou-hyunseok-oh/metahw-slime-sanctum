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
import { PersistentVariables } from 'PlayerPersistentVariables';

const playerModeChangedEvent = (Events as unknown as {
  playerModeChanged: NetworkEvent<{ mode: string }>;
}).playerModeChanged;

const playerPersistentStatsRequestEvent = (Events as unknown as {
  playerPersistentStatsRequest: NetworkEvent<{ playerId: number }>;
}).playerPersistentStatsRequest;

const playerPersistentStatsUpdateEvent = (Events as unknown as {
  playerPersistentStatsUpdate: NetworkEvent<PersistentVariables>;
}).playerPersistentStatsUpdate;

/**
 * This is an example of a NoesisUI component that can be used in a world.
 * It's default execution mode is "Shared" which means it will be executed on the server and all of the clients.
 */
class LobbyPageView extends Component<typeof LobbyPageView> {  
  start() {
    if (!this.shouldRunLocally()) {
      console.log('[LobbyPageView] Server context detected; skipping client UI logic.');
      return;
    }

    const localPlayer = this.world.getLocalPlayer();
    if (!localPlayer) {
      console.warn('[LobbyPageView] No local player available.');
      return;
    }
    
    this.connectNetworkEvent(localPlayer, playerModeChangedEvent, payload => {
      const isLobby = payload.mode === PlayerMode.Lobby;
      this.setVisibility(isLobby, localPlayer);
    });

    this.connectNetworkEvent(localPlayer, playerPersistentStatsUpdateEvent, stats => {
      this.onStatsUpdated(stats);
    });

    this.setVisibility(true, localPlayer);
  }

  private setVisibility(visible: boolean, player: Player) {
    this.entity.visible.set(visible);
    if (visible) {
      this.requestPersistentStats(player);
    }
  }

  private requestPersistentStats(player: Player) {
    this.sendNetworkBroadcastEvent(playerPersistentStatsRequestEvent, { playerId: player.id });
  }

  private onStatsUpdated(stats: PersistentVariables) {
    console.log('[LobbyPageView] Persistent stats updated', stats);
    // TODO: Bind stats to UI data context when ready.
    console.log('[LobbyPageView] Coins:', stats.coins);
    console.log('[LobbyPageView] Gems:', stats.gems);
    console.log('[LobbyPageView] Best Waves:', stats.bestWaves);
    console.log('[LobbyPageView] Killed Slimes:', stats.killedSlimes);

    const dataContext = {
      BestWaves: stats.bestWaves,
      Coins: stats.coins,
      Gems: stats.gems      
    };

    this.entity.as(NoesisGizmo).dataContext = dataContext;
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

Component.register(LobbyPageView);


