import * as hz from 'horizon/core';
import { NpcAgent } from 'NpcAgent';

type AnyNpcAgent = NpcAgent<any>;

const DEG_TO_RAD = Math.PI / 180;
const EPSILON = 1e-4;
const SLIME_CONFIG_NAMES = new Set(['SlimeBlue', 'SlimePink', 'SlimeKing']);
const SLIME_CLASS_NAMES = new Set(['SlimeBlueBrain', 'SlimePinkBrain', 'SlimeKingBrain']);
const SLIME_TAG = 'SLIME';

export type TargetingFilter = (agent: AnyNpcAgent) => boolean;

export function isSlimeAgent(agent: AnyNpcAgent): boolean {
  if (entityHasTag(agent, SLIME_TAG)) {
    return true;
  }

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

export const slimeTargetFilter: TargetingFilter = (agent) => isSlimeAgent(agent);

export type TargetCandidate = {
  agent: AnyNpcAgent;
  position: hz.Vec3;
  delta: hz.Vec3;
  horizontalDistanceSq: number;
};

export type ConeQueryParams = {
  origin: hz.Vec3;
  forward: hz.Vec3;
  range: number;
  arcDegrees: number;
  verticalTolerance: number;
  maxTargets?: number;
  filter?: TargetingFilter;
};

export type PlayerConeQueryParams = Omit<ConeQueryParams, 'origin' | 'forward'> & {
  player: hz.Player;
};

export function findClosestTargetInCone(params: ConeQueryParams): TargetCandidate | null {
  const [prepared, candidates] = prepareAndCollect(params, 1);
  if (!prepared || candidates.length === 0) {
    return null;
  }
  return candidates[0];
}

export function collectTargetsInCone(params: ConeQueryParams): TargetCandidate[] {
  const [, candidates] = prepareAndCollect(params, params.maxTargets);
  return candidates;
}

export function findClosestTargetForPlayer(params: PlayerConeQueryParams): TargetCandidate | null {
  const query = buildConeQueryFromPlayer(params);
  return findClosestTargetInCone(query);
}

export function collectTargetsForPlayer(params: PlayerConeQueryParams): TargetCandidate[] {
  const query = buildConeQueryFromPlayer(params);
  return collectTargetsInCone(query);
}

function buildConeQueryFromPlayer(params: PlayerConeQueryParams): ConeQueryParams {
  const origin = params.player.position.get();
  const forward = params.player.forward.get();
  return {
    origin,
    forward,
    range: params.range,
    arcDegrees: params.arcDegrees,
    verticalTolerance: params.verticalTolerance,
    maxTargets: params.maxTargets,
    filter: params.filter,
  };
}

type PreparedParams = {
  origin: hz.Vec3;
  forward: hz.Vec3;
  cosHalfArc: number;
  rangeSq: number;
  verticalTolerance: number;
  maxTargets?: number;
  filter?: TargetingFilter;
};

function prepareAndCollect(params: ConeQueryParams, overrideMaxTargets?: number): [PreparedParams | null, TargetCandidate[]] {
  const forward = normalizeFlatForward(params.forward);
  if (!forward) {
    return [null, []];
  }

  const range = Math.max(0, params.range);
  const arc = Math.min(Math.max(params.arcDegrees, 1), 180);
  const verticalTolerance = Math.max(0, params.verticalTolerance);
  const cosHalfArc = Math.cos((arc * DEG_TO_RAD) * 0.5);
  const rangeSq = range * range;
  const maxTargets = overrideMaxTargets ?? params.maxTargets;

  const prepared: PreparedParams = {
    origin: params.origin,
    forward,
    cosHalfArc,
    rangeSq,
    verticalTolerance,
    maxTargets,
    filter: params.filter,
  };

  const candidates = collectPreparedTargets(prepared);
  return [prepared, candidates];
}

function collectPreparedTargets(prepared: PreparedParams): TargetCandidate[] {
  const results: TargetCandidate[] = [];
  const limit = prepared.maxTargets ? Math.max(1, Math.floor(prepared.maxTargets)) : undefined;
  const filter = prepared.filter ?? (() => true);

  for (const agent of NpcAgent.getActiveAgents()) {
    if (agent.isDead) {
      continue;
    }

    if (!filter(agent)) {
      continue;
    }

    const targetPosition = agent.entity.position.get();
    const deltaX = targetPosition.x - prepared.origin.x;
    const deltaY = targetPosition.y - prepared.origin.y;
    const deltaZ = targetPosition.z - prepared.origin.z;

    if (Math.abs(deltaY) > prepared.verticalTolerance) {
      continue;
    }

    const horizontalDistanceSq = deltaX * deltaX + deltaZ * deltaZ;
    if (horizontalDistanceSq > prepared.rangeSq) {
      continue;
    }

    const normalizedDot = getNormalizedDot(prepared.forward, deltaX, deltaZ, horizontalDistanceSq);
    if (normalizedDot < prepared.cosHalfArc) {
      continue;
    }

    results.push({
      agent,
      position: targetPosition,
      delta: new hz.Vec3(deltaX, deltaY, deltaZ),
      horizontalDistanceSq,
    });
  }

  results.sort((a, b) => a.horizontalDistanceSq - b.horizontalDistanceSq);

  if (limit !== undefined && results.length > limit) {
    return results.slice(0, limit);
  }
  return results;
}

function normalizeFlatForward(forward: hz.Vec3): hz.Vec3 | null {
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

type TagSetLike = {
  has(value: string): boolean;
};

function entityHasTag(agent: AnyNpcAgent, tag: string): boolean {
  try {
    const tags = agent.entity.tags;
    if (!tags) {
      return false;
    }
    if (isTagSetLike(tags)) {
      return tags.has(tag);
    }
    if (Array.isArray(tags)) {
      return tags.includes(tag);
    }
    if (isTagRecord(tags)) {
      return Boolean(tags[tag]);
    }
    return false;
  } catch {
    return false;
  }
}

function isTagSetLike(value: unknown): value is TagSetLike {
  return Boolean(value) && typeof (value as TagSetLike).has === 'function';
}

function isTagRecord(value: unknown): value is Record<string, boolean | undefined> {
  return typeof value === 'object' && value !== null;
}

function getNormalizedDot(forward: hz.Vec3, deltaX: number, deltaZ: number, horizontalDistanceSq: number): number {
  if (horizontalDistanceSq <= EPSILON) {
    return 1;
  }
  const invDistance = 1 / Math.sqrt(horizontalDistanceSq);
  return (deltaX * forward.x + deltaZ * forward.z) * invDistance;
}

