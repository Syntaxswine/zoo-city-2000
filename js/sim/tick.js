// tick.js — one month, in the order SPEC §1 states. The only orchestrator.

import { KNOBS } from "./rules.js";
import { computeFields, recountRosters } from "./fields.js";
import { census } from "./census.js";
import { updateDemand, neutralRate } from "./demand.js";
import { lotsTick } from "./lots.js";
import { citizensTick, compact } from "./citizens.js";
import { budgetTick } from "./budget.js";
import { eventsTick } from "./events.js";
import { SPECIES } from "./species.js";
import { ZONE } from "./world.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function dateOf(world, tick = world.tick) {
  return { year: 2000 + Math.floor(tick / 12), month: tick % 12, label: `${MONTHS[tick % 12]} ${2000 + Math.floor(tick / 12)}` };
}

/** Advance one month. Returns { notices, events } for the ticker. */
export function tick(world) {
  const notices = [];
  world.departures = [];
  world.arrivals = [];
  if (!world.byId) {
    // First tick of a fresh world.
    world.byId = new Map();
    world.hhById = new Map();
  }
  // 1. fields
  computeFields(world);
  recountRosters(world);
  // 2. census
  const cen = census(world);
  // 3. valves
  const dem = updateDemand(world, cen);
  // 4. lots
  const lots = lotsTick(world);
  // 5. citizens
  const cit = citizensTick(world, cen, dem);
  // 6. budget
  const bud = budgetTick(world);
  notices.push(...bud.notices);
  // 7. events
  const evNotices = eventsTick(world, cen, dem);
  notices.push(...evNotices);
  // Events can remove households (revolt, rubble); compact before anything
  // counts or saves — a dead citizen must never survive a tick boundary.
  compact(world);
  // 8. history, report, advisor, milestones
  world.last = { census: cen, demand: dem, budget: bud.fig, grew: lots.grew, decayed: lots.decayed, arrived: cit.arrived, left: cit.left, births: cit.births, deaths: cit.deaths, funerals: cit.funerals };
  world.notices = notices;
  const month = world.tick % 12;
  if (month === 0) {
    world.history.push({
      tick: world.tick, P: cen.P, W: cen.W, J: cen.J, U: cen.U, cash: world.cash,
      income: bud.fig.incomeYr, upkeep: bud.fig.upkeepYr, approval: Math.round(cen.approval), H: cen.H,
      native: cen.native, meanPol: cen.meanPol, meanLV: cen.meanLV, shares: { ...cen.shares },
      valves: { ...world.valves },
    });
    notices.push(...advisor(world, cen, dem, bud.fig));
  }
  const ms = milestone(world, cen);
  if (ms) notices.push(ms);
  world.tick++;
  return { notices, events: evNotices };
}

function milestone(world, cen) {
  const next = KNOBS.MILESTONES[world.flags.milestone];
  if (!next || cen.P < next[0]) return null;
  world.flags.milestone++;
  return `MILESTONE — ${cen.P} animals: Zoo City is a ${next[1].toUpperCase()}.`;
}

/** The city-character line from the top-2 species. */
export function characterLine(cen) {
  const sorted = SPECIES.map((s) => [s.id, cen.shares[s.id]]).sort((a, b) => b[1] - a[1]);
  if (!cen.P) return "an empty map with a road into it";
  const [a, b] = sorted;
  const nouns = { rabbit: "warren", mouse: "tenement", fox: "market town", beaver: "mill-town", owl: "college town", bear: "hamlet", tortoise: "retirement river", raccoon: "junkyard", pig: "works town", cow: "dairy parish", wolf: "pack territory", cat: "high street", hawk: "eyrie" };
  const problems = { rabbit: "rabbit problem", mouse: "mouse problem", fox: "fox problem", beaver: "beaver habit", owl: "night shift", bear: "bear winter", tortoise: "slow lane", raccoon: "bin situation", pig: "mud problem", cow: "cud habit", wolf: "howling problem", cat: "cat problem", hawk: "hawk overhead" };
  if (b[1] < 0.15) return `a ${a[0]} ${nouns[a[0]]}`;
  return `a ${a[0]} ${nouns[a[0]]} with a ${problems[b[0]]}`;
}

function advisor(world, cen, dem, fig) {
  const out = [];
  const year = dateOf(world).year;
  let lotsR = 0;
  let lotsC = 0;
  let lotsI = 0;
  const n = world.w * world.h;
  for (let i = 0; i < n; i++) {
    if (world.zone[i] === ZONE.R) lotsR++;
    else if (world.zone[i] === ZONE.C) lotsC++;
    else if (world.zone[i] === ZONE.I) lotsI++;
  }
  const lots = lotsR + lotsC + lotsI;
  out.push(`REPORT ${year}: ${cen.P} animals · approval ${Math.round(cen.approval)} · unemployed ${cen.U} · net §${fig.incomeYr - fig.upkeepYr}/yr · Zoo City index ${(cen.H * 100).toFixed(0)}% · ${characterLine(cen)}.`);
  if (cen.P === 0 && lots === 0) out.push("ADVISOR: zone R, C and I within 3 tiles of a road. Animals arrive when there are jobs.");
  if (world.valves.R > 0.3 && cen.vacantR < 10) out.push("ADVISOR: the animals want more housing.");
  if (world.valves.C > 0.3 && lotsC < lotsR / 4) out.push("ADVISOR: the town wants shops.");
  if (world.valves.I > 0.3 && lotsI < lotsR / 4) out.push("ADVISOR: the town wants industry.");
  if (cen.lotsNoRoad > 0) out.push(`ADVISOR: ${cen.lotsNoRoad} zoned lots have no road within 3 tiles.`);
  const maxRate = Math.max(world.rates.R, world.rates.C, world.rates.I);
  if (maxRate > dem.n + 3) out.push(`ADVISOR: taxes are well above the neutral ${dem.n.toFixed(1)}%. The animals are talking about leaving.`);
  if (cen.P >= 800 && cen.zoos === 0) out.push("ADVISOR: the citizens want a Zoo.");
  if (cen.meanPol > 40) out.push("ADVISOR: the air is thick. Trees and parks clear it; industry makes it.");
  if (world.cash < 0) out.push("ADVISOR: the treasury is in the red.");
  const prevN = neutralRate(world.history.length > 1 ? world.history[world.history.length - 2].P : 0);
  for (const z of ["R", "C", "I"]) {
    if (world.rates[z] <= prevN && world.rates[z] > dem.n) out.push(`ADVISOR: your city outgrew its ${world.rates[z]}% ${z} rate — neutral is now ${dem.n.toFixed(1)}%.`);
  }
  if (cen.P >= 800 && dem.capped) out.push("ADVISOR: the town is at capacity. Parks, a Zoo, or friendships across species raise it.");
  return out;
}
