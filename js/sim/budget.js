// budget.js — the ONLY place cash changes. SPEC §0.3, §8.
//
// `post(world, kind, amount)` rounds to whole §, adds to cash and to the
// per-kind ledger. `check.mjs` asserts cash === START_CASH + Σ ledger and
// greps js/ for any other `cash +=` / `cash -=` / `cash =`.

import { KNOBS } from "./rules.js";
import { ZONE, CIVIC, ROAD, isStation } from "./world.js";

export function post(world, kind, amount) {
  const a = Math.round(amount);
  if (!Number.isFinite(a)) throw new Error(`budget.post(${kind}): not a number`);
  world.cash += a;
  world.ledger[kind] = (world.ledger[kind] || 0) + a;
  return a;
}

/** Yearly income and upkeep from the current state (integers). */
export function yearlyFigures(world) {
  const { citizens, rates } = world;
  let baseR = 0;
  for (const c of citizens) {
    if (c.home >= 0) baseR += 0.5 + world.lv[c.home] / 100;
  }
  let fc = 0;
  let fi = 0;
  for (const c of citizens) {
    if (c.job < 0) continue;
    if (world.zone[c.job] === ZONE.I) fi++;
    else fc++;
  }
  // Bear winter: bears out of the workforce still counted as filled jobs? No —
  // a bear on leave holds no job for those months (citizens.js clears it).
  const incomeYr = rates.R * baseR * KNOBS.TAX_R_PER_CITIZEN + rates.C * fc * KNOBS.TAX_C_PER_JOB + rates.I * fi * KNOBS.TAX_I_PER_JOB;

  let roads = 0;
  let bridges = 0;
  let tiers = 0;
  let parks = 0;
  let zoos = 0;
  let fireStations = 0;
  let policeStations = 0;
  const n = world.w * world.h;
  for (let i = 0; i < n; i++) {
    if (world.road[i] === ROAD.ROAD) roads++;
    else if (world.road[i] === ROAD.BRIDGE) bridges++;
    tiers += world.tier[i];
    if (world.civic[i] === CIVIC.PARK) parks++;
    else if (world.civic[i] === CIVIC.ZOO) zoos++;
    else if (world.civic[i] === CIVIC.FIRE) fireStations++;
    else if (world.civic[i] === CIVIC.POLICE) policeStations++;
  }
  let upkeepYr = KNOBS.UPKEEP_CITIZEN * citizens.length + KNOBS.UPKEEP_ROAD * roads + KNOBS.UPKEEP_BRIDGE * bridges + KNOBS.UPKEEP_TIER * tiers + KNOBS.UPKEEP_PARK * parks + KNOBS.UPKEEP_ZOO * zoos + KNOBS.UPKEEP_STATION * (fireStations + policeStations);
  const winter = world.events.active.find((e) => e.id === "bearWinter");
  if (winter) upkeepYr *= 0.8;
  return { incomeYr: Math.round(incomeYr), upkeepYr: Math.round(upkeepYr), fc, fi, roads, bridges, parks, zoos, fireStations, policeStations };
}

/** The monthly slice: post tax and upkeep, apply receivership rules. */
export function budgetTick(world) {
  const fig = yearlyFigures(world);
  post(world, "tax", fig.incomeYr / 12);
  post(world, "upkeep", -fig.upkeepYr / 12);
  const notices = [];
  if (!world.flags.receivership && world.cash < KNOBS.RECEIVERSHIP) {
    world.flags.receivership = true;
    world.flags.ownRates = { ...world.rates };
    notices.push("RECEIVERSHIP: the county has taken the books. Rates are forced up and building is frozen until the treasury is back above zero.");
  }
  if (world.flags.receivership) {
    const n = world.last ? world.last.demand.n : 8;
    const forced = Math.min(20, Math.ceil(n + 2));
    world.rates.R = Math.max(world.rates.R, forced);
    world.rates.C = Math.max(world.rates.C, forced);
    world.rates.I = Math.max(world.rates.I, forced);
    if (world.cash >= 0) {
      world.flags.receivership = false;
      // Hand the books back with the mayor's own rates, so the exit is an
      // exit and not a permanent over-tax (measured: a scripted mayor left at
      // n+2 lost 28% of the town over the next eight years).
      if (world.flags.ownRates) { world.rates = { ...world.flags.ownRates }; delete world.flags.ownRates; }
      notices.push("The county hands the books back at your old rates. You may build again.");
    }
  }
  return { fig, notices };
}

/** Can the treasury pay for this? Receivership freezes building. */
export function canSpend(world, cost) {
  if (world.flags.receivership) return { ok: false, reason: "receivership" };
  if (cost > 0 && world.cash < cost) return { ok: false, reason: "insufficient funds" };
  return { ok: true };
}
