import * as hz from 'horizon/core';
import { Behaviour } from 'Behaviour';
import { Events } from 'Events';
import { MatchStateManager } from 'MatchStateManager';
import { NpcAgent } from 'NpcAgent';
import { MagicProjectile, isSlimeAgent } from 'MagicProjectile';
import {
  magicAttackRequestEvent,
  MagicAttackRequestParams,
  MagicAttackRequestPayload,
} from 'MagicWeaponEvents';

const EPSILON = 1e-4;
const MAGIC_DAMAGE_TABLE: { [level: number]: number } = {
  1: 6,
  2: 7,
  3: 8,
  4: 9,
  5: 10,
  6: 11,
  7: 12,
  8: 13,
  9: 14,
  10: 15,
};

const MAGIC_HEAL_TABLE: { [level: number]: number } = {
  1: 4,
  2: 5,
  3: 6,
  4: 7,
  5: 8,
  6: 9,
  7: 10,
  8: 11,
  9: 12,
  10: 13,
};

class MagicWeaponServer extends Behaviour<typeof MagicWeaponServer> {
  static propsDefinition = {
    maxEnemiesAffected: { type: hz.PropTypes.Number, default: 5 },
    maxPlayersHealed: { type: hz.PropTypes.Number, default: 4 },
    maxEffectRadius: { type: hz.PropTypes.Number, default: 12 },
  };

  start() {
    if (!this.isServerContext()) {
      console.warn('[MagicWeaponServer] 실행 권한이 서버가 아닙니다.');
      return;
    }

    this.connectNetworkBroadcastEvent(magicAttackRequestEvent, (payload) => this.handleAttackRequest(payload));
  }

  private handleAttackRequest(payload: MagicAttackRequestPayload) {
    const player = this.world.getPlayers().find((candidate) => candidate.id === payload.playerId);
    if (!player) {
      return;
    }

    this.resolveMagicImpact(player, payload);
  }

  private resolveMagicImpact(player: hz.Player, payload: MagicAttackRequestPayload) {
    const params = this.normalizeParams(payload.params);
    const target = MagicProjectile.findTargetForPlayer(player, {
      range: params.range,
      arc: params.arc,
      verticalTolerance: params.verticalTolerance,
      maxTargets: params.maxTargets,
    });

    if (!target) {
      console.log(`[MagicWeaponServer] player=${player.id} weapon=${payload.weaponEntityId} target=none`);
      return;
    }

    const damageAmount = this.getMagicDamageForPlayer(player);
    const healAmount = this.getMagicHealForPlayer(player);
    const impactNormal = this.buildHitNormal(target.delta.x, target.delta.y, target.delta.z);

    const damaged = this.damageEnemiesWithinRadius(target.targetPosition, params.effectRadius, player, damageAmount);
    const healed = this.healPlayersWithinRadius(target.targetPosition, params.effectRadius, healAmount);

    this.sendNetworkBroadcastEvent(Events.projectileHit, {
      hitPos: target.targetPosition,
      hitNormal: impactNormal,
      fromPlayer: player,
    });

    console.log(
      `[MagicWeaponServer] player=${player.id} weapon=${payload.weaponEntityId} damageHits=${damaged} healedPlayers=${healed}`
    );
  }

  private damageEnemiesWithinRadius(
    center: hz.Vec3,
    radius: number,
    player: hz.Player,
    damageAmount: number
  ): number {
    if (damageAmount <= 0) {
      return 0;
    }

    const radiusSq = radius * radius;
    const maxHits = this.getMaxEnemiesAffected();
    let applied = 0;

    for (const agent of NpcAgent.getActiveAgents()) {
      if (applied >= maxHits) {
        break;
      }

      if (agent.isDead || !isSlimeAgent(agent)) {
        continue;
      }

      const targetPosition = agent.entity.position.get();
      const deltaX = targetPosition.x - center.x;
      const deltaY = targetPosition.y - center.y;
      const deltaZ = targetPosition.z - center.z;
      const distanceSq = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ;

      if (distanceSq > radiusSq) {
        continue;
      }

      const hitNormal = this.buildHitNormal(deltaX, deltaY, deltaZ);
      this.sendNetworkEvent(agent.entity, Events.meleeHit, {
        hitPos: targetPosition,
        hitNormal,
        fromPlayer: player,
        damage: damageAmount,
      });

      applied += 1;
    }

    return applied;
  }

  private healPlayersWithinRadius(center: hz.Vec3, radius: number, healAmount: number): number {
    if (healAmount <= 0) {
      return 0;
    }

    const manager = MatchStateManager.instance;
    if (!manager) {
      console.warn('[MagicWeaponServer] MatchStateManager 인스턴스를 찾을 수 없습니다.');
      return 0;
    }

    const radiusSq = radius * radius;
    const maxHeals = this.getMaxPlayersHealed();
    let healed = 0;

    for (const candidate of this.world.getPlayers()) {
      if (healed >= maxHeals) {
        break;
      }

      const stats = manager.getStats(candidate);
      if (!stats) {
        continue;
      }

      const position = candidate.position.get();
      const deltaX = position.x - center.x;
      const deltaY = position.y - center.y;
      const deltaZ = position.z - center.z;
      const distanceSq = deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ;

      if (distanceSq > radiusSq) {
        continue;
      }

      manager.adjustHp(candidate, healAmount);
      healed += 1;
    }

    return healed;
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

  private normalizeParams(params: MagicAttackRequestParams): MagicAttackRequestParams {
    const range = Math.max(0, params.range);
    const arc = Math.min(Math.max(params.arc, 1), 180);
    const verticalTolerance = Math.max(0, params.verticalTolerance);
    const maxTargets = Math.max(1, Math.floor(params.maxTargets));
    const effectRadius = this.clamp(params.effectRadius, 0.5, this.getMaxEffectRadius());

    return {
      range,
      arc,
      verticalTolerance,
      maxTargets,
      effectRadius,
    };
  }

  private getMagicDamageForPlayer(player: hz.Player): number {
    const stats = MatchStateManager.instance?.getStats(player);
    const level = stats?.magicAttackLevel ?? 1;
    return this.lookupProgressionValue(MAGIC_DAMAGE_TABLE, level);
  }

  private getMagicHealForPlayer(player: hz.Player): number {
    const stats = MatchStateManager.instance?.getStats(player);
    const level = stats?.magicAttackLevel ?? 1;
    return this.lookupProgressionValue(MAGIC_HEAL_TABLE, level);
  }

  private lookupProgressionValue(table: { [level: number]: number }, level: number): number {
    const normalizedLevel = Math.max(1, Math.floor(level));
    if (table[normalizedLevel] !== undefined) {
      return table[normalizedLevel];
    }

    const definedLevels = Object.keys(table).map((key) => Number(key));
    const maxDefinedLevel = Math.max(...definedLevels);
    const maxDefinedValue = table[maxDefinedLevel];
    const extraLevels = normalizedLevel - maxDefinedLevel;
    return maxDefinedValue + extraLevels;
  }

  private getMaxEnemiesAffected(): number {
    const configured = (this.props as { maxEnemiesAffected?: number }).maxEnemiesAffected;
    return Math.max(1, Math.floor(configured ?? MagicWeaponServer.propsDefinition.maxEnemiesAffected.default));
  }

  private getMaxPlayersHealed(): number {
    const configured = (this.props as { maxPlayersHealed?: number }).maxPlayersHealed;
    return Math.max(1, Math.floor(configured ?? MagicWeaponServer.propsDefinition.maxPlayersHealed.default));
  }

  private getMaxEffectRadius(): number {
    const configured = (this.props as { maxEffectRadius?: number }).maxEffectRadius;
    return Math.max(0.5, configured ?? MagicWeaponServer.propsDefinition.maxEffectRadius.default);
  }

  private clamp(value: number, min: number, max: number): number {
    if (Number.isNaN(value)) {
      return min;
    }
    return Math.max(min, Math.min(max, value));
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

hz.Component.register(MagicWeaponServer);

