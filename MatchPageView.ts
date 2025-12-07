// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 02, 2025

import { Component, NetworkEvent, Player } from 'horizon/core';
import { NoesisGizmo } from 'horizon/noesis';
import { Events } from 'Events';
import { PlayerMode } from 'PlayerManager';
import type { MatchStateUpdatePayload } from 'MatchStateManager';

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

/**
 * This is an example of a NoesisUI component that can be used in a world.
 * It's default execution mode is "Shared" which means it will be executed on the server and all of the clients.
 */
class MatchPageView extends Component<typeof MatchPageView> {

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
      if (payload.playerId !== localPlayer.id) {
        return;
      }
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
          console.log("Exit");
        }
      }
    };

    this.entity.as(NoesisGizmo).dataContext = dataContext;
  }

  private createEmptyDataContext() {
    return {
      CurrentHP: 0,
      MaxHP: 0,
      HPText: `${0}/${0}`,
      HPLevel: `Lv 0`,
      HPSkillLevel: `Lv 0`,
      CurrentXP: 0,
      MaxXP: 0,
      XPText: `0%`,
      DefenceLevel: `Lv 0`,
      DefenceValue: 0,
      MeleeLevel: `Lv 0`,
      RangedLevel: `Lv 0`,
      MagicLevel: `Lv 0`,
      WaveCount: `Wave 0`,
      KilledSlimes: `Kills: 0`
    };
  }
}

Component.register(MatchPageView);
