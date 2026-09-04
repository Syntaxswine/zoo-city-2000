// justice.js — crime and punishment. SPEC §9c. Pure; imports cleanly in Node.
//
// The owner (2026-09-02): predation as part of crime; grey-market meat
// halls; a pacification centre where troublesome predators are fixed (no
// offspring, no interest in prey); prey pacified if caught in a crime; a 5%
// chance the police arrest the wrong animal; "crime should be weighted by
// unemployment, no jobs means hungry wolves"; the wrong animal "random based
// on proximity"; "it should be possible for prey to murder too, but just much
// less likely"; a fixed wolf may keep the counter; "multiple offenses should
// send the citizen to the meat market … a better first stop for prey".
//
// In tick order: RELEASES (the cells → home with a record; the centre → home
// FIXED), the KILLING (any adult may kill a neighbour, weighted), BURGLARY
// (where crime is high — no station needed; a burglary is not caused by
// having police, and the file opens either way because the file is the
// STREET's memory of it), the INVESTIGATION (every open file rolls once a
// month; the town's FORCE and the cover at the scene are the probability, and
// with no station in town no roll is made at all; 5% wrongful, random by
// proximity), the SENTENCE (a predator's first
// conviction: the centre; prey, or anyone already fixed: the meat hall —
// sold; else the cells), EXONERATION when the real one is taken.
//
// Determinism: every draw is from world.rng in this order, and nothing draws
// where nothing can happen (no open file → no roll; no hot lot → no burglary;
// KILL_P × Σ weights is drawn once a month wherever an adult lives).
// Every line names the animals and uses no pronoun — the sim has no sex.

import { KNOBS } from "./rules.js";
import { ZONE, CIVIC, inBounds, absent, USE_NAME } from "./world.js";
import { DIET_OF, isPredatorOf } from "./species.js";
import { post } from "./budget.js";
import { removeCitizen, holdFuneral, releaseJob } from "./citizens.js";
import { ageYears, isWorker } from "./census.js";
import { hasAccess, exposure } from "./fields.js";
import { reachFrom } from "./reach.js";
import { KIND, remember } from "./life.js";
import { hallReach, routeToHall, receiveMeat } from "./meat.js";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const monthName = (tick) => MONTHS[((tick % 12) + 12) % 12];
const nameOf = (c) => `${c.name} ${c.surname} (${c.species})`;
const at = (world, i) => `(${i % world.w},${(i / world.w) | 0})`;
const cheb = (world, a, b) => Math.max(Math.abs((a % world.w) - (b % world.w)), Math.abs(((a / world.w) | 0) - ((b / world.w) | 0)));

/** Open a file at an incident: a crime stain for FILE_MONTHS, an investigation for CASE_MONTHS. */
export function openFile(world, { tile, culpritId, victimId = 0, cause, line = "", crime = KNOBS.FILE_CRIME, radius = KNOBS.FILE_RADIUS }) {
  const f = { tile, radius, crime, opened: world.tick, until: world.tick + KNOBS.FILE_MONTHS, culpritId, victimId, cause, line, closed: false };
  world.events.files.push(f);
  return f;
}

/** One weighted draw over `items` with precomputed `weights`; null if the total is 0 (no draw). */
function weightedPick(world, items, weights) {
  let total = 0;
  for (const x of weights) total += x;
  if (total <= 0) return null;
  let r = world.rng.next() * total;
  for (let k = 0; k < items.length; k++) {
    r -= weights[k];
    if (r <= 0 && weights[k] > 0) return items[k];
  }
  for (let k = items.length - 1; k >= 0; k--) if (weights[k] > 0) return items[k];
  return null;
}

/** Adults whose home is within reach of `tile` — the flood, so a walled compound is out of a killer's reach; with their distances. */
function adultsWithin(world, tile, radius, skip = null) {
  const reach = reachFrom(world, tile, radius);
  const cands = [];
  const dists = [];
  for (const c of world.citizens) {
    if (c.dead || c.home < 0 || c === skip || absent(world, c)) continue;
    if (ageYears(world, c) < KNOBS.ADULT_AGE) continue;
    const d = reach(c.home);
    if (d < 0) continue;
    cands.push(c);
    dists.push(d);
  }
  return { cands, dists };
}

/** The thief for a heist or a burglary at `lot`: any adult within reach, weighted — never a species gate. */
export function thiefPool(world, lot) {
  const { cands } = adultsWithin(world, lot, KNOBS.BURGLARY_RADIUS);
  const weights = cands.map((c) => {
    if (c.fixed) return 0;
    let w = 1;
    if (c.job < 0 && isWorker(world, c)) w *= KNOBS.THIEF_UNEMP;
    if (world.crime[c.home] > KNOBS.CRIME_HIGH) w *= KNOBS.THIEF_HOME_CRIME;
    w *= KNOBS.THIEF_SPECIES[c.species] || 1;
    w *= Math.pow(KNOBS.RECORD_WEIGHT, Math.min(3, c.record || 0));
    return w;
  });
  return weightedPick(world, cands, weights);
}

// ---------------------------------------------------------------------------
// The killing
// ---------------------------------------------------------------------------

export function killWeight(world, c) {
  if (c.dead || c.home < 0 || c.fixed || absent(world, c) || ageYears(world, c) < KNOBS.ADULT_AGE) return 0;
  let w = KNOBS.KILL_DIET[DIET_OF[c.species]] || 0;
  if (c.job < 0 && isWorker(world, c)) w *= KNOBS.KILL_HUNGRY;
  // The market influence is a service route, not the four-tile smell. Rail
  // on this H route is free; a cut line or a hall beyond 60 walked steps is
  // no market at all. Full hooks cannot buy another body.
  if (hallReach(world, c.home, KNOBS.MEAT_ROAD, { space: true })) w *= world.events.licence ? KNOBS.KILL_MARKET_LICENSED : KNOBS.KILL_MARKET;
  if (c.job >= 0 && world.zone[c.job] === ZONE.M) w *= KNOBS.KILL_STAFF;
  w *= 0.5 + world.crime[c.home] / 100;
  return w;
}

function kill(world, killer, victim, notices) {
  const ev = world.events;
  const tick = world.tick;
  const victimHome = victim.home;
  const mourners = victim.friends.slice();
  const hh = world.hhById.get(victim.household);
  const family = hh ? hh.members.filter((id) => id !== victim.id) : [];
  const market = hallReach(world, killer.home, KNOBS.MEAT_ROAD, { space: true });
  const selectedHall = market?.hall ?? -1;
  // The sim publishes the exact selected two-layer path before deleting the
  // victim. The walker consumes it verbatim, including RIDE tags; it never
  // recomputes a road-only fiction for a free-rail route.
  const sackRoute = selectedHall >= 0 ? routeToHall(world, victimHome, selectedHall, KNOBS.MEAT_ROAD) : null;
  // A hall cannot buy a body its promised sack walker cannot physically
  // reach. KILL_MARKET still describes the killer's market influence, but
  // stock, cash and the transient trip all use the same victim-to-hall route.
  const hall = sackRoute ? selectedHall : -1;
  const homeRoute = hall >= 0 ? market : null;
  (world.predations || (world.predations = [])).push({
    killer: killer.id, killerHome: killer.home, victimHome, hall,
    marketPath: market ? Array.from(market.path) : null,
    sackPath: sackRoute ? Array.from(sackRoute.path) : null,
    homePath: homeRoute ? Array.from(homeRoute.path) : null,
    victim: { id: victim.id, species: victim.species, age: ageYears(world, victim), name: nameOf(victim) },
  });
  remember(world, killer, KIND.KILLED, victim.id);
  removeCitizen(world, victim, "killed");
  holdFuneral(world, mourners, null);
  for (const id of family) { const o = world.byId.get(id); if (o) o.grief = tick + 12; }
  ev.active.push({ id: "fear", until: tick + KNOBS.FEAR_MONTHS, moodBySpecies: { [victim.species]: -KNOBS.FEAR_MOOD } });
  if (hall >= 0 && receiveMeat(world, hall, "killed", 1)) post(world, "cut", KNOBS.MEAT_PRICE);
  post(world, "inquest", -Math.min(KNOBS.INQUEST, Math.max(0, world.cash)));
  ev.killings++;
  const jobless = killer.job < 0 && isWorker(world, killer);
  const since = jobless ? `, out of work since ${monthName(tick - Math.min(tick, killer.jobless || 0))}` : "";
  const bought = hall >= 0 ? `; the meat hall at ${at(world, hall)} had ${victim.species} on Tuesday` : "";
  const wake = mourners.length >= 3 ? ` ${mourners.length} friends held a wake.` : "";
  const line = `KILLING — ${nameOf(victim)} did not come home to ${at(world, victimHome)}. ${nameOf(killer)} of ${at(world, killer.home)}${since} was seen on the street${bought}.${wake}`;
  openFile(world, { tile: victimHome, culpritId: killer.id, victimId: victim.id, cause: "killing", line });
  ev.log.push({ t: tick, id: "killing", line, links: [victim.id, killer.id] });
  notices.push(line);
}

/** Σ of this month's kill weights — the suite sets KILL_P = 1/Σ to force exactly one killing. */
export function killTotal(world) {
  let total = 0;
  for (const c of world.citizens) total += killWeight(world, c);
  return total;
}

export function killingTick(world, cen, notices) {
  const cs = world.citizens;
  if (!cs.length) return;
  const ws = new Float64Array(cs.length);
  let total = 0;
  for (let k = 0; k < cs.length; k++) { ws[k] = killWeight(world, cs[k]); total += ws[k]; }
  if (total <= 0) return;
  const k = Math.floor(KNOBS.KILL_P * total + world.rng.next());
  for (let j = 0; j < k; j++) {
    let r = world.rng.next() * total;
    let killer = null;
    for (let i = 0; i < cs.length; i++) { r -= ws[i]; if (r <= 0 && ws[i] > 0) { killer = cs[i]; break; } }
    if (!killer || killer.dead) continue;
    const cands = [];
    const vw = [];
    const reach = reachFrom(world, killer.home, KNOBS.KILL_RADIUS); // a wall between them is out of reach
    for (const v of cs) {
      if (v.dead || v.home < 0 || v === killer || v.household === killer.household || absent(world, v)) continue;
      if (ageYears(world, v) < KNOBS.ADULT_AGE) continue;
      if (reach(v.home) < 0) continue;
      let wt = isPredatorOf(killer.species, v.species) ? 1 : KNOBS.KILL_OTHER;
      let bridged = v.friends.includes(killer.id);
      if (!bridged) for (const f of v.friends) { const o = world.byId.get(f); if (o && o.species === killer.species) { bridged = true; break; } }
      if (bridged) wt *= KNOBS.KILL_BRIDGE;
      cands.push(v);
      vw.push(wt);
    }
    const victim = weightedPick(world, cands, vw);
    if (!victim) continue;
    kill(world, killer, victim, notices);
  }
}

// ---------------------------------------------------------------------------
// Burglary — prey have to be able to be caught in a crime
// ---------------------------------------------------------------------------

export function burglaryTick(world, cen, notices) {
  // A burglary is not caused by having police. Until session 8 this returned
  // early when the town had no station ("nobody to file it"), so the FIRST
  // station a mayor built did not reduce crime, it invented it: serviceprobe
  // measured 6 files in forty years at zero stations against 116 at one, and
  // 8.3% of lots hot against 18.6%. The crime happens either way now; what a
  // station buys is somebody looking for who did it.
  const n = world.w * world.h;
  const hot = [];
  for (let i = 0; i < n; i++) if (world.tier[i] > 0 && !world.rubble[i] && !world.burning[i] && world.crime[i] > KNOBS.CRIME_HIGH) hot.push(i);
  if (!hot.length) return;
  const p = Math.min(KNOBS.BURGLARY_MAX, KNOBS.BURGLARY_P * hot.length);
  if (!world.rng.chance(p)) return;
  const lot = world.rng.pick(hot);
  const thief = thiefPool(world, lot);
  if (!thief) return;
  const tier = world.tier[lot];
  const loss = KNOBS.BURGLARY_LOSS * tier;
  post(world, "theft", -Math.min(loss, Math.max(0, world.cash)));
  const z = world.zone[lot];
  const where = z === ZONE.R ? `broke into the house at ${at(world, lot)}` : z === ZONE.C ? `walked out of the shop at ${at(world, lot)} with §${loss} of stock` : z === ZONE.M ? `left the meat hall at ${at(world, lot)} with §${loss} of stock` : `took §${loss} of copper off the works at ${at(world, lot)}`;
  // The file opens either way: it is the STREET's memory of the burglary, not
  // the paperwork's, and a street does not forget faster for want of a desk
  // sergeant. Whether anyone WORKS it is filesTick's question.
  const line = `BURGLARY — ${nameOf(thief)} ${where}. ${cen.policeStations ? "A file is open for six months." : "There is no station in town; the street remembers it and nobody comes looking."}`;
  openFile(world, { tile: lot, culpritId: thief.id, cause: "burglary", line });
  world.events.log.push({ t: world.tick, id: "burglary", line, links: [thief.id] });
  notices.push(line);
}

// ---------------------------------------------------------------------------
// The file, the arrest, the wrongful 5%, the sentence
// ---------------------------------------------------------------------------

/** The wrong animal: any adult within WRONGFUL_RADIUS of the file, weighted by closeness — no species weight at all. */
function pickWrongful(world, f, culprit) {
  const { cands, dists } = adultsWithin(world, f.tile, KNOBS.WRONGFUL_RADIUS, culprit);
  const weights = dists.map((d) => 1 / (1 + d));
  return weightedPick(world, cands, weights);
}

/** Beds taken at a centre — counted, never stored. */
export function bedsAt(world, i) {
  let n = 0;
  for (const c of world.citizens) if (!c.dead && c.heldAt === i && (c.held || 0) > world.tick) n++;
  return n;
}

/** The nearest centre with road access and a free bed, or −1. */
function centreWithBed(world, from) {
  const n = world.w * world.h;
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < n; i++) {
    if (world.civic[i] !== CIVIC.CENTRE || !hasAccess(world, i)) continue;
    if (bedsAt(world, i) >= KNOBS.CENTRE_BEDS) continue;
    const d = from >= 0 ? cheb(world, from, i) : 0;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

function exonerate(world, culprit, notices) {
  const ev = world.events;
  for (const a of ev.arrests) {
    if (!a.wrongful || a.exonerated || a.culpritId !== culprit.id) continue;
    a.exonerated = true;
    ev.justice.exonerated++;
    post(world, "compensation", -Math.min(KNOBS.COMPENSATION, Math.max(0, world.cash)));
    ev.active.push({ id: "namedMood", until: world.tick + KNOBS.NAMED_MONTHS, moodBoost: -KNOBS.NAMED_MOOD });
    const wronged = world.byId.get(a.citizenId);
    if (wronged) { wronged.exonerated = true; remember(world, wronged, KIND.EXONERATED, a.cause); }
    const first = a.name.split(" ")[0];
    const tail = wronged ? `There is no way to unfix ${first}.` : `${first} was sold; there is no way to unsell anyone.`;
    const line = `EXONERATED — ${a.name} was the wrong animal; ${nameOf(culprit)} was taken in today for the same ${a.cause}. The city pays §${KNOBS.COMPENSATION}. ${tail}`;
    ev.log.push({ t: world.tick, id: "exonerated", line, links: [...new Set([a.citizenId, culprit.id])] });
    notices.push(line);
  }
}

/**
 * Convict `c` for file `f`. Exported so the suite can force one. The sentence
 * table (the owner's rulings): a predator's first conviction → the centre;
 * prey, or anyone already fixed → the meat hall; no hall / no bed → the cells.
 */
export function arrest(world, f, c, wrongful, notices, opts = {}) {
  const ev = world.events;
  const tick = world.tick;
  f.closed = true;
  const culprit = world.byId.get(f.culpritId);
  c.record = (c.record || 0) + 1;
  remember(world, c, KIND.ARRESTED, f.cause);
  // A minor (trespass, SPEC §9c): the cells for a month and the record — until the record reaches RECORD_HARD, when the table applies.
  const minor = !!opts.minor && c.record < KNOBS.RECORD_HARD;
  if (wrongful) { c.wrongful = true; c.wrongedBy = f.culpritId; ev.justice.wrongful++; }
  ev.arrests.push({ tick, tile: f.tile, citizenId: c.id, name: nameOf(c), culpritId: f.culpritId, culpritName: culprit ? nameOf(culprit) : "", wrongful, cause: f.cause, exonerated: false, hard: !!opts.minor && !minor });
  if (ev.arrests.length > 200) ev.arrests.splice(0, ev.arrests.length - 200);
  if (!wrongful) exonerate(world, c, notices);
  const why = `for the ${f.cause} at ${at(world, f.tile)}`;
  const still = wrongful && culprit && !culprit.dead ? ` ${nameOf(culprit)} is still at ${at(world, culprit.home)}.` : "";
  const tail = wrongful ? ` ${c.name} was at home on Tuesday; it was the wrong animal.${still}` : "";
  const home = c.home;
  const diet = DIET_OF[c.species];
  const market = minor || !(c.fixed || diet === "herb") ? null : hallReach(world, home, KNOBS.MEAT_ROAD, { space: true });
  const hall = market?.hall ?? -1;
  let line;
  if (minor) {
    releaseJob(world, c);
    c.held = tick + KNOBS.TRESPASS_MONTHS;
    c.heldAt = -1;
    ev.justice.trespass++;
    const onWay = f.tile !== c.home && f.tile !== c.job;
    const months = KNOBS.TRESPASS_MONTHS === 1 ? "A month" : `${KNOBS.TRESPASS_MONTHS} months`;
    line = `TRESPASS — ${nameOf(c)} was stopped on ${USE_NAME[world.use[f.tile]]}-only ground at ${at(world, f.tile)}${onWay ? " on the way to work" : ", living where the line forbids"}. ${months} in the cells; offence ${c.record}${c.record === KNOBS.RECORD_HARD - 1 ? " — the next meets the sentence table" : ""}.`;
  } else if (hall >= 0) {
    const hh = world.hhById.get(c.household);
    const family = hh ? hh.members.filter((id) => id !== c.id) : [];
    const wasFixed = c.fixed;
    releaseJob(world, c);
    removeCitizen(world, c, "sold");
    for (const id of family) { const o = world.byId.get(id); if (o) o.grief = tick + 12; }
    post(world, "cut", KNOBS.SOLD_PRICE);
    receiveMeat(world, hall, "convicted", 1);
    ev.justice.sold++;
    line = `SOLD — ${nameOf(c)} was convicted ${why} and sold at the meat hall at ${at(world, hall)}.${wasFixed ? " Pacification is once." : ""}${tail}`;
  } else {
    const centre = centreWithBed(world, home);
    releaseJob(world, c);
    if (centre >= 0) {
      c.held = tick + KNOBS.PACIFY_MONTHS;
      c.heldAt = centre;
      ev.justice.takenIn++;
      line = `TAKEN IN — ${nameOf(c)} went from ${at(world, home)} to the Pacification Centre at ${at(world, centre)} ${why}. Six months.${tail}`;
    } else {
      c.held = tick + KNOBS.CELLS_MONTHS;
      c.heldAt = -1;
      ev.justice.cells++;
      line = `CELLS — ${nameOf(c)} is in the cells until ${monthName(tick + KNOBS.CELLS_MONTHS)} ${why}. No centre in town; ${c.name} comes home as ${c.name} went.${tail}`;
    }
  }
  const links = [...new Set([c.id, wrongful ? culprit?.id : null].filter(Number.isInteger))];
  ev.log.push({ t: tick, id: "arrest", line, links });
  notices.push(line);
  return line;
}

export function filesTick(world, cen, notices) {
  const ev = world.events;
  const tick = world.tick;
  for (const f of ev.files) {
    if (f.closed) continue;
    const culprit = world.byId.get(f.culpritId);
    if (!culprit || culprit.dead) { f.closed = true; continue; }
    if (tick >= f.opened + KNOBS.CASE_MONTHS) {
      f.closed = true;
      ev.justice.cold++;
      // A killing going cold is a headline (COLD is in TICKER_FLASH). A
      // burglary going cold is the record, not the news: it printed nothing at
      // all until session 8, so a mayor watched 101 of 116 files die in silence
      // and concluded, correctly, that nothing was being done. The line does
      // not start with a flashing prefix, so it lands in the reader and not
      // over the map.
      const line = f.cause === "killing"
        ? `COLD — the file on the ${f.cause} at ${at(world, f.tile)} closed without an arrest. ${nameOf(culprit)} is still at ${at(world, culprit.home)}.`
        : `The file on the ${f.cause} at ${at(world, f.tile)} closed after ${KNOBS.CASE_MONTHS} months. ${nameOf(culprit)} was never charged.`;
      ev.log.push({ t: tick, id: "cold", line, links: [culprit.id] });
      notices.push(line);
      continue;
    }
    if (tick <= f.opened || absent(world, culprit)) continue;
    // No station in town, nobody works it: the file lies open, stains the
    // street for FILE_MONTHS and goes cold. Every other town has a FORCE, and
    // the force works the case wherever it happened — reading only the scene's
    // cover made the cover term almost always zero, because a burglary picks a
    // lot with crime above CRIME_HIGH and crime is high exactly where the
    // police are not (97.4% of scenes dark at one station, 44.8% at four).
    const force = Math.min(1, cen.policeStations / KNOBS.ARREST_FORCE_N);
    if (force <= 0) continue;
    const p = KNOBS.ARREST_BASE + KNOBS.ARREST_FORCE * force + KNOBS.ARREST_COVER * world.policeCov[f.tile] / KNOBS.POLICE_EFFECT + KNOBS.ARREST_PRIOR * (culprit.record || 0);
    if (!world.rng.chance(Math.min(0.95, p))) continue;
    let wrongful = world.rng.chance(KNOBS.WRONGFUL_P);
    let target = culprit;
    if (wrongful) {
      const t = pickWrongful(world, f, culprit);
      if (t) target = t;
      else wrongful = false;
    }
    arrest(world, f, target, wrongful, notices);
  }
  ev.files = ev.files.filter((f) => f.until > tick);
}

// ---------------------------------------------------------------------------
// Custody expires
// ---------------------------------------------------------------------------

export function custodyTick(world, notices) {
  const ev = world.events;
  const tick = world.tick;
  for (const c of world.citizens) {
    // Pens mature in meat.penMaturityTick before justice. Keep this guard so
    // a direct custody tick can never turn a penned cub into an ordinary
    // released inmate at the exact expiry month.
    if (c.dead || c.pen || !c.held || c.held > tick) continue;
    const fromCentre = c.heldAt >= 0;
    c.held = 0;
    c.heldAt = -1;
    let line;
    if (fromCentre) {
      c.fixed = true;
      remember(world, c, KIND.FIXED);
      ev.justice.pacified++;
      const hh = world.hhById.get(c.household);
      if (hh) for (const id of hh.members) { const o = world.byId.get(id); if (o && o !== c) { o.moodPenalty = -KNOBS.RETURN_MOOD; o.moodPenaltyUntil = tick + KNOBS.RETURN_MONTHS; } }
      line = `HOME — ${nameOf(c)} is back at ${at(world, c.home)} from the centre, fixed. There will be no more ${c.surname} litters from that house.`;
    } else {
      line = `RELEASED — ${nameOf(c)} is home at ${at(world, c.home)} with a record.`;
    }
    ev.log.push({ t: tick, id: fromCentre ? "home" : "released", line, links: [c.id] });
    notices.push(line);
  }
}

/** One month of crime and punishment, after the events roll and before compact. */
/**
 * Trespass (SPEC §9c; the owner: "citizens could get arrested for being in
 * the wrong section if the road is not zoned for multi use"): each month,
 * every adult with exposure — forbidden walking tiles on the commute, or a
 * forbidding home or job — is stopped with probability p (fields.exposure:
 * no police cover, no arrest). The stop is on the spot: a file opened and
 * closed in the same call, never wrongful. Draws only where p > 0.
 */
export function trespassTick(world, cen, notices) {
  for (const c of world.citizens) {
    if (c.dead || c.home < 0 || absent(world, c)) continue;
    if (ageYears(world, c) < KNOBS.ADULT_AGE) continue;
    const x = exposure(world, c);
    if (x.p <= 0) continue;
    if (!world.rng.chance(x.p)) continue;
    const f = openFile(world, { tile: x.tile, culpritId: c.id, cause: "trespass", crime: KNOBS.TRESPASS_CRIME, radius: 1 });
    arrest(world, f, c, false, notices, { minor: true });
  }
}

export function justiceTick(world, cen) {
  const notices = [];
  custodyTick(world, notices);
  killingTick(world, cen, notices);
  burglaryTick(world, cen, notices);
  trespassTick(world, cen, notices);
  filesTick(world, cen, notices);
  return notices;
}
