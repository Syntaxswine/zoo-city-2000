// ui.js — the field-guide panel. SPEC §11 (hover card, bars, tabs), §10.
//
// Everything here is DOM: the tool strip, the three demand bars over the map,
// the date/cash/population/approval strip, the hover card, the four tabs
// (Rules · Budget · Census · Log), the CHOICE card and the new-city dialog —
// whose three builders (foundForm, savesList, portBox) the title screen
// (title.js) mounts on its own card. The cheat's button beside the treasury
// lives here too; the Options switch that unlocks it is title.js's.
// The card's WHY NOT line is `lotReport().score.reason` — the same
// `lotScore()` that decides growth, never a second implementation (§0.6).
//
//   createUI(app) → { refresh, onTick, setTool, setCost, flash, updateHover,
//                     showChoice, hideChoice, openNewCity, closeModals, modalOpen, setWorld }

import { ZONE, CIVIC, TERRAIN, ROAD, ZONE_NAME } from "./sim/world.js";
import { dateOf, characterLine } from "./sim/tick.js";
import { eventTitle, TICKER_BAD, TICKER_GOOD, TICKER_FLASH } from "./sim/events.js";
import { lotReport, REASON } from "./sim/lots.js";
import { RULES, KNOBS } from "./sim/rules.js";
import { yearlyFigures } from "./sim/budget.js";
import { SPECIES, SPECIES_BY_ID } from "./sim/species.js";
import { ageYears, isWorker } from "./sim/census.js";
import { TOOLS } from "./input.js";

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const money = (v) => `§${Math.round(v).toLocaleString()}`;
const f2 = (v) => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(2);
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
  };
  let tab = "rules";
  let logLines = []; // [{ t, label, text }]
  let flashTimer = 0;
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
    for (const t of TOOLS) {
      const b = el("button", "tool", "");
      b.dataset.tool = t.id;
      b.title = t.hint;
      b.append(el("span", "key", t.key), " ", el("span", "", t.label));
      b.addEventListener("click", () => app.input.setTool(t.id));
      dom.tools.append(b);
    }
    const dens = el("button", "tool", "");
    dens.id = "density";
    dens.title = "density brush: Low caps a lot at one storey (bears want cottages; mice want towers)";
    dens.addEventListener("click", () => { app.input.state.density = app.input.state.density === 3 ? 1 : 3; setTool(app.input.tool, app.input.state.density); });
    dom.tools.append(dens);
    const sep = () => dom.tools.append(el("span", "sep", "·"));
    sep();
    const mk = (id, key, label, title, fn) => {
      const b = el("button", "tool", "");
      b.id = id;
      b.title = title;
      b.append(el("span", "key", key), " ", el("span", "", label));
      b.addEventListener("click", fn);
      dom.tools.append(b);
      return b;
    };
    mk("btnPause", "␣", "pause", "Space: pause / resume", () => app.togglePause());
    mk("btnSlower", ",", "slower", ", slower", () => app.setSpeed(-1));
    mk("btnFaster", ".", "faster", ". faster", () => app.setSpeed(1));
    sep();
    mk("btnUndo", "Z", "undo", "Z: undo the last op (this month only)", () => app.undo());
    mk("btnSave", "S", "save", "S: save a checkpoint of this city (the autosave is a separate slot)", () => app.save());
    mk("btnLoad", "L", "load", "L: reload this city's S checkpoint (not the autosave)", () => app.load());
    mk("btnOverlay", "O", "overlay", "O: cycle land value / pollution / crime / lot score overlays", () => app.cycleOverlay());
    mk("btnZoom", "+", "zoom", "+ / −: zoom ×1 / ×2", () => app.zoomAt(app.camera.zoom === 1 ? 1 : -1));
    sep();
    mk("btnNew", "N", "new city", "N: found a new city / load a saved one", () => openNewCity());
    mk("btnMenu", "Esc", "menu", "Esc: the title screen — new game, continue, load, save, options", () => app.title.open());
  }

  function setTool(id, density) {
    for (const b of dom.tools.querySelectorAll("button[data-tool]")) b.classList.toggle("on", b.dataset.tool === id);
    const d = $("#density");
    if (d) { d.innerHTML = ""; d.append(el("span", "key", "D"), " ", el("span", "", density === 3 ? "High" : "Low")); d.classList.toggle("on", density === 1); }
  }

  function setCost(text, refused = false) {
    dom.cost.textContent = text || "";
    dom.cost.classList.toggle("refused", !!refused);
  }

  function flash(msg) {
    if (app.title && app.title.isOpen()) { app.title.say(msg); return; } // the painting covers #flash; the title re-flashes it on close
    dom.flash.textContent = msg;
    dom.flash.classList.add("on");
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => dom.flash.classList.remove("on"), 2600);
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
  function speciesList(members, w) {
    const counts = {};
    for (const c of members) counts[c.species] = (counts[c.species] || 0) + 1;
    return Object.entries(counts).map(([s, n]) => (n === 1 ? s : plural(n, s))).join(", ");
  }
  function householdLine(h, w) {
    const n = h.members.length;
    const one = new Set(h.members.map((c) => c.species)).size === 1;
    if (one) return `the ${h.surname} ${n === 1 ? "household" : "family"} (${n === 1 ? h.members[0].species : plural(n, h.members[0].species)})`;
    return `the ${h.surname} household (${speciesList(h.members, w)})`;
  }

  function cardForTile(i, pinned) {
    const w = world();
    const rep = lotReport(w, i);
    const tx = rep.tx, ty = rep.ty;
    const lines = [];
    const head = el("div", "head");
    let what;
    if (w.wall[i]) what = w.road[i] !== ROAD.NONE ? "Tunnel" : "Wall";
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
    head.append(el("b", "", `(${tx},${ty}) ${what}`));
    if (rep.zone !== ZONE.NONE) {
      const t = rep.tier;
      head.append(el("span", "dim", t ? `  tier ${t} ${TIER_NAME[t][rep.zone - 1]}` : "  zoned, empty"));
      if (t) {
        const occ = rep.zone === ZONE.R ? `occ ${rep.occupants}/${rep.capacity}` : `jobs ${rep.staff}/${rep.jobs}`;
        head.append(el("span", "", `  ${occ}`));
      }
    }
    if (rep.civic === CIVIC.ZOO) head.append(el("span", "", `  jobs ${rep.staff}/${rep.jobs}`));
    if (rep.civic === CIVIC.CENTRE) {
      const held = w.citizens.filter((c) => c.heldAt === i && (c.held || 0) > w.tick);
      head.append(el("span", "", `  beds ${held.length}/${KNOBS.CENTRE_BEDS} · jobs ${rep.staff}/${rep.jobs}`));
      for (const c of held) lines.push(el("div", "", `held: ${c.name} ${c.surname} (${c.species}), home in ${c.held - w.tick} month${c.held - w.tick === 1 ? "" : "s"}${c.wrongful ? " — the wrong animal" : ""}`));
      lines.push(el("div", "dim", "Six beds, six months. They come home calm and childless; one arrest in twenty was the wrong animal."));
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
    }
    const env = el("div", "dim");
    env.textContent = `LV ${rep.lv}  Pol ${rep.pol}  crime ${rep.crime}  road ${rep.roadDist > KNOBS.ROAD_REACH ? "—" : rep.roadDist}` + (w.road[i] ? `  traffic ${rep.traffic}` : "")
      + (rep.dread ? `  dread ${rep.dread}` : "") + (rep.fireCov ? "  · fire cover" : "") + (rep.policeCov ? `  · police cover −${rep.policeCov}` : "");
    lines.push(env);
    if (w.wall[i]) lines.push(el("div", "dim", w.road[i] !== ROAD.NONE ? "a tunnel: the road runs through the wall; smells, dread and cover pass along it and nowhere else" : "a wall: smells, dread, cover and land-value halos go round it, and a killer's reach stops at it; a road through it is a tunnel"));
    if (rep.dread) lines.push(el("div", "dim", `dread ${rep.dread}: herbivores −${Math.min(KNOBS.DREAD_MOOD_CAP, Math.round(KNOBS.DREAD_MOOD_HERB * rep.dread))} mood and −${Math.round(KNOBS.DREAD_HOME_HERB * rep.dread)} on the home score; LV −${Math.round(KNOBS.LV_DREAD * rep.dread)}; carnivores do not mind`));
    for (const f of w.events.files) {
      if (f.tile !== i || f.until <= w.tick) continue;
      const culprit = w.byId ? w.byId.get(f.culpritId) : null;
      lines.push(el("div", f.closed ? "dim" : "warn", `a ${f.cause} here, ${w.tick - f.opened} month${w.tick - f.opened === 1 ? "" : "s"} ago — crime +${f.crime} within ${f.radius} for ${f.until - w.tick} more${f.closed ? "" : `; the file is open${culprit ? ` on ${culprit.name} ${culprit.surname} (${culprit.species})` : ""}`}`));
    }
    if (rep.households.length) {
      lines.push(el("div", "", rep.households.map((h) => householdLine(h, w)).join(" · ")));
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
    if (w.rubble[i]) lines.push(el("div", "warn", "rubble — bulldoze it (§2); the zoning is kept."));
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
      case REASON.GROWING: case REASON.STABLE: return "—";
      case REASON.NO_ROAD: return "no road within 3 tiles";
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

  function cardForWalker(wk) {
    const w = world();
    const lines = [];
    const c = wk.citizen != null && w.byId ? w.byId.get(wk.citizen) : null;
    const head = el("div", "head");
    if (c) {
      const y = ageYears(w, c);
      const sp = SPECIES_BY_ID[c.species];
      head.append(el("b", "", `${c.name} ${c.surname}`), el("span", "dim", `  ${c.species}, ${y}${y >= sp.retire ? " (retired)" : y < KNOBS.ADULT_AGE ? " (cub)" : ""}`));
      lines.push(head);
      const homeS = c.home >= 0 ? `(${c.home % w.w},${(c.home / w.w) | 0})` : "none";
      const jobS = c.job >= 0 ? `(${c.job % w.w},${(c.job / w.w) | 0})` : isWorker(w, c) ? `none${c.jobless ? ` — ${c.jobless} months looking` : ""}` : "—";
      lines.push(el("div", "", `home ${homeS} · job ${jobS} · mood ${Math.round(c.mood)}`));
      const status = [];
      if ((c.held || 0) > w.tick) status.push(c.heldAt >= 0 ? `at the Pacification Centre until ${dateOf(w, c.held).label}` : `in the cells until ${dateOf(w, c.held).label}`);
      if (c.fixed) status.push(`fixed${c.wrongful ? " — the wrong animal" : ""}${c.exonerated ? ", exonerated" : ""}`);
      if (c.record) status.push(`record ${c.record}`);
      if (status.length) lines.push(el("div", "warn", status.join(" · ")));
      const friends = c.friends.map((f) => w.byId.get(f)).filter(Boolean);
      lines.push(el("div", "dim", friends.length ? `friends: ${friends.map((f) => `${f.name} ${f.surname} (${f.species})`).join(", ")}` : "no friends yet"));
      const doing = { commuter: "commuting", stroller: "out for a stroll", cub: "off to the park", arrival: "just arrived — walking home", meeting: "meeting a new friend" }[wk.kind] || wk.kind;
      lines.push(el("div", "dim", doing + (c.centenary ? " · wears the centenary hat" : "")));
    } else {
      head.append(el("b", "", wk.name || cap(wk.species)), el("span", "dim", `  ${wk.species}`));
      lines.push(head);
      const doing = { departure: "leaving town for the edge road", camper: "camping by the edge road — wants a home the town has not built", scout: "a scout: this species would come if the town suited it" }[wk.kind] || wk.kind;
      lines.push(el("div", "dim", doing));
    }
    return lines;
  }

  function updateHover(info) {
    const key = !info ? "" : info.walker ? `w${info.walker.id}` : `t${info.tile}`;
    const w = world();
    // Cheap change detection: rebuild on a new target or on a tick.
    const stamp = `${key}|${w.tick}|${w.cash}|${info && info.pinned ? 1 : 0}`;
    if (stamp === lastHoverKey) return;
    lastHoverKey = stamp;
    dom.card.innerHTML = "";
    if (!info) { dom.card.append(el("div", "dim", "hover the map · Inspect (9) pins a card · click an animal for its life")); return; }
    const lines = info.walker ? cardForWalker(info.walker) : cardForTile(info.tile, info.pinned);
    for (const l of lines) dom.card.append(l);
  }

  // ---- tabs ---------------------------------------------------------------------------------------------------
  function buildTabs() {
    dom.tabs.innerHTML = "";
    for (const [id, label] of [["rules", "Rules"], ["budget", "Budget"], ["census", "Census"], ["log", "Log"]]) {
      const b = el("button", "tab", label);
      b.dataset.tab = id;
      b.addEventListener("click", () => { tab = id; renderTab(); });
      dom.tabs.append(b);
    }
  }

  function renderTab() {
    for (const b of dom.tabs.children) b.classList.toggle("on", b.dataset.tab === tab);
    const body = dom.tabBody;
    body.innerHTML = "";
    const w = world();
    if (tab === "rules") renderRules(body, w);
    else if (tab === "budget") renderBudget(body, w);
    else if (tab === "census") renderCensus(body, w);
    else renderLog(body, w);
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
    if (c.markets) tr("meat halls", `${c.markets} (${c.Jm} jobs) · ${c.herbNear} herbivores within the smell`);
    { const j = w.events.justice || {}; const open = (w.events.files || []).filter((f) => !f.closed).length;
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

  function renderLog(body, w) {
    if (!logLines.length) { body.append(el("p", "note", "Events and advisor lines land here as the months pass.")); return; }
    const ul = el("ul", "log");
    for (const l of logLines.slice(-120).reverse()) {
      const li = el("li");
      li.append(el("span", "dim", `${l.label} `), l.text);
      if (TICKER_BAD.test(l.text)) li.classList.add("bad");
      else if (TICKER_GOOD.test(l.text)) li.classList.add("good");
      ul.append(li);
    }
    body.append(ul);
  }

  function onTick(notices) {
    const w = world();
    const label = dateOf(w, w.tick - 1).label;
    for (const n of notices) {
      logLines.push({ t: w.tick - 1, label, text: n });
      if (TICKER_FLASH.test(n)) flash(n);
    }
    if (logLines.length > 400) logLines = logLines.slice(-300);
    refresh();
  }

  function refresh() {
    refreshClock();
    refreshBars();
    refreshStats();
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

  // The three pieces of the dialog are builders the title screen (title.js)
  // mounts on its own card: the found form, the saved-cities list, the port
  // box. Checkbox ids are per instance — the N dialog and the title can both
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

  /** Two slots a city: the S checkpoint ("load") and the autosave ("resume"). `done()` after a load; `again()` rebuilds after a delete. */
  function savesList(box, done, again) {
    const list = el("div", "saves");
    const saves = app.savedCities();
    if (!saves.length) list.append(el("div", "dim", "none yet — S saves the current city"));
    for (const s of saves) {
      const r = el("div", "save");
      const bits = [];
      if (s.saved) bits.push(`saved ${s.saved.date} · ${s.saved.pop} animals`);
      if (s.auto) bits.push(`autosave ${s.auto.date} · ${s.auto.pop} animals`);
      if (s.when) bits.push(s.when);
      r.append(el("b", "", s.name), el("span", "dim", ` ${bits.join(" · ")}`));
      const load = el("button", "", "load");
      load.title = s.saved ? "the S checkpoint" : "no checkpoint — S saves one";
      load.disabled = !s.saved;
      load.addEventListener("click", () => { if (app.load(s.name)) done(); });
      r.append(load);
      if (s.auto) {
        const res = el("button", "", "resume");
        res.title = "the autosave (every 12 months and on leaving the page)";
        res.addEventListener("click", () => { if (app.resumeAuto(s.name)) done(); });
        r.append(res);
      }
      const del = el("button", "", "delete");
      del.addEventListener("click", () => { if (confirm(`Delete "${s.name}" (checkpoint and autosave)?`)) { app.deleteCity(s.name); again(); } });
      r.append(del);
      list.append(r);
    }
    box.append(list);
    return list;
  }

  /** Export the current city as text / import one. `done()` after an import. */
  function portBox(box, done) {
    const ta = el("textarea");
    ta.rows = 4;
    ta.spellcheck = false;
    ta.placeholder = "paste a city here and press IMPORT — or EXPORT the current one";
    const br = el("div", "btnrow");
    const ex = el("button", "", "EXPORT current");
    ex.addEventListener("click", () => { ta.value = app.exportText(); ta.select(); });
    const im = el("button", "", "IMPORT");
    im.addEventListener("click", () => { try { app.importText(ta.value); done(); } catch (e) { flash(`Import failed: ${e.message}`); } });
    br.append(ex, im);
    box.append(ta, br);
    return ta;
  }

  function openNewCity() {
    dom.newcity.innerHTML = "";
    const box = el("div", "modalbox wide");
    box.append(el("h2", "", "A new city"));
    const seed = foundForm(box, closeModals);
    box.append(el("h2", "", "Saved cities"));
    savesList(box, closeModals, openNewCity);
    box.append(el("h2", "", "Export / import"));
    portBox(box, closeModals);
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
  function closeModals() { dom.newcity.hidden = true; }
  // The title screen counts: the clock stops under it (main.js) and Esc is its own (input.js).
  const modalOpen = () => !dom.newcity.hidden || !dom.choice.hidden || !!(app.title && app.title.isOpen());

  function setWorld() {
    // A loaded city brings its event log and yearly reports back into the ticker.
    const w = world();
    logLines = [];
    const rows = [];
    for (const e of w.events.log || []) rows.push({ t: e.t, label: dateOf(w, e.t).label, text: e.line });
    for (const h of w.history || []) rows.push({ t: h.tick, label: dateOf(w, h.tick).label, text: `REPORT ${dateOf(w, h.tick).year}: ${h.P} animals · approval ${h.approval} · unemployed ${h.U} · net ${h.income - h.upkeep < 0 ? "−" : "+"}§${Math.abs(h.income - h.upkeep).toLocaleString("en-US")}/yr · Zoo City index ${Math.round(h.H * 100)}%.` });
    rows.sort((a, b) => a.t - b.t);
    logLines = rows.slice(-200);
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

  return { refresh, onTick, setTool, setCost, flash, updateHover, showChoice, hideChoice, openNewCity, closeModals, modalOpen, setWorld, foundForm, savesList, portBox, get tab() { return tab; } };
}
