// citizens.js — the zoo. SPEC §7. Pure; imports cleanly in Node.
//
// Every animal is a record with a persistent home and job (the anti-GlassBox
// rule). Households own arrivals, births and departures. THE DANGLING-ID LAW:
// `removeCitizen` is the only way a citizen leaves the world and it scrubs
// every reference in the same call — friends' lists, the household, the
// occupant and staff counts. check.mjs recounts all of it.

import { KNOBS } from "./rules.js";
import { SPECIES, SPECIES_BY_ID, NAME_PARTS, affinity, ARRIVING, PREY_OF } from "./species.js";
import { ZONE, CIVIC, TERRAIN, ROAD, idx, inBounds, capacityOf, jobsOf, jobZone } from "./world.js";
import { roadPath, doorOf, edgeRoads, hasAccess } from "./fields.js";
import { ageYears, ageMonths, isWorker } from "./census.js";

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

function newCitizen(world, species, ageMonthsNow, household, surnameStr, native) {
  const sp = SPECIES_BY_ID[species];
  const u = world.rng.next();
  const c = {
    id: world.nextId++,
    name: firstName(world, species),
    surname: surnameStr,
    species,
    born: world.tick - ageMonthsNow,
    deathAge: Math.round(sp.life * 12 * (0.8 + 0.4 * u)),
    home: -1,
    job: -1,
    household,
    friends: [],
    mood: 50,
    jobless: 0,
    path: null,
    prefFails: 0,
    native: !!native,
    onLeave: false,
    hired: -1,
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

export function placeHousehold(world, hh, lot) {
  hh.home = lot;
  for (const id of hh.members) {
    const c = world.byId.get(id);
    c.home = lot;
    world.occupants[lot]++;
    // A new home means a new commute: the old path is from the old door.
    // (Found by the save/load hash: a rehomed family's stale path fed traffic.)
    if (c.job >= 0) { c.path = null; c.stale = true; }
  }
}

// ---------------------------------------------------------------------------
// Removal — the dangling-id law
// ---------------------------------------------------------------------------

export function removeCitizen(world, c, cause) {
  if (c.dead) return;
  c.dead = true;
  c.cause = cause;
  for (const f of c.friends) {
    const o = world.byId.get(f);
    if (o && !o.dead) {
      const k = o.friends.indexOf(c.id);
      if (k >= 0) o.friends.splice(k, 1);
    }
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
    }
  }
  world.byId.delete(c.id);
  world._removed = (world._removed || 0) + 1;
}

export function removeHousehold(world, hh, cause) {
  for (const id of hh.members.slice()) {
    const c = world.byId.get(id);
    if (c) removeCitizen(world, c, cause);
  }
}

/** Compact the arrays after a tick's removals. */
export function compact(world) {
  if (!world._removed) return;
  world.citizens = world.citizens.filter((c) => !c.dead);
  world.households = world.households.filter((h) => !h.gone);
  world._removed = 0;
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

/** How much a species likes a vacant R lot. `strict` honours the soft gates. */
function homeScore(world, species, i, strict) {
  const sp = SPECIES_BY_ID[species];
  const lv = world.lv[i];
  const pol = world.pol[i];
  let s = lv - pol * (1 - sp.polTol / 100);
  switch (sp.homePref) {
    case "high": if (world.maxTier[i] === 3 && world.tier[i] >= 2) s += 15; break;
    case "low": if (world.maxTier[i] === 1 || world.tier[i] === 1) s += 15; else if (strict) return -Infinity; break;
    case "lv50": if (lv >= 50) s += 20; else if (strict) return -Infinity; break;
    case "water": if (waterWithin(world, i, 6)) s += 15; break;
    case "trees": if (treeWithin(world, i, 3)) s += 15; break;
    case "pasture": if (world.maxTier[i] === 1 || world.tier[i] === 1) s += 10; if (parkWithin(world, i, 4)) s += 10; break;
    case "flats": if (world.tier[i] >= 2) s += 15; break;
    case "dirt": if (pol >= 15) s += 12; break;   // raccoons like it messy — they settle beside the pigs
    default: break;
  }
  return s;
}

/** Vacant R lots with room for `size`, optionally limited to a set of lots. */
function vacantLots(world, size, allowed = null) {
  const out = [];
  const n = world.w * world.h;
  for (let i = 0; i < n; i++) {
    if (world.zone[i] !== ZONE.R || world.tier[i] === 0) continue;
    if (allowed && !allowed.has(i)) continue;
    if (capacityOf(world, i) - world.occupants[i] >= size) out.push(i);
  }
  return out;
}

function bestHome(world, species, size, strict, allowed = null) {
  let best = -1;
  let bestS = -Infinity;
  for (const i of vacantLots(world, size, allowed)) {
    const s = homeScore(world, species, i, strict);
    if (s > bestS) { bestS = s; best = i; }
  }
  return best;
}

/** Lots whose door is within `maxRoad` road tiles of `fromLot`'s door. */
function lotsWithinRoad(world, fromLot, maxRoad) {
  const door = doorOf(world, fromLot);
  const set = new Set();
  if (door == null) return set;
  const { w, h } = world;
  const dist = new Int16Array(w * h).fill(-1);
  const q = [door];
  dist[door] = 0;
  const roads = new Set([door]);
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
    const dr = doorOf(world, i);
    if (dr != null && roads.has(dr)) set.add(i);
  }
  return set;
}

/** R decay: households beyond the new capacity rehome within 12 road tiles or leave. */
export function evictFromLot(world, i, newCap) {
  if (world.occupants[i] <= newCap) return;
  const hhs = [];
  for (const h of world.households) if (h.home === i && !h.gone) hhs.push(h);
  hhs.sort((a, b) => b.arrived - a.arrived || b.id - a.id);
  let allowed = null;
  for (const h of hhs) {
    if (world.occupants[i] <= newCap) break;
    // Vacate.
    for (const id of h.members) {
      const c = world.byId.get(id);
      c.home = -1;
      world.occupants[i]--;
    }
    h.home = -1;
    if (!allowed) allowed = lotsWithinRoad(world, i, KNOBS.REHOME_RADIUS);
    const to = bestHome(world, h.species, h.members.length, false, allowed);
    if (to >= 0) placeHousehold(world, h, to);
    else removeHousehold(world, h, "evicted");
  }
}

/** C/I decay: workers beyond the new capacity lose the job, last hired first. */
export function fireFromLot(world, i, newCap) {
  if (world.staff[i] <= newCap) return;
  const ws = [];
  for (const c of world.citizens) if (c.job === i && !c.dead) ws.push(c);
  ws.sort((a, b) => b.hired - a.hired || b.id - a.id);
  for (const c of ws) {
    if (world.staff[i] <= newCap) break;
    c.job = -1;
    c.path = null;
    c.hired = -1;
    world.staff[i]--;
  }
}

/** Bulldozing a lot: everyone out. */
export function clearLot(world, i) {
  const hhs = world.households.filter((h) => h.home === i && !h.gone);
  for (const h of hhs) {
    for (const id of h.members) {
      const c = world.byId.get(id);
      c.home = -1;
      world.occupants[i]--;
    }
    h.home = -1;
    const to = bestHome(world, h.species, h.members.length, false);
    if (to >= 0) placeHousehold(world, h, to);
    else removeHousehold(world, h, "bulldozed");
  }
  for (const c of world.citizens) {
    if (c.job === i && !c.dead) {
      c.job = -1;
      c.path = null;
      c.hired = -1;
      world.staff[i]--;
    }
  }
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
    owl: 1 + Math.min(1.5, treeShare * 5) + (cen.zoos ? 1 : 0),
    bear: 1 + 1.0 * Math.min(1, vacLow / vacTotal) + Math.min(0.75, treeShare * 3),
    tortoise: 1,
    raccoon: (1 + Math.min(2, cen.meanPol / 10)) * (smog ? 2 : 1),
    // Livestock: pigs follow industry and dirt; cows follow pasture (Low lots + parks).
    pig: 1 + Math.min(2, cen.Ji / 80) + Math.min(1, cen.meanPol / 15),
    cow: 1 + Math.min(1.5, 0.5 * cen.parks) + 1.0 * Math.min(1, vacLow / vacTotal),
    // Predators: wolves follow woods and a prey-rich town; cats follow shops and mice; hawks follow towers.
    wolf: 0.5 + Math.min(1.0, treeShare * 3) + (preyShare(cen, "wolf") >= 0.25 ? 0.5 : 0),
    cat: 1 + 1.0 * Math.min(1, vacLV50 / vacTotal) + Math.min(1, cen.Jc / 100) + (cen.shares.mouse >= 0.12 ? 0.75 : 0),
    hawk: 1 + 2 * Math.min(1, vacHigh / vacTotal),
  };
  for (const s of SPECIES) if (!ARRIVING.has(s.id)) w[s.id] = 0;
  return w;
}

/** Share of the town that a predator species preys on. */
function preyShare(cen, pred) {
  let sh = 0;
  for (const [prey, preds] of Object.entries(PREY_OF)) if (preds.includes(pred)) sh += cen.shares[prey] || 0;
  return sh;
}

function pickSpecies(world, weights) {
  let total = 0;
  for (const s of SPECIES) total += weights[s.id];
  let r = world.rng.next() * total;
  for (const s of SPECIES) {
    r -= weights[s.id];
    if (r <= 0) return s.id;
  }
  return SPECIES[SPECIES.length - 1].id;
}

// ---------------------------------------------------------------------------
// The tick
// ---------------------------------------------------------------------------

export function citizensTick(world, cen, dem) {
  const out = { arrived: 0, left: 0, births: 0, deaths: 0, notices: [], meetings: [], funerals: 0 };
  const rng = world.rng;
  const tick = world.tick;
  world.meetings = out.meetings;

  // 1. Birthdays: adulthood (move out), retirement (release the job).
  for (const c of world.citizens) {
    if (c.dead) continue;
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
        }
      }
    }
    if (y === sp.retire && c.job >= 0) {
      world.staff[c.job]--;
      c.job = -1;
      c.path = null;
    }
  }

  // 2. Deaths, with the funeral rule.
  for (const c of world.citizens) {
    if (c.dead) continue;
    if (ageMonths(world, c) < c.deathAge) continue;
    const mourners = c.friends.slice();
    removeCitizen(world, c, "died");
    out.deaths++;
    if (mourners.length >= 3) {
      out.funerals++;
      for (let a = 0; a < mourners.length; a++) {
        for (let b = a + 1; b < mourners.length; b++) {
          const x = world.byId.get(mourners[a]);
          const y = world.byId.get(mourners[b]);
          if (!x || !y || x.friends.includes(y.id)) continue;
          if (rng.chance(KNOBS.FUNERAL_P)) befriend(world, x, y, out);
        }
      }
    }
    for (const f of mourners) {
      const o = world.byId.get(f);
      if (o) o.grief = tick + 12;
    }
  }

  // 3. Births: two fertile adults, headroom in the lot.
  const birthMult = world.events.active.reduce((m, e) => m * (e.birthMult || 1), 1);
  for (const hh of world.households) {
    if (hh.gone || hh.home < 0) continue;
    const cap = capacityOf(world, hh.home);
    if (world.occupants[hh.home] >= cap) continue;
    let fertile = 0;
    let litter = 0;
    let parentSpecies = null;
    for (const id of hh.members) {
      const c = world.byId.get(id);
      const sp = SPECIES_BY_ID[c.species];
      const y = ageYears(world, c);
      if (y >= sp.fertile[0] && y <= sp.fertile[1]) {
        fertile++;
        litter += sp.litter;
        if (!parentSpecies || rng.chance(0.5)) parentSpecies = c.species;
      }
    }
    if (fertile < 2) continue;
    const p = ((litter / fertile) / KNOBS.BIRTH_DIV) * birthMult;
    if (rng.chance(p)) {
      const cub = newCitizen(world, parentSpecies, 0, hh.id, hh.surname, true);
      cub.home = hh.home;
      world.occupants[hh.home]++;
      hh.members.push(cub.id);
      world.citizens.push(cub);
      world.byId.set(cub.id, cub);
      out.births++;
    }
  }

  // 4. Job search (≤ 64 per tick, id order, rotating start). Stale paths first.
  jobSearch(world, out);

  // 5. Arrivals (or campers), the scout.
  const weights = arrivalWeights(world, cen);
  world.lastWeights = weights;
  if (world.valves.R > 0) {
    const vacantR = cen.vacantR;
    let households = Math.floor(KNOBS.ARRIVE_GAIN * world.valves.R * vacantR / KNOBS.ARRIVE_DIV + rng.next());
    if (vacantR === 0 && world.campers.length < KNOBS.CAMPERS_MAX && rng.chance(Math.min(0.9, world.valves.R))) {
      const species = pickSpecies(world, weights);
      world.campers.push({ id: world.nextId++, name: firstName(world, species) + " " + surname(world, species), species, kind: "camper", until: tick + KNOBS.CAMPER_TICKS });
    }
    for (let k = 0; k < households; k++) {
      const species = pickSpecies(world, weights);
      const pack = SPECIES_BY_ID[species].pack || [2, 4];
      const size = pack[0] + rng.int(pack[1] - pack[0] + 1);
      const strict = true;
      let lot = bestHome(world, species, size, strict);
      if (lot < 0) lot = bestHome(world, species, size, false);
      if (lot < 0) break;
      const hh = createHousehold(world, species, size);
      placeHousehold(world, hh, lot);
      out.arrived += size;
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
  world.campers = world.campers.filter((c) => c.until > tick);

  // 6. Departures and friction (per household).
  const VR = world.valves.R;
  for (const hh of world.households) {
    if (hh.gone || hh.home < 0 || hh.members.length === 0) continue;
    let unemployed = false;
    let friends = 0;
    let mood = 0;
    let friendless = 0;
    let adults = 0;
    for (const id of hh.members) {
      const c = world.byId.get(id);
      const worker = isWorker(world, c);
      if (worker && c.job < 0) unemployed = true;
      friends += c.friends.length;
      mood += c.mood;
      if (ageYears(world, c) >= KNOBS.ADULT_AGE) {
        adults++;
        if (c.friends.length === 0) friendless++;
      }
    }
    const nM = hh.members.length;
    const meanFriends = friends / nM;
    const meanMood = mood / nM;
    let p = 0;
    if (VR <= 0) {
      p = (unemployed ? KNOBS.LEAVE_P_UNEMP : KNOBS.LEAVE_P_EMP) * -VR * (1 - KNOBS.LEAVE_FRIEND_DAMP * meanFriends) * (1.5 - meanMood / 100);
    }
    if (adults > 0 && friendless === adults) p += KNOBS.FRICTION_P;
    const bear = hh.species === "bear" ? 1 / 1.5 : 1;
    if (p > 0 && rng.chance(Math.max(0, p * bear))) {
      out.left += nM;
      world.departures = world.departures || [];
      world.departures.push({ species: hh.species, surname: hh.surname, n: nM, from: hh.home });
      removeHousehold(world, hh, "left");
    }
  }

  // 7. Friendships (200 samples, rotating window).
  friendships(world, out);

  // 8. Mood.
  moods(world);

  compact(world);
  return out;
}

// ---------------------------------------------------------------------------

function befriend(world, a, b, out) {
  if (a.friends.includes(b.id)) return;
  a.friends.push(b.id);
  b.friends.push(a.id);
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
    if (c.dead) continue;
    if (c.job >= 0) { let l = byJob.get(c.job); if (!l) byJob.set(c.job, (l = [])); l.push(c); }
    if (c.home >= 0) { let l = byHome.get(c.home); if (!l) byHome.set(c.home, (l = [])); l.push(c); }
  }
  const { w } = world;
  const start = world._friendCursor || 0;
  const samples = Math.min(KNOBS.FRIEND_SAMPLES, N);
  const rng = world.rng;
  for (let k = 0; k < samples; k++) {
    const c = cs[(start + k) % N];
    if (c.dead || c.friends.length >= KNOBS.FRIEND_MAX) continue;
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
    if (!cand || cand === c || cand.dead || cand.friends.length >= KNOBS.FRIEND_MAX || c.friends.includes(cand.id)) continue;
    const boost = world.events.active.reduce((m, e) => m * (e.friendMult || 1), 1);
    if (rng.chance(KNOBS.FRIEND_P * affinity(c.species, cand.species) * parkBonus * boost)) befriend(world, c, cand, out);
  }
  world._friendCursor = (start + samples) % N;
}

function moods(world) {
  const { w } = world;
  const moodBoost = world.events.active.reduce((m, e) => m + (e.moodBoost || 0), 0);
  // Which species live on each lot (for the prey-flight rule).
  const lotSpecies = new Map();
  for (const c of world.citizens) {
    if (c.dead || c.home < 0) continue;
    let set = lotSpecies.get(c.home);
    if (!set) lotSpecies.set(c.home, (set = new Set()));
    set.add(c.species);
  }
  const wolfMoon = world.events.active.some((e) => e.id === "wolfMoon");
  for (const c of world.citizens) {
    if (c.dead) continue;
    const sp = SPECIES_BY_ID[c.species];
    // PREY FLIGHT: a predator of my kind next door (Chebyshev 1) costs mood,
    // unless I have a friend of that species — the bridge. Weights, never gates.
    let flight = 0;
    const preds = PREY_OF[c.species];
    if (preds && c.home >= 0) {
      const tx = c.home % w;
      const ty = (c.home / w) | 0;
      const near = new Set();
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = tx + dx;
        const yy = ty + dy;
        if (!inBounds(world, xx, yy)) continue;
        const set = lotSpecies.get(yy * w + xx);
        if (set) for (const p of preds) if (set.has(p)) near.add(p);
      }
      for (const p of near) {
        let bridged = false;
        for (const f of c.friends) { const o = world.byId.get(f); if (o && o.species === p) { bridged = true; break; } }
        if (!bridged) flight += KNOBS.PREY_FLIGHT;
      }
      if (wolfMoon && preds.includes("wolf")) flight += KNOBS.PREY_FLIGHT;
    }
    const adult = ageYears(world, c) >= KNOBS.ADULT_AGE;
    const worker = isWorker(world, c);
    let m = 50;
    if (c.job >= 0) m += 15;
    if (worker && c.job < 0) m -= 20;
    if (c.home >= 0) {
      m -= 0.5 * Math.max(0, world.pol[c.home] - sp.polTol);
      const tx = c.home % w;
      const ty = (c.home / w) | 0;
      let park = false;
      for (let dy = -4; dy <= 4 && !park; dy++) for (let dx = -4; dx <= 4; dx++) {
        const xx = tx + dx;
        const yy = ty + dy;
        if (inBounds(world, xx, yy) && world.civic[yy * w + xx] === CIVIC.PARK) { park = true; break; }
      }
      if (park) m += 10;
    }
    m += 5 * c.friends.length;
    m -= Math.min(20, flight);
    if (c.path && c.path.length - 1 <= sp.commute) m += 10;
    if (c.grief && c.grief > world.tick) m -= 10;
    if (c.moodPenalty && c.moodPenaltyUntil > world.tick) m += c.moodPenalty;
    m += moodBoost;
    c.mood = Math.max(0, Math.min(100, Math.round(m)));
    if (!adult) c.mood = Math.max(c.mood, 50);
  }
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

function jobSearch(world, out) {
  const cs = world.citizens;
  const N = cs.length;
  if (!N) return;
  // Open jobs by door tile.
  const n = world.w * world.h;
  const openByDoor = new Map();
  for (let i = 0; i < n; i++) {
    const jobs = jobsOf(world, i);
    if (!jobs || world.staff[i] >= jobs || world.rubble[i] || world.burning[i]) continue;
    if (!hasAccess(world, i)) continue;
    const door = doorOf(world, i);
    if (door == null) continue;
    let l = openByDoor.get(door);
    if (!l) openByDoor.set(door, (l = []));
    l.push(i);
  }
  const start = world._jobCursor || 0;
  let searches = 0;
  let looked = 0;
  // Stale paths first: keep the job if the commute still exists.
  for (const c of cs) {
    if (!c.stale || c.dead) continue;
    c.stale = false;
    if (c.job < 0 || c.home < 0) continue;
    const a = doorOf(world, c.home);
    const b = doorOf(world, c.job);
    const path = a != null && b != null ? roadPath(world, a, b) : null;
    if (path) c.path = path;
    else {
      world.staff[c.job]--;
      c.job = -1;
      c.hired = -1;
      c.path = null;
    }
  }
  for (let k = 0; k < N && searches < KNOBS.JOB_SEARCHES; k++) {
    const c = cs[(start + k) % N];
    looked = k + 1;
    if (c.dead || c.home < 0 || c.job >= 0 || !isWorker(world, c)) continue;
    searches++;
    const door = doorOf(world, c.home);
    if (door == null) { c.jobless++; continue; }
    const sp = SPECIES_BY_ID[c.species];
    // BFS over roads from the door, up to COMMUTE_MAX, scoring open jobs as we reach them.
    const best = searchJob(world, door, sp, openByDoor, world.rng);
    if (best) {
      c.job = best.lot;
      c.hired = world.tick;
      c.path = best.path;
      c.jobless = 0;
      world.staff[best.lot]++;
      if (world.staff[best.lot] >= jobsOf(world, best.lot)) {
        const l = openByDoor.get(best.door);
        if (l) { const k2 = l.indexOf(best.lot); if (k2 >= 0) l.splice(k2, 1); if (!l.length) openByDoor.delete(best.door); }
      }
    } else {
      c.jobless++;
    }
  }
  world._jobCursor = (start + looked) % N;
}

function searchJob(world, door, sp, openByDoor, rng) {
  const { w, h } = world;
  const n = w * h;
  const dist = world._jdist || (world._jdist = new Int16Array(n));
  const prev = world._jprev || (world._jprev = new Int32Array(n));
  dist.fill(-1);
  const q = world._jqueue || (world._jqueue = new Int32Array(n));
  let head = 0;
  let tail = 0;
  dist[door] = 0;
  prev[door] = -1;
  q[tail++] = door;
  let best = null;
  let bestS = -Infinity;
  while (head < tail) {
    const i = q[head++];
    const d = dist[i];
    const lots = openByDoor.get(i);
    if (lots) {
      for (const lot of lots) {
        const pref = jobZone(world, lot) === ZONE.C ? sp.jobC : sp.jobI;
        const s = pref * (1 / (1 + d / sp.commute)) * (0.8 + 0.4 * rng.next());
        if (s > bestS) { bestS = s; best = { lot, door: i, d }; }
      }
    }
    if (d >= KNOBS.COMMUTE_MAX) continue;
    const tx = i % w;
    const ty = (i / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = tx + dx;
      const yy = ty + dy;
      if (!inBounds(world, xx, yy)) continue;
      const j = yy * w + xx;
      if (world.road[j] === ROAD.NONE || dist[j] !== -1) continue;
      dist[j] = d + 1;
      prev[j] = i;
      q[tail++] = j;
    }
  }
  if (!best) return null;
  const path = new Uint16Array(best.d + 1);
  let k = best.door;
  for (let s = best.d; s >= 0; s--) { path[s] = k; k = prev[k]; }
  best.path = path;
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
