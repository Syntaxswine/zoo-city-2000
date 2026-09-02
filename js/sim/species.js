// species.js — the roster. SPEC §7.6. Every trait is a WEIGHT, never a gate,
// except the two soft home preferences (fox: LV >= 50; bear: Low lots), both
// of which fall back after 3 failed months.
//
// Ages are in YEARS here; the sim keeps age in months (tick − born).

export const SPECIES = Object.freeze([
  //  id        life litter fertile   retire  jobC jobI  polTol homePref   commute  surname      fur       affinity notes
  { id: "rabbit",   life: 40,  litter: 3, fertile: [16, 30], retire: 35,  jobC: 0.5, jobI: 0.5, polTol: 40, homePref: "any",   commute: 24, surname: "Burrowes",   fur: "furWarm", furShift: 1 },
  { id: "mouse",    life: 30,  litter: 4, fertile: [16, 24], retire: 26,  jobC: 0.4, jobI: 0.6, polTol: 60, homePref: "high",  commute: 16, surname: "Whiskerton", fur: "furCool", furShift: 1 },
  { id: "fox",      life: 60,  litter: 2, fertile: [18, 40], retire: 50,  jobC: 0.8, jobI: 0.2, polTol: 30, homePref: "lv50",  commute: 32, surname: "Slyfield",   fur: "furWarm", furShift: 0 },
  { id: "beaver",   life: 55,  litter: 2, fertile: [18, 40], retire: 48,  jobC: 0.2, jobI: 0.8, polTol: 70, homePref: "water", commute: 28, surname: "Gnawley",    fur: "furWarm", furShift: -1 },
  { id: "owl",      life: 70,  litter: 1, fertile: [20, 45], retire: 60,  jobC: 0.6, jobI: 0.4, polTol: 40, homePref: "trees", commute: 30, surname: "Hootsworth", fur: "furCool", furShift: 0 },
  { id: "bear",     life: 80,  litter: 1, fertile: [20, 45], retire: 65,  jobC: 0.4, jobI: 0.6, polTol: 50, homePref: "low",   commute: 40, surname: "Ursin",      fur: "furWarm", furShift: -1 },
  { id: "tortoise", life: 150, litter: 1, fertile: [25, 80], retire: 120, jobC: 0.5, jobI: 0.5, polTol: 50, homePref: "any",   commute: 8,  surname: "Shelby",     fur: "olive",   furShift: 0 },
  { id: "raccoon",  life: 35,  litter: 3, fertile: [16, 28], retire: 30,  jobC: 0.6, jobI: 0.4, polTol: 80, homePref: "any",   commute: 20, surname: "Binsworth",  fur: "furCool", furShift: -1 },
]);

export const SPECIES_BY_ID = Object.freeze(Object.fromEntries(SPECIES.map((s) => [s.id, s])));
export const SPECIES_INDEX = Object.freeze(Object.fromEntries(SPECIES.map((s, i) => [s.id, i])));

// Affinity for friendship rolls: 1.0 same or allied, 0.7 neutral, 0.4 wary.
// Raccoon 1.2 with everyone — the glue species (SPEC §7.5).
const WARY = new Set(["fox|rabbit", "fox|mouse", "owl|mouse"]);
const ALLIED = new Set(["rabbit|mouse", "beaver|bear", "owl|tortoise", "fox|owl"]);
export function affinity(a, b) {
  if (a === "raccoon" || b === "raccoon") return 1.2;
  if (a === b) return 1.0;
  const k = a < b ? `${a}|${b}` : `${b}|${a}`;
  if (WARY.has(k)) return 0.4;
  if (ALLIED.has(k)) return 1.0;
  return 0.7;
}

// First-name syllable banks per species (names stream only).
export const NAME_PARTS = Object.freeze({
  rabbit:   { a: ["Bram", "Clo", "Has", "Pip", "Thist", "Bry", "Fern", "Tan"], b: ["ble", "ver", "el", "pin", "le", "ony", "wick", "sy"] },
  mouse:    { a: ["Nib", "Tit", "Pim", "Wis", "Dor", "Mil", "Pep", "Cru"], b: ["bles", "ch", "pkin", "p", "mie", "let", "per", "mb"] },
  fox:      { a: ["Ren", "Sor", "Vix", "Rus", "Tam", "Bran", "Rey", "Ash"], b: ["net", "rel", "en", "set", "sin", "dle", "nard", "by"] },
  beaver:   { a: ["Bar", "Tim", "Log", "Dam", "Wil", "Chip", "Ald", "Bur"], b: ["ker", "ber", "an", "son", "low", "per", "er", "ley"] },
  owl:      { a: ["Al", "Min", "Ath", "Hoot", "Sol", "Per", "Wil", "Or"], b: ["ba", "erva", "ena", "ie", "emn", "egrin", "fred", "lin"] },
  bear:     { a: ["Bru", "Hon", "Mos", "Ur", "Ber", "Grum", "Hul", "Tor"], b: ["no", "ey", "sy", "sa", "nard", "ble", "da", "vald"] },
  tortoise: { a: ["Am", "Old", "Tes", "Mor", "Sha", "El", "Gra", "Hum"], b: ["brose", "ford", "tudo", "timer", "le", "der", "nite", "bert"] },
  raccoon:  { a: ["Ban", "Scr", "Rif", "Tin", "Dus", "Ras", "Mid", "Nox"], b: ["dit", "ap", "fle", "ker", "ty", "cal", "night", "ie"] },
});
