#!/usr/bin/env node
// tools/play.mjs — WATCH THE GAME PLAY ITSELF. SPEC §12.5, §17.
//
//   node tools/play.mjs --years 12 --every 24
//   node tools/play.mjs --years 40 --disasters --when "^FIRE" --after 0,1,3,6,7
//   node tools/play.mjs --years 20 --film 24 --follow city
//   node tools/play.mjs --years 30 --overlay crime --stations --every 60
//
// The scripted mayor of `tools/mayor.mjs` builds a town in the real sim, and
// the REAL renderer — js/render.js, the same file the browser loads, through
// tools/headless-canvas.mjs — photographs it. No browser, no dependencies, no
// second copy of the drawing. What this writes is what a player sees.
//
// WHY IT EXISTS. `playtest.mjs` prints the curves and `check.mjs` proves the
// invariants, but neither can see. Session 8 shipped a rubble clock the owner
// asked for and could not verify it, because the browser pane was bound to
// another project's server on every port it would take. A picture of the game
// should not depend on a contended resource.
//
// THE SHUTTER. Three ways to decide when to press it, and they compose:
//   --every N     every N months
//   --at Y-M,...  named months (2003-06), 1-based month
//   --when RE     any month a ticker line matches the regex — AND, because
//                 the city's own lines carry coordinates ("FIRE at (12,30)"),
//                 the camera GOES THERE. --after 0,3,6 shoots that month and
//                 3 and 6 months later from the same spot, which is how you
//                 watch a burnt lot clear itself and rebuild.
//   --film N      N frames at the end, --fps apart, so the walkers move.
// Every shot prints a caption line: the month, the town, and what happened.
//
// An INSTRUMENT: it reports, never gates, exit 0 always.

import { mkdirSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { installCanvas, createCanvas, encodePNG, zoom as zoomCanvas } from "./headless-canvas.mjs";

installCanvas();

const { createWorld, ROAD } = await import("../js/sim/world.js");
const { apply } = await import("../js/sim/ops.js");
const { tick, dateOf } = await import("../js/sim/tick.js");
const { createMayor } = await import("./mayor.mjs");
const { createRenderer } = await import("../js/render.js");
const { createWalkers } = await import("../js/walkers.js");
const { art } = await import("../js/art/index.js");
const { toScreen, HALF_H, mapBounds } = await import("../js/iso/iso.js");
const { TICKER_FLASH } = await import("../js/sim/events.js");

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const flag = (k) => argv.includes(k);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const num = (k, d) => Number(arg(k, d));
const list = (k, d) => String(arg(k, d)).split(",").map((s) => s.trim()).filter(Boolean);

const SEED = arg("--seed", "7");
const YEARS = num("--years", 12);
const W = num("--w", 960);
const H = num("--h", 600);
const ZOOM = num("--zoom", 2);
const OUT = resolve(ROOT, arg("--out", "docs/play"));
const EVERY = num("--every", 0);
const AT = list("--at", "");
const WHEN = arg("--when", null);
const AFTER = list("--after", "0").map(Number);
const FILM = num("--film", 0);
const FPS = num("--fps", 12);
const FOLLOW = arg("--follow", "city");
const OVERLAY = arg("--overlay", "off");
const KEEP = flag("--keep");
const WATCH_TILE = arg("--watch", null) ? arg("--watch", "").split(",").map(Number) : null;
// --cameras N puts N security cameras along the town's streets, in a stable
// order at a fixed stride, once the mayor has laid enough road to hold them.
// The scripted mayor does not build them, and this is the only instrument that
// can photograph one standing next to a walking animal.
const CAMERAS = num("--cameras", 0);
const CAM_YEAR = num("--cameras-year", 4);

// ---- the town ---------------------------------------------------------------
const world = createWorld({ seed: SEED });
const mayor = createMayor(world, {
  layout: arg("--layout", "balanced"),
  rates: ((r) => (r.length === 1 ? [r[0], r[0], r[0]] : r))(list("--rates", "8,8,8").map(Number)),
  parks: num("--parks", 0),
  markets: num("--markets", 0),
  pacify: flag("--pacify"),
  stations: flag("--stations"),
  disasters: flag("--disasters"),
  zooYear: arg("--zoo", null) == null ? null : num("--zoo", 0),
  recessionYear: arg("--recession", null) == null ? null : num("--recession", 0),
});

// ---- the camera and the renderer --------------------------------------------
const canvas = createCanvas(W, H);
const renderer = createRenderer(canvas, world, art);
const walkers = createWalkers(world);
const camera = { x: 0, y: 0, zoom: ZOOM };

/** Centre the camera on a tile, the way main.js centres on the start road. */
function lookAt(tx, ty) {
  const [sx, sy] = toScreen(tx + 0.5, ty + 0.5);
  camera.x = sx;
  camera.y = sy + HALF_H;
}

/** The middle of what is actually built — a town grows away from its start road. */
function cityCentre() {
  let n = 0, sx = 0, sy = 0;
  for (let i = 0; i < world.w * world.h; i++) {
    if (world.tier[i] <= 0 && world.civic[i] === 0) continue;
    sx += i % world.w; sy += (i / world.w) | 0; n++;
  }
  return n ? [sx / n, sy / n] : [world.start.tx, world.start.ty];
}

function aim(at) {
  if (at) { lookAt(at[0], at[1]); return; }
  if (FOLLOW === "start") lookAt(world.start.tx, world.start.ty);
  else if (/^\d+,\d+$/.test(FOLLOW)) { const [x, y] = FOLLOW.split(",").map(Number); lookAt(x, y); }
  else lookAt(...cityCentre());
  // main.js's clampCamera, to the letter: the camera CENTRE stays inside the
  // map's projection, and the viewport is allowed to overhang the edge. (The
  // first draft inset by half a viewport and read `left`/`w` off mapBounds,
  // which returns minX/maxX/minY/maxY — every term was undefined, the camera
  // went to NaN, and every frame came out an empty rectangle of background.)
  const b = mapBounds(world.w, world.h);
  camera.x = Math.max(b.minX, Math.min(b.maxX, camera.x));
  camera.y = Math.max(b.minY, Math.min(b.maxY, camera.y));
}

/**
 * What one tile IS, in words, beside the picture of it. A photograph cannot
 * tell you "rubble, four months left" and squinting at a 12-px sprite to
 * decide is how you talk yourself into seeing what you expected. --when's
 * tile is watched automatically, because the line that fired the shutter
 * named it.
 */
function tileReport(at) {
  const t = at || WATCH_TILE;
  if (!t) return "";
  const [x, y] = t;
  if (x < 0 || y < 0 || x >= world.w || y >= world.h) return "";
  const i = y * world.w + x;
  const bits = [`tier ${world.tier[i]}`];
  if (world.burning[i]) bits.push(`BURNING ${world.burning[i]}mo`);
  if (world.rubble[i]) bits.push(`RUBBLE ${world.rubble[i]}mo left`);
  if (world.flooded[i]) bits.push(`flooded ${world.flooded[i]}`);
  return `  [${x},${y} ${bits.join(", ")}]`;
}

const shots = [];
function shoot(name, caption, at = null, dt = 0) {
  aim(at);
  walkers.update(dt, renderer.viewportTiles());
  renderer.draw(camera, null, walkers, OVERLAY, dt);
  const file = join(OUT, `${name}.png`);
  writeFileSync(file, encodePNG(canvas));
  const line = `${caption}${tileReport(at)}`;
  shots.push({ name, caption: line });
  console.log(`  ${name}.png  ${line}`);
}

/** The city writes its own coordinates into its lines: "FIRE at (12,30)". */
const coordsIn = (line) => { const m = /\((\d+),(\d+)\)/.exec(line); return m ? [Number(m[1]), Number(m[2])] : null; };

const stamp = () => {
  const d = dateOf(world, world.tick - 1);
  return `${String(d.year)}-${String(d.month + 1).padStart(2, "0")}`;
};
const town = () => {
  const c = world.last.census;
  return `P ${c.P} · §${world.cash} · crime ${c.meanCrime.toFixed(0)} · ${c.fireStations}F ${c.policeStations}P · ${walkers.count} afoot`;
};

// ---- run --------------------------------------------------------------------
if (!KEEP) { try { for (const f of readdirSync(OUT)) if (f.endsWith(".png")) rmSync(join(OUT, f)); } catch { /* first run */ } }
mkdirSync(OUT, { recursive: true });

const atSet = new Set(AT);
const queue = []; // { atTick, name, why, tile } — the --when shutter's delayed frames
const re = WHEN ? new RegExp(WHEN) : null;
const total = YEARS * 12;
console.log(`play: seed ${SEED}, ${YEARS} years, ${W}×${H} @ ${ZOOM}x${OVERLAY === "off" ? "" : `, overlay ${OVERLAY}`}\n`);

for (let t = 0; t < total; t++) {
  mayor.month(t);
  // main.js stepTick(): tick, invalidate, notify — in that order. The
  // invalidate is not optional. The static layer holds the ground AND the
  // buildings and is only rebuilt when it is dirty or the camera has walked
  // near its margin, so without this a run photographed from a fixed camera
  // shows the town as it was when the layer was last built: the first draft
  // of this file missed it, and a burnt lot went on standing for six months.
  if (CAMERAS && t === CAM_YEAR * 12) {
    const roads = [];
    for (let i = 0; i < world.w * world.h; i++) if (world.road[i] === ROAD.ROAD && !world.rail[i] && !world.wall[i]) roads.push(i);
    const stride = Math.max(1, Math.floor(roads.length / CAMERAS));
    let up = 0;
    for (let k = 0; k < roads.length && up < CAMERAS; k += stride) {
      world.cash = Math.max(world.cash, 5000);
      if (apply(world, { kind: "camera", tiles: [roads[k]] }).ok) up++;
    }
    const where = [];
    for (let i = 0; i < world.w * world.h; i++) if (world.cam[i]) where.push(`${i % world.w},${(i / world.w) | 0}`);
    console.log(`  ${up} camera${up === 1 ? "" : "s"} up along ${roads.length} road tiles — at ${where.join(" ")}`);
  }
  const { notices } = tick(world);
  renderer.invalidate();
  walkers.notify();
  const d = dateOf(world, world.tick - 1);
  const key = `${d.year}-${String(d.month + 1).padStart(2, "0")}`;

  // Anything the --when shutter asked for earlier, due now.
  for (let k = queue.length - 1; k >= 0; k--) {
    if (queue[k].atTick !== t) continue;
    const q = queue.splice(k, 1)[0];
    shoot(q.name, `${key}  ${q.why}  ${town()}`, q.tile);
  }

  if (re) {
    for (const line of notices) {
      if (!re.test(line)) continue;
      const tile = coordsIn(line);
      const slug = `${key}-${line.split(/[\s—]/)[0].toLowerCase().replace(/[^a-z0-9]/g, "") || "news"}`;
      for (const off of AFTER) {
        const why = off === 0 ? line.slice(0, 90) : `+${off} month${off === 1 ? "" : "s"} — ${line.slice(0, 60)}`;
        if (off === 0) shoot(slug, `${key}  ${why}  ${town()}`, tile);
        else queue.push({ atTick: t + off, name: `${slug}+${off}`, why, tile });
      }
      break; // one story a month is enough
    }
  }

  const due = (EVERY && t % EVERY === 0) || atSet.has(key);
  if (due) {
    const head = notices.find((s) => TICKER_FLASH.test(s));
    shoot(`m${String(t).padStart(4, "0")}-${key}`, `${key}  ${town()}${head ? `  · ${head.slice(0, 70)}` : ""}`);
  }
}

// ---- the film: the same instant, --film frames apart, so the town MOVES -------
if (FILM > 0) {
  console.log(`\nfilm: ${FILM} frames at ${FPS} fps — flip through them to see the walkers move`);
  for (let f = 0; f < FILM; f++) shoot(`film-${String(f).padStart(2, "0")}`, `frame ${f + 1}/${FILM}  ${town()}`, null, f === 0 ? 0 : 1 / FPS);
}

console.log(`\n${shots.length} PNG(s) in ${OUT} — now LOOK at them.`);
if (!shots.length) console.log("Nothing matched the shutter: pass --every N, --at YYYY-MM, --when REGEX or --film N.");
