# Proposal — Wealth and class: the ultrawealthy, their mansions, and whose burglary gets worked first

Status: proposal, 2026-09-05; BUILT 2026-09-05 (session 18) on its defaults, then REBUILT the same evening on the owner rulings — see the two notes at the end. Written the day the owner sketched
the arc, against HEAD `333408b`, so the seams are the code's own and not
guessed. The decisions the owner has not made are listed in §6 and nothing
here is built up toward one answer to them.

## 0. The owner's words (2026-09-05, verbatim)

> culture will be a boon to both happiness as well as property desirability,
> but later when we start getting into wealth/class it will be a prerequisite
> to more affluent housing. the ultrawealthy want to have a 3x3 plot next to
> everything, they will need their own sprites too for their mansions. any
> theft from the ultrawealthy gets priority policing and one step harsher
> punishment.

Three rulings and one sketch. The rulings: culture is BOTH a mood term and a
land-value halo (the knowledge-and-culture proposal's culture section is
settled by this — see its appended ruling); culture will later GATE affluent
housing; theft from the ultrawealthy gets priority policing and a harsher
sentence. The sketch: wealth/class as an arc, mansions as 3×3 plots "next to
everything" with their own sprites. This document is the scouting for that
arc. **Future context is not a current requirement**: the knowledge-and-
culture build should not wait on any of this. Its one free win is §5.

## 1. Where it lands in the code (the census)

| what | where | what is there today |
|---|---|---|
| a household | `citizens.js:105` `{ id, members, home, species, surname, arrived }`; saved `save.js:66` | no wealth, no class, nothing about money |
| arrival | `citizens.js:733–752`: species by weight, size by pack, `bestHome(strict)` then loose | a home is the vacant R lot maximising `homeScore` = LV − Pol·(1 − tol) + the species' one preference |
| what a lot offers | `homeTerms` (`citizens.js:257`): LV, pollution, dread, ONE species term with a `potential` | no culture, knowledge, park, shops or crime term; the Inspect wish reads `potential − value` |
| R lots | tiers 1/2/3 hold 4/10/24; `maxTierByLV` `LV_TIER [30, 60]`; blocks 2×2 120 · 3×3 270 (`blocks.js`) | a 3×3 R block is `towers`; a landmark re-skins it by kin (`world.theme`) |
| growth | `lotScore` R local term `(LV − Pol − 40)/200` | nothing about who lives there |
| tax | `budget.js:42` `rates.R × citizens × TAX_R_PER_CITIZEN 1.0` | flat per head; upkeep `UPKEEP_CITIZEN 12` per head |
| a burglary | `burglaryTick`: a HOT lot (crime > CRIME_HIGH) picked uniformly; `openFile({ tile, culpritId, victimId })`; `markBurgled` flags every adult at the address | the file has a `victimId` slot (killings use it); a burglary's victim is the ADDRESS |
| working a file | `filesTick`: every open file rolls once a month, `p = 0.02 + 0.10·force + 0.18·cover + 0.30·camera + 0.05·record`, cold after `CASE_MONTHS` | files are independent — ORDER means nothing, so "priority" has to be probability or time |
| the sentence | `arrest()` `justice.js:360–363`: theft 1 → prison 3 mo · theft 2 or murder → centre 6 mo, fixed · theft 3 or theft after pacification → the hall, SOLD · trespass 1 mo | one counter, `c.thefts`; "one step harsher" is `+1` on it |
| culture (ruled today) | to be built by the knowledge-and-culture arc | a per-tile strength field is the shape a housing gate can read |

What the genre does, for grounding and not for copying: SimCity 4's three
residential wealths "share the same likes and dislikes, but at different
levels of importance" — the rich weigh parks, land value, education and low
pollution/crime more, and mid-size high-wealth will not develop without a
park within reach ([StrategyWiki, SC4 zoning and demand](https://strategywiki.org/wiki/SimCity_4/Zoning_and_Demand);
[Simtropolis, demand and desirability](https://community.simtropolis.com/omnibus/simcity-4/reference/demand-desirability-and-abandonment-r31/)).
Cities: Skylines levels a home on LAND VALUE, which services, parks and
education raise ([C:S wiki, land value](https://skylines.paradoxwikis.com/Land_value)).
Zoo City already has the land-value half of that; what it lacks is the
class axis and the gate.

## 2. Class

**Class is a property of a HOUSEHOLD, decided once, by the lot it arrives
at.** Three classes — 0 modest, 1 affluent, 2 ultrawealthy — as `hh.wealth`,
saved beside `surname` (old saves read 0). A lot has an ATTAINABLE class
(§3); an arriving household takes the class its lot attains, keeps it for
life, and its cubs inherit it. A family that later moves to a lesser lot
stays what it was (old money in a cottage is a story, not a bug). Species is
untouched: a wealthy skunk is allowed, and the weights that pick who arrives
do not know about money.

Why the lot and not the job: the game has no wages, and building a wage model
to derive class from a tier-3 shop job is a second arc. The lot is the
owner's framing anyway — the ultrawealthy "want a plot next to everything".

**What class changes, first version:**

- **Tax.** `TAX_R_PER_CITIZEN × TAX_CLASS[wealth]`, proposed `[1, 2, 5]` and
  measured before it is believed. The point the Census must make visible: a
  few animals paying a large share (the probe in §7 records the share).
- **The card.** "the Slyfields, 4 foxes, affluent" / "the Greyback estate".
  Nothing else in version one — no mood, no crime, no birth rate by class.

## 3. The ladder — "next to everything"

The owner's word is PREREQUISITE, so these are gates, not weights (the
weights-never-gates law is about species and stays about species). One
function, `attainableClass(world, lot)`, returns the class and the LIST of
unmet items, so the card can say what is missing in the same words for a
plot, a wish and the Census. Proposed rungs, every number a KNOB:

| rung | class 1 affluent | class 2 ultrawealthy |
|---|---|---|
| culture (the owner's prerequisite) | any culture coverage at home (Gallery or Amphitheater) | Amphitheater-strength culture |
| knowledge | — | Library or University coverage |
| a park | a Park or Large Park within 4 (the PARK mood term's own test) | the same |
| shops | — | a C lot within 6 road tiles (`lotsWithinRoad`, already written for rehoming) |
| air | Pol ≤ 20 | Pol ≤ 10 |
| streets | crime ≤ 40 | crime ≤ 25 |
| the smell | dread 0 | dread 0 |
| land value | LV ≥ 60 (the tier-3 line) | LV ≥ 80 |
| nature | — | water or trees among the eight neighbours (`nature8 ≥ 1`, LV's own term) |

Every rung is a field the game already computes except culture and
knowledge, which the knowledge-and-culture build supplies as per-tile
strengths. The rungs are the reason a mansion is rare: the owner's 6×6
blocks with a road ring put shops, a park and an amphitheater within reach of
a corner plot only where the player has planned for it.

## 4. Affluent housing and the mansion

**Class 1 lives in the buildings the game has.** A tier-3 lot or a 2×2 whose
attainable class is 1 takes affluent households; the picture is the same
family with the People-E character layer turned the other way — `wear` held
at 0, a "kept" mark (hedge, awning, a lit lamp) on the socket. If the owner
wants distinct affluent families later, `blocks.js` takes a family per zone
and side and the People-E plans take a fourth plan per family; nothing in the
sim needs to know.

**Class 2 lives in a MANSION, and a mansion is a plot the player provides.**
The owner said the ultrawealthy "want to have a 3×3 plot", so version one
gives the player an **Estate** tool: a 3×3 residential plot placed like a
campus (atomic, needs a road touching, clear ground), stored as an R block
anchor (`world.big = 3`, tier 0) with a class marker. It is chalk until the
plot's attainable class is 2; then, and only then, it SPROUTS the mansion,
and only a class-2 household may arrive at it. Until then the card lists the
unmet rungs — "waiting for: a gallery within reach · a park within 4 · cleaner
air" — in the wish system's own words, so an empty estate is a to-do list and
never a mystery. Capacity `MANSION_CAP 8`: one household, two adults and
their cubs, on nine tiles that would hold 270 — that is the estate, and the
Census can say so ("the Greyback estate: 5 animals on nine tiles").

The other way a mansion could come to be — GROWTH, a tier-3 lot whose
attainable class is 2 absorbing its eight neighbours the way `mergeWindow`
absorbs a block, rehoming ninety animals within twelve road tiles — is
displacement, and it is the sharper joke. It is listed in §6 as the owner's
call, not built in version one: a mansion that appears where a player did not
put it is a surprise on a 6×6 block the player planned, and the wish system
has no way yet to say "your neighbours are about to be moved out".

**The marker.** A mansion is not a landmark (a landmark is 270 animals of a
kind; a mansion is one family), so it does not take a `world.theme` row.
Blocks carry side in `world.big`; class needs one more byte per anchor —
either a new tile array `world.klass` (which trips the `lives: v1 plain
fixture` gate by one all-zero line, as every new tile array has) or the high
bits of `world.theme`, which is free on a non-landmark anchor. The first is
honest and the second is clever; the proposal prefers honest.

**Art.** `js/art/blocks.js` `family("mansion", "R", 3, …)` × 2 variants on the
existing kit: a two-storey house with two wings round a carriage sweep, a
`fountain` from `BLOCK_KIT`, a glasshouse (the glazing skin `landmarks.js`
already has), a `gardenWall` with a gate and two lamps, a lawn, one tree
stamp. The species mark sits on a socket through `characterSprite` as every
building's does, so the Greybacks' mansion carries the wolf's mark and the
Slyfields' the fox's. The 2× set comes free through `hires.js` because the
family is `solid.RECIPES`. Contact sheet, then a mixed street at both zooms
beside the towers and a campus, the People-E way. A species-skinned mansion
set — fourteen mansions — is a later art arc if the owner wants it, on the
landmark pattern.

## 5. The one free win for the knowledge-and-culture build

Represent culture and knowledge as **per-tile strength fields** (0 / 4 / 8
and 0 / 50 / 100, or 0..100), derived and never saved, exactly as that
proposal already says — and nothing more. A household gate reads a tile; a
per-citizen flag would have to be re-derived. That build does not otherwise
change for this arc.

## 6. Justice — the rich are policed first and punished harder

The owner: "any theft from the ultrawealthy gets priority policing and one
step harsher punishment." Two mechanisms, both one line where they land, both
measurable, both on the thesis (the apparatus is optional, expensive,
overbearing, and serves whoever it serves):

- **`openFile` records `victimClass`** — the class of the household at the
  burgled address, or of a killing's victim. Nothing else changes about how a
  file opens.
- **Priority policing is PROBABILITY and TIME, not order.** Files roll
  independently every month, so "worked first" cannot mean queue order. Add
  `ARREST_PRIORITY[victimClass]` (proposed `[0, 0.05, 0.15]`) to the arrest
  roll, and extend the case for the rich: `CASE_MONTHS` 6 → `CASE_MONTHS_RICH`
  12, so an estate's file does not go cold while a cottage's does. The
  wrongful roll is untouched at 5% (15% under a camera), which means the
  wrongful ARRESTS cluster round the estates because that is where the rolls
  are — the joke measures itself.
- **One step harsher is `+1` on the counter.** In `arrest()`, `steps =
  thefts + (f.victimClass === 2 ? 1 : 0)`: a first theft from an estate goes
  to the centre (six months, and the thief comes out fixed); a second goes to
  the hall. Murder of the ultrawealthy, already the centre, becomes the hall.
  Trespass is not theft and is unchanged.
- **The ticker stays deadpan.** "ARREST — Tod Slyfield, for the burglary at
  the Greyback estate at (18,4). The file was worked first." / "SOLD — Tod
  Slyfield was convicted of a first theft, from an estate, and sold at the
  meat hall at (30,9)." The lines report; they never editorialise.

## 7. What to measure before believing any of it (pre-registered)

The scripted mayor never builds culture, so every published rig will form
ZERO mansions and prove nothing. The instrument is a scripted **estate
quarter** fixture — a 6×6 block with an Amphitheater, a Gallery, a Library,
two parks, shops across the ring road and one Estate plot at the corner —
plus the owner's control city when it arrives.

| question | measurement |
|---|---|
| does a mansion ever form? | months to sprout on the estate-quarter fixture; and on the same fixture with each rung removed one at a time (the rung that never bites is not a rung) |
| is class visible in the books? | share of citizens by class vs share of tax by class, year 15 and 30 |
| is priority policing real? | solved% of estate files vs plain files, 4 seeds × 30 y, one station; wrongful arrests within 4 of an estate vs elsewhere |
| is the harsher step real? | sentences of first-theft-from-an-estate: 100% centre; theft-after-that: 100% hall |
| does the estate hold the town back? | the cap, P and V_R with and without an estate on the same seed (nine tiles at capacity 8 is 262 animals of housing not built) |
| nothing else moved | the six mayor rigs byte-identical (no culture, no estates) |

## 8. Decisions for the owner (the undecided; nothing above assumes them)

1. **Two classes or three?** Modest / affluent / ultrawealthy as written, or
   only ordinary / ultrawealthy for version one.
2. **Class by the lot at arrival**, as proposed, or by the job (which needs a
   wage model first).
3. **How a mansion comes to be:** the player's Estate plot (proposed), or
   growth that absorbs and displaces eight neighbours.
4. **Mansion capacity** — one household of up to 8 on nine tiles?
5. **Tax multipliers** `[1, 2, 5]`, or something else; and whether the affluent
   shop more (a class weight in the C valve) in version one or later.
6. **The rungs of §3** — which are hard gates, and their numbers.
7. **Affluent art** — the character-layer "kept" look, or distinct families.
8. **Scope of "theft from the ultrawealthy"** — the home only (proposed), or
   shops as well once shops have owners; and does the harsher step apply to
   murder of the ultrawealthy (proposed yes: the hall).

## 9. Sequencing

1. The knowledge-and-culture build ships first, with culture as mood + a
   land-value halo (ruled today) and per-tile strength fields (§5).
2. The keel: `hh.wealth` saved, `attainableClass` with its unmet list, class
   on the card and in the Census, `TAX_CLASS`. Hash-neutral until a lot
   attains class 1 (nothing does without culture), which the suite proves.
3. The Estate tool, the sprout rule, the mansion family, the estate-quarter
   fixture and its probe.
4. Justice: `victimClass`, `ARREST_PRIORITY`, `CASE_MONTHS_RICH`, the `+1`
   step, the two ticker lines, the clearance probe.


## BUILT — 2026-09-05 (session 18), the eight decisions as taken, and where the built thing differs

The owner, leaving for work the day this was written: *"please do as much
work as you feel comfortable doing solo … i trust you though."* Then, back:
*"lets do the wealth arc."* Built in one commit on the defaults below, each
said out loud here so a decision the owner wants otherwise is one knob or one
line away. SPEC §9f is the rule; `tools/check-wealth.mjs` the 60 checks;
`tools/wealthprobe.mjs` the instrument; handoff §32 the account.

| §8 decision | taken |
|---|---|
| 1. two classes or three | **three** — modest / affluent / ultrawealthy, as written; the owner's own words name two rungs above modest |
| 2. class by the lot at arrival | **by the lot**, once, inherited by cubs, kept for life (`hh.wealth`; `wealth.classForArrival`) |
| 3. how a mansion comes to be | **the player's Estate plot** (Q, §200); growth-made mansions are NOT built |
| 4. mansion capacity | **8, one household** (`MANSION_CAP`; a second household is refused while one lives there) |
| 5. tax multipliers | **[1, 2, 5]** as written (`TAX_CLASS`), visible under the R line in the Budget and as shares in the Census; the affluent do NOT shop more in this version |
| 6. the rungs of §3 | **all hard gates with the numbers of §3**, every one a knob (`CLASS_*`); the shop rung is a ROAD distance from the doors (`wealth.shopWithinRoad`), as the rehoming search walks |
| 7. affluent art | **not built** — the class is on the card ("the Slyfields (affluent)"); the only new art is the mansion and its plot (`js/art/estate.js`) |
| 8. scope of "theft from the ultrawealthy" | **the home only**: the richest household at a burgled address (a tenement holds several); shops have no owners yet; **murder of the ultrawealthy goes to the hall**, as proposed |

**Where the built thing differs from §2–§6:**

- §2 says a household's class is decided by the lot's attainable class; the
  built rule adds one case — a household arriving at a standing MANSION is
  ultrawealthy by construction, even if the street has since come down
  (`classForArrival`), because the plot earned it when it sprouted and a
  building does not un-build.
- §3's ladder returns `unmet` for the NEXT class only (the card's question).
  The probe wanted what binds the MANSION when the address is still modest, so
  it takes the union of both classes' failing rungs (`rungsFor`) — an
  instrument's need, not a rule.
- §4 says "stored as an R block anchor (world.big = 3, tier 0) with a class
  marker" and prefers a tile array to the theme byte's high bits: built as the
  honest tile array `world.estate` (0 · 1 plot · 2 mansion), the twentieth,
  omitted from the save and the hash while all zero — so it trips no fixture.
  The mansion's tiles are tier 3 when it stands (a block is a tier-3 building
  on every tile) and tier 0 as chalk; `capacityOf` special-cases the estate.
- §4 did not say what fire does. Built: a mansion burns as a block (every tile),
  goes to rubble and back to a PLOT that may sprout again; on the beat the
  engine saves it WHOLE (it has no storey to spare); `events.lowerTier` guards
  the Uint8 tier wrap a chalk plot would otherwise hit.
- §6 says "+1 on the counter": built as one step up the SENTENCE table for a
  theft from the ultrawealthy while `c.thefts` records what happened — so a
  thief's record stays true and the harshness stays on the sentence. The line
  reads "A first theft from the ultrawealthy: one step harsher." — not "from an
  estate", because the probe showed every ultrawealthy file in four seeds was
  a burglary at an HEIR's flat (cubs of the mansion split off at sixteen with
  the class); the mansion itself was never a hot lot.
- §6's `ARREST_PRIORITY` was folded into ONE exported formula,
  `justice.arrestChance`, so the suite pins the number the roll is made
  against rather than a copy of it. A file's `victimClass` is written only
  when non-zero, so towns without class hash as they did.
- §7's "estate-quarter fixture" is the suite's `quarter()` (flat, controlled)
  AND the probe's graft into the mayor's town (the rig). The probe found the
  compact balanced layout cannot hold the quarter (no 3×3 of chalk for the
  Amphitheater in a 5×5 interior) — a probe number names its rig.
- Found in passing and fixed: `ops.costOf`'s campsite guard did not list the
  four knowledge-and-culture kinds, so a Library could land on an occupied tent.

**What the owner might want to change, one line each:** the key (Q, from the
free set); `COST.estate` 200; `TAX_CLASS`; any `CLASS_*` rung; and the CENTRE
BOTTLENECK the justice probe measured — a first theft from the ultrawealthy
needs a centre bed, and 9 of 11 cold ultrawealthy files had a roll succeed and
wait for one (§7's clearance question, answered: 8% against 22% plain and 37%
affluent, four seeds, thirty years, one station).


## Owner rulings — 2026-09-05 (evening), and the rebuild

The eight answers, verbatim, against the §8 numbers:

1. *"poverty, modest, affluent."* → three classes, renamed: the baseline is
   POVERTY (a street with none of the amenities), the middle MODEST, the top
   AFFLUENT — the mansion class. "Ultrawealthy" is retired from the code and
   the lines.
2. *"class based on the opportunities near you."* → class is what the ADDRESS
   affords, this month: `world.klass`, derived every tick, never saved. The
   BUILT note's `hh.wealth` (fixed at arrival, inherited, kept) is gone; a
   family that moves reads its new street; nothing is carried.
3. *"same as 2, if there are enough positive things near you it happens
   naturally like when the building upgrades to an apartment building."* → no
   Estate tool, no plot: a mansion RISES from any 3×3 of housing whose site is
   affluent, rolled by `lots.lotScore` at `MANSION_P` 0.25·score a month like
   a storey. The tool, the op, the chalk plot and its sprite are removed.
4. *"yes, that's the right POV, less people are homed in the same area."* →
   MANSION_CAP 8 on nine tiles stands; everyone else on the nine lots is moved
   out when it rises (`citizens.displaceFrom`).
5. *"the option for a progressive tax is a wonderful idea and would balance out
   that less people can live on the same plot."* → TAX_CLASS [1, 2, 5] stands
   as the progressive tax; it is always on (an Options switch is one line if
   wanted).
6. *"i'm not sure what this is asking."* → §6 asked which rungs of §3 are hard
   gates and their numbers; all nine stand as hard gates with the numbers of
   §3, every one a knob. One refinement from the measurement: a 3×3 is read at
   its HEART (one tile in from the kerb) with nature counted round its border
   — the corner tile read the ring road's pollution and no tree.
7. *"i like the art you picked, at some point a species specific variation is
   welcome."* → the mansion stays (`js/art/mansion.js`); the species-skinned
   set is a later art arc on the landmark pattern.
8. *"this applies just to the home, yes harsher punishment."* → as built: the
   class at a burgled HOME's address; one step harsher for a theft from the
   affluent; the hall for their murder.

**What the rebuild measured** (`tools/wealthprobe.mjs`): the bare amenities at
a High block's corner raise no mansion in thirty years, because inside a High
block the heart of any 3×3 reads crime 100 — density is crime, the game's own
law since session 1 — and pig pollution from the tenements beside it. The
quarter a player would plan (low density within two of the window, a Large Park
within five, a police station, one corner shop, the Library and Gallery within
five of the heart) raised a mansion in month 26 on the estate layout: the shop
had to grow first, the Scrapleys (4 raccoons) kept the house and 26 animals were
moved out; the quarter's upkeep is §2,250 a year. So the arc reads, in the
owner's own frame: the poor live in the dense blocks, the modest near a gallery
and a park, and the affluent where a player has planned for them.

## Owner ruling — 2026-09-05 (night): dense blocks too; the amenities are the biggest factor

On the rebuild's measurement — *no mansion ever rose inside a dense block,
because the heart of any 3×3 in a High block reads crime 100 by the game's own
density law* — the owner: *"mansions should rise in dense blocks too. the
biggest factor should be what amenities are near it."*

**What changed.** The ladder of GATES (§3, as built) is a ladder of POINTS:
culture at home (a Gallery 2, an Amphitheater 4), knowledge at home (a Library
1, a University 2), a park within 4 (a Park 1, a Large Park 2), a standing shop
within 6 road tiles (1), water or trees beside the plot (1) — ten in all — less
one point each for smoke (pollution over 40), a hot street (crime over 60) and a
meat hall's dread, never more than three. MODEST at 3 points; AFFLUENT at 7 and
culture at home, the owner's morning PREREQUISITE, whatever the points. Land
value is no longer a rung: it is the tax's and already the sum of these things.
So the amenities decide and the street only drags: a 3×3 in a dense block,
crime 100 at its heart, is one point down and affluent all the same when an
Amphitheater, a University, a park and a shop are near it. The window admits
whole blocks lying inside it — a 2×2 within, or the 3×3 block that IS it, so
the apartment block becomes the mansion (the owner's evening image). The card
says the points and what they are made of; Rules W1 and the MANSION line say
the same.

**What it measured** (`tools/wealthprobe.mjs`, estate layout, seed 7, thirty
years). The bare amenities at a High block's corner (`--dense`): under the
gates no mansion in thirty years; under the points the mansion in MONTH 1, on
empty chalk, 7 points. One Amphitheater reaches an eighth of the map, so its
town is MODEST almost to the last address and pays ×2: cash §203,294 at year 30
against §5,839 in the plain rig, −§338 with no class tax (`--tax 1,1,1`),
§122,806 at ×1.5. The same graft carved into the FULL block at year 5 (`--at 5
--clear`) reads 6 of 10 for 300 months — no tile left beside it for a tree, the
streets −1 — and no mansion; with a University (`--university`) THREE rise in
months 61, 64 and 75, 95 + 151 + 173 animals moved out, households in tents 26
→ 61 a year on, the town down from 677 to 436 by year 30, 293 of them affluent
carrying 86% of the R tax. Justice, four seeds: 15 files from affluent
addresses in 120 town-years (was 1), all cleared, 8 to the centre and 8 to the
hall — the priority policing is real in the street now that mansions stand in
dense blocks (hot lots in 272 mansion-months).

**Open for the owner.** TAX_CLASS modest ×2 against a class that is now
town-wide (one number); MANSION_P 0.25 against three mansions in fourteen
months hollowing a quarter and a third of a town into tents (a rate, a cap per
quarter or a fill rule — one knob each); a mansion rises on EMPTY chalk the
month the amenities land, before anyone lives there.
