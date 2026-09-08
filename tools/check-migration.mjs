// check-migration.mjs — the migration push's regressions (SPEC §7.2, §7.4), imported by check.mjs.
// The owner (2026-09-07): "migration should definitely be bidirectional. it should take more than
// just a fire for people to leave, it would have to be a combination of factors." Commit A: the two
// household fields (homed, burnedAt) and the tent before the road. Commit B: the push itself (SPEC §7.4
// PUSH) in place of friction. Every check names the claim it holds.
import { createWorld, ZONE } from "../js/sim/world.js";
import { KNOBS, RULES } from "../js/sim/rules.js";
import { save, load, stateHash } from "../js/sim/save.js";
import { createHousehold, placeHousehold, leaveScore, leaveChance, leaveProse, LEAVE_FACTORS } from "../js/sim/citizens.js";
import { apply } from "../js/sim/ops.js";
import { tick } from "../js/sim/tick.js";
import { legacyOf } from "../js/sim/legacy.js";
import { SPECIES_BY_ID } from "../js/sim/species.js";

export function checkMigration(check) {
  const town = (seed = "push") => {
    const w = createWorld({ seed, w: 32, h: 32 });
    for (const k of ["terrain", "road", "zone", "civic", "civicSize", "wall", "rail", "tier", "big", "rubble", "burning"]) w[k].fill(0);
    w.cash = 900000; w.roadsDirty = true; w.wallsDirty = true; w.events.noDisasters = true; // no fire but the one the fixture sets: a random fire on the spare cottage once gave a couple its third grievance (the smoke)
    apply(w, { kind: "road", tiles: Array.from({ length: 19 }, (_, k) => 10 * 32 + 2 + k) }); // y = 10, x = 2..20
    return w;
  };
  const lotAt = (w, x, y) => { const i = y * w.w + x; w.zone[i] = ZONE.R; w.tier[i] = 1; w.maxTier[i] = 1; return i; }; // a cottage that stays a cottage
  const family = (w, species, size, x, y) => { const i = lotAt(w, x, y); const hh = createHousehold(w, species, size); placeHousehold(w, hh, i); return { hh, lot: i, ids: hh.members.slice() }; };
  const households = (w) => w.households.filter((h) => !h.gone);
  const alive = (w, ids) => ids.every((id) => { const c = w.byId.get(id); return c && !c.dead; });
  const camping = (w, hh) => hh.home === -1 && w.campers.some((cp) => cp.householdId === hh.id);
  const withKnobs = (over, fn) => { const saved = {}; for (const k of Object.keys(over)) { saved[k] = KNOBS[k]; KNOBS[k] = over[k]; } try { return fn(); } finally { Object.assign(KNOBS, saved); } };
  const STILL = { LEAVE_P: 0, ARRIVE_GAIN: 0, WED_P: 0 }; // the fixtures below test the two fields and the tent, not the push: a jobless fixture family sits at the threshold, and at the knob's 0.05 it would leave; nobody arrives to take a cottage or befriend a single
  const run = (w, months) => withKnobs(STILL, () => { for (let t = 0; t < months; t++) tick(w); });

  // ---- SPEC §7.2: `homed` is the tick of the last real move; a put-back keeps it; the save carries it only when it says something ----
  {
    const w = town("roots"); // not "homed": the seed is in the save, and the check greps the save for the word
    const a = family(w, "rabbit", 2, 4, 9);
    const stampedOnArrival = a.hh.homed === w.tick && a.hh.homed === a.hh.arrived;
    const text = save(w);
    check("homed: an arriving household took its home the tick it arrived, and the save carries no `homed` for it", stampedOnArrival && !text.includes("\"homed\"") && !text.includes("burnedAt"), `homed ${a.hh.homed} arrived ${a.hh.arrived}`);
    const copy = load(text);
    check("homed: a town without the two fields hashes as it did across a save and a load, and every loaded household reads homed = arrived",
      stateHash(copy) === stateHash(w) && households(copy).every((h) => h.homed === h.arrived));
    run(w, 5);
    const at = w.tick;
    const spare = lotAt(w, 12, 9);
    w.rubble[a.lot] = 6; w.tier[a.lot] = 0; // the cottage burned down between months
    run(w, 1);
    const hh = w.hhById.get(w.byId.get(a.ids[0]).household);
    const moved = hh && hh.home === spare && hh.homed === at && hh.homed !== hh.arrived;
    const saved = save(w);
    const back = load(saved);
    const again = households(back).find((h) => h.members.includes(a.ids[0]));
    check("homed: a family rehomed from rubble is stamped with the tick of the move, the save carries it, and a load reads it back with the hash unchanged",
      moved && saved.includes("\"homed\":" + at) && again && again.homed === at && stateHash(back) === stateHash(w), `home ${hh?.home} (spare ${spare}) · homed ${hh?.homed} · at ${at} · arrived ${hh?.arrived}`);
    // Old saves: no `homed` at all → arrived.
    const plain = JSON.parse(saved);
    for (const h of plain.households) delete h.homed;
    const old = load(JSON.stringify(plain));
    check("homed: an old save with no `homed` loads every household as homed = arrived", households(old).every((h) => h.homed === h.arrived) && households(old).length === households(w).length);
    // A put-back on the same lot keeps the roots.
    const before = hh.homed;
    run(w, 3);
    for (const id of hh.members) { const c = w.byId.get(id); c.home = -1; w.occupants[spare]--; }
    hh.home = -1;
    placeHousehold(w, hh, spare, false);
    check("homed: a put-back on the same lot (moved = false) keeps the tick of the real move — the roots stand", hh.homed === before && hh.home === spare && w.occupants[spare] === hh.members.length, `homed ${hh.homed} was ${before}`);
    for (const id of hh.members) { const c = w.byId.get(id); c.home = -1; w.occupants[spare]--; }
    hh.home = -1;
    placeHousehold(w, hh, spare);
    check("homed: a real move stamps the current tick", hh.homed === w.tick && hh.homed !== before && w.occupants[spare] === hh.members.length, `homed ${hh.homed} tick ${w.tick}`);
  }
  // ---- SPEC §7.4: a burned-out family is rehomed and carries burnedAt; with nothing in reach it CAMPS, not removed; a home on fire stamps it too ----
  {
    const w = town("burned");
    const a = family(w, "rabbit", 3, 4, 9);
    const spare = lotAt(w, 12, 9);
    run(w, 2);
    const at = w.tick;
    w.rubble[a.lot] = 6; w.tier[a.lot] = 0;
    run(w, 1);
    const hh = w.hhById.get(w.byId.get(a.ids[0])?.household);
    check("burned: a family whose cottage is rubble is rehomed within reach and carries burnedAt = the tick it was lost",
      !!hh && hh.home === spare && hh.burnedAt === at && alive(w, a.ids) && a.ids.every((id) => hh.members.includes(id)), `home ${hh?.home} (spare ${spare}) · burnedAt ${hh?.burnedAt} · at ${at}`); // every one of the three, and any cub born since
    const text = save(w);
    const back = load(text);
    const again = households(back).find((h) => h.members.includes(a.ids[0]));
    check("burned: burnedAt survives a save and a load with the hash unchanged", text.includes("\"burnedAt\":" + at) && again?.burnedAt === at && stateHash(back) === stateHash(w));
    const v = town("burned-camp");
    const b = family(v, "mouse", 2, 4, 9); // the only cottage in town
    run(v, 2);
    const atV = v.tick;
    v.rubble[b.lot] = 6; v.tier[b.lot] = 0;
    run(v, 1);
    const bh = v.hhById.get(v.byId.get(b.ids[0])?.household);
    const archived = b.ids.some((id) => legacyOf(v, id));
    check("burned: with nothing in reach the family pitches a TENT — alive, camping, in no archive — and carries burnedAt (a fire alone moves nobody out of town)",
      !!bh && camping(v, bh) && alive(v, b.ids) && !archived && bh.burnedAt === atV, `home ${bh?.home} · camping ${bh ? camping(v, bh) : "—"} · archived ${archived} · burnedAt ${bh?.burnedAt}`);
    const u = town("burning");
    const c = family(u, "fox", 2, 4, 9);
    run(u, 2);
    const atU = u.tick;
    u.burning[c.lot] = 3; // on fire, still standing
    run(u, 1);
    const ch = u.hhById.get(u.byId.get(c.ids[0])?.household);
    check("burned: a home on fire but standing keeps its family and stamps burnedAt the same month", !!ch && ch.home === c.lot && ch.burnedAt === atU && alive(u, c.ids), `home ${ch?.home} (lot ${c.lot}) · burnedAt ${ch?.burnedAt} · at ${atU}`);
  }
  // ---- SPEC §7.4 PUSH: the knobs, the score, the prose, the card ----
  const PUSH = { LEAVE_P: 1, ARRIVE_GAIN: 0, WED_P: 0 }; // the push at certainty, nobody arriving, nobody marrying
  const CALM = { ...PUSH, CRIME_HIGH: 1000 }; // and no crime grievance: an unpoliced fixture lot crosses CRIME_HIGH within the year, a second grievance the one-grievance claims must hold off
  const single = (w, species, x, y) => family(w, species, 1, x, y);
  const retire = (w, ids) => { for (const id of ids) { const c = w.byId.get(id); c.born = w.tick - 12 * SPECIES_BY_ID[c.species].retire; c.deathAge = 100000; } }; // elders: no job to lose and no work to want, so the grievances under test are the only ones — a fixture shop decays within the year and takes its jobs with it
  const adultsOf = (w, hh) => hh.members.map((id) => w.byId.get(id)).filter((c) => c && !c.dead);
  const moved = (w) => w.events.log.filter((r) => typeof r.line === "string" && r.line.startsWith("MOVED AWAY — ")).map((r) => r.line);
  const left = (w, ids) => ids.every((id) => !w.byId.get(id) && legacyOf(w, id)?.cause === "left");
  {
    check("push: FRICTION_P is gone and the nine knobs hold the ruled values — threshold 3, 0.05 a point a month, acute 2, chronic 1, mood 40, tax +1, a burned home for 12 months, roots by 3 years (scoped at 10, set at 3 when the estate drained), a town-born adult halves",
      !("FRICTION_P" in KNOBS) && KNOBS.LEAVE_THRESH === 3 && KNOBS.LEAVE_P === 0.05 && KNOBS.LEAVE_W_ACUTE === 2 && KNOBS.LEAVE_W_CHRONIC === 1 && KNOBS.LEAVE_MOOD_LOW === 40 && KNOBS.LEAVE_TAX_OVER === 1 && KNOBS.LEAVE_BURNED_MONTHS === 12 && KNOBS.LEAVE_ROOTS_YEARS === 3 && KNOBS.LEAVE_NATIVE_DAMP === 0.5);
    check("push: the line names the reasons in order — \"no work, no friends and low spirits\"; one reason stands alone",
      leaveProse(["unemployed", "friendless", "lowMood"]) === "no work, no friends and low spirits" && leaveProse(["burned"]) === "the fire" && leaveProse(["crime", "smoke", "dread", "crowded", "taxed"]) === "the crime, the smoke, the dread, the crowding and the taxes" && LEAVE_FACTORS.length === 9);
    const card = RULES.find((r) => r.id === "C5");
    const w = town("card");
    single(w, "rabbit", 4, 9);
    run(w, 1);
    const live = card ? card.live(w) : "";
    check("push: card C5 says moving away takes a combination, and its live line reads who left last tick and who sits at the threshold now",
      !!card && card.title === "Moving away takes a combination" && /nothing under 3 moves anyone/.test(card.formula) && /^0 left last tick · 1 household at the threshold now$/.test(live), live);
  }
  {
    // The score, read where it is made: an unemployed friendless single at mood 50 is 3; the weights are knobs; a camping household reads only the five that need no lot.
    const w = town("score");
    const a = single(w, "rabbit", 4, 9);
    const s0 = leaveScore(w, a.hh);
    const s1 = withKnobs({ LEAVE_W_ACUTE: 5, LEAVE_W_CHRONIC: 2 }, () => leaveScore(w, a.hh));
    check("push: an unemployed friendless single scores 3 (no work 2, no friends 1) and the weights are read from the knobs",
      !!s0 && s0.score === 3 && s0.reasons.join(",") === "unemployed,friendless" && s1.score === 7, `${s0?.score} [${s0?.reasons}] · at 5/2: ${s1?.score}`);
    const c = w.byId.get(a.ids[0]);
    c.friends.push(-1); // a friend nobody checks here: friendless off
    const s2 = leaveChance(w, a.hh);
    c.friends.length = 0;
    check("push: with a friend the single scores 2 — under the threshold, p = 0", !!s2 && s2.score === 2 && s2.p === 0, `${s2?.score} p ${s2?.p}`);
  }
  {
    // (c) ROOTS: p a third at twenty years in the home, half again with a town-born adult, and the years knob is read.
    const w = town("roots-c");
    const a = single(w, "fox", 4, 9);
    const c = w.byId.get(a.ids[0]);
    c.mood = 20; // no work 2 + no friends 1 + low spirits 1 = 4 → p = 0.05 · 2 · roots
    const fresh = leaveChance(w, a.hh);
    a.hh.homed = w.tick - 240;
    const twenty = leaveChance(w, a.hh);
    c.native = true;
    const native = leaveChance(w, a.hh);
    const knob = withKnobs({ LEAVE_ROOTS_YEARS: 20 }, () => leaveChance(w, a.hh));
    const near = (x, y) => Math.abs(x - y) < 1e-12;
    const damp = 1 / (1 + 20 / KNOBS.LEAVE_ROOTS_YEARS); // 3/23 at the knob's 3 years
    check("push: roots — twenty years in the home damps p by 1/(1 + 20/LEAVE_ROOTS_YEARS), a town-born adult halves it again, and the knob is read where the damp is made (at 20 years for 20, a half)",
      !!fresh && fresh.score === 4 && near(fresh.p, 0.1) && near(twenty.p, fresh.p * damp) && near(native.p, fresh.p * damp * KNOBS.LEAVE_NATIVE_DAMP) && near(knob.p, fresh.p / 4) && damp < 0.2, `p ${fresh?.p} · twenty years ${twenty?.p} (damp ${damp.toFixed(4)}) · native ${native?.p} · knob 20 ${knob?.p}`);
  }
  {
    // (a) ONE GRIEVANCE NEVER MOVES ANYONE: a friendless retired single stays two years at LEAVE_P 1.
    const w = town("one");
    const a = single(w, "rabbit", 4, 9);
    retire(w, a.ids);
    let max = 0, gone = 0, counted = 0;
    withKnobs(CALM, () => { for (let t = 0; t < 24; t++) { tick(w); gone += w.last.left; counted += w.last.atThreshold; const s = leaveScore(w, a.hh); if (s) max = Math.max(max, s.score); } });
    const c = w.byId.get(a.ids[0]);
    check("push: (a) a friendless retired single (one grievance) stays two years at LEAVE_P 1 — one thing wrong moves nobody, and the tick never counts it at the threshold",
      gone === 0 && !!c && !c.dead && c.friends.length === 0 && max === 1 && counted === 0 && households(w).length === 1 && moved(w).length === 0, `left ${gone} · friends ${c?.friends.length} · max score ${max} · counted at threshold ${counted}`);
    // A burned-out family with work and friends (two grievances, the fire acute) stays a year at LEAVE_P 1.
    const v = town("fire-alone");
    const b = family(v, "rabbit", 2, 4, 9);
    const spare = lotAt(v, 12, 9);
    retire(v, b.ids);
    const [p1, p2] = adultsOf(v, b.hh);
    p1.friends.push(p2.id); p2.friends.push(p1.id);
    run(v, 2);
    v.rubble[b.lot] = 6; v.tier[b.lot] = 0;
    run(v, 1);
    const bh = v.hhById.get(v.byId.get(b.ids[0])?.household);
    const first = bh ? leaveScore(v, bh) : null;
    let maxV = 0, goneV = 0;
    withKnobs(CALM, () => { for (let t = 0; t < 11; t++) { tick(v); goneV += v.last.left; const s = bh && !bh.gone ? leaveScore(v, bh) : null; if (s) maxV = Math.max(maxV, s.score); } });
    const stillBurned = bh && !bh.gone ? leaveScore(v, bh)?.f.burned : null; // twelve months on from the fire: the last month it counts
    withKnobs(CALM, () => { tick(v); goneV += v.last.left; });
    const expired = bh && !bh.gone ? leaveScore(v, bh)?.f.burned : null; // thirteen: it does not
    check("push: (a) a burned-out retired couple who are friends — the fire alone, two points — is rehomed and stays the year at LEAVE_P 1; the fire counts for twelve months and then it does not",
      !!bh && bh.home === spare && !!first && first.f.burned && first.score === 2 && goneV === 0 && alive(v, b.ids) && maxV === 2 && moved(v).length === 0 && stillBurned === true && expired === false, `home ${bh?.home} (spare ${spare}) · first [${first?.reasons}] ${first?.score} · left ${goneV} · max ${maxV} · burned at 12 months ${stillBurned}, at 13 ${expired}`);
  }
  {
    // (b) THREE MOVES: no work + no friends + low spirits leaves at LEAVE_P 1, and the line says so; the archive keeps "left"; the walker layer gets the departure.
    const w = town("three");
    const a = single(w, "rabbit", 4, 9);
    const c = w.byId.get(a.ids[0]);
    const name = `${c.name} ${c.surname}`, surname = c.surname;
    c.mood = 20;
    withKnobs(PUSH, () => tick(w));
    const lines = moved(w);
    check("push: (b) no work, no friends and low spirits (four points) leaves the first month at LEAVE_P 1; the line reads the reasons and the address; the tick counts it; the archive says left town; the departure record carries the score and the reasons as decided",
      households(w).length === 0 && w.last.left === 1 && left(w, a.ids) && lines.length === 1 && lines[0] === `MOVED AWAY — the ${surname}${surname.endsWith("s") ? "es" : "s"} (rabbit) left (4,9): no work, no friends and low spirits.` && w.departures.some((d) => d.surname === surname && d.n === 1 && d.from === a.lot && d.score === 4 && d.reasons.join(",") === "unemployed,friendless,lowMood") && /left town/.test(legacyOf(w, a.ids[0])?.cause ? `${name} left town` : ""),
      `${households(w).length} households · left ${w.last.left} · ${lines[0] || "no line"}`);
  }
  {
    // (d) A BURNED-OUT CAMPING FAMILY with no work leaves within the year at LEAVE_P 1 — the tent's five — and a tent's line says so.
    const v = town("tent-leaves");
    const b = family(v, "mouse", 2, 4, 9); // the only cottage in town
    run(v, 2);
    v.rubble[b.lot] = 6; v.tier[b.lot] = 0;
    run(v, 1);
    const bh = v.hhById.get(v.byId.get(b.ids[0])?.household);
    v.crime.fill(100); v.pol.fill(100); v.dread.fill(100); // the map on fire, for all a tent reads of it
    const s = bh ? leaveScore(v, bh) : null;
    const tentOnly = !!s && ["crime", "smoke", "dread", "crowded"].every((k) => s.f[k] === false) && s.f.burned && s.f.unemployed;
    let months = 0;
    withKnobs(PUSH, () => { for (let t = 0; t < 12 && households(v).length; t++) { tick(v); months++; } });
    const line = moved(v)[0] || "";
    check("push: (d) a camping family reads only the five that need no lot, and burned out with no work it leaves within the year at LEAVE_P 1 — the line says it left its tent, and names the fire",
      camping(v, bh) === false && tentOnly && households(v).length === 0 && left(v, b.ids) && months <= 12 && / left their tent: /.test(line) && /the fire\.$/.test(line) && v.campers.every((cp) => cp.householdId !== bh.id),
      `tent-only ${tentOnly} [${s?.reasons}] · months ${months} · ${line || "no line"}`);
  }
  {
    // LEAVE_P 0: households at the threshold, a year, nobody leaves — nothing draws under the knob; the card counts them.
    const w = town("zero");
    for (let k = 0; k < 4; k++) single(w, k % 2 ? "rabbit" : "mouse", 3 + 3 * k, k % 2 ? 9 : 11);
    let gone = 0;
    withKnobs({ ...PUSH, LEAVE_P: 0 }, () => { for (let t = 0; t < 12; t++) { tick(w); gone += w.last.left; } });
    check("push: at LEAVE_P 0 four households at the threshold stay the year, and the tick counts four at the threshold", gone === 0 && households(w).length === 4 && w.last.atThreshold === 4 && moved(w).length === 0, `left ${gone} · at threshold ${w.last.atThreshold}`);
  }
  {
    // (f) CONTINUATION: the push reads nothing but saved state — a save at six months and a straight run agree at twelve, departures included.
    const straight = town("continue-push"), split = town("continue-push");
    for (const w of [straight, split]) for (let k = 0; k < 8; k++) single(w, k % 3 === 0 ? "mouse" : k % 3 === 1 ? "rabbit" : "cat", 3 + 2 * k, k % 2 ? 9 : 11);
    let mid = null;
    withKnobs({ ...PUSH, LEAVE_P: KNOBS.LEAVE_P }, () => { // the knob's own 0.05: some go, some stay, and the reload keeps drawing
      for (let t = 0; t < 12; t++) tick(straight);
      for (let t = 0; t < 6; t++) tick(split);
      mid = load(save(split));
      for (let t = 0; t < 6; t++) tick(mid);
    });
    const gone = moved(straight).length;
    check("push: (f) a city saved at six months and continued hashes as the straight run at twelve, with households leaving under the push in both",
      stateHash(mid) === stateHash(straight) && gone >= 1 && households(straight).length >= 1 && moved(mid).length === gone, `${gone} left, ${households(straight).length} stayed · ${stateHash(mid)} vs ${stateHash(straight)}`);
  }
}
