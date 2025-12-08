import * as hz from 'horizon/core';
import { Easing } from 'horizon/camera';
import { PlayerCameraEvents } from 'PlayerCamera';

class LobbyCameraTrigger extends hz.Component<typeof LobbyCameraTrigger> {  
  static propsDefinition = {
    cameraPositionEntity: {type: hz.PropTypes.Entity},    
  };

  start() {
    this.connectCodeBlockEvent(this.entity, hz.CodeBlockEvents.OnPlayerEnterTrigger, (player: hz.Player) => {
      console.log(`[LobbyCameraTrigger] Setting camera lobby with entity`, this.props.cameraPositionEntity);
      if (this.props.cameraPositionEntity !== undefined && this.props.cameraPositionEntity !== null) {
        this.sendNetworkEvent(player, PlayerCameraEvents.SetCameraLobby, { entity: this.props.cameraPositionEntity, duration: 0.2, easing: Easing.EaseInOut});
        console.log(`[LobbyCameraTrigger] Camera lobby set with entity`, this.props.cameraPositionEntity);
      } else {
        console.warn("Attempted to use LobbyCameraTrigger without a camera position entity. Create an empty object and reference it in the props.")
      }
    });    
  }
}
hz.Component.register(LobbyCameraTrigger);