import { CodeBlockEvents, Component, NetworkEvent, Player} from 'horizon/core'; 
import { NoesisGizmo } from 'horizon/noesis';

const DeathPageViewEvent = new NetworkEvent<{enabled: boolean}>("DeathPageViewEvent");

class DeathPageView extends Component<typeof DeathPageView> {

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
      this.sendNetworkEvent(player, DeathPageViewEvent, {enabled: false});
    });
  }

  private startClient() {
    const localPlayer = this.world.getLocalPlayer();

    const dataContext = {
      events: {
        goResult: () => {
          console.log("Go Result");          
        }
      }
    };

    this.entity.as(NoesisGizmo).dataContext = dataContext;

    this.connectNetworkEvent(this.world.getLocalPlayer(), DeathPageViewEvent, data => {
      this.setVisibility(data.enabled);
    });
  }

  private setVisibility(visible: boolean) {
    this.entity.visible.set(visible);
  }
}

Component.register(DeathPageView);
