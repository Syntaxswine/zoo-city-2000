// solid.js — BUILD IT OUT OF BOXES AND LET THE PROJECTION DRAW IT.
//
// Every built thing in the city — a house, a shop, a factory, a kerb, a fence —
// is a handful of axis-aligned boxes in world units. Describe the boxes, hand
// them a skin, and one rasteriser that knows the projection produces the
// pixels. Nobody downstream draws a receding top face by hand, because that
// arithmetic, re-derived at every call site, is wrong in a different way each
// time (the `iso-solid-sprites` discipline; the reference implementation is
// Glades of Arcadia's js/art/solid.js, whose header lists the five faults).
//
// THE WORLD AXES (read off the projection in js/iso/iso.js, not chosen):
//
//   a   along +tx.  One unit is ( +2, +1 ) on screen.
//   b   along +ty.  One unit is ( -2, +1 ).
//   c   upward.     One unit is (  0, -1 ).
//
//   x = 2a - 2b        y = a + b - c
//
// One tile step along +tx is TILE_W/2 px of screen x = TILE_W/4 units of `a`.
// With 64 px tiles that is 16 units: a 1×1 building's plan is a,b ∈ [0,16].
//
// WHICH SURFACE WINS A PIXEL. Two world points share a pixel exactly when they
// differ by a multiple of (1, 1, 2) — the view ray — so the point with the
// LARGER a + b + 2c is nearer. A z-buffer keeps the nearest; that is why a
// corner, a porch, a chimney on a roof, all come free: no hand ordering.
//
// PER SCREEN PIXEL, NEVER PER SURFACE POINT. Walking a surface in world units
// and plotting skips columns (wire mesh). Here each pixel in the bounding box
// is asked which of the three visible faces contains it, in closed form.

import { TILE_W } from "../iso/iso.js";
import { T } from "./format.js";

export const A_STEP = TILE_W / 4; // units of `a` in one tile step (16)
export const TO_X = (a, b) => 2 * a - 2 * b;
export const TO_Y = (a, b, c) => a + b - c;
const depthOf = (a, b, c) => a + b + 2 * c;
const EPS = 1e-6;

/**
 * A box in world units with a skin:
 *   top(a, b, x, y)    the lit upper surface (c = c1), brightest
 *   side(a, k, x, y)   the near +ty face (b = b1), k = depth below the top
 *   end(b, k, x, y)    the near +tx face (a = a1), darkest
 * Each returns a palette key, or falsy to leave the pixel alone (that is how
 * a doorway is cut: skin the hole, never subtract solid).
 */
export function box(a0, a1, b0, b1, c0, c1, faces) {
  return { a0, a1, b0, b1, c0, c1, faces };
}

/**
 * Rasterise boxes into a fresh character grid. Returns { rows, anchor } where
 * the anchor is the pixel under world (hub, hub, 0) — the ground centre of the
 * tile the object stands on — so `defineSprite` can take it directly.
 *
 * `hub` defaults to the centre of a 1×1 plan; a 2×2 building passes A_STEP.
 * `zbuf` may be shared across passes so a later pass (a sign, a tree in the
 * yard) resolves depth against the building it stands beside.
 *
 * `scale` is the HI-RES SET (SPEC §12.6): the same plan sampled at `scale`
 * pixels per 1× pixel — a 2× grid is 128 px to the tile, every face edge
 * lands where the 1× edge landed, and a skin keyed on world units (a door,
 * a window, a storey) is the same door at twice the resolution, while a
 * skin keyed on screen pixels (brick grain, the meat stripe) gets finer,
 * which is the point. At scale 1 the output is byte-identical to the
 * pre-scale rasteriser (the suite hashes every 1× sprite against a dump
 * taken before this parameter existed).
 */
export function render(boxes, { hub = A_STEP / 2, pad = 1, scale = 1 } = {}) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const bx of boxes) {
    for (const a of [bx.a0, bx.a1]) for (const b of [bx.b0, bx.b1]) for (const c of [bx.c0, bx.c1]) {
      const x = TO_X(a, b) * scale, y = TO_Y(a, b, c) * scale;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  minX = Math.floor(minX) - pad;
  maxX = Math.ceil(maxX) + pad;
  minY = Math.floor(minY) - pad;
  maxY = Math.ceil(maxY) + pad;
  const W = maxX - minX + 1;
  const H = maxY - minY + 1;
  const g = Array.from({ length: H }, () => new Array(W).fill(T));
  const zbuf = new Float64Array(W * H).fill(-Infinity);
  rasterInto(g, zbuf, boxes, -minX, -minY, scale);
  return { rows: g.map((r) => r.join("")), grid: g, zbuf, anchor: [TO_X(hub, hub) * scale - minX, TO_Y(hub, hub, 0) * scale - minY], ox: -minX, oy: -minY, scale };
}

/** Rasterise boxes into an existing grid with offset (ox, oy) and shared z-buffer, at `scale` px per 1× px. */
export function rasterInto(g, zbuf, boxes, ox, oy, scale = 1) {
  const H = g.length;
  const W = g[0].length;
  const put = (x, y, depth, key) => {
    if (!key) return;
    const px = Math.round(x) + ox;
    const py = Math.round(y) + oy;
    if (px < 0 || py < 0 || px >= W || py >= H) return;
    const i = py * W + px;
    if (depth <= zbuf[i]) return;
    zbuf[i] = depth;
    g[py][px] = key;
  };
  for (const bx of boxes) {
    const { a0, a1, b0, b1, c0, c1, faces } = bx;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const a of [a0, a1]) for (const b of [b0, b1]) for (const c of [c0, c1]) {
      const x = TO_X(a, b) * scale, y = TO_Y(a, b, c) * scale;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const Y = y / scale;
      for (let x = Math.floor(minX); x <= Math.ceil(maxX); x++) {
        const h = x / (2 * scale);
        if (faces.top) {
          const a = (h + Y + c1) / 2;
          const b = (Y + c1 - h) / 2;
          if (a >= a0 - EPS && a <= a1 + EPS && b >= b0 - EPS && b <= b1 + EPS) {
            put(x, y, depthOf(a, b, c1), faces.top(a - a0, b - b0, x, y));
          }
        }
        if (faces.side) {
          const a = h + b1;
          const c = a + b1 - Y;
          if (a >= a0 - EPS && a <= a1 + EPS && c >= c0 - EPS && c <= c1 + EPS) {
            put(x, y, depthOf(a, b1, c), faces.side(a - a0, c1 - c, x, y));
          }
        }
        if (faces.end) {
          const b = a1 - h;
          const c = a1 + b - Y;
          if (b >= b0 - EPS && b <= b1 + EPS && c >= c0 - EPS && c <= c1 + EPS) {
            put(x, y, depthOf(a1, b, c), faces.end(b - b0, c1 - c, x, y));
          }
        }
      }
    }
  }
  return g;
}

/**
 * THE COMMON SKIN: one ramp (array of keys dark→light), lit from the upper
 * left. Top is brightest (faces the sky); side falls away down its height;
 * end is darkest (faces down-right, away from the light). An end that reads
 * bright is the fastest way to make a solid look like folded paper.
 *
 * `grain(x, y)` adds a small integer jitter for texture (brick, weatherboard).
 */
export function litSkin(ramp, { grain = null, height = 1 } = {}) {
  const n = ramp.length - 1;
  const pick = (v, x, y) => {
    let i = v;
    if (grain) i += grain(x, y);
    return ramp[Math.max(0, Math.min(n, Math.round(i)))];
  };
  return {
    top: (a, b, x, y) => pick(n, x, y),
    side: (a, k, x, y) => pick(n - 1 - (k / Math.max(1, height)) * 0.6, x, y),
    end: (b, k, x, y) => pick(n - 2 - (k / Math.max(1, height)) * 0.6, x, y),
  };
}

/** A skin whose three faces are fixed keys — for roofs, kerbs, trim. */
export function flatSkin(topKey, sideKey, endKey) {
  return {
    top: () => topKey,
    side: () => sideKey,
    end: () => endKey,
  };
}
