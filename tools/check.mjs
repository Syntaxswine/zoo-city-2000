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
import { lightLevel } from "../js/art/building-character.js";
import { createWorld, ZONE, ROAD, capacityOf, jobsOf, isPart, sideOf } from "../js/sim/world.js";
import { tick } from "../js/sim/tick.js";
import { apply, replay, undo, costOf as costOfOp } from "../js/sim/ops.js";
import { save, load, stateHash, stateHashNoNews, toPlain } from "../js/sim/save.js";
import { KNOBS, RULES } from "../js/sim/rules.js";
import { post } from "../js/sim/budget.js";
import { doorOf, doorsOf, served, computeFields, commuteTime } from "../js/sim/fields.js";
import { census } from "../js/sim/census.js";
import { CIVIC } from "../js/sim/world.js";
import { listSlots, listAllSlots, writeSlot, readSlot, deleteSlot, bytesUsed, migrate } from "../js/slots.js";
import { USE, USE_BIT_OF, USE_MASK, USE_OPTIONS, USE_SPECIES, useName, useTint } from "../js/sim/use.js";

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
    if (t === 48) { apply(world, { kind: "zoo", tx: sx + 5, ty: sy + 1 }); apply(world, { kind: "police", tx: sx + 5, ty: sy - 2 }); apply(world, { kind: "centre", tx: sx - 3, ty: sy + 5 }); }
    if (t === 60) apply(world, { kind: "rate", zone: "R", value: 10 });
    if (t === 84) apply(world, { kind: "rate", zone: "R", value: 7 });
    if (t === 100) apply(world, { kind: "tree", x0: sx + 5, y0: sy + 5, x1: sx + 7, y1: sy + 7 });
    if (t === 120) apply(world, { kind: "bulldoze", x0: sx + 1, y0: sy + 3, x1: sx + 1, y1: sy + 3 });
    const before = Uint8Array.from(world.tier);
    tick(world);
    for (let i = 0; i < world.w * world.h; i++) if (world.tier[i] > before[i] && !served(world, i)) grewWithAccess.ok = false;
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
// A WALL CLOCK INSIDE A DETERMINISM SUITE IS A TRAP, and it caught this
// project: at 30 ms this line failed under CPU contention, `check.mjs` exited
// 1 like any other failure, and a MUTATION SWEEP running many lanes at once
// read that as "the mutant was caught". A fourth hostile review re-ran every
// mutant whose failure count was low at four lanes instead of fourteen and
// moved EIGHT verdicts from CAUGHT back to SURVIVED. So the number is the
// instrument (it is printed above, every run) and the bound is only a net for
// something catastrophically wrong: 250 ms is twenty-five times the ~10 ms
// this actually costs, far outside anything a busy machine produces, and
// still inside anything a real algorithmic regression would blow through.
check("tick cost is not catastrophic (the printed number is the instrument; this bound is contention-proof on purpose)", ms < 250, `${ms.toFixed(1)} ms/tick`);
// NOTHING MAY END A TICK STALE, asked of EVERY TICK BOUNDARY of a real town
// with the weather on. This is the two-line universal instrument the law never
// had, and it is what five hostile reviews of the access work kept walking
// past: a commute is marked stale in three places, and one of their callers -
// `eventsTick`, at step 7, where a fire razes a home and the family is evicted
// and rehomed - runs AFTER the pass that repairs them. The month then ends
// with those commutes null; `moods` reads that as no commute at all (mood is
// SAVED, and drives departures and approval), and next month's traffic comes
// from nothing in the straight run and from everything after a reload.
//
// It has to run with DISASTERS ON. Every published gate for road access runs
// with them off (`tools/mayor.mjs` defaults `disasters` false), which is
// exactly why none of them could see this: no building ever burns in them.
{
  const BL2 = await import("../js/sim/blocks.js");
  const B = load(A.saved);
  let worst = null;
  let staleLeft = 0;
  let worstAtJustice = 0;
  let boundaries = 0;
  for (let t = 0; t < 15 * 12; t++) {
    tick(B);
    boundaries++;
    let pathless = 0;
    for (const c of B.citizens) {
      if (c.dead || c.home < 0 || c.job < 0) continue;
      if (!c.path) pathless++;
      if (c.stale) staleLeft++;
    }
    if (pathless && (!worst || pathless > worst.n)) worst = { n: pathless, month: t };
    // AND THE WINDOW INSIDE THE TICK, not only its end: `justiceTick` prices a
    // trespass from `c.path` and `meatTick` routes carts on it, both after the
    // settle that follows the fire. A commute missing THERE changes who is
    // exposed and how many rolls justice takes, and the city never comes back.
    // NO `|| 0` HERE: a missing field would read as compliance, and a mutant
    // that deleted the re-plan AND the counter together lived on exactly that.
    worstAtJustice = Math.max(worstAtJustice, B.last.staleAtJustice);
  }
  // AND THE CASE FORCED, because the passive walk is a canary and a canary
  // waits for weather. The reachable trigger is a FIRE ON A FULL HOME: the
  // eviction rehomes the family at step 7, `placeHousehold` marks every one of
  // them stale, and `citizensTick` - the pass that repairs stale commutes -
  // ran two steps earlier. Measured with the boundary re-plan removed: ten
  // employed animals end that month with no commute and eleven are still
  // flagged. No op, no station, no forecourt: this is why the law cannot live
  // in a door-graph settle.
  const BF = load(A.saved);
  for (let t = 0; t < 90; t++) tick(BF);
  let fattest = -1;
  let fattestN = 0;
  for (let i = 0; i < BF.w * BF.h; i++) {
    if (BF.zone[i] !== ZONE.R || BF.tier[i] === 0) continue;
    const n = BF.citizens.filter((c) => !c.dead && c.home === i && c.job >= 0).length;
    if (n > fattestN) { fattestN = n; fattest = i; }
  }
  BL2.ignite(BF, fattest, 1);
  let razedAt = -1;
  for (let k = 0; k < 12 && razedAt < 0; k++) { tick(BF); if (BF.tier[fattest] === 0) razedAt = k + 1; }
  const burntPathless = BF.citizens.filter((c) => !c.dead && c.home >= 0 && c.job >= 0 && !c.path).length;
  const burntStale = BF.citizens.filter((c) => !c.dead && c.stale).length;
  check("NOTHING MAY END A TICK STALE — 180 tick boundaries of a real town with the weather on, AND the case forced: burn down the fullest house in the city and the month still ends with every employed animal carrying a commute and nobody left flagged — and nobody is missing one at the moment JUSTICE and the CARTS read them either, which is inside the same tick",
    !worst && staleLeft === 0 && worstAtJustice === 0 && BF.last.staleAtJustice === 0
      && fattestN >= 5 && razedAt > 0 && burntPathless === 0 && burntStale === 0,
    `${boundaries} boundaries · ${worst ? `WORST month ${worst.month}: ${worst.n} employed animals with no commute` : "0 pathless at every boundary"} · ${staleLeft} left flagged · the fire: ${fattestN} employed animals burnt out, razed after ${razedAt} month${razedAt === 1 ? "" : "s"}, ${burntPathless} left with no commute and ${burntStale} still flagged`);
}

// A CANARY, not a target. The suite had no guard on the scripted city's SIZE
// at all: a hostile review re-introduced a frontage rule spelled another way,
// the fixture town fell 41% (385 citizens to 226), and 464 checks stayed
// green because every one of them asks about a mechanism and none about the
// town. The band is deliberately wide — this is here to catch a collapse, not
// to pin a number, and a legitimate change that moves it this far should say
// so in its commit and move the band.
// THE CANARY, and it has to be able to SEE. The band was 250-560 round a town
// of 385 - three parts in eight either way - and a hostile review deleted one
// line of fields.js, moved a scripted town by 10% and watched the suite report
// 478 checks and no failures. A canary with a band wider than the damage is
// not a canary. Civic campuses and crime-specific sentencing reset 385 to 326
// (2026-09-05); explicit destinations change custody and growth.
// Economic camps retain households after departure/decay (326 to 368).
// 350-386 is +/-5%: a change that moves the town further than
// that is a FINDING, and re-baselining this line is a deliberate act with a
// number in the commit message, not a nuisance to be widened away.
check("the scripted city is still a town", world.citizens.length > 350 && world.citizens.length < 386, `${world.citizens.length} citizens after ${YEARS} years (the band is 350-386, \u00b15% of 368; moving it is a finding, and re-baselining is a decision)`);

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
  if (c.job >= 0 && !doorsOf(world, c.job).includes(end)) pathBad++;
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
  check("dread: empty halls emit less than the old full-strength tier-2 value", dreadPeak > 0 && dreadPeak < 70, `${dreadPeak}`);
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
  const ci = (sy + 5) * F.w + (sx - 3);
  const rc = F.civic[ci] === CIVIC.CENTRE ? { ok: true } : apply(F, { kind: "centre", tx: sx - 3, ty: sy + 5 });
  check("a centre stands in the scripted city", rc.ok === true && F.civic[ci] === CIVIC.CENTRE, rc.reason || "");
  // Force killing + arrest (the wrongful branch every time) until a conviction
  // lands in the centre: a prey target is SOLD at the hall instead (the
  // sentence table), so one round is not guaranteed to fill a bed.
  const saveA = KNOBS.ARREST_BASE, saveW = KNOBS.WRONGFUL_P;
  let rounds = 0;
  const taken0 = F.events.justice.takenIn, wrongful0 = F.events.justice.wrongful;
  while ((F.events.justice.takenIn === taken0 || F.events.justice.wrongful === wrongful0) && rounds < 8) {
    KNOBS.KILL_P = 1 / Math.max(1e-9, killTotal(F));
    tick(F);
    KNOBS.KILL_P = saveP;
    KNOBS.ARREST_BASE = 1; KNOBS.WRONGFUL_P = 1;
    tick(F);
    KNOBS.ARREST_BASE = saveA; KNOBS.WRONGFUL_P = saveW;
    rounds++;
  }
  const j = F.events.justice;
  check("forced months convict, the wrong animal among them, and one lands in the centre", j.takenIn > taken0 && j.wrongful > wrongful0, `taken in ${taken0}→${j.takenIn} · cells ${j.cells} · sold ${j.sold} · wrongful ${wrongful0}→${j.wrongful} · rounds ${rounds}`);
  let heldBad = 0, heldN = 0, bedsOver = 0;
  const beds = new Map();
  for (const c of F.citizens) {
    if (!c.pen && (c.held || 0) > F.tick) { heldN++; if (c.job >= 0) heldBad++; if (c.heldAt >= 0) beds.set(c.heldAt, (beds.get(c.heldAt) || 0) + 1); }
  }
  for (const [i, n] of beds) if (F.civic[i] !== CIVIC.CENTRE || n > KNOBS.CENTRE_BEDS) bedsOver++;
  check("held citizens hold no job; beds point at a centre and never exceed it", heldN > 0 && heldBad === 0 && bedsOver === 0, `held ${heldN} · with a job ${heldBad} · bad beds ${bedsOver}`);
  check("the sold are gone (dangling-id law)", auditIds(F) === 0, `${auditIds(F)}`);

  // A POLICE STATION NOBODY CAN REACH INVESTIGATES NOTHING. `justice` sizes
  // the town's FORCE from `cen.policeStations`, and that counter is gated on
  // `served` - but the gate was pinned at the COUNTER and not at the reader,
  // so one line putting `policeStationsNoRoad` back into the force left the
  // suite green while a building at the edge of the map, employing nobody and
  // covering nothing, worked 34 cases. Three towns, identical but for where
  // the one station stands, and the arrests are the assertion.
  {
    const arrestsIn = (place) => {
      const U = load(save(F));
      const ux = (x, y) => y * U.w + x;
      // Raze the centre and the station the fixture already put down, so the
      // only civic in town is the one this run is about.
      for (let i = 0; i < U.w * U.h; i++) {
        if (U.civic[i] === CIVIC.POLICE) apply(U, { kind: "bulldoze", x0: i % U.w, y0: (i / U.w) | 0, x1: i % U.w, y1: (i / U.w) | 0, what: "civic" });
      }
      let where = -1;
      if (place === "served") {
        for (let i = 0; i < U.w * U.h && where < 0; i++) {
          const x = i % U.w;
          const y = (i / U.w) | 0;
          if (x < 4 || y < 4 || x > U.w - 6 || y > U.h - 6) continue;
          if (U.roadDist[i] > KNOBS.ROAD_REACH) continue;
          if (apply(U, { kind: "police", tx: x, ty: y }).ok) where = i;
        }
      } else if (place) {
        // STRANDED THE WAY A PLAYER STRANDS ONE. A station out of reach can no
        // longer be BUILT (the owner: a placeable building is a functional
        // building), so the only way to one is to build it on a road and then
        // take the road away - which is exactly how a town ends up with one.
        for (let i = 0; i < U.w * U.h && where < 0; i++) {
          const x = i % U.w;
          const y = (i / U.w) | 0;
          if (x < 6 || y < 6 || x > U.w - 8 || y > U.h - 8) continue;
          if (U.roadDist[i] <= KNOBS.ROAD_REACH) continue; // far from the town, so the stub serves nothing else
          const stub = [i - 1, i - 2];
          if (!apply(U, { kind: "road", tiles: stub }).ok) continue;
          if (apply(U, { kind: "police", tx: x, ty: y }).ok) where = i;
          apply(U, { kind: "bulldoze", x0: (i - 2) % U.w, y0: ((i - 2) / U.w) | 0, x1: (i - 1) % U.w, y1: ((i - 1) / U.w) | 0, what: "road" });
        }
      }
      const j0 = U.events.justice;
      const before = j0.takenIn + j0.cells + j0.sold;
      const kp = KNOBS.KILL_P;
      for (let k = 0; k < 24; k++) {
        KNOBS.KILL_P = 1 / Math.max(1e-9, killTotal(U));
        tick(U);
        KNOBS.KILL_P = kp;
      }
      const j1 = U.events.justice;
      return { where, served: where >= 0 ? served(U, where) : null, stations: U.last.census.policeStations, noRoad: U.last.census.policeStationsNoRoad, arrests: j1.takenIn + j1.cells + j1.sold - before, cold: j1.cold };
    };
    const noneAtAll = arrestsIn(null);
    const outOfReach = arrestsIn("far");
    const inReach = arrestsIn("served");
    check("a police station nobody can reach investigates nothing — a town with no station at all and a town with one at the edge of the map, employing nobody and covering nothing, work the same number of cases (none); put the same building where a road reaches it and the files start closing",
      noneAtAll.arrests === 0 && outOfReach.where >= 0 && outOfReach.served === false
        && outOfReach.stations === 0 && outOfReach.noRoad === 1 && outOfReach.arrests === 0
        && inReach.where >= 0 && inReach.served === true && inReach.stations === 1 && inReach.arrests > 0,
      `no station ${noneAtAll.arrests} arrests · out of reach ${outOfReach.arrests} (census ${outOfReach.stations} served, ${outOfReach.noRoad} not) · in reach ${inReach.arrests} (census ${inReach.stations})`);
  }

  // A CENTRE NOBODY CAN REACH TAKES NO PRISONERS. `justice.centreWithBed`
  // asks `served`, and nothing held it to that: a mutation sweep replaced
  // justice's `served` with `() => true` and 502 checks stayed green. Part M'
  // has a check that every sim module still IMPORTS `served` — which is a
  // spelling, and this is the behaviour. The sentence table's own else-branch
  // is the tell: with no reachable centre the animal goes to the CELLS, and
  // the ticker says "No centre in town".
  {
    const cx = ci % F.w;
    const cy = (ci / F.w) | 0;
    const forceRounds = (U, rounds) => {
      const kp = KNOBS.KILL_P;
      const ab = KNOBS.ARREST_BASE;
      const wp = KNOBS.WRONGFUL_P;
      for (let k = 0; k < rounds; k++) {
        KNOBS.KILL_P = 1 / Math.max(1e-9, killTotal(U));
        tick(U);
        KNOBS.KILL_P = kp;
        KNOBS.ARREST_BASE = 1;
        KNOBS.WRONGFUL_P = 1;
        tick(U);
        KNOBS.ARREST_BASE = ab;
        KNOBS.WRONGFUL_P = wp;
      }
    };
    // The same city, its one centre razed and a new one put where no road
    // comes within three; then the same centre with one road tile laid beside
    // it. Everything else about the two runs is identical.
    const stranded = (withRoad) => {
      const U = load(save(F));
      apply(U, { kind: "bulldoze", x0: cx, y0: cy, x1: cx, y1: cy, what: "civic" });
      let far = -1;
      for (let i = 0; i < U.w * U.h && far < 0; i++) {
        const x = i % U.w;
        const y = (i / U.w) | 0;
        if (x < 6 || y < 6 || x > U.w - 8 || y > U.h - 8) continue;
        if (U.roadDist[i] <= KNOBS.ROAD_REACH) continue;
        // A centre out of reach cannot be BUILT any more, so it is built on a
        // stub and stranded - which is the only way a town gets one, and is
        // what the check is about.
        if (!apply(U, { kind: "road", tiles: [i + 3, i + 4] }).ok) continue;
        if (apply(U, { kind: "centre", tx: x, ty: y }).ok) far = i;
        if (far >= 0 && !withRoad) apply(U, { kind: "bulldoze", x0: (i + 3) % U.w, y0: ((i + 3) / U.w) | 0, x1: (i + 4) % U.w, y1: ((i + 4) / U.w) | 0, what: "road" });
      }
      const before = { takenIn: U.events.justice.takenIn, cells: U.events.justice.cells };
      forceRounds(U, 6);
      const after = { takenIn: U.events.justice.takenIn, cells: U.events.justice.cells };
      const noCentre = U.events.log.filter((e) => e.id === "arrest" && /pacification centre with a free bed/.test(e.line)).length;
      return { far, servedNow: far >= 0 && served(U, far), takenIn: after.takenIn - before.takenIn, cells: after.cells - before.cells, noCentre, centres: U.civic.reduce((a, v) => a + (v === CIVIC.CENTRE ? 1 : 0), 0) };
    };
    const out = stranded(false);
    const inn = stranded(true);
    check("a pacification centre no road reaches takes nobody in — the convicted go to the cells and the ticker says there is no centre in town; lay two road tiles beside the same building and the same sentences land in it",
      out.far >= 0 && out.centres === 1 && !out.servedNow && out.takenIn === 0 && out.noCentre > 0
        && inn.far === out.far && inn.centres === 1 && inn.servedNow && inn.takenIn > 0,
      `out of reach: ${out.takenIn} taken in, ${out.cells} to the cells, ${out.noCentre} "no centre" lines · with a road: ${inn.takenIn} taken in, ${inn.cells} to the cells`);
  }
  // Reload with a held animal, continue 24 ticks (the centre releases fixed on the way): hash-equal.
  const G = load(save(F));
  // A FIXED animal is counted over the window, not at the end of it: the
  // released are old, and one that is fixed in month 3 and dies in month 20
  // leaves `pacified` standing and no flag to find. The snapshot passed on the
  // trajectory this fixture used to take and not on the one it takes now.
  let fixedSeen = 0;
  for (let t = 0; t < 24; t++) {
    tick(F);
    tick(G);
    const live = F.citizens.filter((c) => c.fixed).length;
    if (live > fixedSeen) fixedSeen = live;
  }
  check("save → load → 24 ticks with a held and a fixed animal hash-equals", stateHash(F) === stateHash(G), `${stateHash(F)} vs ${stateHash(G)}`);
  check("the centre fixes", fixedSeen > 0 && F.events.justice.pacified > 0, `fixed (most at once) ${fixedSeen} · pacified ${F.events.justice.pacified}`);
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
    if (t === 48) { apply(loaded, { kind: "zoo", tx: sx + 5, ty: sy + 1 }); apply(loaded, { kind: "police", tx: sx + 5, ty: sy - 2 }); apply(loaded, { kind: "centre", tx: sx - 3, ty: sy + 5 }); }
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

// ---- VICTIMS: a burglary has a victim, and the victim stays one (docs/PROPOSAL-CAMERAS.md §4f) ----
// Until this landed a burglary moved the treasury and named a thief; the
// animals whose door was forced were never told. Everything below is written
// so that deleting markBurgled, or narrowing it to the block, or reading the
// flag back off the life ring instead of saving it, turns one of these red.
{
  const { KIND, remember, lifeLines } = await import("../js/sim/life.js");
  const { ageYears } = await import("../js/sim/census.js");
  const adultsAt = (w, lot) => w.citizens.filter((c) => !c.dead && c.home === lot && ageYears(w, c) >= KNOBS.ADULT_AGE);

  // Force burglaries on a clone until one lands on an address with residents,
  // then read the law off that one. The loop is bounded and the rig asserts it
  // ARRIVED: without that, an empty candidate set would pass every line below.
  const B = load(A.saved);
  const saveP = KNOBS.BURGLARY_P;
  const saveMax = KNOBS.BURGLARY_MAX;
  let lot = -1, before = null, marked = null, tries = 0, withResidents = 0, burglaries = 0;
  KNOBS.BURGLARY_P = 1;
  KNOBS.BURGLARY_MAX = 1;
  while (tries++ < 24 && lot < 0) {
    const seen = new Set(B.events.files.map((f) => f));
    const was = new Set(B.citizens.filter((c) => c.burgled).map((c) => c.id));
    tick(B);
    const fresh = B.events.files.filter((f) => !seen.has(f) && f.cause === "burglary");
    if (!fresh.length) continue;
    burglaries++;
    const t = fresh[fresh.length - 1].tile;
    const res = adultsAt(B, t);
    if (!res.length) continue;
    withResidents++;
    // A hot lot can be picked twice; the second time its animals are already
    // marked and there is no fresh mark to read the law off. Keep looking.
    if (!res.some((c) => !was.has(c.id))) continue;
    lot = t;
    before = was;
    marked = B.citizens.filter((c) => c.burgled && !was.has(c.id));
  }
  KNOBS.BURGLARY_P = saveP;
  KNOBS.BURGLARY_MAX = saveMax;
  check("VICTIMS rig: forcing BURGLARY_P reaches an address with adult residents", lot >= 0 && burglaries > 0, `${burglaries} burglaries in ${tries} months, ${withResidents} with residents`);

  if (lot >= 0) {
    const want = adultsAt(B, lot).filter((c) => !before.has(c.id));
    const gotIds = new Set(marked.map((c) => c.id));
    const wantIds = new Set(want.map((c) => c.id));
    check("a burglary marks every adult living at the address", want.length > 0 && want.every((c) => gotIds.has(c.id)), `${want.length} at the address, ${marked.length} marked`);
    check("a burglary marks NOBODY who lives elsewhere", marked.every((c) => wantIds.has(c.id)), `${marked.filter((c) => !wantIds.has(c.id)).length} strays`);
    // Scope: the ADDRESS, not the block. If markBurgled ever widens to the
    // 3×3, this catches it — the burgled block reaches 44-53% of the town's
    // adults (measured, 4 seeds x 30y) against 5.3-6.5% for the lot.
    const W = B.w;
    const block = B.citizens.filter((c) => !c.dead && c.home >= 0 && c.home !== lot && Math.max(Math.abs((c.home % W) - (lot % W)), Math.abs(((c.home / W) | 0) - ((lot / W) | 0))) <= 1);
    check("the mark does not spread to the neighbours", block.every((c) => !gotIds.has(c.id)), `${block.filter((c) => gotIds.has(c.id)).length} of ${block.length} neighbours marked`);
    // Every line below reports rather than throws: a suite that crashes names
    // no invariant and runs none of the checks after it.
    const victim = marked[0] || null;
    check("the burglary produced at least one fresh victim to read", !!victim, `${marked.length} marked`);
    check("the victim carries a BURGLED life event naming the address", !!victim && (victim.life || []).some((e) => e[1] === KIND.BURGLED && e[2] === lot), victim ? "no BURGLED event" : "no victim");
    check("the BURGLED event has a sentence", !!victim && lifeLines(B, victim).some((l) => /^Burgled at /.test(l)), victim ? "no line" : "no victim");

    // THE POINT OF THE SAVED FLAG. remember() keeps the first two events and a
    // rolling last ten, so a burglary at thirty is evicted by an ordinary life.
    // Read the waiver off the life ring and the victim silently stops being
    // one; this is the check that says so.
    const V = load(save(B));
    const v = victim ? V.byId.get(victim.id) : null;
    check("the flag survives save and load", !!v && v.burgled === true, v ? `${v.burgled}` : "no victim");
    if (v) for (let i = 0; i < 14; i++) remember(V, v, KIND.RETIRED);
    check("the life ring evicts the BURGLED event", !!v && !(v.life || []).some((e) => e[1] === KIND.BURGLED), v ? "still in the ring" : "no victim");
    check("but the victim is still burgled", !!v && v.burgled === true, v ? "the flag went with the line" : "no victim");
  }

  // The optional-field shape: a town where nobody has been broken into hashes
  // and saves exactly as it did before victims existed (the `pen` precedent).
  const clean = load(A.saved);
  for (const c of clean.citizens) c.burgled = false;
  const plain = toPlain(clean);
  check("a never-burgled citizen carries no burgled key in the save", plain.citizens.every((c) => !("burgled" in c)), `${plain.citizens.filter((c) => "burgled" in c).length} carry it`);
  const one = clean.citizens.find((c) => !c.dead);
  const h0 = stateHash(clean);
  one.burgled = true;
  check("marking one citizen moves the hash", stateHash(clean) !== h0, "burgled is not in the canonical shape");
  one.burgled = false;
  check("and clearing it restores the hash exactly", stateHash(clean) === h0, "the shape is not reversible");
}

// Camera justice fixtures predate the Zoo prison. Supply real reachable
// campuses so these tests exercise evidence, rather than missing-bed refusal.
function cameraJusticeWorld(){
  const w=load(A.saved);w.cash=1000000;
  for(const kind of ['zoo','zoo','zoo','zoo','centre','centre','centre','centre']){
    let placed=false;
    for(let y=2;y<w.h-4&&!placed;y+=4)for(let x=2;x<w.w-4&&!placed;x+=4){
      let clear=true;for(let dy=0;dy<3;dy++)for(let dx=-1;dx<3;dx++){
        const i=(y+dy)*w.w+x+dx;if(w.terrain[i]===1||w.road[i]||w.rail[i]||w.zone[i]||w.tier[i]||w.civic[i]||w.wall[i])clear=false;
      }
      if(!clear)continue;
      apply(w,{kind:'road',tiles:[y*w.w+x-1]});placed=apply(w,{kind,tx:x,ty:y}).ok;
    }
    if(!placed)throw Error('Camera fixture could not place '+kind);
  }
  return w;
}
// ---- THE FILE STAYS OPEN: a wrongful arrest does not close the case (docs/PROPOSAL-CAMERAS.md §4d; BACKLOG:369-371) ----
// Until this landed, taking in the wrong animal SHUT the file, so no detective
// ever looked at that street again and exonerate() — which needs the real
// culprit arrested for the SAME file — could not fire. Measured on the rig in
// tools/camprobe.mjs, 4 seeds x 30y at four stations: exonerations 0.0 -> 1.3,
// wrongful arrests 1.0 -> 2.3 (an open file can catch a SECOND wrong animal),
// solved 54.6% -> 60.7%, and 1.0 file a run now goes cold with somebody
// already serving its sentence.
{
  const JU = await import("../js/sim/justice.js");
  const O = cameraJusticeWorld();
  const pool = O.citizens.filter((c) => !c.dead && c.home >= 0 && !c.fixed && (!c.held || c.held <= O.tick));
  check("THE FILE rig: two free animals to play the culprit and the wronged", pool.length >= 2, `${pool.length}`);
  if (pool.length >= 2) {
    const [culprit, wronged] = pool;
    const mk = (cause = "burglary") => JU.openFile(O, { tile: wronged.home, culpritId: culprit.id, cause });

    const fw = mk();
    JU.arrest(O, fw, wronged, true, []);
    check("a WRONGFUL arrest leaves the file open", fw.closed === false, "the wrong animal closed the case");

    const fr = mk();
    JU.arrest(O, fr, culprit, false, []);
    check("a RIGHT arrest closes the file", fr.closed === true, "the case stayed open");

    // The payoff the open file buys: the real culprit taken in for the same
    // file exonerates the animal serving for it. This is the line BACKLOG
    // asked for, and it was unreachable before.
    const ex0 = O.events.justice.exonerated;
    const fx = mk();
    JU.arrest(O, fx, wronged, true, []);
    const wrongedArrest = O.events.arrests[O.events.arrests.length - 1];
    JU.arrest(O, fx, culprit, false, []);
    check("arresting the real culprit for an open file exonerates the animal serving for it", O.events.justice.exonerated > ex0, `${ex0} -> ${O.events.justice.exonerated}`);
    check("and the arrest record is marked put right", wrongedArrest.exonerated === true, "the record still reads unexonerated");

    // A file CAN still go cold with somebody serving, and when it does the
    // line has to say so: "closed without an arrest" was true only while a
    // wrongful arrest closed the case.
    const P = cameraJusticeWorld();
    const pc = P.citizens.filter((c) => !c.dead && c.home >= 0 && !c.fixed && (!c.held || c.held <= P.tick));
    if (pc.length >= 2) {
      for (const cause of ["burglary", "killing"]) {
        const fc = JU.openFile(P, { tile: pc[1].home, culpritId: pc[0].id, cause });
        JU.arrest(P, fc, pc[1], true, []);
        const serving = P.events.arrests[P.events.arrests.length - 1].name;
        fc.opened = P.tick - KNOBS.CASE_MONTHS; // age it past the investigation, not past FILE_MONTHS
        const said = [];
        JU.filesTick(P, census(P), said);
        const cold = said.find((l) => new RegExp(`file on the ${cause}`).test(l));
        check(`a ${cause} file going cold with somebody serving says so`, !!cold && /was wrongly convicted/.test(cold), cold || "no cold line");
        check(`and it names the animal serving for the ${cause}`, !!cold && cold.includes(serving), cold || "no cold line");
        check(`and the ${cause} line does not also claim nobody was arrested`, !!cold && !/closed without an arrest/.test(cold), cold || "no cold line");
      }
      // The other half of the same law: with NO wrongful arrest standing, the
      // old line is still the one that prints. A DIFFERENT culprit and scene,
      // because standingWrongful matches on culprit + scene + cause and the
      // two files above have already put a wrongful arrest on record for
      // pc[0] — and pc[1] no longer has a home to name, the arrest took it.
      const quietCulprit = P.citizens.find((c) => !c.dead && c.home >= 0 && c.id !== pc[0].id && c.id !== pc[1].id);
      check("THE FILE rig: a third animal with a home for the quiet case", !!quietCulprit, "none free");
      const fq = JU.openFile(P, { tile: quietCulprit ? quietCulprit.home : 0, culpritId: quietCulprit ? quietCulprit.id : pc[0].id, cause: "killing" });
      fq.opened = P.tick - KNOBS.CASE_MONTHS;
      const quiet = [];
      JU.filesTick(P, census(P), quiet);
      const q = quiet.find((l) => /^COLD/.test(l));
      check("a killing that nobody was arrested for still closes without an arrest", !!q && /closed without an arrest/.test(q) && !/was wrongly convicted/.test(q), q || "no COLD line");
    }
  }
  // Trespass always passes wrongful = false, so the minor path is untouched:
  // its file closes on the spot as it always did.
  const T = cameraJusticeWorld();
  const tc = T.citizens.find((c) => !c.dead && c.home >= 0);
  if (tc) {
    const ft = JU.openFile(T, { tile: tc.home, culpritId: tc.id, cause: "trespass", crime: KNOBS.TRESPASS_CRIME, radius: 1 });
    JU.arrest(T, ft, tc, false, [], { minor: true });
    check("a trespass file still closes on the spot", ft.closed === true, "the minor path changed");
  }
}

// ---- CAMERAS: the array, the op, the sight-line, the bill (docs/PROPOSAL-CAMERAS.md §4a-4b, §7) ----
// The camera EXISTS in this section and does nothing to crime, mood or the
// capacity law — that is commits 4 and 5. What is asserted here is that it
// goes only where a camera can stand, comes off before the road under it,
// paints the street it watches, and costs what it says.
{
  const { computeCamCover } = await import("../js/sim/fields.js");
  const { yearlyFigures } = await import("../js/sim/budget.js");
  const { TOOLS, TOOL_BY_ID, PLACE_TOOLS } = await import("../js/tools.js");
  const { TERRAIN: TERR } = await import("../js/sim/world.js");

  const town = () => {
    const w = createWorld({ seed: "7" });
    w.cash = 200000;
    const sx = w.start.tx, sy = w.start.ty;
    const line = [];
    for (let x = sx - 5; x <= sx + 5; x++) line.push(x + sy * w.w);
    apply(w, { kind: "road", tiles: line });
    return { w, sx, sy, at: sx + sy * w.w };
  };

  // ---- placement -----------------------------------------------------------
  {
    const { w, sx, sy, at } = town();
    const cash0 = w.cash;
    const r = apply(w, { kind: "camera", tiles: [at] });
    check("a camera goes up on a street", r.ok === true && w.cam[at] === 1, JSON.stringify(r));
    check("and costs COST.camera", cash0 - w.cash === KNOBS.COST.camera, `${cash0 - w.cash} vs ${KNOBS.COST.camera}`);
    check("a camera does not replace the road it stands on", w.road[at] === ROAD.ROAD, `${w.road[at]}`);
    const again = apply(w, { kind: "camera", tiles: [at] });
    check("a second camera on the same tile is refused, not charged twice", again.ok === false && w.cam[at] === 1, JSON.stringify(again));

    // Every refusal, each on a tile that is genuinely that thing. The bare
    // tile is SEARCHED for rather than guessed: the first draft used (sx, sy-3)
    // and that is part of the starting road, so the refusal check was passing
    // a road tile to an op that accepts road tiles.
    let grass = -1;
    for (let i = 0; i < w.w * w.h && grass < 0; i++) if (w.road[i] === ROAD.NONE && w.terrain[i] !== TERR.WATER && !w.wall[i]) grass = i;
    check("CAMERA rig: the refusal tile really is bare ground", grass >= 0 && w.road[grass] === ROAD.NONE && !w.cam[grass], `${grass} road ${grass >= 0 ? w.road[grass] : "-"}`);
    const off = apply(w, { kind: "camera", tiles: [grass] });
    check("a camera is refused off the road, with a sentence", off.ok === false && /street/.test(off.reason || ""), JSON.stringify(off));
    check("and nothing was placed", w.cam[grass] === 0, "a camera stands on grass");

    // A drag that crosses road AND field must go through at the road tiles and
    // stay silent — the rule every other drag op follows.
    const mixed = [sx + 1 + sy * w.w, grass];
    const m = apply(w, { kind: "camera", tiles: mixed });
    check("a drag that crosses a street and a field takes the street and says nothing", m.ok === true && !m.reason && w.cam[mixed[0]] === 1 && w.cam[mixed[1]] === 0, JSON.stringify(m));

    // A tunnel: a camera under a wall would see the wall.
    const tun = sx + 2 + sy * w.w;
    apply(w, { kind: "wall", tiles: [tun] });
    check("CAMERA rig: the tunnel tile really is a road under a wall", w.road[tun] !== ROAD.NONE && w.wall[tun] === 1, `road ${w.road[tun]} wall ${w.wall[tun]}`);
    check("a camera is refused on a tunnel", apply(w, { kind: "camera", tiles: [tun] }).ok === false && w.cam[tun] === 0, "a camera stands in a tunnel");
  }

  // ---- the bulldozer, and the invariant it protects -------------------------
  {
    const { w, at } = town();
    apply(w, { kind: "camera", tiles: [at] });
    const plan = costOfOp(w, { kind: "bulldoze", x0: at % w.w, y0: (at / w.w) | 0, x1: at % w.w, y1: (at / w.w) | 0 });
    check("the bulldozer takes the camera before the road under it", plan.tiles.length === 1 && plan.tiles[0].what === "camera", JSON.stringify(plan.tiles));
    apply(w, { kind: "bulldoze", x0: at % w.w, y0: (at / w.w) | 0, x1: at % w.w, y1: (at / w.w) | 0 });
    check("one press takes the camera and leaves the road", w.cam[at] === 0 && w.road[at] === ROAD.ROAD, `cam ${w.cam[at]} road ${w.road[at]}`);
  }
  {
    // The reviewer's scenario in the proposal: sweep the bulldozer down a
    // camera'd avenue twice and the cameras must not be left hanging over
    // bare grass. Two presses, because the camera is a layer above the road.
    const { w, sx, sy } = town();
    const line = [];
    for (let x = sx - 5; x <= sx + 5; x++) line.push(x + sy * w.w);
    apply(w, { kind: "camera", tiles: line });
    const rect = { x0: sx - 5, y0: sy, x1: sx + 5, y1: sy };
    apply(w, { kind: "bulldoze", ...rect });
    apply(w, { kind: "bulldoze", ...rect });
    let hanging = 0;
    for (const i of line) if (w.cam[i] && w.road[i] === ROAD.NONE) hanging++;
    check("no camera is left hanging over bare grass", hanging === 0, `${hanging} of ${line.length}`);
  }

  // ---- undo ----------------------------------------------------------------
  {
    const { w, at } = town();
    const cash0 = w.cash;
    apply(w, { kind: "camera", tiles: [at] });
    const u = undo(w);
    check("undo takes the camera down", u.ok === true && w.cam[at] === 0, JSON.stringify(u));
    check("and refunds the cash", w.cash === cash0, `${w.cash} vs ${cash0}`);
    check("and the cover goes with it", w.camCov[at] === 0, `${w.camCov[at]}`);
  }

  // ---- the sight-line ------------------------------------------------------
  {
    const { w, sx, sy, at } = town();
    apply(w, { kind: "camera", tiles: [at] });
    const painted = () => { let k = 0; for (let i = 0; i < w.w * w.h; i++) if (w.camCov[i]) k++; return k; };
    // THE BUG THIS CATCHES: the walk keeps a visited set that outlives the
    // call. Stamped with anything that repeats — the source tile, say — the
    // first pass marks the neighbours and every later pass refuses to expand,
    // so the field is right once and is one tile's halo for ever after.
    const runs = [painted()];
    for (let k = 0; k < 3; k++) { computeCamCover(w); runs.push(painted()); }
    check("the camera field is IDEMPOTENT — recomputing it does not shrink it", runs.every((v) => v === runs[0]) && runs[0] > 0, runs.join(" → "));

    check("a camera paints its own tile at full effect", w.camCov[at] === KNOBS.CAM_EFFECT, `${w.camCov[at]}`);
    // The walk runs along the STREET, so a tile CAM_REACH road-steps away is
    // covered and one further along is not — that is what makes it a
    // sight-line rather than a circle.
    const far = sx + KNOBS.CAM_REACH + KNOBS.ROAD_REACH + sy * w.w;
    const beyond = sx + KNOBS.CAM_REACH + KNOBS.ROAD_REACH + 1 + sy * w.w;
    check("the sight-line reaches CAM_REACH road-steps plus the frontages that street serves", w.camCov[far] > 0, `${w.camCov[far]} at +${KNOBS.CAM_REACH + KNOBS.ROAD_REACH}`);
    check("and stops there", w.camCov[beyond] === 0, `${w.camCov[beyond]} at +${KNOBS.CAM_REACH + KNOBS.ROAD_REACH + 1}`);
    // Graded: full within CAM_NEAR road-steps, half beyond.
    const seenEff = new Set();
    for (let i = 0; i < w.w * w.h; i++) if (w.camCov[i]) seenEff.add(w.camCov[i]);
    check("the field is graded, not flat", seenEff.has(KNOBS.CAM_EFFECT) && seenEff.has(KNOBS.CAM_EFFECT / 2), [...seenEff].join(","));
  }
  {
    // A wall across the street breaks the sight-line. The one piece of
    // counterplay the network has, and it costs §8.
    const { w, sx, sy, at } = town();
    apply(w, { kind: "camera", tiles: [at] });
    const far = sx + KNOBS.CAM_REACH + KNOBS.ROAD_REACH + sy * w.w;
    const before = w.camCov[far];
    apply(w, { kind: "wall", tiles: [sx + 1 + sy * w.w] });
    computeCamCover(w);
    check("CAMERA rig: the wall really went up across the street", w.wall[sx + 1 + sy * w.w] === 1, "no wall");
    check("a wall across the street breaks the sight-line", before > 0 && w.camCov[far] === 0, `${before} → ${w.camCov[far]}`);
  }

  // ---- storage: saved, hashed, and elided while the town has none ----------
  {
    const { w, at } = town();
    const clean = stateHash(w);
    const plainNone = toPlain(w);
    check("cam is saved", Array.isArray(plainNone.cam) && plainNone.cam.length === w.w * w.h, `${plainNone.cam && plainNone.cam.length}`);
    apply(w, { kind: "camera", tiles: [at] });
    check("placing a camera moves the hash", stateHash(w) !== clean, "cam is not in the canonical shape");
    const back = load(save(w));
    check("and it survives save and load", back.cam[at] === 1 && stateHash(back) === stateHash(w), `${back.cam[at]}`);
    check("camCov is DERIVED — never saved", !("camCov" in toPlain(w)), "camCov is in the save");
    // The elision: an all-zero cam array is dropped from the hashed shape, so
    // a town that never buys a camera keeps the identity it had before the
    // network existed. Reversibility is the observable half of that.
    // Written straight into the array, not through the op: the op also spends
    // §100 and cash is hashed, so an op-based test would be measuring the
    // treasury and calling it the elision.
    const E = load(save(town().w));
    const eClean = stateHash(E);
    E.cam[at] = 1;
    check("the elision is not a blanket — a camera in the array moves the hash", stateHash(E) !== eClean, "cam is elided even when set");
    E.cam[at] = 0;
    check("and an all-zero cam array hashes exactly as it did before the network existed", stateHash(E) === eClean, "the all-zero elision is not reversible");
    // The reload rebuilds the field rather than carrying it: a loaded city
    // opens paused, and the card and the overlay read it before the first tick.
    computeFields(back);
    check("a reloaded city rebuilds the same cover", back.camCov[at] === w.camCov[at], `${back.camCov[at]} vs ${w.camCov[at]}`);
  }

  // ---- the bill ------------------------------------------------------------
  {
    const { w, sx, sy } = town();
    const before = yearlyFigures(w).upkeepYr;
    apply(w, { kind: "camera", tiles: [sx + sy * w.w] });
    const one = yearlyFigures(w);
    check("one camera adds the whole network fee", one.upkeepYr - before === KNOBS.UPKEEP_CAM_NET, `${one.upkeepYr - before} vs ${KNOBS.UPKEEP_CAM_NET}`);
    check("and the figures carry the count", one.cams === 1, `${one.cams}`);
    const rest = [];
    for (let x = sx - 5; x <= sx + 5; x++) if (x !== sx) rest.push(x + sy * w.w);
    apply(w, { kind: "camera", tiles: rest });
    const many = yearlyFigures(w);
    check("THE FEE IS FLAT: eleven cameras cost the same a year as one", many.upkeepYr === one.upkeepYr && many.cams === rest.length + 1, `${many.cams} cameras, §${many.upkeepYr} vs §${one.upkeepYr}`);
    check("the network fee is not charged when there is no camera", before === yearlyFigures(load(save(town().w))).upkeepYr, "a camera-free town pays the fee");
  }

  // ---- the tool ------------------------------------------------------------
  {
    const tool = TOOL_BY_ID.camera;
    check("the camera is a tool on key E", !!tool && tool.key === "E" && tool.op.kind === "camera", JSON.stringify(tool && { key: tool.key, kind: tool.op.kind }));
    // NOT in PLACE_TOOLS: that is the click set, and the camera is a drag.
    check("and it is a drag, not a click", !PLACE_TOOLS.includes("camera"), "camera is in PLACE_TOOLS");
    // PLACE_TOOLS was doing two jobs: "this is a click tool" and "this tool
    // has a ghost". The camera is the only tool that is a DRAG and still wants
    // one, so the lists part company — and a flat drag still gets neither.
    const { GHOST_TOOLS } = await import("../js/tools.js");
    check("but it still shows a ghost under the cursor", GHOST_TOOLS.includes("camera"), "camera has no ghost");
    check("every click tool keeps its ghost", PLACE_TOOLS.every((t) => GHOST_TOOLS.includes(t)), PLACE_TOOLS.filter((t) => !GHOST_TOOLS.includes(t)).join(", "));
    check("and the flat drags still have none", !GHOST_TOOLS.includes("road") && !GHOST_TOOLS.includes("wall") && !GHOST_TOOLS.includes("rail"), GHOST_TOOLS.join(", "));
    check("every tool id is still unique", new Set(TOOLS.map((t) => t.id)).size === TOOLS.length, `${TOOLS.length}`);
  }

  // ---- the overlay is registered in BOTH places main.js needs --------------
  {
    const mainSrc = readFileSync(path.join(ROOT, "js", "main.js"), "utf8");
    check("the watch overlay is in the cycle", /const OVERLAYS = \[[^\]]*"watch"/.test(mainSrc), "not in OVERLAYS");
    check("and in cycleOverlay's flash-label map, which is a SECOND edit", /watch:\s*"Overlay: camera cover/.test(mainSrc), "no flash label");
    const renderSrc = readFileSync(path.join(ROOT, "js", "render.js"), "utf8");
    check("and drawOverlay knows the mode", /mode === "watch"/.test(renderSrc), "drawOverlay has no watch branch");
  }
}

// ---- CLEARANCE: the camera solves, and never deters (docs/PROPOSAL-CAMERAS.md §4c-4d) ----
// Measured on tools/camprobe.mjs, 4 seeds x 30y at ONE station. Solved% by
// camera count: 0 → 20.5, 1 → 34.2, 2 → 41.5, 4 → 49.2, 8 → 67.3, 10 → 85.3,
// 20 → 90.4, 40 → 90.5. Mean crime over the same sweep: 39.34, —, —, —, —,
// 39.36, 39.88, 39.23. The town clears four times as many files and its crime
// number does not move; that is the whole design and these checks pin it.
{
  const JU = await import("../js/sim/justice.js");
  const { TICKER_FLASH } = await import("../js/sim/events.js");
  const fieldsSrc = readFileSync(path.join(ROOT, "js", "sim", "fields.js"), "utf8");

  // THE ANTI-CLAIM, enforced on the source. A camera term anywhere in the
  // crime field or in land value would make cameras DETER, which is the one
  // thing the design forbids. The old grep guard allow-listed fields.js
  // wholesale — and computeCrime and computeLandValue both live in it.
  const bodyOf = (name) => {
    const from = fieldsSrc.indexOf(`export function ${name}(`);
    if (from < 0) return null;
    let depth = 0;
    for (let i = fieldsSrc.indexOf("{", from); i < fieldsSrc.length; i++) {
      if (fieldsSrc[i] === "{") depth++;
      else if (fieldsSrc[i] === "}" && --depth === 0) return fieldsSrc.slice(from, i + 1);
    }
    return null;
  };
  for (const fn of ["computeCrime", "computeLandValue", "computeDread"]) {
    const body = bodyOf(fn);
    check(`CLEARANCE rig: ${fn} was found in fields.js to read`, !!body && body.length > 200, `${body && body.length}`);
    check(`${fn} has no camera term — a camera SOLVES and never deters`, !!body && !/\bcam\b|camCov|CAM_/.test(body), (body || "").split("\n").filter((l) => /cam/i.test(l)).join(" / ") || "not found");
  }
  const justiceSrc = readFileSync(path.join(ROOT, "js", "sim", "justice.js"), "utf8");
  check("the camera reaches the sim through exactly one arrest term", (justiceSrc.match(/KNOBS\.CAM_ARREST/g) || []).length === 1, `${(justiceSrc.match(/KNOBS\.CAM_ARREST/g) || []).length} uses`);
  check("and one wrongful term", (justiceSrc.match(/KNOBS\.CAM_WRONGFUL/g) || []).length === 1, `${(justiceSrc.match(/KNOBS\.CAM_WRONGFUL/g) || []).length} uses`);

  // ---- what the term is worth, run through the real filesTick -------------
  // Not a re-derivation of the formula: 120 real files in one world, half at
  // covered scenes and half dark, rolled by the shipped code.
  const trial = (cover, stations) => {
    const W = cameraJusticeWorld();
    const pool = W.citizens.filter((c) => !c.dead && c.home >= 0 && !c.fixed && (!c.held || c.held <= W.tick));
    const lots = [];
    for (let i = 0; i < W.w * W.h && lots.length < 60; i++) if (W.tier[i] > 0 && !W.rubble[i]) lots.push(i);
    const files = [];
    for (let k = 0; k < Math.min(60, pool.length, lots.length); k++) {
      const f = JU.openFile(W, { tile: lots[k], culpritId: pool[k].id, cause: "burglary" });
      f.opened = W.tick - 1; // past the opening month, so filesTick rolls it
      files.push(f);
      W.camCov[lots[k]] = cover;
      W.policeCov[lots[k]] = 0;
    }
    const cen = census(W);
    cen.policeStations = stations;
    JU.filesTick(W, cen, []);
    return { n: files.length, closed: files.filter((f) => f.closed).length, arrests: W.events.arrests.length };
  };
  const dark = trial(0, 1);
  const lit = trial(KNOBS.CAM_EFFECT, 1);
  check("CLEARANCE rig: the same number of real files at built lots in both arms", dark.n === lit.n && dark.n >= 30, `${dark.n} vs ${lit.n}`);
  check("a covered scene clears far more often than a dark one", lit.closed > dark.closed * 3 && dark.closed >= 0, `dark ${dark.closed}/${dark.n} · covered ${lit.closed}/${lit.n}`);

  // THE GATE THE OWNER ASKED FOR: no station, no roll, however much of the
  // town is watched. A network without a police force does exactly nothing.
  const unpoliced = trial(KNOBS.CAM_EFFECT, 0);
  check("with NO police station a blanket of cameras solves nothing at all", unpoliced.closed === 0 && unpoliced.arrests === 0, `${unpoliced.closed} closed, ${unpoliced.arrests} arrests`);

  // ---- the wrongful term ---------------------------------------------------
  {
    // The same single draw, at a higher threshold: WRONGFUL_P 0.05 alone
    // against 0.05 + CAM_WRONGFUL 0.10 at full cover. Read off the shipped
    // path rather than recomputed, by forcing every arrest and counting.
    // ROUNDS, because one month of one town is forty draws and the term moves
    // the threshold by ten points: forty draws cannot tell 5% from 15% (the
    // first draft measured 3 against 3 and would have called that a pass).
    // Ten rounds is ~400 arrests, where the two arms cannot overlap by luck.
    const ROUNDS = 10;
    const run = (cover) => {
      const W = cameraJusticeWorld();
      const lots = [];
      for (let i = 0; i < W.w * W.h && lots.length < 60; i++) if (W.tier[i] > 0 && !W.rubble[i]) lots.push(i);
      const saveBase = KNOBS.ARREST_BASE;
      const saveHeld = KNOBS.HOLD_MONTHS;
      KNOBS.ARREST_BASE = 1; // every file is worked, so the only thing varying is the wrongful roll
      let arrests = 0;
      for (let round = 0; round < ROUNDS; round++) {
        // Fresh culprits each round: an animal taken last round is in custody
        // and adultsWithin skips it, so reusing the pool would thin the arms
        // unevenly.
        const pool = W.citizens.filter((c) => !c.dead && c.home >= 0 && !c.fixed && (!c.held || c.held <= W.tick));
        for (let k = 0; k < Math.min(lots.length, pool.length); k++) {
          const f = JU.openFile(W, { tile: lots[k], culpritId: pool[k].id, cause: "burglary" });
          f.opened = W.tick - 1;
          W.camCov[lots[k]] = cover;
        }
        const cen = census(W);
        cen.policeStations = 1;
        const before = W.events.arrests.length;
        JU.filesTick(W, cen, []);
        arrests += W.events.arrests.length - before;
        W.tick++;
      }
      KNOBS.ARREST_BASE = saveBase;
      KNOBS.HOLD_MONTHS = saveHeld;
      return { wrongful: W.events.justice.wrongful, arrests };
    };
    const plain = run(0);
    const watched = run(KNOBS.CAM_EFFECT);
    check("CLEARANCE rig: both wrongful arms made enough arrests to tell 5% from 15%", plain.arrests >= 150 && watched.arrests >= 150, `dark ${plain.arrests} · watched ${watched.arrests}`);
    check("a camera-carried arrest names the wrong animal more often", watched.wrongful > plain.wrongful * 1.5, `${plain.wrongful}/${plain.arrests} dark · ${watched.wrongful}/${watched.arrests} watched`);
  }

  // ---- the line ------------------------------------------------------------
  {
    const W = cameraJusticeWorld();
    const pool = W.citizens.filter((c) => !c.dead && c.home >= 0 && !c.fixed && (!c.held || c.held <= W.tick));
    let lot = -1;
    for (let i = 0; i < W.w * W.h && lot < 0; i++) if (W.tier[i] > 0 && !W.rubble[i]) lot = i;
    let road = -1;
    for (let i = 0; i < W.w * W.h && road < 0; i++) if (W.road[i] === ROAD.ROAD && !W.rail[i] && !W.wall[i]) road = i;
    W.cash = 100000;
    apply(W, { kind: "camera", tiles: [road] });
    const f = JU.openFile(W, { tile: lot, culpritId: pool[0].id, cause: "burglary" });
    f.opened = W.tick - 3;
    W.camCov[lot] = KNOBS.CAM_EFFECT;
    const saveBase = KNOBS.ARREST_BASE;
    KNOBS.ARREST_BASE = 1;
    const said = [];
    const cen = census(W);
    cen.policeStations = 1;
    JU.filesTick(W, cen, said);
    KNOBS.ARREST_BASE = saveBase;
    const id = said.find((l) => /^IDENTIFIED/.test(l));
    check("a camera-carried arrest prints IDENTIFIED", !!id, said.join(" | ").slice(0, 160) || "nothing said");
    check("and it names the camera's own tile", !!id && new RegExp(`the camera at \\(${road % W.w},${(road / W.w) | 0}\\)`).test(id), id || "no line");
    check("and says how long the file had been open, never that it is closed", !!id && /3 months after it happened\.$/.test(id), id || "no line");
    check("IDENTIFIED flashes over the map", TICKER_FLASH.test(id || ""), id || "no line");
    // A DARK scene must print nothing: the line is the camera's, not the arrest's.
    const D = cameraJusticeWorld();
    const dpool = D.citizens.filter((c) => !c.dead && c.home >= 0 && !c.fixed && (!c.held || c.held <= D.tick));
    const df = JU.openFile(D, { tile: lot, culpritId: dpool[0].id, cause: "burglary" });
    df.opened = D.tick - 3;
    KNOBS.ARREST_BASE = 1;
    const quiet = [];
    const dcen = census(D);
    dcen.policeStations = 1;
    JU.filesTick(D, dcen, quiet);
    KNOBS.ARREST_BASE = saveBase;
    check("an arrest with no camera on it prints no IDENTIFIED", !quiet.some((l) => /^IDENTIFIED/.test(l)) && quiet.length > 0, quiet.join(" | ").slice(0, 160) || "nothing said at all");
  }
}

// ---- WATCHED: the brake, the mood, the waiver (docs/PROPOSAL-CAMERAS.md §4e) ----
// The brake is ONE TERM IN THE CAPACITY LAW and it is the only one. Two earlier
// drafts put it in mood, in the home score and in a rehome, and all three
// measured as no-ops under a blanket — mood has no sim consumer while V_R > 0,
// bestHome is a pure argmax so a uniform penalty cancels, and a rehome wanting
// somewhere less watched finds nowhere when everywhere is watched. A global
// nuisance needs an ABSOLUTE brake.
//
// A/B'd on tools/camprobe.mjs (4 seeds x 30y, one station, --cap 0 against 400):
//   10 cameras  pop 1204 → 1053 · R valve 0.30 → 0.24 · 93.4% of homes watched
//   40 cameras  pop 1325 → 1047 · R valve 0.28 → 0.18 · 98.7% watched
{
  const { capacityLaw } = await import("../js/sim/demand.js");
  const { moodTerms } = await import("../js/sim/citizens.js");

  // ---- the brake is absolute -----------------------------------------------
  {
    const W = load(A.saved);
    const base = census(W);
    const cap0 = capacityLaw(W, { ...base, watchedShare: 0 });
    const capHalf = capacityLaw(W, { ...base, watchedShare: 0.5 });
    const capAll = capacityLaw(W, { ...base, watchedShare: 1 });
    check("CAM_CAP takes capacity off in proportion to the watched share", cap0 > capHalf && capHalf > capAll, `${cap0.toFixed(0)} / ${capHalf.toFixed(0)} / ${capAll.toFixed(0)}`);
    // ABSOLUTE, not comparative: the whole point. A fully watched town loses
    // CAM_CAP scaled by the same H gain every other term gets.
    const want = KNOBS.CAM_CAP * (1 + KNOBS.CAP_H_GAIN * base.H);
    check("a fully watched town loses exactly CAM_CAP of capacity", Math.abs((cap0 - capAll) - want) < 1e-6, `${(cap0 - capAll).toFixed(3)} vs ${want.toFixed(3)}`);
    check("CAM_CAP sits between a park and a zoo, so the loss is legible against them", KNOBS.CAP_PARK < KNOBS.CAM_CAP && KNOBS.CAM_CAP < KNOBS.CAP_LARGE_PARK, `${KNOBS.CAP_PARK} < ${KNOBS.CAM_CAP} < ${KNOBS.CAP_LARGE_PARK}`);
    // With the knob at 0 the law is exactly what it was before the network.
    const saved = KNOBS.CAM_CAP;
    KNOBS.CAM_CAP = 0;
    check("at CAM_CAP 0 the capacity law is the one that shipped before cameras", capacityLaw(W, { ...base, watchedShare: 1 }) === cap0, "the brake leaks when switched off");
    KNOBS.CAM_CAP = saved;
  }

  // ---- what the share counts -----------------------------------------------
  {
    // OCCUPIED HOMES, not tiles: a camera pointed at a field costs nothing.
    const W = load(A.saved);
    const before = census(W).watchedShare;
    check("an unwatched town has a watched share of zero", before === 0, `${before}`);
    let empties = 0;
    for (let i = 0; i < W.w * W.h; i++) if (!W.occupants[i]) { W.camCov[i] = KNOBS.CAM_EFFECT; empties++; }
    check("WATCHED rig: there are empty tiles to watch", empties > 100, `${empties}`);
    check("watching every EMPTY tile in the town costs nothing", census(W).watchedShare === 0, `${census(W).watchedShare}`);
    let homes = 0;
    for (let i = 0; i < W.w * W.h; i++) if (W.occupants[i]) { W.camCov[i] = KNOBS.CAM_EFFECT; homes++; }
    check("WATCHED rig: there are occupied homes to watch", homes >= 10, `${homes}`);
    check("watching every home makes the share one", Math.abs(census(W).watchedShare - 1) < 1e-9, `${census(W).watchedShare}`);
    // Half cover still counts — CAM_EFFECT/2 is the threshold, so a street's
    // far frontages are watched too.
    for (let i = 0; i < W.w * W.h; i++) if (W.occupants[i]) W.camCov[i] = KNOBS.CAM_EFFECT / 2;
    check("half cover is still watched", Math.abs(census(W).watchedShare - 1) < 1e-9, `${census(W).watchedShare}`);
    for (let i = 0; i < W.w * W.h; i++) if (W.occupants[i]) W.camCov[i] = KNOBS.CAM_EFFECT / 2 - 1;
    check("and a hair under it is not", census(W).watchedShare === 0, `${census(W).watchedShare}`);
  }

  // ---- the mood term and the owner's waiver --------------------------------
  {
    const W = load(A.saved);
    const c = W.citizens.find((x) => !x.dead && x.home >= 0 && !x.burgled);
    check("WATCHED rig: an un-burgled animal with a home", !!c, "none found");
    if (c) {
      const termOf = (w, cit) => (moodTerms(w, cit).find((t) => t.code === "WATCHED") || { value: 0 }).value;
      check("an unwatched street costs no mood", termOf(W, c) === 0, `${termOf(W, c)}`);
      W.camCov[c.home] = KNOBS.CAM_EFFECT;
      const full = termOf(W, c);
      check("a watched street costs CAM_MOOD", Math.abs(full + KNOBS.CAM_MOOD) < 1e-9, `${full}`);
      W.camCov[c.home] = KNOBS.CAM_EFFECT / 2;
      check("and half cover costs half of it", Math.abs(termOf(W, c) + KNOBS.CAM_MOOD / 2) < 1e-9, `${termOf(W, c)}`);
      // THE OWNER'S RULING: "folks who have been robbed before do not feel
      // that negative feeling."
      W.camCov[c.home] = KNOBS.CAM_EFFECT;
      c.burgled = true;
      check("an animal whose own door has been forced does not mind the camera", termOf(W, c) === 0, `${termOf(W, c)}`);
      c.burgled = false;
      check("and its unburgled neighbours still do", termOf(W, c) !== 0, `${termOf(W, c)}`);
    }
  }

  // ---- the animal can SAY it -----------------------------------------------
  {
    // Without a needs code the mood term is invisible to the player and might
    // as well not exist. needTruthResults proves WATCHED WINS on a watched
    // street; this checks the remedy names the thing to bulldoze.
    const { ACT, line } = await import("../js/sim/voice.js");
    check("WATCHED has a remedy a player can act on", typeof ACT.WATCHED === "string" && /camera/.test(ACT.WATCHED), ACT.WATCHED);
    const said = line(null, { id: 1, species: "tortoise" }, { code: "WATCHED" });
    check("and a voice line, inside the 30-character rule", typeof said === "string" && said.length > 0 && said.length <= 30, `${said} (${said && said.length})`);
  }
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
  const { admits, DIET_OF, SPECIES } = await import("../js/sim/species.js");
  const { commutePath, roadPath, exposure } = await import("../js/sim/fields.js");
  const bits = USE_OPTIONS.map((o) => o.bit);
  const powers = bits.every((bit) => bit > 0 && (bit & (bit - 1)) === 0);
  const exactRoster = USE_SPECIES.join(",") === SPECIES.map((s) => s.id).join(",");
  check("use: the old 1/2 save values remain predator/prey and all fourteen roster species have one unique stable bit in the 16-bit mask",
    USE.PRED === 1 && USE.PREY === 2 && bits.length === 16 && new Set(bits).size === 16
      && powers && Math.max(...bits) === 32768 && USE_MASK === 65535 && exactRoster
      && createWorld({ seed: "use-word", w: 4, h: 4 }).use instanceof Uint16Array,
    `${bits.join(",")} · ${USE_SPECIES.join(",")}`);
  let admissionMatrix = true;
  for (const s of SPECIES) {
    admissionMatrix &&= SPECIES.every((other) => admits(USE_BIT_OF[s.id], other.id) === (other.id === s.id));
    admissionMatrix &&= admits(USE.PRED, s.id) === (DIET_OF[s.id] === "carn");
    admissionMatrix &&= admits(USE.PREY, s.id) === (DIET_OF[s.id] !== "carn");
  }
  const unionMask = USE.PRED | USE.BEAR | USE.RACCOON;
  const unionOpen = SPECIES.filter((s) => admits(unionMask, s.id)).map((s) => s.id);
  check("use: every species-only bit admits exactly that species, while multiple checks are OR — predators + bear + raccoon admits precisely those seven species",
    admissionMatrix && SPECIES.every((s) => admits(USE.MIXED, s.id))
      && unionOpen.join(",") === "fox,owl,bear,raccoon,wolf,cat,hawk"
      && useName(unionMask) === "predator + bear + raccoon",
    unionOpen.join(","));
  check("use: all sixteen checkbox tints are stable and visibly nonblank; a combined selection has a deterministic blended tint",
    new Set(bits.map((bit) => useTint(bit))).size === 16 && bits.every((bit) => /^rgba\(/.test(useTint(bit)))
      && useTint(unionMask) === useTint(unionMask) && useTint(USE.MIXED) === null,
    bits.map((bit) => useTint(bit)).join(" · "));
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
  check("use: the rabbit's way has no forbidden tile; the fox's cost is the plain walk", !!rabbit && !!fox && Array.from(rabbit.path).every((t) => admits(F.use[t], "rabbit")) && fox.cost === 6 * KNOBS.WALK, `${fox && fox.cost}`);
  const rabbitFox = USE.RABBIT | USE.FOX;
  const combo = apply(F, { kind: "use", use: rabbitFox, x0: px + 1, y0: py, x1: px + 5, y1: py });
  computeFields(F);
  const rabbit2 = commutePath(F, "rabbit", a, b), fox2 = commutePath(F, "fox", a, b), mouse2 = commutePath(F, "mouse", a, b);
  const useCensus = census(F);
  check("use: a real combined rabbit + fox road admits both along the short side, sends a mouse around, and Census counts both checked species",
    combo.ok && combo.cost === 5 * KNOBS.COST.use && F.use[at(px + 2, py)] === rabbitFox
      && rabbit2?.path.length === 7 && fox2?.path.length === 7 && mouse2?.path.length === 11
      && useCensus.useSpecies.rabbit === 5 && useCensus.useSpecies.fox === 5
      && useCensus.usePred === 0 && useCensus.usePrey === 0,
    `mask ${F.use[at(px + 2, py)]} · paths ${rabbit2?.path.length}/${fox2?.path.length}/${mouse2?.path.length} · census ${useCensus.useSpecies.rabbit}/${useCensus.useSpecies.fox}`);
  const word = createWorld({ seed: "use-word-save", w: 4, h: 4 });
  word.terrain[5] = 0;
  word.road[5] = ROAD.ROAD;
  const wordPaint = apply(word, { kind: "use", use: USE.PRED | USE.SKUNK, x0: 1, y0: 1, x1: 1, y1: 1 });
  const wordPlain = toPlain(word);
  const wordLoaded = load(JSON.stringify(wordPlain));
  wordPlain.use[5] = 70000;
  const corruptLoaded = load(JSON.stringify(wordPlain));
  check("use: a high species bit and a combined mask survive save/load in Uint16, while an impossible imported value safely becomes mixed",
    wordPaint.ok && wordPaint.cost === KNOBS.COST.use && USE.SKUNK === 32768 && wordLoaded.use instanceof Uint16Array
      && wordLoaded.use[5] === (USE.PRED | USE.SKUNK) && stateHash(word) === stateHash(wordLoaded)
      && corruptLoaded.use[5] === USE.MIXED,
    `${word.use[5]} → ${wordLoaded.use[5]} · corrupt → ${corruptLoaded.use[5]}`);
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
  const inCells = minorA.map((a) => G.byId.get(a.citizenId)).filter((c) => c && c.record >= 1 && G.civic[c.heldAt] === CIVIC.ZOO && c.held === G.tick && c.job < 0);
  check("use: a forced month stops the exposed — a minor's cells to the next tick, a record, no job; the counter counts the minors", minorA.length > 0 && inCells.length === minorA.length && j.trespass - stops0 === minorA.length, `this month ${month.length} (${minorA.length} minor · ${month.length - minorA.length} hard) · in cells ${inCells.length} · counter +${j.trespass - stops0}`);
  const tline = G.events.log.filter((l) => l.id === "arrest" && /Zoo prison/.test(l.line));
  check("use: the ticker names the stop and uses no pronoun", tline.length > 0 && tline.every((l) => !/\b(he|she|his|her|him)\b/i.test(l.line)), tline.slice(0, 1).map((l) => l.line).join(""));
  let hard = 0;
  for (let t = 0; t < 24 && !hard; t++) {
    KNOBS.TRESPASS_P = 1e6; KNOBS.TRESPASS_MAX = 1;
    tick(G);
    KNOBS.TRESPASS_P = saveP; KNOBS.TRESPASS_MAX = saveM;
    hard = G.citizens.filter(c => c.record >= 3 && !c.thefts && G.civic[c.heldAt] === CIVIC.ZOO).length;
  }
  check("use: repeated minor trespass remains imprisonment and never becomes a theft conviction", hard > 0, `hard ${hard} · stops ${G.events.justice.trespass} · sold ${G.events.justice.sold} · taken in ${G.events.justice.takenIn}`);
  check("use: exposure reads zero for everyone the line admits everywhere", G.citizens.filter((c) => c.path && Array.from(c.path).every((t) => admits(G.use[t], c.species)) && admits(G.use[c.home], c.species) && (c.job < 0 || admits(G.use[c.job], c.species))).every((c) => exposure(G, c).e === 0));
  const H = load(save(G));
  for (let t = 0; t < 12; t++) { tick(G); tick(H); }
  check("use: save → load → 12 ticks with the line and a notice hash-equals", stateHash(G) === stateHash(H), `${stateHash(G)} vs ${stateHash(H)}`);
}

// ---- rail (docs/PROPOSAL-ZONING-RAIL-WALLS.md §3; SPEC §7.9) ------------------------------
{
  const { commutePath, computeTraffic, rides, roadPath, WALK } = await import("../js/sim/fields.js");
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
  // Level crossings ARRIVED in session 14 (SPEC §7.9, Part L' below); what
  // this line still holds is that a SINGLE tile is never square-on — a
  // one-tile rail op onto the road leaves the line a stub, and a one-tile
  // road op onto the line leaves the road a stub, so neither is a crossing
  // and both are refused. It used to say "and no bridges in v1" too, on a
  // fixture that is dry by construction and could not have failed for it;
  // Part L' lays real water for that.
  check("rail: a SINGLE tile is never square-on — a one-tile rail onto the road and a one-tile road onto the line are both refused (rail bridges are Part L's water fixture); a station off the rail is blocked", apply(F, { kind: "rail", tiles: [at(px + 3, py)] }).ok === false && apply(F, { kind: "road", tiles: [at(px + 3, py + 1)] }).ok === false && apply(F, { kind: "station", tx: px + 3, ty: py + 2 }).reason === "blocked");
  computeFields(F);
  const a = at(px, py), b = at(px + 13, py);
  const ride = commutePath(F, "rabbit", a, b);
  const walkOnly = 13 * WALK;
  const riding = ride ? Array.from(ride.path).filter((p) => p & 0x8000).length : 0;
  check("rail: the commute rides — cheaper than the walk, riding on the 12 tiles between the stations and walking at them", !!ride && ride.cost === WALK + 13 * KNOBS.RAIL_COST + WALK && ride.cost < walkOnly && riding === 12 && ride.path.length === 16 && !(ride.path[1] & 0x8000) && !(ride.path[14] & 0x8000), `cost ${ride && ride.cost} vs walk ${walkOnly} · riding ${riding} · tiles ${ride && ride.path.length}`);
  check("rail X2: WALK and RAIL_COST are positive integers and the visual ×4.5 is their exact reciprocal — 50% faster than the old ×3",
    Number.isInteger(WALK) && WALK > 0 && WALK === KNOBS.WALK && Number.isInteger(KNOBS.RAIL_COST) && KNOBS.RAIL_COST > 0
      && WALK === 9 && KNOBS.RAIL_COST === 2 && KNOBS.RIDE_SPEED === WALK / KNOBS.RAIL_COST
      && Math.round((KNOBS.RIDE_SPEED / 3 - 1) * 100) === 50,
    `walk ${WALK} · rail ${KNOBS.RAIL_COST} · visual ×${KNOBS.RIDE_SPEED}`);
  check("rail X2: commute time reads the same 2/9 law as the visual speed and the Rules tab prints both live numbers",
    !!ride && Math.abs(commuteTime(ride.path) - (2 + 13 / KNOBS.RIDE_SPEED)) < 1e-9
      && RULES.find((r) => r.id === "R1")?.formula.includes("ride 0.22")
      && RULES.find((r) => r.id === "R1")?.formula.includes("visually ×4.5"),
    `${ride && commuteTime(ride.path)} · ${RULES.find((r) => r.id === "R1")?.formula}`);
  // Two walking segments plus 27 ridden ones: X2 brings this exact tortoise
  // commute onto its 8-step comfort boundary; the former 3/10 law did not.
  const thresholdPath = Uint16Array.from(Array.from({ length: 30 }, (_, k) => k | (k >= 3 && k <= 28 ? 0x8000 : 0)));
  const fastThreshold = commuteTime(thresholdPath);
  const { moodTerms } = await import("../js/sim/citizens.js");
  const thresholdWorld = createWorld({ seed: "x2-threshold" });
  const thresholdCitizen = { id: 1, species: "tortoise", name: "Test", surname: "Threshold", born: -360,
    home: -1, job: 0, path: thresholdPath, friends: [], stale: false, dead: false,
    held: 0, heldAt: -1, pen: false, fixed: false };
  thresholdWorld.citizens = [thresholdCitizen];
  thresholdWorld.byId = new Map([[1, thresholdCitizen]]);
  const fastComfort = moodTerms(thresholdWorld, thresholdCitizen).some((t) => t.code === "COMMUTE");
  const currentRailCost = KNOBS.RAIL_COST;
  let oldThreshold, derivedOldSpeed, oldComfort;
  try {
    KNOBS.RAIL_COST = 3;
    oldThreshold = commuteTime(thresholdPath);
    derivedOldSpeed = KNOBS.RIDE_SPEED;
    oldComfort = moodTerms(thresholdWorld, thresholdCitizen).some((t) => t.code === "COMMUTE");
  } finally { KNOBS.RAIL_COST = currentRailCost; }
  check("rail X2: the faster law crosses the tortoise's exact eight-step commute threshold and the visual factor stays derived under mutation",
    fastThreshold === 8 && oldThreshold === 11 && derivedOldSpeed === 3 && KNOBS.RIDE_SPEED === 4.5,
    `new ${fastThreshold} · old ${oldThreshold} · derived old ×${derivedOldSpeed}`);
  check("rail X2: crossing that threshold has the real mood consequence — COMMUTE comfort now, none under the former law",
    fastComfort && !oldComfort,
    `new comfort ${fastComfort} · old comfort ${oldComfort}`);

  // Measure the real display layer, not only the knobs. Each fixture has one
  // adult rabbit commuter on a straight row. The tiny first update admits the
  // deterministic sampler; the remaining updates are the interval under test.
  const { createWalkers } = await import("../js/walkers.js");
  const { hash01 } = await import("../js/sim/rng.js");
  function measuredWalker(rideFlags, seconds, chunks = 1) {
    const V = createWorld({ seed: "x2-speed" });
    V.tick = 12;
    let id = 1;
    while (hash01(V.tick, id, 0x77) >= 0.78) id++;
    const path = Array.from({ length: rideFlags.length }, (_, x) => 5 * V.w + 5 + x);
    const c = { id, species: "rabbit", name: "Test", surname: "Rider", born: -240,
      home: path[0], job: path.at(-1), path: Uint16Array.from(path, (p, k) => p | (rideFlags[k] ? 0x8000 : 0)),
      stale: false, dead: false, held: 0, heldAt: -1, pen: false, centenary: false };
    V.citizens = [c];
    V.byId = new Map([[id, c]]);
    const layer = createWalkers(V);
    const viewport = { x0: 0, y0: 0, x1: V.w, y1: V.h };
    layer.update(1e-9, viewport);
    for (let k = 0; k < chunks; k++) layer.update(seconds / chunks, viewport);
    return layer.list().find((w) => w.citizen === id);
  }
  const flags = Array(20).fill(false);
  const walkMotion = measuredWalker(flags, 1);
  const rideMotion = measuredWalker(flags.map(() => true), 1);
  check("rail X2: the real walker moves one tile per second on foot and 4.5 on a ridden segment",
    Math.abs(walkMotion.dist - 1) < 1e-9 && Math.abs(rideMotion.dist - KNOBS.RIDE_SPEED) < 1e-9,
    `walk ${walkMotion?.dist} · ride ${rideMotion?.dist} · ratio ${rideMotion?.dist / walkMotion?.dist}`);
  const walkThenRide = flags.map((_, k) => k >= 2);
  const railThenWalk = flags.map((_, k) => k < 2);
  const atWalkRail = measuredWalker(walkThenRide, 1);
  const atRailWalk = measuredWalker(railThenWalk, 2 / KNOBS.RIDE_SPEED);
  check("rail X2: an update ending exactly on walk→rail or rail→walk synchronizes the boundary tile and next ride state",
    atWalkRail.seg === 1 && atWalkRail.t === 0 && Math.abs(atWalkRail.tx - 6.5) < 1e-9 && atWalkRail.riding
      && atRailWalk.seg === 2 && atRailWalk.t === 0 && Math.abs(atRailWalk.tx - 7.5) < 1e-9 && !atRailWalk.riding,
    `walk→rail seg ${atWalkRail?.seg} x ${atWalkRail?.tx} ride ${atWalkRail?.riding} · rail→walk seg ${atRailWalk?.seg} x ${atRailWalk?.tx} ride ${atRailWalk?.riding}`);
  const wrOne = measuredWalker(walkThenRide, 2, 1), wrMany = measuredWalker(walkThenRide, 2, 200);
  const rwOne = measuredWalker(railThenWalk, 2 / KNOBS.RIDE_SPEED + 1, 1), rwMany = measuredWalker(railThenWalk, 2 / KNOBS.RIDE_SPEED + 1, 200);
  check("rail X2: a large frame crossing walk↔rail re-prices at each boundary and is identical to 200 small frames",
    Math.abs(wrOne.dist - 5.5) < 1e-9 && Math.abs(wrOne.dist - wrMany.dist) < 1e-9
      && Math.abs(rwOne.dist - 3) < 1e-9 && Math.abs(rwOne.dist - rwMany.dist) < 1e-9,
    `walk→rail ${wrOne?.dist}/${wrMany?.dist} · rail→walk ${rwOne?.dist}/${rwMany?.dist}`);
  const overStand = measuredWalker([false, false], 3);
  check("rail X2: a large frame keeps unused time through the job stand and onto the return leg",
    !!overStand && overStand.leg === 1 && Math.abs(overStand.dist - 1.5) < 1e-9,
    `leg ${overStand?.leg} · distance ${overStand?.dist} · stand ${overStand?.standUntil}`);
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
  // The larger civic campuses occupy the east/south side. Route this test's
  // shortcut around the north/west, with platforms beside opposite corners.
  const G = load(save(A.world));
  apply(G, { kind: "cheat", amount: KNOBS.CHEAT_MAX });
  const sx = G.start.tx, sy = G.start.ty;
  const gat = (x, y) => y * G.w + x;
  apply(G, { kind: "bulldoze", x0: sx-5, y0: sy-5, x1: sx-5, y1: sy-5 });
  const col = []; for (let y = sy - 5; y <= sy + 3; y++) col.push(gat(sx - 5, y));
  const row = []; for (let x = sx - 5; x <= sx - 3; x++) row.push(gat(x, sy - 5));
  const l1 = apply(G, { kind: "rail", tiles: col }), l2 = apply(G, { kind: "rail", tiles: row });
  const g1 = apply(G, { kind: "station", tx: sx - 3, ty: sy - 5 }), g2 = apply(G, { kind: "station", tx: sx - 5, ty: sy + 3 });
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

// ---- Part L': the level crossing (SPEC §7.9, §12.4c; plan §4-X) -------------
//
// The owner: "railroads and roads should be able to cross over each other
// perpendicularly." The commute graph already allowed it — `dial` walks any
// road tile and rides any rail tile, and the two layers meet ONLY at a
// station — so the whole of "no level crossings in v1" was two refusals in
// ops.js and one draw line. What this section pins is the four halves of the
// change: the RULE (square-on, and what a crossing refuses afterwards), the
// GRAPH (a walker crosses on foot, a rider passes at ride cost, neither pays
// for the other, and nobody boards there), the LEDGER (a crossing is a road
// AND a line, so it costs and smokes as both — a ruling, said out loud, not
// an accident), and the ART (composed from the road's own family and the
// line's own, never a third drawing of a road).
{
  const { crossingKey, crossingSprite, squareOnCrossings, railKey, onRail, RAILS, N: RN, E: RE, S: RS, W: RW } = await import("../js/art/rail.js");
  const { onRoad, roadKey, ROADS } = await import("../js/art/roads.js");
  const { squareOn, maskAround } = await import("../js/sim/ops.js");
  const { commutePath, computeTraffic, rides, RIDE, TILE, WALK } = await import("../js/sim/fields.js");
  const { yearlyFigures } = await import("../js/sim/budget.js");
  const { keysOf } = await import("../js/art/palette.js");
  const { TERRAIN } = await import("../js/sim/world.js");
  const { art } = await import("../js/art/index.js");

  const NS = RN | RS;
  const EW = RE | RW;

  // A clear 7 × 18 patch of grass, found the way the rail fixture finds one.
  const F = createWorld({ seed: SEED });
  let px = -1, py = -1;
  cross: for (let y = 4; y < F.h - 12; y++) for (let x = 4; x < F.w - 22; x++) {
    let ok = true;
    for (let yy = y; yy < y + 7 && ok; yy++) for (let xx = x; xx < x + 18; xx++) { const i = yy * F.w + xx; if (F.terrain[i] !== 0 || F.road[i] || F.zone[i] || F.civic[i] || F.wall[i]) { ok = false; break; } }
    if (ok) { px = x; py = y; break cross; }
  }
  // If the seed has no such patch the section must not die on the first null
  // it meets thirty checks later — clear one by hand and carry on. (`--seed`
  // is a flag; the suite has to work on any of them.)
  if (px < 0) {
    px = 4; py = 4;
    for (let y = py; y < py + 7; y++) for (let x = px; x < px + 18; x++) {
      const i = y * F.w + x;
      F.terrain[i] = 0; F.road[i] = 0; F.zone[i] = 0; F.civic[i] = 0; F.wall[i] = 0; F.rail[i] = 0; F.tier[i] = 0;
    }
  }
  const at = (x, y) => y * F.w + x;

  // The line: E–W along row py+3. The road: N–S down column px+4.
  const line = []; for (let x = px; x <= px + 17; x++) line.push(at(x, py + 3));
  const rr = apply(F, { kind: "rail", tiles: line });
  const col = []; for (let y = py; y <= py + 6; y++) col.push(at(px + 4, y));
  const X = at(px + 4, py + 3);
  const planned = costOfOp(F, { kind: "road", tiles: col });
  const rd = apply(F, { kind: "road", tiles: col });
  check("crossing: a road dragged square-on across a line makes ONE tile that is both, at a plain road's price, and the strip calls it a crossing",
    rr.ok && rd.ok && F.road[X] === ROAD.ROAD && F.rail[X] === 1 && rd.cost === 7 * KNOBS.COST.road && (planned.tiles.find((t) => t.i === X) || {}).what === "crossing",
    `${rd.reason || rd.cost} · road ${F.road[X]} rail ${F.rail[X]} · what ${(planned.tiles.find((t) => t.i === X) || {}).what}`);
  // The law itself, as arithmetic. PARALLEL is unreachable through the ops —
  // a crossing whose road and line run the same way needs both its
  // neighbours on that axis to carry BOTH layers, i.e. to be crossings, and
  // those would have to be parallel too, all the way out — so a mutation
  // that let `squareOn` accept two parallel straight runs sailed past every
  // fixture. Test the statement where the statement lives.
  check("crossing: square-on is two straight runs on DIFFERENT axes — parallel is not a crossing, a corner is not, a stub is not, a junction is not",
    squareOn(NS, EW) && squareOn(EW, NS) &&
    !squareOn(NS, NS) && !squareOn(EW, EW) &&
    !squareOn(NS | RE, EW) && !squareOn(RN, EW) && !squareOn(RN | RE, EW) && !squareOn(15, EW) && !squareOn(0, EW) && !squareOn(NS, 0) && !squareOn(NS, RW),
    `NS/EW ${squareOn(NS, EW)} · NS/NS ${squareOn(NS, NS)} · EW/EW ${squareOn(EW, EW)}`);
  check("crossing: and it IS square-on — the road straight one way, the line straight the other, by the rule's own two functions",
    squareOn(maskAround(F, F.road, null, X), maskAround(F, F.rail, null, X)) && maskAround(F, F.road, null, X) === NS && maskAround(F, F.rail, null, X) === EW,
    `road mask ${maskAround(F, F.road, null, X)} · rail mask ${maskAround(F, F.rail, null, X)}`);

  // The other direction: a line dragged across a road that is already there.
  const row1 = []; for (let x = px + 10; x <= px + 17; x++) row1.push(at(x, py + 1));
  const r1 = apply(F, { kind: "road", tiles: row1 });
  const col13 = []; for (let y = py; y <= py + 2; y++) col13.push(at(px + 13, y));
  const Y = at(px + 13, py + 1);
  const planned2 = costOfOp(F, { kind: "rail", tiles: col13 });
  const r2 = apply(F, { kind: "rail", tiles: col13 });
  check("crossing: a LINE dragged square-on across a road makes one too — the rule is the same read the other way round, and this op calls the tile a crossing as well",
    r1.ok && r2.ok && F.road[Y] === ROAD.ROAD && F.rail[Y] === 1 && squareOn(maskAround(F, F.road, null, Y), maskAround(F, F.rail, null, Y)) &&
    (planned2.tiles.find((t) => t.i === Y) || {}).what === "crossing",
    `${r1.reason || ""} ${r2.reason || ""} · road ${F.road[Y]} rail ${F.rail[Y]} · what ${(planned2.tiles.find((t) => t.i === Y) || {}).what}`);

  // A crossing is a THROUGH road. A drag that stops on the line is refused
  // there — and the rest of the drag still lays, the way every other blocked
  // tile in an L-drag behaves.
  const stub = []; for (let y = py; y <= py + 3; y++) stub.push(at(px + 6, y));
  const rs = apply(F, { kind: "road", tiles: stub });
  check("crossing: a road that DEAD-ENDS on the line is refused at the line and the rest of the drag still lays — a crossing is a through road",
    rs.ok && F.road[at(px + 6, py + 3)] === ROAD.NONE && F.road[at(px + 6, py + 2)] === ROAD.ROAD && F.rail[at(px + 6, py + 3)] === 1,
    `${rs.reason || rs.cost} · on the line ${F.road[at(px + 6, py + 3)]} · one short of it ${F.road[at(px + 6, py + 2)]}`);

  // A road ALONG the line is parallel, never square-on: nothing lays, and the
  // op says why rather than leaving a silent gap.
  const along = []; for (let x = px + 8; x <= px + 11; x++) along.push(at(x, py + 3));
  const ra = apply(F, { kind: "road", tiles: along });
  check("crossing: a road dragged ALONG the line lays nothing and says why — parallel is not square-on",
    ra.ok === false && /square-on/.test(ra.reason || "") && F.road[at(px + 9, py + 3)] === ROAD.NONE, `${ra.reason}`);

  // A crossing KEEPS its two straight runs, and the rule needs a SECOND
  // clause to say so — this section first claimed the first clause implied it
  // and the claim was false twice over (see the handoff's trap table). An op
  // that would leave a NEIGHBOURING crossing crooked is refused as well.
  const thruRoad = []; for (let x = px + 2; x <= px + 6; x++) thruRoad.push(at(x, py + 3));
  const t1 = apply(F, { kind: "road", tiles: thruRoad });
  const thruRail = [at(px + 4, py + 1), at(px + 4, py + 2)];
  const t2 = apply(F, { kind: "rail", tiles: thruRail });
  check("crossing: neither a road nor a line may grow an existing crossing a third arm — it keeps the two straight runs it was made with",
    t1.ok === false && t2.ok === false && maskAround(F, F.road, null, X) === NS && maskAround(F, F.rail, null, X) === EW,
    `road op ${t1.reason} · rail op ${t2.reason} · masks ${maskAround(F, F.road, null, X)}/${maskAround(F, F.rail, null, X)}`);
  // The case the first draft's argument missed: a road laid one tile ALONG
  // the line is square-on on its own tile and still makes a T-junction of its
  // neighbour. The drag lays every tile but that one.
  // An L-drag whose other leg runs ALONG the line: that leg is refused, and
  // the crossing at the corner must NOT be refused with it. The first draft
  // judged one downward pass, so the corner was condemned by a phantom arm
  // belonging to a tile the same call was in the act of throwing away.
  {
    const P = createWorld({ seed: SEED });
    for (let y = py; y < py + 7; y++) for (let x = px; x < px + 18; x++) { const i = y * P.w + x; P.terrain[i] = 0; P.road[i] = 0; P.zone[i] = 0; P.civic[i] = 0; P.wall[i] = 0; P.rail[i] = 0; P.tier[i] = 0; }
    const nsLine = []; for (let y = py + 1; y <= py + 5; y++) nsLine.push(at(px + 4, y));
    apply(P, { kind: "rail", tiles: nsLine });
    apply(P, { kind: "road", tiles: [at(px + 1, py + 3), at(px + 2, py + 3), at(px + 3, py + 3)] });
    apply(P, { kind: "road", tiles: [at(px + 5, py + 3), at(px + 6, py + 3), at(px + 7, py + 3)] });
    const C = at(px + 4, py + 3);
    const parallel = at(px + 4, py + 2);
    const drag = [at(px + 1, py + 2), at(px + 2, py + 2), at(px + 3, py + 2), parallel, C]; // the L, corner ON the line
    const fp = apply(P, { kind: "road", tiles: drag });
    check("crossing: a drag whose leg runs ALONG the line and then crosses it lays the CROSSING and refuses only the parallel tile — the prune is a fixpoint, not one downward pass",
      fp.ok && P.road[C] === ROAD.ROAD && P.rail[C] === 1 && P.road[parallel] === ROAD.NONE &&
      squareOn(maskAround(P, P.road, null, C), maskAround(P, P.rail, null, C)),
      `${fp.reason || fp.cost} · crossing road ${P.road[C]} rail ${P.rail[C]} · the parallel tile ${P.road[parallel]}`);
  }

  const B = load(save(F)); // on a twin: the fixture below measures commutes, and a bulldoze here would cut the line
  const beside = []; for (let y = py; y <= py + 6; y++) beside.push(at(px + 5, y));
  const t3 = apply(B, { kind: "road", tiles: beside });
  check("crossing: a road that would be square-on ITSELF is still refused one tile along the line, because it would make a T-junction of the crossing beside it — and the rest of that drag lays",
    t3.ok && B.road[at(px + 5, py + 3)] === ROAD.NONE && B.road[at(px + 5, py + 2)] === ROAD.ROAD && maskAround(B, B.road, null, X) === NS,
    `on the line ${B.road[at(px + 5, py + 3)]} · one short ${B.road[at(px + 5, py + 2)]} · crossing road mask ${maskAround(B, B.road, null, X)}`);

  // A tunnel is open along ONE axis; a crossing has two. And a platform would
  // stand in the road.
  const wl = apply(F, { kind: "wall", tiles: [X] });
  const st = apply(F, { kind: "station", tx: px + 4, ty: py + 3 });
  check("crossing: no wall over it (a tunnel has one open axis, a crossing two) and no station on it (the platform would stand in the road)",
    wl.ok === false && /one axis/.test(wl.reason || "") && F.wall[X] === 0 && st.ok === false && /station cannot stand/.test(st.reason || "") && F.rail[X] === 1,
    `wall ${wl.reason} · station ${st.reason}`);

  // The invariant, over every tile of the fixture: whatever the player did,
  // a tile that carries both carries them square-on, and is never a station,
  // never walled, never water.
  const both = [];
  let notSquare = 0, walled = 0, stationed = 0, wet = 0;
  for (let i = 0; i < F.w * F.h; i++) {
    if (!(F.road[i] !== ROAD.NONE && F.rail[i])) continue;
    both.push(i);
    if (!squareOn(maskAround(F, F.road, null, i), maskAround(F, F.rail, null, i))) notSquare++;
    if (F.wall[i]) walled++;
    if (F.rail[i] !== 1) stationed++;
    if (F.terrain[i] === TERRAIN.WATER || F.road[i] === ROAD.BRIDGE) wet++;
  }
  check("crossing: the invariant holds over the whole fixture — every both-tile square-on, rail 1, no wall, dry land",
    both.length === 2 && notSquare === 0 && walled === 0 && stationed === 0 && wet === 0,
    `${both.length} crossings · ${notSquare} not square-on · ${walled} walled · ${stationed} stations · ${wet} wet`);

  // The ONE thing that can take square-on away is the bulldozer removing a
  // neighbour — no rule can stop that without trapping the player beside it.
  // So: the crooked crossing is allowed to EXIST, an op may not build on the
  // damage, putting the line back mends it, and a crooked tile still saves,
  // loads and draws. (The whole reason `art.crossing` takes both live masks.)
  {
    const D = createWorld({ seed: SEED });
    const dline = []; for (let x = px; x <= px + 9; x++) dline.push(at(x, py + 3));
    const dcol = []; for (let y = py; y <= py + 6; y++) dcol.push(at(px + 4, y));
    apply(D, { kind: "rail", tiles: dline });
    apply(D, { kind: "road", tiles: dcol });
    const straightBefore = squareOn(maskAround(D, D.road, null, X), maskAround(D, D.rail, null, X));
    apply(D, { kind: "bulldoze", x0: px + 5, y0: py + 3, x1: px + 5, y1: py + 3 }); // the line, one tile east
    const crookedNow = !squareOn(maskAround(D, D.road, null, X), maskAround(D, D.rail, null, X));
    const onDamage = apply(D, { kind: "road", tiles: [at(px + 5, py + 3)] }); // bare ground, but it would T the crossing
    const mend = apply(D, { kind: "rail", tiles: [at(px + 5, py + 3)] });
    check("crossing: the bulldozer may leave one crooked (a neighbour taken away), an op may NOT build on that damage, and putting the line back mends it",
      straightBefore && crookedNow && onDamage.ok === false && /square-on/.test(onDamage.reason || "") && D.road[at(px + 5, py + 3)] === ROAD.NONE &&
      mend.ok && squareOn(maskAround(D, D.road, null, X), maskAround(D, D.rail, null, X)),
      `straight ${straightBefore} · crooked ${crookedNow} · road op ${onDamage.reason} · mended ${mend.ok}`);
    // and a crooked one is still a legal, savable, drawable tile
    apply(D, { kind: "bulldoze", x0: px + 5, y0: py + 3, x1: px + 5, y1: py + 3 });
    const crooked = load(save(D));
    check("crossing: a crooked crossing round-trips through save and load and still carries both layers",
      crooked.road[X] === D.road[X] && crooked.rail[X] === D.rail[X] && !squareOn(maskAround(crooked, crooked.road, null, X), maskAround(crooked, crooked.rail, null, X)),
      `road ${crooked.road[X]} rail ${crooked.rail[X]}`);
  }

  // ---- the graph: the whole point of the feature ----------------------------
  const s1 = apply(F, { kind: "station", tx: px, ty: py + 3 });
  const s2 = apply(F, { kind: "station", tx: px + 17, ty: py + 3 });
  computeFields(F);
  const down = commutePath(F, "rabbit", at(px + 4, py), at(px + 4, py + 6));
  check("crossing: a walker crosses it on foot at a plain road's price — the line under their feet costs a pedestrian nothing",
    s1.ok && s2.ok && !!down && down.cost === 6 * WALK && down.path.length === 7 && !rides(down.path) && Array.from(down.path).some((p) => (p & TILE) === X && !(p & RIDE)),
    `cost ${down && down.cost} vs ${6 * WALK} · tiles ${down && down.path.length}`);
  const through = commutePath(F, "rabbit", at(px, py + 3), at(px + 17, py + 3));
  const atX = through ? Array.from(through.path).filter((p) => (p & TILE) === X) : [];
  check("crossing: a rider passes THROUGH it at ride cost with the ride bit set, and cannot board or alight there — a crossing is rail 1, never a platform",
    !!through && through.cost === 17 * KNOBS.RAIL_COST && atX.length === 1 && (atX[0] & RIDE) !== 0 && F.rail[X] === 1,
    `cost ${through && through.cost} vs ${17 * KNOBS.RAIL_COST} · entries at the crossing ${atX.length} · ridden ${atX.length ? !!(atX[0] & RIDE) : "—"}`);

  // The crossing is the first tile in the game that is a walk node AND a ride
  // node at once, so a stored path may name it twice (ride over it between the
  // stations, walk back over it to the door). Nothing downstream may double it.
  const keepCitizens = F.citizens;
  const traffic = (path) => { F.citizens = [{ path }]; computeTraffic(F); return F.traffic[X]; };
  const twice = Uint16Array.from([at(px, py + 3), X | RIDE, at(px + 17, py + 3), X, at(px + 4, py + 4)]);
  const walkedX = traffic(down.path);
  const riddenX = traffic(through.path);
  const twiceX = traffic(twice);
  F.citizens = keepCitizens;
  computeTraffic(F);
  check("crossing: traffic counts the walked crossing (a real commute) and not the ridden one (a real ride); and — on a path built by hand, since no search need produce one — it counts a tile named twice only once",
    walkedX === 1 && riddenX === 0 && twiceX === 1, `walked ${walkedX} · ridden ${riddenX} · named twice ${twiceX}`);
  check("crossing: commuteTime charges a path's ridden entries a ride and its walked entries a walk, crossing or not",
    Math.abs(commuteTime(twice) - (2 * KNOBS.RAIL_COST / WALK + 2)) < 1e-9, `${commuteTime(twice)}`);
  check("crossing: it is a road for access — a crossing seeds the road-distance flood like any other road tile",
    F.roadDist[X] === 0 && served(F, X) && served(F, at(px + 5, py + 3)), `roadDist ${F.roadDist[X]} · neighbour ${F.roadDist[at(px + 5, py + 3)]}`);

  // ---- the ledger and the air: a crossing is BOTH, and pays for both -------
  const figBefore = yearlyFigures(F);
  const bz = apply(F, { kind: "bulldoze", x0: px + 4, y0: py + 3, x1: px + 4, y1: py + 3 });
  const figAfter = yearlyFigures(F);
  check("crossing: on the books it is a road AND a line — the bulldozer takes the line first, the road stays and keeps paying, and one press is one undo step",
    bz.ok && F.rail[X] === 0 && F.road[X] === ROAD.ROAD && figAfter.rails === figBefore.rails - 1 && figAfter.roads === figBefore.roads,
    `rails ${figBefore.rails} → ${figAfter.rails} · roads ${figBefore.roads} → ${figAfter.roads}`);
  undo(F);
  check("crossing: undo puts the line back under the road", F.rail[X] === 1 && F.road[X] === ROAD.ROAD, `road ${F.road[X]} rail ${F.rail[X]}`);
  // The same TILE with the line and without it — not a different tile four
  // rows up, which is what the first draft compared and which is won by road
  // geometry (a mid-column tile has two road neighbours, an end tile one)
  // before the line is consulted at all. That version passed with the rail's
  // emission deleted from the sim.
  computeFields(F);
  const polBoth = F.pol[X];
  F.rail[X] = 0; computeFields(F); const polNoLine = F.pol[X];
  F.rail[X] = 1; F.road[X] = ROAD.NONE; computeFields(F); const polNoRoad = F.pol[X];
  F.road[X] = ROAD.ROAD; computeFields(F);
  check("crossing: it smokes as BOTH — take the line off that very tile and its air loses exactly the line's emission; take the road off and it loses the road's (SPEC §7.9)",
    polBoth === F.pol[X] && polBoth - polNoLine === KNOBS.EMIT_RAIL && polBoth > polNoRoad,
    `both ${polBoth} · no line ${polNoLine} (−${polBoth - polNoLine}, EMIT_RAIL ${KNOBS.EMIT_RAIL}) · no road ${polNoRoad}`);

  // ---- the art -------------------------------------------------------------
  // Law 6 on the art: off the line the crossing IS the road's own surface, off
  // the road it IS the line's own. Neither is redrawn in rail.js.
  const GRID = [];
  for (let a = 0.25; a < 16; a += 0.5) for (let b = 0.25; b < 16; b += 0.5) GRID.push([a, b]);
  let roadPts = 0, railPts = 0, disagree = 0;
  for (const rdm of [NS, EW, RN | RE, 15, 0]) for (const rlm of [EW, NS, RW, 15, 0]) {
    for (const [a, b] of GRID) {
      const sx = (a * 4) | 0, sy = (b * 4) | 0;
      const onBed = onRail(rlm, a, b), onTar = onRoad(rdm, a, b);
      const k = crossingKey(rdm, rlm, false, a, b, sx, sy);
      if (onTar && !onBed) { roadPts++; if (k !== roadKey(rdm, false, a, b, sx, sy)) disagree++; }
      else if (onBed && !onTar) { railPts++; if (k !== railKey(rlm, a, b, sx, sy)) disagree++; }
    }
  }
  check("crossing art: off the line it IS the road's own surface and off the road it IS the line's own — one implementation, never a third drawing of a road",
    disagree === 0 && roadPts > 500 && railPts > 500, `${disagree} disagreements over ${roadPts} road points and ${railPts} line points`);

  const EARTH = keysOf("earth");
  let overlap = 0, earthy = 0, busyDiff = 0;
  for (const [a, b] of GRID) {
    if (!(onRoad(NS, a, b) && onRail(EW, a, b))) continue;
    overlap++;
    const sx = (a * 4) | 0, sy = (b * 4) | 0;
    const k = crossingKey(NS, EW, false, a, b, sx, sy);
    if (EARTH.includes(k)) earthy++;
    if (crossingKey(NS, EW, true, a, b, sx, sy) !== k) busyDiff++;
  }
  check("crossing art: where the line is in the road the ballast, the sleepers and the lane dash all stop — two rails in tarmac, and busy changes nothing there",
    overlap > 100 && earthy === 0 && busyDiff === 0, `${overlap} overlap points · ${earthy} earth keys · ${busyDiff} busy differences`);

  const SQ = squareOnCrossings();
  const cross = SQ[0].ew;
  check("crossing art: the square-on tile is neither the plain road with its rails forgotten nor the plain track with its road forgotten",
    cross.rows.join("") !== ROADS[0][NS].rows.join("") && cross.rows.join("") !== RAILS[EW].rows.join(""), cross.name);

  // `busy` must ACT on the road half. The check above asserts it changes
  // nothing where the line crosses, which is the one place it is meant to be
  // ignored — so on its own it is satisfied by a crossing that drops the
  // argument entirely, and a crossing that did was green.
  let busyPts = 0;
  for (const [a, b] of GRID) {
    if (!onRoad(NS, a, b) || onRail(EW, a, b)) continue;
    const sx = (a * 4) | 0, sy = (b * 4) | 0;
    if (crossingKey(NS, EW, true, a, b, sx, sy) !== crossingKey(NS, EW, false, a, b, sx, sy)) busyPts++;
  }
  check("crossing art: a busy crossing keeps the road's lane dashes where the line is NOT — busy is not a dropped argument",
    busyPts > 0 && SQ[1].ew.rows.join("") !== SQ[0].ew.rows.join("") && SQ[1].ns.rows.join("") !== SQ[0].ns.rows.join(""),
    `${busyPts} points differ off the line`);

  // A line with no neighbour left has no direction, and used to fall through
  // to plain tarmac: the crossing became pixel-identical to the road it lay
  // in, while the city went on charging, counting, riding and smoking it.
  let vanished = 0;
  for (let m = 0; m < 16; m++) for (const busy of [0, 1]) if (crossingSprite(m, 0, !!busy).rows.join("|") === ROADS[busy][m].rows.join("|")) vanished++;
  check("crossing art: a crossing whose line has been bulldozed off BOTH sides still shows its bed — it never draws as a plain road, busy or quiet",
    vanished === 0, `${vanished} of 32 road masks draw the line away`);

  // Every one of the 512, tied back to the masks it was asked for — `built
  // === 512` was arithmetic, not coverage, and a one-bit typo in the cache
  // key handed back the wrong sprite for half the family with nothing to
  // notice. The name IS the identity here (identity, never an index).
  let wrongSize = 0, noTwin = 0, wrongSprite = 0;
  const names = new Set();
  for (let rdm = 0; rdm < 16; rdm++) for (let rlm = 0; rlm < 16; rlm++) for (const busy of [false, true]) {
    const s = crossingSprite(rdm, rlm, busy);
    names.add(s.name);
    if (s.name !== `crossing-${rdm}-${rlm}${busy ? "-busy" : ""}`) wrongSprite++;
    if (s.w !== 64 || s.h !== 32 || s.anchor[0] !== 32 || s.anchor[1] !== 16) wrongSize++;
    const hi = art.hires(s);
    if (!hi || hi.w !== 128 || hi.h !== 64) noTwin++;
  }
  check("crossing art: all 512 of the family compose as legal 64×32 ground diamonds (defineSprite refuses a key outside the palette), each hands back the sprite its two masks asked for, and each has a 128×64 twin from its own recipe",
    names.size === 512 && wrongSprite === 0 && wrongSize === 0 && noTwin === 0,
    `${names.size} distinct · ${wrongSprite} wrong sprite for the masks · ${wrongSize} wrong size · ${noTwin} without a twin`);
  check("crossing art: the same two masks hand back the SAME sprite — the family is composed once and kept, not rebuilt per frame",
    crossingSprite(NS, EW, false) === SQ[0].ew && crossingSprite(EW, NS, true) === SQ[1].ns);

  // The RENDERER has to PICK it, and the first draft of this check did not
  // prove that: it rendered the tile with the line and without it and demanded
  // two different pictures — but taking the line off the crossing also changes
  // the MASK of the two track tiles either side of it, so the picture changed
  // whether or not the crossing sprite was ever drawn. A mutation that made
  // rebuildGround fall through to the plain road sailed past it. The honest
  // test names the sprite: the crossing's concrete APRON (palette key `^`,
  // 36 px on a square-on tile) appears in no road, rail or grass sprite in the
  // game — so count that colour in the finished frame, over a bare world where
  // nothing else could have put it there.
  {
    const HC = await import("./headless-canvas.mjs");
    HC.installCanvas();
    const { createRenderer } = await import("../js/render.js");
    const { createWalkers } = await import("../js/walkers.js");
    const { toScreen, HALF_H } = await import("../js/iso/iso.js");
    const { colourOf, keysOf } = await import("../js/art/palette.js"); // colourOf: the sprite-match below compares real pixels
    const APRON = colourOf(keysOf("concrete")[1]);

    // A bare world: one line, one road across it, nothing else in frame — and
    // the patch cleared by hand, so the picture is the same on every seed. (It
    // was not, and on a seed whose ground carries water the CONTROL tile
    // picked up a kerb overlay and the check failed for a reason that had
    // nothing to do with crossings.)
    const V = createWorld({ seed: SEED });
    for (let y = py - 1; y < py + 8; y++) for (let x = px - 1; x < px + 19; x++) {
      if (x < 0 || y < 0 || x >= V.w || y >= V.h) continue;
      const i = y * V.w + x;
      V.terrain[i] = 0; V.road[i] = 0; V.zone[i] = 0; V.civic[i] = 0; V.wall[i] = 0; V.rail[i] = 0; V.tier[i] = 0; V.rubble[i] = 0;
    }
    const vline = []; for (let x = px; x <= px + 8; x++) vline.push(at(x, py + 3));
    const vcol = []; for (let y = py; y <= py + 6; y++) vcol.push(at(px + 4, y));
    apply(V, { kind: "rail", tiles: vline });
    apply(V, { kind: "road", tiles: vcol });
    computeFields(V);
    const canvas = HC.createCanvas(200, 140);
    const renderer = createRenderer(canvas, V, art);
    const walkers = createWalkers(V);
    walkers.notify();
    const [ax, ay] = toScreen(px + 4 + 0.5, py + 3 + 0.5);
    const cam = { x: ax, y: ay + HALF_H, zoom: 1 };
    const aprons = () => {
      renderer.invalidate();
      renderer.draw(cam, null, walkers, "off", 0);
      const d = canvas._data;
      let n = 0;
      for (let k = 0; k < d.length; k += 4) if (d[k] === APRON[0] && d[k + 1] === APRON[1] && d[k + 2] === APRON[2] && d[k + 3] === 255) n++;
      return n;
    };
    const drawn = aprons();
    const VX = at(px + 4, py + 3);
    V.rail[VX] = 0;
    const gone = aprons();
    V.rail[VX] = 1;
    const back = aprons();
    check("crossing: the RENDERER draws THE CROSSING — its concrete apron, a colour no road, rail or grass tile in the game contains, is in the finished frame; take the line off the tile and the apron goes with it",
      drawn > 0 && gone === 0 && back === drawn, `apron pixels ${drawn} with the line · ${gone} without it · ${back} with it back`);

    // …and the apron alone cannot tell the right crossing from its transpose
    // (swap the two masks in render.js and the apron count is identical, 36
    // either way, because the corners are symmetric). So MATCH THE SPRITE:
    // every opaque pixel of `art.crossing(roadMask, railMask, busy)` must be
    // that colour at that place in the finished frame — with a plain road
    // tile in the same frame as the control, so a bad anchoring fails loudly
    // instead of quietly agreeing with everything.
    renderer.invalidate();
    renderer.draw(cam, null, walkers, "off", 0);
    const d = canvas._data;
    const matches = (tx, ty, sprite) => {
      const [ox, oy] = renderer.tileToScreen(tx, ty);
      let hit = 0, miss = 0;
      for (let y = 0; y < sprite.h; y++) for (let x = 0; x < sprite.w; x++) {
        const ch = sprite.rows[y][x];
        if (ch === ".") continue;
        const sx = Math.round(ox - sprite.anchor[0] + x);
        const sy = Math.round(oy - sprite.anchor[1] + y);
        if (sx < 0 || sy < 0 || sx >= canvas.width || sy >= canvas.height) continue;
        const k = (sy * canvas.width + sx) * 4;
        const c = colourOf(ch);
        if (d[k] === c[0] && d[k + 1] === c[1] && d[k + 2] === c[2]) hit++; else miss++;
      }
      return { hit, miss };
    };
    const right = matches(px + 4, py + 3, art.crossing(5, 10, false)); // road N|S, line E|W
    const transposed = matches(px + 4, py + 3, art.crossing(10, 5, false)); // the masks swapped
    const control = matches(px + 4, py + 1, art.road(5, false)); // a plain road two tiles up the column
    check("crossing: and it draws THAT crossing — every opaque pixel of art.crossing(roadMask, railMask) lands where the renderer put it, the mask-swapped twin does not, and a plain road tile in the same frame matches its own sprite",
      right.miss === 0 && right.hit > 900 && transposed.miss > 100 && control.miss === 0 && control.hit > 900,
      `crossing ${right.hit}/${right.miss} · transposed ${transposed.hit}/${transposed.miss} · control road ${control.hit}/${control.miss}`);
  }

  // The two clauses of `crossable` the ops actually reach: a crossing is never
  // a station's tile and never a tunnel's. Both on a world of their own, so
  // the roads they lay cannot disturb the commute figures measured above.
  {
    const G2 = createWorld({ seed: SEED });
    const l2 = []; for (let x = px; x <= px + 9; x++) l2.push(at(x, py + 3));
    apply(G2, { kind: "rail", tiles: l2 });
    apply(G2, { kind: "station", tx: px + 2, ty: py + 3 });
    apply(G2, { kind: "wall", tiles: [at(px + 6, py + 3)] }); // a rail tunnel
    const overStation = []; for (let y = py + 1; y <= py + 5; y++) overStation.push(at(px + 2, y));
    const overTunnel = []; for (let y = py + 1; y <= py + 5; y++) overTunnel.push(at(px + 6, y));
    apply(G2, { kind: "road", tiles: overStation });
    apply(G2, { kind: "road", tiles: overTunnel });
    check("crossing: never a station's tile (the platform stands on the track) and never a tunnel's (one open axis) — a road dragged square-on through either lays round it and leaves it alone",
      G2.road[at(px + 2, py + 3)] === ROAD.NONE && G2.rail[at(px + 2, py + 3)] === 2 && G2.road[at(px + 2, py + 1)] === ROAD.ROAD &&
      G2.road[at(px + 6, py + 3)] === ROAD.NONE && G2.wall[at(px + 6, py + 3)] === 1 && G2.rail[at(px + 6, py + 3)] === 1 && G2.road[at(px + 6, py + 1)] === ROAD.ROAD,
      `station tile road ${G2.road[at(px + 2, py + 3)]} · tunnel tile road ${G2.road[at(px + 6, py + 3)]}`);
    const roadRow = []; for (let x = px + 12; x <= px + 16; x++) roadRow.push(at(x, py + 3));
    apply(G2, { kind: "road", tiles: roadRow });
    apply(G2, { kind: "wall", tiles: [at(px + 14, py + 3)] }); // a road tunnel
    const lineDown = []; for (let y = py + 1; y <= py + 5; y++) lineDown.push(at(px + 14, y));
    apply(G2, { kind: "rail", tiles: lineDown });
    check("crossing: nor may a LINE cross a road already under a wall — the tunnel keeps its one open axis, and the line lays round it",
      G2.rail[at(px + 14, py + 3)] === 0 && G2.wall[at(px + 14, py + 3)] === 1 && G2.road[at(px + 14, py + 3)] === ROAD.ROAD && G2.rail[at(px + 14, py + 1)] === 1,
      `tunnel tile rail ${G2.rail[at(px + 14, py + 3)]} · one short of it ${G2.rail[at(px + 14, py + 1)]}`);
  }

  // Rail bridges use water, but the road and rail decks cannot share a tile. No
  // check in the suite had ever laid rail on water — the fixture that carried
  // the claim is dry by construction, so it could not fail for the reason it
  // named. Find real water, bridge it, and try both ways over it.
  {
    const Wt = createWorld({ seed: SEED });
    // a water tile with dry, empty ground directly north and south of it, so
    // a N–S rail drag has a bank either side of the crossing it is refused
    let wet = -1;
    const clear = (i) => Wt.terrain[i] !== TERRAIN.WATER && !Wt.road[i] && !Wt.zone[i] && !Wt.civic[i] && !Wt.wall[i] && !Wt.rail[i];
    for (let y = 2; y < Wt.h - 2 && wet < 0; y++) for (let x = 2; x < Wt.w - 2; x++) {
      const i = y * Wt.w + x;
      if (Wt.terrain[i] !== TERRAIN.WATER) continue;
      if (!clear(i - Wt.w) || !clear(i + Wt.w)) continue;
      wet = i; break;
    }
    if (wet < 0) {
      check("crossing: the water fixture found a one-tile channel", false, "no isolated water tile on this seed");
    } else {
      const wx = wet % Wt.w, wy = (wet / Wt.w) | 0;
      const onWater = apply(Wt, { kind: "rail", tiles: [wet] });
      const railBuilt = onWater.ok && Wt.rail[wet] === 1;
      apply(Wt,{kind:"bulldoze",x0:wx,y0:wy,x1:wx,y1:wy});
      const span = apply(Wt, { kind: "road", tiles: [wet] }); // a bridge
      const overBridge = apply(Wt, { kind: "rail", tiles: [wet - Wt.w, wet, wet + Wt.w] });
      check("crossing: rail can bridge water but cannot share a road bridge",
        railBuilt && Wt.rail[wet] === 0 && span.ok && Wt.road[wet] === ROAD.BRIDGE &&
        Wt.rail[wet] === 0 && Wt.rail[wet - Wt.w] === 1 && Wt.rail[wet + Wt.w] === 1,
        `water at (${wx},${wy}) · rail on water ${onWater.reason || onWater.ok} · bridge ${Wt.road[wet]} · rail on the deck ${Wt.rail[wet]} · either bank ${Wt.rail[wet - Wt.w]}/${Wt.rail[wet + Wt.w]}`);
    }
  }

  // Two crossings in the saved city, reloaded and run on: the shape that
  // catches stale derived state (roadDist, occlusion, the ground bitmap).
  const CL = load(save(F));
  for (let t = 0; t < 12; t++) { tick(F); tick(CL); }
  check("crossing: save → load → 12 ticks with two crossings in the city hash-equals", stateHash(F) === stateHash(CL), `${stateHash(F)} vs ${stateHash(CL)}`);
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
  const { storyTick } = await import("../js/sim/story.js");
  const storyFlash = storyTick(C);
  const hundred = C.events.log.find((e) => e.t === C.tick && e.id === `story-centenary:${old.id}`);
  check("events: the centenary has ONE writer in storyTick and reaches the reader without flashing",
    !!hundred && /CENTENARY.*ONE HUNDRED/.test(hundred.line) && hundred.who?.[0] === old.id
      && !cRes.some((l) => /ONE HUNDRED/.test(l)) && storyFlash.length === 0,
    hundred?.line || "no centenary row");
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

// ---- Part M': road access, one standard (SPEC §6c; plan §4-R) ---------------
//
// The owner: "as long as a tile is within 1-3 tiles of the road it has road
// access"; "the 6x6 squares have roads around the whole perimeter, so nothing
// is more than 3 tiles away"; "i want that rule standardized, including rail
// and warehouses, and zoos"; "the other way to think about it is that all
// sides have access points."
//
// Four things are pinned here. THE STANDARD: one predicate, `fields.served`,
// asking the whole FOOTPRINT — so a lot, a block, a zoo, a hall and a
// platform are asked the same question, and nothing in js/sim asks a
// different one. ALL SIDES: `doorSearch` returns every road tile at the
// site's distance, and a citizen leaves by whichever of them its work is on.
// THE PLATFORM: a station is served like a lot, and the forecourt between it
// and its door is laid into the path tile by tile, so it costs a walk and
// reads as one. AND THE FIELD IS SEEN: the access overlay paints the number
// the rule reads (not the tile's own), and the card says it in words.
{
  const { TERRAIN, siteTiles, zooAnchorOf } = await import("../js/sim/world.js");
  const FI = await import("../js/sim/fields.js");
  const { served: sv, siteRoadDist, doorsOf: doors, doorSearch, nearestRoad, commutePath, computeRoadDist, computeStationDoors, asksAccess, passable, WALK, RIDE, TILE, rides: ridesPath } = FI;
  const { lotScore, lotReport, REASON } = await import("../js/sim/lots.js");
  const BL = await import("../js/sim/blocks.js");
  const { createHousehold, placeHousehold, recountRosters: _rr } = await import("../js/sim/citizens.js");
  const { recountRosters } = FI;

  // ---- the rig: a cleared field with ONE road across the top ---------------
  const F = createWorld({ seed: "access" });
  const at = (x, y) => y * F.w + x;
  const xy = (t) => `(${t % F.w},${(t / F.w) | 0})`;
  for (let y = 2; y <= 26; y++) for (let x = 2; x <= 40; x++) {
    const i = at(x, y);
    F.terrain[i] = TERRAIN.GRASS; F.road[i] = ROAD.NONE; F.zone[i] = ZONE.NONE;
    F.tier[i] = 0; F.wall[i] = 0; F.rail[i] = 0; F.civic[i] = 0; F.big[i] = 0; F.use[i] = 0;
  }
  F.events.noDisasters = true;
  const north = [];
  for (let x = 4; x <= 34; x++) north.push(at(x, 6));
  apply(F, { kind: "road", tiles: north });
  computeFields(F);
  const clone = () => load(save(F));

  // ---- the ladder: 1, 2, 3 and out of reach --------------------------------
  const ladder = [1, 2, 3, 4].map((d) => at(10, 6 + d));
  check("access: the distance is the plain one the owner said — one, two and three tiles from the road are served, four is not",
    ladder.every((i, k) => F.roadDist[i] === Math.min(KNOBS.ROAD_REACH + 1, k + 1)) && sv(F, ladder[0]) && sv(F, ladder[1]) && sv(F, ladder[2]) && !sv(F, ladder[3]),
    ladder.map((i, k) => `${k + 1}:${F.roadDist[i]}${sv(F, i) ? "y" : "n"}`).join(" "));
  check("access: the field and the search are ONE number — the depth the door search stops at equals the site's road distance, and having a door at all IS being served, on every tile of the rig",
    (() => {
      const scratch = new Uint8Array(F.w * F.h);
      let bad = 0;
      for (let i = 0; i < F.w * F.h; i++) {
        const s = doorSearch(F, i, scratch);
        if (Math.min(KNOBS.ROAD_REACH + 1, s.d) !== siteRoadDist(F, i)) bad++;
        if ((s.doors.length > 0) !== sv(F, i)) bad++;
      }
      return bad === 0;
    })(), "the two derivations disagree somewhere");
  const far = ladder[3];
  const nr = nearestRoad(F, far);
  check("access: a lot out of reach is told how far the road really IS — the reader's next question, asked by the card and by no rule",
    !sv(F, far) && nr.d === 4 && nr.doors.length === 1 && nr.doors[0] === at(10, 6) && nearestRoad(F, at(10, 20)).d === 9,
    `${nr.d} at ${nr.doors.map(xy).join(" ")}`);
  check("access: and every door is a door — one road above the ladder gives one, and a lot with nothing in reach has none",
    doors(F, ladder[0]).length === 1 && doors(F, ladder[0])[0] === at(10, 6) && doors(F, far).length === 0);

  // ---- ALL SIDES -----------------------------------------------------------
  {
    const T = clone();
    const tat = (x, y) => y * T.w + x;
    const south = [];
    for (let x = 4; x <= 34; x++) south.push(tat(x, 10));
    apply(T, { kind: "road", tiles: south });
    computeFields(T);
    const between = tat(16, 8);
    check("access: all sides are access points — a lot with a road two tiles north and two tiles south has BOTH as doors, ascending",
      doors(T, between).length === 2 && doors(T, between)[0] === tat(16, 6) && doors(T, between)[1] === tat(16, 10),
      doors(T, between).map(xy).join(" "));
    const wall = [];
    for (let x = 14; x <= 18; x++) wall.push(tat(x, 7));
    apply(T, { kind: "wall", tiles: wall });
    computeFields(T);
    const shut = doors(T, between).length === 1 && doors(T, between)[0] === tat(16, 10);
    apply(T, { kind: "road", tiles: [tat(16, 7)] });
    computeFields(T);
    const tunnel = doors(T, between).length === 1 && doors(T, between)[0] === tat(16, 7) && T.wall[tat(16, 7)] === 1 && siteRoadDist(T, between) === 1;
    check("access: a bare wall is not a way to a road — walling the gap takes the north door away; a road THROUGH the wall is a tunnel, and the tunnel itself becomes the door",
      shut && tunnel, `shut ${shut} · tunnel ${tunnel} · ${doors(T, between).map(xy).join(" ")}`);
    // The agreement sweep again, now that there ARE walls. computeRoadDist
    // refuses to ENTER a barrier; the door search would happily START inside
    // one and walk out, and the two would report different numbers for the
    // same sealed tile. A wall is not a way out of itself.
    apply(T, { kind: "wall", tiles: [tat(24, 8), tat(24, 9), tat(25, 8), tat(25, 9)] });
    computeFields(T);
    check("access: and the field and the search still agree WITH walls on the map — including a tile sealed inside one, which has no door and no distance",
      (() => {
        const scratch = new Uint8Array(T.w * T.h);
        let bad = 0;
        let sealed = 0;
        for (let i = 0; i < T.w * T.h; i++) {
          const found = doorSearch(T, i, scratch);
          if (Math.min(KNOBS.ROAD_REACH + 1, found.d) !== siteRoadDist(T, i)) bad++;
          if ((found.doors.length > 0) !== sv(T, i)) bad++;
          if (T.wall[i] && T.road[i] === ROAD.NONE && !found.doors.length) sealed++;
        }
        return bad === 0 && sealed >= 4;
      })(), "the two derivations disagree somewhere, or no tile was sealed");
  }

  // ---- THE FOOTPRINT: a block is asked once, about the whole of it ----------
  {
    const G = clone();
    const gat = (x, y) => y * G.w + x;
    apply(G, { kind: "zone", zone: ZONE.R, x0: 22, y0: 8, x1: 24, y1: 10, density: 3 });
    for (let y = 8; y <= 10; y++) for (let x = 22; x <= 24; x++) G.tier[gat(x, y)] = 3;
    computeFields(G);
    const anchor = gat(22, 8);
    const corner = gat(24, 10);
    const lone = [G.roadDist[anchor], G.roadDist[corner], sv(G, corner)];
    const tiles = [];
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) tiles.push(anchor + dx + dy * G.w);
    BL.mergeLots(G, { side: 3, anchor, tiles });
    check("access: a BLOCK is one building, asked once — every tile of a 3×3 reads the distance of its nearest corner, so a tile the ladder refuses is served because the building is",
      lone[0] === 2 && lone[1] === KNOBS.ROAD_REACH + 1 && lone[2] === false
        && siteTiles(G, corner).length === 9 && siteRoadDist(G, corner) === 2 && siteRoadDist(G, anchor) === 2 && sv(G, corner),
      `alone ${lone[0]}/${lone[1]} · as a block ${siteRoadDist(G, corner)} · its own tile still ${G.roadDist[corner]}`);
    check("access: and the doors are the block's — a 3×3 under a road is entered by three ways in, one per tile of the side it touches",
      doors(G, corner).length === 3 && doors(G, corner).every((t) => G.road[t] !== ROAD.NONE && ((t / G.w) | 0) === 6),
      doors(G, corner).map(xy).join(" "));
    // A SPLIT changes the doors back, so it has to re-plan too. Merging was
    // caught by the save/load law; splitting was not, because the suite's
    // scripted city never splits a block whose people commute.
    //
    // THE FIRST DRAFT OF THIS CHECK WAS A LIE: it read
    // `commuters.length === 0 || ...`, and this rig has no citizens, so the
    // whole assertion short-circuited to true and the mutant walked straight
    // through it. A guard that can never be false is not a check. So the
    // block is given real households, real jobs and real paths first, and
    // their number is asserted before anything else.
    recountRosters(G);
    for (let k = 0; k < 3; k++) placeHousehold(G, createHousehold(G, "cat", 4), anchor);
    const onBlock = G.citizens.filter((c) => !c.dead && c.home === anchor);
    for (const c of onBlock) { c.job = anchor; c.path = Uint16Array.from([gat(22, 6)]); c.stale = false; }
    // WHEN THE FOOTPRINT RULE ACTUALLY BITES. It cannot bite at growth time:
    // `joinable` requires every lot of a window to be served on its own, so a
    // block is never built across the line. It bites when a road is TAKEN
    // AWAY - the building still has a door on the side that is left, and it
    // keeps it, while a lone lot at the same distance loses everything. This
    // is the reachable case, and the hand-built block above is only the rule
    // in its shortest form.
    {
      const RD = load(save(G));
      const rat = (x, y) => y * RD.w + x;
      apply(RD, { kind: "zone", zone: ZONE.R, x0: 26, y0: 9, x1: 26, y1: 9, density: 3 });
      RD.tier[rat(26, 9)] = 3;
      computeFields(RD);
      const bothServed = sv(RD, rat(24, 10)) && sv(RD, rat(26, 9));
      // Take away all of the road but the six tiles above the block's own top row.
      apply(RD, { kind: "bulldoze", x0: 25, y0: 6, x1: 34, y1: 6, what: "road" });
      apply(RD, { kind: "bulldoze", x0: 4, y0: 6, x1: 21, y1: 6, what: "road" });
      computeFields(RD);
      check("access: and this is when asking the WHOLE footprint bites — a block never forms across the line, but when the road goes the building keeps the door it has left, and a lone lot at the very same distance loses everything",
        bothServed && sv(RD, rat(24, 10)) && siteRoadDist(RD, rat(24, 10)) === 2 && RD.roadDist[rat(24, 10)] > KNOBS.ROAD_REACH
          && !sv(RD, rat(26, 9)) && lotScore(RD, rat(26, 9)).reason === REASON.NO_ROAD,
        `the block ${siteRoadDist(RD, rat(24, 10))} (its own tile ${RD.roadDist[rat(24, 10)]}) · the lone lot ${siteRoadDist(RD, rat(26, 9))} (${lotScore(RD, rat(26, 9)).reason})`);
    }
    BL.splitLot(G, anchor, { evict: false });
    check("access: and a SPLIT re-plans as a merge does — the block's people are handed back the doors of a lot, so every one of them searches again",
      onBlock.length >= 12 && onBlock.every((c) => c.stale === true && c.path === null),
      `${onBlock.length} on the block · ${onBlock.filter((c) => c.stale && c.path === null).length} re-planned`);
    check("access: when the block comes apart the far lot is refused again — nothing about access is remembered; it is derived from the shape that is there",
      siteTiles(G, corner).length === 1 && !sv(G, corner) && sv(G, anchor),
      `${siteRoadDist(G, corner)}`);
  }

  // ---- the citizen leaves by the side its work is on ------------------------
  {
    const C = clone();
    const cat = (x, y) => y * C.w + x;
    const south = [];
    for (let x = 4; x <= 34; x++) south.push(cat(x, 10));
    const link = [];
    for (let y = 6; y <= 10; y++) link.push(cat(8, y)); // the two roads meet HERE and nowhere else, west of the home: the long way round is 14 steps, inside COMMUTE_MAX and half again the short one
    apply(C, { kind: "road", tiles: south });
    apply(C, { kind: "road", tiles: link }); // the two roads meet only far to the east
    apply(C, { kind: "zone", zone: ZONE.R, x0: 16, y0: 8, x1: 16, y1: 8, density: 3 });
    apply(C, { kind: "zone", zone: ZONE.C, x0: 6, y0: 5, x1: 6, y1: 5, density: 3 });
    apply(C, { kind: "zone", zone: ZONE.C, x0: 6, y0: 11, x1: 6, y1: 11, density: 3 });
    computeFields(C);
    const home = cat(16, 8);
    const toN = commutePath(C, "rabbit", doors(C, home), doors(C, cat(6, 5)));
    const toS = commutePath(C, "rabbit", doors(C, home), doors(C, cat(6, 11)));
    check("access: a citizen leaves by whichever side its work is on — one home with two doors, two jobs, two different first tiles, each the near one",
      doors(C, home).length === 2 && !!toN && !!toS
        && (toN.path[0] & TILE) === cat(16, 6) && (toS.path[0] & TILE) === cat(16, 10) && toN.cost === toS.cost,
      `north starts ${toN ? xy(toN.path[0] & TILE) : "—"} · south starts ${toS ? xy(toS.path[0] & TILE) : "—"}`);
    apply(C, { kind: "bulldoze", x0: 12, y0: 10, x1: 19, y1: 10, what: "road" }); // the south road under the home, and only that
    computeFields(C);
    const after = commutePath(C, "rabbit", doors(C, home), doors(C, cat(6, 11)));
    check("access: take that side's road away and the same journey leaves by the other door, the long way round — a door is where a road IS, never a fact about the lot",
      doors(C, home).length === 1 && doors(C, home)[0] === cat(16, 6) && !!after && (after.path[0] & TILE) === cat(16, 6) && after.cost > toS.cost,
      `${after ? `${xy(after.path[0] & TILE)} at ${after.cost}` : "no way"} vs ${toS.cost}`);
  }

  // ---- THE PLATFORM ---------------------------------------------------------
  {
    const S = clone();
    const sat = (x, y) => y * S.w + x;
    const line = [];
    for (let x = 6; x <= 32; x++) line.push(sat(x, 9)); // three tiles south of the road
    const rl = apply(S, { kind: "rail", tiles: line });
    const p1 = apply(S, { kind: "station", tx: 8, ty: 9 });
    const p2 = apply(S, { kind: "station", tx: 30, ty: 9 });
    computeFields(S);
    const plat = sat(8, 9);
    check("access: a PLATFORM is served like a lot — three tiles from the road is a door, and it is the road tile straight above it",
      rl.ok && p1.ok && p2.ok && siteRoadDist(S, plat) === 3 && doors(S, plat).length === 1 && doors(S, plat)[0] === sat(8, 6),
      `${siteRoadDist(S, plat)} · ${doors(S, plat).map(xy).join(" ")}`);
    const ride = commutePath(S, "rabbit", [sat(6, 6)], [sat(32, 6)]);
    const walkOnly = 26 * WALK;
    check("access: and the ride is taken — until now the walk layer stepped onto a platform only from a tile ORTHOGONALLY beside it, so a line three tiles off the road carried nobody",
      !!ride && ridesPath(ride.path) && ride.cost < walkOnly, `cost ${ride && ride.cost} vs the walk ${walkOnly}`);
    const tiles = ride ? Array.from(ride.path, (p) => p & TILE) : [];
    let jumps = 0;
    for (let k = 1; k < tiles.length; k++) {
      const dx = Math.abs((tiles[k] % S.w) - (tiles[k - 1] % S.w));
      const dy = Math.abs(((tiles[k] / S.w) | 0) - ((tiles[k - 1] / S.w) | 0));
      if (dx + dy !== 1) jumps++;
    }
    const forecourt = tiles.filter((t) => S.road[t] === ROAD.NONE && S.rail[t] === 0);
    check("access: the forecourt is WALKED — the gap is laid into the path tile by tile, so no two entries of any commute are further apart than one step, and the four grass tiles crossed are in it",
      !!ride && jumps === 0 && forecourt.length === 4 && forecourt.every((t) => S.zone[t] === ZONE.NONE),
      `${jumps} jumps · forecourt ${forecourt.map(xy).join(" ")}`);
    // Priced DIFFERENTIALLY: the same line one tile from the road instead of
    // three. Two tiles of forecourt at each end disappear, and the journey has
    // to get exactly four walk steps shorter - which is the only way to show
    // the gap is charged per tile rather than as one free hop.
    const S1 = clone();
    const s1at = (x, y) => y * S1.w + x;
    const near = [];
    for (let x = 6; x <= 32; x++) near.push(s1at(x, 7));
    apply(S1, { kind: "rail", tiles: near });
    apply(S1, { kind: "station", tx: 8, ty: 7 });
    apply(S1, { kind: "station", tx: 30, ty: 7 });
    computeFields(S1);
    const ride1 = commutePath(S1, "rabbit", [s1at(6, 6)], [s1at(32, 6)]);
    check("access: and it is priced as a walk — move the line from three tiles off the road to one and the same journey loses exactly four steps, two at each end",
      !!ride && !!ride1 && Math.abs(commuteTime(ride.path) - commuteTime(ride1.path) - 4) < 1e-9
        && Math.abs(commuteTime(ride.path) - (10 + 22 * KNOBS.RAIL_COST / WALK)) < 1e-9,
      `three tiles off ${ride && commuteTime(ride.path)} · one tile off ${ride1 && commuteTime(ride1.path)}`);
    const D = load(save(S));
    const dat = (x, y) => y * D.w + x;
    apply(D, { kind: "bulldoze", x0: 4, y0: 6, x1: 34, y1: 6, what: "road" });
    const moved = [];
    for (let x = 4; x <= 34; x++) moved.push(dat(x, 5)); // now four tiles from the line
    apply(D, { kind: "road", tiles: moved });
    computeFields(D);
    const noRide = commutePath(D, "rabbit", [dat(6, 5)], [dat(32, 5)]);
    check("access: a platform four tiles from the road is not a door — the number that refuses a lot refuses a station, and the line falls silent",
      siteRoadDist(D, dat(8, 9)) === KNOBS.ROAD_REACH + 1 && doors(D, dat(8, 9)).length === 0 && !!noRide && !ridesPath(noRide.path),
      `${siteRoadDist(D, dat(8, 9))}`);
    // The player's line ACROSS a forecourt. Those tiles are not roads, so the
    // link could easily have been priced as one flat walk a tile; then a
    // rabbit would route straight over predator-only ground for free and be
    // arrested for it, because fields.exposure reads the stored path and DOES
    // count them. The edge is priced with stepCost, per tile, per species.
    const L2 = load(save(S));
    const l2 = (x, y) => y * L2.w + x;
    apply(L2, { kind: "zone", zone: ZONE.R, x0: 8, y0: 7, x1: 8, y1: 8, density: 3 });
    const plain = commutePath(L2, "rabbit", [l2(6, 6)], [l2(32, 6)]);
    apply(L2, { kind: "use", use: 1, x0: 8, y0: 7, x1: 8, y1: 8 }); // predator-only
    computeFields(L2);
    const rabbit = commutePath(L2, "rabbit", [l2(6, 6)], [l2(32, 6)]);
    const foxReal = commutePath(L2, "fox", [l2(6, 6)], [l2(32, 6)]);
    check("access: the player's line runs across a forecourt too — the gap is priced a tile at a time and by WHO is crossing, so a rabbit pays the trespass to reach that platform and a fox does not",
      L2.use[l2(8, 7)] === 1 && !!plain && !!rabbit && !!foxReal
        && foxReal.cost === plain.cost && rabbit.cost > plain.cost,
      `unpainted ${plain && plain.cost} · rabbit ${rabbit && rabbit.cost} · fox ${foxReal && foxReal.cost}`);
    // The whole ladder, one line per distance: the plan asks for two tiles as
    // well as three, and one is the case that must NOT move.
    const ladderRows = [1, 2, 3, 4].map((gap) => {
      const P2 = clone();
      const p2 = (x, y) => y * P2.w + x;
      const track = [];
      for (let x = 6; x <= 32; x++) track.push(p2(x, 6 + gap));
      apply(P2, { kind: "rail", tiles: track });
      apply(P2, { kind: "station", tx: 8, ty: 6 + gap });
      apply(P2, { kind: "station", tx: 30, ty: 6 + gap });
      computeFields(P2);
      const plat = p2(8, 6 + gap);
      const trip = commutePath(P2, "rabbit", [p2(6, 6)], [p2(32, 6)]);
      return { gap, d: siteRoadDist(P2, plat), doors: doors(P2, plat).length, rode: !!trip && ridesPath(trip.path), time: trip ? commuteTime(trip.path) : null };
    });
    check("access: the station ladder — one, two and three tiles from the road all carry the line, four does not, and each tile of forecourt costs the journey two more steps (one at each end)",
      ladderRows.every((r) => r.d === Math.min(KNOBS.ROAD_REACH + 1, r.gap))
        && ladderRows.slice(0, 3).every((r) => r.doors === 1 && r.rode)
        && ladderRows[3].doors === 0 && ladderRows[3].rode === false
        && Math.abs(ladderRows[1].time - ladderRows[0].time - 2) < 1e-9
        && Math.abs(ladderRows[2].time - ladderRows[1].time - 2) < 1e-9,
      ladderRows.map((r) => `${r.gap}:${r.d}/${r.doors}${r.rode ? "R" : "-"}${r.time == null ? "" : "@" + r.time.toFixed(1)}`).join(" "));
    // A FORECOURT IS WALKED, so it has to be ground. `doorSearch`'s default
    // expands through anything a bare wall does not block, which is right for
    // a lot (nobody walks that gap; the animal appears at the door) and wrong
    // for a platform, whose every forecourt tile goes into the stored path and
    // is drawn under a walker. Before this the same rig sent a rabbit through
    // a neighbour's house and across a river on foot, and called the platform
    // served for doing it. Its own world, built from nothing: this fixture
    // wants water and a standing building, and inheriting either from the rig
    // would make the geometry a thing to remember rather than to read.
    const R2 = createWorld({ seed: "forecourt" });
    const rr = (x, y) => y * R2.w + x;
    for (let y = 2; y <= 20; y++) for (let x = 2; x <= 40; x++) {
      const i = rr(x, y);
      R2.terrain[i] = TERRAIN.GRASS; R2.road[i] = ROAD.NONE; R2.zone[i] = ZONE.NONE;
      R2.tier[i] = 0; R2.wall[i] = 0; R2.rail[i] = 0; R2.civic[i] = 0; R2.big[i] = 0; R2.use[i] = 0;
    }
    R2.events.noDisasters = true;
    const rroad = [];
    for (let x = 4; x <= 34; x++) rroad.push(rr(x, 6));
    apply(R2, { kind: "road", tiles: rroad });
    for (let x = 6; x <= 11; x++) R2.terrain[rr(x, 8)] = TERRAIN.WATER;     // a river in the first gap
    apply(R2, { kind: "zone", zone: ZONE.R, x0: 13, y0: 7, x1: 15, y1: 8, density: 3 });
    for (let x = 13; x <= 15; x++) { R2.tier[rr(x, 7)] = 3; R2.tier[rr(x, 8)] = 3; } // a terrace in the second
    const rline = [];
    for (let x = 6; x <= 32; x++) rline.push(rr(x, 9));
    const rl2 = apply(R2, { kind: "rail", tiles: rline });
    const pw = apply(R2, { kind: "station", tx: 8, ty: 9 });   // its only approach crosses the river
    const ph = apply(R2, { kind: "station", tx: 14, ty: 9 });  // its only approach crosses the houses
    const pc = apply(R2, { kind: "station", tx: 18, ty: 9 });  // clear grass
    const pc2 = apply(R2, { kind: "station", tx: 30, ty: 9 }); // and one to ride to, or nothing would board
    R2.roadsDirty = true;
    computeFields(R2);
    const trip2 = commutePath(R2, "rabbit", [rr(16, 6)], [rr(32, 6)]);
    const impassable = trip2 ? Array.from(trip2.path).filter((e) => !(e & RIDE)).map((e) => e & TILE)
      .filter((t) => R2.road[t] === ROAD.NONE && R2.rail[t] === 0 && !passable(R2, t)) : [];
    check("access: a forecourt is GROUND — a platform whose only approach crosses a river or a terrace of houses is refused, and has no doors to list; the one on clear grass is served with one; and the commute that rides walks no tile a citizen could not stand on",
      rl2.ok && pw.ok && ph.ok && pc.ok && pc2.ok
        && R2.rail[rr(8, 9)] === 2 && R2.rail[rr(14, 9)] === 2 && R2.rail[rr(18, 9)] === 2
        && siteRoadDist(R2, rr(8, 9)) > KNOBS.ROAD_REACH && !sv(R2, rr(8, 9)) && doors(R2, rr(8, 9)).length === 0
        && siteRoadDist(R2, rr(14, 9)) > KNOBS.ROAD_REACH && !sv(R2, rr(14, 9)) && doors(R2, rr(14, 9)).length === 0
        && siteRoadDist(R2, rr(18, 9)) === 3 && sv(R2, rr(18, 9)) && doors(R2, rr(18, 9)).length === 1
        && !!trip2 && ridesPath(trip2.path) && impassable.length === 0,
      `river ${siteRoadDist(R2, rr(8, 9))}/${doors(R2, rr(8, 9)).length} · houses ${siteRoadDist(R2, rr(14, 9))}/${doors(R2, rr(14, 9)).length} · grass ${siteRoadDist(R2, rr(18, 9))}/${doors(R2, rr(18, 9)).length} · rode ${trip2 && ridesPath(trip2.path)} · impassable ${impassable.length}`);
    // The list itself, one row per ruling, so it is a decision that can fail
    // rather than a comment that cannot.
    {
      const G2 = load(save(R2));
      const g2 = (x, y) => y * G2.w + x;
      const rows = [];
      const say = (name, x, y, want) => rows.push({ name, got: passable(G2, g2(x, y)), want });
      G2.terrain[g2(40, 12)] = TERRAIN.TREE;                                   say("a tree", 40, 12, true);
      G2.rubble[g2(41, 12)] = 6;                                               say("rubble", 41, 12, true);
      G2.flooded[g2(42, 12)] = 1;                                              say("a flood", 42, 12, true);
      apply(G2, { kind: "park", tx: 43, ty: 12 });                             say("a park", 43, 12, true);
      apply(G2, { kind: "zone", zone: ZONE.R, x0: 44, y0: 12, x1: 44, y1: 12, density: 3 }); say("chalk, unbuilt", 44, 12, true);
      G2.tier[g2(44, 12)] = 1;                                                 say("a building", 44, 12, false);
      G2.burning[g2(44, 12)] = 2;                                              say("a building alight", 44, 12, false);
      apply(G2, { kind: "police", tx: 45, ty: 12 });                           say("a police station", 45, 12, false);
      apply(G2, { kind: "wall", tiles: [g2(46, 12)] });                        say("a bare wall", 46, 12, false);
      apply(G2, { kind: "road", tiles: [g2(46, 12)] });                        say("a tunnel through it", 46, 12, true);
      G2.terrain[g2(47, 12)] = TERRAIN.WATER;                                  say("open water", 47, 12, false);
      apply(G2, { kind: "road", tiles: [g2(47, 12)] });                        say("a bridge over it", 47, 12, true);
      apply(G2, { kind: "rail", tiles: [g2(48, 12), g2(49, 12)] });            say("plain track", 48, 12, true);
      apply(G2, { kind: "station", tx: 48, ty: 12 });                          say("a platform", 48, 12, true);
      const wrong = rows.filter((r) => r.got !== r.want);
      check("access: what a citizen may cross, one row per ruling — trees, rubble, a flood, a park, bare chalk, plain track and a platform yes; a building (alight or not), a civic that is not a park, and open water no; and a tunnel or a bridge is a way, not a wall",
        wrong.length === 0 && rows.length === 14, wrong.map((r) => `${r.name}: ${r.got}, wanted ${r.want}`).join(" · ") || `${rows.length} rulings`);
    }
    check("access: and a park is not a building — the one civic a citizen may walk across leaves the forecourt open",
      (() => {
        const P3 = load(save(R2));
        const p3 = (x, y) => y * P3.w + x;
        apply(P3, { kind: "bulldoze", x0: 13, y0: 7, x1: 15, y1: 8, what: "building" });
        for (let x = 13; x <= 15; x++) { apply(P3, { kind: "park", tx: x, ty: 7 }); apply(P3, { kind: "park", tx: x, ty: 8 }); }
        computeFields(P3);
        return P3.civic[p3(14, 7)] === CIVIC.PARK && sv(P3, p3(14, 9)) && doors(P3, p3(14, 9)).length === 1;
      })());

    // The DOOR's own step. The link lands on the door tile, and that landing
    // has to be priced like any other step onto a road — a forecourt painted
    // against a species proves the chain is priced, and only a painted DOOR
    // proves the landing is.
    const L3 = load(save(S));
    const l3 = (x, y) => y * L3.w + x;
    const before = commutePath(L3, "rabbit", [l3(6, 6)], [l3(32, 6)]);
    apply(L3, { kind: "use", use: 1, x0: 30, y0: 6, x1: 30, y1: 6 }); // the ARRIVAL door, predator-only
    computeFields(L3);
    const rabbit3 = commutePath(L3, "rabbit", [l3(6, 6)], [l3(32, 6)]);
    const fox3 = commutePath(L3, "fox", [l3(6, 6)], [l3(32, 6)]);
    check("access: and the DOOR the link lands on is priced too — paint the arrival door predator-only and the rabbit pays the trespass to get off the train; the fox does not",
      L3.use[l3(30, 6)] === 1 && !!before && !!rabbit3 && !!fox3
        && fox3.cost === before.cost && rabbit3.cost > before.cost,
      `plain ${before && before.cost} · rabbit ${rabbit3 && rabbit3.cost} · fox ${fox3 && fox3.cost}`);
    const B2 = load(save(S));
    const b2 = (x, y) => y * B2.w + x;
    apply(B2, { kind: "wall", tiles: [b2(7, 8), b2(8, 8), b2(9, 8), b2(7, 7), b2(8, 7), b2(9, 7)] });
    computeFields(B2);
    check("access: a wall across the forecourt shuts that platform and only that one — reach goes ROUND a wall, and here there is no way round",
      doors(B2, b2(8, 9)).length === 0 && doors(B2, b2(30, 9)).length === 1,
      `${doors(B2, b2(8, 9)).length} doors at the walled one`);
  }

  // ---- the strongest gate in the repo, pointed at the new thing -------------
  {
    // save -> load -> continue is what caught the merge that did not re-plan.
    // It has never been asked of a town whose commuters cross a FORECOURT:
    // those tiles are in the stored path, and a reload rebuilds every path
    // from scratch through the same link chains. If `computeStationDoors`
    // rebuilt them in a different order, or `nodePath` spliced a different
    // chain, this is where it shows.
    const T2 = createWorld({ seed: "forecourt-load" });
    const t2 = (x, y) => y * T2.w + x;
    for (let y = 2; y <= 34; y++) for (let x = 2; x <= 56; x++) {
      const i = t2(x, y);
      T2.terrain[i] = TERRAIN.GRASS; T2.road[i] = ROAD.NONE; T2.zone[i] = ZONE.NONE;
      T2.tier[i] = 0; T2.wall[i] = 0; T2.rail[i] = 0; T2.civic[i] = 0; T2.big[i] = 0;
    }
    T2.cash = 600000;
    T2.events.noDisasters = true;
    const av = [];
    for (const y of [6, 18]) for (let x = 4; x <= 54; x++) av.push(t2(x, y));
    for (let y = 6; y <= 18; y++) av.push(t2(4, y));
    apply(T2, { kind: "road", tiles: av });
    apply(T2, { kind: "zone", zone: ZONE.R, x0: 6, y0: 7, x1: 20, y1: 9, density: 3 });   // the homes at one end
    apply(T2, { kind: "zone", zone: ZONE.C, x0: 38, y0: 19, x1: 52, y1: 21, density: 3 }); // and the work at the other
    apply(T2, { kind: "zone", zone: ZONE.I, x0: 38, y0: 22, x1: 52, y1: 24, density: 3 });
    const tline = [];
    for (let x = 8; x <= 50; x++) tline.push(t2(x, 15)); // three tiles north of the second avenue
    apply(T2, { kind: "rail", tiles: tline });
    apply(T2, { kind: "station", tx: 10, ty: 15 });
    apply(T2, { kind: "station", tx: 48, ty: 15 });
    for (let k = 0; k < 15 * 12; k++) tick(T2);
    // Guarantee route users independently of a changing economic population.
    const {createHousehold,placeHousehold,replanStale} = await import("../js/sim/citizens.js");
    const home=t2(10,19), work=t2(50,17);
    T2.zone[home]=ZONE.R; T2.tier[home]=3;
    T2.zone[work]=ZONE.C; T2.tier[work]=3;
    const commuters=createHousehold(T2,"fox",12); placeHousehold(T2,commuters,home);
    for(const id of commuters.members) {
      const c=T2.byId.get(id); c.born=T2.tick-30*12; c.deathAge=99999;
      c.job=work; T2.staff[work]++; c.stale=true;
    }
    computeFields(T2); replanStale(T2);
    let crossing = 0;
    for (const c of T2.citizens) {
      if (c.dead || !c.path) continue;
      for (let k = 0; k < c.path.length; k++) {
        const t = c.path[k] & TILE;
        if (!(c.path[k] & RIDE) && T2.road[t] === ROAD.NONE && T2.rail[t] !== 2) { crossing++; break; }
      }
    }
    const T3 = load(save(T2));
    const same = stateHash(T2) === stateHash(T3);
    let paths = 0;
    const byId = new Map(T3.citizens.map((c) => [c.id, c]));
    for (const c of T2.citizens) {
      const d = byId.get(c.id);
      if (!d) continue;
      const a = c.path ? Array.from(c.path).join(",") : "-";
      const b = d.path ? Array.from(d.path).join(",") : "-";
      if (a !== b) paths++;
    }
    for (let k = 0; k < 24; k++) { tick(T2); tick(T3); }
    check("access: save → load → two more years on a town whose animals CROSS FORECOURTS — the tiles between a platform and its door are in the stored path, and a reload rebuilds every one of them the same way",
      crossing >= 10 && same && paths === 0 && stateHash(T2) === stateHash(T3),
      `${crossing} commutes cross a forecourt · ${paths} paths differ at the save · ${stateHash(T2)} vs ${stateHash(T3)}`);
  }

  // ---- the ground under a forecourt MOVES ----------------------------------
  {
    // The second hostile review's find, and the worst of the session: a
    // building grown across a forecourt, or a wall dropped on one, closes a
    // way stored commutes are already walking. Neither goes through the
    // road/wall/rail branch of ops.apply that invalidates paths, so a straight
    // run kept the stale commutes while a reload re-planned, and the two
    // parted company a month later - hidden at first, because `c.path` is not
    // in the saved citizen and the hash could not see it.
    //
    // THE RIG MAKES RIDING NECESSARY, NOT ATTRACTIVE. Two road systems that
    // never touch, and one line across the gap: every commute from the homes
    // to the work must ride, and every rider crosses a forecourt. A first
    // draft put both halves on one road and hoped riding would win - it did on
    // ONE seed of four, which is a bet, not a rig.
    const townOf = (seed) => {
      const W2 = createWorld({ seed });
      const ww = (x, y) => y * W2.w + x;
      for (let y = 2; y <= 34; y++) for (let x = 2; x <= 56; x++) {
        const i = ww(x, y);
        W2.terrain[i] = TERRAIN.GRASS; W2.road[i] = ROAD.NONE; W2.zone[i] = ZONE.NONE;
        W2.tier[i] = 0; W2.wall[i] = 0; W2.rail[i] = 0; W2.civic[i] = 0; W2.big[i] = 0;
      }
      W2.cash = 600000;
      W2.events.noDisasters = true;
      const av = [];
      for (const y of [6, 26]) for (let x = 4; x <= 54; x++) av.push(ww(x, y));
      apply(W2, { kind: "road", tiles: av });
      const ln = [];
      for (let y = 9; y <= 23; y++) ln.push(ww(30, y));
      apply(W2, { kind: "rail", tiles: ln });
      apply(W2, { kind: "station", tx: 30, ty: 9 });   // three tiles below the north road
      apply(W2, { kind: "station", tx: 30, ty: 23 });  // three tiles above the south road
      for (const [x0, x1] of [[20, 28], [32, 40]]) {
        apply(W2, { kind: "zone", zone: ZONE.R, x0, y0: 7, x1, y1: 8, density: 3 });
        apply(W2, { kind: "zone", zone: x0 === 20 ? ZONE.C : ZONE.I, x0, y0: 24, x1, y1: 25, density: 3 });
      }
      for (let k = 0; k < 15 * 12; k++) tick(W2);
      return { W2, ww };
    };
    const crossers = (w) => {
      let n = 0;
      for (const c of w.citizens) {
        if (c.dead || !c.path) continue;
        for (let k = 0; k < c.path.length; k++) {
          const t = c.path[k] & TILE;
          if (!(c.path[k] & RIDE) && w.road[t] === ROAD.NONE && w.rail[t] !== 2) { n++; break; }
        }
      }
      return n;
    };
    const throughWalls = (w) => {
      let n = 0;
      for (const c of w.citizens) {
        if (c.dead || !c.path) continue;
        for (let k = 0; k < c.path.length; k++) {
          const t = c.path[k] & TILE;
          if (!(c.path[k] & RIDE) && w.road[t] === ROAD.NONE && w.rail[t] !== 2 && !passable(w, t)) { n++; break; }
        }
      }
      return n;
    };
    const town = townOf("forecourt-moves");
    const before = crossers(town.W2);

    // (a) AN OP: a wall dropped on the forecourt the riders cross.
    const A2 = load(save(town.W2));
    const a2 = town.ww;
    const rp = apply(A2, { kind: "wall", tiles: [a2(30, 8)] });
    // MEASURED BEFORE THE TICK, because "in the same breath" is the claim and
    // ops.apply is who has to keep it. This line used to come after the tick
    // below, and the tick settles the doors itself - so the check was watching
    // the wrong half of the fix, and deleting the op-time settle left it green
    // with 317 animals walking through a wall.
    const stillWalking = throughWalls(A2);
    // One month, so the straight run's stale pass has re-planned before the
    // save. Saving in the SAME month as any path-invalidating op has diverged
    // since long before this part - a road edit does it too, measured on
    // 411d903 - and that hole is in the BACKLOG, not this check's business.
    tick(A2);
    const A3 = load(save(A2));
    let apart = -1;
    for (let k = 0; k < 24 && apart < 0; k++) { tick(A2); tick(A3); if (stateHash(A2) !== stateHash(A3)) apart = k + 1; }
    check("access: a wall dropped on a forecourt closes it, and every commute that walked it re-plans in the same breath — nobody is left walking through a wall, and save → load → two more years holds",
      before >= 50 && rp.ok && A2.wall[a2(30, 8)] === 1 && !sv(A2, a2(30, 9)) && stillWalking === 0 && apart === -1,
      `${before} crossed a forecourt · ${stillWalking} still walking through the station · ${apart < 0 ? "no divergence in 24 months" : `DIVERGED at month +${apart}`}`);

    // (b) NO OP AT ALL: zone the forecourt and let the town build across it.
    const B2 = load(save(town.W2));
    apply(B2, { kind: "zone", zone: ZONE.R, x0: 30, y0: 7, x1: 30, y1: 8, density: 3 });
    let grew = 0;
    for (let k = 0; k < 10 * 12 && !grew; k++) { tick(B2); grew = (B2.tier[town.ww(30, 7)] > 0 ? 1 : 0) + (B2.tier[town.ww(30, 8)] > 0 ? 1 : 0); }
    const B3 = load(save(B2));
    const stillWalking2 = throughWalls(B2);
    let apart2 = -1;
    for (let k = 0; k < 24 && apart2 < 0; k++) { tick(B2); tick(B3); if (stateHash(B2) !== stateHash(B3)) apart2 = k + 1; }
    check("access: and the same when NOBODY does anything — zone the forecourt, let a house grow on it, and the commutes that used it re-plan the month the wall goes up",
      grew > 0 && stillWalking2 === 0 && apart2 === -1,
      `${grew} houses grew on the forecourt · ${stillWalking2} commutes still walk through one · ${apart2 < 0 ? "no divergence in 24 months" : `DIVERGED at month +${apart2}`}`);
  }

  // ---- WHERE THE THREE SETTLES SIT, AND WHY -------------------------------
  {
    // A SPELLING-LEVEL TRIPWIRE, and it says so. Two of the three settles have
    // behavioural checks below (the 7c one and the end-of-tick re-plan); the
    // one after `lotsTick` does not, and here is the honest reason. Its only
    // consequence is TIMING: an animal whose route this month's building just
    // closed is released before the job search rather than after it, so it can
    // be re-employed the same month. Deleting it moved one fixture by 40
    // animals over 60 months and two jobless animals in the month itself -
    // real, but too small and too seed-fragile to assert without pinning a
    // golden number to a seed. So the ORDER is held instead, and the number is
    // written here rather than asserted.
    const tickSrc = readFileSync(path.join(ROOT, "js", "sim", "tick.js"), "utf8");
    const at = (re) => { const m = tickSrc.match(re); return m ? m.index : -1; };
    const lots = at(/const lots = lotsTick\(world\);/);
    const settle1 = tickSrc.indexOf("settleDoors(world);", lots);
    const citizens = at(/const cit = citizensTick\(world, cen, dem\);/);
    const events = at(/const evNotices = eventsTick\(world, cen, dem\);/);
    const settle2 = tickSrc.indexOf("settleDoors(world);", events);
    const justice = at(/const jNotices = justiceTick\(world, cen\);/);
    const bump = at(/^ {2}world\.tick\+\+;/m);
    const replan = tickSrc.lastIndexOf("replanStale(world);", bump); // the one inside tick(), not settleDoors' own
    check("access: the three settles are in the three places that make them mean anything — after lotsTick and BEFORE the citizens (so a route closed this month is not walked by this month's decisions), after eventsTick and before the freight and the killer (a fire razes at step 7), and an unconditional re-plan at the very end (nothing may end a tick stale, whatever marked it)",
      lots > 0 && settle1 > lots && citizens > settle1
        && events > citizens && settle2 > events && justice > settle2
        && replan > settle2 && bump > replan,
      `lotsTick@${lots} → settle@${settle1} → citizens@${citizens} → events@${events} → settle@${settle2} → justice@${justice} → replan@${replan} → tick++@${bump}`);
  }

  // ---- AN OP MAY NOT ERASE THE TOWN'S TRAFFIC ------------------------------
  {
    // `ops.apply` invalidates every commute, and for a long time nothing
    // rebuilt them: the next tick counts TRAFFIC at step 1 and repairs stale
    // commutes at step 5, so the month after ANY op the whole town's traffic
    // was counted from nothing - and pollution, land value and crime are
    // computed from traffic, in the same tick that rolls growth and decay.
    //
    // It was FARMABLE. Measured on a 20-year mayor town, one §1 repaint of an
    // isolated corner road each month against a control that laid the same
    // tile and left it alone:
    //
    //   before  control  P 1488 · maxTraffic 202 · commutes 893 · pol 10.85 · LV 39.64 · cash 29277
    //   before  farming  P 1556 · maxTraffic   0 · commutes   0 · pol  7.67 · LV 41.40 · cash 35384
    //
    // +4.6% population, -29% pollution, +1.8 land value and MORE cash, for a
    // penny a month. Now the two towns are the same town and the farmer is
    // only poorer - which is the assertion below, and it is not a golden
    // number: it says the op buys NOTHING but its own price.
    const twin = (repaint) => {
      const T5 = load(A.saved);
      const t5 = (x, y) => y * T5.w + x;
      let corner = -1;
      for (let i = 0; i < T5.w * T5.h && corner < 0; i++) {
        const x = i % T5.w;
        const y = (i / T5.w) | 0;
        if (x < 3 || y < 3 || x > T5.w - 4 || y > T5.h - 4) continue;
        if (T5.terrain[i] !== TERRAIN.GRASS || T5.road[i] || T5.zone[i] || T5.civic[i] || T5.wall[i] || T5.rail[i] || T5.tier[i]) continue;
        if (T5.roadDist[i] <= KNOBS.ROAD_REACH) continue; // far from everything, so the road itself changes nothing
        if (apply(T5, { kind: "road", tiles: [i] }).ok) corner = i;
      }
      for (let k = 0; k < 24; k++) {
        const painted = repaint ? apply(T5, { kind: "use", use: k % 2 ? 1 : 0, x0: corner % T5.w, y0: (corner / T5.w) | 0, x1: corner % T5.w, y1: (corner / T5.w) | 0 }) : null;
        // AN UNDO IS AN OP TOO, and it invalidates the same way. `repaint === 2`
        // paints and takes it straight back - and only when the paint took, or
        // the undo would reach past it and pull up the road underneath.
        if (repaint === 2 && painted && painted.ok) undo(T5);
        tick(T5);
      }
      const c = T5.last.census;
      return { corner, P: c.P, traffic: c.maxTraffic, commutes: c.commuteN, pol: c.meanPol, lv: c.meanLV, cash: T5.cash, hash: stateHashNoNews(T5) };
    };
    const calm = twin(false);
    const farmed = twin(true);
    const undone = twin(2);
    check("access: an op may not erase the town's traffic — repaint one isolated road tile every month for two years and the city is the SAME city as one that never touched it: the same commutes counted, the same traffic, the same pollution and land value, and the farmer only poorer by what the paint cost. And the same when the paint is UNDONE each month, because an undo invalidates too",
      calm.corner >= 0 && farmed.corner === calm.corner && calm.traffic > 0 && calm.commutes > 0
        && farmed.traffic === calm.traffic && farmed.commutes === calm.commutes
        && farmed.P === calm.P && farmed.pol === calm.pol && farmed.lv === calm.lv
        && farmed.cash < calm.cash
        && undone.traffic === calm.traffic && undone.commutes === calm.commutes
        && undone.P === calm.P && undone.pol === calm.pol && undone.lv === calm.lv
        && undone.cash === calm.cash,
      `calm P ${calm.P} · traffic ${calm.traffic} · commutes ${calm.commutes} · pol ${calm.pol.toFixed(2)} · LV ${calm.lv.toFixed(2)} · cash ${calm.cash}`
        + ` || farmed P ${farmed.P} · traffic ${farmed.traffic} · commutes ${farmed.commutes} · pol ${farmed.pol.toFixed(2)} · LV ${farmed.lv.toFixed(2)} · cash ${farmed.cash}`
        + ` || undone P ${undone.P} · traffic ${undone.traffic} · commutes ${undone.commutes} · pol ${undone.pol.toFixed(2)} · LV ${undone.lv.toFixed(2)} · cash ${undone.cash}`);
  }

  // ---- THE SIGNATURE, ONE TRANSITION PER ROW -------------------------------
  {
    // `markDoorsMoved` is the whole of "a move is a re-plan": every stale
    // commute in the game depends on it noticing. Its first version hashed the
    // door SET, and a third hostile review found the hole under it — a
    // building that REROUTES a forecourt without taking a door away moved
    // every tile a citizen walks and raised nothing. 99 animals kept walking
    // through a police station on this part's own flagship fixture.
    //
    // So the transitions are a table, one row each, and the LAST row is the
    // one that makes the rest mean anything: nothing changed, and it says so.
    const S3 = createWorld({ seed: "signature" });
    const s3 = (x, y) => y * S3.w + x;
    for (let y = 2; y <= 20; y++) for (let x = 2; x <= 30; x++) {
      const i = s3(x, y);
      S3.terrain[i] = TERRAIN.GRASS; S3.road[i] = ROAD.NONE; S3.zone[i] = ZONE.NONE;
      S3.tier[i] = 0; S3.wall[i] = 0; S3.rail[i] = 0; S3.civic[i] = 0; S3.big[i] = 0; S3.use[i] = 0;
    }
    S3.events.noDisasters = true;
    // A road that ENDS in a corner, so the platform's one door is diagonal to
    // it and reachable two ways round — the geometry the review named: "the
    // platform's nearest road tile is not axis-aligned with it".
    const sroad = [];
    for (let y = 2; y <= 4; y++) sroad.push(s3(12, y));
    for (let x = 11; x <= 12; x++) sroad.push(s3(x, 4));
    apply(S3, { kind: "road", tiles: sroad });
    const srail = [];
    for (let x = 4; x <= 20; x++) srail.push(s3(x, 5));
    apply(S3, { kind: "rail", tiles: srail });
    apply(S3, { kind: "station", tx: 10, ty: 5 });
    computeFields(S3);
    const plat = s3(10, 5);
    const chainOf = (w, i) => {
      const l = w._stationDoors && w._stationDoors[i];
      return l ? l.map(([j, c]) => `${j}<${c.join(".")}`).join(" ") : "";
    };
    const rows = [];
    const say = (name, change, want) => {
      const doorsBefore = doors(S3, plat).join(",");
      const chainBefore = chainOf(S3, plat);
      S3.doorsMoved = false;
      change();
      computeStationDoors(S3);
      rows.push({
        name, want, got: !!S3.doorsMoved,
        doorsSame: doors(S3, plat).join(",") === doorsBefore,
        chainSame: chainOf(S3, plat) === chainBefore,
      });
    };
    // THE TIE-BREAK IS THE ORDER, and the order decides which tiles an animal
    // walks. Two routes of two tiles reach this door - north-then-east round
    // (10,4), or east-then-north round (11,5). `DOOR_N4` is N E S W, so the
    // north one is discovered first and is the forecourt the commute carries.
    // Reordering those four pairs changes what is drawn under a walker and
    // nothing else could see it - so the order is pinned PAIR BY PAIR below,
    // because one pin (north before east) left a mutant that swapped east and
    // south alive.
    const firstChain = chainOf(S3, plat);
    say("nothing changes", () => {}, false);
    // The one the door set cannot see: the door stays, the way to it moves.
    say("a house grows on the forecourt", () => { S3.zone[s3(10, 4)] = ZONE.R; S3.tier[s3(10, 4)] = 1; }, true);
    const reroute = rows[rows.length - 1];
    say("and nothing changes again", () => {}, false);
    say("the door itself is taken", () => { S3.road[s3(11, 4)] = ROAD.NONE; S3.roadsDirty = true; computeRoadDist(S3); }, true);
    say("a new door is opened", () => { S3.road[s3(11, 4)] = ROAD.ROAD; S3.roadsDirty = true; computeRoadDist(S3); }, true);
    say("the last station goes", () => { S3.rail[plat] = 1; }, true);
    say("and with no station at all, nothing changes", () => {}, false);
    say("a station appears again", () => { S3.rail[plat] = 2; }, true);
    const wrong = rows.filter((r) => r.got !== r.want);
    check("access: the door-graph signature, one transition per row — a door taken, a door opened, the last station gone, the first station back, and A FORECOURT REROUTED UNDER AN UNCHANGED DOOR all say the graph moved; nothing changing says nothing, three times, or the flag would mean nothing",
      wrong.length === 0 && rows.length === 8 && reroute.doorsSame && !reroute.chainSame
        && firstChain === `${s3(11, 4)}<${s3(10, 4)}`,
      wrong.length ? wrong.map((r) => `${r.name}: ${r.got}, wanted ${r.want}`).join(" · ")
        : `${rows.length} transitions · the reroute kept its door list (${reroute.doorsSame}) and changed its chain (${!reroute.chainSame}) · the tie-break went north first (${firstChain === `${s3(11, 4)}<${s3(10, 4)}`})`);
  }

  // ---- N, E, S, W: THE ORDER, PAIR BY PAIR ---------------------------------
  {
    // `DOOR_N4` is a cyclic order, and every adjacent pair of it decides a
    // real tie. Three platforms, each with ONE door reachable two ways in the
    // same number of steps, and each pinning the pair that settles it:
    //
    //   north before east  door NE of the platform -> the chain goes N then E
    //   east  before south door SE of the platform -> the chain goes E then S
    //   south before west  door SW of the platform -> the chain goes S then W
    //
    // Nothing else in the game can see this: the doors come back sorted, the
    // distances are equal, and only the TILES A WALKER IS DRAWN ON change.
    const O4 = createWorld({ seed: "door-order" });
    const o4 = (x, y) => y * O4.w + x;
    for (let y = 2; y <= 26; y++) for (let x = 2; x <= 40; x++) {
      const i = o4(x, y);
      O4.terrain[i] = TERRAIN.GRASS; O4.road[i] = ROAD.NONE; O4.zone[i] = ZONE.NONE;
      O4.tier[i] = 0; O4.wall[i] = 0; O4.rail[i] = 0; O4.civic[i] = 0; O4.big[i] = 0; O4.use[i] = 0;
    }
    O4.events.noDisasters = true;
    // Three platforms on one line, far enough apart not to share a door.
    const oline = [];
    for (let x = 4; x <= 36; x++) oline.push(o4(x, 12));
    apply(O4, { kind: "rail", tiles: oline });
    // One road tile each, DIAGONAL to its platform, so two routes of two steps
    // reach it and the discovery order picks between them.
    apply(O4, { kind: "road", tiles: [o4(9, 11), o4(17, 13), o4(23, 13)] });
    apply(O4, { kind: "station", tx: 8, ty: 12 });   // its door is NE  -> N wins over E
    apply(O4, { kind: "station", tx: 16, ty: 12 });  // its door is SE  -> E wins over S
    apply(O4, { kind: "station", tx: 24, ty: 12 });  // its door is SW  -> S wins over W
    computeFields(O4);
    const chain1 = (i) => {
      const l = O4._stationDoors && O4._stationDoors[i];
      return l && l.length === 1 ? l[0][1].map((t) => `${t % O4.w},${(t / O4.w) | 0}`).join(" ") : `(${l ? l.length : 0} links)`;
    };
    const ne = chain1(o4(8, 12));
    const se = chain1(o4(16, 12));
    const sw = chain1(o4(24, 12));
    check("access: the door search's N, E, S, W is a decision, pinned pair by pair — where two forecourts of the same length reach the same door, north beats east, east beats south and south beats west, and the tiles a walker is drawn on are the ones that change",
      ne === "8,11" && se === "17,12" && sw === "24,13",
      `NE door → [${ne}] (want 8,11) · SE door → [${se}] (want 17,12) · SW door → [${sw}] (want 24,13)`);
  }

  // ---- A FORECOURT REROUTED, IN A TOWN -------------------------------------
  {
    // The review's own reproduction, on the rig the flagship check already
    // uses: a wall dropped on the tile BOTH doors were reached
    // through. The doors survive — the platform is entered from either side —
    // and every chain moves. Before the signature carried the chain: 99
    // commutes still walking through the station, and save → load → continue
    // parting company one month later.
    const R4 = createWorld({ seed: "reroute-town" });
    const r4 = (x, y) => y * R4.w + x;
    for (let y = 2; y <= 34; y++) for (let x = 2; x <= 56; x++) {
      const i = r4(x, y);
      R4.terrain[i] = TERRAIN.GRASS; R4.road[i] = ROAD.NONE; R4.zone[i] = ZONE.NONE;
      R4.tier[i] = 0; R4.wall[i] = 0; R4.rail[i] = 0; R4.civic[i] = 0; R4.big[i] = 0; R4.use[i] = 0;
    }
    R4.cash = 600000;
    R4.events.noDisasters = true;
    const rroads = [];
    for (const y of [6, 26]) for (let x = 4; x <= 54; x++) rroads.push(r4(x, y));
    for (const x of [29, 31]) for (const y of [7, 8]) rroads.push(r4(x, y));
    apply(R4, { kind: "road", tiles: rroads });
    const rline = [];
    for (let y = 9; y <= 23; y++) rline.push(r4(30, y));
    apply(R4, { kind: "rail", tiles: rline });
    apply(R4, { kind: "station", tx: 30, ty: 9 });
    apply(R4, { kind: "station", tx: 30, ty: 23 });
    for (const [x0, x1] of [[20, 28], [32, 40]]) {
      apply(R4, { kind: "zone", zone: ZONE.R, x0, y0: 4, x1, y1: 5, density: 3 });
      apply(R4, { kind: "zone", zone: x0 === 20 ? ZONE.C : ZONE.I, x0, y0: 27, x1, y1: 28, density: 3 });
    }
    for (let k = 0; k < 15 * 12; k++) tick(R4);
    const throughChain = (w, t) => {
      let n = 0;
      for (const c of w.citizens) {
        if (c.dead || !c.path) continue;
        for (let k = 0; k < c.path.length; k++) if (!(c.path[k] & RIDE) && (c.path[k] & TILE) === t) { n++; break; }
      }
      return n;
    };
    const before = throughChain(R4, r4(30, 8));
    const doorsBefore = doors(R4, r4(30, 9)).slice();
    const P2 = load(save(R4));
    const rp = apply(P2, { kind: "wall", tiles: [r4(30, 8)] });
    const stillOnIt = throughChain(P2, r4(30, 8));
    const doorsAfter = doors(P2, r4(30, 9)).slice();
    tick(P2);
    const P3 = load(save(P2));
    let apart = -1;
    for (let k = 0; k < 24 && apart < 0; k++) { tick(P2); tick(P3); if (stateHash(P2) !== stateHash(P3)) apart = k + 1; }
    // A RIDING STEP IS NEUTRAL TRAVEL. SPEC 7.9 and 9c, the README and the
    // Rules tab all say the trespass counts WALKING tiles only — an animal on
    // a train is not trespassing on the line it rides — and nothing held it:
    // deleting the ride test in `fields.exposure` left the suite green. A real
    // rider from this town, with every tile it RIDES painted against it, is
    // exposed to nothing; paint one road tile the same animal WALKS and it is
    // exposed at once.
    const { admits: admits4 } = await import("../js/sim/species.js");
    const X4 = load(save(R4));
    // A PREY animal that rides: use 1 is predator-only, so the paint has to
    // exclude whoever we pick or the whole check would be measuring nothing.
    const anyRider = X4.citizens.find((c) => !c.dead && !admits4(1, c.species) && c.path && Array.from(c.path).some((x) => x & RIDE));
    const rode = anyRider ? Array.from(anyRider.path).filter((x) => x & RIDE).map((x) => x & TILE) : [];
    const walked = anyRider ? Array.from(anyRider.path).filter((x) => !(x & RIDE)).map((x) => x & TILE) : [];
    for (const t of rode) X4.use[t] = 1; // predator-only; the rider is whatever it is
    computeFields(X4);
    const ridingExposure = anyRider ? FI.exposure(X4, anyRider).e : -1;
    const oneWalked = walked.find((t) => X4.road[t] !== ROAD.NONE && X4.use[t] === 0);
    if (oneWalked !== undefined) X4.use[oneWalked] = 1;
    computeFields(X4);
    const walkingExposure = anyRider ? FI.exposure(X4, anyRider).e : -1;
    check("access: a riding step is NEUTRAL TRAVEL — every tile a real commuter RIDES painted against its species costs it no exposure at all; paint one road tile the same animal walks and it is exposed at once. Three documents said so and no check did",
      !!anyRider && rode.length > 2 && oneWalked !== undefined
        && ridingExposure === 0 && walkingExposure > 0,
      `${rode.length} ridden tiles painted → exposure ${ridingExposure} · one walked road tile painted → exposure ${walkingExposure}`);

    // THE PLAYER'S LINE AND §15. Two mutants lived here and neither could be
    // reached by any fixture in the suite, because no save/load check had ever
    // PAINTED anything: `ops.apply`'s `else if (lines) invalidatePaths(world)`
    // (delete it and a repaint leaves every commute crossing a road its
    // species is now barred from, while a reload re-plans round it), and
    // `save.js`'s `commutePath(world, c.species, a, b)` (drop the species and
    // a loaded city takes the UNWEIGHTED route its own comment forbids). Both
    // show as paths that differ live-vs-reload, and then as a divergence.
    const L4 = load(save(R4));
    const painted = [];
    for (let x = 20; x <= 40; x++) painted.push(r4(x, 6));
    apply(L4, { kind: "use", use: 1, x0: 20, y0: 6, x1: 40, y1: 6 }); // the north avenue, predator-only
    tick(L4);
    const L5 = load(save(L4));
    const byId4 = new Map(L5.citizens.map((c) => [c.id, c]));
    let pathsDiffer = 0;
    let crossPainted = 0;
    for (const c of L4.citizens) {
      if (c.dead) continue;
      const d = byId4.get(c.id);
      if (!d) continue;
      const a = c.path ? Array.from(c.path).join(",") : "-";
      const b = d.path ? Array.from(d.path).join(",") : "-";
      if (a !== b) pathsDiffer++;
      if (c.path) for (let k = 0; k < c.path.length; k++) if (painted.includes(c.path[k] & TILE)) { crossPainted++; break; }
    }
    let apartL = -1;
    for (let k = 0; k < 24 && apartL < 0; k++) { tick(L4); tick(L5); if (stateHash(L4) !== stateHash(L5)) apartL = k + 1; }
    check("access: save → load → two more years on a town with THE PLAYER'S LINE painted across it — a repaint re-plans every commute at the op, and a reload rebuilds them weighted by species as the live city did; no save/load check in the suite had ever painted a tile, so both halves of that were free",
      L4.use[r4(30, 6)] === 1 && pathsDiffer === 0 && apartL === -1,
      `${painted.length} tiles painted · ${crossPainted} commutes still cross them · ${pathsDiffer} paths differ at the save · ${apartL < 0 ? "no divergence in 24 months" : `DIVERGED at month +${apartL}`}`);

    // NOTHING MAY END A TICK STALE. The settle after `eventsTick` runs AFTER
    // the citizens have, so its invalidation has no stale pass coming: the
    // month would end with every commute null, and next month's traffic,
    // riders and mean commute would be taken from NOTHING in the straight run
    // and from everything in a reload, which re-plans on load. The hash at the
    // boundary is equal either way — `c.path` is not in `canonicalCitizen` —
    // so the two cities part a month later. A fourth hostile review measured
    // it on this very rig: traffic 0 against 3796, and ff0656b1 against
    // 4a6abbbb at 24 months. NO OP IS INVOLVED, and the save is taken at a
    // clean tick boundary, so this is not the same-month-op hole in BACKLOG.
    const Q2 = load(save(R4));
    for (const t of [r4(30, 7), r4(30, 8)]) { Q2.zone[t] = ZONE.R; Q2.maxTier[t] = 3; Q2.tier[t] = 2; }
    tick(Q2);                                    // the forecourt closes; the 4b settle re-plans round it
    BL.ignite(Q2, r4(30, 8), 1);
    BL.ignite(Q2, r4(30, 7), 1);
    let burned = -1;
    for (let k = 0; k < 12 && burned < 0; k++) { tick(Q2); if (Q2.tier[r4(30, 7)] === 0 && Q2.tier[r4(30, 8)] === 0) burned = k + 1; }
    const stranded = (w) => w.citizens.filter((c) => !c.dead && c.job >= 0 && c.home >= 0 && !c.path).length;
    const employed = Q2.citizens.filter((c) => !c.dead && c.job >= 0 && c.home >= 0).length;
    const strandedAtBoundary = stranded(Q2);
    const Q3 = load(save(Q2));
    const hashAtSave = stateHash(Q2) === stateHash(Q3);
    tick(Q2); tick(Q3);
    const trafficQ2 = Q2.traffic.reduce((a, b) => a + b, 0);
    const trafficQ3 = Q3.traffic.reduce((a, b) => a + b, 0);
    let apartQ = -1;
    for (let k = 0; k < 24 && apartQ < 0; k++) { tick(Q2); tick(Q3); if (stateHash(Q2) !== stateHash(Q3)) apartQ = k + 1; }
    check("access: and NOTHING MAY END A TICK STALE — a fire razes a house off a forecourt at step 7, three steps after the citizens have run, and the month still ends with every commute planned; the straight run and a reload count the same traffic next month, and hold for two years",
      burned > 0 && employed > 50 && strandedAtBoundary === 0 && hashAtSave
        && trafficQ2 > 0 && trafficQ2 === trafficQ3 && apartQ === -1,
      `burnt after ${burned} month${burned === 1 ? "" : "s"} · ${strandedAtBoundary} of ${employed} employed animals end the month with no commute · traffic next month ${trafficQ2} vs ${trafficQ3} · ${apartQ < 0 ? "no divergence in 24 months" : `DIVERGED at month +${apartQ}`}`);

    check("access: a forecourt REROUTED under an unchanged door — a police station on the tile both of a platform's doors were reached through leaves both doors standing and moves every chain, and every commute that walked the old way re-plans at the op; nobody is left walking through the station, and save → load → two more years holds",
      before >= 50 && rp.ok && doorsBefore.length === 2 && doorsAfter.length === 2
        && doorsBefore.join(",") === doorsAfter.join(",") && stillOnIt === 0 && apart === -1,
      `${before} walked the old chain · doors ${doorsBefore.length} → ${doorsAfter.length} (same list ${doorsBefore.join(",") === doorsAfter.join(",")}) · ${stillOnIt} still on the police station · ${apart < 0 ? "no divergence in 24 months" : `DIVERGED at month +${apart}`}`);
  }

  // ---- THE GRAPH AND THE FIELD SAY THE SAME THING --------------------------
  {
    // SPEC 6c's flagship sentence - "the field, the doors the card lists and
    // the edges the commute graph carries cannot disagree" - was asserted in
    // three documents and tested nowhere. A hostile review proved it: drop
    // `passable` from computeStationDoors, or its `links.fill(undefined)`, or
    // link only a platform's FIRST door, and the suite stayed green while the
    // card said one thing and the graph rode another. Every fixture that
    // routed a commute routed it past a platform that was fine.
    //
    // The statement is an EQUALITY between two things computed different ways:
    // the doors the card lists (doorsOf - a fresh search, per platform) and
    // the edges the sim actually rides (world._stationDoors - built once for
    // the whole map). Same tiles, same order, no extras, no leftovers. It is
    // asked after a build, after two years of ticks, after a reload and after
    // an op, because three of the four ways it can break only show with time.
    const G3 = createWorld({ seed: "graph-field" });
    const g3 = (x, y) => y * G3.w + x;
    const gxy = (t) => `(${t % G3.w},${(t / G3.w) | 0})`;
    for (let y = 2; y <= 34; y++) for (let x = 2; x <= 56; x++) {
      const i = g3(x, y);
      G3.terrain[i] = TERRAIN.GRASS; G3.road[i] = ROAD.NONE; G3.zone[i] = ZONE.NONE;
      G3.tier[i] = 0; G3.wall[i] = 0; G3.rail[i] = 0; G3.civic[i] = 0; G3.big[i] = 0; G3.use[i] = 0;
    }
    G3.cash = 600000;
    G3.events.noDisasters = true;
    // TWO road systems that never touch, so riding is the only way across -
    // a walk between them does not exist rather than merely costing more.
    const groad = [];
    for (const y of [6, 26]) for (let x = 4; x <= 54; x++) groad.push(g3(x, y));
    // Spurs down each side of the north platform, so it has TWO doors at the
    // same distance and they are DISCOVERED east-then-west: without the sort
    // in doorSearch the card lists them the other way round, which is the one
    // deleted line that moved every published gate hash and 10% of a town.
    for (const x of [29, 31]) for (const y of [7, 8]) groad.push(g3(x, y));
    apply(G3, { kind: "road", tiles: groad });
    // The line that works, and the line that does not: same geometry, except
    // the north end of the western one stands behind a river.
    for (let x = 10; x <= 14; x++) G3.terrain[g3(x, 8)] = TERRAIN.WATER;
    for (const x of [12, 30]) {
      const ln = [];
      for (let y = 9; y <= 23; y++) ln.push(g3(x, y));
      apply(G3, { kind: "rail", tiles: ln });
      apply(G3, { kind: "station", tx: x, ty: 9 });
      apply(G3, { kind: "station", tx: x, ty: 23 });
    }
    apply(G3, { kind: "zone", zone: ZONE.R, x0: 20, y0: 4, x1: 40, y1: 5, density: 3 });
    apply(G3, { kind: "zone", zone: ZONE.C, x0: 20, y0: 27, x1: 30, y1: 28, density: 3 });
    apply(G3, { kind: "zone", zone: ZONE.I, x0: 32, y0: 27, x1: 42, y1: 28, density: 3 });
    computeFields(G3);

    const targets = (w, i) => (w._stationDoors && w._stationDoors[i] ? w._stationDoors[i].map(([j]) => j) : []);
    const disagree = (w) => {
      const out = [];
      for (let i = 0; i < w.w * w.h; i++) {
        if (w.rail[i] !== 2) continue;
        const card = doors(w, i);
        const graph = targets(w, i);
        if (card.join(",") !== graph.join(",")) out.push(`${gxy(i)} card [${card.map(gxy).join(" ")}] graph [${graph.map(gxy).join(" ")}]`);
      }
      return out;
    };
    // ASCENDING, everywhere - the contract doorSearch's own comment states.
    const unsorted = (w) => {
      const out = [];
      for (let i = 0; i < w.w * w.h; i++) {
        if (w.rail[i] !== 2 && w.zone[i] === ZONE.NONE && !w.civic[i]) continue;
        const d = doors(w, i);
        for (let k = 1; k < d.length; k++) if (d[k] <= d[k - 1]) { out.push(gxy(i)); break; }
      }
      return out;
    };

    const northTwo = doors(G3, g3(30, 9));
    const riverEnd = doors(G3, g3(12, 9));
    const built = disagree(G3);
    for (let k = 0; k < 24; k++) tick(G3);       // time: stale edges pile up here
    const ticked = disagree(G3);
    const G4 = load(save(G3));                    // a rebuild from nothing
    const reloaded = disagree(G4);
    apply(G4, { kind: "park", tx: 30, ty: 8 });   // an op ON a forecourt that does NOT move the doors: a park is ground
    const oppedSame = disagree(G4);
    const parkDoors = doors(G4, g3(30, 9)).length;
    apply(G4, { kind: "bulldoze", x0: 30, y0: 8, x1: 30, y1: 8, what: "civic" });
    apply(G4, { kind: "wall", tiles: [g3(30, 8)] });  // a station house IS a wall - and the platform still has both doors,
    const oppedWalled = disagree(G4);              // because it is entered from either side: all sides are access points
    const walledDoors = doors(G4, g3(30, 9)).length;
    for (const x of [29, 31]) apply(G4, { kind: "wall", tiles: [g3(x, 9)] }); // seal the sides too, and now there is no way in
    const oppedGone = disagree(G4);
    const policeDoors = doors(G4, g3(30, 9)).length;
    const messy = unsorted(G3);

    const anyBad = built[0] || ticked[0] || reloaded[0] || oppedSame[0] || oppedWalled[0] || oppedGone[0];
    check("access: the doors the card lists and the edges the commute graph rides are THE SAME LIST — asked of every platform after a build, after two years, after a reload, after an op that leaves a forecourt open and after one that shuts it, and asked in ORDER, because the order is the tie-break every downstream number is settled by",
      built.length === 0 && ticked.length === 0 && reloaded.length === 0 && messy.length === 0
        && oppedSame.length === 0 && parkDoors === 2 && oppedWalled.length === 0 && walledDoors === 2
        && oppedGone.length === 0 && policeDoors === 0
        && northTwo.length === 2 && northTwo[0] === g3(29, 8) && northTwo[1] === g3(31, 8)
        && riverEnd.length === 0,
      `built ${built.length} · ticked ${ticked.length} · reloaded ${reloaded.length} · a park on the forecourt ${oppedSame.length} (${parkDoors} doors) · a wall on it ${oppedWalled.length} (${walledDoors} doors, entered from the other side) · sealed ${oppedGone.length} (${policeDoors} doors) · out of order ${messy.length} · the two-door platform lists ${northTwo.map(gxy).join(" ")} · the river one ${riverEnd.length}`
        + (anyBad ? ` — ${anyBad}` : ""));

    // And the consequence, which is the whole point of the equality: a
    // platform the field refuses carries no edges, so nobody boards it. The
    // two lines are the same shape; only the western one's north end stands
    // behind water. A commute from one road system to the other has no walk
    // available at all, so if it arrives it rode - and it can only have ridden
    // the eastern line.
    // 150, not the default 40: the ONLY way across is the far line, and the
    // detour to it is most of the width of the map. A budget that refuses the
    // journey would prove nothing - the rabbit has to be able to arrive for
    // "which platform did it board" to be a question.
    const trip = commutePath(G3, "rabbit", [g3(12, 6)], [g3(12, 26)], 150);
    const walked = trip ? Array.from(trip.path).filter((e) => !(e & RIDE)).map((e) => e & TILE) : [];
    check("access: and a platform the field refuses carries no edges — two identical lines, one with its north end behind a river, and the rabbit crossing the city walks to the far one rather than boarding the near one it cannot reach",
      !!trip && ridesPath(trip.path) && walked.includes(g3(30, 9)) && !walked.includes(g3(12, 9))
        && targets(G3, g3(12, 9)).length === 0 && targets(G3, g3(30, 9)).length === 2,
      `${trip ? "arrived" : "no route"} · rode ${trip && ridesPath(trip.path)} · through the river platform ${walked.includes(g3(12, 9))} · edges: river ${targets(G3, g3(12, 9)).length}, clear ${targets(G3, g3(30, 9)).length}`);
  }

  // ---- THE COUNT, AND WHO RE-PLANS -----------------------------------------
  {
    // (a) The census reports what the rule refuses. `lotsNoRoad` is printed in
    // the Census tab and nothing asserted it, so a mutant deleting the line
    // survived: the tab would have said every lot in a stranded quarter was
    // fine.
    const C4 = createWorld({ seed: "census-noroad" });
    const c4 = (x, y) => y * C4.w + x;
    for (let y = 2; y <= 20; y++) for (let x = 2; x <= 30; x++) {
      const i = c4(x, y);
      C4.terrain[i] = TERRAIN.GRASS; C4.road[i] = ROAD.NONE; C4.zone[i] = ZONE.NONE;
      C4.tier[i] = 0; C4.wall[i] = 0; C4.rail[i] = 0; C4.civic[i] = 0; C4.big[i] = 0; C4.use[i] = 0;
    }
    C4.events.noDisasters = true;
    const crow = [];
    for (let x = 6; x <= 24; x++) crow.push(c4(x, 6));
    apply(C4, { kind: "road", tiles: crow });
    apply(C4, { kind: "zone", zone: ZONE.R, x0: 8, y0: 7, x1: 12, y1: 9, density: 3 });   // 15 lots, all within 3
    apply(C4, { kind: "zone", zone: ZONE.R, x0: 16, y0: 11, x1: 20, y1: 13, density: 3 }); // 15 lots, all 5 or more out
    for (let y = 7; y <= 9; y++) for (let x = 8; x <= 12; x++) C4.tier[c4(x, y)] = 1;
    for (let y = 11; y <= 13; y++) for (let x = 16; x <= 20; x++) C4.tier[c4(x, y)] = 1;
    computeFields(C4);
    let refused = 0;
    for (let i = 0; i < C4.w * C4.h; i++) if (C4.zone[i] !== ZONE.NONE && !sv(C4, i)) refused++;
    const cen4 = census(C4);
    check("access: the census counts what the rule refuses — thirty lots, fifteen of them five tiles from the only road, and the Census tab says fifteen; the number the tab prints is the number 'served' gives, lot for lot",
      cen4.lots === 30 && refused === 15 && cen4.lotsNoRoad === refused,
      `${cen4.lots} lots · the tab says ${cen4.lotsNoRoad} with no road · the rule itself refuses ${refused}`);

    // (b) A MERGE RE-PLANS THE PEOPLE WHO WORK THERE, not only the people who
    // live there. `blocks.replanOn` reads both `c.home` and `c.job`, and the
    // job half was untested: a mutant dropping it survived, and a worker whose
    // WORKPLACE changed shape kept a path to a door that no longer exists.
    const M4 = createWorld({ seed: "replan-jobs" });
    const m4 = (x, y) => y * M4.w + x;
    for (let y = 4; y <= 18; y++) for (let x = 4; x <= 18; x++) {
      const i = m4(x, y);
      M4.terrain[i] = TERRAIN.GRASS; M4.road[i] = ROAD.NONE; M4.zone[i] = ZONE.NONE;
      M4.tier[i] = 0; M4.wall[i] = 0; M4.rail[i] = 0; M4.civic[i] = 0; M4.big[i] = 0; M4.use[i] = 0;
    }
    M4.valves.R = 0.5;
    M4.events.noDisasters = true;
    apply(M4, { kind: "road", tiles: [6, 7, 8, 9, 10, 11, 12, 13].map((x) => m4(x, 9)) });
    apply(M4, { kind: "zone", zone: ZONE.C, x0: 10, y0: 10, x1: 11, y1: 11, density: 3 });
    apply(M4, { kind: "zone", zone: ZONE.R, x0: 6, y0: 10, x1: 7, y1: 11, density: 3 });
    for (let y = 10; y <= 11; y++) for (let x = 10; x <= 11; x++) { M4.tier[m4(x, y)] = 2; M4.maxTier[m4(x, y)] = 3; }
    M4.tier[m4(10, 10)] = 3;
    for (let y = 10; y <= 11; y++) for (let x = 6; x <= 7; x++) M4.tier[m4(x, y)] = 2;
    computeFields(M4);
    recountRosters(M4);
    for (let k = 0; k < 4; k++) placeHousehold(M4, createHousehold(M4, "rabbit", 4), m4(6, 10));
    // Employ them in the shop block, and give each a real path, as a tick would.
    // HALF AT THE ANCHOR, half in a corner - and the two are cleared by
    // DIFFERENT code. A worker in a corner is MOVED to the anchor by
    // mergeLots' own job loop, which nulls the path on its way past; a worker
    // already AT the anchor is not moving, so only `replanOn` can notice that
    // the building it works in has grown new doors. A fixture that employed
    // everyone in a corner tested the first loop and left the second's job
    // half free: a mutant dropping `set.has(c.job)` survived it.
    const workers = M4.citizens.filter((c) => !c.dead).slice(0, 8);
    workers.forEach((c, k) => {
      c.job = k % 2 ? m4(11, 11) : m4(10, 10); // a corner, and the anchor itself
      c.path = commutePath(M4, c.species, doors(M4, c.home), doors(M4, c.job), 40)?.path || null;
      c.stale = false;
    });
    const atAnchor = workers.filter((c) => c.job === m4(10, 10)).length;
    const withPaths = workers.filter((c) => !!c.path).length;
    const win4 = BL.mergeWindow(M4, m4(10, 10));
    if (win4) BL.mergeLots(M4, win4);
    const stillHolding = workers.filter((c) => c.path && !c.stale).length;
    check("access: a merge re-plans the people who WORK there, not only the people who live there — households employed half in the anchor of a shop block and half in a corner, and when the four shops become one 2×2 every one of those commutes is thrown away — the corner staff because they MOVE, the anchor staff because the building they were already in has new doors",
      withPaths >= 6 && atAnchor >= 3 && !!win4 && win4.side === 2 && stillHolding === 0,
      `${withPaths} of ${workers.length} had a path (${atAnchor} of them at the anchor) · the window is ${win4 ? `${win4.side}×${win4.side}` : "MISSING"} · ${stillHolding} kept a stale path`);
  }

  // ---- THE OTHER WAYS THE GROUND MOVES, AND THE OTHER SIDES ----------------
  {
    // A compact rig: two road systems that never touch, one line across, and a
    // platform with a door on EITHER side of it. Used by three checks below.
    const twoDoors = () => {
      const T = createWorld({ seed: "two-doors" });
      const t = (x, y) => y * T.w + x;
      for (let y = 2; y <= 30; y++) for (let x = 2; x <= 40; x++) {
        const i = t(x, y);
        T.terrain[i] = TERRAIN.GRASS; T.road[i] = ROAD.NONE; T.zone[i] = ZONE.NONE;
        T.tier[i] = 0; T.wall[i] = 0; T.rail[i] = 0; T.civic[i] = 0; T.big[i] = 0; T.use[i] = 0;
      }
      T.cash = 400000;
      T.events.noDisasters = true;
      const rr = [];
      for (const y of [6, 24]) for (let x = 6; x <= 34; x++) rr.push(t(x, y));
      for (const x of [19, 21]) for (const y of [7, 8]) rr.push(t(x, y));
      for (const x of [19, 21]) for (const y of [22, 23]) rr.push(t(x, y)); // the FAR platform gets two doors as well
      apply(T, { kind: "road", tiles: rr });
      const ln = [];
      for (let y = 9; y <= 21; y++) ln.push(t(20, y));
      apply(T, { kind: "rail", tiles: ln });
      apply(T, { kind: "station", tx: 20, ty: 9 });
      apply(T, { kind: "station", tx: 20, ty: 21 });
      computeFields(T);
      return { T, t };
    };

    // (a) BOTH DOORS ARE EDGES, not just the lowest-numbered one. THE ARRIVAL
    // is where this bites: `dial` relaxes a platform's link LIST in one place,
    // when the platform's walk node settles, and on the way IN that only leads
    // back out to the doors. On the way OUT it is the whole choice. So the far
    // platform's west door - the lower-numbered one, the only one a "first
    // link" graph would offer - is painted predator-only, and the rabbit gets
    // off on the east side for the price the fox pays. `doorsOf` listing two
    // is not the same claim as the graph carrying two, and this is the half
    // that says the second edge WORKS.
    const { T: TA, t: ta } = twoDoors();
    const plainR = commutePath(TA, "rabbit", [ta(20, 6)], [ta(20, 24)], 90);
    apply(TA, { kind: "use", use: 1, x0: 19, y0: 23, x1: 19, y1: 23 }); // the ARRIVAL platform's west door
    computeFields(TA);
    const paintedR = commutePath(TA, "rabbit", [ta(20, 6)], [ta(20, 24)], 90);
    const paintedF = commutePath(TA, "fox", [ta(20, 6)], [ta(20, 24)], 90);
    const westDoor = ta(19, 23);
    const rabbitWalked = paintedR ? Array.from(paintedR.path).filter((e) => !(e & RIDE)).map((e) => e & TILE) : [];
    check("access: every side of a PLATFORM is an edge in the graph, not only the lowest-numbered one — paint the FAR platform's west door predator-only and the rabbit gets off on the east side for the price the fox pays, which it could not do if the graph carried one way out",
      !!plainR && !!paintedR && !!paintedF && ridesPath(paintedR.path)
        && doors(TA, ta(20, 9)).length === 2 && doors(TA, ta(20, 21)).length === 2
        && paintedR.cost === plainR.cost && paintedR.cost === paintedF.cost
        && !rabbitWalked.includes(westDoor),
      `plain ${plainR && plainR.cost} · rabbit ${paintedR && paintedR.cost} · fox ${paintedF && paintedF.cost} · the rabbit used the painted door ${rabbitWalked.includes(westDoor)}`);

    // (b) AN UNDO IS AN OP TOO. `ops.undo` puts a razed forecourt back, and
    // the graph has to come back with it.
    const { T: TB, t: tb } = twoDoors();
    const linksOf = (w, i) => (w._stationDoors && w._stationDoors[i] ? w._stationDoors[i].map(([j, c]) => `${j}<${c.join(".")}`).join(" ") : "");
    const clean = linksOf(TB, tb(20, 9));
    apply(TB, { kind: "wall", tiles: [tb(20, 8)] });
    const walled = linksOf(TB, tb(20, 9));
    const un = undo(TB);
    const restored = linksOf(TB, tb(20, 9));
    const fresh = (() => { computeStationDoors(TB); return linksOf(TB, tb(20, 9)); })();
    check("access: an UNDO puts the forecourt back, and the graph with it — a wall on a forecourt reroutes both chains, undoing it restores them at the op rather than at the next tick, and what the graph holds is what a fresh computation gives",
      !!clean && walled !== clean && un.ok && restored === clean && fresh === clean,
      `clean [${clean}] · walled [${walled}] · undone [${restored}] · recomputed [${fresh}]`);

    // (c) A FIRE RAZES AT STEP 7, three steps after the settle at 4b. Nothing
    // settled after it, so the card and the graph disagreed for a whole month
    // after every fire - and `events.js` has imported `invalidatePaths` and
    // never called it since long before this part.
    const { T: TC, t: tc } = twoDoors();
    TC.zone[tc(20, 8)] = ZONE.R; TC.maxTier[tc(20, 8)] = 3; TC.tier[tc(20, 8)] = 2;
    TC.zone[tc(20, 7)] = ZONE.R; TC.maxTier[tc(20, 7)] = 3; TC.tier[tc(20, 7)] = 2;
    computeFields(TC);
    computeStationDoors(TC);
    const builtOver = linksOf(TC, tc(20, 9));
    BL.ignite(TC, tc(20, 8), 1);
    BL.ignite(TC, tc(20, 7), 1);
    let razedAt = -1;
    for (let k = 0; k < 12 && razedAt < 0; k++) { tick(TC); if (TC.tier[tc(20, 7)] === 0 && TC.tier[tc(20, 8)] === 0) razedAt = k + 1; }
    const afterFire = linksOf(TC, tc(20, 9));
    const freshAfterFire = (() => { const K = load(save(TC)); return linksOf(K, tc(20, 9)); })();
    check("access: a FIRE razes at step 7, and the doors settle in the same month — eventsTick clears ground three steps after the settle that follows lotsTick, so a burnt-out forecourt used to leave the card and the graph disagreeing until the next month turned",
      razedAt > 0 && builtOver !== afterFire && afterFire === freshAfterFire && afterFire.length > 0,
      `razed after ${razedAt} month${razedAt === 1 ? "" : "s"} · while built over [${builtOver}] · after the fire [${afterFire}] · a reload gives [${freshAfterFire}]`);

    // (d) THE BRANCH THAT SAYS `d === 0 cannot happen` IS A CLAIM ABOUT ops,
    // so ops is what proves it. A mutant deleting the guard survives, and
    // should: the case is unreachable. This is the construction that makes it
    // so, tested where it is decided rather than left as a comment.
    const { T: TD, t: td } = twoDoors();
    const roadOnPlatform = apply(TD, { kind: "road", tiles: [td(20, 9)] });
    const stationOnRoad = apply(TD, { kind: "station", tx: 20, ty: 6 });
    const cross = [];
    for (let y = 4; y <= 10; y++) cross.push(td(26, y)); // a straight N-S run across the E-W road: a level crossing (SPEC 12.4c)
    const railOnRoad = apply(TD, { kind: "rail", tiles: cross });
    check("access: a platform can never stand on a road, which is why `computeStationDoors` may say d === 0 cannot happen — ops refuses a road on a platform and a station on a road, and a level crossing is plain track and a road, never a station and a road",
      !roadOnPlatform.ok && !stationOnRoad.ok && railOnRoad.ok
        && TD.rail[td(20, 9)] === 2 && TD.road[td(20, 9)] === ROAD.NONE
        && TD.rail[td(26, 6)] === 1 && TD.road[td(26, 6)] !== ROAD.NONE,
      `road on a platform ${roadOnPlatform.ok ? "ALLOWED" : roadOnPlatform.reason} · station on a road ${stationOnRoad.ok ? "ALLOWED" : stationOnRoad.reason} · a level crossing is allowed (${railOnRoad.ok}) and is track + road, never platform + road`);

    // (e) THE BOUNDARY LAW, for the readers as well as the overlay. SPEC 14
    // forbids the draw and street layers a buffer on the world; `doorsOf` and
    // `nearestRoad` take one for that reason, and nothing held them to it -
    // the overlay's check pins `siteRoadDist` alone.
    const { T: TE, t: te } = twoDoors();
    const mine = new Uint8Array(TE.w * TE.h);
    TE._seen.fill(0xcd);
    const stamp = TE._seen.reduce((a, b) => a + b, 0);
    const gotDoors = doors(TE, te(20, 9), mine).length;
    const gotNear = nearestRoad(TE, te(20, 9), null, mine).doors.length;
    const gotServed = sv(TE, te(20, 9), mine); // `served` too: `lotScore` reaches it from the SCORE overlay
    const kept = TE._seen.reduce((a, b) => a + b, 0);
    const usedMine = mine.reduce((a, b) => a + b, 0) > 0;
    check("access: and the door READERS take the caller's scratch too — `doorsOf` and `nearestRoad` fill the buffer they are handed and leave the world's alone, which is the law the walker layer lives under and the overlay's check does not reach",
      gotDoors === 2 && gotNear === 2 && gotServed === true && kept === stamp && usedMine,
      `${gotDoors} doors · ${gotNear} from nearestRoad · served ${gotServed} · the world's stamp ${stamp} → ${kept} · the caller's buffer was written ${usedMine}`);
  }

  // ---- FIVE MORE LIVE RULES THAT HAD NOTHING BEHIND THEM -------------------
  {
    // Every one of these survived a mutant on a 519-check suite, and every one
    // is a rule a player can watch happen.
    const { admits: admits5 } = await import("../js/sim/species.js");
    const F6 = createWorld({ seed: "five-rules" });
    const f6 = (x, y) => y * F6.w + x;
    for (let y = 2; y <= 26; y++) for (let x = 2; x <= 40; x++) {
      const i = f6(x, y);
      F6.terrain[i] = TERRAIN.GRASS; F6.road[i] = ROAD.NONE; F6.zone[i] = ZONE.NONE;
      F6.tier[i] = 0; F6.wall[i] = 0; F6.rail[i] = 0; F6.civic[i] = 0; F6.big[i] = 0; F6.use[i] = 0;
    }
    F6.cash = 400000;
    F6.valves.R = 0.5;
    F6.events.noDisasters = true;
    const frow = [];
    for (let x = 4; x <= 36; x++) frow.push(f6(x, 6));
    apply(F6, { kind: "road", tiles: frow });
    apply(F6, { kind: "zone", zone: ZONE.R, x0: 8, y0: 7, x1: 12, y1: 7, density: 3 });
    apply(F6, { kind: "zone", zone: ZONE.C, x0: 16, y0: 7, x1: 20, y1: 7, density: 3 });
    for (let x = 8; x <= 12; x++) F6.tier[f6(x, 7)] = 2;
    for (let x = 16; x <= 20; x++) F6.tier[f6(x, 7)] = 2;
    computeFields(F6);
    recountRosters(F6);
    for (let k = 0; k < 8; k++) placeHousehold(F6, createHousehold(F6, "rabbit", 4), f6(8 + (k % 5), 7));
    for (let k = 0; k < 24; k++) tick(F6);
    const employedAt = (w, lo, hi) => w.citizens.filter((c) => !c.dead && c.job >= lo && c.job <= hi).length;
    const before = employedAt(F6, f6(16, 7), f6(20, 7));

    // (1) THE PLAYER'S LINE RELEASES ANIMALS ALREADY IN WORK. `replanStale` is
    // the only place that happens - the hiring gate covers new hires only -
    // and a mutant that dropped it kept 178 animals at lots painted against
    // them on a real town, with the suite green.
    apply(F6, { kind: "use", use: 1, x0: 16, y0: 7, x1: 20, y1: 7 }); // the shops, predator-only
    tick(F6);
    const stillThere = F6.citizens.filter((c) => !c.dead && c.job >= f6(16, 7) && c.job <= f6(20, 7) && !admits5(F6.use[c.job], c.species)).length;
    check("access: the player's line takes work away from animals ALREADY IN IT, not only from the next hire — paint a row of shops predator-only and every prey animal employed there has lost the job a month later",
      before >= 4 && stillThere === 0,
      `${before} employed there before the paint · ${stillThere} still employed at a lot that forbids them`);

    // (2) THE HOME AND JOB HALF OF THE TRESPASS. `exposure` adds
    // TRESPASS_HOME for a home or a job lot that forbids the species, on top
    // of the walked tiles - and the whole loop could be deleted unnoticed.
    const homeR = F6.citizens.find((c) => !c.dead && c.home >= f6(8, 7) && c.home <= f6(12, 7));
    const beforeE = homeR ? FI.exposure(F6, homeR).e : -1;
    apply(F6, { kind: "use", use: 1, x0: 8, y0: 7, x1: 12, y1: 7 }); // their HOMES, predator-only
    computeFields(F6);
    const afterE = homeR ? FI.exposure(F6, homeR).e : -1;
    check("access: and a trespass is where you LIVE and WORK as well as where you walk — paint a prey animal's own home predator-only and its exposure rises even if it never leaves the doorstep",
      !!homeR && afterE > beforeE && afterE >= KNOBS.TRESPASS_HOME,
      `exposure ${beforeE} → ${afterE} (a home or job that forbids is worth ${KNOBS.TRESPASS_HOME} each)`);

    // (3) A RAIL TUNNEL CARRIES REACH THROUGH A WALL, exactly as a road one
    // does. `reach.isBarrier` asks `hasWay`, and dropping that took a served
    // lot behind a walled line out of reach entirely.
    const T6 = createWorld({ seed: "rail-tunnel" });
    const t6 = (x, y) => y * T6.w + x;
    for (let y = 2; y <= 20; y++) for (let x = 2; x <= 30; x++) {
      const i = t6(x, y);
      T6.terrain[i] = TERRAIN.GRASS; T6.road[i] = ROAD.NONE; T6.zone[i] = ZONE.NONE;
      T6.tier[i] = 0; T6.wall[i] = 0; T6.rail[i] = 0; T6.civic[i] = 0; T6.big[i] = 0; T6.use[i] = 0;
    }
    T6.events.noDisasters = true;
    apply(T6, { kind: "road", tiles: [t6(10, 8), t6(11, 8), t6(12, 8)] });
    const wall6 = [];
    for (let x = 8; x <= 14; x++) wall6.push(t6(x, 10));
    apply(T6, { kind: "wall", tiles: wall6 });
    apply(T6, { kind: "zone", zone: ZONE.R, x0: 11, y0: 11, x1: 11, y1: 11, density: 3 });
    computeFields(T6);
    const walled = { d: siteRoadDist(T6, t6(11, 11)), served: sv(T6, t6(11, 11)), doors: doors(T6, t6(11, 11)).length };
    const rail6 = [];
    for (let y = 9; y <= 12; y++) rail6.push(t6(11, y));
    apply(T6, { kind: "rail", tiles: rail6 }); // a LINE through the wall: a tunnel
    computeFields(T6);
    const tunnelled = { d: siteRoadDist(T6, t6(11, 11)), served: sv(T6, t6(11, 11)), doors: doors(T6, t6(11, 11)).length };
    check("access: a RAIL tunnel is a way through a wall too — a lot walled off from its road is out of reach until a line runs through the wall, and then it is served with a door, the same as a road tunnel",
      !walled.served && walled.doors === 0 && tunnelled.served && tunnelled.doors === 1 && tunnelled.d === 3,
      `walled ${walled.d}/${walled.doors} doors · with a rail tunnel ${tunnelled.d}/${tunnelled.doors}`);

    // (3b) AND A GATE IS OPEN ALONG ITS AXIS ONLY. The check above builds the
    // tunnel ALONG the way in, which is the easy case: the hard one is a wall
    // pierced NORTH-SOUTH and a citizen trying to cross it EAST-WEST. Every
    // area effect already refused that (`forEachWithin` reads `world.occl`);
    // road distance and the door search asked only "is this a BARE wall", so
    // the same tile was a wall for a smell and a doorway for a rabbit, and a
    // stored commute walked through the masonry sideways.
    const X6 = createWorld({ seed: "crosswise" });
    const x6 = (x, y) => y * X6.w + x;
    for (let y = 2; y <= 26; y++) for (let x = 2; x <= 30; x++) {
      const i = x6(x, y);
      X6.terrain[i] = TERRAIN.GRASS; X6.road[i] = ROAD.NONE; X6.zone[i] = ZONE.NONE;
      X6.tier[i] = 0; X6.wall[i] = 0; X6.rail[i] = 0; X6.civic[i] = 0; X6.big[i] = 0; X6.use[i] = 0;
    }
    X6.events.noDisasters = true;
    const xwall = [];
    for (let y = 6; y <= 20; y++) xwall.push(x6(20, y));
    apply(X6, { kind: "wall", tiles: xwall });
    const xrail = [];
    for (let y = 10; y <= 14; y++) xrail.push(x6(20, y)); // a NORTH-SOUTH line through it
    apply(X6, { kind: "rail", tiles: xrail });
    const xroad = [];
    for (let y = 6; y <= 20; y++) xroad.push(x6(21, y));  // the road EAST of the wall
    apply(X6, { kind: "road", tiles: xroad });
    apply(X6, { kind: "zone", zone: ZONE.R, x0: 19, y0: 12, x1: 19, y1: 12, density: 3 }); // a lot WEST of it
    computeFields(X6);
    const westLot = x6(19, 12);
    const northLot = (() => { // and the same tunnel, approached ALONG its axis, still works
      const Y6 = load(save(X6));
      apply(Y6, { kind: "zone", zone: ZONE.R, x0: 20, y0: 16, x1: 20, y1: 16, density: 3 });
      apply(Y6, { kind: "road", tiles: [x6(20, 8), x6(20, 7)] });
      computeFields(Y6);
      return { d: siteRoadDist(Y6, x6(20, 16)), served: sv(Y6, x6(20, 16)) };
    })();
    check("access: a gate is open ALONG ITS AXIS ONLY, for a citizen as well as for a smell — a wall pierced north-south by a rail line is still a wall to anything crossing it east-west, and the lot behind it has no road; approach the same tunnel along its own axis and it is a way through",
      X6.wall[x6(20, 12)] === 1 && X6.rail[x6(20, 12)] === 1
        && !sv(X6, westLot) && doors(X6, westLot).length === 0 && X6.roadDist[westLot] > KNOBS.ROAD_REACH,
      `the lot west of the wall: ${X6.roadDist[westLot]} away, served ${sv(X6, westLot)}, ${doors(X6, westLot).length} doors · along the axis instead: ${northLot.d}, served ${northLot.served}`);

    // (4) A ZOO'S JOBS ARE THE ZOO'S, ONCE. `world.jobsOf` answers for the
    // ANCHOR only; letting a ZOO_PART answer too would pay a zoo four times.
    const Z6 = load(save(T6));
    apply(Z6, { kind: "road", tiles: [t6(20, 5), t6(21, 5)] }); // the road first: a zoo out of reach cannot be built
    apply(Z6, { kind: "zoo", tx: 20, ty: 6 });
    computeFields(Z6);
    const zooTilesJobs = siteTiles(Z6, t6(20, 6)).map((i) => jobsOf(Z6, i));
    check("access: a zoo pays for its keepers ONCE — the anchor holds all four tiles' jobs and the three parts hold none, so a 2×2 is one employer and not four",
      zooTilesJobs.length === 9 && zooTilesJobs[0] === KNOBS.ZOO_JOBS && zooTilesJobs.slice(1).every((j) => j === 0),
      `the four tiles hold ${zooTilesJobs.join(", ")} jobs (ZOO_JOBS is ${KNOBS.ZOO_JOBS})`);
  }

  // ---- A PLACEABLE BUILDING IS A FUNCTIONAL BUILDING -----------------------
  {
    // The owner, 2026-09-04: *"any placeable building should be a functional
    // building. any placeable building should be an enterable building. if a
    // building meets the requirements to exist it should be functional."* So
    // `ops` refuses a fire station, a police station, a pacification centre or
    // a zoo where no road reaches, and says why, instead of taking the money
    // for a building that employs nobody and covers nothing.
    //
    // TWO EXCEPTIONS, both the owner's. A PARK asks no road - it is a place,
    // not a service (SPEC 6c). A PLATFORM stays placeable because a line is
    // laid ahead of the town, and instead it wears the NO ROAD zot, "like
    // houses that are too far from the road" (checked in Part T').
    const P7 = createWorld({ seed: "placeable" });
    const p7 = (x, y) => y * P7.w + x;
    for (let y = 2; y <= 26; y++) for (let x = 2; x <= 40; x++) {
      const i = p7(x, y);
      P7.terrain[i] = TERRAIN.GRASS; P7.road[i] = ROAD.NONE; P7.zone[i] = ZONE.NONE;
      P7.tier[i] = 0; P7.wall[i] = 0; P7.rail[i] = 0; P7.civic[i] = 0; P7.big[i] = 0; P7.use[i] = 0;
    }
    P7.cash = 900000;
    P7.events.noDisasters = true;
    const prow = [];
    for (let x = 4; x <= 36; x++) prow.push(p7(x, 6));
    apply(P7, { kind: "road", tiles: prow });
    const line = [];
    for (let x = 8; x <= 34; x++) line.push(p7(x, 20));
    apply(P7, { kind: "rail", tiles: line });
    // y = 9 is three tiles from the road: in reach. y = 20 is fourteen: not.
    const near = [
      ["fire", 10, 7], ["police", 14, 7], ["centre", 18, 7], ["zoo", 22, 7], ["park", 26, 9],
    ].map(([kind, x, y]) => ({ kind, r: apply(P7, { kind, tx: x, ty: y }) }));
    const far = [
      ["fire", 10, 24], ["police", 14, 24], ["centre", 18, 24], ["zoo", 22, 24], ["park", 26, 24],
    ].map(([kind, x, y]) => ({ kind, r: apply(P7, { kind, tx: x, ty: y }) }));
    const farStation = apply(P7, { kind: "station", tx: 30, ty: 20 });
    const refusedFor = far.filter((f) => f.kind !== "park" && !f.r.ok && /adjacent to a road/.test(f.r.reason || "")).length;
    check("access: a placeable building is a functional building — a fire station, a police station, a pacification centre and a zoo are all REFUSED where no road reaches, and told why, rather than taking the money for something that employs nobody and covers nothing; a park is placed anywhere, because it asks no road; and a platform is placed anywhere too, because a line is laid ahead of the town and it wears the no-road mark until one arrives",
      near.every((n) => n.r.ok) && refusedFor === 4
        && far.find((f) => f.kind === "park").r.ok === true
        && farStation.ok === true && P7.rail[p7(30, 20)] === 2 && !sv(P7, p7(30, 20)),
      `in reach: ${near.map((n) => `${n.kind} ${n.r.ok}`).join(", ")} · out of reach: ${far.map((f) => `${f.kind} ${f.r.ok ? "BUILT" : "refused"}`).join(", ")} · a platform out of reach ${farStation.ok ? "stands, unserved" : "REFUSED"}`);
  }

  // ---- WHAT A ROAD ACTUALLY BUYS, ARM BY ARM -------------------------------
  {
    // SPEC 6c's table says which rule reads `served`, and a fourth hostile
    // review showed three of its rows were spelling: the importer list in
    // Part M' pins WHO asks, and a mutant can keep the import and shadow it.
    // So each arm gets a PAIR OF RUNS - the same buildings, one road tile
    // apart - because a list of callers says who asks and only a pair of runs
    // says what the answer does.
    const arms = (reach) => {
      const E = createWorld({ seed: "arms" });
      const e = (x, y) => y * E.w + x;
      for (let y = 2; y <= 26; y++) for (let x = 2; x <= 40; x++) {
        const i = e(x, y);
        E.terrain[i] = TERRAIN.GRASS; E.road[i] = ROAD.NONE; E.zone[i] = ZONE.NONE;
        E.tier[i] = 0; E.wall[i] = 0; E.rail[i] = 0; E.civic[i] = 0; E.big[i] = 0; E.use[i] = 0;
      }
      E.cash = 900000;
      E.events.noDisasters = true;
      const rr = [];
      for (let x = 4; x <= 36; x++) rr.push(e(x, 6));
      for (let x = 10; x <= 30; x++) rr.push(e(x, 15)); // laid in BOTH runs, so both can build
      apply(E, { kind: "road", tiles: rr });
      apply(E, { kind: "zoo", tx: 12, ty: 16 });
      apply(E, { kind: "centre", tx: 18, ty: 16 });
      apply(E, { kind: "police", tx: 22, ty: 16 });
      apply(E, { kind: "fire", tx: 25, ty: 16 });
      // AND THEN TAKE THE ROAD AWAY AGAIN in the unreached run. A building the
      // player cannot reach can no longer be BUILT (the owner: "if a building
      // meets the requirements to exist it should be functional"), so the only
      // way to a stranded one is the way a player finds it - by bulldozing the
      // road that served it. That is the honest reproduction anyway.
      if (!reach) apply(E, { kind: "bulldoze", x0: 10, y0: 15, x1: 30, y1: 15, what: "road" });
      apply(E, { kind: "zone", zone: ZONE.M, x0: 28, y0: 17, x1: 28, y1: 17, density: 3 });
      E.tier[e(28, 17)] = 2;
      computeFields(E);
      recountRosters(E);
      const cen = census(E);
      const covered = (f) => { let k = 0; for (let i = 0; i < E.w * E.h; i++) k += f[i] ? 1 : 0; return k; };
      // The licence is offered deterministically the month a hall reaches
      // tier 2 - and only a hall a road reaches.
      let licence = false;
      for (let k = 0; k < 6 && !licence; k++) { tick(E); if (E.events.choice && E.events.choice.id === "licence") licence = true; }
      return {
        E, e, cen,
        zooServed: sv(E, e(12, 17)), jobs: cen.J, zoos: cen.zoos, zoosNoRoad: sv(E, e(12,16)) ? 0 : 1,
        // THE COUNTS THE REST OF THE GAME READS FOR EFFECT, not for upkeep:
        // `justice` sizes the arrest force from `policeStations`, and the
        // advisor withholds "no fire station" and "no centre" from the other
        // two. Gating the zoo and stopping there left an unreachable police
        // station solving 35 of the 38 crimes a working one solves.
        police1: cen.policeStations, fire1: cen.fireStations, centre1: cen.centres,
        policeNo: cen.policeStationsNoRoad, fireNo: cen.fireStationsNoRoad, centreNo: cen.centresNoRoad,
        police: covered(E.policeCov), fire: covered(E.fireCov),
        // The van's shadow, measured the only honest way: the same tile with
        // and without the centre standing. A centre nobody can reach sends no
        // van, so it should darken nothing.
        vanShadow: (() => {
          const near = e(18, 18);
          const withIt = E.lv[near];
          const C = load(save(E));
          apply(C, { kind: "bulldoze", x0: 18, y0: 17, x1: 18, y1: 17, what: "civic" });
          computeFields(C);
          return C.lv[near] - withIt;
        })(),
        licence,
      };
    };
    const off = arms(false);
    const on = arms(true);
    check("access: what a road actually buys, arm by arm — a zoo, a pacification centre, a police and a fire station and a tier-2 meat hall, all out of reach: no jobs on the census (so no demand either), no cover on a single tile, NO STATION ON THE COUNT THE ARREST FORCE AND THE ADVISOR READ, no van shadow, and no Butchers' licence; lay the road that reaches them and every one of them arrives",
      off.jobs === 0 && off.zoos === 1 && off.zoosNoRoad === 1 && off.police === 0 && off.fire === 0 && off.vanShadow === 0 && !off.licence
        && off.police1 === 0 && off.fire1 === 0 && off.centre1 === 0
        && off.policeNo === 1 && off.fireNo === 1 && off.centreNo === 1
        && on.jobs > 0 && on.zoos === 1 && on.zoosNoRoad === 0 && on.police > 0 && on.fire > 0 && on.vanShadow > 0 && on.licence
        && on.police1 === 1 && on.fire1 === 1 && on.centre1 === 1
        && on.policeNo === 0 && on.fireNo === 0 && on.centreNo === 0,
      `out of reach: ${off.jobs} jobs · ${off.zoos}/${off.zoosNoRoad} zoos served/not · ${off.police} police tiles · ${off.fire} fire tiles · van shadow ${off.vanShadow} · licence ${off.licence} · the census counts police/fire/centre ${off.police1}/${off.fire1}/${off.centre1} with ${off.policeNo}/${off.fireNo}/${off.centreNo} out of reach`
        + ` || in reach: ${on.jobs} jobs · ${on.zoos}/${on.zoosNoRoad} · ${on.police} · ${on.fire} · ${on.vanShadow} · ${on.licence}`);

    // And the CARTS: every side of a hall is a loading bay, so a cart coming
    // from the east leaves by the east door. `meat.hallCandidates` indexes a
    // hall under EVERY door for that reason, and nothing had asked it for a
    // hall with more than one - so a mutant that indexed only the first one
    // lived, and every cart in the game would have driven round the building.
    const ME2 = await import("../js/sim/meat.js");
    const H4 = createWorld({ seed: "hall-doors" });
    const h4 = (x, y) => y * H4.w + x;
    for (let y = 2; y <= 20; y++) for (let x = 2; x <= 30; x++) {
      const i = h4(x, y);
      H4.terrain[i] = TERRAIN.GRASS; H4.road[i] = ROAD.NONE; H4.zone[i] = ZONE.NONE;
      H4.tier[i] = 0; H4.wall[i] = 0; H4.rail[i] = 0; H4.civic[i] = 0; H4.big[i] = 0; H4.use[i] = 0;
    }
    H4.events.noDisasters = true;
    const hroad = [];
    for (let x = 4; x <= 20; x++) if (x !== 12) hroad.push(h4(x, 10)); // one road, straight through, with the hall in it
    apply(H4, { kind: "road", tiles: hroad });
    apply(H4, { kind: "zone", zone: ZONE.M, x0: 12, y0: 10, x1: 12, y1: 10, density: 3 });
    H4.tier[h4(12, 10)] = 2;
    apply(H4, { kind: "zone", zone: ZONE.R, x0: 6, y0: 11, x1: 6, y1: 11, density: 3 });
    apply(H4, { kind: "zone", zone: ZONE.R, x0: 18, y0: 11, x1: 18, y1: 11, density: 3 });
    H4.tier[h4(6, 11)] = 1;
    H4.tier[h4(18, 11)] = 1;
    computeFields(H4);
    const hallDoors = doors(H4, h4(12, 10));
    const west = ME2.hallReach(H4, h4(6, 11));
    const east = ME2.hallReach(H4, h4(18, 11));
    check("access: and every side of a MEAT HALL is a loading bay — a cart coming from the west arrives at the west door and one from the east at the east door, for the same money; the freight index lists a hall under every door it has, not the lowest-numbered one",
      hallDoors.length === 2 && hallDoors[0] === h4(11, 10) && hallDoors[1] === h4(13, 10)
        && !!west && !!east && west.hall === h4(12, 10) && east.hall === h4(12, 10)
        && west.door === h4(11, 10) && east.door === h4(13, 10)
        && west.walkSteps === east.walkSteps,
      `doors ${hallDoors.map(xy).join(" ")} · from the west ${west ? xy(west.door) : "NO ROUTE"} in ${west && west.walkSteps} · from the east ${east ? xy(east.door) : "NO ROUTE"} in ${east && east.walkSteps}`);
    // AND `routeToHall` KNOWS EVERY DOOR TOO. It is the route `justice.kill`
    // publishes for a body, and it builds its own door set - so the all-sides
    // law had to be asserted of it separately, and was not: a mutant taking
    // only the hall's first door left the east lot with no route to the hall
    // at all, and the suite green.
    const eastRoute = ME2.routeToHall(H4, h4(18, 11), h4(12, 10));
    const westRoute = ME2.routeToHall(H4, h4(6, 11), h4(12, 10));
    check("access: and the route that carries a BODY to the hall knows every door as well — `routeToHall` builds its own door set for the hall, so a cart from the east arrives at the east door and one from the west at the west, for the same money",
      !!eastRoute && !!westRoute && eastRoute.door === h4(13, 10) && westRoute.door === h4(11, 10)
        && eastRoute.walkSteps === westRoute.walkSteps,
      `from the east ${eastRoute ? xy(eastRoute.door) : "NO ROUTE"} in ${eastRoute && eastRoute.walkSteps} · from the west ${westRoute ? xy(westRoute.door) : "NO ROUTE"} in ${westRoute && westRoute.walkSteps}`);
    // AND `doorOf` IS THE LOWEST-NUMBERED ONE, which is its whole contract and
    // was asserted nowhere once `need-stress` stopped using it.
    check("access: and `doorOf` is the LOWEST-numbered door, which is the only thing it promises — the single-tile reader the tools use has to agree with the list every rule reads",
      FI.doorOf(H4, h4(12, 10)) === doors(H4, h4(12, 10))[0] && doors(H4, h4(12, 10)).length === 2
        && FI.doorOf(H4, h4(12, 10)) < doors(H4, h4(12, 10))[1],
      `doorOf ${xy(FI.doorOf(H4, h4(12, 10)))} · doorsOf ${doors(H4, h4(12, 10)).map(xy).join(" ")}`);

    // AND THE FREIGHT CACHE IS RESET AT THE OP, not at the next month.
    // `hallReach` memoises per tick, so a cart asked after a player op would
    // otherwise be answered from a map that no longer exists - `ops.apply`
    // calls `resetMeatRoutes` for that reason and nothing held it.
    const staleRoute = ME2.hallReach(H4, h4(18, 11));       // fills the cache
    // A ROAD, not the hall: razing a hall goes through `meat.closeHall`, which
    // resets the cache itself, so a check that razed one would be watching the
    // wrong reset. Taking the road under the east door leaves the hall
    // standing and the east lot with nowhere to go, and only `ops.apply`'s own
    // `resetMeatRoutes` can notice inside the same month.
    apply(H4, { kind: "bulldoze", x0: 13, y0: 10, x1: 13, y1: 10, what: "road" });
    const afterRaze = ME2.hallReach(H4, h4(18, 11));
    const westStill = ME2.hallReach(H4, h4(6, 11));
    check("access: a cart asked after a player op is answered from the city as it is NOW — take the road under a hall's east door and the very next request from the east says there is nowhere to take the meat, while the west still arrives; ops resets the freight cache at the op, not at the next month",
      !!staleRoute && staleRoute.door === h4(13, 10) && H4.road[h4(13, 10)] === ROAD.NONE
        && afterRaze === null && !!westStill && westStill.door === h4(11, 10),
      `before, in by ${staleRoute ? xy(staleRoute.door) : "none"} · after the road went, from the east ${afterRaze ? xy(afterRaze.door) : "no route"} and from the west ${westStill ? xy(westStill.door) : "no route"}`);
  }

  // ---- A LOT NOBODY CAN REACH IS NOT SWALLOWED INTO A BLOCK -----------------
  {
    // `blocks.joinable` asks `served` of every lot it takes in, and
    // `blocks.troubled` asks it of the lot that starts the window. Both
    // premises are stated in SPEC 6c, in the handoff and in BACKLOG; both
    // survived a mutant, because no fixture had ever put an unreachable lot in
    // a merge window. Two PAIRS, so neither can pass by accident: the same
    // four houses, the same fill, one road tile apart.
    //
    // `mergeWindow` is asked directly rather than through `lotScore`, which
    // refuses an unserved lot several gates earlier - a test that went through
    // it would be watching the wrong door shut.
    const fourHouses = (roads) => {
      const M = createWorld({ seed: "join-served" });
      const m = (x, y) => y * M.w + x;
      for (let y = 4; y <= 18; y++) for (let x = 4; x <= 18; x++) {
        const i = m(x, y);
        M.terrain[i] = TERRAIN.GRASS; M.road[i] = ROAD.NONE; M.zone[i] = ZONE.NONE;
        M.tier[i] = 0; M.wall[i] = 0; M.rail[i] = 0; M.civic[i] = 0; M.big[i] = 0; M.use[i] = 0;
      }
      M.valves.R = 0.5;
      M.events.noDisasters = true;
      apply(M, { kind: "road", tiles: roads.map(([x, y]) => m(x, y)) });
      apply(M, { kind: "zone", zone: ZONE.R, x0: 10, y0: 10, x1: 12, y1: 12, density: 3 });
      for (let y = 10; y <= 12; y++) for (let x = 10; x <= 12; x++) M.tier[m(x, y)] = 2;
      M.tier[m(10, 10)] = 3;
      computeFields(M);
      recountRosters(M);
      const house = (lot, n) => { for (let k = 0; k < n; k += 4) placeHousehold(M, createHousehold(M, "rabbit", Math.min(4, n - k)), lot); };
      house(m(10, 10), 20); house(m(11, 10), 8); house(m(10, 11), 8); house(m(11, 11), 4); // 40 of 54, the same 74% either way
      computeFields(M);
      recountRosters(M);
      const win = BL.mergeWindow(M, m(10, 10));
      return {
        win, fill: win ? BL.windowFill(M, win.tiles) : null,
        anchor: siteRoadDist(M, m(10, 10)), corner: siteRoadDist(M, m(11, 11)),
      };
    };
    const WEST = [[9, 6], [9, 7], [9, 8], [9, 9]];  // the anchor is 2 out, the far corner 4
    const EAST = [[13, 10], [13, 11], [13, 12]];    // everything within 3
    const cornerOut = fourHouses(WEST);
    const cornerIn = fourHouses([...WEST, [12, 13]]);          // one tile, and the corner is 3
    const anchorOut = fourHouses([[13, 11]]);                  // now the CORNER is near and the anchor is 4
    const anchorIn = fourHouses(EAST);
    check("access: a house nobody can reach is not swallowed into a block, and one cannot start a block either — the same four tier-3 houses at the same 74% full, refused when the far corner is four tiles from the only road and joined when one more road tile makes it three; and refused again when it is the corner that is near and the anchor that is out of reach",
      !cornerOut.win && cornerOut.corner === KNOBS.ROAD_REACH + 1 && cornerOut.anchor === 2
        && !!cornerIn.win && cornerIn.win.side === 2 && cornerIn.corner === KNOBS.ROAD_REACH
        && !anchorOut.win && anchorOut.anchor === KNOBS.ROAD_REACH + 1
        && !!anchorIn.win && anchorIn.win.side === 2
        && Math.abs(cornerIn.fill - anchorIn.fill) < 1e-9,
      `corner ${cornerOut.corner} → ${cornerOut.win ? "MERGED" : "no window"} · corner ${cornerIn.corner} → ${cornerIn.win ? `${cornerIn.win.side}×${cornerIn.win.side}` : "NO WINDOW"} · anchor ${anchorOut.anchor} → ${anchorOut.win ? "MERGED" : "no window"} · anchor ${anchorIn.anchor} → ${anchorIn.win ? `${anchorIn.win.side}×${anchorIn.win.side}` : "NO WINDOW"} · fill ${cornerIn.fill && cornerIn.fill.toFixed(3)}/${anchorIn.fill && anchorIn.fill.toFixed(3)}`);
  }

  // ---- the SAME door, by a different forecourt chain -----------------------
  {
    // Endpoint and distance stay identical while N,E,S,W reroutes around a
    // new building. The exact chain is part of the graph identity because it
    // is copied into each stored citizen path.
    const C2 = createWorld({ seed: "forecourt-same-door" });
    const c2 = (x, y) => y * C2.w + x;
    for (let y = 4; y <= 10; y++) for (let x = 6; x <= 23; x++) {
      const i = c2(x, y);
      C2.terrain[i] = TERRAIN.GRASS; C2.road[i] = ROAD.NONE; C2.zone[i] = ZONE.NONE;
      C2.tier[i] = 0; C2.wall[i] = 0; C2.rail[i] = 0; C2.civic[i] = 0;
      C2.big[i] = 0; C2.rubble[i] = 0; C2.burning[i] = 0; C2.flooded[i] = 0;
    }
    C2.cash = 600000;
    C2.events.noDisasters = true;
    apply(C2, { kind: "road", tiles: [c2(10, 6)] });
    apply(C2, { kind: "road", tiles: [c2(20, 6)] });
    apply(C2, { kind: "rail", tiles: Array.from({ length: 12 }, (_, k) => c2(9 + k, 8)) });
    apply(C2, { kind: "station", tx: 9, ty: 8 });
    apply(C2, { kind: "station", tx: 20, ty: 8 });
    computeFields(C2);
    const platform = c2(9, 8), from = c2(10, 6), to = c2(20, 6);
    const route0 = commutePath(C2, "rabbit", from, to);
    const sig0 = C2._stationDoorSig;
    const doors0 = doors(C2, platform).join(",");
    // A sentinel with a REAL home and job, because `ops.apply` re-plans at the
    // op now: the old assertion was "the live path is null afterwards", which
    // was the shape of the bug, not of the fix. What the op has to do is
    // REBUILD the commute round the new building, in the same breath.
    apply(C2, { kind: "zone", zone: ZONE.R, x0: 10, y0: 5, x1: 10, y1: 5, density: 3 });
    apply(C2, { kind: "zone", zone: ZONE.C, x0: 20, y0: 5, x1: 20, y1: 5, density: 3 });
    C2.tier[c2(10, 5)] = 2;
    C2.tier[c2(20, 5)] = 2;
    computeFields(C2);
    const sentinel = { id: 1, species: 0, home: c2(10, 5), job: c2(20, 5), path: route0?.path, stale: false, dead: false };
    C2.citizens = [sentinel];
    C2.byId = new Map([[1, sentinel]]);
    const block = apply(C2, { kind: "police", tx: 7, ty: 5 });
    const route1 = commutePath(C2, "rabbit", from, to);
    const sig1 = C2._stationDoorSig;
    const doors1 = doors(C2, platform).join(",");
    const tiles0 = route0 ? Array.from(route0.path, (p) => p & TILE) : [];
    const tiles1 = route1 ? Array.from(route1.path, (p) => p & TILE) : [];
    const rerouted = tiles0.includes(c2(9, 7)) && !tiles1.includes(c2(9, 7))
      && [c2(10, 8), c2(10, 7)].every((i) => tiles1.includes(i));
    // REBUILT, not merely thrown away: a path, not stale, and it goes round.
    const live = sentinel.path ? Array.from(sentinel.path, (p) => p & TILE) : [];
    const rebuilt = !!sentinel.path && sentinel.stale === false && !live.includes(c2(9, 7));
    C2.citizens = [];
    C2.byId = new Map();
    const C3 = load(save(C2));
    const route2 = commutePath(C3, "rabbit", from, to);
    const reloadPath = !!route1 && !!route2 && Array.from(route1.path).join(",") === Array.from(route2.path).join(",");
    const same0 = stateHash(C2) === stateHash(C3);
    for (let k = 0; k < 12; k++) { tick(C2); tick(C3); }
    check("access: a forecourt reroute to the SAME door at the SAME distance changes the graph signature, REBUILDS the live commute round the new building at the op, and survives save → load → continue",
      block.ok && doors0 === `${from}` && doors1 === doors0 && sig1 !== sig0
        && rebuilt && rerouted && reloadPath && same0 && stateHash(C2) === stateHash(C3),
      `door ${doors0}→${doors1} · sig moved ${sig1 !== sig0} · the live commute rebuilt round it ${rebuilt} · rerouted ${rerouted} · reload ${reloadPath} · hash ${stateHash(C2)}/${stateHash(C3)}`);
  }

  // ---- WAREHOUSES: the frontage rule is gone --------------------------------
  {
    const I = clone();
    const iat = (x, y) => y * I.w + x;
    apply(I, { kind: "zone", zone: ZONE.I, x0: 26, y0: 7, x1: 26, y1: 9, density: 3 });
    computeFields(I);
    for (let d = 1; d <= 3; d++) { I.tier[iat(26, 6 + d)] = 2; I.lv[iat(26, 6 + d)] = 100; }
    const caps = [1, 2, 3].map((d) => lotScore(I, iat(26, 6 + d)).maxTier);
    check("access: a works three tiles from the road may reach tier 3 — SC2000's frontage rule held anything past ONE tile at tier 2, so the inside of an industrial block could never stand as tall as its edge",
      caps.every((m) => m === 3) && I.roadDist[iat(26, 9)] === 3 && I.roadDist[iat(26, 7)] === 1,
      `maxTier at 1/2/3 tiles: ${caps.join(" ")}`);
  }

  // ---- THE ZOO: jobs, halo and cap gated the same way -----------------------
  {
    const Z = clone();
    const zat = (x, y) => y * Z.w + x;
    apply(Z, { kind: "bulldoze", x0: 4, y0: 6, x1: 34, y1: 6, what: "road" });
    const below = [];
    for (let x = 4; x <= 34; x++) below.push(zat(x, 13));
    apply(Z, { kind: "road", tiles: below });
    const rz = apply(Z, { kind: "largePark", tx: 28, ty: 9 }); // (28,9) is 4 from the road; (28,10) is 3
    computeFields(Z);
    const anchor = zat(28, 9);
    check("access: a zoo is four tiles, asked once — its own anchor is out of reach and the zoo is served, because the corner behind it is not",
      rz.ok && zooAnchorOf(Z, zat(29, 10)) === anchor && siteTiles(Z, anchor).length === 9
        && Z.roadDist[anchor] === KNOBS.ROAD_REACH + 1 && siteRoadDist(Z, anchor) === 2 && sv(Z, anchor),
      `anchor tile ${Z.roadDist[anchor]} · site ${siteRoadDist(Z, anchor)}`);
    const on = census(Z);
    const lvOn = Z.lv[zat(28, 7)];
    apply(Z, { kind: "bulldoze", x0: 4, y0: 13, x1: 34, y1: 13, what: "road" });
    computeFields(Z);
    const offC = census(Z);
    const lvOff = Z.lv[zat(28, 7)];
    check("large park: the halo and population amenity survive loss of road access; keeper doors close",
      on.largeParks === 1 && offC.largeParks === 1 && lvOn === lvOff && doors(Z, anchor).length === 0,
      `zoos ${on.largeParks}→${offC.largeParks} · LV two tiles off ${lvOn}→${lvOff}`);
    // TWO zoos, corner to corner. `zooAnchorOf` looks north and west for an
    // anchor, so a part could in principle find the WRONG zoo's corner - but
    // only if two zoos overlapped, and ops.js refuses a zoo whose four tiles
    // are not all clear of civic. That refusal is what makes the search
    // unambiguous, so it is checked here beside the thing that relies on it.
    const N2 = load(save(F));
    const n2 = (x, y) => y * N2.w + x;
    apply(N2, { kind: "road", tiles: [n2(26, 13), n2(27, 13), n2(28, 13), n2(29, 13)] }); // both zoos need a road to be built at all
    const z1 = apply(N2, { kind: "largePark", tx: 26, ty: 14 });
    const z2 = apply(N2, { kind: "largePark", tx: 29, ty: 14 });
    const overlap = apply(N2, { kind: "largePark", tx: 27, ty: 13 });
    check("access: two zoos side by side keep their own four tiles, and an overlapping one is refused - which is why looking north and west for the corner can only find one",
      z1.ok && z2.ok && overlap.ok === false
        && zooAnchorOf(N2, n2(27, 15)) === n2(26, 14) && zooAnchorOf(N2, n2(30, 15)) === n2(29, 14)
        && siteTiles(N2, n2(27, 15)).length === 9 && siteTiles(N2, n2(30, 14)).length === 9,
      `${overlap.reason || "the overlap was allowed"}`);
    const K = load(save(Z));
    apply(K, { kind: "bulldoze", x0: 29, y0: 10, x1: 29, y1: 10, what: "civic" });
    check("access: and the bulldozer finds the same four tiles from any one of them — zooAnchorOf is the only thing in the game that knows how a zoo is laid out",
      siteTiles(K, zat(28, 9)).length === 1 && [zat(28, 9), zat(29, 9), zat(28, 10), zat(29, 10)].every((j) => K.civic[j] === CIVIC.NONE));
  }

  // ---- a real hiring, gated by the same predicate ---------------------------
  {
    const H = clone();
    const hat = (x, y) => y * H.w + x;
    apply(H, { kind: "zone", zone: ZONE.R, x0: 12, y0: 8, x1: 13, y1: 8, density: 3 });
    const rz = apply(H, { kind: "largePark", tx: 20, ty: 8 });
    for (const j of [hat(12, 8), hat(13, 8)]) H.tier[j] = 3;
    computeFields(H);
    recountRosters(H);
    for (let k = 0; k < 3; k++) placeHousehold(H, createHousehold(H, "cat", 4), hat(12, 8));
    let hired = 0;
    for (let t = 0; t < 8 && !hired; t++) { tick(H); hired = H.citizens.filter((c) => c.job === hat(20, 8)).length; }
    const keepers = H.citizens.filter((c) => c.job === hat(20, 8));
    check("access: the zoo two tiles off the road HIRES — the open-job index is built out of doors, so having a door IS having access, and there is no second test of it anywhere",
      rz.ok && sv(H, hat(20, 8)) && hired > 0 && keepers.every((c) => doors(H, hat(20, 8)).includes(c.path[c.path.length - 1] & TILE)),
      `${hired} keepers`);
    apply(H, { kind: "bulldoze", x0: 4, y0: 6, x1: 34, y1: 6, what: "road" });
    computeFields(H);
    for (let t = 0; t < 3; t++) tick(H);
    check("access: and lets them go when the road goes — the stale pass finds no door to walk to and releases the job, exactly as a razed road does",
      !sv(H, hat(20, 8)) && H.citizens.filter((c) => c.job === hat(20, 8)).length === 0,
      `${H.citizens.filter((c) => c.job === hat(20, 8)).length} still on the books`);
  }

  // ---- the whole scripted city, held to the standard ------------------------
  {
    // Every employed animal's stored path must be the CHEAPEST way from any of
    // its home's doors to any of its job's. This is what "all sides" means at
    // the scale of a town, and it is the invariant that fails the moment the
    // open-job index forgets one of a workplace's doors: the search would
    // still hire, by the long way round.
    let checked = 0;
    let dearer = 0;
    let offDoor = 0;
    for (const c of world.citizens) {
      if (c.dead || c.job < 0 || c.home < 0 || !c.path) continue;
      const hd = doors(world, c.home);
      const jd = doors(world, c.job);
      if (!hd.length || !jd.length) continue;
      checked++;
      if (!hd.includes(c.path[0] & TILE) || !jd.includes(c.path[c.path.length - 1] & TILE)) offDoor++;
      const best = commutePath(world, c.species, hd, jd);
      if (!best || commuteTime(c.path) > commuteTime(best.path) + 1e-9) dearer++;
    }
    check("access: in the whole scripted town every commute starts at one of its home's doors, ends at one of its work's, and is the cheapest pairing of the two — nobody walks round a block to a side that is not the near one",
      checked > 50 && offDoor === 0 && dearer === 0,
      `${checked} commutes · ${offDoor} off a door · ${dearer} dearer than the best pairing`);
  }

  // ---- the field is live at the OP, not at the next month -------------------
  {
    const P = createWorld({ seed: "access-op" });
    const pat = (x, y) => y * P.w + x;
    for (let y = 2; y <= 20; y++) for (let x = 2; x <= 20; x++) { const i = pat(x, y); P.terrain[i] = TERRAIN.GRASS; P.road[i] = ROAD.NONE; P.zone[i] = ZONE.NONE; P.tier[i] = 0; P.wall[i] = 0; P.rail[i] = 0; P.civic[i] = 0; }
    P.roadsDirty = true;
    computeFields(P);
    apply(P, { kind: "zone", zone: ZONE.R, x0: 10, y0: 10, x1: 10, y1: 10, density: 3 });
    const before = sv(P, pat(10, 10));
    const road = [];
    for (let x = 6; x <= 16; x++) road.push(pat(x, 8));
    apply(P, { kind: "road", tiles: road });
    // NOT ticked. Every loaded city opens PAUSED, so the card and the overlay
    // have to be right the instant the road is drawn or the player is told a
    // lie for as long as they leave it paused.
    const live = sv(P, pat(10, 10)) && P.roadsDirty === false && lotReport(P, pat(10, 10)).siteDist === 2 && lotReport(P, pat(10, 10)).doors.length === 1;
    const fieldAtOp = Array.from(P.roadDist);
    P.roadsDirty = true;
    computeRoadDist(P);
    check("access: a road is in the field the moment it is drawn — and it is the same field the tick would have built, so nothing about the hash moves",
      !before && live && fieldAtOp.every((v, i) => v === P.roadDist[i]),
      `before ${before} · after the op ${sv(P, pat(10, 10))} · dirty ${P.roadsDirty}`);
    // The STATION LINKS are derived from the same field, so they are rebuilt at
    // the op too. This is the check that makes that line load-bearing rather
    // than insurance: move the road away from a line WITHOUT ticking, and the
    // ride has to stop at once. Left to the tick, the graph would carry edges
    // to a door that is now grass, and a commute would walk a tile that is no
    // longer a road.
    // Written the other way round on purpose. Moving the road AWAY does not
    // discriminate: with stale links the graph still holds an edge to a tile
    // that is now grass, the walk cannot leave it, and the commute falls back
    // to the road either way - the check passed with the op-time rebuild
    // deleted. Moving the road CLOSER can only work if the links were rebuilt.
    const V = clone();
    const vat = (x, y) => y * V.w + x;
    apply(V, { kind: "bulldoze", x0: 4, y0: 6, x1: 34, y1: 6, what: "road" });
    const far2 = [];
    for (let x = 4; x <= 34; x++) far2.push(vat(x, 5));
    apply(V, { kind: "road", tiles: far2 });
    const vline = [];
    for (let x = 6; x <= 32; x++) vline.push(vat(x, 9)); // four tiles from the only road: out of reach
    apply(V, { kind: "rail", tiles: vline });
    apply(V, { kind: "station", tx: 8, ty: 9 });
    apply(V, { kind: "station", tx: 30, ty: 9 });
    computeFields(V);
    const rideBefore = commutePath(V, "rabbit", [vat(6, 5)], [vat(32, 5)]);
    const silentBefore = !sv(V, vat(8, 9)); // read NOW: the second op is about to make it served
    const near2 = [];
    for (let x = 4; x <= 34; x++) near2.push(vat(x, 6)); // now three tiles from the line, and NOT ticked
    apply(V, { kind: "road", tiles: near2 });
    const rideAfter = commutePath(V, "rabbit", [vat(6, 6)], [vat(32, 6)]);
    const offRoad = rideAfter ? Array.from(rideAfter.path, (x) => x & TILE).filter((x, k) => !(rideAfter.path[k] & RIDE) && V.road[x] === ROAD.NONE && V.rail[x] !== 2 && !passable(V, x)) : [];
    check("access: the station links are rebuilt at the OP as well — lay a road within reach of a silent line and the very next commute rides it, without waiting for the month to turn",
      !!rideBefore && !ridesPath(rideBefore.path) && silentBefore && sv(V, vat(8, 9))
        && !!rideAfter && ridesPath(rideAfter.path) && offRoad.length === 0 && V.roadsDirty === false,
      `before rode ${rideBefore && ridesPath(rideBefore.path)} · after rode ${rideAfter && ridesPath(rideAfter.path)}`);

    const u = undo(P);
    check("access: and undo takes the field back with the road",
      u.ok && !sv(P, pat(10, 10)) && P.roadDist[pat(10, 10)] === KNOBS.ROAD_REACH + 1 && P.roadsDirty === false);
  }

  // ---- the rule reads the road ONLY through `served` ------------------------
  {
    // The grep below is one spelling deep. This is the claim behind it, put
    // where a grep cannot reach: two lots alike in everything the rule reads
    // EXCEPT their distance to a road, both served, must score and cap the
    // same. A frontage rule — SC2000's `roadDist <= 1`, or the same idea
    // spelled as an N4 scan over world.road — makes them differ, whatever it
    // is written in.
    const D = clone();
    const dat = (x, y) => y * D.w + x;
    apply(D, { kind: "zone", zone: ZONE.R, x0: 14, y0: 7, x1: 17, y1: 9, density: 3 });
    apply(D, { kind: "zone", zone: ZONE.C, x0: 20, y0: 7, x1: 23, y1: 9, density: 3 });
    apply(D, { kind: "zone", zone: ZONE.I, x0: 26, y0: 7, x1: 29, y1: 9, density: 3 });
    apply(D, { kind: "zone", zone: ZONE.M, x0: 32, y0: 7, x1: 33, y1: 9, density: 3 });
    computeFields(D);
    const rows = [];
    for (const [name, x] of [["R", 14], ["C", 20], ["I", 26], ["M", 32]]) {
      const near = dat(x, 7);   // one tile from the road
      const farr = dat(x, 9);   // three tiles from it — both served
      for (const j of [near, farr]) { D.tier[j] = 2; D.lv[j] = 70; D.pol[j] = 4; D.crime[j] = 8; D.dread[j] = 0; D.maxTier[j] = 3; }
      const a = lotScore(D, near);
      const b = lotScore(D, farr);
      rows.push({ name, ok: sv(D, near) && sv(D, farr) && D.roadDist[near] === 1 && D.roadDist[farr] === 3 && a.maxTier === b.maxTier && Math.abs(a.score - b.score) < 1e-9 && a.reason === b.reason, a: `${a.maxTier}/${a.score.toFixed(3)}`, b: `${b.maxTier}/${b.score.toFixed(3)}` });
    }
    check("access: the rule reads the road ONLY through `served` — two lots alike in all it reads but one and three tiles out, both served, cap and score identically in every zone",
      rows.every((r) => r.ok), rows.map((r) => `${r.name} ${r.a} vs ${r.b}`).join(" · "));
  }

  // ---- WHO is asking ---------------------------------------------------------
  {
    const A2 = clone();
    const a2 = (x, y) => y * A2.w + x;
    apply(A2, { kind: "zone", zone: ZONE.R, x0: 12, y0: 12, x1: 12, y1: 12, density: 3 });
    apply(A2, { kind: "park", tx: 14, ty: 12 });
    // A road for the zoo and the station to be built beside: a civic that
    // could not be reached can no longer be placed at all.
    apply(A2, { kind: "road", tiles: [a2(16, 11), a2(17, 11), a2(18, 11), a2(19, 11), a2(20, 11), a2(21, 11)] });
    apply(A2, { kind: "zoo", tx: 16, ty: 12 });
    apply(A2, { kind: "police", tx: 20, ty: 12 });
    apply(A2, { kind: "rail", tiles: [a2(24, 12), a2(25, 12)] });
    apply(A2, { kind: "station", tx: 24, ty: 12 });
    computeFields(A2);
    check("access: a PARK never asks — the overlay's red and the card's warning are refusals, and the one civic that needs no road is never told it has none",
      asksAccess(A2, a2(12, 12)) && asksAccess(A2, a2(16, 12)) && asksAccess(A2, a2(17, 13)) && asksAccess(A2, a2(20, 12)) && asksAccess(A2, a2(24, 12))
        && !asksAccess(A2, a2(14, 12)) && !asksAccess(A2, a2(30, 20)) && !asksAccess(A2, a2(25, 12)),
      `park ${asksAccess(A2, a2(14, 12))} · grass ${asksAccess(A2, a2(30, 20))} · plain rail ${asksAccess(A2, a2(25, 12))}`);
  }

  // ---- ROAD_REACH is a knob, and everything that reads it moves with it -----
  {
    const K2 = clone();
    const k2 = (x, y) => y * K2.w + x;
    apply(K2, { kind: "zone", zone: ZONE.R, x0: 12, y0: 7, x1: 12, y1: 14, density: 3 });
    const saveReach = KNOBS.ROAD_REACH;
    KNOBS.ROAD_REACH = 5;
    K2.roadsDirty = true;
    computeFields(K2);
    const at5 = sv(K2, k2(12, 11)) && doors(K2, k2(12, 11)).length === 1;
    const at6 = !sv(K2, k2(12, 12));
    const near = nearestRoad(K2, k2(12, 12));
    // THE HORIZON IS READ WHILE THE KNOB IS MOVED. The claim is that the
    // card's "how far is the nearest road, really" looks further than the
    // rule does, whatever the rule is - and it was evaluated AFTER the restore
    // below, so it read 8 > 3 and could not fail. It was false, too:
    // NEAR_REACH was a module-load constant, so at ROAD_REACH 9 the card
    // looked LESS far than the rule. Both settings are asked now, and the
    // second is the one the old code got wrong.
    const horizon5 = FI.nearReach();
    KNOBS.ROAD_REACH = 9;
    const horizon9 = FI.nearReach();
    KNOBS.ROAD_REACH = saveReach;
    K2.roadsDirty = true;
    computeFields(K2);
    check("access: ROAD_REACH is a KNOB — at 5 a lot five tiles out is served with a door, six is not, and the card's horizon still looks further than the rule does at 5 AND at 9",
      at5 && at6 && near.d === 6 && near.doors.length === 1
        && horizon5 > 5 && horizon9 > 9 && FI.nearReach() > KNOBS.ROAD_REACH
        && sv(K2, k2(12, 9)) && !sv(K2, k2(12, 10)),
      `at 5 ${at5} · at 6 ${at6} · nearest ${near.d} · horizon ${horizon5} at reach 5, ${horizon9} at 9, ${FI.nearReach()} at ${KNOBS.ROAD_REACH}`);
  }

  // ---- ONE implementation ---------------------------------------------------
  {
    const simDir = path.join(ROOT, "js", "sim");
    // The one line allowed to read the raw field outside fields.js: the hover
    // card prints the TILE's own distance beside the site's, and decides
    // nothing with it. Any other read is a rule growing a second copy.
    const ALLOWED = /roadDist: world\.roadDist\[i\], \/\/ this TILE's distance/;
    const offenders = [];
    const served5 = [];
    for (const f of readdirSync(simDir)) {
      if (!/\.js$/.test(f)) continue;
      const src = readFileSync(path.join(simDir, f), "utf8");
      if (f !== "fields.js" && /import \{[^}]*\bserved\b[^}]*\} from "\.\/fields\.js"/.test(src)) served5.push(f);
      if (f === "fields.js") continue;
      src.split("\n").forEach((lineTxt, k) => {
        if (!/roadDist\s*\[/.test(lineTxt)) return;
        if (/^\s*(\/\/|\*)/.test(lineTxt) || ALLOWED.test(lineTxt)) return;
        offenders.push(`${f}:${k + 1} ${lineTxt.trim().slice(0, 60)}`);
      });
    }
    check("access: ONE implementation — no module in js/sim outside fields.js tests a road's nearness for itself; there is one predicate and nowhere else to ask",
      offenders.length === 0, offenders.join(" · "));
    // WHO CAN MOVE THE GROUND A FORECOURT STANDS ON. `passable` reads SIX
    // fields, not three: `terrain`, `tier` and `civic` directly, and `wall`,
    // `road` and `rail` through `reach.isBarrier` - the last two being how a
    // tunnel is a way rather than a wall. Every place any of the six is
    // written has to be followed by a settle, or stored commutes walk through
    // a building, or across a lake. There are five modules, and each one's
    // settle is mutation-tested by name elsewhere in this section:
    //
    //   lots.js, blocks.js   inside lotsTick        -> tick.js settles at 4b
    //   events.js            inside eventsTick      -> tick.js settles at 7c
    //                        (it razes buildings AND it can open new WATER)
    //   ops.js               a player op or an undo -> ops settles at the op
    //   world.js             worldgen, before a tick has ever run
    //
    // This is a TRIPWIRE, not the proof - the proofs are the behavioural
    // checks above. It fires when a SIXTH module starts writing that ground,
    // which is the moment someone has to decide where its settle goes.
    const groundWriters = [];
    const WRITE = /\b\w+\.(?:terrain|tier|civic|wall|rail|road)\s*\[[^\]]*\]\s*(?:=[^=]|\+\+|--|\+=|-=)/;
    for (const f of readdirSync(simDir)) {
      if (!/\.js$/.test(f)) continue;
      const src = readFileSync(path.join(simDir, f), "utf8");
      if (src.split("\n").some((l) => WRITE.test(l) && !/^\s*(\/\/|\*)/.test(l))) groundWriters.push(f);
    }
    check("access: exactly five modules move the ground a forecourt stands on — lots and blocks inside lotsTick, events inside eventsTick (it razes buildings AND it can open new water), ops at the op, and worldgen before any of it — and the tick settles the door graph after each of the three windows; a sixth writer means a fourth settle to decide on",
      groundWriters.join(" ") === "blocks.js events.js lots.js ops.js world.js",
      `${groundWriters.length} write terrain, tier or civic: ${groundWriters.join(" ")}`);
    const anyHasAccess = readdirSync(path.join(ROOT, "js"), { recursive: true })
      .filter((f) => typeof f === "string" && /\.js$/.test(f))
      .some((f) => /hasAccess/.test(readFileSync(path.join(ROOT, "js", f), "utf8")));
    // FIVE, and the five are NAMED. The name used to say six and the
    // assertion said ">= 5", so the number in the sentence was untested by
    // construction - and it was wrong. An exact list fails in both directions:
    // a module that stops asking, and a module that starts.
    check("access: and the OLD predicate is gone, not merely unused — `hasAccess` is nowhere under js/, and five sim modules import `served`: blocks, census, events, justice and lots; ops uses the shared touchesRoad placement rule",
      !anyHasAccess && served5.join(" ") === "blocks.js census.js events.js justice.js lots.js" && /touchesRoad/.test(readFileSync(path.join(ROOT,"js/sim/ops.js"),"utf8")),
      `${served5.length} sim modules import served: ${served5.join(" ")}`);
  }

  // ---- the card says it ------------------------------------------------------
  {
    const { installDom, stubApp, textOf } = await import("./dom-shim.mjs");
    installDom();
    const { createUI } = await import("../js/ui.js");
    const U = clone();
    const uat = (x, y) => y * U.w + x;
    apply(U, { kind: "zone", zone: ZONE.R, x0: 12, y0: 7, x1: 12, y1: 9, density: 3 });
    apply(U, { kind: "zone", zone: ZONE.R, x0: 12, y0: 12, x1: 12, y1: 12, density: 3 });
    computeFields(U);
    const ui = createUI(stubApp(U));
    const card = (i) => { ui.updateHover({ tile: i, pinned: true }); return textOf(document.getElementById("card")); };
    const one = card(uat(12, 7));
    const three = card(uat(12, 9));
    const none = card(uat(12, 12));
    const two = card(uat(12, 8));
    check("access: the card says the distance and the door, in the words the rule uses, at one tile, at two and at three",
      /road access: 1 tile · door \(12,6\)/.test(one) && /road access: 2 tiles · door \(12,6\)/.test(two) && /road access: 3 tiles · door \(12,6\)/.test(three),
      [one, two, three].map((c) => (c.match(/road access:[^\n]*/) || [""])[0]).join(" —— "));
    check("access: and on a lot the rule refuses it says how far the nearest road actually is — the question a player asks the moment they see the red",
      /road access: none — the nearest road is 6 tiles away at \(12,6\), 3 too far/.test(none),
      (none.match(/no road[^\n]*/) || [""])[0]);
  }

  // ---- the overlay paints the number the rule reads --------------------------
  {
    const HC = await import("./headless-canvas.mjs");
    HC.installCanvas();
    const { createRenderer } = await import("../js/render.js");
    const { art: artR } = await import("../js/art/index.js");
    const { toScreen: ts } = await import("../js/iso/iso.js");
    const O = clone();
    const oat = (x, y) => y * O.w + x;
    // The ladder is ZONED here: the greens are reach and are painted on any
    // ground, but the red is a refusal and is painted only where something is
    // asking. An unzoned tile at 4 is countryside, and the check below holds
    // that distinction as hard as it holds the bands.
    apply(O, { kind: "zone", zone: ZONE.R, x0: 10, y0: 7, x1: 10, y1: 12, density: 3 }); // 1..6 tiles out: 4 is a refusal at reach 3, 5 is served at reach 5
    apply(O, { kind: "zone", zone: ZONE.R, x0: 22, y0: 8, x1: 24, y1: 10, density: 3 });
    for (let y = 8; y <= 10; y++) for (let x = 22; x <= 24; x++) O.tier[oat(x, y)] = 3;
    computeFields(O);
    const anchor = oat(22, 8);
    const btiles = [];
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) btiles.push(anchor + dx + dy * O.w);
    // A line well south of the road, with a station on it: out of reach, and
    // the one refusal besides a zoned lot whose ground the sprite does not hide.
    const oline = [];
    for (let x = 18; x <= 28; x++) oline.push(oat(x, 13));
    apply(O, { kind: "rail", tiles: oline });
    apply(O, { kind: "station", tx: 22, ty: 13 });
    computeFields(O);
    BL.mergeLots(O, { side: 3, anchor, tiles: btiles });
    // Every overlay in this game is painted on the ground and then built over,
    // so a building hides its own tile's tint. To PHOTOGRAPH the band under
    // the block the storeys come down first (`big` is the footprint, `tier`
    // the storeys, and siteRoadDist reads only the footprint) - the tiles keep
    // being one 3x3 site, which is the whole claim.
    for (const j of btiles) O.tier[j] = 0;
    const canvas = HC.createCanvas(700, 460);
    const renderer = createRenderer(canvas, O, artR);
    const [ax, ay] = ts(17.5, 9.5);
    const camera = { x: ax, y: ay, zoom: 1 };
    const shot = (mode) => { renderer.invalidate(); renderer.draw(camera, null, { list: () => [] }, mode, 0); return Buffer.from(canvas._data); };
    // A pixel of a tile, found the renderer's OWN way: the projection point of
    // the tile's centre, then pick() asked what is under it. If pick disagrees
    // the probe returns −1 and the check fails rather than reading a stray
    // pixel and passing for the wrong reason.
    const pixelOf = (tx, ty) => {
      const [sx, sy] = ts(tx + 0.5, ty + 0.5);
      const px = Math.round((sx - camera.x) * camera.zoom + canvas.width / 2);
      const py = Math.round((sy - camera.y) * camera.zoom + canvas.height / 2);
      if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return -1;
      const got = renderer.pick(px, py);
      return got && got[0] === tx && got[1] === ty ? (py * canvas.width + px) * 4 : -1;
    };
    O.use[oat(10, 7)] = USE.RABBIT | USE.FOX;
    const off = shot("off");
    const acc = shot("access");
    const useLayer = shot("use");
    const colour = (buf, o) => (buf[o] << 16) | (buf[o + 1] << 8) | buf[o + 2];
    const bands = [1, 2, 3, 4].map((d) => pixelOf(10, 6 + d));
    const onRoad = pixelOf(10, 6);
    const useSpot = pixelOf(10, 7), mixedSpot = pixelOf(10, 8);
    check("use: the real renderer paints a combined species mask and leaves the neighbouring mixed lot untinted",
      useSpot >= 0 && mixedSpot >= 0
        && colour(useLayer, useSpot) !== colour(off, useSpot)
        && colour(useLayer, mixedSpot) === colour(off, mixedSpot),
      `combined ${useSpot >= 0 ? colour(off, useSpot).toString(16) + "→" + colour(useLayer, useSpot).toString(16) : "no pixel"} · mixed ${mixedSpot >= 0 ? colour(off, mixedSpot).toString(16) + "→" + colour(useLayer, mixedSpot).toString(16) : "no pixel"}`);
    check("access: the overlay is REAL — the renderer paints four different bands for one, two, three tiles and out of reach, and leaves the road itself untinted",
      bands.every((o) => o >= 0) && onRoad >= 0
        && new Set(bands.map((o) => colour(acc, o))).size === 4
        && bands.every((o) => colour(acc, o) !== colour(off, o))
        && colour(acc, onRoad) === colour(off, onRoad),
      bands.map((o) => (o < 0 ? "no pixel" : colour(acc, o).toString(16))).join(" "));
    const bcorner = pixelOf(24, 10);
    const loneFar = pixelOf(10, 10);
    check("access: and it paints the number the RULE reads — the far corner of a served block takes the block's band, not the red its own tile would take",
      bcorner >= 0 && loneFar >= 0 && O.roadDist[oat(24, 10)] > KNOBS.ROAD_REACH && O.roadDist[oat(10, 10)] > KNOBS.ROAD_REACH
        && colour(acc, bcorner) === colour(acc, pixelOf(22, 8)) && colour(acc, bcorner) !== colour(acc, loneFar),
      `corner ${bcorner >= 0 ? colour(acc, bcorner).toString(16) : "?"} vs the lone tile ${loneFar >= 0 ? colour(acc, loneFar).toString(16) : "?"}`);
    // The red is a refusal, not a map of the countryside: the same distance,
    // zoned and unzoned, and only one of them is painted.
    const wildFar = pixelOf(14, 11);
    check("access: the red says NO to something that asked — a zoned lot four tiles out is painted, the open country beside it at the same distance is left alone",
      loneFar >= 0 && wildFar >= 0 && O.zone[oat(10, 10)] !== ZONE.NONE && O.zone[oat(14, 11)] === ZONE.NONE
        && O.roadDist[oat(14, 11)] > KNOBS.ROAD_REACH
        && colour(acc, loneFar) !== colour(acc, wildFar) && colour(acc, wildFar) === colour(off, wildFar),
      `zoned ${loneFar >= 0 ? colour(acc, loneFar).toString(16) : "?"} · open country ${wildFar >= 0 ? colour(acc, wildFar).toString(16) : "?"} (untinted ${wildFar >= 0 ? colour(off, wildFar).toString(16) : "?"})`);
    // LEGIBILITY, measured. The check above compares ONE pixel of each band
    // against the same pixel unpainted, and that cannot see the failure the
    // owner found: the first shipped ramp was three greens, band 1 over grass
    // mid rendered #96AF50, and the grass ramp's own light shade is #96A551.
    // Unequal, and invisible. A ground diamond is painted from SEVERAL shades
    // of one ramp and its untinted neighbours use the same ramp, so the real
    // question is whether a tinted tile's WHOLE palette stays clear of the
    // bare ground's whole palette - and whether the bands stay clear of each
    // other. Weighted distance (green weighted most, as the eye does).
    const palette = (buf, tx, ty) => {
      const [sx, sy] = ts(tx + 0.5, ty + 0.5);
      const bx = Math.round((sx - camera.x) * camera.zoom + canvas.width / 2);
      const by = Math.round((sy - camera.y) * camera.zoom + canvas.height / 2);
      const out = new Set();
      for (let dy = -7; dy <= 7; dy++) for (let dx = -14; dx <= 14; dx++) {
        const px = bx + dx;
        const py = by + dy;
        if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) continue;
        const got = renderer.pick(px, py);
        if (!got || got[0] !== tx || got[1] !== ty) continue;
        out.add(colour(buf, (py * canvas.width + px) * 4));
      }
      return [...out];
    };
    const apart = (a, b) => {
      const dr = ((a >> 16) & 255) - ((b >> 16) & 255);
      const dg = ((a >> 8) & 255) - ((b >> 8) & 255);
      const db = (a & 255) - (b & 255);
      return Math.sqrt(2 * dr * dr + 4 * dg * dg + 3 * db * db) / 3;
    };
    const gap = (xs, ys) => { let m = Infinity; for (const a of xs) for (const b of ys) m = Math.min(m, apart(a, b)); return m; };
    const painted = [1, 2, 3, 4].map((d) => palette(acc, 10, 6 + d));
    const bare = [1, 2, 3, 4].map((d) => palette(off, 10, 6 + d)).flat().concat(palette(off, 14, 11), palette(acc, 14, 11));
    const LEGIBLE = 8;
    let worstBare = Infinity;
    let worstBand = Infinity;
    for (let i = 0; i < painted.length; i++) {
      worstBare = Math.min(worstBare, gap(painted[i], bare));
      for (let j = i + 1; j < painted.length; j++) worstBand = Math.min(worstBand, gap(painted[i], painted[j]));
    }
    check("access: and the bands are LEGIBLE, not merely different — every colour a tinted tile shows stays clear of every colour the bare ground shows, and of the other bands; three greens failed this at 4 because band 1 over grass mid rendered as the grass ramp's own light shade",
      painted.every((pp) => pp.length >= 3) && worstBare > LEGIBLE && worstBand > LEGIBLE,
      `worst against bare ground ${worstBare.toFixed(1)} · worst between bands ${worstBand.toFixed(1)} · the gate is ${LEGIBLE}`);

    // A PLATFORM out of reach is a refusal too, and it is the only one of the
    // three arms that can be photographed: a zoo's own sprite covers all four
    // of its ground diamonds, so the overlay under a zoo is invisible — a real
    // limitation of painting on the ground, recorded in the BACKLOG.
    const anyPixel = (tx, ty) => {
      const [sx, sy] = ts(tx + 0.5, ty + 0.5);
      const bx = Math.round((sx - camera.x) * camera.zoom + canvas.width / 2);
      const by = Math.round((sy - camera.y) * camera.zoom + canvas.height / 2);
      for (let dy = -14; dy <= 14; dy += 2) for (let dx = -26; dx <= 26; dx += 2) {
        const px = bx + dx;
        const py = by + dy;
        if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) continue;
        const got = renderer.pick(px, py);
        if (!got || got[0] !== tx || got[1] !== ty) continue;
        const o = (py * canvas.width + px) * 4;
        if (colour(acc, o) !== colour(off, o)) return colour(acc, o);
      }
      return -1;
    };
    const platRed = anyPixel(22, 13);
    check("access: a PLATFORM out of reach takes the same red a refused lot takes — the overlay's red is every refusal, not the zoned ones only",
      O.rail[oat(22, 13)] === 2 && !sv(O, oat(22, 13)) && platRed >= 0 && platRed === colour(acc, loneFar),
      `platform ${platRed >= 0 ? platRed.toString(16) : "no tinted pixel"} vs a refused lot ${colour(acc, loneFar).toString(16)}`);
    // THE NO-ROAD ZOT IS NOT A LOT'S ALONE. The owner, 2026-09-04, on a
    // platform no road reaches: it "should have the no road symbol like houses
    // that are too far from the road". So the zot pass follows `asksAccess` -
    // the one list of what asks for a road - and a stranded platform or a fire
    // station whose road was bulldozed says so ON THE MAP, not only in the
    // card. Photographed on ITS OWN WORLD and its own canvas, because serving
    // the platform is the experiment and `O` is still needed unserved below.
    {
      const ZW = load(save(O));
      const zc = HC.createCanvas(700, 460);
      const zr = createRenderer(zc, ZW, artR);
      // A zot BLINKS (`Math.floor(clock * 1.5) & 1`), so the shutter has to be
      // open on the lit half of it or the photograph is of nothing.
      const zshot = () => { zr.invalidate(); zr.draw(camera, null, { list: () => [] }, "off", 1); return Buffer.from(zc._data); };
      const zpix = (buf) => {
        const [sx, sy] = ts(22.5, 13.5);
        const bx = Math.round((sx - camera.x) * camera.zoom + zc.width / 2);
        const by = Math.round((sy - camera.y) * camera.zoom + zc.height / 2);
        const out = [];
        // A zot floats ABOVE whatever stands on the tile, and a station house
        // is tall - so the window has to reach well over the platform.
        for (let dy = -70; dy <= 6; dy++) for (let dx = -20; dx <= 20; dx++) {
          const px = bx + dx;
          const py = by + dy;
          if (px < 0 || py < 0 || px >= zc.width || py >= zc.height) continue;
          out.push(colour(buf, (py * zc.width + px) * 4));
        }
        return out;
      };
      const marked = zpix(zshot());
      const reached = apply(ZW, { kind: "road", tiles: [oat(22, 10), oat(23, 10)] }); // three tiles north, a different diamond
      computeFields(ZW);
      const clear = zpix(zshot());
      let moved = 0;
      for (let k = 0; k < marked.length; k++) if (marked[k] !== clear[k]) moved++;
      check("access: a platform no road reaches wears the NO ROAD zot, like a house too far from one — the mark is drawn over the platform while nothing can reach it and is gone once a road three tiles away reaches it, so the MAP says it and not only the card",
        !sv(O, oat(22, 13)) && reached.ok && sv(ZW, oat(22, 13)) && moved > 8,
        `${moved} of ${marked.length} pixels over the platform changed when a road reached it`);
    }

    // AND THE DRAW LAYER WRITES NOTHING ON THE WORLD (SPEC 14). Asking
    // `siteRoadDist` of a platform is a SEARCH, and a search needs a `seen`
    // array - so the overlay was filling `world._seen`, per platform tile per
    // frame, in the same file whose walker layer is forbidden a world buffer
    // for exactly this reason. The world's own scratch is STAMPED and a frame
    // is drawn over it; the stamp has to survive, and the frame has to still
    // be a frame (the platform is still painted its refusal red), or a
    // renderer that drew nothing would pass.
    O._seen.fill(0xab);
    const stamped = O._seen.reduce((a, b) => a + b, 0);
    const acc2 = shot("access");
    const kept = O._seen.reduce((a, b) => a + b, 0);
    const stillRed = (() => {
      const [sx, sy] = ts(22.5, 13.5);
      const bx = Math.round((sx - camera.x) * camera.zoom + canvas.width / 2);
      const by = Math.round((sy - camera.y) * camera.zoom + canvas.height / 2);
      for (let dy = -14; dy <= 14; dy += 2) for (let dx = -26; dx <= 26; dx += 2) {
        const px = bx + dx;
        const py = by + dy;
        if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) continue;
        const got = renderer.pick(px, py);
        if (!got || got[0] !== 22 || got[1] !== 13) continue;
        const o = (py * canvas.width + px) * 4;
        if (colour(acc2, o) !== colour(off, o)) return colour(acc2, o);
      }
      return -1;
    })();
    check("access: and drawing the overlay writes NOTHING on the world — the whole-map access pass asks a search of every platform it can see, and it brings its own scratch: the world's is stamped, the frame is drawn, and the stamp is still there afterwards",
      O._seen.length === O.w * O.h && stamped === 0xab * O._seen.length && kept === stamped && stillRed === platRed,
      `stamp ${stamped} → ${kept} over ${O._seen.length} tiles · the platform is still painted ${stillRed >= 0 ? stillRed.toString(16) : "NOTHING"}`);
    // AND THE BANDS SURVIVE THE KNOB MOVING. A fixed five-entry tint table read
    // at ROAD_REACH 5 handed a SERVED lot at five tiles the refusal red and an
    // unserved one `undefined` — no fill at all. The overlay's meaning
    // inverted, and every check passed, because they all ran at 3.
    const saveReach2 = KNOBS.ROAD_REACH;
    KNOBS.ROAD_REACH = 5;
    O.roadsDirty = true;
    computeFields(O);
    const acc5 = shot("access");
    const green3 = colour(acc, bands[2]);            // the deepest green at reach 3
    const at5 = pixelOf(10, 11);                     // five tiles out: served now
    const at6 = pixelOf(10, 12);                     // six: not
    const five = at5 >= 0 ? colour(acc5, at5) : -1;
    const six = at6 >= 0 ? colour(acc5, at6) : -1;
    KNOBS.ROAD_REACH = saveReach2;
    O.roadsDirty = true;
    computeFields(O);
    check("access: and the bands survive ROAD_REACH moving — at 5 a lot five tiles out takes the deepest GREEN and one six out takes the red; the table is indexed by distance and clamped, not counted out to a fixed length",
      at5 >= 0 && at6 >= 0 && five === green3 && six === colour(acc, loneFar) && five !== six,
      `five ${five >= 0 ? five.toString(16) : "?"} (deepest green ${green3.toString(16)}) · six ${six >= 0 ? six.toString(16) : "?"} (red ${colour(acc, loneFar).toString(16)})`);
    // main.js boots the whole app on import, so the key map is read as source.
    const mainSrc = readFileSync(path.join(ROOT, "js", "main.js"), "utf8");
    check("access: the O key reaches it, and it has a word to say for itself",
      /const OVERLAYS = \[[^\]]*"access"[^\]]*\]/.test(mainSrc) && /access: "Overlay: road access[^"]+"/.test(mainSrc));
  }
  void _rr;
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

// ---- Part B': compact saves and old-save migration --------------------------
{
  const fixture = readFileSync(path.join(ROOT, "docs/fixtures/save-v1-plain.json"), "utf8");
  const oldBytes = Buffer.byteLength(fixture);
  const migrated = load(fixture);
  const compactJson = save(migrated);
  const compact = JSON.parse(compactJson);
  const sample = compact.citizens[0];
  check("lives: old plain citizen save restores omitted defaults",
    migrated.citizens[0].job === -1 && migrated.citizens[0].mood === 50
      && migrated.citizens[0].heldAt === -1 && Array.isArray(migrated.citizens[0].life));
  check("lives: compact save omits default-valued citizen fields",
    !("job" in sample) && !("life" in sample) && !("mood" in sample)
      && !("fixed" in sample) && Buffer.byteLength(compactJson) < oldBytes,
    `${Buffer.byteLength(compactJson)} compact vs ${oldBytes} old bytes`);
  check("lives: compact save round-trips without changing canonical state",
    stateHash(migrated) === stateHash(load(compactJson)));
  for (let t = 0; t < 10 * 12; t++) tick(migrated);
  check("lives: v1 plain fixture continues ten years with saved building-age history",
    stateHashNoNews(migrated) === "5bbfb789", `${stateHashNoNews(migrated)} without news · ${stateHash(migrated)} with news`);
}

// ---- Part B'': lives, graveyard, memorial, and the call-site mutation run ---
{
  const { KIND, LIFE_MAX, lifeLines, memorial, remember } = await import("../js/sim/life.js");
  const { compact, createHousehold, placeHousehold, removeCitizen } = await import("../js/sim/citizens.js");
  const { DIET_OF } = await import("../js/sim/species.js");
  const { archiveCitizen, decodeLegacy, epitaph, legacyCode, legacyOf, legacyStats } = await import("../js/sim/legacy.js");

  const Z = createWorld({ seed: "life-zoo-job", w: 8, h: 8 });
  for (const i of [9, 10, 11, 17, 18, 19, 25, 26, 27]) {
    Z.terrain[i] = 0; Z.road[i] = 0; Z.zone[i] = 0; Z.civic[i] = 0; Z.wall[i] = 0; Z.rail[i] = 0;
  }
  Z.terrain[8]=0; Z.road[8]=ROAD.ROAD; Z.roadsDirty=true;
  const builtZoo = apply(Z, { kind: "zoo", tx: 1, ty: 1 });
  const zh = createHousehold(Z, "owl", 2);
  const zooWorker = Z.byId.get(zh.members[0]);
  zooWorker.job = 9; zooWorker.hired = 0; Z.staff[9] = 1;
  const razedZoo = apply(Z, { kind: "bulldoze", x0: 1, y0: 1, x1: 1, y1: 1 });
  const zooJobLost = zooWorker.life.find((e) => e[1] === KIND.LOST_JOB);
  check("lives: demolishing a zoo releases its worker through LOST_JOB",
    builtZoo.ok && razedZoo.ok && zooWorker.job === -1 && Z.staff[9] === 0 && zooJobLost?.[2] === 9);

  const R = createWorld({ seed: "life-ring", w: 8, h: 8 });
  const rh = createHousehold(R, "rabbit", 2);
  const rc = R.byId.get(rh.members[0]);
  remember(R, rc, KIND.BORN, 9);
  remember(R, rc, KIND.MOVED, 10);
  for (let n = 0; n < 20; n++) { R.tick++; remember(R, rc, KIND.MOVED, n); }
  check("lives: the ring is twelve and preserves its pinned first two entries",
    rc.life.length === LIFE_MAX && rc.life[0][1] === KIND.BORN && rc.life[1][2] === 10
      && rc.life.slice(2).map((e) => e[2]).join(",") === "10,11,12,13,14,15,16,17,18,19");

  const L = createWorld({ seed: "life-lines", w: 8, h: 8 });
  const lot = 9;
  L.zone[lot] = ZONE.R; L.tier[lot] = 1;
  const lh = createHousehold(L, "rabbit", 2);
  placeHousehold(L, lh, lot);
  const [gone, witness] = lh.members.map((id) => L.byId.get(id));
  remember(L, witness, KIND.BORN, lot);
  gone.friends = [witness.id]; witness.friends = [gone.id];
  L.tick = 50;
  const goneName = `${gone.name} ${gone.surname}`;
  removeCitizen(L, gone, "killed");
  const grave = legacyOf(L, gone.id);
  const lost = witness.life.find((e) => e[1] === KIND.LOST_FRIEND);
  const prose = lifeLines(L, witness).join(" ");
  check("lives: removal records LOST_FRIEND before the splice and archives the stable id once",
    !!lost && lost[2][0] === gone.id && lost[2][1] === "killed"
      && !witness.friends.includes(gone.id) && grave?.name === goneName && L.legacy.length === 1);
  removeCitizen(L, gone, "died");
  check("lives: the one removal boundary cannot duplicate or rewrite a legacy record",
    L.legacy.length === 1 && legacyOf(L, gone.id)?.cause === "killed");
  check("lives: prose resolves permanent names and describes a lot's current family",
    prose.includes(goneName) && prose.includes("(1,1)") && prose.includes(`now home to the ${lh.surname} family`), prose);
  const recent = memorial(L);
  check("lives: the memorial returns the trailing removal with its public fields",
    recent.length === 1 && recent[0].id === gone.id && recent[0].name === goneName && recent[0].species === gone.species
      && recent[0].age === grave.age && recent[0].cause === "killed" && recent[0].tick === 50,
    JSON.stringify(recent));
  const leavers = createHousehold(L, "owl", 2);
  const leaverId = leavers.members[0];
  removeCitizen(L, L.byId.get(leaverId), "left");
  check("lives: emigrants enter the archive but not the memorial's death ring",
    !!legacyOf(L, leaverId) && memorial(L).length === 1);
  const recentLoaded = load(save(L));
  check("lives: lives, shorthand records, and the death ring survive save/load hash-equal",
    stateHash(L) === stateHash(recentLoaded) && memorial(recentLoaded)[0]?.name === goneName);
  const beforeCode = L.legacy[0];
  L.tick = 50 + 80 * 12 + 1;
  compact(L);
  check("lives: compact never expires or rewrites the permanent citizen archive",
    L.legacy[0] === beforeCode && legacyOf(L, gone.id)?.name === goneName && epitaph(L, gone.id).includes(goneName));

  const oldPlain = toPlain(L);
  delete oldPlain.legacy;
  oldPlain.names = {
    99998: { n: "Old Pipe|Percent% Owl", s: "owl", a: 80, c: "died", t: 12, home: 9 },
    99999: { name: "Old Unreferenced", species: "owl", age: 81, cause: "mystery|cause", tick: 13 },
  };
  const oldMigrated = load(JSON.stringify(oldPlain));
  check("lives: object-shaped graveyards migrate once to delimiter-safe shorthand",
    !Object.keys(oldMigrated.names).length && oldMigrated.legacy.length === 2
      && legacyOf(oldMigrated, 99998)?.name === "Old Pipe|Percent% Owl"
      && legacyOf(oldMigrated, 99999)?.cause === "mystery|cause");
  check("lives: migrated object records re-save canonically and hash-equal",
    !Object.hasOwn(JSON.parse(save(oldMigrated)), "names") && stateHash(oldMigrated) === stateHash(load(save(oldMigrated))));
  const malformedPlain = toPlain(L);
  malformedPlain.names = { bad: "do not discard imported data" };
  const malformedLoaded = load(JSON.stringify(malformedPlain));
  check("lives: malformed legacy objects are preserved rather than silently discarded",
    malformedLoaded.names.bad === "do not discard imported data" && JSON.parse(save(malformedLoaded)).names.bad === "do not discard imported data");

  const odd = { id: 77, name: "A|B%", surname: "Line Break", species: "skunk", born: -91, home: 17, household: 4, life: [[-91, KIND.ARRIVED, 3]], native: true, fixed: true, centenary: true, wrongful: true, exonerated: true, record: 2 };
  const oddDecoded = decodeLegacy(legacyCode(odd, "unknown|why%", 321));
  check("lives: shorthand reverses arbitrary supported punctuation, negative ticks, flags and unknown causes",
    oddDecoded?.id === 77 && oddDecoded.first === odd.name && oddDecoded.surname === odd.surname
      && oddDecoded.born === -91 && oddDecoded.origin === 3 && oddDecoded.home === 17
      && oddDecoded.cause === "unknown|why%" && oddDecoded.flags === 63 && oddDecoded.recorded);
  check("lives: malformed and future-version shorthand fail closed",
    decodeLegacy(null) === null && decodeLegacy("1|bad") === null && decodeLegacy("2|1|A|B|0|0|0|d|0|0|0|0") === null);

  // The real mayor runs thirty years. The last missing deterministic branches
  // are forced in-world: a use line matures for three months, then a wrongful
  // arrest is followed by the actual culprit's arrest and exoneration.
  const { createMayor } = await import("./mayor.mjs");
  const { arrest } = await import("../js/sim/justice.js");
  const Y = createWorld({ seed: "7" });
  const mayor = createMayor(Y, { layout: "balanced", rates: [8, 8, 8], schedule: [], parks: 2, markets: 1, pacify: true, stations: true, disasters: false, recessionYear: null, zooYear: 12 });
  const seen = new Set();
  for (let t = 0; t < 30 * 12; t++) {
    mayor.month(t);
    if (t === 356) {
      const target = Y.households.find((h) => !h.gone && h.home >= 0 && h.members.length);
      const resident = target && Y.byId.get(target.members[0]);
      if (resident) { Y.rates.R = 0; Y.valves.R = 1; Y.use[target.home] = DIET_OF[resident.species] === "carn" ? 2 : 1; }
    }
    tick(Y);
    for (const event of Y.lifeEvents) seen.add(event.kind);
  }
  const pair = Y.citizens.filter((c) => !c.dead && !c.fixed && (!c.held || c.held <= Y.tick) && DIET_OF[c.species] === "carn").slice(0, 2);
  if (pair.length === 2) {
    const [culprit, wronged] = pair;
    const bedsBefore = KNOBS.CENTRE_BEDS; KNOBS.CENTRE_BEDS += 2;
    arrest(Y, { closed: false, tile: wronged.home, culpritId: culprit.id, cause: "killing" }, wronged, true, []);
    arrest(Y, { closed: false, tile: culprit.home, culpritId: culprit.id, cause: "killing" }, culprit, false, []);
    KNOBS.CENTRE_BEDS = bedsBefore;
    for (const event of Y.lifeEvents) seen.add(event.kind);
  }
  const missingKinds = Object.entries(KIND).filter(([, id]) => !seen.has(id)).map(([name]) => name);
  check("lives: the thirty-year forced run observes every KIND call site", missingKinds.length === 0, missingKinds.join(", "));

  const dangling = [];
  for (const c of Y.citizens) for (const [, kind, arg] of c.life || []) {
    const id = kind === KIND.LOST_FRIEND && Array.isArray(arg) ? arg[0]
      : kind === KIND.FRIEND || kind === KIND.KILLED ? arg : null;
    if (id != null && !Y.byId.has(id) && !legacyOf(Y, id)) dangling.push(`${c.id}:${kind}:${id}`);
  }
  check("lives: every stored friend, lost-friend, and killed id still resolves", dangling.length === 0, dangling.slice(0, 8).join(", "));
  const S = createWorld({ seed: "7" });
  const sizeMayor = createMayor(S, { layout: "balanced", rates: [8, 8, 8], schedule: [], parks: 0, markets: 0, pacify: false, stations: false, disasters: false, recessionYear: null, zooYear: null });
  for (let t = 0; t < 30 * 12; t++) { sizeMayor.month(t); tick(S); }
  const citizenBytes = Buffer.byteLength(JSON.stringify(toPlain(S).citizens));
  check("lives: year-30 citizens use no more than 60% of the 732 KB baseline",
    citizenBytes <= 732_000 * 0.60, `${citizenBytes} bytes`);
  const archive = legacyStats(S);
  check("lives: the permanent year-30 archive averages at most 45 shorthand bytes",
    archive.records > 0 && archive.mean <= 45, `${archive.records} records · ${archive.bytes} bytes · ${archive.mean.toFixed(2)} mean`);

  const tenK = createWorld({ seed: "legacy-10k", w: 8, h: 8 });
  const firsts = ["Pip", "Nibmie", "Grabrose", "Titmb", "Old|Pipe%"];
  const surnames = ["Burrowes", "Whiskerton", "Slowcombe", "Greyback"];
  const species = ["rabbit", "mouse", "fox", "beaver", "owl", "bear", "tortoise", "raccoon", "pig", "cow", "wolf", "cat", "hawk", "skunk"];
  const archiveStarted = performance.now();
  for (let id = 1; id <= 10_000; id++) {
    tenK.tick = id * 3;
    archiveCitizen(tenK, { id, name: firsts[id % firsts.length], surname: surnames[id % surnames.length], species: species[id % species.length], born: id * 3 - 240, home: id % 64, household: id >> 1, life: [[id * 3 - 240, KIND.BORN, id % 64]], native: id % 5 === 0, fixed: false, centenary: false, wrongful: false, exonerated: false }, id % 3 ? "died" : "left");
  }
  const archiveMs = performance.now() - archiveStarted;
  const archiveJsonBytes = Buffer.byteLength(JSON.stringify(tenK.legacy));
  check("lives: ten thousand permanent citizen records fit in 500 KB of actual save JSON",
    archiveJsonBytes <= 500_000 && tenK.legacy.length === 10_000, `${archiveJsonBytes} bytes`);
  check("lives: archive insertion is linear and ten thousand records complete under one second",
    archiveMs < 1000, `${archiveMs.toFixed(1)} ms`);
  check("lives: year-30 save/load with biographies continues hash-equal",
    stateHash(Y) === stateHash(load(save(Y))));
}

// ---- Part A': actionable needs and Inspect bubbles (SPEC §14b) ------------
{
  const { ACT, LINES, NEED_CODES, line } = await import("../js/sim/voice.js");
  const { BUBBLES_MAX, needOf, needsContext } = await import("../js/sim/needs.js");
  const { needCensus } = await import("../js/sim/census.js");
  const { homeScore, homeTerms, moodTerms, removeCitizen } = await import("../js/sim/citizens.js");
  const { SPECIES } = await import("../js/sim/species.js");
  const { refreshLast } = await import("../js/sim/tick.js");
  const { createWalkers } = await import("../js/walkers.js");
  const { art } = await import("../js/art/index.js");
  const { needFixture, needTruthResults, TRUTH_CODES } = await import("./need-fixtures.mjs");
  const { COHERENT_STRESS_CODES, coherentStressFacts, coherentStressFixture } = await import("./need-stress.mjs");

  const lineCodes = Object.keys(LINES).sort();
  check("needs: every return code has one action and a default voice table",
    JSON.stringify(NEED_CODES.slice().sort()) === JSON.stringify(Object.keys(ACT).sort())
      && JSON.stringify(lineCodes) === JSON.stringify(NEED_CODES.slice().sort())
      && NEED_CODES.every((code) => ACT[code] && LINES[code].default?.length >= 2));
  const knownVoices = new Set(["default", "herb", "omni", "carn", ...SPECIES.map((s) => s.id)]);
  const badVoice = [];
  for (const [code, groups] of Object.entries(LINES)) for (const [voice, lines] of Object.entries(groups)) {
    if (!knownVoices.has(voice)) badVoice.push(`${code}:${voice}`);
    for (const text of lines) if (!text || text.length > 30 || /\{(?!n\}|species\})/.test(text)) badVoice.push(`${code}:${voice}:${text}`);
  }
  check("needs: voice overrides are known and every authored line is 1–30 characters", badVoice.length === 0, badVoice.join(", "));
  let unresolvedVoices = 0;
  for (let id = 0; id < 32; id++) for (const species of SPECIES) for (const code of NEED_CODES) {
    const text = line(null, { id, species: species.id }, { code });
    if (typeof text !== "string" || !text.length || text.length > 30) unresolvedVoices++;
  }
  check("needs: signed visual hashes still resolve every species/code voice", unresolvedVoices === 0, `${unresolvedVoices}`);

  // The check below iterates the fixture TABLE, so a code with no fixture is
  // not tested — it is skipped, and the check's name ("every need code") is
  // false without this line. WATCHED was added to the voice table and to
  // ACTIONABLE_MOOD and the suite stayed green with nothing exercising it.
  {
    const { ACT } = await import("../js/sim/voice.js");
    const uncovered = Object.keys(ACT).filter((code) => !TRUTH_CODES.includes(code));
    check("needs: every code the voice table can act on HAS a truth fixture", uncovered.length === 0, uncovered.join(", "));
  }
  const truthResults = needTruthResults();
  const wrongCases = truthResults.filter((r) => r.expected !== r.actual);
  check("needs: every need code wins a focused truth fixture", wrongCases.length === 0,
    wrongCases.map((r) => `${r.expected}→${r.actual}`).join(", "));
  const flightTruth = truthResults.find((r) => r.expected === "FLIGHT");
  check("needs: FLIGHT identifies the threatening species, not the citizen's species",
    flightTruth?.need?.arg?.species === "wolf", JSON.stringify(flightTruth?.need?.arg));

  const stressResults = COHERENT_STRESS_CODES.map((code, i) => coherentStressFixture(code, 355 + i));
  const wrongStress = stressResults.filter((r) => r.actual !== r.expected);
  check("needs: rare probe codes occur in coherent full-town snapshots", wrongStress.length === 0,
    wrongStress.map((r) => `${r.expected}→${r.actual}`).join(", "));
  const badStressFacts = stressResults.map((r) => ({ code: r.expected, ...coherentStressFacts(r) })).filter((f) =>
    f.population !== 1300 || f.civicZoneOverlap || f.occupiedTierZero || f.homeOverflow || f.jobOverflow || f.badHousehold || f.badPath);
  check("needs: stress towns have valid households, storeys, civics, capacities, and road commutes", badStressFacts.length === 0,
    JSON.stringify(badStressFacts));
  const derivedDrift = [];
  for (const result of stressResults) {
    const before = Object.fromEntries(["roadDist", "pol", "lv", "traffic", "crime", "fireCov", "policeCov", "dread", "occupants", "staff"]
      .map((field) => [field, Buffer.from(result.world[field]).toString("base64")]));
    const demand = JSON.stringify(result.world.last.demand);
    refreshLast(result.world);
    const changed = Object.keys(before).filter((field) => before[field] !== Buffer.from(result.world[field]).toString("base64"));
    if (changed.length || demand !== JSON.stringify(result.world.last.demand) || needOf(result.world, result.target).code !== result.expected) {
      derivedDrift.push(`${result.expected}:${changed.join("+") || "demand/need"}`);
    }
  }
  check("needs: every stress witness survives a complete derived-field rebuild", derivedDrift.length === 0, derivedDrift.join(", "));

  const vf = needFixture("tortoise");
  check("needs: before the first census the answer is CONTENT", needOf(createWorld({ seed: "need-zero" }), vf.citizen).code === "CONTENT");
  const n = needOf(vf.world, vf.citizen);
  check("needs: a citizen's line is stable and comes with the selected remedy",
    line(vf.world, vf.citizen, n) === line(vf.world, vf.citizen, n) && n.act === ACT[n.code]);
  const smokeTruth = needFixture("tortoise");
  smokeTruth.world.pol[smokeTruth.home] = 100;
  const smokeOn = needOf(smokeTruth.world, smokeTruth.citizen).code;
  smokeTruth.world.pol[smokeTruth.home] = 0;
  const smokeOff = needOf(smokeTruth.world, smokeTruth.citizen).code;
  check("needs: removing the mood's SMOKE deficit removes the SMOKE need",
    smokeOn === "SMOKE" && smokeOff !== "SMOKE", `${smokeOn} → ${smokeOff}`);
  const shopsTruth = needFixture("tortoise");
  shopsTruth.world.last.demand.r.C = 1;
  const shopsOn = needOf(shopsTruth.world, shopsTruth.citizen).code;
  shopsTruth.world.last.demand.r.C = 0;
  const shopsOff = needOf(shopsTruth.world, shopsTruth.citizen).code;
  check("needs: closing the C valve removes the SHOPS need",
    shopsOn === "SHOPS" && shopsOff !== "SHOPS", `${shopsOn} → ${shopsOff}`);
  const parkTruth = needFixture("tortoise");
  parkTruth.world.civic[parkTruth.park] = CIVIC.NONE;
  const parkBefore = needOf(parkTruth.world, parkTruth.citizen).code;
  parkTruth.world.civic[parkTruth.park] = CIVIC.PARK;
  const parkAfter = needOf(parkTruth.world, parkTruth.citizen).code;
  check("needs: the stated NO_PARK remedy makes that need fall at once",
    parkBefore === "NO_PARK" && parkAfter !== "NO_PARK", `${parkBefore} → ${parkAfter}`);
  // The far edge, not just the anchor, must provide recreation. Keep the
  // citizen at home while arbitrary visual walker coordinates cannot matter.
  const largeTruth = needFixture("tortoise"), lw = largeTruth.world;
  lw.civic.fill(0); lw.civicSize.fill(0);
  largeTruth.citizen.home = 3 * lw.w + 7;
  const campus = 1;
  for(let dy=0;dy<3;dy++)for(let dx=0;dx<3;dx++){
    const i=campus+dy*lw.w+dx;
    lw.civic[i]=dx||dy?CIVIC.PART:CIVIC.LARGE_PARK;
    lw.civicSize[i]=dx||dy?128|dx|dy<<2:3;
  }
  check("needs: a Large Park edge four tiles from home satisfies recreation",
    needOf(lw,largeTruth.citizen).code!=="NO_PARK" && moodTerms(lw,largeTruth.citizen).some(t=>t.code==="PARK"&&t.value===10));
  lw.civic[campus]=CIVIC.ZOO;
  check("needs: a Zoo prison and its parts cannot satisfy recreation",
    needOf(lw,largeTruth.citizen).code==="NO_PARK");
  lw.civic[campus]=CIVIC.LARGE_PARK;
  largeTruth.citizen.home=7*lw.w+7;
  check("needs: a home beyond the Large Park radius still needs recreation",
    needOf(lw,largeTruth.citizen).code==="NO_PARK");
  largeTruth.citizen.home=3*lw.w+6;
  lw.civic.fill(0);lw.civicSize.fill(0);lw.civic[campus]=CIVIC.LARGE_PARK;
  for(const i of [campus+1,campus+lw.w,campus+lw.w+1])lw.civic[i]=CIVIC.LARGE_PARK_PART;
  check("needs: legacy two-by-two Large Park parts satisfy recreation",
    needOf(lw,largeTruth.citizen).code!=="NO_PARK");
  let scoreDrift = 0;
  for (const species of SPECIES.map((s) => s.id)) for (const strict of [false, true]) {
    const f = needFixture(species);
    const sum = homeTerms(f.world, species, f.home, strict).reduce((s, term) => s + term.value, 0);
    if (homeScore(f.world, species, f.home, strict) !== sum) scoreDrift++;
  }
  check("needs: homeScore is exactly the sum of homeTerms for every species and gate", scoreDrift === 0, `${scoreDrift}`);
  // Earlier field-law checks deliberately recompute A.world's derived fields
  // without refreshing its panel cache. Exercise the cache contract on one
  // coherent snapshot, exactly as load/new-game and the paused UI do.
  const censusWorld = load(save(A.world));
  refreshLast(censusWorld);
  const liveNeeds = needCensus(censusWorld);
  const cachedNeedTotal = Object.values(censusWorld.last.needs).reduce((s, x) => s + x, 0);
  const presentCitizens = censusWorld.citizens.filter((c) => !c.dead && !c.pen && (c.held || 0) <= censusWorld.tick).length;
  check("needs: the cached census is the same histogram and excludes animals away in custody or a pen",
    JSON.stringify(censusWorld.last.needs) === JSON.stringify(liveNeeds) && cachedNeedTotal === presentCitizens,
    `cached ${JSON.stringify(censusWorld.last.needs)} · live ${JSON.stringify(liveNeeds)} · ${cachedNeedTotal}/${presentCitizens}`);

  const W = createWalkers(A.world);
  const hashBefore = stateHash(A.world);
  // SPEC 14 forbids this layer a buffer ON THE WORLD, and the hash cannot see
  // one: `world._seen` is derived scratch and is not in `canonicalWorld`. So
  // the world's buffer is STAMPED, and the stamp has to survive a walk. The
  // layer asks `fields.doorsOf` for a doorstep and hands it its own array;
  // dropping that argument is invisible to every other check there is.
  const seenBefore = A.world._seen ? A.world._seen.slice() : null;
  if (A.world._seen) A.world._seen.fill(0xe1);
  const walkStamp = A.world._seen ? A.world._seen.reduce((a, b) => a + b, 0) : 0;
  W.notify();
  for (let k = 0; k < 80; k++) W.update(0.1, { x0: 0, y0: 0, x1: A.world.w, y1: A.world.h });
  const walkKept = A.world._seen ? A.world._seen.reduce((a, b) => a + b, 0) : 0;
  if (seenBefore) A.world._seen.set(seenBefore);
  const first = W.list().find((x) => x.citizen != null);
  W.setCursor(first ? [Math.floor(first.tx), Math.floor(first.ty)] : null);
  const voiced = W.list().filter((x) => x.need);
  check("needs: Inspect attaches only stable need codes to the nearest eight walkers",
    !!first && voiced.length > 0 && voiced.length <= BUBBLES_MAX && voiced.every((x) => NEED_CODES.includes(x.need)));
  if (first) W.setCursor([0, 0], first.citizen);
  const pinned = W.list().filter((x) => x.need);
  check("needs: a pinned citizen's walker stays in the eight even beyond the cursor reach",
    !!first && pinned.length <= BUBBLES_MAX && pinned.some((x) => x.citizen === first.citizen));
  if (first) W.setCursor(null, first.citizen);
  const linkedPin = W.list().filter((x) => x.need);
  check("needs: a linked citizen pin keeps its in-world pop-out when the pointer is over the card",
    !!first && linkedPin.length === 1 && linkedPin[0].citizen === first.citizen);
  W.setCursor(null);
  check("needs: leaving Inspect clears every bubble and the walker layer never writes the sim — not the saved state, and not the door search's scratch buffer either, which no hash can see",
    W.list().every((x) => x.need == null) && stateHash(A.world) === hashBefore
      && !!seenBefore && walkKept === walkStamp,
    `${W.list().length} walkers · the world's door scratch ${walkStamp} → ${walkKept}`);

  // The input regression is event-driven: pan under a stationary pointer,
  // change tools, and prove the citizen-id pin survives walker teardown while
  // every real unpin path still clears the thought layer.
  const oldWindow = globalThis.window;
  const windowEvents = {};
  globalThis.window = { addEventListener: (type, fn) => { windowEvents[type] = fn; } };
  const canvasEvents = {};
  const inputCanvas = {
    focus() {}, setPointerCapture() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 200 }),
    addEventListener: (type, fn) => { canvasEvents[type] = fn; },
  };
  const cursorCalls = [];
  let costRefreshes = 0;
  let lastCost = { text: "", refused: false };
  let undos = 0, saves = 0, loads = 0, pauses = 0, newsOpen = false, inputModal = false;
  const newsKeys = [];
  const pinnedWalker = { citizen: A.world.citizens[0].id };
  let walkerAlive = true;
  const inputApp = {
    world: A.world, camera: { x: 20, y: 20, zoom: 1 },
    renderer: {
      pick: (_sx, _sy, camera) => [Math.floor((camera || inputApp.camera).x), Math.floor((camera || inputApp.camera).y)],
      pickWalker: () => walkerAlive ? pinnedWalker : null,
    },
    walkers: {
      list: () => walkerAlive ? [pinnedWalker] : [],
      setCursor: (tile, pin) => cursorCalls.push({ tile: tile ? [...tile] : null, pin }),
    },
    ui: { setTool() {}, setCost(text, refused) { costRefreshes++; lastCost = { text, refused: !!refused }; }, flash() {}, modalOpen: () => inputModal, closeModals() {}, openNewCity() {} },
    title: { isOpen: () => false, open() {}, back() {} },
    news: { isOpen: () => newsOpen, toggle() { newsOpen = !newsOpen; }, key: (e) => { newsKeys.push(e.code); return false; } },
    art: { civic: () => null, station: () => null },
    doOp() {}, undo() { undos++; }, save() { saves++; }, load() { loads++; }, cycleOverlay() {},
    zoomAt(dir) { inputApp.camera.zoom = dir > 0 ? 2 : 1; inputApp.camera.x += dir > 0 ? 7 : -7; },
    togglePause() { pauses++; }, setSpeed() {},
  };
  const { createInput } = await import("../js/input.js");
  const input = createInput(inputCanvas, inputApp);
  const pe = (x, y, button = 0) => ({ clientX: x, clientY: y, button, pointerId: 1, shiftKey: false, preventDefault() {} });
  input.setTool("inspect");
  // A touch/pointer press can be the first canvas event: it must establish
  // the hover and thought cursor without relying on an earlier mouse move.
  canvasEvents.pointerdown(pe(10, 10));
  canvasEvents.pointerup(pe(10, 10));
  const pinAttached = cursorCalls.at(-1)?.pin === pinnedWalker.citizen && cursorCalls.at(-1)?.tile != null;
  canvasEvents.pointerleave({});
  const panelBubbleKept = cursorCalls.at(-1)?.pin === pinnedWalker.citizen && cursorCalls.at(-1)?.tile == null;
  windowEvents.keydown({ key: "Escape", code: "Escape", preventDefault() {} });
  const escapeCleared = cursorCalls.at(-1)?.pin == null;
  canvasEvents.pointerdown(pe(10, 10));
  canvasEvents.pointermove(pe(30, 10));
  const dragRepicked = cursorCalls.at(-1)?.tile?.[0] === Math.floor(inputApp.camera.x);
  canvasEvents.pointerup(pe(30, 10));
  windowEvents.keydown({ key: "ArrowRight", code: "ArrowRight", repeat: false, preventDefault() {} });
  input.update(0.1);
  const keyRepicked = cursorCalls.at(-1)?.tile?.[0] === Math.floor(inputApp.camera.x);
  windowEvents.keyup({ key: "ArrowRight", code: "ArrowRight" });
  windowEvents.keydown({ key: "+", code: "Equal", repeat: false, preventDefault() {} });
  const zoomRepicked = cursorCalls.at(-1)?.tile?.[0] === Math.floor(inputApp.camera.x);
  inputApp.camera.x = -99;
  input.syncCamera(); // main calls this after clamping the real camera
  const clampRepicked = cursorCalls.at(-1)?.tile?.[0] === -99;
  input.setTool("park");
  const costBeforePan = costRefreshes;
  canvasEvents.pointerdown(pe(10, 10, 1));
  canvasEvents.pointermove(pe(30, 10, 1));
  canvasEvents.pointerup(pe(30, 10, 1));
  const costRepicked = costRefreshes > costBeforePan;
  input.setTool("road");
  const roadCleared = cursorCalls.at(-1)?.tile == null && cursorCalls.at(-1)?.pin == null;
  input.setTool("inspect");
  canvasEvents.pointerdown(pe(10, 10));
  canvasEvents.pointerup(pe(10, 10));
  walkerAlive = false;
  const betweenWalks = input.hoverInfo();
  const citizenPinKept = betweenWalks?.citizen === pinnedWalker.citizen
    && betweenWalks.target?.state === "home" && cursorCalls.at(-1)?.pin === pinnedWalker.citizen;
  const keyHash = stateHash(A.world);
  const keyEvent = (key, code, extra = {}) => ({
    key, code, repeat: false, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false,
    target: null, prevented: false, preventDefault() { this.prevented = true; }, ...extra,
  });
  const expectedToolKeys = [
    ["1", "Digit1", "R"], ["2", "Digit2", "C"], ["3", "Digit3", "I"], ["4", "Digit4", "M"],
    ["5", "Digit5", "road"], ["6", "Digit6", "wall"], ["7", "Digit7", "rail"], ["8", "Digit8", "station"],
    ["9", "Digit9", "tree"], ["0", "Digit0", "park"], ["z", "KeyZ", "zoo"], ["v", "KeyV", "centre"],
    ["p", "KeyP", "police"], ["f", "KeyF", "fire"], ["i", "KeyI", "inspect"], ["b", "KeyB", "bulldoze"],
  ];
  let keyParity = true;
  for (const [key, code, id] of expectedToolKeys) {
    windowEvents.keydown(keyEvent(key, code));
    keyParity &&= input.tool === id;
  }
  const previewParity = expectedToolKeys.every(([, , id]) => {
    const p = input.previewTool(id);
    return typeof p.text === "string" && p.text.length > 0 && typeof p.refused === "boolean";
  });
  const density0 = input.density, save0 = saves, camera0 = { ...inputApp.camera };
  let movedEach = true;
  for (const [key, code] of [["w", "KeyW"], ["a", "KeyA"], ["s", "KeyS"], ["d", "KeyD"]]) {
    const before = { ...inputApp.camera };
    windowEvents.keydown(keyEvent(key, code));
    input.update(0.05);
    windowEvents.keyup(keyEvent(key, code));
    movedEach &&= inputApp.camera.x !== before.x || inputApp.camera.y !== before.y;
  }
  const wasdOnlyMoved = input.density === density0 && saves === save0 && movedEach
    && inputApp.camera.x === camera0.x && inputApp.camera.y === camera0.y;
  const backspace = keyEvent("Backspace", "Backspace");
  windowEvents.keydown(backspace);
  windowEvents.keydown(keyEvent("z", "KeyZ", { ctrlKey: true }));
  windowEvents.keydown(keyEvent("s", "KeyS", { ctrlKey: true }));
  windowEvents.keydown(keyEvent("l", "KeyL"));
  const densityBeforeH = input.density;
  windowEvents.keydown(keyEvent("h", "KeyH"));
  windowEvents.keydown(keyEvent("u", "KeyU"));
  input.setUse(USE.PRED | USE.BEAR | USE.RACCOON);
  const selectedUseMask = input.state.use;
  windowEvents.keydown(keyEvent("u", "KeyU")); // reopens/retains; U no longer destroys a checkbox selection
  const commandsMoved = undos === 2 && saves === save0 + 1 && loads === 1 && backspace.prevented
    && input.density !== densityBeforeH && input.tool === "use"
    && selectedUseMask === (USE.PRED | USE.BEAR | USE.RACCOON) && input.state.use === selectedUseMask;
  const focusedButton = { tagName: "BUTTON" };
  const focusedCamera = { ...inputApp.camera };
  const buttonW = keyEvent("w", "KeyW", { target: focusedButton });
  windowEvents.keydown(buttonW);
  input.update(0.05);
  windowEvents.keyup(buttonW);
  const focusedWasd = inputApp.camera.y !== focusedCamera.y;
  windowEvents.keydown(keyEvent("5", "Digit5", { target: focusedButton }));
  const focusedTool = input.tool === "road";
  const focusedSave = keyEvent("s", "KeyS", { ctrlKey: true, target: focusedButton });
  windowEvents.keydown(focusedSave);
  const repeatUndo = keyEvent("z", "KeyZ", { ctrlKey: true, repeat: true, target: focusedButton });
  const repeatSave = keyEvent("s", "KeyS", { ctrlKey: true, repeat: true, target: focusedButton });
  windowEvents.keydown(repeatUndo);
  windowEvents.keydown(repeatSave);
  const buttonSpace = keyEvent(" ", "Space", { target: { tagName: "BUTTON" } });
  const buttonBack = keyEvent("Backspace", "Backspace", { target: { tagName: "BUTTON" } });
  const textUndo = keyEvent("z", "KeyZ", { ctrlKey: true, target: { tagName: "INPUT" } });
  const textSave = keyEvent("s", "KeyS", { ctrlKey: true, target: { tagName: "INPUT" } });
  windowEvents.keydown(buttonSpace);
  windowEvents.keydown(buttonBack);
  windowEvents.keydown(textUndo);
  windowEvents.keydown(textSave);
  const checkTarget = { tagName: "INPUT", type: "checkbox" };
  const checkCamera = { ...inputApp.camera };
  const checkW = keyEvent("w", "KeyW", { target: checkTarget });
  const checkSpace = keyEvent(" ", "Space", { target: checkTarget });
  windowEvents.keydown(checkW);
  input.update(0.05);
  windowEvents.keyup(checkW);
  windowEvents.keydown(checkSpace);
  const checkboxControlSafe = inputApp.camera.y !== checkCamera.y && !checkSpace.prevented && pauses === 0;
  const focusedControlsSafe = focusedWasd && focusedTool && focusedSave.prevented && pauses === 0 && undos === 2
    && repeatUndo.prevented && repeatSave.prevented && !buttonSpace.prevented && buttonBack.prevented
    && !textUndo.prevented && textSave.prevented && saves === save0 + 2 && checkboxControlSafe;
  const repeatTool = input.tool;
  windowEvents.keydown(keyEvent("z", "KeyZ", { repeat: true }));
  const repeatIgnored = input.tool === repeatTool;
  const mouseReaderCamera = { ...inputApp.camera };
  windowEvents.keydown(keyEvent("w", "KeyW"));
  newsOpen = true;
  input.update(0.1); // the reader was mouse-opened after W's keydown
  const mouseOpenedReaderStopsPan = inputApp.camera.x === mouseReaderCamera.x && inputApp.camera.y === mouseReaderCamera.y;
  windowEvents.keyup(keyEvent("w", "KeyW"));
  const hiddenCamera = { ...inputApp.camera };
  for (const [key, code] of [["w", "KeyW"], ["a", "KeyA"], ["s", "KeyS"], ["d", "KeyD"]]) windowEvents.keydown(keyEvent(key, code));
  const behindNewsSpace = keyEvent(" ", "Space", { target: { tagName: "BUTTON", closest: () => null } });
  const readerButtonSpace = keyEvent(" ", "Space", { target: { tagName: "BUTTON", closest: (selector) => selector === "#news" ? {} : null } });
  windowEvents.keydown(behindNewsSpace);
  windowEvents.keydown(readerButtonSpace);
  const newsBack = keyEvent("Backspace", "Backspace");
  const newsSave = keyEvent("s", "KeyS", { ctrlKey: true });
  windowEvents.keydown(newsBack);
  windowEvents.keydown(newsSave);
  input.update(0.1);
  newsOpen = false;
  const newsWasdIdle = inputApp.camera.x === hiddenCamera.x && inputApp.camera.y === hiddenCamera.y
    && newsKeys.join(",") === "KeyW,KeyA,KeyS,KeyD,Space,Backspace,KeyS"
    && mouseOpenedReaderStopsPan && behindNewsSpace.prevented && !readerButtonSpace.prevented && newsBack.prevented && newsSave.prevented
    && saves === save0 + 2;
  inputModal = true;
  const modalBack = keyEvent("Backspace", "Backspace");
  windowEvents.keydown(modalBack);
  inputModal = false;
  const modalBackSafe = modalBack.prevented;
  const keyNeutral = stateHash(A.world) === keyHash;
  input.setTool("inspect");
  const pinnedRecord = A.world.byId.get(pinnedWalker.citizen);
  removeCitizen(A.world, pinnedRecord, "left");
  const afterDeparture = input.hoverInfo();
  const epitaphKept = afterDeparture?.citizen === pinnedWalker.citizen
    && afterDeparture.target?.state === "gone" && afterDeparture.target.line.includes(pinnedRecord.name);
  const linkedId = A.world.citizens.find((c) => !c.dead && c.id !== pinnedWalker.citizen)?.id;
  const linkRepinned = input.pinCitizen(linkedId) && input.hoverInfo()?.citizen === linkedId;
  input.unpin();
  const explicitUnpinCleared = cursorCalls.at(-1)?.pin == null;
  // Every registry operation travels through the same pointer machinery the
  // browser uses. The app stub records, but deliberately does not apply, so
  // all tools see the same clean target and cannot mask each other.
  const opWorld = createWorld({ seed: "palette-pointer-ops", w: 24, h: 24 });
  inputApp.world = opWorld;
  inputApp.camera.x = 10; inputApp.camera.y = 10;
  const madeOps = [];
  inputApp.doOp = (op) => madeOps.push(op);
  const at = 10 * opWorld.w + 10;
  canvasEvents.pointermove(pe(10, 10));
  windowEvents.keydown(keyEvent("0", "Digit0"));
  const stationaryGhostReady = input.state.cost && !input.state.cost.refused
    && input.hover().ghost?.ok === true && /Park/.test(lastCost.text) && !lastCost.refused;
  // Density is part of the operation, including while the mouse is already
  // down. Start over an already-High lot so the first plan is empty; H must
  // immediately turn it into a Low repaint before pointerup commits it.
  if (input.density !== 3) windowEvents.keydown(keyEvent("h", "KeyH"));
  opWorld.zone[at] = ZONE.R;
  opWorld.maxTier[at] = 3;
  input.setTool("R");
  canvasEvents.pointerdown(pe(10, 10));
  const highDragEmpty = input.state.cost?.tiles.length === 0 && /nothing to do/.test(lastCost.text);
  windowEvents.keydown(keyEvent("h", "KeyH"));
  const lowDragReady = input.density === 1 && input.state.cost?.tiles.includes(at)
    && /^Residential /.test(lastCost.text) && !lastCost.refused;
  canvasEvents.pointerup(pe(10, 10));
  const densityOp = madeOps.at(-1);
  const densityDragRefresh = highDragEmpty && lowDragReady && densityOp?.kind === "zone"
    && densityOp.zone === ZONE.R && densityOp.density === 1;
  madeOps.length = 0;
  opWorld.zone[at] = ZONE.NONE;
  opWorld.maxTier[at] = 0;
  const pointerTools = ["R", "C", "I", "M", "road", "wall", "rail", "station", "tree", "park", "zoo", "centre", "police", "fire", "bulldoze"];
  pointerTools.push("largePark");
  for (let dy=0;dy<3;dy++) for(let dx=0;dx<3;dx++) { const i=at+dx+dy*opWorld.w; for(const k of ["terrain","road","zone","civic","wall","rail","tier","big","rubble","burning"]) opWorld[k][i]=0; }
  opWorld.road[at-1]=ROAD.ROAD; opWorld.roadsDirty=true;
  for (const id of pointerTools) {
    opWorld.rail[at] = id === "station" ? 1 : 0;
    opWorld.terrain[at] = id === "bulldoze" ? 2 : 0; // TREE=2: something real to clear
    input.setTool(id);
    canvasEvents.pointerdown(pe(10, 10));
    canvasEvents.pointerup(pe(10, 10));
  }
  const pointerKinds = madeOps.map((op) => op.kind);
  const pointerOpsExact = JSON.stringify(pointerKinds) === JSON.stringify(["zone", "zone", "zone", "zone", "road", "wall", "rail", "station", "tree", "park", "zoo", "centre", "police", "fire", "bulldoze", "largePark"])
    && JSON.stringify(madeOps.slice(0, 4).map((op) => op.zone)) === JSON.stringify([ZONE.R, ZONE.C, ZONE.I, ZONE.M]);
  globalThis.window = oldWindow;
  check("needs: camera repicks Inspect; a citizen pin survives its walker; explicit unpin synchronizes bubbles",
    pinAttached && panelBubbleKept && escapeCleared && dragRepicked && keyRepicked && zoomRepicked && clampRepicked && costRepicked && roadCleared && citizenPinKept && epitaphKept && linkRepinned && explicitUnpinCleared,
    JSON.stringify({ pinAttached, panelBubbleKept, escapeCleared, dragRepicked, keyRepicked, zoomRepicked, clampRepicked, costRepicked, roadCleared, citizenPinKept, epitaphKept, linkRepinned, explicitUnpinCleared }));
  check("palette input: all sixteen keys match their tools; WASD only pans; new command bindings are unambiguous",
    keyParity && previewParity && wasdOnlyMoved && commandsMoved && focusedControlsSafe && repeatIgnored && newsWasdIdle && modalBackSafe && keyNeutral,
    JSON.stringify({ keyParity, previewParity, wasdOnlyMoved, commandsMoved, selectedUseMask, focusedControlsSafe, checkboxControlSafe, repeatIgnored, newsWasdIdle, mouseOpenedReaderStopsPan, modalBackSafe, keyNeutral, undos, saves, loads, pauses, newsKeys }));
  check("palette input: every build family emits its exact registry op through real pointer events",
    pointerOpsExact && stationaryGhostReady && densityDragRefresh,
    JSON.stringify({ stationaryGhostReady, densityDragRefresh, lastCost, ops: madeOps.map((op) => ({ kind: op.kind, zone: op.zone })) }));

  const b1 = art.bubble(90, 15), b2 = art.bubble(90, 15);
  check("needs: bubble art is cached, palette-keyed, and includes its three-pixel tail",
    b1 === b2 && b1.w === 90 && b1.h === 18 && b1.anchor[1] === 17
      && art.bubble(90, 15, 0, "top").anchor[0] === 0 && art.bubble(90, 15, 89, "top").anchor[0] === 89);
  const simNeedLeak = files.filter((f) => /[\\/]sim[\\/]/.test(f) && /\.need\b|setCursor\(|needCursor/.test(readFileSync(f, "utf8"))).map((f) => path.relative(ROOT, f));
  check("needs: no simulation module reads walker need or the Inspect cursor", simNeedLeak.length === 0, simNeedLeak.join(", "));
}

// ---- Part J': named save slots (SPEC §15) -----------------------------------
{
  const memoryStore = () => {
    const data = new Map();
    const api = {
      limit: Infinity,
      get: (key) => data.get(key) ?? null,
      keys: () => data.keys(),
      del: (key) => data.delete(key),
      set(key, value) {
        const next = new Map(data);
        next.set(key, String(value));
        let used = 0;
        for (const [k, v] of next) used += new TextEncoder().encode(k + v).length;
        if (used > api.limit) return false;
        data.set(key, String(value));
        return true;
      },
    };
    return api;
  };
  const cityJson = (tickNo, pop = 0, pad = "") => JSON.stringify({ tick: tickNo, citizens: Array.from({ length: pop }, (_, id) => ({ id })), pad });

  const mem = new Map();
  const ids = [
    writeSlot(mem, "menagerie", "first", cityJson(1, 1)),
    writeSlot(mem, "menagerie", "second", cityJson(2, 2)),
    writeSlot(mem, "menagerie", "third", cityJson(3, 3)),
  ];
  check("slots: three named writes list newest first",
    ids.every((r) => r.ok) && listSlots(mem, "menagerie").map((s) => s.name).join(",") === "third,second,first");

  const punctuation = writeSlot(mem, "menagerie", `mayor's “north: gate”`, cityJson(4));
  check("slots: names preserve quotes and colons as data",
    punctuation.ok && listSlots(mem, "menagerie")[0].name === `mayor's “north: gate”`);

  const removed = deleteSlot(mem, "menagerie", ids[1].id);
  check("slots: deleting one leaves its neighbours intact",
    removed.ok && !readSlot(mem, "menagerie", ids[1].id)
      && !!readSlot(mem, "menagerie", ids[0].id) && !!readSlot(mem, "menagerie", ids[2].id));

  const capped = memoryStore();
  for (let i = 1; i <= 3; i++) writeSlot(capped, "cap", `slot ${i}`, cityJson(i));
  const beforeCap = listSlots(capped, "cap").map((s) => s.name).join(",");
  const beforeCapBytes = bytesUsed(capped);
  const fourthJson = cityJson(4, 0, "x".repeat(200));
  capped.limit = beforeCapBytes + new TextEncoder().encode(`zoo.slot:cap:4${fourthJson}`).length;
  const refused = writeSlot(capped, "cap", "slot 4", fourthJson);
  check("slots: a failed new-slot index write rolls its value back and preserves the first three",
    !refused.ok && /full|unavailable/.test(refused.reason) && capped.get("zoo.slot:cap:4") == null
      && bytesUsed(capped) === beforeCapBytes && listSlots(capped, "cap").map((s) => s.name).join(",") === beforeCap);

  const cappedOverwrite = memoryStore();
  const originalJson = cityJson(5, 1);
  const original = writeSlot(cappedOverwrite, "over", "original", originalJson);
  const originalIndex = cappedOverwrite.get("zoo.slots:over");
  const replacementJson = cityJson(6, 2, "y".repeat(120));
  const valueGrowth = new TextEncoder().encode(replacementJson).length - new TextEncoder().encode(originalJson).length;
  cappedOverwrite.limit = bytesUsed(cappedOverwrite) + Math.max(0, valueGrowth);
  const overwriteRefused = writeSlot(cappedOverwrite, "over", "a much longer replacement name", replacementJson, "manual", original.id);
  check("slots: a failed overwrite index write restores the prior value and index",
    !overwriteRefused.ok && cappedOverwrite.get("zoo.slot:over:1") === originalJson
      && cappedOverwrite.get("zoo.slots:over") === originalIndex
      && listSlots(cappedOverwrite, "over")[0].name === "original");

  const fullLegacy = memoryStore();
  const fullJson = cityJson(30, 4);
  fullLegacy.set("zoo.city:full old town", fullJson);
  fullLegacy.limit = bytesUsed(fullLegacy);
  const fullMove = migrate(fullLegacy);
  const recovery = listSlots(fullLegacy, "full old town")[0];
  check("slots: a full store keeps an unmigrated legacy city visible, loadable and exportable",
    !fullMove.ok && recovery?.legacy === true && readSlot(fullLegacy, "full old town", recovery.id)?.json === fullJson
      && listAllSlots(fullLegacy).some((s) => s.city === "full old town" && s.id === recovery.id));

  const old = memoryStore();
  const checkpoint = cityJson(12, 2);
  const automatic = cityJson(18, 3);
  old.set("zoo.save:old town", checkpoint);
  old.set("zoo.auto:old town", automatic);
  old.set("zoo.city:actual old key", checkpoint);
  const moved = migrate(old);
  const movedAuto = listSlots(old, "old town").find((s) => s.kind === "auto");
  const freshAuto = writeSlot(old, "old town", "Autosave", cityJson(24, 4), "auto");
  const movedAgain = migrate(old);
  check("slots: legacy migration is idempotent and leaves old keys untouched",
    moved.ok && moved.migrated === 3 && movedAgain.ok && movedAgain.migrated === 0
      && old.get("zoo.save:old town") === checkpoint && old.get("zoo.auto:old town") === automatic
      && old.get("zoo.city:actual old key") === checkpoint && listSlots(old, "actual old key").length === 1
      && freshAuto.ok && freshAuto.id === movedAuto.id && listSlots(old, "old town").length === 2
      && readSlot(old, "old town", freshAuto.id).tick === 24);

  const migratedManual = listSlots(old, "actual old key")[0];
  const deletedMigrated = deleteSlot(old, "actual old key", migratedManual.id);
  const afterDeleteMigration = migrate(old);
  check("slots: deleting a migrated slot is durable even while its old key remains",
    deletedMigrated.ok && afterDeleteMigration.ok && afterDeleteMigration.migrated === 0
      && old.get("zoo.city:actual old key") === checkpoint && listSlots(old, "actual old key").length === 0);

  const auto = memoryStore();
  const auto1 = writeSlot(auto, "one-auto", "Autosave", cityJson(1), "auto");
  const auto2 = writeSlot(auto, "one-auto", "Autosave", cityJson(9), "auto");
  check("slots: autosave overwrites exactly one stable slot",
    auto1.ok && auto2.ok && auto1.id === auto2.id && listSlots(auto, "one-auto").length === 1
      && readSlot(auto, "one-auto", auto2.id).tick === 9);

  const mainSrc = readFileSync(path.join(ROOT, "js", "main.js"), "utf8");
  const titleSrcSlots = readFileSync(path.join(ROOT, "js", "title.js"), "utf8");
  check("slots: S and L enter one saves panel and quota JSON has a UI path",
    /showPanel\("saves", "name"\)/.test(mainSrc) && /showPanel\("saves", "list"\)/.test(mainSrc)
      && /unsavedExport/.test(mainSrc) && /app\.ui\.savesPanel/.test(titleSrcSlots));
}

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
  check("news: ordinary people stories stay in the reader; only a centenarian obituary flashes",
    !TICKER_FLASH.test("CENTENARY — Ada Shellworth is ONE HUNDRED. A plaque goes up.")
    && !TICKER_FLASH.test("OBITUARY — Fenpa Howell, 61, a wolf of (12,30), mourned by 4.")
    && TICKER_FLASH.test("OBITUARY 100 — Ada Shellworth, 100, a tortoise of (12,30), mourned by 4."));
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
  check("news: index.html mounts #news and generated help names the key", /id="news"/.test(html2) && /R news/.test(uiSrc));
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

// ---- Part F: selected people stories, named reports and linked reader ------------------------
{
  const { storyTick, STORY_PREFIXES } = await import("../js/sim/story.js");
  const { KIND } = await import("../js/sim/life.js");
  const { createHousehold, placeHousehold, removeCitizen } = await import("../js/sim/citizens.js");
  const { legacyOf } = await import("../js/sim/legacy.js");
  const { notables } = await import("../js/sim/census.js");
  const { newsRows, createNews, FILTERS, keyOf } = await import("../js/news.js");
  const { pinAndCentre } = await import("../js/person-link.js");
  const { toScreen, HALF_H } = await import("../js/iso/iso.js");
  const FEV = await import("../js/sim/events.js");

  const F = createWorld({ seed: "part-f-stories", w: 12, h: 12 });
  const home = 5 * F.w + 5;
  const hh = createHousehold(F, "rabbit", 4);
  placeHousehold(F, hh, home);
  const [dead, ...friends] = hh.members.map((id) => F.byId.get(id));
  F.tick = 61 * 12;
  dead.born = 0;
  dead.friends = friends.map((c) => c.id);
  for (const c of friends) c.friends = [dead.id];
  F.lifeEvents = [];
  removeCitizen(F, dead, "died");
  const beforeStory = stateHash(F);
  const beforeStoryNoNews = stateHashNoNews(F);
  const ordinaryFlash = storyTick(F);
  const obituary = F.events.log.filter((e) => e.id.startsWith("story-obituary:"));
  check("story: three distinct mourners produce one truthful, linked obituary",
    obituary.length === 1 && obituary[0].who?.join() === String(dead.id)
      && obituary[0].line === `OBITUARY — ${dead.name} ${dead.surname}, 61, a rabbit of (5,5), mourned by 3.`
      && legacyOf(F, dead.id)?.home === home && ordinaryFlash.length === 0,
    obituary.map((x) => x.line).join(" | "));
  check("story: its only simulation difference is the saved news row",
    stateHash(F) !== beforeStory && stateHashNoNews(F) === beforeStoryNoNews,
    `${beforeStory}→${stateHash(F)} · no-news ${beforeStoryNoNews}→${stateHashNoNews(F)}`);
  storyTick(F);
  check("story: retrying the editor cannot duplicate an obituary", F.events.log.filter((e) => e.id.startsWith("story-obituary:")).length === 1);

  const X = createWorld({ seed: "part-f-collisions", w: 12, h: 12 });
  const xh = createHousehold(X, "wolf", 6);
  placeHousehold(X, xh, home);
  X.tick = 61 * 12;
  const xs = xh.members.map((id) => X.byId.get(id));
  const subjects = xs.slice(0, 3), witnesses = xs.slice(3);
  for (const c of subjects) { c.name = "Same"; c.surname = "Record"; c.born = 0; c.friends = witnesses.map((m) => m.id); }
  for (const c of witnesses) c.friends = subjects.map((s) => s.id);
  X.lifeEvents = [];
  removeCitizen(X, subjects[0], "died");
  removeCitizen(X, subjects[1], "killed");
  removeCitizen(X, subjects[2], "sold");
  storyTick(X); storyTick(X);
  const collisions = newsRows(X).filter((r) => r.id.startsWith("story-obituary:"));
  check("story: identical rendered obituaries retain two subject identities; killing counts, sale does not",
    collisions.length === 2 && collisions[0].text === collisions[1].text
      && new Set(collisions.map((r) => r.id)).size === 2 && new Set(collisions.map((r) => keyOf(r))).size === 2
      && collisions.some((r) => r.who[0] === subjects[0].id) && collisions.some((r) => r.who[0] === subjects[1].id)
      && !collisions.some((r) => r.who[0] === subjects[2].id),
    collisions.map((r) => `${r.id}/${keyOf(r)}`).join(" | "));

  const Y = createWorld({ seed: "part-f-name-punctuation", w: 12, h: 12 });
  const yh = createHousehold(Y, "tortoise", 4);
  placeHousehold(Y, yh, home);
  Y.tick = 100 * 12;
  const [centenarian, ...ym] = yh.members.map((id) => Y.byId.get(id));
  centenarian.name = "Ada, 61"; centenarian.surname = "Shellworth"; centenarian.born = 0;
  centenarian.friends = ym.map((c) => c.id);
  for (const c of ym) c.friends = [centenarian.id];
  Y.lifeEvents = [];
  removeCitizen(Y, centenarian, "died");
  const oldFlash = storyTick(Y);
  check("story: centenarian flashing is a structural prefix, not age parsed behind a free-form name",
    oldFlash.length === 1 && /^OBITUARY 100 — Ada, 61 Shellworth, 100,/.test(oldFlash[0]) && FEV.TICKER_FLASH.test(oldFlash[0])
      && !FEV.TICKER_FLASH.test("OBITUARY — Young, 100 Trickname, 61, a rabbit of (5,5), mourned by 3."));

  const parents = friends.slice(0, 2);
  const child = friends[2];
  F.lifeEvents = [
    { id: parents[0].id, kind: KIND.LITTER, arg: 1 },
    { id: parents[1].id, kind: KIND.LITTER, arg: 1 },
    { id: child.id, kind: KIND.BORN, arg: home },
  ];
  storyTick(F);
  check("story: two parent witnesses to one singleton birth do NOT invent a litter of two",
    F.events.log.filter((e) => e.id.startsWith("story-litter:")).length === 0);
  F.lifeEvents[0].arg = 3;
  F.lifeEvents[1].arg = 3;
  storyTick(F);
  const litter = F.events.log.filter((e) => e.id.startsWith("story-litter:"));
  check("story: two witnesses to a true litter coalesce once at the declared size, never their sum",
    litter.length === 1 && /A litter of 3/.test(litter[0].line) && !/litter of 6/.test(litter[0].line)
      && litter[0].who?.includes(parents[0].id) && litter[0].who?.includes(parents[1].id) && litter[0].who?.includes(child.id),
    litter.map((x) => x.line).join(" | "));

  F.lifeEvents = [{ id: parents[0].id, kind: KIND.CENTENARY, arg: null }];
  storyTick(F); storyTick(F);
  const centuries = F.events.log.filter((e) => e.id.startsWith("story-centenary:"));
  check("story: CENTENARY moved to one story writer and is idempotent",
    centuries.length === 1 && centuries[0].who?.join() === String(parents[0].id) && /^CENTENARY/.test(centuries[0].line));

  const obit61 = obituary[0].line;
  const obit100 = obit61.replace("OBITUARY —", "OBITUARY 100 —").replace(", 61,", ", 100,");
  check("story: prefixes classify consistently and ordinary stories never flash",
    STORY_PREFIXES.join() === "OBITUARY,LITTER,CENTENARY"
      && FEV.TICKER_BAD.test(obit61) && !FEV.TICKER_GOOD.test(obit61) && !FEV.TICKER_FLASH.test(obit61)
      && FEV.TICKER_BAD.test(obit100) && FEV.TICKER_FLASH.test(obit100)
      && FEV.TICKER_GOOD.test(litter[0].line) && !FEV.TICKER_BAD.test(litter[0].line) && !FEV.TICKER_FLASH.test(litter[0].line)
      && FEV.TICKER_GOOD.test(centuries[0].line) && !FEV.TICKER_BAD.test(centuries[0].line) && !FEV.TICKER_FLASH.test(centuries[0].line));
  const rosterIds = FEV.ROSTER.map((r) => r.id).sort();
  const registeredIds = FEV.NEWS_ROSTER.map((r) => r[0]).sort();
  check("story: every event roster id has exactly one generated primary-chip registration",
    new Set(registeredIds).size === registeredIds.length && JSON.stringify(rosterIds) === JSON.stringify(registeredIds)
      && FEV.ROSTER.every((event) => String(event.fire).includes(event.news[0]))
      && FEV.NEWS_ROSTER.every((r) => (Number(FEV.TICKER_BAD.test(r[1])) + Number(FEV.TICKER_GOOD.test(r[1]))) === 1 && FEV.TICKER_FLASH.test(r[1])),
    `${rosterIds.join()} vs ${registeredIds.join()}`);

  const notable = notables(F);
  check("story: census.notables deterministically names the oldest resident and largest household",
    notable.oldest?.id === parents[0].id || notable.oldest?.id === parents[1].id || notable.oldest?.id === child.id
      ? notable.largest?.household === hh.id && notable.largest.size === 3 && notable.largest.member === Math.min(...friends.map((c) => c.id))
      : false,
    JSON.stringify(notable));

  const J = createWorld({ seed: "part-f-january", w: 12, h: 12 });
  const jHome = 5 * J.w + 5;
  J.terrain[jHome] = 0;
  J.zone[jHome] = ZONE.R; J.maxTier[jHome] = 3; J.tier[jHome] = 1;
  J.road[jHome - 1] = ROAD.NS | ROAD.EW;
  const jh = createHousehold(J, "rabbit", 3);
  placeHousehold(J, jh, jHome);
  J.tick = 120;
  J.events.noDisasters = true;
  const [doomed, survivor] = jh.members.map((id) => J.byId.get(id));
  doomed.name = "Doomed"; doomed.surname = "January"; doomed.born = -1200; doomed.deathAge = J.tick - doomed.born;
  survivor.name = "Living"; survivor.surname = "February"; survivor.born = -600; survivor.deathAge = 99999;
  tick(J);
  const januaryReport = J.events.log.find((r) => r.t === 120 && /^REPORT /.test(r.line));
  check("story: a January death is recomputed out of that same month's named REPORT",
    januaryReport && !januaryReport.line.includes("Doomed January") && !januaryReport.who?.includes(doomed.id)
      && januaryReport.line.includes("Living February") && januaryReport.who?.includes(survivor.id),
    januaryReport?.line || "no report");

  F.events.log.push({ t: F.tick, id: "named-operation", line: `KILLING — ${parents[0].name} ${parents[0].surname} was seen.`, links: [parents[0].id] });
  const feed = newsRows(F);
  const restoredFeed = newsRows(load(save(F)));
  check("story: every who id resolves, and save/load preserves the ordered arrays",
    feed.filter((r) => r.people).length === 3
      && feed.every((r) => r.who.every((id) => F.byId.has(id) || legacyOf(F, id)))
      && feed.every((r) => r.links.every((id) => F.byId.has(id) || legacyOf(F, id)))
      && JSON.stringify(feed.map((r) => [r.who, r.links])) === JSON.stringify(restoredFeed.map((r) => [r.who, r.links])));
  check("story: the fifth news chip is the exact who.length people filter",
    FILTERS.length === 5 && FILTERS[4][0] === "people" && feed.filter(FILTERS[4][2]).every((r) => r.who.length)
      && feed.some((r) => r.id === "named-operation" && !r.people && r.links[0] === parents[0].id));

  const target = { target: { tx: 2, ty: 3, citizen: { home } }, citizen: dead.id };
  const camera = { x: 99, y: 99 };
  let pinned = null, painted = null;
  const linkedApp = { world: F, camera, input: { pinCitizen: (id) => { pinned = id; return true; }, hoverInfo: () => target }, ui: { updateHover: (x) => { painted = x; } } };
  const expected = toScreen(home % F.w, (home / F.w) | 0);
  check("story: the shared name action pins the exact id, centres its home rather than a walker and refreshes the card",
    pinAndCentre(linkedApp, dead.id) && pinned === dead.id && camera.x === expected[0] && camera.y === expected[1] + HALF_H && painted === target);

  const { installDom, stubApp } = await import("./dom-shim.mjs");
  const doc = installDom();
  const clicked = [];
  let pref = { news: { "check-city": [] } };
  const readerApp = stubApp(F, {
    ui: { refresh() {} },
    prefs: { get: () => pref, set: (patch) => { pref = { ...pref, ...patch }; } },
    pinCitizen: (id) => { clicked.push(id); return true; },
  });
  const reader = createNews(readerApp);
  readerApp.news = reader;
  reader.open();
  const host = doc.getElementById("news");
  const links = host.querySelectorAll("button.person-link");
  const peopleChip = host.querySelectorAll("button").find((b) => /^people /.test(b.textContent));
  const beforeUnread = reader.unread();
  const clickedLink = links.at(-1);
  if (clickedLink) clickedLink.dispatch("click");
  check("story: the real reader handler renders safe name buttons, marks the linked row read, pins its id and closes",
    links.length > 1 && peopleChip && clicked[0] === Number(clickedLink.dataset.citizen) && host.hidden === true
      && reader.unread() === beforeUnread - 1,
    `${links.length} links · clicked ${clicked.join()} · unread ${beforeUnread}→${reader.unread()} · hidden ${host.hidden}`);

  X.events.log.push({ t: X.tick, id: "same-name-links", line: "DUPLICATES — Same Record met Same Record.", links: [subjects[0].id, subjects[1].id] });
  const sameApp = stubApp(X, { ui: { refresh() {} }, pinCitizen: () => true });
  const sameReader = createNews(sameApp); sameApp.news = sameReader; sameReader.open();
  const sameRow = host.querySelectorAll("li.nrow").find((li) => /DUPLICATES/.test(li.textContent));
  const sameButtons = sameRow?.querySelectorAll("button.person-link") || [];
  check("story: equal printed names bind successive occurrences to their exact linked citizen ids",
    sameButtons.length === 2 && Number(sameButtons[0].dataset.citizen) === subjects[0].id && Number(sameButtons[1].dataset.citizen) === subjects[1].id,
    sameButtons.map((b) => b.dataset.citizen).join(","));
  sameReader.close();

  const reports = newsRows(A.world).filter((r) => r.report && r.people);
  check("story: populated yearly REPORTs name both notables and carry their ids",
    reports.length > 0 && reports.every((r) => /Oldest resident:/.test(r.text) && /Largest household:/.test(r.text) && r.who.length >= 1),
    `${reports.length} named reports`);
}

// ---- Part P: one tool registry, left palette and collision-free keys -------------------------
{
  const paletteHash = stateHash(A.world);
  const { TOOLS, TOOL_BY_ID, TOOL_BY_KEY, PLACE_TOOLS, labelForOp, spriteForTool, toolHelp } = await import("../js/tools.js");
  const { art } = await import("../js/art/index.js");
  const { paintSprite } = await import("../js/render.js");
  const HC = await import("./headless-canvas.mjs");
  HC.installCanvas();

  const ids = ["R", "C", "I", "M", "road", "wall", "rail", "station", "tree", "park", "zoo", "centre", "police", "fire", "inspect", "bulldoze", "largePark", "camera"];
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "Z", "V", "P", "F", "I", "B", "G", "E"];
  const orders = Array.from({ length: 18 }, (_, i) => i + 1);
  check("palette: the canonical registry has the owner's exact eighteen tools, order and unique keys",
    JSON.stringify(TOOLS.map((t) => t.id)) === JSON.stringify(ids)
      && JSON.stringify(TOOLS.map((t) => t.key)) === JSON.stringify(keys)
      && JSON.stringify(TOOLS.map((t) => t.order)) === JSON.stringify(orders)
      && new Set(TOOLS.map((t) => t.key.toUpperCase())).size === 18
      && TOOLS.every((t) => TOOL_BY_ID[t.id] === t && TOOL_BY_KEY[t.key.toUpperCase()] === t));
  const expectedKinds = ["zone", "zone", "zone", "zone", "road", "wall", "rail", "station", "tree", "park", "zoo", "centre", "police", "fire", "inspect", "bulldoze", "largePark", "camera"];
  check("palette: every ordered row carries its exact operation and the four zones keep R/C/I/M identity",
    JSON.stringify(TOOLS.map((t) => t.op.kind)) === JSON.stringify(expectedKinds)
      && JSON.stringify(TOOLS.slice(0, 4).map((t) => t.op.zone)) === JSON.stringify([ZONE.R, ZONE.C, ZONE.I, ZONE.M])
      && TOOLS.every((t) => labelForOp(t.op) === t.label));
  check("palette: no build binding is WASD and place-tool classification is derived from the registry",
    TOOLS.every((t) => !["W", "A", "S", "D"].includes(t.key.toUpperCase()))
      && JSON.stringify(PLACE_TOOLS) === JSON.stringify(["station", "park", "zoo", "centre", "police", "fire", "largePark"]));

  const opsSrc = readFileSync(path.join(ROOT, "js", "sim", "ops.js"), "utf8");
  const costBody = opsSrc.slice(opsSrc.indexOf("export function costOf"), opsSrc.indexOf("function snapshot"));
  const costKinds = new Set([...costBody.matchAll(/case "([a-zA-Z]+)"/g)].map((m) => m[1]));
  const surfacedKinds = new Set([...TOOLS.map((t) => t.op.kind).filter((x) => x !== "inspect"), "use"]);
  const missingKinds = [...costKinds].filter((kind) => !surfacedKinds.has(kind));
  const extraKinds = [...surfacedKinds].filter((kind) => !costKinds.has(kind));
  check("palette: every tile op accepted by costOf is surfaced once by a build tool or top-strip Use",
    missingKinds.length === 0 && extraKinds.length === 0, `missing ${missingKinds.join(",")} · extra ${extraKinds.join(",")}`);
  check("palette: non-tile rate/toggle/choice/cheat ops are the explicit non-build allow-list",
    ["rate", "toggle", "choice", "cheat"].every((kind) => new RegExp(`op\\.kind === "${kind}"`).test(opsSrc))
      && TOOLS.every((t) => !["rate", "toggle", "choice", "cheat", "use"].includes(t.op.kind)));

  const iconRows = [];
  let spriteFailures = 0;
  for (const tool of TOOLS) {
    try {
      const sprite = spriteForTool(art, tool);
      const canvas = HC.createCanvas(1, 1);
      paintSprite(canvas, sprite, 1);
      const visible = canvas._data.some((v, i) => i % 4 === 3 && v > 0);
      if (!visible || canvas.width !== sprite.w || canvas.height !== sprite.h) spriteFailures++;
      iconRows.push(`${tool.id}:${sprite.name}`);
    } catch (e) { spriteFailures++; iconRows.push(`${tool.id}:ERROR ${e.message}`); }
  }
  const expectedSprites = ["R1-cottage-0", "C1-shop-0", "I1-shed-0", "M1-stall-0", "road-5", "wall-5", "rail-5", "station-ns", "tree-round", "park", "civic-zoo-3x3", "civic-centre-3x3", "civic-police-3x3", "civic-fire-3x3", "cursor", "rubble", "civic-largePark-3x3", "camera-0"];
  const scaled = HC.createCanvas(1, 1);
  const scaledSprite = spriteForTool(art, "R");
  paintSprite(scaled, scaledSprite, 2);
  let nearest = scaled.width === scaledSprite.w * 2 && scaled.height === scaledSprite.h * 2;
  for (let y = 0; nearest && y < scaled.height; y += 2) for (let x = 0; nearest && x < scaled.width; x += 2) {
    const p = (y * scaled.width + x) * 4;
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1]]) {
      const q = ((y + dy) * scaled.width + x + dx) * 4;
      for (let c = 0; c < 4; c++) if (scaled._data[p + c] !== scaled._data[q + c]) nearest = false;
    }
  }
  check("palette: all eighteen representative sprites resolve, paint nonblank once, and scale nearest-neighbour",
    spriteFailures === 0 && nearest && JSON.stringify(iconRows.map((row) => row.slice(row.indexOf(":") + 1))) === JSON.stringify(expectedSprites), iconRows.join(" · "));

  // A deliberately small DOM proves creation, click/focus parity and ARIA
  // without a second implementation of layout or of the sprites.
  const priorDocument = globalThis.document;
  const made = [];
  function decorate(node, tag) {
    node.tagName = tag.toUpperCase(); node.children = []; node.style ||= {}; node.dataset ||= {}; node.attributes = {}; node.events = {};
    node.append = (...children) => { node.children.push(...children); };
    node.addEventListener = (type, fn) => { node.events[type] = fn; };
    node.setAttribute = (name, value) => { node.attributes[name] = String(value); };
    const classes = new Set();
    node.classList = { toggle(name, on) { if (on) classes.add(name); else classes.delete(name); }, contains: (name) => classes.has(name) };
    Object.defineProperty(node, "innerHTML", { get: () => "", set: () => { node.children = []; }, configurable: true });
    made.push(node);
    return node;
  }
  const host = decorate({}, "nav");
  globalThis.document = {
    getElementById: (id) => id === "palette" ? host : null,
    createElement: (tag) => decorate(tag === "canvas" ? HC.createCanvas(1, 1) : {}, tag),
  };
  const selected = [], costs = [];
  let paletteRef = null;
  const fakeInput = {
    tool: "R",
    setTool(id) { selected.push(id); this.tool = id; if (paletteRef) paletteRef.setTool(id); },
    previewTool: (id) => ({ text: `cost:${id}`, refused: id === "bulldoze" }),
    refreshCost() { costs.push("restore"); },
  };
  const { createPalette } = await import("../js/palette.js");
  const palette = createPalette({ input: fakeInput, ui: { setCost: (text, refused) => costs.push(`${text}:${refused}`) }, art });
  paletteRef = palette;
  let clickParity = palette.buttons.size === 18;
  for (const tool of TOOLS) {
    const button = palette.buttons.get(tool.id);
    button.events.pointerenter();
    button.events.click();
    clickParity &&= costs.at(-1) === `cost:${tool.id}:${tool.id === "bulldoze"}`;
    button.events.pointerleave();
    clickParity &&= selected.at(-1) === tool.id && button.attributes["aria-label"].includes(tool.key)
      && button.attributes["aria-describedby"] === "cost" && button.attributes["aria-pressed"] === "true"
      && [...palette.buttons].filter(([, b]) => b.attributes["aria-pressed"] === "true").length === 1;
  }
  const interleave = palette.buttons.get("road");
  const restores0 = costs.filter((x) => x === "restore").length;
  interleave.events.focus();
  interleave.events.pointerenter();
  interleave.events.pointerleave();
  const focusHeldPreview = costs.filter((x) => x === "restore").length === restores0;
  interleave.events.blur();
  const focusReleased = costs.filter((x) => x === "restore").length === restores0 + 1;
  interleave.events.pointerenter();
  interleave.events.focus();
  interleave.events.blur();
  const hoverHeldPreview = costs.filter((x) => x === "restore").length === restores0 + 1;
  interleave.events.pointerleave();
  const hoverReleased = costs.filter((x) => x === "restore").length === restores0 + 2;
  const focusHoverStable = focusHeldPreview && focusReleased && hoverHeldPreview && hoverReleased;
  palette.setTool("bulldoze");
  const semanticActive = palette.buttons.get("bulldoze").attributes["aria-pressed"] === "true"
    && palette.buttons.get("bulldoze").classList.contains("on")
    && [...palette.buttons].filter(([, b]) => b.attributes["aria-pressed"] === "true").length === 1;
  globalThis.document = priorDocument;
  check("palette: eighteen accessible buttons paint once; pointer, click, cost preview and active state stay synchronized",
    clickParity && semanticActive && focusHoverStable && made.filter((e) => e.tagName === "CANVAS").length === 18
      && costs.some((x) => x === "cost:bulldoze:true") && costs.filter((x) => x === "restore").length === 20,
    JSON.stringify({ buttons: palette.buttons.size, canvases: made.filter((e) => e.tagName === "CANVAS").length, selected, costs: costs.length, semanticActive, focusHoverStable }));

  const html = readFileSync(path.join(ROOT, "index.html"), "utf8");
  const css = readFileSync(path.join(ROOT, "css", "field.css"), "utf8");
  const uiSrc = readFileSync(path.join(ROOT, "js", "ui.js"), "utf8");
  const inputSrc = readFileSync(path.join(ROOT, "js", "input.js"), "utf8");
  const newsSrc = readFileSync(path.join(ROOT, "js", "news.js"), "utf8");
  check("palette: markup and CSS put a scroll-safe 2×8 remote before the map and reflow it 4×4 below 720px",
    html.indexOf('id="palette"') < html.indexOf('id="stage"')
      && /grid-template-columns:\s*repeat\(2/.test(css) && /max-height:\s*719px/.test(css)
      && /grid-template-columns:\s*repeat\(4/.test(css) && /overflow-y:\s*auto/.test(css));
  // Conservative declared-width budget at 12 px monospace. The breakpoint
  // hides every command label (ARIA/title retain it), so even the longest
  // possible clock leaves a real cost gutter instead of clipping the clock.
  const worstClock = "Sep 999999 · paused (×0.25) · overlay: pollution · ×2";
  const visibleKeys = ["H", "U", "␣", ",", ".", "⌫", "Ctrl+S", "L", "O", "R", "+", "N", "Esc"].join("");
  const titleWidth = 145, chromeWidth = 16 + 18, costGutter = 70;
  const toolBoxesAndGaps = 13 * 14 + visibleKeys.length * 7.5 + 3 * 14 + 15 * 2;
  const stripBudget1280 = titleWidth + chromeWidth + costGutter + toolBoxesAndGaps + worstClock.length * 7.5;
  check("palette: the unwrapped 1280px strip has a declared width budget and keeps the clock visible",
    stripBudget1280 < 1280 && /@media \(max-width:\s*1350px\)/.test(css)
      && /button\.tool\s*>\s*span:not\(\.key\)\s*\{\s*display:\s*none/.test(css)
      && /#clock\s*\{[^}]*flex:\s*none/.test(css) && /#cost\s*\{[^}]*flex:\s*1/.test(css), `${stripBudget1280}px upper bound`);
  const { createRenderer } = await import("../js/render.js");
  const { toScreen, HALF_H } = await import("../js/iso/iso.js");
  let boxW = 640, boxH = 400;
  const resizeCanvas = HC.createCanvas(10, 10);
  Object.defineProperty(resizeCanvas, "clientWidth", { get: () => boxW });
  Object.defineProperty(resizeCanvas, "clientHeight", { get: () => boxH });
  const resizeWorld = createWorld({ seed: "palette-resize", w: 32, h: 32 });
  const resizeRenderer = createRenderer(resizeCanvas, resizeWorld, art);
  const [centreX, centreY] = toScreen(12, 14);
  const resizeCamera = { x: centreX, y: centreY + HALF_H, zoom: 1 };
  const pickedWide = resizeRenderer.pick(resizeCanvas.width / 2, resizeCanvas.height / 2, resizeCamera);
  boxW = 412; boxH = 276;
  resizeRenderer.resize();
  const pickedNarrow = resizeRenderer.pick(resizeCanvas.width / 2, resizeCanvas.height / 2, resizeCamera);
  check("palette: renderer resize consumes the canvas's post-layout CSS box and preserves exact tile picking",
    resizeCanvas.width === boxW && resizeCanvas.height === boxH
      && pickedWide?.[0] === 12 && pickedWide?.[1] === 14 && pickedNarrow?.[0] === 12 && pickedNarrow?.[1] === 14,
    JSON.stringify({ canvas: [resizeCanvas.width, resizeCanvas.height], pickedWide, pickedNarrow }));
  check("palette: input, palette and generated footer all read the one registry; build buttons are gone from the strip",
    /from "\.\/tools\.js"/.test(inputSrc) && /labelForOp\(op\)/.test(inputSrc)
      && /toolHelp\(\)/.test(uiSrc) && !/for \(const t of TOOLS\)/.test(uiSrc)
      && /id="help"/.test(html) && toolHelp().split(" · ").length === 18);
  check("palette: WASD has no command or news binding; S/D tap timing is gone; undo/save use their modifiers",
    !/case "Key[WASD]"/.test(newsSrc) && /case "ArrowRight"/.test(newsSrc)
      && !/TAP_MS|downAt|promoteHolds/.test(inputSrc) && /case "Backspace"/.test(inputSrc)
      && /e\.code === "KeyS"/.test(inputSrc) && /e\.code === "KeyZ"/.test(inputSrc));
  check("palette: creating/painting/selecting the entire remote is simulation- and save-neutral",
    stateHash(A.world) === paletteHash && stateHash(A.world) === stateHash(load(save(A.world))));
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
    const zoo = { sprite: art.civic("largePark", 2), tx: 0, ty: 4, kind: "building" };
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
    // THE RAY AUDIT (tools/depthaudit.mjs): every oblong solid against walkers
    // ringing it on the four roads, pixel by pixel through the view ray. The
    // 2×2 zoo reproduces round 2's result (0 mis-ordered); a bare 3×3 probe
    // and every 3×3 block prove the size-aware pull-back (painter.js
    // FOOTPRINTS) — the flat 0.7 left a 3×3 with a 0.05-tile margin.
    {
      const { auditDepth, probeSolid, auditWalkers } = await import("./depthaudit.mjs");
      const { pullbackOf } = await import("../js/iso/painter.js");
      const { RECIPES } = await import("../js/art/buildings.js");
      const walkers = await auditWalkers();
      const oblongs = [];
      for (const { sprite } of allSprites()) { const [fw, fh] = sprite.footprint || [1, 1]; if (fw * fh > 1 && RECIPES.has(sprite)) oblongs.push(sprite); }
      oblongs.push(await probeSolid(3, 48), await probeSolid(2, 48));
      // The CAMERA is 1x1 and still belongs in this audit, which is why the
      // footprint filter above cannot find it: every other 1x1 solid stands on
      // a LOT, and walkers do not cross lots. A camera stands on a ROAD, in the
      // lane the animals actually walk, so it is the one 1x1 whose depth
      // against a walker is a live question. Measured 0 mis-ordered over 132
      // positions and 2,552 overlapping pixels — the police station's score.
      const { CAMERAS } = await import("../js/art/buildings.js");
      oblongs.push(...CAMERAS);
      const audited = [];
      const misordered = [];
      for (const sprite of oblongs) {
        const res = auditDepth(sprite, walkers);
        audited.push(`${sprite.name} ${res.overlaps}px`);
        if (res.bad) misordered.push(`${sprite.name}: ${res.bad} px at (${res.worst.wx.toFixed(2)}, ${res.worst.wy.toFixed(2)})`);
      }
      check("painter: the ray audit — no oblong, and no camera in the road, paints a pixel on the wrong side of a walker", oblongs.length >= 3 && audited.some((a) => a.startsWith("camera-")) && misordered.length === 0, misordered.join("; ") || audited.join(", "));
      // painter.js FOOTPRINTS: back ∈ (s − 1.75, s − 0.44), kept at the zoo's margins by 0.7 + (s − 2).
      check("painter: the pull-back is 0 for a 1×1, 0.7 for a 2×2, 1.7 for a 3×3", pullbackOf(1) === 0 && pullbackOf(2) === 0.7 && Math.abs(pullbackOf(3) - 1.7) < 1e-9);
      // The 3×3 band, the 2×2 band's shape on the walkers' own convention (a
      // walker at (tx, ty) stands on the centre of that tile): a walker on the
      // east road (tx = 3) beside ANY row of the block, or on the south road
      // (ty = 7) beside any column, paints over it; one on the north or west
      // road paints before. Ground is not asserted: it is never in the
      // building's scene (render.js static layer; shots.mjs's own pass).
      const p3 = oblongs.find((s) => s.name === "probe-3x3");
      const blk = { sprite: p3, tx: 0, ty: 4, kind: "building" };
      let over = true, under = true;
      for (const ty of [4, 4.1, 4.5, 5, 6, 6.9]) if (!(keyOf(walker(3, ty)) > keyOf(blk))) over = false;
      for (const tx of [0, 0.1, 1, 2.9]) if (!(keyOf(walker(tx, 7)) > keyOf(blk))) over = false;
      for (const [tx, ty] of [[0, 3], [1, 3], [2, 3], [2.9, 3], [-1, 4], [-1, 5], [-1, 6.9]]) if (!(keyOf(walker(tx, ty)) < keyOf(blk))) under = false;
      check("painter: a walker on the road beside a 3×3 paints over it; one behind it paints before", over && under);
      // The cursor on a footprint tile borrows the building's key and sits a hair under it, wherever on the footprint it is drawn.
      const cursorOn = (tx, ty) => keyOf({ sprite: art.overlay("cursor"), tx, ty, kind: "ground", z: Z_BUILDING - 1, keyAt: [0, 4], footprint: [3, 3] });
      check("painter: the cursor on any tile of a 3×3 keys just under the block", [[0, 4], [2, 6], [1, 5]].every(([tx, ty]) => cursorOn(tx, ty) < keyOf(blk) && cursorOn(tx, ty) > keyOf(blk) - 2));
    }
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
  // THE HI-RES SET (js/art/hires.js, SPEC §12.6): every box solid and every
  // ground diamond has a 2× twin made from its recipe — the same picture
  // twice the size: the anchor on the same world point, the ink within 12%
  // of 4× (grain gets finer, edges do not move), every pixel a palette key
  // (defineSprite), the prism gate at 2×. The animals, trees and glyphs
  // stay hand-drawn and have none.
  {
    const { hires, allHires } = await import("../js/art/hires.js");
    const { ink } = await import("../js/art/format.js");
    const twins = allHires(list);
    const bad = [];
    for (const { name, sprite, hi } of twins) {
      // The grid's 1-px pad does not scale and floor/ceil round once per side, so a twin is up to 6 px short of double on each axis, never over.
      const okSize = hi.w <= 2 * sprite.w + 1 && hi.w >= 2 * sprite.w - 6 && hi.h <= 2 * sprite.h + 1 && hi.h >= 2 * sprite.h - 6;
      const okAnchor = Math.abs(hi.anchor[0] / 2 - sprite.anchor[0]) <= 1 && Math.abs(hi.anchor[1] / 2 - sprite.anchor[1]) <= 1;
      const i1 = ink(sprite.rows), i4 = ink(hi.rows) / 4;
      const okInk = Math.abs(i4 - i1) <= Math.max(4, 0.12 * i1);
      if (!(okSize && okAnchor && okInk && hi.scale === 2)) bad.push(`${name}: ${sprite.w}×${sprite.h}→${hi.w}×${hi.h} anchor ${sprite.anchor}→${hi.anchor} ink ${i1}→${i4.toFixed(0)}`);
    }
    check("hires: every twin is twice the size, anchored on the same world point, with the ink within 12% of 4×", twins.length >= 150 && bad.length === 0, bad.slice(0, 5).join("; ") || `${twins.length} twins`);
    const names = new Set(twins.map((t) => t.name));
    const solidsAndGround = list.filter(({ sprite }) => (sprite.tags || []).some((t) => ["building", "civic", "ground", "block", "wall", "station", "bridge", "road", "rail", "chalk", "grass", "water", "kerb", "rubble"].includes(t)) && !/^tree-|^overlay-fire|^overlay-rubble/.test(sprite.name));
    const missing = solidsAndGround.filter(({ name }) => !names.has(name)).map((n) => n.name);
    check("hires: every solid and every ground diamond has a twin; the animals and trees do not", missing.length === 0 && !hires(art.citizen("rabbit", "se", 0, "adult")) && !hires(art.tree("round")), missing.slice(0, 8).join(", "));
    let overhang2 = [];
    for (const { name, sprite, hi } of twins) {
      const tags = sprite.tags || [];
      if (!(tags.includes("building") || tags.includes("civic") || tags.includes("overlay"))) continue;
      if (name.startsWith("overlay-fire") || name.startsWith("overlay-rubble") || name.startsWith("overlay-flood") || name === "flood") continue;
      const [fw, fh] = sprite.footprint || [1, 1];
      const A = 32 * fw, B = 32 * fh; // 2× px per unit is 4 along x, 2 along y — the prism scales with the grid
      const ay = hi.anchor[1] - (16 * fw + 16 * fh);
      let n = 0;
      for (let py = 0; py < hi.rows.length; py++) for (let px = 0; px < hi.rows[py].length; px++) {
        if (hi.rows[py][px] === ".") continue;
        const x = px - hi.anchor[0], y = py - ay;
        const yMax = 2 * Math.min(A, B + x / 2) - x / 2;
        if (x < -2 * B - 2 || x > 2 * A + 2 || y > yMax + 2) n++;
      }
      if (n) overhang2.push(`${name}: ${n}px`);
    }
    check("hires: no 2× solid emits a pixel outside its footprint prism", overhang2.length === 0, overhang2.join(", "));
    check("hires: a twin is cached — the same object twice", hires(art.building(1, 3, 0)) === hires(art.building(1, 3, 0)));
  }
  console.log(`art: ${list.length} sprites audited · ${SPECIES.length} species checked`);
} else {
  console.log("art: js/art/index.js not present yet — Part C skipped");
}

// ---- Part C': durable citizen Inspect targets --------------------------------
{
  const { pinTarget } = await import("../js/follow.js");
  const { clearLot, createHousehold, placeHousehold, removeCitizen } = await import("../js/sim/citizens.js");
  const { legacyOf } = await import("../js/sim/legacy.js");
  const P = createWorld({ seed: "citizen-pin", w: 8, h: 8 });
  P.zone[9] = ZONE.R; P.tier[9] = 1;
  const hh = createHousehold(P, "rabbit", 2);
  placeHousehold(P, hh, 9);
  const c = P.byId.get(hh.members[0]);
  const before = stateHash(P);
  const walkers = [
    { id: c.id, citizen: c.id, kind: "stroller", leg: 1, seg: 2, tx: 6.5, ty: 5.5, done: false },
    { id: c.id, citizen: c.id, kind: "commuter", leg: 0, seg: 1, tx: 3.5, ty: 2.5, done: false },
  ];
  const walkingA = pinTarget(P, walkers, c.id), walkingB = pinTarget(P, walkers.slice().reverse(), c.id);
  check("inspect: pinTarget follows the same deterministic live walker independent of list order",
    walkingA?.state === "walking" && walkingA.walker.kind === "commuter"
      && walkingA.tx === walkingB.tx && walkingA.ty === walkingB.ty && stateHash(P) === before);
  const home = pinTarget(P, [], c.id);
  check("inspect: between walks a citizen-id pin returns to the current home",
    home?.state === "home" && home.tile === 9 && home.tx === 1 && home.ty === 1);
  c.held = P.tick + 6; c.heldAt = 18;
  const away = pinTarget(P, walkers, c.id);
  check("inspect: custody overrides a stale walker and resolves as away",
    away?.state === "away" && away.tile === 18 && away.walker === null);
  c.held = 0; c.heldAt = -1;
  const bearHh = createHousehold(P, "bear", 2), bear = P.byId.get(bearHh.members[0]);
  placeHousehold(P, bearHh, 9);
  P.events.active.push({ id: "bearWinter", until: P.tick + 3 });
  check("inspect: bear winter is an honest away state", pinTarget(P, [], bear.id)?.line.includes("bear winter"));
  const oldHome = c.home;
  removeCitizen(P, c, "left");
  const gone = pinTarget(P, [], c.id);
  check("inspect: a departure keeps the pin as a gone epitaph at the last home",
    gone?.state === "gone" && gone.tile === oldHome && gone.line.includes("left town") && gone.line.includes(c.name));
  const E = createWorld({ seed: "citizen-pin-eviction", w: 8, h: 8 });
  E.zone[9] = ZONE.R; E.tier[9] = 1;
  const eh = createHousehold(E, "owl", 2);
  placeHousehold(E, eh, 9);
  const evictedId = eh.members[0];
  E.zone[9] = ZONE.NONE; E.tier[9] = 0;
  clearLot(E, 9);
  const evicted = pinTarget(E, [], evictedId);
  check("inspect: a real cleared-lot departure archives and targets its last occupied home",
    legacyOf(E, evictedId)?.home === 9 && evicted?.state === "gone" && evicted.tile === 9,
    JSON.stringify(legacyOf(E, evictedId)));
  check("inspect: malformed or unknown ids fail safely", pinTarget(P, [], -1) === null && pinTarget(P, [], 999999) === null);

  const inputSource = readFileSync(path.join(ROOT, "js/input.js"), "utf8");
  const uiSource = readFileSync(path.join(ROOT, "js/ui.js"), "utf8");
  check("inspect: input stores a citizen id, never a walker object",
    /pinnedCitizen/.test(inputSource) && !/pinnedWalker/.test(inputSource));
  check("inspect: the citizen card consumes portrait, need, voice, biography, friend and household links",
    /paintPortrait/.test(uiSource) && /needOf/.test(uiSource) && /needLine/.test(uiSource)
      && /lifeLines/.test(uiSource) && /memorial/.test(uiSource) && /personLink/.test(uiSource) && /householdPeople/.test(uiSource));
  const simPinLeak = files.filter((f) => /[\\/]sim[\\/]/.test(f) && /pinnedCitizen|pinTarget|zoo\.pref|\.stars\b/.test(readFileSync(f, "utf8"))).map((f) => path.relative(ROOT, f));
  check("inspect: simulation modules never read UI pins or browser preferences", simPinLeak.length === 0, simPinLeak.join(", "));
}

// ---- Part D: stable looks, faces and the fourth (idle) pose -----------------
{
  const { art, allSprites } = await import("../js/art/index.js");
  const { SPECIES_IDS, AGES, FACINGS, LOOK_MARKS, allCitizens } = await import("../js/art/citizens.js");
  const { rampOf, hasKey } = await import("../js/art/palette.js");
  const pairs = (ids) => new Set(ids.map((id) => JSON.stringify(art.look(id))));
  const sampleIds = Array.from({ length: 401 }, (_, i) => i - 200);
  const stable = sampleIds.every((id) => JSON.stringify(art.look(id)) === JSON.stringify(art.look(id)));
  check("looks: the pure id hash is stable for positive and negative ids and reaches all four bit pairs",
    stable && pairs(sampleIds).size === 4, [...pairs(sampleIds)].join(" · "));
  let badLookInput = false;
  try { art.look(NaN); } catch { badLookInput = true; }
  check("looks: a non-finite identity is rejected instead of becoming everybody's default", badLookInput);

  const markNames = {
    rabbit: "lop ear", mouse: "notched ear", fox: "white tail-tip", beaver: "pale chest",
    owl: "brow tufts", bear: "muzzle patch", tortoise: "shell scute", raccoon: "lighter mask",
    pig: "cheek spot", cow: "Holstein patch", wolf: "grey saddle", cat: "tabby stripe",
    hawk: "chest bars", skunk: "double stripe",
  };
  check("looks: all fourteen declared motifs are the promised species details",
    SPECIES_IDS.every((species) => LOOK_MARKS[species] && LOOK_MARKS[species].name === markNames[species]),
    SPECIES_IDS.filter((species) => !LOOK_MARKS[species] || LOOK_MARKS[species].name !== markNames[species]).join(", "));

  let pairwise = true, anchors = true, markBoxes = true, markSeen = true, shadeRamp = true, cubShadeOnly = true, idleDistinct = true, glassesByHash = true;
  const lookFailures = [];
  for (const species of SPECIES_IDS) for (const age of AGES) {
    for (let shade = 0; shade < 2; shade++) for (let mark = 0; mark < 2; mark++) {
      const look = { shade, mark };
      for (const facing of FACINGS) for (let frame = 0; frame < 4; frame++) {
        const s = art.citizen(species, facing, frame, age, { look });
        const want = age === "cub" ? [4, s.h - 1] : [6, s.h - 1];
        if (s.anchor[0] !== want[0] || s.anchor[1] !== want[1]) anchors = false;
      }
    }
    for (const facing of FACINGS) for (let frame = 0; frame < 4; frame++) {
      const four = [];
      for (let shade = 0; shade < 2; shade++) for (let mark = 0; mark < 2; mark++)
        four.push(art.citizen(species, facing, frame, age, { look: { shade, mark } }).rows.join("\n"));
      if (new Set(four).size !== 4) {
        pairwise = false;
        lookFailures.push(`${species} ${age} ${facing} f${frame}: ${new Set(four).size}/4`);
      }
    }
    for (const facing of FACINGS) {
      const base = art.citizen(species, facing, 0, age, { look: { shade: 0, mark: 0 } });
      const idle = art.citizen(species, facing, 3, age, { look: { shade: 0, mark: 0 } });
      if (base.rows.join("\n") === idle.rows.join("\n")) idleDistinct = false;
      for (let shade = 0; shade < 2; shade++) {
        const wears = art.citizen(species, facing, 0, age, { look: { shade, mark: 1 } }).rows.join("").includes("=");
        if (wears !== (age === "elder" && shade === 1)) glassesByHash = false;
      }
    }
    if (age !== "cub") for (const facing of FACINGS) for (let frame = 0; frame < 4; frame++) for (let shade = 0; shade < 2; shade++) {
      const a = art.citizen(species, facing, frame, age, { look: { shade, mark: 0 } });
      const b = art.citizen(species, facing, frame, age, { look: { shade, mark: 1 } });
      const authored = facing === "sw" ? "se" : facing === "nw" ? "ne" : facing;
      const box = LOOK_MARKS[species][authored].box;
      const x0 = facing === "sw" || facing === "nw" ? 12 - box[0] - box[2] : box[0];
      let changed = 0;
      for (let y = 0; y < a.h; y++) for (let x = 0; x < a.w; x++) if (a.rows[y][x] !== b.rows[y][x]) {
        changed++;
        if (x < x0 || x >= x0 + box[2] || y < box[1] || y >= box[1] + box[3]) markBoxes = false;
      }
      if (!changed) markSeen = false;
      if (box[2] > 6 || box[3] > 6) markBoxes = false;
    }

    // Adult shade changes are exactly one darker rung and never a silhouette,
    // accent, shell or clothing change. Elder glasses intentionally compose
    // with that hash bit, so this isolates the coat law on adults.
    if (age === "adult") for (const facing of FACINGS) for (let frame = 0; frame < 4; frame++) for (let mark = 0; mark < 2; mark++) {
      const light = art.citizen(species, facing, frame, "adult", { look: { shade: 0, mark } });
      const dark = art.citizen(species, facing, frame, "adult", { look: { shade: 1, mark } });
      let shadeChanged = 0;
      for (let y = 0; y < light.h; y++) for (let x = 0; x < light.w; x++) if (light.rows[y][x] !== dark.rows[y][x]) {
        shadeChanged++;
        const ra = rampOf(light.rows[y][x]), rb = rampOf(dark.rows[y][x]);
        if (!ra || !rb || ra.name !== rb.name || ra.index - rb.index !== 1) shadeRamp = false;
      }
      if (!shadeChanged) shadeRamp = false;
    }

    // The cub's second identity treatment may change coat value only: no
    // adult motif, no outline or silhouette pixel, and no cross-ramp colour.
    if (age === "cub") for (const facing of FACINGS) for (let frame = 0; frame < 4; frame++) for (let shade = 0; shade < 2; shade++) {
      const ca = art.citizen(species, facing, frame, "cub", { look: { shade, mark: 0 } });
      const cb = art.citizen(species, facing, frame, "cub", { look: { shade, mark: 1 } });
      let cubChanged = 0;
      for (let y = 0; y < ca.h; y++) for (let x = 0; x < ca.w; x++) if (ca.rows[y][x] !== cb.rows[y][x]) {
        cubChanged++;
        const ra = rampOf(ca.rows[y][x]), rb = rampOf(cb.rows[y][x]);
        if (!ra || !rb || ra.name !== rb.name) cubShadeOnly = false;
      }
      if (cubChanged < 4) cubShadeOnly = false;
    }
  }
  check("looks: all four looks differ for every species and age, including shade-only cub treatments", pairwise, lookFailures.join("; "));
  check("looks: every walk and idle pose keeps its anchor on the feet", anchors);
  check("looks: every species and age has a visible fourth pose, and exactly shade-1 elders wear glasses", idleDistinct && glassesByHash);
  check("looks: each adult/elder mark changes pixels only inside its declared mirrored <=6x6 box", markBoxes && markSeen);
  check("looks: shade darkens only fur, exactly one ramp rung where it can move", shadeRamp);
  check("looks: cub identity four-way resolution changes local coat value only", cubShadeOnly);

  let carryBody = true;
  for (const species of SPECIES_IDS) for (const age of ["adult", "elder"]) for (const facing of FACINGS) for (let frame = 0; frame < 4; frame++)
    for (let shade = 0; shade < 2; shade++) for (let mark = 0; mark < 2; mark++) {
      const look = { shade, mark };
      const plain = art.citizen(species, facing, frame, age, { look });
      const carry = art.citizen(species, facing, frame, age, { look, carry: "sack" });
      const bare = (r) => species === "tortoise" ? r.replace(/\+/g, ".") : r;
      for (let k = 1; k <= 12; k++) if (bare(carry.rows[carry.h - k].slice(3, 15)) !== bare(plain.rows[plain.h - k])) carryBody = false;
      if (carry.anchor[0] !== plain.anchor[0] + 3 || carry.anchor[1] !== carry.h - 1) carryBody = false;
    }
  check("looks: a carried sack preserves every marked and shaded body row across the full matrix", carryBody);

  let portraits = true, expressions = true, portraitLooks = true, portraitSpecies = new Set(), invalidPortrait = false;
  let portraitCount = 0;
  for (const species of SPECIES_IDS) for (const age of AGES) for (let shade = 0; shade < 2; shade++) for (let mark = 0; mark < 2; mark++) {
    const made = ["glad", "flat", "low"].map((expression) => art.portrait(species, { age, shade, mark, expression }));
    portraitCount += made.length;
    if (new Set(made.map((p) => p.rows.join("\n"))).size !== 3) expressions = false;
    for (let i = 0; i < made.length; i++) {
      const p = made[i];
      if (p.w !== 16 || p.h !== 16 || p.rows.some((r) => [...r].some((key) => !hasKey(key)))) portraits = false;
      if (p.rows.join("").includes("=") !== (age === "elder" && shade === 1)) portraits = false;
      if (p !== art.portrait(species, { age, shade, mark, expression: ["glad", "flat", "low"][i] })) portraits = false;
    }
    if (age === "adult" && shade === 0 && mark === 0) portraitSpecies.add(made[1].rows.join("\n"));
  }
  for (const species of SPECIES_IDS) for (const age of AGES) {
    const four = [];
    for (let shade = 0; shade < 2; shade++) for (let mark = 0; mark < 2; mark++)
      four.push(art.portrait(species, { age, shade, mark, expression: "flat" }).rows.join("\n"));
    if (new Set(four).size !== 4) portraitLooks = false;
  }
  try { art.portrait("rabbit", { expression: "furious" }); } catch { invalidPortrait = true; }
  check("portraits: 14 species x 3 ages x 4 looks x 3 expressions are 16x16 valid cached sprites",
    portraits && portraitCount === 504, `${portraitCount}`);
  check("portraits: all four looks and all expressions differ, every species reads differently, and invalid expressions throw",
    portraitLooks && expressions && portraitSpecies.size === SPECIES_IDS.length && invalidPortrait, `${portraitSpecies.size}/${SPECIES_IDS.length} species`);

  const registered = allCitizens(), registeredNames = new Set(registered.map((x) => x.name));
  const registeredPortraits = registered.filter(({ sprite }) => sprite.tags.includes("portrait"));
  check("looks: allCitizens walks the exact full matrix without duplicate cache names",
    registered.length === 3236 && registeredNames.size === registered.length && registeredPortraits.length === 504,
    `${registered.length} entries · ${registeredNames.size} names · ${registeredPortraits.length} portraits`);
  check("looks: the global art registry keeps every look and portrait after name de-duplication",
    allSprites().filter(({ sprite }) => sprite.tags.includes("portrait")).length === 504);
  const lookSheet = path.join(ROOT, "docs", "shots", "sheet-looks.png");
  const portraitSheet = path.join(ROOT, "docs", "shots", "sheet-portraits.png");
  check("looks: both PNG critic sheets exist and are non-empty",
    existsSync(lookSheet) && existsSync(portraitSheet) && statSync(lookSheet).size > 1000 && statSync(portraitSheet).size > 1000);

  const HC = await import("./headless-canvas.mjs");
  HC.installCanvas();
  const { paintPortrait } = await import("../js/render.js");
  const pc = HC.createCanvas(1, 1), ps = art.portrait("fox", { shade: 1, mark: 1, expression: "glad" });
  paintPortrait(pc, ps, 3);
  let nearest = pc.width === 48 && pc.height === 48;
  for (let sy = 0; sy < 16; sy++) for (let sx = 0; sx < 16; sx++) {
    const first = ((sy * 3) * pc.width + sx * 3) * 4;
    for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) {
      const at = (((sy * 3 + dy) * pc.width) + sx * 3 + dx) * 4;
      for (let c = 0; c < 4; c++) if (pc._data[at + c] !== pc._data[first + c]) nearest = false;
    }
  }
  check("portraits: paintPortrait produces an exact nearest-neighbour integer scale", nearest);

  const renderSrcD = readFileSync(path.join(ROOT, "js", "render.js"), "utf8");
  const citizenCalls = renderSrcD.match(/art\.citizen\(/g) || [];
  const lookArgs = renderSrcD.match(/art\.citizen\([^\n]+look:/g) || [];
  check("looks: normal, tent, prey and picking render paths all pass their stored look",
    citizenCalls.length >= 5 && lookArgs.length === citizenCalls.length, `${lookArgs.length}/${citizenCalls.length} look-bearing calls`);
  const specD = readFileSync(path.join(ROOT, "SPEC.md"), "utf8");
  check("looks: SPEC records the cub-resolution, portrait and idle contracts", /### 12\.3b/.test(specD) && /shade-only/i.test(specD) && /paintPortrait/.test(specD));
}

// ---- Part C2: the play camera (tools/play.mjs photographs the REAL renderer) ----
{
  const HC = await import("./headless-canvas.mjs");
  HC.installCanvas();
  const { createRenderer } = await import("../js/render.js");
  const { createWalkers } = await import("../js/walkers.js");
  const { art } = await import("../js/art/index.js");
  const { toScreen, HALF_H } = await import("../js/iso/iso.js");

  const P = load(A.saved);
  computeFields(P);
  const canvas = HC.createCanvas(480, 320);
  const renderer = createRenderer(canvas, P, art);
  const walkers = createWalkers(P);
  walkers.notify();
  // Aim at the middle of what is BUILT, the way play.mjs does.
  let n = 0, cx = 0, cy = 0;
  for (let i = 0; i < P.w * P.h; i++) if (P.tier[i] > 0) { cx += i % P.w; cy += (i / P.w) | 0; n++; }
  const [ax, ay] = toScreen(cx / n + 0.5, cy / n + 0.5);
  const camera = { x: ax, y: ay + HALF_H, zoom: 2 };
  const frame = () => { renderer.draw(camera, null, walkers, "off", 0); return Buffer.from(canvas._data).toString("base64"); };
  const palette = () => {
    const d = canvas._data;
    const seen = new Set();
    for (let i = 0; i < d.length; i += 4) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    return seen.size;
  };

  const shot = frame();
  const colours = palette();
  // THE check this section exists for. play.mjs's first draft read left/w off
  // mapBounds (which returns minX/maxX/minY/maxY), sent the camera to NaN, and
  // wrote a full set of PNGs that were one flat rectangle of background. The
  // tool "worked": it ran, it captioned, it exited 0. Only looking caught it.
  check("play: a town renders to something that is not a blank rectangle",
    n > 10 && colours > 12, `${colours} distinct colours over ${n} built lots`);

  // Four real citizens, carrying only need codes as the walker contract says,
  // exercise Canvas text and the screen-space bubble pass through render.js.
  const bubbleCodes = ["SMOKE", "NO_PARK", "NO_JOB", "WATER"];
  const speakers = P.citizens.slice(0, 4).map((c, i) => ({
    id: c.id, citizen: c.id, species: c.species, age: "adult", need: bubbleCodes[i],
    tx: cx / n + (i - 1.5) * 0.8, ty: cy / n + (i & 1 ? 0.7 : -0.7),
  }));
  renderer.draw(camera, null, { list: () => speakers }, "off", 0);
  const withThoughts = Buffer.from(canvas._data).toString("base64");
  check("needs: the real renderer paints four legible screen-space thought bubbles",
    renderer.drawBubbles(speakers) === 4 && withThoughts !== shot, `${speakers.length} speakers`);
  const bubbleBounds = (zoom) => {
    const c = HC.createCanvas(320, 200);
    const r = createRenderer(c, P, art);
    const speaker = speakers[0];
    const [px, py] = toScreen(speaker.tx, speaker.ty);
    r.draw({ x: px, y: py + HALF_H, zoom }, null, null, "off", 0);
    const before = Uint8ClampedArray.from(c._data);
    r.drawBubbles([speaker]);
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      const i = (y * c.width + x) * 4;
      if (before[i] === c._data[i] && before[i + 1] === c._data[i + 1] && before[i + 2] === c._data[i + 2]) continue;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    return [x1 - x0 + 1, y1 - y0 + 1];
  };
  const bubbleAt1 = bubbleBounds(1), bubbleAt2 = bubbleBounds(2);
  check("needs: thought bubbles have the same device-pixel box at zoom 1 and zoom 2",
    bubbleAt1[0] > 20 && bubbleAt1[1] > 8 && bubbleAt1[0] === bubbleAt2[0] && bubbleAt1[1] === bubbleAt2[1],
    `zoom 1 ${bubbleAt1.join("×")} · zoom 2 ${bubbleAt2.join("×")}`);
  const edgeTail = (headX, headY) => {
    const c = HC.createCanvas(320, 200);
    const r = createRenderer(c, P, art);
    const speaker = speakers[0];
    const [px, py] = toScreen(speaker.tx, speaker.ty);
    const edgeCamera = {
      x: px + c.width / 2 - headX,
      y: py + HALF_H + c.height / 2 - 24 - headY,
      zoom: 1,
    };
    r.draw(edgeCamera, null, null, "off", 0);
    r.drawBubbles([speaker]);
    const x = Math.max(0, Math.min(c.width - 1, headX));
    const y = Math.max(0, Math.min(c.height - 1, headY));
    const i = (y * c.width + x) * 4;
    return c._data[i] === 0x2a && c._data[i + 1] === 0x26 && c._data[i + 2] === 0x20;
  };
  check("needs: a clamped bubble keeps its tail on each edge and points toward off-screen pins",
    edgeTail(0, 100) && edgeTail(319, 100) && edgeTail(160, 0) && edgeTail(160, 199)
      && edgeTail(-40, 100) && edgeTail(360, 100) && edgeTail(160, -30) && edgeTail(160, 230));
  const eightSpeakers = P.citizens.slice(0, 8).map((c, i) => ({
    id: c.id, citizen: c.id, species: c.species, age: "adult", need: bubbleCodes[i % bubbleCodes.length],
    tx: cx / n + (i % 4 - 1.5), ty: cy / n + ((i / 4) | 0) - 0.5,
  }));
  for (let i = 0; i < 10; i++) renderer.drawBubbles(eightSpeakers);
  const thoughtT0 = performance.now();
  for (let i = 0; i < 100; i++) renderer.drawBubbles(eightSpeakers);
  const thoughtMs = (performance.now() - thoughtT0) / 100;
  // Contention-proof for the same reason as "tick cost" above: ~0.17 ms real,
  // and a bound a hundred times that. The printed line below is the measurement.
  check("needs: the cached eight-bubble pass is not catastrophic (the printed number is the instrument)",
    thoughtMs < 25, `${thoughtMs.toFixed(3)} ms`);
  console.log(`needs: 8-bubble pass ${thoughtMs.toFixed(3)} ms · zoom boxes ${bubbleAt1.join("×")} / ${bubbleAt2.join("×")}`);

  // Two layers, two rules, and the difference is the whole reason play.mjs
  // has to invalidate. A BUILDING is in the per-frame pass and appears the
  // moment the world says so. The GROUND — terrain, roads, chalk and the
  // RUBBLE tile — is a cached bitmap rebuilt only when the renderer is dirty
  // or the camera has walked near its margin. play.mjs's first draft never
  // invalidated, so a burnt lot vanished on cue and left no rubble behind it
  // for six months: the picture was half live and half a memory.
  //
  // The nearest lot to the camera's aim; one merely inside the x range can be
  // off the top of the frame, and a change nobody can see proves nothing.
  const nearestAim = (fn) => {
    let pick = -1, best = Infinity;
    for (let i = 0; i < P.w * P.h; i++) {
      if (!fn(i)) continue;
      const d = Math.hypot((i % P.w) - cx / n, ((i / P.w) | 0) - cy / n);
      if (d < best) { best = d; pick = i; }
    }
    return pick;
  };
  // GROUND: an EMPTY zoned lot, so nothing in the per-frame pass moves at all.
  const bare = [];
  for (let i = 0; i < P.w * P.h; i++) if (P.tier[i] === 0 && P.terrain[i] !== 1 && !P.road[i] && !P.civic[i] && !P.wall[i] && !P.rail[i] && !P.rubble[i] && !P.burning[i]) {
    bare.push(i); P.rubble[i] = KNOBS.RUBBLE_MONTHS; // rubble precedes chalk/grass in the cached ground pass
  }
  const stale = frame();
  check("play: the GROUND does not follow the world without an invalidate — a camera that never calls it photographs a memory",
    bare.length > 0 && stale === shot, `${bare.length} ground tiles changed with no invalidate`);
  renderer.invalidate();
  const fresh = frame();
  check("play: and it does follow once invalidate() is called",
    fresh !== stale, `${bare.length} ground tiles still not drawn`);
  // BUILDING: the per-frame pass, no invalidate needed.
  const lot = nearestAim((i) => P.tier[i] > 0 && !P.rubble[i] && !P.burning[i]);
  const withLot = frame();
  P.tier[lot] = 0;
  check("play: a BUILDING is in the per-frame pass and needs no invalidate at all",
    lot >= 0 && frame() !== withLot, `lot ${lot % P.w},${(lot / P.w) | 0}`);

  // THE HI-RES SET IS VISIBLE (the "render upgrade must be visible" rule):
  // at zoom 2 the 2× rows put detail inside device 2×2 blocks that a scaled
  // 1× frame cannot have — finer grass dither, brick grain, a window's edge
  // on an odd pixel. Same town, same integer camera: with art.hires,
  // thousands of non-uniform 2×2 device blocks; with it removed, NONE — a
  // 1× frame scaled by an even transform is 2×2-uniform everywhere.
  {
    const cam = { x: Math.round(ax), y: Math.round(ay + HALF_H), zoom: 2 };
    const blocks = (c) => {
      const d = c._data, W = c.width, H = c.height;
      let n = 0;
      for (let y = 0; y + 1 < H; y += 2) for (let x = 0; x + 1 < W; x += 2) {
        const i = (y * W + x) * 4, j = i + 4, k = i + W * 4, l = k + 4;
        if (d[i] !== d[j] || d[i + 1] !== d[j + 1] || d[i + 2] !== d[j + 2] || d[i] !== d[k] || d[i + 1] !== d[k + 1] || d[i + 2] !== d[k + 2] || d[i] !== d[l] || d[i + 1] !== d[l + 1] || d[i + 2] !== d[l + 2]) n++;
      }
      return n;
    };
    const cHi = HC.createCanvas(480, 320);
    createRenderer(cHi, P, art).draw(cam, null, null, "off", 0);
    const cLo = HC.createCanvas(480, 320);
    createRenderer(cLo, P, { ...art, hires: null }).draw(cam, null, null, "off", 0);
    const nHi = blocks(cHi), nLo = blocks(cLo);
    check("hires: at zoom 2 the frame carries sub-block detail a scaled 1× frame cannot — thousands of non-uniform 2×2 device blocks with the twins, none without",
      nHi > 2000 && nLo === 0, `${nHi} with the twins, ${nLo} without (of ${(480 / 2) * (320 / 2)})`);
    // And at zoom 1 nothing changed: the same frame with and without the twins.
    const cam1 = { ...cam, zoom: 1 };
    const a1 = HC.createCanvas(480, 320), b1 = HC.createCanvas(480, 320);
    createRenderer(a1, P, art).draw(cam1, null, null, "off", 0);
    createRenderer(b1, P, { ...art, hires: null }).draw(cam1, null, null, "off", 0);
    check("hires: zoom 1 is byte-identical with or without the twins", Buffer.from(a1._data).equals(Buffer.from(b1._data)));
  }

  // The shim's scale is what makes the browser's zoom photographable.
  const c1 = HC.createCanvas(40, 40);
  const c2 = HC.createCanvas(40, 40);
  const src = HC.createCanvas(4, 4);
  const sctx = src.getContext("2d");
  sctx.fillStyle = "#ff0000";
  sctx.fillRect(0, 0, 4, 4);
  const solid = (c) => { let k = 0; for (let i = 3; i < c._data.length; i += 4) if (c._data[i]) k++; return k; };
  c1.getContext("2d").drawImage(src, 0, 0);
  const g2 = c2.getContext("2d");
  g2.setTransform(3, 0, 0, 3, 0, 0);
  g2.drawImage(src, 0, 0);
  check("play: the headless canvas scales a blit by the transform, nearest-neighbour",
    solid(c1) === 16 && solid(c2) === 144, `${solid(c1)} px at 1x, ${solid(c2)} at 3x (want 16 and 144)`);

  // Overlays are the one thing js/render.js draws as a PATH, and every overlay
  // colour is an rgba() — the shim parsed only #rrggbb until the play camera
  // needed them, and an unparsed colour is silently black.
  const c3 = HC.createCanvas(8, 8);
  const g3 = c3.getContext("2d");
  g3.fillStyle = "#ffffff";
  g3.fillRect(0, 0, 8, 8);
  g3.fillStyle = "rgba(255,0,0,0.5)";
  g3.beginPath();
  g3.moveTo(0, 0); g3.lineTo(8, 0); g3.lineTo(8, 8); g3.lineTo(0, 8); g3.closePath();
  g3.fill();
  check("play: rgba() fills blend instead of painting black",
    c3._data[0] === 255 && c3._data[1] > 100 && c3._data[1] < 160,
    `[${c3._data[0]}, ${c3._data[1]}, ${c3._data[2]}] — half red over white`);

  // One mayor. playtest.mjs prints her curves and play.mjs photographs her
  // town; when they disagree it must be a flag and never a second mayor.
  const playSrc = readFileSync(path.join(ROOT, "tools", "play.mjs"), "utf8");
  const ptSrc = readFileSync(path.join(ROOT, "tools", "playtest.mjs"), "utf8");
  check("play: both instruments import the ONE scripted mayor and neither plans blocks itself",
    /createMayor/.test(playSrc) && /createMayor/.test(ptSrc)
    && !/function nextBlock/.test(playSrc) && !/function nextBlock/.test(ptSrc));
  check("play: the camera photographs js/render.js itself, not a second drawing",
    /import\("\.\.\/js\/render\.js"\)/.test(playSrc) && !/paintScene/.test(playSrc));
}

// ---- Part N': the blocks — 2×2 and 3×3 buildings that grow (SPEC §3b; js/sim/blocks.js) ----
{
  const B = await import("../js/sim/blocks.js");
  const W = await import("../js/sim/world.js");
  const { lotScore, REASON, lotReport } = await import("../js/sim/lots.js");
  const { createHousehold, placeHousehold } = await import("../js/sim/citizens.js");
  const { recountRosters } = await import("../js/sim/fields.js");
  const { TERRAIN } = W;

  check("blocks: capacities are side² × 1.25 of a tier-3 lot — R 24/120/270 · C 20/100/225 · I 24/120/270 · M 16/80/180",
    JSON.stringify(B.blockCapacities()) === JSON.stringify({ R: { 1: 24, 2: 120, 3: 270 }, C: { 1: 20, 2: 100, 3: 225 }, I: { 1: 24, 2: 120, 3: 270 }, M: { 1: 16, 2: 80, 3: 180 } }), JSON.stringify(B.blockCapacities()));

  // A fixture: a dry 6×6, a road along its north edge, a 3×3 R patch zoned
  // High under it — tier 3 at its north corner, tier 2 on the other eight —
  // and households placed to three quarters of the four north-west lots.
  const F = createWorld({ seed: "blocks" });
  const at = (x, y) => y * F.w + x;
  for (let y = 9; y <= 14; y++) for (let x = 9; x <= 14; x++) { F.terrain[at(x, y)] = TERRAIN.GRASS; F.road[at(x, y)] = ROAD.NONE; }
  apply(F, { kind: "road", tiles: [9, 10, 11, 12, 13].map((x) => at(x, 9)) });
  apply(F, { kind: "zone", zone: ZONE.R, x0: 10, y0: 10, x1: 12, y1: 12, density: 3 });
  for (let y = 10; y <= 12; y++) for (let x = 10; x <= 12; x++) F.tier[at(x, y)] = 2;
  F.tier[at(10, 10)] = 3;
  F.valves.R = 0.5;
  F.events.noDisasters = true;
  computeFields(F);
  recountRosters(F);
  const house = (lot, n) => { for (let k = 0; k < n; k += 4) placeHousehold(F, createHousehold(F, "rabbit", Math.min(4, n - k)), lot); };
  house(at(10, 10), 20); house(at(11, 10), 8); house(at(10, 11), 8); house(at(11, 11), 4); // 40 of 54
  const a = at(10, 10);
  const s2 = lotScore(F, a);
  const fillOK = s2.window && Math.abs(s2.window.fill - 40 / 54) < 1e-9;
  check("blocks: a tier-3 lot with three tier-2 High neighbours in its 2×2, 74% full together, reads MERGING with the window on its report",
    s2.reason === REASON.MERGING && !!s2.merge && s2.merge.side === 2 && s2.merge.anchor === a && fillOK && s2.p > 0 && Math.abs(s2.p - KNOBS.BIG_P * s2.score) < 1e-9,
    `${s2.reason} · window ${JSON.stringify(s2.window)} · p ${s2.p}`);
  const under = lotScore(F, at(12, 12)); // a tier-2 lot: no window of its own, and it is not a part
  check("blocks: a tier-2 lot does not start a block", under.reason !== REASON.MERGING && !under.merge && under.reason !== REASON.PART);

  const parts2 = [at(11, 10), at(10, 11), at(11, 11)];
  const mergeMovedIds = F.citizens.filter((c) => parts2.includes(c.home)).map((c) => c.id);
  B.mergeLots(F, s2.merge);
  const homesOnAnchor = F.citizens.every((c) => c.dead || c.home === a) && F.households.every((h) => h.gone || h.home === a);
  check("blocks: the 2×2 — the anchor is big 2 at tier 3, the three parts point at it at tier 3, every animal and household is on the anchor, the parts hold nobody",
    F.big[a] === 2 && parts2.every((j) => W.isPart(F, j) && W.anchorOf(F, j) === a && F.tier[j] === 3 && F.occupants[j] === 0) && homesOnAnchor && F.occupants[a] === 40 && capacityOf(F, a) === 120 && W.sideOf(F, at(11, 11)) === 2,
    `big ${F.big[a]} occ ${F.occupants[a]} cap ${capacityOf(F, a)}`);
  check("blocks: households absorbed into a large residential block remember the move to its anchor",
    mergeMovedIds.length > 0 && mergeMovedIds.every((id) => F.byId.get(id)?.life.at(-1)?.[1] === 2 && F.byId.get(id)?.life.at(-1)?.[2] === a));
  const spread = [a, ...parts2].reduce((s, j) => s + W.occAt(F, j), 0);
  check("blocks: occAt spreads the anchor's 40 evenly over the footprint and sums back to 40", Math.abs(spread - 40) < 1e-9 && Math.abs(W.occAt(F, at(11, 11)) - 10) < 1e-9);
  const rep = lotReport(F, at(11, 11));
  check("blocks: a part's report is its anchor's building, naming the tile asked about", rep.part && rep.tx === 10 && rep.ty === 10 && rep.at.tx === 11 && rep.side === 2 && rep.occupants === 40 && rep.capacity === 120 && lotScore(F, at(11, 11)).reason === REASON.PART);
  check("blocks: a part offers no jobs and holds no capacity", capacityOf(F, at(11, 10)) === 0 && jobsOf(F, at(11, 10)) === 0);

  // To the 3×3: the five lots round the 2×2 are tier 2; fill the window to 70% of 120 + 5·10 = 170.
  house(a, 60); house(at(12, 10), 8); house(at(12, 11), 8); house(at(10, 12), 4); // 40 + 80 = 120 of 170
  const s3 = lotScore(F, a);
  check("blocks: a 2×2 with five tier-2 High lots round it, 70% full together, reads MERGING to a 3×3 anchored at its own north corner",
    s3.reason === REASON.MERGING && s3.merge && s3.merge.side === 3 && s3.merge.anchor === a && s3.merge.tiles.length === 9 && Math.abs(s3.window.fill - 120 / 170) < 1e-9,
    `${s3.reason} · ${JSON.stringify(s3.window)}`);
  B.mergeLots(F, s3.merge);
  const nine = W.footprintOf(F, a);
  check("blocks: the 3×3 — nine tiles at tier 3, eight parts on the anchor, 120 animals in 270", nine.length === 9 && F.big[a] === 3 && nine.every((j) => F.tier[j] === 3 && (j === a || W.isPart(F, j))) && F.occupants[a] === 120 && capacityOf(F, a) === 270 && lotScore(F, a).reason !== REASON.MERGING);

  // The save contract: `big` round-trips; a loaded block keeps its people on its anchor; the two towns hash-equal after six months.
  const G = load(save(F));
  const eq = nine.every((j) => G.big[j] === F.big[j]) && G.occupants[a] === 120;
  for (let t = 0; t < 6; t++) { tick(F); tick(G); }
  check("blocks: save → load keeps the block and its people, and six ticks later the two towns hash-equal", eq && stateHash(F) === stateHash(G), `${stateHash(F)} vs ${stateHash(G)}`);
  const anyOnPart = F.citizens.some((c) => !c.dead && (W.isPart(F, c.home) || (c.job >= 0 && W.isPart(F, c.job))));
  check("blocks: after six ticks nobody lives or works on a part", !anyOnPart);

  // The split: everyone stays housed — nine tier-3 lots hold 216 — and the anchor keeps one lot's worth.
  const before = F.citizens.filter((c) => !c.dead).length;
  const tiles = B.splitLot(F, a);
  let housed = 0;
  for (const j of tiles) housed += F.occupants[j];
  check("blocks: a split leaves nine tier-3 lots of their own, the anchor at or under 24, everyone rehomed on the block's own tiles, nobody on a part",
    tiles.length === 9 && tiles.every((j) => F.big[j] === 0 && F.tier[j] === 3) && F.occupants[a] <= 24 && housed === before && F.citizens.every((c) => c.dead || c.home >= 0),
    `anchor ${F.occupants[a]} · housed ${housed} of ${before}`);

  // The bulldozer on a PART of an occupied block: the whole footprint, one building, not undoable.
  B.mergeLots(F, { side: 2, anchor: a, tiles: [a, at(11, 10), at(10, 11), at(11, 11)] });
  recountRosters(F);
  const occBefore = F.occupants[a];
  const plan = costOfBulldoze(F, 11, 11);
  const rb = apply(F, { kind: "bulldoze", x0: 11, y0: 11, x1: 11, y1: 11 });
  const cleared = [a, at(11, 10), at(10, 11), at(11, 11)].every((j) => F.zone[j] === ZONE.NONE && F.tier[j] === 0 && F.big[j] === 0);
  check("blocks: bulldozing one part clears the whole 2×2 at §2 a tile, evicts once, and is not undoable",
    occBefore > 0 && plan.tiles.length === 4 && plan.cost === 4 * KNOBS.COST.bulldoze && plan.evicts === 1 && rb.ok && !rb.undoable && cleared && F.citizens.every((c) => c.dead || ![a, at(11, 10), at(10, 11), at(11, 11)].includes(c.home)),
    `tiles ${plan.tiles.length} cost ${plan.cost} evicts ${plan.evicts} undoable ${rb.undoable}`);
  // An EMPTY block: the same bulldoze undoes, tiles and all.
  apply(F, { kind: "zone", zone: ZONE.R, x0: 10, y0: 10, x1: 11, y1: 11, density: 3 });
  for (const j of [a, at(11, 10), at(10, 11), at(11, 11)]) F.tier[j] = 3;
  B.mergeLots(F, { side: 2, anchor: a, tiles: [a, at(11, 10), at(10, 11), at(11, 11)] });
  const rb2 = apply(F, { kind: "bulldoze", x0: 10, y0: 11, x1: 10, y1: 11 });
  const gone = F.big[a] === 0 && F.tier[a] === 0;
  const ru = undo(F);
  check("blocks: an empty block bulldozed by one of its parts comes back whole on undo", rb2.ok && rb2.undoable && gone && ru.ok && F.big[a] === 2 && F.tier[at(11, 11)] === 3 && W.isPart(F, at(11, 11)));

  // Fire: a part catches, the whole block burns, and burnt out it is rubble on every tile — one building.
  B.ignite(F, at(11, 11), 1);
  const allBurning = [a, at(11, 10), at(10, 11), at(11, 11)].every((j) => F.burning[j] === 1);
  tick(F);
  const allRubble = [a, at(11, 10), at(10, 11), at(11, 11)].every((j) => F.rubble[j] > 0 && F.tier[j] === 0 && F.big[j] === 0 && F.zone[j] === ZONE.R);
  check("blocks: fire takes the whole footprint — every tile burns together and every tile is rubble after", allBurning && allRubble, `burning ${allBurning} rubble ${allRubble}`);

  // The scripted mayor: the balanced town raises its first 2×2 in year 3; every block obeys the invariants.
  const M = createWorld({ seed: SEED });
  const { createMayor } = await import("./mayor.mjs");
  const mayor = createMayor(M, { layout: "balanced" });
  for (let t = 0; t < 48; t++) { mayor.month(t); tick(M); }
  const cen = M.last.census;
  let badParts = 0, onParts = 0, overCap = 0, anchors = 0;
  for (let i = 0; i < M.w * M.h; i++) {
    const b = M.big[i];
    if (b === 2 || b === 3) { anchors++; for (const j of W.footprintOf(M, i)) if (M.zone[j] !== M.zone[i] || M.tier[j] !== 3 || (j !== i && (!W.isPart(M, j) || W.anchorOf(M, j) !== i))) badParts++; }
    else if (b & W.PART) { const an = W.anchorOf(M, i); if (!(M.big[an] === 2 || M.big[an] === 3)) badParts++; }
    if (W.isPart(M, i) && (M.occupants[i] || M.staff[i])) onParts++;
    if (M.zone[i] === ZONE.R && M.occupants[i] > capacityOf(M, i)) overCap++;
  }
  check("blocks: the balanced mayor raises a 2×2 within four years, every part points at a live anchor of its zone at tier 3, nobody is on a part, nobody over capacity",
    cen.blocks2 + cen.blocks3 >= 1 && anchors === cen.blocks2 + cen.blocks3 && badParts === 0 && onParts === 0 && overCap === 0,
    `2×2 ${cen.blocks2} · 3×3 ${cen.blocks3} · bad ${badParts} · on parts ${onParts} · over ${overCap}`);
  check("blocks: the Rules tab has the block rule and reads the census", (await import("../js/sim/rules.js")).RULES.some((r) => r.id === "G5" && /2×2/.test(r.live(M))));
}
function costOfBulldoze(w, x, y) { return (0, costOfOp)(w, { kind: "bulldoze", x0: x, y0: y, x1: x, y1: y }); }

// ---- Part L: the landmarks — a 3×3 takes the name of the species that made it (SPEC §3c; js/sim/landmarks.js, js/art/landmarks.js) ----
{
  const L = await import("../js/sim/landmarks.js");
  const B = await import("../js/sim/blocks.js");
  const W = await import("../js/sim/world.js");
  const { SPECIES_BY_ID } = await import("../js/sim/species.js");
  const { lotScore, REASON, lotReport, lotsTick } = await import("../js/sim/lots.js");
  const { createHousehold, placeHousehold } = await import("../js/sim/citizens.js");
  const { recountRosters } = await import("../js/sim/fields.js");
  const { refreshLast } = await import("../js/sim/tick.js");
  const { RULES } = await import("../js/sim/rules.js");
  const { TICKER_GOOD, TICKER_FLASH } = await import("../js/sim/events.js");
  const { TERRAIN } = W;
  const { LANDMARKS, LANDMARK_OF, chooseTheme, landmarkLine } = L;
  const { art } = await import("../js/art/index.js"); // Part C's `art` is scoped to its own block

  // The roster: ids sequential from 1, real species, at most one landmark per species per zone, R/C/I only, unique names and keys.
  const rows = LANDMARKS.slice(1);
  const seenPerZone = {};
  let dup = 0;
  let unknown = 0;
  for (const lm of rows) {
    for (const s of lm.species) {
      if (!SPECIES_BY_ID[s]) unknown++;
      const k = `${lm.zone}:${s}`;
      if (seenPerZone[k]) dup++;
      seenPerZone[k] = true;
    }
  }
  check("landmarks: the roster — eleven rows with sequential ids, real species, one landmark per species per zone, zones R/C/I, unique names",
    rows.length === 11 && rows.every((lm, i) => lm.id === i + 1) && unknown === 0 && dup === 0 && rows.every((lm) => lm.zone >= ZONE.R && lm.zone <= ZONE.I) && new Set(rows.map((r) => r.name)).size === rows.length && new Set(rows.map((r) => r.key)).size === rows.length,
    `rows ${rows.length} unknown ${unknown} dup ${dup}`);
  check("landmarks: every species that led a block in the measured towns has a landmark in R (cat, fox, pig, beaver, bear, rabbit, mouse)",
    ["cat", "fox", "pig", "beaver", "bear", "rabbit", "mouse"].every((s) => LANDMARK_OF[ZONE.R][s]));

  // The chooser: kin summed, a tie or an unthemed leader leaves the plain block.
  check("landmarks: kin count together — rabbit 10 + mouse 9 beats cat 12 for Warren Towers", chooseTheme({ rabbit: 10, mouse: 9, cat: 12 }, ZONE.R).theme === 1);
  check("landmarks: the leading kin name the block — cat 42 + fox 24 over hawk 13 is the Mews, with the count of both", (() => { const p = chooseTheme({ cat: 42, fox: 24, hawk: 13, mouse: 12 }, ZONE.R); return p.theme === 5 && p.n === 66 && p.total === 91 && p.species.length === 2; })());
  check("landmarks: a tie at the top leaves the plain block", chooseTheme({ cat: 12, wolf: 12 }, ZONE.R).theme === 0 && chooseTheme({ cat: 12, wolf: 12 }, ZONE.R).tie === true);
  check("landmarks: a leading species with no landmark in the zone leaves the plain block (tortoise in R; cow in C), and an empty block is plain", chooseTheme({ tortoise: 5, rabbit: 4 }, ZONE.R).theme === 0 && chooseTheme({ cow: 9, fox: 3 }, ZONE.C).theme === 0 && chooseTheme({}, ZONE.R).theme === 0);
  check("landmarks: the industrial roster — cows raise the Dairy, pigs the Truffle Works, bears the Honey Works, beavers the Sawmill", chooseTheme({ cow: 3, pig: 2 }, ZONE.I).theme === 8 && chooseTheme({ pig: 3 }, ZONE.I).theme === 9 && chooseTheme({ bear: 2, cow: 1 }, ZONE.I).theme === 10 && chooseTheme({ beaver: 4, bear: 3 }, ZONE.I).theme === 11);

  // The fixture of Part N' — a 3×3 R patch under a road — filled with rabbits: the 3×3 rises as Warren Towers.
  const F = createWorld({ seed: "landmarks" });
  const at = (x, y) => y * F.w + x;
  for (let y = 9; y <= 14; y++) for (let x = 9; x <= 14; x++) { F.terrain[at(x, y)] = TERRAIN.GRASS; F.road[at(x, y)] = ROAD.NONE; }
  apply(F, { kind: "road", tiles: [9, 10, 11, 12, 13].map((x) => at(x, 9)) });
  apply(F, { kind: "zone", zone: ZONE.R, x0: 10, y0: 10, x1: 12, y1: 12, density: 3 });
  for (let y = 10; y <= 12; y++) for (let x = 10; x <= 12; x++) F.tier[at(x, y)] = 2;
  F.tier[at(10, 10)] = 3;
  F.valves.R = 0.5;
  F.events.noDisasters = true;
  computeFields(F);
  recountRosters(F);
  const house = (lot, n, species = "rabbit") => { for (let k = 0; k < n; k += 4) placeHousehold(F, createHousehold(F, species, Math.min(4, n - k)), lot); };
  house(at(10, 10), 20); house(at(11, 10), 8); house(at(10, 11), 8); house(at(11, 11), 4);
  const a = at(10, 10);
  const r2 = B.mergeLots(F, lotScore(F, a).merge);
  check("landmarks: a 2×2 takes no theme", r2.landmark === null && F.theme[a] === 0);
  house(a, 60); house(at(12, 10), 8); house(at(12, 11), 8); house(at(10, 12), 4);
  const s3 = lotScore(F, a);
  const Tick = load(save(F)); // the same city one instant before the block forms, for the real-tick proof below
  const r3 = B.mergeLots(F, s3.merge);
  check("landmarks: the 3×3 of rabbits rises as Warren Towers — theme 1 on the anchor, the pick counts all 120, the report names it",
    s3.merge && s3.merge.side === 3 && r3.landmark && r3.landmark.theme === 1 && r3.landmark.n === 120 && r3.landmark.total === 120 && F.theme[a] === 1 && W.footprintOf(F, a).every((j) => j === a || F.theme[j] === 0)
      && lotReport(F, a).landmark && lotReport(F, a).landmark.name === "Warren Towers" && lotReport(F, at(11, 11)).landmark.name === "Warren Towers",
    JSON.stringify(r3.landmark));
  const line = landmarkLine(F, a, r3.landmark);
  check("landmarks: the ticker line names the landmark, the family and the block's coordinates, and reads as good news that flashes",
    line === "LANDMARK — Warren Towers: the Burrowes have made a landmark of the block at (10,10); 120 of 120 living there are rabbits." && TICKER_GOOD.test(line) && TICKER_FLASH.test(line), line);
  check("landmarks: the anchor draws its landmark and a part draws nothing; the plain 3×3 is untouched",
    art.building(F.zone[a], F.tier[a], F.variant[a] & 1, W.sideOf(F, a), F.theme[a]).name === "R3x3-warren-towers-" + (F.variant[a] & 1) && art.building(1, 3, 0, 3, 0).name === "R3x3-towers-0" && art.building(1, 3, 0, 3).name === "R3x3-towers-0");
  refreshLast(F);
  const g6 = RULES.find((r) => r.id === "G6");
  check("landmarks: the census counts it by name and the Rules tab reads it", F.last.census.landmarks === 1 && F.last.census.landmarkCounts["Warren Towers"] === 1 && g6 && /1 landmark: Warren Towers/.test(g6.live(F)), g6 && g6.live(F));

  // The save contract: theme round-trips; an old save without it loads to zeros and hashes the same; a different theme is a different hash.
  const G = load(save(F));
  const plain = toPlain(F);
  delete plain.theme;
  const Old = load(JSON.stringify(plain));
  const H2 = load(save(F));
  H2.theme[a] = 2;
  check("landmarks: save → load keeps the theme and hashes equal; a save without the array loads to zeros and hashes as a themeless town; the theme is in the hash",
    G.theme[a] === 1 && stateHash(G) === stateHash(F) && Old.theme.every((n) => n === 0) && Old.theme.length === F.theme.length && stateHash(Old) !== stateHash(F) && stateHash(H2) !== stateHash(F));
  const Fresh = createWorld({ seed: "landmarks" });
  const freshPlain = toPlain(Fresh);
  const hadTheme = Array.isArray(freshPlain.theme) && freshPlain.theme.length === Fresh.w * Fresh.h;
  delete freshPlain.theme;
  check("landmarks: a town with no landmark hashes as it did before the landmarks — the all-zero array is saved but left out of the hash", hadTheme && stateHash(load(JSON.stringify(freshPlain))) === stateHash(Fresh));

  // Coming apart: a split clears the theme with the block; the bulldozer clears the footprint's.
  const K = load(save(F));
  B.splitLot(K, a);
  check("landmarks: a split clears the theme with the block", K.theme[a] === 0 && W.footprintOf(K, a).length === 1);
  const rb = apply(F, { kind: "bulldoze", x0: 11, y0: 11, x1: 11, y1: 11 });
  check("landmarks: the bulldozer on a part clears the landmark's theme with its footprint", rb.ok && F.theme[a] === 0 && F.big[a] === 0);

  // ANNOUNCED BY A REAL TICK. This used to be a scripted-mayor run on seed 7,
  // which raised a landmark in year 7 and so looked like a fixture. It is a
  // coin flip: a 3x3 needs nine tier-3 lots of one kind filled together, and a
  // census of eight scripted 30-year towns (4 seeds x 2 layouts) finds a
  // landmark in TWO of them - seed 7 at month 78 and seed 3 at month 233
  // before Part R, seed 3 at 310 and seed 11 at 291 after it. The rate did not
  // move; which town wins did, because access moved the trajectory. So the
  // plumbing is proved where it can be made to happen: the same nine rabbits,
  // merged by lotsTick INSIDE tick() with the merge roll forced, exactly as
  // the killing and arrest fixtures force theirs.
  const saveBigP = KNOBS.BIG_P;
  KNOBS.BIG_P = 1e6;
  const { notices: tickNotices } = tick(Tick);
  KNOBS.BIG_P = saveBigP;
  const M = Tick;
  const seen = tickNotices.find((line) => /^LANDMARK/.test(line)) || null;
  const logRows = M.events.log.filter((e) => e.id === "landmark");
  refreshLast(M); // tick() takes its census BEFORE lotsTick; the block is one instant younger than the count
  check("landmarks: a block that rises inside a real tick announces itself — lotsTick makes the line with the coordinates, logs it under its own id, and the census counts it",
    !!seen && /^LANDMARK — .+ at \(\d+,\d+\); \d+ of \d+ /.test(seen) && logRows.length === 1 && logRows[0].line === seen && M.last.census.landmarks === 1 && M.last.census.landmarkCounts["Warren Towers"] === 1,
    seen ? `${seen} · log ${logRows.length} census ${M.last.census.landmarks}` : `no LANDMARK among ${tickNotices.length} notices`);
  void lotsTick;
}

// ---- Part S: the shop pool — a tier-1 C lot is one of eleven small businesses, by its variant byte (SPEC §12.2d; js/sim/shops.js, js/art/shops.js) ----
{
  const S = await import("../js/sim/shops.js");
  const { art } = await import("../js/art/index.js");
  const { SHOP_ART } = await import("../js/art/shops.js");
  const { lotReport } = await import("../js/sim/lots.js");
  const { createHousehold, placeHousehold } = await import("../js/sim/citizens.js");
  const { recountRosters } = await import("../js/sim/fields.js");
  const { SPECIES_BY_ID } = await import("../js/sim/species.js");
  const { TERRAIN } = await import("../js/sim/world.js");
  const { SHOPS, shopKind, shopOfVariant, shopOf } = S;

  check("shops: the pool — eleven kinds with sequential ids, unique keys and names, the corner shop first",
    SHOPS.length === 11 && SHOPS.every((s, i) => s.kind === i) && new Set(SHOPS.map((s) => s.key)).size === 11 && new Set(SHOPS.map((s) => s.name)).size === 11 && SHOPS[0].key === "corner-shop");
  // Every variant byte lands on a kind, both mirrors of every kind occur, and no kind is starved.
  const hits = SHOPS.map(() => [0, 0]);
  for (let v = 0; v < 256; v++) hits[shopKind(v)][v & 1]++;
  check("shops: all 256 variant bytes spread over the eleven kinds, both mirrors each, none under 10 of 128", hits.every(([a, b]) => a >= 10 && b >= 10), JSON.stringify(hits));
  // The art follows the byte: kind by >> 1, mirror by & 1, a 1×1 footprint; the corner shop keeps variants 0 and 1 as they were.
  let wrong = [];
  for (let v = 0; v < 256; v++) {
    const s = art.building(2, 1, v);
    const k = shopKind(v);
    const want = k ? `C1-${SHOPS[k].key}-${v & 1}` : `C1-shop-${v & 3}`;
    if (s !== SHOP_ART[k][v & (k === 0 ? 3 : 1)] || s.name !== want || s.footprint[0] !== 1 || s.footprint[1] !== 1) wrong.push(`${v}:${s.name}`);
  }
  check("shops: art.building(2, 1, variant) is the pool's sprite for every byte — the existing kind, four corner-shop plans and paired specialist shops — on a 1×1 footprint", wrong.length === 0, wrong.slice(0, 5).join(" "));
  check("shops: variants 0 and 1 are still the corner shop, and other one-tile families read only the low two bits",
    art.building(2, 1, 0).name === "C1-shop-0" && art.building(2, 1, 1).name === "C1-shop-1" && art.building(2, 2, 37).name === "C2-store-1" && art.building(1, 1, 37).name === "R1-cottage-1" && art.building(3, 1, 200).name === "I1-shed-0");
  check("shops: every kind but the corner shop is its own pair of solids in the registry, tagged shop, with a hi-res twin",
    SHOPS.slice(1).every((s) => SHOP_ART[s.kind].length === 2 && SHOP_ART[s.kind].every((sp) => sp.tags.includes("shop") && art.hires(sp))));

  // The card: a Low C lot at variant 9 is a mirrored bookshop; nobody's until someone works there, then its keepers' by the staff's plurality species.
  const F = createWorld({ seed: "shops" });
  const at = (x, y) => y * F.w + x;
  for (let y = 9; y <= 12; y++) for (let x = 9; x <= 13; x++) { F.terrain[at(x, y)] = TERRAIN.GRASS; F.road[at(x, y)] = ROAD.NONE; }
  apply(F, { kind: "road", tiles: [9, 10, 11, 12, 13].map((x) => at(x, 9)) });
  apply(F, { kind: "zone", zone: ZONE.C, x0: 10, y0: 10, x1: 10, y1: 10, density: 1 });
  apply(F, { kind: "zone", zone: ZONE.R, x0: 12, y0: 10, x1: 12, y1: 10, density: 3 });
  const shopLot = at(10, 10), homeLot = at(12, 10);
  F.tier[shopLot] = 1; F.tier[homeLot] = 1; F.variant[shopLot] = 9;
  computeFields(F); recountRosters(F); census(F);
  const r0 = lotReport(F, shopLot);
  check("shops: the report names the kind by the tile (variant 9 → a bookshop, mirrored) and says nobody keeps it yet",
    r0.shop && r0.shop.name === "bookshop" && r0.shop.keeper === null && r0.shop.title === "a bookshop, nobody's yet" && art.building(2, 1, 9).name === "C1-bookshop-1" && shopOfVariant(9).kind === 4, JSON.stringify(r0.shop));
  const hh = createHousehold(F, "fox", 2);
  placeHousehold(F, hh, homeLot);
  for (const id of hh.members) { const c = F.byId.get(id); c.job = shopLot; F.staff[shopLot]++; }
  census(F);
  const r1 = lotReport(F, shopLot);
  check("shops: once foxes staff it the card reads the Slyfields' bookshop, from the staff's plurality species — derived, never saved",
    r1.shop.keeper === "fox" && r1.shop.title === "the Slyfields' bookshop" && SPECIES_BY_ID.fox.surname === "Slyfield", r1.shop && r1.shop.title);
  check("shops: a tier-2 store and an R lot report no shop", (F.tier[shopLot] = 2, lotReport(F, shopLot).shop === null) && lotReport(F, homeLot).shop === null && shopOf(F, homeLot) === null);
  F.tier[shopLot] = 1;
}
// ---- Part H: meat on hand, free-rail freight, pens (SPEC §9c) ---------------------
{
  const ME = await import("../js/sim/meat.js");
  const JU = await import("../js/sim/justice.js");
  const CI = await import("../js/sim/citizens.js");
  const CE = await import("../js/sim/census.js");
  const FI = await import("../js/sim/fields.js");
  const WO = await import("../js/sim/world.js");
  const HE = await import("../js/sim/events.js");
  const { KIND: H_KIND } = await import("../js/sim/life.js");
  const { createWalkers } = await import("../js/walkers.js");
  const { art: hArt } = await import("../js/art/index.js");
  const { ink: hInk } = await import("../js/art/format.js");
  const flatFreight = (seed = "h-freight", withRail = true) => {
    const w = createWorld({ seed, w: 64, h: 16 });
    w.terrain.fill(WO.TERRAIN.GRASS); w.road.fill(ROAD.NONE); w.rail.fill(0); w.zone.fill(ZONE.NONE); w.tier.fill(0);
    w.civic.fill(CIVIC.NONE); w.wall.fill(0); w.big.fill(0); w.rubble.fill(0); w.burning.fill(0); w.meat.fill(0);
    w.citizens = []; w.households = []; w.byId = new Map(); w.hhById = new Map(); w.nextId = 1; w.nextHouseholdId = 1;
    w.events.noDisasters = true; w.valves = { R: 0, C: 0, I: 0, M: 0 };
    const at = (x, y) => y * w.w + x;
    for (let x = 2; x <= 58; x++) w.road[at(x, 7)] = ROAD.ROAD;
    const home = at(2, 8), hall = at(58, 8);
    w.zone[home] = ZONE.R; w.tier[home] = 1;
    w.zone[hall] = ZONE.M; w.tier[hall] = 2;
    if (withRail) {
      for (let x = 5; x <= 55; x++) w.rail[at(x, 6)] = 1;
      w.rail[at(5, 6)] = 2; w.rail[at(55, 6)] = 2;
    }
    w.roadsDirty = true; w.wallsDirty = true;
    computeFields(w); FI.recountRosters(w); CI.rebuildMaps(w);
    return { w, at, home, hall };
  };

  // One graph, two explicit policies: citizen rail costs 2/9; freight
  // boards, rides any physical length and alights for zero measured distance.
  const R = flatFreight();
  const route = ME.hallReach(R.w, R.home, 8);
  const ridden = route ? Array.from(route.path).filter((p) => p & FI.RIDE).length : 0;
  check("meat route: an arbitrarily long rail ride counts only its eight road/platform steps",
    !!route && route.hall === R.hall && route.walkSteps === 8 && route.physicalSteps > 50 && ridden > 40,
    route ? `walk ${route.walkSteps} · physical ${route.physicalSteps} · ridden ${ridden}` : "no route");
  check("meat route: the same hall is beyond seven walked steps but reachable at Infinity",
    ME.hallReach(R.w, R.home, 7) === null && ME.hallReach(R.w, R.home, Infinity)?.hall === R.hall);
  const commute = FI.commutePath(R.w, "rabbit", FI.doorOf(R.w, R.home), FI.doorOf(R.w, R.hall), 60);
  check("meat route: free freight does not mutate ordinary 2/9-cost commuting",
    !!commute && commute.cost > route.walkSteps * FI.WALK && KNOBS.RAIL_COST === 2 && KNOBS.MEAT_RAIL_COST === 0 && KNOBS.RIDE_SPEED === FI.WALK / KNOBS.RAIL_COST,
    `freight ${route.walkSteps * FI.WALK} · commute ${commute?.cost}`);
  R.w.use.fill(WO.USE.PREY); ME.resetMeatRoutes(R.w);
  check("meat route: neutral freight crosses use-zoned roads without borrowing a citizen diet", ME.hallReach(R.w, R.home, 8)?.walkSteps === 8);
  R.w.use.fill(WO.USE.MIXED);
  R.w.rail[R.at(30, 6)] = 0; ME.resetMeatRoutes(R.w);
  check("meat route: cutting the track removes the under-eight route", ME.hallReach(R.w, R.home, 8) === null);
  R.w.rail[R.at(30, 6)] = 1; R.w.rail[R.at(5, 6)] = 1; R.w.rail[R.at(55, 6)] = 1; ME.resetMeatRoutes(R.w);
  check("meat route: track without both stations gives no free ride", ME.hallReach(R.w, R.home, 8) === null);
  R.w.rail[R.at(5, 6)] = 2; R.w.rail[R.at(55, 6)] = 2;
  R.w.zone[R.at(59, 8)] = ZONE.M; R.w.tier[R.at(59, 8)] = 1; R.w.roadsDirty = true; computeFields(R.w); ME.resetMeatRoutes(R.w);
  check("meat route: equal-cost halls sharing a door tie by stable tile id", ME.hallReach(R.w, R.home, 8)?.hall === R.hall);
  R.w.meat[R.hall] = KNOBS.MEAT_CAP; ME.resetMeatRoutes(R.w);
  check("meat route: a full nearest hall redirects supply to the next reachable hall", ME.hallReach(R.w, R.home, 9, { space: true })?.hall === R.at(59, 8));
  R.w.meat[R.hall] = 0;
  R.w.road[R.at(30, 7)] = ROAD.NONE; R.w.rail[R.at(30, 6)] = 0; ME.resetMeatRoutes(R.w);
  check("meat route: a physically near but disconnected hall is not serviceable", ME.hallReach(R.w, R.home, Infinity) === null);
  const RW = flatFreight("h-road-only", false);
  check("meat route: a road-only trip obeys the same exact walked-step limit",
    ME.hallReach(RW.w, RW.home, 55) === null && ME.hallReach(RW.w, RW.home, 56)?.walkSteps === 56 && ME.hallReach(RW.w, RW.home, Infinity)?.hall === RW.hall);

  // The cosmetic door search must obey the same bare-wall barrier as
  // fields.doorOf. Otherwise a pen figure or the killer's first leg can pop
  // to a road edge that the stored H route does not begin on.
  const WD = createWorld({ seed: "h-wall-door", w: 8, h: 8 });
  WD.terrain.fill(WO.TERRAIN.GRASS); WD.road.fill(ROAD.NONE); WD.zone.fill(ZONE.NONE); WD.tier.fill(0); WD.wall.fill(0); WD.citizens = []; WD.households = []; WD.byId = new Map(); WD.hhById = new Map();
  const wat = (x, y) => y * WD.w + x, wh = wat(3, 3), wk = wat(7, 4);
  WD.zone[wh] = ZONE.M; WD.tier[wh] = 1; WD.zone[wk] = ZONE.R; WD.tier[wk] = 1;
  WD.wall[wat(3, 2)] = 1; WD.road[wat(3, 1)] = ROAD.ROAD;
  for (let x = 5; x <= 7; x++) WD.road[wat(x, 3)] = ROAD.ROAD;
  const penHh = CI.createHousehold(WD, "pig", 1), killerHh = CI.createHousehold(WD, "wolf", 1);
  CI.placeHousehold(WD, penHh, wk); CI.placeHousehold(WD, killerHh, wk);
  const penC = WD.byId.get(penHh.members[0]), killerC = WD.byId.get(killerHh.members[0]);
  penC.pen = true; penC.penSince = 0; penC.heldAt = wh; penC.held = 100;
  const simDoor = FI.doorOf(WD, wh);
  WD.predations = [{ killer: killerC.id, killerHome: wk, victimHome: wh, hall: wh,
    sackPath: Uint16Array.from([simDoor]), homePath: Uint16Array.from([simDoor, wat(6, 3), wat(7, 3)]),
    victim: { id: 99999, species: "rabbit", age: 20, name: "Wall Test" } }];
  WD.meatTrips = []; WD.arrivals = []; WD.departures = []; WD.meetings = [];
  const wallWalkers = createWalkers(WD); wallWalkers.notify();
  const penWalker = wallWalkers.list().find((w) => w.kind === "penned");
  const predWalker = wallWalkers.list().find((w) => w.kind === "predation");
  check("meat walkers: bare walls cannot make penned figures or pre-sack legs disagree with the sim-selected door",
    simDoor === wat(5, 3) && penWalker?.tx === 5.5 && penWalker?.ty === 3.5
      && predWalker?.legs[0].path.at(-1) === (WD.predations[0].sackPath[0] & 0x7fff));

  let cartBody = true, cartExtra = true;
  for (const species of ["rabbit", "mouse", "fox", "beaver", "owl", "bear", "tortoise", "raccoon", "pig", "cow", "wolf", "cat", "hawk", "skunk"])
    for (const age of ["adult", "elder"])
      for (const facing of ["se", "ne", "sw", "nw"])
        for (let frame = 0; frame < 3; frame++)
          for (const look of [{ shade: 0, mark: 0 }, { shade: 0, mark: 1 }, { shade: 1, mark: 0 }, { shade: 1, mark: 1 }]) {
            const plain = hArt.citizen(species, facing, frame, age, { look });
            const cart = hArt.citizen(species, facing, frame, age, { look, carry: "cart" });
            if (cart.w !== 18 || cart.h !== plain.h || cart.anchor[0] !== plain.anchor[0] + 3 || cart.anchor[1] !== plain.anchor[1]) cartBody = false;
            for (let y = 0; y < plain.h; y++) for (let x = 0; x < plain.w; x++) {
              // Tortoise '+' is the post-compose silhouette outline: the
              // cart legitimately occupies some formerly empty outline
              // neighbours. Every authored animal pixel must still match.
              if (plain.rows[y][x] !== "." && !(species === "tortoise" && plain.rows[y][x] === "+") && cart.rows[y][x + 3] !== plain.rows[y][x]) cartBody = false;
            }
            if (hInk(cart.rows) <= hInk(plain.rows) + 12) cartExtra = false;
          }
  check("meat art: every adult/elder look, facing and frame keeps the exact figure and feet inside the wider handcart sprite", cartBody);
  check("meat art: every handcart pose adds a substantial readable cart silhouette", cartExtra);

  // Rail is not a wormhole for LV or any park/centre/plaque distance. Strip
  // the already-specified rail pollution out of two wall-less twins, then
  // call the property computation itself: the arrays must be byte-identical.
  const PR = flatFreight("h-property", true), PG = flatFreight("h-property", false);
  PR.w.civic[PR.at(40, 12)] = CIVIC.PARK; PG.w.civic[PG.at(40, 12)] = CIVIC.PARK;
  for (const x of [PR.w, PG.w]) { x.pol.fill(0); x.dread.fill(0); FI.computeLandValue(x); }
  check("property distance: a long rail shortcut gives no LV, park, Zoo, centre, plaque or smell distance discount",
    Array.from(PR.w.lv).every((n, i) => n === PG.w.lv[i]) && PR.w.lv[PR.home] === PG.w.lv[PG.home]);
  const DR = flatFreight("h-dread", false);
  FI.computeDread(DR.w); const emptyDread = DR.w.dread[DR.hall];
  DR.w.meat[DR.hall] = 8; FI.computeDread(DR.w); const fullDread = DR.w.dread[DR.hall];
  check("meat feedback: an isolated empty hall smells at half strength and stock eight restores exact full strength",
    emptyDread === Math.round(KNOBS.DREAD[2] * 0.5) && fullDread === KNOBS.DREAD[2], `${emptyDread} → ${fullDread}`);

  const old = {
    buy: KNOBS.MEAT_BUY_P, eat: KNOBS.MEAT_EAT, pen: KNOBS.PEN_BUY_P,
    friendP: KNOBS.FRIEND_P, friendN: KNOBS.FRIEND_SAMPLES, funeral: KNOBS.FUNERAL_P,
    zoned: KNOBS.ZONED_OUT_MONTHS, rehomeDreadP: KNOBS.REHOME_DREAD_P, kill: KNOBS.KILL_P,
  };
  try {
    KNOBS.MEAT_BUY_P = 1; KNOBS.MEAT_EAT = 0; KNOBS.PEN_BUY_P = 0;
    const E = flatFreight("h-economy");
    E.w.naturalDeaths = [{ id: 9001, name: "Test Body", species: "rabbit", age: 40, home: E.home }];
    E.w.meatTrips = [];
    const cash0 = E.w.cash, cut0 = E.w.ledger.cut || 0;
    const boughtLines = ME.meatTick(E.w);
    const trip = E.w.meatTrips[0];
    check("meat inflow: a reachable natural death is bought once, paid only through budget.post and routed visibly",
      ME.hallStock(E.w, E.hall) === 1 && E.w.meatStats.total.bought === 1 && E.w.cash === cash0 + KNOBS.MEAT_PRICE
      && (E.w.ledger.cut || 0) === cut0 + KNOBS.MEAT_PRICE && boughtLines.some((x) => x.startsWith("BOUGHT"))
      && trip?.hall === E.hall && trip.path.some((p) => p & FI.RIDE));
    E.w.naturalDeaths = [];
    ME.receiveMeat(E.w, E.hall, "killed", 1);
    ME.receiveMeat(E.w, E.hall, "convicted", 1);
    check("meat inflow: killing and conviction are distinct one-unit sources", ME.hallStock(E.w, E.hall) === 3 && E.w.meatStats.total.killed === 1 && E.w.meatStats.total.convicted === 1);

    const K = flatFreight("h-killing");
    const kh2 = K.at(3, 8); K.w.zone[kh2] = ZONE.R; K.w.tier[kh2] = 1; K.w.roadsDirty = true; computeFields(K.w);
    const hunters = CI.createHousehold(K.w, "wolf", 2), prey = CI.createHousehold(K.w, "rabbit", 1);
    CI.placeHousehold(K.w, hunters, K.home); CI.placeHousehold(K.w, prey, kh2);
    for (const c of K.w.citizens) c.deathAge = 1e9;
    const hunter = K.w.byId.get(hunters.members[0]);
    const nearWeight = JU.killWeight(K.w, hunter);
    K.w.road[K.at(30, 7)] = ROAD.NONE; K.w.rail[K.at(30, 6)] = 0; ME.resetMeatRoutes(K.w);
    const cutWeight = JU.killWeight(K.w, hunter);
    check("meat killing: KILL_MARKET follows the service network, even beyond the smell, and drops when road and rail are cut",
      nearWeight > 0 && Math.abs(nearWeight / cutWeight - KNOBS.KILL_MARKET) < 1e-9, `${nearWeight} / ${cutWeight}`);
    K.w.road[K.at(30, 7)] = ROAD.ROAD; K.w.rail[K.at(30, 6)] = 1; ME.resetMeatRoutes(K.w);
    KNOBS.KILL_P = 1 / JU.killTotal(K.w);
    const killLines = []; JU.killingTick(K.w, census(K.w), killLines);
    const killRecord = K.w.events.log.find((r) => r.id === "killing");
    check("meat killing: a forced distant killing stocks exactly one unit and publishes the selected rail hall-leg for the sack",
      K.w.meatStats.total.killed === 1 && ME.hallStock(K.w, K.hall) === 1 && K.w.predations.length === 1 && K.w.predations[0].hall === K.hall
      && K.w.predations[0].sackPath.some((p) => p & FI.RIDE) && K.w.ledger.cut === KNOBS.MEAT_PRICE
      && killRecord?.links?.includes(K.w.predations[0].killer) && killRecord?.links?.includes(K.w.predations[0].victim.id));
    KNOBS.KILL_P = old.kill;

    const S = flatFreight("h-sentence");
    const soldHh = CI.createHousehold(S.w, "rabbit", 1); CI.placeHousehold(S.w, soldHh, S.home);
    const convict = S.w.byId.get(soldHh.members[0]), soldLines = [];
    convict.thefts = 2; convict.record = 2;
    const soldFile = JU.openFile(S.w, { tile: S.home, culpritId: convict.id, cause: "burglary" });
    JU.arrest(S.w, soldFile, convict, false, soldLines);
    const soldRecord = S.w.events.log.find((r) => r.id === "arrest" && /^SOLD/.test(r.line));
    check("meat sentence: SOLD increments convict count and convicted stock exactly once, with its §100 cut distinct from meatSold",
      !S.w.byId.has(convict.id) && S.w.events.justice.sold === 1 && S.w.meatStats.total.convicted === 1 && ME.hallStock(S.w, S.hall) === 1
      && S.w.ledger.cut === KNOBS.SOLD_PRICE && (S.w.last?.census?.meatSold || 0) === 0 && soldRecord?.links?.includes(convict.id));

    const wolves = CI.createHousehold(E.w, "wolf", 2); for (const id of wolves.members) E.w.byId.get(id).deathAge = 1e9;
    CI.placeHousehold(E.w, wolves, E.home);
    KNOBS.MEAT_EAT = 1;
    const beforeSale = E.w.ledger.cut || 0;
    ME.meatTick(E.w);
    check("meat outflow: assigned carnivores sell min(integer demand, stock) to the grey-hall cut",
      E.w.meatStats.total.eaten === 2 && ME.hallStock(E.w, E.hall) === 1 && (E.w.ledger.cut || 0) - beforeSale === 2 * KNOBS.MEAT_SALE);
    ME.receiveMeat(E.w, E.hall, "bought", 2); E.w.events.licence = true;
    const tax0 = E.w.ledger.tax || 0, cut1 = E.w.ledger.cut || 0;
    ME.meatTick(E.w);
    check("meat outflow: a licensed hall books the C-rate share as tax, never as grey cut",
      (E.w.ledger.tax || 0) - tax0 === Math.round(2 * KNOBS.MEAT_SALE * E.w.rates.C / 100) && (E.w.ledger.cut || 0) === cut1);
    check("meat conservation: mixed sources and meals balance exactly", ME.meatBalance(E.w).ok, JSON.stringify(ME.meatBalance(E.w)));

    const walkers = createWalkers(E.w), hash0 = stateHash(E.w);
    walkers.notify(); walkers.update(0.25, { x0: 0, y0: 0, x1: E.w.w, y1: E.w.h });
    const cart = walkers.list().find((x) => x.kind === "cart");
    const exactBack = cart && cart.legs[1].path.join(",") === trip.path.map((p) => p & 0x7fff).join(",");
    check("meat walkers: the cart consumes the sim-selected RIDE route out and back and never writes sim state",
      !!cart && cart.carry === "cart" && exactBack && cart.legs[1].ride.some(Boolean) && stateHash(E.w) === hash0);

    const C = flatFreight("h-cap");
    ME.receiveMeat(C.w, C.hall, "killed", 100);
    const totalsAtCap = { ...C.w.meatStats.total };
    ME.receiveMeat(C.w, C.hall, "convicted", 1);
    check("meat capacity: a hall keeps at most 40 and refuses excess doorstep supply without counting it",
      ME.hallStock(C.w, C.hall) === KNOBS.MEAT_CAP && totalsAtCap.killed === KNOBS.MEAT_CAP && C.w.meatStats.total.convicted === 0 && C.w.meatStats.total.spoiled === 0);
    ME.receiveMeat(C.w, C.hall, "slaughtered", 2);
    check("meat capacity: an already-grown pen animal becomes named spoilage rather than Uint16 overflow",
      C.w.meat[C.hall] === KNOBS.MEAT_CAP && C.w.meatStats.total.slaughtered === 1 && C.w.meatStats.total.spoiled === 2 && ME.meatBalance(C.w).ok);

    // Pen entry, absence, save/load, exact birthday, family memory and razing.
    KNOBS.MEAT_BUY_P = 0; KNOBS.MEAT_EAT = 0; KNOBS.PEN_BUY_P = 1;
    const P = flatFreight("h-pen");
    const pigs = CI.createHousehold(P.w, "pig", 4); CI.placeHousehold(P.w, pigs, P.home);
    for (const id of pigs.members) P.w.byId.get(id).deathAge = 1e9;
    const cubs = pigs.members.map((id) => P.w.byId.get(id)).filter((c) => CE.ageYears(P.w, c) < KNOBS.ADULT_AGE);
    cubs.forEach((c) => { c.born = 0; }); cubs[0].born = -15 * 12;
    P.w.meatTrips = []; ME.meatTick(P.w);
    const penned = P.w.citizens.find((c) => c.pen);
    const penCensus = census(P.w);
    check("market pen: one oldest cub from a full pig household enters a reachable tier-2 pen and keeps identity",
      !!penned && penned.id === cubs[0].id && penned.home === pigs.home && penned.heldAt === P.hall && penned.held === penned.born + 12 * KNOBS.ADULT_AGE
      && P.w.meatStats.total.penBought === 1 && P.w.meatTrips.some((x) => x.kind === "pen" && x.citizen === penned.id)
      && penCensus.penned === 1 && penCensus.held === 0);
    const PN = flatFreight("h-pen-rules"), rabbitHh = CI.createHousehold(PN.w, "rabbit", 4);
    CI.placeHousehold(PN.w, rabbitHh, PN.home); rabbitHh.members.forEach((id) => { PN.w.byId.get(id).born = 0; });
    ME.meatTick(PN.w);
    const underfull = flatFreight("h-pen-underfull"), cowHh = CI.createHousehold(underfull.w, "cow", 3);
    CI.placeHousehold(underfull.w, cowHh, underfull.home); cowHh.members.forEach((id) => { underfull.w.byId.get(id).born = 0; });
    ME.meatTick(underfull.w);
    check("market pen: only pig/cow cubs from a full household qualify, and tier capacities are exactly 2/4/8",
      !PN.w.citizens.some((c) => c.pen) && !underfull.w.citizens.some((c) => c.pen)
      && (PN.w.tier[PN.hall] = 1, ME.penCapacity(PN.w, PN.hall) === 2)
      && (PN.w.tier[PN.hall] = 2, ME.penCapacity(PN.w, PN.hall) === 4)
      && (PN.w.tier[PN.hall] = 3, ME.penCapacity(PN.w, PN.hall) === 8));
    PN.w.tier[PN.hall] = 1;
    for (const id of rabbitHh.members.slice(0, 3)) {
      const c = PN.w.byId.get(id); c.pen = true; c.penSince = id; c.heldAt = PN.hall; c.held = PN.w.tick + 100;
    }
    ME.penMaturityTick(PN.w);
    check("market pen: losing a storey releases deterministic excess animals alive before the cap can be exceeded",
      PN.w.citizens.filter((c) => c.pen).length === 2 && PN.w.byId.get(rabbitHh.members[2]).heldAt === -1);
    const penHash = stateHash(P.w), PL = load(save(P.w));
    check("market pen: optional pen state survives save/load hash-equal and derived routes are not saved",
      penHash === stateHash(PL) && !Object.hasOwn(toPlain(P.w), "meatTrips") && !Object.hasOwn(toPlain(P.w), "_meatReach"));

    const PD = load(save(PL)), departedCub = PD.byId.get(penned.id), departedFamily = PD.hhById.get(departedCub.household);
    const removedFamily = CI.removeHousehold(PD, departedFamily, "left");
    check("market pen lifecycle: family departure removes only animals actually at home and cannot delete a purchased cub",
      removedFamily === 3 && PD.byId.has(departedCub.id) && departedCub.pen && !departedFamily.gone
      && departedFamily.members.length === 1 && departedFamily.members[0] === departedCub.id,
      `removed ${removedFamily} · members ${departedFamily.members.join(",")} · pen ${departedCub.pen}`);
    PD.tick = departedCub.held;
    ME.penMaturityTick(PD); CI.compact(PD);
    const departureBalance = ME.meatBalance(PD);
    check("market pen lifecycle: a cub preserved through family departure remains accounted until exact maturity",
      !PD.byId.has(departedCub.id) && ME.hallStock(PD, P.hall) === KNOBS.PEN_YIELD && departureBalance.penOk,
      JSON.stringify(departureBalance));

    const PZ = load(save(PL)), zonedCub = PZ.byId.get(penned.id), zonedFamily = PZ.hhById.get(zonedCub.household);
    PZ.use[P.home] = WO.USE.PRED; KNOBS.ZONED_OUT_MONTHS = 1; KNOBS.PEN_BUY_P = 0;
    tick(PZ);
    const zonedDeparture = PZ.departures.at(-1);
    const zonedStayedHome = zonedFamily.home === P.home && zonedCub.home === P.home;
    const zonedLife = zonedCub.life.some((e) => e[1] === H_KIND.ZONED_OUT);
    const zonedRaze = apply(PZ, { kind: "bulldoze", x0: P.hall % PZ.w, y0: (P.hall / PZ.w) | 0, x1: P.hall % PZ.w, y1: (P.hall / PZ.w) | 0 });
    check("market pen relocation: zoning moves/counts only the animals at home, then a razed hall returns the cub to its standing address",
      PZ.last.left === 3 && PZ.last.zonedOut === 3 && zonedDeparture?.n === 3 && zonedStayedHome && !zonedLife
      && zonedRaze.ok && PZ.byId.has(zonedCub.id) && !zonedCub.pen && zonedCub.home === P.home && PZ.zone[P.home] === ZONE.R,
      `left ${PZ.last.left}/${zonedDeparture?.n} · home ${zonedFamily.home}/${zonedCub.home} · zoned life ${zonedLife}`);
    KNOBS.ZONED_OUT_MONTHS = old.zoned;

    const PS = load(save(PL)), smellCub = PS.byId.get(penned.id), smellFamily = PS.hhById.get(smellCub.household), smellTo = P.at(3, 8);
    PS.zone[smellTo] = ZONE.R; PS.tier[smellTo] = 1; PS.dread.fill(0); PS.dread[P.home] = 100;
    KNOBS.REHOME_DREAD_P = 1;
    const smellOut = CI.citizensTick(PS, census(PS), {});
    const movedFamily = PS.households.find((h) => !h.gone && h.home === smellTo);
    check("market pen relocation: a forced hall-smell move relocates the family at home but cannot move or remember an absent cub",
      smellOut.rehomed === 1 && movedFamily?.members.length === 3 && smellFamily.members.length === 1
      && smellFamily.members[0] === smellCub.id && smellCub.home === P.home
      && !smellCub.life.some((e) => e[1] === H_KIND.MOVED),
      `rehomed ${smellOut.rehomed} · moved ${movedFamily?.members.length} · pen home ${smellCub.home}`);
    KNOBS.REHOME_DREAD_P = old.rehomeDreadP;

    const PF = load(save(PL)), funeralPen = PF.byId.get(penned.id), funeralFamily = PF.hhById.get(funeralPen.household);
    const funeralPeers = funeralFamily.members.filter((id) => id !== funeralPen.id).slice(0, 2).map((id) => PF.byId.get(id));
    [funeralPen, ...funeralPeers].forEach((c) => { c.friends.length = 0; });
    KNOBS.FUNERAL_P = 1;
    CI.holdFuneral(PF, [funeralPen.id, ...funeralPeers.map((c) => c.id)], null);
    check("market pen absence: a funeral may join present mourners but never gives a penned mourner a new friendship",
      funeralPen.friends.length === 0 && funeralPeers[0].friends.includes(funeralPeers[1].id));
    KNOBS.FUNERAL_P = old.funeral;

    const penWalkers = createWalkers(P.w), penWalkHash = stateHash(P.w); penWalkers.notify();
    const penList = penWalkers.list(), penCart = penList.find((x) => x.kind === "cart" && x.companion), penFigure = penList.find((x) => x.kind === "penned" && x.citizen === penned.id);
    check("market pen walkers: the cub stands at the hall and walks beside its exact-route collection cart without changing the hash",
      !!penCart && penCart.legs[1].ride.some(Boolean) && !!penFigure && stateHash(P.w) === penWalkHash);

    const oldMood = penned.mood, oldFriends = penned.friends.slice();
    KNOBS.FRIEND_P = 1; KNOBS.FRIEND_SAMPLES = 1000;
    tick(P.w);
    const heldCub = P.w.byId.get(penned.id);
    const file = JU.openFile(P.w, { tile: P.home, culpritId: heldCub.id, cause: "burglary" }); file.opened = P.w.tick - 1;
    P.w.civic[P.at(10, 10)] = CIVIC.POLICE; computeFields(P.w);
    JU.filesTick(P.w, census(P.w), []);
    check("market pen: a held cub is absent from mood, friendship, investigation and killing",
      WO.absent(P.w, heldCub) && heldCub.mood === oldMood && heldCub.friends.join(",") === oldFriends.join(",") && !file.closed && JU.killWeight(P.w, heldCub) === 0);

    const PM = load(save(PL));
    const mc = PM.byId.get(penned.id), family = PM.hhById.get(mc.household).members.filter((id) => id !== mc.id);
    PM.tick = mc.held;
    const penLines = ME.penMaturityTick(PM);
    const removedAtMaturity = !PM.byId.has(mc.id);
    const tickMeatCensus = ME.meatCensus(PM);
    CI.compact(PM); // tick's normal removal boundary before a fresh direct census
    const maturityCensus = census(PM);
    check("market pen: the exact sixteenth birthday yields two units, removes the animal, and prints its named market line",
      removedAtMaturity && ME.hallStock(PM, P.hall) === 2 && PM.meatStats.total.slaughtered === 1 && penLines.length === 1 && penLines[0].includes(mc.name),
      `alive ${!removedAtMaturity} · stock ${ME.hallStock(PM, P.hall)} · slaughtered ${PM.meatStats.total.slaughtered} · lines ${penLines.length} · name ${penLines[0] || "—"}`);
    check("market pen: direct Census and the tick refresh both report slaughtered meat in yielded units, not animals",
      maturityCensus.meatSlaughtered === KNOBS.PEN_YIELD && tickMeatCensus.meatSlaughtered === KNOBS.PEN_YIELD);
    check("market pen: parents remember LOST_CHILD and receive no grief",
      family.every((id) => PM.byId.get(id)?.life.some((e) => e[1] === 16 && e[2] === mc.id) && !(PM.byId.get(id).grief > PM.tick)));

    const PB = load(save(PL)), freed = PB.byId.get(penned.id);
    const raze = apply(PB, { kind: "bulldoze", x0: P.hall % PB.w, y0: (P.hall / PB.w) | 0, x1: P.hall % PB.w, y1: (P.hall / PB.w) | 0 });
    check("market pen: bulldozing the hall frees the cub home alive and makes the destructive op non-undoable",
      raze.ok && !raze.undoable && PB.byId.has(freed.id) && !freed.pen && freed.heldAt === -1 && freed.home === PB.hhById.get(freed.household).home
      && PB.meatStats.total.penReleased === 1 && ME.meatBalance(PB).penOk);

    const PC = load(save(PL));
    for (let k = 0; k < 24; k++) { tick(PL); tick(PC); }
    check("market pen: a 24-month continuation through maturity is save/load deterministic", stateHash(PL) === stateHash(PC), `${stateHash(PL)} vs ${stateHash(PC)}`);

    const FD = flatFreight("h-fractional-demand"), fdWolves = CI.createHousehold(FD.w, "wolf", 1);
    CI.placeHousehold(FD.w, fdWolves, FD.home); FD.w.meat[FD.hall] = 20;
    KNOBS.PEN_BUY_P = 0; KNOBS.MEAT_BUY_P = 0; KNOBS.MEAT_EAT = 0.05;
    ME.meatTick(FD.w);
    const FDL = load(save(FD.w));
    for (let k = 0; k < 24; k++) { FD.w.tick++; FDL.tick++; ME.meatTick(FD.w); ME.meatTick(FDL); }
    check("meat save: a fractional demand remainder survives save/load and continues hash-identically",
      FD.w.meatStats.demand[String(FD.hall)] > 0 && stateHash(FD.w) === stateHash(FDL), `${stateHash(FD.w)} vs ${stateHash(FDL)}`);

    // A block keeps one aggregate inventory through merge/split and gives it
    // an explicit fate when the last hall disappears.
    const B = flatFreight("h-block", false), tiles = [B.at(57, 8), B.at(58, 8), B.at(57, 9), B.at(58, 9)], ba = tiles[0];
    B.w.zone[B.hall] = ZONE.NONE; B.w.tier[B.hall] = 0;
    for (const i of tiles) { B.w.zone[i] = ZONE.M; B.w.tier[i] = 3; }
    B.w.meat[tiles[0]] = 2; B.w.meat[tiles[1]] = 3; B.w.meat[tiles[2]] = 4; B.w.meat[tiles[3]] = 1;
    ME.meatStats(B.w); CI.rebuildMaps(B.w);
    const BL = await import("../js/sim/blocks.js");
    BL.mergeLots(B.w, { side: 2, anchor: ba, tiles }); ME.meatTick(B.w);
    const merged = ME.hallStock(B.w, ba);
    BL.splitLot(B.w, ba); const split = ME.hallStock(B.w, ba);
    const razed = apply(B.w, { kind: "bulldoze", x0: ba % B.w.w, y0: (ba / B.w.w) | 0, x1: ba % B.w.w, y1: (ba / B.w.w) | 0 });
    check("meat blocks: merge and split conserve aggregate stock; razing names all ten units as spoilage with no ghost",
      merged === 10 && split === 10 && razed.ok && ME.hallStock(B.w, ba) === 0 && B.w.meatStats.total.spoiled === 10 && ME.meatBalance(B.w).ok);

    const BF = flatFreight("h-fire", false); ME.receiveMeat(BF.w, BF.hall, "bought", 7); BF.w.burning[BF.hall] = 1;
    ME.meatTick(BF.w);
    check("meat lifecycle: fire/decay invalidation cannot leave ghost stock", BF.w.meat[BF.hall] === 0 && BF.w.meatStats.total.spoiled === 7 && ME.meatBalance(BF.w).ok);

    const D = flatFreight("h-dry"); KNOBS.MEAT_EAT = 0;
    const dry1 = ME.meatTick(D.w), dry2 = ME.meatTick(D.w);
    ME.receiveMeat(D.w, D.hall, "bought", 1);
    const oneWolf = CI.createHousehold(D.w, "wolf", 1); CI.placeHousehold(D.w, oneWolf, D.home); KNOBS.MEAT_EAT = 1;
    const dry3 = ME.meatTick(D.w);
    D.w.tick = 12; const annual1 = ME.beginMeatMonth(D.w), annual2 = ME.beginMeatMonth(D.w);
    check("meat news: EMPTY HOOKS appears once per dry spell, resets on restock, and THE MARKET appears once per year",
      dry1.filter((x) => x.startsWith("EMPTY HOOKS")).length === 1 && !dry2.some((x) => x.startsWith("EMPTY HOOKS"))
      && dry3.filter((x) => x.startsWith("EMPTY HOOKS")).length === 1 && annual1?.startsWith("THE MARKET") && annual2 === null
      && D.w.events.log.filter((x) => x.id === "market" && x.t === 12).length === 1
      && HE.TICKER_BAD.test(dry1[0]) && HE.TICKER_FLASH.test(dry1[0]) && !HE.TICKER_FLASH.test(annual1));
  } finally {
    KNOBS.MEAT_BUY_P = old.buy; KNOBS.MEAT_EAT = old.eat; KNOBS.PEN_BUY_P = old.pen;
    KNOBS.FRIEND_P = old.friendP; KNOBS.FRIEND_SAMPLES = old.friendN; KNOBS.FUNERAL_P = old.funeral;
    KNOBS.ZONED_OUT_MONTHS = old.zoned; KNOBS.REHOME_DREAD_P = old.rehomeDreadP; KNOBS.KILL_P = old.kill;
  }
}

// ---- Part U': the PANEL, actually run (js/ui.js; tools/dom-shim.mjs) --------
//
// This section exists because of a freeze the owner hit on 2026-09-03: hover a
// lot you have just zoned and the card threw. `TIER_NAME` has rows 1, 2, 3 —
// there is no row 0 — and the name string was built EAGERLY beside the ternary
// that only uses it when the tier is non-zero, so `TIER_NAME[0][0]` was read on
// every empty lot. The throw landed inside main.js's rAF frame, one line above
// `requestAnimationFrame(frame)`, so the loop never rescheduled: no ticks, no
// drawing, no input, nothing in the window to say why. The line had been safe
// until the blocks commit hoisted it out of the ternary into a `const`.
//
// Nothing in the suite could see it, because NOTHING IN THE SUITE HAD EVER RUN
// `js/ui.js`. Two greps read it as text; the panel — the game's largest text
// surface, the card, the tabs, the census, the rules — was never executed. So:
// a DOM shim thin enough to be honest, the REAL createUI, and a sweep over
// every distinct tile state a thirty-year city holds, hovered and pinned.
{
  const { installDom, textOf, stubApp } = await import("./dom-shim.mjs");
  installDom();
  const { createUI } = await import("../js/ui.js");
  const { TERRAIN, CIVIC: CIV } = await import("../js/sim/world.js");

  // The scripted city A already has thirty years of states in it; add by hand
  // the ones a mayor never makes, so the sweep meets them too.
  const U = load(A.saved);
  computeFields(U);
  const uat = (x, y) => y * U.w + x;
  const spare = [];
  for (let y = 2; y < U.h - 2 && spare.length < 12; y++) for (let x = 2; x < U.w - 2; x++) {
    const i = uat(x, y);
    if (U.terrain[i] !== 0 || U.road[i] || U.zone[i] || U.civic[i] || U.wall[i] || U.rail[i] || U.tier[i]) continue;
    spare.push(i);
    if (spare.length >= 12) break;
  }
  // zoned but EMPTY, every zone at both densities — the owner's case
  const empties = [];
  for (const [k, z] of [["R", ZONE.R], ["C", ZONE.C], ["I", ZONE.I], ["M", ZONE.M]]) {
    for (const density of [1, 3]) {
      const i = spare.pop();
      if (i === undefined) continue;
      U.zone[i] = z; U.maxTier[i] = density; U.tier[i] = 0;
      empties.push({ i, k, density });
    }
  }
  // and the states a card can meet that a calm town may not have today
  if (spare.length) { const i = spare.pop(); U.zone[i] = ZONE.R; U.tier[i] = 1; U.rubble[i] = 4; }
  if (spare.length) { const i = spare.pop(); U.zone[i] = ZONE.C; U.tier[i] = 2; U.burning[i] = 2; }
  if (spare.length) { const i = spare.pop(); U.zone[i] = ZONE.I; U.tier[i] = 1; U.flooded[i] = 1; }

  const panelApp = stubApp(U);
  const ui = createUI(panelApp);
  panelApp.input.setTool = (id) => { panelApp.input.state.tool = id; ui.setTool(id, 3); };
  panelApp.input.setUse = (mask) => { panelApp.input.state.use = mask; panelApp.input.state.tool = "use"; ui.setTool("use", 3); };
  const pickerHash = stateHash(U);
  const useButton = document.querySelector("#btnUse");
  useButton.dispatch("click");
  const picker = document.getElementById("usePicker");
  const boxes = picker.querySelectorAll("input");
  const predBox = boxes.find((b) => Number(b.value) === USE.PRED);
  const bearBox = boxes.find((b) => Number(b.value) === USE.BEAR);
  predBox.checked = true;
  bearBox.checked = true;
  bearBox.dispatch("change");
  const combinedMask = USE.PRED | USE.BEAR;
  const combinedShown = panelApp.input.state.use === combinedMask
    && predBox.checked && bearBox.checked && !picker.hidden
    && /2 checked/.test(textOf(useButton)) && useButton.getAttribute("aria-expanded") === "true";
  const pickerButtons = picker.querySelectorAll("button");
  pickerButtons.find((b) => /done/i.test(b.textContent)).dispatch("click");
  const doneClosed = picker.hidden && useButton.getAttribute("aria-expanded") === "false";
  useButton.dispatch("click");
  pickerButtons.find((b) => /mixed/i.test(b.textContent)).dispatch("click");
  const mixedCleared = boxes.every((b) => !b.checked);
  check("panel: U opens a real sixteen-checkbox list; choices combine by OR, Done closes it, and no checks restores mixed without touching the city",
    boxes.length === 16 && new Set(boxes.map((b) => b.getAttribute("aria-label"))).size === 16
      && combinedShown && doneClosed && panelApp.input.state.use === USE.MIXED && mixedCleared
      && !picker.hidden && stateHash(U) === pickerHash,
    `${boxes.length} boxes · combined ${combinedShown} · done ${doneClosed} · mixed ${mixedCleared} · final ${panelApp.input.state.use} · hash ${pickerHash}/${stateHash(U)}`);
  const useCardTile = empties[0].i;
  U.use[useCardTile] = combinedMask;
  ui.updateHover({ tile: useCardTile, pinned: true });
  const useCard = textOf(document.getElementById("card"));
  check("panel: a combined tile card names every checked use and the exact union it admits",
    /use: predator \+ bear/.test(useCard)
      && /admits fox, owl, bear, wolf, cat, hawk/.test(useCard)
      && !/rabbit/.test((useCard.match(/use:.*$/) || [""])[0]),
    useCard);
  const stateKey = (i) => [U.zone[i], U.tier[i], U.big[i], U.civic[i], U.road[i], U.rail[i], U.wall[i], U.terrain[i], U.rubble[i] > 0 ? 1 : 0, U.burning[i] > 0 ? 1 : 0, U.flooded[i] > 0 ? 1 : 0, U.theme[i] > 0 ? 1 : 0, U.use[i], U.maxTier[i]].join("/");
  const seen = new Map();
  const throwsAt = [];
  let blank = 0;
  for (let i = 0; i < U.w * U.h; i++) {
    const k = stateKey(i);
    if (seen.has(k)) continue;
    seen.set(k, i);
    for (const pinned of [false, true]) {
      try {
        ui.updateHover({ tile: i, pinned });
        if (!textOf(document.getElementById("card")).trim()) blank++;
      } catch (e) {
        throwsAt.push(`${i % U.w},${(i / U.w) | 0} [${k}] ${e.message} @ ${String(e.stack).split("\n")[1].trim()}`);
      }
    }
  }
  check("panel: the REAL card is built for every distinct tile state a thirty-year city holds, hovered and pinned, and none of them throws",
    seen.size >= 30 && throwsAt.length === 0 && blank === 0,
    `${seen.size} states · ${throwsAt.length} threw${throwsAt.length ? ": " + throwsAt[0] : ""} · ${blank} blank`);

  // The owner's exact case, named, so a regression says which lot it was.
  const emptyBad = [];
  for (const { i, k, density } of empties) {
    try {
      ui.updateHover({ tile: i, pinned: false });
      const t = textOf(document.getElementById("card"));
      if (!/zoned, empty/.test(t)) emptyBad.push(`${k}${density === 1 ? " Low" : " High"} → "${t.slice(0, 60)}"`);
    } catch (e) { emptyBad.push(`${k}${density === 1 ? " Low" : " High"} THREW ${e.message}`); }
  }
  check("panel: a lot that is zoned and still EMPTY reads 'zoned, empty' in all four zones at both densities — the tier-name table has no row 0, and the card must not reach for one",
    empties.length === 8 && emptyBad.length === 0, `${empties.length} lots · ${emptyBad.join(" · ")}`);

  // A built lot of every zone and tier still names itself, so the fix did not
  // simply stop printing the name.
  const named = [];
  const nameBad = [];
  for (const [k, z] of [["R", ZONE.R], ["C", ZONE.C], ["I", ZONE.I], ["M", ZONE.M]]) {
    for (let t = 1; t <= 3; t++) {
      let found = -1;
      for (let i = 0; i < U.w * U.h; i++) if (U.zone[i] === z && U.tier[i] === t && !U.big[i] && !U.rubble[i] && !U.burning[i]) { found = i; break; }
      if (found < 0) continue;
      named.push(`${k}${t}`);
      try {
        ui.updateHover({ tile: found, pinned: false });
        const txt = textOf(document.getElementById("card"));
        if (!new RegExp(`tier ${t}\\b`).test(txt) && !/3×3|2×2/.test(txt)) nameBad.push(`${k}${t} → "${txt.slice(0, 60)}"`);
      } catch (e) { nameBad.push(`${k}${t} THREW ${e.message}`); }
    }
  }
  check("panel: a BUILT lot still names its tier — the lazy name is still a name",
    named.length >= 6 && nameBad.length === 0, `${named.join(" ")} · ${nameBad.join(" · ")}`);

  // ---- THE STATION CARD, IN ITS OWN WORDS ----------------------------------
  //
  // The card is the only place the forecourt is described to a player, and it
  // had never been READ by anything: it printed the site's DISTANCE where the
  // forecourt is distance MINUS ONE (at d = 1 the door is next door and
  // nothing is crossed), and an unserved platform said the refusal twice -
  // once in the access line and again in the station line. Both are words, so
  // both are checked as words, on a world built for it.
  {
    const V = createWorld({ seed: "station-card" });
    const v = (x, y) => y * V.w + x;
    for (let y = 2; y <= 20; y++) for (let x = 2; x <= 40; x++) {
      const i = v(x, y);
      V.terrain[i] = TERRAIN.GRASS; V.road[i] = ROAD.NONE; V.zone[i] = ZONE.NONE;
      V.tier[i] = 0; V.wall[i] = 0; V.rail[i] = 0; V.civic[i] = 0; V.big[i] = 0; V.use[i] = 0;
    }
    V.events.noDisasters = true;
    const vroad = [];
    for (let x = 4; x <= 36; x++) vroad.push(v(x, 6));
    for (const x of [19, 21]) for (const y of [7, 8]) vroad.push(v(x, y)); // spurs, so ONE platform has two doors
    apply(V, { kind: "road", tiles: vroad });
    for (let x = 6; x <= 12; x++) V.terrain[v(x, 8)] = TERRAIN.WATER;      // and one has none
    const vline = [];
    for (let x = 6; x <= 34; x++) vline.push(v(x, 9));
    apply(V, { kind: "rail", tiles: vline });
    apply(V, { kind: "station", tx: 8, ty: 9 });   // behind the river: unserved
    apply(V, { kind: "station", tx: 20, ty: 9 });  // two doors, one tile of forecourt
    apply(V, { kind: "station", tx: 30, ty: 9 });  // one door, two tiles of forecourt
    apply(V, { kind: "road", tiles: [v(30, 7)] }); // ...brought to d = 2 by a single tile
    // A LOT WITH A ROAD ON TWO SIDES, so the card has a list to get wrong.
    apply(V, { kind: "road", tiles: [v(27, 7)] });
    apply(V, { kind: "zone", zone: ZONE.R, x0: 26, y0: 7, x1: 26, y1: 7, density: 3 });
    V.tier[v(26, 7)] = 2;
    // AND A PLATFORM WITH A ROAD TWO TILES AWAY THAT NOTHING CAN WALK TO:
    // a river right across the map, so there is no way round at any
    // distance. The raw field still reads 2 - `computeRoadDist` goes
    // through water, because a lot on the far bank is served by the bridge
    // it will get - and the card used to print "no road within 8 tiles in
    // any direction" one line above "road 2", in the same card.
    const vroad2 = [];
    for (let x = 14; x <= 36; x++) vroad2.push(v(x, 12)); // starts east of the river platform, so nothing above changes
    apply(V, { kind: "road", tiles: vroad2 });
    for (let x = 2; x <= 40; x++) V.terrain[v(x, 13)] = TERRAIN.WATER;
    const vline2 = [];
    for (let x = 16; x <= 32; x++) vline2.push(v(x, 14));
    apply(V, { kind: "rail", tiles: vline2 });
    apply(V, { kind: "station", tx: 24, ty: 14 });
    computeFields(V);
    const vui = createUI(stubApp(V));
    const cardAt = (i) => { vui.updateHover({ tile: i, pinned: true }); return textOf(document.getElementById("card")); };
    const FI2 = await import("../js/sim/fields.js");
    const far = cardAt(v(30, 9));
    const two = cardAt(v(20, 9));
    const none = cardAt(v(8, 9));
    const d30 = FI2.siteRoadDist(V, v(30, 9));
    const d20 = FI2.siteRoadDist(V, v(20, 9));
    // The number the card prints is the number the SIM lays into the path.
    const chainOf = (i) => (V._stationDoors && V._stationDoors[i] ? V._stationDoors[i][0][1].length : -1);
    check("panel: the station card counts the forecourt the sim actually walks — a platform two tiles from its door says ONE tile of forecourt, not two, and the link chain the commute carries has exactly that many tiles in it",
      d30 === 2 && chainOf(v(30, 9)) === 1 && /crossing 1 tile of forecourt on foot/.test(far) && !/crossing 2 tiles/.test(far)
        && d20 === 2 && /riders board from 2 sides/.test(two) && /crossing 1 tile of forecourt on foot/.test(two),
      `d ${d30}, chain ${chainOf(v(30, 9))} → "${(far.match(/crossing [^;]*/) || ["(nothing)"])[0]}" · two-door: "${(two.match(/riders board from [^;]*/) || ["(nothing)"])[0]}"`);
    check("panel: and an unserved platform refuses ONCE — the access line gives the distance and the direction, the station line gives the consequence, and neither repeats the other",
      /road access: none/.test(none) && (none.match(/no road within|nearest road is/g) || []).length === 1
        && /a station nobody can board/.test(none) && !/a station with no road within/.test(none),
      `"${(none.match(/road access:[^·]*/) || ["(nothing)"])[0].trim()}" + "${(none.match(/a station[^;]*/) || ["(nothing)"])[0].trim()}"`);
    const stranded = cardAt(v(24, 14));
    check("panel: and when a road is RIGHT THERE and nothing can walk to it, the card says so — a platform two tiles from a road across a river it cannot cross used to print \"no road within 8 tiles in any direction\" one line above \"road 2\", in the same card",
      V.roadDist[v(24, 14)] === 2 && !FI2.served(V, v(24, 14)) && FI2.doorsOf(V, v(24, 14)).length === 0
        && /a road is 2 tiles away, but nothing can walk to it/.test(stranded)
        && !/no road within/.test(stranded) && !/nearest road is/.test(stranded)
        && /road 2/.test(stranded),
      `raw ${V.roadDist[v(24, 14)]} · "${(stranded.match(/road access:[^·]*/) || ["(nothing)"])[0].trim()}"`);
    // AND THE THIRD REFUSAL, with its number. A lot far from everything gets
    // the horizon line, and the number in it is `nearReach()` - the distance
    // the card actually searched - not the search's own limit one past it. The
    // off-by-one there was untested and a mutant lived on it.
    apply(V, { kind: "zone", zone: ZONE.R, x0: 6, y0: 20, x1: 6, y1: 20, density: 3 });
    computeFields(V);
    const nowhere = cardAt(v(6, 20));
    check("panel: and a lot with nothing anywhere near it gets the third refusal, with the number the card really searched — no road within nearReach() tiles that anything could walk to, and nearReach() is what the sentence says",
      FI2.nearestRoad(V, v(6, 20)).doors.length === 0
        && new RegExp(`no road within ${FI2.nearReach()} tiles that anything could walk to`).test(nowhere)
        && !/nearest road is/.test(nowhere) && !/a road is \d+ tiles? away/.test(nowhere),
      `nearReach ${FI2.nearReach()} · "${(nowhere.match(/road access:[^·]*/) || ["(nothing)"])[0].trim()}"`);
    const twoSided = cardAt(v(26, 7));
    check("panel: and a lot entered from two sides SAYS both, IN ORDER — the card lists every door and lists them the way the rule gives them, because \"all sides are access points\" is a promise to the player and not only to the pathfinder",
      FI2.doorsOf(V, v(26, 7)).length === 2
        && /2 doors, every side counts:/.test(twoSided)
        && /\(26,6\) \(27,7\)/.test(twoSided),
      `${FI2.doorsOf(V, v(26, 7)).length} doors · "${(twoSided.match(/road access:[^·]*/) || ["(nothing)"])[0].trim()}"`);
  }

  // And the frame loop must survive whatever the panel does. main.js is the
  // only place that decides the game keeps running; read it, because a check
  // cannot drive rAF here.
  const mainSrc = readFileSync(path.join(ROOT, "js", "main.js"), "utf8");
  const guarded = /function frame\s*\([^)]*\)\s*\{\s*try\s*\{/.test(mainSrc) && /catch\s*\([^)]*\)\s*\{[\s\S]{0,400}?\}\s*requestAnimationFrame\(frame\)/.test(mainSrc);
  check("panel: ONE BAD FRAME DOES NOT END THE GAME — main.js's frame body is guarded and reschedules from the catch, so a throw in the panel is a glitch and never a freeze",
    guarded, guarded ? "" : "frame() must wrap its body in try/catch and call requestAnimationFrame(frame) after it");
}


// ---- Part D: the walker layer never writes the sim (SPEC §14) ---------------------
const walkersPath = path.join(ROOT, "js", "walkers.js");
if (existsSync(walkersPath)) {
  const { createWalkers } = await import("../js/walkers.js");
  const { art } = await import("../js/art/index.js");
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
  let rec = null, pred = null, sawFall = false, sawTied = false, sawCarry = false, gone = false, stoodAtDoor = false, sawIdle = false, sawPreyLook = false;
  // The FIRST predation walker seen, and the month's records it must have come
  // from. `pred` below is the last one seen, which in a town where one killer
  // kills twice is a different animal's sack: the pairing has to be captured,
  // not inferred at the end.
  let firstPred = null;
  let firstRecs = null;
  for (let t = 0; t < 60; t++) {
    const force = t >= 30 && !rec;
    if (force) KNOBS.KILL_P = 1 / Math.max(1e-9, killTotalD(w1));
    tick(w1);
    tick(w2);
    if (force) KNOBS.KILL_P = savePD;
    if (!rec && w2.predations && w2.predations.length) { rec = w2.predations[0]; firstRecs = w2.predations.slice(); }
    walkers.notify();
    for (let k = 0; k < 20; k++) {
      walkers.update(0.1, viewport);
      const p = walkers.list().find((x) => x.kind === "predation");
      if (p) {
        pred = p;
        if (!firstPred) firstPred = { citizen: p.citizen, preyName: p.preyName };
        if (p.frame === 3 && p.idle > 1) sawIdle = true;
        if (p.prey && rec && JSON.stringify(p.prey.look) === JSON.stringify(art.look(rec.victim.id))) sawPreyLook = true;
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
  const list60 = walkers.list();
  check("walkers carry real citizen ids", list60.every((x) => x.citizen == null || w2.byId.has(x.citizen) || x.kind !== "commuter"), `${list60.length} walkers`);
  check("looks: every walker carries the pure look of its identity and the removed prey keeps theirs",
    list60.every((x) => JSON.stringify(x.look) === JSON.stringify(art.look(x.id))) && sawPreyLook);
  // Continue to year 30 with the visual side actively selecting and resolving
  // Inspect needs every month. The twin never constructs a walker layer.
  for (let t = 60; t < 30 * 12; t++) {
    tick(w1);
    tick(w2);
    walkers.notify();
    walkers.setCursor([sx + (t % 3) - 1, sy + ((t / 3) % 3 | 0) - 1]);
    walkers.update(0.05, viewport);
    walkers.list();
    for (let i = 0; i < w2.tier.length; i++) if (w2.tier[i] && !isPart(w2, i)) {
      art.building(w2.zone[i], w2.tier[i], w2.variant[i], sideOf(w2, i), w2.theme[i], { lit: lightLevel((w2.zone[i] === ZONE.R ? w2.occupants[i] : w2.staff[i]) / (capacityOf(w2, i) || 1)), majority: w2.majority[i], seed: i });
    }
  }
  KNOBS.KILL_P = savePD;
  const paired = firstPred && firstRecs ? firstRecs.find((r) => r.killer === firstPred.citizen) : null;
  check("a forced killing publishes a record and the walker layer takes it: the walker is a killer of that month, carrying the neighbour that record names",
    !!rec && !!firstPred && !!paired && firstPred.preyName === paired.victim.name,
    rec ? (firstPred ? `walker ${firstPred.citizen} carrying "${firstPred.preyName}" · ${firstRecs.length} record(s), matched ${paired ? `"${paired.victim.name}"` : "none"}` : "no predation walker") : "no killing landed in 30 forced months");
  check("the sack falls, is tied at the door, goes home over the shoulder, and the walker finishes", sawFall && sawTied && stoodAtDoor && sawCarry && gone, `fall ${sawFall} tied ${sawTied} door ${stoodAtDoor} carry ${sawCarry} gone ${gone}`);
  check("walkers standing longer than one second select the species idle frame", sawIdle);
  check("walkers never write the sim: 30 years with Inspect needs and building character on and off hash-equal", stateHash(w1) === stateHash(w2), `${stateHash(w1)} vs ${stateHash(w2)}`);
  const list = walkers.list();
  console.log(`walkers: ${list.length} active after 360 ticks`);
} else {
  console.log("walkers: js/walkers.js not present yet — Part D skipped");
}

// ---- Part E: building character ----------------------------------------------
{ const { checkBuildingCharacter } = await import("./check-building-character.mjs"); checkBuildingCharacter(check); }

{ const { checkCivicCampuses } = await import("./check-civic-campuses.mjs"); checkCivicCampuses(check); }

// ---- verdict ----------------------------------------------------------------------
{
  const { art } = await import("../js/art/index.js");
  const kinds = ["fire", "police", "centre", "largePark", "zoo"];
  check("large civics: explicit 3×3 selection and its hi-res twin occupy nine tiles",
    kinds.every(kind => [art.civic(kind, 3), art.hires(art.civic(kind, 3))]
      .every(sprite => sprite && sprite.footprint[0] === 3 && sprite.footprint[1] === 3)));
  check("large civics: legacy callers keep their existing footprint until placement integration",
    kinds.every(kind => art.civic(kind).footprint.every(side => side === (kind === "largePark" ? 2 : kind === "zoo" ? 3 : 1))) &&
    art.civic("park", 3) === art.civic("park"));
}

{ const { checkCamping } = await import("./check-camping.mjs"); checkCamping(check); }

{ const { checkIntegration } = await import("./check-integration.mjs"); checkIntegration(check); }
{ const { checkIntegrationTools } = await import("./check-integration-tools.mjs"); checkIntegrationTools(check); }
{ const { checkPeopleStretch } = await import("./check-people-stretch.mjs"); checkPeopleStretch(check); }
if (existsSync(path.join(ROOT,"docs/fixtures/control-city.json"))) {
  try { const { verifyControlCity } = await import("./control-city.mjs"); verifyControlCity(path.join(ROOT,"docs/fixtures/control-city.json")); check("integration: owner control city twelve-month baseline",true); }
  catch(e) { check("integration: owner control city twelve-month baseline",false,e.message); }
} else console.log("DEFERRED: owner control-city.json has not arrived; no owner-city regression claimed.");
{ const {checkRailBridges} = await import("./check-rail-bridges.mjs"); checkRailBridges(check); }
{ const {checkCameraIntegration} = await import("./check-camera-integration.mjs"); checkCameraIntegration(check); }
console.log(`${checks} checks, ${failures.length} failures`);
for (const f of failures) console.log(`  FAIL ${f}`);
process.exit(failures.length ? 1 : 0);
