import * as hz from 'horizon/core';
import { INavMesh, NavMeshAgent } from 'horizon/navmesh';

/**
 * 슬라임의 상태를 정의합니다.
 */
enum SlimeState {
  Spawn = "Spawn",     // 생성 중
  Idle = "Idle",       // 대기 중 (시야 범위 내 플레이어 없음)
  Move = "Move",       // 이동 중 (시야 범위 내 플레이어 추적)
  Attack = "Attack",   // 공격 중
  Death = "Death"      // 사망
}

type Props = {};

export class SlimeController extends hz.Component<Props> {
  static propsDefinition = {};

  private currentTarget?: hz.Player;
  private agent!: NavMeshAgent;
  private navmesh!: INavMesh;
  private lastKnownGood: hz.Vec3 = hz.Vec3.zero;
  private state: SlimeState = SlimeState.Spawn;
  private stateStartTime = 0;
  private animationStartTime = 0;
  private attackAnimationStartTime = -1;
  private animationSubscription?: hz.EventSubscription;
  private isAttackAnimating = false;

  // Animation parameters
  private readonly ANIMATION_DURATION = 1.25;
  private readonly SCALE_NORMAL = new hz.Vec3(1.0, 1.0, 1.0);
  private readonly SCALE_COMPRESSED = new hz.Vec3(1.2, 0.85, 1.2);
  private readonly ATTACK_ANIMATION_DURATION = 0.4;
  private readonly SCALE_ATTACK_EXPAND = new hz.Vec3(1.3, 1.2, 1.3);
  private readonly SCALE_ATTACK_COMPRESS = new hz.Vec3(0.9, 0.6, 0.9);
  private readonly ATTACK_RANGE = 1.5;
  private readonly SPAWN_DURATION = 1.0;
  private readonly ATTACK_IDLE_MULTIPLIER = 1.6;
  private readonly ATTACK_COOLDOWN = 1.5;
  private lastAttackTime = 0;

  start() {
    this.agent = this.entity.as(NavMeshAgent)!;
    // NavMeshAgent는 기본값으로 고정(immobile)되어 있을 수 있으므로 반드시 해제해 이동 가능하게 한다.
    if (this.agent.isImmobile.get()) {
      this.agent.isImmobile.set(false);
    }

    this.agent.getNavMesh().then(mesh => {
      this.navmesh = mesh!;
    });

    // Navigation 업데이트는 250ms 간격으로 유지 (성능 최적화)
    this.async.setInterval(this.updateNavigation, 1000 / 4);

    this.lastKnownGood = this.entity.position.get();
    this.setState(SlimeState.Spawn);
    this.animationSubscription = this.connectLocalBroadcastEvent(
      hz.World.onUpdate,
      (data: { deltaTime: number }) => this.updateAnimations(data.deltaTime)
    );
  }

  /**
   * Called by SlimeRadar when a player enters the trigger.
   */
  public onTargetFound(player: hz.Player) {
    console.log(`[SlimeController] Target found: ${player.name.get()}`);
    this.setTarget(player);
  }

  /**
   * Called by SlimeRadar when a player leaves the trigger.
   */
  public onTargetLost(player: hz.Player) {
    if (this.currentTarget && this.currentTarget.id === player.id) {
      this.clearTarget();
      this.setState(SlimeState.Idle);
    }
  }

  public setTarget(player: hz.Player) {
    this.currentTarget = player;
    // Immediately update destination if possible
    this.updateNavigation();
  }

  public clearTarget() {
    this.currentTarget = undefined;
    if (this.agent) {
      // Stop movement by setting destination to current position or clearing it if API supports
      this.agent.destination.set(this.entity.position.get());
    }
  }

  /**
   * Navigation 업데이트 - 250ms 간격으로 호출
   */
  private updateNavigation = () => {
    this.handleSpawnTransition();

    let distanceToTarget: number | undefined;
    let slimePos: hz.Vec3 | undefined;
    if (this.currentTarget && this.entity) {
      slimePos = this.entity.position.get();
      const targetWorldPos = this.currentTarget.position.get();
      distanceToTarget = this.calculateDistanceXZ(slimePos, targetWorldPos);
    }

    if (this.currentTarget) {
      const targetWorldPos = this.currentTarget.position.get();
      let targetPos: hz.Vec3 = this.lastKnownGood;
      if (this.navmesh) {
        const projected = this.navmesh.getNearestPoint(targetWorldPos, 3);
        if (projected) {
          targetPos = projected;
          this.lastKnownGood = projected;
        }
      }

      if (distanceToTarget !== undefined && distanceToTarget <= this.ATTACK_RANGE) {
        this.setState(SlimeState.Attack);
        this.agent.destination.set(this.entity.position.get());
        this.tryAttackTarget();
      } else {
        let finalTarget = targetPos;
        if (this.navmesh) {
          const reprojected = this.navmesh.getNearestPoint(finalTarget, 3);
          if (reprojected) {
            finalTarget = reprojected;
            this.lastKnownGood = reprojected;
          }
        }
        this.agent.destination.set(finalTarget);
        this.setState(SlimeState.Move);
      }

      // 슬라임 본체를 플레이어 방향으로 회전
      this.faceTowardsTarget(targetWorldPos);
    } else if (this.state !== SlimeState.Spawn) {
      this.setState(SlimeState.Idle);
    }
  };

  /**
   * 슬라임 본체가 타겟(플레이어)을 바라보도록 회전시킵니다.
   */
  private faceTowardsTarget(targetPos: hz.Vec3) {
    const slimePos = this.entity.position.get();
    const direction = new hz.Vec3(
      targetPos.x - slimePos.x,
      0,
      targetPos.z - slimePos.z,
    );

    if (direction.magnitudeSquared() < 0.0001) {
      return;
    }

    const angle = Math.atan2(direction.x, direction.z);
    const rotation = hz.Quaternion.fromEuler(new hz.Vec3(0, angle * (180 / Math.PI), 0));
    this.entity.rotation.set(rotation);
  }

  private handleSpawnTransition() {
    if (this.state !== SlimeState.Spawn) {
      return;
    }
    const elapsed = this.getTimeSeconds() - this.stateStartTime;
    if (elapsed >= this.SPAWN_DURATION) {
      this.setState(this.currentTarget ? SlimeState.Move : SlimeState.Idle);
    }
  }

  private setState(newState: SlimeState) {
    if (this.state === newState) {
      return;
    }
    this.state = newState;
    this.stateStartTime = this.getTimeSeconds();
    switch (newState) {
      case SlimeState.Spawn:
      case SlimeState.Idle:
      case SlimeState.Move:
        this.animationStartTime = this.stateStartTime;
        this.attackAnimationStartTime = -1;
        this.isAttackAnimating = false;
        if (this.entity) {
          this.entity.scale.set(this.SCALE_NORMAL);
        }
        break;
      case SlimeState.Attack:
        this.attackAnimationStartTime = this.stateStartTime;
        this.isAttackAnimating = false;
        break;
      case SlimeState.Death:
        this.attackAnimationStartTime = -1;
        this.isAttackAnimating = false;
        break;
    }
  }

  private updateAnimations(_deltaTime: number) {
    if (!this.entity) {
      return;
    }
    switch (this.state) {
      case SlimeState.Spawn:
      case SlimeState.Idle:
      case SlimeState.Move:
        this.updateIdleMoveAnimation();
        break;
      case SlimeState.Attack:
        this.updateAttackAnimation();
        break;
      case SlimeState.Death:
        break;
    }
  }

  private updateIdleMoveAnimation() {
    const currentTime = this.getTimeSeconds();
    const elapsed = currentTime - this.animationStartTime;
    const progress = (elapsed % this.ANIMATION_DURATION) / this.ANIMATION_DURATION;
    let currentScale: hz.Vec3;

    if (progress < 0.5) {
      const t = progress * 2;
      const eased = this.easeInOutQuad(t);
      currentScale = this.lerpVec3(this.SCALE_NORMAL, this.SCALE_COMPRESSED, eased);
    } else {
      const t = (progress - 0.5) * 2;
      const eased = this.easeInOutQuad(t);
      currentScale = this.lerpVec3(this.SCALE_COMPRESSED, this.SCALE_NORMAL, eased);
    }
    this.entity.scale.set(currentScale);
  }

  private updateAttackAnimation() {
    if (!this.entity) {
      return;
    }
    const currentTime = this.getTimeSeconds();
    if (this.isAttackAnimating) {
      if (this.attackAnimationStartTime < 0) {
        this.attackAnimationStartTime = currentTime;
      }
      let elapsed = currentTime - this.attackAnimationStartTime;
      if (elapsed >= this.ATTACK_ANIMATION_DURATION) {
        this.isAttackAnimating = false;
        this.attackAnimationStartTime = currentTime;
        this.entity.scale.set(this.SCALE_NORMAL);
        return;
      }
      const progress = elapsed / this.ATTACK_ANIMATION_DURATION;
      let currentScale: hz.Vec3;
      if (progress < 0.3) {
        const t = progress / 0.3;
        const eased = this.easeOutQuad(t);
        currentScale = this.lerpVec3(this.SCALE_NORMAL, this.SCALE_ATTACK_EXPAND, eased);
      } else if (progress < 0.7) {
        const t = (progress - 0.3) / 0.4;
        const eased = this.easeInOutQuad(t);
        currentScale = this.lerpVec3(this.SCALE_ATTACK_EXPAND, this.SCALE_ATTACK_COMPRESS, eased);
      } else {
        const t = (progress - 0.7) / 0.3;
        const eased = this.easeInQuad(t);
        currentScale = this.lerpVec3(this.SCALE_ATTACK_COMPRESS, this.SCALE_NORMAL, eased);
      }
      this.entity.scale.set(currentScale);
    } else {
      if (this.attackAnimationStartTime < 0) {
        this.attackAnimationStartTime = currentTime;
      }
      const duration = this.ANIMATION_DURATION * this.ATTACK_IDLE_MULTIPLIER;
      const elapsed = currentTime - this.attackAnimationStartTime;
      const progress = (elapsed % duration) / duration;
      let currentScale: hz.Vec3;
      if (progress < 0.5) {
        const t = progress * 2;
        const eased = this.easeInOutQuad(t);
        currentScale = this.lerpVec3(this.SCALE_NORMAL, this.SCALE_COMPRESSED, eased);
      } else {
        const t = (progress - 0.5) * 2;
        const eased = this.easeInOutQuad(t);
        currentScale = this.lerpVec3(this.SCALE_COMPRESSED, this.SCALE_NORMAL, eased);
      }
      this.entity.scale.set(currentScale);
    }
  }

  private lerpVec3(a: hz.Vec3, b: hz.Vec3, t: number): hz.Vec3 {
    return new hz.Vec3(this.lerp(a.x, b.x, t), this.lerp(a.y, b.y, t), this.lerp(a.z, b.z, t));
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  private easeOutQuad(t: number): number {
    return 1 - (1 - t) * (1 - t);
  }

  private easeInQuad(t: number): number {
    return t * t;
  }

  private tryAttackTarget() {
    if (!this.currentTarget || this.state !== SlimeState.Attack) {
      return;
    }
    const currentTime = this.getTimeSeconds();
    if (currentTime - this.lastAttackTime < this.ATTACK_COOLDOWN) {
      return;
    }
    this.lastAttackTime = currentTime;
    this.isAttackAnimating = true;
    this.attackAnimationStartTime = currentTime;
    // TODO: 접촉 시 데미지 적용 로직을 연결
    console.log('[SlimeController] Attack triggered');
  }

  private calculateDistanceXZ(a: hz.Vec3, b: hz.Vec3): number {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  private getTimeSeconds(): number {
    return Date.now() / 1000;
  }

  onDestroy(): void {
    if (this.animationSubscription) {
      this.animationSubscription.disconnect();
      this.animationSubscription = undefined;
    }
  }
}
hz.Component.register(SlimeController);