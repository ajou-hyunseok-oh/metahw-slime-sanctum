import { Behaviour } from "Behaviour";
import { Component, PropTypes } from "horizon/core";

export class LootItemSpawner extends Behaviour<typeof LootItemSpawner> {
  static propsDefinition = {
    itemAsset: { type: PropTypes.Asset, default: undefined },
  };

  Start() {    
  }
}
Component.register(LootItemSpawner);