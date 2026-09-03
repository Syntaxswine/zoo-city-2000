// index.js — the registry the renderer calls. SPEC §16.
//
//   art.building(zone, tier, variant, side, theme)   zone 1|2|3|4 or 'R'|'C'|'I'|'M', tier 1..3; side 2 | 3 → the zone's block (blocks.js), tier ignored;
//                                       variant is the tile's whole byte: & 1 the mirror; for C tier 1, >> 1 picks the shop of the pool (shops.js)
//                                       theme > 0 with side 3 → that landmark (landmarks.js; ids per js/sim/landmarks.js)
//   art.civic(kind)                     'park' | 'zoo' | 'fire' | 'police' | 'centre'
//   art.road(mask, busy)                4-bit mask N=1 E=2 S=4 W=8
//   art.bridge(mask)
//   art.wall(mask)                      the same mask; a standing sprite (walls.js)
//   art.tunnel(axis)                    'ns' | 'ew' — the road's axis through the wall
//   art.rail(mask)                      the same mask; a ground sprite (rail.js)
//   art.station(axis)                   'ns' | 'ew' — a standing platform and shelter over a rail tile
//   art.ground(kind, variant)           'grass' 0..2 | 'water' | 'rubble'
//                                       | 'chalk' variant = zone*2 + (high?1:0)
//                                       | 'kerb' side 0..3 (N E S W)
//   art.chalk(zone, high)               the same, spelled out
//   art.tree(kind)                      'round' | 'tall' | 'willow' or 0..2
//   art.citizen(species, facing, frame, age, opts)   opts.hat, opts.carry 'sack'
//   art.overlay(kind, frame)            'scaffold' | 'fire' 0..1 | 'flood' | 'rubble'
//                                       | 'tent' | 'hat' | 'meeting' | 'plaza' | 'cursor' | 'ghost'
//                                       | 'sack' 0 open (falling) | 1 tied | 2 tied, wriggling
//   art.zot(kind)                       'noroad' | 'smog' | 'nojob' | 'nodemand'
//   art.waterTint(frame)                key map for the water cycle, frame mod WATER_FRAMES (4)
//   art.hires(sprite)                   the sprite's 2× twin from its recipe (hires.js), or null for a hand-drawn one; the renderer uses it at zoom 2
//   art.bubble(w, h)                    reserved for Part A
//   art.portrait(species, opts)         reserved for Part D
//   art.mark(species)                   reserved for Part E
//   art.look(id)                        stable citizen look; neutral until Part D
//   art.crossing(axis, busy)            reserved for Part X
//   allSprites()                        [{ name, sprite }] for the audit
//
// Every sprite is { rows, anchor, w, h, footprint } from defineSprite —
// text, rasterised lazily by whoever owns a canvas.

import { buildingSprite, civicSprite, overlaySprite, allBuildings } from "./buildings.js";
import { allBlocks } from "./blocks.js"; // registers the 2×2 and 3×3 families with buildings.js at load
import { allLandmarks } from "./landmarks.js"; // registers the eleven landmarks (SPEC §3c)
import { allShops } from "./shops.js"; // registers the shop pool (SPEC §12.2d)
import { hires } from "./hires.js";
import { roadSprite, bridgeSprite, allRoads } from "./roads.js";
import { wallSprite, tunnelSprite, allWalls } from "./walls.js";
import { railSprite, stationSprite, allRail } from "./rail.js";
import { GRASS, CHALK, RUBBLE, WATER_TILE, KERB, TREES, TREE_LIST, ZOTS, PLAZA, CURSOR, GHOST, waterTint, WATER_FRAMES, allTerrain } from "./terrain.js";
import { citizenSprite, TENT, HAT, MEETING, SACKS, allCitizens } from "./citizens.js";

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
  const z = typeof zone === "string" ? { R: 1, C: 2, I: 3, M: 4 }[zone] : zone;
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
  if (kind === "sack") return SACKS[((frame % 3) + 3) % 3];
  if (EXTRA[kind]) return EXTRA[kind];
  return overlaySprite(kind, frame);
}

export function zot(kind) {
  const s = ZOTS[kind];
  if (!s) throw new Error(`art.zot: unknown kind '${kind}'`);
  return s;
}

function notBuilt(name) {
  throw new Error(`art.${name}: not built`);
}

export function bubble(_w, _h) { return notBuilt("bubble"); }
export function portrait(_species, _opts = {}) { return notBuilt("portrait"); }
export function mark(_species) { return notBuilt("mark"); }
export function look(_id) { return { shade: 0, mark: 0 }; }
export function crossing(_axis, _busy = false) { return notBuilt("crossing"); }

export const art = Object.freeze({
  building: buildingSprite,
  civic: civicSprite,
  road: roadSprite,
  bridge: bridgeSprite,
  wall: wallSprite,
  tunnel: tunnelSprite,
  rail: railSprite,
  station: stationSprite,
  ground,
  chalk,
  tree,
  citizen: citizenSprite,
  overlay,
  zot,
  bubble,
  portrait,
  mark,
  look,
  crossing,
  waterTint,
  WATER_FRAMES,
  hires,
});

/** Every sprite the registry can hand out, named — the check.mjs audit walks this. */
export function allSprites() {
  const out = [...allBuildings(), ...allBlocks(), ...allLandmarks(), ...allShops(), ...allRoads(), ...allWalls(), ...allRail(), ...allTerrain(), ...allCitizens()];
  const seen = new Set();
  return out.filter(({ name }) => (seen.has(name) ? false : (seen.add(name), true)));
}

export default art;
