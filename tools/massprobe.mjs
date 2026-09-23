#!/usr/bin/env node
// tools/massprobe.mjs — HOW MUCH OF EACH BUILDING IS ONE BOX? SPEC §12.5.
//
//   node tools/massprobe.mjs              the plans that are still one box with a lid
//   node tools/massprobe.mjs --family     fill and deck by family
//   node tools/massprobe.mjs '^C3-'       every plan whose name matches, one line each
//
// A PASSIVE INSTRUMENT, NOT A GATE, for the same reason faceprobe is one: a
// slab can be a legitimate design, and a number you have not decided about
// yet must be able to be read without being enforced. `tools/art-dump.mjs` is
// the gate — every change to a plan is deliberate because it must be
// re-baselined. This gives docs/PROPOSAL-SPRITE-UPGRADE-2026-09-22.md's D3
// ("R, C and I are the same prism plus a roof slab") a number, and it is how
// T3.2 (setbacks and awnings) was scoped and crossed off.
//
// TWO READINGS PER PLAN.
//
//   fill   the union volume of a plan's GLAZED boxes — its rooms — over their
//          bounding prism. 1.00 is one box. Taken over the OCCUPIED layers
//          only: the roof slab a setback stands on has no glazed box in it,
//          and counting that layer as empty flattered every plan that
//          sandwiches a cap between two storeys (the first draft of T3.2's
//          apartment read 0.848 that way and 0.875 honestly).
//   deck   at zoom 1, the share of the sprite's pixels that are a TOP face
//          standing between the ground (c > 2) and a storey under the top
//          (c <= top - 3): a terrace, a lower roof, a porch roof, an awning.
//          Fill cannot see WHERE the mass went — a bite out of the back
//          corner is invisible from the camera — so this is the half that
//          says the step can be seen at the zoom the game is played at.
//
// A plan is ONE BOX WITH A LID when fill >= 0.95 and deck < 8%. That line was
// drawn on the baseline, not tuned: the four original R and C plans T3.2
// stepped back sat at fill 1.00 and deck 0.0–5.3% (the apartment's balcony
// slats), and the later plans' medians are 0.715 and 16%.

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { RECIPES } from "../js/art/solid.js";
import { renderRecipe, PLANS } from "../js/art/buildings.js";
import "../js/art/index.js"; // registers every family with RECIPES

const glazed = (b) => !!(b.faces && b.faces.glazing);

/** Union volume of `boxes` and the height of the layers any of them occupies. */
function occupied(boxes) {
  const cuts = (lo, hi) => [...new Set(boxes.flatMap((b) => [b[lo], b[hi]]))].sort((x, y) => x - y);
  const as = cuts("a0", "a1"), bs = cuts("b0", "b1"), cs = cuts("c0", "c1");
  let volume = 0, height = 0;
  for (let k = 0; k + 1 < cs.length; k++) {
    const c = (cs[k] + cs[k + 1]) / 2;
    const here = boxes.filter((x) => c > x.c0 && c < x.c1);
    if (!here.length) continue;
    height += cs[k + 1] - cs[k];
    for (let i = 0; i + 1 < as.length; i++) for (let j = 0; j + 1 < bs.length; j++) {
      const a = (as[i] + as[i + 1]) / 2, b = (bs[j] + bs[j + 1]) / 2;
      if (here.some((x) => a > x.a0 && a < x.a1 && b > x.b0 && b < x.b1)) volume += (as[i + 1] - as[i]) * (bs[j + 1] - bs[j]) * (cs[k + 1] - cs[k]);
    }
  }
  return { volume, height };
}

/** { fill, rooms, top, deck, px } for one box recipe. */
export function massOf(recipe) {
  const rooms = recipe.boxes.filter(glazed);
  const top = Math.max(...(rooms.length ? rooms : recipe.boxes).map((b) => b.c1));
  let fill = 1;
  if (rooms.length) {
    const { volume, height } = occupied(rooms);
    const w = Math.max(...rooms.map((b) => b.a1)) - Math.min(...rooms.map((b) => b.a0));
    const d = Math.max(...rooms.map((b) => b.b1)) - Math.min(...rooms.map((b) => b.b0));
    fill = volume / (w * d * height);
  }
  // Every face replaced by a marker, only where the real skin painted — so a
  // cut doorway stays a hole — and the z-buffer decides, as it does for the
  // real sprite. Stamps (a tree in the yard) are not the building.
  const DECK = "m", OTHER = "n";
  const marked = {
    ...recipe, stamps: [],
    boxes: recipe.boxes.map((b) => {
      const faces = {};
      for (const f of ["top", "side", "end"]) {
        const orig = b.faces && b.faces[f];
        if (typeof orig !== "function") continue;
        const key = f === "top" && b.c1 > 2 && b.c1 <= top - 3 ? DECK : OTHER;
        faces[f] = (...a) => (orig(...a) ? key : null);
      }
      return { ...b, faces };
    }),
  };
  let px = 0, deck = 0;
  for (const row of renderRecipe(marked, 1).grid) for (const ch of row) {
    if (ch === DECK) { deck++; px++; } else if (ch === OTHER) px++;
  }
  return { fill, rooms: rooms.length, top, deck: px ? deck / px : 0, px };
}

export const isOneBox = (m) => m.fill >= 0.95 && m.deck < 0.08;

/**
 * Every zoned plan (R, C, I, M — lots, blocks, landmarks), measured.
 *
 * PLANS, NOT EVERY RECIPE. A lit or marked building is a character sprite
 * (building-character.js) that registers its own recipe as
 * `<plan>-people-<key>`, so RECIPES grows with whatever the process has
 * drawn: the sheet that first called this, after rendering a town, measured
 * 255 "plans" where the bare tool measured 192. PLANS is what solidSprite
 * registered — the list the footprint gate reads — and it does not grow.
 */
export function massShares(match = /^[RCIM]\d/) {
  const plans = new Set(PLANS.map((p) => p.name));
  const rows = [];
  for (const [, recipe] of RECIPES) if (recipe.boxes && plans.has(recipe.name) && match.test(recipe.name)) rows.push({ name: recipe.name, ...massOf(recipe) });
  return rows;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const rows = massShares();
  const line = (r) => `  ${r.name.padEnd(32)} fill ${r.fill.toFixed(2)}  deck ${(100 * r.deck).toFixed(1).padStart(5)}%  rooms ${String(r.rooms).padStart(2)}  top ${String(r.top).padStart(4)}${isOneBox(r) ? "   ONE BOX" : ""}`;
  const filter = args.find((a) => !a.startsWith("--"));
  if (filter) {
    for (const r of rows) if (new RegExp(filter).test(r.name)) console.log(line(r));
  } else if (args.includes("--family")) {
    const fam = new Map();
    for (const r of rows) {
      const key = r.name.replace(/-\d+$/, "");
      const f = fam.get(key) || { n: 0, fill: 0, deck: 0, one: 0 };
      f.n++; f.fill += r.fill; f.deck += r.deck; if (isOneBox(r)) f.one++;
      fam.set(key, f);
    }
    console.log(`massprobe: ${rows.length} zoned plans, by family (mean fill · mean deck · plans that are one box):`);
    for (const [key, f] of fam) console.log(`  ${key.padEnd(30)} ${String(f.n).padStart(2)} plans  fill ${(f.fill / f.n).toFixed(2)}  deck ${((100 * f.deck) / f.n).toFixed(1).padStart(5)}%  one box ${f.one}`);
  } else {
    const one = rows.filter(isOneBox);
    console.log(`massprobe: ${rows.length} zoned plans · ${one.length} are ONE BOX WITH A LID (fill >= 0.95, deck < 8%)`);
    for (const r of one) console.log(line(r));
  }
}
