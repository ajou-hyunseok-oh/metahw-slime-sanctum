// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 07, 2025

import { CodeBlockEvents, Component, NetworkEvent, Player } from 'horizon/core';
import { NoesisGizmo } from 'horizon/noesis';
import { LoadingStartEvent, LoadingProgressUpdateEvent, LoadingCompleteEvent } from 'LoadingEvents';

/**
 * This is an example of a NetworkEvent that can be used to send data from the server to the clients.
 */
const LoadingPageViewEvent = new NetworkEvent<{enabled: boolean}>("LoadingPageViewEvent");

/**
 * This is an example of a NoesisUI component that can be used in a world.
 * It's default execution mode is "Shared" which means it will be executed on the server and all of the clients.
 */
class LoadingPageView extends Component<typeof LoadingPageView> {

  start() {
    if (this.world.getLocalPlayer().id === this.world.getServerPlayer().id) {
      this.startServer();
    } else {
      this.startClient();
    }
  }

  private startServer() {
    // Noesis dataContext can't be directly controlled from the server
    // but server can send events to the clients so that they would update their dataContexts accordingly
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerEnterWorld, (player: Player) => {
      console.log('NoesisUI: OnPlayerEnterWorld', player.name.get());
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
      this.setVisibility(data.enabled);
    });

    // [로딩 시작]
    this.connectNetworkEvent(this.world.getLocalPlayer(), LoadingStartEvent, () => {
      this.setVisibility(true);
      dataContext.LoadingProgressValue = 0;
      dataContext.LoadingProgressText = "Loading... 0%";          
    });
    
    
    this.connectNetworkEvent(this.world.getLocalPlayer(), LoadingProgressUpdateEvent, (data) => {          
      dataContext.LoadingProgressValue = data.progress;
      dataContext.LoadingProgressText = `Loading... ${data.progress}%`;
    });
    
    // [로딩 완료]
    this.connectNetworkEvent(this.world.getLocalPlayer(), LoadingCompleteEvent, () => {
      dataContext.LoadingProgressText = `Loading... 100%`;
      this.setVisibility(false);
    });
  }

  private setVisibility(enabled: boolean) {
    this.entity.visible.set(enabled);
  }
}

Component.register(LoadingPageView);
