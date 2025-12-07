import {CodeBlockEvents, Component, NetworkEvent, Player} from 'horizon/core';
import { NoesisGizmo } from 'horizon/noesis';

const ResultPageViewEvent = new NetworkEvent<{enabled: boolean}>("ResultPageViewEvent");

/**
 * This is an example of a NoesisUI component that can be used in a world.
 * It's default execution mode is "Shared" which means it will be executed on the server and all of the clients.
 */
class ResultPageView extends Component<typeof ResultPageView> {

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
      this.sendNetworkEvent(player, ResultPageViewEvent, {enabled: false});
    });
  }

  private startClient() {
    const dataContext = {      
    };
    this.entity.as(NoesisGizmo).dataContext = dataContext;

    this.connectNetworkEvent(this.world.getLocalPlayer(), ResultPageViewEvent, data => {
      this.setVisibility(data.enabled);
    });
  }

  private setVisibility(visible: boolean) {
    this.entity.visible.set(visible);
  }
}

Component.register(ResultPageView);
