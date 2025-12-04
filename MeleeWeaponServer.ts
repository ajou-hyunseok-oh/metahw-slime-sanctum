import * as hz from 'horizon/core';
import { Behaviour } from 'Behaviour';
import { Events } from 'Events';
import { NpcAgent } from 'NpcAgent';
import { MatchStateManager } from 'MatchStateManager';
import { meleeAttackRequestEvent, MeleeAttackRequestPayload, MeleeAttackRequestParams } from 'MeleeWeaponEvents';
import { collectTargetsForPlayer, slimeTargetFilter } from 'TargetingUtils';

type AnyNpcAgent = NpcAgent<any>;

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
    const stats = this.getMatchStatsOrWarn(player, payload.weaponEntityId);
    if (!stats) {
      return;
    }

    const meleeDamage = this.getMeleeDamageForLevel(stats.meleeAttackLevel ?? 1);
    if (params.range <= 0 || params.maxTargets <= 0) {
      return;
    }

    const candidates = collectTargetsForPlayer({
      player,
      range: params.range,
      arcDegrees: params.arc,
      verticalTolerance: params.verticalTolerance,
      maxTargets: params.maxTargets,
      filter: slimeTargetFilter,
    });

    let appliedHits = 0;
    for (const candidate of candidates) {
      this.emitHitEvent(
        candidate.agent,
        player,
        candidate.position,
        candidate.delta.x,
        candidate.delta.y,
        candidate.delta.z,
        meleeDamage
      );
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

  private normalizeParams(params: MeleeAttackRequestParams): MeleeAttackRequestParams {
    const range = Math.max(0, params.range);
    const arc = Math.min(Math.max(params.arc, 1), 180);
    const verticalTolerance = Math.max(0, params.verticalTolerance);
    const maxTargets = Math.max(1, Math.floor(params.maxTargets));
    return { range, arc, verticalTolerance, maxTargets };
  }

  private getMatchStatsOrWarn(player: hz.Player, weaponEntityId: string): ReturnType<MatchStateManager['getStats']> {
    const manager = MatchStateManager.instance;
    if (!manager) {
      console.warn(`[MeleeWeaponServer] MatchStateManager instance is unavailable; ignoring attack for player=${player.id} weapon=${weaponEntityId}.`);
      return undefined;
    }

    const stats = manager.getStats(player);
    if (!stats) {
      console.warn(`[MeleeWeaponServer] Match stats missing for player=${player.id}; ignoring attack for weapon=${weaponEntityId}.`);
      return undefined;
    }

    return stats;
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

