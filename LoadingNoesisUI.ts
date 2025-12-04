// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 04, 2025

import { Component, NetworkEvent, Player } from 'horizon/core';
import { NoesisGizmo } from 'horizon/noesis';

/**
 * This is an example of a NetworkEvent that can be used to send data from the server to the clients.
 */
const LoadingStartEvent = new NetworkEvent<{}>("LoadingStart");
const LoadingProgressUpdateEvent = new NetworkEvent<{progress: number}>("LoadingProgressUpdate");

/**
 * This is an example of a NoesisUI component that can be used in a world.
 * It's default execution mode is "Shared" which means it will be executed on the server and all of the clients.
 */
class LoadingNoesisUI extends Component<typeof LoadingNoesisUI> {
  private loadingProgress: number = 0;  

  start() {
    if (this.world.getLocalPlayer().id === this.world.getServerPlayer().id) {
      this.startServer();
    } else {
      this.startClient();
    }
  }

  private startServer() {    
    this.connectNetworkEvent(this.world.getServerPlayer(), LoadingStartEvent, data => {
      this.setVisibility(true, this.world.getServerPlayer());      
    });

    this.connectNetworkEvent(this.world.getServerPlayer(), LoadingProgressUpdateEvent, data => {
      this.updateLoadingProgress(data.progress);
    });
  }

  private startClient() {    
    this.initializeLoading();
    this.setVisibility(false, this.world.getLocalPlayer());
  }

  private setVisibility(visible: boolean, player: Player) {
    this.entity.visible.set(visible);

    if (visible) {
      this.initializeLoading();
    }
  }

  private initializeLoading() {
    this.loadingProgress = 0;    
    this.updateLoadingProgress(this.loadingProgress);
  }

  private updateLoadingProgress(progress: number) {
    this.loadingProgress = progress;
    const currentMessage = `Loading... ${this.loadingProgress}%`;

    const dataContext = {
      LoadingProgressValue: this.loadingProgress,
      LoadingProgressText: currentMessage,      
    };

    this.entity.as(NoesisGizmo).dataContext = dataContext;
  }
}

Component.register(LoadingNoesisUI);
