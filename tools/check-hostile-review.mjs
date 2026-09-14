// tools/check-hostile-review.mjs — the counter-assertions of the 2026-09-13 hostile review
// (docs/REVIEW-HOSTILE-2026-09-13.md). Three reviewers read the nine commits a925df5..7b59fbb
// (campaign, farms, healthcare, cemetery, governance); a mutation pass found nine mutants the new
// check files could not see, and the sim pass confirmed seven defects. Every assertion here is
// one of those: it pins the CONSUMER of a rule (justice, budget, fields, ops), never the helper
// that states it — reading `oversightFactor()` proved nothing about the wrongful-arrest roll.
//
// The law of this file: each block names the mutant or defect it turns red. Delete the fix and
// the block fails. `node tools/check-hostile-review.mjs`; wired into `npm run check`.

import assert from "node:assert/strict";
import { createWorld, CIVIC, ZONE, TERRAIN, civicTiles } from "../js/sim/world.js";
import { apply, undo } from "../js/sim/ops.js";
import { tick, refreshLast } from "../js/sim/tick.js";
import { computeFields } from "../js/sim/fields.js";
import { post, yearlyFigures } from "../js/sim/budget.js";
import { save, load, stateHash } from "../js/sim/save.js";
import { census } from "../js/sim/census.js";
import { openFile, filesTick } from "../js/sim/justice.js";
import { ROSTER, resolveChoice } from "../js/sim/events.js";
import { policy, governanceUnlocked, governorOperational, governanceCosts, hasGovernor } from "../js/sim/governance.js";
import { createHousehold, placeHousehold, citizenDefaults } from "../js/sim/citizens.js";
import { computeInfrastructure, progressionTick, sanitationTick, lockedReason, medicalLifespanModifier } from "../js/sim/progression.js";
import { KNOBS } from "../js/sim/rules.js";

const at = (w, x, y) => y * w.w + x;

/** Flat chalk, a river down column 10 (edge-connected), a road down column 14, §20,000. */
function flat(seed = "review", { campaign = false } = {}) {
  const w = createWorld({ seed, campaign });
  w.terrain.fill(TERRAIN.GRASS); w.road.fill(0);
  for (let y = 0; y < w.h; y++) w.terrain[at(w, 10, y)] = TERRAIN.WATER;
  w.roadsDirty = true;
  apply(w, { kind: "road", tiles: Array.from({ length: 60 }, (_, y) => at(w, 14, y)) });
  apply(w, { kind: "toggle", key: "noDisasters", value: true });
  post(w, "cheat", 20000);
  computeFields(w); refreshLast(w);
  return w;
}
/** A 3×3 Governor's Mansion at (15, y) touching the road at column 14. */
const governor = (w, y = 2) => apply(w, { kind: "governor", tx: 15, ty: y });
/** Lightweight villagers for the chapter gates (they never enter citizen AI), all at one home. */
const villagers = (w, n, home = at(w, 16, 30)) => { w.citizens = Array.from({ length: n }, (_, id) => ({ id, home })); };

// ---------------------------------------------------------------------------
// DEFECT 3 (sim review): the Governor's `unlocked` bit was written in the tile loop and never
// snapshotted, so undo/bulldoze left the town governed forever and the undone city no longer
// hashed as the city before the build. Now derived: a standing mansion, or a law on the books.
{
  const w = flat();
  const before = stateHash(w);
  assert.equal(governanceUnlocked(w), false);
  assert.equal(governor(w).ok, true);
  assert.equal(governanceUnlocked(w), true, "a standing mansion governs");
  assert.equal(w.events.governance, undefined, "the build writes no stored bit");
  assert.equal(undo(w).ok, true);
  assert.equal(hasGovernor(w), false);
  assert.equal(governanceUnlocked(w), false, "undo the mansion, undo the governance");
  assert.equal(stateHash(w), before, "the undone city hashes as the city before the build");
  // Rebuild, bulldoze one tile: no mansion, no laws → not governed.
  assert.equal(governor(w).ok, true);
  assert.equal(apply(w, { kind: "bulldoze", x0: 16, y0: 3, x1: 16, y1: 3 }).ok, true);
  assert.equal(hasGovernor(w), false); assert.equal(governanceUnlocked(w), false);
  // Rebuild, pass a law, bulldoze: the law stays on the books, so the town stays governed (the panel says "restore").
  assert.equal(governor(w, 6).ok, true);
  assert.equal(apply(w, { kind: "governance", key: "cleaners", value: true }).ok, true);
  assert.equal(w.events.governance.unlocked, undefined, "a law writes no stored bit either");
  assert.equal(apply(w, { kind: "bulldoze", x0: 16, y0: 7, x1: 16, y1: 7 }).ok, true);
  assert.equal(governanceUnlocked(w), true); assert.equal(governorOperational(w), false); assert.equal(policy(w, "cleaners"), true);
  // save.js used to FORCE an `unlocked` key onto every loaded governance object — a key the straight run lacked.
  refreshLast(w);
  assert.equal(stateHash(load(save(w))), stateHash(w), "a city with a law on the books survives save/load hash-equal");
  // A save of 2026-09-12 carries the legacy key: tolerated, and round-trips.
  const legacy = JSON.parse(save(w)); legacy.events.governance.unlocked = true;
  const L = load(JSON.stringify(legacy));
  assert.equal(policy(L, "cleaners"), true); assert.equal(stateHash(load(save(L))), stateHash(L));
}

// DEFECT 5: a governance op billed through post() with no canSpend — a town in receivership bought scrubbers.
{
  const w = flat(); assert.equal(governor(w).ok, true);
  w.flags.receivership = true;
  const cash = w.cash;
  const r = apply(w, { kind: "governance", key: "scrubbers", value: true });
  assert.equal(r.ok, false); assert.match(r.reason, /receivership/); assert.equal(w.cash, cash); assert.equal(!!w.events.scrubbers, false);
  assert.match(apply(w, { kind: "governance", key: "meatTrade", value: "inspected" }).reason, /receivership/);
  assert.match(apply(w, { kind: "governance", key: "equalTreatment", value: true }).reason, /receivership/, "the county holds the books: no laws either");
  w.flags.receivership = false;
  assert.equal(apply(w, { kind: "governance", key: "scrubbers", value: true }).ok, true); assert.equal(w.cash, cash - 1500);
}

// DEFECT 8: a hand-built save with no `flags` threw in fromPlain where the old spread tolerated it.
{
  const w = flat(); refreshLast(w);
  const o = JSON.parse(save(w)); delete o.flags;
  assert.doesNotThrow(() => load(JSON.stringify(o)), "a save without flags loads");
}

// (Sim finding 7, the per-op infrastructure recompute, is NOT pinned here: computeFields recomputes it on every
// fields pass by design, so the cost is structural and the apply() call was only a duplicate — see the review.)

// DEFECT 4 + MUTANT M16: food aid counted as farm food, so a town of paupers on §12 a head passed a chapter
// with ZERO farms; and the gate `food >= population` could lose its comparison unnoticed because every
// fixture had food exactly equal to population. Now the farms must carry the chapter's TARGET.
{
  const w = flat("gate", { campaign: true });
  villagers(w, 100);
  w.events.governance = { foodAid: true }; // every villager is poor (no class on the lot)
  assert.equal(computeInfrastructure(w).food, 100, "aid feeds a hundred mouths");
  assert.equal(w.infrastructure.farmFood, 0);
  for (let k = 0; k < 4; k++) assert.equal(progressionTick(w).length, 0);
  assert.equal(w.flags.campaign.chapter, 0, "aid passes no chapter"); assert.equal(w.flags.campaign.stable, 0);
  w.events.governance = undefined;
  // M16: three farms (75) hold the gate shut against 100 villagers; the fourth opens it.
  for (const y of [2, 5, 8]) assert.equal(apply(w, { kind: "farm", tx: 12, ty: y }).ok, true);
  assert.equal(computeInfrastructure(w).farmFood, 75);
  for (let k = 0; k < 4; k++) progressionTick(w);
  assert.equal(w.flags.campaign.chapter, 0, "75 food does not feed 100"); assert.equal(w.flags.campaign.stable, 0);
  assert.equal(apply(w, { kind: "farm", tx: 12, ty: 11 }).ok, true);
  // THE KNIFE EDGE (UX review): arrivals stop at the food line, so with four farms the old gate held only while
  // the town sat at EXACTLY 100; a birth to 101 reset the streak. Four farms carry the target of 100 — a birth does not.
  villagers(w, 101);
  progressionTick(w); progressionTick(w);
  assert.equal(w.flags.campaign.stable, 2);
  assert.match(progressionTick(w)[0], /CHAPTER 2/, "four farms and a hundred and one villagers: the chapter turns");
}

// MUTANT M17: the chapter-4 gate's backlog term could be deleted unseen (fixtures never carried a backlog).
{
  const w = flat("crisis", { campaign: true });
  w.flags.campaign.chapter = 3; w.flags.campaign.entered = 0;
  const home = at(w, 18, 30);
  villagers(w, 3000, home);
  for (const y of [17, 20, 23, 26]) assert.equal(apply(w, { kind: "sanitation", tx: 15, ty: y }).ok, true); // 4 × 750 serve 3,000
  for (const y of [29, 31, 33, 35]) assert.equal(apply(w, { kind: "garbage", tx: 15, ty: y }).ok, true);
  for (let y = 2; y < 47; y += 3) assert.equal(apply(w, { kind: "farm", tx: 12, ty: y }).ok, true); // 15 × 200 = 3000
  const s = computeInfrastructure(w);
  assert.equal(s.farmFood, 3000); assert.equal(s.sanitationShare, 1); assert.equal(s.garbageShare, 1);
  w.flags.campaign.waste = 3000 * KNOBS.WASTE_GOAL + 1; w.flags.campaign.sewage = 0;
  for (let k = 0; k < 4; k++) progressionTick(w);
  assert.equal(w.flags.campaign.chapter, 3, "one unit over the backlog goal holds the Metropolis shut");
  w.flags.campaign.waste = 3000 * KNOBS.WASTE_GOAL;
  progressionTick(w); progressionTick(w);
  assert.match(progressionTick(w)[0], /CHAPTER 5/, "at the goal the chapter turns");
}

// MUTANT M22: sanitation's removal scales with the COVERED share; a fixture with everyone covered saw ×1.
{
  const w = flat("share", { campaign: true });
  w.flags.campaign.chapter = 3; w.flags.campaign.entered = -1000; // past the grace
  assert.equal(apply(w, { kind: "sanitation", tx: 15, ty: 17 }).ok, true);
  const near = at(w, 16, 21), far = at(w, 16, 50); // 7-tile reach from the works: 21 is in, 50 is out
  w.citizens = Array.from({ length: 500 }, (_, id) => ({ id, home: id < 250 ? near : far }));
  const s = computeInfrastructure(w);
  assert.equal(s.sanitationShare, 0.5, `half the town is covered (${s.sanitationShare})`);
  sanitationTick(w);
  assert.equal(w.flags.campaign.sewage, 500 - KNOBS.INFRA_CAPACITY * 0.5, "removal = capacity × covered share");
  assert.equal(w.flags.campaign.waste, 500, "no depot: nothing collected");
}

// MUTANT M18: rubble on a facility's footprint did not close it in any fixture (only fire and flood did).
{
  const w = flat("rubble");
  assert.equal(apply(w, { kind: "doctor", tx: 15, ty: 20 }).ok, true);
  assert.equal(apply(w, { kind: "farm", tx: 12, ty: 2 }).ok, true);
  const home = at(w, 16, 24); w.zone[home] = ZONE.R; w.tier[home] = 1;
  assert.equal(computeInfrastructure(w).counts.doctor, 1);
  assert.equal(medicalLifespanModifier(w, home), KNOBS.DOCTOR_CARE);
  w.rubble[at(w, 16, 21)] = 1; // one tile of the 2×2
  const s = computeInfrastructure(w);
  assert.equal(s.counts.doctor, 0, "a rubbled tile closes the office");
  assert.equal(medicalLifespanModifier(w, home), -KNOBS.NO_MEDICAL_PENALTY, "and the town is uncovered again");
  w.rubble[at(w, 12, 3)] = 1;
  assert.equal(computeInfrastructure(w).counts.farm, 0, "a rubbled farm grows nothing");
}

// MUTANT M19: the mansion must keep its road to legislate — `served` in governorOperational was never exercised.
{
  const w = flat("road"); assert.equal(governor(w).ok, true);
  assert.equal(apply(w, { kind: "governance", key: "cleaners", value: true }).ok, true);
  w.road.fill(0); w.roadsDirty = true; computeFields(w);
  assert.equal(governorOperational(w), false, "no road, no operating estate");
  const r = apply(w, { kind: "governance", key: "cleaners", value: false });
  assert.equal(r.ok, false); assert.match(r.reason, /Governor/);
  assert.equal(policy(w, "cleaners"), true, "the law already passed stays");
}

// MUTANT M20: "Building cleaners halve household mess" — the fields.js consumer, not the description.
{
  const w = flat("mess");
  const home = at(w, 16, 30); w.zone[home] = ZONE.R; w.tier[home] = 2;
  const pol = () => { computeFields(w); return w.pol.reduce((a, b) => a + b, 0); };
  const base = pol(); // the road's own emissions, nobody home
  w.citizens = Array.from({ length: 8 }, (_, id) => ({ ...citizenDefaults(), id, species: "pig", born: 0, home }));
  const dirty = pol() - base;
  assert.ok(dirty > 0, "eight pigs make a mess");
  w.events.governance = { cleaners: true };
  const cleaned = pol() - base;
  assert.ok(cleaned < dirty, `cleaners cut the household mess (${dirty} → ${cleaned})`);
  assert.ok(cleaned >= dirty * 0.4 && cleaned <= dirty * 0.6, `by about half (${(cleaned / dirty).toFixed(2)})`);
}

// MUTANT M21 + M24: the budget must CHARGE governance (the old `upkeepYr >= Σ` passed a zero charge), and every
// line item is priced — three of five were read before.
{
  const w = flat("bill"); assert.equal(governor(w).ok, true);
  for (let x = 16; x <= 20; x++) { const i = at(w, x, 30); w.zone[i] = ZONE.R; w.tier[i] = 1; } // five standing buildings
  const hh = createHousehold(w, "rabbit", 3); placeHousehold(w, hh, at(w, 16, 30)); computeFields(w); w.klass[at(w, 16, 30)] = 0;
  const plain = yearlyFigures(w).upkeepYr;
  for (const [key, value] of [["oversight", true], ["cleaners", true], ["foodAid", true], ["community", true]]) assert.equal(apply(w, { kind: "governance", key, value }).ok, true);
  const residents = w.citizens.filter((c) => !c.dead).length;
  assert.deepEqual(governanceCosts(w), { estate: 360, oversight: 300, cleaners: 5 * 6, foodAid: residents * 12, community: 240 + residents * 2 });
  const programmes = 300 + 30 + residents * 12 + 240 + residents * 2;
  const billed = yearlyFigures(w).upkeepYr - plain;
  assert.ok(Math.abs(billed - programmes) <= 1, `the four programmes are billed in full (${billed} vs ${programmes})`);
}

// MUTANT M11b: "halve wrongful-arrest probability" — the roll in filesTick, not the factor that states it.
{
  const rig = (oversight) => {
    const w = flat("oversight");
    assert.equal(apply(w, { kind: "police", tx: 15, ty: 2 }).ok, true);
    assert.equal(apply(w, { kind: "zoo", tx: 15, ty: 6 }).ok, true);
    const home = at(w, 16, 30); w.zone[home] = ZONE.R; w.tier[home] = 1;
    const hh = createHousehold(w, "fox", 2); placeHousehold(w, hh, home); computeFields(w);
    for (const c of w.citizens) c.born = -400; // adults
    if (oversight) w.events.governance = { oversight: true };
    refreshLast(w);
    openFile(w, { tile: home, culpritId: w.citizens[0].id, cause: "theft" });
    w.tick = 1; // a file is worked from the month after it opens
    const rolls = [];
    w.rng.chance = (p) => { rolls.push(p); return rolls.length === 1; }; // the arrest lands, the wrongful roll misses
    filesTick(w, census(w), []);
    return rolls;
  };
  const off = rig(false), on = rig(true);
  assert.ok(off.length >= 2 && on.length >= 2, `both rigs reach the wrongful roll (${off.length}, ${on.length})`);
  assert.equal(off[1], KNOBS.WRONGFUL_P, "no oversight: the knob");
  assert.equal(on[1], KNOBS.WRONGFUL_P * 0.5, "oversight: the knob, halved, in the roll itself");
  assert.equal(off[0], on[0], "the arrest chance is untouched");
}

// DEFECT 2 (sim review): the Butchers' licence and the Scrubbers left the free-play roster — every city past
// 15 I lots re-rolled its events, and the licence needed a §3,000 mansion nobody was told to build. Restored for
// a town with no Governor; a governed town decides in Governance and gets no card.
{
  const w = flat("offers");
  const scrubbers = ROSTER.find((e) => e.id === "scrubbers");
  for (let x = 16; x <= 30; x++) { const i = at(w, x, 30); w.zone[i] = ZONE.I; w.tier[i] = 1; } // 15 built I lots
  assert.equal(scrubbers.gate(w), true, "the firm's offer is armed in an ungoverned town");
  w.events.choice = { id: "scrubbers", cost: 1500 };
  let cash = w.cash;
  assert.match(resolveChoice(w, true), /fitted/); assert.equal(w.cash, cash - 1500); assert.equal(policy(w, "scrubbers"), true);
  assert.equal(scrubbers.gate(w), false, "fitted once, never offered again");
  w.events.choice = { id: "licence", cost: KNOBS.LICENCE_COST }; cash = w.cash;
  assert.match(resolveChoice(w, true), /licensed/); assert.equal(w.cash, cash - KNOBS.LICENCE_COST); assert.equal(policy(w, "meatTrade"), "inspected");
  // The deterministic offer itself: a served tier-2 hall in a town with no Governor puts the card on the desk.
  const h = flat("hall");
  const hall = at(h, 16, 30); h.zone[hall] = ZONE.M; h.tier[hall] = 2; h.roadsDirty = true; computeFields(h);
  tick(h);
  assert.equal(h.events.choice?.id, "licence", "the month the first hall reaches tier 2, the licence is on the desk");
  refreshLast(h);
  assert.equal(load(save(h)).events.choice?.id, "licence", "and it survives a save");
  // Governed: no card, and a card left on the desk is referred to Governance without a charge.
  const g = flat("governed"); assert.equal(governor(g).ok, true);
  for (let x = 16; x <= 30; x++) { const i = at(g, x, 30); g.zone[i] = ZONE.I; g.tier[i] = 1; }
  assert.equal(scrubbers.gate(g), false);
  const gh = at(g, 16, 40); g.zone[gh] = ZONE.M; g.tier[gh] = 2; g.roadsDirty = true; computeFields(g);
  tick(g);
  assert.notEqual(g.events.choice?.id, "licence", "a governed town gets no licence card");
  g.events.choice = { id: "licence", cost: 1 }; cash = g.cash;
  assert.match(resolveChoice(g, true), /Governance/); assert.equal(g.cash, cash);
}

// UX review: Use, trees and walls are land tools, not civic progression — the U key read "Unlocks in Chapter 5".
{
  const w = flat("land", { campaign: true });
  for (const op of [{ kind: "tree", x0: 20, y0: 20, x1: 20, y1: 20 }, { kind: "wall", tiles: [at(w, 22, 22)] }, { kind: "use", x0: 16, y0: 16, x1: 16, y1: 16, value: 1 }]) assert.equal(lockedReason(w, op), "", `${op.kind} is open in Chapter 1`);
  assert.match(lockedReason(w, { kind: "station" }), /Chapter 5/, "rail stays with the Metropolis, as the guide says");
  assert.match(lockedReason(w, { kind: "zone", zone: ZONE.M, density: 3 }), /Chapter 5/);
}

// UX review: a LOCKED palette button said nothing when clicked (the keyboard path flashed the reason).
{
  const { installDom } = await import("./dom-shim.mjs");
  installDom(["palette"]);
  const { createPalette } = await import("../js/palette.js");
  const w = createWorld({ seed: "click", campaign: true });
  const flashes = [], selected = [];
  const app = { world: w, input: { tool: "R", setTool: (id) => selected.push(id), previewTool: () => ({ text: "", refused: false }), refreshCost() {}, state: { pinnedCitizen: null } }, ui: { setCost() {}, modalOpen: () => false, flash: (t) => flashes.push(t) }, doOp() {} };
  const palette = createPalette(app);
  const click = (id) => { const b = palette.buttons.get(id); for (const fn of b.listeners.get("click") || []) fn({}); };
  click("police");
  assert.equal(selected.length, 0, "a locked tool is not selected");
  assert.match(flashes.at(-1) || "", /Chapter 2/, "the click says which chapter opens it");
  click("farm");
  assert.equal(selected.at(-1), "farm", "an open tool selects");
}

console.log("Hostile-review checks passed: governor undo/bulldoze, receivership, flags-less save, food-aid and farm gates, the backlog term, covered-share removal, rubble, the estate's road, cleaners, the bill, the wrongful roll, the free-play offers, land tools, the locked click.");
