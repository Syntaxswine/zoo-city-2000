import { CLASS, classOfCitizen } from "./sim/wealth.js";

// Resolve class at draw time so an existing walker changes clothes when its
// household moves or its address changes class, including while paused.
export function citizenAppearance(world, person) {
  const citizen = world.byId?.get(person.citizen ?? person.appearanceCitizen ?? person.id);
  return { look: person.look, hat: person.hat, carry: person.carry,
    suit: (citizen ? classOfCitizen(world, citizen) : person.appearanceClass) === CLASS.AFFLUENT };
}
