// save.js — JSON round trip and the state hash. SPEC §15.
//
// Saved: tiles, citizens, households, campers, valves, events, ledger,
// history, the input log, flags, rng states. Derived and NOT saved (rebuilt
// by rebuildDerived): roadDist, pol, lv, traffic, occupants, staff, majority, paths,
// id maps. Paths are re-derived BEFORE the first tick so a loaded city and
// the straight run see the same traffic — the save/load hash invariant.

import { createWorld } from "./world.js";
import { makeRng } from "./rng.js";
import { computeFields, recountRosters, commutePath, doorsOf } from "./fields.js";
import { citizenDefaults, rebuildMaps } from "./citizens.js";
import { locateCamps } from "./camps.js";
import { refreshLast } from "./tick.js";
import { migrateLegacyNames } from "./legacy.js";
import { normalizeUse } from "./use.js";

const TILE_ARRAYS = ["terrain", "road", "zone", "maxTier", "tier", "civic", "civicSize", "burning", "rubble", "variant", "flooded", "wall", "use", "rail", "meat", "big", "theme", "since", "cam"];

// This expanded shape is the pre-Part-B save shape. stateHash deliberately
// keeps using it: storage compaction must not redefine simulation identity.
function canonicalCitizen(c) {
  const out = {
    id: c.id, name: c.name, surname: c.surname, species: c.species, born: c.born, deathAge: c.deathAge,
    home: c.home, job: c.job, household: c.household, friends: c.friends.slice(), life: (c.life || []).map((e) => e.slice()), mood: c.mood,
    jobless: c.jobless, native: c.native, onLeave: c.onLeave, hired: c.hired,
    grief: c.grief || 0, centenary: !!c.centenary,
    // crime and punishment: custody, the record, the knife
    held: c.held || 0, heldAt: c.heldAt ?? -1, fixed: !!c.fixed, record: c.record || 0, wrongful: !!c.wrongful, wrongedBy: c.wrongedBy || 0, exonerated: !!c.exonerated,
    moodPenalty: c.moodPenalty || 0, moodPenaltyUntil: c.moodPenaltyUntil || 0,
  };
  // Optional in old saves/hashes: a penned animal carries the market state;
  // ordinary citizens retain the exact pre-H canonical shape.
  if (c.thefts) out.thefts = c.thefts;
  if (c.pen) { out.pen = true; out.penSince = c.penSince || 0; }
  if (c.burgled) out.burgled = true;
  return out;
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
    version: world.version, justiceVersion: 2, seed: world.seed, seedNum: world.seedNum, w: world.w, h: world.h, tick: world.tick,
    cash: world.cash, rates: { ...world.rates }, start: world.start,
    valves: { ...world.valves }, festivalBonus: world.festivalBonus,
    citizens: world.citizens.filter((c) => !c.dead).map(plainCitizen),
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
  if (world.meatStats) o.meatStats = JSON.parse(JSON.stringify(world.meatStats));
  if (world.legacy?.length) o.legacy = world.legacy.slice();
  if (Object.keys(world.names || {}).length) o.names = { ...world.names };
  for (const k of TILE_ARRAYS) if (k !== "civicSize" || world[k].some(Boolean)) o[k] = Array.from(world[k]);
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
  for (const k of TILE_ARRAYS) if (o[k] && k !== "use") world[k].set(o[k]); // an old save without walls keeps its zeros
  // Old exports have no construction dates: begin observation now, never
  // invent decades of wear. Reject future/wrapped dates before typed coercion.
  for(let i=0;i<world.since.length;i++) {
    const n=o.since?.[i];
    world.since[i]=world.tier[i] ? (Number.isInteger(n)&&n>=0&&n<=world.tick+1?n:world.tick+1) : 0;
  }
  // Validate BEFORE Uint16 assignment: typed-array coercion would otherwise
  // turn an impossible imported 70000 into the plausible mask 4464.
  if (o.use) for (let i = 0; i < world.use.length && i < o.use.length; i++) world.use[i] = normalizeUse(o.use[i]);
  world.citizens = (o.citizens || []).map((c) => ({
    ...citizenDefaults(), ...c,
    friends: (c.friends || []).slice(), life: (c.life || []).map((e) => e.slice()), path: null, stale: false,
  }));
  world.households = o.households.map((h) => ({ ...h, members: h.members.slice() }));
  world.names = { ...(o.names || {}) };
  world.legacy = Array.isArray(o.legacy) ? o.legacy.filter((row) => typeof row === "string") : [];
  migrateLegacyNames(world);
  world.deaths = (o.deaths || []).map((entry) => Array.isArray(entry) ? entry.slice() : { ...entry });
  world.campers = o.campers.map((c) => ({ ...c }));
  locateCamps(world);
  world.nextId = o.nextId;
  world.nextHouseholdId = o.nextHouseholdId;
  // Legacy saves recorded total convictions, but not the theft count.
  // Recover only thefts actually present in their retained arrest history.
  if (!o.justiceVersion) for (const c of world.citizens) {
    if (c.thefts) continue;
    c.thefts = (o.events.arrests || []).filter(a => a.citizenId === c.id && !a.exonerated && ["burglary", "theft"].includes(a.cause)).length;
  }
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
  world.meatStats = o.meatStats ? JSON.parse(JSON.stringify(o.meatStats)) : null;
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
  computeFields(world); // computes roadDist and the station links, so doorsOf and the commute search work
  // (No `doorsMoved` reset here: this runs on a world createWorld has just
  // made, so fields.markDoorsMoved has no previous signature to compare and
  // claims nothing by design. A line resetting the flag looked prudent and
  // could never fire - a mutant deleting it survived every check there is.)
  for (const c of world.citizens) {
    if (c.job < 0 || c.home < 0) continue;
    const a = doorsOf(world, c.home);
    const b = doorsOf(world, c.job);
    c.path = a.length && b.length ? (commutePath(world, c.species, a, b) || { path: null }).path : null; // the weighted commute (use-zoning), never the unit BFS: a loaded city must take the roads the live one took
  }
  // A loaded city reads complete at once (the play-tester saw placeholders
  // in the header until the first tick). `refreshLast` recomputes the fields
  // itself, so the paths rebuilt above are in the traffic it counts - there is
  // no second `computeFields` here, and a mutant deleting one proved it.
  refreshLast(world);
}

/** FNV-1a over the canonical state (everything but the input log and history). */
export function stateHash(world, { news = true } = {}) {
  const o = toPlain(world);
  o.citizens = world.citizens.filter((c) => !c.dead).map(canonicalCitizen);
  delete o.justiceVersion; // migration marker, not simulation state
  delete o.log;
  delete o.history;
  if (!news) delete o.events.log;
  // Part K adds empty, backward-compatible save fields without changing the
  // standing simulation hash. Once Parts B/H put state in them, it is hashed.
  if (!Object.keys(o.names || {}).length) delete o.names;
  if (!o.deaths.length) delete o.deaths;
  if (o.meat.every((n) => n === 0)) delete o.meat;
  if (o.meatStats) {
    const m = o.meatStats;
    const flows = [...Object.values(m.total || {}), ...Object.values(m.yearly || {}), ...Object.values(m.halls || {}).flatMap((x) => Object.values(x || {}))];
    const live = flows.some((n) => n !== 0) || Object.values(m.demand || {}).some((n) => n !== 0) || Object.values(m.dry || {}).some(Boolean) || (m.opening || 0) !== 0;
    if (!live) delete o.meatStats; // lazy all-zero H scaffolding does not redefine a pre-H city's identity
  }
  if (o.big.every((n) => n === 0)) delete o.big; // a town with no block yet hashes as it did before the blocks
  if (o.theme.every((n) => n === 0)) delete o.theme; // and one with no landmark as it did before the landmarks (SPEC §3c)
  if (o.cam.every((n) => n === 0)) delete o.cam; // and one with no camera as it did before the network (SPEC §9d)

  for (const c of o.citizens) if (!c.life?.length) delete c.life;
  const s = JSON.stringify(o);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** The simulation identity with the saved news feed removed (Part F proof). */
export function stateHashNoNews(world) {
  return stateHash(world, { news: false });
}
