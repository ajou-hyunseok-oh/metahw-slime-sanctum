// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on November 30, 2025

import { AudioGizmo, Component, Entity, ParticleGizmo, Player, PropTypes, Vec3 } from "horizon/core";
import { LootSystem } from "LootSystem";
import { NpcAgent, NpcAnimation, NpcHealthSnapshot, NpcMovementSpeed } from "NpcAgent";
import { NextStateEdges, StateCallbackConfig, StateCallbacks, StateConfigRecord, StateMachine } from "StateMachine";
import { SlimeHUD } from "SlimeHUD";

enum SlimePinkState {
  Idle = "Idle",
  AcquireTarget = "AcquireTarget",
  Pointing = "Pointing",
  Taunting = "Taunting",
  Walking = "Walking",
  Running = "Running",
  Attacking = "Attacking",
  Hit = "Hit",
  Dead = "Dead",
}

class SlimePinkBrain extends NpcAgent<typeof SlimePinkBrain> {
  static propsDefinition = {
    ...NpcAgent.propsDefinition,
    attackSfx: { type: PropTypes.Entity },
    attackHitSfx: { type: PropTypes.Entity },
    hitSfx: { type: PropTypes.Entity },
    deathSfx: { type: PropTypes.Entity },
    hitVfx: { type: PropTypes.Entity },
    deathVfx: { type: PropTypes.Entity },
  };

  startLocation!: Vec3;  

  // START State Machine Config *********************************************
  slimePinkConfig: StateConfigRecord[] = [
    new StateConfigRecord(
      SlimePinkState.Idle,
      [
        new StateCallbackConfig(StateCallbacks.OnEnter, () => this.animate(NpcAnimation.Idle)),
      ],
      [
        new NextStateEdges(() => this.stateMachine!.timer >= 1, [[SlimePinkState.AcquireTarget, 1.0]]),
      ]
    ),

    new StateConfigRecord(
      SlimePinkState.AcquireTarget,
      [
        new StateCallbackConfig(StateCallbacks.OnEnter, () => {
          this.refreshTargetFromWorld();
          if (this.isTargetWithinAttackDistance()) {
            this.stateMachine?.changeState(SlimePinkState.Attacking);
          }
        })
      ],
      [
        new NextStateEdges(() => this.targetPlayer !== undefined, [
          [SlimePinkState.Taunting, 0.1],
          [SlimePinkState.Running, 0.1],
          [SlimePinkState.Walking, 0.8]]),
        new NextStateEdges(() => true, [[SlimePinkState.Idle, 1.0]])
      ]
    ),

    new StateConfigRecord(
      SlimePinkState.Taunting,
      [
        new StateCallbackConfig(StateCallbacks.OnEnter, () => {
          this.animate(NpcAnimation.Taunt);
        }),
      ],
      [
        new NextStateEdges(() => this.stateMachine!.timer >= 2.0, [[SlimePinkState.Running, 1.0]]),
      ]
    ),

    new StateConfigRecord(
      SlimePinkState.Walking,
      [
        new StateCallbackConfig(StateCallbacks.OnEnter, () => {
          this.setMovementSpeed(NpcMovementSpeed.Walk);
        }),
        new StateCallbackConfig(StateCallbacks.OnUpdate, (deltaTime: number) => this.updateWalkAndRunStates(deltaTime))
      ]
    ),

    new StateConfigRecord(
      SlimePinkState.Running,
      [
        new StateCallbackConfig(StateCallbacks.OnEnter, () => {
          this.setMovementSpeed(NpcMovementSpeed.Run);
        }),
        new StateCallbackConfig(StateCallbacks.OnUpdate, (deltaTime: number) => this.updateWalkAndRunStates(deltaTime))
      ]
    ),

    new StateConfigRecord(
      SlimePinkState.Attacking,
      [
        new StateCallbackConfig(StateCallbacks.OnEnter, () => {
          this.animate(NpcAnimation.Attack);
          this.props.attackSfx?.as(AudioGizmo)?.play();
          this.async.setTimeout(() => this.resolveAttackOnPlayer(this.targetPlayer!), this.config.attackLandDelay);
        })
      ],
      [
        new NextStateEdges(() => this.stateMachine!.timer >= this.getAttackIntervalSeconds(), [[SlimePinkState.AcquireTarget, 1.0]]),
      ]
    ),

    new StateConfigRecord(
      SlimePinkState.Hit,
      [
        new StateCallbackConfig(StateCallbacks.OnEnter, () => {
          if (this.hitPoints > 1) {
            this.props.hitSfx?.as(AudioGizmo)?.play();
            this.animate(NpcAnimation.Hit);
          }
        })
      ],
      [
        new NextStateEdges(() => this.hitPoints <= 0, [[SlimePinkState.Dead, 1.0]]),
        new NextStateEdges(() => this.stateMachine!.timer >= this.config.hitStaggerSeconds, [
          [SlimePinkState.AcquireTarget, 1.0],
        ])
      ]
    ),

    new StateConfigRecord(
      SlimePinkState.Dead,
      [
        new StateCallbackConfig(StateCallbacks.OnEnter, () => {
          this.props.deathSfx?.as(AudioGizmo)?.play();
          if (this.config.lootTable != undefined) {
            LootSystem.instance?.dropLoot(this.config.lootTable, this.entity.position.get(), this.entity.rotation.get());
          }
          this.animate(NpcAnimation.Death);
          this.recycleSelf(5000);
        })
      ]
    ),
  ];
  // END State Machine Config ***********************************************

  Start() {
    super.Start();

    this.seedHitPointsFromConfig();
    this.startLocation = this.entity.position.get();
    this.stateMachine = new StateMachine(Object.values(SlimePinkState), this.slimePinkConfig);
    this.stateMachine.changeState(SlimePinkState.Idle);
  }

  override OnEntityCollision(itemHit: Entity, position: Vec3, normal: Vec3, velocity: Vec3) {
    console.log("Zombie hit by " + itemHit.name.get());
  }

  override npcHit(hitPos: Vec3, hitNormal: Vec3, damage: number) {
    if (this.isDead)
      return

    this.applyDamage(damage);
    this.playHitVfx(hitPos);
    console.log(`[SlimePinkBrain] HP=${this.getCurrentHitPoints()}/${this.getMaxHitPoints()} (-${damage})`);
    super.npcHit(hitPos, hitNormal, damage);
    this.stateMachine?.changeState(SlimePinkState.Hit);
  }

  protected override shouldAutoAcquireDuringIdle(): boolean {
    return true;
  }

  private updateWalkAndRunStates(deltaTime: number) {
    var currentState = this.stateMachine?.currentState?.name;
    if (currentState != SlimePinkState.Running && currentState != SlimePinkState.Walking)
      return;

    if (this.targetPlayer === undefined) {
      this.stateMachine?.changeState(SlimePinkState.Idle);
    } else {
      this.goToTarget(this.targetPlayer.position.get());
      if (this.targetPlayer.position.get().distanceSquared(this.entity.position.get()) < Math.pow(this.config.maxAttackDistance, 2)) {
        this.stateMachine?.changeState(SlimePinkState.Attacking);
      }
    }
  }

  private resolveAttackOnPlayer(player: Player) {
    // If the player is still in range after the attack delay, apply damage
    if (player.position.get().distanceSquared(this.entity.position.get()) < Math.pow(this.config.maxAttachReach, 2)) {
      var damage = this.config.minAttackDamage + Math.floor((this.config.maxAttackDamage - this.config.minAttackDamage) * Math.random());
      this.props.attackHitSfx?.as(AudioGizmo)?.play();

      //PlayerManager.instance.hitPlayer(player, damage, this.entity.position.get());

    }
  }

  protected override onHitPointsChanged(snapshot: NpcHealthSnapshot): void {
    super.onHitPointsChanged(snapshot);  
    // TODO: 갱신 예정 NPC 히트 포인트 변경 시 갱신
    // 하위의 SlimeHUD 컴포넌트에서 갱신 처리    
  }

  protected override onRevivedFromPool(): void {
    this.stateMachine?.changeState(SlimePinkState.Idle);
  }

  private playHitVfx(hitPos: Vec3) {
    this.playVfxEntity(this.props.hitVfx, hitPos);
  }

  private playVfxEntity(vfxEntity: Entity | undefined, position: Vec3) {
    if (!vfxEntity) {
      return;
    }
    vfxEntity.position.set(position);
    vfxEntity.as(ParticleGizmo)?.play();
  }
}
Component.register(SlimePinkBrain);



