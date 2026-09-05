// Camps occupy saved, real tiles. Choosing a site never consumes simulation RNG.
import { TERRAIN } from './world.js';

export const campAt = (world, tile) => world.campers.find(c => c.kind !== 'scout' && c.tile === tile);

export function campSite(world, id) {
  const n = world.w * world.h, start = ((id * 2654435761) >>> 0) % n;
  const occupied = new Set(world.campers.filter(c => c.kind !== 'scout').map(c => c.tile));
  for (let d = 0; d < n; d++) {
    const i = (start + d) % n;
    if (world.terrain[i] !== TERRAIN.GRASS || world.zone[i] || world.road[i] || world.rail[i] || world.wall[i] || world.civic[i] || world.tier[i] || world.big[i] || world.rubble[i] || world.burning[i] || world.flooded[i] || occupied.has(i)) continue;
    return i;
  }
  return -1;
}

export function addCamp(world, camper) {
  const tile = campSite(world, camper.id);
  if (tile < 0) return false;
  world.campers.push({ ...camper, tile });
  return true;
}

/** Old saves had decorative campers without map coordinates. */
export function locateCamps(world) {
  for (const cp of world.campers) if (cp.kind !== 'scout' && !Number.isInteger(cp.tile)) cp.tile = campSite(world, cp.id);
  world.campers = world.campers.filter(cp => cp.kind === 'scout' || cp.tile >= 0);
}
