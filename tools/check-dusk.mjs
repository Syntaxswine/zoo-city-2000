#!/usr/bin/env node
// tools/check-dusk.mjs — the gate on the evening.
// docs/PROPOSAL-SPRITE-UPGRADE-2026-09-22.md, T1.5. SPEC §12.1, §13.
//
// The verification named in the proposal BEFORE the work, run here:
//
//   amount 0 is the ABSENCE of a table · every key lands on a key, and every
//   surface key lands on a SURFACE key · the lights and the marks are fixed
//   points · no ramp inverts · nothing is brighter than it was at noon · the
//   canopy is still darker than the grass · the chalk still separates from
//   the lawn · the ground takes less light than the walls · the table
//   COMPOSES with the item's own tint instead of replacing it · and the frame
//   at amount 0 is the frame the renderer drew before this existed, byte for
//   byte, after having been all the way to nightfall and back.
//
// THE TWO THAT MATTER MOST. (1) The neutral knob: an evening is a whole-city
// recolour and the only way to say "it added something and changed nothing"
// is to render the old frame from the new code. (2) The ground layer, which
// is an offscreen canvas that survives across frames — if `setDusk` failed to
// mark it dirty the lawn would still be at noon under a city at nightfall,
// and every other check here would pass.

import { installCanvas, createCanvas } from "./headless-canvas.mjs";

installCanvas();

const { art } = await import("../js/art/index.js");
const { duskTable, withDusk, duskBackground, evening, FIXED, DUSK_AMOUNT } = await import("../js/art/dusk.js");
const { KEYS, RAMPS, colourOf, rampOf, hasKey } = await import("../js/art/palette.js");
const { createWorld, ZONE, TERRAIN, ROAD, capacityOf } = await import("../js/sim/world.js");
await import("../js/sim/ops.js");
await import("../js/sim/tick.js");
const { createRenderer } = await import("../js/render.js");

let checks = 0;
const check = (name, ok, detail = "") => {
  checks++;
  if (!ok) { console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`); process.exit(1); }
};

const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const lumOf = (k) => lum(colourOf(k));
const SURFACE = KEYS.filter((k) => rampOf(k));
// SPELT OUT, NOT IMPORTED. `FIXED` is the module's own answer, and a check
// that iterates it is asking the code whether it agrees with itself — the
// exact shape of the mutant that survived check-shadows' first round ("every
// pixel is SHADOW_KEY" compared the constant with itself). Dropping '-' from
// the module's list made the lit windows dim with the city and the whole
// gate stayed green. This is the list, written here: the shadow, the lit
// window, fire, its tip, the zot, and the four zone chalks.
const LIGHTS_AND_MARKS = ["+", "-", "8", "9", "0", "5", "6", "7", "A"];
const AMOUNTS = [0.25, 0.55, 0.8, 1];
const both = (a) => [duskTable(a), duskTable(a, true)];

// ---- the table -------------------------------------------------------------------
check("amount 0 is the ABSENCE of a table, not an identity one", duskTable(0) === null && duskTable(0, true) === null);
check("…and so is anything below it", duskTable(-1) === null && duskTable(0.0) === null);
check("the same amount is the same frozen object — the sprite cache keys on identity",
  duskTable(1) === duskTable(1) && Object.isFrozen(duskTable(1)) && duskTable(1, true) === duskTable(1, true));
check("the flat table is a DIFFERENT table from the standing one", duskTable(1) !== duskTable(1, true));
check("the module's fixed set is the one this file checks",
  [...FIXED].sort().join("") === [...LIGHTS_AND_MARKS].sort().join(""), `${[...FIXED].join("")} vs ${LIGHTS_AND_MARKS.join("")}`);

for (const a of AMOUNTS) {
  for (const [n, t] of [["standing", duskTable(a)], ["ground", duskTable(a, true)]]) {
    const bad = KEYS.filter((k) => !hasKey(t[k] ?? ""));
    check(`every key lands on a key the palette has (${n}, ${a})`, bad.length === 0, bad.slice(0, 4).map((k) => `${k}→${t[k]}`).join(" "));
    // A wall must never be handed the shadow's key, the fire's or the zot's:
    // those are the pixels the player reads as EVENTS, and a roof painted in
    // one is a fire that is not there.
    const off = SURFACE.filter((k) => !rampOf(t[k]));
    check(`…and every surface key lands on a surface key (${n}, ${a})`, off.length === 0, off.slice(0, 4).map((k) => `${k}→${t[k]}`).join(" "));
    const moved = LIGHTS_AND_MARKS.filter((k) => t[k] !== k);
    check(`the lights and the marks are fixed points (${n}, ${a})`, moved.length === 0, moved.join(""));
    const up = SURFACE.filter((k) => lumOf(t[k]) > lumOf(k) + 0.01);
    check(`nothing is brighter than it was at noon (${n}, ${a})`, up.length === 0, up.slice(0, 4).map((k) => `${k}→${t[k]}`).join(" "));
    // A ramp's ORDER is its shading. The evening may recolour a ramp; it may
    // not put the lit face below the shaded one. (One ramp inverted before
    // the monotone floor went into the projection.)
    const inv = [];
    for (const [name, ramp] of Object.entries(RAMPS)) {
      const ks = ramp.keys.split("");
      for (let i = 1; i < ks.length; i++) if (lumOf(t[ks[i]]) < lumOf(t[ks[i - 1]]) - 0.01) inv.push(`${name}:${ks[i - 1]}${ks[i]}`);
    }
    check(`no ramp inverts (${n}, ${a})`, inv.length === 0, inv.slice(0, 4).join(" "));
  }
}

// The palette's own load-bearing relationship, kept from Glades of Arcadia
// and written at the top of palette.js: grass mid is LIGHTER than canopy mid,
// or a busy map turns to mush. An evening is exactly the sort of global
// recolour that would quietly break it.
for (const a of AMOUNTS) {
  for (const [n, t] of [["standing", duskTable(a)], ["ground", duskTable(a, true)]]) {
    check(`the canopy is still darker than the grass (${n}, ${a})`, lumOf(t.c) < lumOf(t.o),
      `canopy ${lumOf(t.c).toFixed(1)} vs grass ${lumOf(t.o).toFixed(1)}`);
  }
}

// The zone chalk. palette.js records that BOTH the R accent and the M accent
// had to be re-picked by hand because the first value vanished into the lawn;
// a table that re-projects them re-opens that, and measured, it does — '5'
// lands on grass light and 101 units of separation become 46. They are fixed
// points for that reason, and this is the check that says so in numbers.
//
// TWO FORMS OF THIS CHECK WERE WRONG BEFORE THIS ONE, and the palette said so
// both times. The first asked that every chalk's separation from the lawn
// GROW; C chalk '6' failed it at 99 → 89, and nothing is wrong with that —
// the lawn darkens and cools, which moves it toward a dark blue mark and away
// from a pale green one. The second measured against grass MID only, when a
// lawn is painted from every rung of the ramp and a mark has to clear the
// nearest of them.
//
// What it is now: the distance to the NEAREST grass rung, against the floor
// the daylight palette already ships and the owner has already looked at
// (R 51 · C 97 · I 48 · M 63 — the bar is 48). Derived, not typed, so
// re-picking an accent moves the bar with it. At the shipped amount the
// margins are 136 / 89 / 80 / 52: every one of them better than daylight's
// tightest. Across the whole knob the worst is 47 at amount 0.25, which is
// why the sweep is held to a COLLAPSE guard instead — a mark that has to stay
// legible at an amount the product cannot be in is a different claim, and
// pretending otherwise is how a gate gets tuned until it passes.
{
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  const CHALK = ["5", "6", "7", "A"];
  const GRASS = RAMPS.grass.keys.split("");
  const margin = (t, k) => Math.min(...GRASS.map((g) => dist(colourOf(t ? t[k] : k), colourOf(t ? t[g] : g))));
  const floor = Math.min(...CHALK.map((k) => margin(null, k)));
  check("daylight's own tightest chalk margin is a real number", floor > 20 && floor < 80, `${floor.toFixed(0)}`);
  for (const k of CHALK) {
    const now = margin(duskTable(DUSK_AMOUNT, true), k); // chalk is on the ground
    check(`zone chalk '${k}' stays off the lawn at the amount that ships`, now >= floor,
      `${now.toFixed(0)} against daylight's tightest margin ${floor.toFixed(0)} (its own is ${margin(null, k).toFixed(0)})`);
  }
  for (const a of AMOUNTS) {
    for (const k of CHALK) {
      const now = margin(duskTable(a, true), k);
      check(`…and never collapses into it anywhere on the knob ('${k}', ${a})`, now >= floor / 2, `${now.toFixed(0)} against ${(floor / 2).toFixed(0)}`);
    }
  }
}

// THE GROUND TAKES LESS LIGHT THAN THE WALLS. A horizontal surface meets a
// low sun at a grazing angle; this is the one facing the renderer knows for
// certain, and it is the difference between an evening and an overcast
// afternoon.
//
// AND THE PER-KEY FORM OF THAT IS FALSE, which is worth knowing. "No key is
// ever darker standing than lying down" fails on the TRANSFORM, before any
// projection: the sky is a light source with a luminance of its own (65.3),
// so a key darker than the sky gains by seeing more of it and less of the
// sun. That is not a bug, it is what a blue hour does — the deep shadow
// sides of things lift toward the sky while everything above 65 falls. Three
// keys do it (earth 's', tile 'C', fabric 'Q') and the projection rounds a
// couple more. The claim that holds, and the one the design is actually
// for, is about the MEAN.
for (const a of AMOUNTS) {
  const mean = (t) => SURFACE.reduce((n, k) => n + lumOf(t[k]), 0) / SURFACE.length;
  const s = mean(duskTable(a)), f = mean(duskTable(a, true));
  check(`the ground takes less light than the walls (${a})`, f < s - 4, `ground ${f.toFixed(1)} vs standing ${s.toFixed(1)}`);
}

// THE WINDOWS BLAZE BECAUSE THE CITY DARKENS, not because the key changed.
// '-' is a fixed point; what the evening does is take everything else below
// it. At noon three surface keys out-shine a lit window; at dusk none do.
{
  const t = duskTable(DUSK_AMOUNT);
  // Through the TABLE, not the day key: reading lumOf("-") here would hold
  // the window at its noon value however far the evening had dimmed it, and
  // a lit window that dims with the city would sail through.
  const dayAbove = SURFACE.filter((k) => lumOf(k) > lumOf("-")).length;
  const duskAbove = SURFACE.filter((k) => lumOf(t[k]) > lumOf(t["-"])).length;
  check("a lit window out-shines every surface in the city at dusk", duskAbove === 0, `${dayAbove} surface keys above it at noon, ${duskAbove} at dusk`);
  check("…and it did not do so at noon (or the claim is empty)", dayAbove > 0, `${dayAbove}`);
  // AND THE PANE BESIDE IT GOES DARK. '=' is unlit glass and it is NOT in the
  // fixed set: it is the window a light is not behind, and the gap between it
  // and '-' opening up is what "the lights are on" looks like from the street.
  const gapDay = lumOf("-") - lumOf("=");
  const gapDusk = lumOf(t["-"]) - lumOf(t["="]);
  check("the gap between a lit pane and an unlit one opens at dusk", gapDusk > gapDay + 10, `${gapDay.toFixed(0)} → ${gapDusk.toFixed(0)}`);
}

// COMPOSITION, NOT REPLACEMENT. The item's own tint runs first — the water's
// cycle frame, a species skin, the refused-placement red — and the evening
// over the top of it. A table that replaced the item's would put the river
// back to its first frame every night.
{
  const t = duskTable(1);
  const frame = art.waterTint(3);
  const c = withDusk(frame, t);
  const wrong = KEYS.filter((k) => c[k] !== (t[frame[k] ?? k] ?? frame[k] ?? k));
  check("the evening composes over the item's tint, in that order", wrong.length === 0, wrong.slice(0, 4).join(" "));
  check("…and a cycling river still cycles under it", art.waterTint(0) !== frame && withDusk(art.waterTint(0), t) !== c);
  check("…and with no evening the item's own tint is passed through UNCHANGED, same object", withDusk(frame, null) === frame);
  check("…and with no item tint the evening is passed through, same object", withDusk(null, t) === t);
  check("…and the composite is cached by identity", withDusk(frame, t) === c);
}

// The plate beyond the map goes with it: one knob owns the exposure.
{
  const BG = "#d6d1bf";
  check("the background is untouched at amount 0", duskBackground(BG, 0) === BG);
  const night = duskBackground(BG, 1);
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  check("…and darker at amount 1", lum(hex(night)) < lum(hex(BG)) - 20, `${lum(hex(BG)).toFixed(0)} → ${lum(hex(night)).toFixed(0)}`);
  check("…and it takes the SKY's light, not the sun's", hex(night)[2] > hex(night)[0], `#${night.slice(1)}`);
  check("evening() is the function that says so", duskBackground(BG, 1) === `#${evening(hex(BG), 1, 0).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`);
}

// ---- the renderer ----------------------------------------------------------------
const world = createWorld({ seed: "dusk-check" });
const put = (tx, ty, zone, tier) => {
  const i = ty * world.w + tx;
  world.zone[i] = zone; world.tier[i] = tier; world.variant[i] = (tx * 7 + ty * 13) & 255;
  const cap = capacityOf(world, i) || 1;
  world.occupants[i] = cap; world.staff[i] = cap;
};
for (let t = 3; t < 22; t++) world.road[11 * world.w + t] = ROAD.ROAD;
put(6, 9, ZONE.R, 1); put(9, 9, ZONE.R, 3); put(12, 9, ZONE.C, 3); put(15, 9, ZONE.I, 2);
for (let t = 5; t < 20; t += 4) world.terrain[13 * world.w + t] = TERRAIN.TREE;
for (let t = 4; t < 20; t++) world.terrain[6 * world.w + t] = TERRAIN.WATER; // a river, for the composition check below

const W = 420, H = 300;
const canvas = createCanvas(W, H);
const r = createRenderer(canvas, world, art);
r.resize();
const camera = { x: 60, y: 330, zoom: 2 };
// dt DEFAULTS TO ZERO so the renderer's own clock stands still: the river
// palette-cycles on it, and a byte-for-byte comparison of two frames taken a
// few draws apart would otherwise be comparing two moments as well as two
// settings. The one check that wants the clock to move asks for it.
const grab = (dt = 0) => { r.draw(camera, null, null, "off", dt); return canvas.getContext("2d").getImageData(0, 0, W, H).data.slice(); };
const differ = (a, b) => { let n = 0; for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++; return n; };
const meanLum = (d) => { let s = 0; for (let i = 0; i < d.length; i += 4) s += lum([d[i], d[i + 1], d[i + 2]]); return (4 * s) / d.length; };

// A FRESH RENDERER IS IN DAYLIGHT. Nothing else here would notice if the
// default became nightfall — every other check sets it explicitly.
check("a fresh renderer is in daylight", r.dusk === 0, `${r.dusk}`);

const day = grab(), day2 = grab();
check("daylight renders identically twice", day.every((v, i) => v === day2[i]));

r.setDusk(DUSK_AMOUNT);
const night = grab();
let changed = 0;
for (let i = 0; i < day.length; i += 4) if (day[i] !== night[i] || day[i + 1] !== night[i + 1] || day[i + 2] !== night[i + 2]) changed++;
check("the evening changes the frame at all", changed > 0.8 * (W * H), `${changed} of ${W * H} px`);
check("…and darkens it", meanLum(night) < meanLum(day) - 15, `${meanLum(day).toFixed(1)} → ${meanLum(night).toFixed(1)}`);

// WHAT IS LAWN IS MEASURED, NOT READ OFF THE COLOUR. A grass key is also what
// a park's plinth, a block's garden and a terrace planter are painted with, and
// those STAND: they take the standing table by design (a recipe's own top face
// is the standing brief's recorded guess). This rig had nothing green standing
// in view until T3.2's apartment grew a planter on its terrace, and the lawn
// check below failed on it. So the same frame is drawn once more with nothing
// standing on the map — the river alone — and a pixel is open lawn only where
// the two frames agree BY DAY AND AT DUSK. By day alone is not enough: the
// planter's soil is 'p', and at (90, 63) so is the grass texture under it, so
// the two frames agreed at noon and parted at nightfall. This is not circular —
// the lawn is then held to dusk.js's FLAT TABLE, not to the empty frame, so a
// renderer that paints the ground with the wrong table is wrong in both frames
// alike and still fails below.
const bareWorld = createWorld({ seed: "dusk-check" });
for (let t = 4; t < 20; t++) bareWorld.terrain[6 * bareWorld.w + t] = TERRAIN.WATER;
const bareCanvas = createCanvas(W, H);
const bareR = createRenderer(bareCanvas, bareWorld, art);
bareR.resize();
const grabBare = () => { bareR.draw(camera, null, null, "off", 0); return bareCanvas.getContext("2d").getImageData(0, 0, W, H).data.slice(); };
const bareDay = grabBare();
bareR.setDusk(DUSK_AMOUNT);
const bareNight = grabBare();
const same = (a, b, p) => a[p] === b[p] && a[p + 1] === b[p + 1] && a[p + 2] === b[p + 2];
const open = (x, y) => { const p = 4 * (y * W + x); return same(day, bareDay, p) && same(night, bareNight, p); };

// THE GROUND LAYER. It is offscreen and it survives frames, so a `setDusk`
// that forgot to mark it dirty would leave the lawn at noon under a city at
// nightfall — and every other check in this file would still pass. Sample
// only tiles the buildings cannot reach.
//
// AND SAY SO IN THE CHECK. The first four samples were placed by eye, and
// measured, three of them were not lawn at all: (40, 40) was the R3
// apartment's brick, (380, 60) the river, (400, 270) a tree's canopy. They
// passed because nearly every key changes at dusk — until T3.2 stepped the
// apartment back and put a LIT WINDOW, a dusk fixed point, on (40, 40), and
// "the ground layer went to dusk" failed on a building. These four are grass
// in the daylight frame and the same colour with every building, tree and road
// taken away (scanned on the tree before T3.2 and after it), and the premise is
// a check of its own, so the next building that reaches one fails as a broken
// FIXTURE rather than as a broken evening.
{
  const LAWN = [[30, 250], [390, 20], [380, 130], [320, 270]];
  const GRASS = RAMPS.grass.keys.split("").map((k) => colourOf(k).join(","));
  const notLawn = LAWN.filter(([x, y]) => { const p = 4 * (y * W + x); return !open(x, y) || !GRASS.includes([day[p], day[p + 1], day[p + 2]].join(",")); });
  check("the open-lawn samples are lawn — grass in daylight, with nothing standing on it (the fixture's premise)", notLawn.length === 0, notLawn.map(([x, y]) => `(${x},${y})`).join(" "));
  let moved = 0;
  for (const [x, y] of LAWN) { const p = 4 * (y * W + x); if (day[p] !== night[p] || day[p + 1] !== night[p + 1] || day[p + 2] !== night[p + 2]) moved++; }
  check("the static ground layer went to dusk with everything else", moved === LAWN.length, `${moved} of ${LAWN.length} open-lawn samples changed`);
}

// THE GROUND PLANE TAKES THE GROUND'S TABLE, and this is the check that can
// tell the difference between that and merely taking A table. Read an open
// lawn pixel's key out of the DAYLIGHT frame, then demand the dusk frame hold
// exactly what the FLAT table says that key becomes — not what the standing
// table says, which is a different key for 24 of the 64 and would otherwise
// pass everything above.
{
  const keyAt = (buf, x, y) => {
    const p = 4 * (y * W + x);
    return KEYS.find((k) => { const c = colourOf(k); return c[0] === buf[p] && c[1] === buf[p + 1] && c[2] === buf[p + 2]; }) || null;
  };
  const rgbAt = (buf, x, y) => { const p = 4 * (y * W + x); return [buf[p], buf[p + 1], buf[p + 2]]; };
  const flat = duskTable(DUSK_AMOUNT, true), stand = duskTable(DUSK_AMOUNT);
  let tested = 0, wrong = 0, discriminating = 0;
  for (let x = 20; x < W - 20; x += 17) {
    for (let y = 20; y < H - 20; y += 13) {
      const k = keyAt(day, x, y);
      if (!k || !rampOf(k)) continue; // a shadow or a blend: not a bare ground key
      const want = colourOf(flat[k]), got = rgbAt(night, x, y);
      if (flat[k] !== stand[k]) discriminating++;
      tested++;
      if (want[0] !== got[0] || want[1] !== got[1] || want[2] !== got[2]) wrong++;
    }
  }
  // Standing sprites are sampled too and they take the standing table, so the
  // claim is the weaker, decisive one: SOME pixels must follow the flat table
  // where the two tables disagree, and the lawn samples above must move.
  check("the frame is made of palette keys, so this check can read it", tested > 200, `${tested} sampled`);
  check("…and the two tables really do disagree on what it sampled", discriminating > 20, `${discriminating} of ${tested}`);
  // The lawn, key for key. Sampled rather than listed by coordinate: at dusk
  // the light is lower and the shadows are longer, so a patch of grass that
  // was clear at noon may be under one — and a shadowed pixel is a blend, not
  // a key. Take the pixels that are a GRASS key in both frames, with nothing
  // standing on them (`open`, above), and hold every one to the flat table.
  const GRASS_KEYS = RAMPS.grass.keys.split("");
  let lawn = 0, lawnWrong = 0, lawnStanding = 0;
  for (let x = 6; x < W - 6; x += 3) {
    for (let y = 6; y < H - 6; y += 3) {
      const k = keyAt(day, x, y);
      if (!k || !GRASS_KEYS.includes(k) || !open(x, y)) continue;
      const got = rgbAt(night, x, y);
      if (!keyAt(night, x, y)) continue; // under a shadow: a blend, not a key
      lawn++;
      const want = colourOf(flat[k]), other = colourOf(stand[k]);
      if (want[0] !== got[0] || want[1] !== got[1] || want[2] !== got[2]) lawnWrong++;
      if (other[0] === got[0] && other[1] === got[1] && other[2] === got[2] && flat[k] !== stand[k]) lawnStanding++;
    }
  }
  check("there is open lawn in the frame to read", lawn > 500, `${lawn} px`);
  check("the lawn is painted with the GROUND's table, key for key", lawnWrong === 0, `${lawnWrong} of ${lawn} px`);
  check("…and not one pixel of it took the standing table", lawnStanding === 0, `${lawnStanding} of ${lawn} px`);
  check("…on a frame where the two tables disagree about grass", GRASS_KEYS.some((k) => flat[k] !== stand[k]),
    GRASS_KEYS.map((k) => `${k}:${stand[k]}/${flat[k]}`).join(" "));
}

// THE NEUTRAL KNOB, and it is the whole additive claim: the renderer has been
// all the way to nightfall and back, and the frame is the frame it drew
// before art/dusk.js existed.
r.setDusk(0);
const back = grab();
check("daylight again is the ORIGINAL frame, byte for byte — the neutral knob", back.every((v, i) => v === day[i]));

// The hi-res twins take the table too: at zoom >= 2 the renderer blits the
// twin, not the 1x rows, and a table applied on only one path would leave
// half the city at noon depending on how far the camera was zoomed in.
for (const zoom of [1, 2, 4]) {
  camera.zoom = zoom;
  const d = grab();
  r.setDusk(DUSK_AMOUNT);
  const n = grab();
  r.setDusk(0);
  const d2 = grab();
  check(`the evening reaches the sprites drawn at zoom ${zoom}`, meanLum(n) < meanLum(d) - 10, `${meanLum(d).toFixed(1)} → ${meanLum(n).toFixed(1)}`);
  check(`…and comes back at zoom ${zoom}`, d2.every((v, i) => v === d[i]));
}
camera.zoom = 2;

// COMPOSITION, AT THE RENDERER. The table check above proves `withDusk`
// composes; this proves the renderer calls it rather than handing the
// evening over in place of the item's own tint. The river palette-cycles
// through six frames, so if the evening replaced that tint the water would
// freeze at nightfall and nothing else here would notice.
{
  const cycle = (label) => {
    const a = grab(0);
    let most = 0;
    for (let i = 0; i < 8; i++) most = Math.max(most, differ(a, grab(0.3)));
    return most;
  };
  r.setDusk(0);
  const byDay = cycle("day");
  r.setDusk(DUSK_AMOUNT);
  const byDusk = cycle("dusk");
  check("the river cycles in daylight (or the check is empty)", byDay > 200, `${byDay} px`);
  check("…and still cycles at dusk — the evening composes over the item's tint", byDusk > 0.4 * byDay, `${byDusk} px against ${byDay} by day`);
  r.setDusk(0);
}

// THE SHADOW PASS IS THE SAME PASS. It is drawn through blitMask, which does
// not take the table at all — the evening lengthens the light (a multiplier
// on SHADOW_K, so the owner's Q1 still owns the length) and never repaints
// it. With the shadows off entirely the evening must still be an evening.
{
  r.setShadows(false);
  const d = grab();
  r.setDusk(DUSK_AMOUNT);
  const n = grab();
  check("with the shadows off, the evening is still an evening", meanLum(n) < meanLum(d) - 15, `${meanLum(d).toFixed(1)} → ${meanLum(n).toFixed(1)}`);
  r.setDusk(0);
  const b = grab();
  check("…and the neutral knob holds with them off too", b.every((v, i) => v === d[i]));
  r.setShadows(true);
  // The light lowers: the same solids, further. Counted against the daylight
  // frame with the standing pass identical either side of it.
  const litDay = grab();
  r.setDusk(DUSK_AMOUNT);
  const litNight = grab();
  const shade = (f, base) => { let n2 = 0; for (let i = 0; i < f.length; i += 4) if (f[i] !== base[i]) n2++; return n2; };
  check("the evening lengthens the shadows rather than repainting them",
    shade(litNight, n) > shade(litDay, d), `${shade(litDay, d)} px at noon, ${shade(litNight, n)} at dusk`);
  r.setDusk(0);
}

console.log(`Dusk checks passed: ${checks} checks · ${changed} px of a ${W}×${H} frame moved at amount ${DUSK_AMOUNT} · mean luminance ${meanLum(day).toFixed(1)} → ${meanLum(night).toFixed(1)}`);
