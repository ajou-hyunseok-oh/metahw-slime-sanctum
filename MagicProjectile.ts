import * as hz from 'horizon/core';
import { RangedAttackRequestParams } from 'RangedWeaponEvents';
import { findClosestTargetForPlayer, slimeTargetFilter, TargetCandidate } from 'TargetingUtils';

export type MagicProjectileTarget = {
  agent: TargetCandidate['agent'];
  targetPosition: hz.Vec3;
  delta: hz.Vec3;
};

export class MagicProjectile extends hz.Component<typeof MagicProjectile> {
  static propsDefinition = {};

  start() {}

  static findTargetForPlayer(player: hz.Player, params: RangedAttackRequestParams): MagicProjectileTarget | null {
    const candidate = findClosestTargetForPlayer({
      player,
      range: Math.max(0, params.range),
      arcDegrees: Math.min(Math.max(params.arc, 1), 180),
      verticalTolerance: Math.max(0, params.verticalTolerance),
      maxTargets: Math.max(1, Math.floor(params.maxTargets)),
      filter: slimeTargetFilter,
    });

    if (!candidate) {
      return null;
    }

    return {
      agent: candidate.agent,
      targetPosition: candidate.position,
      delta: candidate.delta,
    };
  }
}
hz.Component.register(MagicProjectile);