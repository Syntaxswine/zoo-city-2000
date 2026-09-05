// needs.js — one actionable want from rules the simulation already uses.
// DOM-free, RNG-free. Cards, bubbles and the Census all call this function.

import { homeTerms, moodContext, moodTerms } from "./citizens.js";
import { lotScore, REASON } from "./lots.js";
import { neutralRate } from "./demand.js";
import { DIET_OF } from "./species.js";
import { ZONE, anchorOf, footprintOf, absent } from "./world.js";
import { hash01, seedFromString } from "./rng.js";
import { ACT } from "./voice.js";

export const NEED_MIN = 4;
export const NEED_VALVE_PTS = 8;
export const NEED_LOT_PTS = 6;
export const NEED_REACH = 6;
export const BUBBLES_MAX = 8;

const ACTIONABLE_MOOD = new Set(["NO_JOB", "SMOKE", "FLIGHT", "DREAD", "CRIME", "VAN", "WATCHED"]);
const LOT_NEED = new Map([
  [REASON.NO_ROAD, "NO_ROAD"],
  [REASON.CAPPED, "CAPPED"],
  [REASON.NO_DEMAND, "NO_DEMAND"],
  [REASON.EMPTY, "NO_DEMAND"],
]);

const zoneCode = (zone) => zone === ZONE.R ? "R" : zone === ZONE.C ? "C" : zone === ZONE.I ? "I" : zone === ZONE.M ? "M" : null;

/**
 * Select the largest actionable deficit. `context.mood` is an optional
 * shared moodContext for callers walking the whole town; it changes no rule.
 */
export function needOf(world, c, context = null) {
  if (!world?.last || !c || c.dead || absent(world, c)) return { code: "CONTENT", arg: null, act: ACT.CONTENT };
  if (c.home < 0 && world.campers?.some(cp => cp.householdId === c.household)) return { code: "ROOMS", arg: { camping: true }, act: "provide road-served housing and restore positive housing demand with jobs and affordable taxes" };
  const choices = [];
  const add = (code, points, arg = null) => {
    if (!(points > 0) || !ACT[code]) return;
    choices.push({ code, points, arg, tie: hash01(c.id | 0, seedFromString(code), 0x4e454544) });
  };

  // Personal mood: exact terms, with only hurts that a player tool can answer.
  const terms = moodTerms(world, c, context?.mood || undefined);
  const sums = new Map();
  const moodArgs = new Map();
  for (const term of terms) {
    sums.set(term.code, (sums.get(term.code) || 0) + term.value);
    if (term.arg != null) moodArgs.set(term.code, term.arg);
  }
  for (const code of ACTIONABLE_MOOD) {
    const value = sums.get(code) || 0;
    if (value < 0) add(code, -value, code === "FLIGHT" ? { species: moodArgs.get(code) } : null);
  }
  if (c.home >= 0 && !sums.has("PARK")) add("NO_PARK", 10);
  if (c.job >= 0 && !sums.has("COMMUTE")) add("COMMUTE", 10);

  // Home preferences: potential − actual from homeScore's own terms.
  if (c.home >= 0) {
    const missing = new Map();
    for (const term of homeTerms(world, c.species, c.home, false)) {
      if (!term.potential) continue;
      missing.set(term.code, (missing.get(term.code) || 0) + Math.max(0, term.potential - term.value));
    }
    for (const [code, points] of missing) add(code, points);
  }

  // Town-wide wishes are deliberately weaker than personal hurts.
  const demand = world.last.demand;
  if (demand?.r) {
    if (demand.r.C > 0.05) add("SHOPS", NEED_VALVE_PTS, { value: demand.r.C });
    if (demand.r.R > 0.05) add("ROOMS", NEED_VALVE_PTS, { value: demand.r.R });
    if (demand.r.I > 0.05) add("WORKS", NEED_VALVE_PTS, { value: demand.r.I });
    let jobStock = 0;
    if (c.job >= 0 && world.zone[c.job] === ZONE.M) for (const j of footprintOf(world, anchorOf(world, c.job))) jobStock += world.meat?.[j] || 0;
    const emptyHall = DIET_OF[c.species] === "carn" && c.job >= 0 && world.zone[c.job] === ZONE.M && jobStock === 0;
    if (DIET_OF[c.species] === "carn" && (demand.r.M > 0.05 || emptyHall)) add("HOOKS", NEED_VALVE_PTS, { value: demand.r.M, lot: emptyHall ? c.job : -1 });
  }

  // The resident's lot explains itself through the same score used by growth.
  if (c.home >= 0) {
    const report = lotScore(world, c.home);
    const code = LOT_NEED.get(report.reason);
    if (code) add(code, NEED_LOT_PTS, { reason: report.reason, lot: c.home });
  }

  // A citizen feels the harsher of the home and workplace rates.
  const n = demand?.n ?? neutralRate(world.citizens.length);
  let taxZone = "R";
  let rate = world.rates.R;
  if (c.job >= 0) {
    const z = zoneCode(world.zone[c.job]);
    const zr = z === "M" ? world.rates.C : world.rates[z];
    if (z && zr > rate) { taxZone = z; rate = zr; }
  }
  if (rate > n) add("TAX", NEED_LOT_PTS, { zone: taxZone, rate, neutral: n });

  choices.sort((a, b) => b.points - a.points || b.tie - a.tie || a.code.localeCompare(b.code));
  const best = choices[0];
  if (!best || best.points < NEED_MIN) return { code: "CONTENT", arg: null, act: ACT.CONTENT };
  return { code: best.code, arg: best.arg, act: ACT[best.code] };
}

/** Shared scratch for callers evaluating more than one citizen. */
export function needsContext(world) {
  return { mood: moodContext(world) };
}
