// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 07, 2025

import { CodeBlockEvents, Component, NetworkEvent, Player } from 'horizon/core';
import { NoesisGizmo } from 'horizon/noesis';
import type { MatchStateUpdatePayload } from 'MatchStateManager';

export const MatchPageViewEvent = new NetworkEvent<{enabled: boolean}>("MatchPageViewEvent");
export const MatchPageUpdateEvent = new NetworkEvent<MatchStateUpdatePayload>("MatchStateUpdateEvent");

/*
const playerModeChangedEvent = (Events as unknown as {
  playerModeChanged: NetworkEvent<{ mode: string }>;
}).playerModeChanged;

const matchStateRequestEvent = (Events as unknown as {
  matchStateRequest: NetworkEvent<{ playerId: number }>;
}).matchStateRequest;

const matchStateUpdateEvent = (Events as unknown as {
  matchStateUpdate: NetworkEvent<MatchStateUpdatePayload>;
}).matchStateUpdate;

const playerHPUpdateEvent = (Events as unknown as {
  playerHPUpdate: NetworkEvent<{ current: number, max: number }>;
}).playerHPUpdate;

const requestMatchExitEvent = (Events as unknown as {
  requestMatchExit: NetworkEvent<{ playerId: number }>;
}).requestMatchExit;
*/

/**
 * This is an example of a NoesisUI component that can be used in a world.
 * It's default execution mode is "Shared" which means it will be executed on the server and all of the clients.
 */
class MatchPageView extends Component<typeof MatchPageView> {
  start() {
    if (this.world.getLocalPlayer().id === this.world.getServerPlayer().id) {
      this.startServer();
    } else {
      this.startClient();
    }
  }

  private setVisibility(enabled: boolean) {
    this.entity.visible.set(enabled);
  }

  private startServer() {
    // Noesis dataContext can't be directly controlled from the server
    // but server can send events to the clients so that they would update their dataContexts accordingly
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerEnterWorld, (player: Player) => {
      console.log('NoesisUI: OnPlayerEnterWorld', player.name.get());
      this.sendNetworkEvent(player, MatchPageViewEvent, {enabled: false});
    });
  }

  private startClient() {
    const dataContext = {
      CurrentHP: 0,      
      MaxHP: 0,
      HPText: ``,      
      HPLevel: `Lv 0`, // Added Passive Skill Level
      CurrentXP: 0,
      MaxXP: 0,
      XPText: `0%`,
      MeleeLevel: `Lv 0`,
      RangedLevel: `Lv 0`,
      MagicLevel: `Lv 0`,
      DefenceLevel: `Lv 0`, // Changed to show Skill Level      
      WeaponType: "Melee",
      WaveCount: `Wave 0`,
      KilledSlimes: `Kills: 0`,
      events: {
        swapWeapon: () => {
          console.log("Fire Event: Swap Weapon");
        },
        exit: () => {          
          console.log("Fire Event: Exit");
        }
      }
    };

    this.entity.as(NoesisGizmo).dataContext = dataContext;

    this.connectNetworkEvent(this.world.getLocalPlayer(), MatchPageViewEvent, data => {
      this.setVisibility(data.enabled);
    });

    this.connectNetworkEvent(this.world.getLocalPlayer(), MatchPageUpdateEvent, payload => {
      dataContext.CurrentHP = payload.hpCurrent;
      dataContext.MaxHP = payload.hpMax;
      dataContext.HPText = `${payload.hpCurrent}/${payload.hpMax}`;
      dataContext.HPLevel = `Lv ${payload.skillHpBonusLevel}`;
      dataContext.CurrentXP = payload.currentXp;
      dataContext.MaxXP = payload.xpToNextLevel;
      dataContext.XPText = `${Math.floor((payload.currentXp / payload.xpToNextLevel) * 100)}%`;
      dataContext.MeleeLevel = `Lv ${payload.meleeAttackLevel}`;
      dataContext.RangedLevel = `Lv ${payload.rangedAttackLevel}`;
      dataContext.MagicLevel = `Lv ${payload.magicAttackLevel}`;
      dataContext.DefenceLevel = `Lv ${payload.skillDefenseBonusLevel}`;
      dataContext.WeaponType = "Melee";
      dataContext.WaveCount = payload.wavesSurvived === 0 ? `` : `Wave ${payload.wavesSurvived}`;
      dataContext.KilledSlimes = `Kills: ${payload.slimeKills}`;
    });
  }
  /*
  start() {
    const localPlayer = this.world.getLocalPlayer();
    const serverPlayer = this.world.getServerPlayer();

    if (localPlayer && serverPlayer && localPlayer.id === serverPlayer.id) {
      console.log('[TitlePageView] Server context detected; skipping client UI logic.');
      return;
    }

    this.startClient();
  }

  private startClient() {
    const localPlayer = this.world.getLocalPlayer();

    this.connectNetworkEvent(localPlayer, playerModeChangedEvent, payload => {
      const isMatch = payload.mode === PlayerMode.Match;
      this.setVisibility(isMatch, localPlayer);
    });

    this.connectNetworkEvent(localPlayer, matchStateUpdateEvent, payload => {
      this.onMatchStatsUpdated(payload);
    });

    this.connectNetworkEvent(localPlayer, playerHPUpdateEvent, (data) => {
      const gizmo = this.entity.as(NoesisGizmo);
      if (gizmo && gizmo.dataContext) {
        gizmo.dataContext.CurrentHP = data.current;
        gizmo.dataContext.MaxHP = data.max;
        gizmo.dataContext.HPText = `${data.current}/${data.max}`;
      }
    });

    this.setVisibility(false, localPlayer);
  }

  private setVisibility(visible: boolean, player: Player) {
    this.entity.visible.set(visible);

    if (visible) {
      this.requestMatchStats(player);
    }
  }

  private requestMatchStats(player: Player) {
    this.sendNetworkBroadcastEvent(matchStateRequestEvent, { playerId: player.id });
  }

  private onMatchStatsUpdated(stats: MatchStateUpdatePayload) {
    const localPlayer = this.world.getLocalPlayer();
    const dataContext = {
      CurrentHP: stats.hpCurrent,      
      MaxHP: stats.hpMax,
      HPText: `${stats.hpCurrent}/${stats.hpMax}`,      
      HPLevel: `Lv ${stats.skillHpBonusLevel}`, // Added Passive Skill Level
      CurrentXP: stats.currentXp,
      MaxXP: stats.xpToNextLevel,
      XPText: `${Math.floor((stats.currentXp / stats.xpToNextLevel) * 100)}%`,
      MeleeLevel: `Lv ${stats.meleeAttackLevel}`,
      RangedLevel: `Lv ${stats.rangedAttackLevel}`,
      MagicLevel: `Lv ${stats.magicAttackLevel}`,
      DefenceLevel: `Lv ${stats.skillDefenseBonusLevel}`, // Changed to show Skill Level      
      WeaponType: "Melee",
      WaveCount: stats.wavesSurvived === 0 ? `` : `Wave ${stats.wavesSurvived}`,
      KilledSlimes: `Kills: ${stats.slimeKills}`,
      events: {
        swapWeapon: () => {
          console.log("Swap Weapon");
        },
        exit: () => {
          console.log("Exit button clicked");
          this.sendNetworkBroadcastEvent(requestMatchExitEvent, { playerId: localPlayer.id });
        }
      }
    };

    this.entity.as(NoesisGizmo).dataContext = dataContext;
  }
  }
  */
}

Component.register(MatchPageView);
