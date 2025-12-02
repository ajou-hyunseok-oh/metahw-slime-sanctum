// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 02, 2025

import { CodeBlockEvents, Component, Player } from 'horizon/core';

/**
 * This is an example of a NoesisUI component that can be used in a world.
 * It's default execution mode is "Shared" which means it will be executed on the server and all of the clients.
 */
class TitlePageView extends Component<typeof TitlePageView> {
  private hasDismissedLocalUi = false;
  private minDisplayComplete = false;
  private playerReady = false;
  private playerReadyPollId: number | null = null;

  start() {
    this.registerEntryLogging();
    this.initializeDisplayFlow();
  }

  private registerEntryLogging() {
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerEnterWorld, (player: Player) => {
      try {
        console.log('[TitlePageView] Player entered world:', player.name.get());
      } catch {
        console.log('[TitlePageView] Player entered world:', player.id);
      }
    });
  }

  private initializeDisplayFlow() {
    this.async.setTimeout(() => {
      this.minDisplayComplete = true;
      this.tryDismiss();
    }, 3000);

    this.startPollingForPlayerReady();
  }

  private startPollingForPlayerReady() {
    if (this.playerReadyPollId !== null) {
      return;
    }

    this.playerReadyPollId = this.async.setInterval(() => {
      if (this.checkPlayerLoaded()) {
        this.playerReady = true;
        this.stopPlayerReadyPoll();
        this.tryDismiss();
      }
    }, 250);
  }

  private stopPlayerReadyPoll() {
    if (this.playerReadyPollId === null) {
      return;
    }

    this.async.clearInterval(this.playerReadyPollId);
    this.playerReadyPollId = null;
  }

  private checkPlayerLoaded(): boolean {
    try {
      const localPlayer = this.world.getLocalPlayer();
      if (!localPlayer) {
        return false;
      }
      return localPlayer.isValidReference.get();
    } catch {
      return false;
    }
  }

  private tryDismiss() {
    if (this.hasDismissedLocalUi) {
      return;
    }

    if (!this.minDisplayComplete || !this.playerReady) {
      return;
    }

    this.dismissLocalUi();
  }

  private dismissLocalUi() {
    if (this.hasDismissedLocalUi) {
      return;
    }

    this.hasDismissedLocalUi = true;
    this.stopPlayerReadyPoll();
    this.entity.visible.set(false);
    this.entity.collidable.set(false);
    this.entity.simulated.set(false);
  }
}

Component.register(TitlePageView);
