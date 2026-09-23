#!/usr/bin/env node
// tools/faceprobe.mjs — HOW MUCH OF THE CITY IS ROOF? SPEC §12.5.
//
//   node tools/faceprobe.mjs              the three face shares, over every box recipe
//   node tools/faceprobe.mjs --top 20     the largest sprites with their roof share
//   node tools/faceprobe.mjs --family     the shares split by family prefix
//
// A PASSIVE INSTRUMENT, NOT A GATE. It refuses nothing and exits 0 on any
// tree; `tools/art-dump.mjs` is the gate. This one exists to give a design
// claim a number: the roof is the biggest surface in an isometric city and
// the easiest one to leave empty, so "the roofs are bare" and "the roofs are
// no longer bare" both have to be readings, not impressions. The top-face
// share FALLING is how the roof-furniture work is crossed off
// (docs/PROPOSAL-SPRITE-UPGRADE-2026-09-22.md, T2.3).
//
// HOW. Every box recipe is re-rendered with its three face functions
// replaced by marker keys — the marker only where the real skin returned a
// key, so cut doorways and holes stay holes — and the winning key is counted
// per pixel. The z-buffer decides exactly as it does for the real skin, so
// the shares are the shares the player sees. `stamps` (signs, a tree in the
// yard) are stripped: they are not faces, and leaving them in would credit
// their pixels to whichever face they cover.

import { RECIPES } from "../js/art/solid.js";
import { renderRecipe } from "../js/art/buildings.js";
import "../js/art/index.js"; // registers every family with RECIPES

const MARK = { top: "m", side: "n", end: "o" }; // three grass keys, distinct, never adjacent in meaning here

const marked = (recipe) => ({
  ...recipe,
  stamps: [],
  boxes: recipe.boxes.map((b) => {
    const faces = {};
    for (const f of ["top", "side", "end"]) {
      const orig = b.faces[f];
      if (typeof orig !== "function") continue;
      faces[f] = (...a) => (orig(...a) ? MARK[f] : null);
    }
    return { ...b, faces };
  }),
});

/** Per-sprite { name, top, side, end, all }. */
export function faceShares() {
  const rows = [];
  for (const [, recipe] of RECIPES) {
    if (!recipe.boxes) continue;
    const r = renderRecipe(marked(recipe), 1);
    let top = 0, side = 0, end = 0;
    for (const row of r.grid) for (const ch of row) {
      if (ch === MARK.top) top++;
      else if (ch === MARK.side) side++;
      else if (ch === MARK.end) end++;
    }
    const all = top + side + end;
    if (all) rows.push({ name: recipe.name, top, side, end, all });
  }
  return rows;
}

const args = process.argv.slice(2);
const rows = faceShares();
const sum = (k) => rows.reduce((n, r) => n + r[k], 0);
const tTop = sum("top"), tSide = sum("side"), tEnd = sum("end"), total = tTop + tSide + tEnd;
const pc = (n) => `${((100 * n) / total).toFixed(1)}%`;

console.log(`faceprobe: ${rows.length} box recipes · ${total.toLocaleString()} opaque px`);
console.log(`  TOP  ${String(tTop).padStart(9)}  ${pc(tTop)}   <- the roof`);
console.log(`  SIDE ${String(tSide).padStart(9)}  ${pc(tSide)}`);
console.log(`  END  ${String(tEnd).padStart(9)}  ${pc(tEnd)}`);

if (args.includes("--family")) {
  const fam = new Map();
  for (const r of rows) {
    const key = r.name.replace(/-?\d+$/, "").split("-").slice(0, 2).join("-");
    const f = fam.get(key) || { top: 0, all: 0, n: 0 };
    f.top += r.top; f.all += r.all; f.n++;
    fam.set(key, f);
  }
  console.log("\nby family (roof share of its own pixels):");
  for (const [key, f] of [...fam].sort((a, b) => b[1].all - a[1].all)) {
    console.log(`  ${key.padEnd(26)} ${String(f.n).padStart(3)} sprites ${String(f.all).padStart(7)} px  roof ${((100 * f.top) / f.all).toFixed(0)}%`);
  }
}

const topN = args.includes("--top") ? Number(args[args.indexOf("--top") + 1]) || 12 : 0;
if (topN) {
  console.log(`\nthe ${topN} largest sprites:`);
  for (const r of [...rows].sort((a, b) => b.all - a.all).slice(0, topN)) {
    console.log(`  ${r.name.padEnd(32)} ${String(r.all).padStart(6)} px  roof ${((100 * r.top) / r.all).toFixed(0)}%`);
  }
}
