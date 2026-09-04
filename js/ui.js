// ui.js — the field-guide panel. SPEC §11 (hover card, bars, tabs), §10.
//
// Everything here is DOM: the tool strip, the three demand bars over the map,
// the date/cash/population/approval strip, the hover card, the four tabs
// (Rules · Budget · Census · News), the CHOICE card and the new-city dialog —
// whose builders (foundForm, savesPanel) the title screen
// (title.js) mounts on its own card. The cheat's button beside the treasury
// lives here too; the Options switch that unlocks it is title.js's.
// The card's WHY NOT line is `lotReport().score.reason` — the same
// `lotScore()` that decides growth, never a second implementation (§0.6).
// The News tab obeys the same law: it reads `newsRows(world)` (news.js), the
// feed the reader and the strip badge read, derived from the city's own event
// log — this panel keeps no second copy of it.
//
// A month can deliver four headlines and `flash()` used to overwrite itself,
// so three of them were never seen. `flashRun()` plays a month's run through
// one at a time and points at the reader for anything past FLASH_MAX.
//
//   createUI(app) → { refresh, onTick, setTool, setCost, flash, updateHover,
//                     showChoice, hideChoice, openNewCity, closeModals, modalOpen, setWorld }

import { ZONE, CIVIC, TERRAIN, ROAD, ZONE_NAME, USE_NAME, anchorOf } from "./sim/world.js";
import { dateOf, characterLine } from "./sim/tick.js";
import { eventTitle, TICKER_FLASH } from "./sim/events.js";
import { lotReport, REASON } from "./sim/lots.js";
import { exposure, asksAccess, nearReach } from "./sim/fields.js";
import { RULES, KNOBS } from "./sim/rules.js";
import { yearlyFigures } from "./sim/budget.js";
import { SPECIES, SPECIES_BY_ID } from "./sim/species.js";
import { pluralSpecies } from "./sim/landmarks.js";
import { ageYears, isWorker } from "./sim/census.js";
import { toolHelp } from "./tools.js";
import { newsRows } from "./news.js";
import { hallStock, hallYear } from "./sim/meat.js";
import { needOf } from "./sim/needs.js";
import { ACT, line as needLine } from "./sim/voice.js";
import { lifeLines, memorial } from "./sim/life.js";
import { legacyOf } from "./sim/legacy.js";
import { paintPortrait } from "./render.js";

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const money = (v) => `§${Math.round(v).toLocaleString()}`;
const f2 = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2);
const railShare = () => (KNOBS.RAIL_COST / KNOBS.WALK).toFixed(2);
const rideFactor = () => KNOBS.RIDE_SPEED.toFixed(1);
const pct = (v) => `${Math.round(v * 100)}%`;
const PLURAL = { mouse: "mice", fox: "foxes", tortoise: "tortoises" };
const plural = (n, s) => `${n} ${n === 1 ? s : PLURAL[s] || `${s}s`}`;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function createUI(app) {
  const world = () => app.world;
  const dom = {
    strip: $("#strip"),
    tools: $("#tools"),
    cost: $("#cost"),
    clock: $("#clock"),
    flash: $("#flash"),
    bars: $("#bars"),
    stats: $("#stats"),
    banner: $("#banner"),
    card: $("#card"),
    tabs: $("#tabs"),
    tabBody: $("#tabBody"),
    choice: $("#choice"),
    newcity: $("#newcity"),
    panel: $("#panel"),
    help: $("#help"),
  };
  let tab = "rules";
  let flashTimer = 0;
  let flashQ = [];      // the rest of this month's headlines, waiting their turn
  let newsStick = true; // the News tab follows the newest line unless you scroll up
  let newsJump = true;
  let lastHoverKey = "";

  // `world.last` is this month's census / demand / budget. The sim keeps it
  // current itself: tick() writes it, and refreshLast() (tick.js) rebuilds it
  // after a load / import and after a rate op — so the T terms, the income
  // lines and the header follow a stepper click at once, and a loaded city
  // reads complete. Only a brand-new map has no `last` before its first month.
  const neutralOf = (w) => (w.last ? w.last.demand.n : KNOBS.NEUTRAL_MAX);

  // The budget the panel prints is yearlyFigures() on the CURRENT state, not
  // `world.last.budget`: that one is booked at tick step 6, before step 7
  // expires events, so in the month a bear winter ends the header still
  // carried ×0.8 while the lines (scaled by the live event list) did not —
  // the play-tester saw UPKEEP 346 over lines summing to 432. One call, one
  // winter flag, and the rounded lines absorb their residual into the
  // largest so they sum to the header exactly. The strip's net/yr reads
  // the same figure.
  function liveBudget(w) {
    const fig = yearlyFigures(w);
    const winter = w.events.active.some((e) => e.id === "bearWinter");
    const k = winter ? 0.8 : 1;
    let tiers = 0;
    for (let i = 0; i < w.w * w.h; i++) tiers += w.tier[i];
    const raw = [
      ["animals", KNOBS.UPKEEP_CITIZEN * w.citizens.length], ["roads", KNOBS.UPKEEP_ROAD * fig.roads], ["bridges", KNOBS.UPKEEP_BRIDGE * fig.bridges],
      ["buildings", KNOBS.UPKEEP_TIER * tiers], ["parks", KNOBS.UPKEEP_PARK * fig.parks], ["zoos", KNOBS.UPKEEP_ZOO * fig.zoos],
      ["fire stations", KNOBS.UPKEEP_STATION * (fig.fireStations || 0)], ["police stations", KNOBS.UPKEEP_STATION * (fig.policeStations || 0)],
      ["pacification centres", KNOBS.UPKEEP_CENTRE * (fig.centres || 0)], ["licence inspectors", fig.licence ? KNOBS.UPKEEP_LICENCE * (fig.markets || 0) : 0],
      ["walls", KNOBS.UPKEEP_WALL * (fig.walls || 0)],
      ["rail", KNOBS.UPKEEP_RAIL * (fig.rails || 0)], ["stations", KNOBS.UPKEEP_STATION_RAIL * (fig.stations || 0)],
    ];
    const lines = raw.filter(([, v]) => v > 0).map(([name, v]) => [name, Math.round(v * k)]);
    const sum = lines.reduce((s, l) => s + l[1], 0);
    if (lines.length && sum !== fig.upkeepYr) {
      let big = lines[0];
      for (const l of lines) if (l[1] > big[1]) big = l;
      big[1] += fig.upkeepYr - sum;
    }
    return { fig, winter, lines, net: fig.incomeYr + (fig.cutYr || 0) - fig.upkeepYr };
  }

  // ---- the tool strip -----------------------------------------------------------------------
  function buildStrip() {
    dom.tools.innerHTML = "";
    const dens = el("button", "tool", "");
    dens.id = "density";
    dens.title = "H: density brush; Low caps a lot at one storey";
    dens.setAttribute("aria-label", "Density, key H. Toggle High or Low zoning density");
    dens.addEventListener("click", () => app.input.toggleDensity());
    dom.tools.append(dens);
    const use = el("button", "tool", "");
    use.id = "btnUse";
    use.title = "U: paint lots and roads mixed / predator-only / prey-only; press again to cycle";
    use.setAttribute("aria-label", "Use zoning, key U. Cycle mixed, predator-only or prey-only");
    use.addEventListener("click", () => app.input.setTool("use"));
    dom.tools.append(use);
    const sep = () => dom.tools.append(el("span", "sep", "·"));
    sep();
    const mk = (id, key, label, title, fn) => {
      const b = el("button", "tool", "");
      b.id = id;
      b.title = title;
      b.setAttribute("aria-label", `${label}. ${title}`);
      b.append(el("span", "key", key), " ", el("span", "", label));
      b.addEventListener("click", fn);
      dom.tools.append(b);
      return b;
    };
    mk("btnPause", "␣", "pause", "Space: pause / resume", () => app.togglePause());
    mk("btnSlower", ",", "slower", ", slower", () => app.setSpeed(-1));
    mk("btnFaster", ".", "faster", ". faster", () => app.setSpeed(1));
    sep();
    mk("btnUndo", "⌫", "undo", "Backspace or Ctrl+Z: undo the last op (this month only)", () => app.undo());
    mk("btnSave", "Ctrl+S", "save", "Ctrl+S: open named saves with the save-as name focused", () => app.save());
    mk("btnLoad", "L", "load", "L: open named saves on the slot list", () => app.load());
    mk("btnOverlay", "O", "overlay", "O: cycle land value / pollution / crime / dread / use / road access / lot score overlays", () => app.cycleOverlay());
    mk("btnNews", "R", "news", "R: the news — every dispatch this city ever made, oldest first; ← → step one at a time", () => app.news.toggle());
    mk("btnZoom", "+", "zoom", "+ / −: zoom ×1 / ×2", () => app.zoomAt(app.camera.zoom === 1 ? 1 : -1));
    sep();
    mk("btnNew", "N", "new city", "N: found a new city / load a saved one", () => openNewCity());
    mk("btnMenu", "Esc", "menu", "Esc: the title screen — new game, continue, load, save, options", () => app.title.open());
    dom.help.textContent = `${toolHelp()} · H density · U use · Space pause · , . speed · Backspace/Ctrl+Z undo · Ctrl+S save · L load · O overlays · R news · +/− zoom · arrows/WASD/right-drag pan · N new city · Esc menu`;
  }

  function setTool(id, density) {
    if (app.palette) app.palette.setTool(id);
    const d = $("#density");
    if (d) {
      d.innerHTML = "";
      d.append(el("span", "key", "H"), " ", el("span", "", density === 3 ? "High" : "Low"));
      d.classList.toggle("on", density === 1);
      d.setAttribute("aria-pressed", String(density === 1));
    }
    const ub = $("#btnUse");
    if (ub) {
      ub.innerHTML = "";
      ub.append(el("span", "key", "U"), " ", el("span", "", `Use: ${app.input ? ["mixed", "pred", "prey"][app.input.state.use] : "mixed"}`));
      ub.classList.toggle("on", id === "use");
      ub.setAttribute("aria-pressed", String(id === "use"));
    }
  }

  function setCost(text, refused = false) {
    dom.cost.textContent = text || "";
    dom.cost.classList.toggle("refused", !!refused);
  }

  // One message lives 2.6 s; a RUN of them gets 1.5 s each so a busy month
  // still fits under the player's attention. A user's own flash (a refused
  // op, a save) preempts the run — feedback on what you just did wins.
  const FLASH_ONE = 2600, FLASH_RUN = 1500, FLASH_MAX = 5;

  function show(msg, ms) {
    if (app.title && app.title.isOpen()) { app.title.say(msg); flashQ = []; return; } // the painting covers #flash; the title re-flashes it on close
    dom.flash.textContent = msg;
    dom.flash.classList.add("on");
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => {
      const next = flashQ.shift();
      if (next) { show(next[0], next[1]); return; }
      dom.flash.classList.remove("on");
    }, ms);
  }

  function flash(msg) { flashQ = []; show(msg, FLASH_ONE); }

  /** A month's headlines, in order. Before this they overwrote each other. */
  function flashRun(list) {
    if (!list.length) return;
    if (list.length === 1) { flash(list[0]); return; }
    const head = list.slice(0, FLASH_MAX);
    const rest = list.length - head.length;
    flashQ = [];
    for (let i = 1; i < head.length; i++) flashQ.push([`${head[i]}  (${i + 1}/${list.length})`, FLASH_RUN]);
    if (rest) flashQ.push([`+${rest} more this month — R opens the news`, FLASH_RUN]);
    show(`${head[0]}  (1/${list.length})`, FLASH_RUN);
  }

  function refreshClock() {
    const w = world();
    const d = dateOf(w);
    const sp = app.paused ? `paused (×${app.speed})` : `×${app.speed}`;
    dom.clock.textContent = `${d.label} · ${sp}${app.overlays !== "off" ? ` · overlay: ${app.overlays}` : ""}${app.camera.zoom === 2 ? " · ×2" : ""}`;
    const pauseBtn = $("#btnPause");
    pauseBtn.classList.toggle("on", app.paused);
    pauseBtn.lastElementChild.textContent = app.paused ? "resume" : "pause";
    pauseBtn.title = app.paused ? "Space: resume (the speed keys only set the speed while paused)" : "Space: pause";
    $("#btnOverlay").classList.toggle("on", app.overlays !== "off");
    $("#btnZoom").classList.toggle("on", app.camera.zoom === 2);
  }

  // The unread count rides on the button, and the button goes ink-filled while
  // any stands — the same "this is on" the pause / overlay / zoom buttons use.
  function refreshNews() {
    const b = $("#btnNews");
    if (!b || !app.news) return;
    const n = app.news.unread();
    b.lastElementChild.textContent = n ? `news ${n}` : "news";
    b.classList.toggle("on", n > 0);
    b.title = n ? `R: ${n} unread — every dispatch this city ever made, oldest first; ← → step one at a time` : "R: the news — every dispatch this city ever made, oldest first; ← → step one at a time";
  }

  // ---- demand bars ------------------------------------------------------------------------------
  function buildBars() {
    dom.bars.innerHTML = "";
    for (const z of ["R", "C", "I"]) {
      const col = el("div", "bar");
      col.dataset.zone = z;
      const track = el("div", "track");
      track.append(el("div", "zero"), el("div", "fill"), el("div", "tax"), el("div", "cap"));
      col.append(track, el("div", "lab", z));
      dom.bars.append(col);
    }
  }
  function refreshBars() {
    const w = world();
    const last = w.last;
    const n = neutralOf(w);
    for (const col of dom.bars.children) {
      const z = col.dataset.zone;
      const v = w.valves[z];
      const fill = $(".fill", col);
      const h = Math.abs(v) * 50;
      fill.style.height = `${h}%`;
      if (v >= 0) { fill.style.top = `${50 - h}%`; fill.classList.remove("neg"); } else { fill.style.top = "50%"; fill.classList.add("neg"); }
      const tax = $(".tax", col);
      const T = last ? last.demand.T[z] : 0;
      tax.style.top = `${50 - Math.max(-1, Math.min(1, T * 4)) * 50}%`;
      tax.title = `tax term ${f2(T)} (rate ${w.rates[z]}% vs neutral ${n.toFixed(1)}%)`;
      const capTick = $(".cap", col);
      if (z === "R" && last) {
        const lim = Math.max(-1, Math.min(1, 1 - last.census.P / last.demand.cap));
        capTick.style.display = "";
        capTick.style.top = `${50 - lim * 50}%`;
        capTick.title = `cap: V_R ≤ 1 − P/Cap = ${lim.toFixed(2)} (Cap ${Math.round(last.demand.cap)})`;
      } else capTick.style.display = "none";
      col.title = `V_${z} ${f2(v)}`;
    }
  }

  // ---- stats strip ---------------------------------------------------------------------------------
  function refreshStats() {
    const w = world();
    const fig = w.last;
    const c = fig && fig.census;
    const P = c ? c.P : w.citizens.length;
    const appr = c ? Math.round(c.approval) : 50;
    const net = liveBudget(w).net;
    dom.stats.innerHTML = "";
    const add = (k, v, cls, title) => { const s = el("span", "stat" + (cls ? " " + cls : "")); s.append(el("b", "", v), " ", el("i", "", k)); if (title) s.title = title; dom.stats.append(s); };
    add("cash", money(w.cash), w.cash < 0 ? "bad" : "", w.ledger.cheat ? `${money(w.ledger.cheat)} of it is cheat money (Options)` : "");
    if (app.prefs && app.prefs.get().cheat) {
      // The cheat's button: unlocked by the Options switch; each press an op (SPEC §8).
      const b = el("button", "cheat", `+${money(KNOBS.CHEAT_CASH)}`);
      b.title = `cheat: GIVE ME CASH — books ${money(KNOBS.CHEAT_CASH)} under "cheat" in the ledger and in the input log (Options turns the button off)`;
      b.addEventListener("click", () => app.cheat());
      dom.stats.append(b);
    }
    add("net/yr", (net >= 0 ? "+" : "−") + money(Math.abs(net)).slice(1), net < 0 ? "bad" : "", "income − upkeep per year at the current rates");
    add("animals", P.toLocaleString(), "", "this month's census");
    add("approval", `${appr}`, "", "mean mood");
    if (c) add("Zoo City index", hIndex(c), "", hTitle(c));
    dom.banner.textContent = w.flags.receivership ? "RECEIVERSHIP — the county holds the books. Rates forced up; building frozen until cash ≥ 0." : "";
    dom.banner.classList.toggle("on", !!w.flags.receivership);
  }

  // The Zoo City index is a share of friendships; census.js fades it in over
  // the first H_FLOOR of them (one cross-species pair is not an index). Say
  // so beside the number while the sample is still small.
  const hSmall = (c) => c.friendships > 0 && c.friendships < KNOBS.H_FLOOR;
  const hIndex = (c) => (hSmall(c) ? `${pct(c.H)} (${c.friendships} of ${KNOBS.H_FLOOR})` : pct(c.H));
  const hRaw = (c) => (c.friendships ? c.H / Math.min(1, c.friendships / KNOBS.H_FLOOR) : 0);
  const hTitle = (c) => `cross-species share of ${plural(c.friendships, "friendship")}${hSmall(c) ? ` — fading in until ${KNOBS.H_FLOOR}; the raw share is ${pct(hRaw(c))}` : ""}`;

  // ---- hover card --------------------------------------------------------------------------------------
  const TIER_NAME = { 1: ["cottage", "shop", "shed", "stall"], 2: ["two-storey", "store", "factory", "meat hall"], 3: ["apartment", "tower", "works", "cold store"] };
  // The blocks (SPEC §3b): one building on 2×2 or 3×3 tiles, named by zone and side.
  const BLOCK_NAME = { 2: ["terrace court", "arcade", "mill", "abattoir"], 3: ["the towers", "emporium", "foundry", "meat exchange"] };
  function personLink(c, label = `${c.name} ${c.surname}`) {
    const b = el("button", "personlink", label);
    b.type = "button";
    b.title = `Inspect ${label}`;
    b.addEventListener("click", () => {
      if (app.input?.pinCitizen(c.id)) updateHover(app.input.hoverInfo());
    });
    return b;
  }

  function householdPeople(h, w) {
    const box = el("div", "household");
    box.append(el("span", "dim", `${h.surname}: `));
    h.members.forEach((c, k) => {
      if (k) box.append(document.createTextNode(" · "));
      box.append(personLink(c, `${c.name} (${c.species})`));
    });
    const needs = h.members.map((c) => needOf(w, c)).filter((n) => n.code !== "CONTENT");
    if (needs.length) {
      const count = new Map();
      for (const n of needs) count.set(n.code, (count.get(n.code) || 0) + 1);
      const code = [...count].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
      box.append(el("span", "want", `  wants ${code} — ${ACT[code]}`));
    }
    return box;
  }

  function cardForTile(i, pinned) {
    const w = world();
    const rep = lotReport(w, i);
    const tx = rep.tx, ty = rep.ty;
    const lines = [];
    const head = el("div", "head");
    let what;
    if (w.wall[i]) what = w.road[i] !== ROAD.NONE || w.rail[i] ? "Tunnel" : "Wall";
    else if (w.rail[i] === 2) what = "Station";
    else if (w.rail[i]) what = w.road[i] !== ROAD.NONE ? "Level crossing" : "Rail"; // the head names BOTH layers, the way a road under a wall reads "Tunnel"
    else if (w.road[i] === ROAD.BRIDGE) what = "Bridge";
    else if (w.road[i] === ROAD.ROAD) what = "Road";
    else if (rep.civic === CIVIC.PARK) what = "Park";
    else if (rep.civic === CIVIC.ZOO || rep.civic === CIVIC.ZOO_PART) what = "Zoo";
    else if (rep.civic === CIVIC.FIRE) what = "Fire station";
    else if (rep.civic === CIVIC.POLICE) what = "Police station";
    else if (rep.civic === CIVIC.CENTRE) what = "Pacification centre";
    else if (rep.zone === ZONE.M) what = `Meat market ${rep.maxTier === 1 ? "Low" : "High"}`;
    else if (rep.zone !== ZONE.NONE) what = `${ZONE_NAME[rep.zone]} ${rep.maxTier === 1 ? "Low" : "High"}`;
    else if (w.terrain[i] === TERRAIN.WATER) what = "Water";
    else if (w.terrain[i] === TERRAIN.TREE) what = "Trees";
    else what = "Grass";
    head.append(el("b", "", `(${rep.part ? `${rep.at.tx},${rep.at.ty}` : `${tx},${ty}`}) ${what}`));
    if (rep.zone !== ZONE.NONE) {
      const t = rep.tier;
      // LAZY, and it must stay lazy: on a zoned but EMPTY lot `t` is 0 and
      // TIER_NAME has no row 0, so building the string eagerly throws. It sat
      // inside the ternary below until the blocks commit hoisted it out to a
      // const, and from that day hovering a lot you had just zoned threw
      // inside the rAF frame — which never rescheduled, so the whole game
      // froze. See the handoff's trap table.
      const name = () => (rep.landmark ? `3×3 ${rep.landmark.name}` : rep.side > 1 ? `${rep.side}×${rep.side} ${BLOCK_NAME[rep.side][rep.zone - 1]}` : rep.shop ? `tier 1 ${rep.shop.name}` : `tier ${t} ${TIER_NAME[t][rep.zone - 1]}`);
      head.append(el("span", "dim", t ? `  ${name()}` : "  zoned, empty"));
      if (t) {
        const occ = rep.zone === ZONE.R ? `occ ${rep.occupants}/${rep.capacity}` : `jobs ${rep.staff}/${rep.jobs}`;
        head.append(el("span", "", `  ${occ}`));
      }
      if (rep.part) lines.push(el("div", "dim", `part of the block at (${tx},${ty}) — one building on ${rep.side * rep.side} tiles; its animals are counted there`));
      // A shop of the pool (SPEC §12.2d): its kind by the tile, its keepers by whoever works there now.
      if (rep.shop) lines.push(el("div", "dim", `${rep.shop.title}${rep.shop.keeper ? ` (${rep.shop.keeper})` : ""} — ${rep.shop.blurb}`));
      // A landmark (SPEC §3c): the block the species made, named when it rose and kept until it comes apart.
      if (rep.landmark) lines.push(el("div", "dim", `a landmark — the block the ${rep.landmark.species.map(pluralSpecies).join(" and ")} made: ${rep.landmark.blurb}`));
    }
    if (rep.civic === CIVIC.ZOO) head.append(el("span", "", `  jobs ${rep.staff}/${rep.jobs}`));
    if (rep.civic === CIVIC.CENTRE) {
      const held = w.citizens.filter((c) => c.heldAt === i && (c.held || 0) > w.tick);
      head.append(el("span", "", `  beds ${held.length}/${KNOBS.CENTRE_BEDS} · jobs ${rep.staff}/${rep.jobs}`));
      for (const c of held) lines.push(el("div", "", `held: ${c.name} ${c.surname} (${c.species}), home in ${c.held - w.tick} month${c.held - w.tick === 1 ? "" : "s"}${c.wrongful ? " — the wrong animal" : ""}`));
      lines.push(el("div", "dim", "Six beds, six months. They come home calm and childless; one arrest in twenty was the wrong animal."));
    }
    if (rep.zone === ZONE.M && rep.tier > 0) {
      const hall = anchorOf(w, i);
      const flow = hallYear(w, hall);
      lines.push(el("div", "", `meat on hand ${hallStock(w, hall)}/${KNOBS.MEAT_CAP} · sold this year ${flow.eaten || 0}`));
      lines.push(el("div", "dim", `bought this year: ${flow.bought || 0} dead · ${flow.killed || 0} killings · ${flow.convicted || 0} convicted · ${flow.slaughtered || 0} from the pen`));
      const pen = w.citizens.filter((c) => !c.dead && c.pen && anchorOf(w, c.heldAt) === hall).sort((a, b) => a.id - b.id);
      for (const c of pen) lines.push(el("div", "", `in the pen: ${c.name} ${c.surname}, ${ageYears(w, c)} — bought ${dateOf(w, c.penSince).label}; for market ${dateOf(w, c.held).label}`));
    }
    if (pinned) head.append(el("span", "pin", " pinned (Esc)"));
    lines.push(head);

    if (rep.zone !== ZONE.NONE) {
      const s = rep.score;
      const arrow = s.grow ? "▲" : s.decay ? "▼" : "•";
      const p = s.p ? ` p ${(s.p * 100).toFixed(1)}%/mo` : "";
      // Round the total (the number the rule compares) and let the local part
      // absorb the last cent, so the printed parts always sum to the printed total.
      const tot = Math.round(s.score * 100) / 100;
      const vs = Math.round(s.parts.valve * 100) / 100;
      const ls = Math.round((tot - vs) * 100) / 100;
      const parts = s.access ? `V_${ZONE_NAME[rep.zone]} ${f2(vs)} + local ${f2(ls)} = ${f2(tot)}` : "no road access → score −1";
      lines.push(el("div", "", `${arrow} ${s.reason} (${parts}${p})`));
      // The block it could join (SPEC §3b): what it is waiting for, from the same window the rule reads.
      if (s.window && s.reason !== REASON.MERGING) lines.push(el("div", "dim", `a ${s.window.side}×${s.window.side} block forms here when its ${s.window.side * s.window.side} lots are ${Math.round(KNOBS.FILL_TO_GROW * 100)}% full together — now ${Math.round(s.window.fill * 100)}%${s.score > KNOBS.GROW_THRESH ? "" : " — and demand is positive"}`));
      else if (s.merge) lines.push(el("div", "dim", `joining ${s.merge.side * s.merge.side} lots into one ${s.merge.side}×${s.merge.side} building holding ×${KNOBS.BIG_BONUS} what they hold`));
    }
    // Road access, in the words the rule uses (SPEC 6c). Shown for anything
    // the rule is ASKED about - a lot, a zoo, the centre, a station, a
    // platform - and never for plain ground, where the question is idle.
    if (asksAccess(w, i)) {
      const xy = (t) => `(${t % w.w},${(t / w.w) | 0})`;
      if (rep.served) {
        const doors = rep.doors.slice(0, 4).map(xy).join(" ");
        lines.push(el("div", "", rep.siteDist === 0
          ? `road access: on the road · ${rep.doors.length === 1 ? "its tile" : `${rep.doors.length} road tiles`} ${doors}`
          : `road access: ${rep.siteDist} tile${rep.siteDist === 1 ? "" : "s"} · ${rep.doors.length === 1 ? "door" : `${rep.doors.length} doors, every side counts:`} ${doors}${rep.doors.length > 4 ? " …" : ""}`));
      } else if (rep.nearest && rep.nearest.doors.length) {
        // Parallel to the served line above, and NOT another "no road within
        // 3": the score line has already said that, and what the reader wants
        // next is how far and which way.
        lines.push(el("div", "warn", `road access: none — the nearest road is ${rep.nearest.d} tiles away at ${xy(rep.nearest.doors[0])}, ${rep.nearest.d - KNOBS.ROAD_REACH} too far`));
      } else if (rep.roadDist <= KNOBS.ROAD_REACH) {
        // NO DOOR, AND YET A ROAD IS RIGHT THERE, close enough that the raw
        // field on the env line below prints it. ONLY A PLATFORM can be here:
        // `computeRoadDist` and the bare-wall door search are the same BFS over
        // the same passability, run in opposite directions, so for any other
        // site `!served` implies `roadDist > ROAD_REACH` and this branch is
        // unreachable. (I once "corrected" that to say a walled lot reaches it
        // too; a sixth review brute-forced 354,843 asking sites across 4,000
        // random maps - 2,989 platforms here, and nothing else, ever.) The card
        // used to fall through to the horizon line and print "no road within 8
        // tiles in any direction" a line above "road 2", in the same card.
        lines.push(el("div", "warn", `road access: none — a road is ${rep.roadDist} tile${rep.roadDist === 1 ? "" : "s"} away, but nothing can walk to it: the ground between is water, a wall or a building`));
      } else {
        // AND THE HORIZON LINE IS ABOUT WALKING TOO. `nearestRoad` carries the
        // site's own rule, so what it did not find in N tiles is not "no road"
        // - it is no road anything could walk to. The raw field is clamped at
        // ROAD_REACH + 1, so a road four to eight tiles off that nothing can
        // reach lands HERE rather than in the branch above, and the flat
        // sentence was false for it.
        lines.push(el("div", "warn", `road access: none — no road within ${(rep.nearest ? rep.nearest.d : nearReach() + 1) - 1} tiles that anything could walk to`));
      }
    }
    const env = el("div", "dim");
    env.textContent = `LV ${rep.lv}  Pol ${rep.pol}  crime ${rep.crime}  road ${rep.roadDist > KNOBS.ROAD_REACH ? "—" : rep.roadDist}` + (w.road[i] ? `  traffic ${rep.traffic}` : "")
      + (rep.dread ? `  dread ${rep.dread}` : "") + (rep.fireCov ? "  · fire cover" : "") + (rep.policeCov ? `  · police cover −${rep.policeCov}` : "");
    lines.push(env);
    if (w.use[i] && (rep.zone !== ZONE.NONE || w.road[i] !== ROAD.NONE)) lines.push(el("div", "warn", `use: ${USE_NAME[w.use[i]]}-only — ${w.use[i] === 1 ? "the hunters (fox, owl, wolf, cat, hawk) may live, work and walk here; nobody else" : "everyone but a hunter may live, work and walk here"}; the rest are stopped under police cover`));
    if (w.rail[i] === 2) {
      // A platform is served like a lot: riders reach it from ANY of its doors,
      // and the forecourt between costs them a walk a tile (SPEC 6c, 7.9).
      //
      // THE FORECOURT IS ONE TILE SHORTER THAN THE DISTANCE. At d = 1 the door
      // is next door and nothing is crossed; at d = 3 two tiles are. That is
      // the chain `computeStationDoors` lays into the path and the tile count
      // the suite reports, and the card used to print the distance instead -
      // an off-by-one in the reader's favour that nothing pinned.
      const court = rep.siteDist - 1;
      // And when it is NOT served, this line says the CONSEQUENCE only: the
      // access line above has already given the distance and the direction,
      // and saying "no road within 3" twice in one card is a stutter.
      lines.push(el("div", rep.served ? "dim" : "warn", rep.served
        ? `a station: riders board from ${rep.doors.length === 1 ? "the road at" : `${rep.doors.length} sides,`} ${rep.doors.slice(0, 4).map((t) => `(${t % w.w},${(t / w.w) | 0})`).join(" ")}${court > 0 ? `, crossing ${court} tile${court === 1 ? "" : "s"} of forecourt on foot` : ""}; a citizen's ride costs ${railShare()} of a walk (×${rideFactor()} speed), while a hall cart's ride is free distance; neither changes property-value distance`
        : "a station nobody can board: with no door on it the line runs straight past, and no commute may use it"));
    } else if (w.rail[i]) lines.push(el("div", "dim", w.road[i] !== ROAD.NONE ? "a level crossing: the road and the line share this tile square-on — animals walk across it, anything on the line passes straight through without stopping, and the city maintains both" : `rail: citizen commutes price it at ${railShare()} of a walk (×${rideFactor()} speed); hall logistics count it as free travel; it never shortens property-value distance`));
    if (w.wall[i]) lines.push(el("div", "dim", w.road[i] !== ROAD.NONE ? "a tunnel: the road runs through the wall; smells, dread and cover pass along it and nowhere else" : "a wall: smells, dread, cover and land-value halos go round it, and a killer's reach stops at it; a road through it is a tunnel"));
    if (rep.dread) lines.push(el("div", "dim", `dread ${rep.dread}: herbivores −${Math.min(KNOBS.DREAD_MOOD_CAP, Math.round(KNOBS.DREAD_MOOD_HERB * rep.dread))} mood and −${Math.round(KNOBS.DREAD_HOME_HERB * rep.dread)} on the home score; LV −${Math.round(KNOBS.LV_DREAD * rep.dread)}; carnivores do not mind`));
    for (const f of w.events.files) {
      if (f.tile !== i || f.until <= w.tick) continue;
      const culprit = w.byId ? w.byId.get(f.culpritId) : null;
      lines.push(el("div", f.closed ? "dim" : "warn", `a ${f.cause} here, ${w.tick - f.opened} month${w.tick - f.opened === 1 ? "" : "s"} ago — crime +${f.crime} within ${f.radius} for ${f.until - w.tick} more${f.closed ? "" : `; the file is open${culprit ? ` on ${culprit.name} ${culprit.surname} (${culprit.species})` : ""}`}`));
    }
    if (rep.households.length) {
      for (const h of rep.households) lines.push(householdPeople(h, w));
      const jobless = rep.households.flatMap((h) => h.members).filter((c) => isWorker(w, c) && c.job < 0);
      if (jobless.length) lines.push(el("div", "warn", `${jobless.length} looking for work: ${jobless.slice(0, 4).map((c) => c.name).join(", ")}${jobless.length > 4 ? "…" : ""}`));
    }
    if (rep.workers.length) {
      const names = rep.workers.slice(0, 5).map((c) => `${c.name} ${c.surname} (${c.species}${c.fixed ? ", fixed" : ""})`).join(", ");
      lines.push(el("div", "", `workers: ${names}${rep.workers.length > 5 ? ` +${rep.workers.length - 5}` : ""}`));
    }
    if (rep.zone !== ZONE.NONE) {
      const s = rep.score;
      const why = whyNot(w, rep);
      const wn = el("div", "why");
      wn.append(el("b", "", "WHY NOT: "), why);
      if (!s.grow && s.reason !== REASON.STABLE && s.reason !== REASON.GROWING) wn.classList.add("warn");
      lines.push(wn);
    }
    const plaque = w.events.centenaries.find((c) => c.tile === i);
    if (plaque) lines.push(el("div", "dim", `plaque: ${plaque.name}, one hundred years. LV +${plaque.bonus} within ${plaque.radius}.`));
    if (w.burning[i]) lines.push(el("div", "warn", "ON FIRE — bulldoze a firebreak."));
    if (w.rubble[i]) lines.push(el("div", "warn", `rubble — the site clears itself in ${w.rubble[i]} month${w.rubble[i] === 1 ? "" : "s"} and rebuilds on its own; the zoning is kept. Bulldoze (§2) if you cannot wait.`));
    if (w.flooded[i]) lines.push(el("div", "warn", `flooded, ${w.flooded[i]} more month${w.flooded[i] === 1 ? "" : "s"}.`));
    if (w.terrain[i] === TERRAIN.TREE && !w.zone[i]) lines.push(el("div", "dim", "a tree: −4 pollution, +3 LV next door; zoning over it fells it at §4."));
    return lines;
  }

  /** The WHY NOT line, from the reason code the rule returned. */
  function whyNot(w, rep) {
    const s = rep.score;
    const n = neutralOf(w);
    const z = ZONE_NAME[rep.zone];
    switch (s.reason) {
      case REASON.GROWING: case REASON.STABLE: case REASON.MERGING: return "—";
      case REASON.PART: return `part of the block at (${rep.tx},${rep.ty})`;
      case REASON.NO_ROAD: return `no road within ${KNOBS.ROAD_REACH} tiles`; // the knob, not a 3: SPEC 6c says everything moves with it
      case REASON.SMOG: return `smog ${rep.pol} > ${KNOBS.SMOG_REFUSE}`;
      case REASON.NO_DEMAND: case REASON.EMPTY: {
        const v = s.parts.valve;
        const rate = w.rates[z] ?? w.rates.C; // a meat hall rides the C rate
        return `demand ${f2(v)}${rate > n ? ` (${z} ${rate}% vs neutral ${n.toFixed(1)}%)` : s.parts.local < 0 ? ` (local ${f2(s.parts.local)})` : ""}`;
      }
      case REASON.LV_CAP: return `LV ${rep.lv} < ${rep.tier === 1 ? KNOBS.LV_TIER[0] : KNOBS.LV_TIER[1]} — parks and trees raise it`;
      case REASON.DENSITY_CAP: return "density brush: Low";
      case REASON.WAITING_FILL: return `waiting to fill up (${Math.round(s.fill * 100)}% of ${rep.capacity})`;
      case REASON.CAPPED: return "capacity reached — build a park or a Zoo, or mix the species";
      case REASON.DECAYING: return `score ${f2(s.score)} < −0.15 — decaying`;
      default: return s.reason;
    }
  }

  function doingOf(wk) {
    if (!wk) return "between walks";
    return wk.riding ? "on the train"
      : wk.kind === "predation" ? (wk.carry ? `${wk.leg < wk.legs.length - 1 ? "taking" : "walking home from the hall with"} a heavy sack — ${wk.preyName} did not come home` : `calling on ${wk.preyName}`)
        : { commuter: "commuting", stroller: "out for a stroll", cub: "off to the park", arrival: "just arrived — walking home", meeting: "meeting a new friend", cart: wk.leg ? "bringing the hall cart home" : "taking the hall cart to a door", penned: "standing in the market pen", departure: "leaving town for the edge road" }[wk.kind] || wk.kind;
  }

  function portraitFor(id, species, years, mood = 50) {
    const canvas = el("canvas", "portrait");
    const sp = SPECIES_BY_ID[species];
    const age = years < KNOBS.ADULT_AGE ? "cub" : years >= sp.retire ? "elder" : "adult";
    const expression = mood >= 65 ? "glad" : mood < 40 ? "low" : "flat";
    paintPortrait(canvas, app.art.portrait(species, { age, ...app.art.look(id), expression }), 2);
    canvas.setAttribute("aria-label", `${species} portrait`);
    return canvas;
  }

  function cardForCitizen(id, wk, pinned, target) {
    const w = world();
    const lines = [];
    const c = w.byId?.get(id);
    const kept = c ? null : legacyOf(w, id);
    const head = el("div", "head");
    head.classList.add("personhead");
    if (c) {
      const y = ageYears(w, c);
      const sp = SPECIES_BY_ID[c.species];
      const title = el("div", "personname");
      title.append(el("b", "", `${c.name} ${c.surname}`), el("span", "dim", `  ${c.species}, ${y}${y >= sp.retire ? " (retired)" : y < KNOBS.ADULT_AGE ? " (cub)" : ""}`));
      if (pinned) title.append(el("span", "pin", "  pinned (Esc)"));
      head.append(portraitFor(id, c.species, y, c.mood), title);
      lines.push(head);
      const homeS = c.home >= 0 ? `(${c.home % w.w},${(c.home / w.w) | 0})` : "none";
      const jobS = c.job >= 0 ? `(${c.job % w.w},${(c.job / w.w) | 0})` : isWorker(w, c) ? `none${c.jobless ? ` — ${c.jobless} months looking` : ""}` : "—";
      const hh = w.hhById?.get(c.household);
      lines.push(el("div", "", `${hh ? `the ${hh.surname} household · ` : ""}home ${homeS} · job ${jobS} · mood ${Math.round(c.mood)}`));
      const status = [];
      if (c.pen) status.push(`in the market pen until ${dateOf(w, c.held).label}`);
      else if ((c.held || 0) > w.tick) status.push(c.heldAt >= 0 ? `at the Pacification Centre until ${dateOf(w, c.held).label}` : `in the cells until ${dateOf(w, c.held).label}`);
      if (c.fixed) status.push(`fixed${c.wrongful ? " — the wrong animal" : ""}${c.exonerated ? ", exonerated" : ""}`);
      if (c.record) status.push(`record ${c.record}`);
      if (status.length) lines.push(el("div", "warn", status.join(" · ")));
      const targetLine = target?.line || (wk ? doingOf(wk) : "between walks");
      lines.push(el("div", "doing", `${target?.state || "walking"}: ${targetLine}${wk ? ` · ${doingOf(wk)}` : ""}${c.centenary ? " · wears the centenary hat" : ""}`));
      const need = needOf(w, c);
      const want = el("div", "want");
      want.append(el("b", "", `wants ${need.code}: `), document.createTextNode(`“${needLine(w, c, need)}”`), el("span", "dim", ` — ${need.act}`));
      lines.push(want);
      const x = exposure(w, c);
      if (x.e) lines.push(el("div", "warn", `trespass: ${x.e} forbidden tile${x.e === 1 ? "" : "s"} on the commute — ${x.p ? `${Math.round(x.p * 100)}% a month under this cover` : "no police cover, no stop"}`));
      const friends = c.friends.map((f) => w.byId.get(f)).filter(Boolean);
      const friendLine = el("div", "friends");
      friendLine.append(el("span", "dim", friends.length ? "friends: " : "no friends yet"));
      friends.forEach((f, k) => { if (k) friendLine.append(document.createTextNode(" · ")); friendLine.append(personLink(f)); });
      lines.push(friendLine);
      const biography = lifeLines(w, c);
      if (biography.length) {
        const life = el("div", "life");
        life.append(el("b", "", "life"));
        const earlier = biography.slice(0, -4), recent = biography.slice(-4);
        if (earlier.length) {
          const details = el("details", "");
          details.append(el("summary", "dim", `${earlier.length} earlier`));
          for (const text of earlier) details.append(el("div", "dim", text));
          life.append(details);
        }
        for (const text of recent) life.append(el("div", "dim", text));
        lines.push(life);
      }
    } else if (kept) {
      const title = el("div", "personname");
      title.append(el("b", "", kept.name), el("span", "dim", `  ${kept.species}, ${kept.age} · permanent civic record`));
      if (pinned) title.append(el("span", "pin", "  pinned (Esc)"));
      head.append(portraitFor(id, kept.species, kept.age, 30), title);
      lines.push(head);
      lines.push(el("div", "epitaph", target?.line || "This citizen has left the living city."));
      const bornYear = 2000 + Math.floor(kept.born / 12), endYear = 2000 + Math.floor(kept.end / 12);
      lines.push(el("div", "dim", `born ${bornYear} · record ended ${endYear} · origin ${kept.origin >= 0 ? `(${kept.origin % w.w},${(kept.origin / w.w) | 0})` : "unknown"} · last home ${kept.home >= 0 ? `(${kept.home % w.w},${(kept.home / w.w) | 0})` : "unknown"} · household ${kept.household}`));
      const distinctions = [[kept.native, "native"], [kept.fixed, "fixed"], [kept.centenary, "centenarian"], [kept.recorded, "recorded offence"], [kept.wrongful, "wrongfully arrested"], [kept.exonerated, "exonerated"]].filter(([yes]) => yes).map(([, text]) => text);
      if (distinctions.length) lines.push(el("div", "dim", `distinctions: ${distinctions.join(" · ")}`));
    }
    return lines;
  }

  function cardForWalker(wk) {
    const head = el("div", "head");
    head.append(el("b", "", wk.name || cap(wk.species)), el("span", "dim", `  ${wk.species}`));
    const doing = { departure: "leaving town for the edge road", camper: "camping by the edge road — wants a home the town has not built", scout: "a scout: this species would come if the town suited it" }[wk.kind] || wk.kind;
    return [head, el("div", "dim", doing)];
  }

  function updateHover(info) {
    const key = !info ? "" : info.citizen != null ? `c${info.citizen}` : info.walker ? `w${info.walker.id}` : `t${info.tile}`;
    const w = world();
    // Cheap change detection: rebuild on a new target or on a tick.
    const stamp = `${key}|${w.tick}|${w.cash}|${info && info.pinned ? 1 : 0}`;
    if (stamp === lastHoverKey) return;
    lastHoverKey = stamp;
    dom.card.innerHTML = "";
    if (!info) { dom.card.append(el("div", "dim", "hover the map · Inspect (9) pins a card · click an animal for its life")); return; }
    const lines = info.citizen != null ? cardForCitizen(info.citizen, info.walker, info.pinned, info.target)
      : info.walker ? cardForWalker(info.walker) : cardForTile(info.tile, info.pinned);
    for (const l of lines) dom.card.append(l);
  }

  // ---- tabs ---------------------------------------------------------------------------------------------------
  function buildTabs() {
    dom.tabs.innerHTML = "";
    for (const [id, label] of [["rules", "Rules"], ["budget", "Budget"], ["census", "Census"], ["news", "News"]]) {
      const b = el("button", "tab", label);
      b.dataset.tab = id;
      b.addEventListener("click", () => { tab = id; newsJump = true; renderTab(); });
      dom.tabs.append(b);
    }
  }

  function renderTab() {
    for (const b of dom.tabs.children) b.classList.toggle("on", b.dataset.tab === tab);
    const body = dom.tabBody;
    // The feed runs oldest-first, so "follow the news" means the BOTTOM. Read
    // the scroll before the wipe: a player who scrolled up to read an old
    // month must not be yanked back down by the next tick.
    if (tab === "news" && !newsJump) newsStick = body.scrollTop + body.clientHeight >= body.scrollHeight - 24;
    body.innerHTML = "";
    const w = world();
    if (tab === "rules") renderRules(body, w);
    else if (tab === "budget") renderBudget(body, w);
    else if (tab === "census") renderCensus(body, w);
    else renderNews(body, w);
    if (tab === "news" && (newsJump || newsStick)) body.scrollTop = body.scrollHeight;
    newsJump = false;
  }

  function renderRules(body, w) {
    body.append(el("p", "note", "Every equation the sim runs, with this month's numbers. Constants live in js/sim/rules.js. Traffic is a readout, not a gate; there is no wind."));
    const ol = el("ol", "rules");
    for (const r of RULES) {
      const li = el("li");
      li.append(el("b", "", r.title));
      li.append(el("div", "formula", r.formula));
      let live = "";
      try { live = w.last ? r.live(w) : ""; } catch { live = ""; }
      if (live) li.append(el("div", "live", live));
      ol.append(li);
    }
    body.append(ol);
    if (!w.last) body.append(el("p", "note", "Live numbers appear after the first month."));
  }

  function renderBudget(body, w) {
    const last = w.last; // refreshLast() re-derives this on every rate op, so the steppers read live
    const n = neutralOf(w);
    const rates = el("div", "rates");
    for (const z of ["R", "C", "I"]) {
      const row = el("div", "rate");
      row.append(el("span", "lab", `${z} tax`));
      const minus = el("button", "", "−");
      const val = el("span", "val", `${w.rates[z]}%`);
      const plus = el("button", "", "+");
      minus.addEventListener("click", () => app.doOp({ kind: "rate", zone: z, value: w.rates[z] - 1 }));
      plus.addEventListener("click", () => app.doOp({ kind: "rate", zone: z, value: w.rates[z] + 1 }));
      const T = last ? last.demand.T[z] : 0;
      const hint = el("span", "dim", ` T ${f2(T)}${w.rates[z] > n + 3 ? " — revolt brewing" : w.rates[z] > n ? " — above neutral" : ""}`);
      hint.title = "the tax term the valve gets from this rate; it moves the valve from the next month";
      row.append(minus, val, plus, hint);
      rates.append(row);
    }
    body.append(rates);
    body.append(el("div", "dim", `neutral rate n = ${n.toFixed(1)}% (falls as the town grows)`));
    const { fig, winter, lines, net } = liveBudget(w);
    const cInc = w.rates.C * fig.fc * KNOBS.TAX_C_PER_JOB;
    const iInc = w.rates.I * fig.fi * KNOBS.TAX_I_PER_JOB;
    const mInc = fig.licence ? w.rates.C * (fig.fm || 0) * KNOBS.TAX_C_PER_JOB : 0;
    const rInc = Math.max(0, fig.incomeYr - cInc - iInc - mInc);
    const table = el("table", "ledger");
    const tr = (k, v, cls) => { const r = el("tr", cls); r.append(el("td", "", k), el("td", "num", v)); table.append(r); };
    tr("INCOME / yr", money(fig.incomeYr), "h");
    tr(`R: ${w.rates.R}% × Σ(0.5 + LV/100)`, money(rInc));
    tr(`C: ${w.rates.C}% × 1.5 × ${fig.fc} jobs`, money(cInc));
    tr(`I: ${w.rates.I}% × 2.0 × ${fig.fi} jobs`, money(iInc));
    if (fig.fm || fig.markets) tr(fig.licence ? `M (licensed): ${w.rates.C}% × 1.5 × ${fig.fm} jobs` : `M cut (grey, untaxed): §${KNOBS.CUT_PER_JOB} × ${fig.fm} jobs`, money(fig.licence ? mInc : fig.cutYr || 0));
    tr(`UPKEEP / yr${winter ? " (bear winter −20%)" : ""}`, money(fig.upkeepYr), "h");
    for (const [k, v] of lines) tr(k, money(v));
    tr("NET / yr", (net < 0 ? "−" : "+") + money(Math.abs(net)).slice(1), net < 0 ? "h bad" : "h");
    body.append(table);
    body.append(el("div", "dim", "the figures as the town stands now; a twelfth of each is booked every month, at the rates as they stand then."));
    const led = el("table", "ledger");
    const lr = (k, v) => { const r = el("tr"); r.append(el("td", "", k), el("td", "num", v)); led.append(r); };
    const hr = el("tr", "h"); hr.append(el("td", "", "LEDGER since founding"), el("td", "num", money(w.cash))); led.append(hr);
    for (const [k, v] of Object.entries(w.ledger)) lr(k, (v < 0 ? "−" : "+") + money(Math.abs(v)).slice(1));
    body.append(led);
    if (w.ledger.cheat) body.append(el("div", "dim", `cheat: ${money(w.ledger.cheat)} of the treasury came from the GIVE ME CASH button (Options); every press is in the input log.`));
    body.append(el("p", "note", "Cash below −§10,000 is receivership: rates forced to n+2 and building frozen until the treasury is back above zero. Never a game over."));
  }

  function renderCensus(body, w) {
    const fig = w.last;
    const c = fig && fig.census;
    if (!c) { body.append(el("p", "note", "The first census is taken at the end of the first month.")); return; }
    const d = dateOf(w);
    body.append(el("div", "line", `${d.label} — ${characterLine(c)}`));
    const grid = el("table", "ledger");
    const tr = (k, v) => { const r = el("tr"); r.append(el("td", "", k), el("td", "num", v)); grid.append(r); };
    tr("population", c.P.toLocaleString());
    tr("workers / jobs", `${c.W} / ${c.J}`);
    tr("unemployed", `${c.U} (${c.W ? Math.round((100 * c.U) / c.W) : 0}%)`);
    tr("friendships", `${c.friendships}`);
    tr("crime (built lots, mean / max)", `${Math.round(c.meanCrime)} / ${c.maxCrime}`);
    tr("stations", `${c.fireStations} fire · ${c.policeStations} police${c.centres ? ` · ${c.centres} pacification` : ""}`);
    if (c.walls) tr("walls · tunnels", `${c.walls} · ${c.tunnels}`);
    if (c.railTiles || c.stations) tr("rail · stations · riders", `${c.railTiles} · ${c.stations} · ${c.riders}`);
    if (c.commuteN) tr(`mean commute (walk-steps; a ride is ${railShare()})`, c.meanCommute.toFixed(1));
    if (c.markets) {
      tr("meat halls", `${c.markets} (${c.Jm} jobs) · ${c.herbNear} herbivores within the smell`);
      tr("meat on hand · sold this year", `${c.meatOnHand || 0} · ${c.meatSold || 0}`);
      tr("sources this year", `${c.meatBought || 0} dead · ${c.meatKilled || 0} killings · ${c.meatConvicted || 0} convicted · ${c.meatSlaughtered || 0} pen`);
      if (c.penned) tr("in market pens", `${c.penned}`);
    }
    { const j = w.events.justice || {}; const open = (w.events.files || []).filter((f) => !f.closed).length;
      if (c.usePred || c.usePrey) tr("use-zoned tiles (predator · prey)", `${c.usePred} · ${c.usePrey}`);
      if (fig.zonedOut) tr("zoned out last month", `${fig.zonedOut}`);
      if (j.trespass) tr("trespass stops since founding", `${j.trespass}`);
      if (w.events.killings || j.takenIn || j.cells || j.sold) {
        tr("killings since founding", `${w.events.killings}`);
        tr("files open / gone cold", `${open} / ${j.cold || 0}`);
        tr("pacified (wrongful · exonerated)", `${j.pacified || 0} (${j.wrongful || 0} · ${j.exonerated || 0})`);
        tr("held · cells · sold at the hall", `${c.held} · ${j.cells || 0} · ${j.sold || 0}`);
        tr("litters lost last month", `${fig.littersLost || 0}`);
      } }
    tr("Zoo City index (cross-species share)", hIndex(c));
    if (c.fixed) tr("— of which by pacification", pct(c.hKnife));
    if (hSmall(c)) { const r = el("tr"); const td = el("td", "dim", `fading in over the first ${KNOBS.H_FLOOR} friendships — raw share ${pct(hRaw(c))}`); td.colSpan = 2; r.append(td); grid.append(r); }
    tr("approval (mean mood)", `${Math.round(c.approval)}`);
    tr("native-born", pct(c.native));
    tr("vacant homes", `${c.vacantR}`);
    tr("capacity", `${Math.round(fig.demand.cap)}${fig.demand.capped ? " — REACHED" : ""}`);
    tr("mean LV / Pol", `${c.meanLV.toFixed(0)} / ${c.meanPol.toFixed(0)}`);
    if (w.campers.length) tr("camping by the road", `${w.campers.filter((x) => x.kind === "camper").length}`);
    body.append(grid);
    const remembered = memorial(w);
    if (remembered.length) {
      body.append(el("h3", "", "recent memorial"));
      for (const rec of remembered) {
        const row = el("div", "memorial");
        row.append(personLink(rec, rec.name), el("span", "dim", ` · ${rec.species}, ${rec.age} · ${rec.cause} · ${dateOf(w, rec.tick).label}`));
        body.append(row);
      }
    }
    body.append(el("h3", "", "species"));
    const hist = el("div", "hist");
    const maxShare = Math.max(0.01, ...SPECIES.map((s) => c.shares[s.id]));
    for (const s of SPECIES) {
      const row = el("div", "hrow");
      row.append(el("span", "lab", s.id));
      const bar = el("div", "hbar");
      const fill = el("div", "hfill");
      fill.style.width = `${(100 * c.shares[s.id]) / maxShare}%`;
      fill.classList.add(s.fur);
      bar.append(fill);
      row.append(bar, el("span", "num", `${c.counts[s.id]}`));
      row.title = `${s.id}: ${pct(c.shares[s.id])} · arrival weight ${w.lastWeights ? w.lastWeights[s.id].toFixed(2) : "—"}`;
      hist.append(row);
    }
    body.append(hist);
    const ms = KNOBS.MILESTONES.slice(0, w.flags.milestone).map((m) => `${m[1]} (${m[0]})`);
    body.append(el("div", "dim", ms.length ? `milestones: ${ms.join(" · ")}` : `next milestone: ${KNOBS.MILESTONES[0][1]} at ${KNOBS.MILESTONES[0][0]}`));
    if (w.events.centenaries.length) body.append(el("div", "dim", `plaques: ${w.events.centenaries.map((x) => x.name).join(", ")}`));
    if (w.events.active.length) body.append(el("div", "dim", `in effect: ${w.events.active.map((e) => `${eventTitle(e.id)} (until ${dateOf(w, e.until).label})`).join(", ")}`));
    if (w.history.length > 1) {
      body.append(el("h3", "", "yearly report"));
      const t = el("table", "ledger small");
      const hr = el("tr", "h");
      for (const h of ["year", "P", "U", "cash", "appr", "H"]) hr.append(el("td", h === "year" ? "" : "num", h));
      t.append(hr);
      for (const h of w.history.slice(-12)) {
        const r = el("tr");
        r.append(el("td", "", `${dateOf(w, h.tick).year}`), el("td", "num", `${h.P}`), el("td", "num", `${h.U}`), el("td", "num", money(h.cash)), el("td", "num", `${h.approval}`), el("td", "num", pct(h.H)));
        t.append(r);
      }
      body.append(t);
    }
  }

  // The tab is the glance; `R` opens the reader. Both read the same feed, and
  // both run OLDEST FIRST — the order the owner asked to read them in.
  function renderNews(body, w) {
    const rows = newsRows(w);
    if (!rows.length) { body.append(el("p", "note", "Events and advisor lines land here as the months pass. R opens the reader.")); return; }
    const ul = el("ul", "log");
    for (const l of rows.slice(-120)) {
      const li = el("li");
      li.append(el("span", "dim", `${l.label} `), l.text);
      if (l.bad) li.classList.add("bad");
      else if (l.good) li.classList.add("good");
      ul.append(li);
    }
    body.append(ul);
    body.append(el("p", "note", rows.length > 120 ? `the last 120 of ${rows.length} — R opens the reader, from the founding` : "R opens the reader: ← → step one dispatch at a time"));
  }

  function onTick(notices) {
    // Not one flash per notice clobbering the last: the whole month's run, in
    // order. Nothing is dropped either way — every line is already in the
    // city's own event log, which is what the News tab and the reader read.
    flashRun(notices.filter((n) => TICKER_FLASH.test(n)));
    refresh();
  }

  function refresh() {
    refreshClock();
    refreshBars();
    refreshStats();
    refreshNews();
    renderTab();
    lastHoverKey = "";
  }

  // ---- the CHOICE card ------------------------------------------------------------------------------------------------
  function showChoice() {
    const ch = world().events.choice;
    if (!ch) { hideChoice(); return; }
    dom.choice.innerHTML = "";
    const box = el("div", "modalbox");
    box.append(el("h2", "", ch.title), el("p", "", ch.text));
    const row = el("div", "btnrow");
    const yes = el("button", "primary", ch.accept || "Accept");
    const no = el("button", "", ch.decline || "Decline");
    if (ch.cost && world().cash < ch.cost) { yes.disabled = true; yes.title = "cannot afford"; }
    yes.addEventListener("click", () => { const r = app.doOp({ kind: "choice", accept: true }); flash(r.reason || "Accepted."); hideChoice(); app.resume(); });
    no.addEventListener("click", () => { const r = app.doOp({ kind: "choice", accept: false }); flash(r.reason || "Declined."); hideChoice(); app.resume(); });
    row.append(yes, no);
    box.append(row, el("p", "note", "The sim is paused while the offer stands."));
    dom.choice.append(box);
    dom.choice.hidden = false;
  }
  function hideChoice() { dom.choice.hidden = true; }

  // ---- the new-city dialog -----------------------------------------------------------------------------------------------
  const WORDS = ["burrow", "hollow", "thicket", "mill", "ford", "warren", "reed", "quarry", "orchard", "gully", "heath", "hearth", "fen", "hedge", "loam", "shingle"];
  function diceSeed() {
    const a = WORDS[Math.floor(performance.now() * 7) % WORDS.length];
    const b = WORDS[(Date.now() + Math.floor(performance.now())) % WORDS.length];
    return `${a}-${b}-${(Date.now() % 997).toString(36)}`;
  }

  // These dialog pieces are builders the title screen (title.js) mounts on
  // its own card: the found form and the one named-saves panel. Checkbox ids
  // are per instance — the N dialog and the title can both
  // be in the DOM.
  let uid = 0;

  /** Seed, dice, no-disasters, FOUND THE CITY. Returns the seed input (for focus); `done()` runs after founding. */
  function foundForm(box, done) {
    const row = el("div", "row");
    row.append(el("label", "", "seed"));
    const seed = el("input");
    seed.type = "text";
    seed.value = diceSeed();
    seed.spellcheck = false;
    const dice = el("button", "", "⚄");
    dice.title = "roll a seed";
    dice.addEventListener("click", () => { seed.value = diceSeed(); });
    row.append(seed, dice);
    box.append(row);
    const row2 = el("div", "row");
    const nd = el("input");
    nd.type = "checkbox";
    nd.id = `noDisasters${++uid}`;
    const ndl = el("label", "", " No disasters (masks fire, flood, tornado, smog, revolt, recession)");
    ndl.htmlFor = nd.id;
    row2.append(nd, ndl);
    box.append(row2);
    const go = el("button", "primary", "FOUND THE CITY");
    go.addEventListener("click", () => { app.newCity({ seed: seed.value.trim() || "zoo", noDisasters: nd.checked }); done(); });
    seed.addEventListener("keydown", (e) => { if (e.key === "Enter") go.click(); });
    const goRow = el("div", "btnrow");
    goRow.append(go);
    box.append(goRow);
    return seed;
  }

  const formatBytes = (n) => n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(2)} MB`;

  /** Every named slot, newest first. `again()` rebuilds after a write/delete. */
  function savesList(box, done, again, exportJson) {
    const list = el("div", "saves");
    const saves = app.slots();
    if (!saves.length) list.append(el("div", "dim", "none yet — SAVE writes a named copy of the current city"));
    for (const s of saves) {
      const r = el("div", "save");
      r.append(el("b", "", s.name), el("span", "dim", `${s.city} · ${s.date} · ${s.pop} animals · ${formatBytes(s.bytes)}${s.kind === "auto" ? " · automatic" : ""}`));
      const load = el("button", "", "load");
      load.title = `load “${s.name}” from ${s.city}`;
      load.addEventListener("click", () => { if (app.loadSlot(s.city, s.id)) done(); });
      r.append(load);
      if (s.kind === "manual") {
        const over = el("button", "", "overwrite");
        over.disabled = !app.entered || s.city !== app.cityName;
        over.title = over.disabled ? "load this city before overwriting its slot" : `replace “${s.name}” with the city now in play`;
        over.addEventListener("click", () => {
          if (!confirm(`Overwrite “${s.name}” with ${dateOf(app.world).label}?`)) return;
          const result = app.saveAs(s.name, s.id);
          if (!result.ok) { exportJson(result.json, `Overwrite failed: ${result.reason}. Copy the city JSON below.`); return; }
          again();
          if (app.title?.isOpen()) app.title.say(`Overwrote “${s.name}” at ${dateOf(app.world).label}.`);
          else flash(`Overwrote “${s.name}” at ${dateOf(app.world).label}.`);
        });
        r.append(over);
      }
      const del = el("button", "", "delete");
      del.addEventListener("click", () => {
        if (!confirm(`Delete only “${s.name}” from “${s.city}”?`)) return;
        const result = app.deleteSlot(s.city, s.id);
        if (!result.ok) { flash(`Delete failed: ${result.reason}`); return; }
        again();
      });
      const ex = el("button", "", "export");
      ex.addEventListener("click", () => exportJson(app.slotText(s.city, s.id), `Exporting “${s.name}” — copy the city JSON below.`));
      r.append(del, ex);
      list.append(r);
    }
    box.append(list);
    return list;
  }

  /** Export the current city as text / import one. `done()` after an import. */
  function portBox(box, done, initialText = "") {
    const ta = el("textarea");
    ta.rows = 4;
    ta.spellcheck = false;
    ta.placeholder = "paste a city here and press IMPORT — or EXPORT the current one";
    ta.value = initialText;
    const br = el("div", "btnrow");
    const ex = el("button", "", "EXPORT current");
    ex.disabled = !app.entered;
    ex.addEventListener("click", () => { ta.value = app.exportText(); ta.select(); });
    const im = el("button", "", "IMPORT");
    im.addEventListener("click", () => { try { app.importText(ta.value); done(); } catch (e) { flash(`Import failed: ${e.message}`); } });
    br.append(ex, im);
    box.append(ta, br);
    return ta;
  }

  /** SAVE and LOAD both open this panel; `focus` chooses the useful first control. */
  function savesPanel(box, done, again, focus = "list") {
    let ta = null;
    const exportJson = (json, message) => {
      ta.value = json || "";
      ta.focus();
      ta.select();
      if (app.title?.isOpen()) app.title.say(message);
      else flash(message);
    };
    let name = null;
    if (app.entered) {
      box.append(el("h2", "", "Save this city"));
      const row = el("div", "row");
      row.append(el("label", "", "name"));
      name = el("input");
      name.type = "text";
      name.value = `${app.cityName} — ${dateOf(app.world).label}`;
      name.spellcheck = false;
      const go = el("button", "primary", "SAVE AS");
      const write = () => {
        const result = app.saveAs(name.value);
        if (!result.ok) { exportJson(result.json, `Save failed: ${result.reason}. Copy the city JSON below.`); return; }
        const savedName = name.value.trim();
        again();
        if (app.title?.isOpen()) app.title.say(`Saved “${savedName}” at ${dateOf(app.world).label}.`);
        else flash(`Saved “${savedName}” at ${dateOf(app.world).label}.`);
      };
      go.addEventListener("click", write);
      name.addEventListener("keydown", (e) => { if (e.key === "Enter") write(); });
      row.append(name, go);
      box.append(row);
    }
    box.append(el("h2", "", "Named saves"));
    if (app.storageWarning) box.append(el("p", "note", app.storageWarning));
    savesList(box, done, again, exportJson);
    const usage = app.storageUsage();
    const free = Math.max(0, usage.limit - usage.used);
    const sampleBytes = app.entered ? new TextEncoder().encode(app.exportText()).length : 0;
    const room = sampleBytes ? ` · roughly ${Math.floor(free / sampleBytes)} more saves this size` : "";
    box.append(el("p", "note", `Used ${formatBytes(usage.used)} of about ${formatBytes(usage.limit)} · about ${formatBytes(free)} free${room}. Autosave keeps exactly one slot per city.`));
    if (app.unsavedExport) box.append(el("p", "note", "The last save was refused by browser storage. Its complete city JSON is preserved below — copy it before leaving this page."));
    box.append(el("h2", "", "Export / import"));
    ta = portBox(box, done, app.unsavedExport || "");
    if (focus === "name" && name) { name.focus(); name.select(); }
    else if (focus === "list") (box.querySelector(".saves button") || ta).focus();
    return name || ta;
  }

  function openNewCity() {
    dom.newcity.innerHTML = "";
    const box = el("div", "modalbox wide");
    box.append(el("h2", "", "A new city"));
    const seed = foundForm(box, closeModals);
    savesPanel(box, closeModals, openNewCity);
    const close = el("button", "", "close");
    close.addEventListener("click", closeModals);
    const closeRow = el("div", "btnrow");
    closeRow.append(close);
    box.append(closeRow);
    dom.newcity.append(box);
    dom.newcity.hidden = false;
    seed.focus();
    seed.select();
  }
  function closeModals() { dom.newcity.hidden = true; if (app.news) app.news.close(); }
  // The title screen counts: the clock stops under it (main.js) and Esc is its own (input.js).
  // So does the news reader: months must not pass while you are reading them.
  const modalOpen = () => !dom.newcity.hidden || !dom.choice.hidden || !!(app.title && app.title.isOpen()) || !!(app.news && app.news.isOpen());

  function setWorld() {
    // A loaded city brings its own event log and yearly reports with it, and
    // newsRows() reads them where they lie — the panel keeps no second copy,
    // so a live session and the same city reloaded read the same document.
    if (app.news) app.news.invalidate();
    newsJump = true;
    lastHoverKey = "";
    tab = "rules"; // SPEC §2: the Rules tab is open by default on a new city
    refresh();
    showChoice();
  }

  buildStrip();
  buildBars();
  buildTabs();
  setTool("R", 3);
  refresh();
  updateHover(null);
  hideChoice();
  closeModals();

  return { refresh, onTick, setTool, setCost, flash, updateHover, showChoice, hideChoice, openNewCity, closeModals, modalOpen, setWorld, foundForm, savesPanel, savesList, portBox, get tab() { return tab; } };
}
