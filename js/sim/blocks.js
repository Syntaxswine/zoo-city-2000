// blocks.js — the 2×2 and 3×3 BLOCKS: how a full High block of tier-3 lots
// becomes one building, and how it comes apart. SPEC §3b, §5.
//
// The owner (2026-09-03): "i'd like some of commercial, industrial,
// residential, and meat buildings to be 2x2 and 3x3 tile sizes. these should
// be the buildings that can hold a lot of people." SimCity 2000's answer, and
// this one: a block is never placed, it GROWS. A tier-3 lot with three lots
// of its zone at tier 2 or better round it in a 2×2 — all High, all served,
// all untroubled, the four together ≥ 70% full — may join them into one 2×2
// at tier 3 holding ×1.25 what four tier-3 lots hold (R 120 · C 100 · I 120
// · M 80); a 2×2 with five such lots round it may join them into a 3×3 (R
// 270 · C 225 · I 270 · M 180). The dense lot absorbs its neighbours, as
// SimCity's do: the first draft asked for all four at tier 3, and in the
// scripted towns 14 of 281 R lots were tier 3 after thirty years and none
// of them touched — the top tier was the bottleneck on the thing above it.
// The roll is lotScore's — the tier-3 lot's reason reads MERGING and its p
// is BIG_P·score, so the card and the tick agree (SPEC §0.6).
//
// THE STATE is one saved byte per tile, `world.big` (world.js): 0 a lot of
// its own; 2 or 3 the anchor (north corner) of a block that side; 0x80 | dx |
// dy << 2 a part, pointing at its anchor. Parts KEEP their zone and tier (3),
// so every "is this built" test in the codebase still says yes, and only the
// four things that need the building itself — capacity, jobs, the standing
// sprite, growth — ask `isPart`. Everyone who lives or works in a block is
// on its ANCHOR: `occupants[anchor]` is the block's count and a part's is 0.
// Readers that want people per TILE (crime's density, a shop's customers)
// use `occAt`, which spreads the anchor's count over the footprint.
//
// A block comes apart three ways, all through `splitLot`: DECAY (the
// anchor's score below −0.15 and, for R, under half full — the block splits
// into tier-3 singles and the excess rehome within twelve road tiles, the
// singles it just made being the nearest vacant lots); a STOREY LOST (fire
// saved, flood, a heist, a raid, the dam — `dissolve` splits first, then the
// one tile loses its storey as it always did); and RUBBLE or a BULLDOZE
// (every tile of the footprint, at once). Fire takes the whole footprint at
// once too (`ignite`), so a block never half-burns.
//
// ORDER. lotsTick walks tiles in raster order and a merge claims tiles that
// come later in the same pass; those are parts by the time the loop reaches
// them and lotScore says PART. Raster order, first wins — deterministic, and
// the 3×3 windows round a 2×2 are tried in raster order of their anchors.

import { KNOBS } from "./rules.js";
import { ZONE, PART, anchorOf, sideOf, footprintOf, capacityOf } from "./world.js";
import { hasAccess } from "./fields.js";
import { placeHousehold, evictFromLot, fireFromLot } from "./citizens.js";
import { KIND, remember } from "./life.js";

/** Can lot j join a block with the tier-3 lot i: same zone, tier 2 or better, a lot of its own, High, on the same line, untroubled, served. */
function joinable(world, i, j) {
  return world.zone[j] === world.zone[i] && world.tier[j] >= 2 && world.big[j] === 0 && world.maxTier[j] === 3 && world.use[j] === world.use[i]
    && !world.rubble[j] && !world.burning[j] && !world.flooded[j] && hasAccess(world, j);
}

const troubled = (world, i) => world.rubble[i] || world.burning[i] || world.flooded[i] || !hasAccess(world, i);

/**
 * The window lot i could merge into next: { side, anchor, tiles } or null.
 * A tier-3 lot of its own looks for the first of the four 2×2 windows that
 * contain it whose three other tiles are joinable; a 2×2 anchor for the
 * first of the four 3×3 windows that contain it whose five other tiles are.
 * Windows are tried in raster order of their anchors (the north corner),
 * which is the block's anchor whatever tier that tile was. Reads only; the
 * roll is lotScore's.
 */
export function mergeWindow(world, i) {
  const { w, h } = world;
  const b = world.big[i];
  if (b & PART) return null;
  if (world.zone[i] === ZONE.NONE || world.tier[i] !== 3 || world.maxTier[i] !== 3 || troubled(world, i)) return null;
  const tx = i % w;
  const ty = (i / w) | 0;
  const side = b === 0 ? 2 : b === 2 ? 3 : 0;
  if (!side) return null;
  const mine = new Set(side === 2 ? [i] : [i, i + 1, i + w, i + w + 1]);
  for (const [ox, oy] of [[-1, -1], [0, -1], [-1, 0], [0, 0]]) {
    const ax = tx + ox;
    const ay = ty + oy;
    if (ax < 0 || ay < 0 || ax + side - 1 >= w || ay + side - 1 >= h) continue;
    // A 3×3 window must contain the whole 2×2, not just its anchor.
    if (side === 3 && (ax > tx || ay > ty || ax + 2 < tx + 1 || ay + 2 < ty + 1)) continue;
    const tiles = [];
    let ok = true;
    for (let dy = 0; dy < side && ok; dy++) {
      for (let dx = 0; dx < side; dx++) {
        const j = (ay + dy) * w + ax + dx;
        tiles.push(j);
        if (!mine.has(j) && !joinable(world, i, j)) { ok = false; break; }
      }
    }
    if (ok) return { side, anchor: ay * w + ax, tiles };
  }
  return null;
}

/** The window's fill: everyone housed or employed on its tiles over their capacity together (a 2×2 anchor counts its own). */
export function windowFill(world, tiles) {
  let cap = 0;
  let filled = 0;
  for (const j of tiles) {
    cap += capacityOf(world, j);
    filled += world.zone[j] === ZONE.R ? world.occupants[j] : world.staff[j];
  }
  return cap ? filled / cap : 0;
}

/**
 * Join the window into one block at tier 3. Everyone on the other tiles
 * moves to the anchor — households by `placeHousehold` (their commutes go
 * stale, as after any move), workers by their `job` — and nobody is evicted:
 * the block holds ×1.25 what four (nine) tier-3 lots hold, more than the
 * window held. Called by lotsTick after the roll.
 */
export function mergeLots(world, win) {
  const { side, anchor, tiles } = win;
  const { w } = world;
  const ax = anchor % w;
  const ay = (anchor / w) | 0;
  const moving = new Set(tiles.filter((j) => j !== anchor));
  for (const j of tiles) {
    const dx = (j % w) - ax;
    const dy = ((j / w) | 0) - ay;
    world.big[j] = j === anchor ? side : PART | dx | (dy << 2);
    world.tier[j] = 3; // the block is a tier-3 building on every tile; a tier-2 lot it absorbed is tier 3 now
  }
  for (const hh of world.households) {
    if (hh.gone || !moving.has(hh.home)) continue;
    const from = hh.home;
    for (const id of hh.members) {
      const c = world.byId.get(id);
      c.home = -1;
      world.occupants[from]--;
    }
    hh.home = -1;
    placeHousehold(world, hh, anchor);
    for (const id of hh.members) remember(world, world.byId.get(id), KIND.MOVED, anchor);
  }
  for (const c of world.citizens) {
    if (c.dead || !moving.has(c.job)) continue;
    world.staff[c.job]--;
    c.job = anchor;
    world.staff[anchor]++;
    c.path = null;
    c.stale = true;
  }
  for (const j of moving) { world.carnAt[anchor] += world.carnAt[j]; world.carnAt[j] = 0; }
  return win;
}

/**
 * The block comes apart into tier-3 lots of its own. Its people are all on
 * the anchor, which now holds one lot's worth; the rest rehome within twelve
 * road tiles (R) or lose the job (C, I, M) — the same rule as a storey lost.
 * `evict: false` leaves the anchor over capacity for a caller that is about
 * to raze every tile anyway (toRubble), so nobody is rehomed twice.
 */
export function splitLot(world, anchor, { evict = true } = {}) {
  const tiles = footprintOf(world, anchor);
  for (const j of tiles) world.big[j] = 0;
  if (evict) {
    const cap = capacityOf(world, anchor);
    if (world.zone[anchor] === ZONE.R) evictFromLot(world, anchor, cap);
    else fireFromLot(world, anchor, cap);
  }
  return tiles;
}

/** Before a tile loses a storey or is razed: if it is in a block, the block comes apart first. Returns the tiles that made up its building — [i] for a lot of its own. */
export function dissolve(world, i, opts) {
  const a = anchorOf(world, i);
  if (sideOf(world, a) === 1) return [i];
  return splitLot(world, a, opts);
}

/** Set fire to a tile — to the whole block, if it is one; a block never half-burns. */
export function ignite(world, i, months) {
  for (const j of footprintOf(world, anchorOf(world, i))) if (!world.burning[j] && world.tier[j] > 0) world.burning[j] = months;
}

/** The capacity table the card and the Rules tab print: blocks by zone and side. */
export function blockCapacities() {
  const out = {};
  for (const [z, caps] of [["R", KNOBS.R_CAP], ["C", KNOBS.C_JOBS], ["I", KNOBS.I_JOBS], ["M", KNOBS.M_JOBS]]) {
    out[z] = { 1: caps[3], 2: Math.round(caps[3] * 4 * KNOBS.BIG_BONUS), 3: Math.round(caps[3] * 9 * KNOBS.BIG_BONUS) };
  }
  return out;
}
