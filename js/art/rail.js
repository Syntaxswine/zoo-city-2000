// rail.js — the 16 rail tiles and the station. SPEC §12.4c.
//
// The same arm composition as roads.js (mask N=1 E=2 S=4 W=8, the arms
// evaluated in world space, never pixel-flipped): a ballast bed 6 of the
// tile's 16 units wide in dark earth, a sleeper every two units across each
// arm, and two rails 1.2 units either side of the arm's centre line in the
// asphalt ramp's lightest key. The margins are the same dithered grass as
// the road's, so a rail tile never shows a different green.
//
// THE STATION is a standing solid over a rail tile: a platform slab along
// one side of the track and a shelter — two posts and a roof — on it, so the
// track sprite shows under the canopy. Its axis is the track's ("ns" runs
// along b); the platform sits on the +a side of a N–S track and the +b side
// of an E–W one. A station is served when a road reaches it within
// ROAD_REACH; passengers walk the intervening forecourt (sim/fields.js).
// The art does not know, and the card says.

import { defineSprite } from "./format.js";
import { keysOf } from "./palette.js";
import { box, render, A_STEP, RECIPES } from "./solid.js";
import { groundSprite, grassKey, hash, TILE_ANCHOR } from "./terrain.js";
import { onRoad, roadKey, tarmacKey, bridgeBoxes } from "./roads.js";

const EARTH = keysOf("earth"); // q r s t u
const ASPH = keysOf("asphalt"); // 1 2 3 4
const CONC = keysOf("concrete"); // % ^ & * (
export const N = 1, E = 2, S = 4, W = 8;
const HALF = 3; // half the bed's width, units
const RAIL_AT = 1.2; // a rail's offset from the arm's centre line
const RAIL_W = 0.45;

/** Is world point (a, b) on the bed of `mask`? Points outside the tile continue the arm (roads.js's rule). */
export function onRail(mask, a, b) {
  const ca = a - 8, cb = b - 8;
  const inA = Math.abs(ca) < HALF, inB = Math.abs(cb) < HALF;
  if (inA && inB) return true;
  if (inA && cb < 0 && mask & N) return true;
  if (inA && cb > 0 && mask & S) return true;
  if (inB && ca > 0 && mask & E) return true;
  if (inB && ca < 0 && mask & W) return true;
  return false;
}

/** Which arm axis a bed point belongs to: "ns" (along b), "ew" (along a), or "pad" at the centre. */
function armOf(mask, a, b) {
  const ca = a - 8, cb = b - 8;
  const inA = Math.abs(ca) < HALF, inB = Math.abs(cb) < HALF;
  if (inA && inB) {
    // The pad: a junction shows sleepers of the arm the point leans toward.
    if (Math.abs(cb) >= Math.abs(ca) && mask & (N | S)) return "ns";
    if (mask & (E | W)) return "ew";
    return mask & (N | S) ? "ns" : "pad";
  }
  if (inA) return "ns";
  return "ew";
}

/** Rail surface key at (a, b, px, py) for mask; null off the bed. */
export function railKey(mask, a, b, px, py) {
  if (!onRail(mask, a, b)) return null;
  const axis = armOf(mask, a, b);
  const ca = a - 8, cb = b - 8;
  if (axis === "pad") return EARTH[0];
  const across = axis === "ns" ? ca : cb; // distance across the arm
  const along = axis === "ns" ? b : a; // position along the arm
  if (Math.abs(Math.abs(across) - RAIL_AT) < RAIL_W) return ASPH[3]; // the rails
  if (Math.floor(along) % 2 === 0 && Math.abs(across) < HALF - 0.5) return EARTH[2]; // a sleeper
  return hash(px, py, 83) < 0.15 ? EARTH[1] : EARTH[0]; // ballast
}

const railFn = (mask) => (a, b, px, py) => railKey(mask, a, b, px, py) || grassKey(px, py, 0);

/** RAILS[mask] — 16 sprites (ground diamonds with a recipe, so the hi-res set can remake them at 2×). */
export const RAILS = Array.from({ length: 16 }, (_, mask) => groundSprite({ name: `rail-${mask}`, anchor: TILE_ANCHOR, tags: ["ground", "rail"] }, railFn(mask)));

export function railSprite(mask) {
  return RAILS[mask & 15];
}

// ------------------------------------------------------------------ station

const SLAB = { top: (a, b, x, y) => (hash(x, y, 91) < 0.08 ? CONC[2] : CONC[3]), side: () => CONC[2], end: () => CONC[1] };
const ROOF = { top: (a, b, x, y) => (Math.floor(b) % 2 === 0 ? ASPH[1] : ASPH[2]), side: () => ASPH[1], end: () => ASPH[0] };
const POST = { top: () => CONC[1], side: () => CONC[1], end: () => CONC[0] };

/** A platform beside the track and a shelter on it. */
function stationBoxes(axis) {
  const boxes = [];
  if (axis === "ns") {
    boxes.push(box(11, 16, 0, 16, 0, 1.5, SLAB)); // the platform, +a side
    boxes.push(box(12, 13, 3, 4, 1.5, 7, POST), box(12, 13, 12, 13, 1.5, 7, POST)); // two posts
    boxes.push(box(11, 16, 2, 14, 7, 8, ROOF)); // the roof
  } else {
    boxes.push(box(0, 16, 11, 16, 0, 1.5, SLAB)); // the platform, +b side
    boxes.push(box(3, 4, 12, 13, 1.5, 7, POST), box(12, 13, 12, 13, 1.5, 7, POST));
    boxes.push(box(2, 14, 11, 16, 7, 8, ROOF));
  }
  return boxes;
}

const makeStation = (axis) => {
  const boxes = stationBoxes(axis);
  const r = render(boxes, { hub: A_STEP / 2 });
  const s = defineSprite({ name: `station-${axis}`, anchor: r.anchor, rows: r.rows, tags: ["building", "station"] });
  RECIPES.set(s, { name: s.name, boxes, hub: A_STEP / 2, footprint: [1, 1], extent: [], stamps: [] }); // the hi-res set re-renders it at 2×
  return s;
};
export const STATIONS = { ns: makeStation("ns"), ew: makeStation("ew") };

export function stationSprite(axis = "ns") {
  return STATIONS[axis === "ew" ? "ew" : "ns"];
}

// ------------------------------------------------------------------ the level crossing

/**
 * THE LEVEL CROSSING (SPEC §7.9, §12.4c) — a road and a line on one tile.
 *
 * The road half is drawn by roads.js's own predicate and the line half by
 * this file's, each from the tile's LIVE mask, so a crossing can never
 * disagree with the road beside it or the track beside it — and one whose
 * neighbour came down draws the stub it has become rather than a straight
 * run that is no longer there. Where the two overlap the ballast, the
 * sleepers and the lane dash all stop and the two rails run flush in the
 * tarmac, which is what a crossing looks like from above; where the line
 * leaves the road it is ordinary track again. The one piece of furniture is
 * a concrete apron in each corner where the road's edge meets the bed's
 * edge — composed from BOTH masks, so a stub grows only the corners it
 * still has.
 *
 * The family is 16 road masks × 16 rail masks × busy = 512 tiles, so it is
 * composed LAZILY and cached: a city pays for the crossings it actually
 * has, and a city with none pays nothing — which is why `squareOnCrossings`
 * below is a function and not a const. The four square-on tiles the rule
 * allows (SPEC §7.9) are in the audit and on the sheet; the suite walks all
 * 512 for legality.
 */
const APRON = 1.5; // the concrete corner, in units

/** Crossing surface key at (a, b, px, py) for the two masks; null off both. */
export function crossingKey(roadMask, railMask, busy, a, b, px, py) {
  const onBed = onRail(railMask, a, b);
  const onTar = onRoad(roadMask, a, b);
  if (onBed && onTar) {
    const axis = armOf(railMask, a, b);
    // A line with no neighbour left is a bare bed pad and has no direction to
    // lay rails along — `art.rail(0)` draws it as bare ballast, and so does
    // this. Falling through to tarmac here made a crossing whose line had been
    // bulldozed off BOTH sides pixel-identical to a plain road, while the city
    // went on charging for the line, counting it, riding it and smoking it.
    if (axis === "pad") return railKey(railMask, a, b, px, py);
    const across = axis === "ns" ? a - 8 : b - 8;
    if (Math.abs(Math.abs(across) - RAIL_AT) < RAIL_W) return ASPH[3]; // the rails, flush in the road
    return tarmacKey(px, py); // no ballast, no sleeper, no dash where the line crosses
  }
  if (onBed) return railKey(railMask, a, b, px, py);
  if (onTar) return roadKey(roadMask, busy, a, b, px, py);
  const nearRoad = onRoad(roadMask, a + APRON, b) || onRoad(roadMask, a - APRON, b) || onRoad(roadMask, a, b + APRON) || onRoad(roadMask, a, b - APRON);
  const nearBed = onRail(railMask, a + APRON, b) || onRail(railMask, a - APRON, b) || onRail(railMask, a, b + APRON) || onRail(railMask, a, b - APRON);
  if (nearRoad && nearBed) return CONC[1]; // the apron in the corner
  return null;
}

const crossFn = (roadMask, railMask, busy) => (a, b, px, py) => crossingKey(roadMask, railMask, busy, a, b, px, py) || grassKey(px, py, 0);

const CROSSINGS = new Map();

/** The crossing of `roadMask` and `railMask` — composed on first sight and kept (512 in the family; a city builds the few it has). */
export function crossingSprite(roadMask, railMask, busy = false) {
  const rd = roadMask & 15;
  const rl = railMask & 15;
  const b = busy ? 1 : 0;
  const key = (rd << 5) | (rl << 1) | b;
  let s = CROSSINGS.get(key);
  if (!s) {
    s = groundSprite({ name: `crossing-${rd}-${rl}${b ? "-busy" : ""}`, anchor: TILE_ANCHOR, tags: ["ground", "rail", "crossing"] }, crossFn(rd, rl, !!b));
    CROSSINGS.set(key, s);
  }
  return s;
}

/**
 * The four the rule allows (SPEC §7.9), keyed by the LINE's axis:
 * `squareOnCrossings()[busy][railAxis]`. A FUNCTION, not a const: at module
 * scope it would rasterise four diamonds on every import and the family
 * would not be lazy after all — only 508 of the 512 would be. The audit and
 * the sheet call it; the game never does.
 */
export const squareOnCrossings = () => [0, 1].map((busy) => ({
  ns: crossingSprite(E | W, N | S, !!busy), // a N–S line across an E–W road
  ew: crossingSprite(N | S, E | W, !!busy), // an E–W line across a N–S road
}));

export const RAIL_BRIDGES = Array.from({length:16},(_,mask)=>{
  const boxes=bridgeBoxes(mask,(a,b,x,y)=>railKey(mask,a,b,x,y));
  const r=render(boxes,{hub:A_STEP/2});
  const s=defineSprite({name:`rail-bridge-${mask}`,anchor:r.anchor,rows:r.rows,tags:["ground","rail","bridge"]});
  RECIPES.set(s,{name:s.name,boxes,hub:A_STEP/2,footprint:[1,1],extent:[],stamps:[]});return s;
});
export const railBridgeSprite = mask => RAIL_BRIDGES[mask&15];

/** Every rail sprite, named, for the audit. */
export function allRail() {
  const out = [...RAILS,...RAIL_BRIDGES].map((s) => ({ name: s.name, sprite: s }));
  out.push({ name: STATIONS.ns.name, sprite: STATIONS.ns }, { name: STATIONS.ew.name, sprite: STATIONS.ew });
  const sq = squareOnCrossings();
  for (const busy of [0, 1]) for (const axis of ["ns", "ew"]) out.push({ name: sq[busy][axis].name, sprite: sq[busy][axis] });
  return out;
}
