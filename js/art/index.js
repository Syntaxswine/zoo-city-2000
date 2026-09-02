// index.js — the registry the renderer calls. SPEC §16.
//
//   art.building(zone, tier, variant)   zone 1|2|3 or 'R'|'C'|'I', tier 1..3
//   art.civic(kind)                     'park' | 'zoo'
//   art.road(mask, busy)                4-bit mask N=1 E=2 S=4 W=8
//   art.bridge(mask)
//   art.ground(kind, variant)           'grass' 0..2 | 'water' | 'rubble'
//                                       | 'chalk' variant = zone*2 + (high?1:0)
//                                       | 'kerb' side 0..3 (N E S W)
//   art.chalk(zone, high)               the same, spelled out
//   art.tree(kind)                      'round' | 'tall' | 'willow' or 0..2
//   art.citizen(species, facing, frame, age, opts)
//   art.overlay(kind, frame)            'scaffold' | 'fire' 0..1 | 'flood' | 'rubble'
//                                       | 'tent' | 'hat' | 'meeting' | 'plaza' | 'cursor' | 'ghost'
//   art.zot(kind)                       'noroad' | 'smog' | 'nojob' | 'nodemand'
//   art.waterTint(frame)                key map for the water cycle, frame mod WATER_FRAMES (4)
//   allSprites()                        [{ name, sprite }] for the audit
//
// Every sprite is { rows, anchor, w, h, footprint } from defineSprite —
// text, rasterised lazily by whoever owns a canvas.

import { buildingSprite, civicSprite, overlaySprite, allBuildings } from "./buildings.js";
import { roadSprite, bridgeSprite, allRoads } from "./roads.js";
import { GRASS, CHALK, RUBBLE, WATER_TILE, KERB, TREES, TREE_LIST, ZOTS, PLAZA, CURSOR, GHOST, waterTint, WATER_FRAMES, allTerrain } from "./terrain.js";
import { citizenSprite, TENT, HAT, MEETING, allCitizens } from "./citizens.js";

const EXTRA = { tent: TENT, hat: HAT, meeting: MEETING, plaza: PLAZA, cursor: CURSOR, ghost: GHOST };

export function ground(kind, variant = 0) {
  switch (kind) {
    case "grass":
      return GRASS[((variant % 3) + 3) % 3];
    case "water":
      return WATER_TILE;
    case "rubble":
      return RUBBLE;
    case "chalk": {
      const zone = Math.floor(variant / 2), high = variant % 2 === 1;
      return chalk(zone, high);
    }
    case "kerb":
      return KERB[variant & 3];
    default:
      throw new Error(`art.ground: unknown kind '${kind}'`);
  }
}

export function chalk(zone, high = false) {
  const z = typeof zone === "string" ? { R: 1, C: 2, I: 3 }[zone] : zone;
  const list = CHALK[z];
  if (!list) throw new Error(`art.chalk: unknown zone '${zone}'`);
  return list[high ? 1 : 0];
}

export function tree(kind = "round") {
  if (typeof kind === "number") return TREE_LIST[((kind % 3) + 3) % 3];
  const s = TREES[kind];
  if (!s) throw new Error(`art.tree: unknown kind '${kind}'`);
  return s;
}

export function overlay(kind, frame = 0) {
  if (EXTRA[kind]) return EXTRA[kind];
  return overlaySprite(kind, frame);
}

export function zot(kind) {
  const s = ZOTS[kind];
  if (!s) throw new Error(`art.zot: unknown kind '${kind}'`);
  return s;
}

export const art = Object.freeze({
  building: buildingSprite,
  civic: civicSprite,
  road: roadSprite,
  bridge: bridgeSprite,
  ground,
  chalk,
  tree,
  citizen: citizenSprite,
  overlay,
  zot,
  waterTint,
  WATER_FRAMES,
});

/** Every sprite the registry can hand out, named — the check.mjs audit walks this. */
export function allSprites() {
  const out = [...allBuildings(), ...allRoads(), ...allTerrain(), ...allCitizens()];
  const seen = new Set();
  return out.filter(({ name }) => (seen.has(name) ? false : (seen.add(name), true)));
}

export default art;
