// roads.js — the 16 road tiles, the busy variant, and the bridge. SPEC §12.4.
//
// THE MASK. Bit N = 1 (ty − 1, up-right on screen), E = 2 (tx + 1,
// down-right), S = 4 (ty + 1, down-left), W = 8 (tx − 1, up-left). A road
// tile is the union of a centre pad and one ARM per set bit; the three
// authored strips SPEC names — straight (N|S), corner (N|E), stub (N) — are
// exported below as the reference rows, and every mask is that same arm
// composition evaluated in world space rather than by flipping pixels,
// because a pixel flip of a 2:1 diamond lands half a pixel off and shows a
// seam down the tile's spine. (Rotating the ARM by 90° in world space is
// exact; rotating its pixels is not.)
//
// The road is 10 of the tile's 16 units wide, in asphalt '3' with a 1-px
// darker kerb '2' where it meets grass, and the tile's margins are the same
// dithered grass as `terrain.GRASS[0]` so a road tile never shows a
// different green from its neighbours. Busy = lane dashes in '4' along each
// arm's centre line.
//
// THE BRIDGE is a deck box on two piers (four for a junction), rendered by
// solid.js, whose top face is skinned with the SAME road predicate — so a
// bridge tile's road lines up with the road tiles on either bank. It stands
// DECK_TOP (3) px above the water and the deck slab is 2 px thick (a
// 1.5-px slab sampled every other column and its rail came out as white
// dots). A straight deck is the road's width plus a HALF-UNIT PARAPET each
// side, drawn on purpose in mid concrete '&': round 2 made the deck exactly
// road width and let the top skin fall back to light concrete wherever the
// rasteriser's sample landed on a = a0 or a1 (`onRoad` is strict), which
// happens on alternate columns of a 2:1 edge — a boundary-sample stipple,
// not a rail. Now the rim is a deliberate 2-px line plus its own faces.
// The un-roaded top of a corner/junction deck is the same '&', not the
// palette's lightest key (which read as a white L). Anything standing on a
// bridge tile is lifted by DECK_TOP: the painter applies an item's `dy`,
// and the scene in tools/shots.mjs sets dy = −DECK_TOP for walkers on
// bridge tiles; the renderer must do the same for `road === 2` (it does
// not yet — see the round-3 report).

import { defineSprite, T } from "./format.js";
import { keysOf } from "./palette.js";
import { box, render, litSkin, A_STEP, RECIPES } from "./solid.js";
import { diamond, groundSprite, grassKey, hash, TILE_ANCHOR } from "./terrain.js";

const ASPH = keysOf("asphalt"); // 1 2 3 4
const CONC = keysOf("concrete");

export const N = 1, E = 2, S = 4, W = 8;
const HALF = 5; // half the road width, in units

/** Is world point (a, b) on the road of `mask`? Points outside the tile continue the arm. */
export function onRoad(mask, a, b) {
  const ca = a - 8, cb = b - 8;
  const inA = Math.abs(ca) < HALF, inB = Math.abs(cb) < HALF;
  if (inA && inB) return true;
  if (inA && cb < 0 && mask & N) return true;
  if (inA && cb > 0 && mask & S) return true;
  if (inB && ca > 0 && mask & E) return true;
  if (inB && ca < 0 && mask & W) return true;
  return false;
}

/** Road surface key at (a, b, px, py) for mask; null for off-road. */
export function roadKey(mask, busy, a, b, px, py) {
  if (!onRoad(mask, a, b)) return null;
  const d = 0.75;
  const edge = !onRoad(mask, a - d, b) || !onRoad(mask, a + d, b) || !onRoad(mask, a, b - d) || !onRoad(mask, a, b + d);
  if (edge) return ASPH[1];
  if (busy) {
    const ca = a - 8, cb = b - 8;
    const nsArm = mask & (N | S) && Math.abs(ca) < 0.5 && (cb < -HALF + 1 ? mask & N : cb > HALF - 1 ? mask & S : mask === (N | S) || mask === N || mask === S);
    const ewArm = mask & (E | W) && Math.abs(cb) < 0.5 && (ca > HALF - 1 ? mask & E : ca < -HALF + 1 ? mask & W : mask === (E | W) || mask === E || mask === W);
    const dash = nsArm ? Math.floor(b) % 4 < 2 : ewArm ? Math.floor(a) % 4 < 2 : false;
    if (dash) return ASPH[3];
  }
  return tarmacKey(px, py);
}

/** The plain tarmac at a screen pixel — the road away from its kerb and its dashes. The level crossing (rail.js) lays its rails in this, so the two can never disagree about what a road looks like. */
export function tarmacKey(px, py) {
  return hash(px, py, 61) < 0.08 ? ASPH[1] : ASPH[2];
}

const roadFn = (mask, busy) => (a, b, px, py) => roadKey(mask, busy, a, b, px, py) || grassKey(px, py, 0);
function roadRows(mask, busy) {
  return diamond(roadFn(mask, busy));
}

/** The three reference strips SPEC §12.4 names. */
export const STRIP_STRAIGHT = roadRows(N | S, false);
export const STRIP_CORNER = roadRows(N | E, false);
export const STRIP_STUB = roadRows(N, false);

/** ROADS[busy ? 1 : 0][mask] — 32 sprites (ground diamonds with a recipe, so the hi-res set can remake them at 2×). */
export const ROADS = [0, 1].map((busy) =>
  Array.from({ length: 16 }, (_, mask) => groundSprite({ name: `road-${mask}${busy ? "-busy" : ""}`, anchor: TILE_ANCHOR, tags: ["ground", "road"] }, roadFn(mask, !!busy)))
);

export function roadSprite(mask, busy = false) {
  return ROADS[busy ? 1 : 0][mask & 15];
}

// ------------------------------------------------------------------ bridge

/** Height of the bridge deck above the water, in px; lift what stands on it by this. */
export const DECK_TOP = 3;
const DECK_THICK = 2;
const PARAPET = 0.5;
export function bridgeBoxes(mask, surface = (a,b,x,y) => roadKey(mask, false, a,b,x,y)) {
  const straightNS = mask === (N | S);
  const straightEW = mask === (E | W);
  const a0 = straightNS ? 8 - HALF - PARAPET : 0, a1 = straightNS ? 8 + HALF + PARAPET : 16;
  const b0 = straightEW ? 8 - HALF - PARAPET : 0, b1 = straightEW ? 8 + HALF + PARAPET : 16;
  const deckSkin = {
    top: (a, b, x, y) => surface(a + a0, b + b0, x, y) || CONC[2],
    side: () => CONC[1],
    end: () => CONC[0],
  };
  const pierTop = DECK_TOP - DECK_THICK;
  const pier = litSkin(CONC, { height: pierTop });
  const boxes = [];
  if (straightNS) {
    boxes.push(box(a0 + 0.5, a1 - 0.5, 0.5, 2.5, 0, pierTop, pier), box(a0 + 0.5, a1 - 0.5, 13.5, 15.5, 0, pierTop, pier));
  } else if (straightEW) {
    boxes.push(box(0.5, 2.5, b0 + 0.5, b1 - 0.5, 0, pierTop, pier), box(13.5, 15.5, b0 + 0.5, b1 - 0.5, 0, pierTop, pier));
  } else {
    for (const [pa, pb] of [[0.5, 0.5], [13.5, 0.5], [0.5, 13.5], [13.5, 13.5]]) boxes.push(box(pa, pa + 2, pb, pb + 2, 0, pierTop, pier));
  }
  boxes.push(box(a0, a1, b0, b1, pierTop, DECK_TOP, deckSkin));
  return boxes;
}

export const BRIDGES = Array.from({ length: 16 }, (_, mask) => {
  const boxes = bridgeBoxes(mask);
  const r = render(boxes, { hub: A_STEP / 2 });
  const s = defineSprite({ name: `bridge-${mask}`, anchor: r.anchor, rows: r.rows, tags: ["ground", "bridge"] });
  RECIPES.set(s, { name: s.name, boxes, hub: A_STEP / 2, footprint: [1, 1], extent: [], stamps: [] }); // the hi-res set re-renders it at 2×
  return s;
});

export function bridgeSprite(mask) {
  return BRIDGES[mask & 15];
}

/** Every road sprite, named, for the audit. */
export function allRoads() {
  const out = [];
  for (const busy of [0, 1]) for (const s of ROADS[busy]) out.push({ name: s.name, sprite: s });
  for (const s of BRIDGES) out.push({ name: s.name, sprite: s });
  return out;
}
