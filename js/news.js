// news.js — the NEWS reader. SPEC §11b.
//
// The owner (2026-09-02): *"i'd like a news button, something where you can
// read the updates that pop up on the screen in a sequential order."*
//
// Why it was needed: a flash lives 2.6 s and `flash()` OVERWRITES itself, so
// a month that delivered four headlines showed exactly one — the last. Two
// answers, and this file is the second:
//   · ui.js now QUEUES a month's flashes instead of clobbering them;
//   · this is the archive — every dispatch the city ever made, oldest first,
//     with a cursor you step with ← → and a per-city read mark.
//
// `newsRows(world)` is the ONE implementation of the feed (§0.6, the
// `lotScore()` law): the News tab, the button's badge and the reader all read
// it, and it is `world.events.log` and NOTHING ELSE — the city's own record of
// what it said, kept where the city keeps it.
//
// It closes a bug that had been there since the Log tab was written. The
// advisor already logs a yearly REPORT line (tick.js), and setWorld() used to
// synthesize a SECOND one out of `world.history` on load — so every loaded
// city printed each year twice, once rich (halls, justice, the character
// line) and once thin, with two different net figures because the two were
// computed from different books. There is one narrator, and it is the richer
// one: the line the city actually said at the time.
//
// The read mark is `zoo.pref`.news[city] — this BROWSER's, never the city's.
// The sim must not know it exists (§0.4, the law the cheat obeys the other
// way round: a cheat is an OP because it changes the city; being caught up on
// the news changes nothing, so it is a preference).
//
//   newsRows(world) → [{ t, id, label, text, who, links, people, bad, good, flash, report }]
//                     (a row's NAME is keyOf() — its month and its words)
//   createNews(app) → { open, close, toggle, key, isOpen, unread, invalidate }

import { dateOf } from "./sim/tick.js";
import { TICKER_BAD, TICKER_GOOD, TICKER_FLASH } from "./sim/events.js";
import { legacyOf, personName } from "./sim/legacy.js";

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

/** The leading ALL-CAPS run — "KILLING", "TAX REVOLT", "FOX MARKET FAIR" — set in bold. */
const LEAD = /^([A-Z][A-Z0-9'’ ]*[A-Z0-9])(?=[ —:,.]|$)/;

/**
 * The feed, oldest first — the city's own event log, read where it lies, and
 * capped where the city caps it (tick.js keeps the last 400, save.js the last
 * 200, so a long city's founding years are GONE, not hidden). The log is
 * already in the order things happened, so this adds only the reading: the
 * month's label and which chip a row answers to. A row's identity is `keyOf()`
 * below, which is its words — never its place, and there is deliberately no
 * positional field here to tempt anyone back into naming rows by index.
 */
export function newsRows(world) {
  if (!world) return [];
  const rows = [];
  for (const e of world.events?.log || []) {
    const resolve = (values) => [...new Set((Array.isArray(values) ? values : []).map(Number)
      .filter((id) => Number.isInteger(id) && id >= 0 && (world.byId?.has(id) || legacyOf(world, id))))];
    const rawWho = Array.isArray(e.who) ? e.who : [];
    const rawLinks = Array.isArray(e.links) ? e.links : [];
    const who = resolve(rawWho);
    // Explicit link order follows printed mention order (important when two
    // citizens share a name); editorial who ids remain a stable set.
    const links = resolve([...rawLinks, ...rawWho]);
    rows.push({ t: e.t, id: e.id || "notice", text: String(e.line || ""), who, links });
  }
  rows.sort((a, b) => a.t - b.t); // stable: within a month the log's own order stands
  for (const r of rows) {
    r.label = dateOf(world, r.t).label;
    r.bad = TICKER_BAD.test(r.text);
    r.good = TICKER_GOOD.test(r.text);
    r.flash = TICKER_FLASH.test(r.text); // "the updates that pop up on the screen"
    r.report = /^REPORT /.test(r.text);  // the year's own summing-up, set quieter
    r.people = r.who.length > 0;
  }
  return rows;
}

/**
 * FNV-1a, 32-bit. A row's NAME is its month plus its own words — never its
 * place in the month. `save.js` keeps the last 200 log lines and tick.js caps
 * the live log at 400, so a roll can cut a month in HALF: the survivors of
 * that month would come back renamed 0,1,2… and every read mark in it would
 * point at the wrong dispatch. Two identical lines in one month share a name,
 * which is right — they are the same news.
 */
function fnv(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, "0");
}

export const keyOf = (r) => {
  // Preserve every historical non-people key byte-for-byte. Named rows add
  // subject identity so two citizens with identical printed words do not
  // share one browser read mark.
  const linked = r.links?.length ? r.links : r.who || [];
  const subject = linked.length ? `\0${r.id || "notice"}\0${linked.join(",")}` : "";
  return `${r.t}.${fnv(r.text + subject)}`;
};

export const FILTERS = [
  ["all", "all", () => true],
  ["flash", "headlines", (r) => r.flash],
  ["bad", "trouble", (r) => r.bad],
  ["good", "good", (r) => r.good],
  ["people", "people", (r) => r.people],
];

export function createNews(app) {
  const host = document.getElementById("news");
  let shown = false;
  let filter = "all";
  let rows = [];        // the whole feed
  let view = [];        // the feed under the current filter
  let cursor = 0;       // an index into `view`
  let read = new Set(); // keys of rows already read, this browser's
  let city = null;      // the city `read` belongs to
  let cache = null;     // { sig, rows }
  let listEl = null, countEl = null, headEl = null;

  // ---- the feed, memoised on (tick, log length, history length) -------------------------------
  function feed() {
    const w = app.world;
    if (!w) return [];
    const sig = `${w.tick}:${w.events?.log?.length || 0}:${w.history?.length || 0}`;
    if (!cache || cache.sig !== sig) cache = { sig, rows: newsRows(w) };
    return cache.rows;
  }

  // ---- the read mark -------------------------------------------------------------------------
  // A SET of row keys, not a high-water mark: under a filter you skip stories
  // on purpose, and a high-water mark would silently swallow every one you
  // stepped over. The set is pruned to the live feed on every write, so it is
  // bounded by the log's own cap (400 + one report a year).
  function loadRead() {
    city = app.cityName || "";
    const all = app.prefs.get().news || {};
    const saved = all[city];
    if (Array.isArray(saved)) { read = new Set(saved); return; }
    // First sight of this city in this browser: you start CAUGHT UP. A loaded
    // 40-year city must not open with a badge of 300 things you already lived.
    read = new Set(feed().map(keyOf));
    saveRead();
  }
  function saveRead() {
    const live = new Set(feed().map(keyOf));
    const keep = [];
    for (const k of read) if (live.has(k)) keep.push(k);
    read = new Set(keep);
    const all = { ...(app.prefs.get().news || {}) };
    all[city] = keep;
    app.prefs.set({ news: all });
  }

  /** The world changed under us (a load, an import, a new city). */
  function invalidate() { cache = null; loadRead(); }

  function unread() {
    if (city !== (app.cityName || "")) loadRead();
    let n = 0;
    for (const r of feed()) if (!read.has(keyOf(r))) n++;
    return n;
  }

  // ---- the box -------------------------------------------------------------------------------
  function pass(r) { return (FILTERS.find((f) => f[0] === filter) || FILTERS[0])[2](r); }

  function build() {
    rows = feed();
    view = rows.filter(pass);
    host.innerHTML = "";
    const box = el("div", "modalbox newsbox");

    const top = el("div", "newstop");
    top.append(el("h2", "", "NEWS"));
    const x = el("button", "", "×");
    x.title = "Esc closes";
    x.addEventListener("click", close);
    top.append(x);
    box.append(top);

    headEl = el("div", "dim newshead");
    box.append(headEl);

    const chips = el("div", "newschips");
    for (const [id, label, fn] of FILTERS) {
      const n = rows.filter(fn).length;
      const b = el("button", "chip" + (filter === id ? " on" : ""), `${label} ${n}`);
      b.title = id === "flash" ? "only the lines that popped up over the map" : id === "bad" ? "fires, floods, crime, the books" : id === "good" ? "milestones, fairs, festivals, homecomings" : id === "people" ? "dispatches naming citizens you can inspect" : "every dispatch, including the yearly report";
      b.addEventListener("click", () => { const at = view[cursor]; filter = id; build(); jumpNear(at); });
      chips.append(b);
    }
    box.append(chips);

    listEl = el("ul", "newsfeed");
    if (!view.length) listEl.append(el("li", "note", "Nothing under this filter yet. The months make the news."));
    for (let i = 0; i < view.length; i++) listEl.append(rowEl(view[i], i));
    box.append(listEl);

    const foot = el("div", "newsfoot");
    const prev = el("button", "", "◀ earlier");
    prev.addEventListener("click", () => step(-1));
    const next = el("button", "", "later ▶");
    next.addEventListener("click", () => step(1));
    countEl = el("span", "dim", "");
    const all = el("button", "", "mark all read");
    all.title = "clear the badge without stepping through them";
    all.addEventListener("click", () => { for (const r of rows) read.add(keyOf(r)); saveRead(); paint(); app.ui.refresh(); });
    foot.append(prev, countEl, next, all);
    box.append(foot);
    box.append(el("div", "note", "← → ↑ ↓ step one dispatch · PgUp PgDn ten · Home End · R or Esc closes · the clock is stopped while this is open"));

    host.append(box);
  }

  function rowEl(r, i) {
    const li = el("li", "nrow" + (r.bad ? " bad" : r.good ? " good" : "") + (r.report ? " report" : ""));
    li.dataset.i = String(i);
    li.append(el("span", "gut", ""));
    li.append(el("span", "when", r.label));
    const txt = el("span", "txt");
    const m = LEAD.exec(r.text);
    const lead = m?.[1] || "";
    if (lead) txt.append(el("b", "", lead));
    appendPeople(txt, r.text.slice(lead.length), r, i);
    li.append(txt);
    li.addEventListener("click", () => { cursor = i; markThrough(); paint(true); });
    return li;
  }

  /** Render links with textContent only: citizen names are data, never HTML. */
  function appendPeople(txt, words, row, rowIndex) {
    const links = row.links.map((id) => ({ id, name: personName(app.world, id) }))
      .filter((x) => x.name && x.name !== "someone");
    const groups = new Map();
    for (const link of links) {
      if (!groups.has(link.name)) groups.set(link.name, []);
      groups.get(link.name).push(link);
    }
    const consumed = new Map();
    const used = new Set();
    let at = 0;
    while (at < words.length) {
      let next = null;
      for (const [name, same] of groups) {
        const found = words.indexOf(name, at);
        if (found < 0 || (next && (found > next.at || (found === next.at && name.length <= next.name.length)))) continue;
        const n = consumed.get(name) || 0;
        const link = same.length === 1 ? same[0] : same[Math.min(n, same.length - 1)];
        next = { ...link, name, at: found };
      }
      if (!next) break;
      if (next.at > at) txt.append(words.slice(at, next.at));
      txt.append(personButton(next, rowIndex));
      used.add(next.id);
      consumed.set(next.name, (consumed.get(next.name) || 0) + 1);
      at = next.at + next.name.length;
    }
    if (at < words.length) txt.append(words.slice(at));
    const rest = links.filter((x) => !used.has(x.id));
    if (rest.length) {
      txt.append(" · ");
      for (let i = 0; i < rest.length; i++) {
        if (i) txt.append(", ");
        txt.append(personButton(rest[i], rowIndex));
      }
    }
  }

  function personButton(person, rowIndex) {
    const b = el("button", "person-link", person.name);
    b.type = "button";
    b.dataset.citizen = String(person.id);
    b.title = `Inspect ${person.name} and centre the map`;
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      if (app.pinCitizen?.(person.id)) {
        cursor = rowIndex;
        markThrough();
        close();
      }
    });
    return b;
  }

  /** Reading a dispatch marks THAT dispatch read — never the ones you skipped past. */
  function markThrough() {
    const r = view[cursor];
    if (r) read.add(keyOf(r));
  }

  function paint(scroll = true) {
    if (!listEl) return;
    const kids = listEl.querySelectorAll("li.nrow");
    for (let i = 0; i < kids.length; i++) {
      const r = view[i];
      kids[i].classList.toggle("at", i === cursor);
      kids[i].classList.toggle("unread", !read.has(keyOf(r)));
      kids[i].firstElementChild.textContent = !read.has(keyOf(r)) ? "●" : i === cursor ? "▸" : "";
    }
    if (countEl) countEl.textContent = view.length ? `${cursor + 1} of ${view.length}` : "—";
    if (headEl) {
      const u = unread();
      headEl.textContent = `${app.cityName || "this city"} · ${rows.length} dispatch${rows.length === 1 ? "" : "es"} · ${u ? `${u} unread` : "caught up"} · now ${dateOf(app.world).label}`;
    }
    if (scroll && kids[cursor]) kids[cursor].scrollIntoView({ block: "center" });
  }

  function step(d) {
    if (!view.length) return;
    cursor = Math.max(0, Math.min(view.length - 1, cursor + d));
    markThrough();
    paint();
  }

  /** Keep the reader near where it was when the filter changed. */
  function jumpNear(was) {
    if (!view.length) { cursor = 0; paint(false); return; }
    if (was) {
      let best = 0;
      for (let i = 0; i < view.length; i++) if (view[i].t <= was.t) best = i;
      cursor = best;
    } else cursor = firstUnread();
    markThrough();
    paint();
  }

  function firstUnread() {
    for (let i = 0; i < view.length; i++) if (!read.has(keyOf(view[i]))) return i;
    return Math.max(0, view.length - 1);
  }

  // ---- open / close --------------------------------------------------------------------------
  function open() {
    if (!app.world) return;
    if (city !== (app.cityName || "")) loadRead();
    cache = null;
    build();
    cursor = firstUnread();
    markThrough();
    paint();
    shown = true;
    host.hidden = false;
  }

  function close() {
    if (!shown) return;
    shown = false;
    host.hidden = true;
    saveRead();
    app.ui.refresh(); // the badge
  }

  function toggle() { if (shown) close(); else open(); }

  /** The reader owns the keyboard while it is up. Returns true if it took the key. */
  function key(e) {
    switch (e.code) {
      case "ArrowRight": case "Space": case "Enter": step(1); return true;
      case "ArrowLeft": step(-1); return true;
      case "ArrowDown": step(1); return true;
      case "ArrowUp": step(-1); return true;
      case "PageDown": step(10); return true;
      case "PageUp": step(-10); return true;
      case "Home": cursor = 0; markThrough(); paint(); return true;
      case "End": cursor = Math.max(0, view.length - 1); markThrough(); paint(); return true;
      case "KeyR": close(); return true;
      default: return false;
    }
  }

  host.addEventListener("click", (e) => { if (e.target === host) close(); }); // the scrim

  return { open, close, toggle, key, invalidate, unread, isOpen: () => shown, get cursor() { return view[cursor] || null; } };
}
