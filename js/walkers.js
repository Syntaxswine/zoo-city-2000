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
// walk to the road between their homes and stand together ~4 s), predation
// (the month's killer walks to the neighbour's door, a sack falls over the
// neighbour and is tied, and the killer walks home with it over a shoulder —
// cued by `world.predations`, which justice.kill publishes before the victim
// is scrubbed; the figure in the sack is a record, not a citizen).

import { ROAD, CIVIC, civicAnchorOf, ZONE, TERRAIN, inBounds, anchorOf, absent } from "./sim/world.js";
import { ageYears } from "./sim/census.js";
import { SPECIES_BY_ID } from "./sim/species.js";
import { hash01 } from "./sim/rng.js";
import { doorsOf, edgeRoads } from "./sim/fields.js";
import { KNOBS } from "./sim/rules.js";
import { art } from "./art/index.js";
import { BUBBLES_MAX, NEED_REACH, needOf, needsContext } from "./sim/needs.js";

export const MAX_WALKERS = 150;
const SPAWN_PER_UPDATE = 3;
const MEET_STAND = 4; // seconds
const JOB_STAND = 1.5;
const HOME_STAND = 1.0;
const STROLL_STAND = 3.0;
const BAG_STAND = 2.4; // seconds at the neighbour's door: the sack falls, then it is tied
export const BAG_FALL = 0.45; // the fraction of that stand the sack is in the air (the renderer reads it)
const PREY_STEP = 0.32; // tiles past the door the neighbour stands, along the killer's last step
const CARRY_SPEED = 0.8; // a full sack is heavy
const ADULT = KNOBS.ADULT_AGE;

const N4 = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W — the same fixed order as fields.doorSearch

export function createWalkers(initialWorld) {
  let world = initialWorld;
  let active = [];
  const activeIds = new Set(); // citizen ids with a walker (kinds bound to a citizen)
  let cursor = 0; // round-robin over world.citizens
  let lastTick = -1;
  let nextFake = -1; // ids for departure walkers (negative: never a citizen)
  let pending = []; // predations not yet on the map (the killer's other walker is released first); each carries `until`, a tick
  let needCursor = null; // [tx, ty] only while Inspect is active
  let pinnedNeed = null; // a pinned citizen's walker is kept in the eight
  let needSig = "";

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

  /**
   * A door of the lot at i, or -1. The RULE is fields.doorsOf - one
   * implementation for the sim and the street, so a walker never sets off
   * from a side the commute does not use. It has to be doorsOf and not the
   * raw doorSearch: a PLATFORM is asked a different question (`passable`, not
   * the bare-wall default), and calling the search directly meant the street
   * would have used the wrong rule the moment a walker was given one. Only
   * the scratch is ours - the boundary law above forbids this layer a buffer
   * on the world, and doorsOf takes the seen array from its caller for
   * exactly that reason. A commuter needs none of this; its walk starts at
   * its stored path's first tile, which IS the door the search chose.
   */
  function door(i) {
    if (i < 0) return -1;
    resize();
    const doors = doorsOf(world, i, seen);
    return doors.length ? doors[0] : -1;
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
  const isZoo = (i) => world.civic[civicAnchorOf(world, i)] === CIVIC.LARGE_PARK;
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
      look: opts.look || art.look(id),
      need: null,
      name: c ? `${c.name} ${c.surname}` : opts.name || "",
      hat: !!(c && c.centenary),
      legs, // [{ path: [tiles], stand: seconds }]
      leg: 0,
      seg: 0,
      t: 0,
      dist: 0,
      standUntil: opts.standFirst || 0,
      idle: 0, // seconds continuously standing; >1 selects Part D's fourth pose
      speed: speedOf(species, age),
      lane: (hash01(id | 0, 7, 0x1a2b) - 0.5) * 0.36,
      tx: 0,
      ty: 0,
      facing: "se",
      frame: 0,
      release: false,
      riding: false, // on a rail segment: ×RIDE_SPEED and drawn up on the train
      prey: null, // predation: { species, age, look, name, tx, ty, facing } — the neighbour at the door
      bag: null, // predation: 0..1 through the stand at the door (null when not standing there)
      carry: null, // 'sack' once the killer turns for home
      preyName: "", // predation: who is in the sack (the card)
      glyph: opts.glyph || null,
      tent: !!opts.tent,
      tile: opts.tile ?? -1,
      home0: c ? c.home : -1,
      job0: c ? c.job : -1,
      done: false,
      heldAt0: c ? c.heldAt : -1,
      companion: opts.companion || null,
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
    // The path carries the ride bit (fields.RIDE) on the tiles the citizen rode onto; the walker keeps a parallel flag per tile.
    const out = Array.from(c.path, (p) => p & 0x7fff);
    const ride = Array.from(c.path, (p) => (p & 0x8000) !== 0);
    const back = out.slice().reverse();
    const rideBack = ride.slice().reverse();
    return add(make("commuter", c, [{ path: out, ride, stand: JOB_STAND }, { path: back, ride: rideBack, stand: HOME_STAND }]));
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

  /** Unpack the sim's immutable RIDE-tagged route without changing it. */
  function transportLeg(raw, stand = 0) {
    const tagged = Array.from(raw || []);
    return {
      path: tagged.map((p) => p & 0x7fff),
      ride: tagged.map((p) => (p & 0x8000) !== 0),
      stand,
    };
  }

  function reverseLeg(leg, stand = leg.stand) {
    return { path: leg.path.slice().reverse(), ride: leg.ride.slice().reverse(), stand };
  }

  /** A hall worker pulls the exact route selected by meat.js, out and back. */
  function spawnCart(trip) {
    const homeToHall = transportLeg(trip.path, 0.8);
    if (!homeToHall.path.length) return null;
    const out = reverseLeg(homeToHall, 1.2); // hall → door
    const back = { ...homeToHall, stand: HOME_STAND }; // door → hall
    const staff = world.citizens
      .filter((c) => !c.dead && !c.pen && c.job >= 0 && anchorOf(world, c.job) === anchorOf(world, trip.hall))
      .sort((a, b) => a.id - b.id)[0] || null;
    // A busy real staffer keeps the existing walker; its cart duplicate is a
    // cosmetic proxy with the same species, name and stable coat.
    const real = staff && !activeIds.has(staff.id) ? staff : null;
    const subject = trip.subject || {};
    const opts = real ? {} : {
      id: nextFake--,
      species: staff?.species || subject.species || "fox",
      age: staff ? ageOf(staff) : "adult",
      name: staff ? `${staff.name} ${staff.surname}` : "the hall cart",
      look: staff ? art.look(staff.id) : undefined,
    };
    const w = make("cart", real, [out, back], opts);
    w.carry = "cart";
    w.speed *= CARRY_SPEED;
    w.trip = trip.id;
    if (trip.kind === "pen" && subject.id != null) {
      w.companion = { id: subject.id, species: subject.species, name: subject.name, age: "cub", look: art.look(subject.id) };
    }
    return add(w);
  }

  /** A penned cub is a standing, clickable mirror of sim state. */
  function spawnPenned(c) {
    const tile = door(c.heldAt);
    if (tile < 0) return null;
    return add(make("penned", c, [], { tile, facing: (c.id & 1) ? "sw" : "se" }));
  }

  /**
   * The killing, as the street sees it: the killer walks from its own door
   * to the neighbour's, stands there BAG_STAND seconds while the sack falls
   * and is tied, then walks home with it. The neighbour stands PREY_STEP past
   * the door along the killer's last step, facing the killer. Returns "ok",
   * "wait" (the killer already has a walker — it is released, and this is
   * retried every frame for up to two months), or "drop".
   */
  function spawnPredation(rec) {
    const c = world.byId.get(rec.killer);
    if (!c || c.dead || c.home < 0) return "drop";
    if (activeIds.has(rec.killer)) return "wait";
    const dv = door(rec.victimHome);
    let dk = door(c.home);
    if (dv < 0 || dk < 0) return "drop";
    if (dk === dv) {
      // The same door: the killer comes in from the next road tile along.
      const step1 = roadSearch(dv, (j) => j !== dv, 3);
      dk = step1 && step1.length >= 2 ? step1[step1.length - 1] : -1;
      if (dk < 0) return "drop";
    }
    const there = roadPath(dk, dv);
    if (!there || there.length < 2) return "drop";
    const legs = [{ path: there, stand: BAG_STAND }];
    if (rec.hall >= 0 && rec.sackPath?.length) {
      legs.push(transportLeg(rec.sackPath, 0.8));
      if (rec.homePath?.length) legs.push(reverseLeg(transportLeg(rec.homePath), HOME_STAND));
    } else {
      legs.push({ path: there.slice().reverse(), stand: HOME_STAND });
    }
    const w = make("predation", c, legs);
    const [ax, ay] = centre(there[there.length - 2]);
    const [bx, by] = centre(there[there.length - 1]);
    const dx = Math.sign(bx - ax);
    const dy = Math.sign(by - ay);
    const v = rec.victim;
    const age = v.age < ADULT ? "cub" : v.age >= SPECIES_BY_ID[v.species].retire ? "elder" : "adult";
    // The neighbour faces the killer: the opposite of the facing the last step gives the killer.
    const facing = dx > 0 ? "nw" : dx < 0 ? "se" : dy > 0 ? "ne" : "sw";
    // `v` is a compact record because justice has already removed the victim;
    // the pure id hash preserves the exact coat that stood here while alive.
    w.prey = { species: v.species, age, look: art.look(v.id), name: v.name, tx: bx + dx * PREY_STEP, ty: by + dy * PREY_STEP, facing };
    w.preyName = v.name; // outlives w.prey: the card names who is in the sack all the way home
    return add(w) ? "ok" : "drop";
  }

  /** Put this month's predations on the map as their killers' walkers free up. */
  function flushPending() {
    if (!pending.length) return;
    const keep = [];
    for (const rec of pending) {
      if (active.length >= MAX_WALKERS) { keep.push(rec); continue; }
      if (spawnPredation(rec) === "wait") {
        for (const w of active) if (w.citizen === rec.killer) w.release = true;
        keep.push(rec);
      }
    }
    pending = keep;
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
      if (world.road[j] === ROAD.NONE && world.terrain[j] !== TERRAIN.WATER && !world.zone[j] && !world.civic[j] && !world.wall[j]) return j;
    }
    return r;
  }

  function spawnCamper(cp, k) {
    const tile = cp.tile ?? campSite(k);
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
      if (c?.pen && w.kind !== "penned") { remove(k); continue; }
      const changed = !c || c.home !== w.home0 || (w.kind === "penned" && (!c.pen || c.heldAt !== w.heldAt0)) || (w.kind === "commuter" && c.job !== w.job0) || (w.kind === "commuter" && !c.path);
      if (changed) {
        w.release = true;
        if (w.standUntil > 0 || !w.legs.length) remove(k);
      }
    }

    // Once per tick: arrivals, departures, meetings, campers.
    if (world.tick !== lastTick) {
      lastTick = world.tick;
      // Pens and collections are state readers. Failure to draw because the
      // cosmetic cap is full never changes stock, cash, custody or hashes.
      for (const c of world.citizens) {
        if (active.length >= MAX_WALKERS) break;
        if (c.pen && !activeIds.has(c.id)) spawnPenned(c);
      }
      for (const trip of world.meatTrips || []) {
        if (active.length >= MAX_WALKERS) break;
        spawnCart(trip);
      }
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
      // The month's killings: the sack. The list is per-tick (justice.kill);
      // a record waits for its killer's walker to free up for at most two
      // months (a month is 1.5 s at ×1; a walker is released at its NEXT
      // tile centre), then is dropped.
      pending = pending.filter((r) => r.until > world.tick);
      for (const rec of world.predations || []) pending.push({ ...rec, until: world.tick + 2 });
      flushPending();
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
      if (absent(world, c)) continue; // in the cells, centre, or a hall pen
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
    let seconds = dt;
    while (seconds > 1e-12 && !w.done) {
      const leg = w.legs[w.leg];
      if (!leg) { w.done = true; return; }
      if (w.standUntil > 0) {
        w.riding = false;
        const used = Math.min(seconds, w.standUntil);
        w.standUntil -= used;
        w.idle += used;
        seconds -= used;
        w.frame = w.idle > 1 ? 3 : 0;
        if (w.kind === "predation" && w.leg === 0) w.bag = Math.min(1, Math.max(0, 1 - w.standUntil / BAG_STAND));
        if (w.standUntil > 1e-12) return;
        // Stand over: next leg, or done. A long frame keeps its unused time,
        // so an arrival at a platform cannot donate walk-speed time to rail.
        w.standUntil = 0;
        if (w.release) { w.done = true; return; }
        if (w.kind === "scout") {
          const p = leg.path;
          w.legs = [{ path: scoutLeg(w, p[p.length - 1], p.length > 1 ? p[p.length - 2] : -1), stand: 0 }];
          w.leg = 0; w.seg = 0; w.t = 0;
          continue;
        }
        w.leg++;
        w.seg = 0;
        w.t = 0;
        w.idle = 0;
        if (w.kind === "predation" && w.leg === 1) {
          // The sack is tied: it goes over the shoulder, the neighbour is not drawn again.
          w.bag = null;
          w.prey = null;
          w.carry = "sack";
          w.speed *= CARRY_SPEED;
        }
        if (w.leg >= w.legs.length) w.done = true;
        continue;
      }
      const path = leg.path;
      if (path.length < 2) { w.standUntil = leg.stand || 0.01; w.idle = 0; continue; }
      w.idle = 0;
      const rd = leg.ride;
      const onRail = !!(rd && (rd[w.seg] || rd[w.seg + 1])); // a segment touching a ridden tile is a ride
      w.riding = onRail;
      const speed = w.speed * (onRail ? KNOBS.RIDE_SPEED : 1);
      const rem = 1 - w.t;
      const used = Math.min(seconds, rem / speed);
      const distance = used * speed;
      w.t += distance;
      seconds -= used;
      w.dist += distance;
      if (w.t >= 1 - 1e-9) {
        w.seg++;
        w.t = 0;
        if (w.release) { w.done = true; return; }
        if (w.seg >= path.length - 1) {
          [w.tx, w.ty] = centre(path[path.length - 1]);
          w.standUntil = Math.max(leg.stand, 0.01);
          w.riding = false;
          w.frame = 0;
          w.idle = 0;
          if (w.kind === "scout") w.standUntil = 0.4;
          continue;
        }
        continue;
      }
    }
    // The interval may end exactly on a segment boundary. Resolve pose from
    // the new segment after the loop so the figure never spends a frame at
    // its previous coordinate or with the previous segment's ride state.
    if (w.done || w.standUntil > 0) { w.riding = false; return; }
    const leg = w.legs[w.leg];
    const path = leg?.path;
    if (!path || path.length < 2 || w.seg >= path.length - 1) return;
    const rd = leg.ride;
    w.riding = !!(rd && (rd[w.seg] || rd[w.seg + 1]));
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
      if (w.kind === "camper" || w.kind === "penned") { w.idle += dt; w.frame = w.idle > 1 ? 3 : 0; continue; }
      step(w, dt);
    }
    for (let k = active.length - 1; k >= 0; k--) if (active[k].done) remove(k);
    flushPending(); // before the sampler, so a freed killer is the sack's and not a commuter's
    if (dt > 0) sample(vp);
  }

  function list() {
    refreshNeeds();
    return active;
  }

  /**
   * Attach need CODES to the nearest eight real citizens under Inspect. Text
   * remains outside the walker state; render/card resolve the same code.
   */
  function refreshNeeds() {
    const positions = active.map((w) => `${w.id}:${Math.floor(w.tx)},${Math.floor(w.ty)}`).join(";");
    const sig = `${world.tick}|${needCursor ? needCursor.join(",") : "-"}|${pinnedNeed ?? "-"}|${positions}`;
    if (sig === needSig) return;
    needSig = sig;
    for (const w of active) w.need = null;
    if (!needCursor && pinnedNeed == null) return;
    const [cx, cy] = needCursor || [0, 0];
    const eligible = [];
    for (const w of active) {
      if (w.citizen == null || !world.byId?.has(w.citizen)) continue;
      const dx = w.tx - (cx + 0.5);
      const dy = w.ty - (cy + 0.5);
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      if ((needCursor && d <= NEED_REACH) || w.citizen === pinnedNeed) eligible.push({ w, d, d2: dx * dx + dy * dy });
    }
    eligible.sort((a, b) => a.d2 - b.d2 || a.w.id - b.w.id);
    let chosen = eligible.slice(0, BUBBLES_MAX);
    const pin = eligible.find((e) => e.w.citizen === pinnedNeed);
    if (pin && !chosen.includes(pin)) { chosen = chosen.slice(0, BUBBLES_MAX - 1); chosen.push(pin); }
    const context = needsContext(world);
    for (const { w } of chosen) {
      const c = world.byId.get(w.citizen);
      w.need = needOf(world, c, context).code;
    }
  }

  function setCursor(tile, pinnedCitizen = null) {
    const next = Array.isArray(tile) ? [tile[0], tile[1]] : null;
    const pin = Number.isInteger(pinnedCitizen) ? pinnedCitizen : null;
    if ((!next && !needCursor || next && needCursor && next[0] === needCursor[0] && next[1] === needCursor[1]) && pin === pinnedNeed) return;
    needCursor = next;
    pinnedNeed = pin;
    needSig = "";
  }

  function setWorld(nw) {
    world = nw;
    active = [];
    activeIds.clear();
    pending = [];
    cursor = 0;
    lastTick = -1;
    needCursor = null;
    pinnedNeed = null;
    needSig = "";
    resize();
  }

  return { update, list, notify, setCursor, setWorld, get count() { return active.length; } };
}
