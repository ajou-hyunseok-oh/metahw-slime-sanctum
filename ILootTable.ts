// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on November 28, 2025

import { Entity, Quaternion, Vec3 } from "horizon/core";

export interface ILootTable {
  shouldDropItem(): boolean;
  dropRandomItem(position : Vec3, rotation : Quaternion): void;
  clearItem(item : Entity) : void;
  clearItems() : void;
}
