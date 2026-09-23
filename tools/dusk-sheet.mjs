#!/usr/bin/env node
// tools/dusk-sheet.mjs — THE EVENING A/B, ON ONE RIG. SPEC §12.5.
//
//   node tools/dusk-sheet.mjs                          docs/shots/sheet-dusk.png
//   node tools/dusk-sheet.mjs --amount 0,0.35,0.55,1   the amounts to show
//   node tools/dusk-sheet.mjs --zoom 2 --no-shadows --out …
//
// The other half of the proposal's I3, which shadow-sheet.mjs left for T1.5.
// One town, one camera, one process: the leftmost panel is DAYLIGHT — the
// renderer with `dusk` null, which is the renderer as it stood before
// art/dusk.js — and every panel right of it is the SAME frame at a different
// amount of evening. Nothing but the knob moves between them.
//
// It prints the mean luminance of each panel and the share of it that
// changed, because an evening that cannot be counted cannot be argued about
// and "it looks a bit murky" is not a number you can tune against.
//
// THE MIDDLE PANELS ARE IN IT ON PURPOSE, and they are not pretty. A
// projected evening is not smooth — the palette's rungs are ~25 luminance
// apart, so a middling amount moves the keys that happen to sit near a
// boundary and leaves the rest at noon, and a terracotta roof lands on a rust
// rung and reads as a lamp. That is the argument for the game shipping ONE
// setting (art/dusk.js, DUSK_AMOUNT) and this is the picture of it.

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

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const AMOUNTS = String(arg("--amount", "0.25,0.55,1")).split(",").map(Number);
const ZOOM = Number(arg("--zoom", 2));
const OUT = resolve(ROOT, arg("--out", "docs/shots/sheet-dusk.png"));
const PW = Number(arg("--width", 620)), PH = Number(arg("--height", 320));

// The shadow sheet's street, FULL OF PEOPLE: a cottage, a terrace, a tower, a
// works and a shop, every one of them at lightLevel 3, because the windows
// are half of what an evening is and an empty town cannot show them.
const world = createWorld({ seed: "dusk-sheet" });
const put = (tx, ty, zone, tier) => {
  const i = ty * world.w + tx;
  world.zone[i] = zone; world.tier[i] = tier; world.variant[i] = (tx * 7 + ty * 13) & 255;
  const cap = capacityOf(world, i) || 1;
  world.occupants[i] = cap; world.staff[i] = cap;
};
for (let t = 3; t < 22; t++) world.road[11 * world.w + t] = ROAD.ROAD;
put(6, 9, ZONE.R, 1); put(9, 9, ZONE.R, 3); put(12, 9, ZONE.C, 3); put(15, 9, ZONE.I, 2); put(18, 9, ZONE.C, 1);
for (let t = 5; t < 20; t += 4) world.terrain[13 * world.w + t] = TERRAIN.TREE;

const panel = createCanvas(PW, PH);
const r = createRenderer(panel, world, art);
r.resize();
if (argv.includes("--no-shadows")) r.setShadows(false);
const camera = { x: 60, y: 330, zoom: ZOOM };
const grab = () => {
  r.draw(camera, null, null, "off");
  return panel.getContext("2d").getImageData(0, 0, PW, PH);
};
const meanLum = (d) => {
  let s = 0;
  for (let i = 0; i < d.data.length; i += 4) s += 0.2126 * d.data[i] + 0.7152 * d.data[i + 1] + 0.0722 * d.data[i + 2];
  return (4 * s) / d.data.length;
};

r.setDusk(0);
const day = grab();
const frames = [{ label: "daylight", data: day, changed: 0 }];
for (const a of AMOUNTS) {
  r.setDusk(a);
  const img = grab();
  let changed = 0;
  for (let i = 0; i < day.data.length; i += 4) {
    if (day.data[i] !== img.data[i] || day.data[i + 1] !== img.data[i + 1] || day.data[i + 2] !== img.data[i + 2]) changed++;
  }
  frames.push({ label: `amount ${a}`, data: img, changed });
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
const base = meanLum(day);
console.log(`dusk sheet: one town, one camera, ${frames.length} panels at zoom ${ZOOM}`);
for (const f of frames) {
  const m = meanLum(f.data);
  console.log(`  ${f.label.padEnd(12)} mean luminance ${m.toFixed(1).padStart(6)} (${(m - base >= 0 ? "+" : "")}${(m - base).toFixed(1)})  ${String(f.changed).padStart(7)} px changed  (${((100 * f.changed) / px).toFixed(2)}% of the panel)`);
}
console.log(`wrote ${OUT} (${sheet.width}×${sheet.height})`);
