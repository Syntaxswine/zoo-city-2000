// events.js — what the years throw at the town. SPEC §9.
//
// One roll per tick with p = EVENT_P from the ARMED roster (gates true),
// weight-sampled; disasters never chain within DISASTER_COOLDOWN ticks; the
// "No disasters" toggle masks only disaster kinds. Timed effects are plain
// structs {id, until, ...} in world.events.active, saved with the city, and
// read by demand.js (extMult, valveBoost), fields.js (smog, scrubbers),
// citizens.js (birthMult, friendMult, moodBoost) and budget.js (bear winter).

import { KNOBS } from "./rules.js";
import { ZONE, CIVIC, TERRAIN, ROAD, idx, inBounds, capacityOf } from "./world.js";
import { post } from "./budget.js";
import { removeHousehold, evictFromLot, fireFromLot, invalidatePaths } from "./citizens.js";
import { neutralRate } from "./demand.js";
import { ageYears } from "./census.js";
import { SPECIES_BY_ID } from "./species.js";

const DISASTER = "disaster";
const BOON = "boon";

function builtLots(world) {
  const out = [];
  for (let i = 0; i < world.w * world.h; i++) if (world.tier[i] > 0 && !world.rubble[i] && !world.burning[i]) out.push(i);
  return out;
}

function anyWater(world) {
  for (let i = 0; i < world.terrain.length; i++) if (world.terrain[i] === TERRAIN.WATER) return true;
  return false;
}

function lowerTier(world, i) {
  if (world.tier[i] <= 0) return;
  world.tier[i]--;
  const cap = capacityOf(world, i);
  if (world.zone[i] === ZONE.R) evictFromLot(world, i, cap);
  else fireFromLot(world, i, cap);
}

function toRubble(world, i) {
  if (world.zone[i] === ZONE.NONE || world.tier[i] === 0) return;
  while (world.tier[i] > 0) lowerTier(world, i);
  world.rubble[i] = 1;
}

/** The roster. `gate(world, cen)` arms; `weight`; `fire(world, cen)` applies and returns the ticker line. */
export const ROSTER = [
  {
    id: "fire", kind: DISASTER, weight: (w, c) => 3 * (((w.tick % 12) >= 5 && (w.tick % 12) <= 7) ? 2 : 1),
    gate: (w) => builtLots(w).length > 0,
    fire: (w) => {
      // Where it starts: every built lot, weighted 1 uncovered / FIRE_START_COVERED
      // covered — a fire station makes a fire nearby unlikely, not impossible.
      const lots = builtLots(w);
      let total = 0;
      for (const l of lots) total += w.fireCov[l] ? KNOBS.FIRE_START_COVERED : 1;
      let r = w.rng.next() * total;
      let i = lots[lots.length - 1];
      for (const l of lots) { r -= w.fireCov[l] ? KNOBS.FIRE_START_COVERED : 1; if (r <= 0) { i = l; break; } }
      w.burning[i] = w.fireCov[i] ? 1 : 2;
      return `FIRE at (${i % w.w},${(i / w.w) | 0})${w.fireCov[i] ? " — the fire station is on it." : " — bulldoze a firebreak."}`;
    },
  },
  {
    id: "flood", kind: DISASTER, weight: () => 2,
    gate: (w) => anyWater(w),
    fire: (w) => {
      const { w: W, h } = w;
      let hit = 0;
      for (let i = 0; i < W * h; i++) {
        if (w.terrain[i] !== TERRAIN.WATER) continue;
        const tx = i % W;
        const ty = (i / W) | 0;
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
          if (Math.abs(dx) + Math.abs(dy) > 3) continue;
          const xx = tx + dx;
          const yy = ty + dy;
          if (!inBounds(w, xx, yy)) continue;
          const j = yy * W + xx;
          if (w.terrain[j] === TERRAIN.WATER || w.civic[j] === CIVIC.PARK || w.flooded[j]) continue;
          w.flooded[j] = 4;
          if (w.tier[j] > 0) { lowerTier(w, j); hit++; }
        }
      }
      return `FLOOD along the water — ${hit} buildings lost a storey.`;
    },
  },
  {
    id: "tornado", kind: DISASTER, weight: () => 1,
    gate: () => true,
    fire: (w) => {
      // The path runs through a random BUILT lot (a tornado over empty
      // grass is a nothing-event; measured: 0 buildings hit in 3 of 3 runs).
      const { w: W, h } = w;
      const vertical = w.rng.chance(0.5);
      const lots = builtLots(w);
      const at = lots.length ? w.rng.pick(lots) : w.rng.int(W * h);
      const atX = at % W;
      const atY = (at / W) | 0;
      const line = vertical ? atX : atY;
      const along = vertical ? atY : atX;
      const start = Math.max(0, Math.min((vertical ? h : W) - 12, along - w.rng.int(12)));
      let hit = 0;
      for (let k = 0; k < 12; k++) {
        const tx = vertical ? line : start + k;
        const ty = vertical ? start + k : line;
        const i = idx(w, tx, ty);
        if (w.tier[i] > 0) { toRubble(w, i); hit++; }
        if (w.terrain[i] === TERRAIN.TREE) w.terrain[i] = TERRAIN.GRASS;
      }
      return `TORNADO — a 12-tile path, ${hit} buildings to rubble. Roads survived.`;
    },
  },
  {
    id: "beaverDam", kind: BOON, weight: () => 2,
    // At most one dam a decade: four in forty years ate the riverside.
    gate: (w, c) => c.shares.beaver >= 0.12 && anyWater(w) && w.tick - (w.events.lastDam ?? -100000) >= 120,
    fire: (w) => {
      // A 2×2 pond beside water on dry, unbuilt land.
      const { w: W, h } = w;
      const cands = [];
      for (let i = 0; i < W * h; i++) {
        if (w.terrain[i] !== TERRAIN.WATER) continue;
        const tx = i % W;
        const ty = (i / W) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ax = tx + dx;
          const ay = ty + dy;
          let ok = true;
          for (let yy = ay; yy <= ay + 1 && ok; yy++) for (let xx = ax; xx <= ax + 1; xx++) {
            if (!inBounds(w, xx, yy)) { ok = false; break; }
            const j = yy * W + xx;
            if (w.terrain[j] === TERRAIN.WATER || w.road[j] || w.tier[j] > 0 || w.civic[j]) { ok = false; break; }
          }
          if (ok) cands.push([ax, ay]);
        }
      }
      if (!cands.length) return null;
      // Beavers build where the town is: prefer sites within 8 tiles of a
      // built lot (the play-tester's pond landed 20 tiles from anything).
      const lotsNow = builtLots(w);
      const near = cands.filter(([ax, ay]) => lotsNow.some((l) => Math.max(Math.abs(l % W - ax), Math.abs(((l / W) | 0) - ay)) <= 8));
      const [ax, ay] = w.rng.pick(near.length ? near : cands);
      for (let yy = ay; yy <= ay + 1; yy++) for (let xx = ax; xx <= ax + 1; xx++) {
        const j = yy * W + xx;
        w.terrain[j] = TERRAIN.WATER;
        w.zone[j] = ZONE.NONE;
      }
      for (let yy = ay - 1; yy <= ay + 2; yy++) for (let xx = ax - 1; xx <= ax + 2; xx++) {
        if (!inBounds(w, xx, yy)) continue;
        const j = yy * W + xx;
        if (w.tier[j] > 0) lowerTier(w, j);
      }
      w.events.lastDam = w.tick;
      return `The Gnawleys built a DAM — a new pond at (${ax},${ay}). Lakeside land value forever; the neighbours lost a storey.`;
    },
  },
  {
    id: "smogBank", kind: DISASTER, weight: () => 2, duration: 6,
    gate: (w, c) => c.meanPol > 35,
    fire: () => `A SMOG BANK settles over the town for six months. Raccoons are delighted.`,
  },
  {
    id: "mouseBoom", kind: BOON, weight: () => 2, duration: 12, birthMult: 3,
    gate: (w, c) => c.shares.mouse >= 0.35,
    fire: () => `MOUSE BOOM — the Whiskertons are having litters. Zone housing ahead of it.`,
  },
  {
    id: "taxRevolt", kind: DISASTER, weight: () => 4,
    gate: (w) => w.events.revoltArmed >= 12,
    fire: (w) => {
      const hhs = w.households.filter((h) => !h.gone && h.home >= 0);
      const n = Math.max(1, Math.floor(hhs.length * 0.08));
      w.rng.shuffle(hhs);
      let left = 0;
      let ringleader = null;
      for (let k = 0; k < n && k < hhs.length; k++) {
        if (!ringleader) ringleader = hhs[k].surname;
        left += hhs[k].members.length;
        w.departures = w.departures || [];
        w.departures.push({ species: hhs[k].species, surname: hhs[k].surname, n: hhs[k].members.length, from: hhs[k].home });
        removeHousehold(w, hhs[k], "revolt");
      }
      post(w, "revolt", -Math.round(Math.max(0, w.cash) * 0.02));
      w.events.active.push({ id: "revoltMood", until: w.tick + 6, moodBoost: -20 });
      w.events.revoltArmed = 0;
      return `TAX REVOLT led by the ${ringleader}s — ${left} animals walk out to the edge road.`;
    },
  },
  {
    id: "boom", kind: BOON, weight: () => 3, durationRange: [12, 24], extMult: 1.3,
    gate: (w) => !w.events.active.some((e) => e.id === "recession"),
    fire: () => `BOOM — the outside world is buying. Zone industry and housing ahead.`,
  },
  {
    id: "recession", kind: DISASTER, weight: () => 2, durationRange: [18, 30], extMult: 0.6,
    gate: (w) => !w.events.active.some((e) => e.id === "boom"),
    fire: () => `RECESSION — the outside market shrinks. Cut rates two or three points and ride it out.`,
  },
  {
    id: "foxFair", kind: BOON, weight: () => 2, duration: 6, valveBoost: { C: 0.4 },
    gate: (w, c) => c.shares.fox >= 0.10 && hasCTier(w, 2),
    fire: (w) => { post(w, "grant", 1500); return `FOX MARKET FAIR — the Slyfields run a fair; shops boom for six months and the till rings §1,500.`; },
  },
  {
    id: "rabbitWarren", kind: BOON, weight: () => 2, duration: 12, birthMult: 2,
    gate: (w, c) => c.shares.rabbit >= 0.25 && c.parks >= 2,
    fire: () => `RABBIT WARREN — the Burroweses have found the parks. Births double for a year.`,
  },
  {
    id: "truffles", kind: BOON, weight: () => 2,
    gate: (w, c) => c.shares.pig >= 0.15 && treeShare(w) >= 0.08 && w.tick - (w.events.lastTruffle ?? -100000) >= 60,
    fire: (w) => { post(w, "grant", 2000); w.events.lastTruffle = w.tick; return `TRUFFLE SEASON — the Trotters came back from the woods with §2,000 worth.`; },
  },
  {
    id: "dairyFair", kind: BOON, weight: () => 2, duration: 6, valveBoost: { C: 0.3 },
    gate: (w, c) => c.shares.cow >= 0.15 && c.parks >= 2,
    fire: (w) => { post(w, "grant", 1000); return `DAIRY FAIR — the Cudworths' cheese draws a crowd; shops boom for six months and the till rings §1,000.`; },
  },
  {
    id: "wolfMoon", kind: BOON, weight: () => 2, duration: 3, friendMult: 2,
    gate: (w, c) => c.shares.wolf >= 0.10,
    fire: () => `WOLF MOON — the Greybacks howl all month. The rabbits lie awake; half the town goes out to listen, and friendships form twice as fast.`,
  },
  {
    id: "heist", kind: DISASTER, weight: () => 3,
    gate: (w, c) => robbable(w).length > 0 && robbers(w).length > 0,
    fire: (w) => {
      const lot = w.rng.pick(robbable(w));
      const thief = w.rng.pick(robbers(w));
      const loss = 100 * w.tier[lot];
      post(w, "heist", -Math.min(loss, Math.max(0, w.cash)));
      lowerTier(w, lot);
      return `HEIST — ${thief.name} ${thief.surname} (${thief.species}) cleaned out the shop at (${lot % w.w},${(lot / w.w) | 0}): −§${loss}, a storey gone. A police station covers six tiles.`;
    },
  },
  {
    id: "skunked", kind: BOON, weight: () => 2, duration: 3,
    gate: (w, c) => c.shares.skunk >= 0.05 && w.citizens.some((x) => SPECIES_BY_ID[x.species].predator),
    fire: (w) => {
      const skunk = w.rng.pick(w.citizens.filter((x) => x.species === "skunk"));
      const victim = w.rng.pick(w.citizens.filter((x) => SPECIES_BY_ID[x.species].predator));
      w.events.active.push({ id: "skunkedMood", until: w.tick + 3, moodBySpecies: { fox: -15, wolf: -15, cat: -15, hawk: -15, owl: -15 } });
      return `SKUNK INCIDENT — ${skunk.name} ${skunk.surname} sprayed ${victim.name} ${victim.surname} (${victim.species}). Every predator in town is sulking for three months.`;
    },
  },
  {
    id: "founders", kind: BOON, weight: () => 6,
    gate: (w, c) => c.speciesPresent >= 5 && c.H >= 0.5 && c.friendships >= c.P / 4 && w.tick - w.events.lastFestival >= 120,
    fire: (w) => {
      w.festivalBonus += 200;
      w.events.lastFestival = w.tick;
      w.events.active.push({ id: "festivalMood", until: w.tick + 12, moodBoost: 15 });
      return `FOUNDERS' FESTIVAL — five kinds of animal, friends across every line. The town's capacity rises for good.`;
    },
  },
  {
    id: "grant", kind: BOON, weight: () => 3,
    gate: (w, c) => w.cash < 2000 && c.approval >= 50 && w.tick - w.events.lastGrant >= 120,
    fire: (w) => { post(w, "grant", 5000); w.events.lastGrant = w.tick; return `COUNTY GRANT — a liked but poor mayor gets §5,000.`; },
  },
  {
    id: "scrubbers", kind: BOON, weight: () => 2, choice: true,
    gate: (w, c) => !w.events.scrubbers && countI(w) >= 15 && !w.events.choice,
    fire: (w) => {
      w.events.choice = { id: "scrubbers", title: "The Scrubbers Offer", text: "A firm offers to fit smoke scrubbers on every factory: industrial emissions ×0.7, permanently.", cost: 1500, accept: "Pay §1,500", decline: "Decline" };
      return `The Scrubbers Offer is on your desk.`;
    },
  },
];

function treeShare(w) {
  let n = 0;
  for (let i = 0; i < w.terrain.length; i++) if (w.terrain[i] === TERRAIN.TREE) n++;
  return n / w.terrain.length;
}
function robbable(w) {
  const out = [];
  for (let i = 0; i < w.w * w.h; i++) if (w.zone[i] === ZONE.C && w.tier[i] > 0 && w.crime[i] > KNOBS.HEIST_CRIME) out.push(i);
  return out;
}
function robbers(w) {
  // Adults only (61 of 289 fox/raccoon/cat at seed 7 y30 are cubs — the punishment panel's find).
  return w.citizens.filter((c) => !c.dead && ageYears(w, c) >= KNOBS.ADULT_AGE && (c.species === "fox" || c.species === "raccoon" || c.species === "cat"));
}
function hasCTier(w, t) {
  for (let i = 0; i < w.w * w.h; i++) if (w.zone[i] === ZONE.C && w.tier[i] >= t) return true;
  return false;
}
function countI(w) {
  let n = 0;
  for (let i = 0; i < w.w * w.h; i++) if (w.zone[i] === ZONE.I && w.tier[i] > 0) n++;
  return n;
}

/** Human titles for event ids (timed effects included), for the panel. */
export const EVENT_TITLES = Object.freeze({
  fire: "Fire", flood: "Flood", tornado: "Tornado", beaverDam: "Beaver dam", smogBank: "Smog bank",
  mouseBoom: "Mouse boom", taxRevolt: "Tax revolt", revoltMood: "Tax revolt (the mood)", boom: "Boom",
  recession: "Recession", foxFair: "Fox market fair", rabbitWarren: "Rabbit warren", founders: "Founders' festival",
  festivalMood: "Founders' festival (the mood)", grant: "County grant", scrubbers: "Scrubbers", truffles: "Truffle season",
  dairyFair: "Dairy fair", wolfMoon: "Wolf moon", bearWinter: "Bear winter", notice: "Notice",
  heist: "Heist", skunked: "Skunk incident", skunkedMood: "Skunk incident (the sulk)",
});
export const eventTitle = (id) => EVENT_TITLES[id] || id;

/**
 * Ticker prefixes — ONE source for ui.js (colour, flash) and playtest.mjs
 * (print). Three regexes lived in three files and none of them knew the
 * heist: HEIST, SKUNK INCIDENT, WOLF MOON, TRUFFLE and DAIRY lines were
 * logged and never shown or counted (found by the predation research,
 * 2026-09-02). A new event line adds its prefix here and nowhere else.
 */
export const TICKER_BAD = /^(FIRE|FLOOD|TORNADO|TAX REVOLT|RECESSION|RECEIVERSHIP|A SMOG|HEIST)/;
export const TICKER_GOOD = /^(MILESTONE|BOOM|FOUNDERS|COUNTY|FOX|RABBIT|MOUSE|TRUFFLE|DAIRY)/;
export const TICKER_FLASH = /^(MILESTONE|FIRE|FLOOD|TORNADO|TAX REVOLT|RECESSION|BOOM|FOUNDERS|COUNTY|BEAR|RECEIVERSHIP|The Gnawleys|A SMOG|MOUSE|RABBIT|FOX|The Scrubbers|HEIST|SKUNK INCIDENT|WOLF MOON|TRUFFLE|DAIRY)|ONE HUNDRED/;

/** Resolve the choice card. */
export function resolveChoice(world, accept) {
  const ch = world.events.choice;
  if (!ch) return null;
  world.events.choice = null;
  if (ch.id === "scrubbers" && accept && world.cash >= ch.cost) {
    post(world, "scrubbers", -ch.cost);
    world.events.scrubbers = true;
    return "Scrubbers fitted. The air will clear.";
  }
  return accept ? "You cannot afford it." : "Declined.";
}

/** Tick: burn, flood recede, expire effects, seasonal rules, roll a new event. */
export function eventsTick(world, cen, dem) {
  const notices = [];
  const ev = world.events;
  const { w, h } = world;
  const n = w * h;

  // Fire spreads and burns out.
  const ignite = [];
  for (let i = 0; i < n; i++) {
    if (!world.burning[i]) continue;
    world.burning[i]--;
    const tx = i % w;
    const ty = (i / w) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = tx + dx;
      const yy = ty + dy;
      if (!inBounds(world, xx, yy)) continue;
      const j = yy * w + xx;
      if (world.tier[j] > 0 && !world.burning[j] && !world.rubble[j] && world.road[j] === ROAD.NONE && world.civic[j] !== CIVIC.PARK && world.terrain[j] !== TERRAIN.WATER) {
        if (world.rng.chance(world.fireCov[j] ? KNOBS.FIRE_SPREAD_COVERED : KNOBS.FIRE_SPREAD)) ignite.push(j);
      }
    }
    if (world.burning[i] === 0) toRubble(world, i);
  }
  for (const j of ignite) if (!world.burning[j] && world.tier[j] > 0) world.burning[j] = world.fireCov[j] ? 1 : 2;
  // Flood recedes.
  for (let i = 0; i < n; i++) if (world.flooded[i]) world.flooded[i]--;
  // Expire timed effects.
  ev.active = ev.active.filter((e) => e.until > world.tick);
  if (ev.cooldown > 0) ev.cooldown--;

  // Tax revolt arming: any rate ≥ n + 4 for 12 consecutive ticks.
  const over = Math.max(world.rates.R, world.rates.C, world.rates.I) >= dem.n + 4;
  ev.revoltArmed = over ? ev.revoltArmed + 1 : 0;

  // Bear winter: every December if bears ≥ 10%.
  const month = world.tick % 12;
  if (month === 11 && cen.shares.bear >= 0.10 && !ev.active.some((e) => e.id === "bearWinter")) {
    ev.active.push({ id: "bearWinter", until: world.tick + 3 });
    for (const c of world.citizens) if (c.species === "bear") c.onLeave = true;
    notices.push("BEAR WINTER — the Ursins have gone to sleep until March. Their jobs stand empty; upkeep falls a fifth.");
  }
  if (!ev.active.some((e) => e.id === "bearWinter")) {
    for (const c of world.citizens) if (c.onLeave) c.onLeave = false;
  }

  // Tortoise centenary.
  for (const c of world.citizens) {
    if (c.species !== "tortoise" || c.centenary || c.home < 0) continue;
    if (ageYears(world, c) >= 100) {
      c.centenary = true;
      ev.centenaries.push({ tile: c.home, radius: 3, bonus: 8, name: `${c.name} ${c.surname}` });
      notices.push(`${c.name} ${c.surname} is ONE HUNDRED. A plaque goes up; the street is worth more for it.`);
    }
  }

  // Roll a new event.
  if (world.rng.chance(KNOBS.EVENT_P)) {
    const armed = ROSTER.filter((e) => {
      if (e.kind === DISASTER && (ev.noDisasters || ev.cooldown > 0)) return false;
      if (ev.active.some((a) => a.id === e.id)) return false;
      return e.gate(world, cen);
    });
    if (armed.length) {
      let total = 0;
      const ws = armed.map((e) => { const x = e.weight(world, cen); total += x; return x; });
      let r = world.rng.next() * total;
      let pick = armed[armed.length - 1];
      for (let k = 0; k < armed.length; k++) { r -= ws[k]; if (r <= 0) { pick = armed[k]; break; } }
      const line = pick.fire(world, cen);
      if (line) {
        if (pick.duration || pick.durationRange) {
          const d = pick.duration || (pick.durationRange[0] + world.rng.int(pick.durationRange[1] - pick.durationRange[0] + 1));
          const eff = { id: pick.id, until: world.tick + d };
          if (pick.extMult) eff.extMult = pick.extMult;
          if (pick.valveBoost) eff.valveBoost = pick.valveBoost;
          if (pick.birthMult) eff.birthMult = pick.birthMult;
          if (pick.friendMult) eff.friendMult = pick.friendMult;
          ev.active.push(eff);
        }
        if (pick.kind === DISASTER) ev.cooldown = KNOBS.DISASTER_COOLDOWN;
        ev.log.push({ t: world.tick, id: pick.id, line });
        notices.push(line);
      }
    }
  }
  return notices;
}
