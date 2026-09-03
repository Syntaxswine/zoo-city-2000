// life.js — the compact biography contract. PLAN-THE-PEOPLE §3 K2.
//
// Part K owns the stable event ids and the bounded write path. Part B adds
// the call sites and turns the stored triples into sentences.

export const LIFE_MAX = 12;

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
  if (c.life.length > LIFE_MAX) c.life.splice(0, c.life.length - LIFE_MAX);
  if (!world.lifeEvents) world.lifeEvents = [];
  world.lifeEvents.push({ id: c.id, kind: id, arg });
}

/** Part B supplies the shared biography sentence writer. */
export function lifeLines(_world, _c) {
  return [];
}
