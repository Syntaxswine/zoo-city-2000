# Review — the knowledge and culture proposal (2026-09-05)

Of [PROPOSAL-KNOWLEDGE-CULTURE-2026-09-05.md](PROPOSAL-KNOWLEDGE-CULTURE-2026-09-05.md),
read against HEAD `7ac3e1d` (793 checks green in 1 m 36 s; the 15-year fixture
368 citizens). Reviewer: Claude Fable 5.1. The review changed one thing in the
game: the class-level defect it found in passing (§F3) is fixed in the same
commit, with `tools/haloprobe.mjs` as the instrument under it. Nothing of the
proposal itself is built.

**Verdict.** The knowledge half stands on the right channel — the capacity law
is the one ABSOLUTE lever this game has, the camera arc proved it, and the
proposal's formula matches `demand.js:capacityLaw` at HEAD term for term. It
can be built as specified once two numbers are measured (§F2). The culture
half AS WRITTEN is a measured no-op: a mood term does nothing in a growing Zoo
City town, and this repository already says so in its own comments (§F1). It
needs a real channel or an honest label before it is built. One class-level
defect turned up in passing and is fixed here, so the build's step 0 is done
(§F3). Everything else is detail, and most of it the proposal already has right.

## Findings, ranked

### F1 — Culture's +4 / +8 mood does nothing measurable — RULED 2026-09-05

**The owner's ruling, verbatim:** *"culture will be a boon to both happiness
as well as property desirability, but later when we start getting into
wealth/class it will be a prerequisite to more affluent housing."* So (a) AND
(c) below: the mood term stays as the sayable half and a land-value halo is
the measurable half, seeded through `reach.forEachWithinAll` like every other
campus halo; culture becomes a per-tile strength field so a later housing gate
can read it. The meetings-into-H idea (b) was not taken. The wealth arc it
points at is scouted in
[PROPOSAL-WEALTH-AND-CLASS-2026-09-05.md](PROPOSAL-WEALTH-AND-CLASS-2026-09-05.md).
The finding as it stood:

`c.mood` has three readers at HEAD:

| reader | where | what mood does there |
|---|---|---|
| departure / camping roll | `citizens.js:786` `(1.5 − meanMood/100)` | only inside `if (VR <= 0)` — never fires while the town grows |
| census approval | `census.js:120` → the REPORT line; the county-grant gate `events.js:293` needs `approval >= 50 AND cash < 2000` | a printed number; one rare gate |
| the Inspect card / needs | `needs.js`, `moodTerms` | what an animal SAYS |

On the three published rigs at year 30: approval 61 / 51 / 61 (balanced /
estate / balanced `--stations --zoo 12`), V_R 0.15 / 0.37 / 0.12, cash
§78k / §5.8k / §7.4k. Add 8 to every mood and no gate crosses, no roll changes.
The camera arc measured exactly this on a −20 flat penalty: population, land
value, crime and cash byte-identical (`demand.js:34–47`, the comment above
`capacityLaw`; `citizens.js:1044`, the WATCHED term). The proposal's own
acceptance probe — "record population, K, cap, approval, jobs, cash" — would
show approval +4 and every other column unchanged, and a reviewer would call
the Gallery a §300-a-year sticker. Children's mood is also floored at 50
(`citizens.js:1068`), so their +8 is invisible whenever it would matter.

Three ways out, ranked:

- **(b, recommended) Culture is where species meet.** Friendships form in
  three modes (`citizens.js:889–928`): at work, next door, and "park-goers" —
  a PARK within 4 of both homes, `parkBonus 2`. Add culture coverage as a
  fourth meeting place (both homes inside `cultureCov`), weighted toward
  cross-species pairs. That feeds H, and H is IN the capacity law as
  `×(1 + 0.5·H)` — the game's own thesis ("live and grow together") as the
  channel. Measured today: mean friends 0.67 per citizen, called "thin" in the
  People plan and left as nobody's knob; this would be its knob. Keep the +4/+8
  mood term as the SAYABLE trace (bubble: "there's music near home"), exactly
  as WATCHED is kept for the camera.
- **(c) A land-value halo** like `LV_PARK` / `LV_LARGE_PARK` (`fields.js:285`).
  Absolute, visible in the LV overlay, and LV enters growth and crime. Cheap,
  but a Gallery then reads as a park with a different roof.
- **(a) Honest label.** Ship the mood term, claim nothing mechanical, and say
  in SPEC that culture is characterisation. Legitimate, and cheapest, but it
  makes two of the four buildings pictures with a bill.

Whichever is chosen, the culture probe must be an A/B on the SAME seed with
the Gallery on vs off, and the acceptance line must name a column that moved
other than approval. Note also that the park-goers mode reads `CIVIC.PARK`
only — a Large Park is not a meeting place today. Not this proposal's bug;
one line if (b) is built.

### F2 — Knowledge → capacity is the right channel; two numbers to measure first

The formula matches HEAD exactly (`CAP_BASE 1200 + 150·parks + 500·largeParks
+ festivalBonus − CAM_CAP·watchedShare`) × `(1 + 0.5·H)`, with `+ 600·K`
added inside the multiplier like the parks. Right shape. The numbers:

| rig, year 30 | P | cap | pinned? | +600·K·(1+0.5H) at K = 1 |
|---|---:|---:|---|---:|
| balanced (H 0.81) | 1,673 | 1,965 | yes (V_R 0.15 = 1 − P/cap) | +843 |
| estate (H 0.78) | 1,334 | 2,224 | nearly (V_R 0.37 vs 0.40) | +834 |
| balanced --stations --zoo 12 (H 0.76) | 1,701 | 1,931 | yes | +828 |

So one §4,000 University at full coverage lifts a cap-pinned town's ceiling by
about 43%. A Large Park is +500 → +702 for §2,500 and §1,500/yr, plus mood and
LV. The University dominates the Large Park on capacity per § of upkeep. That
may be intended ("stronger district institutions") — say so in SPEC, or price
the upkeep above the park's.

**The dynamic to measure before any tuning.** K is a MEAN over housed animals.
A town that grows OUTWARD past the catchment lowers K, which lowers the cap,
and a cap below P puts V_R below zero — which since `773174d` sends households
to CAMP. A university town that outgrows its university pitches tents. That
may be a fine story; it must be a measured one. Probe: K(t), cap(t), P(t),
campers(t) monthly over 30 years on balanced and estate with the University
placed at year 0 and again at year 10; plus the "half the homes covered" case
the proposal itself names. Run it on the owner's control city when it arrives
(§F11) — the mayor's towns are compact and may never leave the catchment.

### F3 — Found in passing: every 3×3 campus halo was seeded from its ANCHOR tile — FIXED in the same commit as this review

**Fixed on the owner's standing instruction to fix bugs when seen.** One
multi-source flood, `reach.forEachWithinAll(world, tiles, R, fn)`, and the
three halo sites on it: station cover, the Large Park's and the centre's land
value, and the centre's van in `moodTerms` (which resolved parts for the park
branch and not the centre branch beside it). Six checks, five mutants, 5/5
caught. Five of the six published mayor rigs are byte-identical (no station,
park or centre in them; the prison has no halo) and the one with stations
moves, 1,703 → 1,714 animals. The suite's canonical 15-year city moved
368 → 290 — an RNG cascade, not a mechanism: across eleven seeds six are
byte-identical, three move by under ten animals, and seed 7 alone loses 78
to a year-12 fire that did not happen before and the receivership it caused
(the table is in the commit and the keystone handoff §30; its canary is
re-baselined there with that number). The proposal's step 0 is therefore
DONE; the new buildings should seed their coverage through the same call.
What follows is the finding as it stood.

`computeCoverage` (`fields.js:323`) loops tiles and floods from `i` where
`isStation(world.civic[i])`; a campus's other eight tiles are `CIVIC.PART`, so
only the top-left tile seeds. Same shape for the Large Park's LV halo and the
centre's van shadow (`fields.js:285–290`) and fire cover (`:331`). Measured
(`node tools/haloprobe.mjs`, flat grass, campus at x 30..32 × y 30..32):

```
POLICE_RADIUS 6
  computeCoverage : 169 tiles, x 24..36, y 24..36
  footprint-seeded: 225 tiles, x 24..38, y 24..38
  NW reach: (24,24) cov 30 · SE reach: (36,36) cov 30, (37,37) cov 0, (38,38) cov 0
  → seeded from the ANCHOR tile: the SE frontage gets 4 tiles of reach, the NW gets 6
```

A player who drops a station on a block's south-east corner gets two tiles
less reach than one who drops it on the north-west. The `KNOBS` comments
("covers Chebyshev 6") date from the 1×1 stations; `3eb65d6` made them 3×3 and
the seeding was not revisited. Only the PARK mood term (`citizens.js:1010`) and
the Large Park wish resolve parts. The proposal's rule — "seeded from every
footprint tile at distance zero" — is the right convention, and the class fix
is to build it ONCE: a multi-source `forEachWithinAll(world, tiles, R, fn)`
beside `reach.js:forEachWithin`, then put all five existing campuses on it in
the same commit. That moves all six published mayor hashes (every rig with a
station or a Large Park), so it is its own commit with its own before/after
table, ahead of the four new buildings — the two-commit pattern.

### F4 — `jobsOf` defaults any unlisted civic employer to 4 jobs

`world.js:391–403`: a civic that passes `isCivicEmployer` and is not the Zoo,
Large Park or Centre returns `STATION_JOBS` 4. A Library would get its 4 by
coincidence; a University would get 4 instead of 12 and nothing would say so.
Add explicit rows to `jobsOf` AND `capacityOf`, and a check that reads
`jobsOf(anchor) === 12` on a placed University. The same four ids must be
added to `isCivicEmployer` (jobs + `asksAccess`), the render dispatch
(`render.js:534–539`, an if-chain by id) and `art.civic`'s kind list.

### F5 — Keys: the collision audit, done

Bound today — palette: `1–9 0 Z V P F I B G E`; commands: `H U L O R N
Space , . + − Backspace Esc`; pan: `W A S D` and the arrows (a check forbids
w/a/s/d in any binding table); `Ctrl+S` save-as, `Ctrl+Z` undo; `R` also closes
the reader. **Free letters: C J K M Q T X Y.** Suggested: `K` Library
(knowledge), `Y` University, `T` Amphitheater (theatre), `M` Gallery (museum);
avoid `C`, which every city-builder player reads as Commercial. Mouse access
works regardless — the palette is generated from the registry.

### F6 — The palette already scrolls

`css/field.css:84` gives `#palette` `overflow-y: auto`, so the proposal's
"allow the palette to scroll" is already true. 22 tools lay out as 2 × 11 at
240 px, and 4 × 6 with a ragged last row below 720 px high. Nothing to build.

### F7 — A priority-4 wish sits exactly on the floor

`NEED_MIN` is 4 and the sort drops anything below it; a 4-point culture wish
clears the floor by zero and loses every tie to any other hurt of 4 or more.
It surfaces only for an animal with nothing else wrong. That IS "restrained";
just say it is at the floor, not below the park's 10. Extending `ACT.CAPPED`
("build a park or Large Park") to name knowledge when K < 1 is right.

### F8 — Civic jobs are C-type, so they lean on the C valve

`census.js:201` puts civic jobs in `Jc`, and the C valve is
`(C_PER_CITIZEN·P + C_SEED − Jc)/…`. A University's 12 jobs compete with
shops for demand, as the Large Park's 12 already do. Not wrong; worth a
sentence in SPEC §4 so nobody reads a dip in V_C as a bug.

### F9 — Save and compatibility rules are right

Four ids appended after `ZOO: 8` in a `Uint8Array`; no new tile array
(adding one breaks the `lives: v1 plain fixture` gate, `check.mjs:1336`);
`knowledgeCov` / `cultureCov` derived, never saved, rebuilt in
`computeFields` — the `camCov` pattern. `save.js:97` already skips absent
keys, so old saves load unchanged. The proposal has all of this correct.

### F10 — Register

These are the first plainly GOOD civics in the game. The satire ruling covers
the punitive apparatus (meat, police, centre, cameras), not these, so a Library
that works is on-thesis. Keep the ticker deadpan and the advisor silent:
"UNIVERSITY — the Roost has opened a university at (18,4); 612 of 1,673
animals live within its reach." reports; it never recommends.

### F11 — The owner's control city is still absent, and this proposal needs it

`check.mjs` prints `DEFERRED: owner control-city.json has not arrived`. The
University's and Amphitheater's budgets are fractions of the MAP, so their
balance is only judgeable on a map-scale town — and the only one is the
owner's (6×6 blocks, ~2,850 animals). The export is now load-bearing for this
proposal as well as for the People plan.

## The build order, reframed

The proposal's four steps hold. Two adjustments and one insertion:

0. ~~The multi-source flood, and the five existing campuses onto it~~ (§F3)
   — DONE, this commit: `reach.forEachWithinAll`, six mayor hashes
   before/after in the commit message.
1. Ownership, tools, costs, jobs, save — as proposed — plus the explicit
   `jobsOf` / `capacityOf` rows (§F4) and the four keys (§F5).
2. `knowledgeCov` / `cultureCov` on the flood from step 0; the `+600·K` term;
   **the culture channel the owner picks** (§F1); cards, Census, Rules, the
   two overlays.
3. Art, both zooms (built from `solid.RECIPES`, the 2× set comes free through
   `hires.js`).
4. The proposal's probe matrix, plus §F2's dynamic (K, cap, P, campers over
   time), plus a Gallery on/off A/B naming the column that moved.

## Three decisions for the owner

1. ~~**Culture's channel**~~ — RULED 2026-09-05: happiness AND property
   desirability, i.e. the mood term and a land-value halo; later a
   prerequisite for affluent housing (see F1).
2. **The University vs the Large Park:** +600·K for §1,200/yr against +500
   for §1,500/yr — intended dominance, or reprice?
3. **Keys:** `K Y T M` from the free set `C J K M Q T X Y`, or another pick.
