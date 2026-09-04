// story.js — the biography-to-news bridge. PLAN Part F; SPEC §11c.
//
// `remember()` publishes small facts on `world.lifeEvents`. This module is
// the one editor which decides whether those facts deserve a dispatch. It
// never draws RNG and never changes gameplay state; its only write is a row
// in the city's existing news log (bounded by tick.js at month end).

import { KIND } from "./life.js";
import { legacyOf, personName } from "./legacy.js";

export const STORY_PREFIXES = Object.freeze(["OBITUARY", "LITTER", "CENTENARY"]);

const liveOrLegacy = (world, id) => world.byId?.get(Number(id)) || legacyOf(world, id);
const ids = (world, values) => [...new Set(values.map(Number)
  .filter((id) => Number.isInteger(id) && id >= 0 && liveOrLegacy(world, id)))]
  .sort((a, b) => a - b);
const at = (world, home) => Number.isInteger(home) && home >= 0
  ? `(${home % world.w},${(home / world.w) | 0})`
  : "no surviving address";

function publish(world, id, line, who) {
  const row = { t: world.tick, id, line, who: ids(world, who) };
  // Defensive idempotence: storyTick normally runs once, but a diagnostic or
  // future orchestration retry must not print a citizen's story twice.
  const duplicate = world.events.log.some((old) => old.t === row.t && old.id === row.id);
  if (!duplicate) world.events.log.push(row);
  return duplicate ? null : row;
}

/**
 * Publish this month's selected people stories. Returns ONLY story lines
 * which may pop over the map; tick.js threads these into `notices` without
 * logging them a second time. Ordinary people stories remain in the reader.
 */
export function storyTick(world) {
  if (!world?.events?.log || !Array.isArray(world.lifeEvents)) return [];
  const flash = [];

  // There is no DEATH biography row on the dead citizen: removal has already
  // archived them. Three distinct LOST_FRIEND witnesses are the obituary
  // threshold, and the permanent record supplies the truthful final details.
  const mourners = new Map();
  for (const e of world.lifeEvents) {
    if (e?.kind !== KIND.LOST_FRIEND || !Array.isArray(e.arg)) continue;
    const dead = Number(e.arg[0]);
    if (!Number.isInteger(dead) || (e.arg[1] !== "died" && e.arg[1] !== "killed")) continue;
    if (!mourners.has(dead)) mourners.set(dead, new Set());
    mourners.get(dead).add(Number(e.id));
  }
  for (const dead of [...mourners.keys()].sort((a, b) => a - b)) {
    const by = mourners.get(dead);
    const rec = legacyOf(world, dead);
    if (!rec || by.size < 3) continue;
    const prefix = rec.age >= 100 ? "OBITUARY 100" : "OBITUARY";
    const line = `${prefix} — ${rec.name}, ${rec.age}, a ${rec.species} of ${at(world, rec.home)}, mourned by ${by.size}.`;
    if (publish(world, `story-obituary:${dead}`, line, [dead]) && rec.age >= 100) flash.push(line);
  }

  // Today's sim creates one cub and records LITTER(1) on each of two parents.
  // Those are two witnesses to ONE singleton birth, never a litter of two.
  // A future/synthetic true litter declares arg>=2; coalesce its parent rows
  // by household and take the stated maximum (never sum witness counts).
  const litters = new Map();
  for (const e of world.lifeEvents) {
    if (e?.kind !== KIND.LITTER || !Number.isInteger(e.arg) || e.arg < 2) continue;
    const p = liveOrLegacy(world, e.id);
    if (!p) continue;
    const household = Number.isInteger(p.household) ? p.household : -1;
    const key = household >= 0 ? `h${household}` : `p${e.id}`;
    let row = litters.get(key);
    if (!row) {
      row = { n: e.arg, household, home: p.home, surname: p.surname || "Unknown", parents: [] };
      litters.set(key, row);
    }
    row.n = Math.max(row.n, e.arg);
    row.parents.push(e.id);
  }
  for (const key of [...litters.keys()].sort()) {
    const litter = litters.get(key);
    const newborns = world.lifeEvents
      .filter((e) => e?.kind === KIND.BORN)
      .map((e) => liveOrLegacy(world, e.id))
      .filter((c) => c && c.household === litter.household)
      .map((c) => c.id);
    const who = ids(world, [...litter.parents, ...newborns]);
    if (!who.length) continue;
    publish(world, `story-litter:${key}`, `LITTER — A litter of ${litter.n} to the ${litter.surname} family of ${at(world, litter.home)}.`, who);
  }

  // events.js owns the plaque/gameplay fact; this is its sole news writer.
  for (const e of world.lifeEvents.filter((x) => x?.kind === KIND.CENTENARY).sort((a, b) => a.id - b.id)) {
    const c = liveOrLegacy(world, e.id);
    if (!c) continue;
    publish(world, `story-centenary:${e.id}`, `CENTENARY — ${personName(world, e.id)} is ONE HUNDRED. A plaque goes up at ${at(world, c.home)}; the street is worth more for it.`, [e.id]);
  }
  return flash;
}
