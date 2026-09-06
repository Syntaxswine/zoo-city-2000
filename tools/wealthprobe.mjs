// wealthprobe.mjs — THE MANSION THAT RISES, measured (SPEC §9f; the proposal's §7; the owner's rulings).
//
// The scripted mayor never builds culture, so every published rig stays in
// poverty and grows no mansion. This grafts the AMENITIES of an affluent
// quarter into her town the month it is founded — an Amphitheater, a Gallery
// and a Library in reach of the first housing block's corner, a park within
// four of it, one tree beside it; the shops are hers to grow across the ring
// road; the housing is hers too, and NOTHING is placed for the mansion — and
// watches, per month, which rung of the ladder is unmet at that corner (the
// rung that never bites is not a rung), the class of every address and every
// animal, the share of the R tax each class carries, when and where a mansion
// RISES on its own, who kept the house and how many were moved out; and in
// the justice tally, every file by the class at the victim's address and how
// it ended. Passive: exit 0 always, annotate, never judge.
//
//   node tools/wealthprobe.mjs [--layout estate|balanced] [--seed 7] [--years 30] [--at 0] [--bare | --dense]
//                              [--without culture,knowledge,park,nature,low,largePark,police] [--stations] [--csv]
//
// THE QUARTER A PLAYER WOULD PLAN (default): the housing round the window repainted LOW density, a Large Park within five and
// a police station within reach as well — because the first run showed the law: inside a High block the heart of any 3×3
// reads crime 100 (density is crime, Micropolis's own rule) and pollution from the pig tenements beside it, so no window
// there is ever affluent. --bare grafts only the four amenities and the tree, and measures that; --dense is the same graft
// named for the question it asks — does a mansion rise INSIDE the dense block? — and both tally what a rise costs the
// street: how many animals were moved out, and how many households were camping the month it rose and a year on.
//   node tools/wealthprobe.mjs --justice [--seeds 1,2,3,4] [--years 30] [--layout estate]
//
// The probe pays for its own instruments (the buildings' cost is added to the
// treasury before each purchase) so the mayor's books are the mayor's.
import { createWorld, ZONE, TERRAIN, idx, inBounds, isPart } from "../js/sim/world.js";
import { createMayor } from "./mayor.mjs";
import { tick } from "../js/sim/tick.js";
import { apply } from "../js/sim/ops.js";
import { computeFields } from "../js/sim/fields.js";
import { KNOBS } from "../js/sim/rules.js";
import { rungsFor, siteOf } from "../js/sim/wealth.js";

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] != null ? args[i + 1] : d; };
const flag = (k) => args.includes(k);
const layout = arg("--layout", "estate");
const years = Number(arg("--years", 30));
const at = Number(arg("--at", 0));
const without = new Set((arg("--without", "") || "").split(",").filter(Boolean));
const csv = flag("--csv");
const bare = flag("--bare") || flag("--dense");
if (bare) for (const k of ["low", "largePark", "police"]) without.add(k);
const justice = flag("--justice");
const seeds = justice ? (arg("--seeds", "1,2,3,4")).split(",") : [arg("--seed", "7")];

/** R chalk: zoned R, unbuilt, not in a block, dry. */
const chalk = (w, i) => w.zone[i] === ZONE.R && w.tier[i] === 0 && w.big[i] === 0 && !w.rubble[i] && w.terrain[i] !== TERRAIN.WATER && !w.civic[i] && !w.road[i];
/** A side×side footprint of R chalk at exactly (tx, ty), with a road touching it unless `needRoad` is false; true or false. */
function chalkAt(w, tx, ty, side, needRoad) {
  if (!inBounds(w, tx, ty) || !inBounds(w, tx + side - 1, ty + side - 1)) return false;
  let touches = false;
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    const i = idx(w, tx + x, ty + y);
    if (!chalk(w, i)) return false;
    if (w.roadDist[i] === 1) touches = true;
  }
  return touches || !needRoad;
}
/** The nearest side×side footprint of R chalk to (nx, ny) that `ok` accepts, searched in rings; { tx, ty } or null. */
function findChalk(w, side, nx, ny, maxD, needRoad = true, ok = () => true) {
  for (let d = 0; d <= maxD; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== d) continue;
    const tx = nx + dx, ty = ny + dy;
    if (chalkAt(w, tx, ty, side, needRoad) && ok(tx, ty)) return { tx, ty };
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

/** Build the amenities round the first housing block's corner in the mayor's freshly founded town. Returns what landed where and the corner. */
function graftQuarter(w, sx, sy) {
  computeFields(w);
  const where = {};
  const e = findChalk(w, 3, sx, sy, 30); // the corner: a 3×3 of R chalk touching a road, nearest the start — the housing stays HERS
  if (!e) return null;
  where.corner = e;
  const ax = e.tx, ay = e.ty;
  const clearOfWindow = (side) => (tx, ty) => !(tx + side - 1 >= ax && tx <= ax + 2 && ty + side - 1 >= ay && ty <= ay + 2);
  // LOW density on the housing within two of the window FIRST (density is crime): zoning fells trees, so the tree comes after.
  if (!without.has("low")) {
    w.cash += 60 * KNOBS.COST.zoneR;
    const r = apply(w, { kind: "zone", zone: ZONE.R, x0: ax - 2, y0: ay - 2, x1: ax + 4, y1: ay + 4, density: 1 });
    let n = 0; for (let y = ay - 2; y <= ay + 4; y++) for (let x = ax - 2; x <= ax + 4; x++) if (inBounds(w, x, y) && w.zone[idx(w, x, y)] === ZONE.R && w.maxTier[idx(w, x, y)] === 1) n++;
    where.low = r.ok ? { tx: ax - 2, ty: ay - 2, tiles: n } : null;
    computeFields(w);
  }
  // Then the tree and the park — they want the tiles BESIDE the corner, which the campuses would otherwise take.
  if (!without.has("nature")) {
    for (const [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
      const x = ax + dx, y = ay + dy;
      if (!inBounds(w, x, y)) continue;
      const i = idx(w, x, y);
      if (w.terrain[i] === TERRAIN.TREE || w.terrain[i] === TERRAIN.WATER) { where.nature = { tx: x, ty: y, already: true }; break; }
      if (!chalk(w, i) || !clearOfWindow(1)(x, y)) continue;
      apply(w, { kind: "bulldoze", x0: x, y0: y, x1: x, y1: y });
      w.cash += KNOBS.COST.tree;
      if (apply(w, { kind: "tree", x0: x, y0: y, x1: x, y1: y }).ok) { where.nature = { tx: x, ty: y }; break; }
    }
  }
  if (!without.has("park")) { const p = findChalk(w, 1, ax, ay, KNOBS.CLASS_PARK_RADIUS, false, clearOfWindow(1)); if (p) { where.park = graft(w, "park", p.tx, p.ty, 1); computeFields(w); } }
  // The SMALL buildings next, because their reach is short (five from every tile) and the greedy 3×3s would take their chalk:
  // a Library within five of the window's heart, a Gallery likewise; then one corner shop zoned on the ring road (a player
  // would; it grows on its own when the C valve asks), then the Large Park within five (+6 land value, and the affluent's
  // park), the police station within reach (−60 crime), and the Amphitheater anywhere within twelve (its reach is an eighth
  // of the map).
  const hx = ax + 1, hy = ay + 1;
  if (!without.has("knowledge")) { const l = findChalk(w, 2, hx, hy, 5, true, clearOfWindow(2)); if (l) { where.library = graft(w, "library", l.tx, l.ty, 2); computeFields(w); } }
  if (!without.has("culture")) { const g = findChalk(w, 2, hx, hy, 5, true, clearOfWindow(2)); if (g) { where.gallery = graft(w, "gallery", g.tx, g.ty, 2); computeFields(w); } }
  if (!without.has("shops")) {
    const s = findChalk(w, 1, ax, ay, 4, true, clearOfWindow(1));
    if (s) { apply(w, { kind: "bulldoze", x0: s.tx, y0: s.ty, x1: s.tx, y1: s.ty }); w.cash += KNOBS.COST.zoneC; const r = apply(w, { kind: "zone", zone: ZONE.C, x0: s.tx, y0: s.ty, x1: s.tx, y1: s.ty, density: 3 }); where.shop = r.ok ? s : null; computeFields(w); }
  }
  if (!without.has("largePark")) { const lp = findChalk(w, 3, ax, ay, 5, false, clearOfWindow(3)); if (lp) { where.largePark = graft(w, "largePark", lp.tx, lp.ty, 3); computeFields(w); } }
  if (!without.has("police")) { const ps = findChalk(w, 3, ax, ay, 8, true, clearOfWindow(3)); if (ps) { where.police = graft(w, "police", ps.tx, ps.ty, 3); computeFields(w); } }
  if (!without.has("culture")) { const am = findChalk(w, 3, ax, ay, 12, true, clearOfWindow(3)); if (am) { where.amphitheater = graft(w, "amphitheater", am.tx, am.ty, 3); computeFields(w); } }
  where.upkeep = (where.largePark ? KNOBS.UPKEEP_LARGE_PARK : 0) + (where.police ? KNOBS.UPKEEP_STATION : 0) + (where.amphitheater ? KNOBS.UPKEEP_AMPHITHEATER : 0) + (where.gallery ? KNOBS.UPKEEP_GALLERY : 0) + (where.library ? KNOBS.UPKEEP_LIBRARY : 0) + (where.park ? KNOBS.UPKEEP_PARK : 0);
  computeFields(w);
  return where;
}
/** Every rung unmet for EITHER class at the corner's WINDOW — the 3×3 read as a mansion would be (at its heart, nature round its border) — what binds the mansion, whatever the card's next rung is. */
const allUnmet = (w, a) => { const site = siteOf(w, a, [0, 1, 2].flatMap((dy) => [0, 1, 2].map((dx) => a + dx + dy * w.w))); const seen = new Set(); for (const k of [1, 2]) for (const r of rungsFor(w, site, k)) if (!r.ok) seen.add(r.rung); return [...seen]; };

function runOne(seed) {
  const world = createWorld({ seed });
  // The justice tally needs somewhere to PUT a convict, or every arrest waits: the mayor's prison at year 2, her centre (pacify) and one hall.
  const mayor = createMayor(world, { layout, rates: [8, 8, 8], disasters: false, stations: justice || flag("--stations"), zooYear: justice ? 2 : null, pacify: justice, markets: justice ? 1 : 0 });
  const sx = world.start.tx, sy = world.start.ty;
  let where = null, corner = -1;
  const unmetMonths = {}; let monthsWaiting = 0;
  const risen = []; // { t, anchor, line, displaced, campers }
  const campersByMonth = []; // households in tents each month — what a rise costs the street shows here a year on
  const rows = [];
  const files = new Map(); const sentences = { 0: {}, 1: {}, 2: {} }; const seenLog = new Set(); let wrongful = 0, wrongfulNearMansion = 0;
  const causes = { 0: {}, 1: {}, 2: {} }; let hotMansionMonths = 0, mansionCrimeMax = 0;
  for (let t = 0; t < years * 12; t++) {
    mayor.month(t);
    if (t === at * 12 && !where) { where = graftQuarter(world, sx, sy); corner = where && where.corner ? idx(world, where.corner.tx, where.corner.ty) : -1; }
    tick(world);
    campersByMonth[t] = world.campers.length;
    const c = world.last.census;
    if (corner >= 0 && !risen.length) { monthsWaiting++; for (const rung of allUnmet(world, corner)) unmetMonths[rung] = (unmetMonths[rung] || 0) + 1; }
    for (const e of world.events.log) {
      if (e.id !== "mansion" || seenLog.has(`m:${e.t}:${e.line}`)) continue;
      seenLog.add(`m:${e.t}:${e.line}`);
      const m = e.line.match(/risen at \((\d+),(\d+)\)/);
      const d = e.line.match(/(\d+) animals? (?:was|were) moved out/);
      risen.push({ t: e.t, anchor: m ? idx(world, Number(m[1]), Number(m[2])) : -1, line: e.line, displaced: d ? Number(d[1]) : 0, campers: world.campers.length });
    }
    // Files: catch each while it is still in events.files (they are purged after FILE_MONTHS), then follow it to its end.
    for (const f of world.events.files) {
      const key = `${f.opened}:${f.tile}:${f.culpritId}:${f.cause}`;
      if (!files.has(key)) { files.set(key, { f, victimClass: f.victimClass || 0, cause: f.cause, ended: null }); const cs = causes[f.victimClass || 0]; cs[f.cause] = (cs[f.cause] || 0) + 1; }
    }
    for (const rec of files.values()) {
      if (rec.ended || !rec.f.closed) continue;
      const arrested = world.events.arrests.some((a) => a.culpritId === rec.f.culpritId && a.tile === rec.f.tile && a.cause === rec.f.cause && a.tick >= rec.f.opened && !a.wrongful);
      rec.ended = arrested ? "arrested" : rec.f.waitingFor ? `cold-waiting-${rec.f.waitingFor}` : "cold";
    }
    for (const e of world.events.log) {
      if (e.id !== "arrest" || seenLog.has(`${e.t}:${e.line}`)) continue;
      seenLog.add(`${e.t}:${e.line}`);
      const kind = /^SOLD/.test(e.line) ? "hall" : /^TAKEN IN/.test(e.line) ? "centre" : /^CELLS/.test(e.line) ? "cells" : "waiting";
      const cls = /affluent/.test(e.line) ? 2 : 0;
      sentences[cls][kind] = (sentences[cls][kind] || 0) + 1;
    }
    for (const a of world.events.arrests) {
      if (!a.wrongful || seenLog.has(`w:${a.tick}:${a.citizenId}`)) continue;
      seenLog.add(`w:${a.tick}:${a.citizenId}`); wrongful++;
      for (const r of risen) if (r.anchor >= 0 && Math.max(Math.abs((a.tile % world.w) - (r.anchor % world.w)), Math.abs(((a.tile / world.w) | 0) - ((r.anchor / world.w) | 0))) <= 4) { wrongfulNearMansion++; break; }
    }
    for (const r of risen) if (r.anchor >= 0 && world.mansion[r.anchor]) { let hot = false; for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) { const j = r.anchor + dx + dy * world.w; mansionCrimeMax = Math.max(mansionCrimeMax, world.crime[j]); if (world.crime[j] > KNOBS.CRIME_HIGH) hot = true; } if (hot) hotMansionMonths++; }
    if (t % 12 === 11) {
      const lots = [0, 0, 0];
      for (let i = 0; i < world.w * world.h; i++) if (world.zone[i] === ZONE.R && !isPart(world, i) && world.tier[i] > 0) lots[world.klass[i]]++;
      const heart = corner >= 0 ? corner + 1 + world.w : -1; // the window's heart: where its ladder is read
      rows.push({ year: (t + 1) / 12, P: c.P, by: c.byClass, share: c.taxShareByClass, cash: world.cash, mansions: c.mansions, lots, lv: heart >= 0 ? world.lv[heart] : 0, pol: heart >= 0 ? world.pol[heart] : 0, crime: heart >= 0 ? world.crime[heart] : 0,
        unmet: corner >= 0 && !risen.length ? allUnmet(world, corner).join("+") : "" });
    }
  }
  const byClass = { 0: { n: 0, arrested: 0, cold: 0, open: 0, waited: {} }, 1: { n: 0, arrested: 0, cold: 0, open: 0, waited: {} }, 2: { n: 0, arrested: 0, cold: 0, open: 0, waited: {} } };
  for (const rec of files.values()) { const b = byClass[rec.victimClass]; b.n++; if (!rec.ended) b.open++; else if (rec.ended.startsWith("cold-waiting-")) { b.cold++; const k = rec.ended.slice(13); b.waited[k] = (b.waited[k] || 0) + 1; } else b[rec.ended]++; }
  return { world, where, corner, rows, unmetMonths, monthsWaiting, risen, campersByMonth, byClass, sentences, wrongful, wrongfulNearMansion, causes, hotMansionMonths, mansionCrimeMax };
}

const fmt = (n) => Number(n).toLocaleString("en-US");
const where = (r) => Object.entries(r.where || {}).filter(([k]) => k !== "upkeep").map(([k, v]) => `${k}${v ? ` (${v.tx},${v.ty})${v.tiles ? ` ×${v.tiles} tiles` : ""}` : " NOWHERE"}`).join(" · ") + ` · the quarter's upkeep §${(r.where && r.where.upkeep) || 0}/yr`;
if (!justice) {
  const seed = seeds[0];
  const r = runOne(seed);
  console.log(`wealthprobe — layout ${layout} · seed ${seed} · ${bare ? "the four amenities and a tree" : "a planned quarter (low density, large park, police, culture, knowledge, park, tree)"} grafted at year ${at}${without.size && !bare ? ` · without ${[...without].join(",")}` : ""}`);
  if (!r.where) console.log("  NOWHERE TO PUT THE QUARTER — no 3×3 of R chalk touching a road; nothing measured");
  else {
    console.log(`  landed: ${where(r)}`);
    console.log(`  the ladder's binding rungs at the corner — months unmet before the first mansion (${r.monthsWaiting} months): ${Object.entries(r.unmetMonths).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ") || "none"}`);
    console.log(`  mansions: ${r.risen.length ? r.risen.map((m) => `month ${m.t} at (${m.anchor % r.world.w},${(m.anchor / r.world.w) | 0}) — ${m.displaced} moved out; ${m.campers} household${m.campers === 1 ? "" : "s"} camping that month, ${r.campersByMonth[m.t + 12] ?? "—"} a year on`).join(" · ") : "NONE ROSE"}`);
    if (r.risen.length) console.log(`  what the rises cost the street: ${r.risen.reduce((s, m) => s + m.displaced, 0)} animals moved out over ${r.risen.length} mansion${r.risen.length === 1 ? "" : "s"}`);
    for (const m of r.risen.slice(0, 3)) console.log(`    ${m.line}`);
  }
  if (csv) { console.log("year,P,poverty,modest,affluent,sharePoverty,shareModest,shareAffluent,cash,mansions,lotsPoverty,lotsModest,lotsAffluent,lv,pol,crime,unmet"); for (const x of r.rows) console.log([x.year, x.P, ...x.by, ...x.share.map((s) => s.toFixed(3)), x.cash, x.mansions, ...x.lots, x.lv, x.pol, x.crime, x.unmet].join(",")); }
  else {
    console.log(" yr     P  poverty modest  affl | tax share p/m/a | lots p/m/a  |   cash  | mans |  heart LV pol crime  unmet");
    for (const x of r.rows) console.log(`${String(x.year).padStart(3)} ${String(x.P).padStart(5)} ${String(x.by[0]).padStart(8)} ${String(x.by[1]).padStart(6)} ${String(x.by[2]).padStart(5)} | ${x.share.map((s) => `${Math.round(100 * s)}%`.padStart(4)).join(" ")} | ${x.lots.map((n) => String(n).padStart(3)).join(" ")} | ${String(x.cash).padStart(7)} | ${String(x.mansions).padStart(4)} | ${String(x.lv).padStart(9)} ${String(x.pol).padStart(3)} ${String(x.crime).padStart(5)}  ${x.unmet}`);
  }
  const last = r.rows[r.rows.length - 1];
  console.log(`end: P ${last.P} · ${last.by[0]} in poverty · ${last.by[1]} modest carrying ${Math.round(100 * last.share[1])}% of the R tax · ${last.by[2]} affluent carrying ${Math.round(100 * last.share[2])}% · ${last.mansions} mansion${last.mansions === 1 ? "" : "s"} · cash ${fmt(last.cash)}`);
  const j = r.byClass;
  console.log(`files: poverty ${j[0].n} (arrested ${j[0].arrested} · cold ${j[0].cold}) · modest ${j[1].n} (arrested ${j[1].arrested} · cold ${j[1].cold}) · affluent ${j[2].n} (arrested ${j[2].arrested} · cold ${j[2].cold}) · wrongful ${r.wrongful} (${r.wrongfulNearMansion} within 4 of a mansion)`);
  console.log(`  the affluent files were: ${Object.entries(r.causes[2]).map(([k, v]) => `${k} ${v}`).join(" · ") || "none"} · a mansion was a hot lot (crime > ${KNOBS.CRIME_HIGH}) in ${r.hotMansionMonths} mansion-months, crime at most ${r.mansionCrimeMax}`);
} else {
  console.log(`wealthprobe --justice — layout ${layout} · seeds ${seeds.join(",")} · ${years} y · a fire and a police station from year 2, a prison, a centre and a hall (the mayor's --stations --zoo 2 --pacify --markets 1)`);
  const tot = { 0: { n: 0, arrested: 0, cold: 0, open: 0, waited: {} }, 1: { n: 0, arrested: 0, cold: 0, open: 0, waited: {} }, 2: { n: 0, arrested: 0, cold: 0, open: 0, waited: {} } };
  const sent = { 0: {}, 2: {} }; let wrongful = 0, near = 0, mansions = 0, seedsWith = 0, displaced = 0; const causes = { 0: {}, 1: {}, 2: {} }; let hot = 0, crimeMax = 0;
  for (const seed of seeds) {
    const r = runOne(seed);
    for (const k of [0, 1, 2]) { for (const f of ["n", "arrested", "cold", "open"]) tot[k][f] += r.byClass[k][f]; for (const [s, n] of Object.entries(r.byClass[k].waited)) tot[k].waited[s] = (tot[k].waited[s] || 0) + n; }
    for (const k of [0, 2]) for (const [s, n] of Object.entries(r.sentences[k])) sent[k][s] = (sent[k][s] || 0) + n;
    for (const k of [0, 1, 2]) for (const [cz, n] of Object.entries(r.causes[k])) causes[k][cz] = (causes[k][cz] || 0) + n;
    wrongful += r.wrongful; near += r.wrongfulNearMansion; mansions += r.risen.length; if (r.risen.length) seedsWith++; hot += r.hotMansionMonths; crimeMax = Math.max(crimeMax, r.mansionCrimeMax);
    displaced += r.risen.reduce((s, m) => s + m.displaced, 0);
    const last = r.rows[r.rows.length - 1];
    console.log(`  seed ${seed}: ${r.risen.length ? `${r.risen.length} mansion${r.risen.length === 1 ? "" : "s"} (first month ${r.risen[0].t})` : "no mansion"} · y30 class ${last.by.join("/")} · files poverty ${r.byClass[0].n} / modest ${r.byClass[1].n} / affluent ${r.byClass[2].n}`);
  }
  const pct = (a, b) => (b ? `${Math.round(100 * a / b)}%` : "—");
  console.log(`mansions rose on ${seedsWith} of ${seeds.length} seeds, ${mansions} in all; ${displaced} animals were moved out to make room`);
  console.log(`clearance (arrested / files that ended): poverty ${pct(tot[0].arrested, tot[0].arrested + tot[0].cold)} of ${tot[0].n} · modest ${pct(tot[1].arrested, tot[1].arrested + tot[1].cold)} of ${tot[1].n} · affluent ${pct(tot[2].arrested, tot[2].arrested + tot[2].cold)} of ${tot[2].n}`);
  console.log(`sentences: plain ${Object.entries(sent[0]).map(([k, v]) => `${k} ${v}`).join(" · ") || "none"} · from the affluent ${Object.entries(sent[2]).map(([k, v]) => `${k} ${v}`).join(" · ") || "none"}`);
  const waited = (k) => Object.entries(tot[k].waited).map(([s, n]) => `${n} waiting for ${s === "centre" ? "a centre bed" : s === "hall" ? "a hall" : "a cell"}`).join(", ") || "none";
  console.log(`of the cold files, the roll had SUCCEEDED and the sentence waited for somewhere to serve it: poverty ${waited(0)} · modest ${waited(1)} · affluent ${waited(2)}`);
  console.log(`wrongful arrests ${wrongful}, ${near} within 4 of a mansion`);
  console.log(`the affluent files were: ${Object.entries(causes[2]).map(([k, v]) => `${k} ${v}`).join(" · ") || "none"} · the poverty ones: ${Object.entries(causes[0]).map(([k, v]) => `${k} ${v}`).join(" · ")} · a mansion was a hot lot in ${hot} mansion-months, crime at most ${crimeMax}`);
  if (!tot[2].n) console.log("NOTE: no file from an affluent address was ever opened — a burglary picks a HOT lot (crime > CRIME_HIGH) and an affluent address's own rungs keep its crime at 25 or under; the priority is real in the roll and rare in the street. The suite pins the roll and the sentence directly.");
}
