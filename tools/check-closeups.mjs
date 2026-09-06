// Adversarial rendering checks and repeatable visual review sheets.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { art, allSprites } from "../js/art/index.js";
import { SPECIES_IDS, FACINGS, AGES, FRAMES } from "../js/art/citizens.js";
import { RECIPES } from "../js/art/solid.js";
import { renderRecipe } from "../js/art/buildings.js";
import { defineSprite, rasterize, ink } from "../js/art/format.js";
import { hasKey } from "../js/art/palette.js";
import { zoomCamera } from "../js/iso/zoom.js";
import { createWorld, ZONE } from "../js/sim/world.js";
import { toScreen, HALF_H } from "../js/iso/iso.js";
import { installCanvas, createCanvas, encodePNG } from "./headless-canvas.mjs";

installCanvas();
// Bootstrap the simulation in the same order as the existing play instrument.
await import("../js/sim/ops.js");
await import("../js/sim/tick.js");
const { createRenderer } = await import("../js/render.js");
mkdirSync("out/closeups", { recursive: true });
const baseHash = s => s.rows.join("\n");
const stats = { buildings: 0, citizens: 0, changedBuildings: 0 };
const before = new Map();
const buildings = allSprites().map(s => s.sprite).filter(s => RECIPES.get(s)?.boxes);
for (const s of buildings) {
  before.set(s, baseHash(s));
  for (const scale of [2, 4]) {
    const h = art.hires(s, scale), recipe = RECIPES.get(s);
    const plain = renderRecipe(recipe, scale);
    assert.deepEqual(h.anchor, plain.anchor, `${s.name}: shifted anchor`);
    assert.equal(h.w, plain.grid[0].length);
    assert.equal(h.h, plain.grid.length);
    assert.equal(ink(h.rows), ink(plain.grid.map(r => r.join(""))), `${s.name}: changed silhouette`);
    for (const k of new Set(h.rows.join(""))) assert(k === "." || hasKey(k), `${s.name}: bad palette`);
    assert.equal(h, art.hires(s, scale), "cache miss");
    if (scale === 4) {
      const changed = h.rows.join("\n") !== plain.grid.map(r => r.join("")).join("\n");
      if (changed) stats.changedBuildings++;
      if (s.tags.some(t => ["building", "civic", "block", "station"].includes(t))) assert(changed, `${s.name}: no new architectural detail`);
    }
  }
  assert.equal(baseHash(s), before.get(s), "base art mutated");
  stats.buildings++;
}
// Every species, facing, age and animation frame, including stable looks and
// accessories. A bigger canvas alone is insufficient: pixels must change.
for (const species of SPECIES_IDS) for (const facing of FACINGS) for (const age of AGES) for (let frame = 0; frame < FRAMES.length; frame++) {
  for (const opts of [{}, { look: { shade: 1, mark: 1 }, hat: true }, { carry: "sack" }, { carry: "cart" }]) {
    const s = art.citizen(species, facing, frame, age, opts), original = baseHash(s);
    for (const scale of [2, 4]) {
      const h = art.hires(s, scale);
      assert(h, s.name);
      assert.deepEqual(h.anchor, s.anchor.map(n => n * scale));
      assert.equal(h.w, s.w * scale); assert.equal(h.h, s.h * scale);
      let changed = 0;
      for (let y = 0; y < h.h; y++) for (let x = 0; x < h.w; x++) {
        const old = s.rows[Math.floor(y / scale)][Math.floor(x / scale)], k = h.rows[y][x];
        assert(k === "." || hasKey(k));
        if (old === ".") assert.equal(k, ".", `${s.name}: silhouette expanded`);
        if (old !== k) changed++;
      }
      assert(changed > 0, `${s.name}: merely enlarged`);
      assert(ink(h.rows) / (scale * scale) > ink(s.rows) * 0.88, `${s.name}: eroded`);
      assert.equal(h, art.hires(s, scale));
    }
    assert.equal(baseHash(s), original);
    stats.citizens++;
  }
}
// Repeated events without a frame between them must preserve the cursor point.
for (const point of [[40, 80], [799, 599], [400, 300]]) {
  const c = { x: 170, y: 830, zoom: 1 };
  const worldAt = () => [c.x + (point[0] - 400) / c.zoom, c.y + (point[1] - 300) / c.zoom];
  const start = worldAt();
  for (const dir of [1, 1, 1, 1, -1, -1, -1, -1]) {
    zoomCamera(c, dir, 800, 600, ...point);
    worldAt().forEach((n, i) => assert(Math.abs(n - start[i]) < 1e-9, "cursor drift"));
    assert(c.zoom >= 1 && c.zoom <= 4);
  }
  assert.equal(c.zoom, 1);
}
assert.throws(() => art.hires(buildings[0], 3), RangeError);

// Reused ground buffers must match a fresh renderer after every LOD switch.
// The test also catches wrong foot anchoring or hit boxes at maximum zoom.
const world = createWorld({ seed: "closeup-camera" });
const tile = 20 * world.w + 20;
world.terrain.fill(0);
world.zone[tile] = ZONE.R; world.tier[tile] = 3;
const [cx, cy] = toScreen(20, 20);
const person = { id: 1, species: "fox", facing: "se", frame: 1, age: "adult", tx: 20.8, ty: 20.8 };
const walkers = { list: () => [person] };
const canvas = createCanvas(480, 320), renderer = createRenderer(canvas, world, art);
const draws = [];
for (const zoom of [1, 2, 3, 4, 2, 4, 1]) {
  const camera = { x: cx, y: cy + HALF_H, zoom };
  const start = performance.now();
  renderer.draw(camera, null, walkers, "off", 0);
  draws.push({ zoom, ms: Math.round(performance.now() - start) });
  const fresh = createCanvas(480, 320);
  createRenderer(fresh, world, art).draw(camera, null, walkers, "off", 0);
  assert(Buffer.from(canvas._data).equals(Buffer.from(fresh._data)), `stale ground at zoom ${zoom}`);
  assert.deepEqual(renderer.pick(240, 160, camera), [20, 20]);
  const [px, py] = renderer.tileToScreen(person.tx, person.ty);
  assert.equal(renderer.pickWalker(px, py - 8 * zoom, [person]), person, `citizen pick at ${zoom}`);
  if (zoom === 1) {
    const lo = createCanvas(480, 320);
    createRenderer(lo, world, { ...art, hires: null }).draw(camera, null, walkers, "off", 0);
    assert(Buffer.from(lo._data).equals(Buffer.from(canvas._data)), "zoomed-out rendering changed");
  }
}
console.log(`Camera transitions (headless CPU raster, milliseconds): ${JSON.stringify(draws)}`);

function draw(ctx, s, x, y, scale) {
  const img = rasterize(s.rows), c = createCanvas(s.w, s.h);
  c.getContext("2d").putImageData({ width: img.w, height: img.h, data: img.data }, 0, 0);
  ctx.setTransform(scale, 0, 0, scale, x, y);
  ctx.drawImage(c, -s.anchor[0], -s.anchor[1]);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
function sheet(name, sprites, cellW, cellH, columns, zoom = 4) {
  const c = createCanvas(cellW * columns, cellH * Math.ceil(sprites.length / columns));
  const ctx = c.getContext("2d"); ctx.fillStyle = "#222b2d"; ctx.fillRect(0, 0, c.width, c.height);
  sprites.forEach((s, i) => {
    const x = i % columns * cellW, y = Math.floor(i / columns) * cellH;
    ctx.fillStyle = "#cbd3da"; ctx.font = "10px monospace"; ctx.fillText(s.name.split("|")[0].replace("citizen-", "").slice(0, Math.floor(cellW / 7)), x + 8, y + 15);
    // Left: previously available art at the same screen size. Right: new art.
    let old = s, oldScale = zoom;
    if (RECIPES.get(s)?.boxes) {
      const r = renderRecipe(RECIPES.get(s), 2);
      old = defineSprite({ name: "old", rows: r.grid.map(row => row.join("")), anchor: r.anchor }); oldScale = zoom / 2;
    }
    draw(ctx, old, x + cellW / 4, y + cellH - 24, oldScale);
    const h = art.hires(s, zoom >= 3 ? 4 : 2);
    draw(ctx, h, x + cellW * 3 / 4, y + cellH - 24, zoom / h.scale);
  });
  writeFileSync(`out/closeups/${name}.png`, encodePNG(c));
}
sheet("citizens", SPECIES_IDS.map(s => art.citizen(s, "se", 0, "adult")), 160, 128, 7);
sheet("citizen-poses", FACINGS.flatMap(f => AGES.map(a => art.citizen("fox", f, 1, a, { hat: true, carry: "sack" }))), 192, 164, 4);
sheet("buildings", [1, 2, 3, 4].flatMap(z => [1, 2, 3].map(t => art.building(z, t, 0))), 540, 330, 2);
sheet("civics", ["fire", "police", "centre", "zoo", "largePark", "park"].map(k => art.civic(k, k === "park" ? 1 : 3)), 840, 340, 2, 2);
console.log(`Close-up checks passed: ${JSON.stringify(stats)}; comparison sheets in out/closeups (old left, new right).`);
