# Sprite upgrade — the flatness, the roofs, and the material vocabulary

**Proposed 2026-09-22 (session 21), on `4bb38b6`.** The owner: *"how would you
upgrade the sprites for animal city 2000?"* → *"you are greenlit to work on the
problems you identified. start with documentation so you have a list to cross
off as you go."*

This is that list. Every item carries where it lands, what it must not break,
and **the verification pre-registered before the work** — so an item is crossed
off by a number, not by a look. §4 is the checklist; everything above it is why
the list is in that order.

---

## §0 What was looked at

Not the source first. `node tools/shots.mjs --scene --zoom 2` regenerated
`docs/shots/scene.png` through `js/iso/painter.js` — the same file the browser
renderer sorts through — so the picture being judged is the picture the player
gets. (It came back 25 bytes different from the September 3rd copy: the checked-in
scene had gone stale behind the civics that landed since. The refreshed one is
this arc's BEFORE frame and is committed with this proposal.)

Then `js/art/solid.js`, `palette.js`, `architecture-detail.js`, `citizen-detail.js`,
`citizens.js`, `hires.js`, `js/iso/painter.js`, `js/render.js`, and the art gates
in `tools/check.mjs` Part C and `tools/check-closeups.mjs`.

### The baseline, measured

| | |
|---|---|
| sprites in `allSprites()` | **3,651** — 315 box-recipe, 73 ground-diamond, 3,263 with no recipe (2,726 of those citizens) |
| palette | **62 keys** — 12 ramps (52) + 10 accents |
| art receipt | `TOTAL 3651 b000b07f` · `PALETTE 62 keys dd798a15` |
| opaque pixels across the 315 box recipes | **1,634,087** |
| …that are a **TOP** face | **1,080,104 — 66.1%** |
| …**SIDE** (the +ty face, down-left) | 287,331 — 17.6% |
| …**END** (the +tx face, down-right) | 266,652 — 16.3% |
| sprites that cast a shadow | **0** |

The face shares are the shares the player sees: `tools/faceprobe.mjs`
re-renders every recipe with the three face functions replaced by marker
keys — the marker only where the real skin returned a key, so cut doorways
stay holes — and counts the winning key per pixel through the real z-buffer.
`stamps` are stripped: a sign or a yard tree is not a face, and leaving it in
credits its pixels to whichever face it covers. (The first reading, taken in
scratch with stamps passing through, said 66.0% of 1,621,148 — the definition
moved the number by a tenth of a point, which is the whole of the difference.)

---

## §1 The diagnosis

**D1 — Nothing casts.** `grep -rn -i shadow js/` returns nine hits and every
one of them is a comment: `litSkin` making an end face darker, `relight`
pulling a mirrored highlight back, the `+` accent described as the "universal
shadow mixer". Faces are *shaded*; nothing is *shadowed*. There is no cast
shadow and no contact darkening anywhere in the game. This is why a screen
full of correctly-projected boxes still reads as cardboard standing on a lawn,
and why the walkers look pasted onto the ground rather than standing on it.
It is the single largest visual deficit and it is **not** a hand-art problem —
`RECIPES` already holds every solid's boxes in world units, so the shadow is
computable from what is already there.

**D2 — Two thirds of the city is roof, and the roof is the least worked
surface.** 66.1% of every standing pixel is a top face. At 2:1 a 1×1 building's
roof is a whole diamond, and the bigger the footprint the more it dominates —
by family (`--family`):

| family | sprites | px | roof |
|---|---|---|---|
| `civic-cemetery` | 6 | 124,998 | **90%** |
| `civic-largePark` | 5 | 37,647 | **88%** |
| `civic-sanitation` | 3 | 29,827 | 82% |
| `I3x3-honey` / `I3x3-truffle` | 4 each | ~42,000 | 75% |
| `I3x3-the…` | 8 | 88,494 | 74% |
| `R3x3-the…` | 16 | 189,664 | 63% |
| `R3x3-towers` | 2 | 31,576 | 44% |

Almost every one of those roofs is a single flat slate or concrete quad with
at most one plant box. The industrial blocks and the civic campuses are very
nearly *nothing but* roof. Roofs are also what the player *actually* looks at,
because the game is played at zoom 1–2. The largest surface in the game is
carrying the least information per pixel. Only the towers — the one family
with a setback loop — get below half.

**D3 — One mass, many skins.** R, C and I are the same prism plus a roof slab;
they differ by material, not silhouette. The only place mass does any work is
the tower's setback loop (`js/art/buildings.js:229`). A city of one shape reads
as a city of one building.

**D4 — The material vocabulary is narrower than the ramp count suggests.**
62 keys, but every roof in the city is `slate` or `concrete`; there is no
roof-tile ramp, no timber distinct from soil-brown `earth`, no fabric. And
fourteen species share three fur ramps of four steps — which is why the light
coats (rabbit, mouse, cow) collapse into one pale blob at 1× while the dark
ones read.

---

## §2 The law this arc obeys

**a. The box law stands.** The upgrade is *more boxes and better skins*, never
a retreat to hand-drawn sheets. Everything in §4 that touches a building is a
recipe change or a skin function; nothing hand-draws a receding top face. The
`iso-solid-sprites` discipline is the reason the corners are right today and
the reason 315 shadows can be had in one function.

**b. Additive, not replacement.** New ramps are *added* keys; no existing key's
hex moves. New sprites are *new*; no family is redrawn out from under a saved
city. A saved tile byte selects the same plan it selected yesterday.

**c. Art cannot move a sim hash — but it can break five art gates.** `stateHash`
reads world state; the sprite a variant byte selects is not in it, so the mayor
rigs and the scripted city are not at risk from anything in this document.
What *is* at risk is the art audit. Written out, because each item in §4 has to
name which of these it touches:

| gate | where | what it demands |
|---|---|---|
| G1 palette validity | `check.mjs` Part C | every pixel a palette key; anchor inside the sprite; no ragged rows |
| G2 the prism gate | `check.mjs` Part C | **no box outside the footprint prism** — a solid emits nothing beyond its own tile column |
| G3 hires twin | `check.mjs` Part C | every solid/ground/citizen sprite **must have** a 2× twin, anchored on the same world point, ink within 12% of 4× |
| G4 silhouette identity | `check-closeups.mjs:33` | `ink(hires) === ink(plain)` **exactly**, at 2× and 4×; a citizen twin may never expand the silhouette (`old === "." ⇒ new === "."`) nor erode below 0.88 |
| G5 exact registry counts | `check.mjs:6332`, `:6325` | `allCitizens().length === 3236`; 504 portraits |

**G2 and G4 between them decide the shape of the whole arc:** a cast shadow
lies *outside* the footprint prism and *changes the ink*, so a shadow can never
be a box in a building's recipe. It has to be its own sprite, with its own tag,
drawn as its own painter item. Which is the right design anyway — it is how it
composites over ground the sprite cannot see.

---

## §3 The sequencing rule

**Tier 1 adds sprites and a render pass and changes no existing sprite by one
pixel. Tiers 2–3 change existing recipes.** So Tier 1 ships first: it is the
whole of the flatness complaint, and its regression surface is "did anything
that existed yesterday move?" — a question answerable by a dump-and-diff
(§6, I1), not by judgement.

---

**Whoever picks this up next: read `docs/HANDOFF-THE-SPRITES-2026-09-23.md`
first.** It is the standing brief for the art system — the laws, the
instruments, what is proven against what is a guess, the traps that are
classes, and a directed brief for Tiers 3 and 4. This file is the checklist.

## §4 THE LIST

Crossed off only when the verification named beside it has been *run* and its
number recorded in this file.

### Tier 1 — the flatness (hash-neutral: no existing sprite changes)

**BUILT — T1.1–T1.4 on 2026-09-22, T1.5 on 2026-09-23. The tier is closed.**
`tools/art-dump.mjs` on the finished tree:
**3,651 sprites and 74 palette keys, none moved** — the additive claim,
proven, not asserted, and the evening added nothing to it: the baseline
fixture is byte-identical either side of T1.5.
`tools/check-shadows.mjs` (**22 checks**) and `tools/check-dusk.mjs`
(**113**), both in `npm run check`.
The A/B is `docs/shots/sheet-shadows.png` (`tools/shadow-sheet.mjs`): one
town, one camera, one process, only the knob moving.

- [x] **T1.1 — `shadowSprite(recipe)`** → `js/art/shadow.js`. The geometry
  collapsed further than the proposal expected: because the shear runs along
  ONE axis and a box's a-range and c-range are independent intervals, the
  shadow of a box is not a hull or a silhouette walk but simply the ground
  rectangle `a ∈ [a0 + k·c0, a1 + k·c1], b ∈ [b0, b1]`. The union of those is
  the solid's shadow, and the z-buffer unions them for free. **315 of 315
  recipes cast**, one key, no empty masks.
  **Two claims in the proposal were wrong, and the pre-registered checks are
  what found them:**
  - *"at `k = 0` the shadow is exactly the footprint diamond"* — it is the
    **plan's own ground footprint**, which is the better answer: a house whose
    boxes span 14 of its tile's 16 units gets a 14-unit patch, not a full tile
    of shade.
  - *"ink is monotone in k"* — **it is not, and it should not be.** Three 3×3
    blocks failed that check (`C3x3-emporium-1`: 8,855 → 8,772 → 9,863) and
    they were right: a box starting **above** the ground (a roof slab, an
    overhang) begins its rectangle at `a0 + k·c0`, so as the light lowers its
    shadow slides OFF its own footprint, and where the walls beneath are inset
    nothing else covers what it leaves. Area dips, then grows. What is monotone
    is **reach** — every box's far edge is `a1 + k·c1`, `c1 ≥ 0` — and that is
    what the check now asserts, *conditionally on the geometry saying it must
    grow*, because the cemetery's reach is set by a low boundary wall at the
    front of the plot that the chapel behind never out-throws (32.0 / 32.0 /
    32.0 — correct, and it read as a failure until the check asked instead of
    assumed).
- [x] **T1.2 — drawn between `Z_GROUND` and the standing pass.** Two union
  passes: each paints its masks OPAQUE into a scratch canvas which is blitted
  once at its alpha, so two neighbouring buildings' overlapping shadows are a
  union at one density instead of a compounding smear. `item.alpha` was
  already honoured; the ground layer never rebuilds for a shadow.
  **The neutral knob is byte-exact:** `setShadows(false)` renders the frame
  the renderer rendered before any of this existed, and `--no-shadows` on
  `tools/play.mjs` shoots it, same sim hash (`3a90be53`), for the A/B.
- [x] **T1.3 — contact darkening** = the same mask at `k = 0` in the second
  pass. No new art, as designed.
- [x] **T1.4 — billboard contact ellipses** for citizens, trees and tents
  (`billboardShadow`), sized off each sprite's own width. **Not** composed into
  the pose: `allCitizens()` is still 3236, no citizen's rows changed, and no
  shadow sprite reaches `allSprites()`.
- [x] **T1.5 — dusk.** `js/art/dusk.js`, built 2026-09-23. **One table, and
  nothing drawn.** The evening is a key → key map through the same
  `rasterize(rows, tint)` door a species skin and the water's palette cycle
  already use, so the whole city changes and not one sprite is re-authored.
  **The receipt is that there is no receipt:** `docs/fixtures/art-baseline.txt`
  is byte-identical to the one Tier 2 left behind — 3,651 sprites, 74 keys,
  `TOTAL 86cc0399` — and the fixture does not appear in the diff at all. An
  evening that repaints every pixel in the game added no colour to it.
  `tools/check-dusk.mjs`, **113 checks**, in `npm run check`;
  **9 of 10 mutants caught**. The A/B is `docs/shots/sheet-dusk.png`
  (`tools/dusk-sheet.mjs`), and `tools/play.mjs --dusk` shoots it on a real
  mayor-built town — the same sim hash `86cc1587` either side, because an
  evening cannot move one.
  **The mechanism, which the proposal did not have:** `litSkin` has always
  given a ramp's bright rung to the TOP face and its dark rung to the END, so
  **the ramp index already says which way a surface points.** Warm the bright
  rungs toward a low sun and cool the dark ones toward the sky, and a table
  with no geometry in it lights the city from a direction. Each key's evening
  colour is then projected onto the nearest key the palette already has —
  found, not authored — with a 60% toll on leaving its own ramp, which is
  what keeps terracotta terracotta (`BCDE → 1BCD`) instead of trading it for
  rust over a rounding error. 36 of the 64 surface keys stay home.
  **Three claims broke on the palette, and the measurements are why:**
  - *"every ramp a rung cooler"* is only half of it. The palette's floor is
    PINNED — `check-shadows` holds `+` within 3 of it, so nothing may sit
    below slate without breaking the shadow's claim on being a near-black —
    and an evening that took its darkness out of VALUE ran every shadow-side
    face in the game onto the same key: measured, the fifteen ramps' dark
    rungs land on **four keys between them**. So the dim is a fifth, the cool
    is two thirds, and the rest of the darkness comes from the shadows, which
    is where a low sun actually puts it: dusk MULTIPLIES `SHADOW_K` (×3.2)
    rather than setting it, so Q1 still owns the length.
    **A `night` ramp was built for this and then taken out again**, which is
    the measurement worth keeping. Four cool darks for the shadow sides to
    land on; 12 keys did land on them; rendered both ways it was worth **0.1
    of a luminance point** and nothing the eye could find, and the rung-0
    collapse was **four destinations either way** — because what starves the
    dark end is the floor, not the hues available at it. Four permanent keys
    for that is a guess with a consumer, which is still a guess.
  - *"the ground is never brighter than the same key standing up"* is false,
    and it is false of the transform before any projection. The sky is a
    light source with a luminance of its own (65.3), so a key darker than the
    sky GAINS by seeing more of it — which is what a blue hour does. Three
    keys do it. The claim that holds is about the mean.
  - *the monotone floor* — a lower bound carried down each ramp so its image
    could not invert — **never fired once** over 100 amounts × both tables ×
    6,000 adjacent pairs, and a mutant deleting it left the suite green. It
    is gone: a constraint that silently straightens a ramp the transform bent
    hides a bad transform, where the check that asks names it.
  **And the knob is not smooth, which is the finding that decides the UI.**
  A ramp's rungs are ~25 luminance apart, so a middling amount moves the keys
  near a boundary and leaves the rest at noon: **5 of 64 keys move at 0.1, 42
  at 0.4, 67 at 1.0**, and between 0.4 and 0.7 only 11–20 are still in their
  own ramp — a half-lit town with one roof lit up like a lamp. The middle
  panels of the sheet are that, on purpose. **There is one coherent setting
  and it ships as one switch.**

**Measured** (`docs/shots/sheet-shadows.png`, 420×300 panels at zoom 2, px
changed against the no-shadow frame): k=0 **0.77%** · k=0.25 **4.12%** ·
k=0.55 **7.96%** · k=1.2 **10.30%**.

**Measured** (`docs/shots/sheet-dusk.png`, 620×320 panels at zoom 2, against
the daylight frame): amount 0.25 **29.9%** of the panel, mean luminance
−2.8 · 0.55 **98.3%**, −24.8 · **1 — 98.7%, −45.3**. The ground layer takes
its own, deeper table (the renderer knows the horizontal plane even where the
index cannot): lawn and road fall one rung further than the walls beside
them, which is the difference between an evening and an overcast afternoon.

### Tier 2 — material vocabulary (adds keys; existing keys untouched)

- [x] **T2.1 — three new ramps, not four:** `tile` (terracotta roof, `BCDE`),
  `timber` (`LMNO`, real wood instead of the soil-brown `earth` that has been
  standing in for it) and `fabric` (`PQRS`, awning cloth and washing).
  **`furDark` is deferred to T4**, where the citizens that need it live: a
  ramp with no consumer is a guess, and its consumer is two tiers away.
  **The receipt says exactly what an additive palette commit must say:**
  `ADDED 12` keys, `MOVED 1: PALETTE` — that one being the key-count header —
  and **no sprite and no existing key moved.**
  That claim is only checkable because `art-dump` now writes **one line per
  key** instead of one hash for the palette: a single hash says the palette
  moved and cannot say *which* key, and "no existing key's hex changed" is
  precisely a per-key question.
  *Constraint found while choosing the colours:* `check-shadows` pins the
  shadow key as a near-black within 3 of the palette's **luminance floor**
  (slate `<` 37.7, `+` 38.4). A new ramp whose dark rung undercuts that moves
  the floor and breaks the shadow's claim on it, so the three bottom out at
  44.1 / 54.1 / 69.1 — recorded in `palette.js` beside them.
- [x] **T2.2 — zone-legible roofs.** R terracotta · C light concrete cap ·
  I rust · M dark slate. Routed through one table (`ROOF_OF` in
  `buildings.js`) that reaches all three places roofs are built: the six base
  families, `building-plans.js`'s `cap()` helper — already the single choke
  point for all twenty-four authored variants — and `blocks.js` (its
  `hipRoof` now takes a skin, and the generic `newBlock` reads `ROOF_OF[zone]`).
  The factory's sawtooth went rust too: it *is* that building's roof, and a
  works read grey from the air like everything else. Civics keep slate on
  purpose — grey now means *civic* rather than *everything*.
  **Measured: 84 sprites moved and NOT ONE changed its ink** — the whole of
  R/I/M at 1×1 (six variants each), the R/I/M blocks, and the two C families
  whose upper steps had been slate on a concrete building. A recolour that
  altered one pixel of coverage would be a different change than the one
  claimed, and the per-sprite ink column is what proves it did not.
  **The top-face share is unmoved at 66.1%**, exactly as predicted — this item
  is colour, and T2.3 is the one that must move that number.
- [x] **T2.3 — roof furniture.** `js/art/roof-furniture.js`. Parapet rails,
  stair heads and plant rooms, vents, a water tank on legs for I, extractor
  stacks for M, washing on a line for R (which is what `fabric` was added
  for), and the grey rail-plus-vent kit for the civic campuses.

  **IT IS FOUND, NOT PLACED.** Hand-placing furniture on 315 recipes is 315
  chances to put a tank through a roof. `decksOf` reads the boxes a recipe
  already has and returns the top faces EXPOSED TO THE SKY; the furniture is
  laid on those, so a family that changes shape keeps its furniture. The idea
  is `building-character.js`'s — `socketsFor` already asks the z-buffer for a
  building's most visible roof point, which is how the occupancy lights and
  species stamps find their spot — widened from one point to every deck.

  *A rail belongs on a flat roof, not a pitched one.* The first pass railed
  every deck ≥ 6×6 and the hipped R roofs — a stepped slope IS four inset
  decks — came out as **concentric bullseyes on every house in the scene**. A
  step of a pitch carries the next step on ~77% of its area; a flat roof
  carries a plant box on a few per cent. `coveredShare < 0.35` is that
  difference, and no family has to declare itself.

  **Applied to all four zones at 1×1, the 2×2/3×3 blocks, and the civics.**
  The blocks were not optional: they run 53–75% top face against a 1×1's
  24–60%, so furnishing the small families and stopping would have left the
  biggest roofs in the game bare. Civics keep grey — shape, not hue.

  **Measured.** Aggregate **TOP 66.1% → 63.4%**. But the headline share is a
  poor reading of this work and it is worth saying so: *a parapet's cap is
  itself a top face*, so railing every flat roof in the game moved it four
  tenths of a point before the blocks and civics were added. What D2 actually
  complained about was the roof being **one undifferentiated quad**, so
  `faceprobe` now also reports the **bare share** — of a building's roof
  pixels, how many belong to its single biggest flat plane. On the families
  the work reached, both move properly:

  | family | roof | bare quad |
  |---|---|---|
  | `C2-store` | 42% → 38% | **77% → 56%** |
  | `I1-shed` | 61% → 54% | **68% → 44%** |
  | `M1-stall` | 69% → 58% | **62% → 38%** |
  | `C3-tower` | 27% → 24% | **55% → 33%** |
  | `M3-cold-store` | 39% → 36% | **55% → 39%** |
  | `I3-works` | 37% → 33% | **61% → 43%** |
  | `R3-apartment` | 37% → 35% | 43% → 36% |
  | `R1-cottage` | 65% → 60% | 22% → 23% *(a pitch, correctly unrailed)* |

  The aggregate bare share barely moves (43.8% → 43.0%) because most of the
  315 recipes — the cemetery's grave plots, the shops, the landmarks — have
  no deck wide enough to furnish at all. That is a fact about the aggregate,
  not about the roofs that changed, and the before/after was taken on a git
  worktree of the previous tip with the *same* instrument copied in.

  **And the furniture casts.** The shadow pass went from 9,640 to 9,748 px on
  the same frame without a line of shadow code being touched — a rail and a
  tank are boxes, and the shadow was built from the boxes.

### Tier 3 — the living city

**TIER 3 IS BUILT — T3.1, T3.2 and T3.3, 2026-09-23.** For T3.1, `tools/art-dump.mjs` on the finished tree:
**3,651 sprites and 74 palette keys, none moved** — a window state adds no
colour, the same claim T1.5 made and for the same reason: everything a pane
can hold was already in the palette.
The A/B is `docs/shots/sheet-windows.png` (`tools/window-sheet.mjs`).

- [x] **T3.1 — window states** in the `glazing` skin. `characterSprite` turned
  a glass key into the lit key when `cell < lit`; it now returns what the pane
  HOLDS, from a small table keyed on the cell, the light and the age — a drawn
  blind, a plant in the window, a boarded pane on a building old enough to
  have lost one. Nothing hand-draws anything: it is still one return in one
  face function, on the same 2×3 grid of world-unit cells the lights have used
  since People E.

  **THE APERTURE MEASUREMENT CAME FIRST AND IT DECIDED THE SHAPE OF EVERY
  STATE.** Over the 192 glazed plans there are **17,473 window cells that
  carry glass**, and a cell is on median **only a third glass** (2.0 of 6
  world units²). Which third varies — **15.8% hold glass in the bottom third
  only, 12.2% in the top third only** — and no horizontal slice of a cell is
  favoured by more than three points. So a state that paints a fixed
  sub-rectangle of the CELL paints nothing at all on a sixth of the city and
  covers everything on another eighth. A state is therefore either
  **whole-cell** — the blind and the board — or it is **found from the
  aperture** by probing the skin underneath, which is the `edgeV` move
  `architecture-detail.js` already makes to find its sills. Only the plant
  needs it.

  **The blind is geometry and a dither, not a new colour.** Fabric — T2.1's
  third ramp, worn until now only by awnings — with its slats a rung apart.
  The slat period is deliberately **sub-pixel at 1×**: it dithers two adjacent
  rungs into one warm mass at the zoom the game is played at and opens into
  slats at 2× and 4×. A LIT blind alternates the lit key with pale fabric, and
  the measurement is the nicest accident in the item: `-` is 193.9 luminance
  and `S` is 189.1, so **by day they are 4.8 apart and the blind barely reads
  — and at dusk `-` is a fixed point while `S` is projected onto `R` at 144.5,
  so the gap opens to 49.4 and the slats come out.** The one state that hides
  at noon and shows at nightfall, which is what a backlit venetian blind does.

  **A fixture needs an occupant** (`lit >= 1`); a board needs age. An empty
  building has bare glass, which is both right and what keeps
  `characterSprite(base, { majority })` changing nothing outside its species
  socket.

  **THE FIXTURE HASH WAS A FUNCTION OF THE LIGHTING HASH AND SEVEN CHECKS
  WERE GREEN OVER IT.** The lights pick a cell with `(3cu + ck + phase) & 3`; the
  fixtures were given `(5cu + 11ck + 7phase + 3) & 15`, chosen because (5, 11)
  is not a multiple of (3, 1). It does not have to be: **5 ≡ 1 and 11 ≡ 3 mod
  4** make the second form exactly `3·cell + 3 mod 4`. Any linear form mod 16
  reduces to a linear form mod 4, and two of those lock together on a
  coincidence you cannot see by reading them. Measured, it meant **cell class 1
  could never carry a blind and classes 2 and 3 could never carry a plant**,
  and the backlit cloth on a facade **did not move when the building filled
  up** — 11,690 px at lit 1 and 11,690 at lit 2. Both hashes are now the
  avalanche `hash` the terrain already uses; over 2,560 cells every (cell,
  fixture) pair is populated within 10%. The board's own hand-rolled form was
  biased the same way, more mildly — it boarded **21.4% of plant cells against
  16.6% of plain ones** — and went the same way.

  **The check written to catch that did not, and three read off the OUTPUT
  replace it.** The first form asked only whether backlit and shaded cloth
  both appear, which stayed true while the hashes were locked — blinds were
  spread over three of the four cell classes, just never the same three as the
  plants. An existence test cannot see a lock. Now: *filling a building
  backlights more of its cloth and shades less* (the frozen number is the
  tell); *every fixture turns up behind a lit pane and a dark one at every
  light level* (under the lock there was not one unlit plant in the city at
  lit 3); and *ageing a building costs it lit panes, blinds and plants alike*,
  which fails if the board hash shares structure with anything.

  **Two things were measured out.** The plant had a **pot** and it is gone:
  earth under the leaves is 14 px of a facade's 54 at 4×, and
  `architecture-detail`'s sill claims the bottom 0.28 of every aperture, so
  nearly all of it was invisible — while at 1× the count inverts and a window
  plant read as a BROWN pixel, the one colour on a brick wall that says
  nothing. (The same move as the evening's `night` ramp.) And the plant's
  downward probe **needed a second one looking up**: the owl landmark's perch
  windows are 0.8 units tall, so a 1.4-unit band swallowed them whole, and *a
  window plant sits in a pane and never swallows it* is a check that found
  real art rather than a bad claim.

  **The detail pass had to be told what an aperture is.** It runs OVER the
  character pass at 2× and 4×, and draws its jambs and sills wherever the ink
  is a glass key — so a blinded pane read as wall and lost its frame. The
  character pass now hangs an `aperture` function on each glazing box saying
  where the BARE skin's glass ran; a recipe that never went through that pass
  has none and falls back to the ink, which is why the 1× dump and the
  close-up fixtures do not move. It answers about the bare skin and never
  about what the pass painted — ask the wrapper and a blind widens its own
  aperture one probe at a time.

- [x] **T3.2 — setbacks and awnings** on R/C mid-tiers, so the skyline has
  profile (D3). Recipe boxes; the tower already shows the pattern.

  **BUILT 2026-09-23.** `tools/art-dump.mjs` on the finished tree: **eight
  sprites moved and nothing else** — four plans and their mirrors — and the
  PALETTE line did not: no new colour. `TOTAL 86cc0399` → `f910d9fe`. The
  picture is `docs/shots/sheet-skyline.png` (`tools/skyline-sheet.mjs`); the
  number is `tools/massprobe.mjs`, which is passive, like faceprobe. The
  before/after is `docs/shots/skyline-before-after.png` — the same block and
  camera through the real renderer, the committed tree on the left (a detached
  worktree at `4a60a99`, in the same process) and T3.2 on the right, zoom 1
  magnified 2× above and zoom 2 below. It cannot be redrawn from this tree:
  once a recipe changes, the only before there is lives in the history.

  **THE MEASUREMENT SET THE SCOPE, AND IT RE-READ "MID-TIERS".** `massprobe`
  asks two things of a plan: how much of its glazed mass fills its bounding
  prism (`fill`, 1.00 is one box) and how much of the sprite at zoom 1 is a
  deck standing between the street and the top (`deck`). Over the twenty-four
  R and C plans at tiers 2 and 3, **exactly four were one box with a lid — the
  ORIGINAL two-storey, apartment, store and tower, from session 1 — and their
  mirrors:** fill 1.00, deck 0.0–5.3% (the 5.3 is the apartment's balcony
  slats). Every plan authored later already stepped (medians 0.715 and 16%),
  bar one: the store family's skylight market is flat-fronted and carries an
  awning, and was left as the family's one. A third of every mid- and
  high-rise lot draws one of the eight. The list said "mid-tiers"; two of the
  four are tier 3, and they are the TALLEST prisms on the skyline, so they are
  in. (The works, `I3` plans 0/1, is also one box. T3.2 names R and C, and the
  works reads by its stack; recorded, not fixed.)

  | plan | before · fill, deck | after | what it became |
  |---|---|---|---|
  | two-storey | 1.00 · 0.0% | 0.83 · 18.1% | the upper storey 2.5 units back under its hip; a terracotta porch roof in two courses round both street faces |
  | apartment | 1.00 · 5.3% | 0.84 · 12.8% | two storeys on the whole plot, and above them the front corner is an 8×8 terrace with a balustrade and a planter, the upper storeys an L round it |
  | store | 1.00 · 0.0% | 0.83 · 19.4% | a glass shop floor under a canvas awning on both street faces, the ribbon-windowed storeys 2 units back behind a terrace |
  | tower | 1.00 · 0.0% | 0.67 · 12.4% | a lobby podium of glass filling the plot, the shaft 3 units clear of both street faces |

  City-wide, **51 of the 192 zoned plans were one box → 43**, and the eight are
  the only ones that moved. The 43 are tier-1 shops and cottages, the
  industrial sheds and works and the meat stalls: outside T3.2, and now a list
  anyone can print (`node tools/massprobe.mjs`).

  **Every step is taken on BOTH street faces.** `flipPlan` mirrors the boxes
  and not the skins, so a setback or an awning on one face alone lands on the
  doorless face in variant 1 — the meat hall's annex trap. **And size on screen
  set the depths:** a setback of s units shows at zoom 1 as a band 2s px tall,
  so 2 units is the least that reads as a STEP rather than a stripe.

  **AN AWNING OVER A DOOR EATS THE DOOR, and the pre-registered door count
  caught it.** An awning d units deep hides the wall under it for 2d units —
  the stall's lesson, again — so the first draft's canopies took the store's
  door from 36 px to 15 and the tower's to 9. The store's awning now stops
  short of its door bay, and FURTHER on the far side than the near one: on
  screen the awning is sheared, its lip standing d units nearer along b, so
  its far end reaches d units of a further left than where it meets the wall.
  The tower lost its canopies; its podium is its street, and every door is
  back to its baseline in both mirrors.

  **The pre-registered bar caught my own metric.** `fill` first counted the
  roof slab a setback stands on as empty space, which flattered any plan that
  sandwiches a cap between two storeys: the apartment passed at 0.848 that way
  and failed at 0.875 honestly. The metric was fixed — occupied layers only —
  every plan re-read, and the apartment's terrace grown from 7×7 to 8×8 units
  (0.84), rather than the bar moved.

  **The roof furniture cannot see a terrace, measured.** The standing brief
  flagged `coveredShare < 0.35` in `roof-furniture.js` as a guess a new roof
  shape could land between. Over every deck in the game, a TERRACE (a storey
  standing on it) is covered 0.22–1.24, median 0.63, and a PITCH STEP
  0.35–1.73, median 0.65 — the same number. So the apartment's balustrade is
  in its plan, drawn as architecture, and the rule is recorded as a class
  question for roof-furniture.js rather than changed here: changing it moves
  every setback in the game, and sawtooth teeth and ground plinths muddy "what
  stands on it".

  **Two fixtures were repaired first, each in a commit of its own, so this one
  can be read.** `check-dusk`'s four "open-lawn samples" were three parts
  building, river and tree, and passed because nearly every key changes at
  dusk — until the stepped apartment put a lit window on one (`b39866c`); and
  `sheet-shadows` / `sheet-dusk` had not been drawn since before T3.1
  (`c61920c`).
- [x] **T3.3 — ground:** more grass variants, scatter keyed off tile index,
  worn paths where walkers cross grass. The tiling repeat is visible at zoom 2.
  **BUILT 2026-09-23 — and measured first, which re-read two of its four
  clauses.** The picture is `docs/shots/sheet-ground.png`
  (`tools/ground-sheet.mjs`); the before/after is
  `docs/shots/ground-before-after.png`, the same field and town through the
  previous tip and this one in one process.

  **What the eye counted was not a repeat but a QUILT.** The three grasses are
  three brightnesses — tile means 117.5 / 122.8 / 112.6 luma at 1× — and each
  was exactly one tile, chosen by `variant % 3`: an open field was a
  patchwork of diamonds. `tools/groundprobe.mjs` measures it off the
  renderer's own frame as the step in mean luma across a tile edge over the
  step across a line through a tile. The repeat was real too, and second.

  | open field (`groundprobe --cams 7`) | seam, zoom 1 · 2 · 4 | repeat, zoom 1 · 2 (pts) |
  |---|---|---|
  | the quilt, before | 2.46 · 3.80 · 5.13 | 13.6 · 13.5 |
  | **the meadow** | **0.96 · 0.99 · 1.01** | **4.9 · 4.7** |
  | a control that cannot have a seam (the floor) | 0.96 · 0.99 · 1.16 | 4.0 · 3.7 |

  **THE GRASS IS KEYED OFF ITS CORNERS, NOT ITS TILE.** Three levels — kept,
  meadow, rough, which ARE grass-0, -1 and -2 — live on the tile vertices, and
  a tile draws its four corner levels interpolated across the diamond. Two
  tiles that share an edge share its corners, so the grass cannot change at
  the edge. `js/meadow.js` reads the corners off the world and writes
  nothing: kept wherever anything made touches a corner; elsewhere the mean of
  the tile bytes over the 6×6 round it, in thirds; a rough corner beside a kept
  one steps down to meadow, so no tile holds both and 31 of the 81
  combinations are all there is to draw. Each is drawn in six dithers, so a
  patch is not one tile repeated. **186 tiles, 183 of them new** — the three
  uniform seed-0 ones ARE grass-0/1/2, pixel for pixel. `art-dump` after the
  meadow: 3,834 sprites, none moved, the palette line untouched, no key but
  m n o p; after the footpaths below, 3,864.

  **"More grass variants"** is those 183. **"Scatter keyed off tile index"**:
  the tile index keys the ground twice — the corner levels (the mean of the
  tile bytes round each corner) and the dither (the tile's own byte, mod 6) —
  and NO scatter of objects was built: at zoom 1 a flower or a stone is one
  pixel of a key that is not grass, which is speckle, and every such key on
  the ground already means something (a chalk line, rubble, a zot). Open.

  **"Worn paths where walkers cross grass" — built, after I first wrote that
  nobody does.** Reading `walkers.js` alone, every walk is a `roadSearch` over
  road tiles, and that was the draft's claim. It was wrong: a commuter walks
  the SIM's stored path, and `fields.js` lays a station's FORECOURT — the
  tiles between a platform and the road that serves it — into that path one
  step at a time, and `world.traffic` already counts those steps (`check.mjs`
  has asserted it since Part R: "the four grass tiles crossed are in it").
  That is the one place a walk crosses grass. `wornPaths(world)`
  (`js/meadow.js`) reads the steps off the stored paths themselves — which
  neighbour each walked tile was entered from and left towards, and how many
  times — and `art.footpath(mask, worn)` overlays an earth track from the
  tile's centre to the middle of each walked edge, bowed a little so it reads
  as a desire line, trodden below four walks and worn bare from four. 30
  sprites, none moved. **How often:** the scripted mayor never lays track, so
  no scripted town wears a path; a player's station set back from its road
  wears one or two tiles at each end. The gate holds it to the sim's own
  traffic count, walk for walk, and to the frame pixel for pixel on either
  side of the threshold. **The suite's twin gate refused the first version**:
  a trodden path is thin and sparse, its dither was drawn per pixel, and the
  2× twin of `path-SW-trodden` came out 19% light against the 12% the hi-res
  gate allows. Which pixels are earth is decided world-sized now and only the
  grain per pixel (the worst twin 3.0% off), and the ground gate holds it
  directly: a path is the same path at every zoom.

  **The pre-registered seam bar indicted its own metric first.** The first
  measurement compared the edge against ONE fixed pair of strips inside the
  tile, and a control that cannot have a seam (every corner kept, the dithers
  random) read 1.71 at zoom 2: with six dither patterns, one fixed pair reads
  the patterns, not the seam. The baseline became every interior line, in
  both edge directions, and every state was re-read with it — the quilt, the
  meadow and the control — before any bar was applied. **And the repeat bar
  indicted the design:** four dithers read 6.4 / 6.5 against a pre-registered
  ≤ 6, so the design went to six dithers (4.9 / 5.0) and the bar did not move.

  **Measured, the costs:** the ground-layer rebuild 9.5 → 9.6 ms at zoom 1,
  16.5 → 16.6 at zoom 2, within the rig's noise (the corner field is one pass
  over (w + 1)·(h + 1) corners with an integral image); the art registry's
  import is within its noise; the corner field costs 0.41 ms and the path
  reader 0.13 ms a call on a 1,599-citizen town. **The gate is
  `tools/check-ground.mjs`, 51 checks, 24 of 24 mutants killed** — including
  the one that matters most: at zoom 1 every open tile in the frame is, pixel
  for pixel, the sprite its own corners and byte name, so
  a renderer that asked for the wrong tile's corners, ignored the byte or
  keyed the grass off the tile again goes red. Only the frame's seam reading
  caught a transposed interpolation (1.56 against the 1.3 bar).

  **`check-dusk`'s measured lawn shrank and stayed honest.** Its lawn is where
  the full city and the empty one agree; kept grass beside a building now
  differs from the empty map's meadow, so it is left out rather than failed:
  6,095 → 5,616 px, still 11× the check's floor of 500.

  **A picture was stale, and one of the causes was T3.2.** Base rate first, on
  a worktree of the previous tip: `docs/shots/building-variants/` had not been
  drawn since T1 put shadows under the city (`8bccb62`) — its tool is not a
  sheet tool, and neither sheet refresh ran it — and `scene.png` not since
  T3.2, which never ran `shots.mjs`. Regenerated on the unchanged art in a
  commit of their own (`e2ace35`). `shots.mjs` now lays the scene's, the
  blocks', the landmarks' and the road network's grass through the same
  corner field, so the arc's judged frame shows the ground the game draws.

  **Verified on the deployed Pages build** (`692b2b3` the meadow, `a416748`
  the paths), the preview slots all being held by other chats: 3,864 sprites,
  and six of them hash as `art-dump` says; in the browser's own canvas at
  zoom 2 the open field's seam reads 0.95 against the control's 0.99 and the
  old quilt's 3.69; the forecourt wears 614 px of earth at three riders and
  1,590 at six. No console errors; no city entered.

### Tier 4 — the animals

- [x] **T4.0 — fourteen coats** (added to the list 2026-09-23; the standing
  brief: *"the number to start from… a cheaper fix than any of the art
  below"*). **BUILT, `b72bea7` · `a2dc8ea` · `bfb93e8`, handoff §48.**
  Measured first, by an instrument built for it — `tools/zooprobe.mjs` pulls
  each animal apart into its FORM (the figure in one coat, against one animal
  mid-stride) and its COAT (against one animal one rung darker):

  | | before | after |
  |---|---|---|
  | distinct coats | **7** (the brief said 8: the tortoise wore the fox's) | **14** |
  | ONE ANIMAL | beaver/bear (FORM 4.0 under 5.7, COAT 0.0) | 0 |
  | close figures on one ramp | 9 | 0 |
  | FLAT in a look — lit and shaded body on one key | 5 (half of each; 18% of citizen sprites) | 0 |
  | LOST — lit rung nearer the ground than the olive tortoise's 9.8 | 4 (the dark greys 4.0 from the road) | 0 (least 15.5) |

  The coat table moved from the sim's roster into the kit (`COATS`, byte for
  byte first), and every new coat is from a ramp the palette had: **no key
  added** — `furDark` was built, its keys were within ΔE 4.2 of existing ones
  and it re-mapped seven keys of existing art at dusk, so it was taken out.
  **2,774 sprites moved**, all animals of the twelve species whose coat
  changed, none in size, anchor or ink; the palette line untouched. The gate
  is `tools/check-animals.mjs` (15 checks; the pre-T4 table read in the same
  run as a control that must fail exactly as measured; 15/15 fault mutants by
  aim and one neutral that passes). On the way: **the 2× pass had never
  reworked the hawk's fur** (0.0% — it found fur by ramp, and the hawk is
  `earth`) nor the tortoise's (2.4% — its outline meant no edge ever fired);
  it now asks the composer, and `check-closeups` asks how much FUR changed.
  The suite caught one regression — an elder beaver's marked portrait lost
  its mark to a clamp at the top of the ramp — fixed before the commit.
  **Not done by T4.0, and measured for T4.2:** bear/pig (FORM 3.5) and
  beaver/bear (4.0) are one animal in two coats — the coats keep them apart,
  the figures do not.
- [ ] **T4.1 — authored 2× heads per species.** The head is the ID mark; leave
  the body procedural. `citizen-detail.js` today is generic chamfering — and,
  since T4.0, it is handed the composer's figure (`CITIZEN_DETAILS.authored`).
- [x] **T4.2 — a third body build and species idles.** Two builds × fourteen
  species is why they read as one animal in fourteen coats. **The idles
  exist** (`2fcfe8e`, PEOPLE D, 2026-09-03 — fourteen species-specific pauses;
  this line was written without them). **BUILT, `01cf866` · `4ea9e5e`,
  handoff §49.** Measured first: the big build carried four figures the eye
  could not split without the fur, and the beaver and the pig stood 1.08
  strides apart in coats too alike to split. One new body cannot part three
  animals that must each stand apart, so the pig wears a third build —
  `stout`, a barrel on thin legs, the belly out on the side it faces and the
  back flat so its tail still shows — and the beaver wears the small one,
  where its paddle shows facing SE for the first time:

  | pair | FORM before → after | strides |
  |---|---|---|
  | bear / pig | 3.5 → 10.4 | 0.62 → 1.69 |
  | beaver / bear | 4.0 → 14.0 | 0.71 → 2.46 |
  | beaver / pig | 5.9 → 14.6 | 1.08 → 2.37 |
  | pig / wolf | 6.9 → 12.9 | 1.28 → 2.10 |
  | beaver / wolf | 7.1 → 16.2 | 1.55 → 3.34 |
  | bear / wolf | 6.7 | 1.18 — both big; coats 2.1 shade floors apart |

  The instrument first, with no sprite moving: the build table exported
  (`BUILDS`) and an instrument's hook (`opts.build`) so zooprobe draws the old
  bodies through the kit's own composer — T4.0's control is read on the bodies
  it was measured on, T4.2's in the same run. The gate
  (`tools/check-animals.mjs`, 15 → 21 checks): no two figures closer than a
  stride; where two coats are too alike to split, figures 1.4 strides apart
  (the rabbit and the mouse, 1.48, the witness the bar sits under); only the
  beaver and the pig moved. **256 sprites moved**, the beaver's and the pig's
  adults and elders, none in size or anchor; no cub, portrait or colour. On
  the way: T4.0's check that FORM ignores the coat compared two readings of
  the same sprites and could not fail — replaced by the property (standing
  brief, trap 18).

---

## §5 Open — the owner's calls

Only the genuinely undecided; everything else is decided above.

- **Q1 — how long is the shadow?** `SHADOW_K` spans the whole range: `0` is a
  contact diamond that never crosses a road; `0.5` puts a 48-unit tower's
  shadow ~1.5 tiles down-right, across the street, SimCity 4 style. I will
  build the knob and render the same scene at 0, 0.25 and 0.5 for the choice.
  **Still open, and T1.5 did not close it:** the evening MULTIPLIES this
  number (×3.2 at full amount) rather than setting one of its own, so
  whatever length is chosen here is the length dusk lengthens.
- ~~**Q2 — is dusk a mode or a clock?**~~ **ANSWERED by the sim, 2026-09-23:
  a mode, and the reason is that there is no clock to tie it to.** A tick in
  this game is a MONTH (`js/sim/tick.js`), so the only clock available would
  make dusk a SEASON — a different feature with a different name, and one
  that would take the city dark for three months of play. It ships as both of
  the other two, because they are the same switch: an Options checkbox beside
  the cheat, and `/` to flip it without opening a menu. It is **this
  browser's preference** (`zoo.pref`) and not the city's, for the same reason
  the cheat switch is — it changes nothing a save records, and a city sent to
  someone else must not arrive at nightfall because the sender liked it that
  way. The amount survives as a parameter in `duskTable(amount)`, so if the
  game ever grows an hour, the clock feeds it a fraction.
- **Q3 — terracotta on R is a big look change.** It is the single most
  effective way to read zoning from the air, and it moves the town's whole
  colour. Worth one A/B frame before it is kept.

---

## §6 Instruments (built before the work they check)

- [x] **I1 — `tools/art-dump.mjs` — THE GATE.** One line per sprite
  (`name · w×h · anchor · ink · hash8`) in `docs/fixtures/art-baseline.txt`,
  plus a `PALETTE` line hashing key→hex, plus a `TOTAL`. Drift is **exit 1**,
  so a deliberate art change carries its re-baselined receipt in the same
  commit and the diff says which families moved. It is now the first step of
  `npm run check`. This is what makes "Tier 1 changes nothing that existed"
  a number instead of a claim.
  **Baselined on `4bb38b6`: 3,651 sprites, `TOTAL 3651 b000b07f`,
  `PALETTE 62 keys dd798a15`** (192 KB).
  **Falsified — it can fail, and it catches the class row-hashing alone would
  miss:** one pixel flipped in a shared citizen body row → **512 sprites named
  MOVED, exit 1**; one hex digit in grass mid `#74863C` → `#74863D`, which
  changes no row in the tree and every pixel on screen → **`MOVED 1: PALETTE`,
  exit 1**; reverted tree → exit 0. (First run of that falsifier read `exit=0`
  because the status came through a `| head` — the pipe's, not node's. Measured
  again without the pipe.)
- [x] **I2 — `tools/faceprobe.mjs` — a PASSIVE INSTRUMENT, not a gate.** It
  refuses nothing; it gives D2 a number so that "the roofs are bare" and "the
  roofs are no longer bare" are both readings. `--family` and `--top N`.
  **Baselined: 315 recipes, 1,634,087 px, TOP 66.1%** (§0, §1 D2).
  T2.3 is crossed off by that share **falling**.
- [x] **I3 — the before/after sheet — `tools/shadow-sheet.mjs`.** One town,
  one camera, one process: the left panel is the renderer with shadows OFF,
  each panel right of it the SAME frame at a different `SHADOW_K`, with the
  changed-pixel count printed under each. `docs/shots/sheet-shadows.png`.
  `tools/play.mjs` also takes `--no-shadows` and `--shadow-k N`, so the A/B
  can be shot on a real mayor-built town at the same sim hash.
  **The dusk half landed 2026-09-23** — `tools/dusk-sheet.mjs` →
  `docs/shots/sheet-dusk.png`, same rig, the knob being the amount of
  evening, with the mean luminance of each panel printed under it; and
  `tools/play.mjs --dusk`, which shot the same scripted city at the same hash
  `86cc1587` by day and at dusk. A bare `--dusk` is the shipped amount:
  written out rather than reusing the shared `num()` helper, which takes the
  next token whatever it is and read `--out` as the amount, made NaN, and
  clamped silently back to daylight. A flag that quietly does nothing is
  worse than one that fails.
- [x] **I4 — `tools/check-shadows.mjs` — the gate, 22 checks**, in
  `npm run check`. **Mutation-tested, 5/5 caught, and the first round found
  two real gaps in it:** shadows-off-by-default survived (every other check
  turned them on explicitly — a game shipping with the pass switched off is
  the exact regression this arc is about), and re-pointing `SHADOW_KEY` at
  asphalt-dark `1` survived because "every pixel is `SHADOW_KEY`" compares the
  constant with itself and passes whatever it is set to. Both closed: a fresh
  renderer is asserted to have them on, and the key is asserted to be a
  **near-black** — within 3 of the palette's luminance floor, which separates
  the two near-blacks from asphalt's 44.1 while not over-claiming "darkest"
  (slate `<` at 37.7 is a hair under `+` at 38.4).
  The mutant that matters — **painting the shadows after the standing pass** —
  is caught with 3,122 of 9,117 building pixels gone to the shadow colour.

- [x] **I5 — `tools/check-dusk.mjs` — the gate, 113 checks**, in
  `npm run check`. **Mutation-tested, 9 of 10 caught**, and the first round
  found four real gaps in it:
  - the composition law was checked on `withDusk` and not on the RENDERER, so
    a renderer that handed the evening over in PLACE of the item's own tint
    passed. Closed by a river: the water palette-cycles through six frames,
    and under that mutant it freezes at nightfall. (The check world grew a
    river for it.)
  - the fixed-point check iterated the module's own `FIXED`, so dropping the
    lit window from that list moved the check with the code and the whole
    gate stayed green — **the same shape as `check-shadows`' surviving
    `SHADOW_KEY` mutant**, which is a class, not an incident. The nine lights
    and marks are now spelt out in the check file and asserted to match.
  - the blaze check read `lumOf("-")`, the DAY colour, so a lit window that
    dimmed with the city was measured against its own noon value.
  - "the ground layer went to dusk" only asked whether those pixels CHANGED,
    which a ground layer taking the standing table also does. It now reads
    each lawn pixel's key out of the daylight frame and demands exactly what
    the flat table says that key becomes — 6,375 px, and the two tables
    disagree about grass.
  The survivor is `ACCENT_RUNG`, which decides that unlit glass shows the
  SKY rather than taking the neutral middle. It changes which blue a dark
  pane is and breaks no stated property; it is taste, and it is recorded here
  rather than given a check invented to catch it.
  **The chalk check was wrong twice before it was right**, both times because
  the palette knew better: it first demanded every mark's separation from the
  lawn GROW (C chalk fell 99 → 89 as the lawn cooled toward it, correctly),
  then measured against grass MID when a lawn is painted from every rung of
  the ramp. It now measures the nearest rung against the floor daylight
  itself ships — 48 — and at the shipped amount the margins are 136 / 89 /
  80 / 52.

---

## §7 Build order

1. ~~I1 + I2, baselined on `4bb38b6`.~~ **DONE** — `36aa06d`'s successor;
   no art touched, `art-dump` wired in as the suite's first step.
2. ~~**Tier 1** — T1.1, T1.2, T1.3, T1.4, T1.5 — one commit~~ **DONE for
   T1.1–T1.4**, with `art-dump` proving no existing sprite moved and
   `sheet-shadows.png` attached. T1.5 (dusk) split off: it is raster-time
   rather than geometry, and it carries the one open owner question in the
   tier (Q2), so bundling it would have held the flatness fix behind a
   decision that does not block it. **T1.5 done 2026-09-23**, and splitting
   it was right for a second reason nobody predicted: it needed a palette
   ramp, a second table for the ground plane and a multiplier on the shadow
   knob, none of which belonged in a commit about geometry.
3. Q1/Q2/Q3 frames to the owner. **Q1's frames are shot** —
   `docs/shots/sheet-shadows.png`. **Q2 is answered by the sim** (see §5).
   **Q3's frame is every dusk shot there is**: terracotta is the one roof
   that still reads as its own material at nightfall.
4. **Tier 2** on the rulings.
5. **Tier 3** — T3.1 (window states) **DONE 2026-09-23**, its own commit for
   the same reason T1.5 got one: it is raster-time rather than geometry, and
   it needed a second predicate on the box (`aperture`) that T3.2's recipe
   boxes have no use for. **T3.2 (setbacks and awnings) DONE 2026-09-23** —
   eight sprites, four plans and their mirrors, after two fixtures it exposed
   were repaired in commits of their own. **T3.3 (ground) DONE 2026-09-23** —
   the grass keyed off its corners and paths worn where riders cross it,
   213 sprites added (183 meadow tiles, 30 paths) and none moved, after two
   stale picture sets were regenerated in a commit of their own.
6. **Tier 4** — started 2026-09-23 with an item the list did not have:
   **T4.0 (the coats) DONE** — the coat table into the art byte for byte with
   its instrument (`b72bea7`), the 2× pass taught to ask the composer what is
   fur (`a2dc8ea`), then the fourteen coats (`bfb93e8`). The base rate was
   clean this time: every picture tool, run on the previous tip, reproduced
   every picture. **T4.2 (the builds) DONE** — the instrument taught to draw
   the old bodies (`01cf866`), then the pig's stout build and the beaver on
   the small one (`4ea9e5e`); the base rate clean again, on a clean worktree
   of the instrument commit. Next T4.1, authored 2× heads.

---

## §8 Traps, recorded before they are hit

- **A shadow may not be a box in the recipe.** G2 (prism) and G4 (ink identity)
  both fail. Separate sprite, separate tag, separate painter item.
- **`allCitizens().length === 3236`** is asserted exactly (`check.mjs:6332`),
  as is `504` portraits. Anything that adds a citizen-matrix sprite moves it.
  The foot shadow is deliberately outside that matrix.
- **G3 requires a twin for anything tagged building/civic/ground/block/wall/
  station/bridge/road/rail/chalk/grass/water/kerb/rubble.** A new tag avoids
  being conscripted; a reused tag does not.
- **The static/dynamic split.** Ground lives in an offscreen layer rebuilt only
  on `invalidate()` or when the camera leaves the margin. A shadow drawn in the
  dynamic pass lands over it for free — but a shadow written *into* the ground
  layer would need the layer rebuilt whenever a building changed, which is the
  wrong side of that boundary.
- **A shadow's bounding box need not contain the solid's anchor.** The
  security camera found it: its boxes sit off to one side and up a pole, so at
  `k > 0` every rectangle lands clear of the hub and `defineSprite` threw
  (`anchor [-20,2] is outside the 33x18 sprite`). Fixed by pinning the hub into
  the bounds with a face-less `extent` box — the idiom `solidSprite` already
  uses.
- **At zoom ≥ 2 the renderer blits the HI-RES TWIN, not the 1× rows.** Any
  check that reasons about which pixels a sprite *owns* must ask the twin: the
  twin's ink equals the *scaled* render's, which is not the 1× silhouette
  doubled, so the two disagree along every edge. Sampling the 1× rows at zoom 2
  read 176 of 24,448 pixels as wrongly shadowed; the same check at zoom 1 found
  zero. Both zooms are checked now so neither answer can hide the other.
- **A re-derived transform is not the transform.** `draw()` uses
  `base.tx = -Math.round(view.left · z)`; re-deriving it as `(camera.x − W/2z)·z`
  drops the rounding and lands every sample a pixel off. Read `r.view`.
- **The detail scale is one concept for the whole pass.** `check.mjs` proves
  the hi-res set is visible by drawing the same town through
  `{ ...art, hires: null }` and demanding a 2×2-uniform frame. A shadow that
  resolved its own 2× mask regardless of that switch put sub-block detail into
  that frame — 719 non-uniform blocks where there must be none, the suite's one
  real failure in this arc. Anything new in the dynamic pass must honour
  `S > 1 && art.hires`, exactly as `blitScaled` does.
- **An exit code read through a pipe is the pipe's.** `npm run check | grep …`
  reported 0 on the run that carried that 719-block failure. Write the status
  into the log (`echo "NPM_EXIT=$?" >> out/suite.txt`) and grep the log.
- **The grass/canopy relationship is load-bearing** (`palette.js`: grass mid is
  lighter than canopy mid, kept from Glades). A new ramp that lands between
  them puts something in the mush zone. The R chalk accent and the olive
  tortoise are both already-paid-for lessons in exactly this.
- **`docs/shots/*.png` are checked in and the suite asserts two of them exist
  and are non-empty** (`check.mjs`, the looks sheets). Regenerating sheets is
  part of the commit, not an afterthought.

---

*The art-side companion to this list is `SPEC.md` §12. Nothing here changes a
simulation rule, a saved byte, or a knob in `js/sim/rules.js`.*
