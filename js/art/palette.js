// palette.js — the whole game's colour, in ramps. SPEC §12.1.
//
// Every sprite and every composer draws from these keys and no others. Ramps
// run DARK -> LIGHT; shadows shift cool, highlights shift warm. Nothing here
// is a pure hue. Accents are a handful of pixels each (zone chalk, fire,
// zots, glass, lit windows) and sit outside the ramp discipline on purpose.
//
// THE LOAD-BEARING RELATIONSHIP (kept from Glades of Arcadia): grass mid
// (#74863C) is LIGHTER than canopy mid (#47632F). Trees must read dark
// against the ground or a busy map turns to mush. Do not.

export const RAMPS = {
  grass:    { keys: "mnop",   hex: ["#3B4A22", "#55672D", "#74863C", "#96A551"] },
  canopy:   { keys: "abcde",  hex: ["#1E2A1C", "#2F4526", "#47632F", "#6B8A3E", "#9DB255"] },
  earth:    { keys: "qrstu",  hex: ["#3A2A1C", "#57402A", "#7A5C3C", "#9E7D52", "#C0A176"] },
  // Six steps so the water can palette-cycle; span held at ~30% dark->light
  // (a wide span reads as churn, not a surface — measured in Glades).
  water:    { keys: "FGHIJK", hex: ["#122E38", "#1A3F4A", "#23515A", "#2F6168", "#3C7274", "#4B807F"] },
  asphalt:  { keys: "1234",   hex: ["#2A2C33", "#43464F", "#5C606B", "#8A8E99"] },
  brick:    { keys: "!@#$",   hex: ["#4A2620", "#7A3A2E", "#A8563F", "#D08A6A"] },
  concrete: { keys: "%^&*(",  hex: ["#3F4650", "#5B6470", "#7C8794", "#A3ADB8", "#CBD3DA"] },
  rust:     { keys: "{}[]",   hex: ["#4A3214", "#7A5420", "#A87A2E", "#D0A756"] },
  slate:    { keys: "<>?",    hex: ["#23262B", "#3D4148", "#5A5F68"] },
  furWarm:  { keys: "wxyz",   hex: ["#4A2E1A", "#8A5A34", "#C48D5C", "#EBC9A0"] },
  furCool:  { keys: "WXYZ",   hex: ["#3A3D45", "#6E7380", "#A6ABB5", "#E4E6EA"] },
  olive:    { keys: "fghi",   hex: ["#2A2E1B", "#45492A", "#62663A", "#8A8B52"] },
};

export const ACCENT = {
  "5": "#5E8A3C", // zone chalk R
  "6": "#3C6E8A", // zone chalk C
  "7": "#A88A2E", // zone chalk I
  "8": "#E8742A", // fire
  "9": "#F2C14E", // flame tip
  "0": "#C8414A", // zot red
  "+": "#2A2620", // eye / universal shadow mixer — the only near-black
  "=": "#7FA8C4", // glass
  "-": "#E9C158", // lit window
};

export const CANOPY_MUST_BE_DARKER_THAN_GRASS = true;

// key -> [r, g, b], built once.
const MAP = new Map();
const RAMP_OF = new Map();
function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
for (const [name, ramp] of Object.entries(RAMPS)) {
  for (let i = 0; i < ramp.keys.length; i++) {
    MAP.set(ramp.keys[i], hexToRgb(ramp.hex[i]));
    RAMP_OF.set(ramp.keys[i], { name, index: i });
  }
}
for (const [k, h] of Object.entries(ACCENT)) MAP.set(k, hexToRgb(h));

/** [r, g, b] for a key. Throws on an unknown key — a typo is a hard error. */
export function colourOf(key) {
  const c = MAP.get(key);
  if (!c) throw new Error(`palette: unknown key '${key}'`);
  return c;
}
export const hasKey = (key) => MAP.has(key);
export const KEYS = Object.freeze([...MAP.keys()]);

/** The ramp a key belongs to, or null for accents. */
export const rampOf = (key) => RAMP_OF.get(key) || null;

/** Keys of a ramp as an array (dark -> light). */
export const keysOf = (rampName) => RAMPS[rampName].keys.split("");

/**
 * Shift a key one step within its ramp (clamped). Used for elders (+1 =
 * lighter), variants, and the "same rows through a shifted ramp" trick.
 */
export function shift(key, by) {
  const r = RAMP_OF.get(key);
  if (!r) return key;
  const keys = RAMPS[r.name].keys;
  const i = Math.max(0, Math.min(keys.length - 1, r.index + by));
  return keys[i];
}

/**
 * Re-light for a mirrored sprite: a plain flip sends the highlight to the
 * shadow side; pulling each ramp's extreme rungs one step toward the middle
 * flattens the mirrored sprite just enough that its light no longer
 * contradicts the scene.
 */
const RELIGHT = new Map();
for (const ramp of Object.values(RAMPS)) {
  const k = ramp.keys;
  for (let i = 0; i < k.length; i++) {
    const j = i === k.length - 1 ? i - 1 : i === 0 ? Math.min(1, k.length - 1) : i;
    RELIGHT.set(k[i], k[j]);
  }
}
export const relight = (key) => RELIGHT.get(key) || key;

/**
 * A key map that swaps one ramp for another by index (proportionally when
 * the lengths differ). `remapRamp('brick', 'concrete')` gives a tint table
 * for `rasterize(rows, tint)` — a species skin or a variant for free.
 */
export function remapRamp(from, to) {
  const a = RAMPS[from].keys;
  const b = RAMPS[to].keys;
  const map = {};
  for (let i = 0; i < a.length; i++) {
    const j = Math.round((i * (b.length - 1)) / Math.max(1, a.length - 1));
    map[a[i]] = b[j];
  }
  return map;
}
