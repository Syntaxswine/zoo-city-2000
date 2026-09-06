// Close-up skins keep the original solids, doors, lighting and z-buffer.
// Features use world coordinates: masonry courses and window frames remain
// attached to the building when switching between the 2x and 4x rasters.
import { rampOf, shift } from "./palette.js";

const mod = (n, d) => ((n % d) + d) % d;
const glass = key => key === "=" || key === "H" || key === "-";

export function detailedRecipe(recipe) {
  return { ...recipe, boxes: recipe.boxes.map(b => {
    const height = b.c1 - b.c0;
    const faces = { ...b.faces };
    for (const face of ["top", "side", "end"]) {
      const original = b.faces[face];
      if (typeof original !== "function") continue;
      faces[face] = (u, v, x, y) => {
        const key = original(u, v, x, y);
        if (!key || key === ".") return key;
        const material = rampOf(key)?.name;
        // Timber seats and low fences get slats too, including the small park.
        if (material === "earth" && b.c1 >= 4 && face === "top" && mod(v, 1.5) < 0.2) return shift(key, -1);
        if (face !== "top" && b.faces.glazing && glass(key)) {
          // Recessed jambs and sills follow the actual window aperture,
          // including continuous shopfront glazing and occupied windows.
          const edgeU = !glass(original(Math.max(0, u - 0.22), v, x, y));
          const edgeV = !glass(original(u, Math.min(height, v + 0.28), x, y));
          if (edgeU) return face === "side" ? "^" : "%";
          if (edgeV) return face === "side" ? "*" : "&";
          if (mod(u, 2) < 0.16 || mod(v, 3) < 0.16) return face === "side" ? "^" : "%";
          if (mod(u + v * 0.35, 4) < 0.24) return face === "side" ? "(" : "I";
          return key;
        }
        if (face !== "top" && height >= 4) {
          const elevation = b.c1 - v;
          if (material === "brick") {
            // Staggered mortar, not random screen-space noise.
            const course = Math.floor(elevation / 1.5);
            if (mod(elevation, 1.5) < 0.16 || mod(u + (course % 2) * 1.5, 3) < 0.12) return shift(key, -1);
            if (mod(elevation, 1.5) > 1.28) return shift(key, 1);
          }
          if (material === "concrete") {
            if (mod(u, 4) < 0.14 || mod(elevation, 6) < 0.18) return shift(key, -1);
            if (u < 0.28) return shift(key, 1);
          }
          if (material === "rust" && mod(u, 1.25) < 0.2) return shift(key, -1);
          if (material === "earth" && mod(elevation, 1.6) < 0.18) return shift(key, -1);
          // Door panels and a brass latch, confined to existing door ink.
          if (key === "+" && b.faces.glazing && elevation < 6) {
            if (mod(u, 1) < 0.15 && elevation > 1) return "r";
            if (mod(u, 2) < 0.25 && Math.abs(elevation - 2.5) < 0.22) return "]";
          }
        }
        if (face === "top" && b.c1 >= 8) {
          if (material === "slate") {
            if (mod(v, 1.5) < 0.18 || mod(u + Math.floor(v / 1.5), 2.5) < 0.13) return shift(key, -1);
          } else if (material === "concrete" && (mod(u, 4) < 0.15 || mod(v, 4) < 0.15)) return shift(key, -1);
          else if (material === "rust" && mod(u, 1.5) < 0.2) return shift(key, -1);
        }
        return key;
      };
    }
    return { ...b, faces };
  }) };
}
