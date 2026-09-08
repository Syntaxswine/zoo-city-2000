// leaveprobe.mjs — who LEAVES Zoo City, by cause and by the grievances at home the month before;
// what a fire alone does; and the PUSH's ledger. The owner (2026-09-07): "migration should
// definitely be bidirectional. it should take more than just a fire for people to leave, it would
// have to be a combination of factors." (docs/PROPOSAL-GENERATIONS-AND-SKILLS-2026-09-07.md §10.)
// Passive: exit 0, prints, never judges.
//
// SINCE 2026-09-07 THE SIM PUSHES ON ITS OWN (citizens.leaveChance, SPEC §7.4 PUSH): --rule none is
// the town as it runs — "left" in the archive is the push (before it, the friction it retired).
// --rule push zeroes LEAVE_P and runs the OLD shadow outside the sim, between ticks, with --thresh
// and --push-p, through the sim's own removal (removeHousehold) — the comparison that scoped the
// rule. --set LEAVE_P=0 runs the town with no push at all: the tree before it, draw for draw.
//
//   node tools/leaveprobe.mjs [--layout balanced|estate] [--seed 7] [--years 60] [--no-disasters]
//                             [--rule none|push] [--thresh 3] [--push-p 0.05] [--set KEY=VALUE]...
//
// The grievances are the sim's own (citizens.leaveScore), read the month before a family goes:
// unemployed (an adult worker with no job) 2 · friendless (no adult has a friend) 1 · lowMood (mean
// under LEAVE_MOOD_LOW) 1 · crime (above CRIME_HIGH at home) 1 · smoke (pollution above the label
// species' tolerance) 1 · dread (a herbivore label at REHOME_DREAD) 1 · crowded (over capacity) 1 ·
// taxed (the R rate more than LEAVE_TAX_OVER above neutral) 1 · burned (hh.burnedAt within
// LEAVE_BURNED_MONTHS) 2. A camping household reads the five that need no lot. The last line counts
// every "left" whose score the month before was UNDER LEAVE_THRESH — the sim's law says zero.
//
// Other OUT channels, unchanged: HOMELESS — the home is rubble (a fire) or gone, nothing within 12
// road tiles has room, and no tent could be pitched; EVICTED / DISPLACED — a storey lost or a
// mansion risen, no home, no tent; ZONED OUT — the player's line; REVOLT — the tax event walks 8%
// of households out; and at V_R ≤ 0 the downturn roll pitches a TENT rather than leaving.
import { createWorld } from "../js/sim/world.js";
import { createMayor } from "./mayor.mjs";
import { tick } from "../js/sim/tick.js";
import { KNOBS } from "../js/sim/rules.js";
import { removeHousehold, compact, leaveScore, LEAVE_FACTORS } from "../js/sim/citizens.js";
import { legacyOf } from "../js/sim/legacy.js";

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] != null ? args[i + 1] : d; };
const flag = (k) => args.includes(k);
const layout = arg("--layout", "balanced");
const seed = arg("--seed", "7");
const years = Number(arg("--years", 60));
const rule = arg("--rule", "none");
const disasters = !flag("--no-disasters");
for (let k = 0; k < args.length; k++) if (args[k] === "--set" && args[k + 1]) { const [key, v] = args[k + 1].split("="); if (!(key in KNOBS)) { console.log(`--set ${key}: no such knob`); process.exit(2); } KNOBS[key] = Number(v); }
if (!["none", "push"].includes(rule)) { console.log(`--rule ${rule}: none or push`); process.exit(2); }
const THRESH = Number(arg("--thresh", KNOBS.LEAVE_THRESH));
const PUSH_P = Number(arg("--push-p", KNOBS.LEAVE_P));
if (rule === "push") KNOBS.LEAVE_P = 0; // the old shadow runs in place of the sim's push, never on top of it

const FACTORS = LEAVE_FACTORS;
const weightOf = (k) => (k === "unemployed" || k === "burned" ? KNOBS.LEAVE_W_ACUTE : KNOBS.LEAVE_W_CHRONIC);
const MIGRATION = new Set(["left", "homeless", "evicted", "zonedOut", "revolt", "displaced", "bulldozed"]);

function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rng = mulberry32([...String(seed)].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) | 0, 11) ^ 0x51ed270b);

const world = createWorld({ seed });
const mayor = createMayor(world, { layout, rates: [8, 8, 8], disasters });

/** The sim's own grievances this month, for any household with somebody present (a tent reads five). */
function profile(hh) {
  const s = leaveScore(world, hh, world.last?.census);
  if (!s) return null;
  return { members: hh.members.slice(), home: hh.home, n: s.present.length, f: s.f, count: s.reasons.length, score: s.score };
}

const fresh = () => ({ arrived: 0, camping: 0, by: {}, hist: [0, 0, 0, 0], fireAlone: 0, under: 0, decided: 0, underDecided: 0, combos: new Map(), animals: 0 });
let dec = fresh();
const rows = [];
const camped = new Set();
function tally(cause, p) {
  dec.by[cause] = (dec.by[cause] || 0) + p.n;
  dec.animals += p.n;
  dec.hist[Math.min(3, p.count)]++;
  if (p.count === 1 && p.f.burned) dec.fireAlone++;
  if (cause === "left" && p.score < KNOBS.LEAVE_THRESH) dec.under++;
  const key = FACTORS.filter((k) => p.f[k]).join("+") || "none";
  dec.combos.set(key, (dec.combos.get(key) || 0) + 1);
}
const allCombos = new Map();

for (let t = 0; t < years * 12; t++) {
  const before = new Map();
  for (const hh of world.households) { if (hh.gone) continue; const p = profile(hh); if (p) before.set(hh.id, p); }
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
  // The score AS DECIDED: the push records it on the departure (world.departures, this tick only). The month-before
  // profile above can lag it — a home burned or a job lost between the read and the roll.
  for (const d of world.departures || []) if (d.reasons) { dec.decided++; if (d.score < KNOBS.LEAVE_THRESH) dec.underDecided++; }
  for (const cp of world.campers) if (cp.householdId && !camped.has(cp.householdId)) { camped.add(cp.householdId); dec.camping++; }
  // The old shadow PUSH: housed households at score ≥ thresh leave at PUSH_P × (score − thresh + 1) a month, through the sim's own removal.
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
    // Prevalence now: how many households (tents included) sit at each grievance count, and at or above the threshold.
    const prev = [0, 0, 0, 0];
    let atThresh = 0, housed = 0;
    const thresh = rule === "push" ? THRESH : KNOBS.LEAVE_THRESH;
    for (const hh of world.households) { if (hh.gone) continue; const p = profile(hh); if (!p) continue; housed++; prev[Math.min(3, p.count)]++; if (p.score >= thresh) atThresh++; }
    rows.push({ year: world.tick / 12, P: world.last.census.P, ...dec, prev, atThresh, housed, vr: world.valves.R });
    dec = fresh();
  }
}

const causes = ["left", "homeless", "evicted", "zonedOut", "revolt", "displaced", "bulldozed", "push"];
const sets = args.map((a, i) => (args[i - 1] === "--set" ? a : null)).filter(Boolean);
console.log(`leaveprobe — layout ${layout} · seed ${seed} · ${years} years · disasters ${disasters ? "on" : "off"} · rule ${rule}${rule === "push" ? ` (the old shadow: thresh ${THRESH}, p ${PUSH_P} × (score − thresh + 1) a month; the sim's push off)` : ` (the sim's push: LEAVE_THRESH ${KNOBS.LEAVE_THRESH}, LEAVE_P ${KNOBS.LEAVE_P} × (score − ${KNOBS.LEAVE_THRESH} + 1) × roots a month, roots by ${KNOBS.LEAVE_ROOTS_YEARS} years at home and ×${KNOBS.LEAVE_NATIVE_DAMP} with a town-born adult)`}${sets.length ? ` · --set ${sets.join(" ")}` : ""}`);
console.log(`  grievances and weights: ${FACTORS.map((k) => `${k} ${weightOf(k)}`).join(" · ")}; "left" is the sim's push (the friction it retired, before 2026-09-07), "homeless" a home lost with nothing in reach and no tent`);
console.log("");
console.log("  year |    P | arrived | animals leaving by cause: " + causes.map((c) => c.padStart(8)).join("") + " | tents | households at leaving with 0 / 1 / 2 / 3+ grievances | fire alone | left under thresh | households now at 0 / 1 / 2 / 3+ (≥ thresh) |  V_R");
for (const r of rows) {
  console.log(`  ${String(r.year).padStart(4)} | ${String(r.P).padStart(4)} | ${String(r.arrived).padStart(7)} | ${" ".repeat(26)}${causes.map((c) => String(r.by[c] || 0).padStart(8)).join("")} | ${String(r.camping).padStart(5)} | ${r.hist.map((v) => String(v).padStart(4)).join(" /")} | ${String(r.fireAlone).padStart(10)} | ${String(r.under).padStart(17)} | ${r.prev.map((v) => String(v).padStart(4)).join(" /")} (${String(r.atThresh).padStart(4)} of ${r.housed}) | ${r.vr.toFixed(2).padStart(5)}`);
}
console.log("");
const total = rows.reduce((a, r) => a + r.animals, 0);
const arrived = rows.reduce((a, r) => a + r.arrived, 0);
const under = rows.reduce((a, r) => a + r.under, 0);
const decided = rows.reduce((a, r) => a + r.decided, 0);
const underDecided = rows.reduce((a, r) => a + r.underDecided, 0);
console.log(`  ${years} years: arrived ${arrived} · left ${total} (${causes.map((c) => `${c} ${rows.reduce((a, r) => a + (r.by[c] || 0), 0)}`).join(" · ")}) · P ${rows[rows.length - 1].P}`);
const top = [...allCombos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
console.log(`  the households that left, by what was wrong at home (top ${top.length}): ${top.map(([k, v]) => `${k} ×${v}`).join(" · ")}`);
console.log(`  left under the threshold: ${underDecided} of ${decided} pushed households as the sim decided it (the score on the departure record) — the law says 0; ${under} read under it the month before (a home burned or a job lost between the read and the roll)`);
