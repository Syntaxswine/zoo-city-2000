// playtest.mjs — a scripted mayor runs the real sim headless and prints the
// curves. SPEC §17. An instrument: it REPORTS against targets, never halts.
//
//   node tools/playtest.mjs [--seed 7] [--years 30] [--layout balanced|dormitory|millbelt]
//                           [--rates 8,8,8] [--schedule 15:13,22:7] [--recession 20]
//                           [--parks 2] [--zoo 12] [--csv] [--quiet]
//
// The mayor: pre-plans a grid of 6×6 blocks ringed by roads around the start
// road, opens the next block of the type demand asks for (valve > 0.2 and
// cash permitting), zones it, and each January cuts a point if the
// population fell for three months. Layouts change which types it will open.

import { createWorld, ZONE, TERRAIN, idx, inBounds } from "../js/sim/world.js";
import { tick } from "../js/sim/tick.js";
import { apply } from "../js/sim/ops.js";
import { lotScore } from "../js/sim/lots.js";
import { KNOBS } from "../js/sim/rules.js";
import { stateHash } from "../js/sim/save.js";
import { hasAccess } from "../js/sim/fields.js";

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes(k);

const seed = arg("--seed", "7");
const years = Number(arg("--years", 30));
const layout = arg("--layout", "balanced");
const rates = arg("--rates", "8,8,8").split(",").map(Number);
const schedule = (arg("--schedule", "") || "").split(",").filter(Boolean).map((s) => s.split(":").map(Number));
const recessionYear = arg("--recession", null);
const parksWanted = Number(arg("--parks", 0));
const zooYear = arg("--zoo", null);
const csv = flag("--csv");
const quiet = flag("--quiet");

const world = createWorld({ seed });
apply(world, { kind: "rate", zone: "R", value: rates[0] });
apply(world, { kind: "rate", zone: "C", value: rates[1] });
apply(world, { kind: "rate", zone: "I", value: rates[2] });
apply(world, { kind: "toggle", key: "noDisasters", value: !flag("--disasters") });

// ---- block planner --------------------------------------------------------
// Blocks are 8×8 cells: a road ring (shared with neighbours) around a 6×6 lot
// interior. Block (bx, by) has its top-left road corner at start + 7·(bx, by).
const BLOCK = 7;
const sx = world.start.tx;
const sy = world.start.ty;
const spiral = [];
for (let r = 0; r <= 4; r++) {
  for (let by = -r; by <= r; by++) for (let bx = -r; bx <= r; bx++) {
    if (Math.max(Math.abs(bx), Math.abs(by)) !== r) continue;
    spiral.push([bx, by]);
  }
}
const opened = new Set();
function blockOK(bx, by) {
  const x0 = sx + bx * BLOCK - 3;
  const y0 = sy + by * BLOCK - 3;
  let water = 0;
  for (let y = y0; y <= y0 + BLOCK; y++) for (let x = x0; x <= x0 + BLOCK; x++) {
    if (!inBounds(world, x, y)) return false;
    if (world.terrain[idx(world, x, y)] === TERRAIN.WATER) water++;
  }
  return water <= 4;
}
function openBlock(bx, by, zone) {
  const x0 = sx + bx * BLOCK - 3;
  const y0 = sy + by * BLOCK - 3;
  const ring = [];
  for (let x = x0; x <= x0 + BLOCK; x++) { ring.push(idx(world, x, y0)); ring.push(idx(world, x, y0 + BLOCK)); }
  for (let y = y0; y <= y0 + BLOCK; y++) { ring.push(idx(world, x0, y)); ring.push(idx(world, x0 + BLOCK, y)); }
  // Connect the ring to the start road if this is the first block.
  const r1 = apply(world, { kind: "road", tiles: ring });
  const r2 = apply(world, { kind: "zone", zone, x0: x0 + 1, y0: y0 + 1, x1: x0 + BLOCK - 1, y1: y0 + BLOCK - 1, density: 3 });
  opened.add(`${bx},${by}`);
  return (r1.ok || r1.reason === "nothing to do") && r2.ok;
}
function nextBlock() {
  for (const [bx, by] of spiral) {
    if (opened.has(`${bx},${by}`)) continue;
    if (blockOK(bx, by)) return [bx, by];
    opened.add(`${bx},${by}`);
  }
  return null;
}
const wantTypes = {
  balanced: (v) => [["R", ZONE.R, v.R], ["C", ZONE.C, v.C], ["I", ZONE.I, v.I]],
  dormitory: (v) => [["R", ZONE.R, v.R]],
  millbelt: (v) => [["R", ZONE.R, v.R], ["I", ZONE.I, v.I + 0.3], ["I2", ZONE.I, v.I + 0.2], ["C", ZONE.C, v.C - 0.2]],
};

// Opening: one R block, one C block, one I block (balanced), connected to the stub.
const first = { balanced: [ZONE.R, ZONE.I, ZONE.C], dormitory: [ZONE.R, ZONE.R], millbelt: [ZONE.R, ZONE.I, ZONE.I] }[layout] || [ZONE.R, ZONE.I, ZONE.C];
for (const z of first) { const b = nextBlock(); if (b) openBlock(b[0], b[1], z); }

// ---- run --------------------------------------------------------------------
const rows = [];
const tickMs = [];
let parks = 0;
let lastP = [];
const totalTicks = years * 12;
let firstLocalReport = null;
for (let t = 0; t < totalTicks; t++) {
  const year = Math.floor(t / 12);
  const month = t % 12;
  for (const [y, r] of schedule) if (year === y && month === 0) for (const z of ["R", "C", "I"]) apply(world, { kind: "rate", zone: z, value: r });
  if (recessionYear != null && year === Number(recessionYear) && month === 0) world.events.active.push({ id: "recession", until: t + 24, extMult: 0.6 });
  if (zooYear != null && year === Number(zooYear) && month === 0) {
    // Place a zoo on the first free 2×2 next to the start.
    outer: for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      const r = apply(world, { kind: "zoo", tx: sx + dx, ty: sy + dy });
      if (r.ok) break outer;
    }
  }
  if (parks < parksWanted && t >= 24 && month === 6) {
    outer2: for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
      const r = apply(world, { kind: "park", tx: sx + dx, ty: sy + dy });
      if (r.ok) { parks++; break outer2; }
    }
  }
  // The mayor reacts every quarter: zone AHEAD — open a block of a type when
  // its valve is positive and fewer than 12 empty lots of that type remain.
  if (t > 0 && month % 3 === 0 && world.cash > 600) {
    const v = world.valves;
    const wants = wantTypes[layout](v).sort((a, b) => b[2] - a[2]);
    const empty = { [ZONE.R]: 0, [ZONE.C]: 0, [ZONE.I]: 0 };
    for (let i = 0; i < world.w * world.h; i++) if (world.zone[i] && world.tier[i] === 0 && !world.rubble[i]) empty[world.zone[i]]++;
    for (const [name, zone, val] of wants) {
      if (val < 0.05) break;
      if (empty[zone] >= 12) continue;
      const b = nextBlock();
      if (!b) break;
      openBlock(b[0], b[1], zone);
      break;
    }
  }
  const t0 = performance.now();
  const { notices } = tick(world);
  tickMs.push(performance.now() - t0);
  if (!quiet) for (const s of notices) if (/^(FIRE|FLOOD|TORNADO|BOOM|RECESSION|TAX REVOLT|MILESTONE|RECEIVERSHIP|FOUNDERS|MOUSE|RABBIT|BEAR|COUNTY|FOX|The Gnawleys|A SMOG)/.test(s)) console.log(`  ${t}: ${s}`);
  const cen = world.last.census;
  // First printed number (SPEC §17): fraction of zoned lots whose local term alone forbids growth at V = +0.1.
  if (firstLocalReport === null && t === 12) {
    let zoned = 0;
    let forbid = 0;
    for (let i = 0; i < world.w * world.h; i++) {
      if (world.zone[i] === ZONE.NONE || !hasAccess(world, i)) continue;
      zoned++;
      const s = lotScore(world, i);
      if (0.1 + s.parts.local <= KNOBS.GROW_THRESH) forbid++;
    }
    firstLocalReport = { zoned, forbid, frac: zoned ? forbid / zoned : 0 };
  }
  lastP.push(cen.P);
  if (lastP.length > 3) lastP.shift();
  if (month === 11) {
    rows.push({ year: year + 1, P: cen.P, W: cen.W, J: cen.J, U: cen.U, VR: world.valves.R, VC: world.valves.C, VI: world.valves.I, cash: world.cash, inc: world.last.budget.incomeYr, up: world.last.budget.upkeepYr, appr: Math.round(cen.approval), H: cen.H, pol: cen.meanPol, lv: cen.meanLV, shares: cen.shares, n: world.last.demand.n, cap: world.last.demand.cap, lots: cen.lots, noRoad: cen.lotsNoRoad, fr: cen.friendships });
  }
}

// ---- report -----------------------------------------------------------------
const f = (v, d = 2) => (typeof v === "number" ? v.toFixed(d) : v);
if (csv) {
  console.log("year,P,W,J,U,VR,VC,VI,cash,income,upkeep,approval,H,meanPol,meanLV,n,cap,lots");
  for (const r of rows) console.log([r.year, r.P, r.W, r.J, r.U, f(r.VR), f(r.VC), f(r.VI), r.cash, r.inc, r.up, r.appr, f(r.H), f(r.pol, 1), f(r.lv, 1), f(r.n, 1), Math.round(r.cap), r.lots].join(","));
} else {
  console.log(`playtest seed=${seed} layout=${layout} rates=${rates.join("/")} years=${years}`);
  console.log(`local-term census at year 1: ${firstLocalReport.forbid}/${firstLocalReport.zoned} accessible zoned lots forbidden at V=+0.1 (${(firstLocalReport.frac * 100).toFixed(0)}%) — target < 30%`);
  console.log(" yr     P     W     J     U    V_R   V_C   V_I     cash   inc/yr  up/yr appr    H   fr  pol   lv   n   cap lots  top species");
  for (const r of rows) {
    const top = Object.entries(r.shares).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join(" ");
    console.log(`${String(r.year).padStart(3)} ${String(r.P).padStart(5)} ${String(r.W).padStart(5)} ${String(r.J).padStart(5)} ${String(r.U).padStart(5)} ${f(r.VR).padStart(6)} ${f(r.VC).padStart(5)} ${f(r.VI).padStart(5)} ${String(r.cash).padStart(8)} ${String(r.inc).padStart(8)} ${String(r.up).padStart(6)} ${String(r.appr).padStart(4)} ${f(r.H).padStart(4)} ${String(r.fr).padStart(4)} ${f(r.pol, 0).padStart(4)} ${f(r.lv, 0).padStart(4)} ${f(r.n, 1).padStart(3)} ${String(Math.round(r.cap)).padStart(5)} ${String(r.lots).padStart(4)}  ${top}`);
  }
  const last = tickMs.slice(-12);
  console.log(`hash ${stateHash(world)} · ${world.citizens.length} citizens · ${world.households.length} households · ${world.events.log.length} events · last-year tick ${(last.reduce((a, b) => a + b, 0) / last.length).toFixed(2)} ms (max ${Math.max(...last).toFixed(1)})`);
}
