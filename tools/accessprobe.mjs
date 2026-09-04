// accessprobe.mjs — what road access actually reaches, and what it refuses.
//
// An INSTRUMENT: it reports and never halts, never gates, exit 0 always.
//
// The owner (2026-09-02): "as long as a tile is within 1-3 tiles of the road
// it has road access", then "the 6x6 squares have roads around the whole
// perimeter, so nothing is more than 3 tiles away", then "i want that rule
// standardized, including rail and warehouses, and zoos", and "the other way
// to think about it is that all sides have access points".
//
// So this measures the standard (SPEC §6c) rather than arguing about it:
//
//   spread     every zoned lot by the distance the RULE reads (the site's
//              nearest tile) beside the distance its own tile reads — the
//              gap between the two columns is what a block buys
//   doors      how many sides each lot is entered from, and how much of the
//              town has more than one; the commute takes the nearest
//   works      industrial lots above tier 2 standing further than one tile
//              from a road — every one of them was capped at 2 by the old
//              frontage rule and is not any more
//   stations   every platform: its distance, its doors, and whether the old
//              rule (a road ORTHOGONALLY beside it) would have reached it
//   zoos       served and unserved: an unserved zoo has no jobs, no halo and
//              no room on the cap
//   why not    every lot the rule refuses, with the reason its card gives and
//              how far the nearest road really is
//
//   node tools/accessprobe.mjs [--seed 7] [--years 30] [--layout millbelt]
//                              [--zoo 12] [--stations] [--save FILE] [--csv]
//
// --save loads a real saved city instead of building one (the owner's town,
// once it arrives: docs/fixtures/). Everything below is read-only.

import { readFileSync } from "node:fs";
import { createWorld, ZONE, ZONE_NAME, CIVIC, siteTiles } from "../js/sim/world.js";
import { tick } from "../js/sim/tick.js";
import { load, save } from "../js/sim/save.js";
import { KNOBS } from "../js/sim/rules.js";
import { served, siteRoadDist, doorsOf, nearestRoad, computeFields } from "../js/sim/fields.js";
import { lotScore } from "../js/sim/lots.js";
import { census } from "../js/sim/census.js";
import { createMayor } from "./mayor.mjs";

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const flag = (k) => argv.includes(k);
const SEED = arg("--seed", "7");
const YEARS = Number(arg("--years", 30));
const LAYOUT = arg("--layout", "millbelt");
const SAVE = arg("--save", null);
const ZOO = arg("--zoo", null);
const CSV = flag("--csv");
const REACH = KNOBS.ROAD_REACH;

// ---- the town ---------------------------------------------------------------
let world;
let title;
if (SAVE) {
  world = load(readFileSync(SAVE, "utf8"));
  title = `${SAVE} — ${world.citizens.length} citizens at month ${world.tick}`;
} else {
  world = createWorld({ seed: SEED });
  const mayor = createMayor(world, {
    layout: LAYOUT, rates: [8, 8, 8], markets: 1, stations: flag("--stations"),
    zooYear: ZOO == null ? null : Number(ZOO),
  });
  for (let t = 0; t < YEARS * 12; t++) { mayor.month(t); tick(world); }
  title = `seed ${SEED} layout ${LAYOUT} — ${YEARS} years, ${world.citizens.length} citizens`;
}
computeFields(world);
const n = world.w * world.h;
const at = (i) => `(${i % world.w},${(i / world.w) | 0})`;
const cen = census(world);

console.log(`accessprobe: ${title}`);
console.log(`ROAD_REACH ${REACH} — a site is served when ANY tile of its footprint is within ${REACH} of a road`);

// ---- spread: the rule's distance beside the tile's ---------------------------
const spread = [];      // by the site's distance
const tileSpread = [];  // by the tile's own
for (let d = 0; d <= REACH + 1; d++) { spread[d] = 0; tileSpread[d] = 0; }
let lots = 0;
let lifted = 0; // lots the site's distance saves that the tile's would refuse
for (let i = 0; i < n; i++) {
  if (world.zone[i] === ZONE.NONE) continue;
  lots++;
  const sd = Math.min(REACH + 1, siteRoadDist(world, i));
  const td = Math.min(REACH + 1, world.roadDist[i]);
  spread[sd]++;
  tileSpread[td]++;
  if (sd <= REACH && td > REACH) lifted++;
}
console.log("");
console.log("spread — zoned lots by road distance");
console.log("  dist   by the site (the rule)   by the tile alone");
for (let d = 0; d <= REACH + 1; d++) {
  const label = d > REACH ? `  ${REACH}+ ` : `   ${d}  `;
  console.log(`${label}   ${String(spread[d]).padStart(18)}   ${String(tileSpread[d]).padStart(17)}`);
}
console.log(`  ${lots} zoned lots · ${lifted} served only because the rule asks the whole footprint (a block's far tile)`);

// ---- doors: all sides are access points --------------------------------------
const bySides = [0, 0, 0, 0, 0]; // 0..4 doors
let doorTotal = 0;
let multi = 0;
for (let i = 0; i < n; i++) {
  if (world.zone[i] === ZONE.NONE) continue;
  const k = Math.min(4, doorsOf(world, i).length);
  bySides[k]++;
  doorTotal += k;
  if (k > 1) multi++;
}
console.log("");
console.log("doors — how many sides a lot is entered from");
for (let k = 0; k <= 4; k++) console.log(`  ${k === 4 ? "4+" : k} door${k === 1 ? " " : "s"}   ${String(bySides[k]).padStart(5)}`);
console.log(`  mean ${lots ? (doorTotal / lots).toFixed(2) : "—"} doors a lot · ${multi} lots (${lots ? Math.round((100 * multi) / lots) : 0}%) can be left by more than one side`);

// ---- works: what the old frontage rule capped --------------------------------
let works = 0;
let worksBeyond1 = 0;
let worksT3Beyond1 = 0;
for (let i = 0; i < n; i++) {
  if (world.zone[i] !== ZONE.I || world.tier[i] < 2 || !served(world, i)) continue;
  works++;
  if (siteRoadDist(world, i) > 1) {
    worksBeyond1++;
    if (world.tier[i] === 3) worksT3Beyond1++;
  }
}
console.log("");
console.log("works — industry above tier 1 (the old rule held anything past one tile from a road at tier 2)");
console.log(`  ${works} served industrial lots at tier 2 or 3 · ${worksBeyond1} of them more than one tile from a road · ${worksT3Beyond1} of those now at tier 3`);

// ---- stations ----------------------------------------------------------------
const stations = [];
for (let i = 0; i < n; i++) {
  if (world.rail[i] !== 2) continue;
  const doors = doorsOf(world, i);
  const d = siteRoadDist(world, i);
  const beside = doors.length > 0 && d === 1; // the old rule: a road orthogonally beside the platform
  stations.push({ i, d, doors, beside });
}
console.log("");
console.log(`stations — ${stations.length} platform${stations.length === 1 ? "" : "s"}`);
for (const s of stations) {
  console.log(`  ${at(s.i)}  ${s.doors.length ? `${s.d} tile${s.d === 1 ? "" : "s"} to ${s.doors.length} door${s.doors.length === 1 ? "" : "s"} ${s.doors.slice(0, 4).map(at).join(" ")}` : `no road within ${REACH} — nobody can reach the platform`}${s.doors.length && !s.beside ? "   <- the old rule refused this one" : ""}`);
}
if (stations.length) console.log(`  ${stations.filter((s) => s.doors.length && !s.beside).length} of ${stations.length} are doors only under the standard`);

// ---- zoos --------------------------------------------------------------------
const zoos = [];
for (let i = 0; i < n; i++) if (world.civic[i] === CIVIC.ZOO) zoos.push({ i, d: siteRoadDist(world, i), tiles: siteTiles(world, i).length, ok: served(world, i) });
console.log("");
console.log(`zoos — ${zoos.length} built, ${cen.zoos} served, ${cen.zoosNoRoad} not`);
for (const z of zoos) console.log(`  ${at(z.i)}  ${z.tiles} tiles · ${z.ok ? `served at ${z.d}` : `NO ROAD — no jobs, no halo, and ${KNOBS.CAP_ZOO} off the cap`}`);

// ---- why not -----------------------------------------------------------------
const refused = [];
for (let i = 0; i < n; i++) {
  if (world.zone[i] === ZONE.NONE || served(world, i)) continue;
  const near = nearestRoad(world, i, 12);
  refused.push({ i, zone: world.zone[i], tier: world.tier[i], reason: lotScore(world, i).reason, d: near.d, to: near.doors[0] });
}
console.log("");
console.log(`why not — ${refused.length} zoned lot${refused.length === 1 ? "" : "s"} the rule refuses`);
for (const r of refused.slice(0, 40)) {
  console.log(`  ${at(r.i)}  ${ZONE_NAME[r.zone]}${r.tier ? ` tier ${r.tier}` : " empty"} · ${r.reason} · ${r.to == null ? "no road within 12" : `nearest road ${r.d} tiles at ${at(r.to)}`}`);
}
if (refused.length > 40) console.log(`  … and ${refused.length - 40} more`);
if (!refused.length) console.log(`  none — every zoned lot in this town is within ${REACH} of a road. Only a hand-built town shows the other case; --save one.`);

// ---- the town in one line -----------------------------------------------------
console.log("");
console.log(`town: P ${cen.P} · lots ${cen.lots} · lots with no road ${cen.lotsNoRoad} · roads ${cen.roads} · stations ${cen.stations} · riders ${cen.riders} · mean commute ${cen.meanCommute.toFixed(2)}`);

if (CSV) {
  console.log("");
  console.log("dist,siteLots,tileLots");
  for (let d = 0; d <= REACH + 1; d++) console.log(`${d},${spread[d]},${tileSpread[d]}`);
}
void save;
