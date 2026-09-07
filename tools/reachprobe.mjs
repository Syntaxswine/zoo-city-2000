// reachprobe.mjs — what does "5–10 WALKING tiles, rail free" cover, against today's Chebyshev-6
// station flood? (docs/PROPOSAL-GENERATIONS-AND-SKILLS-2026-09-07.md §3c.) Passive: exit 0,
// prints, never judges; nothing in the sim changes.
//
// Builds the scripted mayor's town with a fire and a police station (hers sit beside the start
// road at year 2), or with --platform N puts the police station beside the N-th rail platform
// instead (the estate layout lays a line between its near and far rings). Then from the police
// station's doors runs the two-layer Dial with the meat carts' policy — walk steps count, board,
// alight and every rail edge cost zero — and counts the homes reached within N walking tiles;
// the same with rail priced as walking; and today's policeCov (Chebyshev 6 from every tile of
// the 3×3).
//
//   node tools/reachprobe.mjs [--layout estate|balanced] [--seed 7] [--years 15] [--platform 1|2]
//
// Measured 2026-09-07: balanced — Chebyshev 6 covers 30 homes / 177 animals, 10 walking tiles
// 30 / 260, 7 → 15, 5 → 6. Estate beside the near platform — 13 / 722 today, 7 walking tiles
// 12 / 705, 10 → 17 / 754. Beside the FAR platform — nothing today, 8 homes at 5 walking tiles
// and 13 / 550 at 10 through the line, and 0 with rail priced as walking. The mayor's own estate
// station sits at the map edge and covers nothing by any measure.
import { createWorld, ZONE, CIVIC, isPart } from "../js/sim/world.js";
import { createMayor } from "./mayor.mjs";
import { tick } from "../js/sim/tick.js";
import { dial, doorsOf, WALK } from "../js/sim/fields.js";
import { apply } from "../js/sim/ops.js";
import { KNOBS } from "../js/sim/rules.js";

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] != null ? args[i + 1] : d; };
const layout = arg("--layout", "estate");
const seed = arg("--seed", "7");
const years = Number(arg("--years", 15));
const atPlatform = args.includes("--platform");
const platformIndex = Number(arg("--platform", 1)) || 1;

const world = createWorld({ seed });
const mayor = createMayor(world, { layout, rates: [8, 8, 8], disasters: false, stations: !atPlatform });
let placed = null;
for (let t = 0; t < years * 12; t++) {
  mayor.month(t);
  if (atPlatform && t === 24 && !placed) {
    const plats = [];
    for (let i = 0; i < world.w * world.h; i++) if (world.rail[i] === 2) plats.push(i);
    outer: for (const p of plats.slice(platformIndex - 1)) {
      const px = p % world.w, py = (p / world.w) | 0;
      for (let r = 1; r <= 6 && !placed; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        world.cash += KNOBS.COST.police; // the probe pays for its own instrument
        const res = apply(world, { kind: "police", tx: px + dx, ty: py + dy });
        if (res.ok) { placed = { tx: px + dx, ty: py + dy, platform: [px, py] }; break outer; }
        world.cash -= KNOBS.COST.police;
      }
    }
  }
  tick(world);
}

const n = world.w * world.h;
const homes = [];
for (let i = 0; i < n; i++) if (world.zone[i] === ZONE.R && world.tier[i] > 0 && !isPart(world, i)) homes.push(i);
const P = homes.reduce((a, i) => a + world.occupants[i], 0);

const stations = [];
for (let i = 0; i < n; i++) if (world.civic[i] === CIVIC.POLICE && !isPart(world, i) && (world.civic[i - 1] !== CIVIC.POLICE || (i % world.w) === 0)) stations.push(i);
let anchor = stations.find((i) => doorsOf(world, i).length) ?? stations[0];
if (placed) {
  anchor = stations.find((s) => Math.abs(s % world.w - placed.tx) <= 2 && Math.abs(((s / world.w) | 0) - placed.ty) <= 2 && doorsOf(world, s).length) ?? (placed.ty * world.w + placed.tx);
  console.log(`placed the police station at (${placed.tx},${placed.ty}) beside the platform at (${placed.platform[0]},${placed.platform[1]})`);
}
if (anchor == null) { console.log("no police station in this town"); process.exit(0); }
const doors = doorsOf(world, anchor);
const railTiles = world.rail.reduce((a, r) => a + (r ? 1 : 0), 0);
const platforms = world.rail.reduce((a, r) => a + (r === 2 ? 1 : 0), 0);

function reached(maxTiles, railCost) {
  const roads = new Set();
  dial(world, null, doors, maxTiles * WALK, (tile, cost) => { if (cost <= maxTiles * WALK) roads.add(tile); return false; }, { railCost, neutral: true });
  let lots = 0, people = 0;
  for (const i of homes) if (doorsOf(world, i).some((d) => roads.has(d))) { lots++; people += world.occupants[i]; }
  return { lots, people };
}
const cheb = (() => { let lots = 0, people = 0; for (const i of homes) if (world.policeCov[i] > 0) { lots++; people += world.occupants[i]; } return { lots, people }; })();

const pct = (a, b) => `${Math.round(100 * a / Math.max(1, b))}%`;
console.log(`reachprobe — layout ${layout} · seed ${seed} · year ${years} · homes ${homes.length} housing ${P} · rail tiles ${railTiles}, platforms ${platforms} · police station at (${anchor % world.w},${(anchor / world.w) | 0}) with ${doors.length} door tiles`);
console.log(`  today, Chebyshev ${KNOBS.POLICE_RADIUS} from every tile of the 3×3 (policeCov > 0): ${cheb.lots} homes (${pct(cheb.lots, homes.length)}) · ${cheb.people} animals (${pct(cheb.people, P)})`);
for (const N of [5, 7, 10, 12]) {
  const free = reached(N, 0);
  const paid = reached(N, WALK);
  console.log(`  ${String(N).padStart(2)} walking tiles: rail FREE ${String(free.lots).padStart(3)} homes (${pct(free.lots, homes.length).padStart(3)}) · ${String(free.people).padStart(4)} animals (${pct(free.people, P).padStart(3)})   | rail priced as walking ${String(paid.lots).padStart(3)} homes · ${String(paid.people).padStart(4)} animals`);
}
