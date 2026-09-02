// check.mjs — the invariant suite. The only thing in tools/ that exits 1.
//
//   node tools/check.mjs [--years 15] [--seed 7]
//
// Part A — the sim, re-derived independently per world:
//   ledger conservation (cash === START + Σ ledger), every valve in [−1, 1],
//   no NaN anywhere in the saved state, determinism (same seed + same input
//   log ⇒ same hash, twice), save → load → N more years hash-equal to the
//   straight run, input-log REPLAY from the seed hash-equal, the dangling-id
//   law (no friend id to a missing citizen, every household member lists its
//   household, occupant/staff counts equal recounts, no lot over capacity,
//   every job path lies on roads and ends at the job's door), the road gate
//   (no tier > 0 lot without roadDist ≤ 3 unless it decayed there this tick —
//   checked as: every lot that GREW this run had access), tick cost; the
//   cheat op (booked under "cheat", logged, replayed, clamped, never undone,
//   lifts a receivership at once).
// Part B — the code: budget.post is the only cash mutator; every import is
//   relative (Pages serves under /zoo-city-2000/); no Math.random under js/;
//   the title screen is mounted, paints the owner's art, and the sim never
//   reads a browser preference.
// Part C — the art (when js/art/index.js exists): every pixel a palette key,
//   every anchor inside its sprite, 16/16 road masks, no solid pixel outside
//   its footprint prism, every stamped part inside its grid, the painter key
//   (including the 2×2 band beside the zoo).

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWorld, ZONE, ROAD, capacityOf, jobsOf } from "../js/sim/world.js";
import { tick } from "../js/sim/tick.js";
import { apply, replay, undo } from "../js/sim/ops.js";
import { save, load, stateHash, toPlain } from "../js/sim/save.js";
import { KNOBS } from "../js/sim/rules.js";
import { post } from "../js/sim/budget.js";
import { doorOf, hasAccess, computeFields } from "../js/sim/fields.js";
import { census } from "../js/sim/census.js";
import { CIVIC } from "../js/sim/world.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const YEARS = Number(arg("--years", 15));
const SEED = arg("--seed", "7");

const failures = [];
let checks = 0;
function check(name, cond, detail = "") {
  checks++;
  if (!cond) failures.push(`${name}${detail ? " — " + detail : ""}`);
}

// ---- a scripted city (the same one every run) -------------------------------
function buildCity(seed, years, { withSave = null } = {}) {
  const world = createWorld({ seed });
  const sx = world.start.tx;
  const sy = world.start.ty;
  const ring = [];
  for (let x = sx - 4; x <= sx + 4; x++) { ring.push(sy - 4 >= 0 ? (sy - 4) * world.w + x : -1); ring.push((sy + 4) * world.w + x); }
  for (let y = sy - 4; y <= sy + 4; y++) { ring.push(y * world.w + sx - 4); ring.push(y * world.w + sx + 4); }
  apply(world, { kind: "road", tiles: ring.filter((i) => i >= 0) });
  apply(world, { kind: "zone", zone: ZONE.R, x0: sx - 3, y0: sy - 3, x1: sx, y1: sy + 3, density: 3 });
  apply(world, { kind: "zone", zone: ZONE.C, x0: sx + 1, y0: sy - 3, x1: sx + 3, y1: sy - 1, density: 3 });
  apply(world, { kind: "zone", zone: ZONE.I, x0: sx + 1, y0: sy, x1: sx + 3, y1: sy + 2, density: 3 });
  // Zone M at t = 0 (a corner carved from the I block), and assert it, so the
  // market invariants can never pass over an empty set (a later placement is seed-fragile: costOf skips built tiles).
  const rM = apply(world, { kind: "zone", zone: ZONE.M, x0: sx + 1, y0: sy + 3, x1: sx + 3, y1: sy + 3, density: 3 });
  const grewWithAccess = { ok: true, mZoned: rM.ok && rM.cost > 0 };
  let saved = null;
  for (let t = 0; t < years * 12; t++) {
    if (t === 36) apply(world, { kind: "park", tx: sx - 5, ty: sy - 5 });
    if (t === 48) { apply(world, { kind: "police", tx: sx + 5, ty: sy - 5 }); apply(world, { kind: "centre", tx: sx - 5, ty: sy + 5 }); }
    if (t === 60) apply(world, { kind: "rate", zone: "R", value: 10 });
    if (t === 84) apply(world, { kind: "rate", zone: "R", value: 7 });
    if (t === 100) apply(world, { kind: "tree", x0: sx + 5, y0: sy + 5, x1: sx + 7, y1: sy + 7 });
    if (t === 120) apply(world, { kind: "bulldoze", x0: sx + 1, y0: sy + 3, x1: sx + 1, y1: sy + 3 });
    const before = Uint8Array.from(world.tier);
    tick(world);
    for (let i = 0; i < world.w * world.h; i++) if (world.tier[i] > before[i] && !hasAccess(world, i)) grewWithAccess.ok = false;
    if (withSave != null && t === withSave) saved = save(world);
  }
  return { world, saved, grewWithAccess: grewWithAccess.ok, mZoned: grewWithAccess.mZoned };
}

// ---- Part A -----------------------------------------------------------------
const t0 = Date.now();
const A = buildCity(SEED, YEARS, { withSave: Math.floor((YEARS * 12) / 2) });
const world = A.world;
const ms = (Date.now() - t0) / (YEARS * 12);
console.log(`built ${YEARS} years: ${world.citizens.length} citizens, ${ms.toFixed(2)} ms/tick`);
check("tick cost", ms < 30, `${ms.toFixed(1)} ms/tick`);

// ledger
let sum = 0;
for (const v of Object.values(world.ledger)) sum += v;
check("ledger conservation", world.cash === KNOBS.START_CASH + sum, `cash ${world.cash} vs ${KNOBS.START_CASH + sum}`);
check("cash is an integer", Number.isInteger(world.cash));
// valves
for (const z of ["R", "C", "I", "M"]) check(`valve ${z} bounded`, world.valves[z] >= -1 && world.valves[z] <= 1, String(world.valves[z]));
// NaN
const plain = JSON.stringify(toPlain(world));
check("no NaN in state", !/NaN|null(?=,"|\})/.test(plain.replace(/"(home|job|hired)":-1/g, "")) || !/NaN/.test(plain), "NaN found");
check("no NaN anywhere", !plain.includes("NaN"));
// dangling ids
const ids = new Set(world.citizens.map((c) => c.id));
let danglingFriends = 0;
let selfFriend = 0;
let asym = 0;
const byId = new Map(world.citizens.map((c) => [c.id, c]));
for (const c of world.citizens) {
  for (const f of c.friends) {
    if (!ids.has(f)) danglingFriends++;
    else if (f === c.id) selfFriend++;
    else if (!byId.get(f).friends.includes(c.id)) asym++;
  }
}
check("no dangling friend ids", danglingFriends === 0, `${danglingFriends}`);
check("no self-friendship", selfFriend === 0);
check("friendships reciprocal", asym === 0, `${asym}`);
const hh = new Map(world.households.map((h) => [h.id, h]));
let hhBad = 0;
for (const c of world.citizens) {
  const h = hh.get(c.household);
  if (!h || !h.members.includes(c.id) || h.home !== c.home) hhBad++;
}
let hhOrphans = 0;
for (const h of world.households) {
  if (h.members.length === 0) hhOrphans++;
  for (const m of h.members) if (!ids.has(m)) hhOrphans++;
}
check("every citizen's household lists it and shares its home", hhBad === 0, `${hhBad}`);
check("no empty or dangling households", hhOrphans === 0, `${hhOrphans}`);
// rosters
const occ = new Uint16Array(world.w * world.h);
const staff = new Uint16Array(world.w * world.h);
for (const c of world.citizens) { if (c.home >= 0) occ[c.home]++; if (c.job >= 0) staff[c.job]++; }
let occBad = 0;
let staffBad = 0;
let overCap = 0;
let overJobs = 0;
let homeNotR = 0;
for (let i = 0; i < world.w * world.h; i++) {
  if (occ[i] !== world.occupants[i]) occBad++;
  if (staff[i] !== world.staff[i]) staffBad++;
  if (occ[i] > capacityOf(world, i) && world.zone[i] === ZONE.R) overCap++;
  if (staff[i] > jobsOf(world, i)) overJobs++;
  if (occ[i] > 0 && world.zone[i] !== ZONE.R) homeNotR++;
}
check("occupant counts equal recount", occBad === 0, `${occBad}`);
check("staff counts equal recount", staffBad === 0, `${staffBad}`);
check("no lot over capacity", overCap === 0, `${overCap}`);
check("no job site over its jobs", overJobs === 0, `${overJobs}`);
check("homes are R lots", homeNotR === 0, `${homeNotR}`);
// paths
let pathBad = 0;
for (const c of world.citizens) {
  if (!c.path) continue;
  for (const i of c.path) if (world.road[i] === ROAD.NONE) pathBad++;
  const end = c.path[c.path.length - 1];
  if (c.job >= 0 && doorOf(world, c.job) !== end) pathBad++;
  if (c.path.length - 1 > KNOBS.COMMUTE_MAX) pathBad++;
}
check("every commute lies on roads and ends at the job's door", pathBad === 0, `${pathBad}`);
check("population grew", world.citizens.length > 100, `${world.citizens.length}`);
check("every lot that grew had road access", A.grewWithAccess);
check("history has one row per year", world.history.length === YEARS, `${world.history.length}`);

// ---- crime and punishment (docs/PROPOSAL-CRIME-AND-PUNISHMENT.md) ------------------
function auditIds(w) {
  const ids = new Set(w.citizens.map((c) => c.id));
  let bad = 0;
  for (const c of w.citizens) { if (c.dead) bad++; for (const f of c.friends) if (!ids.has(f)) bad++; }
  const hhs = new Map(w.households.map((h) => [h.id, h]));
  for (const c of w.citizens) { const h = hhs.get(c.household); if (!h || !h.members.includes(c.id) || h.home !== c.home) bad++; }
  for (const h of w.households) for (const m of h.members) if (!ids.has(m)) bad++;
  const occ = new Uint16Array(w.w * w.h);
  const st = new Uint16Array(w.w * w.h);
  for (const c of w.citizens) { if (c.home >= 0) occ[c.home]++; if (c.job >= 0) st[c.job]++; }
  for (let i = 0; i < w.w * w.h; i++) { if (occ[i] !== w.occupants[i]) bad++; if (st[i] !== w.staff[i]) bad++; }
  return bad;
}
{
  check("M zoned in the scripted city", A.mZoned === true);
  // Dread: on every built hall, nowhere beyond a hall's radius, gone when the halls go.
  // Measured on a clone with the M row FORCED built (the scripted city's row
  // burned in a year-7 fire on seed 7 — disasters are on — and rubble carries no dread).
  const D = load(save(world));
  let builtM = 0, dreadOnM = 0, dreadFar = 0;
  const W = world.w;
  const halls = [];
  for (let i = 0; i < W * world.h; i++) if (D.zone[i] === ZONE.M) { D.rubble[i] = 0; D.burning[i] = 0; D.tier[i] = 2; halls.push(i); }
  computeFields(D);
  for (const i of halls) { builtM++; if (D.dread[i] > 0) dreadOnM++; }
  for (let i = 0; i < W * world.h; i++) {
    if (!D.dread[i]) continue;
    let near = false;
    for (const h of halls) if (Math.max(Math.abs((h % W) - (i % W)), Math.abs(((h / W) | 0) - ((i / W) | 0))) <= KNOBS.DREAD_RADIUS[D.tier[h]]) { near = true; break; }
    if (!near) dreadFar++;
  }
  check("dread: on every built hall, nowhere beyond a hall's radius", builtM > 0 && dreadOnM === builtM && dreadFar === 0, `halls ${builtM} · with dread ${dreadOnM} · stray ${dreadFar}`);
  const dreadPeak = Math.max(...halls.map((i) => D.dread[i]));
  check("dread: a tier-2 hall reads 70 on its own tile", dreadPeak >= 70, `${dreadPeak}`);
  for (const i of halls) { D.zone[i] = ZONE.NONE; D.tier[i] = 0; }
  computeFields(D);
  let stray = 0;
  for (let i = 0; i < W * world.h; i++) if (D.dread[i]) stray++;
  check("dread: zero with the halls unzoned", stray === 0, `${stray}`);
  // The two copies of the worker predicate agree.
  computeFields(world);
  const cen = census(world);
  check("computeCrime's W/U equal the census", world._crimeW === cen.W && world._crimeU === cen.U, `${world._crimeW}/${world._crimeU} vs ${cen.W}/${cen.U}`);
  check("Jc + Ji + Jm === J", cen.Jc + cen.Ji + cen.Jm === cen.J, `${cen.Jc} + ${cen.Ji} + ${cen.Jm} vs ${cen.J}`);
  // Forced killing, forced arrest, the wrongful 5%, the centre, a reload with a held and a fixed animal.
  const mid = Math.floor((YEARS * 12) / 2);
  const sx = world.start.tx, sy = world.start.ty;
  const F = load(A.saved);
  const { killTotal } = await import("../js/sim/justice.js");
  const saveP = KNOBS.KILL_P;
  KNOBS.KILL_P = 1 / killTotal(F); // exactly one killing this month (k = floor(1 + r))
  tick(F);
  KNOBS.KILL_P = saveP;
  check("a forced month kills", F.events.killings > 0 && F.events.files.some((f) => f.cause === "killing"), `${F.events.killings}`);
  check("the killed are gone (dangling-id law)", auditIds(F) === 0, `${auditIds(F)}`);
  // A police station and a centre, then force the arrest and the wrongful branch.
  const ci = (sy + 5) * F.w + (sx - 5);
  const rc = F.civic[ci] === CIVIC.CENTRE ? { ok: true } : apply(F, { kind: "centre", tx: sx - 5, ty: sy + 5 });
  check("a centre stands in the scripted city", rc.ok === true && F.civic[ci] === CIVIC.CENTRE, rc.reason || "");
  // Force killing + arrest (the wrongful branch every time) until a conviction
  // lands in the centre: a prey target is SOLD at the hall instead (the
  // sentence table), so one round is not guaranteed to fill a bed.
  const saveA = KNOBS.ARREST_BASE, saveW = KNOBS.WRONGFUL_P;
  let rounds = 0;
  while (F.events.justice.takenIn === 0 && rounds < 8) {
    KNOBS.KILL_P = 1 / Math.max(1e-9, killTotal(F));
    tick(F);
    KNOBS.KILL_P = saveP;
    KNOBS.ARREST_BASE = 1; KNOBS.WRONGFUL_P = 1;
    tick(F);
    KNOBS.ARREST_BASE = saveA; KNOBS.WRONGFUL_P = saveW;
    rounds++;
  }
  const j = F.events.justice;
  check("forced months convict, the wrong animal among them, and one lands in the centre", j.takenIn > 0 && j.wrongful > 0, `taken in ${j.takenIn} · cells ${j.cells} · sold ${j.sold} · wrongful ${j.wrongful} · rounds ${rounds}`);
  let heldBad = 0, heldN = 0, bedsOver = 0;
  const beds = new Map();
  for (const c of F.citizens) {
    if ((c.held || 0) > F.tick) { heldN++; if (c.job >= 0) heldBad++; if (c.heldAt >= 0) beds.set(c.heldAt, (beds.get(c.heldAt) || 0) + 1); }
  }
  for (const [i, n] of beds) if (F.civic[i] !== CIVIC.CENTRE || n > KNOBS.CENTRE_BEDS) bedsOver++;
  check("held citizens hold no job; beds point at a centre and never exceed it", heldN > 0 && heldBad === 0 && bedsOver === 0, `held ${heldN} · with a job ${heldBad} · bad beds ${bedsOver}`);
  check("the sold are gone (dangling-id law)", auditIds(F) === 0, `${auditIds(F)}`);
  // Reload with a held animal, continue 24 ticks (the centre releases fixed on the way): hash-equal.
  const G = load(save(F));
  for (let t = 0; t < 24; t++) { tick(F); tick(G); }
  check("save → load → 24 ticks with a held and a fixed animal hash-equals", stateHash(F) === stateHash(G), `${stateHash(F)} vs ${stateHash(G)}`);
  const fixedN = F.citizens.filter((c) => c.fixed).length;
  check("the centre fixes", fixedN > 0 && F.events.justice.pacified > 0, `fixed ${fixedN} · pacified ${F.events.justice.pacified}`);
  // No cub to a household with fewer than two unfixed fertile adults — run a year and audit every birth.
  const { SPECIES_BY_ID } = await import("../js/sim/species.js");
  const { ageYears } = await import("../js/sim/census.js");
  let badBirth = 0;
  for (let t = 0; t < 12; t++) {
    const before = new Set(F.citizens.map((c) => c.id));
    tick(F);
    for (const c of F.citizens) {
      if (before.has(c.id) || !c.native || ageYears(F, c) > 0) continue; // a cub born this tick
      const hh = F.households.find((h) => h.id === c.household);
      if (!hh) { badBirth++; continue; }
      let ok = 0;
      for (const id of hh.members) { const m = F.citizens.find((x) => x.id === id); if (!m || m === c || m.fixed || (m.held || 0) > F.tick - 1) continue; const y = ageYears(F, m); const sp = SPECIES_BY_ID[m.species]; if (y >= sp.fertile[0] && y <= sp.fertile[1] + 0) ok++; }
      if (ok < 2) badBirth++;
    }
  }
  check("no cub to a household without two unfixed fertile adults", badBirth === 0, `${badBirth}`);
  // Adults only, no pronoun: every named culprit and victim in the log is an adult; no he/she/his/her.
  const pron = F.events.log.filter((l) => /\b(he|she|his|her|him)\b/i.test(l.line));
  check("the ticker uses no pronoun", pron.length === 0, pron.slice(0, 2).map((l) => l.line).join(" | "));
  // An old save without the new fields loads and ticks.
  const plainOld = JSON.parse(save(world));
  for (const c of plainOld.citizens) { delete c.held; delete c.heldAt; delete c.fixed; delete c.record; delete c.wrongful; delete c.wrongedBy; delete c.exonerated; delete c.moodPenalty; delete c.moodPenaltyUntil; }
  delete plainOld.valves.M;
  delete plainOld.wall;
  delete plainOld.events.files; delete plainOld.events.justice; delete plainOld.events.arrests; delete plainOld.events.killings;
  let oldOk = true;
  try { const O = load(JSON.stringify(plainOld)); tick(O); tick(O); } catch (e) { oldOk = false; }
  check("an old save without the justice fields loads and ticks", oldOk);
}

// determinism: build twice
const B = buildCity(SEED, YEARS);
check("determinism: same seed + same inputs ⇒ same hash", stateHash(A.world) === stateHash(B.world), `${stateHash(A.world)} vs ${stateHash(B.world)}`);

// the cheat (SPEC §8, §11): an op like any other — booked under "cheat" by
// budget.post, in the input log, replayed to the same hash, never undoable,
// clamped, and it lifts a receivership the moment the debt is cleared.
{
  const w = B.world; // hash-equal to A.world (just checked); the cheats go on this twin
  const cash0 = w.cash;
  const n0 = w.log.length;
  const undo0 = (w.undoStack || []).length;
  const r = apply(w, { kind: "cheat", amount: KNOBS.CHEAT_CASH });
  check("cheat: posts CHEAT_CASH under 'cheat'", r.ok && r.amount === KNOBS.CHEAT_CASH && w.cash === cash0 + KNOBS.CHEAT_CASH && w.ledger.cheat === KNOBS.CHEAT_CASH, `cash +${w.cash - cash0}, ledger.cheat ${w.ledger.cheat}`);
  let s2 = 0;
  for (const v of Object.values(w.ledger)) s2 += v;
  check("cheat: ledger conservation holds", w.cash === KNOBS.START_CASH + s2, `cash ${w.cash} vs ${KNOBS.START_CASH + s2}`);
  check("cheat: written to the input log", w.log.length === n0 + 1 && w.log[n0].op.kind === "cheat" && w.log[n0].op.amount === KNOBS.CHEAT_CASH && w.log[n0].t === w.tick);
  check("cheat: never undoable", (w.undoStack || []).length === undo0);
  const big = apply(w, { kind: "cheat", amount: 1e12 });
  check("cheat: clamped at CHEAT_MAX", big.ok && big.amount === KNOBS.CHEAT_MAX && w.ledger.cheat === KNOBS.CHEAT_CASH + KNOBS.CHEAT_MAX, `${big.amount}`);
  check("cheat: a bad amount posts the default", apply(w, { kind: "cheat", amount: "lots" }).amount === KNOBS.CHEAT_CASH);
  // replay the twin's log, cheats and all, from the seed
  const w3 = createWorld({ seed: SEED });
  let k = 0;
  for (let t = 0; t < YEARS * 12; t++) {
    while (k < w.log.length && w.log[k].t === t) { replay(w3, w.log[k]); k++; }
    tick(w3);
  }
  while (k < w.log.length) { replay(w3, w.log[k]); k++; }
  check("cheat: input-log replay with the cheats hash-equals", stateHash(w3) === stateHash(w), `${stateHash(w3)} vs ${stateHash(w)}`);
  // receivership: dig the treasury under the line, tick into it, cheat out at once
  const w4 = load(save(A.world));
  post(w4, "test", -(w4.cash + 20000));
  tick(w4);
  const inIt = w4.flags.receivership;
  const rc = apply(w4, { kind: "cheat", amount: KNOBS.CHEAT_CASH });
  check("cheat: lifts receivership the moment cash ≥ 0", inIt && rc.ok && !w4.flags.receivership && w4.cash >= 0 && typeof rc.notice === "string", `in ${inIt}, after ${w4.flags.receivership}, cash ${w4.cash}`);
  check("cheat: the mayor's own rates come back with the books", w4.rates.R === A.world.rates.R && w4.rates.C === A.world.rates.C && w4.rates.I === A.world.rates.I, `${w4.rates.R}/${w4.rates.C}/${w4.rates.I} vs ${A.world.rates.R}/${A.world.rates.C}/${A.world.rates.I}`);
}

// save → load → continue
{
  const mid = Math.floor((YEARS * 12) / 2);
  const loaded = load(A.saved);
  check("save round-trips", stateHash(loaded) === stateHash(load(save(loaded))));
  // Continue the loaded world with the same scripted inputs as buildCity from `mid` on.
  const sx = loaded.start.tx;
  const sy = loaded.start.ty;
  for (let t = mid + 1; t < YEARS * 12; t++) {
    if (t === 60) apply(loaded, { kind: "rate", zone: "R", value: 10 });
    if (t === 84) apply(loaded, { kind: "rate", zone: "R", value: 7 });
    if (t === 48) { apply(loaded, { kind: "police", tx: sx + 5, ty: sy - 5 }); apply(loaded, { kind: "centre", tx: sx - 5, ty: sy + 5 }); }
    if (t === 100) apply(loaded, { kind: "tree", x0: sx + 5, y0: sy + 5, x1: sx + 7, y1: sy + 7 });
    if (t === 120) apply(loaded, { kind: "bulldoze", x0: sx + 1, y0: sy + 3, x1: sx + 1, y1: sy + 3 });
    tick(loaded);
  }
  check("save at mid → load → continue hash-equals the straight run", stateHash(loaded) === stateHash(A.world), `${stateHash(loaded)} vs ${stateHash(A.world)}`);
}

// input-log replay from the seed
{
  const w2 = createWorld({ seed: SEED });
  const log = A.world.log;
  let k = 0;
  for (let t = 0; t < YEARS * 12; t++) {
    while (k < log.length && log[k].t === t) { replay(w2, log[k]); k++; }
    tick(w2);
  }
  check("input-log replay hash-equals the run", stateHash(w2) === stateHash(A.world), `${stateHash(w2)} vs ${stateHash(A.world)}`);
}

// ---- walls (docs/PROPOSAL-ZONING-RAIL-WALLS.md §1; SPEC §6b) ----------------------
// The flood must reproduce the square before it is allowed to differ from it.
{
  const { computeOcclusion, reachFrom } = await import("../js/sim/reach.js");
  const { roadPath } = await import("../js/sim/fields.js");
  const FIELDS = ["pol", "dread", "lv", "crime", "fireCov", "policeCov", "roadDist"];
  const snap = (w) => FIELDS.map((k) => Array.from(w[k]));
  const differing = (a, b) => FIELDS.filter((k, i) => a[i].length !== b[i].length || a[i].some((v, j) => v !== b[i][j]));
  const w = load(save(A.world));
  computeFields(w);
  const square = snap(w);
  computeOcclusion(w);
  w.wallCount = 1; // force the flood on a city with no walls: it must be the square, byte for byte
  computeFields(w);
  const flood = snap(w);
  const diff = differing(square, flood);
  check("walls: the flood reproduces the square on a wall-less city (every field byte-equal)", diff.length === 0, diff.join(", "));
  // A works walled off: an 11×5 patch of open grass on a fresh map; the works in the middle of the top row,
  // a wall across the third row, the probe under it. Then a road through the wall — a tunnel — and the leak.
  const F = createWorld({ seed: SEED });
  let px = -1, py = -1;
  outer: for (let y = 4; y < F.h - 9; y++) for (let x = 4; x < F.w - 15; x++) {
    let ok = true;
    for (let yy = y; yy < y + 5 && ok; yy++) for (let xx = x; xx < x + 11; xx++) { const i = yy * F.w + xx; if (F.terrain[i] !== 0 || F.road[i] || F.zone[i] || F.civic[i]) { ok = false; break; } }
    if (ok) { px = x; py = y; break outer; }
  }
  check("walls: a grass patch for the fixture", px >= 0, "none found");
  const at = (x, y) => y * F.w + x;
  const works = at(px + 5, py), probe = at(px + 5, py + 3), beside = at(px + 6, py + 3);
  F.zone[works] = ZONE.I; F.tier[works] = 3;
  F.roadsDirty = true;
  computeFields(F);
  const open = F.pol[probe];
  const wallTiles = []; for (let x = px; x < px + 11; x++) wallTiles.push(at(x, py + 2));
  const rw = apply(F, { kind: "wall", tiles: wallTiles });
  computeFields(F);
  const walled = F.pol[probe];
  check("walls: a wall row cuts the works' smell to zero behind it (the flood goes round, and round is too far)", rw.ok && rw.cost === KNOBS.COST.wall * 11 && open > 20 && walled === 0, `open ${open} · walled ${walled} · cost ${rw.cost}`);
  check("walls: a killer's reach stops at the wall", reachFrom(F, works, KNOBS.KILL_RADIUS)(probe) < 0, "");
  const rr = apply(F, { kind: "road", tiles: [at(px + 5, py + 1), at(px + 5, py + 2), at(px + 5, py + 3)] });
  computeFields(F);
  const tunnel = F.wall[at(px + 5, py + 2)] === 1 && F.road[at(px + 5, py + 2)] !== 0;
  const path = roadPath(F, at(px + 5, py + 1), at(px + 5, py + 3));
  check("walls: a road across the wall is a tunnel the commute passes", rr.ok && tunnel && !!path && path.length === 3, `ok ${rr.ok} · tunnel ${tunnel} · path ${path ? path.length : null}`);
  const leak = F.pol[probe], side = F.pol[beside];
  check("walls: the smell leaks through the tunnel along the road and weaker beside it", leak >= 20 && side > 0 && side < leak, `through ${leak} · beside ${side} · open ${open}`);
  check("walls: a wall on water is nothing to do", (() => { let wi = -1; for (let i = 0; i < F.w * F.h; i++) if (F.terrain[i] === 1) { wi = i; break; } return wi < 0 || apply(F, { kind: "wall", tiles: [wi] }).ok === false; })(), "");
  const ti = at(px + 5, py + 2);
  const rb = apply(F, { kind: "bulldoze", x0: px + 5, y0: py + 2, x1: px + 5, y1: py + 2 });
  check("walls: bulldozing a tunnel takes the wall first and keeps the road", rb.ok && F.wall[ti] === 0 && F.road[ti] !== 0, `wall ${F.wall[ti]} · road ${F.road[ti]}`);
  const ru = undo(F);
  check("walls: undo puts the wall back", ru.ok && F.wall[ti] === 1, `${ru.reason || ""}`);
  // Save → load → 24 ticks with walls in the city hash-equals; replay from the seed too.
  const G = load(save(F));
  for (let t = 0; t < 24; t++) { tick(F); tick(G); }
  check("walls: save → load → 24 ticks with walls hash-equals", stateHash(F) === stateHash(G), `${stateHash(F)} vs ${stateHash(G)}`);
  check("walls: the census counts them", F.last.census.walls === 11 && F.last.census.tunnels === 1, `walls ${F.last.census.walls} · tunnels ${F.last.census.tunnels}`);
}

// ---- Part B: the code ----------------------------------------------------------
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = path.join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|mjs)$/.test(f)) out.push(p);
  }
  return out;
}
const files = walk(path.join(ROOT, "js"));
let cashMut = [];
let absImports = [];
let mathRandom = [];
for (const f of files) {
  const src = readFileSync(f, "utf8");
  const rel = path.relative(ROOT, f).replace(/\\/g, "/");
  if (!rel.endsWith("sim/budget.js") && !rel.endsWith("sim/save.js")) {
    for (const m of src.matchAll(/\bcash\s*(\+=|-=|=)(?!=)/g)) cashMut.push(`${rel}: ${m[0]}`);
  }
  for (const m of src.matchAll(/^\s*import[^'"]*['"]([^'"]+)['"]/gm)) if (!m[1].startsWith(".")) absImports.push(`${rel}: ${m[1]}`);
  if (/Math\.random/.test(src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, ""))) mathRandom.push(rel);
}
check("budget.post is the only cash mutator", cashMut.length === 0, cashMut.join(", "));
check("every import is relative", absImports.length === 0, absImports.join(", "));
check("no Math.random under js/", mathRandom.length === 0, mathRandom.join(", "));

// the title screen (SPEC §11): the module, the mount, the owner's art — and
// the sim never reads a browser preference (the cheat reaches it as an op).
{
  const titlePath = path.join(ROOT, "js", "title.js");
  const titleSrc = existsSync(titlePath) ? readFileSync(titlePath, "utf8") : "";
  check("title: js/title.js exports createTitle", /export function createTitle\b/.test(titleSrc));
  const html = readFileSync(path.join(ROOT, "index.html"), "utf8");
  const css = readFileSync(path.join(ROOT, "css", "field.css"), "utf8");
  check("title: index.html mounts #title", /id="title"/.test(html));
  check("title: the stylesheet paints img/titlescreen.png and the file exists", /img\/titlescreen\.png/.test(css) && existsSync(path.join(ROOT, "img", "titlescreen.png")));
  const simReadsPref = files.filter((f) => /[\\/]sim[\\/]/.test(f) && /zoo\.pref|localStorage/.test(readFileSync(f, "utf8"))).map((f) => path.relative(ROOT, f));
  check("title: the sim never reads a preference (the cheat is an op)", simReadsPref.length === 0, simReadsPref.join(", "));
}

// ---- Part C: the art (if present) ------------------------------------------------
const artIndex = path.join(ROOT, "js", "art", "index.js");
if (existsSync(artIndex)) {
  const { art, allSprites } = await import("../js/art/index.js");
  const { hasKey } = await import("../js/art/palette.js");
  const list = allSprites();
  let badPixels = 0;
  let badAnchors = 0;
  let ragged = 0;
  for (const { name, sprite } of list) {
    const { rows, anchor } = sprite;
    const w = rows[0].length;
    for (const r of rows) {
      if (r.length !== w) ragged++;
      for (const ch of r) if (ch !== "." && !hasKey(ch)) badPixels++;
    }
    if (!(anchor[0] >= 0 && anchor[0] < w && anchor[1] >= 0 && anchor[1] < rows.length)) badAnchors++;
  }
  check("art: every pixel a palette key", badPixels === 0, `${badPixels}`);
  check("art: every anchor inside its sprite", badAnchors === 0, `${badAnchors}`);
  check("art: no ragged rows", ragged === 0, `${ragged}`);
  check("art: sprites present", list.length >= 60, `${list.length}`);
  let masks = 0;
  for (let m = 0; m < 16; m++) if (art.road(m, false)) masks++;
  check("art: 16/16 road masks", masks === 16, `${masks}`);
  // SPEC §12.5: a box solid emits no pixel outside its projected footprint
  // + height — the pixel half of the gate. The footprint prism
  // [0, 16·fw] × [0, 16·fh] × [0, ∞) projects to x ∈ [−2B, 2A] and
  // y ≤ 2·min(A, B + x/2) − x/2 (the ground diamond's lower edges),
  // measured from the anchor at world (hub, hub, 0), with one pixel of
  // rounding slack. Buildings, civics and overlays; not trees or citizens,
  // which are billboards and hang over their tile by design.
  const { STAMP_LOG, PLANS } = await import("../js/art/buildings.js");
  // The gate proper is on the PLAN (buildings.js explains why a pixel test
  // cannot see an overhang at height): every box inside the footprint.
  const planBad = [];
  for (const { name, footprint, boxes } of PLANS) {
    const A = 16 * footprint[0], B = 16 * footprint[1];
    for (const bx of boxes) if (bx.a0 < 0 || bx.a1 > A || bx.b0 < 0 || bx.b1 > B || bx.c0 < 0) planBad.push(`${name} [${bx.a0},${bx.a1}]×[${bx.b0},${bx.b1}]×[${bx.c0},${bx.c1}]`);
  }
  check("art: every box of every solid lies inside its footprint", PLANS.length >= 20 && planBad.length === 0, planBad.join("; "));
  let overhang = [];
  for (const { name, sprite } of list) {
    const tags = sprite.tags || [];
    if (!(tags.includes("building") || tags.includes("civic") || tags.includes("overlay"))) continue;
    if (name.startsWith("overlay-fire") || name.startsWith("overlay-rubble") || name.startsWith("overlay-flood")) continue; // ground tiles / flames, not solids
    const [fw, fh] = sprite.footprint || [1, 1];
    const A = 16 * fw, B = 16 * fh;
    const ay = sprite.anchor[1] - (8 * fw + 8 * fh); // grid row of world y = 0
    let bad = 0;
    for (let py = 0; py < sprite.rows.length; py++)
      for (let px = 0; px < sprite.rows[py].length; px++) {
        if (sprite.rows[py][px] === ".") continue;
        const x = px - sprite.anchor[0], y = py - ay;
        const yMax = 2 * Math.min(A, B + x / 2) - x / 2;
        if (x < -2 * B - 1 || x > 2 * A + 1 || y > yMax + 1) bad++;
      }
    if (bad) overhang.push(`${name}: ${bad}px`);
  }
  check("art: no solid emits a pixel outside its footprint prism", overhang.length === 0, overhang.join(", "));
  const clipped = STAMP_LOG.filter((s) => s.dropped > 0);
  check("art: every stamped part lands inside its solid's grid", STAMP_LOG.length >= 5 && clipped.length === 0, clipped.map((s) => `${s.part}→${s.sprite}`).join(", "));
  const painterPath = path.join(ROOT, "js", "iso", "painter.js");
  if (existsSync(painterPath)) {
    const { sortKey, keyOf, Z_BUILDING } = await import("../js/iso/painter.js");
    check("painter: building after ground on the same tile", sortKey(3, 4, 768) > sortKey(3, 4, 0));
    check("painter: a walker at frac 0.5 sits between its tile's ground and the next tile", sortKey(3, 4, 512 + 32) > sortKey(3, 4, 0) && sortKey(3, 4, 512 + 32) < sortKey(4, 4, 0));
    // The 2×2 band: a walker on the road beside an oblong's back-east tile
    // (2, 4.0..4.2) paints AFTER the zoo at (0,4); a walker behind it, and
    // every ground tile under it, still paint before.
    const zoo = { sprite: art.civic("zoo"), tx: 0, ty: 4, kind: "building" };
    const walker = (tx, ty) => ({ sprite: art.citizen("rabbit", "se", 0, "adult"), tx, ty, kind: "walker" });
    const ground = (tx, ty) => ({ sprite: art.ground("grass", 0), tx, ty, kind: "ground" });
    let band = true;
    for (const ty of [4, 4.1, 4.2, 4.5, 5, 5.9]) if (!(keyOf(walker(2, ty)) > keyOf(zoo))) band = false;
    for (const tx of [0, 1, 1.9]) if (!(keyOf(walker(tx, 6)) > keyOf(zoo))) band = false;
    check("painter: a walker on the road beside a 2×2 paints over it", band);
    let behind = true;
    for (const [tx, ty] of [[0, 3.9], [1, 3.5], [2, 3.5], [-1, 4.5], [-1, 5.5], [1.5, 3.9]]) if (!(keyOf(walker(tx, ty)) < keyOf(zoo))) behind = false;
    for (const [tx, ty] of [[0, 4], [1, 4], [0, 5], [1, 5]]) if (!(keyOf(ground(tx, ty)) < keyOf(zoo))) behind = false;
    check("painter: everything behind or under a 2×2 paints before it", behind);
    check("painter: keyOf agrees with sortKey for a 1×1", keyOf({ sprite: art.building(1, 1, 0), tx: 3, ty: 4, kind: "building" }) === sortKey(3, 4, Z_BUILDING));
  }
  // Species parity: every roster row has kit art, an arrival weight and a
  // character-line noun. A missing weight once made every arrival the last
  // species silently; a missing noun printed "a skunk undefined".
  const { SPECIES } = await import("../js/sim/species.js");
  const { arrivalWeights } = await import("../js/sim/citizens.js");
  const { census } = await import("../js/sim/census.js");
  const { characterLine } = await import("../js/sim/tick.js");
  const wts = arrivalWeights(world, census(world));
  let noArt = [];
  for (const sp of SPECIES) {
    try { art.citizen(sp.id, "se", 0, 20); art.citizen(sp.id, "ne", 1, 5); } catch (e) { noArt.push(sp.id); }
  }
  check("species: every roster row has kit art", noArt.length === 0, noArt.join(", "));
  const noWeight = SPECIES.filter((sp) => !(typeof wts[sp.id] === "number" && Number.isFinite(wts[sp.id]))).map((sp) => sp.id);
  check("species: every roster row has an arrival weight", noWeight.length === 0, noWeight.join(", "));
  const badLine = SPECIES.filter((sp) => {
    const shares = Object.fromEntries(SPECIES.map((o) => [o.id, o.id === sp.id ? 0.6 : 0.2]));
    return /undefined/.test(characterLine({ P: 100, shares }));
  }).map((sp) => sp.id);
  check("species: every roster row has a character-line noun", badLine.length === 0, badLine.join(", "));
  const noDiet = SPECIES.filter((sp) => !["herb", "omni", "carn"].includes(sp.diet)).map((sp) => sp.id);
  check("species: every roster row has a diet", noDiet.length === 0, noDiet.join(", "));
  let artM = true;
  try { art.chalk(4, false); art.chalk(4, true); for (const t of [1, 2, 3]) for (const v of [0, 1]) art.building(4, t, v); art.civic("centre"); } catch (e) { artM = false; }
  check("art: zone M (chalk, three tiers) and the centre exist — the renderer, not the sim, gates a fourth zone", artM);
  console.log(`art: ${list.length} sprites audited · ${SPECIES.length} species checked`);
} else {
  console.log("art: js/art/index.js not present yet — Part C skipped");
}

// ---- Part D: the walker layer never writes the sim (SPEC §14) ---------------------
const walkersPath = path.join(ROOT, "js", "walkers.js");
if (existsSync(walkersPath)) {
  const { createWalkers } = await import("../js/walkers.js");
  const w1 = createWorld({ seed: SEED });
  const w2 = createWorld({ seed: SEED });
  const sx = w1.start.tx;
  const sy = w1.start.ty;
  for (const w of [w1, w2]) {
    apply(w, { kind: "zone", zone: ZONE.R, x0: sx - 3, y0: sy - 3, x1: sx, y1: sy + 3, density: 3 });
    apply(w, { kind: "zone", zone: ZONE.I, x0: sx + 1, y0: sy, x1: sx + 3, y1: sy + 3, density: 3 });
    apply(w, { kind: "zone", zone: ZONE.C, x0: sx + 1, y0: sy - 3, x1: sx + 3, y1: sy - 1, density: 3 });
  }
  const walkers = createWalkers(w2);
  const viewport = { x0: 0, y0: 0, x1: w2.w, y1: w2.h };
  for (let t = 0; t < 60; t++) {
    tick(w1);
    tick(w2);
    walkers.notify();
    for (let k = 0; k < 20; k++) walkers.update(0.1, viewport);
  }
  check("walkers never write the sim: hash equal with the walker layer on and off", stateHash(w1) === stateHash(w2), `${stateHash(w1)} vs ${stateHash(w2)}`);
  const list = walkers.list();
  check("walkers carry real citizen ids", list.every((x) => x.citizen == null || w2.byId.has(x.citizen) || x.kind !== "commuter"), `${list.length} walkers`);
  console.log(`walkers: ${list.length} active after 60 ticks`);
} else {
  console.log("walkers: js/walkers.js not present yet — Part D skipped");
}

// ---- verdict ----------------------------------------------------------------------
console.log(`${checks} checks, ${failures.length} failures`);
for (const f of failures) console.log(`  FAIL ${f}`);
process.exit(failures.length ? 1 : 0);
