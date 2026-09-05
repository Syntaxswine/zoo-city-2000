// Occupancy lights and species stamps use the solid's recipe at both resolutions.
import { defineSprite, toRows } from "./format.js";
import { RECIPES, box, render, TO_X, TO_Y } from "./solid.js";
import { renderRecipe } from "./buildings.js";
import { SPECIES } from "../sim/species.js";

const DRAWINGS = {
  rabbit:   ["..qq..", ".q++q.", "q++++q", "q++++q", "q++++q", "qqqqqq"],
  mouse:    ["......", "......", "......", "..qq..", ".q++q.", ".qqqq."],
  fox:      ["...tt.", "..ttt.", "qttt..", "..q...", "..q...", ".qqq.."],
  beaver:   ["..t...", ".ttt..", "tt.tt.", "t...tt", "t....t", "tttttt"],
  owl:      [".tttt.", "..t...", "..t...", "..t...", "..t...", ".qqq.."],
  bear:     ["tttttt", "t....t", "tttttt", "......", ".q..q.", ".q..q."],
  tortoise: ["......", "......", "..**..", "..&&..", "******", "&&&&&&"],
  raccoon:  ["......", "***.**", "&^&.&^", "&^&.&^", "&^&.&^", "&&&.&&"],
  pig:      ["......", "......", ".rrr..", "rrtrr.", ".rtrrr", "..rrr."],
  cow:      ["q....q", "qttttq", "q....q", "qttttq", "q....q", "q....q"],
  wolf:     ["qtttt.", "qtqqt.", "qttt..", "q.....", "q.....", "q....."],
  cat:      ["......", ".q..q.", ".qqqq.", "tttttt", ".q..q.", "......"],
  hawk:     ["..*...", "..*...", ".***..", "..&...", "..&...", ".&&&.."],
  skunk:    ["......", "......", "......", "(+(+(+", "(+(+(+", "......"],
};
export const MARKS = Object.freeze(Object.fromEntries(Object.entries(DRAWINGS).map(([species, rows]) =>
  [species, defineSprite({ name: `building-mark-${species}`, rows, anchor: [3, 5], tags: ["building-mark"] })])));
export function markSprite(species) {
  const mark = MARKS[species];
  if (!mark) throw new Error(`Unknown building mark: ${species}`);
  return mark;
}

// Each recipe receives its own socket pair, after mirroring. A wide structural
// wall near the ground carries the residential stamp; a clear roof point carries
// the staff stamp. Both are inside the footprint, including the six-pixel stamp.
export function socketsFor(boxes) {
  const walls = boxes.filter(b => b.c1 - b.c0 >= 6 && b.a1 - b.a0 >= 2 && b.b1 - b.b0 >= 2);
  if (!walls.length) return null;
  const raster = render(boxes);
  const visible = ([a, b, c]) => {
    const gx = Math.round(TO_X(a, b)) + raster.ox - 3;
    const gy = Math.round(TO_Y(a, b, c)) + raster.oy - 5;
    let count = 0;
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
      const px = gx + x, py = gy + y;
      const old = px >= 0 && px < raster.grid[0].length && py >= 0 && py < raster.grid.length ? raster.zbuf[py * raster.grid[0].length + px] : -Infinity;
      if (a + b + 2 * c + 2 * (5 - y) > old) count++;
    }
    return count;
  };
  // Prefer a low wall point beside its door. Try each side's two jamb regions
  // so a porch or projecting bay cannot silently hide every species mark.
  const facades = walls.filter(b => b.faces.glazing && b.a1 - b.a0 >= 4 && b.b1 - b.b0 >= 3);
  const wallPoints = (facades.length ? facades : walls).sort((a, b) => a.c0 - b.c0 || b.b1 - a.b1).flatMap(b =>
    [b.a0 + Math.min(2, (b.a1 - b.a0) / 2), b.a1 - Math.min(2, (b.a1 - b.a0) / 2)].map(a => [a, b.b1 + 0.1, b.c0 + 4]));
  const roofPoints = boxes.filter(b => b.faces.top && b.a1 - b.a0 >= 2 && b.b1 - b.b0 >= 2)
    .sort((a, b) => b.c1 - a.c1).map(b => [(b.a0 + b.a1) / 2, (b.b0 + b.b1) / 2, b.c1 + 0.1]);
  const best = points => points.reduce((a, b) => visible(b) > visible(a) ? b : a);
  return Object.freeze({ wall: best(wallPoints), roof: best(roofPoints), box: [6, 6] });
}

export const lightLevel = (fill) => Math.max(0, Math.min(3, Math.floor(4 * fill)));
const CACHE = new WeakMap();
export function characterSprite(base, { lit = 0, majority = 0, seed = 0, wear = 0 } = {}) {
  const source = RECIPES.get(base);
  if (!source?.boxes) return base;
  lit = Math.max(0, Math.min(3, lit | 0));
  wear = Math.max(0,Math.min(2,wear|0));
  const species = SPECIES[majority - 1]?.id;
  const phase = ((Math.imul(seed | 0, 0x45d9f3b) >>> 8) & 3);
  if (!lit && !species && !wear) return base;
  const key = `${lit}:${species || "none"}:${phase}:${wear}`;
  let cache = CACHE.get(base);
  if (!cache) CACHE.set(base, cache = new Map());
  if (cache.has(key)) return cache.get(key);
  const boxes = source.boxes.map(b => ({ ...b, faces: Object.fromEntries(Object.entries(b.faces).map(([face, fn]) => {
    // Explicit glass keys supplied by a skin; structural blue awnings have no
    // glazing metadata. The pattern uses world cells, so 1× and 2× agree.
    if (!["top", "side", "end"].includes(face) || typeof fn !== "function") return [face, fn];
    return [face, (u, k, x, y) => {
      const ink = fn(u, k, x, y);
      // Recolour only existing solid surface cells: wear never grows outside
      // the footprint or paints over glass or species stamps.
      // Low platforms, lawns, paths and furniture are not building roofs.
      if(wear && ink && ink!=="." && !["=","H","-","+"].includes(ink)) {
        if(face!=="top" && k<Math.min(12,b.c1-b.c0-1) && ((Math.floor(u)+phase)%13===2 || (Math.floor(u)+phase)%13===3 && Math.floor(k)%3!==0)) return Math.floor(k)%3===0?"c":"e";
        if(wear===2 && face==="top" && b.c1>8 && Math.floor(u)%11>=3 && Math.floor(u)%11<=6 && Math.floor(k)%9>=2 && Math.floor(k)%9<=4)return (Math.floor(u)+Math.floor(k))%3===0?"&":"*";
      }
      const cell = (Math.floor(u / 2) * 3 + Math.floor(k / 3) + phase) & 3;
      const glass = typeof b.faces.glazing === "function" ? b.faces.glazing(face, u, k) : true;
      return b.faces.glazing && glass && (ink === "=" || ink === "H") && cell < lit ? "-" : ink;
    }];
  })) }));
  const sockets = source.sockets || socketsFor(source.boxes);
  const stamps = [...source.stamps];
  const extent = [...source.extent];
  if (species && sockets) {
    const at = sockets[base.tags.includes("R") ? "wall" : "roof"];
    stamps.push([markSprite(species), ...at]);
    // Stamps extend upward from their anchor. Invisible extent only sizes the
    // raster; the stamp itself still competes with the building's depth.
    extent.push(box(at[0] - 2, at[0] + 2, at[1] - 2, at[1], at[2], at[2] + 7, {}));
  }
  const recipe = { ...source, name: `${base.name}-people-${key}`, boxes, stamps, extent, sockets };
  const r = renderRecipe(recipe);
  const sprite = defineSprite({ name: recipe.name, rows: toRows(r.grid), anchor: r.anchor, footprint: base.footprint, tags: base.tags });
  RECIPES.set(sprite, recipe);
  cache.set(key, sprite);
  return sprite;
}
