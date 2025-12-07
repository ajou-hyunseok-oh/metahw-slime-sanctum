// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 07, 2025

import { CodeBlockEvents, Component, NetworkEvent, Player } from 'horizon/core';
import { NoesisGizmo } from 'horizon/noesis';
import { Events } from 'Events';

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
      this.sendNetworkEvent(player, Events.matchPageView, {enabled: false});
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
      WaveCount: ``,
      KilledSlimes: `Kills: 0`,
      events: {
        swapWeapon: () => {
          console.log("[MatchPageView] Fire Event: Swap Weapon");
          // TODO: WeaponSelector 연동 필요
        },
        exit: () => {          
          console.log("[MatchPageView] Fire Event: Exit");
          this.setVisibility(false);
          this.sendNetworkEvent(this.world.getLocalPlayer(), Events.deathPageView, { enabled: true });
        }
      }
    };

    this.entity.as(NoesisGizmo).dataContext = dataContext;

    this.connectNetworkEvent(this.world.getLocalPlayer(), Events.matchPageView, data => {
      this.setVisibility(data.enabled);
    });

    this.connectNetworkEvent(this.world.getLocalPlayer(), Events.matchStateUpdate, payload => {
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
}

Component.register(MatchPageView);
