// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import { Entity, NetworkEvent, Player, Vec3 } from "horizon/core";

export const Events = {
  // =================================================================================
  // Game Flow & Match System
  // =================================================================================
  gameReset: new NetworkEvent<{}>('gameReset'),
  
  // 매치 진입/상태 동기화
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
    level: number;
    currentXp: number;
    xpToNextLevel: number;
    skillHpBonusLevel: number;
    skillDefenseBonusLevel: number;
  }>('matchStateUpdate'),

  requestMatchExit: new NetworkEvent<{ playerId: number }>('requestMatchExit'),

  // 결과 화면
  requestShowResults: new NetworkEvent<{ playerId: number }>('requestShowResults'),
  playerShowResults: new NetworkEvent<{ player: Player, score: number, placement?: number }>('playerShowResults'),
  returnToLobby: new NetworkEvent<{ player: Player }>('returnToLobby'),

  // =================================================================================
  // Player State & Management
  // =================================================================================
  playerStart: new NetworkEvent<{ player: Player }>('PlayerStartEvent'), // PlayerManager 진입 시점
  playerModeChanged: new NetworkEvent<{ mode: string }>('playerModeChanged'),
  
  // 영구 스탯 (Lobby 표시용 등)
  playerPersistentStatsRequest: new NetworkEvent<{ playerId: number }>('playerPersistentStatsRequest'),
  playerPersistentStatsUpdate: new NetworkEvent<{
    coins: number;
    gems: number;
    bestWaves: number;
    killedSlimes: number;
  }>('playerPersistentStatsUpdate'),

  // 레벨업 및 데이터 업데이트
  playerLevelUp: new NetworkEvent<{ player: Player, level: number, xp: number }>('playerLevelUp'),
  playerDataUpdate: new NetworkEvent<{ ammo : number, hp: number }>('playerDataUpdate'), // (Legacy?)
  playerAmmoUpdate: new NetworkEvent<{ player: Player, ammo : number }>('playerAmmoUpdate'),

  // =================================================================================
  // Combat System
  // =================================================================================
  // Player Health
  playerHPUpdate: new NetworkEvent<{ current: number, max: number }>('playerHPUpdate'),
  playerHit: new NetworkEvent<{ player: Player, damage: number, damageOrigin: Vec3 }>('playerHit'),
  playerDied: new NetworkEvent<{ playerId: number }>('playerDied'),

  // Weapon & Attack (Player -> World)
  weaponEquipped: new NetworkEvent<{ player: Player, weaponKey: string, weaponType: string, isRightHand: boolean }>('weaponEquipped'),
  
  // Melee Attack
  meleeHit: new NetworkEvent<{ hitPos: Vec3, hitNormal: Vec3, fromPlayer: Player, damage: number, weaponType?: string }>('meleeHit'),
  
  // Ranged Attack (Gun)
  playerScoredHit: new NetworkEvent<{ player: Player, entity: Entity }>('playerScoredHit'),
  gunRequestAmmo: new NetworkEvent<{ player: Player, weapon: Entity, ammoCount : number }>('gunRequestAmmo'),
  gunRequestAmmoResponse: new NetworkEvent<{ ammoCount : number }>('gunRequestAmmoResponse'),

  // =================================================================================
  // Enemy Management (Slimes/Monsters)
  // =================================================================================
  monstersInRange: new NetworkEvent<{ entity: Entity, range: number }>('monstersInRange'),
  monstersInRangeResponse: new NetworkEvent<{ monsters: Entity[] }>('monstersInRangeResponse'),

  // =================================================================================
  // Items & Loot
  // =================================================================================
  lootPickup: new NetworkEvent<{ player: Player, loot: string }>('lootPickup'),

  // =================================================================================
  // UI & Audio
  // =================================================================================
  matchPageView: new NetworkEvent<{ enabled: boolean }>('MatchPageViewEvent'),
  lobbyPageView: new NetworkEvent<{ enabled: boolean }>('LobbyPageViewEvent'),
  deathPageView: new NetworkEvent<{ enabled: boolean }>('DeathPageViewEvent'),
  resultPageView: new NetworkEvent<{ enabled: boolean }>('ResultPageViewEvent'),
  levelUpPageView: new NetworkEvent<{ enabled: boolean }>('LevelUpPageViewEvent'),

  loadingProgressUpdate: new NetworkEvent<{ progress: number }>('loadingProgressUpdate'),
  
  // =================================================================================
  // Wave & Sanctum Events
  // =================================================================================
  waveStart: new NetworkEvent<{ wave: number, remainingSeconds: number }>('waveStart'),
  waveTimeUpdate: new NetworkEvent<{ remainingSeconds: number }>('waveTimeUpdate'),
  waveClear: new NetworkEvent<{ wave: number }>('waveClear'),
  coreUnderAttack: new NetworkEvent<{ currentHp: number, maxHp: number }>('coreUnderAttack'),
  coreHit: new NetworkEvent<{ damage: number }>('coreHit'),
  coreDestroyed: new NetworkEvent<{}>('coreDestroyed'),

  playerAudioRequest: new NetworkEvent<{ player: Player, soundId: string }>('playerAudioRequest'),
  
  // =================================================================================
  // System / Controller
  // =================================================================================
  registerLocalPlayerController: new NetworkEvent<{ entity: Entity }>("registerLocalPlayerController"),
};
