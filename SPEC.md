# ZOO CITY 2000 — the specification

An isometric city builder where anthropomorphic animals live and grow together.
The player zones residential, commercial and industrial land, lays roads, sets
three tax rates, and copes with what the years throw at the town. The
population is not a number: it is a roster of named rabbits, mice, foxes,
beavers, owls, bears, tortoises and raccoons, each with a home, a job, an age,
friends and a mood, and the city's growth ceiling rises with how well they
mix.

This document is the result of a three-design panel (systems-first, zoo-first,
ship-first) scored by three judges; the systems design won and absorbed the
grafts listed in §12. Where a number below is a *target* rather than a
*measurement*, it says so; `tools/playtest.mjs` is the instrument that turns
targets into measurements, and the constants live in one place (`js/sim/rules.js`)
so tuning changes one file.

---

## 0. Laws (do not "improve" these)

1. **Zero dependencies, no build.** ES modules under `js/`. Everything except
   `js/render.js`, `js/ui.js`, `js/input.js`, `js/main.js` imports cleanly in
   Node. `node tools/check.mjs` is the gate.
2. **Determinism.** No `Math.random` anywhere under `js/`. Three seeded
   streams: `sim` (economy, growth, citizens, events), `names`, `walkers`.
   A name change never perturbs the city; walkers never write sim state.
   Same seed + same input log ⇒ identical state hash.
3. **Money is integer §.** Every cash change goes through `budget.post(world,
   kind, amount)`; every line is rounded to whole § before posting; the ledger
   re-sums to `cash` exactly. `check.mjs` greps for any other `cash +=`.
4. **Projection.** 64×32-pixel tiles on a 64×64-tile map, `toScreen` returns the NORTH vertex, +tx
   down-right, +ty down-left, light upper-left, painter back-to-front by
   (tx+ty), bottom-up within a cell, movers fractional. (`js/iso/iso.js`)
5. **Art is text.** Every sprite is rows of palette keys; built things are box
   solids through the z-buffer rasteriser (`js/art/solid.js`); organic things
   (animals, trees) are hand-authored. Every pixel is a palette key.
6. **A diagnostic is computed by the code it diagnoses.** The hover card's
   "why not" reason comes from the same `lotScore()` call that decides growth,
   returned as a reason code. Never a second implementation.
7. **Instruments annotate, never halt.** `playtest.mjs` reports numbers
   against targets; `check.mjs` is the only thing that exits 1.
8. **Traffic is a readout in v1, never a gate.** No wind. Both stated in the
   Rules tab so the player does not look for them.

---

## 1. Cadence

- **1 tick = 1 month; 12 ticks = 1 year.** Speed 1 = 1.5 s/month (a 60-year
  city in 18 minutes); speeds ×3 and ×10; pause. THE STEP IS NEVER SCALED,
  ONLY THE NUMBER OF STEPS.
- Tick order (`js/sim/tick.js`), consumed from the `sim` stream in this order
  only:
  1. fields — `roadDist` (only when roads changed), traffic, pollution,
     centroid, land value
  2. census (P, W, J, F, U, Lab, species shares, friendship counts)
  3. valves
  4. lots grow / decay, in raster order
  5. citizens — birthdays, deaths, births, move-outs, job search, arrivals,
     departures, friendships, mood
  6. budget slice
  7. events — tick active effects, roll a new one
  8. history push; every 12th tick the yearly report and advisor lines

---

## 2. The map

- **64×64 tiles**, flat. Per tile (typed arrays, index `i = ty*w + tx`):
  `terrain` (0 grass, 1 water, 2 tree), `road` (0 none, 1 road, 2 bridge),
  `zone` (0 none, 1 R, 2 C, 3 I), `maxTier` (1 or 3; default 3), `tier`
  (0..3), `civic` (0 none, 1 park, 2 zoo anchor, 3 zoo part), `burning`
  (ticks left), `rubble` (MONTHS LEFT, counting down — every `if (world.rubble[i])` still
  reads "there is rubble here", and no new tile array joins the save),
  `variant` (art seed byte), `wall` (0/1 —
  with a road or rail on the tile, a tunnel; §6b), `use` (`Uint16`: 0 mixed,
  otherwise a checkbox mask for predator, prey and all 14 species — the
  player's line on lots and roads; §7.8),
  `rail` (0 none, 1 rail, 2 station; §7.9).
- Seeded generation: one river 2–3 tiles wide as a biased random walk from one
  edge to the opposite edge (never straight); 1–2 ponds; tree clumps by seeded
  blue-noise clusters covering ~18% of land; the rest grass.
- **Bridges are in v1.** A road painted over water is a bridge (§40, upkeep
  ×3), drawn as a deck box on two piers. This is the answer to "the river
  cuts the map in half".
- **The opening beat.** The map starts with ONE edge road: a 6-tile stub
  entering from the map edge nearest the centroid of the largest dry region,
  ending in a T. Starting cash §20,000. The advisor's tick-0 lines: *"Zone
  R, C and I within 3 tiles of a road. 8% is neutral for a town this size.
  Animals arrive when there are jobs."* The Rules tab is open by default on a
  new city.
- **Edge roads are the world's door.** Arrivals walk in from, and departures
  walk out to, the edge road nearest the city centroid. `edgeRoads` (road
  tiles on the border, counted to 3) feeds the external market (§4).

---

## 3. Lots and capacities

One lot = one tile = one building. Tiers 0..3 (0 = zoned, empty).

| zone | tier 1 | tier 2 | tier 3 |
|---|---|---|---|
| R citizens | 4 | 10 | 24 |
| C jobs | 3 | 8 | 20 |
| I jobs | 4 | 10 | 24 |
| Large Park (3×3 civic; legacy 2×2) | 12 C-type jobs | | |
| Zoo prison (3×3 civic) | 8 C-type jobs; 24 beds | | |

`maxTier` is the density brush: Low = 1, High = 3 (one byte per lot; the
species-selection lever — mice want towers, bears want cottages).

### 3b. Blocks — one building on 2×2 or 3×3 tiles (`js/sim/blocks.js`; session 9, 2026-09-03)

The owner: *"i'd like some of commercial, industrial, residential, and meat
buildings to be 2x2 and 3x3 tile sizes. these should be the buildings that
can hold a lot of people."* A block is never placed; it GROWS (§5). One
saved byte per tile, `big[i]`: 0 a lot of its own; 2 | 3 the anchor (north
corner) of a block that side; `PART | dx | dy << 2` a part pointing at its
anchor. A part keeps its zone and tier 3 — every "is it built" test still
says yes — and only capacity, jobs, the standing sprite and growth ask
`isPart`. Everyone in a block lives or works on its ANCHOR; readers that
want people per tile (crime's density, a shop's customers, a hall's
carnivores) use `occAt` / `carnAtOf`, which spread the anchor's count over
the footprint. Capacity is side² × BIG_BONUS (1.25) of a tier-3 lot:

| | 1×1 | 2×2 | 3×3 |
|---|---|---|---|
| R animals | 24 | 120 | 270 |
| C jobs | 20 | 100 | 225 |
| I jobs | 24 | 120 | 270 |
| M jobs | 16 | 80 | 180 |

A block comes apart three ways, all through `splitLot`: decay (§5); a
storey lost (fire saved, flood, a heist, a raid, the dam — `dissolve`
splits first, then the one tile loses its storey); rubble or the bulldozer
(every tile of the footprint at once — the bulldozer on any tile of a block
takes the footprint, §2 a tile, one evict, not undoable when occupied). Fire
takes the whole footprint at once too (`ignite`), so a block never
half-burns. A `use` repaint covers the footprint. The census counts halls,
not tiles (`markets`), and `blocks2` / `blocks3`. The hover card names the
block (terrace court · arcade · mill · abattoir; the towers · emporium ·
foundry · meat exchange), a part says whose it is, and a tier-3 lot says what
its block is waiting for.

### 3c. Landmarks — a 3×3 takes the name of the species that made it (`js/sim/landmarks.js`; session 12, 2026-09-03)

The owner (2026-09-02): *"themed commercial shops, an industrial dairy, or
a residential apartment building."* A landmark is not placed and not bought:
it is what a 3×3 block IS when the animals who fill it are of a kind. When a
3×3 forms (`mergeLots`), its residents (R) or its staff (C, I) are counted
by species, KIN TOGETHER — a landmark lists the species it is for and their
counts are summed against every other species on its own — and the largest
group names the block and chooses its picture; a tie at the top, or a top
group with no landmark in the zone, leaves the plain block (the towers, the
emporium, the foundry). "Majority" means plurality: measured on five
scripted towns, the leading species on a block holds 16–37% and never half.
The theme is chosen ONCE, when the block rises, and kept until it comes
apart (a building does not re-skin when its tenants change); one saved byte
per tile, `theme[anchor]` (0 the plain block), cleared by `splitLot` and by
the bulldozer with `big`. A 2×2 has none; M has none (the proposal's ruling).

| id | zone | kin | landmark |
|---|---|---|---|
| 1 | R | rabbit, mouse | **Warren Towers** — three honeycomb drums of round doors and round windows under sod roofs, a burrow mound |
| 2 | R | beaver, bear, wolf | **the Lodge** — log halls on a dam-stone plinth round a pond, the great lodge at the back |
| 3 | R | owl, hawk | **the Roost** — three timber towers on stilts, round windows high up, perch beams |
| 4 | R | pig, raccoon, skunk | **the Wallows** — brick ranges round a mud court with two wallow pools and a row of bins |
| 5 | R | cat, fox | **the Mews** — a cobbled mews of tall townhouses with arched carriage doors and lamps |
| 6 | C | fox, cat | **the Fox & Cat** — a coaching inn round a yard: a gallery, a hanging sign, lanterns |
| 7 | C | raccoon, owl, skunk | **the Night Market** — a lit hall and two rows of stalls under gold-and-dark awnings |
| 8 | I | cow | **the Dairy** — a whitewashed churn hall, two silos, the tanker, churns on the step |
| 9 | I | pig | **the Truffle Works** — three beehive kilns in a mud yard under an oak |
| 10 | I | bear | **the Honey Works** — a weatherboard packing hall, a honey tank, nine hives in rows |
| 11 | I | beaver | **the Sawmill** — a saw shed open to the log pond, a waterwheel, a log stack |

Cow and tortoise in R, and every M staff, have no landmark yet and raise the
plain block. **A landmark is a picture and a name, never a bonus**: no gate,
no weight, no income term (the proposal's per-theme effects are not built;
they would change every town's hash for a flavour whose EV nobody computed).
A town with no landmark hashes as it did before them (an all-zero `theme`
is left out of the hash, §15). When one rises the ticker says so and the log
keeps it under its own id — *LANDMARK — the Mews: the Purringtons and the
Slyfields have made a landmark of the block at (18,4); 65 of 129 living
there are cats and foxes.* — with the block's coordinates in the line, so
`play.mjs --when "^LANDMARK"` points the camera at it. The card names the
landmark and who made it; the census counts `landmarks` and
`landmarkCounts` by name; Rules G6 reads them.

---

## 4. Demand — the five equations (`js/sim/demand.js`)

Census per tick:
```
P   = citizens.length
W   = citizens with 16 <= age < species.retire        (workers)
J   = Σ lots jobs[zone][tier] + 12·zoos ;  Jc, Ji     (C and I parts; zoo jobs count as C)
F   = citizens holding a job ;  U = W − F
Lab = J ? clamp(W / J, 0, 1.3) : 1.3                 (Micropolis LaborBase, same clamp)
ext = (1 + 0.10·sin(2π·tick/150)) · (0.85 + 0.15·min(edgeRoads, 3)) · eventMult
```
Demand ratios (each clamped to [−1, 1]):
```
rR = (J + 40 − W) / max(W, 40)                                   jobs per worker (+40 seed pulls an empty map)
rC = (0.22·P + 20 − Jc) / max(Jc, 40) + 0.5·min(0, (J ? W/J : 1) − 1)   internal market (Micropolis TotalPop/3.7)
rI = (ext · 1.15 · Lab − 1) · 2                                  external market × labour (Micropolis Ind·LaborBase·ext)
```
Tax term, per zone rate `rate_z ∈ 0..20` (three rates; default 8):
```
n(P) = clamp(9 − P/1600, 6, 9)                                   neutral rate falls CONTINUOUSLY with size (SC3K shape, no cliff)
T(rate) = 0.04·(n − rate)                          if rate <= n
        = −(0.10·d + 0.0125·d²), d = rate − n      if rate >  n   asymmetric, quadratic above neutral
```
Valves — leaky integrators, 63% of a step in 6 months:
```
V_z ← V_z + 0.15·(clamp(r_z + T(rate_z), −1, 1) − V_z)
V_R ← min(V_R, 1 − P/Cap)                                        the SC4 cap law
Cap = (1200 + 150·parks + 500·zoos + festivalBonus) · (1 + 0.5·H)
H   = cross-species friendships / max(1, all friendships)         "live and grow together" is a live term
```
The tax term is additive to the velocity, as in Micropolis. Deviations on
purpose: leaky valve (no saturation trap), quadratic over-tax penalty (flight
must show in walkers within two game years), industry driven by the external
market (breaks the R-waits-for-jobs / C-waits-for-R deadlock — measured in the
lumped run).

**Measured in the lumped run (300 R / 120 C / 120 I lots, seed 1) — the
panel's pre-code targets. The live game's numbers are in the handoff §4
(`docs/HANDOFF-THE-FIRST-ZOO-2026-09-02.md`); where they differ, the code
is the measurement:** flat 8% → ~1,100 by year 10; 8% + 2
parks + zoo → ~1,600 plateau; established city 9→13% at y15 → −43% by y21,
cut to 7% at y22 → recovers to ~1,100 by y31; recession (ext 0.6, 24
months) → −36% I jobs, −10% P, no ringing.

---

## 5. Lots — growth and decay (`js/sim/lots.js`)

```
roadDist(i) = BFS distance (4-neighbour, through any tile) to the nearest road/bridge, capped 4
served(i)   = min roadDist over the SITE's footprint <= 3          §6c — one standard, for every rule that asks
local_R = clamp((LV − Pol − 40) / LOCAL_SCALE, −0.3, 0.3)        LOCAL_SCALE = 200 (pre-registered knob; D0 used 60, judged too wide)
          growth REFUSED if Pol > 60                               (Micropolis DoResIn at 0..100 scale)
local_C = 0.6·clamp(Rnear/80 − 0.5, −0.3, 0.3) + 0.4·(LV − 50)/200    Rnear = citizens housed within Chebyshev 5
local_I = 0.4·(50 − LV)/200                                        industry likes cheap land (SC2000's tier-3 frontage rule is GONE — §6c)
score   = V_zone + local ;  if !served → score = −1 (reason NO_ROAD)
maxTierByLV: R and C: LV < 30 → 1, < 60 → 2, else 3 ; I: 3.  Effective max = min(maxTierByLV, lot.maxTier)
fill    = occupants/capacity (R) or workers/jobs (C, I)
GROW  if tier < max && score > GROW_THRESH(0.05) && (tier == 0 || fill >= 0.7):
        p = (tier == 0 ? SPROUT_P(0.25) : 0.10) · score      per month
DECAY if tier > 0 && score < −0.15 && (zone != R || fill < 0.5):  p = 0.10·(−score)
MERGE (§3b, blocks.js): a tier-3 High lot of its own with three High lots of its zone at tier ≥ 2 in one of the
      four 2×2 windows containing it (raster order of anchors) — same line, served, untroubled — the window
      ≥ FILL_TO_GROW full together, and score > GROW_THRESH:  p = BIG_P(0.10)·score → one 2×2 at tier 3, its people
      moved to the anchor, nobody evicted. A 2×2 anchor with five such lots in a 3×3 window containing it → a 3×3.
      The first draft asked for all four at tier 3: 14 of 281 R lots in the scripted town, none touching.
SPLIT a block whose anchor would DECAY comes apart into tier-3 lots of its own; the excess rehome within 12
      road tiles (the singles it made are the nearest vacant lots) or, for C/I/M, lose the job.
LANDMARK (§3c, landmarks.js): when a 3×3 forms, the largest kin group among those now on its anchor (residents
      for R, staff for C/I) sets theme[anchor] once — kept until SPLIT — no roll, no RNG, no effect but the name and the picture.
```
Reason codes returned by `lotScore()` (priority order): `PART` (a block's
part — the report is the anchor's), `NO_ROAD`, `SMOG`, `NO_DEMAND`,
`LV_CAP`, `DENSITY_CAP`, `WAITING_FILL`, `CAPPED` (V_R pinned by Cap),
`GROWING`, `MERGING` (with `merge` = the window and `window` = { side,
fill } on the report; a tier-3 lot with a window that is not yet full
reports `window` under `STABLE`), `DECAYING`, `STABLE`. The hover card
prints the code's text.

On R decay the excess households look for a vacant home within 12 road tiles
of the old one, else emigrate together. On C/I decay the excess workers are
fired. Firms are NOT occupancy-gated for decay: a recession lays people off
from full factories.

---

## 6. Fields (`js/sim/fields.js`), per tile, 0..100

```
Pol    = Σ over sources of amount·(1 − d/(radius+1)) within Chebyshev radius, clamped 0..100 (SC4's linear falloff; no wind)
         I tier 25/45/70 over 2/3/4 tiles · C tier 3: 10 over 2 · road 2 + min(28, traffic/4) over 1 · fire 50 over 3
         pigs 1.5 and skunks 1.0 per animal at home over 1 (MESS) · parks −12 over 2 · trees −4 on the tile
         (the first version was two 3×3 blurs of a per-tile emission; it diluted a lone works to ~2 and was replaced — see the handoff)
dC     = Chebyshev distance to the centroid of built lots (all lots if none built)
LV     = clamp(35 + 40·max(0, 1 − dC/24) + 3·nature8 + 12·[park within 4] + 6·[zoo within 5] − 0.6·Pol, 0, 100)  −10 where crime > 60
         nature8 = water or tree tiles among the 8 neighbours
traffic(road tile) = number of commuter paths through it (readout only)
```
Commutes: a citizen's job must be reachable by a road path ≤ 40 road tiles
from the road tile nearest home. BFS per job search (≤ 4,096 nodes, cheap);
**no path cache in v1** (the judges' call: the cache is the most bug-prone
piece and BFS-per-search is ~free at this size). Traffic = recount every
tick from the stored `pathLen`/`path` of employed citizens? No — v1 stores
each employed citizen's path as a Uint16Array of tile indices (≤ 40) and
traffic is the per-tick sum; any road edit invalidates every path (all
employed citizens re-search next tick, in id order).

### 6b. Walls — the reach law (`js/sim/reach.js`; Glades of Arcadia's, adopted whole)

Every area effect above radiates by **flood fill**, not by a square: from
each source over the passable tiles, decaying by the length of the path it
actually took — `1 − d/(R+1)` with `d` the flood distance. The flood is
8-connected with unit diagonals, so on open ground `d` IS the Chebyshev
distance and a city with no walls gets byte-identical fields (the suite
proves it against the square before anything else; a wall-less city keeps
the square loop). A **wall tile** (`wall[i]`, key `B`, §8 a tile, §1 a year;
an L-drag like a road, Shift = straight; never on water, chalk, a civic or a
building) is impassable and receives nothing. A road or rail across a wall
tile is a **tunnel**: open along its road's axis only, so a compound with one
gate leaks along the road through the gate and nowhere else — "walls help
*decrease*", not eliminate. No corner-cutting: a diagonal step is refused
when both orthogonal neighbours are walls. Bulldozing a tunnel takes the
wall first and keeps the road.

What honours the wall: pollution (every source, parks as sinks), dread, the
hall's crime hill and every file's stain, the park / zoo / van land-value
masks and a plaque's bonus, fire and police cover, and every radius query in
justice — the killing's victims, the wrongful pool, the thief pool,
`hallNear` — so a walled prey compound is out of a killer's reach. Road
reach (`roadDist`, `doorOf`) stops at a bare wall too: a lot walled off on
every side has no road and the card says so. Not affected, on purpose: the
centroid term of LV (not a source) and `nature8` (the eight neighbours).
`occl[i]` is the derived per-tile mask of the eight directions influence may
cross (0xFF open, 0x00 a wall, the two bits of its axis for a tunnel — a
crossing a → b needs a's bit and b's opposite, so a gate never has to know
which side you came from).

### 6c. Access — ONE standard, asked of the whole footprint (`fields.served`, `fields.doorSearch`; session 15, 2026-09-04)

The owner: *"as long as a tile is within 1-3 tiles of the road it has road
access"*, then *"the 6x6 squares have roads around the whole perimeter, so
nothing is more than 3 tiles away"*, then *"i want that rule standardized,
including rail and warehouses, and zoos"*, and *"the other way to think about
it is that all sides have access points."*

```
siteTiles(i)   = the tiles of the THING at i: a block's footprint (§3b), a zoo's four (§2), or [i]
siteRoadDist(i)= min roadDist over siteTiles(i)      — except a PLATFORM, below
served(i)      ⇔ siteRoadDist(i) <= ROAD_REACH (3)
doorSearch(i)  = a multi-source BFS out of siteTiles(i), through any tile a BARE WALL does not block
                 (§6b), stopping at the first depth that reaches road → { d, doors }
doorsOf(i)     = every road tile at that depth, ascending — ALL SIDES ARE ACCESS POINTS
passable(j)    = ground a citizen may stand on: not water, not a bare wall, not a building, not a
                 civic that is not a park. A BRIDGE and a TUNNEL are ways, not walls; trees, rubble,
                 a flood, a park, plain track and a platform are all ground. One row per ruling in
                 Part M', so each is a decision rather than an omission
asksAccess(i)  = a lot, a zoo, a station or a civic EMPLOYER — never a park, never open ground
nearestRoad(i, reach = nearReach()) = the same search, further out; the CARD's second question, asked by no rule
                 — it carries the site's own rule, so a platform is asked the WALKING question here too
nearReach()    = ROAD_REACH + 5, read at CALL time — a constant froze the card's horizon at import
```

`served`, `siteRoadDist`, `doorsOf`, `doorOf` and `nearestRoad` each take an
optional caller-owned `seen` buffer. §14 forbids the draw and street layers a
buffer on the world, and they are exactly who calls them — the access overlay
asks `siteRoadDist` of every tile in its screen-space bounding box (it does not
carry the per-tile cull the building pass uses, so roughly twice the visible
tiles; the whole-map figure in BACKLOG bounds it), the score overlay reaches
`served` through `lotScore`, the walker layer asks `doorsOf` for a doorstep —
and a platform's answer to any of them is a search.

One reader outside `js/sim` DECIDES with the raw field: `js/ui.js` chooses
which of the three refusals to print from `rep.roadDist`. That is deliberate
and it is the only one — the raw field is clamped at `ROAD_REACH + 1`, so it
can say "a road is right there" and nothing else, which is exactly the
distinction the middle refusal draws. Part M's Law 6 grep scans `js/sim` only,
so this line is held by the card checks instead.

**Two questions, not one.** A lot's access is a DISTANCE: nobody walks the
gap, the animal appears at its door, and a river or a neighbour's terrace
between lot and road has never been an obstacle to it. A PLATFORM's access is
a WALK: every tile of its forecourt goes into the stored path and is drawn
under a walker. So `siteRoadDist` sends a `rail === 2` tile through the same
search with `passable`, and `served`, `doorsOf`, the card and the overlay all
read their answer through that one branch — the field cannot call a station
served that the graph cannot reach. Without it the rig walked a rabbit
through a house and across a river and called the platform a station for it.

**Who is asked.** `asksAccess` — read by BOTH the access overlay's refusal
band and the hover card's warning, so "no road" is only ever SAID where it is
a refusal. A park never asks (a park is a place, not a service), and neither
does open ground: on countryside "no road within 3" is not a complaint.

**`ROAD_REACH` is a knob and everything moves with it.** The overlay's tints
are indexed by distance and CLAMPED to the band it has, so at `ROAD_REACH` 5
a lot five tiles out takes the deepest tint rather than the refusal red;
`nearReach()` is a FUNCTION, read when the card asks, so the card's horizon
still looks further than the rule at 9 as it does at 3. A fixed table read at
5 inverted the overlay's meaning, and every check passed because they all ran
at 3. The horizon was the same mistake one layer down — a module-load
constant, so at `ROAD_REACH` 9 the card looked LESS far than the rule while
this paragraph claimed otherwise, and the check that was supposed to catch it
restored the knob before reading it and evaluated `8 > 3`. Both settings are
asked now, inside the moved window.

**The field, the card and the graph are the same list.** `served`, `doorsOf`
and the edges in `computeStationDoors` are three readings of one search, and
a check asks every platform for all three after a build, after two years of
ticks, after a reload and after an op — same tiles, same ORDER, no extras and
no leftovers. The order is not cosmetic: it is the tie-break every downstream
number is settled by, and deleting the sort moved every published gate hash
and a scripted town by 10% while the suite stayed green.

`served` is the only test of a road's nearness in `js/sim`; `hasAccess` is
gone. Part M' greps for a second one (the one allowed reader of the raw
field is `lotReport`, which prints the tile's own number beside the site's
and decides nothing with it) and mutation-tests the rest. What each rule
became:

| asks | reads |
|---|---|
| R / C / I / M growth and decay (`lotScore`) | `served` — unchanged for a 1×1 |
| a 2×2 or 3×3 **block** (`joinable`, `troubled`) | `served` on the block: a 3×3 whose far corner is 4 from the road is served if any corner is 3 |
| **industry above tier 2** | `served`. SC2000's frontage rule (`roadDist <= 1`) is DELETED — the inside of an industrial block may now stand as tall as its edge; the millbelt gains 11 tier-3 works |
| a **rail station** | `served`. It was "a road tile ORTHOGONALLY beside the platform", which is the d = 1 case of the same rule |
| the **zoo** (2×2) | `served` on all four tiles, gating jobs, the LV halo and the census the cap reads — one predicate, three effects. The census reports `zoos` (served) and `zoosNoRoad` |
| a **meat hall**, the pacification centre, fire and police cover | `served` |
| a **park** | nothing. A park is a place, not a service; the owner did not list it |
| **doors** (job search, walkers, carts, the station) | `doorsOf` — every side |

**All sides.** `dial` takes one road tile or a LIST, and `commutePath` takes
a list at each end, so a commute is the cheapest pairing of any home door
with any job door: a citizen with roads north and south leaves by whichever
side its work is on. The open-job index lists a workplace under every door
it has and scores it ONCE, at the first (therefore cheapest) one the search
settles — a second door must not draw a second random weight.

**The platform's forecourt.** `computeStationDoors` (derived with `roadDist`,
never saved) gives every station tile an edge to each of its doors at `WALK`
per tile of the gap, and carries the tiles BETWEEN them. `nodePath` lays
those into the stored path, so every consecutive pair of walked entries is
still orthogonally adjacent: the gap costs a walk, `commuteTime` prices it
per tile, traffic counts it, and the walker crosses it on foot. Move a line
from three tiles off the road to one and the same journey loses exactly four
steps. The derived graph signature contains each station, door and exact
forecourt chain — not just the endpoints. If new construction reroutes an
equally short approach to the same door, `doorsMoved` still invalidates every
stored commute before anyone can keep walking through the new building.

**A shape change is a re-plan.** Merging or splitting a block changes the
site, so it changes the doors: `blocks.replanOn` marks everyone living or
working there stale. Without it a straight run kept a legal older path while
a reload computed the new one, and §15's save/load law caught it — the same
trap `placeHousehold` was fixed for.

**Live at the op.** `ops.apply` recomputes `roadDist` (and the station doors)
the moment a road, wall or rail is drawn, not at the next tick: every loaded
city opens PAUSED, and the card used to read "no road within 3" beside a
brand-new road until the player pressed Space. Hash-neutral — it is the same
field the tick would have built.

**The ground under a forecourt MOVES, and a move is a re-plan.** `passable`
reads `tier` and `civic`, so a building that GROWS across a forecourt — or a
civic dropped on one — closes a way that stored commutes are already walking,
and neither goes through the road/wall/rail branch above.
`computeStationDoors` keeps a signature of the door graph and raises
`world.doorsMoved` when it changes. **The signature is `platform > door :
chain`, per edge — the tiles BETWEEN, not only the door.** A door set is not
the graph: the chain is what `nodePath` lays into every stored path, what
`computeTraffic` counts, what `commuteTime` prices, what `exposure` reads the
player's line on, and what a walker is drawn standing on. A civic dropped on
the tile both of a platform's doors were reached through leaves BOTH doors
standing — it is entered from either side — and moves every chain; a signature
over door lists sees nothing, and 99 animals keep walking through a police
station.

The flag is acted on in four places, all with the same `invalidatePaths` a
road edit uses: `ops.apply` after every op (and `ops.undo` after every undo),
`tick.js` right after `lotsTick`, `tick.js` again after `eventsTick` — a fire
razes buildings and a sinkhole opens WATER at step 7, three steps after the
first settle, and everything below that line plans over the door graph — and
`refreshLast`, which consumes the flag on a path where the ground cannot have
moved (a rate op, a load) so that a raised flag is never left lying for the
next tick to act on. The fourth never fires; it exists so that nothing else has
to know it doesn't.

**A SETTLE INVALIDATES; SOMEBODY ELSE RE-PLANS.** `settleDoors` does one
thing, and who repairs the damage depends on where the caller stands:

| caller | who rebuilds |
|---|---|
| after `lotsTick` | `citizensTick`'s own stale pass, two steps later |
| after `eventsTick` | `tick` itself, immediately and unconditionally — `justiceTick` prices a trespass from `c.path` and `meatTick` routes carts on it, both inside this tick |
| `ops.apply` / `ops.undo` | the op, immediately — see below |
| `refreshLast` | nobody; it consumes the flag on a path where the ground cannot have moved |

and `tick` calls `citizens.replanStale` once more at the very end, as a
backstop for anything a future step might mark stale after justice. **That last
call is currently dead** — measured over 1,440 tick boundaries of four weathered
towns, nothing is ever left flagged there — and it stays because the law is
about the boundary and the cost is one pass over a list of clean citizens.

**Nothing may end a tick stale, and nothing may READ a stale commute.** A month
that ends with commutes null takes next month's traffic, riders and mean
commute from nothing in the straight run and from everything after a reload
(`save.rebuildDerived` re-plans unconditionally); §15's hash at the boundary is
equal either way, because `c.path` is not in `canonicalCitizen`, so the two
cities part a month later.

**An op re-plans too, and that is not only a save/load matter.** `ops.apply`
invalidates every commute; the next tick counts TRAFFIC at step 1 and repairs
at step 5, so for a long time the month after any op counted the whole town's
traffic from nothing — and pollution, land value and crime are computed from
traffic. It was farmable: one §1 repaint a month bought +4.6% population, -29%
pollution and more cash than doing nothing. `apply` and `undo` call
`replanStale` before they return.
Without any of this a straight run keeps the stale commutes while a reload
re-plans, and the two part company a month later — hidden at first, because
`c.path` is not in the saved citizen and §15's hash could not see it for two
years.

**What the card may say.** Three refusals, and each is true of a different
thing. A road within the horizon that a citizen could reach: *"the nearest
road is 6 tiles away at (5,6), 3 too far"*. A road the RAW field can see but
nothing can walk to — only a platform can be in this state, because its access
is a walk: *"a road is 2 tiles away, but nothing can walk to it"*. And nothing
at all within `nearReach()`: *"no road within 8 tiles in any direction"*. The
middle one exists because the card printed the third beside `road 2` on the
env line of the same card — a false sentence, contradicted two lines down.

**A PLACEABLE BUILDING IS A FUNCTIONAL BUILDING.** The owner, 2026-09-04:
*"any placeable building should be a functional building. any placeable
building should be an enterable building. if a building meets the requirements
to exist it should be functional."* So `ops` REFUSES a fire station, a police
station, a pacification centre or a zoo where no road reaches, with the reason
in words — rather than taking the money for a building that employs nobody,
covers nothing and takes nobody in. A zoned lot was always like this: chalk
with no road never becomes a building at all.

Two exceptions, both the owner's:

- a **PARK** asks no road, because it is a place and not a service;
- a **PLATFORM** is placeable anywhere on track, because a line is laid ahead
  of the town — and instead it wears the NO ROAD zot, *"like houses that are
  too far from the road"*. `render.computeZots` follows `asksAccess` for that,
  so a stranded station, zoo or civic employer says so on the MAP and not only
  in the card. A zoo wears it on its anchor alone; four would be a rash.

The gate is at PLACEMENT. A building can still be stranded afterwards by
bulldozing the road that served it, which is why every effect stays gated on
`served` as well — that is the case the table above is about.

**Not access.** A building's drawn door is on its south face whatever side
the road is on (art, §12.2). `ROAD_REACH` stays 3.

---

## 7. Citizens (`js/sim/citizens.js`, `js/sim/species.js`)

### 7.1 The individual
```
{ id, name, species, born (tick), deathAge (months, rolled at creation),
  home: lot|−1, job: lot|−1, household: id, friends: [<= 4 ids], mood: 0..100,
  jobless: months, path: Uint16Array|null }
```
Names: seeded per-species syllable generator on the `names` stream, plus a
pun surname per household (rabbit Burrowes, mouse Whiskerton, fox Slyfield,
beaver Gnawley, owl Hootsworth, bear Ursin, tortoise Shelby, raccoon
Binsworth). The card says "the Burrowes family, 4 rabbits".

### 7.2 Households — the owner of arrivals, births and departures
```
{ id, members: [ids], home: lot|−1, species (of arrival) }
```
- Households ARRIVE single-species, 2–4 citizens (2 adults + 0–2 children).
- They leave together (emigration is per household, rolled once).
- Births need 2 fertile adults in the household and headroom in the lot;
  p = litter/96 per month, ×0.25 if the home is full (Caesar crowding push
  toward a tier-up). Cub species = a random parent's species (mixed
  households exist only via move-in at 16).
- At 16 a child SPLITS into a new one-member household and looks for a home
  within 12 road tiles; if none, stays (counted as an adult in W).
- **Removal rule (the dangling-id law):** when a citizen dies or emigrates, it
  is removed from every friend's `friends` list, from its household's
  `members`, from its lot's occupant count and its job's staff count, in the
  same function (`removeCitizen`). An empty household is deleted. `check.mjs`
  asserts: no friend id refers to a missing citizen; every household member
  lists that household; occupant/staff counts equal recounts.

### 7.3 Aging, work, death
- `age++` on the birth month. Child < 16; worker 16..retire; elder ≥ retire
  (keeps the home, leaves W, walks at ×0.7 with a lighter fur step).
- `deathAge = lifespan·(0.8 + 0.4·u)` rolled at creation (deterministic).
- Job search: ≤ 64 searchers per tick in id order; BFS from the home's road
  tile over roads to any lot with open jobs, ≤ 40 tiles, preferring the
  species' zone by weight (never a gate). No path → `jobless++`, zot NO_JOB.

### 7.4 Arrivals and departures
```
vacantR = Σ R capacity − P
ARRIVE (V_R > 0): households this tick = floor(0.10·V_R·vacantR/3 + rng()) ;
        species by weight_s = base_s · fit_s(city)   (see 7.6); placed in the vacant R lot
        maximising LV − Pol·(1 − tolerance_s/100) + homePref_s ; walk in from the edge road
CAMPERS (V_R > 0 and vacantR == 0): up to 8 named campers with tents beside the
        edge road; they leave after 3 months. Unmet demand with a face.
SCOUT   (a species' arrival weight ≥ 2× base and it has no residents): ONE
        scout of that species walks the roads for a month. Hint before earned.
LEAVE  (V_R <= 0): per household per month
        p = (anyUnemployed ? 0.06 : 0.015) · (−V_R) · (1 − 0.2·meanFriends) · (1.5 − meanMood/100)
FRICTION: 0.4% of FRIENDLESS adults' households per month wander off regardless
```

### 7.5 Friendships and mood
- Each tick 200 sampled citizens (id order, rotating window) roll
  `p = 0.05·affinity` to befriend a co-worker, a neighbour (home within
  Chebyshev 1) or a fellow park-goer (both within 4 of the same park).
  Affinity 1.0 same or allied, 0.7 neutral, 0.4 wary (fox–rabbit, fox–mouse,
  owl–mouse); **raccoon 1.2 with everyone — the glue species.** Friends cap
  at 4; oldest link is dropped.
- **Funeral rule:** a citizen with ≥ 3 friends dies → each pair of its friends
  befriends with p = 0.5 ("they met at the wake"); cross-species pairs count
  toward H. Elders are a harmony engine.
- **Friendship on the map:** when a link forms between two citizens, the
  walker layer spawns a MEETING that month: both walk to the road tile between
  their homes and stand together for ~4 s with a small glyph. Cheap, visible,
  cosmetic (walker stream).
- Mood = 50 + 15·[has job] − 20·[unemployed adult] − 0.5·max(0, Pol_home −
  tolerance) + 5·friends + 10·[commute ≤ pref] + 10·[Park or Large Park footprint within 4 of home], clamped.
  Recreation uses the existing square home-radius test, not the current walker
  position. Any tile of a 3×3 Large Park (or legacy 2×2 park) counts; Zoo prisons
  do not. NO_PARK wishes explicitly name home, and their remedy names both parks.
  Approval = mean mood.

### 7.6 The roster (weights, never gates; two soft home preferences that fall back in the same arrival pass)
| species | life (y) | litter | fertile | retire | job pref C:I | Pol tol | home pref | commute | arrival weight reads… | signature event |
|---|---|---|---|---|---|---|---|---|---|---|
| Rabbit | 40 | 3 | 16–30 | 35 | 0.5:0.5 | 40 | any | 24 | parks, trees | Rabbit warren |
| Mouse | 30 | 4 | 16–24 | 26 | 0.4:0.6 | 60 | High lots | 16 | tier-3 R vacancies | Mouse boom |
| Fox | 60 | 2 | 18–40 | 50 | 0.8:0.2 | 30 | LV ≥ 50 (strict search, then lenient, same pass) | 32 | high-LV vacancies | Fox market fair |
| Beaver | 55 | 2 | 18–40 | 48 | 0.2:0.8 | 70 | water within 6 | 28 | I jobs, water | Beaver dam |
| Owl | 70 | 1 | 20–45 | 60 | 0.6:0.4 | 40 | trees within 3 | 30 | trees, zoo | Owl academy (L1) |
| Bear | 80 | 1 | 20–45 | 65 | 0.4:0.6 | 50 | Low lots (strict search, then lenient, same pass) | 40 | low-density R, trees | Bear winter |
| Tortoise | 150 | 1 | 25–80 | 120 | 0.5:0.5 | 50 | any | 8 | base | Centenary |
| Raccoon | 35 | 3 | 16–28 | 30 | 0.6:0.4 | 80 | any | 20 | mean pollution | the smog readout with a face |
| Pig | 30 | 5 | 14–24 | 26 | 0.2:0.8 | 90 | water within 6 (mud) | 16 | I jobs, dirt | Truffle season (+§2,000) |
| Cow | 45 | 1 | 18–35 | 40 | 0.4:0.6 | 60 | Low lots + a park (pasture) | 20 | parks, Low vacancies | Dairy fair |
| Wolf | 50 | 3 | 18–40 | 45 | 0.5:0.5 | 50 | trees within 3; arrives as a PACK of 4–6 | 40 | woods, a prey-rich town | Wolf moon |
| Cat | 35 | 3 | 14–28 | 30 | 0.8:0.2 | 40 | flats (tier ≥ 2) | 24 | high-LV vacancies, shops, mice | the mouse's other problem |
| Hawk | 40 | 2 | 16–35 | 35 | 0.6:0.4 | 30 | High lots (towers) | 64 | tier-3 vacancies | sees the whole city |
| Skunk | 30 | 4 | 14–26 | 27 | 0.4:0.6 | 95 | trees within 3 | 20 | woods, dirt | nobody's prey; stinks (mess 1.0); only pigs and raccoons will sit next to one (affinity 0.5 for everyone else); the Skunk incident |

**Predators and prey (the owner: "there is also a notable absence of predator species.").**
`PREY_OF`: rabbit ← fox, wolf, hawk; mouse ← fox, owl, cat, hawk; pig ← wolf;
cow ← wolf. Three rules, all weights and mood terms, never gates:
- a predator–prey pair is *wary* (affinity 0.4) — such friendships form slowly;
- **prey flight**: a prey citizen loses 10 mood per predator species living
  next door (Chebyshev 1) — unless someone in its household is FRIENDS with
  that species. The bridge is a friendship, never a wall;
- a predator–prey friendship counts **twice** in H, the Zoo City index. The
  wolf befriending the rabbit is the town's proudest statistic.
**Pig mess (the owner's rule):** every pig adds 1.5 to its home lot's emission
over 1 tile — a full tenement of pigs smells like a small factory — and
raccoons' home preference is *dirt* (+12 for a lot with Pol ≥ 15), so the
raccoons settle beside the pigs. They are allied (affinity 1.0) and both
tolerate the smell (90 / 80); everyone else moves away from the block.
Livestock and predators arrive by weight like everyone else (pigs follow
industry and dirt, cows follow pasture, wolves follow woods and a prey-rich
town, cats follow shops and mice, hawks follow towers); wolves arrive as
packs of 4–6 and take a whole townhouse.

`fit_s(city)` reads what the player built: I jobs → beavers; tier-3 R
vacancies → mice; LV ≥ 50 vacancies → foxes; mean Pol → raccoons; trees +
zoo → owls; parks → rabbits; Low R + trees → bears. The species histogram is
a readout of the player's own choices.

### 7.7 Cost
2,000 citizens: O(P) birthdays/mood; ≤ 64 BFS job searches per tick; 200
friendship samples. Target ≤ 3 ms per tick in Node.

---

### 7.8 Use-zoning — the player's line (`use[i]`; `species.admits`; docs/PROPOSAL-ZONING-RAIL-WALLS.md §2)

The owner: *"zoning allows areas to be designated as being for predators,
prey, or mixed use. mixed use is the default, but players who want a more
granular control of their city have the option to control it"* and, later,
*"ideally this should be a list of check boxes, so you can have things zoned
for multiple things at once."* Tool `U` opens sixteen checkboxes: predator,
prey, rabbit, mouse, fox, beaver, owl, bear, tortoise, raccoon, pig, cow,
wolf, cat, hawk and skunk. No checks means mixed. Otherwise `admits(use,
species)` is an **OR**: a citizen matching any checked group or exact species
is admitted. Predator means the hunters (diet carn: fox, owl, wolf, cat,
hawk); prey means everyone else — omnivores are nobody's hunter and live on
the prey side. A rectangle brush paints the selected 16-bit mask on lots and
roads (§1 a changed tile; one undo step). **A gate, on purpose** — it is the player's line,
not the species' preference (§7.6's "weights never gates" is about what
species want): `vacantLots` and `searchJob` skip what does not admit, so
every arrival, move-out, rehome and hire goes through it. A lot repainted
against its occupants gives the household `ZONED_OUT_MONTHS` 3 of notice
(`hh.notice`, saved), then rehomes within 12 road tiles under the gate or
leaves town ("ZONED OUT — …", `last.zonedOut`); its workers are released at
the next tick's stale pass and search again. Nobody moves in the month of
the click. **Commutes prefer the legal way:** the search is Dial's buckets
(`fields.dial`, integer costs: a step `WALK` 9, a step onto a forbidden road
`TRESPASS_STEP` × `WALK` = 54), so a citizen detours up to six times longer
before it trespasses and trespasses when that is the only way to work. With
no line every step costs the same and the settle order is the BFS's, so the
paths — and the traffic — are the ones the BFS made; the suite holds every
commuter's path tile-equal to `roadPath`. `save.rebuildDerived` uses the
same search, so a loaded city takes the roads the live one took. The `O`
overlay's `use` mode retains predator rust and prey teal, gives every species
a stable tint, and averages checked tints for a combined mask; the card names
the exact checks and every admitted species.

### 7.9 Rail (`rail[i]`; `fields.dial` two layers; docs/PROPOSAL-ZONING-RAIL-WALLS.md §3)

The owner: *"rail … shortens commute times, lightens traffic, and allows
neutral travel (as long as predators don't exit the train in a prey only
zone)."* Tool `7` lays rail like a road (an L-drag, §20 a tile, §3 a year;
grass or trees, across a wall — a tunnel; square-on across a road — a
**level crossing**, below; water creates a **rail bridge**, §60/tile and §16/year).
Bridges carry the existing commute/freight rail layer, with no pedestrian boarding
on the span. Any rail mask is supported, as with road bridges; isolated spans
can be extended to shore later. Road bridges and rail bridges cannot share tiles.
Raised deck artwork is rendered at both resolutions and riders sit at deck height.
Demolition, undo and saves preserve the water beneath the track. Beaver ponds
exclude rail, stations and walls. `8` makes a **station**
of a dry rail tile (§300, §100 a year). A station is **served like any lot**
(§6c): its doors are every road tile at its road distance, up to
`ROAD_REACH` 3, and the walk layer crosses the forecourt between them one
tile at a time (the card says which sides, and how far). Until session 15
the graph stepped onto a platform only from a tile ORTHOGONALLY beside it,
which is the d = 1 case of the same rule. **The commute graph has two layers:**
walk nodes on road tiles and station tiles (a step `WALK` 9, ×6 onto a
road the line forbids), ride nodes on rail tiles (`RAIL_COST` 2 a step —
2/9, or 0.22, of a walk); the layers meet only at a station (board and alight, free).
`dial` settles nodes in cost order; with no rail and no line it is the BFS
node for node. **The stored path** carries the ride bit (`fields.RIDE`, bit
15 of the `Uint16`) on the tiles the citizen rode onto; a station collapses
to one WALKED entry whether the animal boards or alights there, so
"predators don't exit the train in a prey only zone" is the same rule as any
forbidden tile. **The level crossing.** The owner: *"railroads and roads
should be able to cross over each other perpendicularly."* A road and a line
share ONE tile when they cross SQUARE-ON: after the op that tile's road runs
straight on one axis (mask `N|S` or `E|W`) and its line straight on the
other. The masks are judged AFTER THE WHOLE DRAG, never tile by tile — an
L-drag's own arm is half of what makes its road straight, so a per-tile test
would refuse every crossing a player ever draws. Never on water or a bridge,
never under a wall (a tunnel is open along ONE axis; a crossing has two),
never a station (the platform stands on the track). A drag that stops ON the
line is refused at the line and lays the rest, the way any blocked tile in an
L-drag behaves; a drag that runs ALONG the line lays nothing and gives the
reason, because parallel is not square-on. Because a drag's own legs judge
each other, the pass **repeats until it settles**: a tile refused for running
along the line was counting toward its neighbour's mask, and the crossing at
the corner must not be condemned by an arm the same op is throwing away.
**A crossing KEEPS its two straight runs**, and that takes a second clause,
not a corollary of the first: an op is refused when it would leave a
NEIGHBOURING crossing crooked — a road one tile along the line is square-on
on its own tile and still makes a T-junction of the crossing beside it. The
one thing that can take square-on away is the **bulldozer** removing a road
or a line beside a crossing; no rule can stop that without trapping the
player there. So a crossing may be left crooked, the art draws the stub it
has become (which is why the family is 512 tiles and not four), the graph
does not mind, and while it is crooked the only ops allowed beside it are the
ones that make it square-on again — or one press of the bulldozer on the
crossing itself, which clears the line and leaves a plain road. **The graph needed no
change:** `dial` walks any road tile and rides any rail tile and the layers
meet only at a station, so an animal crosses on foot at `WALK` and a rider
passes straight through at `RAIL_COST`, and nobody boards or alights there (a
crossing is `rail` 1, never 2). It is the first tile in the game that is a
walk node AND a ride node, so a stored path may name it TWICE — ridden
between the stations, walked back to a door; `computeTraffic` counts the
walked entry and not the ridden one, as it does everywhere. **It is a road
and a line, and pays for both:** `roadDist` seeds from it and `hasAccess` is
true on it (a lot's door may sit on a crossing — said here rather than
forbidden); the ledger charges `UPKEEP_ROAD` **and** `UPKEEP_RAIL`; the air
takes `EMIT_ROAD` with its traffic term **and** `EMIT_RAIL` — a ruling, not
an accident: both things are on the tile, so both are maintained and both
smoke. The bulldozer takes the LINE first (the cheaper, later layer) and
leaves the road; a second press takes the road; one undo step each. The
owner's three verbs, one line each: *shortens commute
times* — `commuteTime` (a walking segment 1, a riding segment 2/9, never
the trespass penalty) sums the integer costs and divides by `WALK` once, so
an exact threshold stays exact; it is what the mood's `≤ species.commute` reads;
*lightens traffic* — `computeTraffic` counts walking entries only, and a
rail tile emits `EMIT_RAIL` 1 flat with no traffic term; *neutral travel* —
`exposure` counts walking entries only. `RIDE_SPEED` is derived as
`WALK / RAIL_COST`, so walkers ride at ×4.5 — 50% faster than the former ×3 —
and sit 3 px up on the train (no train sprite in v1 — BACKLOG).

### 7.10 Lives and remembrance

Every citizen carries `life`, at most twelve compact triples
`[tick, kindId, arg]`. The first two chapters are pinned; the remaining ten
are the newest chapters. Creation, homes, work, friends, family, retirement,
justice, centenaries, and zoning all write through `life.remember`, which also
publishes the current month's `world.lifeEvents`. `lifeLines` is the sole
sentence writer: years begin at 2000, lots are coordinates with the family
living there now, and citizen ids resolve through the living roster before
the graveyard.

Every citizen who leaves the roster is reduced once to a permanent, versioned
shorthand row in `world.legacy`:
`version|id|first|surname|species|born|end|cause|origin|lastHome|household|flags`.
Numbers use base 36, common causes and species have frozen compact codes, and
names/unknown causes are URI-escaped. `legacyOf` is the one decoder/resolver;
it also migrates old object-shaped `world.names` graveyards at load without
duplicates. `compact()` never expires or rewrites civic memory. A seed-7
30-year town keeps 1,653 former citizens in 70,103 shorthand bytes (42.41
bytes each; 75,063 bytes including JSON syntax), while its live citizens use
375,871 bytes and the whole save 760,099 bytes. A 10,000-record stress archive
is 482 KB of JSON and builds in about 30 ms on the check host.

`world.deaths` remains a bounded `[tick,id]` ring for the trailing year, and
`memorial(world)` joins it to the permanent archive. Saves omit default-valued
citizen fields and restore them from the same defaults used at creation; the
canonical state hash retains the expanded citizen shape and non-empty archive.

## 8. Budget (`js/sim/budget.js`), integer §, monthly slice of yearly figures

```
income/yr  = rate_R · Σ_citizens (0.5 + LV_home/100) · 1.0  +  rate_C · Fc · 1.5  +  rate_I · Fi · 2.0
upkeep/yr  = 12·P + 5·roads + 12·bridges + 4·Σ lot tiers + 300·parks + 1500·zoos + 400·stations   (rules.js is the measurement; this line follows it)
monthly: post('tax', round(income/12)); post('upkeep', −round(upkeep/12))
```
Costs: zone R §5 / C §8 / I §8 per tile; road §10; bridge §40; bulldoze §2
(tree §4); plant tree §4; park §150; zoo §2,500. Cash < 0: no building.
Cash < −10,000: **Receivership** — rates forced to n+2, building frozen until
cash ≥ 0, grey banner. A failure state with a wait-it-out exit, never a game
over. The Rules tab prints net/yr so greed is visible: 13% nets more cash
while the city shrinks — the Tax Revolt carries a cash cost so the treasury
argues back.

**The cheat.** OPTIONS on the title screen (§11) unlocks a GIVE ME CASH
button, beside the treasury and on the panel. Each press is an op,
`{ kind: "cheat", amount }`: `budget.post` books it under the ledger key
`cheat` (still the only cash path), the input log records it, the suite
replays it to the same hash, it never touches the undo stack, and the
amount is clamped to `CHEAT_MAX`. A press that brings cash back to ≥ 0
lifts a receivership at once, through the same `exitReceivership()` the
budget tick uses. The switch is a browser preference (`zoo.pref`, §15),
never a field of the city: the sim never reads it; a city carries only the
ops, and the Budget tab's ledger says how much of the treasury came that way.

---

## 9. Events (`js/sim/events.js`)

One roll per tick with p = 1/30 from the armed roster (weights); disasters
never chain within 12 ticks; a "No disasters" toggle masks only disaster
kinds. Timed effects are `{id, until, params}` structs saved with the city.

| # | event | kind | gate / weight | effect | dig-out |
|---|---|---|---|---|---|
| 1 | Fire | disaster | w3 × season × **exposure** (§9b) — ×1 uncovered, ×1/6 covered end to end; ×2 Jun–Aug | starts on a built lot (covered lots at 1/6 weight); burns 2 ticks (1 if covered); each tick spreads to 4-neighbour built lots p 0.3 (0.1 if covered; never across road, water, park); on burnout a covered lot is SAVED at p 0.7 (−1 storey), else → rubble for RUBBLE_MONTHS, zoning kept; households displaced | wait — rubble clears itself in 6 months and the plot rebuilds; bulldoze §2 to be impatient; a fire station |
| 2 | Flood | disaster | w2, needs water | tiles within Manhattan 3 of water flood 4 ticks; lots there −1 tier; parks immune | the floodplain has the best LV: that is the tension |
| 3 | Tornado | disaster | w1 | 12-tile straight path; lots → rubble (which clears itself in RUBBLE_MONTHS), trees felled, roads survive | wait, or bulldoze §2 each |
| 4 | Beaver dam | mixed | beavers ≥ 12% and water; w2 | a 2×2 pond appears beside the river; adjacent lots −1 tier once; permanent nature (+LV) | rezone around it or bulldoze §40 (beavers' mood −20 for a year) |
| 5 | Smog bank | disaster | mean Pol > 35; w2 | Pol +25 for 6 ticks; raccoon arrivals ×2 | trees, parks, thin the I belt |
| 6 | Mouse boom | boon/bust | mice ≥ 35%; w2 | births ×3 for 12 ticks | zone R ahead |
| 7 | Tax revolt | disaster | any rate ≥ n+4 for 12 ticks; w4 when armed | 8% of households leave in one tick as a visible column to the edge road; −§ (2% of cash); approval −20 | cut rates |
| 8 | Bear winter | seasonal | every December if bears ≥ 10% | bears leave W for 3 ticks; upkeep −20% those months; bear walkers vanish, return in March | zone a little extra R |
| 9 | Boom | boon | w3 | ext ×1.3 for 12–24 ticks | zone I and R ahead |
| 10 | Recession | disaster | w2 | ext ×0.6 for 18–30 ticks | cut rates 2–3 points for the duration |
| 11 | Fox market fair | boon | foxes ≥ 10% and any C tier ≥ 2; w2 | V_C +0.4 for 6 ticks; +§1,500 once | zone C near R |
| 12 | Rabbit warren | boon | rabbits ≥ 25% and parks ≥ 2; w2 | births ×2 for 12 ticks | zone R ahead |
| 13 | Founders' festival | boon | ≥ 5 species each ≥ 5% AND H ≥ 0.5 AND friendships ≥ P/4; once per 10 years; w6 armed | Cap +200 PERMANENTLY; mood +15 for 12 ticks; plaza glyph on the central park | the only permanent cap relief money cannot buy |
| 14 | County grant | boon | cash < 2,000 and approval ≥ 50, none in 10 years; w3 | +§5,000 | rewards a liked but poor mayor |
| 15 | Tortoise centenary | boon | a tortoise reaches 100 | LV +8 within 3 of its home, permanent; hat on the walker; plaque in the card | none — the city's memory |
| 16 | Scrubbers offer | CHOICE | I lots ≥ 15; w2 | card pauses the sim: pay §1,500 → all I emissions ×0.7 permanently, or decline | the one event that asks a question |
| 17 | Receivership | state | cash < −10,000 | see §8 | wait it out |
| 18 | Truffle season | boon | pigs ≥ 15% and trees ≥ 8% of the map; once per 5 years; w2 | +§2,000 | keep some woods |
| 19 | Dairy fair | boon | cows ≥ 15% and parks ≥ 2; w2 | V_C +0.3 for 6 ticks; +§1,000 | zone C near the pasture |
| 20 | Wolf moon | mixed | wolves ≥ 10%; w2 | 3 ticks: prey flight doubles for wolf-prey, friendships form ×2 | the month the town mixes |
| 21 | Heist | disaster | a shop with crime > 70 and a fox/raccoon/cat in town; w3 | −§100·tier, the shop loses a storey; the thief is named | a police station within 6 |
| 22 | Skunk incident | mixed | skunks ≥ 5% and any predator; w2 | every predator species −15 mood for 3 ticks; the sprayer and the sprayed are named | none — it is the skunk's whole point |

L1 (labelled, not started): road rot, owl academy, wedding, fire station,
school.

---

## 9b. Services — fire and police (`js/sim/fields.js`, `events.js`)

The owner: *"police and fire is noticeably absent."* Two 1×1 civics, §500
each, §400/yr each, four C-type jobs each, effective only where `served`
(§6c) — unchanged in effect for a 1×1, and now the same sentence as every
other rule in the game.

```
fireCov(i)   = 1 within Chebyshev 6 of a fire station
exposure     = mean over BUILT lots of (fireCov ? 1/6 : 1)      — fields.fireExposure()
               THE FIRE CARD'S ROSTER WEIGHT IS w3 × season × exposure, so covering the town makes
               a fire RARER and not merely differently placed: ×1 uncovered, ×1/6 covered end to end.
               The same number picks the lot it starts on. One implementation, two questions.
               A fire on a covered lot burns ONE month (else two) and spreads at 0.1 (else 0.3),
               and when it burns out the ENGINE IS THERE: p FIRE_SAVED 0.7 the building is saved and
               loses ONE STOREY instead of the lot (a tier-1 shed comes out gutted at tier 0 — clear
               ground, not rubble). Off a beat, or on the unlucky 0.3, the lot goes to rubble.
               The month's outcome is published on world.fires {saved, razed}: per-tick, never saved,
               never hashed (a fire that is put out leaves no mark to count).
policeCov(i) = 60 within 3 of a police station, 30 within 6 (max over stations)
crime(i)     = clamp(40 − 0.5·LV + 0.4·animals in the 3×3 + 40·(U/W) + file stains (capped at
               FILE_CRIME_MAX 25 — a street where three things happened is a bad street, not three
               bad streets) − policeCov, 0, 100)
               (Micropolis: 128 − LV + density − police; 0 on empty unzoned tiles)
crime > 60   → LV −10 on that tile; a C lot's local score −0.2 ("shops need safe streets")
mood         −= 0.3 · max(0, crime_home − 40)
HEIST        event (w3): a C lot with crime > 70 and any fox / raccoon / cat in town →
               −§100·tier, the shop loses a storey, the thief is named
```
Unemployment is counted inside `computeCrime` rather than read from the
census so a loaded city and the straight run agree (the save/load hash law).
The crime overlay (`O`) shows crime in red and police cover in blue; the
hover card prints crime and both covers; the Rules tab has S1–S3.

## 9c. Crime and punishment — zone M, the killing, the file, the centre (`js/sim/justice.js`, `fields.js`, `events.js`)

The owner (2026-09-02): *"lets think about how we can add predation to the
game as part of crime. perhaps with a custom zoned commercial space for grey
market meat markets. herbavores do not like living near meat markets, it
should have a similar negative devaluing as industrial, but perhaps even
stronger."* — *"lets add a pacification center … fixed animals cannot have
offspring and are no longer interested in attacking prey. prey can also be
pacified if they are caught in a crime … a 5% chance that the police arrest
the wrong person."* — *"multiple offenses should send the citizen to the meat
market … a better first stop for prey who commit crimes. 1. crime should be
weighted by unemployment, no jobs means hungry wolves. 2. no, random based
on proximity. i think it should be possible for prey to murder too, but just
much less likely. 3. yes."* Designed by two panels
(`docs/PROPOSAL-CRIME-AND-PUNISHMENT.md`), built as stated there with the
rulings applied. Every constant is in KNOBS; the rules tab has M1–M6, K1,
P1–P3.

```
DIET     herb = rabbit, mouse, beaver, tortoise, pig, cow · omni = bear, raccoon, skunk · carn = fox, owl, wolf, cat, hawk
         (fox and owl hunt without the `predator` flag, which stays the skunk-incident gate)

ZONE M   key M, "Meat", §12 a tile, drag-zoned; tiers stall / meat hall / cold store, M_JOBS [0, 3, 8, 16];
         its own valve rM = clamp((0.06·carnivores + 10 − Jm)/max(Jm, 20), −1, 1), T_M = T_C — a 1,600 town wants ~72 hall jobs;
         Jm ∈ J and Lab, ∉ Jc (no crowd-out of shops); local_M = 0.6·clamp(carnivores within 5 / 40 − 0.5, ±0.3) + 0.4·(50 − LV)/200
         + 0.20·min(1, stock/8);
         maxTier 3 like I; staffed by diet JOB_M {carn 0.9, omni 0.5, herb 0.1} (a weight — pigs and beavers, jobC 0.2, will walk to one)
DREAD    world.dread (derived): a hall spreads [0, 40, 70, 105] × (0.5 + 0.5·min(1, stock/8)) over radius [0, 2, 3, 4]
         (the pollution shape); LV −= 0.8·dread
         → a tier-3 hall −84/−67/−50/−34/−17 LV at d 0..4, exactly twice a works (−42/−34/−25/−17/−8)
         herbivores: mood −min(25, 0.25·dread) (halved with a carnivore friend); home score −dread; arrivals ×(1 − 0.3·min(1, halls/3));
                     REHOME: a herbivore household at dread ≥ 40 moves along the road (≤ 12 tiles) at 3%/month, to a lot with less dread
         carnivores: +5 mood inside the smell; home score +0.8·dread (net 0 — they do not mind); arrivals +0.3·min(1, Jm/40)
         omnivores: nothing. NOT pollution (pollution pulls raccoons and pigs and refuses R growth — the rule is herbivore-specific)
CRIME    crime += a hall's [0, 10, 18, 25] over [0, 1, 2, 3] (×0.5 licensed) + 15 within 2 of every open FILE
         + 3 per unemployed adult in the 3×3 (a carnivore ×2)   ← "no jobs means hungry wolves", counted from live state
MONEY    unlicensed: the CUT, §25 per filled M job per year, ledger "cut", untaxed; a killing bought by a hall +§50; a convict sold +§100;
         meals are §20/unit to "cut" unlicensed, or the C-rate share to "tax" licensed — every cash change uses budget.post
         LICENCE (offered deterministically the month the first hall reaches tier 2; §2,000 + §400/yr per hall): M jobs taxed at the C rate,
                 the crime hill ×0.5, the buyer's pull ×0.5 (3 → 1.5); the smell is unchanged
         RAID (a BOON kind so the No-disasters toggle never masks it; w3; cooldown 24): an unlicensed hall with police cover, crime > 50
                 and staff → a storey shut, +§200·tier fines, the last hired named and a file opened on them
         THE GREENS' LEAGUE (w2, 6 months): herbivores ≥ 40% and a killing's file standing → V_C −0.3, herbivore mood +5

THE KILLING (justice.js killingTick, every month, before the files):
         Σ = Σ over adults of KILL_DIET {carn 1, omni 0.1, herb 0.03} × 20 if unemployed × 3 with a non-full hall in H service reach (1.5 licensed)
             × 2 if on a hall's staff × (0.5 + crime at home/100); fixed, held and cubs 0
         killings this month k = floor(0.00005·Σ + rng) — drawn once wherever an adult lives (the baseline hash moves; see §4)
         killer = weighted pick; victim = weighted pick of adults within Chebyshev 3 of the killer's home (not the household):
                  the killer's prey ×1, anyone else ×0.1, a friendship (the killer's, or of the killer's kind) ×0.1; none → nothing
         → removeCitizen "killed"; the funeral rule (mourners ≥ 3 befriend at the wake; grief a year for mourners and household);
           the victim's species −15 mood city-wide for 6 months; −§200 inquest; a FILE at the victim's home; the line names both
THE FILE events.files [{tile, radius 2, crime 15, opened, until +24, culpritId, victimId, cause, line, closed}] — saved under events;
         opened by a killing, a heist (the thief is now any adult within 4, weighted: unemployed ×3, hot home ×2, fox/raccoon/cat ×2,
         a record ×2), a BURGLARY (once a month over built lots with crime > 60, p = min(0.3, 0.006·hot), −§20·tier —
         a burglary needs NO police station to happen, and the file opens either way because the file is the STREET's
         memory of it; a station buys somebody looking), a raid. INVESTIGATION for 6 months, five rolls:
         p = 0.02 + 0.10·min(1, stations/4) + 0.18·policeCov/60 + 0.05·record, and with NO station in town no roll is
         made at all — nothing is investigated and every file goes cold. The FORCE term is there because the cover term
         is read AT THE SCENE, and a scene is by construction the darkest tile in town: a burglary picks a lot with crime
         above 60, and crime is high exactly where the police are not (measured: 97.4% of scenes at zero cover with one
         station, 44.8% with four). A killing's file that lapses prints COLD and names the culprit; a burglary's prints a
         quieter line that is deliberately not in TICKER_FLASH — the record, not the news
THE WRONG ANIMAL 5% of arrests: any adult within 4 of the file, weighted 1/(1 + d) — no species weight ("random based on proximity")
         the innocent is sentenced like the guilty; the culprit stays; c.wrongful / c.wrongedBy saved; when the real one is later taken:
         EXONERATED, −§500 compensation, the town −5 mood for 6 months, "there is no way to unfix / unsell"
THE SENTENCE lighter crimes → Zoo prison (24 beds), 3 months; trespass 1 month.
         Murder or second theft → pacification (6 beds), 6 months, then fixed.
         Third theft or theft after pacification → reachable non-full meat hall.
         Missing/full destination leaves the case open without a conviction.
         Every conviction increments record; only theft/burglary increments thefts.
CUSTODY  c.held = untilTick (saved), c.heldAt = the prison or centre (−1 only for legacy cells); `c.pen` is the separate market-pen state; the job is released (releaseJob — ONE function for retirement,
         decay, bulldoze, custody); home kept; `absent(world, c) = pen || held > tick` is ONE predicate read by isWorker, computeCrime's inline
         copy, prey flight, births, friendship sampling, the walkers and every pool; mood −15 while held, while a pen freezes the last street mood
FIXED    permanent, saved; no litter (a pair needs two unfixed fertile adults — skipped households count in last.littersLost);
         never a killer; PREY FLIGHT is proportional — flight = 10 × (unfixed adults of that species in the 3×3 / all of them);
         a fixed predator's friendship with its prey rolls at 0.7 (not 0.4) and counts ONCE in H (census.hKnife is the share
         "by pacification"); mood −5 for life; may keep any job, the counter included (the owner: "3. yes")
THE CENTRE CIVIC.CENTRE, 3×3, key V, §1,500, §900/yr, 4 C-type jobs (isCivicEmployer — NOT isStation, which is coverage),
         6 beds counted from heldAt; LV −6 within 2; carnivores −5 mood within 4 (the van); bulldozing it releases the inmates
         unfixed and is not undoable
```

### Meat on hand (Part H, `js/sim/meat.js`)

One unit is one body. A standing M anchor holds at most `MEAT_CAP` 40;
parts of a 2×2/3×3 aggregate into that anchor. The saved identity is:

```
stock = opening + bought + killed + convicted + PEN_YIELD·slaughtered − eaten − spoiled
```

`spoiled` is explicit: stock on a hall that burns, decays or is bulldozed,
block overflow imported from a hand-edited/old state, and the unavoidable
excess when a grown pen animal reaches a full hall. A full hall refuses a
dead body, killing or convict before it becomes supply; no counter or cash
moves. Bulldozing a stocked hall is non-undoable. `meatBalance()` audits the
identity, and stock is consolidated in Number space before entering the
`Uint16Array`, so a block merge cannot wrap.

Pens have an independent custody identity:

```
live penned = opening penned + penBought − slaughtered − penReleased
```

`penReleased` names an animal freed alive by a removed/invalid or down-tiered
hall. A household move, zoning departure or revolt acts only on members
physically at home: an absent pen member is not counted, moved, remembered or
removed, and retains its household and return address until slaughter/release.

`hallReach(world, lot, max)` uses `fields.dial`'s real two-layer physical
path and returns `{hall, door, from, walkSteps, physicalSteps, path}`.
Walking road/platform edges cost one. For this H logistics policy only,
boarding, alighting and every rail edge cost **zero**: an arbitrarily long
ride adds physical path tiles and `RIDE` tags but no measured reach. The
nearest hall is by walked steps, then anchor tile id. A missing station, cut
track, disconnected door, or more than 60 walked steps gives no hall.
Ordinary citizen `commutePath` uses `RAIL_COST / WALK` = 2/9. Land value,
parks, the Zoo, centre/plaque halos and dread never read `hallReach` or Dial:
their distance is geographic/wall-aware and rail gives no distance discount
(rail smoke and a physical rail tunnel retain their separately stated
effects).

Inflows are a reachable killing (+1), a convicted sale (+1), each reachable
natural death bought with `MEAT_BUY_P` (+1), and livestock from the pen.
A full pig/cow household may sell its oldest cub into a reachable pen with
capacity 2/4/8 by hall tier. The named animal remains in its household but is
absent from work, friendship, mood, births, investigation and predation. On
the exact sixteenth birthday it is removed as `slaughtered`, yields two
units, and every remaining household member records `LOST_CHILD` without
grief. Losing the hall frees it alive. Carnivores are assigned to their
nearest reachable hall; saved fractional demand accumulates and integer
`min(stock,demand)` is sold each month. `world.meatTrips` and predation
records transiently carry the exact sim-selected RIDE path to the read-only
cart/sack walkers; they are neither saved nor hashed.

The hall card names on-hand stock, yearly sales, source breakdown and every
pen animal/market date. Census keeps meat units sold separate from
`events.justice.sold` convicts. `EMPTY HOOKS` flashes once per dry spell and
resets on any restock; `THE MARKET` reports once each January.

Measured (`tools/playtest.mjs`, 30 years, rates 8, seeds 7/3/5, disasters off): killings 3–7 per 30 years in a fed town
with no hall; 5–16 with two hall blocks (11–19 halls, ~70 jobs, the cut ≈ §1.4k/yr); arrests 4–9 per 30 years with a station
and a centre (fixed 1–7, sold 2–4, wrongful 0–1 — the 5% is rare at that volume); herbivores within a hall's smell 0–19 of ~750
(the push and the rehome empty the street); a jobless dormitory of 80 sees one killing every ~7 years. Population is cap-pinned
and never moves; read killings, arrests, fixed, littersLost, herbNear.

### 9d. Trespass (`justice.trespassTick`, `fields.exposure`)

The owner: *"i like the idea that citizens could get arrested for being in
the wrong section if the road is not zoned for multi use."* Each month, for
every adult at large: `E` = walking tiles on the commute whose use forbids
the species (a riding step never counts — rail's neutral travel; a station
in a forbidden zone is a walking tile, so "predators don't exit the train in
a prey only zone" is the same rule) + `TRESPASS_HOME` 4 for a forbidding
home or job lot; `p = min(TRESPASS_MAX 0.3, TRESPASS_P 0.02 · E ·
maxCover/60)` — **no police cover, no stop**. The stop is on the spot: a
file opened (cause `trespass`, stain 5 within 1) and closed in the same
`arrest()` call, never wrongful. The sentence is one month in a Zoo prison with a free bed and record++.
Trespass never increments the separate theft counter or escalates through it.
Without a prison bed the case remains open. The pinned citizen card prints
the exposure and the monthly chance.

## 9d. The camera network (`js/sim/fields.js`, `justice.js`, `demand.js`, `ops.js`)

The owner: *"flock style security cameras … placed along roads and
intersections … crime fighting more effective but citizens less happy"*, then
the framing that decides every knob below: *"this is an element of satire,
there is nothing in the game saying that players need to add the meat markets,
police, pacification, cameras. they are arguably an expensive overbearing
element that does little to reduce crime"*, and *"one of the more effective
crime SOLVERS at a social cost, but it doesnt get at the root of crime, the
economic factors that caused one person to break the laws will still be
present when he is gone."*

**THE CAMERA CLEARS. IT NEVER DETERS.** `computeCrime` has no camera term, and
neither does `computeLandValue` or `computeDread`; a check reads those three
function bodies out of `fields.js` and asserts it. The whole feature is one
term in `filesTick`'s arrest probability.

THE TILE `world.cam`, `Uint8Array`, saved (player intent, not derived), in
`TILE_ARRAYS` and elided from the hash while all-zero, so a town that never
buys one keeps the identity it had before the network existed. Only `ops.js`
writes it, as with `road`/`rail`/`wall`.

PLACEMENT key `E`, an L-drag like the road tool, §100 a tile. On a plain road
ONLY: never a bridge, never the rail half of a level crossing, never a tunnel
(a camera under a wall sees the wall). It does not replace the road. A drag
that crosses a street and then a field takes the street and stays silent; only
a wholly refused drag gets a sentence. **The bulldozer takes the camera before
the road under it**, one press, §2 — and the road-clearing arm in `apply()`
also zeroes `cam`, so "no camera without a road under it" is true by
construction.

UPKEEP **§2,000 a year for the whole network, flat, however many cameras**
(the owner's ruling). The step is the point: the first camera costs §2,000 and
the fiftieth §100. `budget.js` and `ui.js` carry the row together or the panel
silently absorbs the difference into another line.

COVER `computeCamCover` fills `world.camCov` (derived, never saved). From each
camera, walk **connected road tiles** up to `CAM_REACH` 2 steps and paint each
road tile reached **and every tile within `ROAD_REACH` 3 of it** — the
frontages that street serves — at `CAM_EFFECT` 60 within `CAM_NEAR` 1
road-step and half beyond, keeping the maximum where two overlap. A wall
across the street breaks the sight-line, which is the network's one piece of
counterplay and costs §8.

> **Why the paint radius is `ROAD_REACH` and not 1.** A crime scene is NEVER a
> road tile: `burglaryTick` draws its candidates from `tier > 0` and a road
> has tier 0, and a killing's scene is the victim's home. Measured over seeds
> 7/3/5, 0 of 254 scenes were on a road; a radius of 1 reaches 46.7% of them,
> 2 reaches 86.7%, 3 reaches all of them. A camera marking only its own tile
> would read zero at every scene and the whole lever would be a dead knob.

> **The visited set is stamped with a GENERATION, one per camera.** Stamped
> with anything that repeats — the source tile — the first walk marks the
> neighbours and every later call refuses to expand: the field is right once
> and a single tile's halo for ever after (measured 91 tiles, then 49). One
> generation per camera, not per call: two cameras sharing a set under-paint
> the second, whose near tiles can be the first's far tiles.

CLEARANCE in `filesTick`, and nowhere else:

```
    force = min(1, policeStations / ARREST_FORCE_N)
    if (force <= 0) continue          ← no station, no roll, however watched
    p = ARREST_BASE 0.02 + ARREST_FORCE 0.10·force
      + ARREST_COVER 0.18·policeCov/60
      + CAM_ARREST  0.30·camCov/60          ← the whole feature
      + ARREST_PRIOR 0.05·record            capped 0.95
    wrongfulP = WRONGFUL_P 0.05 + CAM_WRONGFUL 0.10·camCov/60
```

Neither term adds an RNG draw; both move the threshold of a draw that was
already there. A camera-carried arrest prints `IDENTIFIED` (in
`TICKER_FLASH`), which names the camera's tile, whoever was taken — right or
wrong — and how long the file had been open. It does **not** say the file is
closed: a wrongful arrest leaves it open (§9c) and the town does not know
which kind it has just made.

THE BRAKE is **one term in the capacity law** (`demand.js`):

```
    cap = (CAP_BASE 1200 + CAP_PARK 150·parks + CAP_ZOO 500·zoos
           + festivalBonus − CAM_CAP 400·watchedShare) × (1 + CAP_H_GAIN 0.5·H)
```

`watchedShare` is the fraction of **occupied homes** (not tiles) at or above
`CAM_EFFECT/2` cover. The R valve is gated on `P / cap`, so a falling cap
closes the valve and the town plateaus and ages down.

> **It is here because every comparative seam is a no-op under a blanket.**
> `c.mood`'s only consumer is a departure roll gated on `V_R <= 0`, true on 0
> of 1,440 ticks in a balanced town; `bestHome` is a pure argmax, so a uniform
> penalty cancels exactly; a rehome wanting somewhere less watched finds
> nowhere when everywhere is watched. Dread's seams work because a meat hall
> is LOCAL AND FEW. **A global nuisance needs an ABSOLUTE brake.**

MOOD `CAM_MOOD` 12, scaled by cover, is **characterisation and not the
brake** — it exists so an animal can say what is wrong, through the `WATCHED`
needs code (*"a camera watches this door"*) and its remedy (*"bulldoze the
camera on this street"*). **Waived permanently for anyone already burgled**,
the owner's ruling; `VICTIMS` (§9c) is what makes a burglary have a victim at
all.

LAND VALUE is deliberately **not** touched. The symmetry with dread's
`−0.8·dread` is rejected because `computeCrime` reads `− CRIME_LV 0.5·lv`, so
lowering land value would **raise** crime and cameras would increase the thing
they are sold against.

**WHAT IT ALL MEASURES TO** (`tools/camprobe.mjs`, 4 seeds × 30y, one station):

| cameras | 0 | 1 | 2 | 4 | 8 | 10 | 20 | 40 |
|---|---|---|---|---|---|---|---|---|
| solved | 20.5% | 34.2% | 41.5% | 49.2% | 67.3% | 85.3% | 90.4% | 90.5% |
| wrongful arrests | 1.5 | 2.8 | 5.3 | 7.5 | 8.3 | 15.3 | 11.5 | 11.5 |
| exonerations | 0.0 | 1.3 | 2.8 | 3.3 | 4.5 | 8.8 | 9.0 | 8.5 |
| homes watched | 0% | 18% | 35% | — | — | 93% | — | 99% |
| population | 1221 | 1331 | 1192 | 1313 | — | 1053 | — | 1047 |
| mean crime | 39.34 | 39.29 | 39.63 | — | — | 36.98 | 39.88* | 36.84 |

\* the 20-camera crime figure is from the pre-brake sweep.

One to four cameras buy clearance for nothing: crime flat, population fine.
**A blanket costs a fifth of the town** — and its crime falls, 39.34 → 36.84,
not because the camera deters but because a smaller town is less dense. The
accurate statement of the joke is therefore: *a mayor who blankets the town in
cameras lowers its crime by driving a fifth of the animals out of it.*

## 10. Goals and pacing

- **Milestones** (plaque + advisor line, never a fail state): hamlet 50,
  village 200, town 500, city 1,000, metropolis 2,000.
- **The yearly report card** (every January): population, approval,
  native-born share, unemployment, net §/yr, species histogram, **Zoo City
  index** = H (cross-species friendship share), and the city-character line
  from the top-2 species ("a beaver mill-town with a fox problem"). Two
  mayors with the same seed can compare.
- **January advisor lines** (Micropolis SendMessages generalised): need
  R/C/I; need roads (2·lots > roads); taxes above n+3; the citizens want a
  Zoo (P ≥ 800 and no zoo); pollution > 40; cash < 0; "your city outgrew its
  rate" when the neutral line crosses a rate.
- Visible change at ×1: with SPROUT_P 0.25 a fresh 6×6 block shows a new
  building every ~1.5 s; arrivals walk in every tick while V_R > 0.

---

## 11. Zoning UX (`js/tools.js`, `js/palette.js`, `js/input.js`, `js/ui.js`)

The build remote stands left of the map, two columns by eight rows (four by
four below 720 px high). Its sixteen buttons, thumbnails, order, operations,
keys and generated footer help all read the one DOM-free `TOOLS` registry:
`1 R · 2 C · 3 I · 4 Meat · 5 Road · 6 Wall · 7 Rail · 8 Station · 9 Tree ·
0 Park · G Large Park · Z Zoo (prison) · V Pacify · P Police · F Fire station · I Inspect · B Bulldoze`.
The top strip keeps only modifiers and commands: `H` density, `U` Use,
`Space` pause, `, .` speed, `Backspace` or `Ctrl+Z` undo, `Ctrl+S` save-as,
`L` load, `O` overlay, `R` news, `+ −` zoom, `N` new city and `Esc` menu.
WASD and the arrows only pan the map; the news reader steps on arrows, never
WASD. A focused form control owns its editing keys, so Space cannot both
activate a button and pause the city. The `O` overlay cycle is off → LV →
pollution → crime (an open file is a ring) → dread → use (rust predator-only,
teal prey-only) → **access** → score. Access paints `siteRoadDist` (§6c) —
the number the RULE reads, not the tile's own — in five bands: the road
untinted, then three DIFFERENT greens for one, two and three tiles (not one
green at three alphas: a band told apart only by strength stops being a band
on asphalt), then the zot red for out of reach. Like every overlay it is
painted on the GROUND, so a building hides its own tile's band.

- **Zones, trees, bulldoze:** rectangle drag; live cost in the strip
  ("R ×36 = §180"); an unaffordable drag draws the refused hatch and does
  nothing on release; water, roads and civics skipped; trees inside a zone
  drag are felled at §4 each (LV warning in the card). **One undo step** (`Backspace` or `Ctrl+Z`) restores the last op's tiles and
  refunds it — tiles, never people: a bulldoze that turned animals out is
  not undoable (the strip warns before you release), and a road laid over
  empty chalk says how many lots it replaced.
- **Road:** L-drag, horizontal leg then vertical; Shift = straight; over
  water = bridge §40. Auto-join by the 4-bit N/E/S/W mask into 16 tiles;
  busy variant when traffic > 40.
- **Park 1×1 §150, Large Park 3×3 §2,500, Zoo prison 3×3 §2,500:** click-place with a ghost; red ghost when
  blocked.
- **Density `H`:** toggles the brush; painting R/C/I/M with Low sets
  `maxTier = 1`; the chalk shows an inner diamond for High.
- **Hover card** (always live; click pins):
  ```
  (23,41) R High  tier 2  occ 8/10  ▲ growing (V_R +0.31 + local +0.12 = +0.43, p 4.3%/mo)
  LV 62  Pol 14  road 1  traffic 12
  the Burrowes family (4 rabbits) · the Shelby household (tortoise, 2 owls)
  WHY NOT: —                      ← or: no road within 3 / smog 71 > 60 / demand −0.24 (R 12% vs neutral 8.2%) / capacity reached — build a park or a Large Park
  ```
- **Demand bars:** three bars −1..+1 with the neutral-rate line and the cap
  tick drawn; they ARE V_R/V_C/V_I.
- **Tabs:** Rules (every equation with live numbers substituted, gridlands
  style), Budget (three rate steppers 0–20, income by zone, expenses by line,
  net/yr), Census (population, species histogram, unemployment, friendships,
  H, approval, milestones), News (the city's own dispatch feed, chronological
  — the last 120, opening on the newest and following it; §11b).
- **Zots** above a lot that wants to grow but cannot: no road, smog, no job,
  no demand.
- **The title screen** (`js/title.js`): the owner's painting
  (`img/titlescreen.png`, 1424×848, "center top / cover") under the name in
  letter-spaced type, five buttons on a parchment bar (NEW GAME · CONTINUE ·
  LOAD · SAVE · OPTIONS) and one card for the panels, which are the
  new-city dialog's own builders (`foundForm`, `savesPanel` in `ui.js`) so
  `N` and the title never drift apart. LOAD and SAVE are two entries to the
  same panel (`L` focuses the slot list; `Ctrl+S` focuses the save-as name). It
  stands at boot over whatever boot resumed — CONTINUE names the slot, and the "paused; Space
  resumes" flash fires when the map is actually seen — and returns on `Esc`
  (a drag or a pinned card is cleared first) or the strip's `menu`. Under
  it the clock is stopped (`modalOpen()` counts it) and the map is not
  drawn; a flash sent while it stands lands on its note line and is
  re-flashed on the map when it closes. A fresh default map behind it is
  not in play until NEW GAME founds one (`app.entered`): CONTINUE and SAVE
  stay off and no autosave of an untouched map can shadow a real city.
  OPTIONS: the cheat switch (§8) and the per-city no-disasters toggle (the
  same `toggle` op the found form uses).
- **Screen layout:** the map viewport fills the remaining window between the
  build remote on the left and the 300 px field-guide panel on the right;
  command strip above; bars top-left over the map. `renderer.resize()` reads
  the canvas's actual post-layout box. Integer zoom ×1 / ×2. Minimap is L1.

---

## 11c. Citizen Inspect (`js/follow.js`, `js/input.js`, `js/ui.js`)

Inspect binds to a stable citizen id, never to the temporary walker picture.
`pinTarget(world, walkers, id)` is DOM-free and read-only: a visible walker is
`walking`, a resident between walks is `home`, custody, a market pen, bear
winter and an unsettled citizen are `away`, and a removed citizen is `gone` at
the last recorded home with the archive epitaph. Duplicate walker inputs use a
stable semantic order. Clicking a walker or a linked name pins that citizen;
clicking bare land still pins the lot; Esc, world replacement, or the next
selection clears the prior pin. The existing canvas thought bubbles remain
screen-space pop-outs beside walkers and still appear only under Inspect.
When a linked name is clicked in the side card, its walking citizen alone
keeps that in-world pop-out even while the pointer is over the card.

The citizen card paints the stable 16×16 portrait through
`render.paintPortrait`, then shows name/species/age, household, home, job,
mood, current state/activity, the exact `needOf` want with `voice.line` and its
`ACT` remedy, linked living friends, and the latest four `lifeLines`; a native
`details` disclosure reveals earlier retained chapters without rebuilding
inside a tick. House cards link every resident and show the household's leading
need. The Census recent memorial links each trailing-year death to its record.
If the citizen later dies or departs, the same pinned id becomes a
permanent civic-record card rather than disappearing.

---

### Favourites and camera follow

Citizen cards and Census → People provide Star and Follow buttons. Favourites
persist in `zoo.pref.stars`, keyed by city name and seed; they are excluded from
city exports and simulation identity. Archived or unavailable IDs remain removable,
including when loading an earlier checkpoint. Recorded `world.lifeEvents` for
starred citizens produce personal UI toasts, without creating news rows. This does
not promise notifications for every death: only events on that biography bus.

Follow uses the real walker when visible and its stable citizen location otherwise.
The display sampler attends that citizen first. Camera motion normally approaches
at four tiles/second, with catch-up keeping fast rail targets within three tiles
before map-edge clamping. Pause/modal freezes camera movement. Drag, pan, map
selection, a build tool, death/departure or world replacement cancels following;
explicit Stop retains the pinned card. Existing F (fire) and WASD keys are unchanged.

## 11b. The news (`js/news.js`; the News tab and the strip button in `ui.js`)

The owner: *"i'd like a news button, something where you can read the updates
that pop up on the screen in a sequential order."*

- **Why it was needed.** Measured over four seeds × 30 years, same layout:
  **74–84% of a city's dispatches never popped up at all.** Only
  `TICKER_FLASH` lines do, and they are 16–26% of the log; the rest lived
  only in a buried, newest-first tab. Separately `flash()` OVERWROTE itself —
  a month with four headlines showed the last — which is a real fault but a
  rare one, about one headline lost per thirty city-years in a scripted town.
  Expect it to matter in a crime-heavy city, where the sentence table can put
  SOLD, TAKEN IN and CELLS in one month. (handoff §13 has the table.)
- **One feed.** `newsRows(world)` is the single implementation (§0.6): it is
  `world.events.log` read where it lies, plus the reading — the month's
  label and which chip a row answers to — and no positional field at all, so
  nobody is tempted back into naming a row by its index. It is capped where
  the city caps it: `tick.js` keeps the last 400 lines and `save.js` the last
  200, so a long city's founding years are GONE, not hidden.
  Nothing is accumulated beside it, so a live session and
  the same city reloaded are the same document. The panel used to keep a
  second copy AND synthesize a yearly REPORT line out of `world.history` on
  load — a line the advisor already logs (tick.js) — so **every loaded city
  printed each year twice**, with two different net figures because the two
  were computed from different books. There is one narrator, and it is the
  richer one: the line the city actually said at the time.
- **A row's name is its words, never its place**: old/plain rows retain
  `keyOf(r) = t.fnv32(text)`; a named row adds its stable story id and sorted
  `who` ids to that hash. Thus two different citizens with identical printed
  obituaries do not share a read mark. The 400/200 cap may cut a month in
  half without rebinding either kind of row.
  tick.js caps the log at 400 and save.js keeps 200, so a roll can cut a
  month in half; a positional name would come back bound to its neighbour
  and every read mark in that month would point at the wrong dispatch.
- **The read mark is a SET of names in `zoo.pref`.news[city]** — this
  BROWSER's, never the city's; the sim must not know it exists (§0.4, the
  law the cheat obeys the other way round: a cheat is an op because it
  changes the city; being caught up on the news changes nothing). A set, not
  a high-water mark: under a filter you skip stories on purpose, and a
  high-water mark would swallow every one you stepped over. Pruned to the
  live feed on every write — 177 dispatches cost 2.6 KB. First sight of a
  city in a browser starts you CAUGHT UP: a loaded 40-year city must not
  open with a badge of 300 things you lived through.
- **The reader** (`R`, or the strip's `news`): the feed oldest first, a
  cursor stepped with ← → and ↑ ↓, PgUp/PgDn by ten, Home/End,
  `mark all read`, and five chips: all · headlines (only what popped up over
  the map, `TICKER_FLASH`) · trouble (`TICKER_BAD`) · good (`TICKER_GOOD`) ·
  people (rows carrying a nonempty `who`). WASD belongs only to map movement
  and is swallowed while the modal reader stands (Part P).
  It opens on the FIRST UNREAD — and opening MARKS that row read, so the badge
  drops by one the moment you look. A row is read when the cursor LANDS on it,
  never when it is stepped over, which is why the mark is a set and not a
  high-water line. `Esc`, `R` again, the `×`, or a click on the scrim closes
  it; the clock is stopped while it stands (`modalOpen()` counts it, like the
  title and the choice card).
- **The strip button** carries the unread count and goes ink-filled while any
  stands — the same "this is on" that pause / overlay / zoom use.
- **The News tab** (was Log) is the glance at the same feed: the last 120,
  chronological. It opens scrolled to the newest and follows it, unless you
  have scrolled up to read — then it stays where you put it.
- **A month's run of flashes queues** (`flashRun`): 2.6 s for one, 1.5 s each
  for a run, labelled `(2/6)`, five at most and then `+N more this month — R
  opens the news`. A flash the player caused (a refused op, a save, an undo) preempts
  the run: feedback on what you just did wins.
- **People stories (Part F).** `storyTick`, after justice, is the sole bridge
  from this month's `lifeEvents` to named news rows. Three distinct
  `LOST_FRIEND` witnesses produce one obituary for a natural death or
  killing; sale/slaughter do not. Two parent `LITTER(1)` entries are two
  witnesses to the sim's one ordinary cub and produce no false “litter of
  two”; a declared `LITTER(n>=2)` is coalesced by household using `max(n)`,
  never a sum. The centenary plaque remains gameplay in `events.js`, while
  its one dispatch is written here. Rows save sorted stable `who` ids.
- **Named reports and links.** January recomputes `census.notables` after
  deaths/removals, then REPORT names the current oldest resident and largest
  household. Every rendered name is a real button created with `textContent`:
  it marks that row read, pins the durable citizen id, centres the home (or a
  gone citizen's last home), opens C's card/epitaph, and closes the reader.
  `who` is deliberately editorial—it is what puts a row under People.
  Existing operational rows such as KILLING, BURGLARY, arrest/release, HEIST,
  SKUNK INCIDENT, RAID, BOUGHT and THE PEN save the same ids as `links`: their
  printed citizens are clickable without turning two-thirds of an event-heavy
  paper into the People section.
  `NEWS_ROSTER` generates the primary trouble/good and flash regexes, so a
  roster card cannot silently miss every chip. Ordinary people stories never
  interrupt play; only the structurally tagged `OBITUARY 100 —` flashes.
- **Budget and neutrality.** `newsprobe` retains all emitted rows beyond the
  live cap. Over seeds 7/3/5/11 × 30 years, people rows were 59/990 (6.0%),
  71/1,104 (6.4%), 53/345 (15.4%) and 62/1,111 (5.6%); every id resolved and
  survived the saved tail. Seed 7's 30-year normal hash moved
  `e2352679 → 771239e1`; `stateHashNoNews` stayed exactly `7efe937b`, proving
  that the newspaper is the only simulation-identity difference.

---

## 12. Art (`js/art/*`)

### 12.1 Palette (11 ramps dark→light, shadows cool, highlights warm; accents are a handful of pixels)
| ramp | keys | hex |
|---|---|---|
| grass | m n o p | #3B4A22 #55672D #74863C #96A551 |
| canopy | a b c d e | #1E2A1C #2F4526 #47632F #6B8A3E #9DB255 |
| earth | q r s t u | #3A2A1C #57402A #7A5C3C #9E7D52 #C0A176 |
| water (cycled) | F G H I J K | #122E38 #1A3F4A #23515A #2F6168 #3C7274 #4B807F |
| asphalt | 1 2 3 4 | #2A2C33 #43464F #5C606B #8A8E99 |
| brick (R) | ! @ # $ | #4A2620 #7A3A2E #A8563F #D08A6A |
| concrete (C, civic) | % ^ & * ( | #3F4650 #5B6470 #7C8794 #A3ADB8 #CBD3DA |
| rust (I) | { } [ ] | #4A3214 #7A5420 #A87A2E #D0A756 |
| slate (roofs) | < > ? | #23262B #3D4148 #5A5F68 |
| fur-warm | w x y z | #4A2E1A #8A5A34 #C48D5C #EBC9A0 |
| fur-cool | W X Y Z | #3A3D45 #6E7380 #A6ABB5 #E4E6EA |
| olive (tortoise) | f g h i | #2A2E1B #45492A #62663A #8A8B52 |
| accents | 5 zone-R #5E8A3C · 6 zone-C #3C6E8A · 7 zone-I #A88A2E · 8 fire #E8742A · 9 flame #F2C14E · 0 zot red #C8414A · + eye/shadow #2A2620 · = glass #7FA8C4 · - lit window #E9C158 |

grass mid is LIGHTER than canopy mid (trees read dark against ground) — the
Glades law, kept.

### 12.2 Buildings — box solids per zone × tier (world units: 1 tile = 16)
| zone | tier 1 | tier 2 | tier 3 |
|---|---|---|---|
| R (brick + slate roof) | cottage 11×10×8 + hipped roof (two stepped boxes) + chimney 2×2×4 | 2-storey 13×13×16 + gable step | apartment 14×14×32 + balcony strip + roof box |
| C (concrete + glass) | **the shop pool** (§12.2d): eleven small businesses by the tile's variant byte; kind 0 the corner shop 13×11×10 + awning box (accent) | store 14×14×22 with glass-strip rows | tower 13×13×48 + roof plant |
| I (rust) | shed 14×11×8 + chimney 2×2×14 | factory 14×14×14 + 2 chimneys + sawtooth | works 15×15×20 + chimney 3×3×34 + tank |
Civics: park (low plinth 16×16×1 + 2 tree stamps + bench box), zoo 2×2
(fence boxes on 4 sides, gate box, 3 canopy clumps, a hut box). Overlays:
scaffold (1), fire (2 frames), flood (1), rubble (earth-ramp ground). Four
plans per original family: the first mirrored pair plus two authored plans
(§12.2e). Occupancy lights and majority-species stamps identify the people
in the building without changing its zone ramp.

### 12.2b The blocks — box solids per zone × side (`js/art/blocks.js`; 2×2 plans a, b ∈ [0, 32], 3×3 [0, 48])
| zone | 2×2 | 3×3 |
|---|---|---|
| R | **terrace court** — two three-storey brick wings in an L round a courtyard: a round tree, a bench, path stones, a brick garden wall with gate gaps, a dormer, a chimney each wing | **the towers** — a U of five-storey blocks round a garden with a fountain and two trees; a stair tower a storey taller with a lamp; balcony strips; the garden wall with a wide gate |
| C | **arcade** — a two-storey glass-fronted hall, a glazed pavilion on its roof carrying a clock tower with a white face and a lamp, a colonnade along its front (five posts, a slab, canvas awnings between) | **emporium** — a department store in three setbacks: glass ground floor with awnings on both faces, window bands, a roof sign with lit letters on a bracket, a corner entrance under a canopy, a paved forecourt with two trees and a bench |
| I | **mill** — a long rust shed under a sawtooth roof, a tall brick stack, a water tank on legs, a two-step loading dock, a stack of crates | **foundry** — two sheds (sawtooth · lantern roof), a conveyor bridge between them, three stacks of three heights, a gantry across the yard, a coal heap, a loading apron |
| M | **abattoir** — the meat hall with its clerestory, a windowless cold store, a stall under the striped awning with three hooks on its rail, a fenced pen on sawdust, the sign with its one '$' dot, a chimney | **meat exchange** — a great hall under a lantern roof, a cold-store wing off each end, the striped awning with five hooks, a loading dock with the van, two pens on sawdust, the sign, a chimney |

Built from buildings.js's `KIT` (the same ramps, skins, grains, `walled`,
`flipPlan`) so a block reads as its zone; hub at the footprint's centre;
variant 1 the plan and its stamps mirrored across a = b. The footprint
gate holds (every box in [0, 16·side]²) and the ray audit (§13) runs over
all sixteen. `art.building(zone, tier, variant, side, theme)` — side 2 | 3
returns the block, tier ignored; theme > 0 with side 3 returns that
landmark (§12.2c); until blocks.js registers, a block draws its zone's
tier-3 lot (a wrong picture, never a throw), and an unregistered theme
draws the zone's plain 3×3.

### 12.2c The landmarks — eleven 3×3s, one per roster row (`js/art/landmarks.js`; §3c has the table)

Each is its zone's block with the species' composition on top, built from
buildings.js's `KIT` and blocks.js's `BLOCK_KIT` (the eight families'
helpers: `hipRoof`, `chimney`, `pen`, `sawtooth`, `tank`, `bench`,
`fountain`, `van`, `family`) plus this file's own: still WATER (a pond, a
pool, a trough — the water ramp's middle keys, held still), MUD, COBBLE, a
whitewash (the concrete ramp without its darkest rung), rubble stone, log
courses (`logSkin`: three-unit courses with a dark seam), timber framing
(`framed`: plaster between studs), a round hole (`inRound`), a lamp, a
hive, a bin, a crate, a log, a stepped pyramid cap, a beehive kiln. Nothing
draws a face: the species is in what the animals BUILT. Two variants each
(mirrored), tags `building block <zone> landmark`, names
`<Z>3x3-<key>-<v>`; the footprint gate, the ray audit and the hi-res set
cover all twenty-two. `sheet-landmarks.png` is the contact sheet (roster
order, four to a row).

### 12.2d The shop pool — a tier-1 C lot is one of eleven small businesses (`js/sim/shops.js`, `js/art/shops.js`; session 13, 2026-09-03)

The owner: *"unique low density shops would be a good target."* A Low C
lot stays at tier 1 for good, and every one drew the corner shop. Now the
KIND is a function of the tile's `variant` byte — the per-tile random the
world was founded with, already saved and hashed: `variant & 1` is the
mirror of each specialist shop, `variant >> 1` (0..127) picks the kind, so a street
of low shops is a bakery, a bookshop, a barber, a florist, a pub … the same
ones every time the town is loaded, and NOTHING in the sim changes — no
state, no RNG, every town hashes as it did. Kind 0 is the corner shop, now four plans by `variant & 3` (§12.2e);
the first two are the shop the tier drew before: an old save keeps about one shop in eleven unchanged and
the rest become what they were always going to be. (SimCity 2000's low
commercial: one lot, many small businesses, the pick by position.)

| kind | shop | the tell at 1× |
|---|---|---|
| 0 | corner shop | the plain concrete shop, blue awning |
| 1 | bakery | brick, a round window, the oven's stack, gold-and-white awning, a rack of loaves |
| 2 | greengrocer | a green awning over crates of produce on the step |
| 3 | fishmonger | whitewash over a blue tiled dado, sea-and-white awning, a slab of ice on the counter, a barrel |
| 4 | bookshop | tall and narrow, two storeys, a timber shopfront with a bay window, a lamp on a bracket |
| 5 | barber | salmon-and-white awning, the striped pole, a bench for the queue |
| 6 | florist | a glass conservatory on the front, flower boxes, a green awning |
| 7 | tea room | a cottage with a bay window and a chimney, a porch, two tables with parasols |
| 8 | pub | brick below, timber-framed above, a dormer, the hanging sign, lamps, barrels |
| 9 | ironmonger | rust-ribbed, a ladder against the end wall, buckets, a sign slab |
| 10 | clockmaker | a clock tower on the roof, the face to the street, a lamp on its cap |

Ten new solids × two mirrored variants on the corner shop's footprint
(the door on the side face, END glass on the end, the awning off the lit
face), through `buildings.js`'s `KIT` and `blocks.js`'s `BLOCK_KIT`; the
footprint gate holds for every box (four props that reached b = 16.2 on
the first pass were pulled inside) and the hi-res set twins each.
`art.building(2, 1, variant)` takes the WHOLE byte (render.js passes it
for every lot; every other family still masks `& 1`). WHO KEEPS IT is not
state either: `shops.shopOf` reads `world.majority` (the staff's plurality
species, derived every tick) and the card reads *"tier 1 bookshop — the
Slyfields' bookshop (fox) — tall and narrow, …"*, or *"a bookshop,
nobody's yet"*. `sheet-shops.png` is the contact sheet.

### 12.2e Building character — People E (2026-09-05)

The twelve original R/C/I/M tier families have four pairwise-distinct plans.
Variants 2 and 3 are authored box arrangements in `building-plans.js`, not
mirrors: porches, bays, mansards, balconies and roof gardens; kiosks, clock
fronts, arcades and stepped/twin towers; open sheds, kilns, conveyors, cooling
towers and gantries; hook rails, tiled fronts and chimney halls. The old C3
mirror pair was accidentally symmetric; its roof stack now stands off-axis.
The existing saved variant byte selects `& 3`. The specialist shop-kind
mapping is unchanged: only kind 0 uses four plans, the other ten keep their
mirrored pair. Blocks and landmarks retain their authored paired plans.

All 106 unique building/retail/block/landmark sprites share occupancy lighting
and species marks through `art.building(..., {lit, majority, seed})`.
R fill is occupants/capacity; C/I/M fill is staff/jobs. The renderer reads
the simulation's existing counts and capacities, clamps `floor(4 * fill)`
to 0..3, and never writes them. Each explicitly tagged glass skin changes a
stable subset of its window cells to palette key `-`. Four stable phases
derive from the tile index; the pattern uses world coordinates at both
resolutions. Increasing fill never extinguishes an already lit window.
Painted blue awnings, ice, water and the fishmonger's blue tiles stay unlit.

`art.mark(species)` returns one unique 6×6 stamp for each of the fourteen
species. Each solid recipe records its own wall and roof socket after
mirroring. Socket selection tests candidate wall/roof points against the
solid's depth buffer, so a porch or bay cannot conceal the stamp. R uses
the wall socket and C/I/M the roof; the existing derived `world.majority`
selects residents or staff. Empty lots have no mark. The same description
reaches Inspect through `lotReport.mark`: “a warren door — rabbits live here”.
The marks are small fixtures, not lettering or a replacement of zone colours.

Appearance recipes are cached by base plan, light level, species and phase,
then rerasterised by the existing hi-res path at zoom 2. They are dynamic
building sprites; no ground invalidation or save-format change is needed.
The canonical suite checks all plans at both resolutions, mark visibility
and bounds, monotone glass pixels, cache identity, vacancy and resident/staff
descriptions, and thirty-year display-on/off simulation equality. The sheets
are `sheet-buildings.png`, `sheet-marks.png`, `sheet-building-lights.png`;
`people-e-before.png` / `people-e-after.png` show the same seed-7 June 2020.
Building age now uses saved Uint32 `world.since`: construction/expansion tick
plus one; zero means empty or unknown. A tier increase or changed block footprint
resets the date; ordinary tier decline preserves it. Demolition clears it and undo
restores it. Old exports and invalid dates start observation at the load tick,
without invented history. The array participates in the canonical saved-state hash.
After 180 months ivy recolours solid facade cells; after 300 months roof patches
appear on elevated roof faces (above eight world-height units). Ground lawns,
paths and low platforms retain their colours; neither stage changes geometry,
glazing, species stamps or simulation rules. Inspect shows years since construction
or expansion. `node tools/wear-sheet.mjs` regenerates the three-stage sheet.

### 12.2f Civic campuses and artwork

Fire, police, pacification, Large Park and Zoo use 3×3 footprints and
art.civic(kind, 3). Large Park preserves the garden design and recreation
benefits; Zoo uses a separate barred prison design and provides custody.
All service campuses require road adjacency along any footprint edge at
placement. Parks are exempt. One anchor owns every tile, job and bill;
Inspect, demolition, undo, road access and drawing resolve any part to it.
Save metadata preserves old 1×1 stations and 2×2 gardens without expansion.
Old garden civic IDs remain Large Park IDs. See docs/ART-CIVICS-3X3.md and
docs/HANDOFF-CIVIC-CAMPUSES-2026-09-05.md for migration and verification.

### 12.3 Citizens — hand-authored kit, the organic exception
12×20 px adults, 8×12 cubs; facings SE and NE authored, SW/NW mirrored and
re-lit; 2 walk frames + 1 stand. Kit = shared body rows (2 facings × 3
frames × 2 builds) + species head/ears/tail overlays (8 × 2 facings) + cub
body → composed at boot and cached. Fur ramp per species (warm: rabbit, fox,
beaver, bear, raccoon; cool: mouse, owl; olive: tortoise); elder = one step
lighter. Centenary hat = 1 piece. Anchor = feet at the tile centre.

### 12.3b Looks, portraits and the idle pose

Appearance is cosmetic and derived, never save state. `art.look(citizenId)`
pure-hashes the signed integer id to `{ shade, mark }`, two bits and therefore
four stable looks. Shade 1 moves fur exactly one rung darker; elder lightening
then composes with it and both clamp inside the species ramp. Mark 1 selects
one authored piece, at most 6×6, on the adult/elder composer: rabbit lop ear,
mouse ear notch, fox white tail-tip, beaver pale chest, owl brow tufts, bear
muzzle, tortoise shell scute, raccoon lighter mask, pig cheek spot, cow
Holstein patch, wolf grey saddle, cat tabby stripe, hawk chest bars, or skunk
double stripe. The piece is applied after west-facing re-lighting, then
mirrored into its declared box, so a notch cannot change the light on the
opposite side. Half the elders — shade bit 1 — wear glasses.

Cubs carry no adult motif. The plan also requires all four cub rasters to be
distinct, so their mark bit is resolved as a second **shade-only** treatment:
two local four-pixel groups take opposite authored fur values. It changes no
silhouette, accent, or ramp and survives every walk frame and mirrored facing,
giving four identities without putting a Holstein patch or tail-tip on a cub.
This is the explicit resolution of the draft's “cubs: shade only” / “four
looks of every age differ” conflict.

`art.portrait(species, { age, shade, mark, expression })` returns a cached,
fully palette-keyed 16×16 bust composed from the same authored SE head, coat
map, age marks and look piece that walk the street, fitted to a common eye
line so small heads remain legible. Expression is `glad`, `flat`, or `low`;
its high-contrast eyes and four-pixel mouth shape differ. `render.paintPortrait`
`(canvas, sprite, scale)` is the sole UI canvas bridge and expands only by
integer nearest-neighbour pixels.

Frame 3 is the non-walking `idle` pose. A walker continuously standing for
more than one second selects it; each species has its own pause (among them a
sitting rabbit, head-turning owl, scratching bear, washing cat and withdrawn
tortoise), while its feet keep the same anchor. Every render path — ordinary,
tent, hit-test, carried sack, and the removed predation victim's compact
record — passes the stored look made from that citizen's id.

### 12.4 Roads, ground, water, trees
Roads: 16 tiles from the 4-bit mask, composed from 3 authored strips
(straight, corner, stub) + busy variant. Bridge: deck box + 2 piers, road
strip on top. Ground: grass ×3 variants, zone chalk 3 × {Low, High}, rubble.
Water: 1 cycled tile; land/water edge gets a 1-px darker kerb (no shore
autotile in v1). Trees: 3 hand-authored (round, tall, willow near water).
Zots 4, tent 1, plaza glyph 1, cursor/ghost 2.

### 12.4b Walls and tunnels (`js/art/walls.js`)

After Glades' DRYSTONE_WALL and its gateway: two solid bars (N–S and E–W)
clipped to the arms the road mask sets, 4 units thick and 9 high, in the
concrete ramp with a mortar course every third unit, the coping one step
lighter and the cut end one step darker than the near face (shaded alike a
bend reads as folded paper); a run is one tile long so two neighbours never
cover each other; a lone tile draws the straight E|W run. The tunnel is two
piers either side of the road's 10-unit width and a lintel across, a
STANDING sprite over the road tile so the road stays the road.

### 12.4c Rail and the station (`js/art/rail.js`)

The road's arm composition at a 6-unit bed: ballast in dark earth, a
sleeper every two units across the arm, two rails 1.2 units either side of
the centre line in the asphalt ramp's lightest key; the margins the road's
grass. The station is a standing solid over a rail tile — a platform slab
along the +a side of a N–S track (+b of an E–W one) and a shelter of two
posts and a roof — so the track shows under the canopy.

The **level crossing** is one ground diamond composed from BOTH masks: the
road's half by `roads.js`'s own predicate (`onRoad`/`roadKey`/`tarmacKey`)
and the line's half by this file's (`onRail`/`railKey`), so a crossing can
never disagree with the road beside it or the track beside it — and one whose
neighbour came down draws the stub it has become rather than a straight run
that is no longer there. Where the two overlap the ballast, the sleepers and
the lane dash all stop and the two rails run flush in the tarmac; in each
corner where the road's edge meets the bed's edge there is a concrete apron,
composed from both masks so a stub grows only the corners it still has. The
family is 16 road masks × 16 rail masks × busy = **512** tiles, so it is
composed LAZILY and cached — a city pays for the crossings it has, and a city
with none pays nothing — and each takes its 2× twin from its own recipe like
every other ground tile. The four square-on tiles the rule allows are on the
rail sheet with two stubs beside them.

### 12.5 Instruments
`tools/dom-shim.mjs` is enough DOM to RUN `js/ui.js` in Node — elements with
`append` / `classList` / `textContent` / `style` / `dataset` / `value`, a
`document` carrying the ids `createUI` looks up, a `stubApp(world)` with every
field the panel reads, and `textOf(el)` for what a player would read off it.
It cooperates with `headless-canvas.mjs` (it installs it, and still hands back
a real canvas for `createElement("canvas")`), so a check may drive the
renderer and the panel in the same process. It exists because the panel — the
game's largest text surface — was never executed by the suite until session
15, and a card that threw froze the game (§23 of the handoff). It is a shim,
not a browser: no layout, no CSS, nothing about how the card LOOKS. That is
still the browser round.

`tools/shots.mjs --sheet` renders every family to a contact sheet PNG;
`--scene` renders a 12×12 block with all 9 building families and 20 walkers
at fractional positions **including one on a tile seam and one in front of
the tallest tower** — the depth-sort proof, made before any sim is wired to
the renderer. `check.mjs`: every pixel a palette key; every anchor inside the
sprite; 16/16 road masks defined; a box solid emits no pixel outside its
projected footprint + height.

`tools/play.mjs` is the third eye: the scripted mayor of `tools/mayor.mjs`
builds a town in the real sim and **`js/render.js` itself** photographs it
through `tools/headless-canvas.mjs` — the browser's own renderer, in Node,
with no dependency and no second copy of the drawing. Shutters compose:
`--every N` months, `--at 2003-06`, `--film N` frames `--fps` apart so the
walkers move, and `--when REGEX`, which fires on a ticker line and **points
the camera at the coordinates the line itself carries** (`FIRE at (12,30)`);
`--after 0,2,4,6` then re-photographs that same spot months later, which is
how a burnt lot is watched clearing itself. Every shot prints a caption with
the month, the town and the watched tile in words (`RUBBLE 4mo left`),
because a photograph cannot tell you how many months are left and squinting
at a 12-px sprite to decide is how you see what you expected.

`tools/depthaudit.mjs` is the RAY AUDIT for oblong footprints: for a
building and a walker on each of the four roads round it, at 1/8-tile
steps in three lanes, every shared screen pixel is compared — the
building's depth from its z-buffer (re-rendered from its RECIPE), the
walker's as a point on its feet at that height, on the convention that an
item at (tx, ty) stands at the point (tx + ½, ty + ½) — and a pixel whose
nearer owner is the one painter.js paints first is mis-ordered (within
GRAZE 4 units it is a graze, the billboard's lean, reported not gated).
`--probe 3 --pullback 0.7` shows the flat pull-back failing a 3×3 by
4,185 pixels; the suite gates every oblong at 0.

### 12.6 The hi-res set (`js/art/hires.js`; session 9)
*"a more high res sprite set for when the camera is zoomed in."* Not a
second set: every box solid and every ground diamond keeps the RECIPE it
was made from (`solid.RECIPES` — { boxes, hub, extent, stamps } or
{ diamond: fn }), and `hires(sprite)` samples it again at HI_SCALE 2 — a
128 × 64 tile, a face edge where the 1× edge was, a door and a window the
same at twice the resolution, the pixel-keyed grains (brick, the meat
stripe, the grass dither, the road's speckle) finer. `render(boxes,
{ scale })`, `diamond(fn, scale)` (fn is handed `scale`; the water's bands
read it and stay world-sized) — byte-identical at scale 1, which the suite
holds against a hash of every 1× sprite. The animals, trees, zots, fire,
sacks and tents have no recipe and are scaled by the renderer as before.
Rendered lazily, cached per sprite. The suite: every twin twice the size
(within the 6 px the grid's pad costs), anchored on the same world point,
ink within 12% of 4×; every solid and ground diamond has one and the
animals do not; the 2× prism gate; and the upgrade is VISIBLE — at zoom 2
a frame has thousands of non-uniform 2×2 device blocks with the twins and
none with them removed, while zoom 1 is byte-identical either way.
`tools/shots.mjs --sheet` writes `sheet-hires.png`, eighteen 1× sprites
scaled ×2 beside their twins.

---

## 13. Rendering (`js/render.js`, the only canvas module)

- Static layer: ground + chalk + roads + level crossings + **rubble** + water + kerbs, drawn
  back to front by (tx+ty) into an offscreen canvas the size of the viewport
  plus a margin; redrawn when the world changes (dirty flag) or the camera
  moves past the margin. Full redraw of 4,096 cells is a few ms.
  **Buildings and trees are NOT in it** — this line said they were until
  session 8, and the difference is load-bearing: a caller that forgets
  `invalidate()` sees a demolished building vanish on cue and its rubble
  never appear, because the building is per-frame and the rubble is cached.
  `main.js` invalidates on every tick and after every op; so must any other
  driver (`tools/play.mjs`). Two checks pin the halves apart.
- Dynamic layer per frame: **buildings, trees**, walkers, fire, campers,
  meeting glyphs, cursor, ghost, zots — inserted into the same (tx+ty) order
  by their fractional position: `key = (tx+ty)·1024 + zOrder`, ground 0,
  walker 512 + floor(64·frac), building 768.
- Water palette-cycles 4 frames per second on the static layer's water tiles
  only (separate small canvas per frame is fine).
- Pick: flat inverse of the projection (the map is flat).
- **Oblongs** (the zoo, the blocks): keyed by the front-most tile pulled
  back by `pullbackOf(side)` = 0.7 + (side − 2) — 0.7 for a 2×2, 1.7 for a
  3×3 — derived in painter.js FOOTPRINTS (back ∈ (s − 1.75, s − 0.44) on
  the tile-centre convention) and proved by the ray audit (§12.5). A
  pull-back past 0.75 keys a block before the ground of its own front tiles,
  which is fine because ground is never in the building's scene: the static
  layer here, its own pass in `shots.mjs --scene`. The cursor on a footprint
  tile borrows the block's key (`keyAt`, `footprint` item overrides), a hair
  under it.
- **Zoom 2 draws the hi-res set** (§12.6): S = 2, a twin under a transform
  of zoom/2 with its anchor on the projection point placeAt put the 1×
  anchor on; the static ground layer is built at S× and blitted at zoom/S,
  remade when the zoom crosses 2; a sprite without a twin is drawn scaled
  as before.

## 14. Walkers (`js/walkers.js`, DOM-free, its own RNG stream)

- ≤ 150 active walkers, sampled round-robin from citizens whose commute path
  intersects the viewport; each carries a real citizen id (click → the card).
  70% commuters (home→job in the morning half of the tick, back in the
  evening half), 20% strollers to the nearest park/zoo/C lot, 10% cubs to a
  park.
- Position = lerp between consecutive road-tile centres with a per-citizen
  lane offset (±6 px); speed 1 tile/s at ×1, ×0.5 tortoise, ×0.7 elder.
- Special movers: arrivals from the edge road, departures to it (tax revolt =
  a column), campers with tents, the scout, bears vanish in winter, meeting
  pairs, centenary hat.
- **Predation (the owner: *"one citizen puts a bag/sack over another citizen
  and then walks away with a bag over their shoulder"*).** `justice.kill`
  publishes the month's killings to `world.predations` — `{ killer,
  killerHome, victimHome, victim: { id, species, age, name } }`, recorded
  BEFORE the victim is scrubbed, per-tick like `world.meetings`, never saved
  or hashed. The walker layer plays each one: the killer walks from its own
  door to the neighbour's; the neighbour stands 0.32 tiles past the door
  facing it (a figure from the record — the citizen is already gone); over a
  2.4 s stand the OPEN sack falls over the neighbour (a quadratic drop from
  22 px, the first 45%), then the TIED sack stands where it stood and
  wriggles; then the killer walks home at ×0.8 with the sack over its
  screen-back shoulder (`art.citizen(…, { carry: "sack" })` — an 18-px grid,
  the figure 3 px in, the same feet). If the killer already has a walker it
  is released at its next tile centre and the sack waits for it (retried
  every frame for up to two months, then dropped).
  The card names who is in the sack all the way home.
- **The boundary law:** walkers read the sim, never write it. A walker whose
  citizen's home/job/alive changed this tick is released at the next tile
  centre (no pop). The sampler never draws a citizen whose state changed
  this tick. `check.mjs` hashes year-30 state with the walker layer on and
  off and requires equality.

### 14b. Actionable needs and Inspect thoughts (`sim/needs.js`, `sim/voice.js`)

- `needOf(world, citizen) -> { code, arg, act }` is pure and RNG-free. It
  ranks only pressures already used by the simulation: actionable negative
  `moodTerms`, unmet `homeTerms`, positive demand valves, the resident's
  `lotScore` reason, and a tax rate above neutral. Personal mood points beat
  the fixed valve (8) and lot/tax (6) weights; a result below 4 is `CONTENT`.
  Stable `hash(citizen.id, code)` breaks ties. Grief, friends, held and fixed
  status are biography, not buildable needs, so they are never bubbles.
- The complete stable code set is `CONTENT`, `SHOPS`, `ROOMS`, `WORKS`,
  `HOOKS`, `NO_JOB`, `SMOKE`, `NO_PARK`, `COMMUTE`, `FLIGHT`, `DREAD`,
  `CRIME`, `VAN`, `WATER`, `TREES`, `HIGH`, `LOW`, `PASTURE`, `LV`,
  `CLEAN`, `NO_ROAD`, `CAPPED`, `NO_DEMAND`, `TAX`. Every code has an
  `ACT` remedy and at least two default lines no longer than 30 characters;
  species/diet overrides change voice only. A citizen's line for one code is
  chosen from its id without advancing any city or walker stream.
- Inspect is the only switch. `walkers.setCursor([tx, ty], pinnedCitizen)`
  attaches a code—not text—to the nearest real walkers within Chebyshev 6,
  capped at 8; an active pinned walker's place in the eight is guaranteed.
  Clearing the cursor or choosing another tool clears every code. The walker
  module remains a read-only visual layer and its cursor is never saved or
  hashed.
- `drawBubbles` is the last render pass. It resets the canvas transform, uses
  cached 10 px monospace measurements and palette-key `art.bubble` boxes,
  and therefore stays the same screen size at zoom 1 and 2. The three-pixel
  tail points to the walker's head and boxes clamp to the canvas. At the left
  or right edge the cached tail moves along the box; at the top it flips above
  the box. An off-screen pinned walker gets the corresponding edge-pointing
  callout rather than a centred tail pointing at empty space.
- `world.last.needs` is the once-per-tick living-citizen histogram from the
  same `needOf` function. It is derived panel data, not saved state. Inspect
  cards and the Census UI consume that contract when Part C owns those views.
  `tools/peopleprobe.mjs` measures four seeds for 30 years across balanced,
  dormitory and millbelt towns. Six declared stress municipalities replace
  the final monthly samples of one balanced run to expose edge states a
  competent mayor normally avoids. Each is a full 1,300-resident city with
  valid households, occupied storeys, separate civic lots, capacity-bounded
  homes/jobs and road-only commutes; `refreshLast` derives its fields and raw
  demand. Thus the city-month samples themselves cover every code; focused
  truth fixtures separately prove why each witness won.

## 15. Save (`js/sim/save.js`)

- JSON: `{ version: 1, seed, tick, cash, rates, tiles (typed arrays as plain
  arrays), citizens, households, valves, events, history, rngs, log,
  festivalBonus, flags }`. Derived and NOT saved: roadDist, Pol, LV, traffic,
  paths, occupant/staff counts (all rebuilt on load by `rebuildDerived`).
- **The input log** `log: [{t, op}]` is every player op with its tick.
  `check.mjs` replays the log from the seed and requires the same hash; save
  at year 10 → load → 10 more years must hash-equal the straight run.
- **Browser slots** (`js/slots.js`, DOM-free): any number of named manual
  slots per city plus exactly one overwritten autosave. The index is
  `zoo.slots:<city>` and values are `zoo.slot:<city>:<id>`; ids are counters
  and names are data, so punctuation is safe. `listSlots` is newest first.
  LOAD and SAVE share one panel with save-as, load, confirmed overwrite,
  confirmed one-slot delete, per-slot export, import and an estimated
  used/free byte count. CONTINUE loads the newest slot of `zoo.last`.
- Autosave runs every 12 ticks and on hide/page exit, updating its one row.
  A failed write returns a reason without changing earlier slots and leaves
  the current city JSON in the panel's export textarea for recovery.
- On boot, `migrate(store)` copies legacy `zoo.city:<city>`,
  `zoo.save:<city>` and `zoo.auto:<city>` values into slots idempotently;
  it never deletes the old keys. Migration markers live in the city index,
  not the migrated row, so deleting or overwriting that row cannot resurrect
  it. If the store is too full to copy an old value, the old key appears as a
  directly loadable/exportable recovery row instead of disappearing.
- `big` (§3b) is the fifteenth tile array; an all-zero `big` is omitted from
  the hash (as the keel's empty fields are), so a town with no block hashes
  as it did before the blocks. `occupants`, `staff`, `carnAt` are Uint16
  (derived): a 3×3 R block keeps 270 on its anchor.
- `theme` (§3c) is the sixteenth; an all-zero `theme` is omitted from the
  hash the same way, so a town with no landmark hashes as it did before the
  landmarks, and a save without the array loads to zeros (plain blocks).
- `zoo.pref` — this browser's preferences (the cheat switch, §8): not a
  city, not saved with one, never read by the sim (the suite greps for it).

## 16. Module contracts (what parallel builders code against)

```js
// js/sim/world.js
createWorld({ seed, w = 64, h = 64 }) → world           // terrain generated, starting edge road, cash 20000, rates {R:8,C:8,I:8}
idx(world, tx, ty) → i ;  inBounds(world, tx, ty)
// js/sim/tick.js
tick(world) → { notices: [string], events: [eventRecord] }   // one month
// js/sim/ops.js
apply(world, op) → { ok, cost, reason, replaced, evicts, undoable }   // op.kind ∈ zone (with density)|road|rail|station|wall|bulldoze|tree|park|largePark|zoo|fire|police|centre|use|rate|toggle|choice|cheat ; logs to world.log; deducts cash
undo(world) → { ok }
costOf(world, op) → { cost, tiles }        // for the live strip
// js/sim/fields.js — access, one standard (§6c)
served(world, i, seen?) → bool               // THE predicate: siteRoadDist ≤ ROAD_REACH, over the whole footprint
siteRoadDist(world, i, seen?) → 0..ROAD_REACH+1  // min roadDist over world.siteTiles(i) — except a PLATFORM (§6c)
doorsOf(world, i, seen?) → [tile]            // every road tile at that distance, ascending; [] when unserved
doorOf(world, i, seen?) → tile|null          // the lowest-numbered one, for readers that want a single tile
passable(world, j) → bool                   // ground a citizen may stand on; the question a FORECOURT is asked
nearReach() → ROAD_REACH + 5                // read at CALL time; a constant froze the card's horizon at import
doorSearch(world, i, seen, { reach, prev, passable }) → { d, doors }  // caller-owned scratch (§14: the draw and street layers own theirs)
nearestRoad(world, i, reach?, seen?) → { d, doors }          // the card's second question; no rule asks it
dial(world, species, from, maxCost, settle, policy)          // `from` is ONE road tile or a LIST of doors
commutePath(world, species, from, to, max) → { path, cost }  // a list at each end; the cheapest pairing wins
// js/sim/world.js — what a footprint is
siteTiles(world, i) → [tile]                // a block's or civic campus's tiles, or [i]
zooAnchorOf(world, i) → tile|−1 ; zooTiles(world, anchor) → [tile]
// js/sim/lots.js
lotScore(world, i) → { score, reason, p, parts: {valve, local} }
lotReport(world, i) → hover-card data (uses lotScore; households + names)
// js/sim/rules.js
RULES  // [{ id, title, formula, live(world) → string }] — the one object the Rules tab, hover card and playtest read
KNOBS  // { LOCAL_SCALE, GROW_THRESH, SPROUT_P, VALVE_LAG, ... } — pre-registered tuning knobs
// js/sim/save.js
save(world) → string ; load(string) → world ; stateHash(world) → string (FNV over the saved JSON minus log)
// js/sim/census.js
census(world) → { P, W, J, Jc, Ji, F, U, Lab, shares, H, friendships, approval, native }
// js/walkers.js
createWalkers(world) → { update(dtSeconds, viewport), list() → [{ id, citizen, tx, ty, facing, frame, kind }] , notify(change) }
// js/render.js
createRenderer(canvas, world, art) → { draw(camera, hover, walkers, overlays), invalidate(), pick(sx, sy) → [tx, ty]|null }
// js/art/index.js
art.building(zone, tier, variant, side = 1, theme = 0) /* variant: the tile's whole byte — & 1 the mirror, >> 1 the shop kind for C tier 1 */ / art.civic(kind) / art.road(mask, busy) / art.crossing(roadMask, railMask, busy) / art.ground(kind, variant) / art.tree(kind)
art.citizen(species, facing, frame, age) / art.overlay(kind, frame)   // each → { rows, anchor } (rasterised lazily by the renderer)
```

## 17. Build order and acceptance

1. Sim core headless (world, fields, demand, lots, citizens, budget, events,
   save, rules) + `tools/playtest.mjs` with three canned layouts:
   `balanced` (must reach ≥ 800 by y30 with u ≤ 12%), `dormitory` (R only:
   stalls ≤ 300 with campers), `millbelt` (I-heavy: mean Pol > 60) — and the
   scripted-mayor scenarios A–J from the lumped run. **Tune here.** The first
   printed number on the real map: the fraction of zoned lots whose local
   term alone forbids growth at V = +0.1 (must be < 30%).
2. Art pack + `tools/shots.mjs --scene` (the depth-sort proof).
3. Render + walkers + input + UI + index.html.
4. `tools/check.mjs` invariants (§0.2, §0.3, §7.2, §12.5, §14, §15) and the
   Pages relative-import assertion.
5. README, commit, push, Pages.

Later layers, labelled in BACKLOG.md: L1 road rot, owl academy, wedding,
species building skins, minimap, school; L2 elevation (Glades'
level machinery), shore autotile, 128×128; L3 power; L4 sound; L5 scenarios.

## Economic camping (2026-09-05)

People G integration: Inspect resolves custody kinds and physical campsites;
tent cards link to real residents, and camping residents ask for housing even
after retirement. Exoneration clears only its own current custody, preserving
newer independent sentences. Saved-city probes and citizen recording are
specified with measured results in docs/HANDOFF-PEOPLE-INTEGRATION-2026-09-05.md.

Downturn departure rolls now move households to persistent campsites; housing decay first seeks another home, then a campsite. Resident identities and family ties survive. Camping residents have no occupied home or job, remain counted in population and do not consume housing vacancies. At positive residential demand, families rehouse before new arrivals when a suitable home exists.

Each tent occupies one saved free grass tile. Construction and bulldozing cannot overlap it, including multi-tile footprints and undo. Tents are drawn from simulation records and can be inspected. Visitor campers retain their timer; resident tents do not expire. Old untiled visitors receive sites on load. See docs/HANDOFF-ECONOMIC-CAMPING-2026-09-05.md for fallbacks, tests and intentional baseline changes.

## Proposed extension: knowledge and culture (not implemented)

The owner requested a 3×3 University and Amphitheater, plus a 2×2 Library and Gallery. University coverage is based on half the map tile count, Amphitheater on one eighth, and Library/Gallery on a five-tile local range. The [knowledge and culture proposal](docs/PROPOSAL-KNOWLEDGE-CULTURE-2026-09-05.md) defines distinct effects, tentative balance, artwork, mixed-size civic integration and acceptance criteria. It is a future specification; current simulation rules above remain the implemented behavior.
