import {CodeBlockEvents, Component, NetworkEvent, Player} from 'horizon/core';
import { NoesisGizmo } from 'horizon/noesis';
import { Events } from 'Events';

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
      this.sendNetworkEvent(player, Events.resultPageView, {enabled: false});
    });
  }

  private startClient() {
    const dataContext = {
      WaveMessage: `Wave ${99}`,
      WaveCount: `${99} Waves`,
      KilledSlimes: `Kills: ${999}`,
      Coins: `${9999} Coins`,
      Gems: `${9999} Gems`,
      events: {
        goLobby: () => {
          console.log("[ResultPageView] Go Lobby");                    
          this.setVisibility(false);
          this.sendNetworkEvent(this.world.getLocalPlayer(), Events.lobbyPageView, { enabled: true });
          
          // 서버로 로비 복귀 요청 전송 (서버 전송 오류 회피를 위해 Broadcast 사용)
          this.sendNetworkBroadcastEvent(Events.returnToLobby, { player: this.world.getLocalPlayer() });
        }
      }      
    };
    this.entity.as(NoesisGizmo).dataContext = dataContext;

    this.connectNetworkEvent(this.world.getLocalPlayer(), Events.resultPageView, data => {
      this.setVisibility(data.enabled);
    });

    this.connectNetworkEvent(this.world.getLocalPlayer(), Events.matchResultUpdate, data => {
      this.setVisibility(true);

      dataContext.WaveMessage = ``;
      dataContext.WaveCount = `${data.waves} Waves`;
      dataContext.KilledSlimes = `${data.kills} Kills`;
      dataContext.Coins = `${data.coins} Coins`;
      dataContext.Gems = `${data.gems} Gems`;
    });
  }

  private setVisibility(visible: boolean) {
    this.entity.visible.set(visible);
  }
}

Component.register(ResultPageView);
