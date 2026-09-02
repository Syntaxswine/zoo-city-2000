// format.js — the sprite authoring format.
//
// Every sprite in this game is text. No image files, no spritesheets. A sprite
// is a list of equal-length strings where each character is a key into the
// shared palette (js/art/palette.js) and '.' is transparent.
//
//   defineSprite({
//     name: 'house-1',
//     anchor: [16, 30],     // the pixel that sits on the tile's GROUND CENTRE
//     footprint: [1, 1],    // tiles occupied, [tx, ty]
//     rows: ['..qq..', '.qrrq.', ...],
//   })
//
// Rules, enforced by the validator (a typo is a hard error at load, never a
// silently missing pixel):
//   * every row the same length — width/height are derived, never declared
//   * only palette keys and '.' may appear
//   * the anchor is inside the sprite
//
// The anchor is fixed BEFORE the art is edited: it is what keeps a sprite on
// its tile when the bottom rows change. `rasterize` turns rows into RGBA once;
// the painter caches the result per (sprite, variant).

import { colourOf, hasKey } from "./palette.js";

export const T = ".";

export function defineSprite(def) {
  const { name, rows, anchor, footprint = [1, 1], tags = [] } = def;
  if (!name || typeof name !== "string") throw new Error("defineSprite: a sprite needs a name");
  if (!Array.isArray(rows) || rows.length === 0) throw new Error(`defineSprite(${name}): rows must be a non-empty array`);
  const h = rows.length;
  const w = rows[0].length;
  for (let y = 0; y < h; y++) {
    if (typeof rows[y] !== "string") throw new Error(`defineSprite(${name}): row ${y} is not a string`);
    if (rows[y].length !== w) {
      throw new Error(`defineSprite(${name}): row ${y} is ${rows[y].length}px, expected ${w}px — pad with '.'`);
    }
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch !== T && !hasKey(ch)) throw new Error(`defineSprite(${name}): '${ch}' at ${x},${y} is not a palette key`);
    }
  }
  if (!Array.isArray(anchor) || anchor.length !== 2) throw new Error(`defineSprite(${name}): anchor must be [x, y]`);
  if (anchor[0] < 0 || anchor[0] >= w || anchor[1] < 0 || anchor[1] >= h) {
    throw new Error(`defineSprite(${name}): anchor [${anchor}] is outside the ${w}x${h} sprite`);
  }
  return Object.freeze({
    name,
    rows: Object.freeze(rows.slice()),
    w,
    h,
    anchor: Object.freeze(anchor.slice()),
    footprint: Object.freeze(footprint.slice()),
    tags: Object.freeze(tags.slice()),
  });
}

/** A character grid (array of arrays) → rows of strings. */
export const toRows = (g) => g.map((r) => r.join(""));

/** A blank w×h grid of transparent. */
export function blank(w, h) {
  const g = new Array(h);
  for (let y = 0; y < h; y++) g[y] = new Array(w).fill(T);
  return g;
}

/** Stamp rows into a grid at (ox, oy). Transparent pixels do not paint. */
export function stamp(g, rows, ox, oy) {
  const H = g.length;
  const W = g[0].length;
  for (let y = 0; y < rows.length; y++) {
    const gy = oy + y;
    if (gy < 0 || gy >= H) continue;
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === T) continue;
      const gx = ox + x;
      if (gx < 0 || gx >= W) continue;
      g[gy][gx] = ch;
    }
  }
  return g;
}

/** Pad ragged rows to the widest, so parts can be authored loosely. */
export function part(rows) {
  const w = rows.reduce((m, r) => Math.max(m, r.length), 0);
  return rows.map((r) => r + T.repeat(w - r.length));
}

/** The same rows through a key map — a fox coat on a wolf body. */
export function remap(rows, map) {
  return rows.map((r) => r.split("").map((c) => (c in map ? map[c] : c)).join(""));
}

/**
 * Mirror horizontally. A plain flip sends the highlight to the shadow side;
 * `relight` (from palette.js) pulls each ramp's extreme rungs one step toward
 * the middle so the mirrored sprite no longer contradicts the scene's light.
 */
export function mirror(rows, relight = null) {
  return rows.map((r) =>
    r
      .split("")
      .reverse()
      .map((c) => (c === T || !relight ? c : relight(c)))
      .join("")
  );
}

/**
 * Rows → { w, h, data: Uint8ClampedArray RGBA }. `tint` maps a key to another
 * key (palette variants: an autumn tree, a lit window at night) before lookup.
 */
export function rasterize(rows, tint = null) {
  const h = rows.length;
  const w = rows[0].length;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      let ch = row[x];
      if (ch === T) continue;
      if (tint) ch = tint[ch] ?? ch;
      const [r, g, b] = colourOf(ch);
      const i = (y * w + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { w, h, data };
}

/** Count of opaque pixels — the cheapest "did the art change" number. */
export function ink(rows) {
  let n = 0;
  for (const r of rows) for (const c of r) if (c !== T) n++;
  return n;
}
