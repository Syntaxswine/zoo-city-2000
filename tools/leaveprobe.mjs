// leaveprobe.mjs — what makes a Zoo City household LEAVE today, by cause and by what was wrong at
// home the month it went; what a fire alone does; and a shadow of a PUSH rule where leaving takes
// a combination of factors. The owner (2026-09-07): "migration should definitely be bidirectional.
// it should take more than just a fire for people to leave, it would have to be a combination of
// factors." (docs/PROPOSAL-GENERATIONS-AND-SKILLS-2026-09-07.md §10.) Passive: exit 0, prints,
// never judges. --rule push runs the candidate OUTSIDE the sim, between ticks, through the sim's
// own removal (removeHousehold), so the archive and the dangling-id law hold as they would.
//
// Today's OUT channels (citizens.js): FRICTION — a household whose adults are all friendless
// wanders off at 0.4% a month; HOMELESS — the home is rubble (a fire) or gone and nothing within
// 12 road tiles has room, no tent tried; EVICTED / DISPLACED — a storey lost or a mansion risen,
// no home, no tent; ZONED OUT — the player's line; REVOLT — the tax event walks 8% of households
// out; and at V_R ≤ 0 the downturn roll pitches a TENT rather than leaving. Every departed animal
// carries its cause in the permanent archive (legacy.js), which is what this reads.
//
//   node tools/leaveprobe.mjs [--layout balanced|estate] [--seed 7] [--years 60] [--no-disasters]
//                             [--rule none|push] [--thresh 3] [--push-p 0.05] [--set KEY=VALUE]...
//
// The FACTORS, read at home the month before the family goes (each a yes/no; the push rule
// weighs them): unemployed (an adult worker with no job) 2 · friendless (no adult has a friend) 1
// · low mood (mean below 40) 1 · crime (above CRIME_HIGH at home) 1 · smoke (pollution above the
// species' tolerance) 1 · dread (a herbivore household at REHOME_DREAD) 1 · crowded (over capacity)
// 1 · taxed (the R rate more than a point above neutral) 1 · burned (the home burning or rubble
// within the year) 2. --rule push: score ≥ --thresh leaves at --push-p × (score − thresh + 1) a
// month. A fire alone scores 2: below a threshold of 3 it moves nobody out by itself.
import { createWorld, ZONE, absent, capacityOf } from "../js/sim/world.js";
import { createMayor } from "./mayor.mjs";
import { tick } from "../js/sim/tick.js";
import { SPECIES_BY_ID, DIET_OF } from "../js/sim/species.js";
import { KNOBS } from "../js/sim/rules.js";
import { ageYears, isWorker } from "../js/sim/census.js";
import { removeHousehold, compact } from "../js/sim/citizens.js";
import { legacyOf } from "../js/sim/legacy.js";
import { neutralRate } from "../js/sim/demand.js";

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] != null ? args[i + 1] : d; };
const flag = (k) => args.includes(k);
const layout = arg("--layout", "balanced");
const seed = arg("--seed", "7");
const years = Number(arg("--years", 60));
const rule = arg("--rule", "none");
const THRESH = Number(arg("--thresh", 3));
const PUSH_P = Number(arg("--push-p", 0.05));
const disasters = !flag("--no-disasters");
for (let k = 0; k < args.length; k++) if (args[k] === "--set" && args[k + 1]) { const [key, v] = args[k + 1].split("="); if (!(key in KNOBS)) { console.log(`--set ${key}: no such knob`); process.exit(2); } KNOBS[key] = Number(v); }
if (!["none", "push"].includes(rule)) { console.log(`--rule ${rule}: none or push`); process.exit(2); }

const WEIGHT = { unemployed: 2, friendless: 1, lowMood: 1, crime: 1, smoke: 1, dread: 1, crowded: 1, taxed: 1, burned: 2 };
const FACTORS = Object.keys(WEIGHT);
const MIGRATION = new Set(["left", "homeless", "evicted", "zonedOut", "revolt", "displaced", "bulldozed"]);

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rng = mulberry32([...String(seed)].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) | 0, 11) ^ 0x51ed270b);

const world = createWorld({ seed });
const mayor = createMayor(world, { layout, rates: [8, 8, 8], disasters });
const n = world.w * world.h;
const lastFire = new Int32Array(n).fill(-100000);

/** The factors at home this month, for a housed household. */
function profile(hh) {
  const home = hh.home;
  const members = hh.members.map((id) => world.byId.get(id)).filter((c) => c && !c.dead && !absent(world, c));
  if (!members.length) return null;
  const adults = members.filter((c) => ageYears(world, c) >= KNOBS.ADULT_AGE);
  const workers = adults.filter((c) => isWorker(world, c));
  const sp = SPECIES_BY_ID[hh.species];
  const P = world.last?.census?.P || 0;
  const f = {
    unemployed: workers.some((c) => c.job < 0),
    friendless: adults.length > 0 && adults.every((c) => c.friends.length === 0),
    lowMood: members.reduce((a, c) => a + c.mood, 0) / members.length < 40,
    crime: world.crime[home] > KNOBS.CRIME_HIGH,
    smoke: world.pol[home] > sp.polTol,
    dread: DIET_OF[hh.species] === "herb" && world.dread[home] >= KNOBS.REHOME_DREAD,
    crowded: world.occupants[home] > capacityOf(world, home),
    taxed: world.rates.R > neutralRate(P) + 1,
    burned: world.tick - lastFire[home] <= 12,
  };
  let count = 0, score = 0;
  for (const k of FACTORS) if (f[k]) { count++; score += WEIGHT[k]; }
  return { members: hh.members.slice(), home, n: members.length, f, count, score };
}

const fresh = () => ({ arrived: 0, camping: 0, by: {}, hist: [0, 0, 0, 0], fireAlone: 0, combos: new Map(), animals: 0 });
let dec = fresh();
const rows = [];
const camped = new Set();
function tally(cause, p) {
  dec.by[cause] = (dec.by[cause] || 0) + p.n;
  dec.animals += p.n;
  dec.hist[Math.min(3, p.count)]++;
  if (p.count === 1 && p.f.burned) dec.fireAlone++;
  const key = FACTORS.filter((k) => p.f[k]).join("+") || "none";
  dec.combos.set(key, (dec.combos.get(key) || 0) + 1);
}
const allCombos = new Map();

for (let t = 0; t < years * 12; t++) {
  for (let i = 0; i < n; i++) if (world.burning[i] || world.rubble[i]) lastFire[i] = world.tick;
  const before = new Map();
  for (const hh of world.households) { if (hh.gone || hh.home < 0) continue; const p = profile(hh); if (p) before.set(hh.id, p); }
  mayor.month(t);
  tick(world);
  dec.arrived += world.last.arrived;
  // Who went, and why: a household gone with its members archived (a wedding's guest is gone but alive).
  for (const [id, p] of before) {
    const hh = world.hhById.get(id);
    if (hh && !hh.gone) continue;
    if (p.members.some((m) => world.byId.get(m))) continue;
    const rec = legacyOf(world, p.members[0]);
    const cause = rec?.cause || "?";
    if (!MIGRATION.has(cause)) continue;
    tally(cause, p);
    const key = FACTORS.filter((k) => p.f[k]).join("+") || "none";
    allCombos.set(key, (allCombos.get(key) || 0) + 1);
  }
  for (const cp of world.campers) if (cp.householdId && !camped.has(cp.householdId)) { camped.add(cp.householdId); dec.camping++; }
  // The shadow PUSH: score ≥ thresh leaves at PUSH_P × (score − thresh + 1) a month, through the sim's own removal.
  if (rule === "push") {
    const going = [];
    for (const hh of world.households) {
      if (hh.gone || hh.home < 0) continue;
      const p = profile(hh);
      if (!p || p.score < THRESH) continue;
      if (rng() < PUSH_P * (p.score - THRESH + 1)) going.push([hh, p]);
    }
    for (const [hh, p] of going) { tally("push", p); const key = FACTORS.filter((k) => p.f[k]).join("+"); allCombos.set(key, (allCombos.get(key) || 0) + 1); removeHousehold(world, hh, "left"); }
    if (going.length) compact(world);
  }
  if ((t + 1) % 120 === 0 || t + 1 === years * 12) {
    // Prevalence now: how many housed households sit at each factor count, and at or above the threshold.
    const prev = [0, 0, 0, 0];
    let atThresh = 0, housed = 0;
    for (const hh of world.households) { if (hh.gone || hh.home < 0) continue; const p = profile(hh); if (!p) continue; housed++; prev[Math.min(3, p.count)]++; if (p.score >= THRESH) atThresh++; }
    rows.push({ year: world.tick / 12, P: world.last.census.P, ...dec, prev, atThresh, housed, vr: world.valves.R });
    dec = fresh();
  }
}

const causes = ["left", "homeless", "evicted", "zonedOut", "revolt", "displaced", "bulldozed", "push"];
console.log(`leaveprobe — layout ${layout} · seed ${seed} · ${years} years · disasters ${disasters ? "on" : "off"} · rule ${rule}${rule === "push" ? ` (thresh ${THRESH}, p ${PUSH_P} × (score − thresh + 1) a month)` : ""}${Object.keys(KNOBS).some((k) => args.includes(`--set`) && args.includes(`${k}=`)) ? "" : ""}`);
console.log(`  factors and weights: ${FACTORS.map((k) => `${k} ${WEIGHT[k]}`).join(" · ")}; "left" is the sim's friction (friendless), "homeless" a home lost with nothing in reach (a fire, mostly)`);
console.log("");
console.log("  year |    P | arrived | animals leaving by cause: " + causes.map((c) => c.padStart(8)).join("") + " | tents | households at leaving with 0 / 1 / 2 / 3+ factors | fire alone | housed now at 0 / 1 / 2 / 3+ factors (≥ thresh) |  V_R");
for (const r of rows) {
  console.log(`  ${String(r.year).padStart(4)} | ${String(r.P).padStart(4)} | ${String(r.arrived).padStart(7)} | ${" ".repeat(26)}${causes.map((c) => String(r.by[c] || 0).padStart(8)).join("")} | ${String(r.camping).padStart(5)} | ${r.hist.map((v) => String(v).padStart(4)).join(" /")} | ${String(r.fireAlone).padStart(10)} | ${r.prev.map((v) => String(v).padStart(4)).join(" /")} (${String(r.atThresh).padStart(4)} of ${r.housed}) | ${r.vr.toFixed(2).padStart(5)}`);
}
console.log("");
const total = rows.reduce((a, r) => a + r.animals, 0);
const arrived = rows.reduce((a, r) => a + r.arrived, 0);
console.log(`  ${years} years: arrived ${arrived} · left ${total} (${causes.map((c) => `${c} ${rows.reduce((a, r) => a + (r.by[c] || 0), 0)}`).join(" · ")}) · P ${rows[rows.length - 1].P}`);
const top = [...allCombos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log(`  the households that left, by what was wrong at home (top ${top.length}): ${top.map(([k, v]) => `${k} ×${v}`).join(" · ")}`);
