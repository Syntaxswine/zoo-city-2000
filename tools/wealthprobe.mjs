// wealthprobe.mjs — THE ESTATE QUARTER, measured (SPEC §9f; the proposal's §7).
//
// The scripted mayor never builds culture, so every published rig forms ZERO
// mansions and proves nothing about this arc. This grafts an estate quarter
// into her town the month it is founded — the Estate plot at the corner of the
// first housing block, an Amphitheater beside it, a Library and a Gallery in
// reach, a park within four, one tree beside the plot; the shops are hers to
// grow across the ring road — and watches, per month, which rung of the
// ladder is unmet (the rung that never bites is not a rung), when the mansion
// rises, when a family takes it, who they are, what class the town's
// households take at arrival and what share of the R tax each class carries;
// and in the justice tally, every file by the victim's class and how it ended.
// Passive: exit 0 always, annotate, never judge.
//
//   node tools/wealthprobe.mjs [--layout estate|balanced] [--seed 7] [--years 30] [--at 0]
//                              [--without culture,knowledge,park,nature] [--stations] [--csv]
//   node tools/wealthprobe.mjs --justice [--seeds 1,2,3,4] [--years 30] [--layout estate]
//
// The probe pays for its own instruments (the buildings' cost is added to the
// treasury before each purchase) so the mayor's books are the mayor's.
import { createWorld, ZONE, TERRAIN, idx, inBounds, anchorOf } from "../js/sim/world.js";
import { createMayor } from "./mayor.mjs";
import { tick } from "../js/sim/tick.js";
import { apply } from "../js/sim/ops.js";
import { computeFields } from "../js/sim/fields.js";
import { KNOBS } from "../js/sim/rules.js";
import { CIVIC_SIDE } from "../js/sim/world.js";
import { attainableClass, rungsFor, CLASS_NAME, ESTATE } from "../js/sim/wealth.js";

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] != null ? args[i + 1] : d; };
const flag = (k) => args.includes(k);
const layout = arg("--layout", "estate");
const years = Number(arg("--years", 30));
const at = Number(arg("--at", 0));
const without = new Set((arg("--without", "") || "").split(",").filter(Boolean));
const csv = flag("--csv");
const justice = flag("--justice");
const seeds = justice ? (arg("--seeds", "1,2,3,4")).split(",") : [arg("--seed", "7")];

/** R chalk: zoned R, unbuilt, not in a block, dry. */
const chalk = (w, i) => w.zone[i] === ZONE.R && w.tier[i] === 0 && w.big[i] === 0 && !w.rubble[i] && w.terrain[i] !== TERRAIN.WATER && !w.civic[i] && !w.road[i];
/** The nearest side×side footprint of R chalk to (nx, ny), with a road touching it unless `needRoad` is false (a park needs none); { tx, ty } or null. */
function findChalk(w, side, nx, ny, maxD = 30, needRoad = true) {
  for (let d = 0; d <= maxD; d++) {
    for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
      const tx = nx + dx, ty = ny + dy;
      if (!inBounds(w, tx, ty) || !inBounds(w, tx + side - 1, ty + side - 1)) continue;
      let ok = true, touches = false;
      for (let y = 0; y < side && ok; y++) for (let x = 0; x < side; x++) {
        const i = idx(w, tx + x, ty + y);
        if (!chalk(w, i)) { ok = false; break; }
        if (w.roadDist[i] === 1) touches = true;
      }
      if (ok && (touches || !needRoad)) return { tx, ty };
    }
  }
  return null;
}
/** Unzone a footprint of chalk (free) and put `kind` on it, paying for the instrument out of the probe's pocket. */
function graft(w, kind, tx, ty, side) {
  apply(w, { kind: "bulldoze", x0: tx, y0: ty, x1: tx + side - 1, y1: ty + side - 1 });
  w.cash += KNOBS.COST[kind];
  const r = apply(w, { kind, tx, ty });
  return r.ok ? { tx, ty } : null;
}

/** Build the quarter into the mayor's freshly founded town. Returns what landed where. */
function graftQuarter(w, sx, sy) {
  computeFields(w);
  const where = {};
  const e = findChalk(w, 3, sx, sy);
  if (!e) return null;
  where.estate = graft(w, "estate", e.tx, e.ty, 3);
  const ax = e.tx, ay = e.ty;
  computeFields(w);
  // The tree and the park first — they want the tiles BESIDE the plot, which the campuses would otherwise take.
  if (!without.has("nature")) {
    // One tile of chalk among the anchor's eight neighbours becomes a tree: unzone it, plant it.
    for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
      const x = ax + dx, y = ay + dy;
      if (!inBounds(w, x, y)) continue;
      const i = idx(w, x, y);
      if (w.terrain[i] === TERRAIN.TREE || w.terrain[i] === TERRAIN.WATER) { where.nature = { tx: x, ty: y, already: true }; break; }
      if (!chalk(w, i) || w.big[i]) continue;
      apply(w, { kind: "bulldoze", x0: x, y0: y, x1: x, y1: y });
      w.cash += KNOBS.COST.tree;
      if (apply(w, { kind: "tree", x0: x, y0: y, x1: x, y1: y }).ok) { where.nature = { tx: x, ty: y }; break; }
    }
  }
  if (!without.has("park")) { const p = findChalk(w, 1, ax, ay, KNOBS.CLASS_PARK_RADIUS, false); if (p) { where.park = graft(w, "park", p.tx, p.ty, 1); computeFields(w); } }
  if (!without.has("culture")) {
    const am = findChalk(w, 3, ax, ay, 12); if (am) { where.amphitheater = graft(w, "amphitheater", am.tx, am.ty, 3); computeFields(w); }
    const g = findChalk(w, 2, ax, ay, 4); if (g) { where.gallery = graft(w, "gallery", g.tx, g.ty, 2); computeFields(w); }
  }
  if (!without.has("knowledge")) { const l = findChalk(w, 2, ax, ay, 4); if (l) { where.library = graft(w, "library", l.tx, l.ty, 2); computeFields(w); } }
  computeFields(w);
  return where;
}
/** Every rung unmet for EITHER class at the anchor — the card names only the next class's, the probe wants what binds the mansion. */
const allUnmet = (w, a) => { const seen = new Set(); for (const k of [1, 2]) for (const r of rungsFor(w, a, k)) if (!r.ok) seen.add(r.rung); return [...seen]; };

function runOne(seed, { quiet = false } = {}) {
  const world = createWorld({ seed });
  // The justice tally needs somewhere to PUT a convict, or every arrest waits: the mayor's prison at year 2, her centre (pacify) and one hall.
  const mayor = createMayor(world, { layout, rates: [8, 8, 8], disasters: false, stations: justice || flag("--stations"), zooYear: justice ? 2 : null, pacify: justice, markets: justice ? 1 : 0 });
  const sx = world.start.tx, sy = world.start.ty;
  let where = null, anchor = -1;
  const unmetMonths = {}; let monthsChalk = 0, sproutAt = -1, takenAt = -1, family = null;
  const rows = [];
  // Justice: every file the town opens, by the victim's class, and how it ended; the sentences from the log.
  const files = new Map(); const sentences = { 0: {}, 1: {}, 2: {} }; const seenLog = new Set(); let wrongfulNearEstate = 0, wrongful = 0;
  const causes = { 0: {}, 1: {}, 2: {} }; let hotMonths = 0, crimeMax = 0; // what the estate's files WERE, and whether the mansion was ever a hot lot
  for (let t = 0; t < years * 12; t++) {
    mayor.month(t);
    if (t === at * 12 && !where) { where = graftQuarter(world, sx, sy); anchor = where && where.estate ? idx(world, where.estate.tx, where.estate.ty) : -1; }
    tick(world);
    const c = world.last.census;
    if (anchor >= 0) {
      if (world.estate[anchor] === ESTATE.PLOT) {
        monthsChalk++;
        for (const rung of allUnmet(world, anchor)) unmetMonths[rung] = (unmetMonths[rung] || 0) + 1;
      } else if (sproutAt < 0) sproutAt = t;
      if (sproutAt >= 0 && takenAt < 0 && world.occupants[anchor] > 0) { takenAt = t; const hh = world.households.find((h) => !h.gone && h.home === anchor); family = hh ? `the ${hh.surname}s (${hh.members.length} ${hh.species})` : "?"; }
    }
    // Files: catch each while it is still in events.files (they are purged after FILE_MONTHS), then follow it to its end.
    for (const f of world.events.files) {
      const key = `${f.opened}:${f.tile}:${f.culpritId}:${f.cause}`;
      if (!files.has(key)) { files.set(key, { f, victimClass: f.victimClass || 0, cause: f.cause, ended: null }); const cs = causes[f.victimClass || 0]; cs[f.cause] = (cs[f.cause] || 0) + 1; }
    }
    if (anchor >= 0 && world.estate[anchor] === ESTATE.MANSION) { let hot = false; for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) { const j = anchor + dx + dy * world.w; crimeMax = Math.max(crimeMax, world.crime[j]); if (world.crime[j] > KNOBS.CRIME_HIGH) hot = true; } if (hot) hotMonths++; }
    for (const rec of files.values()) {
      if (rec.ended || !rec.f.closed) continue;
      const arrested = world.events.arrests.some((a) => a.culpritId === rec.f.culpritId && a.tile === rec.f.tile && a.cause === rec.f.cause && a.tick >= rec.f.opened && !a.wrongful);
      // A file that went cold with `waitingFor` set had a roll SUCCEED and no bed (or hall) to send the convict to — the sentence waited it out.
      rec.ended = arrested ? "arrested" : rec.f.waitingFor ? `cold-waiting-${rec.f.waitingFor}` : "cold";
    }
    for (const e of world.events.log) {
      if (e.id !== "arrest" || seenLog.has(`${e.t}:${e.line}`)) continue;
      seenLog.add(`${e.t}:${e.line}`);
      const kind = /^SOLD/.test(e.line) ? "hall" : /^TAKEN IN/.test(e.line) ? "centre" : /^CELLS/.test(e.line) ? "cells" : "waiting";
      const cls = /ultrawealthy/.test(e.line) ? 2 : 0;
      sentences[cls][kind] = (sentences[cls][kind] || 0) + 1;
    }
    for (const a of world.events.arrests) {
      if (!a.wrongful || seenLog.has(`w:${a.tick}:${a.citizenId}`)) continue;
      seenLog.add(`w:${a.tick}:${a.citizenId}`); wrongful++;
      if (anchor >= 0 && Math.max(Math.abs((a.tile % world.w) - (anchor % world.w)), Math.abs(((a.tile / world.w) | 0) - ((anchor / world.w) | 0))) <= 4) wrongfulNearEstate++;
    }
    if (t % 12 === 11) {
      rows.push({ year: (t + 1) / 12, P: c.P, by: c.byClass, share: c.taxShareByClass, cash: world.cash, estate: anchor >= 0 ? world.estate[anchor] : 0, occ: anchor >= 0 ? world.occupants[anchor] : 0,
        lv: anchor >= 0 ? world.lv[anchor] : 0, pol: anchor >= 0 ? world.pol[anchor] : 0, crime: anchor >= 0 ? world.crime[anchor] : 0, unmet: anchor >= 0 && world.estate[anchor] === ESTATE.PLOT ? allUnmet(world, anchor).join("+") : "" });
    }
  }
  const byClass = { 0: { n: 0, arrested: 0, cold: 0, open: 0, waited: {} }, 1: { n: 0, arrested: 0, cold: 0, open: 0, waited: {} }, 2: { n: 0, arrested: 0, cold: 0, open: 0, waited: {} } };
  for (const rec of files.values()) { const b = byClass[rec.victimClass]; b.n++; if (!rec.ended) b.open++; else if (rec.ended.startsWith("cold-waiting-")) { b.cold++; const k = rec.ended.slice(13); b.waited[k] = (b.waited[k] || 0) + 1; } else b[rec.ended]++; }
  return { world, where, anchor, rows, unmetMonths, monthsChalk, sproutAt, takenAt, family, byClass, sentences, wrongful, wrongfulNearEstate, causes, hotMonths, crimeMax };
}

const fmt = (n) => Number(n).toLocaleString("en-US");
if (!justice) {
  const seed = seeds[0];
  const r = runOne(seed);
  const w = r.world;
  console.log(`wealthprobe — layout ${layout} · seed ${seed} · quarter grafted at year ${at}${without.size ? ` · without ${[...without].join(",")}` : ""}`);
  if (!r.where) console.log("  NOWHERE TO PUT THE ESTATE — no 3×3 of chalk touching a road; nothing measured");
  else {
    console.log(`  landed: ${Object.entries(r.where).map(([k, v]) => `${k}${v ? ` (${v.tx},${v.ty})` : " NOWHERE"}`).join(" · ")}`);
    console.log(`  the ladder's binding rungs — months unmet while the plot was chalk (${r.monthsChalk} months): ${Object.entries(r.unmetMonths).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ") || "none"}`);
    console.log(`  the mansion: ${r.sproutAt < 0 ? "NEVER ROSE" : `rose in month ${r.sproutAt} (year ${Math.floor(r.sproutAt / 12)})`}${r.takenAt >= 0 ? ` · taken in month ${r.takenAt} by ${r.family}` : r.sproutAt >= 0 ? " · never taken" : ""}`);
  }
  if (csv) { console.log("year,P,modest,affluent,ultrawealthy,shareModest,shareAffluent,shareUltra,cash,estate,occ,lv,pol,crime,unmet"); for (const x of r.rows) console.log([x.year, x.P, ...x.by, ...x.share.map((s) => s.toFixed(3)), x.cash, x.estate, x.occ, x.lv, x.pol, x.crime, x.unmet].join(",")); }
  else {
    console.log(" yr     P  modest  affl  ultra | tax share m/a/u |   cash  | estate occ  LV pol crime  unmet");
    for (const x of r.rows) console.log(`${String(x.year).padStart(3)} ${String(x.P).padStart(5)} ${String(x.by[0]).padStart(7)} ${String(x.by[1]).padStart(5)} ${String(x.by[2]).padStart(6)} | ${x.share.map((s) => `${Math.round(100 * s)}%`.padStart(4)).join(" ")} | ${String(x.cash).padStart(7)} | ${["  —  ", "chalk", "MANS."][x.estate]} ${String(x.occ).padStart(3)} ${String(x.lv).padStart(3)} ${String(x.pol).padStart(3)} ${String(x.crime).padStart(5)}  ${x.unmet}`);
  }
  const last = r.rows[r.rows.length - 1];
  console.log(`end: P ${last.P} · ${last.by[1]} affluent (${Math.round(100 * last.by[1] / Math.max(1, last.P))}%) carrying ${Math.round(100 * last.share[1])}% of the R tax · ${last.by[2]} ultrawealthy carrying ${Math.round(100 * last.share[2])}% · cash ${fmt(last.cash)}`);
  const j = r.byClass;
  console.log(`files: plain ${j[0].n} (arrested ${j[0].arrested} · cold ${j[0].cold}) · affluent ${j[1].n} (arrested ${j[1].arrested} · cold ${j[1].cold}) · estate ${j[2].n} (arrested ${j[2].arrested} · cold ${j[2].cold}) · wrongful ${r.wrongful} (${r.wrongfulNearEstate} within 4 of the estate)`);
  console.log(`  the estate's files were: ${Object.entries(r.causes[2]).map(([k, v]) => `${k} ${v}`).join(" · ") || "none"} · the mansion was a hot lot (crime > ${KNOBS.CRIME_HIGH}) in ${r.hotMonths} months, crime at most ${r.crimeMax}`);
} else {
  console.log(`wealthprobe --justice — layout ${layout} · seeds ${seeds.join(",")} · ${years} y · one fire and one police station from year 2 (the mayor's --stations)`);
  const tot = { 0: { n: 0, arrested: 0, cold: 0, open: 0, waited: {} }, 1: { n: 0, arrested: 0, cold: 0, open: 0, waited: {} }, 2: { n: 0, arrested: 0, cold: 0, open: 0, waited: {} } };
  const sent = { 0: {}, 2: {} }; let wrongful = 0, near = 0, mansions = 0, taken = 0; const causes = { 0: {}, 1: {}, 2: {} }; let hotMonths = 0, crimeMax = 0;
  for (const seed of seeds) {
    const r = runOne(seed);
    for (const k of [0, 1, 2]) { for (const f of ["n", "arrested", "cold", "open"]) tot[k][f] += r.byClass[k][f]; for (const [s, n] of Object.entries(r.byClass[k].waited)) tot[k].waited[s] = (tot[k].waited[s] || 0) + n; }
    for (const k of [0, 2]) for (const [s, n] of Object.entries(r.sentences[k])) sent[k][s] = (sent[k][s] || 0) + n;
    wrongful += r.wrongful; near += r.wrongfulNearEstate; if (r.sproutAt >= 0) mansions++; if (r.takenAt >= 0) taken++;
    for (const k of [0, 1, 2]) for (const [cz, n] of Object.entries(r.causes[k])) causes[k][cz] = (causes[k][cz] || 0) + n;
    hotMonths += r.hotMonths; crimeMax = Math.max(crimeMax, r.crimeMax);
    console.log(`  seed ${seed}: mansion ${r.sproutAt < 0 ? "never" : `month ${r.sproutAt}`}${r.takenAt >= 0 ? `, taken month ${r.takenAt} by ${r.family}` : ""} · files plain ${r.byClass[0].n} / affluent ${r.byClass[1].n} / estate ${r.byClass[2].n}`);
  }
  const pct = (a, b) => (b ? `${Math.round(100 * a / b)}%` : "—");
  console.log(`mansions rose on ${mansions} of ${seeds.length} seeds, taken on ${taken}`);
  console.log(`clearance (arrested / files that ended): plain ${pct(tot[0].arrested, tot[0].arrested + tot[0].cold)} of ${tot[0].n} · affluent ${pct(tot[1].arrested, tot[1].arrested + tot[1].cold)} of ${tot[1].n} · estate ${pct(tot[2].arrested, tot[2].arrested + tot[2].cold)} of ${tot[2].n}`);
  console.log(`sentences: plain ${Object.entries(sent[0]).map(([k, v]) => `${k} ${v}`).join(" · ") || "none"} · from the ultrawealthy ${Object.entries(sent[2]).map(([k, v]) => `${k} ${v}`).join(" · ") || "none"}`);
  const waited = (k) => Object.entries(tot[k].waited).map(([s, n]) => `${n} waiting for ${s === "centre" ? "a centre bed" : s === "hall" ? "a hall" : "a cell"}`).join(", ") || "none";
  console.log(`of the cold files, the roll had SUCCEEDED and the sentence waited for somewhere to serve it: plain ${waited(0)} · affluent ${waited(1)} · estate ${waited(2)}`);
  console.log(`wrongful arrests ${wrongful}, ${near} within 4 of the estate`);
  console.log(`the estate's files were: ${Object.entries(causes[2]).map(([k, v]) => `${k} ${v}`).join(" · ") || "none"} · the plain ones: ${Object.entries(causes[0]).map(([k, v]) => `${k} ${v}`).join(" · ")} · a mansion was a hot lot in ${hotMonths} mansion-months, crime at most ${crimeMax}`);
  if (!tot[2].n) console.log("NOTE: no estate file was ever opened — a burglary picks a HOT lot (crime > CRIME_HIGH) and a mansion's own rungs keep its crime at 25 or under; the priority is real in the roll and rare in the street. The suite pins the roll and the sentence directly.");
}
