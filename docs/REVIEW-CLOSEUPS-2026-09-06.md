# Close-up graphics review

The camera now steps through 1×, 2×, 3× and 4×. The original overview art
is preserved. Close-up solids have world-aligned masonry, roof seams,
recessed window frames, reflections, door panels and timber slats. Every
citizen species uses a detailed version of its composed pose, preserving
age, facing, individual look, hats and carried objects. Trees and standalone
props retain their existing art; this is not a redesign of the whole map.

## Adversarial review and corrections

This was a self-review, with executable regression checks and visual sheets.

- Rapid wheel events formerly calculated against the last rendered view.
  The camera calculation now uses current camera coordinates. Repeated
  zoom-in and zoom-out events preserve the cursor's world point without
  requiring an intervening frame.
- The initial glass reflection pass recoloured reflections when occupancy
  changed. Fixed: frames and reflections stay put; only glass lights up.
  Extended the existing occupancy and species-stamp checks to 4×.
- Fixed-height thought-bubble offsets would overlap enlarged animals.
  Labels now follow the composed sprite's scaled head, keeping fixed type.
- The old toolbar only toggled 1×/2×. Separate zoom buttons now traverse
  all four levels, disable at the bounds, and distinguish zoom from speed.
- Required actual new architectural pixels on every building/civic/block/
  station recipe. This caught the small park's untouched bench; added slats.
- Checked the comparison-sheet layout itself and increased row height to
  avoid overlapping tall towers; reserve space below campus anchors too.
- Integrated remote main through `0118863` before release, retaining the
  newer wealth/class and knowledge/culture features. The art audit now also
  covers both mansions and all four knowledge/culture civic buildings.

## Verification

- Full integrated suite: **922 checks, zero failures**.
- Dedicated audit: **177 solid recipes**, each at 2× and 4×, palette validity,
  exact original high-resolution silhouette and anchor, and cache identity.
  All building/civic/block/station families gain new detail.
- **2,688 citizen cases**, each at 2× and 4×: fourteen species, four facings,
  three ages, four animation frames, and four look/accessory configurations.
  Every case gains detail, keeps its original footprint, and retains its base.
- Occupancy/species-mark audit at 1×/2×/4×: 108 building plans,
  302,938 light pixels and 80,763 species-mark pixels.
- Renderer sequence 1→2→3→4→2→4→1 matches fresh renderers pixel-for-pixel;
  tile and citizen picking pass at every level. The 1× frame with citizens
  matches the renderer with high-resolution art disabled.
- Real browser: button and keyboard traversal reaches both limits,
  controls disable appropriately, and no console warnings/errors were seen.
- Visually inspected species, poses, building and civic comparison sheets,
  plus a populated city rendered at 4×.

Run `npm run check` for both suites. `node tools/check-closeups.mjs` generates
the review sheets in `out/closeups/`, with old art on the left and new art on
the right. `node tools/play.mjs --years 12 --at 2011-12 --zoom 4 --watch 22,22
--out out/closeups/play` reproduces the populated-city view. No supplied
owner-city save was available; the tests use generated fixtures.
