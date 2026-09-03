// tools/mayor.mjs — the scripted mayor, lifted out of playtest.mjs so that
// more than one instrument can watch the SAME town. SPEC §17.
//
// She pre-plans a grid of 8×8 blocks (a road ring shared with the neighbours
// round a 6×6 interior) spiralling out from the start road, opens the next
// block of whichever type demand asks for, and each quarter zones AHEAD of the
// valve. Layouts change which types she will open at all.
//
// This file is the mayor and NOTHING else — no reporting, no argv, no console.
// `playtest.mjs` prints her curves; `play.mjs` photographs her town. When they
// disagree about what a city looks like it is because of a flag, never because
// there are two mayors.
//
//   const mayor = createMayor(world, { layout: "balanced", ... });
//   for (let t = 0; t < years * 12; t++) { mayor.month(t); tick(world); }
//
// The extraction is proved by the hash: `playtest --years 30 --quiet` printed
// 292e7fa1 before it and prints 292e7fa1 after it.

import { ZONE, TERRAIN, idx, inBounds } from "../js/sim/world.js";
import { apply } from "../js/sim/ops.js";

const NORMAL_BLOCK = 7;
const ESTATE_BLOCK = 8;
const RING_SPAN = 7; // inclusive 8×8 ring around one 6×6 interior

/**
 * `opts`: layout "balanced" | "dormitory" | "millbelt" | "estate", rates [R, C, I],
 * schedule [[year, rate], ...], recessionYear, parks, zooYear, markets,
 * pacify, stations, disasters. Every one of them is a playtest flag.
 */
export function createMayor(world, opts = {}) {
  const layout = opts.layout || "balanced";
  const rates = opts.rates || [8, 8, 8];
  const schedule = opts.schedule || [];
  const recessionYear = opts.recessionYear ?? null;
  const parksWanted = opts.parks || 0;
  const zooYear = opts.zooYear ?? null;
  const marketsWanted = opts.markets || 0;
  const pacify = !!opts.pacify;
  const stations = !!opts.stations;
  const BLOCK = layout === "estate" ? ESTATE_BLOCK : NORMAL_BLOCK;

  apply(world, { kind: "rate", zone: "R", value: rates[0] });
  apply(world, { kind: "rate", zone: "C", value: rates[1] });
  apply(world, { kind: "rate", zone: "I", value: rates[2] });
  apply(world, { kind: "toggle", key: "noDisasters", value: !opts.disasters });

  const sx = world.start.tx;
  const sy = world.start.ty;
  // Estate is the owner's scale: 6×6 interiors laid on an 8-tile pitch,
  // houses at the near end and two reserved meat blocks 33 road steps away.
  // Orient the strip inward from whichever edge owns the starting stub, so
  // the same shape fits every generated seed rather than assuming a west gate.
  const edge = [
    [sx, 1, 0], [world.w - 1 - sx, -1, 0],
    [sy, 0, 1], [world.h - 1 - sy, 0, -1],
  ].sort((a, b) => a[0] - b[0])[0];
  let estateOrigin = [sx, sy];
  let inward = [edge[1], edge[2]];
  let lateral = [-inward[1], inward[0]];
  const estatePlan = [
    [0, 0, ZONE.R], [0, 1, ZONE.R],
    [1, 0, ZONE.C], [1, 1, ZONE.C],
    [2, 0, ZONE.I], [2, 1, ZONE.I],
    [5, 0, ZONE.M], [5, 1, ZONE.M],
  ];
  const estatePoint = (q, r) => [estateOrigin[0] + inward[0] * q + lateral[0] * r, estateOrigin[1] + inward[1] * q + lateral[1] * r];
  const estateRectAt = (along, row, lateral0) => {
    const q0 = 1 + along * ESTATE_BLOCK;
    const r0 = lateral0 + row * ESTATE_BLOCK;
    const corners = [estatePoint(q0, r0), estatePoint(q0 + RING_SPAN, r0), estatePoint(q0, r0 + RING_SPAN), estatePoint(q0 + RING_SPAN, r0 + RING_SPAN)];
    return {
      x0: Math.min(...corners.map((p) => p[0])), y0: Math.min(...corners.map((p) => p[1])),
      x1: Math.max(...corners.map((p) => p[0])), y1: Math.max(...corners.map((p) => p[1])),
    };
  };
  // Slide the two-row estate sideways to avoid as much generated water as
  // possible. Roads may bridge the remaining river; the six-by-six zones do
  // not quietly shrink merely because a fixed lateral offset hit a pond.
  let estateLateral = -8;
  let estateRailLane = null;
  if (layout === "estate") {
    let best = null;
    const configs = [
      { origin: [sx, sy], axis: [edge[1], edge[2]], native: 0 },
      { origin: [6, 32], axis: [1, 0], native: 1 },
      { origin: [32, 6], axis: [0, 1], native: 2 },
    ];
    for (const config of configs) {
      estateOrigin = config.origin;
      inward = config.axis;
      lateral = [-inward[1], inward[0]];
      for (let lateral0 = -30; lateral0 <= 22; lateral0++) {
        let water = 0;
        let valid = true;
        for (const [along, row] of estatePlan) {
          const r = estateRectAt(along, row, lateral0);
          if (r.x0 < 1 || r.y0 < 1 || r.x1 >= world.w - 1 || r.y1 >= world.h - 1) { valid = false; break; }
          for (let y = r.y0 + 1; y < r.y1; y++) for (let x = r.x0 + 1; x < r.x1; x++) {
            if (world.terrain[idx(world, x, y)] === TERRAIN.WATER) water++;
          }
        }
        if (!valid) continue;
        let railLane = null;
        for (const lane of [lateral0 - 1, lateral0 + 16]) {
          let dry = true;
          for (let q = 5; q <= 44; q++) {
            const [x, y] = estatePoint(q, lane);
            if (!inBounds(world, x, y)) { dry = false; break; }
            const i = idx(world, x, y);
            if (world.terrain[i] === TERRAIN.WATER || world.road[i]) { dry = false; break; }
          }
          if (dry) { railLane = lane; break; }
        }
        // A guaranteed dry line outranks a prettier zoning site. The fallback
        // BFS below is still useful for saves with a winding dry route.
        const score = (railLane == null ? 10000 : 0) + water + Math.abs(lateral0 + 8) / 1000 + config.native / 10000;
        if (!best || score < best.score) best = { score, lateral0, railLane, origin: config.origin, axis: config.axis };
      }
    }
    if (best) {
      estateOrigin = best.origin;
      inward = best.axis;
      lateral = [-inward[1], inward[0]];
      estateLateral = best.lateral0;
      estateRailLane = best.railLane;
    }
  }

  const spiral = layout === "estate" ? estatePlan.map(([along, row]) => [along, row]) : [];
  if (layout !== "estate") for (let r = 0; r <= 4; r++) {
    for (let by = -r; by <= r; by++) for (let bx = -r; bx <= r; bx++) {
      if (Math.max(Math.abs(bx), Math.abs(by)) !== r) continue;
      spiral.push([bx, by]);
    }
  }
  const opened = new Set();
  function blockRect(bx, by) {
    if (layout === "estate") return estateRectAt(bx, by, estateLateral);
    const x0 = sx + bx * BLOCK - 3;
    const y0 = sy + by * BLOCK - 3;
    return { x0, y0, x1: x0 + RING_SPAN, y1: y0 + RING_SPAN };
  }
  function blockOK(bx, by) {
    const { x0, y0, x1, y1 } = blockRect(bx, by);
    if (layout === "estate") return x0 >= 0 && y0 >= 0 && x1 < world.w && y1 < world.h;
    let water = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!inBounds(world, x, y)) return false;
      if (world.terrain[idx(world, x, y)] === TERRAIN.WATER) water++;
    }
    return water <= 4;
  }
  function openBlock(bx, by, zone) {
    const { x0, y0, x1, y1 } = blockRect(bx, by);
    const ring = [];
    for (let x = x0; x <= x1; x++) { ring.push(idx(world, x, y0)); ring.push(idx(world, x, y1)); }
    for (let y = y0; y <= y1; y++) { ring.push(idx(world, x0, y)); ring.push(idx(world, x1, y)); }
    // Connect the ring to the start road if this is the first block.
    const r1 = apply(world, { kind: "road", tiles: ring });
    let zoneRect = { x0: x0 + 1, y0: y0 + 1, x1: x1 - 1, y1: y1 - 1 };
    if (layout === "estate" && zone === ZONE.M) {
      // One unambiguous hall in each reserved market interior: the H probe is
      // a two-HALL town, not two chalk blocks that happen to merge into an
      // unpredictable number of buildings. Pick the dry tile nearest centre.
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const lots = [];
      for (let y = y0 + 1; y < y1; y++) for (let x = x0 + 1; x < x1; x++) {
        if (world.terrain[idx(world, x, y)] !== TERRAIN.WATER) lots.push([x, y]);
      }
      lots.sort((a, b) => (Math.abs(a[0] - cx) + Math.abs(a[1] - cy)) - (Math.abs(b[0] - cx) + Math.abs(b[1] - cy)) || a[1] - b[1] || a[0] - b[0]);
      if (lots.length) zoneRect = { x0: lots[0][0], y0: lots[0][1], x1: lots[0][0], y1: lots[0][1] };
    }
    const r2 = apply(world, { kind: "zone", zone, ...zoneRect, density: 3 });
    opened.add(`${bx},${by}`);
    return (r1.ok || r1.reason === "nothing to do") && r2.ok;
  }
  function nextBlock() {
    for (const [bx, by] of spiral) {
      if (opened.has(`${bx},${by}`)) continue;
      if (blockOK(bx, by)) return [bx, by];
      opened.add(`${bx},${by}`);
    }
    return null;
  }

  /** Build one dry rail route between the near and far road rings. */
  function estateRail() {
    if (layout !== "estate") return null;
    // All rings, including the two market rings that will be zoned later,
    // exist from month zero. This reserves the owner's 33-step separation.
    for (const [along, row] of estatePlan) {
      const { x0, y0, x1, y1 } = blockRect(along, row);
      const ring = [];
      for (let x = x0; x <= x1; x++) { ring.push(idx(world, x, y0)); ring.push(idx(world, x, y1)); }
      for (let y = y0; y <= y1; y++) { ring.push(idx(world, x0, y)); ring.push(idx(world, x1, y)); }
      apply(world, { kind: "road", tiles: ring });
    }
    // The straight road spine joins the gate, every district and both halls.
    const spineR = estateLateral + RING_SPAN;
    const spine = [];
    const [startX, startY] = estatePoint(0, 0);
    const [joinX, joinY] = estatePoint(0, spineR);
    if (startX === joinX) for (let y = Math.min(startY, joinY); y <= Math.max(startY, joinY); y++) spine.push(idx(world, startX, y));
    else for (let x = Math.min(startX, joinX); x <= Math.max(startX, joinX); x++) spine.push(idx(world, x, startY));
    for (let q = 0; q <= 48; q++) { const [x, y] = estatePoint(q, spineR); spine.push(idx(world, x, y)); }
    apply(world, { kind: "road", tiles: spine });

    if (estateRailLane != null) {
      const path = [];
      for (let q = 5; q <= 44; q++) { const [x, y] = estatePoint(q, estateRailLane); path.push(idx(world, x, y)); }
      const rr = apply(world, { kind: "rail", tiles: path });
      const a = path[0], b = path[path.length - 1];
      const s1 = apply(world, { kind: "station", tx: a % world.w, ty: (a / world.w) | 0 });
      const s2 = apply(world, { kind: "station", tx: b % world.w, ty: (b / world.w) | 0 });
      if (rr.ok && s1.ok && s2.ok) return { from: a, to: b, tiles: path.length };
    }

    // Rail gets its own dry layer. Candidate platforms must touch a road and
    // sit by the near R ring / far M ring. Multi-source BFS finds a real dry
    // route around rivers without changing terrain or crossing a road.
    const n = world.w * world.h;
    const reserved = new Uint8Array(n);
    for (const [along, row] of estatePlan) {
      const r = blockRect(along, row);
      for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) reserved[idx(world, x, y)] = 1;
    }
    const qOf = (x, y) => (x - estateOrigin[0]) * inward[0] + (y - estateOrigin[1]) * inward[1];
    const free = (i) => i >= 0 && i < n && !reserved[i] && world.terrain[i] !== TERRAIN.WATER && !world.road[i] && !world.zone[i] && !world.civic[i] && !world.wall[i] && !world.rail[i];
    const touchesRoad = (i) => {
      const x = i % world.w, y = (i / world.w) | 0;
      return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inBounds(world, x + dx, y + dy) && world.road[idx(world, x + dx, y + dy)]);
    };
    const sources = [], targets = [];
    for (let i = 0; i < n; i++) if (free(i) && touchesRoad(i)) {
      const q = qOf(i % world.w, (i / world.w) | 0);
      if (q >= 5 && q <= 10) sources.push(i);
      if (q >= 39 && q <= 44) targets.push(i);
    }
    const targetSet = new Set(targets);
    const prev = new Int32Array(n).fill(-2);
    const queue = new Int32Array(n);
    let head = 0, tail = 0, found = -1;
    for (const i of sources) { prev[i] = -1; queue[tail++] = i; }
    while (head < tail && found < 0) {
      const i = queue[head++];
      if (targetSet.has(i)) { found = i; break; }
      const x = i % world.w, y = (i / world.w) | 0;
      for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!inBounds(world, nx, ny)) continue;
        const j = idx(world, nx, ny);
        if (prev[j] !== -2 || !free(j)) continue;
        prev[j] = i;
        queue[tail++] = j;
      }
    }
    if (found < 0) return null;
    const path = [];
    for (let i = found; i !== -1; i = prev[i]) path.push(i);
    path.reverse();
    const rr = apply(world, { kind: "rail", tiles: path });
    const a = path[0], b = path[path.length - 1];
    const s1 = apply(world, { kind: "station", tx: a % world.w, ty: (a / world.w) | 0 });
    const s2 = apply(world, { kind: "station", tx: b % world.w, ty: (b / world.w) | 0 });
    return rr.ok && s1.ok && s2.ok ? { from: a, to: b, tiles: path.length } : null;
  }
  const wantTypes = {
    balanced: (v) => [["R", ZONE.R, v.R], ["C", ZONE.C, v.C], ["I", ZONE.I, v.I], ...(marketsWanted ? [["M", ZONE.M, v.M]] : [])],
    dormitory: (v) => [["R", ZONE.R, v.R]],
    millbelt: (v) => [["R", ZONE.R, v.R], ["I", ZONE.I, v.I + 0.3], ["I2", ZONE.I, v.I + 0.2], ["C", ZONE.C, v.C - 0.2]],
    estate: () => [], // the fixed owner-scale quarters already contain ample zoned capacity
  };

  // Opening: one R block, one C block, one I block (balanced), connected to the stub.
  const rail = estateRail();
  const first = { balanced: [ZONE.R, ZONE.I, ZONE.C], dormitory: [ZONE.R, ZONE.R], millbelt: [ZONE.R, ZONE.I, ZONE.I], estate: [ZONE.R, ZONE.R, ZONE.C, ZONE.C, ZONE.I, ZONE.I] }[layout] || [ZONE.R, ZONE.I, ZONE.C];
  for (const z of first) { const b = nextBlock(); if (b) openBlock(b[0], b[1], z); }

  let parks = 0;

  /** One month of decisions, BEFORE the tick. `t` is the tick about to run. */
  function month(t) {
    const year = Math.floor(t / 12);
    const mo = t % 12;
    for (const [y, r] of schedule) if (year === y && mo === 0) for (const z of ["R", "C", "I"]) apply(world, { kind: "rate", zone: z, value: r });
    if (recessionYear != null && year === Number(recessionYear) && mo === 0) world.events.active.push({ id: "recession", until: t + 24, extMult: 0.6 });
    if (zooYear != null && year === Number(zooYear) && mo === 0) {
      // Place a zoo on the first free 2×2 next to the start.
      outer: for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
        const r = apply(world, { kind: "zoo", tx: sx + dx, ty: sy + dy });
        if (r.ok) break outer;
      }
    }
    // --markets N: the mayor opens N meat-hall blocks from year 2, one a year.
    if (marketsWanted && mo === 0 && year >= 2 && year < 2 + marketsWanted) { const b = nextBlock(); if (b) openBlock(b[0], b[1], ZONE.M); }
    // --pacify: a pacification centre beside the start at year 3.
    if (pacify && t === 36) {
      outer4: for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
        const r = apply(world, { kind: "centre", tx: sx + dx, ty: sy + dy });
        if (r.ok) break outer4;
      }
    }
    // --stations: one fire and one police station beside the start road at year 2.
    if (stations && t === 24) {
      for (const kind of ["fire", "police"]) {
        outer3: for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
          const r = apply(world, { kind, tx: sx + dx, ty: sy + dy });
          if (r.ok) break outer3;
        }
      }
    }
    if (parks < parksWanted && t >= 24 && mo === 6) {
      outer2: for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
        const r = apply(world, { kind: "park", tx: sx + dx, ty: sy + dy });
        if (r.ok) { parks++; break outer2; }
      }
    }
    // The mayor reacts every quarter: zone AHEAD — open a block of a type when
    // its valve is positive and fewer than 12 empty lots of that type remain.
    if (t > 0 && mo % 3 === 0 && world.cash > 600) {
      const v = world.valves;
      const wants = wantTypes[layout](v).sort((a, b) => b[2] - a[2]);
      const empty = { [ZONE.R]: 0, [ZONE.C]: 0, [ZONE.I]: 0, [ZONE.M]: 0 };
      for (let i = 0; i < world.w * world.h; i++) if (world.zone[i] && world.tier[i] === 0 && !world.rubble[i]) empty[world.zone[i]]++;
      for (const [name, zone, val] of wants) {
        if (val < 0.05) break;
        if (empty[zone] >= 12) continue;
        const b = nextBlock();
        if (!b) break;
        openBlock(b[0], b[1], zone);
        break;
      }
    }
  }

  return { month, get parks() { return parks; }, start: { sx, sy }, BLOCK, ...(layout === "estate" ? { estate: { lateral: estateLateral, inward, rail } } : {}) };
}
