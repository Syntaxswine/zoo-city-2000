// save.js — JSON round trip and the state hash. SPEC §15.
//
// Saved: tiles, citizens, households, campers, valves, events, ledger,
// history, the input log, flags, rng states. Derived and NOT saved (rebuilt
// by rebuildDerived): roadDist, pol, lv, traffic, occupants, staff, majority, paths,
// id maps. Paths are re-derived BEFORE the first tick so a loaded city and
// the straight run see the same traffic — the save/load hash invariant.

import { createWorld } from "./world.js";
import { makeRng } from "./rng.js";
import { computeFields, recountRosters, commutePath, doorOf } from "./fields.js";
import { citizenDefaults, rebuildMaps } from "./citizens.js";
import { refreshLast } from "./tick.js";

const TILE_ARRAYS = ["terrain", "road", "zone", "maxTier", "tier", "civic", "burning", "rubble", "variant", "flooded", "wall", "use", "rail", "meat", "big"];

// This expanded shape is the pre-Part-B save shape. stateHash deliberately
// keeps using it: storage compaction must not redefine simulation identity.
function canonicalCitizen(c) {
  return {
    id: c.id, name: c.name, surname: c.surname, species: c.species, born: c.born, deathAge: c.deathAge,
    home: c.home, job: c.job, household: c.household, friends: c.friends.slice(), life: (c.life || []).map((e) => e.slice()), mood: c.mood,
    jobless: c.jobless, native: c.native, onLeave: c.onLeave, hired: c.hired,
    grief: c.grief || 0, centenary: !!c.centenary,
    // crime and punishment: custody, the record, the knife
    held: c.held || 0, heldAt: c.heldAt ?? -1, fixed: !!c.fixed, record: c.record || 0, wrongful: !!c.wrongful, wrongedBy: c.wrongedBy || 0, exonerated: !!c.exonerated,
    moodPenalty: c.moodPenalty || 0, moodPenaltyUntil: c.moodPenaltyUntil || 0,
  };
}

function plainCitizen(c) {
  const full = canonicalCitizen(c);
  const defaults = citizenDefaults();
  const o = {
    id: full.id, name: full.name, surname: full.surname, species: full.species,
    born: full.born, deathAge: full.deathAge, household: full.household,
  };
  for (const [key, value] of Object.entries(full)) {
    if (key in o || !(key in defaults)) continue;
    const fallback = defaults[key];
    if (Array.isArray(value)) {
      if (value.length) o[key] = value;
    } else if (value !== fallback) {
      o[key] = value;
    }
  }
  return o;
}

export function toPlain(world) {
  const o = {
    version: world.version, seed: world.seed, seedNum: world.seedNum, w: world.w, h: world.h, tick: world.tick,
    cash: world.cash, rates: { ...world.rates }, start: world.start,
    valves: { ...world.valves }, festivalBonus: world.festivalBonus,
    citizens: world.citizens.filter((c) => !c.dead).map(plainCitizen),
    names: { ...(world.names || {}) },
    deaths: (world.deaths || []).map((entry) => Array.isArray(entry) ? entry.slice() : { ...entry }),
    households: world.households.filter((h) => !h.gone).map((h) => ({ id: h.id, members: h.members.slice(), home: h.home, species: h.species, surname: h.surname, arrived: h.arrived, notice: h.notice || 0 })),
    campers: world.campers.map((c) => ({ ...c })),
    nextId: world.nextId, nextHouseholdId: world.nextHouseholdId,
    events: JSON.parse(JSON.stringify({ ...world.events, log: world.events.log.slice(-200) })),
    ledger: { ...world.ledger },
    history: world.history.slice(),
    log: world.log.slice(),
    flags: { ...world.flags },
    rng: { sim: world.rng.state, names: world.rngNames.state },
    friendCursor: world._friendCursor || 0,
    jobCursor: world._jobCursor || 0,
  };
  for (const k of TILE_ARRAYS) o[k] = Array.from(world[k]);
  return o;
}

export function save(world) {
  return JSON.stringify(toPlain(world));
}

export function fromPlain(o) {
  const world = createWorld({ seed: o.seed, w: o.w, h: o.h });
  world.tick = o.tick;
  world.cash = o.cash;
  world.rates = { ...o.rates };
  world.start = o.start;
  world.valves = { ...world.valves, ...o.valves }; // an old save without M keeps the default 0
  world.festivalBonus = o.festivalBonus;
  for (const k of TILE_ARRAYS) if (o[k]) world[k].set(o[k]); // an old save without walls keeps its zeros
  world.citizens = (o.citizens || []).map((c) => ({
    ...citizenDefaults(), ...c,
    friends: (c.friends || []).slice(), life: (c.life || []).map((e) => e.slice()), path: null, stale: false,
  }));
  world.households = o.households.map((h) => ({ ...h, members: h.members.slice() }));
  world.names = { ...(o.names || {}) };
  world.deaths = (o.deaths || []).map((entry) => Array.isArray(entry) ? entry.slice() : { ...entry });
  world.campers = o.campers.map((c) => ({ ...c }));
  world.nextId = o.nextId;
  world.nextHouseholdId = o.nextHouseholdId;
  const jDefaults = world.events.justice;
  world.events = { ...world.events, ...o.events };
  world.events.justice = { ...jDefaults, ...(o.events.justice || {}) }; // an old save without a counter keeps 0, never NaN
  world.ledger = { ...o.ledger };
  world.history = o.history.slice();
  world.log = o.log.slice();
  world.flags = { ...o.flags };
  world.rng = makeRng(o.rng.sim);
  world.rngNames = makeRng(o.rng.names);
  world._friendCursor = o.friendCursor || 0;
  world._jobCursor = o.jobCursor || 0;
  rebuildDerived(world);
  return world;
}

export function load(json) {
  return fromPlain(JSON.parse(json));
}

/** Rebuild everything derived, in the order the tick expects. */
export function rebuildDerived(world) {
  rebuildMaps(world);
  world.roadsDirty = true;
  world.wallsDirty = true;
  recountRosters(world);
  // Paths first (deterministic), then fields (traffic reads paths).
  computeFields(world); // computes roadDist so doorOf works
  for (const c of world.citizens) {
    if (c.job < 0 || c.home < 0) continue;
    const a = doorOf(world, c.home);
    const b = doorOf(world, c.job);
    c.path = a != null && b != null ? (commutePath(world, c.species, a, b) || { path: null }).path : null; // the weighted commute (use-zoning), never the unit BFS: a loaded city must take the roads the live one took
  }
  computeFields(world);
  // A loaded city reads complete at once (the play-tester saw placeholders
  // in the header until the first tick).
  refreshLast(world);
}

/** FNV-1a over the canonical state (everything but the input log and history). */
export function stateHash(world) {
  const o = toPlain(world);
  o.citizens = world.citizens.filter((c) => !c.dead).map(canonicalCitizen);
  delete o.log;
  delete o.history;
  // Part K adds empty, backward-compatible save fields without changing the
  // standing simulation hash. Once Parts B/H put state in them, it is hashed.
  if (!Object.keys(o.names).length) delete o.names;
  if (!o.deaths.length) delete o.deaths;
  if (o.meat.every((n) => n === 0)) delete o.meat;
  if (o.big.every((n) => n === 0)) delete o.big; // a town with no block yet hashes as it did before the blocks
  for (const c of o.citizens) if (!c.life?.length) delete c.life;
  const s = JSON.stringify(o);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
