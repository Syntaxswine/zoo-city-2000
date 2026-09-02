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
  { id: "raccoon",  life: 35,  litter: 3, fertile: [16, 28], retire: 30,  jobC: 0.6, jobI: 0.4, polTol: 80, homePref: "dirt",  commute: 20, surname: "Binsworth",  fur: "furCool", furShift: -1 },
  // Livestock (the owner's ask) — the industrial workforce and the pastoral tax base.
  { id: "pig",      life: 30,  litter: 5, fertile: [14, 24], retire: 26,  jobC: 0.2, jobI: 0.8, polTol: 90, homePref: "water", commute: 16, surname: "Trotter",    fur: "furWarm", furShift: 1,  pack: [2, 4] },
  { id: "cow",      life: 45,  litter: 1, fertile: [18, 35], retire: 40,  jobC: 0.4, jobI: 0.6, polTol: 60, homePref: "pasture", commute: 20, surname: "Cudworth",  fur: "furCool", furShift: 1,  pack: [2, 4] },
  // Predators — wary of their prey, and the proudest friendships in town.
  { id: "wolf",     life: 50,  litter: 3, fertile: [18, 40], retire: 45,  jobC: 0.5, jobI: 0.5, polTol: 50, homePref: "trees", commute: 40, surname: "Greyback",   fur: "furCool", furShift: -1, pack: [4, 6], predator: true },
  { id: "cat",      life: 35,  litter: 3, fertile: [14, 28], retire: 30,  jobC: 0.8, jobI: 0.2, polTol: 40, homePref: "flats", commute: 24, surname: "Purrington", fur: "furWarm", furShift: 0,  pack: [2, 4], predator: true },
  { id: "hawk",     life: 40,  litter: 2, fertile: [16, 35], retire: 35,  jobC: 0.6, jobI: 0.4, polTol: 30, homePref: "high",  commute: 64, surname: "Talonby",    fur: "earth",   furShift: 0,  pack: [2, 3], predator: true },
]);

/**
 * Who fears whom. A prey household next door to one of its predators loses
 * mood unless someone in it is FRIENDS with that species (citizens.js), and a
 * predator–prey friendship counts double in the Zoo City index (census.js).
 * Weights and mood terms, never gates: a wolf pack can still move in next to
 * the warren — that is the point.
 */
export const PREY_OF = Object.freeze({
  rabbit: ["fox", "wolf", "hawk"],
  mouse: ["fox", "owl", "cat", "hawk"],
  pig: ["wolf"],
  cow: ["wolf"],
});
export function isPredatorOf(pred, prey) {
  const l = PREY_OF[prey];
  return !!l && l.includes(pred);
}
export const isPredPrey = (a, b) => isPredatorOf(a, b) || isPredatorOf(b, a);

/** Species that can ARRIVE. New species join here once their sprites exist. */
export const ARRIVING = new Set(["rabbit", "mouse", "fox", "beaver", "owl", "bear", "tortoise", "raccoon"]);

export const SPECIES_BY_ID = Object.freeze(Object.fromEntries(SPECIES.map((s) => [s.id, s])));
export const SPECIES_INDEX = Object.freeze(Object.fromEntries(SPECIES.map((s, i) => [s.id, i])));

// Affinity for friendship rolls: 1.0 same or allied, 0.7 neutral, 0.4 wary.
// Raccoon 1.2 with everyone — the glue species (SPEC §7.5).
const ALLIED = new Set(["mouse|rabbit", "bear|beaver", "owl|tortoise", "fox|owl", "cow|tortoise", "pig|raccoon", "bear|wolf", "cat|fox", "cow|pig", "hawk|owl"]);
export function affinity(a, b) {
  if (a === "raccoon" || b === "raccoon") return 1.2;
  if (a === b) return 1.0;
  if (isPredPrey(a, b)) return 0.4;
  const k = a < b ? `${a}|${b}` : `${b}|${a}`;
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
  pig:      { a: ["Por", "Hamb", "Tru", "Wil", "Pud", "Ros", "Bab", "Snor"], b: ["ky", "let", "ffle", "bur", "ding", "ie", "s", "tle"] },
  cow:      { a: ["But", "Dai", "Clo", "Mar", "Bess", "Hen", "Bel", "Pat"], b: ["tercup", "sy", "ver", "igold", "ie", "rietta", "la", "ience"] },
  wolf:     { a: ["Fen", "Gre", "Lu", "Ash", "Ran", "Sil", "Ror", "Vel"], b: ["rir", "yfang", "pa", "en", "ulf", "as", "ek", "da"] },
  cat:      { a: ["Tab", "Mit", "Sil", "Pur", "Whis", "Mar", "Sook", "Tom"], b: ["itha", "tens", "kie", "l", "kers", "mal", "ie", "kin"] },
  hawk:     { a: ["Kes", "Tal", "Sky", "Gyr", "Per", "Fal", "Wind", "Ael"], b: ["trel", "on", "la", "e", "egrine", "co", "row", "ric"] },
});
