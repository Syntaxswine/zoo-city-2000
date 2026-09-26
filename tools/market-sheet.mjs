#!/usr/bin/env node
// tools/market-sheet.mjs — THE MEAT MARKET'S SEVEN STAGES, ON ONE RIG. SPEC §12.5;
// docs/PROPOSAL-MEAT-MARKET-2026-09-26.md A.9.
//
//   node tools/market-sheet.mjs                          docs/shots/market-stages.png
//   node tools/market-sheet.mjs --before <tree>          + docs/shots/market-before-after.png
//   node tools/market-sheet.mjs --out …
//
// A market's sprites are its GROWTH — the site, one stall, three, six, the full
// square, the hall, the exchange — so the only question the art has to answer is
// whether a player at the zoom the game is played at can SEE which stage a
// market has reached. This stands all seven in a row on grass, each on its road
// stub (its front, +ty, faces the road as a placed market's does), and
// photographs them through the REAL renderer — js/render.js through
// tools/headless-canvas.mjs, the hi-res twin at zoom 2 as in the browser — by
// day at zoom 1 and 2, and at dusk at zoom 1.
//
// --before <tree> draws another checkout's markets on the same rig in the same
// process, above this tree's: two trees, one process, the only way a "before"
// survives a recipe change. An instrument: it refuses nothing.

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { installCanvas, createCanvas, encodePNG } from "./headless-canvas.mjs";

installCanvas();

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const BEFORE = arg("--before", null);
const OUT = resolve(ROOT, arg("--out", "docs/shots/market-stages.png"));

/** The seven stages of one tree, photographed: [{ label, canvas }] for zoom 1, zoom 2 and dusk. */
async function photograph(tree) {
  const u = (p) => pathToFileURL(resolve(tree, p)).href;
  const { createWorld, CIVIC } = await import(u("js/sim/world.js"));
  const { apply } = await import(u("js/sim/ops.js"));
  const { createRenderer } = await import(u("js/render.js"));
  const { createWalkers } = await import(u("js/walkers.js"));
  const { art } = await import(u("js/art/index.js"));
  const { toScreen, HALF_H } = await import(u("js/iso/iso.js"));
  const world = createWorld({ seed: "market-sheet", w: 64, h: 64 });
  world.terrain.fill(0);
  world.cash = 1e6;
  // One market a stage, marching along screen-horizontal (+tx, −ty), each with its road in front.
  for (let stage = 0; stage < 7; stage++) {
    const tx = 6 + 4 * stage, ty = 34 - 4 * stage;
    const road = apply(world, { kind: "road", tiles: [0, 1, 2].map((d) => (ty + 3) * world.w + tx + d) });
    const placed = apply(world, { kind: "market", tx, ty, density: stage >= 5 ? 3 : 1 });
    const a = ty * world.w + tx;
    if (!road.ok || !placed.ok || world.civic[a] !== CIVIC.MARKET) throw Error(`stage ${stage}: ${road.reason || placed.reason || "no market at the anchor"}`);
    world.tier[a] = stage; // the stage is the anchor's tier; the renderer draws the sprite of it
  }
  const out = [];
  for (const [label, zoom, dusk] of [["zoom 1", 1, false], ["zoom 2", 2, false], ["dusk, zoom 1", 1, true]]) {
    const canvas = createCanvas(zoom === 1 ? 1900 : 3800, zoom === 1 ? 170 : 340);
    const renderer = createRenderer(canvas, world, art);
    renderer.setShadows(true);
    if (dusk) renderer.setDusk(1);
    const walkers = createWalkers(world);
    const [sx, sy] = toScreen(19.5, 23.5);
    walkers.update(0, renderer.viewportTiles());
    renderer.draw({ x: sx, y: sy + HALF_H, zoom }, null, walkers, null, 0);
    out.push({ label, canvas });
  }
  return out;
}

/**
 * Stack labelled frames on the page colour. A frame wider than the page is cut into full-resolution strips, one
 * under the next — never scaled: a zoom-2 frame halved to fit is the zoom-1 picture again, and the twin's detail is
 * what it is there to show. (Labels keep to the headless canvas's font: letters, digits and / ? . , ' - — no colon, no brackets.)
 */
function stack(bands, width = 1900) {
  const LABEL = 20;
  const strips = bands.flatMap(({ label, canvas }) => {
    const n = Math.ceil(canvas.width / width);
    return Array.from({ length: n }, (_, k) => ({ label: n > 1 ? `${label}, ${k + 1} of ${n}` : label, canvas, x0: k * width, w: Math.min(width, canvas.width - k * width) }));
  });
  const h = strips.reduce((s, d) => s + LABEL + d.canvas.height + 6, 6);
  const page = createCanvas(width, h);
  const ctx = page.getContext("2d");
  ctx.fillStyle = "#dedac5"; ctx.fillRect(0, 0, width, h);
  let y = 6;
  for (const d of strips) {
    ctx.fillStyle = "#30332d"; ctx.font = "12px monospace"; ctx.fillText(d.label, 8, y + 7); // the font's y is the glyph's TOP, seven rows tall
    y += LABEL;
    ctx.putImageData(d.canvas.getContext("2d").getImageData(d.x0, 0, d.w, d.canvas.height), 0, y);
    y += d.canvas.height + 6;
  }
  return page;
}

mkdirSync(dirname(OUT), { recursive: true });
const after = await photograph(ROOT);
writeFileSync(OUT, encodePNG(stack(after.map((f) => ({ ...f, label: `the seven stages - site, 1 stall, 3, 6, the square, the hall, the exchange - ${f.label}` })))));
console.log(`wrote ${OUT}`);
if (BEFORE) {
  const before = await photograph(resolve(BEFORE));
  const file = resolve(dirname(OUT), "market-before-after.png");
  const pick = (frames, tag) => frames.filter((f) => f.label !== "dusk, zoom 1").map((f) => ({ ...f, label: `${tag} - ${f.label}` }));
  writeFileSync(file, encodePNG(stack([...pick(before, "before"), ...pick(after, "after")])));
  console.log(`wrote ${file}`);
}
