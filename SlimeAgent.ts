import { Behaviour } from "Behaviour";
import { Events } from "Events";
import { FloatingTextManager } from "FloatingTextManager";
import { Color, Component, Player, PropTypes, Quaternion, Vec3, Entity, AudioGizmo, ParticleGizmo } from "horizon/core";
import { INavMesh, NavMeshAgent } from "horizon/navmesh";
import { SLIME_BASE_STATS, SlimeStats } from "GameBalanceData";
import { ObjectPool } from "ObjectPool";
import { ISlimeObject, SlimeType } from "SlimeObjectPool";
import { MatchStateManager } from "MatchStateManager";

export enum SlimeState {
  Idle = "Idle", 
  Move = "Move", 
  Attack = "Attack", 
  Hit = "Hit", 
  HitMagic = "HitMagic", 
  Dead = "Dead", 
  MoveCore = "MoveCore", 
  AttackCore = "AttackCore", 
}

export enum SlimeAnimation {
  Idle = "Idle", 
  Move = "Move", 
  Attack = "Attack", 
  Hit = "Hit", 
}

export interface SlimeHealthSnapshot {
  current: number;
  max: number;
}

export class SlimeAgent extends Behaviour<typeof SlimeAgent> implements ISlimeObject {
  static propsDefinition = {
    agentFPS: { type: PropTypes.Number, default: 4 },    
    slimeType: { type: PropTypes.String, default: 'blue' },
    stoppingDistance: { type: PropTypes.Number, default: 1.5 },
    attackDistance: { type: PropTypes.Number, default: 2.0 },
    model: { type: PropTypes.Entity }, 
    collider: { type: PropTypes.Entity },        
    attackSFX: { type: PropTypes.Entity },
    dieSFX: { type: PropTypes.Entity },
    hitSFX: { type: PropTypes.Entity },
    hitVFX: { type: PropTypes.Entity },
    hitMagicVFX: { type: PropTypes.Entity },
    dieVFX: { type: PropTypes.Entity },
    noesisUI: { type: PropTypes.Entity },
  };

  public slimeType: SlimeType = SlimeType.Blue;

  private core: Entity | null = null;
  private static readonly activeAgents: Set<SlimeAgent> = new Set();

  // State Management
  private currentState: SlimeState | null = null; // 초기값 null로 변경하여 첫 진입 보장
  private previousState: SlimeState = SlimeState.Idle; // 복귀를 위한 이전 상태 저장
  private stateTimer: number = 0;

  // Animation Variables
  private currentAnimation: SlimeAnimation | null = null;
  private animSpeed: number = 0.0; 
  
  private idleScaleActive: boolean = false;
  private idleScaleProgress: number = 0;
  private readonly idleScaleSlowDuration: number = 1.8;
  private readonly idleScaleFastDuration: number = 1.0;
  private readonly idleScaleNormal: Vec3 = new Vec3(1, 1, 1);
  private readonly idleScaleCompressed: Vec3 = new Vec3(1.1, 0.85, 1.1);
  
  private attackScaleActive: boolean = false;
  private attackScaleElapsed: number = 0;
  private readonly attackScaleDuration: number = 0.6;
  private readonly attackScaleExpand: Vec3 = new Vec3(1.2, 0.8, 1.2);
  private readonly attackScaleCompress: Vec3 = new Vec3(0.9, 1.2, 0.9);

  protected hitPoints: number = 1;
  protected maxHitPoints: number = 1;
  private hpSubscribers: Set<(snapshot: SlimeHealthSnapshot) => void> = new Set();
  public isDead: boolean = false;


  protected override Awake(): void {
    super.Awake();
    SlimeAgent.activeAgents.add(this);

    switch (this.props.slimeType) {
      case "blue": this.slimeType = SlimeType.Blue; break;
      case "pink": this.slimeType = SlimeType.Pink; break;
      case "king": this.slimeType = SlimeType.King; break;
    }
  }

  private navMesh?: INavMesh | null = null;
  private navAgent?: NavMeshAgent | null = null;
  private frameTimer: number = 0.0;

  private nextTarget?: Vec3 | undefined;
  
  protected targetPlayer: Player | undefined = undefined;
  private autoAcquireTimer: number = 0;
  
  protected config: SlimeStats | null = null;
  private owningPool: ObjectPool | null = null;
  private readonly poolRestingPosition: Vec3 = new Vec3(0, -9999, 0);
  private pendingRecycleHandle: number | null = null;

  Start() {
    // NpcConfigStore 대체: GameBalanceData 사용
    this.config = SLIME_BASE_STATS[this.props.slimeType];
    if (!this.config) {
      console.error("SlimeAgent::Start() Attempted to load config for undefined config name: " + this.props.slimeType);
      // Fallback
      this.config = SLIME_BASE_STATS["default"];
    }

    this.navAgent = this.entity.as(NavMeshAgent)!;
    if (this.config && this.config.runSpeed) {
      this.navAgent.maxSpeed.set(this.config.runSpeed);
    }

    this.navAgent.getNavMesh().then(mesh => { this.navMesh = mesh!; });

    this.connectNetworkEvent(this.props.collider ?? this.entity, Events.meleeHit, this.onMeleeHit.bind(this));
    this.connectNetworkEvent(this.entity, Events.meleeHit, this.onMeleeHit.bind(this));
  }

  public assignCore(core: Entity | null) {
    this.core = core;
  }
  
  public triggerCoreAttack() {
    if (this.core) {
      this.changeState(SlimeState.MoveCore);
    }
  }

  public assignOwningPool(pool: ObjectPool | null) {
    this.owningPool = pool;
  }

  public prepareForPoolStorage() {
    this.moveEntityToPoolRestingState();
  }

  public onAllocate(position: Vec3, rotation: Quaternion, owner?: Player | null) {
    if (this.pendingRecycleHandle !== null) {
      this.async.clearTimeout(this.pendingRecycleHandle);
      this.pendingRecycleHandle = null;
    }

    this.entity.position.set(position);
    this.entity.rotation.set(rotation);
    this.setModelVisibility(true);    ;
    
    this.isDead = false;
    this.targetPlayer = owner ?? undefined;
    this.seedHitPointsFromConfig();

    // 초기화 문제 수정: currentState를 null로 설정해두고 changeState 호출
    this.currentState = null; 
    this.previousState = SlimeState.Idle;
    this.changeState(SlimeState.Idle);
    
    this.onRevivedFromPool();
  }

  public onFree() {
    this.moveEntityToPoolRestingState();
    this.onReturnedToPool();
  }

  protected recycleSelf(delayMs: number = 0) {
    const release = () => {
      this.pendingRecycleHandle = null;
      if (this.owningPool) {
        this.setModelVisibility(false);
        this.owningPool.free(this.entity);
      } else {
        this.world.deleteAsset(this.entity);
      }
    };

    if (delayMs <= 0) {
      release();
    } else {
      this.pendingRecycleHandle = this.async.setTimeout(release, delayMs);
    }
  }

  protected onRevivedFromPool(): void { }
  protected onReturnedToPool(): void { }

  private moveEntityToPoolRestingState() {
    this.entity.position.set(this.poolRestingPosition);
    this.navAgent?.isImmobile.set(true);    
    this.setModelVisibility(false);
    this.targetPlayer = undefined;
    this.nextTarget = undefined;
    this.currentState = null; // 상태 초기화
    this.stopIdleScaleAnimation(true);
    this.stopAttackScaleAnimation(true);
  }

  protected setModelVisibility(visible: boolean) {
    this.entity.visible.set(visible);
    this.props.collider?.collidable.set(visible);
    this.props.noesisUI?.visible.set(visible);
  }

  Update(deltaTime: number) {
    this.frameTimer += deltaTime;
    this.stateTimer += deltaTime;

    if (this.currentState) {
        this.onUpdateState(deltaTime);
    }
    this.updateRotationLock();
    this.updateSpeedAnimationParameters();

    this.updateIdleScaleAnimation(deltaTime);
    this.updateAttackScaleAnimation(deltaTime);
  }

  public changeState(newState: SlimeState) {
    if (this.currentState === newState) return;

    if (this.currentState) {
        this.onExitState(this.currentState);
        // Hit 상태로 갈 때는 이전 상태를 저장
        if (newState === SlimeState.Hit || newState === SlimeState.HitMagic) {
            this.previousState = this.currentState;
        }
    }
    
    this.currentState = newState;
    this.stateTimer = 0;
    this.onEnterState(newState);
  }

  private onEnterState(state: SlimeState) {
    const anim = this.getAnimationForState(state);
    this.playAnimation(anim);

    switch (state) {
      case SlimeState.Idle:
        this.navAgent?.isImmobile.set(true);
        break;

      case SlimeState.Move:
        this.navAgent?.isImmobile.set(false);
        this.setSpeed('normal');
        break;

      case SlimeState.Attack:
        this.navAgent?.isImmobile.set(true);
        break;

      case SlimeState.Hit:
      case SlimeState.HitMagic:
        this.navAgent?.isImmobile.set(true);
        break;

      case SlimeState.Dead:
        this.navAgent?.isImmobile.set(true);
        this.isDead = true;        
        this.setModelVisibility(false);        
        
        if (this.props.dieSFX) {
          this.props.dieSFX.as(AudioGizmo)?.play();
        }
        if (this.props.dieVFX) {
          this.props.dieVFX.as(ParticleGizmo)?.play();
        }

        this.recycleSelf(2000);
        break;

      case SlimeState.MoveCore:
        this.targetPlayer = undefined;
        this.navAgent?.isImmobile.set(false);
        this.setSpeed('slow');
        if (this.core) {
            this.nextTarget = this.core.position.get();
        }
        break;

      case SlimeState.AttackCore:
        this.navAgent?.isImmobile.set(true);
        break;
    }
  }

  private onUpdateState(deltaTime: number) {
    switch (this.currentState) {
      case SlimeState.Idle:
        this.updateIdleState(deltaTime);
        break;
      case SlimeState.Move:
        this.updateMoveState(deltaTime);
        break;
      case SlimeState.Attack:
        this.updateAttackState(deltaTime);
        break;
      case SlimeState.Hit:
      case SlimeState.HitMagic:
        if (this.stateTimer > 0.5) {
            // 복귀 로직 개선: 이전 상태가 유효하면 복귀, 아니면 Idle
            this.returnToPreviousState();
        }
        break;
      case SlimeState.MoveCore:
        this.updateMoveCoreState(deltaTime);
        break;
      case SlimeState.AttackCore:
        break;
    }
  }

  private onExitState(state: SlimeState) {
    // 상태 종료 시 필요한 정리 작업
  }

  private returnToPreviousState() {
      // 이전 상태로 복귀하되, 상황이 바뀌었을 수 있으므로 유효성 체크
      if (this.previousState === SlimeState.MoveCore || this.previousState === SlimeState.AttackCore) {
          this.changeState(SlimeState.MoveCore); // 코어 모드면 MoveCore로 복귀
      } else {
          // 기본 모드면 플레이어 있는지 체크
          if (this.targetPlayer) {
              this.changeState(SlimeState.Move);
          } else {
              this.changeState(SlimeState.Idle);
          }
      }
  }

  // --- State Logic Implementations ---

  private updateIdleState(deltaTime: number) {
    this.updateAutoAcquireTarget(deltaTime);
    if (this.targetPlayer) {
      this.changeState(SlimeState.Move);
    }
  }

  private updateMoveState(deltaTime: number) {
    if (!this.targetPlayer) {
      this.changeState(SlimeState.Idle);
      return;
    }

    this.updateAutoAcquireTarget(deltaTime);
    if (!this.targetPlayer) {
        this.changeState(SlimeState.Idle);
        return;
    }

    this.nextTarget = this.targetPlayer.position.get();

    const distSq = this.entity.position.get().distanceSquared(this.nextTarget);
    const attackDist = this.props.attackDistance;
    
    if (distSq <= attackDist * attackDist) {
      this.changeState(SlimeState.Attack);
    } else {
      this.updateNavigationMovement();
    }
  }

  private updateAttackState(deltaTime: number) {
    if (!this.targetPlayer) {
      this.changeState(SlimeState.Idle);
      return;
    }

    const distSq = this.entity.position.get().distanceSquared(this.targetPlayer.position.get());
    const attackDist = this.props.attackDistance;
    
    if (distSq > Math.pow(attackDist * 1.2, 2)) {
      this.changeState(SlimeState.Move);
    } else {
      this.lookAtTarget(this.targetPlayer.position.get());
    }
  }

  private updateMoveCoreState(deltaTime: number) {
    if (!this.core) {
      this.changeState(SlimeState.Idle);
      return;
    }

    this.nextTarget = this.core.position.get();
    
    const distSq = this.entity.position.get().distanceSquared(this.nextTarget);
    const attackDist = this.props.attackDistance;

    if (distSq <= attackDist * attackDist) {
      this.changeState(SlimeState.AttackCore);
    } else {
      this.updateNavigationMovement();
    }
  }

  private getAnimationForState(state: SlimeState): SlimeAnimation {
    switch (state) {
      case SlimeState.Idle: return SlimeAnimation.Idle;
      case SlimeState.Move: 
      case SlimeState.MoveCore: return SlimeAnimation.Move;
      case SlimeState.Attack: 
      case SlimeState.AttackCore: return SlimeAnimation.Attack;
      case SlimeState.Hit: 
      case SlimeState.HitMagic: return SlimeAnimation.Hit;
      case SlimeState.Dead: return SlimeAnimation.Hit; 
      default: return SlimeAnimation.Idle;
    }
  }

  private playAnimation(anim: SlimeAnimation) {
    this.currentAnimation = anim;

    switch (anim) {
        case SlimeAnimation.Idle:
        case SlimeAnimation.Move:
            this.stopAttackScaleAnimation(true);
            this.startIdleScaleAnimation();
            break;
        case SlimeAnimation.Attack:
            this.stopIdleScaleAnimation(true);
            this.startAttackScaleAnimation();
            break;
        case SlimeAnimation.Hit:
            this.stopIdleScaleAnimation(true);
            this.stopAttackScaleAnimation(true);
            break;
    }
  }

  private updateSpeedAnimationParameters() {
    if (!this.navAgent || !this.config) {
        this.animSpeed = 0;
        return;
    }

    const currentSpeed = this.navAgent.currentSpeed.get();
    const runSpeed = this.config.runSpeed || 4.0;

    let ratio = currentSpeed / runSpeed;
    ratio = Math.max(0, Math.min(ratio, 1.5)); 
    this.animSpeed = ratio;
  }

  private startIdleScaleAnimation() {
    if (this.idleScaleActive) return;
    this.idleScaleActive = true;
    this.idleScaleProgress = 0;
    this.applyIdleScale(0);
  }

  private stopIdleScaleAnimation(resetToDefault: boolean = false) {
    if (!this.idleScaleActive && !resetToDefault) return;
    this.idleScaleActive = false;
    if (resetToDefault) {
      const modelEntity = this.props.model ?? this.entity;
      modelEntity.scale.set(this.idleScaleNormal);
    }
  }

  private updateIdleScaleAnimation(deltaTime: number) {
    if (!this.idleScaleActive) return;

    const modelEntity = this.props.model ?? this.entity;
    if (!modelEntity) return;

    let baseDuration = this.idleScaleSlowDuration;
    
    if (this.currentState === SlimeState.Move || this.currentState === SlimeState.MoveCore) {
        const t = Math.min(this.animSpeed, 1.0);
        baseDuration = this.idleScaleSlowDuration + (this.idleScaleFastDuration - this.idleScaleSlowDuration) * t;
    }

    const duration = Math.max(0.1, baseDuration);
        
    const progressDelta = deltaTime / duration;
    this.idleScaleProgress = (this.idleScaleProgress + progressDelta) % 1;
    const progress = this.idleScaleProgress;
    const currentScale = this.calculateIdleScale(progress);

    modelEntity.scale.set(currentScale);
  }

  private calculateIdleScale(progress: number): Vec3 {
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

  private startAttackScaleAnimation() {
    this.attackScaleActive = true;
    this.attackScaleElapsed = 0;
    this.applyAttackScale(0);
  }

  private stopAttackScaleAnimation(resetToDefault: boolean = false) {
    if (!this.attackScaleActive && !resetToDefault) return;
    this.attackScaleActive = false;
    if (resetToDefault) {
      const modelEntity = this.props.model ?? this.entity;
      modelEntity.scale.set(this.idleScaleNormal);
    }
  }

  private updateAttackScaleAnimation(deltaTime: number) {
    if (!this.attackScaleActive) return;

    const modelEntity = this.props.model ?? this.entity;
    if (!modelEntity) return;

    this.attackScaleElapsed += deltaTime;
    
    if (this.attackScaleElapsed >= this.attackScaleDuration) {
       this.attackScaleElapsed = 0; 
    }

    const progress = this.attackScaleElapsed / this.attackScaleDuration;
    const currentScale = this.calculateAttackScale(progress);
    modelEntity.scale.set(currentScale);
  }

  private calculateAttackScale(progress: number): Vec3 {
    if (progress < 0.3) {
      const t = progress / 0.3;
      return this.lerpVec3(this.idleScaleNormal, this.attackScaleExpand, t);
    }
    if (progress < 0.7) {
      const t = (progress - 0.3) / 0.4;
      return this.lerpVec3(this.attackScaleExpand, this.attackScaleCompress, t);
    }
    const t = (progress - 0.7) / 0.3;
    return this.lerpVec3(this.attackScaleCompress, this.idleScaleNormal, t);
  }

  private applyAttackScale(progress: number) {
    const modelEntity = this.props.model ?? this.entity;
    if (!modelEntity) return;
    modelEntity.scale.set(this.calculateAttackScale(progress));
  }
  
  private lerpVec3(start: Vec3, end: Vec3, t: number): Vec3 {
    const x = start.x + (end.x - start.x) * t;
    const y = start.y + (end.y - start.y) * t;
    const z = start.z + (end.z - start.z) * t;
    return new Vec3(x, y, z);
  }

  private onMeleeHit(data: { hitPos: Vec3, hitNormal: Vec3, fromPlayer: Player, damage: number }) {
    if (this.isDead) return;

    const clampedDamage = Math.max(0, Math.floor(data.damage));
    if (clampedDamage <= 0) return;

    this.npcHit(data.hitPos, data.hitNormal, clampedDamage);
    this.sendNetworkBroadcastEvent(Events.playerScoredHit, { player: data.fromPlayer, entity: this.entity });
    
    const remainingHp = this.applyDamage(clampedDamage);
    if (remainingHp <= 0) {
        this.changeState(SlimeState.Dead);
        
        // Give XP to the killer
        if (MatchStateManager.instance && this.config) {
           MatchStateManager.instance.addXp(data.fromPlayer, this.config.xpReward);
           MatchStateManager.instance.incrementSlimeKills(data.fromPlayer);
        }
    } else {
        this.changeState(SlimeState.Hit);
    }
  }

  protected npcHit(hitPos: Vec3, hitNormal: Vec3, damage: number) {
    if (this.isDead) return;

    FloatingTextManager.instance?.createFloatingText(damage.toString(), hitPos, Color.red);

    if (this.props.hitSFX) {      
      this.props.hitSFX.as(AudioGizmo)?.play();
    }

    if (this.props.hitVFX) {      
      this.props.hitVFX.as(ParticleGizmo)?.play();
    }
    /*
    const npcConfig = this.config;
    // 넉백 기능 비활성화 (조건문이 항상 false가 되도록 주석 처리 또는 수정)
    /*
    if (npcConfig && damage >= npcConfig.knockbackMinDamage && false) {
      var hitDirection = hitNormal.mul(-1);
      hitDirection.y = 0;
      hitDirection.normalize();

      var startPosition = this.entity.position.get();
      
      // 넉백 시 네비게이션 일시 정지
      this.navAgent?.isImmobile.set(true);

      var moveInterval = this.async.setInterval(() => {
        if (!this.entity) {
            this.async.clearInterval(moveInterval);
            return;
        }
        if (this.entity.position.get().sub(startPosition).magnitude() > damage * npcConfig.knockbackMultiplier) {
          this.async.clearInterval(moveInterval);
          // 넉백 종료 후 상태에 따라 네비게이션 복구는 onEnterState 등에서 처리되거나,
          // Hit 상태 종료 시점에 풀림
        }
        else {
          this.entity.position.set(this.entity.position.get().add(hitDirection));
        }
      }, 10);
    }
    */
  }

  protected seedHitPointsFromConfig(): number {
    const spawnHp = this.rollSpawnHitPoints();
    this.maxHitPoints = spawnHp;
    this.hitPoints = spawnHp;
    this.publishHitPointsChanged();
    return spawnHp;
  }

  protected applyDamage(amount: number): number {
    if (amount <= 0) return this.hitPoints;

    const nextHp = Math.max(0, this.hitPoints - amount);
    this.hitPoints = nextHp;
    this.publishHitPointsChanged();
    return this.hitPoints;
  }

  protected restoreHealth(amount: number): number {
    if (amount <= 0) return this.hitPoints;
    const nextHp = Math.min(this.maxHitPoints, this.hitPoints + amount);
    this.hitPoints = nextHp;
    this.publishHitPointsChanged();
    return this.hitPoints;
  }

  private publishHitPointsChanged() {
    const snapshot: SlimeHealthSnapshot = { current: this.hitPoints, max: this.maxHitPoints };
    this.hpSubscribers.forEach((listener) => {
      try { listener(snapshot); } catch (e) { console.warn(e); }
    });
  }

  public subscribeToHitPoints(listener: (snapshot: SlimeHealthSnapshot) => void): () => void {
    this.hpSubscribers.add(listener);
    listener({ current: this.hitPoints, max: this.maxHitPoints });
    return () => { this.hpSubscribers.delete(listener); };
  }

  private rollSpawnHitPoints(): number {
    const minHpConfig = typeof this.config?.minHp === "number" ? this.config.minHp : 1;
    const maxHpConfig = typeof this.config?.maxHp === "number" ? this.config.maxHp : minHpConfig;
    const minHp = Math.max(1, minHpConfig);
    const maxHp = Math.max(minHp, maxHpConfig);
    if (maxHp === minHp) return minHp;
    const range = maxHp - minHp;
    return minHp + Math.floor(Math.random() * (range + 1));
  }

  private updateNavigationMovement() {
    if (this.frameTimer >= 1.0 / this.props.agentFPS) {
      if (this.nextTarget != undefined && this.navMesh) {
        const currentPos = this.entity.position.get();
        const distSq = currentPos.distanceSquared(this.nextTarget);
        const stopDist = this.props.stoppingDistance;

        if (distSq > stopDist * stopDist) {
          this.navAgent!.isImmobile.set(false);
          const targetPos = this.navMesh.getNearestPoint(this.nextTarget, 5);
          if (targetPos) {
            this.navAgent!.destination.set(targetPos);
          } else {
            this.navAgent!.destination.set(this.nextTarget);
          }
        } else {
          this.navAgent!.destination.set(currentPos);
        }
      }
      this.frameTimer -= 1.0 / this.props.agentFPS;
    }
  }

  private lookAtTarget(targetPos: Vec3) {
    const forward = targetPos.sub(this.entity.position.get());
    forward.y = 0;
    if (forward.magnitude() > 0.001) {
      forward.normalize();
      const rot = Quaternion.lookRotation(forward, Vec3.up);
      this.entity.rotation.set(rot);
    }
  }

  private updateRotationLock() {
    const currentUp = this.entity.up.get();
    const worldUp = Vec3.up;
    if (currentUp.dot(worldUp) < 0.99) {
      const forward = this.entity.forward.get();
      forward.y = 0;
      if (forward.magnitude() > 0.001) {
        forward.normalize();
        const uprightRot = Quaternion.lookRotation(forward, worldUp);
        this.entity.rotation.set(uprightRot);
      }
    }
  }

  private setSpeed(speedType: 'normal' | 'slow') {
    if (!this.config) return;
    
    const speed = speedType === 'normal' ? this.config.runSpeed : (this.config.walkSpeed || this.config.runSpeed * 0.5);
    if (speed) {
        this.navAgent?.maxSpeed.set(speed);
    }
  }

  public static getActiveAgents(): SlimeAgent[] {
    return Array.from(SlimeAgent.activeAgents);
  }

  protected Dispose(): void {
    SlimeAgent.activeAgents.delete(this);
    super.Dispose();
  }

  private updateAutoAcquireTarget(deltaTime: number) {
    const radius = this.getAutoAcquireRadius();
    if (radius <= 0) return;

    if (this.targetPlayer) {
        const myPos = this.entity.position.get();
        const targetPos = this.targetPlayer.position.get();
        if (myPos.distanceSquared(targetPos) > Math.pow(radius * 1.2, 2)) {
            this.targetPlayer = undefined;
        }
    }

    if (!this.targetPlayer) {
        this.autoAcquireTimer += deltaTime;
        if (this.autoAcquireTimer >= 1.0) {
            this.autoAcquireTimer = 0;
            this.refreshTargetFromWorld(radius);
        }
    }
  }

  protected refreshTargetFromWorld(maxDistance: number) {
    this.targetPlayer = this.findClosestPlayerWithinRadius(maxDistance);
  }

  protected getAutoAcquireRadius(): number {
    if (!this.config) return 20;
    return this.config.maxVisionDistance ?? 20;
  }

  private findClosestPlayerWithinRadius(radius: number): Player | undefined {
    const players = this.world.getPlayers ? this.world.getPlayers() : [];
    if (players.length === 0) return undefined;

    const myPos = this.entity.position.get();
    const maxDistanceSq = Math.pow(radius, 2);
    let closestPlayer: Player | undefined = undefined;
    let closestDistanceSq = maxDistanceSq;

    players.forEach((player) => {
      const playerPos = player.position.get();
      const distanceSq = myPos.distanceSquared(playerPos);
      if (distanceSq < closestDistanceSq) {
        closestDistanceSq = distanceSq;
        closestPlayer = player;
      }
    });

    return closestPlayer;
  }
}
Component.register(SlimeAgent);