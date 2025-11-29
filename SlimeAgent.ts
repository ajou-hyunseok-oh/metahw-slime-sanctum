import { Behaviour } from "Behaviour";
import { Entity, PropTypes, Vec3 } from "horizon/core";
import { INavMesh, NavMeshAgent } from "horizon/navmesh";

export interface ISlimeAgent{
  isDead: boolean;
}

export type SlimeAgentBaseProps = {
  agentFPS: number;
  headHeight: number;
  collider: Entity | undefined;
  configName: string;
  arrivalThreshold: number;
};

export class SlimeAgent<TProps extends Record<string, unknown> = Record<string, unknown>> extends Behaviour<typeof SlimeAgent> implements ISlimeAgent {
  static propsDefinition = {
    agentFPS: { type: PropTypes.Number, default: 4 },
    headHeight: { type: PropTypes.Number, default: 1.25 },
    collider: { type: PropTypes.Entity },
    configName: { type: PropTypes.String, default: "slime_default" },
    arrivalThreshold: { type: PropTypes.Number, default: 0.25 }
  };

  isDead: boolean = false;

  private navMesh?: INavMesh | null = null;
  private navAgent?: NavMeshAgent | null = null;
  private frameTimer: number = 0.0;
  private pendingDestination?: Vec3;
  private followTarget?: Entity;

  protected get slimeProps(): SlimeAgentBaseProps & TProps {
    return this.props as unknown as SlimeAgentBaseProps & TProps;
  }

  protected override Start() {
    this.navAgent = this.entity.as(NavMeshAgent);
    this.navAgent?.getNavMesh().then(mesh => { this.navMesh = mesh; });
    this.onSlimeStart();
  }

  protected override Update(deltaTime: number) {
    this.frameTimer += deltaTime;
    this.updateFollowDestination();
    if (this.frameTimer >= 1.0 / this.slimeProps.agentFPS) {
      this.frameTimer = 0;
      this.pushDestinationToAgent();
    }
    this.onSlimeUpdate(deltaTime);
  }

  protected setNavigationTarget(target: Vec3 | undefined) {
    this.pendingDestination = target;
    this.navAgent?.isImmobile.set(target === undefined);
  }

  protected clearNavigationTarget() {
    this.setNavigationTarget(undefined);
  }
  
  protected setTargetEntity(target: Entity | undefined) {
    this.followTarget = target ?? undefined;
    if (this.followTarget) {
      this.updateFollowDestination();
    } else {
      this.clearNavigationTarget();
    }
  }

  private pushDestinationToAgent() {
    if (!this.pendingDestination || !this.navAgent) {
      return;
    }

    const resolvedTarget = this.navMesh?.getNearestPoint(this.pendingDestination, 100) ?? this.pendingDestination;
    this.navAgent.destination.set(resolvedTarget);

    if (this.hasReachedDestination(resolvedTarget)) {
      this.pendingDestination = undefined;
      this.onDestinationReached(resolvedTarget);
    }
  }

  private hasReachedDestination(target: Vec3): boolean {
    const offset = this.entity.position.get().sub(target);
    return offset.magnitude() <= this.slimeProps.arrivalThreshold;
  }

  private updateFollowDestination() {
    if (!this.followTarget) {
      return;
    }
    this.setNavigationTarget(this.followTarget.position.get());
  }

  protected onSlimeStart(): void {}
  protected onSlimeUpdate(deltaTime: number): void {}
  protected onDestinationReached(target: Vec3): void {}
}