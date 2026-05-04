'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { buildPanelGeometry } from '@/lib/panelGeometry';
import type { Panel } from '@/types/garment';

interface GarmentPanelProps {
  panel: Panel;
  color?: string;
  opacity?: number;
}

/**
 * Renders a single sewing panel as a semi-transparent mesh in world space.
 * Geometry is memoised — only recomputed when the panel spec changes.
 */
export function GarmentPanel({
  panel,
  color = '#e3afba',
  opacity = 0.82,
}: GarmentPanelProps) {
  const geometry = useMemo(() => {
    const data = buildPanelGeometry(panel);
    if (!data) return null;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geo.setIndex(new THREE.BufferAttribute(data.indices, 1));
    geo.computeVertexNormals();
    return geo;
  }, [panel]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={color}
        opacity={opacity}
        transparent
        side={THREE.DoubleSide}
        roughness={0.85}
        metalness={0.0}
        depthWrite={false}
      />
    </mesh>
  );
}
