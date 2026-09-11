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
farm capacity for every living resident for three consecutive months. A failed
month resets the streak, never an earned unlock. Only one chapter advances per
month. Farming improvements apply automatically to every existing farm.

| Chapter | Population goal | Newly available tools | Villagers per farm |
| --- | ---: | --- | ---: |
| The River Settlement | 100 | Roads, Low residential, Low meat, farms, fire stations | 25 |
| The Town | 500 | Police, cemeteries, Low commercial and industrial | 50 |
| The City | 1,500 | Doctors’ offices, libraries, galleries, small and large parks, zoos, pacification centres, High R/C/I | 100 |
| The Sanitation Crisis | 3,000 plus sanitation goals | Hospitals, sanitation works and garbage depots | 200 |
| The Metropolis | Open-ended | Every remaining tool, including High meat | 400 |

Inspection, demolition, saving, undo, taxes and game controls remain available.
Locked tools explain their chapter in the palette and on keyboard selection.
Both operation preview and application enforce the same gates.

## Farms and food

A farm occupies 2×2 tiles, costs §100 plus tree clearing, costs §20/year, and
offers 12 jobs. It must touch a road at placement, with at least one footprint
tile within three tiles (including diagonals) of edge-connected river water.
Isolated ponds do not qualify. Selecting Farm highlights floodplain; the
placement ghost checks clear ground and road access for the whole footprint.

Output requires the existing whole-footprint road-access rule and no flooded,
burning or rubble footprint tile. Losing all nearby roads or flooding stops
production. Output has no staffing gate, consistent with existing public
services. Four farms support 100 villagers; ten support 500 after Chapter 2
unlocks. Farm workers participate in the normal employment and tax systems.

Campaign births and new arrivals require remaining food capacity. The final
arriving household can be smaller to fill the remaining food places. Existing
residents survive shortages but receive −20 mood, and no chapter completes
without enough food. Meat inventory, predation and logistics remain separate;
farm capacity supports all villagers.

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

Doctors’ offices unlock when Chapter 2 completes: sustain 500 fed villagers
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

Chapter 5 requires 3,000 villagers, sufficient food, **90% coverage for each
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
(months 16 and 12 on the latest household/migration simulation). Existing sprite audits cover the new buildings too.

The 1,500 and 3,000 goals and service capacities are initial tuning values.
Long-term balancing remains iterative: later chapters still require jobs,
housing, taxes and the existing civic population-capacity system.
