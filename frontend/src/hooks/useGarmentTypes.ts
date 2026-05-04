'use client';

import { useState, useEffect } from 'react';
import { fetchGarmentTypes } from '@/services/garmentApi';
import type { GarmentTypes } from '@/types/garment';

/**
 * Fetches available garment class names from the backend once on mount.
 * Components just consume `types`, `loading`, and `error` — no fetch logic needed.
 */
export function useGarmentTypes() {
  const [types, setTypes] = useState<GarmentTypes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchGarmentTypes()
      .then((data) => {
        if (!cancelled) setTypes(data);
      })
      .catch((e: unknown) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load garment types');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { types, loading, error };
}
