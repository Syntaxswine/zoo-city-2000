# Civic campuses handoff — 2026-09-05

Supersedes the unfinished adjacent-civics handoff dated 2026-09-04. Implemented directly on main after 1cd1815; the red intermediate branch was not merged.

## Behaviour

- Fire, police, pacification, Large Park and Zoo are 3×3. Atomic placement validates all nine tiles and charges once, plus trees cleared.
- Service campuses require an orthogonally adjacent road anywhere on the footprint at placement. Existing ongoing service uses the shared served rule. Parks are exempt.
- The loved garden artwork now belongs to Large Park, including its 500 population cap and recreation benefits. G selects it.
- Z selects the separate Zoo prison: grey cell wings, bars, an exercise yard, gatehouse and watchtowers. It has 24 beds, eight jobs and annual upkeep of 1,500.
- First thefts and other lighter crimes enter prison for three months; trespass lasts one month. Prison release does not pacify.
- Murder and second theft go to a six-bed pacification centre for six months. Third theft, or theft after pacification, goes to a reachable meat hall with capacity.
- Theft convictions have a separate saved counter. Repeated trespass does not become theft. Exoneration clears the wrongful conviction and theft count and releases active custody; completed pacification cannot be reversed.
- Missing/full destinations leave cases open without phantom custody, extra convictions or a substituted sentence. Ordinary case expiry still applies.
- Clicking or demolishing any part resolves the whole campus. Demolishing occupied campuses releases jobs/inmates and is not undoable.
- A wall can no longer overwrite a rail platform; placement failures show their actual reason.

## Save compatibility

Old civic IDs 2 and 3 now mean Large Park and its legacy parts; they never become prison inmates' destinations. Existing 2×2 gardens and 1×1 services retain their footprint. New civicSize metadata records new anchors and part offsets; new Zoo is ID 8.

justiceVersion 2 marks saves with explicit theft history. Old saves recover known theft convictions from retained, non-exonerated arrest records. Records older than the retained history cannot be reconstructed and are not guessed. Legacy buildingless custody finishes under the existing release path.

## Validation

The canonical suite covers the 15-year city, continuation and replay, road/rail access, meat routes, painter geometry and the new campus tests. The new focused suite covers all four service types, far-edge access, nine-tile ownership, overlap and edge refusal, save/load, demolition/undo, road-free parks, legacy sizes, prison/centre/hall sentencing, capacity, missing destinations and exoneration.

Browser verification placed all five campuses in the actual app at both zoom levels. Inspecting a prison corner showed the correct anchor, one of 24 occupied beds, eight jobs and its road entrances.

The canonical 15-year fixture now reports 326 citizens (formerly 385). New civic siting, recreation/prison separation and destination-dependent sentencing change the city's growth. The canary remains approximately ±5%, now 310–342. An isolated older fixture variant reports 322; the canonical fixture is the recorded baseline.

Six 30-year mayor hashes are recorded below after verification. These intentionally include the new meaning of --zoo (prison) and a wider site search to fit campuses.

| Layout / extra flags (all --years 30 --quiet) | Hash | Population |
|---|---|---|
| balanced | ebfd20be | 1659 |
| dormitory | f86913c3 | 49 |
| millbelt | d8fc9f43 | 1596 |
| estate | 93224f79 | 1371 |
| balanced --stations --zoo 12 | 3e56f440 | 1494 |
| estate --zoo 12 | 1b4ba98b | 1272 |

Final canonical result: **586 checks, zero failures**. The first three non-prison layouts retain their previously recorded populations; hashes also include footprint metadata and updated saved fields, so hash movement alone is not population movement.
