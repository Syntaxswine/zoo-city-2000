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
// of an E–W one. A station is a DOOR only when a road tile touches it
// (sim/fields.js): the art does not know, the card says.

import { defineSprite } from "./format.js";
import { keysOf } from "./palette.js";
import { box, render, A_STEP, RECIPES } from "./solid.js";
import { groundSprite, grassKey, hash, TILE_ANCHOR } from "./terrain.js";

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

/** Every rail sprite, named, for the audit. */
export function allRail() {
  const out = RAILS.map((s) => ({ name: s.name, sprite: s }));
  out.push({ name: STATIONS.ns.name, sprite: STATIONS.ns }, { name: STATIONS.ew.name, sprite: STATIONS.ew });
  return out;
}
