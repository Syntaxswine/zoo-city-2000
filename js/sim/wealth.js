// wealth.js — WEALTH AND CLASS: the ladder, the estate and its mansion. SPEC §9f;
// docs/PROPOSAL-WEALTH-AND-CLASS-2026-09-05.md. Pure; imports cleanly in Node.
//
// The owner (2026-09-05): "culture will be a boon to both happiness as well as
// property desirability, but later when we start getting into wealth/class it
// will be a prerequisite to more affluent housing. the ultrawealthy want to
// have a 3x3 plot next to everything, they will need their own sprites too
// for their mansions. any theft from the ultrawealthy gets priority policing
// and one step harsher punishment."
//
// CLASS IS A PROPERTY OF A HOUSEHOLD, decided ONCE, by the lot it arrives at:
// hh.wealth 0 modest · 1 affluent · 2 ultrawealthy, saved beside the surname
// and omitted when 0, so a town in which no lot has ever attained a class
// hashes exactly as it did before this file existed. A family keeps its class
// for life and its cubs inherit it; a family that later moves to a lesser lot
// stays what it was — old money in a cottage is a story, not a bug. Species is
// untouched: a wealthy skunk is allowed, and the weights that pick who arrives
// know nothing about money. Why the lot and not the job: the game has no wages,
// and the lot is the owner's own framing ("a plot next to everything").
//
// THE LADDER. A lot has an ATTAINABLE class: the highest rung every one of
// whose prerequisites its own fields meet, read on the anchor tile as every
// home rule reads (a block's residents are all on its anchor). The owner's word
// was PREREQUISITE, so these are GATES and not weights — the weights-never-
// gates law is about species and stays about species. Every number is a KNOB
// (rules.js CLASS_*), and every rung is a field the game already computes:
// culture and knowledge (SPEC §9e), a park within 4 (the PARK mood term's own
// test), a shop within so many road tiles (the rehoming search's shape), the
// air, the streets, the smell, the land value, and water or trees beside the
// plot (land value's own nature8). `attainableClass` returns the class AND the
// unmet rungs of the next one, in the words the card, the wish and the Census
// share, so an empty estate is a to-do list and never a mystery.
//
// THE ESTATE. The ultrawealthy live in a MANSION, and a mansion is a plot the
// player provides: a 3×3 residential plot placed like a campus (ops.js
// "estate": atomic, clear ground, a road touching, §COST.estate), stored as an
// R block anchor — world.big 3, its parts PART | dx | dy << 2 — with
// world.estate[anchor] = PLOT (chalk, waiting). It is chalk until the plot's
// attainable class is ULTRAWEALTHY; then, and only then, it SPROUTS (estatesTick
// — no roll, no RNG, the month the last rung is met): estate = MANSION, tier 3
// on every tile so every "is this built" test says yes, and capacity
// MANSION_CAP for ONE household (world.capacityOf). It never grows, decays or
// merges by the ordinary rule (lots.lotScore hands it straight back here); fire,
// flood and the bulldozer take it as a block — every tile at once — and when
// the mansion comes down the plot is a plot again (unbuildMansion, through
// blocks.splitLot), chalk that may sprout again. The other way a mansion could
// come to be — growth absorbing and displacing eight neighbours — is the
// owner's call and is NOT built (the proposal's §8.3).
//
// JUSTICE lives in justice.js and reads three things from here: the class at a
// burgled address (classAt — the richest household there, since a tenement's
// door is one door), a killing's victim's class (classOfCitizen) and the name
// of an estate for the lines. The owner's "priority policing" is PROBABILITY
// AND TIME, never order — files roll independently every month, so "worked
// first" cannot mean queue order — and the "one step harsher" is one step up
// the sentence table for a theft from an estate.

import { KNOBS } from "./rules.js";
import { ZONE, CIVIC, ROAD, TERRAIN, inBounds, anchorOf, footprintOf, civicAnchorOf, isPart } from "./world.js";
import { served, doorsOf } from "./fields.js";

export const CLASS = Object.freeze({ MODEST: 0, AFFLUENT: 1, ULTRAWEALTHY: 2 });
export const CLASS_NAME = Object.freeze(["modest", "affluent", "ultrawealthy"]);
/** world.estate[anchor]: 0 nothing · 1 an estate plot, chalk, waiting · 2 the mansion standing. */
export const ESTATE = Object.freeze({ NONE: 0, PLOT: 1, MANSION: 2 });

/** A household's class; 0 for one with none recorded (every household saved before this arc). */
export const wealthOf = (hh) => (hh && hh.wealth) | 0;

/** The class of the household a citizen belongs to; 0 when it has none or the household is gone. */
export function classOfCitizen(world, c) {
  return wealthOf(world.hhById && world.hhById.get(c.household));
}

/** The highest class living at an address — a tenement holds several households and one door; the richest sets the file's priority. */
export function classAt(world, lot) {
  const a = anchorOf(world, lot);
  let best = 0;
  for (const hh of world.households) if (!hh.gone && hh.home === a && wealthOf(hh) > best) best = wealthOf(hh);
  return best;
}

/** Any tile of an estate — plot or mansion. */
export const isEstateTile = (world, i) => world.estate[anchorOf(world, i)] > 0;
/** Any tile of a standing mansion. */
export const isMansion = (world, i) => world.estate[anchorOf(world, i)] === ESTATE.MANSION;

/** A Park or Large Park within `r` of tile i, any tile of the campus counting — the PARK mood term's own test, from the home tile. */
function parkWithin(world, i, r) {
  const { w } = world;
  const tx = i % w;
  const ty = (i / w) | 0;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const xx = tx + dx;
    const yy = ty + dy;
    if (!inBounds(world, xx, yy)) continue;
    const j = yy * w + xx;
    if (!world.civic[j]) continue;
    const owner = world.civic[civicAnchorOf(world, j)];
    if (owner === CIVIC.PARK || owner === CIVIC.LARGE_PARK) return true;
  }
  return false;
}

/** Water or trees among the eight neighbours of tile i — land value's own nature8 (fields.computeLandValue). */
export function nature8(world, i) {
  const { w } = world;
  const tx = i % w;
  const ty = (i / w) | 0;
  let n = 0;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    if (!dx && !dy) continue;
    const xx = tx + dx;
    const yy = ty + dy;
    if (!inBounds(world, xx, yy)) continue;
    const t = world.terrain[yy * w + xx];
    if (t === TERRAIN.WATER || t === TERRAIN.TREE) n++;
  }
  return n;
}

/**
 * A standing shop within `maxRoad` road tiles of the lot: the road walked from
 * every door of the lot (the shape of citizens.lotsWithinRoad, which rehomes a
 * family), then any C lot standing — tier > 0, no rubble — with a door on a road
 * tile reached. A block's part is skipped; its anchor answers for it.
 */
export function shopWithinRoad(world, lot, maxRoad) {
  const from = doorsOf(world, lot);
  if (!from.length) return false;
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
  const n = w * h;
  for (let i = 0; i < n; i++) {
    if (world.zone[i] !== ZONE.C || world.tier[i] === 0 || world.rubble[i] || isPart(world, i)) continue;
    for (const dr of doorsOf(world, i)) if (roads.has(dr)) return true;
  }
  return false;
}

/**
 * The rungs of the ladder for class k (AFFLUENT or ULTRAWEALTHY) at lot i, each
 * { rung, ok, want }: `want` is the sentence the card prints for an unmet rung,
 * in the wish system's register. A knob at 0 (or 100 for a ceiling) is no rung
 * for that class and is not listed. Read on the anchor.
 */
export function rungsFor(world, i, k) {
  const a = anchorOf(world, i);
  const out = [];
  const rung = (name, ok, want) => out.push({ rung: name, ok, want });
  const cul = KNOBS.CLASS_CULTURE[k];
  if (cul) rung("culture", world.culture[a] >= cul, cul >= 2 ? "an Amphitheater's culture at home" : "culture at home — a Gallery or an Amphitheater in reach");
  const kn = KNOBS.CLASS_KNOWLEDGE[k];
  if (kn) rung("knowledge", world.knowledge[a] >= kn, kn >= 2 ? "a University's knowledge at home" : "knowledge at home — a Library or a University in reach");
  if (KNOBS.CLASS_PARK[k]) rung("park", parkWithin(world, a, KNOBS.CLASS_PARK_RADIUS), `a Park or Large Park within ${KNOBS.CLASS_PARK_RADIUS}`);
  const shopRoad = KNOBS.CLASS_SHOP_ROAD[k];
  if (shopRoad) rung("shops", shopWithinRoad(world, a, shopRoad), `a shop within ${shopRoad} road tiles`);
  const polMax = KNOBS.CLASS_POL_MAX[k];
  if (polMax < 100) rung("air", world.pol[a] <= polMax, `cleaner air (pollution ${world.pol[a]}, at most ${polMax})`);
  const crimeMax = KNOBS.CLASS_CRIME_MAX[k];
  if (crimeMax < 100) rung("streets", world.crime[a] <= crimeMax, `safer streets (crime ${world.crime[a]}, at most ${crimeMax})`);
  const dreadMax = KNOBS.CLASS_DREAD_MAX[k];
  if (dreadMax < 100) rung("smell", world.dread[a] <= dreadMax, dreadMax ? `less of a meat hall's dread (${world.dread[a]}, at most ${dreadMax})` : "no meat hall's dread at all");
  const lvMin = KNOBS.CLASS_LV_MIN[k];
  if (lvMin) rung("land value", world.lv[a] >= lvMin, `land value ${world.lv[a]} of at least ${lvMin}`);
  const nat = KNOBS.CLASS_NATURE[k];
  if (nat) rung("nature", nature8(world, a) >= nat, nat === 1 ? "water or trees beside the plot" : `${nat} tiles of water or trees beside the plot`);
  return out;
}

/**
 * The class a lot attains NOW and what the next rung wants:
 * { cls, next, unmet: [{ rung, want }] } — `unmet` is empty at ULTRAWEALTHY.
 * This is the ladder as the fields stand this tick and nothing else: a standing
 * mansion whose street has since come down reads AFFLUENT or MODEST here, and
 * keeps standing (old money); `classForArrival` is where a mansion is
 * ultrawealthy by being one.
 */
export function attainableClass(world, i) {
  const a = anchorOf(world, i);
  const r1 = rungsFor(world, a, CLASS.AFFLUENT);
  if (r1.some((r) => !r.ok)) return { cls: CLASS.MODEST, next: CLASS.AFFLUENT, unmet: r1.filter((r) => !r.ok) };
  const r2 = rungsFor(world, a, CLASS.ULTRAWEALTHY);
  if (r2.some((r) => !r.ok)) return { cls: CLASS.AFFLUENT, next: CLASS.ULTRAWEALTHY, unmet: r2.filter((r) => !r.ok) };
  return { cls: CLASS.ULTRAWEALTHY, next: null, unmet: [] };
}

/** The class an arriving household takes at `lot`: a mansion is ultrawealthy by construction; any other lot gives what its ladder attains. */
export function classForArrival(world, lot) {
  if (world.estate[anchorOf(world, lot)] === ESTATE.MANSION) return CLASS.ULTRAWEALTHY;
  return attainableClass(world, lot).cls;
}

/** The unmet rungs as one line for the card: "a shop within 6 road tiles · cleaner air (pollution 14, at most 10)". */
export const waitingLine = (res) => res.unmet.map((r) => r.want).join(" · ");

/**
 * The month's estates, after the lots have grown (tick.js): every chalk plot
 * whose ladder reaches ULTRAWEALTHY — served, and no tile of it flooded, alight
 * or rubble — SPROUTS its mansion: estate → MANSION, tier 3 on every tile (a
 * block is a tier-3 building on every tile), capacity MANSION_CAP. No roll, no
 * RNG: the mansion rises the month the last rung is met, and a town with no
 * estate is byte-identical to one that never heard of them. Returns the ticker
 * lines; they are logged here under their own id, the landmark's way.
 */
export function estatesTick(world) {
  const lines = [];
  const n = world.w * world.h;
  for (let a = 0; a < n; a++) {
    if (world.estate[a] !== ESTATE.PLOT) continue;
    const tiles = footprintOf(world, a);
    if (tiles.some((j) => world.rubble[j] || world.burning[j] || world.flooded[j])) continue;
    if (!served(world, a)) continue;
    if (attainableClass(world, a).cls !== CLASS.ULTRAWEALTHY) continue;
    world.estate[a] = ESTATE.MANSION;
    for (const j of tiles) world.tier[j] = 3;
    const line = `MANSION — a mansion has risen on the estate at (${a % world.w},${(a / world.w) | 0}): every rung met — culture, knowledge, a park, a shop, air ${world.pol[a]}, crime ${world.crime[a]}, land value ${world.lv[a]}, ${nature8(world, a)} of nature beside it. One household of up to ${KNOBS.MANSION_CAP} may live there.`;
    world.events.log.push({ t: world.tick, id: "mansion", line });
    lines.push(line);
  }
  return lines;
}

/**
 * The mansion comes down and the plot stays a plot: estate back to PLOT, every
 * tile tier 0, the block KEPT so the footprint is still one thing that may
 * sprout again. Called by blocks.splitLot for an estate anchor in place of the
 * split into singles (fire, flood, decay would never reach it); the caller
 * evicts through the ordinary capacity path — a chalk plot's capacity is 0.
 */
export function unbuildMansion(world, anchor) {
  world.estate[anchor] = ESTATE.PLOT;
  for (const j of footprintOf(world, anchor)) world.tier[j] = 0;
}

/** "the Greyback estate" for a mansion with a family in it, "the empty mansion" for one without, null for anything else. */
export function estateName(world, lot) {
  const a = anchorOf(world, lot);
  if (world.estate[a] !== ESTATE.MANSION) return null;
  const hh = world.households.find((h) => !h.gone && h.home === a);
  return hh ? `the ${hh.surname} estate` : "the empty mansion";
}
