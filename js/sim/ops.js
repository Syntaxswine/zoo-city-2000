// ops.js — every player action, logged, costed, undoable. SPEC §11, §15.
//
// The renderer/input layer builds an op; `apply` validates it, charges the
// treasury through budget.post (the only cash path), records it in
// world.log with the tick (the input log check.mjs replays), and keeps a
// one-step snapshot for `undo`. The Options cheat is an op too ("cheat"):
// a lump posted under its own ledger key, logged, replayed, never undone.

import { KNOBS } from "./rules.js";
import { TERRAIN, ROAD, ZONE, CIVIC, idx, inBounds } from "./world.js";
import { post, canSpend, exitReceivership } from "./budget.js";
import { clearLot, invalidatePaths, releaseJob } from "./citizens.js";
import { resolveChoice } from "./events.js";
import { refreshLast } from "./tick.js";

const C = KNOBS.COST;

function rect(world, op) {
  const x0 = Math.max(0, Math.min(op.x0, op.x1));
  const x1 = Math.min(world.w - 1, Math.max(op.x0, op.x1));
  const y0 = Math.max(0, Math.min(op.y0, op.y1));
  const y1 = Math.min(world.h - 1, Math.max(op.y0, op.y1));
  const out = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push(y * world.w + x);
  return out;
}

const isBuilt = (world, i) => world.tier[i] > 0 || world.burning[i] || world.rubble[i];

/** What an op would do: { cost, tiles: [{i, cost, what}], reason }. */
export function costOf(world, op) {
  const tiles = [];
  let cost = 0;
  let replaced = 0;
  let evicts = 0;
  const add = (i, c, what) => { tiles.push({ i, cost: c, what }); cost += c; };
  switch (op.kind) {
    case "zone": {
      const zc = op.zone === ZONE.R ? C.zoneR : op.zone === ZONE.C ? C.zoneC : op.zone === ZONE.M ? C.zoneM : C.zoneI;
      for (const i of rect(world, op)) {
        if (world.terrain[i] === TERRAIN.WATER || world.road[i] || world.civic[i]) continue;
        if (isBuilt(world, i)) continue;
        if (world.zone[i] === op.zone && world.maxTier[i] === (op.density || 3)) continue;
        let c = zc;
        if (world.terrain[i] === TERRAIN.TREE) c += C.bulldozeTree;
        add(i, c, "zone");
      }
      break;
    }
    case "road": {
      for (const i of op.tiles || []) {
        if (!(i >= 0 && i < world.w * world.h)) continue;
        if (world.road[i] || world.civic[i] || isBuilt(world, i)) continue;
        let c = world.terrain[i] === TERRAIN.WATER ? C.bridge : C.road;
        if (world.terrain[i] === TERRAIN.TREE) c += C.bulldozeTree;
        add(i, c, world.terrain[i] === TERRAIN.WATER ? "bridge" : "road");
        if (world.zone[i]) replaced++; // an empty zoned lot under the road: the strip says so
      }
      break;
    }
    case "bulldoze": {
      for (const i of rect(world, op)) {
        if (world.terrain[i] === TERRAIN.WATER && !world.road[i]) continue;
        if (world.road[i]) { add(i, C.bulldoze, "road"); continue; }
        if (world.civic[i]) {
          add(i, C.bulldoze, "civic");
          // A centre with animals in its beds: releasing them is not undoable (tiles, never people).
          if (world.civic[i] === CIVIC.CENTRE) for (const cz of world.citizens) if (cz.heldAt === i && !cz.dead) evicts++;
          continue;
        }
        if (isBuilt(world, i)) { add(i, C.bulldoze, "building"); if (world.occupants[i] || world.staff[i]) evicts++; continue; }
        if (world.zone[i]) { add(i, 0, "unzone"); continue; }
        if (world.terrain[i] === TERRAIN.TREE) { add(i, C.bulldozeTree, "tree"); continue; }
      }
      break;
    }
    case "tree": {
      for (const i of rect(world, op)) {
        if (world.terrain[i] !== TERRAIN.GRASS || world.road[i] || world.zone[i] || world.civic[i]) continue;
        add(i, C.tree, "tree");
      }
      break;
    }
    case "park": case "fire": case "police": case "centre": {
      const i = idx(world, op.tx, op.ty);
      if (!inBounds(world, op.tx, op.ty) || world.terrain[i] === TERRAIN.WATER || world.road[i] || world.zone[i] || world.civic[i]) return { cost: 0, tiles, reason: "blocked" };
      add(i, C[op.kind] + (world.terrain[i] === TERRAIN.TREE ? C.bulldozeTree : 0), op.kind);
      break;
    }
    case "zoo": {
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const tx = op.tx + dx;
        const ty = op.ty + dy;
        if (!inBounds(world, tx, ty)) return { cost: 0, tiles, reason: "blocked" };
        const i = idx(world, tx, ty);
        if (world.terrain[i] === TERRAIN.WATER || world.road[i] || world.zone[i] || world.civic[i]) return { cost: 0, tiles, reason: "blocked" };
        add(i, (dx || dy ? 0 : C.zoo) + (world.terrain[i] === TERRAIN.TREE ? C.bulldozeTree : 0), dx || dy ? "zooPart" : "zoo");
      }
      break;
    }
    default:
      return { cost: 0, tiles };
  }
  // `replaced`: empty zoned lots a road will take (no refund; the chalk was
  // a few §). `evicts`: built lots with animals in them; a bulldoze that
  // displaces citizens is NOT undoable (undo restores tiles, never people).
  return { cost, tiles, replaced, evicts };
}

function snapshot(world, tiles) {
  return tiles.map(({ i }) => ({
    i,
    terrain: world.terrain[i], road: world.road[i], zone: world.zone[i], maxTier: world.maxTier[i],
    tier: world.tier[i], civic: world.civic[i], rubble: world.rubble[i],
  }));
}

/** Apply an op. Returns { ok, cost, reason }. */
export function apply(world, op, { log = true } = {}) {
  // Non-tile ops first.
  if (op.kind === "rate") {
    const v = Math.max(0, Math.min(20, Math.round(op.value)));
    if (!["R", "C", "I"].includes(op.zone)) return { ok: false, cost: 0, reason: "bad zone" };
    world.rates[op.zone] = v;
    if (log) world.log.push({ t: world.tick, op: { kind: "rate", zone: op.zone, value: v } });
    if (world.last) refreshLast(world); // the Budget tab follows the stepper at once
    return { ok: true, cost: 0 };
  }
  if (op.kind === "toggle") {
    world.events[op.key] = !!op.value;
    if (log) world.log.push({ t: world.tick, op: { kind: "toggle", key: op.key, value: !!op.value } });
    return { ok: true, cost: 0 };
  }
  if (op.kind === "cheat") {
    // The Options cheat: a lump of cash. budget.post books it under "cheat"
    // (still the only cash path), the log records it like a zoning drag, and
    // it is never undoable. If it clears a receivership the books come back
    // at once (SPEC §8). The amount is clamped: a hand-edited log cannot
    // post Infinity.
    const a = Math.round(Math.max(0, Math.min(KNOBS.CHEAT_MAX, Number(op.amount) || KNOBS.CHEAT_CASH)));
    if (!a) return { ok: false, cost: 0, reason: "nothing to do" };
    post(world, "cheat", a);
    const notice = world.flags.receivership && world.cash >= 0 ? exitReceivership(world) : null;
    if (log) world.log.push({ t: world.tick, op: { kind: "cheat", amount: a } });
    if (world.last) refreshLast(world); // the strip's net/yr and the Budget tab read the treasury at once
    return { ok: true, cost: 0, amount: a, notice };
  }
  if (op.kind === "choice") {
    const line = resolveChoice(world, !!op.accept);
    if (log) world.log.push({ t: world.tick, op: { kind: "choice", accept: !!op.accept } });
    return { ok: true, cost: 0, reason: line };
  }
  const plan = costOf(world, op);
  if (plan.reason) return { ok: false, cost: 0, reason: plan.reason };
  if (!plan.tiles.length) return { ok: false, cost: 0, reason: "nothing to do" };
  const can = canSpend(world, plan.cost);
  if (!can.ok) return { ok: false, cost: plan.cost, reason: can.reason };

  const snap = snapshot(world, plan.tiles);
  let roads = false;
  for (const { i, what } of plan.tiles) {
    switch (op.kind) {
      case "zone":
        if (world.terrain[i] === TERRAIN.TREE) world.terrain[i] = TERRAIN.GRASS;
        world.zone[i] = op.zone;
        world.maxTier[i] = op.density === 1 ? 1 : 3;
        world.tier[i] = 0;
        break;
      case "road":
        if (world.terrain[i] === TERRAIN.TREE) world.terrain[i] = TERRAIN.GRASS;
        world.road[i] = what === "bridge" ? ROAD.BRIDGE : ROAD.ROAD;
        world.zone[i] = ZONE.NONE;
        world.maxTier[i] = 3;
        roads = true;
        break;
      case "bulldoze":
        if (what === "road") { world.road[i] = ROAD.NONE; roads = true; }
        else if (what === "civic") removeCivic(world, i);
        else if (what === "building") {
          // Unzone FIRST: clearLot rehomes the family by bestHome(), which
          // would otherwise see this very lot as a freshly vacated R lot and
          // move them straight back in (the play-tester's ghost residents).
          world.tier[i] = 0; world.zone[i] = ZONE.NONE; world.rubble[i] = 0; world.burning[i] = 0; world.maxTier[i] = 3;
          clearLot(world, i);
        }
        else if (what === "unzone") { world.zone[i] = ZONE.NONE; world.maxTier[i] = 3; }
        else if (what === "tree") world.terrain[i] = TERRAIN.GRASS;
        break;
      case "tree":
        world.terrain[i] = TERRAIN.TREE;
        break;
      case "park":
        world.terrain[i] = TERRAIN.GRASS;
        world.civic[i] = CIVIC.PARK;
        break;
      case "fire":
        world.terrain[i] = TERRAIN.GRASS;
        world.civic[i] = CIVIC.FIRE;
        break;
      case "police":
        world.terrain[i] = TERRAIN.GRASS;
        world.civic[i] = CIVIC.POLICE;
        break;
      case "centre":
        world.terrain[i] = TERRAIN.GRASS;
        world.civic[i] = CIVIC.CENTRE;
        break;
      case "zoo":
        world.terrain[i] = TERRAIN.GRASS;
        world.civic[i] = what === "zoo" ? CIVIC.ZOO : CIVIC.ZOO_PART;
        break;
      default:
        break;
    }
  }
  if (roads) { world.roadsDirty = true; invalidatePaths(world); }
  post(world, "build", -plan.cost);
  world.undoStack = plan.evicts ? [] : [{ op, snap, cost: plan.cost, roads, t: world.tick }];
  if (log) world.log.push({ t: world.tick, op: stripOp(op) });
  return { ok: true, cost: plan.cost, replaced: plan.replaced, evicts: plan.evicts, undoable: !plan.evicts };
}

function removeCivic(world, i) {
  const c = world.civic[i];
  if (c === CIVIC.PARK) { world.civic[i] = CIVIC.NONE; return; }
  if (c === CIVIC.FIRE || c === CIVIC.POLICE || c === CIVIC.CENTRE) {
    for (const cz of world.citizens) if (cz.job === i) releaseJob(world, cz);
    world.staff[i] = 0;
    // Bulldozing the centre sends its inmates home early, unfixed.
    if (c === CIVIC.CENTRE) for (const cz of world.citizens) if (cz.heldAt === i) { cz.held = 0; cz.heldAt = -1; }
    world.civic[i] = CIVIC.NONE;
    return;
  }
  // Zoo: find the anchor and clear all four.
  const { w } = world;
  const tx = i % w;
  const ty = (i / w) | 0;
  for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) {
    const ax = tx + dx;
    const ay = ty + dy;
    if (!inBounds(world, ax, ay) || world.civic[idx(world, ax, ay)] !== CIVIC.ZOO) continue;
    const a = idx(world, ax, ay);
    // Fire the zoo's workers.
    for (const cz of world.citizens) if (cz.job === a) { cz.job = -1; cz.path = null; cz.hired = -1; world.staff[a]--; }
    for (let yy = 0; yy < 2; yy++) for (let xx = 0; xx < 2; xx++) {
      if (inBounds(world, ax + xx, ay + yy)) world.civic[idx(world, ax + xx, ay + yy)] = CIVIC.NONE;
    }
    return;
  }
  world.civic[i] = CIVIC.NONE;
}

function stripOp(op) {
  const o = { ...op };
  if (o.tiles) o.tiles = Array.from(o.tiles);
  return o;
}

/** One-step undo of the last tile op: restore tiles, refund. */
export function undo(world) {
  const u = world.undoStack && world.undoStack.pop();
  if (!u) return { ok: false, reason: "nothing to undo" };
  if (u.t !== world.tick) { world.undoStack = []; return { ok: false, reason: "too late — the month has turned" }; }
  for (const s of u.snap) {
    if (world.tier[s.i] > 0 && s.tier === 0) continue; // something grew here since; leave it
    world.terrain[s.i] = s.terrain; world.road[s.i] = s.road; world.zone[s.i] = s.zone; world.maxTier[s.i] = s.maxTier;
    world.tier[s.i] = s.tier; world.civic[s.i] = s.civic; world.rubble[s.i] = s.rubble;
  }
  if (u.roads) { world.roadsDirty = true; invalidatePaths(world); }
  post(world, "build", u.cost);
  world.log.push({ t: world.tick, op: { kind: "undo" } });
  return { ok: true };
}

/** The L-shaped road path from (ax, ay) to (bx, by): horizontal leg first. */
export function roadL(world, ax, ay, bx, by, straight = false) {
  const tiles = [];
  const push = (x, y) => { if (inBounds(world, x, y)) tiles.push(idx(world, x, y)); };
  if (straight) {
    if (Math.abs(bx - ax) >= Math.abs(by - ay)) by = ay; else bx = ax;
  }
  const sx = Math.sign(bx - ax) || 1;
  for (let x = ax; x !== bx + sx; x += sx) push(x, ay);
  const sy = Math.sign(by - ay) || 1;
  if (by !== ay) for (let y = ay + sy; y !== by + sy; y += sy) push(bx, y);
  return tiles;
}

/** Replay an op from the input log (no re-logging). */
export function replay(world, entry) {
  if (entry.op.kind === "undo") return undo(world);
  return apply(world, entry.op, { log: false });
}
