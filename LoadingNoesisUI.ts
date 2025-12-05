// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 04, 2025

import { Component } from 'horizon/core';
import { NoesisGizmo } from 'horizon/noesis';
import { LoadingStartEvent, LoadingProgressUpdateEvent, LoadingCompleteEvent } from 'LoadingEvents';

/**
 * This is an example of a NoesisUI component that can be used in a world.
 * It's default execution mode is "Shared" which means it will be executed on the server and all of the clients.
 */
class LoadingNoesisUI extends Component<typeof LoadingNoesisUI> {
  private loadingProgress: number = 0;  

  start() {
    this.initializeLoading();
    this.setVisibility(false);
    this.registerNetworkEvents();
  }

  private registerNetworkEvents() {
    const localPlayer = this.world.getLocalPlayer();

    this.connectNetworkEvent(localPlayer, LoadingStartEvent, () => {
      this.initializeLoading();
      this.setVisibility(true);
    });

    this.connectNetworkEvent(localPlayer, LoadingProgressUpdateEvent, data => {
      this.setVisibility(true);
      this.updateLoadingProgress(data.progress);
    });

    this.connectNetworkEvent(localPlayer, LoadingCompleteEvent, () => {
      this.setVisibility(false);
    });
  }

  private setVisibility(visible: boolean) {
    this.entity.visible.set(visible);
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
