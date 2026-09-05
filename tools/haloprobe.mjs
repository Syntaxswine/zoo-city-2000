// haloprobe.mjs — where is a 3×3 campus's halo SEEDED from: its anchor tile or its
// whole footprint? A passive instrument (exit 0, never a gate). Written for the
// knowledge-and-culture review (docs/REVIEW-KNOWLEDGE-CULTURE-2026-09-05.md §F3),
// whose coverage rule says "seeded from every footprint tile at distance zero".
//
//   node tools/haloprobe.mjs
//
// Flat 64×64 grass, one road along y = 29, a police campus anchored at (30,30) so
// its nine tiles are x 30..32 × y 30..32 and touch the road. Prints the cover
// box computeCoverage produces against the box a footprint-seeded flood would.
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const m = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const { createWorld, TERRAIN, idx } = await m("js/sim/world.js");
const { apply } = await m("js/sim/ops.js");
const { computeFields } = await m("js/sim/fields.js");
const { KNOBS } = await m("js/sim/rules.js");

const w = createWorld({ seed: "haloprobe", w: 64, h: 64 });
w.cash = 1e9;
for (let i = 0; i < w.terrain.length; i++) w.terrain[i] = TERRAIN.GRASS;
for (let x = 20; x <= 44; x++) {
  const r = apply(w, { kind: "road", tiles: [idx(w, x, 29)] });
  if (!r.ok) console.log(`road refused at (${x},29): ${r.reason}`);
}
const placed = apply(w, { kind: "police", tx: 30, ty: 30 });
console.log(`police campus at (30,30) → x 30..32 × y 30..32: ${placed.ok ? "placed" : "REFUSED " + placed.reason}`);
computeFields(w);

const box = (arr) => {
  let minx = 99, maxx = -1, miny = 99, maxy = -1, n = 0;
  for (let y = 0; y < w.h; y++) for (let x = 0; x < w.w; x++) {
    if (!arr[idx(w, x, y)]) continue;
    n++; minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y);
  }
  return { n, x: `${minx}..${maxx}`, y: `${miny}..${maxy}` };
};
const R = KNOBS.POLICE_RADIUS;
const got = box(w.policeCov);
const side = 3 + 2 * R;
console.log(`POLICE_RADIUS ${R}`);
console.log(`  computeCoverage : ${got.n} tiles, x ${got.x}, y ${got.y}`);
console.log(`  footprint-seeded: ${side * side} tiles, x ${30 - R}..${32 + R}, y ${30 - R}..${32 + R}`);
const cov = (x, y) => w.policeCov[idx(w, x, y)];
console.log(`  NW reach: (${30 - R},${30 - R}) cov ${cov(30 - R, 30 - R)} · SE reach: (${32 + R - 2},${32 + R - 2}) cov ${cov(32 + R - 2, 32 + R - 2)}, (${32 + R - 1},${32 + R - 1}) cov ${cov(32 + R - 1, 32 + R - 1)}, (${32 + R},${32 + R}) cov ${cov(32 + R, 32 + R)}`);
const anchorSeeded = got.n === (1 + 2 * R) ** 2 && got.x === `${30 - R}..${30 + R}`;
const footprintSeeded = got.n === side * side && got.x === `${30 - R}..${32 + R}` && got.y === `${30 - R}..${32 + R}`;
console.log(anchorSeeded
  ? `  → seeded from the ANCHOR tile: the SE frontage gets ${R - 2} tiles of reach, the NW gets ${R}`
  : footprintSeeded
    ? `  → seeded from the WHOLE FOOTPRINT: ${R} tiles of reach on every side (reach.forEachWithinAll, session 17)`
    : `  → neither box; read the numbers above`);
