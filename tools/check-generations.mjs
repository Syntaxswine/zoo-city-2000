// check-generations.mjs — the generations-and-skills arc's regressions, imported by check.mjs.
// Step 0 (2026-09-07): the twelve temperaments (SPEC §7.11), then the wedding, the companions and
// the full-home litter (SPEC §7.2, §7.5) as they land. Every check names the claim it holds.
import { createWorld, ZONE, capacityOf } from "../js/sim/world.js";
import { KNOBS } from "../js/sim/rules.js";
import { TEMPERS, TEMPER_COUNT, KINDRED, CROSSED, temperOf, temperName, relation, compat, describeTemper } from "../js/sim/temper.js";
import { save, load, stateHash } from "../js/sim/save.js";
import { createHousehold, placeHousehold, bestHome } from "../js/sim/citizens.js";
import { admits } from "../js/sim/species.js";
import { USE_BIT_OF } from "../js/sim/use.js";
import { apply } from "../js/sim/ops.js";
import { tick } from "../js/sim/tick.js";
import { KIND, lifeLines } from "../js/sim/life.js";
import { lotReport } from "../js/sim/lots.js";

export function checkGenerations(check) {
  // The push (SPEC §7.4) is another rule, and these fixtures are jobless families that sit at its
  // threshold from their first month: at the knob's 0.05 a month one left inside the zoning fixture's
  // year and a newcomer took the painted cottage (found by the suite the night the push landed). And
  // nobody arrives: the push retired friction, whose monthly draw these fixtures had been living on —
  // without it the stream shifts and an arrival walks into the cross-line fixture. A fixture that
  // wants a wedding between two named animals wants no third party.
  const saved = { LEAVE_P: KNOBS.LEAVE_P, ARRIVE_GAIN: KNOBS.ARRIVE_GAIN };
  KNOBS.LEAVE_P = 0;
  KNOBS.ARRIVE_GAIN = 0;
  try { generations(check); } finally { Object.assign(KNOBS, saved); }
}

function generations(check) {
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
  // ---- SPEC §7.2: weddings, companions, the full-home litter (commit B of step 0) ----
  const town = (seed = "wedding") => {
    const w = createWorld({ seed, w: 32, h: 32 });
    for (const k of ["terrain", "road", "zone", "civic", "civicSize", "wall", "rail", "tier", "big", "rubble", "burning"]) w[k].fill(0);
    w.cash = 900000; w.roadsDirty = true; w.wallsDirty = true;
    apply(w, { kind: "road", tiles: Array.from({ length: 19 }, (_, k) => 10 * 32 + 2 + k) }); // y = 10, x = 2..20
    return w;
  };
  const lotAt = (w, x, y) => { const i = y * w.w + x; w.zone[i] = ZONE.R; w.tier[i] = 1; w.maxTier[i] = 1; return i; }; // a cottage that stays a cottage (capacity 4): under positive demand a hand-set lot GROWS in a month or two, and a storey makes room for a wedding the fixture meant to refuse
  const family = (w, species, size, x, y) => { const i = lotAt(w, x, y); const hh = createHousehold(w, species, size); placeHousehold(w, hh, i); return { c: w.byId.get(hh.members[0]), hh, lot: i }; };
  const single = (w, species, x, y) => family(w, species, 1, x, y);
  const withKnobs = (over, fn) => { const saved = {}; for (const k of Object.keys(over)) { saved[k] = KNOBS[k]; KNOBS[k] = over[k]; } try { return fn(); } finally { Object.assign(KNOBS, saved); } };
  const households = (w) => w.households.filter((h) => !h.gone);
  const recountOK = (w) => {
    const n = w.w * w.h; const occ = new Int32Array(n);
    for (const c of w.citizens) if (!c.dead && c.home >= 0) occ[c.home]++;
    for (let i = 0; i < n; i++) if (occ[i] !== w.occupants[i]) return false;
    return w.citizens.every((c) => c.dead || (w.hhById.get(c.household)?.members || []).includes(c.id)) && households(w).every((h) => h.members.every((id) => w.byId.get(id)?.household === h.id));
  };
  const QUIET = { WED_CROSS_P: 0, WED_COMPANIONS_P: 0 };
  {
    const w = town();
    const a = single(w, "rabbit", 4, 9), b = single(w, "rabbit", 6, 11);
    withKnobs({ WED_P: 1, ...QUIET }, () => tick(w));
    const hhs = households(w);
    const one = hhs.length === 1 && hhs[0].members.length === 2 && w.occupants[hhs[0].home] === 2 && w.occupants[a.lot] + w.occupants[b.lot] === 2;
    const chapters = a.c.life.some((e) => e[1] === KIND.WED && e[2] === b.c.id) && b.c.life.some((e) => e[1] === KIND.WED && e[2] === a.c.id);
    const news = w.events.log.find((r) => typeof r.line === "string" && r.line.startsWith("WEDDING — "));
    check("wedding: two singles of one species in reach are one household after a month at WED_P 1 — both remember it, the news says so, the tick counts it, the two are friends",
      one && chapters && !!news && w.last.weddings === 1 && a.c.friends.includes(b.c.id) && lifeLines(w, a.c).some((l) => l.startsWith("Married ")) && recountOK(w),
      `${hhs.length} households · weddings ${w.last.weddings} · ${news ? news.line : "no WEDDING line"}`);
    check("wedding: the line names both, their species and temperaments, and the address",
      !!news && new RegExp(`${a.c.name} ${a.c.surname} \\(rabbit, an? [A-Z]`).test(news.line) && new RegExp(`${b.c.name} ${b.c.surname} \\(rabbit, an? [A-Z]`).test(news.line) && / keep house at \(\d+,\d+\)\.$/.test(news.line), news ? news.line : "—");
    const copy = load(save(w));
    check("wedding: the merged household survives a save and a load, and the chapter still reads",
      households(copy).length === 1 && households(copy)[0].members.length === 2 && lifeLines(copy, copy.byId.get(a.c.id)).some((l) => l.startsWith("Married ")) && stateHash(copy) === stateHash(w));
  }
  {
    const w = town("cross");
    single(w, "fox", 4, 9); single(w, "rabbit", 6, 11);
    withKnobs({ WED_P: 1, ...QUIET }, () => { for (let t = 0; t < 6; t++) tick(w); });
    const apart = households(w).length === 2;
    withKnobs({ WED_P: 1, WED_CROSS_P: 1, WED_COMPANIONS_P: 0 }, () => tick(w));
    const news = w.events.log.find((r) => typeof r.line === "string" && r.line.startsWith("WEDDING — "));
    check("wedding: a fox and a rabbit alone never pair until a courtship looks across the predator line — and then the line says \"Predator and prey.\"",
      apart && households(w).length === 1 && !!news && news.line.endsWith(" Predator and prey.") && recountOK(w), `${households(w).length} households · ${news ? news.line : "no line"}`);
  }
  {
    const w = town("own-kind");
    const a = single(w, "rabbit", 4, 9), b = single(w, "rabbit", 6, 11), c = single(w, "mouse", 8, 9);
    withKnobs({ WED_P: 1, ...QUIET }, () => tick(w));
    const hhA = w.hhById.get(a.c.household);
    check("wedding: its own species first — the rabbits pair and the mouse in reach stays single",
      households(w).length === 2 && hhA && hhA.members.includes(b.c.id) && w.hhById.get(c.c.household).members.length === 1, `${households(w).length} households`);
    withKnobs({ WED_P: 1, ...QUIET }, () => { for (let t = 0; t < 3; t++) tick(w); });
    check("wedding: with no other single in reach the mouse stays single — nobody marries into a household that already has two adults", w.hhById.get(c.c.household).members.length === 1 && households(w).length === 2);
  }
  {
    const w = town("room");
    const a = single(w, "rabbit", 4, 9);
    const b = single(w, "rabbit", 6, 11);
    family(w, "beaver", 3, 6, 11); // b's cottage is full: 1 + 3 = 4
    withKnobs({ WED_P: 1, ...QUIET }, () => tick(w));
    check("wedding: the lot with room hosts — b's cottage is full, so b moves in with a",
      households(w).length === 2 && b.c.home === a.lot && w.occupants[a.lot] === 2 && w.occupants[b.lot] === 3 && recountOK(w), `b at ${b.c.home}, a's lot ${a.lot}`);
    const v = town("no-room");
    const c = single(v, "rabbit", 4, 9); family(v, "beaver", 3, 4, 9);
    const d = single(v, "rabbit", 6, 11); family(v, "cow", 3, 6, 11);
    withKnobs({ WED_P: 1, ...QUIET }, () => { for (let t = 0; t < 3; t++) tick(v); });
    check("wedding: no room on either lot, no wedding — both households stand",
      households(v).length === 4 && v.hhById.get(c.c.household).members.length === 1 && v.hhById.get(d.c.household).members.length === 1 && recountOK(v));
  }
  {
    const w = town("companions");
    single(w, "rabbit", 4, 9); single(w, "rabbit", 6, 11);
    withKnobs({ WED_P: 1, WED_CROSS_P: 0, WED_COMPANIONS_P: 1 }, () => tick(w));
    const hh = households(w)[0];
    const news = w.events.log.find((r) => typeof r.line === "string" && r.line.startsWith("WEDDING — "));
    let births = 0;
    withKnobs({ WED_P: 0, BIRTH_DIV: 3 }, () => { for (let t = 0; t < 12; t++) { tick(w); births += w.last.births; } });
    const v = town("litters");
    single(v, "rabbit", 4, 9); single(v, "rabbit", 6, 11);
    withKnobs({ WED_P: 1, ...QUIET }, () => tick(v));
    let births2 = 0;
    withKnobs({ WED_P: 0, BIRTH_DIV: 3 }, () => { for (let t = 0; t < 12; t++) { tick(v); births2 += v.last.births; } });
    check("companions: a couple rolled companions keeps no litter in twelve months at p 1, and the line says so; the same couple otherwise has two or more",
      hh?.companions === true && !!news && news.line.includes(", companions, keep house at ") && news.line.endsWith(" No litters from that house.") && births === 0 && births2 >= 2,
      `companions births ${births} · otherwise ${births2}`);
    const copy = load(save(w));
    check("companions: the flag survives a save and a load, and a town without one saves as it did",
      households(copy)[0]?.companions === true && stateHash(copy) === stateHash(w) && !save(v).includes("companions"));
  }
  {
    const w = town("full");
    const a = family(w, "rabbit", 2, 4, 9); // a fertile couple
    family(w, "rabbit", 2, 4, 9);           // and another on the same cottage: 4 of 4
    const spare = lotAt(w, 12, 9);          // an empty cottage elsewhere: 4 places
    withKnobs({ WED_P: 0, BIRTH_DIV: 3, BIRTH_FULL_MULT: 1 }, () => tick(w));
    const over = w.occupants[a.lot];
    check("full home: at BIRTH_FULL_MULT 1 and p 1 the full cottage breeds and goes over capacity, and the empty cottage's four places are still four",
      over >= 5 && over > capacityOf(w, a.lot) && w.last.census.vacantR === 4 && lotReport(w, a.lot).score.fill > 1 && recountOK(w), `occupants ${over} of ${capacityOf(w, a.lot)} · vacantR ${w.last.census.vacantR} · spare ${spare}`);
    const v = town("full-0");
    const b = family(v, "rabbit", 2, 4, 9); family(v, "rabbit", 2, 4, 9);
    withKnobs({ WED_P: 0, BIRTH_DIV: 3, BIRTH_FULL_MULT: 0 }, () => { for (let t = 0; t < 12; t++) tick(v); });
    check("full home: at BIRTH_FULL_MULT 0 a full cottage never breeds — the multiplier is read where the litter is rolled", v.occupants[b.lot] === 4);
    const u = town("full-quarter");
    const d = family(u, "rabbit", 2, 4, 9); family(u, "rabbit", 2, 4, 9);
    let months = 0;
    withKnobs({ WED_P: 0, BIRTH_DIV: 3 }, () => { for (let t = 0; t < 60 && u.occupants[d.lot] === 4; t++) { tick(u); months++; } });
    check("full home: at the knob's 0.25 a full cottage's litter comes, later — within sixty months at p 1/4 twice a month", u.occupants[d.lot] > 4 && months > 0, `${months} months`);
  }
  {
    // Continuation: the wedding pass reads nothing but saved state, so a save at six months and a
    // straight run agree at twelve — the reload-hash law (SPEC §15) over the new rule.
    const straight = town("continue"), split = town("continue");
    for (const w of [straight, split]) for (let k = 0; k < 8; k++) single(w, k % 3 === 0 ? "mouse" : k % 3 === 1 ? "rabbit" : "cat", 3 + 2 * k, k % 2 ? 9 : 11);
    let mid = null;
    withKnobs({ WED_P: 1, WED_CROSS_P: 0.5, WED_COMPANIONS_P: 0.5, BIRTH_DIV: 3 }, () => {
      for (let t = 0; t < 12; t++) tick(straight);
      for (let t = 0; t < 6; t++) tick(split);
      mid = load(save(split));
      for (let t = 0; t < 6; t++) tick(mid);
    });
    const wed = straight.events.log.filter((r) => typeof r.line === "string" && r.line.startsWith("WEDDING — ")).length;
    check("wedding: a city saved at six months and continued hashes as the straight run at twelve, weddings, companions and cross-line courtships included",
      stateHash(mid) === stateHash(straight) && wed >= 2 && recountOK(straight) && recountOK(mid), `${wed} weddings · ${stateHash(mid)} vs ${stateHash(straight)}`);
  }
  {
    // The player's line over a MIXED household (SPEC §7.8 meets §7.2): a rabbit and a mouse marry; the
    // lot is then painted rabbit-only. The mouse is forbidden, so the household gets its notice and
    // rehomes — to a lot that admits BOTH — or leaves; and bestHome never offers a lot that admits one.
    const w = town("line");
    const a = single(w, "rabbit", 4, 9), b = single(w, "mouse", 6, 11);
    const both = lotAt(w, 12, 9);          // unpainted: mixed, admits everyone
    withKnobs({ WED_P: 1, WED_CROSS_P: 0, WED_COMPANIONS_P: 0 }, () => { for (let t = 0; t < 4 && households(w).length > 1; t++) tick(w); });
    const hh = households(w)[0];
    const married = households(w).length === 1 && hh.members.length === 2;
    const home = hh.home;
    const paint = apply(w, { kind: "use", use: USE_BIT_OF.rabbit, x0: home % w.w, y0: (home / w.w) | 0, x1: home % w.w, y1: (home / w.w) | 0 });
    const forbidsMouse = paint.ok && admits(w.use[home], "rabbit") && !admits(w.use[home], "mouse");
    withKnobs({ WED_P: 0 }, () => { for (let t = 0; t < KNOBS.ZONED_OUT_MONTHS + 2; t++) tick(w); });
    const after = households(w)[0];
    const wrong = w.citizens.filter((c) => !c.dead && c.home >= 0 && !admits(w.use[c.home], c.species)).length;
    check("the line over a mixed household: the mouse's forbidden roof gives the whole household notice, and it rehomes together to the lot that admits both",
      married && forbidsMouse && wrong === 0 && after && after.home !== home && after.home >= 0 && ["rabbit", "mouse"].every((s) => admits(w.use[after.home], s)) && after.members.length === 2 && recountOK(w),
      `married ${married} · forbids mouse ${forbidsMouse} · wrong ${wrong} · home ${after?.home} (both at ${both})`);
    check("the line: bestHome asks for every species under the roof — a rabbit-only lot is no home for a rabbit-and-mouse household",
      (() => { const v = town("line-2"); const p1 = lotAt(v, 4, 9), p2 = lotAt(v, 12, 9); apply(v, { kind: "use", use: USE_BIT_OF.rabbit, x0: 4, y0: 9, x1: 4, y1: 9 }); // a fresh fixture, no tick: nobody arrives to take the painted cottage first
        return bestHome(v, ["rabbit", "mouse"], 2, false, new Set([p1, p2])) === p2 && bestHome(v, ["rabbit"], 1, false, new Set([p1])) === p1 && bestHome(v, ["mouse"], 1, false, new Set([p1])) === -1 && bestHome(v, "mouse", 1, false, new Set([p1])) === -1; })());
  }
}
