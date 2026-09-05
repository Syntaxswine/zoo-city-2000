// knowprobe.mjs — the KNOWLEDGE DYNAMIC, measured (SPEC §9e; the review's F2).
//
// K is a MEAN over housed animals, so a town that grows past a University's
// catchment lowers its own cap; a cap below P puts V_R below zero, and since
// economic camping that sends households to tents. Does it? This runs the
// scripted mayor's town (tools/mayor.mjs, the same town every published rig
// runs) and drops a University beside the start at a chosen year — or a
// Library, or nothing — then prints, per year: P, the cap, K, V_R, campers,
// cash. Passive: exit 0 always, annotate, never judge.
//
//   node tools/knowprobe.mjs [--layout balanced|estate|...] [--kind university|library|none]
//                            [--at YEAR] [--years 30] [--seed 7] [--csv]
//
// Where the building goes: the first clear footprint touching a road within
// 12 tiles of the start, searched in raster order — the zoo's own rule in
// mayor.mjs, so the rig is the rig.
import { createWorld } from "../js/sim/world.js";
import { createMayor } from "./mayor.mjs";
import { tick } from "../js/sim/tick.js";
import { apply } from "../js/sim/ops.js";
import { KNOBS } from "../js/sim/rules.js";
import { CIVIC_SIDE } from "../js/sim/world.js";

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] != null ? args[i + 1] : d; };
const flag = (k) => args.includes(k);
const layout = arg("--layout", "balanced");
const kind = arg("--kind", "university");
const at = Number(arg("--at", 0));
const years = Number(arg("--years", 30));
const seed = arg("--seed", "7");
const csv = flag("--csv");

const world = createWorld({ seed });
const mayor = createMayor(world, { layout, rates: [8, 8, 8], disasters: false });
const sx = world.start.tx, sy = world.start.ty;

function place(kindName) {
  const side = CIVIC_SIDE[kindName];
  world.cash += KNOBS.COST[kindName]; // the probe pays for its own instrument; the town's books are the mayor's
  for (let dy = -12; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++) {
    const r = apply(world, { kind: kindName, tx: sx + dx, ty: sy + dy });
    if (r.ok) return { tx: sx + dx, ty: sy + dy, side };
  }
  return null;
}

const rows = [];
let placed = null;
let campersMax = 0, tentMonths = 0, capBelowP = 0;
for (let t = 0; t < years * 12; t++) {
  mayor.month(t);
  if (kind !== "none" && t === at * 12 && !placed) placed = place(kind);
  tick(world);
  const c = world.last.census, d = world.last.demand;
  const campers = (world.campers || []).filter((x) => x.householdId).length;
  campersMax = Math.max(campersMax, campers);
  if (campers) tentMonths++;
  if (c.P > d.cap) capBelowP++;
  if (t % 12 === 11) rows.push({ year: (t + 1) / 12, P: c.P, cap: Math.round(d.cap), K: c.K || 0, VR: world.valves.R, campers, cash: world.cash, covered: c.knowledgeN ? Math.round(100 * (c.K || 0) / (kind === "library" ? 0.5 : 1)) : 0 });
}

if (csv) {
  console.log("year,P,cap,K,VR,campers,cash");
  for (const r of rows) console.log([r.year, r.P, r.cap, r.K.toFixed(3), r.VR.toFixed(3), r.campers, r.cash].join(","));
} else {
  console.log(`knowprobe — layout ${layout} · seed ${seed} · ${kind === "none" ? "no building" : `${kind} at year ${at}${placed ? ` at (${placed.tx},${placed.ty})` : " — NOWHERE TO PUT IT"}`}`);
  console.log(" yr     P   cap     K   V_R  camp   cash");
  for (const r of rows) console.log(`${String(r.year).padStart(3)} ${String(r.P).padStart(5)} ${String(r.cap).padStart(5)} ${r.K.toFixed(2).padStart(5)} ${r.VR.toFixed(2).padStart(5)} ${String(r.campers).padStart(5)} ${String(r.cash).padStart(7)}`);
  const last = rows[rows.length - 1];
  console.log(`end: P ${last.P} · cap ${last.cap} · K ${last.K.toFixed(2)} · months with campers ${tentMonths} (max ${campersMax}) · months with P above cap ${capBelowP}`);
}
