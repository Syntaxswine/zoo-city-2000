# People C/E finishing work — 2026-09-05

The remaining C favourites/follow and E age decoration stretches are complete.
The owner's control-city export is still absent; its measurements remain pending.

## Player behaviour

- Star a citizen from Inspect or Census. Census → People keeps the names, Find,
  Star and Follow actions. Stars persist per city name and seed in this browser,
  including archived citizens and IDs absent from an earlier checkpoint.
- Follow attends the citizen's real walker, tracks train rides and falls back to
  their recorded location between walks. Normal camera motion is four tiles/second;
  fast travel receives catch-up within three tiles before map-edge clamping.
  Pause freezes it. Stop keeps the card; pan, drag, build tools, world replacement
  and death/departure cancel tracking. F stays Fire; WASD stays movement.
- Starred biography-bus events produce personal toasts, never saved news entries.
  This is not a promise to announce every death; deaths are not all bus events.
- Zoned buildings show ivy after 15 years and roof repairs after 25 years since
  construction/expansion. Inspect reports age. Ordinary decline preserves the
  date; expansion or footprint changes reset it. Demolition/undo clears/restores it.
  Civics do not use this age decoration.

## Save compatibility

Uint32 `since` stores tick + 1 (zero unknown/empty). Old exports begin observation
at their load tick; malformed/future dates cannot wrap into ancient buildings.
Favourites/follow remain outside city exports. Age is saved and included in the
full hash: the 120-month legacy fixture changes 98d2a6a8 → 5bbfb789. Serialising
the same resulting world through the prior canonical schema still gives 98d2a6a8,
confirming unchanged simulation/RNG behaviour. Earlier G hashes are historical.

The 30-year size probe totals 749,267 bytes for 1,674 citizens (previously 740,508);
citizen data remains 358,202 / 439,200 bytes, archive mean 42.38 bytes.

## Verification and hostile review

The canonical suite passes **654 checks, zero failures**, including 25 new focused checks for preferences, lifecycle,
real rail following, age transitions/migration/undo, continuation and all 106
zoned art plans. Both resolutions preserve palette and exact solid silhouettes;
all low ground surfaces preserve colours. Five mutation checks reject broken
unstar, rail catch-up, wear thresholds, footprint reset and saved date logic.

Actual browser rail fixture: 2,257 observed frames at ×3, riding observed, maximum
camera lag 3.0000000000000027 tiles. Pause held the exact camera/tick; switching
to Fire cancelled follow. Loading an earlier checkpoint retained a missing ID,
and its Star button successfully removed it. Browser error log was empty.

Hostile review iterated through missing-ID unstar, fast train camera lag and
courtyard roof patches. All were fixed with regressions; final independent score
**9.0/10**, no blocking findings. Reviewer reran all 25 checks and five mutations.

Run from repository root:

```text
node tools/check.mjs
node tools/check-stretch-mutations.mjs
node tools/savesize.mjs
node tools/wear-sheet.mjs
```

The [wear sheet](shots/sheet-building-wear.png) columns are fresh, 15-year ivy,
and 25-year ivy plus roof repairs. Rows cover cottages, towers, shops, industry,
meat and a courtyard block. Wear recolours existing surfaces without adding
geometry; roof patches exclude low platforms, lawns, paths and furniture.
