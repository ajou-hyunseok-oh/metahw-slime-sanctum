// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on November 28, 2025

import { Player } from 'horizon/core';
import { PlayerData } from './PlayerData';

export class GamePlayers {
  all = new Map<Player, PlayerData>;
  inLobby = new Set<number>;
  inMatch = new Set<number>;

  get(p: Player): PlayerData | undefined {
    return this.all.get(p);
  }

  addAmmo(p: Player, amount: number): void {
    var playerData = this.get(p);
    if (playerData) {
      playerData.ammo += amount;
    }
  }

  takeDamage(p: Player, amount: number): number {
    var playerData = this.get(p);
    if (playerData && !playerData.isInvincible) {
      playerData.hp -= amount;
      return playerData.hp > 0 ? playerData.hp : 0;
    }

    // Non-existent player, can't take damage
    return 1;
  }

  setInvincible(p: Player, isInvincible: boolean): boolean {
    var playerData = this.get(p);
    if (playerData) {
      playerData.isInvincible = isInvincible;

      return isInvincible;
    }

    return false;
  }

  heal(p: Player, amount: number, max: number): number {
    var playerData = this.get(p);
    if (playerData) {
      playerData.hp = playerData.hp + amount;
      return playerData.hp;
    }

    // Non-existent player, can't heal
    return 0;
  }

  revive(p: Player) {
    var playerData = this.get(p);
    if (playerData) {
      playerData.hp = playerData.initialHp;
    }
  }

  isInLobby(p: Player): boolean {
    return this.inLobby.has(p.id);
  }

  isInMatch(p: Player): boolean {
    return this.inMatch.has(p.id);
  }

  playersInLobby(): number {
    return this.inLobby.size;
  }

  playersInMatch(): number {
    return this.inMatch.size;
  }

  playersInWorld(): number {
    return this.inLobby.size + this.inMatch.size;
  }

  getPlayersInLobby(): PlayerData[] {
    var playerList : PlayerData[] = [];
    this.all.forEach(element => {
      if (this.inLobby.has(element.player.id)) {
        playerList.push(element);
      }
    });
    return playerList;
  }

  getPlayersInMatch(): PlayerData[]  {
    var playerList : PlayerData[] = [];
    this.all.forEach(element => {
      if (this.inMatch.has(element.player.id)) {
        playerList.push(element);
      }
    });
    return playerList;
  }

  moveToLobby(p: Player): void {
    if (this.inMatch.has(p.id)) {
      this.inMatch.delete(p.id);
      this.inLobby.add(p.id);
    }
  }

  moveToMatch(p: Player): void {
    if (this.inLobby.has(p.id)) {
      this.inLobby.delete(p.id);
      this.inMatch.add(p.id);
    }
  }

  addNewPlayer(p: PlayerData): PlayerData {
    this.all.set(p.player, p);
    this.inLobby.add(p.player.id);

    return p;
  }

  removePlayer(p: Player): void {
    this.inLobby.delete(p.id);
    this.inMatch.delete(p.id);
    this.all.delete(p);
  }

  resetAllPlayers(): void {
    this.all.forEach(element => {
      element.reset();
    });
  }
}