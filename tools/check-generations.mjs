// check-generations.mjs — the generations-and-skills arc's regressions, imported by check.mjs.
// Step 0 (2026-09-07): the twelve temperaments (SPEC §7.11), then the wedding, the companions and
// the full-home litter (SPEC §7.2, §7.5) as they land. Every check names the claim it holds.
import { createWorld } from "../js/sim/world.js";
import { KNOBS } from "../js/sim/rules.js";
import { TEMPERS, TEMPER_COUNT, KINDRED, CROSSED, temperOf, temperName, relation, compat, describeTemper } from "../js/sim/temper.js";
import { save, load } from "../js/sim/save.js";
import { createHousehold } from "../js/sim/citizens.js";

export function checkGenerations(check) {
  // ---- SPEC §7.11: the twelve temperaments are a read, a symmetric table, and a card line ----
  {
    check("temperament: twelve, each with a name and a line", TEMPER_COUNT === 12 && TEMPERS.every((t) => t.name && t.line && t.id));
    const seenA = new Set();
    let inRange = true;
    for (let id = 0; id < 5000; id++) { const t = temperOf({ id, born: -37 + (id % 91) }); if (t < 0 || t >= 12 || t !== (t | 0)) inRange = false; seenA.add(t); }
    check("temperament: hash of id and birth tick lands in 0..11 and reaches every type over five thousand animals", inRange && seenA.size === 12, `${seenA.size} types seen`);
    // Each temperament kindred with exactly two and crossed with exactly one; the lists never overlap; symmetric.
    let kin = new Array(12).fill(0), cross = new Array(12).fill(0), overlap = false, symmetric = true;
    for (const [a, b] of KINDRED) { kin[a]++; kin[b]++; if (CROSSED.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) overlap = true; }
    for (const [a, b] of CROSSED) { cross[a]++; cross[b]++; }
    for (let a = 0; a < 12; a++) for (let b = 0; b < 12; b++) if (compat(a, b) !== compat(b, a) || relation(a, b) !== relation(b, a)) symmetric = false;
    check("temperament: every type is kindred with two and crossed with one, the lists disjoint, the table symmetric",
      kin.every((n) => n === 2) && cross.every((n) => n === 1) && !overlap && symmetric, `kindred ${kin.join("")} crossed ${cross.join("")}`);
    const [ka, kb] = KINDRED[0], [ca, cb] = CROSSED[0];
    check("temperament: compat reads the knobs — alike 1.25, kindred 1.5, crossed 0.5, plain 1",
      compat(3, 3) === KNOBS.TEMPER_ALIKE && compat(ka, kb) === KNOBS.TEMPER_KINDRED && compat(ca, cb) === KNOBS.TEMPER_CROSSED && compat(0, 4) === 1 && KNOBS.TEMPER_ALIKE === 1.25 && KNOBS.TEMPER_KINDRED === 1.5 && KNOBS.TEMPER_CROSSED === 0.5);
    const saved = { alike: KNOBS.TEMPER_ALIKE, kin: KNOBS.TEMPER_KINDRED, cross: KNOBS.TEMPER_CROSSED };
    KNOBS.TEMPER_ALIKE = 2; KNOBS.TEMPER_KINDRED = 3; KNOBS.TEMPER_CROSSED = 0;
    check("temperament: the multiplier follows the knob, not a copy of it", compat(3, 3) === 2 && compat(ka, kb) === 3 && compat(ca, cb) === 0);
    KNOBS.TEMPER_ALIKE = saved.alike; KNOBS.TEMPER_KINDRED = saved.kin; KNOBS.TEMPER_CROSSED = saved.cross;
    const line = describeTemper(3);
    check("temperament: the card line names the type, its line, both kindred and the crossed one",
      line.startsWith("a Grumbler — nothing is as it was; kindred with ") && line.includes("Stoics") && line.includes("Misers") && line.endsWith("crossed with Joiners"), line);
  }
  // ---- A temperament survives a save and a load unchanged, because it is not stored at all ----
  {
    const w = createWorld({ seed: "twelve", w: 24, h: 24 }); // not "temper": the seed is in the save, and the check greps the save for the word
    for (let k = 0; k < 6; k++) createHousehold(w, k % 2 ? "fox" : "rabbit", 2);
    const before = w.citizens.map((c) => [c.id, temperOf(c), temperName(c)]);
    const copy = load(save(w));
    const after = copy.citizens.map((c) => [c.id, temperOf(c), temperName(c)]);
    check("temperament: a reloaded city reads every animal's type as the straight run does, with no field in the save",
      JSON.stringify(before) === JSON.stringify(after) && !save(w).includes("temper"), `${before.length} animals`);
  }
}
