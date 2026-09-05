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
 * intervenes.
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
  const occl = world.occl;
  const stamp = world._reachStamp;
  const dist = world._reachDist;
  const queue = world._reachQueue;
  const gen = ++world._reachGen;
  let head = 0;
  let tail = 0;
  stamp[i] = gen;
  dist[i] = 0;
  queue[tail++] = i;
  while (head < tail) {
    const cur = queue[head++];
    const d = dist[cur];
    fn(cur, d);
    if (d >= R) continue;
    const cx = cur % w;
    const cy = (cur / w) | 0;
    const m = occl[cur];
    if (!m) continue;
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
  }
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
