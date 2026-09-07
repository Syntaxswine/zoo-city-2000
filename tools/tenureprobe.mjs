// tenureprobe.mjs — how long does a Zoo City animal hold ONE JOB, and ONE TRADE?
// The first instrument of the generations-and-skills arc
// (docs/PROPOSAL-GENERATIONS-AND-SKILLS-2026-09-07.md §2). Passive: exit 0,
// prints, never judges; nothing in the sim changes.
//
// Runs the scripted mayor's town (tools/mayor.mjs, the same town every published
// rig runs) and reads `c.hired` — already saved on every citizen, so tenure at the
// current job needs no new state — plus a ledger kept OUTSIDE the sim of months
// worked per trade (jobZone: C / I / M), the shadow of freestone's Person.worked{}.
// Bands are freestone's for comparison: green 12 months, journeyman 48, master 120.
//
//   node tools/tenureprobe.mjs [--layout balanced|estate|dormitory|millbelt] [--seed 7]
//                              [--years 30] [--stations] [--markets N]
//
// Also tallies the KEEPER of every job lot (its most senior hand): when the keeper
// leaves the lot, was a ≥4-year hand standing there to take over (passed) or not
// (lost)? Measured 2026-09-07: a keeper changes once per ~20 lot-years, and 81–87%
// of lots hold an heir — succession is a rare, LOCAL shock.
import { createWorld, ZONE, jobZone } from "../js/sim/world.js";
import { createMayor } from "./mayor.mjs";
import { tick } from "../js/sim/tick.js";
import { SPECIES_BY_ID } from "../js/sim/species.js";
import { KNOBS } from "../js/sim/rules.js";
import { ageYears } from "../js/sim/census.js";
import { shopOf } from "../js/sim/shops.js";

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] != null ? args[i + 1] : d; };
const flag = (k) => args.includes(k);
const layout = arg("--layout", "balanced");
const seed = arg("--seed", "7");
const years = Number(arg("--years", 30));
const stations = flag("--stations");
const markets = Number(arg("--markets", 0));

const BANDS = ["untrained", "green", "journeyman", "master"];
const bandOf = (months) => months >= 120 ? 3 : months >= 48 ? 2 : months >= 12 ? 1 : 0;
const TRADE = { [ZONE.C]: "C", [ZONE.I]: "I", [ZONE.M]: "M" };

const world = createWorld({ seed });
const mayor = createMayor(world, { layout, rates: [8, 8, 8], disasters: false, stations, markets });

const worked = new Map(); // id -> { C, I, M, spells, lastJob, first }
const rec = (id) => { let r = worked.get(id); if (!r) worked.set(id, (r = { C: 0, I: 0, M: 0, spells: 0, lastJob: -1, first: -1 })); return r; };
const tradeMonths = (r) => Math.max(r.C, r.I, r.M);
const tradeOf = (r) => r.C >= r.I && r.C >= r.M ? "C" : r.I >= r.M ? "I" : "M";

let prevVeterans = new Map(); // id -> band (by trade months), employed last tick
const rows = [];
const seen = new Set();
let yearBirths = 0, yearArrivals = 0, yearLost = { gone: 0, retired: 0, fired: 0 };

const keeperOf = new Map(); // lot -> id
let yearSucc = { passed: 0, lost: 0, lotsStaffed: 0 };
const succTotal = { passed: 0, lost: 0, passedToMaster: 0 };

for (let t = 0; t < years * 12; t++) {
  mayor.month(t);
  tick(world);
  {
    const staffByLot = new Map();
    for (const c of world.citizens) {
      if (c.dead || c.job < 0) continue;
      let l = staffByLot.get(c.job); if (!l) staffByLot.set(c.job, (l = []));
      l.push(c);
    }
    for (const [lot, staff] of staffByLot) {
      staff.sort((a, b) => (b.hired < a.hired ? -1 : b.hired > a.hired ? 1 : a.id - b.id));
      const senior = staff[0];
      const prev = keeperOf.get(lot);
      if (prev != null && prev !== senior.id && !staff.some((c) => c.id === prev)) {
        const months = world.tick - senior.hired;
        if (months >= 48) { yearSucc.passed++; succTotal.passed++; if (months >= 120) succTotal.passedToMaster++; }
        else { yearSucc.lost++; succTotal.lost++; }
      }
      keeperOf.set(lot, senior.id);
    }
    for (const lot of [...keeperOf.keys()]) if (!staffByLot.has(lot)) keeperOf.delete(lot);
    yearSucc.lotsStaffed = staffByLot.size;
  }
  for (const c of world.citizens) {
    if (c.dead) continue;
    if (!seen.has(c.id)) { seen.add(c.id); if (c.native) yearBirths++; else yearArrivals++; }
    if (c.job < 0) continue;
    const z = TRADE[jobZone(world, c.job)];
    if (!z) continue;
    const r = rec(c.id);
    r[z]++;
    if (r.first < 0) r.first = world.tick;
    if (r.lastJob !== c.job) { r.spells++; r.lastJob = c.job; }
  }
  const now = new Map();
  for (const c of world.citizens) {
    if (c.dead || c.job < 0) continue;
    const r = worked.get(c.id);
    if (r && bandOf(tradeMonths(r)) >= 2) now.set(c.id, bandOf(tradeMonths(r)));
  }
  for (const [id] of prevVeterans) {
    if (now.has(id)) continue;
    const c = world.byId.get(id);
    if (!c || c.dead) yearLost.gone++;
    else if (ageYears(world, c) >= SPECIES_BY_ID[c.species].retire) yearLost.retired++;
    else yearLost.fired++;
  }
  prevVeterans = now;

  if (t % 12 === 11) {
    const cen = world.last.census;
    const lot = [0, 0, 0, 0], trade = [0, 0, 0, 0];
    let employed = 0;
    for (const c of world.citizens) {
      if (c.dead || c.job < 0) continue;
      employed++;
      lot[bandOf(world.tick - c.hired)]++;
      const r = worked.get(c.id);
      trade[bandOf(r ? tradeMonths(r) : 0)]++;
    }
    rows.push({ year: (t + 1) / 12, P: cen.P, employed, lot, trade, births: yearBirths, arrivals: yearArrivals, lost: { ...yearLost }, succ: { ...yearSucc } });
    yearBirths = 0; yearArrivals = 0; yearLost = { gone: 0, retired: 0, fired: 0 };
    yearSucc = { passed: 0, lost: 0, lotsStaffed: 0 };
  }
}

const employed = world.citizens.filter((c) => !c.dead && c.job >= 0);
const lotTenures = employed.map((c) => world.tick - c.hired).sort((a, b) => a - b);
const q = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : 0;
const spellHist = {};
for (const c of employed) { const s = Math.min(worked.get(c.id)?.spells || 1, 5); spellHist[s] = (spellHist[s] || 0) + 1; }

const bySpecies = {};
for (const c of employed) {
  const r = worked.get(c.id);
  const b = bandOf(r ? tradeMonths(r) : 0);
  const s = (bySpecies[c.species] ||= { n: 0, bands: [0, 0, 0, 0], tenureSum: 0 });
  s.n++; s.bands[b]++; s.tenureSum += r ? tradeMonths(r) : 0;
}

let cubs = 0, cubsWithVeteran = 0;
for (const c of world.citizens) {
  if (c.dead || ageYears(world, c) >= KNOBS.ADULT_AGE) continue;
  cubs++;
  const hh = world.hhById.get(c.household);
  if (!hh) continue;
  if (hh.members.some((id) => { const r = worked.get(id); return r && bandOf(tradeMonths(r)) >= 2 && id !== c.id; })) cubsWithVeteran++;
}

const veterans = world.citizens.filter((c) => !c.dead && worked.get(c.id)).map((c) => {
  const r = worked.get(c.id);
  const where = c.job >= 0 ? c.job : r.lastJob;
  const shop = where >= 0 ? shopOf(world, where) : null;
  const place = where < 0 ? "no job" : shop ? shop.name : `${["-", "R", "C", "I", "M"][world.zone[where]] || "civic"}${world.tier[where] ? ` t${world.tier[where]}` : ""} at (${where % world.w},${(where / world.w) | 0})`;
  return { name: `${c.name} ${c.surname}`, species: c.species, age: ageYears(world, c), months: tradeMonths(r), trade: tradeOf(r), spells: r.spells, place, working: c.job >= 0 };
}).sort((a, b) => b.months - a.months).slice(0, 8);

let inNamedShop = 0, inC = 0, inI = 0, inM = 0, inCivic = 0;
for (const c of employed) {
  const i = c.job;
  if (world.zone[i] === ZONE.C) { inC++; if (world.tier[i] === 1) inNamedShop++; }
  else if (world.zone[i] === ZONE.I) inI++;
  else if (world.zone[i] === ZONE.M) inM++;
  else inCivic++;
}

const pct = (n, d) => d ? `${Math.round(100 * n / d)}%` : "-";
console.log(`tenureprobe — layout ${layout} · seed ${seed} · ${years} y · stations ${stations} · markets ${markets}`);
console.log(" yr     P  empl | LOT tenure  unt  grn  jny  mst | TRADE months  unt  grn  jny  mst | born arriv | veterans out: gone ret fired");
for (const r of rows) {
  if (r.year % 5 !== 0 && r.year !== 1) continue;
  console.log(`${String(r.year).padStart(3)} ${String(r.P).padStart(5)} ${String(r.employed).padStart(5)} |             ${r.lot.map((n) => String(n).padStart(4)).join(" ")} |              ${r.trade.map((n) => String(n).padStart(4)).join(" ")} | ${String(r.births).padStart(4)} ${String(r.arrivals).padStart(5)} |               ${String(r.lost.gone).padStart(4)} ${String(r.lost.retired).padStart(3)} ${String(r.lost.fired).padStart(5)}`);
}
const last = rows[rows.length - 1];
console.log(`\nend of year ${years}: employed ${employed.length} of P ${last.P}`);
console.log(`  lot tenure (months at the CURRENT job): median ${q(lotTenures, 0.5)} · p25 ${q(lotTenures, 0.25)} · p75 ${q(lotTenures, 0.75)} · max ${q(lotTenures, 1)}`);
console.log(`  by LOT tenure:   ${BANDS.map((b, k) => `${b} ${last.lot[k]} (${pct(last.lot[k], employed.length)})`).join(" · ")}`);
console.log(`  by TRADE months: ${BANDS.map((b, k) => `${b} ${last.trade[k]} (${pct(last.trade[k], employed.length)})`).join(" · ")}`);
console.log(`  jobs held so far (spells) among the employed: ${Object.entries(spellHist).map(([k, v]) => `${k}${k === "5" ? "+" : ""}: ${v}`).join(" · ")}`);
console.log(`  where: C ${inC} (tier-1 named shops ${inNamedShop}) · I ${inI} · M ${inM} · civic ${inCivic}`);
console.log(`  cubs ${cubs}, living with a journeyman-or-better: ${cubsWithVeteran} (${pct(cubsWithVeteran, cubs)})`);
const totalLost = rows.reduce((a, r) => ({ gone: a.gone + r.lost.gone, retired: a.retired + r.lost.retired, fired: a.fired + r.lost.fired }), { gone: 0, retired: 0, fired: 0 });
console.log(`  veterans (journeyman+) leaving work over the run: died/left ${totalLost.gone} · retired ${totalLost.retired} · lost the job ${totalLost.fired}`);
const succYears = rows.map((r) => `${r.year}:${r.succ.passed}/${r.succ.lost}`).filter((_, k) => (k + 1) % 5 === 0);
console.log(`  KEEPER SUCCESSION (passed to a ≥4-y hand on the lot / lost to a greener one), every 5th year: ${succYears.join("  ")}`);
console.log(`    over the run: passed ${succTotal.passed} (${succTotal.passedToMaster} to a 10-y hand) · lost ${succTotal.lost} · staffed lots at the end ${last.succ.lotsStaffed} — a keeper changes every ${(years * last.succ.lotsStaffed / Math.max(1, succTotal.passed + succTotal.lost)).toFixed(1)} lot-years`);
{
  const staffByLot = new Map();
  for (const c of employed) { let l = staffByLot.get(c.job); if (!l) staffByLot.set(c.job, (l = [])); l.push(c); }
  const kb = [0, 0, 0, 0]; let solo = 0, withHeir = 0;
  for (const [, staff] of staffByLot) {
    staff.sort((a, b) => a.hired - b.hired || a.id - b.id);
    kb[bandOf(world.tick - staff[0].hired)]++;
    if (staff.length === 1) solo++;
    else if (staff.slice(1).some((c) => world.tick - c.hired >= 48)) withHeir++;
  }
  console.log(`    keepers now by lot tenure: ${BANDS.map((b, k) => `${b} ${kb[k]}`).join(" · ")} · one-hand lots ${solo} · lots with a ≥4-y second hand (an heir) ${withHeir} of ${staffByLot.size}`);
}
console.log(`\n  by species (employed at the end): species n | untrained green journeyman master | mean trade months`);
for (const [sp, s] of Object.entries(bySpecies).sort((a, b) => b[1].n - a[1].n)) {
  console.log(`    ${sp.padEnd(9)} ${String(s.n).padStart(4)} | ${s.bands.map((n) => String(n).padStart(4)).join(" ")} | ${Math.round(s.tenureSum / s.n)}  (retire ${SPECIES_BY_ID[sp].retire}, life ${SPECIES_BY_ID[sp].life})`);
}
console.log(`\n  the longest-serving:`);
for (const v of veterans) console.log(`    ${v.name} (${v.species}, ${v.age}) — ${v.months} months in trade ${v.trade} over ${v.spells} job${v.spells === 1 ? "" : "s"}; ${v.working ? "at" : "last at"} ${v.place}`);
