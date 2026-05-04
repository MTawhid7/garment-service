'use client';

import { useLoader } from '@react-three/fiber';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import * as THREE from 'three';
import { useMemo } from 'react';

/**
 * Loads and renders the mean-body OBJ mesh.
 * The OBJ is natively in meters and uses a Y-up coordinate system,
 * so no scaling or rotation is needed to match the garment panels (which
 * are converted from cm to meters in panelGeometry.ts).
 */
export function BodyMesh() {
  const obj = useLoader(OBJLoader, '/api/bodies/mean_all.obj');

  const normalizedObj = useMemo(() => {
    const material = new THREE.MeshStandardMaterial({
      color: '#c8b4a0',
      roughness: 0.95,
      metalness: 0.0,
      side: THREE.FrontSide,
    });
    obj.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        (child as THREE.Mesh).material = material;
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    return obj;
  }, [obj]);

  return (
    <primitive
      object={normalizedObj}
      scale={1}
    />
  );
}
