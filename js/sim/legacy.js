// legacy.js — the cold, permanent citizen archive. SPEC §7.10b.
//
// Living citizens keep the useful rich object and bounded twelve-event life.
// At the one removal boundary they become a single versioned shorthand line:
//
//   1|id|first|surname|species|born|end|cause|origin|lastHome|household|flags
//
// Integers are base 36; known causes are one character. Names are URI-escaped
// only when they contain punctuation, so ordinary records remain legible and
// land around 35–55 bytes. The array is append-only and saved. `_legacyById`
// is a derived lookup, never saved or hashed independently.

const VERSION = "1";
// Permanent wire codes: never derive these from the display roster's order.
// New species append; existing positions are save-format ABI.
const SPECIES_CODE = Object.freeze(["rabbit", "mouse", "fox", "beaver", "owl", "bear", "tortoise", "raccoon", "pig", "cow", "wolf", "cat", "hawk", "skunk"]);
const SPECIES_NUMBER = Object.freeze(Object.fromEntries(SPECIES_CODE.map((id, i) => [id, i])));
const CAUSE_CODE = Object.freeze({
  died: "d", killed: "k", sold: "s", slaughtered: "m", left: "l",
  evicted: "e", bulldozed: "b", homeless: "h", zonedOut: "z", revolt: "r",
});
const CODE_CAUSE = Object.freeze(Object.fromEntries(Object.entries(CAUSE_CODE).map(([cause, code]) => [code, cause])));

const encN = (n) => Number.isFinite(Number(n)) ? Math.trunc(Number(n)).toString(36) : "";
const decN = (s, fallback = -1) => {
  if (s === "" || !/^-?[0-9a-z]+$/.test(s)) return fallback;
  const n = Number.parseInt(s, 36);
  return Number.isFinite(n) ? n : fallback;
};
const encS = (s) => encodeURIComponent(String(s ?? ""));
const decS = (s) => { try { return decodeURIComponent(s || ""); } catch { return String(s || ""); } };
const causeCode = (cause) => CAUSE_CODE[cause] || `x${encS(cause || "left")}`;
const causeName = (code) => CODE_CAUSE[code] || (code?.startsWith("x") ? decS(code.slice(1)) : "left");

function originOf(c) {
  const event = (c.life || []).find((e) => Array.isArray(e) && (e[1] === 0 || e[1] === 1) && Number.isInteger(e[2]));
  return event ? event[2] : c.home;
}

function flagsOf(c) {
  return (c.native ? 1 : 0) | (c.fixed ? 2 : 0) | (c.centenary ? 4 : 0)
    | (c.wrongful ? 8 : 0) | (c.exonerated ? 16 : 0) | (c.record ? 32 : 0);
}

/** Encode one removed citizen. Exported so the size/audit suite tests the exact contract. */
export function legacyCode(c, cause, endTick) {
  return [
    VERSION, encN(c.id), encS(c.name), encS(c.surname), encN(SPECIES_NUMBER[c.species]),
    encN(c.born), encN(endTick), causeCode(cause), encN(originOf(c)), encN(c.home),
    encN(c.household), encN(flagsOf(c)),
  ].join("|");
}

/** Parse a shorthand line without trusting imported/hand-edited save data. */
export function decodeLegacy(code) {
  if (typeof code !== "string") return null;
  const p = code.split("|");
  if (p.length !== 12 || p[0] !== VERSION) return null;
  const id = decN(p[1], NaN), species = SPECIES_CODE[decN(p[4], -1)];
  if (!Number.isInteger(id) || id < 0 || !species) return null;
  const first = decS(p[2]), surname = decS(p[3]);
  const born = decN(p[5], 0), end = decN(p[6], born), flags = decN(p[11], 0);
  return Object.freeze({
    id, first, surname, name: `${first} ${surname}`.trim(), species, born, end,
    age: Math.max(0, Math.floor((end - born) / 12)), cause: causeName(p[7]),
    origin: decN(p[8]), home: decN(p[9]), household: decN(p[10]), flags,
    native: !!(flags & 1), fixed: !!(flags & 2), centenary: !!(flags & 4),
    wrongful: !!(flags & 8), exonerated: !!(flags & 16), recorded: !!(flags & 32), code,
  });
}

const EMPTY = Object.freeze([]);
const INDEX = new WeakMap();

function legacyIndex(world) {
  const rows = Array.isArray(world?.legacy) ? world.legacy : EMPTY;
  let cached = INDEX.get(rows);
  if (!cached || cached.count !== rows.length) {
    const map = new Map();
    for (const code of rows) { const rec = decodeLegacy(code); if (rec) map.set(rec.id, rec); }
    cached = { count: rows.length, map };
    INDEX.set(rows, cached);
  }
  return cached.map;
}

/** Store exactly one cold record at the one citizen-removal boundary. */
export function archiveCitizen(world, c, cause) {
  if (!Array.isArray(world.legacy)) world.legacy = [];
  const rows = world.legacy;
  const map = legacyIndex(world);
  const existing = map.get(c.id);
  if (existing) return existing;
  const code = legacyCode(c, cause, world.tick);
  rows.push(code);
  const record = decodeLegacy(code);
  // Append is the hot path. Extend the derived index in O(1); a bulk import
  // deliberately invalidates once after all its rows have landed.
  map.set(c.id, record);
  const cached = INDEX.get(rows);
  if (cached) cached.count = rows.length;
  return record;
}

/** Canonicalise old object-shaped graveyard saves into the permanent wire form. */
export function migrateLegacyNames(world) {
  if (!Array.isArray(world.legacy)) world.legacy = [];
  const existing = legacyIndex(world);
  const names = world.names && typeof world.names === "object" ? world.names : {};
  const remaining = {};
  for (const key of Object.keys(names).sort((a, b) => Number(a) - Number(b))) {
    const id = Number(key), kept = names[key];
    if (existing.has(id)) continue;
    if (!Number.isInteger(id) || id < 0 || !kept || typeof kept !== "object" || Array.isArray(kept)) { remaining[key] = kept; continue; }
    const full = kept.n ?? kept.name ?? `${kept.first || ""} ${kept.surname || ""}`.trim();
    const at = full.lastIndexOf(" ");
    const first = kept.first || (at < 0 ? full : full.slice(0, at));
    const surname = kept.surname || (at < 0 ? "" : full.slice(at + 1));
    const end = kept.t ?? kept.tick ?? world.tick;
    const age = kept.a ?? kept.age ?? 0;
    const c = { id, name: first, surname, species: kept.s ?? kept.species ?? "rabbit", born: end - age * 12, home: kept.home ?? -1, household: kept.household ?? -1, life: [], native: false, fixed: false, centenary: false, wrongful: false, exonerated: false };
    const code = legacyCode(c, kept.c ?? kept.cause ?? "left", end);
    if (decodeLegacy(code)) world.legacy.push(code);
    else remaining[key] = kept;
  }
  world.names = remaining; // preserve malformed/unknown imported data; never silently drop it
  INDEX.delete(world.legacy);
  return world.legacy;
}

/** Permanent archive lookup, with a compatibility view over old `world.names` saves. */
export function legacyOf(world, id) {
  id = Number(id);
  const rec = legacyIndex(world).get(id);
  if (rec) return rec;
  const kept = world.names?.[id];
  if (!kept || typeof kept !== "object" || Array.isArray(kept)) return null;
  const name = kept.n ?? kept.name ?? `${kept.first || ""} ${kept.surname || ""}`.trim();
  const at = name.lastIndexOf(" ");
  const first = kept.first || (at < 0 ? name : name.slice(0, at));
  const surname = kept.surname || (at < 0 ? "" : name.slice(at + 1));
  const end = kept.t ?? kept.tick ?? world.tick;
  const age = kept.a ?? kept.age ?? 0;
  return Object.freeze({
    id, first, surname, name, species: kept.s ?? kept.species ?? "rabbit",
    born: end - age * 12, end, age, cause: kept.c ?? kept.cause ?? "left",
    origin: -1, home: kept.home ?? -1, household: -1, flags: 0,
    native: false, fixed: false, centenary: false, wrongful: false, exonerated: false, recorded: !!kept.record,
    code: null,
  });
}

export function personName(world, id) {
  const c = world.byId?.get(Number(id));
  return c ? `${c.name} ${c.surname}` : legacyOf(world, id)?.name || "someone";
}

const ENDING = Object.freeze({
  died: "died", killed: "was killed", sold: "was sold at the hall",
  slaughtered: "went to market", left: "left town", evicted: "left after an eviction",
  bulldozed: "left after losing their home", homeless: "left without a home",
  zonedOut: "was zoned out", revolt: "left in the tax revolt",
});

const at = (world, i) => i >= 0 ? `(${i % world.w},${(i / world.w) | 0})` : "no surviving address";

/** The sole cold-record sentence used by a gone pin and future story links. */
export function epitaph(world, id) {
  const rec = typeof id === "object" ? id : legacyOf(world, id);
  if (!rec) return "No civic record survives.";
  const year = 2000 + Math.floor(rec.end / 12);
  return `${rec.name}, a ${rec.species}, ${ENDING[rec.cause] || rec.cause} aged ${rec.age} in ${year}; last recorded at ${at(world, rec.home)}.`;
}

export function legacyStats(world) {
  const rows = world.legacy || [];
  const bytes = rows.reduce((n, code) => n + code.length, 0);
  return { records: rows.length, bytes, mean: rows.length ? bytes / rows.length : 0 };
}
