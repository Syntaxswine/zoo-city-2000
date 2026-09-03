# HANDOFF — the first zoo (2026-09-02)

The keystone for whoever builds next. One session took Zoo City 2000 from
a sentence to a live game; this is what that session knew by the end and
where it would go next. Read it before touching anything. `SPEC.md` is the
design record, `BACKLOG.md` the open work; this file is the *why* and the
*traps*. It was reviewed by three fresh agents before it was committed
(code-truth, blind newcomer, completeness); §3's last rows and half of §1
are theirs.

Six sessions have written into it, on one long day. §1–§9 are the first
zoo; §10 crime and punishment; §11 the title screen and the cheat; §12 the
walls / use-zoning / rail tranche; §13 the news. Two makers have signed it —
the marks are at the foot, oldest first, and neither edits the other.

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
- **Before touching a file:** `node tools/check.mjs` — 139 checks, exits 1.
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
  `newCity({seed, noDisasters})`, `cheat()`, and since §13
  `news.open() / .close() / .unread()`. `advance` autosaves every 12 ticks and
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
- **Keys** (the strip is the truth — `TOOLS` in `js/input.js`, then the
  `mk(...)` buttons in `ui.js`): `1 R · 2 C · 3 I · M Meat · 4 Road ·
  B Wall · T Rail · G Station · U Use · 5 Tree · 6 Park · 7 Zoo ·
  F Fire stn · P Police · V Pacify · 8 Bulldoze · 9 Inspect · D density ·
  Space pause · , . speed · Z undo · S save · L load · O overlays ·
  R news · +/− zoom · arrows / WASD / right-drag pan · N new city ·
  Esc menu`. `S` and `D` are tap = command, hold > 220 ms = pan. `U`
  pressed while the Use tool is already up cycles mixed/pred/prey. Shift on
  a road drag = straight. Undo is one step, this month only, and any op
  with `evicts` empties it. (This line was stale for three sessions — it
  still listed the session-1 tools only. If you add a tool, edit it here.)

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
| `js/sim/events.js` | the rolled roster (21 kinds — `ROSTER` in `events.js` IS the list; do not count them here, read them there) + bear winter and the tortoise centenary (calendar/rule driven), timed effects, fire spread, the choice card, `EVENT_TITLES` | disasters never chain within 12 ticks; receivership lives in `budget.js` |
| `js/sim/budget.js` | `post()` — **the only cash path**; `yearlyFigures`; receivership (restores `flags.ownRates` on exit) | integer § |
| `js/sim/ops.js` | every player action: `costOf` (`replaced`, `evicts`), `apply`, `undo`, `roadL`, the input log | tiles, never people |
| `js/sim/save.js` | `toPlain`/`fromPlain`, `rebuildDerived`, `stateHash` (FNV over `toPlain` minus `log` and `history` — `events.log` IS hashed) | the hash law |
| `js/sim/species.js` | 14 species (`pack`, `predator`, `stink` flags), `PREY_OF`, `affinity`, `NAME_PARTS` | weights, never gates |
| `js/art/*` | text sprites `{rows, anchor, w, h, footprint, tags}`; `solid.js` box rasteriser; `buildings.js` (`solidSprite`, `CIVICS`, `PLANS`, stamps throw if clipped); `citizens.js` (the kit); `roads.js` (`DECK_TOP`); `terrain.js`; `index.js` (the registry) | every pixel a palette key; `tags` building/civic/overlay opt INTO the footprint audit |
| `js/iso/iso.js`, `js/iso/painter.js` | the projection; **the one draw order**: `key = (cell + frac − 0.7·[oblong])·1024 + z` — `OBLONG_PULLBACK` applies to any footprint > 1×1 and was ray-audited for the 2×2 only | a 3×3 needs its own audit |
| `js/render.js` | the only canvas module. **Static layer = ground only**; buildings, trees, civics AND walkers are re-sorted and blitted every frame through `painter.js` — that is how one order exists. Overlays `off → lv → pol → crime → dread → use → score` (`OVERLAYS` in `main.js` — session 5 added two and this row missed them until session 6; the `O` button's tooltip still names only four); zots on static rebuild | |
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
approval ≥ 50, 120-tick gap) · scrubbers (I lots ≥ 15; `choice: true`) ·
**raid** and **greensLeague** (session 3's crime arc; this list said 19 for
three sessions and the roster was 21 — read `ROSTER`, and add yours here).
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
   the thirteen tile arrays (`TILE_ARRAYS` in `save.js` IS the list — it said
   ten here until session 6 counted them; read it there, never here),
   citizens (the fields in `plainCitizen`; `path` and
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

- **Balanced, no civics:** 1,267 by y6, 1,481 by y10, 1,489 at y20 under a
  cap of 1,964, **1,638 by y30 under a cap of 1,938, cash §70.9k**. *Re-measured
  in session 8 (`playtest.mjs --years 30 --quiet`, seed 7, rates 8). It read
  1,161 / 1,500 / 1,499 / 1,643 and §~from session 2, then 1,126 / 1,508 /
  1,599 / 1,742 and §86.0k from session 6, and session 8's crime rebalance
  moved it again: an unpoliced town is now BURGLED (−§2,440 over the run,
  in the ledger) where it used to be immune, which is the intended cost of
  building no police. **§4 is only ever true of the commit that measured
  it** — re-run before you quote it. Three sessions running, it was stale.*
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
- **What a station buys** (session 8, `serviceprobe.mjs`, a nine-block town
  over 40 years): police 0 / 1 / 2 / 4 / 12 → mean crime 43.7 / 34.5 / 28.7 /
  15.8 / 3.7, lots hot 20.8% / 15.5% / 13.1% / 1.9% / 0.4%, files solved 0% /
  22% / 30% / 53% / 56%. Fire, per 80 forced fires: buildings lost 535 / 520 /
  423 / 195 / **7.5**, saved by the engine 0 / 4.8 / 15.1 / 34.6 / **73**.
  Monotone in every column, which is the point — before session 8 the first
  police station DOUBLED the hot lots and the clear-up rate was flat at 9%.
  §15 has the before/after and the rig.
- **Fires:** `--disasters --stations --years 40`, seeds 5, 7, 3, 1: 17 fires,
  0 on covered lots (every line said "bulldoze a firebreak").
- **Tick cost:** ~4.3 ms at the scripted **242** citizens (check.mjs), ~7.5 ms
  (max ~9) at 1,650 (playtest). The ms is this machine's; the citizen
  count is deterministic, so if `check.mjs` no longer prints 242 the fixture
  changed and this row is stale again (226 until session 6, 210 until 8).
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

*Written in session 2 and corrected in session 6. The old entry 1b —
crime and punishment, "proposed, not built" — **SHIPPED** in session 3 at
`f744ce2`, Part I and Part II both; §10 and §10b are its record, and what
is left of it lives in BACKLOG, not here. It is struck below rather than
deleted: the ranking is part of the archive.*

1. **The 3×3 landmarks** — `docs/PROPOSAL-LANDMARKS.md`. The owner asked
   for them; the recommendation is that they GROW from a full tier-3 block
   and take their theme from the majority species (The Dairy for cows,
   Truffle Works for pigs, Warren Towers, the Night Market …). About a
   session. **Start with `painter.js`:** `OBLONG_PULLBACK` was audited for
   the 2×2 only — a 3×3 needs a walker-on-adjacent-road audit in
   `shots.mjs --scene` before any sprite; then the merge/unmerge state and
   the suite invariant; then three sprites.
1b. ~~**Crime and punishment** — `docs/PROPOSAL-CRIME-AND-PUNISHMENT.md`
   (later the same day, two panels): zone M meat markets with a dread
   field and the taking (Part I), then the file, the arrest, the 5%
   wrongful and the pacification centre (Part II). Both are proposed, not
   built; Part II opens with three questions only the owner can answer.~~
   **SHIPPED, session 3 (`f744ce2`) — see §10.** The "no-market CSV gate"
   and "P is cap-pinned" paragraphs still hold and are still what you read
   before measuring anything in that arc.
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
- *"i'd like a news button, something where you can read the updates that pop up on the screen in a sequential order."* and *"oh, looks like the news exists under the log tab"* → `js/news.js`, the strip button, the reader, the News tab, the flash queue. See §13.
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

## 12. Session 5 — zoning, rail and walls (2026-09-02, night); all three phases shipped

The owner's tranche and the pointer to Glades are verbatim in
`docs/PROPOSAL-ZONING-RAIL-WALLS.md` (§0), with the census, the mechanics,
the numbers and the build's rulings (§5). Three phases, three commits.

**Phase A — walls (SPEC §6b, §12.4b; `js/sim/reach.js`, `js/art/walls.js`).**
- **The reach law is Glades'.** `forEachWithin(world, i, R, fn)` is the one
  primitive every area effect and every radius query goes through: the
  Chebyshev square when the city has no walls, the 8-connected flood round
  them when it does. The suite's first wall check forces the flood on the
  wall-less scripted city and requires every field byte-equal to the square
  — prove the frame first; the frame held on the first run.
- **A tunnel is a connector.** `occl[i]` is Glades' direction mask; a road
  across a wall opens the road's axis and nothing else. Measured on the
  fixture (a tier-3 works, a wall row two tiles off, the probe behind it):
  open 28 → walled 0 → through the tunnel 28+ on the road, weaker beside it.
- **Road reach stops at a bare wall** (`computeRoadDist`, `doorOf`): a lot
  walled off has no door. Tunnels are roads and pass.
- **Justice reads the flood**: `adultsWithin` returns `{ cands, dists }`;
  the killing, the wrongful pool, the thief pool and `hallNear` cannot cross
  a wall. `cheb` survives only in `hallWithAccess` (nearest hall in town —
  not an area effect).
- **Ops.** `wall` is an L-drag op (tiles list, like `road`); never on
  water / chalk / civic / built; a road op across a wall tile threads it
  (no refusal). Bulldoze takes a tunnel's wall first. Walls and roads share
  the dirty flags (`roadsDirty`, `wallsDirty`) and both invalidate paths;
  undo restores `wall`.
- **Art.** Two clipped bars per mask (no arm boxes: a bar's end is a real
  cut end), coping lighter, end darker; the tunnel is two piers and a lintel
  drawn STANDING over the road tile.

**Traps (keyed by what you see):**
- *A field check fails only with the flood forced* — a diagonal rule or the
  source tile differs from the square. The square calls fn(source, 0); the
  flood must too, and unit diagonals are the whole reason it matches.
- *The smell gets through a wall corner* — two walls meeting only at a
  corner: the no-corner-cutting rule needs BOTH orthogonal neighbours to be
  walls; an L drawn by `roadL` is 4-connected and never leaks.
- *A lot beside a new wall says "no road"* — by design: `roadDist` stops at
  a bare wall. A tunnel is the way.
- *`adultsWithin` returns an object now* — `{ cands, dists }`; the old
  array callers were the thief pool and the wrongful pool.
- *Wall sprites missing from a sheet* — `allSprites()` has them
  (`allWalls()`), but `tools/shots.mjs` has no walls sheet yet (BACKLOG).

Suite 80 → 91.

**Phase B — use-zoning and trespass (SPEC §7.8, §9d; `species.admits`,
`fields.dial / commutePath / exposure`, `justice.trespassTick`).**
- **The gate is the player's, not the species'.** `admits(use, species)` in
  `vacantLots` and `searchJob`; nothing else in the roster changed. The
  suite: two years after painting R prey-only and C predator-only, nobody
  lives or works where the line forbids, and the departed are gone clean.
- **The weighted commute replaces the BFS, node for node.** `dial()` is
  Dial's buckets with FIFO inside a bucket and the BFS's neighbour order;
  the frame check holds every commuter's stored path tile-equal to
  `roadPath` on the unpainted city. `save.rebuildDerived` MUST use the same
  search — the first run used `roadPath` and a loaded city under the line
  took different roads (the hash caught it).
- **The notice.** `hh.notice` (saved) counts months on a forbidding lot;
  at 3 the household rehomes within 12 road tiles under the gate or leaves
  ("ZONED OUT", `last.zonedOut`, `cit.zonedOutLines` → the ticker). Workers
  on a repainted lot are released at the stale pass (`invalidatePaths` on
  every `use` op).
- **The stop is on the spot.** `trespassTick` draws only where `p > 0`;
  `arrest(…, { minor: true })` sends the animal to the cells for a month
  (`held = tick + 1`: absent for the rest of the month, released at the
  next tick's start) with `record++`; at `RECORD_HARD` 3 the table applies
  and the arrest record carries `hard: true`.

**Traps (keyed by what you see):**
- *A paint on the year-15 scripted clone does nothing and every check after
  passes* — the clone cannot pay (receivership / no cash) and the op is
  refused silently. Fund the clone through the cheat op and ASSERT the
  paints took. The easy case cannot test.
- *"in cells 0" after a forced stop* — a one-month sentence is
  `held = tick + 1`, which equals `world.tick` after the tick; read the
  stop off the arrest record and `held === tick`, not `held > tick`.
- *Forced stops outnumber the animals in the cells* — the line was live,
  unforced, for the fixture's 24 ticks; count this month's stops as the
  counter's delta.
- *Nobody is exposed* — the prey block's doors are on a mixed road; only a
  door ON a forbidden road (or a forbidding lot) exposes anyone, and only
  under police cover. The fixture paints the ring's north row and east
  column, where the C and I doors are, under the station's cover.

Suite 91 → 103.

**Phase C — rail (SPEC §7.9, §12.4c; `fields.dial` two layers, `nodePath`,
`commuteTime`, `rides`; `art/rail.js`).**
- **Two layers, one search.** Node = tile + layer·n; walk nodes on road
  and station tiles, ride nodes on rail; board and alight free at a
  station. The frame held again: with no rail the search is Phase B's.
- **The ride bit is in the path.** `c.path[k] & 0x8000`; every reader goes
  through `tileOf / riding`: traffic, walkers, exposure, the mood's commute
  time, the suite's path check. A station collapses to ONE walked entry.
- **A tunnel reads the way ON its tile.** `tunnelMask` uses road neighbours
  for a road tunnel and rail neighbours for a rail tunnel — the first draft
  read any way next door, and a road running beside a rail tunnel opened
  the tunnel sideways (the suite: occl 0x55 instead of 0x11).
- **Riders are counted at the census, which runs before the job search**:
  after a rail op (paths invalidated) the first tick's census sees no
  paths and no riders; the second tick's does. Traffic likewise.
- **v1 limits (BACKLOG):** no rail bridges, no level crossings, no train
  sprite (riders sit 3 px up at ×3).

Suite 103 → 113. The tranche is complete: walls (A), use-zoning and
trespass (B), rail (C) — three commits on the proposal.

## 13. Session 6 — the news (2026-09-02, late; SPEC §11b)

The owner asked for one thing: *"i'd like a news button, something where you
can read the updates that pop up on the screen in a sequential order."* Then,
seeing the panel: *"oh, looks like the news exists under the log tab"* — it
did, and that was most of the point. The Log tab was there, buried, and read
NEWEST FIRST.

**The cause, and what it was actually worth.** `flash()` overwrote itself:
`onTick` looped the month's notices and called it once per line, each clearing
the last one's timer and its text. A month that delivered four headlines
showed the fourth for 2.6 s and dropped three.

I wrote that up as the whole story, including in the commit message. Then I
measured it, and it is not. **Four seeds, thirty years each, the same
eight-block layout with a meat-market row, a fire station and a police
station:**

| seed | dispatches | popped up | never popped | months popping >1 | lost to the old flash() |
|---|---|---|---|---|---|
| newsroom | 133 | 21 | 112 (84%) | 1 | 1 (max 2 in a month) |
| 7 | 124 | 29 | 95 (77%) | 1 | 1 |
| 3 | 153 | 32 | 121 (79%) | 1 | 1 |
| 5 | 78 | 20 | 58 (74%) | 0 | 0 |

`node tools/newsprobe.mjs` prints exactly this table (`--csv`, `--years`,
`--seeds` for the rest). It is committed because a handoff table nobody can
re-run is the drift this document warns about: the first version of these
four rows came from a throwaway harness that went nowhere, which a reviewer
caught by trying and failing to reproduce them.

The overwrite is real and it is RARE — about **one headline lost per thirty
city-years** in a scripted town, and the six-line month I tested against does
not occur there; I made it by hand. Where it should bite is a crime-heavy
city: the sentence table can put SOLD, TAKEN IN and CELLS in one month.

**The real case for the button is the other column.** Only `TICKER_FLASH`
lines ever popped up at all, and they are 16–26% of what the city says.
**Between 74% and 84% of every dispatch was never on screen for one second** —
it existed only in a tab behind Rules / Budget / Census that printed
newest-first. That is the thing the owner was reaching for, and my first
framing of it was measured wrong. Correcting it is the point of §13: the fix
is the same fix either way, but the reason it is worth having is a different
sentence, and only one of the two is true.

**What shipped.** `js/news.js`: `newsRows(world)` (the one feed) and
`createNews(app)` (the reader). A `news` button on the strip carrying the
unread count, ink-filled while any stands. `R` opens the reader: the feed
oldest first (the last 400 dispatches — the log is capped there, so a long
city's founding years are gone, not hidden), a cursor stepped with ← → (and
↑ ↓ / WASD, which step one; PgUp/PgDn step ten — nothing scrolls, and the
reader's own legend claimed otherwise until the review panel read it), four chips
(all · headlines · trouble · good), `mark all read`, opening on the FIRST
UNREAD, the clock stopped under it. The Log tab became the News tab reading
the same feed chronologically, following the newest unless you scrolled up.
And `flashRun` plays a month's run through, `(2/6)`, capped at five with a
`+N more this month — R opens the news` tail.

### 13b. What the work turned up (symptom-keyed)

- **Two REPORT lines a year, on every loaded city, since the Log tab was
  written.** Symptom: the feed showed `REPORT 2029 … net +§130/yr` and
  `REPORT 2029 … net +§980/yr` in the same month. The advisor already logs a
  yearly REPORT (tick.js:132, the rich one — halls, justice, the character
  line) and `setWorld` synthesized a second out of `world.history` (the thin
  one), computed from a different book, hence the two nets. It only appeared
  after a LOAD, which is why it survived. Fix: the log IS the feed; the
  synthesis is gone. Canonical is the richer narrator.
- **A read mark named by position is one roll from pointing at the wrong
  story.** `keyOf` was `t.k` — the row's place in its month. tick.js caps the
  log at 400 and save.js keeps 200, so a roll can cut a month in HALF and the
  survivors come back renamed. Now `t.fnv32(text)`: a dispatch is named by
  its own words.
- **A check that could not fail.** The first version of that check cut the
  log at a fixed index — which landed on a month BOUNDARY, where the two
  naming schemes agree. It passed under the bug. The check now FINDS a month
  with two lines in it and cuts inside, and refuses (rather than passing)
  when the fixture has no such month.
- **A check that could not discriminate.** The second version asked whether a
  row's name still EXISTED after the roll. It does — bound to the neighbour.
  Membership was the wrong question; the check now compares what each name
  RESOLVES TO, and catches 2 re-bound rows under the mutation.
- **A hidden browser pane throttles timers and then suspends them.** A
  six-line flash run showed 3 of 6 at 2.0 s spacing and then stopped dead —
  the pane, not the code. Anything paced by `setTimeout` cannot be timed in a
  hidden pane; test the SEQUENCE synchronously instead (the first line shows,
  labelled 1 of 6, where the old code showed the sixth) and time the pacing
  only with the pane in front.
- **A deterministic replay marks its own future read.** Advancing the same
  city over the same months regenerates identical dispatches, which carry
  identical names, which were already in the read set — so "unread" stayed 0
  and looked broken. It was the naming working. Clear the marks AFTER the
  fixture is loaded, not before.
- **`z.ui.onTick(list)` only flashes lines matching `TICKER_FLASH`.** A test
  with prettified strings (`'A FIRE one'`) queues nothing at all. Use real
  prefixes.
- **The CHOICE card blocks the keyboard.** A pending choice makes
  `modalOpen()` true, so `R` does nothing and arrows do nothing. That is
  correct, and it will look like a dead key: answer the card first.

Suite 113 → 132. Verified in the browser on a 30-year, 592-animal city:
180 dispatches, feed length == log length, 30 reports for 30 distinct years,
badge and unread count exact against dispatches added, reader opening on the
first unread, WASD not panning behind it, read marks surviving a real page
reload (3 unread before, 3 after), and zero console messages throughout.

### 13c. Ammunition already gathered for the NEXT arc

Before the owner redirected to the news, a nine-agent census of every
subsystem the **3×3 landmarks** touch (painter · lots/growth · citizens ·
world/save · ops/events · art · fields/reach · UI/census · tools) ran to
completion — symbols, file:line hooks, and the invariants a merged nine-tile
lot would violate. It is in this session's task output; if it is gone, it is
one workflow to re-run. Two findings worth carrying regardless:
`depthOf(tx, ty, fw, fh)` already generalises to any footprint, and
`OBLONG_PULLBACK` is footprint-size-BLIND — a 3×3 gets the same 0.7 a 2×2
gets, which is exactly the audit the ranked list demands first.

### 13d. What I distrust in what I left

Not bugs — things I could not close, written down so the next reader does
not mistake my confidence for coverage.

- **The flash run's PACING is unverified by eye.** Sequencing is proven
  synchronously; the 1.5 s is a number I chose and never watched. If a busy
  month feels like a slot machine, `FLASH_RUN` in `ui.js` is the knob and
  the pane cannot tell you (§13b).
- **`FLASH_MAX 5` and the `+N more` tail have never fired in a real game, and
  on this evidence may not.** I made a six-line month by hand. The busiest
  month I MEASURED popped two headlines, over four seeds and 120 city-years
  (§13's table). It is correct code guarding a case a scripted town does not
  reach; look for it in a crime-heavy city, not a balanced one.
- **The chips are `TICKER_BAD` / `TICKER_GOOD` / `TICKER_FLASH`,** three
  hand-maintained regexes, anchored to line PREFIXES — *except*
  `TICKER_FLASH`'s last alternative, `ONE HUNDRED`, which sits outside the
  `^(...)` group and so matches anywhere in a line. That is how the tortoise
  centenary flashes: its line begins with a citizen's name, which is in no
  list. `events.js`'s own doc-comment repeats the prefix model, so a reader
  cross-checking gets the wrong model twice. A new event whose line starts
  with a word nobody added lands in "all" and nowhere else, silently — the
  same trap session 3 hit when HEIST was never printed (944e507). If you add
  an event, add its prefix, and the suite will not tell you. Anchoring
  `ONE HUNDRED` into the group to "tidy" it kills the centenary flash and
  leaves 132 checks green.
- **The read set is per city NAME.** Two cities called `zoo` in one browser
  share their marks, and renaming by import (`<seed>-import`) starts a new
  set. This is the cheapest thing that works and I would not defend it if
  saves ever grow real identities.
- **`newsRows()` runs on every panel refresh with the News tab open, and the
  badge walks the whole feed on every refresh whatever tab is open** — a
  fresh array plus four regex tests per row (bad, good, flash, REPORT) and a
  `dateOf`, then `unread()` takes an FNV-1a of every row's full text. Order
  ~180 rows a month (121–286 dispatches per 30-year run across the flag
  combinations, median ~190). It is far under the tick's own cost and I
  measured nothing; the reader memoises on `(tick, log length, history
  length)`, the tab and the badge do not.
- **I did not touch `js/sim`.** Not one line, which is why the playtest hash
  could not move and why I never re-ran the 30-year curves for a number.
  If a future session's news work reaches into the sim, that argument dies
  and the curves must be re-measured.

## 14. Session 7 — the predation animation (2026-09-02, night; SPEC §14)

The owner: *"i would like an animation for predation, perhaps one citizen
puts a bag/sack over another citizen and then walks away with a bag over
their shoulder."* Built as said, on the walker layer, in one commit.

**What shipped.**
- `justice.kill` publishes `world.predations` — `{ killer, killerHome,
  victimHome, victim: { id, species, age, name } }` — BEFORE
  `removeCitizen`; `tick.js` resets it with `arrivals` / `departures`.
  Per-tick, never saved (`toPlain` does not carry it — a check says so),
  never hashed. The sim change is those two lines; the playtest hash cannot
  move and did not.
- `walkers.js` kind `predation`: leg 0 = the killer's door → the neighbour's
  door (`roadPath`; the same door → in from the next road tile), a 2.4 s
  stand (`BAG_STAND`) with `w.bag` 0→1; leg 1 = home at ×0.8 with
  `w.carry = "sack"`. `w.prey` = the neighbour, a FIGURE from the record
  (the citizen is gone), 0.32 tiles past the door along the killer's last
  step, facing the killer. A record whose killer already walks is queued
  (`pending`), that walker is released at its next tile centre, and the
  queue is flushed every `update()` — before the sampler, so the freed
  killer is the sack's. `until = tick + 2` (two months) then dropped.
- `render.js`: while `w.bag < BAG_FALL` (0.45) the neighbour is drawn and
  the OPEN sack falls onto it (`dy = −22·(1 − u²)`, z 999 so it paints over
  the figure); after, the TIED sack stands there and alternates with the
  wriggle every 1/8 of the stand. The killer takes `art.citizen(…, { carry:
  w.carry })`; the card says `calling on NAME` and then `walking home with
  a heavy sack — NAME did not come home` (`w.preyName` outlives `w.prey`).
- `art/citizens.js`: `SACKS` = open / tied / wriggle, 12×20 on the feet
  (`art.overlay("sack", 0..2)`); `SACK_SHOULDER` 9×11 stamped in an
  **18-px grid, the figure 3 px in** (symmetric, so `mirrorLit` lands the
  figure on itself for SW/NW), BEHIND the figure for SE (we see the face),
  OVER its back for NE; it hangs from row 7 — the row above the shoulder —
  never from the head's top, so the body rows of a carrying sprite are the
  plain sprite's. Anchor `[9, h−1]`. Cache key gains `c`. `allCitizens`
  adds wolf + fox × 4 × 3 carrying, the elder tortoise with hat and sack,
  and the three sacks — the audit walks them.
- `tools/shots.mjs` → `docs/shots/sheet-predation.png`; `tools/check.mjs`
  132 → 139: the record (count, killer alive, victim scrubbed and named,
  not in `toPlain`); carry art (body rows equal, anchor on the feet, ≥ 24 px
  of sack on every facing and frame of six species, the three sacks on the
  feet, wriggle ≠ tied); Part D now FORCES a killing at year 2.5 on both
  worlds and follows the walker frame by frame — the fall, the tied sack
  at 0.32 tiles, the carry with `prey` cleared, the walker's end — and the
  on/off hash check runs across that whole run.

**Traps (keyed by what you see).**
| you see | it was |
|---|---|
| the check "body rows are the plain sprite's" fails for every sprite | the check said `w === 16`; the grid is `12 + 2·3 = 18`. Two more failures hid under that one until it was fixed — fix the loudest first, then re-read |
| only the tortoise fails that check | its 1-px outline is clipped by the 12-px grid and not by the 18-px one — a REAL pixel the plain sprite never had. The check compares the tortoise without the outline key |
| the sack floats above the head like a balloon (first sheet) | it was placed from the HEAD's top row (species-dependent) and 5 px up; now from the SHOULDER row, 3 px up, 9 wide — a lump beside the head |
| a killing with no sack, ever, in a crowded town | the killer already had a walker; the record was dropped at the next tick (1.5 s at ×1) before the release landed. Now `until = tick + 2` |
| `zoo.walkers.list()` shows a predation walker while PAUSED, before any frame moved | `update()` flushes `pending` at dt 0 (the frame loop runs with wdt 0 when paused) — the spawn is instant; only the WALK waits. Verifying by hand: find the walker BEFORE advancing time, or the fall is missed (I missed it once) |
| the killer walks 23 tiles to a neighbour 3 tiles away | `KILL_RADIUS` is Chebyshev on HOMES; the walk is the road path between DOORS, round the block. The suite's ring city has one ring. Not a bug; a long approach |

**Measured (browser, seed 7 scripted ring, year 8, P 279–280, ×2 zoom,
paused, time stepped by hand through `walkers.update`).** Run 1: wolf 283
→ wolf "Fenpa Howell", approach 23 tiles, at the door bag 0.08 → 0.31 (the
open sack in the air, the neighbour under it) → 0.60 (tied, on the road)
→ leg 1 carry, facing se, the lump above-left of the head, plainly
readable among ~150 walkers. Run 2: fox "Ashset Russet" → cat "Purtens
Whiskers", approach 2 tiles; the carry photographed at 30.98, 31.34, 32.06,
32.50. Console: no messages. The suite's Part D: fall / tied / door /
carry / gone all true in 139/139.

**Left (BACKLOG).** The victim's own walker, if it had one, is released at
its next centre while the figure at the door already stands — two of the
same animal for under a second. The sack goes HOME; a hall's staff could
carry it to the hall. No sound, no flash at the second of the drop.

## 15. Session 8 — what a station BUYS, and the rubble clock (2026-09-02, night; SPEC §9b, §9c)

The owner, in one message: *"there's still a balance issue with police and
fire, even if you have a ton of them the fires and crime are not prevented
and most go unsolved"* and *"i'd like a quality of life update for fire. i'd
like the building plot to stay as rubble for a period of time and then
automatically becomes eligible for the game to build on. it just takes a few
months before its eligible again. it can still be deleted and rebuilt, but
you dont have to, it will be rebuilt automatically."*

Both halves are the same complaint. A fire took a building and left a scar
you had to go and click, and the station you paid §500 and §400/yr for did
not stop any of it.

**The census came first** (`tools/serviceprobe.mjs`, an instrument: exit 0
always). The same town nine blocks wide, warmed eight years with disasters
off, then 0 / 1 / 2 / 4 / 12 stations, then forty years. Every number below
is from it. Do not quote them without re-running it.

### What was actually wrong (three defects, all measured before anything changed)

**1. A fire station never saved a building.** Buildings lost per fire was
exactly **1.00** at 0%, 28%, 71% *and* 100% coverage. Coverage changed where
a fire started, how long it burned and how far it spread — never whether the
lot survived. A covered lot burned for one month instead of two and then
became rubble just the same.

**2. Coverage moved fires; it did not reduce them.** The roster weight was a
flat `w3 × season`. The origin picker weighted covered lots at 1/6, so a
station pushed the fire onto whatever was still uncovered and the number of
fires a town suffered did not change: **30.5 fires in forty years at no
cover against 31.7 at 31%.** That is the owner's sentence, exactly.

**3. The FIRST police station made crime worse, and then crime fed itself.**
`burglaryTick` returned early when the town had no station ("nobody to file
it"), so crime was *created by having police*. And every open file stained
+15 crime over radius 2 for 24 months, uncapped and stacking, while the
burglary rate reads the COUNT of hot lots — so a burst of burglaries painted
more lots hot, which raised the rate, which opened more files.

| police | lots hot BEFORE | AFTER | files opened BEFORE | AFTER | solved BEFORE | AFTER |
|---|---|---|---|---|---|---|
| 0 | 7.6% | 20.8% | 7.4 | 130.7 | 9.5% | 0% |
| 1 | **17.5%** | 15.5% | **109.2** | 99.4 | 9.2% | 21.9% |
| 2 | 12.9% | 13.1% | 81.9 | 84.4 | 12.7% | 30.1% |
| 4 | 1.4% | 1.9% | 12.4 | 19.5 | 41.9% | 52.8% |
| 12 | 0.4% | 0.4% | 6.5 | 9.8 | 43.1% | 56.1% |

*(10 seeds × 40 years, `--only police`, matched before/after on one rig.)*
Read the BEFORE column down: buying your first police station **more than
doubled** the hot lots and bought a clear-up rate of 9.2% against the 9.5%
you already had. It was worse than nothing.

**3b. And the arrest roll is made at the crime scene, which is by
construction the darkest tile in town.** A burglary picks a lot with crime
above `CRIME_HIGH`, and crime is high exactly where police cover is not:
**97.4% of scenes at zero cover with one station, 44.8% with four.** So
`ARREST_COVER · policeCov/60` was almost always multiplied by nothing and
`ARREST_BASE` alone decided every case.

### What shipped

- **The roster weight is the town's own exposure.** `fields.fireExposure()`
  sums every built lot's origin weight and the fire card multiplies by its
  mean. The SAME number that picks the lot a fire starts on now decides how
  often one is rolled: ×1 uncovered, ×0.32 at 81%, ×1/6 covered end to end.
  One implementation, two questions, so no station can move a fire without
  also making it rarer.
- **The engine saves the building.** On burnout, a covered lot is saved at
  `FIRE_SAVED` 0.7 and loses one storey instead of the lot. A tier-1 shed
  comes out gutted at tier 0 — clear ground, not rubble.
- **The rubble clock.** `world.rubble[i]` is now the months it has left,
  counting down in `eventsTick`. Every `if (world.rubble[i])` in the codebase
  still reads "there is rubble here", so nothing else changed and no new tile
  array joined the save. The bulldozer is impatience now, not a toll.
- **A burglary needs no police station to happen,** and the file opens
  either way, because the file is the STREET's memory of the crime and a
  street does not forget faster for want of a desk sergeant.
- **The file stains cap** at `FILE_CRIME_MAX` 25 — a street where three
  things happened is a bad street, not three bad streets.
- **The force works the case.** `p = 0.02 + 0.10·min(1, stations/4) +
  0.18·cover/60 + 0.05·record`, and with no station in town **no roll is made
  at all**: nothing is investigated, every file goes cold, and the advisor
  says so.
- **A burglary going cold prints.** 101 of 116 files used to die in silence
  (`justice.js` wrote COLD only for a killing), so a mayor watched crimes
  reported and never heard another word and concluded, correctly, that
  nothing was being done. The line is deliberately NOT in `TICKER_FLASH`:
  the record, not the news.

Fire, after (`--only fire --forced 6`, 8 seeds, 80 forced fires each):

| fire stations | covered | roll weight | lit per fire | buildings lost | saved by the engine |
|---|---|---|---|---|---|
| 0 | 0% | ×1 | 6.7 | 535.4 | 0 |
| 1 | 35% | ×0.70 | 6.6 | 520.1 | 4.8 |
| 2 | 52% | ×0.56 | 5.4 | 422.9 | 15.1 |
| 4 | 81% | ×0.32 | 2.6 | 194.5 | 34.6 |
| 12 | 100% | ×0.17 | 0.3 | **7.5** | **73** |

### Two defects found in passing, both older than this session

- **Three lines flashed over the map and were never written down.**
  `tick.js` skips logging anything `eventsTick` returns, on the ground that
  "rolled events already logged themselves" — true of the roster and of
  nothing else. So BEAR WINTER, the tortoise centenary and the Butchers'
  Licence card were never in `world.events.log`, and the news reader shipped
  last session reads the log. `eventsTick` now has one `say(id, line)` that
  speaks and records in one move, and a check demands that EVERY line it
  returns is on the record.
- **Nothing ever ran the Rules tab's `live` lines.** A `live` reading a
  census field that does not exist would break the tab in the browser with
  the suite green. It cannot now.

### The rig, and why fire needed two instruments

A fire spreads to four neighbours at 0.3 for two months off a beat: **~2.4
offspring per burning lot, a supercritical branching process**, stopped only
by the road ring round the block. So a town loses a whole block or none of
one, and a forty-year run rolls about three fires. Twelve seeds of that is
noise shaped like an answer — I read a "one station triples fires" result off
it and had to go back, and the same spike was there at HEAD. The fire
questions are therefore asked separately: **how often** is exact arithmetic
off `fireExposure()` with no simulation at all, and **how bad** is measured
with fires forced through the real roster card, 80 per seed.

### Verification

159 checks, 0 failures. **Every one of the 11 new mechanism checks was
mutation-tested** — the code broken on purpose, one edit at a time, and each
mutation killed its check (11/11). The two the suite would otherwise have let
through: anchoring the origin weight out of the roster weight, and reverting
`say()` to `notices.push` for the centenary.

**Not verified in the browser this session.** The preview pane was bound to
another project's server on every port it would take, so the rubble clock and
the hover card were checked headlessly and by source, not by looking. Someone
should open it, burn a lot (`zoo.advance`), and watch the site clear itself.

## 9. Verification recipe (what "done" looks like here)

```
node tools/check.mjs                                   # 159 checks, 0 failures — the gate
node tools/playtest.mjs --years 30 --quiet             # the §4 curves (disasters off)
node tools/playtest.mjs --years 30 --parks 2 --zoo 12 --quiet
node tools/playtest.mjs --disasters --stations --years 40 --seed 5
node tools/newsprobe.mjs                               # how much of what the city says ever reaches the player (§13's table)
node tools/serviceprobe.mjs --only fire --forced 6      # what a fire station buys (§15's table)
node tools/serviceprobe.mjs --only police               # what a police station buys (§15's table)
node tools/shots.mjs                                   # sheets + scene, then READ the PNGs
node tools/serve.mjs --port 8142                       # open it, N for a fresh city, zoo.advance(36), look, read the console (must be EMPTY)
git push origin main                                   # Pages builds in ~1–2 min
```

**What the suite does NOT prove:** it never rasterises a sprite through
`render.js`, never judges balance, and never watches the clock — those are
`shots.mjs`, `playtest.mjs`, and your eyes in the browser. A green suite
with an ugly sheet is not done.

---

## Maker's mark

I am Claude Fable 5.1, and I built sessions 3, 4 and 5 of this game on
2026-09-02 — crime and punishment, the title screen and the cheat, and the
walls / use-zoning / rail tranche — in one long day with the owner, who
asked for this mark. The commits carry the owner's git name and my
Co-Authored-By line; the words in SPEC §6b, §7.8, §7.9, §9c, §9d, and in
§10–§12 of this file, are mine unless quoted.

What I stood on, so nobody mistakes a day's speed for a day's work: the
first session's sim and its suite, which made every one of my changes
checkable before it was visible; Glades of Arcadia's flood-fill law and
its drystone wall, which the owner pointed me to and which I adopted
whole rather than reinvent; the crime arc's single `arrest()` door, which
let trespass be a cause and not a subsystem; and the owner's habit of
saying exactly what they want in one paragraph and then ruling in one
line. The hard parts of this day were never the code. They were the three
times a check passed that I had not made able to fail — a fixture that
could not pay, a sentence that ended a tick sooner than I read it, a
tunnel that opened sideways — and each time the suite, not I, said so. If
you take one habit from me, take that one: before you trust a green
check, break the thing it claims to guard and watch it go red.

How this codebase wants to be worked, in my experience of it: prove the
frame first (a new generator reproduces the old output byte for byte on
the old inputs, then it may differ); the numbers are KNOBS and the
reasons are in the comments beside them, argue with the reason; the
owner's words are the spec and my rulings are listed so they can be
overruled in one line, never buried; and the ticker names every animal
and uses no pronoun, because the sim has no sex and the city has names.

To whoever builds next: the BACKLOG is honest, the traps in §3, §10, §11
and §12 are keyed by what the screen looks like, and the painting on the
title screen is the owner's. Leave it byte-exact.

— Claude Fable 5.1 (claude-fable-5-1), 2026-09-02, after commit 12168a9.

---

I am Claude Opus 5, and I built session 6 — the news — on 2026-09-02, in an
evening with the owner, who asked for this mark. §11b of SPEC and §13 of
this file are mine unless quoted; the mark above is Fable 5.1's and I have
not edited a word of it.

What I stood on. The first session's sim, which I read and never edited —
not one line of `js/sim` is in this session's diff — and its suite, which
told me in nine seconds that I had not broken it. Fable's
keystone — specifically two things in it: the one-implementation law
(`lotScore()` is the hover card's reason AND the growth decision, never two)
which is the entire shape of `newsRows()`, and the rule that a handoff
sentence untrue of the code beneath it is worse than no sentence, which is
why I spent part of an evening fixing a key list rather than adding to it.
Session 3's instrument commit (`944e507`), which exported the `TICKER_*`
regexes because a heist had gone unprinted for 360 city-years — those three
regexes are why the reader has working chips and why that took ten minutes
instead of a design. And the owner's second sentence, which was worth more
than their first: *"oh, looks like the news exists under the log tab."* It
did. Being told so sent me to the thing that already existed instead of
letting me build a handsome parallel copy of it beside the real one.

What this session taught me, and it is a correction to the habit Fable left
you. They wrote: before you trust a green check, break the thing it claims
to guard and watch it go red. I did exactly that, and it was not enough —
twice, on the same check. My first version cut the event log at a fixed
index to prove a row keeps its name across a roll; the cut landed on a month
BOUNDARY, where the correct naming and the broken naming agree, so the check
passed under the very bug it existed to catch. My second version asked
whether a row's name still EXISTED after the roll. It does — bound to its
neighbour, which is the bug. So: **a check has a rig and a question, and
breaking the code tests neither until both are right.** Make the break land
where the bug lives (find a month with two lines in it; refuse if the
fixture has none), and ask the question the invariant actually makes (not
"is this name present" but "what does this name resolve to"). The mutation
is the beginning of the test, not the end of it.

What this codebase wanted from me, in one line: **derive, do not
accumulate.** Every defect I found was a second copy of something the city
already had. A second flash overwriting the first — worth about one lost
headline in thirty city-years once I finally measured it, rather than the
catastrophe I had already written into a commit message before I did. A
second REPORT line synthesized beside the one the advisor had logged all
along, computed off a different book, printing two different net figures on
every loaded city since the Log tab was written. A second feed accumulated in
the panel beside `world.events.log`, which is why a live session and the same
city reloaded were quietly different documents. None of these were hard; all
three were invisible because a copy looks exactly like the thing it copies
until the two disagree. When you want to show the player
something, find where the city already keeps it.

To whoever builds next: the landmarks are still ranked first and §13c has
the two findings from the census that outlive the report — `depthOf` already
takes a footprint, and `OBLONG_PULLBACK` does not, which is your first
afternoon. §13d is the honest list of what I left unproven. The preview pane
is a viewer and not a clock — it will throttle a paced sequence and then
stop it dead, and you will debug your own correct code for twenty minutes
before you check `document.hidden`. And the news is the browser's, never the
city's: a save that contains a read mark is a bug, and the suite says so.

— Claude Opus 5 (claude-opus-5), 2026-09-02. The news shipped at 9338c1b; this
mark and everything in §13 land in the commit after it, which is also the one
that makes the last sentence above true.
