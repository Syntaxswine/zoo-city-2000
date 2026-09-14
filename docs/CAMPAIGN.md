# The river city campaign

New games default to Free Play. The new-city form offers two radio options:
Free Play (all tools, no chapter or food requirements) and Campaign;
existing saves without campaign state remain unrestricted sandbox cities.
The [generations proposal](PROPOSAL-GENERATIONS-AND-SKILLS-2026-09-07.md)
specifies sanitation's seven-tile reach and household mess reduction, and
cemeteries as citywide archive readers. This campaign implements those ideas
and adds garbage collection, capacity, backlog and chapter goals.

## Chapters

Targets are each chapter's finish line. Meet the target with enough working
farm capacity for the chapter's **target** population (four farms carry the
first hundred) for three consecutive months. A failed month resets the streak,
never an earned unlock. Only one chapter advances per month. Farming
improvements apply automatically to every existing farm. Food assistance
(Governance) feeds mouths but never passes a chapter: a settlement is judged
on what its fields grow.

*Why the target and not the head-count (hostile review, 2026-09-13):* arrivals
stop exactly at the food line, so with four farms the old "food ≥ population"
gate held only while the town sat at precisely 100 villagers, and any birth
reset the streak — 22 and 38 months on two seeds against 10 with a fifth farm.

| Chapter | Population goal | Newly available tools | Villagers per farm |
| --- | ---: | --- | ---: |
| The River Settlement | 100 | Roads, trees, walls, Use zoning, Low residential, Low meat, farms, fire stations | 25 |
| The Town | 400 | Police (with Interview and Collect), cemeteries, the Governor’s Mansion and Governance, Low commercial and industrial | 50 |
| The City | 800 | Doctors’ offices, libraries, galleries, small and large parks, zoos, pacification centres, High R/C/I | 100 |
| The Sanitation Crisis | 1,200 plus sanitation goals | Hospitals, sanitation works and garbage depots | 200 |
| The Metropolis | Open-ended | Rail and stations, cameras, the University, the Amphitheater, High meat | 400 |

Inspection, demolition, saving, undo, taxes and game controls remain available.
Locked tools explain their chapter on hover, on click and on keyboard
selection. Both operation preview and application enforce the same gates.

**The targets were 100 → 500 → 1,500 → 3,000 until 2026-09-14.** The hostile
review of 2026-09-13 found the 1,500 unreachable: six scripted 40-year runs at
the demand-neutral tax rate peaked at 892–934 villagers, because §12 per animal
of upkeep outruns Low-density residential tax around 600–900 animals and the
town enters receivership in years 6–10. The owner: *"lets lower the target …
that suggests implicitly that the later targets also need to be lowered"* —
100 → 400 → 800 → 1,200. Measured before the change with two players on the
same 64×64 maps, neutral taxes, disasters on:

| rig | Chapter 3 (400) | Chapter 4 (800) | 1,200 reached |
| --- | ---: | ---: | ---: |
| a weak Low-density player, seed 7 | 2.8 y | 16.3 y | never (plateau ≈ 810) |
| the same, seed zoo | 1.9 y | 4.9 y | never (≈ 805) |
| the same, seed 3 | 1.8 y | never (receivership from year 5) | never |
| the project's calibrated free-play mayor (High from day one, locks bypassed), seed 7 | 3.0 y | 4.3 y | 9.0 y |
| the same, seed zoo | 3.8 y | 4.8 y | 6.1 y |

So 400 and 800 are a middling mayor's chapters, and 1,200 is the stretch a good
economy reaches in six to nine years. The economy itself is unchanged: a
Low-density town still runs a deficit past a few hundred animals, and the
Metropolis is earned by fixing that, not by waiting.

## Farms and food

A farm occupies 2×2 tiles, costs §100 plus tree clearing, costs §20/year, and
offers 12 jobs. It must touch a road at placement — any road tile, not
necessarily one joined to the town's road: the machine checks adjacency, never
connection — with at least one footprint
tile within three tiles (including diagonals) of edge-connected river water.
Isolated ponds do not qualify. Selecting Farm highlights floodplain; the
placement ghost checks clear ground and road access for the whole footprint.

Output requires the existing whole-footprint road-access rule and no flooded,
burning or rubble footprint tile. Losing all nearby roads or flooding stops
production. Output has no staffing gate, consistent with existing public
services. Four farms support 100 villagers; eight support 400 after Chapter 2
unlocks, and the same eight carry 800 once Chapter 3 doubles the yield. Farm workers participate in the normal employment and tax systems.

Campaign births and new arrivals require remaining food capacity. The final
arriving household can be smaller to fill the remaining food places. Existing
residents survive shortages but receive −20 mood, and no chapter completes
without enough farm food for its target. Meat inventory, predation and
logistics remain separate; farm capacity supports all villagers. Food
assistance adds one place per poor resident to the mouths fed (arrivals,
births, the mood penalty) and is shown on the status line as "+N on aid"; it
does not count toward a chapter.

Four farms employ 48 villagers and feed 100: in Chapter 1 the rest are jobless,
and the news fills with "MOVED AWAY — no work" lines until the Town opens shops
and workshops. That is the chapter's tension, not a fault, but the guide says
so here because the review's players were surprised by it.

## Cemeteries

A cemetery is 6×6, costs §300 and §60/year, and has no workers, road
requirement or coverage radius. As specified in the generations proposal,
it reads the permanent citywide archive. Inspect it to search remembered
citizens by name, species or departure/death cause and open their records.
The latest 200 matching records are shown; search covers the entire archive.
Existing funeral friendship and mourning rules remain unchanged.
Only one cemetery may exist per city, in both campaign and sandbox. It unlocks
in Chapter 2. Older 2×2 cemeteries remain intact and count toward the limit;
demolish and rebuild to use the new size. Demolition never deletes the archive.

## Health overlay

Use the ✚ health button or cycle overlays with O. Teal shows doctor coverage
(+2% lifespan), blue shows hospital coverage (+3%), and uncovered tiles remain
untinted while any medical facility operates. If none operate, residential
zones turn red to highlight the citywide −3% penalty. The legend shows the
operating facility count and remains visible while the overlay is selected.

## Doctors and hospitals

Doctors’ offices unlock when Chapter 2 completes: sustain 400 fed villagers
for three months. Hospitals unlock at the beginning of Chapter 4.

| Facility | Footprint | Build | Annual upkeep | Jobs | Coverage |
| --- | --- | ---: | ---: | ---: | --- |
| Doctor’s office | 2×2 | §600 | §180 | 4 | Seven tiles from the footprint |
| Hospital | 3×3 | §4,000 | §1,200 | 16 | Nearest half of the map’s tiles, exactly like a university |

Both require adjacent roads for placement, and road access and a dry,
unburned footprint to operate. Coverage respects walls and gates. Selecting
either tool shows existing coverage. As with other public services, there is
no staffing gate. Healthcare also operates in sandbox cities.

Residents of homes within doctor coverage receive **+2% natural lifespan**;
hospital coverage gives **+3%**. Hospital care wins and overlapping facilities
never stack. Homes outside coverage have normal lifespan if at least one
medical facility operates anywhere in the city.

With **no operating doctors or hospitals**, everyone receives **−3% natural
lifespan**, including unhoused citizens, citizens in custody and livestock pens.
This also applies before healthcare unlocks. A facility without road access,
or with flooding, fire or rubble, does not count.

Effects follow current coverage and operation at the monthly aging check.
Moving or losing service removes the local bonus; restoring a facility removes
the citywide penalty. Residents past the adjusted lifespan can die at the next
aging check. Natural lifespan rolls remain unchanged. Older saves still load
former care credits for compatibility, but these no longer affect lifespan or
accumulate. Care changes natural aging deaths only, not violence or disasters.
Illness and hospital admissions are not simulated.

## Sanitation and garbage

| Facility | Footprint | Build | Annual upkeep | Jobs | Villagers served |
| --- | --- | ---: | ---: | ---: | ---: |
| Sanitation works | 3×3 | §1,200 | §240 | 8 | 750 |
| Garbage depot | 2×2 | §800 | §180 | 8 | 750 |

Both must touch a road at placement and operate while road-served and dry.
Sanitation reaches seven tiles and garbage collection ten tiles from their
footprints, respecting wall-aware service geometry. Sanitation reduces covered
household mess by up to 50%, scaled down when capacity is insufficient.
Covered residents count once, limited by total active facility
capacity. Selecting either tool displays its reach. Service is geographic;
this version does not simulate garbage-truck routes.

Chapter 4 grants six full months before accumulation starts. Thereafter each
villager generates one unit each of sewage and garbage per month. Each service
removes its total active capacity multiplied by its covered population share.
Spare capacity clears old waste. Each backlog is bounded at six months of
current population. Combined backlog adds up to 40 residential pollution,
at eight points per backlog unit per resident, affecting existing land value,
mood and growth rules.

Chapter 5 requires 1,200 villagers, sufficient farm food, **90% coverage for each
service**, and combined backlog at most **25% of population**, sustained for
three months. The status bar displays coverage, backlog, grace countdown and
the stability streak; the Rules tab explains all campaign mechanics.

## Persistence and verification

`flags.campaign` stores chapter, stable months, chapter entry tick, garbage and
sewage. Normal civic arrays store the four buildings using appended IDs 13–16.
Medical buildings append IDs 17–18; larger civic parts use a new offset flag
while retaining support for older part bytes. Coverage and food are derived.
Save/load validates campaign values and legacy care credits and hashes
them; older saves receive no campaign state. Replay uses the original founding
mode and seed. New civics use code-native solids and the existing art pipeline.

`npm run check` includes campaign tests for refused operations; river/pond
placement; farm flooding, demolition and undo; yields and permanent unlocks;
service grace, capacity and lost roads; citywide memorial access; the sanitation
completion gate; real four-farm founding on two generated maps; deterministic
save/load continuation and input replay; and legacy compatibility. Both
generated settlements reached 100 villagers and Chapter 2 without cash cheats
(months 16 and 12 on the latest household/migration simulation — on a **40×40
map with disasters off, a full road grid and the whole map zoned Low
residential**, which is the test's rig and not a player-shaped city; a
player-shaped 64×64 founding with four farms and one residential strip took
22–38 months under the old gate and 10–11 under the target gate). Existing
sprite audits cover the new buildings too. `tools/check-hostile-review.mjs`
holds the counter-assertions of the 2026-09-13 review — the gates, the bill,
the wrongful roll, the free-play offers, the estate's undo.

The 400 / 800 / 1,200 goals (re-targeted 2026-09-14, see Chapters) and the service capacities are tuning values.
Long-term balancing remains iterative: later chapters still require jobs,
housing, taxes and the existing civic population-capacity system.
