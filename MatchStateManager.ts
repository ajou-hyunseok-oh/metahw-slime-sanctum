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
 * 서버에서 플레이어별 매치 진행 상태(HP, 능력치, 진행 기록 등)를 관리하는 관리 컴포넌트
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
    this.playerStates.set(player.id, merged);
    this.emitStateUpdate(player, merged);
    return merged;
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
}

Component.register(MatchStateManager);


