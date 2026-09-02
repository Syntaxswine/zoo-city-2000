#!/usr/bin/env node
// tools/shots.mjs — LOOK AT THE ART. SPEC §12.5.
//
//   node tools/shots.mjs --sheet          every family → docs/shots/sheet-*.png (zoom 3)
//   node tools/shots.mjs --scene          a 12×12 block through js/iso/painter.js → docs/shots/scene.png (zoom 2)
//   node tools/shots.mjs --sheet --scene  both;  --zoom N overrides
//
// The scene is the DEPTH-SORT PROOF: every building family, the park and the
// zoo, a pond with a bridge, and twenty walkers at fractional positions —
// one behind the tallest tower's side face, one directly in front of it, one
// on a geometric tile seam (tx + ty half-integral) and one on the sort-cell
// boundary (tx + ty integral). It sorts through painter.js, the same file the
// browser renderer will use, so what this PNG shows is what the player gets.
//
// Node built-ins only. `tools/headless-canvas.mjs` is the canvas.

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { installCanvas, createCanvas, encodePNG, zoom as zoomCanvas } from "./headless-canvas.mjs";
import { rasterize } from "../js/art/format.js";
import { art } from "../js/art/index.js";
import { BUILDINGS, PARK, ZOO, FIRE_STATION, POLICE_STATION, PACIFICATION_CENTRE, OVERLAYS } from "../js/art/buildings.js";
import { ROADS, BRIDGES, N, E, S, W, DECK_TOP } from "../js/art/roads.js";
import { WALLS, TUNNELS } from "../js/art/walls.js";
import { RAILS, STATIONS } from "../js/art/rail.js";
import { GRASS, CHALK, CHALK_KEYS, RUBBLE, WATER_TILE, KERB, TREE_LIST, ZOTS, PLAZA, CURSOR, GHOST, waterTint, WATER_FRAMES } from "../js/art/terrain.js";
import { ink } from "../js/art/format.js";
import { citizenSprite, SPECIES_IDS, FACINGS, TENT, HAT, MEETING, SACKS } from "../js/art/citizens.js";
import { paintScene, Z_BUILDING } from "../js/iso/painter.js";
import { toScreen, HALF_H } from "../js/iso/iso.js";

installCanvas();

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "docs", "shots");
mkdirSync(OUT, { recursive: true });

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const argNum = (f, d) => {
  const i = argv.indexOf(f);
  return i === -1 ? d : Number(argv[i + 1]);
};

// ------------------------------------------------------------------ blitting

const RASTER = new Map();
function rasterOf(sprite, tint = null) {
  const key = tint ? `${sprite.name}|${Object.values(tint).join("")}` : sprite.name;
  let c = RASTER.get(key);
  if (c) return c;
  const img = rasterize(sprite.rows, tint);
  c = createCanvas(img.w, img.h);
  c.getContext("2d").putImageData({ width: img.w, height: img.h, data: img.data }, 0, 0);
  RASTER.set(key, c);
  return c;
}
function blit(ctx, sprite, sx, sy, tint = null) {
  ctx.drawImage(rasterOf(sprite, tint), sx, sy);
}
/** Draw a sprite so its anchor lands on (x, y). */
function blitAt(ctx, sprite, x, y, tint = null) {
  blit(ctx, sprite, x - sprite.anchor[0], y - sprite.anchor[1], tint);
}
function save(name, canvas, z) {
  const path = resolve(OUT, name);
  writeFileSync(path, encodePNG(z > 1 ? zoomCanvas(canvas, z) : canvas));
  console.log(`wrote ${path} (${canvas.width}×${canvas.height} @ ${z}x)`);
  return path;
}
function background(canvas, hex = "#1c1d22") {
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = hex;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  return ctx;
}

// -------------------------------------------------------------------- sheets

/**
 * Lay cells out in a grid. Each cell: { sprite, label, onTile } — onTile
 * puts a grass diamond under the sprite's anchor so a standing thing is seen
 * on the ground it will stand on.
 */
function sheet(name, cells, { cols, cellW, cellH, groundY, z }) {
  const rows = Math.ceil(cells.length / cols);
  const canvas = createCanvas(cols * cellW, rows * cellH);
  const ctx = background(canvas);
  const legend = [];
  cells.forEach((cell, i) => {
    const cx = (i % cols) * cellW + cellW / 2;
    const cy = Math.floor(i / cols) * cellH + groundY;
    if (cell.onTile) blitAt(ctx, GRASS[0], cx, cy);
    blitAt(ctx, cell.sprite, cx, cy, cell.tint || null);
    legend.push(`  [r${Math.floor(i / cols)} c${i % cols}] ${cell.label}`);
  });
  console.log(`${name}:`);
  console.log(legend.join("\n"));
  return save(name, canvas, z);
}

function sheets(z) {
  const out = [];
  // Buildings: 4 zones × 3 tiers × 2 variants (a row per zone: R, C, I, M), then civics and overlays.
  const b = [];
  for (const zone of [1, 2, 3, 4]) for (const tier of [1, 2, 3]) for (const v of [0, 1]) b.push({ sprite: BUILDINGS[zone][tier][v], label: BUILDINGS[zone][tier][v].name, onTile: true });
  out.push(sheet("sheet-buildings.png", b, { cols: 6, cellW: 80, cellH: 100, groundY: 84, z }));

  const c = [
    { sprite: PARK, label: "park", onTile: true },
    { sprite: ZOO, label: "zoo (2×2)", onTile: false },
    { sprite: FIRE_STATION, label: "fire station", onTile: true },
    { sprite: POLICE_STATION, label: "police station", onTile: true },
    { sprite: PACIFICATION_CENTRE, label: "pacification centre", onTile: true },
    { sprite: OVERLAYS.scaffold[0], label: "scaffold (over store)", onTile: true, under: BUILDINGS[2][2][0] },
    { sprite: OVERLAYS.fire[0], label: "fire 0 (over cottage)", onTile: true, under: BUILDINGS[1][1][0], lift: 6 },
    { sprite: OVERLAYS.fire[1], label: "fire 1 (over cottage)", onTile: true, under: BUILDINGS[1][1][0], lift: 6 },
    { sprite: OVERLAYS.flood[0], label: "flood (over grass)", onTile: true },
    { sprite: RUBBLE, label: "rubble", onTile: false },
  ];
  {
    const cols = 5, cellW = 150, cellH = 110, groundY = 90;
    const canvas = createCanvas(cols * cellW, Math.ceil(c.length / cols) * cellH);
    const ctx = background(canvas);
    c.forEach((cell, i) => {
      const cx = (i % cols) * cellW + cellW / 2;
      const cy = Math.floor(i / cols) * cellH + groundY;
      if (cell.onTile) blitAt(ctx, GRASS[0], cx, cy);
      if (cell.under) blitAt(ctx, cell.under, cx, cy);
      blitAt(ctx, cell.sprite, cx, cy - (cell.lift || 0));
      console.log(`  civics [r${Math.floor(i / cols)} c${i % cols}] ${cell.label}`);
    });
    out.push(save("sheet-civics.png", canvas, z));
  }

  // Walls: the 16 joins on grass (mask N=1 E=2 S=4 W=8), then the two tunnels over their roads.
  {
    const cells = [];
    for (let m = 0; m < 16; m++) cells.push({ sprite: WALLS[m], label: `wall mask ${m}`, onTile: true });
    cells.push({ sprite: TUNNELS.ns, label: "tunnel ns (over a N|S road)", onTile: false, under: ROADS[0][N | S] });
    cells.push({ sprite: TUNNELS.ew, label: "tunnel ew (over an E|W road)", onTile: false, under: ROADS[0][E | W] });
    const cols = 6, cellW = 84, cellH = 72, groundY = 52;
    const canvas = createCanvas(cols * cellW, Math.ceil(cells.length / cols) * cellH);
    const ctx = background(canvas);
    cells.forEach((cell, i) => {
      const cx = (i % cols) * cellW + cellW / 2;
      const cy = Math.floor(i / cols) * cellH + groundY;
      if (cell.onTile) blitAt(ctx, GRASS[0], cx, cy);
      if (cell.under) blitAt(ctx, cell.under, cx, cy);
      blitAt(ctx, cell.sprite, cx, cy);
      console.log(`  walls [r${Math.floor(i / cols)} c${i % cols}] ${cell.label}`);
    });
    out.push(save("sheet-walls.png", canvas, z));
  }

  // Rail: the 16 masks, then the two stations over their track.
  {
    const cells = [];
    for (let m = 0; m < 16; m++) cells.push({ sprite: RAILS[m], label: `rail mask ${m}` });
    cells.push({ sprite: STATIONS.ns, label: "station ns (over a N|S track)", under: RAILS[N | S] });
    cells.push({ sprite: STATIONS.ew, label: "station ew (over an E|W track)", under: RAILS[E | W] });
    const cols = 6, cellW = 84, cellH = 72, groundY = 52;
    const canvas = createCanvas(cols * cellW, Math.ceil(cells.length / cols) * cellH);
    const ctx = background(canvas);
    cells.forEach((cell, i) => {
      const cx = (i % cols) * cellW + cellW / 2;
      const cy = Math.floor(i / cols) * cellH + groundY;
      if (cell.under) blitAt(ctx, cell.under, cx, cy);
      blitAt(ctx, cell.sprite, cx, cy);
      console.log(`  rail [r${Math.floor(i / cols)} c${i % cols}] ${cell.label}`);
    });
    out.push(save("sheet-rail.png", canvas, z));
  }

  // Roads: 16 masks plain, 16 busy, 16 bridges (on water).
  const r = [];
  for (let m = 0; m < 16; m++) r.push({ sprite: ROADS[0][m], label: `road ${m} (${maskName(m)})` });
  for (let m = 0; m < 16; m++) r.push({ sprite: ROADS[1][m], label: `road ${m} busy` });
  for (let m = 0; m < 16; m++) r.push({ sprite: BRIDGES[m], label: `bridge ${m}`, water: true });
  {
    const cols = 8, cellW = 72, cellH = 44, groundY = 24;
    const canvas = createCanvas(cols * cellW, Math.ceil(r.length / cols) * cellH);
    const ctx = background(canvas);
    r.forEach((cell, i) => {
      const cx = (i % cols) * cellW + cellW / 2;
      const cy = Math.floor(i / cols) * cellH + groundY;
      if (cell.water) blitAt(ctx, WATER_TILE, cx, cy);
      blitAt(ctx, cell.sprite, cx, cy);
    });
    console.log("sheet-roads: rows 0-1 plain masks 0..15, rows 2-3 busy, rows 4-5 bridges on water; N=1 E=2 S=4 W=8");
    out.push(save("sheet-roads.png", canvas, z));
  }
  // A road run: masks composed as a real network, to see the seams.
  {
    const net = [
      [0, 0, 0, 0, 0],
      [0, 1, 1, 1, 0],
      [0, 1, 0, 1, 0],
      [0, 1, 1, 1, 1],
      [0, 0, 1, 0, 0],
    ];
    const canvas = createCanvas(340, 200);
    const ctx = background(canvas);
    const items = [];
    for (let ty = 0; ty < 5; ty++)
      for (let tx = 0; tx < 5; tx++) {
        const isRoad = (x, y) => y >= 0 && y < 5 && x >= 0 && x < 5 && net[y][x] === 1;
        let sprite;
        if (net[ty][tx]) {
          const mask = (isRoad(tx, ty - 1) ? N : 0) | (isRoad(tx + 1, ty) ? E : 0) | (isRoad(tx, ty + 1) ? S : 0) | (isRoad(tx - 1, ty) ? W : 0);
          sprite = ROADS[ty >= 3 ? 1 : 0][mask];
        } else sprite = GRASS[(tx + ty) % 3];
        items.push({ sprite, tx, ty, kind: "ground" });
      }
    paintScene(items, (sprite, sx, sy) => blit(ctx, sprite, sx + 170, sy + 20));
    out.push(save("sheet-roadnet.png", canvas, z));
  }

  // Terrain: grass ×3, chalk 4×2, rubble, water ×6 cycle frames, kerbs ×4 on grass, trees, zots, glyphs.
  const t = [];
  GRASS.forEach((s, i) => t.push({ sprite: s, label: `grass ${i}` }));
  for (const zone of [1, 2, 3, 4]) CHALK[zone].forEach((s) => t.push({ sprite: s, label: s.name }));
  t.push({ sprite: RUBBLE, label: "rubble" });
  for (let f = 0; f < WATER_FRAMES; f++) t.push({ sprite: WATER_TILE, label: `water frame ${f}`, tint: waterTint(f) });
  // Chalk coverage: how much of each tile is accent vs grass. "Translucent"
  // is a number here — the first round's High tiles measured 65% accent.
  // The R chalk is drawn in grass keys 'p' (line) and 'm' (shade), not in
  // ACCENT '5' (see terrain.js); grass-0 itself is ≈5% 'p', so the R line
  // number carries that floor. The M chalk is ACCENT 'A'.
  for (const zone of [1, 2, 3, 4])
    for (const s of CHALK[zone]) {
      const total = ink(s.rows);
      const [lineKey, shadeKey] = CHALK_KEYS[zone];
      let accent = 0, dark = 0;
      for (const r of s.rows) for (const c of r) { if (c === lineKey) accent++; else if (shadeKey && c === shadeKey) dark++; }
      console.log(`  ${s.name}: line '${lineKey}' ${((100 * accent) / total).toFixed(0)}%${shadeKey ? `, shade '${shadeKey}' ${((100 * dark) / total).toFixed(0)}%` : ""}, grass ${((100 * (total - accent - dark)) / total).toFixed(0)}%`);
    }
  {
    // Water key census + a 3×3 pond at every frame: the seam check.
    const total = ink(WATER_TILE.rows);
    const n = {};
    for (const r of WATER_TILE.rows) for (const c of r) if (c !== ".") n[c] = (n[c] || 0) + 1;
    console.log("  water keys: " + Object.entries(n).map(([k, v]) => `${k} ${((100 * v) / total).toFixed(0)}%`).join(", "));
    const canvas = createCanvas(WATER_FRAMES * 210, 120);
    const ctx = background(canvas);
    for (let f = 0; f < WATER_FRAMES; f++) {
      const items = [];
      for (let ty = 0; ty < 3; ty++) for (let tx = 0; tx < 3; tx++) items.push({ sprite: WATER_TILE, tx, ty, kind: "ground", tint: waterTint(f) });
      paintScene(items, (sprite, sx, sy, item) => blit(ctx, sprite, sx + f * 210 + 100, sy + 10, item.tint));
    }
    console.log("sheet-water: a 3×3 pond at each cycle frame — look along the diamond edges for a phase seam");
    out.push(save("sheet-water.png", canvas, z));
  }
  KERB.forEach((s) => t.push({ sprite: s, label: s.name, onTile: true }));
  t.push({ sprite: CURSOR, label: "cursor", onTile: true }, { sprite: GHOST, label: "ghost", onTile: true }, { sprite: PLAZA, label: "plaza", onTile: true });
  out.push(sheet("sheet-terrain.png", t, { cols: 8, cellW: 72, cellH: 44, groundY: 24, z }));

  const t2 = [];
  TREE_LIST.forEach((s) => t2.push({ sprite: s, label: s.name, onTile: true }));
  for (const k of Object.keys(ZOTS)) t2.push({ sprite: ZOTS[k], label: `zot ${k}` });
  t2.push({ sprite: TENT, label: "tent", onTile: true }, { sprite: MEETING, label: "meeting" }, { sprite: HAT, label: "hat" });
  out.push(sheet("sheet-trees-zots.png", t2, { cols: 10, cellW: 72, cellH: 60, groundY: 48, z }));

  // Citizens: a row per species; columns = age × facing × frame.
  {
    const cellW = 16, cellH = 30, groundY = 26;
    const cols = 3 * 4 * 3;
    const canvas = createCanvas(cols * cellW + 8, SPECIES_IDS.length * cellH + 4);
    const ctx = background(canvas, "#4d5a30");
    SPECIES_IDS.forEach((species, row) => {
      let col = 0;
      for (const age of ["adult", "elder", "cub"])
        for (const facing of FACINGS)
          for (let frame = 0; frame < 3; frame++) {
            const s = citizenSprite(species, facing, frame, age);
            blitAt(ctx, s, col * cellW + 8 + (age === "adult" ? 0 : age === "elder" ? 2 : 4), row * cellH + groundY);
            col++;
          }
    });
    console.log("sheet-citizens: rows " + SPECIES_IDS.join(", ") + "; columns adult|elder|cub × facing se,ne,sw,nw × frame stand,stepA,stepB");
    out.push(save("sheet-citizens.png", canvas, z));
  }
  // Citizens at scale: row 0 adult SE + NE on grass (the tortoise NE is the
  // elder with the hat); row 1 elder SE + adult SW on asphalt — the
  // mirrored facing and the elder marks, on the other ground they walk on.
  {
    const canvas = createCanvas(SPECIES_IDS.length * 40, 170);
    const ctx = background(canvas);
    SPECIES_IDS.forEach((species, i) => {
      blitAt(ctx, GRASS[0], i * 40 + 20, 44);
      blitAt(ctx, citizenSprite(species, "se", 0, "adult"), i * 40 + 12, 44);
      blitAt(ctx, citizenSprite(species, "ne", 0, species === "tortoise" ? "elder" : "adult", { hat: species === "tortoise" }), i * 40 + 28, 44);
      blitAt(ctx, ROADS[0][N | S], i * 40 + 20, 104);
      blitAt(ctx, citizenSprite(species, "se", 0, "elder"), i * 40 + 12, 104);
      blitAt(ctx, citizenSprite(species, "sw", 0, "adult"), i * 40 + 28, 104);
      blitAt(ctx, GRASS[0], i * 40 + 20, 156);
      blitAt(ctx, citizenSprite(species, "se", 0, "cub"), i * 40 + 12, 156);
      blitAt(ctx, citizenSprite(species, "sw", 0, "cub"), i * 40 + 28, 156);
    });
    console.log("sheet-citizens-close: row 0 adult se | ne on grass; row 1 elder se | adult sw on road; row 2 cub se | cub sw on grass");
    out.push(save("sheet-citizens-close.png", canvas, Math.max(z, 6)));
  }
  // Predation (SPEC §14): the carry on both builds, four facings, three
  // frames; the fall over the neighbour at four heights, the tied sack and
  // its wriggle, the elder tortoise with hat and sack; and the two moments at
  // the door on a road tile — the sack tied 0.32 tiles past the killer, and
  // the walk home.
  {
    const canvas = createCanvas(24 * 16 + 16, 3 * 44 + 8);
    const ctx = background(canvas, "#4d5a30");
    let col = 0;
    for (const species of ["wolf", "fox"])
      for (const facing of FACINGS)
        for (let frame = 0; frame < 3; frame++) {
          blitAt(ctx, citizenSprite(species, facing, frame, "adult", { carry: "sack" }), 12 + col * 16, 40);
          col++;
        }
    const y2 = 84;
    [22, 12, 4, 0].forEach((d, i) => {
      blitAt(ctx, citizenSprite("rabbit", "nw", 0, "adult"), 12 + i * 24, y2);
      blitAt(ctx, SACKS[0], 12 + i * 24, y2 - d);
    });
    blitAt(ctx, SACKS[1], 12 + 4 * 24, y2);
    blitAt(ctx, SACKS[2], 12 + 5 * 24, y2);
    blitAt(ctx, citizenSprite("tortoise", "se", 0, "elder", { hat: true, carry: "sack" }), 12 + 6 * 24, y2);
    blitAt(ctx, citizenSprite("bear", "ne", 1, "adult", { carry: "sack" }), 12 + 7 * 24, y2);
    blitAt(ctx, citizenSprite("cow", "sw", 2, "elder", { carry: "sack" }), 12 + 8 * 24, y2);
    blitAt(ctx, ROADS[0][E | W], 60, 128);
    blitAt(ctx, citizenSprite("wolf", "se", 0, "adult"), 60, 128);
    blitAt(ctx, SACKS[2], 60 + 10, 128 + 5);
    blitAt(ctx, ROADS[0][E | W], 140, 128);
    blitAt(ctx, citizenSprite("wolf", "nw", 1, "adult", { carry: "sack" }), 140, 128);
    blitAt(ctx, ROADS[0][N | S], 220, 128);
    blitAt(ctx, citizenSprite("fox", "sw", 0, "adult"), 220, 128);
    blitAt(ctx, citizenSprite("mouse", "ne", 0, "adult"), 220 - 10, 128 + 5);
    blitAt(ctx, SACKS[0], 220 - 10, 128 + 5 - 12);
    console.log("sheet-predation: row 0 wolf|fox carrying × se,ne,sw,nw × 3 frames; row 1 the fall at 22/12/4/0 px, tied, wriggle, elder tortoise + hat, bear ne, elder cow sw; row 2 at the door (0.32 tiles = 10 px, 5 down): wolf + tied sack, wolf walking home, fox + mouse under the falling sack");
    out.push(save("sheet-predation.png", canvas, Math.max(z, 4)));
  }
  return out;
}

function maskName(m) {
  return [m & N ? "N" : "", m & E ? "E" : "", m & S ? "S" : "", m & W ? "W" : ""].join("") || "-";
}

// --------------------------------------------------------------------- scene

function scene(z) {
  const SIZE = 12;
  const roadRow = (ty) => ty === 2 || ty === 6 || ty === 10;
  const roadCol = (tx) => tx === 2 || tx === 6 || tx === 10;
  const water = new Set(["5,3", "5,4", "6,3", "6,4", "7,3", "7,4"]);
  const isWater = (x, y) => water.has(`${x},${y}`);
  const isRoad = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && (roadRow(y) || roadCol(x));

  // Placements: [tx, ty, sprite, kind]
  const B = (z1, t, v) => BUILDINGS[z1][t][v];
  const placed = [
    [0, 0, B(1, 1, 0)], [1, 0, B(1, 1, 1)], [0, 1, B(1, 2, 0)], [1, 1, B(1, 3, 0)],
    [3, 0, B(2, 1, 0)], [4, 0, B(2, 1, 1)], [5, 0, B(2, 2, 0)], [3, 1, TREE_LIST[0]], [4, 1, PARK], [5, 1, B(2, 2, 1)],
    [7, 0, B(3, 1, 0)], [8, 0, B(3, 1, 1)], [9, 0, B(3, 2, 0)], [7, 1, B(3, 3, 0)], [8, 1, B(3, 2, 1)], [9, 1, TREE_LIST[1]],
    [11, 0, TREE_LIST[2]], [11, 1, B(1, 2, 1)],
    [0, 3, B(1, 3, 1)], [1, 3, TREE_LIST[0]], [0, 4, ZOO],
    [3, 3, TREE_LIST[2]], [3, 5, B(2, 1, 0)], [4, 5, B(2, 2, 0)], [5, 5, B(3, 1, 0)],
    [7, 5, B(2, 3, 0)], [8, 5, B(1, 1, 0)], [9, 5, TREE_LIST[0]], [9, 3, B(3, 3, 1)], [8, 4, B(1, 1, 1)], [9, 4, B(2, 2, 0)],
    [11, 4, TREE_LIST[1]], [11, 5, B(1, 2, 0)],
    [0, 7, B(3, 2, 0)], [1, 7, B(3, 3, 0)], [0, 8, B(3, 1, 1)], [1, 8, PARK], [0, 9, B(1, 3, 0)], [1, 9, B(2, 3, 1)],
    [3, 7, B(1, 2, 1)], [4, 7, B(2, 2, 1)], [5, 7, TREE_LIST[0]], [4, 8, B(1, 1, 0)], [5, 8, B(2, 1, 1)], [3, 9, B(3, 2, 1)], [4, 9, TREE_LIST[2]], [5, 9, B(1, 3, 1)],
    [7, 7, B(1, 3, 0)], [8, 7, B(3, 1, 0)], [9, 7, TREE_LIST[0]], [8, 8, PARK], [9, 8, B(2, 2, 0)], [7, 9, B(2, 3, 1)], [8, 9, B(1, 1, 0)], [9, 9, B(3, 3, 0)],
    [0, 11, TREE_LIST[0]], [1, 11, B(1, 1, 0)], [3, 11, B(2, 1, 0)], [4, 11, B(3, 1, 0)], [5, 11, TREE_LIST[1]], [7, 11, B(1, 2, 0)], [8, 11, B(2, 2, 0)], [9, 11, B(3, 2, 0)], [11, 11, TREE_LIST[0]],
  ];
  const chalk = { "4,3": art.chalk(1, false), "3,4": art.chalk(2, true), "8,3": art.chalk(3, true), "11,7": art.chalk(1, true), "11,8": art.chalk(2, false), "11,9": art.chalk(3, false) };
  const rubble = new Set(["11,3", "4,4"]);

  const items = [];
  // Ground.
  for (let ty = 0; ty < SIZE; ty++)
    for (let tx = 0; tx < SIZE; tx++) {
      const k = `${tx},${ty}`;
      let sprite;
      if (isWater(tx, ty)) {
        if (isRoad(tx, ty)) {
          const mask = (isRoad(tx, ty - 1) ? N : 0) | (isRoad(tx + 1, ty) ? E : 0) | (isRoad(tx, ty + 1) ? S : 0) | (isRoad(tx - 1, ty) ? W : 0);
          items.push({ sprite: WATER_TILE, tx, ty, kind: "ground", tint: waterTint(1) });
          sprite = BRIDGES[mask];
        } else sprite = WATER_TILE;
        items.push({ sprite, tx, ty, kind: "ground", z: sprite === WATER_TILE ? 0 : 1, tint: sprite === WATER_TILE ? waterTint(1) : null });
        continue;
      }
      if (isRoad(tx, ty)) {
        const mask = (isRoad(tx, ty - 1) ? N : 0) | (isRoad(tx + 1, ty) ? E : 0) | (isRoad(tx, ty + 1) ? S : 0) | (isRoad(tx - 1, ty) ? W : 0);
        sprite = ROADS[ty === 6 || tx === 6 ? 1 : 0][mask];
      } else if (rubble.has(k)) sprite = RUBBLE;
      else if (chalk[k]) sprite = chalk[k];
      else sprite = GRASS[(tx * 7 + ty * 3) % 3];
      items.push({ sprite, tx, ty, kind: "ground" });
      // Kerbs on land beside water.
      if (isWater(tx, ty - 1)) items.push({ sprite: KERB[0], tx, ty, kind: "ground", z: 1 });
      if (isWater(tx + 1, ty)) items.push({ sprite: KERB[1], tx, ty, kind: "ground", z: 1 });
      if (isWater(tx, ty + 1)) items.push({ sprite: KERB[2], tx, ty, kind: "ground", z: 1 });
      if (isWater(tx - 1, ty)) items.push({ sprite: KERB[3], tx, ty, kind: "ground", z: 1 });
    }
  items.push({ sprite: OVERLAYS.flood[0], tx: 3, ty: 8, kind: "ground", z: 2 });
  items.push({ sprite: CURSOR, tx: 4, ty: 4, kind: "ground", z: 3 });
  items.push({ sprite: GHOST, tx: 11, ty: 8, kind: "ground", z: 3 });
  items.push({ sprite: PLAZA, tx: 4, ty: 3, kind: "ground", z: 3 });
  // Standing things.
  for (const [tx, ty, sprite] of placed) items.push({ sprite, tx, ty, kind: "building" });
  items.push({ sprite: OVERLAYS.scaffold[0], tx: 9, ty: 4, kind: "building", z: Z_BUILDING + 1 });
  items.push({ sprite: OVERLAYS.fire[0], tx: 8, ty: 4, kind: "building", z: Z_BUILDING + 1, dy: -6 });
  items.push({ sprite: TENT, tx: 4, ty: 3, kind: "building" });
  for (const [tx, ty, kind, lift] of [[8, 5, "noroad", 20], [0, 9, "smog", 40], [3, 7, "nojob", 26], [5, 9, "nodemand", 40]]) {
    items.push({ sprite: ZOTS[kind], tx, ty, kind: "building", z: Z_BUILDING + 2, dy: -lift });
  }

  // Walkers: [tx, ty, species, facing, frame, age, note, laneDx]
  // A lane offset (SPEC §14, ±6 px) moves the sprite, never the key; the two
  // behind the tower carry +6 so their bodies overlap its side face.
  const walkers = [
    [6, 5, "rabbit", "se", 1, "adult", "BEHIND the tallest tower (7,5), lane +6: right half hidden by its side face", 6],
    [6, 4.6, "mouse", "ne", 2, "adult", "behind, up the road, lane +6", 6],
    // THE ROAD IN FRONT OF THE TOWER, laid out so every probe is SEEN.
    // Anything on this road at lane −6 or 0 is hidden by the apartment on
    // (7, 7): the view ray from a walker at (a, b) runs to (a + t, b + t),
    // and from the screen-left lane it enters that 32-px box's eave slab
    // 0.3 px above the walker's head (ray-checked, round 3). Lane +6 clears
    // its east corner. The four are ≥ 12.8 px apart on screen (each sprite
    // is 12 wide) so none paints over another.
    [7.4, 6, "fox", "se", 1, "adult", "DIRECTLY IN FRONT of the tallest tower (feet at a = 7.9, inside its plan), lane +6, 16 px clear of the mouse", 6],
    [8.5, 6, "beaver", "ne", 0, "adult", "geometric tile seam, tx+ty = 14.5, lane +6", 6],
    [8, 6, "owl", "sw", 1, "adult", "front-right of the tower"],
    [6, 6, "bear", "se", 2, "adult", "the crossroads"],
    [2, 4.1, "tortoise", "se", 1, "elder", "beside the zoo's east fence, in the (2, 4.0–4.2) band where the 2×2 key used to win"],
    [2, 5, "raccoon", "sw", 0, "adult", "sort-cell boundary, tx+ty = 7 exactly"],
    [3.5, 2, "rabbit", "ne", 2, "adult", "seam on the north road"],
    [4.25, 2, "mouse", "nw", 1, "elder", ""],
    [10, 3.3, "fox", "se", 1, "cub", ""],
    [10, 7.8, "beaver", "ne", 2, "elder", "with the meeting glyph"],
    [2, 8.4, "owl", "se", 0, "adult", ""],
    [6, 9.2, "bear", "nw", 1, "cub", ""],
    [9.6, 10, "tortoise", "sw", 2, "elder", "centenary hat"],
    [1.3, 10, "raccoon", "se", 1, "adult", ""],
    // Its ears show above the tower's NE roof edge: CORRECT, not a bug — its
    // head (c ≈ 23 with the deck lift) clears the 48-unit wall 1.5 tiles
    // ahead of it (ray-checked in round 2). It reads as "a rabbit inside
    // the roof" only until you notice it is a tile and a half behind.
    [6, 3.5, "rabbit", "ne", 1, "adult", "on the bridge, lifted by DECK_TOP (ears over the tower's roof edge — correct)"],
    // Round 2 had this at lane 0 with the fox at (7, 6): 3 px apart, the fox
    // (key 13.5) wore the mouse's ears, and the apartment's eave hid the rest
    // — the probe was invisible. Lane +6 clears the apartment; the fox moved.
    [6.9, 6, "mouse", "se", 0, "adult", "key 12.9 — 0.15 past the tower's 12.75, in front of its side face; lane +6", 6],
    [10.7, 6, "fox", "sw", 2, "adult", ""],
    [2, 11, "bear", "se", 0, "adult", "the edge road"],
    // Round 4: the five new species, on the north road where no probe
    // lives, each with flat ground south of it — (5..7, 3) is the pond —
    // so nothing hides its feet, and ≥ 15 px from the rabbit/mouse pair at
    // (3.5–4.25, 2). The first placing had the wolf at (8.7, 2): the
    // factory at (9, 3) hid all but its ears.
    [2.4, 2, "cat", "se", 1, "adult", "north road"],
    [5.2, 2, "wolf", "se", 1, "adult", "north road, above the pond"],
    [6.3, 2, "pig", "se", 0, "adult", "north road, above the pond"],
    [7.5, 2, "cow", "sw", 2, "adult", "north road, above the pond"],
    [10.6, 2, "hawk", "ne", 0, "adult", "north road, by the rubble"],
  ];
  walkers.forEach(([tx, ty, species, facing, frame, age, note, dx = 0], i) => {
    const sprite = citizenSprite(species, facing, frame, age, { hat: note.includes("hat") });
    const onBridge = isWater(Math.floor(tx), Math.floor(ty)) && isRoad(Math.floor(tx), Math.floor(ty));
    items.push({ sprite, tx, ty, kind: "walker", dx, dy: onBridge ? -DECK_TOP : 0 });
    if (note.includes("meeting")) items.push({ sprite: MEETING, tx, ty, kind: "walker", z: 1000, dy: -22 });
    console.log(`  walker ${i + 1}: ${species} ${age} ${facing} f${frame} at (${tx}, ${ty})${note ? " — " + note : ""}`);
  });

  const margin = { left: 400, top: 100, w: 800, h: 520 };
  const canvas = createCanvas(margin.w, margin.h);
  const ctx = background(canvas, "#101114");
  // dx/dy (lane, lift, hover) are applied by the painter itself.
  const n = paintScene(items, (sprite, sx, sy, item) => blit(ctx, sprite, sx + margin.left, sy + margin.top, item.tint || null));
  console.log(`scene: ${n} items painted through painter.js`);
  const out = [save("scene.png", canvas, z)];
  // --focus tx,ty[,tx,ty...]: a zoom-6 crop around each named tile's ground
  // centre, for looking at one occlusion without squinting at the whole block.
  const fi = argv.indexOf("--focus");
  if (fi !== -1) {
    const nums = argv[fi + 1].split(",").map(Number);
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const [sx, sy] = toScreen(nums[i], nums[i + 1]);
      const cx = Math.round(sx + margin.left), cy = Math.round(sy + HALF_H + margin.top);
      const cw = 120, ch = 110;
      const crop = createCanvas(cw, ch);
      crop.getContext("2d").putImageData(ctx.getImageData(cx - cw / 2, cy - ch * 0.7, cw, ch), 0, 0);
      out.push(save(`scene-focus-${nums[i]}-${nums[i + 1]}.png`, crop, 6));
    }
  }
  return out;
}

// ---------------------------------------------------------------------- main

const z = argNum("--zoom", 0);
const both = !has("--sheet") && !has("--scene"); // `npm run shots` = everything
const did = [];
if (both || has("--sheet")) did.push(...sheets(z || 3));
if (both || has("--scene")) did.push(...scene(z || 2));
console.log(`${did.length} PNG(s) — now LOOK at them.`);
