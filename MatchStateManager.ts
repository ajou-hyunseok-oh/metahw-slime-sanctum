// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 02, 2025

import { Behaviour } from 'Behaviour';
import { Events } from 'Events';
import { AvatarPoseGizmo, Component, NetworkEvent, Player, PropTypes, Vec3 } from 'horizon/core';
import { getPlayerStats, PASSIVE_SKILL_DATA } from 'GameBalanceData';
import { TeamType } from 'GameConstants';
import { PlayerManager } from 'PlayerManager';
import { WeaponSelector, WeaponType } from 'WeaponSelector';

export type MatchVariables = {
  hpCurrent: number;
  hpMax: number;
  defense: number;
  meleeAttackLevel: number;
  rangedAttackLevel: number;
  magicAttackLevel: number;
  slimeKills: number;
  wavesSurvived: number;
  level: number;
  currentXp: number;
  xpToNextLevel: number;
  team: TeamType;
  skillHpBonusLevel: number;
  skillDefenseBonusLevel: number;
};

export type MatchStateUpdatePayload = MatchVariables & { playerId: number };

/**
 * 서버에서 플레이어별 매치 진행 상태(HP, 능력치, 진행 기록 등)를 일원화해 관리한다.
 * HP/공격 스탯은 반드시 이 매니저를 경유해 갱신해야 다른 시스템과 정합성이 보장된다.
 */
export class MatchStateManager extends Behaviour<typeof MatchStateManager> {
  static propsDefinition = {
    defaultHpMax: { type: PropTypes.Number, default: 100 },
    defaultDefense: { type: PropTypes.Number, default: 0 },
    defaultMeleeAttackLevel: { type: PropTypes.Number, default: 0 },
    defaultRangedAttackLevel: { type: PropTypes.Number, default: 0 },
    defaultMagicAttackLevel: { type: PropTypes.Number, default: 0 },
  };

  static instance: MatchStateManager;

  private readonly playerStates = new Map<number, MatchVariables>();

  protected Awake() {
    MatchStateManager.instance = this;
  }

  protected Start() {
    this.connectNetworkBroadcastEvent(Events.matchStateRequest, this.onMatchStateRequested.bind(this));
    this.connectNetworkBroadcastEvent(Events.playerHit, this.onPlayerHit.bind(this));
    this.connectNetworkBroadcastEvent(Events.requestMatchExit, this.onRequestMatchExit.bind(this));
    this.connectNetworkBroadcastEvent(Events.requestShowResults, this.onRequestShowResults.bind(this));
    this.connectNetworkBroadcastEvent(Events.requestSkillUpgrade, this.onRequestSkillUpgrade.bind(this));
  }

  /**
   * 플레이어가 매치에 진입했을 때 호출하여 기본 상태를 초기화한다.
   */
  public enterMatch(player: Player, overrides?: Partial<MatchVariables>): MatchVariables {
    console.log(`[MatchStateManager] enterMatch called for Player: ${player.name.get()} (ID: ${player.id})`);
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
   * 게임 종료 시 호출하여 해당 플레이어에게 종료 사운드 등을 재생하도록 요청한다.
   */
  public notifyGameEnd(player: Player) {
    //this.sendNetworkBroadcastEvent(Events.playClientAudio, { playerId: player.id, soundId: 'GameEnd' });
  }

  /**
   * 특정 팀의 모든 플레이어를 패배(사망) 처리하고 결과를 전송한다.
   * 코어 파괴 등 게임 패배 시 호출된다.
   */
  public notifyTeamDefeat(team: TeamType) {
    if (!PlayerManager.instance) return;
    
    const players = PlayerManager.instance.getTeamPlayers(team);
    players.forEach(player => {
        // HP를 0으로 만들고 사망 처리
        this.patchStats(player, { hpCurrent: 0 });
        this.notifyPlayerDeath(player);
    });
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
    
    merged.level = Math.max(1, merged.level);
    merged.currentXp = Math.max(0, merged.currentXp);
    merged.xpToNextLevel = Math.max(1, merged.xpToNextLevel);

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

  public addXp(player: Player, amount: number): MatchVariables {
    if (amount <= 0) return this.getOrCreateState(player);

    let state = this.getOrCreateState(player);
    let { level, currentXp, xpToNextLevel } = state;

    currentXp += amount;
    console.log(`[MatchStateManager] Player ${player.name.get()} gained ${amount} XP. Current: ${currentXp}/${xpToNextLevel}`);

    let leveledUp = false;
    // Level up loop
    while (currentXp >= xpToNextLevel) {
      currentXp -= xpToNextLevel;
      level++;
      
      const nextStats = getPlayerStats(level);
      xpToNextLevel = nextStats.xpToNextLevel;
      
      // Update state with new level first
      state.level = level; 
      
      // Recalculate stats with new level (skill bonuses applied automatically)
      const { maxHp, defense } = this.calculateStats(state.level, state.skillHpBonusLevel, state.skillDefenseBonusLevel);
      
      state.hpMax = maxHp;
      state.hpCurrent = maxHp; // Full heal on level up
      state.defense = defense;

      leveledUp = true;
      console.log(`[MatchStateManager] *** LEVEL UP! *** Player ${player.name.get()} is now Level ${level}! HP: ${maxHp}, Def: ${defense}`);
    }

    if (leveledUp) {
       // Notify client to show Level Up UI
       this.sendNetworkBroadcastEvent(Events.playerLevelUp, { 
        player, 
        level, 
        xp: currentXp,
        stats: {
            melee: state.meleeAttackLevel,
            ranged: state.rangedAttackLevel,
            magic: state.magicAttackLevel,
            defense: state.skillDefenseBonusLevel,
            health: state.skillHpBonusLevel
        }
    });

       return this.patchStats(player, {
        level,
        currentXp,
        xpToNextLevel,
        hpMax: state.hpMax,
        hpCurrent: state.hpCurrent,
        defense: state.defense
      });
    } else {
      return this.patchStats(player, {
        currentXp
      });
    }
  }

  private onRequestSkillUpgrade(data: { playerId: number, skillType: string }) {
    const player = this.world.getPlayers().find((p) => p.id === data.playerId);
    
    if (!player) {
        const allIds = this.world.getPlayers().map(p => `${p.name.get()}(${p.id})`).join(', ');
        console.error(`[MatchStateManager] Player ID ${data.playerId} not found in player list. Current players: [${allIds}]`);
        return;
    }
    
    console.log(`[MatchStateManager] RequestSkillUpgrade received. PlayerID: ${data.playerId}, Skill: ${data.skillType}, FoundPlayer: ${player.name.get()}`);

    switch (data.skillType) {
        case "Melee":
            this.incrementCombatLevel(player, 'melee');
            break;
        case "Range":
            this.incrementCombatLevel(player, 'ranged');
            break;
        case "Magic":
            this.incrementCombatLevel(player, 'magic');
            break;
        case "Defense":
            this.upgradePassiveSkill(player, 'defense');
            break;
        case "Health":
            this.upgradePassiveSkill(player, 'hp');
            break;
    }
  }

  private incrementCombatLevel(player: Player, type: 'melee' | 'ranged' | 'magic') {
      const state = this.getOrCreateState(player);
      const patch: Partial<MatchVariables> = {};
      let weaponType: WeaponType;
      let newLevel: number = 0;
      
      if (type === 'melee') {
          newLevel = state.meleeAttackLevel + 1;
          patch.meleeAttackLevel = newLevel;
          weaponType = WeaponType.Melee;
      }
      else if (type === 'ranged') {
          newLevel = state.rangedAttackLevel + 1;
          patch.rangedAttackLevel = newLevel;
          weaponType = WeaponType.Ranged;
      }
      else {
          newLevel = state.magicAttackLevel + 1;
          patch.magicAttackLevel = newLevel;
          weaponType = WeaponType.Magic;
      }
      
      this.patchStats(player, patch);

      if (WeaponSelector.Instance) {
          WeaponSelector.Instance.grabWeapon(weaponType, newLevel, player);
      }
  }

  public upgradePassiveSkill(player: Player, skillType: 'hp' | 'defense'): MatchVariables {
    const state = this.getOrCreateState(player);
    const patch: Partial<MatchVariables> = {};

    if (skillType === 'hp') {
        const newLevel = state.skillHpBonusLevel + 1;
        patch.skillHpBonusLevel = newLevel;
        
        // Recalculate HP immediately
        const stats = this.calculateStats(state.level, newLevel, state.skillDefenseBonusLevel);
        patch.hpMax = stats.maxHp;
        // Proportionally increase current HP or keep same? Usually keep same or full heal. Let's keep current but clamp.
        // Or increase current by the same amount max increased?
        const hpIncrease = stats.maxHp - state.hpMax;
        patch.hpCurrent = state.hpCurrent + hpIncrease;
    } else if (skillType === 'defense') {
        const newLevel = state.skillDefenseBonusLevel + 1;
        patch.skillDefenseBonusLevel = newLevel;
        
        // Recalculate Defense
        const stats = this.calculateStats(state.level, state.skillHpBonusLevel, newLevel);
        patch.defense = stats.defense;
    }

    return this.patchStats(player, patch);
  }

  private calculateStats(level: number, hpSkillLevel: number, defSkillLevel: number) {
    const baseStats = getPlayerStats(level);
    
    // Apply HP Bonus (Percentage)
    const hpMultiplier = 1.0 + (hpSkillLevel * PASSIVE_SKILL_DATA.hpBonusPerLevel);
    const finalMaxHp = Math.floor(baseStats.maxHp * hpMultiplier);

    // Apply Defense Bonus (Flat)
    const defBonus = defSkillLevel * PASSIVE_SKILL_DATA.defenseBonusPerLevel;
    const finalDefense = baseStats.defense + defBonus;

    return { maxHp: finalMaxHp, defense: finalDefense };
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
    const startStats = getPlayerStats(1);

    // Initial Stats (Level 1 + 0 Skill Levels)
    // Note: We use 0 for skills initially.
    // calculateStats(1, 0, 0) would return base stats.
    
    const base: MatchVariables = {
      hpMax: startStats.maxHp,
      hpCurrent: startStats.maxHp,
      defense: startStats.defense,
      meleeAttackLevel: this.props.defaultMeleeAttackLevel,
      rangedAttackLevel: this.props.defaultRangedAttackLevel,
      magicAttackLevel: this.props.defaultMagicAttackLevel,
      slimeKills: 0,
      wavesSurvived: 0,
      level: 1,
      currentXp: 0,
      xpToNextLevel: startStats.xpToNextLevel,
      team: TeamType.None,
      skillHpBonusLevel: 0,
      skillDefenseBonusLevel: 0,
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

    initial.level = Math.max(1, initial.level);
    initial.currentXp = Math.max(0, initial.currentXp);
    initial.xpToNextLevel = Math.max(1, initial.xpToNextLevel);

    return initial;
  }

  private emitStateUpdate(player: Player, state: MatchVariables): void {
    const payload: MatchStateUpdatePayload = {
      playerId: player.id,
      ...state,
    };
    console.log(`[MatchStateManager] Sending StateUpdate to Player ${player.id} (${player.name.get()}). Melee: ${state.meleeAttackLevel}, Ranged: ${state.rangedAttackLevel}, Magic: ${state.magicAttackLevel}, Def: ${state.defense}`);
    this.sendNetworkEvent(player, Events.matchStateUpdate, payload);
  }

  private onMatchStateRequested(data: { playerId: number }) {
    const player = this.world.getPlayers().find((p) => p.id === data.playerId);
    if (!player) {
      return;
    }

    const state = this.getOrCreateState(player);
    this.emitStateUpdate(player, state);
  }

  private onPlayerHit(data: { player: Player, damage: number, damageOrigin: Vec3 }) {
    const player = data.player;
    const rawDamage = data.damage;
    
    if (!player) return;

    const state = this.getOrCreateState(player);
    
    // StarCraft Style Damage Formula
    // Damage = Max(1, Attack - Armor)
    const damage = Math.max(1, rawDamage - state.defense);
    
    // Apply Damage
    this.adjustHp(player, -damage);
    
    console.log(`[MatchStateManager] Player ${player.name.get()} Hit! Raw: ${rawDamage}, Def: ${state.defense}, Final: ${damage}. HP: ${state.hpCurrent}/${state.hpMax}`);

    if (state.hpCurrent <= 0) {
       console.log(`[MatchStateManager] Player ${player.name.get()} died.`);       
       this.notifyPlayerDeath(player);
    }
  }

  private onRequestMatchExit(data: { playerId: number }) {
    const player = this.world.getPlayers().find((p) => p.id === data.playerId);
    if (!player) return;

    const state = this.playerStates.get(player.id);
    if (state) {
      console.log(`[MatchStateManager] Player ${player.name.get()} requested exit.`);
      this.notifyPlayerDeath(player);
    }
  }

  private onRequestShowResults(data: { playerId: number }) {
    const player = this.world.getPlayers().find((p) => p.id === data.playerId);
    if (!player) return;

    const state = this.playerStates.get(player.id);
    if (state) {
        this.sendResults(player, state);
    }
  }

  private notifyPlayerDeath(player: Player) {
      console.log(`[MatchStateManager] Player ${player.name.get()} died.`);
      this.sendNetworkBroadcastEvent(Events.playerDied, { playerId: player.id });
      this.sendNetworkEvent(player, Events.matchPageView, { enabled: false });      
      
      const state = this.playerStates.get(player.id);
      if (state) {
          this.sendResults(player, state);
      }
  }

  private sendResults(player: Player, state: MatchVariables) {
     // 점수 계산
     const score = (state.slimeKills * 10) + (state.wavesSurvived * 100);

     // 보상 계산 (임시: 킬당 2코인, 웨이브당 50코인, 5웨이브당 1젬)
     const earnedCoins = (state.slimeKills * 2) + (state.wavesSurvived * 50);
     const earnedGems = Math.floor(state.wavesSurvived / 5);

     // 영구 데이터 저장
     if (PlayerManager.instance) {
       PlayerManager.instance.saveMatchResults(player, {
         kills: state.slimeKills,
         waves: state.wavesSurvived,
         coins: earnedCoins,
         gems: earnedGems
       });
     }
     
     // 결과 화면 표시 (ResultPageView와 연동)
     this.sendNetworkEvent(player, Events.matchResultUpdate, { 
       player: player, 
       waves: state.wavesSurvived, 
       kills: state.slimeKills, 
       coins: earnedCoins, 
       gems: earnedGems 
     });

     this.sendNetworkEvent(player, Events.playerShowResults, { 
       player, 
       score,
       placement: state.wavesSurvived // 임시로 placement에 웨이브 수 전달
     });
  }

  private clamp(value: number | undefined, min: number, max: number): number {
    if (value === undefined) {
      return min;
    }
    return Math.max(min, Math.min(max, value));
  }

  private normalizeCombatLevel(value: number | undefined): number {
    if (value === undefined || Number.isNaN(value)) {
      return 0;
    }
    return Math.max(0, Math.floor(value));
  }
}

Component.register(MatchStateManager);


