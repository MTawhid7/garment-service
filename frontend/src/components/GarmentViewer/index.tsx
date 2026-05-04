'use client';

import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Environment } from '@react-three/drei';
import { BodyMesh } from './BodyMesh';
import { GarmentPanels } from './GarmentPanels';
import type { PatternSpec } from '@/types/garment';
import styles from './GarmentViewer.module.css';

interface GarmentViewerProps {
  spec: PatternSpec | null;
  loading?: boolean;
}

function SceneContent({ spec }: { spec: PatternSpec | null }) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[3, 6, 4]}
        intensity={1.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <directionalLight position={[-3, 4, -2]} intensity={0.5} color="#b0c4de" />

      {/* Body */}
      <BodyMesh />

      {/* Garment panels */}
      {spec && <GarmentPanels spec={spec} />}

      {/* Floor shadow */}
      <ContactShadows
        position={[0, -0.01, 0]}
        opacity={0.35}
        scale={3}
        blur={2.5}
        far={1}
      />

      {/* Environment reflections */}
      <Environment preset="studio" />

      {/* Camera control */}
      <OrbitControls
        target={[0, 0.9, 0]}
        minDistance={1.2}
        maxDistance={5}
        enablePan={false}
      />
    </>
  );
}

/**
 * The unified 3D scene: body mesh + garment panels in one interactive canvas.
 * Accepts the full spec and renders all panels at their correct 3D positions.
 */
export function GarmentViewer({ spec, loading = false }: GarmentViewerProps) {
  return (
    <div className={styles.wrapper}>
      {loading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner} />
          <span className={styles.loadingText}>Generating pattern…</span>
        </div>
      )}

      <Canvas
        shadows
        camera={{ position: [0, 1.1, 2.6], fov: 38 }}
        gl={{ antialias: true }}
        className={styles.canvas}
      >
        <Suspense fallback={null}>
          <SceneContent spec={spec} />
        </Suspense>
      </Canvas>

      {!spec && !loading && (
        <div className={styles.emptyState}>
          <p className={styles.emptyIcon}>✦</p>
          <p className={styles.emptyText}>
            Select a garment type and click&nbsp;<strong>Generate</strong>
          </p>
        </div>
      )}

      <div className={styles.hint}>Drag to orbit · Scroll to zoom</div>
    </div>
  );
}
