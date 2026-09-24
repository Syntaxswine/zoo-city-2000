#!/usr/bin/env node
// tools/zooprobe.mjs — CAN YOU TELL THE ANIMALS APART? A PASSIVE INSTRUMENT:
// it refuses nothing, it gives Tier 4 its numbers (PROPOSAL-SPRITE-UPGRADE
// §4, the standing brief's "one animal in fourteen coats").
//
//   node tools/zooprobe.mjs            the species, the closest pairs, the verdict
//   node tools/zooprobe.mjs --pairs N  the N closest pairs by each reading (default 12)
//
// An animal at 1× is carried by two things that can be pulled apart, because
// the kit composes every figure in AUTHORING keys (w x y z) and only then
// lays a coat over it (`CITIZEN_DETAILS.authored`, `coatMapOf`):
//
//   FORM   the two figures with the coat taken away — both drawn in the ONE
//          authoring coat, feet on the same pixel, on grass — and the mean
//          ΔE (CIELAB) over the union of their outlines. Ears, tails, builds,
//          markings, beaks, shells: everything but the colour of the fur.
//   COAT   the two coats with the figure taken away — the ΔE between the key
//          each coat lays on each authoring rung, weighted by how much of the
//          two figures is drawn in that rung.
//
// Each has a CONTROL from inside one species, so neither is a number without
// a floor (the standing brief, trap 15):
//
//   FORM   one animal against ITSELF mid-stride — the same body, legs apart:
//          a difference the eye reads as the same animal walking.
//   COAT   one animal against ITSELF one rung darker — the `shade` look bit,
//          half of every species: the same animal in a darker coat.
//
// A pair whose FORM is under the stride control is ONE ANIMAL IN TWO COATS:
// the figures differ less than one animal differs from itself taking a step,
// so only the fur tells them apart. If its COAT is ALSO under the shade
// control it is ONE ANIMAL — nothing the eye can use separates them. A pair
// under TWICE the stride control is CLOSE: its figures are told apart, but
// only just, and two close figures on one ramp wear each other's coat in some
// look (a shaded one is the other one's plain coat).
//
// Two readings about a coat on its own:
//
//   FLAT   a look or an age in which the coat lays the SAME key on the lit
//          rung (y) and the shaded rung (x) — the light is gone from the body.
//          A coat one rung down a four-rung ramp does it in its shaded look.
//   LOST   the lit rung's distance to the nearest key the ground is drawn in
//          (grass n o p, the road's 3 2 — every key that is a tenth of a tile).
//          The control is the tortoise's olive, which "vanished into the lawn"
//          (round 4, js/art/citizens.js): no coat may be as lost as that.
//
// `zooReadings({ coats })` reads any table of `[ramp, shift]` — FORM does not
// depend on the coat, so a table that is not live is read exactly.

import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { citizenSprite, coatMapOf, COATS, CITIZEN_DETAILS, SPECIES_IDS } from "../js/art/citizens.js";
import { colourOf } from "../js/art/palette.js";

const RUNGS = ["w", "x", "y", "z"];
const FUR = new Set(RUNGS);

const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
/** sRGB → CIELAB (D65). */
export function lab([r, g, b]) {
  const R = lin(r), G = lin(g), B = lin(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
const LAB = new Map();
export const labOf = (k) => { let v = LAB.get(k); if (!v) LAB.set(k, v = lab(colourOf(k))); return v; };
export const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dKeys = (a, b) => (a === b ? 0 : dE(labOf(a), labOf(b)));

/** The ground a FORM is judged on: grass mid, the lawn's commonest key. */
export const GROUND = "o";
/** The keys a walker's ground is drawn in, each a tenth or more of its tile (GRASS[0..2]; a straight road). */
export const GROUND_KEYS = Object.freeze({ grass: Object.freeze(["n", "o", "p"]), road: Object.freeze(["3", "2"]) });
/** The coat that vanished: the tortoise's table row, olive (round 4). */
export const LOST_CONTROL = Object.freeze(["olive", 0]);

/**
 * The figure in ONE coat: the real sprite, with every pixel the composer
 * drew as fur put back to its authoring key. Everything that is not fur —
 * shirt, eyes, marks, the tortoise's outline — stays exactly as drawn.
 */
export function bareFigure(sprite) {
  const info = CITIZEN_DETAILS.get(sprite);
  if (!info || !info.authored) throw new Error(`zooprobe: ${sprite.name} carries no authored figure`);
  return sprite.rows.map((r, y) => [...r].map((k, x) => (FUR.has(info.authored[y]?.[x]) ? info.authored[y][x] : k)).join(""));
}

/** Mean ΔE over the union of two figures' ink, feet on the same pixel, transparent = the ground. */
export function figureDistance(a, aAnchor, b, bAnchor) {
  let sum = 0, n = 0;
  const x0 = -Math.max(aAnchor[0], bAnchor[0]), y0 = -Math.max(aAnchor[1], bAnchor[1]);
  const x1 = Math.max(a[0].length - aAnchor[0], b[0].length - bAnchor[0]);
  const y1 = Math.max(a.length - aAnchor[1], b.length - bAnchor[1]);
  for (let dy = y0; dy < y1; dy++) for (let dx = x0; dx < x1; dx++) {
    const ka = a[dy + aAnchor[1]]?.[dx + aAnchor[0]] ?? ".", kb = b[dy + bAnchor[1]]?.[dx + bAnchor[0]] ?? ".";
    if (ka === "." && kb === ".") continue;
    sum += dKeys(ka === "." ? GROUND : ka, kb === "." ? GROUND : kb);
    n++;
  }
  return n ? sum / n : 0;
}

/** How much of the figures is drawn in each authoring rung. */
function rungCounts(sprites) {
  const c = { w: 0, x: 0, y: 0, z: 0 };
  for (const s of sprites) for (const r of CITIZEN_DETAILS.get(s).authored) for (const k of r) if (k in c) c[k]++;
  return c;
}

/** ΔE between two coat maps, weighted by rung use. */
export function coatDistance(ma, mb, counts) {
  let sum = 0, n = 0;
  for (const k of RUNGS) { sum += counts[k] * dKeys(ma[k], mb[k]); n += counts[k]; }
  return n ? sum / n : 0;
}

/** Every look and age a coat is worn in: adult and elder, plain and shaded. */
export function coatLooks(coat) {
  return [
    { look: "adult", map: coatMapOf(coat, false, 0) },
    { look: "adult shaded", map: coatMapOf(coat, false, 1) },
    { look: "elder", map: coatMapOf(coat, true, 0) },
    { look: "elder shaded", map: coatMapOf(coat, true, 1) },
  ];
}

/** LOST: the lit rung's distance to the nearest key its ground is drawn in. */
export function lost(map) {
  let best = Infinity, at = "";
  for (const [ground, keys] of Object.entries(GROUND_KEYS)) for (const k of keys) {
    const d = dKeys(map.y, k);
    if (d < best) { best = d; at = `${ground} '${k}'`; }
  }
  return { distance: best, nearest: at };
}

/** The figures a coat is judged on: adult, standing, facing SE and NE. */
const FACINGS = ["se", "ne"];
const adult = (sp, facing, frame = 0, look = { shade: 0, mark: 0 }) => citizenSprite(sp, facing, frame, "adult", { look });

/**
 * Every species and every pair. Pure: reads the art, writes nothing.
 * `coats` — any table of `[ramp, shift]` by species (default: the live one).
 */
export function zooReadings({ ids = SPECIES_IDS, coats = COATS } = {}) {
  const species = {};
  for (const sp of ids) {
    const coat = coats[sp];
    if (!coat) throw new Error(`zooprobe: no coat for '${sp}'`);
    const stand = FACINGS.map((f) => adult(sp, f));
    const stride = FACINGS.map((f) => adult(sp, f, 1));
    const counts = rungCounts(stand);
    const strideForm = FACINGS.reduce((t, _, i) => t + figureDistance(bareFigure(stand[i]), stand[i].anchor, bareFigure(stride[i]), stride[i].anchor), 0) / FACINGS.length;
    const looks = coatLooks(coat);
    const shadeCoat = coatDistance(looks[0].map, looks[1].map, counts);
    const flat = looks.filter((l) => l.map.x === l.map.y).map((l) => l.look);
    let worst = { distance: Infinity };
    for (const l of looks) { const r = lost(l.map); if (r.distance < worst.distance) worst = { ...r, look: l.look }; }
    species[sp] = { coat, stand, counts, strideForm, shadeCoat, map: looks[0].map, flat, lost: worst };
  }
  const pairs = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const A = species[ids[i]], B = species[ids[j]];
    const form = FACINGS.reduce((t, _, f) => t + figureDistance(bareFigure(A.stand[f]), A.stand[f].anchor, bareFigure(B.stand[f]), B.stand[f].anchor), 0) / FACINGS.length;
    const both = { w: A.counts.w + B.counts.w, x: A.counts.x + B.counts.x, y: A.counts.y + B.counts.y, z: A.counts.z + B.counts.z };
    const coat = coatDistance(A.map, B.map, both);
    const formFloor = Math.max(A.strideForm, B.strideForm), coatFloor = Math.max(A.shadeCoat, B.shadeCoat);
    pairs.push({ a: ids[i], b: ids[j], form, coat, formFloor, coatFloor,
      oneForm: form < formFloor, oneCoat: coat < coatFloor, close: form < 2 * formFloor,
      sameRamp: A.coat[0] === B.coat[0] });
  }
  const tables = new Map();
  for (const sp of ids) { const k = species[sp].coat.join(""); tables.set(k, [...(tables.get(k) || []), sp]); }
  return {
    species, pairs,
    distinct: tables.size,
    shared: [...tables.values()].filter((v) => v.length > 1),
    oneAnimal: pairs.filter((p) => p.oneForm && p.oneCoat),
    twoCoats: pairs.filter((p) => p.oneForm && !p.oneCoat),
    closeOnOneRamp: pairs.filter((p) => p.close && p.sameRamp),
    flat: ids.filter((sp) => species[sp].flat.length),
    lostControl: lost(coatMapOf(LOST_CONTROL, false, 0)).distance,
  };
}

// ---- CLI -------------------------------------------------------------------
const here = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(here)) {
  const argv = process.argv.slice(2);
  const nAt = argv.indexOf("--pairs");
  const N = nAt >= 0 ? Math.max(1, parseInt(argv[nAt + 1], 10) || 12) : 12;
  const R = zooReadings();
  const { species, pairs } = R;
  console.log("zooprobe — adult, standing, SE and NE averaged. FORM = the figures in one coat, on grass 'o'; COAT = the coats on one figure.");
  console.log(`\nspecies    coat         w x y z   stride FORM · shade COAT   flat looks            LOST (the olive control: ${R.lostControl.toFixed(1)})`);
  for (const [sp, s] of Object.entries(species))
    console.log(`  ${sp.padEnd(9)} ${(s.coat[0] + (s.coat[1] >= 0 ? "+" : "") + s.coat[1]).padEnd(11)} ${RUNGS.map((k) => s.map[k]).join(" ")}   ${s.strideForm.toFixed(1).padStart(5)} · ${s.shadeCoat.toFixed(1).padStart(5)}        ${(s.flat.join(", ") || "-").padEnd(20)}  ${s.lost.distance.toFixed(1).padStart(5)} ${s.lost.look}, ${s.lost.nearest}${s.lost.distance <= R.lostControl ? "   LOST" : ""}`);
  for (const key of ["form", "coat"]) {
    console.log(`\nclosest ${N} by ${key.toUpperCase()}:`);
    for (const p of [...pairs].sort((p, q) => p[key] - q[key]).slice(0, N))
      console.log(`  ${p.a.padEnd(9)} ${p.b.padEnd(9)} FORM ${p.form.toFixed(1).padStart(5)} (floor ${p.formFloor.toFixed(1)})  COAT ${p.coat.toFixed(1).padStart(5)} (floor ${p.coatFloor.toFixed(1)})${p.oneForm && p.oneCoat ? "   ONE ANIMAL" : p.oneForm ? "   one animal in two coats" : p.close && p.sameRamp ? "   close, one ramp" : ""}`);
  }
  const names = (ps) => ps.map((p) => `${p.a}/${p.b}`).join(", ");
  console.log(`\n${R.distinct} distinct coats for ${Object.keys(species).length} species${R.shared.length ? " — shared: " + R.shared.map((v) => v.join("+")).join(", ") : ""}`);
  console.log(`ONE ANIMAL ${R.oneAnimal.length}${R.oneAnimal.length ? " (" + names(R.oneAnimal) + ")" : ""} · one animal in two coats ${R.twoCoats.length}${R.twoCoats.length ? " (" + names(R.twoCoats) + ")" : ""} · close figures on one ramp ${R.closeOnOneRamp.length}${R.closeOnOneRamp.length ? " (" + names(R.closeOnOneRamp) + ")" : ""}`);
  const lostOnes = Object.entries(species).filter(([, s]) => s.lost.distance <= R.lostControl).map(([sp]) => sp);
  console.log(`flat in some look ${R.flat.length}${R.flat.length ? " (" + R.flat.join(", ") + ")" : ""} · as lost as the olive tortoise ${lostOnes.length}${lostOnes.length ? " (" + lostOnes.join(", ") + ")" : ""}`);
}
