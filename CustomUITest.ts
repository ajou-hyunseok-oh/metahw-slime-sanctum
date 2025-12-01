import * as hz from 'horizon/core';
import { UIComponent, UINode, View } from 'horizon/ui';

class CustomUITest extends UIComponent<typeof CustomUITest> {
  static propsDefinition = {};

  initializeUI(): UINode {
    const panelWidth = 220;
    const panelHeight = 60;
    const barWidth = panelWidth * 0.9;
    const barHeight = panelHeight * 0.6;

    return View({
      style: {
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        height: panelHeight,
        width: panelWidth,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 10,
        padding: 6,
      },
      children: [
        View({
          style: {
            backgroundColor: '#444',
            width: barWidth,
            height: barHeight,
            borderRadius: 5,
            borderWidth: 1,
            borderColor: 'white',
            justifyContent: 'flex-start',
            padding: 2,
          },
          children: [
            View({
              style: {
                backgroundColor: '#00FF00',
                width: barWidth - 4,
                height: barHeight - 4,
                borderRadius: 4,
              },
            }),
          ],
        }),
      ],
    });
  }
}
UIComponent.register(CustomUITest);