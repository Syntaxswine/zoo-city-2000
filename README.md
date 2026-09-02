# ZOO CITY 2000

An isometric city builder where anthropomorphic animals live and grow
together. Zone residential, commercial and industrial land, lay roads, set
three tax rates, and cope with what the years throw at the town — fires,
floods, booms, recessions, a beaver dam, a tax revolt, a tortoise's
hundredth birthday.

**Play:** https://syntaxswine.github.io/zoo-city-2000/

The population is not a number. It is a roster of named rabbits, mice,
foxes, beavers, owls, bears, tortoises and raccoons, each with a home, a
job, an age, friends and a mood. Buildings grow when the family in them is
crowded; children move out at sixteen; elders retire and stay; a funeral
introduces the mourners to each other. The town's growth ceiling rises with
how well the animals mix — the **Zoo City index** on the census card is the
share of friendships that cross species, and it multiplies the cap.

## Run

```
node tools/serve.mjs          # http://localhost:8139
node tools/check.mjs          # invariant suite, exits 1 on any failure
node tools/playtest.mjs       # scripted mayor, 30 years, prints the curves
node tools/shots.mjs --sheet  # every sprite family to docs/shots/*.png
```

No dependencies, no build. Everything under `js/sim/`, `js/art/` and
`js/iso/` imports in Node; only `render.js`, `ui.js`, `input.js` and
`main.js` touch the DOM.

## The rules are the game

Every equation the sim runs is printed live in the **Rules** tab with the
current numbers substituted, and every constant lives in one file
(`js/sim/rules.js`). The model is the Micropolis `SetValves()` lineage,
re-derived for a 2,000-animal town and measured before it was written down
(`SPEC.md` §4 has the lumped-run numbers; `tools/playtest.mjs` reproduces
them on the real map):

| what | rule |
|---|---|
| residential wants jobs | `rR = (J + 40 − W) / max(W, 40)` |
| commerce wants customers | `rC = (0.22·P + 20 − Jc) / max(Jc, 40) + 0.5·min(0, W/J − 1)` |
| industry sells outside | `rI = (ext · 1.15 · Lab − 1) · 2`, `ext` from a 12.5-year cycle × edge roads × events |
| taxes | neutral rate `n = clamp(9 − P/1600, 6, 9)`; `T = 0.04·(n − rate)` below it, `−(0.10·d + 0.0125·d²)` above |
| demand | leaky integrator, 63% of a step in six months |
| the cap | `Cap = (1200 + 150·parks + 500·zoos + festival) · (1 + 0.5·H)` |
| a lot grows | road within 3 tiles, `score = V + (LV − Pol − 40)/200 > 0.05`, 70% full, land value permits the storey |
| pollution | every source spreads linearly over its radius; a lone works stinks next door, pigs and skunks dirty their lot, parks are sinks; no wind |
| crime | `40 − 0.5·LV + 0.4·density + 40·unemployed share − police`; above 60 it costs land value and shops |

The hover card's **WHY NOT** line is computed by the same function that
decides growth — it can only ever say what the rule did.

## The zoo

| species | what they want | what they do to the town |
|---|---|---|
| rabbit | parks, trees | litters of three; the Rabbit Warren boon |
| mouse | towers | short lives, big litters; the Mouse Boom |
| fox | land value ≥ 50 | shops; the Fox Market Fair |
| beaver | water, industry | the mill-town workforce; they build dams |
| owl | trees, the zoo | shopkeepers; long lives |
| bear | cottages, trees | sleep from December to March; loyal |
| tortoise | a short commute | live 150 years; a centenary raises the street's value forever |
| raccoon | nothing — they come when it is dirty | the smog readout with a face |
| pig | mud, industry | litters of five; the works' workforce; messy — a tenement of pigs smells like a small factory, and raccoons move in next door; truffle season |
| cow | pasture: cottages and parks | slow, calm; the Dairy Fair |
| wolf | woods, and a town full of things to eat | arrive as a pack; the Wolf Moon |
| cat | flats, shops, mice | shopkeepers; the mouse's other problem |
| hawk | towers | commute anywhere; see the whole city |
| skunk | woods, dirt | nobody's prey; stinks; only pigs and raccoons will live next door; sprays a predator now and then |

**Services.** A fire station (§500, §400/yr) covers six tiles: a fire
starts there a sixth as often, burns one month instead of two, and barely
spreads. A police station covers
six tiles against a crime field (base minus land value plus density plus
unemployment): high crime drags land value and mood, keeps shops from
growing, and lets a named fox, raccoon or cat rob a store. The `O` overlay
shows crime in red and police cover in blue.

**Predators and prey.** Rabbits fear foxes, wolves and hawks; mice fear
foxes, owls, cats and hawks; pigs and cows fear wolves. A prey household
loses mood for every predator species living next door — unless someone in
it is *friends* with that species. Such friendships form slowly (the pair is
wary) and count double in the Zoo City index. The bridge is a friendship,
never a wall.

Species are weights, never gates: a factory belt by the river fills with
beavers, a leafy suburb with owls, a dirty core with raccoons. The census
card prints the histogram and a one-line city character ("a beaver
mill-town with a fox problem").

## Instruments

- `tools/playtest.mjs --layout balanced|dormitory|millbelt --schedule 15:13,22:7`
  — a scripted mayor on the real map; the SPEC's acceptance targets.
- `tools/check.mjs` — 47 checks: ledger conservation to the §, valves
  bounded, no NaN, the dangling-id law, rosters and capacities, commutes on
  roads, determinism, save → load → continue hash-equal, input-log replay,
  `budget.post` as the only cash mutator, relative imports, no
  `Math.random`, every sprite pixel a palette key, every anchor inside its
  sprite, 16/16 road masks, the painter key.
- `tools/shots.mjs --scene` — the depth-sort proof: a 12×12 block with every
  building family and twenty walkers at fractional positions, including one
  on a tile seam and one in front of the tallest tower.

## Design record

`SPEC.md` is the specification a three-design panel converged on
(systems-first, zoo-first, ship-first; three judges). `BACKLOG.md` holds the
labelled later layers. The art is text: every sprite is rows of palette keys,
built things are box solids through a z-buffer rasteriser, animals are
hand-authored.

## Licence

MIT.
