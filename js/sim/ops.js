// ops.js — every player action, logged, costed, undoable. SPEC §11, §15.
//
// The renderer/input layer builds an op; `apply` validates it, charges the
// treasury through budget.post (the only cash path), records it in
// world.log with the tick (the input log check.mjs replays), and keeps a
// one-step snapshot for `undo`. The Options cheat is an op too ("cheat"):
// a lump posted under its own ledger key, logged, replayed, never undone.

import { campAt } from "./camps.js";
import { KNOBS } from "./rules.js";
import { TERRAIN, ROAD, ZONE, CIVIC, idx, inBounds, anchorOf, footprintOf, civicAnchorOf, civicTiles } from "./world.js";
import { post, canSpend, exitReceivership } from "./budget.js";
import { clearLot, invalidatePaths, releaseJob, replanStale } from "./citizens.js";
import { resolveChoice } from "./events.js";
import { refreshLast } from "./tick.js";
import { computeOcclusion } from "./reach.js";
import { computeRoadDist, computeStationDoors, touchesRoad } from "./fields.js";
import { closeHall, hallStock, resetMeatRoutes } from "./meat.js";
import { clampUse } from "./use.js";

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

// ---- the level crossing (SPEC §7.9) ---------------------------------------
// A road and a line may share ONE tile when they cross SQUARE-ON: after the
// op the tile's road runs straight on one axis and its line straight on the
// other. Never on water or a bridge (a deck carries one way), never under a
// wall (a tunnel is open along ONE axis, and a crossing has two), never a
// station (the platform stands on the track). The masks are read AFTER THE
// WHOLE DRAG, never tile by tile: an L-drag's own arm is half of what makes
// its road straight, so a per-tile test would refuse every crossing a player
// ever draws.
//
// And a crossing KEEPS its two straight runs: an op that would give one an
// arm is refused too. That second half is NOT implied by the first — this
// was claimed and was wrong. A road laid one tile east of a crossing, on the
// line, is itself square-on and still makes a T-junction of its neighbour;
// and after the bulldozer takes the line east of a crossing, that tile is
// bare ground the first rule never looks at. The one thing that can still
// take square-on away is the BULLDOZER removing a road or a line beside a
// crossing — no rule can stop that without trapping the player — so the tile
// becomes a road and a line sharing ground, the art draws the stub it has
// become (which is why the family is 512 sprites and not four), and nothing
// in the sim minds. What an op may never do is take it away.
const CROSS_REASON = "a crossing must be square-on — a straight road across a straight line";
const M_N = 1, M_E = 2, M_S = 4, M_W = 8;
const M_NS = M_N | M_S, M_EW = M_E | M_W;

/** The 4-bit mask of `layer` round tile i (N=1 E=2 S=4 W=8), counting the tiles in `also` as present. */
export function maskAround(world, layer, also, i) {
  const { w, h } = world;
  const tx = i % w;
  const ty = (i / w) | 0;
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && (layer[y * w + x] !== 0 || (also !== null && also.has(y * w + x)));
  return (on(tx, ty - 1) ? M_N : 0) | (on(tx + 1, ty) ? M_E : 0) | (on(tx, ty + 1) ? M_S : 0) | (on(tx - 1, ty) ? M_W : 0);
}

/** Square-on: both runs straight, on different axes. The whole rule, in one line. */
export function squareOn(roadMask, railMask) {
  return (roadMask === M_NS && railMask === M_EW) || (roadMask === M_EW && railMask === M_NS);
}

/**
 * Could this tile carry a road AND a line at all, whatever the masks say?
 * The whole rule in one place, so it reads the same from either op. Each op
 * reaches only part of it — the road op meets a tunnel (`wall`) and a station
 * (`rail` 2), the rail op meets a tunnel — and refuses water, chalk, a civic
 * and a building on its own line above; the rest is this predicate saying the
 * rule out loud rather than leaving it to be inferred from two other lists.
 */
function crossable(world, i) {
  return world.terrain[i] !== TERRAIN.WATER && world.road[i] !== ROAD.BRIDGE && !world.wall[i] && world.rail[i] !== 2 && !world.civic[i] && !world.zone[i] && !isBuilt(world, i);
}

/**
 * Judge the crossings a drag would make AND the crossings it would disturb,
 * on the drag's OWN result. `laying` is "road" or "rail" — the layer this op
 * puts down; `lay` is every tile it will put it on, and counts toward THAT
 * layer's mask. Returns the tiles to drop:
 *   - a tile that becomes a crossing which is not square-on, and
 *   - a tile whose new arm would leave a NEIGHBOURING crossing crooked.
 * A crossing the bulldozer has already left crooked is judged the same way:
 * beside it, the only ops allowed are the ones that make it square-on again,
 * and one press of the bulldozer on the crossing itself clears the line.
 * Every mask is read from the surviving set, and the whole CANDIDATE list is
 * re-judged each round until the answer settles. It has to be a fixpoint over
 * the candidates and not one downward pass: the first draft judged one round
 * and threw away a perfectly square-on crossing, because the L-drag's other
 * leg — refused for running ALONG the line — had put a phantom third arm on
 * it, and a tile refused in round one was never looked at again. Re-judging
 * lets a tile come BACK once the sibling that condemned it has gone.
 *
 * Legality is not monotone in the set (a tile can turn a neighbour's stub
 * into a straight run, or a straight run into a T), so a pair of candidates
 * could in principle flip each other for ever. `CROSS_ROUNDS` caps it, and
 * whatever set the loop ends on is then pruned DOWNWARD, which only ever
 * removes and so always terminates. `lay` is left holding the survivors and
 * the tiles taken out of it are returned.
 */
const CROSS_ROUNDS = 8;

function refuseCrossings(world, lay, laying) {
  const candidates = [...lay];
  const { w, h } = world;
  /** Would tile i be legal if the op laid exactly `set`? */
  const legal = (i, set) => {
    const alsoRoad = laying === "road" ? set : null;
    const alsoRail = laying === "rail" ? set : null;
    const ok = (j) => squareOn(maskAround(world, world.road, alsoRoad, j), maskAround(world, world.rail, alsoRail, j));
    const other = laying === "road" ? world.rail[i] : world.road[i];
    if (other && !ok(i)) return false; // it would be a crossing, and not square-on
    const tx = i % w;
    const ty = (i / w) | 0;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const x = tx + dx;
      const y = ty + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const j = y * w + x;
      if (world.road[j] && world.rail[j] && !ok(j)) return false; // it would leave a crossing crooked
    }
    return true;
  };
  let cur = new Set(candidates); // NOT `lay` — the loop can break on round 0, and the rebuild below clears it
  for (let round = 0; round < CROSS_ROUNDS; round++) {
    const next = new Set(candidates.filter((i) => legal(i, cur)));
    if (next.size === cur.size && candidates.every((i) => next.has(i) === cur.has(i))) break;
    cur = next;
  }
  for (;;) { // whatever it settled on, make it stable: this only removes
    const bad = candidates.filter((i) => cur.has(i) && !legal(i, cur));
    if (!bad.length) break;
    for (const i of bad) cur.delete(i);
  }
  lay.clear();
  for (const i of candidates) if (cur.has(i)) lay.add(i);
  return candidates.filter((i) => !cur.has(i));
}

/** What an op would do: { cost, tiles: [{i, cost, what}], reason }. */
/**
 * WOULD A BUILDING PUT HERE BE REACHABLE? Asked BEFORE the tile is written, so
 * it answers for ground that is still empty - which is the same ground the
 * building will stand on, because `computeRoadDist` walks through a lot either
 * way. The owner, 2026-09-04: *"any placeable building should be a functional
 * building ... if a building meets the requirements to exist it should be
 * functional."*
 */
export function costOf(world, op) {
  const tiles = [];
  if (["zone", "road", "rail", "station", "wall", "bulldoze", "tree", "park", "largePark", "zoo", "fire", "police", "centre"].includes(op.kind)) {
    const side = ["largePark", "zoo", "fire", "police", "centre"].includes(op.kind) ? 3 : 1;
    const requested = op.tiles || (op.x0 != null ? rect(world, op) : Array.from({ length: side * side }, (_, k) => idx(world, op.tx + k % side, op.ty + Math.floor(k / side))));
    if (requested.some(i => campAt(world, i))) return { cost: 0, tiles, reason: "someone is camping here — provide housing before building" };
  }
  let cost = 0;
  let replaced = 0;
  let evicts = 0;
  const add = (i, c, what) => { tiles.push({ i, cost: c, what }); cost += c; };
  switch (op.kind) {
    case "zone": {
      const zc = op.zone === ZONE.R ? C.zoneR : op.zone === ZONE.C ? C.zoneC : op.zone === ZONE.M ? C.zoneM : C.zoneI;
      for (const i of rect(world, op)) {
        if (world.terrain[i] === TERRAIN.WATER || world.road[i] || world.civic[i] || world.wall[i] || world.rail[i]) continue;
        if (isBuilt(world, i)) continue;
        if (world.zone[i] === op.zone && world.maxTier[i] === (op.density || 3)) continue;
        let c = zc;
        if (world.terrain[i] === TERRAIN.TREE) c += C.bulldozeTree;
        add(i, c, "zone");
      }
      break;
    }
    case "road": {
      const line = (op.tiles || []).filter((i) => i >= 0 && i < world.w * world.h);
      const lay = new Set();
      for (const i of line) {
        if (world.road[i] || world.civic[i] || isBuilt(world, i)) continue;
        if (world.rail[i] && !crossable(world, i)) continue; // a station, a tunnel, a bridge — never a crossing
        lay.add(i);
      }
      const refused = refuseCrossings(world, lay, "road");
      for (const i of line) {
        if (!lay.has(i)) continue;
        let c = world.terrain[i] === TERRAIN.WATER ? C.bridge : C.road;
        if (world.terrain[i] === TERRAIN.TREE) c += C.bulldozeTree;
        add(i, c, world.terrain[i] === TERRAIN.WATER ? "bridge" : world.rail[i] ? "crossing" : "road");
        if (world.zone[i]) replaced++; // an empty zoned lot under the road: the strip says so
      }
      if (!tiles.length && refused.length) return { cost: 0, tiles, reason: CROSS_REASON };
      break;
    }
    case "bulldoze": {
      const taken = new Set(); // a block's tiles, listed once however many the rect touches
      for (const i of rect(world, op)) {
        if (taken.has(i)) continue;
        if (world.terrain[i] === TERRAIN.WATER && !world.road[i]) continue;
        if (world.wall[i]) { add(i, C.bulldoze, "wall"); continue; } // a tunnel's wall comes down first; the road stays
        if (world.rail[i]) { add(i, C.bulldoze, world.rail[i] === 2 ? "station" : "rail"); continue; }
        if (world.road[i]) { add(i, C.bulldoze, "road"); continue; }
        if (world.civic[i]) {
          const a = civicAnchorOf(world, i);
          for (const j of civicTiles(world, i)) { taken.add(j); add(j, C.bulldoze, "civic"); }
          // Jobs/custody change on demolition, so occupied sites cannot be undone.
          if (world.citizens.some(c => !c.dead && (c.job === a || (c.heldAt === a && c.held > world.tick)))) evicts++;
          continue;
        }
        if (world.big[i]) {
          // A block goes as one building: every tile of its footprint, §2 each; its people are on the anchor.
          const a = anchorOf(world, i);
          for (const j of footprintOf(world, a)) { taken.add(j); add(j, C.bulldoze, "building"); }
          if (world.occupants[a] || world.staff[a] || (world.zone[a] === ZONE.M && (hallStock(world, a) || world.citizens.some((c) => !c.dead && c.pen && anchorOf(world, c.heldAt) === a)))) evicts++;
          continue;
        }
        if (isBuilt(world, i)) {
          add(i, C.bulldoze, "building");
          if (world.occupants[i] || world.staff[i] || (world.zone[i] === ZONE.M && (hallStock(world, i) || world.citizens.some((c) => !c.dead && c.pen && anchorOf(world, c.heldAt) === i)))) evicts++;
          continue;
        }
        if (world.zone[i]) { add(i, 0, "unzone"); continue; }
        if (world.terrain[i] === TERRAIN.TREE) { add(i, C.bulldozeTree, "tree"); continue; }
      }
      break;
    }
    case "tree": {
      for (const i of rect(world, op)) {
        if (world.terrain[i] !== TERRAIN.GRASS || world.road[i] || world.zone[i] || world.civic[i] || world.wall[i] || world.rail[i]) continue;
        add(i, C.tree, "tree");
      }
      break;
    }
    case "park": case "fire": case "police": case "centre": case "largePark": case "zoo": {
      const side = op.kind === "park" ? 1 : 3;
      for (let dy = 0; dy < side; dy++) for (let dx = 0; dx < side; dx++) {
        const tx = op.tx + dx, ty = op.ty + dy;
        if (!inBounds(world, tx, ty)) return { cost: 0, tiles: [], reason: "the whole footprint must fit on the map" };
        const i = idx(world, tx, ty);
        if (world.terrain[i] === TERRAIN.WATER || world.road[i] || world.zone[i] || world.civic[i] || world.wall[i] || world.rail[i] || isBuilt(world, i)) return { cost: 0, tiles: [], reason: "the whole footprint needs clear ground" };
        add(i, (dx || dy ? 0 : C[op.kind]) + (world.terrain[i] === TERRAIN.TREE ? C.bulldozeTree : 0), dx || dy ? "civicPart" : op.kind);
      }
      if (op.kind !== "park" && op.kind !== "largePark" && !touchesRoad(world, tiles.map(t => t.i))) return { cost: 0, tiles: [], reason: "the building must be adjacent to a road" };
      break;
    }
    case "use": {
      // The player's line (SPEC §7.8): a rectangle repaint of lots and roads to
      // A checkbox mask: mixed / predator / prey / fourteen species in any
      // combination, §1 a changed tile. Grass, water, civics and chalk-less
      // ground take no line.
      const v = clampUse(op.use);
      const painted = new Set();
      for (const i of rect(world, op)) {
        if (painted.has(i)) continue;
        if (world.zone[i] === ZONE.NONE && world.road[i] === ROAD.NONE && !(world.rail && world.rail[i])) continue;
        // A block takes one line over its whole footprint (its tiles must agree for the merge and stay agreed after).
        const tiles = world.big[i] ? footprintOf(world, anchorOf(world, i)) : [i];
        for (const j of tiles) {
          painted.add(j);
          if (world.use[j] === v) continue;
          add(j, C.use, "use");
        }
      }
      break;
    }
    case "rail": {
      // Rail is an L-drag like a road (SPEC §7.9): grass or trees (felled), across a wall (a tunnel),
      // square-on across a road (a level crossing); not on water, chalk, a civic or a building — no bridges.
      const line = (op.tiles || []).filter((i) => i >= 0 && i < world.w * world.h);
      const lay = new Set();
      for (const i of line) {
        if (world.rail[i] || world.terrain[i] === TERRAIN.WATER || world.civic[i] || world.zone[i] || isBuilt(world, i)) continue;
        if (world.road[i] && !crossable(world, i)) continue;
        lay.add(i);
      }
      const refused = refuseCrossings(world, lay, "rail");
      for (const i of line) {
        if (!lay.has(i)) continue;
        let c = C.rail;
        if (world.terrain[i] === TERRAIN.TREE) c += C.bulldozeTree;
        add(i, c, world.wall[i] ? "tunnel" : world.road[i] ? "crossing" : "rail");
      }
      if (!tiles.length && refused.length) return { cost: 0, tiles, reason: CROSS_REASON };
      break;
    }
    case "station": {
      // A station is a click on a plain rail tile; it becomes usable when a
      // road reaches it within ROAD_REACH across passable forecourt ground.
      const i = inBounds(world, op.tx, op.ty) ? idx(world, op.tx, op.ty) : -1;
      if (i < 0 || world.rail[i] !== 1) return { cost: 0, tiles, reason: "blocked" };
      if (world.road[i]) return { cost: 0, tiles, reason: "a station cannot stand on a level crossing" }; // the platform would sit in the road
      // A PLATFORM IS THE EXCEPTION, and the owner ruled it so: a line is laid
      // ahead of the town, and a platform no road reaches yet wears the NO ROAD
      // zot, exactly as a house too far from one does. Placeable, visibly idle,
      // and its effects gated by `served` like everything else.
      add(i, C.station, "station");
      break;
    }
    case "wall": {
      // A wall is an L-drag like a road (SPEC §6b); across a road or rail tile it
      // is a TUNNEL. Never on water, chalk, a civic or a building — a wall
      // stands on ground of its own — and never over a level crossing, which
      // has two open axes and a tunnel has one (SPEC §7.9).
      let walled = 0;
      for (const i of op.tiles || []) {
        if (!(i >= 0 && i < world.w * world.h)) continue;
        if (world.wall[i] || world.rail[i] === 2 || world.terrain[i] === TERRAIN.WATER || world.civic[i] || world.zone[i] || isBuilt(world, i)) continue;
        if (world.road[i] && world.rail[i]) { walled++; continue; }
        let c = C.wall;
        if (world.terrain[i] === TERRAIN.TREE) c += C.bulldozeTree;
        add(i, c, world.road[i] || (world.rail && world.rail[i]) ? "tunnel" : "wall");
      }
      if (!tiles.length && walled) return { cost: 0, tiles, reason: "a tunnel is open along one axis — a level crossing has two" };
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
    tier: world.tier[i], civic: world.civic[i], civicSize: world.civicSize[i], rubble: world.rubble[i], wall: world.wall[i], use: world.use[i], rail: world.rail[i], big: world.big[i], theme: world.theme[i],
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
  let walls = false;
  let lines = false; // a use repaint: every commute may prefer another way now
  let rails = false;
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
        else if (what === "wall") { world.wall[i] = 0; walls = true; }
        else if (what === "rail" || what === "station") { world.rail[i] = 0; rails = true; }
        else if (what === "civic") removeCivic(world, i);
        else if (what === "building") {
          // Unzone FIRST: clearLot rehomes the family by bestHome(), which
          // would otherwise see this very lot as a freshly vacated R lot and
          // move them straight back in (the play-tester's ghost residents).
          // A block: the first of its tiles the loop meets clears the whole
          // footprint and its anchor's people; the rest are plain ground by then.
          const a = anchorOf(world, i);
          const tiles = world.big[i] ? footprintOf(world, a) : [i];
          if (world.zone[a] === ZONE.M) closeHall(world, a); // stock spoils explicitly; penned cubs go home alive
          for (const j of tiles) { world.tier[j] = 0; world.zone[j] = ZONE.NONE; world.rubble[j] = 0; world.burning[j] = 0; world.maxTier[j] = 3; world.big[j] = 0; world.theme[j] = 0; }
          clearLot(world, a);
        }
        else if (what === "unzone") { world.zone[i] = ZONE.NONE; world.maxTier[i] = 3; }
        else if (what === "tree") world.terrain[i] = TERRAIN.GRASS;
        break;
      case "tree":
        world.terrain[i] = TERRAIN.TREE;
        break;
      case "park": case "fire": case "police": case "centre": case "largePark": case "zoo": {
        world.terrain[i] = TERRAIN.GRASS;
        const a = idx(world, op.tx, op.ty), dx = i % world.w - op.tx, dy = ((i / world.w) | 0) - op.ty;
        world.civic[i] = i === a ? ({ park: CIVIC.PARK, fire: CIVIC.FIRE, police: CIVIC.POLICE, centre: CIVIC.CENTRE, largePark: CIVIC.LARGE_PARK, zoo: CIVIC.ZOO })[op.kind] : CIVIC.PART;
        world.civicSize[i] = i === a ? (op.kind === "park" ? 1 : 3) : 128 | dx | dy << 2;
        break;
      }
      case "wall":
        if (world.terrain[i] === TERRAIN.TREE) world.terrain[i] = TERRAIN.GRASS;
        world.wall[i] = 1;
        walls = true;
        break;
      case "use":
        world.use[i] = clampUse(op.use);
        lines = true;
        break;
      case "rail":
        if (world.terrain[i] === TERRAIN.TREE) world.terrain[i] = TERRAIN.GRASS;
        world.rail[i] = 1;
        rails = true;
        break;
      case "station":
        world.rail[i] = 2;
        rails = true;
        break;
      default:
        break;
    }
  }
  // A wall changes what a road can reach (doors, road distance) as much as a road does; a road across a wall makes a tunnel.
  // Both derived road fields are rebuilt HERE, not at the next tick: a loaded
  // city opens paused, so a road laid before Space would leave every lot beside
  // it reading "no road within 3" on the card and in the access overlay until
  // the month turned. Two O(tiles) passes, well under a millisecond, and
  // hash-neutral — the tick recomputed exactly these before anything read them.
  if (roads || walls || rails) { world.roadsDirty = true; invalidatePaths(world); computeOcclusion(world); computeRoadDist(world); computeStationDoors(world); }
  else if (lines) invalidatePaths(world); // the stale pass re-searches under the line and releases the workers it forbids
  // A CIVIC or a BULLDOZE changes `tier`/`civic`, which is ground a station's
  // forecourt is measured on, and neither sets `roads`. Recompute the door
  // graph after every op and invalidate if it moved - the same rule tick.js
  // applies after lotsTick, for the same reason.
  computeStationDoors(world);
  if (world.doorsMoved) { world.doorsMoved = false; invalidatePaths(world); }
  // AND RE-PLAN, AT THE OP. An invalidation is a promise that someone will
  // rebuild, and nobody was: the next tick counts TRAFFIC at step 1 and
  // repairs stale commutes at step 5, so the month after any op the whole
  // town's traffic was counted from nothing - and pollution, land value and
  // crime are computed from traffic, in the same tick that rolls growth and
  // decay. It was farmable: one §1 use-op a month bought +5.8% population,
  // -27% pollution, +1.5 land value, -1.7 crime and MORE cash than doing
  // nothing (balanced seed 7 and millbelt seed 5, 20 years, weather on). It
  // also showed on the panel with no tick at all, because `refreshLast`
  // recounts the census off the null paths.
  //
  // This is the "OPEN - a save taken in the SAME MONTH as an op" item in
  // BACKLOG, which was framed as a save/load divergence and was really this.
  // The cost is one commute pass per op, measured at well under the tick it
  // sits in; the alternative was a hole a curious player finds by accident.
  replanStale(world, { release: false }); // rebuild what still has a route; the TICK decides who loses a job
  resetMeatRoutes(world); // a hall, its door, capacity or the freight graph may have changed inside this tick
  post(world, "build", -plan.cost);
  world.undoStack = plan.evicts ? [] : [{ op, snap, cost: plan.cost, roads: roads || walls || rails, t: world.tick }];
  if (log) world.log.push({ t: world.tick, op: stripOp(op) });
  return { ok: true, cost: plan.cost, replaced: plan.replaced, evicts: plan.evicts, undoable: !plan.evicts };
}

function removeCivic(world, i) {
  const a = civicAnchorOf(world, i);
  if (a < 0) return;
  for (const c of world.citizens) {
    if (c.job === a) releaseJob(world, c);
    if (c.heldAt === a) { c.held = 0; c.heldAt = -1; }
  }
  world.staff[a] = 0;
  for (const j of civicTiles(world, a)) { world.civic[j] = CIVIC.NONE; world.civicSize[j] = 0; }
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
  if (u.snap.some(s => campAt(world, s.i))) return {ok:false, reason:"someone is camping here — cannot restore construction"};
  for (const s of u.snap) {
    if (world.tier[s.i] > 0 && s.tier === 0) continue; // something grew here since; leave it
    world.terrain[s.i] = s.terrain; world.road[s.i] = s.road; world.zone[s.i] = s.zone; world.maxTier[s.i] = s.maxTier;
    world.tier[s.i] = s.tier; world.civic[s.i] = s.civic; world.civicSize[s.i] = s.civicSize; world.rubble[s.i] = s.rubble; world.wall[s.i] = s.wall; world.use[s.i] = s.use; world.rail[s.i] = s.rail; world.big[s.i] = s.big; world.theme[s.i] = s.theme;
  }
  if (u.roads) { world.roadsDirty = true; invalidatePaths(world); computeOcclusion(world); computeRoadDist(world); computeStationDoors(world); } // live, as apply does
  else if (u.op.kind === "use") invalidatePaths(world);
  computeStationDoors(world);
  if (world.doorsMoved) { world.doorsMoved = false; invalidatePaths(world); }
  replanStale(world, { release: false }); // an undo is an op: it rebuilds, and it fires nobody
  resetMeatRoutes(world);
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
