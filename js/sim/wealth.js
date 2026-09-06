// wealth.js — WEALTH AND CLASS: the checklist, the class field, the mansion. SPEC §9f;
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
// punishment". The owner, night, on the first measurement (no mansion ever
// rose inside a dense block, because a dense block's heart reads crime 100):
// "mansions should rise in dense blocks too. the biggest factor should be what
// amenities are near it." The owner, on the points that followed (2026-09-06):
// "it should not be about points in the sense that each item has a variable
// amount of influence, its more about a checklist, the affluent house MUST be
// in range of all of these, amphitheater, university, library, gallery, large
// park within 5 tiles, police, fire. and a shop within 10 road tiles"
//
// CLASS IS WHAT THE ADDRESS AFFORDS, THIS MONTH. world.klass[anchor] is derived
// every tick after the fields (computeClass), never saved: 0 POVERTY · 1
// MODEST · 2 AFFLUENT, on every R lot of its own or block anchor. A household's
// class is its home's; a family that moves reads its new street; nothing is
// carried, inherited or remembered — the owner's "opportunities near you",
// literally. The Census's class histogram is a readout of what the player
// built, like the species histogram is. Species is untouched: an affluent
// skunk is allowed.
//
// THE CHECKLIST. A class is a LIST of things the address must be in range of,
// every one of them, none weighed against another (KNOBS.CLASS_NEEDS, by class;
// ITEMS below says what each is and how it is read). The AFFLUENT list is the
// owner's, word for word: an Amphitheater, a University, a Library and a
// Gallery each reaching the address (world.civicReach, the four buildings'
// own reaches — a University's half the map, a Library's five tiles — painted
// beside the knowledge and culture fields), a Large Park within
// CLASS_PARK_RADIUS 5, a police station's cover, a fire station's cover, and
// a standing shop within CLASS_SHOP_ROAD 10 road tiles of a door. The MODEST
// list, which the owner has not ruled on, is the proposal's default: culture
// in reach (a Gallery or an Amphitheater) and a park within the same five.
// Nothing else is on either list — not the air, not the street's crime, not
// the land value, not the trees: the owner's "the biggest factor should be
// what amenities are near it", and then "its more about a checklist". So a
// 3×3 in the densest block is affluent the month the last item lands, and the
// card says which items are ticked and which are not, in the words the Census
// shares, so a poor street says what it lacks.
//
// THE MANSION RISES ON ITS OWN, like a storey: where the address is AFFLUENT
// and demand is positive, the 3×3 of housing anchored at a lot — nine R tiles
// on one use line, dry and untroubled, lots of their own or whole blocks lying
// inside it (a 2×2 wholly within, or the 3×3 block that IS it: the apartment
// block becomes the mansion, the owner's "like when the building upgrades") —
// may become one mansion at MANSION_P·score a month (lots.lotScore rolls it, as
// it rolls a block). One household keeps the house — the largest that fits,
// ties to the earlier arrival — and everyone else on the nine tiles is moved
// out: rehomed within REHOME_RADIUS road tiles, else a tent, else they leave
// (citizens.displaceFrom, the eviction path). Capacity MANSION_CAP for ONE
// household on nine tiles that would hold 270: the owner's "less people are
// homed in the same area", and the progressive tax (TAX_CLASS) is what
// balances it in the books. A standing mansion neither grows, decays nor
// merges; fire, flood and the bulldozer take it as a block (blocks.splitLot
// breaks it into cottages), and the address may raise another. There is no
// placed plot: the mansion is earned by the street.
//
// JUSTICE is in justice.js and reads two things from here: the class at a
// burgled address (classAt) or of a killing's victim (classOfCitizen), and the
// name of a mansion for the lines. The owner's "priority policing" is
// PROBABILITY AND TIME, never order — files roll independently — and the "one
// step harsher" is one step up the sentence table for a theft from the
// affluent; the owner: "this applies just to the home, yes harsher punishment".

import { KNOBS } from "./rules.js";
import { ZONE, CIVIC, ROAD, TERRAIN, PART, inBounds, anchorOf, sideOf, footprintOf, civicAnchorOf, isPart } from "./world.js";
import { doorsOf, REACH } from "./fields.js";
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

/** The park within `r` of tile i, any tile of the campus counting — 2 for a Large Park, 1 for a Park, 0 for none: the better of the two (the PARK mood term's own test, from the home tile). */
export function parkLevel(world, i, r) {
  const { w } = world;
  const tx = i % w;
  const ty = (i / w) | 0;
  let best = 0;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const xx = tx + dx;
    const yy = ty + dy;
    if (!inBounds(world, xx, yy)) continue;
    const j = yy * w + xx;
    if (!world.civic[j]) continue;
    const owner = world.civic[civicAnchorOf(world, j)];
    if (owner === CIVIC.LARGE_PARK) return 2;
    if (owner === CIVIC.PARK) best = 1;
  }
  return best;
}

/**
 * WHERE A SITE'S CHECKLIST IS READ. A lot of its own is read at itself. A 3×3 —
 * a block, a mansion, or the window that would become one — is read at its
 * HEART, the centre tile one in from the kerb, because the address is the
 * house and not the road it fronts: the four buildings' reaches, the stations'
 * cover and the park's five tiles are all counted from there, and the shop's
 * road walk starts from the site's doors. A 2×2 block is read at its anchor.
 * `footprint` lets a caller judge a window that is not a block yet.
 */
export function siteOf(world, i, footprint = null) {
  const a = anchorOf(world, i);
  const tiles = footprint || footprintOf(world, a);
  return { anchor: a, tiles, heart: tiles.length === 9 ? tiles[4] : a };
}

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
 * THE ITEMS a checklist may name (KNOBS.CLASS_NEEDS lists them by class). Each:
 * `ok(world, site, ctx)` reads the site — the fields, the reaches and the cover
 * at its heart, the shop from its doors; `has(world, site)` is the item as the
 * card names it when it is there; `want()` the sentence when it is not, in the
 * wish system's register; `cheap` items read one tile and are asked first by
 * mansionWindow, before the searches. `ctx.shopDoors` may carry the month's
 * shop doors.
 */
export const ITEMS = Object.freeze({
  culture: { cheap: true, ok: (w, s) => w.culture[s.heart] > 0, has: (w, s) => (w.culture[s.heart] >= 2 ? "an Amphitheater's culture" : "a Gallery's culture"), want: () => "culture in reach — a Gallery or an Amphitheater" },
  knowledge: { cheap: true, ok: (w, s) => w.knowledge[s.heart] > 0, has: (w, s) => (w.knowledge[s.heart] >= 2 ? "a University's knowledge" : "a Library's knowledge"), want: () => "knowledge in reach — a Library or a University" },
  amphitheater: { cheap: true, ok: (w, s) => (w.civicReach[s.heart] & REACH.AMPHITHEATER) !== 0, has: () => "an Amphitheater", want: () => "an Amphitheater in reach" },
  university: { cheap: true, ok: (w, s) => (w.civicReach[s.heart] & REACH.UNIVERSITY) !== 0, has: () => "a University", want: () => "a University in reach" },
  library: { cheap: true, ok: (w, s) => (w.civicReach[s.heart] & REACH.LIBRARY) !== 0, has: () => "a Library", want: () => "a Library in reach" },
  gallery: { cheap: true, ok: (w, s) => (w.civicReach[s.heart] & REACH.GALLERY) !== 0, has: () => "a Gallery", want: () => "a Gallery in reach" },
  park: { cheap: false, ok: (w, s) => parkLevel(w, s.heart, KNOBS.CLASS_PARK_RADIUS) >= 1, has: (w, s) => (parkLevel(w, s.heart, KNOBS.CLASS_PARK_RADIUS) === 2 ? "a Large Park" : "a Park"), want: () => `a Park or Large Park within ${KNOBS.CLASS_PARK_RADIUS}` },
  largePark: { cheap: false, ok: (w, s) => parkLevel(w, s.heart, KNOBS.CLASS_PARK_RADIUS) === 2, has: () => "a Large Park", want: () => `a Large Park within ${KNOBS.CLASS_PARK_RADIUS}` },
  police: { cheap: true, ok: (w, s) => w.policeCov[s.heart] > 0, has: () => "police", want: () => "a police station's cover" },
  fire: { cheap: true, ok: (w, s) => w.fireCov[s.heart] > 0, has: () => "fire", want: () => "a fire station's cover" },
  shop: { cheap: false, ok: (w, s, ctx) => shopWithinRoad(w, s.anchor, KNOBS.CLASS_SHOP_ROAD, (ctx && ctx.shopDoors) || null), has: () => "a shop", want: () => `a shop within ${KNOBS.CLASS_SHOP_ROAD} road tiles` },
});

/**
 * The checklist of class k (MODEST or AFFLUENT) read at a SITE (siteOf), each
 * { rung, ok, has, want } — `has` the item as the card names it when it is
 * there (null when it is not), `want` the sentence for a missing one.
 */
export function rungsFor(world, site, k, ctx = null) {
  if (typeof site === "number") site = siteOf(world, site);
  return KNOBS.CLASS_NEEDS[k].map((name) => {
    const it = ITEMS[name];
    const ok = it.ok(world, site, ctx);
    return { rung: name, ok, has: ok ? it.has(world, site) : null, want: it.want() };
  });
}

/**
 * The class a lot attains NOW and the checklist that decides its next step:
 * { cls, next, list, have, unmet } — `list` the checklist judged (the next
 * class's; the affluent's own when nothing is left to climb), `have` its items
 * that are there, `unmet` the ones that are not (empty at AFFLUENT). The
 * checklists as the fields stand; computeClass writes the class into
 * world.klass once a month, the card asks it live.
 */
export function attainableClass(world, i, ctx = null, footprint = null) {
  const site = siteOf(world, i, footprint);
  let cls = CLASS.POVERTY;
  let list = [];
  for (let k = CLASS.MODEST; k <= CLASS.AFFLUENT; k++) {
    list = rungsFor(world, site, k, ctx);
    if (list.some((r) => !r.ok)) break;
    cls = k;
  }
  const next = cls < CLASS.AFFLUENT ? cls + 1 : null;
  return { cls, next, list, have: list.filter((r) => r.ok), unmet: list.filter((r) => !r.ok) };
}

/** "in range of an Amphitheater, a Gallery, police — 3 of 8 the affluent need" · "in range of everything the affluent need — …" · "in range of nothing the modest need (0 of 2)": what the address has, for the card and the line. */
export function haveLine(res) {
  const who = CLASS_NAME[res.next === null ? CLASS.AFFLUENT : res.next];
  const names = res.have.map((r) => r.has).join(", ");
  if (res.next === null) return `in range of everything the ${who} need — ${names}`;
  return res.have.length ? `in range of ${names} — ${res.have.length} of ${res.list.length} the ${who} need` : `in range of nothing the ${who} need (0 of ${res.list.length})`;
}

/** The missing items as one line for the card: "a University in reach · a Large Park within 5 · a fire station's cover". Empty at AFFLUENT. */
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
 * THE MANSION WINDOW: the 3×3 anchored AT tile i (i its north corner) that
 * could become a mansion this month — every tile an R tile on i's use line,
 * dry, no civic, not rubble, alight or flooded, and either a lot of its own or
 * a tile of a block lying WHOLLY inside the window (a 2×2 within it, or the
 * 3×3 block that is the window: the apartment block becomes the mansion, the
 * owner's "like when the building upgrades to an apartment building"); no
 * standing mansion anywhere in it — where the ADDRESS is affluent: the
 * checklist read on the window as the 3×3 it would be (siteOf: at its heart,
 * the shop from its doors). Reads only; lots.lotScore rolls it at
 * MANSION_P·score. Anchored at i, so a window rolls once a month and not once
 * from each of its nine tiles. The CHEAP items of the affluent list — the
 * reaches and the cover, one tile each at the heart — are asked first, so a
 * street that cannot afford one costs the tick nothing; then the nine tiles;
 * then the whole checklist decides.
 */
export function mansionWindow(world, i) {
  const { w, h } = world;
  if (world.zone[i] !== ZONE.R || isPart(world, i) || world.mansion[i]) return null;
  const tx = i % w;
  const ty = (i / w) | 0;
  if (tx + 2 >= w || ty + 2 >= h) return null;
  const heart = i + 1 + w;
  const atHeart = { anchor: i, tiles: null, heart };
  for (const name of KNOBS.CLASS_NEEDS[CLASS.AFFLUENT]) { const it = ITEMS[name]; if (it.cheap && !it.ok(world, atHeart)) return null; }
  const tiles = [];
  for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
    const j = i + dx + dy * w;
    if (world.zone[j] !== ZONE.R || world.use[j] !== world.use[i] || world.civic[j] || world.terrain[j] === TERRAIN.WATER
      || world.rubble[j] || world.burning[j] || world.flooded[j]) return null;
    const a = anchorOf(world, j);
    if (world.mansion[a]) return null; // a standing mansion is nobody's window
    if (world.big[j]) { // a block's tile: the whole block must lie inside the window
      const s = sideOf(world, a);
      const ax = a % w;
      const ay = (a / w) | 0;
      if (ax < tx || ay < ty || ax + s - 1 > tx + 2 || ay + s - 1 > ty + 2) return null;
    }
    tiles.push(j);
  }
  if (attainableClass(world, i, null, tiles).cls !== CLASS.AFFLUENT) return null;
  return { anchor: i, tiles };
}

/**
 * The window becomes a MANSION. The household that keeps the house is the
 * largest that fits (≤ MANSION_CAP) among those on the nine tiles — a block's
 * households live on its anchor, which is one of them — ties to the earlier
 * arrival then the lower id; the tiles become the block (big 3 and its parts,
 * tier 3 on every tile, world.mansion[anchor] = 1; a block that was there is
 * overwritten, a landmark's theme with it) BEFORE anyone is moved, so no
 * displaced family is rehomed onto the window it is leaving; then everyone but
 * the keeper goes (citizens.displaceFrom) and the keeper moves onto the anchor.
 * Returns { anchor, tiles, keeper, displaced } for the line.
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
  return `MANSION — a mansion has risen at ${at}. ${house}${out}. The address is ${haveLine(attainableClass(world, anchor))}; one household of up to ${KNOBS.MANSION_CAP} lives on nine tiles.`;
}

/** "the Greyback estate" for a mansion with a family in it, "the empty mansion" for one without, null for anything else. */
export function estateName(world, lot) {
  const a = anchorOf(world, lot);
  if (world.mansion[a] !== 1) return null;
  const hh = world.households.find((h) => !h.gone && h.home === a);
  return hh ? `the ${hh.surname} estate` : "the empty mansion";
}
