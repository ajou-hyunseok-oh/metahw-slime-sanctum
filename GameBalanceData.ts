// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 06, 2025 
export type WavePlan = {
  wave: number;  
  pinkChance: number;
  kingChance: number;
  intervalSeconds: number;
  modelScaling: number;
  damageScaling: number;
  healthScaling: number;  
};

export const WAVE_CORE_HP = 500;
export const WAVE_DURATION_SECONDS = 10;
export const WAVE_DATA: WavePlan[] = [
  { wave: 1, pinkChance: 0.05, kingChance: 0.0, intervalSeconds: 45, modelScaling: 1.0, damageScaling: 1.0, healthScaling: 1.0 },
  { wave: 2, pinkChance: 0.08, kingChance: 0.0, intervalSeconds: 42, modelScaling: 1.05, damageScaling: 1.05, healthScaling: 1.05 },
  { wave: 3, pinkChance: 0.10, kingChance: 0.01, intervalSeconds: 40, modelScaling: 1.1, damageScaling: 1.1, healthScaling: 1.1 },
  { wave: 4, pinkChance: 0.12, kingChance: 0.02, intervalSeconds: 38, modelScaling: 1.15, damageScaling: 1.15, healthScaling: 1.15 },
  { wave: 5, pinkChance: 0.15, kingChance: 0.03, intervalSeconds: 36, modelScaling: 1.2, damageScaling: 1.2, healthScaling: 1.2 },
  { wave: 6, pinkChance: 0.17, kingChance: 0.04, intervalSeconds: 34, modelScaling: 1.25, damageScaling: 1.25, healthScaling: 1.25 },
  { wave: 7, pinkChance: 0.19, kingChance: 0.05, intervalSeconds: 32, modelScaling: 1.3, damageScaling: 1.3, healthScaling: 1.3 },
  { wave: 8, pinkChance: 0.22, kingChance: 0.06, intervalSeconds: 30, modelScaling: 1.35, damageScaling: 1.35, healthScaling: 1.35 },
  { wave: 9, pinkChance: 0.24, kingChance: 0.07, intervalSeconds: 29, modelScaling: 1.4, damageScaling: 1.4, healthScaling: 1.4 },
  { wave: 10, pinkChance: 0.26, kingChance: 0.08, intervalSeconds: 28, modelScaling: 1.45, damageScaling: 1.45, healthScaling: 1.45 },
  { wave: 11, pinkChance: 0.28, kingChance: 0.09, intervalSeconds: 27, modelScaling: 1.5, damageScaling: 1.5, healthScaling: 1.5 },
  { wave: 12, pinkChance: 0.30, kingChance: 0.10, intervalSeconds: 26, modelScaling: 1.55, damageScaling: 1.55, healthScaling: 1.55 },
  { wave: 13, pinkChance: 0.32, kingChance: 0.12, intervalSeconds: 25, modelScaling: 1.6, damageScaling: 1.6, healthScaling: 1.6 },
  { wave: 14, pinkChance: 0.34, kingChance: 0.14, intervalSeconds: 24, modelScaling: 1.65, damageScaling: 1.65, healthScaling: 1.65 },
  { wave: 15, pinkChance: 0.36, kingChance: 0.16, intervalSeconds: 23, modelScaling: 1.7, damageScaling: 1.7, healthScaling: 1.7 },
  { wave: 16, pinkChance: 0.38, kingChance: 0.18, intervalSeconds: 22, modelScaling: 1.75, damageScaling: 1.75, healthScaling: 1.75 },
  { wave: 17, pinkChance: 0.40, kingChance: 0.20, intervalSeconds: 21, modelScaling: 1.8, damageScaling: 1.8, healthScaling: 1.8 },
  { wave: 18, pinkChance: 0.42, kingChance: 0.22, intervalSeconds: 20, modelScaling: 1.85, damageScaling: 1.85, healthScaling: 1.85 },
  { wave: 19, pinkChance: 0.44, kingChance: 0.24, intervalSeconds: 19, modelScaling: 1.9, damageScaling: 1.9, healthScaling: 1.9 },
  { wave: 20, pinkChance: 0.46, kingChance: 0.26, intervalSeconds: 18, modelScaling: 2.0, damageScaling: 2.0, healthScaling: 2.0 },
];

export type SlimeStats = {
  // Movement
  maxVisionDistance: number;
  walkSpeed: number;
  runSpeed: number;

  // Attack
  maxAttackDistance: number;
  maxAttachReach: number;
  attackLandDelay: number;
  minAttackDamage: number;
  maxAttackDamage: number;
  attacksPerSecond: number;

  // HP & Damage
  minHp: number;
  maxHp: number;
  minBulletDamage: number;
  maxBulletDamage: number;
  minAxeDamage: number;
  maxAxeDamage: number;
  hitStaggerSeconds: number;

  // Knockback
  knockbackMinDamage: number;
  knockbackMultiplier: number;

  // Rewards
  xpReward: number;
};

export const SLIME_BASE_STATS: Record<string, SlimeStats> = {
  "default": {
    maxVisionDistance: 7,
    walkSpeed: 1.0,
    runSpeed: 0.0,
    maxAttackDistance: 5,
    maxAttachReach: 5,
    attackLandDelay: 1000,
    minAttackDamage: 1,
    maxAttackDamage: 1,
    attacksPerSecond: 1,
    minHp: 5,
    maxHp: 5,
    minBulletDamage: 1,
    maxBulletDamage: 1,
    minAxeDamage: 2,
    maxAxeDamage: 2,
    hitStaggerSeconds: 1,
    knockbackMinDamage: 2,
    knockbackMultiplier: 2,
    xpReward: 10,
  },
  "blue": {
    maxVisionDistance: 10,
    walkSpeed: 1.2,
    runSpeed: 0.0,
    maxAttackDistance: 5,
    maxAttachReach: 5,
    attackLandDelay: 1000,
    minAttackDamage: 5,
    maxAttackDamage: 5,
    attacksPerSecond: 1,
    minHp: 35,
    maxHp: 35,
    minBulletDamage: 1,
    maxBulletDamage: 1,
    minAxeDamage: 2,
    maxAxeDamage: 2,
    hitStaggerSeconds: 1,
    knockbackMinDamage: 2,
    knockbackMultiplier: 2,
    xpReward: 15,
  },
  "pink": {
    maxVisionDistance: 12,
    walkSpeed: 1.5,
    runSpeed: 0.0,
    maxAttackDistance: 5,
    maxAttachReach: 5,
    attackLandDelay: 800,
    minAttackDamage: 2,
    maxAttackDamage: 4,
    attacksPerSecond: 1.2,
    minHp: 10,
    maxHp: 15,
    minBulletDamage: 1,
    maxBulletDamage: 1,
    minAxeDamage: 2,
    maxAxeDamage: 2,
    hitStaggerSeconds: 0.8,
    knockbackMinDamage: 3,
    knockbackMultiplier: 1.5,
    xpReward: 30,
  },
  "king": {
    maxVisionDistance: 15,
    walkSpeed: 0.8,
    runSpeed: 0.0,
    maxAttackDistance: 6,
    maxAttachReach: 6,
    attackLandDelay: 1500,
    minAttackDamage: 5,
    maxAttackDamage: 10,
    attacksPerSecond: 0.8,
    minHp: 50,
    maxHp: 80,
    minBulletDamage: 1,
    maxBulletDamage: 1,
    minAxeDamage: 2,
    maxAxeDamage: 2,
    hitStaggerSeconds: 0.2,
    knockbackMinDamage: 10,
    knockbackMultiplier: 0.5,
    xpReward: 500,
  },
};


export enum WeaponType {
  Melee = "Melee",
  Ranged = "Ranged",
  Magic = "Magic",
}

export type WeaponCommonStats = {
  attackRange: number;
  attackArcDegrees: number;
  verticalTolerance: number;
  maxTargetsPerShot: number;
  splashRadius: number;
  splashDamage: number;
  splashHeal: number;
};

export const WEAPON_BASE_STATS: Record<WeaponType, WeaponCommonStats> = {
  [WeaponType.Melee]: {
    attackRange: 3,
    attackArcDegrees: 90,
    verticalTolerance: 1.5,
    maxTargetsPerShot: 5,
    splashRadius: 0,
    splashDamage: 0,
    splashHeal: 0,
  },
  [WeaponType.Ranged]: {
    attackRange: 5,
    attackArcDegrees: 90,
    verticalTolerance: 1.5,
    maxTargetsPerShot: 1,
    splashRadius: 0,
    splashDamage: 0,
    splashHeal: 0,
  },
  [WeaponType.Magic]: {
    attackRange: 12,
    attackArcDegrees: 90,
    verticalTolerance: 1.5,
    maxTargetsPerShot: 1,
    splashRadius: 4,
    splashDamage: 1,
    splashHeal: 1,    
  },
};

export type WeaponLevelStats = {
  damage: number;
  cooldown: number;
  splashDamage?: number;
  splashHeal?: number;
  splashRadius?: number;
};

export const WEAPON_LEVEL_DATA: Record<WeaponType, WeaponLevelStats[]> = {
  [WeaponType.Melee]: [
    { damage: 5, cooldown: 1.0 },  // Lv1
    { damage: 6, cooldown: 0.95 }, // Lv2
    { damage: 7, cooldown: 0.9 },  // Lv3
    { damage: 8, cooldown: 0.85 }, // Lv4
    { damage: 10, cooldown: 0.8 }, // Lv5
    { damage: 12, cooldown: 0.75 },// Lv6
    { damage: 14, cooldown: 0.7 }, // Lv7
    { damage: 16, cooldown: 0.65 },// Lv8
    { damage: 19, cooldown: 0.6 }, // Lv9
    { damage: 22, cooldown: 0.5 }, // Lv10
  ],
  [WeaponType.Ranged]: [
    { damage: 8, cooldown: 0.8, splashDamage: 0, splashRadius: 0 },   // Lv1
    { damage: 10, cooldown: 0.75, splashDamage: 0, splashRadius: 0 }, // Lv2
    { damage: 12, cooldown: 0.7, splashDamage: 0, splashRadius: 0 },  // Lv3
    { damage: 15, cooldown: 0.65, splashDamage: 0, splashRadius: 0 }, // Lv4
    { damage: 18, cooldown: 0.6, splashDamage: 1, splashRadius: 1 },  // Lv5 (Splash starts)
    { damage: 22, cooldown: 0.55, splashDamage: 2, splashRadius: 1.5 }, // Lv6
    { damage: 26, cooldown: 0.5, splashDamage: 3, splashRadius: 2 },  // Lv7
    { damage: 31, cooldown: 0.45, splashDamage: 4, splashRadius: 2.5 }, // Lv8
    { damage: 37, cooldown: 0.4, splashDamage: 5, splashRadius: 3 },  // Lv9
    { damage: 45, cooldown: 0.35, splashDamage: 7, splashRadius: 4 }, // Lv10
  ],
  [WeaponType.Magic]: [
    { damage: 8, cooldown: 2.0, splashDamage: 1, splashHeal: 1 },   // Lv1
    { damage: 10, cooldown: 1.9, splashDamage: 2, splashHeal: 2 },  // Lv2
    { damage: 12, cooldown: 1.8, splashDamage: 3, splashHeal: 3 },  // Lv3
    { damage: 14, cooldown: 1.7, splashDamage: 4, splashHeal: 4 },  // Lv4
    { damage: 16, cooldown: 1.6, splashDamage: 5, splashHeal: 5 },  // Lv5
    { damage: 19, cooldown: 1.5, splashDamage: 7, splashHeal: 7 },  // Lv6
    { damage: 22, cooldown: 1.4, splashDamage: 9, splashHeal: 9 },  // Lv7
    { damage: 25, cooldown: 1.3, splashDamage: 11, splashHeal: 11 }, // Lv8
    { damage: 29, cooldown: 1.2, splashDamage: 14, splashHeal: 14 }, // Lv9
    { damage: 34, cooldown: 1.0, splashDamage: 18, splashHeal: 18 }, // Lv10
  ],
};

export function getWeaponStats(type: WeaponType, level: number): WeaponCommonStats & WeaponLevelStats {
  const common = WEAPON_BASE_STATS[type];
  
  // Level 0: No weapon equipped (return dummy stats with 0 damage)
  if (level <= 0) {
    return {
      ...common,
      damage: 0,
      cooldown: 9999, // Effectively unusable
      splashDamage: 0,
      splashHeal: 0,
      splashRadius: 0
    };
  }

  const levels = WEAPON_LEVEL_DATA[type];
  const normalizedLevel = Math.min(Math.max(level, 1), 10); // 1 ~ 10
  const levelStats = levels[normalizedLevel - 1] || levels[0];

  return { ...common, ...levelStats };
}

export type PlayerStats = {
  maxHp: number;
  defense: number; // Damage reduction value
  xpToNextLevel: number;
};

// 50레벨까지의 더미 데이터 (JSON 스타일 상수)
export const PLAYER_LEVEL_DATA: PlayerStats[] = [
  { maxHp: 100, defense: 0, xpToNextLevel: 100 },    // Lv1
  { maxHp: 112, defense: 0, xpToNextLevel: 110 },    // Lv2
  { maxHp: 126, defense: 0, xpToNextLevel: 121 },    // Lv3
  { maxHp: 142, defense: 0, xpToNextLevel: 133 },    // Lv4
  { maxHp: 160, defense: 1, xpToNextLevel: 146 },    // Lv5
  { maxHp: 180, defense: 1, xpToNextLevel: 161 },    // Lv6
  { maxHp: 202, defense: 1, xpToNextLevel: 177 },    // Lv7
  { maxHp: 226, defense: 1, xpToNextLevel: 195 },    // Lv8
  { maxHp: 252, defense: 1, xpToNextLevel: 214 },    // Lv9
  { maxHp: 280, defense: 2, xpToNextLevel: 236 },    // Lv10
  { maxHp: 310, defense: 2, xpToNextLevel: 259 },    // Lv11
  { maxHp: 342, defense: 2, xpToNextLevel: 285 },    // Lv12
  { maxHp: 376, defense: 2, xpToNextLevel: 314 },    // Lv13
  { maxHp: 412, defense: 2, xpToNextLevel: 345 },    // Lv14
  { maxHp: 450, defense: 3, xpToNextLevel: 380 },    // Lv15
  { maxHp: 490, defense: 3, xpToNextLevel: 418 },    // Lv16
  { maxHp: 532, defense: 3, xpToNextLevel: 459 },    // Lv17
  { maxHp: 576, defense: 3, xpToNextLevel: 505 },    // Lv18
  { maxHp: 622, defense: 3, xpToNextLevel: 556 },    // Lv19
  { maxHp: 670, defense: 4, xpToNextLevel: 611 },    // Lv20
  { maxHp: 720, defense: 4, xpToNextLevel: 673 },    // Lv21
  { maxHp: 772, defense: 4, xpToNextLevel: 740 },    // Lv22
  { maxHp: 826, defense: 4, xpToNextLevel: 814 },    // Lv23
  { maxHp: 882, defense: 4, xpToNextLevel: 895 },    // Lv24
  { maxHp: 940, defense: 5, xpToNextLevel: 985 },    // Lv25
  { maxHp: 1000, defense: 5, xpToNextLevel: 1083 },  // Lv26
  { maxHp: 1062, defense: 5, xpToNextLevel: 1192 },  // Lv27
  { maxHp: 1126, defense: 5, xpToNextLevel: 1311 },  // Lv28
  { maxHp: 1192, defense: 5, xpToNextLevel: 1442 },  // Lv29
  { maxHp: 1260, defense: 6, xpToNextLevel: 1586 },  // Lv30
  { maxHp: 1330, defense: 6, xpToNextLevel: 1745 },  // Lv31
  { maxHp: 1402, defense: 6, xpToNextLevel: 1919 },  // Lv32
  { maxHp: 1476, defense: 6, xpToNextLevel: 2111 },  // Lv33
  { maxHp: 1552, defense: 6, xpToNextLevel: 2322 },  // Lv34
  { maxHp: 1630, defense: 7, xpToNextLevel: 2555 },  // Lv35
  { maxHp: 1710, defense: 7, xpToNextLevel: 2810 },  // Lv36
  { maxHp: 1792, defense: 7, xpToNextLevel: 3091 },  // Lv37
  { maxHp: 1876, defense: 7, xpToNextLevel: 3400 },  // Lv38
  { maxHp: 1962, defense: 7, xpToNextLevel: 3740 },  // Lv39
  { maxHp: 2050, defense: 8, xpToNextLevel: 4114 },  // Lv40
  { maxHp: 2140, defense: 8, xpToNextLevel: 4526 },  // Lv41
  { maxHp: 2232, defense: 8, xpToNextLevel: 4978 },  // Lv42
  { maxHp: 2326, defense: 8, xpToNextLevel: 5476 },  // Lv43
  { maxHp: 2422, defense: 8, xpToNextLevel: 6024 },  // Lv44
  { maxHp: 2520, defense: 9, xpToNextLevel: 6626 },  // Lv45
  { maxHp: 2620, defense: 9, xpToNextLevel: 7289 },  // Lv46
  { maxHp: 2722, defense: 9, xpToNextLevel: 8018 },  // Lv47
  { maxHp: 2826, defense: 9, xpToNextLevel: 8819 },  // Lv48
  { maxHp: 2932, defense: 9, xpToNextLevel: 9701 },  // Lv49
  { maxHp: 3040, defense: 10, xpToNextLevel: 10671 },// Lv50
];

export function getPlayerStats(level: number): PlayerStats {
  const normalizedLevel = Math.min(Math.max(level, 1), 50);
  return PLAYER_LEVEL_DATA[normalizedLevel - 1];
}

// Passive Skill Constants
export const PASSIVE_SKILL_DATA = {
  hpBonusPerLevel: 0.10, // 10% increase per level
  defenseBonusPerLevel: 1, // +1 Defense per level
};
