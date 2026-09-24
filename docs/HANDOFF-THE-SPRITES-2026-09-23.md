# The sprites handoff — 2026-09-23

For whoever takes Tier 3 or Tier 4, or touches `js/art/` at all. Sessions 21
and 22 built the shadows, the roofs, the evening, the windows, the setbacks,
the ground, the coats and the builds; this is what
I know now that I did not know when I started, written down so you do not have
to find it the way I did.

**Last true on `4ea9e5e`, 2026-09-24** — Tiers 1, 2 and 3 closed; Tier 4:
T4.0 (the coats) and T4.2 (the builds) built, T4.1 next.
Every number in this file was re-measured on that tip. If you are reading it
much later, the numbers are the first thing to distrust and `npm run check`
is the first thing to run: it prints most of them.

**There are four documents and they are not interchangeable.**

| document | what it is for |
|---|---|
| `docs/PROPOSAL-SPRITE-UPGRADE-2026-09-22.md` | **the list.** §4 is the checklist, each item with the verification written down *before* it was built. §2c is the five art gates. Cross things off there |
| handoff §43–§49 (`HANDOFF-THE-FIRST-ZOO-2026-09-02.md`) | **the sessions.** What was measured on the day, and the seventy-two traps in seven symptom-keyed tables |
| this file | **the standing brief.** Where the arc stands (next section), the laws, the instruments, what is proven against what is a guess, the traps that are classes |
| `SPEC.md` §12, §13 | the design record. It outranks all three |

Read this one and §4. Do not read §43–§49 front to back until
something breaks; then read the trap tables, which are keyed by the symptom
you are looking at.

---

## Where the arc stands — done and unfinished

*The ledger, 2026-09-24: the code as of `4ea9e5e`, the record as of this
commit. Every "done" row has a gate that
refuses if it stops being true, except where the row says otherwise; every
"unfinished" row says where to start.*

### Done

| item | what it is now | commits | what holds it |
|---|---|---|---|
| the list | the diagnosis (D1–D4), the five art gates, the checklist | `36aa06d` | — |
| I1, I2 | `art-dump` — one line per sprite and per palette key, drift is exit 1; `faceprobe` — how much of the city is roof | `abf08bd` | art-dump is the FIRST step of `npm run check`; faceprobe is passive |
| T1.1–T1.4 | every box solid casts (the shadow of a box is a rectangle), unioned at one density; contact darkening; walker, tree and tent ellipses | `8bccb62` | `check-shadows`, 22 checks |
| T2.1, T2.2 | three ramps added (`tile`, `timber`, `fabric`), none moved; the roof says the zone | `c98e87f` | art-dump, the palette lines |
| T2.3 | roof furniture found on the decks a recipe already has, and it casts | `58520ef` | art-dump; faceprobe's bare-quad share |
| T1.5 | the evening: one key → key table, no key added; `/` and an Options box | `9a123e1` | `check-dusk`, 114 checks |
| T3.1 | window states: blinds, plants, boarded panes; no key added | `1adb3dd` (stale sheets first: `9983766`) | `check.mjs` Part E, 18 assertions |
| T3.2 | the four original R/C plans stepped back: porch roof, terrace, canopy, podium | `38b187b` (fixtures first: `b39866c`, `c61920c`) | art-dump; `massprobe` is passive — nothing refuses a one-box plan |
| T3.3 | grass keyed off its tile CORNERS (no seam); paths worn where riders cross a forecourt | `692b2b3`, `a416748` (stale pictures first: `e2ace35`) | `check-ground`, 51 checks |
| T4.0 | fourteen coats from existing ramps, the table the kit's own; the 2× pass asks the composer what is fur and where the figure ends | `b72bea7`, `a2dc8ea`, `bfb93e8` | `check-animals`; `check-closeups`' fur share |
| T4.2 | three builds: the pig in a third, `stout` — a barrel on thin legs — and the beaver on the small build, where its paddle shows; the table the kit's own (`BUILDS`). Its "species idles" half had been done since `2fcfe8e` | `01cf866` (the instrument first), `4ea9e5e` | `check-animals`, 21 checks, against the builds before, read in the same run |
| the record | this brief and handoff §43–§49 (§45 went in with `1adb3dd`) | `1f511e2`, `4a60a99`, `27577d3`, `543ecbf`, `7e85b59`, `d38b5d0`, `60b845a`, `ad0d872`, the ledger `5f06264`, and the commit that wrote this row | — |
| owner's Q2 | dusk is a MODE, not a clock — a tick is a month | `9a123e1` | answered by the sim |
| owner's Q3 | terracotta on R kept, on a frame | the roofs `c98e87f`, the answer recorded `7e85b59` | answered by `scene.png` |

Twenty-nine commits with this record, **nothing under `js/sim/`**, every one
pushed and live.
The suite on `4ea9e5e`, the last commit that touched code: 980 checks and
fourteen more gates, green.

### Unfinished — on the list, in the order I would take them

1. **T4.1 — authored 2× heads per species.** Twenty-eight heads (SE and NE;
   west is mirrored) at 24×18. A twin may not expand the 1× silhouette and
   may not erode below 0.88 of its ink (`check-closeups`), and its ink must
   stay within 12% of 4× (`check.mjs`). It has to compose with everything
   stamped over a head — elder marks, look marks, glasses, the idle poses,
   hats, the carry offset. `CITIZEN_DETAILS.authored` says what the composer
   drew and where. The head is where a species lives once the body is shared:
   on one build, two animals are only their heads and their tails (§49).
2. **Q1 — how long is the shadow?** The owner's call.
   `docs/shots/sheet-shadows.png` is the frame that answers it. `SHADOW_K
   0.55` is mine, and dusk multiplies it ×3.2.

### Unfinished — found on the way, not on the list

| what | where it is written | what it wants |
|---|---|---|
| `species.js` still carries `fur`/`furShift`, read by nothing but `check-animals`' control | handoff §48 | a sim-side commit to remove them — which must also rewrite the control's premise check, since it asserts those columns ARE the pre-T4 table |
| the bear and the wolf share the big build, 1.18 strides apart — the closest pair by figure in the kit | §49 | nothing while their coats split them (35.1 against a shade floor of 16.6); `check-animals`' one-coat rule refuses the day a coat change closes that gap |
| cubs share one body and zooprobe has never read them — it reads adults | §49 | a cub reading; the kit's own comment says the beaver cub was the bear cub minus ears until a two-pixel tail went on |
| a coat at the top of its ramp gets less edge light at 2× (the wolf, 18.2% → 10.0% of its fur) | §48, trap 16 | a lighter key the pass may reach for, or a coat off the top rung; inside the gate today |
| the beaver's 2× rule reads `ramp === "earth"` below row 10 and has never fired on a beaver without a sack | §48 | its author's intent; it is not in the code |
| roof furniture cannot tell a TERRACE from a pitch step (`coveredShare` medians 0.63 vs 0.65) | the GUESS list, §46 | a class change: what stands on the deck, with a height floor |
| **no gate sees a hidden door** — twice (the meat hall's annex, T3.2's canopies) | trap 12 | a door-pixel count in both mirrors, as a check; today it is done by hand |
| 43 zoned plans are one box with a lid — industrial sheds and works, tier-1 shops and cottages, meat stalls | `node tools/massprobe.mjs` | massing, family by family, as T3.2 did |
| the cemetery is 88% roof and 74% of that one bare quad; furniture cannot reach it | *Where the roof still is*, below | a different recipe |
| scatter as objects (flowers, stones) not built | §47 | a size-on-screen answer: at zoom 1 each is one pixel of a key that already means something |
| a path shows on open grass only, not a forecourt across chalk, a park or rubble | §47 | a decision about the zone's chalk first |
| the lit blind that hides at noon and shows at dusk is emergent and ungated; `ACCENT_RUNG` survives `check-dusk` | *The four passes*; the GUESS list | a check only if someone decides it is a property |
| **taste nobody has argued about** — `SHADOW_K`, the dusk constants, the window mix, the setback depths, the meadow's numbers and the path's bow, the fourteen coats, the stout's shape and who moved | the GUESS list | the owner's eye |
| **nobody has played any of this** | the GUESS list | a player; their first reaction outranks every number here |

The rest of the game's open work — not the sprites — is `BACKLOG.md`.

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
   in the hashed shape. Across the whole arc — **twenty-nine commits** of
   shadows, roofs, an evening, a set of windows, four buildings stepped back,
   a meadow, fourteen coats and three builds — `git diff --name-only 4bb38b6..HEAD -- js/sim/`
   is **empty**, and
   `tools/play.mjs --dusk` renders the same scripted city at the same hash
   `86cc1587` by day and at nightfall. Keep it that way: if an art change
   needs a sim field, it is not an art change.

---

## The four passes, in order

T3.1 turned what used to be "a skin, and some things that happen to it" into a
pipeline with a contract between the stages, so it is worth writing down. A
building's pixels are decided by four passes, and **each one sees the one below
it as INK, never as intent.**

| # | pass | when | what it does |
|---|---|---|---|
| 1 | **the skin** — the recipe's own `top/side/end` in `buildings.js`, `blocks.js`, `shops.js`, `landmarks.js` | always | the bare material. It alone decides where glass is |
| 2 | **the character pass** — `building-character.js` | when a building is lit, marked or worn | wraps each face function. `wear` first (streaks, roof stains — and it explicitly skips `= H - +`), then the PANE (T3.1's states, on glass only). Hangs `aperture()` on the box |
| 3 | **the detail pass** — `architecture-detail.js` | only at 2× and 4×, via `hires.js` | wraps whatever it is handed — the character faces if there was a character pass, the bare ones otherwise. Jambs, sills, mullions, brick courses, slate grain |
| 4 | **the tint** — `dusk.js` through `rasterize(rows, tint)` | at raster time, after the rows exist | key → key. Sees nothing but keys |

Three things fall out of that order, and all three have already cost a session:

- **Pass 3 cannot infer intent from pass 2's ink.** It finds a window by the
  key, so a blind — a key it does not know — read as wall and lost its frame
  at 2× and 4× while being right at 1×. That is why pass 2 now HANDS it
  `aperture(face, u, k, x, y)`, answering about the BARE skin. A recipe that
  never went through pass 2 has no `aperture` and pass 3 falls back to the ink,
  which is why nothing that existed moved.
- **The order inside pass 2 is load-bearing.** Wear skips glass and the panes
  only touch glass, so the two are disjoint by construction — and that is
  exactly what lets the gate make a clean two-way ownership claim (*only glass
  becomes a pane key, and only a pane key comes from glass*).
- **Pass 4 is last and sees only keys**, which is why an evening needs no
  geometry — and why adding a pane key is also a decision about dusk. A surface
  key gets projected; a key that is a LIGHT has to be in `dusk.js`'s `FIXED` or
  it will dim with the city. T3.1's blind cloth is deliberately a surface key,
  and the measurement is the nicest accident in the item: a lit blind
  alternates `-` (lum 193.9, a fixed point) with `S` (189.1), so **by day the
  two are 4.8 apart and the blind is almost invisible — and at dusk `S` is
  projected onto `R` at 144.5, so the gap opens to 49.4 and the slats come
  out.** The one state that hides at noon and shows at nightfall, which is
  exactly what a backlit venetian blind does. (The boarded pane's hole `<` is
  a fixed point too, for the opposite reason: it is already the palette's
  floor and there is nowhere below it to go.) **Nothing asserts any of that** —
  it is emergent, from two tables that do not know about each other, and it is
  recorded here rather than given a check invented to protect it, the same way
  `ACCENT_RUNG` was. If you retune `dusk.js` you can lose it without a gate
  saying a word.

**T3.2 lives entirely in pass 1** — it changed four recipes and nothing else
— which is why every downstream pass took the new plans without an edit: the
character pass lit their new boxes, the detail pass framed their windows, the
evening tinted them, and the window gate held both ways at 1×, 2× and 4×.

**The animals have a detail pass too, and it made pass 3's mistake twice.**
`citizen-detail.js` refines each citizen at 2× and 4× and decided what was
FUR by colour (three ramps) and where an EDGE was by transparency. The hawk's
coat is `earth`, so its fur was never reworked at all (0.0%, for as long as
the kit has existed); the tortoise wears a 1-px outline, so its limbs never
touched a transparent pixel (2.4%). The composer now hands the pass its figure
in authoring keys — `CITIZEN_DETAILS.authored`, the animals' `aperture` — and
the pass asks that, not the ink (§48).

**The shadow is not in this chain.** It is its own sprite with its own tag,
drawn by the renderer between the ground and the standing pass — because G2
(the footprint prism) and G4 (ink identity) between them forbid a shadow from
being a box in a recipe. Do not look for it here.

---

## The instruments, and which ones refuse

The rule that makes the whole arc checkable: **a deliberate art change
carries its re-baselined receipt in the same commit.** That is what turns
"this is additive, nothing that existed moved" from a claim into a number.

| tool | gate or instrument | what it says |
|---|---|---|
| `tools/art-dump.mjs` | **GATE** — exit 1, and the FIRST step of `npm run check` | one line per sprite (`name · w×h · anchor · ink · hash8`), one line per palette key, one `TOTAL`. Drift against `docs/fixtures/art-baseline.txt` fails |
| `tools/check.mjs` | GATE, 980 checks | the footprint prism, the hi-res set's visibility, `allCitizens() === 3236`, 504 portraits |
| `tools/check-building-character.mjs` | GATE — **Part E**, called by `check.mjs`, no verdict of its own | the windows. 18 assertions: the ownership law both ways at 1×, 2× and 4×; the twelve pane keys spelt out; a boarded pane is never lit; a plant never swallows its pane; and the three that would have caught the locked hash |
| `tools/check-closeups.mjs` | GATE | 315 buildings, 2,688 citizens; a twin may not expand its silhouette, and every species' twin reworks its FUR (by the composer's figure) at least half as much as the median species', at 2× and at 4× |
| `tools/check-shadows.mjs` | GATE, 22 checks | every recipe casts, one key only, the mask never lands on a standing sprite's pixels, shadows off is byte-exact |
| `tools/check-dusk.mjs` | GATE, 114 checks | amount 0 is the ABSENCE of a table, no ramp inverts, the lights are fixed points, the ground takes less light than the walls — and the lawn it samples is MEASURED lawn: the same frame with nothing standing agrees with it by day and at dusk |
| `tools/check-ground.mjs` | GATE, 51 checks | the grass keyed off its corners and the paths worn where riders cross it: every corner combination and walked direction drawn; kept round everything made; no tile spanning kept and rough; the paths exactly where the sim's own traffic count says a walk crosses grass, and the same path at every zoom; and the FRAME — every open tile pixel for pixel as its own corners, byte and walks name, and no seam, with the instrument proven able to see the old quilt in the same run |
| `tools/check-animals.mjs` | GATE, 21 checks | the coats: fourteen, all different; none FLAT in any look or age; none as LOST on grass or road as the olive tortoise; no ONE ANIMAL; no two close figures on one ramp; no key added. The figures: no two closer than one animal mid-stride; where two coats are too alike to split, figures 1.4 strides apart or more; the builds that moved are the beaver's and the pig's. Two controls, spelt out and read in the same run, each refused exactly as measured — the coats before T4.0 on the bodies before T4.2, and the bodies before T4.2 in today's coats — drawn by the kit's own composer through `opts.build`; that hook proven faithful; `bareFigure` proven to take the coat off; and the census bars in the coats |
| `tools/zooprobe.mjs` | **passive instrument** — refuses nothing | can you tell the animals apart? FORM (two figures in one coat, against one animal mid-stride) and COAT (two coats on one figure, against one animal shaded); FLAT and LOST per coat; IN ONE COAT — the pairs the fur cannot split, closest by figure first. `zooReadings({ coats, builds })` reads any table of either, live or not |
| `tools/groundprobe.mjs` | **passive instrument** — refuses nothing | does the ground show its tiles? SEAM (the step across a tile edge over the step across a line through a tile; 1 is seamless) and REPEAT (agreement one tile over, above chance), off the renderer's frame, for an open field, a control that cannot have a seam, and the pick before T3.3. `--cams N` |
| `tools/faceprobe.mjs` | **passive instrument** — refuses nothing | how much of the city is roof, and how much of a roof is one bare quad. `--family`, `--top N` |
| `tools/massprobe.mjs` | **passive instrument** — refuses nothing | how much of each plan is one box: `fill` (its rooms over their bounding prism) and `deck` (a level between the street and the top, seen at zoom 1). Bare, it names the plans that are still ONE BOX WITH A LID. `--family`, or a name pattern |
| `tools/shadow-sheet.mjs`, `tools/dusk-sheet.mjs` | passive | one town, one camera, one process, only the knob moving |
| `tools/skyline-sheet.mjs` | passive | the four families T3.2 stepped back, all six plans side by side, and a 218-lot block at zoom 1 and 2. `docs/shots/skyline-before-after.png` is the before/after — two trees in one process, the only way a "before" survives a recipe change |
| `tools/ground-sheet.mjs` | passive | the 31 corner combinations, an open field at zoom 1 and 2, a town's edge where the kept grass meets the meadow, and a forecourt trodden and worn. `docs/shots/ground-before-after.png` is the before/after — two trees, one process |
| `tools/zoo-sheet.mjs` | passive | the fourteen on grass and road, each in its four coats (adult, shaded, elder, elder shaded), and a crowd of 84 through the real renderer at zoom 1 and 2. `docs/shots/zoo-before-after.png` is the coats' before/after — two trees, one process; `docs/shots/zoo-builds-before-after.png` the builds' — ONE tree, the old bodies drawn through `opts.build` |
| `tools/window-sheet.mjs` | passive | 24 facades at 4× for the state ART, then a dense block through the real renderer at zoom 1, 2 and dusk for the only question that decides it — at the zoom the game is played at, is this a city of different windows or is it noise? |
| `tools/play.mjs` | passive | the real renderer on a real mayor-built town. `--no-shadows`, `--shadow-k N`, `--dusk` |

A gate refuses; an instrument reports. Do not make faceprobe refuse and do not
make art-dump advisory — the distinction is what lets you measure a thing you
have not decided about yet.

**The state of the tree as this is written:**

```
art-dump    3864 sprites · 74 palette keys · TOTAL 61937044   (T4.2 moved 256 — the beaver's and the pig's adults and
            elders, no size or anchor; T4.0 moved 2,774; the palette line has not moved since T2.1)
faceprobe   315 box recipes (of 387 registered) · TOP 63.4% · bare quad 42.9%
massprobe   192 zoned plans · 43 one box with a lid (51 before T3.2) · R/C tiers 2–3: one, the skylight market
groundprobe open field: seam 0.96 / 0.99 / 1.01 at zoom 1/2/4 (the quilt before 2.46 / 3.80 / 5.13) · repeat 4.9 / 4.7 (13.6 / 13.5)
zooprobe    14 coats (7 before T4.0) · ONE ANIMAL 0 (beaver/bear) · FLAT 0 (5) · LOST 0 (4) · close figures on one ramp 0 (9)
            · builds small 9, big 4, stout 1 · one animal in two coats 0 (bear/pig, beaver/bear before T4.2) · closest
            in one coat rabbit/mouse 1.48 strides (beaver/pig 1.08) · closest by figure bear/wolf, 1.18
suite       980 checks 0 failures · close-ups 315/2,688, fur reworked 2× median 18.4% least 10.0% · shadows 22 · dusk 114
            · ground 51 · animals 21 · Part E 18
gates       art-dump → check → close-ups → shadows → dusk → ground → animals → suits → …
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
- A window state repaints a pixel the bare plan drew as glass and nothing
  else, and nothing but a window state paints a pane key, at 1×, 2× and 4×,
  across six appearances of all 192 glazed plans.
- No window cell is both boarded and lit; no plant swallows its own pane;
  every declared state paints at all three resolutions; and a building filling
  up backlights strictly more of its cloth than it did before.
- T3.2 moved exactly eight sprites — four plans and their mirrors — and no
  colour: the art-dump names them and the palette line did not move.
- The grass cannot step at a tile edge: two tiles that share an edge share its
  corners, and the gate holds the frame to it — seam ≤ 1.3 at zoom 1 and 2
  (it reads 0.9–1.0), in a run that must also read the old quilt as ≥ 2.0
  (2.4–3.9) or prove nothing.
- The renderer lays every open tile's grass and path exactly as its own
  corners, byte and walks name — pixel for pixel, at zoom 1, trodden and worn.
- A path is worn exactly where a stored commute walks on grass, walk for walk
  with the sim's own traffic count; the three grasses are three of the 186
  meadow tiles, byte for byte; and T3.3 added 213 sprites and moved none.
- Fourteen species wear fourteen coats; no coat goes flat in any look or age;
  no coat's lit rung, in any look or age, is as near a key of the grass or the
  road as the olive tortoise's was; no two species are ONE ANIMAL; and no two
  close figures share a ramp — each checked against the table the game wore
  before, spelt out and read in the same run, which must fail every one of
  them exactly as measured.
- Every species' 2× and 4× twin reworks its fur — what the composer drew as
  fur, not what a ramp says — at least half as much as the median species'.
- T4.0 moved exactly 2,774 sprites, every one of them an animal of a species
  whose coat changed; none changed size, anchor or ink; no palette key was
  added or moved. The census paints each species in its coat.
- No two figures stand closer than one animal to itself mid-stride, and every
  pair in coats too alike to split stands 1.4 strides apart or more — each
  checked against the builds before T4.2, drawn by the kit's own composer and
  read in the same run, which must fail both exactly as measured (bear/pig and
  beaver/bear; beaver/pig).
- FORM is the figure's alone: the bare figure puts every fur pixel back to the
  key it was drawn in — asserted directly, since the check that stood for it
  compared two readings of the same sprites and could not fail (trap 18).
- T4.2 moved exactly 256 sprites, the beaver's and the pig's adults and elders;
  none changed size or anchor; no cub, portrait, carry or palette key moved.
- Art has not moved a sim hash, anywhere in the arc — twenty-nine commits,
  zero files touched under `js/sim/`.

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
  a flat roof — and **it cannot tell a TERRACE from a pitch step, measured.**
  Over every deck in the game a terrace (a storey stands on it) is covered
  0.22–1.24, median 0.63; a pitch step 0.35–1.73, median 0.65. T3.2's
  terraces landed exactly there, so the apartment's balustrade is drawn into
  its plan. The fix is a class change — what stands on the deck, with a
  height floor so sawtooth teeth do not count as storeys — and it rails every
  setback in the game at once.
- **T3.2's setback depths (2, 2.5 and 3 units) and `massprobe`'s line (fill ≥
  0.95, deck < 8%)** are read off the 2s-px rule, the baseline and one sheet.
  The line separates the four originals from the sixteen later plans; it is
  not a law about what a building should be.
- **The doors survive T3.2 by a scratch count, not a gate.** 28/28/36/36 px in
  both mirrors — the count that caught the canopy eating the door. No check in
  the suite can see a hidden door; see trap 12.
- **The aggregate bare-quad share barely moved** (43.8% → 43.0%) while the
  per-family numbers moved properly, because most of the 315 recipes have no
  deck wide enough to furnish. Do not quote the aggregate as if it measured
  the work.
- **The window MIX is taste.** Three of sixteen cells get a blind, two get a
  plant, and a board takes four cells in twenty-three at `wear 2` against one
  at `wear 1`. Those five numbers were read off `sheet-windows.png` by me. The
  gate holds only a floor — a fixture is an accent, and at every age most
  windows are still just windows — because "how many blinds is the right
  number of blinds" is not a thing a check can know.
- **`BLIND_SLAT`, `PLANT_BAND`, `PLANT_HEAD`, `BOARD_PERIOD` are tuned against
  rendered frames**, exactly like `dusk.js`'s constants. `PLANT_HEAD` is the
  one with a reason behind it: the Roost's perch windows are 0.8 units tall.
- **A lit blind hiding at noon and showing at dusk is EMERGENT and ungated.**
  It falls out of two tables that do not know about each other (see *The four
  passes*); retune `dusk.js` and it can go without a check saying a word.
- **The meadow's numbers are taste**: the 6×6 window, the thirds, a jitter of
  0.45 of a level, six dithers — and the path's bow (0.5 units) and its
  four-walk threshold. Read off pictures and two measured bars; the bars are
  the seam and the repeat, not how a meadow ought to look.
- **The coats are taste inside four rules.** The rules are checked; which
  table the game wears — the search found 280 that pass them inside its
  shortlists alone, and the one chosen is not among them — was picked from
  four rendered crowds by me: a red fox, a coral pig, a ginger cat, warm greys
  because the cool ones are the road's. And the rules' own lines are mine: zooprobe's two
  controls (one animal mid-stride, one animal shaded), "close" as under twice
  the stride floor, the olive tortoise's 9.8 as the camouflage bar, and the 2×
  fur bar at half the median. Each is a control or a local threshold read off
  the measurement, not a law about animals.
- **A coat at the top of its ramp gets less edge light at 2×.** The pass
  lights an edge one rung lighter and there is none: the wolf on fabric +1
  reworks 10.0% of its fur, against 18.2% on its old coat. Inside the gate.
- **The builds are taste inside two rules.** The stout's shape — a barrel on
  thin legs, the belly out on the side it faces — and the choice to move the
  beaver rather than the wolf or the pig are read off pictures by me: the
  tables that brought every pair of the big four to 1.48 strides all put the
  wolf or the pig on the slim body, and a slim pig is not a pig. The one-coat
  bar (1.4) is set under its witness, the rabbit and the mouse at 1.48 — a
  pair everyone reads as two animals — not derived from an eye.
- **Nobody has played this.** Every frame in `docs/shots/` was taken by me,
  through the real renderer, on a scripted town. No player has seen a shadow,
  an evening or a drawn blind in this game yet. Treat the owner's first
  reaction as data that outranks all of the above.

---

## Traps that are classes

Seventy-two are recorded in §43–§49, keyed by the symptom you are staring at.
These eighteen are the ones that are not incidents: each has either
already happened twice, or cost a whole session once and will cost the next
one too. **Renumbering this list breaks a comment in the source — run
`grep -rn "standing brief" js/ tools/` before you do.**

1. **TWO HASHES ARE NOT DECORRELATED BECAUSE THEIR COEFFICIENTS LOOK
   DIFFERENT.** T3.1 drew a window's fixture with `(5cu + 11ck + 7phase + 3) &
   15` beside the lights' `(3cu + ck + phase) & 3` and wrote a comment saying
   the forms differ so they cannot lock. **5 ≡ 1 and 11 ≡ 3 mod 4**, which
   makes the first form exactly `3·cell + 3 mod 4`: any linear form mod 2^n
   reduces to a linear form mod 2^m, and two of those lock on an arithmetic
   coincidence that reads as fine. Use an avalanche (`hash` in `terrain.js`),
   salt the two draws differently, and **measure the joint distribution before
   you believe either.**
2. **A CHECK THAT ONLY ASKS WHETHER SOMETHING EXISTS CANNOT SEE A LOCK.** This
   is what let trap 1 through, and it is the more general lesson of the two.
   The check written to catch the locked hash asked whether backlit and shaded
   cloth both appear — and both did, because a locked hash still produces both
   kinds. What catches it is a quantity that must MOVE (the backlit share
   against the light level; it was frozen at 11,690 px across two levels) or a
   contingency table with no empty bucket. Existence is the weakest claim you
   can make about a distribution; reach for it last.
3. **A check that reads the module's own constant is the code agreeing with
   itself.** It happened twice before anyone named it: `check-shadows`
   asserting "every pixel is `SHADOW_KEY`" (re-point the constant and it
   passes), and `check-dusk` iterating the module's own `FIXED` (drop the lit
   window from it and the windows dim with the city, gate still green). T3.1
   was the first time the discipline went in up front — the twelve pane keys
   are spelt out in the check file and the module's list is asserted against
   them. Write the literal in the check; assert separately that the module
   agrees with it.
4. **At zoom ≥ 2 the renderer blits the HI-RES TWIN.** A twin's ink equals the
   *scaled render's*, which is not the 1× silhouette doubled — they disagree
   along every edge. An ownership check sampling the 1× rows at zoom 2 read
   176 false positives that were **zero** at zoom 1. Check both zooms or you
   will not know which answer you have.
5. **A pre-registered check may indict the claim, not the code.** Three times
   now: "ink is monotone in k" (a box above the ground slides its shadow off
   its own footprint — REACH is what is monotone), "the chalk's separation
   must grow" (the lawn cooling toward a blue mark is correct — derive a
   FLOOR instead), "the ground is never brighter standing" (the sky has a
   luminance of its own, so a key darker than it gains). Ask the geometry
   which of the two is wrong before you edit either. And it goes the other
   way too: T3.1's *"a plant sits in a pane and never swallows it"* indicted
   the ART on its first run, and the owl landmark was right.
6. **A constraint a mutant can delete with the suite green never fired.**
   Sweep its input range before you invent a check for it. And prefer
   asserting a property to silently repairing it: a constraint that
   straightens a ramp the transform bent hides the bad transform.
7. **The cache key must carry every new dimension.** `characterSprite` keys on
   `${lit}:${species}:${phase}:${wear}`. A new character dimension that does
   not enter that string will serve you somebody else's sprite, intermittently,
   and it will look like a z-order bug. T3.1 added no dimension on purpose —
   every state is derived from those four — and the same fact is why the cost
   is bounded: **`phase` is two bits**, so a whole city has a few hundred
   distinct building appearances and each is generated once. It also means a
   fresh SEED does not make a fresh sprite, which ate three attempts to time
   the pass in the browser.
8. **An instrument that tallies the ARTEFACT measures the wrong thing; tally
   the DIFFERENCE.** T3.1's sheet counted pane keys over the whole sprite and
   reported a brand-new building as 4.3% boarded up — because slate's dark
   rung is also a wall and fabric is also an awning. Count only where the bare
   plan painted glass. And take the bare reference from the same appearance:
   a species stamp grows the recipe's extent, so a marked sprite and an
   unmarked one do not share a raster to index into. **And take the
   population from PLANS, not RECIPES:** every lit building registers a recipe
   of its own, so T3.2's probe measured 255 "plans" after the sheet had drawn a
   town and 192 before.
9. **Measure the base rate before you repair a fixture.** Fifteen documentation
   sheets changed under T3.1 — and the same fifteen change on a tree with no
   working changes at all, because nothing regenerated them through Tier 2.
   They went in a commit of their own, on an unchanged tree, so that T3.1's
   own four could be read. **And run every tool that writes into
   `docs/shots`, not the ones called sheets:** T3.3 found the variant review's
   city frames stale since T1's shadows, and `scene.png` since T3.2, because
   no refresh had run the tools that write them.
10. **The ground layer is offscreen and survives frames.** It rebuilds only
    when the camera leaves its margin. Anything that changes how the ground is
    painted must mark `dirty` — otherwise the lawn stays at noon under a city
    at nightfall and every table-level check still passes.
11. **An exit code read through a pipe is the pipe's**, and **a scratch
    harness that edits files restores in a `finally`.** `npm run check | grep …`
    reported a real suite failure as green for a round: write it into the log
    (`echo "NPM_EXIT=$?" >> out/suite.txt`) and grep the log. And a probe that
    crashed between the write and the restore left a mutant in `dusk.js`, so
    the next measurement was of the mutant.
12. **ANYTHING THAT STANDS PROUD OF A WALL HIDES 2d UNITS OF IT.** An awning, a
    porch roof, an annex d units deep covers the wall below it for twice its
    depth on screen — the stall's hooks (twice), the meat hall's annex over its
    own door in the mirror, and T3.2's first canopies, which took the store's
    door from 36 px to 15 and the tower's to 9. And the thing is SHEARED: a gap
    left for a door must reach d further on the far side, because the lip
    stands d nearer along b than the root. Count the door's pixels, in both
    mirrors, before and after. No gate does it for you.
13. **A FIXTURE'S PREMISE IS A CLAIM — PUT IT IN THE CHECK.** `check-dusk`'s
    "open-lawn samples" were a wall, the river and a tree from the day the
    evening was built, and passed because nearly everything changes at dusk; the scripted clone that
    could not pay (handoff §12) passed every check after a refused op on an
    unpainted map. A sample that is "lawn", a fixture that "took", a town that
    "has a hall" — assert it in the check itself, so the day it stops being
    true the fixture fails as a FIXTURE and not as the feature.
14. **A CLAIM ABOUT WHAT A CONSUMER DOES IS A CLAIM ABOUT ITS PRODUCER.** T3.3
    read "walkers never cross grass" off `walkers.js` — every search in it is
    over roads — and wrote it into three files. The commuter walks a path it
    is HANDED, and `fields.js` lays a station's forecourt into that path tile
    by tile; `check.mjs` had asserted it for months. Read the thing that makes
    the data, and search the suite for the check that already says so.
15. **A METRIC NEEDS A CONTROL BEFORE IT GETS A BAR.** T3.3's seam measure read
    1.71 on a ground that cannot have a seam: one fixed pair of strips was
    reading six dither patterns. Build the case that must read the floor and
    the case that must read the fault, run the instrument on both, and only
    then hold the thing you built to a number.
16. **ANY SHIFT ALONG A RAMP THAT CLAMPS PUTS TWO RUNGS ON ONE KEY.** Three
    times in T4.0, in three places: the `shade` look one rung down a coat
    already one rung down (the lit and the shaded body on one key — five
    species drawn FLAT for half their number); an elder's lightening at the
    top (the beaver's pale chest painted in the key of the shoulders under it);
    and the 2× pass lighting an edge a rung up on a coat with no rung left
    (the wolf's fur 18.2% → 10.0% reworked). The elder rule had a headroom
    guard; nothing else did. Any time a rung index is shifted and clamped, ask
    what else lands on the same key — and assert the property (two keys), do
    not repair it silently (trap 6).
17. **A MUTANT KILLED BY THE WRONG CHECK PROVES NOTHING ABOUT THE RIGHT ONE,
    AND A SURVIVOR MAY NOT BE A FAULT.** T4.0's first harness aimed a coat at
    ONE ANIMAL and the close-ramp check refused it first; its second survived
    and was, by the instrument's own reading, two animals. Record WHICH check
    refuses every mutant; read every survivor with the instrument before
    calling the gate weak — and keep the one that is not a fault in the
    harness as the gate's neutral control, the mutant that must pass.
18. **TWO READINGS THAT SHARE THE THING UNDER TEST AGREE WHATEVER IT DOES.**
    Trap 3's other face. T4.0 proved "FORM does not depend on the coat" by
    reading every pair's FORM under two coat tables and asserting they agreed
    — but both readings drew the SAME sprites, in the live coats, so they
    agreed with FORM read straight off the coloured rows too, and the check
    stood green for a whole tier. T4.2 found it by mutation, with the one
    check that saw the fault first neutralised (trap 17's discipline). A
    comparison can only fail on what differs between its two sides: vary the
    input the property is about, or assert the property itself — here, that
    the bare figure puts every fur pixel back to the key it was drawn in.

---

## The brief for Tier 3 — the living city

Three items (§4 T3.1–T3.3). **All three are built** (2026-09-23, §45–§47).

**T3.1, window states — BUILT.** The widening was one return in one face
function, exactly as this brief predicted; everything that cost a day was
around it, and it is written up under *The four passes* above rather than
repeated here. **If you are adding a FIFTH window state, these are the four
things to know**, in the order they will bite:

1. **A cell is a THIRD glass on median.** Anything that paints a fixed
   sub-rectangle of a cell paints nothing at all on a sixth of the city and
   covers everything on another eighth. Probe the aperture, or paint the whole
   cell — there is no third option and the numbers are in §45.
2. **Add your keys to `PANE_KEYS` AND to the literal in
   `check-building-character.mjs`.** The gate asserts the two agree, so you
   cannot forget one, but it will tell you about it rather than let you guess.
3. **Decide what your keys do at dusk** before you decide what they look like.
   A surface key is projected and darkens; a key that is a LIGHT must be in
   `dusk.js`'s `FIXED`. Get that backwards and a lamp goes out at nightfall.
4. **Fire only where the bare skin painted glass, and only when somebody is
   home** (`lit >= 1`) unless the state is about the building rather than its
   occupants, as the boards are about age. Both halves are load-bearing: the
   first is what keeps the ownership check a clean two-way claim, the second
   is what keeps `characterSprite(base, { majority })` inside its socket.

Still true and still worth repeating: the pattern uses WORLD cells so 1× and
2× agree, and `wear` runs first and skips `= H - +` so it never paints over
glass.

**T3.2, setbacks and awnings — BUILT.** `massprobe` found that D3 had become
true of four plans, not a zone: session 1's two-storey, apartment, store and
tower were the only R/C mid- and high-rise plans that were one box with a lid,
and a third of those lots draw one. They step back now (§46; §4 has the table).
**If you are adding massing to a plan**, these are the four things to know, in
the order they will bite:

1. **Both street faces.** `flipPlan` mirrors boxes, not skins; a step on one
   face lands on the doorless face in the mirror.
2. **2s px.** A setback of s units is a band 2s px tall at zoom 1; under 2
   units it reads as a stripe.
3. **Anything proud of a wall eats 2d of it** (trap 12) — count the door.
4. **Measure it** — `node tools/massprobe.mjs '^C2-'` before and after, and
   the `art-dump` receipt in the same commit. The footprint gate (G2) never
   bit: every box was written inside `[0, 16]` from the start.

**T3.3, ground — BUILT.** Measured, the repeat was a QUILT: three grass
brightnesses cut into diamonds. The grass is now keyed off its CORNERS
(`js/meadow.js` reads them off the world; `art.meadow` draws a tile from its
four), kept round everything the city has made, and a path is worn where a
rider's stored commute crosses a station's forecourt (`wornPaths`,
`art.footpath`). **If you are changing the ground**, the five things to know:

1. **Key variation off corners, never off a tile.** Anything tile-shaped that
   differs from its neighbour is a seam; `groundprobe` will read it.
2. **The ground has its own evening table** (`duskTable(amount, true)`), so
   a new ground key is a key at dusk too — the meadow and the paths added
   none (grass keys, and the earth ramp's two middle keys).
3. **The frame check composites every open tile's expectation.** A new
   overlay on grass must be added to it, or the pixel-for-pixel check fails —
   which is the point.
4. **A sparse overlay decides its coverage world-sized.** A per-pixel dither
   drawn again at 2× is a different drawing, and `check.mjs`'s twin gate (ink
   within 12% of 4×) refused the first trodden path at 19% — decide which
   pixels are covered once per 1× pixel, and only the grain per pixel. Run
   the whole suite: that gate is not in `check-ground`.
5. **Read the control before the bar** (trap 15), and run the probe on the
   previous tip as well as yours: the quilt is the fault it must be able to
   see.

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

**T4.0, the coats — BUILT** (§48). This brief said to start from the coats,
and they were worse than it said: SEVEN for fourteen (the kit painted the
tortoise in the fox's and the cat's), the beaver and the bear ONE ANIMAL by
`tools/zooprobe.mjs`, five dark coats FLAT in their shaded look, and the dark
greys closer to the road than the olive tortoise ever was to the lawn. The
table is the kit's now (`COATS`, SPEC §12.3): fourteen coats, all from ramps
that existed. **If you are changing a coat or adding a species**, the five
things to know:

1. **The coat is the art's.** `COATS` in `js/art/citizens.js`; the sim's
   `fur`/`furShift` columns are read by nothing but `check-animals`' control.
2. **Four rules, all in `check-animals`**: fourteen different coats; no shift
   below 0 on a four-rung ramp (or the shaded look goes flat — trap 16); the
   lit rung of every look further from grass n o p and road 3 2 than the olive
   tortoise's 9.8; and no two figures zooprobe calls close on one ramp.
   `node tools/zooprobe.mjs` reads a table before you commit it;
   `zooReadings({ coats })` reads one that is not live.
3. **Read the crowd, not the table.** A search found 280 tables that pass
   the rules inside its shortlists and chose a light-grey skunk. `node
   tools/zoo-sheet.mjs` draws a crowd through the real renderer.
4. **A new ramp is a new place for the evening to land.** `furDark` was built
   for this tier and taken out: its keys were within ΔE 4.2 of keys the
   palette has, and it re-mapped seven keys of existing art at dusk.
5. **The 2× pass asks the composer** (`CITIZEN_DETAILS.authored`) what is fur
   and where the figure ends — and `check-closeups` refuses a species whose
   fur the twin merely enlarges.

**T4.2, the builds — BUILT** (§49). The big build carried four figures the
eye could not split without the fur — the bear and the pig 3.5 apart, the
beaver and the bear 4.0, against a bear mid-stride 5.7 from itself — and the
beaver and the pig, in coats too alike to split, 1.08 strides apart. The pig
wears a third build, `stout`; the beaver wears `small`, where its paddle shows.
**If you are changing a body or a species' build**, the four things to know:

1. **The builds are the art's, and the instrument reads any table.**
   `BUILDS` in `js/art/citizens.js`; `zooReadings({ builds })` draws every
   species in the body named, through the kit's own composer (`opts.build` —
   an instrument's hook; the game never passes it).
2. **Two rules, both in `check-animals`**: no two figures closer than one
   animal is to itself mid-stride; and where two coats are too alike to split,
   figures 1.4 strides apart or more (the rabbit and the mouse, 1.48, are the
   witness the bar sits under). T4.0's CLOSE rule is the same idea the other
   way round — where the figure cannot split two animals, the coat must.
3. **One new body cannot part three animals that must all stand apart.** On
   a shared body a species is only its head and its tail; the tails hang
   behind, so a body that bulges at the back hides the one thing left to tell
   them apart. Keep the back flat.
4. **Every build keeps the same row plan** — the shirt on body rows 0–4, fur
   below, the feet on the anchor — which is why the look marks, the elder
   marks, the glasses, the hat, the sack, the cart and the suit needed no
   change. A build of another HEIGHT would move all of them.

The idles the list asked for with T4.2 have existed since `2fcfe8e`
(2026-09-03): fourteen species-specific pauses of a few pixels each.

**T4.1 — authored 2× heads — is next.** The head is the ID mark; leave the
body procedural. On one build two animals are only their heads and their
tails, so the head carries more than it did. `CITIZEN_DETAILS.authored` is
what an authored head will need to know where it may paint.

Two hard constraints, both pinned exactly:

- **`allCitizens().length === 3236`** and **504 portraits**
  (`check.mjs:6332`). Anything that adds a sprite to the citizen matrix moves
  those. The foot shadows are deliberately outside it.
- **`check-closeups` forbids a citizen twin expanding its silhouette**
  (`old === "." ⇒ new === "."`). An authored head must fit the procedural
  outline it replaces.

`furDark` was deliberately NOT added in T2.1 — a ramp with no consumer is a
guess — and was built for its consumer in T4.0 and not added then either,
measured: see point 4 above. If a black animal is ever needed, the palette's
floor is the constraint, and timber's and fabric's dark ends are the answer.

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

Two corollaries, both learned the hard way, and the second one cost more than
the first.

**A gate that reads the code's own answer is not a gate.** Write the number in
the check.

**And a gate that only asks whether something EXISTS is barely a gate.** T3.1's
fixture hash was the lighting hash in disguise for an afternoon while a check
written to catch exactly that stayed green — because a locked hash still
produces both kinds of window, and "both kinds appear" was all the check asked.
What caught it was a share that had to MOVE. Prefer a quantity to a predicate;
and the only way to find out which of the two you actually wrote is to mutate
the code and watch the suite fail to notice.

---

Maker's mark — Claude Opus 5, sessions 21 and 22. Four things I did that I
would do again: I built the receipt before the art; I let the geometry correct
four of my own pre-registered claims; I wrote a confident comment explaining
why two hashes could not possibly lock, then measured them locked and left the
comment standing with its correction written into it; and I built a palette
ramp for the dark, measured it at a tenth of a luminance point, and took it
out again.

**The ramp I took out is the one I would most like kept** — not the ramp, the
habit. Everything in this file that is worth anything came from being willing
to measure my own good idea and then delete it.

Beneath it — Claude Opus 5.5, session 22 continued (T3.2). I kept the habit:
my own pre-registered bar failed the apartment, and the first thing it caught
was not the apartment but the metric that had been flattering it. I fixed the
metric, then the building, in that order. And I learned the lesson of this
file's trap 13 from a check I had never touched — its "lawn" was a wall.

And beneath that — the same, T3.3. I was asked for a repeat and measured a
quilt; I set a control beside the first number I drew, and the control threw
the number away. And I wrote "nobody walks on the grass" into three files
before reading the one file that hands every walker its path. Trap 14 is
mine.

And the same again, T4.0. I was pointed at seven coats and found the light
gone out of five of them; my first reading for an animal lost on its ground
could not see the one animal known to have vanished; and I built the black
this brief had saved for me, measured it, and took it out. Traps 16 and 17
are mine — the second one twice in an afternoon.

And T4.2. I was asked for one body and found that one body could not do it;
my first round body hid the tails that were left to tell two animals apart;
and when I turned the mutation harness on my own T4.0 gate, a check I
had written to prove the coat stays out of FORM turned out to compare a
thing with itself. Trap 18 is mine, and it had been green for a tier.
