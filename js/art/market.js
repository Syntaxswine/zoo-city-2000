// market.js — THE MEAT MARKET: a placed 3×3 that grows, one sprite per stage.
// docs/PROPOSAL-MEAT-MARKET-2026-09-26.md A.2 and A.9.
//
// The family is the market's STAGES, not layouts: `art.civic("market", 3, stage)` picks sprite `stage`, and the
// renderer passes the anchor's tier (its stage). Stage 0 is the bare site — a fenced sawdust yard with a gate on
// the front (+ty, every civic's public face) — and is also the placement ghost, because it is what a click builds.
// Stages 1–4 put stalls up in MARKET_STALL_ORDER (world.js), the same tiles the sim smells from, so the picture
// and the smell cannot disagree about where the market is. Stage 5 roofs the back two rows over as a brick hall
// under slate; stage 6 adds the cold store, its stacks and tank, and a loading dock. Each stage keeps the plan of
// the one before and adds to it: one market, grown.
//
// The roof is meat's slate, not a civic's grey (roof-furniture.js keeps civics grey so a player can tell them from
// zoned buildings): the market is a private business placed like a civic, and slate is how a player reads meat.
// Every awning hangs off the FRONT face, so trap 12 applies — an awning hides twice its depth of wall below it.
import { box, flatSkin, litSkin } from "./solid.js";
import { KIT, solidSprite, registerCivicKind, registerCivicVariations } from "./buildings.js";
import { BLOCK_KIT } from "./blocks.js";
import { MARKET_STALL_ORDER } from "../sim/world.js";
import { KNOBS } from "../sim/rules.js";

const { BRICK, CONC, SLATE, RUST, M_ROOF, AWNING_M, HOOK, SLATE_SKIN, walled, doorAt, brickGrain } = KIT;
const { pen, stack, tank } = BLOCK_KIT;
const T = 16; // one tile in world units (A_STEP)
const STONE = flatSkin(CONC[3], CONC[2], CONC[1]);

/** The bare site: a sawdust yard inside the zoo's slat fence, the gate on the front, a sign on a post beside it. */
function site() {
  return [
    ...pen(1, 47, 1, 47, 22),
    box(19, 20, 45.5, 46.5, 0, 7, litSkin(RUST, { height: 7 })),     // the sign post
    box(16, 20, 46, 46.5, 5, 7.5, flatSkin(SLATE[2], SLATE[1], SLATE[0])), // the sign, blank: the cut, not the word
  ];
}

/** One stall on the tile (dx, dy): a brick counter under a slate cap, a striped awning and three hooks off its front. */
function stall(dx, dy) {
  const a0 = dx * T, b0 = dy * T, H = 6;
  const body = litSkin(BRICK, { grain: brickGrain, height: H });
  const out = [
    box(a0 + 4, a0 + 12, b0 + 4, b0 + 11, 0.6, H, body),
    box(a0 + 3.5, a0 + 12.5, b0 + 3.5, b0 + 11.5, H, H + 1, M_ROOF),
    box(a0 + 4.5, a0 + 11.5, b0 + 11, b0 + 12.5, 4.5, 6, AWNING_M),
  ];
  for (const a of [5.5, 7.5, 9.5]) out.push(box(a0 + a - 0.25, a0 + a + 0.25, b0 + 12, b0 + 12.5, 2.5, 4.5, HOOK));
  return out;
}

/** The hall over the back two rows: brick to storey 8 under a slate band, three slate steps for a roof, a door on the front. */
function hall(h = 14) {
  const a0 = 3, a1 = 45, b0 = 3, b1 = 29;
  const skin = walled(litSkin(BRICK, { grain: brickGrain, height: h }), h, { storey: 8, sill: 3, winH: 2, period: 6, winW: 2, from: 2, door: doorAt(24, 6, 2) });
  const out = [box(a0, a1, b0, b1, 0.6, h, skin)];
  for (let k = 0; k < 3; k++) out.push(box(a0 - 0.5 + k, a1 + 0.5 - k, b0 - 0.5 + k, b1 + 0.5 - k, h + k, h + k + 1, SLATE_SKIN));
  return out;
}

/** The exchange's additions: a windowless cold store at the back corner, its stacks and tank, and a loading dock. */
function exchange() {
  const cold = litSkin(CONC, { height: 22 }); // windowless: a cold store shows the street nothing
  return [
    box(31, 45, 3, 17, 0.6, 22, cold),
    box(30.5, 45.5, 2.5, 17.5, 22, 23, M_ROOF),
    stack(33, 5, 30, 2.5),
    stack(37, 5, 27, 2.5),
    ...tank(39, 9, 23, 4),
    box(31, 45, 29, 33, 0.6, 3, STONE), // the loading dock, where the carts come in
  ];
}

/** The boxes that stand at `stage` — each stage keeps the one before and adds to it. */
function stageBoxes(stage) {
  const boxes = site();
  const stalls = KNOBS.MARKET_STALLS[stage] || 0;
  // From the hall up the back two rows are under its roof, so only the front row stands as stalls.
  const open = stage >= 5 ? MARKET_STALL_ORDER.filter(([, dy]) => dy === 2) : MARKET_STALL_ORDER.slice(0, stalls);
  for (const [dx, dy] of open) boxes.push(...stall(dx, dy));
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
