// Potential shoppers, derived from the same routes as commuters. No trips or RNG are created.
import { ZONE, isPart, footprintOf, occAt } from "./world.js";
import { dial, doorsOf, nodePath, rides, WALK } from "./fields.js";
import { KNOBS } from "./rules.js";

const cache = new WeakMap();
const nearby = (world, a, b) => Math.abs(a % world.w - b % world.w) <= 5 && Math.abs((a / world.w | 0) - (b / world.w | 0)) <= 5;

function railCustomers(world) {
  const prior = cache.get(world);
  if (prior && prior.epoch === world._commercialEpoch) return prior.values;
  const values = new Float64Array(world.w * world.h);
  cache.set(world, { epoch: world._commercialEpoch, values });
  if (!world.rail.includes(2)) return values;
  const shops = [];
  for (let i = 0; i < values.length; i++) {
    if (world.zone[i] !== ZONE.C || isPart(world, i)) continue;
    const doors = doorsOf(world, i);
    if (doors.length) shops.push({ i, doors });
  }
  if (!shops.length) return values;
  // With no use restrictions all species have identical routes: one search per home.
  const restricted = world.use.some(Boolean);
  const homes = new Map();
  for (const c of world.citizens) {
    if (c.dead || c.home < 0 || world.zone[c.home] !== ZONE.R) continue;
    const key = `${c.home}:${restricted ? c.species : "all"}`;
    let group = homes.get(key);
    if (!group) homes.set(key, group = { home: c.home, species: c.species, count: 0 });
    group.count++;
  }
  const budget = KNOBS.C_SHOP_TRAVEL * WALK;
  for (const { home, species, count } of homes.values()) {
    const from = doorsOf(world, home);
    if (!from.length) continue;
    const footprint = [...footprintOf(world, home)];
    const { dist, prev } = dial(world, species, from, budget, () => false);
    for (const { i, doors } of shops) {
      if (values[i] >= KNOBS.C_RAIL_CUSTOMER_CAP) continue;
      // A block's residents are distributed over its footprint, just like occAt.
      // Exclude the fraction already included by the local five-tile calculation.
      const outside = footprint.filter(t => !nearby(world, i, t)).length / footprint.length;
      if (!outside) continue;
      let best = -1;
      for (const door of doors) if (dist[door] >= 0 && (best < 0 || dist[door] < dist[best])) best = door;
      if (best < 0 || dist[best] >= budget || !rides(nodePath(world, prev, best))) continue;
      values[i] = Math.min(KNOBS.C_RAIL_CUSTOMER_CAP, values[i] + count * outside * KNOBS.C_RAIL_CUSTOMER_WEIGHT * (1 - dist[best] / budget));
    }
  }
  return values;
}

export function commercialCustomers(world, i) {
  let local = 0;
  const x = i % world.w, y = i / world.w | 0;
  for (let yy = Math.max(0, y - 5); yy <= Math.min(world.h - 1, y + 5); yy++) {
    for (let xx = Math.max(0, x - 5); xx <= Math.min(world.w - 1, x + 5); xx++) {
      const j = yy * world.w + xx;
      if (world.zone[j] === ZONE.R) local += occAt(world, j);
    }
  }
  const rail = railCustomers(world)[i];
  return { local, rail, total: local + rail };
}
