// check-wealth.mjs — wealth and class: the ladder, the class field, the mansion that rises, the progressive tax, the priority
// policing and the harsher step (SPEC §9f; docs/PROPOSAL-WEALTH-AND-CLASS-2026-09-05.md; the owner's rulings of 2026-09-05).
// Run by check.mjs; each check names the rule it pins. Every fixture here is a flat 40×40 with one street along y = 12 and a
// 3×3 of R chalk at (10,9)..(12,11) — THE WINDOW — one tile north of the street.
import { createWorld, ZONE, CIVIC, TERRAIN, idx, capacityOf, footprintOf, anchorOf } from '../js/sim/world.js';
import { apply } from '../js/sim/ops.js';
import { save, load, stateHash } from '../js/sim/save.js';
import { computeFields } from '../js/sim/fields.js';
import { census } from '../js/sim/census.js';
import { yearlyFigures } from '../js/sim/budget.js';
import { createHousehold, placeHousehold, bestHome, removeHousehold } from '../js/sim/citizens.js';
import { lotScore, REASON, lotReport } from '../js/sim/lots.js';
import { mergeWindow, dissolve } from '../js/sim/blocks.js';
import { openFile, arrest, filesTick, arrestChance } from '../js/sim/justice.js';
import { tick } from '../js/sim/tick.js';
import { KNOBS } from '../js/sim/rules.js';
import { CLASS, CLASS_NAME, attainableClass, rungsFor, classAt, classOfCitizen, computeClass, mansionWindow, waitingLine, shopWithinRoad, nature8, natureBeside, siteOf, estateName } from '../js/sim/wealth.js';

/** Flat grass, nothing on it, rich; one street along y = 12 from x = 4 to 30. */
function street(seed = 'wealth') {
  const world = createWorld({ seed, w: 40, h: 40 });
  for (const k of ['terrain', 'road', 'zone', 'civic', 'civicSize', 'wall', 'rail', 'tier', 'big', 'rubble', 'burning', 'flooded', 'mansion', 'theme']) world[k].fill(0);
  world.cash = 900000; world.roadsDirty = true; world.wallsDirty = true;
  apply(world, { kind: 'road', tiles: Array.from({ length: 27 }, (_, k) => idx(world, 4 + k, 12)) });
  return world;
}
const at = (w, x, y) => idx(w, x, y);
const A = (w) => at(w, 10, 9); // the window's anchor: tiles 10..12 × 9..11, the street one tile south
/** Fields and the class field, as the tick computes them. */
const refresh = (w) => { computeFields(w); computeClass(w); };
/**
 * THE QUARTER: the window zoned R at (10,9); a Gallery at (13,10) and a park at (13,8) make the address modest; an Amphitheater
 * at (7,13), a Library at (14,13), a standing shop at (16,11) and a tree west of the anchor make it affluent. `upTo` stops the
 * build at a rung: 0 the bare window · 1 modest · 2 every rung. Cottages down the street are where the poor live and where a
 * displaced family goes; `cottages` also builds two on the window itself, for the families a rise moves.
 */
function quarter(upTo = 2, { justice = false, seed = 'wealth', cottages = false } = {}) {
  const w = street(seed);
  apply(w, { kind: 'zone', zone: ZONE.R, x0: 10, y0: 9, x1: 12, y1: 11, density: 3 });
  if (cottages) { w.tier[at(w, 10, 9)] = 1; w.tier[at(w, 12, 11)] = 1; }
  if (upTo >= 1) { apply(w, { kind: 'gallery', tx: 13, ty: 10 }); apply(w, { kind: 'park', tx: 13, ty: 8 }); }
  if (upTo >= 2) {
    apply(w, { kind: 'amphitheater', tx: 7, ty: 13 }); apply(w, { kind: 'library', tx: 14, ty: 13 });
    apply(w, { kind: 'zone', zone: ZONE.C, x0: 16, y0: 11, x1: 17, y1: 11, density: 3 }); w.tier[at(w, 16, 11)] = 1;
    w.terrain[at(w, 9, 9)] = TERRAIN.TREE;
  }
  apply(w, { kind: 'zone', zone: ZONE.R, x0: 4, y0: 10, x1: 6, y1: 10, density: 3 }); for (let x = 4; x <= 6; x++) w.tier[at(w, x, 10)] = 1;
  if (justice) {
    // The custody the sentences need, all on the street: a centre, a prison, a meat hall, a police station.
    apply(w, { kind: 'centre', tx: 20, ty: 13 }); apply(w, { kind: 'zoo', tx: 24, ty: 13 }); apply(w, { kind: 'police', tx: 28, ty: 13 });
    apply(w, { kind: 'zone', zone: ZONE.M, x0: 18, y0: 11, x1: 18, y1: 11, density: 3 }); w.tier[at(w, 18, 11)] = 1;
  }
  w.valves.R = 0.5; // demand: a mansion needs score > GROW_THRESH like any growth
  refresh(w);
  return w;
}
const unmet = (w, i) => attainableClass(w, i).unmet.map((r) => r.rung).sort().join(',');
const ladder = (w, i) => attainableClass(w, i).cls;
/**
 * A household of `size` `species` placed at lot i — CUBS, five years old, unless `adults`: a jobless adult is 3 crime in its
 * own 3×3 (6 for a carnivore) and the town's unemployed share is 40 more everywhere, which would make any test street
 * poverty by itself; the ladder here is about the amenities. An adult fixture takes a job at the shop when `job` is given.
 */
function family(w, i, species = 'fox', size = 3, { adults = false, job = -1 } = {}) {
  const hh = createHousehold(w, species, size);
  for (const id of hh.members) { const c = w.byId.get(id); if (!adults) c.born = w.tick - 5 * 12; else if (job >= 0) { c.job = job; w.staff[job]++; } }
  placeHousehold(w, hh, i);
  return hh;
}
const withKnobs = (patch, fn) => { const saved = {}; for (const k of Object.keys(patch)) { saved[k] = KNOBS[k]; KNOBS[k] = patch[k]; } try { return fn(); } finally { Object.assign(KNOBS, saved); } };
/** Raise the window's mansion through the tick with the roll forced (BIG_P·score ≥ 1), the way a block is forced. */
const raise = (w) => withKnobs({ MANSION_P: 100 }, () => tick(w));
const nine = (w) => [0, 1, 2].flatMap((dy) => [0, 1, 2].map((dx) => at(w, 10 + dx, 9 + dy)));

export function checkWealth(check) {
  // ---- the ladder: gates, every rung a field, every rung bites -------------------------------------------------------------
  {
    const w0 = quarter(0);
    check('ladder: a bare street is POVERTY, and the card names exactly the two rungs the modest lack here — culture and a park', ladder(w0, A(w0)) === CLASS.POVERTY && unmet(w0, A(w0)) === 'culture,park', `${CLASS_NAME[ladder(w0, A(w0))]} · ${unmet(w0, A(w0))}`);
    const w1 = quarter(1);
    check('ladder: a Gallery in reach and a park within 4 make the address MODEST; the next rung wants an Amphitheater, knowledge, a shop and nature', ladder(w1, A(w1)) === CLASS.MODEST && unmet(w1, A(w1)) === 'culture,knowledge,nature,shops', `${CLASS_NAME[ladder(w1, A(w1))]} · ${unmet(w1, A(w1))}`);
    const w2 = quarter(2);
    check('ladder: every rung met is AFFLUENT with nothing unmet', ladder(w2, A(w2)) === CLASS.AFFLUENT && unmet(w2, A(w2)) === '', unmet(w2, A(w2)));
    check('ladder: the modest have six rungs and the affluent nine, straight from the knobs', rungsFor(w2, A(w2), 1).length === 6 && rungsFor(w2, A(w2), 2).length === 9);
    // Every rung bites: take each away in turn and the ladder names THAT rung and no other.
    const bite = (name, mutate, expectCls, expectUnmet) => {
      const w = quarter(2); mutate(w); refresh(w);
      const res = attainableClass(w, A(w));
      check(`ladder bites: ${name}`, res.cls === expectCls && res.unmet.map((r) => r.rung).sort().join(',') === expectUnmet, `${CLASS_NAME[res.cls]} · ${res.unmet.map((r) => r.rung).join(',')}`);
    };
    bite('without the Amphitheater the address is modest and wants "an Amphitheater\'s culture"', (w) => apply(w, { kind: 'bulldoze', x0: 7, y0: 13, x1: 7, y1: 13 }), CLASS.MODEST, 'culture');
    bite('without the Library it wants knowledge', (w) => apply(w, { kind: 'bulldoze', x0: 14, y0: 13, x1: 14, y1: 13 }), CLASS.MODEST, 'knowledge');
    bite('without the park it is poverty and wants a park', (w) => apply(w, { kind: 'bulldoze', x0: 13, y0: 8, x1: 13, y1: 8 }), CLASS.POVERTY, 'park');
    bite('with the shop unbuilt it wants a shop within 6 road tiles', (w) => { w.tier[at(w, 16, 11)] = 0; }, CLASS.MODEST, 'shops');
    bite('without the tree it wants water or trees beside the plot', (w) => { w.terrain[at(w, 9, 9)] = TERRAIN.GRASS; }, CLASS.MODEST, 'nature');
    // The field rungs, poked after the fields (attainableClass reads the fields as they stand).
    const poke = (name, field, value, expectCls, expectUnmet) => {
      const w = quarter(2); w[field][A(w)] = value;
      const res = attainableClass(w, A(w));
      check(`ladder bites: ${name}`, res.cls === expectCls && res.unmet.map((r) => r.rung).sort().join(',') === expectUnmet, `${CLASS_NAME[res.cls]} · ${res.unmet.map((r) => r.rung).join(',')}`);
    };
    poke('pollution 15 is clean enough for the modest and too dirty for the affluent', 'pol', 15, CLASS.MODEST, 'air');
    poke('pollution 25 is too dirty for either', 'pol', 25, CLASS.POVERTY, 'air');
    poke('crime 30 keeps the affluent away', 'crime', 30, CLASS.MODEST, 'streets');
    poke('crime 50 keeps the modest away too', 'crime', 50, CLASS.POVERTY, 'streets');
    poke('any dread at all is too much for either', 'dread', 5, CLASS.POVERTY, 'smell');
    poke('land value 70 is modest, not affluent', 'lv', 70, CLASS.MODEST, 'land value');
    poke('land value 50 is poverty', 'lv', 50, CLASS.POVERTY, 'land value');
    // The shop rung is a ROAD distance from the doors, not a Chebyshev one.
    const far = quarter(2); far.tier[at(far, 16, 11)] = 0; apply(far, { kind: 'zone', zone: ZONE.C, x0: 19, y0: 11, x1: 19, y1: 11, density: 3 }); far.tier[at(far, 19, 11)] = 1; refresh(far);
    check('ladder: the shop rung walks the road — a shop 9 road tiles from the anchor\'s door is out of reach at 6, and in reach at 9', !shopWithinRoad(far, A(far), 6) && shopWithinRoad(far, A(far), 9) && unmet(far, A(far)) === 'shops');
    check('ladder: nature8 counts water and trees among the eight neighbours of a lot of its own', nature8(w2, A(w2)) === 1 && nature8(w0, A(w0)) === 0);
    // A 3×3 is read at its HEART and its nature round its BORDER: the window's centre has no tree beside it as a lot of its own,
    // and reads the tree at (9,9) as the window; the kerb's pollution is the corner's, not the house's.
    const site = siteOf(w2, A(w2), [0, 1, 2].flatMap((dy) => [0, 1, 2].map((dx) => at(w2, 10 + dx, 9 + dy))));
    check('ladder: a 3×3 is read at its heart with nature round its border — the window\'s centre is MODEST as a lot (no tree beside it) and the window is AFFLUENT as a site', site.heart === at(w2, 11, 10) && attainableClass(w2, at(w2, 11, 10)).cls === CLASS.MODEST && attainableClass(w2, A(w2), null, site.tiles).cls === CLASS.AFFLUENT && natureBeside(w2, site.tiles) === 1);
    const kerb = quarter(2); kerb.pol[A(kerb)] = 30; kerb.pol[at(kerb, 11, 10)] = 0;
    check('ladder: 30 pollution on the kerb tile does not touch the window\'s class, and 30 at its heart does', attainableClass(kerb, A(kerb), null, site.tiles).cls === CLASS.AFFLUENT && (() => { kerb.pol[at(kerb, 11, 10)] = 30; return attainableClass(kerb, A(kerb), null, site.tiles).cls === CLASS.POVERTY; })());
  }

  // ---- the class field: what the ADDRESS affords, this month ---------------------------------------------------------------------
  {
    const w = quarter(2);
    check('class: computeClass writes the ladder into world.klass on every R lot of its own — affluent at the corner (the tree beside it), modest one tile in, poverty at the cottages down the street, nothing off the housing', w.klass[A(w)] === CLASS.AFFLUENT && w.klass[at(w, 11, 10)] === CLASS.MODEST && w.klass[at(w, 5, 10)] === CLASS.POVERTY && w.klass[at(w, 20, 20)] === 0, `${w.klass[A(w)]} · ${w.klass[at(w, 11, 10)]} · ${w.klass[at(w, 5, 10)]}`);
    const rich = family(w, A(w), 'wolf', 4), poor = family(w, at(w, 5, 10), 'rabbit', 2);
    const c = w.byId.get(rich.members[0]);
    const was = classOfCitizen(w, c); c.home = at(w, 6, 10); const moved = classOfCitizen(w, c); c.home = A(w);
    check('class: a citizen\'s class is the class at home — a household that moves reads its new street; nothing is carried', was === CLASS.AFFLUENT && moved === CLASS.POVERTY && classOfCitizen(w, w.byId.get(poor.members[0])) === CLASS.POVERTY && classAt(w, at(w, 12, 11)) === CLASS.MODEST);
    apply(w, { kind: 'bulldoze', x0: 7, y0: 13, x1: 7, y1: 13 }); refresh(w);
    check('class: the street comes down and the class with it — the Amphitheater razed, the same family at the same address is MODEST', w.klass[A(w)] === CLASS.MODEST && classOfCitizen(w, c) === CLASS.MODEST);
    const camper = createHousehold(w, 'cat', 2);
    check('class: a household without a home is in poverty', classOfCitizen(w, w.byId.get(camper.members[0])) === CLASS.POVERTY);
    check('class: a town saves without a mansion array, a wealth field or a class field — the class is derived, so nothing older moves', !/"mansion":|"wealth":|"klass":/.test(save(quarter(0))) && !/"klass":|"wealth":/.test(save(w)));
  }

  // ---- the mansion rises -----------------------------------------------------------------------------------------------------------
  {
    const w = quarter(2);
    const win = mansionWindow(w, A(w));
    check('window: the 3×3 anchored at an affluent lot of nine R lots on one line is a mansion window — nine tiles, anchored at the north corner', !!win && win.anchor === A(w) && win.tiles.length === 9 && win.tiles.every((j) => w.zone[j] === ZONE.R));
    check('window: anchored at its corner only — a middle tile of the same nine anchors a window that runs into the Gallery, and has none', mansionWindow(w, at(w, 11, 10)) === null && mansionWindow(w, at(w, 10, 10)) === null);
    check('window: one rung short there is no window at all', (() => { const q = quarter(1); return mansionWindow(q, A(q)) === null; })());
    // The heart's field rungs are asked first for speed; the whole ladder decides. A window that passes every field rung at its heart
    // and lacks only the tree, or only the shop, has no window (the mutant that skipped the ladder after the cheap check survived until this).
    check('window: the whole ladder decides, not the cheap field rungs — without the tree, or without the shop, there is no window', (() => { const q = quarter(2); q.terrain[at(q, 9, 9)] = TERRAIN.GRASS; refresh(q); return mansionWindow(q, A(q)) === null && q.culture[at(q, 11, 10)] >= 2 && q.lv[at(q, 11, 10)] >= KNOBS.CLASS_LV_MIN[2]; })()
      && (() => { const q = quarter(2); q.tier[at(q, 16, 11)] = 0; refresh(q); return mansionWindow(q, A(q)) === null; })());
    check('window: a tile on another use line, or water inside the nine, and there is no window', (() => { const q = quarter(2); apply(q, { kind: 'use', use: 1, x0: 12, y0: 11, x1: 12, y1: 11 }); refresh(q); return mansionWindow(q, A(q)) === null; })()
      && (() => { const q = quarter(2); q.terrain[at(q, 11, 10)] = TERRAIN.WATER; return mansionWindow(q, A(q)) === null; })());
    const s = lotScore(w, A(w));
    check('lotScore: the anchor reads MANSION_RISING at MANSION_P·score with the window on the report — before any storey, before any block', s.reason === REASON.MANSION_RISING && s.mansion && s.mansion.anchor === A(w) && Math.abs(s.p - KNOBS.MANSION_P * s.score) < 1e-12 && !s.grow && !s.merge, `${s.reason} p ${s.p}`);
    check('lotScore: without demand nothing rises — the window is there and the reason is the street\'s', (() => { const q = quarter(2); q.valves.R = -0.3; const r = lotScore(q, A(q)); return r.reason !== REASON.MANSION_RISING && !r.mansion && !!mansionWindow(q, A(q)); })());
    check('lotScore: no affluent address, no window — a town whose ladder stops at modest reports every lot without one', (() => { const q = quarter(1); for (let i = 0; i < q.w * q.h; i++) if (q.zone[i] === ZONE.R && lotScore(q, i).mansion) return false; return true; })());
    // Through the tick, with families on the window: the largest keeps the house, the rest are moved out within twelve road tiles.
    const t = quarter(2, { cottages: true });
    const keep = family(t, at(t, 10, 9), 'fox', 3), out = family(t, at(t, 12, 11), 'rabbit', 2);
    raise(t);
    const a = A(t);
    check('rise: the window becomes ONE mansion — big 3 and its parts, tier 3 on nine tiles, capacity MANSION_CAP, the MANSION line logged under its id and in the notices',
      t.mansion[a] === 1 && t.big[a] === 3 && footprintOf(t, a).length === 9 && footprintOf(t, a).every((j) => t.tier[j] === 3 && anchorOf(t, j) === a) && capacityOf(t, a) === KNOBS.MANSION_CAP
      && t.notices.some((l) => /^MANSION — a mansion has risen at \(10,9\)\./.test(l)) && t.events.log.some((e) => e.id === 'mansion' && /moved out/.test(e.line)), `${t.mansion[a]} · ${t.big[a]} · cap ${capacityOf(t, a)}`);
    check('rise: the largest household that fits keeps the house on the anchor; the other is moved out to a cottage within twelve road tiles, never onto the window', keep.home === a && t.occupants[a] === 3 && out.home !== a && out.home >= 0 && !footprintOf(t, a).includes(out.home) && t.zone[out.home] === ZONE.R && out.members.every((id) => t.byId.get(id).home === out.home)
      && t.notices.some((l) => /keep the house; 2 animals were moved out to make room/.test(l)), `keeper ${keep.home} out ${out.home}`);
    check('rise: the standing mansion neither grows, decays nor merges — MANSION, p 0, no window; its parts read PART', lotScore(t, a).reason === REASON.MANSION && lotScore(t, a).p === 0 && mergeWindow(t, a) === null && mansionWindow(t, a) === null && lotScore(t, at(t, 11, 10)).reason === REASON.PART);
    const empty = quarter(2); raise(empty);
    check('rise: nine empty lots rise too — "Nobody lived on the nine lots; the house stands empty" — and the mansion waits for a family', empty.mansion[A(empty)] === 1 && empty.occupants[A(empty)] === 0 && empty.notices.some((l) => /Nobody lived on the nine lots/.test(l)));
    check('mansion: a household of any class may take an empty mansion, and none may join while one lives there', bestHome(empty, 'fox', 3, false) === A(empty) && bestHome(t, 'cat', 2, false) !== a);
    let months = 0; while (empty.occupants[A(empty)] === 0 && months < 60) { tick(empty); months++; }
    const hh = empty.households.find((h) => !h.gone && h.home === A(empty));
    check('mansion: a household that walks in through citizensTick is AFFLUENT by its address, and THE ESTATE line is in the log', !!hh && classOfCitizen(empty, empty.byId.get(hh.members[0])) === CLASS.AFFLUENT && empty.events.log.some((e) => /^THE ESTATE — the .* have moved into the mansion at \(10,9\)\./.test(e.line)), `${months} months · ${hh && hh.surname}`);
    check('mansion: the card names the estate by its family, and an empty one is "the empty mansion"', estateName(empty, at(empty, 11, 11)) === `the ${hh.surname} estate` && estateName(t, a) === `the ${keep.surname} estate` && estateName(t, at(t, 5, 10)) === null && lotReport(t, a).mansion === 1 && lotReport(t, a).klass.cls === CLASS.AFFLUENT);
    const copy = load(save(t));
    for (let k = 0; k < 12; k++) { tick(t); tick(copy); }
    check('mansion: save → load → twelve months hash-equals with a mansion standing and the classes counted', stateHash(t) === stateHash(copy) && /"mansion":/.test(save(t)), `${stateHash(t)} vs ${stateHash(copy)}`);
  }

  // ---- what they pay, what the Census says ----------------------------------------------------------------------------------------
  {
    const w = quarter(2, { cottages: true }); const rich = family(w, at(w, 10, 9), 'wolf', 4); raise(w); const a = A(w);
    const poor = family(w, at(w, 5, 10), 'rabbit', 2); refresh(w);
    const fig = yearlyFigures(w), c = census(w);
    const richBase = rich.members.map((id) => w.byId.get(id)).reduce((s, x) => s + 0.5 + w.lv[x.home] / 100, 0);
    const poorBase = poor.members.map((id) => w.byId.get(id)).reduce((s, x) => s + 0.5 + w.lv[x.home] / 100, 0);
    check('tax: the progressive tax — the affluent pay TAX_CLASS[2] times the R base and the poor once; the Census carries the counts and the shares, summing to one',
      rich.home === a && fig.taxByClass[2] === Math.round(w.rates.R * richBase * KNOBS.TAX_CLASS[2] * KNOBS.TAX_R_PER_CITIZEN) && fig.taxByClass[0] === Math.round(w.rates.R * poorBase * KNOBS.TAX_R_PER_CITIZEN)
      && fig.incomeYr === Math.round(w.rates.R * (richBase * KNOBS.TAX_CLASS[2] + poorBase) * KNOBS.TAX_R_PER_CITIZEN) && c.byClass.join(',') === '2,0,4' && Math.abs(c.taxShareByClass.reduce((s, x) => s + x, 0) - 1) < 1e-9 && c.taxShareByClass[2] > 0.9
      && c.mansions === 1 && c.blocks3 === 0 && c.affluentLots === 1, `${fig.taxByClass} · ${c.byClass} · ${c.taxShareByClass.map((x) => x.toFixed(2))} · affluent lots ${c.affluentLots}`);
  }

  // ---- fire, rubble, the engine, the flood -------------------------------------------------------------------------------------------
  {
    const w = quarter(2, { cottages: true }); const fam = family(w, at(w, 10, 9), 'fox', 3); raise(w); const a = A(w);
    for (const j of footprintOf(w, a)) w.burning[j] = 1;
    tick(w);
    check('fire: a mansion burnt out off the beat goes to rubble on all nine tiles as plain R lots again — mansion 0, block 0, tier 0 — the family out, no tier wrapping',
      w.mansion[a] === 0 && nine(w).every((j) => w.rubble[j] === KNOBS.RUBBLE_MONTHS && w.big[j] === 0 && w.tier[j] === 0 && w.zone[j] === ZONE.R) && w.occupants[a] === 0 && fam.home !== a && Math.max(...w.tier) <= 3,
      `mansion ${w.mansion[a]} rubble ${w.rubble[a]} occ ${w.occupants[a]} home ${fam.home}`);
    removeHousehold(w, fam, 'left'); // an empty street stays quiet (an unemployed camper is 40 crime); the address is judged on its own rungs
    for (let k = 0; k < KNOBS.RUBBLE_MONTHS + 1; k++) tick(w);
    const again = w.rubble[a] === 0 && w.tier[a] === 0 && w.klass[a] === CLASS.AFFLUENT && !!mansionWindow(w, a);
    raise(w);
    check('fire: when the rubble clears the nine are chalk on an affluent address, and a mansion may rise again', again && w.mansion[a] === 1, `klass ${w.klass[a]} · ${waitingLine(attainableClass(w, a))}`);
    const s = quarter(2, { cottages: true }); const kept = family(s, at(s, 10, 9), 'fox', 3); raise(s); const b = A(s);
    apply(s, { kind: 'fire', tx: 16, ty: 13 }); refresh(s); // a real station: the tick recomputes cover itself
    for (const j of footprintOf(s, b)) s.burning[j] = 1;
    withKnobs({ FIRE_SAVED: 1 }, () => { tick(s); });
    check('fire: on the beat the engine saves the mansion WHOLE — it has no storey to spare — and the family stays', footprintOf(s, b).every((j) => s.fireCov[j] > 0) && s.mansion[b] === 1 && footprintOf(s, b).every((j) => s.tier[j] === 3 && !s.rubble[j]) && kept.home === b, `cover ${s.fireCov[b]} mansion ${s.mansion[b]} rubble ${s.rubble[b]} home ${kept.home}`);
    const d = quarter(2, { cottages: true }); const small = family(d, at(d, 10, 9), 'fox', 3); raise(d); const e = A(d);
    const tiles = dissolve(d, at(d, 11, 10));
    check('blocks: dissolve on a mansion tile breaks it into nine cottages (tier 1, no block, no mansion); a family of three fits the anchor\'s cottage and stays', tiles.length === 9 && d.mansion[e] === 0 && nine(d).every((j) => d.tier[j] === 1 && d.big[j] === 0) && small.home === e && d.occupants[e] === 3 && capacityOf(d, e) === KNOBS.R_CAP[1]);
    const g = quarter(2, { cottages: true }); const big = family(g, at(g, 10, 9), 'wolf', 6); raise(g); const f = A(g);
    g.tier[at(g, 4, 10)] = 2; // a two-storey down the street with room for six
    dissolve(g, at(g, 11, 10));
    check('blocks: a family of six does not fit a cottage and is rehomed to the two-storey down the street', big.home === at(g, 4, 10) && g.occupants[f] === 0 && g.occupants[at(g, 4, 10)] === 6, `home ${big.home}`);
  }

  // ---- justice: the class at the address, the priority, the case, the step ---------------------------------------------------------
  {
    const w = quarter(2, { justice: true, cottages: true }), a = A(w); const rich = family(w, at(w, 10, 9), 'wolf', 2); raise(w);
    const thiefHH = family(w, at(w, 5, 10), 'fox', 2, { adults: true, job: at(w, 16, 11) }); const thief = w.byId.get(thiefHH.members[0]);
    refresh(w); const cen = census(w);
    check('justice: the fixture has a served centre, prison, hall and station, the mansion an affluent address and the cottages poverty', cen.centres === 1 && cen.zoos === 1 && cen.policeStations === 1 && cen.markets === 1 && rich.home === a && classAt(w, a) === CLASS.AFFLUENT && classAt(w, at(w, 5, 10)) === CLASS.POVERTY, `${cen.centres} ${cen.zoos} ${cen.policeStations} ${cen.markets}`);
    const fRich = openFile(w, { tile: a, culpritId: thief.id, cause: 'burglary', victimClass: classAt(w, a) });
    const fPlain = openFile(w, { tile: at(w, 5, 10), culpritId: thief.id, cause: 'burglary', victimClass: classAt(w, at(w, 5, 10)) });
    check('justice: a file records the class at the address only when it has one — the mansion\'s file carries 2, the cottage\'s carries no field at all (so older saves hash as they did)', fRich.victimClass === CLASS.AFFLUENT && !('victimClass' in fPlain));
    const pRich = arrestChance(w, cen, fRich, thief), pPlain = arrestChance(w, cen, fPlain, thief);
    check('justice: priority policing is PROBABILITY — the affluent address\'s file rolls at exactly ARREST_PRIORITY[2] more than the cottage\'s, and with no station both roll at 0', Math.abs(pRich - pPlain - KNOBS.ARREST_PRIORITY[2]) < 1e-12 && pPlain > 0 && arrestChance(w, { policeStations: 0 }, fRich, thief) === 0, `${pRich.toFixed(3)} vs ${pPlain.toFixed(3)}`);
    withKnobs({ ARREST_BASE: 0, ARREST_FORCE: 0, ARREST_COVER: 0, CAM_ARREST: 0, ARREST_PRIOR: 0, ARREST_PRIORITY: [0, 0, 0] }, () => {
      const cold = { plain: null, rich: null };
      for (let m = 1; m <= KNOBS.CASE_MONTHS_RICH; m++) {
        w.tick++; const notices = []; filesTick(w, cen, notices);
        if (fPlain.closed && cold.plain === null) cold.plain = m;
        if (fRich.closed && cold.rich === null) cold.rich = m;
      }
      check('justice: … and TIME — the cottage\'s file goes cold after CASE_MONTHS and the affluent address\'s after CASE_MONTHS_RICH, and the cold line says which', cold.plain === KNOBS.CASE_MONTHS && cold.rich === KNOBS.CASE_MONTHS_RICH && w.events.log.some((e) => e.id === 'cold' && new RegExp(`closed after ${KNOBS.CASE_MONTHS_RICH} months`).test(e.line)), `${cold.plain} · ${cold.rich}`);
    });
    const step = (cause, victimClass, thefts, fixed = false) => {
      const q = quarter(2, { justice: true, cottages: true }), qa = A(q); family(q, at(q, 10, 9), 'wolf', 2); raise(q);
      const hh = family(q, at(q, 5, 10), 'fox', 2, { adults: true, job: at(q, 16, 11) }); const c = q.byId.get(hh.members[0]);
      c.thefts = thefts; c.fixed = fixed; refresh(q);
      const f = openFile(q, { tile: victimClass ? qa : at(q, 5, 10), culpritId: c.id, cause, victimClass });
      const notices = []; const line = arrest(q, f, c, false, notices);
      return { line, c, q };
    };
    const first = step('burglary', CLASS.AFFLUENT, 0);
    check('sentence: a FIRST theft from the affluent goes to the centre (one step up from the cells), the line says so and names the estate; the counter still records one theft', /^TAKEN IN —/.test(first.line) && /A first theft from the affluent: one step harsher/.test(first.line) && /the .* estate/.test(first.line) && first.c.thefts === 1 && first.c.heldAt >= 0 && first.q.civic[first.c.heldAt] === CIVIC.CENTRE, first.line);
    const second = step('burglary', CLASS.AFFLUENT, 1);
    check('sentence: a SECOND theft from the affluent goes to the hall', /^SOLD —/.test(second.line) && /A second theft from the affluent\./.test(second.line) && second.c.dead, second.line);
    const murder = step('killing', CLASS.AFFLUENT, 0);
    check('sentence: murder of the affluent, already the centre, becomes the hall', /^SOLD —/.test(murder.line) && /Murder of the affluent\./.test(murder.line), murder.line);
    const plainFirst = step('burglary', CLASS.POVERTY, 0);
    check('sentence: a first theft from a cottage is the cells, as it always was', /^CELLS —/.test(plainFirst.line) && plainFirst.c.thefts === 1 && !/affluent/.test(plainFirst.line), plainFirst.line);
    const plainMurder = step('killing', CLASS.POVERTY, 0);
    check('sentence: murder of a poor animal is the centre, as it always was', /^TAKEN IN —/.test(plainMurder.line) && !/harsher/.test(plainMurder.line), plainMurder.line);
    const trespass = step('trespass', CLASS.AFFLUENT, 0);
    check('sentence: trespass is not theft — a month in the cells whoever it was near', /^CELLS —/.test(trespass.line) && trespass.c.thefts === 0, trespass.line);
  }

  // ---- nothing moves without them -----------------------------------------------------------------------------------------------------
  {
    const w = createWorld({ seed: 'wealth-neutral' }); for (let k = 0; k < 12; k++) tick(w);
    const json = save(w); const c = census(w);
    check('wealth: a town with no culture is a town in poverty — no modest, no affluent, no affluent address, no mansion — and saves without mansion, wealth or class fields', !/"mansion":|"wealth":|"klass":|"victimClass":/.test(json) && c.byClass[0] === c.P && c.byClass[1] === 0 && c.byClass[2] === 0 && c.affluentLots === 0 && c.mansions === 0 && c.taxShareByClass[0] === (c.P ? 1 : 0));
  }
}
