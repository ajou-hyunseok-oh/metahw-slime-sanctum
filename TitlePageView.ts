// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 07, 2025

import { CodeBlockEvents, Component, NetworkEvent, Player } from 'horizon/core';
import { NoesisGizmo } from 'horizon/noesis';
import { PlayerStartEvent } from 'PlayerManager';

const TitlePageViewEvent = new NetworkEvent<{enabled: boolean}>("TitlePageViewEvent");

/**
 * This is an example of a NoesisUI component that can be used in a world.
 * It's default execution mode is "Shared" which means it will be executed on the server and all of the clients.
 */
class TitlePageView extends Component<typeof TitlePageView> {
  start() {
    if (this.world.getLocalPlayer().id === this.world.getServerPlayer().id) {
      this.startServer();
    } else {
      this.startClient();
    }
  }

  private startServer() {
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerEnterWorld, (player: Player) => {      
      this.sendNetworkEvent(player, TitlePageViewEvent, {enabled: true});
    });
  }

  private startClient() {
    const dataContext = {};
    this.entity.as(NoesisGizmo).dataContext = dataContext;

    this.connectNetworkEvent(this.world.getLocalPlayer(), TitlePageViewEvent, data => {
      console.log(`[TitlePageView] TitlePageViewEvent received for ${this.world.getLocalPlayer().name.get()}: ${data.enabled}`);

      if (data.enabled) {
        this.async.setTimeout(() => {
          console.log(`[TitlePageView] PlayerStartEvent Send}`);
          this.sendNetworkBroadcastEvent(PlayerStartEvent, {player: this.world.getLocalPlayer()});
          this.setVisibility(false);
        }, 3000);    
      }
      else {
        this.setVisibility(false);
      }
    });
  }

  private setVisibility(enabled: boolean) {
    this.entity.visible.set(enabled);
  }  

}

Component.register(TitlePageView);
