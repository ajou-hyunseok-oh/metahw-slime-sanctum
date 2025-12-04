import * as hz from 'horizon/core';
import { Behaviour } from 'Behaviour';
import { Events } from 'Events';
import { MatchStateManager } from 'MatchStateManager';
import { NpcAgent } from 'NpcAgent';
import { rangedAttackRequestEvent, RangedAttackRequestPayload, RangedAttackRequestParams } from 'RangedWeaponEvents';
import { findClosestTargetForPlayer, slimeTargetFilter } from 'TargetingUtils';

type AnyNpcAgent = NpcAgent<any>;

const EPSILON = 1e-4;
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
    const stats = this.getMatchStatsOrWarn(player, payload.weaponEntityId);
    if (!stats) {
      return;
    }
    const rangedDamage = this.getRangedDamageForLevel(stats.rangedAttackLevel ?? 1);
    if (params.range <= 0 || params.maxTargets <= 0) {
      return;
    }

    const closestTarget = findClosestTargetForPlayer({
      player,
      range: params.range,
      arcDegrees: params.arc,
      verticalTolerance: params.verticalTolerance,
      maxTargets: params.maxTargets,
      filter: slimeTargetFilter,
    });
    if (!closestTarget) {
      console.log(`[RangedWeaponServer] player=${player.id} weapon=${payload.weaponEntityId} hits=0`);
      return;
    }

    this.emitHitEvent(
      closestTarget.agent,
      player,
      closestTarget.position,
      closestTarget.delta.x,
      closestTarget.delta.y,
      closestTarget.delta.z,
      rangedDamage
    );
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

  private normalizeParams(params: RangedAttackRequestParams): RangedAttackRequestParams {
    const range = Math.max(0, params.range);
    const arc = Math.min(Math.max(params.arc, 1), 180);
    const verticalTolerance = Math.max(0, params.verticalTolerance);
    const maxTargets = Math.max(1, Math.floor(params.maxTargets));
    return { range, arc, verticalTolerance, maxTargets };
  }

  private getMatchStatsOrWarn(player: hz.Player, weaponEntityId: string): ReturnType<MatchStateManager['getStats']> {
    const manager = MatchStateManager.instance;
    if (!manager) {
      console.warn(`[RangedWeaponServer] MatchStateManager instance is unavailable; ignoring attack for player=${player.id} weapon=${weaponEntityId}.`);
      return undefined;
    }

    const stats = manager.getStats(player);
    if (!stats) {
      console.warn(`[RangedWeaponServer] Match stats missing for player=${player.id}; ignoring attack for weapon=${weaponEntityId}.`);
      return undefined;
    }

    return stats;
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

}

hz.Component.register(RangedWeaponServer);


