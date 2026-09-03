// slots.js — named save slots over an injected key/value store. DOM-free.
//
// A store has get(key), set(key, value), keys(), and del(key) or delete(key).
// The browser supplies guarded localStorage wrappers; the suite supplies Maps.

const INDEX = (city) => `zoo.slots:${city}`;
const SLOT = (city, id) => `zoo.slot:${city}:${id}`;
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
  return { version: 1, next: 1, nextOrder: 1, slots: [] };
}

function readIndex(store, city) {
  const raw = valueOf(store, INDEX(city));
  if (!raw) return { raw: null, index: emptyIndex() };
  try {
    const saved = JSON.parse(raw);
    const slots = Array.isArray(saved.slots) ? saved.slots.filter((s) => s && s.id != null) : [];
    const maxId = slots.reduce((m, s) => /^\d+$/.test(String(s.id)) ? Math.max(m, Number(s.id)) : m, 0);
    const maxOrder = slots.reduce((m, s) => Math.max(m, Number(s.order) || 0), 0);
    return {
      raw,
      index: {
        version: 1,
        next: Math.max(maxId + 1, Number(saved.next) || 1),
        nextOrder: Math.max(maxOrder + 1, Number(saved.nextOrder) || 1),
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

function writeRecord(store, city, name, json, kind, { replaceId = null, legacyKey = null } = {}) {
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
  const migratedFrom = legacyKey || old?.legacyKey || null;
  const meta = {
    id,
    name,
    kind,
    ...info,
    order: index.nextOrder++,
    savedAt: Date.now(),
    ...(migratedFrom ? { legacyKey: migratedFrom } : {}),
  };
  const at = old ? index.slots.indexOf(old) : -1;
  if (at >= 0) index.slots[at] = meta;
  else index.slots.push(meta);

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
  return writeRecord(store, city, name, json, kind, { replaceId });
}

/** Named slots for one city, newest write first. */
export function listSlots(store, city) {
  const { index } = readIndex(store, String(city));
  return index.slots
    .filter((s) => valueOf(store, SLOT(city, s.id)) != null)
    .sort((a, b) => (b.order || 0) - (a.order || 0))
    .map(publicSlot);
}

/** Every city's slots, newest write first; a slot name never becomes a city name. */
export function listAllSlots(store) {
  const out = [];
  for (const key of keysOf(store)) {
    if (!String(key).startsWith("zoo.slots:")) continue;
    const city = String(key).slice("zoo.slots:".length);
    const { index } = readIndex(store, city);
    for (const saved of index.slots) {
      if (valueOf(store, SLOT(city, saved.id)) == null) continue;
      out.push({ city, ...publicSlot(saved), _savedAt: saved.savedAt || 0, _order: saved.order || 0 });
    }
  }
  return out
    .sort((a, b) => b._savedAt - a._savedAt || b._order - a._order || a.city.localeCompare(b.city))
    .map(({ _savedAt, _order, ...slot }) => slot);
}

/** One slot plus its city JSON, or null when either the index or value is gone. */
export function readSlot(store, city, id) {
  const slot = listSlots(store, city).find((s) => s.id === String(id));
  if (!slot) return null;
  const json = valueOf(store, SLOT(city, id));
  return json == null ? null : { city: String(city), ...slot, json };
}

/** Delete exactly one slot. The city's other manual slots and autosave stay. */
export function deleteSlot(store, city, id) {
  city = String(city);
  id = String(id);
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
 * legacyKey in the index makes the operation idempotent.
 */
export function migrate(store) {
  const legacy = [];
  for (const rawKey of keysOf(store)) {
    const key = String(rawKey);
    let prefix = null;
    let kind = null;
    if (key.startsWith("zoo.city:")) { prefix = "zoo.city:"; kind = "manual"; }
    else if (key.startsWith("zoo.save:")) { prefix = "zoo.save:"; kind = "manual"; }
    else if (key.startsWith("zoo.auto:")) { prefix = "zoo.auto:"; kind = "auto"; }
    if (!prefix) continue;
    const city = key.slice(prefix.length);
    const json = valueOf(store, key);
    const info = json == null ? { error: "missing" } : describe(json);
    if (!city || info.error) continue;
    const { index } = readIndex(store, city);
    if (index.slots.some((s) => s.legacyKey === key)) continue;
    legacy.push({ key, city, kind, json, info });
  }
  legacy.sort((a, b) => a.info.tick - b.info.tick || (a.kind === "manual" ? -1 : 1));
  let migrated = 0;
  for (const old of legacy) {
    const name = old.kind === "auto" ? "Autosave" : `${old.city} — ${old.info.date}`;
    const result = writeRecord(store, old.city, name, old.json, old.kind, { legacyKey: old.key });
    if (!result.ok) return { ok: false, migrated, reason: result.reason };
    migrated++;
  }
  return { ok: true, migrated };
}
