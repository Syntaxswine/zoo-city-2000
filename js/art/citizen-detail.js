// Refine the composed animal, preserving every pose, age, coat and accessory.
// Details stay inside the silhouette; foot anchors and picking do not move.
import { CITIZEN_DETAILS } from "./citizens.js";
import { rampOf, shift } from "./palette.js";

export function detailedCitizen(sprite, scale) {
  const info = CITIZEN_DETAILS.get(sprite);
  if (!info) return null;
  const { species, age, lift, ox, facing, suit } = info;
  const cub = age === "cub", west = facing === "sw" || facing === "nw";
  const front = facing === "se" || facing === "sw";
  const at = (x, y) => sprite.rows[y]?.[x] || ".";
  const rows = Array.from({ length: sprite.h * scale }, () => Array(sprite.w * scale).fill("."));
  for (let y = 0; y < sprite.h; y++) for (let x = 0; x < sprite.w; x++) {
    const key = at(x, y);
    if (key === ".") continue;
    const ramp = rampOf(key)?.name;
    const fur = ramp === "furWarm" || ramp === "furCool" || ramp === "olive";
    const localY = y - lift;
    const shirt = (key === "&" || key === "^") && y >= (cub ? 7 : lift + 8) && y <= (cub ? 9 : lift + 12);
    for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
      const u = sx / scale, v = sy / scale;
      let ink = key;
      // Chamfer exposed corners; keep the silhouette connected.
      if (fur && at(x - 1, y) === "." && at(x, y - 1) === "." && u + v < 0.5) ink = ".";
      else if (fur && at(x + 1, y) === "." && at(x, y - 1) === "." && 1 - u + v < 0.5) ink = ".";
      else if (fur) {
        if (at(x - 1, y) === "." && u < 0.25) ink = shift(key, 1);
        else if (at(x + 1, y) === "." && u > 0.6) ink = shift(key, -1);
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
