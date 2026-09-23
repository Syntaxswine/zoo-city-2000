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

- [ ] **T1.1 — `shadowSprite(recipe)` in `solid.js`.** Project every box's
  silhouette down onto `c = 0` along the light and rasterise it into its own
  grid, anchored on the same world point as the solid. The light in this game
  is upper-left (`litSkin` makes the +tx-facing *end* face the darkest, so the
  sun opposes +a), therefore the shadow is cast toward **+a** — down-right on
  screen, `(2kc, kc)` px for a box of height `c` — with `SHADOW_K` the length
  per unit of height. **`SHADOW_K = 0` degenerates to the bare footprint
  diamond**, so the conservative option and the dramatic one are the same knob
  and the A/B is one number (§5, Q1).
  *Gates:* its own tag (`shadow`), kept out of G2's building/civic/overlay
  filter and out of G3's "must have a twin" list, or given a twin at the same
  scale (trivial — it is recipe-derived). Never a box in the parent recipe.
  *Verify:* every one of the 315 recipes yields a shadow; shadow ink > 0 for
  every box of non-zero height; the shadow's anchor equals the solid's; at
  `SHADOW_K = 0` the shadow is exactly the footprint diamond, pixel for pixel.
- [ ] **T1.2 — draw it.** A painter item between `Z_GROUND` (0) and `Z_WALKER`
  (512) — the band is empty today — carrying `alpha`, which the dynamic pass
  already honours (`js/render.js:639`). It composites over the static ground
  layer, so it darkens grass, chalk, asphalt and water without knowing which.
  *Verify:* `tools/depthaudit.mjs` still green; a walker crossing a shadow is
  drawn *over* it at every one of the audit's ring positions; the static ground
  layer is not rebuilt by a shadow (no `invalidate()` churn per frame).
- [ ] **T1.3 — contact darkening.** One to two pixels of the ground ramp
  shifted one rung down, hugging where a solid meets its tile, under the cast
  shadow. This is what sells *standing* even when `SHADOW_K` is small.
  *Verify:* present on all 315; absent where the box floats (bridge decks).
- [ ] **T1.4 — walker foot shadows.** The citizens have no recipe, so this is
  the one hand-authored piece in Tier 1: a small ellipse under the anchor, one
  for the 12×20 adult and one for the 8×12 cub, at 1× / 2× / 4×.
  **Not composed into the citizen sprite** — G4 forbids expanding a citizen's
  silhouette and G5 pins `allCitizens()` at 3236 — so it is a separate sprite
  drawn one item earlier at the walker's fractional key.
  *Verify:* `allCitizens().length === 3236` unchanged; every citizen sprite
  byte-identical to the dump (I1); the blob never outlives its walker.
- [ ] **T1.5 — dusk.** `rasterize(rows, tint)` already takes a key map. One
  global table — every ramp a rung cooler, `-` lit windows left blazing — makes
  the occupancy data the game already computes finally visible, for almost no
  code, and changes no sprite (it is applied at raster time).
  *Verify:* every ramp key maps to a key in the same ramp; the accents are
  untouched; a dusk frame and a day frame of the same scene differ by > 60% of
  pixels; no sprite's rows change.

### Tier 2 — material vocabulary (adds keys; existing keys untouched)

- [ ] **T2.1 — four new ramps:** `tile` (terracotta roof), `timber` (distinct
  from soil-brown `earth`), `fabric` (awnings, stalls, tents), `furDark` (the
  missing dark coat range that bear/beaver/raccoon are currently faking with a
  shifted `furWarm`). Additive only.
  *Verify:* every pre-existing key's hex identical; `relight`/`remapRamp` total
  over the new ramps; the canopy-darker-than-grass relationship still holds;
  **no existing sprite's rows change** (I1).
- [ ] **T2.2 — zone-legible roofs.** R terracotta, C concrete + glazed lights,
  I rust + ducting, M dark with a stained apron. Reads the zoning from the air
  without the chalk. *Gates:* changes recipes ⇒ G4 ink identity is per-scale and
  still holds (the skin changes keys, not coverage), but the 4× "must gain new
  architectural detail" assertion must still pass per family.
  *Verify:* per-family ink delta table; `--sheet` before/after; roof-face share
  recomputed (the 66% should not move — this is colour, not coverage).
- [ ] **T2.3 — roof furniture.** Parapet ring (one rung lighter on its top =
  instant depth), stair head, tank on legs, vents, laundry lines on R, ducting
  on I, a roof garden on affluent addresses. All recipe boxes, deterministic
  off the variant byte that already exists. *This is the item D2 is about.*
  *Verify:* roof-face share **falls** measurably (that is the point — it is the
  number this item exists to move); prism gate G2 green on every changed plan;
  no footprint or anchor moves.

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
- **Q2 — is dusk a mode or a clock?** A toggle the player holds, an Options
  switch, or tied to the month? (A clock would make the lit-window data a
  *cycle*; a toggle keeps it a photograph.)
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
- [ ] **I3 — the before/after sheet.** `--scene` at day and dusk, and a
  `--sheet` contact sheet per family, both committed, per the render-upgrade
  rule: an upgrade nobody can see in a frame did not happen.

---

## §7 Build order

1. ~~I1 + I2, baselined on `4bb38b6`.~~ **DONE** — `36aa06d`'s successor;
   no art touched, `art-dump` wired in as the suite's first step.
2. **Tier 1** — T1.1, T1.2, T1.3, T1.4, T1.5 — one commit, with I1 proving no
   existing sprite moved and the before/after frames attached.
3. Q1/Q2/Q3 frames to the owner.
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
