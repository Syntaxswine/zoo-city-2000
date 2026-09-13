import { policy, foodRecipient, communityFactor } from './governance.js';
// citizens.js — the zoo. SPEC §7. Pure; imports cleanly in Node.
//
// Every animal is a record with a persistent home and job (the anti-GlassBox
// rule). Households own arrivals, births and departures. THE DANGLING-ID LAW:
// `removeCitizen` is the only way a citizen leaves the world and it scrubs
// every reference in the same call — friends' lists, the household, the
// occupant and staff counts. check.mjs recounts all of it.

import { addCamp } from "./camps.js";
import { KNOBS } from "./rules.js";
import { SPECIES, SPECIES_BY_ID, NAME_PARTS, affinity, ARRIVING, PREY_OF, DIET_OF, isPredatorOf, isPredPrey, admits } from "./species.js";
import { temperOf, compat } from "./temper.js";
import { computeInfrastructure, medicalLifespanModifier } from "./progression.js";
import { ZONE, CIVIC, TERRAIN, ROAD, idx, inBounds, capacityOf, jobsOf, jobZone, absent, civicAnchorOf, anchorOf } from "./world.js";
import { useName } from "./use.js";
import { doorsOf, edgeRoads, commutePath, dial, WALK, nodePath, commuteTime } from "./fields.js";
import { ageYears, ageMonths, isWorker } from "./census.js";
import { neutralRate } from "./demand.js";
import { DEATHS_MAX, KIND, remember } from "./life.js";
import { archiveCitizen } from "./legacy.js";
import { pluralSpecies } from "./landmarks.js";

const SURNAMES = {
  rabbit: ["Burrowes", "Bramblefoot", "Clovermere", "Thistlewood"],
  mouse: ["Whiskerton", "Crumbly", "Nibbs", "Pipkin"],
  fox: ["Slyfield", "Russet", "Vulpin", "Reynard"],
  beaver: ["Gnawley", "Lodgewood", "Dambrook", "Chipperly"],
  owl: ["Hootsworth", "Nightingale", "Tuftly", "Perchmont"],
  bear: ["Ursin", "Honeycomb", "Brambleton", "Grumbold"],
  tortoise: ["Shelby", "Slowcombe", "Mossback", "Testudo"],
  raccoon: ["Binsworth", "Ringtail", "Scrapley", "Midnight"],
  pig: ["Trotter", "Rasher", "Sowerby", "Hamhock"],
  cow: ["Cudworth", "Buttercup", "Daisyfield", "Mooreland"],
  wolf: ["Greyback", "Howell", "Lupin", "Fangley"],
  cat: ["Purrington", "Whiskers", "Tabbs", "Mousewell"],
  hawk: ["Talonby", "Skyward", "Kestrel", "Windrow"],
  skunk: ["Stripely", "Muskwell", "Blackstripe", "Whiffington"],
};

// ---------------------------------------------------------------------------
// Names (the names stream only — a new syllable never changes a city)
// ---------------------------------------------------------------------------

export function firstName(world, species) {
  const p = NAME_PARTS[species];
  const rng = world.rngNames;
  return rng.pick(p.a) + rng.pick(p.b);
}

export function surname(world, species) {
  return world.rngNames.pick(SURNAMES[species]);
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

/** Shared persisted defaults: creation and save migration must never drift. */
export function citizenDefaults() {
  return {
    home: -1,
    job: -1,
    household: -1,
    friends: [],
    life: [],
    mood: 50,
    jobless: 0,
    path: null,
    native: false,
    onLeave: false,
    hired: -1,
    grief: 0,
    careBonus: 0,
    centenary: false,
    held: 0,
    heldAt: -1,
    pen: false,
    penSince: 0,
    fixed: false,
    record: 0, thefts: 0,
    wrongful: false,
    wrongedBy: 0,
    exonerated: false,
    burgled: false,
    moodPenalty: 0,
    moodPenaltyUntil: 0,
  };
}

function newCitizen(world, species, ageMonthsNow, household, surnameStr, native) {
  const sp = SPECIES_BY_ID[species];
  const u = world.rng.next();
  const c = {
    ...citizenDefaults(),
    id: world.nextId++,
    name: firstName(world, species),
    surname: surnameStr,
    species,
    born: world.tick - ageMonthsNow,
    deathAge: Math.round(sp.life * 12 * (0.8 + 0.4 * u)),
    household,
    native: !!native,
  };
  return c;
}

/** A household of `size` citizens of one species: 2 adults + children. Not yet homed. */
export function createHousehold(world, species, size) {
  const sp = SPECIES_BY_ID[species];
  const hh = { id: world.nextHouseholdId++, members: [], home: -1, species, surname: surname(world, species), arrived: world.tick };
  const rng = world.rng;
  for (let k = 0; k < size; k++) {
    let age;
    if (k < 2) age = 12 * (sp.fertile[0] + rng.int(Math.max(1, sp.fertile[1] - sp.fertile[0])));
    else age = 12 * rng.int(KNOBS.ADULT_AGE);
    const c = newCitizen(world, species, age, hh.id, hh.surname, false);
    hh.members.push(c.id);
    world.citizens.push(c);
    world.byId.set(c.id, c);
  }
  world.households.push(hh);
  world.hhById.set(hh.id, hh);
  return hh;
}

/**
 * `moved` (default true) stamps `hh.homed`, the tick the household took THIS home — the push's
 * roots read it (SPEC §7.4; the owner, 2026-09-07: leaving takes a combination, damped by years at
 * home). A put-back on the same lot (the dread rehome that found nowhere better, an eviction that
 * kept the lot) passes false: nobody moved, the roots stand. Saved only when it differs from
 * `arrived`; an old save loads it as `arrived`. NOT `since`, which is the building-age tile array.
 */
export function placeHousehold(world, hh, lot, moved = true) {
  hh.home = lot;
  if (moved) hh.homed = world.tick;
  for (const id of hh.members) {
    const c = world.byId.get(id);
    c.home = lot;
    world.occupants[lot]++;
    // A new home means a new commute: the old path is from the old door.
    // (Found by the save/load hash: a rehomed family's stale path fed traffic.)
    if (c.job >= 0) { c.path = null; c.stale = true; }
  }
}

/** Release a citizen's job in ONE place — retirement, a lot's decay, a bulldoze, custody. */
export function releaseJob(world, c) {
  if (c.job < 0) return;
  const lot = c.job;
  world.staff[c.job]--;
  c.job = -1;
  c.path = null;
  c.hired = -1;
  remember(world, c, KIND.LOST_JOB, lot);
}

// ---------------------------------------------------------------------------
// Removal — the dangling-id law
// ---------------------------------------------------------------------------

export function removeCitizen(world, c, cause, lastHome = c.home) {
  if (c.dead) return;
  c.dead = true;
  c.cause = cause;
  archiveCitizen(world, lastHome === c.home ? c : { ...c, home: lastHome }, cause);
  for (const f of c.friends) {
    const o = world.byId.get(f);
    if (o && !o.dead) {
      remember(world, o, KIND.LOST_FRIEND, [c.id, cause]);
      const k = o.friends.indexOf(c.id);
      if (k >= 0) o.friends.splice(k, 1);
    }
  }
  if (!world.deaths) world.deaths = [];
  if (cause === "died" || cause === "killed" || cause === "sold") {
    world.deaths.push([world.tick, c.id]);
    if (world.deaths.length > DEATHS_MAX) world.deaths.splice(0, world.deaths.length - DEATHS_MAX);
  }
  c.friends.length = 0;
  if (c.home >= 0) world.occupants[c.home]--;
  if (c.job >= 0) world.staff[c.job]--;
  c.home = -1;
  c.job = -1;
  c.path = null;
  const hh = world.hhById.get(c.household);
  if (hh) {
    const k = hh.members.indexOf(c.id);
    if (k >= 0) hh.members.splice(k, 1);
    if (hh.members.length === 0) {
      world.hhById.delete(hh.id);
      hh.gone = true;
      world.campers = world.campers.filter(cp => cp.householdId !== hh.id);
    }
  }
  world.byId.delete(c.id);
  world._removed = (world._removed || 0) + 1;
}

export function removeHousehold(world, hh, cause, lastHome = hh.home) {
  let removed = 0;
  for (const id of hh.members.slice()) {
    const c = world.byId.get(id);
    // A pen purchase removes the cub from ordinary town life, not from its
    // identity or family.  Household departures, revolts and evictions may
    // remove everybody else, but the hall keeps the animal until release or
    // its exact sixteenth birthday.
    if (c && !c.pen) {
      removeCitizen(world, c, cause, lastHome);
      removed++;
    }
  }
  return removed;
}

/** Compact the arrays after a tick's removals. */
export function compact(world) {
  if (world._removed) {
    world.citizens = world.citizens.filter((c) => !c.dead);
    world.households = world.households.filter((h) => !h.gone);
    world._removed = 0;
  }
  // Cold citizen records and imported pre-C names are permanent civic memory.
  // Only the small trailing death-index is bounded; it points into the archive.
  world.deaths = (world.deaths || []).filter((entry) => (Array.isArray(entry) ? entry[0] : entry.tick) >= world.tick - 12);
}

// ---------------------------------------------------------------------------
// Homes
// ---------------------------------------------------------------------------

function waterWithin(world, i, r) {
  const { w } = world;
  const tx = i % w;
  const ty = (i / w) | 0;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const xx = tx + dx;
    const yy = ty + dy;
    if (inBounds(world, xx, yy) && world.terrain[yy * w + xx] === TERRAIN.WATER) return true;
  }
  return false;
}
function parkWithin(world, i, r) {
  const { w } = world;
  const tx = i % w;
  const ty = (i / w) | 0;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const xx = tx + dx;
    const yy = ty + dy;
    if (inBounds(world, xx, yy) && world.civic[yy * w + xx] === CIVIC.PARK) return true;
  }
  return false;
}
function treeWithin(world, i, r) {
  const { w } = world;
  const tx = i % w;
  const ty = (i / w) | 0;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const xx = tx + dx;
    const yy = ty + dy;
    if (inBounds(world, xx, yy) && world.terrain[yy * w + xx] === TERRAIN.TREE) return true;
  }
  return false;
}

/**
 * The exact terms in a species' home score. `potential` marks the preference
 * bonus a lot could supply; Needs reads the missing part instead of copying
 * the preference rule. `strict` preserves the fox/bear soft arrival gates.
 */
export function homeTerms(world, species, i, strict = false) {
  const sp = SPECIES_BY_ID[species];
  const lv = world.lv[i];
  const pol = world.pol[i];
  const terms = [
    { code: "LV_BASE", value: lv },
    { code: "POLLUTION", value: -pol * (1 - sp.polTol / 100) },
  ];
  // The meat hall's dread: herbivores steer away from it; carnivores do not mind (the LV term already took 0.8·dread off).
  const diet = DIET_OF[species];
  if (diet === "herb") terms.push({ code: "DREAD_HOME", value: -KNOBS.DREAD_HOME_HERB * world.dread[i] });
  else if (diet === "carn") terms.push({ code: "DREAD_HOME", value: KNOBS.DREAD_HOME_CARN * world.dread[i] });
  switch (sp.homePref) {
    case "high": {
      const met = world.maxTier[i] === 3 && world.tier[i] >= 2;
      terms.push({ code: "HIGH", value: met ? 15 : 0, potential: 15 });
      break;
    }
    case "low": {
      const met = world.maxTier[i] === 1 || world.tier[i] === 1;
      terms.push({ code: "LOW", value: met ? 15 : strict ? -Infinity : 0, potential: 15 });
      break;
    }
    case "lv50": {
      const met = lv >= 50;
      terms.push({ code: "LV", value: met ? 20 : strict ? -Infinity : 0, potential: 20 });
      break;
    }
    case "water": terms.push({ code: "WATER", value: waterWithin(world, i, 6) ? 15 : 0, potential: 15 }); break;
    case "trees": terms.push({ code: "TREES", value: treeWithin(world, i, 3) ? 15 : 0, potential: 15 }); break;
    case "pasture": {
      terms.push({ code: "PASTURE", value: world.maxTier[i] === 1 || world.tier[i] === 1 ? 10 : 0, potential: 10 });
      terms.push({ code: "PASTURE", value: parkWithin(world, i, 4) ? 10 : 0, potential: 10 });
      break;
    }
    case "flats": terms.push({ code: "HIGH", value: world.tier[i] >= 2 ? 15 : 0, potential: 15 }); break;
    case "dirt": terms.push({ code: "CLEAN", value: pol >= 15 ? 12 : 0, potential: 12 }); break; // raccoons like it messy
    default: break;
  }
  return terms;
}

/** How much a species likes a vacant R lot. `strict` honours the soft gates. */
export function homeScore(world, species, i, strict = false) {
  return homeTerms(world, species, i, strict).reduce((sum, term) => sum + term.value, 0);
}

/** Vacant R lots with room for `size` that ADMIT the species (use-zoning, SPEC §7.8), optionally limited to a set of lots. */
function vacantLots(world, species, size, allowed = null) {
  const out = [];
  const n = world.w * world.h;
  for (let i = 0; i < n; i++) {
    if (world.zone[i] !== ZONE.R || world.tier[i] === 0) continue;
    if (allowed && !allowed.has(i)) continue;
    if (!(Array.isArray(species) ? species.every((s) => admits(world.use[i], s)) : admits(world.use[i], species))) continue; // the player's line — a gate, on purpose, for EVERY species under the roof
    if (world.mansion[i] && world.occupants[i] > 0) continue; // a MANSION (SPEC §9f) holds ONE household: the next family waits for it to empty
    if (capacityOf(world, i) - world.occupants[i] >= size) out.push(i);
  }
  return out;
}

/**
 * The species a household holds, its label first — a wedding (SPEC §7.2) can put two under one
 * roof, and every gate that asks "does this lot admit them" (the player's line, SPEC §7.8) must
 * ask for ALL of them: bestHome takes the list and admits a lot only when it admits every one.
 */
export function householdSpecies(world, hh) {
  const out = [];
  for (const id of hh.members) { const c = world.byId.get(id); if (c && !c.dead && !out.includes(c.species)) out.push(c.species); }
  if (!out.length) out.push(hh.species);
  const k = out.indexOf(hh.species);
  if (k > 0) { out.splice(k, 1); out.unshift(hh.species); }
  return out;
}

function bestHome(world, species, size, strict, allowed = null) {
  let best = -1;
  let bestS = -Infinity;
  for (const i of vacantLots(world, species, size, allowed)) {
    const s = homeScore(world, Array.isArray(species) ? species[0] : species, i, strict); // scored by the household's label; admitted for all (vacantLots)
    if (s > bestS) { bestS = s; best = i; }
  }
  return best;
}

/**
 * A penned cub retains its original household and return address while the
 * animals physically at home may move or leave.  Split those present members
 * into a temporary household before relocation so no pen receives a move,
 * zoning notice or departure by proxy.
 */
function detachPresent(world, hh) {
  const present = hh.members.filter((id) => {
    const c = world.byId.get(id);
    return c && !c.dead && !c.pen;
  });
  if (!present.length) return null;
  const penned = hh.members.filter((id) => {
    const c = world.byId.get(id);
    return c && !c.dead && c.pen;
  });
  if (!penned.length) return hh;
  const moving = { ...hh, id: world.nextHouseholdId++, members: present.slice() };
  hh.members = penned;
  hh.notice = 0;
  for (const id of present) world.byId.get(id).household = moving.id;
  world.households.push(moving);
  world.hhById.set(moving.id, moving);
  return moving;
}

/** Lots with a door within `maxRoad` road tiles of ANY of `fromLot`'s doors. */
function lotsWithinRoad(world, fromLot, maxRoad) {
  const from = doorsOf(world, fromLot);
  const set = new Set();
  if (!from.length) return set;
  const { w, h } = world;
  const dist = new Int16Array(w * h).fill(-1);
  const q = from.slice();
  for (const d of from) dist[d] = 0;
  const roads = new Set(from);
  while (q.length) {
    const i = q.shift();
    const d = dist[i];
    if (d >= maxRoad) continue;
    const tx = i % w;
    const ty = (i / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = tx + dx;
      const yy = ty + dy;
      if (!inBounds(world, xx, yy)) continue;
      const j = yy * w + xx;
      if (world.road[j] === ROAD.NONE || dist[j] !== -1) continue;
      dist[j] = d + 1;
      roads.add(j);
      q.push(j);
    }
  }
  // Every lot within ROAD_REACH of one of those road tiles.
  const n = w * h;
  for (let i = 0; i < n; i++) {
    if (world.zone[i] !== ZONE.R || world.tier[i] === 0) continue;
    for (const dr of doorsOf(world, i)) if (roads.has(dr)) { set.add(i); break; }
  }
  return set;
}

/**
 * A WEDDING'S MOVE (SPEC §7.2, the owner 2026-09-07): every member of `guest` moves into `host`'s
 * home and household the way placeHousehold moves a family — occupants, household ids, a stale
 * commute for anyone with a job, a MOVED chapter — and the guest household is gone. The host keeps
 * its surname (the cubs to come take it) and its species label. Returns false, touching nothing,
 * when the host's lot has no room. A household with a member in a pen is never a guest (the pen
 * keeps a return address): weddings() never offers one.
 */
export function joinHousehold(world, guest, host) {
  const present = guest.members.filter((id) => { const c = world.byId.get(id); return c && !c.dead; });
  if (capacityOf(world, host.home) - world.occupants[host.home] < present.length) return false;
  // The player's line (SPEC §7.8) is a gate on homes: nobody marries onto a lot that does not admit it.
  for (const id of present) if (!admits(world.use[host.home], world.byId.get(id).species)) return false;
  for (const id of present) {
    const c = world.byId.get(id);
    if (c.home >= 0) world.occupants[c.home]--;
    c.home = host.home;
    c.household = host.id;
    world.occupants[host.home]++;
    host.members.push(id);
    if (c.job >= 0) { c.path = null; c.stale = true; }
    remember(world, c, KIND.MOVED, host.home);
  }
  guest.members = [];
  guest.gone = true;
  world.hhById.delete(guest.id);
  world.campers = world.campers.filter((cp) => cp.householdId !== guest.id);
  world._removed = (world._removed || 0) + 1;
  return true;
}

/**
 * WEDDINGS (SPEC §7.2; the owner, 2026-09-07: "we need levers for both migration as well as
 * population growth"). A SINGLE — the only present adult of a housed household with nobody in a
 * pen — courts at WED_P a month within REHOME_RADIUS road tiles, the reach a cub uses to find its
 * first home. One courtship in WED_CROSS_P looks across the predator line ("about as rare as gay
 * villagers"); otherwise its own species, or anyone but predator and prey when none is in reach.
 * Among those the twelve temperaments weigh the choice (temper.js). Whichever lot has room hosts
 * the other household; no room, no wedding. One couple in WED_COMPANIONS_P are companions and
 * keep no litter. The two befriend and both get a WED chapter; story.js writes the line.
 * Every draw is from world.rng in household order, and nothing draws where nothing can happen:
 * fewer than two singles, no roll at all; nobody in reach, the courtship roll only; one
 * candidate, no choice draw.
 */
function weddings(world, out) {
  if (!(KNOBS.WED_P > 0)) return;
  const rng = world.rng;
  const singles = [];
  for (const hh of world.households) {
    if (hh.gone || hh.home < 0) continue;
    let adult = null;
    let adults = 0;
    let penned = false;
    for (const id of hh.members) {
      const c = world.byId.get(id);
      if (!c || c.dead) continue;
      if (c.pen) { penned = true; break; }
      if (absent(world, c)) continue;
      if (ageYears(world, c) >= KNOBS.ADULT_AGE) { adults++; adult = c; }
    }
    if (penned || adults !== 1) continue;
    singles.push({ c: adult, hh });
  }
  if (singles.length < 2) return;
  const taken = new Set();
  for (const s of singles) {
    if (taken.has(s.hh.id)) continue;
    if (!rng.chance(KNOBS.WED_P)) continue;
    const allowed = lotsWithinRoad(world, s.hh.home, KNOBS.REHOME_RADIUS);
    const near = singles.filter((o) => o !== s && !taken.has(o.hh.id) && allowed.has(o.hh.home));
    if (!near.length) continue;
    const cross = rng.chance(KNOBS.WED_CROSS_P);
    let pool = cross ? near.filter((o) => isPredPrey(s.c.species, o.c.species)) : [];
    if (!pool.length) pool = near.filter((o) => o.c.species === s.c.species);
    if (!pool.length) pool = near.filter((o) => !isPredPrey(s.c.species, o.c.species));
    if (!pool.length) continue;
    let o = pool[0];
    if (pool.length > 1) {
      const ts = temperOf(s.c);
      let total = 0;
      const weights = pool.map((cand) => { const wgt = compat(ts, temperOf(cand.c)); total += wgt; return wgt; });
      if (total > 0) {
        let r = rng.next() * total;
        o = pool[pool.length - 1];
        for (let k = 0; k < pool.length; k++) { r -= weights[k]; if (r <= 0) { o = pool[k]; break; } }
      }
    }
    const host = joinHousehold(world, s.hh, o.hh) ? o.hh : joinHousehold(world, o.hh, s.hh) ? s.hh : null;
    if (!host) continue;
    host.companions = rng.chance(KNOBS.WED_COMPANIONS_P);
    taken.add(s.hh.id);
    taken.add(o.hh.id);
    befriend(world, s.c, o.c, out);
    remember(world, s.c, KIND.WED, o.c.id);
    remember(world, o.c, KIND.WED, s.c.id);
    out.weddings++;
  }
}

/** R decay: displaced households seek another home, then a campsite. */
export function evictFromLot(world, i, newCap) {
  if (world.occupants[i] <= newCap) return;
  const hhs = [];
  for (const h of world.households) if (h.home === i && !h.gone) hhs.push(h);
  hhs.sort((a, b) => b.arrived - a.arrived || b.id - a.id);
  let allowed = null;
  for (const h of hhs) {
    if (world.occupants[i] <= newCap) break;
    const moving = detachPresent(world, h);
    if (!moving) continue;
    // Vacate.
    for (const id of moving.members) {
      const c = world.byId.get(id);
      c.home = -1;
      world.occupants[i]--;
    }
    moving.home = -1;
    if (!allowed) allowed = lotsWithinRoad(world, i, KNOBS.REHOME_RADIUS);
    const to = bestHome(world, householdSpecies(world, moving), moving.members.length, false, allowed);
    if (to >= 0) { placeHousehold(world, moving, to, to !== i); if (to !== i) for (const id of moving.members) remember(world, world.byId.get(id), KIND.MOVED, to); }
    else if (!startCamping(world, moving)) removeHousehold(world, moving, "evicted", i);
  }
}

/**
 * A MANSION rises (wealth.raiseMansion): every household on `tiles` but `keep`
 * is moved out — rehomed within REHOME_RADIUS road tiles of the window, never
 * onto the window itself, else a tent, else they leave (the eviction path, with
 * "displaced" for the record). Returns the number of animals moved out.
 */
export function displaceFrom(world, tiles, keep) {
  const set = new Set(tiles);
  let allowed = null;
  let displaced = 0;
  for (const h of world.households.filter((hh) => !hh.gone && set.has(hh.home) && hh !== keep)) {
    const from = h.home;
    const moving = detachPresent(world, h);
    if (!moving) continue;
    for (const id of moving.members) { const c = world.byId.get(id); c.home = -1; world.occupants[from]--; }
    moving.home = -1;
    if (!allowed) { allowed = lotsWithinRoad(world, tiles[0], KNOBS.REHOME_RADIUS); for (const j of tiles) allowed.delete(j); }
    displaced += moving.members.length;
    const to = bestHome(world, householdSpecies(world, moving), moving.members.length, false, allowed);
    if (to >= 0) { placeHousehold(world, moving, to); for (const id of moving.members) remember(world, world.byId.get(id), KIND.MOVED, to); }
    else if (!startCamping(world, moving)) removeHousehold(world, moving, "displaced", from);
  }
  return displaced;
}

/** C/I decay: workers beyond the new capacity lose the job, last hired first. */
export function fireFromLot(world, i, newCap) {
  if (world.staff[i] <= newCap) return;
  const ws = [];
  for (const c of world.citizens) if (c.job === i && !c.dead) ws.push(c);
  ws.sort((a, b) => b.hired - a.hired || b.id - a.id);
  for (const c of ws) {
    if (world.staff[i] <= newCap) break;
    releaseJob(world, c);
  }
}

/** Bulldozing a lot: everyone out. */
export function clearLot(world, i) {
  const hhs = world.households.filter((h) => h.home === i && !h.gone);
  for (const h of hhs) {
    const moving = detachPresent(world, h);
    if (!moving) continue;
    for (const id of moving.members) {
      const c = world.byId.get(id);
      c.home = -1;
      world.occupants[i]--;
    }
    moving.home = -1;
    const to = bestHome(world, householdSpecies(world, moving), moving.members.length, false);
    if (to >= 0) { placeHousehold(world, moving, to); for (const id of moving.members) remember(world, world.byId.get(id), KIND.MOVED, to); }
    else removeHousehold(world, moving, "bulldozed", i);
  }
  for (const c of world.citizens) if (c.job === i && !c.dead) releaseJob(world, c);
}

/** Any road edit: every commute is stale. */
export function invalidatePaths(world) {
  for (const c of world.citizens) if (c.path) { c.path = null; c.stale = true; }
}

// ---------------------------------------------------------------------------
// Arrival weights — the city's character is a readout of what was built
// ---------------------------------------------------------------------------

export function arrivalWeights(world, cen) {
  const n = world.w * world.h;
  let vacHigh = 0;
  let vacLV50 = 0;
  let vacLow = 0;
  let trees = 0;
  for (let i = 0; i < n; i++) {
    if (world.terrain[i] === TERRAIN.TREE) trees++;
    if (world.zone[i] !== ZONE.R || world.tier[i] === 0) continue;
    const vac = capacityOf(world, i) - world.occupants[i];
    if (vac <= 0) continue;
    if (world.tier[i] === 3) vacHigh += vac;
    if (world.lv[i] >= 50) vacLV50 += vac;
    if (world.tier[i] === 1 || world.maxTier[i] === 1) vacLow += vac;
  }
  const treeShare = trees / n;
  const vacTotal = Math.max(1, cen.vacantR);
  const smog = world.events.active.some((e) => e.id === "smogBank");
  // Vacancy-flavoured weights are SHARES of the vacancies, so no species can
  // run away just because the town is young and every lot is a cottage.
  const w = {
    rabbit: 1 + Math.min(1.5, 0.5 * cen.parks) + (treeShare > 0.12 ? 0.5 : 0),
    mouse: 1 + 2 * Math.min(1, vacHigh / vacTotal),
    fox: 1 + 1.5 * Math.min(1, vacLV50 / vacTotal),
    beaver: 1 + Math.min(2, cen.Ji / 100),
    owl: 1 + Math.min(1.5, treeShare * 5) + (cen.largeParks ? 1 : 0),
    bear: 1 + 1.0 * Math.min(1, vacLow / vacTotal) + Math.min(0.75, treeShare * 3),
    tortoise: 1,
    raccoon: (1 + Math.min(2, cen.meanPol / 10)) * (smog ? 2 : 1),
    // Livestock: pigs follow industry and dirt; cows follow pasture (Low lots + parks).
    // Pigs follow industry hard (the owner saw none): any works at all is a pull.
    pig: 1 + Math.min(2, cen.Ji / 40) + Math.min(1, cen.meanPol / 10) + (cen.Ji > 0 ? 0.75 : 0),
    // Skunks follow woods and dirt; nobody hunts them (they are in no PREY_OF list).
    skunk: 0.7 + Math.min(1.5, treeShare * 4) + Math.min(1, cen.meanPol / 12),
    cow: 1 + Math.min(1.5, 0.5 * cen.parks) + 1.0 * Math.min(1, vacLow / vacTotal),
    // Predators: wolves follow woods and a prey-rich town; cats follow shops and mice; hawks follow towers.
    wolf: 0.5 + Math.min(1.0, treeShare * 3) + (preyShare(cen, "wolf") >= 0.25 ? 0.5 : 0),
    cat: 1 + 1.0 * Math.min(1, vacLV50 / vacTotal) + Math.min(1, cen.Jc / 100) + (cen.shares.mouse >= 0.12 ? 0.75 : 0),
    hawk: 1 + 2 * Math.min(1, vacHigh / vacTotal),
  };
  for (const s of SPECIES) if (!ARRIVING.has(s.id)) w[s.id] = 0;
  // Meat halls: herbivores bend away from a town that has them, carnivores toward one that staffs them.
  const halls = cen.markets || 0;
  const jm = cen.Jm || 0;
  for (const s of SPECIES) {
    if (s.diet === "herb") w[s.id] *= 1 - KNOBS.MARKET_PUSH * Math.min(1, halls / 3);
    else if (s.diet === "carn") w[s.id] += KNOBS.MARKET_PULL * Math.min(1, jm / 40);
  }
  return w;
}

/** Share of the town that a predator species preys on. */
function preyShare(cen, pred) {
  let sh = 0;
  for (const [prey, preds] of Object.entries(PREY_OF)) if (preds.includes(pred)) sh += cen.shares[prey] || 0;
  return sh;
}

function pickSpecies(world, weights) {
  // A species with no weight entry counts as 0 (never NaN: a NaN total made
  // every arrival the last species in the table, silently). check.mjs
  // asserts every species has a weight.
  let total = 0;
  for (const s of SPECIES) total += weights[s.id] || 0;
  let r = world.rng.next() * total;
  for (const s of SPECIES) {
    r -= weights[s.id] || 0;
    if (r <= 0) return s.id;
  }
  return SPECIES[SPECIES.length - 1].id;
}

// ---------------------------------------------------------------------------
// The tick
// ---------------------------------------------------------------------------

/** Keep the household and citizen identities through a downturn. No free site means stay housed. */
export function startCamping(world, hh) {
  if (hh.gone || !hh.members.length || world.campers.some(cp => cp.householdId === hh.id)) return false;
  const members = hh.members.map(id => world.byId.get(id));
  if (members.some(c => !c || c.dead || absent(world, c))) return false;
  const cp = {id: world.nextId, name: "The " + hh.surname + " household", species: hh.species, kind: "camper", householdId: hh.id, since: world.tick};
  if (!addCamp(world, cp)) return false;
  world.nextId++;
  for (const c of members) {
    if (c.home >= 0) world.occupants[c.home]--;
    releaseJob(world, c);
    c.home = -1; c.path = null; c.stale = false;
  }
  hh.home = -1; hh.notice = 0;
  return true;
}

/** Resident camps never expire. Rehouse existing families before new arrivals. */
export function rehouseCampers(world) {
  let housed = 0;
  world.campers = world.campers.filter(cp => {
    if (!cp.householdId) return cp.until > world.tick;
    const hh = world.hhById.get(cp.householdId);
    if (!hh || hh.gone || !hh.members.length) return false;
    if (world.valves.R <= 0) return true;
    const lot = bestHome(world, householdSpecies(world, hh), hh.members.length, false);
    if (lot < 0) return true;
    placeHousehold(world, hh, lot);
    for (const id of hh.members) remember(world, world.byId.get(id), KIND.MOVED, lot);
    housed += hh.members.length;
    return false;
  });
  return housed;
}

// ---------------------------------------------------------------------------
// THE PUSH (SPEC §7.4; the owner, 2026-09-07: "migration should definitely be
// bidirectional. it should take more than just a fire for people to leave, it
// would have to be a combination of factors"). Nine grievances read at home
// each month, each yes or no, weighted — a lost job and a burned home acute
// (LEAVE_W_ACUTE), the rest chronic (LEAVE_W_CHRONIC). At LEAVE_THRESH a
// household may leave: p = LEAVE_P · (score − LEAVE_THRESH + 1) · roots a
// month, roots = 1 / (1 + years at this home / LEAVE_ROOTS_YEARS), × LEAVE_NATIVE_DAMP
// with a town-born adult under the roof. Nothing under the threshold draws: not
// a fire, not a lost job, not an empty friends list. A camping household reads
// the five that need no lot. FRICTION — a friendless house wandering off at
// 0.4% a month — is retired into this as one grievance. Measured before it
// landed (docs/PROPOSAL-GENERATIONS-AND-SKILLS-2026-09-07.md §10).
// ---------------------------------------------------------------------------

/** The nine, in the order the line names them. */
export const LEAVE_FACTORS = Object.freeze(["unemployed", "friendless", "lowMood", "crime", "smoke", "dread", "crowded", "taxed", "burned"]);
const LEAVE_ACUTE = new Set(["unemployed", "burned"]);
/** The reasons in prose, for the MOVED AWAY line — the player reads what to fix. */
export const LEAVE_REASONS = Object.freeze({ unemployed: "no work", friendless: "no friends", lowMood: "low spirits", crime: "the crime", smoke: "the smoke", dread: "the dread", crowded: "the crowding", taxed: "the taxes", burned: "the fire" });

/** The grievances at home this month: { score, reasons, f, present, adults }, or null with nobody present. Pure. */
export function leaveScore(world, hh, cen = world.last?.census) {
  const present = hh.members.map((id) => world.byId.get(id)).filter((c) => c && !c.dead && !absent(world, c));
  if (!present.length) return null;
  const home = hh.home;
  const adults = present.filter((c) => ageYears(world, c) >= KNOBS.ADULT_AGE);
  let mood = 0;
  for (const c of present) mood += c.mood;
  const f = {
    unemployed: adults.some((c) => isWorker(world, c) && c.job < 0),
    friendless: adults.length > 0 && adults.every((c) => c.friends.length === 0),
    lowMood: mood / present.length < KNOBS.LEAVE_MOOD_LOW,
    crime: home >= 0 && world.crime[home] > KNOBS.CRIME_HIGH,
    smoke: home >= 0 && world.pol[home] > SPECIES_BY_ID[hh.species].polTol,
    dread: home >= 0 && DIET_OF[hh.species] === "herb" && world.dread[home] >= KNOBS.REHOME_DREAD,
    crowded: home >= 0 && world.occupants[home] > capacityOf(world, home),
    taxed: world.rates.R > neutralRate(cen ? cen.P : 0) + KNOBS.LEAVE_TAX_OVER,
    burned: hh.burnedAt != null && world.tick - hh.burnedAt <= KNOBS.LEAVE_BURNED_MONTHS,
  };
  let score = 0;
  const reasons = [];
  for (const k of LEAVE_FACTORS) if (f[k]) { score += LEAVE_ACUTE.has(k) ? KNOBS.LEAVE_W_ACUTE : KNOBS.LEAVE_W_CHRONIC; reasons.push(k); }
  return { score, reasons, f, present, adults };
}

/** The month's chance of leaving, with its parts: { ...leaveScore, years, native, roots, p }. p is 0 under the threshold. Pure. */
export function leaveChance(world, hh, cen = world.last?.census) {
  const s = leaveScore(world, hh, cen);
  if (!s) return null;
  const years = Math.max(0, world.tick - (hh.homed ?? hh.arrived)) / 12;
  const native = s.adults.some((c) => c.native);
  const roots = (1 / (1 + years / KNOBS.LEAVE_ROOTS_YEARS)) * (native ? KNOBS.LEAVE_NATIVE_DAMP : 1);
  const p = s.score >= KNOBS.LEAVE_THRESH ? KNOBS.LEAVE_P * (s.score - KNOBS.LEAVE_THRESH + 1) * roots : 0;
  return { ...s, years, native, roots, p };
}

/** "the Burroweses", "the Slyfields" — a family by its surname, in the plural. */
export function theFamily(surname) {
  return `the ${surname}${/s$/.test(surname) ? "es" : "s"}`;
}

/** "no work, no friends and the smoke" */
export function leaveProse(reasons) {
  const words = reasons.map((k) => LEAVE_REASONS[k] || k);
  if (words.length <= 1) return words.join("");
  return `${words.slice(0, -1).join(", ")} and ${words[words.length - 1]}`;
}

export function citizensTick(world, cen, dem) {
  const out = { arrived: 0, left: 0, births: 0, weddings: 0, deaths: 0, notices: [], meetings: [], funerals: 0, littersLost: 0, rehomed: 0, zonedOut: 0, zonedOutLines: [], atThreshold: 0 };
  const rng = world.rng;
  const tick = world.tick;
  world.meetings = out.meetings;
  out.rehomed += rehouseCampers(world);

  // 0. No ghosts: a household whose home is no longer a standing R lot is
  //    rehomed, pitches a tent, or leaves (rubble, a road, a bulldoze that
  //    missed a step). A home on fire or in rubble stamps `hh.burnedAt` (SPEC
  //    §7.4: the push's `burned` grievance, carried through the rehome or the
  //    tent). The tent comes before the road, as it does for the evicted and
  //    the displaced — the owner (2026-09-07): "it should take more than just a
  //    fire for people to leave".
  for (const hh of world.households) {
    if (hh.gone || hh.home < 0) continue;
    const i = hh.home;
    if (world.burning[i] || world.rubble[i]) hh.burnedAt = tick;
    if (world.zone[i] === ZONE.R && world.tier[i] > 0 && !world.rubble[i]) continue;
    const moving = detachPresent(world, hh);
    if (!moving) continue;
    for (const id of moving.members) { const c = world.byId.get(id); c.home = -1; world.occupants[i]--; }
    moving.home = -1;
    const to = bestHome(world, householdSpecies(world, moving), moving.members.length, false);
    if (to >= 0) { placeHousehold(world, moving, to); for (const id of moving.members) remember(world, world.byId.get(id), KIND.MOVED, to); }
    else if (!startCamping(world, moving)) removeHousehold(world, moving, "homeless", i);
  }

  // 0b. The player's line (use-zoning, SPEC §7.8): a household whose lot no
  //     longer admits its species gets ZONED_OUT_MONTHS of notice, then rehomes
  //     within 12 road tiles under the gate or leaves town. Nobody moves in
  //     the month of the click, so a misclick and Z cost nothing.
  for (const hh of world.households) {
    if (hh.gone || hh.home < 0) continue;
    if (householdSpecies(world, hh).every((s) => admits(world.use[hh.home], s))) { hh.notice = 0; continue; } // every species under the roof (a wedding can mix two)
    if (!hh.members.some((id) => { const c = world.byId.get(id); return c && !c.dead && !c.pen; })) { hh.notice = 0; continue; }
    hh.notice = (hh.notice || 0) + 1;
    if (hh.notice < KNOBS.ZONED_OUT_MONTHS) continue;
    const from = hh.home;
    const moving = detachPresent(world, hh);
    if (!moving) continue;
    for (const id of moving.members) remember(world, world.byId.get(id), KIND.ZONED_OUT, from);
    const allowed = lotsWithinRoad(world, from, KNOBS.REHOME_RADIUS);
    allowed.delete(from);
    for (const id of moving.members) { const c = world.byId.get(id); c.home = -1; world.occupants[from]--; }
    moving.home = -1;
    const to = bestHome(world, householdSpecies(world, moving), moving.members.length, false, allowed);
    if (to >= 0) { placeHousehold(world, moving, to); for (const id of moving.members) remember(world, world.byId.get(id), KIND.MOVED, to); out.rehomed++; moving.notice = 0; }
    else {
      const n = moving.members.length;
      out.left += n;
      out.zonedOut += n;
      world.departures.push({ species: moving.species, surname: moving.surname, n, from });
      out.zonedOutLines.push(`ZONED OUT — ${theFamily(moving.surname)} (${n === 1 ? moving.species : `${n} ${pluralSpecies(moving.species)}`}) left (${from % world.w},${(from / world.w) | 0}): the lot is ${useName(world.use[from])} use-zoned land now, and nothing within twelve road tiles would have them.`);
      removeHousehold(world, moving, "zonedOut", from);
    }
  }

  // 1. Birthdays: adulthood (move out), retirement (release the job).
  for (const c of world.citizens) {
    if (c.dead) continue;
    if (c.pen) continue; // Part H matures the pen before birthdays; never split a held cub into a new household.
    const m = ageMonths(world, c);
    if (m % 12 !== 0 || m === 0) continue;
    const y = m / 12;
    const sp = SPECIES_BY_ID[c.species];
    if (y === KNOBS.ADULT_AGE) {
      // Split into a new household and look for a home within 12 road tiles.
      const hh = world.hhById.get(c.household);
      if (hh && hh.members.length > 1 && c.home >= 0) {
        const allowed = lotsWithinRoad(world, c.home, KNOBS.REHOME_RADIUS);
        allowed.delete(c.home);
        const to = bestHome(world, c.species, 1, false, allowed);
        if (to >= 0) {
          const k = hh.members.indexOf(c.id);
          hh.members.splice(k, 1);
          world.occupants[c.home]--;
          const nh = { id: world.nextHouseholdId++, members: [c.id], home: -1, species: c.species, surname: c.surname, arrived: tick };
          world.households.push(nh);
          world.hhById.set(nh.id, nh);
          c.household = nh.id;
          placeHousehold(world, nh, to);
          remember(world, c, KIND.LEFT_HOME, to);
        }
      }
    }
    if (y === sp.retire) { releaseJob(world, c); remember(world, c, KIND.RETIRED); }
  }

  // 2. Deaths, with the funeral rule.
  for (const c of world.citizens) {
    if (c.dead) continue;
    // Healthcare follows current home coverage, without accumulating saved credit.
    const home = c.home >= 0 && !absent(world, c) ? anchorOf(world, c.home) : -1;
    if (ageMonths(world, c) < c.deathAge * (1 + medicalLifespanModifier(world, home))) continue;
    const mourners = c.friends.slice();
    (world.naturalDeaths || (world.naturalDeaths = [])).push({
      id: c.id,
      name: `${c.name} ${c.surname}`,
      species: c.species,
      age: ageYears(world, c),
      home: c.home,
    });
    removeCitizen(world, c, "died");
    out.deaths++;
    holdFuneral(world, mourners, out);
  }

  // 3. Births: two fertile adults, headroom in the lot.
  let birthRoom = world.flags.campaign ? computeInfrastructure(world).food - world.citizens.filter(c => !c.dead).length : Infinity;
  const birthMult = world.events.active.reduce((m, e) => m * (e.birthMult || 1), 1);
  for (const hh of world.households) {
    if (hh.gone || hh.home < 0) continue;
    if (hh.companions) continue; // companions keep no litter (SPEC §7.2: one wedding in ten — the owner's "10% gay")
    const cap = capacityOf(world, hh.home);
    if (birthRoom <= 0) continue; // campaign food gate; the existing crowding rule still applies
    // A FULL home breeds at BIRTH_FULL_MULT and goes OVER capacity — the SPEC's crowding push toward a
    // storey (a fill above 1 satisfies FILL_TO_GROW), promised in §7.2 and unwired until the owner's
    // word on 2026-09-07. Nothing else lets occupants pass capacity; vacantR counts only true headroom.
    const full = world.occupants[hh.home] >= cap;
    if (full && !(KNOBS.BIRTH_FULL_MULT > 0)) continue; // at ×0 a full home draws NOTHING — the pre-2026-09-07 rule exactly (nothing draws where nothing can happen), so --set BIRTH_FULL_MULT=0 is the old sim to the byte
    let fertile = 0;
    let litter = 0;
    let parentSpecies = null;
    let fertileAge = 0;
    const parents = [];
    for (const id of hh.members) {
      const c = world.byId.get(id);
      const sp = SPECIES_BY_ID[c.species];
      const y = ageYears(world, c);
      if (y >= sp.fertile[0] && y <= sp.fertile[1]) {
        fertileAge++;
        if (c.fixed || absent(world, c)) continue; // fixed animals cannot have offspring (the owner); the held are away
        fertile++;
        parents.push(c);
        litter += sp.litter;
        if (!parentSpecies || rng.chance(0.5)) parentSpecies = c.species;
      }
    }
    if (fertile < 2) { if (fertileAge >= 2) out.littersLost++; continue; }
    const p = ((litter / fertile) / KNOBS.BIRTH_DIV) * birthMult * (full ? KNOBS.BIRTH_FULL_MULT : 1);
    if (rng.chance(p)) {
      const cub = newCitizen(world, parentSpecies, 0, hh.id, hh.surname, true);
      cub.home = hh.home;
      world.occupants[hh.home]++;
      hh.members.push(cub.id);
      world.citizens.push(cub);
      world.byId.set(cub.id, cub);
      remember(world, cub, KIND.BORN, hh.home);
      for (const parent of parents.slice(0, 2)) remember(world, parent, KIND.LITTER, 1);
      out.births++;
      birthRoom--;
    }
  }

  // 3a. Weddings (SPEC §7.2): a single adult courts within REHOME_RADIUS road tiles; the lot with room hosts.
  weddings(world, out);

  // 3b. The smell: a herbivore household inside a meat hall's dread may move
  //     along the road (LEAVE never fires at V_R > 0 — measured 0/360 ticks —
  //     so without this the owner's "herbivores do not like living near meat
  //     markets" would be a mood number only). Draws only where dread ≥ 40.
  for (const hh of world.households) {
    if (hh.gone || hh.home < 0 || DIET_OF[hh.species] !== "herb") continue;
    if (world.dread[hh.home] < KNOBS.REHOME_DREAD) continue;
    if (!rng.chance(KNOBS.REHOME_DREAD_P)) continue;
    const from = hh.home;
    const moving = detachPresent(world, hh);
    if (!moving) continue;
    const allowed = lotsWithinRoad(world, from, KNOBS.REHOME_RADIUS);
    allowed.delete(from);
    for (const id of moving.members) { const c = world.byId.get(id); c.home = -1; world.occupants[from]--; }
    moving.home = -1;
    const to = bestHome(world, householdSpecies(world, moving), moving.members.length, false, allowed);
    if (to >= 0 && world.dread[to] < world.dread[from]) { placeHousehold(world, moving, to); for (const id of moving.members) remember(world, world.byId.get(id), KIND.MOVED, to); out.rehomed++; }
    else placeHousehold(world, moving, from, false); // nowhere better: the same door, the same roots
  }

  // 4. Job search (≤ 64 per tick, id order, rotating start). Stale paths first.
  jobSearch(world, out);

  // 5. Arrivals (or campers), the scout.
  const food = world.flags.campaign ? computeInfrastructure(world).food : Infinity;
  let foodRoom = food - world.citizens.filter(c => !c.dead).length;
  const weights = arrivalWeights(world, cen);
  world.lastWeights = weights;
  if (world.valves.R > 0 && foodRoom > 0) {
    const vacantR = cen.vacantR;
    let households = Math.floor(KNOBS.ARRIVE_GAIN * world.valves.R * vacantR / KNOBS.ARRIVE_DIV + rng.next());
    if (vacantR === 0 && world.campers.length < KNOBS.CAMPERS_MAX && rng.chance(Math.min(0.9, world.valves.R))) {
      const species = pickSpecies(world, weights);
      addCamp(world, { id: world.nextId++, name: firstName(world, species) + " " + surname(world, species), species, kind: "camper", until: tick + KNOBS.CAMPER_TICKS });
    }
    for (let k = 0; k < households; k++) {
      const species = pickSpecies(world, weights);
      const pack = SPECIES_BY_ID[species].pack || [2, 4];
      const size = Math.min(foodRoom, pack[0] + rng.int(pack[1] - pack[0] + 1));
      if (size <= 0) break;
      const strict = true;
      let lot = bestHome(world, species, size, strict);
      if (lot < 0) lot = bestHome(world, species, size, false);
      if (lot < 0) break;
      const hh = createHousehold(world, species, size);
      placeHousehold(world, hh, lot);
      for (const id of hh.members) remember(world, world.byId.get(id), KIND.ARRIVED, lot);
      out.arrived += size;
      foodRoom -= size;
      if (world.mansion[lot]) out.notices.push(`THE ESTATE — the ${hh.surname}s (${size} ${pluralSpecies(species)}) have moved into the mansion at (${lot % world.w},${(lot / world.w) | 0}).`); // wealth (SPEC §9f)
      // For the walker layer: these animals walk in from the edge road.
      world.arrivals.push(...hh.members);
    }
    // Scout: a species whose weight is armed and which has no residents.
    if (world.campers.filter((c) => c.kind === "scout").length === 0) {
      for (const s of SPECIES) {
        if (weights[s.id] >= 2 && cen.counts[s.id] === 0 && rng.chance(0.5)) {
          world.campers.push({ id: world.nextId++, name: firstName(world, s.id) + " " + surname(world, s.id), species: s.id, kind: "scout", until: tick + 1 });
          break;
        }
      }
    }
  }
  world.campers = world.campers.filter((c) => c.householdId || c.until > tick);

  // 6. Departures: the downturn (a tent, SPEC §7.4 DOWNTURN) and the push
  //    (§7.4 PUSH; leaveChance above). Friction is gone — a friendless house is
  //    one grievance and moves nobody alone. Nothing draws under the threshold,
  //    so LEAVE_P 0 is the tree before the push, draw for draw.
  const VR = world.valves.R;
  for (const hh of world.households) {
    if (hh.gone || hh.members.length === 0) continue;
    const present = hh.members.map((id) => world.byId.get(id)).filter((c) => c && !c.dead && !absent(world, c));
    // A family whose only remaining member is in a hall pen has nobody at
    // home who can decide to leave, and must retain the household record.
    if (present.length === 0) continue;
    if (hh.home >= 0 && VR <= 0) {
      let unemployed = false;
      let friends = 0;
      let mood = 0;
      for (const c of present) {
        if (isWorker(world, c) && c.job < 0) unemployed = true;
        friends += c.friends.length;
        mood += c.mood;
      }
      const nM = present.length;
      const meanFriends = friends / nM;
      const meanMood = mood / nM;
      const p = (unemployed ? KNOBS.LEAVE_P_UNEMP : KNOBS.LEAVE_P_EMP) * -VR * (1 - KNOBS.LEAVE_FRIEND_DAMP * meanFriends) * (1.5 - meanMood / 100);
      const bear = hh.species === "bear" ? 1 / 1.5 : 1;
      if (p > 0 && rng.chance(Math.max(0, p * bear))) {
        if (startCamping(world, hh)) out.notices.push("CAMPING — the " + hh.surname + " household is staying in a tent until the economy and housing recover.");
        continue;
      }
    }
    const lc = leaveChance(world, hh, cen);
    if (!lc || lc.score < KNOBS.LEAVE_THRESH) continue;
    out.atThreshold++;
    if (!(lc.p > 0) || !rng.chance(lc.p)) continue;
    const n = present.length;
    out.left += n;
    world.departures = world.departures || [];
    world.departures.push({ species: hh.species, surname: hh.surname, n, from: hh.home, score: lc.score, reasons: lc.reasons.slice() }); // the walker layer reads the first four; the probe reads the score as it was decided
    const where = hh.home >= 0 ? `(${hh.home % world.w},${(hh.home / world.w) | 0})` : "their tent";
    out.notices.push(`MOVED AWAY — ${theFamily(hh.surname)} (${n === 1 ? hh.species : `${n} ${pluralSpecies(hh.species)}`}) left ${where}: ${leaveProse(lc.reasons)}.`);
    removeHousehold(world, hh, "left");
  }

  // 7. Friendships (200 samples, rotating window).
  friendships(world, out);

  // 8. Mood.
  moods(world);

  compact(world);
  return out;
}

// ---------------------------------------------------------------------------

/**
 * The funeral rule, in one place (deaths, killings): ≥ 3 mourners befriend
 * pairwise at FUNERAL_P — "they met at the wake" — and every mourner grieves
 * a year. `out` may be null (a killing has no tick summary to count into).
 */
export function holdFuneral(world, mourners, out) {
  const rng = world.rng;
  if (mourners.length >= 3) {
    if (out) out.funerals++;
    for (let a = 0; a < mourners.length; a++) {
      for (let b = a + 1; b < mourners.length; b++) {
        const x = world.byId.get(mourners[a]);
        const y = world.byId.get(mourners[b]);
        if (!x || !y || absent(world, x) || absent(world, y) || x.friends.includes(y.id)) continue;
        if (rng.chance(KNOBS.FUNERAL_P)) befriend(world, x, y, out);
      }
    }
  }
  for (const f of mourners) {
    const o = world.byId.get(f);
    if (o) o.grief = world.tick + 12;
  }
}

/** Affinity for a pair: a fixed predator is no longer wary company for its prey (0.7, not 0.4). */
function pairAffinity(a, b) {
  const temper = compat(temperOf(a), temperOf(b)); // the twelve temperaments (SPEC §7.11): kindred ×1.5, alike ×1.25, crossed ×0.5
  if ((isPredatorOf(a.species, b.species) && a.fixed) || (isPredatorOf(b.species, a.species) && b.fixed)) return KNOBS.FIXED_AFFINITY * temper;
  return affinity(a.species, b.species) * temper;
}

function befriend(world, a, b, out) {
  if (a.friends.includes(b.id)) return;
  a.friends.push(b.id);
  b.friends.push(a.id);
  remember(world, a, KIND.FRIEND, b.id);
  remember(world, b, KIND.FRIEND, a.id);
  if (a.friends.length > KNOBS.FRIEND_MAX) {
    const dropped = a.friends.shift();
    const o = world.byId.get(dropped);
    if (o) { const k = o.friends.indexOf(a.id); if (k >= 0) o.friends.splice(k, 1); }
  }
  if (b.friends.length > KNOBS.FRIEND_MAX) {
    const dropped = b.friends.shift();
    const o = world.byId.get(dropped);
    if (o) { const k = o.friends.indexOf(b.id); if (k >= 0) o.friends.splice(k, 1); }
  }
  if (out) out.meetings.push([a.id, b.id]);
}

function friendships(world, out) {
  const cs = world.citizens;
  const N = cs.length;
  if (N < 2) return;
  // Indices: by job, by home, by park.
  const byJob = new Map();
  const byHome = new Map();
  for (const c of cs) {
    if (c.dead || absent(world, c)) continue;
    if (c.job >= 0) { let l = byJob.get(c.job); if (!l) byJob.set(c.job, (l = [])); l.push(c); }
    if (c.home >= 0) { let l = byHome.get(c.home); if (!l) byHome.set(c.home, (l = [])); l.push(c); }
  }
  const { w } = world;
  const start = world._friendCursor || 0;
  const samples = Math.min(KNOBS.FRIEND_SAMPLES, N);
  const rng = world.rng;
  for (let k = 0; k < samples; k++) {
    const c = cs[(start + k) % N];
    if (c.dead || absent(world, c) || c.friends.length >= KNOBS.FRIEND_MAX) continue;
    let cand = null;
    const mode = rng.int(3);
    let parkBonus = 1;
    if (mode === 0 && c.job >= 0) {
      const l = byJob.get(c.job);
      if (l && l.length > 1) cand = rng.pick(l);
    } else if (mode === 1 && c.home >= 0) {
      const tx = c.home % w;
      const ty = (c.home / w) | 0;
      const dx = rng.int(3) - 1;
      const dy = rng.int(3) - 1;
      if (inBounds(world, tx + dx, ty + dy)) {
        const l = byHome.get((ty + dy) * w + tx + dx);
        if (l && l.length) cand = rng.pick(l);
      }
    } else if (mode === 2 && c.home >= 0) {
      // Park-goers: a park within 4 of both homes.
      const tx = c.home % w;
      const ty = (c.home / w) | 0;
      let park = -1;
      for (let dy = -4; dy <= 4 && park < 0; dy++) for (let dx = -4; dx <= 4; dx++) {
        const xx = tx + dx;
        const yy = ty + dy;
        if (inBounds(world, xx, yy) && world.civic[yy * w + xx] === CIVIC.PARK) { park = yy * w + xx; break; }
      }
      if (park >= 0) {
        const px = park % w;
        const py = (park / w) | 0;
        const hx = px + rng.int(9) - 4;
        const hy = py + rng.int(9) - 4;
        if (inBounds(world, hx, hy)) {
          const l = byHome.get(hy * w + hx);
          if (l && l.length) cand = rng.pick(l);
          parkBonus = 2;
        }
      }
    }
    if (!cand || cand === c || cand.dead || absent(world, cand) || cand.friends.length >= KNOBS.FRIEND_MAX || c.friends.includes(cand.id)) continue;
    const boost = world.events.active.reduce((m, e) => m * (e.friendMult || 1), 1);
    if (rng.chance(KNOBS.FRIEND_P * pairAffinity(c, cand) * parkBonus * boost * communityFactor(world,c,cand))) befriend(world, c, cand, out);
  }
  world._friendCursor = (start + samples) % N;
}

/** Build the shared neighbourhood scratch once when reading many citizens. */
export function moodContext(world) {
  // Who lives on each lot, per species: [all, threat]. threat = not fixed, not
  // held. PREY FLIGHT is proportional to the unfixed share of a predator
  // species in the 3×3 (measured: 5.2 adults of the feared kind beside every
  // afraid household — a per-species Set would let one fixed wolf out of a
  // pack change nothing).
  const lotSpecies = new Map();
  for (const c of world.citizens) {
    if (c.dead || c.home < 0) continue;
    let m = lotSpecies.get(c.home);
    if (!m) lotSpecies.set(c.home, (m = new Map()));
    let e = m.get(c.species);
    if (!e) m.set(c.species, (e = [0, 0]));
    e[0]++;
    if (!c.fixed && !absent(world, c)) e[1]++;
  }
  return {
    lotSpecies,
    wolfMoon: world.events.active.some((e) => e.id === "wolfMoon"),
    moodBoost: world.events.active.reduce((m, e) => m + (e.moodBoost || 0), 0),
  };
}

/**
 * The exact terms that make a citizen's mood, in arithmetic order. Needs,
 * cards and the town histogram read this function instead of copying rules.
 */
export function moodTerms(world, c, context = moodContext(world)) {
  const { w } = world;
  const { lotSpecies, wolfMoon, moodBoost } = context;
  const sp = SPECIES_BY_ID[c.species];
  const diet = DIET_OF[c.species];
  const terms = [{ code: "BASE", value: 50 }];
  if (c.job >= 0) terms.push({ code: "JOB", value: 15 });
  if (isWorker(world, c) && c.job < 0) terms.push({ code: "NO_JOB", value: -20 });

  // PREY FLIGHT: a predator of my kind next door (Chebyshev 1) costs mood,
  // unless I have a friend of that species — the bridge. Weights, never gates.
  let flight = 0;
  let flightSpecies = null;
  let flightSpeciesPts = -1;
  const preds = PREY_OF[c.species];
  if (preds && c.home >= 0) {
    const tx = c.home % w;
    const ty = (c.home / w) | 0;
    const near = new Map();
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = tx + dx;
      const yy = ty + dy;
      if (!inBounds(world, xx, yy)) continue;
      const m = lotSpecies.get(yy * w + xx);
      if (!m) continue;
      for (const p of preds) {
        const e = m.get(p);
        if (!e) continue;
        let s = near.get(p);
        if (!s) near.set(p, (s = [0, 0]));
        s[0] += e[0];
        s[1] += e[1];
      }
    }
    for (const [p, s] of near) {
      if (!s[1]) continue;
      let bridged = false;
      for (const f of c.friends) { const o = world.byId.get(f); if (o && o.species === p) { bridged = true; break; } }
      if (!bridged) {
        const points = KNOBS.PREY_FLIGHT * (s[1] / s[0]);
        flight += points;
        if (points > flightSpeciesPts) { flightSpeciesPts = points; flightSpecies = p; }
      }
    }
    if (wolfMoon && preds.includes("wolf")) {
      flight += KNOBS.PREY_FLIGHT;
      if (KNOBS.PREY_FLIGHT > flightSpeciesPts) { flightSpeciesPts = KNOBS.PREY_FLIGHT; flightSpecies = "wolf"; }
    }
  }

  if (c.home >= 0) {
    terms.push({ code: "SMOKE", value: -0.5 * Math.max(0, world.pol[c.home] - sp.polTol) });
    const tx = c.home % w;
    const ty = (c.home / w) | 0;
    let park = false;
    let van = false;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const xx = tx + dx;
      const yy = ty + dy;
      if (!inBounds(world, xx, yy)) continue;
      const civ = world.civic[yy * w + xx];
      if (!civ) continue;
      // Recreation reaches four tiles from any part of a park, measured at
      // home — and the centre's van from any part of the centre. A campus
      // part answers for its anchor (a Zoo's part is a Zoo's, and counts for
      // nothing here); until session 17 only the park branch resolved parts,
      // so a home beside a centre's far corner never felt the van.
      const owner = world.civic[civicAnchorOf(world, yy * w + xx)];
      if (owner === CIVIC.PARK || owner === CIVIC.LARGE_PARK) park = true;
      else if (owner === CIVIC.CENTRE) van = true;
    }
    if (park) terms.push({ code: "PARK", value: 10 });
    // CULTURE (SPEC §9e; the owner: "a boon to both happiness as well as
    // property desirability"): +4 under a Gallery, +8 under an Amphitheater,
    // the strongest at home and never the sum. This is the half an animal
    // can SAY; the half the town can measure is LV_CULTURE in the land value,
    // because mood alone is a dead end in a growing town (demand.js
    // capacityLaw says why). Children benefit too, though their floor of 50
    // hides it whenever it would matter.
    const culture = world.culture[c.home];
    if (culture) terms.push({ code: "CULTURE", value: KNOBS.CULTURE_MOOD[culture] });
    // The meat hall's dread: herbivores mind it (halved with a carnivore friend); carnivores like the smell.
    const dread = world.dread[c.home];
    if (dread > 0) {
      if (diet === "herb") {
        let carnFriend = false;
        for (const f of c.friends) { const o = world.byId.get(f); if (o && DIET_OF[o.species] === "carn") { carnFriend = true; break; } }
        const value = -Math.min(KNOBS.DREAD_MOOD_CAP, KNOBS.DREAD_MOOD_HERB * dread) * (carnFriend ? 0.5 : 1);
        terms.push({ code: "DREAD", value });
      } else if (diet === "carn") terms.push({ code: "DREAD", value: KNOBS.DREAD_CARN_MOOD });
    }
    if (van && diet === "carn") terms.push({ code: "VAN", value: -KNOBS.VAN_MOOD });
  }
  terms.push({ code: "FRIENDS", value: 5 * c.friends.length });
  if(foodRecipient(world,c))terms.push({code:"FOOD_AID",value:3});
  if(policy(world,'community'))terms.push({code:"COMMUNITY",value:2});
  terms.push({ code: "FLIGHT", arg: flightSpecies, value: -Math.min(20, flight) });
  if (c.home >= 0) terms.push({ code: "CRIME", value: -KNOBS.CRIME_MOOD * Math.max(0, world.crime[c.home] - KNOBS.CRIME_MOOD_FROM) });
  // WATCHED is CHARACTERISATION, not the brake — the brake is CAM_CAP in the
  // capacity law, because mood is a dead end in a growing town (demand.js
  // capacityLaw says why). This term exists so an animal can SAY what is
  // wrong on its Inspect card. The waiver is the owner's ruling: an animal
  // whose own door has been forced does not mind the camera on its street.
  if (c.home >= 0 && world.camCov[c.home] && !c.burgled) terms.push({ code: "WATCHED", value: -KNOBS.CAM_MOOD * (world.camCov[c.home] / KNOBS.CAM_EFFECT) });
  for (const e of world.events.active) {
    const value = e.moodBySpecies && e.moodBySpecies[c.species];
    if (value) terms.push({ code: "EVENT", arg: e.id, value });
  }
  if (c.path && commuteTime(c.path) <= sp.commute) terms.push({ code: "COMMUTE", value: 10 }); // a ride is KNOBS.RAIL_COST / WALK of a walk step
  if (world.flags.campaign && world.infrastructure?.food < world.infrastructure?.population) terms.push({ code: "FOOD", value: -20 });
  if (c.grief && c.grief > world.tick) terms.push({ code: "GRIEF", value: -10 });
  if (c.moodPenalty && c.moodPenaltyUntil > world.tick) terms.push({ code: "PENALTY", value: c.moodPenalty });
  if (c.fixed) terms.push({ code: "FIXED", value: -KNOBS.FIXED_MOOD });
  if (absent(world, c)) terms.push({ code: "HELD", value: -KNOBS.HELD_MOOD });
  terms.push({ code: "BOOST", value: moodBoost });
  return terms;
}

function moods(world) {
  const context = moodContext(world);
  for (const c of world.citizens) {
    if (c.dead || c.pen) continue; // a penned animal is away; its last street mood is frozen.
    const adult = ageYears(world, c) >= KNOBS.ADULT_AGE;
    const m = moodTerms(world, c, context).reduce((sum, term) => sum + term.value, 0);
    c.mood = Math.max(0, Math.min(100, Math.round(m)));
    if (!adult) c.mood = Math.max(c.mood, 50);
  }
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

/**
 * EVERY STALE COMMUTE, RE-PLANNED NOW. A path is stale when the thing at
 * either end changed shape (a merge, a split, a rehome) or when the ground
 * under it moved (a road drawn, a forecourt closed or REROUTED). It keeps its
 * job if the commute still exists and loses it if it does not.
 *
 * It is a FUNCTION because two callers need it, and the second one is the
 * reason: `tick.js`'s `settleDoors` runs once before the citizens and once
 * AFTER them, because `eventsTick` razes buildings and opens water at step 7.
 * An invalidation after the citizens have run would otherwise end the month
 * with every commute null - the straight run computing next month's traffic,
 * riders and mean commute from NO paths while a reload computes them from all
 * of them, because `save.rebuildDerived` re-plans unconditionally. `c.path` is
 * not in `canonicalCitizen`, so the hash at the boundary is equal and the two
 * cities part company a month later. A fourth hostile review measured it:
 * traffic 0 against 3796, and `ff0656b1` against `4a6abbbb` at 24 months.
 *
 * So the rule is simply: NOTHING MAY END A TICK STALE.
 */
export function replanStale(world, { release = true } = {}) {
  for (const c of world.citizens) {
    if (!c.stale || c.dead) continue;
    if (c.job < 0 || c.home < 0) { c.stale = false; continue; }
    // The player's line: a lot repainted against its workers releases them (they search again under the gate).
    const barred = !admits(world.use[c.job], c.species);
    const a = barred ? null : doorsOf(world, c.home);
    const b = barred ? null : doorsOf(world, c.job);
    const r = !barred && a.length && b.length ? commutePath(world, c.species, a, b) : null;
    const path = r ? r.path : null;
    if (path) { c.path = path; c.stale = false; continue; }
    // NO ROUTE. Whether that costs the animal its JOB is a policy, and it
    // belongs to the caller:
    //
    //   a TICK releases it. That is the rule: a workplace you can no longer
    //   reach is a workplace you no longer hold, and the job search runs in
    //   the same pass to find another.
    //
    //   an OP does not. `ops.apply` re-plans so that nothing READS a missing
    //   commute before the month turns - but firing at the op moves WHEN a job
    //   is lost out of the tick and into the click, and then an UNDO cannot
    //   give it back. Measured: one bulldozer press and Backspace took a town
    //   from 136 employed to 0 and left it there, where the same pair had been
    //   a hash-identical no-op. So the op leaves the animal STALE and the next
    //   tick decides, which is where the decision always lived.
    if (release) { c.stale = false; releaseJob(world, c); } else c.stale = true;
  }
}

function jobSearch(world, out) {
  const cs = world.citizens;
  const N = cs.length;
  if (!N) return;
  // Open jobs by door tile - EVERY door, because all sides of a workplace are
  // access points (SPEC 6c). A lot with roads north and south is listed twice;
  // searchJob scores it once, at whichever side the searcher reaches first.
  // Having a door at all IS access, so no separate test of it.
  const n = world.w * world.h;
  const openByDoor = new Map();
  const doorsByLot = new Map();
  for (let i = 0; i < n; i++) {
    const jobs = jobsOf(world, i);
    if (!jobs || world.staff[i] >= jobs || world.rubble[i] || world.burning[i]) continue;
    const doors = doorsOf(world, i);
    if (!doors.length) continue;
    doorsByLot.set(i, doors);
    for (const door of doors) {
      let l = openByDoor.get(door);
      if (!l) openByDoor.set(door, (l = []));
      l.push(i);
    }
  }
  const start = world._jobCursor || 0;
  let searches = 0;
  let looked = 0;
  replanStale(world); // stale paths first: keep the job if the commute still exists
  for (let k = 0; k < N && searches < KNOBS.JOB_SEARCHES; k++) {
    const c = cs[(start + k) % N];
    looked = k + 1;
    if (c.dead || c.home < 0 || c.job >= 0 || !isWorker(world, c)) continue;
    searches++;
    const doors = doorsOf(world, c.home);
    if (!doors.length) { c.jobless++; continue; }
    const sp = SPECIES_BY_ID[c.species];
    // Dial from EVERY door of the home, up to COMMUTE_MAX, scoring open jobs as
    // we reach them: the animal leaves by whichever side its work is on.
    const best = searchJob(world, doors, sp, openByDoor, world.rng);
    if (best) {
      c.job = best.lot;
      c.hired = world.tick;
      c.path = best.path;
      c.jobless = 0;
      world.staff[best.lot]++;
      remember(world, c, KIND.HIRED, best.lot);
      if (world.staff[best.lot] >= jobsOf(world, best.lot)) {
        for (const dd of doorsByLot.get(best.lot) || [best.door]) {
          const l = openByDoor.get(dd);
          if (!l) continue;
          const k2 = l.indexOf(best.lot);
          if (k2 >= 0) l.splice(k2, 1);
          if (!l.length) openByDoor.delete(dd);
        }
      }
    } else {
      c.jobless++;
    }
  }
  world._jobCursor = (start + looked) % N;
}

function searchJob(world, doors, sp, openByDoor, rng) {
  // Dial's buckets from the door (fields.js): a legal step WALK = 9, a step
  // onto a road the player's line forbids TRESPASS_STEP × WALK = 54 — so a
  // citizen takes a detour up to six times longer before it trespasses, and
  // trespasses when that is the
  // only way to work. With no use-zoning this is the BFS it replaced, node
  // for node (the suite holds every commuter's path to roadPath's).
  let best = null;
  let bestS = -Infinity;
  // A workplace with two doors is listed under both. Dial settles in cost
  // order, so the first door to reach it is its nearest one; score it there
  // and never again, or the second door would draw a second random weight and
  // could win with the longer walk.
  const scored = new Set();
  const { prev } = dial(world, sp.id, doors, KNOBS.COMMUTE_MAX * WALK, (i, c) => {
    const lots = openByDoor.get(i);
    if (!lots) return false;
    const d = c / WALK;
    for (const lot of lots) {
      if (scored.has(lot)) continue;
      scored.add(lot);
      if (!admits(world.use[lot], sp.id)) continue; // the player's line: not open to this species
      // A meat hall hires by diet (carnivores 0.9, omnivores 0.5, herbivores 0.1 — a weight: a rabbit takes the job when nothing else is open).
      const pref = world.zone[lot] === ZONE.M ? KNOBS.JOB_M[DIET_OF[sp.id]] : jobZone(world, lot) === ZONE.C ? sp.jobC : sp.jobI;
      const s = pref * (1 / (1 + d / sp.commute)) * (0.8 + 0.4 * rng.next());
      if (s > bestS) { bestS = s; best = { lot, door: i, d, cost: c }; }
    }
    return false;
  });
  if (!best) return null;
  best.path = nodePath(world, prev, best.door);
  return best;
}

/** Rebuild the id maps after load. */
export function rebuildMaps(world) {
  world.byId = new Map();
  world.hhById = new Map();
  for (const c of world.citizens) world.byId.set(c.id, c);
  for (const h of world.households) world.hhById.set(h.id, h);
}

export { bestHome, lotsWithinRoad };
