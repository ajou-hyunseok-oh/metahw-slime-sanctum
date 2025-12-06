import * as hz from 'horizon/core';
import { WeaponType } from 'GameBalanceData';

export type WeaponAttackParams = {
  range: number;
  arc: number;
  verticalTolerance: number;
  maxTargets: number;
  effectRadius: number;
};

export type WeaponAttackRequestPayload = {
  playerId: number;
  weaponEntityId: string;
  weaponType: WeaponType;
  params: WeaponAttackParams;
};

export const weaponAttackRequestEvent = new hz.NetworkEvent<WeaponAttackRequestPayload>('WeaponAttackRequest');