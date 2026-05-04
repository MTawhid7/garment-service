// ─────────────────────────────────────────────────────────────────────────────
// Domain types that mirror the garment-service API response.
// This is the single source of truth for all data shapes used across
// services/, lib/, hooks/, and components/.
// ─────────────────────────────────────────────────────────────────────────────

export type CurvatureType = 'cubic' | 'circle' | 'quadratic';

export interface EdgeCurvature {
  type: CurvatureType;
  /**
   * cubic:    [[t1, d1], [t2, d2]]  — relative control points
   *           t = fraction along edge (0→1), d = perpendicular offset
   *           as fraction of edge length (positive = left of edge direction)
   * circle:   [radius, large_arc (0|1), right (0|1)]
   * quadratic: [[t, d]]
   */
  params: number[][];
}

export interface PanelEdge {
  endpoints: [number, number];
  curvature?: EdgeCurvature;
  label?: string;
}

export interface Panel {
  /** World-space 3D translation in cm [x, y, z] */
  translation: [number, number, number];
  /** Intrinsic XYZ Euler angles in degrees [rx, ry, rz] — Maya convention */
  rotation: [number, number, number];
  /** 2D polygon vertices in panel-local space, cm */
  vertices: [number, number][];
  edges: PanelEdge[];
  label?: string; // e.g. 'body' | 'arm'
}

export interface StitchSide {
  panel: string;
  edge: number;
}

export interface PatternSpec {
  pattern: {
    panels: Record<string, Panel>;
    stitches: [StitchSide, StitchSide][];
    panel_order: string[];
  };
  properties: {
    curvature_coords: 'relative' | 'absolute';
    /** Units per meter — 100 means cm */
    units_in_meter: number;
  };
}

// ── API request / response ────────────────────────────────────────────────────

export interface GenerateRequest {
  design?: Record<string, unknown>;
  body?: Record<string, unknown>;
}

export interface GenerateResponse {
  svg: string;
  spec: PatternSpec;
  panels: number;
  warnings: string[];
}

export interface GarmentTypes {
  upper: (string | null)[];
  bottom: (string | null)[];
  wb: (string | null)[];
}
