import { SlimeAgent, SlimeAgentBaseProps } from "SlimeAgent";
import { Component, PropTypes, Vec3 } from "horizon/core";

type SlimeBlueProps = SlimeAgentBaseProps & {
  patrolRadius: number;
};

export class SlimeBlueBrain extends SlimeAgent<SlimeBlueProps> {
  static propsDefinition = {
    ...SlimeAgent.propsDefinition,
    patrolRadius: { type: PropTypes.Number, default: 4 }
  };

  protected override onSlimeStart() {
    this.moveToNextWaypoint();
  }

  protected override onDestinationReached() {
    this.moveToNextWaypoint();
  }

  private moveToNextWaypoint() {
    const origin = this.entity.position.get();
    const offset = new Vec3(this.slimeProps.patrolRadius, 0, 0);
    this.setNavigationTarget(origin.add(offset));
  }
}
Component.register(SlimeBlueBrain);
