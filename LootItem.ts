// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 07, 2025

import { Behaviour } from 'Behaviour';
import { Events } from 'Events';
import { AudioGizmo, Component, Entity, ParticleGizmo, Player, PropTypes, CodeBlockEvents } from 'horizon/core';
import { MatchStateManager } from 'MatchStateManager';
import { PlayerManager } from 'PlayerManager';
import type { LootItemSpawner } from 'LootItemSpawner';

// 아이템 종류 정의
export enum ItemType {
  Coin = "coin",
  Gem = "gem",
  HealthPotion = "healthPotion",
  DefenceUpPotion = "defenceUpPotion",
  AttackSpeedUpPotion = "attackSpeedUpPotion",
}

// LootItem 클래스: 아이템 관련 로직 담당
export class LootItem extends Behaviour<typeof LootItem> {
  static propsDefinition = {
    vfxSparkle: { type: PropTypes.Entity, default: undefined },
    coinEntity: { type: PropTypes.Entity, default: undefined },
    gemEntity: { type: PropTypes.Entity, default: undefined },
    healthPotionEntity: { type: PropTypes.Entity, default: undefined },
    defenceUpPotionEntity: { type: PropTypes.Entity, default: undefined },
    attackSpeedUpPotionEntity: { type: PropTypes.Entity, default: undefined },
    sfxCoin: { type: PropTypes.Entity, default: undefined },
    sfxGem: { type: PropTypes.Entity, default: undefined },
    sfxHealthPotion: { type: PropTypes.Entity, default: undefined },
    sfxDefenceUpPotion: { type: PropTypes.Entity, default: undefined },
    sfxAttackSpeedUpPotion: { type: PropTypes.Entity, default: undefined },
  };

  private itemType: ItemType = ItemType.Coin;
  private itemEntity?: Entity;
  private vfxSparkle?: ParticleGizmo;
  private sfxCollect?: AudioGizmo;
  private owningSpawner?: LootItemSpawner;
  private isActive: boolean = false;

  private static attackBuffTimers: Map<number, number> = new Map();

  // 초기화 시 비주얼 이펙트 로딩
  Start() {
    this.vfxSparkle = this.props.vfxSparkle?.as(ParticleGizmo);

    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerEnterTrigger, this.OnPlayerCollision.bind(this));
  }

  // 아이템 타입 설정 및 관련 엔티티/이펙트 로딩
  public setItemType(itemType: ItemType) {
    this.itemType = itemType;

    switch (itemType) {
      case ItemType.Coin:
        this.itemEntity = this.props.coinEntity?.as(Entity);
        this.sfxCollect = this.props.sfxCoin?.as(AudioGizmo);
        break;
      case ItemType.Gem:
        this.itemEntity = this.props.gemEntity?.as(Entity);
        this.sfxCollect = this.props.sfxGem?.as(AudioGizmo);
        break;
      case ItemType.HealthPotion:
        this.itemEntity = this.props.healthPotionEntity?.as(Entity);
        this.sfxCollect = this.props.sfxHealthPotion?.as(AudioGizmo);
        break;
      case ItemType.DefenceUpPotion:
        this.itemEntity = this.props.defenceUpPotionEntity?.as(Entity);
        this.sfxCollect = this.props.sfxDefenceUpPotion?.as(AudioGizmo);
        break;
      case ItemType.AttackSpeedUpPotion:
        this.itemEntity = this.props.attackSpeedUpPotionEntity?.as(Entity);
        this.sfxCollect = this.props.sfxAttackSpeedUpPotion?.as(AudioGizmo);
        break;
      default:
        this.itemEntity = undefined;
        this.sfxCollect = undefined;
    }

    this.setActive(true);
  }

  // 아이템 획득 시 호출
  public collect(player?: Player) {
    if (!this.isActive) return;

    this.setActive(false);
    
    if (this.sfxCollect) {
      this.sfxCollect.play();
    }

    if (player) {
      this.sendNetworkBroadcastEvent(Events.lootPickup, { player, loot: this.itemType });
    }

    this.owningSpawner?.recycle(this.entity);
  }

  // 아이템 활성화/비활성화 및 이펙트 관리
  public setActive(active: boolean) {
    this.isActive = active;

    // 루트 엔티티 충돌 상태도 함께 제어
    try {
      this.entity.collidable.set(active);
    } catch (_) {
      // collidable 속성이 없는 경우 무시
    }


    if (this.itemEntity) {
      this.itemEntity.visible.set(active);
    }

    if (this.vfxSparkle) {
      active ? this.vfxSparkle.play() : this.vfxSparkle.stop();
    }
  }

  public assignSpawner(spawner: LootItemSpawner) {
    this.owningSpawner = spawner;
  }

  protected override OnPlayerCollision(player: Player) {
    this.handlePickup(player);
  }

  private handlePickup(player: Player) {
    if (!this.isActive) return;

    this.applyEffect(player);
    this.collect(player);
  }

  private applyEffect(player: Player) {
    const match = MatchStateManager.instance;

    switch (this.itemType) {
      case ItemType.Coin:
        this.grantCurrency(player, 'coins', 5);
        break;
      case ItemType.Gem:
        this.grantCurrency(player, 'gems', 1);
        break;
      case ItemType.HealthPotion:
        match?.adjustHp(player, 30);
        break;
      case ItemType.DefenceUpPotion:
        this.boostDefense(player, 2);
        break;
      case ItemType.AttackSpeedUpPotion:
        this.applyAttackSpeedBuff(player, 1, 15000);
        break;
    }
  }

  private grantCurrency(player: Player, key: 'coins' | 'gems', amount: number) {
    const manager = PlayerManager.instance;
    if (!manager) return;

    const stats = manager.getPersistentStats(player);
    if (!stats) return;

    stats[key] = Math.max(0, (stats[key] ?? 0) + amount);
    manager.sendNetworkEvent(player, Events.playerPersistentStatsUpdate, stats);
  }

  private boostDefense(player: Player, amount: number) {
    const match = MatchStateManager.instance;
    if (!match) return;

    const state = match.getStats(player);
    if (!state) return;

    match.patchStats(player, { defense: state.defense + amount });
  }

  private applyAttackSpeedBuff(player: Player, bonusLevel: number, durationMs: number) {
    const match = MatchStateManager.instance;
    if (!match) return;

    const state = match.getStats(player);
    if (!state) return;

    // 기존 타이머가 있으면 갱신
    const existingTimer = LootItem.attackBuffTimers.get(player.id);
    if (existingTimer !== undefined) {
      this.async.clearTimeout(existingTimer);
    }

    match.patchStats(player, {
      meleeAttackLevel: state.meleeAttackLevel + bonusLevel,
      rangedAttackLevel: state.rangedAttackLevel + bonusLevel,
      magicAttackLevel: state.magicAttackLevel + bonusLevel,
    });

    const timer = this.async.setTimeout(() => {
      this.revertAttackSpeedBuff(player, bonusLevel);
    }, durationMs);

    LootItem.attackBuffTimers.set(player.id, timer);
  }

  private revertAttackSpeedBuff(player: Player, bonusLevel: number) {
    const match = MatchStateManager.instance;
    if (!match) return;

    const state = match.getStats(player);
    if (!state) return;

    match.patchStats(player, {
      meleeAttackLevel: Math.max(0, state.meleeAttackLevel - bonusLevel),
      rangedAttackLevel: Math.max(0, state.rangedAttackLevel - bonusLevel),
      magicAttackLevel: Math.max(0, state.magicAttackLevel - bonusLevel),
    });

    LootItem.attackBuffTimers.delete(player.id);
  }
}

Component.register(LootItem);
