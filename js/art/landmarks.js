// landmarks.js — THE LANDMARKS: eleven 3×3 buildings, one per roster row of
// js/sim/landmarks.js, each the picture of the species that made it. SPEC
// §3c, §12.2c; docs/PROPOSAL-LANDMARKS.md.
//
// The owner (2026-09-02): "themed commercial shops, an industrial dairy, or
// a residential apartment building." A landmark is what a 3×3 block IS when
// its animals are of a kind (sim/landmarks.js chooses the theme once, when
// the block forms), so each of these is its zone's block — brick and slate
// for R, concrete and glass for C, rust and timber for I — with the species'
// composition on top: round doors for the burrowers, a log lodge and a pond
// for the dam-builders, towers on stilts for the perchers, wallows and bins
// for the dirt crowd, a cobbled mews for the cats and foxes; an inn, a night
// market; silos, kilns, hives, a log pond. Nothing here draws a face: the
// species is in what the animals BUILT, which is the thesis made visible at
// the largest scale the map has.
//
// Every plan is boxes on a 3×3 (a, b ∈ [0, 48]) through the one rasteriser,
// built from buildings.js's KIT and blocks.js's BLOCK_KIT, so the footprint
// gate (check.mjs Part C) and the ray audit (tools/depthaudit.mjs) hold for
// every one; variant 1 is variant 0 mirrored across a = b (`family`); the
// hi-res set (hires.js) twins each from its recipe. LIGHT upper-left; END
// glass on every +tx face; doors on side faces; boxes listed bottom-up.

import { box, litSkin, flatSkin } from "./solid.js";
import { registerLandmarks, KIT } from "./buildings.js";
import { BLOCK_KIT } from "./blocks.js";
import { TREE_ROUND, TREE_TALL, TREE_WILLOW } from "./terrain.js";
import { LANDMARKS } from "../sim/landmarks.js";

const { walled, doorAt, BRICK, CONC, RUST, SLATE, EARTH, GRASS, SLATE_SKIN, C_ROOF, TIMBER, PLINTH, CONC_WALL, END_GLASS, SAWDUST, BRACKET, HOOK, LAMP, STEP, POST, brickGrain, ribGrain, ringGrain } = KIT;
const { hipRoof, chimney, gardenWall, pen, sawtooth, stack, tank, bench, fountain, van, VAN, WHEEL, family } = BLOCK_KIT;

// ---------------------------------------------------------------- shared

/** Still water: a pond, a pool, a trough — the water ramp's middle keys (the tile's cycle does not reach a building; a pond in a plan holds still). */
const WATER = { top: () => "I", side: () => "H", end: () => "G" };
/** Bare trodden mud. */
const MUD = flatSkin(EARTH[1], EARTH[0], EARTH[0]);
/** Cobbles: a two-pixel check on the top face. */
const COBBLE = { top: (a, b, x, y) => ((((x >> 1) + y) & 1) ? CONC[2] : CONC[3]), side: () => CONC[2], end: () => CONC[1] };
/** Whitewash: the concrete ramp without its darkest rung. */
const white = (height) => litSkin(CONC.slice(1), { height });
/** Rubble stone: slate with a coarse pick. */
const stoneGrain = (x, y) => (((x * 7 + y * 13) % 11) < 3 ? -0.6 : 0);
const stone = (height) => litSkin(SLATE, { grain: stoneGrain, height });
/** A round hole (a door, a window) in face coordinates. */
const inRound = (u, g, cu, cg, r) => (u - cu) * (u - cu) + (g - cg) * (g - cg) < r * r;
/** A hanging lamp: one lit unit. */
const lamp = (a, b, c) => box(a, a + 1, b, b + 1, c, c + 1, LAMP);
/** A hive: a white body under a slate lid. */
const hive = (a, b) => [box(a, a + 3, b, b + 3, 0, 3, litSkin(CONC.slice(2), { height: 3 })), box(a - 0.4, a + 3.4, b - 0.4, b + 3.4, 3, 3.8, SLATE_SKIN)];
/** A bin: a slate drum with a concrete lid. */
const bin = (a, b, h = 3) => [box(a, a + 2, b, b + 2, 0, h, litSkin(SLATE, { grain: ringGrain, height: h })), box(a - 0.3, a + 2.3, b - 0.3, b + 2.3, h, h + 0.6, litSkin(CONC, { height: 0.6 }))];
/** A crate. */
const crate = (a, b, c = 0, s = 2.5) => box(a, a + s, b, b + s, c, c + 2, litSkin(EARTH, { height: 2 }));
/** A log lying along a: a low box with ring grain on its cut end. */
const log = (a0, a1, b, c, d = 1.6) => box(a0, a1, b, b + d, c, c + d, { top: () => EARTH[3], side: () => EARTH[2], end: (bb, k, x, y) => (ringGrain(x, y) ? EARTH[1] : EARTH[2]) });

/**
 * Log walls: courses three units high with a dark seam between, so a hall
 * reads as stacked timber and not as a brick box in the wrong ramp.
 */
function logSkin(H, { door = null, win = null, dark = false } = {}) {
  const course = (g) => Math.floor(g) % 3 === 2;
  const d = dark ? 1 : 0; // the great lodge one rung darker throughout: at the top rung it read as a pale sand pyramid
  return {
    glazing: true,
    top: () => EARTH[4 - d],
    side: (a, k) => { const g = H - k; if (door && door(a, g)) return "+"; if (win && win(a, g)) return "="; return course(g) ? EARTH[1 - d] : EARTH[3 - d]; },
    end: (b, k) => { const g = H - k; if (win && win(b, g)) return END_GLASS; return course(g) ? EARTH[0] : EARTH[2 - d]; },
  };
}

/** Timber framing: plaster between dark studs every five units and a beam at each storey. */
function framed(H, { storey = 8, door = null, win = null } = {}) {
  const stud = (u, g) => Math.floor(u) % 5 === 0 || Math.floor(g) % storey === storey - 1;
  return {
    glazing: true,
    top: () => CONC[4],
    side: (a, k) => { const g = H - k; if (door && door(a, g)) return "+"; if (win && win(a, g)) return "="; return stud(a, g) ? EARTH[1] : CONC[3]; },
    end: (b, k) => { const g = H - k; if (win && win(b, g)) return END_GLASS; return stud(b, g) ? EARTH[0] : CONC[2]; },
  };
}

/** Square windows by storey, as `walled` cuts them, for the skins above. */
const winsOf = ({ storey = 8, sill = 3, winH = 3, period = 4, winW = 2, from = 1 }) => (u, g) => { const gg = Math.floor(g) % storey; const uu = Math.floor(u) % period; return g >= 1 && gg >= sill && gg < sill + winH && uu >= from && uu < from + winW; };

/** A stepped pyramid roof over [a0, a1] × [b0, b1] from h — the roost's caps. */
function pyramid(a0, a1, b0, b1, h, steps = 4) {
  const out = [];
  const w = Math.min(a1 - a0, b1 - b0) / 2;
  for (let i = 0; i < steps; i++) {
    const k = (w / steps) * i;
    out.push(box(a0 + k - (i ? 0 : 0.5), a1 - k + (i ? 0 : 0.5), b0 + k - (i ? 0 : 0.5), b1 - k + (i ? 0 : 0.5), h + i * 1.2, h + (i + 1) * 1.2, SLATE_SKIN));
  }
  return out;
}

/** A beehive kiln: brick, stepped, a dark mouth on its side face. */
function kiln(a, b, s = 8) {
  const steps = [[0, 4], [1, 3], [2, 2.2], [3, 1.4]];
  const out = [];
  let c = 0;
  for (const [inset, h] of steps) {
    const skin = litSkin(BRICK, { grain: brickGrain, height: h });
    const mouth = inset === 0 ? { top: skin.top, side: (aa, k, x, y) => (inRound(aa, h - k, s / 2, 0.8, 1.7) ? "+" : skin.side(aa, k, x, y)), end: skin.end } : skin;
    out.push(box(a + inset, a + s - inset, b + inset, b + s - inset, c, c + h, mouth));
    c += h;
  }
  out.push(box(a + s / 2 - 0.6, a + s / 2 + 0.6, b + s / 2 - 0.6, b + s / 2 + 0.6, c, c + 2, litSkin(SLATE, { height: 2 })));
  return out;
}

const ZL = { 1: "R", 2: "C", 3: "I", 4: "M" };

// ------------------------------------------------------------ residential

/**
 * Warren Towers (R, rabbit + mouse): three brick drums of five storeys with
 * ROUND doors and round windows in offset rows — the honeycomb — under sod
 * roofs, a two-storey link between the back two, and in the front corner a
 * grass burrow mound with three round holes on its face and a tree on top.
 */
function warrenTowers() {
  const honey = (H, doorMid) => {
    const base = litSkin(BRICK, { grain: brickGrain, height: H });
    const hole = (u, g) => { const s = Math.floor(g / 8); const gg = g - 8 * s; return g > 1 && inRound(((u + (s & 1 ? 3 : 0)) % 6), gg, 3, 4.5, 1.6); };
    return {
      glazing: true,
      top: base.top,
      side: (a, k, x, y) => { const g = H - k; if (doorMid != null && g < 5 && (g < 2.5 ? Math.abs(a - doorMid) < 2.2 : inRound(a, g, doorMid, 2.5, 2.2))) return "+"; return hole(a, g) ? "=" : base.side(a, k, x, y); },
      end: (b, k, x, y) => { const g = H - k; return hole(b, g) ? END_GLASS : base.end(b, k, x, y); },
    };
  };
  const drum = (a, b, s, H, doorMid) => [box(a, a + s, b, b + s, 0, H, honey(H, doorMid)), box(a - 0.5, a + s + 0.5, b - 0.5, b + s + 0.5, H, H + 1.2, PLINTH), box(a + 1, a + s - 1, b + 1, b + s - 1, H + 1.2, H + 2, PLINTH)];
  // The burrow mound: dug earth banks under a grass top (in grass keys throughout it vanished into the lawn — the first sheet), three burrow holes on its face.
  const mound = (() => {
    const bank = { top: () => GRASS[3], side: () => EARTH[2], end: () => EARTH[1] };
    const face = { top: bank.top, side: (a, k) => ((4 - k) < 2.8 && [5, 13, 21].some((m) => (4 - k) < 1.4 ? Math.abs(a - m) < 1.9 : inRound(a, 4 - k, m, 1.4, 1.9)) ? "+" : EARTH[2]), end: bank.end };
    return [box(20, 46, 20, 46, 0, 4, face), box(23, 43, 23, 43, 4, 7, bank), box(27, 39, 27, 39, 7, 9.5, bank), box(31, 35, 31, 35, 9.5, 11, bank)];
  })();
  return [
    box(1, 47, 1, 47, 0, 0.6, PLINTH), // the lawn
    ...drum(2, 2, 13, 40, 6.5),
    ...drum(31, 2, 13, 32, 6.5),
    box(15, 31, 3, 12, 0, 16, honey(16, null)), // the link
    box(14.5, 31.5, 2.5, 12.5, 16, 17, PLINTH),
    ...drum(2, 28, 13, 36, 6.5),
    ...mound,
    box(15, 20, 30, 34, 0, 0.9, STEP), // the path from the front drum to the mound
    box(20, 24, 40, 44, 0, 0.9, STEP),
    ...bench(38, 16),
  ];
}

/**
 * The Lodge (R, beaver + bear + wolf): two log halls with round windows on a
 * dam-stone plinth either side of a pond dammed with stone at its front, and
 * at the back the great lodge — a stepped mound of logs with a round door and
 * a smoke hole — a woodpile by the water, tall trees behind.
 */
function theLodge() {
  const H = 14;
  const win = winsOf({ storey: 7, sill: 2, winH: 3, period: 5, winW: 2, from: 2 });
  const hallA = logSkin(H, { door: doorAt(16, 6, 1.6), win });
  const hallB = logSkin(H, { door: doorAt(14, 6, 1.6), win });
  const lodge = (h, inset) => logSkin(h, { dark: true, door: inset === 0 ? (a, g) => (g < 5 && (g < 2.5 ? Math.abs(a - 12) < 2.4 : inRound(a, g, 12, 2.5, 2.4))) : null });
  return [
    box(1, 47, 1, 47, 0, 1, stone(1)), // the dam-stone plinth
    // The great lodge at the back: four steps of logs.
    box(12, 36, 2, 22, 1, 9, lodge(8, 0)),
    box(14.5, 33.5, 4, 20, 9, 15, lodge(6, 1)),
    box(17.5, 30.5, 6.5, 17.5, 15, 19.5, lodge(4.5, 2)),
    box(21, 27, 9.5, 14.5, 19.5, 22, lodge(2.5, 3)),
    box(23, 25, 11, 13, 22, 24, litSkin(SLATE, { height: 2 })), // the smoke hole
    // The two halls, shingle roofs.
    box(2, 12, 22, 46, 1, 1 + H, hallB),
    ...hipRoof(2, 12, 22, 46, 1 + H, 3, 1.5),
    box(36, 46, 22, 46, 1, 1 + H, hallA),
    ...hipRoof(36, 46, 22, 46, 1 + H, 3, 1.5),
    chimney(4, 24, 1 + H + 7, 2), chimney(43, 24, 1 + H + 7, 2),
    // The pond, its stone dam along the front, the woodpile.
    box(13, 35, 24, 42, 1, 1.8, WATER),
    box(13, 35, 42, 44.5, 1, 4, stone(3)),
    log(15, 24, 26, 1.8), log(26, 33, 30, 1.8),
    log(13.5, 22, 44.5, 1), log(13.5, 22, 46.2, 1), log(15, 20.5, 44.5, 2.6),
    box(24, 35, 44.5, 47, 1, 1.6, STEP), // the landing
  ];
}

/**
 * The Roost (R, owl + hawk): three timber towers on stilts — the tallest at
 * the back — with round windows high up under stepped slate caps, perch beams
 * between them at storey height, a lamp on the tallest, and tall trees in
 * the lawn they stand over.
 */
function theRoost() {
  const perchWin = (H) => (u, g) => g > H - 14 && g < H - 2 && inRound(u % 4, (g - (H - 14)) % 6, 2, 3, 1.4);
  const tower = (a, b, s, legs, H) => {
    const out = [];
    for (const [da, db] of [[0, 0], [s - 1.2, 0], [0, s - 1.2], [s - 1.2, s - 1.2]]) out.push(box(a + da, a + da + 1.2, b + db, b + db + 1.2, 0, legs, litSkin(EARTH, { height: legs })));
    out.push(box(a - 0.5, a + s + 0.5, b - 0.5, b + s + 0.5, legs, legs + 1, TIMBER)); // the deck
    const body = litSkin(EARTH, { grain: ribGrain, height: H });
    const skin = { glazing: true, top: body.top, side: (aa, k, x, y) => (perchWin(H)(aa, H - k) ? "=" : body.side(aa, k, x, y)), end: (bb, k, x, y) => (perchWin(H)(bb, H - k) ? END_GLASS : body.end(bb, k, x, y)) };
    out.push(box(a, a + s, b, b + s, legs + 1, legs + 1 + H, skin));
    out.push(...pyramid(a, a + s, b, b + s, legs + 1 + H, 4));
    return out;
  };
  return [
    box(1, 47, 1, 47, 0, 0.6, PLINTH),
    ...tower(6, 6, 9, 10, 34), // A, the tallest, back-left
    ...tower(31, 4, 9, 8, 26), // B, back-right
    ...tower(18, 30, 9, 12, 28), // C, front
    // Perch beams: A → B along a at storey height, A → C along b.
    box(15, 31, 9.5, 10.5, 30, 31, TIMBER),
    box(9.5, 10.5, 15, 30, 33, 34, TIMBER),
    box(15, 20, 33.5, 34.5, 36, 37, TIMBER), // a bar off C's roof for the hawks
    lamp(10, 10, 47), // on A's cap
    box(4, 8, 40, 46, 0, 0.9, STEP),
    ...bench(38, 40),
  ];
}

/**
 * The Wallows (R, pig + raccoon + skunk): two low brick ranges in an L round
 * a mud court with two wallow pools, a row of four bins along the back wall,
 * a fence with a gate across the front, and a tree in the corner for the
 * shade — the dirt crowd's own idea of comfort.
 */
function theWallows() {
  const H = 15;
  const wallA = walled(litSkin(BRICK, { grain: brickGrain, height: H }), H, { storey: 7, sill: 3, winH: 2.5, period: 4, winW: 2, from: 1, door: doorAt(22, 5.5, 1.5) });
  const wallB = walled(litSkin(BRICK, { grain: brickGrain, height: H }), H, { storey: 7, sill: 3, winH: 2.5, period: 4, winW: 2, from: 1, door: doorAt(10, 5.5, 1.5) });
  return [
    box(1, 47, 1, 47, 0, 0.5, MUD), // the court
    box(1, 47, 1, 11, 0, H, wallA), // the back range
    ...hipRoof(1, 47, 1, 11, H, 2, 1.5),
    chimney(6, 2, H + 6), chimney(40, 2, H + 6),
    box(1, 11, 11, 44, 0, H, wallB), // the left range
    ...hipRoof(1, 11, 11, 44, H, 2, 1.5),
    // The wallows: two pools, each two overlapping boxes so the edge is not a square.
    box(16, 28, 18, 26, 0, 0.9, WATER), box(20, 32, 22, 30, 0, 0.9, WATER),
    box(30, 42, 30, 38, 0, 0.9, WATER), box(26, 36, 34, 42, 0, 0.9, WATER),
    // The bins along the back range's front.
    ...bin(14, 12), ...bin(18, 12), ...bin(22, 12), ...bin(26, 12),
    // The fence across the front and down the right with its rails, a gate gap at 24 — a pen's two near sides, without its back, its left or its sawdust floor (the court is mud).
    ...pen(11, 47, 11, 47, 24).slice(2, 7),
    box(12, 18, 40, 46, 0, 0.8, STEP), // a dry step by the gate
  ];
}

/**
 * The Mews (R, cat + fox): a cobbled mews — four tall narrow townhouses in a
 * terrace along the back, three more down the left, each with an arched
 * carriage door, a lamp on a bracket beside it and its own chimney, the roofs
 * stepping up and down the row — and a lamp post in the yard.
 */
function theMews() {
  const house = (a0, a1, b0, b1, H, doorMid, flip) => {
    const arch = (u, g) => g < 8 && (g < 4.5 ? Math.abs(u - doorMid) < 3.2 : inRound(u, g, doorMid, 4.5, 3.2));
    const skin = walled(litSkin(BRICK, { grain: brickGrain, height: H }), H, { storey: 9, sill: 4, winH: 3.5, period: 4, winW: 2, from: 1, door: flip ? null : arch });
    const out = [box(a0, a1, b0, b1, 0, H, skin), ...hipRoof(a0, a1, b0, b1, H, 2, 1.5), chimney(a0 + 1, b0 + 1, H + 6, 1.8)];
    if (!flip) out.push(box(a0 + doorMid + 3.8, a0 + doorMid + 4.8, b1, b1 + 0.6, 7.5, 8.5, LAMP), box(a0 + doorMid + 3.8, a0 + doorMid + 4.8, b1 - 0.5, b1 + 0.2, 8.5, 9, BRACKET));
    return out;
  };
  return [
    box(1, 47, 1, 47, 0, 0.6, COBBLE), // the yard
    // The back terrace, four houses along a.
    ...house(1, 12, 1, 13, 28, 6, false),
    ...house(12, 23, 1, 13, 32, 5, false),
    ...house(23, 34, 1, 13, 26, 6, false),
    ...house(34, 46, 1, 13, 30, 6, false),
    // The left terrace, three houses down b — their arches face the yard on the end face, so these keep plain fronts and a lamp each.
    ...house(1, 13, 13, 24, 27, 5, true),
    ...house(1, 13, 24, 35, 31, 5, true),
    ...house(1, 13, 35, 46, 25, 5, true),
    lamp(13.2, 18, 8), lamp(13.2, 29, 8), lamp(13.2, 40, 8),
    // The lamp post.
    box(30, 31.2, 30, 31.2, 0, 11, POST), lamp(29.6, 29.6, 11),
    box(24, 44, 40, 46, 0, 0.9, STEP), // the mews' own paving strip
    ...bench(38, 22),
  ];
}

// ------------------------------------------------------------- commercial

/**
 * The Fox & Cat (C, fox + cat): a coaching inn round a yard — a brick ground
 * floor under timber-framed plaster, a great hipped roof with dormers, a
 * carriage arch through the front range with a lantern each side, the
 * gallery along the yard at first-floor height on posts, the hanging sign on
 * its bracket, a trough and two barrels in the cobbled yard.
 */
function foxAndCat() {
  const H1 = 9, H2 = 10, H = H1 + H2;
  const win = winsOf({ storey: 9, sill: 3, winH: 3, period: 5, winW: 2, from: 2 });
  const upper = framed(H2, { storey: 10, win: winsOf({ storey: 10, sill: 3, winH: 3.5, period: 5, winW: 2, from: 2 }) });
  const range = (arch) => {
    const brick = walled(litSkin(BRICK, { grain: brickGrain, height: H1 }), H1, { storey: 9, sill: 3, winH: 3, period: 5, winW: 2, from: 2, door: arch });
    return {
      glazing: true,
    top: upper.top,
      side: (a, k, x, y) => { const g = H - k; return g < H1 ? brick.side(a, k - H2, x, y) : upper.side(a, k, x, y); },
      end: (b, k, x, y) => { const g = H - k; return g < H1 ? brick.end(b, k - H2, x, y) : upper.end(b, k, x, y); },
    };
  };
  void win;
  const arch = (u, g) => g < 8 && (g < 4.5 ? Math.abs(u - 24) < 3.6 : inRound(u, g, 24, 4.5, 3.6));
  const sign = { top: () => SLATE[2], side: (a, k) => (inRound(a, k, 2, 2, 1.1) ? RUST[3] : SLATE[1]), end: () => SLATE[0] };
  return [
    box(1, 47, 1, 47, 0, 0.6, COBBLE),
    // The front range with the carriage arch.
    box(1, 47, 34, 46, 0, H, range(arch)),
    ...hipRoof(1, 47, 34, 46, H, 3, 1.6),
    lamp(19, 46, 8.5), lamp(28, 46, 8.5),
    // The back range and the left wing.
    box(1, 47, 1, 12, 0, H, range(null)),
    ...hipRoof(1, 47, 1, 12, H, 3, 1.6),
    box(1, 12, 12, 34, 0, H, range(null)),
    ...hipRoof(1, 12, 12, 34, H, 3, 1.6),
    chimney(6, 2, H + 8, 2.2), chimney(38, 2, H + 8, 2.2), chimney(40, 36, H + 8, 2.2),
    // Dormers on the front range.
    box(8, 12, 43, 46.5, H + 1, H + 4.5, litSkin(BRICK, { grain: brickGrain, height: 3.5 })), box(7.5, 12.5, 42.5, 47, H + 4.5, H + 5.5, SLATE_SKIN),
    box(34, 38, 43, 46.5, H + 1, H + 4.5, litSkin(BRICK, { grain: brickGrain, height: 3.5 })), box(33.5, 38.5, 42.5, 47, H + 4.5, H + 5.5, SLATE_SKIN),
    // The gallery round the yard: a slab on posts along the back range's front and the left wing's yard face.
    box(12, 46, 12, 15, H1, H1 + 1, TIMBER), box(12, 15, 15, 34, H1, H1 + 1, TIMBER),
    ...[16, 24, 32, 40].map((a) => box(a, a + 1, 14, 15, 0, H1, litSkin(EARTH, { height: H1 }))),
    ...[18, 26].map((b) => box(14, 15, b, b + 1, 0, H1, litSkin(EARTH, { height: H1 }))),
    box(12, 46, 14.5, 15.2, H1 + 1, H1 + 3.5, { top: () => EARTH[4], side: (a) => (Math.floor(a) % 2 ? EARTH[3] : null), end: () => EARTH[2] }), // the rail
    box(14.5, 15.2, 15, 34, H1 + 1, H1 + 3.5, { top: () => EARTH[4], side: () => EARTH[3], end: (b) => (Math.floor(b) % 2 ? EARTH[2] : null) }),
    // The hanging sign over the arch, on a bracket.
    box(24, 24.5, 46, 47, 12, 12.5, BRACKET),
    box(22, 26, 46.5, 47, 9.5, 12, sign),
    // The yard: a trough, two barrels.
    box(30, 40, 20, 23, 0, 2.5, { top: () => "I", side: () => CONC[2], end: () => CONC[1] }),
    box(20, 23, 26, 29, 0, 3.5, litSkin(RUST, { grain: ringGrain, height: 3.5 })), box(24, 27, 26, 29, 0, 3.5, litSkin(RUST, { grain: ringGrain, height: 3.5 })),
  ];
}

/**
 * The Night Market (C, raccoon + owl + skunk): a two-storey concrete hall at
 * the back with a lit sign along its roof and a string of lamps under the
 * eave, and before it two rows of stalls — a timber counter, two posts, a
 * striped awning in gold and dark, a lantern on every post — on paving, with
 * a row of bins along the hall's end for what the night leaves.
 */
function nightMarket() {
  const H = 16;
  const base = litSkin(CONC_WALL, { height: H });
  const hall = {
    glazing: true,
    top: base.top,
    side: (a, k, x, y) => { const g = H - k; if (g >= 1 && g < 7 && Math.floor(a) % 7 !== 6) return a >= 20 && a < 26 && g < 6 ? "+" : "="; if (g >= 10 && g < 13 && Math.floor(a) % 3 === 1) return "-"; return base.side(a, k, x, y); },
    end: (b, k, x, y) => { const g = H - k; if (g >= 1 && g < 7 && Math.floor(b) % 7 !== 6) return END_GLASS; if (g >= 10 && g < 13 && Math.floor(b) % 3 === 1) return "-"; return base.end(b, k, x, y); },
  };
  const STRIPE = (x) => { const m = x < 0 ? -1 - x : x; return Math.floor(m / 2) & 1 ? SLATE[0] : RUST[3]; };
  const AWNING_N = { top: (a, b, x) => STRIPE(x), side: (a, k, x) => STRIPE(x), end: (b, k, x) => STRIPE(x) };
  const sign = { top: () => SLATE[2], side: (a, k) => (k >= 1 && k < 2.5 && Math.floor(a) % 2 === 0 ? "-" : SLATE[1]), end: () => SLATE[0] };
  const stall = (a, b) => [
    box(a, a + 10, b, b + 3, 0, 3, TIMBER),
    box(a, a + 1, b + 3.2, b + 4.2, 0, 7, litSkin(EARTH, { height: 7 })), box(a + 9, a + 10, b + 3.2, b + 4.2, 0, 7, litSkin(EARTH, { height: 7 })),
    box(a - 0.5, a + 10.5, b - 0.5, b + 4.6, 7, 8.2, AWNING_N),
    lamp(a + 9, b + 4.4, 5.5), lamp(a, b + 4.4, 5.5),
  ];
  return [
    box(1, 47, 1, 47, 0, 0.6, STEP),
    box(1, 47, 1, 14, 0, H, hall),
    box(0.5, 47.5, 0.5, 14.5, H, H + 1, C_ROOF),
    box(6, 42, 12, 13, H + 1, H + 2, BRACKET), box(5, 43, 12.5, 14, H + 2, H + 6, sign),
    ...[3, 9, 15, 21, 27, 33, 39, 45].map((a) => lamp(a, 14, 12.5)), // the string of lamps under the eave
    ...stall(4, 20), ...stall(18, 20), ...stall(32, 20),
    ...stall(4, 33), ...stall(18, 33), ...stall(32, 33),
    ...bin(44, 16), ...bin(44, 20), ...bin(44, 24),
    crate(44, 40, 0, 2.5), crate(44, 43.5, 0, 2.5),
  ].flat();
}

// ------------------------------------------------------------- industrial

/**
 * The Dairy (I, cow): a whitewashed churn hall under a slate roof with a
 * clerestory, two tall ringed silos with domed caps beside it, the tanker at
 * the dock, a row of churns on the step, and a fenced pasture strip with a
 * tree along the front — the cleanest works in the zone.
 */
function theDairy() {
  const H = 14;
  const wall = walled(white(H), H, { storey: 14, sill: 4, winH: 4, period: 5, winW: 3, from: 1, door: doorAt(10, 7, 2.5) });
  const silo = (a, b, h) => [box(a, a + 7, b, b + 7, 0, h, litSkin(CONC.slice(1), { grain: ringGrain, height: h })), box(a - 0.5, a + 7.5, b - 0.5, b + 7.5, h, h + 1.2, litSkin(CONC, { height: 1 })), box(a + 1.5, a + 5.5, b + 1.5, b + 5.5, h + 1.2, h + 2.6, litSkin(CONC, { height: 1.4 })), box(a + 2.8, a + 4.2, b + 2.8, b + 4.2, h + 2.6, h + 3.6, litSkin(CONC, { height: 1 }))];
  const churn = (a, b) => [box(a, a + 1.6, b, b + 1.6, 0.8, 3.2, litSkin(CONC.slice(1), { height: 2.4 })), box(a + 0.2, a + 1.4, b + 0.2, b + 1.4, 3.2, 3.8, litSkin(CONC, { height: 0.6 }))];
  const tanker = [
    box(24.5, 33.5, 27.5, 32, 0, 0.5, STEP),
    box(25.5, 26.5, 31.5, 32, 0.5, 1.5, WHEEL), box(31, 32, 31.5, 32, 0.5, 1.5, WHEEL),
    box(25, 27.5, 28.5, 32, 1.5, 5, VAN), // the cab
    box(27.5, 33, 28.5, 31.5, 1.5, 5.5, litSkin(CONC.slice(1), { grain: ringGrain, height: 4 })), // the tank
  ];
  return [
    box(1, 47, 1, 47, 0, 0.5, SAWDUST), // the yard
    box(1, 29, 1, 22, 0, H, wall), // the churn hall
    ...hipRoof(1, 29, 1, 22, H, 2, 1.5),
    box(8, 22, 8, 15, H + 2, H + 5.5, { glazing: true, top: () => SLATE[2], side: (a, k) => (k >= 0.8 && k < 2.8 ? "=" : SLATE[1]), end: (b, k) => (k >= 0.8 && k < 2.8 ? END_GLASS : SLATE[0]) }), // the clerestory
    box(7.5, 22.5, 7.5, 15.5, H + 5.5, H + 6.5, SLATE_SKIN),
    chimney(2, 2, H + 10, 2.2),
    ...silo(32, 3, 34), ...silo(40, 3, 30),
    box(1, 29, 22, 25, 0, 1.6, STEP), // the dock step
    ...churn(3, 22.6), ...churn(6, 22.6), ...churn(9, 22.6), ...churn(12, 22.6), ...churn(15, 22.6),
    ...tanker,
    box(1, 47, 34, 47, 0, 0.6, PLINTH), // the pasture strip, fenced on four sides with a gate at 20 (a pen without its sawdust floor)
    ...pen(1, 47, 34, 47, 20).slice(0, 7),
  ].flat();
}

/**
 * The Truffle Works (I, pig): three beehive kilns of stepped brick, each with
 * a dark mouth, in a mud yard round an oak; a rust packing shed under a
 * lantern roof with a stack; crates of the season's find by its dock; a low
 * brick wall along the front with a gap for the carts.
 */
function truffleWorks() {
  const H = 12;
  const shed = walled(litSkin(RUST, { grain: ribGrain, height: H }), H, { storey: 12, sill: 6, winH: 3, period: 5, winW: 3, from: 1, door: doorAt(8, 7.5, 3) });
  const lantern = { glazing: true, top: () => SLATE[2], side: (a, k) => (k >= 1 && k < 3 ? "=" : SLATE[1]), end: (b, k) => (k >= 1 && k < 3 ? END_GLASS : SLATE[0]) };
  return [
    box(1, 47, 1, 47, 0, 0.5, MUD),
    box(1, 22, 1, 18, 0, H, shed),
    box(0.5, 22.5, 0.5, 18.5, H, H + 1, SLATE_SKIN),
    box(5, 18, 5, 14, H + 1, H + 4, lantern),
    box(4.5, 18.5, 4.5, 14.5, H + 4, H + 5, SLATE_SKIN),
    stack(19, 1, H + 22, 3),
    ...kiln(28, 3, 9), ...kiln(38, 6, 8), ...kiln(30, 34, 9),
    box(2, 20, 18, 21, 0, 1.6, STEP), // the dock
    crate(3, 21.5), crate(6, 21.5), crate(4.5, 21.5, 2), crate(9.5, 21.8), crate(12.5, 22),
    box(15, 27, 27, 35, 0, 0.9, WATER), // the wallow, the oak on the bank beside it (the first sheet stamped the oak in the water)
    gardenWall(1, 20, 46, 47, 2.5), gardenWall(28, 47, 46, 47, 2.5),
    gardenWall(46, 47, 20, 46, 2.5),
  ].flat();
}

/**
 * The Honey Works (I, bear): a weatherboard packing hall with a round door a
 * bear can use and a hipped roof, a tall ringed honey tank on legs beside it,
 * and a yard of nine white hives in rows on the lawn behind a low fence, a
 * tree in the corner for the blossom.
 */
function honeyWorks() {
  const H = 13;
  const win = winsOf({ storey: 13, sill: 5, winH: 3, period: 5, winW: 2, from: 2 });
  const body = litSkin(EARTH, { grain: ribGrain, height: H });
  const hall = {
    glazing: true,
    top: body.top,
    side: (a, k, x, y) => { const g = H - k; if (g < 6 && (g < 3 ? Math.abs(a - 10) < 2.8 : inRound(a, g, 10, 3, 2.8))) return "+"; return win(a, g) ? "=" : body.side(a, k, x, y); },
    end: (b, k, x, y) => (win(b, H - k) ? END_GLASS : body.end(b, k, x, y)),
  };
  const hives = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) hives.push(...hive(21 + c * 7, 22 + r * 7));
  return [
    box(1, 47, 1, 47, 0, 0.6, PLINTH),
    box(1, 24, 1, 20, 0, H, hall),
    ...hipRoof(1, 24, 1, 20, H, 3, 1.5),
    chimney(2, 2, H + 8, 2),
    ...tank(29, 4, 12, 6),
    box(1, 24, 20, 23, 0, 1.4, STEP), // the loading step
    crate(3, 23.5), crate(6, 23.5), crate(9, 23.5),
    ...hives,
    ...pen(18, 47, 18, 47, 22).slice(0, 7), // the hive yard's fence, gate at 22, no sawdust floor (it is lawn)
  ];
}

/**
 * The Sawmill (I, beaver): a saw shed open to the log pond — a roof on posts
 * with one timber back wall, the saw bench under it — logs afloat in the
 * pond, a waterwheel on its bank, a log stack on the front right, a sawdust
 * heap on the front left, and a brick engine stack behind the shed.
 */
function theSawmill() {
  const H = 12;
  const back = logSkin(H);
  const post = (a, b) => box(a, a + 1.2, b, b + 1.2, 0, H, litSkin(EARTH, { height: H }));
  // The wheel stands on edge along b, so its disc is the END face: rust with a spoke pattern (in slate it was one dark line — the first sheet).
  const wheel = { top: () => RUST[2], side: () => RUST[1], end: (b, k, x, y) => (((x + y) % 4 === 0 || (x - y) % 4 === 0) ? RUST[3] : RUST[0]) };
  return [
    box(1, 47, 1, 47, 0, 0.5, SAWDUST),
    // The shed: back wall, posts, roof; open on the yard and pond sides.
    box(1, 27, 1, 3, 0, H, back),
    post(1, 3), post(13, 3), post(25.5, 3), post(1, 16), post(13, 16), post(25.5, 16),
    box(0.5, 27.5, 0.5, 17.5, H, H + 1.2, SLATE_SKIN),
    box(3, 25, 2, 8, H + 1.2, H + 3.6, { glazing: true, top: () => SLATE[2], side: (a, k) => (k >= 0.6 && k < 2 ? "=" : SLATE[1]), end: (b, k) => (k >= 0.6 && k < 2 ? END_GLASS : SLATE[0]) }),
    box(2.5, 25.5, 1.5, 8.5, H + 3.6, H + 4.4, SLATE_SKIN),
    box(6, 22, 8, 12, 0, 3, TIMBER), // the saw bench
    box(13.5, 14.5, 7, 13, 3, 6, { top: () => "+", side: () => SLATE[1], end: () => SLATE[0] }), // the blade
    chimney(28, 1, H + 20, 3),
    // The pond, the logs afloat, the wheel on its bank.
    box(14, 40, 18, 40, 0, 0.9, WATER),
    log(16, 26, 22, 0.9), log(20, 32, 29, 0.9), log(28, 38, 35, 0.9),
    box(40, 41.5, 22, 32, 0, 9, wheel), box(38, 43.5, 26.5, 27.5, 8.5, 9.5, litSkin(EARTH, { height: 1 })),
    // The log stack, front right; the sawdust heap, front left.
    log(34, 46, 42, 0.5, 2), log(34, 46, 44.2, 0.5, 2), log(34, 46, 43.1, 2.5, 2),
    box(2, 12, 36, 46, 0, 2.2, SAWDUST), box(4, 10, 38, 44, 2.2, 3.8, SAWDUST), box(6, 8, 40, 42, 3.8, 4.6, SAWDUST),
    box(28, 34, 42, 47, 0, 1.2, STEP), // the loading apron
  ];
}

// --------------------------------------------------------------- the table

/** LANDMARK_ART[theme] = [variant 0, variant 1], keyed by the roster's ids (js/sim/landmarks.js). */
export const LANDMARK_ART = {};
const reg = (id, make, stamps = []) => {
  const lm = LANDMARKS[id];
  LANDMARK_ART[id] = family(lm.key, ZL[lm.zone], 3, make, { stamps, tags: ["landmark"] });
};
reg(1, warrenTowers, [[TREE_ROUND, 33, 33, 11]]);
reg(2, theLodge, [[TREE_TALL, 6, 6, 1], [TREE_TALL, 42, 6, 1], [TREE_WILLOW, 40, 40, 1]]);
reg(3, theRoost, [[TREE_TALL, 42, 30, 1], [TREE_TALL, 6, 26, 1], [TREE_ROUND, 40, 44, 1]]);
reg(4, theWallows, [[TREE_ROUND, 42, 42, 1]]);
reg(5, theMews, [[TREE_ROUND, 40, 30, 1]]);
reg(6, foxAndCat);
reg(7, nightMarket);
reg(8, theDairy, [[TREE_ROUND, 40, 40, 1]]);
reg(9, truffleWorks, [[TREE_TALL, 8, 34, 1]]);
reg(10, honeyWorks, [[TREE_ROUND, 8, 40, 1]]);
reg(11, theSawmill);
registerLandmarks(LANDMARK_ART);

/** Every landmark sprite, named, for the audit and the sheet. */
export function allLandmarks() {
  const out = [];
  for (const id of Object.keys(LANDMARK_ART)) for (const s of LANDMARK_ART[id]) out.push({ name: s.name, sprite: s });
  return out;
}
