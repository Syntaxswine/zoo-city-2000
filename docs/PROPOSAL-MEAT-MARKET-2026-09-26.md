# PROPOSAL — the meat market, placed and growing; and the street trade where there is none (2026-09-26)

**Status: BUILT, 2026-09-26.** The owner said *"yes"* to all eight items of
Part D, and it went in as Part C planned, a commit a step:

| step | commit | what |
|---|---|---|
| 1 | `8cb6f35` | the instruments, byte-identical |
| 2 | `01aa0bb` | the market in the sim, drawn with functional stage sprites |
| 2′ | `e052aa9` | the growth guard reads THIS month's census (`world.now`); a reload check at every month of six years |
| 3 | `5f1aab4` | the street trade |
| 4 | `991991e` | the art: the seven stages redrawn; `tools/market-sheet.mjs` |
| 4′ | `05ce7eb` | the retirement: the twenty-six zoned meat sprites and the meat chalk |
| 5 | the commit that wrote this status | the words: SPEC §9c and the sections that read the zone, CAMPAIGN, GOVERNANCE, the README, the Rules tab, Governance's labels |

What building it changed from the text below — each found by measuring or by
looking, and each argued in its commit message:

- **A growth guard (A.3).** A market takes its next stage only if the town
  would keep it there — the score it would settle at one stage up, not below
  the decay line. Without it markets rocked on their coarse steps (3–6 stage
  moves a hall-decade; 1.3–1.7 with it). It reads this month's census,
  because a reloaded city rebuilds last month's differently.
- **The scripted mayor picks the form** a sensible player would: Heavy once
  the town wants 40 meat jobs, Light below.
- **The pens arrive with the exchange (A.9).** Nine stalls leave no room for
  a pen that reads at zoom 1; the exchange's loading yard holds two.
- **The meat is implied, never drawn (A.9).** A first round hung sides of meat
  on the rail; the crime proposal's art rule — *"what breaks the field guide:
  carcasses, drips, text, saturated red"* — took them off. The hooks hang
  empty, as the zoned stall's did.
- **The gate is low.** An arch over it hid stage 1's only stall.
- **A stopped seller waits for a bed**, as any trespasser does: the test towns
  without a market never built a Zoo prison, so none was sentenced there.
- **Not renamed:** the event log's lines still say "meat hall" (SOLD, CASE
  WAITING, the Greens' march, the advisor, the licence card). The log is
  hashed; renaming them moves every rig's hash — a two-commit change of its
  own, if the owner wants it.

The owner's answers below are rulings. Every number that is mine waits on the owner's OK — the checklist in
**Part D**. The background — what the meat zone is today, why it was a zone,
and what reads it — is item M of
[HANDOFF-THE-MEAT-MARKET-AND-FOUR-LOOKS-2026-09-25.md](HANDOFF-THE-MEAT-MARKET-AND-FOUR-LOOKS-2026-09-25.md).
Line references are true of the commit that adds this file.

## 0. The owner's words

The ask, 2026-09-24:

> *"i want to change the meat market into a placeable 3x3 for light and high
> density. the models need to be redesigned. i'd like a few variations. so
> thats a coding and aesthetics change."*

The answers, 2026-09-25 (questions in the handoff, M.4):

> *"1 yes*
>
> *2 yes, one tool.*
>
> *3 the reason for multiple sprites is to show the growth of the market.*
>
> *5 same cost as zoning a lone tile of the previous one*
>
> *6 it will break the saves, but thats ok, the player base is basically me."*

The last two, 2026-09-26 — how big a market is, and whether a Light market
grows:

> *"for light it should be 3-27 jobs*
>
> *for heavy 27-180*
>
> *2 yes, 3-27 in stepped increments with different sprites."*

And one more, the same day:

> *"one more to add to the proposal. what if you didn't have the meat market
> and people were just trying to sell it on the street, this would turn the
> negative effects of the meat market into a walking hazard."*

---

## Part A — the market

### A.1 The rule

Row 4, key `4`, **Meat market**. A click places a 3×3 **site** beside a road
for §12, in the form the H brush shows: **Light**, or **Heavy** from Chapter 5
of the campaign. The site is a civic with its own id (the next free one, 20).
Its anchor carries the market's **stage** in `world.tier` and its **form** in
`world.maxTier` (1 Light, 3 Heavy), so no field is added to the save. It
grows a stage at a time as the meat valve and its street allow, exactly as a
zoned lot grows a storey, up to the top of its form. It loses stages the same
way, and every stage has its own sprite. Everything that read a hall by its
zone reads it through one predicate, `isHall`, re-keyed to the market's
anchor.

### A.2 The stages

One ladder, seven stages. The form sets where a market starts and where it
stops:

| stage | what stands | jobs | Light | Heavy | smell and crime, as the zone gave for the same jobs | pens |
|---|---|---|---|---|---|---|
| 0 | the bare site — paved yard, fence, gate | 0 | ✓ | ✓ | none | 0 |
| 1 | one stall | 3 | ✓ | | a stall's, from 1 tile | 2 |
| 2 | three stalls | 9 | ✓ | | a stall's, from 3 tiles | 2 |
| 3 | six stalls | 18 | ✓ | | a stall's, from 6 tiles | 2 |
| 4 | the full square — nine stalls | 27 | ✓ top | ✓ **opens here** | a stall's, from all 9 | 2 |
| 5 | the hall | 72 | | ✓ | a hall's, from all 9 | 4 |
| 6 | the exchange — hall, cold store, dock | 180 | | ✓ top | a cold store's, from all 9 | 8 |

- **Light is 3–27 jobs** in four steps, each its own sprite (the owner's
  *"stepped increments with different sprites"*).
- **Heavy is 27–180.** It opens as the full square and grows through the hall
  to the exchange. The numbers are my earlier ones — nine stalls, nine halls,
  then the grown 3×3 with its ×1.25 — so a market of a given size has the
  jobs the zone had on the same nine tiles.
- **Why the smell follows the stalls.** A stall's is dread 40 over 2, crime
  10; a hall's 70 over 3, crime 18; a cold store's 105 over 4, crime 25
  (SPEC §9c). A one-stall market smells like one stall, not like nine, and a
  full exchange smells exactly like today's grown meat block. The balance SPEC
  §9c measured is kept, because the land, jobs and smell are all the zone's.
- **Stock** is 40 at every stage, as for any hall today (`MEAT_CAP`).

### A.3 Growing and shrinking

The same rule a zoned lot lives by (`lotScore`, lots.js:76–186), read at the
market's anchor:

- **The score** is the M valve plus `local_M`: carnivores near, cheap ground,
  stock on hand (lots.js:110–113). Both are unchanged.
- **Opening:** stage 0 moves to the form's first stage (Light 1, Heavy 4) at
  `SPROUT_P`·score when the score passes `GROW_THRESH`.
- **Growing:** one stage at `GROW_P`·score, only once the staff fill the
  current stage to `FILL_TO_GROW` (0.7), and never past the form's top.
- **Shrinking:** one stage at `DECAY_P`·(−score) below `DECAY_THRESH`, with
  staff fired down to the new size. Light steps down 4 → 3 → 2 → 1 → 0.
  Heavy steps down 6 → 5 → 4 → 0: a failing Heavy market **closes** rather
  than shrinking into a Light one, because Heavy is 27–180.
- **No merging** — the market is already the block.
- **The why-not line** is the same `lotScore` reason, so the card says why a
  market is not growing, as it did for a lot. The form's cap reads *"Light
  market — the H brush caps it"*.

### A.4 Placing, paying, unlocking

- **The tool.** Row 4 keeps key `4`; its id becomes `market`, since a tool's
  id must equal its op kind (the handoff, M.8). It is a click with a 3×3
  ghost, and **the ghost is the stage-0 site**, which is what the click
  builds.
- **The place op carries the brush.** The lock reads it: Light is open from
  Chapter 1, and Heavy waits for Chapter 5 (Low meat and High meat today).
  Free play has no lock.
- **The site** follows the civic rules: every tile clear, a road touching the
  footprint, served within `ROAD_REACH` 3 to operate. The market must be in
  `asksAccess` explicitly (fields.js:137–143) — it is not a civic employer
  (A.5).
- **The price is §12**, the owner's *"same cost as zoning a lone tile of the
  previous one"*. There is no civic upkeep line. The stage counts toward the
  tier upkeep like any storey, and the licence bills §400 a year per market,
  as it billed a hall.
- **No limit** on how many a town has.

### A.5 Who works there, and who pays whom

- **Jobs count toward Jm, the meat valve — never Jc.** A civic employer's
  jobs count as shop jobs (`jobZone`, world.js:441–447), and that is the
  failure the zone's own valve was built to avoid (48 meat jobs counted as
  shops starved real shops). So the market is **not** in `isCivicEmployer`.
  `jobZone`, `capacityOf` and `jobsOf` learn it by its own id.
- **Hiring** keeps `JOB_M` by diet (carnivores 0.9, omnivores 0.5,
  herbivores 0.1).
- **Money is unchanged:**
  - the mayor's cut — §25 per filled job a year, untaxed;
  - meals at §20 a unit to the cut, or the shop rate to tax once licensed;
  - a bought killing +§50, a convict sold +§100.

### A.6 Closing, burning, raids and the licence

- **Bulldozing a market closes the hall first:** stock `spoiled`, pens
  `penReleased`, staff released. Today's `removeCivic` does none of the first
  two (ops.js:593–602; the handoff, M.8). A stocked market cannot be undone,
  as a stocked hall could not.
- **Prohibition** (governance, *meat-hall regulation: prohibited*) closes
  every market, as it closes every hall — and now sends the trade to the
  street (Part B).
- **Fire.** A market can burn, as a hall did — its stage makes it a built lot
  (`builtLots`, tier > 0). Burnt, it falls to stage 0: stock `spoiled`, pens
  released, staff fired. The site stands, because a placed thing is not
  rubble.
- **The raid** shuts a stage (one down) and fines §200 × the stage's old tier
  — 1 for the stalls, 2 for the hall, 3 for the exchange. It names the last
  one hired and opens a file on them, as today.
- **The licence** is offered the month the first market reaches the hall
  (stage 5), as it was offered the month the first hall reached tier 2.

### A.7 Old saves

The owner: *"it will break the saves, but thats ok."* No migration and no
legacy path. A save that still holds zone-4 tiles loads with **its meat
cleared through the bulldoze path** — stock `spoiled`, pens released, staff
released — and one line saying so. The rest of the town survives, and the
conservation identity holds. Refusing the save outright would also be within
the owner's ruling; clearing costs little more and keeps their town.

### A.8 What the zone gave for free, answered

The handoff's M.2 table, row by row:

| the zone got it free | the market |
|---|---|
| drag | a click; a market is one 3×3 |
| undo | the civic same-month undo — except a stocked market, as before |
| density | the H brush picks the form (A.1) |
| the tier ladder | the seven stages (A.2) |
| decay, fire, the raid's shut storey | all three, on the stage (A.3, A.6) |
| the WHY NOT line | the same `lotScore` reasons (A.3) |
| the art audit | art-dump, and a staged family in `check-building-variants` (C.2) |
| its own valve | kept: jobs in Jm (A.5) |

### A.9 The art

Seven sprites, one for each stage of A.2. Each is a 48×48-unit recipe with a
hi-res twin from the same recipe, its front on +ty like every civic.

0. **The site.** A paved yard, a low fence, a gate, a painted sign. It is
   also the ghost.
1. **One stall** under a striped awning, by the gate.
2. **Three stalls** in a row along the front.
3. **Six stalls** in two rows, and a hand cart.
4. **The square.** Nine stalls, hooks, sawdust, a cart — a Heavy market opens
   here.
5. **The hall.** Brick under slate over the back two-thirds, the stalls kept
   at the front.
6. **The exchange.** The hall, a cold store with stacks and tanks, and a
   loading dock where the carts come in.

- **One market, grown.** A stage must read as the same market grown, not a
  different building: keep the plan — yard, gate and pen — and add to it.
- **The roof is slate**, which is how a player reads *meat*. That means the
  market is not a public civic, so the civics-stay-grey rule
  (roof-furniture.js:172–184) does not bind it — say so in the recipe.
- **Parts from the kit:** `STRIPE`, `AWNING_M`, `SAWDUST`, `BRACKET`, `HOOK`,
  `stall()`, `meatHall()`, `coldStore()`, `pen()`, `stack`, `tank` and `van`.
- **Retired:** all twenty-six zoned meat sprites and the meat chalk.
- **Trap 12:** an awning hides twice its depth of wall — count the gate's and
  every door's pixels.

---

## Part B — the street trade, where there is no market

### B.1 The idea

The owner: *"what if you didn't have the meat market and people were just
trying to sell it on the street, this would turn the negative effects of the
meat market into a walking hazard."*

Today, a town with no hall in reach simply goes without. Its carnivores feel
it as the `HOOKS` need (needs.js:76–84), killings still happen (3–7 in 30
years in a fed town, SPEC §9c) and their bodies go nowhere, and **prohibiting
the trade has no cost at all** — it only switches the smell off
(fields.js:242, :566). Nothing like a street trade exists in the code.

With it, the market becomes a **containment choice**: place one and the harm
is concentrated where you put it; place none and it walks every street.
Prohibition finally costs something — the satire's own logic, *"there is
nothing in the game saying that players need to add the meat markets"*
(the owner, in SPEC §9d), now with a price for not doing so.

### B.2 When

The street trade happens for any carnivore household with **no market in
reach** — no market at all, every market more than `MEAT_ROAD` 60 walked
steps away, or the trade prohibited — while the town still wants meat (the
`HOOKS` need, `r.M` > 0.05).

### B.3 Who, and how many

- **Street sellers** are carnivore adults, the unemployed first (*"no jobs
  means hungry wolves"*, SPEC §9c).
- **How many:** one seller per stall's worth of the unserved demand, on the
  valve's own numbers — 0.06 of a job per carnivore, 3 jobs a stall. That is
  one seller per 50 unserved carnivores, so a town of 525 carnivores with no
  market has about eleven.
- A seller keeps a home and holds **no job slot** — the trade is informal —
  so selling moves no job count and no valve.

### B.4 Where — the pitch, and why it walks

- Each month every seller works a **pitch**: a road tile within walking reach
  of home where the most unserved carnivores live within 5 (its customers).
  It is picked deterministically from the seed, the tick and the seller, and
  **moves every month** among the best few. That movement is the *walking*.
- Pitches are derived, like dread: recomputed from the state each month,
  never saved.
- The walkers show them: a seller stands at its pitch with a tray or the
  meat cart the walkers already have.

### B.5 The hazard

At each pitch, for that month:

- **Dread** at a stall's strength, 40 over 2. Herbivores within it lose mood,
  score their homes lower and rehome, just as they do by a hall.
- **Crime** at a stall's strength, +10 within 1.
- **The buyer's pull.** A seller is a buyer, so `KILL_MARKET` (×3, rules.js:289)
  applies within a pitch's smell as it does within a hall's. **Killings follow
  the sellers.**
- **Exposure on the way.** A prey animal whose commute walks past a pitch is
  exposed, the way trespass counts forbidden tiles on a commute
  (`exposure`, fields.js:1098). That exposure raises its weight as a victim.
  This is the hazard met *while walking*.
- **Land value is left alone, on my lean.** A seller on the kerb for a month
  should frighten the herbivores who pass, not reprice the street. That is
  the owner's call (D.8).

### B.6 Supply and money

- **Supply:** a street seller sells what a killing brings, the same month.
  It holds no stock and has no cold store, buys no natural deaths at the
  door, and takes no convicts. In the conservation identity a street sale
  records `killed` and `eaten` together and moves no stock, so the identity
  holds as written.
- **Money:** the mayor gets **nothing** — no cut, no licence, no raid. It is
  off even the grey books.
- **Police:** a seller whose pitch has police cover can be stopped on the
  spot, like trespass: a file opened and closed, a month in the Zoo prison,
  and the record goes up. That is on my lean (D.8).

### B.7 Prohibition

Prohibition closes every market and sends the whole demand to the street.
Until now it cost nothing; with this, the owner's regulation menu has three
honest choices: *unregulated* (the cut), *inspected* (the tax), and
*prohibited* (the street).

---

## Part C — how it is built, and how it is proven

### C.1 The commits, in order

1. **Instruments, byte-identical.** `meatprobe` and `playtest` count markets
   by stage, stage changes a decade, and (for Part B) sellers and pitches.
   Nothing moves.
2. **The market, in the sim**, drawn with a placeholder (today's
   `M3x3-meat-exchange`) for every stage, so the hash change is the sim's
   alone. Every rig hash moves: print before and after, and say why.
3. **The street trade.** It is its own commit so that its effect can be
   measured on its own.
4. **The art.** The seven stages and their twins, with
   `art-dump --write` in the same commit, and the sheets.
5. **The words.**
   - SPEC §9c rewritten, with §3, §3b, §11, §12.2, §15, and SPEC.md:343's
     stale `hallNear`.
   - `CAMPAIGN.md` and `GOVERNANCE.md` (prohibition's new consequence).
   - The README, the Rules tab's rows M1–M6 and K1, the tool's hint and the H
     flash.

### C.2 The checks

**Changed** — each with its guarantee kept, never deleted because its setup
went away:

- The registry pins (Part P) and the key test: key `4` now selects `market`.
- The scripted city places a market at t = 0 and asserts it stands (*"so the
  market invariants can never pass over an empty set"*). It bulldozes that
  market at t = 120.
- The mayor's `markets` option places markets. That option is still the only
  source of `LOST_CHILD` for the every-KIND check.
- Part H, and the hall fixtures in `check-civic-campuses`, `-police-actions`,
  `-wealth`, `-governance`, `-hostile-review` (Heavy's Chapter 5 lock) and
  `-rail-bridges`.
- `check-building-variants` learns a staged family: seven stages, one layout
  each, every one reachable, each with a twin.

**Added:**

- **The ladder:** jobs, pens and smell exact at every stage; Light never
  above 4; an open Heavy never below 4.
- **Placement:** §12, a road, Heavy locked before Chapter 5; the ghost is the
  site.
- **Jobs in Jm, not Jc.**
- **Bulldozing, burning or prohibiting a market** keeps `meatBalance()` whole.
- **An old zone-4 save** loads with its meat cleared, and the identity holds.
- **Street trade:**
  - sellers only where no market is in reach, or under prohibition;
  - pitches deterministic and moving;
  - a pitch's dread reaches herbivore mood and leaving (not land value, if so
    ruled);
  - a street sale moves no stock.

### C.3 The measurements

`tools/playtest.mjs`: 30 years, seeds 7, 3 and 5, rates 8, disasters off.
Run it on the **balanced rig and the estate layout** (the owner's 6×6
blocks), and name the rig beside every number. Read:

- **killings**, against SPEC §9c's *Measured*: 5–16 in 30 years with two hall
  blocks;
- **markets and their stages**, meat jobs, and the cut (≈ §1.4k a year before);
- **herbivores in the smell**;
- **stage changes per market per decade** — a market that grows and shrinks
  more than a few times is rocking on its steps, and the steps are wrong;
- **for Part B**, the same town with no market and then with prohibition:
  sellers, killings, and where the herbivores go.

---

## Part D — for the owner to confirm

My numbers and leans. A *yes* to all of them is enough to start; change any
by number.

1. **Light's steps:** 3 · 9 · 18 · 27 jobs — one, three, six and nine stalls,
   four sprites. (Stall by stall, nine steps, is the other way.)
2. **Heavy's steps:** 27 · 72 · 180 — the square, the hall, the exchange.
3. **A Heavy market opens at 27** and, failing, closes rather than shrinking
   into a Light one.
4. **Smell and crime follow the stalls:** a stall's per stall tile, then the
   hall's, then the cold store's from all nine — the zone's, for the same
   jobs.
5. **The roof is meat's slate**, not a civic's grey.
6. **Old saves:** their meat is cleared on load, and the rest of the town
   kept.
7. **A market can burn** and fall back to its bare site.
8. **The street trade:**
   - it happens where no market is in reach, and under prohibition;
   - one seller per 50 unserved carnivores;
   - a pitch moves monthly and carries a stall's dread and crime and the
     buyer's pull;
   - its dread frightens herbivores but does not lower land value;
   - police can stop a seller like trespass;
   - the mayor gets nothing from it.
