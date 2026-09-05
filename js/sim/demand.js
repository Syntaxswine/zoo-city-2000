// demand.js — the five equations. SPEC §4. Pure given a census.
//
// Micropolis SetValves() lineage, re-derived for a ~2,000-citizen zoo and
// RUN in a lumped 60-year script before it was written down (the numbers in
// SPEC §4 are its output). Deviations, on purpose: leaky valve instead of a
// saturating integrator; quadratic penalty above the neutral rate; industry
// driven by the external market, not population.

import { KNOBS } from "./rules.js";

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Neutral tax rate for a city of P citizens — continuous, no cliff. */
export function neutralRate(P) {
  return clamp(KNOBS.NEUTRAL_MAX - P * KNOBS.NEUTRAL_PER_P, KNOBS.NEUTRAL_MIN, KNOBS.NEUTRAL_MAX);
}

/** The tax term added to the valve velocity. */
export function taxTerm(rate, n) {
  if (rate <= n) return KNOBS.TAX_BELOW_GAIN * (n - rate);
  const d = rate - n;
  return -(KNOBS.TAX_ABOVE_LIN * d + KNOBS.TAX_ABOVE_SQ * d * d);
}

/** External market multiplier: the 12.5-year cycle × edge roads × events. */
export function externalMarket(world, c) {
  const cycle = 1 + KNOBS.EXT_CYCLE_AMP * Math.sin((2 * Math.PI * world.tick) / KNOBS.EXT_CYCLE_TICKS);
  const roads = KNOBS.EDGE_ROAD_BASE + KNOBS.EDGE_ROAD_STEP * Math.min(KNOBS.EDGE_ROAD_MAX, c.edgeRoads);
  let ev = 1;
  for (const e of world.events.active) if (e.extMult) ev *= e.extMult;
  return cycle * roads * ev;
}

/**
 * THE CAMERA NETWORK'S ONLY BRAKE is the CAM_CAP term, and it is here rather
 * than in mood, in the home score or in a rehome because those three are all
 * COMPARATIVE and a camera network is GLOBAL. Measured, all three are no-ops
 * under a blanket: a flat mood penalty leaves population, land value, crime
 * and cash byte-identical (the only consumer of c.mood is a departure roll
 * gated on V_R <= 0, which is true on 0 of 1,440 ticks in a balanced town);
 * bestHome is a pure argmax, so a uniform penalty cancels; and a rehome that
 * wants somewhere less watched finds nowhere when everywhere is watched.
 * Dread's seams work because a meat hall is local and few. A global nuisance
 * needs an ABSOLUTE brake.
 *
 * The shape is the right one thematically too: parks and zoos raise the cap
 * because animals want to live near them, and a camera network lowers it for
 * the same reason, backwards.
 */
export function capacityLaw(world, c) {
  // KNOWLEDGE (SPEC §9e) is the same shape as the parks and for the same
  // reason: the cap is the one ABSOLUTE lever, so a Library or a University
  // is measurable where a mood term would not be. K is the census's mean of
  // knowledge/100 over housed, present animals — a MEAN, so a town that grows
  // past its catchment lowers its own ceiling (pre-registered for measuring
  // in the review; the number is CAP_KNOWLEDGE).
  return (KNOBS.CAP_BASE + KNOBS.CAP_PARK * c.parks + KNOBS.CAP_LARGE_PARK * c.largeParks + world.festivalBonus + KNOBS.CAP_KNOWLEDGE * (c.K || 0) - KNOBS.CAM_CAP * (c.watchedShare || 0)) * (1 + KNOBS.CAP_H_GAIN * c.H);
}

/** The breakdown for the current state WITHOUT advancing the valves (a loaded city, a rate change while paused). */
export function peekDemand(world, c) {
  const { P, W, J, Jc, Jm, Lab, carnivores } = c;
  const n = neutralRate(P);
  const ext = externalMarket(world, c);
  const r = {
    R: clamp((J + KNOBS.JOB_SEED - W) / Math.max(W, KNOBS.JOB_SEED), -1, 1),
    C: clamp((KNOBS.C_PER_CITIZEN * P + KNOBS.C_SEED - Jc) / Math.max(Jc, 40) + 0.5 * Math.min(0, (J ? W / J : 1) - 1), -1, 1),
    I: clamp((ext * KNOBS.I_EXT_GAIN * Lab - 1) * 2, -1, 1),
    // The meat halls want carnivores to staff and feed them — not shops' customers (Jm ∉ Jc: no crowd-out).
    M: clamp((KNOBS.MEAT_PER_CARN * carnivores + KNOBS.MEAT_SEED - Jm) / Math.max(Jm, 20), -1, 1),
  };
  const T = { R: taxTerm(world.rates.R, n), C: taxTerm(world.rates.C, n), I: taxTerm(world.rates.I, n), M: taxTerm(world.rates.C, n) };
  const cap = capacityLaw(world, c);
  return { n, ext, r, T, cap, capped: world.valves.R >= 1 - P / cap - 1e-9, boost: { R: 0, C: 0, I: 0, M: 0 } };
}

/** Compute the demand breakdown and advance the valves in place. */
export function updateDemand(world, c) {
  const { P, W, J, Jc, Jm, Lab, carnivores } = c;
  const n = neutralRate(P);
  const ext = externalMarket(world, c);
  const r = {
    R: clamp((J + KNOBS.JOB_SEED - W) / Math.max(W, KNOBS.JOB_SEED), -1, 1),
    C: clamp((KNOBS.C_PER_CITIZEN * P + KNOBS.C_SEED - Jc) / Math.max(Jc, 40) + 0.5 * Math.min(0, (J ? W / J : 1) - 1), -1, 1),
    I: clamp((ext * KNOBS.I_EXT_GAIN * Lab - 1) * 2, -1, 1),
    // The meat halls want carnivores to staff and feed them — not shops' customers (Jm ∉ Jc: no crowd-out).
    M: clamp((KNOBS.MEAT_PER_CARN * carnivores + KNOBS.MEAT_SEED - Jm) / Math.max(Jm, 20), -1, 1),
  };
  const T = { R: taxTerm(world.rates.R, n), C: taxTerm(world.rates.C, n), I: taxTerm(world.rates.I, n), M: taxTerm(world.rates.C, n) };
  let boost = { R: 0, C: 0, I: 0, M: 0 };
  for (const e of world.events.active) {
    if (e.valveBoost) for (const z of Object.keys(e.valveBoost)) boost[z] += e.valveBoost[z];
  }
  const v = world.valves;
  for (const z of ["R", "C", "I", "M"]) {
    const target = clamp(r[z] + T[z] + (boost[z] || 0), -1, 1);
    v[z] += KNOBS.VALVE_LAG * (target - v[z]);
    v[z] = clamp(v[z], -1, 1);
  }
  const cap = capacityLaw(world, c);
  const capLimit = 1 - P / cap;
  const capped = v.R > capLimit;
  if (capped) v.R = capLimit;
  return { n, ext, r, T, cap, capped, boost };
}
