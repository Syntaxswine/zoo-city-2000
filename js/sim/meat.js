// meat.js — stock, road/rail reach, pens and the hall's till. SPEC §9c.
//
// One unit is one body. All state-changing flows pass through addStock,
// takeStock or spoilStock, so the conservation identity can be audited:
// opening + bought + killed + convicted + PEN_YIELD·slaughtered - eaten - spoiled
// === stock. Routes are measured on fields.dial's real two-layer graph;
// freight walks roads at one step and rides any length of rail for ZERO
// measured steps. Property value never imports this module or reads a route.

import { KNOBS } from "./rules.js";
import { ZONE, anchorOf, footprintOf, capacityOf, absent } from "./world.js";
import { WALK, dial, doorOf, hasAccess, nodePath } from "./fields.js";
import { DIET_OF } from "./species.js";
import { removeCitizen } from "./citizens.js";
import { KIND, remember } from "./life.js";
import { post } from "./budget.js";

const FLOW_KEYS = Object.freeze([
  "bought", "killed", "convicted", "slaughtered", "eaten", "spoiled",
  "penBought", "penReleased", "cartTrips", "cartPhysical", "cartWalk",
]);

const emptyFlow = () => Object.fromEntries(FLOW_KEYS.map((key) => [key, 0]));
const at = (world, i) => `(${i % world.w},${(i / world.w) | 0})`;
const nameOf = (c) => `${c.name} ${c.surname}`;
const ageYears = (world, c) => Math.floor((world.tick - c.born) / 12);

function stockSum(world) {
  let n = 0;
  for (let i = 0; i < world.meat.length; i++) n += world.meat[i];
  return n;
}

/** Lazily create the saved accounting record; an imported old stock is opening inventory. */
export function meatStats(world) {
  if (!world.meatStats) {
    world.meatStats = {
      opening: stockSum(world),
      openingPenned: world.citizens.reduce((n, c) => n + (!c.dead && c.pen ? 1 : 0), 0),
      total: emptyFlow(),
      year: Math.floor(world.tick / 12),
      yearly: emptyFlow(),
      halls: {},
      dry: {},
      demand: {},
    };
  }
  const s = world.meatStats;
  s.total = { ...emptyFlow(), ...(s.total || {}) };
  s.yearly = { ...emptyFlow(), ...(s.yearly || {}) };
  // Defensive migration for saves made during Part H development.  Derive
  // the oldest possible opening count without concealing a disappeared pen.
  if (!Number.isFinite(s.openingPenned)) {
    const penned = world.citizens.reduce((n, c) => n + (!c.dead && c.pen ? 1 : 0), 0);
    s.openingPenned = Math.max(0, penned + s.total.slaughtered + s.total.penReleased - s.total.penBought);
  }
  s.halls ||= {};
  s.dry ||= {};
  s.demand ||= {};
  return s;
}

function hallFlow(world, hall) {
  const s = meatStats(world);
  const key = String(anchorOf(world, hall));
  return (s.halls[key] ||= emptyFlow());
}

function note(world, hall, kind, amount) {
  if (!amount) return;
  const s = meatStats(world);
  s.total[kind] = (s.total[kind] || 0) + amount;
  s.yearly[kind] = (s.yearly[kind] || 0) + amount;
  if (hall >= 0) {
    const h = hallFlow(world, hall);
    h[kind] = (h[kind] || 0) + amount;
  }
}

/** Roll the annual counters before any January transaction; returns last year's market line. */
export function beginMeatMonth(world) {
  const s = meatStats(world);
  const year = Math.floor(world.tick / 12);
  if (s.year === year) return null;
  const y = s.yearly;
  const supplied = y.bought + y.killed + y.convicted + y.slaughtered * KNOBS.PEN_YIELD;
  const line = `THE MARKET — ${supplied} units came in last year; ${y.eaten} sold, ${stockSum(world)} remain on the hooks.`;
  // A town without a hall has no market edition. This also leaves a pre-H
  // save with no markets byte-for-byte compatible across later year turns.
  const active = supplied > 0 || y.eaten > 0 || stockSum(world) > 0
    || world.zone.some((_, i) => isHall(world, i));
  if (active) world.events.log.push({ t: world.tick, id: "market", line });
  s.year = year;
  s.yearly = emptyFlow();
  s.halls = {};
  return active ? line : null;
}

/** A standing hall is one M building anchor. Road access is a route concern, not existence. */
export function isHall(world, i) {
  if (!(i >= 0 && i < world.w * world.h)) return false;
  const a = anchorOf(world, i);
  return a === i && world.zone[a] === ZONE.M && world.tier[a] > 0 && !world.rubble[a] && !world.burning[a];
}

/** Aggregate defensively over a block footprint; normal state keeps the units on its anchor. */
export function hallStock(world, hall) {
  const a = anchorOf(world, hall);
  let stock = 0;
  for (const i of footprintOf(world, a)) stock += world.meat[i] || 0;
  return stock;
}

export const hallCapacity = () => KNOBS.MEAT_CAP;

function penCount(world, hall) {
  const a = anchorOf(world, hall);
  let n = 0;
  for (const c of world.citizens) if (!c.dead && c.pen && anchorOf(world, c.heldAt) === a) n++;
  return n;
}

function releasePen(world, c) {
  const hall = anchorOf(world, c.heldAt);
  note(world, hall, "penReleased", 1);
  c.pen = false;
  c.penSince = 0;
  c.held = 0;
  c.heldAt = -1;
}

/** Invalid/down-tiered halls deterministically shed excess animals alive. */
function reconcilePens(world) {
  const byHall = new Map();
  for (const c of world.citizens) {
    if (c.dead || !c.pen) continue;
    const hall = anchorOf(world, c.heldAt);
    if (!isHall(world, hall)) { releasePen(world, c); continue; }
    let list = byHall.get(hall);
    if (!list) byHall.set(hall, (list = []));
    list.push(c);
  }
  for (const [hall, list] of byHall) {
    list.sort((a, b) => (a.penSince || 0) - (b.penSince || 0) || a.id - b.id);
    for (let i = penCapacity(world, hall); i < list.length; i++) releasePen(world, list[i]);
  }
}

export function penCapacity(world, hall) {
  return KNOBS.PEN_CAP[world.tier[anchorOf(world, hall)]] || 0;
}

/** Derived route caches are never saved or hashed. */
export function resetMeatRoutes(world) {
  world._meatReachTick = world.tick;
  world._meatReach = new Map();
}

function routeLimit(world, max) {
  if (!Number.isFinite(max)) return world.w * world.h * WALK;
  return Math.max(0, Math.floor(max * WALK));
}

function routeResult(world, prev, from, door, hall, cost) {
  const path = nodePath(world, prev, door);
  return Object.freeze({
    hall,
    door,
    from,
    walkSteps: cost / WALK,
    physicalSteps: Math.max(0, path.length - 1),
    path,
  });
}

function hallCandidates(world, opts) {
  const byDoor = new Map();
  for (let hall = 0; hall < world.w * world.h; hall++) {
    if (!isHall(world, hall) || !hasAccess(world, hall)) continue;
    if (opts.space && hallStock(world, hall) >= KNOBS.MEAT_CAP) continue;
    if (opts.penSpace && penCount(world, hall) >= penCapacity(world, hall)) continue;
    const door = doorOf(world, hall);
    if (door == null) continue;
    let list = byDoor.get(door);
    if (!list) byDoor.set(door, (list = []));
    list.push(hall);
  }
  for (const list of byDoor.values()) list.sort((a, b) => a - b);
  return byDoor;
}

/**
 * Nearest hall from a lot on the real road/station/rail graph. Only WALK
 * edges count toward `max`; board, alight and every rail edge cost zero.
 * Ties are settled by hall anchor, never by discovery order.
 */
export function hallReach(world, lot, max = KNOBS.MEAT_ROAD, opts = {}) {
  const from = doorOf(world, lot);
  if (from == null) return null;
  if (world._meatReachTick !== world.tick || !world._meatReach) resetMeatRoutes(world);
  const key = `${lot}|${Number.isFinite(max) ? max : "inf"}|${opts.space ? 1 : 0}|${opts.penSpace ? 1 : 0}`;
  if (world._meatReach.has(key)) return world._meatReach.get(key);
  const candidates = hallCandidates(world, opts);
  let bestHall = -1;
  let bestDoor = -1;
  let bestCost = Infinity;
  const { prev } = dial(world, null, from, routeLimit(world, max), (tile, cost) => {
    if (cost > bestCost) return true;
    const halls = candidates.get(tile);
    if (!halls) return false;
    const hall = halls[0];
    if (cost < bestCost || (cost === bestCost && hall < bestHall)) {
      bestCost = cost;
      bestHall = hall;
      bestDoor = tile;
    }
    return false;
  }, { railCost: KNOBS.MEAT_RAIL_COST, neutral: true });
  const result = bestHall < 0 ? null : routeResult(world, prev, from, bestDoor, bestHall, bestCost);
  world._meatReach.set(key, result);
  return result;
}

/** The H route to a chosen hall, used to carry a body from a neighbour's door. */
export function routeToHall(world, lot, hall, max = KNOBS.MEAT_ROAD) {
  hall = anchorOf(world, hall);
  if (!isHall(world, hall) || !hasAccess(world, hall)) return null;
  const from = doorOf(world, lot);
  const to = doorOf(world, hall);
  if (from == null || to == null) return null;
  const { dist, prev } = dial(world, null, from, routeLimit(world, max), (tile) => tile === to,
    { railCost: KNOBS.MEAT_RAIL_COST, neutral: true });
  if (dist[to] < 0) return null;
  return routeResult(world, prev, from, to, hall, dist[to]);
}

function addStock(world, hall, source, units) {
  hall = anchorOf(world, hall);
  if (!isHall(world, hall) || !(units > 0)) return 0;
  const have = hallStock(world, hall);
  const accepted = Math.max(0, Math.min(units, KNOBS.MEAT_CAP - have));
  const spoiled = units - accepted;
  // A doorstep buyer refuses a body when the hooks are full: rejected
  // natural/killing/convict supply is not a flow at all. A grown pen animal
  // cannot be refused after slaughter, so its full yield is supply and any
  // overflow is explicit spoilage in the conservation equation.
  // The public source counter counts animals. A slaughtered adult is one
  // source animal whose declared yield is PEN_YIELD units; this keeps the
  // conservation equation visibly `+ PEN_YIELD × slaughtered`.
  note(world, hall, source, source === "slaughtered" ? units / KNOBS.PEN_YIELD : accepted);
  if (accepted) {
    world.meat[hall] += accepted;
    meatStats(world).dry[String(hall)] = false; // even if demand empties it later this month, that is a new dry spell
  }
  if (spoiled && source === "slaughtered") note(world, hall, "spoiled", spoiled);
  resetMeatRoutes(world); // a full hall is no longer a supply candidate
  return accepted;
}

function takeStock(world, hall, units) {
  hall = anchorOf(world, hall);
  meatStats(world); // capture opening inventory before the first subtraction
  const n = Math.max(0, Math.min(world.meat[hall] || 0, Math.floor(units)));
  if (!n) return 0;
  world.meat[hall] -= n;
  note(world, hall, "eaten", n);
  resetMeatRoutes(world);
  return n;
}

function spoilStock(world, hall, amount = hallStock(world, hall)) {
  hall = anchorOf(world, hall);
  const n = Math.max(0, Math.floor(amount));
  if (!n) return 0;
  meatStats(world); // capture opening inventory before the first destructive transition
  for (const i of footprintOf(world, hall)) world.meat[i] = 0;
  note(world, hall, "spoiled", n);
  resetMeatRoutes(world);
  return n;
}

function queueTrip(world, kind, route, extra = {}) {
  if (!route) return;
  const trips = world.meatTrips || (world.meatTrips = []);
  const trip = {
    id: world.tick * 256 + trips.length,
    kind,
    hall: route.hall,
    from: route.from,
    walkSteps: route.walkSteps,
    physicalSteps: route.physicalSteps,
    path: Array.from(route.path),
    ...extra,
  };
  trips.push(trip);
  note(world, route.hall, "cartTrips", 1);
  note(world, route.hall, "cartPhysical", route.physicalSteps);
  note(world, route.hall, "cartWalk", route.walkSteps);
}

/** Put a killing or convicted sale into stock exactly once. */
export function receiveMeat(world, hall, source, units = 1) {
  return addStock(world, hall, source, units);
}

/** Release pens and account for every unit when a hall is razed. */
export function closeHall(world, hall) {
  hall = anchorOf(world, hall);
  const spoiled = spoilStock(world, hall);
  let released = 0;
  for (const c of world.citizens) {
    if (c.dead || !c.pen || anchorOf(world, c.heldAt) !== hall) continue;
    releasePen(world, c);
    released++;
  }
  resetMeatRoutes(world);
  return { spoiled, released };
}

/**
 * Before birthdays, a penned animal reaching 16 yields two units instead of
 * being released or splitting its household. An invalid hall frees it alive.
 */
export function penMaturityTick(world) {
  const notices = [];
  // Do this before birthdays and slaughter: a hall that lost a storey cannot
  // temporarily retain more animals than its new 2/4/8-place capacity.
  reconcilePens(world);
  for (const c of world.citizens.slice()) {
    if (c.dead || !c.pen) continue;
    const hall = anchorOf(world, c.heldAt);
    if (!isHall(world, hall)) {
      releasePen(world, c);
      continue;
    }
    if ((c.held || 0) > world.tick) continue;
    const family = world.hhById.get(c.household)?.members.filter((id) => id !== c.id) || [];
    const since = 2000 + Math.floor((c.penSince ?? world.tick) / 12);
    const line = `THE PEN — ${nameOf(c)}, raised at the hall at ${at(world, hall)} since ${since}, went to market this morning.`;
    addStock(world, hall, "slaughtered", KNOBS.PEN_YIELD);
    for (const id of family) {
      const member = world.byId.get(id);
      if (member && !member.dead) remember(world, member, KIND.LOST_CHILD, c.id);
    }
    removeCitizen(world, c, "slaughtered");
    world.events.log.push({ t: world.tick, id: "pen", line, links: [c.id] });
    notices.push(line);
  }
  return notices;
}

/** Consolidate block inventory and account for stock on anything no longer a hall. */
function normalizeStock(world) {
  meatStats(world);
  const stock = new Map();
  let changed = false;
  for (let i = 0; i < world.meat.length; i++) {
    const units = world.meat[i];
    if (!units) continue;
    const hall = anchorOf(world, i);
    if (!isHall(world, hall)) {
      world.meat[i] = 0;
      note(world, hall, "spoiled", units);
      changed = true;
      continue;
    }
    stock.set(hall, (stock.get(hall) || 0) + Number(units));
    world.meat[i] = 0; // sum in Number space first: Uint16 must never wrap while parts merge
    if (i !== hall) changed = true;
  }
  for (const [hall, units] of stock) {
    const kept = Math.min(KNOBS.MEAT_CAP, units);
    world.meat[hall] = kept;
    if (units > kept) { note(world, hall, "spoiled", units - kept); changed = true; }
  }
  // Fire, rubble, decay, a lost storey and hand-edited saves can invalidate
  // a pen or shrink its capacity without going through ops.closeHall.
  const heldBefore = world.citizens.reduce((n, c) => n + (!c.dead && c.pen ? 1 : 0), 0);
  reconcilePens(world);
  if (world.citizens.reduce((n, c) => n + (!c.dead && c.pen ? 1 : 0), 0) !== heldBefore) changed = true;
  if (changed) resetMeatRoutes(world);
}

function buyNaturalDeaths(world) {
  const notices = [];
  if (KNOBS.MEAT_BUY_P <= 0) return notices;
  for (const body of world.naturalDeaths || []) {
    const route = hallReach(world, body.home, KNOBS.MEAT_ROAD, { space: true });
    if (!route || (KNOBS.MEAT_BUY_P < 1 && !world.rng.chance(KNOBS.MEAT_BUY_P))) continue;
    if (!addStock(world, route.hall, "bought", 1)) continue;
    post(world, "cut", KNOBS.MEAT_PRICE);
    const line = `BOUGHT — the cart from the hall at ${at(world, route.hall)} called at ${at(world, body.home)} for ${body.name}.`;
    world.events.log.push({ t: world.tick, id: "bought", line, links: [body.id] });
    notices.push(line);
    queueTrip(world, "body", route, { subject: body });
  }
  return notices;
}

function buyPens(world) {
  const notices = [];
  if (KNOBS.PEN_BUY_P <= 0) return notices;
  for (const hh of world.households) {
    if (hh.gone || hh.home < 0 || !["pig", "cow"].includes(hh.species)) continue;
    if (world.occupants[hh.home] < capacityOf(world, hh.home)) continue;
    const cubs = hh.members.map((id) => world.byId.get(id)).filter((c) => c && !c.dead && !c.pen && !absent(world, c) && ageYears(world, c) < KNOBS.ADULT_AGE)
      .sort((a, b) => ageYears(world, b) - ageYears(world, a) || a.id - b.id);
    if (!cubs.length) continue;
    const route = hallReach(world, hh.home, KNOBS.MEAT_ROAD, { penSpace: true });
    if (!route || (KNOBS.PEN_BUY_P < 1 && !world.rng.chance(KNOBS.PEN_BUY_P))) continue;
    const c = cubs[0];
    c.pen = true;
    c.penSince = world.tick;
    c.heldAt = route.hall;
    c.held = c.born + KNOBS.ADULT_AGE * 12;
    note(world, route.hall, "penBought", 1);
    post(world, "cut", KNOBS.PEN_PRICE);
    const line = `THE PEN — ${nameOf(c)}, ${ageYears(world, c)}, was bought from the ${hh.surname} family for the hall at ${at(world, route.hall)}.`;
    world.events.log.push({ t: world.tick, id: "pen", line, links: [c.id] });
    notices.push(line);
    queueTrip(world, "pen", route, { citizen: c.id, subject: { id: c.id, name: nameOf(c), species: c.species } });
    resetMeatRoutes(world);
  }
  return notices;
}

function eat(world) {
  const customers = new Map();
  for (const c of world.citizens) {
    if (c.dead || c.home < 0 || absent(world, c) || DIET_OF[c.species] !== "carn") continue;
    const route = hallReach(world, c.home);
    if (route) customers.set(route.hall, (customers.get(route.hall) || 0) + 1);
  }
  const s = meatStats(world);
  for (let hall = 0; hall < world.meat.length; hall++) {
    if (!isHall(world, hall)) continue;
    const key = String(hall);
    const demand = (s.demand[key] || 0) + (customers.get(hall) || 0) * KNOBS.MEAT_EAT;
    const wanted = Math.floor(demand + 1e-9);
    s.demand[key] = demand - wanted;
    const sold = takeStock(world, hall, wanted);
    if (sold) {
      const gross = sold * KNOBS.MEAT_SALE;
      post(world, world.events.licence ? "tax" : "cut", world.events.licence ? gross * world.rates.C / 100 : gross);
    }
  }
}

function dryNotices(world) {
  const out = [];
  const s = meatStats(world);
  for (let hall = 0; hall < world.meat.length; hall++) {
    const key = String(hall);
    if (!isHall(world, hall)) { delete s.dry[key]; delete s.demand[key]; continue; }
    if (hallStock(world, hall) > 0) { s.dry[key] = false; continue; }
    if (s.dry[key]) continue;
    s.dry[key] = true;
    const line = `EMPTY HOOKS — the hall at ${at(world, hall)} has nothing on the hooks.`;
    world.events.log.push({ t: world.tick, id: "empty-hooks", line });
    out.push(line);
  }
  return out;
}

/** One month after justice: normalize, buy bodies/cubs, sell meals, report. */
export function meatTick(world) {
  normalizeStock(world);
  const notices = [...buyNaturalDeaths(world), ...buyPens(world)];
  eat(world);
  notices.push(...dryNotices(world));
  return notices;
}

export function hallYear(world, hall) {
  return { ...emptyFlow(), ...(world.meatStats?.halls?.[String(anchorOf(world, hall))] || {}) };
}

export function meatCensus(world) {
  const s = world.meatStats || { yearly: emptyFlow() };
  let penned = 0;
  for (const c of world.citizens) if (!c.dead && c.pen) penned++;
  return {
    meatOnHand: stockSum(world),
    meatSold: s.yearly.eaten,
    meatBought: s.yearly.bought,
    meatKilled: s.yearly.killed,
    meatConvicted: s.yearly.convicted,
    meatSlaughtered: s.yearly.slaughtered * KNOBS.PEN_YIELD,
    penned,
  };
}

export function meatBalance(world) {
  const s = meatStats(world);
  const inflow = s.total.bought + s.total.killed + s.total.convicted + s.total.slaughtered * KNOBS.PEN_YIELD;
  const stock = stockSum(world);
  const expected = s.opening + inflow - s.total.eaten - s.total.spoiled;
  const penned = world.citizens.reduce((n, c) => n + (!c.dead && c.pen ? 1 : 0), 0);
  const penExpected = s.openingPenned + s.total.penBought - s.total.slaughtered - s.total.penReleased;
  return {
    opening: s.opening, inflow, eaten: s.total.eaten, spoiled: s.total.spoiled, stock, expected,
    openingPenned: s.openingPenned, penBought: s.total.penBought, slaughtered: s.total.slaughtered,
    penReleased: s.total.penReleased, penned, penExpected,
    ok: expected === stock, penOk: penExpected === penned,
  };
}
