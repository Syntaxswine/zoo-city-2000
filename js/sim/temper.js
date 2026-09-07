// temper.js — the twelve temperaments. SPEC §7.11.
//
// The owner (2026-09-07): "lets add 12 personality types" — rolled at birth, never
// inherited, acting on who marries whom and who befriends whom. A temperament is READ,
// never stored: hash01 of the two saved facts every animal already has (its id and its
// birth tick), so every citizen of every save has one from the moment this file exists,
// and no save field, migration or RNG draw is spent on it. Reload and the straight run
// agree by construction.
//
// The table is symmetric by construction and small enough to read on the card: every
// temperament is KINDRED with two others (×TEMPER_KINDRED), CROSSED with one
// (×TEMPER_CROSSED), a little drawn to its own kind (×TEMPER_ALIKE), and plain (×1) with
// the other eight. Kindred and crossed never overlap. Pure; imports cleanly in Node.

import { hash01 } from "./rng.js";
import { KNOBS } from "./rules.js";

export const TEMPERS = Object.freeze([
  { id: "busybody", name: "Busybody", line: "knows what everyone had for breakfast" },
  { id: "hermit", name: "Hermit", line: "keeps the curtains drawn" },
  { id: "joiner", name: "Joiner", line: "on every committee" },
  { id: "grumbler", name: "Grumbler", line: "nothing is as it was" },
  { id: "climber", name: "Climber", line: "eyes on the estate" },
  { id: "idler", name: "Idler", line: "never once hurried" },
  { id: "tinkerer", name: "Tinkerer", line: "fixes what is not broken" },
  { id: "gossip", name: "Gossip", line: "the ticker's best source" },
  { id: "stoic", name: "Stoic", line: "takes the weather as it comes" },
  { id: "dreamer", name: "Dreamer", line: "plans a landmark" },
  { id: "miser", name: "Miser", line: "counts the tax twice" },
  { id: "showoff", name: "Show-off", line: "the mansion's future owner" },
]);
export const TEMPER_COUNT = TEMPERS.length;

// Kindred: each temperament in exactly two pairs. Crossed: each in exactly one. Disjoint.
export const KINDRED = Object.freeze([[0, 7], [0, 2], [1, 8], [1, 6], [2, 4], [3, 8], [3, 10], [4, 11], [5, 9], [5, 10], [6, 9], [7, 11]]);
export const CROSSED = Object.freeze([[0, 1], [2, 3], [4, 5], [6, 11], [7, 8], [9, 10]]);
const REL = new Int8Array(TEMPER_COUNT * TEMPER_COUNT); // 0 plain · 1 kindred · −1 crossed
for (const [a, b] of KINDRED) { REL[a * TEMPER_COUNT + b] = 1; REL[b * TEMPER_COUNT + a] = 1; }
for (const [a, b] of CROSSED) { REL[a * TEMPER_COUNT + b] = -1; REL[b * TEMPER_COUNT + a] = -1; }

const SALT = 0x7e3;

/** The temperament index of a citizen (0..11): a roll at birth, read from the id and the birth tick. */
export function temperOf(c) {
  // hash01's last XOR leaves a SIGNED 32-bit value, so it returns (−0.5, 0.5), not the [0, 1) its
  // comment promises. voice.js folds it the same way; world.js (tile variants) and walkers.js read
  // the raw value and every rig's hash rests on it, so hash01 itself must stay as it is.
  // Fold the negative half up: uniform on [0, 1), the same fold every time it is read.
  const u = hash01(c.id, c.born, SALT);
  return Math.floor((u < 0 ? u + 1 : u) * TEMPER_COUNT) % TEMPER_COUNT;
}
export const temperName = (c) => TEMPERS[temperOf(c)].name;
/** "a Grumbler", "an Idler" — the name with its article, for a line of prose. */
export const withArticle = (name) => `${/^[AEIOU]/.test(name) ? "an" : "a"} ${name}`;
export const aTemper = (c) => withArticle(temperName(c));

/** "alike" · "kindred" · "crossed" · "plain" — the relation between two temperament indices. */
export function relation(a, b) {
  if (a === b) return "alike";
  const r = REL[a * TEMPER_COUNT + b];
  return r === 1 ? "kindred" : r === -1 ? "crossed" : "plain";
}

/** The multiplier a pair of temperaments puts on a courtship weight or a friendship roll. */
export function compat(a, b) {
  if (a === b) return KNOBS.TEMPER_ALIKE;
  const r = REL[a * TEMPER_COUNT + b];
  return r === 1 ? KNOBS.TEMPER_KINDRED : r === -1 ? KNOBS.TEMPER_CROSSED : 1;
}

/** For the card: "a Grumbler — nothing is as it was; kindred with Stoics and Misers, crossed with Joiners". */
export function describeTemper(t) {
  const kin = [];
  let cross = null;
  for (let o = 0; o < TEMPER_COUNT; o++) {
    const r = REL[t * TEMPER_COUNT + o];
    if (r === 1) kin.push(TEMPERS[o].name + "s");
    else if (r === -1) cross = TEMPERS[o].name + "s";
  }
  return `${withArticle(TEMPERS[t].name)} — ${TEMPERS[t].line}; kindred with ${kin.join(" and ")}, crossed with ${cross}`;
}
