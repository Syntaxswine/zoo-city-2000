# PROPOSAL — The camera network: clearance without deterrence

The owner (2026-09-04):

> *"i'd like to incorporate flock style security cameras as something that can
> be placed along roads and intersections in the game Zoo City 2000. this will
> make crime fighting more effective but citizens less happy."*

And, on being asked the three design questions:

> *"1. yes, stations are needed, 2. yes, they can lead to wrongful arrests,
> that is as intended, 3. yes, local field around the camera. ideally folks
> who have been robbed before do not feel that negative feeling."*

And the frame that decides everything else:

> *"this is an element of satire, there is nothing in the game saying that
> players need to add the meat markets, police, pacification, cameras. they
> are arguably an expensive overbearing element that does little to reduce
> crime."*

And, sharpening it:

> *"it should be one of the more effective crime solvers at a social cost, but
> it doesnt get at the root of crime, the economic factors that caused one
> person to break the laws will still be present when he is gone."*

And on the bill:

> *"cameras should be cheaper than the police stations"* → *"how about upkeep
> $2000 a year for as many cameras as you like."*

Nothing here is built. Written against `920f3b8` on branch `cameras`, in a
worktree, because tranches R and F are in flight in the live tree (§10).

---

## The recommendation in one paragraph

A camera is a §100 fixture that stands **on** a road tile — a bit in a new
`cam` array, drawn as a standing sprite over an unchanged road the way a
tunnel is (**not** the way a level crossing is; §7 says why) — and it
does exactly one thing to crime: **it lights the scene**. It adds nothing to
the crime field: `computeCrime` never reads it, and the mean crime on built
lots moves **−3.0%** across a full blanket (39.57 → 38.38, measured). What it
does **not** do is make the town safe. (The draft said "not one burglary is
prevented"; that is measurably false and §9 now checks the quantity a player
actually counts — BURGLARY headlines fall about **18%** under a blanket,
because arrested thieves leave the pool and closed files stop staining the
street. The claim is "the root is untouched", not "nothing changes".) What it buys is a term the game
already has and cannot currently reach: `ARREST_COVER · policeCov/60`, which
today is multiplied by nothing at **96.3%** of crime scenes (§2). A camera
puts cover on the one tile the file was opened at, so a file that would have
gone cold closes instead. It needs a police station — with no force in town
nothing is investigated at all and a camera watches an empty street. It costs
**§2,000 a year for the whole network, however many cameras**, which means the
first camera is a terrible deal and the fiftieth is nearly free: the pricing
manufactures the blanket. And the blanket is what the animals feel — a local
`watched` field costs mood on every tile a camera sees, **waived for any
animal that has already been burgled**, so the apparatus's political base is
the animals the city already failed. Because a camera clears a file on a
picture rather than a witness, cameras raise the wrongful rate: more arrests,
and a larger share of them the wrong animal, each exonerated later at
§`COMPENSATION` with a town-wide mood hit. And the thief is replaced, because
`crime` is driven by land value, density and joblessness, and taking an animal
off the street changes none of the three.

---

## 1. Why a camera is not a police station

This is the design's central claim, and every mechanic below follows from it.

| | police station | camera |
|---|---|---|
| costs | §500, §400/yr each | §100, **§2,000/yr for the network at any size** |
| covers | Chebyshev 6 through reach — up to 169 tiles | the street it stands on, `CAM_REACH` road-steps along it |
| employs | 4 (C-type jobs) | nobody |
| enters `computeCrime` | **yes**, `− policeCov` | **never** |
| enters the arrest roll | yes, `ARREST_FORCE` + `ARREST_COVER` | yes, `CAM_ARREST` |
| prevents crime | yes — at 4 stations only 35 files ever open against 108.7 at none | **not by design**: crime −3.0% and burglary headlines −18% under a full blanket, both second-order effects of arresting thieves, not of any camera term in `computeCrime` |
| solves crime | at 4 stations, 59.8% | strongly, but only where you put it |
| wrongful arrests | `WRONGFUL_P` 5% | `WRONGFUL_P + CAM_WRONGFUL` |
| what the animals think | nothing | `WATCHED`, unless already burgled |

A station lowers the field over a neighbourhood, which is why a well-policed
town has fewer files to solve. A camera lowers nothing. It changes only how a
file **ends**. That is the whole feature, and it is why the satire holds: the
mayor who blankets the town in cameras will watch the clear-up rate climb and
the crime number sit exactly where it was.

## 2. The measured ground (re-run on `920f3b8`, not quoted from the handoff)

`tools/serviceprobe.mjs --only police --seeds 7,3,5 --years 30`, 8-year
warm-up, nine 8×8 blocks, disasters on. **Re-run on `b2d28fd`** — after
tranches R (`served()`) and F landed — because R rewrote every access rule and
the premise had to be re-verified rather than quoted:

| police | mean cover | **cover at the scene** | opened | arrest | cold | gone | solved |
|---|---|---|---|---|---|---|---|
| 0 | 0/60 | 0/60 — **100% dark** | 108.7 | 0 | 100.7 | 6.7 | 0% |
| 1 | 10.6/60 | 1.5/60 — **96.3% dark** | 109.7 | 23.3 | 77.7 | 7.7 | 21.3% |
| 2 | 17.4/60 | 3.6/60 — **89.5% dark** | 91.0 | 23.7 | 59.0 | 7.0 | 26.0% |
| 4 | 33.8/60 | 36.3/60 — 6.1% dark | 35.0 | 18.7 | 10.7 | 5.0 | 53.3% |

*(On `920f3b8` the same sweep gave 96.9% dark and 17.2% solved at one station.
**The disease survived R**: the scene is still dark, `ARREST_COVER` is still
multiplied by nothing, and the design's premise holds on current `main`.)*

Three things this says, and the design uses all three:

1. **`ARREST_COVER` is dead weight in the shipped game.** Session 8 diagnosed
   it (handoff §15, defect 3b, 97.4% dark) and did not fix it — it added the
   `ARREST_FORCE` term and routed around it. Re-measured on `b2d28fd`, after R
   rewrote every access rule: **96.3%**. The
   term is still there, still multiplied by nothing. A camera is the only
   instrument in the game that can put cover on a chosen tile without also
   suppressing the crime that happens there.
2. **The mid-game town is the one in pain.** At one station, 74.7 of 99 files
   go cold, and a cold burglary prints nothing at all (`justice.js` writes
   `COLD` only for a killing). The mayor sees crimes reported and never hears
   another word.
3. **`gone` is the floor.** ~5 files per run end because the culprit died or
   left town. No camera can clear those, and the checks must not expect it to.

## 2b. What a Flock camera actually is (researched, sourced, dated)

The owner said *"flock style"*, so the design was checked against the real
device rather than the popular idea of it. Everything below is sourced; where
a figure could not be verified it is not used.

**Clearance, not deterrence — this is settled.** Four independent studies find
no crime reduction where ALPR is installed: Lum et al. 2011 (Alexandria and
Fairfax County VA, randomised ALPR patrol at auto-theft hot spots), Taylor et
al. 2012 (Mesa AZ -- more recoveries and arrests, *no* decline in theft),
Kernahan & Valasik 2019, and others. **This is the design's licence to put no
camera term in `computeCrime` at all.**

**Even the clearance case is weaker than the brochure.** Flock's "10% of
reported crime in the U.S. solved with Flock" comes from a company-funded
survey of 123 agencies whose **own lead researcher has since disowned the data
quality**. The one peer-reviewed signal (NIJ / Koper et al.) found clearances
for auto theft and robbery improved where readers were concentrated, "however,
these changes were not statistically significant". And the largest deployment
audits badly: **Atlanta, 5,000+ cameras, clearance rates FELL** -- motor-vehicle
theft 9.9% (2021) to 3.9% (2024); homicide clearance 48% in 2025, its worst.
Flock's flagship success story (San Marino CA, burglaries down 80% over five
months) was a cherry-picked window; burglaries rose afterwards.

**The deliberate deviation, recorded.** The owner asked for *"one of the more
effective crime solvers"*. The evidence says the real effect is small and
unproven. **This game grants the camera its marketing claim on purpose**
(`CAM_ARREST` 0.30 -- a covered scene clears at 88.2%), because the satire is
sharper that way: the mayor gets everything the brochure promised, and the town
is still no safer, poorer by S2,000 a year, unhappier, and missing animals it
took by mistake. *"It does not even work"* is a weaker joke than *"it worked
perfectly and nothing changed."* If this is ever softened, soften it here and
say so.

**Chokepoints, not an even spread.** Real cameras sit at intersections and
neighbourhood entrances, aimed at outbound lanes, mounted 10-15 feet up a pole,
to catch everything that leaves. This is the direct source for S4b: the
sight-line runs **along the road**, so a four-way covers four arms and a
mid-block camera covers two, for the same money. The owner's *"along roads and
intersections"* and the real deployment pattern are the same sentence.

**A real density anchor.** Jersey Village TX, population under 8,000, runs
**58 cameras -- 7.25 per 1,000 residents**. Norfolk VA: 176. Nationwide the
network passed 120,000 cameras across 6,000 communities. A 1,500-animal Zoo
City town therefore scales to **~11 cameras as a NORMAL deployment**, and that
is the number the calibration sweep in S11 should treat as the middle of its
range, not the extreme.

**Rented, not bought: ~$2,500 per camera per year, forever,** plus install --
the annual fee bundles hardware, connectivity, storage and updates and the town
never owns the device. **The owner's flat S2,000-for-any-number is a knowing
simplification, not an accuracy claim.** It is kept because it is the better
mechanic: a flat fee makes the first camera a bad deal and the fiftieth nearly
free, which manufactures the blanket that real towns arrive at anyway.

**The camera reads everyone; almost nothing it reads is wanted.** Hit rates run
well under one-tenth of one percent of scans. Two Norfolk plaintiffs found the
city's 176 cameras had captured their own vehicles 475 and 325 times. **Mass
observation of the innocent is not a side effect of the device; it is 99.9%+ of
what it does** -- which is the justification for `WATCHED` costing mood on every
animal under cover, not only on the guilty.

**Roughly one alert in three is wrong.** LAPD's internal audit measured a
**32.3% false-positive rate** on stolen-vehicle alerts (161 false alerts in two
months); LAPD then declined to renew, its CIO citing civil-liberties concerns.
The Institute for Justice counts **at least 27 innocent motorists** pulled over,
detained at gunpoint or jailed from ALPR errors since 2018, and in nearly
two-thirds of those cases officers did not realise the error until after
drawing their weapons. An Arkansas 2026 case turned on a reader misreading a
single character.

> **This is the one place the proposal's first draft was too kind.**
> `CAM_WRONGFUL` 0.10 gives 15% wrong at full cover. The measured false-*alert*
> rate is 32.3%. A false alert is not a wrongful conviction -- most are resolved
> at the roadside -- so 15% is defensible as the share that reaches an arrest,
> but the knob has documented headroom to 0.20 (25%) and the owner has already
> ruled that wrongful arrests are intended. **Recommend shipping at 0.10 and
> re-tuning on the sweep.**

**Not illegal, and the game must not say it is.** Schmidt v. Norfolk: the court
denied the city's motion to dismiss in Feb 2025 citing *Carpenter*, then in Jan
2026 ruled **for** the city on the merits -- the network as operated is not an
unconstitutional search. On appeal. The ticker stays deadpan and reports; it
never editorialises and never implies a crime.

**One figure deliberately NOT used.** A widely repeated "Chicago: 4,500 crimes
solved in four years out of 1,000,000+ scans = 0.05%" appears only on an
advocacy site and could not be confirmed in primary reporting. It is not a
calibration anchor here.

## 3. The root of crime is untouched — and that is the point

The owner: *"the economic factors that caused one person to break the laws
will still be present when he is gone."* The code already says this; the
camera makes it visible.

```
crime = CRIME_BASE 40 − CRIME_LV 0.5·lv + CRIME_DENSITY 0.4·density₃
      + CRIME_UNEMP_LOCAL 3·(jobless adults in the 3×3, ×2 if carnivore)
      + CRIME_UNEMP 40·(U/W) + near[] − policeCov          (0..100)
```

An arrest changes **none** of those terms. It does not create a job, raise a
land value, or thin a tenement. And the thief pool reads the same economics
the field does — `THIEF_UNEMP: 3`, a jobless adult is three times as likely to
be the one who breaks in.

Worse, the apparatus manufactures its own clientele. The game already has a
recidivism spiral and nobody has yet made a player watch it run:

- `RECORD_WEIGHT: 2` — every conviction **doubles** an animal's weight in the
  thief pool, compounding to ×8 at three convictions;
- `ARREST_PRIOR: 0.05` — and a record makes that animal **easier to catch**
  next time;
- the sentence table sends the convicted to the centre (fixed), the meat hall
  (sold) or the cells — and none of the three creates a job.

So the camera pours throughput into a loop that takes the jobless, marks them,
and makes the mark both a cause of the next offence and a reason to suspect
the same animal for it. **That is the satire, and §9 makes it falsifiable:**
cameras must move arrests and cold files hard, and must not move mean crime.

## 4. The mechanics, stated

### 4a. Placement and storage

- **`world.cam`**, `Uint8Array(n)`, **saved** (player intent, not derived);
  added to `TILE_ARRAYS` in `save.js`. `0` none, `1` a camera.
- A camera may be placed **only on a road tile** (`road[i] !== ROAD.NONE`),
  never on a bridge, never on a level crossing's rail half, never on water.
  It does not replace the road and does not block it.
- **The bulldozer takes the camera first.** The bulldozer is a strict top-down
  layer ladder in one switch case, first match wins, one press takes exactly
  one layer at §2 — measured: on a real level crossing it takes the rail and
  leaves the road; on a road tunnel it takes the wall and leaves the road. The
  camera goes at the **top** of that ladder.
- **A road op that removes a road must clear its camera.** Census trap, in the
  reviewer's own words: *"the player sweeps the bulldozer down a camera'd
  avenue, the roads vanish in one press, then cameras hang in the air over bare
  grass."* One line, and a check.
- **The camera is in the undo snapshot** (`ops.js:319`, the field list) or
  pressing Z refunds the cash and leaves the camera standing.
- Only `js/sim/ops.js` mutates `road`/`rail`/`wall` in the whole sim, so `cam`
  has exactly one writer too.
- Cost `COST.camera` **§100**; network upkeep **§2,000/yr while `cams > 0`**,
  one term in the single yearly sum at `budget.js:72`.

### 4b. What a camera sees — the street, not a circle

A camera watches the road it stands on. `computeCamCover(world)` fills a
derived `world.camCov` (rebuilt, never saved):

> From each camera, walk **connected road tiles** up to `CAM_REACH` steps.
> Paint each road tile reached **and every tile within `ROAD_REACH` 3 of it**
> — the frontages that street serves — at `CAM_EFFECT` within `CAM_NEAR`
> steps and half beyond. Keep the maximum where two cameras overlap, as
> `computeCoverage` does.

**The 3 is not a taste call; the first draft had 1 and was wrong.** The census
measured the single structural fact that decides this whole feature:

> **A crime scene is NEVER a road tile. 0 of 120 scenes on seed 7; 0 of 254
> over seeds 7/3/5.**

A burglary's file tile is a *built lot* (`justice.js:210` builds `hot` from
`world.tier[i] > 0`, and a road tile has zone NONE and tier 0); a killing's is
the victim's *home*. So a camera that marks only its own road tile reads
**exactly zero at every scene**, and the whole clearance lever is a dead knob.
Distance from scene to nearest road, seed 7:

| paint radius from the road | share of scenes reached |
|---|---|
| 1 (the first draft's "eight neighbours") | **46.7%** — less than half |
| 2 | 86.7% |
| **3 (= `ROAD_REACH`)** | **100%** |

Radius 3 is also the right number on principle, not just on this rig: it is
`ROAD_REACH`, the game's own definition of "served by this road", so the camera
sees exactly the lots the street serves. It is the number tranche R is
standardising every access rule onto (§10), and on the owner's larger 6×6
blocks the interior sits 3 from the ring road — reachable, and only just.

**Where a camera must be put, which is the opposite of where cover goes
today.** Mean police cover at the scene is **non-monotone** in stations — 1.4/60
at one, 0.3/60 at two, 30/60 at four — because a burglary picks a lot with
crime above `CRIME_HIGH` and crime is high exactly where the police are not. A
camera sited for tidy coverage is sited where crimes will **not** happen. So
cameras belong on the **bad** streets, and the crime overlay is the tool that
teaches it. The card and the Rules line should say so outright.

This is why the owner's sentence names **intersections**: a camera mid-block
covers a corridor of two arms; a camera on a four-way covers a star of four,
for the same §100. It cannot see through a building or round a street it is
not connected to, and a wall that breaks the road breaks the sight-line for
free. Cost is a bounded walk per camera — with `CAM_REACH` 4 that is ≤ ~40
road tiles × 9 paints, so 50 cameras is under 20k writes a tick against a
9.46 ms budget.

### 4c. The crime effect — one term, in one place

In `justice.js` `filesTick`, and **nowhere else**:

```
        force = min(1, policeStations / ARREST_FORCE_N)
        if (force <= 0) continue                      ← UNCHANGED: no station, no roll
        p = ARREST_BASE 0.02
          + ARREST_FORCE 0.10 · force
          + ARREST_COVER 0.18 · policeCov[f.tile] / POLICE_EFFECT
          + CAM_ARREST  0.30 · camCov[f.tile]  / CAM_EFFECT      ← the whole feature
          + ARREST_PRIOR 0.05 · record
        capped at 0.95
```

`computeCrime` is **not touched**. There is no camera term in the field, in
land value, in the burglary rate, in the killing weight, or in the meat hall's
dread. A check greps for it (§9).

Worked, at one station (`force` = 0.25), a scene at full camera cover. Note
the exponent is **5, not `CASE_MONTHS` 6** — `filesTick` skips the month the
file opens (`if (tick <= f.opened) continue`), so a file is rolled on exactly
five months. The first draft used 6 and overstated the result:

| | p per month | over the 5 rolled months |
|---|---|---|
| today, dark scene | 0.048 | 21.8% |
| **with a camera covering that lot** | **0.348** | **88.2%** |

Measured baseline for comparison: a one-station town clears **22.8%** of its
files today (seed 7, 30 years, 127 files opened, 29 arrests, 90 cold).

That is the owner's *"one of the more effective crime solvers"*: a scene a
camera can see is very nearly certain to clear. But it clears **only** what
the camera sees — a town with ten cameras covers a small share of its lots, so
the town-wide clear-up rate moves a little; a town blanketed moves it to ~90%.
Which is what the flat fee is for.

### 4d. Wrongful arrests — the picture is not a witness

The owner: *"yes, they can lead to wrongful arrests, that is as intended."*

When the arrest roll that closed a file was carried by camera cover, the
wrongful probability rises:

```
        wrongfulP = WRONGFUL_P 0.05 + CAM_WRONGFUL 0.10 · camCov[f.tile] / CAM_EFFECT
```

so a camera-cleared file names the wrong animal **15%** of the time against
5%. `pickWrongful` takes an adult within `WRONGFUL_RADIUS` 4 weighted by
`1/(1+d)` — the animal who happened to be near the camera.

**But the payoff needs one more change, and the draft was wrong to say it did
not.** The draft claimed "everything downstream already exists and needs no
new code" and promised "a stream of exonerations". Measured by two reviewers:
**0.7 exonerations per 20-year run even with the town blanketed.** The cause is
structural — `arrest()` sets `f.closed = true` **even when the arrest is
wrongful** (`justice.js:290`), so nobody ever looks for the real culprit on
that file again, and `exonerate()` can only fire on the coincidence of that
same animal being taken for a *different* file later.

> **A wrongful arrest must not close the file.** One line. `filesTick` keeps
> rolling it, the real culprit is eventually taken, and the existing
> `exonerate()` path — `COMPENSATION` §500, the `EXONERATED` line, the
> town-wide `NAMED_MOOD` — comes alive for the first time in the game's
> history.

This is worth doing on its own merits and the repo already asked for it:
`BACKLOG:369-371` records *"the wrongful 5% is rarely seen at 4-9 arrests per
30 years… the lever for visibility is the arrest volume."* Cameras are that
lever — measured, wrongful arrests go **1.75 → 10.0** per 30 years — but
without the one-line file fix the volume produces nothing a player ever sees.
**It ships as its own commit, before the camera's wrongful term.**

The arithmetic of the blanket, **measured** rather than projected (0 vs 36
cameras, 4 seeds x 30 years): arrests **26.0 -> 74.8**, cold files **77.3 ->
10.8**, wrongful arrests **1.75 -> 10.0**, and mean crime on built lots
**39.57 -> 38.38**. The mayor bought a clear-up rate, a five-fold rise in
animals taken by mistake, and a crime number that did not move.

### 4e. The unhappiness — and why a mood term ALONE would do nothing

**This section was rewritten after measurement. The first draft was wrong.**

The census A/B'd a flat mood penalty applied to every citizen every month for
30 years, 4 seeds, balanced layout:

| penalty | population | approval | land value | crime | H |
|---|---|---|---|---|---|
| 0 | 1965.8 | 58.8 | 37.45 | 42.83 | 0.799 |
| −5 | 1965.8 | 55.0 | 37.45 | 42.83 | 0.799 |
| −20 | **1965.8** | 43.7 | **37.45** | **42.83** | **0.799** |

Population, land value, crime, cash and the Zoo City index come out
**byte-identical** at −5 and at −20. Only approval and the hash move.

**Mood is a dead-end variable in a growing town.** The only sim consumer of
`c.mood` is the household departure roll, and that roll is gated behind
`if (VR <= 0)` (`citizens.js:751`). In a balanced town `V_R <= 0` on **0 of
1,440 ticks**. The codebase already says so in a comment at
`citizens.js:667` — written when the meat hall hit this exact wall.

So a `WATCHED` mood term on its own would be **cosmetic**. The mayor would
blanket the town, watch approval fall from 62 to 48, and nothing else would
happen at all. With the upkeep flat (§5) the bill is not a brake either, and
**the feature would have no brake whatsoever.** The satire needs the town to
push back; a number that nothing reads is not push-back.

**The first fix was ALSO wrong, and an adversarial pass measured it.** The
draft after that put `WATCHED` into mood, the home score and REHOME, copying
dread's five seams. Four independent reviewers, two of whom built it, found
that **all three fail under the blanket the flat fee is designed to
manufacture**:

| seam | why it dies |
|---|---|
| `CAM_MOOD` in `moodTerms` | the dead-end variable above — no sim consumer at `V_R > 0` |
| `WATCH_HOME` in `homeTerms` | **`bestHome` is a pure argmax with no threshold.** A *uniform* penalty over every candidate lot is mathematically a no-op on lot choice |
| `REHOME_WATCH` | its guard demands "a destination with strictly lower cover" (the shape dread uses at `citizens.js:680`). Under a blanket no such destination exists, so it fires **zero** times |

Dread's seams work because a meat hall is **local and few**: there is always
somewhere less dreadful to go. A camera network is **global**, so every
mechanic built on a *comparison* cancels. **The brake must be absolute, not
comparative.**

A third candidate was checked and rejected for the same reason before it was
written down: the meat hall's `MARKET_PUSH` arrival lever
(`citizens.js:495`) changes only *which species* arrives — `pickSpecies`
consumes the weights, while the arrival COUNT comes from
`ARRIVE_GAIN · valves.R · vacantR / ARRIVE_DIV`. A uniform camera factor on
those weights is a third no-op.

**The brake is one term in the capacity law.** `demand.js:34`:

```
        cap = (CAP_BASE 1200 + CAP_PARK 150·parks + CAP_ZOO 500·zoos
               + festivalBonus − CAM_CAP 400 · watchedShare) × (1 + 0.5·H)
```

where `watchedShare` is the fraction of occupied homes at or above
`CAM_EFFECT/2` cover. The R valve is gated on `P / cap` (`demand.js:54`), so a
falling cap closes the valve, arrivals stop, and the town plateaus and then
ages down. It is **absolute** — it does not ask whether anywhere else is
better — so a blanket is exactly the case it bites hardest in.

And it is the right shape thematically: **parks and zoos raise the cap because
animals want to live near them. A camera network lowers it for the same
reason, backwards.** `CAM_CAP` 400 is between a park's 150 and a zoo's 500: a
fully watched town gives back the equivalent of nearly three parks' worth of
desirability, and a player watching the population graph sees it.

**Mood keeps its term, demoted to what it honestly is.** `WATCHED` stays in
`moodTerms` at `CAM_MOOD` 12 with the burgled waiver — not as the brake, but
as **characterisation**, and because the reviewers were right that the design
had no way for an animal to *say* what was wrong. So it comes with a
`needs.js` / `voice.js` code (`WATCHED`) and its Inspect line, the game's only
"here is your problem" channel:

> *"there is a camera on this street"* — remedy: *"bulldoze the camera at
> (31,18)"*

Without that line the mood term is invisible to the player and might as well
not exist; §11's calibration sweep reads the needs histogram, which only
works if the code is registered.

**Land value is deliberately NOT touched.** Dread takes `−0.8·dread` off LV,
and the obvious symmetry would be to do the same here. It is rejected because
`computeCrime` reads `− CRIME_LV 0.5 · lv`, so lowering land value would
**raise crime** — cameras would end up *increasing* the crime they are sold
against. That is a funnier joke and a different claim from the one the owner
made, and it would destroy the headline invariant in §9 (crime unchanged). If
the owner wants it, it is one knob and one line, and this paragraph is the
argument against.

The waiver is the owner's: *"folks who have been robbed before do not feel
that negative feeling."* Permanent, because the life record is permanent.

**Scope: the household, not the block — measured, because the first reading was
wrong.** `tools/victimprobe.mjs` (3 seeds, 30 years) marked every adult living
on the burgled *block* and found **44-53%** of living adults carrying the
memory: an R block can be 3x3 at tier 3, so one break-in marked a whole tower.
That is not "folks who have been robbed", that is their postcode, and it would
immunise half the town against the only brake the design has left. Scoped to
the **household that was actually burgled**, picked deterministically from the
households on the block (`(tick + lot) % n` -- no rng draw, so the no-new-draws
guarantee survives):

| police | burglaries | BLOCK scope share of adults | **HOUSEHOLD scope** |
|---|---|---|---|
| 0 | 99.0 | 49.0% | **5.9%** |
| 1 | 92.7 | 44.3% | **6.5%** |
| 2 | 82.3 | 52.9% | **5.3%** |
| 4 | 31.3 | 35.5% | **1.7%** |

Six per cent is the right size, and the number should not be talked up: this
waiver is **characterisation, not a balance lever**. It is a line on an Inspect
card that explains why one animal on a watched street is content while its
neighbours are not. It still carries the long-game shape the owner's rule
implies -- 6.5% in a badly-policed town against 1.7% in a well-policed one, so
**the more the city fails to protect its animals, the more of them accept being
watched** -- but it does so without swallowing the mood cost.

Also measured, and it simplifies the build: **burglaries are essentially 100%
residential** (92.7 of 92.7 on R lots at one station). Every burglary has
residents to mark; no shop, works or hall case needs handling.

### 4f. What has to be built first: a burglary has no victim

Today `burglaryTick` posts the loss to the treasury and names the thief. The
animals who live in that house are never told, never remember it, and the
card never mentions it. There is no victim in a Zoo City burglary at all.

So the waiver needs one, and it is a good thing to owe:

- **`KIND.BURGLED: 17`** in `life.js` (the registry runs 0–16 and is designed
  to extend; Part K owns the ids) — for the *card line*.
- **and a saved boolean `c.burgled`** for the *waiver*. These are two different
  jobs and the draft wrongly used one field for both: `remember()` keeps the
  first two life events and a **rolling window of the last ten**
  (`life.js:LIFE_MAX 12`), so a `BURGLED` entry is **evicted after ten later
  life events** and the "permanent, because the life record is permanent"
  claim in §13 was false. `c.burgled` goes in `canonicalCitizen` beside
  `c.fixed` / `c.wrongful` / `c.exonerated`, which are exactly this shape.
- `burglaryTick` marks **the household that was burgled** — not the block; see
  the measured table below — picked deterministically from the households on
  the block by `(tick + lot) % n`. No RNG, no new draw.
- `lifeLines` gains one sentence: `Burgled at (24,20) in 2016.`
- The Inspect card shows it, and `moodTerms` reads it for the waiver.

This also ends a silence worth ending: a burgled family currently is not told
it was burgled, and then is not told that nobody came.

## 5. The knobs, with reasons

| knob | value | why |
|---|---|---|
| `COST.camera` | 100 | a fifth of a station; the owner's *"cheaper than the police stations"*, and cheap enough that placement is not the brake |
| `UPKEEP_CAM_NET` | 2000/yr | the owner's flat network fee, charged while `cams > 0`. Five stations' upkeep, for a thing that prevents nothing. **The step is the point:** the first camera costs §2,000, the fiftieth §100 |
| `CAM_REACH` | **2** | road-steps the sight-line runs. **Was 4 and that was too strong:** 4 road-steps plus the ROAD_REACH-3 halo gives an effective Chebyshev **7**, more ground than a §500 police station's radius 6, for §100 — and the field saturated the whole town at 20 cameras. At 2 the effective reach is 5, inside the station's 6, and §1's "a station covers a neighbourhood, a camera covers a street" becomes true instead of merely asserted. **Re-measure saturation before shipping** |
| `CAM_NEAR` | **1** | full effect within one road-step, half at two. **Was 2, which bought nothing:** with `CAM_REACH` also 2 every reached tile was already 'near', so the graded shape the comment promised never existed |
| `CAM_EFFECT` | 60 | the same scale as `POLICE_EFFECT`, so the card can print both and a player can compare them |
| `CAM_ARREST` | 0.30 | the owner's *"one of the more effective crime solvers"*: a covered scene clears at **88.2% over the five rolled months** against 21.8% dark. Larger than `ARREST_COVER` 0.18 because it is bought one tile at a time. Independently re-measured at 87.9% closed-form / 88.6% in-sim |
| `CAM_WRONGFUL` | 0.10 | 15% wrong at full cover against the standing 5% — the picture is not a witness |
| `CAM_MOOD` | 12 | against the measured term table: `CRIME` mean −5.14, a killing's `fear` −15, the dread cap 25 |
| `CAM_CAP` | 400 | **the brake.** Subtracted from the capacity law in proportion to the watched share of homes, against `CAP_PARK` 150 and `CAP_ZOO` 500. Absolute, so a blanket cannot dodge it |
| ~~`WATCH_HOME`~~ | — | **cut.** `bestHome` is an argmax; a uniform penalty is a no-op |
| ~~`REHOME_WATCH`~~ | — | **cut.** Dies under a blanket (no less-watched destination) and adds an RNG draw site |

Every one lands in `KNOBS`, and `RULES` gains an entry with the formula and a
`live(world)` line, so the Rules tab, the card and the sweep read one copy.

## 6. The events (deadpan, named, pronoun-free)

- `CAMERA — a camera is up at (31,18). The street is watched for four blocks.`
- `IDENTIFIED — the camera at (31,18) puts Haswick Thistlewood (rabbit) at the burglary at (24,20). A file six months open is closed.`
- `EXONERATED — …` (exists; fires more often now, and says the camera named the wrong animal)
- `WATCHED — the camera network covers 41% of the town's homes. The bill is §2,000 a year.` (the yearly REPORT, not the ticker)

`TICKER_FLASH` gains `IDENTIFIED` only. `CAMERA` is the record, not the news —
the same call session 8 made for a burglary going cold.

## 7. UX and art

- **Tool.** One strip button, key `E` (`V` is the pacification centre; `WASD` pan and `O` cycles overlays — `E` is free), drag along a road like the road tool.
- **Overlay.** A `watch` mode in `drawOverlay` — camera cover in a cold blue,
  the crime overlay's own blue at a different alpha, plus a small ring on each
  camera tile. Signal by **shape** as well as brightness, per the house rule.
- **Card.** On any tile: `watched: 60/60 · 3 road-steps from the camera at
  (31,18)`; on a citizen: `does not mind the camera — burgled in 2016`.
- **Art — measured, not sketched.** The census built a prototype and ran a
  depth audit (12 walker sprites, 3 lanes, 1/8-tile steps, both parallel roads):

  - **The mast stands at the EAST corner. Only the east corner is clean** — 0
    mis-ordered pixels, against west 26, north 3,980, south 4,016, dead centre
    1,118. This is not a preference; every other corner clips walkers.
  - **Mast height 20 units, and height is a correctness parameter.** At H=20 an
    arm reaching up to 6 units back over the road stays at 0 mis-ordered px;
    the identical shape at H=16 mis-orders 12–100 px, because the housing must
    clear the walkers' 19-px head band.
  - **A camera cannot use the level crossing's mechanism.** The crossing
    composes ONE ground diamond from two masks because both things are *flat*.
    A pole has height, so it is a standing sprite over an unchanged road tile —
    exactly what the tunnel and the rail station already do.
  - **Legibility.** The house rule for a signature element is 8 px wide at 1×
    (set by the police station's blue lamp). The prototype reads as a 5-px dark
    vertical with an 8-px pale head, 19×29 px, 188 opaque pixels. A 0.75-unit
    mast with a 4-px head **reads as a lamp post and the lens is one pixel** —
    the census's own trap. There is no street lamp in the game to be confused
    with, but there is also no precedent to lean on: the only tall-thin objects
    are all attached to buildings (the scaffold poles, the police lamp post,
    the station shelter posts).
  - **The head sits ON TOP of the mast, not on an arm — a hard API constraint.**
    `solid.js` rasterises exactly **three** faces: the top (`c = c1`), the side
    (`+b`) and the end (`+a`). **The `−a` and `−b` faces are never drawn.** The
    draft's east-corner mast with an arm reaching *back* over the road is a `−a`
    shape, so it would render as a headless pole. Putting the housing on the
    mast's top face is always drawn, still reads as a camera, and keeps the
    depth-clean east corner. The lens goes on whichever of `+a` / `+b` faces
    the yaw selects.
  - **Facing is free.** `world.variant` is written once at world creation from
    a pure hash of (x, y, seed), never rewritten, saved and hashed — so the
    camera's *yaw* (which drawn face carries the lens) comes from it with no new
    state and no RNG draw, the trick the shop pool used. It must **not** pick
    the corner.
  - **Unverified and must be checked before shipping.** A reviewer reports that
    `defineSprite` constrains where an anchor may sit relative to the footprint,
    which may conflict with an east-corner anchor. This is the one part of the
    design nobody has built and rendered. **Build the sprite first, render it
    with `tools/shots.mjs`, and LOOK at the PNG at 1× before writing any sim
    code** — if the corner and the anchor rule cannot both be satisfied, the
    depth budget has to be re-solved and that changes the art, not the
    mechanics.
  - Built from `box()`es through `solidSprite`, so it registers in
    `solid.RECIPES` and **gets its 2× hi-res twin free** — verified on the
    prototype, 19×29 ink 188 → 131×92 ink 691. `js/art/hires.js` needs no edit.

## 8. Determinism and the hash

**No new RNG draw sites — and this is now true because the brake changed.**
Every camera mechanic changes a *probability* or a *field*; none adds or
removes a call to `world.rng`. `BURGLED` marking is deterministic, and the
capacity term is arithmetic.

> The previous draft claimed this while specifying `REHOME_WATCH`, which is a
> per-household, per-month `rng.chance()` — a new call site. Three reviewers
> caught it independently, and one noted that **no knob value makes it free**,
> because `rng.chance(p)` calls `next()` before comparing (`rng.js:52`), so
> even `REHOME_WATCH_P = 0` would shift the whole stream. Dropping REHOME for
> the capacity term removes the draw *and* fixes the brake — the two defects
> had one fix. The one honest consequence: raising `p` means the arrest roll
succeeds more often, and the wrongful draw sits behind that success, so a town
**with** cameras consumes the stream differently — as it would for any change
to the arrest rate. That is not a defect; it is the feature.

**The hash.** `cam` joins `TILE_ARRAYS`, and `stateHash` **deletes it while
every entry is zero** — exactly the precedent at `save.js:154-156`, where
`names`, `deaths` and an all-zero `meat` are dropped. So:

> **Every existing city, and every gate, is byte-identical until the first
> camera is placed.** A check proves it.

This is not a guess. The census ran the whole migration end to end in the
clean worktree, twice:

| experiment | result |
|---|---|
| `camera: new Uint8Array(n)` in `world.js`, `"camera"` appended to `TILE_ARRAYS`, **nothing else** | **`395 checks, 1 failures`** |
| the failing gate | `lives: v1 plain fixture continues ten years at its pre-Part-B hash` — got `bf6785e6`, `check.mjs:1336` asserts `688bc6ed` |
| add `if (o.camera.every((n) => n === 0)) delete o.camera;` after `save.js:164` | **`395 checks, 0 failures`** |

**That one line is the entire migration story. There is nothing else to
write** — and the elision is load-bearing, not tidiness.

**Old saves need no code at all.** `save.js:93` is already generic:
`for (const k of TILE_ARRAYS) if (o[k]) world[k].set(o[k]);` — a save written
before this feature simply keeps its zeros. The v1 fixture's keys end
`… wall use rail meat` (no `big`, no `theme`) and it loads and ticks ten years
green today.

**The precedent is split, and this design follows the newer half.** `big`
(`9c89f73`) and `theme` (`b042d0d`) shipped the all-zero delete and are
hash-neutral until first use; `rail`, `use`, `wall` and `meat` were added when
the hash was allowed to move. Cameras follow `big`/`theme`.

**Bit-packing into `road[]` was considered and rejected with a count**: 61
read sites across 11 files, 34 of them comparing against `ROAD.NONE`
(`render.js:237`, `ops.js:190` and others would each read a camera bit as a
road). Hash-cheaper, far too wide an audit.

**And the save, separately from the hash.** The same run measured an all-zero
`Uint8Array` at **8,193 characters of JSON** against a 155,678-byte control
save — **+5.3% on every save in the game, for a feature most towns never
touch.** `toPlain` writes every entry of `TILE_ARRAYS` unconditionally, so
`meat` already costs this today. Rather than repeat that:

> **Optional, and separable from the required fix:** write `cam` into the save
> only when at least one camera exists, using the optional-field precedent
> already in the file (`save.js:74-76`: `meatStats`, `legacy`, `names`).
> `fromPlain` needs nothing — `save.js:93` already tolerates a missing key.
>
> This is a *second* change and should land as its own commit with
> `tools/savesize.mjs` before/after, **after** the proven one-line elision
> above. Every other `TILE_ARRAYS` entry is written unconditionally, so this
> departs from the file's convention to buy 5.3%; the owner may prefer the
> convention. The required fix does not depend on it.

## 9. The suite — and the break each check catches

**This section was rewritten after four reviewers audited it and found that
three of its checks could not fail, one was false against the design in the
same document, and two were flaky against a correct build.** Each row below
names the break it catches; the notes record what the previous draft got
wrong, because the failure mode is instructive.

| check | the break it catches |
|---|---|
| every gate hash unchanged with **no** camera placed | the array joining the hash — measured to move it, `check.mjs:1336` |
| a save written with no camera contains no `cam` key, and loads | the +5.3% save bloat, and old saves failing |
| **mean `world.crime` at 0 vs 40 cameras is within ±1.5 points over ≥ 6 seeds** | a camera that deters. *Previous draft said "unchanged (within noise)" with no tolerance and no seed count — a reviewer showed a camera worth up to five points of deterrence would pass it. A falsifier with no threshold is not a falsifier.* |
| **BURGLARY headline count at 0 vs 40 cameras, recorded not asserted** | the *player-visible* quantity. The field moves −3.0% but the headlines move −18%, and the headlines are what a player counts |
| **arrests up and cold files down, each on ≥ 6 seeds, reported per seed with no threshold** | a camera that is placed, drawn, billed and does nothing. *Previous draft demanded "≥ 3×"; seed 3 delivers 2.72× on a correct build, so the gate was flaky against the truth. Report the distribution; gate only on sign and on every seed moving the same way.* |
| **a build with `CAM_CAP` set to 0 fails the population check** | *the previous draft's population check passed with the entire unhappiness feature deleted, because clearance-only cameras already move population. The check must A/B the brake, not the feature.* |
| **`watchedShare` at 40 cameras is > 0.5, and `capacityLaw` returns a smaller number than at 0** | the brake wired but multiplied by zero |
| grep `js/sim` for `camCov` outside `justice.js`, `citizens.js`, `demand.js`, `ui.js`, `render.js` — **`fields.js` is NOT allow-listed except in `computeCamCover` itself** | a future rule reading camera cover into crime or land value. *Previous draft allow-listed `fields.js` wholesale — and `computeCrime` and `computeLandValue` both live in `fields.js`, so the guard could not fail.* |
| a camera at `CAM_REACH` 2 covers ≤ the tile count a police station covers | the field out-growing a §500 station on a §100 budget |
| **a camera 3 road-steps away contributes 0** | an unbounded walk. *Previous draft said "5 road-steps"; with the ROAD_REACH-3 halo the effective reach is Chebyshev 5, so a correct build FAILED that row. The check must be stated in road-steps of the walk, not tiles of the halo.* |
| a burgled animal's mood is identical with and without cover; a non-burgled neighbour's differs by `CAM_MOOD` | the waiver applied to the wrong animal, or to everyone |
| **`c.burgled` survives 12 further life events** | the waiver stored in the life ring, which evicts after ten |
| wrongful share at full cover ≈ 15%, dark ≈ 5%, over ≥ 6 seeds | `CAM_WRONGFUL` added but always multiplied by zero |
| **a wrongful arrest leaves its file open, and an exoneration fires in a blanketed 30-year run** | the exoneration payoff — measured at 0.7 per 20 years before the one-line fix |
| **the `WATCHED` needs code appears in the histogram of a blanketed town** | the mood term being invisible to the voice layer, so no animal can say what is wrong |
| save → load → continue hash equality **with cameras placed AND the cap term live** | `camCov` rebuilt in the wrong tick phase. *A reviewer noted that with only the clearance effect wired this row cannot catch a phase error, because nothing reads `camCov` before `filesTick`.* |
| with 0 police stations and 40 cameras: 0 arrests, every file cold | the `force` gate lifted by mistake |
| a camera on a straight road covers 2 arms; on a four-way, 4 | the sight-line degenerating to a Chebyshev circle |

**Mutation tests the finished suite must survive:** set `CAM_ARREST` to 0; set
`CAM_CAP` to 0; force `camCov` to all-zero; apply the waiver to every animal;
move `computeCamCover` after its reader; delete the wrongful-file-open line.
**Each must turn a named check red.** The previous draft's list survived three
of these six.

## 10. The base, and the build order

**R and F landed while this was being written.** The live tree is no longer
dirty and the collision analysis this section used to carry is obsolete:

- `d3614b6 ACCESS — served() replaces hasAccess everywhere` (tranche R)
- `411d903 Ship Part F people news stories` (tranche F)
- `915836b DOCS — access recorded`, `b2d28fd SEEN — two corrections`

The `cameras` branch is fast-forwarded onto **`b2d28fd`** and the suite there
is **464 checks, 0 failures** (R and F added 69). Every number in this
document has been re-measured on that base, not carried over.

Two consequences for the design:

1. **Camera coverage reads R's `served()`**, now that it exists on `main`, so
   the camera asks about a whole building the way every other rule does.
2. The old §10 collision table is deleted. Its one surviving lesson: three of
   its rows were **wrong** — `PLACE_TOOLS` is the click-op set (appending to it
   would have made the camera click-only, contradicting the drag tool §7
   specifies), `main.js` needs a second edit in the `cycleOverlay` flash-label
   map, and `budget.js` and `ui.js` were omitted entirely though both must
   change together or the Budget panel disagrees with the bill.

**Commits, in order:**

1. `VICTIMS` — `KIND.BURGLED`, the saved `c.burgled` flag, `burglaryTick`
   marks the burgled household, the life line, the card. Hash moves; recorded.
   *Ships alone and is worth having with or without cameras.*
2. `THE FILE STAYS OPEN` — a wrongful arrest no longer closes its file, so
   `exonerate()` can fire. One line plus checks. Hash moves. *Also worth
   having alone; `BACKLOG:369-371` asked for it.*
3. `CAMERAS` — the array, the tool, the cost, the sight-line field, the
   overlay, the card, the art. **No crime, mood or cap effect.**
   *Note: this commit cannot be "every gate byte-identical" as the previous
   draft claimed — the network bill moves cash the moment a camera exists, and
   cash is hashed. The correct claim is narrower and still worth proving: a
   city with **no camera placed** is byte-identical, and that is what the gate
   checks.*
4. `CLEARANCE` — `CAM_ARREST`, `CAM_WRONGFUL`, `IDENTIFIED`. The probe table in
   the message.
5. `WATCHED` — the `CAM_CAP` brake, the mood term, the waiver, the needs/voice
   code.
6. `DOCS` — SPEC §9d, the Rules tab, README, BACKLOG, handoff §25.

## 11. Balance risks, each with its measurement

| risk | measurement |
|---|---|
| **the brake still does not bite** — the failure mode that killed two drafts | `camprobe` sweeps 0/5/10/20/40 cameras and A/Bs **`CAM_CAP` on vs off at the same camera count**, reporting population, `cap`, `valves.R`, arrivals and the `WATCHED` needs share. Two drafts of this design had a brake that measured as a no-op; the third must be measured, not argued. **If population at 40 cameras does not part from the `CAM_CAP`-off arm, the brake is dead again** |
| `CAM_CAP` 400 overshoots and a modest network strangles a town | the same sweep at 5 and 10 cameras — a Jersey-Village-scale deployment (≈ 7 per 1,000 residents, §2b) is the NORMAL case and must stay playable; only the blanket should hurt |
| `CAM_ARREST` 0.30 makes a covered scene a formality | the same sweep's solved% by camera count; the target is a strong local effect and a slow town-wide one |
| the burgled waiver swallows the mood cost in a crime-ridden town | **MEASURED and resolved** (S4e): block scope 44-53% would have; household scope is 5.3-6.5%, so a permanent waiver is safe. Re-run `victimprobe` if `BURGLARY_P` or the block rules change |
| exonerations become noise | `newsprobe` row budget; `EXONERATED` is already rate-limited by arrests |
| a camera on every road tile costs frames | ms/tick at 40 cameras against the 9.46 ms baseline |

## 12. Left for v2, on purpose

- **The vote.** ~~A council event that removes the network if mood is low
  enough.~~ **RULED OUT by the owner (2026-09-04): "having the town vote them
  out is too complicated for now."** It is well documented in the real world
  (S13: ~82 terminated contracts across 28 states, votes usually lopsided) and
  it is the natural v2 head, but it is not v1 and this document does not
  design it.
- **Sharing the network.** The research names this as the single most
  effective argument in real council chambers (S13). A neighbouring-town
  data-sharing event is a strong card. Held for v2 with the vote, since the
  two belong together and the owner has capped scope.
- **Retention.** A camera that remembers for N months and cannot help with a
  file older than that. Real Flock cut default retention from 30 days to 7
  after the stalking cases.
- **Insider misuse.** Officers querying the network for personal reasons is
  documented and dark; a good event card, not v1.
- **Species.** No per-species tolerance in v1; a bird minding a mast more than
  a mole is plausible and unmeasured.
- **The waiver widened.** Only burglary marks an animal. An animal that lost
  kin to a killing arguably also stops minding the camera; the owner said
  "robbed", so v1 keeps it to burglary.

## 13. The questions only the owner can answer

1. ~~**Is the waiver permanent, or does it fade?**~~ **Answered by
   measurement (S4e): permanent, scoped to the household.** At 5.3-6.5% of
   adults it cannot swallow the mood cost, and the life record is already
   permanent. No ruling needed.
2. **Should `CAMERA` flash?** Recommendation: no. `IDENTIFIED` flashes;
   putting up a camera is the record, not the news.
3. **`CAM_MOOD` 12 — is being watched worth more or less than a park?**
   Recommendation: 12 and re-tune on the sweep, since the bill no longer
   limits camera count and this number is now the only brake.

## 14. The alternatives, for the record

- **A camera lowers the crime field** (deterrence). Rejected: it makes the
  apparatus *work*, which kills the satire, and the real evidence for ALPR
  deterrence is weak. It would also double-count the police station.
- **A camera works without a station.** Rejected by the owner's ruling, and
  right: cameras multiply a force, they are not one.
- **A flat town-wide mood tax by camera count.** Rejected by the owner's
  ruling in favour of a local field, and better: a local field lets a mayor
  put cameras where the crime is and away from where the voters are, which is
  a real and unpleasant decision.
- **A camera as a civic tile** (like a station). Rejected: it would consume a
  lot, break the "along roads and intersections" ask, and put the camera in
  the block instead of on the street.
