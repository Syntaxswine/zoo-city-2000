# Economic camping — 2026-09-05

Households selected by the existing downturn departure roll now stay in the city in a tent. Residential decay first tries to rehouse a displaced family and then offers a campsite. This preserves citizen IDs, names, ages, family membership and friendships.

Each resident household has one saved campsite with a real tile and householdId. Residents remain in the census, with home = -1 while camping. They release their old home and jobs; the normal job search resumes after rehousing. Camping families get first choice of suitable vacant homes when residential demand becomes positive, before new immigration. Resident tents have no expiry. Death of the last household member immediately releases the site.

Sites are chosen deterministically across clear, unzoned grass, without consuming simulation RNG. No roads, rails, buildings, trees, water, rubble, fire, flooding or other tents. If a housed family cannot find a legal site, it stays housed. A family displaced by actual housing loss still uses the existing departure fallback if neither a home nor a legal campsite exists. Held or penned household members are not transferred into tents.

Construction and bulldozing refuse an entire operation that overlaps an occupied tent, including a corner of a larger campus. Undo cannot restore construction onto a new camp. Use-zoning remains available. A tent reserves construction space; it does not change pedestrian routing.

Visitor campers now also have saved physical locations, retaining their existing expiry timer. Scouts remain visitors without tents. Loading an older save assigns untiled campers distinct legal sites.

The renderer draws tents directly from campsite records, independent of the walker limit. Inspect names the household, resident count and recovery condition; citizen cards show camping status. The Rules and Census panels describe the current state. Housing vacancies subtract housed residents, so camping does not consume vacant house capacity.

## Verification and baseline changes

Focused tests exercise actual downturn departure, residential decay, identity retention, site blocking, large footprints, save/load and continuation, recovery, no-space fallback, death cleanup, visitor sites and legacy migration. The browser was checked at both zoom levels: Inspect identifies a three-person household, construction is refused, and rehousing removes the tent without a stale walker redrawing it.

The 15-year canonical city baseline changes from 326 to 368 citizens because economic departures and housing decay retain residents. The population check keeps its approximately 5% tolerance (350–386). The old plain-save fixture's ten-year no-news hash changes from 566f48db to 98d2a6a8; physical camper coordinates are now simulation state, so the old hash-neutral storage assertion is no longer appropriate.

The forecourt continuation fixture now explicitly seeds twelve adult commuters across a station forecourt, keeping its ten-route minimum independent of changing economic population. Its save/load route equality and two-year continuation checks remain intact. The access source audit now correctly expects five served imports plus ops' touchesRoad import, removing its stale requirement for an unused import.

## Thirty-year scenario results

All commands use node tools/playtest.mjs --years 30 --quiet with the layout and additional flags below. These are new economic baselines, not claims of hash neutrality.

| Layout / flags | Hash | Population |
|---|---|---|
| balanced | 3a2995e0 | 1674 |
| dormitory | 75ff8b18 | 65 |
| millbelt | 848d9801 | 1740 |
| estate | 67cfb158 | 1337 |
| balanced --stations --zoo 12 | 47139294 | 1705 |
| estate --zoo 12 | ea188d33 | 1235 |

Final validation: **601 canonical checks passed**, including 15 focused camping checks. Both zoom levels, occupied-site inspection, refused construction and disappearing tents after recovery were verified in the browser with no console errors.
