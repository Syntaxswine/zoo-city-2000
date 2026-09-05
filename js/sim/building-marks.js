// Display descriptions of the existing derived majority; never writes the city.
import { SPECIES } from "./species.js";
import { pluralSpecies } from "./landmarks.js";

export const MARK_NAMES = Object.freeze({
  rabbit: "a warren door", mouse: "a small second door", fox: "a brush weathervane",
  beaver: "a timber gable", owl: "a roost pole", bear: "a porch bench",
  tortoise: "a stone step", raccoon: "a pair of bins", pig: "a mud patch",
  cow: "a pasture gate", wolf: "a pack banner", cat: "a window ledge",
  hawk: "a roof spike", skunk: "a warning stripe",
});

export function buildingMark(world, i) {
  if (!world.tier[i] || world.zone[i] < 1 || world.zone[i] > 4) return null;
  const species = SPECIES[world.majority[i] - 1]?.id;
  if (!species) return null;
  return { species, name: MARK_NAMES[species],
    line: `${MARK_NAMES[species]} — ${pluralSpecies(species)} ${world.zone[i] === 1 ? "live" : "work"} here` };
}
