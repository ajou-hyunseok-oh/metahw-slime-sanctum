import * as hz from 'horizon/core';
import { PropTypes } from 'horizon/core';

class VFXManager extends hz.Component<typeof VFXManager> {
  static propsDefinition = {
    levelUp: {type: PropTypes.Asset, default: undefined},
    end: {type: PropTypes.Asset, default: undefined},
    spawnIn: {type: PropTypes.Asset, default: undefined},
    spawnOut: {type: PropTypes.Asset, default: undefined},
  };

  start() {

  }
}
hz.Component.register(VFXManager);