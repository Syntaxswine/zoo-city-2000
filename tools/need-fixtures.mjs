// need-fixtures.mjs — small, deterministic truth cases shared by the suite
// and peopleprobe. They are not population statistics: each isolates one
// existing simulation pressure so dead voice-table branches cannot hide.

import { createWorld, CIVIC, ROAD, ZONE } from "../js/sim/world.js";
import { createHousehold, placeHousehold } from "../js/sim/citizens.js";
import { SPECIES } from "../js/sim/species.js";
import { refreshLast } from "../js/sim/tick.js";
import { needOf } from "../js/sim/needs.js";

export function needFixture(species = "tortoise") {
  const world = createWorld({ seed: `need-${species}`, w: 8, h: 8 });
  world.terrain.fill(0);
  world.road.fill(0);
  world.zone.fill(0);
  world.maxTier.fill(0);
  world.tier.fill(0);
  world.civic.fill(0);
  world.wall.fill(0);
  world.rail.fill(0);
  const home = 27, door = 26, park = 28;
  world.road[door] = ROAD.ROAD;
  world.zone[home] = ZONE.R;
  world.maxTier[home] = 3;
  world.tier[home] = 3;
  world.civic[park] = CIVIC.PARK;
  const household = createHousehold(world, species, 1);
  const citizen = world.byId.get(household.members[0]);
  citizen.born = -SPECIES.find((s) => s.id === species).retire * 12;
  citizen.deathAge = 99999;
  placeHousehold(world, household, home);
  world.rates = { R: 0, C: 0, I: 0 };
  refreshLast(world);
  world.last.demand.r = { R: 0, C: 0, I: 0, M: 0 };
  world.last.demand.n = 8;
  world.last.demand.capped = false;
  return { world, citizen, home, door, park };
}

const CASES = Object.freeze({
  CONTENT: ["tortoise"],
  SHOPS: ["tortoise", ({ world }) => { world.last.demand.r.C = 1; }],
  ROOMS: ["tortoise", ({ world }) => { world.last.demand.r.R = 1; }],
  WORKS: ["tortoise", ({ world }) => { world.last.demand.r.I = 1; }],
  HOOKS: ["fox", ({ world, home }) => { world.lv[home] = 60; world.last.demand.r.M = 1; }],
  NO_JOB: ["rabbit", ({ citizen }) => { citizen.born = -20 * 12; }],
  SMOKE: ["tortoise", ({ world, home }) => { world.pol[home] = 100; }],
  NO_PARK: ["tortoise", ({ world, park }) => { world.civic[park] = CIVIC.NONE; }],
  COMMUTE: ["tortoise", ({ world, citizen }) => { citizen.job = 30; citizen.path = new Uint16Array(20).fill(26); world.zone[30] = ZONE.C; world.tier[30] = 1; }],
  FLIGHT: ["rabbit", ({ world, home }) => { const h = createHousehold(world, "wolf", 1); placeHousehold(world, h, home + 1); }],
  DREAD: ["rabbit", ({ world, home }) => { world.dread[home] = 100; }],
  CRIME: ["tortoise", ({ world, home }) => { world.crime[home] = 100; }],
  VAN: ["fox", ({ world, home }) => { world.lv[home] = 60; world.civic[35] = CIVIC.CENTRE; }],
  WATER: ["beaver"],
  TREES: ["owl"],
  HIGH: ["mouse", ({ world, home }) => { world.tier[home] = 1; }],
  LOW: ["bear"],
  PASTURE: ["cow", ({ world, park }) => { world.civic[park] = CIVIC.NONE; }],
  LV: ["fox", ({ world, home }) => { world.lv[home] = 0; }],
  CLEAN: ["raccoon"],
  NO_ROAD: ["tortoise", ({ world, door, home }) => { world.road[door] = ROAD.NONE; world.roadDist[home] = 99; }],
  CAPPED: ["tortoise", ({ world, home }) => { world.tier[home] = 0; world.lv[home] = 0; world.valves.R = 0; world.last.demand.capped = true; }],
  NO_DEMAND: ["tortoise", ({ world, home }) => { world.tier[home] = 0; world.lv[home] = 0; world.valves.R = 0; }],
  TAX: ["tortoise", ({ world }) => { world.rates.R = 12; }],
});

export function needTruthResults() {
  return Object.entries(CASES).map(([expected, [species, edit]]) => {
    const fixture = needFixture(species);
    if (edit) edit(fixture);
    const need = needOf(fixture.world, fixture.citizen);
    return { expected, actual: need.code, need };
  });
}
