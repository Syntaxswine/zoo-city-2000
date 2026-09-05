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
- **Keys:** `TOOLS` in `js/tools.js` is the truth for the palette, input and
  generated footer: `1 R · 2 C · 3 I · 4 Meat · 5 Road · 6 Wall · 7 Rail ·
  8 Station · 9 Tree · 0 Park · Z Zoo · V Pacify · P Police · F Fire stn ·
  I Inspect · B Bulldoze`. The strip adds `H` density, `U` Use, `Space`
  pause, `, .` speed, `Backspace/Ctrl+Z` undo, `Ctrl+S` save, `L` load, `O`
  overlays, `R` news, `+/−` zoom, `N` new city and `Esc` menu. WASD and
  arrows are movement only; `U` pressed while Use is already up cycles
  mixed/pred/prey. Shift on a road drag = straight. Undo is one step, this
  month only, and any op with `evicts` empties it.

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
- **Checkbox extension, 2026-09-04.** The old values remain exact bits
  (`1` predator, `2` prey); `use` is now `Uint16`, with one stable bit for
  each of the 14 species. `U` opens sixteen checkboxes, no checks is mixed,
  and `admits` ORs every selection. Combined masks are carried through
  routing, homes/jobs, trespass, block merging, undo, Census, cards, overlay,
  save/load and the input log.
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
- **v1 limits (BACKLOG):** no rail bridges and no train sprite (level
  crossings have since shipped; riders sit 3 px up at X2's derived ×4.5).

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
↑ ↓, which step one; PgUp/PgDn step ten — WASD remains map movement only, and the
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
the hover card were checked headlessly and by source, not by looking. *That
gap is what §15b is — the owner asked for a camera, and the rubble clock is
now photographed month by month. The hover card is still unlooked-at: it is
`js/ui.js`, which the play camera does not draw.*

### 15b. The play camera — `tools/play.mjs` (the same night)

The owner, after reading that §15 could not be verified by eye: *"do you think
you could make a tool to do live play that takes screen shots?"*

Yes, and it needed almost nothing new. `tools/headless-canvas.mjs` had existed
since session 1 and its own header says it is "enough of Canvas2D to run
js/render.js in Node" — but nothing had ever run `js/render.js` through it;
only `shots.mjs`, which paints through `painter.js` directly. So the shim was
missing `setTransform`, the whole path API, `rgba()` parsing, and a blit that
honours a scale. Those went in, and **`docs/shots/*.png` came out byte-identical
to what was committed**, which is how you know the additions are inert for the
old caller.

**What it is.** The scripted mayor builds a town in the real sim and
`js/render.js` — the file the browser loads — photographs it. No browser, no
dependency, no second copy of the drawing. Its shutter is a clock (`--every`,
`--at 2003-06`), a camera roll (`--film 24 --fps 12`, so the walkers move), or
the news itself:

```
node tools/play.mjs --seed 2 --years 18 --disasters --when "^FIRE" --after 0,2,4,6,8
```

`--when` fires on a ticker line and **points the camera at the coordinates the
line already carries** (`FIRE at (22,21)`), then `--after` re-photographs that
same spot months later. That run produced the sequence §15 could not:

```
2015-06  FIRE at (22,21)          [22,21 tier 2, BURNING 2mo]
  +2                              [22,21 tier 0, RUBBLE 6mo left]
  +4                              [22,21 tier 0, RUBBLE 4mo left]
  +6                              [22,21 tier 0, RUBBLE 2mo left]
  +8                              [22,21 tier 0]              ← chalk, eligible
```

Every caption carries the watched tile **in words**, because a photograph
cannot tell you how many months are left and squinting at a 12-px sprite to
decide is how you see what you expected.

**One mayor.** `playtest.mjs`'s block planner moved out to `tools/mayor.mjs`
whole, so the two instruments watch the same town. Proved by hash: seven flag
combinations (`--years 30`, `--parks 2 --zoo 12`, `millbelt`, `dormitory`,
`--markets 1 --pacify --stations`, `--disasters --stations --seed 5`,
`--schedule 15:13,22:7 --recession 20`) print the same hash before the
extraction and after it.

**Two bugs in the tool, both of which it happily reported success on.**
- Its first frames were an empty rectangle of background. `aim()` read
  `left`/`w` off `mapBounds()`, which returns `minX`/`maxX`/`minY`/`maxY`; every
  term was `undefined`, the camera went to `NaN`, and the tool wrote a full set
  of PNGs, captioned them correctly and exited 0. **Only opening one caught it.**
  A caption is not a photograph.
- It never called `renderer.invalidate()`, so the cached ground layer was
  frozen: burnt lots vanished on cue (buildings are per-frame) and their rubble
  never appeared (the ground is cached). Half live, half a memory.

**And a stale SPEC sentence found by the second one.** §13 said the static
layer holds "ground + chalk + roads + buildings + trees". It does not — the
buildings and trees are in the per-frame `paintScene`, as `render.js`'s own
header line 15 says. That sentence is what made the missing `invalidate()`
hard to see, and it is corrected, with two checks pinning the halves apart.

**Suite 159 → 167.** All five new render checks mutation-tested, 5/5. The one
that matters most is the blank-frame check, because it is the one the first
draft failed while looking, by every other measure, like a working tool.

## 9. Verification recipe (what "done" looks like here)

```
node tools/check.mjs                                   # 167 checks, 0 failures — the gate
node tools/playtest.mjs --years 30 --quiet             # the §4 curves (disasters off)
node tools/playtest.mjs --years 30 --parks 2 --zoo 12 --quiet
node tools/playtest.mjs --disasters --stations --years 40 --seed 5
node tools/newsprobe.mjs                               # how much of what the city says ever reaches the player (§13's table)
node tools/serviceprobe.mjs --only fire --forced 6      # what a fire station buys (§15's table)
node tools/serviceprobe.mjs --only police               # what a police station buys (§15's table)
node tools/shots.mjs                                   # sheets + scene, then READ the PNGs
node tools/play.mjs --years 20 --every 24              # WATCH IT PLAY, then READ the PNGs (§15b)
node tools/play.mjs --seed 2 --years 18 --disasters --when "^FIRE" --after 0,2,4,6,8
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

---

## 16. Session 9 — The People, Part K: the keel (2026-09-03)

The first implementation from `PLAN-THE-PEOPLE-2026-09-02.md` is deliberately
invisible. It gives every later People part one shared contract without adding
a feature or moving the simulation:

- `citizens.moodTerms()` is now the sole arithmetic behind mood. `moods()`
  sums those terms in the old order; a shared `moodContext()` keeps the prey-
  flight census linear when all citizens are read together.
- `life.js` reserves the 16 stable biography kinds, a 12-entry ring through
  `remember()`, this tick's `world.lifeEvents`, and the `lifeLines()` stub.
  `story.js` is the only eventual bridge from that bus to news, called after
  justice each month.
- `world.majority` is a derived species-index byte per tile: residents choose
  an R building; staff choose C/I/M. It is rebuilt by the census and not saved.
- `world.meat`, citizens' empty `life` arrays and `world.names` round-trip in
  the save. Old saves default them to zero/empty. Empty K-only fields are
  omitted from `stateHash` canonicalisation, so the standing hash stays exact;
  once B or H adds real values they are hashed.
- Walkers carry `need: null` and the neutral `art.look(id)` result. The art
  registry reserves bubble, portrait, mark and crossing with loud not-built
  errors. Plan §5's ownership table is now in BACKLOG so parallel work has one
  visible boundary.

Verification on the landing tree: `node tools/check.mjs` remains **167 checks,
0 failures**. The balanced seed-7 mayor remains hash **292e7fa1** before and
after Part K, with the same year-30 population, treasury and event count. A
focused Node contract probe forced a 14-event life ring, a majority tie-break,
new- and old-format save loads, non-empty names/meat/life state hashes, and all
five art reservations. `node tools/play.mjs --years 2 --at 2001-01` rendered
73 walkers with the new fields and produced a clean 960×600 frame.

No later part should replace these seams. A reads `moodTerms`; B fills
`lifeLines` and call sites; D replaces neutral `look`; E reads `majority`; F
fills `storyTick`; H advances `meat`. The hash-neutral baseline is the tripwire
for all six.

---

## 17. Session 10 — The People, Part S: named saves (2026-09-03)

The one checkpoint per city is now a list of named slots. `js/slots.js` is a
DOM-free layer over either a `Map` or the guarded browser store: counter ids,
names as data, newest-first indexes, exact one-slot deletion, one overwritten
autosave per city and quota-safe rollback. Boot migrates the old `zoo.city:`,
`zoo.save:` and `zoo.auto:` keys without deleting them; the migration marker
survives later overwrites, so an old autosave can never return on the next
reload.

SAVE and LOAD are two doors into one panel. SAVE focuses the default
`<city> — <month year>` name; LOAD focuses the newest-first list. Each manual
row loads, confirms an overwrite, confirms deletion of that row only, and
exports its own JSON. The autosave row loads, deletes and exports but is only
overwritten by the clock. The foot reports used/free storage and a current-size
slot estimate. If a write is refused, the attempted JSON remains in the export
textarea with a recovery notice. CONTINUE opens the newest manual or automatic
slot belonging to the last city, paused as before.

Verification after hostile review: `node tools/check.mjs` is **177 checks,
0 failures**. Part J' covers plain-Map ordering and punctuation, one-slot
deletion, both new-slot and overwrite rollback after the value write succeeds,
a full-store legacy recovery row, durable deletion of a migrated row, legacy
migration across a later autosave, autosave cardinality and the shared panel
route. Node syntax checks
pass, the balanced 30-year hash remains **292e7fa1**, and the local server
returns 200 for the page, `main.js` and `slots.js`.
The required interactive browser round remains to be repeated: this Codex
session's installed Browser plugin rejected its own `browser-service.mjs` as
outside the configured trusted path before it could open localhost; reconnect
and a fresh browser session failed the same way. No alternate browser driver
was substituted.

The hostile review caught two P1s in the first landing and both were real.
Migration originally kept its idempotence marker on the migrated row, so
deleting that row let the untouched old key recreate it at next boot. And if
the old JSON could not be duplicated into an already-full store, only the new
index was listed, making the old city invisible. Markers now outlive rows in
the index; unmarked old keys are virtual recovery rows that boot, LOAD and
EXPORT can read directly (and an explicit delete can remove). The review also
caught that the first quota test failed on the value write and never reached
the claimed index rollback. Two cap fixtures now force the value to fit and
the index to fail, for both insert and overwrite, and assert byte/index/value
restoration.


---

## 18. Session 11 — the building redux: blocks, eight families, the hi-res set (2026-09-03)

The owner: *"can you tackle the building tile redux? i'd like some of
commercial, industrial, residential, and meat buildings to be 2x2 and 3x3
tile sizes. these should be the buildings that can hold a lot of people. we
need new cute images. i'd also like a more high res sprite set for when the
camera is zoomed in."* Four commits, in the order the handoff's own ranked
list demanded (§6 item 1: "start with painter.js"):

| commit | what | proof |
|---|---|---|
| c2ee285 | the ray audit (`tools/depthaudit.mjs`) and the size-aware pull-back `pullbackOf(side)` = 0.7 + (side − 2); `keyAt`/`footprint` item overrides so the cursor on a footprint tile keys as the building; the scene tool paints ground in its own pass as render.js always has; `render(boxes, { scale })`, `RECIPES`, `renderRecipe` | 681/681 sprites hash-identical; zoo 0 mis-ordered, 3×3 probe 0; suite 181 |
| 9c89f73 | `js/sim/blocks.js` — SPEC §3b, §5 MERGE/SPLIT; `world.big`; RULES G5; footprint-wide bulldoze, fire, flood, use | 17 checks; hash-neutral where no block forms (dormitory a11c91e4 unchanged); balanced 292e7fa1 → ee47f999, P 1,645 → 1,721 |
| 6eb7ce5 | `js/art/blocks.js` — terrace court · the towers · arcade · emporium · mill · foundry · abattoir · meat exchange, ×2 variants | footprint gate + ray audit on all 16; `sheet-blocks.png`; `blocks-towers.png` (the 3×3 in the town through render.js) |
| 10b9b11 | `js/art/hires.js` — every solid and ground diamond at 2× from its recipe; the renderer draws twins 1:1 at zoom 2 | 6 checks incl. "visible" (thousands of non-uniform 2×2 device blocks with the twins, 0 without; zoom 1 byte-identical); `sheet-hires.png`; the browser at zoom 2 on an imported ten-year town, zero console messages |

Suite 167 → 204. SPEC §3b, §5, §12.2b, §12.5, §12.6, §13, §15 carry it.

### What the instruments caught (symptom-keyed; the traps for whoever touches this next)

| what the picture / number looked like | what it was | the rule |
|---|---|---|
| the depth audit passed BOTH the flat 0.7 and the scaled 1.7 for a 3×3, and reported 73 "mis-ordered" pixels on the zoo | the audit placed every walker at (tx, ty) instead of the point (tx + ½, ty + ½) that `placeAt` puts its feet on — 16 units too deep — so it could not tell the two apart, and the zoo's 73 were 1-px grazes of that error | an instrument that passes both candidates is not measuring; fix its CONVENTION against the system's before believing a verdict. With the +½ in, 0.7 fails the 3×3 by 4,185 px (up to 64 units, the east road beside the back row) and 1.7 passes clean — and the zoo's grazes vanish |
| a derivation said the ground of a block's own front tiles forbade any pull-back past 0.75 | true only in a painter that puts ground and buildings in ONE scene; render.js never has (static layer), and `shots.mjs --scene` did — its single pass replayed on the new code reproduced the old PNG to the pixel, so the split was the whole 91-px difference | ground is never in the building's scene; the scene tool now says so |
| not one block formed in thirty years on any scripted layout | the first rule asked for all four lots at tier 3; the balanced town has 14 tier-3 R lots of 281 and none touch — LV under 60 caps R/C at tier 2, and I's score idles at 0.04 under the 0.05 threshold | a rule gated on a precondition must have that precondition's FREQUENCY measured before it ships; SC2000's dense lot absorbs tier-2 neighbours, and so does this one (first 2×2 month 35, first 3×3 month 55) |
| every block in every scripted town is residential | C blocks need C at tier 3 (LV ≥ 60); I blocks need I lots that grow at all | not a defect of the blocks — the same levers as the towers (parks, trees, the zoo). The owner's town may differ; measure on the control city when it arrives |
| a garden wall drawn in the plinth's grass keys vanished on grass; the arcade's roof of three flat trays read as a warehouse | the cottage's ziggurat lesson, again | look at the sheet before the commit — both fixed there (brick wall; a glazed pavilion with a clock tower) |
| the hi-res twin of a 53×36 cottage is 103×67, not 106×72 | the grid's 1-px pad and the floor/ceil do not scale | a twin is up to 6 px short of double per axis, never over; position it by its ANCHOR POINT, never its corner |
| `Port 8139 is in use` and the page there 404s `js/art/hires.js` | another session's `tools/serve.mjs` on another copy of the repo; the preview tool read the PARENT directory's launch.json (the session cwd is `AI/`, not the repo) and first started a different project's server | the zoo entry now lives in `AI/.claude/launch.json` with `autoPort` and no `--port` (serve.mjs reads `PORT`); verify with a curl for a file only your tree has before trusting any screenshot |
| the first hi-res comparison sheet drew the 2×2 blocks over each other | a 260-px twin beside a 262-px scaled copy in a 300-px cell | cells 600 wide, two columns |

### What I distrust in what I left

- The blocks' people sit on the ANCHOR. `occAt` spreads them for crime and
  customers, but mood, dread, LV and the flight rule read the anchor tile's
  values for everyone in the block — a 3×3's 270 animals all feel the north
  corner. Probably right for a building; say so if it surprises someone.
- `evictFromLot` on a split rehomes newest-first; a 3×3 at 270 splitting
  moves ~240 animals in one tick through `bestHome` (O(lots) each). Measured
  fine at 64×64; a 128×128 map would feel it.
- The 3×3 windows round a 2×2 are tried in raster order of their anchors,
  so a 2×2 prefers to grow north-west. Deterministic, not neutral.
- `blockSprite` falls back to the tier-3 lot when blocks.js has not
  registered — that path is dead now that index.js imports blocks.js, and
  it hides a missing registration behind a wrong picture. The suite's
  "every solid has a twin" check would notice the count, not the picture.
- The hover card for a PART was verified in Node (lotReport) and not seen
  in the browser this session: the hover action in the pane did not raise a
  card. Look once.

### Ammunition for the next arc

- The landmarks proposal (`docs/PROPOSAL-LANDMARKS.md`) is half shipped: the
  merge mechanic IS the block mechanic. What remains is the theme — the
  majority species (`world.majority`, the keel's K3) choosing a skin for the
  block, Warren Towers for rabbits and the Dairy for cows — a ramp swap and
  a stamp on the block families through `KIT`, no new sim state.
- Part E as drafted (variants 2 → 4, lit windows by fill, species marks)
  applies to the block families through the same `KIT`; `art.mark` is still
  reserved.
- The hi-res set makes a zoom 3 or 4 cheap: `HI_SCALE` is one number, the
  renderer's S the other; the animals would want a 2× kit drawn by hand
  before that reads as an upgrade.

---

## 19. Session 12 — the landmarks: a 3×3 takes the name of the species that made it (2026-09-03)

The owner: *"lets keep going with the backlogged handoff 18 for themed
landmarks that are species specific."* §18's ammunition said the merge was
the block and what remained was a skin by `world.majority` — "no new sim
state". Half right. One commit of code and one of docs:

| commit | what | proof |
|---|---|---|
| b042d0d | `js/sim/landmarks.js` (the roster, `chooseTheme`, the ticker line), `world.theme` (one saved byte, all-zero left out of the hash), the merge/split/bulldoze/undo/save wiring, census + Rules G6, the card; `js/art/landmarks.js` — eleven 3×3s × two variants on `BLOCK_KIT` + `KIT`; `blockSprite(zone, side, variant, theme)`; Part L (17 checks); `sheet-landmarks.png`, `landmark-mews.png` | suite 204 → 221, 0 failures; seed 7 balanced plain 30 y ee47f999 UNCHANGED; seed 7 + markets raises the Mews at month 54 (65 of 129 cats and foxes); the browser at zoom 2 on the imported ten-year town: the Mews at (18,4), G6's live line, the News row, and the hover card on a PART of it |
| (docs) | SPEC §3c, §5 LANDMARK, §12.2c, §15, §15; BACKLOG; the proposal's status; the plan's Part E; this section | — |

### What was measured before the rule was written

Five scripted towns × thirty years (balanced seeds 3, 5, 7; balanced +
markets 7; millbelt 7): 37 merges. The leading species on a block holds
**16–37%, never a majority** — so "majority" means plurality here, as the
census's `majority` field always has. A 3×3 rose in **2 of 5 runs**, cats
leading both (42 of 135; 35 of 137). C blocks were led by fox (28%, 23%),
I blocks by bear (3 of 4) and beaver. The proposal's roster (rabbit, cow,
beaver, fox/cat, raccoon/owl/skunk, pig) would have made BOTH observed 3×3s
plain. The shipped roster covers who leads: R Warren Towers (rabbit, mouse)
· the Lodge (beaver, bear, wolf) · the Roost (owl, hawk) · the Wallows (pig,
raccoon, skunk) · the Mews (cat, fox); C the Fox & Cat (fox, cat) · the
Night Market (raccoon, owl, skunk); I the Dairy (cow) · the Truffle Works
(pig) · the Honey Works (bear) · the Sawmill (beaver). Cow and tortoise in
R, and every M staff, raise the plain block.

### The three design calls, and why

- **Kin count together.** rabbit 10 + mouse 9 beats cat 12 for Warren
  Towers; cat 42 + fox 24 is the Mews. A landmark is FOR a group; counting
  species alone would hand the picture to whichever cousin happened to
  outnumber the other. A tie at the top, or a top group with no landmark
  in the zone, leaves the plain block.
- **Chosen once, kept until the block comes apart.** A derived skin by the
  live majority would flicker whenever two close species traded places,
  and a save→load would forget which way it had been leaning. So `theme`
  IS new sim state — one byte per tile, set in `mergeLots` for a 3×3,
  cleared by `splitLot` and the bulldozer, carried by undo and the save.
  Hash-neutral until the first landmark (the all-zero array is dropped
  from the hash like `big` and `meat`), and a save without the array
  loads to zeros: an old town's 3×3 stays the plain towers.
- **A picture and a name, never a bonus.** The proposal's per-theme
  effects (births ×1.25 in the warren, I income ×1.15 at the dairy, the
  night market's mess, the sawmill's water) are NOT built. Each would be a
  weight in a different module and a measured change to every town's
  hash, for a flavour whose EV nobody has computed (compute the gamble's
  EV first; flavour lies). The city's character builds the building; it
  does not yet pay for it.

### What the instruments caught (symptom-keyed)

| what it looked like | what it was | the rule |
|---|---|---|
| a patch script found its needle 0× on a line that grep printed byte-for-byte | the working tree is CRLF for files git checked out after the rebase (autocrlf true) and LF for files the Write tool made last session; a needle ending "\n" fails on "\r\n" | a patch script normalises to LF, edits, and restores the file's own ending; `git ls-files --eol` says which is which |
| a check failed with every clause it printed reading true | the regex `\(18,4\); \d+ of \d+` written through String.raw and a heredoc'd patch reached the file as `(18,4); d+ of d+` — a valid regex that matches nothing | when a check's DETAIL says pass and the check says fail, print the regex source from the file; the third fix was a plain split/join, no escaping layer at all |
| `TypeError: crate is not iterable` | `crate()` returns one box; two others in the same list were spread | helpers that return one box and helpers that return a list look the same at the call site — the rasteriser's `.flat()` at the end of a plan forgives a nested array but not a spread object |
| the burrow mound was not on the sheet | grass banks on a grass lawn (the plinth's lesson from §18, again) | earth banks, grass top |
| the great lodge read as a sand pyramid; the waterwheel as one dark line; an oak standing in a wallow | the top rung of the earth ramp on a 24-unit mound; a slate disc's end face; a stamp placed by number without a look | look at the sheet before the commit — all four fixed there |
| the hover in the pane raised a card for (23,7), not the block | `computer` coordinates are in the SCREENSHOT frame (800×450), not the viewport's 1280×720 — the first screenshot line says so | read the coordinate frame line; the second hover, at the block's centre in that frame, raised the card — a PART's card, with the landmark line, the one §18 could not raise |

### What I distrust in what I left

- **Landmarks are rare in the scripted towns** — a 3×3 in two of five
  thirty-year runs. On the owner's scale (6×6+ blocks, ≥ 30 tiles) they
  should be common; the roster's spread (which species lead C and I) was
  read off 2×2 merges, not 3×3s. Measure on the control city when it lands.
- The count is taken on the ANCHOR after `mergeLots` moved everyone, so
  it counts who was housed or employed in the window at that tick, not who
  is loyal to the block. Right for a building; say so if it surprises.
- `landmarkLine` pluralises surnames by appending "s" unless the name ends
  in one (the Burrowes, the Slyfields, the Cudworths) — fourteen names,
  all checked by eye, none by a test beyond the Burrowes and the two in the
  Mews line.
- `BLOCK_KIT` is exported from blocks.js and imported by landmarks.js,
  which imports `LANDMARKS` from `../sim/landmarks.js` — art reading a sim
  table, as citizens.js reads species.js. Fine, and the only art→sim edge
  besides that one; do not let the sim read art.

### Ammunition for the next arc

- **The twelfth row**: cow + tortoise in R ("the Meadows" — long low
  ranges round a big lawn, the allied pastoral pair); an M theme for a
  carnivore staff (the proposal's abattoir ruling). Each is a roster row
  and one `family()` — the chooser, the card, the census and G6 need no
  change; Part L's roster check counts eleven and would want twelve.
- **Effects, if the owner wants them**: one weight per landmark in one
  module, each a measured hash change on the scripted towns; compute the
  EV before the first.
- **Part E** (variants 2 → 4, lit windows by fill, species marks) now has
  nineteen block-scale families to apply to through the same kit.

---

## 20. Session 13 — the shop pool: a low-density shop is one of eleven (2026-09-03)

The owner: *"lets make some more specialized buildings, unique low density
shops would be a good target."* One commit of code and one of docs:

| commit | what | proof |
|---|---|---|
| 03a639c | `js/sim/shops.js` — the pool of eleven, `shopKind(variant) = (variant >> 1) % 11`, `shopOf` (kind + keepers by `world.majority`); `js/art/shops.js` — ten new 1×1 solids × two variants on the corner shop's footprint; `buildingSprite` takes the WHOLE variant byte (render.js passes it for every lot; every other family still masks `& 1`); the card names the shop and its keepers; Part S (8 checks); `sheet-shops.png` | suite 240 → 248, 0 failures; every one of the 256 variant bytes maps to a kind with both mirrors, none under 10 of 128; variants 0 and 1 still the corner shop; the browser on the imported ten-year town at zoom 2: a street of tier-1 shops each its own kind, the card reading the kind and the keepers |
| (docs) | SPEC §12.2 row, §12.2d, §15; BACKLOG; this section | — |

### The design call: by position, not by species — and why

The landmarks (§19) are chosen by WHO lives there. A shop could have been
too — the staff's plurality species picking the kind — and it was
rejected, for two reasons that hold: a shop has NO staff when it is built
(the kind would flicker in from "nobody's" to something a month later, or
need a byte of state and a hash change), and a species-chosen pool makes
a fox street eleven bookshops, which is the opposite of "unique". The
tile's `variant` byte already existed, was already saved and hashed, and
only its low bit was used; the seven bits above it choose the kind, so a
street of Low shops differs shop to shop, is the same on every load, and
NOTHING in the sim changed — no state, no RNG, no hash moves. The species
rides on the NAME instead: `shopOf` reads `world.majority` (derived every
tick) and the card says *the Slyfields' bookshop (fox)*, and says
*a bookshop, nobody's yet* until someone works there. Kind 0 is the corner
shop the tier always drew, so an old save keeps about one shop in eleven
unchanged and the other ten become what they were always going to be.

### What the instruments caught

| what it looked like | what it was | the rule |
|---|---|---|
| `art: every box of every solid lies inside its footprint` failed on four shops | a barrel at b 14 reaches 16.2; the park bench is 3.5 deep and was set at b 14; a parasol reaches 0.8 past its table; buckets at b 14 — every prop I put "out front" on a 1×1 sat half a unit past the tile | on a 1×1 the awning already takes b 13.5–16; a prop in front of the body lives in the same 2.5 units, so size it FIRST (a shallower bench, a barrel at 13.6) — the gate is the plan's, and the plan is sixteen units wide |
| `SyntaxError` on load | `{ doorMid = 10.5 }` in an object literal argument — a default-parameter habit in a call site | — |
| the fishmonger and the barber read as the corner shop on the first sheet | the same plain blue awning on a pale body; the tiled dado and the pole are a few pixels at 1× | the awning is the biggest patch of colour a 1×1 shop has — give each its own stripe (sea-and-white, salmon-and-white to match the pole) |

### What I distrust in what I left

- The keeper's name FLICKERS as staff change: a shop with two foxes and
  two cats flips between the Slyfields' and the Purringtons' as one leaves.
  Derived on purpose (a sale is a sale, and hysteresis would be state);
  say so if it reads as a bug.
- `shopOf` is called by `lotReport` on every card — a species lookup and a
  string, nothing more — but if the card ever draws for every tile at once
  (an overlay), note it is O(1) per tile only because `majority` is
  precomputed by census.js.
- The pool is spread by `>> 1 % 11` over 128 values: kinds 0–6 get 12 of
  128, 7–10 get 11. Even enough; not exactly even.
- Nothing draws lettering on a shop sign; the pub's sign is a gold disc,
  the ironmonger's a plain slab. At zoom 2 through the hi-res twins the
  tells are clearer; at zoom 1 the awning colour does most of the work.

### Ammunition for the next arc

- Cottages and sheds want the same byte: tier-1 R and I draw one family
  each; a pool of three cottages (brick, stone, timber) and three sheds is
  `buildingSprite`'s next branch and a `sheet-*.png` — no sim change.
- Part A's bubble text can name the shop ("off to the Slyfields' bookshop")
  from `shopOf`, and a customer walker could be drawn to a KIND (the
  bakery in the morning) with one weight in walkers.js.

---

## 21. Session 14 — The People, Part A: actionable thoughts (2026-09-03)

Inspect is now the switch that lets the town speak. `needOf` selects one
actionable pressure from the exact mood, home, lot, demand and tax rules; it
returns a stable code, argument and remedy without consuming RNG. `voice.js`
turns that code into one of two or three lines no longer than 30 characters,
with species and diet overrides. The walker layer carries the code only, for
the nearest eight citizens within six tiles and the pinned walker; the last
renderer pass resolves and paints it in a fixed 10 px screen-space bubble.
The cached tail slides along either edge and flips above the box at the top,
so clamping keeps its tip on an on-screen head and points toward an off-screen
pinned walker. Changing tool or leaving the map clears the layer. No cursor or thought enters
the save or simulation hash.

The Census contract is `world.last.needs`, rebuilt once per tick with the same
`needOf` and a shared mood context. Part C owns presenting it and the matching
citizen/card remedy; A deliberately did not enter `ui.js` or CSS. `homeTerms`
is now the exact breakdown beneath the old `homeScore`, and all species at
both strictness gates are checked against the sum so this refactor cannot
quietly change settlement. Part E's building modules and existing shared-file
hunks were not touched.

The verification is deliberately split. `tools/need-fixtures.mjs` isolates
all 24 return codes; the suite also mutation-checks SMOKE and SHOPS and proves
that placing the promised park removes NO_PARK. `peopleprobe.mjs` keeps those
truth fixtures separate from its population statistics, then watches the
actual once-per-tick census for four seeds × three layouts × 30 years. The
last six samples of the first balanced run are declared stress municipalities
(`CONTENT`, `NO_ROAD`, `CAPPED`, `NO_DEMAND`, `TAX`, `VAN`). Each is a complete
1,300-resident snapshot built from valid households, occupied homes, separate
civics, capacity-bounded workplaces and real road commutes; a live recession
balances the industrial raw demand, and `refreshLast` computes every field.
The suite rebuilds those fields a second time and requires byte-identical
results. This makes the city-month stream cover 24/24 codes without padding
it with the separate focused fixtures. The
millbelt fixture intersperses full-output works after year five so the field
solver—not a synthetic mood value—creates its smoke. The final table has three
different leaders: balanced `NO_PARK`, dormitory `NO_JOB`, millbelt `SMOKE`;
the aggregate leader remains below the 40% noise ceiling. The palette-key
bubble proof is `docs/shots/sheet-bubbles.png`.

The renderer gate caught the session's real defect. `hash01` historically
returns signed fractions despite its comment, so direct array indexing could
select voice line -1 and crash for valid citizens. `voice.line` now folds its
own hash into [0, 1) without changing that shared legacy function or any city
hash. The suite tries every code across every species and 32 ids, then paints
four real-citizen bubbles through the headless renderer. Landing verification:
`npm run check` is **273 checks, 0 failures** on the integrated Part E tip;
the final 30-year probe, hostile
review verdict, commit and deployment are recorded in the delivery message.

The requested interactive browser round was attempted on a clean local server
at port 8147. The installed Browser plugin again rejected its own
`browser-service.mjs` as outside the configured trusted path before opening
localhost—the same infrastructure failure recorded in §17. No console/UI
claim is inferred from that failure; the executable fallback is the real
renderer check above plus the inspected four-line bubble sheet.

---

## 22. Session 14, in parallel — the level crossing: a road and a line, square-on, on one tile (2026-09-03)

The owner: *"railroads and roads should be able to cross over each other
perpendicularly."* Part X of the People plan, taken because another agent
holds Part H and X shares not one function with it. Two commits:

| commit | what | proof |
|---|---|---|
| (code) | `js/sim/ops.js` — `squareOn` / `maskAround` / `crossable` / `refuseCrossings`; the road and rail cases restructured from a per-tile `continue` into a whole-drag validation that iterates to a fixpoint; the wall op and the station op refuse a crossing. `js/art/roads.js` — `tarmacKey` extracted and exported. `js/art/rail.js` — `crossingKey`, a lazy 512-tile family, `squareOnCrossings()`. `js/art/index.js` — `art.crossing(roadMask, railMask, busy)`. `js/render.js` — one ground line. `js/ui.js` — the card's head and body name a crossing. `js/input.js` — the Rail and Road hints, and the cost strip prints the reason it already had. Part L' (34 checks) and the rail sheet. | suite 248 → **282**, 0 failures; **24 of 24 mutants red**, every one of them either a rule this change makes or a defect the hostile review found in the first draft of these checks; the three standing playtest gates BYTE-IDENTICAL (`e1decbff` / `6bcf6236` / `00d5e9c3`) before and after; `shots.mjs --sheet` re-rendered every sheet and only `sheet-rail.png` changed, so the `tarmacKey` extraction is inert; a browser round on a founded city at ×1 and ×2, 0 console messages |
| (docs) | SPEC §7.9 (the rule, the fixpoint, the second clause, the bulldozer's one exception, the graph, the ledger), §12.4c (the art), §13, §15; the Rules tab's R1; README; `docs/PROPOSAL-ZONING-RAIL-WALLS.md` superseded where it forbade crossings; BACKLOG (a SHIPPED section, and X2 named with the full list of places the ride number is written); this section | — |

### The design call: 512 sprites where the plan said 4

The plan specified `art.crossing(axis, busy)` — four tiles, the line's axis ×
busy, because the rule guarantees the road is straight one way and the line
straight the other. That is true **at placement**, and it stops being true
the moment a neighbour comes down: bulldoze the road one tile north of a
crossing and its road mask is a stub, not a straight run. Four sprites would
then draw a straight road that is no longer there — the art asserting a fact
the world had dropped. So `art.crossing` takes BOTH live masks and composes
them: 16 × 16 × busy = 512, built lazily and cached, and a city pays for the
crossings it has. It cost nine lines over the four-sprite version, because
`onRoad`/`roadKey` and `onRail`/`railKey` already take a mask and already do
all the work — the crossing is the two families and a rule about their
overlap, never a third drawing of a road. All 512 compose in 188 ms, which is
what the suite spends walking them.

### What the instruments caught

| what it looked like | what it was | the rule |
|---|---|---|
| every one of 24 new checks green on the first run | nothing — but two of them could not fail. A mutant sweep found both, and a hostile review found four more the sweep had not thought to break | write the mutants BEFORE believing a green suite, and then have someone else write mutants you would not have thought of. Six of my own reading passes said the same checks were fine |
| `crossing: the RENDERER draws it` green, and green again with `rebuildGround`'s crossing line replaced by `if (false)` | it compared the frame with the line and without it. Taking the line off the tile also changes the MASK of the two track tiles either side, so the picture changed whether or not the crossing sprite was ever chosen | a render check must NAME the sprite. First rewritten to count the crossing's concrete apron (palette key `^`, 36 px, in no road, rail or grass sprite in the game) — and the review then showed the apron count is IDENTICAL for the mask-swapped twin, because the four corners are symmetric. Now it matches every opaque pixel of `art.crossing(5, 10, false)` against the finished frame at `renderer.tileToScreen`, with a plain road tile in the same frame as the control: 1024/1024 for the right sprite, 635 misses for its transpose |
| `crossable()` mutated to `return true` and the suite stayed green | nothing tested the two clauses the ops actually reach: a road across a rail TUNNEL, and a road across a STATION | a defensive predicate still needs its reachable half tested |
| **`squareOn` mutated to accept two PARALLEL straight runs, and the suite stayed green** | the parallel case is UNREACHABLE through the ops. A crossing whose road and line run the same way needs both its neighbours on that axis to carry both layers — to be crossings — and those would have to be parallel too, all the way out. And the whole-drag prune erodes a road laid along a line from both ends until nothing is left, so even the mutant refuses it | when a law is stated more broadly than the ops can exercise, test the LAW where the law lives: `squareOn` is exported and now has its own arithmetic check |
| `rail: no crossings and no bridges in v1 …` still PASSED after crossings shipped | for a different reason: the check lays ONE tile, and a single tile is never square-on. A green check whose title had become a lie — and its "no bridges" half was untestable on a fixture that is dry by construction, which it had been since the rail arc | retitled to what it holds; Part L' now finds real water, bridges it, and refuses a line on the deck |
| a road dragged along the line: cash unchanged, nothing laid, no message | `input.js:216` returns silently when the plan carries a reason, and `input.js:113` printed the word `blocked` for every reason there has ever been. The rule was invisible | one line: the strip prints `plan.reason`. The old reasons ARE the string `"blocked"`, so every old case reads exactly as it did and the new one says *"Road: a crossing must be square-on — a straight road across a straight line"*, in red, while the drag is still live |
| **"the invariant needs no second rule" — written into SPEC, BACKLOG and a check's comment, and false** | the argument was that an arm can only come from a neighbour carrying the other layer, which would have to be a parallel crossing. Two holes: (a) a road one tile ALONG the line is square-on on its OWN tile and still T-junctions its neighbour; (b) after the bulldozer takes the line east of a crossing, that tile is bare ground the first rule never looks at | the second clause exists now — an op is refused when it would leave a NEIGHBOURING crossing crooked. "It follows" is a proof, and a proof I wrote about my own code was wrong twice in one sentence |
| a legal crossing silently dropped from an L-drag | the prune judged ONE downward pass. The drag's other leg, refused for running along the line, had put a phantom third arm on the corner tile, and a tile refused in round one was never looked at again | the prune re-judges every candidate until the answer settles (`CROSS_ROUNDS` 8, then a downward stabilise that only removes, so it always terminates). Legality is not monotone in the set, so the cap is real, not decoration |
| a crossing whose line was bulldozed off BOTH sides drew as a plain road — pixel-identical, all 32 masks | with `railMask` 0 the bed is a bare centre pad with no direction, `armOf` returns `"pad"`, the rail test was skipped and it fell through to tarmac. The player went on paying `UPKEEP_RAIL`, the census went on counting it, riders went on riding it and the air went on smoking it, for a tile they could not see | the pad falls back to `railKey`, which is what `art.rail(0)` itself draws — a bare bed. The regression check sweeps all 32, busy and quiet |
| `crossing: it smokes as both` green with the rail's emission deleted from the sim | it compared the crossing against a road four tiles up the column. `EMIT_ROAD` is 2 over radius 1, so a MID-column tile collects 2 + ½·2 + ½·2 = 4 and an END tile 3 — the comparison was won by road geometry before the line was consulted. The line's whole contribution is 1, and the margin was 3 | compare the SAME tile with the line and without it. It now asserts the difference is exactly `EMIT_RAIL` |
| `built === 512` in the family check | arithmetic dressed as coverage — the counter is incremented inside a fixed 16 × 16 × 2 loop. Nothing tied the sprite handed back to the masks asked for, and a one-bit typo in the cache key returned the wrong sprite for 256 of them with the suite green | assert the NAME (identity, never an index), assert 512 distinct, and take the 2× twin for all 512, not the 256 quiet ones |
| **the suite DIED on 19% of seeds** | Part L' searched for a clear 7 × 18 patch and, when a 64 × 64 map had none, went on to dereference a null commute — `TypeError` at line 720, no verdict printed at all, exit code from the crash rather than from the checks | a fixture must not be able to take the suite down. It now clears a patch by hand when the search fails, so the section runs on any seed |
| — (not caught, avoided) | the mayor lays a road ring for every block she opens, so restructuring the road op's per-tile loop into a whole-drag validation is precisely the change that could move every gate silently | measured all three gates before AND after rather than reasoning that "a rule that accepts a new case cannot move a run that never attempts it" — the rule is neutral, the refactor is what needed proving |

### Ammunition for the next arc

- **X2, the ride speed, shipped 2026-09-04:** `WALK` moved into the knob
  registry at 9, `RAIL_COST` is 2, and `RIDE_SPEED` is derived as their
  reciprocal ×4.5 — a 50% increase over the old ×3. The implementation also
  re-prices every segment crossed by a large frame and synchronizes exact
  walk/rail boundary poses; felt commute sums integer costs before dividing,
  so an exact comfort threshold stays exact. Focused motion, threshold,
  H-free-rail and rail-less-hash checks are in the 534-check suite; PLAN §4-X
  records the evidence.
- A crossing has no gate, no lights and no bell. It is one ground tile; a
  barrier that drops when a train passes wants the walker layer and the
  two-car train sprite BACKLOG already holds.
- `js/sim/reach.js`'s `tunnelMask` still reads `onRoad ? roads : rail` — a
  hard one-or-the-other. It is unreachable on a crossing (a crossing can
  never be walled, and the suite asserts it), but Part R, which standardises
  `served`, will be in that file and should leave it correct rather than
  merely unreachable.
- **Two mask functions, one law.** `ops.js`'s `maskAround` and `render.js`'s
  `roadMask`/`railMask` compute the same 4-bit neighbourhood from different
  inputs (the op needs a pending drag counted in; the renderer reads the live
  world). They agree today and nothing proves they must. If a third caller
  appears, give the law one home.
- The crossing is the first tile that is a walk node AND a ride node, so a
  stored path may name one tile twice. Nothing downstream doubles it today
  (checked), but any future code that assumes a path's tiles are distinct is
  now wrong.
- Superseded by this section: §4's *"v1 limits … no level crossings"* and
  §15's *"the art registry reserves … crossing with loud not-built errors"*.
  Handoff sections are appended, never edited; read them with this one.

---

## 23. Session 15 — the freeze on a freshly zoned lot (2026-09-03)

The owner: *"the game hangs on placement of residential tiles."* It did not
hang. It threw, once, and the throw took the game with it.

| what | where |
|---|---|
| the bug | `js/ui.js` `cardForTile` — `TIER_NAME` has rows 1, 2, 3, and the card's name string was built EAGERLY beside the ternary that only uses it when the tier is non-zero. On a lot that is zoned and still empty `t` is 0, so `TIER_NAME[0][0]` was read and threw |
| when it broke | `9c89f73` (session 11, the blocks). Before it the whole template sat INSIDE the ternary, on the truthy arm beside the literal "zoned, empty", so it was never evaluated for an empty lot. The blocks commit hoisted it to a `const` to share it with the block name. Mine |
| why it looked like a hang | the throw landed in `main.js`'s rAF frame ONE LINE above `requestAnimationFrame(frame)`. The loop never rescheduled: no ticks, no drawing, no input, no message |
| why no gate saw it | **nothing in the suite had ever run `js/ui.js`.** 373 checks, and the panel — the card, the tabs, the census, the rules, the reader — was read twice as TEXT by a grep and executed never |
| how long it was live | five sessions. Every browser round since hovered roads, rail and built lots; none hovered the chalk you get in the first ten seconds of a new city |

### The fix, in three parts

1. **The name is lazy again** (`() => …`, called only when `t`). One line.
2. **`frame()` guards its body and reschedules from the `catch`.** A panel bug
   is now a glitch: the first five faults go to the console with their stack
   and the player is told once that the panel stumbled. Not swallowed — the
   suite is what keeps the card honest — but never fatal again.
3. **`tools/dom-shim.mjs`** — enough DOM to run the real `createUI` in Node,
   plus `stubApp(world)` and `textOf(el)`. It installs `headless-canvas` and
   still hands back a real canvas for `createElement("canvas")`, so one
   process can drive the renderer and the panel. **Part U'** then sweeps every
   distinct tile state a thirty-year city holds — 32 of them, hovered and
   pinned — and the zoned-empty case in all four zones at both densities.

### What the instruments caught

| what it looked like | what it was | the rule |
|---|---|---|
| "the game hangs" | it threw. The rAF loop's own last line is the reschedule, so ONE exception anywhere above it ends the game silently. A hang and a throw look identical to a player | when a loop reschedules itself, the reschedule belongs in a `finally`-shaped position, not after the work |
| the sim was innocent | `node` ran the zone op and six ticks in 2 ms. The suite was green. The play camera was green. All three were looking somewhere else | reproduce in the layer the report names. "The game" is the browser, and the browser was the one thing no gate ran |
| a sweep that found "5 distinct tile states" in a grown city | `updateHover` takes `{ tile: <index> }` and I passed `{ tile: {tx, ty} }`. It threw on garbage and reported garbage — a metric that agreed with everything | read the consumer's shape before trusting a sweep's count. 5 states in a 2,000-animal city was the tell, and I nearly walked past it |
| the browser console said the bug was still there after the fix | the preview pane's console buffer is STICKY across reloads and navigations. The stale line even named `main.js:305`, which the fix had turned into `try {` | for absence, use page-local evidence: a fresh `window.onerror` trap and a frame counter. 702 frames and `errs: []` is proof; an empty console is not |
| the pane fires no rAF while hidden | `document.hidden` is true, `requestAnimationFrame` never fires, and `world.tick` sits at 0 however long you wait | drive the loop by hand (`walkers.update` → `renderer.draw` → `ui.updateHover`) or force frames with a screenshot. This is the fifth time the hidden pane has cost an hour — it is in the traps memory for a reason |

### Ammunition for the next arc

- The shim makes the whole panel testable for the first time. The tabs, the
  census, the news reader and the saves menu are now reachable by a check and
  still unswept — the card was swept because that is where the fire was.
- Nothing asserts what the card SAYS beyond "zoned, empty" and "tier N". The
  panel is the game's largest prose surface and its text is untested.
- `stubApp` returns stubs for every button's action. A check that wants to
  know what a BUTTON does can override one and press it (`El.dispatch`).
- The frame guard counts faults. If a future session wants a real telemetry
  line — "the panel stumbled N times this session" — the counter is there.

## 24. Road access, standardized — Part R (session 15, 2026-09-04)

The owner asked four things in four sentences, and they turn out to be one
rule: *"as long as a tile is within 1-3 tiles of the road it has road
access"*, *"the 6x6 squares have roads around the whole perimeter, so nothing
is more than 3 tiles away"*, *"i want that rule standardized, including rail
and warehouses, and zoos"*, *"the other way to think about it is that all
sides have access points."*

**The standard.** `fields.served(world, i)` — the nearest road distance over
the whole FOOTPRINT (`world.siteTiles`: a block's tiles, a zoo's four, or the
tile itself) is `<= ROAD_REACH` 3. `hasAccess` is deleted; nothing in
`js/sim` outside `fields.js` reads `world.roadDist` for itself except the
hover card, which prints the tile's own number beside the site's and decides
nothing with it. `doorSearch` returns `{ d, doors }` — every road tile at
that distance, ascending — because all sides are access points.

**What moved, by rule**

| rule | was | is |
|---|---|---|
| R/C/I/M growth, decay | `hasAccess` on the tile | `served` — identical for a 1×1 |
| a 2×2 or 3×3 block | `hasAccess` on the tile | `served` on the block |
| industry above tier 2 | `roadDist <= 1` (SC2000 frontage) | `served`. **Deleted.** 11 more tier-3 works in the millbelt |
| a rail station | a road tile ORTHOGONALLY beside the platform | `served`, and the forecourt is walked |
| the zoo | jobs on the anchor; halo and cap ungated | `served` on all four, gating all three |
| meat hall, centre, fire, police | `hasAccess` | `served` |
| doors | ONE road tile, first in N-E-S-W order | every road tile at the site's distance |

**R1 alone is hash-neutral, measured.** The plan asked for the op-time
recompute to land first with every gate unchanged. It landed with the rest,
so the claim was checked in a scratch worktree instead: the hunk applied to
`411d903` and nothing else gives `771239e1` / `27376829` / `10a8a697` /
`e48a4e21` on balanced / dormitory / millbelt / estate — the same four
hashes as the untouched tree — and 428 checks, 0 failures. A claim of the
form "this changes nothing" is cheap to make and cheap to check; check it.

**Measured** (`tools/accessprobe.mjs --layout millbelt`, seed 7, 30 years):
mean **1.37 doors a lot**, **36% of lots leavable by more than one side**,
**6 industrial lots at tier 3 that the frontage rule capped at 2** (1.42 / 37%
/ 11 before the op-time re-plan of 2026-09-04 changed the year-30 town), 0 lots
out of reach (the mayor's 6×6 estates are ringed, exactly as the owner said).

### The traps, by what each one LOOKED like

| it looked like | it was |
|---|---|
| `save → load → continue` diverged by ONE mood point in three animals | Nine commuters' paths started one tile earlier in the straight run than after a reload. A 2×2 merge had changed their home's DOOR SET, and nothing marked them stale — the straight run kept a legal older path, the reload computed the new one. `blocks.replanOn`. The same class as `placeHousehold`'s fixed comment |
| the landmark check said "no landmark in ten years" | It never was a fixture; it was a coin flip that seed 7 happened to win in year 7. Four seeds × two layouts: TWO of eight raise a 3×3 in 30 years, before the change and after. The check now forces `BIG_P` inside a real `tick` |
| "the centre fixes — fixed 0 · pacified 1" | A snapshot at the end of a 24-month window cannot see an animal fixed in month 3 that died in month 20. Count over the window |
| "the killer's own walker — 136 vs 136" | The check paired the FIRST predation record with the LAST walker seen. One killer killing twice makes those different sacks. Capture the pairing, do not infer it |
| the mayor's zoo bought a +500 cap for nothing | `--layout estate --zoo 12` placed it at (26,0), five tiles from the nearest road. It had never had jobs (those were gated); the halo and the cap were not. The mayor now takes the first free 2×2 a road REACHES |
| the overlay check read `9e7d52` — an earth ramp — where a green band should be | The building. Every overlay is painted on the ground and then built over, so a block hides its own tile's tint. The check takes the storeys down to photograph the band; the limitation is real and is in the BACKLOG |
| the commute fixture said "no way" | `COMMUTE_MAX` is 40 walk steps. A detour built to be *long* was built too long to exist |

### The three shapes worth keeping

**A quantity that decides something must be asked of the whole thing it
decides about.** `hasAccess(anchor)` was not wrong for a 1×1 and was wrong
for everything else; the bug was invisible for as long as every site was one
tile. When a footprint concept arrives (blocks, session 9), every predicate
that takes a tile index has to be re-read.

**Changing a thing's SHAPE changes its derived state.** A merge changes the
doors; a split changes them back. Anything cached from the old shape — a
path, a route, a door — is now stale and the save/load law is what finds it.

**The forecourt is laid into the path.** A graph edge that skips tiles is
cheap to write and lies to everything downstream: `commuteTime`, the traffic
count, the walker's line of travel and the "every path tile is a road" check
all assume consecutive entries are neighbours. `nodePath` expands the
station link so that assumption stays true — and a new check asserts it.

### 24b. What a hostile review found (and what it says about how I check)

The part went out at 465 checks with 18 mutants caught and no survivors, and
an adversarial reader scored it **6/10** with eleven named defects, every one
carrying a command and its output. All eleven are fixed in `46770c0`. Four
were real behaviour; the rest were my prose or my checks. What is worth
keeping is the SHAPE of each miss.

| what it found | the shape of the miss |
|---|---|
| a forecourt walked through a neighbour's house and across a river, and `served` called the platform a station for it | **I generalised a predicate without re-reading what it now MEANS.** `doorSearch` was a reach test; the moment its tiles went into a stored path they became ground an animal stands on, and "through any tile a wall does not block" stopped being the right rule. A test's meaning changes when its OUTPUT changes use |
| a frontage rule spelled as an N4 scan over `world.road` passed the check named "no module tests a road's nearness for itself", and dropped the fixture town 41% | **A grep polices a spelling, not a claim.** The claim is behavioural — two lots alike but for their distance must cap alike — and that is what the check asks now. Second-order: the suite had no guard on the town's SIZE at all, so a 41% collapse was a report line |
| a park was told it had no road | **Two copies of "who is asking"**, one in the card and one in the overlay, and I wrote the second one wider than the first. One predicate now |
| the overlay's meaning inverted at `ROAD_REACH` 5 | **A table counted out to the length of today's constant.** Every check ran at 3, so nothing saw it. Index and clamp |
| the door a station link LANDS on was unpriced | **I tested the interesting half.** The fixture painted the forecourt and never the door, so the chain's price was pinned and the landing's was not |
| a new building rerouted a station to the SAME door at the SAME distance, yet commuters kept walking through it | The door-graph signature recorded station and door endpoint ids but not the exact forecourt chain copied into stored paths. Equal endpoint and equal distance do not mean equal derived state. The signature now includes every stable door→chain mapping; the regression proves live invalidation, the alternate path and save → load → continue |
| `splitLot`'s re-plan was never exercised | **My check said `commuters.length === 0 \|\| ...` on a fixture with no citizens.** A guard that can never be false is not a check — the second one I wrote this session |
| a tile sealed inside a wall had a door | `computeRoadDist` refuses to ENTER a barrier; the door search started INSIDE one and walked out. The agreement sweep ran on a rig with no walls in it |
| `computeStationDoors` at the op was provably inert | **Insurance is not behaviour.** Deleting it passed. Either delete it or make it load-bearing with a check; I made it load-bearing — and the first draft of THAT check did not discriminate either, because moving a road AWAY leaves the walk stuck on a dead door and falling back to the road, which is what it does with the links rebuilt too. Move the road CLOSER |
| the commit's own numbers were wrong in four places | I quoted a check count from before a rebase and gate hashes measured on a different parent, with the flags unrecorded. **A verification section is a claim like any other** |
| "the rate did not move" (the landmark repair's justification) | I measured 4 seeds × 2 layouts and generalised. The reviewer's eight was a different eight, found a town mine never sampled, and the direction flips on `--markets`. **n = 8 decides nothing**; the honest sentence is that it is rare and unsettled |
| neither headline mechanism happens in any town the mayor builds | **All the evidence was unit fixtures**, and no gate could see the feature. `--rig deep` builds a town she would not and reports both |

The one that will outlive this part: **a rule whose only reachable case is a
DEMOLITION**. The footprint rule cannot bite while a city grows, because
`joinable` requires every lot of a window to be served on its own — a block
never forms across the line. It bites when a road is taken away, and when a
zoo's four tiles arrive at once. I had written it up as a growth rule in three
places before anyone asked when it could actually happen.

### 24c. The second review — READ THIS BEFORE TOUCHING ACCESS

Scored **6.5/10**, and the score barely moved from the first review's 6 for
three stated reasons: the headline bug of round one is still reproducible on
unmutated HEAD by a different trigger; the change breaks the repo's strongest
gate; and "28 mutants, 28 caught" did not survive an independent sweep — ten
survivors in forty-nine, three of them sitting on the lines the first round's
fixes added.

**The full list is in `BACKLOG.md` under "The second hostile review — all
thirteen, closed".** It was written down here BEFORE any of it was fixed, and
§24d below is what closed it. Do not start anything else in this area without
reading both. The short version of what was found:

- **`fields.passable` reads `tier` and `civic`, and nothing invalidates paths
  when those change.** A building grown across a station's forecourt leaves
  stored commutes walking through it, and save → load → continue diverges one
  month later. This is handoff §24's own lesson — a shape change invalidates
  what was derived from the shape — applied to merges and splits and not to
  the new shape change this part invented, which is a building GROWING.
- Six surviving mutants on the new code, each with a live reproduction.
- A third guard that cannot be false, and a sentence in SPEC §6c that is
  simply untrue (`NEAR_REACH` does not track `ROAD_REACH`).

**The shape of THIS round's misses**, which is different from round one's:

| round one | round two |
|---|---|
| I reused a predicate whose meaning had changed | I made a NEW predicate and did not ask what invalidates it |
| my checks tested the interesting half | my checks tested the *first* half — the one fixture I wrote for a case, routed so it never reached the second |
| a grep policed a spelling | a behavioural check policed ONE tier and ONE call site |
| the canary was missing | the canary exists and is too wide to fire on a 10% swing |

The pattern under all four: **I fix the instance I was shown.** Round one
showed me a forecourt through a house; I made a `passable` predicate and
pinned water, walls and houses — and did not ask what else changes `tier`, or
who else reads the answer, or whether the graph agreed with the field. A
review that hands you a reproduction is handing you one member of a class.

## 24d. All thirteen, closed — and what the sweep taught (session 15, 2026-09-04)

`bb175ad` fixed finding 1; this section is findings 2–13 and the sweep that
checked them. **483 → 489 checks, 0 failures.** A 19-mutant sweep aimed at
exactly these lines catches all 19.

| what | how it is held |
|---|---|
| the graph and the field could disagree (2, 3, 6) | ONE check: `doorsOf` and `world._stationDoors` are the same list, same order, asked of every platform after a build, after two years, after a reload and after an op — plus the consequence, two identical lines with one north end behind a river, and the rabbit walks to the far one |
| the civic clause, the "dead" bridge clause (4, 10) | the rulings table `572b5d2` added after the review was taken; two more rulings, plain track and a platform, so they are decisions |
| the doors sort (5) | ONE sort now, at the one exit both returns pass through, held up by a platform entered from EAST and WEST; and the town canary narrowed from 250–560 to 365–405 |
| `joinable` / `troubled` (7) | two PAIRS on `blocks.mergeWindow` directly: the far corner out of reach, then in; then the ANCHOR out of reach |
| `NEAR_REACH` (8) | a function, `nearReach()`, read at call time; the check reads the horizon INSIDE the moved window, at 5 and at 9 |
| the card's forecourt, the doubled refusal (9, 13) | the DOM shim hovers a real platform and reads the card's own words, against the link chain the commute carries |
| `walkers.door()` (11) | it calls `doorsOf`, which carries `accessOpts` with it |
| `render.js` writing `world._seen` (12) | every reader takes an optional caller-owned `seen`; the draw layer owns one, and a check stamps the world's, draws over it, and demands the stamp survive **and the frame still be a frame** |

### Three traps, for whoever is next

**A sweep harness must run the unmutated seed first.** A first draft copied
`js/ tools/ docs/` into each sandbox; `check.mjs` reads `css/field.css` two
thirds of the way through; twelve mutants came back "CAUGHT" — by an ENOENT.
A harness that cannot run the code reports a perfect score. `msweep/run.mjs`
now runs the seed and exits 2 if it is not green, and separates CRASHED from
CAUGHT so a crash never reads as a caught mutant.

**A line added for one reason can take the teeth out of a check written for
another.** Finding 1's op-time half is "every commute that walked it re-plans
in the same breath" — and the check measured that AFTER a `tick()` that had
been inserted to dodge the same-month-save hole. The tick settles the doors
itself, so deleting the op-time settle left the check green with 317 animals
walking through a police station. Measure the claim where the claim is made.

**A line that cannot be made to fail is not being held by anything.** The
`d = 0` doors sort survived every mutant because `siteTiles` happens to come
back in raster order, so a site standing on several roads already listed them
ascending. It is not dead — it is the guarantee that "ascending" does not
quietly depend on the order `world.js` walks a footprint — so it moved to the
one exit both returns go through, where the live case holds it up. When a line
cannot be made to matter, move it somewhere it can, rather than deleting it or
leaving it unheld.

### Still open, and not this part's to close

A save taken in the SAME MONTH as any path-invalidating op reloads to a
slightly different city. It is PRE-EXISTING — measured on `411d903`, a road
edit does it too — and reachable in play, because `main.js` autosaves on
`pagehide`. Reproduction and three possible resolutions are in `BACKLOG.md`;
picking one is a rule call, not a bug fix.

## 24e. The third review: the same bug one level down (session 15, 2026-09-04)

A third hostile reader scored `46e16e5` **6.5/10**, and the headline of the two
commits before it was still false. **483 → 503 checks, 0 failures.**

**The bug.** `markDoorsMoved` hashed the door SET. The forecourt CHAIN — the
tiles between a platform and its door — was not in it, and the chain is what
`nodePath` lays into every stored path, what `computeTraffic` counts, what
`commuteTime` prices, what `exposure` reads the player's line on, and what a
walker is drawn standing on. So a civic dropped on the tile both of a
platform's doors were reached through left **both doors standing** — the
platform is entered from either side — moved every chain, and raised nothing.
99 commutes kept walking through a police station; §15 broke a month after a
tick-boundary save. The signature is `platform > door : chain` per edge now.

**And the check written for exactly that claim performed the counterexample
and asserted past it.** It applied the police station, asserted the doors were
still two (they were), and never looked at the chains. That is the third
distinct way this part's checks have been one step short of their own claim.

### The traps, keyed by what you would see

| what you see | what it is |
|---|---|
| a "shape changed" flag that never fires | the signature covers the NAME of the derived thing and not its CONTENT. Ask what a reader of this actually consumes — here, the tiles, not the door |
| a check that applies the counterexample and passes | it asserts the part that did not move. Assert the part the bug moves |
| card and graph disagree for exactly one month | something razed or built AFTER the settle in the tick order. `eventsTick` is step 7; the settle was at 4b |
| "no road within 8 tiles" beside "road 2" in one card | a search LIMIT printed as a measurement. A platform's access is a WALK, so the raw field and the walking answer are different questions and both are true |
| a check name with a number in it | the number is untested by construction unless the assertion is an exact list. "six modules" was five |
| a published figure that will not reproduce | it names no rig. `accessprobe --cost` prints the town it timed |
| a check that lists which modules IMPORT a predicate | a spelling. A mutant can keep the import and shadow it — `justice.js`'s `served` was unheld that way, and a centre no road reached still took prisoners. Pair every list with one PAIR OF RUNS |

### Still open, and not this part's to close

A save taken in the SAME MONTH as any path-invalidating op reloads to a
slightly different city. PRE-EXISTING — measured on `411d903`, a road edit does
it too — and reachable in play because `main.js` autosaves on `pagehide`.
Reproduction and three resolutions are in `BACKLOG.md`; picking one is a rule
call, not a bug fix.

### The lesson, a third time

Round one showed me a forecourt through a house; I pinned water, walls and
houses. Round two showed me a forecourt that CLOSED; I hashed the door list.
Round three showed me a forecourt that MOVED. **Each fix was exactly the size
of the example I was shown**, and the general question was available every
time: *what else is derived from this, and who reads it?*

## 24f. The fourth review: my own fix was the new bug (session 15, 2026-09-04)

**7/10**, up from 6, 6.5, 6.5 — and the headline finding was the settle I added
one section ago. **503 → 517 checks, 0 failures.**

**The bug.** `settleDoors` runs three times a tick, and the third runs AFTER
`citizensTick`. Its `invalidatePaths` therefore had no stale pass coming: the
month ended with every commute null, and month +1 took traffic, riders and mean
commute from NOTHING in the straight run while a reload took them from
everything. §15's hash at the boundary is equal either way — `c.path` is not in
`canonicalCitizen` — so the two cities parted a month later. **No op was
involved and the save was at a clean tick boundary**, so this was not the
same-month-op hole in BACKLOG; that hole's own stated workaround ("hash-equal
from any TICK boundary") was false at `4b9b6d0`.

The rule now has a name: **NOTHING MAY END A TICK STALE.** `citizens.replanStale`
is exported and `settleDoors` calls it.

### The traps, keyed by what you would see

| what you see | what it is |
|---|---|
| an invalidation that is never repaired | it ran after the pass that repairs it. Ask WHERE IN THE TICK your invalidation sits relative to `citizensTick` — before it, the stale pass is coming; after it, you must re-plan yourself |
| a hash equal at the save and different a month later | the thing that differs is DERIVED and unsaved. `c.path` is the standing example: the reload rebuilds it, the straight run carries it |
| a fixture with `noDisasters = true` | ask whether the case you are testing needs a disaster. Thirteen access fixtures had it, including the rig built *because the mayor cannot build a forecourt* |
| a fire fixture with no citizens | the claim is about stored paths and the rig has none. Count the population of every fixture whose claim is about people |
| a mutation sweep with a clean sweep | check the suite for WALL CLOCKS. `check("tick cost", ms < 30)` fails under contention and exits 1 like any other failure; at fourteen lanes it turned eight survivors into "caught" |
| a table in SPEC listing which rules ask a predicate | each ROW needs a pair of runs. Three of ours were spelling |

### Two behaviour bugs the standard itself had

The census counted jobs at sites nobody could reach — so an unreachable zoo
moved the C and I valves exactly as a working one did, though no animal could
ever take one of those jobs. And an unreachable pacification centre kept its
van's land-value shadow while the zoo's halo was gated. Both fixed, both
hash-neutral on all six published gates, because the mayor never builds an
unreachable anything: **the gates cannot see this class of bug at all**, which
is what `--rig deep` is for.

## 24g. The fifth review: the fix was still the size of the example (2026-09-04)

**7/10 again**, and the finding was that round four's law was not the law.
**517 → 523 checks, 0 failures**, all six gate hashes unchanged.

**The bug.** Round four's `replanStale` went INSIDE `settleDoors`, which only
runs its body when the door graph moved. But `c.stale` is written in three
places and only one of them is about doors. The reachable one has nothing to do
with stations at all: `eventsTick` razes a home at step 7, `evictFromLot`
rehomes the family, `placeHousehold` marks them stale — and `citizensTick`, the
pass that repairs a stale commute, ran two steps earlier. 53 employed animals
ending the month with no commute on a town whose only event was one fire, and
`9324161b` against `9e3e5077` a month after a reload. What diverges is **mood**,
which is saved.

`replanStale(world)` is unconditional at the end of `tick()` now, after
everything that can mark an animal stale. **The law is a property of the
BOUNDARY, so it belongs at the boundary** — not inside whichever mechanism
happened to be under review.

### Enumerate the writers, not the example

The general question, asked properly this time: `c.stale = true` appears in
exactly three places — `citizens.placeHousehold`, `citizens.invalidatePaths`,
`blocks.replanOn` — and the only caller of any of them that runs after
`citizensTick` is `eventsTick`. That enumeration took two minutes and would
have closed this in round three.

### The traps, keyed by what you would see

| what you see | what it is |
|---|---|
| a repair placed inside a condition | the condition is about the MECHANISM you were reviewing; the law is about the state. Ask what else writes that state, and grep for it |
| a fixture that cannot reach the case | check the DEFAULTS one level up. `tools/mayor.mjs` defaults `disasters` false, so every published gate for this part runs with nothing ever burning |
| a card guarded on a raw field | `computeRoadDist` clamps at `ROAD_REACH + 1`. Any guard of the form `raw <= n` can only see the clamp's own range, and everything beyond it falls to the else |
| a sentence in the Rules tab | the player reads it. G1 described a platform's access as a distance through any tile; it is a search over ground it can stand on |
| "every mutant on X dies" | count them. Ours said "both tick settles" and one of them had nothing behind it |
| a section number in a citation | §16 is *Module contracts*; the save/load law is §15. Seventeen citations were wrong, in four files, including this handoff |

### What is held structurally rather than behaviourally

The settle after `lotsTick`. Its only consequence is timing — an animal whose
route closed this month is released before the job search rather than after —
worth 40 animals over 60 months on one fixture and two in the month itself.
Too small and too seed-fragile to assert without pinning a golden number to a
seed, so the ORDER of the three settles is checked against `tick.js`'s source
and the number is written beside it. That is a spelling-level tripwire and it
says so.

## 24h. The sixth review: the loop was the class (session 15, 2026-09-04)

**7/10.** **523 → 526 checks, 0 failures**, all six gate hashes unchanged.

**The bug.** Round four gated `jobsOf` in the census by `served`. Three lines
below it, in the same loop, `fireStations`, `policeStations` and `centres` were
counted ungated — and `justice` sizes the ARREST FORCE from
`cen.policeStations`. A police station eight tiles from the only road,
employing nobody and covering nothing, did **35 of the 38 arrests** a working
one did. The advisor's "no fire station" and "no centre" lines were silenced
the same way, and the "centre is full" warning sized its beds from phantom
ones.

**The lesson, which is the same one for the sixth time: THE LOOP WAS THE
CLASS.** When a fix lands inside an iteration over a set, the other members of
that set are the first place to look, before anything cleverer.

### And one I opened myself

I had deleted `settleDoors`'s `replanStale` as redundant, on the argument that
the boundary call covered it. It does not: `justiceTick` and `meatTick` read
`c.path` INSIDE the tick, between the 7c settle and the boundary. 129 animals
holding no commute when justice asked; `09222178` against `0c2a6629` eight
months later. **"Redundant" is a claim about every reader, and I had only
counted the ones at the end.** `world.last.staleAtJustice` is a readout now so
the law can be checked rather than argued.

### The traps, keyed by what you would see

| what you see | what it is |
|---|---|
| a gate added to one line of a loop | the loop is the class. Check every other member of it in the same pass |
| a counter used for UPKEEP and for EFFECT | they want different gates. You pay for a building you cannot reach; it does not work for you |
| "this call is redundant now" | enumerate the readers, including the ones inside the same iteration. Ours had two (`justiceTick`, `meatTick`) between the write and the repair |
| a fixture that builds its own answer | `need-stress` built commutes with `roadPath` and then checked they were all road. 1258 of 1258 passed, forever |
| a rig built for a case | check it can still MAKE the case. The deep rig's forecourts sit on unzoned ground: nothing can be built or burnt there, and the settle fires 0 times in 360 months of it |
| a correction to a previous false sentence | it can be the false one. Round five "corrected" SPEC's "only a platform" and SPEC was right — 354,843 sites say so |

## 24i. The seventh review, and the owner's ruling (session 15, 2026-09-04)

**7/10.** **526 → 531 checks, 0 failures.** Three of six gate hashes move, for
the first time since the part shipped, and the reason is a real bug.

**AN OP ERASED THE TOWN'S TRAFFIC FOR A MONTH.** `ops.apply` invalidated every
commute and nothing rebuilt them; the next tick counts traffic at step 1 and
repairs at step 5. So pollution, land value and crime were computed from
nothing, in the same tick that rolls growth and decay — and it was FARMABLE:
one §1 repaint a month bought +4.6% population, -29% pollution and more cash
than doing nothing. `apply` and `undo` re-plan now. **This was the long-standing
"same month as an op" item in BACKLOG, which had been written up as a save/load
divergence for weeks. It was never only that.** Look at what an invalidation
costs the LIVE game before deciding it is a save-file question.

**A forecourt walked through a wall, sideways.** `passable` refused only a bare
wall, so a wall pierced north-south by rail was a doorway east-west on foot —
the same tile a smell could not cross. §6b said "open along its axis only" and
was enforced for every area effect and neither of the two that matter here.

**And the owner ruled while it was open:** *"any placeable building should be a
functional building … if a building meets the requirements to exist it should
be functional."* `ops` refuses a fire station, a police station, a centre or a
zoo where no road reaches. A park and a PLATFORM stay placeable — a line is
laid ahead of the town — and an unreachable platform wears the NO ROAD zot,
"like houses that are too far from the road". Every fixture that needed a dead
building now builds it and bulldozes its road, which is the only way a player
gets one and the honest reproduction besides.

### The traps, keyed by what you would see

| what you see | what it is |
|---|---|
| an invalidation with no re-plan | ask what reads the derived thing BEFORE the repair. Traffic is counted at step 1 and repaired at step 5 |
| a bug filed as a save/load divergence | check whether it changes the live game too. This one was worth +4.6% population to anyone who noticed |
| a law enforced in one traversal | grep for the other traversals of the same relation. §6b's axis rule held for `forEachWithin` and not for `computeRoadDist` or `doorSearch` |
| a fix pinned at a counter | pin it at the READER. Gating `cen.policeStations` did nothing for `justice`'s force, one line away |
| a check that reads a readout with `\|\| 0` | a missing field reads as compliance, and a mutant can delete both together |
| a fixture that cannot make its case | `need-stress` asserts "no walked tile is un-walkable" in a world with no rail: there is nothing to walk that is not a road |

## 25. People E — the people show on their buildings (2026-09-05)

The owner's instruction was to take section E while another agent finished R.
R's 4b46204 landed during this work; it was fast-forwarded into the checkout,
E reapplied cleanly, and the combined suite and before/after comparison rerun.
No access or simulation rule is changed by E.

The twelve original zone/tier families now have four distinct plans (48 total).
The additional plans are authored solids in `js/art/building-plans.js` through
the existing rasterizer. The commercial tower's original mirrored plans were
identical because both roof features sat on the diagonal; its stack is now
off-axis. The specialist shop pool keeps the same business-kind mapping.
Only the corner-shop kind takes four plans; the other ten shops keep two.

`building-character.js` decorates all 106 unique lots, shops, blocks and
landmarks with four occupancy-light levels and fourteen species stamps. Glass
skins declare glazing; blue paint, water, ice and fishmonger floor tiles do
not light. R reads occupants/capacity; C/I/M read staff/jobs. Marks read the
existing majority array, and `lotReport.mark` feeds the Inspect sentence.
The cache is keyed by base plan, light level, species and one of four stable
tile phases. Both normal and hi-res rendering use the decorated solid recipe.

The first sheet hid marks behind bays and roof structures. Socket selection
now uses the building's depth buffer, with a separate socket pair recorded
for each mirrored plan. A second visual pass caught residential marks being
placed on chimneys; residential candidates are now glazed facades, verified
explicitly by the suite. Staff marks use a visible roof point. Every changed
mark pixel stays in its 6×6 socket and the building's footprint prism at both
resolutions. This was a local PNG/code review, not an independent critic panel.

Verification:

- Canonical suite: 547 checks, zero failures after R integration; the final
  facade restriction is covered by the same visibility/bounds check.
- Part E checks 106 plans, 111,513 glass-pixel transitions and 19,697 changed
  mark pixels at 1× and 2×. All twelve four-plan families differ pairwise;
  all fourteen stamps are unique. Increasing occupancy only adds lit glass.
- The existing 30-year display-on/off test now queries building appearances
  every month as well as walkers and needs; the simulation hashes agree.
- Independent seed-7 30-year mayor runs on R's baseline and R+E both end at
  hash `92b2a0d2`, 1,659 citizens, 1,009 households and 277 events.
- The real play renderer, seed 7 at June 2020, gives the same 1,512 citizens,
  §33,139 and crime 37 before and after. Committed `people-e-before.png` and
  `people-e-after.png` differ visually; the lots and simulation are unchanged.
- Generated and read the buildings, marks, lights and hi-res contact sheets.
  The live browser loaded the 1,512-citizen city and drew both zooms with no
  warning/error logs. A 30-frame warm sample of the industrial view measured
  1.32 ms at zoom 1 and 0.51 ms at zoom 2 on this host; this is a view-specific
  warm-cache measurement, not a cold-start or whole-city performance claim.

| symptom | where to look |
|---|---|
| a blue structure starts glowing | its skin was incorrectly tagged `glazing`; fishmonger tiles need their height predicate |
| a mark disappears at one zoom | socket visibility and `stampAtWorld` depth; test both resolutions |
| a residential mark sits on a chimney | wall candidates must be facade skins, not arbitrary tall boxes |
| a new plan never appears on commercial tier 1 | the shop kind owns the high variant bits; keep its mapping intact |
| every lit window rerasterizes every frame | preserve appearance-cache identity; the renderer raster cache is sprite-based |

SPEC §12.2e is the current contract. Age-based ivy and patched roofs remain
E's optional stretch. No saved age array or save migration was introduced.

## 26. Four larger civic campuses (2026-09-05)

The owner asked for improved art for 3×3 fire stations, police stations,
pacification centres and zoos while another agent handles placement. The
four new solid recipes live in `js/art/civics-large.js`. The firehouse has
three bays and a hose tower; police has a blue portico and patrol yard;
the centre surrounds a fountain courtyard; the zoo has a paw gate, pond
overlook and shelters. Both resolutions are shown in the new civic sheets.

Integration is explicit: call `art.civic(kind, 3)` for a nine-tile lot.
Omitting the side still returns legacy art. The park is unchanged. This
commit does not allocate lots, change service radii or migrate saves.
The placement agent needs to wire both the world sprite and build preview
to the allocated side. See `docs/ART-CIVICS-3X3.md` and SPEC §12.2f.

Every new recipe participates in the existing palette, footprint, hi-res
and pedestrian depth audits through `allSprites()`. The canonical suite
also checks explicit selection and legacy footprint compatibility.

## 27. Civic campuses, Large Park and Zoo prison — 2026-09-05

The art-only handoff above is now integrated: five 3×3 campuses, adjacent-road placement for services, a road-free Large Park retaining the garden, and a separate 24-bed Zoo prison. Sentencing follows the owner's theft/murder rules. Existing saves retain old footprints. The canonical suite passes all 586 checks; both zooms and corner inspection were verified in the browser. See [the current handoff](HANDOFF-CIVIC-CAMPUSES-2026-09-05.md) for save migration, the population canary and six measured 30-year hashes.
