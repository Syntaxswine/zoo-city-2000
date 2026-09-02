// main.js — boot and the clock. SPEC §1 (cadence), §15 (saves).
//
// THE STEP IS NEVER SCALED, ONLY THE NUMBER OF STEPS: real time accumulates
// and whole ticks are stepped — speed 1 = one tick per 1.5 s, ×3, ×10, pause;
// catch-up is capped at 3 ticks a frame so a background tab does not lurch.
// The rAF loop draws every frame. Two slots per city (round-3 play-test: the
// autosave used to overwrite the S save, so L at year 12 gave year 12):
//   zoo.city:<name>  the S save — a CHECKPOINT; only S and the list write it
//   zoo.auto:<name>  the autosave — every 12 ticks, on pagehide, on hide
// `zoo.last` remembers which city to reopen; boot resumes the newer of the
// two. A loaded or resumed city opens PAUSED (its speed kept in
// zoo.meta:<name>) so a month cannot pass before the panel is read.

import { createWorld } from "./sim/world.js";
import { tick, dateOf } from "./sim/tick.js";
import { apply, undo } from "./sim/ops.js";
import { save, load } from "./sim/save.js";
import { computeFields, recountRosters } from "./sim/fields.js";
import { art } from "./art/index.js";
import { toScreen, HALF_H } from "./iso/iso.js";
import { createRenderer } from "./render.js";
import { createWalkers } from "./walkers.js";
import { createInput } from "./input.js";
import { createUI } from "./ui.js";

const TICK_SECONDS = 1.5;
const SPEEDS = [1, 3, 10];
const MAX_CATCHUP = 3;
const AUTOSAVE_EVERY = 12;
const OVERLAYS = ["off", "lv", "pol", "crime", "dread", "score"];
const KEY = (name) => `zoo.city:${name}`;
const AUTO = (name) => `zoo.auto:${name}`;
const META = (name) => `zoo.meta:${name}`;
const LAST = "zoo.last";

const canvas = document.getElementById("map");
const app = {
  world: null,
  cityName: "",
  camera: { x: 0, y: 0, zoom: 1 },
  speed: 1,
  paused: false,
  overlays: "off",
  art,
  renderer: null,
  walkers: null,
  input: null,
  ui: null,
  acc: 0,
  sinceSave: 0,
};

// ---- storage (guarded: private windows throw) ---------------------------------
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
  keys() { try { return Object.keys(localStorage); } catch { return []; } },
};

// ---- world lifecycle -------------------------------------------------------------
function centreOn(tx, ty) {
  const [sx, sy] = toScreen(tx, ty);
  app.camera.x = sx;
  app.camera.y = sy + HALF_H;
}

function adopt(world, name, { paused = false } = {}) {
  app.world = world;
  app.cityName = name;
  app.acc = 0;
  app.sinceSave = 0;
  app.paused = paused;
  // A found city has no derived fields until its first month (roadDist, LV,
  // pollution are rebuilt at tick step 1) — the first hover card a new mayor
  // read said "LV 0 road 0" for a tile beside the road. Compute them now; they
  // are derived, never saved, never hashed, and the tick recomputes them.
  if (!world.last) { computeFields(world); recountRosters(world); }
  if (app.renderer) app.renderer.setWorld(world);
  if (app.walkers) app.walkers.setWorld(world);
  if (app.input) app.input.unpin();
  if (app.ui) app.ui.setWorld();
  // The start road is an EDGE road by design, so centring on it puts half a
  // screen of void on the map side of nothing. Look 6 tiles inward from the
  // stub toward the middle of the map: the road stays in view, the ground
  // the mayor will zone fills the rest.
  const inX = Math.sign(world.w / 2 - world.start.tx);
  const inY = Math.sign(world.h / 2 - world.start.ty);
  centreOn(world.start.tx + 6 * inX, world.start.ty + 6 * inY);
  if (app.walkers) app.walkers.notify();
  if (world.events.choice) { app.paused = true; app.ui.showChoice(); }
  store.set(LAST, name);
  document.title = `ZOO CITY 2000 — ${name}`;
}

app.newCity = ({ seed, noDisasters }) => {
  const world = createWorld({ seed });
  if (noDisasters) apply(world, { kind: "toggle", key: "noDisasters", value: true });
  adopt(world, String(seed));
  app.ui.flash(`${seed}: one road in. Zone R, C and I within 3 tiles of it. 8% is neutral for a town this size.`);
};

app.doOp = (op) => {
  const res = apply(app.world, op);
  if (res.ok) {
    app.renderer.invalidate();
    app.walkers.notify();
    app.ui.refresh();
    // ops.js reports what a tile op did to people and chalk: a road over
    // empty zoned lots unzones them (no refund; Z undoes), and a bulldoze
    // that turns animals out is not undoable (undo restores tiles, never people).
    const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
    if (res.evicts) app.ui.flash(`Bulldozed ${n(res.evicts, "lot", "lots")} with animals in ${res.evicts === 1 ? "it" : "them"} — they must move or find work again; this cannot be undone.`);
    else if (res.replaced) app.ui.flash(`Road laid over ${n(res.replaced, "zoned lot", "zoned lots")} — the zoning is gone, no refund (Z undoes).`);
  } else if (res.reason && res.reason !== "nothing to do") {
    app.ui.flash(res.reason === "insufficient funds" ? `§${res.cost.toLocaleString()} — cannot afford` : res.reason);
  }
  return res;
};

app.undo = () => {
  const r = undo(app.world);
  if (r.ok) { app.renderer.invalidate(); app.walkers.notify(); app.ui.refresh(); app.ui.flash("Undone and refunded."); }
  else app.ui.flash(r.reason === "nothing to undo" ? "Nothing to undo (a bulldoze that turned animals out cannot be undone)." : r.reason || "Nothing to undo.");
};

/** S (auto=false) writes the checkpoint slot; the clock (auto=true) writes the autosave slot. */
app.save = (name = app.cityName, quiet = false, auto = false) => {
  const ok = store.set(auto ? AUTO(name) : KEY(name), save(app.world));
  store.set(META(name), JSON.stringify({ speed: app.speed, paused: app.paused, at: Date.now() }));
  if (!quiet) app.ui.flash(ok ? `Saved "${name}" at ${dateOf(app.world).label} — L reloads this checkpoint (autosave is separate).` : "Save failed — storage unavailable.");
  if (ok) { store.set(LAST, name); if (!auto) app.sinceSave = 0; }
  return ok;
};

function readSlot(key) {
  const json = store.get(key);
  if (!json) return null;
  try { return { json, tick: JSON.parse(json).tick }; } catch { return null; }
}

/** Adopt a saved city paused, at its saved speed. `what` names the slot for the flash. */
function adoptSaved(json, name, what) {
  const world = load(json);
  const meta = (() => { try { return JSON.parse(store.get(META(name)) || "null"); } catch { return null; } })();
  if (meta && SPEEDS.includes(meta.speed)) app.speed = meta.speed;
  adopt(world, name, { paused: true });
  if (!world.events.choice) app.ui.flash(`${what} "${name}" — ${dateOf(world).label}, paused; Space resumes.`);
  return true;
}

/** L: the checkpoint S wrote — never the autosave. */
app.load = (name = app.cityName) => {
  const slot = readSlot(KEY(name));
  if (!slot) {
    app.ui.flash(store.get(AUTO(name)) ? `No checkpoint for "${name}" yet — S saves one (the autosave only resumes a reload).` : `No save named "${name}".`);
    return false;
  }
  try { return adoptSaved(slot.json, name, "Loaded"); } catch (e) { app.ui.flash(`Load failed: ${e.message}`); return false; }
};

/** Resume the autosave slot (the list's "resume" button; boot when it is newer). */
app.resumeAuto = (name = app.cityName) => {
  const slot = readSlot(AUTO(name));
  if (!slot) { app.ui.flash(`No autosave of "${name}".`); return false; }
  try { return adoptSaved(slot.json, name, "Resumed the autosave of"); } catch (e) { app.ui.flash(`Resume failed: ${e.message}`); return false; }
};

app.savedCities = () => {
  const rows = new Map();
  const row = (name) => { if (!rows.has(name)) rows.set(name, { name, when: name === app.cityName ? "current" : "" }); return rows.get(name); };
  const describe = (json) => {
    try {
      const o = JSON.parse(json);
      return { tick: o.tick, date: dateOf({ tick: o.tick }).label, pop: o.citizens.length };
    } catch { return { tick: 0, date: "?", pop: "?", unreadable: true }; }
  };
  for (const k of store.keys()) {
    if (k.startsWith("zoo.city:")) row(k.slice("zoo.city:".length)).saved = describe(store.get(k));
    else if (k.startsWith("zoo.auto:")) row(k.slice("zoo.auto:".length)).auto = describe(store.get(k));
  }
  return [...rows.values()].sort((a, b) => a.name.localeCompare(b.name));
};
app.deleteCity = (name) => { store.del(KEY(name)); store.del(AUTO(name)); store.del(META(name)); };
app.exportText = () => save(app.world);
app.importText = (text) => {
  const world = load(text.trim());
  const name = `${world.seed}-import`;
  adopt(world, name);
  app.ui.flash(`Imported as "${name}".`);
};

// ---- clock ------------------------------------------------------------------------------
// The speed keys only set the speed; they never resume a pause (a paused
// game stays paused until Space / the pause button — the clock says so).
app.setSpeed = (dir) => {
  const i = SPEEDS.indexOf(app.speed);
  app.speed = SPEEDS[Math.max(0, Math.min(SPEEDS.length - 1, i + dir))];
  app.ui.refresh();
  if (app.paused) app.ui.flash(`Speed ×${app.speed} — still paused; Space resumes.`);
};
app.togglePause = () => {
  if (app.world.events.choice) { app.ui.showChoice(); return; }
  app.paused = !app.paused;
  app.ui.refresh();
};
app.resume = () => { app.paused = false; app.ui.refresh(); };
app.cycleOverlay = () => {
  app.overlays = OVERLAYS[(OVERLAYS.indexOf(app.overlays) + 1) % OVERLAYS.length];
  app.ui.flash(app.overlays === "off" ? "Overlay off" : { lv: "Overlay: land value (greener = higher)", pol: "Overlay: pollution (browner = worse)", crime: "Overlay: crime (redder = worse; blue = police cover; a ring = an open file)", dread: "Overlay: dread (wine = a meat hall's smell; herbivores keep away)", score: "Overlay: lot score (blue grows, red decays)" }[app.overlays]);
  app.ui.refresh();
};
app.zoomAt = (dir, sx, sy) => {
  const z = dir > 0 ? 2 : 1;
  if (z === app.camera.zoom) return;
  // Keep the point under the cursor (or the centre) fixed.
  const v = app.renderer.view;
  const px = sx == null ? app.camera.x : sx / v.zoom + v.left;
  const py = sy == null ? app.camera.y : sy / v.zoom + v.top;
  const cw = canvas.width, ch = canvas.height;
  const fx = sx == null ? 0.5 : sx / cw;
  const fy = sy == null ? 0.5 : sy / ch;
  app.camera.zoom = z;
  app.camera.x = px - (fx - 0.5) * (cw / z);
  app.camera.y = py - (fy - 0.5) * (ch / z);
  app.ui.refresh();
};

function stepTick() {
  const { notices } = tick(app.world);
  app.renderer.invalidate();
  app.walkers.notify();
  app.ui.onTick(notices);
  if (app.world.events.choice) { app.paused = true; app.ui.showChoice(); }
  if (++app.sinceSave >= AUTOSAVE_EVERY) { app.sinceSave = 0; app.save(app.cityName, true, true); }
}

/** Console / verifier hook: step n whole months now (the same path the clock uses). */
app.advance = (n = 1) => { for (let k = 0; k < n; k++) stepTick(); return app.world.tick; };

function clampCamera() {
  const w = app.world;
  const [minX] = toScreen(0, w.h);
  const [maxX] = toScreen(w.w, 0);
  const maxY = toScreen(w.w, w.h)[1];
  app.camera.x = Math.max(minX, Math.min(maxX, app.camera.x));
  app.camera.y = Math.max(0, Math.min(maxY, app.camera.y));
}

let last = performance.now();
let hoverAt = 0;
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  if (!app.paused && !app.ui.modalOpen()) {
    app.acc += dt;
    const step = TICK_SECONDS / app.speed;
    let n = 0;
    while (app.acc >= step && n < MAX_CATCHUP) { app.acc -= step; stepTick(); n++; }
    if (n === MAX_CATCHUP) app.acc = 0;
  }
  app.input.update(dt);
  clampCamera();
  const wdt = app.paused ? 0 : dt * Math.min(app.speed, 3);
  app.walkers.update(wdt, app.renderer.viewportTiles());
  app.renderer.draw(app.camera, app.input.hover(), app.walkers, app.overlays, dt);
  if (now - hoverAt > 90) { hoverAt = now; app.ui.updateHover(app.input.hoverInfo()); }
  requestAnimationFrame(frame);
}

// ---- boot ----------------------------------------------------------------------------------
function boot() {
  const lastName = store.get(LAST);
  // Resume the newer of the two slots (the autosave is usually ahead of the
  // checkpoint; a fresh S save after a resume is the newer one).
  let slot = null;
  let what = "";
  if (lastName) {
    const saved = readSlot(KEY(lastName));
    const auto = readSlot(AUTO(lastName));
    if (auto && (!saved || auto.tick > saved.tick)) { slot = auto; what = "Resumed the autosave of"; }
    else if (saved) { slot = saved; what = "Loaded"; }
  }
  let world = null;
  let name = lastName || "zoo";
  if (slot) { try { world = load(slot.json); } catch { world = null; } }
  if (!world) { name = "zoo"; world = createWorld({ seed: name }); }
  app.world = world;
  app.cityName = name;
  app.renderer = createRenderer(canvas, world, art);
  app.walkers = createWalkers(world);
  app.ui = createUI(app);
  app.input = createInput(canvas, app);
  if (world.tick > 0 || slot) {
    const meta = (() => { try { return JSON.parse(store.get(META(name)) || "null"); } catch { return null; } })();
    if (meta && SPEEDS.includes(meta.speed)) app.speed = meta.speed;
    adopt(world, name, { paused: true });
    if (!world.events.choice) app.ui.flash(`${what} "${name}" — ${dateOf(world).label}, paused; Space resumes.`);
  } else {
    adopt(world, name);
    app.ui.openNewCity();
  }
  window.addEventListener("resize", () => app.renderer.resize());
  window.addEventListener("pagehide", () => app.save(app.cityName, true, true));
  document.addEventListener("visibilitychange", () => { if (document.hidden) app.save(app.cityName, true, true); });
  requestAnimationFrame((t) => { last = t; frame(t); });
}

boot();
window.zoo = app; // for the console and the verifier
