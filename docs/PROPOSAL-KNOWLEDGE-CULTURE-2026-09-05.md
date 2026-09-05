# Proposal — Knowledge and culture civics

Status: specification only, 2026-09-05. No gameplay changes are implemented by this document. The owner specified the four buildings and their sizes. Mechanics, prices and ranges below are proposed starting values to validate during implementation.

## Four buildings, two public services

Knowledge gives a growing town room to develop. Culture makes everyday life in the town better. Library and Gallery are useful neighborhood investments; University and Amphitheater are stronger district institutions. The larger buildings do not require or replace the smaller ones.

| Building | Represents | Footprint | Build cost | Annual upkeep | C-type jobs | Service radius | Full benefit |
|---|---|---:|---:|---:|---:|---:|---|
| Library | Knowledge | 2×2 | §1,000 | §350 | 4 | 4 tiles | 50 knowledge |
| University | Knowledge | 3×3 | §4,000 | §1,200 | 12 | 7 tiles | 100 knowledge |
| Gallery | Culture | 2×2 | §800 | §300 | 4 | 4 tiles | +4 culture mood |
| Amphitheater | Culture | 3×3 | §3,000 | §900 | 8 | 7 tiles | +8 culture mood |

All four are available immediately and need a road touching an edge to be built. They employ existing citizens under the normal job and commute rules. They provide no housing, inmate capacity or compulsory attendance. Jobs count once per anchor. Budget charges remain due when a building loses road access; service stops until access is restored. Initial service is not proportional to staff occupancy, matching the existing service-building approach and avoiding a new staffing feedback loop.

## Coverage and operation

Use one shared service calculation for cards, Census, mood, demand, overlays and wishes. A source operates when the whole-campus road-access test succeeds and no tile of the campus is burning or flooded. Demolition removes its service immediately. Reuse the existing wall-aware field traversal, seeded from every footprint tile at distance zero; each source's own footprint is traversable for emission. Other tiles obey the current field passability rules, including walls and tunnels. Rail does not multiply this radius.

Coverage is full strength through the stated radius, inclusive, then zero. For a multi-tile home, use the strongest service reaching any tile of its footprint. Aggregate sources using maximum strength, not addition: two Libraries still provide 50 knowledge, while a University provides 100; a Gallery and Amphitheater together provide +8 culture. Knowledge and culture are independent and can both apply. The footprint distance rule is essential: a citizen living beside the far corner must not be treated as distant from the anchor.

Eligibility uses the citizen's home, not the walker's current screen position. Citizens without a home receive neither benefit in this first version; camping continues to ask for housing first. Apply the same eligibility to numerator and denominator in knowledge reporting: living, housed citizens who are not absent under the existing custody/pen rules. No species, age or predator/prey restriction applies to public service benefits. Ordinary workforce eligibility still controls who can take jobs.

## Knowledge: support growth

Knowledge improves the existing city capacity limit. It is access to public learning, not a permanent intelligence score or a graduation simulation.

For each eligible citizen, let k be their home's knowledge coverage divided by 100. Define K as the mean k across eligible citizens, or zero if there are none. Add up to 600 capacity before the existing friendship multiplier:

    Cap = (CAP_BASE + CAP_PARK × parks + CAP_LARGE_PARK × largeParks
           + festivalBonus + 600 × K - CAM_CAP × watchedShare)
          × (1 + CAP_H_GAIN × H)

Examples before the friendship multiplier:

- All eligible residents covered by Libraries: K = 0.5, +300 capacity.
- All covered by Universities: K = 1, +600 capacity.
- Half covered by a University and half unserved: K = 0.5, +300 capacity.
- Stacking Universities over the same homes does not exceed +600.

This is a higher population ceiling, not an instant population grant: housing, employment, taxes and the existing demand rules still determine growth. An empty campus in an empty district contributes jobs but no knowledge capacity until residents are served. As growth spreads beyond coverage, the average can fall; the interface must make that visible.

Knowledge adds no direct mood, land-value, crime, industry-output or birth-rate modifier in this version. It does not change adulthood or sentencing. The old backlog idea for a school that accelerates adulthood is deferred separately and is not part of this proposal.

## Culture: improve daily life

Add one named CULTURE term to the existing mood calculation: +4 for Gallery coverage or +8 for Amphitheater coverage, with the normal total-mood clamp. Both children and adults benefit. There is no penalty for lacking culture; a new settlement remains playable without it.

Culture is independent of recreation. An Amphitheater does not satisfy the park need, and a Large Park does not satisfy the culture service. Both can improve the same citizen's mood. Culture does not directly change crime, police clearance, park capacity or the cross-species friendship index. Existing consequences of mood continue normally.

No attendance tickets, operating schedule or noise penalty in the first version. An occasional performance animation is visual decoration and must not draw simulation RNG or determine whether the benefit applies.

## Player interface and language

Add all four to the remote's shared tool registry, placement previews, help and cost readouts. Preserve existing shortcuts, especially E for Camera, G for Large Park, and L for Load. Assign new keys only after an explicit collision audit; mouse access must work regardless. Allow the palette to scroll so its final row remains reachable at short window heights.

Inspect any campus tile to show the building name, footprint, jobs filled/available, purchase price, annual upkeep, service radius and operational state. A disconnected or disaster-closed building must explain why its service is unavailable. Home and citizen cards show the actual contributing building and benefit, such as 'Library: 50 knowledge' or 'Amphitheater: +8 culture'. Resolve equally strong providers deterministically by anchor index.

Census reports building counts, knowledge access K, the resulting capacity addition, culture-served population and mean culture bonus. Give each building its own Budget line. Rules displays the new capacity formula and culture mood rule with current values. Add separate Knowledge and Culture overlays, with visible range boundaries during placement.

Keep wishes restrained and truthful. Extend the existing capacity remedy to mention expanding knowledge coverage only when K < 1; retain its park remedies. A missing-culture suggestion may use 'wish there were art or music near home' at priority 4, below the existing park priority 10 and stronger personal hardships. Suppress it whenever culture coverage is positive, even if the resident could receive a stronger building. Do not make every Library user ask for a University. Recompute needs after road edits, placement, demolition and load so solved wishes do not linger.

## Art direction

Use the established isometric pixel-art palette, scale and depth sorting. Each building needs its own silhouette at both game zoom levels, a remote icon and a correct whole-footprint ghost. This spec does not require generating final art yet.

- **Library, 2×2:** compact brick reading hall, tall warm windows, low roof lantern, broad front steps, book-return box and a small reading courtyard. A book-shaped sign should read at icon scale.
- **University, 3×3:** two academic wings around an open quadrangle, central clock or observatory tower, arched entrance and benches. A scholarly campus with open circulation and no prison-like perimeter. Height should leave the courtyard readable from the game camera.
- **Gallery, 2×2:** pale stone or plaster, sawtooth skylights, a bright entrance banner and one large outdoor sculpture. Distinguish it from the Library by roof profile and cooler materials.
- **Amphitheater, 3×3:** open semicircular stepped seating facing a low stage, two entrance aisles and banners. The seating bowl is the defining shape; avoid a roof that hides it. Small decorative performers and audience marks may be used without inventing actual attendees.

Entrance sides must look plausible when a road touches any footprint edge. Inspect contact sheets and an in-game mixed street at both zoom levels, including placement next to tall towers and another campus. Gallery and Library must visually fill four tiles; University and Amphitheater nine.

## Implementation and compatibility

Append four new CIVIC anchor IDs after existing IDs; never renumber the Zoo or legacy Large Park IDs. Reuse generic PART tiles and civicSize metadata for side 2 and side 3. Extend employer/job helpers, site ownership, road access, construction, bulldoze, undo, disaster handling and saved-world validation together. Never infer these building types from their size alone.

Knowledge and culture coverage are derived arrays, rebuilt after load and whenever relevant terrain, walls, roads or buildings change. Share the same refresh path with simulation ticks; overlays, wishes and Census must not show a month-old result after construction. Do not save derived coverage or consume RNG while calculating it. Old saves without these buildings preserve their existing effects and deterministic continuation.

Put all proposed constants in KNOBS. Add independent headless probe scenarios before adopting the numerical balance. Preserve the normal prohibition on building over occupied camps, existing buildings, transport or water. Demolition of staffed campuses follows the current employment cleanup and undo restrictions; no dangling job anchors may remain.

## Delivery sequence and acceptance

1. Add mixed-size civic ownership, four tools, costs/jobs/upkeep and save support; verify 2×2 and 3×3 placement before implementing effects.
2. Add shared knowledge/culture coverage and their consumers; expose the exact results in cards, Census, Rules and overlays.
3. Finish artwork, remote icons and in-game previews; verify layout at wide, narrow and short window sizes.
4. Run regressions and controlled multi-seed probes, fix review findings, then mark this proposal implemented with measured results.

Required regressions include every footprint edge and corner; invalid placement and occupied camps; far-edge road access; disconnection/reconnection; walls and tunnels; joined-home coverage; inclusive radius and radius+1; maximum-source overlap; all Library/University mixtures; culture and park independence; campus fire/flood/demolition/undo; job cleanup; old-save compatibility; save/load/continuation; exact annual budget; unchanged no-building baselines; and UI/card/wish agreement immediately after edits.

Probe zero buildings, each type alone, both small types, both large types, overlapping duplicates and separated coverage, using the same seeds and starting towns. Record population, K, cap, approval, jobs, cash and upkeep at 5, 15 and 30 years. Require the intended local effects and no duplicate-source stacking; do not assume that a cap increase must produce population growth. Measure tick cost at a dense campus count. Numerical tuning must cite these results rather than overwrite golden baselines merely to pass tests.
