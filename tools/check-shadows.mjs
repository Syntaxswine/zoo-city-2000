#!/usr/bin/env node
// tools/check-shadows.mjs — the gate on what a solid puts on the ground.
// docs/PROPOSAL-SPRITE-UPGRADE-2026-09-22.md, T1.1–T1.4. SPEC §12, §13.
//
// The verification named in the proposal BEFORE the work, run here:
//
//   every box recipe casts · one key only · the anchor inside the mask ·
//   k = 0 is the plan's own ground footprint · ink is monotone in k ·
//   the hi-res masks land on the same world point · the mask NEVER touches a
//   standing sprite's pixels · shadows off is byte-for-byte the pass that
//   existed before them · a billboard's ellipse is not stamped into its pose.
//
// THE ONE THAT MATTERS MOST is "never touches a standing sprite": a shadow
// that creeps over the thing casting it is the classic way this effect goes
// wrong, and it is invisible at alpha 0.28 in a screenshot. It is caught here
// by walking the building's OWN opaque pixels — placeAt gives their screen
// address — and demanding they be byte-identical with shadows off and on.

import assert from "node:assert/strict";
import { installCanvas, createCanvas } from "./headless-canvas.mjs";

installCanvas();

const { art, allSprites } = await import("../js/art/index.js");
const { shadow, billboardShadow, SHADOW_KEY, SHADOW_K } = await import("../js/art/shadow.js");
const { RECIPES } = await import("../js/art/solid.js");
const { ink } = await import("../js/art/format.js");
const { colourOf, KEYS } = await import("../js/art/palette.js");
const { placeAt } = await import("../js/iso/painter.js");
const { createWorld, ZONE, TERRAIN, ROAD, capacityOf, sideOf } = await import("../js/sim/world.js");
const { lightLevel } = await import("../js/art/building-character.js");
const { buildingAge, wearLevel } = await import("../js/sim/building-age.js");
const { policy } = await import("../js/sim/governance.js");
await import("../js/sim/ops.js");
await import("../js/sim/tick.js");
const { createRenderer } = await import("../js/render.js");

let checks = 0;
const check = (name, ok, detail = "") => {
  checks++;
  if (!ok) { console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`); process.exit(1); }
};

// ---- the masks -------------------------------------------------------------------
const list = allSprites();
const solids = list.filter(({ sprite }) => RECIPES.get(sprite)?.boxes);
// A floor against an EMPTY cast (a broken registry would pass every mask check vacuously), not a count to hold:
// it follows the registry down. 322 box recipes until zone 4's twenty-six zoned meat buildings were retired
// (2026-09-26 — meat is a placed market now), 296 after; the floor was 300 and is now 290.
check("there are solids to cast", solids.length >= 290, `${solids.length}`);

let cast = 0, badKey = 0, emptyMask = 0, anchorOut = 0, notMonotone = [];
for (const { name, sprite } of solids) {
  const m = shadow(sprite, { k: SHADOW_K });
  if (!m) continue;
  cast++;
  for (const row of m.rows) for (const ch of row) if (ch !== "." && ch !== SHADOW_KEY) badKey++;
  if (ink(m.rows) === 0) emptyMask++;
  // The camera regression: a solid whose boxes sit off to one side and up a
  // pole threw every rectangle clear of the hub, and the anchor fell outside
  // the grid. defineSprite would throw, but assert it in the open too.
  if (!(m.anchor[0] >= 0 && m.anchor[0] < m.w && m.anchor[1] >= 0 && m.anchor[1] < m.h)) anchorOut++;
  // LONGER LIGHT REACHES FURTHER — and that, not area, is what is monotone.
  // The first draft of this check asserted the darkened AREA grows with k and
  // three 3×3 blocks failed it (C3x3-emporium-1: 8855 → 8772 → 9863). They
  // were right and the check was wrong: a box that starts ABOVE the ground
  // (c0 > 0 — a roof slab, an overhang) has its rectangle begin at a0 + k·c0,
  // so as the light lowers its shadow slides OFF its own footprint, and where
  // the walls beneath are inset nothing else covers what it leaves. Area dips
  // and then grows. The REACH cannot: every box's far edge is a1 + k·c1 with
  // c1 ≥ 0, so the furthest shadowed pixel only ever advances.
  const tall = Math.max(...RECIPES.get(sprite).boxes.map((b) => b.c1));
  if (tall > 0) {
    const reach = (mask) => {
      let far = -Infinity;
      for (let y = 0; y < mask.h; y++) for (let x = 0; x < mask.w; x++) {
        if (mask.rows[y][x] === "." ) continue;
        const dx = x - mask.anchor[0], dy = y - mask.anchor[1];
        far = Math.max(far, dx / 2 + dy); // units of `a` from the anchor: x = 2a, y = a
      }
      return far;
    };
    const a = reach(shadow(sprite, { k: 0 })), b = reach(shadow(sprite, { k: 0.3 })), c = reach(m);
    // …and it must GROW exactly where the boxes say it must. Not everywhere:
    // the cemetery's reach is set by a low boundary wall at the front of the
    // plot, and the chapel behind it does not out-throw that wall at k = 0.55
    // (reach 32.0 / 32.0 / 32.0 — correct, and it read as a failure until the
    // check asked the geometry instead of assuming). A flat "non-decreasing"
    // would pass a mask that never moved at all, so the demand is conditional
    // on max(a1 + k·c1) actually advancing.
    const painted = RECIPES.get(sprite).boxes.filter((bx) => bx.faces && (bx.faces.top || bx.faces.side || bx.faces.end));
    const far = (kk) => Math.max(...painted.map((bx) => bx.a1 + kk * bx.c1));
    const mustGrow = far(SHADOW_K) > far(0) + 0.5;
    if (!(a <= b && b <= c && (!mustGrow || c > a))) notMonotone.push(`${name}: reach ${a.toFixed(1)}/${b.toFixed(1)}/${c.toFixed(1)}${mustGrow ? " (geometry says it must grow)" : ""}`);
  }
}
check("every box recipe casts a mask", cast === solids.length, `${cast} of ${solids.length}`);
check("a mask is painted in one key and no other", badKey === 0, `${badKey} stray pixels`);
check("no mask is empty", emptyMask === 0, `${emptyMask}`);
check("every mask's anchor is inside it (the camera case)", anchorOut === 0, `${anchorOut}`);
check("REACH is monotone in k, and area is not (a roof slab slides off its own footprint)", notMonotone.length === 0, notMonotone.slice(0, 3).join(" · "));
check("the camera casts and is anchored", !!shadow(art.camera(0)), "camera-0 threw nothing");

// A SHADOW MUST BE DARK, and saying so against the constant itself says
// nothing: `every pixel is SHADOW_KEY` passes whatever SHADOW_KEY is set to,
// so re-pointing it at asphalt-dark '1' survived the first mutation round
// untouched. The claim has to be about the COLOUR.
{
  const [kr, kg, kb] = colourOf(SHADOW_KEY);
  const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const mine = lum([kr, kg, kb]);
  const floor = Math.min(...KEYS.map((k) => lum(colourOf(k))));
  // NEAR-BLACK, not merely dark. "Darkest in the palette" was too strong by
  // 0.7: slate dark '<' (#23262B, 37.7) sits a hair under '+' (#2A2620,
  // 38.4), and both are the near-blacks. A plain "luminance < 48" is too
  // weak the other way — asphalt dark '1' is 44.1 and would sail through the
  // very mutation this check exists to catch. Within 3 of the palette floor
  // separates the two near-blacks from everything else in it.
  check("the shadow is painted in a near-black", mine <= floor + 3, `luminance ${mine.toFixed(1)} against a palette floor of ${floor.toFixed(1)}`);
}

// k = 0 is the PLAN's own ground footprint — not the tile diamond. Rebuilt
// here from the boxes independently of shadow.js, so the claim is checked
// against the geometry and not against the same code that made it.
{
  const { TO_X, TO_Y } = await import("../js/art/solid.js");
  let wrong = [];
  for (const { name, sprite } of solids.slice(0, 40)) {
    const recipe = RECIPES.get(sprite);
    const m = shadow(sprite, { k: 0 });
    // Every painted box's ground rectangle must lie inside the mask's ink,
    // and the mask must be no taller than the flattest possible plan.
    const painted = recipe.boxes.filter((b) => b.faces && (b.faces.top || b.faces.side || b.faces.end));
    const aMax = Math.max(...painted.map((b) => b.a1)), bMax = Math.max(...painted.map((b) => b.b1));
    const aMin = Math.min(...painted.map((b) => b.a0)), bMin = Math.min(...painted.map((b) => b.b0));
    // render() sizes a grid as ceil(maxY) - floor(minY) + 3 (a 1px pad each
    // side, plus the inclusive row). Spell it that way, not as a rounded
    // difference — the rounded form is one short whenever the plan's extents
    // are not integers, and it read R1-cottage-0 as 29 > 28.
    const wantH = Math.ceil(TO_Y(aMax, bMax, 0)) - Math.floor(TO_Y(aMin, bMin, 0)) + 3;
    if (m.h > wantH) wrong.push(`${name}: ${m.h} > ${wantH}`);
  }
  check("k = 0 is flat — the mask is the plan's ground footprint, no height in it", wrong.length === 0, wrong.slice(0, 3).join(" · "));
}

// The hi-res masks: the same world point, the ink within 12% of 4×, as the
// hires twins are held to in check.mjs.
{
  const bad = [];
  for (const { name, sprite } of solids.slice(0, 60)) {
    const one = shadow(sprite, { k: SHADOW_K }), two = shadow(sprite, { k: SHADOW_K, scale: 2 });
    if (!two) { bad.push(`${name}: no 2× mask`); continue; }
    const okAnchor = Math.abs(two.anchor[0] / 2 - one.anchor[0]) <= 1 && Math.abs(two.anchor[1] / 2 - one.anchor[1]) <= 1;
    const i1 = ink(one.rows), i4 = ink(two.rows) / 4;
    if (!okAnchor || Math.abs(i4 - i1) > Math.max(4, 0.12 * i1)) bad.push(`${name}: anchor ${one.anchor}→${two.anchor} ink ${i1}→${i4.toFixed(0)}`);
  }
  check("the 2× masks sit on the same world point with the ink within 12% of 4×", bad.length === 0, bad.slice(0, 3).join(" · "));
}

// A billboard's ellipse is a SEPARATE sprite, never stamped into the pose —
// check-closeups.mjs forbids a citizen twin expanding its silhouette and
// check.mjs pins allCitizens() at 3236.
{
  const citizen = art.citizen("fox", "se", 0, "adult");
  const blob = billboardShadow(citizen, { width: 0.3 });
  check("a citizen gets an ellipse", !!blob && ink(blob.rows) > 0);
  check("…in the shadow key only", blob.rows.every((r) => [...r].every((c) => c === "." || c === SHADOW_KEY)));
  check("…and the citizen's own rows are untouched", art.citizen("fox", "se", 0, "adult").rows.join("\n") === citizen.rows.join("\n"));
  check("…and it is not in the registry", !allSprites().some(({ sprite }) => sprite.tags.includes("shadow")), "a shadow reached allSprites()");
}

// ---- the renderer ----------------------------------------------------------------
const world = createWorld({ seed: "shadow-check" });
const put = (tx, ty, zone, tier) => {
  const i = ty * world.w + tx;
  world.zone[i] = zone; world.tier[i] = tier; world.variant[i] = (tx * 7 + ty * 13) & 255;
};
for (let t = 3; t < 22; t++) world.road[11 * world.w + t] = ROAD.ROAD;
put(6, 9, ZONE.R, 1); put(9, 9, ZONE.R, 3); put(12, 9, ZONE.C, 3); put(15, 9, ZONE.I, 2);
for (let t = 5; t < 20; t += 4) world.terrain[13 * world.w + t] = TERRAIN.TREE;

const W = 420, H = 300;
const canvas = createCanvas(W, H);
const r = createRenderer(canvas, world, art);
r.resize();
const camera = { x: 60, y: 330, zoom: 2 };
const grab = () => { r.draw(camera, null, null, "off"); return canvas.getContext("2d").getImageData(0, 0, W, H).data.slice(); };

// A FRESH RENDERER HAS THEM ON. Nothing else here notices if the default
// flips to false — every other check turns them on explicitly — and a game
// that ships with the pass switched off is the exact regression this arc is
// about. (It survived the first mutation round.)
check("a fresh renderer has shadows on", r.shadows === true, `${r.shadows}`);

r.setShadows(false);
const off = grab(), off2 = grab();
check("shadows off renders identically twice", off.every((v, i) => v === off2[i]));

r.setShadows(true, { k: SHADOW_K });
const on = grab();
let changed = 0;
for (let i = 0; i < off.length; i += 4) if (off[i] !== on[i] || off[i + 1] !== on[i + 1] || off[i + 2] !== on[i + 2]) changed++;
check("shadows on changes the frame at all", changed > 500, `${changed} px`);

r.setShadows(false);
const back = grab();
check("shadows off again is the ORIGINAL frame, byte for byte — the neutral knob", back.every((v, i) => v === off[i]));

// THE ONE THAT MATTERS. Every opaque pixel of a standing sprite must be
// untouched by the shadow pass. Walk the building's own rows through placeAt
// at full alpha, so one stray pixel is a whole-colour change.
//
// IT MUST ASK THE SPRITE THE RENDERER ACTUALLY BLITS. At zoom >= 2 that is
// the HI-RES TWIN, not the 1x rows: check-closeups holds the twin's INK equal
// to the scaled render's, which is not the same thing as the 1x silhouette
// doubled, so the two disagree along every edge. Sampling the 1x rows at
// zoom 2 read 176 of 24,448 pixels as shadowed — 88 on each of the two tall
// buildings, all of them at or below the anchor row at the extreme left and
// right, which is exactly the base corners where a twin's edge differs. The
// same check at zoom 1, where S = 1 and the 1x sprite IS what is drawn,
// found ZERO. That is the measurement that settled it, and both zooms are
// checked here so neither answer can hide the other.
r.setShadows(true, { k: SHADOW_K, alpha: 1, contact: 1 });
const [sr, sg, sb] = colourOf(SHADOW_KEY);
const hiScaleFor = (zoom) => (zoom >= 3 ? 4 : zoom >= 2 ? 2 : 1);
for (const zoom of [1, 2]) {
  camera.zoom = zoom;
  r.setShadows(false);
  const plain = grab();
  r.setShadows(true, { k: SHADOW_K, alpha: 1, contact: 1 });
  const full = grab();
  const v = r.view, S = hiScaleFor(zoom);
  let touched = 0, tested = 0;
  for (const [tx, ty] of [[6, 9], [9, 9], [12, 9], [15, 9]]) {
    const i = ty * world.w + tx;
    // The sprite the RENDERER chose, from render.js's own expression.
    const fill = (world.zone[i] === ZONE.R ? world.occupants[i] : world.staff[i]) / (capacityOf(world, i) || 1);
    const character = { lit: lightLevel(fill), majority: world.majority[i], seed: i, wear: Math.max(0, wearLevel(buildingAge(world, i)) - (policy(world, "cleaners") ? 1 : 0)) };
    const sprite = art.building(world.zone[i], world.tier[i], world.variant[i], sideOf(world, i), world.theme[i], character);
    const [sx, sy] = placeAt(sprite, tx, ty);
    const twin = S > 1 ? art.hires(sprite, S) : null;
    const drawn = twin || sprite;
    // blitScaled: a twin is laid at S·(sx + anchor) − twinAnchor in a space
    // scaled by z/S; a 1x sprite at (sx, sy) in a space scaled by z.
    const x0 = twin ? S * (sx + sprite.anchor[0]) - twin.anchor[0] : sx;
    const y0 = twin ? S * (sy + sprite.anchor[1]) - twin.anchor[1] : sy;
    const unit = twin ? v.zoom / S : v.zoom;
    for (let y = 0; y < drawn.h; y++) for (let x = 0; x < drawn.w; x++) {
      if (drawn.rows[y][x] === ".") continue;
      const dx = Math.round((x0 + x) * unit - Math.round(v.left * v.zoom));
      const dy = Math.round((y0 + y) * unit - Math.round(v.top * v.zoom));
      for (let oy = 0; oy < Math.max(1, Math.floor(unit)); oy++) for (let ox = 0; ox < Math.max(1, Math.floor(unit)); ox++) {
        const cx = dx + ox, cy = dy + oy;
        if (cx < 0 || cy < 0 || cx >= W || cy >= H) continue;
        const p = (cy * W + cx) * 4;
        tested++;
        if ((plain[p] !== full[p] || plain[p + 1] !== full[p + 1] || plain[p + 2] !== full[p + 2])
            && full[p] === sr && full[p + 1] === sg && full[p + 2] === sb) touched++;
      }
    }
  }
  check(`the shadow never lands on a pixel a building owns (zoom ${zoom}, S=${S})`, touched === 0, `${touched} of ${tested} building pixels went to the shadow colour`);
  check(`…and enough building pixels were looked at (zoom ${zoom})`, tested > 2000, `${tested}`);
}
camera.zoom = 2;

console.log(`Shadow checks passed: ${checks} checks · ${cast} masks · ${changed} px of a ${W}×${H} frame shadowed at k=${SHADOW_K}`);
