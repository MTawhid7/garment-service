'use client';

import { GarmentViewer } from '@/components/GarmentViewer';
import { ControlPanel } from '@/components/ControlPanel';
import { useGarmentPattern } from '@/hooks/useGarmentPattern';
import styles from './page.module.css';

/**
 * Root page — wires the pattern hook to the control panel and 3D viewer.
 * No business logic lives here; this is purely composition.
 */
export default function Home() {
  const {
    result,
    loading,
    error,
    generate,
    setMetaParam,
  } = useGarmentPattern();

  return (
    <main className={styles.main}>
      <ControlPanel
        onMetaChange={setMetaParam}
        onGenerate={generate}
        loading={loading}
        panelCount={result?.panels}
        warnings={result?.warnings}
      />

      <div className={styles.viewerWrapper}>
        <GarmentViewer spec={result?.spec ?? null} loading={loading} />

        {error && (
          <div className={styles.errorBanner}>
            <span>⚠</span> {error}
          </div>
        )}
      </div>
    </main>
  );
}
