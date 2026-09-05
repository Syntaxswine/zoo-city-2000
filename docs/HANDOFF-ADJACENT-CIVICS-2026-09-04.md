> Superseded by [the completed civic-campus handoff](HANDOFF-CIVIC-CAMPUSES-2026-09-05.md). The report below describes the historical intermediate branch.

# Handoff — "adjacent to roads" for the four civic services

**Branch `adjacent-civics` (`9732c04`), RED: 13 checks fail.** `main` is green
at 549 and does NOT carry the adjacency gate. Nothing is lost; nothing is
half-shipped.

## What the owner asked for

> "any placeable building should be a functional building. any placeable
> building should be an enterable building. if a building meets the
> requirements to exist it should be functional."

and then, sharpening it:

> "parks and trees should work without roads, but fire stations, police
> stations, pacification centers, and zoos definitely need to be **adjacent**
> to roads"

and, when asked whether a rail platform should be refused too:

> "no, because that should have the no road symbol like houses that are too far
> from the road."

and, mid-implementation:

> "when you change it to adjacent be mindful that all those buildings are going
> to be 3x3 tile wide structures."

## What is already on `main` (green, shipped)

- **The placement gate itself**, on `served` (within `ROAD_REACH`): a fire
  station, police station, pacification centre or zoo is REFUSED where no road
  reaches, with the reason in words. A park is exempt. A platform is placeable
  anywhere and wears the **no-road zot** instead — `render.computeZots` follows
  `fields.asksAccess`, so a stranded zoo or civic employer wears it too, and a
  zoo wears it on its anchor alone.
- Checks for all of it, including the zot photographed over an unreachable
  platform (widen the pixel window over a tall sprite, or you photograph
  nothing — and open the shutter at `clock = 1`, because a zot BLINKS).

## What is on the branch, and what is left

**Done, in `js/sim/ops.js`:** `touchesRoad(world, tiles)` replaces `servedAt`.
It asks `world.roadDist[i] === 1` over **the whole footprint**, deliberately —
`roadDist` is 0 on a road and 1 beside one, round a bare wall and along a
tunnel's own axis, so a building walled off from the street it faces does not
count. It honours `world.roadsDirty`.

**Left: 13 fixtures.** Every one places a civic or a zoo two to five tiles from
a road, which the rule now refuses. `git checkout adjacent-civics && node
tools/check.mjs` lists them. There is a trace mode in the branch's history if
you want the coordinates: guard the two refusals with `process.env.ZC_TRACE`
and print `op.kind, op.tx, op.ty`.

## Read this before you start

**Wait for the 3×3 placement to land, then do this.** `436096b` shipped the
3×3 campus ART with "an explicit side selector for placement integration" — the
sim still places 1×1. **Most of the 13 failures are an artefact of that.** A
1×1 civic must itself touch a road; a 3×3 needs one of nine tiles to, which
nearly every fixture already satisfies. Landing adjacency first means re-siting
thirteen fixtures and then re-siting several of them again when the footprint
grows. The rule is already written over the footprint, so it needs no change.

**Two fixtures will need a real rethink either way**, because the rule takes
their subject away:

- *"access: the zoo two tiles off the road HIRES"* and *"a zoo is four tiles,
  asked once"* demonstrate the footprint rule with a zoo whose ANCHOR is out of
  reach and whose corner is not. Under adjacency a zoo sits on the street, so
  that exact picture is gone. The lesson survives at 3×3 and gets better: the
  FAR corner of a 3×3 is three tiles from the road and still served, *because a
  near tile touches*. Re-site them there.

**Expect the gate hashes to move.** The mayor's zoo anchors sit at `roadDist 2`
in all four layouts (`estate` at 4), so `tools/mayor.mjs`'s zoo search will
land somewhere else. Its loop already tries `apply` and undoes on failure, so
it needs no change — but re-record the six hashes with the cause, as
`BACKLOG.md`'s table does for the three that moved on 2026-09-04.

**The scripted city in `check.mjs`'s `buildCity` needs its police and centre
moved** from `(sx±5, sy∓5)` — off the ring's corners, two steps from a road —
to beside an arm, e.g. `(sx+5, sy-2)` and `(sx-5, sy+2)`. Laying a spur to the
old spots instead was measured and perturbs that thirty-year city MORE (the
town-size canary fires). Moving them still shifts it: `no cub to a household
without two unfixed fertile adults` and `rail: riders on the scripted city`
both go red and want re-baselining with their numbers.

## Also on the branch, and these are DONE

Two verified fixes, both already cherry-picked onto `main` in `7ff1f79`, so
the branch and main agree on them:

- `citizens.replanStale(world, { release })` — an op rebuilds and fires nobody;
  a tick releases. Firing at the op had stopped `undo` from undoing.
- `fields.doorSearch` asks `crossable` **before** marking a tile `seen`, as
  `computeRoadDist` already did.

## Two live defects still open, from the eighth review

Neither is touched by this branch.

1. **A §8 wall may be dropped on a working §300 platform** and silently kills
   it: `ops`'s `case "wall"` refuses water, chalk, a civic, a building and a
   level crossing, but not `rail[i] === 2`. The platform becomes a tunnel,
   `render.js` draws `art.tunnel` because it tests `wall` before `rail === 2`,
   and upkeep keeps billing it. **This is the owner's own law pointing at a
   different door**: one click makes an existing building stop working.
2. **`reach.crossable` is an AND of two masks and either half alone passes the
   whole suite** (mutants `r3`, `r4`). The one fixture puts a RAIL tunnel
   between the lot and the road, so the site takes two steps and each half
   blocks one. A ROAD tunnel entered sideways tells them apart.

Smaller, all confirmed: `lots.js`'s `REASON.NO_ROAD` is the frozen literal
`"no road within 3"` while `ui.js:571` templates the knob two lines away;
`ops.platformWouldBeServed` is dead code; `input.js`'s click path throws the
placement reason away and flashes `"blocked here"`; the tunnel-axis check's
`northLot` appears only in the message and not the assertion; and `d3` (the
zoo-part zot rash) has no check.
