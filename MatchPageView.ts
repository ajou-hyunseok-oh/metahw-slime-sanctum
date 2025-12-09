// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 07, 2025

import { CodeBlockEvents, Component, NetworkEvent, Player, PropTypes } from 'horizon/core';
import { WeaponType } from 'GameBalanceData';
import { WeaponSelectorEvents } from 'WeaponSelector';
import { NoesisGizmo } from 'horizon/noesis';
import { Events } from 'Events';

/**
 * This is an example of a NoesisUI component that can be used in a world.
 * It's default execution mode is "Shared" which means it will be executed on the server and all of the clients.
 */
class MatchPageView extends Component<typeof MatchPageView> {
  static propsDefinition = {};

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
    let meleeLevel = 0;
    let rangedLevel = 0;
    let magicLevel = 0;
    let currentWeaponType: WeaponType = WeaponType.Melee;

    const getAvailableWeaponTypes = () => {
      const types: { type: WeaponType; level: number }[] = [
        { type: WeaponType.Melee, level: meleeLevel },
        { type: WeaponType.Ranged, level: rangedLevel },
        { type: WeaponType.Magic, level: magicLevel },
      ];
      return types.filter(t => t.level >= 1);
    };

    const cycleWeapon = () => {
      const available = getAvailableWeaponTypes();
      if (available.length === 0) {
        console.warn("[MatchPageView] 교체 가능한 무기가 없습니다. (모든 스킬 레벨 < 1)");
        return;
      }

      const currentIdx = available.findIndex(t => t.type === currentWeaponType);
      const nextIdx = currentIdx >= 0 ? (currentIdx + 1) % available.length : 0;
      const next = available[nextIdx];
      currentWeaponType = next.type;
      dataContext.WeaponType = WeaponType[currentWeaponType] || currentWeaponType;

      // WeaponSelector에 요청 전달
      this.sendNetworkBroadcastEvent(WeaponSelectorEvents.requestWeapon, {
        playerId: this.world.getLocalPlayer().id,
        weaponType: currentWeaponType,
        level: next.level,
      });
    };

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
        /*
        swapWeapon: () => {
          console.log("[MatchPageView] Fire Event: Swap Weapon");
          cycleWeapon();
        },
        */
        exit: () => {          
          console.log("[MatchPageView] Fire Event: Exit (Request Server)");
          // 서버에 종료 요청을 보내면 MatchStateManager가 처리 후 결과 화면(ResultPageView) 이벤트를 보냄
          this.sendNetworkBroadcastEvent(Events.requestMatchExit, { playerId: this.world.getLocalPlayer().id });
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
      meleeLevel = payload.meleeAttackLevel ?? 0;
      rangedLevel = payload.rangedAttackLevel ?? 0;
      magicLevel = payload.magicAttackLevel ?? 0;
      dataContext.MeleeLevel = `Lv ${meleeLevel}`;
      dataContext.RangedLevel = `Lv ${rangedLevel}`;
      dataContext.MagicLevel = `Lv ${magicLevel}`;
      dataContext.DefenceLevel = `Lv ${payload.skillDefenseBonusLevel}`;
      // 현재 장착 타입이 유효하지 않다면 사용 가능한 첫 타입으로 보정
      const available = getAvailableWeaponTypes();
      if (!available.find(t => t.type === currentWeaponType) && available.length > 0) {
        currentWeaponType = available[0].type;
        dataContext.WeaponType = WeaponType[currentWeaponType] || currentWeaponType;
      }
      // dataContext.WaveCount = payload.wavesSurvived === 0 ? `` : `Wave ${payload.wavesSurvived}`;
      dataContext.KilledSlimes = `Kills: ${payload.slimeKills}`;
    });

    this.connectNetworkEvent(this.world.getLocalPlayer(), Events.waveStart, (data) => {
      console.log("[MatchPageView] Wave Start: ", data);
        // 웨이브 시작 시 3초간 웨이브 텍스트 표시
        dataContext.WaveCount = `Wave ${data.wave}`;
        
        // 3초 후 텍스트 숨김 (클라이언트 사이드 타이머)
        this.async.setTimeout(() => {
             dataContext.WaveCount = "";
        }, 3000);
    });
  }
}

Component.register(MatchPageView);
