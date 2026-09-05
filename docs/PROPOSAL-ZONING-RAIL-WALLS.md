# PROPOSAL — ZONING, RAIL AND WALLS (2026-09-02, evening)

The owner's tranche, verbatim:

> *"the next tranche is zoning, rail, and walls.*
>
> *walls help decrease negative and positive area effects. roads and rail
> automatically make tunnels in the walls for the traffic to pass trough.*
>
> *zoning allows areas to be designated as being for predators, prey, or
> mixed use. mixed use is the default, but players who want a more granular
> control of their city have the option to control it. it applies for
> residential, commercial, and industrial. this could cause pathing issues,
> but i like the idea that citizens could get arrested for being in the wrong
> section if the road is not zoned for multi use. zoning would require
> another overlay screen.*
>
> *rail was previously discussed as something to add. it shortens commute
> times, lightens traffic, and allows neutral travel (as long as predators
> don't exit the train in a prey only zone)"*

And, mid-census: *"there are examples of wall code in glades of arcadia"*.

This document is the scouting census (what the tree already has), the
mechanics with numbers, the rulings the build makes where the owner's words
leave room (each marked **ruling** so it can be overruled in one line), and
the build order. Nothing here is built yet; the three phases land as three
commits so the owner can redirect between them.

---

## 0. What the tree already has (the census steers the shape)

| thing | where | what it means for this tranche |
|---|---|---|
| every area effect is `spread()` — a linear falloff over a **Chebyshev square** of radius R (pollution, dread, the hall's crime hill); LV masks, fire/police cover, file stains and the centenary bonus are square loops of their own | `fields.js` | one flood-fill primitive replaces every square loop; on open ground it must reproduce the square **exactly** (8-connected BFS with unit diagonals = Chebyshev distance), so a wall-less city's numbers do not move — the suite proves the frame first |
| a commute is a unit-cost BFS on road tiles; the path is a `Uint16Array` of tile indices stored on the citizen; traffic is the per-tick sum of paths; any road edit invalidates every path | `fields.js roadPath`, `citizens.js jobSearch/searchJob`, `computeTraffic` | rail needs **weights** (ride cheaper than walk) and a two-layer graph; the stored path needs a per-step "riding" bit, and every reader of `c.path` (traffic, walkers, mood, the suite) must mask it |
| homes: `vacantLots → homeScore → bestHome`, with `strict` soft gates; jobs: `openByDoor` scored by `pref × 1/(1 + d/commute)` | `citizens.js` | use-zoning is one admit predicate in `vacantLots` and one in `searchJob`; the owner asked for a gate here ("granular control"), so it is a gate — the species law ("weights never gates") is about what *species* want, not what the *player* draws |
| every conviction runs through one `arrest(world, f, c, wrongful, notices)` and one sentence table; `openFile` records an incident; `record` feeds the prior term | `justice.js` | trespass is a new cause through the same door: a minor sentence, and the record does the rest under the owner's "multiple offenses → the market" |
| radius queries in justice (victims within 3, the wrongful pool within 4, the thief pool, `hallNear`) are Chebyshev | `justice.js cheb / adultsWithin` | walls should protect: a walled prey compound keeps its neighbours out of a killer's reach. Same primitive |
| art is solid boxes through one rasteriser; the bridge is arms-per-mask-bit boxes (`bridgeBoxes`); roads are 16 masks from one arm predicate | `art/solid.js`, `art/roads.js` | walls are 16 masks of box arms (one tile of run each — no self-overlap by construction); rail is the road's arm predicate at a narrower width with sleepers; a tunnel is the wall's arms beside the road plus a lintel |
| overlays are a `mode` string cycled by `O`, painted as tinted diamonds | `render.js drawOverlay`, `main.js OVERLAYS` | the use overlay is a seventh mode |
| **Glades of Arcadia** (the owner's pointer): influence is a **flood fill, not a convolution**; a nullifier tile (hedge, wall) blocks propagation and receives none; a gate/arch is a **connector** that "does NOT block influence — it is the way through", opening one axis only; occlusion is a per-tile direction bitmask; a run's pieces must agree where the run *is* (the drystone wall was 1.97 tiles long for an arc and only a gate exposed it); never hand-roll a top face | `glades-of-arcadia/js/fields.js`, `art/props.js DRYSTONE_WALL`, `proposals/HANDOFF-A-GATE-IN-ITS-WALL` | adopted whole: a wall tile is mask 0, a tunnel opens its road's axis, a smell passes through a tunnel (a real gap has a real consequence), the wall's sprites are one-tile solids, and solid.js already owns the top face |

---

## 1. Walls

**Tile.** `wall[i]` ∈ {0, 1}, saved (old saves: absent → zeros). A wall may
stand on grass or trees (felled, §4) and on a **road or rail tile — that is
a tunnel** (`wall && (road || rail)`). Blocked on water, chalk, built lots,
civics. Laying a road or rail across a wall tile is likewise a tunnel: the
road op does not refuse a wall, it threads it.

**Tool.** `B` Wall, the road's L-drag (`roadL`, Shift = straight), live cost
in the strip. **Bulldoze on a tunnel removes the wall first** (ruling: the
wall is the thing on top; a second pass takes the road).

**Cost.** §8 a tile; upkeep §1 a tile a year (a wall is masonry, it needs
pointing). **Ruling:** no refund on the chalk under it because a wall never
goes on chalk.

**The field law (Glades'):** every area effect radiates by an 8-connected
flood fill over passable tiles, decaying by the path length it actually took
— the same `1 − d/(R+1)` profile as today, with `d` the flood distance
instead of the Chebyshev distance. On open ground they are equal, so **no
number moves in a city without walls** (the suite compares both primitives
on the scripted city and requires byte-equal fields). A wall tile is
impassable and receives nothing. A **tunnel is passable along its road's
axis only** (N|S or E|W), so a compound with one gate leaks along the road
through the gate and nowhere else — "walls help *decrease*", not eliminate.
No corner-cutting: a diagonal step is refused when both orthogonal
neighbours are blocked.

**What honours the wall** (everything with a radius):

| effect | today | with walls |
|---|---|---|
| pollution (works, shops, roads + traffic, fire, mess, parks as sinks) | square spread | flood spread |
| dread | square spread | flood spread |
| the hall's crime hill; every open file's stain | square | flood |
| LV: park +12 within 4, zoo +6 within 5, the van −6 within 2, a plaque's bonus | square masks | flood masks |
| fire cover (6), police cover (3 full / 6 half) | square | flood — a station's patrol does not pass a wall except through the gate |
| the killing's victim search (3), the wrongful pool (4), the thief pool, `hallNear` | Chebyshev | flood distance — a walled compound is out of reach |

Not affected, on purpose: `LV_CENTRE` (distance to the centroid — not a
source), nature8 (the eight neighbours), road reach (`roadDist` walks any
tile — a lot behind a wall still counts a road on the other side as its
door? **No**: `doorOf` and `computeRoadDist` walk through walls today; they
will treat a wall tile as impassable too, so a lot fully walled off has no
road access and says so on the card. That is the honest reading of a wall.)

**Cost of the flood.** ~500 sources × ≤ 81 tiles a tick; a generation-stamped
scratch array so nothing is refilled; a wall-less city keeps the square loop
(the suite's frame proof makes the two interchangeable).

**Art.** 16 masks: a centre pad plus one arm per set bit, as boxes 4 units
thick, 9 units high, in the concrete ramp with a stone grain; the cut end one
step darker (Glades' lesson: an end shaded like the near face reads as folded
paper); a lighter coping as the top face. The tunnel: the two arm stubs
either side of the road, plus a lintel box over the road from c 6 to 9 —
drawn as a standing item so the road beneath stays the road sprite. A lone
wall tile draws a straight run (Glades: "a piece with no neighbours is still
a wall, not a post").

**UI.** Hover: "Wall" / "Tunnel — the road runs through the wall"; the field
line already prints Pol / dread / cover, which is where the wall's work
shows. Budget: "walls" upkeep line. Census: walls, tunnels. Rules tab F5:
*"a field spreads by flood fill; a wall blocks it; a tunnel is the way through"*
with the live count of walls.

**Suite.** (1) frame proof: square vs flood byte-equal on the wall-less
scripted city for pol, dread, lv, crime, fireCov, policeCov; (2) a works
walled off on all four sides reads 0 on the far side, and the same wall with
a road tunnel leaks along the road; (3) wall + road = tunnel and a commute
passes it; wall on water / chalk / a built lot refused; bulldoze takes the
wall first; (4) a killer's victim search does not cross a full wall; (5) save
→ load → 24 ticks with walls hash-equal; an old save loads.

---

## 2. Use-zoning (checkbox unions) and the trespass arrest

**Tile.** `use[i]` is a saved `Uint16` bitmask. Zero is mixed. Bit 0 is
predator and bit 1 prey, deliberately preserving the shipped save values
`1` and `2`; bits 2–15 are the stable rabbit, mouse, fox, beaver, owl, bear,
tortoise, raccoon, pig, cow, wolf, cat, hawk and skunk assignments. It is
meaningful on zoned lots (including M) and on **road, rail and station
tiles**. Default 0 everywhere; a city that never touches the tool plays
exactly as before. Moving from one byte to two costs 4,096 bytes of runtime
map memory on a 64×64 city; an untouched JSON save remains byte-identical
because both representations serialize to the same array of zeros.

**Who is what.** Predator = `diet === "carn"` (`HUNTERS`: fox, owl, wolf,
cat, hawk). Prey = everyone else, omnivores included. `admits(mask,
species)`: zero admits all; otherwise the tests are ORed — predator admits
hunters, prey admits non-hunters, and each species bit admits that exact
species. Predator + bear therefore admits the five hunters and bears;
rabbit + fox admits precisely rabbits and foxes.

**Tool.** `U` Use opens a non-modal list of sixteen native checkboxes, so it
can remain visible while the player paints. No checks is labelled mixed;
any combination is legal. The button reports the one selected name or
"N checked." The rectangle brush costs §1 a changed tile (a repaint, not a
build), is one undo step, paints every zoned lot and road/rail tile in the
rectangle, and skips the rest.

**The gate.**
- Homes: `vacantLots` skips lots that do not admit the species; arrivals,
  move-outs, rehomes and evictions all go through `bestHome`, so one
  predicate covers them.
- Jobs: `searchJob` skips lots that do not admit; the roster's weights are
  untouched otherwise.
- A lot repainted **against** its occupants: the household gets a
  three-month notice (`zonedOut` on the household, saved) and rehomes by
  `bestHome` within 12 road tiles; failing that it **leaves town** ("ZONED
  OUT — the Burrowes left; the street is predator land now"). Workers at a
  repainted job lot are released at the next tick and search again under the
  gate. **Ruling:** nobody is evicted in the same month as the click, so a
  misclick and `Z` cost nothing.

**Pathing — the owner's "this could cause pathing issues".** Commutes do
not refuse a forbidden road; they **prefer** a legal one: in the job-search
BFS and the commute path a forbidden road tile costs `TRESPASS_STEP` 6
walk-tiles instead of 1, so a citizen takes a legal detour up to six times
longer before it trespasses, and trespasses when that is the only way to
work. (Ruling: a refusal would make the tool a job-killer; a preference makes
it a risk the player can read on the card.)

**The trespass arrest** (`justice.js trespassTick`, after the killing and
before the files). Each month, for every employed adult with a commute:
`E` = number of **walking** tiles on the path whose use forbids the species
(rail tiles never count — "neutral travel"; a station in a forbidden zone
counts as one walking tile, so **"predators don't exit the train in a prey
only zone"** is the same rule, not a special case). Add `TRESPASS_HOME` 4 if
the animal's own home or job lot forbids it. Then

```
p = min(TRESPASS_MAX 0.3, TRESPASS_P 0.02 · E · maxCov/POLICE_EFFECT)
```

where `maxCov` is the highest police cover over those tiles: **no police, no
arrest** (the owner's model throughout — cover is the chance of an arrest).
Six forbidden tiles under full cover: 12 % a month, caught inside a year.
The arrest is on the spot (a file opened and closed in the same call, cause
"trespass", never wrongful — the officer saw the animal). **Sentence,
ruling:** a minor — the cells for `TRESPASS_MONTHS` 1 and `record++`; from
`RECORD_HARD` 3 convictions the full sentence table applies (a predator to
the centre, prey or the fixed to the hall) — this is where the owner's
"multiple offenses should send the citizen to the meat market" bites for the
habitual trespasser. The ticker: *"TRESPASS — Rufus Slyfield was stopped on
prey-only road at (23,41) on the way to work. One month in the cells."*

**Overlay.** The `O` use mode keeps predator rust and prey teal, assigns one
stable colour to every species bit, and averages the selected colours for a
combined mask; mixed is untinted. **Hover:** the tile card names every
checked box and enumerates the admitted species; a pinned citizen's card
prints its exposure. **Census:** trespass arrests, zoned-out departures,
predator/prey selections and per-species selected-tile counts.

**Suite.** (1) all sixteen bits are unique, every exact-species bit admits
only that species, and combinations are OR; after 24 ticks nobody lives or
works where the mask forbids; (2) a repainted lot empties inside
four months and its household is rehomed or gone, ids clean; (3) a forced
trespass (`TRESPASS_P = 1/E` on one commuter) lands one animal in the cells
with `record 1`; a third forced conviction goes to the table; (4) a commute
prefers the legal detour when one exists within the ratio; (5) `use` round-
trips; old `1`/`2` saves keep their predator/prey meaning, the high skunk bit
and combined masks round-trip in `Uint16`, and malformed oversized masks
become mixed before typed-array coercion; (6) the real checkbox handlers,
combined tile card, Census and blended tints are exercised.

---

## 3. Rail

**Tile.** `rail[i]` ∈ {0, 1 rail, 2 station}, saved. Rail may run on grass or
trees (felled) and through a wall (tunnel). **Superseded 2026-09-03 (SPEC §7.9):** level crossings SHIPPED — a road and
a line share one tile when they cross square-on. The rest of this ruling
stands: still not on water, so still no rail bridges.

**Ruling for v1:** still not on water (no rail bridge art yet). A rail and
a road may share a square-on level crossing; a station cannot stand on that
shared tile because its platform would stand in the road.

**Tools.** `7` Rail — the road's L-drag, §20 a tile, upkeep §3 a tile a year.
`8` Station — click on a rail tile, §300, upkeep §100 a year. A station is
served like a lot when a road lies within `ROAD_REACH` 3; every nearest road
tile is a door, and passengers walk the passable forecourt between it and
the platform. The card names the doors and distance, or says nobody can
reach the platform.

**The commute graph.** Two layers: *walk* nodes on road tiles (and station
tiles), cost `WALK` 9 a step; *ride* nodes on rail and station tiles,
cost `RAIL_COST` 2 a step; the two layers meet only at a station tile
(board/alight, cost 0). A commute is the cheapest path from the home's door
to the job's door within `COMMUTE_MAX × WALK`; the search is Dial's
bucket queue (integer costs), replacing the BFS in `searchJob` and
`roadPath` — on a city with no rail the graph is the road graph and the
result is the BFS path, so nothing moves (frame proof in the suite).

**What it does** (the owner's three verbs, each one line):
- *shortens commute times*: `commuteTime` sums integer walk/ride costs and
  divides by `WALK` once; the mood test (`≤ species.commute → +10`) reads it
  without floating drift at an exact boundary;
- *lightens traffic*: traffic counts walking steps only, so a road paralleled
  by a line loses its commuters to it; rail tiles emit `EMIT_RAIL` 1 flat,
  no traffic term;
- *neutral travel*: trespass counts walking steps only (§2).

**Path storage.** `c.path[k] = tile | (riding ? 0x8000 : 0)` — a 64×64 map
needs 12 bits, so the flag rides in the same `Uint16Array`; one `tileOf()`
and one `riding()` helper, and every reader (traffic, walkers, the mood
line, the suite's "every commute lies on roads" check, the trespass count)
goes through them.

**Walkers.** A commuter follows the whole path; on riding steps it moves at
the derived `WALK / RAIL_COST` = ×4.5 and is drawn three pixels up (on the rail
bed); no train sprite in v1
(BACKLOG: a two-car train walker on busy lines).

**Art.** 16 rail masks from the road's arm predicate at width 4: a bed of
dark ballast, sleepers every 2 units across the arm, two rails in the
asphalt ramp's lightest key; the station a standing solid — a platform slab
9×16 beside the track and a canopy on two posts — so the track sprite shows
under it. A rail tunnel reuses the wall's tunnel with the rail's axis.

**UI.** Hover: "Rail" / a station's road doors, sides and walked forecourt /
"no road within 3";
Budget: rail and stations upkeep; Census: rail tiles, stations, **riders**
(commuters with any riding step) and mean commute; Rules tab R1: *"a commute
is the cheapest walk-and-ride; ride 0.22 of a step"* with the live rider
count.

**Suite.** (1) frame proof: on the scripted (rail-less) city the bucket
search returns the BFS path for every commuter; (2) a straight line with two
stations beside two blocks: the commute cost falls below the road-only cost,
riders > 0, and the parallel road's traffic falls; (3) a station beyond road
reach is never boarded; (4) rail through a wall = tunnel and the ride passes;
rail is refused on water and only shares a road at a square-on crossing;
(5) every riding step is on a
rail tile and every walking step on a road tile; save/load/continue and
replay with rail hash-equal.

---

## 4. Numbers (all in `KNOBS`)

| knob | value | note |
|---|---|---|
| `COST.wall` / `UPKEEP_WALL` | 8 / 1 | a tile; a year |
| `COST.use` | 1 | a repaint |
| `COST.rail` / `UPKEEP_RAIL` | 20 / 3 | a tile; a year |
| `COST.station` / `UPKEEP_STATION_RAIL` | 300 / 100 | click on rail; served from road within `ROAD_REACH` across a walked forecourt |
| `WALK` / `RAIL_COST` | 9 / 2 | integer costs; a ride is 2/9 of a walk and the reciprocal visual speed is ×4.5 |
| `TRESPASS_STEP` | 6 | a forbidden walking step costs six legal ones in the search |
| `TRESPASS_P` / `TRESPASS_MAX` | 0.02 / 0.3 | per forbidden tile under full cover; the cap |
| `TRESPASS_HOME` | 4 | living or working on a forbidding lot counts as four tiles |
| `TRESPASS_MONTHS` | 1 | the minor sentence |
| `RECORD_HARD` | 3 | from this record the full sentence table applies to a trespasser |
| `ZONED_OUT_MONTHS` | 3 | a repainted household's notice |
| `EMIT_RAIL` | 1 | flat, radius 1, no traffic term |

---

## 5. Build order, and what the owner may want to overrule

Three commits, in this order, each with its suite and docs:

1. **Walls** — the flood primitive with the frame proof, the tile, the op,
   the art, the tunnel, the radius queries in justice. (Nothing else depends
   on it, and it changes the fewest files.)
2. **Use-zoning and trespass** — the tile, the brush, the gate, the notice,
   the weighted search, the arrest, the overlay.
3. **Rail** — the two-layer graph, the path bit, the walkers, the art, the
   station.

**Rulings the owner did not make** (each is one line to overrule):
- a tunnel lets a smell through along the road (Glades' gate law); an
  alternative is a tunnel that blocks fields and passes only traffic;
- bulldoze takes a tunnel's wall before its road;
- omnivores are prey-side for use-zoning;
- a forbidden road is a preference (×6 cost), not a refusal;
- trespass needs police cover to be caught; the first two are the cells for
  a month; the third conviction meets the sentence table;
- a repainted lot gives three months' notice; then rehome or leave;
- no rail bridges in v1 (level crossings SHIPPED 2026-09-03, SPEC §7.9); a
  station is a click on rail and is served from road within `ROAD_REACH`.
