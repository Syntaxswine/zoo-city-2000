// street.js — THE STREET TRADE (docs/PROPOSAL-MEAT-MARKET-2026-09-26.md Part B). The owner, 2026-09-26: "what if you
// didn't have the meat market and people were just trying to sell it on the street, this would turn the negative
// effects of the meat market into a walking hazard."
//
// Where a carnivore household has no market in reach — none at all, none within MEAT_ROAD walked steps, or the trade
// prohibited — its meat is sold off the kerb. SELLERS are carnivore adults of those households, the unemployed first
// ("no jobs means hungry wolves"), one for every STREET_PER_SELLER unserved carnivores: the meat valve's 0.06 jobs a
// carnivore, at a stall's three jobs. A seller holds no job slot and moves no valve — the trade is informal. Each works
// a PITCH: of the road tiles within STREET_REACH of home, the one with the most unserved carnivores living within 5 —
// and the pitch MOVES every month among the best STREET_BEST. That movement is the walking.
//
// A pitch carries what a stall carried (fields.js, justice.js): a stall's dread over a stall's radius — in its own
// field, world.streetDread, which frightens herbivores (mood, home, leaving) and never lowers land value — a stall's
// crime, and the buyer's pull on the killing (a seller is a buyer). A prey animal whose walk passes within a tile of a
// pitch is exposed to it. A killing near a pitch is sold there the same month: killed and eaten, no stock. The mayor
// gets nothing — no cut, no licence, no raid — and the police may stop a seller at a covered pitch.
//
// DERIVED: computed at the start of every month from the month before's state (tick.js), and at load before the
// fields (save.js). Never saved, never hashed, and it draws no random numbers — so a straight run and a reloaded one
// hold the same street. Only the news of it opening and closing is saved (world.events.streetOpen).

import { KNOBS } from "./rules.js";
import { absent } from "./world.js";
import { DIET_OF } from "./species.js";
import { hallReach } from "./meat.js";
import { policy } from "./governance.js";
import { TILE, RIDE } from "./fields.js";

const ageYears = (world, c) => Math.floor((world.tick - c.born) / 12);

/** The unserved carnivores living within `r` of tile `t` (Chebyshev) — a pitch's customers. */
function customersNear(world, unservedAt, t, r = 5) {
  const { w, h } = world;
  const tx = t % w, ty = (t / w) | 0;
  let n = 0;
  for (let y = Math.max(0, ty - r); y <= Math.min(h - 1, ty + r); y++) for (let x = Math.max(0, tx - r); x <= Math.min(w - 1, tx + r); x++) n += unservedAt[y * w + x];
  return n;
}

/** Rebuild this month's street: who sells, and where. Returns and stores world.street. */
export function computeStreet(world) {
  const { w, h } = world;
  const n = w * h;
  const prohibited = policy(world, "meatTrade") === "prohibited";
  // The demand no market reaches: carnivores at home (every age eats, as meat.eat counts them) with no hall in reach.
  const served = new Map();
  const unservedAt = new Uint16Array(n);
  let unserved = 0;
  for (const c of world.citizens) {
    if (c.dead || c.home < 0 || absent(world, c) || DIET_OF[c.species] !== "carn") continue;
    let s = served.get(c.home);
    if (s === undefined) { s = !prohibited && !!hallReach(world, c.home); served.set(c.home, s); }
    if (s) continue;
    unservedAt[c.home]++;
    unserved++;
  }
  const street = { unserved, prohibited, sellers: [], pitches: [], near: null };
  world.street = street;
  if (!unserved) return street;
  const want = Math.ceil(unserved / KNOBS.STREET_PER_SELLER);
  const cands = world.citizens.filter((c) => !c.dead && c.home >= 0 && !absent(world, c) && DIET_OF[c.species] === "carn"
    && ageYears(world, c) >= KNOBS.ADULT_AGE && served.get(c.home) === false);
  cands.sort((a, b) => (a.job >= 0) - (b.job >= 0) || a.id - b.id); // the unemployed first, then by id
  const taken = new Set();
  const R = KNOBS.STREET_REACH;
  for (const c of cands) {
    if (street.sellers.length >= want) break;
    const hx = c.home % w, hy = (c.home / w) | 0;
    const opts = [];
    for (let y = Math.max(0, hy - R); y <= Math.min(h - 1, hy + R); y++) for (let x = Math.max(0, hx - R); x <= Math.min(w - 1, hx + R); x++) {
      const t = y * w + x;
      if (!world.road[t] || world.rail[t] || taken.has(t)) continue;
      opts.push({ t, n: customersNear(world, unservedAt, t) });
    }
    if (!opts.length) continue; // no road near home: nowhere to stand
    opts.sort((a, b) => b.n - a.n || a.t - b.t);
    const best = opts.slice(0, KNOBS.STREET_BEST);
    const pitch = best[(c.id * 7 + world.tick) % best.length].t; // it moves every month among the best few: the walking
    taken.add(pitch);
    street.sellers.push({ id: c.id, pitch });
    street.pitches.push(pitch);
  }
  // The tiles a passing walk is exposed on: within a tile of a pitch (justice.js reads it).
  const near = new Uint8Array(n);
  for (const p of street.pitches) {
    const px = p % w, py = (p / w) | 0;
    for (let y = Math.max(0, py - 1); y <= Math.min(h - 1, py + 1); y++) for (let x = Math.max(0, px - 1); x <= Math.min(w - 1, px + 1); x++) near[y * w + x] = 1;
  }
  street.near = near;
  return street;
}

/** The seller record for a citizen this month, or null. */
export const sellerOf = (world, id) => world.street?.sellers.find((s) => s.id === id) || null;

/**
 * How many walking tiles of a commute pass within a tile of a pitch this month, capped at STREET_EXPOSURE_MAX — the
 * hazard met on the way (justice.js weights a victim by it). A ride never counts, as for trespass.
 */
export function streetExposure(world, c, near = world.street?.near) {
  if (!near || !c.path) return 0;
  let e = 0;
  for (const step of c.path) {
    if (step & RIDE) continue;
    if (near[step & TILE] && ++e >= KNOBS.STREET_EXPOSURE_MAX) return e;
  }
  return e;
}

/** The news, once when the trade opens and once when it closes — the one piece of the street that is saved. */
export function streetNews(world) {
  const ev = world.events;
  const open = (world.street?.sellers.length || 0) > 0;
  if (open === !!ev.streetOpen) return null;
  ev.streetOpen = open;
  const s = world.street;
  const first = open ? s.sellers[0].pitch : -1;
  const line = open
    ? `THE STREET — ${s.unserved} carnivore${s.unserved === 1 ? "" : "s"} ${s.prohibited ? "under the prohibition" : "with no meat market in reach"}: meat is being sold off the kerb by ${s.sellers.length} seller${s.sellers.length === 1 ? "" : "s"}, the first at (${first % world.w},${(first / world.w) | 0}).`
    : "THE STREET — no one sells meat off the kerb any more.";
  ev.log.push({ t: world.tick, id: "street", line });
  return line;
}
