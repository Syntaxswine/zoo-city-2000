// Refine the composed animal, preserving every pose, age, coat and accessory.
// Details stay inside the silhouette; foot anchors and picking do not move.
import { CITIZEN_DETAILS } from "./citizens.js";
import { rampOf, shift } from "./palette.js";

// What is FUR. The composer says so: a pixel it drew in an authoring rung
// (w x y z, `CITIZEN_DETAILS.authored`) is fur whatever coat was laid over
// it. The three ramps below are what this pass used to go by alone — and
// they still catch the coat's own keys that a look, an age or a stripe
// stamps straight in (a fox's white tail-tip, an elder's grey brows, the
// skunk's stripe), which are fur too. Going by the ramp alone, the hawk —
// whose coat is `earth` — was never fur here: its twin was a plain
// enlargement with a detailed shirt, 3% of its pixels touched against
// 7–16% for every other species, and its feather rule below never fired.
const FUR_RAMPS = new Set(["furWarm", "furCool", "olive"]);
const AUTHORED_FUR = new Set(["w", "x", "y", "z"]);

export function detailedCitizen(sprite, scale) {
  const info = CITIZEN_DETAILS.get(sprite);
  if (!info) return null;
  const { species, age, lift, ox, facing, suit } = info;
  const cub = age === "cub", west = facing === "sw" || facing === "nw";
  const front = facing === "se" || facing === "sw";
  const at = (x, y) => sprite.rows[y]?.[x] || ".";
  // Where the FIGURE ends — the composer's, not the ink's. For every species
  // but one they are the same place. The tortoise wears a 1-px '+' outline
  // round its figure (citizens.js), so its limbs never touch a transparent
  // pixel and no edge rule below ever fired on them: 2.4% of its fur was
  // reworked at 2× against a median of 19.1%. The outline is ink the composer
  // drew OUTSIDE its authored figure; a corner cut there is cut to the
  // outline, not to a hole inside it.
  const off = (x, y) => ((info.authored ? info.authored[y]?.[x] : at(x, y)) ?? ".") === ".";
  const cut = (ax, ay, bx, by) => (at(ax, ay) === "." || at(bx, by) === "." ? "." : at(ax, ay));
  const rows =Array.from({ length: sprite.h * scale }, () => Array(sprite.w * scale).fill("."));
  for (let y = 0; y < sprite.h; y++) for (let x = 0; x < sprite.w; x++) {
    const key = at(x, y);
    if (key === ".") continue;
    const ramp = rampOf(key)?.name;
    const fur = AUTHORED_FUR.has(info.authored?.[y]?.[x]) || FUR_RAMPS.has(ramp);
    const localY = y - lift;
    const shirt = (key === "&" || key === "^") && y >= (cub ? 7 : lift + 8) && y <= (cub ? 9 : lift + 12);
    for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
      const u = sx / scale, v = sy / scale;
      let ink = key;
      // Chamfer exposed corners; keep the silhouette connected.
      if (fur && off(x - 1, y) && off(x, y - 1) && u + v < 0.5) ink = cut(x - 1, y, x, y - 1);
      else if (fur && off(x + 1, y) && off(x, y - 1) && 1 - u + v < 0.5) ink = cut(x + 1, y, x, y - 1);
      else if (fur) {
        if (off(x - 1, y) && u < 0.25) ink = shift(key, 1);
        else if (off(x + 1, y) && u > 0.6) ink = shift(key, -1);
        else if (["owl", "hawk"].includes(species) && localY > 8 && (x + y) % 3 === 0 && v > 0.6 && u < 0.5) ink = shift(key, -1);
        else if ((x * 3 + y * 5) % 11 === 0 && u < 0.25 && v > 0.5) ink = shift(key, 1);
        if (y >= sprite.h - 2 && u > 0.6 && v > 0.6 && at(x + 1, y) !== ".") ink = shift(key, -1);
      }
      if (shirt && !suit) {
        const centre = sprite.w / 2 + (west ? -0.5 : 0.5);
        if (Math.abs(x + u - centre) < 0.22) ink = "%";
        if (front && Math.abs(x + u - centre - 0.5) < 0.2 && (y + v - lift) % 2 < 0.35) ink = "(";
        if (at(x, y - 1) !== "&" && at(x, y - 1) !== "^" && v < 0.25) ink = "*";
        if (at(x, y + 1) !== "&" && at(x, y + 1) !== "^" && v > 0.6) ink = "%";
      }
      if (suit && ramp === "slate" && y >= (cub ? 7 : lift + 8)) {
        // Fine stitching, pocket welt and a pressed trouser crease.
        if (localY >= (cub ? 9 : 14) && u < 0.25 && at(x - 1, y) === key) ink = shift(key, 1);
        if (front && !cub && localY === 11 && x === (west ? sprite.w - ox - 5 : ox + 4) && v < 0.25) ink = "^";
        if (at(x + 1, y) === "." && u > 0.6) ink = shift(key, -1);
      }
      if (species === "tortoise" && ramp === "earth" && localY >= 8) {
        if ((x + Math.floor(y / 2)) % 3 === 0 && u < 0.25 || y % 3 === 0 && v < 0.25) ink = "r";
      }
      if (species === "beaver" && ramp === "earth" && localY > 10 && (x + y) % 2 === 0 && u < 0.25) ink = shift(key, -1);
      rows[y * scale + sy][x * scale + sx] = ink;
    }
  }
  const put = (x, y, key) => {
    x = Math.round(x * scale); y = Math.round(y * scale);
    if (rows[y]?.[x] && rows[y][x] !== ".") rows[y][x] = key;
  };
  // Only real authored eyes receive catchlights, preserving glasses/masks
  // and the owl's idle head turn. No eyes are painted on the back of a head.
  if (front && !cub && info.eyes) {
    for (const eye of info.eyes.slice(0, 2)) {
      const x = west ? sprite.w - 1 - (eye + ox) : eye + ox;
      const y = info.eyes[2] + lift;
      if (at(x, y) === "+") put(x + 0.25, y + 0.25, "(");
    }
  }
  if (front && ["beaver", "rabbit", "pig", "cow"].includes(species)) {
    for (let y = lift + 5; y < Math.min(sprite.h, lift + 9); y++) for (let x = ox + 2; x < sprite.w - 2; x++) {
      if (at(x, y) === "(" && at(x + 1, y) === "(") put(x + 0.75, y + 0.5, "s");
    }
  }
  return rows.map(row => row.join(""));
}
