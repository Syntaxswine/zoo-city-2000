// use.js — the stable 16-bit mask behind the Use brush.
//
// Zero means mixed/unrestricted. Bits 0 and 1 preserve the shipped save
// values exactly: old predator-only `1` and prey-only `2` cities load without
// migration. Bits 2..15 are explicit, permanent species assignments. Never
// reorder this list: a saved mask must mean the same thing years from now.

export const USE_SPECIES = Object.freeze([
  "rabbit", "mouse", "fox", "beaver", "owl", "bear", "tortoise",
  "raccoon", "pig", "cow", "wolf", "cat", "hawk", "skunk",
]);

const speciesBits = Object.fromEntries(USE_SPECIES.map((id, i) => [id.toUpperCase(), 1 << (i + 2)]));

export const USE = Object.freeze({
  MIXED: 0,
  PRED: 1,
  PREY: 2,
  ...speciesBits,
});

export const USE_MASK = 0xffff;
export const USE_BIT_OF = Object.freeze(Object.fromEntries(USE_SPECIES.map((id) => [id, USE[id.toUpperCase()]])));
export const USE_OPTIONS = Object.freeze([
  Object.freeze({ bit: USE.PRED, id: "predator", label: "predators" }),
  Object.freeze({ bit: USE.PREY, id: "prey", label: "prey" }),
  ...USE_SPECIES.map((id) => Object.freeze({ bit: USE_BIT_OF[id], id, label: id })),
]);

// One colour per CHECKBOX. Combined zones average their checked colours;
// the exact mask is always named on the tile card too.
const USE_RGB = Object.freeze([
  [160, 70, 40], [40, 120, 130],
  [190, 90, 130], [105, 105, 140], [205, 95, 35], [130, 85, 45],
  [105, 80, 155], [115, 75, 55], [95, 130, 55], [75, 110, 125],
  [210, 105, 120], [190, 165, 95], [65, 85, 140], [155, 80, 145],
  [175, 125, 45], [70, 65, 75],
]);

export function validUse(value) {
  return Number.isInteger(value) && value >= USE.MIXED && value <= USE_MASK;
}

/** Player ops retain the old clamping behaviour, now over an unsigned word. */
export function clampUse(value) {
  return Math.max(USE.MIXED, Math.min(USE_MASK, Number(value) | 0));
}

/** Imported/corrupt values fail safely to mixed rather than excluding all. */
export function normalizeUse(value) {
  const n = Number(value);
  return validUse(n) ? n : USE.MIXED;
}

export function selectedUses(value) {
  const mask = normalizeUse(value);
  return USE_OPTIONS.filter((o) => (mask & o.bit) !== 0);
}

export function useName(value) {
  const picked = selectedUses(value);
  return picked.length ? picked.map((o) => o.id).join(" + ") : "mixed";
}

export function useBrushLabel(value) {
  const picked = selectedUses(value);
  if (!picked.length) return "mixed — everyone";
  return `${picked.map((o) => o.id).join(" + ")} — admits anything matching at least one checked box`;
}

export function useShortLabel(value) {
  const picked = selectedUses(value);
  if (!picked.length) return "mixed";
  if (picked.length === 1) return picked[0].id === "predator" ? "pred" : picked[0].id;
  return `${picked.length} checked`;
}

export function useTint(value, alpha = 0.55) {
  const mask = normalizeUse(value);
  if (!mask) return null;
  let r = 0, g = 0, b = 0, n = 0;
  for (let i = 0; i < USE_OPTIONS.length; i++) {
    if (!(mask & USE_OPTIONS[i].bit)) continue;
    r += USE_RGB[i][0]; g += USE_RGB[i][1]; b += USE_RGB[i][2]; n++;
  }
  return n ? `rgba(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)},${alpha})` : null;
}
