// meadow.js — which grass the renderer lays: a LEVEL on every tile corner,
// read off the world. DOM-FREE, READ-ONLY on the world (SPEC §14's law: no
// scratch on the world object, nothing written). SPEC §12.4, T3.3.
//
//   meadowField(world) → { level, corners(tx, ty) → [N, E, S, W] }
//   wornPaths(world)   → Map(tile → { mask, walks }): the grass a commute walks
//
// The levels are 0 kept · 1 meadow · 2 rough, and art.meadow draws a tile
// from its four (terrain.js says why a corner and not a tile: two tiles that
// share an edge share its corners, so the grass cannot change at the edge).
//
// THE CITY KEEPS WHAT IT TOUCHES. A corner of anything made — a road, a rail,
// a zoned lot (built or chalked), a civic, a wall, rubble — is kept: grass-0,
// the grass every road, rail and chalk tile already draws in its margins, so
// where the city meets the land there is nothing to see. Elsewhere the land
// grows as it likes: the mean of the world's own tile bytes over the 6×6
// tiles round the corner, cut in thirds of what a mean of that many bytes
// does — short, meadow, rough. The byte is `world.variant`, written once
// when the world is made and never again, so the meadow is a property of the
// map: a saved city loads the same meadow, and nothing moves it but making
// something on it.
//
// NOTHING SPANS KEPT AND ROUGH. A rough corner with a kept one among its eight
// neighbours steps down to meadow, so no tile holds both: the grass grades
// kept → meadow → rough, and 31 corner combinations are all art.meadow draws.

import { ROAD, ZONE, TERRAIN } from "./sim/world.js";
import { TILE } from "./sim/fields.js";

const REACH = 3; // the window: the 6×6 tiles round a corner
const BYTE_SD = Math.sqrt((256 * 256 - 1) / 12); // the spread of one uniform byte
const TERTILE = 0.4307; // a normal's thirds lie at ±0.4307 of its spread

/** Is tile i something the city made (so its corners are kept)? */
export function madeAt(world, i) {
  return world.road[i] !== ROAD.NONE || world.rail[i] !== 0 || world.zone[i] !== ZONE.NONE
    || world.civic[i] !== 0 || world.wall[i] !== 0 || world.rubble[i] !== 0;
}

/** Every corner's level, from the world as it stands. Corner (vx, vy) is tile (vx, vy)'s north corner; there are (w + 1)·(h + 1). */
export function meadowField(world) {
  const { w, h, variant } = world;
  const W = w + 1;
  // The tile bytes summed over [0, x) × [0, y): any window's sum in four reads.
  const sum = new Float64Array(W * (h + 1));
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      row += variant[y * w + x];
      sum[(y + 1) * W + x + 1] = sum[y * W + x + 1] + row;
    }
  }
  const made = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) made[i] = madeAt(world, i) ? 1 : 0;
  const raw = new Uint8Array(W * (h + 1));
  for (let vy = 0; vy <= h; vy++) {
    for (let vx = 0; vx <= w; vx++) {
      let kept = false;
      for (let ty = vy - 1; ty <= vy; ty++) for (let tx = vx - 1; tx <= vx; tx++) {
        if (tx >= 0 && ty >= 0 && tx < w && ty < h && made[ty * w + tx]) kept = true;
      }
      if (kept) continue; // raw is already 0
      // A corner by the map's edge averages fewer tiles, and its thirds are
      // cut for that many: the spread of a mean of k bytes is BYTE_SD / √k.
      const x0 = Math.max(0, vx - REACH), x1 = Math.min(w, vx + REACH);
      const y0 = Math.max(0, vy - REACH), y1 = Math.min(h, vy + REACH);
      const k = (x1 - x0) * (y1 - y0);
      const s = sum[y1 * W + x1] - sum[y0 * W + x1] - sum[y1 * W + x0] + sum[y0 * W + x0];
      const z = (s / k - 127.5) / (BYTE_SD / Math.sqrt(k));
      raw[vy * W + vx] = z < -TERTILE ? 0 : z < TERTILE ? 1 : 2;
    }
  }
  const level = raw.slice();
  for (let vy = 0; vy <= h; vy++) {
    for (let vx = 0; vx <= w; vx++) {
      if (raw[vy * W + vx] !== 2) continue;
      let beside = false;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const x = vx + dx, y = vy + dy;
        if (x >= 0 && y >= 0 && x <= w && y <= h && raw[y * W + x] === 0) beside = true;
      }
      if (beside) level[vy * W + vx] = 1;
    }
  }
  const at = (vx, vy) => level[vy * W + vx];
  return { level, corners: (tx, ty) => [at(tx, ty), at(tx + 1, ty), at(tx + 1, ty + 1), at(tx, ty + 1)] };
}

// WORN PATHS, WHERE WALKERS CROSS GRASS. The list's T3.3 asked for them, and
// there is exactly one place it happens: a station's FORECOURT. Every other
// step of every walk is a road; a rider's commute is the sim's stored path,
// and fields.js lays the tiles between a platform and the road that serves it
// into that path one step at a time — so a walker is drawn across them, and
// `world.traffic` already counts them. A path is worn where those steps are:
// read off the stored paths themselves, so a track runs exactly where the
// walks run — towards the neighbour each step came from and went to, not
// towards every busy tile that happens to be beside it.
const TOWARDS = [[0, -1, 1], [1, 0, 2], [0, 1, 4], [-1, 0, 8]]; // N E S W, the roads' mask bits

/** Is tile i open grass the ground draws as meadow — the only ground a path is worn into? */
export function openGrass(world, i) {
  return !madeAt(world, i) && world.terrain[i] !== TERRAIN.WATER;
}

/** Every grass tile a stored commute walks: tile → { mask (N 1 · E 2 · S 4 · W 8, the neighbours walked to or from), walks }. */
export function wornPaths(world) {
  const out = new Map();
  const { w } = world;
  const toward = (from, to) => {
    const dx = (to % w) - (from % w), dy = ((to / w) | 0) - ((from / w) | 0);
    for (const [x, y, bit] of TOWARDS) if (dx === x && dy === y) return bit;
    return 0;
  };
  for (const c of world.citizens) {
    const p = c.path;
    if (!p) continue;
    for (let k = 0; k < p.length; k++) {
      const t = p[k] & TILE;
      if (!openGrass(world, t)) continue;
      const e = out.get(t) || { mask: 0, walks: 0 };
      if (k > 0) e.mask |= toward(t, p[k - 1] & TILE);
      if (k + 1 < p.length) e.mask |= toward(t, p[k + 1] & TILE);
      e.walks++;
      out.set(t, e);
    }
  }
  return out;
}
