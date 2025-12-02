import * as hz from 'horizon/core';
import { Events } from 'Events';
import { PlayerMode } from 'PlayerManager';

const playerModeChangedEvent = (Events as unknown as {
  playerModeChanged: hz.NetworkEvent<{ mode: string }>;
}).playerModeChanged;

const playerModeRequestEvent = (Events as unknown as {
  playerModeRequest: hz.NetworkEvent<{ playerId: number }>;
}).playerModeRequest;

const playerLevelUpEvent = (Events as unknown as {
  playerLevelUp: hz.NetworkEvent<{ player: hz.Player; level: number; xp: number }>;
}).playerLevelUp;

const playerDeathEvent = (Events as unknown as {
  playerDeath: hz.NetworkEvent<{ player: hz.Player }>;
}).playerDeath;

const playerShowResultsEvent = (Events as unknown as {
  playerShowResults: hz.NetworkEvent<{ player: hz.Player; score: number; placement?: number }>;
}).playerShowResults;

export enum UIState {
  Lobby,
  Match,
}

export enum UIPlayerEvent {
  None,
  LevelUp,
  Death,
  Results,
}

export class UIManager extends hz.Component<typeof UIManager> {
  static propsDefinition = {
    lobbyPageView: { type: hz.PropTypes.Entity },
    matchPageView: { type: hz.PropTypes.Entity },
    levelUpWindow: { type: hz.PropTypes.Entity },
    deathWindow: { type: hz.PropTypes.Entity },
    resultWindow: { type: hz.PropTypes.Entity },
  };
  private localPlayer: hz.Player | null = null;
  private currentState: UIState = UIState.Lobby;
  private activePlayerEvent: UIPlayerEvent = UIPlayerEvent.None;

  start() {
    if (!this.isLocalContext()) {
      return;
    }

    this.localPlayer = this.world.getLocalPlayer();
    if (!this.localPlayer) {
      console.warn('[UIManager] Local player reference is missing.');
      return;
    }

    this.initializeMainViews();
    this.registerNetworkEventListeners();
    this.requestInitialPlayerMode();
  }

  private initializeMainViews() {
    this.applyUiState(this.currentState);
    this.applyPlayerEvent(UIPlayerEvent.None);
  }

  private registerNetworkEventListeners() {
    if (!this.localPlayer) {
      return;
    }

    this.connectNetworkEvent(this.localPlayer, playerModeChangedEvent, ({ mode }) => {
      this.handlePlayerModeChanged(mode);
    });

    this.connectNetworkEvent(this.localPlayer, playerLevelUpEvent, ({ player }) => {
      if (this.isLocalPlayer(player)) {
        this.applyPlayerEvent(UIPlayerEvent.LevelUp);
      }
    });

    this.connectNetworkEvent(this.localPlayer, playerDeathEvent, ({ player }) => {
      if (this.isLocalPlayer(player)) {
        this.applyPlayerEvent(UIPlayerEvent.Death);
      }
    });

    this.connectNetworkEvent(this.localPlayer, playerShowResultsEvent, ({ player }) => {
      if (this.isLocalPlayer(player)) {
        this.applyPlayerEvent(UIPlayerEvent.Results);
      }
    });
  }

  private requestInitialPlayerMode() {
    if (!this.localPlayer) {
      return;
    }

    this.sendNetworkBroadcastEvent(playerModeRequestEvent, { playerId: this.localPlayer.id });
  }

  private handlePlayerModeChanged(mode: string) {
    if (mode === PlayerMode.Match) {
      this.currentState = UIState.Match;
    } else {
      this.currentState = UIState.Lobby;
    }

    this.applyUiState(this.currentState);

    if (this.currentState === UIState.Lobby) {
      this.applyPlayerEvent(UIPlayerEvent.None);
    }
  }

  private applyUiState(state: UIState) {
    const lobbyView = this.props.lobbyPageView;
    const matchView = this.props.matchPageView;

    lobbyView?.visible.set(state === UIState.Lobby);
    matchView?.visible.set(state === UIState.Match);
  }

  private applyPlayerEvent(eventType: UIPlayerEvent) {
    if (this.activePlayerEvent === eventType) {
      return;
    }

    this.hideActivePlayerEvent();
    this.activePlayerEvent = eventType;
    this.showPlayerEventWindow(eventType);
  }

  private hideActivePlayerEvent() {
    this.togglePlayerEventWindow(this.activePlayerEvent, false);
    this.activePlayerEvent = UIPlayerEvent.None;
  }

  private showPlayerEventWindow(eventType: UIPlayerEvent) {
    this.togglePlayerEventWindow(eventType, true);
  }

  private togglePlayerEventWindow(eventType: UIPlayerEvent, isVisible: boolean) {
    const target = this.getEventWindowEntity(eventType);
    target?.visible.set(isVisible);
  }

  private getEventWindowEntity(eventType: UIPlayerEvent): hz.Entity | undefined {
    switch (eventType) {
      case UIPlayerEvent.LevelUp:
        return this.props.levelUpWindow;
      case UIPlayerEvent.Death:
        return this.props.deathWindow;
      case UIPlayerEvent.Results:
        return this.props.resultWindow;
      default:
        return undefined;
    }
  }

  private isLocalPlayer(player: hz.Player): boolean {
    return !!this.localPlayer && player.id === this.localPlayer.id;
  }

  private isLocalContext(): boolean {
    try {
      const local = this.world.getLocalPlayer();
      const server = this.world.getServerPlayer();
      return local?.id !== server?.id;
    } catch {
      return false;
    }
  }
}

hz.Component.register(UIManager);