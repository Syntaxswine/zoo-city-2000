// reach.js — how far a thing reaches across a city with walls in it. SPEC §6b.
//
// Glades of Arcadia's law, adopted whole (js/fields.js there, the owner's
// pointer): an area effect radiates by FLOOD FILL, not by a square; a wall
// tile blocks it and receives nothing; a gate is a CONNECTOR, open along its
// axis only — "the way through". Here the gate is a TUNNEL: a road (or rail)
// tile with a wall on it. A smell passes the gate along the road and nowhere
// else, which is what a real gap in a real wall does.
//
// The flood is 8-connected with unit diagonals, so on open ground its
// distance IS the Chebyshev distance the square loops used, and a city with
// no walls gets byte-identical fields — check.mjs proves the frame against
// the square before anything else. No corner-cutting: a diagonal step is
// refused when both orthogonal neighbours are blocked. A city with no walls
// at all takes the square loop, which is the same numbers for less work.
//
// `occl[i]` is a DERIVED per-tile bitmask of the eight directions influence
// may cross (Glades' encoding): 0xFF open ground, 0x00 a wall, the two bits
// of its axis for a tunnel. A crossing a → b is legal iff a's mask has the
// direction and b's has the opposite, so a gate never has to know which side
// you came from. Rebuilt when walls or roads change (world.wallsDirty).

import { ROAD } from "./world.js";

/** The eight directions, Glades' order: 0 = +tx, then clockwise on the map. Odd indices are diagonals. */
export const DIRS = Object.freeze([[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]);
const OPP = (d) => (d + 4) & 7;
export const OPEN = 0xff;
export const AXIS_EW = (1 << 0) | (1 << 4); // ±tx: the road's E and W arms
export const AXIS_NS = (1 << 2) | (1 << 6); // ±ty: the road's N and S arms

const onRail = (world, i) => !!(world.rail && world.rail[i]);
const hasWay = (world, i) => world.road[i] !== ROAD.NONE || onRail(world, i);

/** Is this a bare wall — a wall with nothing running through it? Reach, road distance and doors stop here. */
export const isBarrier = (world, i) => world.wall[i] === 1 && !hasWay(world, i);

/**
 * MAY A STEP FROM `a` TO `b` CROSS? A gate is open ALONG ITS AXIS ONLY (SPEC
 * 6b): the way through it is the way through it, and a wall pierced
 * north-south is still a wall to anything moving east-west. `world.occl` holds
 * exactly that mask per wall tile (0 for a bare wall), and every area effect -
 * smells, dread, cover, a killer's reach - already reads it through
 * `forEachWithin`.
 *
 * ROAD DISTANCE AND THE DOOR SEARCH DID NOT, and asked only "is this a bare
 * wall". So a wall with a north-south RAIL line through it was a doorway
 * east-west for a citizen on foot: a hostile review put a platform on one side
 * and a road on the other and got a stored commute walking through the
 * masonry, at right angles to the tunnel's own axis - the same tile a smell
 * could not cross. Both callers ask this now, so 6b is one law and not two.
 */
export function crossable(world, a, b) {
  const axis = (b - a) % world.w === 0 ? AXIS_NS : AXIS_EW; // orthogonal steps only; a row apart is N/S
  return (!world.wall[a] || (world.occl[a] & axis) !== 0) && (!world.wall[b] || (world.occl[b] & axis) !== 0);
}

/**
 * A tunnel's open axes, from the arms of the way ON that tile — a road
 * tunnel reads its road neighbours, a rail tunnel its rail neighbours (a
 * road running beside a rail tunnel must not open it sideways; the suite
 * caught exactly that): N or S neighbour → the NS axis, E or W → the EW
 * axis, both at a crossroads, both for a stub with no neighbours (a hole
 * is a hole).
 */
export function tunnelMask(world, i) {
  const { w, h } = world;
  const tx = i % w;
  const ty = (i / w) | 0;
  const onRoad = world.road[i] !== ROAD.NONE;
  const way = (x, y) => x >= 0 && y >= 0 && x < w && y < h && (onRoad ? world.road[y * w + x] !== ROAD.NONE : onRail(world, y * w + x));
  const ns = way(tx, ty - 1) || way(tx, ty + 1);
  const ew = way(tx + 1, ty) || way(tx - 1, ty);
  if (!ns && !ew) return AXIS_NS | AXIS_EW;
  return (ns ? AXIS_NS : 0) | (ew ? AXIS_EW : 0);
}

/** Which way a tunnel's road runs, for the art: "ns" when its N/S arms exist, else "ew". */
export function tunnelAxis(world, i) {
  return tunnelMask(world, i) & AXIS_NS ? "ns" : "ew";
}

/** Rebuild `occl` and `wallCount` from the wall and way arrays. */
export function computeOcclusion(world) {
  const n = world.w * world.h;
  const occl = world.occl;
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (!world.wall[i]) { occl[i] = OPEN; continue; }
    count++;
    occl[i] = hasWay(world, i) ? tunnelMask(world, i) : 0;
  }
  world.wallCount = count;
  world.wallsDirty = false;
}

function scratch(world) {
  const n = world.w * world.h;
  if (!world._reachStamp) {
    world._reachStamp = new Int32Array(n);
    world._reachDist = new Int16Array(n);
    world._reachQueue = new Int32Array(n);
    world._reachGen = 0;
    world._reachOutStamp = new Int32Array(n);
    world._reachOut = new Int16Array(n);
    world._reachOutGen = 0;
  }
}

/**
 * Every tile within reach R of `i` — the source first, at d = 0 — as
 * fn(j, d). With no walls in the city this is the Chebyshev square; with
 * walls it is the flood, which agrees with the square wherever no wall
 * intervenes. For a thing that stands on MORE than one tile — a 3×3 campus —
 * use forEachWithinAll, or the halo hangs off one corner of the building.
 */
export function forEachWithin(world, i, R, fn) {
  if (world.wallsDirty) computeOcclusion(world);
  const { w, h } = world;
  const tx = i % w;
  const ty = (i / w) | 0;
  if (!world.wallCount) {
    for (let dy = -R; dy <= R; dy++) {
      const yy = ty + dy;
      if (yy < 0 || yy >= h) continue;
      for (let dx = -R; dx <= R; dx++) {
        const xx = tx + dx;
        if (xx < 0 || xx >= w) continue;
        fn(yy * w + xx, Math.max(Math.abs(dx), Math.abs(dy)));
      }
    }
    return;
  }
  scratch(world);
  const gen = ++world._reachGen;
  world._reachStamp[i] = gen;
  world._reachDist[i] = 0;
  world._reachQueue[0] = i;
  flood(world, gen, 1, R, fn);
}

/**
 * Every tile within reach R of ANY tile of a FOOTPRINT — a 2×2 or 3×3 campus,
 * a block — as fn(j, d), each tile ONCE, d the distance to the NEAREST
 * footprint tile (0 on the footprint itself). With one tile this IS
 * forEachWithin. On open ground d is the Chebyshev distance to the footprint,
 * so a 3×3 at radius R reaches a (3 + 2R)² square centred on the building;
 * with walls it is the same flood seeded from every footprint tile at once,
 * which is the union of the single-tile floods with the smaller distance
 * winning — check.mjs proves both against the definitions.
 *
 * WHY THIS EXISTS: until session 17 every 3×3 campus flooded from its ANCHOR
 * (the top-left tile) alone, because a campus's other eight tiles are
 * CIVIC.PART and no halo rule looked through them. A police station's cover
 * was a 13×13 square hung off one corner — six tiles of reach to the
 * north-west, four to the south-east (tools/haloprobe.mjs measured it: 169
 * covered tiles where the footprint gives 225). The knowledge-and-culture
 * proposal's coverage rule ("seeded from every footprint tile at distance
 * zero") is the right convention, so it is built once, here, for everyone.
 */
export function forEachWithinAll(world, tiles, R, fn) {
  if (tiles.length === 1) { forEachWithin(world, tiles[0], R, fn); return; }
  if (world.wallsDirty) computeOcclusion(world);
  const { w, h } = world;
  if (!world.wallCount) {
    // The footprint's bounding box grown by R; each tile at its distance to the nearest footprint tile.
    let x0 = w, x1 = -1, y0 = h, y1 = -1;
    for (const i of tiles) {
      const tx = i % w;
      const ty = (i / w) | 0;
      if (tx < x0) x0 = tx;
      if (tx > x1) x1 = tx;
      if (ty < y0) y0 = ty;
      if (ty > y1) y1 = ty;
    }
    const ya = Math.max(0, y0 - R), yb = Math.min(h - 1, y1 + R);
    const xa = Math.max(0, x0 - R), xb = Math.min(w - 1, x1 + R);
    for (let yy = ya; yy <= yb; yy++) {
      for (let xx = xa; xx <= xb; xx++) {
        let d = R + 1;
        for (const i of tiles) {
          const dd = Math.max(Math.abs(xx - (i % w)), Math.abs(yy - ((i / w) | 0)));
          if (dd < d) d = dd;
        }
        if (d <= R) fn(yy * w + xx, d);
      }
    }
    return;
  }
  scratch(world);
  const gen = ++world._reachGen;
  let tail = 0;
  for (const i of tiles) {
    if (world._reachStamp[i] === gen) continue;
    world._reachStamp[i] = gen;
    world._reachDist[i] = 0;
    world._reachQueue[tail++] = i;
  }
  flood(world, gen, tail, R, fn);
}

/**
 * The flood itself, from whatever the caller has already queued at d = 0 —
 * ONE BFS body for a single source and for a footprint, so the two can never
 * disagree about what a wall, a tunnel or a corner does.
 */
function flood(world, gen, tail, R, fn) {
  const dist = world._reachDist;
  const queue = world._reachQueue;
  let head = 0;
  while (head < tail) {
    const cur = queue[head++];
    const d = dist[cur];
    fn(cur, d);
    if (d >= R) continue;
    tail = expand(world, cur, d, gen, tail);
  }
}

/**
 * THE ONE STEP of every flood: queue cur's unvisited neighbours at d + 1,
 * across the occlusion masks — a wall is never entered, a tunnel only along
 * its axis, and a diagonal between two walls that touch at the corner is not
 * a gap. Returns the new tail. flood and floodBudget both step through here,
 * so a radius flood and a budget flood can never disagree about a wall.
 */
function expand(world, cur, d, gen, tail) {
  const { w, h } = world;
  const occl = world.occl;
  const stamp = world._reachStamp;
  const dist = world._reachDist;
  const queue = world._reachQueue;
  const cx = cur % w;
  const cy = (cur / w) | 0;
  const m = occl[cur];
  if (!m) return tail;
  for (let k = 0; k < 8; k++) {
    if (!(m & (1 << k))) continue;
    const nx = cx + DIRS[k][0];
    const ny = cy + DIRS[k][1];
    if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
    const j = ny * w + nx;
    if (stamp[j] === gen) continue;
    if (!(occl[j] & (1 << OPP(k)))) continue;
    if (k & 1) {
      // A diagonal between two walls that touch at the corner is not a gap.
      if (occl[cy * w + nx] === 0 && occl[ny * w + cx] === 0) continue;
    }
    stamp[j] = gen;
    dist[j] = d + 1;
    queue[tail++] = j;
  }
  return tail;
}

/**
 * A flood with a BUDGET of tiles instead of a radius (SPEC §9e; the owner's
 * ruling that a University reaches half the map's tiles and an Amphitheater
 * an eighth — an AREA, not a distance). From every footprint tile at d = 0,
 * take whole distance layers nearest first until the next layer would
 * overrun the budget; from that final layer take the remainder in ASCENDING
 * TILE INDEX, so the catchment is exact and the same on every machine with no
 * RNG. Walls are never entered (so never counted), tunnels only along their
 * axis, water and open ground count like anything else. Near a map edge the
 * layers are smaller and the flood reaches farther in to fill the budget; a
 * sealed quarter runs out of tiles and stays short. fn(j, d) once per tile.
 * Returns the tiles taken.
 */
export function floodBudget(world, tiles, budget, fn) {
  if (world.wallsDirty) computeOcclusion(world);
  scratch(world);
  const stamp = world._reachStamp;
  const dist = world._reachDist;
  const queue = world._reachQueue;
  const gen = ++world._reachGen;
  let tail = 0;
  for (const i of tiles) {
    if (stamp[i] === gen) continue;
    stamp[i] = gen;
    dist[i] = 0;
    queue[tail++] = i;
  }
  let head = 0;
  let taken = 0;
  while (head < tail && taken < budget) {
    const d = dist[queue[head]];
    let end = head;
    while (end < tail && dist[queue[end]] === d) end++;
    if (taken + (end - head) > budget) {
      const layer = Array.from(queue.subarray(head, end)).sort((a, b) => a - b);
      for (let k = 0; k < budget - taken; k++) fn(layer[k], d);
      return budget;
    }
    for (let k = head; k < end; k++) fn(queue[k], d);
    taken += end - head;
    for (let k = head; k < end; k++) tail = expand(world, queue[k], d, gen, tail);
    head = end;
  }
  return taken;
}

/**
 * The reach distances from `i` out to R as a lookup: dist(j) is the flood
 * distance, or −1 when j is out of reach. Valid until the next call.
 */
export function reachFrom(world, i, R) {
  scratch(world);
  const st = world._reachOutStamp;
  const out = world._reachOut;
  const gen = ++world._reachOutGen;
  forEachWithin(world, i, R, (j, d) => { st[j] = gen; out[j] = d; });
  return (j) => (st[j] === gen ? out[j] : -1);
}
