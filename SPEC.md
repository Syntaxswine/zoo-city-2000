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
  (ticks left), `rubble` (0/1), `variant` (art seed byte), `wall` (0/1 —
  with a road or rail on the tile, a tunnel; §6b), `use` (0 mixed, 1
  predator-only, 2 prey-only — the player's line on lots and roads; §7.8).
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
| Zoo (2×2 civic) | 12 C-type jobs | | |

`maxTier` is the density brush: Low = 1, High = 3 (one byte per lot; the
species-selection lever — mice want towers, bears want cottages).

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
access      = roadDist <= 3                                        (SC2000, exact)
local_R = clamp((LV − Pol − 40) / LOCAL_SCALE, −0.3, 0.3)        LOCAL_SCALE = 200 (pre-registered knob; D0 used 60, judged too wide)
          growth REFUSED if Pol > 60                               (Micropolis DoResIn at 0..100 scale)
local_C = 0.6·clamp(Rnear/80 − 0.5, −0.3, 0.3) + 0.4·(LV − 50)/200    Rnear = citizens housed within Chebyshev 5
local_I = 0.4·(50 − LV)/200                                        industry likes cheap land; tier 3 needs roadDist <= 1
score   = V_zone + local ;  if !access → score = −1 (reason NO_ROAD)
maxTierByLV: R and C: LV < 30 → 1, < 60 → 2, else 3 ; I: 3.  Effective max = min(maxTierByLV, lot.maxTier)
fill    = occupants/capacity (R) or workers/jobs (C, I)
GROW  if tier < max && score > GROW_THRESH(0.05) && (tier == 0 || fill >= 0.7):
        p = (tier == 0 ? SPROUT_P(0.25) : 0.10) · score      per month
DECAY if tier > 0 && score < −0.15 && (zone != R || fill < 0.5):  p = 0.10·(−score)
```
Reason codes returned by `lotScore()` (priority order): `NO_ROAD`, `SMOG`,
`NO_DEMAND`, `LV_CAP`, `DENSITY_CAP`, `WAITING_FILL`, `CAPPED` (V_R pinned by
Cap), `GROWING`, `DECAYING`, `STABLE`. The hover card prints the code's text.

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
  tolerance) + 5·friends + 10·[commute ≤ pref] + 10·[park within 4], clamped.
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
granular control of their city have the option to control it."* Tool `U`
(press again to cycle mixed → predator-only → prey-only; a rectangle brush;
§1 a repainted tile; one undo step) paints **lots and roads**. `admits(use,
species)`: mixed admits all; predator-only the hunters (diet carn: fox, owl,
wolf, cat, hawk); prey-only everyone else — omnivores are nobody's hunter
and live on the prey side. **A gate, on purpose** — it is the player's line,
not the species' preference (§7.6's "weights never gates" is about what
species want): `vacantLots` and `searchJob` skip what does not admit, so
every arrival, move-out, rehome and hire goes through it. A lot repainted
against its occupants gives the household `ZONED_OUT_MONTHS` 3 of notice
(`hh.notice`, saved), then rehomes within 12 road tiles under the gate or
leaves town ("ZONED OUT — …", `last.zonedOut`); its workers are released at
the next tick's stale pass and search again. Nobody moves in the month of
the click. **Commutes prefer the legal way:** the search is Dial's buckets
(`fields.dial`, integer costs: a step 10, a step onto a forbidden road
`TRESPASS_STEP` × 10 = 60), so a citizen detours up to six times longer
before it trespasses and trespasses when that is the only way to work. With
no line every step costs the same and the settle order is the BFS's, so the
paths — and the traffic — are the ones the BFS made; the suite holds every
commuter's path tile-equal to `roadPath`. `save.rebuildDerived` uses the
same search, so a loaded city takes the roads the live one took. The `O`
overlay's `use` mode tints predator-only rust and prey-only teal.

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
| 1 | Fire | disaster | w3; ×2 Jun–Aug | starts on a built lot (covered lots at 1/6 weight); burns 2 ticks (1 if covered); each tick spreads to 4-neighbour built lots p 0.3 (0.1 if covered; never across road, water, park); burnt → rubble, zoning kept; households displaced | bulldoze rubble §2; a fire station |
| 2 | Flood | disaster | w2, needs water | tiles within Manhattan 3 of water flood 4 ticks; lots there −1 tier; parks immune | the floodplain has the best LV: that is the tension |
| 3 | Tornado | disaster | w1 | 12-tile straight path; lots → rubble, trees felled, roads survive | rebuild |
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
each, §400/yr each, four C-type jobs each, effective only with road access.

```
fireCov(i)   = 1 within Chebyshev 6 of a fire station
               a covered lot is picked as a fire's ORIGIN at 1/6 the weight (unlikely, never impossible),
               a fire on a covered lot burns ONE month (else two) and spreads at 0.1 (else 0.3)
policeCov(i) = 60 within 3 of a police station, 30 within 6 (max over stations)
crime(i)     = clamp(40 − 0.5·LV + 0.4·animals in the 3×3 + 40·(U/W) − policeCov, 0, 100)
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
rulings applied. Every constant is in KNOBS; the rules tab has M1–M3, K1,
P1–P3.

```
DIET     herb = rabbit, mouse, beaver, tortoise, pig, cow · omni = bear, raccoon, skunk · carn = fox, owl, wolf, cat, hawk
         (fox and owl hunt without the `predator` flag, which stays the skunk-incident gate)

ZONE M   key M, "Meat", §12 a tile, drag-zoned; tiers stall / meat hall / cold store, M_JOBS [0, 3, 8, 16];
         its own valve rM = clamp((0.06·carnivores + 10 − Jm)/max(Jm, 20), −1, 1), T_M = T_C — a 1,600 town wants ~72 hall jobs;
         Jm ∈ J and Lab, ∉ Jc (no crowd-out of shops); local_M = 0.6·clamp(carnivores within 5 / 40 − 0.5, ±0.3) + 0.4·(50 − LV)/200;
         maxTier 3 like I; staffed by diet JOB_M {carn 0.9, omni 0.5, herb 0.1} (a weight — pigs and beavers, jobC 0.2, will walk to one)
DREAD    world.dread (derived): a hall spreads [0, 40, 70, 105] over radius [0, 2, 3, 4] (the pollution shape); LV −= 0.8·dread
         → a tier-3 hall −84/−67/−50/−34/−17 LV at d 0..4, exactly twice a works (−42/−34/−25/−17/−8)
         herbivores: mood −min(25, 0.25·dread) (halved with a carnivore friend); home score −dread; arrivals ×(1 − 0.3·min(1, halls/3));
                     REHOME: a herbivore household at dread ≥ 40 moves along the road (≤ 12 tiles) at 3%/month, to a lot with less dread
         carnivores: +5 mood inside the smell; home score +0.8·dread (net 0 — they do not mind); arrivals +0.3·min(1, Jm/40)
         omnivores: nothing. NOT pollution (pollution pulls raccoons and pigs and refuses R growth — the rule is herbivore-specific)
CRIME    crime += a hall's [0, 10, 18, 25] over [0, 1, 2, 3] (×0.5 licensed) + 15 within 2 of every open FILE
         + 3 per unemployed adult in the 3×3 (a carnivore ×2)   ← "no jobs means hungry wolves", counted from live state
MONEY    unlicensed: the CUT, §25 per filled M job per year, ledger "cut", untaxed; a killing near a hall +§50; a convict sold +§100
         LICENCE (offered deterministically the month the first hall reaches tier 2; §2,000 + §400/yr per hall): M jobs taxed at the C rate,
                 the crime hill ×0.5, the buyer's pull ×0.5 (3 → 1.5); the smell is unchanged
         RAID (a BOON kind so the No-disasters toggle never masks it; w3; cooldown 24): an unlicensed hall with police cover, crime > 50
                 and staff → a storey shut, +§200·tier fines, the last hired named and a file opened on them
         THE GREENS' LEAGUE (w2, 6 months): herbivores ≥ 40% and a killing's file standing → V_C −0.3, herbivore mood +5

THE KILLING (justice.js killingTick, every month, before the files):
         Σ = Σ over adults of KILL_DIET {carn 1, omni 0.1, herb 0.03} × 20 if unemployed × 3 within a hall's smell (1.5 licensed)
             × 2 if on a hall's staff × (0.5 + crime at home/100); fixed, held and cubs 0
         killings this month k = floor(0.00005·Σ + rng) — drawn once wherever an adult lives (the baseline hash moves; see §4)
         killer = weighted pick; victim = weighted pick of adults within Chebyshev 3 of the killer's home (not the household):
                  the killer's prey ×1, anyone else ×0.1, a friendship (the killer's, or of the killer's kind) ×0.1; none → nothing
         → removeCitizen "killed"; the funeral rule (mourners ≥ 3 befriend at the wake; grief a year for mourners and household);
           the victim's species −15 mood city-wide for 6 months; −§200 inquest; a FILE at the victim's home; the line names both
THE FILE events.files [{tile, radius 2, crime 15, opened, until +24, culpritId, victimId, cause, line, closed}] — saved under events;
         opened by a killing, a heist (the thief is now any adult within 4, weighted: unemployed ×3, hot home ×2, fox/raccoon/cat ×2,
         a record ×2), a BURGLARY (with a police station: once a month over built lots with crime > 60, p = min(0.3, 0.006·hot),
         −§20·tier), a raid. INVESTIGATION for 6 months: each month p = 0.02 + 0.18·policeCov/60 + 0.05·record
         → 11% / 50% / 74% over the file at cover 0 / 30 / 60; a killing's file that lapses prints COLD and names the culprit
THE WRONG ANIMAL 5% of arrests: any adult within 4 of the file, weighted 1/(1 + d) — no species weight ("random based on proximity")
         the innocent is sentenced like the guilty; the culprit stays; c.wrongful / c.wrongedBy saved; when the real one is later taken:
         EXONERATED, −§500 compensation, the town −5 mood for 6 months, "there is no way to unfix / unsell"
THE SENTENCE (the owner's table): a predator's (carn or omni) first conviction → the PACIFICATION CENTRE if one has road access and a bed;
         a prey animal, or anyone already fixed → the MEAT HALL if one has road access (removed, cause "sold", +§100 to the cut);
         otherwise the CELLS, 3 months, home with a record. Every conviction is record++.
CUSTODY  c.held = untilTick (saved), c.heldAt = the centre or −1; the job is released (releaseJob — ONE function for retirement,
         decay, bulldoze, custody); home kept; absent(world, c) = held > tick is ONE predicate read by isWorker, computeCrime's inline
         copy, prey flight, births, the walkers, every pool; mood −15 while held
FIXED    permanent, saved; no litter (a pair needs two unfixed fertile adults — skipped households count in last.littersLost);
         never a killer; PREY FLIGHT is proportional — flight = 10 × (unfixed adults of that species in the 3×3 / all of them);
         a fixed predator's friendship with its prey rolls at 0.7 (not 0.4) and counts ONCE in H (census.hKnife is the share
         "by pacification"); mood −5 for life; may keep any job, the counter included (the owner: "3. yes")
THE CENTRE CIVIC.CENTRE, 1×1, key V, §1,500, §900/yr, 4 C-type jobs (isCivicEmployer — NOT isStation, which is coverage),
         6 beds counted from heldAt; LV −6 within 2; carnivores −5 mood within 4 (the van); bulldozing it releases the inmates
         unfixed and is not undoable
```

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
`arrest()` call, never wrongful. The sentence is a **minor** while the record
is below `RECORD_HARD` 3: the cells for `TRESPASS_MONTHS` 1 and `record++`
(`justice.trespass` counts them; the ticker: *"TRESPASS — … was stopped on
prey-only ground at (x,y) on the way to work. A month in the cells; offence
2 — the next meets the sentence table."*); from the third conviction the
§9c table applies — the owner's "multiple offenses should send the citizen
to the meat market" for the habitual trespasser. The pinned citizen card
prints the exposure and the monthly chance.

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

## 11. Zoning UX (`js/input.js`, `js/ui.js`)

Tool strip (field-guide chrome: one monospace row, no icons above 16 px):
`1 R · 2 C · 3 I · M Meat · 4 Road · B Wall · U Use · 5 Tree · 6 Park · 7 Zoo · F Fire station · P Police · V Pacify ·
8 Bulldoze · 9 Inspect · D density Low/High · Space pause · , . speed · Z undo · S save · L load · Esc menu`.
The `O` overlay cycle is off → LV → pollution → crime (an open file is a ring) → dread → use (rust predator-only, teal prey-only) → score.

- **Zones, trees, bulldoze:** rectangle drag; live cost in the strip
  ("R ×36 = §180"); an unaffordable drag draws the refused hatch and does
  nothing on release; water, roads and civics skipped; trees inside a zone
  drag are felled at §4 each (LV warning in the card). **One undo step** (`Z`) restores the last op's tiles and
  refunds it — tiles, never people: a bulldoze that turned animals out is
  not undoable (the strip warns before you release), and a road laid over
  empty chalk says how many lots it replaced.
- **Road:** L-drag, horizontal leg then vertical; Shift = straight; over
  water = bridge §40. Auto-join by the 4-bit N/E/S/W mask into 16 tiles;
  busy variant when traffic > 40.
- **Park 1×1 §150, Zoo 2×2 §2,500:** click-place with a ghost; red ghost when
  blocked.
- **Density `D`:** toggles the brush; painting R/C/I with Low sets
  `maxTier = 1`; the chalk shows an inner diamond for High.
- **Hover card** (always live; click pins):
  ```
  (23,41) R High  tier 2  occ 8/10  ▲ growing (V_R +0.31 + local +0.12 = +0.43, p 4.3%/mo)
  LV 62  Pol 14  road 1  traffic 12
  the Burrowes family (4 rabbits) · the Shelby household (tortoise, 2 owls)
  WHY NOT: —                      ← or: no road within 3 / smog 71 > 60 / demand −0.24 (R 12% vs neutral 8.2%) / capacity reached — build a park or a Zoo
  ```
- **Demand bars:** three bars −1..+1 with the neutral-rate line and the cap
  tick drawn; they ARE V_R/V_C/V_I.
- **Tabs:** Rules (every equation with live numbers substituted, gridlands
  style), Budget (three rate steppers 0–20, income by zone, expenses by line,
  net/yr), Census (population, species histogram, unemployment, friendships,
  H, approval, milestones), Log (ticker of events and advisor lines).
- **Zots** above a lot that wants to grow but cannot: no road, smog, no job,
  no demand.
- **The title screen** (`js/title.js`): the owner's painting
  (`img/titlescreen.png`, 1424×848, "center top / cover") under the name in
  letter-spaced type, five buttons on a parchment bar (NEW GAME · CONTINUE ·
  LOAD · SAVE · OPTIONS) and one card for the panels, which are the
  new-city dialog's own builders (`foundForm`, `savesList`, `portBox` in
  `ui.js`) so `N` and the title never drift apart. It stands at boot over
  whatever boot resumed — CONTINUE names the slot, and the "paused; Space
  resumes" flash fires when the map is actually seen — and returns on `Esc`
  (a drag or a pinned card is cleared first) or the strip's `menu`. Under
  it the clock is stopped (`modalOpen()` counts it) and the map is not
  drawn; a flash sent while it stands lands on its note line and is
  re-flashed on the map when it closes. A fresh default map behind it is
  not in play until NEW GAME founds one (`app.entered`): CONTINUE and SAVE
  stay off and no autosave of an untouched map can shadow a real city.
  OPTIONS: the cheat switch (§8) and the per-city no-disasters toggle (the
  same `toggle` op the found form uses).
- **Screen layout:** the map viewport fills the window; a 300 px field-guide
  panel on the right; the tool strip along the top; bars top-left over the
  map. Integer zoom ×1 / ×2. Minimap is L1.

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
| C (concrete + glass) | shop 13×11×10 + awning box (accent) | store 14×14×22 with glass-strip rows | tower 13×13×48 + roof plant |
| I (rust) | shed 14×11×8 + chimney 2×2×14 | factory 14×14×14 + 2 chimneys + sawtooth | works 15×15×20 + chimney 3×3×34 + tank |
Civics: park (low plinth 16×16×1 + 2 tree stamps + bench box), zoo 2×2
(fence boxes on 4 sides, gate box, 3 canopy clumps, a hut box). Overlays:
scaffold (1), fire (2 frames), flood (1), rubble (earth-ramp ground). Two
variants per family by mirrored offsets. A species skin (majority occupant)
is a ramp swap at compose time — L1.

### 12.3 Citizens — hand-authored kit, the organic exception
12×20 px adults, 8×12 cubs; facings SE and NE authored, SW/NW mirrored and
re-lit; 2 walk frames + 1 stand. Kit = shared body rows (2 facings × 3
frames × 2 builds) + species head/ears/tail overlays (8 × 2 facings) + cub
body → composed at boot and cached. Fur ramp per species (warm: rabbit, fox,
beaver, bear, raccoon; cool: mouse, owl; olive: tortoise); elder = one step
lighter. Centenary hat = 1 piece. Anchor = feet at the tile centre.

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

### 12.5 Instruments
`tools/shots.mjs --sheet` renders every family to a contact sheet PNG;
`--scene` renders a 12×12 block with all 9 building families and 20 walkers
at fractional positions **including one on a tile seam and one in front of
the tallest tower** — the depth-sort proof, made before any sim is wired to
the renderer. `check.mjs`: every pixel a palette key; every anchor inside the
sprite; 16/16 road masks defined; a box solid emits no pixel outside its
projected footprint + height.

---

## 13. Rendering (`js/render.js`, the only canvas module)

- Static layer: ground + chalk + roads + buildings + trees, drawn back to
  front by (tx+ty) into an offscreen canvas the size of the viewport plus a
  margin; redrawn when the world changes (dirty flag) or the camera moves
  past the margin. Full redraw of 4,096 cells is a few ms.
- Dynamic layer per frame: walkers, fire, campers, meeting glyphs, cursor,
  ghost, zots — inserted into the same (tx+ty) order by their fractional
  position: `key = (tx+ty)·1024 + zOrder`, ground 0, walker 512 +
  floor(64·frac), building 768.
- Water palette-cycles 4 frames per second on the static layer's water tiles
  only (separate small canvas per frame is fine).
- Pick: flat inverse of the projection (the map is flat).

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
- **The boundary law:** walkers read the sim, never write it. A walker whose
  citizen's home/job/alive changed this tick is released at the next tile
  centre (no pop). The sampler never draws a citizen whose state changed
  this tick. `check.mjs` hashes year-30 state with the walker layer on and
  off and requires equality.

## 15. Save (`js/sim/save.js`)

- JSON: `{ version: 1, seed, tick, cash, rates, tiles (typed arrays as plain
  arrays), citizens, households, valves, events, history, rngs, log,
  festivalBonus, flags }`. Derived and NOT saved: roadDist, Pol, LV, traffic,
  paths, occupant/staff counts (all rebuilt on load by `rebuildDerived`).
- **The input log** `log: [{t, op}]` is every player op with its tick.
  `check.mjs` replays the log from the seed and requires the same hash; save
  at year 10 → load → 10 more years must hash-equal the straight run.
- localStorage slot per city name + export/import textarea.
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
apply(world, op) → { ok, cost, reason, replaced, evicts, undoable }   // op.kind ∈ zone (with density)|road|bulldoze|tree|park|zoo|fire|police|rate|toggle|choice ; logs to world.log; deducts cash
undo(world) → { ok }
costOf(world, op) → { cost, tiles }        // for the live strip
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
art.building(zone, tier, variant) / art.civic(kind) / art.road(mask, busy) / art.ground(kind, variant) / art.tree(kind)
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
