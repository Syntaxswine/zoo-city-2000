// playtest.mjs — a scripted mayor runs the real sim headless and prints the
// curves. SPEC §17. An instrument: it REPORTS against targets, never halts.
//
//   node tools/playtest.mjs [--seed 7] [--years 30] [--layout balanced|dormitory|millbelt]
//                           [--rates 8,8,8] [--schedule 15:13,22:7] [--recession 20]
//                           [--parks 2] [--zoo 12] [--markets 1] [--pacify] [--stations] [--csv] [--quiet]
//
// The mayor: pre-plans a grid of 6×6 blocks ringed by roads around the start
// road, opens the next block of the type demand asks for (valve > 0.2 and
// cash permitting), zones it, and each January cuts a point if the
// population fell for three months. Layouts change which types it will open.

import { createWorld, ZONE, TERRAIN, idx, inBounds } from "../js/sim/world.js";
import { tick } from "../js/sim/tick.js";
import { TICKER_FLASH } from "../js/sim/events.js";
import { apply } from "../js/sim/ops.js";
import { lotScore } from "../js/sim/lots.js";
import { KNOBS } from "../js/sim/rules.js";
import { stateHash } from "../js/sim/save.js";
import { served } from "../js/sim/fields.js";
import { createMayor } from "./mayor.mjs";

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes(k);

const seed = arg("--seed", "7");
const years = Number(arg("--years", 30));
const layout = arg("--layout", "balanced");
const rates = ((r) => (r.length === 1 ? [r[0], r[0], r[0]] : r))(arg("--rates", "8,8,8").split(",").map(Number)); // one number = all three
const schedule = (arg("--schedule", "") || "").split(",").filter(Boolean).map((s) => s.split(":").map(Number));
const recessionYear = arg("--recession", null);
const parksWanted = Number(arg("--parks", 0));
const zooYear = arg("--zoo", null);
const marketsWanted = Number(arg("--markets", 0)); // M blocks the mayor opens from year 2
const pacify = flag("--pacify");                   // a pacification centre beside the start at year 3
const csv = flag("--csv");
const quiet = flag("--quiet");

const world = createWorld({ seed });
const mayor = createMayor(world, {
  layout, rates, schedule, parks: parksWanted, markets: marketsWanted, pacify,
  stations: flag("--stations"), disasters: flag("--disasters"),
  recessionYear: recessionYear == null ? null : Number(recessionYear),
  zooYear: zooYear == null ? null : Number(zooYear),
});
const sx = world.start.tx;
const sy = world.start.ty;

// ---- run --------------------------------------------------------------------
const rows = [];
const tickMs = [];
let lastP = [];
const totalTicks = years * 12;
let firstLocalReport = null;
for (let t = 0; t < totalTicks; t++) {
  const year = Math.floor(t / 12);
  const month = t % 12;
  mayor.month(t);
  const t0 = performance.now();
  const { notices } = tick(world);
  tickMs.push(performance.now() - t0);
  if (!quiet) for (const s of notices) if (TICKER_FLASH.test(s)) console.log(`  ${t}: ${s}`);
  const cen = world.last.census;
  // First printed number (SPEC §17): fraction of zoned lots whose local term alone forbids growth at V = +0.1.
  if (firstLocalReport === null && t === 12) {
    let zoned = 0;
    let forbid = 0;
    for (let i = 0; i < world.w * world.h; i++) {
      if (world.zone[i] === ZONE.NONE || !served(world, i)) continue;
      zoned++;
      const s = lotScore(world, i);
      if (0.1 + s.parts.local <= KNOBS.GROW_THRESH) forbid++;
    }
    firstLocalReport = { zoned, forbid, frac: zoned ? forbid / zoned : 0 };
  }
  lastP.push(cen.P);
  if (lastP.length > 3) lastP.shift();
  if (month === 11) {
    rows.push({ year: year + 1, P: cen.P, W: cen.W, J: cen.J, U: cen.U, VR: world.valves.R, VC: world.valves.C, VI: world.valves.I, cash: world.cash, inc: world.last.budget.incomeYr, up: world.last.budget.upkeepYr, appr: Math.round(cen.approval), H: cen.H, pol: cen.meanPol, lv: cen.meanLV, shares: cen.shares, n: world.last.demand.n, cap: world.last.demand.cap, lots: cen.lots, noRoad: cen.lotsNoRoad, fr: cen.friendships, crime: cen.meanCrime, maxCrime: cen.maxCrime, stations: cen.fireStations + cen.policeStations,
      markets: cen.markets, Jm: cen.Jm, herbNear: cen.herbNear, killings: world.events.killings, arrests: world.events.justice.takenIn + world.events.justice.cells + world.events.justice.sold, wrongful: world.events.justice.wrongful, fixed: cen.fixed, sold: world.events.justice.sold, held: cen.held, births: world.last.births, deaths: world.last.deaths, VM: world.valves.M, hKnife: cen.hKnife });
  }
}

// ---- report -----------------------------------------------------------------
const f = (v, d = 2) => (typeof v === "number" ? v.toFixed(d) : v);
if (csv) {
  console.log("year,P,W,J,U,VR,VC,VI,cash,income,upkeep,approval,H,meanPol,meanLV,n,cap,lots,markets,Jm,VM,herbNear,killings,arrests,wrongful,fixed,sold,held,hKnife,crime");
  for (const r of rows) console.log([r.year, r.P, r.W, r.J, r.U, f(r.VR), f(r.VC), f(r.VI), r.cash, r.inc, r.up, r.appr, f(r.H), f(r.pol, 1), f(r.lv, 1), f(r.n, 1), Math.round(r.cap), r.lots, r.markets, r.Jm, f(r.VM), r.herbNear, r.killings, r.arrests, r.wrongful, r.fixed, r.sold, r.held, f(r.hKnife, 3), f(r.crime, 1)].join(","));
} else {
  console.log(`playtest seed=${seed} layout=${layout} rates=${rates.join("/")} years=${years}`);
  console.log(`local-term census at year 1: ${firstLocalReport.forbid}/${firstLocalReport.zoned} accessible zoned lots forbidden at V=+0.1 (${(firstLocalReport.frac * 100).toFixed(0)}%) — target < 30%`);
  console.log(" yr     P     W     J     U    V_R   V_C   V_I     cash   inc/yr  up/yr appr    H   fr  pol   lv crime  n   cap lots  top species");
  for (const r of rows) {
    const top = Object.entries(r.shares).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join(" ");
    console.log(`${String(r.year).padStart(3)} ${String(r.P).padStart(5)} ${String(r.W).padStart(5)} ${String(r.J).padStart(5)} ${String(r.U).padStart(5)} ${f(r.VR).padStart(6)} ${f(r.VC).padStart(5)} ${f(r.VI).padStart(5)} ${String(r.cash).padStart(8)} ${String(r.inc).padStart(8)} ${String(r.up).padStart(6)} ${String(r.appr).padStart(4)} ${f(r.H).padStart(4)} ${String(r.fr).padStart(4)} ${f(r.pol, 0).padStart(4)} ${f(r.lv, 0).padStart(4)} ${f(r.crime, 0).padStart(3)}/${String(r.maxCrime).padEnd(3)} ${f(r.n, 1).padStart(3)} ${String(Math.round(r.cap)).padStart(5)} ${String(r.lots).padStart(4)}  ${top}`);
  }
  const last = rows[rows.length - 1];
  console.log(`crime and punishment: halls ${last.markets} (${last.Jm} jobs, V_M ${f(last.VM)}) · herbivores within the smell ${last.herbNear} · killings ${last.killings} · arrests ${last.arrests} (wrongful ${last.wrongful}) · fixed ${last.fixed} · sold ${last.sold} · held ${last.held} · H by pacification ${f(last.hKnife, 3)}`);
  console.log(`ledger: ${Object.entries(world.ledger).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
  const lastMs = tickMs.slice(-12);
  console.log(`hash ${stateHash(world)} · ${world.citizens.length} citizens · ${world.households.length} households · ${world.events.log.length} events · last-year tick ${(lastMs.reduce((a, b) => a + b, 0) / lastMs.length).toFixed(2)} ms (max ${Math.max(...lastMs).toFixed(1)})`);
}
