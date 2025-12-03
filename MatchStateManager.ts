// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 02, 2025

import { Behaviour } from 'Behaviour';
import { Events } from 'Events';
import { Component, NetworkEvent, Player, PropTypes } from 'horizon/core';

export type MatchVariables = {
  hpCurrent: number;
  hpMax: number;
  defense: number;
  meleeAttackLevel: number;
  rangedAttackLevel: number;
  magicAttackLevel: number;
  slimeKills: number;
  wavesSurvived: number;
};

export type MatchStateUpdatePayload = MatchVariables & { playerId: number };

const matchStateRequestEvent = (Events as unknown as {
  matchStateRequest: NetworkEvent<{ playerId: number }>;
}).matchStateRequest;

const matchStateUpdateEvent = (Events as unknown as {
  matchStateUpdate: NetworkEvent<MatchStateUpdatePayload>;
}).matchStateUpdate;

/**
 * 서버에서 플레이어별 매치 진행 상태(HP, 능력치, 진행 기록 등)를 일원화해 관리한다.
 * HP/공격 스탯은 반드시 이 매니저를 경유해 갱신해야 다른 시스템과 정합성이 보장된다.
 */
export class MatchStateManager extends Behaviour<typeof MatchStateManager> {
  static propsDefinition = {
    defaultHpMax: { type: PropTypes.Number, default: 100 },
    defaultDefense: { type: PropTypes.Number, default: 0 },
    defaultMeleeAttackLevel: { type: PropTypes.Number, default: 1 },
    defaultRangedAttackLevel: { type: PropTypes.Number, default: 1 },
    defaultMagicAttackLevel: { type: PropTypes.Number, default: 1 },
  };

  static instance: MatchStateManager;

  private readonly playerStates = new Map<number, MatchVariables>();

  protected Awake() {
    MatchStateManager.instance = this;
  }

  protected Start() {
    this.connectNetworkBroadcastEvent(matchStateRequestEvent, this.onMatchStateRequested.bind(this));
  }

  /**
   * 플레이어가 매치에 진입했을 때 호출하여 기본 상태를 초기화한다.
   */
  public enterMatch(player: Player, overrides?: Partial<MatchVariables>): MatchVariables {
    const state = this.createInitialState(overrides);
    this.playerStates.set(player.id, state);
    this.emitStateUpdate(player, state);
    return state;
  }

  /**
   * 플레이어가 매치를 떠날 때 호출하여 상태를 정리한다.
   */
  public exitMatch(player: Player): void {
    if (!this.playerStates.has(player.id)) {
      return;
    }
    const state = this.playerStates.get(player.id);
    this.playerStates.delete(player.id);
    if (state) {
      this.emitStateUpdate(player, { ...state, hpCurrent: 0 });
    }
  }

  /**
   * 현재 상태를 읽기 전용으로 반환한다.
   */
  public getStats(player: Player): MatchVariables | undefined {
    const existing = this.playerStates.get(player.id);
    return existing ? { ...existing } : undefined;
  }

  /**
   * 특정 필드만 부분적으로 갱신하고 결과를 반환한다.
   */
  public patchStats(player: Player, patch: Partial<MatchVariables>): MatchVariables {
    const current = this.getOrCreateState(player);
    const merged: MatchVariables = {
      ...current,
      ...patch,
    };
    merged.hpMax = merged.hpMax <= 0 ? 1 : merged.hpMax;
    merged.hpCurrent = this.clamp(merged.hpCurrent, 0, merged.hpMax);
    merged.defense = Math.max(0, merged.defense);
    merged.meleeAttackLevel = this.normalizeCombatLevel(merged.meleeAttackLevel);
    merged.rangedAttackLevel = this.normalizeCombatLevel(merged.rangedAttackLevel);
    merged.magicAttackLevel = this.normalizeCombatLevel(merged.magicAttackLevel);
    this.playerStates.set(player.id, merged);
    this.emitStateUpdate(player, merged);
    return merged;
  }

  /**
   * HP(현재/최대)를 한 번에 조정한다.
   */
  public setHp(
    player: Player,
    values: { hpCurrent?: number; hpMax?: number }
  ): MatchVariables {
    const patch: Partial<MatchVariables> = {};
    if (values.hpMax !== undefined) {
      patch.hpMax = values.hpMax;
    }
    if (values.hpCurrent !== undefined) {
      patch.hpCurrent = values.hpCurrent;
    }
    return this.patchStats(player, patch);
  }

  /**
   * 공격 관련 수치를 조정한다.
   */
  public setCombatAttributes(
    player: Player,
    attributes: Partial<
      Pick<
        MatchVariables,
        'defense' | 'meleeAttackLevel' | 'rangedAttackLevel' | 'magicAttackLevel'
      >
    >
  ): MatchVariables {
    return this.patchStats(player, attributes);
  }

  public adjustHp(player: Player, delta: number): MatchVariables {
    const current = this.getOrCreateState(player);
    const nextHp = this.clamp(current.hpCurrent + delta, 0, current.hpMax);
    return this.patchStats(player, { hpCurrent: nextHp });
  }

  public setWaveProgress(player: Player, wavesSurvived: number): MatchVariables {
    return this.patchStats(player, { wavesSurvived: Math.max(0, wavesSurvived) });
  }

  public incrementSlimeKills(player: Player, kills: number = 1): MatchVariables {
    const current = this.getOrCreateState(player);
    return this.patchStats(player, { slimeKills: current.slimeKills + Math.max(0, kills) });
  }

  public reset(player: Player): MatchVariables {
    const state = this.createInitialState();
    this.playerStates.set(player.id, state);
    this.emitStateUpdate(player, state);
    return state;
  }

  private getOrCreateState(player: Player): MatchVariables {
    let existing = this.playerStates.get(player.id);
    if (!existing) {
      existing = this.createInitialState();
      this.playerStates.set(player.id, existing);
    }
    return existing;
  }

  private createInitialState(overrides?: Partial<MatchVariables>): MatchVariables {
    const base: MatchVariables = {
      hpMax: this.props.defaultHpMax,
      hpCurrent: this.props.defaultHpMax,
      defense: this.props.defaultDefense,
      meleeAttackLevel: this.props.defaultMeleeAttackLevel,
      rangedAttackLevel: this.props.defaultRangedAttackLevel,
      magicAttackLevel: this.props.defaultMagicAttackLevel,
      slimeKills: 0,
      wavesSurvived: 0,
    };

    const initial: MatchVariables = {
      ...base,
      ...overrides,
    };

    initial.hpMax = initial.hpMax <= 0 ? base.hpMax : initial.hpMax;
    initial.hpCurrent = this.clamp(
      overrides?.hpCurrent ?? initial.hpCurrent,
      0,
      initial.hpMax
    );
    initial.defense = Math.max(0, initial.defense);
    initial.meleeAttackLevel = this.normalizeCombatLevel(initial.meleeAttackLevel);
    initial.rangedAttackLevel = this.normalizeCombatLevel(initial.rangedAttackLevel);
    initial.magicAttackLevel = this.normalizeCombatLevel(initial.magicAttackLevel);

    return initial;
  }

  private emitStateUpdate(player: Player, state: MatchVariables): void {
    const payload: MatchStateUpdatePayload = {
      playerId: player.id,
      ...state,
    };
    this.sendNetworkEvent(player, matchStateUpdateEvent, payload);
  }

  private onMatchStateRequested(data: { playerId: number }) {
    const player = this.world.getPlayers().find((p) => p.id === data.playerId);
    if (!player) {
      return;
    }

    const state = this.getOrCreateState(player);
    this.emitStateUpdate(player, state);
  }

  private clamp(value: number | undefined, min: number, max: number): number {
    if (value === undefined) {
      return min;
    }
    return Math.max(min, Math.min(max, value));
  }

  private normalizeCombatLevel(value: number | undefined): number {
    if (value === undefined || Number.isNaN(value)) {
      return 1;
    }
    return Math.max(1, Math.floor(value));
  }
}

Component.register(MatchStateManager);


