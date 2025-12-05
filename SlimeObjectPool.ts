import { Behaviour, BehaviourFinder } from 'Behaviour';
import { Component, Entity, Player, Quaternion, Vec3, PropTypes } from 'horizon/core';

export const pullSize = {
  blue: 4,
  pink: 3,
  king: 2,
} as const;

export enum SlimeType {
  Blue = 0,
  Pink,
  King
};

export interface ISlimeObject {
  onAllocate(position: Vec3, rotation: Quaternion): void;
  onFree(): void;
  slimeType: SlimeType;
}

export class SlimeObjectPool extends Behaviour<typeof SlimeObjectPool> {
  static propsDefinition = {
      blueAsset: { type: PropTypes.Asset, default: undefined },
      pinkAsset: { type: PropTypes.Asset, default: undefined },
      kingAsset: { type: PropTypes.Asset, default: undefined }  
  };
  
  private blueAllocatedEntities : Set<Entity> = new Set<Entity>();
  private blueFreeEntities : Set<Entity> = new Set<Entity>();  

  private pinkAllocatedEntities : Set<Entity> = new Set<Entity>();
  private pinkFreeEntities : Set<Entity> = new Set<Entity>();

  private kingAllocatedEntities : Set<Entity> = new Set<Entity>();  
  private kingFreeEntities : Set<Entity> = new Set<Entity>();

  public spawn(type: SlimeType, position: Vec3, rotation: Quaternion) {
    console.log(`[SlimeObject::spawn] ${type}/${position}/${rotation}`);

    // 풀 크기에 맞춰서 생성 또는 재활용
  }

  public addEntity(entity : Entity){
    console.log('addEntity: ', entity);
    const slimeObject = BehaviourFinder.GetBehaviour(entity) as unknown as ISlimeObject;
    if (!slimeObject) {
      return;
    }

    switch (slimeObject.slimeType) {
      case SlimeType.Blue:
        this.blueFreeEntities.add(entity);

        console.log('blueFreeEntities size: ', this.blueFreeEntities.size);
        break;
      case SlimeType.Pink:
        this.pinkFreeEntities.add(entity);

        console.log('pinkFreeEntities size: ', this.pinkFreeEntities.size);
        break;
      case SlimeType.King:
        this.kingFreeEntities.add(entity);

        console.log('kingFreeEntities size: ', this.kingFreeEntities.size);
        break;
    }      
  }

  public isFull(type: SlimeType): boolean {
    switch (type) {
      case SlimeType.Blue:
        return this.blueAllocatedEntities.size >= pullSize.blue;
      case SlimeType.Pink:
        return this.pinkAllocatedEntities.size >= pullSize.pink;
      case SlimeType.King:
        return this.kingAllocatedEntities.size >= pullSize.king;
    }  
    return false;
  }

  public removeEntity(entity: Entity | undefined | null) {
    if (!entity) {
      return;
    }

    const slimeObject = BehaviourFinder.GetBehaviour(entity) as unknown as ISlimeObject;
    if (!slimeObject) {
      return;
    }

    switch (slimeObject.slimeType) {
      case SlimeType.Blue:
        this.blueAllocatedEntities.delete(entity);
        this.blueFreeEntities.delete(entity);
        break;
      case SlimeType.Pink:
        this.pinkAllocatedEntities.delete(entity);
        this.pinkFreeEntities.delete(entity);
        break;
      case SlimeType.King:
        this.kingAllocatedEntities.delete(entity);
        this.kingFreeEntities.delete(entity);
        break;
    }
  }

  public allocate(type: SlimeType, position : Vec3, rotation : Quaternion) : Entity | null{            // 재활용 시 부모가 Static이면 이동이 막히므로 부모를 해제    
      
    switch (type) {
      case SlimeType.Blue:
        if (this.blueFreeEntities.size == 0) {
          return null;
        }

        const blueEntity = this.blueFreeEntities.values().next().value;
        this.blueFreeEntities.delete(blueEntity);
        this.blueAllocatedEntities.add(blueEntity);

        var blueAllocatable = BehaviourFinder.GetBehaviour(blueEntity) as unknown as ISlimeObject;
        blueAllocatable?.onAllocate(position, rotation);
        
        return blueEntity;

      case SlimeType.Pink:
        if (this.pinkFreeEntities.size == 0) {
          return null;
        }

        const pinkEntity = this.pinkFreeEntities.values().next().value;
        this.pinkFreeEntities.delete(pinkEntity);
        this.pinkAllocatedEntities.add(pinkEntity);

        var pinkAllocatable = BehaviourFinder.GetBehaviour(pinkEntity) as unknown as ISlimeObject;
        pinkAllocatable?.onAllocate(position, rotation);
        
        return pinkEntity;

      case SlimeType.King:
        if (this.kingFreeEntities.size == 0) {
          return null;
        }

        const kingEntity = this.kingFreeEntities.values().next().value;
        this.kingFreeEntities.delete(kingEntity);
        this.kingAllocatedEntities.add(kingEntity);
        
        var kingAllocatable = BehaviourFinder.GetBehaviour(kingEntity) as unknown as ISlimeObject;
        kingAllocatable?.onAllocate(position, rotation);
        return kingEntity;
    }
    return null;
  }

  public free(entity : Entity | undefined | null){
    if (!entity) {
      return;
    }
    
    const slimeObject = BehaviourFinder.GetBehaviour(entity) as unknown as ISlimeObject;
    if (!slimeObject) {
      return;
    }

    switch (slimeObject.slimeType) {
      case SlimeType.Blue:
        if (!this.blueAllocatedEntities.has(entity)) {
          return;
        }

        this.blueAllocatedEntities.delete(entity);
        this.blueFreeEntities.add(entity);
        slimeObject?.onFree();
        break;

      case SlimeType.Pink:
        if (!this.pinkAllocatedEntities.has(entity)) {
          return;
        }

        this.pinkAllocatedEntities.delete(entity);
        this.pinkFreeEntities.add(entity);
        slimeObject?.onFree();
        break;

      case SlimeType.King:
        if (!this.kingAllocatedEntities.has(entity)) {
          return;
        }

        this.kingAllocatedEntities.delete(entity);
        this.kingFreeEntities.add(entity);
        slimeObject?.onFree();
        break;
    }
  }

  public has(entity: Entity) {
    return this.blueAllocatedEntities.has(entity) || this.blueFreeEntities.has(entity) ||
           this.pinkAllocatedEntities.has(entity) || this.pinkFreeEntities.has(entity) ||
           this.kingAllocatedEntities.has(entity) || this.kingFreeEntities.has(entity);
  }
}
Component.register(SlimeObjectPool);