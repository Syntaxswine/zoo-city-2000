// buildings.js — every built thing in the city is BOXES. SPEC §12.2.
//
// Twelve families (4 zones × 3 tiers) × 6 variants, the civics, and the
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
// VARIANTS. Plans 2 through 5 are authored in building-plans.js. Variant 1 of every family is variant 0 with the plan mirrored
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
import { dress as dressRoof } from "./roof-furniture.js"; // T2.3 — something on the 66%
import { characterSprite, socketsFor } from "./building-character.js";
import { shopKind } from "../sim/shops.js";

const BRICK = keysOf("brick"); // ! @ # $
const CONC = keysOf("concrete"); // % ^ & * (
const RUST = keysOf("rust"); // { } [ ]
const SLATE = keysOf("slate"); // < > ?
const EARTH = keysOf("earth"); // q r s t u
const GRASS = keysOf("grass"); // m n o p

// ------------------------------------------------------------------- skins

const TILE = keysOf("tile"); // B C D E — added with the roofs, T2.1
const SLATE_SKIN = flatSkin(SLATE[2], SLATE[1], SLATE[0]);
// The commercial roof cap is LIGHT concrete on slate edges: a slate cap
// ('?' ≈95) on a concrete wall ('&' side ≈133, '^' end ≈98) made the top of
// the building the darkest of its three surfaces — not a fold (the cap is
// its own box, correctly shaded) but an inversion of the building-level
// read. '*' (≈171) on top honours "top brightest" for the whole box.
const C_ROOF = flatSkin(CONC[3], SLATE[1], SLATE[0]);
// THE ROOF SAYS THE ZONE (T2.2). Two thirds of every standing pixel in this
// game is a top face — `tools/faceprobe.mjs` measured 66.1% — and until now
// every one of those faces was slate or concrete, so the largest surface in
// the city carried none of the one fact a player most wants from the air.
// Four materials, one per zone:
//
//   R  terracotta   warm, and DARKER at every rung than the brick beneath it
//   C  light concrete cap on slate edges — as it already was
//   I  rust         the works and the sheds, in the ramp their stacks use
//   M  slate, dark  the meat halls read as the grim ones, by value
//
// Every roof in the game goes through this table: the six base families
// below, and `building-plans.js`'s `cap()` helper, which is the one choke
// point for all twenty-four authored variants.
const R_ROOF = flatSkin(TILE[2], TILE[1], TILE[0]);
const I_ROOF = flatSkin(RUST[2], RUST[1], RUST[0]);
const M_ROOF = flatSkin(SLATE[1], SLATE[0], SLATE[0]);
const ROOF_OF = { 1: R_ROOF, 2: C_ROOF, 3: I_ROOF };
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
  const boxes = [box(2.5, 13.5, 3, 13, 0, H, wall), box(1.5, 14.5, 2, 14, H, H + 1, R_ROOF)];
  for (let i = 1; i <= 4; i++) boxes.push(box(1.5 + 1.5 * i, 14.5 - 1.5 * i, 2 + 1.5 * i, 14 - 1.5 * i, H + i, H + i + 1, R_ROOF));
  boxes.push(box(10, 12, 4.5, 6.5, H, H + 7, litSkin(BRICK, { grain: brickGrain, height: 7 })));
  return boxes;
}

// THE ORIGINAL FOUR STEP BACK (T3.2). The two-storey, the apartment, the store
// and the tower were each ONE BOX WITH A LID — measured (`tools/massprobe.mjs`),
// the only four of the twenty-four R and C plans at tiers 2 and 3 whose rooms
// filled their whole bounding prism with nothing between the street and the
// roof (the skylight market also fills its prism, and carries an awning), and a
// third of every mid- and high-rise lot draws one of them or its mirror. Each
// keeps its storeys, its material, its windows and its door; what changes is
// that the mass above the street stands back from it.
//
// SIZE ON SCREEN, because that decides every number below: a setback of s units
// on a street face shows at zoom 1 as a band 2s px tall (one unit of a or b is
// one pixel of y, and the terrace is seen from 2:1 above), so 2 units is the
// least that reads as a STEP rather than a stripe. And an awning d units deep
// hides the wall under it for 2d units of height — the stall's lesson — so a
// canopy is the read, not a frame round the glass.
//
// BOTH STREET FACES, ALWAYS. flipPlan mirrors the boxes and not the skins, so a
// setback or an awning on one face alone lands on the doorless face in variant
// 1. Every step here is taken on +a and +b alike.
const brickWall = (h, opts = {}) => walled(litSkin(BRICK, { grain: brickGrain, height: h }), h, { storey: 8, sill: 3, winH: 3, period: 4, winW: 2, from: 1, ...opts });

function twoStorey() {
  // The upper storey stands 2.5 units back from the street under its hipped
  // roof, and the ground floor's exposed ring carries a terracotta porch roof
  // in two courses — the pent roof between storeys that a house has and a
  // shop does not.
  const S = 8;
  return [
    box(1.5, 14.5, 1.5, 14.5, 0, S, brickWall(S, { door: doorAt(8) })),
    box(1, 15, 1, 15, S, S + 0.8, R_ROOF),
    box(1.5, 13.5, 1.5, 13.5, S + 0.8, S + 1.6, R_ROOF),
    box(1.5, 12, 1.5, 12, S, 2 * S, brickWall(S)),
    box(1, 12.5, 1, 12.5, 2 * S, 2 * S + 1.5, R_ROOF),
    box(3, 10.5, 3, 10.5, 2 * S + 1.5, 2 * S + 3.5, R_ROOF),
    box(5, 8.5, 5, 8.5, 2 * S + 3.5, 2 * S + 5, R_ROOF),
    box(9, 11, 2.5, 4.5, 2 * S, 2 * S + 7, litSkin(BRICK, { grain: brickGrain, height: 7 })),
  ];
}

function apartment() {
  // Two storeys on the whole plot; above them the front corner — the one
  // nearest the camera — is a TERRACE, and the two upper storeys are an L
  // round the back of it. The corner is on the a = b diagonal, so the mirror
  // keeps it.
  //
  // THE BALUSTRADE IS IN THE PLAN, NOT LEFT TO THE ROOF FURNITURE. A terrace
  // without an edge is a lower roof, and `furnish` cannot find this one: it
  // rails a deck only when less than 0.35 of it is covered, and measured over
  // every deck in the game a terrace is covered 0.22–1.24 (median 0.63) and a
  // pitch step 0.35–1.73 (median 0.65) — the same number, so the rule cannot
  // tell them apart and only what stands on the deck could. That is a class
  // question for roof-furniture.js; this edge is architecture, and is drawn.
  const S = 8, P = 2 * S, W = 7; // podium height, the wings' depth — an 8×8 terrace
  const T = P + 1; // the terrace floor
  const rail = flatSkin(TILE[3], TILE[2], TILE[1]); // a rung lighter than the terrace it rings
  return [
    box(1, 15, 1, 15, 0, P, brickWall(P, { door: doorAt(8) })),
    // Balcony strips stop at the tile edge (b = 16): a box past the plan is a
    // pixel outside the footprint, which check.mjs now gates.
    box(2, 14, 15, 16, S, S + 1, SLATE_SKIN),
    box(0.5, 15.5, 0.5, 15.5, P, T, R_ROOF),
    box(1, 15, 1, W, T, T + 2 * S, brickWall(2 * S)),
    box(1, W, W, 15, T, T + 2 * S, brickWall(2 * S)),
    box(W, 15.5, 14.6, 15.5, T, T + 1.3, rail),
    box(14.6, 15.5, W, 14.6, T, T + 1.3, rail),
    box(W + 0.5, W + 3, W + 0.5, W + 3, T, T + 1, TIMBER),
    box(W + 0.8, W + 2.7, W + 0.8, W + 2.7, T + 1, T + 1.7, PLINTH),
    box(2, W - 1, 15, 16, T + S, T + S + 1, SLATE_SKIN),
    box(0.5, 15.5, 0.5, W + 0.5, T + 2 * S, T + 1.5 + 2 * S, R_ROOF),
    box(0.5, W + 0.5, W + 0.5, 15.5, T + 2 * S, T + 1.5 + 2 * S, R_ROOF),
  ];
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

/**
 * A shop floor: glass from knee to lintel on both street faces, a pier every
 * `bay` units, the door cut into the side face. The emporium's ground floor,
 * cut down to one tile.
 */
function shopFloor(H, { door = null, bay = 5, pier = 1, sill = 1, head = 6 } = {}) {
  const base = litSkin(CONC_WALL, { height: H });
  const glassAt = (u, g) => g >= sill && g < head && u % bay >= pier;
  return {
    glazing: true,
    top: base.top,
    side: (a, k, x, y) => { const g = H - k; if (door && door(a, g)) return "+"; if (glassAt(a, g)) return "="; return base.side(a, k, x, y); },
    end: (b, k, x, y) => { const g = H - k; if (glassAt(b, g)) return END_GLASS; return base.end(b, k, x, y); },
  };
}

function store() {
  // A glass shop floor under a canvas awning on both street faces, and the
  // two storeys of ribbon windows above it set back 2 units behind a
  // terrace — the department store's cut, the emporium's on one tile.
  //
  // THE AWNING STOPS SHORT OF THE DOOR, and further on the far side than the
  // near one. An awning d deep hides the wall below it for 2d units — hung
  // over the door, the first draft left 15 of the door's 36 px — and it is
  // SHEARED on screen: its lip stands d units nearer along b, so its far end
  // reaches d units of a further left than where it meets the wall. The door
  // runs a 8.5–11.5; the awning resumes at 11.5 + 1.5. Both faces take the
  // same gap so the mirror keeps it over the door.
  const F = 8, U = 14; // the shop floor, the storeys over it
  const D = 1.5; // the awning's depth
  const upper = walled(litSkin(CONC_WALL, { height: U }), U, { storey: 7, sill: 3, winH: 3, period: 1, winW: 1, from: 0, endGlass: END_GLASS });
  const awning = (u0, u1) => [box(u0, u1, 16 - D, 16, 5.5, 6.7, AWNING), box(16 - D, 16, u0, Math.min(u1, 16 - D), 5.5, 6.7, AWNING)];
  return [
    box(1, 16 - D, 1, 16 - D, 0, F, shopFloor(F, { door: doorAt(9, 6, 1.5) })),
    ...awning(1, 8),
    ...awning(11.5 + D, 16),
    box(0.5, 15, 0.5, 15, F, F + 1, C_ROOF),
    box(1, 12.5, 1, 12.5, F + 1, F + 1 + U, upper),
    box(0.5, 13, 0.5, 13, F + 1 + U, F + 2 + U, C_ROOF),
  ];
}

function tower() {
  // The tower stands back from the street: a lobby of glass and one storey
  // over it fill the plot, and the shaft rises from the back of that podium
  // 3 units clear of both street faces, the plant on its crown.
  //
  // NO CANOPY. The first draft hung a slab over each lobby front and it hid
  // the door — 36 px down to 9, an awning's 2d again — while reading at zoom
  // 1 as two light slivers. The podium is this building's street; the store
  // is the one with the awning.
  const P = 12, S = 36; // the podium, the shaft
  const wall = (h) => walled(litSkin(CONC_WALL, { height: h }), h, { storey: 6, sill: 2, winH: 3, period: 3, winW: 2, from: 1, endGlass: END_GLASS });
  const lobby = shopFloor(P, { door: doorAt(8, 6, 1.5), bay: 3, pier: 0.8, sill: 0.5, head: 5 });
  const upperBand = wall(P);
  const podium = {
    ...lobby,
    side: (a, k, x, y) => (P - k >= 6 ? upperBand.side(a, k, x, y) : lobby.side(a, k, x, y)),
    end: (b, k, x, y) => (P - k >= 6 ? upperBand.end(b, k, x, y) : lobby.end(b, k, x, y)),
  };
  return [
    box(1, 15, 1, 15, 0, P, podium),
    box(0.5, 15.5, 0.5, 15.5, P, P + 1, C_ROOF),
    box(1.5, 12, 1.5, 12, P + 1, P + 1 + S, wall(S)),
    box(1, 12.5, 1, 12.5, P + 1 + S, P + 2 + S, C_ROOF),
    // The rooftop stack is a 2×2-unit concrete box: at 1.2 units in slate
    // its top was the same '?' as the cap it stood on and it vanished into a
    // 2-px near-black slit beside the AC unit (round 2). Now it has a top.
    box(7.5, 9.5, 2.5, 4.5, P + 2 + S, P + 12 + S, litSkin(CONC, { height: 10 })),
  ];
}

// ------------------------------------------------------------- industrial

function shed() {
  const H = 8;
  const wall = walled(litSkin(RUST, { grain: ribGrain, height: H }), H, { storey: 8, sill: 4, winH: 2, period: 6, winW: 3, from: 2, door: doorAt(6, 6.5, 2) });
  return [
    box(1, 15, 2.5, 13.5, 0, H, wall),
    box(0.5, 15.5, 2, 14, H, H + 1, I_ROOF),
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
    // RUST, not slate, since the roofs began saying the zone (T2.2): the
    // sawtooth IS this building's roof, and a works read grey from the air
    // like every other family. The END_GLASS rule below is untouched.
    top: () => RUST[2],
    side: () => RUST[1],
    end: (b, k) => (k < 2.5 ? END_GLASS : RUST[0]),
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
    box(0, 16, 0, 16, H, H + 1, I_ROOF),
    box(2, 7, 9, 14, H + 1, H + 8, litSkin(CONC, { grain: ringGrain, height: 7 })),
    box(3, 6, 10, 13, H + 8, H + 9.5, litSkin(CONC, { height: 1.5 })),
    box(11.5, 14.5, 1.5, 4.5, 0, H + 14, litSkin(RUST, { grain: ringGrain, height: 34 })),
  ];
}

// ------------------------------------------------------------ the meat kit
//
// Zone 4 has no buildings of its own any more: since 2026-09-26 meat is not zoned but PLACED, as a market that grows
// through its own sprites (js/art/market.js; docs/PROPOSAL-MEAT-MARKET-2026-09-26.md A.9). The stall, the meat hall
// and the cold store went with the zone, and so did the stripe keyed on the screen column that their awnings wore.
// What stays is the part of the kit other plans still draw from: the sawdust, the sign's bracket and the hook.

// Sawdust: a loose spill, so the top and the side are both the lightest
// earth — a heap has no crisp lit edge the way TIMBER does.
const SAWDUST = flatSkin(EARTH[4], EARTH[4], EARTH[3]);
// The sign bracket: the three DARKER rusts, so the one '$' dot (lum 157)
// on the slab is the brightest thing on the sign. With ']' (lum 170) on
// top the bracket's 4 px outshone the dot and the mark read as a gold
// tick on the bracket, not a dot on the slab.
const BRACKET = flatSkin(RUST[2], RUST[1], RUST[0]);

/**
 * A hook: a 1-px '+' tick, a quarter-unit either side of its column — a face
 * whose two edges both land on pixel columns is 2 px wide under the
 * rasteriser's inclusive bounds — and no end face, which at 2:1 turned each
 * tick into an inverted T. It hangs ON an edge, never behind it: anything
 * standing proud of a wall hides 2d units of it (standing brief, trap 12).
 */
const HOOK = { top: () => "+", side: () => "+", end: () => null };

// ------------------------------------------------------------- the table

const FAMILY = {
  1: { 1: ["cottage", cottage], 2: ["two-storey", twoStorey], 3: ["apartment", apartment] },
  2: { 1: ["shop", shop], 2: ["store", store], 3: ["tower", tower] },
  3: { 1: ["shed", shed], 2: ["factory", factory], 3: ["works", works] },
};
const ZONE_LETTER = { 1: "R", 2: "C", 3: "I" };

/** BUILDINGS[zone][tier][variant] — 54 sprites, six plans per family. Zone 4 (meat) has none: a market is placed, not zoned. */
export const BUILDINGS = {};
for (const zone of [1, 2, 3]) {
  BUILDINGS[zone] = {};
  for (const tier of [1, 2, 3]) {
    const [name, make] = FAMILY[zone][tier];
    const boxes = make();
    const additions = extraPlans(zone, tier, { walled, doorAt, BRICK, CONC_WALL, RUST, SLATE_SKIN, C_ROOF, ROOF: ROOF_OF[zone], TIMBER, AWNING, HOOK, STEP: flatSkin(CONC[4], CONC[3], CONC[2]), GRASS });
    // ROOF FURNITURE (T2.3) is added per VARIANT, after the plan is whole and
    // before the sprite is made, so `furnish` reads the finished boxes — a
    // chimney, a sawtooth, a tower over a podium — and lays its rails and
    // tanks on what is actually exposed to the sky.
    const dress = (plan, n) => dressRoof(plan, zone, n);
    BUILDINGS[zone][tier] = [
      solidSprite(`${ZONE_LETTER[zone]}${tier}-${name}-0`, dress(boxes, 0), { tags: ["building", ZONE_LETTER[zone]] }),
      solidSprite(`${ZONE_LETTER[zone]}${tier}-${name}-1`, dress(flipPlan(boxes), 1), { tags: ["building", ZONE_LETTER[zone]] }),
      ...additions.map((plan, n) => solidSprite(`${ZONE_LETTER[zone]}${tier}-${name}-${n + 2}`, dress(plan, n + 2), { tags: ["building", ZONE_LETTER[zone]] })),
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
  // Keep the shop-kind mapping intact. Every 22 bytes cycles back to the
  // corner shop; use that quotient to reach all three pairs of corner plans.
  if (z === 2 && tier === 1 && SHOP_ART) {
    const kind = shopKind(variant);
    const plan = (Math.floor(variant / 22) % (SHOP_ART[kind].length / 2)) * 2 + (variant & 1);
    return SHOP_ART[kind][plan];
  }
  const fam = BUILDINGS[z] && BUILDINGS[z][tier];
  if (!fam) throw new Error(`buildingSprite: no family for zone ${zone} tier ${tier}`);
  return fam[variant % fam.length];
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
  if (theme && side === 3 && LANDMARK_ART && LANDMARK_ART[theme]) return LANDMARK_ART[theme][variant % LANDMARK_ART[theme].length];
  const fam = BLOCKS && BLOCKS[z] && BLOCKS[z][side];
  if (fam) return fam[variant % fam.length];
  if (!BUILDINGS[z]) throw new Error(`blockSprite: no family for zone ${zone}`);
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
const CIVIC_VARIATIONS = new Map();
export function registerCivicVariations(base, variants) { CIVIC_VARIATIONS.set(base, [base, ...variants]); }
export function civicSprite(kind, side = null, variant = 0) {
  const base = baseCivicSprite(kind, side);
  const family = CIVIC_VARIATIONS.get(base);
  return family ? family[((variant | 0) >>> 0) % family.length] : base;
}
function baseCivicSprite(kind, side = null) {
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
  SLATE_SKIN, C_ROOF, R_ROOF, I_ROOF, M_ROOF, ROOF_OF, TIMBER, PLINTH, CONC_WALL, END_GLASS, AWNING, SAWDUST, BRACKET, HOOK, LAMP, BLUE_LAMP, STEP, POST,
  brickGrain, ribGrain, ringGrain, TREE_REACH,
});

/** Every building sprite, named, for the audit. */
export function allBuildings() {
  const out = [];
  for (const zone of [1, 2, 3]) for (const tier of [1, 2, 3]) for (const s of BUILDINGS[zone][tier]) out.push({ name: s.name, sprite: s });
  out.push({ name: PARK.name, sprite: PARK }, { name: ZOO.name, sprite: ZOO }, { name: FIRE_STATION.name, sprite: FIRE_STATION }, { name: POLICE_STATION.name, sprite: POLICE_STATION }, { name: PACIFICATION_CENTRE.name, sprite: PACIFICATION_CENTRE });
  for (const [k, list] of Object.entries(OVERLAYS)) list.forEach((s, i) => out.push({ name: `overlay-${k}-${i}`, sprite: s }));
  return out;
}
