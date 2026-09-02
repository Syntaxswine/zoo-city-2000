// fields.js — roadDist, pollution, land value, traffic. SPEC §6. Pure.
//
// All of these are DERIVED: rebuilt every tick (roadDist only when roads
// changed) and never saved. Everything is O(tiles) (pollution is O(sources ×
// radius²)); 4,096 tiles is microseconds.

import { KNOBS } from "./rules.js";
import { TERRAIN, ROAD, ZONE, CIVIC, idx, inBounds, N4, isStation, absent } from "./world.js";
import { SPECIES_BY_ID, DIET_OF } from "./species.js";
import { forEachWithin, computeOcclusion, isBarrier } from "./reach.js";

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
      if (roadDist[j] !== NO_ROAD || isBarrier(world, j)) continue; // reach stops at a bare wall (a tunnel is a road)
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

/**
 * Pollution: every source spreads linearly over its radius (SC4's rule —
 * full strength on the source, 0 one tile past the radius), sinks the same
 * way with a negative sign, additive, capped 0..100. A single works at 70
 * gives 52 next door, 35 two tiles out, 17 three out; a block interior
 * saturates. No wind (stated in the Rules tab).
 */
function spread(world, e, i, amount, radius) {
  if (radius <= 0) { e[i] += amount; return; }
  // reach.js (SPEC §6b): the Chebyshev square where the city has no walls,
  // the flood round them where it does — the same numbers wherever no wall intervenes.
  forEachWithin(world, i, radius, (j, d) => { e[j] += amount * (1 - d / (radius + 1)); });
}

export function computePollution(world) {
  const { w, h } = world;
  const n = w * h;
  const e = world._emit || (world._emit = new Float32Array(n));
  e.fill(0);
  const scrub = world.events.scrubbers ? 0.7 : 1;
  const smog = world.events.active.find((x) => x.id === "smogBank") ? 25 : 0;
  // Mess: pigs and skunks at home dirty their lot (the owner's rule — pigs
  // are messy, raccoons follow the mess; the skunk stinks).
  const mess = world._mess || (world._mess = new Float32Array(n));
  mess.fill(0);
  for (const c of world.citizens) {
    if (c.dead || c.home < 0) continue;
    const m = KNOBS.MESS[c.species];
    if (m) mess[c.home] += m;
  }
  for (let i = 0; i < n; i++) {
    const tx = i % w;
    const ty = (i / w) | 0;
    const t = world.tier[i];
    if (mess[i]) spread(world, e, i, mess[i], KNOBS.MESS_RADIUS);
    if (world.zone[i] === ZONE.I && t > 0) spread(world, e, i, KNOBS.EMIT_I[t] * scrub, KNOBS.EMIT_I_RADIUS[t]);
    else if (world.zone[i] === ZONE.C && KNOBS.EMIT_C[t] > 0) spread(world, e, i, KNOBS.EMIT_C[t], KNOBS.EMIT_C_RADIUS[t]);
    if (world.road[i] !== ROAD.NONE) spread(world, e, i, KNOBS.EMIT_ROAD + Math.min(KNOBS.EMIT_TRAFFIC_MAX, world.traffic[i] / KNOBS.EMIT_TRAFFIC_DIV), KNOBS.EMIT_ROAD_RADIUS);
    if (world.terrain[i] === TERRAIN.TREE) e[i] += KNOBS.EMIT_TREE;
    if (world.burning[i]) spread(world, e, i, KNOBS.EMIT_FIRE, KNOBS.EMIT_FIRE_RADIUS);
    if (world.civic[i] === CIVIC.PARK) spread(world, e, i, KNOBS.EMIT_PARK, KNOBS.EMIT_PARK_RADIUS);
  }
  for (let i = 0; i < n; i++) {
    world.pol[i] = Math.max(0, Math.min(100, Math.round(e[i] + smog)));
  }
}

/**
 * Dread: what a meat hall does to the street. The same linear spread as
 * pollution, its own field (pollution pulls raccoons and pigs and refuses R
 * growth — the owner's rule is herbivore-specific): LV reads it for everyone,
 * herbivores read it in mood and home choice, carnivores do not mind.
 * DERIVED — rebuilt every tick, never saved.
 */
export function computeDread(world) {
  const { w, h } = world;
  const n = w * h;
  const e = world._dreadEmit || (world._dreadEmit = new Float32Array(n));
  e.fill(0);
  for (let i = 0; i < n; i++) {
    const t = world.tier[i];
    if (world.zone[i] === ZONE.M && t > 0) spread(world, e, i, KNOBS.DREAD[t], KNOBS.DREAD_RADIUS[t]);
  }
  for (let i = 0; i < n; i++) world.dread[i] = Math.max(0, Math.min(100, Math.round(e[i])));
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
  const nearVan = world._nearVan || (world._nearVan = new Uint8Array(n));
  nearPark.fill(0);
  nearZoo.fill(0);
  nearVan.fill(0);
  for (let i = 0; i < n; i++) {
    const c = world.civic[i];
    if (c !== CIVIC.PARK && c !== CIVIC.ZOO && c !== CIVIC.CENTRE) continue;
    const r = c === CIVIC.PARK ? KNOBS.LV_PARK_RADIUS : c === CIVIC.ZOO ? KNOBS.LV_ZOO_RADIUS : KNOBS.LV_VAN_RADIUS;
    const mask = c === CIVIC.PARK ? nearPark : c === CIVIC.ZOO ? nearZoo : nearVan;
    forEachWithin(world, i, r, (j) => { mask[j] = 1; }); // round a wall, not through it
  }
  const cent = world.events.centenaries; // [{tile, radius, bonus}]
  const plaque = world._plaque || (world._plaque = new Float32Array(n));
  plaque.fill(0);
  for (const c of cent) forEachWithin(world, c.tile, c.radius, (j) => { plaque[j] += c.bonus; });
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
    v -= KNOBS.LV_DREAD * world.dread[i]; // a meat hall: twice a works' shadow
    if (nearVan[i]) v -= KNOBS.LV_VAN; // the pacification centre's van
    v += plaque[i];
    world.lv[i] = Math.max(0, Math.min(100, Math.round(v)));
  }
}

/** Fire and police coverage from stations that have road access. */
export function computeCoverage(world) {
  const { w, h } = world;
  const n = w * h;
  world.fireCov.fill(0);
  world.policeCov.fill(0);
  for (let i = 0; i < n; i++) {
    const c = world.civic[i];
    if (!isStation(c) || world.roadDist[i] > KNOBS.ROAD_REACH) continue;
    const R = c === CIVIC.FIRE ? KNOBS.FIRE_RADIUS : KNOBS.POLICE_RADIUS;
    forEachWithin(world, i, R, (j, d) => { // a patrol goes round a wall and through a tunnel
      if (c === CIVIC.FIRE) world.fireCov[j] = 1;
      else {
        const eff = d <= KNOBS.POLICE_NEAR ? KNOBS.POLICE_EFFECT : KNOBS.POLICE_EFFECT / 2;
        if (eff > world.policeCov[j]) world.policeCov[j] = eff;
      }
    });
  }
}

/**
 * Crime, the Micropolis line at 0..100: base − land value + density +
 * unemployment − police. Unemployment is counted here (not read from a
 * stale census) so a loaded city and the straight run agree.
 */
export function computeCrime(world) {
  const { w, h } = world;
  const n = w * h;
  let W = 0;
  let U = 0;
  // Unemployment, global (the Micropolis line) and LOCAL — "no jobs means
  // hungry wolves" (the owner): every unemployed adult in the 3×3 adds to the
  // tile, a carnivore double. Counted here from live state, never from the
  // previous census (the save/load hash law).
  const unempAt = world._unempAt || (world._unempAt = new Float32Array(n));
  unempAt.fill(0);
  for (const c of world.citizens) {
    if (c.dead) continue;
    const y = Math.floor((world.tick - c.born) / 12);
    if (y < KNOBS.ADULT_AGE || y >= SPECIES_BY_ID[c.species].retire || c.onLeave || absent(world, c)) continue;
    W++;
    if (c.job < 0) {
      U++;
      if (c.home >= 0) unempAt[c.home] += DIET_OF[c.species] === "carn" ? KNOBS.CRIME_UNEMP_HUNTER : 1;
    }
  }
  const unemp = W ? U / W : 0;
  world._crimeW = W;
  world._crimeU = U;
  // A meat hall is part of crime: its own hill, halved under licence; and
  // every open file (an incident's memory) stains its street.
  const near = world._cnear || (world._cnear = new Float32Array(n));
  near.fill(0);
  const mult = world.events.licence ? KNOBS.LICENCE_CRIME_MULT : 1;
  for (let i = 0; i < n; i++) {
    const t = world.tier[i];
    if (world.zone[i] === ZONE.M && t > 0) spread(world, near, i, KNOBS.CRIME_M[t] * mult, KNOBS.CRIME_M_RADIUS[t]);
  }
  for (const f of world.events.files) {
    if (f.until <= world.tick) continue;
    forEachWithin(world, f.tile, f.radius, (j) => { near[j] += f.crime; });
  }
  for (let i = 0; i < n; i++) {
    const tx = i % w;
    const ty = (i / w) | 0;
    let dens = 0;
    let jobless = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = tx + dx;
      const yy = ty + dy;
      if (inBounds(world, xx, yy)) { dens += world.occupants[yy * w + xx]; jobless += unempAt[yy * w + xx]; }
    }
    if (!dens && world.zone[i] === ZONE.NONE && !near[i]) { world.crime[i] = 0; continue; }
    const v = KNOBS.CRIME_BASE - KNOBS.CRIME_LV * world.lv[i] + KNOBS.CRIME_DENSITY * dens + KNOBS.CRIME_UNEMP_LOCAL * jobless + KNOBS.CRIME_UNEMP * unemp + near[i] - world.policeCov[i];
    world.crime[i] = Math.max(0, Math.min(100, Math.round(v)));
  }
  // High crime destroys land value (SC2000 manual; Micropolis −20 above 190).
  for (let i = 0; i < n; i++) if (world.crime[i] > KNOBS.CRIME_HIGH) world.lv[i] = Math.max(0, world.lv[i] - KNOBS.CRIME_LV_PENALTY);
}

/** Everything derived from tiles + citizens, in order. */
export function computeFields(world) {
  if (world.wallsDirty) computeOcclusion(world);
  if (world.roadsDirty) computeRoadDist(world);
  computeCoverage(world);
  computeTraffic(world);
  computePollution(world);
  computeDread(world);
  computeLandValue(world);
  computeCrime(world);
}

/** Recount occupants and staff from the citizen list (derived, never saved). */
export function recountRosters(world) {
  world.occupants.fill(0);
  world.staff.fill(0);
  world.carnAt.fill(0);
  for (const c of world.citizens) {
    if (c.home >= 0) { world.occupants[c.home]++; if (DIET_OF[c.species] === "carn") world.carnAt[c.home]++; }
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
        if (seen[j] || isBarrier(world, j)) continue; // a bare wall is not a way to a road
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
