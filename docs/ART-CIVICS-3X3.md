# Civic campuses: Large Park and Zoo prison

Fire stations, police stations, pacification centres, Large Parks and Zoos now occupy 3×3 tiles. One anchor owns the whole footprint. Placement, preview, road access, inspection, demolition, undo and save/load use that ownership.

| Kind | Artwork |
|---|---|
| Fire | Brick firehouse, three engine bays, ladder engines and hose tower |
| Police | Stepped entrance, blue portico, gold badge, flag and patrol parking |
| Pacification | Pale treatment wings, fountain courtyard, reception and van bay |
| Large Park | The former zoo garden: paw gate, pond, pavilion and landscaped paths |
| Zoo | New prison: barred gate, cell wings, enclosed exercise yard and watchtowers |

![Five civic campuses](shots/sheet-civics-large-hires.png)

New campuses use art.civic(kind, 3), a 48×48-unit recipe with hub 24 and footprint [3,3]. Normal and high-resolution rendering share the existing painter path. The renderer passes the actual saved footprint, so legacy 1×1 stations and 2×2 gardens keep fitting their existing sites.

Service campuses require a road touching an edge at placement. Small and large parks are exempt. Large Park retains recreation, population-cap and land-value benefits; Zoo instead provides 24 prison beds and eight jobs.

Regenerate the previews with node tools/shots.mjs --sheet. The canonical check suite includes geometry, palettes, painter order and the focused campus/justice checks in tools/check-civic-campuses.mjs.
