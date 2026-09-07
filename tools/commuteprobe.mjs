// commuteprobe.mjs — how far does a Zoo City animal travel to work, against the range of the
// benefit its workplace gives, and against its own species' preference? And what do the jobless
// see: how far is the nearest open job, and what would a longer commute budget hire?
// The owner (2026-09-07): "as far as the artists, and this goes for police, firefighters, and
// educators, and other similar placed services, i am ok with people traveling to work further
// than the range of the benefit of the service. i'm even potentially ok with people commuting
// further than they should to commercial, industrial, and meat jobs if the demand is high enough,
// but that would need to be balanced very carefully."
// (docs/PROPOSAL-GENERATIONS-AND-SKILLS-2026-09-07.md §9.) Passive: exit 0, prints, never judges;
// nothing in the sim changes.
//
// Today's law (citizens.js searchJob): a worker takes any open job within COMMUTE_MAX 40 walking
// steps (a ride step RAIL_COST/WALK = 2/9), scored pref × 1/(1 + d/sp.commute) × noise — the species'
// commute is a PREFERENCE (and +10 mood when met), never a gate, and nothing ties hiring to the
// workplace's service radius.
//
//   node tools/commuteprobe.mjs [--layout balanced|estate] [--seed 7] [--years 30] [--civics]
//                               [--at-centre] [--no-stations] [--markets N] [--stretch 120]
//
//   --civics     the probe pays for a library, a gallery, a university, an amphitheater, a zoo and a
//                centre at year 4, ring-searched out from the START road (the mayor's own convention
//                for her stations; her plan is untouched). On the ESTATE the start is at the map edge
//                and a civic there hires nobody in thirty years (the reachprobe's trap again), so:
//   --at-centre  ring-search out from the home nearest the map's centre instead. Every crew is then
//                staffed, but the buildings sit on ground the mayor's plan would have opened as
//                blocks and the town grows less (measured: balanced P 977 against 2,138 at 30 years,
//                estate 674 against 1,234). READ THE COMMUTE TABLE, NOT THE POPULATION LINE, from
//                such a run; the commute law is the same whatever the town's fortunes.
import { createWorld, ZONE, CIVIC, KIND_OF_CIVIC, isCivicEmployer, anchorOf, jobsOf } from "../js/sim/world.js";
import { createMayor } from "./mayor.mjs";
import { tick } from "../js/sim/tick.js";
import { dial, doorsOf, commuteTime, rides, WALK } from "../js/sim/fields.js";
import { apply } from "../js/sim/ops.js";
import { KNOBS } from "../js/sim/rules.js";
import { SPECIES_BY_ID, admits } from "../js/sim/species.js";
import { isWorker } from "../js/sim/census.js";

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] != null ? args[i + 1] : d; };
const flag = (k) => args.includes(k);
const layout = arg("--layout", "balanced");
const seed = arg("--seed", "7");
const years = Number(arg("--years", 30));
const civics = flag("--civics");
const atCentre = flag("--at-centre");
const stations = !flag("--no-stations");
const markets = Number(arg("--markets", 0));
const STRETCH = Number(arg("--stretch", 120));

const world = createWorld({ seed });
const mayor = createMayor(world, { layout, rates: [8, 8, 8], disasters: false, stations, markets });
const w = world.w, n = world.w * world.h;
const placed = [];
/** The housed R lot nearest the map's centre — where the town is, whatever the layout. */
function centreHome() {
  let best = -1, bd = Infinity;
  for (let i = 0; i < n; i++) {
    if (world.zone[i] !== ZONE.R || world.tier[i] === 0) continue;
    const d = Math.hypot((i % w) - w / 2, ((i / w) | 0) - world.h / 2);
    if (d < bd) { bd = d; best = i; }
  }
  return best < 0 ? mayor.start.sy * w + mayor.start.sx : best;
}
function place(kind) {
  const c0 = atCentre ? centreHome() : mayor.start.sy * w + mayor.start.sx;
  const sx = c0 % w, sy = (c0 / w) | 0;
  for (let r = 1; r <= 16; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    world.cash += KNOBS.COST[kind]; // the probe pays for its own instrument
    const res = apply(world, { kind, tx: sx + dx, ty: sy + dy });
    if (res.ok) { placed.push(`${kind} (${sx + dx},${sy + dy})`); return true; }
    world.cash -= KNOBS.COST[kind];
  }
  placed.push(`${kind}: nowhere within 16 of the start`);
  return false;
}

const label = (i) => { const cv = world.civic[i]; if (isCivicEmployer(cv)) return KIND_OF_CIVIC[cv]; const z = world.zone[i]; return z === ZONE.C ? "C" : z === ZONE.I ? "I" : z === ZONE.M ? "M" : "?"; };
const ORDER = ["police", "fire", "library", "gallery", "university", "amphitheater", "zoo", "centre", "C", "I", "M"];
const BENEFIT = { police: KNOBS.POLICE_RADIUS, fire: KNOBS.FIRE_RADIUS, library: KNOBS.KNOW_RADIUS, gallery: KNOBS.KNOW_RADIUS, C: 5 };
const cheb = (i, j) => Math.max(Math.abs((i % w) - (j % w)), Math.abs(((i / w) | 0) - ((j / w) | 0)));
/** Chebyshev from a home to the nearest tile of the job's footprint (the campuses measure their cover from every tile). */
function distToJob(home, job) {
  const a = anchorOf(world, job);
  let best = cheb(home, job);
  const ax = a % w, ay = (a / w) | 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const x = ax + dx, y = ay + dy;
    if (x < 0 || y < 0 || x >= w || y >= world.h) continue;
    const j = y * w + x;
    if (anchorOf(world, j) !== a && j !== a) continue;
    if (world.civic[j] !== world.civic[a] || world.zone[j] !== world.zone[a]) continue;
    best = Math.min(best, cheb(home, j));
  }
  return best;
}
const pct = (a, b) => `${Math.round(100 * a / Math.max(1, b))}%`;
const q = (arr, p) => { if (!arr.length) return 0; const s = arr.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]; };

console.log(`commuteprobe — layout ${layout} · seed ${seed} · ${years} years${stations ? " · stations" : ""}${civics ? (atCentre ? " · civics at the centre" : " · civics") : ""}${markets ? ` · ${markets} halls` : ""} · COMMUTE_MAX ${KNOBS.COMMUTE_MAX} walking steps, a ride step ${KNOBS.RAIL_COST}/${WALK}`);
console.log("  year |    P  workers | housed: employed jobless | camping | open jobs (lots) |  V_R   V_C   V_I   V_M | mean commute  riders");
for (let t = 0; t < years * 12; t++) {
  mayor.month(t);
  if (civics && t === 48) for (const kind of ["library", "gallery", "university", "amphitheater", "zoo", "centre"]) place(kind);
  tick(world);
  if ((t + 1) % 60 === 0 || t + 1 === years * 12) {
    const cen = world.last.census;
    let employed = 0, jobless = 0, camping = 0, open = 0, openLots = 0;
    for (const c of world.citizens) { if (c.dead || !isWorker(world, c)) continue; if (c.home < 0) camping++; else if (c.job >= 0) employed++; else jobless++; } // a camping family (home −1) holds no job to read
    for (let i = 0; i < n; i++) { const j = jobsOf(world, i); if (j > world.staff[i]) { open += j - world.staff[i]; openLots++; } }
    const v = world.valves;
    console.log(`  ${String((t + 1) / 12).padStart(4)} | ${String(cen.P).padStart(4)} ${String(cen.W).padStart(8)} | ${String(employed).padStart(16)} ${String(jobless).padStart(7)} | ${String(camping).padStart(7)} | ${String(open).padStart(9)} ${`(${openLots})`.padStart(6)} | ${v.R.toFixed(2).padStart(5)} ${v.C.toFixed(2).padStart(5)} ${v.I.toFixed(2).padStart(5)} ${(v.M || 0).toFixed(2).padStart(5)} | ${cen.meanCommute.toFixed(1).padStart(12)} ${String(cen.riders).padStart(7)}`);
  }
}
if (civics) console.log(`  placed at year 4 beside the ${atCentre ? "home nearest the map's centre — on the mayor's future ground; read the commute table, not the population line" : "start road"}: ${placed.join("; ")}`);

// 1. The employed: steps, tiles, the benefit radius, the species' preference.
const groups = new Map();
for (const c of world.citizens) {
  if (c.dead || c.home < 0 || c.job < 0 || !c.path) continue;
  const k = label(c.job);
  let g = groups.get(k);
  if (!g) groups.set(k, (g = { n: 0, riders: 0, steps: [], tiles: [], beyondBenefit: 0, beyondPref: 0 }));
  const steps = commuteTime(c.path);
  const tiles = distToJob(c.home, c.job);
  g.n++;
  if (rides(c.path)) g.riders++;
  g.steps.push(steps);
  g.tiles.push(tiles);
  if (BENEFIT[k] != null && tiles > BENEFIT[k]) g.beyondBenefit++;
  if (steps > SPECIES_BY_ID[c.species].commute) g.beyondPref++;
}
console.log("");
console.log("  THE EMPLOYED, at the end: commute in walking steps (a ride step 2/9), and the home's Chebyshev distance to the workplace's footprint");
console.log("  workplace     |    n riders | steps: median  p90  max | tiles: median  max | benefit radius | live beyond it | commute beyond own preference");
for (const k of ORDER) {
  const g = groups.get(k);
  if (!g) continue;
  const b = BENEFIT[k];
  console.log(`  ${k.padEnd(13)} | ${String(g.n).padStart(4)} ${pct(g.riders, g.n).padStart(6)} | ${String(q(g.steps, 0.5).toFixed(0)).padStart(13)} ${String(q(g.steps, 0.9).toFixed(0)).padStart(4)} ${String(Math.max(...g.steps).toFixed(0)).padStart(4)} | ${String(q(g.tiles, 0.5)).padStart(13)} ${String(Math.max(...g.tiles)).padStart(4)} | ${(b == null ? (k === "university" || k === "amphitheater" ? "tile budget" : k === "zoo" || k === "centre" ? "citywide" : "—") : `Chebyshev ${b}`).padStart(14)} | ${(b == null ? "—" : `${g.beyondBenefit} (${pct(g.beyondBenefit, g.n)})`).padStart(14)} | ${g.beyondPref} (${pct(g.beyondPref, g.n)})`);
}

// 2. The jobless: the nearest open job that admits them, out to --stretch walking steps.
const openByDoor = new Map();
let openJobs = 0;
const openLots = [];
for (let i = 0; i < n; i++) {
  const jobs = jobsOf(world, i);
  if (!jobs || world.staff[i] >= jobs || world.rubble[i] || world.burning[i]) continue;
  const doors = doorsOf(world, i);
  if (!doors.length) continue;
  openLots.push(i);
  openJobs += jobs - world.staff[i];
  for (const d of doors) { let l = openByDoor.get(d); if (!l) openByDoor.set(d, (l = [])); l.push(i); }
}
const jobless = world.citizens.filter((c) => !c.dead && c.home >= 0 && c.job < 0 && isWorker(world, c));
const EDGES = [KNOBS.COMMUTE_MAX, 60, 80, STRETCH];
const bucketOf = (d) => { if (d < 0) return "none"; for (const e of EDGES) if (d <= e) return `≤${e}`; return "none"; };
const hist = new Map();
const byKind = new Map();
let noDoor = 0, waitingSum = 0;
for (const c of jobless) {
  const doors = doorsOf(world, c.home);
  if (!doors.length) { noDoor++; continue; }
  let found = -1, lot = -1;
  dial(world, c.species, doors, STRETCH * WALK, (tile, cost) => {
    const lots = openByDoor.get(tile);
    if (!lots) return false;
    for (const l of lots) if (admits(world.use[l], c.species)) { found = cost / WALK; lot = l; return true; }
    return false;
  });
  const b = bucketOf(found);
  hist.set(b, (hist.get(b) || 0) + 1);
  if (lot >= 0) { const k = label(lot); byKind.set(k, (byKind.get(k) || 0) + 1); }
  waitingSum += c.jobless || 0;
}
console.log("");
console.log(`  THE JOBLESS, at the end: ${jobless.length} workers without a job (${noDoor} with no door), mean months searching ${jobless.length ? (waitingSum / jobless.length).toFixed(1) : "—"}; ${openJobs} open jobs on ${openLots.length} lots`);
console.log(`  nearest open job that admits them, in walking steps: ${EDGES.map((e) => `≤${e}: ${hist.get(`≤${e}`) || 0}`).join(" · ")} · none within ${STRETCH}: ${hist.get("none") || 0}`);
console.log(`    (≤${KNOBS.COMMUTE_MAX} is the queue — the search hires ${KNOBS.JOB_SEARCHES} a month; beyond it is what a longer budget would hire, at most the ${openJobs} open)`);
if (byKind.size) console.log(`    the nearest open job is: ${[...byKind.entries()].map(([k, v]) => `${k} ${v}`).join(" · ")}`);

// 3. The open lots: the nearest jobless worker's door.
const joblessDoors = new Set();
for (const c of jobless) for (const d of doorsOf(world, c.home)) joblessDoors.add(d);
const rev = new Map();
for (const i of openLots) {
  let found = -1;
  dial(world, null, doorsOf(world, i), STRETCH * WALK, (tile, cost) => { if (joblessDoors.has(tile)) { found = cost / WALK; return true; } return false; }, { neutral: true });
  const b = bucketOf(found);
  rev.set(b, (rev.get(b) || 0) + 1);
}
console.log(`  the open lots' nearest jobless worker, in walking steps: ${EDGES.map((e) => `≤${e}: ${rev.get(`≤${e}`) || 0}`).join(" · ")} · none within ${STRETCH}: ${rev.get("none") || 0}`);
