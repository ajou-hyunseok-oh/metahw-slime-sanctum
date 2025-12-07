import { CodeBlockEvents, Component, NetworkEvent, Player} from 'horizon/core'; 
import { NoesisGizmo } from 'horizon/noesis';
import { Events } from 'Events';

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
      this.sendNetworkEvent(player, Events.deathPageView, {enabled: false});
    });
  }

  private startClient() {
    const localPlayer = this.world.getLocalPlayer();

    const dataContext = {
      events: {
        goResult: () => {
          console.log("`[DeathPageView] Go Result");          
          this.setVisibility(false);
          this.sendNetworkEvent(this.world.getLocalPlayer(), Events.resultPageView, { enabled: true });
        }
      }
    };

    this.entity.as(NoesisGizmo).dataContext = dataContext;

    this.connectNetworkEvent(this.world.getLocalPlayer(), Events.deathPageView, data => {

      console.log(`[DeathPageView] received event: ${this.world.getLocalPlayer().name.get()} / enabled: ${data.enabled}`);
      this.setVisibility(data.enabled);
    });
  }

  private setVisibility(visible: boolean) {
    this.entity.visible.set(visible);
  }
}

Component.register(DeathPageView);
