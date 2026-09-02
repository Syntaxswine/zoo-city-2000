// newsprobe.mjs — how much of what a city says ever reaches the player.
// SPEC §11b; the table in handoff §13 is this tool's output.
//
// An INSTRUMENT: it reports and never halts, never gates, exit 0 always.
//
// The question it answers. Only lines matching TICKER_FLASH pop up over the
// map; everything else the city says goes straight to the log. So:
//   · how many dispatches does a city make in thirty years?
//   · how many of them did the player ever SEE?
//   · how often did a month pop more than one, which is where the old
//     self-overwriting flash() dropped headlines on the floor?
//
// Session 6 first answered these from a six-line month it had built BY HAND,
// wrote "five in six headlines were never seen" into a commit message, and
// was wrong: the overwrite costs about one headline per thirty city-years.
// The real case for the reader is the never-popped column. This file exists
// so the next reader does not have to take that on trust, and so the handoff
// table has a command under it.
//
//   node tools/newsprobe.mjs [--years 30] [--seeds newsroom,7,3,5] [--csv]
//
// The layout is this tool's own — eight 6-tile blocks spiralling off the
// start road, R R C I R C M I, with a fire station and a police station —
// chosen because it zones a meat market and staffs it, which is where the
// justice lines (KILLING, SOLD, TAKEN IN, CELLS, COLD) come from. It is NOT
// playtest.mjs's layout and the two do not produce the same counts.

import { createWorld, ZONE, TERRAIN, CIVIC } from "../js/sim/world.js";
import { tick } from "../js/sim/tick.js";
import { apply } from "../js/sim/ops.js";
import { newsRows } from "../js/news.js";

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const YEARS = Number(arg("--years", 30));
const SEEDS = String(arg("--seeds", "newsroom,7,3,5")).split(",");
const CSV = argv.includes("--csv");

const BLOCK = 6;
const ZONES = [ZONE.R, ZONE.R, ZONE.C, ZONE.I, ZONE.R, ZONE.C, ZONE.M, ZONE.I];

function build(seed) {
  const w = createWorld({ seed });
  const idx = (x, y) => y * w.w + x;
  const S = w.start;
  const inx = Math.sign(w.w / 2 - S.tx) || 1;
  const iny = Math.sign(w.h / 2 - S.ty) || 1;
  let blocks = 0;
  for (let b = 0; b < ZONES.length; b++) {
    const x0 = S.tx + inx * (2 + (b % 3) * BLOCK);
    const y0 = S.ty + iny * (2 + Math.floor(b / 3) * BLOCK);
    const X0 = Math.min(x0, x0 + inx * BLOCK);
    const Y0 = Math.min(y0, y0 + iny * BLOCK);
    if (X0 < 1 || Y0 < 1 || X0 + BLOCK >= w.w - 1 || Y0 + BLOCK >= w.h - 1) continue;
    let wet = 0;
    for (let y = Y0; y <= Y0 + BLOCK; y++) for (let x = X0; x <= X0 + BLOCK; x++) if (w.terrain[idx(x, y)] === TERRAIN.WATER) wet++;
    if (wet > 3) continue; // a block that is mostly river never builds
    const ring = [];
    for (let x = X0; x <= X0 + BLOCK; x++) { ring.push(idx(x, Y0)); ring.push(idx(x, Y0 + BLOCK)); }
    for (let y = Y0; y <= Y0 + BLOCK; y++) { ring.push(idx(X0, y)); ring.push(idx(X0 + BLOCK, y)); }
    // and a spine back to the start road, or the block has no access
    for (let k = 0; k <= BLOCK * 3; k++) ring.push(idx(Math.min(w.w - 2, Math.max(1, S.tx + inx * k)), S.ty));
    apply(w, { kind: "road", tiles: ring });
    apply(w, { kind: "zone", zone: ZONES[b], x0: X0 + 1, y0: Y0 + 1, x1: X0 + BLOCK - 1, y1: Y0 + BLOCK - 1, density: 3 });
    blocks++;
  }
  apply(w, { kind: "civic", civic: CIVIC.FIRE, tile: idx(S.tx + inx * 3, S.ty + iny * 3) });
  apply(w, { kind: "civic", civic: CIVIC.POLICE, tile: idx(S.tx + inx * 4, S.ty + iny * 3) });
  for (let t = 0; t < YEARS * 12; t++) tick(w);
  return { w, blocks };
}

function measure(seed) {
  const { w, blocks } = build(seed);
  const rows = newsRows(w);
  const flashed = rows.filter((r) => r.flash);
  const perMonth = new Map();
  for (const r of flashed) perMonth.set(r.t, (perMonth.get(r.t) || 0) + 1);
  const counts = [...perMonth.values()];
  // Each month that popped n > 1 lost n-1 lines to the old overwriting flash().
  const lost = counts.reduce((s, n) => s + (n - 1), 0);
  return {
    seed, blocks,
    pop: w.citizens.length,
    dispatches: rows.length,
    popped: flashed.length,
    never: rows.length - flashed.length,
    neverPct: rows.length ? Math.round((100 * (rows.length - flashed.length)) / rows.length) : 0,
    monthsPopping: perMonth.size,
    monthsPoppingMulti: counts.filter((n) => n > 1).length,
    busiest: counts.length ? Math.max(...counts) : 0,
    lost,
  };
}

const out = SEEDS.map(measure);

if (CSV) {
  console.log("seed,pop,dispatches,popped,never,neverPct,monthsPopping,monthsPoppingMulti,busiest,lostToOldFlash");
  for (const r of out) console.log([r.seed, r.pop, r.dispatches, r.popped, r.never, r.neverPct, r.monthsPopping, r.monthsPoppingMulti, r.busiest, r.lost].join(","));
} else {
  console.log(`newsprobe: ${YEARS} years, eight-block layout (R R C I R C M I) + fire + police\n`);
  console.log("| seed | dispatches | popped up | never popped | months popping >1 | lost to the old flash() |");
  console.log("|---|---|---|---|---|---|");
  for (const r of out) {
    console.log(`| ${r.seed} | ${r.dispatches} | ${r.popped} | ${r.never} (${r.neverPct}%) | ${r.monthsPoppingMulti} | ${r.lost}${r.busiest > 1 ? ` (max ${r.busiest} in a month)` : ""} |`);
  }
  const lo = Math.min(...out.map((r) => r.neverPct));
  const hi = Math.max(...out.map((r) => r.neverPct));
  const totLost = out.reduce((s, r) => s + r.lost, 0);
  console.log(`\n${lo}–${hi}% of a city's dispatches never popped up at all — that share is what the reader is for.`);
  console.log(`The old self-overwriting flash() dropped ${totLost} across ${out.length} × ${YEARS} = ${out.length * YEARS} city-years: real, and rare.`);
  console.log(`Look for it where the sentence table fires (SOLD / TAKEN IN / CELLS in one month), not in a balanced town.`);
}
