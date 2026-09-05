// dom-shim.mjs — just enough DOM to RUN js/ui.js in Node. SPEC §12.5.
//
// The panel was the largest surface in the game the suite had never executed.
// check.mjs only ever read `js/ui.js` as TEXT (two greps), so a card that
// threw was invisible to every gate we had — and one did: on a lot you had
// just zoned, `TIER_NAME[0]` was read eagerly, the throw landed inside the
// rAF frame, and the loop never rescheduled. The game froze. Nothing in 373
// checks could see it, because nothing called the function.
//
// So: elements are plain objects with the handful of properties ui.js uses —
// append / classList / textContent / innerHTML / style / dataset / value /
// addEventListener / querySelector / remove / focus / scrollTop / checked.
// `textOf(el)` walks the tree and returns what a player would read, which is
// what the checks assert on.
//
// This is a SHIM, not a browser: no layout, no events fired by itself, no CSS.
// It exists so a check can call `createUI(app)` and `updateHover(...)` for
// every tile state a city can hold and demand that none of them throw. What it
// cannot tell you is whether the card LOOKS right — that is still the browser
// round in the project's recipe (handoff §9).

import { installCanvas, createCanvas } from "./headless-canvas.mjs";

const SELF_ID = /^#([\w-]+)$/;

class ClassList {
  constructor() { this._s = new Set(); }
  add(...c) { for (const x of c) if (x) this._s.add(x); }
  remove(...c) { for (const x of c) this._s.delete(x); }
  toggle(c, on) { if (on === undefined) { if (this._s.has(c)) this._s.delete(c); else this._s.add(c); } else if (on) this._s.add(c); else this._s.delete(c); return this._s.has(c); }
  contains(c) { return this._s.has(c); }
  get value() { return [...this._s].join(" "); }
  toString() { return this.value; }
}

class El {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.classList = new ClassList();
    this.style = {};
    this.dataset = {};
    this.attrs = {};
    this._text = "";
    this.value = "";
    this.checked = false;
    this.scrollTop = 0;
    this.scrollHeight = 0;
    this.clientHeight = 0;
    this.listeners = new Map();
    this.disabled = false;
    this.title = "";
  }

  get className() { return this.classList.value; }
  set className(v) { this.classList = new ClassList(); for (const c of String(v).split(/\s+/)) this.classList.add(c); }

  get id() { return this.attrs.id || ""; }
  set id(v) { this.attrs.id = v; }

  get elements() { return this.children.filter((c) => typeof c !== "string"); }
  get firstElementChild() { return this.elements[0] || null; }
  get lastElementChild() { const e = this.elements; return e[e.length - 1] || null; }
  get childNodes() { return this.children; }
  get parentElement() { return this.parentNode; }

  get textContent() {
    if (!this.children.length) return this._text;
    return this.children.map((c) => (typeof c === "string" ? c : c.textContent)).join("");
  }
  set textContent(v) { this.children.length = 0; this._text = v == null ? "" : String(v); }

  get innerHTML() { return this.textContent; }
  set innerHTML(v) { this.children.length = 0; this._text = v == null ? "" : String(v); } // ui.js only ever clears with ""

  append(...kids) {
    for (const k of kids) {
      if (k == null) continue;
      if (typeof k !== "string") k.parentNode = this;
      this.children.push(k);
    }
  }
  appendChild(k) { this.append(k); return k; }
  insertBefore(k, ref) {
    const at = ref ? this.children.indexOf(ref) : -1;
    if (typeof k !== "string") k.parentNode = this;
    if (at < 0) this.children.push(k); else this.children.splice(at, 0, k);
    return k;
  }
  replaceChildren(...kids) { this.children.length = 0; this._text = ""; this.append(...kids); }
  remove() {
    const p = this.parentNode;
    if (!p) return;
    const at = p.children.indexOf(this);
    if (at >= 0) p.children.splice(at, 1);
    this.parentNode = null;
  }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === "class") this.className = v; }
  getAttribute(k) { return this.attrs[k] ?? null; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(fn); }
  removeEventListener(type, fn) { const a = this.listeners.get(type); if (a) a.splice(a.indexOf(fn) >>> 0, 1); }
  /** Fire a handler the way a click would — for a check that wants to press a button. */
  dispatch(type, ev = {}) { for (const fn of this.listeners.get(type) || []) fn({ type, target: this, preventDefault() {}, stopPropagation() {}, ...ev }); }
  focus() {}
  blur() {}
  select() {}
  scrollIntoView() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }; }
  getContext() { return null; }

  /** Depth-first search over the tree by "#id", ".class", "tag" or "tag.class". */
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  querySelectorAll(sel) {
    const out = [];
    const want = (e) => {
      if (sel.startsWith("#")) return e.id === sel.slice(1);
      if (sel.startsWith(".")) return e.classList.contains(sel.slice(1));
      const dot = sel.indexOf(".");
      if (dot > 0) return e.tagName === sel.slice(0, dot).toUpperCase() && e.classList.contains(sel.slice(dot + 1));
      return e.tagName === sel.toUpperCase();
    };
    const walk = (e) => { for (const c of e.children) { if (typeof c === "string") continue; if (want(c)) out.push(c); walk(c); } };
    walk(this);
    return out;
  }
}

/** Everything a player would read off this element, in order, one line per block. */
export function textOf(node) {
  if (node == null) return "";
  if (typeof node === "string") return node;
  if (!node.children.length) return node._text || "";
  return node.children.map(textOf).join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Install a document carrying the ids `createUI` looks up, plus any extra ids
 * a caller names. Idempotent, like tools/headless-canvas.mjs's installCanvas.
 * Returns { document, byId } so a check can read the panel back.
 */
export function installDom(ids = []) {
  if (globalThis.document && globalThis.document.__shim) return globalThis.document;
  // The canvas shim installs a `document` of its own with nothing but
  // createElement('canvas'). Whichever of the two runs first must not lock the
  // other out: install that one, then REPLACE its document with this richer
  // one whose createElement still hands back a real canvas. (installCanvas
  // also defines globalThis.ImageData, which js/render.js needs.)
  installCanvas();
  const root = new El("body");
  const byId = new Map();
  const make = (id) => { const e = new El("div"); e.id = id; byId.set(id, e); root.append(e); return e; };
  for (const id of ["strip", "tools", "usePicker", "cost", "clock", "flash", "bars", "stats", "banner", "card", "tabs", "tabBody", "help", "choice", "news", "newcity", "panel", "map", "reader", "readerBody", "portBox", "savesList", ...ids]) make(id);
  const doc = {
    __shim: true,
    body: root,
    documentElement: root,
    createElement: (tag) => (String(tag).toLowerCase() === "canvas" ? createCanvas(1, 1) : new El(tag)),
    createTextNode: (t) => String(t),
    querySelector: (sel) => {
      const m = SELF_ID.exec(sel);
      if (m && byId.has(m[1])) return byId.get(m[1]);
      return root.querySelector(sel);
    },
    querySelectorAll: (sel) => root.querySelectorAll(sel),
    getElementById: (id) => byId.get(id) || null,
    addEventListener() {},
    removeEventListener() {},
    activeElement: null,
    hidden: false,
    visibilityState: "visible",
  };
  globalThis.document = doc;
  if (!globalThis.window) globalThis.window = { addEventListener() {}, removeEventListener() {}, matchMedia: () => ({ matches: false, addEventListener() {} }), devicePixelRatio: 1 };
  if (!globalThis.requestAnimationFrame) globalThis.requestAnimationFrame = () => 0;
  if (!globalThis.performance) globalThis.performance = { now: () => 0 };
  return doc;
}

export { El };

/**
 * The `app` object `createUI` codes against, stubbed — every field ui.js
 * reads, and nothing else. `world` is the only one that carries real data;
 * the rest answer so the panel can be built and refreshed. A check that wants
 * to see what a button DOES can override the stub it calls.
 */
export function stubApp(world, over = {}) {
  const noop = () => {};
  return {
    world,
    cityName: "check-city",
    paused: true,
    speed: 1,
    entered: true,
    cheat: false,
    overlays: "off",
    storageWarning: "",
    unsavedExport: "",
    camera: { x: 0, y: 0, zoom: 1 },
    prefs: { get: () => ({ cheat: false, stars: {}, read: {} }), set: noop, all: () => ({}) },
    input: { tool: "R", setTool: noop, state: { tool: "R" }, hover: () => null, hoverInfo: () => null },
    title: { isOpen: () => false, open: noop, close: noop, say: noop },
    news: { isOpen: () => false, toggle: noop, close: noop, invalidate: noop, unread: () => 0 },
    pinCitizen: () => false,
    doOp: () => ({ ok: true, cost: 0 }),
    undo: () => ({ ok: true }),
    save: () => ({ ok: true }),
    saveAs: () => ({ ok: true }),
    load: () => ({ ok: true }),
    loadSlot: () => ({ ok: true }),
    deleteSlot: () => ({ ok: true }),
    slots: () => [],
    slotText: () => "",
    storageUsage: () => ({ used: 0, free: 5e6, slots: 0 }),
    exportText: () => "{}",
    importText: () => ({ ok: true }),
    newCity: noop,
    setSpeed: noop,
    togglePause: noop,
    resume: noop,
    cycleOverlay: noop,
    zoomAt: noop,
    ...over,
  };
}
