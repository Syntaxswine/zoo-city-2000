# PLAN — The People: needs, lives, faces, homes, meat (a master plan in eight parts)

The owner (2026-09-02, night): *"can you come up with a master plan for how to
really improve zoo city? … please break it up into parts so that multiple
agents can work on different parts at the same time. one part i'd like is to
be able to see the residents thoughts when they walk around. a larger goal of
relating more strongly with the individual citizens. i think more character
and variety in the building sprites might help."*

And, on reading the first draft: *"the thought bubble text should be clues
about needs, stuff like 'i wish there was more shopping nearby'. probably
the easiest thing to do is reuse the inspect button. also the meat market
should have more meat on hand. out of 2,800 animals they only sold 20 units
of meat in the whole history of the town and have 15 in cells."* → Part A
is NEEDS shown through Inspect (not flavour, not a follow system); Part C
shrinks to extending Inspect; a new Part H makes meat a STOCK with inflows.

And on H's two questions: *"natural deaths is a good option. selling cubs
sounds right, although i think the meat vendors would grow them to
adulthood for best return on investment."* → the hall buys the dead, and
the hall buys livestock cubs and PENS them until they are grown (§4-H).

And (2026-09-03): *"adding the control city is a good idea, i will build one
for you soon, please add on that the save button only lets you save the
game once, a load save menu would be better. i think we also need a GUI for
selecting build items. a remote control on the left side of the screen.
1 residential, 2 commercial, 3 industrial, 4 meat, 5 road, 6 wall, 7 rail,
8 train station, 9 tree, 10 park, 11 zoo, 12 pacification, 13 police,
14 fire. 15 inspect, 16 bulldoze. i think the other buttons can stay on the
top"* → Part S (a saves menu with named slots) and Part P (the palette),
and the control city becomes the suite's real-save fixture (§4-G).

And: *"railroads and roads should be able to cross over each other
perpendicularly."* → Part X, the level crossing (§4-X). And: *"citizens
traveling on the rails should move 50% faster"* → X2, the ride speed
(§4-X), read as 50% faster than they ride now (measured ×3.07 → ×4.5).
And: *"road access should not be limited to one side of a tile, as long as
a tile is within 1-3 tiles of the road it has road access."* → Part R
(§4-R): the law already reads that way in the code — so R makes access
VISIBLE, fixes the one staleness the probe found, and asks what was seen.
Then: *"i want that rule standardized, including rail and warehouses, and
zoos."* and *"the other way to think about it is that all sides have
access points"* → R4 is ONE predicate, `served`, doors on every side, and
a table of every rule that asks for a road (§4-R).

Plan only. Nothing here is built. Each part is sized for one agent-session,
owns its own files, and codes against contracts written down in §3 so the
parts can run at the same time. The keel (§3) lands first and is small.

---

## 0. The thesis: what makes a player care about one animal

A city builder's population is a number until the game does five things,
and Zoo City already does the sixth (stakes: an animal can be put in a
sack). Each part below is one of the five, and the sixth is served by all of
them.

| the player must be able to… | today | part |
|---|---|---|
| **hear what they need** — a clue the player can act on, in the animal's own words | the card says `mood 41` | **A. Needs (thought bubbles under Inspect)** |
| **remember** them — a past the player witnessed | a citizen has `born`, `friends`, a `record` and nothing else | **B. Lives** |
| **attend** to them — Inspect one and the card stays with it | the card follows the hover; a walker's card dies with the walker | **C. Inspect, extended** |
| **recognise** them — pick one out of a crowd | every rabbit is the same rabbit; elders one shade lighter; one hat | **D. Looks and faces** |
| **see them in their homes** — the house tells you who lives there | 12 families × 2 mirrored variants, no occupant on the outside | **E. Buildings with character** |
| **be told** what happened to them | 74–84% of dispatches never pop; no dispatch names a birth or an ordinary death | **F. The story channel** |

Plus four parts that are not about relating but were in the same breath:
**H. Meat on hand** — the hall's stock, its inflows and its till; **P. The
palette** — the build tools as a remote control on the left; **S. Saves** —
a menu of named slots instead of one checkpoint; **X. The level crossing**
— rail across a road, square-on; **R. Road access, seen** — the access
field on the overlay and the card, recomputed the moment a road is laid.

Then **G. Integration** — the suite, the docs, the browser round — after
the parts have merged.

The order of importance if the owner has to choose: **A, H, E, B, D, C,
F.** A and H are the two they named tonight; E is the other thing they
named; B is what gives A's card its past; D is cheap and makes every
screenshot better; C and F are plumbing.

---

## 1. Measured ground (numbers the plan has to respect)

Measured tonight on the committed code, seed 7, scripted mayor, balanced,
one meat market, stations on, 30 years (`scratchpad/savesize.mjs`; a
throwaway — part G writes the real instrument):

| figure | value | why it matters |
|---|---|---|
| P at year 30 | 1,732 alive · 1,055 households · 3,220 ids ever | the graveyard is as big as the town |
| save size | **906 KB**, of which citizens **732 KB** at **380 bytes each** | ~two thirds of a citizen's bytes are default `false`/`0`/`-1` fields; a biography ledger has to pay for itself — §4-B does, by compacting the save first |
| mean friends per citizen | **0.67** (1,154 links / 1,732) | the friendship graph is THIN. Most animals have no friend to lose. Needs and lives will lean on jobs, homes, smoke and neighbours more than on friends — and the low number is itself a design finding for later (it is a `FRIEND_P`/`FRIEND_MAX` knob question, not this plan's) |
| log rows in 30 years | 373 | the feed can afford ~+40% rows/year of people news before it drowns (§4-F budgets it) |
| walkers on screen | ≤ 150 | eight bubbles is the readable cap; a bubble per walker is noise — which is why bubbles live under the Inspect tool |
| the meat economy (2 markets, stations, a centre, 30 y) | halls 11 · killings **4** · sold **2** · cut **§38,931** | the halls earned §38.9k from `CUT_PER_JOB` (§25 per filled job a year) and §300 from bodies. Meat is not a quantity today — a killing near a hall posts §50 and a line, a convict §100. The owner's real game: 20 sold, 15 in cells, out of 2,800 animals. Part H |
| deaths in 30 years | ≈ 712 (3,220 ids − 1,732 alive − 776 left) | ≈ 24 a year of natural death — the supply the hall never buys (BACKLOG's "the market buys the dead") |
| a rider's speed on the map (the suite's rail fixture, one commuter, `scratchpad/ridespeed.mjs`) | walk **0.97** tiles/s · ride **2.99** tiles/s · ratio **3.07** | `RIDE_SPEED` 3 is real on the map; the felt commute says 0.3 of a walk (`RAIL_COST` 3 / `WALK` 10 = 3.33×) — two numbers for one fact, off by a tenth. X2 ties them |
| road access (`fields.computeRoadDist`, `hasAccess`; `scratchpad/accessprobe.mjs`) | a multi-source BFS from every road tile through ANY tile, 4-neighbour, any direction; access = distance ≤ `ROAD_REACH` **3** (SPEC §6: "SC2000, exact"); only a bare wall blocks it | **the law is already what the owner asked for.** Zone a tile, lay a road two tiles from it: before the next tick `roadDist` reads 4 and `hasAccess` is false; after the tick, 2 and true — **stale between an op and the tick**, which a PAUSED city (every loaded city opens paused) shows on the card until Space |
| the mayor's zoned lots by road distance, year 30 | 1: 325 · 2: 184 · 3: 60 · 4: **0** | the rig never zones past reach, and neither does the owner (*"roads around the whole perimeter, so nothing is more than 3 tiles away"*) — the growth rule sees every tile of both towns; what still demands a TOUCHING road is the station door and industrial tier 3 (R4) |
| **the rig's scale vs the owner's** | the scripted mayor builds `BLOCK` 7 (a 6×6 interior in a shared road ring) with the meat row IN the grid; the owner: *"I build city blocks as 6x6 blocks, sometimes larger. so there are probably going to be at least 30 tiles between residential and meat"* | **every radius-gated rule in the meat arc was tuned on the rig and is dead at the owner's scale** — see §1b. Every "units/yr" figure above is a rig figure until `meatprobe` runs on an owner-scale layout or the owner's own save |
| building families | 12 × 2 variants, `variant & 1` in `render.js:311` | `world.variant[i]` is a saved Uint8 — bits 1–7 are free, and keying by the TILE's byte is already the identity law |
| suite | 167 checks | every part adds its checks to the same file, in its own Part letter |
| the hover card today | name · species · age · home/job/mood · custody/record · trespass · friends · doing | this is the whole relationship surface; C rebuilds it around a citizen, not a tile |

### 1b. Scale — the meat arc's reach rules at 30 tiles

The owner, on the first draft of H: *"i dont think you and i are building
in the same way. i think some of it is scale. I build city blocks as 6x6
blocks, sometimes larger. so there are probably going to be at least 30
tiles between residential and meat."* The scripted mayor puts a meat block
in the same spiral as the houses, so a hall is always inside a few tiles of
someone. The rules as they stand tonight, read at the owner's distance:

| rule (code) | reach today | at 30 tiles |
|---|---|---|
| the dread field (`DREAD_RADIUS` 2/3/4 by tier) — herbivore fear, LV shadow, the rehome, carnivores' +5 | 4 tiles round the hall | **touches nobody's home**; `herbivores within the smell` is 0 in the owner's town |
| the killing's ×3 (`KILL_MARKET`: "a buyer within the smell") | `dread[home] > 0` → 4 tiles | **never fires** — the owner's killings are all fed-town killings at ×1 |
| the hall's §50 from a killing (`hallNear(killer.home, 6)`) | 6 tiles, and only if `dread[home] > 0` | **never**; a killing never reaches a hall — the owner has seen `SOLD` 20 times and a hall "had rabbit on Tuesday" never |
| SOLD (`hallWithAccess`) | town-wide, nearest by Chebyshev | works — which is why the owner's 20 exist at all |
| H's first draft: buy the dead / buy a cub "within 6" | 6 tiles | would have been the same mistake a fourth time |

**The law this plan adopts for H: meat travels by ROAD, town-wide.** A hall
has a reach that is the commute graph's, not a radius: `lotsWithinRoad`
already walks the road network to `maxRoad` 40 for job search, and
`fields.dial` already prices every step (and the rail). A hall's "buyers'
round" is the set of lots within `MEAT_ROAD` 60 walk-steps (a ride counts
0.3, like the commute), nearest hall wins a body, and the visible form is a
**cart walker** from the hall to the door and back — the sack already
proves the shape. The dread field stays a SMELL (4 tiles; that is what a
smell is); the mood and LV effects of a hall on its own block are right as
they are. `KILL_MARKET` and the hall's cut from a killing move onto the
same road reach, so a hungry wolf 30 tiles from a hall with a road to it
is "within the smell" for the weight's purpose — the plan says so in the
commit and expects the playtest's killings column to rise in the owner's
kind of town and not in the rig's.

**The rig must be the owner's town.** Two instruments before any knob:
- `tools/mayor.mjs` gains a layout `--layout estate` — `BLOCK` 8 (6×6
  interiors), residential quarters on one side, a commercial spine, an
  industrial quarter, and the meat row ≥ 30 road tiles from the nearest
  house, rail between — the owner's shape, in the sim's own mayor.
  `playtest` / `play` / `meatprobe` all take it (one mayor, SPEC §17).
- `tools/meatprobe.mjs --save <file>` runs the hall arithmetic on a REAL
  exported city (the LOAD panel exports one; `docs/fixtures/` can hold
  the owner's, with their say-so). A number from the owner's 2,854-animal
  town is the only number that counts; the rig's are for the curve's shape.

Every figure in this document that says "units/yr" or "within N" is a rig
figure until one of those two has run.

---

## 2. Laws every part obeys (SPEC §0, plus what this plan adds)

1. **Determinism.** No `Math.random`; the sim's stream for sim choices, the
   walkers' stream for display choices. A thought, a look, a bubble, a star,
   a follow — none may move the state hash. The suite's on/off hash check
   (SPEC §14) extends to every new display feature: **run 30 years with the
   feature on and off; the hashes are equal.**
2. **The sim never reads the browser.** `zoo.pref` (stars, follow) stays in
   `ui.js`/`main.js`; Part B of the suite greps `js/sim` for it. A starred
   citizen's toast is a UI line, **never a log row** — the log is saved and
   hashed.
3. **One implementation (Law 6).** A need about smoke is computed from the
   same term `moods()` subtracts; the town's need histogram is the same
   function over every citizen. A biography sentence is written by one
   function the card, the Census and the news all call. Never a second
   copy of a rule in the UI.
4. **Identity, never an index.** A citizen's look is `hash(id)`; a building's
   variant is `world.variant[i]`; a thought's phrasing is `hash(id, code)`.
   Nothing keyed by position in a list.
5. **Art is text (Law 5) — with one ruling this plan makes:** the bubble's
   BOX is a palette-key sprite; the LETTERS in it are canvas text in the
   panel's monospace, drawn in screen space, and are not audited as art.
   SPEC §12 gets the sentence. `render.js` stays the only canvas module —
   the card's portrait is painted by a `render.js` export, not by `ui.js`.
6. **Additive.** Old saves load (a missing `life` is `[]`; a missing `names`
   is `{}`); the scripted mayor's hash is unchanged by every part except
   where a part says so and proves the new number.
7. **The working tree is CRLF.** Patch scripts normalise on read and write
   back in kind. Stage explicit paths. Never `git add -A`.
8. **A new dispatch prefix must join `TICKER_*`** or it lands in the
   reader's "all" chip and nowhere else, silently (handoff §13b).
9. **Buildings are per-frame; the ground is cached.** Nothing in this plan
   needs `invalidate()` for a building change — but a part that adds a
   ground mark does.

---

## 3. The keel — lands FIRST, one agent, small (≈ 150 lines, ½ session)

Everything the parallel parts code against. No feature, no pixel; the suite
stays 167/167 and the mayor's hash does not move.

**K1. `moodTerms(world, c) → [{ code, value }]` in `js/sim/citizens.js`.**
`moods()` becomes `sum(moodTerms(...))` — the same terms in the same order,
so the hash is the proof. Codes, one per term as `moods()` stands tonight:
`BASE 50 · JOB +15 · NO_JOB −20 · SMOKE −0.5·excess · PARK +10 · DREAD ±
· VAN − · FRIENDS +5n · FLIGHT −min(20,·) · CRIME − · EVENT(id) ± ·
COMMUTE +10 · GRIEF −10 · PENALTY · FIXED − · HELD − · BOOST`. Part A reads
this list; nobody else recomputes a mood.

**K2. `js/sim/life.js` — the API only.**
```js
remember(world, c, kind, arg)      // pushes [tick, KIND[kind], arg] onto c.life (ring, LIFE_MAX 12); also pushes { id: c.id, kind, arg } onto world.lifeEvents
lifeLines(world, c) → string[]     // the sentences (stub returns [])
KIND = { BORN, ARRIVED, MOVED, HIRED, LOST_JOB, FRIEND, LOST_FRIEND, LITTER, LEFT_HOME, RETIRED, ARRESTED, FIXED, EXONERATED, KILLED, CENTENARY, ZONED_OUT }
```
`tick.js` resets `world.lifeEvents = []` beside `predations`; `newCitizen`
gains `life: []`; `save.js` writes `life` and `world.names` (the graveyard,
`{ id: "Name Surname·species" }`, empty tonight) and tolerates both absent.
No call sites yet — Part B adds them.

**K3. `world.majority[i]`** — a derived `Uint8Array` (species index + 1, 0
none), recomputed each tick in `census.js` from occupants (R) or staff
(C/I/M). Not saved; `rebuildDerived` recomputes it. Part E reads it.

**K4. `storyTick(world)` stub in `js/sim/story.js`,** called at the end of
`tick()` after justice. Part F fills it. It reads `world.lifeEvents` and
writes log rows; it is the ONLY place a life event becomes news.

**K5. Registry names reserved in `js/art/index.js`:** `art.bubble(w, h)`,
`art.portrait(species, opts)`, `art.mark(species)`, `art.look(id)`,
`art.crossing(axis, busy)` — each throws "not built" tonight so a caller's
typo fails loudly.

**K6. `walkers.list()` entries gain `need: null`** and `make()` gains
`look: art.look(id)` (returns `{ shade: 0, mark: 0 }` until D lands).

**K6b. `world.meat`** — a `Uint16Array(n)` per tile (units on hand at an M
lot), saved, zero tonight; `save.js` tolerates it absent. Part H fills it.
Adding the array now means H's save-format change and B's land in one
place and old saves are proved to load once.

**K7. This file's §5 ownership table** copied into `BACKLOG.md` under a new
heading, so an agent that only reads BACKLOG finds its lane.

---

## 4. The parts

Each part: the goal · the design · files it OWNS (nobody else edits them
while it runs) · the contract it exposes or consumes · acceptance · traps ·
size. "Done" for every part is the project's recipe (handoff §9): suite
green, SPEC section, BACKLOG entry, a handoff section appended (never
edited), commit with the field-notes message, pushed, a browser or
play-camera proof in the commit message.

### A. Needs — *"the thought bubble text should be clues about needs … reuse the inspect button"*

**Goal.** With the Inspect tool active, the animals near the cursor say
what they want — *"i wish there was more shopping nearby"* — and every
line is a clue the player can act on with a tool they have. The card says
the same thing for any citizen, and the census says it for the whole
town. Nothing a citizen says is flavour: it is the sim's own term that is
hurting, in the animal's words, with the remedy underneath.

**Design.**
- `js/sim/needs.js` (DOM-free, pure, no RNG): `needOf(world, c) → { code,
  arg, act }` — the largest ACTIONABLE deficit, from four sources that all
  already exist in the sim (Law 6 — a need is a term the code uses, never a
  new opinion):
  1. **The valves, as a wish.** `world.last.demand` is the town's want,
     spoken by the animal who feels it: `rC > 0.05` → `SHOPS` *"i wish
     there was more shopping nearby"* (act: zone C); `rR > 0.05` → `ROOMS`
     *"my cousins would come if there were rooms"* (zone R); `rI > 0.05` →
     `WORKS` *"there's money in a new works, they say"* (zone I); for a
     carnivore, `rM > 0.05` or its hall's `meat` at 0 (Part H) → `HOOKS`
     *"the hall's hooks are empty again"* (zone M / Part H).
  2. **The mood's deficits** from `moodTerms` (K1), only the terms a tool can
     answer: `NO_JOB` *"third month. nobody's hiring rabbits"* (zone C/I,
     rail); `SMOKE` *"the works gets in my fur"* (trees, a park, a wall,
     the scrubbers); `NO_PARK` (the +10 absent within 4) *"nowhere to sit
     in the sun"* (park); `COMMUTE` (the +10 absent) *"an hour each way"*
     (rail, roads, jobs nearer); `FLIGHT(species)` *"they moved in next
     door. all six."* (use-zoning, a wall); `DREAD` *"the hall's smell
     reaches the kitchen"* (a wall, the licence); `CRIME` *"someone tried
     the door again"* (police); `VAN` (carnivores) *"the van came down our
     street"* (— a clue with no remedy but the centre; still said).
     `GRIEF`, `HELD`, `FIXED`, `FRIENDS` are NOT needs (nothing to zone) —
     they belong to the card's life (B), not the bubble.
  3. **The home preference unmet** — `homeScore`'s own species terms read
     back at the lot the animal lives in: beaver/pig `WATER` *"no water for
     miles"* (zone nearer water); owl/bear/wolf/skunk `TREES` *"not a tree
     in sight"* (the tree tool); mouse/hawk `HIGH` *"wish we lived higher
     up"* (zone High); bear/cow `LOW` *"too many neighbours"* (zone Low);
     cow `PASTURE` *"no grass to speak of"* (a park); fox `LV` *"this
     street has come down"* (parks, trees, police); raccoon, the one joke
     the table allows, `CLEAN` *"it's too clean round here"* (— none).
  4. **The lot's own reason** from `lotScore` on the home lot (Law 6: the
     same call the growth rule makes): `NO_ROAD` *"no road to our door"*,
     `CAPPED` *"town's full — a park or a zoo, they say"*, `NO_DEMAND`
     *"nobody's building on this street"*; and the tax term when the rate
     is above neutral: `TAX` *"the taxes eat the wage"* (lower the rate).
  Ranking: |value| of the term in mood points, valves and lot reasons at a
  fixed weight (`NEED_VALVE_PTS` 8, `NEED_LOT_PTS` 6) so a real mood hurt
  outranks a town-wide wish; ties by `hash(id)`. Below `NEED_MIN` 4 points
  → `CONTENT` *"nothing to want today"* (rare; the glad face in D).
- `js/sim/voice.js`: `LINES[code][species | diet | default]` → 2–3 strings
  ≤ 30 characters, `{n}` `{species}` slots; `line(world, c, need)` picks by
  `hash(c.id, code) % n` — **the same animal always says the same thing
  about the same want.** Every code also carries `ACT[code]` — the remedy
  in the tool's own words (*"zone C within 6 road tiles"*) — printed under
  the bubble's line on the card and in the census.
- **Inspect is the switch.** With tool 9 active: every walker within
  `NEED_REACH` 6 tiles of the cursor gets a bubble, nearest first, cap
  `BUBBLES_MAX` 8; the pinned citizen's walker always. Any other tool: no
  bubbles. (An OPTIONS switch *ambient thoughts* — one random bubble every
  4 s under any tool — is a BACKLOG line, not this part.) `walkers.list()`
  carries `need` (recomputed at each tile centre; the walker layer never
  stores the text, only the code, so the card and bubble agree).
- `js/render.js`: `drawBubbles(list, cursor)` after the scene, in screen
  space after the transform is reset: `art.bubble` nine-sliced to
  `measureText` + 6 px, the panel's monospace at 10 px screen pixels (not
  scaled with zoom), 1-px ink border, a 3-px tail to the head (dy −24
  adult, −16 cub), clamped to the canvas, painted in (tx+ty) order.
- The card (C prints, A supplies): `wants: "the works gets in my fur"` and
  a dim `→ trees or a park within 4` under it, for ANY citizen, walker or
  not. The house card: the household's top need. **The Census tab gains
  "what the town wants":** the need histogram over every citizen this
  tick (`needCensus(world)`, computed on tick, cached on `world.last`) —
  *SHOPS 412 · NO_PARK 288 · SMOKE 140 …* — the same function, so the
  dashboard and the bubble can never disagree. That histogram is the
  cheapest advisor the game will ever have.
- `tools/peopleprobe.mjs` (new, exit 0 always): 4 seeds × 30 y × 3 layouts
  (balanced / dormitory / millbelt), every citizen monthly through
  `needOf`: the histogram, the `CONTENT` share, and per layout the TOP need
  — the dormitory must say `NO_JOB`, the millbelt `SMOKE`, the balanced
  town something else. The commit message carries the table.

**Owns.** `js/sim/needs.js`, `js/sim/voice.js`, `js/walkers.js`, the
bubble block in `js/render.js` (its own function, `drawBubbles`), a
`BUBBLE` sprite in a new `js/art/bubbles.js`, the Inspect-tool hook in
`input.js` (ONE line: `walkers.setCursor(tile | null)` when tool 9 is
active — C owns the rest of `input.js`), `tools/peopleprobe.mjs`, the Part
E' checks in `tools/check.mjs`, SPEC §14b, `docs/shots/sheet-bubbles.png`.

**Consumes.** K1 `moodTerms`, K3/K6b (`world.meat` for `HOOKS` — reads 0
until H lands), `lotScore`, `homeScore` (export the per-term breakdown the
same way as K1: `homeTerms(world, species, i)`, and `bestHome` sums it —
hash-proved; this is A's one edit in `citizens.js`, coordinated with B's
one-liners by hunk), K5 `art.bubble`, K6.

**Acceptance.**
- Every code `needOf` can return has a line in the default table and an
  `ACT`; every species/diet override is a known code (a table typo fails).
- **Discrimination:** over the probe's 360 city-years every code appears
  at least once and no code is > 40% of non-content samples; the three
  layouts have three different top needs. A need that never fires is dead
  text; one that fires everywhere is noise.
- **Truth:** mutation — zero the `SMOKE` term in `moodTerms` → the
  millbelt's `SMOKE` share is 0; set `rC` to 0 → no `SHOPS`; the checks
  fail if not. And the remedy works: in the suite, a town whose top need
  is `NO_PARK` gets a park placed by the check and the count falls within
  a year (the clue was true).
- Hash: 30 years with Inspect bubbles on and off equal; `js/sim` never
  reads `.need` or the cursor (grep).
- Browser: seed 7 ring city, Inspect active, cursor on a busy street at
  ×1 and ×2: a screenshot with ≥ 4 legible bubbles; switch to the road
  tool: none; the card's `wants` line matches the bubble; the census
  histogram's top three; 0 console messages; the frame with 8 bubbles
  costs < 1 ms over the frame without (`performance.now()` around
  `draw`).

**Traps.** Canvas text scales with the zoom transform — draw bubbles AFTER
resetting it. `measureText` per frame ×8 — cache by text. The hidden pane
fires no rAF: verify with the sim paused and `app.walkers.update(0.05, …)`
by hand (handoff §14's recipe). `world.last` is null on tick 0 — `needOf`
must answer `CONTENT` before the first tick. A valve wish spoken by 1,600
animals at once is the noise case — the ranking weights exist to keep a
personal hurt above the town's wish; the probe's 40% line is the guard.

**Size.** ≈ 350 lines sim + 100 walkers + 80 render + 60 art + 200 probe;
~14 checks; one session.

### B. Lives — the biography every animal carries

**Goal.** The card reads like a life: *born here 1998 to the Burrowes ·
moved to (12,30) 2003 · hired at the works 2004 · befriended Fenpa Howell
2006 · lost Fenpa 2011 — the wolves · retired 2033.* And the town remembers
its dead by name.

**Design.**
- Fill K2. Call sites, each ONE line `remember(world, c, KIND.X, arg)`:
  `citizens.js` — arrival placement (`ARRIVED`, lot), birth (`BORN`, lot;
  the parents get `LITTER`, n), the 16-year split (`LEFT_HOME`), rehome
  (`MOVED`), retirement month (`RETIRED`), `befriend` (`FRIEND`, id — both
  sides), `removeCitizen` (`LOST_FRIEND`, id + cause, to every friend; and
  the graveyard write `world.names[id]`); job search hire (`HIRED`, lot),
  `releaseJob` when the lot dies (`LOST_JOB`); `justice.js` — arrest
  (`ARRESTED`, cause), `fixed`, `exonerated`, the killing (`KILLED`,
  victim id, on the killer); `events.js` — the centenary; the zoned-out
  notice (`ZONED_OUT`).
- `c.life` is a ring of `LIFE_MAX` 12 triples `[tick, kindId, arg]` — the
  first two entries (birth/arrival, first home) are PINNED and never roll
  off; the ring is the last ten.
- `world.names`: written on every removal, pruned to `NAMES_YEARS` 20 by
  death tick in `compact()`. ~45 KB at year 30.
- `lifeLines(world, c)` — the one writer of sentences (Law 6): dates in the
  game's year, lots as `(tx,ty)` plus the family name that lives there NOW
  if any, names through `byId` then `names` then "someone".
- **The save pays for it:** first commit, before any call site — `save.js`
  omits a citizen's DEFAULT fields (`false`, `0`, `-1`, `null`, `[]`) and
  `load` restores them from `newCitizen`'s defaults. Prove: an old save
  loads and hash-equals; the year-30 save shrinks (expect 732 KB → ~300 KB
  of citizens). Then the ledger's +~150 KB is a net saving.
- The Census tab gains a **Memorial** line (F/C render; B provides
  `memorial(world) → [{ name, species, age, cause, tick }]` for the last
  12 months from `names` + a small `world.deaths` ring).

**Owns.** `js/sim/life.js`, `js/sim/save.js`, the call-site lines in
`js/sim/citizens.js` / `justice.js` / `events.js` (one-liners only — A
never edits these files after K, F never edits them at all), the Part F'
checks, SPEC §7.10, `tools/savesize.mjs` (the throwaway made real: prints
the year-30 save's size by section; exit 0).

**Contract exposed.** `c.life`, `world.lifeEvents` (per tick), `world.names`,
`lifeLines`, `memorial`, `KIND`.

**Acceptance.**
- The dangling-id law extends: every `FRIEND`/`LOST_FRIEND`/`KILLED` arg
  resolves through `byId` or `names`; the ring never exceeds 12; the
  pinned two survive 20 events.
- **Every KIND is observed at least once** in the 30-year forced run (the
  suite already forces a killing, an arrest, a centenary — reuse those
  fixtures); a kind never observed fails — that is the mutation test for a
  dropped call site.
- Save → load → continue hash equal with lives on (the standing check);
  old-save fixture (`docs/fixtures/save-v1-plain.json`, committed by B)
  loads and its 10-more-years hash equals the pre-B number written in the
  commit message.
- `savesize.mjs`: citizens' bytes at year 30 ≤ 60% of tonight's 732 KB
  with the ledger in.

**Traps.** `removeCitizen` runs in the same tick as the friend's `moods()`
— record `LOST_FRIEND` BEFORE the splice, or the friend list is already
empty. `compact()` renumbers nothing (ids are stable) — but check
`world.names` is pruned there and nowhere else. A `MOVED` at arrival is not
a move — `ARRIVED` only. The centenary is logged in `events.js` since
session 8 (`say(id, line)`); hook the same place.

**Size.** ≈ 250 lines + 30 one-liners; ~10 checks; one session, the save
compaction first as its own commit.

### C. Inspect, extended — *"reuse the inspect button"*

**Goal.** The Inspect tool (9) already pins a card. Make the pin a CITIZEN
(not a walker, not a tile), so the card outlives the walk, and make the
card the whole relationship: face, wants, life, friends. Follow and
favourites are the stretch half, not the core.

**Design.**
- `js/follow.js` (DOM-free): `pinTarget(world, walkersList, id) → { tx,
  ty, state: "walking" | "home" | "away" | "gone", line }` — pure, so it is
  unit-checked in Node. "away" = at the centre/cells/winter; "gone" = dead
  or emigrated (the target holds on the last known home and the line is
  the epitaph from `lifeLines`).
- `input.js`/`main.js`: under Inspect, clicking a walker or a name in a
  card → `app.pin = { citizen: id }`; clicking a lot pins the lot as today;
  `Esc` unpins. The pinned citizen's card outlives the walker; when the
  citizen dies the card stays with the epitaph until the next click. The
  hovered walker's card still shows on hover as today.
- `ui.js`: `cardForCitizen(id)` replaces `cardForWalker` (the walker is one
  input to it): portrait (D, via `render.paintPortrait(canvas, sprite)`),
  name · species · age · household line · home/job · **wants:** + the dim
  remedy (A) · **life:** (B, last 4 lines, "more" expands) · friends (each
  a link that pins that friend) · doing.
- The house card lists its households with each member a link (pin), and
  the household's top need (A).
- **Stretch, only after the card is done:** `F` follows the pinned citizen
  (camera lerps to `pinTarget`, 4 tiles/s, released by any drag);
  `walkers.attend(id)` samples it first when its path crosses the
  viewport; `S` stars it into `zoo.pref.stars[city]` (browser-only, like
  read marks), and a **People** section at the top of the Census tab
  (not a fifth tab — `#tools` must not unwrap, handoff §11) lists starred
  citizens with find · follow. Starred citizens' `world.lifeEvents` become
  UI toasts (`flash`, never a log row — Law 2).

**Owns.** `js/follow.js`, `js/input.js` (all but A's one cursor line),
`js/main.js`, `js/ui.js` (the card, the Census People section),
`css/field.css`, `attend()` in `walkers.js` (ONE function, coordinated
with A), the Part G' checks, SPEC §11c.

**Consumes.** A's `needOf`/`line`/`ACT`, B's `lifeLines`/`memorial`/
`lifeEvents`, D's `art.portrait` + `render.paintPortrait`. C can start on
day 0 against the K stubs and fills the card as the others land.

**Acceptance.**
- `pinTarget` in Node: walking → the walker's tile; between walks → home;
  after `removeCitizen` → "gone" with the epitaph; a citizen with no home
  → "away".
- `js/sim` never reads `zoo.pref`, `pin`, `stars` (grep).
- Browser: Inspect, click a rabbit, let its walker finish: the card stays,
  says `at home`; bulldoze its job lot: the card's `wants` turns to
  `NO_JOB` on the next tick; click a friend's name: the pin moves; 0
  console messages. Stretch: F keeps the camera within 3 tiles of it for a
  game year at ×3.

**Traps.** The card is rebuilt on every hover today — a pinned card must
not flicker (rebuild only on tick or pin change). A loaded city opens
paused; a follow camera must not lerp while paused. The Census People
section walks all citizens — compute on tick, not on render.

**Size.** ≈ 100 follow + 200 ui + 60 input/main + 30 css; ~6 checks; half
a session for the core, a session with the stretch.

### D. Looks and faces — one rabbit is not another rabbit

**Goal.** Four looks per species per age, a face for the card, and an idle
pose — so the player can pick their rabbit out of the crowd and the card
has eyes.

**Design.**
- `art.look(id) → { shade: 0|1, mark: 0|1 }` from `hash(id)`. Shade 1 = the
  fur ramp one step DARKER (elder is one step lighter — the two compose;
  never off the ramp: Law 5). Mark = one hand-authored piece per species,
  SE and NE, ≤ 6×6 px, placed by the head/tail composer: fox white tail-
  tip · rabbit lop ear · mouse notched ear · beaver pale chest · owl brow
  tufts · bear muzzle patch · tortoise scute · raccoon lighter mask · pig
  spot · cow Holstein patch · wolf grey saddle · cat tabby stripe · hawk
  chest bars · skunk double stripe. Cubs: shade only. Elders: a glasses
  piece (1, like the hat) on 1/2 of elders by hash. Cache key gains `s m g`.
- `art.portrait(species, { age, shade, mark, expression }) → 16×16`: the SE
  head rows of the kit lifted into a frame, eyes and mouth by expression
  (`glad` ≥ 70 · `flat` · `low` ≤ 30: two pixels each). 14 × 3 × looks —
  composed lazily like everything else.
- `render.paintPortrait(canvas, sprite, scale)` — the one canvas export
  `ui.js` may call (Law 5's ruling).
- Idle pose (stretch, do last): one SE frame per species (rabbit sits up,
  cat washes, owl turns its head, bear scratches, tortoise withdraws),
  mirrored for the rest; a walker standing > 1 s plays it (A's walkers
  code reads `w.idle`; D adds the frame index `frame: 3`).
- `walkers.make()` copies `look` (K6); `render.js`'s two `art.citizen`
  calls pass `look` and the card's portrait passes the same.

**Owns.** `js/art/citizens.js` (the art — A does not touch it; A's bubble
lives in `art/bubbles.js`), `art.look`/`art.portrait` in `index.js`,
`paintPortrait` in `render.js` (one export, its own function), the
`sheet-looks.png` / `sheet-portraits.png` blocks in `tools/shots.mjs`, the
Part C additions in `check.mjs`, SPEC §12.3b.

**Acceptance.**
- The four looks of every species × age differ pairwise (rows not equal);
  a mark changes pixels only inside its declared piece box; the carrying
  sprite (SPEC §14) still has the plain sprite's body rows with a mark on;
  anchor on the feet for all.
- 14 portraits × 3 expressions exist, 16×16, every pixel a key, expressions
  differ.
- The audit walks every look (`allCitizens` adds one species × 4 looks ×
  4 facings × 3 frames + all 14 portraits × 3).
- Sheets committed; the commit message names the three ugliest marks by
  the critic's eye and what was done about them (the art workflow of
  session 1: artist + 2 PNG-reading critics, ≤ 3 rounds).

**Traps.** The tortoise's 1-px outline is clipped by the 12-px grid
(handoff §14) — a mark on its shell must not be. Mirror-lit: a mark on the
LEFT of a SE sprite lands on the RIGHT of SW — author marks symmetric or
accept the flip and say so. The predation figure at the door (`w.prey`) is
built from a record — give the record a `look` too (B's `KILLED` arg or
A's prey figure: `art.look(victim.id)`, it is pure).

**Size.** ≈ 400 lines of art text + 80 composer + 40 shots; ~8 checks;
one session with the art workflow.

### E. Buildings with character — *"more character and variety in the building sprites"*

**Status (2026-09-03, session 9):** the owner redirected E's first act to
the BUILDING REDUX — *"some of commercial, industrial, residential, and
meat buildings to be 2x2 and 3x3 tile sizes … the buildings that can hold
a lot of people … new cute images … a more high res sprite set for when the
camera is zoomed in."* SHIPPED in four commits: the painter's ray audit and
size-aware pull-back; `js/sim/blocks.js` (SPEC §3b, §5 MERGE/SPLIT; RULES
G5; 17 checks); `js/art/blocks.js` (SPEC §12.2b, eight families × two
variants); `js/art/hires.js` (SPEC §12.6). What remains of E as drafted
below — variants 2 → 4, lit windows by fill, species marks on a socket,
wear — is still open and still E's; blocks.js is a second file beside
buildings.js exactly as the trap paragraph asked, and the block families
would take marks and lit windows through the same `KIT`.

**Goal.** Four plans per family instead of two mirrored ones; windows that
light with the people inside; a mark on the outside that says who lives
there. The house becomes part of the citizen.

**Design.**
- **Variants 2 → 4.** `render.js:311` reads `world.variant[i] & 3`. Two new
  authored plans per family (24 plans, all box solids through the existing
  rasteriser, the footprint gate already checks them): R1 porch + dormer /
  L-plan + lean-to · R2 bay window / mansard · R3 corner balconies / roof
  garden setback · C1 corner entrance / kiosk row · C2 clock face / arcade
  front · C3 setback tower / twin stacks · I1 open shed + stack / kiln ·
  I2 chimney pair / conveyor bridge · I3 cooling tower / gantry · M1–M3 a
  hook rail / a tiled front / a chimney hall (M is 4 × 3 = 12 sprites today;
  keep the abattoir for the landmarks proposal). Variants 2 and 3 of a
  family are NOT mirrors of 0 and 1 — that is the point.
- **Lit windows by fill.** `lit = floor(4 · fill)` (0..3) on R (occupants/
  capacity) and C/I/M (staff/jobs); the window skin returns the lit key
  `-` for a deterministic subset of window cells (`hash(i, cell) % 4 <
  lit`), so a full tenement glows and a vacant one is dark. Sprite cache
  key gains `lit`. Buildings are per-frame, so no invalidation.
- **Species marks.** `art.mark(species)` = one stamp ≤ 6×6 px per species;
  each plan declares a `socket` (a wall cell beside the door and a roof
  cell); `world.majority[i]` (K3) chooses the stamp: warren round door ·
  mouse's small second door · fox brush weathervane · beaver timber gable ·
  owl roost pole · bear porch bench · tortoise stone step · raccoon bins ·
  pig mud patch · cow gate · wolf pack banner · cat window ledge · hawk roof
  spike · skunk a warning stripe on the kerb. C/I/M marks go on the roof
  socket (the shop's majority STAFF). The card says *a warren door — the
  Burrowes live here*.
- **Wear (stretch).** `world.since[i]` Uint16 (the tick the tier last
  rose; saved, +8 KB): ivy stamp after 15 years, a patched roof after 25.
  Only if the four variants and the marks are in.

**Owns.** `js/art/buildings.js`, `art.mark` in `index.js`, the building
block in `render.js` (`standing = …` and the sprite-key lines ONLY), the
`sheet-buildings.png` / `sheet-marks.png` blocks in `shots.mjs`, Part C
additions, SPEC §12.2b, the card's mark sentence in `lots.js`'s
`lotReport` (a `mark` field; C prints it).

**Consumes.** K3 `world.majority`.

**Acceptance.**
- Footprint gate holds for all 24 new plans (the existing check runs over
  `allBuildings`); the four variants of every family differ pairwise; a
  mark's pixels lie inside its socket box; lit 0..3 is monotone in ink
  count of `-` cells; every species has a mark.
- The play camera (`tools/play.mjs --at 2020-06`) on seed 7 before and
  after: the SAME lots stand (the hash did not move) and the PNG differs —
  the "render upgrade must be visible" rule; commit the two frames.
- Sheets committed; the critic round as in D.

**Traps.** `variant & 1 → & 3` changes what half the town looks like — that
is intended; say so in the commit and re-shoot `docs/shots/*.png`. The
zoo's 2×2 depth path is the only multi-tile precedent — the landmarks
proposal (3×3) also wants `buildings.js`; **put landmarks in
`js/art/landmarks.js` when they come so the two can run apart.** A mark on
a mirrored variant sits on the other side — declare sockets per variant,
not per family.

**Size.** ≈ 500 lines of plans + 100 marks + 40 render + 60 shots; ~8
checks; one session, two if wear is in.

### F. The story channel — being told

**Goal.** The news tells the town's people-stories (an obituary, a litter,
a first job for a starred family's cub), every named row is clickable, and
the yearly REPORT names the year's people.

**Design.**
- Fill K4. `storyTick` reads `world.lifeEvents` and writes log rows with a
  `who: [ids]` field (saved with the log — small): `OBITUARY` for a death
  with ≥ 3 mourners (*"Fenpa Howell, 61, a wolf of (12,30), mourned by
  four"*), `LITTER` (*"a litter of three to the Burrowes of (12,30)"*), the
  `CENTENARY` moves here from `events.js` (one writer — coordinate with B,
  who hooks the same place: F's `storyTick` reads the `CENTENARY` life
  event B records; B stops logging it). Budget: ≤ +40% rows/year measured
  by `newsprobe.mjs`; none of them in `TICKER_FLASH` except the obituary of
  a centenarian.
- The reader's fifth chip **people** = rows with `who.length`; a name in a
  row is a link → `app.pin` + centre on the home (C's `pin` API).
- The yearly REPORT gains two sentences from `census.notables` (C owns
  `notables`; F consumes): the oldest resident, the largest household.
- `TICKER_*` gains `OBITUARY|LITTER`; the per-event chip check the handoff
  asked for (§13b) is built here: every `id` in `events.js`'s roster and
  every `story.js` prefix appears in exactly one chip's regex.

**Owns.** `js/sim/story.js`, `js/news.js`, the `TICKER_*` regexes, the
REPORT lines in `events.js`'s advisor (ONE function; B's call sites are
elsewhere in the file), `tools/newsprobe.mjs`, Part H' checks, SPEC §11b
additions.

**Consumes.** B's `lifeEvents`/`names`, C's `pin`, C's `notables`.

**Acceptance.**
- The chip check above; `newsprobe` shows people rows ≤ 40% of the feed
  over 4 seeds; every `who` id resolves via `byId` or `names`.
- Hash: `stateHash` excludes the INPUT log and history but hashes `events`,
  and the news log lives in `events.log` — so the mayor's hash MOVES with F
  (new rows). The commit records the old and new hashes and proves the ONLY
  difference is the news: F adds a `stateHashNoNews` (the same FNV with
  `events.log` deleted) to the suite for this one proof, and that number
  must equal the pre-F run's.
- Browser: a death with mourners prints; clicking the name pins the dead
  citizen's epitaph card (C).

**Traps.** Handoff §13b, all of it: the un-anchored `ONE HUNDRED`, the
400/200 log cap that cuts a month in half (a row's name is its words —
keep `keyOf`), the hidden pane's timers. An obituary for every death is
~40 rows/year in an 1,800 town — the mourner gate is the budget.

**Size.** ≈ 150 story + 80 news + 40 events + 40 probe; ~6 checks; half a
session.

### H. Meat on hand — *"the meat market should have more meat on hand"*

**Goal.** Meat is a QUANTITY the hall holds, with inflows the town
produces and an outflow the carnivores eat, and the card, the census and
the news read it. Today it is a counter and two prices.

**What is wrong, measured (§1).** Scripted town, two market blocks, 30
years: 11 halls, 4 killings, 2 sold, §38.9k of "cut" — of which §300 was
bodies and the rest `CUT_PER_JOB` (§25 per filled job a year). The owner's
real game: 20 sold and 15 in the cells out of 2,800 animals. The sentence
table is working as ruled (predator's first → the centre; prey or the fixed
→ the hall; a trespass minor → the cells until `RECORD_HARD` 3): SOLD is a
rare outcome of a rare arrest, and the killing (`KILL_P` 0.3/yr in a fed
town, ×3 within a hall's smell) is rare by design. **The hall's stock
cannot come from crime alone**; the town's 24 natural deaths a year are the
supply that is never bought (BACKLOG has held this as "the market buys the
dead — v2" since session 3).

**Design.**
- `world.meat[i]` (K6b): units on hand per M lot. One unit = one body.
- **Reach is by road (§1b), never a radius.** `hallReach(world, lot) →
  { hall, steps }`: the nearest built hall with road access within
  `MEAT_ROAD` 60 walk-steps of the lot's door on the commute graph (a
  ride 0.3 of a walk, like `commuteTime`), or none. Computed once a tick
  for the lots that need it (a death, a killing, a full livestock lot —
  dozens, not thousands); `lotsWithinRoad` is the precedent. The dread
  field keeps its 4-tile smell; `KILL_MARKET` and the hall's cut from a
  killing move from `dread[home] > 0` to `hallReach(home).hall >= 0`.
- **Inflows**, each ONE unit to the hall `hallReach` names:
  1. **The killing** → the killer's hall by road (today only a hall inside
     the 4-tile smell earns the mayor §50 and a line — at the owner's
     scale, never); the sack walks INTO the hall when one is in reach (the
     walker-layer item BACKLOG already lists — the killer's leg 1 goes to
     the hall's door by `roadPath`, however far, then home).
  2. **The dead** (the owner: *"natural deaths is a good option"*) →
     `buyTick`: a natural death whose home has a hall in road reach is
     BOUGHT with p `MEAT_BUY_P` 0.6, any species — the Beastars rule; the
     family's household gets nothing (there is no household cash) but the
     mayor's cut gets `MEAT_PRICE` §50 as it does for a killing, and the
     line says so (*"…and the cart from the hall at (30,12) called at the
     house"*). The visible form: a **cart walker** (`w.kind = "cart"`, a
     hall staffer with a handcart sprite — D authors the cart as a carry
     variant like the sack) from the hall to the door and back, on the
     roads; in a town like the owner's that is a 30-tile round trip the
     player will see. ≈ 24 deaths/yr in the rig, and in the owner's town
     of 2,854 more — with p 0.6 and every house on a road to a hall, the
     hall buys most of them. **The knob to set on the owner's layout is
     `MEAT_BUY_P`, not a radius.**
  3. **The sentence** — SOLD as ruled, unchanged. The lever for volume, if
     the owner wants more sold and fewer in cells, is `RECORD_HARD` 3 → 2
     (a second trespass meets the table) — a knob, named, not moved.
  4. **Livestock, raised in the pen** (the owner: *"selling cubs sounds
     right, although i think the meat vendors would grow them to adulthood
     for best return on investment"*). Pigs and cows are the livestock
     species. `penTick`: a hall with a free pen place buys a CUB (age <
     `ADULT_AGE` 16) from a livestock household with a hall in road reach
     whose lot is FULL (the crowding push that already halves births — the
     farm sells what it cannot house) with p `PEN_BUY_P` 0.25 per eligible
     household-month; the mayor's cut gets `PEN_PRICE` §30; the cart
     walker fetches it (the cub walks beside the cart). The cub moves
     to the hall: `c.heldAt = hall`, `c.held = tick + monthsToAdult`,
     `c.pen = true` — so every existing reader (`absent()`: no job, no
     friendship sample, no mood, no investigation, no prey flight from it)
     treats it as away, the way the centre's inmates are. It keeps its
     name and its age. **On the month it turns 16 it is slaughtered**, not
     released: `PEN_YIELD` 2 units (a grown animal against a bought
     body's 1 — the vendor's return on investment, in the owner's words),
     `removeCitizen(…, "slaughtered")`, the parents' household gets the
     `LOST_CHILD` life event (B) and no grief (a farm sale, not a death —
     the owner's farm economy), and the line prints *"THE PEN — Piglet
     Buttercup, raised at the hall at (30,12) since 2007, went to market
     this morning"*. The pen holds `PEN_CAP` 2 / 4 / 8 by hall tier. The
     hall's card lists the pen by name and date: *in the pen: Piglet
     Buttercup, 12 — for market 2011*. The walker layer stands the penned
     animals beside the hall (a camper-like standing figure at the lot's
     road edge, `w.kind = "penned"`, from the sim's `heldAt`; read-only).
     Penned cubs do NOT split at 16, do not count in W, cannot be
     befriended, cannot be killed by a predator (they are `absent()`), and
     a bulldozed hall frees them home (like the centre) — a check for each.
- **Outflow**: `eatTick` per hall per month: `demand = MEAT_EAT ×
  carnivores whose home names this hall by road reach` (0.05 → 40
  carnivores eat 2 units a month; the customer walkers BACKLOG lists are
  the visible form — a stroller's goal list gains the hall for
  carnivores); `sold = min(stock, demand)`; the till `MEAT_SALE` §20 ×
  sold → the C rate's tax when licensed, else the mayor's cut (the
  licence's existing split). `ev.justice.sold` stays the CONVICT count;
  the census gains `meatSold` (units) and `meatOnHand` (Σ stock).
- **Read back into the sim, weights never gates:** a hall's `lotScore`
  local term gains `+MEAT_LOCAL × min(1, stock/8)` (a stocked hall grows)
  and the dread field scales `×(0.5 + 0.5·min(1, stock/8))` — a full hall
  smells, an empty one half as much. Part A's carnivore `HOOKS` need reads
  `stock === 0`. The mayor's `rM` valve is unchanged.
- **Readouts:** the hall's card `meat on hand 12 · sold this year 40 ·
  bought 9 dead, 2 killings`; the census line; two ticker lines — `EMPTY
  HOOKS — the hall at (30,12) has nothing on the hooks` (once per hall per
  dry spell, `TICKER_FLASH`) and a yearly `THE MARKET — 118 units, 96 of
  them bought at the door`; the Rules tab entries M4–M6.
- **Measure first, like session 8, and on the owner's shape (§1b):**
  `tools/mayor.mjs --layout estate` (6×6 blocks, the meat row ≥ 30 road
  tiles from the houses, rail between) and `tools/meatprobe.mjs` (exit 0;
  `--save <file>` takes an exported real city) print, per seed × layout,
  inflow by source, the stock curve, units sold per hall-year, cart trips
  and their mean length, and the cut — BEFORE the knobs are chosen, then
  after. The target, on `estate`: a two-hall town holds 5–20 units and
  sells most of what it buys; a hall with no road to any house runs dry
  and prints. The balanced rig is the curve's shape only.

**Owns.** `js/sim/meat.js` (`hallReach`, buy/pen/eat/readouts),
`tools/mayor.mjs`'s `estate` layout (one new layout branch — playtest and
play take it unchanged), the cart walker (`w.kind = "cart"`, one spawn
function in `walkers.js` beside `hallLeg`), the hall lines in
`justice.js`'s `kill()` and `arrest()` (the two `post(world, "cut", …)`
sites — B's one-liners are elsewhere in those functions; merge by hunk),
`budget.js`'s till line, the M-zone local term in `lots.js`, the dread
scale in `fields.js`, the `MEAT_*` knobs in `rules.js` + Rules entries,
the M hall card lines in `ui.js`'s `cardForTile` (ONE block — C owns the
rest of `ui.js`), `world.meat` in `census.js`, the Part I' checks,
`tools/meatprobe.mjs`, SPEC §9c addition, the predation walker's hall leg
in `walkers.js` (ONE function `hallLeg`, coordinated with A).

**Consumes.** K6b, B's `KIND.KILLED` (no dependency — H records nothing
in the ledger; B's `LOST_FRIEND` cause `"sold"` already exists).

**Acceptance.**
- The hash MOVES (a sim change); the commit records before/after on the
  standing gate (`--markets 1 --csv`) and the meatprobe table.
- Conservation: `Σ bought + killed + convicted + 2·slaughtered − eaten =
  Σ stock` over a run, exact; stock ≤ `MEAT_CAP` 40 per hall; a hall with
  no road buys nothing; a dry hall prints EMPTY HOOKS once, not monthly.
- The pen: a penned cub is `absent()` for its whole stay (never hired,
  never sampled for a friendship, never a prey-flight source, never a
  killing's victim — force each with the suite's fixtures); it is
  slaughtered on the exact month it reaches 16 and yields 2; the pen never
  exceeds its cap; a bulldozed hall sends its pen home alive; the parents'
  household carries `LOST_CHILD` and no `grief`.
- Monotone: `MEAT_ROAD` 0/20/40/60/∞ → units bought rises on `estate`
  and is FLAT on `balanced` past 20 (the rig cannot test reach — "the
  easy case cannot test"); `MEAT_BUY_P` 0/0.3/0.6/1 → bought rises;
  `MEAT_EAT` 0/0.05/0.1 → sold rises and stock falls — the service-curve
  rule; every column printed.
- The killing reaches the hall on `estate`: force one (the suite's recipe)
  with the killer 30 road tiles from the hall — the stock ticks and the
  sack's leg goes to the hall door; and `KILL_MARKET` fires there
  (`killWeight` ×3 with a hall in road reach, ×1 with the road cut).
- Mutation: cut the buy → stock stays at the killing count; cut the eat →
  stock climbs to the cap.
- Old saves load with `meat` absent (zeros) and hash-equal for the
  pre-H continuation.
- Browser: a hall's card shows the three numbers; force a death beside it
  (the cheat + bulldoze a house — evictions are not deaths; use the
  suite's forced-killing recipe instead) and watch the stock tick; the
  sack walks into the hall.

**Traps.** `ev.justice.sold` is the CONVICT counter the census prints and
the suite pins — do not overload it with units. A death in `compact()`'s
sweep happens after `removeCitizen`; the buy must hook `removeCitizen`'s
cause `"died"` (or a per-tick `world.deaths` list like `predations`),
never the sweep. The licence changes who gets the till — read
`budget.js:40` before adding a second path. Dread scaling by stock moves
every herbivore's mood in a hall's reach — expect the playtest's
`herbivores within the smell` and the flight numbers to shift; say so.
**The pen rides on `held`/`heldAt`, and `held`'s expiry today RELEASES
the animal home** (the cells, the centre) — the release path must check
`c.pen` and slaughter instead; a check forces a penned cub past 16 and
asserts it is gone, not home. `absent()` also freezes investigations
(BACKLOG) — a penned cub with an open file is a corner the suite should
name. `ageYears` of a cub bought at 3 and slaughtered at 16 is 13 years
in the pen — the card's date makes that visible; the owner may want
`PEN_BUY_MIN_AGE` so the vendor buys weaners, not newborns.

**Size.** ≈ 320 lines sim + 60 walkers + 50 ui + 150 probe; ~14 checks;
one session, the probe first.

### P. The palette — *"a remote control on the left side of the screen"*

**Goal.** The sixteen build tools as a two-column panel on the left of the
map, in the owner's order, each with a picture of the thing it builds.
The top strip keeps everything that is not a build tool.

**Design.**
- `js/tools.js` (DOM-free): `TOOLS` — the ONE table of tools (Law 6: the
  palette, the top strip's hint line, `input.js`'s key map and the cost
  strip all read it): `{ id, key, label, op, sprite, order }` — sixteen
  rows in the owner's order:
  ```
   1 residential    2 commercial        (keys 1, 2)
   3 industrial     4 meat              (3, 4)
   5 road           6 wall              (5, 6)
   7 rail           8 station           (7, 8)
   9 tree          10 park              (9, 0)
  11 zoo           12 pacification      (Z, V)
  13 police        14 fire station      (P, F)
  15 inspect       16 bulldoze          (I, B)
  ```
  **The key law (the owner: *"wasd should only be movement, use your
  judgement on the rest"*):** `W A S D` and the arrows pan the map and do
  NOTHING else, anywhere — including the news reader, which today steps
  dispatches on WASD and will step on the arrows only. The number row is
  the palette's first ten positions in order (`1`…`9`, `0` = park); the
  six below take a mnemonic letter that is not W/A/S/D. Every key is
  printed small on its button, and the help line at the panel's foot is
  generated from `TOOLS` so it cannot drift. The full map, was → is:

  | what | was | is | why |
  |---|---|---|---|
  | zone R / C / I | `1 2 3` | `1 2 3` | positions |
  | meat | `M` | `4` | position |
  | road · wall · rail · station | `4 B T G` | `5 6 7 8` | positions |
  | tree · park | `5 6` | `9 0` | positions; `0` sits after `9` on the row |
  | zoo | `7` | `Z` | mnemonic; undo moves off `Z` |
  | pacification · police · fire | `V P F` | `V P F` | unchanged, mnemonic |
  | inspect | `9` | `I` | mnemonic |
  | bulldoze | `8` | `B` | mnemonic |
  | density Low/High | `D` | `H` | `D` is movement; `H` = High |
  | use-zoning | `U` | `U` | stays on the top strip (a modifier, not a build) |
  | undo | `Z` | `Backspace` (and `Ctrl+Z`) | `Z` is the zoo |
  | save · load | `S` `L` | `L` opens the saves menu (Part S); `Ctrl+S` = save-as | `S` is movement |
  | overlay · news · new city | `O R N` | `O R N` | unchanged |
  | pause · slower · faster · zoom | `Space , . + −` | unchanged | |
  | menu | `Esc` | `Esc` | |
  | pan | arrows / WASD / right-drag | arrows / WASD / right-drag | **movement only** |

  Density (`H`) and Use (`U`) stay on the top strip as the owner said —
  they modify what the zone tools paint, they do not build.
- `js/palette.js` (DOM): `<nav id="palette">` left of `#map` (`index.html`
  gains the element; the layout becomes palette | map | panel). Each
  button: a thumbnail painted by `render.paintSprite(canvas, sprite,
  scale)` (D's one canvas export, shared — the cottage, the shop, the
  shed, the stall, a straight road, a wall run, a rail tile, the station,
  the round tree, the park, the zoo, the centre, the police station, the
  fire station, the cursor glyph, rubble), the label, the key in dim, the
  cost on hover from `costOf` (the same call the cost strip makes). The
  active tool is highlighted; clicking calls `ui.setTool` — the one
  function that already owns tool state. 2 × 8 at ~44 px; under 720 px of
  height it reflows to 4 × 4.
- The top strip's tool buttons go; density, pause, slower/faster, undo,
  save, load, overlay, news, zoom, new city and menu stay. The strip no
  longer wraps at 1,600 px (handoff §11's trap) because it is half as
  long.
- The renderer's resize reads the map's actual box, so the palette's
  width comes off the map, not the panel.

**Owns.** `js/tools.js`, `js/palette.js`, `index.html`, the palette block
in `css/field.css`, `buildStrip` in `ui.js` (ONE function — C owns the
card and the tabs), the key map in `input.js` (reads `TOOLS`; C owns the
pin logic, A the cursor line), the reader's `key()` in `news.js` (the one
WASD removal — F owns the rest of the file), the resize lines in
`main.js` (C owns the camera lines), Part K' checks, SPEC §11 addition,
README's key list.

**Acceptance.**
- Node: `TOOLS` has 16 rows, positions 1–16 once each, keys unique, every
  `op.kind` `ops.apply` accepts has a tool or is named in an allow-list
  (rate, toggle, choice, cheat); every `sprite` name resolves in `art`;
  **no binding anywhere in `TOOLS` or the strip's key table is `w`, `a`,
  `s` or `d`** (the check reads both tables; the news reader's key
  handler is grepped for the four letters).
- Browser: on a fresh city click each of the sixteen and place one (the
  cost strip shows the price before, the ledger after); the key still
  selects the same tool the button does; at 1,280 × 720 nothing wraps or
  scrolls sideways; the map's pick is still exact after the layout change
  (click a tile at the map's left edge → its card); 0 console messages.

**Traps.** `#tools` unwrapped scrolled the document sideways in session 4
— any width change to the strip re-tests that. `pick()` is a flat inverse
of the projection from the canvas origin — moving the canvas is fine,
resizing it without `renderer.resize()` is not. The thumbnails are 16
rasters at boot — cheap, but paint them once, not per refresh.

**Size.** ≈ 80 tools + 150 palette + 40 css + 30 ui/input/main; ~5
checks; half a session.

### S. Saves — *"the save button only lets you save the game once, a load save menu would be better"*

**Status: SHIPPED 2026-09-03.** Named manual slots, one autosave per city,
legacy-key migration, quota-safe writes and the shared SAVE/LOAD panel are
implemented as specified below.

**Goal.** A saves menu: any number of named slots per city, save-as,
load, delete, export and import in one place, on `S` and `L` and on the
title screen. The autosave stays its own slot in the same list.

**Before S.** Two slots a city — the S checkpoint and the autosave — and S
overwrites the checkpoint (BACKLOG: "a save-as name field is not built").

**Design.**
- `js/slots.js` (DOM-free, a store injected — a Map in Node,
  `localStorage` in the browser): `listSlots(store, city) → [{ id, name,
  date, tick, pop, bytes, kind: "manual" | "auto" }]` newest first;
  `writeSlot(store, city, name, json, kind) → { ok, id } | { ok: false,
  reason }`; `deleteSlot`; `bytesUsed(store)`; `migrate(store)` — the old
  `zoo.save:<city>` / `zoo.auto:<city>` keys become slots on first open
  and the old keys are left in place (idempotent; a migration never
  deletes). Keys `zoo.slot:<city>:<id>`, an index `zoo.slots:<city>`; the
  id is a counter, the name is data (quotes and colons are fine).
- The menu (`title.js`'s SAVE and LOAD panels become one SAVES panel;
  `S` opens it with the name field focused, `L` opens it on the list;
  Esc closes): a name field defaulting to *"<city> — <month year>"*, SAVE
  AS, and per row load · overwrite (asks) · delete (asks) · export (the
  text box). IMPORT stays. Used / free bytes at the foot. CONTINUE on the
  title = the newest slot of the last city, manual or auto.
- The autosave (every 12 ticks, on hide) writes ONE auto slot per city,
  overwritten — it must not multiply slots.
- **A refusal must not lose work:** when `localStorage` is full,
  `writeSlot` returns the reason and the menu shows the export box with
  the JSON already in it — the save exists on the screen even when the
  store said no. Every caller of `app.save` is walked for the assumption
  that it succeeded (the autosave's quiet path, the title's SAVE, `S`).
- B's save compaction halves a slot (~0.9 MB → ~0.45 MB at year 30), so a
  5 MB store holds ~10 slots instead of ~5; the foot of the menu says how
  many are left.

**Owns.** `js/slots.js`, `js/title.js` (the SAVES panel), `savesList` /
`portBox` in `ui.js` (ONE block, `ui.js:737–785`), `app.save` / `app.load`
/ `app.resume` and the boot slot choice in `main.js` (`main.js:155–200`,
`300–345`; C's camera lines are elsewhere), Part J' checks, SPEC §15
addition, README's title-screen paragraph.

**Acceptance.**
- Node: three writes list newest first; delete one and the index agrees;
  a Map store with a byte cap returns `{ ok: false }` on the fourth and
  the first three are intact; `migrate` twice = once; an old-key city
  shows as a slot and its old key still exists.
- Browser: save as twice under two names → two rows; load the older →
  its date on the clock; delete asks and removes one; the autosave after
  a year is one row, not twelve; export of a city from the menu pastes
  back through IMPORT and hash-equals (the suite's save → load law, done
  by hand once). **This is the road the control city travels** (§8 q5).

**Traps.** The title's CONTINUE logic compares two slots by tick today
(`main.js:304–312`); with N slots it compares the list's head. A loaded
city opens paused (BACKLOG) — unchanged. `zoo.pref`'s read marks are
keyed by city NAME (handoff §13b); a slot's name is not the city's name —
keep the city name on the slot record so marks follow the city.

**Size.** ≈ 120 slots + 150 title + 60 ui + 40 main; ~7 checks; half a
session.

### X. The level crossing — *"railroads and roads should be able to cross over each other perpendicularly"*

**Goal.** A rail line may cross a road square-on, on one tile that is
both; walkers cross on foot along the road, riders cross on the rail, and
the tile draws as a crossing. Rail bridges (rail over water) stay out, as
BACKLOG has them.

**What the code already does, read tonight.** The commute graph needs no
change: `fields.dial` walks on any tile with a road (`fields.js:492`) and
rides on any tile with rail (`:502`), and the two layers meet ONLY at a
station (`rail === 2`) — so a tile with both is walkable along the road
and rideable along the rail with no boarding, which is exactly a level
crossing. The suite's path law (`check.mjs:158`) holds for it as written.
Traffic counts walking entries (`fields.js:56`) and `EMIT_RAIL` spreads
from any rail tile (`:99`) — both apply to a crossing, and the plan says so
rather than special-casing them. The whole of v1's "no level crossings" is
two refusals in `ops.js` (`:54` the road op, `:121` the rail op) and one
draw line (`render.js:165`, which draws a road before it would look for
rail).

**Design.**
- **The rule (`ops.js`):** a road may be laid onto a rail tile, and rail
  onto a road tile, when the RESULT on that tile is two straight runs on
  different axes: after placement the tile's road mask is `N|S` or `E|W`
  and its rail mask is the other one. Not on water, not on a bridge, not
  on a wall (a tunnel is open along ONE axis), not a station. A crossing
  stays straight: a later road or rail that would add an arm ON the
  crossing tile is refused (junctions beside it are fine). The refusal
  reason is a new string, `"square-on"`, and the cost strip prints it
  through `costOf` as it prints "blocked" today. A wall drag across a
  crossing is refused (a wall wants one open axis).
- **Bulldoze** on a crossing removes the rail and leaves the road (rail is
  the cheaper, later layer); a second press removes the road. One undo
  step each, through the existing `replaced` record.
- **Art (`art/rail.js`):** `crossingSprite(axis, busy)` — the straight road
  strip (its busy variant when the road is busy) with the two rails
  inlaid across the tarmac in the asphalt ramp's lightest key, the
  ballast and sleepers only in the grass margins where the rail leaves
  the road, and a crossing post (a 2-px stamp, concrete ramp) at each of
  the two road-side corners. Two axes × busy = four sprites in the audit
  and on the rail sheet.
- **Draw (`render.js` `rebuildGround`):** `if (road && rail) sprite =
  art.crossing(railAxis, busy)` before the road line. The crossing is
  ground, so it lives in the static layer and every op already
  invalidates.
- Walkers: nothing — `roadPath` walks the road across; a rider passes at
  ride speed. The train sprite stays a BACKLOG line.
- Save: no format change — `road[i]` and `rail[i]` both exist; the new
  state is their coexistence, which old saves never contain.

**Owns.** The validation lines of the road, rail, wall and bulldoze ops in
`ops.js` (nobody else edits `ops.js`), `art/rail.js`, `art.crossing` in
`index.js`, the one ground line in `render.js` (A/D/E own other
functions), Part L' checks, the rail sheet in `shots.mjs`, SPEC §7.9 and
§12.4c, the rail line in BACKLOG.

**Acceptance.**
- Invariant, every world the suite builds: `road[i] && rail[i]` ⇒ both
  masks straight, on different axes, no wall, not a station, not water.
- The rail fixture (`check.mjs:512`): lay a road line, drag rail across it
  → ok and the tile is both; drag rail ALONG it → refused `"square-on"`;
  drag a third road arm onto the crossing → refused; bulldoze once → rail
  gone, road stays; a commuter whose road crosses the line walks the
  crossing tile (its path has the tile un-flagged); a rider between two
  stations either side rides it (flagged) — both from `dial`, unchanged.
- The mayor's hash on every standing gate is unchanged (a validation that
  now accepts a case nobody attempted cannot move a run).
- Browser: lay both, at ×1 and ×2 the crossing reads as a road with rails
  across it; a wall dragged over it is refused with the reason on the
  strip; 0 console messages; `play.mjs --at` photographs it for the
  commit.

**Traps.** `railMask` in `render.js:133` reads neighbours with rail — on a
crossing the road's neighbours also matter for the busy variant; read
both masks, not one. The road op's L-drag validates tile by tile (`:54`)
— the perpendicular test needs the mask AFTER the whole drag, so validate
the drag's result, not each tile in isolation. `hasAccess` and `door()`
treat a crossing as a road tile (it is one) — a lot's door may sit on a
crossing; say so in SPEC rather than forbid it.

**Size.** ≈ 80 ops + 60 art + 10 render + 60 checks; half a session; no
keel needed.

**X2. The ride speed** — *"citizens traveling on the rails should move
50% faster."* Measured first (§1): a rider moves at 3.07× a walker on the
map today, so the ruling is read as 50% faster than NOW: **×4.5**. (If
the owner meant ×1.5 of walking — slower than today — it is one knob the
other way; §8 q8 asks.) Two numbers describe one fact tonight and
disagree by a tenth: the eye's `RIDE_SPEED` 3 and the commute rule's
`RAIL_COST / WALK` = 0.3 (3.33×). X2 makes them one: `WALK` 10 → **9**
and `RAIL_COST` 3 → **2** (9 / 2 = 4.5 exactly, both integers for Dial's
buckets), and `RIDE_SPEED` becomes DERIVED, `WALK / RAIL_COST`, so the
Rules tab's "a ride is 0.22 of a walk" and the train on the map can never
drift apart again (Law 6). Consequences, all stated: the trespass step
becomes 6 × 9 = 54 (the same 6× preference); Dial's bucket count is `max
× WALK` — fewer buckets, the same order (the BFS equivalence holds for
any uniform `WALK`, and the suite's "every commuter's path tile-equal to
`roadPath`" check is the proof); `commuteTime` counts a ride segment at
0.22, so riders with long lines gain the mood's commute +10 sooner — the
hash MOVES on the rail gates and the commit records before/after; the
ride-time check in the suite (`commuteTime … 0.3 of a walk`) is rewritten
to read the knobs, not the literal. Owned by X (the two knobs in
`rules.js`, the derived `RIDE_SPEED`, the Rules-tab line, the suite line,
SPEC §7.9's three numbers); `walkers.js:556` is unchanged — it reads the
knob. Acceptance: `ridespeed` re-run prints ratio 4.5 ± 0.05; the fixture's
ride cost is `10 + 13·2 + 10`… in the new units `9 + 13·2 + 9`; the
mayor's balanced hash (no rail) is unchanged — only rail towns move.
An hour.

### R. Road access, seen — *"as long as a tile is within 1-3 tiles of the road it has road access"*

**What the code says tonight (§1).** `computeRoadDist` is a breadth-first
distance from every road tile through any tile, in all four directions,
and `hasAccess` is that distance ≤ `ROAD_REACH` 3. Nothing about sides;
nothing about which face the door is on; only a bare wall stops it. A
tile three in from the ring of a 6×6 block has access. The owner's
sentence is the law as written — so the part is not a rule change; it is
(1) the one defect the probe found, (2) making the field visible so what
the owner saw can be named, and (3) the knob if their larger blocks are
the cause.

**Design.**
1. **Recompute at the op, not the tick.** `ops.js:287` marks
   `roadsDirty` and recomputes occlusion at once "so wallCount reads
   live", but leaves `roadDist` for the tick. A road laid in a paused city
   (every loaded city opens paused, BACKLOG) leaves every lot beside it
   reading "no road within 3" on the card until Space. Fix: call
   `computeRoadDist` there too (a 4,096-tile BFS, well under a
   millisecond). Hash-neutral — the tick recomputes the same field before
   anything in the sim reads it; the suite proves it on every gate.
2. **The access overlay.** The `O` overlay gains a mode `access`:
   distance 0 (road) untinted, 1–3 in three greens, 4 in the zot red —
   the field the growth rule reads, painted. With it the owner can point
   at a tile and say "this one".
3. **The card says it.** Every zoned tile's card: `road access: 2 tiles ·
   door (30,12)` from `lotReport.roadDist` and `doorOf`; at 4, `no road
   within 3 — the nearest is 5 tiles at (28,9)` (a second BFS to 8, only
   for the card).
4. **One predicate, `served`, for every rule that asks "is there a
   road?"** The owner, clarifying: *"the 6x6 squares have roads around
   the whole perimeter, so nothing is more than 3 tiles away"* and then
   *"i want that rule standardized, including rail and warehouses, and
   zoos."* So: `fields.served(world, i)` = the road distance of the
   nearest tile of the thing's FOOTPRINT is ≤ `ROAD_REACH` 3 — a 1×1
   lot's own tile; any of a zoo's four (and a landmark's nine, when they
   come); and `doorOf` searches from the whole footprint too. Every rule
   below reads `served`, and a suite check greps `js/sim` for any other
   test of a road's nearness (the allow-list: the road's own emission
   line, the census counts, `reach.hasWay`, the walk layer's step) so a
   new rule cannot quietly grow its own. The census of what asks today,
   and what it becomes:

   | rule | today | standard |
   |---|---|---|
   | zone growth R / C / I / M (`lotScore`) | `hasAccess` ≤ 3 on the tile | `served` — unchanged in effect |
   | **industry tier 3** ("warehouses" — the shed / factory / works; there is no warehouse building, and the M cold store is a hall) | `roadDist ≤ 1` (`lots.js:110`, SC2000's frontage rule) | `served` — tier 3 anywhere within 3; the inside of an industrial 6×6 grows as tall as its edge |
   | **the rail station as a door** | a road tile TOUCHING the platform (`fields.js:492`) | `served` — the platform's door is `doorOf(station)`; the walk layer links platform ↔ door at cost `WALK × roadDist` and the stored path carries the door tile, so a walker crosses the gap on foot as it does to any lot |
   | **the zoo** (2×2) | jobs need `hasAccess` on the ANCHOR tile (`citizens.js:874`); its LV halo and its +500 on the cap need no road at all | `served` on the footprint gates all three the same way — jobs, halo, cap; a zoo no road reaches within 3 of any of its tiles is a fenced field until one does |
   | the meat hall (SOLD, the licence, the M valve's reach) | `hasAccess` | `served` |
   | the pacification centre's bed | `hasAccess` | `served` |
   | fire / police cover | `roadDist ≤ 3` on the 1×1 | `served` — unchanged in effect |
   | the park | no road needed (halo, cap +150, mood +10) | unchanged and SAID: a park is a place, not a service; the owner did not list it |
   | **doors** (job search, walkers, campers, the scout, the station's platform) | `doorOf` = ONE road tile, the first found in N-E-S-W order — every walker of a lot leaves by the same side | **all sides are access points** (the owner: *"the other way to think about it is that all sides have access points"*): `doorsOf(world, i)` = every road tile at the footprint's nearest road distance, any direction; the commute search starts from ALL of a home's doors and ends at ANY of the job's (Dial is multi-source already — free), so a citizen leaves by whichever side its road goes; the walker layer starts each walk at the path's first tile, which is now the right door; the station's platform links to all its doors |
   | bridges, tunnels | a road tile | unchanged |

   The hash MOVES (interior works rise; stations two and three tiles off
   a road become doors; an unserved zoo stops counting; commutes take the
   nearer door, so traffic redistributes round every block) and the
   commit records before/after on every gate. What stays one-sided and
   is NOT access: a building's drawn door is on the side face whatever
   the road's side (art), and SPEC says so. `ROAD_REACH` stays 3 (the
   owner's blocks never need more).
5. **Verify on the control city.** `tools/accessprobe.mjs` (exit 0; the
   scratchpad probe made real; takes `--save`): zoned lots by `roadDist`
   0–4, stations that are doors before and after (a), industrial lots at
   tier 2 with access that (b) frees, and the WHY NOT reason on every lot
   at 4. The rig has 0 at 4 — only the owner's town can show that case.

**Owns.** The one call in `ops.js` (X owns the validation lines — a
different hunk), `served` / `doorOf` / `computeRoadDist` in `fields.js`
and the station edge in `dial` (`:492`; H owns nothing there, A nothing),
every call site in the table (`lots.js:86/:110`, `citizens.js:874`,
`justice.js:240/:260`, `events.js:489`, `fields.js:169–195` the zoo halo,
`census.js` the zoo count, `demand.js` the cap — one-line swaps to
`served`; B's one-liners in `citizens.js`/`justice.js` are other lines),
the `access` mode in `render.js`'s `drawOverlay` (its own case), the card
line in `lots.js`'s `lotReport` + `ui.js`'s `cardForTile` (one line each;
C owns the card's citizen half, H the M block), `tools/accessprobe.mjs`,
Part M' checks, SPEC §3, §6, §7.9, §9b sentences and the Rules-tab line
"access = served, one predicate".

**Acceptance.** Commit R1 first, alone: after a road op, before any tick,
`served` is true, and the hash on every gate is unchanged. Then R4, one
commit: the grep check (no road-nearness test in `js/sim` outside the
allow-list); the rail fixture's station two tiles from the road is a door
and the commute rides it, three tiles is, four is not; a lot with roads
on two sides sends a commuter out by the side nearer its job (the path's
first tile is that side's door) and the suite's "every commuter's path
tile-equal to `roadPath`" check is re-based on `doorsOf`; an industrial
lot at `roadDist` 3 reaches tier 3 in the millbelt; a zoo whose only road is 3
from its far tile has jobs, a halo and its cap, and at 4 has none; the
rail, millbelt and zoo gate hashes move with before/after recorded and
the balanced gate (no rail, no zoo, its works on the ring) is unchanged
or explained; the overlay's tint table has five entries and the audit
walks it; the card's line on a tile at 2, at 3, at 4; the probe's table
in the commit. Half a session, no keel.

### G. Integration — after the parts have merged

One agent, after A–F, H, P, S, X and R are on `main`:
- **The control city** (the owner: *"i will build one for you soon"*):
  when it arrives, `docs/fixtures/control-city.json` — loaded by the
  suite (`load` → `rebuildDerived` → 12 months → a recorded hash, the
  real-save regression the suite has never had), and the input to every
  probe's `--save` (`meatprobe`, `peopleprobe`, `newsprobe`, `savesize`).
  Numbers from it replace the rig's in the handoff table. If it lands
  before G, whichever part is running adds the load check that day.
- Merge order if they collide: K → B → H → A → D → E → C → F (B before A
  so the card's life has data; H before A so `HOOKS` reads a real stock;
  D before E so both sheets are re-shot once; C last among the UI because
  it consumes all of them).
- The suite end to end; every part's mutation tests re-run on the merged
  tree (a check that passed alone can pass for the wrong reason together).
- `tools/play.mjs --follow citizen <id>` (a new shutter: the camera tracks
  one animal's walker, falls back to its home) and a film of a starred
  rabbit's year for the README.
- `peopleprobe`, `newsprobe`, `savesize`, `meatprobe` numbers in one
  table in the handoff §16, plus each part's trap table (symptom-keyed).
- SPEC: §7.10 lives, §9c meat on hand, §11c Inspect, §11b chips, §12.2b
  variants and marks, §12.3b looks and portraits, §14b needs; README's
  "the population is not a number" paragraph earns its sentence; BACKLOG
  reconciled (what each part left).
- A browser round of the whole: a fresh city, ×3 for ten game years,
  Inspect on a street, following one animal's card from arrival to its
  first friend, a hall's stock rising and falling; 0 console messages; the
  frame cost with everything on.

---

## 5. Ownership — who edits what (copied to BACKLOG by K7)

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

## 6. Schedule

```
day 0   K (½ session)  ─┬─ A needs ─────────────┐
                        ├─ H meat on hand ──────┤
                        ├─ P palette (½) ───────┤
                        ├─ S saves (½) ─────────┤
                        ├─ X crossing (½) ──────┤
                        ├─ R access seen (½) ───┤
                        ├─ B lives ─────────────┤   G integration (1 session)
                        ├─ C inspect (stubs) ───┤   + the control city when it lands
                        ├─ D looks ─────────────┤
                        ├─ E buildings ─────────┤
                        └─ F story ─────────────┘
```
Ten sessions in parallel after the keel; C and F finish against the
merged tree because they consume the most; P, S and X are half-sessions
and need no keel at all (they can start tonight). If only two agents are
available: P+S first (small, and the owner asked for them by name), then
X+A, then H+E, then B+D, then C+F; K before A/B/H.

## 7. What this plan does NOT do, and why

- **The 3×3 landmarks** (`docs/PROPOSAL-LANDMARKS.md`): still awaiting the
  owner's go; E leaves `landmarks.js` as their home so both can run.
- **Friendship density** (mean 0.67 friends): a knob question that changes
  the hash and the cap curve; measured here, not touched. Lives will make
  the thinness VISIBLE — that is the right order.
- **The arrest volume** (15 in cells, 20 sold): the sentence table is the
  owner's ruling and H leaves it; `RECORD_HARD` 3 → 2 is the named lever
  if more of the cells should reach the hall.
- **Ambient thoughts under every tool**: a BACKLOG line behind an OPTIONS
  switch; Inspect is the switch in this plan.
- **Sound** (L3), **elevation** (L2), **the wedding** (L1 — it wants B's
  ledger and the household merge rule; a natural follow-on).
- **Names on signs**: unreadable at 12 px; the card carries the name.
- **A day/night cycle** for the lit windows: lit-by-fill is the honest
  version and needs no clock.

## 8. Questions for the owner (none block the keel)

1. ~~**Whose bodies does the hall buy?**~~ **Ruled:** *"natural deaths is
   a good option."* Any natural death within reach, p 0.6.
2. ~~**Livestock as product?**~~ **Ruled:** *"selling cubs sounds right,
   although i think the meat vendors would grow them to adulthood for best
   return on investment."* → the pen (§4-H inflow 4): bought as a cub,
   raised at the hall, slaughtered at 16 for 2 units. Open detail: should
   the vendor buy only weaners (`PEN_BUY_MIN_AGE`, say 4) so a cub is not
   thirteen years in the pen?
3. **The cells.** 15 in cells against 20 sold is the trespass minor at
   `RECORD_HARD` 3 (the third offence meets the table). Lower it to 2, or
   leave the ruling?
4. **The save compaction** (B's first commit) changes the save format's
   bytes but not its meaning; old saves load. Fine to ship, or keep the
   verbose form?
5. ~~**Your city as the rig.**~~ **Ruled:** *"adding the control city is a
   good idea, i will build one for you soon."* → `docs/fixtures/
   control-city.json` when it arrives (§4-G); Part S's menu is the export
   path. Until then every rig number stays labelled a rig number.
6. ~~**The palette's keys.**~~ **Ruled:** *"wasd should only be movement,
   use your judgement on the rest of the keybindings."* → the key law and
   the was → is table in §4-P: the number row is positions 1–10, the six
   below are mnemonic letters, density moves to `H`, undo to `Backspace`,
   the saves menu to `L`, and WASD pans and does nothing else anywhere.
7. ~~**Use-zoning (`U`)**~~ Decided under the same ruling: it stays on the
   top strip beside density as a modifier, on `U`. A seventeenth button
   is a one-row change to `TOOLS` if the owner wants it later.
8. **"50% faster" than what?** Riders move at ×3.07 today (measured). The
   plan reads the ruling as ×4.5 (50% more than now). If it meant ×1.5 of
   walking speed, say so — that is `RAIL_COST` 6 with `WALK` 9 instead.
9. **What did "one side" look like?** Growth access is already
   any-direction to 3 in the code, and with the perimeter roads every
   tile of the owner's blocks has it (§4-R). The plan applies the ruling
   to the two rules that still want a TOUCHING road (a station's door,
   industrial tier 3) and fixes the stale card in a paused city. If what
   was seen was something else — a tile coordinate and the card's WHY NOT
   line would settle it, or the control city will.
