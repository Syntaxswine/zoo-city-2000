#!/usr/bin/env node
// tools/depthaudit.mjs — THE RAY AUDIT for oblong footprints. SPEC §13.
//
//   node tools/depthaudit.mjs                 every oblong solid (the zoo, the blocks) against walkers ringing it
//   node tools/depthaudit.mjs --probe 3       a bare 3×3 box, for a footprint that has no sprite yet
//   node tools/depthaudit.mjs --verbose       every mis-ordered (building, walker) pair
//
// The painter keys an oblong by its front-most tile minus a pull-back
// (painter.js FOOTPRINTS); this tool asks, pixel by pixel, whether that key
// puts every walker on the roads round the footprint on the side of the
// building the view ray says it is on. For a building at tile (bx, by) and a
// walker at (wx, wy), every screen pixel the two sprites share is compared:
// the building's depth is its rasteriser z-buffer (a + b + 2c in plan units,
// re-rendered from the RECIPE with the stamps), the walker's is the depth of
// a point standing on its feet at that pixel's height — a + b + 2·(rows above
// the feet), the same key `stampAtWorld` gives a billboard. If the nearer
// pixel belongs to the item painter.js sorts FIRST, that pixel is
// mis-ordered, and the count is the verdict.
//
// THE CONVENTION, which the first draft of this tool got wrong: an item at
// (tx, ty) stands at the POINT (tx + ½, ty + ½) — `placeAt` adds HALF_H —
// so a walker at (2, 4.0) has its feet on the centre of tile (2, 4), and in
// a building's plan units (16 to the tile, origin at the footprint's north
// corner) its feet are at a = 16·(wx − bx) + 8, b = 16·(wy − by) + 8. Without
// the +8s every walker was 16 units too deep and the audit passed a
// pull-back that puts heads under walls.
//
// Walkers ring the footprint along the four roads a tile out — on the road
// tiles' centre lines, which is where the walker layer keeps them — at
// 1/8-tile steps, in three lanes (dx −6, 0, +6 px — the lane shift moves
// the picture and never the key, so it is audited with the picture shifted
// and the key not). A footprint that fails is a pull-back bug (painter.js
// FOOTPRINTS), not an art bug.
//
// THE GRAZE. A billboard's depth is a convention — its pixels are given the
// depth of a point on its feet at that height — and at the edge of the
// picture the convention leans by a unit or two where a billboard's corner
// meets a solid's corner. A mis-ordered pixel within GRAZE (4 units, two
// pixels of height) is counted as a graze and reported, not gated; what
// the gate catches is 48 units of a walker's head under a wall.
//
// An INSTRUMENT when run: it reports and exits 0. The suite imports
// `auditDepth` and gates on bad === 0 for every oblong.

import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mod = (p) => import(pathToFileURL(resolve(ROOT, p)).href);

const { keyOf, placeAt, sortKey, Z_BUILDING } = await mod("js/iso/painter.js");
const { depthOf } = await mod("js/iso/iso.js");
const { renderRecipe, RECIPES } = await mod("js/art/buildings.js");
const { T } = await mod("js/art/format.js");

const LANES = [-6, 0, 6];
const STEP = 1 / 8;
export const GRAZE = 4; // depth units a billboard's edge may lean past a solid before it is a mis-order

/**
 * Audit one oblong sprite. `walkers` is a list of walker sprites (billboards
 * anchored on their feet). `back` overrides the painter's pull-back (to show
 * a wrong one failing). Returns { positions, pairs, overlaps, bad, grazes,
 * ties, maxDiff, worst }: `bad` counts pixels mis-ordered by more than GRAZE
 * depth units, `grazes` the rest, `maxDiff` the largest depth error seen.
 */
export function auditDepth(sprite, walkers, { bx = 4, by = 4, verbose = false, back = null } = {}) {
  const recipe = RECIPES.get(sprite);
  if (!recipe) throw new Error(`depthaudit: '${sprite.name}' has no recipe — only box solids can be audited`);
  const r = renderRecipe(recipe, 1);
  const W = r.grid[0].length, H = r.grid.length;
  if (W !== sprite.w || H !== sprite.h) throw new Error(`depthaudit: '${sprite.name}' re-rendered ${W}×${H}, sprite is ${sprite.w}×${sprite.h}`);
  const [fw, fh] = sprite.footprint;
  const building = { sprite, tx: bx, ty: by, kind: "building" };
  const kB = back == null ? keyOf(building) : sortKey(depthOf(bx, by, fw, fh) - back, 0, Z_BUILDING);
  const [sxB, syB] = placeAt(sprite, bx, by);
  // The four roads, one tile out, on their centre lines, walked at 1/8-tile steps.
  const spots = [];
  for (let t = -2; t <= fw + 1 + 1e-9; t += STEP) { spots.push([bx + t, by - 1]); spots.push([bx + t, by + fh]); }
  for (let t = -2; t <= fh + 1 + 1e-9; t += STEP) { spots.push([bx - 1, by + t]); spots.push([bx + fw, by + t]); }
  let pairs = 0, overlaps = 0, bad = 0, grazes = 0, ties = 0, maxDiff = 0;
  let worst = null;
  const badList = [];
  for (const [wx, wy] of spots) {
    for (const ws of walkers) {
      for (const lane of LANES) {
        pairs++;
        const walker = { sprite: ws, tx: wx, ty: wy, kind: "walker", dx: lane };
        const kW = keyOf(walker);
        const walkerOver = kW > kB; // painter draws the walker after (over) the building
        const [sxW, syW] = placeAt(ws, wx, wy, lane, 0);
        // The walker's feet in the building's plan units: the point (wx + ½, wy + ½).
        const aw = 16 * (wx - bx) + 8, bw = 16 * (wy - by) + 8;
        let here = 0, hereMax = 0, grazed = 0;
        for (let qy = 0; qy < ws.h; qy++) {
          const row = ws.rows[qy];
          const dW = aw + bw + 2 * (ws.anchor[1] - qy);
          for (let qx = 0; qx < ws.w; qx++) {
            if (row[qx] === T) continue;
            const px = sxW + qx - sxB, py = syW + qy - syB;
            if (px < 0 || py < 0 || px >= W || py >= H) continue;
            if (r.grid[py][px] === T) continue;
            const dB = r.zbuf[py * W + px];
            overlaps++;
            if (Math.abs(dW - dB) < 1e-6) { ties++; continue; }
            const walkerNearer = dW > dB;
            if (walkerNearer === walkerOver) continue;
            const diff = Math.abs(dW - dB);
            if (diff <= GRAZE) { grazed++; continue; }
            here++;
            if (diff > hereMax) hereMax = diff;
          }
        }
        grazes += grazed;
        if (here) {
          bad += here;
          if (hereMax > maxDiff) maxDiff = hereMax;
          const rec = { wx, wy, lane, walker: ws.name, px: here, diff: hereMax, walkerOver };
          badList.push(rec);
          if (!worst || here > worst.px) worst = rec;
        }
      }
    }
  }
  if (verbose) for (const b of badList) console.log(`    ${sprite.name} vs ${b.walker} at (${b.wx.toFixed(3)}, ${b.wy.toFixed(3)}) lane ${b.lane}: ${b.px} px, up to ${b.diff} units, painter says walker ${b.walkerOver ? "over" : "under"}`);
  return { positions: spots.length, pairs, overlaps, bad, grazes, ties, maxDiff, worst };
}

/** A bare box of side `s` tiles, hub at the footprint's centre — a probe for a footprint with no sprite yet. */
export async function probeSolid(side, height = 40) {
  const { box, litSkin, A_STEP } = await mod("js/art/solid.js");
  const { solidSprite } = await mod("js/art/buildings.js");
  const { keysOf } = await mod("js/art/palette.js");
  const n = 16 * side;
  const boxes = [box(1, n - 1, 1, n - 1, 0, height, litSkin(keysOf("concrete"), { height }))];
  return solidSprite(`probe-${side}x${side}`, boxes, { hub: (A_STEP * side) / 2, footprint: [side, side], tags: ["probe"] });
}

/** The walker billboards the audit uses: four facings of a small, a tall and a wide animal. */
export async function auditWalkers() {
  const { art } = await mod("js/art/index.js");
  const out = [];
  for (const sp of ["rabbit", "bear", "hawk"]) for (const f of ["se", "ne", "sw", "nw"]) out.push(art.citizen(sp, f, 0, "adult"));
  out.push(art.citizen("wolf", "se", 1, "adult", { carry: "sack" }));
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const verbose = argv.includes("--verbose");
  const probeAt = argv.indexOf("--probe");
  const backAt = argv.indexOf("--pullback");
  const back = backAt >= 0 ? Number(argv[backAt + 1]) : null;
  const walkers = await auditWalkers();
  const { allSprites } = await mod("js/art/index.js");
  const targets = [];
  if (probeAt >= 0) targets.push(await probeSolid(Number(argv[probeAt + 1]) || 3, 48));
  for (const { sprite } of allSprites()) {
    const [fw, fh] = sprite.footprint || [1, 1];
    if (fw * fh > 1 && RECIPES.has(sprite)) targets.push(sprite);
  }
  let total = 0;
  if (back != null) console.log(`pull-back overridden to ${back} for every footprint`);
  for (const sprite of targets) {
    const res = auditDepth(sprite, walkers, { verbose, back });
    total += res.bad;
    const w = res.worst ? ` — worst (${res.worst.wx.toFixed(3)}, ${res.worst.wy.toFixed(3)}) lane ${res.worst.lane} ${res.worst.walker}: ${res.worst.px} px, ${res.worst.diff} units` : "";
    console.log(`${sprite.name.padEnd(28)} ${sprite.footprint.join("×")}  positions ${res.positions}  pairs ${res.pairs}  overlapping px ${res.overlaps}  ties ${res.ties}  grazes ${res.grazes}  MIS-ORDERED ${res.bad}${res.bad ? ` (max ${res.maxDiff} units)` : ""}${w}`);
  }
  console.log(total === 0 ? `every oblong sorts right against every walker on its roads (grazes ≤ ${GRAZE} units are the billboard's lean, reported above)` : `${total} mis-ordered pixels — a pull-back bug (painter.js), not an art bug`);
}
