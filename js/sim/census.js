// census.js — everything the valves, the rules tab and the report card read,
// counted from the state every tick and never stored. SPEC §4 (census), §10.

import { KNOBS } from "./rules.js";
import { SPECIES, SPECIES_BY_ID, isPredPrey, isPredatorOf, DIET_OF } from "./species.js";
import { ZONE, CIVIC, ROAD, jobsOf, jobZone, absent } from "./world.js";
import { hasAccess, edgeRoads } from "./fields.js";

export const ageMonths = (world, c) => world.tick - c.born;
export const ageYears = (world, c) => Math.floor((world.tick - c.born) / 12);

export function isWorker(world, c) {
  const y = ageYears(world, c);
  if (y < KNOBS.ADULT_AGE) return false;
  if (y >= SPECIES_BY_ID[c.species].retire) return false;
  if (c.onLeave) return false;
  if (absent(world, c)) return false; // the cells or the centre
  return true;
}

export function census(world) {
  const { citizens, w, h } = world;
  const n = w * h;
  const P = citizens.length;
  let W = 0;
  let F = 0;
  let moodSum = 0;
  let native = 0;
  const counts = {};
  for (const s of SPECIES) counts[s.id] = 0;
  let friendships = 0;
  let cross = 0;
  let predPrey = 0;
  let predPreyFixed = 0;
  const diet = { herb: 0, omni: 0, carn: 0 };
  let fixed = 0;
  let wrongful = 0;
  let exonerated = 0;
  let held = 0;
  let herbNear = 0;
  const byId = world._byId || (world._byId = new Map());
  byId.clear();
  for (const c of citizens) byId.set(c.id, c);
  world.byId = byId;
  for (const c of citizens) {
    if (isWorker(world, c)) W++;
    if (c.job >= 0) F++;
    moodSum += c.mood;
    if (c.native) native++;
    counts[c.species]++;
    diet[DIET_OF[c.species]]++;
    if (c.fixed) fixed++;
    if (c.wrongful) wrongful++;
    if (c.exonerated) exonerated++;
    if (absent(world, c)) held++;
    if (c.home >= 0 && world.dread[c.home] > 0 && DIET_OF[c.species] === "herb") herbNear++;
    for (const f of c.friends) {
      if (f > c.id) {
        friendships++;
        const o = byId.get(f);
        if (o && o.species !== c.species) {
          cross++;
          if (isPredPrey(c.species, o.species)) {
            predPrey++;
            // A fixed predator's friendship with its prey counts ONCE in H: the knife buys quiet, not the index.
            if ((isPredatorOf(c.species, o.species) && c.fixed) || (isPredatorOf(o.species, c.species) && o.fixed)) predPreyFixed++;
          }
        }
      }
    }
  }
  let J = 0;
  let Jc = 0;
  let Ji = 0;
  let Jm = 0;
  let markets = 0;
  let centres = 0;
  let maxDread = 0;
  let parks = 0;
  let zoos = 0;
  let lotsNoRoad = 0;
  let lvSum = 0;
  let polSum = 0;
  let maxPol = 0;
  let rCap = 0;
  let maxTraffic = 0;
  let lots = 0;
  let roads = 0;
  let walls = 0;
  let tunnels = 0;
  let usePred = 0;
  let usePrey = 0;
  let fireStations = 0;
  let policeStations = 0;
  let burning = 0;
  let crimeSum = 0;
  let crimeN = 0;
  let maxCrime = 0;
  for (let i = 0; i < n; i++) {
    const jobs = jobsOf(world, i);
    if (jobs) {
      J += jobs;
      const jz = jobZone(world, i);
      if (jz === ZONE.C) Jc += jobs;
      else if (jz === ZONE.M) Jm += jobs;
      else Ji += jobs;
    }
    if (world.zone[i] === ZONE.M && world.tier[i] > 0) markets++;
    if (world.dread[i] > maxDread) maxDread = world.dread[i];
    if (world.civic[i] === CIVIC.PARK) parks++;
    else if (world.civic[i] === CIVIC.ZOO) zoos++;
    else if (world.civic[i] === CIVIC.FIRE) fireStations++;
    else if (world.civic[i] === CIVIC.POLICE) policeStations++;
    else if (world.civic[i] === CIVIC.CENTRE) centres++;
    if (world.burning[i]) burning++;
    if (world.tier[i] > 0) { crimeSum += world.crime[i]; crimeN++; if (world.crime[i] > maxCrime) maxCrime = world.crime[i]; }
    if (world.zone[i] !== ZONE.NONE) {
      lots++;
      if (!hasAccess(world, i)) lotsNoRoad++;
      if (world.zone[i] === ZONE.R) rCap += KNOBS.R_CAP[world.tier[i]];
    }
    if (world.road[i] !== ROAD.NONE) roads++;
    if (world.wall[i]) { walls++; if (world.road[i] !== ROAD.NONE) tunnels++; }
    if (world.use[i] && (world.zone[i] !== ZONE.NONE || world.road[i] !== ROAD.NONE)) { if (world.use[i] === 1) usePred++; else usePrey++; }
    lvSum += world.lv[i];
    polSum += world.pol[i];
    if (world.pol[i] > maxPol) maxPol = world.pol[i];
    if (world.traffic[i] > maxTraffic) maxTraffic = world.traffic[i];
  }
  const U = Math.max(0, W - F);
  const Lab = J ? Math.max(0, Math.min(1.3, W / J)) : 1.3;
  const shares = {};
  for (const s of SPECIES) shares[s.id] = P ? counts[s.id] / P : 0;
  const speciesPresent = SPECIES.filter((s) => shares[s.id] >= 0.05).length;
  // The Zoo City index: cross-species share of friendships, with a
  // predator–prey link counting PREDPREY_WEIGHT times (the wolf and the rabbit).
  const wCross = cross + (KNOBS.PREDPREY_WEIGHT - 1) * (predPrey - predPreyFixed);
  const wAll = friendships + (KNOBS.PREDPREY_WEIGHT - 1) * (predPrey - predPreyFixed);
  // A sample of one is not an index: H fades in over the first H_FLOOR friendships.
  const H = wAll ? (wCross / wAll) * Math.min(1, friendships / KNOBS.H_FLOOR) : 0;
  // The share of cross-species friendship that involves a fixed predator — the report card's "by pacification".
  const hKnife = wAll ? (predPreyFixed / wAll) * Math.min(1, friendships / KNOBS.H_FLOOR) : 0;
  return {
    P, W, J, Jc, Ji, Jm, F, U, Lab,
    counts, shares, speciesPresent, diet, carnivores: diet.carn,
    friendships, cross, predPrey, predPreyFixed, H, hKnife,
    fixed, wrongful, exonerated, held, herbNear, maxDread, markets, centres,
    approval: P ? moodSum / P : 50,
    native: P ? native / P : 0,
    parks, zoos, lots, roads, walls, tunnels, usePred, usePrey, lotsNoRoad,
    fireStations, policeStations, burning,
    meanCrime: crimeN ? crimeSum / crimeN : 0, maxCrime,
    edgeRoads: Math.min(KNOBS.EDGE_ROAD_MAX, edgeRoads(world).length),
    meanLV: lvSum / n,
    meanPol: polSum / n,
    maxPol,
    maxTraffic,
    vacantR: Math.max(0, rCap - P),
    rCap,
  };
}
