// fields.js — roadDist, pollution, land value, traffic. SPEC §6. Pure.
//
// All four are DERIVED: rebuilt every tick (roadDist only when roads changed)
// and never saved. Everything is O(tiles) with two 3×3 blurs; 4,096 tiles is
// microseconds.

import { KNOBS } from "./rules.js";
import { TERRAIN, ROAD, ZONE, CIVIC, idx, inBounds, N4 } from "./world.js";

const NO_ROAD = 255;

/** Multi-source BFS from every road tile, through any tile, capped at 4. */
export function computeRoadDist(world) {
  const { w, h, road, roadDist } = world;
  const n = w * h;
  roadDist.fill(NO_ROAD);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < n; i++) {
    if (road[i] !== ROAD.NONE) {
      roadDist[i] = 0;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++];
    const d = roadDist[i];
    if (d >= KNOBS.ROAD_REACH + 1) continue;
    const tx = i % w;
    const ty = (i / w) | 0;
    for (const [dx, dy] of N4) {
      const nx = tx + dx;
      const ny = ty + dy;
      if (!inBounds(world, nx, ny)) continue;
      const j = ny * w + nx;
      if (roadDist[j] !== NO_ROAD) continue;
      roadDist[j] = d + 1;
      queue[tail++] = j;
    }
  }
  // Cap: anything unreached or beyond reach+1 reads as 4 ("no road").
  for (let i = 0; i < n; i++) if (roadDist[i] === NO_ROAD || roadDist[i] > KNOBS.ROAD_REACH) roadDist[i] = KNOBS.ROAD_REACH + 1;
  world.roadsDirty = false;
}

export const hasAccess = (world, i) => world.roadDist[i] <= KNOBS.ROAD_REACH;

/** Traffic: number of commuter paths through each road tile (readout only). */
export function computeTraffic(world) {
  world.traffic.fill(0);
  for (const c of world.citizens) {
    if (!c.path) continue;
    for (let k = 0; k < c.path.length; k++) world.traffic[c.path[k]]++;
  }
}

function blur3(src, dst, w, h) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let cnt = 0;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w) continue;
          sum += src[yy * w + xx];
          cnt++;
        }
      }
      dst[y * w + x] = sum / cnt;
    }
  }
}

/**
 * Pollution: every source spreads linearly over its radius (SC4's rule —
 * full strength on the source, 0 one tile past the radius), sinks the same
 * way with a negative sign, additive, capped 0..100. A single works at 70
 * gives 52 next door, 35 two tiles out, 17 three out; a block interior
 * saturates. No wind (stated in the Rules tab).
 */
function spread(e, w, h, tx, ty, amount, radius) {
  if (radius <= 0) { e[ty * w + tx] += amount; return; }
  for (let dy = -radius; dy <= radius; dy++) {
    const yy = ty + dy;
    if (yy < 0 || yy >= h) continue;
    for (let dx = -radius; dx <= radius; dx++) {
      const xx = tx + dx;
      if (xx < 0 || xx >= w) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      e[yy * w + xx] += amount * (1 - d / (radius + 1));
    }
  }
}

export function computePollution(world) {
  const { w, h } = world;
  const n = w * h;
  const e = world._emit || (world._emit = new Float32Array(n));
  e.fill(0);
  const scrub = world.events.scrubbers ? 0.7 : 1;
  const smog = world.events.active.find((x) => x.id === "smogBank") ? 25 : 0;
  // Pig mess: count pigs at home per lot (the owner's rule — pigs are messy,
  // raccoons follow the mess).
  const pigs = world._pigs || (world._pigs = new Uint8Array(n));
  pigs.fill(0);
  for (const c of world.citizens) if (c.species === "pig" && c.home >= 0 && !c.dead) pigs[c.home]++;
  for (let i = 0; i < n; i++) {
    const tx = i % w;
    const ty = (i / w) | 0;
    const t = world.tier[i];
    if (pigs[i]) spread(e, w, h, tx, ty, KNOBS.EMIT_PIG * pigs[i], KNOBS.EMIT_PIG_RADIUS);
    if (world.zone[i] === ZONE.I && t > 0) spread(e, w, h, tx, ty, KNOBS.EMIT_I[t] * scrub, KNOBS.EMIT_I_RADIUS[t]);
    else if (world.zone[i] === ZONE.C && KNOBS.EMIT_C[t] > 0) spread(e, w, h, tx, ty, KNOBS.EMIT_C[t], KNOBS.EMIT_C_RADIUS[t]);
    if (world.road[i] !== ROAD.NONE) spread(e, w, h, tx, ty, KNOBS.EMIT_ROAD + Math.min(KNOBS.EMIT_TRAFFIC_MAX, world.traffic[i] / KNOBS.EMIT_TRAFFIC_DIV), KNOBS.EMIT_ROAD_RADIUS);
    if (world.terrain[i] === TERRAIN.TREE) e[i] += KNOBS.EMIT_TREE;
    if (world.burning[i]) spread(e, w, h, tx, ty, KNOBS.EMIT_FIRE, KNOBS.EMIT_FIRE_RADIUS);
    if (world.civic[i] === CIVIC.PARK) spread(e, w, h, tx, ty, KNOBS.EMIT_PARK, KNOBS.EMIT_PARK_RADIUS);
  }
  for (let i = 0; i < n; i++) {
    world.pol[i] = Math.max(0, Math.min(100, Math.round(e[i] + smog)));
  }
}

/** Centroid of built lots (tier > 0); falls back to zoned lots, then the start tile. */
export function computeCentroid(world) {
  const { w, h } = world;
  const n = w * h;
  let sx = 0;
  let sy = 0;
  let cnt = 0;
  for (let i = 0; i < n; i++) {
    if (world.tier[i] > 0) {
      sx += i % w;
      sy += (i / w) | 0;
      cnt++;
    }
  }
  if (cnt === 0) {
    for (let i = 0; i < n; i++) {
      if (world.zone[i] !== ZONE.NONE) {
        sx += i % w;
        sy += (i / w) | 0;
        cnt++;
      }
    }
  }
  if (cnt === 0) return { cx: world.start.tx, cy: world.start.ty };
  return { cx: sx / cnt, cy: sy / cnt };
}

/** Land value 0..100 per tile. */
export function computeLandValue(world) {
  const { w, h } = world;
  const n = w * h;
  const { cx, cy } = computeCentroid(world);
  world.centroid = { cx, cy };
  // Park / zoo proximity masks.
  const nearPark = world._nearPark || (world._nearPark = new Uint8Array(n));
  const nearZoo = world._nearZoo || (world._nearZoo = new Uint8Array(n));
  nearPark.fill(0);
  nearZoo.fill(0);
  for (let i = 0; i < n; i++) {
    const c = world.civic[i];
    if (c !== CIVIC.PARK && c !== CIVIC.ZOO) continue;
    const r = c === CIVIC.PARK ? KNOBS.LV_PARK_RADIUS : KNOBS.LV_ZOO_RADIUS;
    const mask = c === CIVIC.PARK ? nearPark : nearZoo;
    const tx = i % w;
    const ty = (i / w) | 0;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const xx = tx + dx;
        const yy = ty + dy;
        if (inBounds(world, xx, yy)) mask[yy * w + xx] = 1;
      }
    }
  }
  const cent = world.events.centenaries; // [{tile, radius, bonus}]
  for (let i = 0; i < n; i++) {
    const tx = i % w;
    const ty = (i / w) | 0;
    const dC = Math.max(Math.abs(tx - cx), Math.abs(ty - cy));
    let nature = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = tx + dx;
        const yy = ty + dy;
        if (!inBounds(world, xx, yy)) continue;
        const t = world.terrain[yy * w + xx];
        if (t === TERRAIN.WATER || t === TERRAIN.TREE) nature++;
      }
    }
    let v = KNOBS.LV_BASE + KNOBS.LV_CENTRE * Math.max(0, 1 - dC / KNOBS.LV_CENTRE_RADIUS) + KNOBS.LV_NATURE * nature;
    if (nearPark[i]) v += KNOBS.LV_PARK;
    if (nearZoo[i]) v += KNOBS.LV_ZOO;
    v -= KNOBS.LV_POL * world.pol[i];
    for (const c of cent) {
      const ctx = c.tile % w;
      const cty = (c.tile / w) | 0;
      if (Math.max(Math.abs(tx - ctx), Math.abs(ty - cty)) <= c.radius) v += c.bonus;
    }
    world.lv[i] = Math.max(0, Math.min(100, Math.round(v)));
  }
}

/** Everything derived from tiles + citizens, in order. */
export function computeFields(world) {
  if (world.roadsDirty) computeRoadDist(world);
  computeTraffic(world);
  computePollution(world);
  computeLandValue(world);
}

/** Recount occupants and staff from the citizen list (derived, never saved). */
export function recountRosters(world) {
  world.occupants.fill(0);
  world.staff.fill(0);
  for (const c of world.citizens) {
    if (c.home >= 0) world.occupants[c.home]++;
    if (c.job >= 0) world.staff[c.job]++;
  }
}

/** BFS over road tiles from `from` (a road tile) to `to` (a road tile); returns a Uint16Array path (inclusive) or null if longer than max. */
export function roadPath(world, from, to, max = KNOBS.COMMUTE_MAX) {
  if (from === to) return new Uint16Array([from]);
  const { w, h, road } = world;
  const n = w * h;
  const prev = world._prev || (world._prev = new Int32Array(n));
  const dist = world._dist || (world._dist = new Int16Array(n));
  dist.fill(-1);
  const queue = world._queue || (world._queue = new Int32Array(n));
  let head = 0;
  let tail = 0;
  dist[from] = 0;
  prev[from] = -1;
  queue[tail++] = from;
  while (head < tail) {
    const i = queue[head++];
    const d = dist[i];
    if (d >= max) continue;
    const tx = i % w;
    const ty = (i / w) | 0;
    for (const [dx, dy] of N4) {
      const nx = tx + dx;
      const ny = ty + dy;
      if (!inBounds(world, nx, ny)) continue;
      const j = ny * w + nx;
      if (road[j] === ROAD.NONE || dist[j] !== -1) continue;
      dist[j] = d + 1;
      prev[j] = i;
      if (j === to) {
        const path = new Uint16Array(d + 2);
        let k = j;
        for (let s = d + 1; s >= 0; s--) {
          path[s] = k;
          k = prev[k];
        }
        return path;
      }
      queue[tail++] = j;
    }
  }
  return null;
}

/** The road tile nearest a lot (within ROAD_REACH), by BFS through any tile; null if none. */
export function doorOf(world, i) {
  if (world.road[i] !== ROAD.NONE) return i;
  const { w, h } = world;
  const seen = world._seen || (world._seen = new Uint8Array(w * h));
  seen.fill(0);
  let frontier = [i];
  seen[i] = 1;
  for (let d = 0; d < KNOBS.ROAD_REACH; d++) {
    const next = [];
    // Fixed order (N, E, S, W) so the door is deterministic.
    for (const cur of frontier) {
      const tx = cur % w;
      const ty = (cur / w) | 0;
      for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (!inBounds(world, nx, ny)) continue;
        const j = ny * w + nx;
        if (seen[j]) continue;
        seen[j] = 1;
        if (world.road[j] !== ROAD.NONE) return j;
        next.push(j);
      }
    }
    frontier = next;
  }
  return null;
}

/** Edge road tiles (on the map border). */
export function edgeRoads(world) {
  const { w, h } = world;
  const out = [];
  for (let i = 0; i < w * h; i++) {
    if (world.road[i] === ROAD.NONE) continue;
    const tx = i % w;
    const ty = (i / w) | 0;
    if (tx === 0 || ty === 0 || tx === w - 1 || ty === h - 1) out.push(i);
  }
  return out;
}

export { idx };
