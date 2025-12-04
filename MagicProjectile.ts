import * as hz from 'horizon/core';
import { NpcAgent } from 'NpcAgent';
import { RangedAttackRequestParams } from 'RangedWeaponEvents';

type AnyNpcAgent = NpcAgent<any>;

const DEG_TO_RAD = Math.PI / 180;
const EPSILON = 1e-4;
const SLIME_CONFIG_NAMES = new Set(['SlimeBlue', 'SlimePink', 'SlimeKing']);
const SLIME_CLASS_NAMES = new Set(['SlimeBlueBrain', 'SlimePinkBrain', 'SlimeKingBrain']);

export type MagicProjectileTarget = {
  agent: AnyNpcAgent;
  targetPosition: hz.Vec3;
  delta: hz.Vec3;
};

export class MagicProjectile extends hz.Component<typeof MagicProjectile> {
  static propsDefinition = {};

  start() {}

  /**
   * Resolves the firing solution using the same targeting rules as the ranged weapon server.
   * Returns the closest slime within the configured cone, or null if none are found.
   */
  static findTargetForPlayer(player: hz.Player, params: RangedAttackRequestParams): MagicProjectileTarget | null {
    const normalizedParams = this.normalizeParams(params);
    if (normalizedParams.range <= 0 || normalizedParams.maxTargets <= 0) {
      return null;
    }

    const forward = this.getNormalizedFlatForward(player);
    if (!forward) {
      return null;
    }

    const origin = player.position.get();
    const cosHalfArc = Math.cos((normalizedParams.arc * DEG_TO_RAD) * 0.5);
    const rangeSq = normalizedParams.range * normalizedParams.range;

    const closest = this.findClosestSlimeTarget(
      origin,
      forward,
      cosHalfArc,
      rangeSq,
      normalizedParams.verticalTolerance
    );

    if (!closest) {
      return null;
    }

    return {
      agent: closest.agent,
      targetPosition: closest.targetPosition,
      delta: new hz.Vec3(closest.deltaX, closest.deltaY, closest.deltaZ),
    };
  }

  private static normalizeParams(params: RangedAttackRequestParams): RangedAttackRequestParams {
    const range = Math.max(0, params.range);
    const arc = Math.min(Math.max(params.arc, 1), 180);
    const verticalTolerance = Math.max(0, params.verticalTolerance);
    const maxTargets = Math.max(1, Math.floor(params.maxTargets));
    return { range, arc, verticalTolerance, maxTargets };
  }

  private static getNormalizedFlatForward(player: hz.Player): hz.Vec3 | null {
    const forward = player.forward.get();
    const flatForward = new hz.Vec3(forward.x, 0, forward.z);
    const magnitudeSq = flatForward.x * flatForward.x + flatForward.z * flatForward.z;

    if (magnitudeSq <= EPSILON) {
      return null;
    }

    const invMagnitude = 1 / Math.sqrt(magnitudeSq);
    flatForward.x *= invMagnitude;
    flatForward.z *= invMagnitude;
    return flatForward;
  }

  private static findClosestSlimeTarget(
    origin: hz.Vec3,
    forward: hz.Vec3,
    cosHalfArc: number,
    rangeSq: number,
    verticalTolerance: number
  ) {
    let closestAgent: AnyNpcAgent | null = null;
    let closestPosition: hz.Vec3 | null = null;
    let closestDelta: { x: number; y: number; z: number } | null = null;
    let closestDistanceSq = Number.POSITIVE_INFINITY;

    for (const agent of NpcAgent.getActiveAgents()) {
      if (agent.isDead || !isSlimeAgent(agent)) {
        continue;
      }

      const targetPosition = agent.entity.position.get();
      const deltaX = targetPosition.x - origin.x;
      const deltaY = targetPosition.y - origin.y;
      const deltaZ = targetPosition.z - origin.z;

      if (Math.abs(deltaY) > verticalTolerance) {
        continue;
      }

      const horizontalDistanceSq = deltaX * deltaX + deltaZ * deltaZ;
      if (horizontalDistanceSq > rangeSq || horizontalDistanceSq >= closestDistanceSq) {
        continue;
      }

      const normalizedDot = this.getNormalizedDot(forward, deltaX, deltaZ, horizontalDistanceSq);
      if (normalizedDot < cosHalfArc) {
        continue;
      }

      closestAgent = agent;
      closestPosition = targetPosition;
      closestDelta = { x: deltaX, y: deltaY, z: deltaZ };
      closestDistanceSq = horizontalDistanceSq;

      if (closestDistanceSq <= EPSILON) {
        break;
      }
    }

    if (!closestAgent || !closestPosition || !closestDelta) {
      return null;
    }

    return {
      agent: closestAgent,
      targetPosition: closestPosition,
      deltaX: closestDelta.x,
      deltaY: closestDelta.y,
      deltaZ: closestDelta.z,
    };
  }

  private static getNormalizedDot(
    forward: hz.Vec3,
    deltaX: number,
    deltaZ: number,
    horizontalDistanceSq: number
  ): number {
    if (horizontalDistanceSq <= EPSILON) {
      return 1;
    }
    const invDistance = 1 / Math.sqrt(horizontalDistanceSq);
    return (deltaX * forward.x + deltaZ * forward.z) * invDistance;
  }

}
hz.Component.register(MagicProjectile);

export function isSlimeAgent(agent: AnyNpcAgent): boolean {
  const ctorName = agent.constructor?.name;
  if (typeof ctorName === 'string' && SLIME_CLASS_NAMES.has(ctorName)) {
    return true;
  }

  const configName = (agent.props as { configName?: string } | undefined)?.configName;
  if (typeof configName === 'string' && SLIME_CONFIG_NAMES.has(configName)) {
    return true;
  }

  return false;
}