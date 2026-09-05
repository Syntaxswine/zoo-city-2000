# People G — closing integration, 2026-09-05

Core integration is complete. The owner's `docs/fixtures/control-city.json`
has not arrived: its regression and measurements remain deferred, explicitly.
The legacy fixture and scripted towns below are not substitutes for that city.
**Subsequently completed:** browser favourites/follow and saved building age,
ivy and roof repairs shipped in [the finishing handoff](HANDOFF-PEOPLE-EXTRAS-2026-09-05.md).
The measurements below describe the historical G revision; the new age array
changes full saved-state hashes without changing the underlying simulation.

## Changes and regression fixes

- A wrongful conviction can release only its own current custody. Exonerating
  an older theft no longer cancels a newer murder sentence, including after load.
- Inspect identifies Zoo prison custody correctly and locates displaced people
  at their physical tent. Campsite cards link to each resident's real biography.
- Campers, including retirees, ask for a home and explain the recovery action.
  The population-cap advice now names Large Park rather than the prison Zoo.
- People, news and save-size probes accept `--save`; the existing meat probe
  already did. Export runs do not add the scripted mayor or stress municipalities.
- The news instrument now actually places its advertised fire/police campuses.
  Its new hashes are fixture changes, not a new simulation rule. Samples with
  fewer than 30 dispatches report their share without a long-run budget verdict;
  named-id resolution and save/load identity checks still apply at every size.
- `play --follow citizen ID` shares Inspect's stable-id resolver. It tracks an
  available walker, otherwise home, custody, campsite or the archived record.
  Missing IDs are explicitly unavailable. A manifest records captions, targets,
  ticks and the final state hash; `index.html` plays the images locally.

## Reproduce

Run from the repository root with Node 22 or later:

```sh
node tools/check.mjs
node tools/check-integration-mutations.mjs
node tools/peopleprobe.mjs
node tools/newsprobe.mjs
node tools/savesize.mjs
node tools/meatprobe.mjs
node tools/peopleprobe.mjs --save docs/fixtures/save-v1-plain.json --years 1
node tools/newsprobe.mjs --save docs/fixtures/save-v1-plain.json --years 1
node tools/savesize.mjs --save docs/fixtures/save-v1-plain.json
node tools/meatprobe.mjs --save docs/fixtures/save-v1-plain.json --years 1
```

The suite includes 20 focused runtime/argument regressions and eight integration
tool checks. Four deliberate mutations are killed: unconditional exoneration
release, prison labelled Centre, lost campsite coordinates, and removed camping
need. The control helper is exercised against the synthetic legacy fixture,
including rejection of a changed expected hash. Two-frame recording preserves
the loaded simulation hash. The canonical 15-year population remains **368**.

## Combined probe table (§16 integration results)

All defaults below run 30 years. Their different fixtures answer different
questions; population and hashes must not be compared as if one shared town ran.

| Instrument | Sample | Result |
|---|---|---|
| People | 4 seeds × balanced, dormitory, millbelt | 24/24 longitudinal needs and 24/24 focused truth cases; 6/6 declared stress municipalities valid |
| People: dominant needs | balanced / dormitory / millbelt | NO_PARK 24.9% / ROOMS 77.3% / SMOKE 33.7% |
| News | seeds 7, 3, 5, 11; eight-block town with actual fire/police | 958 / 1224 / 385 / 1172 dispatches; people 8.5% / 4.6% / 19.5% / 5.9%; zero unresolved or lost IDs |
| News no-news hashes | same seed order | `c2b4dc31`, `5177e530`, `a77aefa8`, `490f49fe` |
| Save size | seed 7, balanced, 1674 living citizens | 740,508 total bytes; citizens 358,202 / 439,200 budget; 1609 archived records, mean 42.38 shorthand bytes (limit 45) |
| Meat | 4 seeds × balanced/estate | 4505 source units, 3959 eaten, 82 spoiled; all 8/8 stock and pen identities exact |
| Legacy export smoke | all four `--save` paths | one-year people/news/meat and snapshot save-size pass; news has only two rows, so its 50% share is explicitly insufficient for budget measurement |
| Owner control city | absent | Deferred; no owner-city numbers or hash claimed |

People's balanced sample includes the existing six declared stress municipalities
because a competent scripted mayor rarely creates every need. Its content count
is one in 2,464,392 observations, not a promise of a comfortable default city.
Camping changed longitudinal housing pressure in the previous tranche; the
dominant ROOMS result is reported, not tuned away during integration.

## Citizen recording

[Play Fernble Clovermere's 2010](people-film/index.html). Twelve monthly frames
from a generated seed-7 city, citizen **52**, final hash **b33462ba**. The selected
rabbit resolves throughout; this recording uses the home fallback. It is a
monthly time-lapse, not continuous animation or an implemented favourite/star UI.
`--film N` separately records moving walkers at one simulation instant.

The source was generated with `createMayor({parks:2, markets:1, stations:true})`
for 120 months. Export that state, then reproduce with:

```sh
node tools/play.mjs --save source.json --years 1 --film-year 2010 --follow citizen 52 --w 640 --h 400 --out docs/people-film
```

The time-lapse samples half a second of visual walker motion per month without
advancing the simulation RNG. PNGs use the actual game renderer. Cleanup removes
only frame filenames listed by the preceding manifest, never arbitrary PNGs.

## Owner-city arrival procedure

Put the unmodified owner export at `docs/fixtures/control-city.json`, then run:

```sh
node tools/control-city.mjs --record
node tools/control-city.mjs
node tools/check.mjs
```

Review and commit the JSON plus `.expected.json` together. Recording refuses to
overwrite an existing baseline. Verification checks the exact source SHA-256,
load/rebuild hash, starting month and twelve-month final hash. Once the fixture
exists, the canonical suite requires its reviewed baseline; it cannot silently
skip a missing or mismatched expected file. Run all four probes on it and add
its results alongside, clearly separated from these synthetic measurements.

## Symptom traps

| Symptom | First check |
|---|---|
| Innocent theft clearance frees a later murderer | Latest retained arrest must equal the cleared arrest; run integration mutations |
| Prison inmate says Centre | `pinTarget` must inspect the custody building kind |
| Tent has no biography links or homeless retiree says content | Campsite resident IDs, physical camp tile, and ROOMS priority |
| News probe fails every seed despite healthy shares | Construction counter must not be shadowed; assert actual civic placement |
| One-story save fails the long-run percentage budget | Look for the explicit under-30-dispatch sample qualification |
| Export probe changes the city by construction | `--save` must select the loaded world with no scripted mayor |
| Follow frame stays at home | The citizen may have no active sampled walker; manifest state says home explicitly |
| Recording looks stale after a tick | Invalidate the real renderer and notify walkers after each tick |
| Control regression passes after changing its source | Verify source digest as well as final hash; never rerecord automatically |
| Family/custody IDs disappear after load | Re-run the life/archive and civic/camping suite blocks before adjusting baselines |

## Browser and verification evidence

Final canonical run: **629 checks, zero failures**. Four integration mutations
were killed. All default probes and all four legacy-export smoke runs passed.

The local browser harness loaded the real app, used a scripted mayor for
construction, and ran its actual clock at **×3 through 120 months**, ending at
1654 residents. Offers interrupted the clock and were dismissed before continuing.
This was one fresh city run, not three separate cities. Inspect stayed pinned to
Scrnight Ringtail, id 6: arrived month 5, hired month 6, befriended Sookkin
Mousewell (id 187) at month 29. The same card displayed that first friendship.

In the separate campsite fixture, clicking Ashby Reynard on the tent card opened
the fox's real portrait and biography, physical camp coordinates and “we need a
home again” action. The live hall fixture's card showed **2/40 → 0/40**, with
yearly sales **2 → 4**, after explicit stock receipt and the real meat sale pass.
These were forced interaction checks, not claims about spontaneous stock supply.
Browser error logs were empty across the combined run, campsite and rendering
checks. The twelve-frame gallery was inspected visually and its Play control
advanced the recorded month.

Timing on this machine: the combined run sampled 11,785 animation-frame
intervals, mean 16.96 ms, p95 16.80 ms (including periods awaiting offers).
A separate warm-cache rendering measurement at zoom 2, population 1797 and
150 walkers, measured 120 calls after 20 warmups: walker update plus the actual
renderer, Inspect bubbles and building character, **mean 1.54 ms, p95 4.60 ms**.
That excludes simulation ticks, static-layer rebuilds and DOM card work; it is
a local smoke measurement, not a cross-device performance guarantee.

## Independent hostile review

Review progressed **6.5 → 8.5 → 9.0/10**. The final reviewer found no remaining
blocking defects, inspected the runtime/tool changes, full-suite and probe
evidence, control-city checks and recording, and independently reran all four
mutations successfully. The remaining uncertainty is finite synthetic/browser
coverage and the absent owner export; it is not concealed by a fabricated fixture.
