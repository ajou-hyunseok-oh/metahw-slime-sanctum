// Copyright (c) Meta Platforms, Inc. and affiliates.
// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on November 28, 2025

import { CodeBlockEvents, Component, ComponentWithConstructor, Entity, EventSubscription, Player, SerializableState, Vec3, World } from 'horizon/core';

/**
 * 컴포넌트의 라이프사이클(Awake/Start/Update/Dispose)과 이벤트(업데이트, 잡기, 충돌)를 처리하는 기본 클래스
 */
export class Behaviour<TBehaviour extends ComponentWithConstructor<Record<string, unknown>>, TSerializableState extends SerializableState = SerializableState> extends Component<TBehaviour> {
  
  private updateListener:EventSubscription | undefined;
  private grabStartListener:EventSubscription | undefined;
  private grabEndListener:EventSubscription | undefined;
  private entityCollisionListener:EventSubscription | undefined;
  private playerCollisionListener:EventSubscription | undefined;

  protected enableDebugLogging: boolean = false;

  preStart() {
    BehaviourFinder.RegisterEntity(this.entity.id, this);

    this.Awake();
  }

  start() {
    this.updateListener = this.connectLocalBroadcastEvent(World.onUpdate, (data: {deltaTime: number}) => { this.Update(data.deltaTime); });
    this.grabStartListener = this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnGrabStart, this.OnGrabStart.bind(this));
    this.grabEndListener =  this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnGrabEnd, this.OnGrabEnd.bind(this));
    this.entityCollisionListener = this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnEntityCollision, this.OnEntityCollision.bind(this));
    this.playerCollisionListener = this.connectCodeBlockEvent(this.entity, CodeBlockEvents.OnPlayerCollision, this.OnPlayerCollision.bind(this));

    this.Start();
  }

  dispose(): void {
    this.Dispose
  }

  // Lifecycle hooks
  protected Awake() {}
  protected Start() {}
  protected Update(deltaTime: number) {
    if (this.enableDebugLogging)
      console.log("Default Update - disabling");
    
    this.updateListener?.disconnect();
  }
  protected Dispose() {}

  protected OnGrabStart(isRightHand: boolean, player: Player) {
    if (this.enableDebugLogging)
      console.log("Default Grab Start - disabling");
    
    this.grabStartListener?.disconnect();
  }

  protected OnGrabEnd(player: Player) {
    if (this.enableDebugLogging)
      console.log("Default Grab End - disabling");
    
    this.grabEndListener?.disconnect();
  }

  protected OnEntityCollision(collideWith: Entity, collisionAt: Vec3, normal: Vec3, relativeVelocity: Vec3, localColliderName: string, otherColliderName: string) {
    if (this.enableDebugLogging)
      console.log("Default Entity Collision - disabling");
      
    this.entityCollisionListener?.disconnect();
  }

  protected OnPlayerCollision(collideWith: Player, collisionAt: Vec3, normal: Vec3, relativeVelocity: Vec3, localColliderName: string, otherColliderName: string) {
    if (this.enableDebugLogging)
      console.log("Default Player Collision - disabling");

    this.playerCollisionListener?.disconnect();
  }
}

/**
 * 엔티티 ID로 Behaviour 인스턴스를 조회할 수 있는 전역 레지스트리
 */
export class BehaviourFinder extends Component<typeof BehaviourFinder> {

  private static entityMap: Map<bigint, Behaviour<ComponentWithConstructor<Record<string, unknown>>, SerializableState>>;
  static {
    BehaviourFinder.entityMap = new Map<bigint, Behaviour<ComponentWithConstructor<Record<string, unknown>>, SerializableState>>();
  }

  start() {}

  public static RegisterEntity(id: bigint, behaviour: Behaviour<ComponentWithConstructor<Record<string, unknown>>, SerializableState>) {
    BehaviourFinder.entityMap.set(id, behaviour);
  }

  public static GetBehaviour<TBehaviour>(entity: Entity | undefined | null): TBehaviour | undefined {
    if (entity == undefined || entity == null) {
      console.log("GetBehaviour: Entity is undefined or null");
      return undefined;
    }
    
    return BehaviourFinder.entityMap.get(entity.id) as unknown as TBehaviour;
  }
}