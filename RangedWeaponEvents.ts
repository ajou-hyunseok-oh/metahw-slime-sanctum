import * as hz from 'horizon/core';

export type RangedAttackRequestParams = {
  range: number;
  arc: number;
  verticalTolerance: number;
  maxTargets: number;
};

export type RangedAttackRequestPayload = {
  playerId: number;
  weaponEntityId: string;
  params: RangedAttackRequestParams;
};

export const rangedAttackRequestEvent = new hz.NetworkEvent<RangedAttackRequestPayload>('RangedWeaponAttackRequest');


