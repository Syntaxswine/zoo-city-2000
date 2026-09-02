// lots.js — growth and decay, and the ONE function that explains it. SPEC §5.
//
// `lotScore(world, i)` decides growth AND produces the hover card's reason
// code. There is no second implementation of "why not": the card can only
// ever say what the rule did (SPEC §0.6).

import { KNOBS } from "./rules.js";
import { ZONE, CIVIC, idx, inBounds, capacityOf, jobsOf } from "./world.js";
import { hasAccess } from "./fields.js";
import { evictFromLot, fireFromLot } from "./citizens.js";

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export const REASON = Object.freeze({
  NO_ROAD: "no road within 3",
  SMOG: "smog too thick",
  NO_DEMAND: "no demand",
  LV_CAP: "land value too low for another storey",
  DENSITY_CAP: "density brush caps this lot",
  WAITING_FILL: "waiting to fill up",
  CAPPED: "the city is at capacity — build a park or a Zoo",
  GROWING: "growing",
  DECAYING: "decaying",
  STABLE: "stable",
  RUBBLE: "rubble — bulldoze it",
  BURNING: "on fire",
  FLOODED: "flooded",
  EMPTY: "zoned, waiting for demand",
});

/** Citizens housed within Chebyshev 5 (shops want customers). */
function residentsNear(world, i, r = 5) {
  const { w } = world;
  const tx = i % w;
  const ty = (i / w) | 0;
  let sum = 0;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const xx = tx + dx;
      const yy = ty + dy;
      if (!inBounds(world, xx, yy)) continue;
      const j = yy * w + xx;
      if (world.zone[j] === ZONE.R) sum += world.occupants[j];
    }
  }
  return sum;
}

export function maxTierByLV(world, i) {
  const z = world.zone[i];
  if (z === ZONE.I) return 3;
  const lv = world.lv[i];
  const byLV = lv < KNOBS.LV_TIER[0] ? 1 : lv < KNOBS.LV_TIER[1] ? 2 : 3;
  return byLV;
}

/**
 * The rule. Returns { score, reason, p, parts, access, maxTier, fill }.
 * `p` is this month's probability of the reason's action (grow or decay).
 */
export function lotScore(world, i) {
  const z = world.zone[i];
  const tier = world.tier[i];
  const out = { score: -1, reason: REASON.EMPTY, p: 0, parts: { valve: 0, local: 0 }, access: false, maxTier: 0, fill: 0 };
  if (z === ZONE.NONE) return out;
  if (world.rubble[i]) { out.reason = REASON.RUBBLE; return out; }
  if (world.burning[i]) { out.reason = REASON.BURNING; return out; }
  if (world.flooded[i]) { out.reason = REASON.FLOODED; return out; }
  const access = hasAccess(world, i);
  out.access = access;
  const valve = world.valves[z === ZONE.R ? "R" : z === ZONE.C ? "C" : "I"];
  const lv = world.lv[i];
  const pol = world.pol[i];
  let local;
  let smog = false;
  if (z === ZONE.R) {
    local = clamp((lv - pol - 40) / KNOBS.LOCAL_SCALE, -KNOBS.LOCAL_CLAMP, KNOBS.LOCAL_CLAMP);
    smog = pol > KNOBS.SMOG_REFUSE;
  } else if (z === ZONE.C) {
    local = 0.6 * clamp(residentsNear(world, i) / 80 - 0.5, -KNOBS.LOCAL_CLAMP, KNOBS.LOCAL_CLAMP) + 0.4 * ((lv - 50) / KNOBS.LOCAL_SCALE);
  } else {
    local = 0.4 * ((50 - lv) / KNOBS.LOCAL_SCALE);
  }
  out.parts = { valve, local };
  const score = access ? valve + local : -1;
  out.score = score;
  const byLV = maxTierByLV(world, i);
  let max = Math.min(byLV, world.maxTier[i]);
  if (z === ZONE.I && tier >= 2 && world.roadDist[i] > 1) max = Math.min(max, 2);
  out.maxTier = max;
  const cap = capacityOf(world, i);
  const filled = z === ZONE.R ? world.occupants[i] : world.staff[i];
  const fill = cap ? filled / cap : 0;
  out.fill = fill;

  // Decay first: it does not need access.
  if (tier > 0 && score < KNOBS.DECAY_THRESH && (z !== ZONE.R || fill < KNOBS.R_FILL_TO_DECAY)) {
    out.reason = access ? REASON.DECAYING : REASON.NO_ROAD;
    out.p = KNOBS.DECAY_P * -score;
    out.decay = true;
    return out;
  }
  if (!access) { out.reason = REASON.NO_ROAD; return out; }
  if (tier < max && score > KNOBS.GROW_THRESH) {
    if (z === ZONE.R && smog) { out.reason = REASON.SMOG; return out; }
    if (tier > 0 && fill < KNOBS.FILL_TO_GROW) { out.reason = REASON.WAITING_FILL; return out; }
    out.reason = REASON.GROWING;
    out.p = (tier === 0 ? KNOBS.SPROUT_P : KNOBS.GROW_P) * score;
    out.grow = true;
    return out;
  }
  if (tier < max && score <= KNOBS.GROW_THRESH) {
    if (z === ZONE.R && world.last && world.last.demand.capped && valve <= KNOBS.GROW_THRESH) out.reason = REASON.CAPPED;
    else out.reason = tier === 0 ? REASON.EMPTY : REASON.NO_DEMAND;
    return out;
  }
  if (tier >= max && tier < 3) {
    out.reason = world.maxTier[i] < byLV ? REASON.DENSITY_CAP : REASON.LV_CAP;
    return out;
  }
  out.reason = REASON.STABLE;
  return out;
}

/** One tick of growth and decay over every lot, raster order. */
export function lotsTick(world) {
  const n = world.w * world.h;
  let grew = 0;
  let decayed = 0;
  const rng = world.rng;
  for (let i = 0; i < n; i++) {
    if (world.zone[i] === ZONE.NONE) continue;
    const s = lotScore(world, i);
    if (s.grow) {
      if (rng.chance(s.p)) {
        world.tier[i]++;
        grew++;
      }
    } else if (s.decay) {
      if (rng.chance(s.p)) {
        world.tier[i]--;
        decayed++;
        const cap = capacityOf(world, i);
        if (world.zone[i] === ZONE.R) evictFromLot(world, i, cap);
        else fireFromLot(world, i, cap);
      }
    }
  }
  return { grew, decayed };
}

/** Data for the hover card. */
export function lotReport(world, i) {
  const z = world.zone[i];
  const s = lotScore(world, i);
  const rep = {
    tx: i % world.w,
    ty: (i / world.w) | 0,
    zone: z,
    tier: world.tier[i],
    maxTier: world.maxTier[i],
    civic: world.civic[i],
    lv: world.lv[i],
    pol: world.pol[i],
    roadDist: world.roadDist[i],
    traffic: world.traffic[i],
    score: s,
    capacity: capacityOf(world, i),
    occupants: world.occupants[i],
    staff: world.staff[i],
    jobs: jobsOf(world, i),
    households: [],
    workers: [],
  };
  if (z === ZONE.R) {
    const hh = new Map();
    for (const c of world.citizens) {
      if (c.home !== i) continue;
      const h = hh.get(c.household) || { id: c.household, surname: c.surname, members: [] };
      h.members.push(c);
      hh.set(c.household, h);
    }
    rep.households = [...hh.values()];
  } else if (jobsOf(world, i)) {
    for (const c of world.citizens) if (c.job === i) rep.workers.push(c);
  }
  return rep;
}
