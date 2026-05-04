'use client';

import { useState, useCallback } from 'react';
import { generatePattern } from '@/services/garmentApi';
import type { GenerateResponse, GenerateRequest } from '@/types/garment';

/**
 * State machine for the pattern-generate flow.
 * Owns: design params, loading flag, error, and the last API result.
 * Knows nothing about rendering or 3D geometry.
 */
export function useGarmentPattern() {
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [design, setDesign] = useState<GenerateRequest>({
    design: {},
    body: {},
  });

  /** Trigger a generate request with the current design params. */
  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await generatePattern(design);
      setResult(data);
      if (data.warnings?.length) {
        console.warn('[garment-service] warnings:', data.warnings);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generation failed');
    } finally {
      setLoading(false);
    }
  }, [design]);

  /** Merge a partial design override into the current design state. */
  const setDesignParam = useCallback(
    (section: 'design' | 'body', key: string, value: unknown) => {
      setDesign((prev) => ({
        ...prev,
        [section]: {
          ...(prev[section] as Record<string, unknown>),
          [key]: value,
        },
      }));
    },
    [],
  );

  /** Replace a nested meta param (e.g. upper, bottom, wb). */
  const setMetaParam = useCallback((key: string, value: string | null) => {
    setDesign((prev) => ({
      ...prev,
      design: {
        ...(prev.design as Record<string, unknown>),
        meta: {
          ...((prev.design as Record<string, unknown>)?.meta as Record<string, unknown>),
          [key]: { v: value },
        },
      },
    }));
  }, []);

  return {
    result,
    loading,
    error,
    design,
    generate,
    setDesignParam,
    setMetaParam,
  };
}
