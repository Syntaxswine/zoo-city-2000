// serviceprobe.mjs — what a fire station and a police station actually BUY.
//
// An INSTRUMENT: it reports and never halts, never gates, exit 0 always.
//
// The owner (2026-09-02): "there's still a balance issue with police and
// fire, even if you have a ton of them the fires and crime are not prevented
// and most go unsolved." This measures that sentence instead of arguing with
// it: the same town, built the same way, then 0 / 1 / 4 / 12 of each station,
// and the numbers a player would feel —
//
//   fire     ignitions, buildings lost to fire, tile-months alight
//   crime    mean crime over built lots, the share above CRIME_HIGH
//   files    killings + burglaries opened, arrests made, files gone cold
//
//   node tools/serviceprobe.mjs [--seeds 7,3,5,11] [--years 40] [--warm 8]
//                               [--stations 0,1,4,12] [--csv]
//
// The rig: playtest's 8x8 blocks (a road ring round a 6x6 interior) opened in
// a spiral, R I C R I C ..., warmed for --warm years with disasters OFF, then
// the stations go in (bulldozing an interior lot each, cash granted so the
// experiment is not about bankruptcy), then --years with disasters ON.
// Counts come from the ticker lines themselves — what the news would show.

import { createWorld, ZONE, TERRAIN, idx, inBounds } from "../js/sim/world.js";
import { tick } from "../js/sim/tick.js";
import { apply } from "../js/sim/ops.js";
import { KNOBS } from "../js/sim/rules.js";
import * as EV from "../js/sim/events.js";
import * as FI from "../js/sim/fields.js";
// fireExposure landed in session 8 (in fields.js, beside the coverage it reads);
// keep the probe runnable against an older checkout so the before and the after
// can be measured on ONE rig instead of two that do not compare.
const fireExposure = FI.fireExposure || EV.fireExposure || (() => ({ share: NaN }));
const ROSTER = EV.ROSTER;

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const SEEDS = String(arg("--seeds", "7,3,5,11")).split(",");
const YEARS = Number(arg("--years", 40));
const WARM = Number(arg("--warm", 8));
const COUNTS = String(arg("--stations", "0,1,4,12")).split(",").map(Number);
const ONLY = arg("--only", "both"); // fire | police | both — the two systems are independent; sweep one at a time to read either
const CSV = argv.includes("--csv");
// A fire spreads to four neighbours at FIRE_SPREAD for two months off a beat:
// ~2.4 offspring per burning lot, SUPERCRITICAL, stopped only by the road ring
// round the block. So a town either loses a whole block or none of one, and a
// 40-year run rolls about three fires — far too few to read a consequence off.
// The rig therefore asks the two fire questions with two instruments:
//   HOW OFTEN  is exact arithmetic (fireExposure().share, no simulation), and
//   HOW BAD    is measured with --forced fires driven through the REAL roster
//              entry, one every --forced months with the rolled ones off.
const FORCED = Number(arg("--forced", 0));
const FIRE_CARD = ROSTER.find((e) => e.id === "fire");

const BLOCK = 7;
const CYCLE = [ZONE.R, ZONE.I, ZONE.C, ZONE.R, ZONE.C, ZONE.I];

function town(seed) {
  const w = createWorld({ seed });
  apply(w, { kind: "toggle", key: "noDisasters", value: true });
  for (const z of ["R", "C", "I"]) apply(w, { kind: "rate", zone: z, value: 8 });
  const sx = w.start.tx, sy = w.start.ty;
  const spiral = [];
  for (let r = 0; r <= 3; r++) for (let by = -r; by <= r; by++) for (let bx = -r; bx <= r; bx++) if (Math.max(Math.abs(bx), Math.abs(by)) === r) spiral.push([bx, by]);
  const ok = (bx, by) => {
    const x0 = sx + bx * BLOCK - 3, y0 = sy + by * BLOCK - 3;
    let wet = 0;
    for (let y = y0; y <= y0 + BLOCK; y++) for (let x = x0; x <= x0 + BLOCK; x++) {
      if (!inBounds(w, x, y)) return false;
      if (w.terrain[idx(w, x, y)] === TERRAIN.WATER) wet++;
    }
    return wet <= 4;
  };
  const open = [];
  for (const [bx, by] of spiral) {
    if (open.length >= 9 || !ok(bx, by)) continue;
    const x0 = sx + bx * BLOCK - 3, y0 = sy + by * BLOCK - 3;
    const ring = [];
    for (let x = x0; x <= x0 + BLOCK; x++) { ring.push(idx(w, x, y0)); ring.push(idx(w, x, y0 + BLOCK)); }
    for (let y = y0; y <= y0 + BLOCK; y++) { ring.push(idx(w, x0, y)); ring.push(idx(w, x0 + BLOCK, y)); }
    w.cash = 50000;
    apply(w, { kind: "road", tiles: ring });
    apply(w, { kind: "zone", zone: CYCLE[open.length % CYCLE.length], x0: x0 + 1, y0: y0 + 1, x1: x0 + BLOCK - 1, y1: y0 + BLOCK - 1, density: 3 });
    open.push([x0, y0]);
  }
  w.cash = 50000;
  for (let t = 0; t < WARM * 12; t++) tick(w);
  return { w, open };
}

/** The station list this sweep wants, spread one per block, on a bulldozed interior lot. */
function staff(w, open, n) {
  const want = ONLY === "fire" ? ["fire"] : ONLY === "police" ? ["police"] : ["fire", "police"];
  const kinds = [];
  for (let k = 0; k < n; k++) for (const kind of want) kinds.push(kind);
  let placed = 0;
  for (let pass = 0; pass < 2 && placed < kinds.length; pass++) {
    for (const [x0, y0] of open) {
      if (placed >= kinds.length) break;
      // pass 0 takes the NW interior corner of each block, pass 1 the SE
      const tx = pass ? x0 + BLOCK - 1 : x0 + 1;
      const ty = pass ? y0 + BLOCK - 1 : y0 + 1;
      if (!inBounds(w, tx, ty)) continue;
      w.cash = 100000;
      apply(w, { kind: "bulldoze", x0: tx, y0: ty, x1: tx, y1: ty });
      if (apply(w, { kind: kinds[placed], tx, ty }).ok) placed++;
    }
  }
  w.cash = 100000;
  return placed;
}

/** Share of BUILT lots a 0/1 field covers. */
function share(w, field) {
  let n = 0, k = 0;
  for (let i = 0; i < w.w * w.h; i++) if (w.tier[i] > 0) { n++; if (field[i]) k++; }
  return n ? (100 * k) / n : 0;
}

function run(seed, n) {
  const { w, open } = town(seed);
  staff(w, open, n);
  apply(w, { kind: "toggle", key: "noDisasters", value: !!FORCED });
  const c = { ignitions: 0, lost: 0, saved: 0, alight: 0, primary: 0, tornado: 0, killings: 0, burglaries: 0, arrests: 0, cold: 0, crimeSum: 0, crimeN: 0, hotSum: 0, hotN: 0, covSum: 0, covN: 0 };
  // Every file, by object identity, and how it ENDED: an arrest, gone cold,
  // or the quiet third door — the culprit died or left town and filesTick
  // closed the file with no line and no counter (justice.js, `if (!culprit
  // || culprit.dead) { f.closed = true; continue; }`).
  const fate = { opened: 0, arrest: 0, cold: 0, gone: 0, open: 0, covSum: 0, covs: [], maxFiles: 0 };
  const seen = new Map();
  const seenArrest = new Set();
  const N = w.w * w.h;
  const before = new Uint8Array(N);
  for (let t = 0; t < YEARS * 12; t++) {
    for (let i = 0; i < N; i++) before[i] = w.burning[i];
    w.cash = Math.max(w.cash, 20000); // never bankrupt: this is not a budget experiment
    // A forced fire goes through the roster card itself, so the origin weighting,
    // the burn length and the spread are the shipped ones and not a copy.
    if (FORCED && t % FORCED === FORCED - 1 && FIRE_CARD.gate(w, w.last ? w.last.census : null)) { FIRE_CARD.fire(w); c.primary++; }
    const coldBefore = w.events.justice.cold;
    const { notices } = tick(w);
    c.saved += (w.fires && w.fires.saved) || 0; // published by eventsTick: a put-out fire leaves no mark to count
    // Files: note each new one, then read the fates of the ones that closed.
    for (const f of w.events.files) {
      if (f.cause === "trespass" || seen.has(f)) continue;
      seen.set(f, true);
      if (f.cause === "killing" || f.cause === "burglary") { fate.opened++; fate.covSum += w.policeCov[f.tile]; fate.covs.push(w.policeCov[f.tile]); }
    }
    let live = 0;
    for (const f of w.events.files) if (!f.closed) live++;
    if (live > fate.maxFiles) fate.maxFiles = live;
    let arrestsNow = 0;
    for (const a of w.events.arrests) {
      if (seenArrest.has(a)) continue;
      seenArrest.add(a);
      if (a.cause === "killing" || a.cause === "burglary") arrestsNow++;
    }
    fate.arrest += arrestsNow;
    fate.cold += w.events.justice.cold - coldBefore;
    for (let i = 0; i < N; i++) {
      if (w.burning[i]) c.alight++;
      if (!before[i] && w.burning[i]) c.ignitions++;
      if (before[i] && !w.burning[i] && w.rubble[i]) c.lost++;
    }
    for (const line of notices) {
      if (/^FIRE at/.test(line)) { if (!FORCED) c.primary++; } // the roster rolled one; every other ignition is spread
      else if (/^TORNADO/.test(line)) c.tornado++; // the other maker of rubble, so the fire columns stay honest
      else if (/^KILLING/.test(line)) c.killings++;
      else if (/^BURGLARY/.test(line)) c.burglaries++;
      else if (/^(SOLD|TAKEN IN|CELLS)/.test(line)) c.arrests++;
      else if (/^COLD/.test(line)) c.cold++;
    }
    let hot = 0, lots = 0;
    for (let i = 0; i < N; i++) {
      if (w.tier[i] <= 0) continue;
      lots++;
      c.crimeSum += w.crime[i]; c.crimeN++;
      c.covSum += w.policeCov[i]; c.covN++;
      if (w.crime[i] > KNOBS.CRIME_HIGH) hot++;
    }
    if (lots) { c.hotSum += hot / lots; c.hotN++; }
  }
  for (const f of w.events.files) if (seen.has(f) && !f.closed && (f.cause === "killing" || f.cause === "burglary")) fate.open++;
  fate.gone = Math.max(0, fate.opened - fate.arrest - fate.cold - fate.open);
  const cen = w.last.census;
  // The roster weight's own multiplier, read from the shipped function and read
  // at the END: world.fireCov is recomputed by computeFields at the top of every
  // tick, so straight after staff() it still describes a town with no stations.
  const exposure = fireExposure(w).share;
  return {
    seed, n, P: cen.P, fire: cen.fireStations, police: cen.policeStations,
    fireCov: share(w, w.fireCov), polCov: c.covN ? c.covSum / c.covN : 0,
    ignitions: c.ignitions, lost: c.lost, saved: c.saved, alight: c.alight, primary: c.primary, tornado: c.tornado, exposure,
    builtLots: (() => { let k = 0; for (let i = 0; i < w.w * w.h; i++) if (w.tier[i] > 0) k++; return k; })(),
    crime: c.crimeN ? c.crimeSum / c.crimeN : 0,
    hot: c.hotN ? (100 * c.hotSum) / c.hotN : 0,
    opened: fate.opened, arrests: fate.arrest, cold: fate.cold, gone: fate.gone,
    sceneCov: fate.opened ? fate.covSum / fate.opened : 0,
    sceneDark: fate.covs.length ? (100 * fate.covs.filter((x) => x === 0).length) / fate.covs.length : 0,
    maxFiles: fate.maxFiles,
    solved: fate.opened ? (100 * fate.arrest) / fate.opened : 0,
  };
}

const rows = [];
for (const n of COUNTS) for (const s of SEEDS) rows.push(run(s, n));

// Fire spreads at FIRE_SPREAD to four neighbours for two months off a beat:
// ~2.4 offspring per burning lot, a SUPERCRITICAL branching process, stopped
// only by the road ring. So a run either loses a whole block or almost none,
// and the mean of `fires lit` is a coin flip on how many blocks went up. The
// median is the honest middle; both are printed, and where they disagree the
// mean is being carried by one town that burned.
const median = (xs) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const meds = new Map();
for (const n of COUNTS) meds.set(n, { lit: median(rows.filter((r) => r.n === n).map((r) => r.ignitions)), lost: median(rows.filter((r) => r.n === n).map((r) => r.lost)) });

const by = new Map();
const FIELDS = ["P", "fireCov", "polCov", "ignitions", "lost", "saved", "primary", "tornado", "builtLots", "exposure", "crime", "hot", "opened", "arrests", "cold", "gone", "sceneCov", "sceneDark", "maxFiles", "solved"];
for (const r of rows) {
  let g = by.get(r.n);
  if (!g) { g = { n: r.n, k: 0 }; for (const f of FIELDS) g[f] = 0; by.set(r.n, g); }
  g.k++;
  for (const f of FIELDS) g[f] += r[f];
}
const r1 = (x) => Math.round(x * 10) / 10;

if (CSV) {
  console.log("seed,stations,P,fireCovPct,polCovMean,ignitions,lost,crime,hotPct,opened,arrests,cold,gone,sceneCov,solvedPct");
  for (const r of rows) console.log([r.seed, r.n, r.P, r1(r.fireCov), r1(r.polCov), r.ignitions, r.lost, r1(r.crime), r1(r.hot), r.opened, r.arrests, r.cold, r.gone, r1(r.sceneCov), r1(r.solved)].join(","));
} else {
  console.log(`serviceprobe: ${SEEDS.length} seeds, ${WARM}y warm-up then ${YEARS}y with disasters on, nine 8x8 blocks\n`);
  console.log("FIRE — a station changes where a fire starts, how long it burns and how far it spreads.");
  console.log(FORCED
    ? `HOW BAD a fire is — one forced through the roster card every ${FORCED} months, rolled disasters off.`
    : "HOW OFTEN and HOW BAD, both read off rolled fires — see the header: at ~3 rolls per run this is noise. Use --forced.");
  console.log("| each | built lots | covered | roll weight | fires | lit per fire | lost (mean / median) | saved | lost per fire |");
  console.log("|---|---|---|---|---|---|---|---|---|");
  for (const n of COUNTS) {
    const g = by.get(n), k = g.k, m = meds.get(n);
    console.log(`| ${n} fire | ${Math.round(g.builtLots / k)} | ${r1(g.fireCov / k)}% | ×${Math.round((g.exposure / k) * 100) / 100} | ${r1(g.primary / k)} | ${g.primary ? r1(g.ignitions / g.primary) : "—"} | ${r1(g.lost / k)} / ${r1(m.lost)} | ${r1(g.saved / k)} | ${g.ignitions ? r1(g.lost / g.ignitions) : "—"} |`);
  }
  console.log("\nCRIME — the field, and then the files it opens.");
  console.log("| each | mean police cover | mean crime | lots hot | cover at the scene |");
  console.log("|---|---|---|---|---|");
  for (const n of COUNTS) {
    const g = by.get(n), k = g.k;
    console.log(`| ${n} police | ${r1(g.polCov / k)}/60 | ${r1(g.crime / k)} | ${r1(g.hot / k)}% | ${r1(g.sceneCov / k)}/60 (${r1(g.sceneDark / k)}% of scenes dark) |`);
  }
  console.log("\nFILES — how a killing or a burglary ENDS. `gone` is the quiet door: the culprit died or left town.");
  console.log("| each | opened | arrest | cold | gone | solved |");
  console.log("|---|---|---|---|---|---|");
  for (const n of COUNTS) {
    const g = by.get(n), k = g.k;
    console.log(`| ${n} police | ${r1(g.opened / k)} | ${r1(g.arrests / k)} | ${r1(g.cold / k)} | ${r1(g.gone / k)} | ${g.opened ? r1((100 * g.arrests) / g.opened) : "—"}% |`);
  }
  console.log(`\nPer seed, over ${YEARS} years. A burglary going cold prints NOTHING (justice.js only writes COLD for a killing).`);
}
