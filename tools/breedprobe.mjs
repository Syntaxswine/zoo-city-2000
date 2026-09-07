// breedprobe.mjs — what would a HOUSEHOLD-MERGE rule do to Zoo City's population?
// The owner (2026-09-07): "right now any change in population comes from migration. we need levers
// for both migration as well as population growth, the latter is especially important because if
// there is no breeding then pacification is mostly an empty threat."
// (docs/PROPOSAL-GENERATIONS-AND-SKILLS-2026-09-07.md §2c, §8.) Passive: exit 0, prints, never
// judges; NOTHING IN THE SIM CHANGES — the candidate rules run as a pass OUTSIDE the sim, between
// ticks, moving whole households the way placeHousehold would (occupants, household ids, a stale
// commute, a MOVED chapter), so the sim's own birth rule does the rest.
//
// Today: births need two fertile adults in ONE household; an arriving family is a couple plus cubs;
// at sixteen a cub splits into a household of ONE and nothing ever merges households. So the town's
// children never have children, and a fixed animal's "no more litters" only bites an arrival couple.
//
//   node tools/breedprobe.mjs [--layout balanced|estate] [--seed 7] [--years 60]
//                             [--rule none|lot|court] [--pair any|same] [--months 12] [--radius 12]
//                             [--stations] [--pacify] [--markets N] [--show N]
//
//   --rule none    the control: today's sim, plus the SUPPLY count (singles with a partner in reach)
//   --rule lot     two singles already sharing a lot form one household (no move; the cheapest shape)
//   --rule court   a single looks within --radius road tiles (REHOME_RADIUS, the same reach a cub
//                  uses to find its first home) and moves in with the nearest single — or is moved
//                  in with, whichever lot has room
//   --pair any     any pairing that is not predator and prey (the wedding of BACKLOG L1, cross-species)
//   --pair same    the same species only
//   --pair prefer  the same species when one is in reach, anyone (not predator and prey) otherwise
//   --months 12    a single courts with p = 1/months a month (its own RNG, seeded from --seed)
//
// "Single" = a housed household with exactly ONE present adult, who is inside its species' fertile
// window (a widowed parent with cubs counts; the partner joins the cubs). Fixed animals court like
// anyone — the sim's littersLost then measures pacification's bite directly.
//
// SINCE 2026-09-07 THE SIM MARRIES ON ITS OWN (citizens.weddings, SPEC §7.2): --rule none is the
// town as it runs, its weddings counted from world.last.weddings; the shadow rules zero WED_P so
// the old comparison still means what it did. --set WED_P=0 runs the town with no weddings at all.
import { createWorld, absent, capacityOf } from "../js/sim/world.js";
import { createMayor } from "./mayor.mjs";
import { tick } from "../js/sim/tick.js";
import { SPECIES_BY_ID, isPredPrey } from "../js/sim/species.js";
import { KNOBS } from "../js/sim/rules.js";
import { ageYears } from "../js/sim/census.js";
import { lotsWithinRoad, compact } from "../js/sim/citizens.js";
import { KIND, remember } from "../js/sim/life.js";
import { stateHash } from "../js/sim/save.js";

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] != null ? args[i + 1] : d; };
const flag = (k) => args.includes(k);
const layout = arg("--layout", "balanced");
const seed = arg("--seed", "7");
const years = Number(arg("--years", 60));
const rule = arg("--rule", "none");
const pair = arg("--pair", "any");
const months = Number(arg("--months", 12));
const radius = Number(arg("--radius", KNOBS.REHOME_RADIUS));
const showWeddings = Number(arg("--show", 0));
const stations = flag("--stations");
const pacify = flag("--pacify");
const markets = Number(arg("--markets", 0));
// --set KEY=VALUE (repeatable): override a KNOB before the run — the A/B switch for a rule that
// lives in the sim (e.g. --set WED_P=0 runs the town with the sim's own weddings off).
for (let k = 0; k < args.length; k++) if (args[k] === "--set" && args[k + 1]) { const [key, v] = args[k + 1].split("="); if (!(key in KNOBS)) { console.log(`--set ${key}: no such knob`); process.exit(2); } KNOBS[key] = Number(v); }
if (rule !== "none") KNOBS.WED_P = 0; // a shadow rule stands in for the sim's own weddings
if (!["none", "lot", "court"].includes(rule)) { console.log(`--rule ${rule}: none, lot or court`); process.exit(2); }
if (!["any", "same", "prefer"].includes(pair)) { console.log(`--pair ${pair}: any, same or prefer`); process.exit(2); }

// The probe's own RNG, so the sim's draws change only through the households it moves.
function mulberry32(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rng = mulberry32([...String(seed)].reduce((h, ch) => (Math.imul(h, 31) + ch.charCodeAt(0)) | 0, 7) ^ 0x9E3779B9);

const world = createWorld({ seed });
const mayor = createMayor(world, { layout, rates: [8, 8, 8], disasters: false, stations, pacify, markets });
const w = world.w;
const cheb = (i, j) => Math.max(Math.abs((i % w) - (j % w)), Math.abs(((i / w) | 0) - ((j / w) | 0)));

const adultsPresent = (hh) => hh.members.map((id) => world.byId.get(id)).filter((c) => c && !c.dead && !absent(world, c) && ageYears(world, c) >= KNOBS.ADULT_AGE);
const fertileAged = (c) => { const sp = SPECIES_BY_ID[c.species]; const y = ageYears(world, c); return y >= sp.fertile[0] && y <= sp.fertile[1]; };

/** The eligible singles: a housed household with exactly one present adult, fertile-aged, nobody penned. */
function singles() {
  const out = [];
  for (const hh of world.households) {
    if (hh.gone || hh.home < 0) continue;
    if (hh.members.some((id) => { const c = world.byId.get(id); return c && c.pen; })) continue;
    const adults = adultsPresent(hh);
    if (adults.length !== 1 || !fertileAged(adults[0])) continue;
    out.push({ c: adults[0], hh });
  }
  return out;
}
const pairOK = (a, b) => a.hh.id !== b.hh.id && !isPredPrey(a.c.species, b.c.species);
function partnersOf(s, pool, how) {
  let near;
  if (how === "lot") near = pool.filter((o) => o.hh.home === s.hh.home);
  else { const allowed = lotsWithinRoad(world, s.hh.home, radius); near = pool.filter((o) => allowed.has(o.hh.home)); }
  const ok = near.filter((o) => pairOK(s, o));
  if (pair === "same") return ok.filter((o) => o.c.species === s.c.species);
  if (pair === "prefer") { const same = ok.filter((o) => o.c.species === s.c.species); return same.length ? same : ok; }
  return ok;
}
function nearest(s, cands) {
  let best = null, bd = Infinity;
  for (const o of cands) { const d = cheb(s.hh.home, o.hh.home); if (d < bd || (d === bd && o.hh.id < best.hh.id)) { bd = d; best = o; } }
  return best;
}
/** Every member of `from` moves into `to`'s home and household, the way placeHousehold would; false if the lot has no room. */
function join(from, to) {
  if (capacityOf(world, to.home) - world.occupants[to.home] < from.members.length) return false;
  for (const id of from.members) {
    const c = world.byId.get(id);
    world.occupants[c.home]--;
    c.home = to.home;
    c.household = to.id;
    world.occupants[to.home]++;
    to.members.push(id);
    if (c.job >= 0) { c.path = null; c.stale = true; } // a new home is a new commute; the next tick re-plans it or releases the job
    remember(world, c, KIND.MOVED, to.home);
  }
  from.members = [];
  from.gone = true;
  world.hhById.delete(from.id);
  world.campers = world.campers.filter((cp) => cp.householdId !== from.id);
  world._removed = (world._removed || 0) + 1;
  return true;
}

const weddings = { total: 0, same: 0, cross: 0, native: 0, bothNative: 0, waitSum: 0 };
const eligibleSince = new Map();
let shown = 0;
function courtship(pool) {
  const taken = new Set();
  let n = 0;
  for (const s of pool) {
    if (taken.has(s.hh.id) || rng() >= 1 / months) continue;
    const cands = partnersOf(s, pool, rule).filter((o) => !taken.has(o.hh.id));
    if (!cands.length) continue;
    const o = nearest(s, cands);
    const ok = join(s.hh, o.hh) || join(o.hh, s.hh);
    if (!ok) continue;
    taken.add(s.hh.id); taken.add(o.hh.id);
    n++;
    weddings.total++;
    if (s.c.species === o.c.species) weddings.same++; else weddings.cross++;
    if (s.c.native || o.c.native) weddings.native++;
    if (s.c.native && o.c.native) weddings.bothNative++;
    weddings.waitSum += (world.tick - (eligibleSince.get(s.c.id) ?? world.tick)) + (world.tick - (eligibleSince.get(o.c.id) ?? world.tick));
    eligibleSince.delete(s.c.id); eligibleSince.delete(o.c.id);
    if (shown < showWeddings) { shown++; console.log(`  wedding, year ${(world.tick / 12) | 0}: ${s.c.name} ${s.c.surname} (${s.c.species}, ${ageYears(world, s.c)}${s.c.native ? ", town-born" : ""}) and ${o.c.name} ${o.c.surname} (${o.c.species}, ${ageYears(world, o.c)}${o.c.native ? ", town-born" : ""}), ${cheb(s.hh.home, o.hh.home)} tiles apart`); }
  }
  if (n) compact(world);
  return n;
}

// The lineage ledger: generation at birth = 1 + the deepest generation among the adults at home.
const gen = new Map();
const seen = new Set();
let births = 0, nativeParentBirths = 0, deepest = 0;
function ledger() {
  for (const c of world.citizens) {
    if (c.dead || seen.has(c.id)) continue;
    seen.add(c.id);
    if (!c.native) continue;
    births++;
    const hh = world.hhById.get(c.household);
    const parents = hh ? adultsPresent(hh).filter((p) => p.id !== c.id) : [];
    if (parents.some((p) => p.native)) nativeParentBirths++;
    const g = 1 + parents.reduce((m, p) => Math.max(m, gen.get(p.id) || 0), 0);
    gen.set(c.id, g);
    if (g > deepest) deepest = g;
  }
}

const fresh = () => ({ arrived: 0, left: 0, births: 0, deaths: 0, littersLost: 0, weddings: 0, vr: 0, vac: 0, n: 0, nativeBirths0: nativeParentBirths, killings0: world.events.killings, pacified0: world.events.justice.pacified, sold0: world.events.justice.sold });
let dec = fresh();
const rows = [];
function snapshot() {
  const cen = world.last.census;
  let couples = 0, bitten = 0;
  for (const hh of world.households) {
    if (hh.gone || hh.home < 0) continue;
    const fa = adultsPresent(hh).filter(fertileAged);
    if (fa.length < 2) continue;
    if (fa.filter((c) => !c.fixed).length >= 2) couples++; else bitten++;
  }
  const pool = singles();
  let onLot = 0, inReach = 0;
  for (const s of pool) { if (partnersOf(s, pool, "lot").length) onLot++; if (partnersOf(s, pool, "court").length) inReach++; }
  let gen2 = 0;
  for (const c of world.citizens) if (!c.dead && (gen.get(c.id) || 0) >= 2) gen2++;
  rows.push({
    year: world.tick / 12, P: cen.P, arrived: dec.arrived, left: dec.left, births: dec.births, nativeParent: nativeParentBirths - dec.nativeBirths0, deaths: dec.deaths,
    killed: world.events.killings - dec.killings0, pacified: world.events.justice.pacified - dec.pacified0, sold: world.events.justice.sold - dec.sold0,
    couples, bitten, singles: pool.length, onLot, inReach, weddings: dec.weddings, natives: cen.native, fixed: cen.fixed, deepest, gen2, littersLost: dec.littersLost,
    vr: dec.n ? dec.vr / dec.n : 0, vac: dec.n ? dec.vac / dec.n : 0,
  });
  dec = fresh();
}

for (let t = 0; t < years * 12; t++) {
  mayor.month(t);
  tick(world);
  ledger();
  const L = world.last;
  dec.arrived += L.arrived; dec.left += L.left; dec.births += L.births; dec.deaths += L.deaths; dec.littersLost += L.littersLost || 0;
  dec.vr += world.valves.R; dec.vac += L.census.vacantR; dec.n++;
  const pool = singles();
  for (const s of pool) if (!eligibleSince.has(s.c.id)) eligibleSince.set(s.c.id, world.tick);
  dec.weddings += rule === "none" ? (L.weddings || 0) : courtship(pool);
  if ((t + 1) % 120 === 0 || t + 1 === years * 12) snapshot();
}

const cen = world.last.census;
console.log(`breedprobe — layout ${layout} · seed ${seed} · ${years} years · rule ${rule}${rule === "none" ? "" : ` (pair ${pair}, p = 1/${months} a month${rule === "court" ? `, within ${radius} road tiles` : ""})`}${stations ? " · stations" : ""}${pacify ? " · centre" : ""}${markets ? ` · ${markets} halls` : ""}`);
console.log(`  births need two fertile adults in one household (p = litter/${KNOBS.BIRTH_DIV} a month, headroom in the lot); a cub splits into a household of one at ${KNOBS.ADULT_AGE}; arrivals = 0.10·V_R·vacant homes/3 a month`);
console.log("");
console.log("  year |    P | arrive  left | births (native parent) deaths | killed pacif. sold | couples bitten | singles: on lot / in reach | weddings | natives fixed | deepest gen, gen≥2 alive | litters lost | mean V_R  vacant");
for (const r of rows) {
  console.log(`  ${String(r.year).padStart(4)} | ${String(r.P).padStart(4)} | ${String(r.arrived).padStart(6)} ${String(r.left).padStart(5)} | ${String(r.births).padStart(6)} ${`(${r.nativeParent})`.padStart(15)} ${String(r.deaths).padStart(6)} | ${String(r.killed).padStart(6)} ${String(r.pacified).padStart(6)} ${String(r.sold).padStart(4)} | ${String(r.couples).padStart(7)} ${String(r.bitten).padStart(6)} | ${String(r.singles).padStart(7)}: ${String(r.onLot).padStart(6)} / ${String(r.inReach).padStart(8)} | ${String(r.weddings).padStart(8)} | ${`${Math.round(100 * r.natives)}%`.padStart(7)} ${String(r.fixed).padStart(5)} | ${String(r.deepest).padStart(11)}, ${String(r.gen2).padStart(11)} | ${String(r.littersLost).padStart(12)} | ${r.vr.toFixed(2).padStart(8)} ${r.vac.toFixed(0).padStart(7)}`);
}
console.log("");
const totals = rows.reduce((a, r) => ({ arrived: a.arrived + r.arrived, left: a.left + r.left, births: a.births + r.births, deaths: a.deaths + r.deaths, nativeParent: a.nativeParent + r.nativeParent }), { arrived: 0, left: 0, births: 0, deaths: 0, nativeParent: 0 });
console.log(`  state hash ${stateHash(world)} — the same rig, the same knobs, the same hash (a --set that changes nothing changes nothing)`);
console.log(`  ${years} years: arrived ${totals.arrived} · left ${totals.left} · born ${totals.births} (${totals.nativeParent} with a town-born parent) · died ${totals.deaths} · P ${cen.P}, ${Math.round(100 * cen.native)}% town-born · deepest generation ${deepest}`);
{ const hhs = world.households.filter((h) => !h.gone); const mixed = hhs.filter((h) => new Set(h.members.map((id) => world.byId.get(id)?.species).filter(Boolean)).size > 1).length; console.log(`  households ${hhs.length}: companions ${hhs.filter((h) => h.companions).length} · mixed-species ${mixed} · weddings by the sim's own rule over the run ${rows.reduce((a, r) => a + (rule === "none" ? r.weddings : 0), 0)} (WED_P ${KNOBS.WED_P.toFixed(3)}, cross ${KNOBS.WED_CROSS_P}, companions ${KNOBS.WED_COMPANIONS_P})`); }
if (rule !== "none") console.log(`  weddings ${weddings.total}: same species ${weddings.same}, cross-species ${weddings.cross}; ${weddings.native} with a town-born partner (${weddings.bothNative} both); mean wait while single ${weddings.total ? (weddings.waitSum / (2 * weddings.total)).toFixed(1) : "—"} months`);
