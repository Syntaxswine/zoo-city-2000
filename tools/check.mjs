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
import { doorOf, hasAccess, computeFields, commuteTime } from "../js/sim/fields.js";
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
  // A walking entry lies on a road (or a platform); a riding entry (bit 15) on rail; the door is the last tile; the time is within the commute.
  for (const p of c.path) { const i = p & 0x7fff; if (p & 0x8000 ? !world.rail[i] : world.road[i] === ROAD.NONE && world.rail[i] !== 2) pathBad++; }
  const end = c.path[c.path.length - 1] & 0x7fff;
  if (c.job >= 0 && doorOf(world, c.job) !== end) pathBad++;
  if (commuteTime(c.path) > KNOBS.COMMUTE_MAX + 1e-9) pathBad++;
}
check("every commute walks on roads, rides on rail, and ends at the job's door", pathBad === 0, `${pathBad}`);
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
  const killings0 = F.events.killings;
  KNOBS.KILL_P = 1 / killTotal(F); // exactly one killing this month (k = floor(1 + r))
  tick(F);
  KNOBS.KILL_P = saveP;
  check("a forced month kills", F.events.killings > 0 && F.events.files.some((f) => f.cause === "killing"), `${F.events.killings}`);
  // The walker layer's cue: one record per killing, the killer alive, the victim gone, named.
  const recs = F.predations || [];
  check("a killing publishes a predation record: the killer alive, the neighbour scrubbed and named", recs.length === F.events.killings - killings0 && recs.every((r) => F.byId.has(r.killer) && !F.byId.has(r.victim.id) && r.victimHome >= 0 && r.killerHome >= 0 && typeof r.victim.name === "string" && r.victim.name.length > 0 && typeof r.victim.species === "string"), `${recs.length} records for ${F.events.killings - killings0} killings`);
  check("the record is per-tick and never saved", !("predations" in toPlain(F)), "toPlain carries predations");
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
  delete plainOld.use;
  delete plainOld.rail;
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

// ---- use-zoning and trespass (docs/PROPOSAL-ZONING-RAIL-WALLS.md §2; SPEC §7.8, §9c) ----
{
  const { admits } = await import("../js/sim/species.js");
  const { commutePath, roadPath, exposure } = await import("../js/sim/fields.js");
  // Frame: with no use-zoning the weighted search IS the BFS — every commuter's stored path is roadPath's, tile for tile.
  let pathDiff = 0, paths = 0;
  for (const c of A.world.citizens) {
    if (!c.path) continue;
    paths++;
    const p = roadPath(A.world, c.path[0], c.path[c.path.length - 1]);
    if (!p || p.length !== c.path.length || p.some((t, k) => t !== c.path[k])) pathDiff++;
  }
  check("use: the weighted commute is the BFS on a city with no line (every stored path tile-equal to roadPath)", paths > 50 && pathDiff === 0, `${pathDiff} of ${paths}`);
  // A ring road on a fresh map, the short side painted predator-only: a rabbit takes the long way, a fox the short.
  const F = createWorld({ seed: SEED });
  let px = -1, py = -1;
  outer: for (let y = 4; y < F.h - 8; y++) for (let x = 4; x < F.w - 12; x++) {
    let ok = true;
    for (let yy = y; yy < y + 3 && ok; yy++) for (let xx = x; xx < x + 7; xx++) { const i = yy * F.w + xx; if (F.terrain[i] !== 0 || F.road[i] || F.zone[i] || F.civic[i] || F.wall[i]) { ok = false; break; } }
    if (ok) { px = x; py = y; break outer; }
  }
  const at = (x, y) => y * F.w + x;
  const ring = [];
  for (let x = px; x <= px + 6; x++) { ring.push(at(x, py)); ring.push(at(x, py + 2)); }
  ring.push(at(px, py + 1), at(px + 6, py + 1));
  apply(F, { kind: "road", tiles: ring });
  const ru = apply(F, { kind: "use", use: 1, x0: px + 1, y0: py, x1: px + 5, y1: py });
  computeFields(F);
  const a = at(px, py), b = at(px + 6, py);
  const rabbit = commutePath(F, "rabbit", a, b), fox = commutePath(F, "fox", a, b);
  check("use: painting five road tiles predator-only costs §1 a tile and is undoable", ru.ok && ru.cost === 5 * KNOBS.COST.use && ru.undoable === true, `${ru.cost}`);
  check("use: a rabbit takes the legal way round (11 tiles), a fox the short predator-only way (7)", !!rabbit && !!fox && rabbit.path.length === 11 && fox.path.length === 7, `rabbit ${rabbit && rabbit.path.length} · fox ${fox && fox.path.length}`);
  check("use: the rabbit's way has no forbidden tile; the fox's cost is the plain walk", !!rabbit && !!fox && Array.from(rabbit.path).every((t) => admits(F.use[t], "rabbit")) && fox.cost === 60, `${fox && fox.cost}`);
  // The gate, the notice and the stop on the scripted city: R prey-only, C predator-only, the ring's north row and east column predator-only.
  const G = load(save(A.world));
  const sx = G.start.tx, sy = G.start.ty;
  const wrong0 = G.citizens.filter((c) => (c.home >= 0 && G.zone[c.home] === ZONE.R && ["fox", "owl", "wolf", "cat", "hawk"].includes(c.species)) || (c.job >= 0 && G.zone[c.job] === ZONE.C && !["fox", "owl", "wolf", "cat", "hawk"].includes(c.species))).length;
  // The year-15 city cannot pay for a repaint (the first draft's paints were refused and every check after passed on an unpainted map —
  // the easy case cannot test). Fund it through the cheat op, then require the paints to have taken.
  apply(G, { kind: "cheat", amount: KNOBS.CHEAT_MAX });
  const paints = [
    apply(G, { kind: "use", use: 2, x0: sx - 3, y0: sy - 3, x1: sx, y1: sy + 3 }),
    apply(G, { kind: "use", use: 1, x0: sx + 1, y0: sy - 3, x1: sx + 3, y1: sy - 1 }),
    apply(G, { kind: "use", use: 1, x0: sx - 4, y0: sy - 4, x1: sx + 4, y1: sy - 4 }),
    apply(G, { kind: "use", use: 1, x0: sx + 4, y0: sy - 4, x1: sx + 4, y1: sy + 4 }),
  ];
  computeFields(G);
  const painted = (() => { let n = 0; for (let i = 0; i < G.w * G.h; i++) if (G.use[i]) n++; return n; })();
  check("use: the four paints took (R prey-only, C predator-only, the ring's north row and east column predator-only)", paints.every((r) => r.ok) && painted >= 40, paints.map((r) => r.reason || r.cost).join(", ") + ` · painted ${painted}`);
  let zonedOut = 0;
  for (let t = 0; t < 24; t++) { tick(G); zonedOut += G.last.zonedOut || 0; }
  const wrongHome = G.citizens.filter((c) => c.home >= 0 && !admits(G.use[c.home], c.species)).length;
  const wrongJob = G.citizens.filter((c) => c.job >= 0 && !admits(G.use[c.job], c.species)).length;
  check("use: two years on, nobody lives or works where the line forbids (rehomed, released or zoned out)", wrong0 > 0 && wrongHome === 0 && wrongJob === 0, `were ${wrong0} · home ${wrongHome} · job ${wrongJob} · zoned out ${zonedOut}`);
  check("use: the zoned-out are gone clean (dangling-id law)", auditIds(G) === 0, `${auditIds(G)}`);
  // Trespass: prey working at doors on the predator-only ring under the station's cover; force a month.
  const stops0 = G.events.justice.trespass; // stops before the forced month: the line was live, unforced, for 24 ticks and a few animals were stopped at the real rate
  const saveP = KNOBS.TRESPASS_P, saveM = KNOBS.TRESPASS_MAX;
  KNOBS.TRESPASS_P = 1e6; KNOBS.TRESPASS_MAX = 1;
  tick(G);
  KNOBS.TRESPASS_P = saveP; KNOBS.TRESPASS_MAX = saveM;
  const j = G.events.justice;
  // A month in the cells ends at the next tick's start (held = tick + 1), so read the stop off the arrest record: the animal has a record, no job, and its release is due now.
  // This month's stops off the arrest records (tick = the month just run): a minor goes to the cells to the next tick with a
  // record and no job; an animal already at RECORD_HARD − 1 from the unforced months meets the table instead (hard).
  const month = G.events.arrests.filter((a) => a.cause === "trespass" && a.tick === G.tick - 1);
  const minorA = month.filter((a) => !a.hard);
  const inCells = minorA.map((a) => G.byId.get(a.citizenId)).filter((c) => c && c.record >= 1 && c.heldAt === -1 && c.held === G.tick && c.job < 0);
  check("use: a forced month stops the exposed — a minor's cells to the next tick, a record, no job; the counter counts the minors", minorA.length > 0 && inCells.length === minorA.length && j.trespass - stops0 === minorA.length, `this month ${month.length} (${minorA.length} minor · ${month.length - minorA.length} hard) · in cells ${inCells.length} · counter +${j.trespass - stops0}`);
  const tline = G.events.log.filter((l) => l.id === "arrest" && /^TRESPASS/.test(l.line));
  check("use: the ticker names the stop and uses no pronoun", tline.length > 0 && tline.every((l) => !/\b(he|she|his|her|him)\b/i.test(l.line)), tline.slice(0, 1).map((l) => l.line).join(""));
  let hard = 0;
  for (let t = 0; t < 24 && !hard; t++) {
    KNOBS.TRESPASS_P = 1e6; KNOBS.TRESPASS_MAX = 1;
    tick(G);
    KNOBS.TRESPASS_P = saveP; KNOBS.TRESPASS_MAX = saveM;
    hard = G.events.arrests.filter((x) => x.cause === "trespass" && x.hard).length;
  }
  check("use: a habitual trespasser's third offence meets the sentence table", hard > 0, `hard ${hard} · stops ${G.events.justice.trespass} · sold ${G.events.justice.sold} · taken in ${G.events.justice.takenIn}`);
  check("use: exposure reads zero for everyone the line admits everywhere", G.citizens.filter((c) => c.path && Array.from(c.path).every((t) => admits(G.use[t], c.species)) && admits(G.use[c.home], c.species) && (c.job < 0 || admits(G.use[c.job], c.species))).every((c) => exposure(G, c).e === 0));
  const H = load(save(G));
  for (let t = 0; t < 12; t++) { tick(G); tick(H); }
  check("use: save → load → 12 ticks with the line and a notice hash-equals", stateHash(G) === stateHash(H), `${stateHash(G)} vs ${stateHash(H)}`);
}

// ---- rail (docs/PROPOSAL-ZONING-RAIL-WALLS.md §3; SPEC §7.9) ------------------------------
{
  const { commutePath, computeTraffic, rides, roadPath } = await import("../js/sim/fields.js");
  const { computeOcclusion, AXIS_EW } = await import("../js/sim/reach.js");
  // A fresh map: a 14-tile road and, one row over, a 14-tile line with a station at each end beside the road's ends.
  const F = createWorld({ seed: SEED });
  let px = -1, py = -1;
  outer: for (let y = 4; y < F.h - 8; y++) for (let x = 4; x < F.w - 18; x++) {
    let ok = true;
    for (let yy = y; yy < y + 3 && ok; yy++) for (let xx = x; xx < x + 14; xx++) { const i = yy * F.w + xx; if (F.terrain[i] !== 0 || F.road[i] || F.zone[i] || F.civic[i] || F.wall[i]) { ok = false; break; } }
    if (ok) { px = x; py = y; break outer; }
  }
  const at = (x, y) => y * F.w + x;
  const road = []; for (let x = px; x < px + 14; x++) road.push(at(x, py));
  apply(F, { kind: "road", tiles: road });
  const line = []; for (let x = px; x < px + 14; x++) line.push(at(x, py + 1));
  const rr = apply(F, { kind: "rail", tiles: line });
  const s1 = apply(F, { kind: "station", tx: px, ty: py + 1 });
  const s2 = apply(F, { kind: "station", tx: px + 13, ty: py + 1 });
  check("rail: a 14-tile line costs §20 a tile; a station is a click on rail, §300", rr.ok && rr.cost === 14 * KNOBS.COST.rail && s1.ok && s2.ok && s1.cost === KNOBS.COST.station && F.rail[at(px, py + 1)] === 2 && F.rail[at(px + 13, py + 1)] === 2, `${rr.cost} · ${s1.reason || s1.cost} · ${s2.reason || s2.cost}`);
  check("rail: no crossings and no bridges in v1 — rail on a road tile and a road on a rail tile are nothing to do; a station off the rail is blocked", apply(F, { kind: "rail", tiles: [at(px + 3, py)] }).ok === false && apply(F, { kind: "road", tiles: [at(px + 3, py + 1)] }).ok === false && apply(F, { kind: "station", tx: px + 3, ty: py + 2 }).reason === "blocked");
  computeFields(F);
  const a = at(px, py), b = at(px + 13, py);
  const ride = commutePath(F, "rabbit", a, b);
  const walkOnly = 13 * 10;
  const riding = ride ? Array.from(ride.path).filter((p) => p & 0x8000).length : 0;
  check("rail: the commute rides — cheaper than the walk, riding on the 12 tiles between the stations and walking at them", !!ride && ride.cost === 10 + 13 * KNOBS.RAIL_COST + 10 && ride.cost < walkOnly && riding === 12 && ride.path.length === 16 && !(ride.path[1] & 0x8000) && !(ride.path[14] & 0x8000), `cost ${ride && ride.cost} vs walk ${walkOnly} · riding ${riding} · tiles ${ride && ride.path.length}`);
  check("rail: commute time counts a ride at 0.3 of a walk", !!ride && Math.abs(commuteTime(ride.path) - (2 + 13 * KNOBS.RAIL_COST / 10)) < 1e-6, `${ride && commuteTime(ride.path)}`);
  {
    const keep = F.citizens;
    F.citizens = [{ path: ride.path }];
    computeTraffic(F);
    let onRail = 0; for (let x = px + 1; x < px + 13; x++) onRail += F.traffic[at(x, py + 1)];
    check("rail: traffic counts walking steps only — none on the track between the stations, one at each platform and each road end", onRail === 0 && F.traffic[a] === 1 && F.traffic[b] === 1 && F.traffic[at(px, py + 1)] === 1 && F.traffic[at(px + 13, py + 1)] === 1, `on the track ${onRail}`);
    F.citizens = keep;
    computeTraffic(F);
  }
  // A wall across the line is a tunnel: open along the track's axis, and the ride passes.
  const wallAt = at(px + 6, py + 1);
  const rw = apply(F, { kind: "wall", tiles: [wallAt] });
  computeOcclusion(F);
  const ride2 = commutePath(F, "rabbit", a, b);
  check("rail: a wall across the line is a tunnel — open along the track, and the ride passes at the same cost", rw.ok && F.wall[wallAt] === 1 && F.rail[wallAt] === 1 && F.occl[wallAt] === AXIS_EW && !!ride2 && ride2.cost === ride.cost, `occl ${F.occl[wallAt]} · cost ${ride2 && ride2.cost}`);
  const rb = apply(F, { kind: "bulldoze", x0: px + 13, y0: py + 1, x1: px + 13, y1: py + 1 });
  const ride3 = commutePath(F, "rabbit", a, b);
  check("rail: bulldozing the far station leaves the line but nobody alights — the commute walks", rb.ok && F.rail[at(px + 13, py + 1)] === 0 && !!ride3 && !rides(ride3.path) && ride3.cost === walkOnly, `cost ${ride3 && ride3.cost}`);
  undo(F);
  // Riders on the scripted city: a line round the ring's east and south, stations beside the ring's NE and SW.
  const G = load(save(A.world));
  apply(G, { kind: "cheat", amount: KNOBS.CHEAT_MAX });
  const sx = G.start.tx, sy = G.start.ty;
  const gat = (x, y) => y * G.w + x;
  const col = []; for (let y = sy - 3; y <= sy + 5; y++) col.push(gat(sx + 5, y));
  const row = []; for (let x = sx - 4; x <= sx + 4; x++) row.push(gat(x, sy + 5));
  const l1 = apply(G, { kind: "rail", tiles: col }), l2 = apply(G, { kind: "rail", tiles: row });
  const g1 = apply(G, { kind: "station", tx: sx + 5, ty: sy - 3 }), g2 = apply(G, { kind: "station", tx: sx - 4, ty: sy + 5 });
  check("rail: the scripted city takes a line and two stations", l1.ok && l2.ok && g1.ok && g2.ok, [l1, l2, g1, g2].map((r) => r.reason || r.cost).join(", "));
  let trafficBefore = 0; for (let i = 0; i < G.w * G.h; i++) trafficBefore += G.traffic[i];
  tick(G); // the rail ops invalidated every path; this tick's census runs before the job search rebuilds them
  tick(G); // this one's census counts the riders
  const ridersG = G.citizens.filter((c) => c.path && rides(c.path));
  const quicker = ridersG.every((c) => { const w0 = roadPath(G, c.path[0] & 0x7fff, c.path[c.path.length - 1] & 0x7fff); return !w0 || commuteTime(c.path) <= w0.length - 1 + 1e-9; });
  check("rail: riders on the scripted city, each no slower than the walk; the census counts them", ridersG.length > 0 && quicker && G.last.census.riders === ridersG.length && G.last.census.stations === 2, `riders ${ridersG.length} · census ${G.last.census.riders} · stations ${G.last.census.stations} · traffic ${trafficBefore} → ${(() => { let t = 0; for (let i = 0; i < G.w * G.h; i++) t += G.traffic[i]; return t; })()}`);
  const H = load(save(G));
  for (let t = 0; t < 12; t++) { tick(G); tick(H); }
  check("rail: save → load → 12 ticks with rail and riders hash-equals", stateHash(G) === stateHash(H), `${stateHash(G)} vs ${stateHash(H)}`);
}

// ---- what a station BUYS: fire, police, and the rubble clock (session 8; tools/serviceprobe.mjs) ----
{
  const EV = await import("../js/sim/events.js");
  const JU = await import("../js/sim/justice.js");
  const { lotScore, REASON } = await import("../js/sim/lots.js");
  const FIRE = EV.ROSTER.find((e) => e.id === "fire");
  const N = A.world.w * A.world.h;
  const anyBurning = (w) => { for (let i = 0; i < N; i++) if (w.burning[i]) return true; return false; };
  const firstBuilt = (w) => { for (let i = 0; i < N; i++) if (w.tier[i] > 0 && !w.burning[i] && !w.rubble[i]) return i; return -1; };

  // --- HOW OFTEN. The roster weight is exact arithmetic, so this needs no run:
  // a town covered end to end must roll fires at FIRE_START_COVERED of the rate
  // of the same town covered nowhere. Before session 8 the weight was flat and
  // coverage only moved a fire onto whatever was still uncovered.
  const Wt = load(A.saved);
  computeFields(Wt);
  const cenWt = census(Wt);
  Wt.fireCov.fill(0);
  const wBare = FIRE.weight(Wt, cenWt);
  Wt.fireCov.fill(1);
  const wCovered = FIRE.weight(Wt, cenWt);
  check("fire: covering the town makes a fire RARER, not differently placed",
    wBare > 0 && Math.abs(wCovered / wBare - KNOBS.FIRE_START_COVERED) < 1e-9,
    `weight ${wBare.toFixed(3)} bare vs ${wCovered.toFixed(3)} covered — ratio ${(wCovered / wBare).toFixed(4)}, wanted ${KNOBS.FIRE_START_COVERED.toFixed(4)}`);
  check("fire: the roster weight and the origin picker read the SAME exposure",
    /fireExposure\(w\)\.share/.test(readFileSync(path.join(ROOT, "js/sim/events.js"), "utf8"))
    && /const \{ lots, total \} = fireExposure\(w\)/.test(readFileSync(path.join(ROOT, "js/sim/events.js"), "utf8")));

  // --- HOW BAD. A fire that is put out leaves no mark on the map, so the count
  // comes from world.fires, which eventsTick publishes per tick. eventsTick is
  // driven directly: tick() would recompute coverage and undo the forced cover.
  function burnTrials(cov, trials) {
    const T = load(A.saved);
    T.events.noDisasters = true;
    computeFields(T);
    const cen = census(T);
    const dem = T.last ? T.last.demand : { n: 8 };
    let lit = 0, saved = 0, razed = 0;
    for (let k = 0; k < trials; k++) {
      const i = firstBuilt(T);
      if (i < 0) break;
      T.fireCov.fill(cov);
      T.burning[i] = cov ? 1 : 2;
      lit++;
      for (let guard = 0; guard < 80 && anyBurning(T); guard++) {
        T.fireCov.fill(cov); // eventsTick never touches coverage; computeFields would
        EV.eventsTick(T, cen, dem);
        saved += T.fires.saved;
        razed += T.fires.razed;
      }
    }
    return { lit, saved, razed };
  }
  // Off a beat a fire is supercritical (two months × four neighbours × FIRE_SPREAD),
  // so it eats its whole block and the town runs out of unburnt lots long before
  // 30 trials — the count of trials is a ceiling, not a promise.
  const dark = burnTrials(0, 30);
  const beat = burnTrials(1, 30);
  check("fire: off a beat the building ALWAYS goes — that was true on a beat too until session 8",
    dark.lit >= 5 && dark.saved === 0 && dark.razed >= dark.lit,
    `${dark.lit} lit · ${dark.saved} saved · ${dark.razed} razed`);
  check("fire: on a beat the engine saves most of them",
    beat.saved > 0 && beat.saved > beat.razed,
    `${beat.lit} lit · ${beat.saved} saved · ${beat.razed} razed (FIRE_SAVED ${KNOBS.FIRE_SAVED})`);
  const savedLine = "SAVED — the engine reached the fire at (1,2); the walls stand and a storey is gone.";
  check("fire: the SAVED line is registered as a good headline (the HEIST trap, 944e507)",
    EV.TICKER_FLASH.test(savedLine) && EV.TICKER_GOOD.test(savedLine) && !EV.TICKER_BAD.test(savedLine));

  // --- The rubble clock: it counts down in the tile array itself, so every
  // `if (world.rubble[i])` in the codebase still reads "there is rubble here"
  // and the save carries the clock without a new field.
  const R = load(A.saved);
  R.events.noDisasters = true;
  computeFields(R);
  let lot = -1;
  for (let i = 0; i < N; i++) if (R.tier[i] > 0 && !R.rubble[i] && !R.burning[i] && !R.fireCov[i]) { lot = i; break; }
  R.burning[lot] = 1;
  tick(R);
  check("rubble: a lot that burns down starts a RUBBLE_MONTHS clock, not a permanent flag",
    lot >= 0 && R.rubble[lot] === KNOBS.RUBBLE_MONTHS && R.tier[lot] === 0,
    `rubble ${R.rubble[lot]} of ${KNOBS.RUBBLE_MONTHS} · tier ${R.tier[lot]}`);
  check("rubble: the lot is not eligible while the clock runs", lotScore(R, lot).reason === REASON.RUBBLE);
  const clock = load(save(R));
  check("rubble: the clock survives a save (it rides in the rubble array, no new tile field)",
    clock.rubble[lot] === R.rubble[lot] && R.rubble[lot] > 1, `${clock.rubble[lot]} vs ${R.rubble[lot]}`);
  const ticks = [];
  for (let k = 0; k < KNOBS.RUBBLE_MONTHS; k++) { tick(R); ticks.push(R.rubble[lot]); }
  check("rubble: it clears ITSELF, one month at a time, and the plot is eligible with no bulldozer",
    R.rubble[lot] === 0 && ticks.every((v, k) => v === KNOBS.RUBBLE_MONTHS - 1 - k) && lotScore(R, lot).reason !== REASON.RUBBLE,
    `countdown ${ticks.join(",")}`);
  const B2 = load(A.saved);
  B2.events.noDisasters = true;
  computeFields(B2);
  let lot2 = -1;
  for (let i = 0; i < N; i++) if (B2.tier[i] > 0 && !B2.rubble[i] && !B2.burning[i] && !B2.fireCov[i]) { lot2 = i; break; }
  B2.burning[lot2] = 1;
  tick(B2);
  B2.cash = 9999;
  apply(B2, { kind: "bulldoze", x0: lot2 % B2.w, y0: (lot2 / B2.w) | 0, x1: lot2 % B2.w, y1: (lot2 / B2.w) | 0 });
  check("rubble: the bulldozer is still impatience — it clears the clock at once",
    B2.rubble[lot2] === 0, `${B2.rubble[lot2]}`);

  // --- The three lines that flashed and were never written down. tick.js skips
  // logging anything eventsTick returns, on the ground that "rolled events
  // already logged themselves" — which was true of the roster and of nothing
  // else, so the news reader (SPEC §11b) could not show them.
  const C = load(A.saved);
  C.events.noDisasters = true;
  computeFields(C);
  const cenC = census(C);
  const old = C.citizens.find((c) => !c.dead && c.home >= 0);
  old.species = "tortoise";
  old.born = C.tick - 100 * 12;
  old.centenary = false;
  // eventsTick directly, not tick(): a full month would run citizensTick first,
  // and a hundred-year-old rolls against its species' lifespan before it can
  // have its birthday.
  const cRes = EV.eventsTick(C, cenC, C.last ? C.last.demand : { n: 8 });
  const hundred = cRes.find((l) => /ONE HUNDRED/.test(l));
  check("events: the centenary reaches the LOG and not only the map — the reader reads the log",
    !!hundred && C.events.log.some((e) => e.t === C.tick && e.line === hundred),
    hundred ? "said but never written down" : "no centenary line at all");
  let orphan = 0, said = 0;
  const L = load(A.saved);
  for (let t = 0; t < 120; t++) {
    const r = tick(L);
    for (const line of r.events) { said++; if (!L.events.log.some((e) => e.t === L.tick - 1 && e.line === line)) orphan++; }
  }
  check("events: EVERY line the events tick says goes on the record", orphan === 0 && said > 0, `${orphan} orphaned of ${said}`);

  // --- Crime is not caused by having police.
  const P0 = load(A.saved);
  for (let i = 0; i < N; i++) if (P0.civic[i] === CIVIC.POLICE) P0.civic[i] = 0;
  P0.events.files = []; // the scripted city arrives with its own open files
  computeFields(P0);
  const cen0 = census(P0);
  for (let i = 0; i < N; i++) if (P0.tier[i] > 0) P0.crime[i] = 100; // a town gone bad, with nobody to call
  let burgled = 0;
  for (let k = 0; k < 400; k++) { const nn = []; JU.burglaryTick(P0, cen0, nn); burgled += nn.length; }
  check("crime: a burglary needs no police station to HAPPEN — a station buys the investigation, not the crime",
    cen0.policeStations === 0 && burgled > 0 && P0.events.files.filter((f) => f.cause === "burglary").length === burgled,
    `${burgled} burglaries, ${P0.events.files.filter((f) => f.cause === "burglary").length} files, ${cen0.policeStations} stations`);
  const arrests0 = P0.events.arrests.length;
  const cold0 = P0.events.justice.cold;
  const coldLines = [];
  for (let k = 0; k <= KNOBS.CASE_MONTHS + 1; k++) { P0.tick++; JU.filesTick(P0, cen0, coldLines); }
  check("crime: with no station in town nothing is investigated — every file goes cold",
    P0.events.arrests.length === arrests0 && P0.events.justice.cold - cold0 === burgled,
    `${P0.events.arrests.length - arrests0} arrests · ${P0.events.justice.cold - cold0} cold of ${burgled}`);
  check("crime: a burglary going cold is written down, and does NOT flash over the map",
    coldLines.length > 0 && coldLines.every((l) => /never charged/.test(l) && !EV.TICKER_FLASH.test(l))
    && P0.events.log.some((e) => e.id === "cold" && /never charged/.test(e.line)),
    `${coldLines.length} lines`);

  // --- The force works the case; the beat works the street. Same world, same
  // scenes, only the number of stations the census reports changes.
  function solveRate(stations) {
    const S = load(A.saved);
    computeFields(S);
    const cen = { ...census(S), policeStations: stations };
    for (let i = 0; i < N; i++) if (S.tier[i] > 0) S.crime[i] = 100;
    let opened = 0;
    for (let k = 0; k < 120; k++) { const nn = []; JU.burglaryTick(S, cen, nn); opened += nn.length; }
    const a0 = S.events.arrests.length;
    for (let k = 0; k <= KNOBS.CASE_MONTHS + 1; k++) { S.tick++; JU.filesTick(S, cen, []); }
    return { opened, arrests: S.events.arrests.length - a0 };
  }
  const one = solveRate(1);
  const many = solveRate(KNOBS.ARREST_FORCE_N);
  check("crime: a bigger force clears more files, wherever the crime happened",
    one.opened > 10 && many.opened > 10 && many.arrests / many.opened > one.arrests / one.opened,
    `1 station ${one.arrests}/${one.opened} · ${KNOBS.ARREST_FORCE_N} stations ${many.arrests}/${many.opened}`);

  // --- The stain of open files is capped, so crime cannot manufacture itself.
  function crimeWith(files) {
    const S = load(A.saved);
    S.events.files = [];
    computeFields(S);
    const t0 = firstBuilt(S);
    for (let k = 0; k < files; k++) JU.openFile(S, { tile: t0, culpritId: -1, cause: "burglary" });
    computeFields(S);
    return { t0, crime: S.crime[t0] };
  }
  const c0 = crimeWith(0).crime, c1 = crimeWith(1).crime, c2 = crimeWith(2).crime, c6 = crimeWith(6).crime;
  check("crime: the stains of overlapping files CAP — a street where three things happened is a bad street, not three bad streets",
    c1 > c0 && c2 > c1 && c6 === c2 && c2 - c0 === KNOBS.FILE_CRIME_MAX,
    `0 files ${c0} · 1 ${c1} · 2 ${c2} · 6 ${c6} (cap ${KNOBS.FILE_CRIME_MAX})`);

  // The hover card has to tell the player the clock is running, or a
  // self-clearing site is indistinguishable from a stuck one. Source-level:
  // the card reads the countdown out of the tile, it does not say a fixed
  // number that RUBBLE_MONTHS could drift away from.
  const uiRubble = (readFileSync(path.join(ROOT, "js", "ui.js"), "utf8").split("\n").find((l) => /w\.rubble\[i\]\)\s*lines\.push/.test(l)) || "");
  // The Rules tab's live lines run against the world every refresh and nothing
  // ever ran them here, so a `live` reading a census field that does not exist
  // would break the tab in the browser with the suite green. S2 and S3 gained
  // such reads this session.
  const { RULES } = await import("../js/sim/rules.js");
  const broke = [];
  for (const r of RULES) {
    try { const s = r.live(A.world); if (typeof s !== "string") broke.push(`${r.id}: ${typeof s}`); }
    catch (e) { broke.push(`${r.id}: ${e.message}`); }
  }
  // A rule may have no figure to show (G4 returns "" on purpose); what it may
  // never do is throw, or hand the panel something that is not a string.
  const spoken = RULES.filter((r) => r.live(A.world).length > 0).length;
  check("the recipe: every rule renders its live line against a real city",
    RULES.length > 0 && broke.length === 0 && spoken >= RULES.length - 1,
    broke.join(" · ") || `${spoken} of ${RULES.length} rules have a figure`);
  check("the recipe: the fire and police rules quote what a station now buys",
    /engine SAVES|saves the building/i.test(RULES.find((r) => r.id === "S3").formula)
    && /rolled at the town/i.test(RULES.find((r) => r.id === "S3").formula)
    && /FORCE/.test(RULES.find((r) => r.id === "S2").formula));

  check("rubble: the hover card counts the months down from the tile itself",
    /\$\{w\.rubble\[i\]\}/.test(uiRubble) && /clears itself/.test(uiRubble) && !/\b6 months\b/.test(uiRubble),
    uiRubble.trim().slice(0, 90));
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

// the news reader (SPEC §11b): the feed is DERIVED from the city's own event
// log and history — the panel keeps no second copy — a row is named by its
// words so the log's roll cannot re-bind a read mark, and the sim never hears
// that any of this exists.
{
  const { newsRows, keyOf } = await import("../js/news.js");
  const { TICKER_FLASH } = await import("../js/sim/events.js");
  // The tortoise centenary's line begins with a CITIZEN'S NAME, which is in no
  // list. It reaches the flash run and the reader's "headlines" chip only
  // because TICKER_FLASH's last alternative, ONE HUNDRED, sits OUTSIDE the
  // ^(...) group and so matches anywhere. Anchoring it to tidy the regex kills
  // the plaque line in silence, so the suite holds the exception open.
  check("news: the centenary flashes though its line starts with a name",
    TICKER_FLASH.test("Ada Shellworth is ONE HUNDRED. A plaque goes up; the street is worth more for it.")
    && !TICKER_FLASH.test("Ada Shellworth is ninety-nine. Nothing goes up."));
  const rows = newsRows(A.world);
  const logN = A.world.events.log.length;
  check("news: the feed is the city's own log, line for line — no synthesized second copy",
    rows.length === logN, `${rows.length} rows vs ${logN} logged`);
  check("news: the feed runs oldest first", rows.every((r, i) => i === 0 || rows[i - 1].t <= r.t));
  // The bug this replaced: the advisor logs a yearly REPORT line AND the panel
  // synthesized a second one out of world.history on load, so every loaded
  // city printed each year twice with two different net figures.
  const years = rows.filter((r) => r.report).map((r) => r.text.slice(0, 12));
  check("news: a year sums itself up once", new Set(years).size === years.length,
    `${years.length} report lines, ${new Set(years).size} distinct years`);
  check("news: the reports the city logged are all of them",
    rows.filter((r) => r.report).length === A.world.events.log.filter((e) => /^REPORT /.test(e.line)).length);
  check("news: every row carries a month label and words", rows.every((r) => typeof r.text === "string" && r.text.length > 0 && typeof r.label === "string" && r.label.length > 0));
  const named = new Map(rows.map((r) => [keyOf(r), r.text]));
  check("news: every row has its own name", named.size === rows.length, `${named.size} names for ${rows.length} rows`);
  // The read mark lives in the browser and the feed lives in the city, so a
  // name must POINT AT THE SAME DISPATCH after a round trip and after the log
  // rolls. Asking only whether a name still exists proves nothing: a name made
  // of the row's PLACE in its month survives a roll perfectly well — bound to
  // its neighbour. Compare the WORDS each name resolves to.
  const rebound = (feed) => feed.filter((r) => named.has(keyOf(r)) && named.get(keyOf(r)) !== r.text);
  const back = newsRows(load(save(A.world)));
  const lost = back.filter((r) => !named.has(keyOf(r)));
  check("news: a save → load leaves every name on its own dispatch",
    back.length > 0 && lost.length === 0 && rebound(back).length === 0,
    `${lost.length} lost, ${rebound(back).length} re-bound of ${back.length}`);
  // Cut INSIDE a month, which is the only cut that can tell the two naming
  // schemes apart — one landing on a month boundary cannot, and a check that
  // cannot fail is not a check. Refuse rather than pass if the fixture has no
  // month with two lines in it.
  const cut = load(save(A.world));
  const before = cut.events.log.length;
  let at = -1;
  for (let i = 1; i < cut.events.log.length; i++) if (cut.events.log[i].t === cut.events.log[i - 1].t) { at = i; break; }
  cut.events.log = at > 0 ? cut.events.log.slice(at) : cut.events.log;
  const cutRows = newsRows(cut);
  const cutLost = cutRows.filter((r) => !named.has(keyOf(r)));
  check("news: a roll that cuts a month in half re-binds nobody",
    at > 0 && cutRows.length > 0 && cutLost.length === 0 && rebound(cutRows).length === 0,
    at < 0 ? `no multi-line month in the fixture — this check proved nothing` : `cut ${at} of ${before}, inside a month: ${cutLost.length} lost, ${rebound(cutRows).length} re-bound of ${cutRows.length}`);
  // A dead city still reads: the reader opens on a map that has made no news.
  check("news: an empty city has an empty feed, not a crash", newsRows(createWorld({ seed: "quiet" })).length === 0);
  check("news: no world at all is an empty feed", newsRows(null).length === 0);

  const newsSrc = readFileSync(path.join(ROOT, "js", "news.js"), "utf8");
  const uiSrc = readFileSync(path.join(ROOT, "js", "ui.js"), "utf8");
  const html2 = readFileSync(path.join(ROOT, "index.html"), "utf8");
  check("news: js/news.js exports newsRows and createNews", /export function newsRows\b/.test(newsSrc) && /export function createNews\b/.test(newsSrc));
  check("news: index.html mounts #news and the footer names the key", /id="news"/.test(html2) && /R news/.test(html2));
  check("news: the strip carries the button", /btnNews/.test(uiSrc) && /app\.news\.toggle\(\)/.test(uiSrc));
  check("news: the panel keeps no second copy of the feed", !/logLines/.test(uiSrc) && /newsRows\(/.test(uiSrc));
  // The bug that made the reader necessary: onTick used to call flash() once
  // per notice, so three of a month's four headlines were never seen.
  check("news: a month's headlines queue instead of overwriting each other", /flashRun\(/.test(uiSrc) && !/if \(TICKER_FLASH\.test\(n\)\) flash\(n\)/.test(uiSrc));
  check("news: the reader stops the clock while it is open", /app\.news && app\.news\.isOpen\(\)/.test(uiSrc));
  const simSeesNews = files.filter((f) => /[\\/]sim[\\/]/.test(f) && /news\.js|newsRows|readMark/.test(readFileSync(f, "utf8"))).map((f) => path.relative(ROOT, f));
  check("news: the sim never hears about the reader", simSeesNews.length === 0, simSeesNews.join(", "));
  // The read mark is the BROWSER's. A save that carried one would travel in an
  // export and mark a different player's news read on a city they never saw.
  const saveText = save(A.world);
  const saveKeys = Object.keys(JSON.parse(saveText));
  check("news: a save carries no read mark",
    !saveText.includes('"news"') && !saveKeys.some((k) => /^(news|read)/i.test(k)),
    saveKeys.filter((k) => /^(news|read)/i.test(k)).join(", "));
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
    // The sack over the shoulder: the figure is the plain figure, 3 px in, on the same feet.
    {
      const { ink } = await import("../js/art/format.js");
      let feet = true, sack = true, throws = "";
      for (const species of ["wolf", "fox", "rabbit", "bear", "tortoise", "hawk"])
        for (const facing of ["se", "ne", "sw", "nw"])
          for (let frame = 0; frame < 3; frame++) {
            try {
              const plain = art.citizen(species, facing, frame, "adult");
              const carry = art.citizen(species, facing, frame, "adult", { carry: "sack" });
              // The tortoise's 1-px outline is clipped by the 12-px grid and not by the 18-px one: compare it without the outline key.
              const bare = (r) => (species === "tortoise" ? r.replace(/\+/g, ".") : r);
              for (let k = 1; k <= 12; k++) if (bare(carry.rows[carry.rows.length - k]) !== "..." + bare(plain.rows[plain.rows.length - k]) + "...") feet = false;
              if (!(carry.anchor[0] === plain.anchor[0] + 3 && carry.anchor[1] === carry.rows.length - 1 && carry.w === 18)) feet = false;
              if (ink(carry.rows) - ink(plain.rows) < 24) sack = false;
            } catch (e) { throws = `${species} ${facing} ${frame}: ${e.message}`; }
          }
      check("carry: the body rows are the plain sprite's, 3 px in, and the anchor is the feet", feet && !throws, throws);
      check("carry: the sack adds at least 24 px of ink on every facing and frame", sack, "");
      const sacks = [0, 1, 2].map((f) => art.overlay("sack", f));
      check("the three sacks stand on the feet of an adult", sacks.every((sk) => sk.w === 12 && sk.h === 20 && sk.anchor[0] === 6 && sk.anchor[1] === 19) && sacks[1].rows.join() !== sacks[2].rows.join(), "");
    }
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
  // From year 2.5 a killing is forced (on BOTH worlds — the hash check below
  // now covers the predation walker's whole run) until one lands; then the
  // walker is followed frame by frame: the fall, the tied sack, the carry home, the end.
  const { killTotal: killTotalD } = await import("../js/sim/justice.js");
  const savePD = KNOBS.KILL_P;
  let rec = null, pred = null, sawFall = false, sawTied = false, sawCarry = false, gone = false, stoodAtDoor = false;
  for (let t = 0; t < 60; t++) {
    const force = t >= 30 && !rec;
    if (force) KNOBS.KILL_P = 1 / Math.max(1e-9, killTotalD(w1));
    tick(w1);
    tick(w2);
    if (force) KNOBS.KILL_P = savePD;
    if (!rec && w2.predations && w2.predations.length) rec = w2.predations[0];
    walkers.notify();
    for (let k = 0; k < 20; k++) {
      walkers.update(0.1, viewport);
      const p = walkers.list().find((x) => x.kind === "predation");
      if (p) {
        pred = p;
        if (p.bag != null && p.prey && p.bag < 0.45) sawFall = true;
        if (p.bag != null && p.bag >= 0.45) {
          sawTied = true;
          // The killer stands at the door's centre; the neighbour 0.32 tiles past it.
          const dd = Math.abs(p.prey.tx - p.tx) + Math.abs(p.prey.ty - p.ty);
          if (Math.abs(dd - 0.32) < 1e-6) stoodAtDoor = true;
        }
        if (p.carry === "sack" && p.leg === 1 && !p.prey) sawCarry = true;
      } else if (pred) gone = true;
    }
  }
  KNOBS.KILL_P = savePD;
  check("a forced killing publishes a record and the walker layer takes it: the killer's own walker, the neighbour named in the sack", !!rec && !!pred && pred.citizen === rec.killer && pred.preyName === rec.victim.name, rec ? (pred ? `${pred.citizen} vs ${rec.killer}` : "no predation walker") : "no killing landed in 30 forced months");
  check("the sack falls, is tied at the door, goes home over the shoulder, and the walker finishes", sawFall && sawTied && stoodAtDoor && sawCarry && gone, `fall ${sawFall} tied ${sawTied} door ${stoodAtDoor} carry ${sawCarry} gone ${gone}`);
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
