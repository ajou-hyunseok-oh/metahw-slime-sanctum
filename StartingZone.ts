// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on November 30, 2025

import { Behaviour } from 'Behaviour';
import { Component, Entity, PropTypes, CodeBlockEvents, Player, GrabbableEntity, Handedness, AvatarGripPoseAnimationNames } from 'horizon/core';

class StartingZone extends Behaviour<typeof StartingZone> {
  static propsDefinition = {
    weaponAsset: { type: PropTypes.Asset },
    weaponEntity: { type: PropTypes.Entity },
  };

  private playersHoldingWeapon: Set<number> = new Set();

  Awake() {
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerEnterTrigger, this.onPlayerEnterTrigger.bind(this));
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerExitTrigger, this.onPlayerExitTrigger.bind(this));
    this.registerWeaponInputEvents();
  }

  onPlayerEnterTrigger(player: Player) {
    console.log(`Player ${player.name.get()} entered.`);
    this.giveWeaponToPlayer(player);
  }

  onPlayerExitTrigger(player: Player) {
    console.log(`Player ${player.name.get()} exited.`);
    this.playersHoldingWeapon.delete(player.id);
  }

  private giveWeaponToPlayer(player: Player) {
    const weaponEntity = this.props.weaponEntity;
    if (!weaponEntity) {
      console.warn('[GrabZone] weaponEntity가 설정되지 않았습니다.');
      return;
    }

    const grabbableWeapon = weaponEntity.as(GrabbableEntity);
    if (!grabbableWeapon) {
      console.warn('[GrabZone] weaponEntity가 GrabbableEntity가 아닙니다.');
      return;
    }

    try {
      grabbableWeapon.forceHold(player, Handedness.Right, true);
      this.playersHoldingWeapon.add(player.id);
    } catch (error) {
      console.error(`[GrabZone] 무기 지급 실패: ${error}`);
    }
  }

  private registerWeaponInputEvents() {
    const weaponEntity = this.props.weaponEntity;
    if (!weaponEntity) {
      console.warn('[GrabZone] weaponEntity 연결 실패: 입력 이벤트를 등록할 수 없습니다.');
      return;
    }

    this.connectCodeBlockEvent(weaponEntity, CodeBlockEvents.OnIndexTriggerDown, this.onWeaponFireInput.bind(this));
    this.connectCodeBlockEvent(weaponEntity, CodeBlockEvents.OnGrabStart, this.onWeaponGrabStart.bind(this));
    this.connectCodeBlockEvent(weaponEntity, CodeBlockEvents.OnGrabEnd, this.onWeaponGrabEnd.bind(this));
  }

  private onWeaponGrabStart(isRightHand: boolean, player: Player) {
    this.playersHoldingWeapon.add(player.id);
  }

  private onWeaponGrabEnd(player: Player) {
    this.playersHoldingWeapon.delete(player.id);
  }

  private onWeaponFireInput(player: Player) {
    console.log(`[GrabZone] ${player.name.get()} Touch Screen.`);
    if (!this.playersHoldingWeapon.has(player.id)) {
      return;
    }
    this.playWeaponFireAnimation(player);
  }

  private playWeaponFireAnimation(player: Player) {
    try {
      player.playAvatarGripPoseAnimationByName(AvatarGripPoseAnimationNames.Fire);
    } catch (error) {
      console.error(`[GrabZone] Fire 애니메이션 호출 실패: ${error}`);
      this.playFallbackAnimation(player);
    }
  }

  private playFallbackAnimation(player: Player) {
    const animationAsset = this.props.weaponAsset;
    if (!animationAsset) {
      return;
    }

    try {
      player.playAvatarAnimation(animationAsset);
    } catch (error) {
      console.error(`[GrabZone] 대체 애니메이션 재생 실패: ${error}`);
    }
  }
}
Component.register(StartingZone);