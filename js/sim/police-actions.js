import { CIVIC, absent } from "./world.js";
import { served } from "./fields.js";
import { arrest, sentenceFor } from "./justice.js";
import { KNOBS } from "./rules.js";

export const hasPolice = world => !!world?.civic.includes(CIVIC.POLICE);
const destinationName = { zoo: "a road-served Zoo prison with a free bed", centre: "a road-served Pacification Centre with a free bed", hall: "a reachable meat hall with capacity" };
const sentences = ["zoo", "centre", "hall"];

export function collectionSentence(normal, roll) {
  const rank = sentences.indexOf(normal);
  return roll < 0.6 ? normal : roll < 0.8 ? sentences[Math.min(2, rank + 1)] : roll < 0.9 ? sentences[Math.max(0, rank - 1)] : "hall";
}

/** Read-only eligibility; the UI and the op agree, and rejected commands consume no RNG. */
export function policeActionPlan(world, op) {
  if (!hasPolice(world)) return { reason: "Build a police station first." };
  if (!world.civic.some((kind, i) => kind === CIVIC.POLICE && !world.burning[i] && !world.flooded[i] && served(world, i))) return { reason: "Police need an operational station with road access." };
  if (!["interview", "collect"].includes(op.kind)) return { reason: "Unknown police action." };
  const citizen = Number.isInteger(op.citizenId) ? world.byId?.get(op.citizenId) : null;
  if (!citizen || citizen.dead) return { reason: "Select a living citizen with Inspect first." };
  if (absent(world, citizen)) return { reason: "This citizen is already in custody." };
  const month = world.events.policeMonth;
  if (month?.tick === world.tick && op.kind === "interview" && month.interview.includes(citizen.id)) return { reason: "This citizen has already been interviewed this month." };
  if (month?.tick === world.tick && month.collect.includes(citizen.id)) return { reason: "Collection has already been attempted for this citizen this month." };
  // A past conviction is not evidence of a fresh crime. Only unresolved case files count.
  const file = world.events.files.find(f => !f.closed && f.culpritId === citizen.id);
  const charge = file || { tile: citizen.home >= 0 ? citizen.home : world.start.ty * world.w + world.start.tx, culpritId: -1, cause: op.kind === "interview" ? "interview" : "collection order", closed: false };
  return { citizen, charge, guilty: !!file, sentence: sentenceFor(world, charge, citizen).sentence };
}

export function policeAction(world, op) {
  const plan = policeActionPlan(world, op);
  if (plan.reason) return { ok: false, cost: 0, reason: plan.reason };
  const { citizen, charge, guilty } = plan;
  const notices = [];
  // Separate from the bounded news feed: save/load must not permit rerolling old interviews.
  if (world.events.policeMonth?.tick !== world.tick) world.events.policeMonth = { tick: world.tick, interview: [], collect: [] };
  const month = world.events.policeMonth;
  if (op.kind === "interview") {
    month.interview.push(citizen.id);
    const caught = world.rng.chance(guilty ? KNOBS.INTERVIEW_GUILTY_P : KNOBS.INTERVIEW_INNOCENT_P);
    const line = `INTERVIEW — ${citizen.name} ${citizen.surname}: ${caught ? "the police ordered collection." : "released without a charge."}`;
    world.events.log.push({ t: world.tick, id: "interview", line, links: [citizen.id] });
    notices.push(line);
    if (!caught) return { ok: true, cost: 0, notices, collected: false, undoable: false };
  }
  month.collect.push(citizen.id);
  const sentence = collectionSentence(plan.sentence, world.rng.next());
  const options = { sentence, ordered: true };
  const destination = sentenceFor(world, charge, citizen, options).destination;
  const line = `COLLECT — ${citizen.name} ${citizen.surname}: ${sentence === "zoo" ? "jail" : sentence === "centre" ? "pacification" : "meat hall"}${destination < 0 ? `; waiting for ${destinationName[sentence]}. Try again next month.` : "."}`;
  world.events.log.push({ t: world.tick, id: "police-collection", line, links: [citizen.id], sentence });
  notices.push(line);
  if (destination < 0) return { ok: true, cost: 0, notices, collected: false, undoable: false };
  arrest(world, charge, citizen, !guilty, notices, options);
  return { ok: true, cost: 0, notices, collected: true, undoable: false };
}
