#!/usr/bin/env node
// tools/skyline-sheet.mjs — THE SKYLINE, ON ONE RIG. SPEC §12.5.
//
//   node tools/skyline-sheet.mjs             docs/shots/sheet-skyline.png
//   node tools/skyline-sheet.mjs --out …
//
// T3.2's picture (setbacks and awnings). It refuses nothing; it prints the
// massing numbers from tools/massprobe.mjs and draws two bands, because the
// question is two questions:
//
//   the top band   the four families T3.2 changed — the two-storey, the
//                  apartment, the store, the tower — all six plans each, at
//                  2×, R on the first row and C on the second. Plans 0 and 1
//                  of each are the ones that were one box with a lid; the
//                  other four were authored later and already stepped, so this
//                  is where you see whether the originals now belong to their
//                  families or merely stopped being boxes.
//   the bottom     a dense block of mid- and high-rise R and C through the REAL
//                  renderer at zoom 1 and zoom 2. At zoom 1 a setback of s
//                  units is a band 2s px tall; this is the only frame that says
//                  whether it reads as a STEP or as a stripe.

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { installCanvas, createCanvas, encodePNG } from "./headless-canvas.mjs";

installCanvas();

const { createWorld, ZONE, TERRAIN, ROAD, capacityOf } = await import("../js/sim/world.js");
await import("../js/sim/ops.js");
await import("../js/sim/tick.js");
const { createRenderer } = await import("../js/render.js");
const { art } = await import("../js/art/index.js");
const { rasterize } = await import("../js/art/format.js");
const { massShares, isOneBox } = await import("./massprobe.mjs");

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const OUT = resolve(ROOT, arg("--out", "docs/shots/sheet-skyline.png"));

// ---- the top band: four families, six plans each, at 2× ---------------------
const FAMILIES = [["R", 2], ["R", 3], ["C", 2], ["C", 3]];
const tiles = FAMILIES.map(([z, t]) => [0, 1, 2, 3, 4, 5].map((v) => {
  const s = art.hires(art.building(z, t, v, 1, 0, null), 2);
  return { name: s.name, im: rasterize(s.rows) };
}));
const CW = Math.max(...tiles.flat().map((t) => t.im.w)) + 14;
const CH = Math.max(...tiles.flat().map((t) => t.im.h)) + 14;

// ---- the bottom band: one dense block through the real renderer -------------
// Every lot a mid- or high-rise R or C, every plan chosen by the tile's own
// byte as the game chooses it, so about a third draw a plan T3.2 changed —
// the share a real town has.
const world = createWorld({ seed: "skyline-sheet" });
world.tick = 400;
const put = (tx, ty, zone, tier) => {
  const i = ty * world.w + tx;
  world.zone[i] = zone; world.tier[i] = tier; world.variant[i] = (tx * 29 + ty * 53 + tx * ty) & 255;
  const cap = capacityOf(world, i) || 1;
  world.occupants[i] = cap; world.staff[i] = cap;
};
for (let t = 2; t < 22; t++) { world.road[9 * world.w + t] = ROAD.ROAD; world.road[15 * world.w + t] = ROAD.ROAD; }
const SPEC = [[ZONE.R, 2], [ZONE.C, 2], [ZONE.R, 3], [ZONE.C, 2], [ZONE.R, 2], [ZONE.C, 3]];
let lots = 0, changed = 0;
for (let ty = 4; ty <= 20; ty++) for (let tx = 4; tx <= 19; tx++) {
  if (ty === 9 || ty === 15) continue;
  const n = tx * 5 + ty * 3;
  if (n % 11 === 0) { world.terrain[ty * world.w + tx] = TERRAIN.TREE; continue; }
  put(tx, ty, ...SPEC[n % SPEC.length]);
  lots++; if (world.variant[ty * world.w + tx] % 6 < 2) changed++;
}
const PW = 820, PH = 330;
const panel = createCanvas(PW, PH);
const r = createRenderer(panel, world, art);
r.resize();
const shots = [1, 2].map((zoom) => {
  r.draw({ x: 0, y: 380, zoom }, null, null, "off", 0);
  return panel.getContext("2d").getImageData(0, 0, PW, PH);
});

// ---- lay it out -------------------------------------------------------------
const GAP = 10;
// Two families to a row — R above, C below — so the band is as wide as the town.
const PER_ROW = 12, cells = tiles.flat();
const topW = PER_ROW * CW, topH = Math.ceil(cells.length / PER_ROW) * CH;
const W = Math.max(topW, shots.length * (PW + GAP) + GAP);
const sheet = createCanvas(W, topH + PH + 3 * GAP);
const sc = sheet.getContext("2d");
sc.fillStyle = "#1b1d22";
sc.fillRect(0, 0, sheet.width, sheet.height);
const x0 = (W - topW) / 2;
cells.forEach((t, n) => {
  const c = createCanvas(t.im.w, t.im.h);
  c.getContext("2d").putImageData({ width: t.im.w, height: t.im.h, data: t.im.data }, 0, 0);
  sc.drawImage(c, x0 + (n % PER_ROW) * CW + (CW - t.im.w) / 2, Math.floor(n / PER_ROW) * CH + (CH - t.im.h));
});
shots.forEach((s, i) => sc.putImageData(s, GAP + i * (PW + GAP), topH + 2 * GAP));
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, encodePNG(sheet));

// ---- the numbers ------------------------------------------------------------
const rows = massShares();
console.log(`skyline sheet: 4 families × 6 plans at 2×, and ${lots} lots through the renderer at zoom 1 and 2 (${changed} draw plan 0 or 1)`);
console.log("\nfamily            fill   deck   plans that are one box with a lid (fill >= 0.95, deck < 8%)");
for (const [z, t] of FAMILIES) {
  const fam = rows.filter((m) => m.name.startsWith(`${z}${t}-`));
  const mean = (k) => fam.reduce((s, m) => s + m[k], 0) / fam.length;
  const one = fam.filter(isOneBox).map((m) => m.name);
  console.log(`  ${`${z}${t}`.padEnd(15)} ${mean("fill").toFixed(2)}  ${(100 * mean("deck")).toFixed(1).padStart(5)}%  ${one.length ? one.join(", ") : "none"}`);
}
console.log(`\n${rows.filter(isOneBox).length} of ${rows.length} zoned plans are one box with a lid (\`node tools/massprobe.mjs\` names them)`);
console.log(`wrote ${OUT}`);
