// painter.js — THE ONE DRAW ORDER. Pure and DOM-free. SPEC §13, §0.4.
//
// The browser renderer and the headless proof (`tools/shots.mjs --scene`)
// both sort through this file, so the depth-sort proof made here is the
// depth-sort the player sees. There is no second implementation.
//
// THE KEY.  key = (tx + ty) · 1024 + z
//
//   z = 0     ground (grass, chalk, road, water, rubble, flood)
//   z = 512 + floor(64 · frac(tx + ty))   walkers, at their FRACTIONAL tile
//   z = 768   buildings, trees, civics — anything standing on its tile
//
// tx + ty is left FRACTIONAL in the key for movers. The floor-the-cell
// variant (cell · 1024 + 512 + 64·frac) is wrong for a walker on the road
// in FRONT of a building whose cell it is about to leave: at (bx − 0.01,
// by + 1) it is in front of the building's side face (its b exceeds the
// face's b1) but the floored key files it in the building's own cell, under
// 768, and the building paints over its head. With the fractional sum the
// walker's key passes the building's the moment it is 0.25 tiles short of
// the cell — and at that distance the two silhouettes do not yet touch, so
// every real overlap sorts right. The 64·frac term is then a tie-breaker
// among walkers and a guard against float noise; it is kept because SPEC
// §13 names it and because it costs nothing.
//
// FOOTPRINTS. A 2×2 (the zoo) is keyed by its FRONT-most tile — `depthOf`
// in iso.js — and its anchor lands on the ground centre of the whole
// footprint, which for hub = A_STEP is where `solid.render` put it. An
// OBLONG's key is then pulled back by OBLONG_PULLBACK (0.7): the "0.25
// tiles short, silhouettes do not touch" argument above holds for a 1×1
// plan and fails for a 2×2 — the zoo at (0,4) is keyed by (1,5) → 6, but
// its east fence runs beside (1,4) too, and a walker on the road at
// (2, 4.0…4.2) had a key of 6.0…6.2 + 512: filed BEFORE the zoo's 6·1024 +
// 768, and the fence painted over its ears. With the pull-back the zoo
// keys at 5.3 + 768/1024 = 6.05: under every walker at tx + ty ≥ 6 (a walker
// at (2, 4.0) keys 6.5), over every ground tile with tx + ty ≤ 6 (strictly —
// 0.7, not 0.75, so no tie is left to insertion order) and
// still over every ground tile and every walker behind it (checked on all
// four sides). A per-tile column-clipped split would be exact; this is the
// patch that is right for every walker on a road beside a 2×2.
//
// THIS IS A DEVIATION FROM SPEC §13 AS WRITTEN, AND IT IS THE RIGHT ONE.
// §13 says "building 768" keyed by the front-most tile; an oblong here is
// keyed at (front cell − 0.7)·1024 + 768, i.e. as if it stood at z ≈ 51 in
// its front cell. A round-2 pixel-level ray audit (view ray (1, 1, 2)
// against the plan boxes; every opaque walker pixel vs every opaque zoo
// pixel; 107 walker positions ringing the zoo at 1/8-tile steps in three
// lanes; the same on the tower, 98 pairs, and the apartment, 111) found no
// mis-ordered pixel. SPEC.md is not this module's to edit; the pull-back
// belongs in §13 alongside a second correction: §13's "static layer holds
// buildings, dynamic layer inserted into the same order" is not what
// render.js does — it re-paints standing things every frame, which is the
// only way ONE order can exist.
//
// THE BLIT. `paintScene` hands the callback (sprite, sx, sy, item): the
// screen top-left where the sprite's rows start, computed so the anchor
// pixel sits on the ground centre `(sx, sy + 16)` of the item's tile (the
// north vertex `toScreen` returns, plus half a tile), plus the item's own
// `dx`/`dy` — a walker's lane offset (SPEC §14, ±6 px), a bridge deck's
// lift, a zot's hover — which move the SPRITE and never the key. The
// callback owns the canvas; this file never touches one.

import { toScreen, HALF_H, depthOf } from "./iso.js";

export const Z_GROUND = 0;
export const Z_WALKER = 512;
export const Z_BUILDING = 768;
export const OBLONG_PULLBACK = 0.7;

/** SPEC §13: key = (tx + ty)·1024 + z. Fractional tx/ty are the point. THE one spelling; keyOf feeds it. */
export function sortKey(tx, ty, z) {
  return (tx + ty) * 1024 + z;
}

/** The walker z for a fractional position: 512 + floor(64·frac(tx + ty)). */
export function walkerZ(tx, ty) {
  const s = tx + ty;
  return Z_WALKER + Math.floor(64 * (s - Math.floor(s)));
}

/**
 * Screen top-left for a sprite placed so its anchor sits on the ground
 * centre of tile (tx, ty) — or, for an oblong footprint, on the ground
 * centre of the whole footprint.
 */
export function placeAt(sprite, tx, ty, dx = 0, dy = 0) {
  const fp = sprite.footprint || [1, 1];
  const [sx, sy] = toScreen(tx + (fp[0] - 1) / 2, ty + (fp[1] - 1) / 2);
  return [Math.round(sx - sprite.anchor[0] + dx), Math.round(sy + HALF_H - sprite.anchor[1] + dy)];
}

/**
 * The key of an item: {sprite, tx, ty, z?, kind?}. `z` wins when given;
 * otherwise kind 'walker' → walkerZ, kind 'ground' → 0, anything else → 768.
 */
export function keyOf(item) {
  const fp = (item.sprite && item.sprite.footprint) || [1, 1];
  let z = item.z;
  if (z === undefined) {
    if (item.kind === "walker") z = walkerZ(item.tx, item.ty);
    else if (item.kind === "ground") z = Z_GROUND;
    else z = Z_BUILDING;
  }
  // depthOf keys a footprint by its front-most tile; add the fractional part
  // of the origin back so movers stay continuous; pull an oblong back (see
  // FOOTPRINTS above).
  const fx = item.tx - Math.floor(item.tx);
  const fy = item.ty - Math.floor(item.ty);
  const cell = depthOf(Math.floor(item.tx), Math.floor(item.ty), fp[0], fp[1]);
  const back = fp[0] * fp[1] > 1 ? OBLONG_PULLBACK : 0;
  return sortKey(cell + fx + fy - back, 0, z);
}

/**
 * Sort back-to-front and blit. Stable: two items with equal keys keep their
 * insertion order, so a caller that pushes ground before walkers before
 * buildings gets the same answer it would have got from z alone.
 */
export function paintScene(items, blit) {
  const order = items.map((item, i) => ({ item, i, k: keyOf(item) }));
  order.sort((p, q) => p.k - q.k || p.i - q.i);
  for (const { item } of order) {
    const [sx, sy] = placeAt(item.sprite, item.tx, item.ty, item.dx || 0, item.dy || 0);
    blit(item.sprite, sx, sy, item);
  }
  return order.length;
}
