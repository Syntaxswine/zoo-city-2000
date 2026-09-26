// lots.js — growth and decay, and the ONE function that explains it. SPEC §5.
//
// `lotScore(world, i)` decides growth AND produces the hover card's reason
// code. There is no second implementation of "why not": the card can only
// ever say what the rule did (SPEC §0.6).

import { buildingMark } from "./building-marks.js";
import { KNOBS } from "./rules.js";
import { ZONE, CIVIC, idx, inBounds, capacityOf, jobsOf, isPart, isMarket, civicAnchorOf, civicSideOf, anchorOf, footprintOf, sideOf, carnAtOf } from "./world.js";
import { policy } from "./governance.js";
import { served, siteRoadDist, doorsOf, nearestRoad } from "./fields.js";
import { evictFromLot, fireFromLot } from "./citizens.js";
import { mergeWindow, windowFill, mergeLots, splitLot } from "./blocks.js";
import { landmarkOf, landmarkLine } from "./landmarks.js";
import { shopOf } from "./shops.js";
import { commercialCustomers } from "./commercial-customers.js";
import { attainableClass, estateName, mansionWindow, raiseMansion, mansionLine } from "./wealth.js";

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
  MERGING: "joining the block",
  DECAYING: "decaying",
  STABLE: "stable",
  RUBBLE: "rubble — it clears itself, or bulldoze it",
  BURNING: "on fire",
  FLOODED: "flooded",
  EMPTY: "zoned, waiting for demand",
  PART: "part of the block",
  MANSION: "a mansion — one household of the affluent; it neither grows nor decays",
  MANSION_RISING: "a mansion is rising — the address is affluent",
  MARKET_SITE: "a bare market site, waiting for trade",
  LIGHT_MARKET: "a Light market — the H brush stopped it at the full square",
  PROHIBITED: "shut — the meat trade is prohibited (Governance)",
  MARKET_FULL: "the town would not keep another stage — it holds at this size",
});

/** Carnivores housed within Chebyshev r (a meat hall's customers); a block's are spread over its footprint. */
function carnivoresNear(world, i, r = 5) {
  const { w } = world;
  const tx = i % w;
  const ty = (i / w) | 0;
  let sum = 0;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const xx = tx + dx;
      const yy = ty + dy;
      if (!inBounds(world, xx, yy)) continue;
      sum += carnAtOf(world, yy * w + xx);
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
  if (isMarket(world.civic[i])) return marketScore(world, i, out);
  if (z === ZONE.NONE) return out;
  // A block's part: the building is on the anchor; this tile grows, decays and burns with it (blocks.js).
  if (isPart(world, i)) { out.reason = REASON.PART; out.anchor = anchorOf(world, i); return out; }
  if (world.rubble[i]) { out.reason = REASON.RUBBLE; return out; }
  if (world.burning[i]) { out.reason = REASON.BURNING; return out; }
  if (world.flooded[i]) { out.reason = REASON.FLOODED; return out; }
  const access = served(world, i);
  out.access = access;
  // A standing MANSION (SPEC §9f, wealth.js) never grows, decays or merges by this rule: its own reason, p 0, so lotsTick
  // rolls nothing here; it comes down as a block does (fire, flood, the bulldozer). Unserved it says NO_ROAD like any lot.
  if (world.mansion[i]) {
    const cap = capacityOf(world, i);
    out.maxTier = 3;
    out.fill = cap ? world.occupants[i] / cap : 0;
    out.score = 0;
    out.reason = !access ? REASON.NO_ROAD : REASON.MANSION;
    return out;
  }
  const valve = world.valves[z === ZONE.R ? "R" : z === ZONE.C ? "C" : "I"];
  const lv = world.lv[i];
  const pol = world.pol[i];
  let local;
  let smog = false;
  if (z === ZONE.R) {
    local = clamp((lv - pol - 40) / KNOBS.LOCAL_SCALE, -KNOBS.LOCAL_CLAMP, KNOBS.LOCAL_CLAMP);
    smog = pol > KNOBS.SMOG_REFUSE;
  } else if (z === ZONE.C) {
    out.customers = commercialCustomers(world, i);
    local = 0.6 * clamp(out.customers.total / 80 - 0.5, -KNOBS.LOCAL_CLAMP, KNOBS.LOCAL_CLAMP) + 0.4 * ((lv - 50) / KNOBS.LOCAL_SCALE);
    if (world.crime[i] > KNOBS.CRIME_HIGH) local -= KNOBS.CRIME_C_PENALTY; // shops need safe streets
  } else {
    local = 0.4 * ((50 - lv) / KNOBS.LOCAL_SCALE);
  }
  out.parts = { valve, local };
  const score = access ? valve + local : -1;
  out.score = score;
  const byLV = maxTierByLV(world, i);
  let max = Math.min(byLV, world.maxTier[i]);
  // SC2000's frontage rule used to hold industry above tier 2 to a lot with a
  // road ONE tile away, which meant the inside of an industrial block could
  // never rise as tall as its edge. Access is one standard now (SPEC 6c): a
  // works within reach of a road is a works, wherever in the block it stands.
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
  // A MANSION RISES (SPEC §9f) where the ADDRESS is affluent and demand is positive: the 3×3 of housing anchored at this lot
  // or block anchor — nine R tiles, lots of their own or whole blocks lying inside it — at MANSION_P·score a month (a storey's
  // sprouting rate — the address has done the work a storey's fill does) — before any storey or merge here, because the
  // address's class is what the ground is for (the owner: "it happens naturally like when the building upgrades to an
  // apartment building"; "mansions should rise in dense blocks too").
  if (z === ZONE.R && score > KNOBS.GROW_THRESH) {
    const win = mansionWindow(world, i);
    if (win) { out.reason = REASON.MANSION_RISING; out.p = KNOBS.MANSION_P * score; out.mansion = win; return out; }
  }
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
  // Tier 3 and wanted: the block (SPEC §3b, blocks.js). A lot of its own with
  // three joinable neighbours in a 2×2 round it, or a 2×2 with five round it,
  // joins them when the window is FILL_TO_GROW full together — the same fill
  // gate as a storey, the same p as growth. The window is on the report
  // either way, so the card can say what the block is waiting for.
  if (tier === 3 && world.big[i] !== 3) {
    const win = mergeWindow(world, i);
    if (win) {
      const fill = windowFill(world, win.tiles);
      out.window = { side: win.side, fill };
      if (score > KNOBS.GROW_THRESH && fill >= KNOBS.FILL_TO_GROW) {
        out.reason = REASON.MERGING;
        out.p = KNOBS.BIG_P * score;
        out.merge = win;
        return out;
      }
    }
  }
  out.reason = REASON.STABLE;
  return out;
}

/**
 * THE MEAT MARKET's rule (docs/PROPOSAL-MEAT-MARKET-2026-09-26.md A.3) — a zoned meat lot's own, the M valve plus
 * local_M at the anchor, read over STAGES instead of storeys. It opens at its form's first stage (Light one stall,
 * Heavy the full square) at SPROUT_P, grows a stage at GROW_P once FILL_TO_GROW of its places are filled, stops at
 * its form's top, and loses a stage at DECAY_P (`marketStepDown`). No merging: a market is already the block.
 */
function marketScore(world, i, out) {
  if (world.burning[i]) { out.reason = REASON.BURNING; return out; }
  if (world.flooded[i]) { out.reason = REASON.FLOODED; return out; }
  if (policy(world, "meatTrade") === "prohibited") { out.reason = REASON.PROHIBITED; return out; }
  const access = served(world, i);
  out.access = access;
  const valve = world.valves.M;
  // A market wants carnivores near and cheap ground, and stocked hooks help; a grey market minds no crime.
  const local = 0.6 * clamp(carnivoresNear(world, i) / KNOBS.M_CUSTOMERS_DIV - 0.5, -KNOBS.LOCAL_CLAMP, KNOBS.LOCAL_CLAMP) + 0.4 * ((50 - world.lv[i]) / KNOBS.LOCAL_SCALE)
    + KNOBS.MEAT_LOCAL * Math.min(1, (world.meat[i] || 0) / 8);
  out.parts = { valve, local };
  const score = access ? valve + local : -1;
  out.score = score;
  const stage = world.tier[i];
  const form = world.maxTier[i] === 1 ? 1 : 3;
  const top = KNOBS.MARKET_TOP[form];
  out.maxTier = top;
  const cap = capacityOf(world, i);
  out.fill = cap ? world.staff[i] / cap : 0;
  if (stage > 0 && score < KNOBS.DECAY_THRESH) {
    out.reason = access ? REASON.DECAYING : REASON.NO_ROAD;
    out.p = KNOBS.DECAY_P * -score;
    out.decay = true;
    return out;
  }
  if (!access) { out.reason = REASON.NO_ROAD; return out; }
  if (stage < top && score > KNOBS.GROW_THRESH) {
    if (stage > 0 && out.fill < KNOBS.FILL_TO_GROW) { out.reason = REASON.WAITING_FILL; return out; }
    // A MARKET DOES NOT OUTGROW ITS TOWN: it takes its next stage only if the town would still keep it there — the
    // score it would have one stage up stays at or above the decay line. Its steps are coarse (the square to the hall
    // is +45 jobs, the hall to the exchange +108, a Heavy market opens at 27), and without this one grew past demand,
    // decayed back and grew again: rocking on its steps (docs/PROPOSAL-MEAT-MARKET-2026-09-26.md C.3). A zoned lot's
    // step is a few jobs among many lots and never needed it.
    if (!marketWouldHold(world, i, stage === 0 ? KNOBS.MARKET_FLOOR[form] : stage + 1, local)) { out.reason = REASON.MARKET_FULL; return out; }
    out.reason = REASON.GROWING;
    out.p = (stage === 0 ? KNOBS.SPROUT_P : KNOBS.GROW_P) * score;
    out.grow = true;
    return out;
  }
  if (stage < top) { out.reason = stage === 0 ? REASON.MARKET_SITE : REASON.NO_DEMAND; return out; }
  out.reason = form === 1 ? REASON.LIGHT_MARKET : REASON.STABLE;
  return out;
}

/**
 * Would the town keep this market one stage up? The score it would SETTLE at there: the meat valve's target
 * (demand.js — the demand term, 0.06 a carnivore + 10 over the meat jobs Jm, plus the tax term and any boost) with the
 * stage's extra jobs added to this month's Jm (world.now), plus the market's own local term — and it must not be below the decay
 * line. The settled score, not today's: the valve lags its target, and a market judged on a lagging valve plus a jump
 * was held back when rising and let through when falling. No census yet (the first month): nothing to judge by, so yes.
 */
function marketWouldHold(world, i, next, local) {
  const src = world.now || world.last; // this month's, inside the tick (tick.js says why not world.last)
  const cen = src?.census, dem = src?.demand;
  if (!cen || !dem) return true;
  const wanted = KNOBS.MEAT_PER_CARN * (cen.carnivores || 0) + KNOBS.MEAT_SEED;
  const after = (cen.Jm || 0) + (KNOBS.MARKET_JOBS[next] || 0) - (KNOBS.MARKET_JOBS[world.tier[i]] || 0);
  const term = clamp((wanted - after) / Math.max(after, 20), -1, 1);
  const valve = clamp(term + (dem.T?.M || 0) + (dem.boost?.M || 0), -1, 1);
  return valve + local >= KNOBS.DECAY_THRESH;
}

/** A market grows one stage — from the bare site straight to its form's first (KNOBS.MARKET_FLOOR). */
function marketStepUp(world, i) {
  world.tier[i] = world.tier[i] ? world.tier[i] + 1 : KNOBS.MARKET_FLOOR[world.maxTier[i] === 1 ? 1 : 3];
}

/**
 * A market loses one stage — decay, a raid, a fire the engine reached — and lets go of the staff its new stage has
 * no place for. A Heavy market below its full square closes to the bare site: Heavy is 27–180 jobs (the owner).
 * Its stock and pens follow through the one hall predicate (meat.js normalizeStock, reconcilePens).
 */
export function marketStepDown(world, i) {
  if (!world.tier[i]) return;
  const floor = KNOBS.MARKET_FLOOR[world.maxTier[i] === 1 ? 1 : 3];
  world.tier[i] = world.tier[i] - 1 < floor ? 0 : world.tier[i] - 1;
  fireFromLot(world, i, capacityOf(world, i));
}

/** One tick of growth, decay and the blocks over every lot, raster order. */
export function lotsTick(world) {
  const n = world.w * world.h;
  let grew = 0;
  let decayed = 0;
  let merged = 0;
  const landmarks = []; // the lines: a 3×3 that rose as a landmark this month (SPEC §3c)
  const mansions = []; // the lines: a mansion that rose this month (SPEC §9f)
  const rng = world.rng;
  for (let i = 0; i < n; i++) {
    if (isMarket(world.civic[i])) {
      const s = lotScore(world, i);
      if (s.grow && rng.chance(s.p)) { marketStepUp(world, i); grew++; }
      else if (s.decay && rng.chance(s.p)) { marketStepDown(world, i); decayed++; }
      continue;
    }
    if (world.zone[i] === ZONE.NONE) continue;
    const s = lotScore(world, i);
    if (s.grow) {
      if (rng.chance(s.p)) {
        world.tier[i]++;
        grew++;
      }
    } else if (s.merge) {
      if (rng.chance(s.p)) {
        const res = mergeLots(world, s.merge); // the tiles it claims are parts when the loop reaches them
        merged++;
        if (res.landmark) {
          const line = landmarkLine(world, res.anchor, res.landmark);
          landmarks.push(line);
          world.events.log.push({ t: world.tick, id: "landmark", line });
        }
      }
    } else if (s.mansion) {
      if (rng.chance(s.p)) {
        const res = raiseMansion(world, s.mansion); // the tiles it claims are parts when the loop reaches them
        const line = mansionLine(world, res);
        mansions.push(line);
        world.events.log.push({ t: world.tick, id: "mansion", line });
      }
    } else if (s.decay) {
      if (rng.chance(s.p)) {
        if (sideOf(world, i) > 1) {
          splitLot(world, i); // a block does not lose a storey; it comes apart into its lots
          decayed++;
          continue;
        }
        world.tier[i]--;
        decayed++;
        const cap = capacityOf(world, i);
        if (world.zone[i] === ZONE.R) evictFromLot(world, i, cap);
        else fireFromLot(world, i, cap);
      }
    }
  }
  return { grew, decayed, merged, landmarks, mansions };
}

/** Data for the hover card. A block's part reports its ANCHOR's building (`part` names the tile asked about). */
export function lotReport(world, at) {
  const i = world.civic[at] ? civicAnchorOf(world, at) : anchorOf(world, at);
  const z = world.zone[i];
  const s = lotScore(world, i);
  const rep = {
    tx: i % world.w,
    ty: (i / world.w) | 0,
    at: { tx: at % world.w, ty: (at / world.w) | 0 },
    part: at !== i,
    side: world.civic[i] ? civicSideOf(world, i) : sideOf(world, i),
    theme: world.theme[i],
    mark: buildingMark(world, i),
    landmark: landmarkOf(world.theme[i]), // the roster row a 3×3 rose as, or null (SPEC §3c)
    shop: shopOf(world, i), // a tier-1 C lot's kind and keeper, or null (SPEC §12.2d)
    mansion: world.mansion[i], // WEALTH (SPEC §9f): 1 on a mansion's anchor
    klass: z === ZONE.R ? attainableClass(world, i) : null, // the ladder as it stands: { cls, next, list, have, unmet }
    estateName: estateName(world, i), // "the Greyback estate" for a mansion with a family, "the empty mansion", or null
    zone: z,
    tier: world.tier[i],
    maxTier: world.maxTier[i],
    civic: world.civic[i],
    lv: world.lv[i],
    pol: world.pol[i],
    dread: world.dread[i],
    roadDist: world.roadDist[i], // this TILE's distance; the rule reads the site's
    // Access as the rule sees it (SPEC 6c): the whole site's distance, every
    // door it has, and - only when it has none - how far the nearest road
    // actually is, which is the one question the reader always asks next.
    served: served(world, i),
    siteDist: siteRoadDist(world, i),
    doors: doorsOf(world, i),
    nearest: served(world, i) ? null : nearestRoad(world, i),
    traffic: world.traffic[i],
    crime: world.crime[i],
    fireCov: world.fireCov[i],
    policeCov: world.policeCov[i],
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
