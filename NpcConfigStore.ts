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

export class NpcConfigStore extends Behaviour<typeof NpcConfigStore>{
  public static instance: NpcConfigStore;

  private npcConfigs: Map<string, NpcTuner> = new Map<string, NpcTuner>();

  Awake() {
    NpcConfigStore.instance = this;
  }

  public addNpcConfig(npcId: string, npcTuner: NpcTuner) {
    this.npcConfigs.set(npcId, npcTuner);
  }

  public getNpcConfig(npcId: string){
    return this.npcConfigs.get(npcId)?.props;
  }
}
Component.register(NpcConfigStore);