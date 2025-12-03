// Copyright (c) Meta Platforms, Inc. and affiliates.

// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.

import { Behaviour } from "Behaviour";
import { Events } from "Events";
import { FloatingTextManager } from "FloatingTextManager";
import { Color, Component, Player, PropTypes, Vec3 } from "horizon/core";
import { INavMesh, NavMeshAgent } from "horizon/navmesh";
import { NpcConfigStore } from "NpcConfigStore";
import { StateMachine } from "StateMachine";

export enum NpcAnimation {
  Idle = "Idle",
  Attack = "Attack",
  Hit = "Hit",
  Death = "Death",
  Wave = "EmoteWave",
  Celebration = "EmoteCelebration",
  Taunt = "EmoteTaunt",
  Yes = "EmoteYes",
  No = "EmoteNo",
  Point = "EmotePoint",
}

export enum NpcMovementSpeed {
  Walk,
  Run
}

export interface INpcAgent {
  isDead: boolean;
}

export interface NpcHealthSnapshot {
  current: number;
  max: number;
}

export class NpcAgent<T> extends Behaviour<typeof NpcAgent & T> implements INpcAgent {
  // Editable Properties
  static propsDefinition = {
    agentFPS: { type: PropTypes.Number, default: 4 },
    headHeight: { type: PropTypes.Number, default: 1.8 },
    collider: { type: PropTypes.Entity },
    model: { type: PropTypes.Entity },
    configName: { type: PropTypes.String, default: "default" }    
  };

  private static readonly activeAgents: Set<NpcAgent<any>> = new Set();
  
  protected override Awake(): void {
    super.Awake();
    NpcAgent.activeAgents.add(this);
  }

  private navMesh?: INavMesh | null = null;
  private navAgent?: NavMeshAgent | null = null;
  private frameTimer: number = 0.0;

  // Nav mesh navigation coordinates
  private nextTarget?: Vec3 | undefined;
  private lastKnownGood?: Vec3 | undefined;
  private currentLookAt: Vec3 = new Vec3(0, 0, 0);

  private animMoving: boolean = false;
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
  private navigationFrozen: boolean = false;
  protected targetPlayer: Player | undefined = undefined;
  private currentAnimation: NpcAnimation | null = null;
  private autoAcquireTimer: number = 0;

  isDead: boolean = false;

  protected stateMachine: StateMachine | null = null;
  protected config: any = null;
  protected hitPoints: number = 1;
  protected maxHitPoints: number = 1;
  private hpSubscribers: Set<(snapshot: NpcHealthSnapshot) => void> = new Set();

  Start() {    
    this.resetAllAnimationParameters();

    this.config = NpcConfigStore.instance.getNpcConfig(this.props.configName);
    if (this.config === undefined) {
      console.error("NpcAgent::Start() Attempted to load config for undefined config name: " + this.props.configName);
    }

    this.navAgent = this.entity.as(NavMeshAgent)!;
    this.navAgent.maxSpeed.set(this.config.runSpeed);

    // Get the navmesh reference so we can use it later
    this.navAgent.getNavMesh().then(mesh => { this.navMesh = mesh!; });

    // The starting position is a good position to fallback to
    this.lastKnownGood = this.entity.position.get();

    this.connectNetworkEvent(this.props.collider!, Events.projectileHit, this.bulletHit.bind(this));
    this.connectNetworkEvent(this.entity, Events.projectileHit, this.bulletHit.bind(this));
    this.connectNetworkEvent(this.props.collider!, Events.axeHit, this.axeHit.bind(this));
    this.connectNetworkEvent(this.entity, Events.axeHit, this.axeHit.bind(this));
  }

  Update(deltaTime: number) {
    this.frameTimer += deltaTime;

    // Update animation every frame
    this.updateSpeedAnimationParameters(deltaTime);
    this.updateLookAtAnimationParameters(deltaTime);

    // Only update destination at FPS rate
    if (!this.navigationFrozen && this.frameTimer >= 1.0 / this.props.agentFPS) {
      if (this.nextTarget != undefined) {
        var targetPos = this.navMesh?.getNearestPoint(this.nextTarget, 100)
        this.lastKnownGood = targetPos ?? this.lastKnownGood;
        this.navAgent!.destination.set(targetPos || this.entity.position.get());
      }
      this.frameTimer -= 1.0 / this.props.agentFPS;
    }

    // Update the state machine
    this.stateMachine?.update(deltaTime);
    this.updateIdleScaleAnimation(deltaTime);
    this.updateAttackScaleAnimation(deltaTime);
    this.updateAutoAcquireTarget(deltaTime);
  }

  public static getActiveAgents(): NpcAgent<any>[] {
    return Array.from(NpcAgent.activeAgents);
  }

  protected Dispose(): void {
    NpcAgent.activeAgents.delete(this);
    this.hpSubscribers.clear();
    super.Dispose();
  }


  // public functionality
  setMovementSpeed(speed: NpcMovementSpeed) {
    switch (speed) {
      case NpcMovementSpeed.Walk:
        this.navAgent?.maxSpeed.set(this.config.walkSpeed);
        break;
      case NpcMovementSpeed.Run:
        this.navAgent?.maxSpeed.set(this.config.runSpeed);
        break;
    }
  }

  goToTarget(target: Vec3) {
    if (this.isDead)
      return;

    this.setNavigationFrozen(false);
    this.navAgent?.isImmobile.set(false);
    this.nextTarget = target;
  }

  animate(animation: NpcAnimation) {
    if (this.isDead)
      return;

    this.currentAnimation = animation;
    switch (animation) {
      case NpcAnimation.Idle:
        this.navAgent?.isImmobile.set(true);
        this.nextTarget = this.entity.position.get();
        this.stopAttackScaleAnimation(true);
        this.startIdleScaleAnimation();
        break;
      case NpcAnimation.Death:        
        this.navAgent?.isImmobile.set(true);
        this.nextTarget = undefined;
        this.isDead = true;
        this.props.collider?.collidable.set(false);
        this.stopIdleScaleAnimation(true);
        this.stopAttackScaleAnimation(true);
        break;
      case NpcAnimation.Hit:
        this.stopIdleScaleAnimation(true);
        this.stopAttackScaleAnimation(true);
        break;
      case NpcAnimation.Attack:
        this.navAgent?.isImmobile.set(true);
        this.setNavigationFrozen(true);
        this.stopIdleScaleAnimation(true);
        this.startAttackScaleAnimation();
        break;
      default:
        this.stopIdleScaleAnimation(true);
        this.stopAttackScaleAnimation(true);
    }
  }

  private bulletHit(data: { hitPos: Vec3, hitNormal: Vec3, fromPlayer: Player }) {
    var bulletDamage = this.config.minBulletDamage + Math.floor((this.config.maxBulletDamage - this.config.minBulletDamage) * Math.random());

    this.npcHit(data.hitPos, data.hitNormal, bulletDamage);
    this.sendNetworkBroadcastEvent(Events.playerScoredHit, { player: data.fromPlayer, entity: this.entity });
  }

  private axeHit(data: { hitPos: Vec3, hitNormal: Vec3, fromPlayer: Player }) {
    var axeDamage = this.config.minAxeDamage + Math.floor((this.config.maxAxeDamage - this.config.minAxeDamage) * Math.random());

    this.npcHit(data.hitPos, data.hitNormal, axeDamage);
    this.sendNetworkBroadcastEvent(Events.playerScoredHit, { player: data.fromPlayer, entity: this.entity });
  }

  protected npcHit(hitPos: Vec3, hitNormal: Vec3, damage: number) {
    if (this.isDead)
      return

    FloatingTextManager.instance?.createFloatingText(damage.toString(), hitPos, Color.red);

    if (damage >= this.config.knockbackMinDamage) {
      // Push the NPC back opposite to the direction of the hit
      var hitDirection = hitNormal.mul(-1);
      hitDirection.y = 0;
      hitDirection.normalize();

      var startPosition = this.entity.position.get();

      var moveInterval = this.async.setInterval(() => {
        if (this.entity.position.get().sub(startPosition).magnitude() > damage * this.config.knockbackMultiplier) {
          this.async.clearInterval(moveInterval);
        }
        else {
          this.entity.position.set(this.entity.position.get().add(hitDirection));
        }
      }, 10);
    }
  }

  protected seedHitPointsFromConfig(): number {
    const spawnHp = this.rollSpawnHitPoints();
    this.maxHitPoints = spawnHp;
    this.hitPoints = spawnHp;
    this.publishHitPointsChanged();
    return spawnHp;
  }

  protected applyDamage(amount: number): number {
    if (amount <= 0)
      return this.hitPoints;

    const nextHp = Math.max(0, this.hitPoints - amount);
    if (nextHp === this.hitPoints)
      return this.hitPoints;

    this.hitPoints = nextHp;
    this.publishHitPointsChanged();
    return this.hitPoints;
  }

  protected restoreHealth(amount: number): number {
    if (amount <= 0)
      return this.hitPoints;

    const nextHp = Math.min(this.maxHitPoints, this.hitPoints + amount);
    if (nextHp === this.hitPoints)
      return this.hitPoints;

    this.hitPoints = nextHp;
    this.publishHitPointsChanged();
    return this.hitPoints;
  }

  public getCurrentHitPoints(): number {
    return this.hitPoints;
  }

  public getMaxHitPoints(): number {
    return this.maxHitPoints;
  }

  public subscribeToHitPoints(listener: (snapshot: NpcHealthSnapshot) => void): () => void {
    this.hpSubscribers.add(listener);
    listener({ current: this.hitPoints, max: this.maxHitPoints });

    return () => {
      this.hpSubscribers.delete(listener);
    };
  }

  private publishHitPointsChanged() {
    const snapshot: NpcHealthSnapshot = { current: this.hitPoints, max: this.maxHitPoints };
    this.onHitPointsChanged(snapshot);
    this.hpSubscribers.forEach((listener) => {
      try {
        listener(snapshot);
      } catch (error) {
        console.warn("NpcAgent::publishHitPointsChanged error", error);
      }
    });
  }

  protected onHitPointsChanged(snapshot: NpcHealthSnapshot): void {
    // default no-op
  }

  private rollSpawnHitPoints(): number {
    const minHpConfig = typeof this.config?.minHp === "number" ? this.config.minHp : 1;
    const maxHpConfig = typeof this.config?.maxHp === "number" ? this.config.maxHp : minHpConfig;

    const minHp = Math.max(1, minHpConfig);
    const maxHp = Math.max(minHp, maxHpConfig);

    if (maxHp === minHp)
      return minHp;

    const range = maxHp - minHp;
    return minHp + Math.floor(Math.random() * (range + 1));
  }

  // Private methods
  private resetAllAnimationParameters() {
    //console.log("NpcAgent::resetAllAnimationParameters()");
  }

  private updateSpeedAnimationParameters(deltaTime: number) {
    var speed = this.navAgent?.currentSpeed.get() || 0.0;

    var speedAnimationValue = this.calculateSpeedAnimationValue(speed);
    speedAnimationValue = (speedAnimationValue + this.animSpeed) * 0.5;
    if (speedAnimationValue <= 0.1) {
      speedAnimationValue = 0.0;
    }

    if (speedAnimationValue != this.animSpeed) {
      this.animSpeed = speedAnimationValue;      
    }

    var movingAnimationValue = speedAnimationValue > 0.0;
    if (movingAnimationValue != this.animMoving) {
      this.animMoving = movingAnimationValue;      
    }
  }

  private calculateSpeedAnimationValue(speed: number) {
    // Animation value is between 0 and 1 for walking, and between 1 and 4 for running.

    // 0-1 for walking
    var animSpeed = Math.min(speed / this.config.walkSpeed, 1);

    // Add run portion
    return animSpeed + Math.max(3 * (speed - this.config.walkSpeed) / (this.config.runSpeed - this.config.walkSpeed), 0);
  }

  private updateLookAtAnimationParameters(deltaTime: number) {
    if (this.nextTarget == undefined)
      return;

    var targetLookAt = this.currentLookAt;

    // Head position
    const headPosition = this.entity.position.get();
    headPosition.y += this.props.headHeight;

    // Vector from head to look at position
    const delta = this.nextTarget.sub(headPosition);

    // Make sure the head is not overstretching the neck (180 degrees forward range)
    const dotForward = Vec3.dot(this.entity.forward.get(), delta);
    if (dotForward > 0) {
      // Calculate the look at vector in the head's local space
      const dotRight = Vec3.dot(this.entity.right.get(), delta);
      const dotUp = Vec3.dot(this.entity.up.get(), delta);
      targetLookAt = new Vec3(Math.atan2(dotRight, dotForward), Math.atan2(dotUp, dotForward), 0);
      // bring the values between -1 and 1
      targetLookAt.divInPlace(Math.PI * 2);
    }

    if (this.currentLookAt != targetLookAt) {
      this.currentLookAt = targetLookAt;
    }    
  }

  private startIdleScaleAnimation() {
    if (this.idleScaleActive)
      return;

    this.idleScaleActive = true;
    this.idleScaleProgress = 0;
    this.applyIdleScale(0);
  }

  private stopIdleScaleAnimation(resetToDefault: boolean = false) {
    if (!this.idleScaleActive && !resetToDefault)
      return;

    this.idleScaleActive = false;
    if (resetToDefault) {
      const modelEntity = this.props.model ?? this.entity;
      modelEntity.scale.set(this.idleScaleNormal);
    }
  }

  private updateIdleScaleAnimation(deltaTime: number) {
    if (!this.idleScaleActive)
      return;

    const modelEntity = this.props.model ?? this.entity;
    if (!modelEntity)
      return;

    const duration = this.hasActiveMovementTarget() ? this.idleScaleFastDuration : this.idleScaleSlowDuration;
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
    if (!modelEntity)
      return;

    modelEntity.scale.set(this.calculateIdleScale(progress));
  }

  private startAttackScaleAnimation() {
    this.attackScaleActive = true;
    this.attackScaleElapsed = 0;
    this.applyAttackScale(0);
  }

  private stopAttackScaleAnimation(resetToDefault: boolean = false) {
    if (!this.attackScaleActive && !resetToDefault)
      return;

    this.attackScaleActive = false;
    if (resetToDefault) {
      const modelEntity = this.props.model ?? this.entity;
      modelEntity.scale.set(this.idleScaleNormal);
    }
  }

  private updateAttackScaleAnimation(deltaTime: number) {
    if (!this.attackScaleActive)
      return;

    const modelEntity = this.props.model ?? this.entity;
    if (!modelEntity)
      return;

    this.attackScaleElapsed += deltaTime;
    if (this.attackScaleElapsed >= this.attackScaleDuration) {
      this.attackScaleActive = false;
      modelEntity.scale.set(this.idleScaleNormal);
      return;
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
    if (!modelEntity)
      return;

    modelEntity.scale.set(this.calculateAttackScale(progress));
  }

  private updateAutoAcquireTarget(deltaTime: number) {
    if (!this.shouldAutoAcquireDuringIdle()) {
      this.autoAcquireTimer = 0;
      return;
    }

    const radius = this.getAutoAcquireRadius();
    if (radius <= 0)
      return;

    this.validateCurrentTarget(radius);
    if (this.targetPlayer !== undefined) {
      this.autoAcquireTimer = 0;
      return;
    }

    if (this.currentAnimation !== NpcAnimation.Idle) {
      this.autoAcquireTimer = 0;
      return;
    }

    this.autoAcquireTimer += deltaTime;
    if (this.autoAcquireTimer >= this.getAutoAcquireIntervalSeconds()) {
      this.autoAcquireTimer = 0;
      this.refreshTargetFromWorld(radius);
    }
  }

  protected refreshTargetFromWorld(maxDistance?: number): Player | undefined {
    const radius = maxDistance ?? this.getAutoAcquireRadius();
    if (radius <= 0) {
      this.targetPlayer = undefined;
      return undefined;
    }

    const target = this.findClosestPlayerWithinRadius(radius);
    this.targetPlayer = target;
    return target;
  }

  protected shouldAutoAcquireDuringIdle(): boolean {
    return false;
  }

  protected getAutoAcquireIntervalSeconds(): number {
    return 1.0;
  }

  protected getAutoAcquireRadius(): number {
    if (!this.config)
      return 0;

    return this.config.maxVisionDistance ?? 0;
  }

  protected getAttackIntervalSeconds(): number {
    const attacksPerSecond = this.config?.attacksPerSecond ?? 1;
    if (attacksPerSecond <= 0)
      return 1;

    return 1 / attacksPerSecond;
  }

  private findClosestPlayerWithinRadius(radius: number): Player | undefined {
    const players = this.world.getPlayers ? this.world.getPlayers() : [];
    if (players.length === 0)
      return undefined;

    const monsterPosition = this.entity.position.get();
    const maxDistanceSq = Math.pow(radius, 2);
    let closestPlayer: Player | undefined = undefined;
    let closestDistanceSq = maxDistanceSq;

    players.forEach((player) => {
      const playerPosition = player.position.get();
      const distanceSq = monsterPosition.distanceSquared(playerPosition);
      if (distanceSq < closestDistanceSq) {
        closestDistanceSq = distanceSq;
        closestPlayer = player;
      }
    });

    return closestPlayer;
  }

  private validateCurrentTarget(radius: number) {
    if (this.targetPlayer === undefined)
      return;

    const monsterPosition = this.entity.position.get();
    const playerPosition = this.targetPlayer.position.get();
    if (monsterPosition.distanceSquared(playerPosition) > Math.pow(radius, 2)) {
      this.targetPlayer = undefined;
    }
  }

  private setNavigationFrozen(frozen: boolean) {
    if (this.navigationFrozen === frozen)
      return;

    this.navigationFrozen = frozen;
    if (frozen) {
      this.nextTarget = undefined;
    }
  }

  private hasActiveMovementTarget(): boolean {
    if (this.navigationFrozen || this.nextTarget === undefined)
      return false;

    const distanceSq = this.nextTarget.distanceSquared(this.entity.position.get());
    return distanceSq > 0.01;
  }

  protected isTargetWithinDistance(distance: number): boolean {
    if (!this.targetPlayer || distance <= 0)
      return false;

    const monsterPosition = this.entity.position.get();
    const playerPosition = this.targetPlayer.position.get();
    return monsterPosition.distanceSquared(playerPosition) <= Math.pow(distance, 2);
  }

  protected isTargetWithinAttackDistance(): boolean {
    if (!this.config || this.config.maxAttackDistance === undefined)
      return false;

    return this.isTargetWithinDistance(this.config.maxAttackDistance);
  }

  private lerpVec3(start: Vec3, end: Vec3, t: number): Vec3 {
    const x = start.x + (end.x - start.x) * t;
    const y = start.y + (end.y - start.y) * t;
    const z = start.z + (end.z - start.z) * t;
    return new Vec3(x, y, z);
  }
}
Component.register(NpcAgent);

