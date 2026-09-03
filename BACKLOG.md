# BACKLOG — Zoo City 2000

Open work, ranked. The design record is `SPEC.md`; the numbers are in
`js/sim/rules.js` (KNOBS). Later layers were labelled at design time so v1
could ship whole.

## The People — IN PROGRESS 2026-09-03 (`docs/PLAN-THE-PEOPLE-2026-09-02.md`); Parts K and S shipped
The owner: *"a master plan for how to really improve zoo city … one part i'd
like is to be able to see the residents thoughts when they walk around. a
larger goal of relating more strongly with the individual citizens. i think
more character and variety in the building sprites might help."* And on
the first draft: *"the thought bubble text should be clues about needs,
stuff like 'i wish there was more shopping nearby'. probably the easiest
thing to do is reuse the inspect button. also the meat market should have
more meat on hand. out of 2,800 animals they only sold 20 units of meat in
the whole history of the town and have 15 in cells."* The shared keel and
the independent parts: **K** the keel (`moodTerms`, `life.js` API,
`world.majority`, `world.meat`, `storyTick` stub, reserved art names —
lands FIRST, ½ session) then **A** needs (under the Inspect tool, the
animals near the cursor say what they want — every line is a sim term that
hurts, with the remedy under it on the card; the Census gains "what the
town wants") · **H** meat on hand (`world.meat` per hall; inflows = the
killing's sack walks INTO the hall, the hall BUYS the town's ~24 natural
deaths a year, SOLD as ruled; outflow = carnivores eat; measured first:
11 halls made §38.9k of cut with 4 killings and 2 sold in 30 y — meat is
not a quantity today) · **B** lives (a 12-entry ring per citizen + the
graveyard; the save compaction pays for it — citizens are 732 KB of a 906
KB year-30 save, mostly default fields) · **C** Inspect extended (the pin
is a CITIZEN; follow/star a stretch) · **D** looks and faces (4 looks per
species, portraits, an idle pose) · **E** buildings with character (4
plans per family, windows lit by fill, a species mark on the socket) ·
**F** the story channel (obituaries, litters, a people chip, clickable
names) · **G** integration. The plan's §5 is the file-ownership table; K7
copies it here when the keel lands. Measured for it: mean friends per
citizen 0.67 — the graph is thin; the plan makes that visible and does
not touch the knob. Ruled on H: *"natural deaths is a good option. selling
cubs sounds right, although i think the meat vendors would grow them to
adulthood for best return on investment."* → the hall buys the dead, and
buys livestock cubs into a PEN (`held`/`heldAt` + `c.pen`; slaughtered at
16 for 2 units; the card lists the pen by name and date). **Scale (plan
§1b):** the owner builds 6×6+ blocks with ≥ 30 tiles between residential
and meat; the scripted mayor's BLOCK 7 puts the hall next door — so the
dread smell (4 tiles), KILL_MARKET (`dread[home] > 0`) and the hall's §50
from a killing (`hallNear(…, 6)`) NEVER fire in the owner's town, and my
first draft of H ("within 6") repeated the mistake. H's law: meat travels
by ROAD, town-wide (`hallReach` on the commute graph, MEAT_ROAD 60
walk-steps; a cart walker fetches the dead and the cubs); the rig gains
`--layout estate` and `meatprobe --save` takes a real exported city. §8
still asks: `RECORD_HARD` 3 → 2, the save compaction, a weaner age.
**2026-09-03, two more parts and a fixture coming:** *"adding the control
city is a good idea, i will build one for you soon, please add on that the
save button only lets you save the game once, a load save menu would be
better. i think we also need a GUI for selecting build items. a remote
control on the left side of the screen. 1 residential, 2 commercial, 3
industrial, 4 meat, 5 road, 6 wall, 7 rail, 8 train station, 9 tree, 10
park, 11 zoo, 12 pacification, 13 police, 14 fire. 15 inspect, 16
bulldoze. i think the other buttons can stay on the top"* → **P** the
palette (`js/tools.js` ONE tool table; `js/palette.js` 2 × 8 on the left
with sprite thumbnails; **the key law** — *"wasd should only be movement,
use your judgement on the rest"* → WASD pans and does nothing else anywhere
(the news reader loses WASD stepping); number row = positions 1–10 (`0` =
park); zoo Z · pacify V · police P · fire F · inspect I · bulldoze B;
density D → H; undo Z → Backspace/Ctrl+Z; S → the saves menu on L and
Ctrl+S; density and Use stay on top) · **S SHIPPED 2026-09-03** saves (`js/slots.js` named slots per
city, save-as / load / overwrite / delete / export in one menu on S, L and
the title; the autosave one slot; a full store shows the export box — a
refusal must not lose work). The control city → `docs/fixtures/
control-city.json`, the suite's first real-save regression and every
probe's `--save`. This section (the title-screen one below) said "a
save-as name field is not built" — S is that. And *"railroads and roads
should be able to cross over each other perpendicularly"* → **X** the
level crossing (plan §4-X): the commute graph ALREADY allows it (`dial`
walks any road tile, rides any rail tile, meets only at a station) — v1's
"no level crossings" is two refusals in `ops.js` and one draw line; the
rule is two straight runs on different axes, not on a wall/water/station,
a crossing stays straight, bulldoze takes the rail first; `art.crossing`.
The rail line below ("level crossings … the graph allows both ways") is X.
And *"citizens traveling on the rails should move 50% faster"* → X2:
measured first, a rider moves at ×3.07 a walker on the map today, so read
as ×4.5; WALK 10 → 9, RAIL_COST 3 → 2 (9/2 = 4.5 exactly), RIDE_SPEED
DERIVED = WALK/RAIL_COST so the eye and the Rules tab are one number; the
hash moves on rail towns only. Plan §8 q8 asks whether ×1.5 of walking was
meant instead. And *"road access should not be limited to one side of a
tile, as long as a tile is within 1-3 tiles of the road it has road
access"* → **R** (plan §4-R): the code ALREADY says so (`computeRoadDist`
= a BFS through any tile, any direction, ≤ ROAD_REACH 3; only a bare wall
blocks) — but `roadDist` is STALE between a road op and the next tick
(`ops.js:287` recomputes occlusion at once and leaves roadDist for the
tick; a paused city shows "no road within 3" beside a new road until
Space — probed). The owner: *"the 6x6 squares have roads around the whole
perimeter, so nothing is more than 3 tiles away"* — so the ruling lands on
the two rules that still want a TOUCHING road: a station is a door only
with a road touching it (`fields.js:492`) → within ROAD_REACH like a lot's
door; industry tier 3 only at roadDist ≤ 1 (`lots.js:110`) → anywhere with
access. Then *"i want that rule standardized, including rail and
warehouses, and zoos"* → ONE predicate `fields.served(world, i)` (the
nearest tile of the FOOTPRINT within ROAD_REACH 3; a zoo's four, a
landmark's nine) read by every rule that asks for a road — the plan's
§4-R table: zone growth, industry tier 3 ("warehouses" = the I tiers),
the station door (the walk layer links platform ↔ doorOf at WALK ×
dist), the zoo (jobs AND halo AND cap — today only jobs are gated, on the
anchor), the hall, the centre, cover; parks stay ungated and SAID; a suite
grep forbids any other road-nearness test in js/sim. And *"all sides have
access points"* → `doorsOf` = every road tile at the footprint's nearest
distance, any side; commutes start from ALL of a home's doors and end at
ANY of the job's (Dial is multi-source — free), so a citizen leaves by the
side its road goes and traffic redistributes round every block. Hash moves. R:
recompute at the op (hash-neutral, its own commit first), `served`, an
`access` overlay mode, the card's "road access: 2 tiles · door (x,y)",
`tools/accessprobe.mjs --save` on the control city. ROAD_REACH stays 3.

### The People file ownership (Part K; copied from plan §5)

| file | K | A | B | C | D | E | F | H |
|---|---|---|---|---|---|---|---|---|
| `js/sim/citizens.js` | `moodTerms`, `life: []` | `homeTerms` (one fn) | call-site one-liners | — | — | — | — | — |
| `js/sim/life.js` | API stub | — | **owns** | — | — | — | — | — |
| `js/sim/needs.js`, `voice.js` | — | **owns** | — | — | — | — | — | — |
| `js/sim/meat.js` | — | — | — | — | — | — | — | **owns** |
| `js/sim/story.js` | stub | — | — | — | — | — | **owns** | — |
| `js/sim/save.js` | tolerate `life`/`names`/`meat` | — | **owns** (compaction) | — | — | — | — | — |
| `js/sim/census.js` | `majority` | `needCensus` | — | (stretch: `notables`) | — | — | — | `meatSold`, `meatOnHand` |
| `js/sim/justice.js` | — | — | call-site one-liners | — | — | — | — | the two hall `post` sites |
| `js/sim/events.js` | — | — | call-site one-liners | — | — | — | REPORT lines (advisor fn) | — |
| `js/sim/tick.js` | resets + `storyTick` call | — | — | — | — | — | — | `meatTick` call |
| `js/sim/lots.js`, `fields.js`, `budget.js`, `rules.js` | — | — | — | — | — | `lotReport.mark` | — | M local term · dread scale · till · `MEAT_*` |
| `js/walkers.js` | `need`, `look` fields | **owns** | — | `attend()` | — | — | — | `hallLeg()` |
| `js/follow.js` | — | — | — | **owns** | — | — | — | — |
| `js/render.js` | — | `drawBubbles` | — | — | `paintPortrait` | building block | — | — |
| `js/input.js` | — | the cursor line | — | **owns** | — | — | — | — |
| `js/ui.js` | — | — | — | **owns** | — | — | — | the M card block |
| `js/main.js`, `css/` | — | — | — | **owns** | — | — | — | — |
| `js/news.js` | — | — | — | — | — | — | **owns** | — |
| `js/art/citizens.js` | — | — | — | — | **owns** | — | — | — |
| `js/art/bubbles.js` | — | **owns** | — | — | — | — | — | — |
| `js/art/buildings.js` | — | — | — | — | — | **owns** | — | — |
| `js/art/index.js` | reserve names | — | — | — | `look`, `portrait` | `mark` | — | — |
| `tools/check.mjs` | — | Part E' | Part F' | Part G' | Part C adds | Part C adds | Part H' | Part I' |
| `tools/shots.mjs` | — | bubbles sheet | — | — | looks, portraits | buildings, marks | — | — |
| `tools/*probe.mjs` | — | `peopleprobe` | `savesize` | — | — | — | `newsprobe` | `meatprobe` |
| `SPEC.md` | — | §14b | §7.10 | §11c | §12.3b | §12.2b | §11b | §9c |

The two UI parts, by file:

| file | P palette | S saves | who else is in the file |
|---|---|---|---|
| `js/tools.js`, `js/palette.js` | **owns** | — | — |
| `js/slots.js` | — | **owns** | — |
| `js/title.js` | — | **owns** | — |
| `index.html` | **owns** (layout) | — | — |
| `css/field.css` | the palette block | — | C (the card) |
| `js/ui.js` | `buildStrip` | `savesList` / `portBox` (737–785) | C (card, tabs), H (the M card block) |
| `js/input.js` | the key map reads `TOOLS` | — | C (pin), A (one cursor line) |
| `js/main.js` | resize lines | `app.save/load/resume`, the boot slot (155–200, 300–345) | C (camera) |
| `tools/check.mjs` | Part K' | Part J' | — |
| `SPEC.md` | §11 | §15 | — |

And X, the crossing: `js/sim/ops.js` (validation lines — nobody else),
`js/art/rail.js`, `art.crossing` in `index.js`, one ground line in
`render.js`, the rail sheet in `shots.mjs`, Part L', SPEC §7.9 / §12.4c.
And R, access: one call in `ops.js:287` (a different hunk from X's), the
`access` case in `render.js`'s `drawOverlay`, one line each in `lots.js`
`lotReport` and `ui.js` `cardForTile`, `tools/accessprobe.mjs`, Part M'.

Files touched by two parts are touched in DIFFERENT hunks (`render.js`,
`walkers.js`, `index.js`, `census.js`, `check.mjs`, `shots.mjs`,
`SPEC.md`); each part adds its own function/section and never edits
another's. Git merges those. `citizens.js`, `justice.js` and `events.js`
are the risk: B adds one-liners at call sites; A adds one function; H
edits two `post` sites; F edits one advisor function; D never opens them.

## Crime and punishment — SHIPPED 2026-09-02 (SPEC §9c; `js/sim/justice.js`); what is left
- **Hunger visibility.** The scripted towns run at U 0–4, so the ×20 hunger
  term only bites in dormitory / over-taxed towns (measured: one killing per
  ~7 years in a jobless town of 80). If the owner wants the hungry-wolf line
  in a healthy town, `KILL_HUNGRY` and the unemployment advisor are the knobs.
- **The wrongful 5% is rarely seen** at 4–9 arrests per 30 years (0–1 per
  run). `WRONGFUL_P` is the owner's number; the lever for visibility is the
  arrest volume (police cover, `ARREST_COVER`).
- **Customer walkers** to the hall (walkers.js `isShop` could include M);
  the meat hall's staff skinned by species; a "sold" departure walker.
- **The predation animation SHIPPED 2026-09-02** (SPEC §14: the sack falls,
  is tied, goes home over the shoulder). Left: the victim's OWN walker, if
  it had one, is released at its next tile centre while the figure at the
  door already stands — two of the same animal for under a second; the
  sack could be carried INTO the meat hall when the killer works there
  (today it goes home); no sound, no ticker flash at the moment of the
  drop (the KILLING line is the month's, not the second's).
- **Supply from funerals** as the hall's local term (Beastars: the market
  buys the dead) — the honest grey economy, v2.
- **The abattoir** — a 3×3 M landmark on the landmarks proposal's merge rule.
- **Per-species fixed counts** on the census histogram (`wolf 129 · 11 fixed`).
- **The scripted suite city loses its M row to a year-7 fire** (seed 7,
  disasters on); the dread invariant force-builds the halls on a clone
  instead — fine, but a firebreak in `buildCity` would let the row live.
- Measured and standing: the heist gate (a shop above 70) still never arms
  in a scripted town without two adjacent halls; P is cap-pinned, so the arc
  never shows in P — read killings, arrests, fixed, sold, littersLost, herbNear.

## Zoning, rail and walls — IN PROGRESS 2026-09-02 (`docs/PROPOSAL-ZONING-RAIL-WALLS.md`)
- Phase A walls SHIPPED (SPEC §6b): the reach law, the tunnel, the art.
  Left: a walls sheet in `tools/shots.mjs`; a wall's own ambient sound of
  nothing (a walled block is quiet — the mood does not know yet).
- Phase B use-zoning + trespass SHIPPED (SPEC §7.8, §9d). Left: the trespass
  zot (a commuter's card says it; the map does not); a "stopped" walker
  glyph; per-species stop counts.
- Phase C rail SHIPPED (SPEC §7.9). Left: rail bridges (a deck sprite with
  rails) and level crossings (a crossing sprite + the graph allows both ways
  on one tile); a two-car train walker on busy lines; a lone rail tile draws
  a bare pad (the wall draws its straight run — do the same).

## The title screen — SHIPPED 2026-09-02 (`js/title.js`; the owner's painting at `img/titlescreen.png`)
- Built: NEW GAME · CONTINUE · LOAD · SAVE · OPTIONS on the painting; `Esc`
  as the pause menu; OPTIONS = the cheat switch (a GIVE ME CASH button,
  each press an op under ledger key `cheat`, the owner's "good middle
  option") and per-city no-disasters. SAVE and LOAD now share the named-slots
  panel (save-as, load, overwrite, one-slot delete, export/import, one
  autosave and quota-recovery JSON).
- Left: no key-binding page; the painting has no credit line
  on the screen (the owner's — say who painted it if they want it said).

## The news — SHIPPED 2026-09-02 (SPEC §11b; `js/news.js`; 19 checks)
- Built at the owner's word (*"i'd like a news button, something where you can
  read the updates that pop up on the screen in a sequential order"*): the
  `R news` button with its unread count, the reader (whole feed oldest first,
  ← → steps a dispatch, four chips, mark all read), the News tab — was Log,
  now the same one feed read chronologically — the flash QUEUE, and the
  per-city read mark in `zoo.pref`.
- Fixed on the way, and it had been there since the Log tab was written:
  **every loaded city printed each yearly REPORT twice** — the advisor logs
  one, and `setWorld` synthesized a second out of `world.history` with a
  different net figure. The synthesis is gone; the log is the feed.
- **Measured reach (`node tools/newsprobe.mjs` — 4 seeds × 30 y, its own
  eight-block layout with a staffed meat market; handoff §13 has the table):** 74–84% of a city's dispatches NEVER popped up at all — only
  `TICKER_FLASH` lines do, and they are 16–26% of the log. That share is what
  the reader is for. The flash OVERWRITE it also fixed cost only about one
  headline per thirty city-years in a scripted town (max 2 in a month); look
  for it in a crime-heavy city, where the sentence table can put SOLD, TAKEN
  IN and CELLS in one month, not in a balanced one.
- Left: no search box and no "this year only" chip; a dispatch does not link
  to its tile, though the coordinates are already in the line (clicking
  KILLING could centre the map on (30,10)); the chosen chip is not remembered
  across opens; `mark all read` has no undo; no per-species filter.
- **Unverified by eye: the flash RUN's pacing.** A hidden browser pane
  throttles timers and then suspends them, so only the first two of a
  six-line run could be timed (2.0 s apart against the 1.5 s asked, and the
  run then stopped with the pane asleep). The SEQUENCING is verified
  synchronously and does not depend on the clock: the first line shows,
  labelled 1 of 6, where the old code showed the sixth. Note the run was
  HAND-MADE — see the measured-reach bullet above; a month of six does not
  occur in a scripted town. Watch a crime-heavy month with the pane in front
  before touching FLASH_RUN.
- **`FLASH_MAX 5` and the `+N more this month` tail have never fired in a real
  game**, and on the measured evidence may not in a balanced one. Correct code
  guarding a case the scripted town does not reach.
- **The `TICKER_*` regexes are hand-maintained and the suite cannot help.** A
  new event whose line starts with a word nobody added lands in the reader's
  "all" chip and nowhere else, silently — the trap session 3 hit when HEIST
  went unprinted. **And they are not purely prefix-anchored:** `TICKER_FLASH`'s
  last alternative, `ONE HUNDRED`, sits OUTSIDE the `^(...)` group and matches
  anywhere, which is the only reason the tortoise centenary flashes (its line
  starts with a citizen's name). A check now holds that exception open —
  anchoring it to tidy the regex fails the suite instead of killing the plaque
  line in silence. A per-event chip check is the real fix and is not built.
- **The read set is keyed by city NAME.** Two cities called `zoo` in one
  browser share their marks; an import renames to `<seed>-import` and starts a
  fresh set. The cheapest thing that works; revisit if saves grow real ids.
- **Cost, unmeasured:** the badge walks the whole feed on EVERY panel refresh
  whatever tab is open, taking an FNV of each row's text, and the tab rebuilds
  the feed too. Only the reader memoises. Far under the tick, but unprofiled.

## What a station buys, and the rubble clock — SHIPPED 2026-09-02 (SPEC §9b, §9c; handoff §15; `tools/serviceprobe.mjs`; 13 checks, all mutation-tested)
The owner: *"even if you have a ton of them the fires and crime are not
prevented and most go unsolved"* and *"the building plot [should] stay as
rubble for a period of time and then automatically become eligible"*. The fire
card now rolls at the town's own exposure (×1 uncovered, ×1/6 covered end to
end) instead of a flat weight; a covered lot that burns out is saved at 0.7 and
loses a storey; rubble counts itself down in the tile array; a burglary needs
no police station to happen; the file stains cap; the arrest roll carries a
FORCE term and is not made at all with no station in town; a burglary going
cold prints. **What is left:**
- **The quiet third door.** A file whose culprit dies or leaves town closes
  with no line and no counter (`justice.js`: `if (!culprit || culprit.dead)
  { f.closed = true; continue; }`). It is 24% of files at twelve stations —
  the real ceiling on the clear-up rate, and the player is never told.
- **`absent()` freezes an investigation.** A culprit in the cells, at the
  centre, or a bear asleep for the winter cannot be investigated for anything
  else. Deliberate, undocumented, and it costs three months a year in a
  bear town.
- **ARREST_FORCE caps at 4 stations.** Past that more stations buy cover, not
  detectives, so the clear-up rate flattens at ~56%. If "a ton of them" should
  reach 80%, the cap is the knob — but the ceiling above is the real limit.
- **A saved lot is not drawn differently.** SAVED prints a line; the tile
  shows a building one storey shorter and nothing else. A scorch overlay
  would make the fire station's work visible on the map, not just in the news.
- **Rubble is one clock for every cause.** A tornado's rubble and a fire's
  clear at the same rate. If a tornado's should linger, `toRubble` takes the
  argument.
- **RUBBLE_MONTHS 6 is not play-tested by a human.** It was chosen to be "a
  few months" and never felt.
- **Self-clearing rubble is fuel again.** A burnt block used to be a
  permanent firebreak; it now rebuilds. That is the intended trade, but it
  makes a fire station worth more than the numbers in §15 say, and nobody has
  measured how much more.

## The play camera — SHIPPED 2026-09-02 (`tools/play.mjs`, `tools/mayor.mjs`; handoff §15b; 7 checks)
`js/render.js` photographs the scripted mayor's town in Node. **What is left:**
- **It draws the map, not the UI.** `js/ui.js` (the panel, the hover card, the
  news reader) is untouched by it, so the rubble hover line — the one the owner
  will actually read — is still verified by source only.
- **No contact sheet.** `--film` writes N PNGs and you flip through them by
  hand; an animated GIF or a strip would be one file to look at.
- **`--follow city` is a centroid,** so a town that grows two ways is framed
  between them. A "follow the news" mode that tracks the last event would be
  better for a long run.
- **The shim has no rotate or skew** and throws if asked. `js/render.js` never
  asks; a future overlay might.
- **Nothing photographs the title screen** (`js/title.js` is DOM, not canvas).

## Polish the play-testers named (browser rounds 1–3), not yet done
- (the Log tab's newest-first order and its double REPORT line: fixed by the
  news reader, SPEC §11b)
- WHY NOT line should carry the tax parenthetical from SPEC §11
  ("demand −0.24 (R 12% vs neutral 8.2%)") and use the same rounded `local`
  as the score line (two sources today).
- A maxed tier-3 lot says "WHY NOT: —"; SPEC lists "capacity reached — build
  a park or a Zoo" for the CAPPED case only; decide whether a full lot
  should say "full".
- `.` faster while paused silently resumes; the pause button label does not
  change with state.
- A park placed up-left of a tower is hidden behind it (correct iso order);
  a hover-only cue is thin — consider a park glyph in the overlay or a
  minimap.
- A zoo costs §1,500/yr — warn on placement in a small town (net/yr goes
  negative at once).
- A loaded city always opens paused; players who reload a running ×3 game
  must press Space.
- Hover-card parts do not sum to the printed total (rounding).
- A walker on a bridge stands in the water: `roads.js` DECK_TOP (3 px) is
  applied by shots.mjs but not by render.js.
- `render.js` R_CHALK_TINT (m→q) and the repainted accent 5 (#B8C860) are
  two fixes for one fault; the R line uses grass keys, so one is redundant.

## L1 — cheap, visible, next
- **Road rot** (cash < 0 for 6 ticks → 5% of roads/tick to rubble) — the
  budget needs a bite besides receivership.
- **Owl academy** event + a 1×1 **school** civic (LV +10 within 4; children
  adults at 15 during it).
- **Wedding** (two adults of different species in one household befriend →
  procession walker). Needs the household merge rule: a move-in at 16 into a
  lot with another single household of a different species.
- **Buildings skinned by majority species** — a ramp swap on the box solid at
  compose time (`remapRamp` in palette.js exists); needs occupancy-change
  invalidation of the static layer.
- **Minimap** (the sibling Glades has one to port).
- **Pond removal** for a beaver dam (§40, beavers' mood −20 for a year) — the
  op exists in KNOBS.COST.pond but not in ops.js.
- (fire and police stations shipped 2026-09-02: `F` and `P` tools, crime field, heist; rebalanced the same day — see the section above)
- **Money tuning after real play**: re-measured 2026-09-02 after the crime
  rebalance — the scripted mayor (balanced, no civics, disasters off, seed 7)
  reaches **1,638 by y30 with §70.9k in hand**, down from 1,742 / §86.0k,
  because an unpoliced town is now burgled (−§2,440 over the run) where it
  used to be immune. That is the intended cost of having no police; a real
  player spends differently. Re-measure with the input log of an actual
  session before touching UPKEEP_*.

## L2 — bigger arcs
- **Elevation** — Glades of Arcadia's level machinery (`LEVEL_H`, cliffs,
  ramps); the box-solid buildings and BFS commutes both need to learn a z.
- **Shore autotile** (47-blob) — v1 draws a 1-px kerb where grass meets water.
- **128×128 maps** — the sim is O(tiles); the static-layer cache and the
  save size are the only costs.
- **Power** (plant + 4-tile radius, unpowered = score −0.5) — the classic
  third gate, deliberately absent from v1.
- **Station staffing as coverage** — today a station covers fully whether or
  not its four jobs are filled (weights, never gates); SC-style funding
  sliders are the L2 version.

## L3 — texture
- Sound (the Impressions register is half walla).
- Per-species idle poses; 4-frame walks.
- Scenarios (Dullsville: dig a city out of receivership; Beaverton: a river
  city that must live with dams).
- Friends met on the road: record walker crossings, resolve once a month by
  rule (never by frame).

## Measured, not yet acted on
- H (cross-species friendship share) sits at ~0.7 in every balanced city —
  it is a diversity dividend (+35% cap), not a lever a mixed city can pull
  further. A monoculture drops it to ~0. If it should discriminate MORE,
  the candidate is H relative to the random-mixing expectation.
- Species shares settle near bear/beaver/owl ~20% each in the scripted
  mayor's towns because it never builds parks (rabbits) or tier-3 vacancies
  (mice). Real play will differ; re-measure.
