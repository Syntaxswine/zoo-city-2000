// Occupancy lights and species stamps use the solid's recipe at both resolutions.
import { defineSprite, toRows } from "./format.js";
import { RECIPES, box, render, TO_X, TO_Y } from "./solid.js";
import { hash } from "./terrain.js";
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

// ---- THE PANE (PROPOSAL-SPRITE-UPGRADE, T3.1) ------------------------------
//
// A window was a light switch: glass, or the lit key. A window STATE widens
// that one return — a drawn blind, a plant on the sill, a boarded pane on a
// building old enough to have lost one — and it is the same machine doing it,
// on the same 2×3 grid of world-unit CELLS the lights have always used.
//
// WHAT THE APERTURE MEASUREMENT SAID, AND WHY THE STATES ARE SHAPED LIKE THIS.
// Over the 192 glazed plans there are 17,473 window cells that carry glass,
// and a cell is on MEDIAN only a third glass (2.0 of 6 world units²): 15.8% of
// them hold glass in the bottom third only, 12.2% in the top third only, and
// no kf slice of a cell is favoured by more than three points. So a state that
// paints a fixed sub-rectangle of the CELL paints nothing at all on a sixth of
// the city and covers everything on another eighth. A state is therefore
// either WHOLE-CELL — the blind and the board, robust to any aperture — or it
// is FOUND FROM THE APERTURE by probing the skin underneath, which is the same
// `edgeV` move architecture-detail.js already makes to find its sills.
//
// NOTHING IS ADDED TO THE PALETTE. Fabric (T2.1's third ramp, until now worn
// only by awnings) is the blind, timber is the boards, canopy is the plant, and
// slate's dark rung is the hole where the glass was.
//
// A FIXTURE NEEDS AN OCCUPANT (`lit >= 1`). Blinds and plants are signs of
// habitation, not of architecture; an empty building has bare glass. That also
// keeps `characterSprite(base, { majority })` changing nothing outside the
// species socket, which is an existing check and a good one.
const mod = (n, d) => ((n % d) + d) % d;
const LIT = "-";
const isGlass = (ink) => ink === "=" || ink === "H";

// Taste, tuned against docs/shots/sheet-windows.png — not derived. The slat
// period is deliberately sub-pixel at 1×: it dithers two adjacent fabric rungs
// into one warm mass at the zoom the game is played at, and opens into slats
// at the zooms that can hold them.
const BLIND_SLAT = 0.55, BLIND_DUTY = 0.28;
const PLANT_BAND = 1.4, PLANT_HEAD = 0.7, PLANT_U0 = 0.35, PLANT_U1 = 1.45;
const BOARD_PERIOD = 2.4, BOARD_DUTY = 1.15;
// THE PLANT HAD A POT AND IT CAME OUT AGAIN, the same way the evening's `night`
// ramp did: measured, not argued. Earth under the leaves is 14 px of a facade's
// 54 at 4×, and architecture-detail's sill claims the bottom 0.28 of every
// aperture, so almost all of it is under the sill and invisible; at 1× the
// count inverts and a window plant reads as a BROWN pixel, which is the one
// colour on a brick wall that says nothing. The leaves are the signal.

/**
 * EVERY KEY A PANE MAY HOLD. `architecture-detail.js` needs this to know that
 * a blind still has a window frame round it, and `check-building-character`
 * asserts it against a list spelt out in the check file — a check that reads
 * this constant would be the code agreeing with itself (handoff trap 1).
 */
export const PANE_KEYS = Object.freeze(["=", "H", "-", "R", "Q", "P", "S", "d", "b", "M", "L", "<"]);

/**
 * What one pane holds, given the cell it sits in. `on` is today's answer (is
 * this cell lit); `glassAt(u, k)` asks the skin underneath where its glass is,
 * which is how the plant finds a sill it was never told about.
 *
 * The ramp index is the face here too (handoff law 4): the side face takes a
 * brighter rung of the blind's fabric and the board's timber than the end
 * does, so a blind is shaded like the wall it is set into. The exception is a
 * LIT blind, which is a light source and shades like one — the lit key does
 * not darken on the end face either.
 */
function paneInk(face, u, k, x, y, ink, on, glassAt, phase, lit, wear) {
  const plain = on ? LIT : ink;
  if (face === "top") return plain; // a skylight has no sill, no blind and nobody to draw one
  const cu = Math.floor(u / 2), ck = Math.floor(k / 3);
  // A BOARDED PANE. Wear is the only thing in the game that can take a window
  // away, and a boarded pane is dark whoever is home — so this runs before the
  // fixtures and it beats the light.
  // Avalanched and salted away from the fixture's draw, for the reason written
  // against `fix` below: the hand-rolled linear form that was here first boarded
  // 21.4% of the plant cells against 16.6% of the plain ones — not the total
  // lock the fixture hash had, but a bias with no reason to exist.
  if (wear && Math.floor(23 * hash(ck, cu, phase + 7)) < (wear === 2 ? 4 : 1))
    return mod(k * 1.35 + u * 0.5, BOARD_PERIOD) < BOARD_DUTY ? (face === "side" ? "M" : "L") : "<";
  if (!lit) return plain;
  // THE FIXTURE HASH HAS TO BE AVALANCHED, NOT A SECOND LINEAR FORM. The first
  // one here was `(5cu + 11ck + 7phase + 3) & 15`, picked because (5, 11) is
  // not a multiple of the lighting form's (3, 1) — and it does not have to be,
  // because 5 ≡ 1 and 11 ≡ 3 mod 4 make it EXACTLY 3·cell + 3 mod 4. Any linear
  // form mod 16 reduces to a linear form mod 4, and two of those lock together
  // on a coincidence you cannot see by reading them. Measured, it meant cell 1
  // could never carry a blind and cells 2 and 3 could never carry a plant, and
  // the share of backlit cloth on a facade did not move when the building
  // filled up. `hash` is the avalanche the terrain already uses; over 2,560
  // cells every (cell, fixture) pair is populated within 10%.
  const fix = Math.floor(16 * hash(cu, ck, phase));
  if (fix >= 14) { // A PLANT, found at the bottom of the aperture rather than of the cell
    const uf = mod(u, 2);
    // The leaf drops TWO rungs from side to end and not one, which is what
    // litSkin does (n-1 and n-2) — and it also keeps the plant off the two
    // canopy keys the wear pass paints as moss, so a green pixel on a window
    // and a green pixel on a wall can never be confused by a gate.
    // TWO PROBES, NOT ONE, AND THE SECOND ONE IS THE ROOST'S DOING. Below the
    // aperture's bottom edge is where a windowbox goes; but a probe that only
    // looks DOWN fills a window shorter than the band completely, and the owl
    // landmark's perch windows are 0.8 units tall. Asking that there is still
    // glass PLANT_HEAD above leaves the head of every window clear and gives
    // the smallest ones no plant at all, which is the right answer for a
    // window too small to stand a pot in.
    if (uf >= PLANT_U0 && uf < PLANT_U1 && !glassAt(u, k + PLANT_BAND, x, y) && glassAt(u, k - PLANT_HEAD, x, y))
      return face === "side" ? "d" : "b";
    return plain;
  }
  if (fix >= 11) { // A BLIND, drawn across the whole pane whatever shape it is
    const slat = mod(k, BLIND_SLAT) < BLIND_DUTY;
    if (on) return slat ? "S" : LIT;
    return face === "side" ? (slat ? "Q" : "R") : (slat ? "P" : "Q");
  }
  return plain;
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
  const boxes = source.boxes.map(b => {
    // WHERE THE GLASS WAS, asked of the skin UNDERNEATH this pass. The plant
    // probes it to find a sill nobody told it about; architecture-detail.js
    // probes it at 2× and 4× so a blinded pane keeps the jamb and the sill the
    // bare one had. It answers about the BASE skin and never about what this
    // pass painted — ask the wrapper instead and a blind widens its own
    // aperture one probe at a time.
    //
    // TWO PREDICATES, AND THEY ARE NOT THE SAME QUESTION. `aperture` is what
    // the detail pass has always asked — did the skin paint a glass KEY here —
    // and it must stay exactly that, because a skin may paint glass blue where
    // it does not mean a window (the night market's floor tiles, whose
    // `glazing` function excludes them) and the close-up fixtures already hold
    // the jambs it draws round them. `paneHere` is the narrower question a
    // window state must ask: is this a window.
    // `aperture` answers the question the detail pass has ALWAYS asked — did
    // the ink come out one of its three glass keys — and it has to keep
    // answering it exactly, including the lit key, because a skin may paint a
    // light itself (the night market's stalls do) and the close-up fixtures
    // already hold the jambs drawn round those.
    const aperture = (face, u, k, x, y) => {
      const fn = b.faces[face];
      if (typeof fn !== "function") return false;
      const ink = fn(u, k, x, y);
      return isGlass(ink) || ink === LIT;
    };
    const paneHere = (face, u, k, x, y) => {
      const fn = b.faces[face];
      if (typeof fn !== "function" || !isGlass(fn(u, k, x, y))) return false;
      return typeof b.faces.glazing === "function" ? !!b.faces.glazing(face, u, k) : !!b.faces.glazing;
    };
    const faces = Object.fromEntries(Object.entries(b.faces).map(([face, fn]) => {
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
        if (!paneHere(face, u, k, x, y)) return ink;
        const cell = (Math.floor(u / 2) * 3 + Math.floor(k / 3) + phase) & 3;
        return paneInk(face, u, k, x, y, ink, cell < lit,
          (uu, kk, xx, yy) => paneHere(face, uu, kk, xx, yy), phase, lit, wear);
      }];
    }));
    if (b.faces.glazing) faces.aperture = aperture;
    return { ...b, faces };
  });
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
