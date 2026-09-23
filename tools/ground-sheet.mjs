#!/usr/bin/env node
// tools/ground-sheet.mjs — THE GROUND, ON ONE RIG. SPEC §12.4, T3.3.
//
//   node tools/ground-sheet.mjs             docs/shots/sheet-ground.png
//   node tools/ground-sheet.mjs --out …
//
// T3.3's picture. It refuses nothing (tools/check-ground.mjs is the gate); it
// prints the readings from tools/groundprobe.mjs and draws four bands:
//
//   the top band     the 31 corner combinations a tile can hold, at 2×, in
//                    dither 0 — kept, meadow and rough (grass-0, -1, -2) on
//                    their corners, and every way two neighbouring levels meet
//   the middle band  an open field through the REAL renderer at zoom 1 and
//                    zoom 2: the land as it grows when nothing is made on it
//   the town band    the edge of a town at zoom 2 and zoom 1: roads, lots, a
//                    park, three clumps of trees out in the meadow, and the
//                    kept grass the city holds round everything it has made,
//                    grading out to the meadow
//   the bottom band  a station set three tiles back from its road, at zoom 2:
//                    the path its riders wear across the forecourt — trodden
//                    at three riders, worn bare at six. The only grass in the
//                    game a walk crosses

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { installCanvas, createCanvas, encodePNG } from "./headless-canvas.mjs";

installCanvas();

const { createWorld, ZONE, ROAD, CIVIC, TERRAIN, capacityOf } = await import("../js/sim/world.js");
const { apply } = await import("../js/sim/ops.js");
const { computeFields, commutePath, computeTraffic } = await import("../js/sim/fields.js");
await import("../js/sim/tick.js");
const { createRenderer } = await import("../js/render.js");
const { art } = await import("../js/art/index.js");
const { rasterize } = await import("../js/art/format.js");
const { meadowField, wornPaths } = await import("../js/meadow.js");
const { openField, keptBytes, groundReadings, quiltArt, PANEL } = await import("./groundprobe.mjs");

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const OUT = resolve(ROOT, arg("--out", "docs/shots/sheet-ground.png"));

// ---- the top band: every corner combination, at 2× ---------------------------------
const combos = [];
for (let n = 0; n < 81; n++) {
  const c = [n % 3, ((n / 3) | 0) % 3, ((n / 9) | 0) % 3, ((n / 27) | 0) % 3];
  if (Math.max(...c) - Math.min(...c) <= 1) combos.push(c);
}
const tiles = combos.map((c) => rasterize(art.hires(art.meadow(c, 0), 2).rows));
const TW = 128 + 8, TH = 64 + 8, PER_ROW = 12;

// ---- the middle band: an open field ------------------------------------------------
const PW = 820, PH = 330;
const shoot = (world, camera) => {
  const canvas = createCanvas(PW, PH);
  const r = createRenderer(canvas, world, art);
  r.resize();
  r.draw(camera, null, null, "off", 0);
  return canvas.getContext("2d").getImageData(0, 0, PW, PH);
};
const field = openField(createWorld, { seed: "ground-sheet" });
const centre = ((field.w + field.h) / 2) * 16;
const fieldShots = [1, 2].map((zoom) => shoot(field, { x: 0, y: centre, zoom }));

// ---- the town band: the edge of a town ---------------------------------------------
// Open land, a street grid on its west half with lots and a park on it, and
// three clumps of trees out in the meadow to the east — the camera on the
// town's edge, so the frame holds the city, the kept grass round everything
// it has made, and the meadow that kept grass grades out into.
const town = openField(createWorld, { seed: "ground-sheet-town" });
const at = (tx, ty) => ty * town.w + tx;
for (const [cx, cy] of [[30, 20], [36, 27], [29, 32]]) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((cx + dx + cy + dy) % 2 === 0) town.terrain[at(cx + dx, cy + dy)] = TERRAIN.TREE;
for (let t = 12; t < 30; t++) { town.road[at(t, 22)] = ROAD.ROAD; town.road[at(t, 28)] = ROAD.ROAD; }
for (let t = 18; t < 34; t++) { town.road[at(16, t)] = ROAD.ROAD; town.road[at(24, t)] = ROAD.ROAD; }
town.roadsDirty = true;
for (let ty = 20; ty < 32; ty++) for (let tx = 12; tx < 24; tx++) {
  const i = at(tx, ty);
  if (town.road[i] || town.terrain[i] !== TERRAIN.GRASS) continue;
  if (tx === 20 && ty === 25) { town.civic[i] = CIVIC.PARK; continue; }
  const k = (tx * 7 + ty * 5) % 9;
  if (k === 0) continue; // a garden left open
  town.zone[i] = [ZONE.R, ZONE.R, ZONE.C, ZONE.R, ZONE.C, ZONE.R, ZONE.I, ZONE.R][k - 1];
  town.tier[i] = k === 8 ? 0 : 1 + ((tx + ty) % 2);
  const cap = capacityOf(town, i) || 1;
  town.occupants[i] = cap; town.staff[i] = cap;
}
const [tcx, tcy] = [(25 - 25) * 32, (25 + 25) * 16];
const townShots = [2, 1].map((zoom) => shoot(town, { x: tcx, y: tcy, zoom }));

// ---- the bottom band: a forecourt, walked ------------------------------------------
// check-ground.mjs's fixture: a road, a rail line three tiles off it, a
// station at each end, and a rider's commute from the sim's own commutePath —
// laid on as many riders as the panel says.
const forecourt = (riders) => {
  const w = openField(createWorld, { seed: "ground-sheet-forecourt" });
  const fat = (x, y) => y * w.w + x;
  const road = [], line = [];
  for (let x = 4; x <= 34; x++) road.push(fat(x, 6));
  for (let x = 6; x <= 32; x++) line.push(fat(x, 9));
  apply(w, { kind: "road", tiles: road }); apply(w, { kind: "rail", tiles: line });
  apply(w, { kind: "station", tx: 8, ty: 9 }); apply(w, { kind: "station", tx: 30, ty: 9 });
  computeFields(w);
  const ride = commutePath(w, "rabbit", [fat(6, 6)], [fat(32, 6)]);
  w.citizens = Array.from({ length: riders }, () => ({ path: ride.path }));
  computeTraffic(w);
  return w;
};
const courts = [3, 6].map(forecourt);
const courtShots = courts.map((w) => shoot(w, { x: (8 - 7.5) * 32, y: (8 + 7.5) * 16, zoom: 2 }));

// ---- lay it out ---------------------------------------------------------------------
const GAP = 10;
const topW = PER_ROW * TW, topH = Math.ceil(tiles.length / PER_ROW) * TH;
const W = Math.max(topW, 2 * (PW + GAP) + GAP);
const sheet = createCanvas(W, topH + 3 * PH + 6 * GAP);
const sc = sheet.getContext("2d");
sc.fillStyle = "#1b1d22";
sc.fillRect(0, 0, sheet.width, sheet.height);
const x0 = (W - topW) / 2;
tiles.forEach((im, n) => {
  const c = createCanvas(im.w, im.h);
  c.getContext("2d").putImageData({ width: im.w, height: im.h, data: im.data }, 0, 0);
  sc.drawImage(c, x0 + (n % PER_ROW) * TW + 4, GAP + Math.floor(n / PER_ROW) * TH + 4);
});
fieldShots.forEach((s, i) => sc.putImageData(s, GAP + i * (PW + GAP), topH + 2 * GAP));
townShots.forEach((s, i) => sc.putImageData(s, GAP + i * (PW + GAP), topH + PH + 3 * GAP));
courtShots.forEach((s, i) => sc.putImageData(s, GAP + i * (PW + GAP), topH + 2 * PH + 4 * GAP));
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, encodePNG(sheet));

// ---- the numbers --------------------------------------------------------------------
const F = meadowField(field), T = meadowField(town);
const share = (lv) => { const n = [0, 0, 0]; for (const l of lv) n[l]++; return n.map((k) => `${((100 * k) / lv.length).toFixed(0)}%`).join(" / "); };
console.log(`ground sheet: ${combos.length} corner combinations at 2×, an open field at zoom 1 and 2, a town's edge at zoom 2 and 1, a forecourt trodden and worn at zoom 2`);
console.log(`corners  open field ${share(F.level)} · the town's map ${share(T.level)}   (kept / meadow / rough)`);
console.log(`paths    ${courts.map((w, k) => `${[3, 6][k]} riders: ${[...wornPaths(w).values()].map((e) => `mask ${e.mask} × ${e.walks}`).join(", ")}`).join(" · ")}`);
console.log(`\n${"".padEnd(22)}zoom 1: seam repeat   zoom 2: seam repeat`);
for (const [name, world, a] of [["the field", field, art], ["seamless control", openField(createWorld, { seed: "ground-sheet", bytes: keptBytes }), art], ["the quilt, before", field, quiltArt(art)]]) {
  const canvas = createCanvas(...PANEL);
  const r = createRenderer(canvas, world, a);
  r.resize();
  const cells = [1, 2].map((z) => { const m = groundReadings(r, canvas, world, z, 3); return `${m.seam.toFixed(2).padStart(10)} ${m.repeat.toFixed(1).padStart(6)}`; });
  console.log(`${name.padEnd(22)}${cells.join("   ")}`);
}
console.log(`\nwrote ${OUT}`);
