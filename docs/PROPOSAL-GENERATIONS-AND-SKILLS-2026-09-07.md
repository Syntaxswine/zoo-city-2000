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
today.

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

1. **The merge rule's shape** (§2c) — the prerequisite. Same-lot pairing of two
   singles, or a partner who "sends for" one from outside, or both.
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
5. **Crew mean vs the keeper alone** for the tile rule.
6. **Health's channel** — lifespan is rolled at birth (`deathAge`), so a clinic
   needs its own consumer: fewer natural deaths in cover, an epidemic event the
   cover resists, or litters lost. A ruling, not a default.
7. **Deeds** — the list, and the months each is worth.
8. **Commercial's reach** now that shops count rail customers within a 24-step
   budget: does a veteran crew widen the local five-tile count, the budget, or
   both?

## 6. Instruments (run from the repo root; all passive, exit 0)

```text
node tools/tenureprobe.mjs --layout estate --years 30      # tenure, bands, keeper succession, who lives with a veteran
node tools/lineageprobe.mjs --layout estate --years 60     # the ratchet as a shadow ledger; natives-never-breed
node tools/reachprobe.mjs --layout estate --platform 2     # walking tiles vs Chebyshev; rail free vs priced
```

## 7. Build order (a sketch, none of it opened)

0. **The merge rule** (its own commit; moves every rig's hash: births change).
1. **The band as a READ** — card, census, ticker; `tick − hired`; hash-neutral.
2. **Parents at birth + the family line on the card** (two ids, saved when present).
3. **The keeper on the lot card + the succession line**; measure the cadence on
   the control city when it arrives.
4. **The tile rule on ONE service** (police), measured with `serviceprobe` and
   `reachprobe` before the others follow; the centre's shadow struck in the same
   commit.
5. **The ratchet** (inheritance at birth), then the school as fidelity.
6. Health, sanitation, cemetery — each its own proposal.
