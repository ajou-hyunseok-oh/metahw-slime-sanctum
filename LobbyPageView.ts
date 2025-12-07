// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 07, 2025 

import { CodeBlockEvents, Component, NetworkEvent, Player } from 'horizon/core';
import { NoesisGizmo } from 'horizon/noesis';
import { Events } from 'Events';

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
      this.sendNetworkEvent(player, Events.lobbyPageView, {enabled: false});
    });
  }

  private startClient() {
    const dataContext = {
      BestWaves: 0,
      Coins: 0,
      Gems: 0,
    };

    this.entity.as(NoesisGizmo).dataContext = dataContext;
    const localPlayer = this.world.getLocalPlayer();

    this.connectNetworkEvent(localPlayer, Events.lobbyPageView, data => {      
      this.setVisibility(data.enabled);
      if (data.enabled) {
        this.sendNetworkBroadcastEvent(Events.playerPersistentStatsRequest, { playerId: localPlayer.id });
      }
    });

    this.connectNetworkEvent(localPlayer, Events.playerPersistentStatsUpdate, stats => {
      dataContext.BestWaves = stats.bestWaves;
      dataContext.Coins = stats.coins;
      dataContext.Gems = stats.gems;      
    });
  }

  private setVisibility(enabled: boolean) {
    this.entity.visible.set(enabled);
  }
}

Component.register(LobbyPageView);
