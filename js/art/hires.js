// Lazy close-up levels: 2x at zoom 2, 4x at zoom 3/4. Generated buildings
// gain architectural skins and citizens use the semantic detail kit.
// The original sprite, footprint, anchor point and registry stay intact.
// Trees, standalone props and glyphs retain their hand-authored base art.

import { RECIPES } from "./solid.js";
import { renderRecipe } from "./buildings.js";
import { diamond, TILE_ANCHOR } from "./terrain.js";
import { defineSprite, toRows } from "./format.js";
import { detailedRecipe } from "./architecture-detail.js";
import { detailedCitizen } from "./citizen-detail.js";

export const HI_SCALE = 2;

const CACHE = new WeakMap();

/** A detailed twin at scale 2 or 4, or null when the sprite has no detail kit. */
export function hires(sprite, scale = HI_SCALE) {
  if (!sprite) return null;
  if (scale !== 2 && scale !== 4) throw new RangeError("Detail scale must be 2 or 4");
  let cache = CACHE.get(sprite);
  if (!cache) CACHE.set(sprite, cache = new Map());
  if (cache.has(scale)) return cache.get(scale);
  const recipe = RECIPES.get(sprite);
  let hi = null;
  if (recipe && recipe.boxes) {
    const r = renderRecipe(detailedRecipe(recipe), scale);
    hi = Object.freeze({
      ...defineSprite({ name: `${sprite.name}@${scale}x`, rows: toRows(r.grid), anchor: r.anchor, footprint: sprite.footprint, tags: [...sprite.tags, "hires"] }),
      scale,
    });
  } else if (recipe && recipe.diamond) {
    hi = Object.freeze({
      ...defineSprite({ name: `${sprite.name}@${scale}x`, rows: diamond(recipe.diamond, scale), anchor: TILE_ANCHOR.map(n => n * scale), footprint: sprite.footprint, tags: [...sprite.tags, "hires"] }),
      scale,
    });
  } else if (sprite.tags.includes("citizen")) {
    const rows = detailedCitizen(sprite, scale);
    if (rows) hi = Object.freeze({ ...defineSprite({ name: `${sprite.name}@${scale}x`, rows,
      anchor: sprite.anchor.map(n => n * scale), footprint: sprite.footprint, tags: [...sprite.tags, "hires"] }), scale });
  }
  cache.set(scale, hi);
  return hi;
}

/** Every sprite in `list` ([{ name, sprite }]) that has a twin, with it — for the audit and the sheet. */
export function allHires(list, scale = HI_SCALE) {
  const out = [];
  for (const { name, sprite } of list) {
    const hi = hires(sprite, scale);
    if (hi) out.push({ name, sprite, hi });
  }
  return out;
}
