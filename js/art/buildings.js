// buildings.js — every built thing in the city is BOXES. SPEC §12.2.
//
// Twelve families (4 zones × 3 tiers) × 4 variants, the five civics, and the
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
// VARIANTS. Plans 2 and 3 are authored in building-plans.js. Variant 1 of every family is variant 0 with the plan mirrored
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

import { box, render, litSkin, flatSkin, A_STEP, TO_X, TO_Y, RECIPES } from "./solid.js";
import { defineSprite, part, toRows, T } from "./format.js";
import { keysOf } from "./palette.js";
import { TREE_ROUND, TREE_TALL, TREE_WILLOW, RUBBLE, groundSprite, hash } from "./terrain.js";
import { extraPlans } from "./building-plans.js";
import { characterSprite, socketsFor } from "./building-character.js";
import { shopKind } from "../sim/shops.js";

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
    glazing: true,
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
export function solidSprite(name, boxes, { hub = A_STEP / 2, footprint = [1, 1], tags = [], extent = [], stamps = [] } = {}) {
  const recipe = { name, boxes, hub, footprint, extent, stamps, sockets: socketsFor(boxes) };
  const r = renderRecipe(recipe, 1);
  PLANS.push({ name, footprint, boxes });
  const sprite = defineSprite({ name, rows: toRows(r.grid), anchor: r.anchor, footprint, tags });
  RECIPES.set(sprite, recipe);
  return sprite;
}

/**
 * THE RECIPE of every solid — boxes, hub, extent, stamps — kept beside the
 * sprite it made, so the same plan can be rasterised again: at scale 2 for
 * the hi-res set (js/art/hires.js), or with its z-buffer for the depth
 * audit (tools/depthaudit.mjs). A sprite is frozen rows; a recipe is how
 * the rows were made. The map lives in solid.js so walls, rail and the
 * bridges (which call `render` themselves) register in the same one.
 */
export { RECIPES };

/** Rasterise a recipe at `scale`: { grid, zbuf, anchor, ox, oy, scale, name }. Stamps go through the z-buffer as in `solidSprite`. */
export function renderRecipe(recipe, scale = 1) {
  const r = render([...recipe.boxes, ...recipe.extent], { hub: recipe.hub, scale });
  r.name = recipe.name;
  for (const [sprite, a, b, c] of recipe.stamps) stampAtWorld(r, sprite, a, b, c, scale);
  return r;
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
function stampAtWorld(r, sprite, a, b, c = 0, scale = 1) {
  // At scale s a hand-drawn part (a tree) is nearest-neighbour: every one of
  // its pixels becomes an s×s block at the same depth, so the 2× set keeps
  // the 1× tree exactly, twice as big — the organic exception stays drawn.
  const gx = Math.round(TO_X(a, b) * scale) + r.ox - sprite.anchor[0] * scale;
  const gy = Math.round(TO_Y(a, b, c) * scale) + r.oy - sprite.anchor[1] * scale;
  const H = r.grid.length, W = r.grid[0].length;
  const base = a + b + 2 * c;
  let dropped = 0;
  for (let y = 0; y < sprite.rows.length; y++) {
    const row = sprite.rows[y];
    const depth = base + 2 * (sprite.anchor[1] - y);
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === T) continue;
      for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
        const px = gx + x * scale + sx, py = gy + y * scale + sy;
        if (px < 0 || py < 0 || px >= W || py >= H) { dropped++; continue; }
        const i = py * W + px;
        if (depth <= r.zbuf[i]) continue;
        r.zbuf[i] = depth;
        r.grid[py][px] = ch;
      }
    }
  }
  if (scale === 1) STAMP_LOG.push({ sprite: r.name, part: sprite.name, at: [a, b, c], dropped });
  if (dropped) throw new Error(`buildings: '${sprite.name}' stamped into '${r.name}' at (${a}, ${b}, ${c}) ×${scale} loses ${dropped} px outside the grid — grow the plan's extent`);
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
    glazing: true,
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
    box(10, 12, 11, 13, H + 1, H + 11, litSkin(CONC, { height: 10 })),
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
    glazing: true,
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

// ------------------------------------------------------------ meat market
//
// Zone 4, "M": the grey-market meat markets. Every "meat" cue is a BROWN —
// brick, earth, rust, the lightest brick '$' for the one dot on the sign —
// never the zot red '0', which is reserved for the zots and would make a
// butcher's read as a warning. What breaks the field guide: carcasses,
// drips, lettering, saturated red. What a silhouette carries at 1×
// instead: a striped awning, a row of hooks, a windowless annex, a sign
// with one dot, a chimney. The family walks brick → brick-and-slate →
// concrete up its tiers, the way R is brick, C concrete and I rust.

// The butcher's awning: 1-unit stripes of the darkest brick '!' and the
// lightest concrete '(' — the red-white stripe with the red dried to
// liver. The stripe is keyed on the SCREEN column, floor(x / 2): on the
// top face that is the world diagonal a − b (x = 2a − 2b), a band running
// from the wall to the lip, 2 px wide at 1×, and the same band continues
// down the valance. It survives flipPlan: a stripe keyed on floor(a)
// turned into three long bands along the mirrored awning. (brickGrain
// keys on screen pixels too — house precedent.)
//
// AND IT MIRRORS WITH THE PLAN. flipPlan sends screen column x to −1 − x,
// but floor(x / 2) & 1 is not symmetric about that seam (column 17 is
// dark, column −18 light), so a hook that hung under a light stripe in
// variant 0 hung under a dark one in variant 1. The stripe is keyed on
// the column's distance from the seam, m = x < 0 ? −1 − x : x, which IS
// mirror-symmetric, and the seam itself (x = −1 | 0) lies inside the
// body — the awning spans x ∈ [−22, −5] or its mirror — so no awning
// ever shows the 4-px stripe the fold would make there.
const STRIPE = (x) => {
  const m = x < 0 ? -1 - x : x;
  return Math.floor(m / 2) & 1 ? BRICK[0] : CONC[4];
};
const AWNING_M = { top: (a, b, x) => STRIPE(x), side: (a, k, x) => STRIPE(x), end: (b, k, x) => STRIPE(x) };
// Sawdust: a loose spill, so the top and the side are both the lightest
// earth — a heap has no crisp lit edge the way TIMBER does.
const SAWDUST = flatSkin(EARTH[4], EARTH[4], EARTH[3]);
// The sign bracket: the three DARKER rusts, so the one '$' dot (lum 157)
// on the slab is the brightest thing on the sign. With ']' (lum 170) on
// top the bracket's 4 px outshone the dot and the mark read as a gold
// tick on the bracket, not a dot on the slab.
const BRACKET = flatSkin(RUST[2], RUST[1], RUST[0]);

/**
 * The stall: a tier-1 brick kiosk, 10 × 10 units under a slate cap, read
 * at 1× by the striped awning off its lit face (2 px thick, 14 px long),
 * three 1-px '+' hooks hanging under it (1 × 2 px each, 4 px apart — a
 * butcher's rail), a dark door beside them and a sawdust step spilling
 * on the ground in front. One END_GLASS window on the shaded face so it
 * is not a blank wall.
 *
 * WHERE THE HOOKS GO: ON THE RAIL, NOT THE WALL. An awning hides the
 * wall under it. On one screen column the lip stands d units further
 * along a as well as b, so an awning d units deep between c_bot and c_top
 * covers the wall band [c_bot − 2d, c_top] — the top face alone eats 2d
 * units. Round 1 hung the hooks on the wall at 3–5 under a 3-deep lip and
 * showed none of them; round 2, 1.5 deep, showed none again. So the hooks
 * are three thin boxes hanging from the lip's underside, a butcher's
 * rail: 1 × 2 px dark ticks under the striped valance, 4 px apart, and
 * they flip with the awning. Each is a quarter-unit either side of its
 * column — a face whose two edges both land on pixel columns is 2 px wide
 * under the rasteriser's inclusive bounds — and paints no end face, which
 * at 2:1 turned each tick into an inverted T.
 *
 * AND UNDER THE LIGHT STRIPES. The stripe has a 4-px period on screen and
 * the hooks are one period apart, so their phase against it is the same
 * for all three: at a = 5, 7, 9 every tick hung under a dark '!' stripe
 * (lum 48 over lum 38 — three stripes 2 px longer than their neighbours,
 * not hooks) and in the flipped variant two of the three fell on the
 * END_GLASS window. At a = 5.5, 7.5, 9.5 the ticks sit under the light
 * '(' stripes (~170 luminance contrast), 2 px tall in both variants.
 *
 * The end-face window sits at the FRONT of the shaded face (b 8–10 of the
 * body's 0–10): flipPlan hangs the awning off this face, and its top-face
 * overhang hides the wall band under it for every column it covers
 * (b ≤ 10.5 on the mirrored stall) — a window at b 2.5–5.5 kept 4 of its
 * 18 px in variant 1.
 */
const HOOK = { top: () => "+", side: () => "+", end: () => null };
function stall() {
  const H = 8;
  const base = litSkin(BRICK, { grain: brickGrain, height: H });
  const skin = {
    glazing: true,
    top: base.top,
    side: (a, k, x, y) => {
      const g = H - k;
      if (a >= 7.5 && a < 9.5 && g < 6) return "+"; // the door
      return base.side(a, k, x, y);
    },
    end: (b, k, x, y) => {
      const g = H - k;
      if (b >= 8 && b < 10 && g >= 2 && g < 5) return END_GLASS;
      return base.end(b, k, x, y);
    },
  };
  const boxes = [
    box(3, 13, 3, 13, 0, H, skin),
    box(3.5, 10.5, 13, 14.5, 6, 8, AWNING_M),
    box(2.5, 13.5, 2.5, 13.5, H, H + 1, SLATE_SKIN),
    box(4, 10.5, 13, 14.5, 0, 1, SAWDUST),
  ];
  for (const a of [5.5, 7.5, 9.5]) boxes.push(box(a - 0.25, a + 0.25, 14, 14.5, 4, 6, HOOK));
  return boxes;
}

/**
 * The meat hall: brick to storey 8, slate above, with a clerestory of
 * 1-unit windows in the slate band ('=' on the lit face, END_GLASS on
 * the shaded one). Off its end a WINDOWLESS slate annex — the cold store —
 * with one 2-px '+' vent high on its lit face. Over the door a slate sign
 * slab hangs a unit off the wall on a 1-px rust bracket, carrying one '$'
 * dot and no lettering: the cut, not the word.
 *
 * THE ANNEX SITS ON THE BACK HALF OF THE END (b 3.5–8), not the full
 * depth: flipPlan sends the end to the front, and a full-depth annex
 * mirrored to a 3.5–12.5 × b 11–15.5 stood in front of the whole lit face
 * and hid the door (round 1: 31 door pixels in variant 0, 4 in variant 1).
 * The half-depth annex mirrored covers the lit face only up to a = 8, and
 * the door lives at a ≥ 8.5. Same rule in the cold store.
 */
function meatHall() {
  const H = 14;
  const BRICK_TO = 8;
  const brick = litSkin(BRICK, { grain: brickGrain, height: BRICK_TO });
  const slate = litSkin(SLATE, { height: H - BRICK_TO });
  // k is depth below the box top; the brick band is its own 8-unit wall
  // and shades from ITS top (c = 8), so it is handed k − (H − 8).
  const skin = {
    glazing: true,
    top: slate.top,
    side: (a, k, x, y) => {
      const g = H - k;
      if (a >= 7.5 && a < 10 && g < 6) return "+"; // the hall door
      if (g >= 10 && g < 12 && Math.floor(a) % 3 === 1) return "="; // the clerestory
      return g < BRICK_TO ? brick.side(a, k - (H - BRICK_TO), x, y) : slate.side(a, k, x, y);
    },
    end: (b, k, x, y) => {
      const g = H - k;
      if (g >= 10 && g < 12 && Math.floor(b) % 3 === 1) return END_GLASS;
      return g < BRICK_TO ? brick.end(b, k - (H - BRICK_TO), x, y) : slate.end(b, k, x, y);
    },
  };
  const annexBase = litSkin(SLATE, { height: 9 });
  const annex = {
    top: annexBase.top,
    side: (a, k, x, y) => (a >= 1.5 && a < 2.5 && 9 - k >= 6 && 9 - k < 8 ? "+" : annexBase.side(a, k, x, y)),
    end: annexBase.end,
  };
  // The dot sits mid-slab on BOTH long faces: flipPlan turns the slab's
  // side into its end (a 15.5–16 × b 7.5–11), and a dot on the side face
  // alone left every variant-1 sign blank.
  const sign = {
    top: () => SLATE[2],
    side: (a, k) => (a >= 1.5 && a < 2 && k >= 1 && k < 2 ? BRICK[3] : SLATE[1]),
    end: (b, k) => (b >= 1.5 && b < 2 && k >= 1 && k < 2 ? BRICK[3] : SLATE[0]),
  };
  return [
    box(1, 11, 1.5, 14.5, 0, H, skin),
    box(0.5, 11.5, 1, 15, H, H + 1, SLATE_SKIN),
    box(11, 15.5, 3.5, 8, 0, 9, annex),
    box(10.5, 16, 3, 8.5, 9, 10, SLATE_SKIN),
    box(9, 9.5, 14.5, 15.5, 10, 10.5, BRACKET),
    box(7.5, 11, 15.5, 16, 7.5, 10, sign),
  ];
}

/**
 * The cold store: a windowless concrete block — cold rooms have no
 * windows — under a band of glass along its top storey ('=' lit, END_GLASS
 * shaded, as every concrete family), a loading door two-thirds of the way
 * along its lit face, a ribbed condenser on the cap, the annex grown to
 * two storeys with a vent per storey, and a RUST ring-grain chimney at the
 * back corner standing 10 units over the roof — the pun that says
 * industrial-strength.
 */
function coldStore() {
  const H = 20;
  const base = litSkin(CONC_WALL, { height: H });
  const skin = {
    glazing: true,
    top: base.top,
    side: (a, k, x, y) => {
      const g = H - k;
      if (a >= 6.5 && a < 10 && g < 7) return "+"; // the loading door — at a ≥ 7.5 abs, clear of the mirrored annex (see meatHall)
      if (a >= 0.5 && a < 10 && g >= 15 && g < 18) return "="; // the office band
      return base.side(a, k, x, y);
    },
    end: (b, k, x, y) => {
      const g = H - k;
      if (b >= 0.5 && b < 13.5 && g >= 15 && g < 18) return END_GLASS;
      return base.end(b, k, x, y);
    },
  };
  const A = 13;
  const annexBase = litSkin(SLATE, { height: A });
  const annex = {
    top: annexBase.top,
    side: (a, k, x, y) => {
      const g = A - k;
      if (a >= 1.5 && a < 2.5 && ((g >= 4 && g < 6) || (g >= 10 && g < 12))) return "+"; // a vent per storey
      return annexBase.side(a, k, x, y);
    },
    end: annexBase.end,
  };
  return [
    box(1, 11.5, 1, 15, 0, H, skin),
    box(0.5, 12, 0.5, 15.5, H, H + 1, C_ROOF),
    box(2.5, 7, 3, 6, H + 1, H + 4, litSkin(CONC, { grain: ribGrain, height: 3 })),
    box(11.5, 15.5, 3.5, 7.5, 0, A, annex),
    box(11, 16, 3, 8, A, A + 1, SLATE_SKIN),
    box(12.5, 14.5, 0.5, 2.5, 0, H + 10, litSkin(RUST, { grain: ringGrain, height: H + 10 })),
  ];
}

// ------------------------------------------------------------- the table

const FAMILY = {
  1: { 1: ["cottage", cottage], 2: ["two-storey", twoStorey], 3: ["apartment", apartment] },
  2: { 1: ["shop", shop], 2: ["store", store], 3: ["tower", tower] },
  3: { 1: ["shed", shed], 2: ["factory", factory], 3: ["works", works] },
  4: { 1: ["stall", stall], 2: ["meat-hall", meatHall], 3: ["cold-store", coldStore] },
};
const ZONE_LETTER = { 1: "R", 2: "C", 3: "I", 4: "M" };

/** BUILDINGS[zone][tier][variant] — 48 sprites. */
export const BUILDINGS = {};
for (const zone of [1, 2, 3, 4]) {
  BUILDINGS[zone] = {};
  for (const tier of [1, 2, 3]) {
    const [name, make] = FAMILY[zone][tier];
    const boxes = make();
    const additions = extraPlans(zone, tier, { walled, doorAt, BRICK, CONC_WALL, RUST, SLATE_SKIN, C_ROOF, TIMBER, AWNING, AWNING_M, HOOK, STEP: flatSkin(CONC[4], CONC[3], CONC[2]), GRASS });
    BUILDINGS[zone][tier] = [
      solidSprite(`${ZONE_LETTER[zone]}${tier}-${name}-0`, boxes, { tags: ["building", ZONE_LETTER[zone]] }),
      solidSprite(`${ZONE_LETTER[zone]}${tier}-${name}-1`, flipPlan(boxes), { tags: ["building", ZONE_LETTER[zone]] }),
      ...additions.map((plan, n) => solidSprite(`${ZONE_LETTER[zone]}${tier}-${name}-${n + 2}`, plan, { tags: ["building", ZONE_LETTER[zone]] })),
    ];
  }
}

export function buildingSprite(zone, tier, variant = 0, side = 1, theme = 0, character = null) {
  const base = baseBuildingSprite(zone, tier, variant, side, theme);
  return character ? characterSprite(base, character) : base;
}
function baseBuildingSprite(zone, tier, variant = 0, side = 1, theme = 0) {
  const z = typeof zone === "string" ? { R: 1, C: 2, I: 3, M: 4 }[zone] : zone;
  if (side > 1) return blockSprite(z, side, variant, theme);
  // The shop pool keeps its existing kind mapping. The corner shop has four
  // plans by & 3; each specialist retains its & 1 mirrored pair.
  if (z === 2 && tier === 1 && SHOP_ART) return SHOP_ART[shopKind(variant)][variant & (shopKind(variant) === 0 ? 3 : 1)];
  const fam = BUILDINGS[z] && BUILDINGS[z][tier];
  if (!fam) throw new Error(`buildingSprite: no family for zone ${zone} tier ${tier}`);
  return fam[variant & 3];
}

/**
 * The blocks — 2×2 and 3×3 buildings per zone (SPEC §3b). Their plans live
 * in js/art/blocks.js, which registers here at load (`registerBlocks`) so
 * buildings.js need not import a file that imports it. Until it has, a
 * block draws its zone's tier-3 lot on the anchor: a wrong picture, never a
 * throw — a sim that can merge must be able to draw before the art lands.
 */
let BLOCKS = null;
let LANDMARK_ART = null;
let SHOP_ART = null;
/** The shops (SPEC §12.2d; js/art/shops.js): SHOP_ART[kind] = [variant 0, variant 1] per js/sim/shops.js's pool; until it registers, every tier-1 C lot is the corner shop. */
export function registerShops(table) { SHOP_ART = table; }
export function registerBlocks(table) { BLOCKS = table; }
/** The landmarks (SPEC §3c; js/art/landmarks.js): LANDMARK_ART[theme] = [variant 0, variant 1], a 3×3 per sim/landmarks.js roster row. */
export function registerLandmarks(table) { LANDMARK_ART = table; }
/**
 * The block on `side` tiles — and, for a 3×3 with a `theme`, its landmark:
 * the species' picture registered under that theme id. An unregistered
 * theme draws the zone's plain 3×3 (a wrong picture, never a throw), as an
 * unregistered block draws the tier-3 lot.
 */
export function blockSprite(zone, side, variant = 0, theme = 0) {
  const z = typeof zone === "string" ? { R: 1, C: 2, I: 3, M: 4 }[zone] : zone;
  if (theme && side === 3 && LANDMARK_ART && LANDMARK_ART[theme]) return LANDMARK_ART[theme][variant & 1];
  const fam = BLOCKS && BLOCKS[z] && BLOCKS[z][side];
  if (fam) return fam[variant & 1];
  return BUILDINGS[z][3][variant & 1];
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

/**
 * The pacification centre: a LOW white block — H 10 against the police
 * station's 14, and the full concrete ramp where the station wears
 * CONC_WALL, so its lit face is '*' to the station's '&'. A '+' double
 * door (two 3-px leaves, a 1-px mullion) under a 3 × 3 px earth-brown 's'
 * cross — brown on white reads at 1×; one barred window on the shaded end
 * (END_GLASS with a concrete post every 1.5 units, so every third column
 * is wall), a flat cap and a '-' lamp on its corner. THE SIGNATURE at 1×
 * is the van at the door: a furCool box 4.5 × 2.5 × 3.5 units on a STEP
 * apron, its nose toward the door, a '=' windscreen on the nose and two
 * '+' wheels under it with the apron showing between them. Nothing on it
 * is red.
 *
 * THE CROSS IS DRAWN IN SCREEN PIXELS, not in wall units: a world-
 * horizontal arm on the receding face is a 2:1 staircase, and at three
 * pixels that is a squiggle, not a cross (round 1 — and the cap's rim,
 * which overhangs the wall by half a unit, took the upright's top row).
 * The wall column x = −9 is a = 9; the centre sits at c = 7.5, screen
 * y = 15, with the rim two rows above and the door two rows below.
 */
export const PACIFICATION_CENTRE = (() => {
  const H = 10;
  const base = litSkin(CONC, { height: H });
  const CROSS_X = -9, CROSS_Y = 15;
  const skin = {
    top: base.top,
    side: (a, k, x, y) => {
      const g = H - k;
      if ((x === CROSS_X && Math.abs(y - CROSS_Y) <= 1) || (y === CROSS_Y && Math.abs(x - CROSS_X) <= 1)) return EARTH[2]; // the cross
      const mullion = a >= 7.5 && a < 8; // one column, under the cross's upright
      if (a >= 6 && a < 9.5 && g < 5.5 && !mullion) return "+"; // the double door
      return base.side(a, k, x, y);
    },
    end: (b, k, x, y) => {
      const g = H - k;
      if (b >= 2 && b < 8 && g >= 4 && g < 7) return (b - 2) % 1.5 < 0.25 ? base.end(b, k, x, y) : END_GLASS; // the barred window
      return base.end(b, k, x, y);
    },
  };
  const VAN = { top: () => "Z", side: () => "Y", end: (b, k) => (k < 2 ? "=" : "X") };
  const WHEEL = flatSkin("+", "+", "+");
  const boxes = [
    box(1.5, 14.5, 2.5, 13.5, 0, H, skin),
    box(1, 15, 2, 14, H, H + 1, C_ROOF),
    box(12, 13.5, 12, 13.5, H + 1, H + 2.5, LAMP),
    box(7.5, 11, 13.5, 14.5, 0, 1, STEP), // the door step
    // The van: apron, wheels, body — listed bottom up so the shared plane
    // at the wheel tops belongs to the body.
    box(1.5, 7.5, 13, 16, 0, 0.5, STEP),
    box(2.5, 3.5, 15.5, 16, 0.5, 1.5, WHEEL),
    box(5, 6, 15.5, 16, 0.5, 1.5, WHEEL),
    box(2, 6.5, 13.5, 16, 1.5, 5, VAN),
  ];
  return solidSprite("pacification-centre", boxes, { tags: ["civic"] });
})();

export const CIVICS = { park: PARK, largePark: ZOO, zoo: ZOO, fire: FIRE_STATION, police: POLICE_STATION, centre: PACIFICATION_CENTRE };
let LARGE_CIVICS = null;
export function registerLargeCivics(table) { LARGE_CIVICS = table; }
/** Kinds that are not in CIVICS or the 3×3 table — the knowledge and culture buildings (js/art/civics-knowledge.js) — registered by kind and side. */
const CIVIC_KINDS = {};
export function registerCivicKind(kind, side, sprite) { (CIVIC_KINDS[kind] ||= {})[side] = sprite; }
export function civicSprite(kind, side = null) {
  if (kind === "zoo" && LARGE_CIVICS?.zoo) return LARGE_CIVICS.zoo;
  if (side === 3 && LARGE_CIVICS?.[kind]) return LARGE_CIVICS[kind];
  const k = CIVIC_KINDS[kind];
  if (k) return k[side] || k[Object.keys(k)[0]]; // a kind built at one side only answers for any side asked (a legacy save cannot hold another)
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
export const FLOOD = groundSprite({ name: "flood", anchor: [32, 16], tags: ["overlay"] }, (a, b, px, py) => {
  if ((px + py) & 1) return null;
  const h = hash(px, py, 53);
  return h < 0.08 ? "K" : h < 0.5 ? "I" : "H";
});

/**
 * The security camera: a mast on the tile's EAST corner with the housing on
 * its top face and a glass lens on one drawn side. SPEC: docs/PROPOSAL-CAMERAS.md §7.
 *
 * THREE THINGS HERE ARE CORRECTNESS, NOT TASTE.
 *
 * 1. THE MAST STANDS AT THE EAST CORNER AND NOWHERE ELSE. The depth census
 *    counted mis-ordered pixels against walkers on the road it stands on:
 *    east 0, west 26, north 3,980, south 4,016, dead centre 1,118. Every
 *    other corner clips the animals walking past it.
 * 2. THE HOUSING SITS ON THE MAST'S TOP FACE, never on an arm reaching back
 *    over the road. `render` rasterises exactly three faces — the top, the
 *    +a end and the +b side. The -a and -b faces are NEVER DRAWN, so an arm
 *    reaching back is a -a shape and the camera would render headless.
 *    The lens rides whichever of the two drawn faces the yaw picks, which is
 *    why there are two sprites and not one mirrored plan: flipPlan mirrors
 *    across a = b and would move the mast to the WEST corner.
 * 3. THE EXTENT BOX IS LOAD-BEARING. It paints nothing. `render` sizes its
 *    grid from the boxes, and a lone mast in one corner makes a grid that
 *    does not contain the tile's ground centre — so `defineSprite` would get
 *    an anchor outside its own sprite. It reaches from the tile centre to
 *    the east corner, which is the least that keeps the anchor in.
 *
 * Height 20 units, and height is a correctness parameter too: the housing has
 * to clear the walkers' 19-px head band. At 1x the sprite reads as a 5-px
 * slate vertical under a 9-px pale head — the police lamp set the house rule
 * that a signature is 8 px wide, and a 4-px head reads as a lamp post with a
 * one-pixel lens.
 */
const CAM_MAST = flatSkin(SLATE[0], SLATE[1], SLATE[2]);
const CAM_H = 15;
const CAM_BODY_H = 5;
const CAM_BODY_A = 4;   // 8 px wide at 1x on the +b side face
const CAM_BODY_B = 2;   // 4 px wide at 1x on the +a end face
/**
 * The lens is the SIGNATURE and it is a solid glass block, not a ring with a
 * core: the head is 8 px wide and 5 px tall at 1x, so a lens with an outline
 * is three pixels of mud. The police station settled this rule first — its
 * signature is a flat 8-px blue lamp, not a detailed lantern.
 *
 * The body is TALL for its plan (4 x 2 x 5 units) on purpose. A box in this
 * projection shows a top face of area da x db and near faces of height dc, so
 * a squat head is all roof and the lens has nowhere to sit. An earlier draft
 * wore a pale cap that OVERHUNG the body, which hid the near faces behind it
 * and read as a table lamp.
 */
const camBody = (lensOnSide) => {
  const base = flatSkin(SLATE[1], SLATE[0], SLATE[0]);
  // A face skin is called with coordinates LOCAL to its own box — `side` gets
  // (a - a0, c1 - c) and `end` gets (b - b0, c1 - c), not world a/b/c. The
  // first draft wrote the lens in world units and it painted nothing at all,
  // silently: a skin that returns null everywhere just shows the base.
  const glass = (u, half, g) => (Math.abs(u - half) <= half * 0.55 && g >= 1.5 && g <= 3.5 ? "=" : null);
  return {
    top: base.top,
    side: (a, k) => (lensOnSide ? glass(a, CAM_BODY_A / 2, CAM_BODY_H - k) : null) || base.side(a, k),
    end: (b, k) => (lensOnSide ? null : glass(b, CAM_BODY_B / 2, CAM_BODY_H - k)) || base.end(b, k),
  };
};
const cameraSprite = (yaw) => solidSprite(`camera-${yaw}`, [
  box(13.5, 14.75, 1.5, 2.75, 0, CAM_H, CAM_MAST),
  box(15.5 - CAM_BODY_A, 15.5, 1, 1 + CAM_BODY_B, CAM_H, CAM_H + CAM_BODY_H, camBody(yaw === 0)),
], { tags: ["overlay"], extent: [box(8, 16, 0, 8, 0, 0, {})] });
export const CAMERAS = [cameraSprite(0), cameraSprite(1)];

export const OVERLAYS = { scaffold: [SCAFFOLD], fire: FIRE, flood: [FLOOD], rubble: [RUBBLE], camera: CAMERAS };

export function overlaySprite(kind, frame = 0) {
  const list = OVERLAYS[kind];
  if (!list) throw new Error(`overlaySprite: unknown kind '${kind}'`);
  return list[frame % list.length];
}

/**
 * The authoring kit js/art/blocks.js builds the 2×2 and 3×3 families from —
 * the same ramps, skins, grains and helpers, so a block reads as its zone
 * (brick and slate for R, concrete and glass for C, rust for I, brown for M).
 */
export const KIT = Object.freeze({
  walled, doorAt, flipPlan, extentBox,
  BRICK, CONC, RUST, SLATE, EARTH, GRASS,
  SLATE_SKIN, C_ROOF, TIMBER, PLINTH, CONC_WALL, END_GLASS, AWNING, AWNING_M, SAWDUST, BRACKET, HOOK, LAMP, BLUE_LAMP, STEP, POST,
  brickGrain, ribGrain, ringGrain, TREE_REACH,
});

/** Every building sprite, named, for the audit. */
export function allBuildings() {
  const out = [];
  for (const zone of [1, 2, 3, 4]) for (const tier of [1, 2, 3]) for (const s of BUILDINGS[zone][tier]) out.push({ name: s.name, sprite: s });
  out.push({ name: PARK.name, sprite: PARK }, { name: ZOO.name, sprite: ZOO }, { name: FIRE_STATION.name, sprite: FIRE_STATION }, { name: POLICE_STATION.name, sprite: POLICE_STATION }, { name: PACIFICATION_CENTRE.name, sprite: PACIFICATION_CENTRE });
  for (const [k, list] of Object.entries(OVERLAYS)) list.forEach((s, i) => out.push({ name: `overlay-${k}-${i}`, sprite: s }));
  return out;
}
