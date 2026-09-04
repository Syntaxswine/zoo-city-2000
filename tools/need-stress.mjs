// need-stress.mjs — coherent edge-state municipalities for peopleprobe.
//
// The scripted mayor normally fixes these six states before a resident has
// occasion to say them.  Each fixture is therefore a whole, internally
// consistent town: occupied homes have storeys, civics have their own tiles,
// employment never exceeds a workplace, commutes follow its road grid, and
// every derived field/demand value is rebuilt by refreshLast.

import { createWorld, capacityOf, jobsOf, CIVIC, ROAD, TERRAIN, ZONE } from "../js/sim/world.js";
import { createHousehold, placeHousehold } from "../js/sim/citizens.js";
import { commuteTime, doorsOf, commutePath, passable, TILE, RIDE } from "../js/sim/fields.js";
import { SPECIES_BY_ID } from "../js/sim/species.js";
import { refreshLast } from "../js/sim/tick.js";
import { needOf } from "../js/sim/needs.js";

export const COHERENT_STRESS_CODES = Object.freeze(["CONTENT", "NO_ROAD", "CAPPED", "NO_DEMAND", "TAX", "VAN"]);

const P = 1300;
const WORKERS = P - 1;
const HOME_LOTS = 55; // 55 × tier-3 capacity 24 = 1,320 beds.

const at = (world, x, y) => y * world.w + x;

function clearMap(world) {
  for (const field of ["terrain", "road", "zone", "maxTier", "tier", "civic", "wall", "rail", "big", "rubble", "burning", "flooded", "use", "meat"]) {
    world[field].fill(0);
  }
  world.roadsDirty = true;
  world.wallsDirty = true;
}

function lot(world, tile, zone, tier) {
  world.zone[tile] = zone;
  world.maxTier[tile] = 3;
  world.tier[tile] = tier;
}

function repeated(zone, tier, count) {
  return Array.from({ length: count }, () => ({ zone, tier }));
}

function jobPlan(code) {
  if (code === "VAN") {
    // C 306 (including the centre's four), I 942, M 11: J=1,259.
    return [
      ...repeated(ZONE.C, 3, 14), ...repeated(ZONE.C, 2, 2), ...repeated(ZONE.C, 1, 2),
      ...repeated(ZONE.I, 3, 38), ...repeated(ZONE.I, 2, 3),
      ...repeated(ZONE.M, 2, 1), ...repeated(ZONE.M, 1, 1),
    ];
  }
  // C 306, I 952: J=1,258.  One C3 is the real pollution source in
  // CAPPED/NO_DEMAND, so those plans put only fourteen C3 lots on the grid.
  const c3 = code === "CAPPED" || code === "NO_DEMAND" ? 14 : 15;
  return [
    ...repeated(ZONE.C, 3, c3), ...repeated(ZONE.C, 1, 2),
    ...repeated(ZONE.I, 3, 39), ...repeated(ZONE.I, 1, 4),
  ];
}

function buildGrid(world, code) {
  // A connected internal road lattice.  It deliberately does not touch the
  // map edge: the active recession, not a fabricated demand field, makes the
  // external industrial market quiet enough for the edge needs to speak.
  for (let y = 30; y <= 60; y++) for (let x = 30; x <= 60; x++) {
    if ((x - 30) % 3 === 0 || (y - 30) % 3 === 0) world.road[at(world, x, y)] = ROAD.ROAD;
  }

  // Keep the inspected household outside the industrial grid.  That makes
  // its local state the product of this small, readable street—not the sum
  // of dozens of unrelated works emissions.
  const targetHome = at(world, 4, 4);
  const park = at(world, 8, 4);
  const centre = code === "VAN" ? at(world, 6, 4) : -1;
  world.civic[park] = CIVIC.PARK;
  if (centre >= 0) world.civic[centre] = CIVIC.CENTRE;

  // Three ordinary road tiles emit three points at the low-value home.  The
  // nearby tier-3 shop supplies the other three, leaving a computed LV of 43
  // and a non-growing tier-1 lot.  Other cases need only one access tile;
  // NO_ROAD deliberately omits the spur.
  if (code !== "NO_ROAD") world.road[at(world, 4, 3)] = ROAD.ROAD;
  if (code === "CAPPED" || code === "NO_DEMAND") {
    world.road[at(world, 3, 4)] = ROAD.ROAD;
    world.road[at(world, 5, 4)] = ROAD.ROAD;
    lot(world, at(world, 6, 4), ZONE.C, 3);
  }
  if (code === "VAN") {
    // Four actual neighbouring trees keep the fox's computed LV above its
    // preference threshold despite the centre's van penalty.
    for (const [x, y] of [[3, 3], [3, 4], [3, 5], [4, 5]]) world.terrain[at(world, x, y)] = TERRAIN.TREE;
  }
  const lowTier = code === "NO_ROAD" || code === "CAPPED" || code === "NO_DEMAND";
  lot(world, targetHome, ZONE.R, lowTier ? 1 : 2);

  const reserved = new Set([targetHome, park]);
  if (centre >= 0) reserved.add(centre);
  const candidates = [];
  for (let y = 31; y < 60; y++) for (let x = 31; x < 60; x++) {
    const tile = at(world, x, y);
    if (world.road[tile] || reserved.has(tile)) continue;
    candidates.push(tile);
  }

  const homes = [];
  const jobs = [];
  const plan = jobPlan(code);
  let cursor = 0;
  for (let k = 0; homes.length < HOME_LOTS || jobs.length < plan.length; k++) {
    if (homes.length < HOME_LOTS) {
      const tile = candidates[cursor++];
      lot(world, tile, ZONE.R, 3);
      homes.push(tile);
    }
    if (jobs.length < plan.length) {
      const tile = candidates[cursor++];
      const spec = plan[jobs.length];
      lot(world, tile, spec.zone, spec.tier);
      jobs.push(tile);
    }
  }
  if (code === "CAPPED" || code === "NO_DEMAND") jobs.push(at(world, 6, 4));
  if (centre >= 0) jobs.push(centre);
  return { targetHome, park, centre, homes, jobs };
}

function populate(world, code, built) {
  const targetSpecies = code === "VAN" ? "fox" : "tortoise";
  const targetHousehold = createHousehold(world, targetSpecies, 1);
  const target = world.byId.get(targetHousehold.members[0]);
  target.born = world.tick - SPECIES_BY_ID[targetSpecies].retire * 12;
  target.deathAge = 99999;
  placeHousehold(world, targetHousehold, built.targetHome);

  const byHome = new Map(built.homes.map((home) => [home, []]));
  for (let n = 0; n < WORKERS; n++) {
    const home = built.homes[(n / 24) | 0];
    const household = createHousehold(world, "rabbit", 1);
    const citizen = world.byId.get(household.members[0]);
    citizen.deathAge = 99999;
    placeHousehold(world, household, home);
    byHome.get(home).push(citizen);
  }

  // Staff every reachable offered job without ever exceeding capacity.  A
  // few vacancies are normal city state; every assigned commute is a real
  // path through the connected lattice and is within the rabbit's limit.
  const pathCache = new Map();
  let staffed = 0;
  for (const job of built.jobs) {
    const options = [];
    for (const home of built.homes) {
      const key = `${home}:${job}`;
      let path = pathCache.get(key);
      if (path === undefined) {
        // THE REAL RULE, not a road walk between two lowest-numbered doors:
        // every door of each end, the cheapest pairing, weighted by species
        // (SPEC 6c). The old version built its own commutes with `roadPath`
        // and then "checked" that they started at `doorOf` and were all road -
        // both true by construction, and both the rule as it was BEFORE this
        // part. A sixth hostile review found the fixture verifying its own
        // constructor, with 1258 of 1258 workers passing on every rig.
        const from = doorsOf(world, home);
        const to = doorsOf(world, job);
        const r = from.length && to.length ? commutePath(world, "rabbit", from, to, SPECIES_BY_ID.rabbit.commute) : null;
        path = r ? r.path : null;
        pathCache.set(key, path);
      }
      if (path) options.push({ home, path });
    }
    options.sort((a, b) => a.path.length - b.path.length || a.home - b.home);
    let left = jobsOf(world, job);
    for (const option of options) {
      const queue = byHome.get(option.home);
      while (left > 0 && queue.length) {
        const citizen = queue.pop();
        citizen.job = job;
        citizen.hired = world.tick;
        citizen.path = option.path;
        left--;
        staffed++;
      }
      if (!left) break;
    }
  }
  return { target, staffed };
}

/** A full city snapshot that produces one normally rare actionable need. */
export function coherentStressFixture(code, tick = 354) {
  if (!COHERENT_STRESS_CODES.includes(code)) throw new Error(`unknown stress code ${code}`);
  const world = createWorld({ seed: `needs-stress-${code}`, w: 64, h: 64 });
  clearMap(world);
  world.tick = tick;
  world.rates = { R: code === "TAX" ? 12 : 0, C: 0, I: 0 };
  // A real event effect keeps rI quiet at every probe month; it is part of
  // the saved simulation state and is consumed by externalMarket itself.
  world.events.active.push({ id: "recession", until: tick + 12, extMult: 0.6 });
  const built = buildGrid(world, code);
  const { target, staffed } = populate(world, code, built);
  if (code === "CAPPED") world.valves.R = 1 - P / 1350; // one park: cap = 1,350
  refreshLast(world);
  const need = needOf(world, target);
  return { world, target, built, staffed, expected: code, actual: need.code, need };
}

/** Cheap structural facts used by the gate and printed by the probe. */
export function coherentStressFacts(fixture) {
  const { world, target } = fixture;
  let civicZoneOverlap = 0;
  let occupiedTierZero = 0;
  let homeOverflow = 0;
  let jobOverflow = 0;
  let badHousehold = 0;
  let badPath = 0;
  for (let i = 0; i < world.zone.length; i++) {
    if (world.civic[i] !== CIVIC.NONE && world.zone[i] !== ZONE.NONE) civicZoneOverlap++;
    if (world.occupants[i] && world.tier[i] === 0) occupiedTierZero++;
    if (world.occupants[i] > capacityOf(world, i)) homeOverflow++;
    if (world.staff[i] > jobsOf(world, i)) jobOverflow++;
  }
  for (const household of world.households) {
    for (const id of household.members) {
      const citizen = world.byId.get(id);
      if (!citizen || citizen.household !== household.id || citizen.home !== household.home || citizen.species !== household.species) badHousehold++;
    }
  }
  for (const citizen of world.citizens) {
    if (citizen.job < 0) continue;
    // The law as it stands (SPEC 6c): a commute leaves by ONE OF the doors of
    // its home and arrives at ONE OF the doors of its job - not the
    // lowest-numbered of each - and every tile it WALKS is ground a citizen
    // may stand on, which includes a station's forecourt and does not have to
    // be a road.
    const from = doorsOf(world, citizen.home);
    const to = doorsOf(world, citizen.job);
    const p = citizen.path;
    if (!p || !p.length || !from.includes(p[0] & TILE) || !to.includes(p[p.length - 1] & TILE)
      || commuteTime(p) > SPECIES_BY_ID[citizen.species].commute) { badPath++; continue; }
    for (const step of p) {
      const t = step & TILE;
      if (step & RIDE) continue;
      if (world.road[t] === ROAD.NONE && world.rail[t] !== 2 && !passable(world, t)) { badPath++; break; }
    }
  }
  return {
    population: world.last.census.P,
    workers: world.last.census.W,
    jobs: world.last.census.J,
    staffed: fixture.staffed,
    targetHome: target.home,
    targetLV: world.lv[target.home],
    targetPollution: world.pol[target.home],
    targetRoadDist: world.roadDist[target.home],
    civicZoneOverlap, occupiedTierZero, homeOverflow, jobOverflow, badHousehold, badPath,
  };
}
