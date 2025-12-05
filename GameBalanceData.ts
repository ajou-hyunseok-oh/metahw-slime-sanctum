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

export const WAVE_DURATION_SECONDS = 300;
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
  },
  "blue": {
    maxVisionDistance: 10,
    walkSpeed: 1.2,
    runSpeed: 0.0,
    maxAttackDistance: 5,
    maxAttachReach: 5,
    attackLandDelay: 1000,
    minAttackDamage: 1,
    maxAttackDamage: 2,
    attacksPerSecond: 1,
    minHp: 5,
    maxHp: 8,
    minBulletDamage: 1,
    maxBulletDamage: 1,
    minAxeDamage: 2,
    maxAxeDamage: 2,
    hitStaggerSeconds: 1,
    knockbackMinDamage: 2,
    knockbackMultiplier: 2,
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
  },
};
