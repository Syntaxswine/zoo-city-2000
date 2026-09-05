// world.js — the state, and the map it starts with. SPEC §2, §15.
//
// One flat object holds everything; typed arrays per tile, plain arrays for
// citizens and households. Derived fields (roadDist, pol, lv, traffic,
// occupants, staff, majority, paths) are rebuilt by `rebuildDerived` and never saved.

import { makeRng, seedFromString, hash01 } from "./rng.js";
import { KNOBS } from "./rules.js";
import { USE } from "./use.js";

export { USE } from "./use.js";

export const TERRAIN = Object.freeze({ GRASS: 0, WATER: 1, TREE: 2 });
export const ROAD = Object.freeze({ NONE: 0, ROAD: 1, BRIDGE: 2 });
export const ZONE = Object.freeze({ NONE: 0, R: 1, C: 2, I: 3, M: 4 });
// 9–12 are the knowledge-and-culture buildings (SPEC §9e, 2026-09-05): appended after the Zoo, never renumbered,
// and never inferred from a footprint's size — a 2×2 Library and a legacy 2×2 Large Park share a side and nothing else.
export const CIVIC = Object.freeze({ NONE: 0, PARK: 1, LARGE_PARK: 2, LARGE_PARK_PART: 3, FIRE: 4, POLICE: 5, CENTRE: 6, PART: 7, ZOO: 8, LIBRARY: 9, UNIVERSITY: 10, GALLERY: 11, AMPHITHEATER: 12 });
export const isStation = (c) => c === CIVIC.FIRE || c === CIVIC.POLICE; // coverage
export const isKnowledgeCivic = (c) => c === CIVIC.LIBRARY || c === CIVIC.UNIVERSITY; // the knowledge field
export const isCultureCivic = (c) => c === CIVIC.GALLERY || c === CIVIC.AMPHITHEATER; // the culture field
export const isCivicEmployer = (c) => isStation(c) || c === CIVIC.CENTRE || c === CIVIC.ZOO || isKnowledgeCivic(c) || isCultureCivic(c); // jobs
/** The footprint side a kind is BUILT at (ops.js): the small services 2×2, the campuses 3×3, the park 1×1. Legacy saves carry their own side in civicSize. */
export const CIVIC_SIDE = Object.freeze({ park: 1, fire: 3, police: 3, centre: 3, largePark: 3, zoo: 3, library: 2, university: 3, gallery: 2, amphitheater: 3 });
export const CIVIC_OF_KIND = Object.freeze({ park: CIVIC.PARK, fire: CIVIC.FIRE, police: CIVIC.POLICE, centre: CIVIC.CENTRE, largePark: CIVIC.LARGE_PARK, zoo: CIVIC.ZOO, library: CIVIC.LIBRARY, university: CIVIC.UNIVERSITY, gallery: CIVIC.GALLERY, amphitheater: CIVIC.AMPHITHEATER });
export const KIND_OF_CIVIC = Object.freeze(Object.fromEntries(Object.entries(CIVIC_OF_KIND).map(([k, v]) => [v, k])));
/**
 * The jobs a civic anchor offers — EXPLICIT per kind. The knowledge-and-culture
 * review (F4) found that jobsOf fell through to STATION_JOBS for any employer
 * it did not list, so an unlisted University would have offered four jobs and
 * nothing would have said so. A kind not in this table offers none.
 */
export function civicJobs(c) {
  switch (c) {
    case CIVIC.ZOO: return KNOBS.ZOO_JOBS;
    case CIVIC.LARGE_PARK: return KNOBS.LARGE_PARK_JOBS;
    case CIVIC.CENTRE: return KNOBS.CENTRE_JOBS;
    case CIVIC.FIRE: case CIVIC.POLICE: return KNOBS.STATION_JOBS;
    case CIVIC.LIBRARY: return KNOBS.LIBRARY_JOBS;
    case CIVIC.UNIVERSITY: return KNOBS.UNIVERSITY_JOBS;
    case CIVIC.GALLERY: return KNOBS.GALLERY_JOBS;
    case CIVIC.AMPHITHEATER: return KNOBS.AMPHITHEATER_JOBS;
    default: return 0;
  }
}
export const ZONE_NAME = ["none", "R", "C", "I", "M"];
/** Use-zoning: who a lot or road admits. Stable 16-bit codes live in use.js; species.js applies them. */
/** In custody or a market pen: not working, socialising, breeding, hunting or on the street. */
export const absent = (world, c) => !!c.pen || (c.held || 0) > world.tick;

export const idx = (w, tx, ty) => ty * w.w + tx;
export const inBounds = (w, tx, ty) => tx >= 0 && ty >= 0 && tx < w.w && ty < w.h;

/** A fresh, generated world. */
export function createWorld({ seed = "zoo", w = 64, h = 64 } = {}) {
  const seedNum = seedFromString(String(seed));
  const n = w * h;
  const world = {
    version: 1,
    seed: String(seed),
    seedNum,
    w,
    h,
    tick: 0,
    cash: KNOBS.START_CASH,
    rates: { R: 8, C: 8, I: 8 },
    terrain: new Uint8Array(n),
    road: new Uint8Array(n),
    zone: new Uint8Array(n),
    maxTier: new Uint8Array(n).fill(3),
    tier: new Uint8Array(n),
    since: new Uint32Array(n), // cosmetic building history: last expansion tick + 1; zero when empty
    civic: new Uint8Array(n),
    civicSize: new Uint8Array(n), // anchor side, or 128 | dx | dy << 2 on a civic part; zero preserves legacy sizes
    burning: new Uint8Array(n),
    rubble: new Uint8Array(n),
    variant: new Uint8Array(n),
    flooded: new Uint8Array(n),
    wall: new Uint8Array(n), // a wall tile; with a road or rail on it, a tunnel (SPEC §6b, sim/reach.js)
    use: new Uint16Array(n), // bitmask: mixed (0), predator/prey, and any combination of 14 species (SPEC §7.8)
    rail: new Uint8Array(n), // 0 none · 1 rail · 2 station (SPEC §7.9); served from road within ROAD_REACH across a walked forecourt
    meat: new Uint16Array(n), // units on hand at a meat hall; Part H supplies the flows
    big: new Uint8Array(n), // a BLOCK (SPEC §3b, sim/blocks.js): 0 a lot of its own · 2 | 3 the anchor of a 2×2 | 3×3 · PART | dx | dy << 2 a part pointing at its anchor
    cam: new Uint8Array(n), // a security CAMERA on this road tile (SPEC §9d, docs/PROPOSAL-CAMERAS.md): 0 none · 1 a camera
    theme: new Uint8Array(n), // a LANDMARK (SPEC §3c, sim/landmarks.js): on a 3×3's anchor, the id of the species' landmark it rose as; 0 the plain block
    // derived
    roadDist: new Uint8Array(n),
    pol: new Uint8Array(n),
    lv: new Uint8Array(n),
    traffic: new Uint16Array(n),
    crime: new Uint8Array(n),
    fireCov: new Uint8Array(n),
    policeCov: new Uint8Array(n),
    camCov: new Uint8Array(n),
    knowledge: new Uint8Array(n), // 0 none · 1 a Library · 2 a University reaches this tile (the strongest; fields.computeKnowledgeCulture; SPEC §9e)
    culture: new Uint8Array(n), // 0 none · 1 a Gallery · 2 an Amphitheater
    _camGen: 0, // the camera walk’s visited-set generation (fields.computeCamCover)
    dread: new Uint8Array(n),
    carnAt: new Uint16Array(n), // Uint16 since the blocks: a 3×3 R block keeps 270 animals on its anchor
    occupants: new Uint16Array(n),
    staff: new Uint16Array(n),
    majority: new Uint8Array(n), // majority resident/staff species index + 1; 0 means none
    occl: new Uint8Array(n), // reach.js: the eight directions influence may cross a tile (derived)
    roadsDirty: true,
    wallsDirty: true,
    wallCount: 0,
    // sim
    valves: { R: 0, C: 0, I: 0, M: 0 },
    festivalBonus: 0,
    citizens: [],
    households: [],
    campers: [],
    names: {}, // compatibility-only: old object records migrate to `legacy` at load
    legacy: [], // permanent shorthand citizen records; derived lookup is not saved
    deaths: [], // compact [tick, id] ring; details live in the permanent archive
    lifeEvents: [], // this tick only; storyTick is the sole bridge to news
    nextId: 1,
    nextHouseholdId: 1,
    events: { active: [], cooldown: 0, log: [], lastGrant: -100000, lastFestival: -100000, choice: null, noDisasters: false, scrubbers: false, revoltArmed: 0, centenaries: [], files: [], licence: false, lastLicenceOffer: -100000, lastRaid: -100000, killings: 0, arrests: [], justice: { takenIn: 0, cells: 0, wrongful: 0, exonerated: 0, cold: 0, sold: 0, pacified: 0, trespass: 0 } },
    ledger: {},
    history: [],
    log: [],
    flags: { receivership: false, milestone: 0 },
    notices: [],
    rng: makeRng(seedNum ^ 0x5a17),
    rngNames: makeRng(seedNum ^ 0x9e37),
    last: null,
    byId: new Map(),
    hhById: new Map(),
  };
  for (let i = 0; i < n; i++) world.variant[i] = Math.floor(hash01(i % w, (i / w) | 0, seedNum) * 256);
  generateTerrain(world);
  placeStartingRoad(world);
  return world;
}

// ---------------------------------------------------------------------------
// Terrain: one river as a biased random walk edge to edge, 1–2 ponds, tree
// clumps. Uses its own stream so the sim stream starts identical for every
// map size.
// ---------------------------------------------------------------------------

function generateTerrain(world) {
  const { w, h, terrain } = world;
  const rng = makeRng(world.seedNum ^ 0x7e11);
  terrain.fill(TERRAIN.GRASS);

  // River: pick an axis; walk from one edge to the other with lateral drift.
  const vertical = rng.chance(0.5);
  const len = vertical ? h : w;
  const span = vertical ? w : h;
  let pos = Math.floor(span * (0.3 + 0.4 * rng.next()));
  let width = 2;
  let drift = 0;
  for (let t = 0; t < len; t++) {
    drift += (rng.next() - 0.5) * 0.9;
    drift = Math.max(-1.2, Math.min(1.2, drift));
    pos += drift;
    if (pos < 4) { pos = 4; drift = Math.abs(drift); }
    if (pos > span - 5) { pos = span - 5; drift = -Math.abs(drift); }
    if (t % 9 === 0) width = 2 + (rng.chance(0.4) ? 1 : 0);
    const c = Math.round(pos);
    for (let k = 0; k < width; k++) {
      const p = c + k - (width >> 1);
      if (p < 0 || p >= span) continue;
      const tx = vertical ? p : t;
      const ty = vertical ? t : p;
      terrain[idx(world, tx, ty)] = TERRAIN.WATER;
    }
  }

  // Ponds: 1–2 ellipses on dry land.
  const ponds = 1 + (rng.chance(0.5) ? 1 : 0);
  for (let p = 0; p < ponds; p++) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const cx = 6 + rng.int(w - 12);
      const cy = 6 + rng.int(h - 12);
      if (terrain[idx(world, cx, cy)] === TERRAIN.WATER) continue;
      const rx = 2 + rng.int(3);
      const ry = 1 + rng.int(3);
      for (let ty = cy - ry; ty <= cy + ry; ty++) {
        for (let tx = cx - rx; tx <= cx + rx; tx++) {
          if (!inBounds(world, tx, ty)) continue;
          const dx = (tx - cx) / (rx + 0.5);
          const dy = (ty - cy) / (ry + 0.5);
          if (dx * dx + dy * dy <= 1) terrain[idx(world, tx, ty)] = TERRAIN.WATER;
        }
      }
      break;
    }
  }

  // Trees: clumps until ~18% of land.
  const land = countLand(world);
  const target = Math.floor(land * 0.18);
  let planted = 0;
  let guard = 0;
  while (planted < target && guard++ < 4000) {
    const cx = rng.int(w);
    const cy = rng.int(h);
    const r = 1 + rng.int(4);
    for (let ty = cy - r; ty <= cy + r; ty++) {
      for (let tx = cx - r; tx <= cx + r; tx++) {
        if (!inBounds(world, tx, ty)) continue;
        const d2 = (tx - cx) ** 2 + (ty - cy) ** 2;
        if (d2 > r * r) continue;
        const i = idx(world, tx, ty);
        if (terrain[i] !== TERRAIN.GRASS) continue;
        if (rng.chance(0.75 - d2 / (r * r + 1) * 0.5)) {
          terrain[i] = TERRAIN.TREE;
          planted++;
        }
      }
    }
  }
}

function countLand(world) {
  let n = 0;
  for (let i = 0; i < world.terrain.length; i++) if (world.terrain[i] !== TERRAIN.WATER) n++;
  return n;
}

/**
 * The opening beat: one edge road, a 6-tile stub entering from the map edge
 * nearest the centroid of the largest dry region, ending in a T.
 */
function placeStartingRoad(world) {
  const { w, h } = world;
  // Largest dry component by flood fill.
  const seen = new Uint8Array(w * h);
  let best = null;
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || world.terrain[s] === TERRAIN.WATER) continue;
    const stack = [s];
    seen[s] = 1;
    let count = 0;
    let sx = 0;
    let sy = 0;
    while (stack.length) {
      const i = stack.pop();
      count++;
      sx += i % w;
      sy += (i / w) | 0;
      const tx = i % w;
      const ty = (i / w) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (!inBounds(world, nx, ny)) continue;
        const j = idx(world, nx, ny);
        if (seen[j] || world.terrain[j] === TERRAIN.WATER) continue;
        seen[j] = 1;
        stack.push(j);
      }
    }
    if (!best || count > best.count) best = { count, cx: sx / count, cy: sy / count };
  }
  const cx = Math.round(best.cx);
  const cy = Math.round(best.cy);
  // Nearest edge to the centroid.
  const cands = [
    { d: cx, dir: [1, 0], start: [0, cy] },
    { d: w - 1 - cx, dir: [-1, 0], start: [w - 1, cy] },
    { d: cy, dir: [0, 1], start: [cx, 0] },
    { d: h - 1 - cy, dir: [0, -1], start: [cx, h - 1] },
  ].sort((a, b) => a.d - b.d);
  for (const c of cands) {
    // Walk 6 tiles in from the edge; require all dry.
    const tiles = [];
    let ok = true;
    for (let k = 0; k < 6; k++) {
      const tx = c.start[0] + c.dir[0] * k;
      const ty = c.start[1] + c.dir[1] * k;
      if (!inBounds(world, tx, ty) || world.terrain[idx(world, tx, ty)] === TERRAIN.WATER) { ok = false; break; }
      tiles.push([tx, ty]);
    }
    if (!ok) continue;
    for (const [tx, ty] of tiles) {
      const i = idx(world, tx, ty);
      world.road[i] = ROAD.ROAD;
      world.terrain[i] = TERRAIN.GRASS;
    }
    // The T: two tiles either side of the stub's end, perpendicular.
    const [ex, ey] = tiles[tiles.length - 1];
    const perp = [c.dir[1], c.dir[0]];
    for (const s of [-1, 1]) {
      for (let k = 1; k <= 2; k++) {
        const tx = ex + perp[0] * s * k;
        const ty = ey + perp[1] * s * k;
        if (!inBounds(world, tx, ty) || world.terrain[idx(world, tx, ty)] === TERRAIN.WATER) break;
        const i = idx(world, tx, ty);
        world.road[i] = ROAD.ROAD;
        world.terrain[i] = TERRAIN.GRASS;
      }
    }
    world.start = { tx: ex, ty: ey };
    return;
  }
  world.start = { tx: cx, ty: cy };
}

// ---------------------------------------------------------------------------
// Small shared helpers used by several sim modules.
// ---------------------------------------------------------------------------

export const N4 = Object.freeze([[1, 0], [-1, 0], [0, 1], [0, -1]]);

export function isRoad(world, i) {
  return world.road[i] !== ROAD.NONE;
}

/** Zoned lots that can hold a building (not rubble is handled by callers). */
export function isLot(world, i) {
  return world.zone[i] !== ZONE.NONE;
}

// ---------------------------------------------------------------------------
// Blocks (SPEC §3b; the mechanics are in sim/blocks.js). `big[i]` is 0 for a
// lot of its own, the side (2 or 3) on a block's anchor, and PART | dx |
// (dy << 2) on a part. A part keeps its zone and tier, holds nobody, and
// offers nothing; the anchor holds the block's people and offers its jobs.
// ---------------------------------------------------------------------------

export const PART = 0x80;
export const isPart = (world, i) => (world.big[i] & PART) !== 0;
/** The anchor of the block tile i is in — i itself for a lot of its own or an anchor. */
export function anchorOf(world, i) {
  const b = world.big[i];
  if (!(b & PART)) return i;
  return i - (b & 3) - ((b >> 2) & 3) * world.w;
}
/** 1 for a lot of its own; the side of the block tile i is in. */
export function sideOf(world, i) {
  const b = world.big[anchorOf(world, i)];
  return b === 2 || b === 3 ? b : 1;
}
/** The tiles of the block anchored at `anchor` (just [anchor] for a lot of its own), raster order. */
export function footprintOf(world, anchor) {
  const s = sideOf(world, anchor);
  const out = [];
  for (let dy = 0; dy < s; dy++) for (let dx = 0; dx < s; dx++) out.push(anchor + dx + dy * world.w);
  return out;
}
/** Resolve any civic tile to its owner; parts encode offsets, so adjacent campuses are unambiguous. */
export function civicAnchorOf(world, i) {
  const c = world.civic[i];
  if (!c) return -1;
  if (c === CIVIC.PART) {
    const p = world.civicSize[i];
    return p & 128 ? i - (p & 3) - ((p >> 2) & 3) * world.w : -1;
  }
  if (c !== CIVIC.LARGE_PARK_PART) return i;
  // Legacy two-tile-side zoo parts retain their existing footprint on load.
  const tx = i % world.w, ty = (i / world.w) | 0;
  for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) {
    const ax = tx + dx, ay = ty + dy;
    if (inBounds(world, ax, ay) && world.civic[idx(world, ax, ay)] === CIVIC.LARGE_PARK) return idx(world, ax, ay);
  }
  return -1;
}

export function civicSideOf(world, i) {
  const a = civicAnchorOf(world, i);
  return a < 0 ? 1 : world.civicSize[a] || (world.civic[a] === CIVIC.LARGE_PARK ? 2 : 1);
}

export function civicTiles(world, i) {
  const a = civicAnchorOf(world, i);
  if (a < 0) return [i];
  const side = civicSideOf(world, a), out = [];
  for (let dy = 0; dy < side; dy++) for (let dx = 0; dx < side; dx++) out.push(a + dx + dy * world.w);
  return out;
}

// Compatibility helpers for legacy callers; new code asks about any civic.
export const zooAnchorOf = (world, i) => {
  const a = civicAnchorOf(world, i);
  return a >= 0 && world.civic[a] === CIVIC.LARGE_PARK ? a : -1;
};
export const zooTiles = civicTiles;

/** Every tile of one site: a civic campus, zoned block, or individual lot. */
export function siteTiles(world, i) {
  return world.civic[i] ? civicTiles(world, i) : footprintOf(world, anchorOf(world, i));
}

/** What a block holds over what its lots held: side² × BIG_BONUS (1 for a lot of its own). */
export const blockMultiplier = (side) => (side > 1 ? side * side * KNOBS.BIG_BONUS : 1);
/** People housed on tile j for readers that want them per TILE (crime's density, a shop's customers): a block's are spread over its footprint. */
export function occAt(world, j) {
  const a = anchorOf(world, j);
  const s = sideOf(world, a);
  return s > 1 ? world.occupants[a] / (s * s) : world.occupants[j];
}
export function carnAtOf(world, j) {
  const a = anchorOf(world, j);
  const s = sideOf(world, a);
  return s > 1 ? world.carnAt[a] / (s * s) : world.carnAt[j];
}

export function capacityOf(world, i) {
  const z = world.zone[i];
  const t = world.tier[i];
  const b = world.big[i];
  if (b & PART) return 0;
  const m = blockMultiplier(b);
  if (z === ZONE.R) return Math.round(KNOBS.R_CAP[t] * m);
  if (z === ZONE.C) return Math.round(KNOBS.C_JOBS[t] * m);
  if (z === ZONE.I) return Math.round(KNOBS.I_JOBS[t] * m);
  if (z === ZONE.M) return Math.round(KNOBS.M_JOBS[t] * m);
  return civicJobs(world.civic[i]); // a civic anchor's places; a PART is 0 by the table
}

/** Jobs offered by a tile (C, I, M, a zoo anchor, a fire or police station, the centre); a block's part offers none. */
export function jobsOf(world, i) {
  if (world.civic[i] === CIVIC.ZOO) return KNOBS.ZOO_JOBS;
  const z = world.zone[i];
  const b = world.big[i];
  if (b & PART) return 0;
  const m = blockMultiplier(b);
  if (z === ZONE.C) return Math.round(KNOBS.C_JOBS[world.tier[i]] * m);
  if (z === ZONE.I) return Math.round(KNOBS.I_JOBS[world.tier[i]] * m);
  if (z === ZONE.M) return Math.round(KNOBS.M_JOBS[world.tier[i]] * m);
  return civicJobs(world.civic[i]);
}

/** Which demand a job site counts toward: C (zoo, stations and the centre count as C), I, or M (the meat halls — their own valve). */
export function jobZone(world, i) {
  if (world.zone[i] === ZONE.C || world.civic[i] === CIVIC.LARGE_PARK || isCivicEmployer(world.civic[i])) return ZONE.C;
  if (world.zone[i] === ZONE.I) return ZONE.I;
  if (world.zone[i] === ZONE.M) return ZONE.M;
  return ZONE.NONE;
}

/** Deterministic per-tile hash in [0,1) for the painter and variants. */
export function tileHash(world, i, salt = 0) {
  return hash01(i % world.w, (i / world.w) | 0, world.seedNum ^ salt);
}
