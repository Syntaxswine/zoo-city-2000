import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
import { art } from "../js/art/index.js";
import { SPECIES_IDS, FACINGS, AGES, FRAMES } from "../js/art/citizens.js";
import { hasKey } from "../js/art/palette.js";
import { rasterize } from "../js/art/format.js";
import { createWorld } from "../js/sim/world.js";
import { installCanvas, createCanvas, encodePNG } from "./headless-canvas.mjs";
installCanvas();
await import("../js/sim/ops.js");
await import("../js/sim/tick.js");
const { citizenAppearance } = await import("../js/citizen-appearance.js");
const { createRenderer } = await import("../js/render.js");
const { toScreen, HALF_H } = await import("../js/iso/iso.js");
let cases = 0;
for (const species of SPECIES_IDS) for (const facing of FACINGS) for (const age of AGES) for (let frame = 0; frame < FRAMES.length; frame++) {
  for (const opts of [{}, { look: { shade: 1, mark: 1 }, hat: true }, { carry: "sack" }, { carry: "cart" }]) {
    const plain = art.citizen(species, facing, frame, age, opts), original = plain.rows.join("\n");
    const suit = art.citizen(species, facing, frame, age, { ...opts, suit: true });
    assert.notEqual(suit.rows.join("\n"), original, `${suit.name}: missing suit`);
    assert.deepEqual(suit.anchor, plain.anchor);
    assert.equal(suit.w, plain.w); assert.equal(suit.h, plain.h);
    for (let y = 0; y < suit.h; y++) for (let x = 0; x < suit.w; x++) {
      assert.equal(suit.rows[y][x] === ".", plain.rows[y][x] === ".", `${suit.name}: silhouette changed`);
    }
    for (const scale of [2, 4]) {
      const hi = art.hires(suit, scale);
      assert(hi); assert.deepEqual(hi.anchor, suit.anchor.map(n => n * scale));
      for (const key of new Set(hi.rows.join(""))) assert(key === "." || hasKey(key));
    }
    assert.equal(art.citizen(species, facing, frame, age, { ...opts, suit: true }), suit);
    assert.equal(art.citizen(species, facing, frame, age, { ...opts, suit: false }), plain);
    assert.equal(plain.rows.join("\n"), original);
    cases++;
  }
}
// Appearance belongs to the home, not the tile being walked through or a
// sprite cached when the walk began. Test a class change without a new walk.
const world = createWorld({ seed: "suit-review" });
const home = 20 * world.w + 20;
const c = { id: 17, home, species: "fox" };
world.byId.set(c.id, c);
const w = { id: c.id, citizen: c.id, species: "fox", facing: "se", age: "adult", frame: 0, tx: 20, ty: 20, look: art.look(c.id) };
assert.equal(citizenAppearance(world, w).look, w.look);
assert.deepEqual(citizenAppearance(world, { ...w, hat: true, carry: "sack" }), { look: w.look, hat: true, carry: "sack", suit: false });
for (const cls of [0, 1, 2, 1, 2]) {
  world.klass[home] = cls;
  assert.equal(citizenAppearance(world, w).suit, cls === 2);
  assert.equal(citizenAppearance(world, { ...w, id: -7, citizen: null, appearanceCitizen: c.id }).suit, cls === 2, "cart proxy");
  assert.equal(citizenAppearance(world, { id: c.id }).suit, cls === 2, "companion/prey identity");
  assert.equal(citizenAppearance(world, { ...w, appearanceClass: 2 }).suit, cls === 2, "live class overrides a snapshot");
}
c.home = -1;
assert.equal(citizenAppearance(world, w).suit, false, "campers have no affluent address");
c.home = home;
assert.equal(citizenAppearance(world, { id: -100 }).suit, false, "anonymous visitor");
assert.equal(citizenAppearance(world, { id: -100, appearanceClass: 2 }).suit, true, "removed citizen's recorded outfit");
world.terrain.fill(0);
const [cx, cy] = toScreen(20, 20);
for (const zoom of [1, 2, 3, 4]) {
  const canvas = createCanvas(320, 240), calls = [];
  const traced = { ...art, citizen: (...args) => { calls.push(args[4]); return art.citizen(...args); } };
  const renderer = createRenderer(canvas, world, traced), camera = { x: cx, y: cy + HALF_H, zoom };
  const walkers = { list: () => [w] };
  world.klass[home] = 1; renderer.draw(camera, null, walkers, "off", 0);
  const before = Buffer.from(canvas._data);
  world.klass[home] = 2; renderer.draw(camera, null, walkers, "off", 0);
  assert(calls.at(-1).suit, `renderer suit at zoom ${zoom}`);
  assert(!before.equals(Buffer.from(canvas._data)), `outfit invisible at zoom ${zoom}`);
  assert.equal(renderer.pickWalker(160, 120 - 8 * zoom, [w]), w);
  world.klass[home] = 1; renderer.draw(camera, null, walkers, "off", 0);
  assert(before.equals(Buffer.from(canvas._data)), "class downgrade kept suit");
}

mkdirSync("out/suits", { recursive: true });
function sheet(name, sprites, columns, cellW, cellH, scale) {
  const canvas = createCanvas(columns * cellW, Math.ceil(sprites.length / columns) * cellH);
  const ctx = canvas.getContext("2d"); ctx.fillStyle = "#313d3d"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  sprites.forEach(({ sprite, label }, i) => {
    const x = i % columns * cellW, y = Math.floor(i / columns) * cellH;
    ctx.fillStyle = "#cbd3da"; ctx.font = "10px monospace"; ctx.fillText(label, x + 6, y + 14);
    const hi = scale === 1 ? sprite : art.hires(sprite, scale);
    const image = rasterize(hi.rows), c = createCanvas(hi.w, hi.h);
    c.getContext("2d").putImageData({ width: hi.w, height: hi.h, data: image.data }, 0, 0);
    ctx.drawImage(c, x + (cellW - hi.w) / 2, y + cellH - hi.h - 8);
  });
  writeFileSync(`out/suits/${name}.png`, encodePNG(canvas));
}
sheet("all-species", SPECIES_IDS.flatMap(s => [false, true].map(suit => ({ sprite: art.citizen(s, "se", 0, "adult", { suit }), label: suit ? "suit" : s }))), 14, 70, 115, 4);
sheet("poses", ["fox", "tortoise", "hawk"].flatMap(s => FACINGS.flatMap(f => AGES.map(a => ({ sprite: art.citizen(s, f, 1, a, { suit: true, hat: true, carry: "sack" }), label: `${s} ${f} ${a}` })))), 6, 120, 140, 4);
console.log(`Suits: ${cases} appearance cases pass at 1x/2x/4x; live class changes and picking pass at all four zooms.`);
