// walkers.js — the animals on the map. DOM-FREE, its own randomness, READ-ONLY
// on the sim. SPEC §14.
//
// THE BOUNDARY LAW. This module reads `world` and never writes it: no
// `world.rng`, no scratch buffers on the world object, no field touched.
// Every random draw is `hash01(tick, citizenId, salt)` — a pure hash, so the
// walker layer can be on or off and the state hash is identical (check.mjs
// Part D runs exactly that). BFS scratch lives here, sized to the map.
//
// Walkers are cosmetic readers of real state: each carries a real citizen id
// (click → the card), and is released at the next tile centre when its
// citizen dies, moves, or changes job (`notify()` after every tick and every
// player op). Nothing pops.
//
//   createWalkers(world) → { update(dtSeconds, viewportTiles), list(), notify(), setWorld(world) }
//
// Kinds: commuter (home → job → home), stroller (home → nearest park / zoo /
// shop → home), cub (home → park → home), arrival (edge road → home),
// departure (home → edge road), camper (stands by the edge road with a
// tent), scout (random-walks the roads for a month), meeting (two friends
// walk to the road between their homes and stand together ~4 s).

import { ROAD, CIVIC, ZONE, TERRAIN, inBounds } from "./sim/world.js";
import { ageYears } from "./sim/census.js";
import { SPECIES_BY_ID } from "./sim/species.js";
import { hash01 } from "./sim/rng.js";
import { edgeRoads } from "./sim/fields.js";
import { KNOBS } from "./sim/rules.js";

export const MAX_WALKERS = 150;
const SPAWN_PER_UPDATE = 3;
const MEET_STAND = 4; // seconds
const JOB_STAND = 1.5;
const HOME_STAND = 1.0;
const STROLL_STAND = 3.0;
const ADULT = KNOBS.ADULT_AGE;

const N4 = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W — the same fixed order as fields.doorOf

export function createWalkers(initialWorld) {
  let world = initialWorld;
  let active = [];
  const activeIds = new Set(); // citizen ids with a walker (kinds bound to a citizen)
  let cursor = 0; // round-robin over world.citizens
  let lastTick = -1;
  let nextFake = -1; // ids for departure walkers (negative: never a citizen)

  // ---- BFS scratch, local to this module -----------------------------------
  let n = world.w * world.h;
  let dist = new Int32Array(n);
  let prev = new Int32Array(n);
  let queue = new Int32Array(n);
  let seen = new Uint8Array(n);
  function resize() {
    if (world.w * world.h === n && dist.length === n) return;
    n = world.w * world.h;
    dist = new Int32Array(n);
    prev = new Int32Array(n);
    queue = new Int32Array(n);
    seen = new Uint8Array(n);
  }

  /** Shortest road path from road tile `from` to the first road tile satisfying `goal(j)`; inclusive array or null. */
  function roadSearch(from, goal, max = 400) {
    if (from < 0 || world.road[from] === ROAD.NONE) return null;
    resize();
    dist.fill(-1);
    let head = 0;
    let tail = 0;
    dist[from] = 0;
    prev[from] = -1;
    queue[tail++] = from;
    if (goal(from)) return [from];
    const { w, road } = world;
    while (head < tail) {
      const i = queue[head++];
      const d = dist[i];
      if (d >= max) continue;
      const tx = i % w;
      const ty = (i / w) | 0;
      for (const [dx, dy] of N4) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (!inBounds(world, nx, ny)) continue;
        const j = ny * w + nx;
        if (road[j] === ROAD.NONE || dist[j] !== -1) continue;
        dist[j] = d + 1;
        prev[j] = i;
        if (goal(j)) {
          const out = new Array(d + 2);
          let k = j;
          for (let s = d + 1; s >= 0; s--) { out[s] = k; k = prev[k]; }
          return out;
        }
        queue[tail++] = j;
      }
    }
    return null;
  }
  const roadPath = (from, to) => roadSearch(from, (j) => j === to);

  /** The road tile nearest a lot (BFS through any tile, ≤ ROAD_REACH), or -1. Mirrors fields.doorOf without its scratch. */
  function door(i) {
    if (i < 0) return -1;
    if (world.road[i] !== ROAD.NONE) return i;
    resize();
    seen.fill(0);
    const { w } = world;
    let frontier = [i];
    seen[i] = 1;
    for (let d = 0; d < KNOBS.ROAD_REACH; d++) {
      const next = [];
      for (const cur of frontier) {
        const tx = cur % w;
        const ty = (cur / w) | 0;
        for (const [dx, dy] of N4) {
          const nx = tx + dx;
          const ny = ty + dy;
          if (!inBounds(world, nx, ny)) continue;
          const j = ny * w + nx;
          if (seen[j]) continue;
          seen[j] = 1;
          if (world.road[j] !== ROAD.NONE) return j;
          next.push(j);
        }
      }
      frontier = next;
    }
    return -1;
  }

  /** Does road tile j touch a tile satisfying pred? */
  function touches(j, pred) {
    const { w } = world;
    const tx = j % w;
    const ty = (j / w) | 0;
    for (const [dx, dy] of N4) {
      const nx = tx + dx;
      const ny = ty + dy;
      if (!inBounds(world, nx, ny)) continue;
      if (pred(ny * w + nx)) return true;
    }
    return false;
  }
  const isPark = (i) => world.civic[i] === CIVIC.PARK;
  const isZoo = (i) => world.civic[i] === CIVIC.ZOO || world.civic[i] === CIVIC.ZOO_PART;
  const isShop = (i) => world.zone[i] === ZONE.C && world.tier[i] > 0;

  /** The edge road nearest the city centroid (the world's door), or -1. */
  function edgeDoor() {
    const edges = edgeRoads(world);
    if (!edges.length) return -1;
    const c = world.centroid || { cx: world.start.tx, cy: world.start.ty };
    let best = -1;
    let bd = Infinity;
    for (const i of edges) {
      const d = Math.max(Math.abs((i % world.w) - c.cx), Math.abs(((i / world.w) | 0) - c.cy));
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  // ---- walkers ----------------------------------------------------------------
  const centre = (i) => [(i % world.w) + 0.5, ((i / world.w) | 0) + 0.5];

  function speedOf(species, age) {
    let s = 1;
    if (species === "tortoise") s *= 0.5;
    if (age === "elder") s *= 0.7;
    if (age === "cub") s *= 0.9;
    return s;
  }

  function ageOf(c) {
    const y = ageYears(world, c);
    if (y < ADULT) return "cub";
    if (y >= SPECIES_BY_ID[c.species].retire) return "elder";
    return "adult";
  }

  function make(kind, c, legs, opts = {}) {
    const species = c ? c.species : opts.species;
    const age = c ? ageOf(c) : opts.age || "adult";
    const id = c ? c.id : opts.id;
    const w = {
      id,
      citizen: c ? c.id : null,
      kind,
      species,
      age,
      name: c ? `${c.name} ${c.surname}` : opts.name || "",
      hat: !!(c && c.centenary),
      legs, // [{ path: [tiles], stand: seconds }]
      leg: 0,
      seg: 0,
      t: 0,
      dist: 0,
      standUntil: opts.standFirst || 0,
      speed: speedOf(species, age),
      lane: (hash01(id | 0, 7, 0x1a2b) - 0.5) * 0.36,
      tx: 0,
      ty: 0,
      facing: "se",
      frame: 0,
      release: false,
      glyph: opts.glyph || null,
      tent: !!opts.tent,
      tile: opts.tile ?? -1,
      home0: c ? c.home : -1,
      job0: c ? c.job : -1,
      done: false,
    };
    const first = legs.length ? legs[0].path[0] : opts.tile;
    if (first != null && first >= 0) [w.tx, w.ty] = centre(first);
    if (opts.facing) w.facing = opts.facing;
    return w;
  }

  function add(w) {
    if (!w) return null;
    active.push(w);
    if (w.citizen != null) activeIds.add(w.citizen);
    return w;
  }

  function remove(k) {
    const w = active[k];
    if (w.citizen != null) activeIds.delete(w.citizen);
    active.splice(k, 1);
  }

  // ---- spawners ---------------------------------------------------------------
  function spawnCommuter(c) {
    if (!c.path || c.path.length < 2) return null;
    const out = Array.from(c.path);
    const back = out.slice().reverse();
    return add(make("commuter", c, [{ path: out, stand: JOB_STAND }, { path: back, stand: HOME_STAND }]));
  }

  function spawnStroll(c, kind) {
    const from = door(c.home);
    if (from < 0) return null;
    const goal = kind === "cub"
      ? (j) => touches(j, isPark) || touches(j, isZoo)
      : (j) => touches(j, isPark) || touches(j, isZoo) || touches(j, isShop);
    const there = roadSearch(from, goal, 40);
    if (!there || there.length < 2) return null;
    return add(make(kind, c, [{ path: there, stand: STROLL_STAND }, { path: there.slice().reverse(), stand: HOME_STAND }]));
  }

  function spawnArrival(c) {
    const e = edgeDoor();
    const to = door(c.home);
    if (e < 0 || to < 0) return null;
    const path = roadPath(e, to);
    if (!path || path.length < 2) return null;
    return add(make("arrival", c, [{ path, stand: 0.5 }]));
  }

  function spawnDeparture(dep, k) {
    const e = edgeDoor();
    const from = door(dep.from);
    if (e < 0 || from < 0) return null;
    const path = roadPath(from, e);
    if (!path || path.length < 2) return null;
    const id = nextFake--;
    return add(make("departure", null, [{ path, stand: 0 }], { id, species: dep.species, name: `the ${dep.surname}s`, standFirst: 0.6 * k }));
  }

  function spawnMeeting(a, b) {
    const da = door(a.home);
    const db = door(b.home);
    if (da < 0 || db < 0) return;
    const between = roadPath(da, db);
    if (!between) return;
    const meet = between[between.length >> 1];
    const pa = roadPath(da, meet);
    const pb = roadPath(db, meet);
    if (!pa || !pb) return;
    add(make("meeting", a, [{ path: pa, stand: MEET_STAND }], { glyph: "meeting" }));
    add(make("meeting", b, [{ path: pb, stand: MEET_STAND }], { glyph: null }));
  }

  /** A grass tile beside the k-th road tile in from the edge — where a tent goes. */
  function campSite(k) {
    const e = edgeDoor();
    if (e < 0) return -1;
    const road = roadSearch(e, () => false, 12); // fills dist[] from the edge inward
    void road;
    const { w } = world;
    const order = [];
    for (let i = 0; i < n; i++) if (dist[i] >= 0) order.push(i);
    order.sort((p, q) => dist[p] - dist[q] || p - q);
    const r = order[Math.min(k + 1, order.length - 1)];
    if (r == null) return e;
    const tx = r % w;
    const ty = (r / w) | 0;
    const dirs = k % 2 ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dx, dy] of dirs) {
      const nx = tx + dx;
      const ny = ty + dy;
      if (!inBounds(world, nx, ny)) continue;
      const j = ny * w + nx;
      if (world.road[j] === ROAD.NONE && world.terrain[j] !== TERRAIN.WATER && !world.zone[j] && !world.civic[j]) return j;
    }
    return r;
  }

  function spawnCamper(cp, k) {
    const tile = campSite(k);
    if (tile < 0) return null;
    return add(make("camper", null, [], { id: cp.id, species: cp.species, name: cp.name, tent: true, tile, facing: k % 2 ? "sw" : "se" }));
  }

  function spawnScout(cp) {
    const e = edgeDoor();
    if (e < 0) return null;
    const w = make("scout", null, [{ path: [e, e], stand: 0 }], { id: cp.id, species: cp.species, name: cp.name });
    w.steps = 0;
    w.legs = [{ path: scoutLeg(w, e, -1), stand: 0 }];
    return add(w);
  }

  /** The scout's next few steps: a random walk over roads, no immediate backtrack when avoidable. */
  function scoutLeg(w, from, cameFrom) {
    const path = [from];
    let cur = from;
    let last = cameFrom;
    for (let s = 0; s < 6; s++) {
      const tx = cur % world.w;
      const ty = (cur / world.w) | 0;
      const opts = [];
      for (const [dx, dy] of N4) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (!inBounds(world, nx, ny)) continue;
        const j = ny * world.w + nx;
        if (world.road[j] !== ROAD.NONE) opts.push(j);
      }
      if (!opts.length) break;
      const fwd = opts.filter((j) => j !== last);
      const pool = fwd.length ? fwd : opts;
      const j = pool[Math.floor(hash01(w.id | 0, w.steps++, 0x5c07) * pool.length)];
      path.push(j);
      last = cur;
      cur = j;
    }
    return path;
  }

  // ---- notify: after every tick and every op --------------------------------------
  function notify() {
    const byId = world.byId || new Map();
    const winter = world.events.active.some((e) => e.id === "bearWinter");
    const camperIds = new Set(world.campers.map((c) => c.id));

    // Release anyone whose citizen is gone or changed; campers/scouts that left.
    for (let k = active.length - 1; k >= 0; k--) {
      const w = active[k];
      if (winter && w.species === "bear") { remove(k); continue; }
      if (w.kind === "camper" || w.kind === "scout") {
        if (!camperIds.has(w.id)) remove(k);
        continue;
      }
      if (w.citizen == null) continue;
      const c = byId.get(w.citizen);
      const changed = !c || c.home !== w.home0 || (w.kind === "commuter" && c.job !== w.job0) || (w.kind === "commuter" && !c.path);
      if (changed) {
        w.release = true;
        if (w.standUntil > 0 || !w.legs.length) remove(k);
      }
    }

    // Once per tick: arrivals, departures, meetings, campers.
    if (world.tick !== lastTick) {
      lastTick = world.tick;
      // Arrivals: a walk in from the edge for each new animal, but never let
      // a burst (or a tab that got no frames) fill the roster with them.
      let budget = Math.min(24, Math.max(0, 100 - active.length));
      for (const id of world.arrivals || []) {
        if (budget <= 0 || active.length >= MAX_WALKERS) break;
        const c = byId.get(id);
        if (!c || activeIds.has(id) || (winter && c.species === "bear")) continue;
        if (spawnArrival(c)) budget--;
      }
      budget = 30;
      for (const dep of world.departures || []) {
        const m = Math.min(dep.n, 4);
        for (let k = 0; k < m && budget > 0 && active.length + 10 < MAX_WALKERS; k++) {
          if (spawnDeparture(dep, k)) budget--;
        }
      }
      budget = 6;
      for (const [ia, ib] of world.meetings || []) {
        if (budget-- <= 0 || active.length + 2 >= MAX_WALKERS) break;
        const a = byId.get(ia);
        const b = byId.get(ib);
        if (!a || !b || activeIds.has(ia) || activeIds.has(ib)) continue;
        if (winter && (a.species === "bear" || b.species === "bear")) continue;
        spawnMeeting(a, b);
      }
    }
    // Campers and the scout mirror world.campers exactly.
    const have = new Set(active.filter((w) => w.kind === "camper" || w.kind === "scout").map((w) => w.id));
    let k = 0;
    for (const cp of world.campers) {
      if (!have.has(cp.id)) {
        if (cp.kind === "scout") spawnScout(cp);
        else spawnCamper(cp, k);
      }
      if (cp.kind !== "scout") k++;
    }
  }

  // ---- update: every frame ----------------------------------------------------------
  function inView(i, vp) {
    const tx = i % world.w;
    const ty = (i / world.w) | 0;
    return tx >= vp.x0 - 8 && tx <= vp.x1 + 8 && ty >= vp.y0 - 8 && ty <= vp.y1 + 8;
  }

  function sample(vp) {
    const cs = world.citizens;
    if (!cs.length || active.length >= MAX_WALKERS) return;
    const winter = world.events.active.some((e) => e.id === "bearWinter");
    let spawned = 0;
    let tries = Math.min(cs.length, 40);
    while (tries-- > 0 && spawned < SPAWN_PER_UPDATE && active.length < MAX_WALKERS) {
      cursor = (cursor + 1) % cs.length;
      const c = cs[cursor];
      if (c.dead || c.home < 0 || activeIds.has(c.id)) continue;
      if ((c.held || 0) > world.tick) continue; // in the cells or the centre
      if (winter && c.species === "bear") continue;
      if (!inView(c.home, vp)) continue;
      const r = hash01(world.tick, c.id, 0x77);
      const y = ageYears(world, c);
      if (y < ADULT) {
        if (r < 0.35 && spawnStroll(c, "cub")) spawned++;
        continue;
      }
      if (c.path && c.path.length >= 2 && !c.stale) {
        if (r < 0.78) { if (spawnCommuter(c)) spawned++; }
        else if (r < 0.9) { if (spawnStroll(c, "stroller")) spawned++; }
      } else if (r < 0.3 && spawnStroll(c, "stroller")) spawned++;
    }
  }

  function step(w, dt) {
    const leg = w.legs[w.leg];
    if (!leg) { w.done = true; return; }
    if (w.standUntil > 0) {
      w.standUntil -= dt;
      w.frame = 0;
      if (w.standUntil > 0) return;
      // Stand over: next leg, or done.
      if (w.release) { w.done = true; return; }
      if (w.kind === "scout") {
        const p = leg.path;
        w.legs = [{ path: scoutLeg(w, p[p.length - 1], p.length > 1 ? p[p.length - 2] : -1), stand: 0 }];
        w.leg = 0; w.seg = 0; w.t = 0;
        return;
      }
      w.leg++;
      w.seg = 0;
      w.t = 0;
      if (w.leg >= w.legs.length) w.done = true;
      return;
    }
    const path = leg.path;
    if (path.length < 2) { w.standUntil = leg.stand || 0.01; return; }
    let d = w.speed * dt;
    while (d > 0) {
      const rem = 1 - w.t;
      const s = Math.min(d, rem);
      w.t += s;
      d -= s;
      w.dist += s;
      if (w.t >= 1 - 1e-9) {
        w.seg++;
        w.t = 0;
        if (w.release) { w.done = true; return; }
        if (w.seg >= path.length - 1) {
          [w.tx, w.ty] = centre(path[path.length - 1]);
          w.standUntil = Math.max(leg.stand, 0.01);
          w.frame = 0;
          if (w.kind === "scout") w.standUntil = 0.4;
          return;
        }
      }
    }
    const a = path[w.seg];
    const b = path[w.seg + 1];
    const [ax, ay] = centre(a);
    const [bx, by] = centre(b);
    const dx = bx - ax;
    const dy = by - ay;
    w.tx = ax + dx * w.t;
    w.ty = ay + dy * w.t;
    if (dx !== 0) { w.ty += w.lane; w.facing = dx > 0 ? "se" : "nw"; }
    else if (dy !== 0) { w.tx += w.lane; w.facing = dy > 0 ? "sw" : "ne"; }
    w.frame = 1 + (Math.floor(w.dist * 3) & 1);
  }

  function update(dt, viewport) {
    if (!(dt > 0)) dt = 0;
    const vp = viewport || { x0: 0, y0: 0, x1: world.w, y1: world.h };
    for (const w of active) {
      if (w.kind === "camper") { w.frame = 0; continue; }
      step(w, dt);
    }
    for (let k = active.length - 1; k >= 0; k--) if (active[k].done) remove(k);
    if (dt > 0) sample(vp);
  }

  function list() {
    return active;
  }

  function setWorld(nw) {
    world = nw;
    active = [];
    activeIds.clear();
    cursor = 0;
    lastTick = -1;
    resize();
  }

  return { update, list, notify, setWorld, get count() { return active.length; } };
}
