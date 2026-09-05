// fields.js — roadDist, pollution, land value, traffic. SPEC §6. Pure.
//
// All of these are DERIVED: rebuilt every tick (roadDist only when roads
// changed) and never saved. Everything is O(tiles) (pollution is O(sources ×
// radius²)); 4,096 tiles is microseconds.

import { KNOBS } from "./rules.js";
import { TERRAIN, ROAD, ZONE, CIVIC, idx, inBounds, N4, isStation, isCivicEmployer, isKnowledgeCivic, isCultureCivic, absent, occAt, anchorOf, footprintOf, siteTiles, civicAnchorOf, civicTiles } from "./world.js";
import { SPECIES_BY_ID, DIET_OF, admits } from "./species.js";
import { forEachWithin, forEachWithinAll, floodBudget, computeOcclusion, isBarrier, crossable } from "./reach.js";

const NO_ROAD = 255;

/** Multi-source BFS from every road tile, through any tile, capped at 4. */
export function computeRoadDist(world) {
  const { w, h, road, roadDist } = world;
  const n = w * h;
  roadDist.fill(NO_ROAD);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;
  for (let i = 0; i < n; i++) {
    if (road[i] !== ROAD.NONE) {
      roadDist[i] = 0;
      queue[tail++] = i;
    }
  }
  while (head < tail) {
    const i = queue[head++];
    const d = roadDist[i];
    if (d >= KNOBS.ROAD_REACH + 1) continue;
    const tx = i % w;
    const ty = (i / w) | 0;
    for (const [dx, dy] of N4) {
      const nx = tx + dx;
      const ny = ty + dy;
      if (!inBounds(world, nx, ny)) continue;
      const j = ny * w + nx;
      if (roadDist[j] !== NO_ROAD || isBarrier(world, j)) continue; // reach stops at a bare wall (a tunnel is a road)
      if (!crossable(world, i, j)) continue; // ...and a tunnel is a road ALONG ITS OWN AXIS (SPEC 6b)
      roadDist[j] = d + 1;
      queue[tail++] = j;
    }
  }
  // Cap: anything unreached or beyond reach+1 reads as 4 ("no road").
  for (let i = 0; i < n; i++) if (roadDist[i] === NO_ROAD || roadDist[i] > KNOBS.ROAD_REACH) roadDist[i] = KNOBS.ROAD_REACH + 1;
  world.roadsDirty = false;
}

/**
 * The road distance of the SITE at i: the NEAREST of its footprint's tiles
 * (world.js siteTiles - a block's tiles, a zoo's four, or the tile itself).
 * A 6x6 estate ringed by road has an interior tile at 3 and a corner at 0;
 * the one building standing across them is at 0.
 */
export function siteRoadDist(world, i, seen = null) {
  // A PLATFORM is asked the WALKING question, not the distance one, because
  // its forecourt is the thing a citizen actually crosses (SPEC 6c, and
  // `passable` above). ONE branch, here: `served`, `doorsOf`, the card and
  // the overlay all read their answer through this, so the field, the doors
  // the card lists and the edges the commute graph carries cannot disagree
  // about whether a station across a river is a station.
  //
  // `seen` is used only by that branch - it is the one that searches. A lot's
  // answer is a table lookup and needs no buffer, so a caller that does not
  // know what it is pointing at (the access overlay, per visible tile) may
  // hand one over regardless.
  if (world.rail[i] === 2) return doorSearch(world, i, seen || doorScratch(world), { passable }).d;
  let d = KNOBS.ROAD_REACH + 1;
  for (const j of siteTiles(world, i)) if (world.roadDist[j] < d) d = world.roadDist[j];
  return d;
}

/** The search options for the thing at i - the one place that knows a platform is asked differently. */
const accessOpts = (world, i) => (world.rail[i] === 2 ? { passable } : {});

/**
 * WALKABLE ground, for the one place the gap between a site and its road is
 * actually CROSSED ON FOOT: a station's forecourt (computeStationDoors). A
 * lot's reach is a distance - nobody walks it, the animal appears at the
 * door - so a river or a neighbour's house between a lot and its road is no
 * obstacle to it, and never was. A platform is different: the stored path
 * carries every tile of its forecourt and a walker draws them, so a
 * forecourt through a house or across water is a rabbit walking through a
 * wall. Not passable: water, a bare wall (isBarrier), a building standing
 * on a lot, and a civic building - a park is a place to walk, a police
 * station is a wall.
 */
export function passable(world, j) {
  if (isBarrier(world, j)) return false;                                            // a bare wall (a tunnel carries a way, so it is not one)
  if (world.terrain[j] === TERRAIN.WATER && world.road[j] === ROAD.NONE) return false; // open water; a bridge is a road, and roads are doors
  if (world.tier[j] > 0) return false;                                              // a building stands here, burning or not
  const c = world.civic[j];
  if (c && c !== CIVIC.PARK) return false;                                          // a zoo, a station house, the centre - buildings all
  return true;
}
// RULINGS, so they are decisions and not omissions. RUBBLE is walkable: a
// razed lot is tier 0 (events.toRubble lowers every storey before setting it),
// so the tier test above covers a standing building and nothing else, and no
// separate rubble clause is needed - one that looked necessary was dead.
// TREES are walkable; an animal goes through a wood. FLOODING is not
// consulted: a flood is weather, the ground is still ground, and roads carry
// traffic straight through one - a forecourt that closed and re-opened with
// the water would take a station's riders away and give them back for a
// season, which is a bigger claim than this part is making. PLAIN TRACK is
// walkable: a citizen steps over a rail line the way it steps over a level
// crossing, which the card has always described as a thing animals walk
// across, and a forecourt that ran a tile along the track was the behaviour
// before anyone wrote this rule down.
//
// The bridge clause is the one that looks dead and is not: `doorSearch`
// answers a road before it asks this question, so nothing in the door search
// ever hands `passable` a bridge - but `passable` is exported and read as
// "ground a citizen may stand on", and a predicate that called a bridge water
// would be wrong the first time anything else asked it. It is a ruling in the
// table below for that reason, not an unreachable branch.

/**
 * ACCESS, the one standard (SPEC 6c). The owner: "as long as a tile is
 * within 1-3 tiles of the road it has road access", and "i want that rule
 * standardized, including rail and warehouses, and zoos". So every rule in
 * the game that asks "is there a road?" asks this one function, and asks it
 * of the WHOLE footprint: a lot, a 2x2 or 3x3 block, a zoo, a station, a
 * hall. There is no second test of a road's nearness anywhere in js/sim -
 * Part M' greps for one.
 */
/**
 * Does anything on this tile ASK the access question? A lot does (it will not
 * grow), a zoo does (no keepers, no halo, no cap), a station does (nobody can
 * board), the civic employers do (no staff, no cover). A PARK does not - SPEC
 * 6c says a park is a place, not a service, and the owner never listed it -
 * and neither does open ground. Both the access overlay and the hover card
 * read this, so "no road here" is only ever SAID where it is a refusal.
 */
export function asksAccess(world, i) {
  if (world.zone[i] !== ZONE.NONE) return true;
  if (world.rail[i] === 2) return true;
  const a = civicAnchorOf(world, i);
  const c = world.civic[a];
  return isCivicEmployer(c);
}

/**
 * IS THERE A ROAD? The one predicate (SPEC 6c). `seen` is the caller-owned
 * scratch every reader here takes: `lotScore` reaches this from the score
 * overlay, and 14 forbids the draw layer a buffer on the world.
 */
export function touchesRoad(world, tiles) {
  if (world.wallsDirty) computeOcclusion(world);
  if (world.roadsDirty) computeRoadDist(world);
  return tiles.some(i => world.roadDist[i] === 1);
}

export const served = (world, i, seen = null) => siteRoadDist(world, i, seen) <= KNOBS.ROAD_REACH;

/**
 * Traffic: the number of commuter paths through each tile they WALK - roads,
 * and since Part R the forecourt tiles between a platform and its door, which
 * are walked and drawn like any other step. A ride makes none (SPEC 7.9).
 * Readout only, and `census.maxTraffic` reads it.
 */
export function computeTraffic(world) {
  world.traffic.fill(0);
  for (const c of world.citizens) {
    if (!c.path) continue;
    for (let k = 0; k < c.path.length; k++) { if (c.path[k] & RIDE) continue; world.traffic[c.path[k] & TILE]++; } // a ride makes no road traffic (SPEC §7.9)
  }
}

/**
 * Pollution: every source spreads linearly over its radius (SC4's rule —
 * full strength on the source, 0 one tile past the radius), sinks the same
 * way with a negative sign, additive, capped 0..100. A single works at 70
 * gives 52 next door, 35 two tiles out, 17 three out; a block interior
 * saturates. No wind (stated in the Rules tab).
 */
function spread(world, e, i, amount, radius) {
  if (radius <= 0) { e[i] += amount; return; }
  // reach.js (SPEC §6b): the Chebyshev square where the city has no walls,
  // the flood round them where it does — the same numbers wherever no wall intervenes.
  forEachWithin(world, i, radius, (j, d) => { e[j] += amount * (1 - d / (radius + 1)); });
}

export function computePollution(world) {
  const { w, h } = world;
  const n = w * h;
  const e = world._emit || (world._emit = new Float32Array(n));
  e.fill(0);
  const scrub = world.events.scrubbers ? 0.7 : 1;
  const smog = world.events.active.find((x) => x.id === "smogBank") ? 25 : 0;
  // Mess: pigs and skunks at home dirty their lot (the owner's rule — pigs
  // are messy, raccoons follow the mess; the skunk stinks).
  const mess = world._mess || (world._mess = new Float32Array(n));
  mess.fill(0);
  for (const c of world.citizens) {
    if (c.dead || c.home < 0) continue;
    const m = KNOBS.MESS[c.species];
    if (m) mess[c.home] += m;
  }
  for (let i = 0; i < n; i++) {
    const tx = i % w;
    const ty = (i / w) | 0;
    const t = world.tier[i];
    if (mess[i]) spread(world, e, i, mess[i], KNOBS.MESS_RADIUS);
    if (world.zone[i] === ZONE.I && t > 0) spread(world, e, i, KNOBS.EMIT_I[t] * scrub, KNOBS.EMIT_I_RADIUS[t]);
    else if (world.zone[i] === ZONE.C && KNOBS.EMIT_C[t] > 0) spread(world, e, i, KNOBS.EMIT_C[t], KNOBS.EMIT_C_RADIUS[t]);
    if (world.road[i] !== ROAD.NONE) spread(world, e, i, KNOBS.EMIT_ROAD + Math.min(KNOBS.EMIT_TRAFFIC_MAX, world.traffic[i] / KNOBS.EMIT_TRAFFIC_DIV), KNOBS.EMIT_ROAD_RADIUS);
    if (world.terrain[i] === TERRAIN.TREE) e[i] += KNOBS.EMIT_TREE;
    if (world.rail[i]) spread(world, e, i, KNOBS.EMIT_RAIL, 1); // a train line, flat, no traffic term
    if (world.burning[i]) spread(world, e, i, KNOBS.EMIT_FIRE, KNOBS.EMIT_FIRE_RADIUS);
    if (world.civic[i] === CIVIC.PARK) spread(world, e, i, KNOBS.EMIT_PARK, KNOBS.EMIT_PARK_RADIUS);
  }
  for (let i = 0; i < n; i++) {
    world.pol[i] = Math.max(0, Math.min(100, Math.round(e[i] + smog)));
  }
}

/**
 * Dread: what a meat hall does to the street. The same linear spread as
 * pollution, its own field (pollution pulls raccoons and pigs and refuses R
 * growth — the owner's rule is herbivore-specific): LV reads it for everyone,
 * herbivores read it in mood and home choice, carnivores do not mind.
 * DERIVED — rebuilt every tick, never saved.
 */
export function computeDread(world) {
  const { w, h } = world;
  const n = w * h;
  const e = world._dreadEmit || (world._dreadEmit = new Float32Array(n));
  e.fill(0);
  for (let i = 0; i < n; i++) {
    const t = world.tier[i];
    if (world.zone[i] === ZONE.M && t > 0) {
      const hall = anchorOf(world, i);
      let stock = 0;
      for (const j of footprintOf(world, hall)) stock += world.meat[j] || 0;
      const scale = 0.5 + 0.5 * Math.min(1, stock / 8);
      spread(world, e, i, KNOBS.DREAD[t] * scale, KNOBS.DREAD_RADIUS[t]);
    }
  }
  for (let i = 0; i < n; i++) world.dread[i] = Math.max(0, Math.min(100, Math.round(e[i])));
}

/** Centroid of built lots (tier > 0); falls back to zoned lots, then the start tile. */
export function computeCentroid(world) {
  const { w, h } = world;
  const n = w * h;
  let sx = 0;
  let sy = 0;
  let cnt = 0;
  for (let i = 0; i < n; i++) {
    if (world.tier[i] > 0) {
      sx += i % w;
      sy += (i / w) | 0;
      cnt++;
    }
  }
  if (cnt === 0) {
    for (let i = 0; i < n; i++) {
      if (world.zone[i] !== ZONE.NONE) {
        sx += i % w;
        sy += (i / w) | 0;
        cnt++;
      }
    }
  }
  if (cnt === 0) return { cx: world.start.tx, cy: world.start.ty };
  return { cx: sx / cnt, cy: sy / cnt };
}

/** Land value 0..100 per tile. */
export function computeLandValue(world) {
  const { w, h } = world;
  const n = w * h;
  const { cx, cy } = computeCentroid(world);
  world.centroid = { cx, cy };
  // Park / zoo proximity masks.
  const nearPark = world._nearPark || (world._nearPark = new Uint8Array(n));
  const nearZoo = world._nearZoo || (world._nearZoo = new Uint8Array(n));
  const nearVan = world._nearVan || (world._nearVan = new Uint8Array(n));
  nearPark.fill(0);
  nearZoo.fill(0);
  nearVan.fill(0);
  for (let i = 0; i < n; i++) {
    const c = world.civic[i];
    if (c !== CIVIC.PARK && c !== CIVIC.LARGE_PARK && c !== CIVIC.CENTRE) continue;
    // Parks keep their amenities without roads; a centre's van needs access.
    if (c === CIVIC.CENTRE && !served(world, i)) continue;
    const r = c === CIVIC.PARK ? KNOBS.LV_PARK_RADIUS : c === CIVIC.LARGE_PARK ? KNOBS.LV_LARGE_PARK_RADIUS : KNOBS.LV_VAN_RADIUS;
    const mask = c === CIVIC.PARK ? nearPark : c === CIVIC.LARGE_PARK ? nearZoo : nearVan;
    // From EVERY tile of the campus (reach.forEachWithinAll), round a wall, not through it. A 1×1 park is the plain flood.
    forEachWithinAll(world, civicTiles(world, i), r, (j) => { mask[j] = 1; });
  }
  const cent = world.events.centenaries; // [{tile, radius, bonus}]
  const plaque = world._plaque || (world._plaque = new Float32Array(n));
  plaque.fill(0);
  for (const c of cent) forEachWithin(world, c.tile, c.radius, (j) => { plaque[j] += c.bonus; });
  for (let i = 0; i < n; i++) {
    const tx = i % w;
    const ty = (i / w) | 0;
    const dC = Math.max(Math.abs(tx - cx), Math.abs(ty - cy));
    let nature = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = tx + dx;
        const yy = ty + dy;
        if (!inBounds(world, xx, yy)) continue;
        const t = world.terrain[yy * w + xx];
        if (t === TERRAIN.WATER || t === TERRAIN.TREE) nature++;
      }
    }
    let v = KNOBS.LV_BASE + KNOBS.LV_CENTRE * Math.max(0, 1 - dC / KNOBS.LV_CENTRE_RADIUS) + KNOBS.LV_NATURE * nature;
    if (nearPark[i]) v += KNOBS.LV_PARK;
    if (nearZoo[i]) v += KNOBS.LV_LARGE_PARK;
    v += KNOBS.LV_CULTURE[world.culture[i]]; // culture (SPEC §9e): the owner's "property desirability" — +4 under a Gallery, +8 under an Amphitheater
    v -= KNOBS.LV_POL * world.pol[i];
    v -= KNOBS.LV_DREAD * world.dread[i]; // a meat hall: twice a works' shadow
    if (nearVan[i]) v -= KNOBS.LV_VAN; // the pacification centre's van
    v += plaque[i];
    world.lv[i] = Math.max(0, Math.min(100, Math.round(v)));
  }
}

/**
 * KNOWLEDGE AND CULTURE (SPEC §9e; docs/PROPOSAL-KNOWLEDGE-CULTURE-2026-09-05.md,
 * its review, and the owner's ruling of 2026-09-05). Two derived per-tile
 * fields, rebuilt every tick and at any op that moves them, never saved:
 * world.knowledge 0 / 1 (a Library) / 2 (a University), world.culture 0 / 1
 * (a Gallery) / 2 (an Amphitheater) — the STRONGEST source reaching the tile,
 * never a sum (two Libraries are still 50 knowledge; a Gallery under an
 * Amphitheater is still +8). The knobs turn the class into a number:
 * KNOWLEDGE[k], CULTURE_MOOD[k], LV_CULTURE[k].
 *
 * A building OPERATES while it is served (a road within ROAD_REACH of its
 * footprint — the one predicate) and no tile of it is flooded or alight;
 * otherwise it is billed and does nothing, and the Census says so. The small
 * ones reach KNOW_RADIUS from every footprint tile (forEachWithinAll). The
 * campuses take a BUDGET of the map's tiles, nearest first through the walls,
 * ties by tile index (floodBudget): the owner ruled half the map for a
 * University and an eighth for an Amphitheater, and ruled it as AREA — "do not
 * halve a linear dimension". Water and open ground count; walls are never
 * entered and never counted; a sealed quarter leaves the budget short.
 */
export function computeKnowledgeCulture(world) {
  const { w, h } = world;
  const n = w * h;
  world.knowledge.fill(0);
  world.culture.fill(0);
  for (let i = 0; i < n; i++) {
    const c = world.civic[i];
    const knowledge = isKnowledgeCivic(c);
    if (!knowledge && !isCultureCivic(c)) continue; // anchors only: a campus's other tiles are CIVIC.PART
    if (!served(world, i)) continue;
    const tiles = civicTiles(world, i);
    if (tiles.some((j) => world.flooded[j] || world.burning[j])) continue;
    const field = knowledge ? world.knowledge : world.culture;
    const cls = c === CIVIC.LIBRARY || c === CIVIC.GALLERY ? 1 : 2;
    const paint = (j) => { if (field[j] < cls) field[j] = cls; };
    if (cls === 1) forEachWithinAll(world, tiles, KNOBS.KNOW_RADIUS, paint);
    else floodBudget(world, tiles, Math.ceil(n * (c === CIVIC.UNIVERSITY ? KNOBS.KNOW_UNI_SHARE : KNOBS.CULT_AMPH_SHARE)), paint);
  }
}

/**
 * What ONE knowledge or culture building reaches, for its Inspect card: its
 * kind, side, budget (a tile count for a campus, a radius for the small ones),
 * how many tiles its own flood covers on this map right now, and whether it
 * operates — the same floods computeKnowledgeCulture runs, so the card and the
 * field cannot disagree. `why` names the reason a silent building is silent.
 */
export function campusReach(world, anchor) {
  const c = world.civic[anchor];
  const knowledge = isKnowledgeCivic(c);
  if (!knowledge && !isCultureCivic(c)) return null;
  const tiles = civicTiles(world, anchor);
  const small = c === CIVIC.LIBRARY || c === CIVIC.GALLERY;
  const budget = small ? null : campusBudget(world, c);
  let covered = 0;
  const one = () => { covered++; };
  if (small) forEachWithinAll(world, tiles, KNOBS.KNOW_RADIUS, one);
  else floodBudget(world, tiles, budget, one);
  const flooded = tiles.some((j) => world.flooded[j] || world.burning[j]);
  const isServed = served(world, anchor);
  return {
    kind: knowledge ? "knowledge" : "culture", side: tiles.length === 9 ? 3 : 2, cls: small ? 1 : 2,
    budget, radius: small ? KNOBS.KNOW_RADIUS : null, covered, operating: isServed && !flooded,
    why: !isServed ? "no road within 3 of the building — upkeep is due, nothing is served" : flooded ? "flooded — the service is suspended until the water goes" : null,
  };
}

/** The tile budget a campus kind takes on THIS map, for the card and the Rules tab — the same arithmetic computeKnowledgeCulture uses. */
export function campusBudget(world, c) {
  return c === CIVIC.UNIVERSITY ? Math.ceil(world.w * world.h * KNOBS.KNOW_UNI_SHARE) : c === CIVIC.AMPHITHEATER ? Math.ceil(world.w * world.h * KNOBS.CULT_AMPH_SHARE) : 0;
}

/** Fire and police coverage from stations that have road access. */
export function computeCoverage(world) {
  const { w, h } = world;
  const n = w * h;
  world.fireCov.fill(0);
  world.policeCov.fill(0);
  for (let i = 0; i < n; i++) {
    const c = world.civic[i];
    if (!isStation(c) || !served(world, i)) continue;
    const R = c === CIVIC.FIRE ? KNOBS.FIRE_RADIUS : KNOBS.POLICE_RADIUS;
    // Seeded from the WHOLE campus, so a 3×3 station covers (3 + 2R)² tiles centred on itself. Until session 17 this
    // flooded from the anchor alone and a station covered six tiles to its north-west and four to its south-east
    // (tools/haloprobe.mjs). A legacy 1×1 station is the same single-tile flood it always was.
    forEachWithinAll(world, civicTiles(world, i), R, (j, d) => { // a patrol goes round a wall and through a tunnel
      if (c === CIVIC.FIRE) world.fireCov[j] = 1;
      else {
        const eff = d <= KNOBS.POLICE_NEAR ? KNOBS.POLICE_EFFECT : KNOBS.POLICE_EFFECT / 2;
        if (eff > world.policeCov[j]) world.policeCov[j] = eff;
      }
    });
  }
}

/** Every lot with a building on it: not rubble, not alight. */
/**
 * THE CAMERA NETWORK's cover (SPEC §9d; docs/PROPOSAL-CAMERAS.md §4b). Derived,
 * rebuilt every tick, never saved.
 *
 * A camera watches the STREET, not a circle. From the tile it stands on it
 * walks CONNECTED ROAD TILES up to CAM_REACH steps, and paints every tile
 * within ROAD_REACH of each road tile it reaches — the frontages that street
 * serves. Full CAM_EFFECT within CAM_NEAR road-steps, half beyond; the maximum
 * where two cameras overlap, exactly as computeCoverage does.
 *
 * THE PAINT RADIUS IS ROAD_REACH AND THAT IS NOT A TASTE CALL. A crime scene
 * is NEVER a road tile: burglaryTick builds its candidates from tier > 0 and a
 * road tile has tier 0, and a killing's scene is the victim's home. A camera
 * that marked only its own road tile would read zero at every scene and the
 * whole clearance lever would be a dead knob. Measured over seeds 7/3/5:
 * 0 of 254 scenes on a road; radius 1 reaches 46.7% of them, 2 reaches 86.7%,
 * ROAD_REACH 3 reaches all of them. It is also the game's own definition of
 * "served by this road", so the camera sees the lots the street serves.
 *
 * A TUNNEL STOPS THE WALK. A road under a wall is a tunnel, and a camera
 * cannot see through one — so a wall across a street breaks the sight-line
 * for nothing, which is the one piece of counterplay the network has.
 */
export function computeCamCover(world) {
  const { w, h } = world;
  const n = w * h;
  world.camCov.fill(0);
  let cams = 0;
  for (let i = 0; i < n; i++) if (world.cam[i]) cams++;
  if (!cams) return;
  // The visited set is scratch that OUTLIVES the call, so it is stamped with a
  // generation and never with anything that can repeat. Stamping it with the
  // source tile looked right and was wrong in a way nothing here would notice:
  // the first walk marked its neighbours with `src`, and every later call for
  // the same camera found them already marked and refused to expand, so the
  // field was correct once and then a single tile's halo for ever after
  // (measured 91 tiles, then 49, then 49). One generation PER CAMERA, not per
  // call — two cameras sharing a set would under-paint the second one, whose
  // near tiles can be the first one's far tiles. reach.js does the same.
  const seen = world._camSeen || (world._camSeen = new Int32Array(n));
  const queue = world._camQueue || (world._camQueue = new Int32Array(n));
  const dist = world._camDist || (world._camDist = new Uint8Array(n));
  for (let src = 0; src < n; src++) {
    if (!world.cam[src] || world.road[src] !== ROAD.ROAD || world.wall[src] || world.rail[src]) continue;
    const gen = ++world._camGen;
    let head = 0;
    let tail = 0;
    seen[src] = gen;
    dist[src] = 0;
    queue[tail++] = src;
    while (head < tail) {
      const cur = queue[head++];
      const d = dist[cur];
      const eff = d <= KNOBS.CAM_NEAR ? KNOBS.CAM_EFFECT : KNOBS.CAM_EFFECT / 2;
      forEachWithin(world, cur, KNOBS.ROAD_REACH, (j) => { if (eff > world.camCov[j]) world.camCov[j] = eff; });
      if (d >= KNOBS.CAM_REACH) continue;
      const cx = cur % w;
      const cy = (cur / w) | 0;
      for (const [dx, dy] of N4) {
        const xx = cx + dx;
        const yy = cy + dy;
        if (!inBounds(world, xx, yy)) continue;
        const j = yy * w + xx;
        if (seen[j] === gen || world.road[j] === ROAD.NONE || world.wall[j]) continue; // a tunnel is not a sight-line
        seen[j] = gen;
        dist[j] = d + 1;
        queue[tail++] = j;
      }
    }
  }
}

export function builtLots(world) {
  const out = [];
  for (let i = 0; i < world.w * world.h; i++) if (world.tier[i] > 0 && !world.rubble[i] && !world.burning[i]) out.push(i);
  return out;
}

/**
 * The town's exposure to fire: every built lot's origin weight, 1 off a beat
 * and FIRE_START_COVERED on one. `total` picks the lot a fire starts on and
 * `share` (total / lots) scales how often a fire is rolled at all — the SAME
 * number answering both, so no station can move a fire without also making it
 * rarer. `share` is 1 in a town with no cover and FIRE_START_COVERED in one
 * covered end to end: unlikely, never impossible. It lives here, beside the
 * computeCoverage that makes world.fireCov, so the census can read it without
 * importing events.js (which imports the census back).
 */
export function fireExposure(world) {
  const lots = builtLots(world);
  let total = 0;
  for (const l of lots) total += world.fireCov[l] ? KNOBS.FIRE_START_COVERED : 1;
  return { lots, total, share: lots.length ? total / lots.length : 0 };
}

/**
 * Crime, the Micropolis line at 0..100: base − land value + density +
 * unemployment − police. Unemployment is counted here (not read from a
 * stale census) so a loaded city and the straight run agree.
 */
export function computeCrime(world) {
  const { w, h } = world;
  const n = w * h;
  let W = 0;
  let U = 0;
  // Unemployment, global (the Micropolis line) and LOCAL — "no jobs means
  // hungry wolves" (the owner): every unemployed adult in the 3×3 adds to the
  // tile, a carnivore double. Counted here from live state, never from the
  // previous census (the save/load hash law).
  const unempAt = world._unempAt || (world._unempAt = new Float32Array(n));
  unempAt.fill(0);
  for (const c of world.citizens) {
    if (c.dead) continue;
    const y = Math.floor((world.tick - c.born) / 12);
    if (y < KNOBS.ADULT_AGE || y >= SPECIES_BY_ID[c.species].retire || c.onLeave || absent(world, c)) continue;
    W++;
    if (c.job < 0) {
      U++;
      if (c.home >= 0) unempAt[c.home] += DIET_OF[c.species] === "carn" ? KNOBS.CRIME_UNEMP_HUNTER : 1;
    }
  }
  const unemp = W ? U / W : 0;
  world._crimeW = W;
  world._crimeU = U;
  // A meat hall is part of crime: its own hill, halved under licence; and
  // every open file (an incident's memory) stains its street.
  const near = world._cnear || (world._cnear = new Float32Array(n));
  near.fill(0);
  const mult = world.events.licence ? KNOBS.LICENCE_CRIME_MULT : 1;
  for (let i = 0; i < n; i++) {
    const t = world.tier[i];
    if (world.zone[i] === ZONE.M && t > 0) spread(world, near, i, KNOBS.CRIME_M[t] * mult, KNOBS.CRIME_M_RADIUS[t]);
  }
  // The files' stain is capped at FILE_CRIME_MAX — a street where three things
  // happened is a bad street, not three bad streets. Uncapped it stacked, and
  // because burglaryTick draws its rate from the COUNT of hot lots, the stain
  // of past crime manufactured the conditions for the next one: a burst of
  // burglaries painted more lots hot, which raised the rate, which opened more
  // files. Measured before the cap (serviceprobe, 4 seeds × 40y): 116 files
  // with one police station against 35 with four and 10 with twelve.
  const stain = world._cstain || (world._cstain = new Float32Array(n));
  stain.fill(0);
  for (const f of world.events.files) {
    if (f.until <= world.tick) continue;
    forEachWithin(world, f.tile, f.radius, (j) => { stain[j] += f.crime; });
  }
  for (let i = 0; i < n; i++) if (stain[i]) near[i] += Math.min(KNOBS.FILE_CRIME_MAX, stain[i]);
  for (let i = 0; i < n; i++) {
    const tx = i % w;
    const ty = (i / w) | 0;
    let dens = 0;
    let jobless = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = tx + dx;
      const yy = ty + dy;
      if (inBounds(world, xx, yy)) { dens += occAt(world, yy * w + xx); jobless += unempAt[yy * w + xx]; } // a block's people are spread over its footprint, not piled on its anchor
    }
    if (!dens && world.zone[i] === ZONE.NONE && !near[i]) { world.crime[i] = 0; continue; }
    const v = KNOBS.CRIME_BASE - KNOBS.CRIME_LV * world.lv[i] + KNOBS.CRIME_DENSITY * dens + KNOBS.CRIME_UNEMP_LOCAL * jobless + KNOBS.CRIME_UNEMP * unemp + near[i] - world.policeCov[i];
    world.crime[i] = Math.max(0, Math.min(100, Math.round(v)));
  }
  // High crime destroys land value (SC2000 manual; Micropolis −20 above 190).
  for (let i = 0; i < n; i++) if (world.crime[i] > KNOBS.CRIME_HIGH) world.lv[i] = Math.max(0, world.lv[i] - KNOBS.CRIME_LV_PENALTY);
}

/** Everything derived from tiles + citizens, in order. */
export function computeFields(world) {
  if (world.wallsDirty) computeOcclusion(world);
  if (world.roadsDirty) computeRoadDist(world);
  computeStationDoors(world);
  computeCoverage(world);
  computeCamCover(world);
  computeKnowledgeCulture(world); // before land value, which reads culture
  computeTraffic(world);
  computePollution(world);
  computeDread(world);
  computeLandValue(world);
  computeCrime(world);
}

/** Recount occupants and staff from the citizen list (derived, never saved). */
export function recountRosters(world) {
  world.occupants.fill(0);
  world.staff.fill(0);
  world.carnAt.fill(0);
  for (const c of world.citizens) {
    if (c.home >= 0) { world.occupants[c.home]++; if (DIET_OF[c.species] === "carn") world.carnAt[c.home]++; }
    if (c.job >= 0) world.staff[c.job]++;
  }
}

/** BFS over road tiles from `from` (a road tile) to `to` (a road tile); returns a Uint16Array path (inclusive) or null if longer than max. */
export function roadPath(world, from, to, max = KNOBS.COMMUTE_MAX) {
  if (from === to) return new Uint16Array([from]);
  const { w, h, road } = world;
  const n = w * h;
  const prev = world._prev || (world._prev = new Int32Array(n));
  const dist = world._dist || (world._dist = new Int16Array(n));
  dist.fill(-1);
  const queue = world._queue || (world._queue = new Int32Array(n));
  let head = 0;
  let tail = 0;
  dist[from] = 0;
  prev[from] = -1;
  queue[tail++] = from;
  while (head < tail) {
    const i = queue[head++];
    const d = dist[i];
    if (d >= max) continue;
    const tx = i % w;
    const ty = (i / w) | 0;
    for (const [dx, dy] of N4) {
      const nx = tx + dx;
      const ny = ty + dy;
      if (!inBounds(world, nx, ny)) continue;
      const j = ny * w + nx;
      if (road[j] === ROAD.NONE || dist[j] !== -1) continue;
      dist[j] = d + 1;
      prev[j] = i;
      if (j === to) {
        const path = new Uint16Array(d + 2);
        let k = j;
        for (let s = d + 1; s >= 0; s--) {
          path[s] = k;
          k = prev[k];
        }
        return path;
      }
      queue[tail++] = j;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Doors: ALL SIDES ARE ACCESS POINTS (SPEC 6c)
// ---------------------------------------------------------------------------

const DOOR_N4 = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W
const notBarrier = (world, j) => !isBarrier(world, j); // the default question: only a bare wall stops reach

/**
 * The door search: a multi-source BFS OUT of the whole site (world.js
 * siteTiles), through any tile a bare wall does not block, stopping at the
 * first depth that reaches road. Returns `{ d, doors }` - the site's road
 * distance and EVERY road tile at it, ascending, because the owner's other
 * way of putting the rule is "all sides have access points". `d` is
 * `reach + 1` and `doors` is empty when nothing is in range.
 *
 * `seen` is a caller-owned Uint8Array(w*h): fields.js hands it the world's
 * scratch, the walker layer hands it its own (SPEC 14's boundary law says
 * that layer may not write the world, not even a buffer). `opts.reach`
 * widens the search - the hover card asks past ROAD_REACH to say how far the
 * nearest road actually is. `opts.prev` is an Int32Array the search fills
 * with each tile's parent, so a caller can walk a door back to the site (the
 * station approach below).
 */
export function doorSearch(world, i, seen, { reach = KNOBS.ROAD_REACH, prev = null, passable: pass = null } = {}) {
  const { w } = world;
  const open = pass || notBarrier;
  seen.fill(0);
  if (prev) prev.fill(-1);
  const doors = [];
  let frontier = [];
  for (const j of siteTiles(world, i)) {
    if (seen[j]) continue;
    seen[j] = 1;
    if (world.road[j] !== ROAD.NONE) doors.push(j); // the site stands on a road
    // A site tile sealed inside a bare wall is a way out of nothing. Without
    // this the search STARTS inside the barrier and walks out, while
    // computeRoadDist never gets in - and the two would report different
    // numbers for the same tile.
    if (isBarrier(world, j)) continue;
    frontier.push(j);
  }
  // ONE SORT, ONE EXIT. There were two sorts, and the d = 0 one could not be
  // made to matter: `siteTiles` happens to come back in raster order today, so
  // a site standing on several roads already listed them ascending, and
  // deleting that line left the whole suite green. It is not dead - it is the
  // guarantee that "ascending" does not quietly depend on the order world.js
  // walks a footprint - so the search has one way out instead, where the live
  // case (a forecourt entered from EAST and WEST, discovered east-then-west)
  // holds it up. `d` is 0 when the site stands on a road, the depth the
  // frontier broke at, or `reach + 1` when the loop ran out - which is exactly
  // the "no road in range" answer, with `doors` empty. (No closure per call:
  // this search runs once per visible platform tile per frame.)
  let d = 0;
  if (!doors.length) for (d = 1; d <= reach; d++) {
    const next = [];
    for (const cur of frontier) {
      const tx = cur % w;
      const ty = (cur / w) | 0;
      for (const [dx, dy] of DOOR_N4) {
        const nx = tx + dx;
        const ny = ty + dy;
        if (!inBounds(world, nx, ny)) continue;
        const j = ny * w + nx;
        if (seen[j]) continue;
        // CROSSABLE FIRST, and only THEN seen. Marking a tile visited on the
        // ATTEMPT burns it: a tunnel first touched ACROSS its axis could never
        // afterwards be entered ALONG it, from a tile the law allows. That put
        // a lot at `served` with no doors at all - the field said three tiles,
        // the search said none - and the card printed "no road, the nearest is
        // 6 tiles away" one line above "road 3". `computeRoadDist` had it right
        // and this had it wrong, so SPEC 6b was still two laws.
        if (!crossable(world, cur, j)) continue; // a gate is open along its axis only (SPEC 6b), door or no door
        seen[j] = 1;
        if (prev) prev[j] = cur; // a DOOR needs its parent too: the chain back to the platform is read off it
        if (world.road[j] !== ROAD.NONE) { doors.push(j); continue; } // a road is the answer, whatever else is on it
        if (!open(world, j)) continue; // a bare wall is not a way to a road; nor, for a forecourt, is a river or a house
        next.push(j);
      }
    }
    if (doors.length) break;
    frontier = next;
  }
  doors.sort((a, b) => a - b);
  return { d, doors };
}

const doorScratch = (world) => {
  const n = world.w * world.h;
  return world._seen && world._seen.length === n ? world._seen : (world._seen = new Uint8Array(n));
};

/**
 * Every door of the site at i, ascending; empty when no road is within reach.
 *
 * `seen` IS THE BOUNDARY. SPEC §14 forbids the draw and street layers a
 * buffer on the world, and these readers are exactly who they call: the hover
 * card, the walker picking a doorstep, the access overlay asking every visible
 * tile. Pass your own Uint8Array(w*h) and nothing of yours touches the world;
 * omit it and the sim's own scratch is used, which is right for the sim.
 * `accessOpts` travels with the site either way - one implementation of "what
 * is this thing's door", so the street cannot use the bare-wall rule where the
 * sim uses `passable`.
 */
export function doorsOf(world, i, seen = null) {
  return doorSearch(world, i, seen || doorScratch(world), accessOpts(world, i)).doors;
}

/** ONE door of the site at i (the lowest-numbered), or null. The single-tile reader: the tools (need-stress, check) and any caller that wants a doorstep rather than a set. */
export function doorOf(world, i, seen = null) {
  const doors = doorsOf(world, i, seen);
  return doors.length ? doors[0] : null;
}

/**
 * How far the nearest road really is, PAST ROAD_REACH, and where. The hover
 * card asks this of a lot the rule refuses; no rule does.
 *
 * A FUNCTION, not a constant: `KNOBS.ROAD_REACH` is a knob the suite moves and
 * a module-load constant would freeze the card's horizon at whatever the knob
 * was when the file was imported - at ROAD_REACH 9 the card would look LESS
 * far than the rule does, while SPEC §6c claims everything moves with it. It
 * was that sentence, asserted and never tested, that a hostile review pulled.
 */
export const nearReach = () => KNOBS.ROAD_REACH + 5;
export function nearestRoad(world, i, reach = null, seen = null) {
  return doorSearch(world, i, seen || doorScratch(world), { reach: reach ?? nearReach(), ...accessOpts(world, i) });
}

/**
 * Platform-to-door edges. A station is served like anything else: its doors
 * are doorSearch's, and the walk layer crosses the forecourt between them one
 * tile at a time - so a platform two or three tiles off a road is a way onto
 * the rail, and one four tiles off is not. Before this the graph only stepped
 * onto a platform from a tile ORTHOGONALLY beside it, which is the d = 1 case
 * of this same rule; nothing about an adjacent station moves.
 *
 * Each link carries the tiles BETWEEN its two ends, platform-first, so
 * `nodePath` lays the approach into the stored path and every consecutive
 * pair of walked tiles stays orthogonally adjacent (Part M' checks exactly
 * that). Derived with roadDist, never saved. A sparse array, not a Map:
 * `dial` looks this up once per settled walk node.
 */
export function computeStationDoors(world) {
  const n = world.w * world.h;
  const links = world._stationDoors && world._stationDoors.length === n ? world._stationDoors : (world._stationDoors = new Array(n));
  links.fill(undefined);
  world._hasStationDoors = false;
  const sig = [];
  let any = false;
  for (let i = 0; i < n && !any; i++) if (world.rail[i] === 2) any = true;
  if (!any) { markDoorsMoved(world, ""); return; }
  const prev = world._doorPrev && world._doorPrev.length === n ? world._doorPrev : (world._doorPrev = new Int32Array(n));
  const seen = doorScratch(world);
  // An edge carries only the tiles it crosses; its COST is worked out at
  // relax time, because a forecourt tile can be a zoned lot or a rail tile
  // and so can carry the player's line, and what a step across it costs
  // depends on who is stepping (stepCost, SPEC 7.8).
  const add = (a, b, chain) => { (links[a] || (links[a] = [])).push([b, chain]); };
  for (let i = 0; i < n; i++) {
    if (world.rail[i] !== 2) continue;
    // The SAME search `served` asks of a platform, so the field and the graph
    // cannot disagree: a station the card calls served is one a citizen can
    // walk to, and the tiles it walks are tiles it can stand on.
    const { d, doors } = doorSearch(world, i, seen, { prev, passable });
    if (d < 1 || !doors.length) continue; // d === 0 cannot happen: ops.js refuses a station on a road
    const shape = [];
    for (const j of doors) {
      const chain = [];
      for (let k = prev[j]; k !== -1 && k !== i; k = prev[k]) chain.push(k);
      chain.reverse(); // platform-first
      add(i, j, chain);
      add(j, i, chain.slice().reverse());
      // THE SIGNATURE CARRIES THE CHAIN, NOT JUST THE DOOR. Endpoint identity
      // is not enough: a door set is not the graph, and the tiles BETWEEN a
      // platform and its door are what `nodePath` lays into every stored
      // path, what `computeTraffic` counts, what `commuteTime` prices, what
      // `exposure` reads the player's line on, and what a walker is drawn
      // standing on. A building or a civic that reroutes a forecourt WITHOUT
      // taking the door away moves all of that and leaves the door list
      // alone: a hostile review found the door-set version blind to exactly
      // that, on this part's own flagship fixture, with 99 animals walking
      // through a police station and save -> load -> continue parting company
      // a month later. (Two agents fixed this in the same hour, separately
      // and equivalently; X2's shape string is the one that landed.)
      shape.push(`${j}>${chain.join(",")}`);
      world._hasStationDoors = true;
    }
    sig.push(`${i}:${shape.join(";")}`);
  }
  markDoorsMoved(world, sig.join("|"));
}

/**
 * A PLATFORM'S DOORS ARE DERIVED FROM THE GROUND, AND THE GROUND MOVES.
 * `passable` reads `tier` and `civic`: a building that GROWS across a
 * forecourt, or a civic dropped on one, closes a way that stored commutes are
 * already walking - and neither goes through the road/wall/rail branch of
 * ops.apply that invalidates paths. A reload re-plans everything, the straight
 * run keeps the stale paths, and save -> load -> continue parts company one
 * month later. (Found by a hostile review; it is handoff 24's own lesson - a
 * shape change invalidates what was derived from the shape - applied to merges
 * and splits and not to the shape change this part invented.)
 *
 * So the signature of the whole door graph is kept, and any change to it says
 * so. The first computation on a world sets the signature and claims nothing:
 * a freshly loaded city has just rebuilt every path already. The FLAG is
 * cleared by whoever acts on it (tick.js, ops.js), which is where
 * citizens.invalidatePaths lives - fields.js may not import it without a
 * cycle, and one implementation of "every commute is stale" is worth the
 * indirection.
 */
function markDoorsMoved(world, sig) {
  const had = world._stationDoorSig;
  world._stationDoorSig = sig;
  if (had !== undefined && had !== sig) world.doorsMoved = true;
}

/** Edge road tiles (on the map border). */
export function edgeRoads(world) {
  const { w, h } = world;
  const out = [];
  for (let i = 0; i < w * h; i++) {
    if (world.road[i] === ROAD.NONE) continue;
    const tx = i % w;
    const ty = (i / w) | 0;
    if (tx === 0 || ty === 0 || tx === w - 1 || ty === h - 1) out.push(i);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The commute search (SPEC §7.8): Dial's buckets over the road graph
// ---------------------------------------------------------------------------

/** One road step, in integer cost units; a ride step is KNOBS.RAIL_COST on the same scale. */
export const WALK = KNOBS.WALK;
/** A path entry is a tile index with bit 15 set when the citizen RODE onto it (rail between stations). */
export const RIDE = 0x8000;
export const TILE = 0x7fff;
export const tileOf = (p) => p & TILE;
export const riding = (p) => (p & RIDE) !== 0;

/** The cost of stepping ONTO road tile j as `species`: a legal step, or TRESPASS_STEP legal steps for a tile the player's line forbids. */
export function stepCost(world, species, j) {
  return world.use[j] && !admits(world.use[j], species) ? KNOBS.TRESPASS_STEP * WALK : WALK;
}

/**
 * Dial's shortest paths from road tile `from` over a TWO-LAYER graph (SPEC
 * §7.9): layer 0 walks on road tiles and station tiles, layer 1 rides on
 * rail tiles; the layers meet only at a station (board / alight, free).
 * Node = tile + layer·n. Integer costs, settled in cost order — FIFO
 * within a bucket, the same neighbour order as roadPath — so where every
 * step costs the same and no rail exists (a city with no line and no
 * track) the settle order, the prev tree and the paths are the BFS's
 * exactly; the suite checks every commuter's path against roadPath.
 * `settle(tile, cost)` is called once per WALK node; return true to stop.
 * `policy` may set `{ railCost, neutral }`: the default is the citizen
 * commute law, while Part H passes railCost 0 and neutral true for freight.
 * Land value never calls Dial; its geographic distances remain separate.
 * Returns the { dist, prev } scratch (valid until the next call; −1 = unreached).
 */
export function dial(world, species, from, maxCost, settle, policy = {}) {
  const { w, h, road, rail } = world;
  const n = w * h;
  const dist = world._ddist && world._ddist.length === 2 * n ? world._ddist : (world._ddist = new Int32Array(2 * n));
  const prev = world._dprev && world._dprev.length === 2 * n ? world._dprev : (world._dprev = new Int32Array(2 * n));
  dist.fill(-1);
  const buckets = world._dbuckets || (world._dbuckets = []);
  for (let c = 0; c <= maxCost; c++) { if (buckets[c]) buckets[c].length = 0; else buckets[c] = []; }
  const relax = (node, nc, via) => {
    if (nc > maxCost) return;
    if (dist[node] !== -1 && dist[node] <= nc) return;
    dist[node] = nc;
    prev[node] = via;
    buckets[nc].push(node);
  };
  // `from` is ONE road tile or a LIST of them. Multi-source costs nothing
  // here - Dial settles in cost order whatever it starts from - and it is how
  // a citizen leaves by whichever of its home's doors its road goes.
  const sources = typeof from === "number" ? [from] : from;
  for (const f of sources) {
    if (dist[f] !== -1) continue;
    dist[f] = 0;
    prev[f] = -1;
    buckets[0].push(f);
  }
  const ride = policy.railCost == null ? KNOBS.RAIL_COST : Math.max(0, policy.railCost);
  const neutral = !!policy.neutral;
  for (let c = 0; c <= maxCost; c++) {
    const b = buckets[c];
    for (let q = 0; q < b.length; q++) {
      const i = b[q];
      if (dist[i] !== c) continue; // settled cheaper already
      const layer = i >= n ? 1 : 0;
      const tile = layer ? i - n : i;
      if (!layer && settle(tile, c)) { b.length = 0; return { dist, prev }; }
      const tx = tile % w;
      const ty = (tile / w) | 0;
      if (!layer) {
        if (rail[tile] === 2) relax(tile + n, c, i); // board
        for (const [dx, dy] of N4) {
          const nx = tx + dx;
          const ny = ty + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (road[j] === ROAD.NONE && rail[j] !== 2) continue; // a road, or a platform
          // Logistics (Part H) is neutral freight: use-zoning is a rule for
          // animals living, working and walking, not for a hall's cart. It
          // still uses this one two-layer graph, with an explicit cost policy.
          relax(j, c + (neutral ? WALK : stepCost(world, species, j)), i);
        }
        // A station's forecourt: the platform and each of its doors, WALK per
        // tile of the gap (computeStationDoors). At d = 1 this is the step the
        // N4 loop just took, at the same cost, so nothing about a station
        // beside a road moves. The tiles crossed are priced one at a time with
        // stepCost, so the player's line runs across a forecourt like anywhere
        // else - a forecourt tile can be a zoned lot, and a rabbit must pay
        // the trespass fields.exposure will read back off the stored path.
        const links = world._hasStationDoors ? world._stationDoors[tile] : null;
        if (links) for (const [j, chain] of links) {
          let lc = neutral ? WALK : stepCost(world, species, j);
          for (const t of chain) lc += neutral ? WALK : stepCost(world, species, t);
          relax(j, c + lc, i);
        }
      } else {
        if (rail[tile] === 2) relax(tile, c, i); // alight
        for (const [dx, dy] of N4) {
          const nx = tx + dx;
          const ny = ty + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const j = ny * w + nx;
          if (!rail[j]) continue;
          relax(j + n, c + ride, i);
        }
      }
    }
    b.length = 0;
  }
  return { dist, prev };
}

/**
 * The stored path for the prev tree's node `toNode` (a walk node): one
 * entry per tile, in order, with RIDE set on the tiles the citizen rode
 * onto. A station has two nodes (walk and ride) and collapses to one
 * WALKED entry — the animal stands on the platform whether it boards or
 * alights there — so "predators don't exit the train in a prey only zone"
 * is the same rule as any other forbidden tile (fields.exposure).
 */
export function nodePath(world, prev, toNode) {
  const n = world.w * world.h;
  const nodes = [];
  for (let k = toNode; k !== -1; k = prev[k]) nodes.push(k);
  nodes.reverse();
  const out = [];
  let lastTile = -1;
  let allRide = true;
  for (const node of nodes) {
    const tile = node >= n ? node - n : node;
    const isRide = node >= n;
    if (tile === lastTile) { allRide = allRide && isRide; out[out.length - 1] = tile | (allRide ? RIDE : 0); continue; }
    // A station link is one graph EDGE across a forecourt of one to three
    // tiles; the path lays those tiles out, so every consecutive pair of
    // entries stays orthogonally adjacent and commuteTime, the traffic count
    // and the walker all price the gap for what it is - a walk.
    if (lastTile >= 0 && !ortho(world, lastTile, tile)) for (const t of approachBetween(world, lastTile, tile)) out.push(t);
    lastTile = tile;
    allRide = isRide;
    out.push(tile | (isRide ? RIDE : 0));
  }
  return Uint16Array.from(out);
}

const ortho = (world, a, b) => Math.abs((a % world.w) - (b % world.w)) + Math.abs(((a / world.w) | 0) - ((b / world.w) | 0)) === 1;

/** The forecourt tiles between two ends of a station link, in order; empty if they are not linked. */
function approachBetween(world, a, b) {
  const links = world._hasStationDoors ? world._stationDoors[a] : null;
  if (!links) return [];
  for (const [j, chain] of links) if (j === b) return chain;
  return [];
}

/**
 * The commute as `species`, from ANY of `from` to ANY of `to` - each is one
 * road tile or a list of doors (fields.doorsOf). The cheapest pairing wins,
 * because Dial settles in cost order and stops at the first goal it settles:
 * a citizen with roads on two sides of its home leaves by the side nearer
 * its work. { path, cost }, or null past max (in walk steps).
 */
export function commutePath(world, species, from, to, max = KNOBS.COMMUTE_MAX) {
  const F = typeof from === "number" ? [from] : from;
  const T = typeof to === "number" ? [to] : to;
  if (!F || !T || !F.length || !T.length) return null;
  const goal = new Set(T);
  for (const f of F) if (goal.has(f)) return { path: new Uint16Array([f]), cost: 0 };
  let end = -1;
  const { dist, prev } = dial(world, species, F, max * WALK, (i) => (goal.has(i) ? ((end = i), true) : false));
  if (end < 0) return null;
  return { path: nodePath(world, prev, end), cost: dist[end] };
}

/** How long a commute feels, in walk steps: a walking segment 1, a riding segment RAIL_COST/WALK — never the trespass penalty (that is the search's preference, not time). */
export function commuteTime(path) {
  // Accumulate on Dial's integer scale and divide once. Repeatedly adding the
  // fractional ride share can put an exactly-on-the-limit commute a few ulps
  // over its species threshold (for example 2 walks + 27 rides = 8 exactly).
  let cost = 0;
  for (let k = 1; k < path.length; k++) cost += (path[k] & RIDE) || (path[k - 1] & RIDE) ? KNOBS.RAIL_COST : WALK;
  return cost / WALK;
}

/** Does the commute ride at all? */
export function rides(path) {
  if (!path) return false;
  for (let k = 0; k < path.length; k++) if (path[k] & RIDE) return true;
  return false;
}

/**
 * Trespass exposure (SPEC §9c): the walking tiles of the commute whose use
 * forbids the species — a riding step (bit 15, rail) never counts: neutral
 * travel — plus TRESPASS_HOME for a home or job lot that forbids. `cov` is
 * the best police cover over those tiles; no police, no arrest.
 */
export function exposure(world, c) {
  let e = 0;
  let cov = 0;
  let tile = -1;
  if (c.path) {
    for (let k = 0; k < c.path.length; k++) {
      if (c.path[k] & RIDE) continue;
      const t = c.path[k] & TILE;
      if (world.use[t] && !admits(world.use[t], c.species)) {
        e++;
        if (tile < 0) tile = t;
        if (world.policeCov[t] > cov) cov = world.policeCov[t];
      }
    }
  }
  for (const lot of [c.home, c.job]) {
    if (lot >= 0 && world.use[lot] && !admits(world.use[lot], c.species)) {
      e += KNOBS.TRESPASS_HOME;
      if (tile < 0) tile = lot;
      if (world.policeCov[lot] > cov) cov = world.policeCov[lot];
    }
  }
  const p = e ? Math.min(KNOBS.TRESPASS_MAX, KNOBS.TRESPASS_P * e * cov / KNOBS.POLICE_EFFECT) : 0;
  return { e, cov, p, tile };
}

export { idx };
