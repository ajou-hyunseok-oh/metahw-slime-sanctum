import { SlimeAgent, SlimeAgentBaseProps } from "SlimeAgent";
import { Component, PropTypes, Vec3 } from "horizon/core";

type SlimeKingProps = SlimeAgentBaseProps & {
  thronePosition: Vec3;
  rallyRadius: number;
};

class SlimeKingBrain extends SlimeAgent<SlimeKingProps> {
  static propsDefinition = {
    ...SlimeAgent.propsDefinition,
    thronePosition: { type: PropTypes.Vec3, default: new Vec3(0, 0, 0) },
    rallyRadius: { type: PropTypes.Number, default: 8 }
  };

  protected override onSlimeStart() {
    this.setNavigationTarget(this.slimeProps.thronePosition);
  }

  protected override onDestinationReached() {
    // Guard the throne by pacing in a small circle.
    const orbit = this.entity.position.get();
    orbit.x += this.slimeProps.rallyRadius;
    this.setNavigationTarget(orbit);
  }
}
Component.register(SlimeKingBrain);