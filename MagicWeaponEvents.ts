import * as hz from 'horizon/core';
import { RangedAttackRequestParams } from 'RangedWeaponEvents';

export type MagicAttackRequestParams = RangedAttackRequestParams & {
  effectRadius: number;
};

export type MagicAttackRequestPayload = {
  playerId: number;
  weaponEntityId: string;
  params: MagicAttackRequestParams;
};

export const magicAttackRequestEvent = new hz.NetworkEvent<MagicAttackRequestPayload>('MagicWeaponAttackRequest');

