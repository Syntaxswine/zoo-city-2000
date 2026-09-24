#!/usr/bin/env node
// tools/check-animals.mjs — the gate on the animals (Tier 4). SPEC §12.3.
// docs/PROPOSAL-SPRITE-UPGRADE-2026-09-22.md, T4.0; tools/zooprobe.mjs reads it.
//
// The claims registered BEFORE the work, run here:
//
//   THE COATS    fourteen coats, no two the same · none goes FLAT in any look
//                or age (the lit rung and the shaded rung stay two keys, or
//                the light is gone from the body) · none as LOST on its
//                ground as the olive tortoise was · no ONE ANIMAL (figures
//                closer than one animal mid-stride AND coats closer than one
//                animal shaded) · no two CLOSE figures on one ramp · not one
//                key added to the palette
//   THE CONTROL  the coats the game wore before T4.0, spelt out below and read
//                in the same run by the same instrument — every bar above must
//                REFUSE them, exactly as measured, or passing proves nothing
//   THE PANEL    the census paints each species in its own coat
//
// The 2× pass is not here: whether each species' twin reworks its FUR is
// tools/check-closeups.mjs's, beside every other claim about the twins.
//
// NOT CLAIMED: "one animal in two coats" — figures under the stride floor
// with coats apart. That is a fault of FORM, which a coat cannot fix; it is
// T4.2's, and this gate reports it without refusing it.

import { installDom } from "./dom-shim.mjs";

installDom();

const { COATS, coatMap, coatMapOf, SPECIES_IDS } = await import("../js/art/citizens.js");
const { KEYS, RAMPS, colourOf } = await import("../js/art/palette.js");
const { zooReadings, lost, GROUND_KEYS, LOST_CONTROL } = await import("./zooprobe.mjs");
const { SPECIES_BY_ID } = await import("../js/sim/species.js");
const { createWorld } = await import("../js/sim/world.js");
await import("../js/sim/ops.js");
const { refreshLast } = await import("../js/sim/tick.js");
const { stubApp } = await import("./dom-shim.mjs");
const { createUI } = await import("../js/ui.js");

let checks = 0;
const check = (name, ok, detail = "") => {
  checks++;
  if (!ok) { console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`); process.exit(1); }
};
const pairName = (p) => `${p.a}/${p.b}`;
const sameSet = (a, b) => a.length === b.length && [...a].sort().join() === [...b].sort().join();

// ---- spelt out, not imported (the standing brief, trap 3) ------------------------
const FOURTEEN = ["rabbit", "mouse", "fox", "beaver", "owl", "bear", "tortoise", "raccoon", "pig", "cow", "wolf", "cat", "hawk", "skunk"];
// THE CONTROL: the coats before T4.0 — the sim roster's `fur`/`furShift`,
// with the kit's one override (the tortoise's olive, painted warm tan).
const BEFORE = {
  rabbit: ["furWarm", 1], mouse: ["furCool", 1], fox: ["furWarm", 0], beaver: ["furWarm", -1],
  owl: ["furCool", 0], bear: ["furWarm", -1], tortoise: ["furWarm", 0], raccoon: ["furCool", -1],
  pig: ["furWarm", 1], cow: ["furCool", 1], wolf: ["furCool", -1], cat: ["furWarm", 0],
  hawk: ["earth", 0], skunk: ["furCool", -1],
};
// …and what the instrument read off them the day T4.0 was measured.
const BEFORE_READS = {
  distinct: 7,
  flat: ["beaver", "bear", "raccoon", "wolf", "skunk"],
  lost: ["owl", "raccoon", "wolf", "skunk"],
  oneAnimal: ["beaver/bear"],
  closeOnOneRamp: 9,
};
const GROUND = { grass: ["n", "o", "p"], road: ["3", "2"] };
const PALETTE_KEYS = 74;

check("the kit draws exactly the fourteen species, and has a coat for each", sameSet(SPECIES_IDS, FOURTEEN) && sameSet(Object.keys(COATS), FOURTEEN), `${SPECIES_IDS.length} drawn · ${Object.keys(COATS).length} coats`);
check("the instrument judges on the ground spelt out here", JSON.stringify(GROUND_KEYS) === JSON.stringify(GROUND), JSON.stringify(GROUND_KEYS));
// The control's premise is a claim (trap 13): the tortoise's roster row IS
// olive, and the sim roster still carries the pre-T4 coats the control names.
check("the control is what the game wore: the sim roster's fur columns, the tortoise's olive overridden",
  FOURTEEN.every((sp) => sp === "tortoise" ? SPECIES_BY_ID[sp].fur === "olive" && JSON.stringify(LOST_CONTROL) === JSON.stringify(["olive", 0])
    : SPECIES_BY_ID[sp].fur === BEFORE[sp][0] && SPECIES_BY_ID[sp].furShift === BEFORE[sp][1]));
// Only that the table is well-formed. It does NOT refuse a shift below 0 —
// that is the FLAT check's to refuse, by what the coat does to the light; a
// bound here would kill every such mutant first and the flat check would
// never be seen to fire (the standing brief, trap 6).
check("every coat is a real ramp and a shift that lands inside it", FOURTEEN.every((sp) => {
  const [ramp, shift] = COATS[sp];
  return RAMPS[ramp] && Number.isInteger(shift) && Math.abs(shift) < RAMPS[ramp].keys.length;
}), FOURTEEN.filter((sp) => !RAMPS[COATS[sp][0]]).join(", "));

// ---- the coats --------------------------------------------------------------------
const now = zooReadings();
const was = zooReadings({ coats: BEFORE });
const lostNow = FOURTEEN.filter((sp) => now.species[sp].lost.distance <= now.lostControl);
const lostWas = FOURTEEN.filter((sp) => was.species[sp].lost.distance <= was.lostControl);

check("the olive control reads as the tortoise's lawn did: its lit rung within 10 of a grass key", was.lostControl > 9 && was.lostControl < 10 && lost(coatMapOf(LOST_CONTROL)).nearest.startsWith("grass"), `${was.lostControl.toFixed(1)}`);
check("CONTROL: the coats before T4.0 read as measured — 7 distinct, 5 flat, 4 lost, the beaver and the bear one animal, 9 close pairs on one ramp",
  was.distinct === BEFORE_READS.distinct && sameSet(was.flat, BEFORE_READS.flat) && sameSet(lostWas, BEFORE_READS.lost)
    && sameSet(was.oneAnimal.map(pairName), BEFORE_READS.oneAnimal) && was.closeOnOneRamp.length === BEFORE_READS.closeOnOneRamp,
  `distinct ${was.distinct} · flat ${was.flat.join(",")} · lost ${lostWas.join(",")} · one ${was.oneAnimal.map(pairName).join(",")} · close-one-ramp ${was.closeOnOneRamp.length}`);

check("fourteen coats, no two the same", now.distinct === 14, `${now.distinct}: shared ${now.shared.map((v) => v.join("+")).join(", ")}`);
check("no coat goes flat in any look or age — the lit rung and the shaded rung are two keys", now.flat.length === 0,
  now.flat.map((sp) => `${sp} (${now.species[sp].flat.join(", ")})`).join("; "));
// Every look and age, both grounds: the lit rung stands further from every
// key its ground is drawn in than the olive tortoise's did.
check("no coat is as lost on its ground as the olive tortoise was, in any look or age", lostNow.length === 0,
  lostNow.map((sp) => `${sp} ${now.species[sp].lost.distance.toFixed(1)} (${now.species[sp].lost.look}, ${now.species[sp].lost.nearest})`).join("; "));
check("no ONE ANIMAL — no figures under the stride floor wearing coats under the shade floor", now.oneAnimal.length === 0, now.oneAnimal.map(pairName).join(", "));
check("no two close figures on one ramp — a shaded one would wear the other's coat", now.closeOnOneRamp.length === 0, now.closeOnOneRamp.map(pairName).join(", "));
check("not one key added to the palette", KEYS.length === PALETTE_KEYS && !Object.keys(RAMPS).some((r) => /dark/i.test(r)), `${KEYS.length} keys`);
// FORM does not depend on the coat, so the two readings must agree on every
// pair's FORM to the last digit — the proof that the control read the SAME
// figures and only the coats differed.
check("the control and the live table read the same figures: every pair's FORM identical",
  now.pairs.every((p, i) => p.form === was.pairs[i].form && p.formFloor === was.pairs[i].formFloor));

// ---- the panel ------------------------------------------------------------------
// The census histogram, through the REAL createUI and the dom shim: each
// species' bar in the colour its coat lays on the shaded body rung. It used to
// be three CSS classes named after ramps — fourteen coats in three colours,
// and the hawk's `earth` had no class at all (the panel's accent green).
const world = createWorld({ seed: "check-animals" });
refreshLast(world);
const ui = createUI(stubApp(world));
const censusTab = document.getElementById("tabs").children.find((b) => b.dataset && b.dataset.tab === "census");
censusTab.dispatch("click");
const rows = document.getElementById("tabBody").querySelectorAll(".hrow");
const hex = (k) => "#" + colourOf(k).map((v) => v.toString(16).padStart(2, "0")).join("");
const bars = rows.map((r) => ({ label: r.children[0]._text, fill: r.querySelector(".hfill") }));
const wrong = FOURTEEN.filter((sp) => {
  const b = bars.find((x) => x.label === sp);
  return !b || !b.fill || String(b.fill.style.background).toLowerCase() !== hex(coatMap(sp, false, 0).x);
});
check("the census paints each species' bar in its own coat — fourteen bars, fourteen colours", bars.length === 14 && wrong.length === 0 && new Set(bars.map((b) => b.fill.style.background)).size === 14,
  `${bars.length} bars · wrong ${wrong.join(", ")}`);
check("…and no bar is coloured by a ramp's CSS class", bars.every((b) => !["furWarm", "furCool", "olive", "earth"].some((c) => b.fill.classList.contains(c))));
void ui;

const two = now.twoCoats.map(pairName);
console.log(`Animal checks passed: ${checks} checks · 14 coats (were ${was.distinct}) · flat ${now.flat.length} (were ${was.flat.length}) · lost ${lostNow.length} (were ${lostWas.length}; the olive control ${now.lostControl.toFixed(1)}) · one animal ${now.oneAnimal.length} (was ${was.oneAnimal.length}) · close pairs on one ramp ${now.closeOnOneRamp.length} (were ${was.closeOnOneRamp.length}) · one animal in two coats ${two.length} (${two.join(", ") || "none"}) — FORM, T4.2's`);
