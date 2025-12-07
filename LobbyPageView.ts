// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 07, 2025 

import { CodeBlockEvents, Component, NetworkEvent, Player } from 'horizon/core';
import { NoesisGizmo } from 'horizon/noesis';
import { Events } from 'Events';
import { PlayerMode } from 'PlayerManager';
import { PersistentVariables } from 'PlayerPersistentVariables';

export const LobbyPageViewEvent = new NetworkEvent<{enabled: boolean}>("LobbyPageViewEvent");

/*
const playerModeChangedEvent = (Events as unknown as {
  playerModeChanged: NetworkEvent<{ mode: string }>;
}).playerModeChanged;

const playerPersistentStatsRequestEvent = (Events as unknown as {
  playerPersistentStatsRequest: NetworkEvent<{ playerId: number }>;
}).playerPersistentStatsRequest;

const playerPersistentStatsUpdateEvent = (Events as unknown as {
  playerPersistentStatsUpdate: NetworkEvent<PersistentVariables>;
}).playerPersistentStatsUpdate;
*/

class LobbyPageView extends Component<typeof LobbyPageView> {
  start() {
    if (this.world.getLocalPlayer().id === this.world.getServerPlayer().id) {
      this.startServer();
    } else {
      this.startClient();
    }
  }  
  
  private startServer() {
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerEnterWorld, (player: Player) => {
      console.log('NoesisUI: OnPlayerEnterWorld', player.name.get());
      this.sendNetworkEvent(player, LobbyPageViewEvent, {enabled: false});
    });
  }

  private startClient() {
    const dataContext = {
      BestWaves: 0,
      Coins: 0,
      Gems: 0,
    };

    this.entity.as(NoesisGizmo).dataContext = dataContext;

    this.connectNetworkEvent(this.world.getLocalPlayer(), LobbyPageViewEvent, data => {
      console.log(`[LobbyPageView] LobbyPageViewEvent received for ${this.world.getLocalPlayer().name.get()}: ${data.enabled}`);
      this.setVisibility(data.enabled);
    });

    /*
    this.connectNetworkEvent(this.world.getLocalPlayer(), playerModeChangedEvent, payload => {
      const isLobby = payload.mode === PlayerMode.Lobby;
      this.setVisibility(true);
    });

    this.connectNetworkEvent(this.world.getLocalPlayer(), playerPersistentStatsUpdateEvent, stats => {
      if (!this.entity.visible.get()) return;

      dataContext.BestWaves = stats.bestWaves;
      dataContext.Coins = stats.coins;
      dataContext.Gems = stats.gems;
    });
    */
  }

  private setVisibility(enabled: boolean) {
    this.entity.visible.set(enabled);
  }

  /*
    start() {
    
    const localPlayer = this.world.getLocalPlayer();
    const serverPlayer = this.world.getServerPlayer();

    if (localPlayer && serverPlayer && localPlayer.id === serverPlayer.id) {
      console.log('[LobbyPageView] Server context detected; skipping client UI logic.');
      return;
    }
    
    console.log('[LobbyPageView] locally started');
    
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
  */
}

Component.register(LobbyPageView);


