// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on November 28, 2025

import { Behaviour } from 'Behaviour';
import { Component, Player, Vec3 } from 'horizon/core';
import { Events } from 'Events';
import { HapticFeedback, HapticHand, HapticType } from 'HapticFeedback';

class GameManager extends Behaviour<typeof GameManager> {
  static propsDefinition = {};

  timerID: number = 0;
  countdownTimeInMS: number = 3000;

  Awake() {
  }

  Start() {
    // 햅틱 피드백 이벤트 연결
    this.connectNetworkBroadcastEvent(Events.playerHit, this.onPlayerHit.bind(this));
    this.connectNetworkBroadcastEvent(Events.playerDied, this.onPlayerDied.bind(this));
    this.connectNetworkBroadcastEvent(Events.lootPickup, this.onLootPickup.bind(this));
    this.connectNetworkBroadcastEvent(Events.playerScoredHit, this.onPlayerScoredHit.bind(this));
  }

  private onPlayerHit(data: { player: Player, damage: number }) {
    if (this.isLocalPlayer(data.player)) {
      // 슬라임에게 맞았을 때 데미지 햅틱 재생
      HapticFeedback.playPattern(data.player, HapticType.damage, HapticHand.Both, this);
    }
  }

  private onPlayerDied(data: { playerId: number }) {
    console.log(`[GameManager] Local Player Died. Showing Death Page. ${data.playerId}`);
    const localPlayer = this.world.getLocalPlayer();
    if (localPlayer && localPlayer.id === data.playerId) {
      // 사망 시 햅틱 재생
      HapticFeedback.playPattern(localPlayer, HapticType.death, HapticHand.Both, this);

      // 사망 화면 표시
      this.sendNetworkEvent(localPlayer, Events.deathPageView, { enabled: true });
      
      // 전투 HUD 숨기기
      this.sendNetworkEvent(localPlayer, Events.matchPageView, { enabled: false });

      console.log(`[GameManager] Local Player Died. Showing Death Page.`);
    }
  }

  private onLootPickup(data: { player: Player }) {
    if (this.isLocalPlayer(data.player)) {
      // 아이템 획득 시 햅틱 재생
      HapticFeedback.playPattern(data.player, HapticType.pickup, HapticHand.Both, this);
    }
  }

  private onPlayerScoredHit(data: { player: Player }) {
    if (this.isLocalPlayer(data.player)) {
      // 적을 타격했을 때 햅틱 재생
      HapticFeedback.playPattern(data.player, HapticType.hitObject, HapticHand.Both, this);
    }
  }

  private isLocalPlayer(player: Player): boolean {
    const localPlayer = this.world.getLocalPlayer();
    return localPlayer && localPlayer.id === player.id;
  }
}

Component.register(GameManager);
