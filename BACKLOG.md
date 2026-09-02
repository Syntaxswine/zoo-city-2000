# BACKLOG — Zoo City 2000

Open work, ranked. The design record is `SPEC.md`; the numbers are in
`js/sim/rules.js` (KNOBS). Later layers were labelled at design time so v1
could ship whole.

## Crime and punishment — PROPOSED, not built (`docs/PROPOSAL-CRIME-AND-PUNISHMENT.md`, 2026-09-02)
- **Part I — zone M, dread, the taking**: a fourth zone on its own
  carnivore-keyed valve; a dread field at exactly 2× a works' LV shadow;
  herbivores mind it (mood, home, a rehome rule), carnivores do not; a
  hall raises crime and crime is the taking's hazard rate (0.04·crime/100
  per hall-month × hunters on staff); the cut, the licence, the raid, the
  Greens' League. ≈ 420 lines, one session. The no-market CSV gate (P 1643
  · W 1052 · J 1480 · cash 84,706) is the byte-equality proof.
- **Part II — the file, the arrest, the wrongful 5%, the pacification
  centre**: police cover as a monthly arrest probability; the cells vs the
  centre; `fixed` read by five rules (no litter, never a hunter, no fear,
  friendship 0.7 counted ONCE in H, mood −5); the wrong animal as a ×8
  weight; exoneration pays §500. ≈ 600 lines, one session. **Three owner
  questions first** (complaints? weighted or same-kind wrongful pool? may a
  fixed wolf keep the counter?) — they set the whole volume.
- Measured and standing: the heist has fired 0 times in 360 city-years
  (a shop's crime tops out at 39–46 vs a gate of 70); P is cap-pinned, so
  neither arc shows in P — read births, littersLost, afraid, pacified.

## Polish the play-testers named (browser rounds 1–3), not yet done
- WHY NOT line should carry the tax parenthetical from SPEC §11
  ("demand −0.24 (R 12% vs neutral 8.2%)") and use the same rounded `local`
  as the score line (two sources today).
- A maxed tier-3 lot says "WHY NOT: —"; SPEC lists "capacity reached — build
  a park or a Zoo" for the CAPPED case only; decide whether a full lot
  should say "full".
- `.` faster while paused silently resumes; the pause button label does not
  change with state.
- A park placed up-left of a tower is hidden behind it (correct iso order);
  a hover-only cue is thin — consider a park glyph in the overlay or a
  minimap.
- A zoo costs §1,500/yr — warn on placement in a small town (net/yr goes
  negative at once).
- A loaded city always opens paused; players who reload a running ×3 game
  must press Space.
- Hover-card parts do not sum to the printed total (rounding).
- A walker on a bridge stands in the water: `roads.js` DECK_TOP (3 px) is
  applied by shots.mjs but not by render.js.
- `render.js` R_CHALK_TINT (m→q) and the repainted accent 5 (#B8C860) are
  two fixes for one fault; the R line uses grass keys, so one is redundant.

## L1 — cheap, visible, next
- **Road rot** (cash < 0 for 6 ticks → 5% of roads/tick to rubble) — the
  budget needs a bite besides receivership.
- **Owl academy** event + a 1×1 **school** civic (LV +10 within 4; children
  adults at 15 during it).
- **Wedding** (two adults of different species in one household befriend →
  procession walker). Needs the household merge rule: a move-in at 16 into a
  lot with another single household of a different species.
- **Buildings skinned by majority species** — a ramp swap on the box solid at
  compose time (`remapRamp` in palette.js exists); needs occupancy-change
  invalidation of the static layer.
- **Minimap** (the sibling Glades has one to port).
- **Pond removal** for a beaver dam (§40, beavers' mood −20 for a year) — the
  op exists in KNOBS.COST.pond but not in ops.js.
- (fire and police stations shipped 2026-09-02: `F` and `P` tools, crime field, heist)
- **Money tuning after real play**: the scripted mayor nets +§3.7k/yr at
  1,643 (balanced, no civics) and ~§0 at 1,850 with two parks and a zoo;
  a real player spends differently. Re-measure with the input log of an
  actual session before touching UPKEEP_*.

## L2 — bigger arcs
- **Elevation** — Glades of Arcadia's level machinery (`LEVEL_H`, cliffs,
  ramps); the box-solid buildings and BFS commutes both need to learn a z.
- **Shore autotile** (47-blob) — v1 draws a 1-px kerb where grass meets water.
- **128×128 maps** — the sim is O(tiles); the static-layer cache and the
  save size are the only costs.
- **Power** (plant + 4-tile radius, unpowered = score −0.5) — the classic
  third gate, deliberately absent from v1.
- **Station staffing as coverage** — today a station covers fully whether or
  not its four jobs are filled (weights, never gates); SC-style funding
  sliders are the L2 version.

## L3 — texture
- Sound (the Impressions register is half walla).
- Per-species idle poses; 4-frame walks.
- Scenarios (Dullsville: dig a city out of receivership; Beaverton: a river
  city that must live with dams).
- Friends met on the road: record walker crossings, resolve once a month by
  rule (never by frame).

## Measured, not yet acted on
- H (cross-species friendship share) sits at ~0.7 in every balanced city —
  it is a diversity dividend (+35% cap), not a lever a mixed city can pull
  further. A monoculture drops it to ~0. If it should discriminate MORE,
  the candidate is H relative to the random-mixing expectation.
- Species shares settle near bear/beaver/owl ~20% each in the scripted
  mayor's towns because it never builds parks (rabbits) or tier-3 vacancies
  (mice). Real play will differ; re-measure.
