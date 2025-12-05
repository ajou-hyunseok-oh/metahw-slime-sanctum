import { Easing } from 'horizon/camera';
import * as hz from 'horizon/core';
import * as uab from 'horizon/unity_asset_bundles'
import { PlayerCameraEvents } from 'PlayerCamera';

export const CutsceneEvents = {
  OnStartCutscene: new hz.LocalEvent<{player: hz.Player}>('OnStartCutscene'),
  OnCutsceneComplete: new hz.LocalEvent<{}>('OnCutsceneComplete'),
}

interface PlayerTimerId {
  [playerName: string]: number;
}

interface PlayerTimerCollection {
  [playerName: string]: number[];
}

class SanctumCutscene extends hz.Component<typeof SanctumCutscene> {
  static propsDefinition = {    
    cameraStart: {type: hz.PropTypes.Entity},
    cameraSpot1: {type: hz.PropTypes.Entity},
    cameraSpot2: {type: hz.PropTypes.Entity},
    cameraSpot3: {type: hz.PropTypes.Entity},
    cameraSpot4: {type: hz.PropTypes.Entity},
    cameraSpot5: {type: hz.PropTypes.Entity},
    cameraSpot6: {type: hz.PropTypes.Entity},
    cameraEnd: {type: hz.PropTypes.Entity},
    moveDuration: {type: hz.PropTypes.Number, default: 5},    
    completeDuration: {type: hz.PropTypes.Number, default: 5},
  };

  static readonly MoveToStartDuration: number = 0.4;
  private static readonly MoveToStartEasing: Easing = Easing.Linear;
  private static readonly DollyEasing: Easing = Easing.EaseOut;
  private static readonly FollowCameraSettings = {
    activationDelay: 0,
    cameraTurnSpeed: 10,
    continuousRotation: true,
    distance: 10,
    horizonLevelling: true,
    rotationSpeed: 10,
    translationSpeed: 10,
    verticalOffset: 0,
  };
  private cameraDollyTimeoutId: PlayerTimerCollection = {};
  private cameraResetTimeoutId: PlayerTimerId = {};

  
  start() {
    this.connectLocalEvent(this.entity, CutsceneEvents.OnStartCutscene, ({player}) => {            
      this.playCameraAnimation(player);      
    });
  }

  playCameraAnimation(player: hz.Player){
    console.log('[SanctumCutscene] Playing camera animation for player', player.name.get());
    const playerName = player.name.get();
    if (this.props.cameraStart === undefined || this.props.cameraStart === null) {
      console.warn('SanctumCutscene requires a cameraStart entity. Aborting cutscene.');
      return;
    }

    this.clearPlayerTimers(playerName);

    // Move camera to the start position
    this.sendNetworkEvent(player, PlayerCameraEvents.SetCameraSanctumFlying, {
      entity: this.props.cameraStart,
      duration: SanctumCutscene.MoveToStartDuration,
      easing: SanctumCutscene.MoveToStartEasing,
    });

    const cameraPath = [
      this.props.cameraSpot1,
      this.props.cameraSpot2,
      this.props.cameraSpot3,
      this.props.cameraSpot4,
      this.props.cameraSpot5,
      this.props.cameraSpot6,
      this.props.cameraEnd,
    ].filter((entity): entity is hz.Entity => entity !== undefined && entity !== null);

    if (cameraPath.length === 0) {
      console.warn('SanctumCutscene camera path is empty. Returning to follow camera.');
      this.scheduleCameraReset(player, playerName, SanctumCutscene.MoveToStartDuration * 1000);
      return;
    }

    let delayMs = SanctumCutscene.MoveToStartDuration * 1000;
    const dollyTimers: number[] = [];

    cameraPath.forEach((entity) => {
      const timerId = this.async.setTimeout(() => {
        this.sendNetworkEvent(player, PlayerCameraEvents.SetCameraSanctumFlying, {
          entity,
          duration: this.props.moveDuration,
          easing: SanctumCutscene.DollyEasing,
        });
      }, delayMs);

      dollyTimers.push(timerId);
      delayMs += this.props.moveDuration * 1000;
    });

    this.cameraDollyTimeoutId[playerName] = dollyTimers;

    this.scheduleCameraReset(player, playerName, delayMs);
  }

  private resetToPlayerCamera(player: hz.Player) {
    this.sendNetworkEvent(player, PlayerCameraEvents.SetCameraFollow, SanctumCutscene.FollowCameraSettings);
  }

  private clearPlayerTimers(playerName: string) {
    this.clearDollyTimers(playerName);
    this.clearResetTimer(playerName);
  }

  private clearDollyTimers(playerName: string) {
    const timers = this.cameraDollyTimeoutId[playerName];
    if (timers && timers.length > 0) {
      timers.forEach((timerId) => this.async.clearTimeout(timerId));
    }
    delete this.cameraDollyTimeoutId[playerName];
  }

  private clearResetTimer(playerName: string) {
    const timerId = this.cameraResetTimeoutId[playerName];
    if (timerId !== undefined && timerId >= 0) {
      this.async.clearTimeout(timerId);
    }
    delete this.cameraResetTimeoutId[playerName];
  }

  private scheduleCameraReset(player: hz.Player, playerName: string, travelDelayMs: number) {
    this.clearResetTimer(playerName);
    this.cameraResetTimeoutId[playerName] = this.async.setTimeout(() => {
      this.resetToPlayerCamera(player);
      this.sendNetworkEvent(player, CutsceneEvents.OnCutsceneComplete, {});
      delete this.cameraResetTimeoutId[playerName];
      this.clearDollyTimers(playerName);
    }, travelDelayMs + (this.props.completeDuration * 1000));
  }
}
hz.Component.register(SanctumCutscene);