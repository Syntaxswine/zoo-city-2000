# PROPOSAL — Crime and punishment: the meat market, the taking, the pacification centre

The owner (2026-09-02), two asks in one afternoon:

> *"lets think about how we can add predation to the game as part of crime.
> perhaps with a custom zoned commercial space for grey market meat markets.
> herbavores do not like living near meat markets, it should have a similar
> negative devaluing as industrial, but perhaps even stronger."*

> *"for the crime and punishment section, lets add a pacification center. a
> place where troublesome predators can be fixed so they are no longer a
> threat to prey species. fixed animals cannot have offspring and are no
> longer interested in attacking prey. prey can also be pacified if they are
> caught in a crime. and just to make things a little more realistic, lets
> add a 5% chance that the police arrest the wrong person."*

Both were put to a panel (three researchers, three designers from different
angles, three judges) against the code at `8cbf438`. What follows is the
synthesis: the trunk the judges chose, the grafts they agreed on, the vetoes
resolved, and every number with the rig it was measured on. Nothing here is
built. Part I is the market and the taking; Part II is the arrest, the
centre and the wrongful 5%.

Two things the research found in passing, both true of `8cbf438` and fixed
in `944e507` (the commit before this document): `tools/playtest.mjs --rates 8`
(one number) crashed `budget.post` with NaN (the flag only accepted `8,8,8`),
and three ticker regexes in three files printed FIRE/FLOOD/TORNADO/BOOM but
none knew HEIST, SKUNK INCIDENT, WOLF MOON, TRUFFLE or DAIRY — so the sweep
could not count heists (now one exported `TICKER_FLASH`). A third, found by
the second panel and fixed with this document: the heist's thief pool had
no age filter, so it could have named a cub. The heist, it turns out, has
never fired: 0 in 360 measured city-years, because the scripted mayor's
shop blocks have no residents next door and crime on a shop tops out at
39–46 against a gate of 70. That is the first thing the market changes.

---

## PART I — Predation as crime: zone M, dread, and the taking

### The recommendation in one paragraph

A fourth zone, **M** (key `M`, "Meat", §12 a tile), drag-zoned like C and
I, that grows on its own small valve keyed to the town's carnivores, is
staffed by them, pays the mayor an off-the-books cut, and casts a **dread**
field over its neighbourhood that takes exactly twice the land value a works
takes at every ring. Herbivores mind it (mood, home choice, and a slow
move-out); carnivores do not. A hall raises crime around it, and **crime is
the hazard rate**: once a month each hall rolls a taking at `0.04 ·
crime/100` scaled by the hunters on its staff — a named adult prey animal
who "did not come home", protected only by the two friendships the thesis
already sells (a friend of the hunter's kind, or a friend on the hall's
staff). A taking leaves a scene on the crime field for two years. Police
cover grades the risk (crime 65 → one taking per ~3 years; near cover → one
per ~40) and arms a raid; a licence puts the hall on the books. An existing
city with no market is untouched to the byte.

### Why a zone, and why its own valve

The owner said *zoned*. A zone gets drag, undo, density, the tier ladder,
decay, the WHY NOT line and the art audit for free; a placed civic gets
none of them. The judges split only on the valve: two designs rode the C
valve to save plumbing, and the balance judge measured why that fails —
**V_C is negative for 26 of the 30 years** of the baseline town (the worker
term `0.5·(W/J − 1)` sits at −0.145 at W 1052 / J 1480), so a hall zoned at
year 8 would read NO_DEMAND for most of a game; and M jobs counted in Jc
push rC from −0.15 to −0.27 with 48 jobs, starving real shops. So:

```
rM  = clamp((MEAT_PER_CARN 0.06 · carnivores + MEAT_SEED 10 − Jm) / max(Jm, 20), −1, 1)
      T.M = T.C (no fourth rate); boost.M from events; valves.M saved; fromPlain { M: 0, ...o.valves }
      seed 7 y30 (525 carnivores): Jm 0 → 1.00 · Jm 20 → 1.00 · Jm 40 → 0.04 · Jm 60 → −0.31
      → "a 1,600 town wants two meat halls or five stalls" — the legible cap
Jm  ∈ J and Lab, ∉ Jc (census three-way split Jc / Ji / Jm; check: Jc + Ji + Jm === J)
```

### The mechanics, stated

```
ZONE.M = 4 · ZONE_NAME[4] = "M" · M_JOBS [0, 3, 8, 16] (stall / meat hall / cold store) · COST.zoneM 12
maxTierByLV(M) = 3 like I (its own shadow floors its tile at LV 0; an LV ladder would cap it at a stall)
local_M = 0.6 · clamp(carnivores housed within 5 / 40 − 0.5, ±0.3) + 0.4 · (50 − LV)/200   (customers; cheap ground; NO crime penalty)

DIET (SPECIES.diet, asserted by the suite): herb = rabbit, mouse, beaver, tortoise, pig, cow
      omni = bear, raccoon, skunk · carn = fox, owl, wolf, cat, hawk  (fox and owl hunt without the predator flag)
JOB_M = { carn: 0.9, omni: 0.5, herb: 0.1 }  in searchJob, branching on world.zone[lot] === ZONE.M BEFORE the jobZone test
      (rabbits and mice take a hall job only when nothing else is open; pigs and beavers, jobC 0.2, will walk to one past ten road tiles)

DREAD (world.dread, Uint8, DERIVED — rebuilt by computeFields, never in toPlain):
      spread() from every built M lot, DREAD [0, 40, 70, 105] over radius [0, 2, 3, 4], linear falloff
      LV −= LV_DREAD 0.8 · dread       → tier 3: −84 / −67 / −50 / −34 / −17 at d 0..4  (a works: −42 / −34 / −25 / −17 / −8)
      NOT pollution: pol pulls raccoons and pigs (homePref dirt, arrival weights) and refuses R growth above 60 — the owner's rule is herbivore-specific
      herb  mood −0.25·dread (cap 25; halved with any carnivore friend) · homeScore −1.0·dread · arrival ×(1 − 0.3·min(1, markets/3))
      REHOME p = 0.03/month per herbivore household at dread[home] ≥ 40 → bestHome(lotsWithinRoad(home, 12))   (draws no rng where dread < 40)
      carn  mood +5 when dread[home] > 0 · homeScore +0.8·dread (net 0 against the LV term: they do not mind the hall) · arrival +0.3·min(1, Jm/40)
      omni  nothing
      NO hunger term: a market-less town's carnivores are exactly as happy as today

CRIME: computeCrime adds spread(CRIME_M [0, 10, 18, 25] over [0, 1, 2, 3]) from built M lots, ×0.5 licensed,
      plus every standing SCENE {tile, radius 2, crime +15, until tick+24, line} (events.scenes — saved by the events clone, no save.js edit)
      one hall: its own tile ~65, the shop next door 55–59 (under the 60 penalty); TWO adjacent halls: a shop between them ~77 → the heist arms
      (the LV channel is already spent on shops — LV 0–52, crime 14–40 — so a hall's crater adds little there; the term does the work)

THE TAKING (predationTick, once per built M lot per month, in eventsTick before the roster roll — never a roster entry):
      p = PREDATION_P 0.04 · crime[lot]/100 · hunterStaff / M_JOBS[3]   (×0.5 licensed)
      crime 65, full hunter staff: 2.6%/month = one per 3.2 years per hall · half cover (35): one per 6 · near cover (5): one per 42
      three uncovered halls ≈ 1/year city-wide against 33–40 deaths/year — texture, never a demographic force
      VICTIM-FIRST: candidates = ADULTS housed within Chebyshev 4 whose species is hunted by someone on the staff,
                    with NO friend of that hunter species (the bridge) and NO friend on the hall's staff ("knows the butcher")
                    victim = rng.pick; hunter = rng.pick among staff whose species hunts the victim; no candidate → no draw, no line
      then, in order: mourners = victim.friends.slice(); holdFuneral(mourners) (≥ 3 → they befriend at the wake; grief tick+12 for mourners AND household)
                    removeCitizen(world, victim, "taken") · events.active.push({ id: "takenMood", until: tick+6, moodBySpecies: { [victim.species]: −15 } })
                    events.scenes.push(…) · post(world, "inquest", −200) · events.takings++ · events.lastTaking = { tick, tile, victimId, hunterId, species }
      cubs are never candidates; the narrator is deadpan and names both animals

MONEY: unlicensed halls pay a CUT — ledger key "cut", CUT_PER_JOB 25 per filled job per year, flat, immune to the C rate
      (a full hall §400/yr ≈ 1.5% of a §27k income; three halls 4.4% — SC4's rule: a nudge, never the budget)
      LICENCE — offered DETERMINISTICALLY the month the first hall reaches tier 2 (a weight-2 roster card would arrive once per 15–40 years):
      §2,000 once + UPKEEP_LICENCE 400/yr per hall; M jobs go on the books at rates.C × 1.5/job; CRIME_M ×0.5; PREDATION_P ×0.5; dread unchanged
      at 8%: 16 jobs × 1.5 × 8 = §192 − §400 = −§208/yr per hall — the licence is bought for safety, not money
      the hidden cost of the crater: R tax is 0.5 + LV_home/100 per citizen, so ~16 R lots at −50 LV ≈ −§1,000/yr per central hall
```

### The events (all named, all deadpan)

| id | kind | gate | effect | the line |
|---|---|---|---|---|
| predation | per-hall monthly rule, not a roster entry | above | above | *PREDATION — Clover Burrowes (rabbit) did not come home to (9,38). Rennet Slyfield (fox) works the meat hall at (12,40); it had rabbit on Tuesday. Four friends held a wake.* (last sentence only when mourners ≥ 3) |
| licence | CHOICE card, offered once when the first hall reaches tier 2; re-offered after 120 ticks (events.lastLicenceOffer saved) | markets ≥ 1, no licence | accept → post −2,000, events.licence = true | *The Butchers' Guild has a licence on your desk: an inspector in every meat hall, §2,000 and §400 a year each; the till pays tax, and a hall under police cover takes nobody.* |
| raid | BOON-kind (it is the police working; the No-disasters toggle must not mask it), w3, cooldown 24 | a built hall with policeCov > 0, crime > 50, staff > 0, unlicensed | lowerTier (last-hired released and named), post "fines" +200·tier, the hall's scenes cleared | *RAID — the constables went through the cold store at (12,40): a storey shut, §600 in fines. Vixen Talonby (hawk) was seen leaving by the back.* |
| greensLeague | BOON-kind, w2, duration 6 | herbivores ≥ 40% of P and a standing scene | valveBoost C −0.3 for 6 months; herbivore mood +5; friendships ×1.5 | *THE GREENS' LEAGUE — the Trotters and the Cudworths marched on the meat hall at (12,40) with placards. Shops lose custom for six months; the marchers are in fine spirits.* |

The heist wakes up on its own: two adjacent tier-3 halls put the shop
between them over 70. Expect the first HEIST lines in thirty years.

### UX

- Tool `M` — *"zone meat market (drag) §12 — grey, off the books; carnivores staff it, herbivores smell it four tiles off"*; chalk in a new accent, dried liver `#8A4E48`, the C/I chalk geometry; density brush applies.
- Hover card: `M High · tier 2 meat hall · jobs 6/8 · 4 hunters` then `dread 70 · 14 R lots in the shadow · crime 64 · cut §200/yr · one taking per ~4 yrs` (or `licensed`); on any tile with dread: `dread N (herbivores −N mood, −N home)`; on a scene: `a taking here, Mar 2014: Clover Burrowes (rabbit) — crime +15 for 17 more months`. WHY NOT stays `lotScore()`'s reason code.
- Overlays: the `O` cycle gains **dread** (wine); the crime overlay draws each scene as a 2-px outlined diamond ring (shape, not brightness); the LV overlay already shows the crater.
- Rules tab M1–M5 with `live()`: the valve and jobs; dread and who minds it; grey means off the books; part of crime; the taking. Each sentence above is one of them.
- Advisor (every line gated on markets ≥ 1, because advisor lines land in the hashed log): *"N herbivores live within the smell of a meat hall; parks, friends across the line and a licence soften it."* · *"a meat hall with no police cover is where the takings happen."* · *"the meat hall at (x,y) is run by herbivores. Nobody asks where the stock comes from."*
- Census rows: meat halls (jobs, hunters) · within the smell (herbivores) · takings (all time, last) · Budget rows `M cut §25 × fm jobs` or `M: 8% × 1.5 × fm (licensed)` and `licences −§400 × halls`.
- One exported `TICKER_FLASH` regex consumed by `ui.js` (colour and flash) and `playtest.mjs` (print) — which also cures the standing HEIST omission.

### Art

Three box plans in `FAMILY[4]`, six sprites through `solidSprite` (variant
1 = `flipPlan`), the footprint gate free. Every "meat" cue is a brown,
never the zot red. **Stall** (H 7): brick body, a 2-px awning alternating
brick `!` and concrete `(` (the desaturated red-white stripe), three 1-px
`+` hooks under the lintel, a sawdust `u` step. **Meat hall** (H 14):
brick to storey 8 then slate, a clerestory of small windows, a windowless
slate annex (the cold store) with a 2-px vent, a slate sign slab on a rust
bracket with one `$` dot — no lettering. **Cold store** (H 20): concrete
block, a roof condenser, and a rust ring-grain chimney — the pun that says
industrial-strength. What breaks the field guide: carcasses, drips, text,
saturated red.

### The numbers (seed 7 / 3 / 5, rates 8,8,8, 30 years, disasters off unless said; scratch probes against the sim modules, nothing in the repo touched)

| what | value |
|---|---|
| P y10 / y20 / y30 | 1500 / 1499 / 1643 · 1523 / 1526 / 1660 · 1328 / 1512 / 1635 |
| diet at y30, herb / carn / omni | 746 / 525 / 378 · 713 / 513 / 433 · 747 / 510 / 383 (herbivores 45% of every town; hunters 31–37%) |
| prey living within 1 of one of their own predators | 85% · 78% · 89% (fully bridged by friendship: 8 · 2 · 7); mean flight already −10.7 to −11.3 |
| births / deaths / arrivals / leavers per year, y21–30 | 11.2 / 36.3 / 71.4 / 31.5 · 12.3 / 37.8 / 64.2 / 25.0 · 15.7 / 39.9 / 64.3 / 27.2 |
| crime on built lots mean / max | 39 / 77 · 38 / 72 · 42 / 80; heists 0 in all six rigs (max crime ever on a shop 39–46; the gate is 70) |
| a lone tier-3 works, ΔLV at d 0..6 (measured, centroid pinned) | −34 / −33.5 / −25 / −17 / −8 / 0 / 0 (analytic 42 / 33.6 / 25.2 / 16.8 / 8.4; d0 clipped by the LV floor) |
| a tier-3 hall, ΔLV at d 0..5 (DREAD 105, r 4, 0.8) | −84 / −67 / −50 / −34 / −17 / 0 — 2.0× the works at every ring |
| worst hall site (the built C lot with most herbivores within 4): R lots pushed under LV 30 | 14 · 13 · 26 (a works there: 7 · 7 · 19); decay-eligible R lots: 0 · 7 · 0 |
| why nobody "leaves" on mood alone | LEAVE fires only at V_R ≤ 0 (0 / 360 ticks in three towns); FRICTION 0.4%/month on friendless households is the only steady exit — hence the REHOME rule |
| employed adult with 2 friends, mood | mean 78, median 83, p10 64; −20 of dread on the 79–185 exposed herbivores costs approval 2–5; −40 on all herbivores would cost ~18 |
| C jobs filled by diet at y30 | carnivores 73–75% of shop staff; carnivore hires into C 14.5–17.4/yr; unemployed carnivores within road 24 of the centroid: 0 · 0 · 1 |
| so a 16-job hall fills | from flow, in 1–2 years, never by poaching (jobSearch runs only for c.job < 0) |
| tick at y30 | 5.3 / 6.9 / 5.7 ms; computePollution 0.22 ms; one more radial field ≈ +0.2–0.3 ms (4%) |
| the no-market gate, verified on HEAD by two judges | `playtest --seed 7 --years 30 --rates 8,8,8 --csv` → P 1643, W 1052, J 1480, cash 84,706, ledger `build −6619 · tax 640511 · upkeep −571186 · grant 2000` — byte-equal after the build (the HASH will move: new events defaults are cloned into the save) |

### Balance risks, each with its measurement

- **Existing cities without a hall are untouched.** Every new term is +0 or ×1 at markets = 0; no rng draw without an M lot; every roster gate and advisor line needs markets ≥ 1. Gate: the CSV byte-equality above, seeds 7/3/5.
- **Carnivore pull raises predator share where halls stand** while 85–89% of prey already live next to a predator → more flight. Measure H, predPrey and mean flight with `--markets 3` vs 0 at y10/20/30, **signed** (the cap law is Cap·(1 + 0.5·H); −0.03 H ≈ −2% P).
- **Shops.** With M jobs out of Jc there is no crowd-out; shops beside a hall sit at 55–59 and cross 60 only after a taking. Measure C lot count and C fill at y30, `--markets 2` vs 0.
- **Approval.** −0.1 to −0.4 per hall (41–117 herbivores at −5 to −9); six central halls ≈ −2.5 against a grant gate of 50 at 63–65.
- **The crater demotes 13–26 R lots per central hall** to the tier-1 cap and costs ~§1,000/yr in R tax against a §400 cut — a hall is a net loss the player buys for carnivore mood, arrivals and the cap. Measure net/yr and min cash with `--markets 1..3`.
- **Job cannibalisation.** JOB_M 0.9 vs jobC 0.8 is a mild preference; measure C filled share; the knob is JOB_M.carn.
- **Receivership.** Cut +1.5% of income per hall, licence −§2,000 once, inquests −§200 each, fines +§200·tier — no path to −10k.

### Suite

- `check.mjs`: M lots zoned at **t = 0** in the scripted city (carved from the I block) and `check("M zoned", r.ok)` — the t = 24 placement one design proposed is seed-fragile (costOf silently skips built tiles).
- Forced `takeOne(world, hallLot)` on the scripted city → victim absent from `byId`, every friends list and its household; rosters recount equal; one scene pushed; then **save → load → 24 ticks hash-equals the straight run** (the only instrument that catches an unsaved hook — `moodPenalty` is read at citizens.js:747 and not saved).
- `dread` is 0 everywhere with no hall; > 0 within the radius of a built one; after unzoning, LV ≥ the original on every tile.
- Species parity: every row has `diet ∈ {herb, omni, carn}`; art audit floor 60 → 68 sprites; a Node check that `art.chalk(4)` and `art.building(4, t, v)` do not throw (the renderer, not the sim, gates a fourth zone — check.mjs stays green while the browser dies on frame one).
- Ledger: `cut`, `licence`, `fines`, `inquest` post through `budget.post` only; `Jc + Ji + Jm === J`.
- `playtest --markets N`: N M tiles on the road edge of the first C block at year 2; columns: halls, hunterStaff, takings, scenes, herbivores within 4, R lots under LV 30, H, heists, cut, C lots and fill.

### Cost and build order

≈ 420 lines: sim 250 (events 90, rules 50, fields 30, citizens 30, world 12, demand 12, budget 10, census 8, lots 6, tick 5, ops 1, save 1), art 70, input/ui/render 45, tools 55; docs besides. One long session or two short ones.

1. Species `diet` + KNOBS + `ZONE.M`/`ZONE_NAME` + the three plans, chalk, accent, tool key, `ZONE_OF` → `node tools/serve.mjs`, zone one M tile, `zoo.advance(36)`, console empty; suite green. **The first hour ends here** with the dread profile 84/67/50/34/17 printed from a scratch probe against the works' 42/34/25/17/8.
2. `computeDread` + LV + the crime hill; the M valve and the three-way job split; lots valve/local/tier; citizens home/mood/arrival/job/rehome terms; budget cut; census rows; hover, rules, budget, census UI; the dread overlay.
3. `predationTick` + `holdFuneral` extracted + `takeOne` exported + licence + raid + league + `EVENT_TITLES` + `TICKER_FLASH`.
4. The suite lines above, `playtest --markets`, the CSV gate, the signed-H sweep on seeds 7/3/5.
5. Shots sheets, SPEC §M, BACKLOG, handoff.

### Left for v2, on purpose

A hunger term for market-less towns (it re-moods every existing city; ship it later as its own attributable two-commit bump with a measured approval curve); supply from funerals as the hall's local term (Beastars: the market buys the dead, ~33/yr — the honest grey economy); customer walkers to the hall; halls skinned by their staff; the 3×3 landmark for M (the abattoir) — `docs/PROPOSAL-LANDMARKS.md` should list M as "no landmark" until then.

### The alternatives, for the record

- **A C-lot variant** that a shop *becomes* when its staff turns majority-carnivore (the landmarks logic) — no new zone, but it takes the decision away from the player; the owner said zoned.
- **A placed 2×2 civic** (the zoo's fourteen files) — quicker, but it gets no growth, no density, no WHY NOT, and every hall would be the same size.
- **Diffuse predation without a market** (a hungry predator takes a neighbour at high crime) — rejected: prey flight already taxes 85–89% of prey and is the honest model of an unfed street; the hall is where the player can *see* and *site* the risk.

---

## PART II — Punishment: the file, the arrest, the wrongful 5%, the pacification centre

### The recommendation in one paragraph

Every incident opens a **file** at its tile for six months, and the police
cover there is the monthly chance of an arrest — a probability, never a
switch, read live each month so a station built beside the scene inside
the window still counts. An arrested animal loses its job and goes away for
a saved clock: **three months in the cells and home unchanged** if the town
has no centre (the revolving door: RELEASED, with a record, the same name
back behind the same counter), **six months in the Pacification Centre and
home FIXED** if it has one. Fixed is one saved boolean read by five
existing rules: no litter (a pair with a fixed member is no pair), never a
hunter (out of the hall's taking roll — a fixed wolf may still cut meat),
no fear next door (prey flight ignores fixed predators, proportionally),
prey friendships at 0.7 instead of 0.4 **counted once in H** (the knife
buys quiet, not the index), mood −5 for life, permanent. **One arrest in
twenty takes the wrong animal**; the narrator says so in five words, the
census says so in a row, the real one stays next door, and when the real
one is finally taken the city pays the wronged family §500 and there is no
way to unfix them.

Three panels' worth of measurement agree on the uncomfortable part: with
the taking rate settled in Part I, **arrests from crimes alone are rare**
(under police cover, one every ~17 years per town), so a centre fed only by
takings and heists is idle in three games of four. The trunk design's
answer, and the judges' — with one question for the owner — is the
**complaint**: a prey household living next to a predator it does not know
(no bridging friendship, the exact `prey flight` condition already in the
code) can file, and only where a police station exists. That reads the
owner's *"troublesome predators … no longer a threat to prey species"*
literally: the wolf next door to the Burroweses *is* the trouble. It is
pre-crime satire and it is one knob (`COMPLAINT_P`); with it a one-station
town sees the revolving door before the centre exists and sees it end the
year the centre opens.

### The mechanics, stated

```
THE FILE — one saved list, events.files [{tile, radius, crime, until, line, culpritId, cause, closed}]
      (Part I's SCENES with three fields added; a taking's or heist's scene IS its file; a complaint is a file with crime 0)
      opened by: a TAKING (culprit = the hunter; tile = the victim's home) · a HEIST (culprit from the widened pool) ·
                 a BURGLARY (below) · a RAID (its named last-hired worker) · a COMPLAINT (below)
      justiceTick — its own step in tick.js between eventsTick and compact — rolls each open file monthly, never the tick it opened:
      pMonth = ARREST_BASE 0.02 + ARREST_COVER 0.18 · policeCov[tile]/60 + ARREST_PRIOR 0.05 · culprit.record
      over six months: cover 0 → 11% · cover 30 → 50% · cover 60 → 74%; one prior at cover 0 → 36%
      culprit dead, gone, held or already fixed → the file closes silently, no draw; a named crime that lapses prints COLD
COMPLAINT (only if census.policeStations > 0; guarded so it draws nothing when COMPLAINT_P is 0 or nobody is afraid):
      afraid = prey households with an unbridged, unfixed, unheld predator species in the 3×3 and no open file at their tile
      k = floor(COMPLAINT_P 0.002 · |afraid| + rng.next()) files per month; each names one adult of that species from the 3×3
      afraid households are computed by ONE function (flight.js afraidHouseholds) that moods(), justice and the census all call — never a cache
BURGLARY (only if census.policeStations > 0): once a month over ALL built lots with crime > 60: p = min(0.5, 0.02 · hot);
      lot = rng.pick(hot); culprit = one weighted draw over ADULTS within 4 (weights ×3 unemployed, ×2 crime at home > 60,
      ×2 fox/raccoon/cat, ×2 per record, ×0 held or fixed); post("theft", −20·tier); a file at the lot
      (the trunk's own rule — C/I lots above 70 — was measured dead: 0 such lots in 30 years on two seeds; R lots reach 71–77)
THE HEIST's robbers() becomes the same weighted, ADULT-ONLY pool (today it has no age filter — 61 of 289 fox/raccoon/cat are cubs)

THE WRONG ANIMAL: on a successful roll, rng.chance(WRONGFUL_P 0.05) → pool = adults within 4 of the file's tile, not the culprit,
      not held, not fixed; WEIGHT WRONGFUL_PROFILE 8 for the culprit's species, 1 otherwise ("it was a fox" is the whole
      witness statement — about half the wrongful arrests hit the culprit's kind); empty pool → the culprit, nothing recorded
      record: events.arrests [{tick, tile, citizenId, culpritId, wrongful, cause}] (sliced 200) AND c.wrongful, c.wrongedBy (saved —
      exoneration scans citizens, never the capped log); the culprit stays at large: keeps the counter, the hunter pool, the door
      EXONERATION: a true arrest of X → every citizen with wrongedBy === X.id → exonerated, post("compensation", −500) each,
      a city-wide moodBoost −5 for 6 months, the line; fixed stays fixed

CUSTODY: releaseJob(world, c) — ONE exported function (job −1, path null, hired −1, staff−−; fireFromLot and retirement use it too);
      home KEPT (occupants unchanged — the household invariant and the rehome paths hold); c.held = untilTick, c.heldAt = centre tile or −1
      absent(world, c) = c.held > world.tick — ONE exported predicate beside isWorker, read by isWorker, computeCrime's inline copy,
      moods() lotSpecies, friendships byHome, births, walkers, every pool (two copies of the worker predicate exist today; both learn it)
      no centre with road access and a free bed → CELLS_MONTHS 3, then record++ (×2 in culprit pools) — RELEASED
      a centre → PACIFY_MONTHS 6, then fixed = true — HOME; the household gets RETURN_MOOD −10 for 12 months
      through c.moodPenalty, which is READ today (citizens.js:747), written nowhere, and not saved — this closes that trap by saving it
      bulldozing a centre releases its inmates as from the cells; costOf counts them as evicts, so the op is not undoable (tiles, never people)

FIXED (c.fixed, saved, permanent):
      births: a fixed or absent member neither counts as fertile nor adds litter → a two-adult pair with one fixed adult never breeds;
              a pack of three fertile adults with one fixed breeds on — each skipped household counts in last.littersLost
      the hall's hunter pool and hunterStaff exclude fixed and held (p ∝ unfixed hunters / 16) — a fixed wolf may keep the job
      prey flight, PROPORTIONAL: flight for species p = PREY_FLIGHT × (unfixed adults of p in the 3×3 / all adults of p in the 3×3)
              (measured: every afraid household has on average 5.2 adults of the feared species in its 3×3 over 3 lots —
               a per-species Set would let one fixed wolf out of a pack change nothing; the ratio moves a number the card can print)
      friendships: pairAffinity → FIXED_AFFINITY 0.7 for a predator–prey pair whose predator is fixed; counted ONCE in H
              (census splits predPrey / predPreyFixed; the row reads "by friendship 0.73 · by pacification 0.05")
      fixed prey: weight 0 in every culprit pool; no offspring; flight unchanged (fear is not a crime)
      mood: FIXED_MOOD −5 permanent; nothing ever clears fixed

THE CENTRE (CIVIC.CENTRE = 6, 1×1, the fourteen-file recipe): COST 1,500 · UPKEEP 900/yr · 4 C-type jobs via isCivicEmployer(c)
      (NOT isStation — computeCoverage would hand it a police ring and removeCivic's FIRE||POLICE branch would miss it)
      intake needs road access; CENTRE_BEDS 6 per centre, COUNTED from heldAt, never stored; the seventh goes to the cells
      the van: LV −6 within 2; hunting species mood −5 within 4; prey feel nothing near it — they feel it when the wolf comes home
```

### The lines (pronoun-free — the sim has no sex field, and no existing ticker line uses one; the suite greps for he/she/his/her)

| id | when | the line |
|---|---|---|
| TAKEN IN | arrest, a centre with a bed | *TAKEN IN — Fenrir Greyback (wolf) went from (10,38) to the Pacification Centre at (20,20) on a complaint from the Burroweses at (9,38). Six months.* |
| TAKEN IN (wrongful) | the 5% | *TAKEN IN — Ranulf Greyback (wolf) went from (11,38) to the Pacification Centre at (20,20) for the taking at (9,38). Six months. Ranulf was at home on Tuesday; it was the wrong animal. Fenrir Greyback is still behind the counter at (12,40).* |
| CELLS | arrest, no centre | *CELLS — Fenrir Greyback (wolf) is in the cells until March: the Burroweses' complaint. No centre in town; Fenrir comes home as Fenrir went.* |
| RELEASED | the cells expire | *RELEASED — Fenrir Greyback (wolf) is home at (10,38) with a record. The Burroweses have the form for another complaint.* |
| HOME | the centre expires | *HOME — Fenrir Greyback (wolf) is back at (10,38) from the centre, fixed. There will be no more Greyback litters from that house.* (never "the street slept" — the sim cannot honour it) |
| EXONERATED | the real one is taken | *EXONERATED — Ranulf Greyback (wolf) was the wrong wolf; Fenrir Greyback was taken in today for the same street. The city pays the Greybacks §500. There is no way to unfix Ranulf.* |
| COLD | a named crime lapses | *COLD — the file on the taking at (9,38) closed without an arrest. Rennet Slyfield (fox) is still behind the counter at (12,40).* |
| BURGLARY | the monthly rule | *BURGLARY — Porky Trotter (pig) walked out of the shop at (14,30) with §80 of stock. A file is open for six months.* |

Ticker prefixes go into the one `TICKER_*` export in `events.js` (landed in
`944e507`) and nowhere else; the suite greps that no other file defines a
ticker regex.

### UX

- Tool `V` — *"Pacify: 1×1, §1,500, §900/yr, 4 jobs, 6 beds — click; an arrested animal comes home fixed in six months"*. Sprite: a LOW white block (H 9 against the police station's 14), a `+` double door under a 2-unit earth-brown cross, one barred end window, a flat cap and a lamp — and the signature at 1×, **a van at the door** (a furCool box with a glass strip and `+` wheels).
- Hover: `Pacification centre · beds 2/6 · jobs 3/4` then `held: Fenrir Greyback (wolf), home in 4 months`, and the bargain line: *"Six beds, six months. They come home calm and childless; one in twenty was the wrong animal."* A prey home's card gains `afraid of: wolf next door (no bridge) · file open until Sep 2011`; a citizen card gains `held at the centre until Mar 2012` / `fixed (wrongful; exonerated 2014)` / `record 2`; the hall's workers line reads `Fenrir Greyback (wolf, fixed)`.
- Rules tab P1 Arrest (the p formula, 11/50/74%, complaints, the 5%) · P2 Custody (the cells vs the centre) · P3 Fixed (the five effects; "counts once in H"); `live()`: open files, arrests this year, held/beds, pacified N (M wrongful · K exonerated).
- Advisor (gated on a station, then on a centre): *"182 prey households live next door to a predator they do not know. A pacification centre (§1,500) turns arrests into quiet — and stops litters."* · *"the centre is full — the seventh goes to the cells."* · *"one of this year's pacifications was the wrong animal. The file says so; the animal is fixed all the same."*
- Census rows: `pacified N (M wrongful · K exonerated)` · `centre beds held/beds` · `afraid households` · `open files` · `litters lost` · `Zoo City index by friendship X · by pacification Y`; the species histogram `wolf 129 · 11 fixed (1 wrongful)`; the REPORT line appends `· pacified 11 (1 wrongful)`; characterLine gains *", mostly fixed"* when the top species hunts and half its adults are fixed.

### The numbers (seed 7 unless said; re-measured by two judges on `944e507`)

| what | value |
|---|---|
| afraid prey households (unbridged predator next door) at y30 | 182 of 217 with a station · 215 of 263 without (84%); seeds spread 182–254 |
| hunter adults / hunters | 422 / 525; predator–prey friendships 14–17 of ~550 (H 0.75–0.77) |
| arrests per year from complaints, COMPLAINT_P 0.002 | one station (95% of afraid homes at cover 0): **0.45–0.57**; the station on the warren (seed 5): 1.7–2.4; police everywhere (~8 stations, §3,200/yr): 3.2–3.8 |
| arrests per year from crimes alone | takings under cover: 0.06 (three halls); heists: 0 (never armed hall-less); burglary with a station: 1–12 hot lots → 0.1–0.8 files/yr |
| wrongful arrests seen | 0.17/yr under full cover (3–4 in 20 years); about one in 30 years with one station; the same-kind pool within 4 is empty in 0–0.3% of cases (mean 12–16 others) — the 5% is the full 5% |
| fixed share of hunter adults by y30 | ≈ 3% with one station · 12–16% with police everywhere — a function of covered afraid households, printed per `--stations N` |
| births lost | hunter pairs *with headroom* are 32 of 411 adults (7.8%; the unfiltered 73/411 overstates it 2×); 40 fixed → −1.3 births/yr (−9% of 11–16) — `littersLost` is the readout |
| P | **cap-pinned: does not move** (V_R is clamped to 1 − P/cap, arrivals 56–71/yr refill any litter lost) — pacification shows in births, littersLost, afraid and pacified, never in P |
| flight relief, the static upper bound | a per-species Set: 69 arrests take afraid 177 → 157, 12 arrests 177 → 176 (hence the proportional rule) |
| H | ±0.01 either way; the split row is the instrument |
| approval | +0.3 typical; −4 in the half-year an exoneration prints |
| the heist could name a cub today | 61 of 289 fox/raccoon/cat at y30 are cubs; `robbers()` has no age filter (fixed with this document) |

### Suite

- **The contract commit** (step 1 below): fields, `plainCitizen`, `absent()`, the births/flight/affinity skips, `moodPenalty` saved — with `playtest --seed 7 --years 30` at `a9b2665b` **and** `--stations` at `0d094c12` unchanged. Complaints and burglary are station-gated and guarded, so the station-less city is byte-identical for ever; the `--stations` town re-baselines once they draw (its own attributable commit, numbers re-measured in the same pass).
- Forced arrest on the scripted city: a centre, a complaint file with `opened: tick − 1`, `KNOBS.ARREST_BASE = 1`, `WRONGFUL_P = 1` (KNOBS is a plain object; restore in `finally`) → the arrestee is not the culprit, `held`, job −1, `!isWorker`, W excludes; six ticks → `fixed && wrongful`; then **save → load → 24 ticks hash-equals the straight run** with a held and a fixed citizen across the reload.
- Invariants: held ⇒ job −1 and not in W; `computeCrime`'s (W, U) equals the census (the two predicate copies agree); no fixed or held citizen in any hunter or thief pool; no cub born to a household with fewer than two unfixed fertile adults; `count(heldAt === i) ≤ CENTRE_BEDS`; bulldozing a centre with inmates reports `evicts > 0` and undo refuses; a plain without the new fields loads and ticks; `art.civic("centre")` audits; every named culprit is an adult; the log has no pronoun.
- `playtest --pacify` (a centre beside the start at year 3) with `--stations N`: columns arrests, wrongful, fixed, fixedShare, afraid, held, births, littersLost, H by friendship / by pacification; the no-market gate compares **named CSV columns** (P, W, J, cash), not bytes — the header grows.
- The five-seed signed sweep (1, 3, 5, 7, 9) for every claim above: assert the sign, never a one-seed magnitude.

### Cost and build order

≈ 600 lines: `justice.js` (new, ~200: files, investigation, complaints, burglary, custody, exoneration, the lines), `flight.js` (new, ~40: the one afraid-households implementation), citizens 25, census 30, fields 15, world 8, rules 35, events 25, ops 15, budget/save/tick 25, buildings 45, ui 40, input/render/walkers 6, check 90, playtest 25. One session.

1. **The contract** — fields + save + `absent()` + `releaseJob()` + the births/flight/affinity skips; behaviour unchanged; both hashes asserted in the commit message.
2. **The revolving door** — `justice.js`: files, the monthly roll, complaints, the cells, the widened adult-only thief pool, the lines, the forced-arrest check. A station-only town now prints CELLS and RELEASED. **The first hour ends here.**
3. **The centre** — the fourteen-file civic: `V`, the sprite and the van, beds, fixed on return, the van's shadow, P1–P3, the census rows.
4. **Burglary**, station-gated.
5. **The market's three hooks** when Part I lands: `culpritId` on the taking's scene; the hunter pool and `hunterStaff` filter fixed and held; the raid's named worker enters the file.
6. Suite, `--pacify`, the five-seed sweep, SPEC, BACKLOG, handoff.

Steps 1–4 do not need the market: nothing in them reads `ZONE.M` or
`world.dread`. If the owner wants the civic visible before the halls, build
Part II first; the centre then acts on complaints and burglaries until the
takings arrive.

### The questions only the owner can answer

1. **Complaints.** Is a predator *troublesome* because prey next door fear it (arrestable on a complaint, one station away), or only when caught — a taking, a theft? With the first, one station gives ~0.5 arrests a year and the centre is a decision at year 10; with the second (`COMPLAINT_P = 0`) the centre fills once a decade and the 5% is a line most games never print.
2. **The wrong animal.** Weighted toward the culprit's kind (×8; law-clean; now and then a rabbit is fixed for a wolf's crime, which is what "the wrong person" means), or the culprit's kind only (cleaner satire; prey are never pacified for a predator's taking; but a species deciding who can be arrested is a gate)?
3. **The counter.** May a fixed wolf keep the hall job (deadpan; the hall takes less per fixed hand) or does *no longer a threat* mean off the hunter staff altogether?

---

## What to build first

Part I first, then Part II: the halls are the crime source the owner asked
for first, and the centre's best incidents come from them. Each is about a
session. If the owner rules for complaints, Part II's steps 1–3 can go
ahead of the market and be played with stations alone.

The panels: 15 agents across two runs (three researchers, six designers,
six judges), every quoted number re-measured on HEAD by at least one judge,
the trunk designs' line references verified file by file, and 52 refuted
claims discarded — none of them survive into this document.
