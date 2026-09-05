// voice.js — actionable needs in the animals' own short words. PLAN §4-A.
// Pure and DOM-free: a citizen keeps the same line for the same need because
// the choice is a hash of stable citizen id + need code, never sim RNG.

import { hash01, seedFromString } from "./rng.js";
import { DIET_OF } from "./species.js";

export const ACT = Object.freeze({
  CONTENT: "no action needed",
  SHOPS: "zone C near homes",
  ROOMS: "zone R near a road",
  WORKS: "zone I near a road",
  HOOKS: "zone M on the road network",
  NO_JOB: "zone C or I, or add rail",
  SMOKE: "plant trees, a park, or a wall",
  NO_PARK: "build a park within 4 tiles",
  COMMUTE: "add rail, roads, or nearer jobs",
  FLIGHT: "use-zone or separate with a wall",
  DREAD: "wall off or license the meat hall",
  CRIME: "build a police station",
  VAN: "use a pacification centre",
  WATER: "zone homes within 6 of water",
  TREES: "plant trees within 3 tiles",
  HIGH: "zone High and let it grow",
  LOW: "zone Low-density homes",
  PASTURE: "zone Low beside a park",
  LV: "raise land value with parks or trees",
  CLEAN: "leave this street less tidy",
  NO_ROAD: "lay a road within 3 tiles",
  CAPPED: "build a park or Large Park",
  NO_DEMAND: "lower taxes or improve the lot",
  TAX: "lower this zone's tax rate",
});

// Overrides may be a species id or diet. The default list is mandatory; an
// override only changes voice, never which need the rules selected.
export const LINES = Object.freeze({
  CONTENT: { default: ["nothing to want today", "we're all right today"] },
  SHOPS: { default: ["wish there were shops nearby", "more shops would be nice"] },
  ROOMS: { default: ["my cousins need rooms", "there's no room for cousins"] },
  WORKS: { default: ["a new works means wages", "they say works pays well"] },
  HOOKS: { carn: ["the hall's hooks are bare", "the meat hall is empty"], default: ["the hooks are empty again", "the hall needs meat"] },
  NO_JOB: { default: ["third month. nobody's hiring", "still looking for work"] },
  SMOKE: { default: ["the works gets in my fur", "the smoke stings today"] },
  NO_PARK: { default: ["nowhere to sit in the sun", "wish we had a park nearby"] },
  COMMUTE: { tortoise: ["the road takes all day", "work is a long crawl"], default: ["an hour each way", "work is much too far"] },
  FLIGHT: { default: ["hunters moved in next door", "too many hunters next door"] },
  DREAD: { herb: ["the hall smells in here", "that hall reaches our kitchen"], default: ["the meat hall is too close", "the hall hangs over us"] },
  CRIME: { default: ["someone tried the door again", "this street needs a beat"] },
  VAN: { carn: ["the van came down our street", "that centre van is back"], default: ["the van is back again", "that van watches the street"] },
  WATER: { beaver: ["no water for miles", "where did the water go?"], pig: ["not a puddle near home", "we need water close by"], default: ["we need water nearby", "water is too far away"] },
  TREES: { owl: ["not a tree to perch in", "this street needs branches"], default: ["not a tree in sight", "we need trees nearby"] },
  HIGH: { mouse: ["wish we lived higher up", "the mice need taller homes"], hawk: ["a higher roof would do", "wish our roof were higher"], default: ["wish we lived higher up", "this home should grow taller"] },
  LOW: { bear: ["too many neighbours", "a quiet cottage would do"], default: ["too many neighbours here", "we need a quieter home"] },
  PASTURE: { cow: ["no grass to speak of", "we need a field by home"], default: ["there's no pasture nearby", "we need some open grass"] },
  LV: { fox: ["this street has come down", "our address has lost its shine"], default: ["this street needs some care", "the land value is falling"] },
  CLEAN: { raccoon: ["it's too clean round here", "not a decent bin in sight"], default: ["this street is much too tidy", "leave a little mess for us"] },
  NO_ROAD: { default: ["no road to our door", "how do we reach the road?"] },
  CAPPED: { default: ["town's full, they say", "a park could make us room"] },
  NO_DEMAND: { default: ["nobody builds on this street", "this street is being passed by"] },
  TAX: { default: ["the taxes eat the wage", "rates take too much today"] },
});

export const NEED_CODES = Object.freeze(Object.keys(ACT));

/** Resolve the stable, short line for a citizen and a need record. */
export function line(_world, c, need) {
  const code = need?.code || "CONTENT";
  if (code === "ROOMS" && (need?.arg?.camping || c?.home < 0 && _world?.campers?.some(cp => cp.householdId === c.household))) return "we need a home again";
  const table = LINES[code] || LINES.CONTENT;
  const diet = DIET_OF[c?.species];
  const choices = table[c?.species] || table[diet] || table.default;
  // rng.hash01's historical implementation can return a signed fraction;
  // fold that into [0, 1) locally so an old visual hash cannot index -1.
  const raw = hash01(c?.id || 0, seedFromString(code), 0x4e454544);
  const k = Math.floor((raw < 0 ? raw + 1 : raw) * choices.length);
  return choices[k]
    .replaceAll("{n}", String(need?.arg?.n ?? need?.arg ?? ""))
    .replaceAll("{species}", String(need?.arg?.species ?? c?.species ?? "animal"));
}
