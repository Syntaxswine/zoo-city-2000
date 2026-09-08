// Code-native solids use the same palette, lighting and footprint audit as
// the existing civics. Crop rows, headstones, settling tanks and bins read
// distinctly at the game's smallest zoom.
import { box, flatSkin } from "./solid.js";
import { solidSprite, registerCivicKind, KIT } from "./buildings.js";
const { GRASS, CONC, TIMBER, SLATE_SKIN } = KIT;
const lawn = flatSkin(GRASS[3], GRASS[1], GRASS[0]);
const stone = flatSkin(CONC[3], CONC[2], CONC[1]);
const crops = flatSkin("7", "t", "s");
const water = flatSkin("H", "G", "F");
const soil = flatSkin("s", "r", "q");
function plan(kind, side) {
  const n = side * 16, shapes = [box(0, n, 0, n, 0, 0.5, lawn)];
  if (kind === "farm") {
    shapes.push(box(2, 22, 2, 30, 0.5, 0.8, soil));
    for (let x = 3; x < 22; x += 4) shapes.push(box(x, x + 1.5, 3, 29, 0.8, 2, crops));
    shapes.push(box(24, 30, 3, 13, 0.5, 7, TIMBER), box(23, 31, 2, 14, 7, 8, SLATE_SKIN));
    shapes.push(box(25, 29, 19, 23, 0.5, 3, stone), box(25.5, 28.5, 19.5, 22.5, 3, 3.3, water));
  } else if (kind === "cemetery") {
    const mid = n / 2;
    shapes.push(box(mid - 2, mid + 2, 0, n, 0.5, 0.7, stone), box(0, n, mid - 2, mid + 2, 0.5, 0.7, stone));
    for (let x = 5; x < n - 3; x += 10) for (let y = 6; y < n - 5; y += 12) {
      if (Math.abs(x - mid) < 6 || Math.abs(y - mid) < 7) continue;
      shapes.push(box(x - 1, x + 2, y, y + 1, 0.5, 5.5, stone), box(x - 1, x + 2, y + 1, y + 4, 0.5, 0.8, soil));
    }
    if (side === 6) shapes.push(box(mid - 4, mid + 4, mid - 4, mid + 4, 0.5, 2, stone), box(mid - 1, mid + 1, mid - 1, mid + 1, 2, 12, stone));
  } else if (kind === "doctor" || kind === "hospital") {
    const h = kind === "hospital" ? 18 : 10;
    shapes.push(box(4, n - 4, 5, n - 9, 0.5, h, stone), box(3, n - 3, 4, n - 8, h, h + 1, SLATE_SKIN));
    shapes.push(box(n / 2 - 3, n / 2 + 3, n - 9, n - 6, 0.5, 7, water), box(n / 2 - 3, n / 2 + 3, n - 6, n, 0.5, 0.8, stone));
    // Teal medical cross on the roof; distinct from emergency-service roofs.
    shapes.push(box(n / 2 - 2, n / 2 + 2, 9, n - 13, h + 1, h + 1.5, water), box(n / 2 - 7, n / 2 + 7, n / 2 - 6, n / 2 - 2, h + 1, h + 1.5, water));
  } else if (kind === "sanitation") {
    shapes.push(box(3, 45, 3, 15, 0.5, 10, stone), box(2, 46, 2, 16, 10, 11, SLATE_SKIN));
    for (const x of [3, 26]) {
      shapes.push(box(x, x + 19, 21, 44, 0.5, 4, stone), box(x + 2, x + 17, 23, 42, 4, 4.3, water));
      shapes.push(box(x, x + 19, 31, 32, 4.3, 5, SLATE_SKIN));
    }
  } else {
    shapes.push(box(2, 30, 2, 17, 0.5, 9, stone), box(1, 31, 1, 18, 9, 10, SLATE_SKIN));
    for (const x of [3, 13, 23]) shapes.push(box(x, x + 6, 22, 29, 0.5, 5, TIMBER), box(x, x + 6, 22, 29, 5, 5.6, SLATE_SKIN));
  }
  return shapes;
}
export const INFRASTRUCTURE_CIVICS = Object.freeze(Object.fromEntries([["farm", 2], ["cemetery", 2], ["cemetery", 6], ["sanitation", 3], ["garbage", 2], ["doctor", 2], ["hospital", 3]].map(([kind, side]) => {
  const n = side * 16;
  const sprite = solidSprite(`civic-${kind}-${side}x${side}`, plan(kind, side), {
    hub: n / 2, footprint: [side, side], tags: ["civic", kind],
    extent: [box(0, n, 0, n, 0, 20, {})],
  });
  registerCivicKind(kind, side, sprite);
  return [`${kind}-${side}`, sprite];
})));
export const allInfrastructureCivics = () => Object.values(INFRASTRUCTURE_CIVICS).map(sprite => ({ name: sprite.name, sprite }));
