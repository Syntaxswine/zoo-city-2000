// check-migration.mjs — the migration push's regressions (SPEC §7.2, §7.4), imported by check.mjs.
// The owner (2026-09-07): "migration should definitely be bidirectional. it should take more than
// just a fire for people to leave, it would have to be a combination of factors." Commit A: the two
// household fields (homed, burnedAt) and the tent before the road. Every check names the claim it holds.
import { createWorld, ZONE } from "../js/sim/world.js";
import { save, load, stateHash } from "../js/sim/save.js";
import { createHousehold, placeHousehold } from "../js/sim/citizens.js";
import { apply } from "../js/sim/ops.js";
import { tick } from "../js/sim/tick.js";
import { legacyOf } from "../js/sim/legacy.js";

export function checkMigration(check) {
  const town = (seed = "push") => {
    const w = createWorld({ seed, w: 32, h: 32 });
    for (const k of ["terrain", "road", "zone", "civic", "civicSize", "wall", "rail", "tier", "big", "rubble", "burning"]) w[k].fill(0);
    w.cash = 900000; w.roadsDirty = true; w.wallsDirty = true;
    apply(w, { kind: "road", tiles: Array.from({ length: 19 }, (_, k) => 10 * 32 + 2 + k) }); // y = 10, x = 2..20
    return w;
  };
  const lotAt = (w, x, y) => { const i = y * w.w + x; w.zone[i] = ZONE.R; w.tier[i] = 1; w.maxTier[i] = 1; return i; }; // a cottage that stays a cottage
  const family = (w, species, size, x, y) => { const i = lotAt(w, x, y); const hh = createHousehold(w, species, size); placeHousehold(w, hh, i); return { hh, lot: i, ids: hh.members.slice() }; };
  const households = (w) => w.households.filter((h) => !h.gone);
  const alive = (w, ids) => ids.every((id) => { const c = w.byId.get(id); return c && !c.dead; });
  const camping = (w, hh) => hh.home === -1 && w.campers.some((cp) => cp.householdId === hh.id);

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
    for (let t = 0; t < 5; t++) tick(w);
    const at = w.tick;
    const spare = lotAt(w, 12, 9);
    w.rubble[a.lot] = 6; w.tier[a.lot] = 0; // the cottage burned down between months
    tick(w);
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
    for (let t = 0; t < 3; t++) tick(w);
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
    for (let t = 0; t < 2; t++) tick(w);
    const at = w.tick;
    w.rubble[a.lot] = 6; w.tier[a.lot] = 0;
    tick(w);
    const hh = w.hhById.get(w.byId.get(a.ids[0])?.household);
    check("burned: a family whose cottage is rubble is rehomed within reach and carries burnedAt = the tick it was lost",
      !!hh && hh.home === spare && hh.burnedAt === at && alive(w, a.ids) && a.ids.every((id) => hh.members.includes(id)), `home ${hh?.home} (spare ${spare}) · burnedAt ${hh?.burnedAt} · at ${at}`); // every one of the three, and any cub born since
    const text = save(w);
    const back = load(text);
    const again = households(back).find((h) => h.members.includes(a.ids[0]));
    check("burned: burnedAt survives a save and a load with the hash unchanged", text.includes("\"burnedAt\":" + at) && again?.burnedAt === at && stateHash(back) === stateHash(w));
    const v = town("burned-camp");
    const b = family(v, "mouse", 2, 4, 9); // the only cottage in town
    for (let t = 0; t < 2; t++) tick(v);
    const atV = v.tick;
    v.rubble[b.lot] = 6; v.tier[b.lot] = 0;
    tick(v);
    const bh = v.hhById.get(v.byId.get(b.ids[0])?.household);
    const archived = b.ids.some((id) => legacyOf(v, id));
    check("burned: with nothing in reach the family pitches a TENT — alive, camping, in no archive — and carries burnedAt (a fire alone moves nobody out of town)",
      !!bh && camping(v, bh) && alive(v, b.ids) && !archived && bh.burnedAt === atV, `home ${bh?.home} · camping ${bh ? camping(v, bh) : "—"} · archived ${archived} · burnedAt ${bh?.burnedAt}`);
    const u = town("burning");
    const c = family(u, "fox", 2, 4, 9);
    for (let t = 0; t < 2; t++) tick(u);
    const atU = u.tick;
    u.burning[c.lot] = 3; // on fire, still standing
    tick(u);
    const ch = u.hhById.get(u.byId.get(c.ids[0])?.household);
    check("burned: a home on fire but standing keeps its family and stamps burnedAt the same month", !!ch && ch.home === c.lot && ch.burnedAt === atU && alive(u, c.ids), `home ${ch?.home} (lot ${c.lot}) · burnedAt ${ch?.burnedAt} · at ${atU}`);
  }
}
