import * as hz from 'horizon/core';
import { Behaviour } from 'Behaviour';
import { NavMeshAgent, INavMesh } from 'horizon/navmesh';

class SlimeNPC extends Behaviour<typeof SlimeNPC> {
  static propsDefinition = {
    wanderRadius: { type: hz.PropTypes.Number, default: 8 },
    wanderInterval: { type: hz.PropTypes.Number, default: 2.5 },
    agentFPS: { type: hz.PropTypes.Number, default: 4 },
    moveSpeed: { type: hz.PropTypes.Number, default: 3 },
    stoppingDistance: { type: hz.PropTypes.Number, default: 0.6 },
    model: { type: hz.PropTypes.Entity },
  };

  private navAgent: NavMeshAgent | null = null;
  private navMesh: INavMesh | null = null;

  private frameTimer: number = 0;
  private wanderTimer: number = 0;
  private currentTarget: hz.Vec3 | null = null;
  private origin: hz.Vec3 = new hz.Vec3(0, 0, 0);

  // Idle 애니메이션(슬라임 기본 숨쉬기)
  private idleScaleActive: boolean = false;
  private idleScaleProgress: number = 0;
  private readonly idleScaleSlowDuration: number = 1.8;
  private readonly idleScaleFastDuration: number = 1.0;
  private readonly idleScaleNormal: hz.Vec3 = new hz.Vec3(1, 1, 1);
  private readonly idleScaleCompressed: hz.Vec3 = new hz.Vec3(1.1, 0.85, 1.1);

  protected override Start() {
    this.navAgent = this.entity.as(NavMeshAgent);
    this.origin = this.entity.position.get();

    if (this.navAgent) {
      this.navAgent.maxSpeed.set(this.props.moveSpeed ?? 3);
      this.navAgent.isImmobile.set(false);
      this.navAgent.getNavMesh().then(mesh => {
        this.navMesh = mesh ?? null;
      });
    }

    this.startIdleScaleAnimation();
    this.pickNewDestination(true);
  }

  protected override Update(deltaTime: number) {
    if (!this.navAgent || !this.navMesh) {
      return;
    }

    this.wanderTimer += deltaTime;
    this.frameTimer += deltaTime;

    const shouldPick =
      this.wanderTimer >= this.props.wanderInterval ||
      this.isCloseToTarget(this.props.stoppingDistance ?? 0.6);

    if (shouldPick) {
      this.pickNewDestination(false);
    }

    if (this.frameTimer >= 1 / Math.max(0.1, this.props.agentFPS ?? 4)) {
      this.frameTimer = 0;
      if (this.currentTarget) {
        const nearest = this.navMesh.getNearestPoint(this.currentTarget, 4) ?? this.currentTarget;
        this.navAgent.destination.set(nearest);
      }
    }

    this.updateIdleScaleAnimation(deltaTime);
  }

  private pickNewDestination(force: boolean) {
    if (!force && !this.navMesh) return;

    const radius = Math.max(0.5, this.props.wanderRadius ?? 8);
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * radius;
    const offset = new hz.Vec3(Math.cos(angle) * distance, 0, Math.sin(angle) * distance);
    const rawTarget = this.origin.add(offset);
    this.currentTarget = rawTarget;
    this.wanderTimer = 0;
  }

  private isCloseToTarget(threshold: number): boolean {
    if (!this.currentTarget) return true;
    const distSq = this.entity.position.get().distanceSquared(this.currentTarget);
    return distSq <= Math.pow(threshold, 2);
  }

  // --- Idle scale animation (SlimeAgent Idle 기반) ---
  private startIdleScaleAnimation() {
    if (this.idleScaleActive) return;
    this.idleScaleActive = true;
    this.idleScaleProgress = 0;
    this.applyIdleScale(0);
  }

  private updateIdleScaleAnimation(deltaTime: number) {
    if (!this.idleScaleActive) return;

    const modelEntity = this.props.model ?? this.entity;
    if (!modelEntity) return;

    const duration = this.getIdleCycleDuration();
    const progressDelta = deltaTime / duration;
    this.idleScaleProgress = (this.idleScaleProgress + progressDelta) % 1;
    const currentScale = this.calculateIdleScale(this.idleScaleProgress);

    modelEntity.scale.set(currentScale);
  }

  private getIdleCycleDuration(): number {
    // 이동 속도와 무관하게 Idle 상태 기준 값을 사용
    return this.idleScaleSlowDuration + (this.idleScaleFastDuration - this.idleScaleSlowDuration) * 0.0;
  }

  private calculateIdleScale(progress: number): hz.Vec3 {
    if (progress < 0.5) {
      const t = progress / 0.5;
      return this.lerpVec3(this.idleScaleNormal, this.idleScaleCompressed, t);
    }
    const t = (progress - 0.5) / 0.5;
    return this.lerpVec3(this.idleScaleCompressed, this.idleScaleNormal, t);
  }

  private applyIdleScale(progress: number) {
    const modelEntity = this.props.model ?? this.entity;
    if (!modelEntity) return;
    modelEntity.scale.set(this.calculateIdleScale(progress));
  }

  private lerpVec3(start: hz.Vec3, end: hz.Vec3, t: number): hz.Vec3 {
    const x = start.x + (end.x - start.x) * t;
    const y = start.y + (end.y - start.y) * t;
    const z = start.z + (end.z - start.z) * t;
    return new hz.Vec3(x, y, z);
  }
}
hz.Component.register(SlimeNPC);