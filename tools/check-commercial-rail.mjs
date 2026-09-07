import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createWorld, ZONE, ROAD, PART, isPart } from "../js/sim/world.js";
import "../js/sim/ops.js";
import { computeFields, recountRosters } from "../js/sim/fields.js";
import { commercialCustomers } from "../js/sim/commercial-customers.js";
import { lotScore } from "../js/sim/lots.js";
import { KNOBS } from "../js/sim/rules.js";
import { USE } from "../js/sim/use.js";
import { load, save, stateHash } from "../js/sim/save.js";
import { tick } from "../js/sim/tick.js";

function fixture(count = 1000) {
  const w = createWorld({ seed: "commercial-rail" });
  for (const key of ["terrain", "road", "zone", "rail", "civic", "wall", "use", "big"]) w[key].fill(0);
  const at = (x, y) => y * w.w + x;
  const home = at(5, 8), shop = at(35, 8);
  w.zone[home] = ZONE.R; w.tier[home] = 3;
  w.zone[shop] = ZONE.C; w.tier[shop] = 0; w.maxTier[shop] = 3;
  w.road[at(5, 9)] = w.road[at(35, 9)] = ROAD.ROAD;
  for (let x = 5; x <= 35; x++) w.rail[at(x, 10)] = 1;
  w.rail[at(5, 10)] = w.rail[at(35, 10)] = 2;
  w.citizens = Array.from({ length: count }, (_, id) => ({ id, home, species: "rabbit", job: -1 }));
  refresh(w);
  return { w, at, home, shop };
}
function refresh(w) { recountRosters(w); computeFields(w); }
const { w, at, shop } = fixture();
const initial = commercialCustomers(w, shop);
assert.equal(initial.local, 0);
const journey = 2 + 30 * KNOBS.RAIL_COST / KNOBS.WALK;
assert.ok(Math.abs(initial.rail - 1000 * KNOBS.C_RAIL_CUSTOMER_WEIGHT * (1 - journey / KNOBS.C_SHOP_TRAVEL)) < 1e-8);
assert.deepEqual(commercialCustomers(w, shop), initial, "cached reads must agree");
w.valves.C = 0.115; w.lv[shop] = 80; w.crime[shop] = 0;
assert.ok(lotScore(w, shop).p > 0, "rail customers unlock construction at positive demand");
w.valves.C = -0.8;
assert.equal(lotScore(w, shop).p, 0, "rail does not bypass weak demand");
w.rail[at(20, 10)] = 0; refresh(w);
assert.equal(commercialCustomers(w, shop).rail, 0, "a broken line provides no customers");
w.rail[at(20, 10)] = 1; w.rail[at(35, 10)] = 1; refresh(w);
assert.equal(commercialCustomers(w, shop).rail, 0, "tracks without an arrival station provide no customers");
w.rail[at(35, 10)] = 2; w.road[at(5, 9)] = 0; refresh(w);
assert.equal(commercialCustomers(w, shop).rail, 0, "isolated homes cannot send shoppers");
w.road[at(5, 9)] = ROAD.ROAD; w.use[at(35, 9)] = USE.PRED; refresh(w);
assert.ok(commercialCustomers(w, shop).rail < initial.rail, "rabbit shoppers pay the same use-zone costs as rabbit commuters");
w.use.fill(0); w.citizens.length = 500; refresh(w);
assert.ok(Math.abs(commercialCustomers(w, shop).rail - initial.rail / 2) < 1e-8, "population changes invalidate the cache");
w.citizens.length = 0; refresh(w);
assert.equal(commercialCustomers(w, shop).rail, 0, "an empty station catchment has no bonus");
const huge = fixture(10000);
assert.equal(commercialCustomers(huge.w, huge.shop).rail, KNOBS.C_RAIL_CUSTOMER_CAP);
const local = fixture(100);
for (const c of local.w.citizens) c.home = local.at(34, 8);
local.w.zone[local.at(34, 8)] = ZONE.R; refresh(local.w);
assert.deepEqual(commercialCustomers(local.w, local.shop), { local: 100, rail: 0, total: 100 }, "nearby residents count only once");
const block = fixture(100);
const anchor = block.at(29, 7);
block.w.zone[block.home] = 0;
for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
  const i = anchor + dx + dy * block.w.w;
  block.w.zone[i] = ZONE.R;
  block.w.big[i] = dx || dy ? PART | dx | (dy << 2) : 2;
}
for (const c of block.w.citizens) c.home = anchor;
block.w.road[block.at(29, 9)] = ROAD.ROAD; block.w.rail[block.at(29, 10)] = 2; refresh(block.w);
const partial = commercialCustomers(block.w, block.shop);
assert.equal(partial.local, 50, "only half the block footprint is nearby");
assert.ok(Math.abs(partial.rail - 50 * KNOBS.C_RAIL_CUSTOMER_WEIGHT * (1 - (2 + 6 * KNOBS.RAIL_COST / KNOBS.WALK) / KNOBS.C_SHOP_TRAVEL)) < 1e-8, "rail excludes the nearby half of a block");
const walking = fixture();
walking.w.rail.fill(0);
for (let x = 5; x <= 35; x++) walking.w.road[walking.at(x, 9)] = ROAD.ROAD;
refresh(walking.w);
assert.equal(commercialCustomers(walking.w, walking.shop).rail, 0, "a road alone does not receive a rail bonus");
const distant = fixture();
// A long connected line still needs a sensible shopping journey.
distant.w.rail[distant.at(35, 10)] = 1;
for (let x = 36; x <= 60; x++) distant.w.rail[distant.at(x, 10)] = 1;
for (let y = 11; y <= 55; y++) distant.w.rail[distant.at(60, y)] = 1;
distant.w.rail[distant.at(60, 55)] = 2;
distant.w.zone[distant.shop] = 0;
const farShop = distant.at(60, 57);
distant.w.zone[farShop] = ZONE.C; distant.w.road[distant.at(60, 56)] = ROAD.ROAD; refresh(distant.w);
assert.equal(commercialCustomers(distant.w, farShop).rail, 0, "journeys beyond the budget provide no customers");
console.log("Commercial rail: connected, broken, stationless, isolated, restricted, empty, capped, local and long-distance cases passed.");

const saveArg = process.argv.indexOf("--save");
if (saveArg >= 0) {
  const city = load(readFileSync(process.argv[saveArg + 1], "utf8"));
  const before = stateHash(city), empty = [];
  const started = performance.now();
  for (let i = 0; i < city.w * city.h; i++) if (city.zone[i] === ZONE.C && !city.tier[i] && !isPart(city, i)) empty.push(i);
  const scores = empty.map(i => lotScore(city, i));
  assert.equal(stateHash(city), before, "reading customer support must not mutate saved state");
  const restored = load(save(city));
  assert.deepEqual(empty.map(i => lotScore(restored, i).customers), scores.map(s => s.customers), "save/load rebuilds the same customer support");
  console.log(JSON.stringify({ empty: empty.length, eligible: scores.filter(s => s.p > 0).length, railRange: [Math.min(...scores.map(s => s.customers.rail)), Math.max(...scores.map(s => s.customers.rail))], auditMs: Math.round(performance.now() - started) }));
  const times = [];
  for (let month = 0; month < 24; month++) {
    const start = performance.now(); tick(city); times.push(performance.now() - start);
    tick(restored);
  }
  assert.equal(stateHash(restored), stateHash(city), "24-month continuation is deterministic across save/load");
  console.log(JSON.stringify({ months: 24, developed: empty.filter(i => city.tier[i] > 0 || isPart(city, i)).length, meanTickMs: Math.round(times.reduce((a,b) => a+b,0)/times.length) }));
}
