// iso.js — the projection, the inverse, and the depth key. PURE AND DOM-FREE.
//
// THE ONE PICTURE YOU NEED (house convention, shared with the sibling games):
//
//   toScreen(tx, ty) returns the tile's NORTH (top) VERTEX.
//
//                (sx, sy)  <- toScreen(tx, ty)
//                   /\
//                  /  \                 the diamond of tile (tx, ty)
//       (-W/2,+H/2)<    >(+W/2,+H/2)    centre = (sx, sy + H/2)
//                  \  /
//                   \/
//                (0, +H)
//
// +tx runs DOWN-RIGHT on screen, +ty runs DOWN-LEFT. Tile (0,0)'s north vertex
// is the world origin; the camera is a screen offset subtracted afterwards.
// Exact 2:1 — every diamond edge is a clean 2-across / 1-down run.
//
// THE DEPTH KEY. Painter's algorithm, back to front, key = tx + ty for the
// FRONT-MOST tile of a footprint; movers keep fractional tx/ty and go through
// the same key so a walker never pops across a tile boundary. Within a tile,
// higher is nearer (a + b + 2c in the sprite rasteriser) — so a building drawn
// after its own ground, and a citizen drawn after the building whose tile is
// behind them, is the whole ordering.

export const TILE_W = 64;
export const TILE_H = 32;
export const HALF_W = TILE_W / 2;
export const HALF_H = TILE_H / 2;

/** World tile → screen north vertex. */
export function toScreen(tx, ty) {
  return [(tx - ty) * HALF_W, (tx + ty) * HALF_H];
}

/** Screen point → fractional world tile (the flat inverse; the map is flat). */
export function toWorld(sx, sy) {
  const a = sx / HALF_W;
  const b = sy / HALF_H;
  return [(a + b) / 2, (b - a) / 2];
}

/** The integer tile under a screen point, or null when off the map. */
export function pickTile(sx, sy, w, h) {
  const [fx, fy] = toWorld(sx, sy);
  const tx = Math.floor(fx);
  const ty = Math.floor(fy);
  if (tx < 0 || ty < 0 || tx >= w || ty >= h) return null;
  return [tx, ty];
}

/** Painter's key for a footprint with origin (tx, ty) and size fw × fh. */
export function depthOf(tx, ty, fw = 1, fh = 1) {
  return tx + fw - 1 + (ty + fh - 1);
}

/** Screen bounds of a w × h map, for sizing a canvas. */
export function mapBounds(w, h) {
  return {
    minX: -h * HALF_W,
    maxX: w * HALF_W,
    minY: 0,
    maxY: (w + h) * HALF_H,
    width: (w + h) * HALF_W,
    height: (w + h) * HALF_H,
  };
}
