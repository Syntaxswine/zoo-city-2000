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

const BLOCK = 7;

/**
 * `opts`: layout "balanced" | "dormitory" | "millbelt", rates [R, C, I],
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

  apply(world, { kind: "rate", zone: "R", value: rates[0] });
  apply(world, { kind: "rate", zone: "C", value: rates[1] });
  apply(world, { kind: "rate", zone: "I", value: rates[2] });
  apply(world, { kind: "toggle", key: "noDisasters", value: !opts.disasters });

  const sx = world.start.tx;
  const sy = world.start.ty;
  const spiral = [];
  for (let r = 0; r <= 4; r++) {
    for (let by = -r; by <= r; by++) for (let bx = -r; bx <= r; bx++) {
      if (Math.max(Math.abs(bx), Math.abs(by)) !== r) continue;
      spiral.push([bx, by]);
    }
  }
  const opened = new Set();
  function blockOK(bx, by) {
    const x0 = sx + bx * BLOCK - 3;
    const y0 = sy + by * BLOCK - 3;
    let water = 0;
    for (let y = y0; y <= y0 + BLOCK; y++) for (let x = x0; x <= x0 + BLOCK; x++) {
      if (!inBounds(world, x, y)) return false;
      if (world.terrain[idx(world, x, y)] === TERRAIN.WATER) water++;
    }
    return water <= 4;
  }
  function openBlock(bx, by, zone) {
    const x0 = sx + bx * BLOCK - 3;
    const y0 = sy + by * BLOCK - 3;
    const ring = [];
    for (let x = x0; x <= x0 + BLOCK; x++) { ring.push(idx(world, x, y0)); ring.push(idx(world, x, y0 + BLOCK)); }
    for (let y = y0; y <= y0 + BLOCK; y++) { ring.push(idx(world, x0, y)); ring.push(idx(world, x0 + BLOCK, y)); }
    // Connect the ring to the start road if this is the first block.
    const r1 = apply(world, { kind: "road", tiles: ring });
    const r2 = apply(world, { kind: "zone", zone, x0: x0 + 1, y0: y0 + 1, x1: x0 + BLOCK - 1, y1: y0 + BLOCK - 1, density: 3 });
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
  const wantTypes = {
    balanced: (v) => [["R", ZONE.R, v.R], ["C", ZONE.C, v.C], ["I", ZONE.I, v.I], ...(marketsWanted ? [["M", ZONE.M, v.M]] : [])],
    dormitory: (v) => [["R", ZONE.R, v.R]],
    millbelt: (v) => [["R", ZONE.R, v.R], ["I", ZONE.I, v.I + 0.3], ["I2", ZONE.I, v.I + 0.2], ["C", ZONE.C, v.C - 0.2]],
  };

  // Opening: one R block, one C block, one I block (balanced), connected to the stub.
  const first = { balanced: [ZONE.R, ZONE.I, ZONE.C], dormitory: [ZONE.R, ZONE.R], millbelt: [ZONE.R, ZONE.I, ZONE.I] }[layout] || [ZONE.R, ZONE.I, ZONE.C];
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

  return { month, get parks() { return parks; }, start: { sx, sy }, BLOCK };
}
