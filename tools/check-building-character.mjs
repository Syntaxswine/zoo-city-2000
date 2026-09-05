// Part E assertions, called by the canonical suite; no independent verdict.
import { art } from "../js/art/index.js";
import { BUILDINGS, RECIPES, allBuildings } from "../js/art/buildings.js";
import { allBlocks } from "../js/art/blocks.js";
import { allLandmarks } from "../js/art/landmarks.js";
import { allShops } from "../js/art/shops.js";
import { characterSprite, lightLevel, MARKS } from "../js/art/building-character.js";
import { createWorld, ZONE } from "../js/sim/world.js";
import { SPECIES } from "../js/sim/species.js";
import { recountMajority } from "../js/sim/census.js";
import { lotReport } from "../js/sim/lots.js";

const inkAt = (s, x, y) => s.rows[y + s.anchor[1]]?.[x + s.anchor[0]] || ".";
function differences(a, b) {
  const out = [];
  for (let y = -Math.max(a.anchor[1], b.anchor[1]); y < Math.max(a.h - a.anchor[1], b.h - b.anchor[1]); y++)
    for (let x = -Math.max(a.anchor[0], b.anchor[0]); x < Math.max(a.w - a.anchor[0], b.w - b.anchor[0]); x++)
      if (inkAt(a, x, y) !== inkAt(b, x, y)) out.push([x, y]);
  return out;
}

export function checkBuildingCharacter(check) {
  const bases = [...new Set([...allBuildings(), ...allBlocks(), ...allLandmarks(), ...allShops()]
    .map(x => x.sprite).filter(s => s.tags.includes("building")))];
  check("buildings E: all twelve original families have four pairwise-distinct authored plans",
    [1, 2, 3, 4].every(z => [1, 2, 3].every(t => BUILDINGS[z][t].length === 4 && new Set(BUILDINGS[z][t].map(s => s.rows.join("\n"))).size === 4)));
  check("buildings E: every species has a distinct stamp inside a six-by-six socket",
    SPECIES.every(s => MARKS[s.id]?.w <= 6 && MARKS[s.id]?.h <= 6) && new Set(Object.values(MARKS).map(s => s.rows.join("\n"))).size === 14);
  check("buildings E: light levels clamp full occupancy and change at the four fill thresholds",
    [-1, 0, .24, .25, .49, .5, .74, .75, 1, 2].map(lightLevel).join() === "0,0,0,1,1,2,2,3,3,3");

  const lightBad = [], markBad = [], prismBad = [], cacheBad = [];
  let lightPixels = 0, markPixels = 0;
  for (const base of bases) {
    if (characterSprite(base, {}) !== base) cacheBad.push(base.name);
    for (const scale of [1, 2]) {
      let previous = scale === 1 ? base : art.hires(base);
      let n = 0;
      for (const lit of [1, 2, 3]) {
        const lo = characterSprite(base, { lit, seed: 27 });
        if (characterSprite(base, { lit, seed: 27 }) !== lo) cacheBad.push(base.name);
        const next = scale === 1 ? lo : art.hires(lo);
        for (const [x, y] of differences(previous, next)) {
          if (!["=", "H"].includes(inkAt(previous, x, y)) || inkAt(next, x, y) !== "-") lightBad.push(`${base.name}@${scale}: non-glass changed`);
          n++;
        }
        previous = next;
      }
      if (!n) lightBad.push(`${base.name}@${scale}: no visible lights`);
      lightPixels += n;
    }
    // Every plan at both resolutions, plus all species across all four R2 and
    // C2 plans. The latter catches a small mark hidden by a projecting bay.
    const majorityCases = /^([RC]2-)/.test(base.name) ? SPECIES.map((s, n) => n + 1) : [1];
    for (const majority of majorityCases) {
      const marked = characterSprite(base, { majority });
      const recipe = RECIPES.get(marked), at = recipe?.sockets?.[base.tags.includes("R") ? "wall" : "roof"];
      if (!at) { markBad.push(`${base.name}: no socket`); continue; }
      if (base.tags.includes("R") && !RECIPES.get(base).boxes.some(b => b.faces.glazing &&
        at[0] >= b.a0 && at[0] <= b.a1 && Math.abs(at[1] - b.b1 - .1) < 1e-8 && at[2] >= b.c0 && at[2] < b.c1))
        markBad.push(`${base.name}: residential mark is not on a facade`);
      for (const scale of [1, 2]) {
        const original = scale === 1 ? base : art.hires(base), sprite = scale === 1 ? marked : art.hires(marked);
        const diff = differences(original, sprite);
        if (!diff.length) markBad.push(`${base.name}/${majority}@${scale}: invisible`);
        markPixels += diff.length;
        const left = Math.round((2 * at[0] - 2 * at[1]) * scale) - 3 * scale;
        const top = Math.round((at[0] + at[1] - at[2]) * scale) - (2 * recipe.hub + 5) * scale;
        if (diff.some(([x, y]) => x < left || x >= left + 6 * scale || y < top || y >= top + 6 * scale)) markBad.push(`${base.name}: outside socket`);
        const A = 16 * sprite.footprint[0], B = 16 * sprite.footprint[1];
        for (const [x, y] of diff) {
          const wx = x / scale, wy = y / scale + 2 * recipe.hub;
          if (wx < -2 * B - 1 || wx > 2 * A + 1 || wy > 2 * Math.min(A, B + wx / 2) - wx / 2 + 1) prismBad.push(base.name);
        }
      }
    }
  }
  check("buildings E: all plans, blocks, landmarks and shops gain only monotone glass light at both resolutions", !lightBad.length, lightBad.slice(0, 8).join("; "));
  check("buildings E: every plan's mark is visible and confined to its socket at both resolutions", !markBad.length, markBad.slice(0, 8).join("; "));
  check("buildings E: species stamps remain inside the building footprint prism", !prismBad.length, prismBad.slice(0, 8).join("; "));
  check("buildings E: cached appearances reuse sprites and an empty unlit building keeps its base", !cacheBad.length);
  const W = createWorld({ seed: "people-e" });
  const home = 1000, job = 1001;
  W.zone[home] = ZONE.R; W.zone[job] = ZONE.C; W.tier[home] = W.tier[job] = 1;
  W.citizens = [{ id: 1, species: "rabbit", home, job: -1 }, { id: 2, species: "fox", home: -1, job }];
  recountMajority(W);
  const r = lotReport(W, home).mark, c = lotReport(W, job).mark;
  W.citizens = []; recountMajority(W);
  check("buildings E: Inspect names residents on R, staff on C, and removes the mark after vacancy",
    r?.species === "rabbit" && r.line === "a warren door — rabbits live here" && c?.species === "fox" && c.line === "a brush weathervane — foxes work here" && lotReport(W, home).mark === null && lotReport(W, job).mark === null);
  console.log(`buildings E: ${bases.length} plans, ${lightPixels} light pixels, ${markPixels} mark pixels checked at both resolutions`);
}
