// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 06, 2025

import { Behaviour } from 'Behaviour';
import { Asset, Component, Entity, GrabbableEntity, Handedness, NetworkEvent, Player, PropTypes, Space } from 'horizon/core';
import { WeaponType } from 'GameBalanceData';
import { Events } from 'Events';

export { WeaponType } from 'GameBalanceData';

type EquippedState = {
  entities: Entity[];
  grabbable?: GrabbableEntity;
};

export type WeaponRequestPayload = {
  playerId: number;
  weaponType: WeaponType;
  level: number;
};

export const WeaponSelectorEvents = {
  requestWeapon: new NetworkEvent<WeaponRequestPayload>('WeaponSelectorRequest'),
};

export class WeaponSelector extends Behaviour<typeof WeaponSelector> {
  static propsDefinition = {
    meleeLv1Asset: { type: PropTypes.Asset, default: null },
    meleeLv2Asset: { type: PropTypes.Asset, default: null },
    meleeLv3Asset: { type: PropTypes.Asset, default: null },
    meleeLv4Asset: { type: PropTypes.Asset, default: null },
    meleeLv5Asset: { type: PropTypes.Asset, default: null },
    meleeLv6Asset: { type: PropTypes.Asset, default: null },
    meleeLv7Asset: { type: PropTypes.Asset, default: null },
    meleeLv8Asset: { type: PropTypes.Asset, default: null },
    meleeLv9Asset: { type: PropTypes.Asset, default: null },
    meleeLv10Asset: { type: PropTypes.Asset, default: null },
    rangedLv1Asset: { type: PropTypes.Asset, default: null },
    rangedLv2Asset: { type: PropTypes.Asset, default: null },
    rangedLv3Asset: { type: PropTypes.Asset, default: null },
    rangedLv4Asset: { type: PropTypes.Asset, default: null },
    rangedLv5Asset: { type: PropTypes.Asset, default: null },
    rangedLv6Asset: { type: PropTypes.Asset, default: null },
    rangedLv7Asset: { type: PropTypes.Asset, default: null },
    rangedLv8Asset: { type: PropTypes.Asset, default: null },
    rangedLv9Asset: { type: PropTypes.Asset, default: null },
    rangedLv10Asset: { type: PropTypes.Asset, default: null },
    magicLv1Asset: { type: PropTypes.Asset, default: null },
    magicLv2Asset: { type: PropTypes.Asset, default: null },
    magicLv3Asset: { type: PropTypes.Asset, default: null },
    magicLv4Asset: { type: PropTypes.Asset, default: null },
    magicLv5Asset: { type: PropTypes.Asset, default: null },
    magicLv6Asset: { type: PropTypes.Asset, default: null },
    magicLv7Asset: { type: PropTypes.Asset, default: null },
    magicLv8Asset: { type: PropTypes.Asset, default: null },
    magicLv9Asset: { type: PropTypes.Asset, default: null },
    magicLv10Asset: { type: PropTypes.Asset, default: null },
  };

  static instance: WeaponSelector | undefined;
  public static get Instance(): WeaponSelector | undefined { return WeaponSelector.instance ?? undefined; }

  private static readonly weaponKeyPrefixes: Record<WeaponType, string> = {
    [WeaponType.Melee]: 'melee',
    [WeaponType.Ranged]: 'ranged',
    [WeaponType.Magic]: 'magic',
  };

  private readonly playerStates = new Map<number, EquippedState>();
  private readonly playerRequestIds = new Map<number, number>();

  private readonly DEFAULT_LOCOMOTION_SPEED = 4.5;
  private readonly DEFAULT_JUMP_SPEED = 4.3;
  private readonly WEAPON_SWAP_LOCK_MS = 2000;

  private setPlayerMovement(player: Player, enabled: boolean) {
    if (!player) return;
    try {
      player.locomotionSpeed.set(enabled ? this.DEFAULT_LOCOMOTION_SPEED : 0);
      player.jumpSpeed.set(enabled ? this.DEFAULT_JUMP_SPEED : 0);
    } catch (error) {
      console.warn(`[WeaponSelector] 플레이어 이동 제어 실패:`, error);
    }
  }

  private async applySwapLockPenalty() {
    await new Promise<void>((resolve) => {
      this.async.setTimeout(() => resolve(), this.WEAPON_SWAP_LOCK_MS);
    });
  }

  Awake() {
    WeaponSelector.instance = this;
  }

  Start() {
    this.connectNetworkEvent(this.entity, WeaponSelectorEvents.requestWeapon, this.onWeaponRequest.bind(this));
  }

  public async grabWeapon(weaponType: WeaponType, level: number, player: Player | undefined) {
    console.log("[WeaponSelector] grabWeapon", weaponType, level);

    if (!this.isValidPlayer(player)) {
      console.warn('[WeaponSelector] 장착할 플레이어를 찾을 수 없습니다.');
      return;
    }

    // 플레이어 이동 고정
    this.setPlayerMovement(player, false);

    try {
      const asset = this.getWeaponAsset(weaponType, level);
      if (!asset) {
        return;
      }

      const playerId = player.id;
      const requestId = this.nextRequestId(playerId);

      await this.despawnCurrentWeapon(playerId);

      const { position, rotation } = this.getSpawnTransform(player);

      const spawnedEntities = await this.world.spawnAsset(asset, position, rotation);
      if (!this.isLatestRequest(playerId, requestId)) {
        await this.safeDeleteEntities(spawnedEntities);
        return;
      }

      if (!spawnedEntities.length) {
        console.warn('[WeaponSelector] 스폰된 엔티티가 없습니다.');
        return;
      }

      const grabbable = this.findGrabbable(spawnedEntities);
      if (!grabbable) {
        console.warn('[WeaponSelector] GrabbableEntity를 찾을 수 없어 장착할 수 없습니다.');
        this.playerStates.set(playerId, { entities: spawnedEntities });
        return;
      }

      this.forceEquip(grabbable, player);
      this.playerStates.set(playerId, { entities: spawnedEntities, grabbable });

      // 무기 장착 이벤트 전송 (의상 변경 등을 위해)
      this.sendNetworkBroadcastEvent(Events.weaponEquipped, {
        player: player,
        weaponKey: this.getAssetKey(weaponType, level) ?? "",
        weaponType: weaponType,
        isRightHand: true 
      });

    } catch (error) {
      console.error('[WeaponSelector] 무기 스폰 실패:', error);
    } finally {
      // 고정 페널티 적용 후 이동 복구
      await this.applySwapLockPenalty();
      this.setPlayerMovement(player, true);
    }
  }

  private getWeaponAsset(weaponType: WeaponType, level: number): Asset | null {
    const key = this.getAssetKey(weaponType, level);
    if (!key) {
      return null;
    }

    const asset = (this.props as Record<string, Asset | null>)[key];
    if (!asset) {
      console.warn(`[WeaponSelector] ${key} 자산이 비어 있습니다.`);
      return null;
    }

    return asset;
  }

  private getAssetKey(weaponType: WeaponType, level: number): string | undefined {
    const prefix = WeaponSelector.weaponKeyPrefixes[weaponType];
    if (!prefix) {
      console.warn(`[WeaponSelector] 지원하지 않는 WeaponType: ${weaponType}`);
      return undefined;
    }

    const normalizedLevel = this.normalizeLevel(level);
    const key = `${prefix}Lv${normalizedLevel}Asset`;
    if (!(key in this.props)) {
      console.warn(`[WeaponSelector] ${key} 프로퍼티를 찾을 수 없습니다.`);
      return undefined;
    }

    return key;
  }

  private normalizeLevel(level: number) {
    if (!Number.isFinite(level)) {
      return 1;
    }
    return Math.min(Math.max(Math.floor(level), 1), 10);
  }

  private getSpawnTransform(player: Player) {
    let position = player.position.get();
    let rotation = player.rotation.get();

    try {
      position = player.rightHand.getPosition(Space.World);
    } catch (_) {
      // ignore and fall back to player position
    }

    try {
      rotation = player.rightHand.getRotation(Space.World);
    } catch (_) {
      // ignore and fall back to player rotation
    }

    return { position, rotation };
  }

  public async despawnCurrentWeapon(playerId: number) {
    const state = this.playerStates.get(playerId);
    if (!state) {
      return;
    }

    this.releaseCurrentWeapon(state);
    await this.safeDeleteEntities(state.entities);
    this.playerStates.delete(playerId);
  }

  private releaseCurrentWeapon(state: EquippedState) {
    if (!state.grabbable) {
      return;
    }

    try {
      state.grabbable.forceRelease();
    } catch (error) {
      console.warn('[WeaponSelector] 기존 무기 해제 실패:', error);
    }
  }

  private async safeDeleteEntities(entities?: Entity[]) {
    if (!entities?.length) {
      return;
    }

    const deletionTasks = entities
      .filter((entity) => entity.exists())
      .map(async (entity) => {
        try {
          await this.world.deleteAsset(entity, true);
        } catch (error) {
          console.warn('[WeaponSelector] 무기 삭제 실패:', error);
        }
      });

    await Promise.allSettled(deletionTasks);
  }

  private findGrabbable(entities: Entity[]): GrabbableEntity | undefined {
    for (const entity of entities) {
      const grabbable = this.tryAsGrabbable(entity);
      if (grabbable) {
        return grabbable;
      }

      try {
        const children = entity.children.get();
        if (children?.length) {
          const childResult = this.findGrabbable(children);
          if (childResult) {
            return childResult;
          }
        }
      } catch (error) {
        console.warn('[WeaponSelector] 자식 엔티티 탐색 실패:', error);
      }
    }

    return undefined;
  }

  private tryAsGrabbable(entity: Entity): GrabbableEntity | undefined {
    try {
      return entity.as(GrabbableEntity);
    } catch (_) {
      return undefined;
    }
  }

  private forceEquip(grabbable: GrabbableEntity, player: Player) {
    try {
      grabbable.forceHold(player, Handedness.Right, true);
    } catch (error) {
      console.error('[WeaponSelector] 무기 장착 실패:', error);
    }
  }
 
  private nextRequestId(playerId: number) {
    const nextId = (this.playerRequestIds.get(playerId) ?? 0) + 1;
    this.playerRequestIds.set(playerId, nextId);
    return nextId;
  }

  private isLatestRequest(playerId: number, requestId: number) {
    return this.playerRequestIds.get(playerId) === requestId;
  }

  private onWeaponRequest(payload: WeaponRequestPayload) {
    const player = this.findPlayerById(payload.playerId);
    if (!player) {
      console.warn(`[WeaponSelector] 요청한 플레이어(${payload.playerId})를 찾을 수 없습니다.`);
      return;
    }

    this.grabWeapon(payload.weaponType, payload.level, player);
  }

  private findPlayerById(playerId: number): Player | undefined {
    return this.world.getPlayers().find((player) => player.id === playerId);
  }

  private isValidPlayer(player: Player | undefined): player is Player {
    if (!player) {
      return false;
    }

    try {
      return player.isValidReference.get();
    } catch (error) {
      console.warn('[WeaponSelector] 플레이어 유효성 검사 실패:', error);
      return false;
    }
  }
}
Component.register(WeaponSelector);