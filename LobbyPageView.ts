// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 02, 2025

import { CodeBlockEvents, Component, NetworkEvent, Player} from 'horizon/core';
import { NoesisGizmo } from 'horizon/noesis';
import { Events } from 'Events';
import { UIManager } from './UIManager';


/**
 * This is an example of a NoesisUI component that can be used in a world.
 * It's default execution mode is "Shared" which means it will be executed on the server and all of the clients.
 */
class LobbyPageView extends Component<typeof LobbyPageView> {
  private clientBindingsInitialized = false;

  start() {
  }

  private initializeServerHooks() {

  }
}

Component.register(LobbyPageView);
