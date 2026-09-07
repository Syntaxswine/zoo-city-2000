// lineageprobe.mjs — does a short-lived species out-compound a long-lived one when skill is
// INHERITED across generations? The owner's claim (2026-09-07): "the shorter lives should mean
// faster generational growth of knowledge, they can iterate and improve on what they learned from
// their parents." (docs/PROPOSAL-GENERATIONS-AND-SKILLS-2026-09-07.md §2c). Passive: exit 0, prints,
// never judges; nothing in the sim changes.
//
// Runs the scripted mayor's town and keeps a shadow ledger OUTSIDE the sim: months worked per
// trade (C / I / M) for every animal, and at every native birth
//   inherited = floor(FID × the most-practised adult in the household's months)   (fidelity)
//   gen       = 1 + that adult's gen, if they have practised ≥ 12 months          (the ratchet)
//   credit    = own months + inherited + GEN_CREDIT × gen                         (what the band reads)
// Bands: green 12, journeyman 48, master 120 (freestone's, for comparison).
//
//   node tools/lineageprobe.mjs [--layout balanced|estate] [--seed 7] [--years 60] [--fid 0.5] [--gen 24]
//
// THE FINDING (2026-09-07): the deepest generation reached is ONE, even at 90 years, because at
// sixteen a cub splits into a one-animal household and nothing ever merges households — every
// native adult lives alone, so the town's own children never have children. The ratchet cannot
// turn until natives can pair (BACKLOG L1, the wedding's household-merge rule).
import { createWorld, ZONE, jobZone } from "../js/sim/world.js";
import { createMayor } from "./mayor.mjs";
import { tick } from "../js/sim/tick.js";
import { SPECIES_BY_ID } from "../js/sim/species.js";
import { KNOBS } from "../js/sim/rules.js";
import { ageYears } from "../js/sim/census.js";

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] != null ? args[i + 1] : d; };
const layout = arg("--layout", "balanced");
const seed = arg("--seed", "7");
const years = Number(arg("--years", 60));
const FID = Number(arg("--fid", 0.5));
const GEN_CREDIT = Number(arg("--gen", 24));

const BANDS = ["untrained", "green", "journeyman", "master"];
const bandOf = (m) => m >= 120 ? 3 : m >= 48 ? 2 : m >= 12 ? 1 : 0;
const TRADES = ["C", "I", "M"];
const TRADE = { [ZONE.C]: "C", [ZONE.I]: "I", [ZONE.M]: "M" };

const world = createWorld({ seed });
const mayor = createMayor(world, { layout, rates: [8, 8, 8], disasters: false });

const led = new Map(); // id -> { C, I, M, gen: {C,I,M}, inherited: {C,I,M}, native }
const fresh = (native) => ({ C: 0, I: 0, M: 0, gen: { C: 0, I: 0, M: 0 }, inherited: { C: 0, I: 0, M: 0 }, native });
const seen = new Set();
let births = 0, birthsWithSkilledParent = 0, birthsWithNativeParent = 0;

for (let t = 0; t < years * 12; t++) {
  mayor.month(t);
  tick(world);
  for (const c of world.citizens) {
    if (c.dead) continue;
    if (!seen.has(c.id)) {
      seen.add(c.id);
      const r = fresh(c.native);
      if (c.native) { // natives exist only by birth; at first sight the cub is at home with its parents
        births++;
        const hh = world.hhById.get(c.household);
        const parents = (hh?.members || []).map((id) => world.byId.get(id)).filter((p) => p && p.id !== c.id && ageYears(world, p) >= KNOBS.ADULT_AGE);
        if (parents.some((p) => p.native)) birthsWithNativeParent++;
        let skilled = false;
        for (const d of TRADES) {
          let bestM = 0, bestGen = 0;
          for (const p of parents) {
            const pr = led.get(p.id);
            if (!pr) continue;
            if (pr[d] > bestM) bestM = pr[d];
            const g = pr.gen[d] + (pr[d] >= 12 ? 1 : 0);
            if (g > bestGen) bestGen = g;
          }
          r.inherited[d] = Math.floor(FID * bestM);
          r.gen[d] = bestGen;
          if (bestM >= 48) skilled = true;
        }
        if (skilled) birthsWithSkilledParent++;
      }
      led.set(c.id, r);
    }
    if (c.job < 0) continue;
    const d = TRADE[jobZone(world, c.job)];
    if (d) led.get(c.id)[d]++;
  }
}

const credit = (r, d) => r[d] + r.inherited[d] + GEN_CREDIT * r.gen[d];
const bestTrade = (r) => TRADES.reduce((a, d) => credit(r, d) > credit(r, a) ? d : a, "C");

const employed = world.citizens.filter((c) => !c.dead && c.job >= 0);
const bySp = {};
for (const c of employed) {
  const r = led.get(c.id);
  const d = bestTrade(r);
  const s = (bySp[c.species] ||= { n: 0, tenure: [0, 0, 0, 0], lineage: [0, 0, 0, 0], genSum: 0, genMax: 0, natives: 0, nativeMasters: 0, nativeMastersTenure: 0 });
  s.n++;
  s.tenure[bandOf(r[d])]++;
  const b = bandOf(credit(r, d));
  s.lineage[b]++;
  s.genSum += r.gen[d];
  if (r.gen[d] > s.genMax) s.genMax = r.gen[d];
  if (r.native) { s.natives++; if (b === 3) s.nativeMasters++; if (bandOf(r[d]) === 3) s.nativeMastersTenure++; }
}
let nativeAdults = 0, nativeAdultsAlone = 0;
for (const c of world.citizens) {
  if (c.dead || !c.native || ageYears(world, c) < KNOBS.ADULT_AGE) continue;
  nativeAdults++;
  const hh = world.hhById.get(c.household);
  const others = (hh?.members || []).filter((id) => id !== c.id).map((id) => world.byId.get(id)).filter((p) => p && ageYears(world, p) >= KNOBS.ADULT_AGE);
  if (!others.length) nativeAdultsAlone++;
}

// Generation time from the roster: the middle of the fertile window (a rule of thumb, not the sim's measured value).
const genTime = (sp) => Math.round((sp.fertile[0] + sp.fertile[1]) / 2);
const totalT = [0, 0, 0, 0], totalL = [0, 0, 0, 0];
for (const s of Object.values(bySp)) for (let k = 0; k < 4; k++) { totalT[k] += s.tenure[k]; totalL[k] += s.lineage[k]; }
const pct = (n, d) => d ? `${Math.round(100 * n / d)}%` : "-";

console.log(`lineageprobe — layout ${layout} · seed ${seed} · ${years} y · fidelity ${FID} · generation credit ${GEN_CREDIT} months`);
console.log(`births ${births} · to a household with a ≥4-y skilled adult ${birthsWithSkilledParent} (${pct(birthsWithSkilledParent, births)}) · to a NATIVE parent ${birthsWithNativeParent} (${pct(birthsWithNativeParent, births)})`);
console.log(`native adults alive at the end ${nativeAdults}, living with no other adult ${nativeAdultsAlone} (${pct(nativeAdultsAlone, nativeAdults)}) — the town's own children ${birthsWithNativeParent ? "sometimes" : "never"} have children`);
console.log(`employed at the end ${employed.length}: by TENURE ${BANDS.map((b, k) => `${b} ${pct(totalT[k], employed.length)}`).join(" · ")}`);
console.log(`                        by LINEAGE ${BANDS.map((b, k) => `${b} ${pct(totalL[k], employed.length)}`).join(" · ")}`);
console.log(`\n  species    n  genT | masters by tenure | masters by lineage | mean gen  max gen | natives  native masters (tenure → lineage)`);
for (const [sp, s] of Object.entries(bySp).sort((a, b) => genTime(SPECIES_BY_ID[a[0]]) - genTime(SPECIES_BY_ID[b[0]]))) {
  console.log(`  ${sp.padEnd(9)} ${String(s.n).padStart(4)}  ${String(genTime(SPECIES_BY_ID[sp])).padStart(3)}y | ${String(s.tenure[3]).padStart(5)} (${pct(s.tenure[3], s.n).padStart(3)})     | ${String(s.lineage[3]).padStart(5)} (${pct(s.lineage[3], s.n).padStart(3)})      | ${(s.genSum / s.n).toFixed(2).padStart(6)}   ${String(s.genMax).padStart(4)}    | ${String(s.natives).padStart(5)}    ${String(s.nativeMastersTenure).padStart(3)} → ${String(s.nativeMasters).padStart(3)}`);
}
