// save.js — JSON round trip and the state hash. SPEC §15.
//
// Saved: tiles, citizens, households, campers, valves, events, ledger,
// history, the input log, flags, rng states. Derived and NOT saved (rebuilt
// by rebuildDerived): roadDist, pol, lv, traffic, occupants, staff, paths,
// id maps. Paths are re-derived BEFORE the first tick so a loaded city and
// the straight run see the same traffic — the save/load hash invariant.

import { createWorld } from "./world.js";
import { makeRng } from "./rng.js";
import { computeFields, recountRosters, roadPath, doorOf } from "./fields.js";
import { rebuildMaps } from "./citizens.js";
import { refreshLast } from "./tick.js";

const TILE_ARRAYS = ["terrain", "road", "zone", "maxTier", "tier", "civic", "burning", "rubble", "variant", "flooded", "wall"];

function plainCitizen(c) {
  return {
    id: c.id, name: c.name, surname: c.surname, species: c.species, born: c.born, deathAge: c.deathAge,
    home: c.home, job: c.job, household: c.household, friends: c.friends.slice(), mood: c.mood,
    jobless: c.jobless, native: c.native, onLeave: c.onLeave, hired: c.hired,
    grief: c.grief || 0, centenary: !!c.centenary,
    // crime and punishment: custody, the record, the knife
    held: c.held || 0, heldAt: c.heldAt ?? -1, fixed: !!c.fixed, record: c.record || 0, wrongful: !!c.wrongful, wrongedBy: c.wrongedBy || 0, exonerated: !!c.exonerated,
    moodPenalty: c.moodPenalty || 0, moodPenaltyUntil: c.moodPenaltyUntil || 0,
  };
}

export function toPlain(world) {
  const o = {
    version: world.version, seed: world.seed, seedNum: world.seedNum, w: world.w, h: world.h, tick: world.tick,
    cash: world.cash, rates: { ...world.rates }, start: world.start,
    valves: { ...world.valves }, festivalBonus: world.festivalBonus,
    citizens: world.citizens.filter((c) => !c.dead).map(plainCitizen),
    households: world.households.filter((h) => !h.gone).map((h) => ({ id: h.id, members: h.members.slice(), home: h.home, species: h.species, surname: h.surname, arrived: h.arrived })),
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
  world.citizens = o.citizens.map((c) => ({
    ...c, friends: c.friends.slice(), path: null, stale: false,
    held: c.held || 0, heldAt: c.heldAt ?? -1, fixed: !!c.fixed, record: c.record || 0, wrongful: !!c.wrongful, wrongedBy: c.wrongedBy || 0, exonerated: !!c.exonerated,
    moodPenalty: c.moodPenalty || 0, moodPenaltyUntil: c.moodPenaltyUntil || 0,
  }));
  world.households = o.households.map((h) => ({ ...h, members: h.members.slice() }));
  world.campers = o.campers.map((c) => ({ ...c }));
  world.nextId = o.nextId;
  world.nextHouseholdId = o.nextHouseholdId;
  world.events = { ...world.events, ...o.events };
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
    c.path = a != null && b != null ? roadPath(world, a, b) : null;
  }
  computeFields(world);
  // A loaded city reads complete at once (the play-tester saw placeholders
  // in the header until the first tick).
  refreshLast(world);
}

/** FNV-1a over the canonical state (everything but the input log and history). */
export function stateHash(world) {
  const o = toPlain(world);
  delete o.log;
  delete o.history;
  const s = JSON.stringify(o);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
