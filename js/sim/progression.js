// Campaign state lives in flags, so saves, undo boundaries and replay share it.
import { CIVIC, TERRAIN, ZONE, civicTiles, anchorOf } from "./world.js";
import { served } from "./fields.js";
import { forEachWithinAll } from "./reach.js";
import { KNOBS } from "./rules.js";

export const CHAPTERS = Object.freeze([
  { name: "The River Settlement", target: 100, story: "A road reaches the river. Lay out cottages and working farms; one farm feeds 25 villagers." },
  { name: "The Town", target: 500, story: "The settlement earns its name. Shops, workshops, police and cemeteries open; better tools and storage double each farm's harvest." },
  { name: "The City", target: 1500, story: "Survival becomes civic life. Libraries, galleries, parks, zoos, pacification centres and high density are available. Irrigation doubles farm capacity." },
  { name: "The Sanitation Crisis", target: 3000, story: "Density leaves a mark on the river. Build sanitation works and garbage depots. You have six months before waste accumulates; cleaner storage doubles farm capacity." },
  { name: "The Metropolis", target: null, story: "The river city has learned to care for itself. Every tool is available, and mechanized farms support 400 villagers each. Its future is yours." },
]);
const UNLOCK = { road: 0, R: 0, M: 0, farm: 0, fire: 0, inspect: 0, bulldoze: 0,
  C: 1, I: 1, police: 1, interview: 1, collect: 1, cemetery: 1, library: 2, gallery: 2, park: 2, largePark: 2,
  zoo: 2, centre: 2, sanitation: 3, garbage: 3 };
export const chapterOf = w => w.flags?.campaign?.chapter ?? 4;
export const farmYield = w => KNOBS.FARM_CAPACITY[chapterOf(w)];
export function lockedReason(w, op) {
  if (!w.flags?.campaign) return "";
  if (["rate", "toggle", "cheat", "choice", "undo"].includes(op.kind)) return "";
  if (op.kind === "zone" && (op.density ?? 3) > 1) {
    const required = op.zone === ZONE.M ? 4 : 2;
    if (chapterOf(w) < required) return `High density unlocks in Chapter ${required + 1}: ${CHAPTERS[required].name}. Use Low density.`;
  }
  const id = op.kind === "zone" ? ["", "R", "C", "I", "M"][op.zone] : op.kind;
  const required = UNLOCK[id] ?? 4;
  return chapterOf(w) < required ? `Unlocks in Chapter ${required + 1}: ${CHAPTERS[required].name}.` : "";
}

// Floodplain is land within three tiles of edge-connected water, excluding
// isolated ponds. Rebuilt from terrain: a save needs no second river bitmap.
export function floodplain(w) {
  const n = w.w * w.h, water = new Uint8Array(n), mask = new Uint8Array(n), q = [];
  const push = i => { if (!water[i] && w.terrain[i] === TERRAIN.WATER) { water[i] = 1; q.push(i); } };
  for (let x = 0; x < w.w; x++) { push(x); push((w.h - 1) * w.w + x); }
  for (let y = 0; y < w.h; y++) { push(y * w.w); push(y * w.w + w.w - 1); }
  for (let k = 0; k < q.length; k++) {
    const i = q[k], x = i % w.w, y = Math.floor(i / w.w);
    if (x) push(i - 1); if (x + 1 < w.w) push(i + 1);
    if (y) push(i - w.w); if (y + 1 < w.h) push(i + w.w);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      if (x + dx >= 0 && x + dx < w.w && y + dy >= 0 && y + dy < w.h) {
        const j = i + dx + dy * w.w;
        if (w.terrain[j] !== TERRAIN.WATER) mask[j] = 1;
      }
    }
  }
  return mask;
}

export function activeInfrastructure(w, i) {
  return served(w, i) && civicTiles(w, i).every(j => !w.burning[j] && !w.rubble[j] && !w.flooded[j]);
}

export function computeInfrastructure(w) {
  const n = w.w * w.h;
  const covers = { sanitation: new Uint8Array(n), garbage: new Uint8Array(n) };
  const counts = { farm: 0, sanitation: 0, garbage: 0 };
  const total = { ...counts };
  for (let i = 0; i < n; i++) {
    const kind = ({ [CIVIC.FARM]: "farm", [CIVIC.SANITATION]: "sanitation", [CIVIC.GARBAGE]: "garbage" })[w.civic[i]];
    if (!kind) continue;
    total[kind]++;
    if (!activeInfrastructure(w, i)) continue;
    counts[kind]++;
    if (covers[kind]) forEachWithinAll(w, civicTiles(w, i), kind === "sanitation" ? KNOBS.SANITATION_RADIUS : KNOBS.INFRA_RADIUS, j => { covers[kind][j] = 1; });
  }
  let population = 0, housed = 0, sanitation = 0, garbage = 0;
  for (const c of w.citizens) {
    if (c.dead) continue;
    population++;
    if (c.home < 0) continue;
    housed++;
    const i = anchorOf(w, c.home);
    sanitation += covers.sanitation[i]; garbage += covers.garbage[i];
  }
  const sanitationCapacityShare = sanitation ? Math.min(1, counts.sanitation * KNOBS.INFRA_CAPACITY / sanitation) : 1;
  sanitation = Math.min(sanitation, counts.sanitation * KNOBS.INFRA_CAPACITY);
  garbage = Math.min(garbage, counts.garbage * KNOBS.INFRA_CAPACITY);
  w.infrastructure = { counts, total, covers, population, housed, sanitation, garbage, sanitationCapacityShare,
    sanitationShare: population ? sanitation / population : 1,
    garbageShare: population ? garbage / population : 1,
    food: counts.farm * farmYield(w) };
  return w.infrastructure;
}

export function sanitationTick(w) {
  const p = w.flags.campaign;
  if (!p || p.chapter < 3) return;
  const s = computeInfrastructure(w);
  if (w.tick - p.entered < KNOBS.SANITATION_GRACE) return;
  // One unit per resident per month. Spare treatment/collection capacity
  // clears the backlog only in proportion to the population it can reach.
  for (const kind of ["sanitation", "garbage"]) {
    const key = kind === "sanitation" ? "sewage" : "waste";
    const share = s[`${kind}Share`];
    const removed = s.counts[kind] * KNOBS.INFRA_CAPACITY * share;
    p[key] = Math.max(0, Math.min(KNOBS.WASTE_MAX_MONTHS * Math.max(1, s.population), p[key] + s.population - removed));
  }
}

export function progressionTick(w) {
  const p = w.flags.campaign;
  if (!p) return [];
  const s = computeInfrastructure(w), ch = CHAPTERS[p.chapter];
  if (!ch.target) return [];
  const clean = p.chapter !== 3 || (s.sanitationShare >= KNOBS.SANITATION_GOAL && s.garbageShare >= KNOBS.SANITATION_GOAL && p.waste + p.sewage <= s.population * KNOBS.WASTE_GOAL);
  const ready = s.population >= ch.target && s.food >= s.population && clean;
  p.stable = ready ? p.stable + 1 : 0;
  if (p.stable < KNOBS.CHAPTER_MONTHS) return [];
  p.chapter++; p.stable = 0; p.entered = w.tick + 1;
  return [`CHAPTER ${p.chapter + 1} — ${CHAPTERS[p.chapter].name.toUpperCase()}. ${CHAPTERS[p.chapter].story}`];
}

export function campaignText(w) {
  const p = w.flags.campaign;
  if (!p) return "Sandbox — all tools available.";
  const s = computeInfrastructure(w), ch = CHAPTERS[p.chapter];
  let text = `Chapter ${p.chapter + 1}/5 · ${ch.name} · ${s.population}${ch.target ? ` / ${ch.target}` : ""} villagers · Food ${s.population} / ${s.food} supported · ${s.counts.farm}/${s.total.farm} working farms × ${farmYield(w)}`;
  if (ch.target) text += ` · Stable ${p.stable}/${KNOBS.CHAPTER_MONTHS} months`;
  if (p.chapter >= 3) text += ` · Sanitation ${Math.round(s.sanitationShare * 100)}% · Garbage ${Math.round(s.garbageShare * 100)}% · Backlog ${Math.round(p.waste + p.sewage)} (goal ≤ ${Math.floor(s.population * KNOBS.WASTE_GOAL)})`;
  if (p.chapter === 3 && w.tick - p.entered < KNOBS.SANITATION_GRACE) text += ` · ${KNOBS.SANITATION_GRACE - (w.tick - p.entered)} months before waste accumulates`;
  return text;
}
