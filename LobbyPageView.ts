// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 02, 2025

import { Component, NetworkEvent } from 'horizon/core';
import { Events } from 'Events';
import { PlayerMode } from 'PlayerManager';

const playerModeChangedEvent = (Events as unknown as {
  playerModeChanged: NetworkEvent<{ mode: string }>;
}).playerModeChanged;

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
      this.entity.visible.set(isLobby);
    });

    this.entity.visible.set(true);
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


