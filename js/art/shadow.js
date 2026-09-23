// shadow.js — WHAT THE SOLID PUTS ON THE GROUND. SPEC §12.
//
// Nothing in this game cast a shadow until 2026-09-22. Every face was lit
// (top brightest, end darkest — `litSkin`) and not one solid was shadowed,
// which is why a screen of correctly-projected boxes still read as cardboard
// standing on a lawn, and why the walkers looked pasted on rather than stood
// on the ground. The fix is not hand art: `RECIPES` already holds every
// solid's boxes in world units, so the shadow is arithmetic on what is there.
//
// THE SUN. Upper-left, as the whole palette assumes: `litSkin` makes the
// +tx-facing END face the darkest, so the light opposes +a. The shadow is
// therefore cast toward +a — down-right on screen, (2·K·c, K·c) px for a box
// of height c.
//
// THE GEOMETRY IS A SHEAR, AND THAT MAKES IT A RECTANGLE. A point (a, b, c)
// lands at (a + K·c, b, 0). Because the shear runs along ONE axis, and a
// box's a-range and c-range are independent intervals, the shadow of a box is
// just the ground rectangle
//
//     a ∈ [a0 + K·c0, a1 + K·c1],   b ∈ [b0, b1],   c = 0
//
// — no silhouette walk, no convex hull, no ordering. The shadow of a whole
// solid is the union of its boxes' rectangles, and the z-buffer rasteriser
// unions them for free. A chimney on a roof, a sign on a post, an overhanging
// slab: each is a box, so each throws its own displaced rectangle, correctly,
// because c0 > 0 pushes the near edge out with it.
//
// K = 0 DEGENERATES TO THE PLAN'S OWN GROUND FOOTPRINT — the contact patch.
// So one knob spans "a patch under the building" and "a tower's shadow across
// the street", the A/B is one number (the proposal's §5 Q1), and the contact
// darkening is this same mask drawn again at K = 0 rather than new art.
// Note it is the PLAN's footprint, not the tile diamond: a house whose boxes
// span a, b ∈ [1, 15] of its 16-unit tile gets a patch 14 units across, which
// is the point — a narrow building should not sit on a full tile of shade.
//
// IT IS NOT A BOX IN THE RECIPE, AND IT IS NOT IN THE REGISTRY. A cast shadow
// lies outside the footprint prism (`check.mjs` Part C) and changes the ink
// (`check-closeups.mjs`), so it could never be a box in the parent recipe. It
// is derived on demand and cached, exactly like a hi-res twin — and like a
// twin it stays OUT of `allSprites()`, because that registry is what the art
// gates conscript from: a shadow has no business being handed a 2× twin
// requirement or a species-mark audit.
//
// THE KEY IS '+', the palette's only near-black, described there as the
// "universal shadow mixer". The renderer draws the mask at alpha; the key is
// never seen at full strength.

import { RECIPES, box, render } from "./solid.js";
import { defineSprite } from "./format.js";

/** The palette's near-black. The mask is painted at alpha, never at full. */
export const SHADOW_KEY = "+";

/** Ground units of `a` per unit of height. 0 is the bare contact patch. */
export const SHADOW_K = 0.55;

/**
 * How dark, as the renderer blits it. The CAST mask goes down first at
 * `SHADOW_ALPHA`, then the CONTACT mask (the same solid at k = 0, plus the
 * walkers' ellipses) at `CONTACT_ALPHA` over it — two blits of two unions,
 * because a union is what stops two neighbouring shadows from double-
 * darkening where they overlap, and one blit can only carry one density.
 */
export const SHADOW_ALPHA = 0.28;
export const CONTACT_ALPHA = 0.18;

const FLAT = { top: () => SHADOW_KEY };
const CACHE = new WeakMap();

/**
 * The ground rectangles a recipe's boxes throw at length `k`.
 *
 * The last entry is an EXTENT — a degenerate, face-less box on the hub point,
 * the idiom `solidSprite` already uses to grow a grid without painting in it.
 * It is not decoration: a shadow's bounding box need NOT contain the solid's
 * anchor. The security camera is the case that found this — its boxes sit off
 * to one side and up a pole, so at k > 0 every rectangle lands clear of the
 * hub and the anchor fell outside the grid (`defineSprite(camera-0@shadow):
 * anchor [-20,2] is outside the 33x18 sprite`). Pinning the hub into the
 * bounds keeps one placement rule for solid and shadow alike.
 */
export function shadowBoxes(recipe, k = SHADOW_K) {
  const out = [];
  for (const b of recipe.boxes) {
    // `extent` boxes paint nothing and only grow the grid; they cast nothing either.
    if (!b.faces || (!b.faces.top && !b.faces.side && !b.faces.end)) continue;
    out.push(box(b.a0 + k * b.c0, b.a1 + k * b.c1, b.b0, b.b1, 0, 0, FLAT));
  }
  if (out.length) out.push(box(recipe.hub, recipe.hub, recipe.hub, recipe.hub, 0, 0, {}));
  return out;
}

/**
 * The shadow of a solid, or null when the sprite has no box recipe (trees,
 * citizens and glyphs are billboards and get theirs elsewhere).
 *
 * The anchor is the pixel under world (hub, hub, 0) — the same world point
 * the solid is anchored on — so the renderer places both with one rule.
 */
export function shadow(sprite, { k = SHADOW_K, scale = 1 } = {}) {
  if (!sprite) return null;
  const recipe = RECIPES.get(sprite);
  if (!recipe || !recipe.boxes) return null;
  let cache = CACHE.get(sprite);
  if (!cache) CACHE.set(sprite, (cache = new Map()));
  const id = `${k}@${scale}`;
  if (cache.has(id)) return cache.get(id);
  const boxes = shadowBoxes(recipe, k);
  let out = null;
  if (boxes.length) {
    const r = render(boxes, { hub: recipe.hub, scale });
    out = Object.freeze({
      ...defineSprite({
        name: `${sprite.name}@shadow`,
        rows: r.rows,
        anchor: r.anchor,
        footprint: sprite.footprint,
        tags: ["shadow"],
      }),
      k,
      scale,
    });
  }
  cache.set(id, out);
  return out;
}

/**
 * A BILLBOARD'S CONTACT PATCH. Citizens, trees and glyphs have no boxes —
 * they are billboards by design (`check.mjs` exempts them from the footprint
 * prism for exactly that reason) — so there is no solid to shear and nothing
 * to project. They get an ellipse under the anchor instead: 2:1 like every
 * other ground shape in the game, sized off the sprite's own width so a cub
 * gets a cub's patch without a second table.
 *
 * It is NOT composed into the citizen sprite. `check-closeups.mjs` forbids a
 * citizen twin expanding its silhouette (`old === "." ⇒ new === "."`) and
 * `check.mjs` pins `allCitizens().length` at 3236 — both of which a blob
 * stamped into the pose would break. It is a separate mask, drawn in the
 * contact pass, and the walker paints over it.
 */
const BILLBOARD_CACHE = new WeakMap();
export function billboardShadow(sprite, { scale = 1, width = 0.38 } = {}) {
  if (!sprite) return null;
  let cache = BILLBOARD_CACHE.get(sprite);
  if (!cache) BILLBOARD_CACHE.set(sprite, (cache = new Map()));
  const id = `${scale}@${width}`;
  if (cache.has(id)) return cache.get(id);
  const rx = Math.max(1, Math.round(sprite.w * width * scale));
  const ry = Math.max(1, Math.round(rx / 2));
  const w = 2 * rx + 1, h = 2 * ry + 1;
  const rows = [];
  for (let y = 0; y < h; y++) {
    let row = "";
    for (let x = 0; x < w; x++) {
      const u = (x - rx) / rx, v = (y - ry) / ry;
      row += u * u + v * v <= 1 ? SHADOW_KEY : ".";
    }
    rows.push(row);
  }
  const out = Object.freeze({
    ...defineSprite({ name: `${sprite.name}@contact`, rows, anchor: [rx, ry], footprint: sprite.footprint, tags: ["shadow"] }),
    scale,
  });
  cache.set(id, out);
  return out;
}

/** Every sprite in `list` ([{ name, sprite }]) that casts, with its mask — for the audit and the sheet. */
export function allShadows(list, opts = {}) {
  const out = [];
  for (const { name, sprite } of list) {
    const s = shadow(sprite, opts);
    if (s) out.push({ name, sprite, shadow: s });
  }
  return out;
}
