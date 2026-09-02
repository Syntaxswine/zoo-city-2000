// terrain.js — the ground the city stands on, and the loose things that sit
// on it: grass, zone chalk, rubble, water (and its kerb), three trees, the
// zots, the plaza glyph, the cursor and the ghost. SPEC §12.4.
//
// GROUND TILES ARE GENERATED IN WORLD SPACE, NOT DRAWN. A 64×32 diamond is
// 1024 pixels; the honest way to author one is a predicate on (a, b) — the
// same world axes solid.js uses — evaluated once per screen pixel. That is
// what `diamond()` does. Row py of the tile has 4·py + 2 opaque pixels for
// py < 16 and mirrors above, which is the ONLY 64×32 diamond that tiles with
// its neighbours at (±32, ±16) without a doubled or a missing column. A
// ground sprite's anchor is [32, 16]: the diamond's centre, on the ground.
//
// TREES ARE HAND-AUTHORED — the organic exception (SPEC §0.5). Canopy keys
// only (a b c d e), lit from the upper-left: highlight 'e' top-left, 'a'
// the underside. Grass mid 'o' is lighter than canopy mid 'c' (palette.js),
// so a tree reads dark against the ground. A trunk is earth, never canopy.
//
// WATER cycles by rotating keys: the tile is authored with the four mid
// water keys laid out as travelling ripple bands, and `waterTint(frame)` is
// the key map that advances every band one step (WATER_FRAMES steps round).
// Rasterise with that tint and the ripples move; the palette never changes.

import { defineSprite, part, blank, stamp, toRows, T } from "./format.js";
import { keysOf } from "./palette.js";

export const TILE_ANCHOR = Object.freeze([32, 16]);

/**
 * A 64×32 diamond from a predicate fn(a, b, px, py) → key | falsy. (a, b)
 * are world units in [0, 16) — a along +tx (down-right), b along +ty
 * (down-left) — sampled at the pixel centre.
 */
export function diamond(fn) {
  const rows = [];
  for (let py = 0; py < 32; py++) {
    let r = "";
    for (let px = 0; px < 64; px++) {
      const x = px + 0.5 - 32;
      const y = py + 0.5;
      const a = (y + x / 2) / 2;
      const b = (y - x / 2) / 2;
      const inside = a >= 0 && a < 16 && b >= 0 && b < 16;
      r += inside ? fn(a, b, px, py) || T : T;
    }
    rows.push(r);
  }
  return rows;
}

/** A small deterministic hash in [0, 1) — dither, never randomness. */
export function hash(x, y, s = 0) {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const G = keysOf("grass"); // m n o p
const E = keysOf("earth"); // q r s t u
const WATER = keysOf("water"); // F G H I J K

// --------------------------------------------------------------------- grass

/**
 * Grass key at a pixel. Base 'o'; 'n' tufts, rare 'p' blades. The three
 * variants differ in dither: 0 even, 1 patchier (light clumps), 2 darker
 * (more tufts). Called by the chalk tiles too so chalk sits on real grass.
 */
export function grassKey(px, py, variant = 0) {
  const h = hash(px, py, 11 + variant);
  if (variant === 1) {
    const clump = hash(px >> 2, py >> 1, 5) < 0.3;
    if (clump && h < 0.55) return G[3];
    return h < 0.12 ? G[1] : G[2];
  }
  if (variant === 2) {
    if (h < 0.22) return G[1];
    if (h < 0.25) return G[0];
    return h > 0.96 ? G[3] : G[2];
  }
  if (h < 0.14) return G[1];
  return h > 0.95 ? G[3] : G[2];
}

export const GRASS = [0, 1, 2].map((v) =>
  defineSprite({
    name: `grass-${v}`,
    anchor: TILE_ANCHOR,
    rows: diamond((a, b, px, py) => grassKey(px, py, v)),
    tags: ["ground", "grass"],
  })
);

// --------------------------------------------------------------------- chalk

/**
 * Zone chalk: an accent-key hatch over grass, sparse enough that the grass
 * shows through (that is what "translucent" means in a palette with no
 * alpha). Low = one direction, a 1-px line every 4th unit, plus a 0.75-unit
 * border; High = the same line in BOTH directions (cross-hatch). Zone 1 R,
 * 2 C, 3 I, 4 M.
 *
 * ONE PIXEL WIDE means frac(a) < 0.25: a pixel step in x moves `a` by 0.25,
 * so a quarter-unit band is a single-pixel staircase (2 across, 1 down —
 * the same line the water kerb draws). A half-unit band is two pixels wide
 * and a whole unit is four; the first round used whole units in both
 * directions every 3rd line and the "chalk" measured 65% opaque — a
 * painted diamond, not chalk. Measured now (tools/shots.mjs prints it):
 * Low ≈ 23%, High ≈ 28% accent, the rest real grass.
 *
 * THE R CHALK DOES NOT USE ITS ACCENT. ACCENT['5'] (#B8C860 (repainted; the R line still does not use it)) has luminance
 * ≈123 against grass mid 'o' ≈125 — two points apart, same hue — and at 1×
 * an R tile could not be told from grass-0 (round 2 critics, blocking).
 * The palette is a shared module, so until '5' is re-keyed to something
 * pale (a #B8C860-class green-yellow, ≥25 luminance off 'o') the R chalk
 * is a TWO-TONE line drawn in grass keys: a quarter-unit of the lightest
 * grass 'p' (≈156) with a quarter-unit of the darkest 'm' (≈68) beside it
 * — a 1-px light / 1-px dark staircase, 88 luminance across the pair, and
 * a 0.5-unit 'p' border with an 'm' inner edge. Same geometry as C and I,
 * whose accents '6' (≈101) and '7' (≈138) stand alone.
 *
 * Zone 4 M (the meat markets) draws in its own accent 'A' (dried liver,
 * ≈79 — 42 BELOW grass mid, on the far side of the hue wheel from both '6'
 * and '7'), the C/I geometry, no shade key.
 */
const CHALK_KEY = { 1: G[3], 2: "6", 3: "7", 4: "A" };
const CHALK_SHADE = { 1: G[0], 2: null, 3: null, 4: null };
const CHALK_PERIOD = 4;
export function chalkKey(zone, high, a, b, px, py) {
  const k = CHALK_KEY[zone];
  const shade = CHALK_SHADE[zone];
  const border = a < 0.75 || b < 0.75 || a >= 15.25 || b >= 15.25;
  if (border) {
    const outer = a < 0.5 || b < 0.5 || a >= 15.5 || b >= 15.5;
    return shade && !outer ? shade : k;
  }
  const fa = a - Math.floor(a), fb = b - Math.floor(b);
  const la = Math.floor(a) % CHALK_PERIOD === 1, lb = Math.floor(b) % CHALK_PERIOD === 1;
  const lineA = la && fa < 0.25;
  const lineB = high && lb && fb < 0.25;
  if (lineA || lineB) return k;
  if (shade) {
    const shadeA = la && fa >= 0.25 && fa < 0.5;
    const shadeB = high && lb && fb >= 0.25 && fb < 0.5;
    if (shadeA || shadeB) return shade;
  }
  return grassKey(px, py, 0);
}
/** The keys a zone's chalk is drawn in, for the census in tools/shots.mjs. */
export const CHALK_KEYS = { 1: [G[3], G[0]], 2: ["6"], 3: ["7"], 4: ["A"] };
function chalkRows(zone, high) {
  return diamond((a, b, px, py) => chalkKey(zone, high, a, b, px, py));
}
export const CHALK = {};
for (const zone of [1, 2, 3, 4]) {
  CHALK[zone] = [false, true].map((high) =>
    defineSprite({
      name: `chalk-${["", "R", "C", "I", "M"][zone]}-${high ? "high" : "low"}`,
      anchor: TILE_ANCHOR,
      rows: chalkRows(zone, high),
      tags: ["ground", "chalk"],
    })
  );
}

// -------------------------------------------------------------------- rubble

/** Earth-ramp ground with slate chunks — what a bulldozed or burnt lot is. */
export const RUBBLE = defineSprite({
  name: "rubble",
  anchor: TILE_ANCHOR,
  rows: diamond((a, b, px, py) => {
    const h = hash(px, py, 23);
    const chunk = hash(px >> 1, py, 29);
    if (chunk < 0.06) return h < 0.5 ? "<" : ">";
    if (h < 0.15) return E[1];
    if (h < 0.55) return E[2];
    return h < 0.9 ? E[3] : E[4];
  }),
  tags: ["ground", "rubble"],
});

// --------------------------------------------------------------------- water

/**
 * Ripple bands, and why they are the shape they are.
 *
 * The four MID keys H I J K ride a sawtooth, two rows per key, eight rows
 * per period, crests running 4 across 1 down. Rotating those four keys one
 * step (`waterTint`) is then a translation of the whole pattern by two rows
 * — which is what makes the cycle READ as travelling water. (A triangle
 * wave turns every crest into a trough on the next frame: flicker, not
 * flow. And the first round's six-key sawtooth, one row per key, was
 * corduroy: a bright K crest and a near-black F trough every six pixels.)
 *
 * NO THINNING, NO GRIT. Round 2 thinned the K crest with a fixed hash
 * (66% of its pixels dropped to J) and salted the tile with F/G specks.
 * Two things were wrong with that. The hash lives in PIXEL space and the
 * keys rotate under it, so on the next frame the dropped pixels read as
 * K specks in an H trough — every frame but the authored one was
 * speckled, not calm. And the specks plus an 8-row sawtooth at a 1:4
 * slope (which disagrees with the 2:1 tile edges) read at 1× as ridged
 * corduroy with grit — the busiest surface on the map. Now every key
 * holds exactly two rows, so a key rotation IS a translation and every
 * frame is the same surface; F is gone; G is a ≤2% fixed speck.
 *
 * THE SLOPE IS 1:2 — PARALLEL TO THE TILE EDGES — AND SEAM-SAFE.
 * Neighbouring tiles sit at (±32, +16) px, so the band index shifts by
 * 16 ± 32/2 = 32 or 0 between them: both multiples of the 8-row period,
 * and the pattern continues across every diamond edge with no phase seam.
 * (1:4 gave 24 and 8, also seam-safe but off the tile grain; px/8 gives 20
 * and 12 — a two-row jump at every south-west edge.) A 12-row period was
 * asked for and does not exist: only periods dividing 32 (and 0) tile.
 *
 * THE WOBBLE. Straight bands at 1:2 were calm and read as a barcode. The
 * band index carries a phase φ(a, b) = round(1.5·sin(2πa/16) +
 * 1.5·sin(2πb/16)) — a function of the TILE-LOCAL world position, which is
 * exactly the class of function that is seamless: (a, b) mod 16 is the same
 * at a diamond edge and across it, and φ is continuous there. The bands
 * bend by up to ±3 rows over a tile, like a swell, and a key rotation is
 * still a translation of the whole field.
 */
export const WATER_CYCLE = WATER.slice(2); // H I J K — the keys that travel
export const WATER_FRAMES = WATER_CYCLE.length;
export const WATER_PERIOD = 8;
export const WATER_TILE = defineSprite({
  name: "water",
  anchor: TILE_ANCHOR,
  rows: diamond((a, b, px, py) => {
    const phase = Math.round(1.5 * Math.sin((2 * Math.PI * a) / 16) + 1.5 * Math.sin((2 * Math.PI * b) / 16));
    const v = py + Math.floor(px / 2) + phase;
    const band = ((v % WATER_PERIOD) + WATER_PERIOD) % WATER_PERIOD;
    const i = band >> 1; // 0..3 into H I J K, two rows each
    if (hash(px, py, 41) < 0.02) return WATER[1];
    return WATER_CYCLE[i];
  }),
  tags: ["ground", "water"],
});

/**
 * Key map that advances the water cycle by `frame` steps (mod WATER_FRAMES).
 * Only the four travelling keys move; the G specks hold still.
 */
export function waterTint(frame) {
  const map = {};
  const n = WATER_FRAMES;
  for (let i = 0; i < n; i++) map[WATER_CYCLE[i]] = WATER_CYCLE[(((i + frame) % n) + n) % n];
  return map;
}

/**
 * Water kerb: the 1-px darker line along one diamond edge where land meets
 * water (SPEC §12.4). Side 0 N (up-right edge, b = 0), 1 E (a = 16),
 * 2 S (b = 16), 3 W (a = 0). Drawn on the LAND tile, over its grass.
 */
export const KERB = [0, 1, 2, 3].map((side) =>
  defineSprite({
    name: `kerb-${"NESW"[side]}`,
    anchor: TILE_ANCHOR,
    rows: diamond((a, b) => {
      const on = side === 0 ? b < 0.5 : side === 1 ? a >= 15.5 : side === 2 ? b >= 15.5 : a < 0.5;
      return on ? WATER[0] : null;
    }),
    tags: ["ground", "kerb"],
  })
);

// --------------------------------------------------------------------- trees
//
// Authored in canopy keys a..e and earth q..u. Anchor = base of the trunk,
// which stands on the tile's ground centre.

export const TREE_ROUND = defineSprite({
  name: "tree-round",
  anchor: [9, 27],
  tags: ["tree"],
  rows: part([
    "......eddc......",
    "....eeddccb.....",
    "...eedddccbb....",
    "..eedddcccbba...",
    "..eddddcccbba...",
    ".eddddcccbbbaa..",
    ".edddccccbbbaa..",
    ".ddddcccbbbaaa..",
    ".dddccccbbbaaa..",
    "..ddcccbbbbaaa..",
    "..dcccbbbbaaa...",
    "...ccbbbbaaaa...",
    "....cbbbaaaa....",
    ".....bbaaa......",
    ".......bs.......",
    ".......ts.......",
    ".......ts.......",
    ".......ts.......",
    ".......tsr......",
    ".......tsr......",
    ".......tsr......",
    ".......tsr......",
    ".......tsr......",
    "......ttsr......",
    "......tssr......",
    ".....ttssrr.....",
    "....qttssrrq....",
    "....qqqqqqqq....",
  ]),
});

export const TREE_TALL = defineSprite({
  name: "tree-tall",
  anchor: [7, 33],
  tags: ["tree"],
  rows: part([
    ".......e......",
    "......ed......",
    "......edc.....",
    ".....eddc.....",
    ".....eddcb....",
    "....eeddcb....",
    "....edddcbb...",
    "...eedddcbb...",
    "...edddccbba..",
    "..eedddccbba..",
    "..edddcccbbaa.",
    ".eedddcccbbaa.",
    ".edddccccbbaaa",
    "...dddcccbba..",
    "...eddcccbbaa.",
    "..edddccbbbaa.",
    "..eddccccbbaaa",
    ".edddcccbbbaaa",
    "..ddccccbbbaa.",
    ".dddcccbbbbaaa",
    "ddddcccbbbbaaa",
    "..ddccccbbbaa.",
    ".dddcccbbbbaaa",
    "dddccccbbbbaaa",
    "......ts......",
    "......ts......",
    "......ts......",
    "......ts......",
    "......tsr.....",
    "......tsr.....",
    ".....ttsr.....",
    ".....ttssr....",
    "....qttssrq...",
    "....qqqqqqq...",
  ]),
});

export const TREE_WILLOW = defineSprite({
  name: "tree-willow",
  anchor: [10, 29],
  tags: ["tree"],
  rows: part([
    ".......eeddc........",
    ".....eeedddccb......",
    "....eeddddcccbb.....",
    "...eedddddccccbb....",
    "..eedddddcccccbba...",
    "..edddddccccbbbba...",
    ".eddddcccccbbbbaaa..",
    ".edddccc.ccbbbbaaa..",
    ".dddccc..cbb.bbaaa..",
    ".ddccc...cbb.bbbaa..",
    ".ddcc....cb..baaaa..",
    ".dcc.d...cb..ba.aa..",
    ".dc..d...cb..ba.aa..",
    ".dc..c...b...ba..a..",
    ".dc..c..tsb..b...a..",
    "..c..c..ts...b...a..",
    "..c..b..ts...a...a..",
    "..c..b..ts...a......",
    "..b.....ts...a......",
    "..b.....tsr..a......",
    "..b.....tsr.........",
    "........tsr.........",
    "........tsr.........",
    "........tsr.........",
    ".......ttsr.........",
    ".......ttssr........",
    "......tttssrr.......",
    ".....qttsssrrq......",
    ".....qqqqqqqqq......",
    "....................",
  ]),
});

export const TREES = { round: TREE_ROUND, tall: TREE_TALL, willow: TREE_WILLOW };
export const TREE_LIST = [TREE_ROUND, TREE_TALL, TREE_WILLOW];

// ---------------------------------------------------------------------- zots
//
// A zot is a red bubble with a white glyph, 13×14, hovering over a lot.
// Anchor = the bubble's stem, which sits on the tile's ground centre; the
// renderer lifts it by the building's height. '0' zot red, '(' the light
// concrete for the glyph, '+' the outline.

function zot(name, glyph) {
  const g = blank(13, 14);
  const bubble = part([
    ".+++++++++++.",
    "+00000000000+",
    "+00000000000+",
    "+00000000000+",
    "+00000000000+",
    "+00000000000+",
    "+00000000000+",
    "+00000000000+",
    "+00000000000+",
    "+00000000000+",
    ".+++++0+++++.",
    ".....+0+.....",
    "......+......",
    ".............",
  ]);
  stamp(g, bubble, 0, 0);
  stamp(g, part(glyph), 2, 2);
  return defineSprite({ name: `zot-${name}`, anchor: [6, 12], rows: toRows(g), tags: ["zot"] });
}

export const ZOTS = {
  // a road bar with a stroke through it
  noroad: zot("noroad", [
    "........(",
    ".......(.",
    "(((((((..",
    ".....(...",
    "((((.((((",
    "...(.....",
    "..(......",
    ".(.......",
  ]),
  // a smog cloud
  smog: zot("smog", [
    "...(((...",
    "..(((((..",
    ".((((((((",
    "(((((((((",
    ".((((((((",
    "..(((((..",
    ".........",
    ".(.(.(.(.",
  ]),
  // a briefcase, empty
  nojob: zot("nojob", [
    "...(((...",
    "...(.(...",
    "(((((((((",
    "(.......(",
    "(.......(",
    "(.......(",
    "(.......(",
    "(((((((((",
  ]),
  // a down arrow
  nodemand: zot("nodemand", [
    "...(((...",
    "...(((...",
    "...(((...",
    "...(((...",
    "(((((((((",
    ".(((((((.",
    "..(((((..",
    "...(((...",
  ]),
};
export const ZOT_KINDS = Object.keys(ZOTS);

// ---------------------------------------------------------- glyphs & cursor

/** Flagstone diamond shown on a park/plaza tile centre. */
export const PLAZA = defineSprite({
  name: "plaza",
  anchor: [10, 5],
  tags: ["glyph"],
  rows: part([
    ".........((.........",
    ".......((**((.......",
    ".....((**&&**((.....",
    "...((**&&**&&**((...",
    ".((**&&**&&**&&**((.",
    "...&&**&&**&&**&&...",
    ".....&&**&&**&&.....",
    ".......&&**&&.......",
    ".........&&.........",
  ]),
});

/** The hover cursor: a 1-unit rim of light concrete around the diamond. */
export const CURSOR = defineSprite({
  name: "cursor",
  anchor: TILE_ANCHOR,
  tags: ["glyph"],
  rows: diamond((a, b) => (a < 0.5 || b < 0.5 || a >= 15.5 || b >= 15.5 ? "(" : null)),
});

/** The placement ghost: a glass checker, so the ground shows through. */
export const GHOST = defineSprite({
  name: "ghost",
  anchor: TILE_ANCHOR,
  tags: ["glyph"],
  rows: diamond((a, b, px, py) => ((px + py) & 1 ? "=" : a < 0.5 || b < 0.5 || a >= 15.5 || b >= 15.5 ? "=" : null)),
});

/** Every terrain sprite, named, for the audit. */
export function allTerrain() {
  const out = [];
  GRASS.forEach((s) => out.push({ name: s.name, sprite: s }));
  for (const zone of [1, 2, 3, 4]) CHALK[zone].forEach((s) => out.push({ name: s.name, sprite: s }));
  out.push({ name: RUBBLE.name, sprite: RUBBLE });
  out.push({ name: WATER_TILE.name, sprite: WATER_TILE });
  KERB.forEach((s) => out.push({ name: s.name, sprite: s }));
  TREE_LIST.forEach((s) => out.push({ name: s.name, sprite: s }));
  for (const k of ZOT_KINDS) out.push({ name: ZOTS[k].name, sprite: ZOTS[k] });
  out.push({ name: PLAZA.name, sprite: PLAZA }, { name: CURSOR.name, sprite: CURSOR }, { name: GHOST.name, sprite: GHOST });
  return out;
}
