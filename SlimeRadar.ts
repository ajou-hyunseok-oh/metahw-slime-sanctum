import { BehaviourFinder } from 'Behaviour';
import { CodeBlockEvents, Component, Entity, Player } from 'horizon/core';
import { SlimeAgent } from './SlimeAgent';

class SlimeRadar extends Component<typeof SlimeRadar> {
  static propsDefinition = {};

  private slimeAgent: SlimeAgent | null = null;

  preStart() {
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerEnterTrigger, this.OnPlayerEnterTrigger.bind(this));
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerExitTrigger, this.OnPlayerExitTrigger.bind(this));
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnEntityEnterTrigger, this.OnEntityEnterTrigger.bind(this));
    this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnEntityExitTrigger, this.OnEntityExitTrigger.bind(this));
  }

  start() {    
    const parentEntity = this.entity.parent.get();
    this.slimeAgent = BehaviourFinder.GetBehaviour<SlimeAgent>(parentEntity) ?? null;
    if (this.slimeAgent == null) {
      console.warn(`[SlimeRadar] SlimeAgent not found on parent of ${this.entity.name.get()}`);
    }
  }

  OnPlayerEnterTrigger(player: Player) {    
    console.log(`Player ${player.name.get()} entered trigger`);
  }

  OnPlayerExitTrigger(player: Player) {    
    console.log(`Player ${player.name.get()} exited trigger`);
  }

  OnEntityEnterTrigger(entity: Entity) {    
    console.log(`Entity ${entity.name.get()} entered trigger`);
  }

  OnEntityExitTrigger(entity: Entity) {
    console.log(`Entity ${entity.name.get()} exited trigger`);
  }
}
Component.register(SlimeRadar);