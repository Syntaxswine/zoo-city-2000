# BACKLOG — Zoo City 2000

Open work, ranked. The design record is `SPEC.md`; the numbers are in
`js/sim/rules.js` (KNOBS). Later layers were labelled at design time so v1
could ship whole.

## The People — IN PROGRESS 2026-09-03 (`docs/PLAN-THE-PEOPLE-2026-09-02.md`); Parts K, A, C, D, F, H, P and S shipped

**Part F SHIPPED 2026-09-03:** the paper now selects permanent-id people
stories from the monthly biography bus: one obituary after three mourners,
true declared litters without double-counting the two parent witnesses, and
one centenary writer. The fifth People chip exposes saved `who` links; a name
marks its row read, pins the living or archived citizen, centres their home
and opens the card/epitaph. January REPORTs recompute and name the current
oldest resident and largest household after removals. Existing named
crime/meat rows carry separate link ids, so their citizens are clickable
without misclassifying operational dispatches as People stories. A generated roster
registry prevents unclassified event prefixes; ordinary stories stay quiet
and only `OBITUARY 100 —` flashes. Four 30-year probe towns spend 5.6–15.4%
of rows on people with 0 dangling/lost ids. The year-30 hash moves only in
news (`stateHashNoNews` remains `7efe937b`); 428 canonical checks pass.

**Part P SHIPPED 2026-09-03:** the sixteen build tools now live in one
DOM-free registry and one 2×8 sprite palette left of the map (4×4 below 720
px high); the top strip keeps modifiers and commands. The number row follows
the owner's order, WASD is movement only, density is H, undo is
Backspace/Ctrl+Z and save-as is Ctrl+S. Palette clicks, shortcuts, live costs,
active/ARIA state and generated footer help all consume the same registry.
Focused controls and the news reader own their keys, preventing double actions
or stacked save/news screens. Renderer resize/pick, all sixteen nonblank
thumbnails, input conflicts and hash neutrality are covered by 410 canonical
checks. SPEC §11.

**Part C SHIPPED 2026-09-03:** Inspect now pins a permanent citizen id rather
than a walker. The card survives the end of a walk, reports home/custody/bear
winter truthfully, and becomes a last-home epitaph after death or departure;
portraits, exact actionable wants/remedies, the retained life chapters, linked
friends and linked household rosters make it the citizen surface. Canvas talk
bubbles remain pop-outs by the walkers. Every former citizen now has one
versioned shorthand record forever: seed 7 at year 30 stores 1,653 records in
70,103 bytes (42.41 bytes each), and a 10,000-person archive is 482 KB JSON and
builds in ~30 ms. Old object graveyards migrate once. SPEC §§7.10, 11c;
`tools/savesize.mjs`; 391 canonical checks pass after the level-crossing merge.

**Part H SHIPPED 2026-09-03:** halls now hold conserved stock from dead
bought at the door, killings, convicted sales and livestock raised to
sixteen, with carnivore meals out, explicit spoilage and a hard 40-unit cap.
H carts and sacks traverse a real road/station/rail path, but all rail and
transfer edges count as zero reach; citizen commutes price a ride at 2/9
(0.22) of a walk after X2; property/amenity/smell distance stays geographic.
The card, Census, Rules
M4–M6 and news expose it. Exact stored RIDE paths drive the visible handcart,
cub companion, pen and sack-to-hall walkers. `--layout estate` reserves exactly
two hall lots, 6×6 interiors and ≥37 physical tiles R→M; four 15-year seeds build
  both halls and conserve stock plus pen custody exactly,
  end at 4–18 units and sell 3.8–4.7 units/hall-year. SPEC §9c;
  `tools/meatprobe.mjs`; 339 canonical checks and `sheet-meat.png` pass.

**Part D SHIPPED 2026-09-03:** every citizen id now hashes to one of four
stable appearances, with a darker coat bit and one ≤6×6 species motif; cubs
keep motifs off their bodies and use a four-way coat-only treatment. The same
look follows walkers, tents, picking, carried sacks and predation victims.
Every species also has a cached 16×16 bust in three readable expressions,
half of elders wear glasses, and a fourth anchored frame animates after a
walker stands for a second. The 3,236-entry art audit includes 504 portraits
and H's twelve handcart poses;
293 checks and both independent PNG critics pass. SPEC §12.3b.

**Part A SHIPPED 2026-09-03:** Inspect now makes the nearest eight walking
citizens say one actionable need from the simulation's own mood, home, lot,
demand and tax rules. The walker carries only a stable code; `voice.js`
supplies the short line and remedy, `world.last.needs` supplies the exact
town histogram for Part C's card/Census views, and the final render pass keeps
bubbles at 10 screen pixels at either zoom. The focused truth table covers all
24 codes; six declared, coherent 1,300-resident stress municipalities replace
the final six monthly samples of one run so the 360-city-year stream covers
all 24 too, while balanced (`NO_PARK`), dormitory (`NO_JOB`) and millbelt
(`SMOKE`) towns keep distinct leaders. SPEC §14b; handoff §21.

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
`world.majority`, `world.meat`, the shipped `storyTick` bridge, reserved art names —
lands FIRST, ½ session) then **A** needs (under the Inspect tool, the
animals near the cursor say what they want — every line is a sim term that
hurts, with the remedy under it on the card; the Census gains "what the
town wants") · **H** meat on hand (`world.meat` per hall; inflows = the
killing's sack walks INTO the hall, the hall BUYS the town's ~24 natural
deaths a year, SOLD as ruled; outflow = carnivores eat; measured first:
11 halls made §38.9k of cut with 4 killings and 2 sold in 30 y — meat is
not a quantity today) · **B** lives (a 12-entry ring per living citizen + a
permanent shorthand record after removal; save compaction pays for it) ·
**C** Inspect extended (SHIPPED: the pin is a CITIZEN; follow/star remains a
stretch) · **D** looks and faces (4 looks per
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
by ROAD and RAIL, town-wide (`hallReach` on the commute graph, MEAT_ROAD 60
walk-steps; rail and transfers cost zero for H only; a cart walker fetches
the dead and the cubs); the rig gains
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
should be able to cross over each other perpendicularly"* → **X SHIPPED
2026-09-03** the level crossing (its own section below; SPEC §7.9, §12.4c;
26 checks; the three playtest gates byte-identical). **X2 SHIPPED
2026-09-04:** *"citizens traveling on the rails should move 50% faster"*
lands as a 50% increase over the former ×3: `WALK` 9, `RAIL_COST` 2 and
derived `RIDE_SPEED = WALK / RAIL_COST = 4.5`. Commute scoring and the eye
now share one law; a large frame is re-priced at every walk/rail boundary.
Against its Part R parent, the rail-less 30-year gate stays `8707f655`; H
freight still uses zero-cost rail and property distance stays geographic.
And *"road access should not be limited to one side of a
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

## Road access, standardized — SHIPPED 2026-09-04 (plan §4-R; SPEC §6c, §5, §7.9, §9b, §11; handoff §24–§24g; `tools/accessprobe.mjs`; the suite went 428 → 523 across FIVE hostile reviews, 6 → 6.5 → 6.5 → 7 → 7)

The owner: *"as long as a tile is within 1-3 tiles of the road it has road
access"*, *"the 6x6 squares have roads around the whole perimeter, so nothing
is more than 3 tiles away"*, *"i want that rule standardized, including rail
and warehouses, and zoos"*, and *"the other way to think about it is that all
sides have access points."*

One predicate now, `fields.served`, asked of the whole FOOTPRINT
(`world.siteTiles`: a block's tiles, a zoo's four, or the tile itself).
`hasAccess` is gone from the tree, and no module in `js/sim` outside
`fields.js` tests a road's nearness for itself — a check greps for a second
one and the mutation sweep proves the first. Doors are every road tile at
the site's distance, so all sides are access points: `dial` takes a list of
sources, `commutePath` a list at each end, and a citizen leaves by whichever
side its work is on. A station is served like a lot (three tiles is near
enough), and the forecourt between platform and door is laid into the stored
path tile by tile, so it is walked, priced and drawn as the walk it is.
SC2000's industrial frontage rule (`roadDist <= 1` for tier 3) is deleted.
An unserved zoo loses its jobs, its halo and its place on the cap together.

**The gates, reproducible.** Measured on `46770c0` against the parent
`411d903` (which carries Parts F and P but not R). The hashes an earlier
commit message quoted were taken on a DIFFERENT parent, before the rebase,
and are not reproducible from anything on `main`; these are.

| command (all with `--years 30 --quiet`) | 411d903 | Part R |
|---|---|---|
| `node tools/playtest.mjs --layout balanced` | `771239e1` | `8707f655` |
| `node tools/playtest.mjs --layout dormitory` | `27376829` | `f86913c3` |
| `node tools/playtest.mjs --layout millbelt` | `10a8a697` | `a20db622` |
| `node tools/playtest.mjs --layout estate` | `e48a4e21` | `df5631eb` |
| `node tools/playtest.mjs --layout balanced --stations --zoo 12` | `8ee1a3dc` | `aaac75f4` |
| `node tools/playtest.mjs --layout estate --zoo 12` | `7a719fce` | `418c5b2c` |

Every one moves, on purpose, and the balanced gate moves for the same three
reasons as the rest: commutes redistribute over the doors a lot now has, the
industrial frontage rule is gone so works stand taller (and smoke more), and
a merge re-plans the people on it. Not a regression: over four seeds × two
layouts at year 30, mean population 1692 → 1645 (−2.8%, and the SIGN varies by
seed: −11% on balanced 11, +3% on millbelt 5), mean approval 61 → 64, mean
pollution 13.0 → 12.1, mean land value 38.1 → 38.6.

R1 — recomputing the road field AT THE OP — was proved hash-neutral on its
own, the way the plan asked, and not merely argued: applied alone to
`411d903` in a scratch worktree, the four 30-year gates come back
byte-identical (`771239e1` balanced, `27376829` dormitory, `10a8a697`
millbelt, `e48a4e21` estate) and the suite passes 428/0. Everything else in
this part moves the hash on purpose.

Measured (`tools/accessprobe.mjs --layout millbelt`, seed 7, 30 years):
**37% of zoned lots can be left by more than one side** (mean 1.42 doors),
and **11 industrial lots stand at tier 3 that the frontage rule capped at 2**.
Every gate hash moved and each is recorded in the commit.

Two defects the standard turned up on its way in:
- **A merge or a split changes a building's doors, and nothing re-planned.**
  A straight run kept a legal older path while a reload computed the new one
  — §15's save/load law caught it. `blocks.replanOn` marks everyone living or
  working on the footprint stale, exactly as `placeHousehold` was fixed to.
- **The scripted mayor built an unreachable zoo.** `--layout estate --zoo 12`
  put it at (26,0), five tiles from the nearest road, where it had been
  paying a +500 cap and a land-value halo for a place no animal could enter.
  The mayor now takes the first free 2×2 a road REACHES; a rig that cannot
  build a working zoo cannot measure one.

## OPEN — a save taken in the SAME MONTH as an op reloads to a different city (PRE-EXISTING, found 2026-09-04)

Not Part R's, and older than it: measured on `411d903`, before any of this
work. `invalidatePaths` nulls every commute; a reload's `rebuildDerived`
rebuilds them all. So between an op and the next tick the two disagree, and
the first tick after the load computes traffic from real paths where the
straight run computes it from none - pollution, land value and everything
downstream follow.

```
town: 200 citizens
  save IMMEDIATELY after a road edit: DIVERGED at month +1
  save one month after the road edit: holds for 12 months
```

Reachable in play, because the autosave is not only the 12-tick one: `main.js`
also autosaves on `pagehide` and on `visibilitychange`, at whatever moment the
player switches tab or closes it. Lay a road, switch tab, come back tomorrow,
and the city is a hair different from the one you left. Small, and real.

Three ways out, none of them Part R's to choose: re-plan eagerly inside
`invalidatePaths` (costs a full commute pass per road edit, and moves WHEN a
job is lost, which is a rule change); make `save` refuse to serialise while
paths are stale (it would have to tick or wait); or accept it and say so in
SPEC §15. The suite's own convention is already the third - every save/load
check ticks before it saves - so today the law is really "hash-equal from any
TICK boundary", and §15 does not say that.

**And that workaround was itself false for one commit.** At `4b9b6d0` a settle
placed after `citizensTick` left the tick BOUNDARY stale too, so "hash-equal
from any tick boundary" was untrue as well — a fourth hostile review caught it
(`ff0656b1` vs `4a6abbbb`, no op anywhere near). Fixed by `settleDoors` calling
`citizens.replanStale`: **nothing may end a tick stale.** The op-time hole
above is still open and still a rule call, but the boundary claim is true
again, and there is now a named function (`replanStale`) that the first of the
three ways out would be built from.

## The second hostile review — all thirteen, closed (2026-09-04)

A second adversarial reader scored the access work **6.5/10** against
`ea014d5`, ran 49 mutants of its own and found ten survivors. Every finding is
below with what closed it. The suite went **483 → 489 checks**, and a sweep of
20 mutants aimed at exactly these lines catches all 20 (the sweep is
`scratchpad/msweep`; it runs the unmutated seed first and refuses to report
until that is green — a first draft copied only `js/ tools/ docs/`, `check.mjs`
reads `css/` two thirds of the way through, and twelve mutants came back
"CAUGHT" by an ENOENT).

1. **THE SAVE/LOAD LAW BROKE.** `fields.passable` reads `tier` and `civic`,
   and nothing invalidated paths when those changed: a building GROWN across a
   station's forecourt, or a civic dropped on one, closed a way stored
   commutes were already walking. Reproduced two ways, each diverging a month
   after a reload; `c.path` is not in `canonicalCitizen`, so the hash hid it
   for 24 months first. **Fixed** in `bb175ad`: `computeStationDoors` keeps a
   signature of the whole door graph and raises `world.doorsMoved`;
   `tick.js`'s `settleDoors` acts on it right after `lotsTick` (before the
   citizens run) and `ops.apply` after every op. Both reproductions are checks,
   on a rig where riding is NECESSARY (two road systems that never touch, one
   line across): 317 commutes crossed the forecourt, 0 left walking through a
   police station.
2. **`computeStationDoors` without its `passable` gate**, 3. **`links.fill(undefined)`**,
   6. **only the first door linked** — one check now asks the flagship
   sentence: the doors the card lists (`doorsOf`) and the edges the graph
   rides (`world._stationDoors`) are THE SAME LIST, in the same order, asked of
   every platform after a build, after two years of ticks, after a reload and
   after an op on a forecourt. Plus the consequence: two identical lines, one
   with its north end behind a river, and the rabbit crossing the city walks to
   the far one rather than boarding the near one it cannot reach.
4. **The civic clause of `passable`**, 10. **the "dead" bridge clause** — both
   already pinned by the rulings table `572b5d2` added after the review was
   taken, and both die today. The bridge clause is NOT dead and is now
   documented as a ruling rather than a branch: `doorSearch` answers a road
   before it asks, but `passable` is exported and read as "ground a citizen may
   stand on", and a predicate that called a bridge open water would be wrong
   the first time anything else asked. Two rulings the review called omissions
   are decisions now: plain track and a platform are walkable — a citizen steps
   over a line the way it crosses a level crossing.
5. **The doors sort.** There were two sorts; the `d = 0` one could not be made
   to fail, because `siteTiles` comes back in raster order today, so a site
   standing on several roads already listed them ascending. ONE sort now, at
   the one exit both returns go through, and a fixture whose platform is
   entered from EAST and WEST — discovered east-then-west, so the order is
   load-bearing. The town canary was the other half: a band of 250–560 round a
   town of 385 could not see a 10% move. It is 365–405 now (±5%), and
   re-baselining it is a deliberate act with a number in the commit message.
7. **`joinable` / `troubled` no longer ask `served`.** Two PAIRS, asked of
   `blocks.mergeWindow` directly (going through `lotScore` would watch the
   wrong door shut): the same four tier-3 houses at the same 74% full, refused
   when the far corner is four tiles from the only road and joined when one
   more road tile makes it three — and refused again when it is the corner that
   is near and the ANCHOR that is out of reach.
8. **A guard that could not be false, and a false sentence in SPEC.**
   `NEAR_REACH` was a module-load constant, so at `ROAD_REACH` 9 the card
   looked LESS far than the rule while SPEC §6c claimed everything moved with
   it; and the check restored the knob before reading it, evaluating `8 > 3`.
   It is `nearReach()`, a function, read at call time; the check reads the
   horizon INSIDE the moved window, at 5 and at 9.
9. **The card overstated the forecourt by one tile** — it printed `siteDist`
   where the forecourt is `siteDist - 1` (at `d = 1` the door is next door and
   nothing is crossed). Fixed, and pinned by a check that reads the card's own
   words through the DOM shim and compares them with the link chain the commute
   actually carries.
11. **`walkers.door()` asked a different question from `doorsOf`** for a
    platform. It calls `doorsOf` now, which carries `accessOpts` with it — one
    implementation, in the one place Law 6 is loudest.
12. **`render.js` wrote a world-owned buffer.** `doorsOf`, `doorOf`,
    `nearestRoad` and `siteRoadDist` all take an optional caller-owned `seen`;
    the draw layer owns one (SPEC §14), and a check stamps `world._seen`, draws
    the whole-map access pass over it, and demands the stamp survive AND the
    frame still be a frame.
13. Smalls: the unserved platform's card says the refusal once (the access line
    gives the distance and the direction, the station line gives the
    consequence); `accessprobe`'s header describes the rig it actually builds
    (quarters seven rows deep with an avenue on one side, not 8×8 roaded on
    two); `fields.doorOf` is documented as the single-tile reader the TOOLS
    use, which is what it is.

Found SOUND by the same reader, with evidence: the save/load law holds
everywhere ELSE it could be pushed; the rendered-pixel overlay checks are
real; 39 of their 49 mutants were caught; every published number reproduces
exactly.

Cost was found sound too, but the figures were quoted from an unnamed rig and
a THIRD reviewer measured 2–4× them on their own. **A number names its rig**,
so the measurement lives in the repo now — `tools/accessprobe.mjs --cost`
times the two hot paths and prints the town it timed them on:

| rig (`node tools/accessprobe.mjs …`) | platforms | `computeStationDoors` | `siteRoadDist` over all 4,096 tiles |
|---|---|---|---|
| `--layout millbelt --seed 7 --years 30 --cost` | 0 | 0.018 ms | 0.222 ms |
| `--rig deep --cost` | 2 | 0.039 ms | 0.180 ms |
| `--rig many --cost` (a worst case, not a town) | 56 | 0.098 ms | 0.132 ms |

The second column is per tick and per op; the third is an upper bound on the
access overlay's per-frame work minus the drawing (it asks every tile on the
map; the renderer asks only the visible ones). 0.1 ms against a 16 ms frame.
Cost is a non-issue — but it is a non-issue with a rig beside it now.

**What the sweep taught that the review did not.** The check for finding 1's
op-time half had a `tick()` between the op and the measurement — added for an
unrelated reason (the same-month-save hole below) — and the tick settles the
doors itself. So the check was watching the wrong half of its own fix: deleting
the op-time settle left it green with 317 animals walking through a police
station. The measurement is taken before the tick now. **A line added for one
reason can take the teeth out of a check written for another.**

## The FIFTH hostile review — the fix was still the size of the example (2026-09-04)

A fifth adversarial reader scored `c90574b` **7/10** and found that round
four's law was still not the law. 93 mutants of their own: 74 died by a named
check, 16 survived, seven of those provably not equivalent.

1. **"NOTHING MAY END A TICK STALE" WAS STILL FALSE.** Round four put
   `replanStale` inside `settleDoors`, which only runs its body when the DOOR
   GRAPH moved — and `c.stale` is written in three places, only one of which is
   about doors. The reachable one: `eventsTick` razes a home at step 7,
   `evictFromLot` rehomes the family, `placeHousehold` marks every one of them
   stale, and `citizensTick` — the pass that repairs a stale commute — ran two
   steps earlier. Measured on a balanced town whose only event was one fire and
   **no op at all**: 53 employed animals ending the month with no commute,
   traffic 12495 against 13261, `9324161b` against `9e3e5077` at month +1. What
   diverges is **mood**, which is saved and drives departures and approval.
   Fixed by moving the re-plan OUT of the flag: `replanStale(world)` runs
   unconditionally at the end of every tick, after everything that can mark an
   animal stale. (It reproduces at `411d903` too, so it is not a regression
   Part R caused — but Part R is what claimed the law.)
2. **The instrument the law never had.** Every boundary of a real town with the
   WEATHER ON, asserting that no animal with a home and a job is carrying no
   commute and none is left flagged — plus the case forced, because a canary
   waits for weather: burn down the fullest house in the city and check the
   same thing. That is the check that would have caught every version of this
   across five reviews.
3. **Every published gate for this part runs with the weather off.**
   `tools/mayor.mjs` defaults `disasters` false, so all six gate hashes, the
   regression table and every `accessprobe --layout` figure are measured on
   towns where nothing ever burns — i.e. with the whole `eventsTick` half of
   this part switched off. Round four found thirteen fixtures doing it and
   fixed the deep rig; the mayor's own default, one level up, went unnoticed.
   The new instrument runs on a town with weather; the gates stay as they are,
   deliberately, as a controlled baseline — but they cannot see this class of
   bug and that is now written down rather than assumed.
4. **The card printed a false sentence one ring out from where round three
   fixed it.** The middle refusal is guarded on `rep.roadDist <= ROAD_REACH`,
   and `computeRoadDist` CLAMPS that field at `ROAD_REACH + 1` — so a road four
   to eight tiles off that nothing can walk to fell through to "no road within
   8 tiles in any direction", which was false. The horizon line now says what
   it means: *no road within N tiles **that anything could walk to***. Also not
   platform-only, as SPEC claimed: a lot behind a bare wall does it too.
5. **The Rules tab told the player the rule wrongly.** G1 said `served ⇔ min
   roadDist over the FOOTPRINT ≤ 3 (BFS through any tile)` — both halves false
   for a platform, whose access is a search over ground it can stand on. SPEC's
   own heading two sections up is "Two questions, not one".
6. **Five more live rules with nothing behind them**, each now a check: the
   player's line releasing animals ALREADY in work (178 kept forbidden jobs on
   a real town with the suite green); the home-and-job half of the trespass; a
   RAIL tunnel carrying reach through a wall; a zoo paying its keepers once
   rather than four times; and the card's door ORDER.
7. **The `4b` settle survived mutation and BACKLOG said it could not.** Its
   only consequence is timing — an animal whose route closed this month is
   released before the job search rather than after — worth 40 animals over 60
   months on one fixture and two in the month itself: too small and too
   seed-fragile to assert without pinning a golden number. So the ORDER of the
   three settles is held structurally, the number is written beside it, and the
   false "every mutant on both tick settles dies by a named check" is gone.
8. Smalls: the save/load law is **§15**, not §16 (17 mis-citations across four
   files, corrected); §16's `fields.js` contract block re-asserted the frozen
   `reach = 8` round three removed; `meat.js`'s hall-door sort cannot currently
   reorder anything and says so instead of looking load-bearing; `save.js` had
   a `computeFields` that `refreshLast` repeats two lines later; and SPEC now
   admits the overlay iterates its bounding box rather than the visible tiles,
   and that `js/ui.js` is a second reader of the raw field that DECIDES with it.

**The sweep after all of that**: 44 mutants aimed at these lines — **41 caught
by a NAMED check**, and the only three survivors are the documented equivalents
(the unreachable `d === 0` guard, `computeRoadDist`'s extra ring, `lotReport`'s
eager `nearest`). Two more fell out of it and are fixed here rather than left:
the card's HORIZON NUMBER had no check (a mutant printing 9 instead of 8 lived,
so the third refusal now asserts `nearReach()` by name), and **`settleDoors`'s
own `replanStale` was redundant once the boundary call existed** —
`citizensTick`'s stale pass already covers anything invalidated before it, and
the end-of-tick call covers everything after, so the line repaired nothing and
a mutant deleting it lived. It is gone. One implementation of "when a stale
commute is rebuilt": the citizens' own pass, and the boundary.

**Found SOUND by the fifth reader** — do not re-verify: both path laws hold on
every stored commute in four layouts with disasters on (0 non-adjacent steps, 0
unwalkable tiles, out of 1120 / 573 / 1014 / 17 paths); input-log replay is
exact with rail, a station, a civic on a forecourt, an undo and a repaint in
the log; a save written at `411d903` loads at HEAD with the same hash and holds
24 months; the cost table and every `accessprobe` number reproduce; no access
claim leaks into the news or story modules; Law 6 and §14 hold; and the whole
core dies under mutation by NAMED checks.

## The FOURTH hostile review — my own fix was the new bug (2026-09-04)

A fourth adversarial reader scored `4b9b6d0` **7/10** (up from 6, 6.5, 6.5) and
found that **the settle added for the third review's finding 2 was itself a
§15 break**. 92 mutants of their own: 71 died by a named check, 17 survived.

1. **NOTHING MAY END A TICK STALE.** `settleDoors` runs three times, and the
   third runs AFTER `citizensTick` — so its `invalidatePaths` had no stale pass
   coming, and the month ended with every commute null. Next month the straight
   run took traffic, riders and mean commute from NOTHING while a reload took
   them from everything (`save.rebuildDerived` re-plans unconditionally); §15's
   hash at the boundary is equal either way, because `c.path` is not in
   `canonicalCitizen`, so the two cities parted a month later. Measured on this
   part's own rig with **no op at all** and a save at a clean TICK BOUNDARY:
   traffic 0 against 3796, `ff0656b1` against `4a6abbbb` at 24 months. Fixed:
   `citizens.replanStale` is a function now, and `settleDoors` calls it. The
   check burns a house off a forecourt and demands the month still end with
   every commute planned and the same traffic counted next month.
2. **The fifth check that cannot fail, and it was structural.** Thirteen
   `noDisasters = true` across the access fixtures — including
   `accessprobe --rig deep`, the rig that exists *because the mayor cannot
   build a forecourt*, with the only thing that moves one after the settle
   switched off. And the one fixture that did light a fire had **zero
   citizens**, so "the doors settle in the same month" was asserted about the
   graph and never about a stored path. `deepRig` runs with weather now.
3. **Three rows of SPEC §6c's own table were spelling, not behaviour** — fire
   and police cover, the Butchers' licence, and the carts' every-side rule all
   survived a mutant. One check now runs the whole table as a PAIR: a zoo, a
   centre, a police and a fire station and a tier-2 hall, all out of reach —
   no jobs, no cover, no van shadow, no licence — then one road, and all five
   arrive. Plus a cart from the west arriving at the west door and one from the
   east at the east door, for the same money.
4. **Two behaviour bugs in the standard itself, both fixed.** The census
   counted jobs at sites nobody could reach, so a zoo no road reached moved the
   C and I valves exactly as a working one did (SPEC says the predicate gates
   "jobs, the LV halo and the census the cap reads — one predicate, three
   effects"; it was two). And an unreachable pacification centre kept its van's
   land-value shadow while the zoo's halo was gated. **Both are hash-neutral on
   all six published gates** — the mayor's towns have no unreachable sites.
5. **A wall clock inside a determinism suite is a trap, and it caught us.**
   `check("tick cost", ms < 30)` fails under CPU contention, `check.mjs` exits
   1, and a parallel MUTATION SWEEP reads that as "caught". The reviewer re-ran
   every low-failure mutant at four lanes instead of fourteen and moved **eight
   verdicts from CAUGHT back to SURVIVED**. Both timing gates are now bounds no
   contention can reach (250 ms against ~10; 25 ms against ~0.17) with the
   printed number as the instrument — and earlier sweep claims in this file
   were made under the old gate, so treat their counts as upper bounds.
6. **`§15` had never been asked of a town with the PLAYER'S LINE painted** —
   two mutants lived there (`ops.apply`'s `else if (lines) invalidatePaths` and
   `save.js`'s species-weighted reload), each worth 135–218 differing paths and
   a divergence at month +1. Now checked on a 346-animal town.
7. **A riding step is neutral travel** — SPEC §7.9, §9c, the README and the
   Rules tab all say the trespass counts walking tiles only, and deleting the
   ride test in `exposure` left the suite green. Checked with a real rider.
8. Smaller: the freight cache is reset at the op (checked by razing the only
   hall and asking again); `served` takes a caller-owned buffer like the other
   four readers; SPEC says four settle sites, not three, and says which one
   never fires; the traffic comment admits it counts forecourt tiles too;
   `--rig many` says what it builds (56 platforms, not the 357 the map would
   hold); and the README's deep-rig numbers are re-measured at HEAD — they had
   moved with the rail knobs in `341baf8` underneath.

**The sweep after all of that**: 36 mutants aimed at exactly these lines, run
at six lanes on the fixed timing gates — **33 caught by a NAMED check**, and
the only three survivors are the documented equivalents below (the unreachable
`d === 0` guard, `computeRoadDist`'s extra ring, `lotReport`'s eager
`nearest`). Two of the 33 needed their checks sharpened after the sweep: the
freight-cache one had razed a HALL, which resets the cache through
`meat.closeHall` and so watched the wrong reset (it takes the road under a
door now), and `served` had gained a caller-owned buffer with nothing asking
it for one.

**Found SOUND by the fourth reader** — do not re-verify: all six gate hashes
reproduce byte-for-byte; the whole `--cost` table reproduces on an idle
machine; `accessprobe --layout millbelt` reproduces exactly; Law 6 holds
behaviourally; §14 holds for `render.js`; the core is mutation-proof (every
mutant on `passable`, `doorSearch`, the signature, `nodePath`, `dial`, the 7c
settle and the end-of-tick re-plan, the ops settles, the undo settle, the
merge/split re-plans, `footprintOf`, `zooTiles`, the job index, all four
overlay mutants and the card's refusals dies by a NAMED check). **The `4b`
settle is the exception, and it is held structurally** — the fifth review
pulled that sentence for saying "both tick settles"; see its finding 7.

## The THIRD hostile review — the same bug one level down (2026-09-04)

A third adversarial reader scored `46e16e5` **6.5/10** and was right to. The
headline of the previous two commits — *"the ground under a forecourt MOVES,
and a move is a re-plan"* — was **still false**, one level below where it was
patched.

1. **The signature hashed the door SET, not the forecourt CHAIN.** A civic or
   a building that REROUTES a forecourt without taking a door away moves every
   tile a citizen walks and raised nothing. Reproduced on this part's own
   flagship fixture with this part's own op — a police station on the tile both
   of a platform's doors were reached through, both doors surviving because the
   platform is entered from either side — **99 commutes left walking through
   it**, and §15 broken a month after a tick-boundary save (`86db0002` vs
   `375be68d`) with no op at all. **The check written for exactly this claim
   performed the counterexample and asserted past it**: it compared door lists
   and never looked at the chains. Fixed: the signature is `platform > door :
   chain` per edge, and there is now a transition table (a door taken, a door
   opened, the last station gone, the first station back, a forecourt rerouted
   under an unchanged door — and three rows where nothing changes and it says
   so).
2. **A fire razes at step 7, three steps after the settle at 4b.** The card and
   the graph disagreed for a whole month after every fire, and everything below
   that line (meat carts, a killer's walk) planned over a stale graph.
   `tick.js` settles after `eventsTick` too now. (`events.js` had imported
   `invalidatePaths` and never called it since long before this part; the
   import is gone.)
3. **The game printed a false sentence to the player, contradicted by the same
   card.** A platform with a road two tiles away across an uncrossable river
   read *"no road within 8 tiles in any direction"* one line above *"road 2"* —
   because `nearestRoad` asks a platform the WALKING question and the fall
   through printed a search LIMIT as a measurement. There are three refusals
   now, each true of a different thing (SPEC §6c), and the middle one is
   checked through the DOM shim on a river that cannot be walked round. The
   old fixture's river had a way round at exactly 8, so the false branch was
   never entered: the easy case cannot test.
4. **A false number in a check's own name.** *"six sim modules import
   `served`"*, asserted as `>= 5`. It is five, and they are named now
   (blocks, census, events, justice, lots) — an exact list fails in both
   directions.
5. **A README number quoted beside a command that does not give it.** `--rig
   deep` defaults to 30 years; the published 12 commutes / 48 tiles was
   measured at 20. It is 20 / 80 at the default, and both are stated.
6. **Cost figures with no rig.** See the table above — `--cost` and `--rig
   many` are in `accessprobe` now, so the number and the town it was measured
   on travel together.
7. **Dead lines.** `save.js`'s `doorsMoved` reset could never fire (a loaded
   world has no previous signature by design); `events.js`'s unused import;
   and `computeStationDoors`'s `d === 0` guard, which is unreachable *because
   ops refuses a road on a platform and a station on a road* — a claim about
   ops, now tested in ops.
8. **§14 was held for the overlay and not for the readers.** `doorsOf` and
   `nearestRoad` take a caller-owned scratch and nothing made them use it.
9. **Nine more surviving mutants**, each now with a check: both of a
   platform's doors are EDGES and not merely listed (paint one predator-only
   and the rabbit boards from the other for the fox's price); an undo restores
   the graph at the op; a merge re-plans the people who WORK there; the card
   lists every door of a two-sided lot; the census counts what the rule
   refuses; the N,E,S,W tie-break decides which forecourt tiles are walked.

**Found SOUND by the third reader, with evidence** — do not re-verify: all 20
of the second review's mutants die by a NAMED check; every published gate hash
reproduces byte-for-byte (`8707f655` balanced · `f86913c3` dormitory ·
`a20db622` millbelt · `df5631eb` estate · `aaac75f4` balanced --stations --zoo
12 · `418c5b2c` estate --zoo 12); every `accessprobe --layout millbelt` number
reproduces exactly; Law 6 holds behaviourally, not only by grep (one raw
`roadDist` read outside `fields.js`, the allowed one); §15 holds on the deep
rig across four seeds, 20 years then save → load → 36 months; §14 holds for
`render.js`; the rulings table is real at 14 rows; the town canary is genuinely
narrow.

**And one the third reviewer did NOT find, which my own sweep did.**
`justice.centreWithBed` asks `served` — a pacification centre no road reaches
takes nobody in — and nothing held it: replacing justice's `served` with
`() => true` left 502 checks green. The Part M' check that every sim module
still IMPORTS `served` pins a SPELLING, not a behaviour, and the mutant kept
the import and shadowed it. The behaviour is a check now, and the sentence
table's own else-branch is what makes it visible: with no reachable centre the
convicted go to the CELLS and the ticker says *"No centre in town"*. Lay two
road tiles beside the same building and the same sentences land in it. **A
list of importers is a spelling; a pair of runs is the rule.**

**Three mutants survive ON PURPOSE, and here is why.** An honest mutation
report names its equivalent mutants rather than quietly dropping them.

- `computeStationDoors`'s `d === 0` guard. Unreachable: `ops.crossable`
  refuses a road on a platform and `ops` refuses a station on a road, so a
  platform can never stand on its own door. That construction is a check now
  (a level crossing is track + road, never platform + road), which is where
  the claim actually lives.
- `computeRoadDist` exploring one ring further. Equivalent: the post-loop
  clamp erases it.
- `lotReport` computing `nearest` even when the lot is served. Equivalent: the
  card reads `rep.nearest` only in the unserved branch. It is a wasted search
  per hovered served tile, not a behaviour.

**The lesson, which is the same lesson a third time.** Round one showed me a
forecourt through a house and I pinned water, walls and houses. Round two
showed me a forecourt that CLOSED and I hashed the door list. Round three
showed me a forecourt that MOVED. Each time the fix was exactly the size of
the example. The general shape was available every time: *what else is derived
from this, and who reads it?* The tripwire that came out of asking it properly
is in Part M': **exactly four modules write `tier` or `civic`** — lots and
blocks inside `lotsTick`, events inside `eventsTick`, ops at the op — and the
tick settles the door graph after each of the three windows. A fifth writer
fails that check, which is the moment someone has to decide where its settle
goes.

## Road access — the first review

A HOSTILE REVIEW scored the first draft 6/10 and named eleven things; all of
them are in `46770c0`, and the review's own reproductions are fixtures now.
The four worst were real behaviour: a forecourt that walked through houses and
across rivers; a park being told it had no road; the overlay inverting if
`ROAD_REACH` moved; and the flagship "one implementation" check being one
spelling deep — a frontage rule written as an N4 scan over `world.road`
dropped the fixture town 41% and left 464 checks green. The suite now asks the
question behaviourally (two lots at one and three tiles must cap alike) and
carries a CANARY on the town's size, which it had never had.

Left:
- **A landmark is rare, and how rare is not settled.** The suite used to bet
  on seed 7, which raised one in year 7; that was luck, and the check now
  forces the merge roll inside a real tick instead. But the follow-up claim
  ("the rate did not move") does not survive re-measurement: the count runs
  2–6 of eight scripted 30-year towns depending on the seed set and on
  `--markets`, and the direction of the change flips with a flag that has
  nothing to do with access. n = 8 cannot decide it. What IS clear: 2×2
  blocks rise 29–41% with the industrial frontage rule gone, which is an
  unremarked consequence of this part. Whether nine tier-3 lots of one kind
  should be as rare as they are is a design question for the owner.
- **An overlay is painted on the ground, so a building hides its own tile's
  band.** True of every overlay in the game, and most visible on the access
  one, where the interesting tiles are exactly the built ones. A tint drawn
  over the building (a roof wash, or the zot) would fix it for all six.
- `ROAD_REACH` stays 3 and is not exposed as a knob. The owner's blocks never
  need more.
- **Neither headline mechanism can happen in a town the mayor builds.** She
  rings every 6×6, so the footprint rule lifts nothing; she lays her line
  along a ring, so no animal crosses a forecourt. `--rig deep` builds a town
  she would not, and reports both; the gates still cannot see either, and
  saying so is better than pretending. If the owner's control city has deep
  quarters or a set-back line, it becomes the gate for both.
- **The footprint rule cannot bite at growth time.** `joinable` requires every
  lot of a window to be served on its own, so a block never forms across the
  line. It bites when a ROAD IS TAKEN AWAY, and when a zoo's four tiles are
  placed at once. Both are checked; neither is what the README first implied.
- **An overlay is painted on the ground, so a zoo hides its own band.** The
  platform's red can be photographed; the zoo's cannot, because its 2×2
  sprite covers all four of its diamonds. True of every overlay in the game.
- Rail bridges are still refused (no rail on water), so a station can be
  cut off by a channel the road crosses. Unchanged by this part.

## The freeze on a freshly zoned lot — FIXED 2026-09-03 (handoff §23; `tools/dom-shim.mjs`; 4 checks, both mutation-tested)
The owner: *"the game hangs on placement of residential tiles."* It was not a
hang: hovering a lot you had just zoned THREW. `TIER_NAME` has rows 1, 2, 3
and the card built its name string EAGERLY beside the ternary that only uses
it when the tier is non-zero, so `TIER_NAME[0][0]` was read on every empty
lot. The line was safe until the blocks commit (`9c89f73`, session 11)
hoisted it out of the ternary into a `const`; from that day the first thing a
player does in a new city broke it. The throw landed inside `main.js`'s rAF
frame one line above `requestAnimationFrame(frame)`, so the loop never
rescheduled — no ticks, no drawing, no input, and nothing in the window to say
why.

Three parts to the fix: the name is lazy again; `frame()` guards its body and
reschedules from the `catch`, so a panel bug is a glitch and never a freeze
(the first faults go to the console with their stack and the player is told
once); and `tools/dom-shim.mjs` + Part U' RUN the real `createUI` over every
distinct tile state a thirty-year city holds, hovered and pinned. Reverting
the one-line cure turns 2 checks red with 16 throws; removing the frame guard
turns a third red.

Left:
- The shim covers what `ui.js` uses today. A part that reaches for a DOM API
  it does not have will fail loudly in the suite, which is the right way
  round — add the method, do not weaken the check.
- The panel's OTHER surfaces (the tabs, the census, the news reader, the
  saves menu) are now reachable by a check and still unswept. The card was
  swept because that is where the freeze was.
- Nothing yet asserts what the card SAYS beyond "zoned, empty" and "tier N" —
  the text is the game's biggest untested prose surface.

## The level crossing — SHIPPED 2026-09-03 (plan §4-X; SPEC §7.9, §12.4c; handoff §22; 34 checks, all mutation-tested)
The owner: *"railroads and roads should be able to cross over each other
perpendicularly."* A road and a line share ONE tile when they cross
SQUARE-ON — after the op the tile's road runs straight on one axis and its
line straight on the other, judged on the WHOLE DRAG (`js/sim/ops.js`
`squareOn` / `maskAround` / `crossable` / `refuseCrossings`). Never on water
or a bridge, never under a wall (a tunnel has one open axis; a crossing has
two), never a station. A drag that stops on the line is refused there and
lays the rest; a drag that runs along the line lays nothing and says
`square-on`, and the prune REPEATS until it settles so a drag's own refused
leg cannot condemn the crossing at its corner. Keeping the invariant takes a
second clause, not a corollary: an op that would leave a NEIGHBOURING
crossing crooked is refused too. The bulldozer may still leave one crooked by
taking a neighbour away — no rule can stop that without trapping the player
beside it — so the art draws the stub, and beside a crooked crossing only the
ops that mend it are allowed. The commute graph was ALREADY right — `dial` walks any road tile
and rides any rail tile — so a walker crosses on foot and a rider passes
straight through, and nobody boards there. The art (`js/art/rail.js`
`crossingKey`) composes the two families, never a third drawing: 16 road
masks × 16 rail masks × busy = 512 ground diamonds, lazy and cached, each
with its own 2× twin. The three standing playtest gates are byte-identical
(`e1decbff / 6bcf6236 / 00d5e9c3`) — the rule accepts a case the scripted
mayor never attempts.

**X2, the ride speed — SHIPPED 2026-09-04.** The focused display probe reads
1.00 tile/s walking and 4.50 riding. Exact-boundary and one-large-frame vs
200-small-frame checks close the old bug where the speed at the start of a
frame leaked across every later segment. The same probe carries unused time
through a platform stand and onto the return leg. Felt commute time now sums
integer Dial costs before dividing once, so an exact threshold cannot drift
a few floating-point ulps over it. `WALK` now lives in the one knob registry;
`fields.WALK` is its alias. The targeted two-walk +
27-ride tortoise commute moves from 11 to 8 walk-steps, exactly its comfort
threshold. The integration review with Part R also caught the station-door
signature recording endpoints but not the exact forecourt chain: an equally
short reroute to the same door left live paths walking through a new building.
The chain is now signed, invalidated, replanned and save/continued in the
regression. The integrated canonical suite is 497 checks.

Left:
- Rail bridges (a deck sprite with rails) — still not built.
- A two-car train walker on busy lines; a crossing has no gate, no lights
  and no bell (it is one ground tile, and a moving barrier wants the
  walker layer).
- A refusal on a DRAG is silent at the point of release: `input.js:216`
  returns without calling `app.doOp`, so `main.js:145` never flashes. The
  strip is the whole channel — it now prints the reason itself (`input.js:113`
  was `${name}: blocked` for every reason there has ever been; the old
  reasons ARE the word "blocked", so nothing else reads differently) and
  names a crossing in the parenthetical beside bridges and tunnels. What is
  left: a flash on release would say it twice, which is probably right for a
  rule this new — C owns that path.

## The shop pool — SHIPPED 2026-09-03 (SPEC §12.2d; handoff §20; 8 checks)
The owner: *"unique low density shops would be a good target."* A tier-1 C
lot is one of eleven small businesses by its `variant` byte (`js/sim/shops.js`
— kind by `>> 1`, mirror by `& 1`; no state, no RNG, hash-neutral;
`js/art/shops.js` — ten new solids × two variants); the card names it after
its keepers by the staff's plurality species. What is left:
- **The same trick for cottages and sheds** — tier-1 R and I draw one
  family each; a pool of cottages (a thatch, a stone one, a timber one)
  would come from the same byte, and `buildingSprite` already takes it whole.
- **Species-kept shops** as an alternative rule (the kind by the staff's
  species, the way a landmark is by its residents) — rejected here for
  variety's sake and because a shop has no staff when it is built; the
  keeper NAME carries the species instead.
- **The keeper's name flickers** with staff churn (by design — derived, a
  sale is a sale); if it bothers anyone, hysteresis would be one byte of
  state and a hash change.
- **Walkers do not know the kinds**: a customer walker "going to the
  bakery" is Part A's bubble text plus `shopOf`.

## The landmarks — SHIPPED 2026-09-03 (SPEC §3c, §5, §12.2c, §15; handoff §19; 17 checks)
The proposal's other half: a 3×3 block takes the name and the picture of
the species that made it (`js/sim/landmarks.js` chooses the theme once, when
the block rises, kin counted together, ties and unthemed leaders → the plain
block; `world.theme` saved, hash-neutral until the first landmark;
`js/art/landmarks.js` — eleven 3×3s × two variants). What is left:
- **The proposal's per-theme effects** (births ×1.25 in the warren, I income
  ×1.15 at the dairy, the night market's mess, the sawmill's water) are NOT
  built — a landmark is a picture and a name. If the owner wants them, each
  is a weight in one module and a measured hash change; compute the EV
  before the first.
- **Cow and tortoise in R** (the pastoral pair, allied) have no landmark —
  "the Meadows" is the obvious twelfth row; every M staff raises the plain
  meat exchange (the proposal's ruling; a carnivore hall is the M theme).
- **Landmarks are rare in the scripted towns**: a 3×3 rose in two of five
  thirty-year runs (both the Mews). On the owner's scale (6×6+ blocks) they
  should be common; measure on the control city.
- **A part's hover card** and a landmark's card were verified in Node; the
  landmark's card was seen in the browser this session (handoff §19).

## The building redux — SHIPPED 2026-09-03 (SPEC §3b, §5, §12.2b, §12.6, §13; handoff §18; 37 checks)
The owner: *"some of commercial, industrial, residential, and meat
buildings to be 2x2 and 3x3 tile sizes. these should be the buildings that
can hold a lot of people. we need new cute images. i'd also like a more
high res sprite set for when the camera is zoomed in."* Built: blocks that
GROW (`js/sim/blocks.js` — a tier-3 High lot absorbs three tier-2+
neighbours into a 2×2, a 2×2 five more into a 3×3, ×1.25 the capacity of
four/nine tier-3 lots; split on decay; fire, flood, bulldozer take the
footprint whole; `world.big` saved, hash-neutral until the first block);
eight families × two variants (`js/art/blocks.js`); the hi-res set
(`js/art/hires.js` — every solid and ground diamond at 2× from its recipe,
drawn 1:1 at zoom 2); the ray audit (`tools/depthaudit.mjs`) and the
size-aware pull-back. What is left:
- ~~**Themed landmarks**~~ SHIPPED 2026-09-03 — see the section above.
- **Part E as drafted** (variants 2 → 4, lit windows by fill, species marks)
  now applies to eight more families.
- **Blocks are all residential in the scripted towns** — C waits on LV ≥ 60,
  I on a score over 0.05; measure on the owner's control city.
- **A part's hover card** was verified in Node, not seen in the browser.
- **Zoom 3/4**: `HI_SCALE` is one number; the animals would need a 2× kit
  first.

## Crime and punishment — SHIPPED 2026-09-02 (SPEC §9c; `js/sim/justice.js`); what is left
- **Hunger visibility.** The scripted towns run at U 0–4, so the ×20 hunger
  term only bites in dormitory / over-taxed towns (measured: one killing per
  ~7 years in a jobless town of 80). If the owner wants the hungry-wolf line
  in a healthy town, `KILL_HUNGRY` and the unemployment advisor are the knobs.
- **The wrongful 5% is rarely seen** at 4–9 arrests per 30 years (0–1 per
  run). `WRONGFUL_P` is the owner's number; the lever for visibility is the
  arrest volume (police cover, `ARREST_COVER`).
- **Customer walkers** to the hall (walkers.js `isShop` could include M);
  a "sold" departure walker. Part H shipped named staff handcarts for supply,
  not individual meal customers.
- **The predation animation SHIPPED 2026-09-02** (SPEC §14: the sack falls,
  is tied, goes home over the shoulder). Left: the victim's OWN walker, if
  it had one, is released at its next tile centre while the figure at the
  door already stands — two of the same animal for under a second; the
  sack now follows the exact H road/rail route INTO the selected meat hall
  and then home; no sound, no ticker flash at the moment of the
  drop (the KILLING line is the month's, not the second's).
- ~~**Supply from funerals**~~ SHIPPED in Part H as the natural-death body
  bus plus the hall's probabilistic doorstep purchase.
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
- Phase C rail SHIPPED (SPEC §7.9); **level crossings SHIPPED 2026-09-03**
  (their own section above). Left: rail bridges (a deck sprite with rails);
  a two-car train walker on busy lines; a lone rail tile draws a bare pad
  (the wall draws its straight run — do the same), and so does a crossing
  whose line has been bulldozed off both sides.

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
