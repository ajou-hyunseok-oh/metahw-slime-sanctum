import * as hz from 'horizon/core';

export enum UIState {
  Title,
  Lobby,
  Match,  
  LevelUp,
  Result,
}

export class UIManager extends hz.Component<typeof UIManager> {
  static propsDefinition = {
    titlePageView: { type: hz.PropTypes.Entity },
    lobbyPageView: { type: hz.PropTypes.Entity },
    matchPageView: { type: hz.PropTypes.Entity },    
    levelUpWindowView: { type: hz.PropTypes.Entity },
    resultWindowView: { type: hz.PropTypes.Entity },
  };

  static instance: UIManager;
  private static pendingCharacterLoaded = false;

  private currentState: UIState = UIState.Title;
  public get CurrentState() : UIState {
    return this.currentState;
  }
  
  public set CurrentState(value: UIState) {
    this.currentState = value;

    this.props.titlePageView?.visible.set(false);
    this.props.lobbyPageView?.visible.set(false);
    this.props.matchPageView?.visible.set(false);
    this.props.levelUpWindowView?.visible.set(false);
    this.props.resultWindowView?.visible.set(false);

    switch (value) {
      case UIState.Match:
        this.props.matchPageView?.visible.set(true);
        break;
      case UIState.Lobby:
        this.props.lobbyPageView?.visible.set(true);
        break;
      case UIState.Title:
        this.props.titlePageView?.visible.set(true);
        break;
      case UIState.LevelUp:
        this.props.levelUpWindowView?.visible.set(true);
        break;
      case UIState.Result:
        this.props.resultWindowView?.visible.set(true);
        break;
    }
  }

  preStart() {
    UIManager.instance = this;    
  }

  private minLifetimeComplete = false;
  private playerLoaded = false;
  private hasTransitioned = false;

  start() {
    if (UIManager.pendingCharacterLoaded) {
      this.handleCharacterLoaded();
      UIManager.pendingCharacterLoaded = false;
    }

    this.async.setTimeout(() => {
      this.minLifetimeComplete = true;
      this.tryEnterLobby();
    }, 3000);
  }

  public static notifyCharacterLoaded() {
    if (UIManager.instance) {
      UIManager.instance.handleCharacterLoaded();
      return;
    }

    UIManager.pendingCharacterLoaded = true;
  }

  private handleCharacterLoaded() {
    this.playerLoaded = true;
    this.tryEnterLobby();
  }

  private tryEnterLobby() {
    if (this.hasTransitioned || !this.minLifetimeComplete || !this.playerLoaded) {
      return;
    }

    this.hasTransitioned = true;
    this.CurrentState = UIState.Lobby;
  }
}
hz.Component.register(UIManager);