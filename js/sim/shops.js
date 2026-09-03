// shops.js — THE SHOPS: a tier-1 commercial lot is one of eleven small
// businesses, not "a shop". SPEC §12.2d.
//
// The owner (2026-09-03): "lets make some more specialized buildings,
// unique low density shops would be a good target." A Low-density C lot
// stays at tier 1 for good (the density brush caps it), and until now every
// one of them drew the same corner shop. Now the KIND of shop is a function
// of the tile's `variant` byte — the per-tile random the world was founded
// with, already saved, already in the hash — so a street of low shops is a
// bakery, a bookshop, a barber, a florist, a pub …, the same ones every
// time the town is loaded, and NOTHING in the sim changes: no new state,
// no RNG, every town hashes as it did. (SimCity 2000's low commercial did
// the same: one lot, many small businesses, the pick by position.)
//
// `variant & 1` was always the mirror; `variant >> 1` (0..127) chooses the
// kind, so both variants of every kind occur. Kind 0 is the corner shop
// the tier drew before — a town loaded from an old save keeps roughly one
// in eleven of its shops unchanged and the rest become what they were
// always going to be.
//
// WHO KEEPS IT is not state either: `keeperOf` reads `world.majority`
// (census.js, derived every tick — the staff's plurality species) and
// names the shop after that species' family — "the Slyfields' bookshop".
// It can change as the staff change, as a shop's name does when it is sold.

import { ZONE } from "./world.js";
import { SPECIES, SPECIES_BY_ID } from "./species.js";

/** The pool, in `variant >> 1` order. `key` names the art (js/art/shops.js `SHOP_ART[kind]`). */
export const SHOPS = Object.freeze([
  { kind: 0, key: "corner-shop", name: "corner shop", blurb: "the plain concrete shop with the blue awning" },
  { kind: 1, key: "bakery", name: "bakery", blurb: "brick, a round window, the oven's stack behind, a rack of loaves out front" },
  { kind: 2, key: "greengrocer", name: "greengrocer", blurb: "a green awning over crates of produce on the step" },
  { kind: 3, key: "fishmonger", name: "fishmonger", blurb: "a tiled dado, a slab of ice under the awning, a barrel" },
  { kind: 4, key: "bookshop", name: "bookshop", blurb: "tall and narrow, a timber shopfront with a bay window, a lamp by the door" },
  { kind: 5, key: "barber", name: "barber", blurb: "a glass front and the striped pole" },
  { kind: 6, key: "florist", name: "florist", blurb: "a glass conservatory on the front, flower boxes under the windows" },
  { kind: 7, key: "tea-room", name: "tea room", blurb: "a bay window, a porch, two tables with parasols outside" },
  { kind: 8, key: "pub", name: "pub", blurb: "two storeys, timber-framed above, a hanging sign, lamps and barrels" },
  { kind: 9, key: "ironmonger", name: "ironmonger", blurb: "rust-ribbed, a ladder against the wall, buckets and a sign" },
  { kind: 10, key: "clockmaker", name: "clockmaker", blurb: "a clock tower on the roof with a face to the street" },
]);

/** The kind of shop a tile's variant byte chooses (0..SHOPS.length−1). */
export const shopKind = (variant) => ((variant >> 1) % SHOPS.length);
export const shopOfVariant = (variant) => SHOPS[shopKind(variant)];

/** Is lot i a shop of the pool — a tier-1 C lot? */
export const isLowShop = (world, i) => world.zone[i] === ZONE.C && world.tier[i] === 1;

const family = (id) => { const n = SPECIES_BY_ID[id].surname; return `the ${n.endsWith("s") ? n : `${n}s`}'`; };

/**
 * The shop on lot i for the card: { kind, key, name, blurb, keeper, title }
 * — `keeper` the staff's plurality species (or null while nobody works
 * there), `title` "the Slyfields' bookshop" or "a bookshop, nobody's yet".
 */
export function shopOf(world, i) {
  if (!isLowShop(world, i)) return null;
  const s = shopOfVariant(world.variant[i]);
  const m = world.majority ? world.majority[i] : 0;
  const keeper = m > 0 && m <= SPECIES.length ? SPECIES[m - 1].id : null;
  const title = keeper ? `${family(keeper)} ${s.name}` : `a ${s.name}, nobody's yet`;
  return { ...s, keeper, title };
}
