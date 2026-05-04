'use client';

import { GarmentPanel } from './GarmentPanel';
import type { PatternSpec } from '@/types/garment';

// Label → colour mapping. Extend here for new garment categories.
const LABEL_COLORS: Record<string, string> = {
  body: '#e8b4c0',
  arm:  '#d49aaa',
  skirt: '#c490a0',
  pants: '#b07888',
};

const DEFAULT_COLOR = '#dca8b8';

interface GarmentPanelsProps {
  spec: PatternSpec;
}

/**
 * Maps every panel in the spec to a <GarmentPanel> mesh.
 * Renders back-to-front by Z translation (painter's algorithm) so
 * front panels draw on top of back panels in the 3D scene.
 */
export function GarmentPanels({ spec }: GarmentPanelsProps) {
  const { panels, panel_order } = spec.pattern;

  // Sort back-to-front: lowest z first (back panels), highest z last (front)
  const sorted = [...panel_order].sort(
    (a, b) => panels[a].translation[2] - panels[b].translation[2],
  );

  return (
    <>
      {sorted.map((name) => {
        const panel = panels[name];
        const label = panel.label ?? 'body';
        const color = LABEL_COLORS[label] ?? DEFAULT_COLOR;
        const isFront = panel.translation[2] >= 0;

        return (
          <GarmentPanel
            key={name}
            panel={panel}
            color={color}
            opacity={isFront ? 0.88 : 0.78}
          />
        );
      })}
    </>
  );
}
