// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 07, 2025

import { CodeBlockEvents, Component, NetworkEvent, Player } from 'horizon/core';
import { NoesisGizmo } from 'horizon/noesis';
import { Events } from 'Events';

export const LoadingPageViewEvent = new NetworkEvent<{enabled: boolean}>("LoadingPageViewEvent");

class LoadingPageView extends Component<typeof LoadingPageView> {

  start() {
    if (this.world.getLocalPlayer().id === this.world.getServerPlayer().id) {
      this.startServer();
    } else {
      this.startClient();
    }
  }

  private startServer() {
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerEnterWorld, (player: Player) => {      
      this.sendNetworkEvent(player, LoadingPageViewEvent, {enabled: false});
    });
  }

  private startClient() {
    const dataContext = {
      LoadingProgressValue: 0,
      LoadingProgressText: "Loading... 0%",      
    };

    this.entity.as(NoesisGizmo).dataContext = dataContext;

    this.connectNetworkEvent(this.world.getLocalPlayer(), LoadingPageViewEvent, data => {

      console.log(`[LoadingPageView] received event: ${this.world.getLocalPlayer().name.get()} / enabled: ${data.enabled}`);


      if (data.enabled) {
        dataContext.LoadingProgressValue = 0;
        dataContext.LoadingProgressText = "Loading... 0%";
      } else {
        dataContext.LoadingProgressValue = 100;
        dataContext.LoadingProgressText = "Loading... 100%";        
      }

      this.setVisibility(data.enabled);
    });
    
    this.connectNetworkEvent(this.world.getLocalPlayer(), Events.loadingProgressUpdate, (data) => {          
      dataContext.LoadingProgressValue = data.progress;
      dataContext.LoadingProgressText = `Loading... ${data.progress}%`;
    });      
  }

  private setVisibility(enabled: boolean) {
    this.entity.visible.set(enabled);
  }
}

Component.register(LoadingPageView);
