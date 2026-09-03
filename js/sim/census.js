// census.js — everything the valves, the rules tab and the report card read,
// counted from the state every tick and never stored. SPEC §4 (census), §10.

import { KNOBS } from "./rules.js";
import { SPECIES, SPECIES_BY_ID, isPredPrey, isPredatorOf, DIET_OF } from "./species.js";
import { ZONE, CIVIC, ROAD, jobsOf, jobZone, absent, capacityOf, isPart } from "./world.js";
import { hasAccess, edgeRoads , commuteTime, rides, fireExposure } from "./fields.js";
import { landmarkOf } from "./landmarks.js";

export const ageMonths = (world, c) => world.tick - c.born;
export const ageYears = (world, c) => Math.floor((world.tick - c.born) / 12);

const SPECIES_SLOT = Object.freeze(Object.fromEntries(SPECIES.map((s, i) => [s.id, i])));

/** Majority residents on R lots and majority staff on C/I/M lots. Derived. */
export function recountMajority(world) {
  const speciesN = SPECIES.length;
  const n = world.w * world.h;
  const counts = world._majorityCounts && world._majorityCounts.length === n * speciesN
    ? world._majorityCounts
    : (world._majorityCounts = new Uint16Array(n * speciesN));
  counts.fill(0);
  world.majority.fill(0);
  for (const c of world.citizens) {
    if (c.dead) continue;
    const slot = SPECIES_SLOT[c.species];
    if (slot == null) continue;
    if (c.home >= 0 && world.zone[c.home] === ZONE.R) counts[c.home * speciesN + slot]++;
    if (c.job >= 0 && world.zone[c.job] >= ZONE.C && world.zone[c.job] <= ZONE.M) counts[c.job * speciesN + slot]++;
  }
  for (let i = 0; i < n; i++) {
    let best = 0;
    let bestN = 0;
    for (let s = 0; s < speciesN; s++) {
      const count = counts[i * speciesN + s];
      if (count > bestN) { bestN = count; best = s + 1; }
    }
    world.majority[i] = best;
  }
}

export function isWorker(world, c) {
  const y = ageYears(world, c);
  if (y < KNOBS.ADULT_AGE) return false;
  if (y >= SPECIES_BY_ID[c.species].retire) return false;
  if (c.onLeave) return false;
  if (absent(world, c)) return false; // the cells or the centre
  return true;
}

export function census(world) {
  recountMajority(world);
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
  let riders = 0;
  let commuteN = 0;
  let commuteSum = 0;
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
    if (c.path) { commuteN++; commuteSum += commuteTime(c.path); if (rides(c.path)) riders++; }
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
  let railTiles = 0;
  let stations = 0;
  let fireStations = 0;
  let policeStations = 0;
  let burning = 0;
  let blocks2 = 0;
  let blocks3 = 0;
  let landmarks = 0;
  const landmarkCounts = {}; // theme id → standing (SPEC §3c)
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
    if (world.zone[i] === ZONE.M && world.tier[i] > 0 && !isPart(world, i)) markets++; // a block is one hall
    if (world.big[i] === 2) blocks2++;
    else if (world.big[i] === 3) { blocks3++; const lm = landmarkOf(world.theme[i]); if (lm) { landmarks++; landmarkCounts[lm.name] = (landmarkCounts[lm.name] || 0) + 1; } }
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
      if (world.zone[i] === ZONE.R) rCap += capacityOf(world, i); // a block's anchor holds ×1.25 its lots; its parts hold nobody
    }
    if (world.road[i] !== ROAD.NONE) roads++;
    if (world.rail[i] === 1) railTiles++;
    else if (world.rail[i] === 2) stations++;
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
    parks, zoos, lots, roads, walls, tunnels, usePred, usePrey, railTiles, stations, riders, commuteN, meanCommute: commuteN ? commuteSum / commuteN : 0, lotsNoRoad,
    fireStations, policeStations, burning,
    blocks2, blocks3, // the 2×2 and 3×3 blocks standing (anchors; SPEC §3b)
    landmarks, landmarkCounts, // the 3×3s that rose as a species' landmark, and which by name (SPEC §3c)
    // What covering the town is WORTH: the multiplier on how often a fire is
    // rolled at all, 1 in a town with no cover. The rules tab shows it, and it
    // is the same function the roster weight uses (fields.fireExposure).
    fireExposure: fireExposure(world).share,
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
