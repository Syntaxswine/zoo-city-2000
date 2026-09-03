#!/usr/bin/env node
// peopleprobe.mjs — which actionable need wins in three kinds of town.
// An instrument, never a gate: it always exits 0 and prints what it measured.

import { createWorld, isPart, ZONE } from "../js/sim/world.js";
import { tick } from "../js/sim/tick.js";
import { NEED_CODES } from "../js/sim/voice.js";
import { createMayor } from "./mayor.mjs";
import { needTruthResults } from "./need-fixtures.mjs";
import { COHERENT_STRESS_CODES, coherentStressFacts, coherentStressFixture } from "./need-stress.mjs";

const argv = process.argv.slice(2);
const arg = (name, fallback) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : fallback; };
const YEARS = Number(arg("--years", 30));
const SEEDS = String(arg("--seeds", "7,3,5,11")).split(",");
const LAYOUTS = String(arg("--layouts", "balanced,dormitory,millbelt")).split(",");

const totals = new Map(LAYOUTS.map((layout) => [layout, { samples: 0, codes: {} }]));
const stresses = [];

for (const layout of LAYOUTS) {
  for (let seedIndex = 0; seedIndex < SEEDS.length; seedIndex++) {
    const seed = SEEDS[seedIndex];
    const world = createWorld({ seed: `needs-${layout}-${seed}` });
    const mayor = createMayor(world, {
      layout,
      parks: layout === "balanced" ? 4 : layout === "millbelt" ? 1 : 0,
      markets: layout === "balanced" ? 1 : 0,
      stations: layout === "balanced",
    });
    for (let t = 0; t < YEARS * 12; t++) {
      mayor.month(t);
      // Let the industrial layout establish itself, then keep its works at
      // full output. This is the probe's deliberately ugly mill belt: it asks
      // whether a physically smoky town actually says SMOKE, not whether the
      // normal growth controller is good at keeping pollution comfortable.
      if (layout === "millbelt" && t >= 60) {
        for (let i = 0; i < world.zone.length; i++) {
          if (world.zone[i] === ZONE.I) world.tier[i] = 3;
          // A checker of little works through otherwise residential blocks:
          // never evict a household and never cut apart a joined building.
          // The normal field solver, not a made-up mood override, supplies
          // the resulting smoke at every nearby home.
          const tx = i % world.w, ty = (i / world.w) | 0;
          if (world.zone[i] === ZONE.R && !world.occupants[i] && !isPart(world, i) && (tx + ty) % 7 === 0) {
            world.zone[i] = ZONE.I;
            world.tier[i] = 3;
          }
        }
      }
      tick(world);
      let sampled = world;
      // A competent mayor prevents these edge states.  For the final six
      // samples of one run, observe declared, coherent stress municipalities
      // instead: 1,300 residents, real lots/roads/civics, balanced raw demand,
      // and derived fields rebuilt normally.  The mayor's town is untouched.
      if (YEARS >= 30 && layout === "balanced" && seedIndex === 0 && t >= YEARS * 12 - COHERENT_STRESS_CODES.length) {
        const stress = coherentStressFixture(COHERENT_STRESS_CODES[t - (YEARS * 12 - COHERENT_STRESS_CODES.length)], world.tick);
        stresses.push({ expected: stress.expected, actual: stress.actual, tick: stress.world.tick, facts: coherentStressFacts(stress) });
        sampled = stress.world;
      }
      const row = totals.get(layout);
      // tick's census cache was just built by passing every living citizen
      // through needOf with one shared context; consume it instead of doing
      // the same whole-population work twice.
      for (const [code, count] of Object.entries(sampled.last.needs)) {
        row.codes[code] = (row.codes[code] || 0) + count;
        row.samples += count;
      }
    }
  }
}

console.log(`peopleprobe: ${SEEDS.length} seeds × ${LAYOUTS.length} layouts × ${YEARS} years`);
console.log("| layout | samples | content | top three needs |");
console.log("|---|---:|---:|---|");
const allCodes = new Set();
for (const layout of LAYOUTS) {
  const row = totals.get(layout);
  for (const code of Object.keys(row.codes)) allCodes.add(code);
  const ranked = Object.entries(row.codes).filter(([code]) => code !== "CONTENT").sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const content = row.codes.CONTENT || 0;
  const pct = row.samples ? (100 * content / row.samples).toFixed(1) : "0.0";
  const top = ranked.slice(0, 3).map(([code, n]) => `${code} ${n} (${(100 * n / Math.max(1, row.samples - content)).toFixed(1)}%)`).join(" · ") || "—";
  console.log(`| ${layout} | ${row.samples} | ${content} (${pct}%) | ${top} |`);
}
const grand = {};
let nonContent = 0;
for (const row of totals.values()) for (const [code, n] of Object.entries(row.codes)) {
  grand[code] = (grand[code] || 0) + n;
  if (code !== "CONTENT") nonContent += n;
}
const dominant = Object.entries(grand).filter(([code]) => code !== "CONTENT").sort((a, b) => b[1] - a[1])[0];
const truth = needTruthResults();
const wrong = truth.filter((r) => r.expected !== r.actual);
const missing = NEED_CODES.filter((code) => !allCodes.has(code));
console.log(`\nlong-run observed ${[...allCodes].sort().join(", ") || "none"}`);
console.log(`longitudinal code coverage: ${NEED_CODES.length - missing.length}/${NEED_CODES.length}${missing.length ? ` · missing ${missing.join(", ")}` : ""}`);
console.log(`scheduled stress witnesses: ${stresses.filter(Boolean).map((r) => `${r.expected}→${r.actual}`).join(" · ") || "none"}`);
const badStress = stresses.filter((r) => r.facts.population !== 1300
  || r.facts.civicZoneOverlap || r.facts.occupiedTierZero || r.facts.homeOverflow
  || r.facts.jobOverflow || r.facts.badHousehold || r.facts.badPath);
console.log(`stress municipality integrity: ${stresses.length - badStress.length}/${stresses.length} valid · ${stresses[0]?.facts.population || 0} residents each`);
console.log(`focused truth table: ${truth.length - wrong.length}/${truth.length}`);
if (dominant) console.log(`largest non-content need: ${dominant[0]} ${(100 * dominant[1] / Math.max(1, nonContent)).toFixed(1)}%`);
