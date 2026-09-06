// wealth.js — WEALTH AND CLASS: the opportunities, the class field, the mansion. SPEC §9f;
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
// amenities are near it."
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
// THE OPPORTUNITIES. attainableClass(world, lot) COUNTS the positive things in
// reach of the address — the owner's "enough positive things near you" — as
// POINTS: culture at home (a Gallery's 2, an Amphitheater's 4), knowledge at
// home (a Library's 1, a University's 2), a park within 4 (a Park 1, a Large
// Park 2), a standing shop within 6 ROAD tiles (1), water or trees beside the
// plot (1): ten in all, every one a thing the game already computes. The street
// DRAGS on them, ONE point each and never more than three: smoke (pollution
// over DRAG_POL), a hot street (crime over DRAG_CRIME, the burglary's own
// line), a meat hall's dread. MODEST is CLASS_MIN 3 points; AFFLUENT is 7 AND
// culture at home, whatever the points — the owner's morning word was
// PREREQUISITE. So the amenities decide and the fields only drag: a 3×3 inside
// a dense block, whose heart reads crime 100 by the game's own density law, is
// a point down and affluent all the same when an Amphitheater, a University, a
// Large Park and a shop are near it. Land value is NOT a rung: it is the tax's
// (SPEC §10) and is already the sum of these same things. Every number is a
// KNOB (rules.js OPP_*, DRAG_*, CLASS_MIN, CLASS_CULTURE_MIN). It returns the
// points, what they are made of and what the next class still wants, in the
// words the card and the Census share, so a poor street says what it lacks.
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
 * WHERE A SITE'S LADDER IS READ. A lot of its own is read at itself, with its
 * eight neighbours for nature. A 3×3 — a block, a mansion, or the window that
 * would become one — is read at its HEART, the centre tile one in from the
 * kerb, because the address is the house and not the road it fronts (a busy
 * ring road puts up to 30 pollution on the tile beside it and nothing on the
 * next), and its nature is counted round the BORDER of the footprint (the
 * heart's own neighbours are all its own tiles, which would count for nothing).
 * A 2×2 block is read at its anchor with nature round its four tiles. Measured
 * before this rule: the owner-scale probe read the corner tile for 360 months
 * and air and land value failed for 330 of them on traffic alone. `footprint`
 * lets a caller judge a window that is not a block yet.
 */
export function siteOf(world, i, footprint = null) {
  const a = anchorOf(world, i);
  const tiles = footprint || footprintOf(world, a);
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
 * THE OPPORTUNITIES at a SITE (siteOf) and the DRAGS on them:
 *   opp:  [{ rung, have, worth, name, want }] — `have` the points it gives now, `worth` the most it could, `name` what is
 *         there ("an Amphitheater"), `want` the sentence for what is missing, in the wish system's register
 *   drag: [{ rung, on, cause, want }] — a point off while `on`: `cause` for the card ("smoke (pollution 55)"), `want` the fix
 *   culture: the culture level at the heart, the affluent's prerequisite
 * The fields are read at the site's heart; the shop walk starts from the site's doors; nature is counted round its border.
 * `ctx.shopDoors` may carry the month's shop doors. Every number is a knob.
 */
export function rungsFor(world, site, ctx = null) {
  if (typeof site === "number") site = siteOf(world, site);
  const a = site.heart;
  const opp = [];
  const cul = world.culture[a];
  const oc = KNOBS.OPP_CULTURE;
  opp.push({ rung: "culture", have: oc[cul], worth: oc[2], name: cul >= 2 ? "an Amphitheater" : "a Gallery",
    want: cul === 0 ? `culture at home — a Gallery (+${oc[1]}) or an Amphitheater (+${oc[2]}) in reach` : `an Amphitheater's culture (+${oc[2] - oc[cul]} more)` });
  const kn = world.knowledge[a];
  const ok = KNOBS.OPP_KNOWLEDGE;
  opp.push({ rung: "knowledge", have: ok[kn], worth: ok[2], name: kn >= 2 ? "a University" : "a Library",
    want: kn === 0 ? `knowledge at home — a Library (+${ok[1]}) or a University (+${ok[2]}) in reach` : `a University's knowledge (+${ok[2] - ok[kn]} more)` });
  const pk = parkLevel(world, a, KNOBS.CLASS_PARK_RADIUS);
  const op = KNOBS.OPP_PARK;
  opp.push({ rung: "park", have: op[pk], worth: op[2], name: pk >= 2 ? "a Large Park" : "a Park",
    want: pk === 0 ? `a Park (+${op[1]}) or a Large Park (+${op[2]}) within ${KNOBS.CLASS_PARK_RADIUS}` : `a Large Park within ${KNOBS.CLASS_PARK_RADIUS} (+${op[2] - op[pk]} more)` });
  const shop = shopWithinRoad(world, site.anchor, KNOBS.CLASS_SHOP_ROAD, (ctx && ctx.shopDoors) || shopDoorSet(world));
  opp.push({ rung: "shops", have: shop ? KNOBS.OPP_SHOP : 0, worth: KNOBS.OPP_SHOP, name: "a shop", want: `a shop within ${KNOBS.CLASS_SHOP_ROAD} road tiles (+${KNOBS.OPP_SHOP})` });
  const nat = natureBeside(world, site.tiles);
  opp.push({ rung: "nature", have: nat ? KNOBS.OPP_NATURE : 0, worth: KNOBS.OPP_NATURE, name: "trees or water beside", want: `water or trees beside the plot (+${KNOBS.OPP_NATURE})` });
  const drag = [
    { rung: "air", on: world.pol[a] > KNOBS.DRAG_POL, cause: `smoke (pollution ${world.pol[a]})`, want: `cleaner air (pollution ${world.pol[a]}, over ${KNOBS.DRAG_POL})` },
    { rung: "streets", on: world.crime[a] > KNOBS.DRAG_CRIME, cause: `the streets (crime ${world.crime[a]})`, want: `safer streets (crime ${world.crime[a]}, over ${KNOBS.DRAG_CRIME})` },
    { rung: "smell", on: world.dread[a] > KNOBS.DRAG_DREAD, cause: `a meat hall's dread (${world.dread[a]})`, want: `no meat hall's dread (${world.dread[a]})` },
  ];
  return { opp, drag, culture: cul };
}

/**
 * The class a lot attains NOW and what the next class wants:
 * { cls, next, points, max, nextAt, cultureShort, have: [opp], drags: [drag], unmet: [{ rung, want, worth }] } — `points`
 * the opportunities less the drags, `nextAt` the next class's CLASS_MIN (null at AFFLUENT), `cultureShort` whether the next
 * class's culture prerequisite is unmet, `have` the opportunities that give points, `drags` the ones that are on, `unmet`
 * every opportunity not fully had and every drag on (empty at AFFLUENT). The ladder as the fields stand; computeClass
 * writes the class into world.klass once a month, the card asks it live.
 */
export function attainableClass(world, i, ctx = null, footprint = null) {
  const site = siteOf(world, i, footprint);
  const { opp, drag, culture } = rungsFor(world, site, ctx);
  const drags = drag.filter((d) => d.on);
  const points = opp.reduce((s, o) => s + o.have, 0) - drags.length;
  const max = opp.reduce((s, o) => s + o.worth, 0);
  const afford = (k) => points >= KNOBS.CLASS_MIN[k] && culture >= KNOBS.CLASS_CULTURE_MIN[k];
  const cls = afford(CLASS.AFFLUENT) ? CLASS.AFFLUENT : afford(CLASS.MODEST) ? CLASS.MODEST : CLASS.POVERTY;
  const next = cls < CLASS.AFFLUENT ? cls + 1 : null;
  const unmet = next === null ? [] : [
    ...opp.filter((o) => o.have < o.worth).map((o) => ({ rung: o.rung, want: o.want, worth: o.worth - o.have })),
    ...drags.map((d) => ({ rung: d.rung, want: d.want, worth: 1 })),
  ];
  return { cls, next, points, max, nextAt: next === null ? null : KNOBS.CLASS_MIN[next], cultureShort: next !== null && culture < KNOBS.CLASS_CULTURE_MIN[next], have: opp.filter((o) => o.have > 0), drags, unmet };
}

/** "7 of 10 points — an Amphitheater, a Library, a Park, a shop; 1 off for the streets (crime 100)": what the address has, for the card and the line. */
export function pointsLine(res) {
  const has = res.have.length ? ` — ${res.have.map((o) => o.name).join(", ")}` : "";
  const off = res.drags.length ? `; ${res.drags.length} off for ${res.drags.map((d) => d.cause).join(" and ")}` : "";
  return `${res.points} of ${res.max} points${has}${off}`;
}

/** What the next class wants, as one line for the card: "2 more points: a University's knowledge (+1 more) · a Large Park within 4 (+1 more) · safer streets (crime 100, over 60)". Empty at AFFLUENT. */
export function waitingLine(res) {
  if (res.next === null) return "";
  const short = res.nextAt - res.points;
  const head = short > 0 ? `${short} more point${short === 1 ? "" : "s"}${res.cultureShort ? " and culture at home" : ""}` : "culture at home";
  return `${head}: ${res.unmet.map((r) => r.want).join(" · ")}`;
}

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
 * standing mansion anywhere in it — where the ADDRESS is affluent — the ladder
 * read on the window as the 3×3 it would be (siteOf: at its heart, nature
 * round its border). Reads only; lots.lotScore rolls it at MANSION_P·score.
 * Anchored at i, so a window rolls once a month and not once from each of its
 * nine tiles. The cheap questions come first: culture at the heart is the
 * affluent's prerequisite, and the MOST the address could score — its culture
 * and knowledge as they are, the best park, a shop and nature, less the
 * heart's drags — must reach CLASS_MIN before the searches are worth running,
 * so a street that cannot afford one costs the tick nothing. The whole ladder
 * decides.
 */
export function mansionWindow(world, i) {
  const { w, h } = world;
  if (world.zone[i] !== ZONE.R || isPart(world, i) || world.mansion[i]) return null;
  const tx = i % w;
  const ty = (i / w) | 0;
  if (tx + 2 >= w || ty + 2 >= h) return null;
  const heart = i + 1 + w;
  const cul = world.culture[heart];
  if (cul < KNOBS.CLASS_CULTURE_MIN[CLASS.AFFLUENT]) return null;
  const drags = (world.pol[heart] > KNOBS.DRAG_POL ? 1 : 0) + (world.crime[heart] > KNOBS.DRAG_CRIME ? 1 : 0) + (world.dread[heart] > KNOBS.DRAG_DREAD ? 1 : 0);
  const most = KNOBS.OPP_CULTURE[cul] + KNOBS.OPP_KNOWLEDGE[world.knowledge[heart]] + KNOBS.OPP_PARK[2] + KNOBS.OPP_SHOP + KNOBS.OPP_NATURE - drags;
  if (most < KNOBS.CLASS_MIN[CLASS.AFFLUENT]) return null;
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
  const cls = attainableClass(world, anchor);
  return `MANSION — a mansion has risen at ${at}. ${house}${out}. The address has ${pointsLine(cls)}; one household of up to ${KNOBS.MANSION_CAP} lives on nine tiles.`;
}

/** "the Greyback estate" for a mansion with a family in it, "the empty mansion" for one without, null for anything else. */
export function estateName(world, lot) {
  const a = anchorOf(world, lot);
  if (world.mansion[a] !== 1) return null;
  const hh = world.households.find((h) => !h.gone && h.home === a);
  return hh ? `the ${hh.surname} estate` : "the empty mansion";
}
