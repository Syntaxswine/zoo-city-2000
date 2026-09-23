#!/usr/bin/env node
// tools/groundprobe.mjs — DOES THE GROUND SHOW ITS TILES? SPEC §12.4, T3.3.
//
//   node tools/groundprobe.mjs              the table: an open field, its seamless control, and the quilt it replaced
//   node tools/groundprobe.mjs --cams 7     accumulate over up to seven camera positions (default 3)
//
// A PASSIVE INSTRUMENT: it refuses nothing. tools/check-ground.mjs is the
// gate, and imports these two readings from here so that the numbers the
// docs quote and the numbers the gate holds are one measurement.
//
// Both readings are taken off the REAL renderer's frame, not off the sprites:
//
//   SEAM    the step in mean luma across a tile edge, over the step across a
//           line through a tile. Two strips 2 units deep either side of the
//           edge, against the same pair either side of every interior line
//           (2, 4 .. 12 units in), in both edge directions. A quilt steps at
//           its edges and not inside; a field varies the same either way, so
//           a seamless ground reads 1. The interior baseline is EVERY line and
//           not one: with six dither patterns, one fixed pair of strips reads
//           the patterns, and the first version of this number said 1.71 on a
//           control that cannot have a seam.
//   REPEAT  how often a pixel agrees with the pixel exactly one tile over (the
//           lattice vectors (±32, 16)·zoom), less how often it agrees with the
//           pixel one not-quite-a-tile over (±1 px off the lattice). White
//           noise agrees at chance both ways; a ground built of few tiles
//           agrees more at the lattice. In points of agreement.
//
// THE CONTROL is the same map with every tile byte in 0..5: every corner
// kept, every tile a random seed — a ground that is seamless by construction,
// so its SEAM is the instrument's floor. THE QUILT is the same map through
// the pick the game used before T3.3 (grass-0/1/2 by `variant % 3`), which
// the gate needs in order to prove the instrument can see a seam at all.

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const PANEL = [900, 520];
const OFFS = [[0, 0], [-300, -150], [300, -150], [-300, 150], [300, 150], [0, -300], [0, 300]];

/** An open map: nothing made, no water, no trees — grass, and the world's own tile bytes (or `bytes(i)`). */
export function openField(createWorld, { seed = "groundprobe", bytes = null } = {}) {
  const world = createWorld({ seed });
  const n = world.w * world.h;
  for (let i = 0; i < n; i++) {
    world.terrain[i] = 0; world.road[i] = 0; world.zone[i] = 0; world.rail[i] = 0; world.civic[i] = 0;
    world.rubble[i] = 0; world.tier[i] = 0; world.wall[i] = 0; world.flooded[i] = 0;
    if (bytes) world.variant[i] = bytes(i);
  }
  world.roadsDirty = true;
  return world;
}
/** The control's bytes: 0..5, scattered — every corner kept, every seed drawn. */
export const keptBytes = (i) => ((i * 2654435761) >>> 7) % 6;

const luma = (d, j) => 0.299 * d[j] + 0.587 * d[j + 1] + 0.114 * d[j + 2];

/**
 * SEAM and REPEAT for `world` through renderer `r` (drawing into `canvas`,
 * PANEL-sized) at `zoom`, over `cams` camera positions round the map's centre.
 */
export function groundReadings(r, canvas, world, zoom, cams = 3) {
  const [PW, PH] = PANEL;
  let across = 0, inside = 0, edges = 0, lat = 0, non = 0;
  for (let cam = 0; cam < Math.min(cams, OFFS.length); cam++) {
    r.draw({ x: OFFS[cam][0], y: ((world.w + world.h) / 2) * 16 + OFFS[cam][1], zoom }, null, null, "off", 0);
    const d = canvas.getContext("2d").getImageData(0, 0, PW, PH).data;
    const z = zoom;
    const agree = (dx, dy) => {
      let s = 0, c = 0;
      for (let y = 40; y < PH - 40 - Math.abs(dy); y++) for (let x = Math.max(80, 80 - dx); x < Math.min(PW - 80, PW - 80 - dx); x++) {
        const j = (y * PW + x) * 4, k = ((y + dy) * PW + x + dx) * 4;
        c++;
        if (d[j] === d[k] && d[j + 1] === d[k + 1] && d[j + 2] === d[k + 2]) s++;
      }
      return s / c;
    };
    lat += (agree(32 * z, 16 * z) + agree(-32 * z, 16 * z)) / 2;
    non += (agree(32 * z, 17 * z) + agree(-31 * z, 16 * z) + agree(33 * z, 16 * z) + agree(-32 * z, 15 * z)) / 4;
    // The renderer's own device transform: base.tx = -round(view.left · z) (a re-derived one lands a pixel off).
    const v = r.view, bx = -Math.round(v.left * z), by = -Math.round(v.top * z);
    const strip = (tx, ty, a0, a1, b0, b1) => {
      let s = 0, c = 0;
      for (let a = a0 + 0.125; a < a1; a += 0.25) for (let b = b0 + 0.125; b < b1; b += 0.25) {
        const A = tx + a / 16, B = ty + b / 16;
        const x = Math.floor((A - B) * 32 * z + bx), y = Math.floor((A + B) * 16 * z + by);
        if (x < 0 || y < 0 || x >= PW || y >= PH) return NaN;
        s += luma(d, (y * PW + x) * 4); c++;
      }
      return s / c;
    };
    // dir 1: the edge b = 0 between (tx, ty − 1) and (tx, ty); dir 0: a = 0 between (tx − 1, ty) and (tx, ty).
    const band = (tx, ty, dir, c0, c1) => (dir ? strip(tx, ty, 2, 14, c0, c1) : strip(tx, ty, c0, c1, 2, 14));
    for (const dir of [1, 0]) for (let ty = 1; ty < world.h; ty++) for (let tx = 1; tx < world.w; tx++) {
      const lo = band(tx, ty, dir, 0, 2);
      const hi = dir ? band(tx, ty - 1, dir, 14, 16) : band(tx - 1, ty, dir, 14, 16);
      if (Number.isNaN(lo) || Number.isNaN(hi)) continue;
      let ins = 0, k = 0;
      for (let c = 2; c <= 12; c += 2) {
        const p = band(tx, ty, dir, c - 2, c), q = band(tx, ty, dir, c, c + 2);
        if (Number.isNaN(p) || Number.isNaN(q)) { k = 0; break; }
        ins += Math.abs(p - q); k++;
      }
      if (!k) continue;
      across += Math.abs(lo - hi); inside += ins / k; edges++;
    }
  }
  const n = Math.min(cams, OFFS.length);
  return { seam: across / inside, across: across / edges, inside: inside / edges, edges, repeat: (100 * (lat - non)) / n };
}

/** The pick the game made before T3.3: one of the three grasses per tile, by the tile's byte. */
export const quiltArt = (art) => ({ ...art, meadow: (corners, byte) => art.ground("grass", byte % 3) });

// ---- the table ----------------------------------------------------------------
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const argv = process.argv.slice(2);
  const at = argv.indexOf("--cams");
  const cams = at >= 0 ? Number(argv[at + 1]) || 3 : 3;
  const { installCanvas, createCanvas } = await import("./headless-canvas.mjs");
  installCanvas();
  const { createWorld } = await import("../js/sim/world.js");
  const { createRenderer } = await import("../js/render.js");
  const { art } = await import("../js/art/index.js");
  const rows = [
    ["the field", openField(createWorld), art],
    ["seamless control", openField(createWorld, { bytes: keptBytes }), art],
    ["the quilt (before T3.3)", openField(createWorld), quiltArt(art)],
  ];
  console.log(`groundprobe: an open 64×64 field through the real renderer, ${cams} camera(s), ${PANEL.join("×")}`);
  console.log(`\n${"".padEnd(26)}${[1, 2, 4].map((z) => `zoom ${z}: seam  repeat`.padEnd(24)).join("")}`);
  for (const [name, world, a] of rows) {
    const canvas = createCanvas(...PANEL);
    const r = createRenderer(canvas, world, a);
    r.resize();
    const cells = [1, 2, 4].map((z) => {
      const m = groundReadings(r, canvas, world, z, cams);
      return `${m.seam.toFixed(2).padStart(12)} ${m.repeat.toFixed(1).padStart(6)}`.padEnd(24);
    });
    console.log(`${name.padEnd(26)}${cells.join("")}`);
  }
  console.log("\nseam: 1 is seamless (the control is the floor); repeat: points of agreement one tile over, above chance");
}
