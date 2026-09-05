# ZOO CITY 2000

An isometric city builder where anthropomorphic animals live and grow
together. Zone residential, commercial and industrial land, lay roads, set
three tax rates, and cope with what the years throw at the town — fires,
floods, booms, recessions, a beaver dam, a tax revolt, a tortoise's
hundredth birthday.

**Play:** https://syntaxswine.github.io/zoo-city-2000/

The population is not a number. It is a roster of named rabbits, mice,
foxes, beavers, owls, bears, tortoises and raccoons, each with a home, a
job, an age, friends and a mood. Buildings grow when the family in them is
crowded; children move out at sixteen; elders retire and stay; a funeral
introduces the mourners to each other. The town's growth ceiling rises with
how well the animals mix — the **Zoo City index** on the census card is the
share of friendships that cross species, and it multiplies the cap.

## Run

```
node tools/serve.mjs          # http://localhost:8139
node tools/check.mjs          # invariant suite, exits 1 on any failure
node tools/playtest.mjs       # scripted mayor, 30 years, prints the curves
node tools/shots.mjs --sheet  # every sprite family to docs/shots/*.png
```

No dependencies, no build. Everything under `js/sim/`, `js/art/` and
`js/iso/` imports in Node; only `render.js`, `ui.js`, `input.js` and
`main.js` touch the DOM.

## The title screen

The game opens on a painting: NEW GAME, CONTINUE (the newest named slot of
the last city), LOAD, SAVE, OPTIONS. LOAD and SAVE enter one named-saves
panel: save as many copies as you want, load, overwrite or delete one,
export any slot, and import city JSON. `Ctrl+S` focuses the save name and `L`
focuses the list; the automatic save remains one overwritten row per city.
If browser storage fills up, the refused save's JSON is left in the export
box so the city can still be copied somewhere safe. `Esc` brings the title
back mid-game as the pause menu. OPTIONS
holds one cheat: a switch that unlocks a **GIVE ME CASH** button beside
the treasury — §100,000 a press, booked in the ledger under `cheat` and
written to the city's input log like any other op, so the Budget tab
always says how much of the treasury came that way. The switch is a
preference of the browser; the city only carries the ops. The same panel
toggles disasters for the current city.

## Controls

The build remote on the left is the key: `1` Residential, `2` Commercial,
`3` Industrial, `4` Meat, `5` Road, `6` Wall, `7` Rail, `8` Station, `9`
Tree, `0` Park, `Z` Zoo, `V` Pacification, `P` Police, `F` Fire, `I` Inspect
and `B` Bulldoze. `H` changes density and `U` opens the use-zoning checklist. WASD and the
arrows only pan. `Backspace` or `Ctrl+Z` undoes; `Ctrl+S` opens save-as and
`L` opens the saves list. The generated help line in the game carries the
remaining pause, speed, overlay, news, zoom, new-city and menu keys.

## The rules are the game

Every equation the sim runs is printed live in the **Rules** tab with the
current numbers substituted, and every constant lives in one file
(`js/sim/rules.js`). The model is the Micropolis `SetValves()` lineage,
re-derived for a 2,000-animal town and measured before it was written down
(`SPEC.md` §4 has the lumped-run numbers; `tools/playtest.mjs` reproduces
them on the real map):

| what | rule |
|---|---|
| residential wants jobs | `rR = (J + 40 − W) / max(W, 40)` |
| commerce wants customers | `rC = (0.22·P + 20 − Jc) / max(Jc, 40) + 0.5·min(0, W/J − 1)` |
| industry sells outside | `rI = (ext · 1.15 · Lab − 1) · 2`, `ext` from a 12.5-year cycle × edge roads × events |
| taxes | neutral rate `n = clamp(9 − P/1600, 6, 9)`; `T = 0.04·(n − rate)` below it, `−(0.10·d + 0.0125·d²)` above |
| demand | leaky integrator, 63% of a step in six months |
| the cap | `Cap = (1200 + 150·parks + 500·zoos + festival) · (1 + 0.5·H)` |
| a lot grows | road within 3 tiles, `score = V + (LV − Pol − 40)/200 > 0.05`, 70% full, land value permits the storey |
| pollution | every source spreads linearly over its radius; a lone works stinks next door, pigs and skunks dirty their lot, parks are sinks; no wind |
| crime | `40 − 0.5·LV + 0.4·density + 3·jobless in the 3×3 + 40·unemployed share + a hall's hill + open files − police`; above 60 it costs land value and shops; it is also the killing's hazard |
| dread | a meat hall spreads 40/70/105 over 2/3/4 tiles; LV −0.8·dread (twice a works); herbivores mind it, carnivores do not |
| use-zoning | `U` opens predator, prey and all 14 species checkboxes, then paints lots and roads; no checks is mixed, otherwise matching any check is allowed; a gate on homes and jobs; a forbidden road step costs ×6; a repainted household has 3 months to rehome or leaves |
| trespass | `E` forbidden walking tiles on the commute (+4 for a forbidding home or job); `p = min(0.3, 0.02·E·cover/60)` a month — no police, no stop; the cells for a month and a record; the third offence meets the sentence table |
| rail | a commute is the cheapest walk-and-ride: a step 1, a ride 2/9 (0.22) between stations served by a road within 3 tiles (the forecourt is walked); riders move at ×4.5, 50% faster than before; traffic and trespass count walking steps only — neutral travel until you step off; a road and a line cross square-on on one tile |
| walls | every area effect radiates by flood fill; a wall blocks it and receives nothing; a road through it is a tunnel, open along the road; a killer's reach stops at a wall (Glades of Arcadia's law) |

The hover card's **WHY NOT** line is computed by the same function that
decides growth — it can only ever say what the rule did.

## The zoo

| species | what they want | what they do to the town |
|---|---|---|
| rabbit | parks, trees | litters of three; the Rabbit Warren boon |
| mouse | towers | short lives, big litters; the Mouse Boom |
| fox | land value ≥ 50 | shops; the Fox Market Fair |
| beaver | water, industry | the mill-town workforce; they build dams |
| owl | trees, the zoo | shopkeepers; long lives |
| bear | cottages, trees | sleep from December to March; loyal |
| tortoise | a short commute | live 150 years; a centenary raises the street's value forever |
| raccoon | nothing — they come when it is dirty | the smog readout with a face |
| pig | mud, industry | litters of five; the works' workforce; messy — a tenement of pigs smells like a small factory, and raccoons move in next door; truffle season |
| cow | pasture: cottages and parks | slow, calm; the Dairy Fair |
| wolf | woods, and a town full of things to eat | arrive as a pack; the Wolf Moon |
| cat | flats, shops, mice | shopkeepers; the mouse's other problem |
| hawk | towers | commute anywhere; see the whole city |
| skunk | woods, dirt | nobody's prey; stinks; only pigs and raccoons will live next door; sprays a predator now and then |

**Services.** A fire station (§500, §400/yr) covers six tiles: a fire
starts there a sixth as often, burns one month instead of two, and barely
spreads. A police station covers
six tiles against a crime field (base minus land value plus density plus
unemployment): high crime drags land value and mood, keeps shops from
growing, and lets a named fox, raccoon or cat rob a store. The `O` overlay
shows crime in red and police cover in blue.

**Road access.** A building is served when a road comes within three tiles
of ANY part of it, and every side it touches a road is a way in. A 6×6
estate ringed by roads is served all the way to its middle; a 3×3 block
whose far corner is four tiles out is served because its near corner is
three, though a block never GROWS across that line — it is what keeps a
building standing when you take its road away; a station three tiles off the
road is a station, and its passengers walk the forecourt, which therefore has
to be ground they can stand on (never water, never through a house); a zoo no road reaches is a fenced field — no keepers, no
land value, no room on the population cap. Warehouses are no exception any
more: the inside of an industrial block stands as tall as its edge. One
rule, asked of a lot, a block, a hall, a platform and a zoo alike, and a
citizen leaves home by whichever side its work is on. Press `O` to the
**access** overlay and you can point at the tile: untinted on the road, then
sand, mauve and aubergine for one, two and three tiles out, and rust where
something asked for a road and there is none. It starts OFF in every city and
is not saved. (It was three greens for a week, and the first band rendered as
the grass ramp's own light shade - the owner counted two road-adjacent tiles
where the sim had three, and the sim was innocent.)

**Walls.** `6` lays a wall like a road (§8 a tile). Smells, dread, the
crime a hall casts, fire and police cover and the land value a park lends
all go *round* a wall instead of through it, and so does a killer's reach —
a walled prey compound is safe from the wolf next door. Lay a road across
the wall and it is a tunnel: the traffic passes, and so does the smell,
along the road and nowhere else.

**The player's line.** `U` opens a checklist for *predators*, *prey* and
each of the 14 species, then paints any lot or road. No checks means *mixed*
(the default, which plays exactly as before); otherwise an animal is allowed
when it matches **any** checked box. Thus a district can be fox + rabbit,
predators + bears, or any other union. A household whose street is repainted
against it has three months to find a home within twelve road tiles or it leaves. Commutes
prefer the legal way round — a forbidden road step costs six legal ones in
the search — but an animal whose only way to work crosses the line walks
it, and under police cover it is stopped: a month in the cells and a record,
and the third offence meets the sentence table. Rail is neutral
travel; only where you step off counts. The `O` overlay keeps rust for
predators and teal for prey, gives each species a stable colour, and blends
the checked colours for a combined zone; the tile card names the exact union.

**Rail.** `7` lays track and `8` makes a station of any rail tile a road
reaches (three tiles is near enough; the animals cross the forecourt on
foot). A commute is the cheapest walk-and-ride: a ride costs 2/9 (0.22) of a walk,
and its walker moves at ×4.5, a 50% increase over the former ×3. It
makes no road traffic and is neutral ground for the player's line — a
wolf may ride through prey-only streets, and is only stopped where it
steps off. Riders are counted on the census; the walkers sit up on the
train. A road and a line may cross on ONE tile when they cross square-on —
a straight road across a straight line. Animals walk over the crossing,
riders pass straight through it without stopping, and the city maintains a
road and a line there and breathes the smoke of both. The bulldozer takes
the line first and leaves the road.

**Crime and punishment.** Any adult may kill a neighbour — carnivores
likely, the unemployed twenty times likelier ("no jobs means hungry
wolves"), prey rarely — and a grey-market **meat hall** (zone `M`) is the
buyer: it pays the mayor an untaxed cut, casts a dread over four tiles that
takes twice the land value a works does, and herbivores move away from it.
Every incident opens a six-month file; police cover is the monthly chance of
an arrest, and one arrest in twenty takes the wrong animal, chosen by
proximity. The street sees it: the killer walks to the neighbour's door, a
sack falls over the neighbour and is tied, and the killer walks home with
it over a shoulder (click it — the card says who is in the sack). A convicted predator goes to the **pacification centre** (`V`)
and comes home fixed: no litters, never a killer, prey next door stop
fearing it; a convicted prey animal, or anyone already fixed, is sold at the
hall. The Butchers' Guild will sell you a licence. Nothing in it is a gate,
and the ticker names everyone.

**Predators and prey.** Rabbits fear foxes, wolves and hawks; mice fear
foxes, owls, cats and hawks; pigs and cows fear wolves. A prey household
loses mood for every predator species living next door — unless someone in
it is *friends* with that species. Such friendships form slowly (the pair is
wary) and count double in the Zoo City index. The bridge is a friendship,
never a wall.

Species are weights, never gates: a factory belt by the river fills with
beavers, a leafy suburb with owls, a dirty core with raccoons. The census
card prints the histogram and a one-line city character ("a beaver
mill-town with a fox problem").

## Instruments

- `tools/playtest.mjs --layout balanced|dormitory|millbelt --schedule 15:13,22:7`
  — a scripted mayor on the real map; the SPEC's acceptance targets.
- `tools/check.mjs` — 534 checks: ledger conservation to the §, valves
  bounded, no NaN, the dangling-id law, rosters and capacities, commutes on
  roads, determinism, save → load → continue hash-equal, input-log replay,
  the crime-and-punishment invariants, the walls (the flood reproduces the
  square byte-for-byte on a wall-less city, then cuts a works' smell behind
  a wall and leaks it through a tunnel), the player's line (the weighted
  commute is the BFS tile-for-tile with no line; a rabbit takes the legal way
  round a predator-only road and a fox the short way; two years after a
  repaint nobody lives or works where the line forbids; a forced month stops
  the exposed and the third offence meets the table), rail (a line beside
  a road rides at a known cost with the ride bit on the track and not at
  the platforms, traffic counts walking steps only, a wall across the line
  is a tunnel open along the track, bulldozing a station makes the commute
  walk, riders on the scripted city each no slower than the walk), what a
  station buys (covering the town makes a fire rarer and not merely
  differently placed; off a beat the building always goes and on one the
  engine saves most of them; the rubble clock counts itself down and the
  bulldozer is only impatience; a burglary needs no police station to happen
  and none at all means nothing is investigated; the file stains cap; every
  line the events tick says goes on the record), the play camera (a town
  renders to something that is not a blank rectangle; the cached GROUND layer
  does not follow the world without an `invalidate()` and a per-frame BUILDING
  does; a blit scales by the transform; `rgba()` fills blend instead of
  painting black; both instruments import the one mayor), the cheat op (booked under `cheat`,
  logged, replayed, clamped, never undone, lifts a receivership at once),
  road access as ONE standard (the field and the door search are the same
  number two ways, walls and all; a block is asked about the whole of it and a
  zoo about all four of its tiles; every side is a door and a citizen leaves by
  the near one; a platform three tiles off the road is a door, its forecourt is
  walked tile by tile and priced by who is crossing, and it is refused if that
  ground is a river or a house; a bare wall shuts a door and a tunnel opens it;
  the growth rule reads the road ONLY through `served` — two lots at one and
  three tiles cap and score alike; the doors the card lists and the edges the
  commute graph rides are the same list in the same order, after a build, two
  years, a reload and an op; a building that GROWS across a forecourt closes it
  and everyone walking it re-plans that month; `ROAD_REACH` is a knob and the
  overlay survives it moving; the overlay really paints four bands, reddens only what
  asked, and the card says the distance in words),
  `budget.post` as the only cash mutator, relative imports, no
  `Math.random`, the sim blind to browser preferences, the title screen
  mounted over the owner's art, every sprite pixel a palette key, every
  anchor inside its sprite, 16/16 road masks, the painter key.
- `tools/play.mjs --years 20 --every 24` — **watch the game play itself.** The
  scripted mayor builds a town in the real sim and `js/render.js` — the file
  the browser loads — photographs it through `tools/headless-canvas.mjs`. No
  browser, no dependencies, no second copy of the drawing. The shutter can be
  a clock (`--every`, `--at 2003-06`), a camera roll (`--film 24 --fps 12`, so
  the walkers move), or **the news itself**: `--when "^FIRE" --after 0,2,4,6`
  fires on a ticker line, points the camera at the coordinates that line
  carries, and comes back months later to the same spot. Every shot is
  captioned with the town and the watched tile in words.
- `tools/accessprobe.mjs --rig deep` — a town the scripted mayor would NOT
  build (quarters seven deep roaded on one side, a line set three tiles back),
  because she rings every 6×6 and lays her line along a ring, so in her towns
  the footprint rule lifts nothing and no animal ever crosses a forecourt.
  In the deep rig at its default thirty years: 418 zoned lots the rule
  refuses with the real distance on each, 2 of 2 platforms that are doors only
  under the standard, and **46 commutes crossing 184 tiles of forecourt** (at
  `--years 20`, 39 crossing 156). Those last two move with the years, with the
  rail knobs — a faster train carries more of the town — and with the weather,
  because this rig runs WITH disasters: it exists for the case a fire moves a
  forecourt, so switching fires off would be switching the case off. A number
  quoted beside a command has to be the number that command gives, and these
  were re-measured at HEAD. `--cost` times the two hot paths and prints the
  town it timed them on; `--rig many` is a cost worst case rather than a
  town.
- `tools/accessprobe.mjs --layout millbelt` — what road access reaches and
  what it refuses: zoned lots by the distance the RULE reads beside the
  distance their own tile reads, how many sides each lot is entered from,
  the works the old frontage rule capped, every platform and whether the old
  adjacency rule would have reached it, served and unserved zoos, and the
  reason on every lot the rule refuses. `--save FILE` reads a real town.
- `tools/mayor.mjs` — the scripted mayor, hers alone. `playtest.mjs` prints her
  curves and `play.mjs` photographs her town; when the two disagree it is a
  flag and never a second mayor.
- `tools/serviceprobe.mjs --only fire --forced 6` / `--only police` — what a
  fire station and a police station actually BUY, over 40-year runs at 0 / 1 /
  2 / 4 / 12 of each. Fire asks its two questions with two instruments,
  because a fire is a supercritical branching process (two months × four
  neighbours × 0.3) that eats a whole block or none of one, and a 40-year run
  rolls about three: HOW OFTEN is exact arithmetic off `fireExposure()`, HOW
  BAD is measured with fires forced through the real roster card.
- `tools/shots.mjs --scene` — the depth-sort proof: a 12×12 block with every
  building family and twenty walkers at fractional positions, including one
  on a tile seam and one in front of the tallest tower.

## Design record

`SPEC.md` is the specification a three-design panel converged on
(systems-first, zoo-first, ship-first; three judges). `BACKLOG.md` holds the
labelled later layers. The art is text: every sprite is rows of palette keys,
built things are box solids through a z-buffer rasteriser, animals are
hand-authored.

## Licence

MIT.
