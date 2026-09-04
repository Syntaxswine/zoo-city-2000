// camprobe.mjs — the camera network, and what it does to a town's justice.
//
// An INSTRUMENT: it reports and never halts, never gates, exit 0 always.
//
// docs/PROPOSAL-CAMERAS.md §11 names this probe as the measurement for every
// balance risk the design carries. It sweeps camera COUNT against a fixed
// police force and reports the three things the design claims and the one it
// is most likely to get wrong:
//
//   CLEARANCE   arrests, files gone cold, solved%          (the claim)
//   WRONGFUL    wrongful arrests, exonerations, and the    (the cost)
//               files that go cold with somebody already
//               serving their sentence
//   DETERRENCE  mean crime, share of lots hot, burglaries  (must BARELY move)
//   THE BRAKE   population, the R valve                    (§11's first risk)
//
// It is written to run against a checkout that has NO cameras in it, so the
// before and the after are measured on ONE rig rather than two that do not
// compare (serviceprobe took the same care with fireExposure). Ask for
// cameras on a tree that cannot place them and it says so and keeps going.
//
//   node tools/camprobe.mjs [--seeds 7,3,5,11] [--years 30] [--warm 8]
//                           [--cams 0,10,20,40] [--police 1] [--csv]
//
// The rig is serviceprobe's: playtest's 8x8 blocks (a road ring round a 6x6
// interior) opened in a spiral, R I C R I C ..., warmed for --warm years with
// disasters off, then the stations and cameras go in, then --years with
// disasters ON. Cash is topped up every month — this is not a budget
// experiment, and the network fee is read from the ledger, not from ruin.

import { createWorld, ZONE, TERRAIN, idx, inBounds, ROAD } from "../js/sim/world.js";
import { tick } from "../js/sim/tick.js";
import { apply } from "../js/sim/ops.js";
import { KNOBS } from "../js/sim/rules.js";
import { census } from "../js/sim/census.js";

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const SEEDS = String(arg("--seeds", "7,3,5,11")).split(",");
const YEARS = Number(arg("--years", 30));
const WARM = Number(arg("--warm", 8));
const CAMS = String(arg("--cams", "0,10,20,40")).split(",").map(Number);
const POLICE = Number(arg("--police", 1));
const CSV = argv.includes("--csv");
// --cap N overrides KNOBS.CAM_CAP for the whole sweep, so the brake can be
// A/B'd ON against OFF at the SAME camera count on the same rig. Two earlier
// drafts of this brake measured as no-ops and were only caught this way;
// docs/PROPOSAL-CAMERAS.md §11 pre-registers it as the first balance risk.
const CAP = arg("--cap", null);
if (CAP !== null) KNOBS.CAM_CAP = Number(CAP);

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

/** Police stations, one per block, on a bulldozed interior lot. serviceprobe's staff(). */
function staff(w, open, n) {
  let placed = 0;
  for (let pass = 0; pass < 2 && placed < n; pass++) {
    for (const [x0, y0] of open) {
      if (placed >= n) break;
      const tx = pass ? x0 + BLOCK - 1 : x0 + 1;
      const ty = pass ? y0 + BLOCK - 1 : y0 + 1;
      if (!inBounds(w, tx, ty)) continue;
      w.cash = 100000;
      apply(w, { kind: "bulldoze", x0: tx, y0: ty, x1: tx, y1: ty });
      if (apply(w, { kind: "police", tx, ty }).ok) placed++;
    }
  }
  w.cash = 100000;
  return placed;
}

/**
 * `n` cameras, spread as evenly as a player would spread them: every road tile
 * in the town, in a stable order, sampled at a fixed stride. Never clustered
 * on one street, because a clustered network measures saturation and not
 * coverage. Returns 0 on a tree with no camera op — see the header.
 */
function watch(w, n) {
  if (!n) return 0;
  const roads = [];
  for (let i = 0; i < w.w * w.h; i++) if (w.road[i] !== ROAD.NONE) roads.push(i);
  if (!roads.length) return 0;
  const stride = Math.max(1, Math.floor(roads.length / n));
  let placed = 0;
  for (let k = 0; k < roads.length && placed < n; k += stride) {
    const i = roads[k];
    w.cash = 100000;
    // The camera op is a DRAG (tiles), like the road and wall ops — not a
    // click with tx/ty. This probe was written before the op existed and
    // guessed the click shape; it reported `placed 0` rather than lying,
    // which is the whole reason it degrades instead of throwing.
    let r = null;
    try { r = apply(w, { kind: "camera", tiles: [i] }); } catch { return 0; }
    if (!r || !r.ok) continue;
    placed++;
  }
  w.cash = 100000;
  return placed;
}

function run(seed, cams) {
  const { w, open } = town(seed);
  staff(w, open, POLICE);
  const placed = watch(w, cams);
  apply(w, { kind: "toggle", key: "noDisasters", value: false });
  const N = w.w * w.h;
  const seen = new Set();
  const seenArrest = new Set();
  const c = {
    opened: 0, arrests: 0, cold: 0, coldServing: 0, burglaries: 0, identified: 0,
    crimeSum: 0, crimeN: 0, hotSum: 0, hotN: 0, sceneDark: 0, valveSum: 0, watchSum: 0,
  };
  const j0 = w.events.justice;
  const base = { wrongful: j0.wrongful || 0, exonerated: j0.exonerated || 0, cold: j0.cold || 0 };
  for (let t = 0; t < YEARS * 12; t++) {
    w.cash = Math.max(w.cash, 20000);
    const { notices } = tick(w);
    for (const f of w.events.files) {
      if (f.cause === "trespass" || seen.has(f)) continue;
      seen.add(f);
      if (f.cause === "killing" || f.cause === "burglary") {
        c.opened++;
        if (w.policeCov[f.tile] === 0) c.sceneDark++;
      }
    }
    for (const a of w.events.arrests) {
      if (seenArrest.has(a)) continue;
      seenArrest.add(a);
      if (a.cause === "killing" || a.cause === "burglary") c.arrests++;
    }
    for (const line of notices) {
      if (/^BURGLARY/.test(line)) c.burglaries++;
      else if (/^IDENTIFIED/.test(line)) c.identified++;
      if (/is serving the sentence/.test(line)) c.coldServing++;
    }
    let hot = 0, lots = 0;
    for (let i = 0; i < N; i++) {
      if (w.tier[i] <= 0) continue;
      lots++;
      c.crimeSum += w.crime[i];
      c.crimeN++;
      if (w.crime[i] > KNOBS.CRIME_HIGH) hot++;
    }
    if (lots) { c.hotSum += hot / lots; c.hotN++; }
    c.valveSum += w.valves.R;
    c.watchSum += w.last?.census?.watchedShare || 0;
  }
  const j = w.events.justice;
  const cen = census(w);
  return {
    seed, cams, placed, police: cen.policeStations, P: cen.P,
    opened: c.opened, arrests: c.arrests,
    wrongful: (j.wrongful || 0) - base.wrongful,
    exonerated: (j.exonerated || 0) - base.exonerated,
    cold: (j.cold || 0) - base.cold,
    coldServing: c.coldServing,
    identified: c.identified,
    burglaries: c.burglaries,
    solved: c.opened ? (100 * c.arrests) / c.opened : 0,
    sceneDark: c.opened ? (100 * c.sceneDark) / c.opened : 0,
    crime: c.crimeN ? c.crimeSum / c.crimeN : 0,
    hot: c.hotN ? (100 * c.hotSum) / c.hotN : 0,
    valveR: c.valveSum / (YEARS * 12),
    watched: c.watchSum / (YEARS * 12),
  };
}

const FIELDS = ["P", "opened", "arrests", "wrongful", "exonerated", "cold", "coldServing", "identified", "burglaries", "solved", "sceneDark", "crime", "hot", "valveR", "watched"];
const rows = [];
for (const seed of SEEDS) for (const n of CAMS) rows.push(run(seed, n));

const r1 = (v) => (Math.round(v * 10) / 10).toFixed(1);
const r2 = (v) => (Math.round(v * 100) / 100).toFixed(2);
const mean = (n, f) => { const s = rows.filter((r) => r.cams === n); return s.reduce((a, r) => a + r[f], 0) / (s.length || 1); };
const placedAt = (n) => mean(n, "placed");

if (CSV) {
  console.log(["cams", "seed", "placed", ...FIELDS].join(","));
  for (const r of rows) console.log([r.cams, r.seed, r.placed, ...FIELDS.map((f) => (typeof r[f] === "number" ? r2(r[f]) : r[f]))].join(","));
} else {
  console.log(`camprobe — ${SEEDS.length} seeds x ${YEARS}y, ${POLICE} police station${POLICE === 1 ? "" : "s"}, warm ${WARM}y, CAM_CAP ${KNOBS.CAM_CAP}. Per seed.`);
  const wanted = CAMS.find((n) => n > 0);
  if (wanted !== undefined && placedAt(wanted) === 0) console.log("NOTE: no camera was placed — this tree has no camera op. The 0-camera row is still a valid baseline.");
  console.log("");
  console.log("CLEARANCE — the claim: a camera SOLVES, and what solving costs.");
  console.log("| cams | placed | pop | opened | arrests | solved | cold | wrongful | exonerated | cold, someone serving |");
  console.log("|---|---|---|---|---|---|---|---|---|---|");
  for (const n of CAMS) console.log(`| ${n} | ${r1(placedAt(n))} | ${Math.round(mean(n, "P"))} | ${r1(mean(n, "opened"))} | ${r1(mean(n, "arrests"))} | ${r1(mean(n, "solved"))}% | ${r1(mean(n, "cold"))} | ${r1(mean(n, "wrongful"))} | ${r1(mean(n, "exonerated"))} | ${r1(mean(n, "coldServing"))} |`);
  console.log("");
  console.log("DETERRENCE — the anti-claim: these columns must BARELY move (§3).");
  console.log("| cams | mean crime | lots hot | burglaries | scenes dark | R valve | homes watched | pop |");
  console.log("|---|---|---|---|---|---|---|---|");
  for (const n of CAMS) console.log(`| ${n} | ${r2(mean(n, "crime"))} | ${r1(mean(n, "hot"))}% | ${r1(mean(n, "burglaries"))} | ${r1(mean(n, "sceneDark"))}% | ${r2(mean(n, "valveR"))} | ${r1(100 * mean(n, "watched"))}% | ${Math.round(mean(n, "P"))} |`);
  console.log("");
  console.log("A camera that lowers mean crime is off-thesis; one that does not raise arrests is cosmetic.");
}
