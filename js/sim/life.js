// life.js — the compact biography contract. PLAN-THE-PEOPLE §3 K2.
//
// Part K owns the stable event ids and the bounded write path. Part B adds
// the call sites and turns the stored triples into sentences.

export const LIFE_MAX = 12;
export const NAMES_YEARS = 20;
export const DEATHS_MAX = 256;

export const KIND = Object.freeze({
  BORN: 0,
  ARRIVED: 1,
  MOVED: 2,
  HIRED: 3,
  LOST_JOB: 4,
  FRIEND: 5,
  LOST_FRIEND: 6,
  LITTER: 7,
  LEFT_HOME: 8,
  RETIRED: 9,
  ARRESTED: 10,
  FIXED: 11,
  EXONERATED: 12,
  KILLED: 13,
  CENTENARY: 14,
  ZONED_OUT: 15,
});

const KIND_IDS = new Set(Object.values(KIND));

/** Record one life event on the citizen and on this tick's story bus. */
export function remember(world, c, kind, arg = null) {
  const id = typeof kind === "string" ? KIND[kind] : kind;
  if (!KIND_IDS.has(id)) throw new Error(`life.remember: unknown kind '${kind}'`);
  if (!c.life) c.life = [];
  c.life.push([world.tick, id, arg]);
  // The origin and the first chapter stay; the other ten slots are a rolling
  // window. slice also normalises an overlong life loaded from a hand-edited save.
  if (c.life.length > LIFE_MAX) c.life = [...c.life.slice(0, 2), ...c.life.slice(2).slice(-(LIFE_MAX - 2))];
  if (!world.lifeEvents) world.lifeEvents = [];
  world.lifeEvents.push({ id: c.id, kind: id, arg });
}

const yearAt = (tick) => 2000 + Math.floor(tick / 12);

function nameById(world, id) {
  const living = world.byId?.get(Number(id));
  if (living) return `${living.name} ${living.surname}`;
  const kept = world.names?.[id];
  return kept?.n || kept?.name || (kept ? `${kept.first || ""} ${kept.surname || ""}`.trim() : "") || "someone";
}

function lotNow(world, lot) {
  if (!Number.isInteger(lot) || lot < 0 || lot >= world.w * world.h) return "somewhere";
  const hh = world.households?.find((h) => !h.gone && h.home === lot);
  const at = `(${lot % world.w},${(lot / world.w) | 0})`;
  return hh ? `${at}, now home to the ${hh.surname} family` : at;
}

/** The one sentence writer for every citizen card and story surface. */
export function lifeLines(world, c) {
  const lines = [];
  for (const event of c?.life || []) {
    if (!Array.isArray(event) || event.length < 2) continue;
    const [tick, kind, arg] = event;
    const year = yearAt(tick);
    switch (kind) {
      case KIND.BORN: lines.push(`Born here to the ${c.surname} family at ${lotNow(world, arg)} in ${year}.`); break;
      case KIND.ARRIVED: lines.push(`Arrived at ${lotNow(world, arg)} in ${year}.`); break;
      case KIND.MOVED: lines.push(`Moved to ${lotNow(world, arg)} in ${year}.`); break;
      case KIND.HIRED: lines.push(`Hired at ${lotNow(world, arg)} in ${year}.`); break;
      case KIND.LOST_JOB: lines.push(`Lost the job at ${lotNow(world, arg)} in ${year}.`); break;
      case KIND.FRIEND: lines.push(`Befriended ${nameById(world, arg)} in ${year}.`); break;
      case KIND.LOST_FRIEND: {
        const [id, cause] = Array.isArray(arg) ? arg : [arg, "left town"];
        lines.push(`Lost ${nameById(world, id)} in ${year} — ${cause || "left town"}.`);
        break;
      }
      case KIND.LITTER: lines.push(`Welcomed ${arg === 1 ? "a cub" : `a litter of ${arg}`} in ${year}.`); break;
      case KIND.LEFT_HOME: lines.push(`Left home for ${lotNow(world, arg)} in ${year}.`); break;
      case KIND.RETIRED: lines.push(`Retired in ${year}.`); break;
      case KIND.ARRESTED: lines.push(`Arrested for ${arg || "an offence"} in ${year}.`); break;
      case KIND.FIXED: lines.push(`Returned from the centre fixed in ${year}.`); break;
      case KIND.EXONERATED: lines.push(`Exonerated${arg ? ` of the ${arg}` : ""} in ${year}.`); break;
      case KIND.KILLED: lines.push(`Killed ${nameById(world, arg)} in ${year}.`); break;
      case KIND.CENTENARY: lines.push(`Turned one hundred in ${year}.`); break;
      case KIND.ZONED_OUT: lines.push(`Zoned out of ${lotNow(world, arg)} in ${year}.`); break;
    }
  }
  return lines;
}

/** Departures and deaths in the trailing twelve months, newest first. */
export function memorial(world) {
  const from = world.tick - 12;
  const out = [];
  for (let i = (world.deaths || []).length - 1; i >= 0; i--) {
    const entry = world.deaths[i];
    const tick = Array.isArray(entry) ? entry[0] : entry.tick;
    const id = Array.isArray(entry) ? entry[1] : entry.id;
    if (tick < from) continue;
    const kept = world.names?.[id];
    if (!kept) continue;
    out.push({ name: kept.n ?? kept.name, species: kept.s ?? kept.species, age: kept.a ?? kept.age, cause: kept.c ?? kept.cause, tick });
  }
  return out;
}
