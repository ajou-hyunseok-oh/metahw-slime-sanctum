// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on November 28, 2025

import { Entity, Player } from 'horizon/core';

export class PlayerData{
  player: Player;
  isInvincible: boolean;

  ammo: number;
  hp: number;

  initialHp : number;
  initialAmmo : number;

  hud : Entity | null | undefined;

  constructor(player: Player, ammo : number, hp : number) {
    this.player = player;
    this.hp = this.initialHp = hp;
    this.ammo = this.initialAmmo = ammo;
    this.hud = null;
    this.isInvincible = false;
  }

  public reset() {
    this.hp = this.initialHp;
    this.ammo = this.initialAmmo;
    this.isInvincible = false;
  }
}