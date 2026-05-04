'use client';

import styles from './ControlPanel.module.css';
import { useGarmentTypes } from '@/hooks/useGarmentTypes';

interface ControlPanelProps {
  onMetaChange: (key: string, value: string | null) => void;
  onGenerate: () => void;
  loading: boolean;
  panelCount?: number;
  warnings?: string[];
}

function Select({
  label,
  options,
  onChange,
}: {
  label: string;
  options: (string | null)[];
  onChange: (v: string | null) => void;
}) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      <select
        className={styles.select}
        defaultValue=""
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '__none__' ? null : v || null);
        }}
      >
        <option value="" disabled>
          — select —
        </option>
        {options.map((o) => (
          <option key={o ?? '__none__'} value={o ?? '__none__'}>
            {o ?? 'None'}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * Left sidebar panel: garment type selectors + generate button.
 * Populated from the /garment-types endpoint via useGarmentTypes.
 * Communicates upward only through callbacks — no API calls here.
 */
export function ControlPanel({
  onMetaChange,
  onGenerate,
  loading,
  panelCount,
  warnings = [],
}: ControlPanelProps) {
  const { types, loading: typesLoading, error: typesError } = useGarmentTypes();

  return (
    <aside className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.logo}>✦</div>
        <div>
          <h1 className={styles.title}>GarmentCode</h1>
          <p className={styles.subtitle}>3D Pattern Visualizer</p>
        </div>
      </div>

      <div className={styles.divider} />

      {/* Selectors */}
      <div className={styles.section}>
        <p className={styles.sectionLabel}>Garment Type</p>

        {typesLoading && <p className={styles.hint}>Loading types…</p>}
        {typesError && <p className={styles.error}>{typesError}</p>}

        {types && (
          <>
            <Select
              label="Upper"
              options={types.upper}
              onChange={(v) => onMetaChange('upper', v)}
            />
            <Select
              label="Bottom"
              options={types.bottom}
              onChange={(v) => onMetaChange('bottom', v)}
            />
            <Select
              label="Waistband"
              options={types.wb}
              onChange={(v) => onMetaChange('wb', v)}
            />
          </>
        )}
      </div>

      <div className={styles.divider} />

      {/* Generate */}
      <button
        className={styles.generateBtn}
        onClick={onGenerate}
        disabled={loading || typesLoading}
        aria-busy={loading}
      >
        {loading ? (
          <span className={styles.btnSpinner} />
        ) : (
          <span>Generate Pattern</span>
        )}
      </button>

      {/* Stats */}
      {panelCount !== undefined && (
        <div className={styles.stats}>
          <span className={styles.statLabel}>Panels</span>
          <span className={styles.statValue}>{panelCount}</span>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className={styles.warnings}>
          {warnings.map((w, i) => (
            <p key={i} className={styles.warning}>
              ⚠ {w}
            </p>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className={styles.footer}>
        <a
          href="https://igl.ethz.ch/projects/garmentcode/"
          target="_blank"
          rel="noreferrer"
          className={styles.footerLink}
        >
          Interactive Geometry Lab
        </a>
      </div>
    </aside>
  );
}
