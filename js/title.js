// title.js — the title screen and the pause menu. SPEC §11 (the title screen).
//
// One full-window overlay over the map: the owner's painting, the name in
// letter-spaced type over the dark sky, five buttons on a parchment bar
// along the bottom (NEW GAME · CONTINUE · LOAD · SAVE · OPTIONS) and one
// card for the panels. It opens at boot over whatever boot resumed, and
// from the game on Esc or the strip's "menu". While it stands the clock is
// stopped (ui.modalOpen() counts it) and the map is not drawn.
//
// OPTIONS holds the cheat. The checkbox is a preference of this browser
// (zoo.pref — never a field of the city) that UNLOCKS a GIVE ME CASH
// button, here and beside the treasury. Every press is an op,
// { kind: "cheat" }: budget.post books it under "cheat", the input log
// records it, the suite replays it — the same law as a zoning drag. The
// Budget tab's ledger says how much of the treasury came that way.
//
// The panels are the new-city dialog's own builders (ui.js foundForm /
// savesPanel), so the N key and the title never drift apart. SAVE and LOAD
// are two doors into that one panel: the name field and the slot list.

import { dateOf } from "./sim/tick.js";
import { KNOBS } from "./sim/rules.js";

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const money = (v) => `§${Math.round(v).toLocaleString()}`;

export function createTitle(app) {
  const root = document.getElementById("title");
  let shown = false;
  let panel = null; // null | "new" | "saves" | "options"
  let bootCity = null; // { name, tick, slot } while the boot-time title stands: what CONTINUE resumes
  let said = null; // the last line a flash routed here while the painting covered #flash

  // ---- the frame: mast, card, bar -------------------------------------------------
  const mast = el("div", "mast");
  mast.append(el("h1", "", "ZOO CITY 2000"), el("div", "tag", "where animals live and grow together"));
  const card = el("div", "modalbox wide tcard");
  card.hidden = true;
  const bar = el("div", "tbar");
  const menu = el("nav", "tmenu");
  const note = el("div", "tnote");
  const foot = el("div", "tfoot", "Esc returns here · MIT");
  bar.append(menu, note, foot);
  root.append(mast, card, bar);

  const buttons = {};
  const mk = (id, label, fn) => {
    const b = el("button", "", label);
    b.addEventListener("click", fn);
    menu.append(b);
    buttons[id] = b;
    return b;
  };
  mk("new", "New game", () => showPanel("new"));
  mk("continue", "Continue", () => close());
  mk("load", "Load", () => app.load());
  mk("save", "Save", () => app.save());
  mk("options", "Options", () => showPanel("options"));

  const cityLine = () => {
    const w = app.world;
    return `"${app.cityName}" — ${dateOf(w).label} · ${w.citizens.length.toLocaleString()} animals · ${money(w.cash)}`;
  };

  /** Enable what applies and say what CONTINUE would do. */
  function renderMenu() {
    const inPlay = !!app.entered;
    buttons.continue.disabled = !inPlay;
    buttons.save.disabled = !inPlay;
    buttons.continue.title = inPlay ? "back to the map (Esc)" : "no city yet — NEW GAME founds one, LOAD reopens a saved one";
    buttons.load.title = "load, delete, export or import a named save";
    buttons.save.title = inPlay ? "write a new named save of this city" : "nothing to save yet";
    for (const b of Object.values(buttons)) b.classList.remove("primary");
    (inPlay ? buttons.continue : buttons.new).classList.add("primary");
    if (!inPlay) note.textContent = "No city yet. NEW GAME founds one; LOAD reopens a saved city or imports one.";
    else if (bootCity && bootCity.name === app.cityName && bootCity.tick === app.world.tick) note.textContent = `Continue loads “${bootCity.slot}” from ${cityLine()}`;
    else note.textContent = `${cityLine()} · Continue returns to the map`;
  }

  /** A flash while the painting stands: the bar's note line carries it, and close() re-flashes it on the map. */
  function say(msg) {
    note.textContent = msg;
    said = msg;
  }

  // ---- the panels -----------------------------------------------------------------------
  function backRow() {
    const row = el("div", "btnrow");
    const b = el("button", "", "back");
    b.addEventListener("click", hidePanel);
    row.append(b);
    card.append(row);
  }
  function hidePanel() {
    panel = null;
    card.hidden = true;
    card.innerHTML = "";
    renderMenu();
  }
  function showPanel(which, focus = "list") {
    panel = which;
    card.innerHTML = "";
    card.hidden = false;
    if (which === "new") {
      card.append(el("h2", "", "A new city"));
      const seed = app.ui.foundForm(card, close);
      backRow();
      seed.focus();
      seed.select();
    } else if (which === "saves") {
      app.ui.savesPanel(card, close, () => showPanel("saves", focus), focus);
      backRow();
    } else {
      card.append(el("h2", "", "Options"));
      optionsPanel(card);
      backRow();
    }
  }

  function optionsPanel(box) {
    // The cheat: a preference that unlocks the button; each press an op.
    const row = el("div", "row");
    const cb = el("input");
    cb.type = "checkbox";
    cb.id = "optCheat";
    cb.checked = !!app.prefs.get().cheat;
    const lab = el("label", "", " Cheats — unlock a GIVE ME CASH button");
    lab.htmlFor = cb.id;
    row.append(cb, lab);
    box.append(row);
    const give = el("div", "row");
    const btn = el("button", "primary", `GIVE ME ${money(KNOBS.CHEAT_CASH)}`);
    const now = el("span", "dim", "");
    give.append(btn, now);
    box.append(give);
    box.append(el("p", "note", `The button appears beside the treasury too. Each press books ${money(KNOBS.CHEAT_CASH)} in the ledger under "cheat" and goes into the city's input log like any other op, so the Budget tab always says how much of the treasury came that way. The switch is this browser's, not the city's.`));
    const sync = () => {
      give.hidden = !cb.checked;
      btn.disabled = !app.entered;
      btn.title = app.entered ? "post the cash now (logged as an op)" : "found or load a city first";
      now.textContent = app.entered ? ` treasury ${money(app.world.cash)}${app.world.ledger.cheat ? ` · ${money(app.world.ledger.cheat)} of it cheat money` : ""}` : "";
    };
    cb.addEventListener("change", () => { app.prefs.set({ cheat: cb.checked }); app.ui.refresh(); sync(); });
    btn.addEventListener("click", () => { app.cheat(); sync(); });
    sync();

    // Disasters, per city: the same toggle op the found form uses, so it is saved and logged.
    const row2 = el("div", "row");
    const nd = el("input");
    nd.type = "checkbox";
    nd.id = "optNoDisasters";
    nd.checked = !!(app.entered && app.world.events.noDisasters);
    nd.disabled = !app.entered;
    const ndl = el("label", "", " No disasters in this city (masks fire, flood, tornado, smog, revolt, recession)");
    ndl.htmlFor = nd.id;
    nd.addEventListener("change", () => app.doOp({ kind: "toggle", key: "noDisasters", value: nd.checked }));
    row2.append(nd, ndl);
    box.append(row2);
    box.append(el("p", "note", app.entered ? "Saved with the city and written to its input log." : "Found or load a city to set this; NEW GAME asks too."));
  }

  // ---- open / close ----------------------------------------------------------------------
  /** `boot` + the newest slot's name: the boot-time title over what boot found. */
  function open({ boot = false, slot = null } = {}) {
    if (shown) return;
    shown = true;
    said = null;
    bootCity = boot && app.entered ? { name: app.cityName, tick: app.world.tick, slot: slot || "city" } : null;
    if (app.input) app.input.unpin();
    if (app.ui) app.ui.setCost("");
    hidePanel();
    root.hidden = false;
    (app.entered ? buttons.continue : buttons.new).focus({ preventScroll: true });
  }

  function close() {
    if (!shown || !app.entered) return;
    shown = false;
    panel = null;
    card.hidden = true;
    root.hidden = true;
    const same = bootCity && bootCity.name === app.cityName && bootCity.tick === app.world.tick;
    const w = app.world;
    if (said) app.ui.flash(said);
    else if (same && !w.events.choice) app.ui.flash(`Loaded “${bootCity.slot}” from "${app.cityName}" — ${dateOf(w).label}, paused; Space resumes.`);
    bootCity = null;
    said = null;
    document.getElementById("map").focus({ preventScroll: true });
  }

  /** Esc: a panel goes back to the menu; the menu closes when a city is in play. */
  function back() {
    if (panel) hidePanel();
    else if (app.entered) close();
    else say("No city yet — NEW GAME founds one.");
  }

  return { open, close, back, say, showPanel, isOpen: () => shown };
}
