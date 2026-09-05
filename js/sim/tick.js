// tick.js — one month, in the order SPEC §1 states. The only orchestrator.

import { KNOBS } from "./rules.js";
import { computeFields, recountRosters, computeStationDoors } from "./fields.js";
import { census, needCensus, notables } from "./census.js";
import { updateDemand, peekDemand, neutralRate } from "./demand.js";
import { yearlyFigures } from "./budget.js";
import { lotsTick } from "./lots.js";
import { citizensTick, compact, invalidatePaths, replanStale } from "./citizens.js";
import { budgetTick } from "./budget.js";
import { eventsTick } from "./events.js";
import { justiceTick } from "./justice.js";
import { storyTick } from "./story.js";
import { beginMeatMonth, penMaturityTick, meatTick, meatCensus, resetMeatRoutes } from "./meat.js";
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
  world.predations = []; // this month's killings, for the walker layer (justice.kill)
  world.naturalDeaths = []; // this month's bodies, captured before removeCitizen scrubs their homes
  world.meatTrips = []; // this month's exact logistics routes, read-only to the walker layer
  world.lifeEvents = []; // this month's biographies; storyTick is their only path to news
  if (!world.byId) {
    // First tick of a fresh world.
    world.byId = new Map();
    world.hhById = new Map();
  }
  const meatNotices = [];
  const market = beginMeatMonth(world);
  if (market) meatNotices.push(market);
  // Pens mature before the birthday/split pass: on the exact sixteenth
  // birthday the animal goes to market instead of becoming a new household.
  meatNotices.push(...penMaturityTick(world));
  notices.push(...meatNotices);
  // 1. fields
  computeFields(world);
  recountRosters(world);
  // 2. census
  const cen = census(world);
  // 3. valves
  const dem = updateDemand(world, cen);
  // 4. lots
  const lots = lotsTick(world);
  notices.push(...lots.landmarks); // a landmark rose (SPEC §3c); lotsTick logged it under its own id
  // 4b. lotsTick may have BUILT or RAZED across a station's forecourt, which is
  // ground `fields.passable` reads: the platform's doors move and stored
  // commutes are left walking through a building. Settle it HERE, in the month
  // it happened and before the citizens run, so the stale pass re-plans this
  // month - a month later would be worse than useless, because traffic and
  // everything downstream of it would already have been taken from the old
  // paths in one world and the new ones in the other.
  settleDoors(world);
  // 5. citizens
  const cit = citizensTick(world, cen, dem);
  notices.push(...cit.zonedOutLines); // use-zoning: households that left under the player's line (SPEC §7.8)
  // 6. budget
  const bud = budgetTick(world);
  notices.push(...bud.notices);
  // 7. events
  const evNotices = eventsTick(world, cen, dem);
  notices.push(...evNotices);
  // 7c. AND AGAIN, because eventsTick moves the ground too: a fire razes
  // buildings and a sinkhole opens new WATER, both of them things
  // `fields.passable` reads, at step 7, three steps after the settle above. Everything below this line plans over the door
  // graph (meat carts, a killer's walk), and next month's fields, census and
  // demand read the paths it leaves; without this the card and the graph
  // disagreed for a whole month after every fire, which SPEC 6c says they
  // cannot. It belongs HERE, where the tick's own order is visible, rather
  // than inside the events that raze: `events.js` had imported
  // `invalidatePaths` and never called it since long before this part, which
  // is what that import was reaching for and never got right.
  settleDoors(world);
  // AND RE-PLAN NOW, UNCONDITIONALLY, because what follows READS `c.path`.
  // `justiceTick` prices a trespass through `fields.exposure`, and `meatTick`
  // routes carts, and both are inside this tick. A stale commute here changes
  // who is exposed, which changes how many `rng.chance` draws justice takes,
  // and the two cities never meet again: measured at 129 employed animals
  // holding no commute when justice asked, 28 trespass arrests against 34, and
  // `09222178` against `0c2a6629` eight months on. It is unconditional and not
  // folded into the settle above because a FIRE does not have to move a door
  // to strand a commute - `evictFromLot` rehomes the family and
  // `placeHousehold` marks every one of them stale.
  replanStale(world);
  // The count is a readout (`world.last` is rebuilt every tick and never
  // saved) and it is what makes this law checkable: justice and the carts must
  // never read a commute that is not there.
  const staleAtJustice = world.citizens.reduce((n, c) => n + (!c.dead && c.home >= 0 && c.job >= 0 && !c.path ? 1 : 0), 0);
  // 7b. crime and punishment: releases, the killing, burglary, the files.
  // Lots and events can change a hall or a road in this same month.
  resetMeatRoutes(world);
  const jNotices = justiceTick(world, cen);
  notices.push(...jNotices);
  const monthMeat = meatTick(world);
  meatNotices.push(...monthMeat);
  notices.push(...monthMeat);
  Object.assign(cen, meatCensus(world));
  const storyNotices = storyTick(world);
  notices.push(...storyNotices);
  // Events can remove households (revolt, rubble, a killing, a sale); compact
  // before anything counts or saves — a dead citizen must never survive a tick boundary.
  compact(world);
  // The report speaks after this month's removals. A January death must not
  // leave a departed citizen named as the current oldest resident.
  cen.notables = notables(world);
  // 8. history, report, advisor, milestones
  world.last = { staleAtJustice, census: cen, demand: dem, budget: bud.fig, grew: lots.grew, decayed: lots.decayed, arrived: cit.arrived, left: cit.left, births: cit.births, deaths: cit.deaths, funerals: cit.funerals, littersLost: cit.littersLost, rehomed: cit.rehomed, zonedOut: cit.zonedOut };
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
  // Every line the ticker shows goes into the log too, so a loaded city can
  // show its own history (rolled events already logged themselves).
  for (const line of notices) {
    if (evNotices.includes(line) || jNotices.includes(line) || meatNotices.includes(line) || lots.landmarks.includes(line) || storyNotices.includes(line)) continue;
    const report = /^REPORT /.test(line);
    const notable = cen.notables || {};
    const links = report ? [...new Set([notable.oldest?.id, notable.largest?.member].filter(Number.isInteger))] : [];
    const who = links.slice().sort((a, b) => a - b);
    world.events.log.push(who.length ? { t: world.tick, id: "notice", line, who, links } : { t: world.tick, id: "notice", line });
  }
  if (world.events.log.length > 400) world.events.log.splice(0, world.events.log.length - 400);
  // THE BACKSTOP, and it is honest about being one. `c.stale` is written in
  // three places - `citizens.placeHousehold`, `citizens.invalidatePaths` and
  // `blocks.replanOn` - and everything that reaches them inside a tick is
  // repaired above: the citizens' own pass for anything before it, the
  // unconditional re-plan after `eventsTick` for the fire that rehomes a
  // family, and `ops` for a player's edit. So this call is CURRENTLY DEAD:
  // measured over 1,440 tick boundaries of four weathered towns, nothing is
  // ever left flagged here.
  //
  // It stays because the law is about the BOUNDARY, not about any of those
  // three, and a step added after justice would otherwise end a month with
  // commutes null - which costs a whole month of traffic, riders and mean
  // commute in the straight run while a reload rebuilds them (the hash at the
  // boundary is equal either way, so the two cities part a month later:
  // measured at 53 pathless workers and `9324161b` against `9e3e5077`). One
  // pass over a list of clean citizens is what that insurance costs.
  replanStale(world);
  world.tick++;
  world.last.needs = needCensus(world); // cards and walkers now read this same tick
  return { notices, events: evNotices };
}

/**
 * Rebuild `world.last` from the current state without ticking (after a
 * load, or after a rate change while paused) so the panel never shows
 * placeholders. Valves are not advanced; counts are current.
 */
/**
 * A PLATFORM'S DOORS ARE DERIVED FROM GROUND THAT MOVES. `fields.passable`
 * reads `tier` and `civic`, so a building that grows across a forecourt - or a
 * civic dropped on one - closes a way that stored commutes are already
 * walking, and neither goes through the road/wall/rail branch of ops.apply
 * that invalidates paths. `computeStationDoors` keeps a signature of the whole
 * door graph and raises `world.doorsMoved` when it changes; this is the one
 * place a tick acts on it, with the same `invalidatePaths` a road edit uses.
 * (A hostile review found the hole: save -> load -> continue parted company a
 * month after a police station was dropped on a forecourt, and `c.path` is not
 * in the saved citizen, so the hash hid it for two years first.)
 */
function settleDoors(world) {
  computeStationDoors(world);
  if (!world.doorsMoved) return false;
  world.doorsMoved = false;
  invalidatePaths(world);
  // NO RE-PLAN HERE: this function does ONE thing, and who repairs the damage
  // depends on where the caller stands in the tick. After `lotsTick` the
  // citizens' own stale pass is coming; after `eventsTick` it is not, and that
  // caller re-plans for itself, because everything below it reads `c.path`.
  return true;
}

export function refreshLast(world) {
  computeFields(world);
  settleDoors(world);
  recountRosters(world);
  const cen = census(world);
  Object.assign(cen, meatCensus(world));
  const dem = peekDemand(world, cen);
  const fig = yearlyFigures(world);
  const prev = world.last || {};
  world.last = { census: cen, demand: dem, budget: fig, grew: prev.grew || 0, decayed: prev.decayed || 0, arrived: prev.arrived || 0, left: prev.left || 0, births: prev.births || 0, deaths: prev.deaths || 0, funerals: prev.funerals || 0, littersLost: prev.littersLost || 0, rehomed: prev.rehomed || 0, zonedOut: prev.zonedOut || 0 };
  world.last.needs = needCensus(world);
  return world.last;
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
  const nouns = { rabbit: "warren", mouse: "tenement", fox: "market town", beaver: "mill-town", owl: "college town", bear: "hamlet", tortoise: "retirement river", raccoon: "junkyard", pig: "works town", cow: "dairy parish", wolf: "pack territory", cat: "high street", hawk: "eyrie", skunk: "back lot" };
  const problems = { rabbit: "rabbit problem", mouse: "mouse problem", fox: "fox problem", beaver: "beaver habit", owl: "night shift", bear: "bear winter", tortoise: "slow lane", raccoon: "bin situation", pig: "mud problem", cow: "cud habit", wolf: "howling problem", cat: "cat problem", hawk: "hawk overhead", skunk: "smell" };
  const art = (word) => (/^[aeiou]/.test(word) ? "an" : "a");
  if (b[1] < 0.15) return `${art(a[0])} ${a[0]} ${nouns[a[0]]}`;
  return `${art(a[0])} ${a[0]} ${nouns[a[0]]} with ${art(problems[b[0]])} ${problems[b[0]]}`;
}

function advisor(world, cen, dem, fig) {
  const out = [];
  const year = dateOf(world).year;
  let lotsR = 0;
  let lotsC = 0;
  let lotsI = 0;
  let lotsM = 0;
  const n = world.w * world.h;
  for (let i = 0; i < n; i++) {
    if (world.zone[i] === ZONE.R) lotsR++;
    else if (world.zone[i] === ZONE.C) lotsC++;
    else if (world.zone[i] === ZONE.I) lotsI++;
    else if (world.zone[i] === ZONE.M) lotsM++;
  }
  const lots = lotsR + lotsC + lotsI + lotsM;
  const net = fig.incomeYr + (fig.cutYr || 0) - fig.upkeepYr;
  const j = world.events.justice;
  const justice = j && (j.pacified || j.sold) ? ` · pacified ${j.pacified} (${j.wrongful} wrongful) · sold ${j.sold}` : "";
  let report = `REPORT ${year}: ${cen.P} animals · approval ${Math.round(cen.approval)} · unemployed ${cen.U} · net ${net < 0 ? "−" : "+"}§${Math.abs(net).toLocaleString("en-US")}/yr · Zoo City index ${(cen.H * 100).toFixed(0)}%${cen.markets ? ` · ${cen.markets} meat hall${cen.markets === 1 ? "" : "s"}` : ""}${justice} · ${characterLine(cen)}.`;
  const notable = cen.notables || {};
  if (notable.oldest) report += ` Oldest resident: ${notable.oldest.name}, age ${notable.oldest.age}, at ${lotAt(world, notable.oldest.home)}.`;
  if (notable.largest) report += ` Largest household: the ${notable.largest.surname} family, ${notable.largest.size} animals at ${lotAt(world, notable.largest.home)}, including ${notable.largest.name}.`;
  out.push(report);
  if (cen.P === 0 && lots === 0) out.push(`ADVISOR: zone R, C and I within ${KNOBS.ROAD_REACH} tiles of a road. Animals arrive when there are jobs.`);
  if (world.valves.R > 0.3 && cen.vacantR < 10) out.push("ADVISOR: the animals want more housing.");
  if (world.valves.C > 0.3 && lotsC < lotsR / 4) out.push("ADVISOR: the town wants shops.");
  if (world.valves.I > 0.3 && lotsI < lotsR / 4) out.push("ADVISOR: the town wants industry.");
  if (cen.lotsNoRoad > 0) out.push(`ADVISOR: ${cen.lotsNoRoad} zoned lots have no road within ${KNOBS.ROAD_REACH} tiles.`);
  const maxRate = Math.max(world.rates.R, world.rates.C, world.rates.I);
  if (maxRate > dem.n + 3) out.push(`ADVISOR: taxes are well above the neutral ${dem.n.toFixed(1)}%. The animals are talking about leaving.`);
  if (cen.P >= 800 && cen.largeParks === 0) out.push(cen.largeParksNoRoad ? `ADVISOR: the large park has no road within ${KNOBS.ROAD_REACH} tiles of it. Nobody can reach it, so nobody works there and no street is worth more for it.` : "ADVISOR: the citizens want a large park.");
  if (cen.P >= 300 && cen.fireStations === 0) out.push(`ADVISOR: no fire station — a fire burns two months, spreads at ${KNOBS.FIRE_SPREAD}, and always takes the building. A station covers six tiles (§500) and its engine saves ${Math.round(KNOBS.FIRE_SAVED * 10)} fires in ten on its own beat.`);
  // No station at all is not "less policing", it is NO investigation: filesTick
  // does not roll where there is no force, so every file goes cold. The old
  // line was gated on meanCrime > 50 and a police-less town measured 39.9.
  if (cen.policeStations === 0 && world.events.files.some((f) => !f.closed)) out.push("ADVISOR: there is no police station, so nothing is investigated — every file goes cold. One covers six tiles (§500); the town's detectives work every case wherever it happened.");
  else if (cen.meanCrime > 50 && cen.policeStations === 0) out.push(`ADVISOR: crime on the built lots averages ${Math.round(cen.meanCrime)}. A police station covers six tiles (§500).`);
  else if (cen.meanCrime > 50) out.push(`ADVISOR: crime averages ${Math.round(cen.meanCrime)} — the stations do not reach everywhere.`);
  if (cen.meanPol > 40) out.push("ADVISOR: the air is thick. Trees and parks clear it; industry makes it.");
  if (world.cash < 0) out.push("ADVISOR: the treasury is in the red.");
  const prevN = neutralRate(world.history.length > 1 ? world.history[world.history.length - 2].P : 0);
  for (const z of ["R", "C", "I"]) {
    if (world.rates[z] <= prevN && world.rates[z] > dem.n) out.push(`ADVISOR: your city outgrew its ${world.rates[z]}% ${z} rate — neutral is now ${dem.n.toFixed(1)}%.`);
  }
  if (cen.P >= 800 && dem.capped) out.push("ADVISOR: the town is at capacity. Parks, a Zoo, or friendships across species raise it.");
  // Crime and punishment.
  if (cen.U >= 20 && cen.diet.carn >= 50) out.push(`ADVISOR: ${cen.U} animals have no work. No jobs means hungry wolves — zone shops and works.`);
  if (cen.markets > 0 && cen.herbNear > 0) out.push(`ADVISOR: ${cen.herbNear} herbivores live within the smell of a meat hall; parks, friends across the line and a licence soften it.`);
  if (cen.markets > 0 && !cen.policeStations) out.push("ADVISOR: a meat hall with no police cover is where the killings go unsolved.");
  if (world.events.killings > 0 && cen.centres === 0 && cen.policeStations > 0) out.push("ADVISOR: the cells release an animal in three months, unchanged. A pacification centre (§1,500) sends a predator home fixed — and stops its litters.");
  if (cen.centres > 0 && cen.held >= KNOBS.CENTRE_BEDS * cen.centres) out.push("ADVISOR: the centre is full — the next one goes to the cells.");
  return out;
}

const lotAt = (world, i) => Number.isInteger(i) && i >= 0 ? `(${i % world.w},${(i / world.w) | 0})` : "no settled address";
