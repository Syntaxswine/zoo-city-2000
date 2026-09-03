// hires.js — THE HI-RES SET. SPEC §12.6.
//
// The owner (2026-09-03): "i'd also like a more high res sprite set for
// when the camera is zoomed in." Nothing here is drawn twice. Every built
// thing in the city is boxes and every ground tile is a predicate on world
// units (solid.js, terrain.js), and both keep the RECIPE they were made
// from (solid.RECIPES); this module samples the same recipe at HI_SCALE
// pixels per 1× pixel — a 128 × 64 tile — and hands back a sprite twice
// the size with its anchor on the same world point. A face edge lands where
// the 1× edge landed; a door, a window, a storey are the same door at twice
// the resolution; brick grain, the meat stripe and the grass dither, keyed
// on screen pixels, get finer — which is what a zoomed-in camera is for.
//
// What has no recipe stays hand-drawn and is scaled by the renderer as it
// always was: the animals, the trees, the zots, the fire, the sacks, the
// tents. The organic exception (SPEC §0.5) is an exception here too.
//
// Rendered lazily and cached per sprite: the first zoom-2 frame pays for
// what it sees, and the registry is never touched.

import { RECIPES } from "./solid.js";
import { renderRecipe } from "./buildings.js";
import { diamond, TILE_ANCHOR } from "./terrain.js";
import { defineSprite, toRows } from "./format.js";

export const HI_SCALE = 2;

const CACHE = new WeakMap();

/** The 2× twin of a sprite — { rows, anchor, w, h, footprint, tags, scale } — or null for a hand-drawn one. */
export function hires(sprite) {
  if (!sprite) return null;
  if (CACHE.has(sprite)) return CACHE.get(sprite);
  const recipe = RECIPES.get(sprite);
  let hi = null;
  if (recipe && recipe.boxes) {
    const r = renderRecipe(recipe, HI_SCALE);
    hi = Object.freeze({
      ...defineSprite({ name: `${sprite.name}@${HI_SCALE}x`, rows: toRows(r.grid), anchor: r.anchor, footprint: sprite.footprint, tags: [...sprite.tags, "hires"] }),
      scale: HI_SCALE,
    });
  } else if (recipe && recipe.diamond) {
    hi = Object.freeze({
      ...defineSprite({ name: `${sprite.name}@${HI_SCALE}x`, rows: diamond(recipe.diamond, HI_SCALE), anchor: [TILE_ANCHOR[0] * HI_SCALE, TILE_ANCHOR[1] * HI_SCALE], footprint: sprite.footprint, tags: [...sprite.tags, "hires"] }),
      scale: HI_SCALE,
    });
  }
  CACHE.set(sprite, hi);
  return hi;
}

/** Every sprite in `list` ([{ name, sprite }]) that has a twin, with it — for the audit and the sheet. */
export function allHires(list) {
  const out = [];
  for (const { name, sprite } of list) {
    const hi = hires(sprite);
    if (hi) out.push({ name, sprite, hi });
  }
  return out;
}
