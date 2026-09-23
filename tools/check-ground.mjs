#!/usr/bin/env node
// tools/check-ground.mjs — the gate on the ground (T3.3). SPEC §12.4.
// docs/PROPOSAL-SPRITE-UPGRADE-2026-09-22.md, T3.3.
//
// The claims registered BEFORE the work, run here:
//
//   THE SPRITES   every corner combination a tile can hold is drawn, in six
//                 dithers · the three uniform seed-0 tiles ARE grass-0/1/2 ·
//                 no uniform tile, in any dither, leaves its own grass · a
//                 combination no tile can hold throws · grass keys only
//   THE FIELD     every corner of anything made is kept · no tile holds kept
//                 and rough · every tile in a real town is drawable · the
//                 field writes nothing and is the same twice · it loads from a
//                 save unchanged · making one thing moves only the corners
//                 round it · an open map grows all three
//   THE PATHS     every walked direction is drawn, trodden and worn · a tile
//                 walked towards nothing throws · earth only · each track
//                 reaches exactly the edges it names, centred where it
//                 crosses them · a real rider's commute wears exactly its four
//                 forecourt tiles, as the sim's own traffic count says ·
//                 trodden at three riders, worn at four, pixel for pixel
//   THE FRAME     through the real renderer, an open field shows no seam and
//                 less repeat than the quilt did — and the instrument, pointed
//                 at the quilt the game drew before, reads a seam, or the
//                 first two would prove nothing
//
// THE ONE THAT MATTERS MOST is the frame. Everything above it is a property of
// the parts; the claim T3.3 makes is about what the eye gets, and only the
// renderer's own frame can say whether the parts add up to a ground without
// tiles in it.

import { installCanvas, createCanvas } from "./headless-canvas.mjs";

installCanvas();

const { art, allSprites } = await import("../js/art/index.js");
const { GRASS, grassKey, diamond } = await import("../js/art/terrain.js");
const { meadowField, wornPaths, openGrass } = await import("../js/meadow.js");
const { createWorld, ZONE, ROAD, CIVIC, TERRAIN } = await import("../js/sim/world.js");
const { apply } = await import("../js/sim/ops.js");
const { computeFields, commutePath, computeTraffic, RIDE } = await import("../js/sim/fields.js");
await import("../js/sim/tick.js");
const { save, load } = await import("../js/sim/save.js");
const { createRenderer } = await import("../js/render.js");
const { toScreen } = await import("../js/iso/iso.js");
const { colourOf } = await import("../js/art/palette.js");
const { openField, keptBytes, groundReadings, quiltArt, PANEL } = await import("./groundprobe.mjs");

let checks = 0;
const check = (name, ok, detail = "") => {
  checks++;
  if (!ok) { console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`); process.exit(1); }
};
const throws = (f) => { try { f(); return false; } catch { return true; } };
const sameRows = (p, q) => p.length === q.length && p.every((r, i) => r === q[i]);

// ---- the sprites ----------------------------------------------------------------
// SPELT OUT, NOT IMPORTED: three levels, six dithers, and which corner
// combinations a tile may hold — at most one step of level between any two
// of its corners. A check that read these off terrain.js would be asking the
// module whether it agrees with itself.
const SEEDS = 6;
const ALL = [];
for (let n = 0; n < 81; n++) ALL.push([n % 3, ((n / 3) | 0) % 3, ((n / 9) | 0) % 3, ((n / 27) | 0) % 3]);
const reachable = ALL.filter((c) => Math.max(...c) - Math.min(...c) <= 1);
const unreachable = ALL.filter((c) => Math.max(...c) - Math.min(...c) > 1);
check("31 of the 81 corner combinations are ones a tile can hold", reachable.length === 31 && unreachable.length === 50);

const drawn = new Map();
const missing = [];
for (const c of reachable) for (let seed = 0; seed < SEEDS; seed++) {
  let s = null;
  try { s = art.meadow(c, seed); } catch { s = null; }
  if (!s || !Array.isArray(s.rows) || s.rows.length !== 32) missing.push(`${c.join("")}/${seed}`);
  else drawn.set(`${c.join("")}/${seed}`, s);
}
check("every combination a tile can hold is drawn, in six dithers", missing.length === 0, missing.slice(0, 6).join(" "));
check("…186 tiles, all of them different sprites", new Set(drawn.values()).size === 31 * SEEDS);
const named = allSprites().filter(({ name }) => /^meadow-[0-2]{4}-\d$/.test(name));
check("…and the audit walks the 183 that are new (art-dump and the twin gate read allSprites)", named.length === 31 * SEEDS - 3, `${named.length}`);
check("the seed is taken round, so any tile byte picks a dither", art.meadow([1, 1, 2, 1], 255) === art.meadow([1, 1, 2, 1], 255 % SEEDS));

for (const v of [0, 1, 2]) {
  check(`the uniform seed-0 tile at level ${v} IS grass-${v} — the same sprite, not a copy of it`, art.meadow([v, v, v, v], 0) === art.ground("grass", v) && GRASS[v] === art.ground("grass", v));
}
// The jitter must never move a uniform tile off its level: every dither of
// [v v v v] is grass-v's own texture in that dither, at 1× and at 2×.
const leaked = [];
for (const v of [0, 1, 2]) for (let seed = 0; seed < SEEDS; seed++) {
  const s = art.meadow([v, v, v, v], seed);
  const want = (a, b, px, py) => grassKey(px, py, v, seed);
  if (!sameRows(s.rows, diamond(want))) leaked.push(`${v}/${seed}@1x`);
  if (!sameRows(art.hires(s, 2).rows, diamond(want, 2))) leaked.push(`${v}/${seed}@2x`);
}
check("no uniform tile, in any dither, draws a pixel of another level's grass (1× and its 2× twin)", leaked.length === 0, leaked.join(" "));
const sameDither = reachable.filter((c) => new Set([0, 1, 2, 3, 4, 5].map((s) => art.meadow(c, s).rows.join("\n"))).size !== SEEDS);
check("the six dithers of every combination are six different drawings", sameDither.length === 0, sameDither.map((c) => c.join("")).join(" "));
const refused = unreachable.filter((c) => !throws(() => art.meadow(c, 0)));
check("a combination no tile can hold (kept and rough in one tile) THROWS rather than drawing something", refused.length === 0, refused.map((c) => c.join("")).join(" "));
check("…and so does anything that is not four levels", [null, [0, 0, 0], [0, 0, 0, 3], [0, 0, 0, -1], [0, 0.5, 0, 0], "0000"].every((c) => throws(() => art.meadow(c, 0))));

// Grass keys only: the ground's dusk table (duskTable(amount, true)) and the
// canopy's darker-than-grass relationship already cover exactly these four.
const GRASS_KEYS = new Set(["m", "n", "o", "p"]);
const foreign = [];
for (const s of drawn.values()) for (const r of s.rows) for (const k of r) if (k !== "." && !GRASS_KEYS.has(k)) foreign.push(`${s.name}:${k}`);
check("every meadow tile is drawn in the four grass keys and nothing else — no key the evening has not met", foreign.length === 0, foreign.slice(0, 5).join(" "));
// A tile between two levels is BETWEEN them: grass-1's light clumps are its
// 'p' (about a sixth of it, against grass-0's one in twenty), so a tile kept
// on one side and meadow on the other lands in between.
const pShare = (s) => { const t = s.rows.join("").replace(/\./g, ""); return (t.match(/p/g) || []).length / t.length; };
const [p0, pMix, p1] = [art.meadow([0, 0, 0, 0], 0), art.meadow([0, 1, 1, 0], 0), art.meadow([1, 1, 1, 1], 0)].map(pShare);
check("a tile between two levels draws between their grasses — the gradient is there to see", p0 < pMix && pMix < p1, `p ${(100 * p0).toFixed(1)}% < ${(100 * pMix).toFixed(1)}% < ${(100 * p1).toFixed(1)}%`);

// ---- the field ------------------------------------------------------------------
// A town on a real map: its own river, ponds and trees; roads, lots built and
// chalked, a civic, a rail line, a wall, a heap of rubble.
const T = createWorld({ seed: "check-ground" });
const at = (tx, ty) => ty * T.w + tx;
for (let t = 10; t < 40; t++) { T.road[at(t, 20)] = ROAD.ROAD; T.road[at(24, t)] = ROAD.ROAD; }
for (let tx = 12; tx < 22; tx++) for (let ty = 21; ty < 25; ty++) { T.zone[at(tx, ty)] = tx % 3 ? ZONE.R : ZONE.C; T.tier[at(tx, ty)] = tx % 4 ? 1 : 0; }
T.civic[at(30, 22)] = CIVIC.PARK;
for (let t = 30; t < 40; t++) T.rail[at(t, 26)] = 1;
T.wall[at(33, 14)] = 1;
T.rubble[at(35, 17)] = 3;
T.roadsDirty = true;
// SPELT OUT: what the city has made on a tile.
const madeHere = (w, i) => w.road[i] !== 0 || w.rail[i] !== 0 || w.zone[i] !== 0 || w.civic[i] !== 0 || w.wall[i] !== 0 || w.rubble[i] !== 0;
const bytesOf = (w) => Object.keys(w).filter((k) => ArrayBuffer.isView(w[k])).map((k) => `${k}:${Buffer.from(w[k].buffer, w[k].byteOffset, w[k].byteLength).toString("base64")}`).join("|");
const before = bytesOf(T), keysBefore = Object.keys(T).join();
const F = meadowField(T);
check("the field writes nothing on the world — every tile array is byte-identical after it is read, and no key is added", bytesOf(T) === before && Object.keys(T).join() === keysBefore);
check("…and reading it twice gives the same field", Buffer.compare(Buffer.from(meadowField(T).level), Buffer.from(F.level)) === 0);
check("there is a corner for every tile vertex, (w + 1)·(h + 1) of them", F.level.length === (T.w + 1) * (T.h + 1));

let madeTiles = 0, keptWrong = [], spans = [], undrawable = [];
const cornerAt = (vx, vy) => F.level[vy * (T.w + 1) + vx];
for (let ty = 0; ty < T.h; ty++) for (let tx = 0; tx < T.w; tx++) {
  const i = at(tx, ty);
  const c = F.corners(tx, ty);
  const [n, e, s, w] = [cornerAt(tx, ty), cornerAt(tx + 1, ty), cornerAt(tx + 1, ty + 1), cornerAt(tx, ty + 1)];
  if (c[0] !== n || c[1] !== e || c[2] !== s || c[3] !== w) keptWrong.push(`corners(${tx},${ty}) is not [N E S W]`);
  if (madeHere(T, i)) { madeTiles++; if (c.some((l) => l !== 0)) keptWrong.push(`(${tx},${ty}) [${c}]`); }
  if (c.includes(0) && c.includes(2)) spans.push(`(${tx},${ty}) [${c}]`);
  if (throws(() => art.meadow(c, T.variant[i]))) undrawable.push(`(${tx},${ty})`);
}
check("the town is a fixture with things made in it", madeTiles > 100, `${madeTiles} made tiles`);
check("THE CITY KEEPS WHAT IT TOUCHES: every corner of a road, a rail, a lot, a civic, a wall or rubble is kept (0)", keptWrong.length === 0, keptWrong.slice(0, 5).join(" "));
check("no tile holds both kept and rough, anywhere on the map", spans.length === 0, spans.slice(0, 5).join(" "));
check("so every tile on the map has a sprite to draw", undrawable.length === 0, undrawable.slice(0, 5).join(" "));
const openCount = [0, 0, 0];
let openCorners = 0;
for (let vy = 0; vy <= T.h; vy++) for (let vx = 0; vx <= T.w; vx++) {
  let touches = false;
  for (let ty = vy - 1; ty <= vy; ty++) for (let tx = vx - 1; tx <= vx; tx++) if (tx >= 0 && ty >= 0 && tx < T.w && ty < T.h && madeHere(T, at(tx, ty))) touches = true;
  if (touches) continue;
  openCorners++; openCount[cornerAt(vx, vy)]++;
}
check("away from the city the land grows all three: short, meadow and rough each hold at least a sixth of the open corners",
  openCount.every((c) => c >= openCorners / 6), `${openCount.join(" / ")} of ${openCorners}`);

const L = load(save(T));
check("a saved city loads the same meadow, corner for corner (the tile byte is saved; nothing else feeds it)",
  Buffer.compare(Buffer.from(meadowField(L).level), Buffer.from(F.level)) === 0);
// Making one thing moves only the corners round it: its own four go to
// kept, and a rough corner beside one of those steps down. Nothing further.
const M = load(save(T));
// Found, not guessed: the first open-grass tile, well clear of the town, whose
// own corners are not already kept (or the road would move nothing to test).
const clear = (tx, ty) => {
  for (let y = ty - 3; y <= ty + 3; y++) for (let x = tx - 3; x <= tx + 3; x++) {
    if (x < 0 || y < 0 || x >= T.w || y >= T.h) return false;
    if (madeHere(M, at(x, y)) || M.terrain[at(x, y)] !== TERRAIN.GRASS) return false;
  }
  return true;
};
let rx = -1, ry = -1;
for (let ty = 44; ty < T.h - 4 && rx < 0; ty++) for (let tx = 4; tx < T.w - 4; tx++) {
  if (clear(tx, ty) && [[0, 0], [1, 0], [1, 1], [0, 1]].some(([dx, dy]) => F.level[(ty + dy) * (T.w + 1) + tx + dx] !== 0)) { rx = tx; ry = ty; break; }
}
check("the locality fixture stands on open grass, with open grass three tiles round it", rx >= 0 && clear(rx, ry), `(${rx},${ry})`);
M.road[at(rx, ry)] = ROAD.ROAD;
const G2 = meadowField(M);
const far = [];
let moved = 0;
for (let vy = 0; vy <= T.h; vy++) for (let vx = 0; vx <= T.w; vx++) {
  const k = vy * (T.w + 1) + vx;
  if (G2.level[k] === F.level[k]) continue;
  moved++;
  if (vx < rx - 1 || vx > rx + 2 || vy < ry - 1 || vy > ry + 2) far.push(`(${vx},${vy})`);
}
check("laying one road tile moves its own corners and at most their neighbours — nothing further off", moved > 0 && far.length === 0, `${moved} moved, far: ${far.slice(0, 5).join(" ")}`);
check("…and its four corners are kept", [[0, 0], [1, 0], [1, 1], [0, 1]].every(([dx, dy]) => G2.level[(ry + dy) * (T.w + 1) + rx + dx] === 0));

// ---- the footpaths --------------------------------------------------------------
// SPELT OUT: fifteen masks (N 1 · E 2 · S 4 · W 8, never none) in two wears,
// drawn in the earth ramp's two middle keys, and worn bare from FOUR walks.
const EARTH_PATH = new Set(["s", "t"]), WORN_AT = 4;
const paths = [];
for (const worn of [false, true]) for (let mask = 1; mask < 16; mask++) {
  let s = null;
  try { s = art.footpath(mask, worn); } catch { s = null; }
  paths.push({ mask, worn, s });
}
check("every walked direction is drawn, trodden and worn — 30 paths, all different", paths.every((p) => p.s && p.s.rows.length === 32) && new Set(paths.map((p) => p.s)).size === 30);
check("…and the audit walks all 30", allSprites().filter(({ name }) => /^path-[NESW]+-(trodden|worn)$/.test(name)).length === 30);
check("a tile walked towards NO neighbour THROWS — every step of a commute is one tile from the last", [0, 16, -1, 1.5, null].every((m) => throws(() => art.footpath(m, false))));
const pathKeys = new Set(paths.flatMap((p) => p.s.rows.join("").replace(/\./g, "").split("")));
check("a path is drawn in earth and nothing else, and leaves the grass under it transparent", [...pathKeys].every((k) => EARTH_PATH.has(k)) && paths.every((p) => p.s.rows.join("").includes(".")), [...pathKeys].join(""));
// Where a path's ink is, in the tile's own units: the same mapping diamond() samples.
const inkAt = (s) => {
  const out = [];
  s.rows.forEach((r, py) => { for (let px = 0; px < r.length; px++) if (r[px] !== ".") { const x = px + 0.5 - 32, y = py + 0.5; out.push([(y + x / 2) / 2, (y - x / 2) / 2]); } });
  return out;
};
// Each edge's midpoint: N b = 0, E a = 16, S b = 16, W a = 0.
const nearEdge = [([a, b]) => b < 1.5 && Math.abs(a - 8) < 2.5, ([a, b]) => a > 14.5 && Math.abs(b - 8) < 2.5, ([a, b]) => b > 14.5 && Math.abs(a - 8) < 2.5, ([a, b]) => a < 1.5 && Math.abs(b - 8) < 2.5];
const wrongEdges = [];
for (const p of paths) {
  const ink = inkAt(p.s);
  nearEdge.forEach((near, k) => { if (ink.some(near) !== !!(p.mask & (1 << k))) wrongEdges.push(`${p.s.name} ${"NESW"[k]}`); });
}
check("each path reaches exactly the edges its mask names, and no other", wrongEdges.length === 0, wrongEdges.slice(0, 5).join(" "));
// Two walked neighbours' tracks MEET: where a track crosses its edge it is
// centred on that edge's midpoint, so the tile across finds it there too.
const offCentre = [];
for (const p of paths) {
  const ink = inkAt(p.s);
  [[1, ([a, b]) => b < 1, ([a]) => a], [2, ([a]) => a > 15, ([, b]) => b], [4, ([, b]) => b > 15, ([a]) => a], [8, ([a]) => a < 1, ([, b]) => b]].forEach(([bit, onEdge, along]) => {
    if (!(p.mask & bit)) return;
    const at = ink.filter(onEdge).map(along);
    const mid = at.reduce((s, v) => s + v, 0) / at.length;
    if (!at.length || Math.abs(mid - 8) > 0.6) offCentre.push(`${p.s.name} ${bit}:${at.length ? mid.toFixed(2) : "none"}`);
  });
}
check("where a track crosses an edge it is centred on the edge's midpoint — so the neighbour's track meets it", offCentre.length === 0, offCentre.slice(0, 5).join(" "));
// THE SAME PATH AT EVERY ZOOM. Which pixels are earth is decided world-sized
// and only the grain per pixel, so a twin's earth is its 1× earth scaled, to
// within the band's edge. Drawn per pixel, a thin trodden path was another
// path at 2× — 19% light — and the suite's twin gate (12%) refused it.
const drift = [];
for (const p of paths) for (const S of [2, 4]) {
  const one = p.s.rows.join("").replace(/\./g, "").length;
  const big = art.hires(p.s, S).rows.join("").replace(/\./g, "").length / (S * S);
  if (Math.abs(big - one) > 0.06 * one) drift.push(`${p.s.name}@${S}x ${one}→${big.toFixed(0)}`);
}
check("a path is the same path at every zoom — its 2× and 4× twins carry its earth to within 6%", drift.length === 0, drift.slice(0, 4).join(" "));
const thin = paths.filter((p) => !p.worn).filter((p) => inkAt(p.s).length >= inkAt(art.footpath(p.mask, true)).length);
check("a worn path carries more earth than a trodden one, for every mask", thin.length === 0, thin.map((p) => p.s.name).join(" "));

// THE WALKS, read off a real commute: a road, a rail line three tiles off it,
// a station at each end — the platform fixture in check.mjs — and a rider's
// path from the sim's own commutePath.
function forecourt(riders) {
  const w = openField(createWorld, { seed: "check-ground-forecourt" });
  const fat = (x, y) => y * w.w + x;
  const road = [], line = [];
  for (let x = 4; x <= 34; x++) road.push(fat(x, 6));
  for (let x = 6; x <= 32; x++) line.push(fat(x, 9));
  const ok = apply(w, { kind: "road", tiles: road }).ok && apply(w, { kind: "rail", tiles: line }).ok
    && apply(w, { kind: "station", tx: 8, ty: 9 }).ok && apply(w, { kind: "station", tx: 30, ty: 9 }).ok;
  computeFields(w);
  const ride = commutePath(w, "rabbit", [fat(6, 6)], [fat(32, 6)]);
  w.citizens = Array.from({ length: riders }, () => ({ path: ride ? ride.path : null }));
  computeTraffic(w);
  return { w, ok: ok && !!ride && Array.from(ride.path).some((p) => p & RIDE), fat };
}
const one = forecourt(1);
check("the forecourt fixture is real: a road, a line, two stations, and a commute that RIDES", one.ok);
const worn1 = wornPaths(one.w);
const fc = [one.fat(8, 7), one.fat(8, 8), one.fat(30, 7), one.fat(30, 8)];
check("a rider's walk crosses grass on exactly the four forecourt tiles, each walked north–south (N | S)",
  worn1.size === 4 && fc.every((t) => worn1.has(t) && worn1.get(t).mask === (1 | 4) && worn1.get(t).walks === 1),
  [...worn1].map(([t, e]) => `${t % one.w.w},${(t / one.w.w) | 0}:${e.mask}/${e.walks}`).join(" "));
// Two readers of the same stored paths must agree: the sim's traffic count.
const trafficGrass = [];
for (let i = 0; i < one.w.w * one.w.h; i++) if (one.w.traffic[i] > 0 && openGrass(one.w, i)) trafficGrass.push(i);
check("…and they are exactly the open-grass tiles the sim's own traffic count says are walked, walk for walk",
  trafficGrass.length === worn1.size && trafficGrass.every((t) => worn1.has(t) && worn1.get(t).walks === one.w.traffic[t]));
check("a town with no riders wears no path", T.citizens.length === 0 && wornPaths(T).size === 0);
{
  const before2 = bytesOf(one.w);
  wornPaths(one.w);
  check("reading the paths writes nothing on the world", bytesOf(one.w) === before2);
}
// THE FRAME: every open tile is its meadow with its path over it, pixel for
// pixel — trodden at three riders, worn at four.
for (const riders of [WORN_AT - 1, WORN_AT]) {
  const { w: FW, fat } = forecourt(riders);
  const canvas = createCanvas(...PANEL);
  const r = createRenderer(canvas, FW, art);
  r.resize();
  r.setShadows(false); // this is the ground; the shadow pass has its own gate
  const [cx, cy] = toScreen(8, 7.5);
  r.draw({ x: cx, y: cy, zoom: 1 }, null, null, "off", 0);
  const [PW, PH] = PANEL;
  const d = canvas.getContext("2d").getImageData(0, 0, PW, PH).data;
  const bx = -Math.round(r.view.left), by = -Math.round(r.view.top);
  const names = meadowField(FW), walks = wornPaths(FW);
  let tiles = 0, pathed = 0;
  const wrong = [];
  for (let ty = 0; ty < FW.h; ty++) for (let tx = 0; tx < FW.w; tx++) {
    const i = ty * FW.w + tx;
    // The road side of the line, where the forecourt is: south of it the
    // platform and its shelter stand in front of the ground.
    if (!openGrass(FW, i) || ty >= 9) continue;
    const [sx, sy] = toScreen(tx, ty);
    const X0 = sx - 32 + bx, Y0 = sy + by;
    if (X0 < 0 || Y0 < 0 || X0 + 64 > PW || Y0 + 32 > PH) continue;
    const under = art.meadow(names.corners(tx, ty), FW.variant[i]);
    const e = walks.get(i);
    const over = e ? art.footpath(e.mask, e.walks >= WORN_AT) : null;
    let bad = 0;
    for (let py = 0; py < 32; py++) for (let px = 0; px < 64; px++) {
      const k = over && over.rows[py][px] !== "." ? over.rows[py][px] : under.rows[py][px];
      if (k === ".") continue;
      const rgb = colourOf(k), j = ((Y0 + py) * PW + X0 + px) * 4;
      if (d[j] !== rgb[0] || d[j + 1] !== rgb[1] || d[j + 2] !== rgb[2]) bad++;
    }
    tiles++;
    if (over) pathed++;
    if (bad) wrong.push(`(${tx},${ty}) ${bad} px`);
  }
  const wear = riders >= WORN_AT ? "worn" : "trodden";
  check(`${riders} riders: every open tile in the frame is its meadow with its own path over it — ${wear} on the two forecourt tiles in view, nothing on the rest — pixel for pixel`,
    tiles > 100 && pathed === 2 && wrong.length === 0 && [fat(8, 7), fat(8, 8)].every((t) => (walks.get(t).walks >= WORN_AT) === (riders >= WORN_AT)),
    `${tiles} tiles, ${pathed} pathed · wrong ${wrong.slice(0, 4).join(" ")}`);
}

// ---- the frame ------------------------------------------------------------------
// The renderer lays the meadow and nothing else: traced, every grass tile it
// draws comes through art.meadow, and art.ground is never asked for grass.
{
  const calls = { meadow: 0, grass: 0 };
  const traced = { ...art, meadow: (c, s) => { calls.meadow++; return art.meadow(c, s); }, ground: (k, v) => { if (k === "grass") calls.grass++; return art.ground(k, v); } };
  const canvas = createCanvas(...PANEL);
  const r = createRenderer(canvas, T, traced);
  r.resize();
  r.draw({ x: 0, y: 26 * 32, zoom: 1 }, null, null, "off", 0);
  check("the renderer lays every grass tile through art.meadow, and never asks for the old grass by tile", calls.meadow > 500 && calls.grass === 0, `meadow ${calls.meadow} · ground('grass') ${calls.grass}`);
}
// THE RENDERER DRAWS WHAT THE FIELD NAMES, tile by tile. A field that is
// right and a renderer that asks for the wrong tile's corners (or ignores the
// byte, or keys the grass off the tile again) would pass every check above:
// so at zoom 1 every open tile in the frame must be, pixel for pixel, the
// sprite art.meadow gives for ITS corners and ITS byte — beside a road, where
// the corners are kept on one side, and out in the meadow.
{
  const W2 = openField(createWorld, { seed: "check-ground-names" });
  for (let t = 20; t < 44; t++) W2.road[t * W2.w + 32] = ROAD.ROAD;
  W2.roadsDirty = true;
  const canvas = createCanvas(...PANEL);
  const r = createRenderer(canvas, W2, art);
  r.resize();
  const [cx, cy] = toScreen(32, 32);
  r.draw({ x: cx, y: cy, zoom: 1 }, null, null, "off", 0);
  const [PW, PH] = PANEL;
  const d = canvas.getContext("2d").getImageData(0, 0, PW, PH).data;
  const bx = -Math.round(r.view.left), by = -Math.round(r.view.top);
  const names = meadowField(W2);
  let tiles = 0, besideRoad = 0, levels = new Set();
  const wrong = [];
  for (let ty = 0; ty < W2.h; ty++) for (let tx = 0; tx < W2.w; tx++) {
    const i = ty * W2.w + tx;
    if (W2.road[i]) continue;
    const [sx, sy] = toScreen(tx, ty);
    const X0 = sx - 32 + bx, Y0 = sy + by;
    if (X0 < 0 || Y0 < 0 || X0 + 64 > PW || Y0 + 32 > PH) continue;
    const c = names.corners(tx, ty);
    const s = art.meadow(c, W2.variant[i]);
    let bad = 0;
    for (let py = 0; py < 32; py++) for (let px = 0; px < 64; px++) {
      const k = s.rows[py][px];
      if (k === ".") continue;
      const rgb = colourOf(k), j = ((Y0 + py) * PW + X0 + px) * 4;
      if (d[j] !== rgb[0] || d[j + 1] !== rgb[1] || d[j + 2] !== rgb[2]) bad++;
    }
    tiles++;
    c.forEach((l) => levels.add(l));
    if (W2.road[i - 1] || W2.road[i + 1]) besideRoad++;
    if (bad) wrong.push(`(${tx},${ty}) ${bad} px`);
  }
  check("the renderer draws, at every open tile in the frame, exactly the grass its own corners and byte name — pixel for pixel",
    tiles > 150 && besideRoad >= 10 && levels.size === 3 && wrong.length === 0, `${tiles} tiles (${besideRoad} beside the road, levels ${[...levels]}) · wrong ${wrong.slice(0, 4).join(" ")}`);
}
// THE SEAM, off the frame. groundprobe.mjs says how it is measured and why
// its baseline is every interior line. Three maps: the field, a control that
// cannot have a seam (its floor), and the same field through the pick the
// game made before T3.3 — which must read as a quilt, or the instrument is
// blind and the first two prove nothing.
const reading = (world, a, zoom) => {
  const canvas = createCanvas(...PANEL);
  const r = createRenderer(canvas, world, a);
  r.resize();
  return groundReadings(r, canvas, world, zoom, 2);
};
const field = openField(createWorld, { seed: "check-ground-field" });
const control = openField(createWorld, { seed: "check-ground-field", bytes: keptBytes });
const SEAMLESS = 1.3, QUILT = 2.0;
const notes = [];
for (const zoom of [1, 2]) {
  const f = reading(field, art, zoom), c = reading(control, art, zoom), q = reading(field, quiltArt(art), zoom);
  const say = (m) => `seam ${m.seam.toFixed(2)} repeat ${m.repeat.toFixed(1)}`;
  notes.push(`zoom ${zoom} seam ${f.seam.toFixed(2)} (floor ${c.seam.toFixed(2)}, quilt ${q.seam.toFixed(2)}) repeat ${f.repeat.toFixed(1)} (quilt ${q.repeat.toFixed(1)})`);
  check(`zoom ${zoom}: the instrument can see a seam — the quilt the game drew before reads one`, q.seam >= QUILT, say(q));
  check(`zoom ${zoom}: …and its floor, a ground that cannot have one, reads none`, c.seam <= SEAMLESS, say(c));
  check(`zoom ${zoom}: THE OPEN FIELD SHOWS NO SEAM — a tile's edge steps no more than a line through it`, f.seam <= SEAMLESS, `field ${say(f)} · control ${say(c)} · quilt ${say(q)}`);
  check(`zoom ${zoom}: and repeats itself less than the quilt did — a pixel agrees with the one a tile over at most 8 points above chance (the quilt: ${q.repeat.toFixed(1)})`,
    f.repeat <= 8 && q.repeat >= 10, `field ${f.repeat.toFixed(1)} · quilt ${q.repeat.toFixed(1)}`);
}

console.log(`Ground checks passed: ${checks} checks · ${31 * SEEDS} meadow tiles (183 new) · town ${openCount.join("/")} short/meadow/rough of ${openCorners} open corners`);
for (const note of notes) console.log(`  ${note}`);
