// Knowledge and culture civics (SPEC §9e; docs/PROPOSAL-KNOWLEDGE-CULTURE-2026-09-05.md
// "Art direction"): the Library and the Gallery on 2×2 tiles (32×32 world units),
// the University and the Amphitheater on 3×3 (48×48). Art only — placement, the
// fields and the save belong to js/sim. Solids on buildings.js's KIT and
// blocks.js's BLOCK_KIT, so the 2× set comes free through hires.js and every
// box is audited inside its footprint like every other building's.
//
// Select with art.civic(kind, side): "library" | "gallery" at 2, "university" |
// "amphitheater" at 3. The renderer passes the saved side; the palette asks
// for the same sprite explicitly.
import { box, flatSkin, litSkin } from "./solid.js";
import { solidSprite, registerCivicKind, KIT } from "./buildings.js";
import { BLOCK_KIT } from "./blocks.js";
import { TREE_ROUND, TREE_TALL } from "./terrain.js";

const { BRICK, CONC, CONC_WALL, SLATE, GRASS, TIMBER, SLATE_SKIN, STEP, LAMP, POST, PLINTH, END_GLASS, walled, doorAt, brickGrain } = KIT;
const { hipRoof, bench, fountain, sawtooth, gardenWall } = BLOCK_KIT;

const PAVING = flatSkin(CONC[3], CONC[2], CONC[1]);
const LAWN = flatSkin(GRASS[3], GRASS[1], GRASS[0]);
const PALE = litSkin(CONC, { height: 14 }); // the gallery's plaster: cooler than brick
const RED = flatSkin("9", "8", "7");
const GOLD = flatSkin("=", "6", "5");
const BLUE = flatSkin("H", "G", "F");
const SEAT_DARK = flatSkin(CONC[2], CONC[1], CONC[0]); // the alternate seating row: a darker stone, so the tiers read as steps
const slab = (a, b, w, d, c = 0, h = 0.6, skin = PAVING) => box(a, a + w, b, b + d, c, c + h, skin);
const wall = (h, material = BRICK, opts = {}) => walled(litSkin(material, { grain: material === BRICK ? brickGrain : undefined, height: h }), h,
  { storey: 8, sill: 3, winH: 3, period: 5, winW: 2, from: 1, ...opts });
const lamp = (a, b, c) => [box(a, a + 0.6, b, b + 0.6, 0.6, c, POST), box(a - 0.3, a + 1.2, b - 0.3, b + 1.2, c, c + 1.2, LAMP)];
const banner = (a, b, h, skin) => [box(a, a + 0.5, b, b + 0.5, 0.6, h, POST), box(a - 1.2, a + 1.7, b, b + 0.4, h - 6, h, skin)];
/** A glazed box: the skylight lantern on a roof, the glasshouse end of a wing. */
const GLASS = { top: () => END_GLASS, side: () => END_GLASS, end: () => END_GLASS };

/**
 * THE LIBRARY (2×2, 32 units): a compact two-storey brick reading hall along the
 * back of the plot with tall warm windows, a slate hip roof carrying a low glazed
 * lantern on the ridge, broad front steps down to a small paved court with a
 * bench and a book-return box, and a book-shaped sign on a post by the gate.
 */
function library() {
  const H = 17;
  const hall = wall(H, BRICK, { storey: 8, sill: 2, winH: 5, period: 5, winW: 2.2, from: 1, door: doorAt(11, 7, 2.5), endWindows: true });
  return [
    slab(0, 0, 32, 32, 0, 0.6, LAWN),
    slab(2, 15, 28, 15, 0.6, 0.15), // the court's paving
    box(2, 30, 2, 15, 0.6, H + 0.6, hall), ...hipRoof(2, 30, 2, 15, H + 0.6, 3, 1.5),
    box(12, 20, 6, 11, H + 3.6, H + 7, GLASS), // the roof lantern
    box(11.5, 20.5, 5.5, 11.5, H + 7, H + 7.8, SLATE_SKIN),
    // Broad front steps down from the door.
    slab(9, 15, 14, 2, 0.6, 1.4, STEP), slab(8, 17, 16, 2, 0.6, 0.8, STEP),
    // The book-return box, the bench, the sign on its post: a thick open book.
    box(25, 28, 18, 20, 0.6, 4, RED), box(25.5, 27.5, 18.5, 19.5, 4, 4.5, SLATE_SKIN),
    ...bench(4, 20),
    box(6, 6.6, 27, 27.6, 0.6, 9, POST), box(4, 9, 26.8, 27.2, 9, 12, RED), box(4.4, 6.4, 26.6, 27.4, 9.4, 11.6, SLATE_SKIN), box(6.6, 8.6, 26.6, 27.4, 9.4, 11.6, SLATE_SKIN),
    ...lamp(29, 28, 7),
    gardenWall(0.5, 12, 30.5, 31.5), gardenWall(20, 31.5, 30.5, 31.5), // the gate gap on the near side
  ];
}

/**
 * THE GALLERY (2×2): pale plaster, a long low hall with a sawtooth skylight roof
 * — the roof profile that tells it from the Library — a bright banner by the
 * entrance, a plinth with one large outdoor sculpture on the lawn, cool slate
 * and concrete throughout.
 */
function gallery() {
  const H = 13;
  const plaster = walled(PALE, H, { storey: 13, sill: 4, winH: 4, period: 6, winW: 3, from: 1, door: doorAt(9, 6, 3) });
  return [
    slab(0, 0, 32, 32, 0, 0.6, LAWN),
    slab(2, 18, 28, 12, 0.6, 0.15),
    box(2, 30, 2, 17, 0.6, H + 0.6, plaster), ...sawtooth(2, 30, 2, 17, H + 0.6, 5),
    // The entrance canopy and the banner.
    box(6, 14, 17, 20, H - 3, H - 2.2, SLATE_SKIN), box(6, 6.6, 19.4, 20, 0.6, H - 3, POST), box(13.4, 14, 19.4, 20, 0.6, H - 3, POST),
    ...banner(17, 19, 14, BLUE),
    // The sculpture: a plinth, a leaning slab and a ring-ish crown.
    box(21, 27, 21, 27, 0.6, 2.6, PLINTH), box(22.5, 25.5, 22.5, 25.5, 2.6, 9, RED), box(21.5, 26.5, 23.2, 24.8, 9, 11.5, GOLD),
    ...bench(3, 23),
    ...lamp(29, 29, 7),
    gardenWall(0.5, 10, 30.5, 31.5), gardenWall(16, 31.5, 30.5, 31.5),
  ];
}

/**
 * THE UNIVERSITY (3×3, 48 units): two academic wings in an L round an open
 * quadrangle, low enough that the quad reads from the camera, an arched
 * entrance in the back wing under a clock tower with a lit lantern, benches
 * and a fountain on the lawn, a glasshouse at the end of the side wing, and a
 * low wall with a wide gate on the near side — a campus with open circulation
 * and no prison perimeter.
 */
function university() {
  const H = 19;
  const backWing = wall(H, BRICK, { storey: 8, sill: 2.5, winH: 4, period: 5, winW: 2, from: 1, door: doorAt(21, 8, 3), endWindows: true });
  const sideWing = wall(H, BRICK, { storey: 8, sill: 2.5, winH: 4, period: 5, winW: 2, from: 1, door: doorAt(18, 6, 2), endWindows: true });
  const tower = walled(litSkin(BRICK, { grain: brickGrain, height: 14 }), 14, { storey: 7, sill: 2, winH: 2.5, period: 4, winW: 1.5, from: 1 });
  return [
    slab(0, 0, 48, 48, 0, 0.6, LAWN),
    slab(14, 14, 32, 32, 0.6, 0.15), // the quad's paving round its lawn
    slab(19, 19, 22, 22, 0.75, 0.3, LAWN),
    box(2, 46, 2, 14, 0.6, H + 0.6, backWing), ...hipRoof(2, 46, 2, 14, H + 0.6, 3, 1.5),
    box(2, 14, 14, 40, 0.6, H + 0.6, sideWing), ...hipRoof(2, 14, 14, 40, H + 0.6, 3, 1.5),
    box(2, 14, 40, 46, 0.6, H - 4, GLASS), box(1.5, 14.5, 39.5, 46.5, H - 4, H - 3.2, SLATE_SKIN), // the glasshouse
    // The clock tower over the arch: a storey and a half above the ridge, a clock face on the near side, a lit lantern.
    box(20, 28, 3, 11, H + 0.6, H + 14, tower),
    box(23, 25, 10.9, 11.4, H + 8, H + 12, GOLD), box(23.6, 24.4, 10.8, 11.5, H + 9, H + 11, SLATE_SKIN),
    box(19.5, 28.5, 2.5, 11.5, H + 14, H + 15, SLATE_SKIN), box(22, 26, 5, 9, H + 15, H + 18, LAMP), box(21.5, 26.5, 4.5, 9.5, H + 18, H + 19, SLATE_SKIN),
    // Chimneys, the fountain, benches, lamps.
    box(6, 8, 3, 5, H + 4, H + 8, litSkin(BRICK, { grain: brickGrain, height: 4 })), box(40, 42, 3, 5, H + 4, H + 8, litSkin(BRICK, { grain: brickGrain, height: 4 })),
    ...fountain(30, 30, 4),
    ...bench(17, 24), ...bench(36, 16), ...bench(40, 40),
    ...lamp(15, 45, 7), ...lamp(45, 45, 7), ...lamp(45, 16, 7),
    gardenWall(14, 24, 46.5, 47.5), gardenWall(34, 47.5, 46.5, 47.5), gardenWall(46.5, 47.5, 14, 46.5, 1.5),
  ];
}

/**
 * THE AMPHITHEATER (3×3): an open bowl of stepped seating on three sides rising
 * away from a low stage against the back edge, two entrance aisles cut through
 * the tiers, four banners at the corners, no roof anywhere — the bowl is the
 * shape. A pair of lamps flank the stage; a few decorative performer and
 * audience marks stand in without inventing anybody.
 */
function amphitheater() {
  const tiers = [];
  // Four tiers of seating in a U open toward the near (+b) side… the stage sits at low b, the audience faces it.
  const STAGE_B = 10;
  for (let t = 0; t < 4; t++) {
    const a0 = 6 + t * 3, a1 = 42 - t * 3, b0 = STAGE_B + 4 + t * 3.2, b1 = 46 - t * 1.5;
    const h0 = 0.6 + t * 1.6, h1 = h0 + 1.6;
    const seat = t % 2 ? SEAT_DARK : STEP; // alternate rows so the steps read as steps and not one slope
    // Two entrance aisles at a = 18..20 and 28..30 cut every tier.
    tiers.push(box(a0, 18, b0, b1, h0, h1, seat), box(20, 28, b0, b1, h0, h1, seat), box(30, a1, b0, b1, h0, h1, seat));
    tiers.push(box(a0, a0 + 3, STAGE_B - 1, b0, h0, h1, seat), box(a1 - 3, a1, STAGE_B - 1, b0, h0, h1, seat)); // the arms beside the stage
  }
  return [
    slab(0, 0, 48, 48, 0, 0.6, LAWN),
    slab(4, 4, 40, 44, 0.6, 0.15),
    // The stage: a timber platform on a plinth against a low back wall.
    box(12, 36, 3, STAGE_B + 2, 0.6, 2.2, PLINTH), box(13, 35, 4, STAGE_B + 1, 2.2, 2.8, TIMBER),
    box(12, 36, 2, 3.5, 0.6, 9, walled(litSkin(CONC, { height: 8.4 }), 8.4, { storey: 9, sill: 1, winH: 0, period: 9, winW: 0, from: 1 })),
    ...tiers,
    // Decorative performer and audience marks: two on the stage, a few on the tiers.
    box(20, 21.2, 6, 7.2, 2.8, 5.6, RED), box(26, 27.2, 6.5, 7.7, 2.8, 5.6, BLUE),
    box(10, 11, 30, 31, 5.4, 7.6, GOLD), box(34, 35, 27, 28, 3.8, 6, BLUE), box(24, 25, 36, 37, 7, 9.2, RED),
    // Banners at the corners, lamps by the stage.
    ...banner(3, 3, 14, RED), ...banner(45, 3, 14, BLUE), ...banner(3, 45, 14, GOLD), ...banner(45, 45, 14, RED),
    ...lamp(10, 4, 8), ...lamp(38, 4, 8),
  ];
}

const PLANS = { library: [library, 2], gallery: [gallery, 2], university: [university, 3], amphitheater: [amphitheater, 3] };
const TREES = {
  library: [[TREE_ROUND, 24, 24, 0.6]],
  gallery: [[TREE_TALL, 27, 4, 0.6]],
  university: [[TREE_ROUND, 38, 26, 0.75], [TREE_TALL, 20, 42, 0.6]],
  amphitheater: [],
};
export const KNOWLEDGE_CIVICS = Object.freeze(Object.fromEntries(Object.entries(PLANS).map(([kind, [make, side]]) => {
  const n = 16 * side;
  const sprite = solidSprite(`civic-${kind}-${side}x${side}`, make(), { hub: n / 2, footprint: [side, side], tags: ["civic", side === 3 ? "civic-large" : "civic-small", kind],
    stamps: TREES[kind], extent: [box(0, n, 0, n, 0, 52, {})] });
  registerCivicKind(kind, side, sprite);
  return [kind, sprite];
})));
export const allKnowledgeCivics = () => Object.values(KNOWLEDGE_CIVICS).map((sprite) => ({ name: sprite.name, sprite }));
