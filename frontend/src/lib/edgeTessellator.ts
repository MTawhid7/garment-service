// ─────────────────────────────────────────────────────────────────────────────
// Edge tessellation — converts spec edge curvature metadata into polyline pts.
// Pure math, no React, no Three.js, no state.
//
// Coordinate convention (matches pygarment/pattern/utils.py):
//   relative cubic params: [t, d]
//     t = fraction along the straight edge (0 = start, 1 = end)
//     d = signed perpendicular offset as fraction of edge length
//         positive = left of the edge direction
//   circle params: [radius, large_arc (0|1), right (0|1)]
//     right=1 → sweep = false (counter-clockwise in SVG)
// ─────────────────────────────────────────────────────────────────────────────

import type { EdgeCurvature } from '@/types/garment';

export type Vec2 = [number, number];

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a relative [t, d] control point to absolute 2D coords.
 *  Mirrors pygarment/pattern/utils.py :: rel_to_abs_2d()
 */
function relToAbs(start: Vec2, end: Vec2, rel: Vec2): Vec2 {
  const ex = end[0] - start[0];
  const ey = end[1] - start[1];
  // Perpendicular (left of edge direction)
  const px = -ey;
  const py = ex;
  return [
    start[0] + rel[0] * ex + rel[1] * px,
    start[1] + rel[0] * ey + rel[1] * py,
  ];
}

/** Evaluate a cubic Bézier at t ∈ [0, 1] */
function cubicBezier(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const mt = 1 - t;
  return [
    mt ** 3 * p0[0] +
      3 * mt ** 2 * t * p1[0] +
      3 * mt * t ** 2 * p2[0] +
      t ** 3 * p3[0],
    mt ** 3 * p0[1] +
      3 * mt ** 2 * t * p1[1] +
      3 * mt * t ** 2 * p2[1] +
      t ** 3 * p3[1],
  ];
}

/** Signed angle (radians) from v1 to v2 */
function angleBetween(v1: Vec2, v2: Vec2): number {
  return Math.atan2(v1[0] * v2[1] - v1[1] * v2[0], v1[0] * v2[0] + v1[1] * v2[1]);
}

/**
 * Tessellate an SVG circular arc (endpoint parameterisation) into polyline pts.
 * Implements the SVG spec centre-point conversion:
 *   https://www.w3.org/TR/SVG/implnote.html#ArcConversionEndpointToCenter
 */
function tessellateArc(
  start: Vec2,
  end: Vec2,
  radius: number,
  largeArc: boolean,
  sweep: boolean,   // true = clockwise in SVG (y-down), false = counter-clockwise
  segments = 24,
): Vec2[] {
  const dx2 = (start[0] - end[0]) / 2;
  const dy2 = (start[1] - end[1]) / 2;

  const r = Math.max(radius, Math.sqrt(dx2 * dx2 + dy2 * dy2) + 1e-9);
  const r2 = r * r;
  const d2 = dx2 * dx2 + dy2 * dy2;

  const sq = Math.sqrt(Math.max(0, (r2 * r2 - r2 * d2 - r2 * d2) / (r2 * d2 + r2 * d2)));
  const sign = largeArc === sweep ? -1 : 1;
  const cpx = sign * sq * (r * dy2) / r;
  const cpy = sign * sq * -(r * dx2) / r;

  const cx = cpx + (start[0] + end[0]) / 2;
  const cy = cpy + (start[1] + end[1]) / 2;

  const ux = (dx2 - cpx) / r;
  const uy = (dy2 - cpy) / r;
  const vx = (-dx2 - cpx) / r;
  const vy = (-dy2 - cpy) / r;

  let startAngle = Math.atan2(uy, ux);
  let dAngle = angleBetween([ux, uy], [vx, vy]);

  if (!sweep && dAngle > 0) dAngle -= 2 * Math.PI;
  if (sweep && dAngle < 0) dAngle += 2 * Math.PI;

  const pts: Vec2[] = [];
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const a = startAngle + dAngle * t;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Tessellate one edge into intermediate polyline points (not including start).
 * Returns an array ending with `end`.
 */
export function tessellateEdge(
  start: Vec2,
  end: Vec2,
  curvature?: EdgeCurvature,
  segments = 20,
): Vec2[] {
  if (!curvature) return [end];

  if (curvature.type === 'cubic') {
    const [r1, r2] = curvature.params as [Vec2, Vec2];
    const cp1 = relToAbs(start, end, r1);
    const cp2 = relToAbs(start, end, r2);
    const pts: Vec2[] = [];
    for (let i = 1; i <= segments; i++) {
      pts.push(cubicBezier(start, cp1, cp2, end, i / segments));
    }
    return pts;
  }

  if (curvature.type === 'quadratic') {
    const [r1] = curvature.params as [Vec2];
    const cp = relToAbs(start, end, r1);
    // Elevate to cubic for uniform sampling
    const cp1: Vec2 = [
      start[0] + (2 / 3) * (cp[0] - start[0]),
      start[1] + (2 / 3) * (cp[1] - start[1]),
    ];
    const cp2: Vec2 = [
      end[0] + (2 / 3) * (cp[0] - end[0]),
      end[1] + (2 / 3) * (cp[1] - end[1]),
    ];
    const pts: Vec2[] = [];
    for (let i = 1; i <= segments; i++) {
      pts.push(cubicBezier(start, cp1, cp2, end, i / segments));
    }
    return pts;
  }

  if (curvature.type === 'circle') {
    const [radius, largeArcFlag, rightFlag] = (curvature.params as unknown) as [
      number,
      number,
      number,
    ];
    // pygarment: sweep = not right  →  right=1 means sweep=false
    return tessellateArc(start, end, radius, largeArcFlag === 1, rightFlag !== 1, segments);
  }

  // Unknown curvature type — fall back to straight line
  return [end];
}
