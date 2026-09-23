#!/usr/bin/env node
// tools/window-sheet.mjs — WHAT A WINDOW IS NOW, ON ONE RIG. SPEC §12.5.
//
//   node tools/window-sheet.mjs                     docs/shots/sheet-windows.png
//   node tools/window-sheet.mjs --zoom 2 --out …
//
// T3.1's A/B, and the instrument the taste constants in building-character.js
// were tuned against. It refuses nothing; it prints numbers and a picture.
//
// TWO BANDS, BECAUSE THE QUESTION IS TWO QUESTIONS.
//
//   the top band   one R facade and one C facade at 4×, across the three light
//                  levels and the three ages. This is the state ART: is a blind
//                  a blind, is a plant a plant, is a boarded pane boarded.
//   the bottom     the SAME street through the real renderer at zoom 1 and
//                  zoom 2, by day and at dusk. This is the only question that
//                  matters for the game: at the zoom it is played at, do the
//                  states read as a city of different windows, or as noise?
//
// It prints the share of pane pixels each state owns at each zoom, because
// "some windows have blinds" is not a number you can tune a duty cycle
// against, and the 1× row is where a sub-pixel pattern goes to die.

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

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const OUT = resolve(ROOT, arg("--out", "docs/shots/sheet-windows.png"));

// The keys a pane may hold, SPELT OUT — this tool is the instrument, and an
// instrument that imports the module's own list measures the list, not the city.
const STATE = {
  "light":   ["-"],
  "blind":   ["S", "R", "Q", "P"],
  "plant":   ["d", "b"],
  "board":   ["M", "L", "<"],
  "glass":   ["=", "H"],
};
const stateOf = (ink) => Object.keys(STATE).find(s => STATE[s].includes(ink)) || null;

// ---- the top band: two facades, three light levels, three ages, at 4× -------
const CASES = [];
for (const [label, spec] of [["R 3×3", ["R", 3, 3, 0]], ["C 3×3", ["C", 3, 5, 0]]])
  for (const wear of [0, 1, 2]) for (const lit of [0, 1, 2, 3])
    CASES.push({ label: `${label} lit ${lit} wear ${wear}`, lit, wear, spec });

const tiles = CASES.map(c => {
  const s = art.building(...c.spec, 0, { lit: c.lit, majority: 1, seed: 9, wear: c.wear });
  const hi = art.hires(s, 4) || s;
  return { ...c, sprite: hi, im: rasterize(hi.rows) };
});
const CW = Math.max(...tiles.map(t => t.im.w)) + 12, CH = Math.max(...tiles.map(t => t.im.h)) + 12;
const COLS = 12; // four light levels × three ages, one facade per row-pair

// ---- the bottom band: the real renderer, one street -------------------------
// A DENSE BLOCK, NOT A ROW OF FIVE. The question this band answers is the only
// one that decides whether T3.1 ships as built — at the zoom the game is played
// at, do the states read as a city of different windows, or as noise? A row of
// five facades on a lawn cannot answer it; forty small buildings packed between
// two roads can. They are tier 1 and 2 (one tile and four) because that is what
// most of a city is, every one of them full, and their ages run the whole range
// so the oldest streets lose windows and the newest do not.
const world = createWorld({ seed: "window-sheet" });
world.tick = 400;
const put = (tx, ty, zone, tier, months) => {
  const i = ty * world.w + tx;
  world.zone[i] = zone; world.tier[i] = tier; world.variant[i] = (tx * 7 + ty * 13) & 255;
  const cap = capacityOf(world, i) || 1;
  world.occupants[i] = cap; world.staff[i] = cap;
  if (world.since) world.since[i] = Math.max(1, world.tick - months + 1);
};
const ZONES = [ZONE.R, ZONE.R, ZONE.C, ZONE.R, ZONE.I, ZONE.C];
for (let t = 3; t < 20; t++) { world.road[10 * world.w + t] = ROAD.ROAD; world.road[15 * world.w + t] = ROAD.ROAD; }
for (let ty = 5; ty <= 20; ty++) for (let tx = 4; tx <= 19; tx++) {
  if (ty === 10 || ty === 15) continue;
  const n = tx * 3 + ty * 5;
  if (n % 7 === 0) { world.terrain[ty * world.w + tx] = TERRAIN.TREE; continue; }
  put(tx, ty, ZONES[n % ZONES.length], 1 + (n % 5 === 0 ? 1 : 0), (n % 5) * 90);
}

const PW = 900, PH = 300;
const panel = createCanvas(PW, PH);
const r = createRenderer(panel, world, art);
r.resize();
const shots = [];
for (const [zoom, dusk] of [[1, 0], [2, 0], [2, 1]]) {
  r.setDusk(dusk);
  r.draw({ x: 0, y: 372, zoom }, null, null, "off", 0);
  shots.push({ label: `renderer · zoom ${zoom}${dusk ? " · dusk" : ""}`, data: panel.getContext("2d").getImageData(0, 0, PW, PH) });
}

// ---- lay it out -------------------------------------------------------------
const GAP = 8;
const topH = 2 * Math.ceil(CASES.length / 2 / COLS) * CH;
const W = Math.max(COLS * CW, shots.length * (PW + GAP) + GAP);
const sheet = createCanvas(W, topH + shots.length * 0 + PH + 3 * GAP);
const sc = sheet.getContext("2d");
sc.fillStyle = "#1b1d22";
sc.fillRect(0, 0, sheet.width, sheet.height);
tiles.forEach((t, n) => {
  const col = n % COLS, row = Math.floor(n / COLS);
  const c = createCanvas(t.im.w, t.im.h);
  c.getContext("2d").putImageData({ width: t.im.w, height: t.im.h, data: t.im.data }, 0, 0);
  sc.drawImage(c, col * CW + (CW - t.im.w) / 2, row * CH + (CH - t.im.h) / 2);
});
shots.forEach((s, i) => sc.putImageData(s.data, GAP + i * (PW + GAP), topH + 2 * GAP));
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, encodePNG(sheet));

// ---- the numbers ------------------------------------------------------------
console.log(`window sheet: ${CASES.length} close-ups at 4×, ${shots.length} renderer panels`);
console.log(`\nWHAT SHARE OF A FACADE'S PANE PIXELS EACH STATE OWNS (one R 3×3, lit 3, by scale)`);
// Counted ONLY where the bare plan painted glass. Tallying the whole sprite
// instead credits every slate wall to the boards (both hold the dark rung) and
// every fabric awning to the blinds — the first reading of this table said 4.3%
// of a brand-new building was boarded up.
for (const wear of [0, 2]) {
  // The reference carries the SAME species stamp: a stamp grows the recipe's
  // extent, so a bare plan and a marked one do not share a raster to index into.
  const bareBase = art.building("R", 3, 3, 0, 0, { lit: 0, majority: 1, seed: 9 });
  for (const scale of [1, 2, 4]) {
    const s = art.building("R", 3, 3, 0, 0, { lit: 3, majority: 1, seed: 9, wear });
    const bare = scale === 1 ? bareBase : art.hires(bareBase, scale), sprite = scale === 1 ? s : art.hires(s, scale);
    const tally = new Map();
    for (let y = 0; y < bare.h; y++) for (let x = 0; x < bare.w; x++) {
      if (!STATE.glass.includes(bare.rows[y][x])) continue;
      const st = stateOf(sprite.rows[y]?.[x]);
      if (st) tally.set(st, (tally.get(st) || 0) + 1);
    }
    const total = [...tally.values()].reduce((a, b) => a + b, 0) || 1;
    const parts = Object.keys(STATE).map(k => `${k} ${String(tally.get(k) || 0).padStart(5)} (${((100 * (tally.get(k) || 0)) / total).toFixed(1).padStart(4)}%)`);
    console.log(`  wear ${wear}  ${scale}×  ${parts.join("  ")}`);
  }
}
console.log(`\nHOW MANY WINDOW CELLS CARRY A FIXTURE, over every glazed plan`);
{
  const { RECIPES } = await import("../js/art/solid.js");
  const { allBuildings } = await import("../js/art/buildings.js");
  const { allBlocks } = await import("../js/art/blocks.js");
  const { allShops } = await import("../js/art/shops.js");
  const { characterSprite } = await import("../js/art/building-character.js");
  const bases = [...new Set([...allBuildings(), ...allBlocks(), ...allShops()].map(x => x.sprite).filter(s => s.tags.includes("building")))];
  const tally = new Map();
  let cells = 0;
  for (const base of bases) {
    const bare = RECIPES.get(base)?.boxes;
    if (!bare) continue;
    const lit = RECIPES.get(characterSprite(base, { lit: 3, seed: 27, wear: 2 })).boxes;
    for (let i = 0; i < lit.length; i++) {
      if (!lit[i].faces.glazing) continue;
      for (const face of ["side", "end"]) {
        const fn = lit[i].faces[face], was = bare[i].faces[face];
        if (typeof fn !== "function" || typeof was !== "function") continue;
        const uMax = face === "side" ? lit[i].a1 - lit[i].a0 : lit[i].b1 - lit[i].b0, seen = new Map();
        for (let u = 0.25; u < uMax; u += 0.5) for (let k = 0.25; k < lit[i].c1 - lit[i].c0; k += 0.5) {
          if (!["=", "H"].includes(was(u, k, 0, 0))) continue;
          const cell = `${Math.floor(u / 2)},${Math.floor(k / 3)}`;
          if (!seen.has(cell)) seen.set(cell, new Set());
          seen.get(cell).add(stateOf(fn(u, k, 0, 0)));
        }
        for (const [, states] of seen) {
          cells++;
          const worst = ["board", "plant", "blind", "light", "glass"].find(s => states.has(s)) || "glass";
          tally.set(worst, (tally.get(worst) || 0) + 1);
        }
      }
    }
  }
  for (const [k, v] of [...tally].sort((a, b) => b[1] - a[1]))
    console.log(`  ${k.padEnd(6)} ${String(v).padStart(6)} cells  ${((100 * v) / cells).toFixed(1)}%`);
  console.log(`  ${"total".padEnd(6)} ${String(cells).padStart(6)} cells`);
}
console.log(`\nwrote ${OUT} (${sheet.width}×${sheet.height})`);
