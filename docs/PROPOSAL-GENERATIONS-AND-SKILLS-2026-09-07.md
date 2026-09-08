# PROPOSAL — GENERATIONS AND SKILLS (brainstormed with the owner, 2026-09-07)

*Skill by doing, knowledge that compounds down a family line, and a crew whose
skill sets how far its building reaches. Brought over from Castle Cultivator's
mortal spine (freestone SIM 43–45: the skill ladder, the churchyard, lineage) and
re-shaped by three rounds of the owner's rulings and by measurement. Nothing of
the design is built. ONE fix landed on the way (§4): parks have no workers.*

Kin: `docs/PLAN-THE-PEOPLE-2026-09-02.md` (relating to the individual citizen),
`docs/PROPOSAL-KNOWLEDGE-CULTURE-2026-09-05.md` (the school idea it defers),
`docs/PROPOSAL-WEALTH-AND-CLASS-2026-09-05.md` (class is what the ADDRESS affords;
this proposal inherits SKILL, never class), BACKLOG L1 (the wedding and its
household-merge rule — now the prerequisite of this whole arc).

## 0. The owner's words (verbatim, in order)

1. *"brainstorming zoo city 2000. we had some ideas in the game freestone about
   generational growth and skills that i think would translate well for zoo city
   2000"*
2. *"the shorter lives should mean faster generational growth of knowledge, they
   can itterate and improve on what they learned from their parents. so lets think
   more about job skills. commercial high, commercial low, insustrial high,
   industrial low, meat (unless its rebalanced there is too little meat demand to
   split this job, but predators hunting prey also gives experience), zoo &
   pacification, police, Fire fighters, library, university, gallery (artists),
   amphitheater (actors). do you think that's enough divisions? i think high skill
   levels should add bonuses to how many tiles receive a benefit from the labor,
   and unskilled workers a small negative, just a tile or two. health, sanitation,
   and a cemetary are still owed locations too"*
3. *"zoo and pacification center should have no shadow, they are citywide
   infustructure. most other infustructure should have 5-10 walking tiles of range
   (rail still counts as free space/travel) parks have no workers, so should not
   have any bonus or negative"*
4. *"you are correct to strike them, parks have no workers. i think the workers
   might have been erroneous leftovers from when the large park was still called
   a zoo."* and *"you are correct that the ranges of the amphitheater and
   university should not be touched, just the smaller range items. like
   commercial, industrial, meat, police fire, health sanitation, library,
   gallery. cemetery has no workers and is a city wide item like zoos and
   pacification."*
5. On being told the town's own children never have children: *"you are
   correct. right now any change in population comes from migration. we need
   levers for both migration as well as population growth, the latter is
   especially important because if there is no breeding then pacification is
   mostly an empty threat."* and *"as far as the artists, and this goes for
   police, firefighters, and educators, and other similar placed services, i am
   ok with people traveling to work further than the range of the benefit of
   the service. i'm even potentially ok with people commuting further than they
   should to commercial, industrial, and meat jobs if the demand is high enough,
   but that would need to be balanced very carefully"* (§8, §9).
6. Asked "do you have more questions before we begin?", four rulings on the
   pairing, the reach, the full home and the stretch: *"1 but lets add 12
   personality types. also i am ok with predator and prey marrying, but it should
   be about as rare as gay villagers. lets say 10% gay, 10% cross pred prey
   relationships."* (1 = the same species preferred); the reach follows *"The
   best hand on the crew"*; the full home: *"Wire it"*; the stretch: *"Not
   now"*. Then on the twelve: *"Twelve types rolled at birth, never inherited"*,
   acting on *"Courtship: who marries whom"* and *"Friendship: who befriends
   whom"*; and on sex: *"No sex: ten percent of weddings are companions who
   never breed"*. Step 0 was built on these the same evening (§7, §8e).
7. On the built town closing at ninety years: *"migration should definitely be
   bidirectional. it should take more than just a fire for people to leave, it
   would have to be a combination of factors"* (§10).

## 1. The thesis

Three ideas from freestone translate; one does not.

- **Skill by doing.** Discrete bands read off integer months worked, never a
  curve (freestone's anti-XP law): green at a year, journeyman at four, master
  at ten. Untrained is no penalty in freestone; here the owner wants a small one
  (§3c).
- **Lineage.** A cub inherits a head-start in a parent's trade; masters beget
  masters (freestone SIM 45). The owner sharpens it: knowledge COMPOUNDS per
  generation, so a short-lived species iterates faster (§2c).
- **The memory readers.** Freestone reads its dead from headstones and its stones
  from mason's marks. Zoo City already has building age, species marks, landmarks
  named for the family that made them, and a permanent archive of every animal
  that ever lived; the cemetery becomes the place that reads it (§3e).
- **Scarcity does NOT translate.** In freestone a master is rare because the dawn
  pass moves hands between jobs. In Zoo City nobody changes jobs (§2a), so
  freestone's thresholds make masters two fifths of the workforce. Rarity, if
  wanted, must come from elsewhere.

## 2. Measured before anything was designed

All numbers from the scripted mayor (`tools/mayor.mjs`), seed 7 unless said,
disasters off; the instruments are §6. **The mayor's 7-tile spiral is not the
owner's town** — the estate layout (6×6 blocks, rail between the rings) is the
owner's scale and every number is given for both.

### 2a. Jobs are sticky, so tenure alone makes masters common

`c.hired` is already saved on every citizen: tenure at the current job needs no
new state.

| year 30 | balanced | estate |
|---|---|---|
| median months at the current job (p25 / p75) | 93 (46 / 163) | 82 (41 / 158) |
| employed who have held exactly one job, ever | 83% | 90% |
| veterans fired by a lot's decay in 30 years | 8 | 0 |
| bands by months in the trade: untrained / green / journeyman / master | 6 / 18 / 35 / 41% | 7 / 21 / 35 / 37% |
| the same at 60 years (balanced) | 5 / 20 / 38 / 38% | |
| veterans leaving work per year (died / retired / fired) | 25 / 43 / 0 | 14 / 31 / 0 |
| births vs arrivals per year | 17 vs 72 | 23 vs 57 |
| cubs living with a journeyman-or-better | 51% | 61% |

Species stratify hard under a flat ten-year threshold, because pigs, mice and
skunks retire at 26–27: mean months in trade at year 30 — bear 191–227, tortoise
210–222, owl 154–189, wolf 135–153, fox 139–146; pig 53–63 (1 master of 106),
mouse 56–58 (none), skunk 48–62. A master GATE on anything would be a species
gate through the back door. The owner's answer is §2c.

### 2b. The keeper: succession is rare and local

Each job lot's most senior hand is its keeper. Over 30 years a keeper leaves the
lot 215 times across 162 lots (balanced) and 136 across 87 (estate): **once per
19–23 lot-years.** At year 30, 113 of 162 keepers (69 of 87) are ten-year hands
and 81–87% of lots hold a four-year second hand — an heir. So a keeper's
retirement or death is a rare, LOCAL shock with an heir usually standing by: the
shape that survived the camera arc (a hall's dread works because it is local and
few — anything global cancels every comparative mechanic).

### 2c. Natives never breed — THE PREREQUISITE

At sixteen a cub splits into a ONE-animal household and nothing ever merges
households; births need two fertile adults in one household.

| 60 years | balanced | estate |
|---|---|---|
| native adults alive | 293 | 269 |
| of those living with no other adult | 293 (100%) | 268 (100%) |
| births with a town-born parent, of ~1,400 | 4 | 2 |
| deepest generation reached (even at 90 years) | 1 | 1 |

So today "iterate and improve on what they learned from their parents" cannot
happen: every animal born in town is the last of its line. **The household-merge
rule (BACKLOG L1, the wedding) is step zero of this arc.** Cheapest shape: a
single adult who moves onto a lot holding another single fertile adult forms one
household with them, any pairing that is not predator and prey; the wedding
procession is the ticker moment; the litter's species is a random parent's, as
today. §8 runs that shape and two others as a pass OUTSIDE the sim, for 60 and
90 years, and recommends one.

Once natives pair, generation time is set by the roster's fertile windows: mice,
pigs and skunks ~20 years; cats, raccoons, rabbits 21–23; foxes, beavers, wolves
29; bears and owls 33; tortoises 53. In 60 years a mouse line turns three
generations, a tortoise line one. That is the owner's claim as arithmetic, and
it is the real model of cumulative culture: each generation keeps a share of what
the last knew (fidelity) and adds something (innovation), so the rate is per
generation and the ceiling is innovation ÷ (1 − fidelity).

`tools/lineageprobe.mjs` runs that model as a shadow ledger (fidelity 0.5, a
24-month credit per practised generation): with only ONE generation available
today, masters rise 38 → 41% (balanced) and 41 → 45% (estate), concentrated in
natives — native pig masters 0 → 7, native cats 13 → 30 at 90 years. Natives are
~20% of workers (arrivals outnumber births 3–6 to 1), so the town's own children
would read as its old skilled families.

### 2d. Reach in walking tiles, calibrated

`meat.hallReach` already runs `fields.dial` with `{ railCost: 0, neutral: true }`
— walk steps count, board, alight and every rail edge cost zero — which is
exactly the owner's "walking tiles, rail free". `tools/reachprobe.mjs`, a police
station at year 15:

| reach | balanced, 208 homes / 1,557 animals | estate beside the near platform, 49 / 1,192 |
|---|---|---|
| today, Chebyshev 6 (`POLICE_RADIUS`) | 30 homes · 177 | 13 · 722 |
| 5 walking tiles | 6 · 41 | 8 · 412 |
| 7 walking tiles | 15 · 102 | 12 · 705 |
| 10 walking tiles | 30 · 260 | 17 · 754 |
| 12 walking tiles | 33 · 328 | 24 · 880 |

**7 walking tiles is today's cover on the owner's layout; 10 is today's on the
mayor's; 5 is a fifth to a third.** Beside the FAR platform (no home within
Chebyshev 6, 0 covered today): 8 homes at 5 walking tiles, 13 homes / 550
animals at 10, 14 / 809 at 12 — and 0 with rail priced as walking (seed 3 the
same shape). Rail carries services: a station by a platform serves every platform
on the line, so the player's incentive is transit-oriented. The mayor's own
estate station sits at the map edge and covers nothing by any measure — a rig
fact, not a finding about the game.

## 3. The design as ruled

### 3a. Two ladders, and every species climbs one

- **Tenure**, months at the trade: green 12, journeyman 48, master 120. The
  long-lived road (bears, tortoises, owls). Zero new state: `tick − c.hired` for
  the current job; a per-trade ledger only if the 10–17% who move jobs turn out
  to matter.
- **The lineage ratchet**, per generation: at birth a cub inherits `FIDELITY ×`
  the most-practised adult in the household's months in each trade, plus
  `GEN_CREDIT` for every generation that practised it; the band reads
  `own + inherited + credit`. The short-lived road. With a 24-month credit a
  mouse family is journeyman at birth by its third generation (~60 years) and
  master at birth by its fifth; a tortoise family earns one credit every 53 years
  and its individuals master by outliving everyone. r-strategists and
  K-strategists, both real.
- Inherit from whoever is in the household at birth and PRESENT (not held,
  penned or sold) — that covers a grandparent who stayed home, and the pen: the
  hall eats the pigs' knowledge. Fidelity rises inside a Library's or a
  University's reach: the deferred "school" (K&C proposal) becomes knowledge's
  per-citizen effect without touching adulthood.
- Needs: a parent link (two ids on the cub, written only when present — the
  `victimClass: 0` lesson) and a sparse per-trade months map on the citizen
  (saved only when non-zero; most animals hold one or two entries). Deeds add
  integer months, never a curve: a kill to meat (the owner: "predators hunting
  prey also gives experience"), an arrest to police, a fire fought to fire.

### 3b. The divisions

A division earns its place by having its own EMPLOYER and its own FIELD for the
skill to act on. The owner's twelve, with the three owed and the two rulings:

| division | employer | field | base | skill acts on |
|---|---|---|---|---|
| commercial low | tier-1 shops (the eleven kinds) | customers: the local five-tile count PLUS rail customers within a 24-step shopping budget (`js/sim/commercial-customers.js`, landed by another hand the same day — see the note below) | 5 Chebyshev + 24 steps by rail | the local radius, 4–7, or the budget — §5 q8 |
| commercial high | arcade / emporium tiers 2–3 | the same | the same | the same |
| industrial low / high | works / mill / foundry by tier | none exists today — see §5 q4 | — | — |
| meat (kills are deeds) | halls | customers (carnivores near); dread is a smell | 7 walking; `DREAD_RADIUS` Chebyshev | reach grows; dread shrinks a tile |
| zoo & pacification | prison, centre | CITYWIDE, no shadow | — | beds (the open centre bottleneck) |
| police | station | cover | 7 walking, 5–10 | the reach |
| fire | station | cover | 7 walking, 5–10 | the reach |
| library / gallery | 2×2 campuses | knowledge / culture | 7 walking | the reach |
| university / amphitheater | 3×3 campuses | tile budgets (half the map, an eighth) — UNTOUCHED | as ruled 2026-09-05 | not the range (§5 q3) |
| health / sanitation (owed) | new | cover: health; mess emission cut | 7 walking | the reach |
| cemetery (owed) | no workers | CITYWIDE: the archive's reader | — | none |
| parks | no workers | none | — | none (§4) |

**A note on the commercial row.** While this was being written, `c39c8ee` ("Let
rail-connected commercial districts attract distant customers") replaced the
shop's flat five-tile resident count with `commercialCustomers`: the same local
count plus RAIL customers — every home within `C_SHOP_TRAVEL` 24 equivalent
walking steps whose route to the shop actually rides a train, weighted
`C_RAIL_CUSTOMER_WEIGHT` 0.04 and fading to zero at the budget, capped at
`C_RAIL_CUSTOMER_CAP` 80. That is the owner's "rail counts as free travel"
built for shops before this arc opened, in a different shape: a route that only
WALKS beyond five tiles counts for nothing, and the ride is priced at the
commuter's 2/9, not zero. The skill reach for commercial therefore acts on
whichever of the two the owner names (§5 q8); the walking-tile rule in §3c is
written for the SERVICES, whose fields are Chebyshev floods today.

Kin pairs (low/high, library/university, gallery/amphitheater, zoo/centre) share
experience at one half, so a shop that grows from low to high under its crew does
not zero them. Trade NAMES come from the zone family (mill-hand, foundry-hand,
clerk, hall-hand, constable) with the shop kinds as the flavour layer at tier 1:
only 35–43 of ~1,000 workers stand in a named shop and 70% work in industry.

### 3c. The tile rule

Tiles in reach grow with the SQUARE of the radius: +2 tiles on a Chebyshev-6
station is +71% of its ground, −2 is −52%. So: master +2, journeyman +1, green
0, untrained −1 (the owner's "a tile or two"), applied as the crew's MEAN with
vacancies counting as untrained — a brand-new station covers less than its
sticker until its crew greens in a year, and an empty one never covers fully.
Staffing starts to matter with no gate anywhere. The range is WALKING tiles
through `fields.dial` with the meat policy (rail free), base 7, so a green crew
sits at today's cover on the owner's layout and a master crew reaches 10. Smells
(smoke, dread, mess) stay Chebyshev radii — "a radius is for a smell" — and
skill shrinks them by a tile.

### 3d. Citywide items

The zoo casts nothing already (it is the prison since the campuses arc). The
CENTRE still does — `LV_VAN` within 2 and `VAN_MOOD` for carnivores within 4 —
and the ruling strikes both. Their crew's skill acts on BEDS: a veteran crew
turns cells over faster, so the justice probes' bed bottleneck becomes a
staffing question. The cemetery has no workers and no shadow: it is a place that
reads the permanent archive — click a stone, get the epitaph — and where the
funeral walk ends (the wedding's cousin).

### 3e. What the player sees

The card: "journeyman mill-hand, 6 years at the foundry on (23,8); daughter of
Clover and Bram Burrowes, third generation at the mill". The lot card names its
KEEPER: "the Vulpins' arcade, kept by Tamset Vulpin these 29 years", and its
heir. Ticker lines in the deadpan register: a keeper's succession ("the
Whiskerton bakery passes to the third generation"), "under new management" when
none stood by, and the one line that IS technique-death here — "with Ambrose
Shelby dies the last master clockmaker in Zoo City" — real because a shop kind
is a few dozen animals.

## 4. Built on the way: parks have no workers (2026-09-07)

The Large Park employed twelve (`LARGE_PARK_JOBS`, counted in the C valve), a
leftover from when the garden was the zoo. Struck on the owner's word:
`civicJobs` lists no Large Park; `jobZone` no longer treats a park as a C job
site; a city saved while a park employed lets those hands go at load, silently,
in `save.releaseOrphanJobs` (no LOST_JOB chapter — a rule changed, nothing
happened to them); the card no longer prints a park's jobs; SPEC §3's table says
so. Two regressions in `tools/check-civic-campuses.mjs`, each mutation-tested.
The mayor's rigs are byte-identical (balanced `c055aba5`, estate `2ced10f8`) —
she builds only 1×1 parks.

Parks themselves are untouched, and the owner's standing rule for them is the
law already in the tree: *"most of the time i build the parks in the middle of
blocks of houses, their AOE should work without roads, just a general
improvement around the building itself."* A park needs no road to be placed
(`ops.js` exempts `park` and `largePark` from the touching-road rule), keeps
its land-value halo and its capacity amenity without one (`fields.js`: "Parks
keep their amenities without roads"; the census counts a Large Park served or
not), and a home's park wish is geometric — within 4 of the home, whatever the
roads do. The standing check that a Large Park's halo and population amenity
survive losing their road stands. Under §3c parks stay Chebyshev radii for the
same reason: a general improvement round the building, never a service
somebody walks to.

## 5. Open for the owner

1. ~~**The merge rule's shape**~~ RULED (round 6) and BUILT (§8e): the same
   species preferred; predator and prey at one courtship in ten; one couple in
   ten companions, who keep no litter; the twelve temperaments weigh the
   choice; a household parts only by death.
2. **The generation credit** — 24 months per practised generation, capped where?
   Uncapped, a fifth-generation mouse is master at birth; that may be the point.
3. **University and Amphitheater** — their ranges are untouched (ruled). Do their
   crews' skills act elsewhere: professors' skill as the fidelity bonus for cubs
   in reach (the school), actors' skill as the strength of `LV_CULTURE`? Or no
   effect beyond the name on the card?
4. **Industry's field** — nothing exists: a works has jobs and smoke and no
   customers. Two honest readings of "industrial, 5–10 walking tiles": (a) skill
   shrinks the smoke (a smell, Chebyshev, cheap); (b) a goods link — works supply
   shops within N walking tiles, rail free, and supplied shops grow — a new arc
   that would give industry a benefit field for the first time.
5. ~~**Crew mean vs the keeper alone**~~ RULED (round 6): *the best hand on the
   crew* sets the reach — one master carries a green crew; the reach never
   drops while the master stays.
6. **Health's channel** — lifespan is rolled at birth (`deathAge`), so a clinic
   needs its own consumer: fewer natural deaths in cover, an epidemic event the
   cover resists, or litters lost. A ruling, not a default.
7. **Deeds** — the list, and the months each is worth.
8. **Commercial's reach** now that shops count rail customers within a 24-step
   budget: does a veteran crew widen the local five-tile count, the budget, or
   both?
9. ~~**The commute stretch**~~ RULED (round 6): *not now*. The shape and its gate
   stay in §9 for the day a real save shows a jobless animal beyond 40 steps.
10. ~~**The children who leave**~~ superseded by §10: friction is retired into
    the push, and the roots damp is q13.
11. ~~**The crowding push**~~ RULED (round 6): *wire it* — a full home breeds at
    ×0.25 and goes over capacity; built in step 0 (§8e). Its share of the
    change is measured there.
12. **The push's threshold** (§10) — 3 of the weighted score is the
    recommendation (about one household in a hundred a year on the mayor's
    town; 2 is a churn machine, 4 is lumpy and rare).
13. **Roots** (§10c) — damp the push by years at this home and by a town-born
    adult under the roof? Without it the estate, chronically crime-and-smoke
    and taxed through a recession, lost a third of itself in the shadow.
14. **The factor list** — the nine measured (a lost job, no friends, low mood,
    crime, smoke, dread, crowding, taxes above neutral, a burned home); any to
    add — a killing next door, no park in reach, no station's cover?

## 6. Instruments (run from the repo root; all passive, exit 0)

```text
node tools/tenureprobe.mjs --layout estate --years 30      # tenure, bands, keeper succession, who lives with a veteran
node tools/lineageprobe.mjs --layout estate --years 60     # the ratchet as a shadow ledger; natives-never-breed
node tools/reachprobe.mjs --layout estate --platform 2     # walking tiles vs Chebyshev; rail free vs priced
node tools/breedprobe.mjs --layout balanced --rule court   # the household-merge candidates as a pass OUTSIDE the sim; the population ledger by decade (§8)
node tools/commuteprobe.mjs --layout estate --civics --at-centre  # commute vs the benefit radius and the species' preference; the jobless' nearest open job (§9)
node tools/leaveprobe.mjs --layout estate --years 60 --seed 8                     # who leaves and why, by the sim's own push; the as-decided threshold line (§10e)
node tools/leaveprobe.mjs --layout estate --set LEAVE_P=0                          # the control: nobody leaves
node tools/leaveprobe.mjs --layout balanced --rule push --thresh 3 --push-p 0.05   # the OLD rootless shadow, the sim's push off (§10b)
```

## 7. Build order (a sketch, none of it opened)

0. ~~**The merge rule**~~ BUILT 2026-09-07 in two commits — the twelve
   temperaments as a read (`30be0b8`, byte-identical) and the rule (weddings,
   companions, the cross-line courtship, the temperament multiplier on
   friendships, the full-home litter). Every rig's hash moved: balanced
   `c055aba5` → `12427ef4`, estate `2ced10f8` → `747d57d3`; with the five knobs
   neutral (`--set WED_P=0 BIRTH_FULL_MULT=0 TEMPER_*=1`) the balanced rig hashes
   `c055aba5` again, so the bump is exactly those rules (§8e).
0b. ~~**The migration push**~~ BUILT 2026-09-07, late, in two commits (§10d,
   §10e): the fields and the tent (`7e701e0`, rigs unmoved but for the two
   saved fields), then the push in place of friction with roots set at 3 years.
1. **The band as a READ** — card, census, ticker; `tick − hired`; hash-neutral.
2. **Parents at birth + the family line on the card** (two ids, saved when present).
3. **The keeper on the lot card + the succession line**; measure the cadence on
   the control city when it arrives.
4. **The tile rule on ONE service** (police), measured with `serviceprobe` and
   `reachprobe` before the others follow; the centre's shadow struck in the same
   commit.
5. **The ratchet** (inheritance at birth), then the school as fidelity.
6. Health, sanitation, cemetery — each its own proposal.

## 8. Population: the two levers, measured (the owner's round 5)

*"right now any change in population comes from migration."* The ledger agrees,
and says something worse: the town's NATURAL change is negative. Sixty years of
the mayor's town, today's rules (`tools/breedprobe.mjs --rule none`):

| 60 years, today | balanced | estate |
|---|---|---|
| arrived − left | 5,395 − 2,244 = **+3,151** | 3,672 − 1,706 = **+1,966** |
| born − died | 1,394 − 2,205 = **−811** | 1,315 − 1,594 = **−279** |
| born with a town-born parent | 4 | 2 |
| population; town-born | 2,318; 32% | 1,665; 35% |
| singles (one fertile-aged adult alone) | 575, of whom **557 share a lot with another single** | 416, of whom 414 |

The four and the two are the loophole, not a rule: a cub that found no home at
sixteen stayed, and the birth rule counts any two fertile adults in a household
— it bred with a parent. And the last row is the supply: nearly every single
already lives on a lot with another single. Nothing is missing but the rule.

### 8a. What exists today

- **Migration IN.** `households/month = 0.10 · V_R · vacant homes / 3`, where
  `V_R = (jobs + seed − workers) / workers` plus the tax term, capped at
  `1 − P/Cap`; `Cap = 1200 + 150·parks + 500·large parks + festival + 600·K −
  400·watched share, × (1 + 0.5·H)`. Species by what was built. So the
  player's levers already are: zone jobs (the R valve is a labour shortage),
  zone homes, the R rate, parks and large parks, festivals, libraries, the
  friendships index — and cameras, downward.
- **Migration OUT.** At `V_R ≤ 0` a household rolls `(0.06 unemployed | 0.015) ·
  −V_R · (1 − 0.2·friends) · (1.5 − mood/100)` — and since the camping arc that
  roll moves the family to a TENT, not out of town. The only true emigration is
  FRICTION: a household whose adults are all friendless wanders off at 0.4% a
  month, at any valve. The OUT lever is therefore friendship — parks,
  workplaces, wakes.
- **Growth.** `p = litter/96` a month for a household with two fertile,
  unfixed, present adults and headroom in the lot. Arrival couples only, since
  natives never pair. The SPEC's ×0.25 litter in a full home was never wired
  (`BIRTH_FULL_MULT` is read by nothing; SPEC §7.2 corrected today), and the
  "move-in at 16" the same section gestured at never existed. Downward: a fixed
  animal has no litter, the hall sells, the killing kills.

### 8b. The experiment: three shapes of the merge rule, as a pass outside the sim

`breedprobe` runs the mayor's town and, between ticks, moves whole households
the way `placeHousehold` would (occupants, household ids, a stale commute, a
MOVED chapter) — the sim's own birth rule does the rest. Nothing in the sim
changed. A "single" is a housed household with exactly one present adult inside
its fertile window; a widowed parent with cubs counts, and the partner joins the
cubs. Fixed animals court like anyone, so the sim's own `littersLost` measures
pacification's bite.

| balanced, 60 years | today | `lot` (pair on your own lot) | `court any` | `court same` | `court prefer` |
|---|---|---|---|---|---|
| weddings; same : cross-species | — | 998; 211 : 787 | 1,200; 224 : 976 | 1,239; all same | 1,247; 936 : 311 |
| mean wait while single | — | 34 months | 18 | 19 | 14 |
| born (with a town-born parent) | 1,394 (4) | 1,901 (598) | 2,035 (878) | 2,173 (835) | 2,141 (922) |
| arrived; left | 5,395; 2,244 | 3,952; 1,718 | 3,318; 1,552 | 3,764; 1,759 | 3,188; 1,511 |
| population; town-born | 2,318; 32% | 2,100; 53% | 1,865; 63% | 2,077; 58% | 1,913; 65% |
| deepest generation | 2 (the loophole) | 4 | 3 | 4 | 4 |

`court` looks within `REHOME_RADIUS` 12 road tiles (the reach a cub already
uses to find its first home) and the courting single moves in with the nearest
eligible single, or is moved in with, whichever lot has room; `prefer` takes the
same species when one is in reach and anyone but predator and prey otherwise;
every rule rolls p = 1/12 a month per single. The estate says the same (`court
any`: born 2,006 with 858 town-born-parented, population 1,725 against 1,665,
63% town-born, generation 4; `court prefer`: 1,912 / 802 / 1,708 / 63% / 4).
At 90 years (`court any`, balanced): born 3,680 against arrived 3,690, 84%
town-born, the fifth generation alive, arrivals down to 82 a decade.

**What it says.**

1. **Births rise by half and the ratchet turns.** 1,394 → 1,900–2,170 births;
   town-born parents 4 → 600–920; generation 4 at sixty years, 5 at ninety —
   the arithmetic of §2c (a mouse line turns three generations in sixty years).
2. **The town does not get bigger. It gets born here.** Population moves by
   −20% to +2% while arrivals fall by a thousand to two thousand: births take
   the vacancies migrants would have taken, because arrivals are `V_R ×
   vacancies` and `V_R` is jobs over workers. **Size is set by jobs and homes;
   the merge rule sets WHO fills them.** That is the owner's two levers as the
   sim already draws them: migration and growth pull on the same rope, and the
   rope is the R valve.
3. **The pairing rule is the town's face, not its size.** Under `any`, 80% of
   weddings are cross-species — a hawk and a cat, a pig and a mouse — because
   the nearest single is usually another species; under `prefer` a quarter on
   the balanced town and 7 in a hundred on the estate (where quarters are
   species-sorted); under `same`, none. Births differ by under 10% between them.
   The interspecies city is a ruling, not a parameter: q1.
4. **The children leave.** `left` stays at 1,400–1,750 whatever the rule; at
   ninety years the breeding town sheds 270 a decade against 82 arriving. That
   is FRICTION — a town-born adult splits into a household of one at sixteen,
   often friendless, and wanders off. It is the OUT lever working as written,
   and it is the one that keeps a breeding town from bursting: q10.
5. **The cheapest shape works.** `lot` — pair with a single already on your
   lot, no search, no move — marries a thousand in sixty years, because 97% of
   singles already have one there. It waits twice as long (34 months) and turns
   the ratchet less (598 town-born-parented births against 878–922).
6. **The loophole closes with the parent link.** Today's four births with a
   town-born parent are cubs that stayed home and bred with a parent; §3a's two
   parent ids on the cub let the merge rule and the birth rule refuse that.

### 8c. Pacification, with teeth

*"if there is no breeding then pacification is mostly an empty threat."* On the
rig it is empty twice over: the centre's customers are murderers and second
thieves, and the mayor's estate with a station and a centre fixes **three**
animals in sixty years (litters lost: 10). What the rule gives each of those
three is a LINE. The arithmetic per fixed animal, `(fertile end − age) × 12 ×
litter/96` litters forgone: a wolf fixed at 25, 5.6; a cat at 18, 3.75; a fox at
25, 3.75; a bear at 30, 1.9 — and its partner's as well, since a bitten
household never pairs again, and under the ratchet every cub those litters would
have had. With the collection controls that landed this morning (`93a502a`, the
player orders a collection) pacification becomes a lever the player pulls, and
the merge rule is what puts weight on it.

### 8d. The shape recommended, and the levers it leaves the player

Build `court prefer`: a single fertile-aged adult looks within 12 road tiles
once a year on average, takes the nearest single of its own species, or anyone
but predator and prey if none, and the household with room hosts the other;
refuse a parent–child pair once the parent link exists; the wedding procession
is the ticker's line and the funeral walk's cousin. Then the population levers
read, honestly:

| lever | up | down |
|---|---|---|
| jobs and homes (the R valve, the Cap) | migration AND growth — the rope | — |
| the merge rule | who fills the homes: born here | — |
| headroom (the tier of the home) | a litter needs a place | — |
| friendship (parks, workplaces, wakes) | the children stay | friction: they leave |
| the centre | — | a line ends |
| the hall, the killing | — | an animal ends |
| health (owed, §5 q6) | litters survive | — |

### 8e. As built (2026-09-07, evening): the shadow became the rule

The owner's round 6 changed the shape in three ways — the twelve
temperaments weigh the choice; predator and prey marry at one courtship in ten;
one couple in ten are COMPANIONS and keep no litter ("10% gay", in a sim with
no sex) — and wired the full-home litter (×0.25, a home goes over capacity).
SPEC §7.2, §7.5, §7.11 are the law now; `tools/check-generations.mjs` holds 21
checks. Measured with the sim's own rule (`breedprobe --rule none`), sixty
years, against §8b's control:

| 60 years | balanced, today | balanced, built | estate, today | estate, built |
|---|---|---|---|---|
| arrived; left | 5,395; 2,244 | 2,527; **770** | 3,672; 1,706 | 1,707; **447** |
| born (with a town-born parent) | 1,394 (4) | **2,447 (1,276)** | 1,315 (2) | **2,046 (1,113)** |
| died | 2,205 | 2,019 | 1,594 | 1,408 |
| population; town-born | 2,318; 32% | 2,163; **77%** | 1,665; 35% | 1,874; **78%** |
| deepest generation | 2 | 4 | 2 | 4 |
| weddings; companion households; mixed households | — | 1,979; 57 of 747; 118 | — | 1,444; 46 of 618; 44 |

At ninety years the balanced town is 94% town-born, generation SIX is alive,
nobody has arrived for two decades and nobody has left (the R valve sits at
zero: jobs and homes are full of the town's own). **Departures collapse** —
2,244 → 770 and 1,706 → 447 — because a wedding befriends the pair and a
household with a friend never rolls friction; the OUT lever of §8 q10 is
largely closed by the rule itself. Attribution, balanced: weddings off
(`--set WED_P=0`) leaves the full-home litter alone — born 1,753 (4), 35%
town-born, generation 2; the full-home litter off (`--set BIRTH_FULL_MULT=0`)
leaves the weddings alone — born 2,072 (972), 66% town-born, generation 4. So
the wedding is the lineage and the crowding push is a sixth of the births.
On the estate with a station and a centre: pacified 2 in sixty years, 14
litters lost in one decade — the bite is real per animal and the centre is
still rarely used (§8c stands).

## 10. Migration both ways: the push, measured (the owner's round 7)

*"migration should definitely be bidirectional. it should take more than just a
fire for people to leave, it would have to be a combination of factors."*

### 10a. What removes a family today

The OUT channels in the tree (`citizens.js`): FRICTION — a household whose
adults are all friendless wanders off at 0.4% a month; HOMELESS — the home is
rubble (a fire) or gone and nothing within 12 road tiles has room, and no tent
is tried; EVICTED and DISPLACED — a storey lost or a mansion risen, no home, no
tent; ZONED OUT — the player's line; REVOLT — the tax event walks 8% of the
households out; and at V_R ≤ 0 the downturn roll pitches a TENT rather than
leaving. `tools/leaveprobe.mjs` reads every departed animal's cause from the
permanent archive and the factors that were wrong at home the month before.
Disasters ON, sixty years:

| today | balanced | estate |
|---|---|---|
| arrived | 2,468 | 1,553 |
| left, every one by FRICTION | 630 | 450 |
| homeless after a fire; evicted; revolted | 0; 0; 0 | 0; 0; 0 |
| tents pitched in downturns | 28 | 121 |
| population | 2,225 | 1,646 |

At ninety years the balanced town takes 13 arrivals and loses 30 a decade:
closed. Departures are single-cause — of the balanced town's ~260 leaving
households, 134 had ONE thing wrong (no friends), 84 two, 41 three or more.
**A fire alone moved nobody on either rig**, because a burned-out family always
found a home within twelve road tiles; but the code path is there — a household
whose home is rubble and finds nothing in reach is REMOVED, no tent tried, while
the evicted and the displaced do try one. On a map fuller than the mayor's, that
is "just a fire".

### 10b. The push, as a shadow

Nine factors read at home each month, each yes or no, weighted: a lost job 2 ·
no adult with a friend 1 · mean mood under 40 1 · crime above `CRIME_HIGH` 1 ·
pollution above the species' tolerance 1 · a herbivore household at
`REHOME_DREAD` 1 · over capacity 1 · the R rate more than a point above neutral
1 · the home burning or rubble within the year 2. Score at or above a THRESHOLD
leaves at `p × (score − threshold + 1)` a month, through the sim's own removal;
friction retired (friendless is a factor). Balanced, sixty years, p = 0.05:

| threshold | left | arrived | population | the shape of it |
|---|---|---|---|---|
| today (friction only) | 630 | 2,468 | 2,225 | closed at ninety years |
| 2 | 3,947 | 4,789 | 1,574 | a churn machine — two things wrong is most of a town |
| **3** | **1,151** | **3,188** | **2,321** | about one household in a hundred a year; at ninety years 268 leave and 37 arrive a decade — the doors swing both ways |
| 4 | 895 | 2,714 | 2,221 | lumpy and rare: 354 in one decade, 27 the next |
| 3, friction kept | 1,642 | 3,322 | 2,076 | stacked; friction is the push's one-factor case and should go |

Who leaves at 3: a lost job + no friends + low mood ×68, a lost job + no
friends ×36, those two + crime ×36, low mood + crime + smoke ×29 — a
combination every time, by construction. The ESTATE at 3 lost 3,981 of a town
of 1,600 (arrived 3,972; population 1,121 against 1,646): its quarters sit at
crime + smoke chronically, and a recession sent the rig's R rate to 11 against
a neutral 8 for a decade — crime + smoke + taxed drained it. That is the rule
with teeth and no roots, and it is the number to balance against.

### 10c. The shape recommended

- **The push at threshold 3, p 0.05, the nine factors as measured.** A single
  grievance never moves anyone: not a fire, not a lost job, not an empty
  friends list. Acute things weigh 2 (a lost job, a burned home), chronic
  things 1 (crime, smoke, taxes, crowding), so a dense quarter under a bad
  month leaves and a quarter that is merely dense stays.
- **Roots** (q13): `p × 1/(1 + years at this home/10) × (a town-born adult
  under the roof ? 0.5 : 1)` — long residents and the town's own children
  leave less readily; measured at build against the estate's drain.
- **The burned-out try a TENT** before they are removed, as the evicted do; the
  tent is the `burned` factor for the push. Friction retired.
- **The line**, in the register: *"MOVED AWAY — the Burrowes (4 rabbits) left
  (12,8): no work, no friends, and the smoke."* — the factors named, so the
  player reads what to fix. The family is archived as today.
- Arrivals are already the pull (what was built, `V_R × vacancies`); the push
  is what keeps the doors swinging. Every rig hash moves; `leaveprobe --rule
  none` before and after is its measure.

### 10d. The build, scoped — RULED 2026-09-07 night, WRITTEN PLAN ONLY

The owner's rulings: threshold **3**; roots **yes, by years at this home and a
town-born adult**; the factors **the nine as measured**; and *"written plan
only, we are about to compact after its scoped"*. Build from this page.

**Knobs** (`rules.js`, in place of `FRICTION_P`, which is struck — a friendless
house is one grievance and moves nobody alone):

```text
LEAVE_THRESH: 3           weighted grievances before a household may leave
LEAVE_P: 0.05             a month per point at or over: p = LEAVE_P · (score − LEAVE_THRESH + 1) · roots
LEAVE_W_ACUTE: 2          a lost job; a burned home
LEAVE_W_CHRONIC: 1        no friends, low mood, crime, smoke, dread, crowding, taxes
LEAVE_MOOD_LOW: 40        mean mood under this is a grievance
LEAVE_TAX_OVER: 1         the R rate this many points above neutral is a grievance
LEAVE_BURNED_MONTHS: 12   a burned home counts for this long
LEAVE_ROOTS_YEARS: 10     roots = 1 / (1 + years at this home / LEAVE_ROOTS_YEARS)
LEAVE_NATIVE_DAMP: 0.5    × when a town-born adult lives under the roof
```

**State** (on the household; saved only when set; old saves take the defaults):
`hh.homed`, the tick the household took its current home — set in
`placeHousehold` on every move, a wedding's host keeps its own, default on load
= `arrived`; NOT `since` (`world.since` is the building-age tile array).
`hh.burnedAt`, the tick the home was lost to fire (rubble or burning at step
0), carried through the rehome or the tent.

**The factors** — `leaveScore(world, hh)` exported from `citizens.js`, the
probe's `profile` moved into the sim and read the same way; a camping
household (home −1) reads only the five that need no lot: unemployed,
friendless, low mood, burned, taxed.

| factor | read | weight |
|---|---|---|
| unemployed | a present adult `isWorker` with `job < 0` | acute 2 |
| burned | `tick − hh.burnedAt ≤ LEAVE_BURNED_MONTHS` | acute 2 |
| friendless | adults present and every one with no friend | chronic 1 |
| low mood | mean `mood` of present members `< LEAVE_MOOD_LOW` | chronic 1 |
| crime | `crime[home] > CRIME_HIGH` | chronic 1 |
| smoke | `pol[home] >` the label species' `polTol` | chronic 1 |
| dread | a herbivore label and `dread[home] ≥ REHOME_DREAD` | chronic 1 |
| crowded | `occupants[home] > capacityOf(home)` | chronic 1 |
| taxed | `rates.R > neutralRate(P) + LEAVE_TAX_OVER` | chronic 1 |

`roots = 1 / (1 + (tick − hh.homed) / 12 / LEAVE_ROOTS_YEARS) × (a present
town-born adult ? LEAVE_NATIVE_DAMP : 1)`.

**Where.**
1. `citizens.js` step 6 "Departures and friction": keep the `V_R ≤ 0` downturn
   roll (it pitches a tent). Replace the friction line with the push: score at
   or over `LEAVE_THRESH` → `p = LEAVE_P · (score − LEAVE_THRESH + 1) · roots`;
   on the roll, `out.left += n`, the MOVED AWAY notice, `world.departures.push`
   for the walker layer, `removeHousehold(world, hh, "left")` (the archive's
   existing cause). NOTHING DRAWS under the threshold. Camping households are
   evaluated too, on the tent's five.
2. `citizens.js` step 0 "No ghosts": when the home is rubble or burning, set
   `moving.burnedAt = world.tick`; then `if (to >= 0) place… else if
   (!startCamping(world, moving)) removeHousehold(…, "homeless", i)` — the tent
   before the road, as the evicted and the displaced already have.
3. `placeHousehold`: `hh.homed = world.tick`; `joinHousehold`'s host keeps its own.
4. `save.js`: `homed` saved when `≠ arrived`, `burnedAt` when set; load defaults.
5. `rules.js`: the knobs above; card C2 keeps the camps; a new card C5 "Moving
   away takes a combination" with the table as its formula and
   `${last.left} left last tick · N households at the threshold now` live.
6. The line, in `citizensTick`'s notices on the ZONED OUT pattern: *"MOVED AWAY
   — the Burrowes (4 rabbits) left (12,8): no work, no friends and the
   smoke."* — the reasons in prose: no work · no friends · low spirits · the
   crime · the smoke · the dread · the crowding · the taxes · the fire.
7. `SPEC.md` §7.4: LEAVE rewritten as the push, FRICTION struck, HOMELESS → a
   tent first; §7.2 the two fields. `tools/leaveprobe.mjs`: `--rule none` reads
   the sim's own push; `--rule push` zeroes `LEAVE_P` for the old shadow.
8. Checks (`tools/check-generations.mjs`, or `check-migration.mjs` registered
   beside it): (a) one grievance never moves anyone — a friendless single
   (score 1) and an unemployed couple (2) stay 24 months at `LEAVE_P` 1; (b)
   three moves — a lost job + no friends + low mood leaves within twelve months
   at `LEAVE_P` 1, and the line reads "no work, no friends and low spirits";
   (c) roots — export `leaveChance(world, hh)` and assert it a third at twenty
   years in the home and half again with a town-born adult; (d) a burned-out
   family with a home in reach is rehomed and carries `burnedAt`; with none it
   CAMPS, not removed, and a burned-out camping family with no work (2 + 2)
   leaves within twelve months at `LEAVE_P` 1; (e) `homed` and `burnedAt`
   survive a save and a load, and a town without them hashes as it did; (f) the
   six-month continuation hash; (g) THE FALSIFIER — `--set LEAVE_P=0` on the
   mayor's rigs (disasters off, thirty years, `breedprobe --rule none`) must
   hash balanced **`16dfcc5a`** and estate **`564c8f1a`**, which is today's tree
   with `FRICTION_P=0` (measured 2026-09-07 night); the tent-before-removal
   change touches no rig, homeless being 0 on both.

**Two commits**, the byte-identical one first: (1) the fields, the tent before
the road, the knobs unread, the card, the SPEC — rigs unmoved; (2) the push in
place of friction, the checks, the measurements.

**Measured before and after**: `leaveprobe --rule none` on both rigs, sixty
years, disasters on — departures by cause and the factor histogram; the
ninety-year balanced town's arrivals and departures per decade; the estate's
population against its control (today 1,646).

**Acceptance**: suite green; the falsifier holds; balanced departures 800 to
1,400 per sixty years (today 630, all friction); the estate keeps at least 80%
of its control population at sixty years — that is the roots damp's job, and
if it fails, raise `LEAVE_ROOTS_YEARS` before touching a weight; a fire alone
moves nobody (check d); no household in the archive left with fewer than three
weighted grievances the month before (the probe asserts it over a rig run); at
ninety years both arrivals and departures per decade stay above zero.

### 10e. BUILT and measured — 2026-09-07, late

Two commits, as scoped: `7e701e0` (the fields, the tent before the road, the
knobs unread — stripped of the two saved fields the rigs hash `16dfcc5a` /
`564c8f1a`, today's tree to the byte; with them `52fde3b4` / `c3843687`) and
the push itself. **The falsifier holds**: `--set LEAVE_P=0` returns `52fde3b4`
and `c3843687` — the push draws nothing under the threshold, draw for draw.
Suite green; fifteen mutants, fifteen caught (the loop's threshold, the
chance's threshold, roots, the native damp, years from `arrived`, no work
weighing chronic, a tent reading crime, the fire counting forever, the line,
the archive cause, the threshold count, campers, the prose, the walker record,
the record's reasons) on top of commit A's seven.

**One knob moved from the scope: `LEAVE_ROOTS_YEARS` 10 → 3.** The plan said
the roots damp answers the estate's drain, and it did not at 10 (§10d's
"raise" meant "strengthen"; the damp is 1/(1 + years/LEAVE_ROOTS_YEARS), so
strengthening is LOWERING it). Sixty years, disasters on, four seeds —
arrived / left / P:

| roots | balanced 7 · 8 · 9 · 10 | estate 7 · 8 · 9 · 10 |
|---|---|---|
| today (friction; seed 7) | 2,468 / 630 / 2,225 | 1,553 / 450 / 1,646 |
| control `LEAVE_P=0` (nobody leaves) | — | 988 / 0 / **870** · 1,385 / 0 / 1,686 · 1,232 / 0 / 1,691 · 1,015 / 0 / **874** |
| 10 (scoped) | 2,692 / 875 / 1,876 · 2,440 / 616 / 2,042 · 3,034 / 922 / 2,131 · 1,605 / 431 / 1,758 | 3,095 / 2,315 / 1,221 · 2,977 / 2,572 / 1,115 · 3,731 / 3,654 / 919 · 3,253 / 2,829 / 1,011 |
| 5 | 2,424 / 531 / 2,057 (seed 7) | 2,633 / 2,279 / **660** · 2,812 / 1,970 / 1,531 · 2,564 / 2,222 / 1,075 · 3,877 / 3,683 / 979 |
| **3 (set)** | 2,789 / 693 / 2,028 · 2,230 / 279 / 2,219 · 2,387 / 532 / 2,211 · 1,917 / 274 / 2,005 | 3,057 / 2,079 / **1,498** · 3,110 / 2,223 / **1,517** · 2,125 / 1,242 / **1,607** · 2,653 / 1,986 / **1,326** |

What the table says. At 10 the estate drains on every seed (56–74% of its
thriving controls). At 5 it is a coin toss (seed 7 fell off a cliff in one
recession: 1,134 → 577 in a decade, 199 tents, 662 gone — a downturn makes
every jobless house acute and the tent's five read no work + low spirits +
no friends). At 3 it holds on all four: 90–95% of the controls that thrive
(seeds 8, 9) and ABOVE the controls that collapse (seeds 7, 10, where with no
door out the estate's economy seizes — no vacancies, no V_R, no arrivals after
thirty years, P 870 at sixty and 564 at ninety). The estate rig is chaotic
under disasters; a single-seed control is a coin, which is why four seeds. The
push with roots at 3 is the STEADIER estate: 1,326–1,607 against a control of
870–1,691.

**The acceptance, re-stated honestly.** The 800–1,400 departures range in §10d
was calibrated on the ROOTLESS shadow (1,151); roots at 10 already gave
431–922 across seeds, and at 3 the balanced town loses 274–693 in sixty years
— fewer than friction's 630 on seed 7, every one a combination and named. The
owner's stated priority was roots against the drain; that is what 3 buys. The
estate floor (≥ 80% of control) is met where the control means anything. A fire
alone moves nobody (checks). NOBODY LEFT UNDER THREE as the sim decided it: 0
of 370 (balanced) and 0 of 860 (estate) pushed households at 10, 0 of 298 and 0
of 802 at 3 — the departure record now carries the score and the reasons as
decided (the month-before read the probe also keeps lags it on 16–68: a home
burned or a job lost between the read and the roll). The doors at ninety
(balanced, seed 7, roots 3): arrivals by decade 1,282 · 566 · 161 · 188 · 284 ·
308 · 261 · 6 · 0 and departures 213 · 135 · 90 · 185 · 33 · 37 · 165 · 21 · 29;
P 2,485 against the no-push control's 2,407. The arrivals door shuts in the last
two decades because the town is FULL (V_R ≤ 0, no vacancies), which is the
pull's own law; the push kept it breathing through eight. The estate at ninety
with the push: 1,262 (3,928 in, 3,457 out); its control: 564.

What the town reads: *"MOVED AWAY — the Burroweses (4 rabbits) left (12,8): no
work, no friends and the smoke."* — the surname pluralised as English does (a
small helper, `theFamily`, also on the ZONED OUT line). Card C5 "Moving away
takes a combination" with `N left last tick · M households at the threshold
now`. The archive keeps "left town". `tools/leaveprobe.mjs --rule none` is now
the sim's own push; `--rule push` zeroes `LEAVE_P` and runs the old shadow.

Two traps for whoever tunes this next. A fixture shop DECAYS within the year
and takes its jobs with it (so a "single with a job" is unemployed by month
fourteen — the one-grievance fixtures use retired animals). An unpoliced
fixture lot crosses `CRIME_HIGH` within the year, a second grievance the
one-grievance claims must hold off (`CRIME_HIGH: 1000` in those fixtures), and
a fixture with disasters on once burned the spare cottage and handed a couple
the smoke. And the lesson under both: NO WORK IS NEVER ALONE FOR LONG — the
mood rule puts a jobless adult at 30 within the month (BASE 50, NO_JOB −20),
so a lost job is two points and low spirits follows it: a jobless household
with no friend is at the threshold from its first month.

## 9. The commute is not the benefit (the owner's round 5, second ruling)

*"i am ok with people traveling to work further than the range of the benefit
of the service."* That is the law already, and has been since the job search
was written: a worker takes any open job within `COMMUTE_MAX` 40 walking steps
(a ride step 2/9), scored `pref × 1/(1 + d/sp.commute) × noise` — the species'
commute is a PREFERENCE (and +10 mood when met), never a gate, and nothing about
hiring reads a station's radius or a campus's budget. Measured
(`tools/commuteprobe.mjs`, thirty years, the probe paying for a full set of
civics):

| crew, balanced | n | steps median / p90 / max | live beyond the benefit radius | beyond own preference |
|---|---|---|---|---|
| police (Chebyshev 6) | 4 | 9 / 9 / 15 | 3 (75%) | 0 |
| fire (6) | 4 | 7 / 13 / 13 | 2 (50%) | 0 |
| library (5) | 4 | 9 / 11 / 13 | 4 (100%) | 0 |
| gallery (5) | 4 | 6 / 17 / 18 | 3 (75%) | 0 |
| university (a tile budget) | 11 | 8 / 21 / 21 | — | 0 |
| amphitheater (a tile budget) | 8 | 5 / 11 / 11 | — | 0 |
| zoo, centre (citywide) | 8, 4 | 3 / 4 / 8; 3 / 5 / 18 | — | 0 |
| C (the shop's local 5) | 417 | 15 / 26 / 36 | 316 (76%) | 40 (10%) |
| I | 887 | 7 / 24 / 37 | — | 93 (10%) |
| M, two halls | 103 | 13 / 33 / 38 | — | 5 (5%) |

The estate reads the same (library 75%, gallery 100%, C 82% beyond; I median 16
steps, the quarters) with one line worth the whole table: **its hall hands are
100% riders, 40 tiles from home, 27–30 steps of time** — rail already carries a
commute across the map inside the 40-step budget, since a ride step costs 2/9.
So under §3c the skill rule moves only the BENEFIT reach; a crew keeps hiring
from forty steps, and an actor may live nowhere near the stage.

*"commuting further than they should to commercial, industrial, and meat jobs
if the demand is high enough … balanced very carefully."* The probe's other
half asks what a longer budget would hire. On every rig at every sampled year
the jobless are 0–34 and every one of them has an open job within 40 steps (the
search hires 64 a month, so they are the queue), and every open lot has a
jobless door within 40 where a jobless animal exists at all. **A stretch would
hire nobody in the mayor's towns**; the towns are compact and rail does the
stretching. It becomes a lever on a player's own layout — a dormitory quarter
sixty steps from the mills — and the shape, if wanted, is the one the owner's
sentence has: `budget = 40 × (1 + STRETCH × unfilled share of the zone)`,
applied only when NO job sits inside the base budget (so a far job never
outscores a near one), priced by the +10 commute mood term that already exists
and by traffic. The gate before building it: the probe's jobless histogram on a
real save must show a count beyond 40. Until it does, the knob is a promise
with no consumer (q9).
