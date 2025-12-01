// Copyright (c) 2025 Hyunseok Oh / TripleN Games Inc.
//
// This source code is licensed under the MIT license found in the
// LICENSE file in the root directory of this source tree.
//
// Modified by Hyunseok Oh on November 30, 2025

import { Asset, PropTypes } from 'horizon/core';
import { Binding, DimensionValue, UIComponent, UINode, View, Image, ImageSource, Bindable } from 'horizon/ui';

export class SlimeHUD extends UIComponent<typeof SlimeHUD> {
  static propsDefinition = {
    backgroundTexture: { type: PropTypes.Asset, default: null },
    gaugeTexture: { type: PropTypes.Asset, default: null },
    panelWidth: { type: PropTypes.Number, default: 400 },
  };

  initializeUI(): UINode {
    const width = this.resolvePanelWidth(this.props.panelWidth as number | undefined);
    const height = 40;

    return View({
      style: {
        backgroundColor: 'rgba(0, 0, 0, 0)',
        width,
        height,
        position: 'relative',
        overflow: 'hidden',
      },
      children: [
        this.buildLayer({
          texture: this.props.backgroundTexture,
          fallbackColor: 'rgba(255, 255, 255, 0.15)',
          width,
          height,
        }),
        this.buildGaugeLayer(width, height),
      ],
    });
  }

  private static clampRatio(value: number): number {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      return 0;
    }
    return Math.min(1, Math.max(0, value));
  }

  private resolvePanelWidth(value: number | undefined): number {
    if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) {
      return 400;
    }
    return value;
  }

  private buildGaugeLayer(width: number, height: number): UINode {
    const gaugeWidthBinding = this.props.panelWidth; // TODO: 갱신 예정 NPC 히트 포인트 변경 시 갱신
    return this.buildLayer({
      texture: this.props.gaugeTexture,
      fallbackColor: '#59FF7D',
      width: gaugeWidthBinding,
      height,
    });
  }

  private buildLayer(options: {
    texture: Asset | null;
    fallbackColor: string;
    width: Bindable<DimensionValue>;
    height: number;
  }): UINode {
    const baseStyle = {
      width: options.width,
      height: options.height,
      position: 'absolute' as const,
      left: 0,
      top: 0,
      borderRadius: 8,
    };

    if (options.texture) {
      return Image({
        source: ImageSource.fromTextureAsset(options.texture),
        style: baseStyle,
      });
    }

    return View({
      style: {
        ...baseStyle,
        backgroundColor: options.fallbackColor,
      },
    });
  }
}
UIComponent.register(SlimeHUD);
