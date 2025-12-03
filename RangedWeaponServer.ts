import * as hz from 'horizon/core';
import { Behaviour } from 'Behaviour';
import { Events } from 'Events';
import { NpcAgent } from 'NpcAgent';
import { MatchStateManager } from 'MatchStateManager';
import { rangedAttackRequestEvent, RangedAttackRequestPayload, RangedAttackRequestParams } from 'RangedWeaponEvents';

type AnyNpcAgent = NpcAgent<any>;

const DEG_TO_RAD = Math.PI / 180;
const EPSILON = 1e-4;
const SLIME_CONFIG_NAMES = new Set(['SlimeBlue', 'SlimePink', 'SlimeKing']);
const SLIME_CLASS_NAMES = new Set(['SlimeBlueBrain', 'SlimePinkBrain', 'SlimeKingBrain']);
const RANGED_DAMAGE_TABLE: { [level: number]: number } = {
  1: 5,
  2: 6,
  3: 7,
  4: 8,
  5: 9,
  6: 10,
  7: 11,
  8: 12,
  9: 13,
  10: 14,
};

class RangedWeaponServer extends Behaviour<typeof RangedWeaponServer> {
  start() {
    if (!this.isServerContext()) {
      console.warn('[RangedWeaponServer] Executed without server authority.');
      return;
    }

    this.connectNetworkBroadcastEvent(rangedAttackRequestEvent, (payload) => this.handleAttackRequest(payload));
  }

  private handleAttackRequest(payload: RangedAttackRequestPayload) {
    const player = this.world.getPlayers().find((candidate) => candidate.id === payload.playerId);
    if (!player) {
      return;
    }
    this.resolveRangedShot(player, payload);
  }

  private resolveRangedShot(player: hz.Player, payload: RangedAttackRequestPayload) {
    const params = this.normalizeParams(payload.params);
    const rangedDamage = this.getRangedDamageForPlayer(player);
    if (params.range <= 0 || params.maxTargets <= 0) {
      return;
    }

    const normalizedForward = this.getNormalizedFlatForward(player);
    if (!normalizedForward) {
      return;
    }

    const origin = player.position.get();
    const cosHalfArc = Math.cos((params.arc * DEG_TO_RAD) * 0.5);
    const rangeSq = params.range * params.range;

    const closestTarget = this.findClosestSlimeTarget(origin, normalizedForward, cosHalfArc, rangeSq, params.verticalTolerance);
    if (!closestTarget) {
      console.log(`[RangedWeaponServer] player=${player.id} weapon=${payload.weaponEntityId} hits=0`);
      return;
    }

    const { agent, targetPosition, deltaX, deltaY, deltaZ } = closestTarget;
    this.emitHitEvent(agent, player, targetPosition, deltaX, deltaY, deltaZ, rangedDamage);
    console.log(`[RangedWeaponServer] player=${player.id} weapon=${payload.weaponEntityId} hits=1`);
  }

  private emitHitEvent(agent: AnyNpcAgent, player: hz.Player, targetPosition: hz.Vec3, deltaX: number, deltaY: number, deltaZ: number, damage: number) {
    const hitNormal = this.buildHitNormal(deltaX, deltaY, deltaZ);
    this.sendNetworkEvent(agent.entity, Events.meleeHit, {
      hitPos: targetPosition,
      hitNormal,
      fromPlayer: player,
      damage,
    });
  }

  private buildHitNormal(deltaX: number, deltaY: number, deltaZ: number): hz.Vec3 {
    const normal = new hz.Vec3(-deltaX, -deltaY, -deltaZ);
    const magnitudeSq = normal.x * normal.x + normal.y * normal.y + normal.z * normal.z;
    if (magnitudeSq <= EPSILON) {
      normal.x = 0;
      normal.y = 1;
      normal.z = 0;
      return normal;
    }

    const invMagnitude = 1 / Math.sqrt(magnitudeSq);
    normal.x *= invMagnitude;
    normal.y *= invMagnitude;
    normal.z *= invMagnitude;
    return normal;
  }

  private getNormalizedFlatForward(player: hz.Player): hz.Vec3 | null {
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

  private getNormalizedDot(forward: hz.Vec3, deltaX: number, deltaZ: number, horizontalDistanceSq: number): number {
    if (horizontalDistanceSq <= EPSILON) {
      return 1;
    }
    const invDistance = 1 / Math.sqrt(horizontalDistanceSq);
    return (deltaX * forward.x + deltaZ * forward.z) * invDistance;
  }

  private normalizeParams(params: RangedAttackRequestParams): RangedAttackRequestParams {
    const range = Math.max(0, params.range);
    const arc = Math.min(Math.max(params.arc, 1), 180);
    const verticalTolerance = Math.max(0, params.verticalTolerance);
    const maxTargets = Math.max(1, Math.floor(params.maxTargets));
    return { range, arc, verticalTolerance, maxTargets };
  }

  private getRangedDamageForPlayer(player: hz.Player): number {
    const stats = MatchStateManager.instance?.getStats(player);
    const level = stats?.rangedAttackLevel ?? 1;
    return this.getRangedDamageForLevel(level);
  }

  private getRangedDamageForLevel(level: number): number {
    const normalizedLevel = Math.max(1, Math.floor(level));
    if (RANGED_DAMAGE_TABLE[normalizedLevel] !== undefined) {
      return RANGED_DAMAGE_TABLE[normalizedLevel];
    }

    const definedLevels = Object.keys(RANGED_DAMAGE_TABLE).map((key) => Number(key));
    const maxDefinedLevel = Math.max(...definedLevels);
    const maxDefinedDamage = RANGED_DAMAGE_TABLE[maxDefinedLevel];
    const extraLevels = normalizedLevel - maxDefinedLevel;
    return maxDefinedDamage + extraLevels;
  }

  private isServerContext(): boolean {
    try {
      const local = this.world.getLocalPlayer();
      const server = this.world.getServerPlayer();
      return local?.id === server?.id;
    } catch {
      return false;
    }
  }

  private findClosestSlimeTarget(origin: hz.Vec3, forward: hz.Vec3, cosHalfArc: number, rangeSq: number, verticalTolerance: number) {
    let closestAgent: AnyNpcAgent | null = null;
    let closestPosition: hz.Vec3 | null = null;
    let closestDelta: { x: number; y: number; z: number } | null = null;
    let closestDistanceSq = Number.POSITIVE_INFINITY;

    for (const agent of NpcAgent.getActiveAgents()) {
      if (agent.isDead || !this.isSlimeAgent(agent)) {
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

  private isSlimeAgent(agent: AnyNpcAgent): boolean {
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
}

hz.Component.register(RangedWeaponServer);


