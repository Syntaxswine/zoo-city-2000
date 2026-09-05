// index.js — the registry the renderer calls. SPEC §16.
//
//   art.building(zone, tier, variant, side, theme, character)   zone 1|2|3|4 or 'R'|'C'|'I'|'M', tier 1..3; side 2 | 3 → the zone's block (blocks.js), tier ignored;
//                                       variant is the whole tile byte; original families use & 3; the shop kind still uses >> 1
//                                       character = {lit:0..3, majority:species index+1, seed:tile index}; omitted for previews
//                                       theme > 0 with side 3 → that landmark (landmarks.js; ids per js/sim/landmarks.js)
//   art.mansion(variant, character)     the MANSION (estate.js; SPEC §9f): the ultrawealthy's 3×3, lit and marked like every building
//   art.estatePlot(variant)             the estate plot before its mansion: the wall, the gate, the board
//   art.civic(kind, side)               'park' | 'largePark' | 'zoo' | 'fire' | 'police' | 'centre'; side 3 selects campuses; legacy saves supply their existing side
//                                       'library' | 'gallery' (2) and 'university' | 'amphitheater' (3): knowledge and culture (civics-knowledge.js)
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
//   art.citizen(species, facing, frame, age, opts)   opts.look, opts.hat, opts.carry 'sack'
//   art.camera(yaw)                     a security camera, yaw 0 | 1 (which drawn face wears the lens)
//   art.overlay(kind, frame)            'scaffold' | 'fire' 0..1 | 'flood' | 'rubble' | 'camera' 0..1
//                                       | 'tent' | 'hat' | 'meeting' | 'plaza' | 'cursor' | 'ghost'
//                                       | 'sack' 0 open (falling) | 1 tied | 2 tied, wriggling
//   art.zot(kind)                       'noroad' | 'smog' | 'nojob' | 'nodemand'
//   art.waterTint(frame)                key map for the water cycle, frame mod WATER_FRAMES (4)
//   art.hires(sprite)                   the sprite's 2× twin from its recipe (hires.js), or null for a hand-drawn one; the renderer uses it at zoom 2
//   art.bubble(w, h)                    reserved for Part A
//   art.portrait(species, opts)         16×16 face; opts.age/look/expression
//   art.mark(species)                   6×6 stamp for the majority residents/staff
//   art.look(id)                        stable { shade, mark } citizen look
//   art.crossing(roadMask, railMask, busy)  a level crossing: the road's mask, the line's mask (rail.js)
//   allSprites()                        [{ name, sprite }] for the audit
//
// Every sprite is { rows, anchor, w, h, footprint } from defineSprite —
// text, rasterised lazily by whoever owns a canvas.

import { buildingSprite, civicSprite, overlaySprite, allBuildings } from "./buildings.js";
import { allLargeCivics } from "./civics-large.js";
import { allKnowledgeCivics } from "./civics-knowledge.js";
import { allBlocks } from "./blocks.js"; // registers the 2×2 and 3×3 families with buildings.js at load
import { allLandmarks } from "./landmarks.js"; // registers the eleven landmarks (SPEC §3c)
import { allShops } from "./shops.js"; // registers the shop pool (SPEC §12.2d)
import { allEstate, MANSION, ESTATE_PLOT } from "./estate.js"; // the mansion and the estate plot (SPEC §9f)
import { markSprite, characterSprite, MARKS } from "./building-character.js";
import { hires } from "./hires.js";
import { roadSprite, bridgeSprite, allRoads } from "./roads.js";
import { wallSprite, tunnelSprite, allWalls } from "./walls.js";
import { railSprite, railBridgeSprite, stationSprite, crossingSprite, allRail } from "./rail.js";
import { GRASS, CHALK, RUBBLE, WATER_TILE, KERB, TREES, TREE_LIST, ZOTS, PLAZA, CURSOR, GHOST, waterTint, WATER_FRAMES, allTerrain } from "./terrain.js";
import { citizenSprite, portraitSprite, TENT, HAT, MEETING, SACKS, allCitizens } from "./citizens.js";
import { bubbleSprite, BUBBLE_SAMPLES } from "./bubbles.js";

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

/** A security camera, by yaw: which of the two drawn faces wears the lens (SPEC §9d). */
export function cameraSprite(yaw = 0) {
  return overlaySprite("camera", ((yaw % 2) + 2) % 2);
}

export function zot(kind) {
  const s = ZOTS[kind];
  if (!s) throw new Error(`art.zot: unknown kind '${kind}'`);
  return s;
}

function notBuilt(name) {
  throw new Error(`art.${name}: not built`);
}

/** The mansion (SPEC §9f): the ultrawealthy's 3×3 R family, with the same lights and species mark as every building. */
export function mansion(variant = 0, character = null) {
  const base = MANSION[variant & 1];
  return character ? characterSprite(base, character) : base;
}

/** The estate plot before its mansion: the wall, the gate and the board on a bare lawn. */
export function estatePlot(variant = 0) {
  return ESTATE_PLOT[variant & 1];
}

export const bubble = bubbleSprite;
export const portrait = portraitSprite;
export const mark = markSprite;
export function look(id) {
  if (!Number.isFinite(id)) throw new Error("art.look: id must be a finite number");
  let h = Math.imul(id | 0, 0x9e3779b1) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  h ^= h >>> 16;
  return Object.freeze({ shade: h & 1, mark: (h >>> 1) & 1 });
}

export const art = Object.freeze({
  building: buildingSprite,
  mansion,
  estatePlot,
  civic: civicSprite,
  road: roadSprite,
  bridge: bridgeSprite,
  wall: wallSprite,
  tunnel: tunnelSprite,
  rail: railSprite,
  railBridge: railBridgeSprite,
  station: stationSprite,
  camera: cameraSprite,
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
  crossing: crossingSprite,
  waterTint,
  WATER_FRAMES,
  hires,
});

/** Every sprite the registry can hand out, named — the check.mjs audit walks this. */
export function allSprites() {
  const out = [...Object.values(MARKS).map(sprite => ({ name: sprite.name, sprite })), ...allBuildings(), ...allLargeCivics(), ...allKnowledgeCivics(), ...allBlocks(), ...allLandmarks(), ...allEstate(), ...allShops(), ...allRoads(), ...allWalls(), ...allRail(), ...allTerrain(), ...allCitizens(), ...BUBBLE_SAMPLES.map((sprite) => ({ name: sprite.name, sprite }))];
  const seen = new Set();
  return out.filter(({ name }) => (seen.has(name) ? false : (seen.add(name), true)));
}

export default art;
