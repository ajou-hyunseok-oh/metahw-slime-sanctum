// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on November 28, 2025

import { Behaviour } from "Behaviour";
import { Component } from "horizon/core";
import { NpcTuner } from "NpcTuner";
import { SLIME_BASE_STATS } from "GameBalanceData";

export class NpcConfigStore extends Behaviour<typeof NpcConfigStore>{
  public static instance: NpcConfigStore;

  private npcConfigs: Map<string, NpcTuner> = new Map<string, NpcTuner>();

  Awake() {
    NpcConfigStore.instance = this;
  }

  public addNpcConfig(npcId: string, npcTuner: NpcTuner) {
    this.npcConfigs.set(npcId, npcTuner);
  }

  public getNpcConfig(npcId: string) {
    const tuner = this.npcConfigs.get(npcId);
    if (!tuner) return undefined;

    const props = tuner.props;
    const baseStats = SLIME_BASE_STATS[npcId];

    if (baseStats) {
      // GameBalanceData에 정의된 스탯이 있으면 우선 사용
      // LootTable 같은 엔티티 참조는 기존 props에서 유지
      return {
        ...props,
        ...baseStats
      };
    }

    return props;
  }
}
Component.register(NpcConfigStore);