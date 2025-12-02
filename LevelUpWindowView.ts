// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 02, 2025

import { CodeBlockEvents, Component, NetworkEvent, Player } from 'horizon/core';
import { NoesisGizmo } from 'horizon/noesis';

/**
 * This is an example of a NetworkEvent that can be used to send data from the server to the clients.
 */
const LevelUpWindowViewEvent = new NetworkEvent<{greeting: string}>("LevelUpWindowViewEvent");

/**
 * This is an example of a NoesisUI component that can be used in a world.
 * It's default execution mode is "Shared" which means it will be executed on the server and all of the clients.
 */
class LevelUpWindowView extends Component<typeof LevelUpWindowView> {

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
      this.sendNetworkEvent(player, LevelUpWindowViewEvent, {greeting: `Welcome ${player.name.get()}`});
    });
  }

  private startClient() {
    const dataContext = {};
    this.entity.as(NoesisGizmo).dataContext = dataContext;
    // After a dataContext object is attached to a Noesis gizmo, it's automatically tracked for changes
    // so simply updating it will automatically update the UI.
    this.connectNetworkEvent(this.world.getLocalPlayer(), LevelUpWindowViewEvent, data => {
      console.log('NoesisUI: OnEvent', data);      
    });
  }
}

Component.register(LevelUpWindowView);
