# Proposal — Wealth and class: the ultrawealthy, their mansions, and whose burglary gets worked first

Status: proposal, 2026-09-05. Nothing built. Written the day the owner sketched
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
