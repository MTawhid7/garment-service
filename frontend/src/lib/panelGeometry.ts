// ─────────────────────────────────────────────────────────────────────────────
// Panel geometry — builds Three.js-ready BufferGeometry data from spec panels.
// Pure math, no React, no Three.js imports (returns raw typed arrays).
//
// Coordinate pipeline:
//   spec vertices (2D, cm, panel-local)
//   → edge tessellation (curved edges → dense polyline)
//   → earcut triangulation (2D → triangle index list)
//   → 3D transform (XYZ Euler rotation + translation, still in cm)
//   → scale ÷ 100 → meters (Three.js standard unit)
// ─────────────────────────────────────────────────────────────────────────────

import earcut from 'earcut';
import { tessellateEdge, type Vec2 } from './edgeTessellator';
import type { Panel } from '@/types/garment';

// ── Rotation ──────────────────────────────────────────────────────────────────

/**
 * Build a 3×3 rotation matrix from intrinsic XYZ Euler angles (degrees).
 * Replicates pygarment/pattern/rotation.py :: euler_xyz_to_R()
 *   R = Rz(rz) · Ry(ry) · Rx(rx)   (Maya convention)
 */
export function eulerXYZtoMatrix(
  rx: number,
  ry: number,
  rz: number,
): [number, number, number, number, number, number, number, number, number] {
  const d = Math.PI / 180;
  const [cx, sx] = [Math.cos(rx * d), Math.sin(rx * d)];
  const [cy, sy] = [Math.cos(ry * d), Math.sin(ry * d)];
  const [cz, sz] = [Math.cos(rz * d), Math.sin(rz * d)];

  // Row-major: R[row][col]
  return [
    cy * cz,
    cz * sx * sy - cx * sz,
    cx * cz * sy + sx * sz,
    cy * sz,
    cx * cz + sx * sy * sz,
    cx * sy * sz - cz * sx,
    -sy,
    cy * sx,
    cx * cy,
  ];
}

type Mat3 = ReturnType<typeof eulerXYZtoMatrix>;

/**
 * Apply rotation matrix + translation to a 2D panel point (z=0 in local space).
 * Replicates pygarment/pattern/core.py :: _point_in_3D()
 */
function transformPoint(
  local: Vec2,
  R: Mat3,
  T: [number, number, number],
): [number, number, number] {
  const [x, y] = local;
  return [
    R[0] * x + R[1] * y + T[0],
    R[3] * x + R[4] * y + T[1],
    R[6] * x + R[7] * y + T[2],
  ];
}

// ── Panel outline ─────────────────────────────────────────────────────────────

/**
 * Walk the panel's edge loop and build a closed 2D polyline (with curve
 * tessellation).  Removes the duplicate closing vertex so earcut works cleanly.
 */
function buildOutline(panel: Panel): Vec2[] {
  const verts = panel.vertices as Vec2[];
  if (verts.length === 0) return [];

  const outline: Vec2[] = [verts[panel.edges[0]?.endpoints[0] ?? 0]];

  for (const edge of panel.edges) {
    const start = verts[edge.endpoints[0]];
    const end = verts[edge.endpoints[1]];
    const pts = tessellateEdge(start, end, edge.curvature);
    outline.push(...pts);
  }

  // The last point should coincide with the first — remove it
  outline.pop();
  return outline;
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface PanelGeometryData {
  /** Flat [x,y,z, x,y,z, …] positions in meters */
  positions: Float32Array;
  /** Triangle indices */
  indices: Uint32Array;
}

/**
 * Build BufferGeometry-ready data from a single panel spec entry.
 *
 * @param panel  Panel object from spec.pattern.panels[name]
 * @param scale  Unit scale factor (default 0.01 converts cm → meters)
 */
export function buildPanelGeometry(
  panel: Panel,
  scale = 0.01,
): PanelGeometryData | null {
  const outline = buildOutline(panel);
  if (outline.length < 3) return null;

  // Triangulate the 2D outline
  const flat = outline.flatMap((p) => p);
  const rawIndices = earcut(flat);
  if (rawIndices.length === 0) return null;

  // Build rotation matrix once for all vertices
  const R = eulerXYZtoMatrix(...panel.rotation);
  const T = panel.translation;

  // Lift to 3D, apply transform, convert to meters
  const positions = new Float32Array(outline.length * 3);
  for (let i = 0; i < outline.length; i++) {
    const [wx, wy, wz] = transformPoint(outline[i], R, T);
    positions[i * 3 + 0] = wx * scale;
    positions[i * 3 + 1] = wy * scale;
    positions[i * 3 + 2] = wz * scale;
  }

  return {
    positions,
    indices: new Uint32Array(rawIndices),
  };
}
