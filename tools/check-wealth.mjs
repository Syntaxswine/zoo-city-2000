// check-wealth.mjs — wealth and class: the checklist, the class field, the mansion that rises (in a dense block too), the
// progressive tax, the priority policing and the harsher step (SPEC §9f; docs/PROPOSAL-WEALTH-AND-CLASS-2026-09-05.md; the
// owner's rulings of 2026-09-05 and 2026-09-06). Run by check.mjs; each check names the rule it pins. Every fixture here is a
// flat 40×40 with one street along y = 12 and a 3×3 of R chalk at (10,9)..(12,11) — THE WINDOW — one tile north of the street.
import { createWorld, ZONE, CIVIC, TERRAIN, idx, capacityOf, footprintOf, anchorOf } from '../js/sim/world.js';
import { apply } from '../js/sim/ops.js';
import { save, load, stateHash } from '../js/sim/save.js';
import { computeFields, REACH } from '../js/sim/fields.js';
import { census } from '../js/sim/census.js';
import { yearlyFigures } from '../js/sim/budget.js';
import { createHousehold, placeHousehold, bestHome, removeHousehold } from '../js/sim/citizens.js';
import { lotScore, REASON, lotReport } from '../js/sim/lots.js';
import { mergeWindow, mergeLots, dissolve } from '../js/sim/blocks.js';
import { openFile, arrest, filesTick, arrestChance } from '../js/sim/justice.js';
import { tick } from '../js/sim/tick.js';
import { KNOBS } from '../js/sim/rules.js';
import { CLASS, CLASS_NAME, ITEMS, attainableClass, rungsFor, classAt, classOfCitizen, computeClass, mansionWindow, waitingLine, haveLine, shopWithinRoad, siteOf, estateName, parkLevel } from '../js/sim/wealth.js';

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
const H = (w) => at(w, 11, 10); // the window's heart
/** Fields and the class field, as the tick computes them. */
const refresh = (w) => { computeFields(w); computeClass(w); };
/**
 * THE QUARTER: the window zoned R at (10,9). A Gallery at (13,10) and a Park at (13,8) are the MODEST list. The owner's
 * AFFLUENT list, every item: the Gallery; an Amphitheater at (4,13) (five from the heart, inside its flood) and a Library at (14,13) — both reach the heart; a
 * University at (20,13) — half the map; a Large Park at (16,6), FIVE from the heart (11,10) and SIX from the corner (10,9), so
 * the heart read is visible; a police station at (9,13), road-adjacent like every civic, its cover 30 at the mansion's anchor and at the cottages alike (both four from its footprint) for the justice roll, and a fire station at (16,13), whose covers reach the window's heart;
 * a standing shop at (16,11), six road tiles from the window's door. `upTo` stops the build at a class: 0 the bare window ·
 * 1 modest · 2 the lot. Cottages down the street at (4..6,10) are where the poor live and where a displaced family goes (the
 * Amphitheater reaches them but no park does: POVERTY); `cottages` also builds two on the window itself, for the families a
 * rise moves.
 */
function quarter(upTo = 2, { justice = false, seed = 'wealth', cottages = false } = {}) {
  const w = street(seed);
  apply(w, { kind: 'zone', zone: ZONE.R, x0: 10, y0: 9, x1: 12, y1: 11, density: 3 });
  if (cottages) { w.tier[at(w, 10, 9)] = 1; w.tier[at(w, 12, 11)] = 1; }
  if (upTo >= 1) { apply(w, { kind: 'gallery', tx: 13, ty: 10 }); apply(w, { kind: 'park', tx: 13, ty: 8 }); }
  if (upTo >= 2) {
    apply(w, { kind: 'amphitheater', tx: 4, ty: 13 }); apply(w, { kind: 'library', tx: 14, ty: 13 }); apply(w, { kind: 'university', tx: 20, ty: 13 });
    apply(w, { kind: 'largePark', tx: 16, ty: 6 }); apply(w, { kind: 'police', tx: 9, ty: 13 }); apply(w, { kind: 'fire', tx: 16, ty: 13 });
    apply(w, { kind: 'zone', zone: ZONE.C, x0: 16, y0: 11, x1: 17, y1: 11, density: 3 }); w.tier[at(w, 16, 11)] = 1;
  }
  apply(w, { kind: 'zone', zone: ZONE.R, x0: 4, y0: 10, x1: 6, y1: 10, density: 3 }); for (let x = 4; x <= 6; x++) w.tier[at(w, x, 10)] = 1;
  if (justice) {
    // The custody the sentences need, all on the street: a centre, a prison, a meat hall (the police station is the quarter's).
    apply(w, { kind: 'centre', tx: 24, ty: 13 }); apply(w, { kind: 'zoo', tx: 28, ty: 13 });
    apply(w, { kind: 'zone', zone: ZONE.M, x0: 18, y0: 11, x1: 18, y1: 11, density: 3 }); w.tier[at(w, 18, 11)] = 1;
  }
  w.valves.R = 0.5; // demand: a mansion needs score > GROW_THRESH like any growth
  refresh(w);
  return w;
}
const unmet = (w, i, fp = null) => attainableClass(w, i, null, fp).unmet.map((r) => r.rung).sort().join(',');
const ladder = (w, i, fp = null) => attainableClass(w, i, null, fp).cls;
const nine = (w) => [0, 1, 2].flatMap((dy) => [0, 1, 2].map((dx) => at(w, 10 + dx, 9 + dy)));
const raze = (w, x, y) => apply(w, { kind: 'bulldoze', x0: x, y0: y, x1: x, y1: y });
/**
 * A household of `size` `species` placed at lot i — CUBS, five years old, unless `adults`: a jobless adult is 3 crime in its
 * own 3×3 (6 for a carnivore) and the town's unemployed share is 40 more everywhere; crime is not on the checklist, but a
 * fixture should not lean on that. An adult fixture takes a job at the shop when `job` is given.
 */
function family(w, i, species = 'fox', size = 3, { adults = false, job = -1 } = {}) {
  const hh = createHousehold(w, species, size);
  for (const id of hh.members) { const c = w.byId.get(id); if (!adults) c.born = w.tick - 5 * 12; else if (job >= 0) { c.job = job; w.staff[job]++; } }
  placeHousehold(w, hh, i);
  return hh;
}
const withKnobs = (patch, fn) => { const saved = {}; for (const k of Object.keys(patch)) { saved[k] = KNOBS[k]; KNOBS[k] = patch[k]; } try { return fn(); } finally { Object.assign(KNOBS, saved); } };
/** Raise the window's mansion through the tick with the roll forced (MANSION_P·score ≥ 1), the way a block is forced. */
const raise = (w) => withKnobs({ MANSION_P: 100 }, () => tick(w));
/** Nine tier-3 tenements on the window, `per` cubs in each but the heart's, which holds the six-fox family that will keep the house. */
function tenements(w, per = 24) {
  for (const j of nine(w)) w.tier[j] = 3;
  const keeper = family(w, H(w), 'fox', 6);
  for (const j of nine(w)) if (j !== H(w)) family(w, j, 'rabbit', per);
  refresh(w);
  return keeper;
}
const AFFLUENT_LIST = 'amphitheater,fire,gallery,largePark,library,police,shop,university';

export function checkWealth(check) {
  // ---- the checklist: every item required, every item bites, nothing else counts ----------------------------------------------------
  {
    const w0 = quarter(0);
    const r0 = attainableClass(w0, A(w0));
    check('checklist: a bare street is POVERTY; the modest list is two items, culture and a park, and the card says both are wanting', r0.cls === CLASS.POVERTY && r0.next === CLASS.MODEST && r0.list.length === 2 && unmet(w0, A(w0)) === 'culture,park' && haveLine(r0) === 'in range of nothing the modest need (0 of 2)' && waitingLine(r0) === 'culture in reach — a Gallery or an Amphitheater · a Park or Large Park within 5', `${haveLine(r0)} · ${waitingLine(r0)}`);
    const w1 = quarter(1);
    const r1 = attainableClass(w1, A(w1));
    check('checklist: a Gallery in reach and a Park within 5 are MODEST; the affluent list is the owner\'s eight and only the Gallery is ticked', r1.cls === CLASS.MODEST && r1.next === CLASS.AFFLUENT && r1.list.length === 8 && r1.have.map((r) => r.rung).join() === 'gallery' && unmet(w1, A(w1)) === 'amphitheater,fire,largePark,library,police,shop,university' && haveLine(r1) === 'in range of a Gallery — 1 of 8 the affluent need', `${haveLine(r1)} · ${waitingLine(r1)}`);
    const w2 = quarter(2);
    const r2 = attainableClass(w2, A(w2), null, nine(w2));
    check('checklist: the window with every item in range is AFFLUENT with nothing wanting — an Amphitheater, a University, a Library, a Gallery, a Large Park, police, fire, a shop', r2.cls === CLASS.AFFLUENT && r2.next === null && r2.unmet.length === 0 && waitingLine(r2) === '' && haveLine(r2) === 'in range of everything the affluent need — an Amphitheater, a University, a Library, a Gallery, a Large Park, police, fire, a shop', haveLine(r2));
    check('checklist: the lists come from the knobs — CLASS_NEEDS names two items for the modest and the owner\'s eight for the affluent, every one an ITEM', KNOBS.CLASS_NEEDS[0].length === 0 && KNOBS.CLASS_NEEDS[1].join() === 'culture,park' && KNOBS.CLASS_NEEDS[2].slice().sort().join() === AFFLUENT_LIST && KNOBS.CLASS_NEEDS.flat().every((n) => ITEMS[n]) && rungsFor(w2, A(w2), 1).length === 2 && rungsFor(w2, A(w2), 2).length === 8);
    // Every item bites: take each away from the whole and the address falls to MODEST naming THAT item and no other.
    const bite = (name, mutate, expectUnmet, expectCls = CLASS.MODEST) => {
      const w = quarter(2); mutate(w); refresh(w);
      const res = attainableClass(w, A(w), null, nine(w));
      check(`checklist bites: ${name}`, res.cls === expectCls && res.unmet.map((r) => r.rung).sort().join(',') === expectUnmet, `${CLASS_NAME[res.cls]} · ${res.unmet.map((r) => r.rung).join(',')} · ${waitingLine(res)}`);
    };
    bite('without the Amphitheater — culture is still in reach through the Gallery, but the affluent want the Amphitheater itself', (w) => raze(w, 4, 13), 'amphitheater');
    bite('without the University — knowledge is still in reach through the Library, but the affluent want the University itself', (w) => raze(w, 20, 13), 'university');
    bite('without the Library — the University reaches, but the affluent want the Library too', (w) => raze(w, 14, 13), 'library');
    bite('without the Gallery — the Amphitheater reaches, but the affluent want the Gallery too', (w) => raze(w, 13, 10), 'gallery');
    bite('without the Large Park — the Park keeps the modest, not the affluent', (w) => raze(w, 16, 6), 'largePark');
    bite('without the police station\'s cover', (w) => raze(w, 9, 13), 'police');
    bite('without the fire station\'s cover', (w) => raze(w, 16, 13), 'fire');
    bite('with the shop unbuilt — a shop within 10 road tiles', (w) => { w.tier[at(w, 16, 11)] = 0; }, 'shop');
    bite('without the Park the Large Park is a park for the modest — still AFFLUENT', (w) => raze(w, 13, 8), '', CLASS.AFFLUENT);
    bite('without either park the address falls two steps to POVERTY, wanting the modest\'s park', (w) => { raze(w, 13, 8); raze(w, 16, 6); }, 'park', CLASS.POVERTY);
    // Reach is each building's OWN: the Library AND the University both reach the heart though the knowledge field keeps only the stronger.
    check('checklist: world.civicReach keeps WHICH buildings reach a tile — all four bits at the heart, the knowledge field 2 (a University\'s) and the culture field 2 (an Amphitheater\'s) beside them; a razed Library clears its bit alone', w2.civicReach[H(w2)] === (REACH.LIBRARY | REACH.UNIVERSITY | REACH.GALLERY | REACH.AMPHITHEATER) && w2.knowledge[H(w2)] === 2 && w2.culture[H(w2)] === 2
      && (() => { const q = quarter(2); raze(q, 14, 13); refresh(q); return q.civicReach[H(q)] === (REACH.UNIVERSITY | REACH.GALLERY | REACH.AMPHITHEATER) && q.knowledge[H(q)] === 2; })(), `bits ${w2.civicReach[H(w2)]}`);
    // Nothing else counts: the fields are not on the list.
    const poke = (name, fields) => {
      const w = quarter(2); for (const [f, v] of Object.entries(fields)) { w[f][A(w)] = v; w[f][H(w)] = v; }
      const res = attainableClass(w, A(w), null, nine(w));
      check(`checklist: ${name}`, res.cls === CLASS.AFFLUENT && res.unmet.length === 0, `${CLASS_NAME[res.cls]} · ${waitingLine(res)}`);
    };
    poke('pollution 99 is not on the list — still affluent', { pol: 99 });
    poke('crime 100, a dense block\'s heart, is not on the list — still affluent (the owner: "mansions should rise in dense blocks too")', { crime: 100 });
    poke('a meat hall\'s dread is not on the list', { dread: 40 });
    poke('land value 0 is not on the list — it is the tax\'s', { lv: 0 });
    check('checklist: water or trees beside the plot are not on the list — a tree beside the anchor changes nothing either way', (() => { const q = quarter(1); q.terrain[at(q, 9, 9)] = TERRAIN.TREE; refresh(q); return ladder(q, A(q)) === CLASS.MODEST && unmet(q, A(q)) === 'amphitheater,fire,largePark,library,police,shop,university'; })());
    // The shop is a ROAD distance from the doors, not a Chebyshev one: ten road tiles is in reach, eleven is not.
    const far = quarter(2); far.tier[at(far, 16, 11)] = 0; apply(far, { kind: 'zone', zone: ZONE.C, x0: 20, y0: 11, x1: 21, y1: 11, density: 3 }); far.tier[at(far, 21, 11)] = 1; refresh(far);
    check('checklist: the shop walks the road — a shop 11 road tiles from the anchor\'s door is out of reach at 10, in reach at 11, and the address is MODEST wanting the shop', !shopWithinRoad(far, A(far), 10) && shopWithinRoad(far, A(far), 11) && unmet(far, A(far), nine(far)) === 'shop' && (() => { far.tier[at(far, 21, 11)] = 0; far.tier[at(far, 20, 11)] = 1; refresh(far); return ladder(far, A(far), nine(far)) === CLASS.AFFLUENT; })());
    // A 3×3 is read at its HEART: the Large Park is five from the heart and six from the corner, so the corner as a lot of its own is
    // MODEST and the window is AFFLUENT.
    const site = siteOf(w2, A(w2), nine(w2));
    check('site: a 3×3 is read at its heart — the corner as a lot of its own wants the Large Park (six away) and is MODEST; the window, read at its heart five away, is AFFLUENT; the heart as a lot of its own is affluent too', site.heart === H(w2) && ladder(w2, A(w2)) === CLASS.MODEST && unmet(w2, A(w2)) === 'largePark' && ladder(w2, A(w2), site.tiles) === CLASS.AFFLUENT && ladder(w2, H(w2)) === CLASS.AFFLUENT && parkLevel(w2, H(w2), 5) === 2 && parkLevel(w2, A(w2), 5) === 1);
    check('knobs: the lists are knobs — with the affluent list cut to the Amphitheater alone, a street with only an Amphitheater and a park is affluent', withKnobs({ CLASS_NEEDS: [[], ['culture', 'park'], ['amphitheater']] }, () => { const q = quarter(1); apply(q, { kind: 'amphitheater', tx: 4, ty: 13 }); refresh(q); return ladder(q, A(q)) === CLASS.AFFLUENT && !!mansionWindow(q, A(q)); }));
  }

  // ---- the class field: what the ADDRESS affords, this month ---------------------------------------------------------------------
  {
    const w = quarter(2);
    check('class: computeClass writes the checklist into world.klass on every R lot of its own — affluent at the heart, modest at the corner (the Large Park six away), poverty at the cottages down the street (culture but no park), nothing off the housing', w.klass[H(w)] === CLASS.AFFLUENT && w.klass[A(w)] === CLASS.MODEST && w.klass[at(w, 5, 10)] === CLASS.POVERTY && w.klass[at(w, 20, 20)] === 0, `${w.klass[H(w)]} · ${w.klass[A(w)]} · ${w.klass[at(w, 5, 10)]}`);
    const rich = family(w, H(w), 'wolf', 4), poor = family(w, at(w, 5, 10), 'rabbit', 2);
    const c = w.byId.get(rich.members[0]);
    const was = classOfCitizen(w, c); c.home = at(w, 6, 10); const moved = classOfCitizen(w, c); c.home = H(w);
    check('class: a citizen\'s class is the class at home — a household that moves reads its new street; nothing is carried', was === CLASS.AFFLUENT && moved === CLASS.POVERTY && classOfCitizen(w, w.byId.get(poor.members[0])) === CLASS.POVERTY && classAt(w, at(w, 12, 11)) === CLASS.AFFLUENT);
    raze(w, 4, 13); refresh(w);
    check('class: the street comes down and the class with it — the Amphitheater razed, the same family at the same address is MODEST', w.klass[H(w)] === CLASS.MODEST && classOfCitizen(w, c) === CLASS.MODEST && unmet(w, H(w)) === 'amphitheater');
    const camper = createHousehold(w, 'cat', 2);
    check('class: a household without a home is in poverty', classOfCitizen(w, w.byId.get(camper.members[0])) === CLASS.POVERTY);
    check('class: a town saves without a mansion array, a reach field, a wealth field or a class field — all derived, so nothing older moves', !/"mansion":|"wealth":|"klass":|"civicReach":/.test(save(quarter(0))) && !/"klass":|"wealth":|"civicReach":/.test(save(w)));
  }

  // ---- the mansion rises -----------------------------------------------------------------------------------------------------------
  {
    const w = quarter(2);
    const win = mansionWindow(w, A(w));
    check('window: the 3×3 anchored at a lot whose site is affluent — nine R lots on one line — is a mansion window, nine tiles, anchored at the north corner', !!win && win.anchor === A(w) && win.tiles.length === 9 && win.tiles.every((j) => w.zone[j] === ZONE.R));
    check('window: anchored at its corner only — a middle tile of the same nine anchors a window that runs into the Gallery, and has none', mansionWindow(w, H(w)) === null && mansionWindow(w, at(w, 10, 10)) === null);
    check('window: a class short there is no window at all', (() => { const q = quarter(1); return mansionWindow(q, A(q)) === null; })());
    // The cheap items at the heart are asked first for speed; the whole checklist decides. A window whose heart passes every cheap
    // item and lacks only the shop, or only the Large Park, has no window.
    check('window: the whole checklist decides, not the cheap items at the heart — without the shop, or without the Large Park, there is no window', (() => { const q = quarter(2); q.tier[at(q, 16, 11)] = 0; refresh(q); return mansionWindow(q, A(q)) === null && KNOBS.CLASS_NEEDS[2].filter((n) => ITEMS[n].cheap).every((n) => ITEMS[n].ok(q, { anchor: A(q), tiles: null, heart: H(q) })); })()
      && (() => { const q = quarter(2); raze(q, 16, 6); refresh(q); return mansionWindow(q, A(q)) === null; })());
    // The cheap questions are asked at the HEART: with the fire station one tile east its cover begins at x = 11 — the corner is
    // outside it and the heart inside — and the window stands.
    check('window: the cheap items are read at the heart, not the corner — the fire station moved one east leaves the corner outside its cover and the heart inside, and the window stands', (() => { const q = quarter(2); raze(q, 16, 13); apply(q, { kind: 'fire', tx: 17, ty: 13 }); refresh(q); return q.fireCov[A(q)] === 0 && q.fireCov[H(q)] > 0 && !!mansionWindow(q, A(q)) && ladder(q, A(q)) === CLASS.MODEST && ladder(q, A(q), nine(q)) === CLASS.AFFLUENT; })());
    check('window: a tile on another use line, or water inside the nine, and there is no window', (() => { const q = quarter(2); apply(q, { kind: 'use', use: 1, x0: 12, y0: 11, x1: 12, y1: 11 }); refresh(q); return mansionWindow(q, A(q)) === null; })()
      && (() => { const q = quarter(2); q.terrain[H(q)] = TERRAIN.WATER; return mansionWindow(q, A(q)) === null; })());
    const s = lotScore(w, A(w));
    check('lotScore: the anchor reads MANSION_RISING at MANSION_P·score with the window on the report — before any storey, before any block', s.reason === REASON.MANSION_RISING && s.mansion && s.mansion.anchor === A(w) && Math.abs(s.p - KNOBS.MANSION_P * s.score) < 1e-12 && !s.grow && !s.merge, `${s.reason} p ${s.p}`);
    check('lotScore: without demand nothing rises — the window is there and the reason is the street\'s', (() => { const q = quarter(2); q.valves.R = -0.3; const r = lotScore(q, A(q)); return r.reason !== REASON.MANSION_RISING && !r.mansion && !!mansionWindow(q, A(q)); })());
    check('lotScore: no affluent address, no window — a town whose checklist stops at modest reports every lot without one', (() => { const q = quarter(1); for (let i = 0; i < q.w * q.h; i++) if (q.zone[i] === ZONE.R && lotScore(q, i).mansion) return false; return true; })());
    // Through the tick, with families on the window: the largest keeps the house, the rest are moved out within twelve road tiles.
    const t = quarter(2, { cottages: true });
    const keep = family(t, at(t, 10, 9), 'fox', 3), out = family(t, at(t, 12, 11), 'rabbit', 2);
    raise(t);
    const a = A(t);
    check('rise: the window becomes ONE mansion — big 3 and its parts, tier 3 on nine tiles, capacity MANSION_CAP, the MANSION line logged under its id and in the notices with the checklist on it',
      t.mansion[a] === 1 && t.big[a] === 3 && footprintOf(t, a).length === 9 && footprintOf(t, a).every((j) => t.tier[j] === 3 && anchorOf(t, j) === a) && capacityOf(t, a) === KNOBS.MANSION_CAP
      && t.notices.some((l) => /^MANSION — a mansion has risen at \(10,9\)\..*The address is in range of everything the affluent need — an Amphitheater, a University, a Library, a Gallery, a Large Park, police, fire, a shop; one household/.test(l)) && t.events.log.some((e) => e.id === 'mansion' && /moved out/.test(e.line)), `${t.mansion[a]} · ${t.big[a]} · cap ${capacityOf(t, a)} · ${t.notices.find((l) => /^MANSION/.test(l))}`);
    check('rise: the largest household that fits keeps the house on the anchor; the other is moved out to a cottage within twelve road tiles, never onto the window', keep.home === a && t.occupants[a] === 3 && out.home !== a && out.home >= 0 && !footprintOf(t, a).includes(out.home) && t.zone[out.home] === ZONE.R && out.members.every((id) => t.byId.get(id).home === out.home)
      && t.notices.some((l) => /keep the house; 2 animals were moved out to make room/.test(l)), `keeper ${keep.home} out ${out.home}`);
    check('rise: the standing mansion neither grows, decays nor merges — MANSION, p 0, no window; its parts read PART; its class is read at its heart and is affluent', lotScore(t, a).reason === REASON.MANSION && lotScore(t, a).p === 0 && mergeWindow(t, a) === null && mansionWindow(t, a) === null && lotScore(t, H(t)).reason === REASON.PART && (computeClass(t), t.klass[a] === CLASS.AFFLUENT));
    const empty = quarter(2); raise(empty);
    check('rise: nine empty lots rise too — "Nobody lived on the nine lots; the house stands empty" — and the mansion waits for a family', empty.mansion[A(empty)] === 1 && empty.occupants[A(empty)] === 0 && empty.notices.some((l) => /Nobody lived on the nine lots/.test(l)));
    check('mansion: a household of any class may take an empty mansion, and none may join while one lives there', bestHome(empty, 'fox', 3, false) === A(empty) && bestHome(t, 'cat', 2, false) !== a);
    let months = 0; withKnobs({ DECAY_P: 0 }, () => { while (empty.occupants[A(empty)] === 0 && months < 60) { tick(empty); months++; } }); // the shop held standing: the checklist needs it
    const hh = empty.households.find((h) => !h.gone && h.home === A(empty));
    check('mansion: a household that walks in through citizensTick is AFFLUENT by its address, and THE ESTATE line is in the log', !!hh && classOfCitizen(empty, empty.byId.get(hh.members[0])) === CLASS.AFFLUENT && empty.events.log.some((e) => /^THE ESTATE — the .* have moved into the mansion at \(10,9\)\./.test(e.line)), `${months} months · ${hh && hh.surname}`);
    check('mansion: the card names the estate by its family, and an empty one is "the empty mansion"', estateName(empty, at(empty, 11, 11)) === `the ${hh.surname} estate` && estateName(t, a) === `the ${keep.surname} estate` && estateName(t, at(t, 5, 10)) === null && lotReport(t, a).mansion === 1 && lotReport(t, a).klass.cls === CLASS.AFFLUENT);
    const copy = load(save(t));
    for (let k = 0; k < 12; k++) { tick(t); tick(copy); }
    check('mansion: save → load → twelve months hash-equals with a mansion standing and the classes counted', stateHash(t) === stateHash(copy) && /"mansion":/.test(save(t)), `${stateHash(t)} vs ${stateHash(copy)}`);
  }

  // ---- in a dense block too (the owner, night): the tenements, the apartment block, the 2×2 inside the window ------------------------
  {
    // Nine tier-3 tenements full of animals put the heart's crime at the ceiling by density alone (0.4 a head in the 3×3, the game's
    // own law since session 1): crime is not on the checklist, the window is AFFLUENT all the same, and it stands.
    const d = quarter(2); const keeper = tenements(d);
    const rd = attainableClass(d, A(d), null, nine(d));
    check('dense: nine full tenements — 198 animals on the nine, the density that read crime 100 under the gates — and the window is affluent all the same, crime not being on the list — "mansions should rise in dense blocks too"',
      nine(d).reduce((s, j) => s + d.occupants[j], 0) === 198 && rd.cls === CLASS.AFFLUENT && rd.unmet.length === 0 && !!mansionWindow(d, A(d)) && lotScore(d, A(d)).reason === REASON.MANSION_RISING,
      `crime ${d.crime[H(d)]} · ${CLASS_NAME[rd.cls]} · ${waitingLine(rd)}`);
    raise(d);
    const onWindow = d.households.filter((h) => !h.gone && nine(d).includes(h.home));
    check('dense: the mansion rises through the tick — the six foxes keep the house, the 192 rabbits are moved out (the cottages take what they can, the rest camp or leave), nobody else is left on the nine', d.mansion[A(d)] === 1 && keeper.home === A(d) && d.occupants[A(d)] === 6 && onWindow.length === 1 && onWindow[0] === keeper
      && d.notices.some((l) => /keep the house; 192 animals were moved out to make room/.test(l)) && d.campers.length + d.households.filter((h) => h.gone).length > 0, `campers ${d.campers.length} · gone ${d.households.filter((h) => h.gone).length} · ${d.notices.find((l) => /^MANSION/.test(l))}`);
    // THE APARTMENT BLOCK BECOMES THE MANSION: a formed 3×3 block on an affluent address is itself the window ("like when the
    // building upgrades"); its households live on its anchor, the largest that fits keeps the house.
    const b = quarter(2); for (const j of nine(b)) b.tier[j] = 3;
    mergeLots(b, { side: 3, anchor: A(b), tiles: nine(b) }); refresh(b);
    const big = family(b, A(b), 'wolf', 5), small = family(b, A(b), 'cat', 2);
    const wb = mansionWindow(b, A(b));
    check('blocks: a formed 3×3 block on an affluent address is a mansion window — the block itself, anchored at its anchor — and its anchor reads MANSION_RISING', b.big[A(b)] === 3 && !!wb && wb.tiles.length === 9 && lotScore(b, A(b)).reason === REASON.MANSION_RISING && mansionWindow(b, H(b)) === null);
    raise(b);
    check('blocks: the apartment block becomes the mansion — the wolves keep the house, the cats are moved out down the street', b.mansion[A(b)] === 1 && big.home === A(b) && b.occupants[A(b)] === 5 && small.home >= 0 && small.home !== A(b) && !nine(b).includes(small.home) && b.notices.some((l) => /keep the house; 2 animals were moved out/.test(l)), `wolves ${big.home} cats ${small.home}`);
    // A 2×2 lying WHOLLY inside the window is admitted; one straddling its edge is not.
    const q2 = quarter(2); for (const j of [at(q2, 11, 10), at(q2, 12, 10), at(q2, 11, 11), at(q2, 12, 11)]) q2.tier[j] = 3;
    mergeLots(q2, { side: 2, anchor: at(q2, 11, 10), tiles: [at(q2, 11, 10), at(q2, 12, 10), at(q2, 11, 11), at(q2, 12, 11)] }); refresh(q2);
    const fam2 = family(q2, at(q2, 11, 10), 'fox', 4);
    const w2x2 = mansionWindow(q2, A(q2));
    raise(q2);
    check('blocks: a 2×2 block lying wholly inside the window is admitted — the window is the nine, the rise takes the block with it and its family keeps the house', !!w2x2 && w2x2.tiles.length === 9 && q2.mansion[A(q2)] === 1 && fam2.home === A(q2) && q2.big[at(q2, 11, 10)] !== 2, `${!!w2x2} · ${q2.mansion[A(q2)]} · ${fam2.home}`);
    // The straddling block must NOT hold the window's anchor, or the part rule answers before the straddle rule does (a mutant
    // admitting straddlers survived a fixture anchored inside one).
    const st = quarter(2); apply(st, { kind: 'zone', zone: ZONE.R, x0: 11, y0: 8, x1: 12, y1: 8, density: 3 });
    for (const j of [at(st, 11, 8), at(st, 12, 8), at(st, 11, 9), at(st, 12, 9)]) st.tier[j] = 3;
    mergeLots(st, { side: 2, anchor: at(st, 11, 8), tiles: [at(st, 11, 8), at(st, 12, 8), at(st, 11, 9), at(st, 12, 9)] }); refresh(st);
    check('blocks: a 2×2 straddling the window\'s edge is not — no window while a block reaches out of the nine, though the anchor is a lot of its own and the address affluent', mansionWindow(st, A(st)) === null && st.big[at(st, 11, 8)] === 2 && st.big[A(st)] === 0 && ladder(st, A(st), nine(st)) === CLASS.AFFLUENT, `${mansionWindow(st, A(st))} · big ${st.big[A(st)]}`);
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
    // Off the beat: the quarter's fire station is razed after the rise, so the mansion burns out.
    const w = quarter(2, { cottages: true }); const fam = family(w, at(w, 10, 9), 'fox', 3); raise(w); const a = A(w);
    raze(w, 16, 13); refresh(w);
    for (const j of footprintOf(w, a)) w.burning[j] = 1;
    tick(w);
    check('fire: a mansion burnt out off the beat goes to rubble on all nine tiles as plain R lots again — mansion 0, block 0, tier 0 — the family out, no tier wrapping',
      w.mansion[a] === 0 && nine(w).every((j) => w.rubble[j] === KNOBS.RUBBLE_MONTHS && w.big[j] === 0 && w.tier[j] === 0 && w.zone[j] === ZONE.R) && w.occupants[a] === 0 && fam.home !== a && Math.max(...w.tier) <= 3,
      `mansion ${w.mansion[a]} rubble ${w.rubble[a]} occ ${w.occupants[a]} home ${fam.home}`);
    removeHousehold(w, fam, 'left');
    withKnobs({ MANSION_P: 0, DECAY_P: 0 }, () => { for (let k = 0; k < KNOBS.RUBBLE_MONTHS + 1; k++) tick(w); }); // the roll held while the rubble clears, so the rise below is the forced one (a lot may sprout meanwhile; a lot of its own is still a window's)
    apply(w, { kind: 'fire', tx: 16, ty: 13 }); refresh(w); // the station back: the checklist wants its cover
    const again = w.rubble[a] === 0 && w.big[a] === 0 && w.mansion[a] === 0 && w.klass[H(w)] === CLASS.AFFLUENT && !!mansionWindow(w, a);
    raise(w);
    check('fire: when the rubble clears the nine are lots of their own again on an affluent address, and a mansion may rise again', again && w.mansion[a] === 1, `rubble ${w.rubble[a]} big ${w.big[a]} mansion ${w.mansion[a]} klass ${w.klass[H(w)]} · ${waitingLine(attainableClass(w, a, null, nine(w)))}`);
    const s = quarter(2, { cottages: true }); const kept = family(s, at(s, 10, 9), 'fox', 3); raise(s); const b = A(s);
    for (const j of footprintOf(s, b)) s.burning[j] = 1;
    withKnobs({ FIRE_SAVED: 1 }, () => { tick(s); });
    check('fire: on the beat — the quarter\'s own fire station, the checklist\'s — the engine saves the mansion WHOLE, it has no storey to spare, and the family stays', footprintOf(s, b).every((j) => s.fireCov[j] > 0) && s.mansion[b] === 1 && footprintOf(s, b).every((j) => s.tier[j] === 3 && !s.rubble[j]) && kept.home === b, `cover ${s.fireCov[b]} mansion ${s.mansion[b]} rubble ${s.rubble[b]} home ${kept.home}`);
    const d = quarter(2, { cottages: true }); const small = family(d, at(d, 10, 9), 'fox', 3); raise(d); const e = A(d);
    const tiles = dissolve(d, H(d));
    check('blocks: dissolve on a mansion tile breaks it into nine cottages (tier 1, no block, no mansion); a family of three fits the anchor\'s cottage and stays', tiles.length === 9 && d.mansion[e] === 0 && nine(d).every((j) => d.tier[j] === 1 && d.big[j] === 0) && small.home === e && d.occupants[e] === 3 && capacityOf(d, e) === KNOBS.R_CAP[1]);
    const g = quarter(2, { cottages: true }); const big = family(g, at(g, 10, 9), 'wolf', 6); raise(g); const f = A(g);
    g.tier[at(g, 4, 10)] = 2; // a two-storey down the street with room for six
    dissolve(g, H(g));
    check('blocks: a family of six does not fit a cottage and is rehomed to the two-storey down the street', big.home === at(g, 4, 10) && g.occupants[f] === 0 && g.occupants[at(g, 4, 10)] === 6, `home ${big.home}`);
  }

  // ---- justice: the class at the address, the priority, the case, the step ---------------------------------------------------------
  {
    const w = quarter(2, { justice: true, cottages: true }), a = A(w); const rich = family(w, at(w, 10, 9), 'wolf', 2); raise(w);
    const thiefHH = family(w, at(w, 5, 10), 'fox', 2, { adults: true, job: at(w, 16, 11) }); const thief = w.byId.get(thiefHH.members[0]);
    refresh(w); const cen = census(w);
    check('justice: the fixture has a served centre, prison, hall and one station, the mansion an affluent address and the cottage poverty, both under the same police cover', cen.centres === 1 && cen.zoos === 1 && cen.policeStations === 1 && cen.markets === 1 && rich.home === a && classAt(w, a) === CLASS.AFFLUENT && classAt(w, at(w, 5, 10)) === CLASS.POVERTY && w.policeCov[a] === w.policeCov[at(w, 5, 10)] && w.policeCov[a] > 0, `${cen.centres} ${cen.zoos} ${cen.policeStations} ${cen.markets} · ${classAt(w, a)} · ${classAt(w, at(w, 5, 10))} · cover ${w.policeCov[a]} ${w.policeCov[at(w, 5, 10)]}`);
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
    check('wealth: a town with nothing near its housing is a town in poverty — no modest, no affluent, no affluent address, no mansion — and saves without mansion, wealth, reach or class fields', !/"mansion":|"wealth":|"klass":|"civicReach":|"victimClass":/.test(json) && c.byClass[0] === c.P && c.byClass[1] === 0 && c.byClass[2] === 0 && c.affluentLots === 0 && c.mansions === 0 && c.taxShareByClass[0] === (c.P ? 1 : 0));
  }
}
