// slots.js — named save slots over an injected key/value store. DOM-free.
//
// A store has get(key), set(key, value), keys(), and del(key) or delete(key).
// The browser supplies guarded localStorage wrappers; the suite supplies Maps.

const INDEX = (city) => `zoo.slots:${city}`;
const SLOT = (city, id) => `zoo.slot:${city}:${id}`;
const LEGACY_ID = "legacy:";
const LEGACY_PREFIXES = [
  ["zoo.city:", "manual"],
  ["zoo.save:", "manual"],
  ["zoo.auto:", "auto"],
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const valueOf = (store, key) => {
  try { return store.get(key) ?? null; } catch { return null; }
};
const put = (store, key, value) => {
  try { return store.set(key, value) !== false; } catch { return false; }
};
const drop = (store, key) => {
  try {
    const result = typeof store.del === "function" ? store.del(key) : store.delete(key);
    return result !== false;
  } catch { return false; }
};
const keysOf = (store) => {
  try { return Array.from(store.keys()); } catch { return []; }
};
const bytesOf = (value) => new TextEncoder().encode(String(value)).length;
const dateAt = (tick) => `${MONTHS[((tick % 12) + 12) % 12]} ${2000 + Math.floor(tick / 12)}`;

function emptyIndex() {
  return { version: 1, next: 1, nextOrder: 1, migrated: [], slots: [] };
}

function readIndex(store, city) {
  const raw = valueOf(store, INDEX(city));
  if (!raw) return { raw: null, index: emptyIndex() };
  try {
    const saved = JSON.parse(raw);
    const slots = Array.isArray(saved.slots) ? saved.slots.filter((s) => s && s.id != null) : [];
    // Early Part S indexes used slot.legacyKey as the marker. Fold those
    // markers into the durable index-level list the next time it is written.
    const migrated = [...new Set([
      ...(Array.isArray(saved.migrated) ? saved.migrated.filter((key) => typeof key === "string") : []),
      ...slots.map((s) => s.legacyKey).filter((key) => typeof key === "string"),
    ])];
    const maxId = slots.reduce((m, s) => /^\d+$/.test(String(s.id)) ? Math.max(m, Number(s.id)) : m, 0);
    const maxOrder = slots.reduce((m, s) => Math.max(m, Number(s.order) || 0), 0);
    return {
      raw,
      index: {
        version: 1,
        next: Math.max(maxId + 1, Number(saved.next) || 1),
        nextOrder: Math.max(maxOrder + 1, Number(saved.nextOrder) || 1),
        migrated,
        slots,
      },
    };
  } catch {
    return { raw, index: emptyIndex() };
  }
}

function describe(json) {
  try {
    const plain = JSON.parse(json);
    const tick = Number(plain.tick);
    if (!Number.isFinite(tick) || !Array.isArray(plain.citizens)) throw new Error("missing tick or citizens");
    return { tick, pop: plain.citizens.length, date: dateAt(tick), bytes: bytesOf(json) };
  } catch (error) {
    return { error: `invalid city: ${error.message}` };
  }
}

const publicSlot = (s) => ({ id: String(s.id), name: s.name, date: s.date, tick: s.tick, pop: s.pop, bytes: s.bytes, kind: s.kind });

function legacyInfo(store, key) {
  key = String(key);
  const pair = LEGACY_PREFIXES.find(([prefix]) => key.startsWith(prefix));
  if (!pair) return null;
  const [prefix, kind] = pair;
  const city = key.slice(prefix.length);
  const json = valueOf(store, key);
  const info = json == null ? { error: "missing" } : describe(json);
  if (!city || info.error) return null;
  return { key, city, kind, json, info };
}

const legacyId = (key) => `${LEGACY_ID}${encodeURIComponent(key)}`;
const keyFromLegacyId = (id) => {
  if (!String(id).startsWith(LEGACY_ID)) return null;
  try { return decodeURIComponent(String(id).slice(LEGACY_ID.length)); } catch { return null; }
};

/** Old values stay directly readable if migration cannot afford a copy. */
function legacyRecords(store, city, index) {
  const out = [];
  for (const key of keysOf(store)) {
    const old = legacyInfo(store, key);
    if (!old || old.city !== city || index.migrated.includes(old.key)) continue;
    out.push({
      id: legacyId(old.key),
      name: old.kind === "auto" ? "Autosave" : `${city} — ${old.info.date}`,
      kind: old.kind,
      ...old.info,
      legacy: true,
      legacyKey: old.key,
      _fresh: 0,
      _savedAt: 0,
      _order: 0,
    });
  }
  return out;
}

function slotRecords(store, city) {
  const { index } = readIndex(store, city);
  const stored = index.slots
    .filter((s) => valueOf(store, SLOT(city, s.id)) != null)
    .map((s) => ({ ...s, _fresh: s.legacyKey ? 0 : 1, _savedAt: s.savedAt || 0, _order: s.order || 0 }));
  return [...stored, ...legacyRecords(store, city, index)].sort((a, b) =>
    b._fresh - a._fresh
    || (a._fresh ? b._savedAt - a._savedAt || b._order - a._order : b.tick - a.tick)
    || String(a.id).localeCompare(String(b.id)));
}

const publish = (record) => ({ ...publicSlot(record), ...(record.legacy ? { legacy: true } : {}) });

function writeRecord(store, city, name, json, kind, { replaceId = null, legacyKey = null, legacyCopy = false } = {}) {
  city = String(city);
  name = String(name || "").trim();
  if (!city) return { ok: false, reason: "the city has no name" };
  if (!name) return { ok: false, reason: "give this save a name" };
  if (kind !== "manual" && kind !== "auto") return { ok: false, reason: `unknown slot kind '${kind}'` };
  const info = describe(json);
  if (info.error) return { ok: false, reason: info.error };

  const { raw: oldIndexRaw, index } = readIndex(store, city);
  let old = null;
  if (kind === "auto") old = index.slots.find((s) => s.kind === "auto") || null;
  else if (replaceId != null) old = index.slots.find((s) => String(s.id) === String(replaceId)) || null;
  if (replaceId != null && !old) return { ok: false, reason: "that save no longer exists" };

  const id = old ? String(old.id) : String(index.next++);
  const key = SLOT(city, id);
  const oldJson = valueOf(store, key);
  const meta = {
    id,
    name,
    kind,
    ...info,
    order: index.nextOrder++,
    savedAt: Date.now(),
    ...(legacyCopy && legacyKey ? { legacyKey } : {}),
  };
  const at = old ? index.slots.indexOf(old) : -1;
  if (at >= 0) index.slots[at] = meta;
  else index.slots.push(meta);
  // A successful new autosave supersedes an unmigrated legacy autosave. Its
  // index write carries the durable marker; if that write fails, rollback
  // leaves the legacy row visible and unmarked.
  if (kind === "auto") {
    for (const record of legacyRecords(store, city, index)) {
      if (record.kind === "auto" && !index.migrated.includes(record.legacyKey)) index.migrated.push(record.legacyKey);
    }
  }
  if (legacyKey && !index.migrated.includes(legacyKey)) index.migrated.push(legacyKey);

  if (!put(store, key, json)) return { ok: false, reason: "storage is full or unavailable" };
  if (!put(store, INDEX(city), JSON.stringify(index))) {
    if (oldJson == null) drop(store, key);
    else put(store, key, oldJson);
    if (oldIndexRaw != null) put(store, INDEX(city), oldIndexRaw);
    return { ok: false, reason: "storage is full or unavailable" };
  }
  return { ok: true, id, slot: publicSlot(meta) };
}

/** Write a new manual slot, replace one by id, or update the city's one auto slot. */
export function writeSlot(store, city, name, json, kind = "manual", replaceId = null) {
  const oldKey = keyFromLegacyId(replaceId);
  if (oldKey) {
    const old = legacyInfo(store, oldKey);
    if (!old || old.city !== String(city) || old.kind !== "manual") return { ok: false, reason: "that save no longer exists" };
    return writeRecord(store, city, name, json, "manual", { legacyKey: old.key });
  }
  return writeRecord(store, city, name, json, kind, { replaceId });
}

/** Named slots for one city, newest write first. */
export function listSlots(store, city) {
  return slotRecords(store, String(city)).map(publish);
}

/** Every city's slots, newest write first; a slot name never becomes a city name. */
export function listAllSlots(store) {
  const cities = new Set();
  for (const rawKey of keysOf(store)) {
    const key = String(rawKey);
    if (key.startsWith("zoo.slots:")) cities.add(key.slice("zoo.slots:".length));
    const old = legacyInfo(store, key);
    if (old) cities.add(old.city);
  }
  const out = [];
  for (const city of cities) for (const saved of slotRecords(store, city)) out.push({ city, ...publish(saved), ...saved });
  return out
    .sort((a, b) => b._fresh - a._fresh
      || (a._fresh ? b._savedAt - a._savedAt || b._order - a._order : b.tick - a.tick)
      || a.city.localeCompare(b.city))
    .map(({ _fresh, _savedAt, _order, legacyKey, order, savedAt, ...slot }) => ({
      city: slot.city,
      ...publicSlot(slot),
      ...(slot.legacy ? { legacy: true } : {}),
    }));
}

/** One slot plus its city JSON, or null when either the index or value is gone. */
export function readSlot(store, city, id) {
  const slot = listSlots(store, city).find((s) => s.id === String(id));
  if (!slot) return null;
  const oldKey = keyFromLegacyId(id);
  const json = valueOf(store, oldKey || SLOT(city, id));
  return json == null ? null : { city: String(city), ...slot, json };
}

/** Delete exactly one slot. The city's other manual slots and autosave stay. */
export function deleteSlot(store, city, id) {
  city = String(city);
  id = String(id);
  const oldKey = keyFromLegacyId(id);
  if (oldKey) {
    const old = legacyInfo(store, oldKey);
    if (!old || old.city !== city) return { ok: false, reason: "that save no longer exists" };
    return drop(store, oldKey) ? { ok: true } : { ok: false, reason: "storage is unavailable" };
  }
  const { raw, index } = readIndex(store, city);
  const at = index.slots.findIndex((s) => String(s.id) === id);
  if (at < 0) return { ok: false, reason: "that save no longer exists" };
  const next = { ...index, slots: index.slots.filter((_, i) => i !== at) };
  if (!put(store, INDEX(city), JSON.stringify(next))) return { ok: false, reason: "storage is full or unavailable" };
  if (!drop(store, SLOT(city, id))) {
    if (raw != null) put(store, INDEX(city), raw);
    return { ok: false, reason: "storage is unavailable" };
  }
  return { ok: true };
}

/** UTF-8 bytes occupied by this store, including keys and indexes. */
export function bytesUsed(store) {
  let total = 0;
  for (const key of keysOf(store)) {
    const value = valueOf(store, key);
    if (value != null) total += bytesOf(key) + bytesOf(value);
  }
  return total;
}

/**
 * Copy the old checkpoint/autosave keys into named slots. Old keys stay put;
 * index.migrated makes the operation idempotent even after a migrated slot
 * is overwritten or deleted. If no copy fits, listSlots exposes the old key
 * as a directly readable recovery row instead of hiding the city.
 */
export function migrate(store) {
  const legacy = [];
  for (const rawKey of keysOf(store)) {
    const key = String(rawKey);
    const old = legacyInfo(store, key);
    if (!old) continue;
    const { index } = readIndex(store, old.city);
    if (index.migrated.includes(key)) continue;
    legacy.push(old);
  }
  legacy.sort((a, b) => a.info.tick - b.info.tick || (a.kind === "manual" ? -1 : 1));
  let migrated = 0;
  for (const old of legacy) {
    const name = old.kind === "auto" ? "Autosave" : `${old.city} — ${old.info.date}`;
    const result = writeRecord(store, old.city, name, old.json, old.kind, { legacyKey: old.key, legacyCopy: true });
    if (!result.ok) return { ok: false, migrated, reason: result.reason };
    migrated++;
  }
  return { ok: true, migrated };
}
