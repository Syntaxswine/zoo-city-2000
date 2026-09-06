// wealth.js — WEALTH AND CLASS: the ladder, the class field, the mansion. SPEC §9f;
// docs/PROPOSAL-WEALTH-AND-CLASS-2026-09-05.md. Pure; imports cleanly in Node.
//
// The owner, morning (2026-09-05): "culture will be a boon to both happiness as
// well as property desirability, but later when we start getting into
// wealth/class it will be a prerequisite to more affluent housing. the
// ultrawealthy want to have a 3x3 plot next to everything, they will need
// their own sprites too for their mansions. any theft from the ultrawealthy
// gets priority policing and one step harsher punishment." The owner, evening,
// on the proposal's eight decisions: "poverty, modest, affluent" · "class based
// on the opportunities near you" · "if there are enough positive things near
// you it happens naturally like when the building upgrades to an apartment
// building" · "less people are homed in the same area" · "the option for a
// progressive tax is a wonderful idea" · "at some point a species specific
// variation is welcome" · "this applies just to the home, yes harsher
// punishment".
//
// CLASS IS WHAT THE ADDRESS AFFORDS, THIS MONTH. world.klass[anchor] is derived
// every tick after the fields (computeClass), never saved: 0 POVERTY · 1
// MODEST · 2 AFFLUENT, on every R lot of its own or block anchor. A household's
// class is its home's; a family that moves reads its new street; nothing is
// carried, inherited or remembered — the owner's "opportunities near you",
// literally. A town with no culture is a town in poverty, and the Census says
// so: the class histogram is a readout of what the player built, like the
// species histogram is. Species is untouched: an affluent skunk is allowed.
//
// THE LADDER. attainableClass(world, lot) is the highest rung every one of
// whose prerequisites the lot's own fields meet, read on the anchor as every
// home rule reads. The owner's word was PREREQUISITE, so these are GATES and
// not weights — the weights-never-gates law is about species and stays about
// species. Every number is a KNOB (rules.js CLASS_*); every rung is a field the
// game already computes: culture and knowledge (SPEC §9e), a park within 4
// (the PARK mood term's own test), a shop within so many ROAD tiles (the
// rehoming search's shape), the air, the streets, the smell, the land value,
// and water or trees beside the plot (land value's own nature8). It returns
// the class AND the unmet rungs of the next one, in the words the card and the
// Census share, so a street that is poor says what it lacks.
//
// THE MANSION RISES ON ITS OWN, like a storey: where the address is AFFLUENT
// and demand is positive, the 3×3 of housing anchored at a lot — nine R lots of
// their own, on one use line, dry and untroubled — may become one mansion at
// BIG_P·score a month (lots.lotScore rolls it, as it rolls a block). One
// household keeps the house — the largest that fits, ties to the earlier
// arrival — and everyone else on the nine lots is moved out: rehomed within
// REHOME_RADIUS road tiles, else a tent, else they leave (citizens.displaceFrom,
// the eviction path). Capacity MANSION_CAP for ONE household on nine tiles that
// would hold 270: the owner's "less people are homed in the same area", and
// the progressive tax (TAX_CLASS) is what balances it in the books. A standing
// mansion neither grows, decays nor merges; fire, flood and the bulldozer take
// it as a block (blocks.splitLot breaks it into cottages), and the address may
// raise another. There is no placed plot: the mansion is earned by the street.
//
// JUSTICE is in justice.js and reads two things from here: the class at a
// burgled address (classAt) or of a killing's victim (classOfCitizen), and the
// name of a mansion for the lines. The owner's "priority policing" is
// PROBABILITY AND TIME, never order — files roll independently — and the "one
// step harsher" is one step up the sentence table for a theft from the
// affluent; the owner: "this applies just to the home, yes harsher punishment".

import { KNOBS } from "./rules.js";
import { ZONE, CIVIC, ROAD, TERRAIN, PART, inBounds, anchorOf, sideOf, footprintOf, civicAnchorOf, isPart } from "./world.js";
import { doorsOf } from "./fields.js";
import { placeHousehold, displaceFrom } from "./citizens.js";
import { KIND, remember } from "./life.js";
import { pluralSpecies } from "./landmarks.js";

export const CLASS = Object.freeze({ POVERTY: 0, MODEST: 1, AFFLUENT: 2 });
export const CLASS_NAME = Object.freeze(["poverty", "modest", "affluent"]);

/** The class of a citizen's home this month (its anchor's klass); a camper or a citizen without a home is in poverty. */
export const classOfCitizen = (world, c) => (c.home >= 0 ? world.klass[anchorOf(world, c.home)] : CLASS.POVERTY);
/** The class an address attains this month. */
export const classAt = (world, lot) => world.klass[anchorOf(world, lot)];
/** Any tile of a standing mansion. */
export const isMansion = (world, i) => world.mansion[anchorOf(world, i)] === 1;

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

/**
 * WHERE A SITE'S LADDER IS READ. A lot of its own is read at itself, with its
 * eight neighbours for nature. A 3×3 — a block, a mansion, or the window that
 * would become one — is read at its HEART, the centre tile one in from the
 * kerb, because the address is the house and not the road it fronts (a busy
 * ring road puts up to 30 pollution on the tile beside it and nothing on the
 * next), and its nature is counted round the BORDER of the footprint (the
 * heart's own neighbours are all its own tiles, which would count for nothing).
 * Measured before this rule: the owner-scale probe read the corner tile for
 * 360 months and air and land value failed for 330 of them on traffic alone.
 * `footprint` lets a caller judge a window that is not a block yet.
 */
export function siteOf(world, i, footprint = null) {
  const a = anchorOf(world, i);
  const tiles = footprint || (sideOf(world, a) === 3 ? footprintOf(world, a) : [a]);
  return { anchor: a, tiles, heart: tiles.length === 9 ? tiles[4] : a };
}

/** Water or trees among the tiles that BORDER `tiles` (Chebyshev 1 of any, not in the set) — land value's own nature8 for a lot of its own. */
export function natureBeside(world, tiles) {
  const { w } = world;
  const inside = new Set(tiles);
  const seen = new Set();
  let n = 0;
  for (const i of tiles) {
    const tx = i % w;
    const ty = (i / w) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const xx = tx + dx;
      const yy = ty + dy;
      if (!inBounds(world, xx, yy)) continue;
      const j = yy * w + xx;
      if (inside.has(j) || seen.has(j)) continue;
      seen.add(j);
      const t = world.terrain[j];
      if (t === TERRAIN.WATER || t === TERRAIN.TREE) n++;
    }
  }
  return n;
}
/** A lot of its own: water or trees among its eight neighbours. */
export const nature8 = (world, i) => natureBeside(world, [i]);

/**
 * Every road tile that is a door of a standing shop (zone C, tier > 0, no
 * rubble; a block's anchor answers for it). Cached for the month: computeClass
 * rebuilds it at the top of every tick and every pass, and lotScore's window
 * checks read the same set — shops change only in the tick (a C lot grows a
 * storey in lotsTick; zoning makes chalk, not a shop).
 */
export function shopDoorSet(world) {
  if (world._shopDoors && world._shopDoorsAt === world.tick) return world._shopDoors;
  const set = new Set();
  const n = world.w * world.h;
  for (let i = 0; i < n; i++) {
    if (world.zone[i] !== ZONE.C || world.tier[i] === 0 || world.rubble[i] || isPart(world, i)) continue;
    for (const d of doorsOf(world, i)) set.add(d);
  }
  world._shopDoors = set;
  world._shopDoorsAt = world.tick;
  return set;
}

/**
 * A standing shop within `maxRoad` road tiles of the lot: the road walked from
 * every door of the lot (the shape of citizens.lotsWithinRoad, which rehomes a
 * family) until it meets a shop's door. `shopDoors` is shopDoorSet(world),
 * built by the caller when it asks for many lots, or here for one.
 */
export function shopWithinRoad(world, lot, maxRoad, shopDoors = null) {
  const from = doorsOf(world, lot);
  if (!from.length) return false;
  const doors = shopDoors || shopDoorSet(world);
  const { w, h } = world;
  const dist = new Int16Array(w * h).fill(-1);
  const q = from.slice();
  for (const d of from) { dist[d] = 0; if (doors.has(d)) return true; }
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
      if (doors.has(j)) return true;
      q.push(j);
    }
  }
  return false;
}

/**
 * The rungs of the ladder for class k (MODEST or AFFLUENT) at a SITE (siteOf),
 * each { rung, ok, want }: `want` is the sentence the card prints for an unmet
 * rung, in the wish system's register. A knob at 0 (or 100 for a ceiling) is no
 * rung for that class and is not listed. The fields are read at the site's
 * heart; the shop walk starts from the site's doors; nature is counted round
 * its border. `ctx.shopDoors` may carry the month's shop doors.
 */
export function rungsFor(world, site, k, ctx = null) {
  if (typeof site === "number") site = siteOf(world, site);
  const a = site.heart;
  const out = [];
  const rung = (name, ok, want) => out.push({ rung: name, ok, want });
  const cul = KNOBS.CLASS_CULTURE[k];
  if (cul) rung("culture", world.culture[a] >= cul, cul >= 2 ? "an Amphitheater's culture at home" : "culture at home — a Gallery or an Amphitheater in reach");
  const kn = KNOBS.CLASS_KNOWLEDGE[k];
  if (kn) rung("knowledge", world.knowledge[a] >= kn, kn >= 2 ? "a University's knowledge at home" : "knowledge at home — a Library or a University in reach");
  if (KNOBS.CLASS_PARK[k]) rung("park", parkWithin(world, a, KNOBS.CLASS_PARK_RADIUS), `a Park or Large Park within ${KNOBS.CLASS_PARK_RADIUS}`);
  const shopRoad = KNOBS.CLASS_SHOP_ROAD[k];
  if (shopRoad) rung("shops", shopWithinRoad(world, site.anchor, shopRoad, (ctx && ctx.shopDoors) || shopDoorSet(world)), `a shop within ${shopRoad} road tiles`);
  const polMax = KNOBS.CLASS_POL_MAX[k];
  if (polMax < 100) rung("air", world.pol[a] <= polMax, `cleaner air (pollution ${world.pol[a]}, at most ${polMax})`);
  const crimeMax = KNOBS.CLASS_CRIME_MAX[k];
  if (crimeMax < 100) rung("streets", world.crime[a] <= crimeMax, `safer streets (crime ${world.crime[a]}, at most ${crimeMax})`);
  const dreadMax = KNOBS.CLASS_DREAD_MAX[k];
  if (dreadMax < 100) rung("smell", world.dread[a] <= dreadMax, dreadMax ? `less of a meat hall's dread (${world.dread[a]}, at most ${dreadMax})` : "no meat hall's dread at all");
  const lvMin = KNOBS.CLASS_LV_MIN[k];
  if (lvMin) rung("land value", world.lv[a] >= lvMin, `land value ${world.lv[a]} of at least ${lvMin}`);
  const nat = KNOBS.CLASS_NATURE[k];
  if (nat) rung("nature", natureBeside(world, site.tiles) >= nat, nat === 1 ? "water or trees beside the plot" : `${nat} tiles of water or trees beside the plot`);
  return out;
}

/**
 * The class a lot attains NOW and what the next rung wants:
 * { cls, next, unmet: [{ rung, want }] } — `unmet` is empty at AFFLUENT. The
 * ladder as the fields stand; computeClass writes it into world.klass once a
 * month, the card asks it live.
 */
export function attainableClass(world, i, ctx = null, footprint = null) {
  const site = siteOf(world, i, footprint);
  const r1 = rungsFor(world, site, CLASS.MODEST, ctx);
  if (r1.some((r) => !r.ok)) return { cls: CLASS.POVERTY, next: CLASS.MODEST, unmet: r1.filter((r) => !r.ok) };
  const r2 = rungsFor(world, site, CLASS.AFFLUENT, ctx);
  if (r2.some((r) => !r.ok)) return { cls: CLASS.MODEST, next: CLASS.AFFLUENT, unmet: r2.filter((r) => !r.ok) };
  return { cls: CLASS.AFFLUENT, next: null, unmet: [] };
}

/** The unmet rungs as one line for the card: "a shop within 6 road tiles · cleaner air (pollution 14, at most 10)". */
export const waitingLine = (res) => res.unmet.map((r) => r.want).join(" · ");

/**
 * THE CLASS FIELD: world.klass[i] for every R lot of its own or block anchor
 * (a part reads 0 and answers through its anchor), from the fields as they
 * stand — run after computeFields, before the census that counts it
 * (tick.js step 1, refreshLast). The shop doors are collected once per pass.
 */
export function computeClass(world) {
  const n = world.w * world.h;
  world.klass.fill(0);
  world._shopDoors = null; // the month's shop doors, rebuilt once here and read by every window check this tick
  const ctx = { shopDoors: shopDoorSet(world) };
  for (let i = 0; i < n; i++) {
    if (world.zone[i] !== ZONE.R || isPart(world, i)) continue;
    world.klass[i] = attainableClass(world, i, ctx).cls;
  }
}

/**
 * THE MANSION WINDOW: the 3×3 anchored AT lot i (i its north corner) that could
 * become a mansion this month — every tile an R lot of its own (no block, no
 * mansion), on i's use line, dry, no civic, not rubble, alight or flooded —
 * where the ADDRESS is affluent — the ladder read on the window as the 3×3 it
 * would be (siteOf: at its heart, nature round its border). Reads only;
 * lots.lotScore rolls it at MANSION_P·score. Anchored at i, so a window rolls
 * once a month and not once from each of its nine tiles. The cheap field rungs
 * at the heart are asked first, so a street that cannot afford one costs the
 * tick nothing.
 */
export function mansionWindow(world, i) {
  const { w, h } = world;
  if (world.zone[i] !== ZONE.R || world.big[i]) return null;
  const tx = i % w;
  const ty = (i / w) | 0;
  if (tx + 2 >= w || ty + 2 >= h) return null;
  const heart = i + 1 + w;
  if (world.culture[heart] < KNOBS.CLASS_CULTURE[CLASS.AFFLUENT] || world.knowledge[heart] < KNOBS.CLASS_KNOWLEDGE[CLASS.AFFLUENT] || world.lv[heart] < KNOBS.CLASS_LV_MIN[CLASS.AFFLUENT]
    || world.pol[heart] > KNOBS.CLASS_POL_MAX[CLASS.AFFLUENT] || world.crime[heart] > KNOBS.CLASS_CRIME_MAX[CLASS.AFFLUENT] || world.dread[heart] > KNOBS.CLASS_DREAD_MAX[CLASS.AFFLUENT]) return null;
  const tiles = [];
  for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
    const j = i + dx + dy * w;
    if (world.zone[j] !== ZONE.R || world.big[j] || world.use[j] !== world.use[i] || world.civic[j] || world.terrain[j] === TERRAIN.WATER
      || world.rubble[j] || world.burning[j] || world.flooded[j]) return null;
    tiles.push(j);
  }
  if (attainableClass(world, i, null, tiles).cls !== CLASS.AFFLUENT) return null;
  return { anchor: i, tiles };
}

/**
 * The window becomes a MANSION. The household that keeps the house is the
 * largest that fits (≤ MANSION_CAP) among those on the nine lots, ties to the
 * earlier arrival then the lower id; the tiles become the block (big 3 and its
 * parts, tier 3 on every tile, world.mansion[anchor] = 1) BEFORE anyone is
 * moved, so no displaced family is rehomed onto the window it is leaving; then
 * everyone but the keeper goes (citizens.displaceFrom) and the keeper moves
 * onto the anchor. Returns { anchor, tiles, keeper, displaced } for the line.
 */
export function raiseMansion(world, win) {
  const { anchor, tiles } = win;
  const { w } = world;
  const set = new Set(tiles);
  let keeper = null;
  for (const hh of world.households) {
    if (hh.gone || !set.has(hh.home) || hh.members.length > KNOBS.MANSION_CAP) continue;
    if (!keeper || hh.members.length > keeper.members.length
      || (hh.members.length === keeper.members.length && (hh.arrived < keeper.arrived || (hh.arrived === keeper.arrived && hh.id < keeper.id)))) keeper = hh;
  }
  for (const j of tiles) {
    const dx = (j % w) - (anchor % w);
    const dy = ((j / w) | 0) - ((anchor / w) | 0);
    world.big[j] = j === anchor ? 3 : PART | dx | (dy << 2);
    world.tier[j] = 3;
    world.theme[j] = 0;
  }
  world.mansion[anchor] = 1;
  const displaced = displaceFrom(world, tiles, keeper);
  if (keeper) {
    const from = keeper.home;
    for (const id of keeper.members) { const c = world.byId.get(id); if (c && c.home >= 0) { world.occupants[c.home]--; c.home = -1; } }
    keeper.home = -1;
    placeHousehold(world, keeper, anchor);
    if (from !== anchor) for (const id of keeper.members) { const c = world.byId.get(id); if (c) remember(world, c, KIND.MOVED, anchor); }
  }
  return { anchor, tiles, keeper, displaced };
}

/** The ticker line when a mansion rises — the coordinates first, so play.mjs --when can point the camera at it. */
export function mansionLine(world, res) {
  const { anchor, keeper, displaced } = res;
  const at = `(${anchor % world.w},${(anchor / world.w) | 0})`;
  const house = keeper ? `The ${keeper.surname}s (${keeper.members.length} ${pluralSpecies(keeper.species)}) keep the house` : "Nobody lived on the nine lots; the house stands empty";
  const out = displaced ? `; ${displaced} animal${displaced === 1 ? "" : "s"} ${displaced === 1 ? "was" : "were"} moved out to make room` : "";
  return `MANSION — a mansion has risen at ${at}. ${house}${out}. The address has culture, knowledge, a park, a shop, air ${world.pol[anchor]}, crime ${world.crime[anchor]}, land value ${world.lv[anchor]} and nature beside it; one household of up to ${KNOBS.MANSION_CAP} lives on nine tiles.`;
}

/** "the Greyback estate" for a mansion with a family in it, "the empty mansion" for one without, null for anything else. */
export function estateName(world, lot) {
  const a = anchorOf(world, lot);
  if (world.mansion[a] !== 1) return null;
  const hh = world.households.find((h) => !h.gone && h.home === a);
  return hh ? `the ${hh.surname} estate` : "the empty mansion";
}
