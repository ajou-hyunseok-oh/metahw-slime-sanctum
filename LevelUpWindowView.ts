// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 05, 2025

import { Component, Player } from 'horizon/core';
import { NoesisGizmo } from 'horizon/noesis';
import { WeaponSelectorEvents, WeaponType } from './WeaponSelector';

/**
 * A simple implementation of the Command pattern for Noesis UI.
 */
class DelegateCommand {
  private readonly _action: (parameter?: any) => void;
  private readonly _canExecute: (parameter?: any) => boolean;

  constructor(action: (parameter?: any) => void, canExecute?: (parameter?: any) => boolean) {
    this._action = action;
    this._canExecute = canExecute || (() => true);
  }

  execute(parameter?: any): void {
    if (this.canExecute(parameter)) {
      this._action(parameter);
    }
  }

  canExecute(parameter?: any): boolean {
    return this._canExecute(parameter);
  }
}

/**
 * Manages the Level Up Window UI and handles weapon selection events.
 */
class LevelUpWindowView extends Component<typeof LevelUpWindowView> {
  
  start() {
    const localPlayer = this.world.getLocalPlayer();
    const serverPlayer = this.world.getServerPlayer();

    // Run UI logic only on the client side
    if (localPlayer && serverPlayer && localPlayer.id === serverPlayer.id) {
      return;
    }

    this.startClient();
  }

  private startClient() {
    // Bind commands to the data context
    /*
    const dataContext = {
      SelectMeleeCommand: new DelegateCommand(this.onSelectMelee.bind(this)),
      SelectRangedCommand: new DelegateCommand(this.onSelectRanged.bind(this)),
      SelectMagicCommand: new DelegateCommand(this.onSelectMagic.bind(this)),
    };

    const gizmo = this.entity.as(NoesisGizmo);
    if (gizmo) {
      gizmo.dataContext = dataContext;
    }
    */
  }

  private onSelectMelee(level: any) {
    this.requestWeapon(WeaponType.Melee, level);
  }

  private onSelectRanged(level: any) {
    this.requestWeapon(WeaponType.Ranged, level);
  }

  private onSelectMagic(level: any) {
    this.requestWeapon(WeaponType.Magic, level);
  }

  private requestWeapon(weaponType: WeaponType, level: any) {
    const localPlayer = this.world.getLocalPlayer();
    if (!localPlayer) return;

    const parsedLevel = parseInt(level, 10);
    if (isNaN(parsedLevel)) {
      console.warn(`[LevelUpWindowView] Invalid weapon level: ${level}`);
      return;
    }

    console.log(`[LevelUpWindowView] Requesting ${weaponType} Lv.${parsedLevel}`);

    this.sendNetworkEvent(this.entity, WeaponSelectorEvents.requestWeapon, {
      playerId: localPlayer.id,
      weaponType: weaponType,
      level: parsedLevel,
    });
  }
}

Component.register(LevelUpWindowView);
