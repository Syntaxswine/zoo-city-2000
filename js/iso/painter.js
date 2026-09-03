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
// AND IT GROWS ONE TILE PER TILE OF SIDE (session 9, derived then audited).
// The convention first: an item at (tx, ty) stands at the POINT
// (tx + ½, ty + ½) — `placeAt` adds HALF_H, so a walker at (2, 4.0) has its
// feet on the centre of tile (2, 4), and a road's walkers run at integer
// ty along it. A footprint of side s at (ox, oy) is keyed at
// ox + oy + 2s − 2 − back + 0.75; a walker paints over it when
// tx + ty + 0.5 passes that. Two things constrain `back`:
//   IN FRONT   a walker on the east road (tx = ox + s) beside the block's
//              BACK row (ty = oy) has its top four rows over the end face's
//              bottom four, 48 units nearer than the wall it covers; it must
//              be OVER, so back > s − 1.75. (The south road at tx = ox is
//              the same face turned round.)
//   BEHIND     a walker on the north road (ty = oy − 1) at tx ≤ ox + s −
//              0.81 has its picture on the end face and is behind it; it
//              must be UNDER, so back < s − 0.44.
// So back ∈ (s − 1.75, s − 0.44): the zoo's 0.7 sits in (0.25, 1.56), and
// back = 0.7 + (s − 2) keeps the zoo's two margins (0.45 tile in front,
// 0.86 behind) at every side — 1.7 for a 3×3. The flat 0.7 on a 3×3 is
// 0.55 tile short in front: a walker on the east road beside the back row
// loses its head under the wall's foot for half a tile of every crossing
// (tools/depthaudit.mjs `--probe 3 --pullback 0.7` counts the pixels).
// What a pull-back beyond 0.75 gives up is ORDER AGAINST THE GROUND OF ITS
// OWN FOOTPRINT — the front tile keys at ox + oy + 2s − 2, past the block —
// and that is fine because ground is never in the building's scene:
// render.js paints it in the static layer and tools/shots.mjs --scene in
// its own pass first; only the cursor stands on a footprint tile in the
// dynamic pass, and it borrows the block's key (`keyAt`, `footprint` below).
// The first draft of this session got 1.7 from a derivation that forgot
// the +½ convention, then talked itself back to 0.7 from a second one that
// forgot it too and worried about the ground; the audit with the convention
// fixed decided it. The suite runs that audit over the zoo, a bare 3×3 and
// every block sprite.
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
 * The key of an item: {sprite, tx, ty, z?, kind?, keyAt?, footprint?}. `z`
 * wins when given; otherwise kind 'walker' → walkerZ, kind 'ground' → 0,
 * anything else → 768. `keyAt: [tx, ty]` and `footprint: [w, h]` let an item
 * be keyed as ANOTHER footprint while it is drawn at its own tile — the
 * cursor on a tile of a 2×2 or 3×3 is keyed as that building, a hair under
 * it, so it neither pokes through the wall nor hides under the ground.
 */
export function keyOf(item) {
  const fp = item.footprint || (item.sprite && item.sprite.footprint) || [1, 1];
  let z = item.z;
  if (z === undefined) {
    if (item.kind === "walker") z = walkerZ(item.tx, item.ty);
    else if (item.kind === "ground") z = Z_GROUND;
    else z = Z_BUILDING;
  }
  // depthOf keys a footprint by its front-most tile; add the fractional part
  // of the origin back so movers stay continuous; pull an oblong back (see
  // FOOTPRINTS above).
  const kx = item.keyAt ? item.keyAt[0] : item.tx;
  const ky = item.keyAt ? item.keyAt[1] : item.ty;
  const fx = kx - Math.floor(kx);
  const fy = ky - Math.floor(ky);
  const cell = depthOf(Math.floor(kx), Math.floor(ky), fp[0], fp[1]);
  const back = pullbackOf(fp[0], fp[1]);
  return sortKey(cell + fx + fy - back, 0, z);
}

/** The pull-back a footprint is keyed with: 0 for a 1×1, OBLONG_PULLBACK + (side − 2) for an oblong (FOOTPRINTS above) — spelled once. */
export function pullbackOf(fw, fh = fw) {
  return fw * fh > 1 ? OBLONG_PULLBACK + (Math.max(fw, fh) - 2) : 0;
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
