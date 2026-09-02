# BACKLOG — Zoo City 2000

Open work, ranked. The design record is `SPEC.md`; the numbers are in
`js/sim/rules.js` (KNOBS). Later layers were labelled at design time so v1
could ship whole.

## Crime and punishment — SHIPPED 2026-09-02 (SPEC §9c; `js/sim/justice.js`); what is left
- **Hunger visibility.** The scripted towns run at U 0–4, so the ×20 hunger
  term only bites in dormitory / over-taxed towns (measured: one killing per
  ~7 years in a jobless town of 80). If the owner wants the hungry-wolf line
  in a healthy town, `KILL_HUNGRY` and the unemployment advisor are the knobs.
- **The wrongful 5% is rarely seen** at 4–9 arrests per 30 years (0–1 per
  run). `WRONGFUL_P` is the owner's number; the lever for visibility is the
  arrest volume (police cover, `ARREST_COVER`).
- **Customer walkers** to the hall (walkers.js `isShop` could include M);
  the meat hall's staff skinned by species; a "sold" departure walker.
- **Supply from funerals** as the hall's local term (Beastars: the market
  buys the dead) — the honest grey economy, v2.
- **The abattoir** — a 3×3 M landmark on the landmarks proposal's merge rule.
- **Per-species fixed counts** on the census histogram (`wolf 129 · 11 fixed`).
- **The scripted suite city loses its M row to a year-7 fire** (seed 7,
  disasters on); the dread invariant force-builds the halls on a clone
  instead — fine, but a firebreak in `buildCity` would let the row live.
- Measured and standing: the heist gate (a shop above 70) still never arms
  in a scripted town without two adjacent halls; P is cap-pinned, so the arc
  never shows in P — read killings, arrests, fixed, sold, littersLost, herbNear.

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
