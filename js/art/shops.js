// shops.js — THE SHOPS: ten small businesses on a 1×1 plan, the tier-1
// commercial pool beside the corner shop. SPEC §12.2d; js/sim/shops.js.
//
// The owner (2026-09-03): "unique low density shops would be a good
// target." Every one is the corner shop's footprint (a 13 × 11 body on the
// tile, the door on the side face, glass on the side and the end, the
// awning off the lit face) with ONE thing a silhouette carries at 1×: a
// stack and a round window (bakery), crates under a green awning
// (greengrocer), a slab of ice and a tiled dado (fishmonger), a bay window
// and a lamp on a tall narrow front (bookshop), the striped pole (barber), a
// glass conservatory and flower boxes (florist), a porch and parasols (tea
// room), a hanging sign and barrels under a timber-framed storey (pub), a
// ladder and buckets (ironmonger), a clock tower (clockmaker). Nothing
// draws lettering: the cut, not the word, as the meat markets taught.
//
// Same rules as every solid: boxes in [0, 16]² and c ≥ 0 (the footprint
// gate), LIGHT upper-left, END glass on the +tx face, boxes bottom-up;
// variant 1 mirrored across a = b so the door stays on a side face; the
// hi-res set twins each from its recipe.

import { box, litSkin, flatSkin } from "./solid.js";
import { solidSprite, registerShops, BUILDINGS, KIT } from "./buildings.js";
import { BLOCK_KIT } from "./blocks.js";
import { SHOPS } from "../sim/shops.js";

const { walled, doorAt, flipPlan, BRICK, CONC, RUST, SLATE, EARTH, GRASS, SLATE_SKIN, C_ROOF, TIMBER, CONC_WALL, END_GLASS, AWNING, BRACKET, LAMP, STEP, POST, brickGrain, ribGrain, ringGrain } = KIT;
const { hipRoof, chimney, bench } = BLOCK_KIT;

// ---------------------------------------------------------------- shared

const inRound = (u, g, cu, cg, r) => (u - cu) * (u - cu) + (g - cg) * (g - cg) < r * r;
const lamp = (a, b, c) => box(a, a + 0.8, b, b + 0.8, c, c + 0.8, LAMP);
const crate = (a, b, c = 0, s = 2) => box(a, a + s, b, b + s, c, c + 1.6, litSkin(EARTH, { height: 1.6 }));
const barrel = (a, b, h = 3) => box(a, a + 2.2, b, b + 2.2, 0, h, litSkin(RUST, { grain: ringGrain, height: h }));
/** A crate of produce: earth sides, a top of the produce's colour. */
const produce = (a, b, topKey, c = 0) => box(a, a + 2, b, b + 2, c, c + 1.6, { top: () => topKey, side: () => EARTH[2], end: () => EARTH[1] });
/** Gold-and-white stripes keyed on the screen column's distance from the mirror seam (buildings.js's STRIPE, in the baker's colours). */
const STRIPE = (x) => { const m = x < 0 ? -1 - x : x; return Math.floor(m / 2) & 1 ? RUST[3] : CONC[4]; };
const AWNING_GOLD = { top: (a, b, x) => STRIPE(x), side: (a, k, x) => STRIPE(x), end: (b, k, x) => STRIPE(x) };
/** A green canvas awning: the canopy ramp. */
const AWNING_GREEN = flatSkin("d", "c", "b");
/** Sea-blue and white stripes — the fishmonger's; salmon and white — the barber's, matching the pole. Under the corner shop's plain blue both read as the corner shop on the first sheet. */
const stripeOf = (dark) => { const f = (x) => { const m = x < 0 ? -1 - x : x; return Math.floor(m / 2) & 1 ? dark : CONC[4]; }; return { top: (a, b, x) => f(x), side: (a, k, x) => f(x), end: (b, k, x) => f(x) }; };
const AWNING_SEA = stripeOf("I");
const AWNING_BARBER = stripeOf(BRICK[3]);
/** Whitewash: the concrete ramp without its darkest rung. */
const white = (height) => litSkin(CONC.slice(1), { height });
/** Timber framing: plaster between studs every four units and a beam at the top. */
const framed = (H) => ({
  top: () => CONC[4],
  side: (a, k) => (Math.floor(a) % 4 === 0 || k < 1 ? EARTH[1] : CONC[3]),
  end: (b, k) => (Math.floor(b) % 4 === 0 || k < 1 ? EARTH[0] : CONC[2]),
});
/** Glass: a conservatory box — glass on every face, the top too. */
const GLASS = { glazing: true, top: () => "=", side: () => "=", end: () => END_GLASS };
/** A shopfront skin: a plain body with a glass front on the side face, a door at `doorMid`, END glass on the end. */
function front(base, H, { glass = [1, 8], gH = [2, 7], doorMid = 10.5, endGlass = [2, 9] } = {}) {
  return {
    glazing: true,
    top: base.top,
    side: (a, k, x, y) => { const g = H - k; if (a >= doorMid - 1 && a < doorMid + 1 && g < 6.5) return "+"; if (a >= glass[0] && a < glass[1] && g >= gH[0] && g < gH[1]) return "="; return base.side(a, k, x, y); },
    end: (b, k, x, y) => { const g = H - k; if (b >= endGlass[0] && b < endGlass[1] && g >= gH[0] && g < gH[1]) return END_GLASS; return base.end(b, k, x, y); },
  };
}

// --------------------------------------------------------------- the ten

/** The bakery: brick, a round window on the front, the oven's stack behind, a gold-striped awning, a rack of loaves on the step. */
function bakery() {
  const H = 9;
  const base = litSkin(BRICK, { grain: brickGrain, height: H });
  const skin = {
    glazing: true,
    top: base.top,
    side: (a, k, x, y) => { const g = H - k; if (a >= 9.5 && a < 11.5 && g < 6.5) return "+"; if (inRound(a, g, 4.5, 4.5, 2.3)) return "="; return base.side(a, k, x, y); },
    end: (b, k, x, y) => { const g = H - k; if (b >= 3 && b < 8 && g >= 2.5 && g < 6) return END_GLASS; return base.end(b, k, x, y); },
  };
  const loaf = (a, b, c) => box(a, a + 1.4, b, b + 0.9, c, c + 0.8, litSkin(RUST.slice(1), { height: 0.8 }));
  return [
    box(1.5, 14.5, 2.5, 13.5, 0, H, skin),
    ...hipRoof(1.5, 14.5, 2.5, 13.5, H, 2, 1.8),
    chimney(11, 3.5, H + 9, 2.5), // the oven's stack
    box(0.5, 8.5, 13.5, 16, 6.5, 7.8, AWNING_GOLD),
    box(1.5, 8, 13.5, 15.5, 0, 2.2, litSkin(EARTH, { height: 2.2 })), // the rack
    loaf(2, 14, 2.2), loaf(3.8, 14, 2.2), loaf(5.6, 14, 2.2), loaf(2.9, 14, 3), loaf(4.7, 14, 3),
  ];
}

/** The greengrocer: a green awning over an open glass front, crates of produce out on the step in two rows. */
function greengrocer() {
  const H = 9;
  const skin = front(litSkin(CONC_WALL, { height: H }), H, { glass: [1, 8.5], gH: [1.5, 7] });
  return [
    box(1.5, 14.5, 2.5, 13.5, 0, H, skin),
    box(1.5, 14.5, 2.5, 13.5, H, H + 0.8, C_ROOF),
    box(0.5, 9, 13.5, 16, 6.5, 7.8, AWNING_GREEN),
    box(1, 9, 13.5, 16, 0, 0.6, STEP),
    produce(1.5, 13.8, GRASS[3]), produce(3.7, 13.8, RUST[3]), produce(5.9, 13.8, "$"),
    produce(2.6, 13.8, "c", 1.6), produce(4.8, 13.8, GRASS[3], 1.6),
  ];
}

/** The fishmonger: whitewash over a blue tiled dado, the blue awning, a slab of ice on a counter under it, a barrel by the door. */
function fishmonger() {
  const H = 8;
  const base = white(H);
  const skin = front(base, H, { glass: [1, 8], gH: [2.5, 6.5], doorMid: 10.5 });
  const tiled = {
    glazing: (face, u, k) => H - k >= 2, // blue floor tiles are paint, not glass
    top: skin.top,
    side: (a, k, x, y) => (H - k < 2 && !(a >= 9.5 && a < 11.5) ? (Math.floor(a) % 2 ? "J" : "I") : skin.side(a, k, x, y)),
    end: (b, k, x, y) => (H - k < 2 ? (Math.floor(b) % 2 ? "H" : "G") : skin.end(b, k, x, y)),
  };
  return [
    box(1.5, 14.5, 2.5, 13.5, 0, H, tiled),
    box(1.5, 14.5, 2.5, 13.5, H, H + 0.8, C_ROOF),
    box(0.5, 9, 13.5, 16, 6.5, 7.8, AWNING_SEA),
    box(1.5, 8, 13.8, 15.8, 0, 2.6, litSkin(CONC, { height: 2.6 })), // the counter
    box(1.7, 7.8, 14, 15.6, 2.6, 3.2, { top: () => "=", side: () => "H", end: () => "G" }), // the ice
    barrel(12.2, 13.6, 3), // inside the tile: a barrel at b 14 reached 16.2 and failed the footprint gate
  ];
}

/** The bookshop: tall and narrow, two storeys, a timber shopfront with a bay window on the ground floor, a lamp on a bracket by the door, a gabled slate roof. */
function bookshop() {
  const H = 14;
  const brick = walled(litSkin(BRICK, { grain: brickGrain, height: H }), H, { storey: 7, sill: 9, winH: 3, period: 4, winW: 2, from: 1 });
  const skin = {
    glazing: true,
    top: brick.top,
    side: (a, k, x, y) => { const g = H - k; if (g < 7) { if (a >= 9.5 && a < 11.5 && g < 6.5) return "+"; if (a >= 1.5 && a < 8 && g >= 1.5 && g < 6) return "="; return g >= 6 || Math.floor(a) % 8 === 0 ? EARTH[1] : EARTH[2]; } return brick.side(a, k, x, y); },
    end: (b, k, x, y) => { const g = H - k; if (g < 7) { if (b >= 3 && b < 8 && g >= 1.5 && g < 6) return END_GLASS; return EARTH[0]; } return brick.end(b, k, x, y); },
  };
  return [
    box(3, 13, 2.5, 13.5, 0, H, skin),
    box(3.5, 8.5, 13.5, 14.5, 1, 6, { glazing: true, top: () => EARTH[3], side: () => "=", end: () => END_GLASS }), // the bay window
    box(3, 9, 13.5, 15, 6, 6.8, TIMBER),
    ...hipRoof(3, 13, 2.5, 13.5, H, 3, 1.4),
    chimney(4, 3.5, H + 6, 2),
    box(12.2, 12.8, 13.5, 14.3, 7, 7.5, BRACKET), lamp(12.1, 14, 6.2),
  ];
}

/** The barber: a glass front under a concrete cap, the striped pole beside the door, a bench for the queue. */
function barber() {
  const H = 9;
  const skin = front(litSkin(CONC_WALL, { height: H }), H, { glass: [1, 8.5], gH: [1.5, 7.5] });
  const pole = { top: () => CONC[4], side: (a, k, x, y) => (Math.floor(y / 2) & 1 ? BRICK[3] : CONC[4]), end: (b, k, x, y) => (Math.floor(y / 2) & 1 ? BRICK[2] : CONC[3]) };
  return [
    box(1.5, 14.5, 2.5, 13.5, 0, H, skin),
    box(1.5, 14.5, 2.5, 13.5, H, H + 0.8, C_ROOF),
    box(0.5, 9, 13.5, 16, 6.5, 7.8, AWNING_BARBER),
    box(12.3, 13.3, 13.5, 14.5, 3, 9, pole), // the pole
    box(12.1, 13.5, 13.4, 14.7, 9, 9.6, litSkin(CONC, { height: 0.6 })),
    // The queue's bench, shallower than the park's so it stays inside the tile (b ≤ 16): seat, back, two legs.
    box(2, 6.5, 14, 15.6, 1.4, 2.1, TIMBER), box(2, 6.5, 14, 14.5, 2.1, 4, TIMBER),
    box(2.3, 3, 14.2, 15.4, 0, 1.4, TIMBER), box(5.5, 6.2, 14.2, 15.4, 0, 1.4, TIMBER),
  ];
}

/** The florist: a brick back building with a glass conservatory on its front, flower boxes under the upstairs windows and along the conservatory, a green awning off the door. */
function florist() {
  const H = 9;
  const brick = walled(litSkin(BRICK, { grain: brickGrain, height: H }), H, { storey: 9, sill: 5, winH: 3, period: 4, winW: 2, from: 1, door: doorAt(11, 6, 1.1) });
  const flowers = { top: (a, b, x, y) => ((x + 2 * y) % 5 === 0 ? "$" : (x * 3 + y) % 7 === 0 ? "-" : "d"), side: () => EARTH[2], end: () => EARTH[1] };
  return [
    box(1.5, 14.5, 2.5, 9, 0, H, brick), // the back building
    ...hipRoof(1.5, 14.5, 2.5, 9, H, 2, 1.6),
    box(1.5, 9.5, 9, 14, 0, 6, GLASS), // the conservatory
    box(1.5, 9.5, 9, 14, 6, 6.6, TIMBER),
    box(10, 14.5, 9, 14, 0, 6, brick), // the doorway wing
    box(10, 14.5, 9, 14, 6, 6.8, SLATE_SKIN),
    box(9.5, 14.5, 13.5, 16, 5, 6.2, AWNING_GREEN),
    box(2, 9, 14, 15.6, 0, 1.4, flowers), box(2, 9, 14, 15.6, 0, 0.4, litSkin(EARTH, { height: 0.4 })),
    box(3, 7, 8.6, 9.2, 5, 6, flowers), // the upstairs box under the window
  ];
}

/** The tea room: a brick cottage with a bay window and a chimney, a porch on two posts over the door, two tables with parasols outside. */
function teaRoom() {
  const H = 8;
  const brick = walled(litSkin(BRICK, { grain: brickGrain, height: H }), H, { storey: 8, sill: 3, winH: 3, period: 5, winW: 2, from: 1, door: doorAt(10.5, 6, 1.1) });
  const table = (a, b) => [box(a, a + 2.4, b, b + 2.4, 0, 2.4, litSkin(CONC, { height: 2.4 })), box(a + 1, a + 1.4, b + 1, b + 1.4, 2.4, 6, POST), box(a - 0.8, a + 3.2, b - 0.8, b + 3.2, 6, 6.8, AWNING_GOLD)];
  return [
    box(1.5, 12.5, 2.5, 11, 0, H, brick),
    ...hipRoof(1.5, 12.5, 2.5, 11, H, 3, 1.4),
    chimney(2.5, 3.5, H + 6, 2),
    box(2.5, 7, 11, 12, 1, 5.5, { glazing: true, top: () => EARTH[3], side: () => "=", end: () => END_GLASS }), // the bay
    box(2, 7.5, 11, 12.5, 5.5, 6.3, TIMBER),
    box(8.5, 12.5, 11, 14, 6, 7, SLATE_SKIN), // the porch roof
    box(8.7, 9.5, 13, 13.8, 0, 6, litSkin(EARTH, { height: 6 })), box(11.5, 12.3, 13, 13.8, 0, 6, litSkin(EARTH, { height: 6 })),
    box(1, 15, 12, 16, 0, 0.5, STEP),
    ...table(1.5, 12.6), ...table(12.6, 4), // the parasols reach 0.8 past the table: at 13 and 13 they crossed the tile edge
  ];
}

/** The pub: brick ground floor, a timber-framed storey above under a slate roof with a dormer, the hanging sign on its bracket, a lamp each side of the door, two barrels by the wall. */
function pub() {
  const H1 = 8, H2 = 7, H = H1 + H2;
  const brick = walled(litSkin(BRICK, { grain: brickGrain, height: H1 }), H1, { storey: 8, sill: 2.5, winH: 3.5, period: 4, winW: 2, from: 1, door: doorAt(10, 6.5, 1.3) });
  const upper = framed(H2);
  const skin = {
    glazing: true,
    top: upper.top,
    side: (a, k, x, y) => (H - k < H1 ? brick.side(a, k - H2, x, y) : (H - k >= H1 + 2 && H - k < H1 + 5 && Math.floor(a) % 4 === 2 ? "=" : upper.side(a, k, x, y))),
    end: (b, k, x, y) => (H - k < H1 ? brick.end(b, k - H2, x, y) : (H - k >= H1 + 2 && H - k < H1 + 5 && Math.floor(b) % 4 === 2 ? END_GLASS : upper.end(b, k, x, y))),
  };
  const sign = { top: () => SLATE[2], side: (a, k) => (inRound(a, k, 1.5, 1.4, 0.9) ? RUST[3] : SLATE[1]), end: () => SLATE[0] };
  return [
    box(1.5, 14.5, 2.5, 13.5, 0, H, skin),
    box(0.5, 15.5, 1.5, 14.5, H, H + 1, SLATE_SKIN), // the eave
    ...hipRoof(1.5, 14.5, 2.5, 13.5, H + 1, 2, 2),
    chimney(3, 3.5, H + 7, 2),
    box(6, 9, 11, 13.8, H + 1, H + 4, litSkin(BRICK, { grain: brickGrain, height: 3 })), box(5.5, 9.5, 10.5, 14.3, H + 4, H + 5, SLATE_SKIN), // the dormer
    box(6.5, 7, 13.5, 14.5, H1 + 3, H1 + 3.5, BRACKET), box(5.5, 8.5, 14.3, 14.8, H1, H1 + 3, sign), // the sign
    lamp(8, 13.6, 7), lamp(12.2, 13.6, 7),
    barrel(1.8, 13.8, 3), barrel(4.2, 13.8, 3),
  ];
}

/** The ironmonger: a rust-ribbed shed with a glass front, a ladder against the end wall, buckets on the step, a sign slab on a bracket. */
function ironmonger() {
  const H = 9;
  const skin = front(litSkin(RUST, { grain: ribGrain, height: H }), H, { glass: [1.5, 8], gH: [2, 6.5], endGlass: [3, 7] });
  const rail = litSkin(EARTH, { height: 8 });
  return [
    box(1.5, 14.5, 2.5, 13.5, 0, H, skin),
    box(1, 15, 2, 14, H, H + 1, SLATE_SKIN),
    box(0.5, 9, 13.5, 16, 6.5, 7.8, AWNING),
    // The ladder, leaning on the end wall: two rails and four rungs.
    box(14.5, 15.2, 4, 4.7, 0, 8, rail), box(14.5, 15.2, 8.3, 9, 0, 8, rail),
    ...[1.5, 3.5, 5.5, 7.5].map((c) => box(14.5, 15.1, 4.7, 8.3, c, c + 0.5, TIMBER)),
    barrel(10.5, 13.6, 2.4), barrel(12.6, 13.6, 1.8), // buckets, inside the tile
    box(3, 3.5, 13.5, 14.5, 8, 8.5, BRACKET), box(1.8, 4.8, 14.5, 15, 6, 7.8, litSkin(SLATE, { height: 1.8 })),
  ];
}

/** The clockmaker: a concrete shop with a small clock tower on its roof, the face to the street on both near faces, a lamp on its cap. */
function clockmaker() {
  const H = 9;
  const skin = front(litSkin(CONC_WALL, { height: H }), H, { glass: [1.5, 8], gH: [2, 6.5] });
  const face = (u, k) => (u >= 0.5 && u < 3.5 && k >= 1 && k < 4 ? (inRound(u, k, 2, 2.5, 0.6) ? "+" : CONC[4]) : null);
  const clock = { top: () => CONC[3], side: (a, k) => face(a, k) || CONC[2], end: (b, k) => face(b, k) || CONC[1] };
  return [
    box(1.5, 14.5, 2.5, 13.5, 0, H, skin),
    box(1.5, 14.5, 2.5, 13.5, H, H + 0.8, C_ROOF),
    box(0.5, 9, 13.5, 16, 6.5, 7.8, AWNING),
    box(9, 13, 9.5, 13.5, H + 0.8, H + 6, clock), // the tower
    box(8.5, 13.5, 9, 14, H + 6, H + 7, SLATE_SKIN),
    lamp(10.6, 11.1, H + 7),
  ];
}

// --------------------------------------------------------------- the pool

const MAKERS = { bakery, greengrocer, fishmonger, bookshop, barber, florist, "tea-room": teaRoom, pub, ironmonger, clockmaker };

/** SHOP_ART[kind] = [variant 0, variant 1]; kind 0 is the corner shop buildings.js already made. */
export const SHOP_ART = SHOPS.map((s) => {
  if (s.kind === 0) return BUILDINGS[2][1];
  const make = MAKERS[s.key];
  if (!make) throw new Error(`shops: no maker for '${s.key}'`);
  const boxes = make();
  return [
    solidSprite(`C1-${s.key}-0`, boxes, { tags: ["building", "C", "shop"] }),
    solidSprite(`C1-${s.key}-1`, flipPlan(boxes), { tags: ["building", "C", "shop"] }),
  ];
});
registerShops(SHOP_ART);

/** Every shop sprite of the pool but the corner shop (buildings.js lists that), named, for the audit and the sheet. */
export function allShops() {
  const out = [];
  for (const s of SHOPS) if (s.kind) for (const sp of SHOP_ART[s.kind]) out.push({ name: sp.name, sprite: sp });
  return out;
}
