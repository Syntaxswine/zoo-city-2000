// blocks.js — the BLOCKS: one building on 2×2 or 3×3 tiles, per zone. SPEC §12.2b.
//
// The owner (2026-09-03): "i'd like some of commercial, industrial,
// residential, and meat buildings to be 2x2 and 3x3 tile sizes. these should
// be the buildings that can hold a lot of people. we need new cute images."
// Eight families — R, C, I, M × 2×2, 3×3 — each a list of boxes in world
// units (1 tile = 16; a 2×2's plan is a, b ∈ [0, 32], a 3×3's [0, 48])
// through the same rasteriser and skins as buildings.js, so a block reads
// as its zone: brick and slate for R, concrete and glass for C, rust for I,
// brown for M. The zoo's 2×2 is the precedent (hub at the footprint's
// centre; painter.js keys the sprite by its footprint).
//
// WHAT A BIG FOOTPRINT BUYS is COMPOSITION, which a 1×1 never had room for:
// wings round a courtyard, a garden with a fountain, a colonnade along a
// shop front, a yard with a tank and a stack of crates, pens beside a hall.
// The cute is in those — a tree in the court, a clock on the arcade, a van
// at the exchange — not in any face: nothing here draws a face, and every
// key is the palette's. LIGHT upper-left, always; END_GLASS on every +tx
// face; doors on a side face; boxes listed bottom-up.
//
// THE FOOTPRINT GATE (SPEC §12.5) holds for every plan here: every box has
// a, b ∈ [0, 16·side] and c ≥ 0 — check.mjs Part C asserts it on PLANS —
// and the ray audit (tools/depthaudit.mjs) runs over every one of these
// sprites against walkers on its four roads.
//
// VARIANTS. Variant 1 of every family is variant 0 with the plan mirrored
// across a = b (buildings.js `flipPlan`); the stamps (trees) mirror with it.
// The skins are not mirrored, so a door stays on a side face.

import { box, litSkin, flatSkin, A_STEP } from "./solid.js";
import { solidSprite, registerBlocks, KIT } from "./buildings.js";
import { TREE_ROUND, TREE_TALL, TREE_WILLOW } from "./terrain.js";

const { walled, doorAt, flipPlan, extentBox, BRICK, CONC, RUST, SLATE, EARTH, GRASS, SLATE_SKIN, C_ROOF, TIMBER, PLINTH, CONC_WALL, END_GLASS, AWNING, AWNING_M, SAWDUST, BRACKET, HOOK, LAMP, STEP, POST, brickGrain, ribGrain, ringGrain, TREE_REACH } = KIT;

// ---------------------------------------------------------------- shared

/** A stepped hipped slate roof over [a0, a1] × [b0, b1] from height h: an eave slab and `steps` risers each inset `inset`. The cottage's roof, generalised. */
function hipRoof(a0, a1, b0, b1, h, steps = 3, inset = 1.5) {
  const out = [box(a0 - 0.5, a1 + 0.5, b0 - 0.5, b1 + 0.5, h, h + 1, SLATE_SKIN)];
  for (let i = 1; i <= steps; i++) {
    const k = inset * i;
    if (a1 - a0 - 2 * k < 1 || b1 - b0 - 2 * k < 1) break;
    out.push(box(a0 + k, a1 - k, b0 + k, b1 - k, h + i, h + i + 1, SLATE_SKIN));
  }
  return out;
}

/** A brick chimney standing through the roof. */
const chimney = (a, b, h, size = 2) => box(a, a + size, b, b + size, 0, h, litSkin(BRICK, { grain: brickGrain, height: h }));

/** A low brick garden wall, `h` high. (In the plinth's grass keys it vanished on grass — the first sheet.) */
const gardenWall = (a0, a1, b0, b1, h = 2) => box(a0, a1, b0, b1, 0, h, litSkin(BRICK, { grain: brickGrain, height: h }));

/** The zoo's slat fence: every other unit a post, the top rail solid. */
const FENCE = {
  top: () => EARTH[4],
  side: (a) => (Math.floor(a) % 2 === 0 ? EARTH[3] : null),
  end: (b) => (Math.floor(b) % 2 === 0 ? EARTH[2] : null),
};
function pen(a0, a1, b0, b1, gateAt = null) {
  const out = [];
  const h = 4;
  out.push(box(a0, a1, b0, b0 + 1, 1, h, FENCE)); // back
  out.push(box(a0, a0 + 1, b0, b1, 1, h, FENCE)); // left
  // The two near fences, with a gate gap in the side fence.
  if (gateAt == null) out.push(box(a0, a1, b1 - 1, b1, 1, h, FENCE));
  else { out.push(box(a0, gateAt, b1 - 1, b1, 1, h, FENCE)); out.push(box(gateAt + 4, a1, b1 - 1, b1, 1, h, FENCE)); }
  out.push(box(a1 - 1, a1, b0, b1, 1, h, FENCE));
  out.push(box(a0, a1, b1 - 1, b1, h, h + 0.8, TIMBER)); // the rails
  out.push(box(a1 - 1, a1, b0, b1, h, h + 0.8, TIMBER));
  out.push(box(a0 + 1, a1 - 1, b0 + 1, b1 - 1, 0, 0.6, SAWDUST)); // the floor
  return out;
}

/** A sawtooth roof along `a` over [a0, a1] × [b0, b1] from height h: teeth `pitch` apart, glazed on the +tx face (END_GLASS, the shaded face — never day glass on the dark side). */
function sawtooth(a0, a1, b0, b1, h, pitch = 5) {
  const tooth = { top: () => SLATE[2], side: () => SLATE[1], end: (b, k) => (k < 2.5 ? END_GLASS : SLATE[0]) };
  const out = [];
  for (let a = a0; a + pitch * 0.8 <= a1 + 0.01; a += pitch) out.push(box(a, Math.min(a1, a + pitch * 0.8), b0, b1, h, h + 3.5, tooth));
  return out;
}

/** A rust stack with ring grain. */
const stack = (a, b, h, size = 3) => box(a, a + size, b, b + size, 0, h, litSkin(RUST, { grain: ringGrain, height: h }));

/** A water tank on four legs: rust, ring grain. */
function tank(a, b, legH = 8, size = 5) {
  const out = [];
  for (const [da, db] of [[0, 0], [size - 1, 0], [0, size - 1], [size - 1, size - 1]]) out.push(box(a + da, a + da + 1, b + db, b + db + 1, 0, legH, litSkin(RUST, { height: legH })));
  out.push(box(a - 0.5, a + size + 0.5, b - 0.5, b + size + 0.5, legH, legH + size, litSkin(RUST, { grain: ringGrain, height: size })));
  out.push(box(a + 1, a + size - 1, b + 1, b + size - 1, legH + size, legH + size + 1, litSkin(RUST, { height: 1 })));
  return out;
}

/** A bench: legs, seat, back (the park's). */
const bench = (a, b) => [box(a, a + 1, b, b + 2.5, 1, 4, TIMBER), box(a + 4, a + 5, b, b + 2.5, 1, 4, TIMBER), box(a - 0.5, a + 5.5, b - 0.5, b + 3, 4, 5.2, TIMBER), box(a - 0.5, a + 5.5, b - 0.5, b + 0.7, 5.2, 8, TIMBER)];

/** A fountain: a concrete basin with a glass top (the water), a stem and a bowl. */
function fountain(a, b, r = 4) {
  const basin = { top: () => "=", side: () => CONC[3], end: () => CONC[2] };
  return [
    box(a - r, a + r, b - r, b + r, 0, 1.5, basin),
    box(a - 0.75, a + 0.75, b - 0.75, b + 0.75, 1.5, 5, litSkin(CONC, { height: 3.5 })),
    box(a - 2, a + 2, b - 2, b + 2, 5, 6, { top: () => "=", side: () => CONC[3], end: () => CONC[2] }),
  ];
}

// The van at the exchange: the pacification centre's, without the cross.
const VAN = { top: () => "Z", side: () => "Y", end: (b, k) => (k < 2 ? "=" : "X") };
const WHEEL = flatSkin("+", "+", "+");
const van = (a, b) => [
  box(a - 0.5, a + 5.5, b - 0.5, b + 3, 0, 0.5, STEP),
  box(a + 0.5, a + 1.5, b + 2.5, b + 3, 0.5, 1.5, WHEEL),
  box(a + 3, a + 4, b + 2.5, b + 3, 0.5, 1.5, WHEEL),
  box(a, a + 4.5, b + 0.5, b + 3, 1.5, 5, VAN),
];

const mirrorStamps = (stamps) => stamps.map(([s, a, b, c]) => [s, b, a, c]);

function family(name, zoneLetter, side, make, { stamps = [] } = {}) {
  const boxes = make();
  const hub = (A_STEP * side) / 2;
  const n = 16 * side;
  const opts = (st) => ({ hub, footprint: [side, side], tags: ["building", "block", zoneLetter], extent: stamps.length ? [extentBox(0, n, 0, n, 0, TREE_REACH)] : [], stamps: st });
  return [
    solidSprite(`${zoneLetter}${side}x${side}-${name}-0`, boxes, opts(stamps)),
    solidSprite(`${zoneLetter}${side}x${side}-${name}-1`, flipPlan(boxes), opts(mirrorStamps(stamps))),
  ];
}

// ------------------------------------------------------------ residential

/**
 * The terrace court (R 2×2, 120): two three-storey brick wings in an L at
 * the back of the plot round a courtyard with a round tree, a bench and a
 * low garden wall with a gate gap on the near sides. Hipped slate roofs,
 * a chimney on each wing, a dormer on the long one. Doors open onto the
 * court from both wings.
 */
function terraceCourt() {
  const H = 24;
  const wallA = walled(litSkin(BRICK, { grain: brickGrain, height: H }), H, { storey: 8, sill: 3, winH: 3, period: 4, winW: 2, from: 1, door: doorAt(21, 6, 1.5) });
  const wallB = walled(litSkin(BRICK, { grain: brickGrain, height: H }), H, { storey: 8, sill: 3, winH: 3, period: 4, winW: 2, from: 1, door: doorAt(8, 6, 1.5), endWindows: true });
  const boxes = [
    // The back wing (along a, near the b = 0 edge): its side face looks onto the court.
    box(1, 31, 1, 10, 0, H, wallA),
    ...hipRoof(1, 31, 1, 10, H, 3, 1.5),
    chimney(26, 2, H + 8),
    box(12, 16, 7, 10.5, H + 1, H + 5, litSkin(BRICK, { grain: brickGrain, height: 4 })), // the dormer
    box(11.5, 16.5, 6.5, 11, H + 5, H + 6, SLATE_SKIN),
    // The left wing (along b, near the a = 0 edge): its end face looks onto the court.
    box(1, 10, 10, 31, 0, H, wallB),
    ...hipRoof(1, 10, 10, 31, H, 3, 1.5),
    chimney(2, 26, H + 8),
    // The garden wall round the court, a gate gap on each near side.
    gardenWall(10, 20, 30, 31), gardenWall(24, 31, 30, 31),
    gardenWall(30, 31, 10, 18), gardenWall(30, 31, 22, 30),
    box(10, 31, 10, 31, 0, 0.6, PLINTH), // the lawn
    box(12, 15, 27, 30, 0, 0.8, STEP), // the path stones
    box(17, 20, 24, 27, 0, 0.8, STEP),
    ...bench(23, 12),
  ];
  return boxes;
}

/**
 * The towers (R 3×3, 270): a U of five-storey brick blocks round a garden
 * — the back wing across the plot, two arms down its sides, a stair tower
 * a storey taller at the back with a lit lamp on its cap — a fountain and
 * two trees in the garden, balcony strips on every storey of the arms, and
 * a garden wall with a wide gate on the near side.
 */
function towers() {
  const H = 40;
  const brick = (door) => walled(litSkin(BRICK, { grain: brickGrain, height: H }), H, { storey: 8, sill: 3, winH: 3, period: 4, winW: 2, from: 1, door });
  const boxes = [
    box(1, 47, 1, 12, 0, H, brick(doorAt(24, 6, 1.5))), // the back wing
    box(0.5, 47.5, 0.5, 12.5, H, H + 1.5, SLATE_SKIN),
    box(3, 45, 3, 10, H + 1.5, H + 3, SLATE_SKIN),
    box(1, 12, 12, 40, 0, H, brick(doorAt(20, 6, 1.5))), // the left arm
    box(0.5, 12.5, 12, 40.5, H, H + 1.5, SLATE_SKIN),
    box(35, 47, 12, 40, 0, H, brick(doorAt(20, 6, 1.5))), // the right arm
    box(34.5, 47.5, 12, 40.5, H, H + 1.5, SLATE_SKIN),
    // The stair tower, a storey taller, a lamp on its cap.
    box(20, 28, 1, 9, H, H + 10, litSkin(BRICK, { grain: brickGrain, height: 10 })),
    box(19.5, 28.5, 0.5, 9.5, H + 10, H + 11, SLATE_SKIN),
    box(23, 25, 3, 5, H + 11, H + 13, LAMP),
    // Balcony strips on the arms' court-facing faces and the back wing's front.
    ...[1, 2, 3, 4].flatMap((k) => [box(11, 12, 14, 38, 8 * k, 8 * k + 1, SLATE_SKIN), box(35, 36, 14, 38, 8 * k, 8 * k + 1, SLATE_SKIN), box(14, 34, 11, 12, 8 * k, 8 * k + 1, SLATE_SKIN)]),
    // Chimneys.
    chimney(4, 2, H + 8), chimney(42, 2, H + 8),
    // The garden: lawn, path, fountain, the wall with its gate.
    box(12, 35, 12, 47, 0, 0.6, PLINTH),
    box(21, 26, 40, 47, 0, 0.8, STEP),
    ...fountain(23.5, 30, 4),
    gardenWall(12, 20, 46, 47), gardenWall(27, 35, 46, 47),
    gardenWall(35, 47, 40, 41, 1.5), gardenWall(46, 47, 41, 47, 1.5),
    box(35, 47, 41, 47, 0, 0.6, PLINTH),
    ...bench(38, 43),
  ];
  return boxes;
}

// ------------------------------------------------------------- commercial

/**
 * The arcade (C 2×2, 100): a two-storey concrete hall with a glass ground
 * floor on both faces, a glazed pavilion on its roof carrying a clock tower
 * with a white face and a lamp, and along its front a colonnade — five slim
 * posts carrying a slab, canvas awnings between them — so the shop front
 * has somewhere to stand out of the rain. (The first sheet's roof was three
 * flat trays — the cottage's ziggurat lesson — and read as a warehouse.)
 */
function arcade() {
  const H = 18;
  const base = litSkin(CONC_WALL, { height: H });
  const skin = {
    top: base.top,
    side: (a, k, x, y) => {
      const g = H - k;
      if (g >= 1.5 && g < 8 && Math.floor(a) % 6 !== 5) return a >= 13.5 && a < 16.5 && g < 6.5 ? "+" : "=";
      if (g >= 11 && g < 14 && Math.floor(a) % 4 >= 1 && Math.floor(a) % 4 < 3) return "=";
      return base.side(a, k, x, y);
    },
    end: (b, k, x, y) => {
      const g = H - k;
      if (g >= 1.5 && g < 8 && Math.floor(b) % 6 !== 5) return END_GLASS;
      if (g >= 11 && g < 14 && Math.floor(b) % 4 >= 1 && Math.floor(b) % 4 < 3) return END_GLASS;
      return base.end(b, k, x, y);
    },
  };
  // The clock: a 3-unit white face with a dark centre on both near faces of the tower box.
  const face = (u, k) => (u >= 1 && u < 4 && k >= 1.5 && k < 4.5 ? (u >= 2 && u < 3 && k >= 2.5 && k < 3.5 ? "+" : CONC[4]) : null);
  const clock = { top: () => CONC[3], side: (a, k) => face(a, k) || CONC[2], end: (b, k) => face(b, k) || CONC[1] };
  const lantern = { top: () => SLATE[2], side: (a, k) => (k >= 1 && k < 4 ? "=" : SLATE[1]), end: (b, k) => (k >= 1 && k < 4 ? END_GLASS : SLATE[0]) };
  const boxes = [
    box(1, 31, 1, 24, 0, H, skin),
    box(0.5, 31.5, 0.5, 24.5, H, H + 1, C_ROOF),
    // The pavilion: a glazed lantern on the roof, the clock tower on its cap, a lamp on top.
    box(9, 23, 6, 19, H + 1, H + 7, lantern),
    box(8.5, 23.5, 5.5, 19.5, H + 7, H + 8, SLATE_SKIN),
    box(13.5, 18.5, 10, 15, H + 8, H + 14, clock),
    box(13, 19, 9.5, 15.5, H + 14, H + 15, SLATE_SKIN),
    box(15, 17, 11.5, 13.5, H + 15, H + 17, LAMP),
    // The colonnade along the front: slab on posts, awnings between.
    box(1, 31, 24, 31, 10, 11.5, C_ROOF),
  ];
  for (const a of [2, 8.5, 15, 21.5, 28]) boxes.push(box(a, a + 1.2, 29, 30.2, 0, 10, litSkin(CONC, { height: 10 })));
  for (const a of [3.5, 10, 16.5, 23]) boxes.push(box(a, a + 4.8, 26, 31, 8, 9.2, AWNING));
  boxes.push(box(1, 31, 24, 31, 0, 0.6, STEP)); // the paving under the colonnade
  return boxes;
}

/**
 * The emporium (C 3×3, 225): a department store in three setbacks — a glass
 * ground floor with awnings on both faces, a middle storey of window bands,
 * a top storey with a roof sign on a bracket and a lamp — a corner
 * entrance under a canopy, and a paved forecourt with two trees and a
 * bench where the shoppers arrive.
 */
function emporium() {
  const H1 = 16, H2 = 14, H3 = 12;
  const base = litSkin(CONC_WALL, { height: H1 });
  const ground = {
    top: base.top,
    side: (a, k, x, y) => { const g = H1 - k; if (g >= 1 && g < 9 && Math.floor(a) % 7 !== 6) return a >= 30 && a < 34 && g < 7 ? "+" : "="; if (g >= 11.5 && g < 14.5 && Math.floor(a) % 3 === 1) return "="; return base.side(a, k, x, y); },
    end: (b, k, x, y) => { const g = H1 - k; if (g >= 1 && g < 9 && Math.floor(b) % 7 !== 6) return END_GLASS; if (g >= 11.5 && g < 14.5 && Math.floor(b) % 3 === 1) return END_GLASS; return base.end(b, k, x, y); },
  };
  const mid = walled(litSkin(CONC_WALL, { height: H2 }), H2, { storey: 7, sill: 2, winH: 3, period: 3, winW: 2, from: 1 });
  const top = walled(litSkin(CONC_WALL, { height: H3 }), H3, { storey: 6, sill: 2, winH: 3, period: 2, winW: 1, from: 1 });
  const sign = { top: () => SLATE[2], side: (a, k) => (k >= 1 && k < 2.5 && Math.floor(a) % 2 === 0 ? "-" : SLATE[1]), end: () => SLATE[0] };
  const boxes = [
    box(1, 47, 1, 38, 0, H1, ground),
    box(0.5, 47.5, 0.5, 38.5, H1, H1 + 1, C_ROOF),
    // Awnings over the ground-floor glass, both faces.
    ...[2, 10, 18].map((a) => box(a, a + 6, 37, 41, 8, 9.2, AWNING)),
    ...[3, 11, 19, 27].map((b) => box(45, 48, b, b + 6, 8, 9.2, AWNING)),
    // The corner entrance canopy.
    box(28, 36, 36, 42, 8, 9.5, C_ROOF),
    box(29, 30, 40.5, 41.5, 0, 8, litSkin(CONC, { height: 8 })),
    box(34.5, 35.5, 40.5, 41.5, 0, 8, litSkin(CONC, { height: 8 })),
    // The setbacks.
    box(5, 43, 5, 34, H1 + 1, H1 + 1 + H2, mid),
    box(4.5, 43.5, 4.5, 34.5, H1 + 1 + H2, H1 + 2 + H2, C_ROOF),
    box(12, 36, 9, 28, H1 + 2 + H2, H1 + 2 + H2 + H3, top),
    box(11.5, 36.5, 8.5, 28.5, H1 + 2 + H2 + H3, H1 + 3 + H2 + H3, C_ROOF),
    // The roof sign on a bracket, lit letters; a lamp beside it; the plant room.
    box(16, 32, 26, 27, H1 + 3 + H2 + H3, H1 + 4 + H2 + H3, BRACKET),
    box(15, 33, 26.5, 28, H1 + 4 + H2 + H3, H1 + 8 + H2 + H3, sign),
    box(13, 15, 10, 12, H1 + 3 + H2 + H3, H1 + 5 + H2 + H3, LAMP),
    box(26, 34, 11, 17, H1 + 3 + H2 + H3, H1 + 6 + H2 + H3, litSkin(CONC, { grain: ribGrain, height: 3 })),
    // The forecourt: paving, a bench.
    box(1, 47, 38, 47, 0, 0.6, STEP),
    ...bench(14, 43),
  ];
  return boxes;
}

// ------------------------------------------------------------- industrial

/**
 * The mill (I 2×2, 120): a long rust shed under a sawtooth roof, a tall
 * brick stack at its back corner, a water tank on legs in the yard, a
 * loading dock of two steps along the shed's front, and a stack of crates
 * by the gate.
 */
function mill() {
  const H = 12;
  const wall = walled(litSkin(RUST, { grain: ribGrain, height: H }), H, { storey: 12, sill: 6, winH: 3, period: 5, winW: 3, from: 1, door: doorAt(9, 7.5, 3) });
  const crate = litSkin(EARTH, { height: 2 });
  const boxes = [
    box(1, 31, 4, 24, 0, H, wall),
    box(0.5, 31.5, 3.5, 24.5, H, H + 1, SLATE_SKIN),
    ...sawtooth(2, 30, 4, 24, H + 1, 5),
    chimney(27, 1, H + 32, 3),
    ...tank(2, 25, 8, 5),
    box(12, 22, 24, 27, 0, 2, STEP), // the dock
    box(12, 22, 27, 28.5, 0, 1, STEP),
    box(24, 26.5, 26, 28.5, 0, 2, crate), box(26.5, 29, 26, 28.5, 0, 2, crate), box(25, 27.5, 26.5, 29, 2, 4, crate),
    box(1, 31, 24, 31, 0, 0.5, SAWDUST), // the yard
  ];
  return boxes;
}

/**
 * The foundry (I 3×3, 270): two rust sheds side by side — one under a
 * sawtooth, one under a lantern roof — a conveyor bridge between them at
 * first-floor height, three stacks of three heights along the back, a
 * gantry across the yard on two posts, and a coal heap under it.
 */
function foundry() {
  const HA = 16, HB = 20;
  const wallA = walled(litSkin(RUST, { grain: ribGrain, height: HA }), HA, { storey: 16, sill: 8, winH: 3, period: 5, winW: 3, from: 1, door: doorAt(8, 8, 3) });
  const wallB = walled(litSkin(RUST, { grain: ribGrain, height: HB }), HB, { storey: 10, sill: 5, winH: 3, period: 4, winW: 2, from: 1, door: doorAt(10, 8, 3) });
  const lantern = { top: () => SLATE[2], side: (a, k) => (k >= 1 && k < 3 ? "=" : SLATE[1]), end: (b, k) => (k >= 1 && k < 3 ? END_GLASS : SLATE[0]) };
  const coal = flatSkin(SLATE[1], SLATE[0], SLATE[0]);
  const boxes = [
    box(1, 22, 1, 30, 0, HA, wallA),
    box(0.5, 22.5, 0.5, 30.5, HA, HA + 1, SLATE_SKIN),
    ...sawtooth(2, 21, 1, 30, HA + 1, 5),
    box(26, 47, 1, 30, 0, HB, wallB),
    box(25.5, 47.5, 0.5, 30.5, HB, HB + 1, SLATE_SKIN),
    box(30, 43, 8, 22, HB + 1, HB + 5, lantern),
    box(29.5, 43.5, 7.5, 22.5, HB + 5, HB + 6, SLATE_SKIN),
    // The conveyor bridge.
    box(22, 26, 12, 16, 11, 14, litSkin(SLATE, { height: 3 })),
    // Three stacks along the back.
    stack(4, 1, HA + 26, 3), stack(38, 1, HB + 20, 3), stack(43, 1, HB + 14, 3),
    // The gantry: two posts and a beam, over the coal heap.
    box(6, 8, 40, 42, 0, 14, litSkin(RUST, { height: 14 })),
    box(40, 42, 40, 42, 0, 14, litSkin(RUST, { height: 14 })),
    box(6, 42, 40, 42, 13, 14.5, litSkin(RUST, { height: 1.5 })),
    box(28, 40, 33, 44, 0, 2, coal), box(30, 38, 35, 42, 2, 3.5, coal), box(32, 36, 37, 40, 3.5, 4.5, coal),
    box(1, 47, 30, 47, 0, 0.5, SAWDUST), // the yard
    box(10, 16, 34, 40, 0, 1.5, STEP), // a loading apron
  ];
  return boxes;
}

// ------------------------------------------------------------ meat market

/**
 * The abattoir (M 2×2, 80): the meat hall's brick-and-slate hall with its
 * clerestory, a windowless cold-store annex off its end, a stall along the
 * front under the striped awning with the hooks on its rail, a fenced pen
 * on sawdust beside it, and a rust chimney at the back corner. Brown
 * throughout; the one '$' dot on the sign is the brightest thing on it.
 */
function abattoir() {
  const H = 14, BRICK_TO = 8;
  const brick = litSkin(BRICK, { grain: brickGrain, height: BRICK_TO });
  const slate = litSkin(SLATE, { height: H - BRICK_TO });
  const hall = {
    top: slate.top,
    side: (a, k, x, y) => { const g = H - k; if (a >= 9 && a < 12 && g < 6) return "+"; if (g >= 10 && g < 12 && Math.floor(a) % 3 === 1) return "="; return g < BRICK_TO ? brick.side(a, k - (H - BRICK_TO), x, y) : slate.side(a, k, x, y); },
    end: (b, k, x, y) => { const g = H - k; if (g >= 10 && g < 12 && Math.floor(b) % 3 === 1) return END_GLASS; return g < BRICK_TO ? brick.end(b, k - (H - BRICK_TO), x, y) : slate.end(b, k, x, y); },
  };
  const annexBase = litSkin(SLATE, { height: 10 });
  const annex = { top: annexBase.top, side: (a, k, x, y) => (a >= 1.5 && a < 2.5 && 10 - k >= 6 && 10 - k < 8 ? "+" : annexBase.side(a, k, x, y)), end: annexBase.end };
  const sign = { top: () => SLATE[2], side: (a, k) => (a >= 1.5 && a < 2 && k >= 1 && k < 2 ? BRICK[3] : SLATE[1]), end: (b, k) => (b >= 1.5 && b < 2 && k >= 1 && k < 2 ? BRICK[3] : SLATE[0]) };
  const counter = litSkin(BRICK, { grain: brickGrain, height: 3 });
  const boxes = [
    box(1, 22, 1, 20, 0, H, hall),
    box(0.5, 22.5, 0.5, 20.5, H, H + 1, SLATE_SKIN),
    box(22, 31, 4, 16, 0, 10, annex),
    box(21.5, 31.5, 3.5, 16.5, 10, 11, SLATE_SKIN),
    chimney(1, 1, H + 12, 2.5),
    // The sign over the door.
    box(10, 10.5, 20, 21, 10, 10.5, BRACKET),
    box(8.5, 12.5, 21, 21.5, 7.5, 10, sign),
    // The stall along the front: a counter under the striped awning, hooks on the rail.
    box(2, 14, 21.5, 24, 0, 3, counter),
    box(1.5, 14.5, 20.5, 25, 6, 8, AWNING_M),
    ...[4.5, 7.5, 10.5].map((a) => box(a - 0.25, a + 0.25, 24.5, 25, 4, 6, HOOK)),
    box(2, 14, 24, 27, 0, 0.8, SAWDUST),
    // The pen.
    ...pen(17, 31, 19, 31, 21),
  ];
  return boxes;
}

/**
 * The meat exchange (M 3×3, 180): a great hall — brick to the first storey,
 * slate above — under a lantern roof, a cold-store wing off each end, a
 * loading yard with the van at the dock and a striped awning with its
 * hooks along the hall's front, two pens on sawdust, the sign with its one
 * dot, and a rust chimney over the boilers.
 */
function meatExchange() {
  const H = 18, BRICK_TO = 10;
  const brick = litSkin(BRICK, { grain: brickGrain, height: BRICK_TO });
  const slate = litSkin(SLATE, { height: H - BRICK_TO });
  const hall = {
    top: slate.top,
    side: (a, k, x, y) => { const g = H - k; if (a >= 17 && a < 21 && g < 7) return "+"; if (g >= 13 && g < 15.5 && Math.floor(a) % 3 === 1) return "="; if (g >= 3 && g < 6 && Math.floor(a) % 6 === 2) return "="; return g < BRICK_TO ? brick.side(a, k - (H - BRICK_TO), x, y) : slate.side(a, k, x, y); },
    end: (b, k, x, y) => { const g = H - k; if (g >= 13 && g < 15.5 && Math.floor(b) % 3 === 1) return END_GLASS; if (g >= 3 && g < 6 && Math.floor(b) % 6 === 2) return END_GLASS; return g < BRICK_TO ? brick.end(b, k - (H - BRICK_TO), x, y) : slate.end(b, k, x, y); },
  };
  const lantern = { top: () => SLATE[2], side: (a, k) => (k >= 1 && k < 3.5 ? "=" : SLATE[1]), end: (b, k) => (k >= 1 && k < 3.5 ? END_GLASS : SLATE[0]) };
  const coldBase = litSkin(SLATE, { height: 12 });
  const cold = { top: coldBase.top, side: (a, k, x, y) => (a >= 1.5 && a < 2.5 && ((12 - k >= 4 && 12 - k < 6) || (12 - k >= 9 && 12 - k < 11)) ? "+" : coldBase.side(a, k, x, y)), end: coldBase.end };
  const sign = { top: () => SLATE[2], side: (a, k) => (a >= 2 && a < 2.5 && k >= 1 && k < 2 ? BRICK[3] : SLATE[1]), end: (b, k) => (b >= 2 && b < 2.5 && k >= 1 && k < 2 ? BRICK[3] : SLATE[0]) };
  const boxes = [
    box(1, 40, 1, 24, 0, H, hall),
    box(0.5, 40.5, 0.5, 24.5, H, H + 1, SLATE_SKIN),
    box(10, 31, 7, 17, H + 1, H + 6, lantern),
    box(9.5, 31.5, 6.5, 17.5, H + 6, H + 7, SLATE_SKIN),
    box(40, 47, 1, 24, 0, 12, cold), // the east cold store
    box(39.5, 47.5, 0.5, 24.5, 12, 13, SLATE_SKIN),
    box(1, 12, 24, 34, 0, 12, cold), // the south cold store
    box(0.5, 12.5, 23.5, 34.5, 12, 13, SLATE_SKIN),
    chimney(42, 26, 30, 3),
    // The sign, the awning and the hooks along the hall's front.
    box(19, 19.5, 24, 25, 11.5, 12, BRACKET),
    box(16.5, 21.5, 25, 25.5, 9, 11.5, sign),
    box(22, 38, 23.5, 28, 7, 9, AWNING_M),
    ...[24.5, 27.5, 30.5, 33.5, 36.5].map((a) => box(a - 0.25, a + 0.25, 27.5, 28, 5, 7, HOOK)),
    // The yard: paving at the dock, the van, two pens.
    box(12, 47, 24, 47, 0, 0.5, SAWDUST),
    box(22, 38, 28, 32, 0, 1.2, STEP),
    ...van(26, 33),
    ...pen(14, 28, 36, 47, 18),
    ...pen(30, 46, 36, 47, 34),
  ];
  return boxes;
}

// --------------------------------------------------------------- the table

/** BLOCKS[zone][side][variant] — 16 sprites, registered with buildings.js at load. */
export const BLOCKS = {
  1: { 2: family("terrace-court", "R", 2, terraceCourt, { stamps: [[TREE_ROUND, 22, 20, 1]] }), 3: family("towers", "R", 3, towers, { stamps: [[TREE_ROUND, 16, 20, 1], [TREE_TALL, 31, 20, 1]] }) },
  2: { 2: family("arcade", "C", 2, arcade), 3: family("emporium", "C", 3, emporium, { stamps: [[TREE_ROUND, 6, 43, 1], [TREE_WILLOW, 42, 43, 1]] }) },
  3: { 2: family("mill", "I", 2, mill), 3: family("foundry", "I", 3, foundry) },
  4: { 2: family("abattoir", "M", 2, abattoir), 3: family("meat-exchange", "M", 3, meatExchange) },
};
registerBlocks(BLOCKS);

/** Every block sprite, named, for the audit and the sheet. */
export function allBlocks() {
  const out = [];
  for (const zone of [1, 2, 3, 4]) for (const side of [2, 3]) for (const s of BLOCKS[zone][side]) out.push({ name: s.name, sprite: s });
  return out;
}
