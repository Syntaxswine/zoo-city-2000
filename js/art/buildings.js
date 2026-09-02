// buildings.js — every built thing in the city is BOXES. SPEC §12.2.
//
// Nine families (3 zones × 3 tiers) × 2 variants, the four civics, and the
// overlays. Nothing in this file draws a face. Each family is a list of
// `box()`es in world units (1 tile = 16 along a and b, c in pixels) handed to
// `solid.render`, which rasterises per screen pixel through a z-buffer — so a
// chimney standing through a roof, an awning off a wall, a balcony strip, a
// sawtooth on a factory, all come free of hand ordering. Parts are still
// listed BOTTOM UP (body, roof, chimney) because that is the honest order and
// because a stamped (non-box) part like a park tree has no depth of its own.
//
// LIGHT is upper-left, always: top brightest, side (+ty, screen-left) mid,
// end (+tx, screen-right) darkest. `litSkin` encodes that; `flatSkin` is for
// roofs and trim, in the same order. Glass '=' is cut into a wall by the
// skin returning it instead of the wall key — never by subtracting solid.
//
// VARIANTS. Variant 1 of every family is variant 0 with the plan mirrored
// across a = b: the chimney, the awning, the tank swap arms. The door stays
// on the side face because the skin is not mirrored — which is what SPEC
// means by "mirrored offsets".
//
// THE FOOTPRINT GATE (SPEC §12.5, checked by tools/check.mjs Part C): every
// opaque pixel of a building lies inside the projection of its footprint
// prism — the tile diamond (or the 2×2's) extruded upward without bound.
// An awning or a balcony past b = 16 is a pixel over the next tile.
//
// Every export is a `defineSprite` result: { rows, anchor, w, h, footprint }.
// The anchor is the pixel under world (8, 8, 0) — the ground centre of the
// tile (A_STEP for the 2×2 zoo) — so `painter.placeAt` needs nothing else.

import { box, render, litSkin, flatSkin, A_STEP, TO_X, TO_Y } from "./solid.js";
import { defineSprite, part, toRows, T } from "./format.js";
import { keysOf } from "./palette.js";
import { TREE_ROUND, TREE_TALL, TREE_WILLOW, RUBBLE, diamond, hash } from "./terrain.js";

const BRICK = keysOf("brick"); // ! @ # $
const CONC = keysOf("concrete"); // % ^ & * (
const RUST = keysOf("rust"); // { } [ ]
const SLATE = keysOf("slate"); // < > ?
const EARTH = keysOf("earth"); // q r s t u
const GRASS = keysOf("grass"); // m n o p

// ------------------------------------------------------------------- skins

const SLATE_SKIN = flatSkin(SLATE[2], SLATE[1], SLATE[0]);
// The commercial roof cap is LIGHT concrete on slate edges: a slate cap
// ('?' ≈95) on a concrete wall ('&' side ≈133, '^' end ≈98) made the top of
// the building the darkest of its three surfaces — not a fold (the cap is
// its own box, correctly shaded) but an inversion of the building-level
// read. '*' (≈171) on top honours "top brightest" for the whole box.
const C_ROOF = flatSkin(CONC[3], SLATE[1], SLATE[0]);
const TIMBER = flatSkin(EARTH[4], EARTH[3], EARTH[2]);
const PLINTH = flatSkin(GRASS[3], GRASS[1], GRASS[0]);
// The commercial wall is concrete one rung DOWN from the ramp's top: with
// the full ramp the side face came out '*' (#A3ADB8), ten luminance points
// off the glass '=' (#7FA8C4), and a glazed tower read as one pale slab.
// Dropping the top rung puts the side wall at '&' and the end at '^', so
// the day glass is the LIGHT thing on the side face and the shaded glass
// (END_GLASS below) the dark thing on the end face — the panes carry the
// box's shading instead of flattening it.
const CONC_WALL = CONC.slice(0, 4); // % ^ & *
// Glass on the END face (the +tx face, away from the light) is the darkest
// water key that still reads blue: it must be darker than the side glass,
// not brighter, or the box folds like paper.
const END_GLASS = "H";
// The shop awning: a canvas ramp with three distinct faces (top, side,
// end). Water keys, because the concrete family already owns grey and the
// C zone-chalk accent belongs on the ground, not on a building.
const AWNING = flatSkin("J", "I", "H");

// END_GLASS is the default for EVERY walled family, not an opt-in: round 2
// left `endGlass = glass` in `walled()`, so cottage / two-storey / apartment
// / shed / factory / works put day glass '=' (#7FA8C4, the brightest key on
// the building) on the +tx face — the darkest face by law — and the R and
// I families folded like paper at their windows while C, which passed
// END_GLASS by hand, did not.
const brickGrain = (x, y) => (((x + 3 * y) & 7) === 0 ? -0.6 : 0);
const ribGrain = (x, y) => (((x >> 1) & 1) === 0 ? 0.25 : -0.4);
const ringGrain = (x, y) => (y % 5 === 0 ? -0.6 : 0);

/**
 * A wall with windows cut in by storey. `g` is height above the GROUND
 * (the rasteriser hands the skin depth-below-top, so the box height is
 * needed to turn it round), which is what keeps every storey's sill level
 * across a family. `door(a, g)` is an optional hole on the side face.
 */
function walled(base, height, { storey = 8, sill = 3, winH = 3, period = 4, winW = 2, from = 1, glass = "=", endGlass = END_GLASS, door = null, endWindows = true } = {}) {
  const isWin = (u, g) => {
    if (g < 1 || g > height - 1) return false;
    const gg = Math.floor(g) % storey;
    const uu = Math.floor(u) % period;
    return gg >= sill && gg < sill + winH && uu >= from && uu < from + winW;
  };
  return {
    top: base.top,
    side: (a, k, x, y) => {
      const g = height - k;
      if (door && door(a, g)) return "+";
      if (isWin(a, g)) return glass;
      return base.side(a, k, x, y);
    },
    end: (b, k, x, y) => {
      const g = height - k;
      if (endWindows && isWin(b, g)) return endGlass;
      return base.end(b, k, x, y);
    },
  };
}

const doorAt = (mid, h = 5.5, half = 1.2) => (a, g) => g < h && a >= mid - half && a < mid + half;

// ---------------------------------------------------------------- helpers

/** Mirror a plan across a = b: variant 1 of every family. */
const flipPlan = (boxes) => boxes.map((bx) => box(bx.b0, bx.b1, bx.a0, bx.a1, bx.c0, bx.c1, bx.faces));

/**
 * Boxes → a defined sprite, anchor from the rasteriser.
 *
 * `extent` is a list of extra boxes that paint NOTHING (no faces) but grow
 * the grid: `render()` sizes its grid from the boxes alone, and a stamped
 * part that stands taller than any box — the park's trees over a 1-unit
 * plinth — was silently cropped by `stamp` at the grid's top edge. The
 * first round's park trees were the bottom four canopy rows on a trunk.
 * Now a plan that stamps anything declares how tall the stamps reach.
 */
function solidSprite(name, boxes, { hub = A_STEP / 2, footprint = [1, 1], tags = [], extent = [], stamps = [] } = {}) {
  const r = render([...boxes, ...extent], { hub });
  r.name = name;
  for (const [sprite, a, b, c] of stamps) stampAtWorld(r, sprite, a, b, c);
  PLANS.push({ name, footprint, boxes });
  return defineSprite({ name, rows: toRows(r.grid), anchor: r.anchor, footprint, tags });
}

/**
 * Every solid's plan, for the audit: { name, footprint, boxes }. THE
 * FOOTPRINT GATE lives on the plan, not the pixels: the projection of a
 * footprint prism is unbounded upward, so a box hanging half a unit past
 * the tile at awning height lands on pixels a taller box inside the tile
 * could own, and no pixel test can tell them apart. check.mjs asserts every
 * box has a, b ∈ [0, 16·footprint] and c ≥ 0.
 */
export const PLANS = [];

/** A box that only widens the grid: no faces, so the rasteriser paints nothing. */
const extentBox = (a0, a1, b0, b1, c0, c1) => box(a0, a1, b0, b1, c0, c1, {});

/**
 * Every stamp made into a solid, for the audit: { sprite, part, dropped }.
 * `dropped` is the count of opaque part pixels that fell outside the grid —
 * always 0, because `stampAtWorld` throws otherwise; check.mjs reads it.
 */
export const STAMP_LOG = [];

/**
 * Stamp a hand-authored sprite so its anchor lands on world (a, b, c),
 * THROUGH THE Z-BUFFER: every opaque pixel is given the depth of a point
 * standing on that ground spot at its height above the anchor
 * (a + b + 2c, plus 2 per row above the feet — the same key the rasteriser
 * uses, so a billboard resolves against boxes on either side of it). The
 * first round stamped without depth and then rasterised the zoo hut, whose
 * wall painted over the pine standing in FRONT of it.
 *
 * Throws if any opaque pixel lands outside the grid: a cropped part is a
 * silently wrong sprite, and a plan that stamps declares its `extent`.
 */
function stampAtWorld(r, sprite, a, b, c = 0) {
  const gx = Math.round(TO_X(a, b)) + r.ox - sprite.anchor[0];
  const gy = Math.round(TO_Y(a, b, c)) + r.oy - sprite.anchor[1];
  const H = r.grid.length, W = r.grid[0].length;
  const base = a + b + 2 * c;
  let dropped = 0;
  for (let y = 0; y < sprite.rows.length; y++) {
    const row = sprite.rows[y];
    const depth = base + 2 * (sprite.anchor[1] - y);
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === T) continue;
      const px = gx + x, py = gy + y;
      if (px < 0 || py < 0 || px >= W || py >= H) { dropped++; continue; }
      const i = py * W + px;
      if (depth <= r.zbuf[i]) continue;
      r.zbuf[i] = depth;
      r.grid[py][px] = ch;
    }
  }
  STAMP_LOG.push({ sprite: r.name, part: sprite.name, at: [a, b, c], dropped });
  if (dropped) throw new Error(`buildings: '${sprite.name}' stamped into '${r.name}' at (${a}, ${b}, ${c}) loses ${dropped} px outside the grid — grow the plan's extent`);
}

// ------------------------------------------------------------ residential

function cottage() {
  const H = 8;
  const wall = walled(litSkin(BRICK, { grain: brickGrain, height: H }), H, { storey: 8, sill: 3, winH: 3, period: 5, winW: 2, from: 1, door: doorAt(7) });
  // Hipped roof as a stepped slope: an eave slab and four 1-px risers each
  // inset 1.5 units, so the '?' top strips and '>' / '<' risers alternate
  // as 1-px courses up the roof and the steps read as a pitch. Two big
  // steps (round 2) read as a flat roof with a box on it; three read as a
  // ziggurat of trays. A slope is a limit of thin steps.
  const boxes = [box(2.5, 13.5, 3, 13, 0, H, wall), box(1.5, 14.5, 2, 14, H, H + 1, SLATE_SKIN)];
  for (let i = 1; i <= 4; i++) boxes.push(box(1.5 + 1.5 * i, 14.5 - 1.5 * i, 2 + 1.5 * i, 14 - 1.5 * i, H + i, H + i + 1, SLATE_SKIN));
  boxes.push(box(10, 12, 4.5, 6.5, H, H + 7, litSkin(BRICK, { grain: brickGrain, height: 7 })));
  return boxes;
}

function twoStorey() {
  const H = 16;
  const wall = walled(litSkin(BRICK, { grain: brickGrain, height: H }), H, { storey: 8, sill: 3, winH: 3, period: 4, winW: 2, from: 1, door: doorAt(8) });
  return [
    box(1.5, 14.5, 1.5, 14.5, 0, H, wall),
    box(0.5, 15.5, 0.5, 15.5, H, H + 1.5, SLATE_SKIN),
    box(3, 13, 3, 13, H + 1.5, H + 4, SLATE_SKIN),
    box(5.5, 10.5, 5.5, 10.5, H + 4, H + 6, SLATE_SKIN),
    box(11, 13, 3, 5, H, H + 7, litSkin(BRICK, { grain: brickGrain, height: 7 })),
  ];
}

function apartment() {
  const H = 32;
  const wall = walled(litSkin(BRICK, { grain: brickGrain, height: H }), H, { storey: 8, sill: 3, winH: 3, period: 4, winW: 2, from: 1, door: doorAt(8) });
  const boxes = [box(1, 15, 1, 15, 0, H, wall)];
  // Balcony strips stop at the tile edge (b = 16): a box past the plan is a
  // pixel outside the footprint, which check.mjs now gates.
  for (let k = 1; k <= 3; k++) boxes.push(box(2, 14, 15, 16, 8 * k, 8 * k + 1, SLATE_SKIN));
  boxes.push(box(0.5, 15.5, 0.5, 15.5, H, H + 1.5, SLATE_SKIN));
  boxes.push(box(3, 13, 3, 13, H + 1.5, H + 3, SLATE_SKIN));
  boxes.push(box(10, 13, 10, 13, H + 3, H + 6, litSkin(CONC, { height: 3 })));
  return boxes;
}

// ------------------------------------------------------------- commercial

function shop() {
  const H = 10;
  const base = litSkin(CONC_WALL, { height: H });
  const skin = {
    top: base.top,
    side: (a, k, x, y) => {
      const g = H - k;
      if (a >= 1 && a < 8 && g >= 2 && g < 7) return "=";
      if (a >= 9.5 && a < 11.5 && g < 6.5) return "+";
      return base.side(a, k, x, y);
    },
    end: (b, k, x, y) => {
      const g = H - k;
      if (b >= 2 && b < 9 && g >= 2 && g < 7) return END_GLASS;
      return base.end(b, k, x, y);
    },
  };
  return [
    box(1.5, 14.5, 2.5, 13.5, 0, H, skin),
    box(0.5, 9, 13.5, 16, 6.5, 8, AWNING),
    box(1.5, 14.5, 2.5, 13.5, H, H + 0.8, C_ROOF),
    box(3, 6, 4, 7, H + 0.8, H + 3, litSkin(CONC, { height: 2 })),
  ];
}

function store() {
  const H = 22;
  const wall = walled(litSkin(CONC_WALL, { height: H }), H, { storey: 7, sill: 3, winH: 3, period: 1, winW: 1, from: 0, endGlass: END_GLASS, door: doorAt(9, 6, 1.5) });
  return [
    box(1, 15, 1, 15, 0, H, wall),
    box(0.5, 15.5, 0.5, 15.5, H, H + 1, C_ROOF),
    box(9, 13, 3, 7, H + 1, H + 4, litSkin(CONC, { height: 3 })),
    box(3, 6, 9, 12, H + 1, H + 2.5, litSkin(CONC, { height: 1.5 })),
  ];
}

function tower() {
  const H = 48;
  const wall = walled(litSkin(CONC_WALL, { height: H }), H, { storey: 6, sill: 2, winH: 3, period: 3, winW: 2, from: 1, endGlass: END_GLASS, door: doorAt(8, 6, 1.5) });
  return [
    box(1.5, 14.5, 1.5, 14.5, 0, H, wall),
    box(1, 15, 1, 15, H, H + 1, C_ROOF),
    box(3, 8, 3, 8, H + 1, H + 5, litSkin(CONC, { height: 4 })),
    // The rooftop stack is a 2×2-unit concrete box: at 1.2 units in slate
    // its top was the same '?' as the cap it stood on and it vanished into a
    // 2-px near-black slit beside the AC unit (round 2). Now it has a top.
    box(11, 13, 11, 13, H + 1, H + 11, litSkin(CONC, { height: 10 })),
  ];
}

// ------------------------------------------------------------- industrial

function shed() {
  const H = 8;
  const wall = walled(litSkin(RUST, { grain: ribGrain, height: H }), H, { storey: 8, sill: 4, winH: 2, period: 6, winW: 3, from: 2, door: doorAt(6, 6.5, 2) });
  return [
    box(1, 15, 2.5, 13.5, 0, H, wall),
    box(0.5, 15.5, 2, 14, H, H + 1, SLATE_SKIN),
    box(3, 5, 4, 6, 0, 14, litSkin(RUST, { grain: ringGrain, height: 14 })),
  ];
}

function factory() {
  const H = 14;
  const wall = walled(litSkin(RUST, { grain: ribGrain, height: H }), H, { storey: 14, sill: 8, winH: 3, period: 5, winW: 3, from: 1, door: doorAt(8, 7, 2.5) });
  // The sawtooth glazing is on the +tx END face of each tooth — the face
  // away from the light — so it is END_GLASS, never '=': with day glass
  // there the brightest pixels on the factory sat on its darkest face and
  // the teeth read as glazing strips lying flat on the roof.
  const tooth = {
    top: () => SLATE[2],
    side: () => SLATE[1],
    end: (b, k) => (k < 2.5 ? END_GLASS : SLATE[0]),
  };
  const boxes = [box(1, 15, 1, 15, 0, H, wall)];
  for (let i = 0; i < 3; i++) boxes.push(box(1 + 4.7 * i, 4.9 + 4.7 * i, 1, 15, H, H + 3.5, tooth));
  boxes.push(box(12, 14, 2, 4, 0, H + 10, litSkin(RUST, { grain: ringGrain, height: 24 })));
  boxes.push(box(12, 14, 5.5, 7.5, 0, H + 8, litSkin(RUST, { grain: ringGrain, height: 22 })));
  return boxes;
}

function works() {
  const H = 20;
  const wall = walled(litSkin(RUST, { grain: ribGrain, height: H }), H, { storey: 10, sill: 5, winH: 3, period: 4, winW: 2, from: 1, door: doorAt(8, 8, 2.5) });
  return [
    box(0.5, 15.5, 0.5, 15.5, 0, H, wall),
    box(0, 16, 0, 16, H, H + 1, SLATE_SKIN),
    box(2, 7, 9, 14, H + 1, H + 8, litSkin(CONC, { grain: ringGrain, height: 7 })),
    box(3, 6, 10, 13, H + 8, H + 9.5, litSkin(CONC, { height: 1.5 })),
    box(11.5, 14.5, 1.5, 4.5, 0, H + 14, litSkin(RUST, { grain: ringGrain, height: 34 })),
  ];
}

// ------------------------------------------------------------- the table

const FAMILY = {
  1: { 1: ["cottage", cottage], 2: ["two-storey", twoStorey], 3: ["apartment", apartment] },
  2: { 1: ["shop", shop], 2: ["store", store], 3: ["tower", tower] },
  3: { 1: ["shed", shed], 2: ["factory", factory], 3: ["works", works] },
};
const ZONE_LETTER = { 1: "R", 2: "C", 3: "I" };

/** BUILDINGS[zone][tier][variant] — 18 sprites. */
export const BUILDINGS = {};
for (const zone of [1, 2, 3]) {
  BUILDINGS[zone] = {};
  for (const tier of [1, 2, 3]) {
    const [name, make] = FAMILY[zone][tier];
    const boxes = make();
    BUILDINGS[zone][tier] = [
      solidSprite(`${ZONE_LETTER[zone]}${tier}-${name}-0`, boxes, { tags: ["building", ZONE_LETTER[zone]] }),
      solidSprite(`${ZONE_LETTER[zone]}${tier}-${name}-1`, flipPlan(boxes), { tags: ["building", ZONE_LETTER[zone]] }),
    ];
  }
}

export function buildingSprite(zone, tier, variant = 0) {
  const z = typeof zone === "string" ? { R: 1, C: 2, I: 3 }[zone] : zone;
  const fam = BUILDINGS[z] && BUILDINGS[z][tier];
  if (!fam) throw new Error(`buildingSprite: no family for zone ${zone} tier ${tier}`);
  return fam[variant & 1];
}

// ------------------------------------------------------------------ civics

// How far above the plinth a stamped tree reaches, for the grid extent:
// the tallest tree's rows above its anchor, plus the plinth.
const TREE_REACH = Math.max(...[TREE_ROUND, TREE_TALL, TREE_WILLOW].map((t) => t.anchor[1])) + 2;

export const PARK = (() => {
  const boxes = [
    box(0, 16, 0, 16, 0, 1, PLINTH),
    // Legs, seat, back — a bench is three heights, not a slab (looked flat).
    box(9, 10, 10, 12.5, 1, 4, TIMBER),
    box(13, 14, 10, 12.5, 1, 4, TIMBER),
    box(8.5, 14.5, 9.5, 13, 4, 5.2, TIMBER),
    box(8.5, 14.5, 9.5, 10.2, 5.2, 8, TIMBER),
  ];
  return solidSprite("park", boxes, {
    tags: ["civic"],
    extent: [extentBox(0, 16, 0, 16, 0, TREE_REACH)],
    stamps: [
      [TREE_ROUND, 11, 3, 1],
      [TREE_ROUND, 4, 11.5, 1],
    ],
  });
})();

export const ZOO = (() => {
  const fence = {
    top: () => EARTH[4],
    side: (a) => (Math.floor(a) % 2 === 0 ? EARTH[3] : null),
    end: (b) => (Math.floor(b) % 2 === 0 ? EARTH[2] : null),
  };
  const rail = TIMBER;
  // Plinth, the two back fences, the hut, the front fences and rails, the
  // gate — all boxes, all one z-buffer; then the trees are stamped THROUGH
  // that z-buffer, so the pine at b = 19 wins its pixels from the hut
  // (b ≤ 13) by depth, not by the order these lines happen to be in.
  const boxes = [
    box(0, 32, 0, 32, 0, 1, PLINTH),
    box(0, 32, 0, 1, 1, 5, fence),
    box(0, 1, 0, 32, 1, 5, fence),
    box(20, 29, 4, 12, 1, 8, litSkin(CONC, { height: 7 })),
    box(19, 30, 3, 13, 8, 10, SLATE_SKIN),
    box(0, 12, 31, 32, 1, 5, fence),
    box(20, 32, 31, 32, 1, 5, fence),
    box(31, 32, 0, 32, 1, 5, fence),
    box(0, 32, 31, 32, 5, 5.8, rail),
    box(31, 32, 0, 32, 5, 5.8, rail),
    box(12, 13.2, 30.5, 32, 1, 8, litSkin(RUST, { height: 7 })),
    box(18.8, 20, 30.5, 32, 1, 8, litSkin(RUST, { height: 7 })),
    box(12, 20, 30.5, 32, 8, 9.2, litSkin(RUST, { height: 1 })),
  ];
  return solidSprite("zoo", boxes, {
    hub: A_STEP,
    footprint: [2, 2],
    tags: ["civic"],
    extent: [extentBox(0, 32, 0, 32, 0, TREE_REACH)],
    stamps: [
      [TREE_ROUND, 7, 6, 1],
      [TREE_WILLOW, 8, 23, 1],
      [TREE_TALL, 25, 19, 1],
    ],
  });
})();

// ----------------------------------------------------------- the stations

// A lamp is a small box — the tower lamp 1.5 units, a 6-px glow at 1×. It is the one
// lit key on all three faces — a glow has no shading for a flat skin to
// lose. The blue lamp is not a glow: '6' (luminance ≈101) on the concrete
// side wall (≈134) came out a shadow by the steps at 1× (round 1), so it
// carries a glass '=' top — the brightest face on top, as every box — and
// stands at door-top height against plain wall, where a lamp hangs.
const LAMP = flatSkin("-", "-", "-");
const BLUE_LAMP = flatSkin("=", "6", "6");
const STEP = flatSkin(CONC[4], CONC[3], CONC[2]);
const POST = flatSkin(SLATE[2], SLATE[1], SLATE[0]);

/**
 * The fire station: a tier-1-sized brick box under a slate slab, read at
 * 1× by two things on its lit face — a garage door two-thirds of the face
 * and the red '8' band over it — and by the 3×3×8 hose tower on the slab
 * at the back corner, a '-' lamp on top. Three END_GLASS windows so the
 * shaded face is not a blank wall. Anchored at the ground centre like PARK.
 */
export const FIRE_STATION = (() => {
  const H = 12;
  const base = litSkin(BRICK, { grain: brickGrain, height: H });
  const skin = {
    top: base.top,
    side: (a, k, x, y) => {
      const g = H - k;
      if (a >= 1.5 && a < 9 && g < 7.5) return "+"; // the garage door
      if (a >= 10.5 && a < 12 && g < 5.5) return "+"; // the crew door
      if (a >= 0.5 && a < 12.5 && g >= 8 && g < 10.5) return "8"; // the red band — 2.5 units: at 1.5 it was a 1-px line at 1×
      return base.side(a, k, x, y);
    },
    end: (b, k, x, y) => {
      const g = H - k;
      if (g >= 4.5 && g < 7.5 && ((b >= 1.5 && b < 3.5) || (b >= 4.5 && b < 6.5) || (b >= 7.5 && b < 9.5))) return END_GLASS;
      return base.end(b, k, x, y);
    },
  };
  const boxes = [
    box(1.5, 14.5, 2.5, 13.5, 0, H, skin),
    box(1, 15, 2, 14, H, H + 1, SLATE_SKIN),
    box(1.5, 4.5, 2.5, 5.5, H + 1, H + 9, litSkin(BRICK, { grain: brickGrain, height: 8 })),
    box(2.25, 3.75, 3.25, 4.75, H + 9, H + 10.5, LAMP),
  ];
  return solidSprite("fire-station", boxes, { tags: ["civic"] });
})();

/**
 * The police station: a taller concrete box, read at 1× by the blue '6'
 * lamp on a post beside its door. A glass strip along the top storey ('='
 * on the lit face, END_GLASS on the shaded one, like every concrete
 * family), a dark door up two steps — two slabs in front of the wall, so
 * the door's foot sits behind them — and a plant box on the cap.
 */
export const POLICE_STATION = (() => {
  const H = 14;
  const base = litSkin(CONC_WALL, { height: H });
  const skin = {
    top: base.top,
    side: (a, k, x, y) => {
      const g = H - k;
      if (a >= 7.5 && a < 10 && g < 7) return "+"; // the door
      if (a >= 1 && a < 12 && g >= 8.5 && g < 11.5) return "="; // the glass strip
      return base.side(a, k, x, y);
    },
    end: (b, k, x, y) => {
      const g = H - k;
      if (b >= 1 && b < 10 && g >= 8.5 && g < 11.5) return END_GLASS;
      return base.end(b, k, x, y);
    },
  };
  const boxes = [
    box(1.5, 14.5, 2.5, 13.5, 0, H, skin),
    box(1, 15, 2, 14, H, H + 1, C_ROOF),
    box(3, 6, 4, 7, H + 1, H + 3.5, litSkin(CONC, { height: 2.5 })),
    box(7, 10.5, 13.5, 14.5, 0, 2, STEP),
    box(7, 10.5, 14.5, 15.5, 0, 1, STEP),
    // The lamp is 2 units — 8 px wide at 1× — because it is the whole
    // signature; at 1.5 it was a 5-px dot beside a 5-px door. Its screen
    // left edge (2·(a0 − b1) = −7) is the door's right edge, no overlap.
    box(12, 12.75, 14, 14.75, 0, 6.5, POST),
    box(12, 14, 13.5, 15.5, 6.5, 8.5, BLUE_LAMP),
  ];
  return solidSprite("police-station", boxes, { tags: ["civic"] });
})();

export const CIVICS = { park: PARK, zoo: ZOO, fire: FIRE_STATION, police: POLICE_STATION };
export function civicSprite(kind) {
  const s = CIVICS[kind];
  if (!s) throw new Error(`civicSprite: unknown kind '${kind}'`);
  return s;
}

// ---------------------------------------------------------------- overlays

// The scaffold is painted OVER its building with no depth between them, so
// it may only contain what could never be behind the building: the three
// near poles and the two near rails. The back pole at (0.5, 0.5) — drawn in
// the first round — ran down through the store's roof and wall to the rails.
export const SCAFFOLD = (() => {
  const H = 36;
  const P = TIMBER;
  const boxes = [];
  for (const [a, b] of [[14.5, 0.5], [0.5, 14.5], [14.5, 14.5]]) boxes.push(box(a, a + 1, b, b + 1, 0, H, P));
  for (const h of [10, 22, 34]) {
    boxes.push(box(0.5, 15.5, 14.5, 15.5, h, h + 0.8, P));
    boxes.push(box(14.5, 15.5, 0.5, 15.5, h, h + 0.8, P));
  }
  return solidSprite("scaffold", boxes, { tags: ["overlay"] });
})();

const FIRE_A = defineSprite({
  name: "fire-0",
  anchor: [9, 23],
  tags: ["overlay"],
  rows: part([
    "........9...........",
    ".......99...........",
    ".......98.....9.....",
    "......988....99.....",
    "......988...998.....",
    ".....9988...988.....",
    ".....98888..988.....",
    "....998888.9888.....",
    "....988888.9888.....",
    "...9988888988889....",
    "...9888888888889....",
    "..99888888888888....",
    "..98888888888888....",
    "..98888888888888....",
    ".998888899888888....",
    ".988888899988888....",
    ".988888999988888....",
    "..88888999998888....",
    "..8888899999888.....",
    "..8888899999888.....",
    "...888899998888.....",
    "....88899998888.....",
    ".....8899998888.....",
    "......88998888......",
  ]),
});

const FIRE_B = defineSprite({
  name: "fire-1",
  anchor: [9, 23],
  tags: ["overlay"],
  rows: part([
    ".............9......",
    "............99......",
    "....9.......98......",
    "....99.....988......",
    "....989....988......",
    "....988...9988......",
    "....9888..9888......",
    "...99888.99888......",
    "...98888.98888......",
    "...988889988889.....",
    "..9888888888889.....",
    "..9888888888888.....",
    "..8888888888888.....",
    ".98888888888888.....",
    ".98888899988888.....",
    ".98888999998888.....",
    ".88888999998888.....",
    ".88889999998888.....",
    "..8889999998888.....",
    "..8889999998888.....",
    "..888899999888......",
    "...88899998888......",
    "....8899988888......",
    ".....889988888......",
  ]),
});
export const FIRE = [FIRE_A, FIRE_B];

/** A water checker over the tile: the flood overlay. */
export const FLOOD = defineSprite({
  name: "flood",
  anchor: [32, 16],
  tags: ["overlay"],
  rows: diamond((a, b, px, py) => {
    if ((px + py) & 1) return null;
    const h = hash(px, py, 53);
    return h < 0.08 ? "K" : h < 0.5 ? "I" : "H";
  }),
});

export const OVERLAYS = { scaffold: [SCAFFOLD], fire: FIRE, flood: [FLOOD], rubble: [RUBBLE] };

export function overlaySprite(kind, frame = 0) {
  const list = OVERLAYS[kind];
  if (!list) throw new Error(`overlaySprite: unknown kind '${kind}'`);
  return list[frame % list.length];
}

/** Every building sprite, named, for the audit. */
export function allBuildings() {
  const out = [];
  for (const zone of [1, 2, 3]) for (const tier of [1, 2, 3]) for (const s of BUILDINGS[zone][tier]) out.push({ name: s.name, sprite: s });
  out.push({ name: PARK.name, sprite: PARK }, { name: ZOO.name, sprite: ZOO }, { name: FIRE_STATION.name, sprite: FIRE_STATION }, { name: POLICE_STATION.name, sprite: POLICE_STATION });
  for (const [k, list] of Object.entries(OVERLAYS)) list.forEach((s, i) => out.push({ name: `overlay-${k}-${i}`, sprite: s }));
  return out;
}
