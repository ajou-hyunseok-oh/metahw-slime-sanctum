import { SlimeAgent, SlimeAgentBaseProps } from "SlimeAgent";
import { Component, PropTypes, Vec3 } from "horizon/core";

type SlimePinkProps = SlimeAgentBaseProps & {
  idlePoint: Vec3;
};

class SlimePinkBrain extends SlimeAgent<SlimePinkProps> {
  static propsDefinition = {
    ...SlimeAgent.propsDefinition,
    idlePoint: { type: PropTypes.Vec3, default: new Vec3(0, 0, 0) }
  };

  protected override onSlimeStart() {
    this.setNavigationTarget(this.slimeProps.idlePoint);
  }

  protected override onDestinationReached() {
    // Stay idle at the idlePoint until told otherwise.
    this.setNavigationTarget(this.slimeProps.idlePoint);
  }
}
Component.register(SlimePinkBrain);