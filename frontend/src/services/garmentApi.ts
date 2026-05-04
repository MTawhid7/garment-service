// ─────────────────────────────────────────────────────────────────────────────
// API service layer — pure fetch wrappers.
// NO React, NO geometry, NO state. Only HTTP.
// To add a new endpoint, add one function here and nowhere else.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  GarmentTypes,
  GenerateRequest,
  GenerateResponse,
} from '@/types/garment';

const API_BASE = '/api';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`API ${path} → ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/** Fetch the available garment class names for upper, bottom, and waistband. */
export async function fetchGarmentTypes(): Promise<GarmentTypes> {
  return apiFetch<GarmentTypes>('/garment-types');
}

/**
 * Generate a sewing pattern from design + body parameter overrides.
 * Only supply the keys you want to override; everything else falls back
 * to the backend defaults.
 */
export async function generatePattern(
  req: GenerateRequest,
): Promise<GenerateResponse> {
  return apiFetch<GenerateResponse>('/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
}
