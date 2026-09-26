// Part E assertions, called by the canonical suite; no independent verdict.
import { art } from "../js/art/index.js";
import { BUILDINGS, RECIPES, allBuildings } from "../js/art/buildings.js";
import { allBlocks } from "../js/art/blocks.js";
import { allLandmarks } from "../js/art/landmarks.js";
import { allShops } from "../js/art/shops.js";
import { allMansion } from "../js/art/mansion.js";
import { characterSprite, lightLevel, MARKS, PANE_KEYS } from "../js/art/building-character.js";
import { createWorld, ZONE } from "../js/sim/world.js";
import { SPECIES } from "../js/sim/species.js";
import { recountMajority } from "../js/sim/census.js";
import { lotReport } from "../js/sim/lots.js";

const inkAt = (s, x, y) => s.rows[y + s.anchor[1]]?.[x + s.anchor[0]] || ".";
function differences(a, b) {
  const out = [];
  for (let y = -Math.max(a.anchor[1], b.anchor[1]); y < Math.max(a.h - a.anchor[1], b.h - b.anchor[1]); y++)
    for (let x = -Math.max(a.anchor[0], b.anchor[0]); x < Math.max(a.w - a.anchor[0], b.w - b.anchor[0]); x++)
      if (inkAt(a, x, y) !== inkAt(b, x, y)) out.push([x, y]);
  return out;
}

export function checkBuildingCharacter(check) {
  const bases = [...new Set([...allBuildings(), ...allBlocks(), ...allLandmarks(), ...allShops(), ...allMansion()]
    .map(x => x.sprite).filter(s => s.tags.includes("building")))];
  check("buildings E: all nine original families have six pairwise-distinct authored plans",
    [1, 2, 3].every(z => [1, 2, 3].every(t => BUILDINGS[z][t].length === 6 && new Set(BUILDINGS[z][t].map(s => s.rows.join("\n"))).size === 6)));
  check("buildings E: every species has a distinct stamp inside a six-by-six socket",
    SPECIES.every(s => MARKS[s.id]?.w <= 6 && MARKS[s.id]?.h <= 6) && new Set(Object.values(MARKS).map(s => s.rows.join("\n"))).size === 14);
  check("buildings E: light levels clamp full occupancy and change at the four fill thresholds",
    [-1, 0, .24, .25, .49, .5, .74, .75, 1, 2].map(lightLevel).join() === "0,0,0,1,1,2,2,3,3,3");

  // ---- T3.1, THE PANE -------------------------------------------------------
  // THE KEYS A WINDOW STATE MAY PAINT, SPELT OUT HERE AND NOT IMPORTED. A check
  // that iterates the module's own list is the code agreeing with itself, and
  // that has now happened twice in this arc (check-shadows' SHADOW_KEY,
  // check-dusk's FIXED). The module's own list is asserted against this one
  // instead, so moving either without the other is a failure.
  const GLASS = ["=", "H"];              // what a skin paints; what a state may replace
  const LIT_KEY = "-";                   // the light, unchanged since the lights landed
  const BLIND = ["S", "R", "Q", "P"];    // backlit cloth, then the shaded rungs, side and end
  const PLANT = ["d", "b"];              // the leaves, side and end (the pot was measured out — see building-character.js)
  const BOARD = ["M", "L", "<"];         // plank, plank, and the hole where the glass was
  const WINDOW_INK = [LIT_KEY, ...BLIND, ...PLANT, ...BOARD];
  const sorted = (list) => [...list].sort().join("");
  check("buildings E: the pane keys the module declares are exactly the twelve this check knows by name",
    sorted(PANE_KEYS) === sorted([...GLASS, ...WINDOW_INK]), `${sorted(PANE_KEYS)} vs ${sorted([...GLASS, ...WINDOW_INK])}`);

  const lightBad = [], markBad = [], prismBad = [], cacheBad = [], paneBad = [];
  let lightPixels = 0, markPixels = 0;
  const seen = { 1: new Map(), 2: new Map(), 4: new Map() };  // scale -> pane key -> px
  const cloth = { lit: [0, 0, 0], dark: [0, 0, 0] };          // backlit / shaded cloth px by light level
  const boards = [0, 0, 0];                                    // board px by wear level
  const aged = { light: [0, 0], blind: [0, 0], plant: [0, 0] }; // px at lit 2, young then old
  // Six appearances of every plan: the three light levels, two ages, and a
  // derelict nobody lives in. The wear rows are in the SAME loop as the lights
  // because the ownership law has to hold over all of them at once.
  const LOOKS = [{ lit: 1 }, { lit: 2 }, { lit: 3 }, { lit: 2, wear: 1 }, { lit: 2, wear: 2 }, { lit: 0, wear: 2 }];
  for (const base of bases) {
    if (characterSprite(base, {}) !== base) cacheBad.push(base.name);
    for (const scale of [1, 2, 4]) {
      const bare = scale === 1 ? base : art.hires(base, scale);
      let lastLitSet = null, lights = 0;
      for (const look of LOOKS) {
        const lo = characterSprite(base, { seed: 27, ...look });
        if (characterSprite(base, { seed: 27, ...look }) !== lo) cacheBad.push(base.name);
        const next = scale === 1 ? lo : art.hires(lo, scale);
        const litSet = new Set();
        for (const [x, y] of differences(bare, next)) {
          const was = inkAt(bare, x, y), now = inkAt(next, x, y);
          // OWNERSHIP, BOTH WAYS. A window state may only repaint a pixel the
          // bare plan drew as glass, and nothing else in the character pass may
          // paint a pane key — the wear streaks that were here before this item
          // deliberately skip glass, and this is what holds them to it.
          if (GLASS.includes(was)) {
            if (!WINDOW_INK.includes(now)) paneBad.push(`${base.name}@${scale}: glass became '${now}', which is not a declared pane key`);
            seen[scale].set(now, (seen[scale].get(now) || 0) + 1);
            if (!look.wear && look.lit) {
              if (now === "S") cloth.lit[look.lit - 1]++;
              else if (["R", "Q", "P"].includes(now)) cloth.dark[look.lit - 1]++;
            }
            if (BOARD.includes(now)) boards[look.wear || 0]++;
            // The two lit-2 rows, young and at wear 2, are the A/B for ageing.
            if (look.lit === 2 && (look.wear || 0) !== 1) {
              const col = look.wear ? 1 : 0;
              if (now === LIT_KEY) aged.light[col]++;
              else if (BLIND.includes(now)) aged.blind[col]++;
              else if (PLANT.includes(now)) aged.plant[col]++;
            }
            if (!look.wear) { litSet.add(`${x},${y}`); lights++; }
          } else if (WINDOW_INK.includes(now)) paneBad.push(`${base.name}@${scale}: '${was}' became the pane key '${now}' outside the glass`);
        }
        // MONOTONE IN `lit`: a pane the city has already opened is never closed
        // again by MORE people moving in. Only the three light rows take part.
        if (!look.wear) {
          if (lastLitSet && [...lastLitSet].some(p => !litSet.has(p))) lightBad.push(`${base.name}@${scale}: lit ${look.lit} gave back a pane lit ${look.lit - 1} had`);
          lastLitSet = litSet;
        }
      }
      if (!lights) lightBad.push(`${base.name}@${scale}: no visible lights`);
      lightPixels += lights;
    }
    // Every plan at all three resolutions, plus all species across all four R2 and
    // C2 plans. The latter catches a small mark hidden by a projecting bay.
    const majorityCases = /^([RC]2-)/.test(base.name) ? SPECIES.map((s, n) => n + 1) : [1];
    for (const majority of majorityCases) {
      const marked = characterSprite(base, { majority });
      const recipe = RECIPES.get(marked), at = recipe?.sockets?.[base.tags.includes("R") ? "wall" : "roof"];
      if (!at) { markBad.push(`${base.name}: no socket`); continue; }
      if (base.tags.includes("R") && !RECIPES.get(base).boxes.some(b => b.faces.glazing &&
        at[0] >= b.a0 && at[0] <= b.a1 && Math.abs(at[1] - b.b1 - .1) < 1e-8 && at[2] >= b.c0 && at[2] < b.c1))
        markBad.push(`${base.name}: residential mark is not on a facade`);
      for (const scale of [1, 2, 4]) {
        const original = scale === 1 ? base : art.hires(base, scale), sprite = scale === 1 ? marked : art.hires(marked, scale);
        const diff = differences(original, sprite);
        if (!diff.length) markBad.push(`${base.name}/${majority}@${scale}: invisible`);
        markPixels += diff.length;
        const left = Math.round((2 * at[0] - 2 * at[1]) * scale) - 3 * scale;
        const top = Math.round((at[0] + at[1] - at[2]) * scale) - (2 * recipe.hub + 5) * scale;
        if (diff.some(([x, y]) => x < left || x >= left + 6 * scale || y < top || y >= top + 6 * scale)) markBad.push(`${base.name}: outside socket`);
        const A = 16 * sprite.footprint[0], B = 16 * sprite.footprint[1];
        for (const [x, y] of diff) {
          const wx = x / scale, wy = y / scale + 2 * recipe.hub;
          if (wx < -2 * B - 1 || wx > 2 * A + 1 || wy > 2 * Math.min(A, B + wx / 2) - wx / 2 + 1) prismBad.push(base.name);
        }
      }
    }
  }
  check("buildings E: all plans, blocks, landmarks and shops gain monotone light at all three resolutions", !lightBad.length, lightBad.slice(0, 8).join("; "));
  check("buildings E: a window state repaints glass and only glass, and nothing but a window state paints a pane key", !paneBad.length, paneBad.slice(0, 8).join("; "));
  // EVERY DECLARED STATE HAS TO SHOW UP. A state whose predicate never fires is
  // the constraint-that-never-fired trap wearing a different hat: the table
  // would read as three states and the city would show one.
  const missing = [1, 2, 4].flatMap(scale => WINDOW_INK.filter(k => !seen[scale].get(k)).map(k => `'${k}'@${scale}`));
  check("buildings E: every declared window state — light, blind, plant and board — paints at 1×, 2× and 4×",
    !missing.length, missing.join(" "));
  // THE FIXTURE PATTERN IS NOT THE LIGHTING PATTERN, AND THE FIRST FORM OF THIS
  // CHECK WAS TOO WEAK TO SAY SO. It asked only whether backlit and shaded cloth
  // both appear, which stayed true while the two hashes were locked together —
  // blinds were spread over three of the four cell classes, just never the same
  // three as the plants. The claim that bites is that MORE PEOPLE MOVING IN
  // BACKLIGHTS MORE OF THE CLOTH: the shares have to move with the light level,
  // and under the locked hash they did not move at all.
  check("buildings E: filling a building backlights more of its cloth and shades less — the fixtures are not the lights under another name",
    cloth.lit[0] < cloth.lit[1] && cloth.lit[1] < cloth.lit[2] && cloth.dark[0] > cloth.dark[1] && cloth.dark[1] > cloth.dark[2],
    `backlit ${cloth.lit.join(" → ")} px, shaded ${cloth.dark.join(" → ")} px across lit 1, 2, 3`);
  // A BOARDED PANE NEEDS AGE. Nothing else in the game can take a window away,
  // and an older building loses more of them.
  check("buildings E: no pane is boarded before a building is old, and an older one loses more of them",
    boards[0] === 0 && boards[1] > 0 && boards[2] > boards[1], `wear 0/1/2 → ${boards.join(" / ")} px`);
  // AND AGE TAKES PANES FROM EVERY FIXTURE. The boards are drawn from their own
  // hash, so ageing a building has to cost it lights AND blinds AND plants — a
  // board hash that shared structure with the fixture hash would leave one of
  // the three untouched, which is the shape of the bug the census above found.
  check("buildings E: ageing a building costs it lit panes, blinds and plants alike",
    [aged.light, aged.blind, aged.plant].every(([young, old]) => old < young),
    `light ${aged.light.join(" → ")}, blind ${aged.blind.join(" → ")}, plant ${aged.plant.join(" → ")} px`);
  check("buildings E: every plan's mark is visible and confined to its socket at all three resolutions", !markBad.length, markBad.slice(0, 8).join("; "));
  check("buildings E: species stamps remain inside the building footprint prism", !prismBad.length, prismBad.slice(0, 8).join("; "));
  check("buildings E: cached appearances reuse sprites and an empty unlit building keeps its base", !cacheBad.length);
  // A BOARDED PANE IS DARK WHOEVER IS HOME. Asked of the face functions over
  // their own domain rather than of the pixels, because a pixel cannot say
  // which window cell it came from — and the claim is about a cell.
  // It is asked against the BARE plan's own faces, box for box, and only where
  // the bare one painted glass: a skin may author a lit key or a fabric awning
  // itself (the meat hall does both), and a check that reads the character
  // sprite alone cannot tell that from a state and reports it as a boarded
  // window that shines.
  const mixed = [], filled = [], census = new Map(), mix = { young: new Map(), old: new Map() };
  // A cell's FIXTURE and its LIGHT are both readable off the keys it holds, so
  // this is a census of the output and not of the two hashes re-derived here.
  const fixtureOf = (inks) => BOARD.some(k => inks.has(k)) ? "board"
    : PLANT.some(k => inks.has(k)) ? "plant"
    : BLIND.some(k => inks.has(k)) ? "blind" : "plain";
  for (const base of bases) {
    const bare = RECIPES.get(base).boxes;
    for (const look of [{ lit: 1, wear: 0 }, { lit: 3, wear: 0 }, { lit: 3, wear: 2 }]) {
      const worn = RECIPES.get(characterSprite(base, { seed: 27, ...look })).boxes;
      for (let i = 0; i < worn.length; i++) {
        const bx = worn[i];
        if (!bx.faces.glazing) continue;
        for (const face of ["side", "end"]) {
          const fn = bx.faces[face], was = bare[i].faces[face];
          if (typeof fn !== "function" || typeof was !== "function") continue;
          const uMax = face === "side" ? bx.a1 - bx.a0 : bx.b1 - bx.b0, cells = new Map();
          for (let u = 0.25; u < uMax; u += 0.5) for (let k = 0.25; k < bx.c1 - bx.c0; k += 0.5) {
            if (!["=", "H"].includes(was(u, k, 0, 0))) continue;
            const cell = `${Math.floor(u / 2)},${Math.floor(k / 3)}`;
            if (!cells.has(cell)) cells.set(cell, new Set());
            cells.get(cell).add(fn(u, k, 0, 0));
          }
          for (const [, inks] of cells) {
            if (look.wear && [...inks].some(k => BOARD.includes(k)) && [...inks].some(k => k === LIT_KEY || k === "S")) mixed.push(`${base.name} ${face}`);
            if (look.lit === 3) { const m = look.wear ? mix.old : mix.young; m.set(fixtureOf(inks), 1 + (m.get(fixtureOf(inks)) || 0)); }
            if (look.wear) continue;
            const kind = fixtureOf(inks);
            // A PLANT IS IN A WINDOW, NOT INSTEAD OF ONE. It is the one state
            // found by probing rather than painted over the whole cell, so it is
            // the one that can silently swallow its own pane if the probe stops
            // answering — and every other check would stay green while it did.
            if (kind === "plant" && ![LIT_KEY, "S", ...GLASS].some(k => inks.has(k))) filled.push(`${base.name} ${face}`);
            census.set(`lit ${look.lit} ${kind} ${inks.has(LIT_KEY) || inks.has("S") ? "on" : "off"}`, 1 + (census.get(`lit ${look.lit} ${kind} ${inks.has(LIT_KEY) || inks.has("S") ? "on" : "off"}`) || 0));
          }
        }
      }
    }
  }
  check("buildings E: no window cell is both boarded and lit — a pane that is gone cannot shine", !mixed.length, mixed.slice(0, 6).join("; "));
  // THE CENSUS THAT WOULD HAVE CAUGHT THE LOCKED HASH. With the fixture drawn
  // independently of the lighting, every fixture turns up both behind a lit pane
  // and behind a dark one at every light level. With the two locked, the plants
  // lived only on the cell classes that light FIRST, so at lit 3 there was not
  // one unlit plant in the city — and every other check stayed green.
  const empty = ["lit 1", "lit 3"].flatMap(l => ["plain", "blind", "plant"].flatMap(f => ["on", "off"].map(s => `${l} ${f} ${s}`))).filter(b => !census.get(b));
  check("buildings E: a window plant sits in a pane and never swallows it", !filled.length, filled.slice(0, 6).join("; "));
  // A FIXTURE IS AN ACCENT. How many blinds is the right number of blinds is
  // taste and this gate does not hold an opinion on it — but "all of them" is
  // not a mix, it is a different feature, and no other check here can tell the
  // difference. A floor, then, and not a band: at every age most windows are
  // still just windows. (It is the derived-bar shape check-dusk's chalk check
  // ended up with, for the same reason — never demand an exact share.)
  const accent = (m) => (m.get("plain") || 0) > ["blind", "plant", "board"].reduce((n, k) => n + (m.get(k) || 0), 0);
  check("buildings E: a fixture is an accent — at every age most windows are still just windows",
    accent(mix.young) && accent(mix.old),
    `young ${[...mix.young].map(([k, v]) => `${k} ${v}`).join(", ")} · old ${[...mix.old].map(([k, v]) => `${k} ${v}`).join(", ")}`);
  check("buildings E: every window fixture turns up behind a lit pane and a dark one at every light level",
    !empty.length, `empty: ${empty.join(", ")}`);
  const W = createWorld({ seed: "people-e" });
  const home = 1000, job = 1001;
  W.zone[home] = ZONE.R; W.zone[job] = ZONE.C; W.tier[home] = W.tier[job] = 1;
  W.citizens = [{ id: 1, species: "rabbit", home, job: -1 }, { id: 2, species: "fox", home: -1, job }];
  recountMajority(W);
  const r = lotReport(W, home).mark, c = lotReport(W, job).mark;
  W.citizens = []; recountMajority(W);
  check("buildings E: Inspect names residents on R, staff on C, and removes the mark after vacancy",
    r?.species === "rabbit" && r.line === "a warren door — rabbits live here" && c?.species === "fox" && c.line === "a brush weathervane — foxes work here" && lotReport(W, home).mark === null && lotReport(W, job).mark === null);
  console.log(`buildings E: ${bases.length} plans, ${lightPixels} light pixels, ${markPixels} mark pixels checked at all three resolutions`);
}
