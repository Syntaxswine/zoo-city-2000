// roof-furniture.js — PUT SOMETHING ON THE BIGGEST SURFACE IN THE GAME.
// docs/PROPOSAL-SPRITE-UPGRADE-2026-09-22.md, T2.3. SPEC §12.2.
//
// `tools/faceprobe.mjs` measured it: 66.1% of every standing pixel in this
// city is a TOP face, and by family it is worse than the headline — the
// cemetery is 90% roof, the large park 88%, the industrial works 74–75%.
// Every one of those faces was a single flat quad with at most one plant box
// on it. T2.2 gave them the zone's colour; this gives them something to be.
//
// IT IS FOUND, NOT PLACED. Hand-placing furniture on 315 recipes is 315
// chances to put a water tank through a roof. Instead `decksOf` reads the
// boxes a recipe already has and returns the top faces that are EXPOSED TO
// THE SKY — a box's top, minus any box standing on it — and the furniture is
// laid on those. A family that changes shape keeps its furniture, because the
// furniture was never written down against that shape.
//
// The idea is `building-character.js`'s, not mine: `socketsFor` already finds
// a building's most VISIBLE roof point by asking the z-buffer, which is how
// the occupancy lights and the species stamps know where to sit. This is the
// same move with the answer widened from one point to every deck.
//
// INSIDE THE PRISM, ALWAYS. check.mjs gates every box to a, b ∈ [0, 16·side]:
// a parapet is therefore laid INSIDE its deck's edge, never straddling it —
// the works' roof is flush with its tile at a = 0 and a straddling rail would
// hang a pixel over the neighbour.

import { box, flatSkin } from "./solid.js";
import { keysOf } from "./palette.js";

const EPS = 0.01;

/**
 * The top faces of `boxes` that nothing stands on, largest first:
 * `{ a0, a1, b0, b1, c }`. A box is covered when another box begins at or
 * above its top and spans its plan — that is the roof of a tower over the
 * podium it rises from, and the podium's ring is still a deck.
 */
export function decksOf(boxes) {
  const decks = [];
  for (const b of boxes) {
    if (!b.faces || !b.faces.top) continue;
    if (b.a1 - b.a0 < 3 || b.b1 - b.b0 < 3) continue; // a sill or a string course is not a deck
    const covered = boxes.some((o) =>
      o !== b && o.c0 >= b.c1 - EPS &&
      o.a0 <= b.a0 + EPS && o.a1 >= b.a1 - EPS &&
      o.b0 <= b.b0 + EPS && o.b1 >= b.b1 - EPS);
    if (covered) continue;
    decks.push({ a0: b.a0, a1: b.a1, b0: b.b0, b1: b.b1, c: b.c1 });
  }
  return decks.sort((p, q) => (q.a1 - q.a0) * (q.b1 - q.b0) - (p.a1 - p.a0) * (p.b1 - p.b0));
}

/** How much of a deck another box already occupies — so furniture does not land on a chimney. */
const freeSpot = (deck, boxes, a, b, w, d) => !boxes.some((o) =>
  o.c1 > deck.c + EPS && o.a1 > a - 0.6 && o.a0 < a + w + 0.6 && o.b1 > b - 0.6 && o.b0 < b + d + 0.6);

/**
 * The share of a deck that something else already stands on.
 *
 * A RAIL BELONGS ON A FLAT ROOF, NOT A PITCHED ONE. The first pass railed
 * every deck ≥ 6×6, and the hipped roofs — the cottage's stepped slope, which
 * is four inset slabs, each of them a "deck" by the exposed-top test — came
 * out as concentric rings: a bullseye on every house in the scene. A step of
 * a pitch carries the next step on ~77% of its area; a genuine flat roof
 * carries a plant box or a chimney on a few per cent. That ratio is the
 * difference, and it needs no family to declare itself.
 */
function coveredShare(deck, boxes) {
  const area = (deck.a1 - deck.a0) * (deck.b1 - deck.b0);
  if (area <= 0) return 1;
  let on = 0;
  for (const o of boxes) {
    if (o.c0 < deck.c - EPS) continue;
    const da = Math.min(o.a1, deck.a1) - Math.max(o.a0, deck.a0);
    const db = Math.min(o.b1, deck.b1) - Math.max(o.b0, deck.b0);
    if (da > 0 && db > 0) on += da * db;
  }
  return on / area;
}

/**
 * A PARAPET: a low rail inside the deck's edge, its top one rung LIGHTER
 * than the deck it rings. That one rung is the whole trick — a flat quad
 * with a brighter border reads as a surface with a raised edge, which is
 * what a roof is, and it costs four boxes.
 */
function parapet(deck, skin, h = 1.3, w = 0.9) {
  const { a0, a1, b0, b1, c } = deck;
  return [
    box(a0, a0 + w, b0, b1, c, c + h, skin),
    box(a1 - w, a1, b0, b1, c, c + h, skin),
    box(a0, a1, b0, b0 + w, c, c + h, skin),
    box(a0, a1, b1 - w, b1, c, c + h, skin),
  ];
}

/** A hut on the roof — a stair head or a lift motor room. */
const hut = (deck, a, b, skin, w = 4, d = 4, h = 4.5) => [box(a, a + w, b, b + d, deck.c, deck.c + h, skin)];

/** A vent or an extractor: a small block, or a stack if `h` is tall. */
const stack = (deck, a, b, skin, s = 1.6, h = 2) => [box(a, a + s, b, b + s, deck.c, deck.c + h, skin)];

/** A water tank on four legs — the industrial silhouette, and it reads at 1×. */
function tank(deck, a, b, skin, legSkin, s = 4.5, legs = 3) {
  const out = [];
  for (const [la, lb] of [[a, b], [a + s - 0.8, b], [a, b + s - 0.8], [a + s - 0.8, b + s - 0.8]]) {
    out.push(box(la, la + 0.8, lb, lb + 0.8, deck.c, deck.c + legs, legSkin));
  }
  out.push(box(a, a + s, b, b + s, deck.c + legs, deck.c + legs + 3.5, skin));
  return out;
}

/** Washing on a line: posts, and sheets hanging between them. Fabric, which is what `fabric` was added for. */
function laundry(deck, a, b, postSkin, clothSkin, span = 9) {
  const out = [
    box(a, a + 0.6, b, b + 0.6, deck.c, deck.c + 4, postSkin),
    box(a + span, a + span + 0.6, b, b + 0.6, deck.c, deck.c + 4, postSkin),
  ];
  for (let k = 1.2; k < span - 1; k += 2.6) {
    out.push(box(a + k, a + k + 1.8, b + 0.1, b + 0.5, deck.c + 1.4, deck.c + 3.4, clothSkin));
  }
  return out;
}

/**
 * Furniture for one recipe. `zone` picks the vocabulary, `variant` the
 * arrangement, so the six plans of a family do not all wear the same hat;
 * both are already decided by the saved tile byte, so nothing here is random
 * and no city hashes differently for it.
 */
export function furnish(boxes, { zone, variant = 0, skins }) {
  const decks = decksOf(boxes);
  if (!decks.length) return [];
  const { roof, rail, pale, dark, rust, timber, cloth } = skins;
  const out = [];
  const big = decks.filter((d) => d.a1 - d.a0 >= 6 && d.b1 - d.b0 >= 6 && coveredShare(d, boxes) < 0.35);

  // Every FLAT deck wide enough gets its rail. This alone is most of the effect.
  for (const d of big) out.push(...parapet(d, rail));

  const d = big[0];
  if (!d) return out;
  const mid = (x0, x1) => (x0 + x1) / 2;
  const pick = variant % 3;

  if (zone === 1) {
    // R: washing on the line, or a stair hut, by variant.
    const span = Math.min(9, d.a1 - d.a0 - 3);
    if (pick === 0 && span >= 5 && freeSpot(d, boxes, d.a0 + 1.5, mid(d.b0, d.b1), span, 1)) {
      out.push(...laundry(d, d.a0 + 1.5, mid(d.b0, d.b1) - 0.3, timber, cloth, span));
    } else if (freeSpot(d, boxes, d.a0 + 2, d.b0 + 2, 4, 4)) {
      out.push(...hut(d, d.a0 + 2, d.b0 + 2, roof, 4, 4, 3.5));
    }
  } else if (zone === 2) {
    // C: a stair head and a vent or two — the flat commercial roof.
    if (freeSpot(d, boxes, d.a1 - 6, d.b0 + 2, 4, 4)) out.push(...hut(d, d.a1 - 6, d.b0 + 2, pale, 4, 4, 4.5));
    if (freeSpot(d, boxes, d.a0 + 2, d.b1 - 4, 1.6, 1.6)) out.push(...stack(d, d.a0 + 2, d.b1 - 4, pale, 1.6, 2));
    if (pick === 1 && freeSpot(d, boxes, d.a0 + 5, d.b1 - 4, 1.6, 1.6)) out.push(...stack(d, d.a0 + 5, d.b1 - 4, pale, 1.6, 2.6));
  } else if (zone === 3) {
    // I: a tank on legs, and ducting along the deck.
    const s = Math.min(4.5, d.a1 - d.a0 - 4, d.b1 - d.b0 - 4);
    if (s >= 3 && freeSpot(d, boxes, d.a0 + 2, d.b0 + 2, s, s)) out.push(...tank(d, d.a0 + 2, d.b0 + 2, rust, dark, s));
    const duct = Math.min(10, d.a1 - d.a0 - 4);
    if (duct >= 4 && freeSpot(d, boxes, d.a1 - duct - 1.5, d.b1 - 4, duct, 1.6)) {
      out.push(box(d.a1 - duct - 1.5, d.a1 - 1.5, d.b1 - 4, d.b1 - 2.4, d.c, d.c + 1.4, rust));
    }
  } else {
    // CIVIC (zone 0). The campuses are the worst roofs in the game — the
    // cemetery is 90% top face and 77% of that is ONE quad — but they must
    // stay GREY, because grey is how a player tells a civic building from a
    // zoned one now that the zones have colours. So: the rail, a plant room,
    // and a vent. Shape, not hue.
    if (freeSpot(d, boxes, mid(d.a0, d.a1) - 2, d.b0 + 2.5, 4, 4)) {
      out.push(...hut(d, mid(d.a0, d.a1) - 2, d.b0 + 2.5, pale, 4, 4, 3.5));
    }
    for (const [a, b] of [[d.a0 + 2.5, d.b1 - 4.5], [d.a1 - 4.5, d.b1 - 4.5]]) {
      if (freeSpot(d, boxes, a, b, 1.6, 1.6)) out.push(...stack(d, a, b, dark, 1.6, 1.8));
    }
  }
  return out;
}

/**
 * The skin bag, per zone, built once from the palette itself — zone 0 is a
 * civic campus. It reads `keysOf` directly rather than being threaded down
 * from `buildings.js`, because four civic modules need it too and passing a
 * bag through each of them is four chances to pass a different one.
 */
const TILE = keysOf("tile"), CONC = keysOf("concrete"), RUST = keysOf("rust");
const SLATE = keysOf("slate"), TIMBER_KEYS = keysOf("timber"), FABRIC = keysOf("fabric");

const RAIL = {
  0: flatSkin(CONC[3], SLATE[2], SLATE[1]), // civic: grey, and a rung up from its deck
  1: flatSkin(TILE[3], TILE[2], TILE[1]),
  2: flatSkin(CONC[4], CONC[2], SLATE[1]),
  3: flatSkin(RUST[3], RUST[2], RUST[1]),
};
const ROOF = {
  0: flatSkin(SLATE[2], SLATE[1], SLATE[0]),
  1: flatSkin(TILE[2], TILE[1], TILE[0]),
  2: flatSkin(CONC[3], SLATE[1], SLATE[0]),
  3: flatSkin(RUST[2], RUST[1], RUST[0]),
};
const COMMON = {
  pale: flatSkin(CONC[3], CONC[2], CONC[1]),
  dark: flatSkin(SLATE[2], SLATE[1], SLATE[0]),
  rust: flatSkin(RUST[2], RUST[1], RUST[0]),
  timber: flatSkin(TIMBER_KEYS[2], TIMBER_KEYS[1], TIMBER_KEYS[0]),
  cloth: flatSkin(FABRIC[3], FABRIC[2], FABRIC[1]),
};
const BAGS = {};
for (const z of [0, 1, 2, 3]) BAGS[z] = Object.freeze({ roof: ROOF[z], rail: RAIL[z], ...COMMON });

/** The furniture skins for a zone (0 = civic). */
export const skinsFor = (zone) => BAGS[zone] || BAGS[0];

/** Furniture for a whole recipe, skins included — what every caller actually wants. */
export const dress = (boxes, zone, variant = 0) => [...boxes, ...furnish(boxes, { zone, variant, skins: skinsFor(zone) })];
