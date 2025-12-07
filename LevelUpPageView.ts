// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 07, 2025 

import { CodeBlockEvents, Component, NetworkEvent, Player } from 'horizon/core';
import { NoesisGizmo } from 'horizon/noesis';

const LevelUpPageViewEvent = new NetworkEvent<{enabled: boolean}>("LevelUpPageViewEvent");

class LevelUpPageView extends Component<typeof LevelUpPageView> {

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
      this.sendNetworkEvent(player, LevelUpPageViewEvent, {enabled: false});
    });
  }

  private startClient() {
    const dataContext = {      
    };
    this.entity.as(NoesisGizmo).dataContext = dataContext;    

    this.connectNetworkEvent(this.world.getLocalPlayer(), LevelUpPageViewEvent, data => {
      this.setVisibility(data.enabled);
    });
  }

  private setVisibility(enabled: boolean) {
    this.entity.visible.set(enabled);
  }
}

Component.register(LevelUpPageView);
