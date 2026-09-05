// check-wealth.mjs — wealth and class: the ladder, the estate and its mansion, the tax, the priority policing and the
// harsher step (SPEC §9f; docs/PROPOSAL-WEALTH-AND-CLASS-2026-09-05.md; the owner's rulings of 2026-09-05). Run by
// check.mjs; each check names the rule it pins. Every fixture here is a flat 40×40 with one street along y = 12.
import { createWorld, ZONE, CIVIC, TERRAIN, PART, idx, capacityOf, footprintOf, anchorOf, isPart } from '../js/sim/world.js';
import { apply, undo } from '../js/sim/ops.js';
import { save, load, stateHash } from '../js/sim/save.js';
import { computeFields, served } from '../js/sim/fields.js';
import { census } from '../js/sim/census.js';
import { yearlyFigures } from '../js/sim/budget.js';
import { createHousehold, placeHousehold, bestHome, removeHousehold } from '../js/sim/citizens.js';
import { lotScore, REASON, lotReport } from '../js/sim/lots.js';
import { mergeWindow, dissolve } from '../js/sim/blocks.js';
import { openFile, arrest, filesTick, arrestChance } from '../js/sim/justice.js';
import { tick } from '../js/sim/tick.js';
import { KNOBS } from '../js/sim/rules.js';
import { CLASS, CLASS_NAME, ESTATE, attainableClass, rungsFor, classForArrival, classAt, classOfCitizen, estatesTick, waitingLine, shopWithinRoad, nature8, estateName } from '../js/sim/wealth.js';

/** Flat grass, nothing on it, rich; one street along y = 12 from x = 4 to 30. */
function street(seed = 'wealth') {
  const world = createWorld({ seed, w: 40, h: 40 });
  for (const k of ['terrain', 'road', 'zone', 'civic', 'civicSize', 'wall', 'rail', 'tier', 'big', 'rubble', 'burning', 'flooded', 'estate', 'theme']) world[k].fill(0);
  world.cash = 900000; world.roadsDirty = true; world.wallsDirty = true;
  apply(world, { kind: 'road', tiles: Array.from({ length: 27 }, (_, k) => idx(world, 4 + k, 12)) });
  return world;
}
const at = (w, x, y) => idx(w, x, y);
const A = (w) => at(w, 10, 9); // the estate's anchor in every quarter: tiles 10..12 × 9..11, the street one tile south
/**
 * THE ESTATE QUARTER: the plot at (10,9) on the street; a Gallery at (13,10) and a park at (13,8) make the address affluent;
 * an Amphitheater at (7,13), a Library at (14,13), a standing shop at (16,11) and a tree west of the anchor make it
 * ultrawealthy. `upTo` stops the build at a rung: 0 the bare plot · 1 affluent · 2 every rung.
 */
function quarter(upTo = 2, { justice = false, seed = 'wealth' } = {}) {
  const w = street(seed);
  apply(w, { kind: 'estate', tx: 10, ty: 9 });
  if (upTo >= 1) { apply(w, { kind: 'gallery', tx: 13, ty: 10 }); apply(w, { kind: 'park', tx: 13, ty: 8 }); }
  if (upTo >= 2) {
    apply(w, { kind: 'amphitheater', tx: 7, ty: 13 }); apply(w, { kind: 'library', tx: 14, ty: 13 });
    apply(w, { kind: 'zone', zone: ZONE.C, x0: 16, y0: 11, x1: 17, y1: 11, density: 3 }); w.tier[at(w, 16, 11)] = 1;
    w.terrain[at(w, 9, 9)] = TERRAIN.TREE;
  }
  if (justice) {
    // The custody the sentences need, all on the street: a centre, a prison, a meat hall, a police station; and a thief's cottage.
    apply(w, { kind: 'centre', tx: 20, ty: 13 }); apply(w, { kind: 'zoo', tx: 24, ty: 13 }); apply(w, { kind: 'police', tx: 28, ty: 13 });
    apply(w, { kind: 'zone', zone: ZONE.M, x0: 18, y0: 11, x1: 18, y1: 11, density: 3 }); w.tier[at(w, 18, 11)] = 1;
    apply(w, { kind: 'zone', zone: ZONE.R, x0: 5, y0: 10, x1: 5, y1: 10, density: 3 }); w.tier[at(w, 5, 10)] = 1;
  }
  computeFields(w);
  return w;
}
const unmet = (w, i) => attainableClass(w, i).unmet.map((r) => r.rung).sort().join(',');
const ladder = (w, i) => attainableClass(w, i).cls;
/** A household of `size` `species` placed at lot i the way an arrival is placed: class from the lot. */
function arrive(w, i, species = 'fox', size = 3) {
  const hh = createHousehold(w, species, size);
  hh.wealth = classForArrival(w, i);
  placeHousehold(w, hh, i);
  return hh;
}
const withKnobs = (patch, fn) => { const saved = {}; for (const k of Object.keys(patch)) { saved[k] = KNOBS[k]; KNOBS[k] = patch[k]; } try { return fn(); } finally { Object.assign(KNOBS, saved); } };

export function checkWealth(check) {
  // ---- the ladder: gates, every rung a field, every rung bites -------------------------------------------------------------
  {
    const w0 = quarter(0);
    check('ladder: a bare estate plot on the street is MODEST, and the card names exactly the two rungs the affluent lack here — culture and a park', ladder(w0, A(w0)) === CLASS.MODEST && unmet(w0, A(w0)) === 'culture,park', `${ladder(w0, A(w0))} · ${unmet(w0, A(w0))}`);
    const w1 = quarter(1);
    check('ladder: a Gallery in reach and a park within 4 make the address AFFLUENT; the next rung wants an Amphitheater, knowledge, a shop and nature', ladder(w1, A(w1)) === CLASS.AFFLUENT && unmet(w1, A(w1)) === 'culture,knowledge,nature,shops', `${ladder(w1, A(w1))} · ${unmet(w1, A(w1))}`);
    const w2 = quarter(2);
    check('ladder: every rung met is ULTRAWEALTHY with nothing unmet, and the plot is still chalk until the tick', ladder(w2, A(w2)) === CLASS.ULTRAWEALTHY && unmet(w2, A(w2)) === '' && w2.estate[A(w2)] === ESTATE.PLOT && capacityOf(w2, A(w2)) === 0, unmet(w2, A(w2)));
    check('ladder: the affluent have six rungs and the ultrawealthy nine, straight from the knobs', rungsFor(w2, A(w2), 1).length === 6 && rungsFor(w2, A(w2), 2).length === 9);
    // Every rung bites: take each away in turn and the ladder names THAT rung and no other.
    const bite = (name, mutate, expectCls, expectUnmet) => {
      const w = quarter(2); mutate(w); computeFields(w);
      const res = attainableClass(w, A(w));
      check(`ladder bites: ${name}`, res.cls === expectCls && res.unmet.map((r) => r.rung).sort().join(',') === expectUnmet, `${CLASS_NAME[res.cls]} · ${res.unmet.map((r) => r.rung).join(',')}`);
    };
    bite('without the Amphitheater the address is affluent and wants "an Amphitheater\'s culture"', (w) => apply(w, { kind: 'bulldoze', x0: 7, y0: 13, x1: 7, y1: 13 }), CLASS.AFFLUENT, 'culture');
    bite('without the Library it wants knowledge', (w) => apply(w, { kind: 'bulldoze', x0: 14, y0: 13, x1: 14, y1: 13 }), CLASS.AFFLUENT, 'knowledge');
    bite('without the park it is modest and wants a park', (w) => apply(w, { kind: 'bulldoze', x0: 13, y0: 8, x1: 13, y1: 8 }), CLASS.MODEST, 'park');
    bite('with the shop unbuilt it wants a shop within 6 road tiles', (w) => { w.tier[at(w, 16, 11)] = 0; }, CLASS.AFFLUENT, 'shops');
    bite('without the tree it wants water or trees beside the plot', (w) => { w.terrain[at(w, 9, 9)] = TERRAIN.GRASS; }, CLASS.AFFLUENT, 'nature');
    // The field rungs, poked after computeFields (attainableClass reads the fields as they stand).
    const poke = (name, field, value, expectCls, expectUnmet) => {
      const w = quarter(2); w[field][A(w)] = value;
      const res = attainableClass(w, A(w));
      check(`ladder bites: ${name}`, res.cls === expectCls && res.unmet.map((r) => r.rung).sort().join(',') === expectUnmet, `${CLASS_NAME[res.cls]} · ${res.unmet.map((r) => r.rung).join(',')}`);
    };
    poke('pollution 15 is clean enough for the affluent and too dirty for the ultrawealthy', 'pol', 15, CLASS.AFFLUENT, 'air');
    poke('pollution 25 is too dirty for either', 'pol', 25, CLASS.MODEST, 'air');
    poke('crime 30 keeps the ultrawealthy away', 'crime', 30, CLASS.AFFLUENT, 'streets');
    poke('crime 50 keeps the affluent away too', 'crime', 50, CLASS.MODEST, 'streets');
    poke('any dread at all is too much for either', 'dread', 5, CLASS.MODEST, 'smell');
    poke('land value 70 is affluent, not ultrawealthy', 'lv', 70, CLASS.AFFLUENT, 'land value');
    poke('land value 50 is modest', 'lv', 50, CLASS.MODEST, 'land value');
    // The shop rung is a ROAD distance from the doors, not a Chebyshev one.
    const far = quarter(2); far.tier[at(far, 16, 11)] = 0; apply(far, { kind: 'zone', zone: ZONE.C, x0: 21, y0: 11, x1: 21, y1: 11, density: 3 }); far.tier[at(far, 21, 11)] = 1; computeFields(far);
    check('ladder: the shop rung walks the road — a shop 9 road tiles from the plot\'s nearest door is out of reach at 6, and in reach at 9', !shopWithinRoad(far, A(far), 6) && shopWithinRoad(far, A(far), 9) && unmet(far, A(far)) === 'shops');
    check('ladder: nature8 counts water and trees among the eight neighbours of the anchor', nature8(w2, A(w2)) === 1 && nature8(w0, A(w0)) === 0);
  }

  // ---- the estate op --------------------------------------------------------------------------------------------------------
  {
    const w = street();
    w.terrain[at(w, 11, 10)] = TERRAIN.TREE; // a tree on the footprint: felled at §COST.bulldozeTree, and put back by undo
    const h0 = stateHash(w);
    check('estate: refused off the road, atomically', !apply(w, { kind: 'estate', tx: 20, ty: 20 }).ok && stateHash(w) === h0);
    check('estate: refused off the map, on water and on chalk', !apply(w, { kind: 'estate', tx: 38, ty: 9 }).ok && (() => { const q = street(); q.terrain[at(q, 11, 10)] = TERRAIN.WATER; return !apply(q, { kind: 'estate', tx: 10, ty: 9 }).ok; })()
      && (() => { const q = street(); apply(q, { kind: 'zone', zone: ZONE.R, x0: 12, y0: 11, x1: 12, y1: 11, density: 3 }); return !apply(q, { kind: 'estate', tx: 10, ty: 9 }).ok; })());
    const r = apply(w, { kind: 'estate', tx: 10, ty: 9 });
    const a = A(w), tiles = footprintOf(w, a);
    check('estate: a 3×3 R block anchor at tier 0 — nine tiles zone R, big 3 and parts, estate PLOT on the anchor only, capacity 0, §COST.estate plus the tree it felled',
      r.ok && r.cost === KNOBS.COST.estate + KNOBS.COST.bulldozeTree && tiles.length === 9 && w.big[a] === 3 && w.estate[a] === ESTATE.PLOT
      && tiles.every((j) => w.zone[j] === ZONE.R && w.tier[j] === 0 && w.maxTier[j] === 3 && anchorOf(w, j) === a && (j === a || (isPart(w, j) && !w.estate[j]))) && capacityOf(w, a) === 0 && w.terrain[at(w, 11, 10)] === TERRAIN.GRASS,
      `ok ${r.ok} cost ${r.cost} big ${w.big[a]} estate ${w.estate[a]} cap ${capacityOf(w, a)}`);
    check('estate: undoable, and undo puts the hash back exactly', r.undoable && undo(w).ok && stateHash(w) === h0);
    apply(w, { kind: 'estate', tx: 10, ty: 9 });
    const built = stateHash(w);
    const zoneC = apply(w, { kind: 'zone', zone: ZONE.C, x0: 9, y0: 8, x1: 13, y1: 12, density: 3 });
    check('estate: chalk never repaints it — a zone drag over the footprint zones the ground round it and leaves the nine tiles R', tiles.every((j) => w.zone[j] === ZONE.R) && w.zone[at(w, 9, 8)] === ZONE.C && zoneC.ok);
    const road = apply(w, { kind: 'road', tiles: [at(w, 11, 9), at(w, 11, 10), at(w, 11, 11)] });
    check('estate: a road across the footprint lays nothing', !road.ok && tiles.every((j) => !w.road[j]));
    const copy = load(save(w));
    check('estate: save → load keeps the plot, its block and its parts', copy.estate[a] === ESTATE.PLOT && tiles.every((j) => copy.big[j] === w.big[j] && copy.zone[j] === ZONE.R));
    const q = load(save(w));
    const demo = apply(q, { kind: 'bulldoze', x0: 12, y0: 11, x1: 12, y1: 11 });
    check('estate: the bulldozer on any tile takes the whole plot — nine tiles clear, estate and block gone — and undo restores it', demo.ok && tiles.every((j) => q.zone[j] === ZONE.NONE && q.big[j] === 0 && q.estate[j] === 0) && undo(q).ok && stateHash(q) === stateHash(w));
    check('estate: a fresh town saves without an estate array or a wealth field, so nothing older moves', !/"estate":|"wealth":|"victimClass":/.test(save(street())) && /"estate":/.test(save(w)));
  }

  // ---- the sprout ------------------------------------------------------------------------------------------------------------
  {
    const w = quarter(2), a = A(w);
    const rng0 = w.rng.state;
    const lines = estatesTick(w);
    check('sprout: every rung met, the plot SPROUTS — estate MANSION, tier 3 on all nine, capacity MANSION_CAP, one MANSION line logged under its id, and no RNG drawn',
      w.estate[a] === ESTATE.MANSION && footprintOf(w, a).every((j) => w.tier[j] === 3) && capacityOf(w, a) === KNOBS.MANSION_CAP && lines.length === 1 && /^MANSION — a mansion has risen on the estate at \(10,9\)/.test(lines[0])
      && w.events.log.some((e) => e.id === 'mansion' && e.line === lines[0]) && w.rng.state === rng0, `${w.estate[a]} · ${lines[0]}`);
    check('sprout: the card reads MANSION, a part reads PART, and the anchor never grows, decays or merges by the ordinary rule', lotScore(w, a).reason === REASON.MANSION && lotScore(w, a).p === 0 && !lotScore(w, a).grow && !lotScore(w, a).merge && lotScore(w, at(w, 11, 10)).reason === REASON.PART && mergeWindow(w, a) === null);
    const w1 = quarter(1), a1 = A(w1);
    check('sprout: one rung short, nothing rises — the plot reads ESTATE and says what it waits for', estatesTick(w1).length === 0 && w1.estate[a1] === ESTATE.PLOT && lotScore(w1, a1).reason === REASON.ESTATE && /Amphitheater/.test(waitingLine(attainableClass(w1, a1))));
    const dry = quarter(2); apply(dry, { kind: 'bulldoze', x0: 6, y0: 12, x1: 16, y1: 12 }); computeFields(dry); // the street from x 6 to 16 gone: the nearest road is six steps from any tile of the plot
    check('sprout: no road within 3, no mansion — the plot reads NO_ROAD like any lot', !served(dry, A(dry)) && estatesTick(dry).length === 0 && dry.estate[A(dry)] === ESTATE.PLOT && lotScore(dry, A(dry)).reason === REASON.NO_ROAD);
    const wet = quarter(2); wet.flooded[at(wet, 12, 11)] = 3;
    check('sprout: a flooded tile of the plot holds it', estatesTick(wet).length === 0 && wet.estate[A(wet)] === ESTATE.PLOT);
    const t = quarter(2); tick(t);
    check('sprout: through the tick — lotsTick leaves the estate alone and estatesTick raises it in the same month', t.estate[A(t)] === ESTATE.MANSION && t.notices.some((l) => /^MANSION —/.test(l)));
    const chalk = quarter(1); for (let k = 0; k < 24; k++) tick(chalk);
    check('sprout: two years of lotsTick over a plot one rung short move no tile of it', chalk.estate[A(chalk)] === ESTATE.PLOT && footprintOf(chalk, A(chalk)).every((j) => chalk.tier[j] === 0 && chalk.zone[j] === ZONE.R && chalk.big[j] !== 0));
  }

  // ---- who lives there, and what they pay ---------------------------------------------------------------------------------------
  {
    const w = quarter(2), a = A(w); estatesTick(w);
    apply(w, { kind: 'zone', zone: ZONE.R, x0: 5, y0: 10, x1: 6, y1: 10, density: 3 }); w.tier[at(w, 5, 10)] = 1; w.tier[at(w, 6, 10)] = 1; computeFields(w);
    check('mansion: a new arrival may take it and a modest household rehoming may not; an ultrawealthy household rehoming may', bestHome(w, 'fox', 3, false, null, null) === a && bestHome(w, 'fox', 3, false, null, CLASS.MODEST) !== a && bestHome(w, 'fox', 3, false, null, CLASS.ULTRAWEALTHY) === a);
    const rich = arrive(w, a, 'wolf', 4);
    check('mansion: the household that arrives at it is ULTRAWEALTHY by construction, and a second household is refused while it lives there', rich.wealth === CLASS.ULTRAWEALTHY && w.occupants[a] === 4 && bestHome(w, 'cat', 2, false, null, null) !== a && estateName(w, a) === `the ${rich.surname} estate`);
    const plain = arrive(w, at(w, 5, 10), 'rabbit', 2);
    check('class: a household arriving at a modest cottage is MODEST, and one arriving at an affluent address is AFFLUENT', plain.wealth === CLASS.MODEST && (() => { const q = quarter(1); apply(q, { kind: 'zone', zone: ZONE.R, x0: 9, y0: 8, x1: 9, y1: 8, density: 3 }); q.tier[at(q, 9, 8)] = 1; computeFields(q); return ladder(q, at(q, 9, 8)) === CLASS.AFFLUENT && arrive(q, at(q, 9, 8)).wealth === CLASS.AFFLUENT; })());
    computeFields(w);
    const fig = yearlyFigures(w), c = census(w);
    const richBase = rich.members.map((id) => w.byId.get(id)).reduce((s, x) => s + 0.5 + w.lv[x.home] / 100, 0);
    const plainBase = plain.members.map((id) => w.byId.get(id)).reduce((s, x) => s + 0.5 + w.lv[x.home] / 100, 0);
    check('tax: the ultrawealthy pay TAX_CLASS[2] times the R base and the modest once; the Census carries the counts and the shares, and they sum to one',
      fig.taxByClass[2] === Math.round(w.rates.R * richBase * KNOBS.TAX_CLASS[2] * KNOBS.TAX_R_PER_CITIZEN) && fig.taxByClass[0] === Math.round(w.rates.R * plainBase * KNOBS.TAX_R_PER_CITIZEN)
      && fig.incomeYr === Math.round(w.rates.R * (richBase * KNOBS.TAX_CLASS[2] + plainBase) * KNOBS.TAX_R_PER_CITIZEN) && c.byClass.join(',') === '2,0,4' && Math.abs(c.taxShareByClass.reduce((s, x) => s + x, 0) - 1) < 1e-9 && c.taxShareByClass[2] > 0.9 && c.mansions === 1 && c.estates === 0 && c.blocks3 === 0,
      `${fig.taxByClass} · ${c.byClass} · ${c.taxShareByClass.map((x) => x.toFixed(2))}`);
    check('class: classAt reads the richest household at an address, classOfCitizen the citizen\'s own household', classAt(w, at(w, 12, 11)) === CLASS.ULTRAWEALTHY && classAt(w, at(w, 5, 10)) === CLASS.MODEST && classOfCitizen(w, w.byId.get(rich.members[0])) === CLASS.ULTRAWEALTHY);
    // Inheritance: a cub of the estate turns sixteen and takes the family's class to its own new household within twelve road tiles.
    const cub = w.byId.get(rich.members[3]); cub.born = w.tick - 16 * 12;
    const before = w.households.length;
    tick(w);
    const nh = w.hhById.get(cub.household);
    check('class: a cub of the estate who splits off at sixteen carries ULTRAWEALTHY to the new household — inherited, never re-read from the cottage it moves to', w.households.length === before + 1 && nh && nh.id !== rich.id && nh.wealth === CLASS.ULTRAWEALTHY && cub.home !== a, `${nh && nh.wealth} · home ${cub.home}`);
    // Written only when it is not 0: a town of modest households saves no `wealth` key at all (the mutant that always writes it survived
    // the fresh-town check, which had no households to write).
    const modestTown = street(); apply(modestTown, { kind: 'zone', zone: ZONE.R, x0: 5, y0: 10, x1: 6, y1: 10, density: 3 }); modestTown.tier[at(modestTown, 5, 10)] = 1; computeFields(modestTown); arrive(modestTown, at(modestTown, 5, 10), 'rabbit', 3);
    check('class: a town of modest households writes no wealth field at all, and one with a class writes it once per such household', modestTown.households.length === 1 && !/"wealth":/.test(save(modestTown)) && (save(w).match(/"wealth":/g) || []).length === 2, `${(save(w).match(/"wealth":/g) || []).length}`);
    const copy = load(save(w));
    check('class: save → load keeps every household\'s class, and a save with the field stripped reads modest', copy.hhById.get(rich.id).wealth === CLASS.ULTRAWEALTHY && copy.hhById.get(nh.id).wealth === CLASS.ULTRAWEALTHY
      && (() => { const o = JSON.parse(save(w)); for (const h of o.households) delete h.wealth; const old = load(JSON.stringify(o)); return old.households.every((h) => h.wealth === 0); })());
    const s2 = load(save(w));
    for (let k = 0; k < 12; k++) { tick(w); tick(s2); }
    check('class: save → load → twelve months hash-equals with a mansion, an ultrawealthy family and a modest one standing', stateHash(w) === stateHash(s2), `${stateHash(w)} vs ${stateHash(s2)}`);
    check('class: the card carries the household\'s class and the estate\'s name', lotReport(w, a).households.every((h) => h.wealth === CLASS.ULTRAWEALTHY) && lotReport(w, a).estate === ESTATE.MANSION && lotReport(w, a).estateName === `the ${rich.surname} estate` && lotReport(w, at(w, 5, 10)).klass.cls === CLASS.MODEST);
  }

  // ---- the real arrival path: citizensTick decides the class, not a test helper -------------------------------------------------
  {
    const w = quarter(2), a = A(w); estatesTick(w);
    let months = 0;
    while (w.occupants[a] === 0 && months < 60) { tick(w); months++; }
    const hh = w.households.find((h) => !h.gone && h.home === a);
    check('arrival: a household that walks in and takes the empty mansion through citizensTick is ULTRAWEALTHY, and THE ESTATE line is in the log', !!hh && hh.wealth === CLASS.ULTRAWEALTHY && w.occupants[a] === hh.members.length && w.events.log.some((e) => /^THE ESTATE — the .* have moved into the mansion at \(10,9\)\./.test(e.line)), `${months} months · ${hh && hh.wealth} · ${hh && hh.surname}`);
    // … and one that walks into the affluent cottage beside the quarter is AFFLUENT, by the same path.
    const q = quarter(1); apply(q, { kind: 'zone', zone: ZONE.R, x0: 9, y0: 8, x1: 9, y1: 8, density: 3 }); q.tier[at(q, 9, 8)] = 1; computeFields(q);
    let m2 = 0; while (q.occupants[at(q, 9, 8)] === 0 && m2 < 60) { tick(q); m2++; }
    const aff = q.households.find((h) => !h.gone && h.home === at(q, 9, 8));
    check('arrival: a household that walks into an affluent address through citizensTick is AFFLUENT', !!aff && aff.wealth === CLASS.AFFLUENT, `${m2} months · ${aff && aff.wealth}`);
  }

  // ---- fire, rubble, the engine -----------------------------------------------------------------------------------------------
  {
    const w = quarter(2), a = A(w); estatesTick(w); const rich = arrive(w, a, 'fox', 3);
    for (const j of footprintOf(w, a)) w.burning[j] = 1;
    tick(w);
    check('fire: a mansion burnt out off the beat goes to rubble on all nine tiles and back to a PLOT; the family is out, keeps its class, and no tier wraps',
      w.estate[a] === ESTATE.PLOT && footprintOf(w, a).every((j) => w.rubble[j] === KNOBS.RUBBLE_MONTHS && w.tier[j] === 0 && w.big[j] !== 0) && w.occupants[a] === 0 && rich.home !== a && rich.wealth === CLASS.ULTRAWEALTHY && Math.max(...w.tier) <= 3,
      `estate ${w.estate[a]} rubble ${w.rubble[a]} occ ${w.occupants[a]} home ${rich.home}`);
    removeHousehold(w, rich, 'left'); // an empty town keeps its streets quiet (an unemployed camper is 40 crime); the plot is judged on its own rungs
    for (let k = 0; k < KNOBS.RUBBLE_MONTHS + 1; k++) tick(w);
    check('fire: when the rubble clears the plot is a plot again and, its rungs still met, the mansion rises again', w.estate[a] === ESTATE.MANSION && footprintOf(w, a).every((j) => !w.rubble[j] && w.tier[j] === 3), `estate ${w.estate[a]} tier ${w.tier[a]} rubble ${w.rubble[a]} · ${waitingLine(attainableClass(w, a))}`);
    const s = quarter(2), b = A(s); estatesTick(s); const fam = arrive(s, b, 'fox', 3);
    apply(s, { kind: 'fire', tx: 16, ty: 13 }); computeFields(s); // a real station: the tick recomputes cover itself, so hand-set cover would be wiped
    for (const j of footprintOf(s, b)) { s.burning[j] = 1; }
    withKnobs({ FIRE_SAVED: 1 }, () => { tick(s); });
    check('fire: on the beat the engine saves the mansion WHOLE — it has no storey to spare — and the family stays', footprintOf(s, b).every((j) => s.fireCov[j] > 0) && s.estate[b] === ESTATE.MANSION && footprintOf(s, b).every((j) => s.tier[j] === 3 && !s.rubble[j]) && fam.home === b, `cover ${s.fireCov[b]} estate ${s.estate[b]} rubble ${s.rubble[b]} home ${fam.home}`);
    const d = quarter(2), e = A(d); estatesTick(d); arrive(d, e, 'fox', 2);
    const tiles = dissolve(d, at(d, 11, 10));
    check('blocks: dissolve on a mansion tile returns the nine, unbuilds to a PLOT with tier 0 everywhere, keeps the block, and evicts', tiles.length === 9 && d.estate[e] === ESTATE.PLOT && footprintOf(d, e).every((j) => d.tier[j] === 0 && d.big[j] !== 0) && d.occupants[e] === 0);
  }

  // ---- justice: the victim's class, the priority, the case, the step ---------------------------------------------------------
  {
    const w = quarter(2, { justice: true }), a = A(w); estatesTick(w);
    const rich = arrive(w, a, 'wolf', 2); const thiefHH = arrive(w, at(w, 5, 10), 'fox', 2); const thief = w.byId.get(thiefHH.members[0]);
    computeFields(w); const cen = census(w);
    check('justice: the fixture has a served centre, prison, hall and station, and an ultrawealthy household in the mansion', cen.centres === 1 && cen.zoos === 1 && cen.policeStations === 1 && cen.markets === 1 && rich.wealth === CLASS.ULTRAWEALTHY, `${cen.centres} ${cen.zoos} ${cen.policeStations} ${cen.markets}`);
    const fRich = openFile(w, { tile: a, culpritId: thief.id, cause: 'burglary', victimClass: classAt(w, a) });
    const fPlain = openFile(w, { tile: at(w, 5, 10), culpritId: thief.id, cause: 'burglary', victimClass: classAt(w, at(w, 5, 10)) });
    check('justice: a file records the class at the address only when it has one — an estate\'s file carries 2, a cottage\'s carries no field at all (so older saves hash as they did)', fRich.victimClass === CLASS.ULTRAWEALTHY && !('victimClass' in fPlain));
    const pRich = arrestChance(w, cen, fRich, thief), pPlain = arrestChance(w, cen, fPlain, thief);
    check('justice: priority policing is PROBABILITY — the estate\'s file rolls at exactly ARREST_PRIORITY[2] more than the cottage\'s, and with no station both roll at 0', Math.abs(pRich - pPlain - KNOBS.ARREST_PRIORITY[2]) < 1e-12 && pPlain > 0 && arrestChance(w, { policeStations: 0 }, fRich, thief) === 0, `${pRich.toFixed(3)} vs ${pPlain.toFixed(3)}`);
    // … and TIME: with every arrest term at 0 the files only age. The cottage's goes cold at CASE_MONTHS; the estate's lives to CASE_MONTHS_RICH.
    withKnobs({ ARREST_BASE: 0, ARREST_FORCE: 0, ARREST_COVER: 0, CAM_ARREST: 0, ARREST_PRIOR: 0, ARREST_PRIORITY: [0, 0, 0] }, () => {
      const cold = { plain: null, rich: null };
      for (let m = 1; m <= KNOBS.CASE_MONTHS_RICH; m++) {
        w.tick++; const notices = []; filesTick(w, cen, notices);
        if (fPlain.closed && cold.plain === null) cold.plain = m;
        if (fRich.closed && cold.rich === null) cold.rich = m;
      }
      check('justice: the cottage\'s file goes cold after CASE_MONTHS and the estate\'s after CASE_MONTHS_RICH — and the cold line says which', cold.plain === KNOBS.CASE_MONTHS && cold.rich === KNOBS.CASE_MONTHS_RICH && w.events.log.some((e) => e.id === 'cold' && new RegExp(`closed after ${KNOBS.CASE_MONTHS_RICH} months`).test(e.line)), `${cold.plain} · ${cold.rich}`);
    });
    // The sentence, forced: a first theft from an estate goes to the centre; a second to the hall; murder of the ultrawealthy to the hall; a first theft from a cottage to the cells.
    const step = (cause, victimClass, thefts, fixed = false) => {
      const q = quarter(2, { justice: true }), qa = A(q); estatesTick(q); arrive(q, qa, 'wolf', 2); const hh = arrive(q, at(q, 5, 10), 'fox', 2); const c = q.byId.get(hh.members[0]);
      c.thefts = thefts; c.fixed = fixed; computeFields(q);
      const f = openFile(q, { tile: victimClass ? qa : at(q, 5, 10), culpritId: c.id, cause, victimClass });
      const notices = []; const line = arrest(q, f, c, false, notices);
      return { line, c, q };
    };
    const first = step('burglary', CLASS.ULTRAWEALTHY, 0);
    check('sentence: a FIRST theft from an estate goes to the centre (one step up from the cells), and the line says so; the counter still records one theft', /^TAKEN IN —/.test(first.line) && /one step harsher/.test(first.line) && /the .* estate/.test(first.line) && first.c.thefts === 1 && first.c.heldAt >= 0 && first.q.civic[first.c.heldAt] === CIVIC.CENTRE, first.line);
    const second = step('burglary', CLASS.ULTRAWEALTHY, 1);
    check('sentence: a SECOND theft from the ultrawealthy goes to the hall', /^SOLD —/.test(second.line) && /A second theft from the ultrawealthy\./.test(second.line) && second.c.dead, second.line);
    const murder = step('killing', CLASS.ULTRAWEALTHY, 0);
    check('sentence: murder of the ultrawealthy, already the centre, becomes the hall', /^SOLD —/.test(murder.line) && /Murder of the ultrawealthy\./.test(murder.line), murder.line);
    const plainFirst = step('burglary', CLASS.MODEST, 0);
    check('sentence: a first theft from a cottage is the cells, as it always was', /^CELLS —/.test(plainFirst.line) && plainFirst.c.thefts === 1 && !/estate/.test(plainFirst.line), plainFirst.line);
    const plainMurder = step('killing', CLASS.MODEST, 0);
    check('sentence: murder of a modest animal is the centre, as it always was', /^TAKEN IN —/.test(plainMurder.line) && !/harsher/.test(plainMurder.line), plainMurder.line);
    const trespass = step('trespass', CLASS.ULTRAWEALTHY, 0);
    check('sentence: trespass is not theft — a month in the cells whoever it was near', /^CELLS —/.test(trespass.line) && trespass.c.thefts === 0, trespass.line);
    // The lines address a mansion by its family's name; an empty one is "the empty mansion"; a cottage has no name.
    const b = quarter(2, { justice: true }), ba = A(b); estatesTick(b);
    check('justice: an empty mansion is "the empty mansion" and a cottage has no estate name', estateName(b, ba) === 'the empty mansion' && estateName(b, at(b, 5, 10)) === null);
    const owners = arrive(b, ba, 'wolf', 2);
    check('justice: the KILLING, BURGLARY and arrest lines address a mansion by the family\'s name', estateName(b, ba) === `the ${owners.surname} estate` && estateName(b, at(b, 11, 11)) === `the ${owners.surname} estate`);
  }

  // ---- nothing moves without them -----------------------------------------------------------------------------------------------
  {
    const w = createWorld({ seed: 'wealth-neutral' }); for (let k = 0; k < 12; k++) tick(w);
    const json = save(w); const c = census(w);
    check('wealth: a town with no estate and no culture has no class anywhere, saves without estate, wealth or victimClass, and counts nothing', !/"estate"|"wealth"|"victimClass"/.test(json) && c.byClass[1] === 0 && c.byClass[2] === 0 && c.estates === 0 && c.mansions === 0 && c.taxShareByClass[0] === (c.P ? 1 : 0) && w.households.every((h) => h.wealth === 0));
  }
}
