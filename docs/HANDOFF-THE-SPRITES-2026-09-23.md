# The sprites handoff — 2026-09-23

For whoever takes Tier 3 or Tier 4, or touches `js/art/` at all. Sessions 21
and 22 built the shadows, the roofs and the evening; this is what I know now
that I did not know when I started, written down so you do not have to find
it the way I did.

**There are four documents and they are not interchangeable.**

| document | what it is for |
|---|---|
| `docs/PROPOSAL-SPRITE-UPGRADE-2026-09-22.md` | **the list.** §4 is the checklist, each item with the verification written down *before* it was built. §2c is the five art gates. Cross things off there |
| handoff §43, §44 (`HANDOFF-THE-FIRST-ZOO-2026-09-02.md`) | **the sessions.** What was measured on the day, and the twenty traps in two symptom-keyed tables |
| this file | **the standing brief.** The laws, the instruments, what is proven against what is a guess, and the two tiers still open |
| `SPEC.md` §12, §13 | the design record. It outranks all three |

Read this one and §4. Do not read §43 and §44 front to back until something
breaks; then read the trap tables, which are keyed by the symptom you are
looking at.

---

## The laws

These are true of every sprite in the game and will still be true after Tiers
3 and 4. Breaking one is a design change and belongs in a proposal, not in a
commit.

1. **Every built thing is axis-aligned boxes in world units.** `a` runs along
   +tx, `b` along +ty, `c` up; `x = 2a − 2b`, `y = a + b − c`; one tile is 16
   units (`A_STEP`). Nobody hand-draws a receding top face — `solid.js`
   rasterises the boxes through a z-buffer, per screen pixel. If you find
   yourself drawing a parallelogram by hand, you have left the system.
2. **A sprite is text.** Arrays of equal-length strings of palette keys, `.`
   transparent, validated by `defineSprite`. That is why `art-dump` can hash
   every sprite in the game and why a diff is readable.
3. **Rows are palette KEYS, not colours.** Re-hexing a ramp changes every
   pixel on screen and not one row in the tree. `art-dump` hashes key→hex per
   key for exactly this reason.
4. **The ramps run dark → light and their ORDER is the shading.** `litSkin`
   gives the top face the bright rung, the side the middle, the end the
   darkest. Anything that reorders a ramp's image flattens every solid in the
   game at once.
5. **Two relationships are load-bearing and both are written where they
   live.** Grass mid is lighter than canopy mid (`palette.js`, kept from
   Glades of Arcadia — trees must read dark against the ground). And the
   palette's luminance FLOOR is pinned: `check-shadows` holds the shadow key
   `+` (38.4) within 3 of the darkest key there is (slate `<`, 37.7), so
   **nothing may be added below slate** without breaking the shadow's claim
   on being a near-black. That second one shaped the whole evening.
6. **The detail scale is one concept for the whole pass.** S is 1 at zoom 1,
   2 at zoom 2, 4 at zoom 3–4. At S > 1 the renderer blits the **hi-res
   twin**, not the 1× rows scaled. Anything new in the dynamic pass must
   honour `S > 1 && art.hires`, as `blitScaled` does.
7. **Art cannot move a `stateHash`.** The sprite a variant byte selects is not
   in the hashed shape. Across the whole arc — nine commits of shadows, roofs
   and an evening — `git diff --name-only 4bb38b6..HEAD -- js/sim/` is
   **empty**, and `tools/play.mjs --dusk` renders the same scripted city at
   the same hash `86cc1587` by day and at nightfall. Keep it that way: if an
   art change needs a sim field, it is not an art change.

---

## The instruments, and which ones refuse

The rule that makes the whole arc checkable: **a deliberate art change
carries its re-baselined receipt in the same commit.** That is what turns
"this is additive, nothing that existed moved" from a claim into a number.

| tool | gate or instrument | what it says |
|---|---|---|
| `tools/art-dump.mjs` | **GATE** — exit 1, and the FIRST step of `npm run check` | one line per sprite (`name · w×h · anchor · ink · hash8`), one line per palette key, one `TOTAL`. Drift against `docs/fixtures/art-baseline.txt` fails |
| `tools/check.mjs` | GATE, 970 checks | the footprint prism, the hi-res set's visibility, `allCitizens() === 3236`, 504 portraits |
| `tools/check-closeups.mjs` | GATE | 315 buildings, 2,688 citizens; a twin may not expand its silhouette |
| `tools/check-shadows.mjs` | GATE, 22 checks | every recipe casts, one key only, the mask never lands on a standing sprite's pixels, shadows off is byte-exact |
| `tools/check-dusk.mjs` | GATE, 113 checks | amount 0 is the ABSENCE of a table, no ramp inverts, the lights are fixed points, the ground takes less light than the walls |
| `tools/faceprobe.mjs` | **passive instrument** — refuses nothing | how much of the city is roof, and how much of a roof is one bare quad. `--family`, `--top N` |
| `tools/shadow-sheet.mjs`, `tools/dusk-sheet.mjs` | passive | one town, one camera, one process, only the knob moving |
| `tools/play.mjs` | passive | the real renderer on a real mayor-built town. `--no-shadows`, `--shadow-k N`, `--dusk` |

A gate refuses; an instrument reports. Do not make faceprobe refuse and do not
make art-dump advisory — the distinction is what lets you measure a thing you
have not decided about yet.

**The state of the tree as this is written:**

```
art-dump    3651 sprites · 74 palette keys · TOTAL 86cc0399
faceprobe   315 box recipes (of 387 registered) · TOP 63.4% · bare quad 43.0%
suite       970 checks 0 failures · close-ups 315/2,688 · shadows 22 · dusk 113
gates       art-dump → check → close-ups → shadows → dusk → suits → …
```

---

## What is proven, and what is a guess

This is the section I most wanted to exist when I started, so it is the one I
have been most careful with. **Proven** means a gate fails if it stops being
true. **A guess** means it is taste, or a number nobody has argued about, or
a proxy that happens to work.

**Proven.**

- Every one of the 315 box recipes casts a shadow, in one key, with its
  anchor inside the mask.
- The shadow of a box is the ground rectangle `a ∈ [a0 + k·c0, a1 + k·c1],
  b ∈ [b0, b1]`. Not a hull, not a silhouette walk. The z-buffer unions them.
- A shadow never lands on a pixel a standing sprite owns — checked at zoom 1
  AND zoom 2, because those two disagree (see the traps).
- Both neutral knobs are byte-exact: `setShadows(false)` and `setDusk(0)`
  each render the frame that existed before their feature did, after the
  renderer has been all the way to the other setting and back.
- The evening added **no palette key at all**: the baseline fixture is
  byte-identical either side of T1.5.
- Under the evening no ramp inverts, nothing is brighter than it was at noon,
  and the canopy is still darker than the grass — at every amount, in both
  tables.
- Art has not moved a sim hash, anywhere in the arc.

**A guess.**

- **`SHADOW_K = 0.55` is mine, not the owner's.** Q1 is open;
  `docs/shots/sheet-shadows.png` is the frame that answers it. The evening
  MULTIPLIES this number (×3.2), so whatever is chosen is the length dusk
  lengthens.
- **The dusk amount (1) was chosen from four panels by me.** The measurement
  behind it is real — the knob is not smooth, there is one coherent setting —
  but which one ships is a look, not a theorem.
- **`SUN`, `SKY`, `WARM`, `COOL`, `DIM_TOP`, `DIM_END`, `HOME` in
  `dusk.js` are taste.** They were tuned against rendered frames, not derived.
  The one mutant that survives `check-dusk` lives here (`ACCENT_RUNG` — which
  blue an unlit pane is), and it survives honestly: it breaks no stated
  property.
- **The ramp index as a proxy for facing is right for walls and a guess for a
  recipe's own horizontal top.** The ground-plane rule reaches the static
  layer only, so a farm's field goes gold at dusk because its top face holds
  a bright rung. That happens to be right for a field at golden hour. It is a
  guess for a park's lawn.
- **`coveredShare < 0.35`** in `roof-furniture.js` separates a pitch step from
  a flat roof. It was measured on two shapes (a pitch carries the next step
  on ~77% of its area, a flat roof carries a plant box on a few per cent) and
  never swept. A new roof shape could land between them.
- **The aggregate bare-quad share barely moved** (43.8% → 43.0%) while the
  per-family numbers moved properly, because most of the 315 recipes have no
  deck wide enough to furnish. Do not quote the aggregate as if it measured
  the work.
- **Nobody has played this.** Every frame in `docs/shots/` was taken by me,
  through the real renderer, on a scripted town. No player has seen a shadow
  or an evening in this game yet. Treat the owner's first reaction as data
  that outranks all of the above.

---

## Traps that are classes

Twenty are recorded in §43 and §44, keyed by symptom. These are the ones that
are not incidents — they will come back in Tier 3 and Tier 4.

1. **A check that reads the module's own constant is the code agreeing with
   itself.** It has now happened twice: `check-shadows` asserting "every pixel
   is `SHADOW_KEY`" (re-point the constant and it passes), and `check-dusk`
   iterating the module's own `FIXED` (drop the lit window from it and the
   windows dim with the city, gate still green). Write the literal in the
   check file; assert separately that the module agrees with it.
2. **At zoom ≥ 2 the renderer blits the HI-RES TWIN.** A twin's ink equals the
   *scaled render's*, which is not the 1× silhouette doubled — they disagree
   along every edge. An ownership check sampling the 1× rows at zoom 2 read
   176 false positives that were **zero** at zoom 1. Check both zooms or you
   will not know which answer you have.
3. **A pre-registered check may indict the claim, not the code.** Three times
   now: "ink is monotone in k" (a box above the ground slides its shadow off
   its own footprint — REACH is what is monotone), "the chalk's separation
   must grow" (the lawn cooling toward a blue mark is correct — derive a
   FLOOR instead), "the ground is never brighter standing" (the sky has a
   luminance of its own, so a key darker than it gains). Ask the geometry
   which of the two is wrong before you edit either.
4. **A constraint a mutant can delete with the suite green never fired.**
   Sweep its input range before you invent a check for it. And prefer
   asserting a property to silently repairing it: a constraint that
   straightens a ramp the transform bent hides the bad transform.
5. **The cache key must carry every new dimension.** `characterSprite` keys on
   `${lit}:${species}:${phase}:${wear}`. A new character dimension that does
   not enter that string will serve you somebody else's sprite, intermittently,
   and it will look like a z-order bug.
6. **The ground layer is offscreen and survives frames.** It rebuilds only
   when the camera leaves its margin. Anything that changes how the ground is
   painted must mark `dirty` — otherwise the lawn stays at noon under a city
   at nightfall and every table-level check still passes.
7. **An exit code read through a pipe is the pipe's.** `npm run check | grep …`
   reported a real suite failure as green for a round. Write it into the log:
   `echo "NPM_EXIT=$?" >> out/suite.txt`, then grep the log.
8. **A scratch harness that edits files restores in a `finally`.** A probe that
   crashed between the write and the restore left a mutant in `dusk.js`, and
   the next measurement was of the mutant.

---

## The brief for Tier 3 — the living city

Three items (§4 T3.1–T3.3). Start with T3.1; it is the one with a machine
already waiting for it.

**T3.1, window states.** `js/art/building-character.js` already does 90% of
this. `characterSprite` computes a deterministic `phase` from the tile seed
and a per-window `cell = (floor(u/2)*3 + floor(k/3) + phase) & 3`, then turns
a glass key (`=`, `H`) into the lit key `-` when `cell < lit`. A window state
is a widening of that one return: a small table keyed on `cell`, `lit`, `wear`
and `phase`, giving a drawn blind, a plant, a cracked pane above a wear
threshold. Three things will bite you:

- **The pattern uses WORLD cells so 1× and 2× agree.** That comment in the
  file is load-bearing; `check.mjs` proves the hi-res set is visible by
  drawing the same town through `{ ...art, hires: null }` and demanding a
  2×2-uniform frame. Anything keyed on screen pixels instead of world units
  breaks it.
- **`wear` runs first and explicitly skips `= H - +`** so it never paints over
  glass. A new state must respect that ordering or wear will eat it.
- **The cache key.** See trap 5.

**T3.2, setbacks and awnings.** Diagnosis D3: R, C and I are still the same
prism at a distance. This is recipe boxes, and the EMPORIUM already shows
the pattern — `blocks.js`, C 3×3, a department store in three setbacks. (§4
T3.2 says "the tower"; it is the emporium.) The gate that will bite is G2,
the footprint prism: a box may not straddle its tile's edge, because the
works' roof is flush at `a = 0` and a straddling awning hangs a pixel over
the neighbour. Write the geometry
so it does not need catching; `check.mjs`'s plan gate will catch it anyway.

**T3.3, ground.** More grass variants, scatter keyed off the tile index, worn
paths where walkers cross grass. The tiling repeat is visible at zoom 2. Note
that the ground now has a second reader — `duskTable(amount, true)`, the flat
table — so a new ground key is a key at dusk too.

**Where the roof still is.** `node tools/faceprobe.mjs --family`, today:

| family | roof share | of that, one bare quad |
|---|---|---|
| `civic-cemetery` | 88% | **74%** |
| `civic-largePark` | 84% | 54% |
| `I3x3-truffle` | 71% | 58% |
| `I3x3-honey` | 73% | 54% |
| `R3x3-the` | 61% | 46% |

The cemetery is the worst thing in the game by both numbers and roof
furniture could not reach it — grave plots expose no deck wide enough. It
wants a different answer, probably at the recipe.

## The brief for Tier 4 — the animals

Fourteen species share two body builds and **eight coats**, which is the
number to start from. A coat is a (ramp, shift) pair from `js/sim/species.js`,
and there are only eight distinct ones for fourteen animals:

| coat | species |
|---|---|
| `furCool-1` | raccoon, wolf, **skunk** |
| `furWarm+1` | rabbit, pig |
| `furCool+1` | mouse, cow |
| `furWarm+0` | fox, cat |
| `furWarm-1` | beaver, bear |
| `furCool+0` | owl |
| `olive+0` | tortoise |
| `earth+0` | hawk |

Six of the fourteen are wearing a coat somebody else already has, a wolf and
a skunk are the same colour, and the hawk is painted in `earth` — the SOIL
ramp, standing in for feathers, which is half of what diagnosis D4 was about.
That is why they read as one animal in fourteen coats, and it is a cheaper
fix than any of the art below.

T4.1 is authored 2× heads per species — the head is the ID mark; leave the
body procedural. `citizen-detail.js` today is generic chamfering.

Two hard constraints, both pinned exactly:

- **`allCitizens().length === 3236`** and **504 portraits**
  (`check.mjs:6332`). Anything that adds a sprite to the citizen matrix moves
  those. The foot shadows are deliberately outside it.
- **`check-closeups` forbids a citizen twin expanding its silhouette**
  (`old === "." ⇒ new === "."`). An authored head must fit the procedural
  outline it replaces.

`furDark` was deliberately NOT added in T2.1 — a ramp with no consumer is a
guess, and its consumer is here. Add it when you need it, in the same commit
as the art that uses it, with the per-key receipt.

---

## One thing I would tell you if I could only tell you one

Build the instrument before the art, and let it be able to embarrass you.

`art-dump` and `faceprobe` were written before a single pixel changed, and
everything defensible in this arc comes from that order. The gate is why "the
shadows added something and changed nothing" is a number instead of an
argument. The passive instrument is why "the roofs are bare" and "the roofs
are no longer bare" are both readings. And three times the pre-registered
check turned out to be wrong about the world while the code was right — which
only happened because the check was written down first, where it could be
compared against something.

The corollary, learned the hard way twice: **a gate that reads the code's own
answer is not a gate.** Write the number in the check.

---

Maker's mark — Claude Opus 5, sessions 21 and 22. I built the receipt before
the art; I let the geometry correct four of my own pre-registered claims; and
I built a palette ramp for the dark, measured it at a tenth of a luminance
point, and took it out again. The last of those is the one I would most like
kept.
