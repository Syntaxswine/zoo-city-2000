// mansion.js — THE MANSION. SPEC §9f, §12.2g; docs/PROPOSAL-WEALTH-AND-CLASS-2026-09-05.md.
//
// The owner (2026-09-05): "the ultrawealthy want to have a 3x3 plot next to
// everything, they will need their own sprites too for their mansions", and
// later, on the art: "i like the art you picked, at some point a species
// specific variation is welcome." One family on the 3×3 plan (a, b ∈ [0, 48])
// through the one rasteriser, built from buildings.js's KIT and blocks.js's
// BLOCK_KIT — so the footprint gate (check.mjs Part C) and the ray audit
// (tools/depthaudit.mjs) hold, and the 2× twins come free through hires.js;
// variant 1 is variant 0 mirrored across a = b (`family`), the stamps with it.
//
// Pale stone where every other home in town is brick: a two-storey house
// across the back of the plot under a stepped slate roof, a portico of four
// columns over the door, two lower wings coming forward round a paved
// carriage sweep with a fountain, a glasshouse at the end of one wing, two
// chimneys, the garden wall with its gate gap and two lit gate lamps, a lawn,
// a bench and two trees. Its species mark sits on the house's wall socket
// through characterSprite as every home's does, so the Greybacks' mansion
// carries the wolf's mark and the Slyfields' the fox's; its windows light with
// the household like every other building's. A mansion is never placed — it
// rises where an address has become affluent (sim/wealth.js) — so there is no
// plot sprite: the ground it rises on is ordinary housing until the month it
// does. The species-skinned set the owner welcomes is a later art arc on the
// landmark pattern.
//
// LIGHT upper-left; END glass on every +tx face; doors on side faces; boxes
// listed bottom-up. Face coordinates in the skins are LOCAL to the box.

import { box, litSkin, flatSkin } from "./solid.js";
import { KIT } from "./buildings.js";
import { BLOCK_KIT } from "./blocks.js";
import { TREE_ROUND, TREE_TALL } from "./terrain.js";

const { walled, doorAt, CONC, GRASS, SLATE_SKIN, STEP, LAMP, POST, END_GLASS } = KIT;
const { hipRoof, chimney, gardenWall, fountain, bench, family } = BLOCK_KIT;

const LAWN = flatSkin(GRASS[3], GRASS[1], GRASS[0]);
const PAVING = flatSkin(CONC[3], CONC[2], CONC[1]);
/** A glazed box: the glasshouse. */
const GLASS = { top: () => END_GLASS, side: () => END_GLASS, end: () => END_GLASS };
const slab = (a, b, w, d, c = 0, h = 0.6, skin = PAVING) => box(a, a + w, b, b + d, c, c + h, skin);
/** Pale stone with tall windows — the mansion's own skin; every other home in town is brick. */
const stone = (H, opts = {}) => walled(litSkin(CONC, { height: H }), H, { storey: 8, sill: 2.5, winH: 4, period: 4, winW: 2, from: 1, endWindows: true, ...opts });
/** A gate lamp: a post with a lit cap. */
const gateLamp = (a, b) => [box(a, a + 1, b, b + 1, 0.6, 6, POST), box(a - 0.3, a + 1.3, b - 0.3, b + 1.3, 6, 7.2, LAMP)];
/** A portico column. */
const column = (a, b, h) => box(a, a + 1.2, b, b + 1.2, 0.6, h, litSkin(CONC, { height: h }));

/**
 * The mansion (R 3×3, one household of MANSION_CAP): the house a 10..38 × b
 * 3..17 two storeys high, the portico on its near face over the door, wings a
 * 4..14 and 34..44 from b 13 to 33, the glasshouse off the end of the right
 * wing, the sweep between them with the fountain, and the wall round the plot
 * with its gate gap on the near side and a lit lamp either side of it.
 */
function mansion() {
  const H = 18, HW = 12;
  return [
    slab(0, 0, 48, 48, 0, 0.6, LAWN),
    slab(14, 17, 20, 26, 0.6, 0.15), // the carriage sweep
    // The house, its roof, its chimneys.
    box(10, 38, 3, 17, 0.6, H + 0.6, stone(H, { door: doorAt(14, 8, 2.2) })), ...hipRoof(10, 38, 3, 17, H + 0.6, 3, 1.5),
    chimney(13, 4, H + 8, 2), chimney(33, 4, H + 8, 2),
    // The portico: four columns, a slab, a low pediment step; the steps down to the sweep.
    column(19, 17.4, 9.6), column(22.4, 17.4, 9.6), column(26.4, 17.4, 9.6), column(29.8, 17.4, 9.6),
    box(18, 31.5, 16.8, 19.4, 9.6, 10.8, SLATE_SKIN), box(19, 30.5, 17, 19.2, 10.8, 11.8, SLATE_SKIN),
    slab(21, 19.4, 6, 1.6, 0.6, 1.2, STEP), slab(20, 21, 8, 1.4, 0.6, 0.6, STEP),
    // The wings, a storey and a half, under their own roofs.
    box(4, 14, 13, 33, 0.6, HW + 0.6, stone(HW, { door: doorAt(12, 7, 1.6) })), ...hipRoof(4, 14, 13, 33, HW + 0.6, 2, 1.5),
    box(34, 44, 13, 33, 0.6, HW + 0.6, stone(HW, { door: doorAt(12, 7, 1.6) })), ...hipRoof(34, 44, 13, 33, HW + 0.6, 2, 1.5),
    // The glasshouse off the right wing.
    box(34, 44, 33, 41, 0.6, 7.6, GLASS), box(33.5, 44.5, 32.5, 41.5, 7.6, 8.4, SLATE_SKIN),
    // The fountain on the sweep, a bench on the lawn.
    ...fountain(24, 31, 4),
    ...bench(6, 38),
    // The wall round the plot with the gate gap on the near (+b) side, and the two lit gate lamps.
    gardenWall(0.5, 19, 46.5, 47.5), gardenWall(29, 47.5, 46.5, 47.5), // the near wall, the gate gap at a = 19..29
    gardenWall(46.5, 47.5, 0.5, 46.5, 1.5), // the +a side, lower
    gardenWall(0.5, 1.5, 0.5, 46.5, 1.5), gardenWall(0.5, 47.5, 0.5, 1.5, 1.5), // the far sides, low and mostly behind the house
    ...gateLamp(17.5, 45.5), ...gateLamp(29.5, 45.5),
  ];
}

/** MANSION[variant] — an R 3×3 family (SPEC §12.2b's `family`), registered with the audit through allMansion. */
export const MANSION = family("mansion", "R", 3, mansion, { stamps: [[TREE_ROUND, 8, 43, 0.6], [TREE_TALL, 4, 7, 0.6]], tags: ["mansion"] });

/** Both mansion sprites, named, for the audit and the sheet. */
export function allMansion() {
  return MANSION.map((sprite) => ({ name: sprite.name, sprite }));
}
