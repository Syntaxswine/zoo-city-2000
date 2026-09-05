// follow.js — a pure citizen-id target for Inspect. SPEC §11c.
//
// Walkers are temporary pictures; citizen ids are the durable identity. This
// resolver is deliberately DOM-free and read-only so the card can follow a
// live walker, fall back to home between walks, and become an epitaph after
// the citizen leaves the simulation.

import { absent, CIVIC } from "./sim/world.js";
import { epitaph, legacyOf } from "./sim/legacy.js";

const xy = (world, tile) => tile >= 0
  ? Object.freeze({ tile, tx: tile % world.w, ty: (tile / world.w) | 0 })
  : Object.freeze({ tile: -1, tx: null, ty: null });

function liveWalker(walkers, id) {
  return (walkers || [])
    .filter((w) => w && w.citizen === id && !w.done)
    .sort((a, b) => `${a.kind}|${a.leg}|${a.seg}|${a.tx}|${a.ty}|${a.id}`.localeCompare(`${b.kind}|${b.leg}|${b.seg}|${b.tx}|${b.ty}|${b.id}`))[0] || null;
}

/** Resolve a stable citizen pin without writing to the world or walker list. */
export function pinTarget(world, walkers, rawId) {
  const id = Number(rawId);
  if (!world || !Number.isInteger(id) || id < 0) return null;
  const c = world.byId?.get(id);
  if (c && !c.dead) {
    const winter = c.species === "bear" && world.events?.active?.some((e) => e.id === "bearWinter" && e.until > world.tick);
    if (absent(world, c) || c.onLeave || winter || c.home < 0) {
      const camp = world.campers?.find(cp => cp.householdId === c.household);
      const place = c.heldAt >= 0 ? xy(world, c.heldAt) : xy(world, c.home >= 0 ? c.home : camp?.tile ?? -1);
      const detail = c.pen ? "in the market pen"
        : (c.held || 0) > world.tick ? (c.heldAt >= 0 ? (world.civic[c.heldAt] === CIVIC.ZOO ? "in the Zoo prison" : "at the Pacification Centre") : "in the cells")
          : c.onLeave ? "away from town" : winter ? "asleep for bear winter" : camp ? "camping while waiting for housing and recovery" : "without a settled home";
      return Object.freeze({ id, state: "away", citizen: c, walker: null, ...place, line: detail });
    }
    const walker = liveWalker(walkers, id);
    if (walker) {
      return Object.freeze({
        id, state: "walking", citizen: c, walker,
        tile: Number.isInteger(walker.tile) && walker.tile >= 0 ? walker.tile : -1,
        tx: Number.isFinite(walker.tx) ? walker.tx : null,
        ty: Number.isFinite(walker.ty) ? walker.ty : null,
        line: walker.riding ? "on the train" : "out in the city",
      });
    }
    return Object.freeze({ id, state: "home", citizen: c, walker: null, ...xy(world, c.home), line: `at home at (${c.home % world.w},${(c.home / world.w) | 0})` });
  }
  const record = legacyOf(world, id);
  if (!record) return null;
  return Object.freeze({ id, state: "gone", citizen: null, record, walker: null, ...xy(world, record.home), line: epitaph(world, record) });
}
