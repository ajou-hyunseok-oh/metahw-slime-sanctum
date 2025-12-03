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

enum SlimeKingState {
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

class SlimeKingBrain extends NpcAgent<typeof SlimeKingBrain> {
  static propsDefinition = {
    ...NpcAgent.propsDefinition,
    attackSfx: { type: PropTypes.Entity },
    attackHitSfx: { type: PropTypes.Entity },
    hitSfx: { type: PropTypes.Entity },
    deathSfx: { type: PropTypes.Entity },
    hitVfx: { type: PropTypes.Entity },
    deathVfx: { type: PropTypes.Entity },
  };

  // START State Machine Config *********************************************
  slimeKingConfig: StateConfigRecord[] = [
    new StateConfigRecord(
      SlimeKingState.Idle,
      [
        new StateCallbackConfig(StateCallbacks.OnEnter, () => this.animate(NpcAnimation.Idle)),
      ],
      [
        new NextStateEdges(() => this.stateMachine!.timer >= 1, [[SlimeKingState.AcquireTarget, 1.0]]),
      ]
    ),

    new StateConfigRecord(
      SlimeKingState.AcquireTarget,
      [
        new StateCallbackConfig(StateCallbacks.OnEnter, () => {
          this.refreshTargetFromWorld();
          if (this.isTargetWithinAttackDistance()) {
            this.stateMachine?.changeState(SlimeKingState.Attacking);
          }
        })
      ],
      [
        new NextStateEdges(() => this.targetPlayer !== undefined, [
          [SlimeKingState.Taunting, 0.1],
          [SlimeKingState.Running, 0.1],
          [SlimeKingState.Walking, 0.8]]),
        new NextStateEdges(() => true, [[SlimeKingState.Idle, 1.0]])
      ]
    ),

    new StateConfigRecord(
      SlimeKingState.Taunting,
      [
        new StateCallbackConfig(StateCallbacks.OnEnter, () => {
          this.animate(NpcAnimation.Taunt);
        }),
      ],
      [
        new NextStateEdges(() => this.stateMachine!.timer >= 2.0, [[SlimeKingState.Running, 1.0]]),
      ]
    ),

    new StateConfigRecord(
      SlimeKingState.Walking,
      [
        new StateCallbackConfig(StateCallbacks.OnEnter, () => {
          this.setMovementSpeed(NpcMovementSpeed.Walk);
        }),
        new StateCallbackConfig(StateCallbacks.OnUpdate, (deltaTime: number) => this.updateWalkAndRunStates(deltaTime))
      ]
    ),

    new StateConfigRecord(
      SlimeKingState.Running,
      [
        new StateCallbackConfig(StateCallbacks.OnEnter, () => {
          this.setMovementSpeed(NpcMovementSpeed.Run);
        }),
        new StateCallbackConfig(StateCallbacks.OnUpdate, (deltaTime: number) => this.updateWalkAndRunStates(deltaTime))
      ]
    ),

    new StateConfigRecord(
      SlimeKingState.Attacking,
      [
        new StateCallbackConfig(StateCallbacks.OnEnter, () => {
          this.animate(NpcAnimation.Attack);
          this.props.attackSfx?.as(AudioGizmo)?.play();
          this.async.setTimeout(() => this.resolveAttackOnPlayer(this.targetPlayer!), this.config.attackLandDelay);
        })
      ],
      [
        new NextStateEdges(() => this.stateMachine!.timer >= this.getAttackIntervalSeconds(), [[SlimeKingState.AcquireTarget, 1.0]]),
      ]
    ),

    new StateConfigRecord(
      SlimeKingState.Hit,
      [
        new StateCallbackConfig(StateCallbacks.OnEnter, () => {
          if (this.hitPoints > 1) {
            this.props.hitSfx?.as(AudioGizmo)?.play();
            this.animate(NpcAnimation.Hit);
          }
        })
      ],
      [
        new NextStateEdges(() => this.hitPoints <= 0, [[SlimeKingState.Dead, 1.0]]),
        new NextStateEdges(() => this.stateMachine!.timer >= this.config.hitStaggerSeconds, [
          [SlimeKingState.AcquireTarget, 1.0],
        ])
      ]
    ),

    new StateConfigRecord(
      SlimeKingState.Dead,
      [
        new StateCallbackConfig(StateCallbacks.OnEnter, () => {
          this.props.deathSfx?.as(AudioGizmo)?.play();
          if (this.config.lootTable != undefined) {
            LootSystem.instance?.dropLoot(this.config.lootTable, this.entity.position.get(), this.entity.rotation.get());
            this.animate(NpcAnimation.Death);
            this.async.setTimeout(() => {
              this.world.deleteAsset(this.entity)
            }, 5000);
          }
        })
      ]
    ),
  ];
  // END State Machine Config ***********************************************

  Start() {
    super.Start();

    this.seedHitPointsFromConfig();
    this.stateMachine = new StateMachine(Object.values(SlimeKingState), this.slimeKingConfig);
    this.stateMachine.changeState(SlimeKingState.Idle);    
  }

  override OnEntityCollision(itemHit: Entity, position: Vec3, normal: Vec3, velocity: Vec3) {
    console.log("Zombie hit by " + itemHit.name.get());
  }

  override npcHit(hitPos: Vec3, hitNormal: Vec3, damage: number) {
    if (this.isDead)
      return

    this.applyDamage(damage);
    this.playHitVfx(hitPos);
    console.log(`[SlimeKingBrain] HP=${this.getCurrentHitPoints()}/${this.getMaxHitPoints()} (-${damage})`);
    super.npcHit(hitPos, hitNormal, damage);
    this.stateMachine?.changeState(SlimeKingState.Hit);
  }



  protected override shouldAutoAcquireDuringIdle(): boolean {
    return true;
  }

  private updateWalkAndRunStates(deltaTime: number) {
    var currentState = this.stateMachine?.currentState?.name;
    if (currentState != SlimeKingState.Running && currentState != SlimeKingState.Walking)
      return;

    if (this.targetPlayer === undefined) {
      this.stateMachine?.changeState(SlimeKingState.Idle);
    } else {
      this.goToTarget(this.targetPlayer.position.get());
      if (this.targetPlayer.position.get().distanceSquared(this.entity.position.get()) < Math.pow(this.config.maxAttackDistance, 2)) {
        this.stateMachine?.changeState(SlimeKingState.Attacking);
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
Component.register(SlimeKingBrain);






