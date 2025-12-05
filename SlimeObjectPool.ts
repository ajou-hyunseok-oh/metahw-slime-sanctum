import { Behaviour, BehaviourFinder } from 'Behaviour';
import { Component, Entity, Player, Quaternion, Vec3, PropTypes } from 'horizon/core';

export const PullSize = {
  Blue: 4,
  Pink: 3,
  King: 2,
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

    if (this.isFull(type)) {
      if (type === SlimeType.Blue) {
        if (this.blueFreeEntities.size == 0) {
          const oldBlueEntity = this.blueAllocatedEntities.values().next().value;                    
          const slimeObject = BehaviourFinder.GetBehaviour(oldBlueEntity) as unknown as ISlimeObject;
          slimeObject.onFree();
          slimeObject?.onAllocate(position, rotation);
          return oldBlueEntity;
        }

        const blueEntity = this.blueFreeEntities.values().next().value;
        this.blueFreeEntities.delete(blueEntity);
        this.blueAllocatedEntities.add(blueEntity);
        const slimeObject = BehaviourFinder.GetBehaviour(blueEntity) as unknown as ISlimeObject;
        slimeObject?.onAllocate(position, rotation);
        return blueEntity;
      } else if (type === SlimeType.Pink) {
        if (this.pinkFreeEntities.size == 0) {
          const oldPinkEntity = this.pinkAllocatedEntities.values().next().value;                    
          const slimeObject = BehaviourFinder.GetBehaviour(oldPinkEntity) as unknown as ISlimeObject;
          slimeObject.onFree();
          slimeObject?.onAllocate(position, rotation);
          return oldPinkEntity;          
        }

        const pinkEntity = this.pinkFreeEntities.values().next().value;
        this.pinkFreeEntities.delete(pinkEntity);
        this.pinkAllocatedEntities.add(pinkEntity);
        const slimeObject = BehaviourFinder.GetBehaviour(pinkEntity) as unknown as ISlimeObject;
        slimeObject?.onAllocate(position, rotation);
        return pinkEntity;
      } else if (type === SlimeType.King) {
        if (this.kingFreeEntities.size == 0) {
          const oldKingEntity = this.kingAllocatedEntities.values().next().value;                    
          const slimeObject = BehaviourFinder.GetBehaviour(oldKingEntity) as unknown as ISlimeObject;
          slimeObject.onFree();
          slimeObject?.onAllocate(position, rotation);
          return oldKingEntity;
        }

        const kingEntity = this.kingFreeEntities.values().next().value;
        this.kingFreeEntities.delete(kingEntity);
        this.kingAllocatedEntities.add(kingEntity);
        const slimeObject = BehaviourFinder.GetBehaviour(kingEntity) as unknown as ISlimeObject;
        slimeObject?.onAllocate(position, rotation);
        return kingEntity;
      }
    } else {
      if (type === SlimeType.Blue) {
        this.world.spawnAsset(this.props.blueAsset!, position, rotation).then(([entity]) => {
          this.addEntity(entity, true);
          const slimeObject = BehaviourFinder.GetBehaviour(entity) as unknown as ISlimeObject;
          if (slimeObject) {
            slimeObject.onAllocate(position, rotation);
          }
        });
      } else if (type === SlimeType.Pink) {
        this.world.spawnAsset(this.props.pinkAsset!, position, rotation).then(([entity]) => {
          this.addEntity(entity, true);
          const slimeObject = BehaviourFinder.GetBehaviour(entity) as unknown as ISlimeObject;
          if (slimeObject) {
            slimeObject.onAllocate(position, rotation);
          }
        });
      } else if (type === SlimeType.King) {
        this.world.spawnAsset(this.props.kingAsset!, position, rotation).then(([entity]) => {
          this.addEntity(entity, true);
          const slimeObject = BehaviourFinder.GetBehaviour(entity) as unknown as ISlimeObject;
          if (slimeObject) {
            slimeObject.onAllocate(position, rotation);
          }
        });
      }
    }    
  }

  public addEntity(entity : Entity, isAllocated: boolean){    
    const slimeObject = BehaviourFinder.GetBehaviour(entity) as unknown as ISlimeObject;
    if (!slimeObject) {
      return;
    }

    if (isAllocated) {
      switch (slimeObject.slimeType) {
        case SlimeType.Blue: this.blueAllocatedEntities.add(entity); break;
        case SlimeType.Pink: this.pinkAllocatedEntities.add(entity); break;
        case SlimeType.King: this.kingAllocatedEntities.add(entity); break;
      }
    } else {
      switch (slimeObject.slimeType) {
        case SlimeType.Blue: this.blueFreeEntities.add(entity); break;
        case SlimeType.Pink: this.pinkFreeEntities.add(entity); break;
        case SlimeType.King: this.kingFreeEntities.add(entity); break;
      }
    }

    switch (slimeObject.slimeType) {
        case SlimeType.Blue: console.log(`Blue ${this.blueAllocatedEntities.size} + ${this.blueFreeEntities.size} / ${PullSize.Blue}`); break;
        case SlimeType.Pink: console.log(`Pink ${this.pinkAllocatedEntities.size} + ${this.pinkFreeEntities.size} / ${PullSize.Pink}`); break;
        case SlimeType.King: console.log(`King ${this.kingAllocatedEntities.size} + ${this.kingFreeEntities.size} / ${PullSize.King}`); break;
      }
  }

  public isFull(type: SlimeType): boolean {
    switch (type) {
      case SlimeType.Blue:
        return this.blueAllocatedEntities.size + this.blueFreeEntities.size >= PullSize.Blue;
      case SlimeType.Pink:
        return this.pinkAllocatedEntities.size + this.pinkFreeEntities.size >= PullSize.Pink;
      case SlimeType.King:
        return this.kingAllocatedEntities.size + this.kingFreeEntities.size >= PullSize.King;
    }      
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