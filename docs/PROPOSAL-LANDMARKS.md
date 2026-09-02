# PROPOSAL — 3×3 themed landmarks

The owner (2026-09-02): *"lets also think about adding more specialized 3x3
tile sprites for some special themed buildings. things like themed
commercial shops, an industrial dairy, or a residential apartment building."*

## The recommendation: landmarks GROW, and the species decide which

SimCity 2000's 3×3 buildings appear when a dense block matures. Zoo City's
version should be the same mechanic with the zoo's thesis on top: **when a
3×3 block of one zone is all tier 3 and 70% full, with road access, it can
merge into one landmark lot, and the majority species of the animals in it
chooses the theme.** The city's character literally builds the building.

| zone | majority species | landmark | what it does besides being big |
|---|---|---|---|
| R | rabbit / mouse | **Warren Towers** — a honeycomb of round doors | capacity 260 (9 towers hold 216); births ×1.25 inside |
| R | beaver | **Lodge Apartments** — timber and dam-stone | capacity 240; +LV 6 within 4 (water feature) |
| R | any other | **Grand Apartments** — the plain brick block | capacity 240 |
| C | fox / cat | **The Emporium** — a department store with awnings | 200 jobs; V_C +0.1 while it stands (a draw) |
| C | raccoon / owl / skunk | **Night Market** — lanterns, stalls, bins | 200 jobs; C income ×1.2; mess +6 on the lot |
| C | any other | **Arcade** — glass and concrete | 200 jobs |
| I | cow | **The Dairy** — silos, a churn hall, a tanker | 220 jobs; I income ×1.15; emission 40 (cleaner than 9 works at 70) |
| I | pig | **Truffle Works** — kilns and a mud yard | 220 jobs; +§1,500 truffle bonus yearly if trees ≥ 8% |
| I | beaver | **Sawmill** — log pond and a saw shed | 220 jobs; needs water within 6; trees within 8 give LV +3 |
| I | any other | **Foundry** — the plain works, three stacks | 220 jobs; emission 80 |

Ten sprites, all box solids on a 3×3 plan (a, b ∈ [0, 48] units) through the
existing rasteriser — the zoo already proves the 2×2 path (anchor at the
footprint's ground centre, painter keys it by its front-most tile).

## Mechanics, stated

```
MERGE (monthly, after growth): for every 3×3 window of one zone, all tier 3, mean fill ≥ 0.7,
      every tile with road access, no rubble/fire/flood, not already part of a landmark:
      p = 0.05 per month per eligible window (raster order, first wins)
      → anchor = top-left; parts point at the anchor; tier stays 3; `landmark` = theme id
      → occupants/workers are re-seated on the anchor (capacity as above); the eight parts hold none
THEME = majority species among the block's occupants (R) or workers (C, I); ties → the plain one
UNMERGE: bulldoze (any tile) clears all nine (evict / fire as a lot decay would); fire on any
      part burns the landmark as one lot; decay at score < −0.15 for 12 consecutive months
      splits it back into nine tier-2 lots (a landmark does not decay a storey at a time)
```
Rules-tab entries L1–L3; the hover card names the landmark and its theme;
a ticker line when one rises: *"THE DAIRY — the Cudworths have made a
landmark of the west block."* The census counts landmarks; the Founders'
festival gate could require one (later).

## Why merge rather than a placed special

- A placed 3×3 (like the zoo) is a purchase; a merged one is an *earned*
  picture of who lives there — the "grow together" thesis made visible at
  the largest scale the map has.
- It reuses the growth rule, the fill gate and the depth key; the only new
  state is `landmark` (Uint8 theme id) and `part` (Int32 anchor index) per
  tile, both saved.
- The plain variants guarantee every zone can land a landmark; the themed
  ones reward the species mix without gating it (weights, never gates).

## The alternative, for the record

Player-placed 3×3 specials (§3,000–6,000) that *require* a species share
(Dairy needs cows ≥ 10%) — quicker to build (an op, a civic id, a sprite),
but it turns the species into unlock keys, and the block-merge already
gives the player a lever: zone High, keep it full, and watch.

## Cost

Sim ≈ 300 lines (merge/unmerge, capacity, rosters, events, save), art ≈ 10
box-solid descriptions (one agent round with a critic), renderer ≈ 20
lines (footprint 3×3 is already supported by `placeAt`), UI ≈ 30 lines,
suite: a landmark invariant (parts point at a live anchor, capacity never
exceeded, bulldoze clears nine). One session.

## Note (later the same day)

`docs/PROPOSAL-CRIME-AND-PUNISHMENT.md` proposes a fourth zone, M (meat
markets). List M as **no landmark** here — the abattoir (a 3×3 M block,
all tier 3, majority-carnivore staff) is a later theme on this same merge
rule, not a second rule.
