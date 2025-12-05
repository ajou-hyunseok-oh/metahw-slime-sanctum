import { Behaviour, BehaviourFinder } from 'Behaviour';
import { Component, Entity, Player, PropTypes, Quaternion, Vec3 } from 'horizon/core';
import { ISlimeObject, SlimeType } from 'SlimeObjectPool';
      
export class SlimeAgent extends Behaviour<typeof SlimeAgent> implements ISlimeObject {
  static propsDefinition = { 
    slimeType: { type: PropTypes.String, default: 'blue' },    
  };

  public slimeType: SlimeType = SlimeType.Blue;

  Awake() {
    switch (this.props.slimeType) {
      case "blue": this.slimeType = SlimeType.Blue;
      case "pink": this.slimeType = SlimeType.Pink;
      case "king": this.slimeType = SlimeType.King;
    }    
  }  

  public onAllocate(position: Vec3, rotation: Quaternion): void {
    this.entity.position.set(position);
    this.entity.rotation.set(rotation);
    this.entity.visible.set(true);
  }

  public onFree(): void {
    this.entity.visible.set(false);
  }
}
Component.register(SlimeAgent);