// main.js — boot and the clock. SPEC §1 (cadence), §15 (saves).
//
// THE STEP IS NEVER SCALED, ONLY THE NUMBER OF STEPS: real time accumulates
// and whole ticks are stepped — speed 1 = one tick per 1.5 s, ×3, ×10, pause;
// catch-up is capped at 3 ticks a frame so a background tab does not lurch.
// The rAF loop draws every frame. Named slots live under zoo.slot:<city>:<id>,
// indexed by zoo.slots:<city>; one autosave per city is overwritten every 12
// ticks, on pagehide and on hide. Old checkpoint/autosave keys are migrated
// without deletion. `zoo.last` remembers which city's newest slot to reopen.
// A loaded or resumed city opens PAUSED (its speed kept in
// zoo.meta:<name>) so a month cannot pass before the panel is read.
// The title screen (title.js) stands over whatever boot found — CONTINUE
// drops it; NEW GAME / LOAD / SAVE / OPTIONS are its buttons — and comes
// back on Esc. `zoo.pref` is this browser's preferences (the cheat switch,
// and which dispatches you have read), never part of a city: the cheat's
// button posts an op because it changes the city; being caught up on the news
// changes nothing, so it is a preference and the sim never hears of it.

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
import { createPalette } from "./palette.js";
import { createTitle } from "./title.js";
import { createNews } from "./news.js";
import { pinAndCentre } from "./person-link.js";
import { KNOBS } from "./sim/rules.js";
import { listSlots, listAllSlots, writeSlot, readSlot, deleteSlot, bytesUsed, migrate } from "./slots.js";

const TICK_SECONDS = 1.5;
const SPEEDS = [1, 3, 10];
const MAX_CATCHUP = 3;
const AUTOSAVE_EVERY = 12;
const OVERLAYS = ["off", "lv", "pol", "crime", "dread", "use", "access", "score"];
const META = (name) => `zoo.meta:${name}`;
const LAST = "zoo.last";
const PREF = "zoo.pref"; // UI preferences (the cheat switch, the news read marks) — this browser's, never the city's
const STORAGE_BUDGET = 5 * 1024 * 1024; // localStorage's usual floor; the menu labels this an estimate

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
  title: null,
  news: null,
  entered: false, // a city is in play behind the title (founded, loaded or resumed): CONTINUE, SAVE and the autosave need one
  acc: 0,
  sinceSave: 0,
  unsavedExport: null,
  storageWarning: null,
};

// ---- storage (guarded: private windows throw) ---------------------------------
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); return true; } catch { return false; } },
  keys() { try { return Object.keys(localStorage); } catch { return []; } },
};

// ---- preferences and the cheat ---------------------------------------------------
// zoo.pref is the browser's, not the city's: the cheat switch unlocks a
// button; each press is an op the city records (SPEC §8, §11).
app.prefs = {
  get() { try { return JSON.parse(store.get(PREF) || "{}") || {}; } catch { return {}; } },
  set(patch) { const p = { ...app.prefs.get(), ...patch }; store.set(PREF, JSON.stringify(p)); return p; },
};
app.cheat = () => {
  if (!app.prefs.get().cheat) { app.ui.flash("Cheats are off — Options (Esc) turns them on."); return { ok: false }; }
  const res = app.doOp({ kind: "cheat", amount: KNOBS.CHEAT_CASH });
  if (res.ok) app.ui.flash(`§${res.amount.toLocaleString()} of cheat money booked — the ledger says so.${res.notice ? ` ${res.notice}` : ""}`);
  return res;
};

// ---- world lifecycle -------------------------------------------------------------
function centreOn(tx, ty) {
  const [sx, sy] = toScreen(tx, ty);
  app.camera.x = sx;
  app.camera.y = sy + HALF_H;
}

/** One citizen-link action for News and every future named surface. */
app.pinCitizen = (id) => {
  return pinAndCentre(app, id);
};

function adopt(world, name, { paused = false } = {}) {
  app.world = world;
  app.cityName = name;
  app.entered = true;
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
    // empty zoned lots unzones them (no refund; Backspace undoes), and a bulldoze
    // that turns animals out is not undoable (undo restores tiles, never people).
    const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
    if (res.evicts) app.ui.flash(`Bulldozed ${n(res.evicts, "lot", "lots")} with animals in ${res.evicts === 1 ? "it" : "them"} — they must move or find work again; this cannot be undone.`);
    else if (res.replaced) app.ui.flash(`Road laid over ${n(res.replaced, "zoned lot", "zoned lots")} — the zoning is gone, no refund (Backspace undoes).`);
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

function rememberSave(name, json, result, manual) {
  if (result.ok) {
    store.set(META(name), JSON.stringify({ speed: app.speed, paused: app.paused, at: Date.now() }));
    store.set(LAST, name);
    if (manual) {
      app.unsavedExport = null;
      app.sinceSave = 0;
    }
  } else {
    // A quota failure must not strand the city in memory: the saves panel
    // immediately exposes exactly this JSON for copying somewhere safe.
    app.unsavedExport = json;
  }
  return { ...result, json };
}

/** Write a named manual slot for the current city, or replace one by id. */
app.saveAs = (slotName, replaceId = null) => {
  const json = save(app.world);
  return rememberSave(app.cityName, json, writeSlot(store, app.cityName, slotName, json, "manual", replaceId), true);
};

/** S opens the named-save panel. The clock calls the same entry point with auto=true. */
app.save = (name = app.cityName, quiet = false, auto = false) => {
  if (!auto) {
    app.title.open();
    app.title.showPanel("saves", "name");
    return { ok: true, panel: true };
  }
  const json = save(app.world);
  const result = rememberSave(name, json, writeSlot(store, name, "Autosave", json, "auto"), false);
  if (!quiet && !result.ok) app.ui.flash(`Autosave failed: ${result.reason}. Open SAVE to copy the city JSON.`);
  return result;
};

/** Adopt a saved city paused, at its saved speed. `what` names the slot for the flash. */
function adoptSaved(json, name, what) {
  const world = load(json);
  const meta = (() => { try { return JSON.parse(store.get(META(name)) || "null"); } catch { return null; } })();
  if (meta && SPEEDS.includes(meta.speed)) app.speed = meta.speed;
  adopt(world, name, { paused: true });
  if (!world.events.choice) app.ui.flash(`${what} "${name}" — ${dateOf(world).label}, paused; Space resumes.`);
  return true;
}

/** L opens the same saves panel as S, focused on its list. */
app.load = () => {
  app.title.open();
  app.title.showPanel("saves", "list");
  return true;
};

app.slots = (city = null) => city == null ? listAllSlots(store) : listSlots(store, city);
app.slotText = (city, id) => readSlot(store, city, id)?.json || "";
app.storageUsage = () => ({ used: bytesUsed(store), limit: STORAGE_BUDGET });
app.loadSlot = (city, id) => {
  const slot = readSlot(store, city, id);
  if (!slot) { app.ui.flash("That save no longer exists."); return false; }
  try { return adoptSaved(slot.json, city, `Loaded “${slot.name}” from`); }
  catch (e) { app.ui.flash(`Load failed: ${e.message}`); return false; }
};
app.deleteSlot = (city, id) => deleteSlot(store, city, id);
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
  app.ui.flash(app.overlays === "off" ? "Overlay off" : { lv: "Overlay: land value (greener = higher)", pol: "Overlay: pollution (browner = worse)", crime: "Overlay: crime (redder = worse; blue = police cover; a ring = an open file)", dread: "Overlay: dread (wine = a meat hall's smell; herbivores keep away)", use: "Overlay: use — rust is predator-only, teal is prey-only, untinted is mixed (U paints it)", access: "Overlay: road access — untinted is on the road, then sand, mauve and aubergine for one, two and three tiles from it; rust is out of reach, and only where something is asking", score: "Overlay: lot score (blue grows, red decays)" }[app.overlays]);
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
  if (++app.sinceSave >= AUTOSAVE_EVERY) {
    const result = app.save(app.cityName, true, true);
    if (result.ok) app.sinceSave = 0;
  }
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
let frameFaults = 0; // one throw used to end the game — see `frame` below

/**
 * ONE BAD FRAME MUST NOT END THE GAME. `requestAnimationFrame(frame)` is the
 * last line of the loop, so anything that threw above it — a card that read a
 * table row it did not have, a sprite that came back undefined — stopped the
 * loop for good: no ticks, no drawing, no input. It reads to a player as a
 * hang with nothing in the window to explain it, and it cost the owner a
 * session (a hover on a lot they had just zoned; handoff §23).
 *
 * So the body is guarded and the loop always reschedules. The fault is NOT
 * swallowed: the first few go to the console with their stack, and the player
 * is told once that the panel stumbled, so a real bug is still loud — it is
 * simply no longer fatal. The suite, not this catch, is what keeps the card
 * honest (check.mjs Part U' runs the real one over every tile state).
 */
function frame(now) {
  try {
    frameBody(now);
  } catch (e) {
    frameFaults++;
    if (frameFaults <= 5) console.error(`frame ${frameFaults}:`, e);
    if (frameFaults === 1 && app.ui) app.ui.flash("Something in the panel stumbled — the game keeps running; the console has it.");
  }
  requestAnimationFrame(frame);
}

function frameBody(now) {
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
  app.input.syncCamera(); // a clamp/zoom can move the world tile under a still Inspect cursor
  if (!app.title.isOpen()) { // the painting covers the map; nothing to draw under it
    const wdt = app.paused ? 0 : dt * Math.min(app.speed, 3);
    app.walkers.update(wdt, app.renderer.viewportTiles());
    app.renderer.draw(app.camera, app.input.hover(), app.walkers, app.overlays, dt);
    if (now - hoverAt > 90) { hoverAt = now; app.ui.updateHover(app.input.hoverInfo()); }
  }
}

// ---- boot ----------------------------------------------------------------------------------
function boot() {
  const migration = migrate(store);
  if (!migration.ok) app.storageWarning = `Legacy saves could not be copied: ${migration.reason}. They remain available directly below.`;
  const lastName = store.get(LAST);
  let slot = null;
  let what = null; // the named slot the title's CONTINUE names
  if (lastName) {
    const newest = listSlots(store, lastName)[0];
    if (newest) {
      slot = readSlot(store, lastName, newest.id);
      what = newest.name;
    }
  }
  let world = null;
  let name = lastName || "zoo";
  let resumed = false;
  if (slot) { try { world = load(slot.json); resumed = true; } catch { world = null; } }
  if (!world) { name = "zoo"; world = createWorld({ seed: name }); }
  app.world = world;
  app.cityName = name;
  app.renderer = createRenderer(canvas, world, art);
  app.walkers = createWalkers(world);
  app.ui = createUI(app);
  app.news = createNews(app); // after the UI: its close() refreshes the badge on the strip
  app.input = createInput(canvas, app);
  app.palette = createPalette(app);
  app.renderer.resize(); // the canvas measures its real box after the left remote is populated
  app.title = createTitle(app);
  if (resumed) {
    const meta = (() => { try { return JSON.parse(store.get(META(name)) || "null"); } catch { return null; } })();
    if (meta && SPEEDS.includes(meta.speed)) app.speed = meta.speed;
    adopt(world, name, { paused: true });
  } else {
    // A fresh default map behind the title, not in play until NEW GAME founds
    // one: CONTINUE and SAVE stay off, and no autosave of an untouched map
    // can shadow a real city.
    adopt(world, name);
    app.entered = false;
  }
  // The title stands over whatever boot found; its CONTINUE names the slot
  // and flashes the "paused; Space resumes" line when the map is actually seen.
  app.title.open({ boot: true, slot: what });
  const autosave = () => { if (app.entered) app.save(app.cityName, true, true); };
  window.addEventListener("resize", () => app.renderer.resize());
  window.addEventListener("pagehide", autosave);
  document.addEventListener("visibilitychange", () => { if (document.hidden) autosave(); });
  requestAnimationFrame((t) => { last = t; frame(t); });
}

boot();
window.zoo = app; // for the console and the verifier
