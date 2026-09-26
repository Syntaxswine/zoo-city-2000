// market.js — THE MEAT MARKET: a placed 3×3 that grows, one sprite per stage.
// docs/PROPOSAL-MEAT-MARKET-2026-09-26.md A.2 and A.9.
//
// The family is the market's STAGES, not layouts: `art.civic("market", 3, stage)` picks sprite `stage`, and the
// renderer passes the anchor's tier (its stage). Every stage is the one before it with something added — one market,
// grown — and the plan under all of them is the same: a paved yard inside a low brick wall, the gate in the middle
// of the front (+ty, every civic's public face) between two piers under the sign, and nine sawdust pitches.
//
//   0  the site — the yard, the wall, the gate and the nine empty pitches. Also the placement ghost: what a
//      click builds, and the plan of everything that will stand on it.
//   1  one stall, facing the gate          2  three: the front row        3  six, and a hand cart
//   4  all nine — the full square, a second cart and the crates by the gate (Light's top; Heavy opens here)
//   5  the hall: brick under slate over the back two rows, a glazed lantern along its ridge, the front row kept
//   6  the exchange: a windowless cold store rising out of the hall's back corner with its chimney, and the
//      front-right pitch turned into the loading yard — the dock, the van, and the pens where the stock waits
//
// The stalls stand in MARKET_STALL_ORDER (world.js), the tiles the sim smells from, so the picture and the smell
// cannot disagree about where the market is.
//
// A STALL IS READ FROM ABOVE. At zoom 1 the game shows a market mostly as roof, so a stall is its canopy: red and
// white panels running front to back (keyed on world units, so a panel is the same panel at 2×), a valance, and a
// row of empty hooks under the front edge — the butcher's rail; the meat is implied, never drawn. The canopy stands
// proud of the block by 1.5 units and hides 3 under it (standing brief, trap 12); the hooks hang ON the edge, never
// behind it, which is the one place nothing hides them.
//
// The roofs are meat's slate, not a civic's grey (roof-furniture.js keeps civics grey so a player can tell them from
// zoned buildings): the market is a private business placed like a civic, and slate is how a player reads meat.
import { box, flatSkin, litSkin } from "./solid.js";
import { KIT, solidSprite, registerCivicKind, registerCivicVariations } from "./buildings.js";
import { BLOCK_KIT } from "./blocks.js";
import { MARKET_STALL_ORDER } from "../sim/world.js";
import { KNOBS } from "../sim/rules.js";

const { BRICK, CONC, SLATE, M_ROOF, HOOK, SLATE_SKIN, TIMBER, SAWDUST, CONC_WALL, END_GLASS, STEP, POST, walled, doorAt, brickGrain, ribGrain } = KIT;
const { hipRoof, chimney, pen, van } = BLOCK_KIT;
const T = 16; // one tile in world units (A_STEP)

// ---- the materials -------------------------------------------------------------------------------------------------

/** The yard's flags: light concrete, a joint every four units in the rung below. */
const FLAGS = {
  top: (a, b) => (a % 4 < 0.4 || b % 4 < 0.4 ? CONC[2] : CONC[3]),
  side: () => CONC[2],
  end: () => CONC[1],
};
/** The canopy: five panels across, red and white, running front to back; the valances carry them down. */
const panel = (u, width) => Math.min(4, Math.floor((u / width) * 5)) & 1;
const canopy = (width, depth) => ({
  top: (a) => (panel(a, width) ? CONC[4] : BRICK[2]),
  side: (a) => (panel(a, width) ? CONC[3] : BRICK[1]),
  end: (b) => (panel(b, depth) ? CONC[2] : BRICK[0]),
});
/** The stone caps on the gate piers. */
const COPING = flatSkin(CONC[3], CONC[2], CONC[1]);
const WHEEL = flatSkin("+", "+", "+");
/** The sign: a slate board carrying one '$' dot and no lettering — the cut, not the word. */
const sign = (width) => ({
  top: () => SLATE[2],
  side: (a, k) => (Math.abs(a - width / 2) < 0.5 && k >= 1 && k < 2 ? BRICK[3] : SLATE[1]),
  end: () => SLATE[0],
});

// ---- the plan: yard, wall, gate, pitches -------------------------------------------------------------------------

const GATE = [21, 27]; // the gap in the front wall, a units — the middle of the front tile
const WALL_H = 2.5;

function site() {
  const wall = litSkin(BRICK, { grain: brickGrain, height: WALL_H });
  const pier = litSkin(BRICK, { grain: brickGrain, height: 4.5 });
  const out = [
    box(1, 47, 1, 47, 0, 0.5, FLAGS),
    box(0.5, 47.5, 0.5, 1.5, 0, WALL_H, wall), // back
    box(0.5, 1.5, 1.5, 47.5, 0, WALL_H, wall), // left
    box(46.5, 47.5, 1.5, 46.5, 0, WALL_H, wall), // right
    box(1.5, GATE[0] - 2, 46.5, 47.5, 0, WALL_H, wall), // the front, either side of the gate
    box(GATE[1] + 2, 47.5, 46.5, 47.5, 0, WALL_H, wall),
    // The gate: two piers no taller than a stall's block, so the first stall — the one facing the gate — shows its
    // meat over them (an arch over the gate hid it: every front gate stands in front of a front-row stall).
    box(GATE[0] - 2, GATE[0], 46, 48, 0, 4.5, pier),
    box(GATE[1], GATE[1] + 2, 46, 48, 0, 4.5, pier),
    box(GATE[0] - 2.25, GATE[0] + 0.25, 45.75, 48, 4.5, 5.1, COPING),
    box(GATE[1] - 0.25, GATE[1] + 2.25, 45.75, 48, 4.5, 5.1, COPING),
    // The sign stands on its post beside the gate, in the aisle between the first two pitches.
    box(15.75, 16.25, 45.75, 46.25, 0, 8, POST),
    box(14.5, 17.5, 45.6, 46.1, 8, 11, sign(3)),
  ];
  // The nine pitches, sawdust on the flags under where each canopy will stand, spilling a unit forward where the
  // butcher works: the plan of the whole market, laid out before a stall stands.
  for (const [dx, dy] of MARKET_STALL_ORDER) out.push(box(dx * T + 2, dx * T + 14, dy * T + 2, dy * T + 13.5, 0.5, 0.7, SAWDUST));
  return out;
}

/** One stall on the tile (dx, dy): a brick booth at the back, the block at the front, and the canopy over both. */
function stall(dx, dy) {
  const a0 = dx * T, b0 = dy * T;
  const out = [
    box(a0 + 3, a0 + 13, b0 + 3, b0 + 7, 0.7, 6.5, litSkin(BRICK, { grain: brickGrain, height: 5.8 })), // the booth
    box(a0 + 3, a0 + 13, b0 + 9.5, b0 + 11, 0.7, 3.5, TIMBER), // the block
    box(a0 + 2.5, a0 + 3, b0 + 11.5, b0 + 12, 0.7, 8, POST),
    box(a0 + 13, a0 + 13.5, b0 + 11.5, b0 + 12, 0.7, 8, POST),
    box(a0 + 2, a0 + 14, b0 + 2, b0 + 12.5, 8, 9.5, canopy(12, 10.5)),
  ];
  // The rail: empty hooks under the front edge. The meat is implied, never drawn — "what breaks the field guide:
  // carcasses, drips, text, saturated red" (docs/PROPOSAL-CRIME-AND-PUNISHMENT.md, Art). A first round hung sides of
  // meat here; they came off.
  for (const a of [4.25, 6.75, 9.25, 11.75]) out.push(box(a0 + a - 0.25, a0 + a + 0.25, b0 + 12, b0 + 12.5, 6, 8, HOOK));
  return out;
}

/** A butcher's barrow: a timber bed on one wheel, its handles to −a, a sack of sawdust across it. */
function cart(a, b) {
  return [
    box(a, a + 5, b, b + 3, 1.2, 2.4, TIMBER),
    box(a + 1.5, a + 3, b + 3, b + 3.4, 0.2, 1.8, WHEEL),
    box(a - 2, a, b + 0.4, b + 0.8, 1.8, 2.2, TIMBER),
    box(a - 2, a, b + 2.2, b + 2.6, 1.8, 2.2, TIMBER),
    box(a + 0.8, a + 4.2, b + 0.6, b + 2.4, 2.4, 3.4, SAWDUST),
  ];
}

/** Crates in the aisle by the gate: two stacked, one behind. */
const crates = (a, b) => [box(a, a + 2.5, b, b + 2.5, 0.5, 3, TIMBER), box(a + 0.25, a + 2.25, b + 0.25, b + 2.25, 3, 5, TIMBER), box(a, a + 2.5, b - 3, b - 0.5, 0.5, 3, TIMBER)];

/** The hall over the back two rows: brick with tall windows, a hipped slate roof, a glazed lantern along the ridge. */
function hall() {
  const h = 12, a0 = 2, a1 = 46, b0 = 2, b1 = 30;
  const skin = walled(litSkin(BRICK, { grain: brickGrain, height: h }), h, { storey: 12, sill: 4, winH: 5, period: 5.5, winW: 2, from: 2, door: doorAt(22, 7, 3) });
  const lantern = { glazing: true, top: () => SLATE[2], side: (a, k) => (k >= 0.8 && k < 3 ? "=" : SLATE[1]), end: (b, k) => (k >= 0.8 && k < 3 ? END_GLASS : SLATE[0]) };
  return [
    box(a0, a1, b0, b1, 0.6, h, skin),
    ...hipRoof(a0, a1, b0, b1, h, 2, 1.5, SLATE_SKIN),
    box(9, 39, 11, 21, h + 3, h + 6.5, lantern),
    box(8.5, 39.5, 10.5, 21.5, h + 6.5, h + 7.5, SLATE_SKIN),
    box(19.5, 28.5, 30, 30.5, 8, 10.5, sign(9)), // the sign over the hall's door
  ];
}

/**
 * The exchange's additions: the cold store — windowless, concrete, a row of vents under its eaves and a ribbed
 * condenser on its roof — rising out of the hall's back corner with a chimney beside it; and the loading yard on
 * the front-right pitch, where that pitch's stall stood: a dock against the hall, the van, and two pens.
 */
function exchange() {
  const H = 28;
  const base = litSkin(CONC_WALL, { height: H });
  const cold = {
    top: base.top,
    side: (a, k, x, y) => (k >= 2.5 && k < 3.25 && a % 3 < 2 ? "+" : base.side(a, k, x, y)), // louvres: slits, not windows
    end: (b, k, x, y) => (k >= 2.5 && k < 3.25 && b % 3 < 2 ? "+" : base.end(b, k, x, y)),
  };
  return [
    // Its end face stands a quarter-unit proud of the hall's eave (a 46.5): two faces in one plane go to whichever
    // box was drawn first, and the hall's brick had taken the cold store's wall below the roof — a store on the roof.
    box(31, 46.75, 2, 15, 0.6, H, cold),
    box(30.5, 47.25, 1.5, 15.5, H, H + 1, M_ROOF),
    box(34, 42, 5, 10, H + 1, H + 3.5, litSkin(CONC_WALL, { grain: ribGrain, height: 2.5 })), // the condenser
    chimney(43, 3, H + 16, 2),
    box(33, 46, 30, 32.5, 0.5, 2, STEP), // the dock
    ...van(37, 33.5),
    ...pen(33, 39.5, 39.5, 46, null),
    ...pen(39.5, 46, 39.5, 46, null),
  ];
}

// ---- the stages ----------------------------------------------------------------------------------------------------

/** The boxes that stand at `stage` — each stage keeps the one before and adds to it. */
function stageBoxes(stage) {
  const boxes = site();
  const stalls = KNOBS.MARKET_STALLS[stage] || 0;
  // From the hall up the back two rows are under its roof, so only the front row stands as stalls — and the
  // exchange's loading yard takes the front-right pitch.
  let open = MARKET_STALL_ORDER.slice(0, stalls);
  if (stage >= 5) open = MARKET_STALL_ORDER.filter(([dx, dy]) => dy === 2 && !(stage >= 6 && dx === 2));
  for (const [dx, dy] of open) boxes.push(...stall(dx, dy));
  if (stage === 3 || stage === 4) boxes.push(...cart(30, 29.5)); // in the aisle before the front row
  if (stage === 4) boxes.push(...cart(14, 13.5), ...crates(14.75, 41.5));
  if (stage >= 5) boxes.push(...cart(5, 31)); // the hall takes the aisle: the barrow waits by its wall
  if (stage >= 5) boxes.push(...hall());
  if (stage >= 6) boxes.push(...exchange());
  return boxes;
}

const STAGES = KNOBS.MARKET_JOBS.map((_, stage) => solidSprite(`market-${stage}`, stageBoxes(stage), { hub: 24, footprint: [3, 3], tags: ["civic", "market"] }));

/** The market's family, in stage order: the renderer passes the stage as the variant (render.js). */
export const MARKET_FAMILY = { kind: "market", side: 3, staged: true, sprites: STAGES };
registerCivicKind("market", 3, STAGES[0]);
registerCivicVariations(STAGES[0], STAGES.slice(1));
export const allMarket = () => STAGES.map((sprite) => ({ name: sprite.name, sprite }));
