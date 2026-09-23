// dusk.js — THE EVENING, AS ONE TABLE. SPEC §12.1.
// docs/PROPOSAL-SPRITE-UPGRADE-2026-09-22.md, T1.5.
//
// Nothing here is drawn. The evening is a key → key map handed to
// `rasterize(rows, tint)`, which is the same door a species skin, an autumn
// tree and the water's palette cycle already come through, so every sprite in
// the game goes dark at once and not one of them is re-authored. At amount 0
// the table is `null` and the renderer is the renderer that existed before
// this file — the neutral knob, byte for byte.
//
// ---------------------------------------------------------------------------
// THE RAMP INDEX IS THE FACE, AND THAT IS THE WHOLE TRICK.
//
// A real evening is not "everything darker". It is a low warm sun on the
// faces that can see it and a cold blue sky filling the faces that cannot —
// two different colours of light, told apart by which way a surface points.
// A key → key table knows nothing about facing. But `litSkin` (solid.js) has
// always given the TOP face a ramp's bright rung, the side its middle and the
// end its darkest, so within a ramp the INDEX already says which way the
// surface is pointing. Warm the bright rungs, cool the dark ones, and a table
// with no geometry in it lights the city from a direction.
//
// ---------------------------------------------------------------------------
// FOUND, NOT AUTHORED, AND IT COST NO NEW COLOUR. Each key's evening colour
// is computed from its own daylight hex and then projected onto the NEAREST
// key the palette already has — 74 destinations for 74 sources, not one of
// them added for this. (A `night` ramp of four cool darks WAS built for the
// shadow sides to land on. Rendered both ways it moved the frame's mean by
// 0.1 and nothing the eye could find, so it is not in the palette and the
// reasoning is recorded there.) Nobody picks a dusk colour for
// terracotta; terracotta at dusk is whatever key is closest to terracotta
// with the sun going down on it. The projection is what makes this cheap, and
// it is also what makes it checkable: a table is a list of pairs, and
// check-dusk.mjs can ask whether any ramp inverts, whether the canopy is
// still darker than the grass, and whether the thing that was brightest is
// still brightest. (It is the same move `roof-furniture.js` makes with the
// decks a recipe already has, and `remapRamp` with a ramp's indices.)
//
// WHAT DOES NOT DIM. Five lights and four marks. The lit window '-', fire
// '8', its tip '9', the zot '0' — a lamp does not get dimmer because the sun
// went down, and the whole point of an evening is that the windows come out.
// The zone chalk '5' '6' '7' 'A' is survey paint, not a surface, and the
// palette's own comments record that R chalk and M chalk each had to be
// tuned by hand to not vanish into the grass; a table that re-projects them
// re-opens a solved problem, and measured, it does: '5' lands ON grass light,
// 101 units of separation down to 46. The shadow key '+' is a fixed point for
// a different reason — it is the shadow, at every hour.
//
// Unlit glass '=' is NOT in that set and is projected like any surface. It is
// the pane a light is not behind, and the gap between it and '-' opening up
// is exactly what "the lights are on" looks like from the street.

import { KEYS, RAMPS, colourOf, rampOf } from "./palette.js";

/** The low sun, and the sky that fills what it cannot reach. */
const SUN = [255, 146, 64];
const SKY = [44, 66, 120];

// How far a rung is carried toward its light at the extremes of its ramp, and
// how much of its value it loses. THE DIM IS SMALL AND THE COOL IS LARGE on
// purpose: the palette's floor is PINNED — check-shadows.mjs holds the shadow
// key '+' within 3 of the darkest key there is, so nothing may be added below
// slate without breaking the shadow's claim on being a near-black — and an
// evening that tried to take its darkness out of VALUE runs every
// shadow-side face in the game onto the same key: measured, the dark rungs
// of all fifteen ramps land on FOUR keys between them. So it takes it out of
// HUE, and the rest comes from the shadows, which is where a low sun
// actually puts it (render.js multiplies SHADOW_K by the amount).
const WARM = 0.14;
const COOL = 0.72;
const DIM_TOP = 0.26;
const DIM_END = 0.28;

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/**
 * One key's colour at a given amount of evening. `u` is where the rung sits
 * in its own ramp: 0 is the end face, 1 the top. Exported because the
 * background beyond the map takes the same light (`duskBackground`) and
 * because a check that recomputes it is not a check.
 */
export function evening(rgb, amount, u) {
  const toward = u >= 0.5 ? SUN : SKY;
  const w = u >= 0.5 ? WARM * (2 * u - 1) : COOL * (1 - 2 * u);
  const dim = DIM_TOP + (DIM_END - DIM_TOP) * (1 - u);
  return mix(rgb, toward, w * amount).map((v) => Math.max(0, Math.min(255, v * (1 - amount * dim))));
}

/** The lights and the marks: fixed points at every amount. */
export const FIXED = Object.freeze(["+", "-", "8", "9", "0", "5", "6", "7", "A"]);
const isFixed = new Set(FIXED);

/** Only ramp keys are destinations — a wall must never be handed the shadow's key or the fire's. */
const DEST = KEYS.filter((k) => rampOf(k));

// An accent belongs to no ramp, so there is no index to read its facing off
// and it takes the neutral middle — except the one whose facing we know from
// what it is. GLASS SHOWS THE SKY, NOT THE SUN: an unlit pane is a mirror
// pointed at the one thing in an evening that is still bright and blue, so it
// takes the cool end of the light (`u = 0`) however its wall is turned.
const ACCENT_RUNG = { "=": 0 };

/** Where a key sits in its own ramp, 0 → 1. */
function rungOf(key) {
  const r = rampOf(key);
  if (!r) return ACCENT_RUNG[key] ?? 0.5;
  const n = RAMPS[r.name].keys.length;
  return n === 1 ? 1 : r.index / (n - 1);
}

// Value first, then hue: the luminance term is weighted 3× so a rung's place
// in its ramp outranks its colour when the two disagree. Measured over the
// whole palette at full amount, that alone keeps 29 of 64 keys inside their
// own ramp — brick stays brick, terracotta stays terracotta — where an
// unweighted nearest sends a road to timber and a roof to rust.
//
// `ceiling` says the obvious thing: NOTHING GETS BRIGHTER AS THE SUN GOES
// DOWN. It is needed because the projection can
// otherwise walk a key UP into a neighbouring ramp — at amount 0.55 the
// terracotta roof landed on a rust rung above its own and came out brighter
// at dusk than at noon, which in a frame reads as a lamp on the roof. The
// lights and the marks are exempt by being fixed points, which is the only
// exemption there is.
//
// THERE IS NO MATCHING FLOOR, AND THERE WAS ONE FOR A WHILE. A ramp's order
// IS its shading, so the first draft carried the previous rung's luminance
// down the ramp as a lower bound and made the image monotone by
// construction. Two things killed it. It never fired — swept over 100
// amounts × both tables × every adjacent pair in the palette, 6,000 of them,
// the ceiling alone leaves NOT ONE inversion, so the bound was dead code a
// mutant could delete with the suite still green. And it was the wrong
// SHAPE: a constraint that silently straightens a ramp the transform bent
// hides a bad transform, where a check that asks the question names it. The
// property is asserted in check-dusk.mjs and enforced nowhere.
//
// A destination in another ramp pays 60% more. A MATERIAL IS NOT A COLOUR:
// two keys can sit a pixel apart in RGB and mean brick and roof tile, and a
// projection that does not know the difference will trade one for the other
// for a rounding error. With the toll, terracotta at dusk is terracotta a
// rung down (BCDE → 1BCD) and only moves ramp when the light really has
// taken it somewhere else — 36 of 64 keys stay home at full amount against
// 29 without it, and every one that leaves has a reason.
const HOME = 0.6;

function nearest(want, ownRamp, ceiling = Infinity) {
  let best = null;
  let bd = Infinity;
  for (const d of DEST) {
    const c = colourOf(d);
    if (lum(c) > ceiling + 0.01) continue;
    const dl = lum(want) - lum(c);
    let v = 3 * dl * dl + (want[0] - c[0]) ** 2 + (want[1] - c[1]) ** 2 + (want[2] - c[2]) ** 2;
    if (rampOf(d).name !== ownRamp) v *= 1 + HOME;
    if (v < bd) { bd = v; best = d; }
  }
  return best ?? DEST.reduce((a, b) => (lum(colourOf(b)) > lum(colourOf(a)) ? b : a));
}

// THE GROUND PLANE IS THE ONE FACING THE RENDERER KNOWS. The table reads a
// rung's index as its facing (above), and for anything that stands that is
// the best guess there is. For the ground it is not a guess at all: the
// static layer IS the horizontal plane — grass, road, chalk, kerb, bridge —
// and at dusk a horizontal surface takes the sun at a grazing angle and gets
// its light from the sky instead. So the ground is projected with its rungs
// capped at the cool end, which costs the lawn one more rung than the walls
// beside it and is why an evening here does not read as an overcast
// afternoon. It is the same table, asked a different question, not a second
// darkening on its own schedule — one knob still owns the exposure.
const FLAT_U = 0.3;

const TABLES = new Map();

/**
 * The evening as a tint table, or `null` at amount 0 — and `null` is the
 * point: it is not an identity table that happens to change nothing, it is
 * the absence of a table, so the renderer takes the same branch it took
 * before this file existed and the frame is the old frame to the byte.
 * Tables are cached and frozen: the sprite cache keys on the tint's identity.
 */
export function duskTable(amount, flat = false) {
  const a = Math.max(0, Math.min(1, Number(amount) || 0));
  if (a === 0) return null;
  const id = flat ? `${a}@flat` : `${a}`;
  const hit = TABLES.get(id);
  if (hit) return hit;
  const cap = (u) => (flat ? Math.min(u, FLAT_U) : u);
  const map = {};
  // Ramp by ramp, so each key knows which ramp it is loyal to: see `nearest`.
  for (const [name, ramp] of Object.entries(RAMPS)) {
    const keys = ramp.keys.split("");
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (isFixed.has(k)) { map[k] = k; continue; }
      const u = keys.length === 1 ? 1 : i / (keys.length - 1);
      map[k] = nearest(evening(colourOf(k), a, cap(u)), name, lum(colourOf(k)));
    }
  }
  // The accents, which belong to no ramp — no rung above them, none below,
  // and no home to be loyal to.
  for (const k of KEYS) {
    if (map[k] != null) continue;
    map[k] = isFixed.has(k) ? k : nearest(evening(colourOf(k), a, cap(rungOf(k))), null, lum(colourOf(k)));
  }
  const t = Object.freeze(map);
  TABLES.set(id, t);
  return t;
}

/**
 * Two tables, in the order a pixel meets them: the item's own tint first (the
 * water's cycle frame, a species skin, the refused-placement red), the
 * evening second. Composition, not replacement — a table that overwrote the
 * item's would put the river back to its first frame every night. Cached on
 * the item's tint object, which the renderer reuses.
 */
const COMPOSED = new WeakMap();
export function withDusk(tint, dusk) {
  if (!dusk) return tint || null;
  if (!tint) return dusk;
  let byAmount = COMPOSED.get(tint);
  if (!byAmount) { byAmount = new Map(); COMPOSED.set(tint, byAmount); }
  const hit = byAmount.get(dusk);
  if (hit) return hit;
  const out = {};
  for (const k of KEYS) {
    const mid = tint[k] ?? k;
    out[k] = dusk[mid] ?? mid;
  }
  const frozen = Object.freeze(out);
  byAmount.set(dusk, frozen);
  return frozen;
}

/**
 * The plate beyond the map. It is a CSS fill and not a sprite, so it is the
 * exact evening colour and not a projection of it — and it takes the SKY half
 * of the light (`u = 0`), because nothing out there faces the sun.
 * One knob owns the exposure: if the surround darkened on its own schedule
 * neither it nor the table would be tunable.
 */
export function duskBackground(hex, amount) {
  const a = Math.max(0, Math.min(1, Number(amount) || 0));
  if (a === 0) return hex;
  const n = parseInt(hex.slice(1), 16);
  const rgb = evening([(n >> 16) & 255, (n >> 8) & 255, n & 255], a, 0);
  return `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * THE ONE SETTING THE PLAYER GETS, and it is one because the palette says so.
 *
 * The function takes an amount and the sheet sweeps it, but a projected
 * evening is NOT smooth: a ramp's rungs are ~25 luminance apart, so a small
 * amount moves nothing and a middling one moves the keys that happen to sit
 * near a boundary and leaves the rest at noon. Measured over the 64 ramp
 * keys — 5 of them move at 0.1, 42 at 0.4, 67 at 1.0, and between 0.4 and 0.7
 * only 11 to 20 keys are still in their own ramp, which in a frame is a
 * half-lit town with one roof lit up like a lamp. There is one coherent
 * setting in this palette and this is it.
 *
 * The amount survives as a parameter anyway, because it is what makes the
 * sheet an A/B and what a clock would feed if the game ever grew an hour.
 */
export const DUSK_AMOUNT = 1;
