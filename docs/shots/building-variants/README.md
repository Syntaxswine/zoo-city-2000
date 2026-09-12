# Building variation review

This set contains 259 sprites across 65 families, including 128 additions.
The additions cover every zoned tier, specialist shop, larger block,
species landmark, mansion, civic kind/size, and both station axes.

| Family group | Families | Sprites |
| --- | ---: | ---: |
| One-tile zoning | 12 | 72 |
| Specialist shops | 10 | 40 |
| Larger blocks | 8 | 32 |
| Species landmarks | 11 | 44 |
| Mansion | 1 | 4 |
| Civic kind/size combinations | 21 | 63 |
| Station axes | 2 | 4 |

The corner shop is counted in one-tile zoning. Original plans remain in the
family arrays. Existing saved variant bytes select the expanded families
deterministically; an existing lot's appearance may change, but its business
kind, simulation state, footprint, and save format remain unchanged.

Run `node tools/review-building-variants.mjs` to regenerate the 38 sheets,
11 city panels, and `coverage.json`. Sheet captions identify family and
zero-based variant. The JSON maps every sprite to all reachable saved bytes
and identifies each city-panel slot. City panels use the actual game renderer,
assert its selected sprites, and check that rendering leaves save state intact.

Run `node tools/check-building-variants.mjs` for reachability, unique pixels,
footprint bounds, palette/detail at 1x/2x/4x, and deterministic rendering checks.
This gate is also included in `npm run check`.

Independent hostile review progressed from 6.5/10 to 9.1/10. Revisions fixed
unsupported roofs and towers, obstructed fire-station bays, skylight overhangs,
cemetery path collisions, and sparse park planting. The final full-set review
covered every sheet and city panel. Remaining stylistic deductions concerned
repeated civic courtyard/pergola arrangements and fine details at native size.
