import * as hz from 'horizon/core';

export type MeleeAttackRequestParams = {
  range: number;
  arc: number;
  verticalTolerance: number;
  maxTargets: number;
};

export type MeleeAttackRequestPayload = {
  playerId: number;
  weaponEntityId: string;
  params: MeleeAttackRequestParams;
};

export const meleeAttackRequestEvent = new hz.NetworkEvent<MeleeAttackRequestPayload>('MeleeWeaponAttackRequest');

