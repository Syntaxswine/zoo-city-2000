// check-knowledge-culture.mjs — the four public buildings (SPEC §9e; docs/PROPOSAL-KNOWLEDGE-CULTURE-2026-09-05.md,
// its review and the owner's ruling). Run by check.mjs; each check names the rule it pins.
import { createWorld, CIVIC, ZONE, TERRAIN, civicAnchorOf, civicSideOf, siteTiles, jobsOf, capacityOf, idx } from '../js/sim/world.js';
import { apply, undo } from '../js/sim/ops.js';
import { save, load, stateHash } from '../js/sim/save.js';
import { computeFields, computeKnowledgeCulture, campusBudget, served } from '../js/sim/fields.js';
import { floodBudget, forEachWithinAll } from '../js/sim/reach.js';
import { census } from '../js/sim/census.js';
import { capacityLaw } from '../js/sim/demand.js';
import { yearlyFigures } from '../js/sim/budget.js';
import { createHousehold, placeHousehold, moodTerms } from '../js/sim/citizens.js';
import { needOf } from '../js/sim/needs.js';
import { ACT } from '../js/sim/voice.js';
import { tick } from '../js/sim/tick.js';
import { KNOBS } from '../js/sim/rules.js';

/** Flat grass, nothing on it, rich. */
function empty(w = 40, h = 40, seed = 'knowledge-culture') {
  const world = createWorld({ seed, w, h });
  for (const k of ['terrain', 'road', 'zone', 'civic', 'civicSize', 'wall', 'rail', 'tier', 'big', 'rubble', 'burning', 'flooded']) world[k].fill(0);
  world.cash = 900000; world.roadsDirty = true; world.wallsDirty = true;
  return world;
}
const at = (w, x, y) => idx(w, x, y);
const road = (w, x, y) => apply(w, { kind: 'road', tiles: [at(w, x, y)] });
const count = (arr, pred = (v) => v > 0) => { let n = 0; for (let i = 0; i < arr.length; i++) if (pred(arr[i])) n++; return n; };
/** A tier-3 R lot at (x, y) with a household of `size` `species` on it; returns the household. */
function family(w, x, y, species = 'fox', size = 2) {
  const i = at(w, x, y); w.zone[i] = ZONE.R; w.tier[i] = 3; w.maxTier[i] = 3;
  const hh = createHousehold(w, species, size); placeHousehold(w, hh, i);
  return hh;
}
const first = (w, hh) => w.byId.get(hh.members[0]);

export function checkKnowledgeCulture(check) {
  const KINDS = [['library', CIVIC.LIBRARY, 2, KNOBS.LIBRARY_JOBS, KNOBS.UPKEEP_LIBRARY], ['university', CIVIC.UNIVERSITY, 3, KNOBS.UNIVERSITY_JOBS, KNOBS.UPKEEP_UNIVERSITY], ['gallery', CIVIC.GALLERY, 2, KNOBS.GALLERY_JOBS, KNOBS.UPKEEP_GALLERY], ['amphitheater', CIVIC.AMPHITHEATER, 3, KNOBS.AMPHITHEATER_JOBS, KNOBS.UPKEEP_AMPHITHEATER]];

  // ---- placement, ownership, jobs, save, demolition, upkeep — per kind --------------------------------
  for (const [kind, id, side, jobs, upkeep] of KINDS) {
    const w = empty(); const a = at(w, 10, 10);
    const h0 = stateHash(w);
    check(`${kind}: refused without a road touching, atomically`, !apply(w, { kind, tx: 10, ty: 10 }).ok && stateHash(w) === h0);
    road(w, 10 + side, 10 + side - 1); // touches the far corner's east side only
    const r = apply(w, { kind, tx: 10, ty: 10 });
    const tiles = siteTiles(w, a);
    check(`${kind}: a ${side}×${side} — every tile owned by the anchor, side ${side}, one employer of ${jobs} jobs, served`,
      r.ok && r.cost === KNOBS.COST[kind] && tiles.length === side * side && w.civic[a] === id && w.civicSize[a] === side && served(w, a)
      && tiles.every((i) => civicAnchorOf(w, i) === a && civicSideOf(w, i) === side)
      && tiles.filter((i) => jobsOf(w, i) > 0).length === 1 && jobsOf(w, a) === jobs && capacityOf(w, a) === jobs,
      `ok ${r.ok} cost ${r.cost} tiles ${tiles.length} civic ${w.civic[a]} size ${w.civicSize[a]} jobs ${jobsOf(w, a)}/${capacityOf(w, a)}`);
    const built = stateHash(w);
    const water = (() => { const q = empty(); road(q, 29, 29); q.terrain[at(q, 30, 30)] = TERRAIN.WATER; return !apply(q, { kind, tx: 30, ty: 30 }).ok; })();
    check(`${kind}: overlap, a map edge and water refuse the whole purchase`,
      !apply(w, { kind, tx: 10 + side - 1, ty: 10 }).ok && stateHash(w) === built && !apply(w, { kind, tx: w.w - side + 1, ty: 5 }).ok && water);
    const copy = load(save(w));
    check(`${kind}: save → load keeps the anchor, the side and every part`, tiles.every((i) => civicAnchorOf(copy, i) === a && copy.civic[i] === w.civic[i] && copy.civicSize[i] === w.civicSize[i]));
    const demo = apply(w, { kind: 'bulldoze', x0: 10 + side - 1, y0: 10 + side - 1, x1: 10 + side - 1, y1: 10 + side - 1 });
    check(`${kind}: any corner razes the whole building and undo restores it`,
      demo.ok && tiles.every((i) => w.civic[i] === 0 && w.civicSize[i] === 0) && undo(w).ok && stateHash(w) === built);
    const bare = yearlyFigures(empty()).upkeepYr;
    const withRoad = yearlyFigures(w).upkeepYr - bare;
    const q = empty(); road(q, 10 + side, 10); apply(q, { kind, tx: 10, ty: 10 }); apply(q, { kind: 'bulldoze', x0: 10 + side, y0: 10, x1: 10 + side, y1: 10 });
    const noRoad = yearlyFigures(q).upkeepYr - bare;
    check(`${kind}: the year's upkeep is exactly its line, billed with or without a road`, withRoad === upkeep + KNOBS.UPKEEP_ROAD && noRoad === upkeep && !served(q, at(q, 10, 10)), `with road Δ${withRoad} vs ${upkeep + KNOBS.UPKEEP_ROAD} · without Δ${noRoad}`);
  }

  // ---- the small reach: five from every tile, max not sum, off when unserved ------------------------
  {
    const w = empty(); road(w, 12, 10); apply(w, { kind: 'library', tx: 10, ty: 10 });
    const R = KNOBS.KNOW_RADIUS, span = 2 + 2 * R;
    check('library: the field is painted AT THE OP — a paused city shows the catchment before any tick', count(w.knowledge) === span * span, `${count(w.knowledge)} before computeFields`);
    computeFields(w);
    check('library: reaches KNOW_RADIUS from every tile of the 2×2 — a 12×12 of 144 tiles on open ground, class 1',
      count(w.knowledge) === span * span && count(w.knowledge, (v) => v === 1) === span * span
      && w.knowledge[at(w, 10 - R, 10 - R)] === 1 && w.knowledge[at(w, 11 + R, 11 + R)] === 1 && w.knowledge[at(w, 11 + R + 1, 11 + R + 1)] === 0,
      `${count(w.knowledge)} tiles`);
    road(w, 20, 10); apply(w, { kind: 'library', tx: 18, ty: 10 }); computeFields(w);
    check('library: two overlapping libraries are still class 1 everywhere — the maximum, never a sum', count(w.knowledge, (v) => v > 1) === 0 && count(w.knowledge) > span * span);
    check('library: culture and knowledge are independent fields — a library paints no culture', count(w.culture) === 0);
    apply(w, { kind: 'bulldoze', x0: 12, y0: 10, x1: 12, y1: 10 }); apply(w, { kind: 'bulldoze', x0: 20, y0: 10, x1: 20, y1: 10 });
    check('library: a building that loses its road stops serving AT THE OP, before any tick', count(w.knowledge) === 0 && !served(w, at(w, 10, 10)));
    undo(w);
    check('library: undo of the road brings the service back at the op', count(w.knowledge) > 0);
    const g = empty(); road(g, 12, 10); apply(g, { kind: 'gallery', tx: 10, ty: 10 }); computeFields(g);
    check('gallery: the same five-tile reach, as culture class 1', count(g.culture, (v) => v === 1) === span * span && count(g.knowledge) === 0);
    g.flooded[at(g, 11, 11)] = 4; computeKnowledgeCulture(g);
    check('gallery: a flooded tile of the building suspends the service', count(g.culture) === 0);
  }

  // ---- the budgets: an AREA of the map, exact on square, rectangular and odd maps -----------------------
  for (const [w0, h0] of [[40, 40], [64, 64], [80, 48], [33, 21]]) {
    const w = empty(w0, h0); road(w, 13, 10);
    apply(w, { kind: 'university', tx: 10, ty: 10 }); computeFields(w);
    const N = w0 * h0, uni = Math.ceil(N * KNOBS.KNOW_UNI_SHARE), amph = Math.ceil(N * KNOBS.CULT_AMPH_SHARE);
    check(`university on ${w0}×${h0}: exactly ceil(N/2) = ${uni} tiles of class 2, near a corner or not`, count(w.knowledge, (v) => v === 2) === uni && count(w.knowledge) === uni && campusBudget(w, CIVIC.UNIVERSITY) === uni, `${count(w.knowledge)}`);
    const a = empty(w0, h0); road(a, 13, 10); apply(a, { kind: 'amphitheater', tx: 10, ty: 10 }); computeFields(a);
    check(`amphitheater on ${w0}×${h0}: exactly ceil(N/8) = ${amph} tiles of class 2`, count(a.culture, (v) => v === 2) === amph && campusBudget(a, CIVIC.AMPHITHEATER) === amph, `${count(a.culture)}`);
  }
  {
    // Determinism and the tie rule: the last layer is taken in ascending tile index.
    const w = empty(64, 64); road(w, 33, 30); apply(w, { kind: 'amphitheater', tx: 30, ty: 30 }); computeFields(w);
    const once = Array.from(w.culture); computeKnowledgeCulture(w);
    const dist = new Map(); forEachWithinAll(w, siteTiles(w, at(w, 30, 30)), 64, (j, d) => dist.set(j, d));
    let dMax = -1; for (let i = 0; i < w.culture.length; i++) if (w.culture[i]) dMax = Math.max(dMax, dist.get(i));
    const lastLayer = [...dist].filter(([, d]) => d === dMax).map(([j]) => j).sort((x, y) => x - y);
    const takenLast = lastLayer.filter((j) => w.culture[j]);
    check('amphitheater: the catchment is identical on a second pass, and the final layer is its smallest tile indices',
      once.every((v, i) => v === w.culture[i]) && takenLast.length > 0 && takenLast.length < lastLayer.length && lastLayer.slice(0, takenLast.length).every((j) => w.culture[j]),
      `final layer d=${dMax}: ${takenLast.length} of ${lastLayer.length}`);
    road(w, 37, 30); apply(w, { kind: 'amphitheater', tx: 34, ty: 30 }); computeFields(w);
    const both = count(w.culture);
    check('amphitheater: two overlapping campuses paint the union, never the sum, and never a class above 2', both > Math.ceil(64 * 64 / 8) && both < 2 * Math.ceil(64 * 64 / 8) && count(w.culture, (v) => v > 2) === 0, `${both}`);
    // A sealed quarter: a wall ring closes the flood and the budget goes unfilled.
    const s = empty(64, 64); road(s, 13, 10); apply(s, { kind: 'university', tx: 10, ty: 10 });
    const ring = []; for (let x = 4; x <= 20; x++) ring.push(at(s, x, 4), at(s, x, 20)); for (let y = 5; y <= 19; y++) ring.push(at(s, 4, y), at(s, 20, y));
    const rw = apply(s, { kind: 'wall', tiles: ring }); computeFields(s);
    check('university: a sealed quarter leaves the budget short — the flood stops at the walls and counts none of them',
      rw.ok && count(s.knowledge) === 15 * 15 && count(s.knowledge) < campusBudget(s, CIVIC.UNIVERSITY) && ring.every((i) => !s.knowledge[i]), `${count(s.knowledge)} of ${campusBudget(s, CIVIC.UNIVERSITY)}`);
    // The budget flood and the radius flood agree where both apply.
    const o = empty(64, 64); const foot = [at(o, 30, 30), at(o, 31, 30), at(o, 30, 31), at(o, 31, 31)];
    const byRadius = new Set(); forEachWithinAll(o, foot, 5, (j) => byRadius.add(j));
    const byBudget = new Set(); floodBudget(o, foot, byRadius.size, (j) => byBudget.add(j));
    check('reach: a budget equal to a radius flood\'s tile count reproduces that flood exactly (one BFS, two stopping rules)', byBudget.size === byRadius.size && [...byRadius].every((j) => byBudget.has(j)));
  }

  // ---- the consumers: K and the cap, mood, land value, the wish ---------------------------------------
  {
    const w = empty(64, 64);
    road(w, 12, 10); apply(w, { kind: 'library', tx: 10, ty: 10 });
    for (const [x, y] of [[8, 8], [9, 8], [13, 12]]) family(w, x, y, 'rabbit', 4);
    for (const [x, y] of [[40, 40], [41, 40], [42, 40]]) family(w, x, y, 'rabbit', 4);
    computeFields(w);
    const c1 = census(w);
    const base = { ...c1, K: 0 };
    check('knowledge: K is the mean of knowledge/100 over housed animals — half of them under a Library is 0.25, and the cap rises by exactly CAP_KNOWLEDGE·K·(1 + 0.5H)',
      Math.abs(c1.K - 0.25) < 1e-9 && c1.knowledgeN === 24 && Math.abs(capacityLaw(w, c1) - capacityLaw(w, base) - KNOBS.CAP_KNOWLEDGE * 0.25 * (1 + KNOBS.CAP_H_GAIN * c1.H)) < 1e-6,
      `K ${c1.K} n ${c1.knowledgeN}`);
    road(w, 23, 20); apply(w, { kind: 'university', tx: 20, ty: 20 }); computeFields(w);
    const c2 = census(w);
    check('knowledge: a University over every home is K = 1 (100 each), and a Library beneath it adds nothing', Math.abs(c2.K - 1) < 1e-9 && c2.libraries === 1 && c2.universities === 1, `K ${c2.K}`);
    // Culture: mood and land value, max not sum, none without.
    const g = empty(64, 64); road(g, 12, 10);
    const near = first(g, family(g, 8, 8, 'wolf', 2)), far = first(g, family(g, 50, 50, 'wolf', 2));
    computeFields(g); const lv0 = g.lv[at(g, 8, 8)], lvFar0 = g.lv[at(g, 50, 50)];
    apply(g, { kind: 'gallery', tx: 10, ty: 10 }); computeFields(g);
    const t1 = moodTerms(g, near).find((t) => t.code === 'CULTURE'), tFar = moodTerms(g, far).find((t) => t.code === 'CULTURE');
    check('culture: a Gallery is +CULTURE_MOOD[1] mood and +LV_CULTURE[1] land value at a home in reach, and nothing at one out of reach',
      !!t1 && t1.value === KNOBS.CULTURE_MOOD[1] && !tFar && g.lv[at(g, 8, 8)] - lv0 === KNOBS.LV_CULTURE[1] && g.lv[at(g, 50, 50)] === lvFar0,
      `mood ${t1 && t1.value} Δlv ${g.lv[at(g, 8, 8)] - lv0} far Δlv ${g.lv[at(g, 50, 50)] - lvFar0}`);
    // An Amphitheater's 512 tiles on a 64×64 reach Chebyshev 10 from its footprint (cumulative (2d+3)² passes 512 at d = 10),
    // so it stands four tiles from the near home and thirty-six from the far one.
    road(g, 15, 12); apply(g, { kind: 'amphitheater', tx: 12, ty: 12 }); computeFields(g);
    const t2 = moodTerms(g, near).find((t) => t.code === 'CULTURE');
    check('culture: an Amphitheater over a Gallery\'s home is +CULTURE_MOOD[2], the maximum and never the sum', !!t2 && t2.value === KNOBS.CULTURE_MOOD[2] && g.lv[at(g, 8, 8)] - lv0 === KNOBS.LV_CULTURE[2], `mood ${t2 && t2.value} Δlv ${g.lv[at(g, 8, 8)] - lv0}`);
    const c3 = census(g);
    check('culture: the census counts who is under culture and the mean bonus', c3.cultureServed === 2 && Math.abs(c3.cultureShare - 0.5) < 1e-9 && Math.abs(c3.cultureMean - KNOBS.CULTURE_MOOD[2] / 2) < 1e-9, `${c3.cultureServed} · ${c3.cultureShare} · ${c3.cultureMean}`);
    // The wish: at the floor, only when nothing else is wrong, and silent under any culture. A rabbit CHILD (no
    // job to want, no home preference) with a park in reach, in a town whose valves ask for nothing.
    const n = empty(64, 64); road(n, 12, 10); road(n, 8, 7); apply(n, { kind: 'park', tx: 9, ty: 9 }); // the road at (8,7) serves the home; the one at (12,10) the gallery
    const hh = family(n, 8, 8, 'rabbit', 3); const child = n.byId.get(hh.members[2]);
    tick(n); n.last.demand.r = { R: 0, C: 0, I: 0, M: 0 };
    const before = needOf(n, child);
    apply(n, { kind: 'gallery', tx: 10, ty: 10 }); tick(n); n.last.demand.r = { R: 0, C: 0, I: 0, M: 0 };
    const after = needOf(n, child);
    check('culture wish: "art or music near home" speaks at NEED_MIN when nothing else hurts, and falls silent under a Gallery',
      before.code === 'NO_CULTURE' && before.act === ACT.NO_CULTURE && after.code !== 'NO_CULTURE', `${before.code} → ${after.code}`);
  }

  // ---- nothing moves without them ---------------------------------------------------------------------
  {
    const w = createWorld({ seed: 'kc-neutral' }); computeFields(w);
    const c = census(w);
    check('knowledge and culture: a town with none of the four has zero fields, K = 0, and the capacity law of before', count(w.knowledge) === 0 && count(w.culture) === 0 && c.K === 0 && c.cultureServed === 0
      && capacityLaw(w, c) === (KNOBS.CAP_BASE + KNOBS.CAP_PARK * c.parks + KNOBS.CAP_LARGE_PARK * c.largeParks + w.festivalBonus - KNOBS.CAM_CAP * (c.watchedShare || 0)) * (1 + KNOBS.CAP_H_GAIN * c.H));
    const s = empty(); road(s, 12, 10); apply(s, { kind: 'library', tx: 10, ty: 10 }); road(s, 23, 20); apply(s, { kind: 'amphitheater', tx: 20, ty: 20 });
    family(s, 8, 8, 'fox', 3);
    for (let t = 0; t < 12; t++) tick(s);
    const copy = load(save(s));
    for (let t = 0; t < 12; t++) { tick(s); tick(copy); }
    check('knowledge and culture: save → load → twelve months hash-equals with a Library and an Amphitheater standing', stateHash(s) === stateHash(copy), `${stateHash(s)} vs ${stateHash(copy)}`);
  }
}
