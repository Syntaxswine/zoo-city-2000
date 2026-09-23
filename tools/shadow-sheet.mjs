#!/usr/bin/env node
// tools/shadow-sheet.mjs — THE SHADOW A/B, ON ONE RIG. SPEC §12.5.
//
//   node tools/shadow-sheet.mjs                      docs/shots/sheet-shadows.png
//   node tools/shadow-sheet.mjs --k 0,0.25,0.55,1.2  the lengths to show
//   node tools/shadow-sheet.mjs --zoom 2 --out …
//
// One town, one camera, one process: the leftmost panel is the renderer with
// shadows OFF — the dynamic pass exactly as it stood before 2026-09-22 — and
// each panel to its right is the SAME frame at a different SHADOW_K. Nothing
// but the knob moves between them, so the comparison is a comparison and not
// two screenshots of two towns.
//
// It prints the changed-pixel count per panel beneath the picture, because a
// render upgrade that cannot be seen in a frame did not happen, and one that
// cannot be counted cannot be argued about (the proposal's §5 Q1).

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { installCanvas, createCanvas, encodePNG } from "./headless-canvas.mjs";

installCanvas();

const { createWorld, ZONE, TERRAIN, ROAD } = await import("../js/sim/world.js");
await import("../js/sim/ops.js");
await import("../js/sim/tick.js");
const { createRenderer } = await import("../js/render.js");
const { art } = await import("../js/art/index.js");

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const KS = String(arg("--k", "0,0.25,0.55,1.2")).split(",").map(Number);
const ZOOM = Number(arg("--zoom", 2));
const OUT = resolve(ROOT, arg("--out", "docs/shots/sheet-shadows.png"));
const PW = Number(arg("--width", 420)), PH = Number(arg("--height", 300));

// A street with one of everything that stands: a cottage, a terrace, a tower,
// a works, a run of trees, and a road for them to throw across.
const world = createWorld({ seed: "shadow-sheet" });
const put = (tx, ty, zone, tier) => {
  const i = ty * world.w + tx;
  world.zone[i] = zone; world.tier[i] = tier; world.variant[i] = (tx * 7 + ty * 13) & 255;
};
for (let t = 3; t < 22; t++) world.road[11 * world.w + t] = ROAD.ROAD;
put(6, 9, ZONE.R, 1); put(9, 9, ZONE.R, 3); put(12, 9, ZONE.C, 3); put(15, 9, ZONE.I, 2); put(18, 9, ZONE.C, 1);
for (let t = 5; t < 20; t += 4) world.terrain[13 * world.w + t] = TERRAIN.TREE;

const panel = createCanvas(PW, PH);
const r = createRenderer(panel, world, art);
r.resize();
const camera = { x: 60, y: 330, zoom: ZOOM };
const grab = () => {
  r.draw(camera, null, null, "off");
  return panel.getContext("2d").getImageData(0, 0, PW, PH);
};

r.setShadows(false);
const off = grab();
const frames = [{ label: "no shadows", data: off, changed: 0 }];
for (const k of KS) {
  r.setShadows(true, { k });
  const img = grab();
  let changed = 0;
  for (let i = 0; i < off.data.length; i += 4) {
    if (off.data[i] !== img.data[i] || off.data[i + 1] !== img.data[i + 1] || off.data[i + 2] !== img.data[i + 2]) changed++;
  }
  frames.push({ label: `k = ${k}`, data: img, changed });
}

const GAP = 8;
const sheet = createCanvas(frames.length * PW + (frames.length + 1) * GAP, PH + 2 * GAP);
const sc = sheet.getContext("2d");
sc.fillStyle = "#1b1d22";
sc.fillRect(0, 0, sheet.width, sheet.height);
frames.forEach((f, i) => sc.putImageData(f.data, GAP + i * (PW + GAP), GAP));
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, encodePNG(sheet));

const px = PW * PH;
console.log(`shadow sheet: one town, one camera, ${frames.length} panels at zoom ${ZOOM}`);
for (const f of frames) {
  console.log(`  ${f.label.padEnd(12)} ${String(f.changed).padStart(7)} px changed from the no-shadow frame  (${((100 * f.changed) / px).toFixed(2)}% of the panel)`);
}
console.log(`wrote ${OUT} (${sheet.width}×${sheet.height})`);
