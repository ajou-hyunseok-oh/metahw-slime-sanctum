// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on December 04, 2025

import { NetworkEvent } from 'horizon/core';

export const LoadingStartEvent = new NetworkEvent<{}>('LoadingStart');
export const LoadingProgressUpdateEvent = new NetworkEvent<{ progress: number }>('LoadingProgressUpdate');


