# HANDOFF — the first zoo (2026-09-02)

The keystone for whoever builds next. One session took Zoo City 2000 from
a sentence to a live game; this is what that session knew by the end and
where it would go next. Read it before touching anything. `SPEC.md` is the
design record, `BACKLOG.md` the open work; this file is the *why* and the
*traps*. It was reviewed by three fresh agents before it was committed
(code-truth, blind newcomer, completeness); §3's last rows and half of §1
are theirs.

The owner's ask, verbatim: *"lets build zoo city 2000, an isometric city
builder where anthropomorphic characters live and grow together in a city.
the builder must balance residential, commercial, and industrial zoning as
well as taxes and random events."* The rulings that followed during the day
are quoted in §8. Every one of them is in the code except the 3×3
landmarks, which are a proposal.

**A rule about this document, learned the hard way at Glades and again
here:** a handoff sentence that is not true of the code beneath it is
worse than no sentence. The first draft of this file had eleven such
sentences. When SPEC and `js/sim/rules.js` disagree, `rules.js` is the
measurement and SPEC gets edited — never the reverse.

---

## 0. START HERE

- **Live:** https://syntaxswine.github.io/zoo-city-2000/ — Pages from
  `main` root, repo `Syntaxswine/zoo-city-2000` (`origin`), no build. Push
  = deploy (about a minute). Git identity `StonePhilosopher
  <270513546+StonePhilosopher@users.noreply.github.com>`; every commit ends
  with the Co-Authored-By line; commit messages are field notes and part of
  the archive. `.gitignore` = `Thumbs.db .DS_Store out/ node_modules/`.
- **Before touching a file:** `node tools/check.mjs` — 80 checks, exits 1.
  Green at the commit this file lands in. If it is red when you arrive, that
  is the first job; `git log -p` on the file it names is the fastest route.
- **Run:**
  ```
  node tools/serve.mjs [--port 8139]        # static, no-store; the launch entry "zoo-city-2000" is 8139
  node tools/check.mjs [--years 15] [--seed 7]
  node tools/playtest.mjs [--seed 7] [--years 30] [--layout balanced|dormitory|millbelt]
        [--rates 8,8,8] [--schedule 15:13,22:7] [--recession Y] [--parks N] [--zoo Y]
        [--stations] [--disasters] [--csv] [--quiet]
  node tools/shots.mjs [--sheet] [--scene] [--zoom N] [--focus tx,ty,...]   # writes docs/shots (committed evidence)
  ```
  **`playtest.mjs` masks disasters unless `--disasters`** — the browser
  game has them on by default, so a plateau measured without the flag is
  not the plateau a player sees. `--stations` places one fire AND one
  police station beside the start at year 2. `--parks N` places one per July
  from year 2; `--zoo Y` a zoo in January of year Y.
- **The browser pane fires no `requestAnimationFrame` while hidden**, so
  the clock does not run there. `window.zoo` is the app: `advance(n)` steps
  months (it works while paused), `doOp(op)`, `save()`, `load()`,
  `setSpeed(±1)`, `togglePause()`, `cycleOverlay()`, `zoomAt(±1)`,
  `newCity({seed, noDisasters})`. `advance` autosaves every 12 ticks and
  boot resumes the NEWER of checkpoint/autosave — press `N` for a fresh
  city before a load test or you are testing yesterday's town. A loaded
  city opens PAUSED. Since session 4 (§11) boot stands the TITLE SCREEN over
  the resumed city: CONTINUE (or `window.zoo.title.close()`) drops it;
  `advance(n)` works under it; the clock does not.
- **Saves and clock (`js/main.js`):** localStorage `zoo.city:<name>` (the
  `S` checkpoint; `L` reads only this), `zoo.auto:<name>` (every 12 ticks,
  on `pagehide`, on hidden), `zoo.meta:<name>` (`{speed, paused, at}`),
  `zoo.last` (which city reopens). Default name and seed `"zoo"`; an import
  is named `<seed>-import`. `TICK_SECONDS 1.5`, `SPEEDS [1, 3, 10]`,
  `MAX_CATCHUP 3` ticks per frame, walker time scaled by `min(speed, 3)`;
  any open modal pauses; a choice card forces pause.
- **Keys:** `1 R 2 C 3 I 4 Road 5 Tree 6 Park 7 Zoo F Fire P Police 8
  Bulldoze 9 Inspect D density Space , . Z S L O +/− N Esc`. `S` and `D`
  are tap = command, hold > 220 ms = pan. Shift on a road drag = straight.
  Undo is one step, this month only, and any op with `evicts` empties it.

## 1. The shape of the thing

| where | what | law |
|---|---|---|
| `js/sim/world.js` | the state: typed arrays per tile, citizens, households, `byId`/`hhById` from birth; `createWorld` (terrain, the edge-road stub); `CIVIC` enum; `jobsOf`/`capacityOf` | everything derived is rebuilt, never saved |
| `js/sim/rules.js` | **KNOBS** + **RULES** (every equation with `live(world)`) | one table: the Rules tab, the hover card and playtest read it |
| — not in KNOBS (grep before you tune) | mood arithmetic and the bear damp (`citizens.js moods`, departures); I tier 3 needs `roadDist ≤ 1` and the C customers `/80` term (`lots.js`); every event's magnitude (`events.js`); rate clamp 0..20 (`ops.js`); receivership `n+2` (`budget.js`); `events.log` cap 400 in memory / 200 on save | |
| `js/sim/tick.js` | the one orchestrator: fields → census → valves → lots → citizens → budget → events → compact → history; `refreshLast`; `characterLine`; the advisor | consumes the sim RNG in this order only |
| `js/sim/census.js` | P/W/J/U/Lab, shares, H (with `H_FLOOR`), crime and station counts, `isWorker`, `ageYears` | rebinds `world.byId` to a scratch map every tick |
| `js/sim/rng.js` | mulberry32 stream + `hash01` (the pure hash walkers and `tileHash` use) | three salts in `world.js`: sim `^0x5a17`, names `^0x9e37`, terrain `^0x7e11` (terrain is regenerated then overwritten on load) |
| `js/sim/fields.js` | roadDist (BFS), coverage, traffic, pollution (radial sources), land value, crime (counts unemployment itself) | pure; derived |
| `js/sim/demand.js` | the five equations, the tax term, the cap law; `peekDemand` (no valve advance) | |
| `js/sim/lots.js` | `lotScore()` — decides growth AND returns the WHY NOT reason; `lotReport` | never a second implementation; `ui.js whyNot()` only switches on the code |
| `js/sim/citizens.js` | households, arrivals (strict then lenient home search in ONE pass), departures, jobs (BFS), friendships, mood, prey flight, `SURNAMES`, `arrivalWeights` | `removeCitizen` is the only exit |
| `js/sim/events.js` | the rolled roster (19 kinds) + bear winter and the tortoise centenary (calendar/rule driven), timed effects, fire spread, the choice card, `EVENT_TITLES` | disasters never chain within 12 ticks; receivership lives in `budget.js` |
| `js/sim/budget.js` | `post()` — **the only cash path**; `yearlyFigures`; receivership (restores `flags.ownRates` on exit) | integer § |
| `js/sim/ops.js` | every player action: `costOf` (`replaced`, `evicts`), `apply`, `undo`, `roadL`, the input log | tiles, never people |
| `js/sim/save.js` | `toPlain`/`fromPlain`, `rebuildDerived`, `stateHash` (FNV over `toPlain` minus `log` and `history` — `events.log` IS hashed) | the hash law |
| `js/sim/species.js` | 14 species (`pack`, `predator`, `stink` flags), `PREY_OF`, `affinity`, `NAME_PARTS` | weights, never gates |
| `js/art/*` | text sprites `{rows, anchor, w, h, footprint, tags}`; `solid.js` box rasteriser; `buildings.js` (`solidSprite`, `CIVICS`, `PLANS`, stamps throw if clipped); `citizens.js` (the kit); `roads.js` (`DECK_TOP`); `terrain.js`; `index.js` (the registry) | every pixel a palette key; `tags` building/civic/overlay opt INTO the footprint audit |
| `js/iso/iso.js`, `js/iso/painter.js` | the projection; **the one draw order**: `key = (cell + frac − 0.7·[oblong])·1024 + z` — `OBLONG_PULLBACK` applies to any footprint > 1×1 and was ray-audited for the 2×2 only | a 3×3 needs its own audit |
| `js/render.js` | the only canvas module. **Static layer = ground only**; buildings, trees, civics AND walkers are re-sorted and blitted every frame through `painter.js` — that is how one order exists. Overlays `off → lv → pol → crime → score`; zots on static rebuild | |
| `js/walkers.js` | ≤150 movers sampled from real citizens; hashes `(tick, citizenId, salt)` | **never writes the sim** (check Part D) |
| `js/input.js`, `js/ui.js`, `js/main.js`, `index.html`, `css/field.css` | `TOOLS`/`PLACE_TOOLS`, the panel (`liveBudget` prints `yearlyFigures` on the CURRENT state, never `world.last.budget`), the clock, saves | `window.zoo` is the app |
| `tools/check.mjs` | Parts A–D: one scripted 15-year city (ring road, R/C/I, a park at t=36, rate 10 at t=60 and 7 at t=84, trees at t=100, a bulldoze at t=120, a save at mid-run) built twice; greps; the art audit; species parity; walker invariance | the only thing that exits 1 |
| `tools/playtest.mjs` | the scripted mayor: opens a 6×6 block (pitch 7, spiral r ≤ 4) each quarter when a valve ≥ 0.05, fewer than 12 empty lots of that type remain and cash > 600 | reports, never halts |
| `tools/shots.mjs` | contact sheets and the depth-sort scene; `--focus tx,ty` at zoom 6 | look before you trust |

**Art API** (`js/art/index.js`): `art.building(zone, tier, variant)`,
`art.civic('park'|'zoo'|'fire'|'police')`, `art.road(mask, busy)`,
`art.bridge(mask)`, `art.ground('grass'|'water'|'rubble'|'chalk'|'kerb',
variant)` (chalk variant = `zone*2 + high`), `art.tree(kind)`,
`art.citizen(species, facing, frame, age, {hat})`,
`art.overlay('scaffold'|'fire'|'flood'|'rubble'|'tent'|'hat'|'meeting'|'plaza'|'cursor'|'ghost', frame)`,
`art.zot('noroad'|'smog'|'nojob'|'nodemand')`, `art.waterTint(frame)`
(`WATER_FRAMES 4`), `allSprites()`. `palette.remapRamp(from, to)` gives a
tint table for `rasterize(rows, tint)` — the species-skin hook. A new
sprite family is looked at on `docs/shots/sheet-*.png`, which are committed:
a regenerated sheet shows as a git diff, and that diff is the evidence.

### 1b. The roster (`events.js`)

One roll per tick at `EVENT_P 1/30` over the ARMED roster; a kind already
active is skipped; disasters never chain within `DISASTER_COOLDOWN 12`.
fire (w3, ×2 Jun–Aug; origin weight 1/6 on covered lots) · flood (w2,
needs water) · tornado (w1, through a built lot) · beaverDam (beavers ≥12%,
water, 120-tick gap) · smogBank (mean Pol > 35, 6 ticks) · mouseBoom (mice
≥35%, births ×3, 12) · taxRevolt (w4, armed when any rate ≥ n+4 for 12
consecutive ticks; 8% of households leave; 2% of cash) · boom (12–24 ticks,
ext ×1.3) · recession (18–30, ext ×0.6) · foxFair (foxes ≥10% + a C tier
≥2) · rabbitWarren (rabbits ≥25% + parks ≥2) · truffles (pigs ≥15% + trees
≥8% of the map, 60-tick gap) · dairyFair (cows ≥15% + parks ≥2) · wolfMoon
(wolves ≥10%, 3 ticks) · heist (a C lot with crime > 70 + any fox/raccoon/
cat) · skunked (skunks ≥5% + any predator) · founders (≥5 species at ≥5%,
H ≥ 0.5 AND friendships ≥ P/4, 120-tick gap, w6) · grant (cash < 2,000,
approval ≥ 50, 120-tick gap) · scrubbers (I lots ≥ 15; `choice: true`).
Outside the roll: bear winter (every December if bears ≥ 10%), the
tortoise centenary (age ≥ 100 → `events.centenaries`, LV +8 r3 forever),
receivership (`budget.js`, cash < −10,000). Timed-effect fields and who
reads them: `extMult`, `valveBoost` → demand.js; `birthMult`, `friendMult`,
`moodBoost`, `moodBySpecies` → citizens.js; `bearWinter` → budget (×0.8);
`events.scrubbers` and `smogBank` → pollution. Persistent event state:
`lastDam, lastTruffle, lastFestival, lastGrant, revoltArmed, cooldown,
scrubbers, choice, noDisasters, centenaries, log`.

## 2. THE LAWS (what the suite enforces — do not "improve")

1. **Determinism.** No `Math.random` under `js/`. The sim stream is
   consumed in tick order; names have their own stream; walkers hash and
   never write. `check.mjs` builds the same city twice, replays the input
   log from the seed, and saves at mid-run, loads, continues, and requires
   the same hash as the straight run. **Anything derived that the sim reads
   must be rebuilt on load before the first tick** — paths are (a rehomed
   family's stale path was the first divergence); crime counts unemployment
   from live state rather than the previous census for the same reason.
   `compact()` runs twice per tick (inside `citizensTick` and after events).
2. **Money is integer §** and `budget.post()` is the only mutator; the
   suite greps for any other `cash =`.
3. **One implementation.** The WHY NOT line is `lotScore()`'s reason code
   (`ui.js whyNot()` switches on it and never recomputes — keep it that
   way). The draw order is `painter.js`. The rules are `RULES`.
4. **Weights, never gates.** Species pull arrivals, bend home choice, cost
   or give mood; they never forbid. The two soft home preferences (fox LV ≥
   50, bear Low lots) are a strict search followed by a lenient one **in the
   same arrival pass** — there is no waiting period.
5. **The dangling-id law.** `removeCitizen` scrubs friends' lists, the
   household, the occupant and staff counts in one call.
6. **Tiles, never people.** Undo restores tiles and refunds; a bulldoze that
   evicted animals is not undoable and says so before release; a road over
   empty chalk unzones without refund and says how many.
7. **Traffic is a readout.** No wind. Both printed in the Rules tab.
8. **Instruments annotate, never halt** — except `check.mjs`.
9. **The save contract.** A new sim field goes into `toPlain` AND
   `fromPlain` or it does not survive a reload; a derived field never goes
   into `toPlain` (it would break the save→load→continue check). Saved:
   the ten tile arrays, citizens (the fields in `plainCitizen`; `path` and
   `stale` reset on load), households, campers, valves, `festivalBonus`,
   events (log sliced to 200), ledger, history, the input log, flags, the
   two RNG states, the two cursors, `start`, `version 1`. Rebuilt:
   roadDist, pol, lv, traffic, crime, coverage, occupants, staff, paths,
   the id maps, `last`, arrivals/departures/meetings, centroid. No
   migration exists yet.

### 2b. Recipes

**A 15th species is five edits, in order:** a `SPECIES` row + a
`NAME_PARTS` bank in `species.js` (+ `PREY_OF`/`ALLIED` if it hunts or is
hunted); a `SURNAMES` entry AND a key in `arrivalWeights().w` in
`citizens.js`; `KNOBS.MESS` if it stinks; the kit in `js/art/citizens.js`
(`HEAD_SPECIES`, `HEAD`, `BUILD`, `CUB_MARK`; `TAIL`/`PATCHES`/`SKIN`
optional); nothing in the suite — it audits the new sprites and asserts
parity (art, weight, character-line noun) by itself. A row without kit art
throws in the browser, not in Node.

**A new 1×1 civic with an effect — copy the fire station, fourteen files:**
`CIVIC` enum (+ `isStation`/`jobsOf`/`jobZone` if it employs) → `KNOBS.COST`,
an `UPKEEP_*`, a `RULES` line → `ops.js` `costOf` case, `apply` switch,
`removeCivic` → the effect as a field in `fields.js` and its one consumer
→ `budget.js` and `census.js` counts → a `solidSprite` in `buildings.js` +
`CIVICS` + `allBuildings` → `render.js` standing switch → `input.js`
`TOOLS`/`PLACE_TOOLS`/name map → `ui.js` upkeep row, stations row, hover
`what` → `playtest --stations` and the shots sheet. The suite checks the
sprite and the ledger; `playtest --stations` and the RULES line check the
effect.

## 3. What the instruments caught (symptom-keyed)

Every fault was a sentence that was not true of the code beneath it, and
only an instrument, a picture or a fresh reader caught it. Keyed by what
you would SEE.

| what it looks like | what it was | where it lives now |
|---|---|---|
| 59% of zoned lots "forbidden" at V=+0.1; nothing grows outside the centre | two 3×3 blurs diluted a single works to ~2 and `LV_BASE 20` made the local term negative everywhere | radial sources in `computePollution`; `LV_BASE 35`; playtest prints this census first |
| a loaded city's hash differs from the straight run; moods off by 1 | a rehomed household kept its OLD commute path, feeding traffic | `placeHousehold` nulls the path and sets `stale` |
| a citizen counted for one tick with no home; alive again after load | events removed households after `compact()` had run | `compact()` after `eventsTick`; `toPlain` filters `dead` |
| a bulldozed lot shows `zone 0 tier 0` but a family still lives there | `clearLot` rehomed them via `bestHome`, which saw the same lot as freshly vacant | ops.js unzones BEFORE clearing; a tick-time no-ghosts guard |
| the town shrinks for years after receivership ends while cash piles up | the county forced rates to n+2 and never gave them back | `flags.ownRates` restored on exit |
| "TORNADO — 0 buildings to rubble" every time | a random line on a 64×64 map | the path passes through a random built lot |
| four beaver dams in forty years eating the riverside | the gate armed every tick | once per 120 ticks (`events.lastDam`) |
| "Zoo City index 100%" with one friendship, cap ×1.5 | a sample of one | H fades in over 20 friendships (`H_FLOOR`) |
| header "+0 net/yr · 50 approval" after load | `world.last` null until the first tick | `refreshLast()` in `rebuildDerived` and after a rate op |
| UPKEEP header ≠ the sum of its lines in the month a bear winter ends | `world.last.budget` is booked at step 6, events expire at step 7 | `ui.js liveBudget()` prints `yearlyFigures` on the current state and folds the rounding residual into the largest line |
| the R chalk is invisible at 1× | accent 5 (`#5E8A3C`) was a hair off grass mid | the R line is drawn in GRASS keys as a 1-px light / 1-px dark staircase (`terrain.js chalkKey`) and `render.js` tints its shade half `m→q`; accent 5 was also repainted `#B8C860` but no sprite uses it for the R line — one of the two is redundant (BACKLOG) |
| the tortoise vanishes on grass | olive limbs + olive shell on olive grass | earth shell, warm skin, a `+` rim (the only outlined sprite) |
| park trees are stumps | the grid was sized from the boxes only; `stamp` clipped rows above | `solidSprite` takes an `extent`; stamps THROW if clipped; check.mjs asserts |
| the zoo hut paints over the pine in front of it | stamps did not write depth | stamps write `a+b+2c` + 2 per row above the feet through the shared z-buffer |
| a walker "on the seam" proves nothing | it stood in the gap left of the tower's face | the scene's four probes are ≥ 12.8 px apart, in the +6 lane |
| fires always start near the station, or never | the origin was a uniform pick | covered lots weigh 1/6 (`FIRE_START_COVERED`) |
| the yearly report says "a skunk undefined" | `characterLine`'s noun tables had 13 entries for 14 species | skunk added; check.mjs asserts a noun per species |
| every arrival is the last species in the table | a species with no `arrivalWeights` key made the total NaN | `pickSpecies` treats a missing weight as 0; check.mjs asserts a weight per species |
| a walker stands in the river on a bridge | `roads.js DECK_TOP` was applied by shots.mjs, not render.js | render.js lifts walkers on bridge tiles by `DECK_TOP` |
| a handoff sentence about "three failed months" | `prefFails` was a saved field nothing incremented | the field is gone; the law says "same pass" |

## 4. The numbers (measured on the committed code, seed 7, rates 8, disasters OFF unless said)

- **Balanced, no civics:** 1,161 by y6, 1,500 by y10, 1,499 at y20, 1,643 by
  y30 under a cap of 1,657 → 1,939 after the founders' festival (y22).
  Cash §84.7k by y30 (+3.7k/yr at the end).
- **Balanced, `--parks 2 --zoo 12`:** 1,852 by y20, 1,948 by y30 under a cap
  of 2,783 → 3,058 (1200 + 300 + 500, × (1 + 0.5·0.78)). Net ≈ +0.3k/yr at
  y20, +2.6k/yr at y30 — with civics the treasury is thin, as intended.
- **Dormitory (R only):** stalls at 63–88, every worker unemployed, V_R <
  0; cash goes negative at y19 and reaches −12.3k by y30 — receivership.
- **Millbelt:** same shape as balanced, pollution NO higher (10–13): the
  mayor never opens enough industry to make a millbelt. A real player would.
- **Over-tax, `--schedule 15:13,22:7`:** 1,521 → 571 by y22 (−62%), back to
  1,613 by y30. `15:14`: → 403 (−74%), back to 1,634. The treasury GROWS
  during the flight (§31.6k → §106.8k): greed pays cash, the revolt's 2% is
  the only argument back. Harsher than the panel's lumped-run target of
  −43% (SPEC §4's targets are the panel's; these are the code's).
- **Crime:** balanced no police: mean 34–39 on built lots, max 73–77. With
  `--stations` (fire + police at t=24): mean 25 the year they land, 33–37
  within three years as the town outgrows their six tiles; a hover-card
  reading beside the station is ~17.
- **Fires:** `--disasters --stations --years 40`, seeds 5, 7, 3, 1: 17 fires,
  0 on covered lots (every line said "bulldoze a firebreak").
- **Tick cost:** ~2.9 ms at 226 citizens (check.mjs), ~6 ms (max ~10) at
  1,650–1,950 (playtest). Machine-dependent.
- **Species (balanced):** y1 leaders cat 15% / tortoise 13% / beaver 11%;
  thereafter pig 14–19%, beaver 11–15%, wolf 10–13%, no species above 20%.
  Dormitory: bears 30–39% from y4 (cottages). Millbelt y1: bears 36%.
- **Earlier commits' numbers still worth knowing:** 14% over-tax at y12,
  seed 9: 1,305 → 270 by y20, back to 1,247 by y26. Millbelt + zoo + 3
  parks, seed 21: 2,343 by y20 under a cap ~3,200, net only +2k/yr.
- **Measured, not acted on (BACKLOG):** H sits at ~0.7–0.8 in every mixed
  city — a diversity dividend on the cap, not a lever a mixed city can pull
  further; a monoculture drops it to ~0.

## 5. How it was built (the method worked — reuse it)

1. **A design panel as a workflow**: two web researchers (Micropolis
   source-level valves; SC3K/SC4 tax and cap rules; Caesar walkers,
   Banished, Animal Crossing, iso art) → three designs from different
   angles (systems / zoo-charm / ship-it) → three judges (player /
   engineer / bedrock). Systems won 2 of 3; the grafts and the twelve
   "holes none of them filled" shaped `SPEC.md`.
2. **The sim written inline by the session, headless first**, with
   `playtest.mjs` as the acceptance instrument BEFORE any pixel. Three bugs
   were caught there.
3. **Art and browser layer as parallel workflows** with disjoint file
   ownership: an artist + two PNG-reading critics (three rounds), a builder
   + a browser play-tester (three rounds, acceptance bar = zero console
   messages). Their round reports are the middle of §3.
4. **The owner's mid-session rulings** went straight into the sim, with
   one art agent per sprite batch.
5. **This handoff** was reviewed by three fresh agents against the code
   before it was committed; eleven of its first-draft sentences were wrong.
   Do the same to yours.

## 6. Where to go next, ranked

1. **The 3×3 landmarks** — `docs/PROPOSAL-LANDMARKS.md`. The owner asked
   for them; the recommendation is that they GROW from a full tier-3 block
   and take their theme from the majority species (The Dairy for cows,
   Truffle Works for pigs, Warren Towers, the Night Market …). About a
   session. **Start with `painter.js`:** `OBLONG_PULLBACK` was audited for
   the 2×2 only — a 3×3 needs a walker-on-adjacent-road audit in
   `shots.mjs --scene` before any sprite; then the merge/unmerge state and
   the suite invariant; then three sprites.
1b. **Crime and punishment** — `docs/PROPOSAL-CRIME-AND-PUNISHMENT.md`
   (later the same day, two panels): zone M meat markets with a dread
   field and the taking (Part I), then the file, the arrest, the 5%
   wrongful and the pacification centre (Part II). Both are proposed, not
   built; Part II opens with three questions only the owner can answer.
   Read the "no-market CSV gate" and "P is cap-pinned" paragraphs before
   measuring either.
2. **Polish the play-testers named** — top of `BACKLOG.md`: the WHY NOT
   tax parenthetical, pause/faster coupling, park hidden behind towers, a
   zoo-cost warning, a loaded city opening paused, the two R-chalk fixes.
3. **Money after real play** — the constants were tuned against a scripted
   mayor with disasters off. Save a real session's input log and
   re-measure.
4. **L1** — road rot, owl academy, wedding, species-skinned buildings,
   minimap, pond removal. **L2** — station staffing as coverage, elevation,
   shore, 128×128, power.

## 7. Diagenesis — what this session stood on

- **Glades of Arcadia**: the 64×32 projection and its laws, the palette
  ramps and the "grass lighter than canopy" rule, the box-solid rasteriser
  (`solid.js` is a port of its header's five faults), `headless-canvas`,
  the creature-kit lessons (mirror + relight, parts not frames).
- **Isolands / Gridlands**: the serve/check/Pages recipe, the painter's
  bottom-up-within-a-cell convention.
- **Micropolis** (SimHacker source): `SetValves`, the tax table, the crime
  line, the fire and disaster rosters — the bedrock the panel re-derived.
- **The panel's three designers and three judges**; **the artist and its
  critics**; **the builder and its play-testers**; **the three handoff
  reviewers** — the agents whose reports are quoted throughout.

## 8. The owner's rulings this session (verbatim — quote, do not paraphrase)

- *"lets build zoo city 2000, an isometric city builder where anthropomorphic characters live and grow together in a city.  the builder must balance residential, commercial, and industrial zoning as well as taxes and random events."*
- *"i think the game should have pigs and cows.  there is also a notable absence of predator species."* → pig, cow; wolf, cat, hawk; `PREY_OF`, prey flight, the bridge friendship counts double.
- *"pigs should have a trash/mess multiplier too so they pair well with raccoons."* → `KNOBS.MESS`; raccoons prefer dirt.
- *"this is a great first pass.  fire is working.  i don't see any pigs in the game yet, and police and fire is noticeably absent"* → pig pull raised; fire and police stations; the crime field; the heist.
- *"can you add skunks too?"* → the skunk: nobody's prey, stink 1.0, only pigs and raccoons tolerate it.
- *"just a quick nudge, i'd like fire departments to make fires not impossible, but statistically unlikely when there is a fire department nearby."* → `FIRE_START_COVERED 1/6`.
- *"lets also think about adding more specialized 3x3 tile sprites for some special themed buildings.  things like themed commercial shops, an industrial dairy, or a residential apartment building."* → `docs/PROPOSAL-LANDMARKS.md`; not started.
- *"lets write a handoff when you are done.  this is your chance to leave your keystone"* → this file.
- *"lets think about how we can add predation to the game as part of crime.  perhaps with a custom zoned commercial space for grey market meat markets.  herbavores do not like living near meat markets, it should have a similar negative devaluing as industrial, but perhaps even stronger."* → zone M, dread at 2× a works, the killing; `docs/PROPOSAL-CRIME-AND-PUNISHMENT.md` Part I.
- *"for the crime and punishment section, lets add a pacification center.  a place where troublesome predators can be fixed so they are no longer a threat to prey species.  fixed animals cannot have offspring and are no longer interested in attacking prey.  prey can also be pacified if they are caught in a crime.  and just to make things a little more realistic, lets add a 5% chance that the police arrest the wrong person."* → the file, the arrest, the centre, `fixed`; Part II.
- *"one design change to crime and punishment, since pacification is a one time process, multiple offenses should send the citizen to the meat market.  that might also be a better first stop for prey who commit crimes.  1. crime should be weighted by unemployment, no jobs means hungry wolves.  2. no, random based on proximity.  i think it should be possible for prey to murder too, but just much less likely.  3. yes"* → the sentence table (predator → centre once; prey or the fixed → sold at the hall); the killing weighted by unemployment ×20 and by diet (herbivores 0.03); the wrongful pool by proximity; a fixed wolf keeps the counter. See §10.

## 10. Session 3 — crime and punishment (2026-09-02, later; SPEC §9c)

**What shipped, in one paragraph.** A fourth zone, M (meat halls: stall /
meat hall / cold store), on its own carnivore-keyed valve, with a DREAD
field at exactly twice a works' LV shadow that herbivores read (mood, home
score, a rehome rule) and carnivores do not; a hall is a crime hill, pays
an untaxed cut, can be licensed (a deterministic card), raided, and
marched on. THE KILLING (`justice.js`): any adult may kill a neighbour,
weighted by diet (carn 1 / omni 0.1 / herb 0.03), unemployment ×20, a
hall's smell ×3, hall staff ×2, crime at home; the victim is the killer's
prey ×1 or anyone ×0.1, a friendship ×0.1; the wake befriends the mourners.
Every incident (a killing, the heist — now any adult, weighted — a
burglary, a raid) opens a FILE; police cover is the monthly arrest
probability; 5% of arrests take the wrong animal by proximity; the
SENTENCE is the owner's table (a predator's first conviction → the
pacification centre, six months, home FIXED; prey or the already-fixed →
sold at the hall; else the cells); `fixed` is one saved boolean read by
five rules; EXONERATION pays §500 when the real one is taken. Fourteen
files, one new module, 67 checks.

**New laws (the suite enforces them).** `absent(world, c)` (world.js) is
the ONE custody predicate — isWorker, computeCrime's inline copy (the
two worker predicates are checked against each other), prey flight,
births, walkers and every pool read it. `releaseJob(world, c)` is the ONE
job release (retirement, decay, bulldoze, custody — retirement used to
leave `hired` stale). `events.files` is the one incident list: the crime
stain, the investigation and the overlay ring are all the same struct.
Ticker prefixes live only in `events.js` `TICKER_*`. No pronoun in any
line (the sim has no sex field; the suite greps the log). Every named
culprit is an adult (the old `robbers()` could name a cub).

**Traps this session, keyed by what you see:**

| you see | it is | do |
|---|---|---|
| the suite's dread check reports `halls 0` | the scripted city's M row burned in a year-7 fire (disasters are on in `buildCity`) — rubble carries no dread | measure field invariants on a clone with the tiers FORCED (the check does), never on the city's history |
| a forced killing empties the town, then `wrongful 0` | `KNOBS.KILL_P = 1` makes `k = floor(Σ + r)` ≈ Σ killings — every adult a killer; the arrest then finds no neighbour to wrong | force exactly ONE: `KILL_P = 1 / killTotal(world)` (exported for this) |
| `held 0` after a forced conviction | the target was prey, or already fixed, and a hall stood → SOLD, not taken in | the sentence table is doing its job; loop the forcing until a bed fills (the check does) |
| COLD lines every month | burglary files closing — a 150-animal town with a hot R block and a station made six a year at `BURGLARY_P 0.02` | 0.006 now, and only a killing's file prints COLD |
| the M lots read NO_DEMAND from year 6 | `V_M` goes negative once ~72 M jobs stand (rM caps at 0.06·carnivores + 10) — by design, the legible cap | more carnivores, not more halls |
| `--rates 8` / the print regex / a cub named as a thief | three instrument faults the panels found on the way (944e507, def96dc) | — |
| the baseline hash moved (a9b2665b → d19d6969 on seed 7) | the killing draws once a month wherever an adult lives, and the demographics move with it (seed 7's cap rose 1939 → 2215: a second Founders' festival fired) | the no-market byte-equality gate is retired; 67 checks are the gate; re-baseline on a sim bump |

**The numbers (30 years, rates 8, disasters off; `playtest --markets 2 --stations --pacify`):**

| rig (seed 7 · 3 · 5) | killings | arrests (wrongful) | fixed · sold | halls (jobs) | herbivores in the smell | cash y30 |
|---|---|---|---|---|---|---|
| no hall, no station | 7 · 4 · 3 | 1 · 0 · 0 | — | — | — | 86k · 105k · 105k |
| two hall blocks | 13 · 5 · 16 | 1 · 0 · 2 (0 · 0 · 1) | 0 · 0 · 0 / 0 · 0 · 1 | 16 · 11 · 16 (71 · 64 · 68) | 18 · 3 · 6 | 78k · 135k · 112k |
| + a police station, a fire station, a centre | 11 · 8 · 14 | 9 · 6 · 7 (0) | 1 · 3 · 2 / 4 · 2 · 2 | 15 · 19 · 14 | 19 · 5 · 0 | 21k · 34k · 54k |
| stations + centre, no hall | 7 · 6 · 6 | 4 · 4 · 8 (0 · 0 · 1) | 3 · 1 · 7 / 0 | — | — | 17k · 36k · 40k |
| a jobless dormitory of 80 (20 y) | 3 | 0 | — | — | — | −2k |

Population never moves with any of it (cap-pinned). The cut runs ≈ §1.4k/yr
for two blocks; a centre and two stations cost §1.7k/yr; the crater on the
R tax is the rest of the gap. Tick 6–7 ms at 1,700.

### 10b. The crime-and-punishment rulings (the build's decisions on top of the owner's words — quote §8 for theirs, this list for mine)

Each is a decision a builder could have made the other way. The reason is
the thing to argue with, not the number; the number is a KNOB.

1. **The killing replaced the staffed-hunter "taking."** The owner said
   crime is weighted by unemployment and prey may murder too; a taking
   rolled only by a hall's staff could do neither. Any adult rolls, by diet
   × hunger × the hall's smell × the knives × crime at home. The hall is the
   BUYER and the DISPOSAL, not the only killer.
2. **Complaints are gone.** The panel's volume channel (a prey household
   filing on a feared neighbour) was pre-crime; the owner chose hunger as
   the driver. Arrests now ride crimes only. The cost is honest: in a fed,
   fully-employed town the centre sees ~1 conviction per 4 years.
3. **Diet is a species column, the `predator` flag stays what it was.** Fox
   and owl hunt without the flag (it is the skunk-incident gate); `diet`
   keys every new term so that flag never grows a second meaning.
4. **The wrongful pool is proximity only, 1/(1 + d), no species term.** The
   owner: "random based on proximity." A rabbit can be sold for a wolf's
   killing; the census counts it and EXONERATED names it.
5. **The sentence table.** Predator (carn or omni), first conviction → the
   centre; prey, or anyone already fixed → the hall (sold); no bed / no
   hall → the cells. "Pacification is once" is printed on the SOLD line.
   Omnivores count as predators here (a bear in the cells is not a bear on
   the counter); if the owner wants bears sold first, it is one diet test.
6. **A fixed animal keeps any job, the counter included** ("3. yes"), and
   is simply weight 0 in the killer pool.
7. **Prey flight is proportional** (unfixed share of the species in the
   3×3), because a per-species Set let one fixed wolf out of a pack of five
   change nothing — measured 5.2 adults of the feared kind beside every
   afraid household.
8. **A fixed predator's prey friendships count ONCE in H**, at affinity 0.7.
   The knife buys quiet, not the index; `census.hKnife` shows the share.
9. **Dread is its own field, not pollution** — pollution pulls raccoons and
   pigs and refuses R growth; the owner's rule is herbivore-specific. Twice
   a works at every ring (105 over 4 × 0.8), carnivores net 0.
10. **Zone M has its own valve** (0.06·carnivores + 10 − Jm), Jm ∉ Jc:
    V_C is negative 26 of 30 baseline years and shops must not be starved.
11. **Grey means untaxed but not unpaid**: the cut is §25 per filled job,
    immune to the rate; the licence is what puts the jobs on the books,
    and it is offered deterministically (a weight-2 card would come once
    per 15–40 years).
12. **The raid is a BOON kind** so the No-disasters toggle never masks the
    police working; the Greens' League likewise.
13. **Burglary is station-gated and slow** (0.006 per hot lot, cap 0.3):
    the panel's 0.02 gave a 150-animal town six a year. Only a killing's
    file going cold prints COLD.
14. **The heist's thief is now any adult within 4, weighted, adults only.**
    The old pool was a species gate and could name a cub.
15. **Custody keeps the home and releases the job through one function.**
    `absent()` is the one predicate; `releaseJob()` the one release
    (retirement had been leaving `hired` stale).
16. **The centre is an employer, not a station.** `isStation` drives
    coverage; `isCivicEmployer` drives jobs; a centre in `isStation` would
    have grown a police ring.
17. **No pronoun anywhere.** The sim has no sex field; the suite greps the
    log for he/she/his/her/him.
18. **The no-market byte-equality gate is retired.** The killing draws once
    a month wherever an adult lives, so every baseline hash moved; 67 checks
    are the gate and the numbers in §10 are the re-baseline.

**Where to go next** is the top of `BACKLOG.md` (hunger visibility, the
5%'s visibility, customer walkers, supply from funerals, the abattoir).

## 11. Session 4 — the title screen and the cheat (2026-09-02, evening)

The owner left a painting at the repo root ("some title art to make a home
screen") and asked for the title text, five buttons (new game, save, load,
continue, options) and a cheat in options — unlimited cash for folks who
want freedom to build — then, on the design question, ruled: *"if you want
it to unlock a 'give me cash button' thats a good middle option."* Built
as ruled.

**What shipped.** `js/title.js` (one overlay: the painting under the name,
the bar of five, one card for the panels); `img/titlescreen.png` (the
owner's file, byte-exact, moved from the root); the `cheat` op in
`ops.js`; `exitReceivership()` in `budget.js`; `KNOBS.CHEAT_CASH` /
`CHEAT_MAX`; the Esc handling in `input.js`; `zoo.pref`, `app.entered`
and `app.cheat()` in `main.js`; the three dialog builders in `ui.js`
(`foundForm`, `savesList`, `portBox`) the title mounts; the strip's
`menu` button and the `+§100,000` button beside cash; thirteen new checks
(80 total). SPEC §8, §11, §15; README; BACKLOG.

**Laws added (the suite holds them):**
- **The cheat is an op.** `budget.post` is still the only cash path; a
  press posts under ledger key `cheat`, goes into the input log, replays
  to the same hash, is clamped to `CHEAT_MAX`, and never touches the undo
  stack. If it clears a receivership the books come back at once, through
  the same `exitReceivership()` the budget tick uses — one function.
- **The sim never reads a preference.** `zoo.pref` (the cheat switch) is
  the browser's; a city carries only the ops. The suite greps `js/sim` for
  `zoo.pref|localStorage`.
- **The title is a modal.** `ui.modalOpen()` counts it, so the clock stops
  under it and the keys are its own; `main.js` skips the draw while it
  stands. Boot no longer opens the new-city dialog — the title stands over
  whatever boot found.
- **`app.entered` is the one "a city is in play" bit.** `adopt()` sets it;
  boot clears it for the fresh default map. CONTINUE, SAVE, the Options
  button and the autosave-on-hide all read it — an untouched default map is
  never autosaved over a real city's `zoo.last`.

**Traps (keyed by what you see):**
- *A flash you sent never appeared* — the painting covers `#flash`.
  `ui.flash()` routes to the title's note line while it stands, and
  `close()` re-flashes the last routed line on the map (a resumed city's
  "paused; Space resumes" line wins if nothing changed).
- *"budget.post is the only cash mutator" fails on a UI file* — the grep is
  `\bcash\s*(\+=|-=|=)`, so `const cash = w.cash` in any `js/` file trips
  it. Read `w.cash` inline.
- *Two checkboxes toggle together* — the N dialog and the title's NEW GAME
  panel can both be in the DOM; the found form's checkbox id is per
  instance (`noDisasters<n>`).
- *Esc does nothing* — it is two-step on the map: a drag or a pinned card
  is cleared first, the next Esc opens the menu. On the title, Esc backs out
  of a panel first, then closes (only when a city is in play).
- *CONTINUE is greyed after boot* — no slot was readable; the default map is
  not in play. NEW GAME founds one; LOAD reopens or imports.
- *The choice card is under the painting* — an event offer pending at boot
  shows the moment CONTINUE drops the title (`adopt()` showed it already).
- *The working tree is CRLF* (`core.autocrlf=true`): a patch script that
  matches LF anchors finds nothing. Normalise on read, write back in kind.
- *The page scrolls sideways after a click* — `#tools` is 1,600 px of
  buttons; unwrapped, it widened the document past a 1280 px viewport and
  any focus scrolled it (scrollX 331). It wraps now (`flex-wrap`); the
  title's focus calls pass `preventScroll`.

**Verified.** Suite 80/0. Browser on a fresh origin: the painting, the name
over the dark sky, the five buttons; OPTIONS with the switch off hides the
button; NEW GAME → FOUND THE CITY drops the title and the "one road in"
flash fires on the map; Esc reopens with CONTINUE primary and the city
line; the switch on shows GIVE ME §100,000 (off with no city, on with one)
and the `+§100,000` button appears beside cash; a press books it (cash
§120,000, ledger `cheat +§100,000`, the Budget tab's note); SAVE writes the
checkpoint and LOAD lists it; a reload stands the title over the resumed
city and CONTINUE flashes "paused; Space resumes". Console empty.

## 9. Verification recipe (what "done" looks like here)

```
node tools/check.mjs                                   # 47 checks, 0 failures — the gate
node tools/playtest.mjs --years 30 --quiet             # the §4 curves (disasters off)
node tools/playtest.mjs --years 30 --parks 2 --zoo 12 --quiet
node tools/playtest.mjs --disasters --stations --years 40 --seed 5
node tools/shots.mjs                                   # sheets + scene, then READ the PNGs
node tools/serve.mjs --port 8142                       # open it, N for a fresh city, zoo.advance(36), look, read the console (must be EMPTY)
git push origin main                                   # Pages builds in ~1–2 min
```

**What the suite does NOT prove:** it never rasterises a sprite through
`render.js`, never judges balance, and never watches the clock — those are
`shots.mjs`, `playtest.mjs`, and your eyes in the browser. A green suite
with an ugly sheet is not done.
