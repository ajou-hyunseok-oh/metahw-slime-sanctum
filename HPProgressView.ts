import { CodeBlockEvents, Component, NetworkEvent, Player } from 'horizon/core';
import { NoesisGizmo } from 'horizon/noesis';

/**
 * This is an example of a NetworkEvent that can be used to send data from the server to the clients.
 */
const HPProgressViewEvent = new NetworkEvent<{greeting: string}>("HPProgressViewEvent");
export const HPUpdateEvent = new NetworkEvent<{targetId: bigint, current: number, max: number}>("HPUpdateEvent");

/**
 * This is an example of a NoesisUI component that can be used in a world.
 * It's default execution mode is "Shared" which means it will be executed on the server and all of the clients.
 */
export class HPProgressView extends Component<typeof HPProgressView> {

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
      this.sendNetworkEvent(player, HPProgressViewEvent, {greeting: `Welcome ${player.name.get()}`});
    });
  }

  private startClient() {
    const dataContext = {
      CurrentHP: 100,
      MaxHP: 100,      
    };
    this.entity.as(NoesisGizmo).dataContext = dataContext;
    
    // After a dataContext object is attached to a Noesis gizmo, it's automatically tracked for changes
    // so simply updating it will automatically update the UI.
    this.connectNetworkEvent(this.world.getLocalPlayer(), HPProgressViewEvent, data => {});
    
    this.connectNetworkBroadcastEvent(HPUpdateEvent, (data) => {
      if (this.entity.id === data.targetId) {
        this.updateHP(data.current, data.max);
      }
    });
  }

  public updateHP(currentHP: number, maxHP: number) {
    const dataContext = {
      CurrentHP: currentHP,
      MaxHP: maxHP,
    };
    this.entity.as(NoesisGizmo).dataContext = dataContext;
  }
}

Component.register(HPProgressView);
