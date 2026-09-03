#!/usr/bin/env node
// meatprobe.mjs — run the meat ledger on the scripted mayor or a real save.
// Unlike the descriptive playtest probes, this one is also an accountant:
// malformed input or a broken conservation identity exits non-zero.
//
//   node tools/meatprobe.mjs [--years 30] [--seeds 7,3,5,11]
//                            [--layouts balanced,estate] [--markets 2]
//   node tools/meatprobe.mjs --save zoo-city.json [--years 10]

// The two distance columns are deliberately different. Physical is the
// number of tiles the cart draws; walk is the reach cost used by the meat
// service, where the owner's rule makes travel aboard rail free. Land value
// keeps using its own physical fields and is not measured or changed here.

import { readFileSync } from "node:fs";
import path from "node:path";
import { createWorld, ZONE, isPart } from "../js/sim/world.js";
import { tick } from "../js/sim/tick.js";
import { load, save } from "../js/sim/save.js";
import { hallStock, hallReach, meatBalance, meatTick, resetMeatRoutes } from "../js/sim/meat.js";
import { KNOBS } from "../js/sim/rules.js";
import { createMayor } from "./mayor.mjs";

const argv = process.argv.slice(2);
const VALUE_FLAGS = new Set(["--years", "--seeds", "--seed", "--layouts", "--layout", "--markets", "--save"]);
const FLAG_FLAGS = new Set(["--help", "--curves"]);

function usage() {
  console.log("usage: node tools/meatprobe.mjs [--years N] [--seeds a,b] [--layouts balanced,estate] [--markets N]");
  console.log("       node tools/meatprobe.mjs --save <export.json> [--years N]");
  console.log("       add --curves to run the MEAT_ROAD / MEAT_BUY_P / MEAT_EAT service curves");
}

function fail(message) {
  throw new Error(message);
}

function parseArgs() {
  const values = new Map();
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (FLAG_FLAGS.has(key)) { values.set(key, true); continue; }
    if (!VALUE_FLAGS.has(key)) fail(`unknown argument: ${key}`);
    if (values.has(key)) fail(`argument repeated: ${key}`);
    const value = argv[++i];
    if (value == null || value.startsWith("--")) fail(`${key} needs a value`);
    values.set(key, value);
  }
  if (values.has("--seed") && values.has("--seeds")) fail("use --seed or --seeds, not both");
  if (values.has("--layout") && values.has("--layouts")) fail("use --layout or --layouts, not both");
  const years = Number(values.get("--years") ?? 30);
  const markets = Number(values.get("--markets") ?? 2);
  if (!Number.isInteger(years) || years < 1 || years > 200) fail("--years must be an integer from 1 to 200");
  if (!Number.isInteger(markets) || markets < 0 || markets > 20) fail("--markets must be an integer from 0 to 20");
  const seeds = String(values.get("--seed") ?? values.get("--seeds") ?? "7,3,5,11").split(",").map((s) => s.trim()).filter(Boolean);
  const layouts = String(values.get("--layout") ?? values.get("--layouts") ?? "balanced,estate").split(",").map((s) => s.trim()).filter(Boolean);
  if (!seeds.length) fail("at least one seed is required");
  const allowed = new Set(["balanced", "dormitory", "millbelt", "estate"]);
  const badLayout = layouts.find((layout) => !allowed.has(layout));
  if (!layouts.length || badLayout) fail(`unknown layout: ${badLayout || "(empty)"}`);
  const saveFile = values.get("--save") || null;
  if (saveFile && (values.has("--seed") || values.has("--seeds") || values.has("--layout") || values.has("--layouts"))) {
    fail("--save takes the city shape from the file; do not combine it with seed/layout flags");
  }
  if (saveFile && values.has("--curves")) fail("--curves needs the reproducible scripted layouts, not --save");
  return { help: values.has("--help"), curves: values.has("--curves"), years, markets, seeds, layouts, saveFile };
}

const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const count = (o, key) => number(o?.[key]);
const copyTotals = (world) => ({ ...(world.meatStats?.total || {}) });
const delta = (after, before, key) => count(after, key) - count(before, key);
const stockSum = (world) => {
  let stock = 0;
  for (let i = 0; i < world.meat.length; i++) {
    if (world.zone[i] === ZONE.M && world.tier[i] > 0 && !isPart(world, i)) stock += hallStock(world, i);
  }
  return stock;
};

function runCity(world, label, years, mayor = null) {
  const before = copyTotals(world);
  const cutBefore = count(world.ledger, "cut");
  const stocks = [stockSum(world)];
  let hallMonths = 0;
  for (let t = 0; t < years * 12; t++) {
    if (mayor) mayor.month(t);
    tick(world);
    hallMonths += count(world.last?.census, "markets");
    stocks.push(stockSum(world));
  }
  const after = copyTotals(world);
  const flow = {};
  for (const key of ["bought", "killed", "convicted", "slaughtered", "eaten", "spoiled", "penBought", "penReleased", "cartTrips", "cartPhysical", "cartWalk"]) {
    flow[key] = delta(after, before, key);
    if (!Number.isFinite(flow[key]) || flow[key] < 0) fail(`${label}: invalid ${key} counter ${flow[key]}`);
  }
  const balance = meatBalance(world);
  if (!balance || balance.ok !== true) fail(`${label}: meat conservation failed (${JSON.stringify(balance)})`);
  if (balance.penOk !== true) fail(`${label}: pen lifecycle failed (${JSON.stringify(balance)})`);
  const measuredStock = stockSum(world);
  if (number(balance.stock) !== measuredStock) fail(`${label}: balance stock ${balance.stock} != hall stock ${measuredStock}`);
  if (mayor?.estate && !mayor.estate.rail) fail(`${label}: estate rail could not be built`);
  const hallYears = hallMonths / 12;
  const carts = flow.cartTrips;
  // Slaughtered counts grown animals; the conservation equation applies the
  // explicit two-unit PEN_YIELD at the stock boundary.
  const sourceUnits = flow.bought + flow.killed + flow.convicted + flow.slaughtered * KNOBS.PEN_YIELD;
  return {
    label, years, halls: count(world.last?.census, "markets"), hallYears,
    ...flow, sourceUnits,
    stockMin: Math.min(...stocks), stockMax: Math.max(...stocks), stock: measuredStock,
    soldPerHallYear: hallYears ? flow.eaten / hallYears : 0,
    meanPhysical: carts ? flow.cartPhysical / carts : 0,
    meanWalk: carts ? flow.cartWalk / carts : 0,
    cut: count(world.ledger, "cut") - cutBefore,
    balance,
  };
}

function generatedRows(options) {
  const rows = [];
  for (const layout of options.layouts) for (const seed of options.seeds) {
    const world = createWorld({ seed: `meat-${layout}-${seed}` });
    const mayor = createMayor(world, { layout, markets: options.markets });
    rows.push(runCity(world, `${layout}/${seed}`, options.years, mayor));
  }
  return rows;
}

function savedRow(options) {
  let raw;
  try { raw = readFileSync(options.saveFile, "utf8"); }
  catch (error) { fail(`cannot read --save ${options.saveFile}: ${error.message}`); }
  let world;
  try { world = load(raw); }
  catch (error) { fail(`invalid save ${options.saveFile}: ${error.message}`); }
  return [runCity(world, `save/${path.basename(options.saveFile)}`, options.years)];
}

function f(value, digits = 1) { return number(value).toFixed(digits); }

function report(rows, options) {
  console.log(options.saveFile
    ? `meatprobe: ${options.saveFile} + ${options.years} years`
    : `meatprobe: ${options.seeds.length} seeds × ${options.layouts.length} layouts × ${options.years} years`);
  console.log("| city | halls | bought | killed | convicted | pen bought | released | slaughtered adults | stock min→max→end | sold / hall-year | carts | physical / cart | free-rail walk / cart | cut | conservation |");
  console.log("|---|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|---:|---:|---|");
  for (const r of rows) {
    console.log(`| ${r.label} | ${r.halls} | ${r.bought} | ${r.killed} | ${r.convicted} | ${r.penBought} | ${r.penReleased} | ${r.slaughtered} | ${r.stockMin}→${r.stockMax}→${r.stock} | ${f(r.soldPerHallYear)} | ${r.cartTrips} | ${f(r.meanPhysical)} | ${f(r.meanWalk)} | §${Math.round(r.cut)} | ${r.balance.ok && r.balance.penOk ? "stock + pens exact" : "BROKEN"} |`);
  }
  const inflow = rows.reduce((sum, r) => sum + r.sourceUnits, 0);
  const eaten = rows.reduce((sum, r) => sum + r.eaten, 0);
  const spoiled = rows.reduce((sum, r) => sum + r.spoiled, 0);
  console.log(`\nsource inflow ${inflow} units · sold/eaten ${eaten} · spoiled ${spoiled} · ${rows.length}/${rows.length} stock and pen identities exact`);
}

const nondecreasing = (xs) => xs.every((x, i) => i === 0 || x >= xs[i - 1]);
const nonincreasing = (xs) => xs.every((x, i) => i === 0 || x <= xs[i - 1]);

/**
 * Develop one real estate and one real balanced city, then hold each city and
 * RNG state fixed while sweeping a knob. This measures the service law, not
 * unrelated population/RNG divergence between twelve independently evolved
 * towns (which can make a larger reach happen to see fewer deaths).
 */
function curveReport(options) {
  const seed = options.seeds[0];
  const years = Math.min(options.years, 12);
  const original = {
    MEAT_ROAD: KNOBS.MEAT_ROAD,
    MEAT_BUY_P: KNOBS.MEAT_BUY_P,
    MEAT_EAT: KNOBS.MEAT_EAT,
    PEN_BUY_P: KNOBS.PEN_BUY_P,
  };
  const develop = (layout) => {
    const world = createWorld({ seed: `meat-curve-${layout}-${seed}` });
    const mayor = createMayor(world, { layout, markets: options.markets });
    for (let t = 0; t < years * 12; t++) { mayor.month(t); tick(world); }
    return world;
  };
  const reachCounts = (base, values) => values.map((value) => {
    KNOBS.MEAT_ROAD = value;
    resetMeatRoutes(base);
    let reached = 0;
    for (let i = 0; i < base.zone.length; i++) {
      if (base.zone[i] === ZONE.R && base.tier[i] > 0 && !isPart(base, i) && hallReach(base, i)) reached++;
    }
    return reached;
  });
  const cleanMarket = (base) => {
    const world = load(save(base));
    world.meat.fill(0);
    world.meatStats = null;
    world.naturalDeaths = [];
    world.meatTrips = [];
    resetMeatRoutes(world);
    return world;
  };
  try {
    KNOBS.MEAT_ROAD = original.MEAT_ROAD;
    KNOBS.MEAT_BUY_P = original.MEAT_BUY_P;
    KNOBS.MEAT_EAT = original.MEAT_EAT;
    const estate = develop("estate");
    const balanced = develop("balanced");
    const roadValues = [0, 20, 40, 60, Infinity];
    const estateReach = reachCounts(estate, roadValues);
    const balancedReach = reachCounts(balanced, roadValues);
    KNOBS.MEAT_ROAD = original.MEAT_ROAD;

    const bodyHomes = [...new Set(estate.households.filter((h) => !h.gone && h.home >= 0).map((h) => h.home))];
    const buyValues = [0, 0.3, 0.6, 1];
    KNOBS.PEN_BUY_P = 0;
    KNOBS.MEAT_EAT = 0;
    const buyBought = buyValues.map((value) => {
      const world = cleanMarket(estate);
      world.naturalDeaths = bodyHomes.map((home, id) => ({ id: 900000 + id, name: `Curve body ${id}`, species: "rabbit", age: 40, home }));
      KNOBS.MEAT_BUY_P = value;
      meatTick(world);
      return world.meatStats?.total?.bought || 0;
    });
    KNOBS.MEAT_BUY_P = original.MEAT_BUY_P;

    const eatValues = [0, 0.05, 0.1];
    KNOBS.PEN_BUY_P = 0;
    KNOBS.MEAT_BUY_P = 0;
    const eatRows = eatValues.map((value) => {
      const world = cleanMarket(estate);
      for (let i = 0; i < world.zone.length; i++) if (world.zone[i] === ZONE.M && world.tier[i] > 0 && !isPart(world, i)) world.meat[i] = KNOBS.MEAT_CAP;
      KNOBS.MEAT_EAT = value;
      meatTick(world);
      return { sold: world.meatStats?.total?.eaten || 0, stock: stockSum(world) };
    });

    const fmt = (values, results) => values.map((v, i) => `${Number.isFinite(v) ? v : "∞"}:${results[i]}`).join(" · ");
    const eatSold = eatRows.map((r) => r.sold);
    const eatStock = eatRows.map((r) => r.stock);
    console.log(`\nservice curves: seed ${seed} · ${years} years · defaults ROAD ${original.MEAT_ROAD}, BUY_P ${original.MEAT_BUY_P}, EAT ${original.MEAT_EAT}`);
    console.log(`MEAT_ROAD estate reachable R lots — ${fmt(roadValues, estateReach)}`);
    console.log(`MEAT_ROAD balanced reachable R lots — ${fmt(roadValues, balancedReach)} · past-40 flat ${new Set(balancedReach.slice(2)).size === 1 ? "yes" : "no (measured topology)"}`);
    console.log(`MEAT_BUY_P estate fixed-body batch bought — ${fmt(buyValues, buyBought)}`);
    console.log(`MEAT_EAT estate fixed-city sold — ${fmt(eatValues, eatSold)} · end stock ${fmt(eatValues, eatStock)}`);
    if (!nondecreasing(estateReach) || !nondecreasing(balancedReach) || !nondecreasing(buyBought)
      || !nondecreasing(eatSold) || !nonincreasing(eatStock)) {
      fail("a service curve moved against its declared monotone direction");
    }
  } finally {
    Object.assign(KNOBS, original);
  }
}

try {
  const options = parseArgs();
  if (options.help) { usage(); process.exitCode = 0; }
  else {
    const rows = options.saveFile ? savedRow(options) : generatedRows(options);
    report(rows, options);
    if (options.curves) curveReport(options);
  }
} catch (error) {
  console.error(`meatprobe: ${error.message}`);
  process.exitCode = 1;
}
