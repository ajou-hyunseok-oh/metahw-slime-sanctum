// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on November 28, 2025

import { Behaviour } from 'Behaviour';
import { Component, Vec3 } from 'horizon/core';

class GameManager extends Behaviour<typeof GameManager> {
  static propsDefinition = {};

  timerID: number = 0;
  countdownTimeInMS: number = 3000;

  Awake() {
  }
}

Component.register(GameManager);