// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on November 28, 2025

import { Entity, NetworkEvent, Player, Vec3 } from "horizon/core";

export const Events = {
  gameReset: new NetworkEvent<{}>('gameReset'),

  // Weapon Events
  weaponEquipped: new NetworkEvent<{ player: Player, weaponKey: string, weaponType: string, isRightHand: boolean }>('weaponEquipped'),

  // Gun Events
  playerScoredHit: new NetworkEvent<{player : Player, entity : Entity}>('playerScoredHit'),
  gunRequestAmmo: new NetworkEvent<{player: Player, weapon: Entity, ammoCount : number}>('gunRequestAmmo'),
  gunRequestAmmoResponse: new NetworkEvent<{ammoCount : number}>('gunRequestAmmoResponse'),

  // Axe events
  meleeHit: new NetworkEvent<{ hitPos: Vec3, hitNormal: Vec3, fromPlayer: Player, damage: number}>('meleeHit'),

  // Monster Events
  playerHit : new NetworkEvent<{player: Player, damage: number, damageOrigin : Vec3}>('PlayerHit'),

  // Monster Management
  monstersInRange: new NetworkEvent<{entity : Entity, range : number}>('monstersInRange'),
  monstersInRangeResponse: new NetworkEvent<{monsters: Entity[]}>('monstersInRangeResponse'),

  // Loot
  lootPickup: new NetworkEvent<{player: Player, loot: string}>('LootPickup'),

  // Player
  playerDeath: new NetworkEvent<{player: Player}>('PlayerDeath'),
  registerLocalPlayerController: new NetworkEvent<{ entity: Entity }>("registerLocalPlayerController"),
  playerDataUpdate: new NetworkEvent<{ammo : number, hp: number}>('playerDataUpdate'),
  playerAmmoUpdate: new NetworkEvent<{player: Player, ammo : number}>('playerAmmoUpdate'),
  playerHpUpdate: new NetworkEvent<{player: Player, hp : number}>('playerHpUpdate'),
  playerLevelUp: new NetworkEvent<{player: Player, level: number, xp: number}>('playerLevelUp'),
  playerShowResults: new NetworkEvent<{player: Player, score: number, placement?: number}>('playerShowResults'),
  playerModeChanged: new NetworkEvent<{ mode: string }>('playerModeChanged'),
  playerModeRequest: new NetworkEvent<{ playerId: number }>('playerModeRequest'),
  playerPersistentStatsRequest: new NetworkEvent<{ playerId: number }>('playerPersistentStatsRequest'),
  playerPersistentStatsUpdate: new NetworkEvent<{
    coins: number;
    gems: number;
    bestWaves: number;
    killedSlimes: number;
  }>('playerPersistentStatsUpdate'),
  matchStateRequest: new NetworkEvent<{ playerId: number }>('matchStateRequest'),
  matchStateUpdate: new NetworkEvent<{
    playerId: number;
    hpCurrent: number;
    hpMax: number;
    defense: number;
    meleeAttackLevel: number;
    rangedAttackLevel: number;
    magicAttackLevel: number;
    slimeKills: number;
    wavesSurvived: number;
  }>('matchStateUpdate'),
  
  // Player HUD
  playerHPUpdate: new NetworkEvent<{ current: number, max: number }>('playerHPUpdate'),

  // Audio
  playClientAudio: new NetworkEvent<{ playerId: number, soundId: string }>('playClientAudio'),

  // Game Flow
  requestMatchExit: new NetworkEvent<{ playerId: number }>('requestMatchExit'),
  playerDied: new NetworkEvent<{ playerId: number }>('playerDied'), // 클라이언트에게 사망 알림 (DeathPageView 활성화용)
  requestShowResults: new NetworkEvent<{ playerId: number }>('requestShowResults'), // DeathPageView에서 결과 보기 요청
};