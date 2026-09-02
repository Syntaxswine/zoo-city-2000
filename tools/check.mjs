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
//   checked as: every lot that GREW this run had access), tick cost.
// Part B — the code: budget.post is the only cash mutator; every import is
//   relative (Pages serves under /zoo-city-2000/); no Math.random under js/.
// Part C — the art (when js/art/index.js exists): every pixel a palette key,
//   every anchor inside its sprite, 16/16 road masks, no solid pixel outside
//   its footprint prism, every stamped part inside its grid, the painter key
//   (including the 2×2 band beside the zoo).

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWorld, ZONE, ROAD, capacityOf, jobsOf } from "../js/sim/world.js";
import { tick } from "../js/sim/tick.js";
import { apply, replay } from "../js/sim/ops.js";
import { save, load, stateHash, toPlain } from "../js/sim/save.js";
import { KNOBS } from "../js/sim/rules.js";
import { doorOf, hasAccess } from "../js/sim/fields.js";

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
  apply(world, { kind: "zone", zone: ZONE.I, x0: sx + 1, y0: sy, x1: sx + 3, y1: sy + 3, density: 3 });
  const grewWithAccess = { ok: true };
  let saved = null;
  for (let t = 0; t < years * 12; t++) {
    if (t === 36) apply(world, { kind: "park", tx: sx - 5, ty: sy - 5 });
    if (t === 60) apply(world, { kind: "rate", zone: "R", value: 10 });
    if (t === 84) apply(world, { kind: "rate", zone: "R", value: 7 });
    if (t === 100) apply(world, { kind: "tree", x0: sx + 5, y0: sy + 5, x1: sx + 7, y1: sy + 7 });
    if (t === 120) apply(world, { kind: "bulldoze", x0: sx + 1, y0: sy + 3, x1: sx + 1, y1: sy + 3 });
    const before = Uint8Array.from(world.tier);
    tick(world);
    for (let i = 0; i < world.w * world.h; i++) if (world.tier[i] > before[i] && !hasAccess(world, i)) grewWithAccess.ok = false;
    if (withSave != null && t === withSave) saved = save(world);
  }
  return { world, saved, grewWithAccess: grewWithAccess.ok };
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
for (const z of ["R", "C", "I"]) check(`valve ${z} bounded`, world.valves[z] >= -1 && world.valves[z] <= 1, String(world.valves[z]));
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

// determinism: build twice
const B = buildCity(SEED, YEARS);
check("determinism: same seed + same inputs ⇒ same hash", stateHash(A.world) === stateHash(B.world), `${stateHash(A.world)} vs ${stateHash(B.world)}`);

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
