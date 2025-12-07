// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 06, 2025

import * as hz from 'horizon/core';
import { Behaviour } from 'Behaviour';
import { Events } from 'Events';
import { MatchStateManager } from 'MatchStateManager';
import { SlimeAgent } from 'SlimeAgent';
import { findClosestTargetForPlayer, collectTargetsForPlayer, slimeTargetFilter, isSlimeAgent } from 'TargetingUtils';
import { weaponAttackRequestEvent, WeaponAttackRequestPayload } from 'WeaponEvents';
import { WeaponType, getWeaponStats } from 'GameBalanceData';

type AnySlimeAgent = SlimeAgent;

const EPSILON = 1e-4;

export class WeaponServer extends Behaviour<typeof WeaponServer> {
  static propsDefinition = {
    maxEnemiesAffected: { type: hz.PropTypes.Number, default: 5 },
    maxPlayersHealed: { type: hz.PropTypes.Number, default: 4 },
  };

  start() {
    console.log('[WeaponServer] start() called');
    if (!this.isServerContext()) {
      console.warn('[WeaponServer] Executed without server authority. This script should only run on the server.');
      return;
    }
    console.log('[WeaponServer] Server authority confirmed. Listening for attack events.');

    this.connectNetworkBroadcastEvent(weaponAttackRequestEvent, (payload) => this.handleAttackRequest(payload));
  }

  private handleAttackRequest(payload: WeaponAttackRequestPayload) {
    console.log(`[WeaponServer] Received attack request from player ${payload.playerId} with weapon ${payload.weaponType}`);
    const player = this.world.getPlayers().find((candidate) => candidate.id === payload.playerId);
    if (!player) {
      return;
    }

    // 1. Get Player Stats
    const matchStats = this.getMatchStatsOrWarn(player, payload.weaponEntityId);
    if (!matchStats) return;

    // 2. Determine Weapon Level & Stats
    let currentLevel = 1;
    switch (payload.weaponType) {
      case WeaponType.Melee: currentLevel = matchStats.meleeAttackLevel ?? 1; break;
      case WeaponType.Ranged: currentLevel = matchStats.rangedAttackLevel ?? 1; break;
      case WeaponType.Magic: currentLevel = matchStats.magicAttackLevel ?? 1; break;
    }
    const weaponStats = getWeaponStats(payload.weaponType, currentLevel);
    
    // 3. Resolve Attack based on Type
    switch (payload.weaponType) {
      case WeaponType.Melee:
        this.resolveMeleeAttack(player, payload, weaponStats.damage);
        break;
      case WeaponType.Ranged:
        this.resolveRangedAttack(player, payload, weaponStats.damage, weaponStats.splashRadius, weaponStats.splashDamage);
        break;
      case WeaponType.Magic:
        this.resolveMagicAttack(player, payload, weaponStats.damage, weaponStats.splashRadius ?? 4, weaponStats.splashHeal ?? 0);
        break;
    }
  }

  private resolveMeleeAttack(player: hz.Player, payload: WeaponAttackRequestPayload, damage: number) {
    const params = payload.params;
    const targets = collectTargetsForPlayer({
      player,
      range: params.range,
      arcDegrees: params.arc,
      verticalTolerance: params.verticalTolerance,
      maxTargets: params.maxTargets,
      filter: slimeTargetFilter,
    });

    let hitCount = 0;
    for (const target of targets) {
      this.emitHitEvent(target.agent, player, target.position, target.delta, damage, WeaponType.Melee);
      hitCount++;
    }
    console.log(`[WeaponServer] Melee hit ${hitCount} targets. Damage: ${damage}`);
  }

  private resolveRangedAttack(player: hz.Player, payload: WeaponAttackRequestPayload, damage: number, splashRadius: number, splashDamage: number) {
    const params = payload.params;
    
    // Ranged usually hits single target first, then splashes
    const closestTarget = findClosestTargetForPlayer({
      player,
      range: params.range,
      arcDegrees: params.arc,
      verticalTolerance: params.verticalTolerance,
      maxTargets: params.maxTargets,
      filter: slimeTargetFilter,
    });

    if (!closestTarget) {
      return;
    }

    // Direct Hit
    this.emitHitEvent(closestTarget.agent, player, closestTarget.position, closestTarget.delta, damage, WeaponType.Ranged);

    // Splash Logic (if applicable)
    if (splashRadius > 0 && splashDamage > 0) {
      this.damageEnemiesWithinRadius(closestTarget.position, splashRadius, player, splashDamage, WeaponType.Ranged, [closestTarget.agent.entity.id]);
    }
  }

  private resolveMagicAttack(player: hz.Player, payload: WeaponAttackRequestPayload, damage: number, radius: number, healAmount: number) {
    const params = payload.params;

    // Magic usually targets a location or nearest enemy to explode
    const closestTarget = findClosestTargetForPlayer({
      player,
      range: params.range,
      arcDegrees: params.arc,
      verticalTolerance: params.verticalTolerance,
      maxTargets: params.maxTargets,
      filter: slimeTargetFilter,
    });

    // If no target found, magic might just fizzle or explode at max range (implementation choice).
    // Here we assume it needs a target to detonate.
    if (!closestTarget) {
      return;
    }

    // AOE Damage
    const damagedCount = this.damageEnemiesWithinRadius(closestTarget.position, radius, player, damage, WeaponType.Magic);
    
    // AOE Heal
    const healedCount = this.healPlayersWithinRadius(closestTarget.position, radius, healAmount);

    // console.log(`[WeaponServer] Magic hit ${damagedCount} enemies, healed ${healedCount} players.`);
  }

  private emitHitEvent(agent: AnySlimeAgent, player: hz.Player, targetPosition: hz.Vec3, delta: hz.Vec3, damage: number, weaponType?: string) {
    const hitNormal = this.buildHitNormal(delta.x, delta.y, delta.z);
    this.sendNetworkEvent(agent.entity, Events.meleeHit, {
      hitPos: targetPosition,
      hitNormal,
      fromPlayer: player,
      damage,
      weaponType
    });
  }

  private damageEnemiesWithinRadius(center: hz.Vec3, radius: number, player: hz.Player, damage: number, weaponType: string, ignoreEntityIds: bigint[] = []): number {
    if (damage <= 0) return 0;

    const radiusSq = radius * radius;
    const maxHits = this.getMaxEnemiesAffected();
    let hitCount = 0;

    // CHANGED: Iterate over SlimeAgent instead of NpcAgent
    for (const agent of SlimeAgent.getActiveAgents()) {
      if (hitCount >= maxHits) break;
      if (agent.isDead || !isSlimeAgent(agent)) continue;
      if (ignoreEntityIds.includes(agent.entity.id)) continue;

      const pos = agent.entity.position.get();
      const distSq = pos.distanceSquared(center);
      
      if (distSq <= radiusSq) {
        const delta = pos.sub(center);
        this.emitHitEvent(agent, player, pos, delta, damage, weaponType);
        hitCount++;
      }
    }
    return hitCount;
  }

  private healPlayersWithinRadius(center: hz.Vec3, radius: number, amount: number): number {
    if (amount <= 0) return 0;
    
    const manager = MatchStateManager.instance;
    if (!manager) return 0;

    const radiusSq = radius * radius;
    const maxHeals = this.getMaxPlayersHealed();
    let healCount = 0;

    for (const p of this.world.getPlayers()) {
      if (healCount >= maxHeals) break;
      if (p.position.get().distanceSquared(center) <= radiusSq) {
         manager.adjustHp(p, amount);
         healCount++;
      }
    }
    return healCount;
  }

  private buildHitNormal(deltaX: number, deltaY: number, deltaZ: number): hz.Vec3 {
    const normal = new hz.Vec3(-deltaX, -deltaY, -deltaZ);
    const magnitudeSq = normal.x * normal.x + normal.y * normal.y + normal.z * normal.z;
    if (magnitudeSq <= EPSILON) {
      return new hz.Vec3(0, 1, 0);
    }
    return normal.normalize();
  }

  private getMatchStatsOrWarn(player: hz.Player, weaponEntityId: string): ReturnType<MatchStateManager['getStats']> {
    const manager = MatchStateManager.instance;
    if (!manager) {
      console.warn(`[WeaponServer] MatchStateManager unavailable; player=${player.id}`);
      return undefined;
    }
    const stats = manager.getStats(player);
    if (!stats) {
      console.warn(`[WeaponServer] Match stats missing; player=${player.id}`);
      return undefined;
    }
    return stats;
  }

  private getMaxEnemiesAffected(): number {
    return this.props.maxEnemiesAffected!;
  }

  private getMaxPlayersHealed(): number {
    return this.props.maxPlayersHealed!;
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
hz.Component.register(WeaponServer);