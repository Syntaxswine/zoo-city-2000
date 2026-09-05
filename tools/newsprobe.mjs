// newsprobe.mjs — measure Part F's people-story budget and identity contract.
//
//   node tools/newsprobe.mjs [--years 30] [--seeds 7,3,5,11] [--csv]
//
// The layout is the news instrument's established eight-block town, with a
// fire and police station. We retain EVERY row as it is emitted, even after
// the live 400-row cap rolls, so the people percentage is a true 30-year
// editorial budget rather than a flattering measurement of the final page.

import { probeSave } from "./probe-save.mjs";
import { createWorld, ZONE, TERRAIN, CIVIC } from "../js/sim/world.js";
import { tick } from "../js/sim/tick.js";
import { apply } from "../js/sim/ops.js";
import { newsRows, keyOf } from "../js/news.js";
import { legacyOf } from "../js/sim/legacy.js";
import { save, load, stateHashNoNews } from "../js/sim/save.js";

const argv = process.argv.slice(2);
const value = (key, fallback) => {
  const i = argv.indexOf(key);
  if (i < 0) return fallback;
  const v = argv[i + 1];
  if (v == null || v.startsWith("--")) throw new Error(`${key} needs a value`);
  return v;
};

let YEARS, SEEDS;
try {
  YEARS = Number(value("--years", 30));
  SEEDS = String(value("--seeds", "7,3,5,11")).split(",").filter(Boolean);
  if (!Number.isInteger(YEARS) || YEARS < 1 || YEARS > 200) throw new Error("--years must be an integer from 1 to 200");
  if (!SEEDS.length) throw new Error("--seeds must name at least one seed");
} catch (e) {
  console.error(`newsprobe: ${e.message}`);
  process.exit(2);
}
const SAVED = probeSave(argv, ["--seeds"]);
if (SAVED) SEEDS = ["export"];
const CSV = argv.includes("--csv");
const BLOCK = 6;
const ZONES = [ZONE.R, ZONE.R, ZONE.C, ZONE.I, ZONE.R, ZONE.C, ZONE.M, ZONE.I];

function build(seed) {
  const w = SAVED ? SAVED.world : createWorld({ seed });
  let blocks = 0;
  if (!SAVED) {
  const idx = (x, y) => y * w.w + x;
  const S = w.start;
  const inx = Math.sign(w.w / 2 - S.tx) || 1;
  const iny = Math.sign(w.h / 2 - S.ty) || 1;
  for (let b = 0; b < ZONES.length; b++) {
    const x0 = S.tx + inx * (2 + (b % 3) * BLOCK);
    const y0 = S.ty + iny * (2 + Math.floor(b / 3) * BLOCK);
    const X0 = Math.min(x0, x0 + inx * BLOCK);
    const Y0 = Math.min(y0, y0 + iny * BLOCK);
    if (X0 < 1 || Y0 < 1 || X0 + BLOCK >= w.w - 1 || Y0 + BLOCK >= w.h - 1) continue;
    let wet = 0;
    for (let y = Y0; y <= Y0 + BLOCK; y++) for (let x = X0; x <= X0 + BLOCK; x++) if (w.terrain[idx(x, y)] === TERRAIN.WATER) wet++;
    if (wet > 3) continue;
    const ring = [];
    for (let x = X0; x <= X0 + BLOCK; x++) { ring.push(idx(x, Y0)); ring.push(idx(x, Y0 + BLOCK)); }
    for (let y = Y0; y <= Y0 + BLOCK; y++) { ring.push(idx(X0, y)); ring.push(idx(X0 + BLOCK, y)); }
    for (let k = 0; k <= BLOCK * 3; k++) ring.push(idx(Math.min(w.w - 2, Math.max(1, S.tx + inx * k)), S.ty));
    apply(w, { kind: "road", tiles: ring });
    apply(w, { kind: "zone", zone: ZONES[b], x0: X0 + 1, y0: Y0 + 1, x1: X0 + BLOCK - 1, y1: Y0 + BLOCK - 1, density: 3 });
    blocks++;
  }
  for (const kind of ["fire", "police"]) {
    let placed=false;
    for(let i=0;i<w.w*w.h;i++) {
      if(apply(w,{kind,tx:i%w.w,ty:Math.floor(i/w.w)}).ok){placed=true;break;}
    }
    if(!placed) throw Error("news fixture could not place "+kind);
  }
  }
  const emitted = [];
  for (let n = 0; n < YEARS * 12; n++) {
    const month = w.tick;
    tick(w);
    for (const row of w.events.log) if (row.t === month) emitted.push(JSON.parse(JSON.stringify(row)));
  }
  return { w, blocks, emitted };
}

function measure(seed) {
  const { w, blocks, emitted } = build(seed);
  const all = newsRows({ ...w, events: { ...w.events, log: emitted } });
  const people = all.filter((r) => r.people);
  const unresolved = emitted.flatMap((r) => [...(Array.isArray(r.who) ? r.who : []), ...(Array.isArray(r.links) ? r.links : [])])
    .filter((id) => !w.byId.has(id) && !legacyOf(w, id));
  const flashed = all.filter((r) => r.flash);
  const perMonth = new Map();
  for (const r of flashed) perMonth.set(r.t, (perMonth.get(r.t) || 0) + 1);
  const current = newsRows(w);
  const loaded = newsRows(load(save(w)));
  const currentByKey = new Map(current.map((r) => [keyOf(r), JSON.stringify([r.who, r.links])]));
  const whoLost = loaded.filter((r) => currentByKey.get(keyOf(r)) !== JSON.stringify([r.who, r.links]));
  return {
    seed, blocks, pop: w.citizens.length, rows: all.length, people: people.length,
    pct: all.length ? (100 * people.length) / all.length : 0,
    obituary: all.filter((r) => r.id.startsWith("story-obituary:")).length,
    litter: all.filter((r) => r.id.startsWith("story-litter:")).length,
    centenary: all.filter((r) => r.id.startsWith("story-centenary:")).length,
    reports: all.filter((r) => r.report).length,
    flashed: flashed.length,
    multi: [...perMonth.values()].filter((n) => n > 1).length,
    unresolved: unresolved.length,
    whoLost: whoLost.length,
    noNews: stateHashNoNews(w),
  };
}

const rows = SEEDS.map(measure);
if (CSV) {
  console.log("seed,pop,dispatches,people,peoplePct,obituary,litter,centenary,reports,flashed,multiFlashMonths,unresolved,whoLost,noNewsHash");
  for (const r of rows) console.log([r.seed, r.pop, r.rows, r.people, r.pct.toFixed(1), r.obituary, r.litter, r.centenary, r.reports, r.flashed, r.multi, r.unresolved, r.whoLost, r.noNews].join(","));
} else {
  console.log(`newsprobe: ${YEARS} years · ${SAVED ? "export (no scripted construction)" : "eight-block news town + fire + police"}`);
  console.log("| seed | rows | people | share | obit / litter / 100 | reports | flashed | unresolved / lost | no-news hash |");
  console.log("|---|---:|---:|---:|---:|---:|---:|---:|---|");
  for (const r of rows) console.log(`| ${r.seed} | ${r.rows} | ${r.people} | ${r.pct.toFixed(1)}% | ${r.obituary} / ${r.litter} / ${r.centenary} | ${r.reports} | ${r.flashed} | ${r.unresolved} / ${r.whoLost} | ${r.noNews} |`);
}

// A tiny export may emit only one story: report its share, without treating
// that sample as a long-run budget measurement. Identity gates always apply.
const budgetSample = r => r.rows >= 30;
const bad = rows.filter((r) => (budgetSample(r) && r.pct > 40) || r.unresolved || r.whoLost || (!SAVED && r.blocks < 1));
if (bad.length) {
  console.error(`newsprobe: FAIL ${bad.map((r) => r.seed).join(", ")} (people must be <=40%; every who must resolve and survive save/load)`);
  process.exitCode = 1;
} else if (!CSV) {
  console.log(`PASS: every named id resolves and survives the saved tail; ${rows.filter(budgetSample).length} city samples meet the 40% people budget. ${rows.filter(r=>!budgetSample(r)).length} samples have fewer than 30 dispatches: budget reported, not gated.`);
}
