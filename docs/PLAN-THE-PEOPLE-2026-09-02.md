# PLAN — The People: thoughts, lives, faces, homes (a master plan in seven parts)

The owner (2026-09-02, night): *"can you come up with a master plan for how to
really improve zoo city? … please break it up into parts so that multiple
agents can work on different parts at the same time. one part i'd like is to
be able to see the residents thoughts when they walk around. a larger goal of
relating more strongly with the individual citizens. i think more character
and variety in the building sprites might help."*

Plan only. Nothing here is built. Each part is sized for one agent-session,
owns its own files, and codes against contracts written down in §3 so the
parts can run at the same time. The keel (§3) lands first and is small.

---

## 0. The thesis: what makes a player care about one animal

A city builder's population is a number until the game does five things,
and Zoo City already does the sixth (stakes: an animal can be put in a
sack). Each part below is one of the five, and the sixth is served by all of
them.

| the player must be able to… | today | part |
|---|---|---|
| **hear** them — a voice, in character, about their actual life | the card says `mood 41` | **A. Thoughts** |
| **remember** them — a past the player witnessed | a citizen has `born`, `friends`, a `record` and nothing else | **B. Lives** |
| **attend** to them — pick one and stay with it | the card follows the hover; a walker's card dies with the walker | **C. Follow and favourites** |
| **recognise** them — pick one out of a crowd | every rabbit is the same rabbit; elders one shade lighter; one hat | **D. Looks and faces** |
| **see them in their homes** — the house tells you who lives there | 12 families × 2 mirrored variants, no occupant on the outside | **E. Buildings with character** |
| **be told** what happened to them | 74–84% of dispatches never pop; no dispatch names a birth or an ordinary death | **F. The story channel** |

Then **G. Integration** — the suite, the docs, the browser round — after
the six have merged.

The order of importance if the owner has to choose: **A, B, E, D, C, F.**
A is the one they named; B is what makes A's lines true; E is the other
thing they named; D is cheap and makes every screenshot better; C and F are
the plumbing that turns the first four into attention.

---

## 1. Measured ground (numbers the plan has to respect)

Measured tonight on the committed code, seed 7, scripted mayor, balanced,
one meat market, stations on, 30 years (`scratchpad/savesize.mjs`; a
throwaway — part G writes the real instrument):

| figure | value | why it matters |
|---|---|---|
| P at year 30 | 1,732 alive · 1,055 households · 3,220 ids ever | the graveyard is as big as the town |
| save size | **906 KB**, of which citizens **732 KB** at **380 bytes each** | ~two thirds of a citizen's bytes are default `false`/`0`/`-1` fields; a biography ledger has to pay for itself — §4-B does, by compacting the save first |
| mean friends per citizen | **0.67** (1,154 links / 1,732) | the friendship graph is THIN. Most animals have no friend to lose. Thoughts and lives will lean on jobs, homes, smoke and neighbours more than on friends — and the low number is itself a design finding for later (it is a `FRIEND_P`/`FRIEND_MAX` knob question, not this plan's) |
| log rows in 30 years | 373 | the feed can afford ~+40% rows/year of people news before it drowns (§4-F budgets it) |
| walkers on screen | ≤ 150 | six bubbles is the readable cap; a bubble per walker is noise |
| building families | 12 × 2 variants, `variant & 1` in `render.js:311` | `world.variant[i]` is a saved Uint8 — bits 1–7 are free, and keying by the TILE's byte is already the identity law |
| suite | 167 checks | every part adds its checks to the same file, in its own Part letter |
| the hover card today | name · species · age · home/job/mood · custody/record · trespass · friends · doing | this is the whole relationship surface; C rebuilds it around a citizen, not a tile |

---

## 2. Laws every part obeys (SPEC §0, plus what this plan adds)

1. **Determinism.** No `Math.random`; the sim's stream for sim choices, the
   walkers' stream for display choices. A thought, a look, a bubble, a star,
   a follow — none may move the state hash. The suite's on/off hash check
   (SPEC §14) extends to every new display feature: **run 30 years with the
   feature on and off; the hashes are equal.**
2. **The sim never reads the browser.** `zoo.pref` (stars, follow) stays in
   `ui.js`/`main.js`; Part B of the suite greps `js/sim` for it. A starred
   citizen's toast is a UI line, **never a log row** — the log is saved and
   hashed.
3. **One implementation (Law 6).** A thought about smoke is computed from
   the same term `moods()` subtracts. A biography sentence is written by one
   function the card, the People tab and the news all call. Never a second
   copy of a rule in the UI.
4. **Identity, never an index.** A citizen's look is `hash(id)`; a building's
   variant is `world.variant[i]`; a thought's phrasing is `hash(id, code)`.
   Nothing keyed by position in a list.
5. **Art is text (Law 5) — with one ruling this plan makes:** the bubble's
   BOX is a palette-key sprite; the LETTERS in it are canvas text in the
   panel's monospace, drawn in screen space, and are not audited as art.
   SPEC §12 gets the sentence. `render.js` stays the only canvas module —
   the card's portrait is painted by a `render.js` export, not by `ui.js`.
6. **Additive.** Old saves load (a missing `life` is `[]`; a missing `names`
   is `{}`); the scripted mayor's hash is unchanged by every part except
   where a part says so and proves the new number.
7. **The working tree is CRLF.** Patch scripts normalise on read and write
   back in kind. Stage explicit paths. Never `git add -A`.
8. **A new dispatch prefix must join `TICKER_*`** or it lands in the
   reader's "all" chip and nowhere else, silently (handoff §13b).
9. **Buildings are per-frame; the ground is cached.** Nothing in this plan
   needs `invalidate()` for a building change — but a part that adds a
   ground mark does.

---

## 3. The keel — lands FIRST, one agent, small (≈ 150 lines, ½ session)

Everything the parallel parts code against. No feature, no pixel; the suite
stays 167/167 and the mayor's hash does not move.

**K1. `moodTerms(world, c) → [{ code, value }]` in `js/sim/citizens.js`.**
`moods()` becomes `sum(moodTerms(...))` — the same terms in the same order,
so the hash is the proof. Codes, one per term as `moods()` stands tonight:
`BASE 50 · JOB +15 · NO_JOB −20 · SMOKE −0.5·excess · PARK +10 · DREAD ±
· VAN − · FRIENDS +5n · FLIGHT −min(20,·) · CRIME − · EVENT(id) ± ·
COMMUTE +10 · GRIEF −10 · PENALTY · FIXED − · HELD − · BOOST`. Part A reads
this list; nobody else recomputes a mood.

**K2. `js/sim/life.js` — the API only.**
```js
remember(world, c, kind, arg)      // pushes [tick, KIND[kind], arg] onto c.life (ring, LIFE_MAX 12); also pushes { id: c.id, kind, arg } onto world.lifeEvents
lifeLines(world, c) → string[]     // the sentences (stub returns [])
KIND = { BORN, ARRIVED, MOVED, HIRED, LOST_JOB, FRIEND, LOST_FRIEND, LITTER, LEFT_HOME, RETIRED, ARRESTED, FIXED, EXONERATED, KILLED, CENTENARY, ZONED_OUT }
```
`tick.js` resets `world.lifeEvents = []` beside `predations`; `newCitizen`
gains `life: []`; `save.js` writes `life` and `world.names` (the graveyard,
`{ id: "Name Surname·species" }`, empty tonight) and tolerates both absent.
No call sites yet — Part B adds them.

**K3. `world.majority[i]`** — a derived `Uint8Array` (species index + 1, 0
none), recomputed each tick in `census.js` from occupants (R) or staff
(C/I/M). Not saved; `rebuildDerived` recomputes it. Part E reads it.

**K4. `storyTick(world)` stub in `js/sim/story.js`,** called at the end of
`tick()` after justice. Part F fills it. It reads `world.lifeEvents` and
writes log rows; it is the ONLY place a life event becomes news.

**K5. Registry names reserved in `js/art/index.js`:** `art.bubble(w, h)`,
`art.portrait(species, opts)`, `art.mark(species)`, `art.look(id)` — each
throws "not built" tonight so a caller's typo fails loudly.

**K6. `walkers.list()` entries gain `thought: null`** and `make()` gains
`look: art.look(id)` (returns `{ shade: 0, mark: 0 }` until D lands).

**K7. This file's §5 ownership table** copied into `BACKLOG.md` under a new
heading, so an agent that only reads BACKLOG finds its lane.

---

## 4. The parts

Each part: the goal · the design · files it OWNS (nobody else edits them
while it runs) · the contract it exposes or consumes · acceptance · traps ·
size. "Done" for every part is the project's recipe (handoff §9): suite
green, SPEC section, BACKLOG entry, a handoff section appended (never
edited), commit with the field-notes message, pushed, a browser or
play-camera proof in the commit message.

### A. Thoughts — *"see the residents thoughts when they walk around"*

**Goal.** A walking animal shows, now and then, one short line in its own
voice about its own life, and the line is TRUE — it is the sim's largest
mood term or its newest life event, in words.

**Design.**
- `js/sim/thoughts.js` (DOM-free, pure, no RNG): `thoughtOf(world, c,
  errand = null) → { code, arg }`. Priority: (1) a life event in the last
  two months from `c.life` (`LOST_FRIEND`, `LITTER`, `HIRED`, `LOST_JOB`,
  `MOVED`, `LEFT_HOME`, `ARRESTED`, `FIXED`, `EXONERATED`, `CENTENARY`);
  (2) the errand the walker layer passes in (`COMMUTE`, `STROLL`, `CUB`,
  `MEET(name)`, `PREDATION(name)`, `ARRIVAL`, `RIDING`) when the roll says
  "errand" (see the walker rule); (3) the largest-|value| term from
  `moodTerms` other than `BASE`/`BOOST` (`NO_JOB`, `SMOKE`, `PARK`,
  `FRIENDS(n)`, `FLIGHT(species)`, `DREAD`, `VAN`, `CRIME`, `COMMUTE`,
  `GRIEF`, `FIXED`, `HELD`, `EVENT(id)`); (4) `IDLE`.
- `js/sim/voice.js`: `LINES[code][diet | species]` → 2–3 strings with
  `{name}` `{n}` `{species}` slots, ≤ 30 characters, the game's register
  (dry, field-guide, a little dark: the wolf on a predation walk thinks
  *"the Howells are having the neighbours in"*; the rabbit next door to
  wolves, *"they moved in next door. all six."*; smoke, *"the works gets in
  my fur"*; no job, *"third month. nobody's hiring rabbits"*; five friends,
  *"a full dance card"*; the tortoise's idle, *"no hurry"*). A species table
  overrides a diet table overrides a default. `line(world, c, thought) →
  string` picks by `hash(c.id, code) % n` — **the same animal always says
  the same thing about the same thing.** That consistency is character.
- `js/walkers.js`: `w.thought = { code, arg, text, until }`. At spawn and at
  every leg change the walker rolls on the WALKERS stream: p 0.35 to think
  at all; if so, 0.4 errand / 0.6 `thoughtOf` with the errand as fallback.
  Shown `THOUGHT_SHOW` 3 s, then a gap of 5–9 s before the next roll. Cap
  `BUBBLES_MAX` 6 visible in the viewport: priority to the followed/pinned
  citizen (Part C sets `walkers.attend(id)`), then tier (1) over (3) over
  (4), then nearest the screen centre. `list()` carries `thought`.
- `js/render.js`: after the scene, in screen space: for each visible walker
  with a live thought, `art.bubble` nine-sliced to `measureText` + 6 px,
  the panel's monospace at 10 px screen pixels (not scaled with zoom), 1-px
  ink border, a 3-px tail to the head (dy −24 adult, −16 cub), clamped to
  the canvas, painted in (tx+ty) order. Bubbles fade in the last 0.4 s
  (alpha, not a sprite).
- The card gets a `thinks: …` line for ANY citizen, walker or not (the same
  `thoughtOf`), so a resident at home still has a thought when you hover
  their house (C consumes; A exposes).
- `tools/peopleprobe.mjs` (new, exit 0 always): 4 seeds × 30 y, every
  citizen sampled monthly through `thoughtOf`: a histogram of codes, the
  share of `IDLE`, the mean bubbles-on-screen from a simulated 150-walker
  viewport. The commit message carries the table.

**Owns.** `js/sim/thoughts.js`, `js/sim/voice.js`, `js/walkers.js`, the
bubble block in `js/render.js` (its own function, `drawBubbles`), a
`BUBBLE` sprite in a new `js/art/bubbles.js`, `tools/peopleprobe.mjs`, the
Part E' checks in `tools/check.mjs`, SPEC §14b, `docs/shots/sheet-bubbles.png`.

**Consumes.** K1 `moodTerms`, K2 `c.life` (empty until B lands — A must
work with `life: []` and its checks must not require B), K5 `art.bubble`,
K6.

**Acceptance.**
- Every code `thoughtOf` can return has a line in the default table, and
  every species/diet override is a known code (a table typo fails).
- Over the probe's 120 city-years every code appears at least once and no
  code is > 40% of non-idle samples (a code that never fires is dead text; a
  code that dominates is noise) — **the "metric must discriminate" rule.**
- Mutation: zero the `SMOKE` term → the millbelt town's `SMOKE` share
  drops to 0; the check fails if it does not.
- Hash: 30 years with thoughts on and off equal; `js/sim` never reads
  `.thought` (grep).
- Browser: seed 7 ring city at ×1 and ×2, a screenshot with ≥ 3 bubbles
  legible; the followed citizen's bubble always present while it walks;
  0 console messages; the frame with 6 bubbles costs < 1 ms over the
  frame without (measured with `performance.now()` around `draw`).

**Traps.** Canvas text scales with the zoom transform — draw bubbles AFTER
resetting the transform. `measureText` is per frame ×6 — cache by text.
The hidden pane fires no rAF: verify with the sim paused and
`app.walkers.update(0.05, …)` by hand (handoff §14's recipe). A thought
that names a friend must survive the friend dying that month — resolve the
name through `world.names` (K2), never `byId` alone.

**Size.** ≈ 350 lines sim + 120 walkers + 80 render + 60 art + 200 probe;
~12 checks; one session.

### B. Lives — the biography every animal carries

**Goal.** The card reads like a life: *born here 1998 to the Burrowes ·
moved to (12,30) 2003 · hired at the works 2004 · befriended Fenpa Howell
2006 · lost Fenpa 2011 — the wolves · retired 2033.* And the town remembers
its dead by name.

**Design.**
- Fill K2. Call sites, each ONE line `remember(world, c, KIND.X, arg)`:
  `citizens.js` — arrival placement (`ARRIVED`, lot), birth (`BORN`, lot;
  the parents get `LITTER`, n), the 16-year split (`LEFT_HOME`), rehome
  (`MOVED`), retirement month (`RETIRED`), `befriend` (`FRIEND`, id — both
  sides), `removeCitizen` (`LOST_FRIEND`, id + cause, to every friend; and
  the graveyard write `world.names[id]`); job search hire (`HIRED`, lot),
  `releaseJob` when the lot dies (`LOST_JOB`); `justice.js` — arrest
  (`ARRESTED`, cause), `fixed`, `exonerated`, the killing (`KILLED`,
  victim id, on the killer); `events.js` — the centenary; the zoned-out
  notice (`ZONED_OUT`).
- `c.life` is a ring of `LIFE_MAX` 12 triples `[tick, kindId, arg]` — the
  first two entries (birth/arrival, first home) are PINNED and never roll
  off; the ring is the last ten.
- `world.names`: written on every removal, pruned to `NAMES_YEARS` 20 by
  death tick in `compact()`. ~45 KB at year 30.
- `lifeLines(world, c)` — the one writer of sentences (Law 6): dates in the
  game's year, lots as `(tx,ty)` plus the family name that lives there NOW
  if any, names through `byId` then `names` then "someone".
- **The save pays for it:** first commit, before any call site — `save.js`
  omits a citizen's DEFAULT fields (`false`, `0`, `-1`, `null`, `[]`) and
  `load` restores them from `newCitizen`'s defaults. Prove: an old save
  loads and hash-equals; the year-30 save shrinks (expect 732 KB → ~300 KB
  of citizens). Then the ledger's +~150 KB is a net saving.
- The Census tab gains a **Memorial** line (F/C render; B provides
  `memorial(world) → [{ name, species, age, cause, tick }]` for the last
  12 months from `names` + a small `world.deaths` ring).

**Owns.** `js/sim/life.js`, `js/sim/save.js`, the call-site lines in
`js/sim/citizens.js` / `justice.js` / `events.js` (one-liners only — A
never edits these files after K, F never edits them at all), the Part F'
checks, SPEC §7.10, `tools/savesize.mjs` (the throwaway made real: prints
the year-30 save's size by section; exit 0).

**Contract exposed.** `c.life`, `world.lifeEvents` (per tick), `world.names`,
`lifeLines`, `memorial`, `KIND`.

**Acceptance.**
- The dangling-id law extends: every `FRIEND`/`LOST_FRIEND`/`KILLED` arg
  resolves through `byId` or `names`; the ring never exceeds 12; the
  pinned two survive 20 events.
- **Every KIND is observed at least once** in the 30-year forced run (the
  suite already forces a killing, an arrest, a centenary — reuse those
  fixtures); a kind never observed fails — that is the mutation test for a
  dropped call site.
- Save → load → continue hash equal with lives on (the standing check);
  old-save fixture (`docs/fixtures/save-v1-plain.json`, committed by B)
  loads and its 10-more-years hash equals the pre-B number written in the
  commit message.
- `savesize.mjs`: citizens' bytes at year 30 ≤ 60% of tonight's 732 KB
  with the ledger in.

**Traps.** `removeCitizen` runs in the same tick as the friend's `moods()`
— record `LOST_FRIEND` BEFORE the splice, or the friend list is already
empty. `compact()` renumbers nothing (ids are stable) — but check
`world.names` is pruned there and nowhere else. A `MOVED` at arrival is not
a move — `ARRIVED` only. The centenary is logged in `events.js` since
session 8 (`say(id, line)`); hook the same place.

**Size.** ≈ 250 lines + 30 one-liners; ~10 checks; one session, the save
compaction first as its own commit.

### C. Follow and favourites — attention as a mechanic

**Goal.** Pick an animal and stay with it: the card is pinned to the
CITIZEN (not the walker), the camera follows it when it walks and rests on
its home when it does not, a star keeps it in a People tab, and its life
events reach you as they happen.

**Design.**
- `js/follow.js` (DOM-free): `followTarget(world, walkersList, id) → { tx,
  ty, state: "walking" | "home" | "away" | "gone", line }` — pure, so it is
  unit-checked in Node. "away" = at the centre/cells/winter; "gone" = dead
  or emigrated (the target holds on the last known home and the line is the
  epitaph from `lifeLines`).
- `input.js`/`main.js`: click a walker or a name → `app.pin = { citizen: id
  }`; `F` toggles follow (camera lerps to the target each frame, 4 tiles/s,
  released by any drag); `S` toggles the star; `Esc` unpins. The pinned card
  outlives the walker; when the citizen dies the card stays with the
  epitaph until the next click.
- `ui.js`: `cardForCitizen(id)` replaces `cardForWalker` (the walker is one
  input to it): portrait (D, via `render.paintPortrait(canvas, sprite)`),
  name · species · age · household line · home/job · **thinks:** (A) ·
  **life:** (B, last 4 lines, "more" expands) · friends (each a link that
  pins that friend) · doing · star/follow buttons.
- The **People** tab (fifth tab; SPEC §11 lists four — the plan adds one):
  starred first, then notables computed by a DOM-free `notables(world)` in
  `js/sim/census.js` (oldest resident, biggest household, most friends,
  newest litter, the last arrested, the last killer) — each row: portrait,
  name, species, age, mood, one life line, find · follow · star.
- Stars in `zoo.pref.stars[city] = [ids]` (browser-only, like read marks);
  starred citizens' `world.lifeEvents` become UI toasts (`flash`, never a
  log row — Law 2) — *"★ Fenpa Howell was hired at the works (30,12)"*.
- `walkers.attend(id)`: the followed citizen is sampled first every tick
  when its path crosses the viewport, so following actually shows walks.

**Owns.** `js/follow.js`, `js/input.js`, `js/main.js`, `js/ui.js` (the
card, the tabs, the People tab), `css/field.css`, `notables()` in
`census.js`, `attend()` in `walkers.js` (ONE function, coordinated with A
— A adds the sampler priority hook; C calls it), the Part G' checks, SPEC
§11c.

**Consumes.** A's `thoughtOf`/`line`, B's `lifeLines`/`memorial`/
`lifeEvents`, D's `art.portrait` + `render.paintPortrait`. C can start on
day 0 against the K stubs and fills the card as the others land.

**Acceptance.**
- `followTarget` in Node: walking → the walker's tile; between walks →
  home; after `removeCitizen` → "gone" with the epitaph; a citizen with no
  home → "away".
- `js/sim` never reads `zoo.pref`, `pin`, `stars` (grep).
- Browser: pin a rabbit, press F, run ×3 for a game year: the camera stays
  within 3 tiles of it while it walks and on its house otherwise; star it;
  the People tab lists it; a hire toast appears when its `HIRED` fires
  (force with the cheat: bulldoze its job lot); 0 console messages.

**Traps.** `#tools` wraps — a fifth tab must not unwrap it (handoff §11).
The card is rebuilt on every hover today — a pinned card must not flicker
(rebuild only on tick or pin change). A loaded city opens paused; the
follow camera must not lerp while paused. The People tab's notables walk
all citizens — compute on tick, not on render.

**Size.** ≈ 120 follow + 250 ui + 60 input/main + 40 css; ~8 checks; one
session.

### D. Looks and faces — one rabbit is not another rabbit

**Goal.** Four looks per species per age, a face for the card, and an idle
pose — so the player can pick their rabbit out of the crowd and the card
has eyes.

**Design.**
- `art.look(id) → { shade: 0|1, mark: 0|1 }` from `hash(id)`. Shade 1 = the
  fur ramp one step DARKER (elder is one step lighter — the two compose;
  never off the ramp: Law 5). Mark = one hand-authored piece per species,
  SE and NE, ≤ 6×6 px, placed by the head/tail composer: fox white tail-
  tip · rabbit lop ear · mouse notched ear · beaver pale chest · owl brow
  tufts · bear muzzle patch · tortoise scute · raccoon lighter mask · pig
  spot · cow Holstein patch · wolf grey saddle · cat tabby stripe · hawk
  chest bars · skunk double stripe. Cubs: shade only. Elders: a glasses
  piece (1, like the hat) on 1/2 of elders by hash. Cache key gains `s m g`.
- `art.portrait(species, { age, shade, mark, expression }) → 16×16`: the SE
  head rows of the kit lifted into a frame, eyes and mouth by expression
  (`glad` ≥ 70 · `flat` · `low` ≤ 30: two pixels each). 14 × 3 × looks —
  composed lazily like everything else.
- `render.paintPortrait(canvas, sprite, scale)` — the one canvas export
  `ui.js` may call (Law 5's ruling).
- Idle pose (stretch, do last): one SE frame per species (rabbit sits up,
  cat washes, owl turns its head, bear scratches, tortoise withdraws),
  mirrored for the rest; a walker standing > 1 s plays it (A's walkers
  code reads `w.idle`; D adds the frame index `frame: 3`).
- `walkers.make()` copies `look` (K6); `render.js`'s two `art.citizen`
  calls pass `look` and the card's portrait passes the same.

**Owns.** `js/art/citizens.js` (the art — A does not touch it; A's bubble
lives in `art/bubbles.js`), `art.look`/`art.portrait` in `index.js`,
`paintPortrait` in `render.js` (one export, its own function), the
`sheet-looks.png` / `sheet-portraits.png` blocks in `tools/shots.mjs`, the
Part C additions in `check.mjs`, SPEC §12.3b.

**Acceptance.**
- The four looks of every species × age differ pairwise (rows not equal);
  a mark changes pixels only inside its declared piece box; the carrying
  sprite (SPEC §14) still has the plain sprite's body rows with a mark on;
  anchor on the feet for all.
- 14 portraits × 3 expressions exist, 16×16, every pixel a key, expressions
  differ.
- The audit walks every look (`allCitizens` adds one species × 4 looks ×
  4 facings × 3 frames + all 14 portraits × 3).
- Sheets committed; the commit message names the three ugliest marks by
  the critic's eye and what was done about them (the art workflow of
  session 1: artist + 2 PNG-reading critics, ≤ 3 rounds).

**Traps.** The tortoise's 1-px outline is clipped by the 12-px grid
(handoff §14) — a mark on its shell must not be. Mirror-lit: a mark on the
LEFT of a SE sprite lands on the RIGHT of SW — author marks symmetric or
accept the flip and say so. The predation figure at the door (`w.prey`) is
built from a record — give the record a `look` too (B's `KILLED` arg or
A's prey figure: `art.look(victim.id)`, it is pure).

**Size.** ≈ 400 lines of art text + 80 composer + 40 shots; ~8 checks;
one session with the art workflow.

### E. Buildings with character — *"more character and variety in the building sprites"*

**Goal.** Four plans per family instead of two mirrored ones; windows that
light with the people inside; a mark on the outside that says who lives
there. The house becomes part of the citizen.

**Design.**
- **Variants 2 → 4.** `render.js:311` reads `world.variant[i] & 3`. Two new
  authored plans per family (24 plans, all box solids through the existing
  rasteriser, the footprint gate already checks them): R1 porch + dormer /
  L-plan + lean-to · R2 bay window / mansard · R3 corner balconies / roof
  garden setback · C1 corner entrance / kiosk row · C2 clock face / arcade
  front · C3 setback tower / twin stacks · I1 open shed + stack / kiln ·
  I2 chimney pair / conveyor bridge · I3 cooling tower / gantry · M1–M3 a
  hook rail / a tiled front / a chimney hall (M is 4 × 3 = 12 sprites today;
  keep the abattoir for the landmarks proposal). Variants 2 and 3 of a
  family are NOT mirrors of 0 and 1 — that is the point.
- **Lit windows by fill.** `lit = floor(4 · fill)` (0..3) on R (occupants/
  capacity) and C/I/M (staff/jobs); the window skin returns the lit key
  `-` for a deterministic subset of window cells (`hash(i, cell) % 4 <
  lit`), so a full tenement glows and a vacant one is dark. Sprite cache
  key gains `lit`. Buildings are per-frame, so no invalidation.
- **Species marks.** `art.mark(species)` = one stamp ≤ 6×6 px per species;
  each plan declares a `socket` (a wall cell beside the door and a roof
  cell); `world.majority[i]` (K3) chooses the stamp: warren round door ·
  mouse's small second door · fox brush weathervane · beaver timber gable ·
  owl roost pole · bear porch bench · tortoise stone step · raccoon bins ·
  pig mud patch · cow gate · wolf pack banner · cat window ledge · hawk roof
  spike · skunk a warning stripe on the kerb. C/I/M marks go on the roof
  socket (the shop's majority STAFF). The card says *a warren door — the
  Burrowes live here*.
- **Wear (stretch).** `world.since[i]` Uint16 (the tick the tier last
  rose; saved, +8 KB): ivy stamp after 15 years, a patched roof after 25.
  Only if the four variants and the marks are in.

**Owns.** `js/art/buildings.js`, `art.mark` in `index.js`, the building
block in `render.js` (`standing = …` and the sprite-key lines ONLY), the
`sheet-buildings.png` / `sheet-marks.png` blocks in `shots.mjs`, Part C
additions, SPEC §12.2b, the card's mark sentence in `lots.js`'s
`lotReport` (a `mark` field; C prints it).

**Consumes.** K3 `world.majority`.

**Acceptance.**
- Footprint gate holds for all 24 new plans (the existing check runs over
  `allBuildings`); the four variants of every family differ pairwise; a
  mark's pixels lie inside its socket box; lit 0..3 is monotone in ink
  count of `-` cells; every species has a mark.
- The play camera (`tools/play.mjs --at 2020-06`) on seed 7 before and
  after: the SAME lots stand (the hash did not move) and the PNG differs —
  the "render upgrade must be visible" rule; commit the two frames.
- Sheets committed; the critic round as in D.

**Traps.** `variant & 1 → & 3` changes what half the town looks like — that
is intended; say so in the commit and re-shoot `docs/shots/*.png`. The
zoo's 2×2 depth path is the only multi-tile precedent — the landmarks
proposal (3×3) also wants `buildings.js`; **put landmarks in
`js/art/landmarks.js` when they come so the two can run apart.** A mark on
a mirrored variant sits on the other side — declare sockets per variant,
not per family.

**Size.** ≈ 500 lines of plans + 100 marks + 40 render + 60 shots; ~8
checks; one session, two if wear is in.

### F. The story channel — being told

**Goal.** The news tells the town's people-stories (an obituary, a litter,
a first job for a starred family's cub), every named row is clickable, and
the yearly REPORT names the year's people.

**Design.**
- Fill K4. `storyTick` reads `world.lifeEvents` and writes log rows with a
  `who: [ids]` field (saved with the log — small): `OBITUARY` for a death
  with ≥ 3 mourners (*"Fenpa Howell, 61, a wolf of (12,30), mourned by
  four"*), `LITTER` (*"a litter of three to the Burrowes of (12,30)"*), the
  `CENTENARY` moves here from `events.js` (one writer — coordinate with B,
  who hooks the same place: F's `storyTick` reads the `CENTENARY` life
  event B records; B stops logging it). Budget: ≤ +40% rows/year measured
  by `newsprobe.mjs`; none of them in `TICKER_FLASH` except the obituary of
  a centenarian.
- The reader's fifth chip **people** = rows with `who.length`; a name in a
  row is a link → `app.pin` + centre on the home (C's `pin` API).
- The yearly REPORT gains two sentences from `census.notables` (C owns
  `notables`; F consumes): the oldest resident, the largest household.
- `TICKER_*` gains `OBITUARY|LITTER`; the per-event chip check the handoff
  asked for (§13b) is built here: every `id` in `events.js`'s roster and
  every `story.js` prefix appears in exactly one chip's regex.

**Owns.** `js/sim/story.js`, `js/news.js`, the `TICKER_*` regexes, the
REPORT lines in `events.js`'s advisor (ONE function; B's call sites are
elsewhere in the file), `tools/newsprobe.mjs`, Part H' checks, SPEC §11b
additions.

**Consumes.** B's `lifeEvents`/`names`, C's `pin`, C's `notables`.

**Acceptance.**
- The chip check above; `newsprobe` shows people rows ≤ 40% of the feed
  over 4 seeds; every `who` id resolves via `byId` or `names`.
- Hash: `stateHash` excludes the INPUT log and history but hashes `events`,
  and the news log lives in `events.log` — so the mayor's hash MOVES with F
  (new rows). The commit records the old and new hashes and proves the ONLY
  difference is the news: F adds a `stateHashNoNews` (the same FNV with
  `events.log` deleted) to the suite for this one proof, and that number
  must equal the pre-F run's.
- Browser: a death with mourners prints; clicking the name pins the dead
  citizen's epitaph card (C).

**Traps.** Handoff §13b, all of it: the un-anchored `ONE HUNDRED`, the
400/200 log cap that cuts a month in half (a row's name is its words —
keep `keyOf`), the hidden pane's timers. An obituary for every death is
~40 rows/year in an 1,800 town — the mourner gate is the budget.

**Size.** ≈ 150 story + 80 news + 40 events + 40 probe; ~6 checks; half a
session.

### G. Integration — after the six have merged

One agent, after A–F are on `main`:
- Merge order if they collide: K → B → A → D → E → C → F (B before A so
  A's life-event tier has data; D before E so both sheets are re-shot once;
  C last among the UI because it consumes all of them).
- The suite end to end; every part's mutation tests re-run on the merged
  tree (a check that passed alone can pass for the wrong reason together).
- `tools/play.mjs --follow citizen <id>` (a new shutter: the camera tracks
  one animal's walker, falls back to its home) and a film of a starred
  rabbit's year for the README.
- `peopleprobe`, `newsprobe`, `savesize` numbers in one table in the
  handoff §16, plus each part's trap table (symptom-keyed).
- SPEC: §7.10 lives, §11c follow/people, §11b chips, §12.2b variants and
  marks, §12.3b looks and portraits, §14b thoughts; README's "the
  population is not a number" paragraph earns its sentence; BACKLOG
  reconciled (what each part left).
- A browser round of the whole: a fresh city, ×3 for ten game years,
  following one animal from arrival to its first friend; 0 console
  messages; the frame cost with all six on.

---

## 5. Ownership — who edits what (copied to BACKLOG by K7)

| file | K | A | B | C | D | E | F |
|---|---|---|---|---|---|---|---|
| `js/sim/citizens.js` | `moodTerms`, `life: []` | — | call-site one-liners | — | — | — | — |
| `js/sim/life.js` | API stub | — | **owns** | — | — | — | — |
| `js/sim/thoughts.js`, `voice.js` | — | **owns** | — | — | — | — | — |
| `js/sim/story.js` | stub | — | — | — | — | — | **owns** |
| `js/sim/save.js` | tolerate `life`/`names` | — | **owns** (compaction) | — | — | — | — |
| `js/sim/census.js` | `majority` | — | — | `notables` | — | — | — |
| `js/sim/justice.js`, `events.js` | — | — | call-site one-liners | — | — | — | REPORT lines (advisor fn) |
| `js/sim/tick.js` | resets + `storyTick` call | — | — | — | — | — | — |
| `js/sim/lots.js` | — | — | — | — | — | `lotReport.mark` | — |
| `js/walkers.js` | `thought`, `look` fields | **owns** | — | `attend()` | — | — | — |
| `js/follow.js` | — | — | — | **owns** | — | — | — |
| `js/render.js` | — | `drawBubbles` | — | — | `paintPortrait` | building block | — |
| `js/ui.js`, `input.js`, `main.js`, `css/` | — | — | — | **owns** | — | — | — |
| `js/news.js` | — | — | — | — | — | — | **owns** |
| `js/art/citizens.js` | — | — | — | — | **owns** | — | — |
| `js/art/bubbles.js` | — | **owns** | — | — | — | — | — |
| `js/art/buildings.js` | — | — | — | — | — | **owns** | — |
| `js/art/index.js` | reserve names | — | — | — | `look`, `portrait` | `mark` | — |
| `tools/check.mjs` | — | Part E' | Part F' | Part G' | Part C adds | Part C adds | Part H' |
| `tools/shots.mjs` | — | bubbles sheet | — | — | looks, portraits | buildings, marks | — |
| `tools/*probe.mjs` | — | `peopleprobe` | `savesize` | — | — | — | `newsprobe` |
| `SPEC.md` | — | §14b | §7.10 | §11c | §12.3b | §12.2b | §11b |

Two files are touched by two parts in DIFFERENT hunks (`render.js`,
`walkers.js`, `index.js`, `check.mjs`, `shots.mjs`, `SPEC.md`); each part
adds its own function/section and never edits another's. Git merges those.
`citizens.js` and `events.js` are the risk: B adds one-liners at call
sites; F edits one advisor function; A and D never open them after K.

## 6. Schedule

```
day 0   K (½ session)  ─┬─ A thoughts ──────────┐
                        ├─ B lives ─────────────┤
                        ├─ C follow (stubs) ────┤   G integration (1 session)
                        ├─ D looks ─────────────┤
                        ├─ E buildings ─────────┤
                        └─ F story ─────────────┘
```
Six sessions in parallel after the keel; C and F finish against the merged
tree because they consume the most. If only two agents are available: A+E
first (the owner's two named asks), then B+D, then C+F, K still first.

## 7. What this plan does NOT do, and why

- **The 3×3 landmarks** (`docs/PROPOSAL-LANDMARKS.md`): still awaiting the
  owner's go; E leaves `landmarks.js` as their home so both can run.
- **Friendship density** (mean 0.67 friends): a knob question that changes
  the hash and the cap curve; measured here, not touched. Lives and
  thoughts will make the thinness VISIBLE — that is the right order.
- **Sound** (L3), **elevation** (L2), **the wedding** (L1 — it wants B's
  ledger and the household merge rule; a natural follow-on).
- **Names on signs**: unreadable at 12 px; the card carries the name.
- **A day/night cycle** for the lit windows: lit-by-fill is the honest
  version and needs no clock.

## 8. Questions for the owner (none block the keel)

1. **Register of the thoughts.** The game's voice is dry and a little dark
   (*"did not come home"*). Should a predator's thought on its way to a
   neighbour be that dark, or should predation stay wordless on the
   killer's side and speak only through the prey's fear?
2. **Bubbles: text, or a glyph with text on hover?** The plan says text,
   six at a time. A glyph-only crowd mode is cheap to add later.
3. **A fifth tab (People)** or a section inside Census? The plan says a tab.
4. **The save compaction** (B's first commit) changes the save format's
   bytes but not its meaning; old saves load. Fine to ship, or keep the
   verbose form?
