// Large civic campuses: 48×48 world units = 3×3 tiles. Art only; placement,
// access and save migration belong to the civic-footprint implementation.
// Select with art.civic(kind, 3). Legacy art remains the default until then.
import { box, flatSkin, litSkin } from "./solid.js";
import { solidSprite, registerLargeCivics, KIT } from "./buildings.js";
import { BLOCK_KIT } from "./blocks.js";
import { TREE_ROUND, TREE_TALL, TREE_WILLOW } from "./terrain.js";

const { BRICK, CONC, CONC_WALL, EARTH, SLATE, GRASS, TIMBER, SLATE_SKIN,
  C_ROOF, STEP, LAMP, BLUE_LAMP, POST, walled, doorAt, brickGrain } = KIT;
const { hipRoof, bench, fountain, van } = BLOCK_KIT;
const PAVING = flatSkin(CONC[3], CONC[2], CONC[1]);
const LAWN = flatSkin(GRASS[3], GRASS[1], GRASS[0]);
const WATER = flatSkin("I", "H", "G");
const RED = flatSkin("9", "8", "7");
const BLUE = flatSkin("=", "6", "H");
const WHEEL = flatSkin("+", "+", "+");
const slab = (a, b, w, d, c = 0, h = .6, skin = PAVING) => box(a, a + w, b, b + d, c, c + h, skin);
const wall = (h, material = CONC_WALL, opts = {}) => walled(litSkin(material, { height: h }), h,
  { storey: 8, sill: 3, winH: 3, period: 5, winW: 2, from: 1, ...opts });
const lamp = (a, b, c, blue = false) => [box(a, a + .6, b, b + .6, .6, c, POST), box(a - .3, a + 1.2, b - .3, b + 1.2, c, c + 1.2, blue ? BLUE_LAMP : LAMP)];
const planter = (a, b, w = 5, d = 3) => [slab(a, b, w, d, .6, 1.2, STEP), slab(a + .5, b + .5, w - 1, d - 1, 1.8, 1, LAWN)];

// A parked vehicle faces +b: two visible wheels, windscreen, bonnet and
// independent light bar. All dimensions stay in the site's actual footprint.
function vehicle(a, b, fire = false) {
  const w = fire ? 5 : 4.5, d = fire ? 10 : 8;
  const skin = fire ? RED : flatSkin(CONC[4], CONC[2], CONC[1]);
  const boxes = [
    box(a, a + w, b, b + d, 1, 2, WHEEL),
    box(a, a + w, b, b + d, 2, 4, skin),
    box(a + .3, a + w - .3, b + 1, b + d - 2, 4, 6, {
      top: skin.top, side: (u, k) => k > .3 ? "=" : (fire ? "8" : "6"),
      end: (u, k) => u > 1 && u < d - 4 && k > .3 ? "H" : (fire ? "7" : "&"),
    }),
    box(a + .5, a + w - .5, b + d - 3, b + d - 2, 6, 6.7, fire ? RED : BLUE),
  ];
  for (const db of [1, d - 2]) boxes.push(box(a + w, a + w + .5, b + db, b + db + 1, .6, 2.5, WHEEL));
  if (fire) {
    boxes.push(box(a + 1, a + 1.4, b + 1, b + d - 3, 6, 6.5, STEP), box(a + 3.4, a + 3.8, b + 1, b + d - 3, 6, 6.5, STEP));
    for (let db = 1; db <= d - 3; db += 1.5) boxes.push(box(a + 1, a + 3.8, b + db, b + db + .4, 6, 6.5, STEP));
  }
  return boxes;
}

function firehouse() {
  const H = 16, brick = litSkin(BRICK, { height: H, grain: brickGrain });
  const bays = {
    top: brick.top,
    side: (u, k, x, y) => {
      const g = H - k;
      if (u >= 1 && u < 29 && g >= 11 && g < 13) return "8";
      if ([5, 15, 25].some(m => Math.abs(u - m) < 3.5) && g < 10) return Math.floor(g) % 2 ? "+" : SLATE[0];
      return brick.side(u, k, x, y);
    },
    end: wall(H, BRICK).end,
  };
  return [
    slab(0, 0, 48, 48), slab(1, 33, 12, 14, .6, .2, LAWN),
    box(2, 32, 3, 23, .6, H + .6, bays), ...hipRoof(2, 32, 3, 23, H + .6, 3, 1.5),
    // Crew quarters and hose-drying tower give the firehouse a tall corner.
    box(33, 46, 3, 23, .6, 22.6, wall(22, BRICK, { door: doorAt(7, 6) })),
    ...hipRoof(33, 46, 3, 23, 22.6, 3, 1.5),
    box(35, 43, 5, 13, 23, 41, wall(18, BRICK, { period: 4, winW: 1 })),
    slab(34, 4, 10, 10, 41, 1.5, SLATE_SKIN),
    box(37, 41, 7, 11, 42.5, 46, TIMBER), slab(36, 6, 6, 6, 46, 1, SLATE_SKIN),
    // Three apron lanes. One open bay stays visible beside two engines.
    ...[4, 14, 24].map(a => slab(a, 23, .45, 22, .6, .08, STEP)),
    ...vehicle(5, 25, true), ...vehicle(25, 29, true),
    ...lamp(44, 27, 7), ...bench(4, 38),
    box(16, 17, 40, 41, .6, 3, RED), box(15.5, 17.5, 40, 41, 2, 2.8, RED),
    ...planter(35, 35, 10, 8),
  ];
}

function police() {
  const entrance = wall(22, CONC_WALL, { door: doorAt(10, 9, 2.5), period: 5 });
  const bars = wall(13, CONC_WALL, { storey: 13, sill: 6, winH: 3, period: 3, winW: 1, from: 1 });
  return [
    slab(0, 0, 48, 48),
    box(10, 32, 4, 23, .6, 22.6, entrance), slab(9.5, 3.5, 23, 20, 22.6, 1.2, C_ROOF),
    box(2, 10, 5, 24, .6, 13.6, bars), slab(1.5, 4.5, 9, 20, 13.6, 1.2, C_ROOF),
    box(32, 46, 5, 24, .6, 13.6, wall(13)), slab(31.5, 4.5, 15, 20, 13.6, 1.2, C_ROOF),
    // A broad blue lintel, portico and stepped public square.
    box(13, 29, 23, 27, 10, 11.5, BLUE),
    box(13, 14.5, 25.5, 27, 2, 10, litSkin(CONC, { height: 8 })),
    box(27.5, 29, 25.5, 27, 2, 10, litSkin(CONC, { height: 8 })),
    slab(13, 23, 16, 5, .6, 1.4, STEP), slab(12, 28, 18, 2, .6, .9, STEP), slab(11, 30, 20, 2, .6, .4, STEP),
    // The badge is a small gold shield inset in the upper facade, no lettering.
    box(18, 24, 23, 23.3, 15, 20, { top: () => EARTH[4], side: (u, k) => k < 3 || Math.abs(u - 3) < 1.5 ? "-" : CONC[2], end: () => EARTH[2] }),
    box(35, 35.7, 7, 7.7, 14.8, 32, POST), box(35, 39, 7, 7.5, 28, 31, BLUE),
    ...lamp(10, 29, 8, true), ...lamp(32, 29, 8, true),
    ...vehicle(35, 32), ...vehicle(41, 32),
    ...planter(2, 31, 7, 13), ...bench(14, 39), ...bench(24, 39),
    slab(32.5, 31, .4, 15, .6, .08, STEP), slab(39, 31, .4, 15, .6, .08, STEP),
  ];
}

function centre() {
  const pale = CONC.slice(1);
  const treatment = wall(12, pale, { storey: 12, sill: 5, winH: 3, period: 3, winW: 1 });
  return [
    slab(0, 0, 48, 48, 0, .6, LAWN),
    // A low U around a garden, with a clear public entrance and a side van bay.
    box(3, 45, 3, 14, .6, 13.6, wall(13, pale)), slab(2.5, 2.5, 43, 12, 13.6, 1.1, C_ROOF),
    box(3, 14, 14, 33, .6, 12.6, treatment), slab(2.5, 13.5, 12, 20, 12.6, 1.1, C_ROOF),
    box(34, 45, 14, 33, .6, 12.6, treatment), slab(33.5, 13.5, 12, 20, 12.6, 1.1, C_ROOF),
    slab(14, 14, 20, 19, .6, .3, PAVING),
    ...fountain(24, 23, 3), ...bench(16, 17), ...bench(26, 28),
    // Reception projects into the forecourt. Cross is brown on pale masonry.
    box(16, 32, 33, 42, .6, 10.6, wall(10, pale, { door: doorAt(8, 6, 2) })),
    slab(15.5, 32.5, 17, 10, 10.6, 1, C_ROOF),
    box(23.5, 24.5, 42, 42.3, 7, 10, TIMBER), box(22.5, 25.5, 42, 42.3, 8, 9, TIMBER),
    slab(20, 42, 8, 6, .6, .5, STEP),
    slab(1, 34, 14, 13, .6, .2, PAVING), ...van(4, 38), ...van(4, 43),
    ...planter(34, 37, 11, 8), ...lamp(29, 44, 7),
  ];
}

function zoo() {
  const fence = { top: () => EARTH[4], side: u => Math.floor(u) % 2 ? null : EARTH[3], end: u => Math.floor(u) % 2 ? null : EARTH[2] };
  return [
    slab(0, 0, 48, 48, 0, .6, LAWN),
    // Paths connect the gate to the pond overlook and two open shelters.
    slab(20, 7, 7, 41, .6, .15), slab(6, 24, 35, 5, .6, .15),
    slab(3, 6, 14, 15, .6, .8, STEP), slab(4, 7, 12, 13, 1.4, .2, WATER),
    slab(7, 17, 13, 3, 1.6, .6, TIMBER),
    ...[8, 13, 18].map(a => box(a, a + .5, 19, 19.5, 2.2, 4.5, TIMBER)),
    box(7, 20, 19, 19.5, 4.5, 5, TIMBER),
    // Keeper kiosk and a raised roost pavilion, each under a hipped roof.
    box(31, 44, 5, 16, .6, 9.6, wall(9, EARTH, { door: doorAt(7, 5) })),
    ...hipRoof(31, 44, 5, 16, 9.6, 3, 1.5),
    slab(31, 31, 13, 11, .6, 1.2, TIMBER),
    ...[[32,32],[42,32],[32,40],[42,40]].map(([a,b])=>box(a,a+1,b,b+1,1.8,11,TIMBER)),
    ...hipRoof(31,44,31,42,11,3,1.5),
    box(35,36,33,34,1.8,8,TIMBER), box(33,39,33,34,8,8.7,TIMBER),
    ...bench(8, 31), ...bench(29, 22),
    // Perimeter rails stop at the front arch: the gate really reads as open.
    box(0,48,0,1,.6,4.6,fence), box(0,1,0,48,.6,4.6,fence),
    box(47,48,0,48,.6,4.6,fence), box(0,19,47,48,.6,4.6,fence), box(29,48,47,48,.6,4.6,fence),
    box(0,19,47,48,4.6,5.1,TIMBER), box(29,48,47,48,4.6,5.1,TIMBER),
    box(18,20,44,47,.6,12,TIMBER), box(28,30,44,47,.6,12,TIMBER),
    box(18,30,44,47,10,13,TIMBER),
    // A paw relief on the gate, legible as four toes over a pad.
    box(22,26,47,47.3,10.5,11.7,STEP), box(21,22,47,47.3,12,13,STEP), box(23,24,47,47.3,12,13.5,STEP), box(25,26,47,47.3,12,13.5,STEP), box(27,28,47,47.3,12,13,STEP),
    ...lamp(17,45,7), ...lamp(31,45,7),
  ];
}

const PLANS = { fire: firehouse, police, centre, zoo };
const TREES = {
  fire: [[TREE_ROUND, 39, 39, 2.8]],
  police: [[TREE_TALL, 5, 36, 2.8]],
  centre: [[TREE_ROUND, 39, 41, 2.8]],
  zoo: [[TREE_ROUND, 8, 39, .6], [TREE_WILLOW, 9, 9, .6], [TREE_TALL, 42, 22, .6]],
};
export const LARGE_CIVICS = Object.freeze(Object.fromEntries(Object.entries(PLANS).map(([kind, make]) =>
  [kind, solidSprite(`civic-${kind}-3x3`, make(), { hub: 24, footprint: [3, 3], tags: ["civic", "civic-large", kind],
    stamps: TREES[kind], extent: [box(0,48,0,48,0,52,{})] })])));
registerLargeCivics(LARGE_CIVICS);
export const allLargeCivics = () => Object.values(LARGE_CIVICS).map(sprite => ({name: sprite.name, sprite}));
