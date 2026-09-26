# HANDOFF — the meat market as a placeable 3×3, and four looks (2026-09-25)

*For whoever takes any of these, in whatever order the owner chooses.
**Nothing in this file is built.** Every number and line reference below is
true of the commit that added this file (its parent is `4e59dca`, 2026-09-25)
— re-read a line before you trust it.*

## What was asked

The owner asked, on 2026-09-24, *"do you have any visual changes that you would
like to see?"* I offered four, ranked, and two questions. Their answer:

> *"write a handoff so they can all be addressed in due course.*
>
> *i have one other change not listed. i want to change the meat market into a
> placeable 3x3 for light and high density. the models need to be redesigned.
> i'd like a few variations. so thats a coding and aesthetics change."*

The items are not equal, and the difference matters to whoever picks one up:

- **M — the meat market — is the OWNER'S.** It is a sim change, an art
  redesign and a save question, and it reverses a ruling the owner made when
  the meat zone was designed (M.2). The owner answered five of **M.4**'s six
  questions the same day; two remain open, and nothing is built until they are
  answered. It is the first item since the sprite arc began
  that must touch `js/sim/` — that arc's law 7 (*"if an art change needs a sim
  field, it is not an art change"*) puts it outside the arc, with a sim
  change's discipline.
- **L1–L4 — the four looks — are MINE**, offered when asked. The owner has
  ruled on none of them. Each is a proposal to show before it is built, and L3
  is taste. None touches `js/sim/`.
- **Qz and Q1′ are questions** that decide the order of work already on the
  list in [the sprites brief](HANDOFF-THE-SPRITES-2026-09-23.md) (T4.1, and Q1).

## The ledger

| | what | whose | code | art | `js/sim/` | first step | waits on |
|---|---|---|---|---|---|---|---|
| **M** | the meat market becomes a placeable 3×3 that grows, Light or High by the brush, redesigned, one sprite per stage of growth | the owner's | yes | yes | **yes** | a proposal with M.4's answers and numbers | M.4's questions 4 and 7 |
| **L1** | the one-box factories get a roofline — sawtooth, stacks, tanks | mine | a part moves | yes | no | move the parts into the kit, byte-identical | taste |
| **L2** | street lamps that come on at dusk | mine | render | yes | no | a sheet of where they would stand | whether a lamp throws a pool |
| **L3** | shirts that say where an animal works | mine | a draw-time read | yes | no (reads only) | measure each shirt against every coat, before drawing one | **the owner** |
| **L4** | an earth edge under the map's two front sides | mine | render | small | no | a before/after | taste |
| **Qz** | which zoom does the owner play at? | a question | — | — | — | ask | the owner |
| **Q1′** | answer Q1 — how long is the shadow — on a dense block, not open grass | a question | a rig | — | no | `shadow-sheet` on the estate layout | the owner |

My order, if nobody says otherwise: **M** (it is the owner's), then **L1**, **L2**,
**L3**, **L4**. Ask **Qz** before anyone starts T4.1.

---

## M — the meat market as a placeable 3×3

### M.1 What it is today

**A drag zone that grows.** `ZONE.M` = 4 ([world.js:15](../js/sim/world.js)),
tool row 4, key `4`, *"zone meat market (drag) — grey, off the books"*
([tools.js:16](../js/tools.js)), §12 a tile (`COST.zoneM`,
[rules.js:202](../js/sim/rules.js)). A meat lot climbs three tiers, each one
tile (rules.js:244, :257, :261–262, :274; the names at ui.js:400 and
[buildings.js:696](../js/art/buildings.js)):

| tier | name | jobs | pen places | dread (radius) | crime hill |
|---|---|---|---|---|---|
| 1 | stall | 3 | 2 | 40 (2) | 10 |
| 2 | meat hall | 8 | 4 | 70 (3) | 18 |
| 3 | cold store | 16 | 8 | 105 (4) | 25 |

Past tier 3, High lots merge: a 2×2 **abattoir** or **stock court** (80 jobs),
then a 3×3 **meat exchange** or **stock court** (180 jobs; `BIG_BONUS` 1.25,
rules.js:72; `sim/blocks.js`). The 3×3 is *grown*, never placed, and there is
no meat landmark (sim/landmarks.js:47–57). Grown, it is still nine zoned
tiles: each emits its own dread and crime (fields.js:229–251, :559–567), and
the whole block holds the same 40 units of stock a stall does (`MEAT_CAP`,
meat.js:109–116).

**The density brush is the cap.** The zone op writes `maxTier` 1 or 3
(ops.js:473–478) and meat ignores land value (lots.js:66), so the brush alone
decides. **Low is a stall forever** — it can never merge, because `joinable`
wants `maxTier` 3 (sim/blocks.js:51–54). **High** climbs to the cold store and
merges. High meat waits for Chapter 5, where every other zone's High opens at
Chapter 3 ([progression.js:25–27](../js/sim/progression.js)); Low meat is open
from the start (`UNLOCK.M: 0`, :17).

**A hall is a zone and a tier, not a building.** `isHall` is an anchor in zone
M at tier > 0, not rubble or burning, with the trade not prohibited
([meat.js:101–106](../js/sim/meat.js)). It is the only single hall test: about
25 modules test `zone === ZONE.M` for themselves (M.5). The design is SPEC §9c
and *Meat on hand*, with the owner's words that started it.

**What it looks like.** Twenty-six sprites (`docs/fixtures/art-baseline.txt`
:192–217): `M1-stall`, `M2-meat-hall` and `M3-cold-store`, six each; the 2×2
and 3×3 blocks, four each. The bottom three rows of
[`sheet-buildings.png`](shots/sheet-buildings.png) — red brick, striped
awnings, a rust stack, and the dark slate roof that says *meat* (`M_ROOF`,
buildings.js:73; T2.2's rule, the roof says the zone).

### M.2 Why it is a zone — what the owner is changing

The design that built it chose a zone on purpose
([PROPOSAL-CRIME-AND-PUNISHMENT.md](PROPOSAL-CRIME-AND-PUNISHMENT.md), Part I,
:74–76):

> *"The owner said zoned. A zone gets drag, undo, density, the tier ladder,
> decay, the WHY NOT line and the art audit for free; a placed civic gets
> none of them."*

It also got its own demand valve, because riding the shops' valve failed when
measured: V_C is negative for 26 of the baseline town's 30 years, and 48 meat
jobs counted as shop jobs push rC from −0.15 to −0.27, *"starving real shops"*
(:76–81).

The owner is changing their own ruling, which is theirs to change. That list
is now the work: each thing rebuilt for the placeable, or dropped on purpose
and said so.

| the zone got it free | a placed civic today | so |
|---|---|---|
| drag | a click ([input.js:119–122](../js/input.js)) | fine |
| undo | civics have the same-month undo ([ops.js:366–373](../js/sim/ops.js)) | fine |
| density | a place op carries none (input.js:120, :139) | the H brush reaches the place op (M.4, answer 2) |
| the tier ladder | a civic has no tier | **kept** — the market grows (M.4, answer 3) |
| decay, fire, the raid's shut storey | civics never decay, burn or lose a storey (fire starts on built lots only, events.js:62–65; the raid is `lowerTier`, :31–38) | rebuilt on the market's own tier, since it has one |
| the WHY NOT line | `lotReport` is for lots (lots.js:241–297) | a card line for the market |
| the art audit | the civic one — three layouts a family (`check-building-variants`) | fine |
| its own valve | **civic jobs count as shop jobs** (`jobZone`, [world.js:441–447](../js/sim/world.js)) | keep hall jobs in Jm, or the failure measured above comes back |

### M.3 What a placeable 3×3 is in this code

Read from the Governor's Mansion, the last 3×3 added — `65ccac9`, 2026-09-13,
31 files (the hospital `6e36109`, sanitation `422acc8` and the university
`b25af3b` before it):

- **A click, not a drag.** `clickOp` makes `{ kind, tx, ty }` — no density,
  rotation or variant. The hovered tile is the footprint's min corner, and it
  grows toward +tx, +ty (ops.js:255–256).
- **`costOf` refuses in order:** the chapter lock, campers, one-per-city, any
  tile that is water, road, zone, civic, wall, rail or built, and — for every
  kind but the parks and the cemetery — a footprint that touches no road
  (ops.js:165–266; `touchesRoad`, fields.js:150–154).
- **One anchor owns it.** The anchor gets a civic id and `civicSize`; the
  eight parts point at it (ops.js:514–520). Civic ids are append-only —
  `GOVERNOR` 19 is the last, so the next is 20 (world.js:16–18). Jobs are a
  table by civic id, `civicJobs` (world.js:33–50), offered at the anchor only.
- **Variations are the map's, not the player's.** A civic's layout is
  `family[world.variant[anchor] % family.length]`
  ([buildings.js:983–996](../js/art/buildings.js)). `world.variant` is hashed
  from the tile and the seed when the world is made
  ([world.js:139](../js/sim/world.js)), saved, and never written again. **Every
  civic family has exactly three layouts** — `check-building-variants.mjs:9`
  asserts it. The market's sprites are its stages of growth instead (M.4,
  answer 3), so that check has to learn a family that grows.
- **Density is a zones-only idea.** The civic branch never reads it
  (ops.js:251–267). No placeable has a light and a heavy form — the pairs that
  exist are separate kinds, tools and ids (park / large park, library /
  university, doctor / hospital). The one tile byte that already means *a
  density cap* is `maxTier`, and a civic placement leaves it alone.
- **Everything the recipe touches**, from `65ccac9` and in order: world.js
  (the id, `CIVIC_SIDE`, `CIVIC_OF_KIND`, `civicJobs`, `isCivicEmployer`),
  rules.js (`COST`), ops.js (three kind lists, :170, :251, :514), progression.js
  (`UNLOCK`), budget.js and ui.js (upkeep, the Budget lines, the card),
  tools.js (the row and `PLACE_TOOLS`), remote-icons.js (the palette icon),
  render.js (the draw branch), an art module registered in art/index.js,
  `review-building-variants.mjs`, check.mjs's Part P pins, a feature check in
  `npm run check` — and, since `abf08bd`, `art-baseline.txt` via
  `node tools/art-dump.mjs --write` in the same commit.

### M.4 The owner's answers, and the two still open

Six questions went to the owner; each carried my lean. They answered five
on 2026-09-25, in these words:

> *"1 yes*
>
> *2 yes, one tool.*
>
> *3 the reason for multiple sprites is to show the growth of the market.*
>
> *5 same cost as zoning a lone tile of the previous one*
>
> *6 it will break the saves, but thats ok, the player base is basically me."*

| # | the question | the answer | what it settles |
|---|---|---|---|
| 1 | Does meat zoning go away entirely? | *"yes"* | Row 4 becomes the placeable and keeps key `4` (no other letter or digit is free). Nothing writes `zone = ZONE.M` any more. |
| 2 | One tool, with H choosing Light or High? | *"yes, one tool"* | The brush chooses the form when the market is placed. High still waits for Chapter 5, so the lock must read a place op. The form lives in the anchor's `maxTier`, so no new save field. |
| 3 | Does a placed market grow, or open at full size? | *"the reason for multiple sprites is to show the growth of the market"* | **It grows**, as trade allows, capped by its form. The tier ladder stays, and with it decay, the raid's shut storey, the why-not line and the valve's say. **The several sprites are the stages of growth.** That is how the first ask's *"a few variations"* now reads; alternate looks for a single stage were not asked for. |
| 5 | Who pays? | *"same cost as zoning a lone tile of the previous one"* | **§12** (`COST.zoneM`) for the whole 3×3, not the §108 I suggested. Nothing was said against the rest of my lean, so it stays privately run with no upkeep. The cut, the licence and the raid are unchanged. |
| 6 | What happens to saves that have meat halls? | *"it will break the saves, but thats ok, the player base is basically me"* | No migration and no legacy code path are owed. What a meat save should do when loaded is in M.8. |

**Still open — these two go back to the owner, with my recommendations:**

- **4. How much market is a 3×3?** (Not answered.) I recommend that at every
  stage it be exactly what today's zone puts on nine tiles:
  - jobs of 27 / 72 / 180 — nine stalls, then nine halls, then the grown
    exchange with its ×1.25;
  - stock of 40 and pens of 2 / 4 / 8, as one hall, which is what a grown
    block has today;
  - dread and crime from all nine tiles at the market's stage, as a grown
    block gives off today.

  That is the same land, jobs and smell the zone had, so the valve SPEC §9c
  measured still holds, and M.7 step 5 measures it. On that valve a town of
  1,600 wants about 72 meat jobs: one market at the hall stage.
- **7. Does a Light market grow?** New: this is where answers 2 and 3 meet.
  Low meat today never grows past a stall.
  - (a) Light is the first stage and stops there, while High carries on
    through the hall and the cold store. That is three stage sprites in all,
    and the brush means what it means for every zone — *"Low (cottages
    only)"*, as the H key says (input.js:326).
  - (b) Each form has its own ladder: an open-air market that fills out, and
    a hall that grows. That is six sprites.

  **I recommend (a).**

### M.5 What reads the meat zone — the blast radius

About 25 modules test `world.zone[i] === ZONE.M` directly; `grep -rn "ZONE.M"
js tools` is the list to walk:

| where | what reads meat today | what a placed market asks |
|---|---|---|
| `sim/meat.js` | `isHall` :101–106; `hallStock` and `hallCapacity` :109–116; `penCapacity` by tier :151–153; `hallReach` :207–232; `closeHall` :313–329; `normalizeStock`, block consolidation :364–393 | one hall test, re-keyed to the market's anchor and form |
| `sim/world.js` | `capacityOf` / `jobsOf` — `M_JOBS` × the block multiplier :422–423, :436–437; `jobZone` :441–447; the civic tables :16–50 | a civic id, jobs by form, **jobs kept in Jm** |
| `sim/fields.js` | `computeDread` :229–251 and the crime hill :559–567, from every meat tile by tier; `doorsOf` :775–777 (via `siteTiles` — works for civics as it is) | a source for a civic |
| `sim/ops.js` | zoning :180–190, :473–478; bulldoze counts stock and pens :227–237 and calls `closeHall` :502–506; prohibition closes halls :408–415; civic placement :251–267, :514–520; `removeCivic` :593–602 | density in the place op; **`removeCivic` must close the hall** (M.8) |
| `sim/lots.js`, `sim/blocks.js` | the M valve and `local_M` :98–113; the merge :171–183 and `joinable` blocks.js:51–54; decay :224–233; `lotReport` :241–297 | the market's growth, on its own tier (M.4, answer 3) |
| `sim/events.js` | the raid :299–316 via `lowerTier` :31–38; the licence offer, a tier-2 served meat lot :525–537; `raidable` and `firstHall` :351–359; fire on built lots :62–65, :80–88 | a raid, a licence and a fire for a civic — or none |
| `sim/justice.js` | `KILL_MARKET` :120; `KILL_STAFF` when `zone[c.job] === ZONE.M` :121; the killing's hall and sack :134–162; the sale :373–388, :425–434 | re-keyed to the hall test |
| `sim/census.js`, `budget.js`, `demand.js`, `needs.js`, `voice.js`, `governance.js`, `police-actions.js`, `tick.js` | each its own zone test: `markets` and Jm (census :155, :207–215), the cut and the licence (budget :44–113), `r.M` (demand :62–105), the HOOKS need (needs :81–84), the advisor (tick :242–285) | every one re-keyed |
| `sim/citizens.js` | `JOB_M`, hiring by diet on `zone[lot] === ZONE.M` :1470–1471; dread in home score, mood, leaving and rehome :279–282, :753, :945–962, :1287–1295; the market's push and pull on arrivals :648–653 | the hiring test re-keyed |
| `sim/progression.js` | `UNLOCK.M: 0` :17; High meat at Chapter 5, for zone ops only :25–27 | the lock for a place op |
| `sim/save.js` | the tile arrays :20; `meatStats` keyed by anchor :83, :162; citizens' `pen`, `penSince`, `heldAt` :31–38; `releaseOrphanJobs` on every load :174, :246–256 | nothing owed to old saves (M.4, answer 6); see M.8 for loading one |
| `tools.js`, `input.js`, `palette.js`, `remote-icons.js` | row 4; density :26, :98–99, :139–140; the H flash that names meat halls :322–327; the icon | a place row, its id equal to its kind |
| `ui.js`, `render.js` | `TIER_NAME` :400, `BLOCK_NAME` :402, the card :468, :570–577, the Budget :967, the Census :1022–1038; render: the meat chalk :378–380, the dread overlay :492, the civic chain :654–670 | the card, the names, a draw branch |
| `walkers.js` | carts from a hall's staff :316–345; penned animals :347–352; sacks into the hall :378–380; `meatTrips` :500–520 | anchors found through the hall test |
| the tests | about 110 meat checks in `check.mjs`, 46 of them Part H (:6888–7265); the registry pins (:5088–5089, :5260–5273, :5707–5723; the icon must be `M1-stall-0`, :5749); and `check-police-actions`, `-campaign`, `-governance`, `-hostile-review` (:281, the Chapter 5 lock), `-civic-campuses` (:81, :95, :120), `-wealth`, `-migration`, `-integration-tools` (`meatprobe --save`), `-rail-bridges`, `need-fixtures`, `need-stress` | read each before changing it (M.8) |
| probes and rigs | `meatprobe.mjs` (balanced and estate); `mayor.mjs` :63–68, :164–175 (one hall per estate market block); `--markets` in `playtest`, `play`, `breedprobe`, `peopleprobe`, `savesize`, `wealthprobe`, `accessprobe`; `shots.mjs` :116–169, :526–527 | the probe first (M.7) |
| docs | SPEC §9c :1040–1121 and *Meat on hand* :1123–1186; §3, §3b, §11, §12.2 (**its tier table has no M row**, :1793–1807), §12.2b, §12.2e, §15; `CAMPAIGN.md` :28, :32; `GOVERNANCE.md`; README; `BACKLOG.md` :1217, *"The abattoir — a 3×3 M landmark"* | rewritten with the change |

Where I would start reading, in order: `meat.js`, `world.js`, `ops.js`,
`save.js`, `fields.js`, `progression.js` with `input.js`, `tools.js` with
`palette.js`, `ui.js` with `render.js`, the art modules, `check.mjs`.

### M.6 The art brief

- **One sprite per stage of growth.** The owner: *"the reason for multiple
  sprites is to show the growth of the market."* That is three stages under
  question 7(a), six under 7(b). Each is a 3×3 with a hi-res twin from the
  same recipe, every box inside the 48×48-unit footprint
  ([ART-CIVICS-3X3.md](ART-CIVICS-3X3.md)).
- **A stage must read as the same market, grown** — not a different
  building on the same lot. Keep the plan across stages (the yard, the road
  side, the pen) and add to it.
- **The stages.** The first stage reads as an open-air market: stalls under
  striped awnings, a yard, hooks, a cart. The hall stage roofs part of the
  yard over in brick under the slate roof. The cold-store stage adds the cold
  store with stacks and tanks, and a loading dock for the carts and sacks the
  walkers already carry ([`sheet-meat.png`](shots/sheet-meat.png)).
- **Start from the kit.** `STRIPE`, `AWNING_M`, `SAWDUST`, `BRACKET`
  (buildings.js:476–516); `HOOK` (:553); `stall()` (:554–579); `meatHall()`
  (:596–640 — the annex that hid its own door is written up at :589–594);
  `coldStore()` (:651–688); the plan variants in building-plans.js (:71–78,
  :150–163); and in blocks.js `pen()` (:62–74), `abattoir()` (:370–411),
  `meatExchange()` (:413–457), `stack`, `tank` and `van`.
- **Slate or grey — decide it on purpose.** Civics must stay grey
  (roof-furniture.js:172–184): *"grey is how a player tells a civic building
  from a zoned one"*. The slate roof is how a player reads *meat*. The market
  becomes a private business placed like a civic, so its roof has to choose
  which of those two a player should see.
- **What it retires**: all twenty-six sprites of M.1 and the zone chalk
  `chalk-M-low` / `chalk-M-high` (terrain.js:280–315). Old saves may break
  (M.4, answer 6), so nothing is kept to draw legacy halls.

### M.7 The order of work, and what holds it

1. **A proposal**, once questions 4 and 7 are answered: M.4's answers, the
   numbers, and M.2's table answered row by row — as
   `PROPOSAL-CRIME-AND-PUNISHMENT.md` did for the zone.
2. **Instruments first, and byte-identical.** A probe that reads markets on
   the estate layout (`meatprobe.mjs` reads it today). No migration fixture is
   owed (M.4, answer 6).
3. **The sim commit.** Every rig hash moves: print the before and after in the
   commit and say why. Never re-bless a hash silently.
4. **The art**, with `node tools/art-dump.mjs --write` in the same commit (an
   *added* sprite is drift too), `check-building-variants`, and the sheets —
   `tools/review-building-variants.mjs`, `tools/shots.mjs --sheet`.
5. **Measure** with `tools/playtest.mjs` against SPEC §9c's *Measured*
   paragraph (5–16 killings in 30 years with two hall blocks; 11–19 halls, ~70
   jobs, the cut ≈ §1.4k a year) — on the balanced rig **and** the estate
   layout, and name the rig beside every number.
6. **The words:** SPEC (M.5's docs row), `CAMPAIGN.md`, `GOVERNANCE.md`, the
   README, the tool's hint, the H flash, the Rules tab's rows M1–M6 and K1
   (rules.js:561–595), the news and the advisor's lines.
7. **A browser check on the deployed page**, in a new city — never one of the
   owner's. A deployed page can run the old module for ten minutes out of the
   HTTP cache: `fetch(url, { cache: "reload" })` each changed module, reload,
   and read something only the new version has before judging anything.

### M.8 Traps that will bite here

- **`removeCivic` does not close a hall.** It releases jobs and custody and
  clears the tiles ([ops.js:593–602](../js/sim/ops.js)), but it never frees a
  pen or spoils the stock. A bulldozed market would strand both and break the
  conservation identity `meatBalance()` audits. Route it through `closeHall`.
- **A save that still has meat must fail loudly, never load half-working.**
  Breaking old saves is accepted (M.4, answer 6), but a save that still holds
  `zone === 4` tiles must not load into a town whose meat code no longer reads
  them. Either refuse it with a message, or clear its meat on load through
  the bulldoze path — stock `spoiled`, pens `penReleased`, jobs released. The
  identity stays whole, and the owner keeps the rest of their town. Clearing
  is cheap and kinder; either way it needs a check.
- **Civic jobs count as shop jobs** — M.2's last row.
- **The tool's id must equal its op kind.** The ghost looks up its size and
  sprite by tool id (input.js:443, :450), the sim by kind (ops.js:171, :254);
  check.mjs:5227–5236 pins them equal. A row that keeps id `M` with a new kind
  draws a 1×1 ghost, and `art.civic("M")` throws. And `TOOL_BY_ID.M` is Meat
  while `TOOL_BY_KEY.M` is the Gallery.
- **The ghost always shows layout 0** (input.js:450) while the build uses
  `world.variant[anchor]`, so it can preview a building it will not build.
  Fix it with M — three layouts make it visible.
- **Civic art always faces +ty** (screen lower left) and the sim takes a road
  on any side, so a market can turn its door away from its road.
- **No fallbacks.** A civic id with no branch in `render.js` draws nothing
  (:654–670); the card's heading chain has none either (ui.js:450–466); and a
  Budget line that budget.js does not match is folded silently into the
  largest line (ui.js:120–143).
- **The suite's own city is zoned meat.** It zones a meat row at t = 0 and
  asserts it, *"so the market invariants can never pass over an empty set"*
  ([check.mjs:67–70](../tools/check.mjs)); it bulldozes a meat tile at t = 120
  (:78); it pins a v1 hash (:4662); and **the mayor's `markets: 1` is the only
  source of `LOST_CHILD`** in the every-KIND check (:4771, :4793). Replace each
  setup with a placed market and keep each guarantee. Never delete a check
  because its setup went away.
- **The owner's scale** — 6×6 blocks, 30+ road tiles from homes to meat. Three
  meat rules tuned on the scripted mayor's spiral never fired in their town;
  measure reach where they build (`tools/mayor.mjs`, `layout: "estate"`).
- **Trap 12** (the sprites brief): an awning hides twice its depth of wall.
  Count each door's pixels in every layout.
- **A stale name.** `hallNear` is gone from the code — `hallReach` replaced
  it, and it walks road steps rather than a radius — but SPEC.md:343 still
  names it. Rewrite that line with §9c. Five more docs name it (BACKLOG.md:207,
  PLAN-THE-PEOPLE:135, PROPOSAL-ZONING-RAIL-WALLS:40 and :84,
  HANDOFF-THE-FIRST-ZOO:621); those are records of their day and stay as
  written.

---

## L1 — the factories get a roofline

**What is there.** `node tools/massprobe.mjs` (passive): **192 zoned plans, 43
are ONE BOX WITH A LID** (fill ≥ 0.95, deck < 8%). Thirteen of the 43 are
industry — **all six `I1-shed`s, `I2-factory-0..2`, `I3-works-0, 1, 3, 4`** —
and the rust-roofed industry is the plainest thing in
[`scene.png`](shots/scene.png). The rest are three cottages, two shops, a
store, sixteen of the tier-1 shop families (bakery, greengrocer, fishmonger,
barber, pub, ironmonger, clockmaker and its pavilion, two each), five
`M1-stall`s and three `M3-cold-store`s.

**The parts already exist and no factory uses them.** `BLOCK_KIT`
([blocks.js:528](../js/art/blocks.js)) exports `sawtooth` (:78 — teeth glazed
with `END_GLASS` on the +tx face, *"never day glass on the dark side"*), `stack`
(:85, a rust stack with ring grain), `tank` (:88) and `chimney` (:50). The
blocks use the sawtooth (:324, :350, :469) and so does a knowledge civic
([civics-knowledge.js:79](../js/art/civics-knowledge.js)). A sawtooth says
*factory* by its outline at zoom 1 — a signal by shape, where a colour would
have to fight the roof that already says the zone.

**The catch is the import direction.** The zoned industry is `FAMILY[3]` in
`buildings.js` (:695), and `blocks.js` imports `KIT` *from* `buildings.js`
(:31). A zoned plan cannot reach `sawtooth` without a cycle. First commit:
move the parts down into `KIT` (or a module both import) and prove it moved
nothing — `art-dump` byte-identical. Then the plans, family by family, as T3.2
did (fixtures first: `b39866c`, `c61920c`; then `38b187b`).

**What will bite.**
- **Trap 12** (the sprites brief): anything proud of a wall hides 2d of it —
  count each door's pixels in both mirrors, before and after. No gate does.
- A sawtooth has **no flat deck**, so T2.3's roof furniture has nowhere to
  stand on those plans; read `faceprobe`'s bare-quad share before and after.
- Every box casts (`check-shadows`), and a tooth is a box. Look at the shadow
  sheet afterwards, not only the sprite sheet.
- **Leave the `M1-stall`s and `M3-cold-store`s alone** — item M redraws them.

## L2 — street lamps that come on at dusk

**What is there.** In [`sheet-dusk.png`](shots/sheet-dusk.png) the windows
come out and the streets stay black. There are **no street lamps** — `LAMP`
(`flatSkin("-")`, [buildings.js:841](../js/art/buildings.js)) is only ever part
of a building: blocks.js:195, :253, :300; buildings.js:875, :963.

**Half of it is free.** `-` is the lit window, one of the lights `dusk.js`
does not dim (*"a lamp does not get dimmer because the sun went down"*,
[dusk.js:39](../js/art/dusk.js)). A lamp head drawn in `-` comes on at dusk with
**no key added** — T1.5's rule, and T3.1's.

**The other half is the question.** What a street lamp *does* at night is
throw a pool of light on the asphalt, and the evening has no idea of light
landing on a surface: pass 4 is key → key and sees only keys. A pool needs a
new key or a dusk-only pass, and either is a decision about the evening, not
about a lamp. Show lamp heads alone first; argue about the pool with a
picture.

**How I would place them.** Render-only, from the road graph, never saved and
never in the sim — at every junction (a road tile with three or more road
neighbours), which is few, regular and readable. Size it on screen before
designing it. The kit has built one lamp-post already and learnt its size the
hard way: the police station's blue lamp is a `POST` 0.75 units wide with a
head on top, and the head is *"2 units — 8 px wide at 1× — because it is the
whole signature; at 1.5 it was a 5-px dot beside a 5-px door"*
([buildings.js:910–914](../js/art/buildings.js)). Start from that post, with
the head in `-`. A post is a box, so it casts; law 6 applies (`S > 1 &&
art.hires`).

## L3 — shirts that say where an animal works

**What is there.** Every walker but the affluent wears one shirt: keys `&` `^`,
*"a neutral concrete, so head and body separate at 1×"*
([citizens.js:20](../js/art/citizens.js)), rungs `#7C8794` and `#5B6470` of the
concrete ramp ([palette.js:21](../js/art/palette.js)). The affluent get the
suit, chosen at draw time from the address's class
([citizen-appearance.js:8](../js/citizen-appearance.js), `suits.js`). In
[`sheet-zoo.png`](shots/sheet-zoo.png) a crowd of all fourteen species reads as
one uniform.

**The idea.** A few shirts keyed to what an animal does. `c.job` is a lot
index or −1 ([sim/citizens.js:63](../js/sim/citizens.js)), so the lot it works
on — a zone, or a civic — is known, and can be read at draw time exactly as
the class is. That is *the roof says the zone* (T2.2), for people. It reads
the sim and writes nothing, so law 7 holds.

**Why it must be measured first.** The concrete was chosen to part head from
body at 1×. Any new shirt must part from **all fourteen coats** at least as
well, in every look and at dusk (the shirt keys are surfaces and are projected
like any other). `zooprobe` already measures ΔE between coats; a shirt reading
is the same machinery. Also: the citizen cache key
([citizens.js:1525](../js/art/citizens.js)) grows by the shirt, and so does
`art-dump`.

**This one is the owner's taste.** The uniform may be what they want — ask
before drawing.

## L4 — an earth edge under the map

**What is there.** The city is a flat diamond with no thickness: nothing in
`js/` draws a map edge (`grep -rn "skirt\|cliff\|mapEdge" js` finds only
prose), and the world has no slopes ([`sheet-terrain.png`](shots/sheet-terrain.png)).
SimCity 2000's cut-away soil edge is what made its map read as a model on a
table.

**The idea.** Render-only: two faces under the map's two front sides (SW and
SE) in the earth ramp, and a water face where a water tile meets the edge.

**What will bite.** The ground layer is offscreen and survives frames (the
sprites brief, trap 10), so an edge drawn in it must rebuild with it. Nothing
may go below slate (law 5), so the darkest earth rung is the floor. It shows
only zoomed out, which is why it is last.

## Qz — which zoom does the owner play at?

The camera zoom is an integer 1–4 ([render.js:22](../js/render.js)); the detail
scale is 1 at zoom 1, 2 at zoom 2 and 4 at zoom 3–4 (:26, :173). T4.1's
authored heads are drawn at 2×, so **they are never seen at zoom 1.** If the
owner plays mostly at zoom 1 — 6×6 blocks and a few thousand animals suggest
they might — L1–L3 are worth more than T4.1 and should go first. Ask; do not
guess.

## Q1′ — answer Q1 on a dense block

Q1 (*how long is the shadow?*) is the owner's, and
[`sheet-shadows.png`](shots/sheet-shadows.png) was made to answer it. That
sheet is one street — *"a cottage, a terrace, a tower"*
([shadow-sheet.mjs:39](../tools/shadow-sheet.mjs)) — on open grass, with
panels for shadows off and `k` = 0, 0.25, 0.55 and 1.2 (:34). `SHADOW_K` is
0.55 ([shadow.js:55](../js/art/shadow.js)), and dusk multiplies it (render.js;
dusk.js:68).

Open grass is the easy case. The owner builds **6×6 blocks, with 30 or more
road tiles between homes and meat and rail between quarters** — where a long
shadow falls across streets and neighbours, not lawn. `tools/mayor.mjs`
already builds that town (`layout: "estate"`, :29, :43). Give `shadow-sheet` a
rig on it (or `--save`, for the owner's own city) and put the same panels in
front of the owner.

---

## Where this is recorded

- **`BACKLOG.md`** — a first entry pointing here; its NEXT line asks Qz before
  T4.1; the abattoir-landmark item notes that M may overtake it.
- **[The sprites brief](HANDOFF-THE-SPRITES-2026-09-23.md)** — its
  *Unfinished* lists point here: T4.1 to Qz, Q1 to Q1′, the one-box plans to
  L1 and M.
- **[The keystone handoff](HANDOFF-THE-FIRST-ZOO-2026-09-02.md), §0** — a
  pointer here, and a warning to read M.2 before touching `js/sim/meat.js`.
- **`SPEC.md` §9c** — *key M* corrected to *key 4*: the Gallery took M in the
  2026-09-05 key audit, and §11 already said 4. Nothing else in the spec moved.
