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

- [ ] **T3.1 — window states** in the `glazing` skin: blind drawn, plant,
  cracked pane above a wear threshold — keyed on `lit` + wear + tile seed.
- [ ] **T3.2 — setbacks and awnings** on R/C mid-tiers, so the skyline has
  profile (D3). Recipe boxes; the tower already shows the pattern.
- [ ] **T3.3 — ground:** more grass variants, scatter keyed off tile index,
  worn paths where walkers cross grass. The tiling repeat is visible at zoom 2.

### Tier 4 — the animals

- [ ] **T4.1 — authored 2× heads per species.** The head is the ID mark; leave
  the body procedural. `citizen-detail.js` today is generic chamfering.
- [ ] **T4.2 — a third body build and species idles.** Two builds × fourteen
  species is why they read as one animal in fourteen coats.

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
5. Tier 3, Tier 4.

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
