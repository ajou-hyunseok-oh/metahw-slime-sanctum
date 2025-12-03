import * as hz from 'horizon/core';
import { Behaviour } from 'Behaviour';
import { Events } from 'Events';
import { NpcAgent } from 'NpcAgent';
import { MatchStateManager } from 'MatchStateManager';
import { meleeAttackRequestEvent, MeleeAttackRequestPayload, MeleeAttackRequestParams } from 'MeleeWeaponEvents';

type AnyNpcAgent = NpcAgent<any>;

const DEG_TO_RAD = Math.PI / 180;
const EPSILON = 1e-4;
const MELEE_DAMAGE_TABLE: { [level: number]: number } = {
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

class MeleeWeaponServer extends Behaviour<typeof MeleeWeaponServer> {
  start() {
    if (!this.isServerContext()) {
      console.warn('[MeleeWeaponServer] 서버 권한이 아닌 컨텍스트에서 실행되고 있습니다.');
      return;
    }

    this.connectNetworkBroadcastEvent(meleeAttackRequestEvent, (payload) => this.handleAttackRequest(payload));
  }

  private handleAttackRequest(payload: MeleeAttackRequestPayload) {
    const player = this.world.getPlayers().find((candidate) => candidate.id === payload.playerId);
    if (!player) {
      return;
    }
    this.resolveMeleeSwing(player, payload);
  }

  private resolveMeleeSwing(player: hz.Player, payload: MeleeAttackRequestPayload) {
    const params = this.normalizeParams(payload.params);
    const meleeDamage = this.getMeleeDamageForPlayer(player);
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

    let appliedHits = 0;
    for (const agent of NpcAgent.getActiveAgents()) {
      if (appliedHits >= params.maxTargets) {
        break;
      }

      if (agent.isDead) {
        continue;
      }

      const targetPosition = agent.entity.position.get();
      const deltaX = targetPosition.x - origin.x;
      const deltaY = targetPosition.y - origin.y;
      const deltaZ = targetPosition.z - origin.z;

      if (Math.abs(deltaY) > params.verticalTolerance) {
        continue;
      }

      const horizontalDistanceSq = deltaX * deltaX + deltaZ * deltaZ;
      if (horizontalDistanceSq > rangeSq) {
        continue;
      }

      const normalizedDot = this.getNormalizedDot(normalizedForward, deltaX, deltaZ, horizontalDistanceSq);
      if (normalizedDot < cosHalfArc) {
        continue;
      }

      this.emitHitEvent(agent, player, targetPosition, deltaX, deltaY, deltaZ, meleeDamage);
      appliedHits += 1;
    }

    console.log(`[MeleeWeaponServer] player=${player.id} weapon=${payload.weaponEntityId} hits=${appliedHits}`);
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

  private normalizeParams(params: MeleeAttackRequestParams): MeleeAttackRequestParams {
    const range = Math.max(0, params.range);
    const arc = Math.min(Math.max(params.arc, 1), 180);
    const verticalTolerance = Math.max(0, params.verticalTolerance);
    const maxTargets = Math.max(1, Math.floor(params.maxTargets));
    return { range, arc, verticalTolerance, maxTargets };
  }

  private getMeleeDamageForPlayer(player: hz.Player): number {
    const stats = MatchStateManager.instance?.getStats(player);
    const level = stats?.meleeAttackLevel ?? 1;
    return this.getMeleeDamageForLevel(level);
  }

  private getMeleeDamageForLevel(level: number): number {
    const normalizedLevel = Math.max(1, Math.floor(level));
    if (MELEE_DAMAGE_TABLE[normalizedLevel] !== undefined) {
      return MELEE_DAMAGE_TABLE[normalizedLevel];
    }

    const definedLevels = Object.keys(MELEE_DAMAGE_TABLE).map((key) => Number(key));
    const maxDefinedLevel = Math.max(...definedLevels);
    const maxDefinedDamage = MELEE_DAMAGE_TABLE[maxDefinedLevel];
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
}

hz.Component.register(MeleeWeaponServer);

