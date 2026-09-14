# Hostile review — the nine commits of 2026-09-12/13 (campaign, farms, healthcare, cemetery, governance)

**Scope.** `a925df5..7b59fbb`, nine commits by another agent that landed on `main` between the migration
push and this session: a five-chapter river campaign (`js/sim/progression.js`), seven civic tools (farm,
6×6 cemetery, sanitation, garbage, doctor, hospital, Governor's Mansion), a citywide healthcare lifespan
rule, a Governance panel with eleven policies (`js/sim/governance.js`), SVG pictogram palette buttons, and
six architectural plans per building family. 102 files, +20,215 lines. Nothing in BACKLOG, SPEC (beyond a
seven-line link) or the handoff recorded them.

**Method.** Three reviewers under the fan-out cap, one dimension each, plus the browser in this session:

| lens | what it did | found |
|---|---|---|
| sim correctness | read every `js/sim` hunk; wrote and RAN a reproduction for each suspicion (`scratchpad/agent-sim/s1..s7`) | 8 CONFIRMED, 1 PLAUSIBLE, 11 cleared |
| test hostility | ran 23 mutants against the four new check files in an isolated worktree | 14 caught, **9 survived**; 4 loosened assertions judged |
| player + docs | headless campaign play-through on 3 seeds × 9 rigs; every policy description vs its consumer; keys, palette, docs | 17 findings; copy vs mechanics: 30 MATCH, 2 MISMATCH |
| the browser (this session) | founded a campaign city, laid the river road, four farms, a Low strip; Chapter 1 → 2 by hand | the "no work" flood, the banner contention, the Rules-tab order |

The A/B instrument was `scratchpad/rebase-probe.mjs`: `tools/check.mjs`'s scripted city rebuilt against
the pre-merge tree (`a925df5`, a detached worktree) and the merged one, with `--set`-style knob overrides.

## The headline numbers

| measurement | old tree | merged | merged, `NO_MEDICAL_PENALTY=0` |
|---|---|---|---|
| scripted city, seed 7, 15 y (the suite's canary) | **366** · hash `e0833adf` · licence card on the desk | **271** · no card | 366 · `e0833adf` before the fixes; **366 · `e0833adf` after them, card included** |
| balanced rig, 60 y, disasters off (`leaveprobe`) | — | P 2,186 | P 2,232 (+2%) |
| estate rig, 60 y, disasters off | — | P 1,694 | P 1,571 (−8%, the OTHER way) |
| 28-I-lot free-play city, 15 y (sim reviewer's s1c) | 417 | 264 (rolled `skunked` where the old tree rolled the Scrubbers) | 417, hash-equal after the fixes |

So: the −3% lifespan rule is a **chaotic perturbation**, not a population lever — the two rigs move in
opposite directions and the canary's −26% is the RNG cascade, not the mechanic. It was re-baselined
honestly (the number is in `a918dee`'s message) and the rule is kept: shorter lives without a doctor is
accurate, and the project's law is accuracy over determinism. What the canary now pins is a knob whose
historical state was OFF; the falsifier is `NO_MEDICAL_PENALTY=0 → 366 / e0833adf`, and after this
session's fixes the merged tree returns that hash **exactly**, pending licence card included — the nine
commits plus the fixes are byte-identical to the pre-merge tree when the one new free-play rule is
neutral.

## Findings, ranked, with what was done

**FIXED in this session** (each pinned in `tools/check-hostile-review.mjs`; 19 reverting mutants, 19 caught):

1. **The Butchers' licence and the Scrubbers were struck from free play** (`events.js` gate `() => false`,
   the deterministic offer deleted; `resolveChoice` returned "now in Governance"). Every free-play city past
   15 I lots re-rolled its events; the licence — an owner-ruled mechanic, SPEC §9c "offered
   deterministically the month the first hall reaches tier 2" — now cost a §3,000 mansion the player was
   never told to build. Restored for a town with **no Governor**; a governed town gets no card and a card
   left on the desk is referred to Governance free. A pending card survives a save again (`save.js` had
   been retiring it on load). The suite's "what a road buys" check gets its original `on.licence` back.
2. **The Governor's `unlocked` bit** was written inside the tile loop and never snapshotted: undo or
   bulldoze the mansion and the town stayed governed forever — Collect stopped rolling its sentence for an
   estate that did not exist, and the undone city no longer hashed as the city before the build.
   `governanceUnlocked` is now DERIVED (a standing mansion, or a law on the books); no bit is stored;
   `save.js` no longer forces the key onto every loaded city (that broke save/load hash equality for any
   city with a law).
3. **Food aid counted as farm food**: `food = farms·yield + poorCount`, so a town of paupers on §12 a head
   passed a chapter with zero farms. `infrastructure.farmFood` is the chapter gate; aid still feeds mouths
   (arrivals, births, the FOOD mood) and the status line says "+N on aid".
4. **The Chapter 1 knife edge**: arrivals stop exactly at the food line, so `food ≥ population` with the
   guide's four farms held only while P == 100 and any birth reset the streak (22 and 38 months on two
   seeds vs 10 with a fifth farm). The gate is now `farmFood ≥ target`.
5. **A governance op billed through `post()` with no `canSpend`**: a town in receivership bought §1,500
   scrubbers and a §2,000 licence. Now refused like every other op.
6. **A save with no `flags` threw** in `fromPlain` where the old spread tolerated it.
7. **Trees, walls and Use were locked until Chapter 5 by omission** from `UNLOCK` (the U key read "Unlocks
   in Chapter 5: The Metropolis"). Land tools open with the road; rail, stations, cameras, the University
   and the Amphitheater stay with the Metropolis as the guide says.
8. **A locked palette button did nothing when clicked** (the keyboard path flashed the reason). It flashes.
9. **Nine mutants the new check files could not see**, all because `check-governance.mjs` tested
   governance.js's own helpers, never their consumers: oversight out of the wrongful roll (`justice.js`),
   cleaners out of the mess (`fields.js`), governance upkeep unbilled (`budget.js`), the estate legislating
   with no road, rubble not closing a facility, sanitation removal ignoring the covered share, the chapter
   food gate deleted, the chapter-4 backlog term deleted, a programme unpriced. Each has a counter-check.
10. Copy: README said the campaign was the default and to "choose Sandbox" (Free Play is the default, and
    the radio is labelled Free Play); SPEC's head said the same; the new-city flash promised farms
    "connected" to the town road (the machine checks adjacency, never connection) and had lost the tax
    hint; the H-key flash named Chapter 3 for meat (Chapter 5); the undo message blamed a bulldoze after a
    governance op; the campaign line vanished for the whole of a receivership; docs/CAMPAIGN.md's "months
    16 and 12" came from a 40×40, no-disasters, whole-map-zoned rig and did not say so.

**KEPT, and why** — the accuracy-over-determinism rulings:

- The −3% lifespan penalty in free play. Measured above: chaos at the population scale, honest at the
  individual scale (a town with no doctor buries its animals a little sooner). Re-baselining the canary
  366 → 271 was a decision with a number, as the comment demands. The falsifier is on record.
- The per-op `computeInfrastructure` (1.7 → 8.1 ms an op with four hospitals). `computeFields` recomputes
  it on every fields pass by design, like the University's halo; the `apply()` call was only a duplicate
  and is now gated to tile ops. The standing cost is structural, not a defect.
- A governance op clears the tile undo stack (police actions do the same); the notice now says so.
- Re-licensing after repeal charges §2,000 again. Design; noted in the guide.

**OWNER DECISIONS — not touched:**

- **Chapter 3's 1,500 is not reachable on the current economy.** Six scripted 40-year runs at the
  demand-neutral rate reached Chapter 3 in 27–106 months, peaked at 892–934 villagers and entered
  receivership in years 6–10: `UPKEEP_CITIZEN` §12/animal outruns Low-density R tax at 600–900 animals;
  raising rates to 12–14% triggered the over-tax flight (450 → 145). A human may do better; the deficit is
  arithmetic. Lower the target, scale campaign upkeep, or give the campaign its own tax curve.
- **The remote.** SPEC §11 specifies sprite thumbnails with label and hotkey on every button; the palette
  is now a silver bevelled remote with 39 px black circles and 29 monochrome SVG pictograms, **no visible
  label or key on any button** (names live in `title`/`aria-label`; nothing on touch), `system-ui` for the
  heading, a saturated focus ring, and ~840 px of height that scrolls the Governor and Interview/Collect
  below the fold on a 720–880 px viewport. The glyphs are competent; the chrome and the lost labels are a
  regression against the field-guide aesthetic. If the owner asked for the remote, keep it and restore a
  label + key under each glyph; if not, `var(--panel)` + `var(--border)` and monospace.
- `[` and `]` (Doctor, Hospital) are AltGr chords on QWERTZ/AZERTY/Spanish layouts and `input.js`
  returns early on `altKey`; `C` is Cemetery while the Commercial zone is `2`.
- The over-capacity audit in `check.mjs` was widened to exclude `absent` citizens because a prisoner keeps
  the address of a house that decayed to tier 0 — a real sim state (release to a tier-0 lot) that the widening
  hides rather than pins.
- `sanitationShare` divides covered HOUSED residents by total population, campers included; a town with
  more than 10% campers cannot clear the 0.9 goal. Possibly intended (campers foul the river). Not executed.

**Cleared** (suspected, run down, fine): the 6×6 part byte (`192 | dx | dy << 3`) for all 36 tiles and
every reader; legacy 2×2 cemeteries; meat prohibition end to end (staff released, stock spoiled, routes
reset, re-legalising restores); no new unconditional RNG draws (`thiefPool`/`pickWrongful` short-circuit
behind `foodRecipient`); `citizenHomes: 1` dedup symmetric and hash-neutral; campaign `stable`/`entered`
validation cannot reject a legit save; `sentenceFor` equivalent to the old table with no law set; all
eleven policy descriptions MATCH their consumers; the tool tooltips MATCH KNOBS; the UNLOCK table MATCHES
the guide's chapters 1–4.

## Score

As landed: **5.5 / 10** — ambitious and internally tested, but it overrode two owner-ruled free-play
mechanics without a ruling, stored a derived fact as a bit, let aid pass a chapter, re-baselined the
suite's canary, and shipped a campaign whose third chapter the economy cannot reach. After this session:
**7 / 10** — the free-play stream is byte-identical to the pre-merge tree under the neutral knob, every
confirmed defect has a counter-assertion, and the two design questions are written down with numbers for
the owner. The remaining three points are the owner's: the economy, the remote, the keys.

## Instruments

- `tools/check-hostile-review.mjs` — 17 blocks; run alone or via `npm run check`.
- `scratchpad/rebase-probe.mjs` (this session; not committed) — the suite's scripted city against any
  tree with `KEY=VALUE` overrides; the A/B that produced the table above.
- `tools/leaveprobe.mjs --layout estate --years 60 --no-disasters --rule none [--set NO_MEDICAL_PENALTY=0]`
  — the 60-year rigs.
- The reviewers' scratch scripts (`agent-sim/s1..s7`, `agent-ux/play*.mjs`) live in the session
  scratchpad only; their numbers are in this file.
