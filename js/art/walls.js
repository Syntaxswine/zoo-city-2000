// walls.js — the wall, its sixteen joins, and the tunnel. SPEC §12.4b.
//
// After Glades of Arcadia's DRYSTONE_WALL and its gateway (js/art/props.js
// there — the owner's pointer). The SHAPE is solid boxes through solid.js:
// one N–S bar and one E–W bar, each clipped to the arms the mask sets (N=1
// E=2 S=4 W=8, the road's mask), so a run is exactly one tile long and two
// neighbours never cover each other — Glades' wall was 1.97 tiles for a
// whole arc and only a gate exposed it. The cut end is one step darker than
// the near face: shaded alike, a bend reads as folded paper. A lone tile
// draws the straight E|W run: "a piece with no neighbours is still a wall,
// not a post". Nobody hand-rolls a top face; the rasteriser owns it.
//
// THE TUNNEL is two piers either side of the road and a lintel over it,
// drawn as a STANDING sprite so the road tile beneath stays the road: the
// wall runs across, the road runs through, and the field flood (sim/reach.js)
// passes along the road's axis only. Both piers are always drawn — a gate
// has two posts whatever the wall does next door.

import { defineSprite } from "./format.js";
import { keysOf } from "./palette.js";
import { box, render, A_STEP } from "./solid.js";
import { hash } from "./terrain.js";

const CONC = keysOf("concrete"); // % ^ & * (  dark → light
export const N = 1, E = 2, S = 4, W = 8;
const TH = 4; // thickness, units of a 16-unit tile
const H = 9; // height, units
const A0 = 8 - TH / 2; // 6
const A1 = 8 + TH / 2; // 10
const ROAD_HALF = 5; // roads.js: the road is 10 of the tile's 16 units wide
const LINTEL = 3; // the lintel's depth, units

/** Coursed masonry: a mortar line every third unit down a face, a little grain, the coping one step lighter than the face. */
const SKIN = {
  top: (a, b, x, y) => (hash(x, y, 71) < 0.1 ? CONC[2] : CONC[3]),
  side: (a, k, x, y) => (Math.floor(k) % 3 === 2 ? CONC[1] : hash(x, y, 72) < 0.12 ? CONC[1] : CONC[2]),
  end: (b, k, x, y) => (Math.floor(k) % 3 === 2 ? CONC[0] : CONC[1]),
};

/** Two bars clipped to the arms: the N–S bar spans b, the E–W bar spans a; both cover the centre pad. */
function wallBoxes(mask) {
  const arms = mask === 0 ? E | W : mask;
  const bN = arms & N ? 0 : A0;
  const bS = arms & S ? 16 : A1;
  const aW = arms & W ? 0 : A0;
  const aE = arms & E ? 16 : A1;
  const boxes = [];
  if (bN < A0 || bS > A1) boxes.push(box(A0, A1, bN, bS, 0, H, SKIN));
  if (aW < A0 || aE > A1) boxes.push(box(aW, aE, A0, A1, 0, H, SKIN));
  if (!boxes.length) boxes.push(box(A0, A1, A0, A1, 0, H, SKIN));
  return boxes;
}

/** A gate: piers either side of the road's width and a lintel across; `axis` is the road's ("ns" runs along b). */
function tunnelBoxes(axis) {
  const lo = 8 - ROAD_HALF; // 3
  const hi = 8 + ROAD_HALF; // 13
  if (axis === "ns") {
    return [box(0, lo, A0, A1, 0, H, SKIN), box(hi, 16, A0, A1, 0, H, SKIN), box(lo, hi, A0, A1, H - LINTEL, H, SKIN)];
  }
  return [box(A0, A1, 0, lo, 0, H, SKIN), box(A0, A1, hi, 16, 0, H, SKIN), box(A0, A1, lo, hi, H - LINTEL, H, SKIN)];
}

const make = (name, boxes) => {
  const r = render(boxes, { hub: A_STEP / 2 });
  return defineSprite({ name, anchor: r.anchor, rows: r.rows, tags: ["building", "wall"] });
};

/** WALLS[mask] — 16 sprites. */
export const WALLS = Array.from({ length: 16 }, (_, mask) => make(`wall-${mask}`, wallBoxes(mask)));
export const TUNNELS = { ns: make("tunnel-ns", tunnelBoxes("ns")), ew: make("tunnel-ew", tunnelBoxes("ew")) };

export function wallSprite(mask) {
  return WALLS[mask & 15];
}
export function tunnelSprite(axis = "ns") {
  return TUNNELS[axis === "ew" ? "ew" : "ns"];
}

/** Every wall sprite, named, for the audit. */
export function allWalls() {
  const out = WALLS.map((s) => ({ name: s.name, sprite: s }));
  out.push({ name: TUNNELS.ns.name, sprite: TUNNELS.ns }, { name: TUNNELS.ew.name, sprite: TUNNELS.ew });
  return out;
}
