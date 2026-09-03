// landmarks.js — THE LANDMARKS: a 3×3 block takes the name and the picture
// of the species that made it. SPEC §3c; docs/PROPOSAL-LANDMARKS.md.
//
// The owner (2026-09-02): "lets also think about adding more specialized 3x3
// tile sprites for some special themed buildings. things like themed
// commercial shops, an industrial dairy, or a residential apartment
// building." The proposal's answer, and this one: a landmark is not placed
// and not bought — it is what a 3×3 block IS when the animals who fill it
// are of a kind. When a 3×3 forms (blocks.js `mergeLots`), its residents (R)
// or its staff (C, I) are counted by species; the largest group names the
// block and chooses its picture; the name is kept until the block comes
// apart. The city's character literally builds the building.
//
// WHO COUNTS. Kin count together: a landmark lists the species it is for,
// and their counts are summed against every other species on its own
// (rabbit 10 + mouse 9 beats cat 12 for Warren Towers; cat 42 + fox 24 is
// the Mews). A tie at the top, or a top group with no landmark in this
// zone, leaves the plain block of the zone (the towers, the emporium, the
// foundry). Measured before this rule was written (five scripted towns,
// thirty years each): the leading species on a block holds 16–37% of it and
// never a majority, so "majority" here means plurality — the census's
// `majority` field means the same. The roster covers every species that led
// a block in those runs (cat, fox, pig, beaver, bear) and not only the ones
// the proposal named (rabbit, cow).
//
// A LANDMARK IS A PICTURE AND A NAME, NEVER A BONUS. No gate, no weight, no
// income term: the proposal's per-theme effects (births ×1.25 in the
// warren, I income ×1.15 at the dairy) are NOT here — they would change
// every town's hash for a flavour whose EV nobody has computed. `theme` is
// the one saved byte per tile (world.js), 0 everywhere in a town with no
// landmark, and an all-zero `theme` is omitted from the hash, so a town
// without one hashes as it did before the landmarks. Nothing here consumes
// the RNG.

import { ZONE } from "./world.js";
import { SPECIES_BY_ID } from "./species.js";

/**
 * The roster: index = the theme id kept in `world.theme[anchor]`; 0 is the
 * plain block. `key` names the art family (js/art/landmarks.js registers
 * `LANDMARK_ART[id]`); `species` are the kin it is for; `blurb` is the card's
 * one line. R by residents, C and I by staff. M has none (the proposal's
 * ruling: the abattoir with a carnivore staff is a later theme on this rule).
 */
export const LANDMARKS = Object.freeze([
  null,
  { id: 1, key: "warren-towers", name: "Warren Towers", zone: ZONE.R, species: ["rabbit", "mouse"], blurb: "a honeycomb of round doors in three brick drums round a burrow mound" },
  { id: 2, key: "the-lodge", name: "the Lodge", zone: ZONE.R, species: ["beaver", "bear", "wolf"], blurb: "log halls on a dam-stone plinth round a pond, a great lodge at the back" },
  { id: 3, key: "the-roost", name: "the Roost", zone: ZONE.R, species: ["owl", "hawk"], blurb: "three timber towers on stilts with round windows high up, perch beams between them" },
  { id: 4, key: "the-wallows", name: "the Wallows", zone: ZONE.R, species: ["pig", "raccoon", "skunk"], blurb: "low brick ranges round a mud court with two wallow pools and a row of bins" },
  { id: 5, key: "the-mews", name: "the Mews", zone: ZONE.R, species: ["cat", "fox"], blurb: "a cobbled mews of tall narrow townhouses, arched carriage doors, lamps on brackets" },
  { id: 6, key: "the-fox-and-cat", name: "the Fox & Cat", zone: ZONE.C, species: ["fox", "cat"], blurb: "a coaching inn round a yard: a gallery on the first floor, a hanging sign, lanterns" },
  { id: 7, key: "night-market", name: "the Night Market", zone: ZONE.C, species: ["raccoon", "owl", "skunk"], blurb: "an open hall of stalls under striped awnings, lanterns on every post, bins at the back" },
  { id: 8, key: "the-dairy", name: "the Dairy", zone: ZONE.I, species: ["cow"], blurb: "a whitewashed churn hall, two tall silos, a tanker at the dock, churns on the step" },
  { id: 9, key: "truffle-works", name: "the Truffle Works", zone: ZONE.I, species: ["pig"], blurb: "three beehive kilns in a mud yard under an oak, crates of the season's find" },
  { id: 10, key: "honey-works", name: "the Honey Works", zone: ZONE.I, species: ["bear"], blurb: "a timber packing hall, a yard of white hives in rows, a tall honey tank" },
  { id: 11, key: "the-sawmill", name: "the Sawmill", zone: ZONE.I, species: ["beaver"], blurb: "a saw shed open to the log pond, a log stack, a sawdust heap, a waterwheel" },
]);

/** LANDMARK_OF[zone][species] → the landmark, or undefined. Built from the roster; check.mjs asserts a species has at most one per zone. */
export const LANDMARK_OF = (() => {
  const t = {};
  for (const lm of LANDMARKS) {
    if (!lm) continue;
    t[lm.zone] = t[lm.zone] || {};
    for (const s of lm.species) t[lm.zone][s] = lm;
  }
  return Object.freeze(t);
})();

export const landmarkOf = (theme) => (theme > 0 && theme < LANDMARKS.length ? LANDMARKS[theme] : null);

/**
 * Pick a theme from species counts `{ species: n }` for a block of `zone`:
 * the largest group — a landmark's kin summed, every other species on its
 * own — names it; a tie at the top or a top group with no landmark → 0.
 * Returns { theme, n, total, species } where `species` are the winners
 * (a landmark's kin actually present, or the single leading species).
 */
export function chooseTheme(counts, zone) {
  const groups = new Map();
  let total = 0;
  for (const [s, n] of Object.entries(counts)) {
    if (!n) continue;
    total += n;
    const lm = LANDMARK_OF[zone] && LANDMARK_OF[zone][s];
    const key = lm ? `l:${lm.id}` : `s:${s}`;
    const g = groups.get(key) || { id: lm ? lm.id : 0, n: 0, species: [] };
    g.n += n;
    g.species.push(s);
    groups.set(key, g);
  }
  let best = null;
  let tie = false;
  for (const g of groups.values()) {
    if (!best || g.n > best.n) { best = g; tie = false; }
    else if (g.n === best.n) tie = true;
  }
  if (!best) return { theme: 0, n: 0, total, species: [] };
  if (tie) return { theme: 0, n: best.n, total, species: best.species, tie: true };
  return { theme: best.id, n: best.n, total, species: best.species };
}

/** Species counts of everyone on lot `i` — residents for R, staff for C/I/M. */
export function speciesOn(world, i) {
  const r = world.zone[i] === ZONE.R;
  const counts = {};
  for (const c of world.citizens) {
    if (c.dead) continue;
    if ((r ? c.home : c.job) !== i) continue;
    counts[c.species] = (counts[c.species] || 0) + 1;
  }
  return counts;
}

/** The theme a 3×3 anchored at `i` would take now, with the count behind it. */
export const themeFor = (world, i) => chooseTheme(speciesOn(world, i), world.zone[i]);

const PLURAL = { mouse: "mice", wolf: "wolves", fox: "foxes" };
export const pluralSpecies = (s) => PLURAL[s] || `${s}s`;
const family = (s) => { const n = SPECIES_BY_ID[s].surname; return `the ${n.endsWith("s") ? n : `${n}s`}`; };
const list = (xs) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

/**
 * The ticker line when a landmark rises — the block's coordinates are in
 * it, so `play.mjs --when "^LANDMARK"` points the camera there.
 */
export function landmarkLine(world, anchor, pick) {
  const lm = landmarkOf(pick.theme);
  if (!lm) return null;
  const tx = anchor % world.w;
  const ty = (anchor / world.w) | 0;
  const who = pick.species.slice().sort((a, b) => a.localeCompare(b));
  return `LANDMARK — ${lm.name}: ${list(who.map(family))} have made a landmark of the block at (${tx},${ty}); ${pick.n} of ${pick.total} ${world.zone[anchor] === ZONE.R ? "living" : "working"} there are ${list(who.map(pluralSpecies))}.`;
}
