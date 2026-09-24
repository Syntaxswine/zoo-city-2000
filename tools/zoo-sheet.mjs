#!/usr/bin/env node
// tools/zoo-sheet.mjs — THE ANIMALS, ON ONE RIG. SPEC §12.3, Tier 4.
//
//   node tools/zoo-sheet.mjs             docs/shots/sheet-zoo.png
//   node tools/zoo-sheet.mjs --out …
//
// Tier 4's picture. It refuses nothing (tools/check-animals.mjs is the gate);
// it prints the readings from tools/zooprobe.mjs and draws three bands:
//
//   the top band     the fourteen, adult, facing SE, on grass and on the road,
//                    at 1× magnified four times: the coats
//   the middle band  each species in its four coats — adult, adult shaded,
//                    elder, elder shaded — the looks that used to go flat
//   the bottom band  a crowd of every species in every look, facing and
//                    stride, staged on an open field with a road across it
//                    and drawn by the REAL renderer — shadows, zoom-2 twins
//                    and all — at zoom 1 and zoom 2. The only question the
//                    coats answer: at the zoom the game is played at, is this
//                    fourteen animals or one?

import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { installCanvas, createCanvas, encodePNG } from "./headless-canvas.mjs";

installCanvas();

const { createWorld, ROAD } = await import("../js/sim/world.js");
await import("../js/sim/ops.js");
await import("../js/sim/tick.js");
const { createRenderer } = await import("../js/render.js");
const { art } = await import("../js/art/index.js");
const { rasterize } = await import("../js/art/format.js");
const { GRASS } = await import("../js/art/terrain.js");
const { ROADS, E, W } = await import("../js/art/roads.js");
const { SPECIES_IDS, COATS } = await import("../js/art/citizens.js");
const { openField } = await import("./groundprobe.mjs");
const { zooReadings } = await import("./zooprobe.mjs");

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const OUT = resolve(ROOT, arg("--out", "docs/shots/sheet-zoo.png"));

// ---- a small blitter onto an RGBA buffer -------------------------------------------
function paper(w, h, rgb = [28, 29, 34]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { data[4 * i] = rgb[0]; data[4 * i + 1] = rgb[1]; data[4 * i + 2] = rgb[2]; data[4 * i + 3] = 255; }
  return { w, h, data };
}
function blit(dst, src, x0, y0, k = 1) {
  for (let y = 0; y < src.h * k; y++) for (let x = 0; x < src.w * k; x++) {
    const s = (((y / k) | 0) * src.w + ((x / k) | 0)) * 4;
    if (src.data[s + 3] === 0) continue;
    const dx = x0 + x, dy = y0 + y;
    if (dx < 0 || dy < 0 || dx >= dst.w || dy >= dst.h) continue;
    const d = (dy * dst.w + dx) * 4;
    dst.data[d] = src.data[s]; dst.data[d + 1] = src.data[s + 1]; dst.data[d + 2] = src.data[s + 2]; dst.data[d + 3] = 255;
  }
}
const at = (dst, sprite, x, y, k) => blit(dst, rasterize(sprite.rows), x - sprite.anchor[0] * k, y - sprite.anchor[1] * k, k);

// ---- the top two bands: the sprites, ×4 --------------------------------------------
const K = 4, COL = 30;
const n = SPECIES_IDS.length;
const band = (rowsSpec) => {
  const b = paper(n * COL * K + 16, rowsSpec.length * 30 * K + 16);
  rowsSpec.forEach((r, row) => {
    const y = 8 + (row * 30 + 26) * K;
    SPECIES_IDS.forEach((sp, i) => {
      const x = 8 + (i * COL + COL / 2) * K;
      if (r.ground) at(b, r.ground, x, y - 2 * K, K);
      at(b, art.citizen(sp, r.facing || "se", 0, r.age || "adult", { look: r.look || { shade: 0, mark: 0 } }), x, y, K);
    });
  });
  return b;
};
const coats = band([{ ground: GRASS[0] }, { ground: ROADS[0][E | W] }]);
const looks = band([
  { look: { shade: 0, mark: 0 } }, { look: { shade: 1, mark: 0 } },
  { age: "elder", look: { shade: 0, mark: 0 } }, { age: "elder", look: { shade: 1, mark: 0 } },
]);

// ---- the bottom band: a crowd, through the real renderer ---------------------------
const world = openField(createWorld, { seed: "zoo-sheet" });
const ROW = 22;
for (let tx = 8; tx < 40; tx++) world.road[ROW * world.w + tx] = ROAD.ROAD;
world.roadsDirty = true;
let seed = 1234567;
const rnd = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
const crowd = [];
for (let k = 0; k < 84; k++) {
  const sp = SPECIES_IDS[k % n];
  const tx = 18 + rnd() * 8, ty = 17 + rnd() * 9;
  const r = rnd();
  crowd.push({ id: -1 - k, kind: "commuter", species: sp, tx, ty,
    facing: ["se", "ne", "sw", "nw"][Math.floor(rnd() * 4)], frame: Math.floor(rnd() * 4),
    age: r < 0.14 ? "elder" : r < 0.26 ? "cub" : "adult", look: { shade: rnd() < 0.5 ? 1 : 0, mark: rnd() < 0.5 ? 1 : 0 } });
}
const PW = 560, PH = 300;
// Zoom 2 is shot on a canvas twice the size, so both frames hold the same
// patch of ground and draw an animal the same size on the sheet: zoom 1
// magnified ×2 beside zoom 2's own twins at ×1.
const shoot = (zoom) => {
  const w = PW * zoom, h = PH * zoom;
  const canvas = createCanvas(w, h);
  const r = createRenderer(canvas, world, art);
  r.resize();
  r.draw({ x: (22 - 21.5) * 32, y: (22 + 21.5) * 16, zoom }, null, { list: () => crowd }, "off", 0);
  const img = canvas.getContext("2d").getImageData(0, 0, w, h);
  return { w, h, data: img.data };
};
const z1 = shoot(1), z2 = shoot(2);

// ---- compose ------------------------------------------------------------------------
const GAP = 12;
const Wd = Math.max(coats.w, looks.w, 2 * PW + 16);
const Hd = coats.h + looks.h + 4 * PH + 4 * GAP;
const sheet = paper(Wd, Hd);
blit(sheet, coats, 0, 0);
blit(sheet, looks, 0, coats.h + GAP);
const yCrowd = coats.h + looks.h + 2 * GAP;
blit(sheet, z1, 8, yCrowd, 2);
blit(sheet, z2, 8, yCrowd + 2 * PH + GAP);
const png = encodePNG({ width: sheet.w, height: sheet.h, _data: sheet.data });
writeFileSync(OUT, png);

const R = zooReadings();
console.log(`wrote ${OUT} (${sheet.w}×${sheet.h})`);
console.log(`bands: the fourteen on grass and road ×4 · adult, adult shaded, elder, elder shaded ×4 · a crowd of ${crowd.length} through the real renderer, zoom 1 (×2) and zoom 2`);
console.log(`coats: ${SPECIES_IDS.map((sp) => `${sp} ${COATS[sp][0]}${COATS[sp][1] >= 0 ? "+" : ""}${COATS[sp][1]}`).join(" · ")}`);
console.log(`zooprobe: ${R.distinct} distinct coats · flat ${R.flat.length} · one animal ${R.oneAnimal.length} · one animal in two coats ${R.twoCoats.length} (${R.twoCoats.map((p) => p.a + "/" + p.b).join(", ")}) · close figures on one ramp ${R.closeOnOneRamp.length}`);
