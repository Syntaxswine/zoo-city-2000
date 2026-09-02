// rules.js — THE ONE OBJECT the Rules tab, the hover card and the playtest
// read. Every constant the sim uses lives in KNOBS; every equation the player
// can read lives in RULES with a `live(world, c)` that substitutes the current
// numbers. If a rule is changed here, the game, the panel and the sweep all
// change together — there is no second copy. SPEC §4–§9.

export const KNOBS = {
  // cadence
  TICKS_PER_YEAR: 12,
  // capacities per tier (index 0..3)
  R_CAP: [0, 4, 10, 24],
  C_JOBS: [0, 3, 8, 20],
  I_JOBS: [0, 4, 10, 24],
  ZOO_JOBS: 12,
  STATION_JOBS: 4,          // a fire or police station employs four (C-type jobs)
  // demand
  VALVE_LAG: 0.15,          // leaky integrator gain: 63% of a step in 6 months
  JOB_SEED: 40,             // +40 jobs pull on an empty map
  C_PER_CITIZEN: 0.22,      // internal market: shop jobs wanted per citizen
  C_SEED: 20,
  I_EXT_GAIN: 1.15,
  EXT_CYCLE_TICKS: 150,     // 12.5-year external cycle
  EXT_CYCLE_AMP: 0.10,
  EDGE_ROAD_BASE: 0.85,
  EDGE_ROAD_STEP: 0.15,
  EDGE_ROAD_MAX: 3,
  TAX_BELOW_GAIN: 0.04,
  TAX_ABOVE_LIN: 0.10,
  TAX_ABOVE_SQ: 0.0125,
  NEUTRAL_MAX: 9,
  NEUTRAL_MIN: 6,
  NEUTRAL_PER_P: 1 / 1600,  // n(P) = clamp(9 − P/1600, 6, 9)
  CAP_BASE: 1200,
  CAP_PARK: 150,
  CAP_ZOO: 500,
  CAP_H_GAIN: 0.5,          // Cap × (1 + 0.5·H)
  // lots
  ROAD_REACH: 3,
  LOCAL_SCALE: 200,
  LOCAL_CLAMP: 0.3,
  SMOG_REFUSE: 60,
  GROW_THRESH: 0.05,
  SPROUT_P: 0.25,
  GROW_P: 0.10,
  DECAY_THRESH: -0.15,
  DECAY_P: 0.10,
  FILL_TO_GROW: 0.7,
  R_FILL_TO_DECAY: 0.5,
  LV_TIER: [30, 60],        // LV < 30 → tier 1 max, < 60 → 2, else 3 (R and C)
  // fields
  // Pollution: SC4-style additive sources with linear falloff over a radius
  // (a single works stinks next door; a block interior saturates). No wind.
  EMIT_I: [0, 25, 45, 70],
  EMIT_I_RADIUS: [0, 2, 3, 4],
  EMIT_C: [0, 0, 4, 10],
  EMIT_C_RADIUS: [0, 0, 1, 2],
  EMIT_ROAD: 2,
  EMIT_TRAFFIC_DIV: 4,
  EMIT_TRAFFIC_MAX: 28,
  EMIT_ROAD_RADIUS: 1,
  EMIT_TREE: -4,
  EMIT_PARK: -12,
  EMIT_PARK_RADIUS: 2,
  EMIT_FIRE: 50,
  EMIT_FIRE_RADIUS: 3,
  MESS: { pig: 1.5, skunk: 1.0 },  // mess/stink per animal at home, over 1 tile — a full tenement of pigs is a small factory
  MESS_RADIUS: 1,
  // services (the owner: "police and fire is noticeably absent")
  FIRE_RADIUS: 6,           // a fire station covers Chebyshev 6: fires burn one month and spread at 0.1 instead of 0.3
  FIRE_SPREAD: 0.3,
  FIRE_SPREAD_COVERED: 0.1,
  FIRE_START_COVERED: 1 / 6, // a covered lot is picked as a fire's origin at one-sixth the weight: unlikely, never impossible
  POLICE_RADIUS: 6,         // full effect within 3, half effect to 6 (Micropolis: an 8x8 cell smoothed three times)
  POLICE_NEAR: 3,
  POLICE_EFFECT: 60,
  CRIME_BASE: 40,           // crime = 40 − 0.5·LV + 0.4·density3 + 40·(U/W) − police, 0..100 (Micropolis: 128 − LV + density − police)
  CRIME_LV: 0.5,
  CRIME_DENSITY: 0.4,
  CRIME_UNEMP: 40,
  CRIME_HIGH: 60,           // above this: LV −10, shops' local score −0.2
  CRIME_LV_PENALTY: 10,
  CRIME_C_PENALTY: 0.2,
  CRIME_MOOD: 0.3,          // mood lost per point of crime at home above 40
  CRIME_MOOD_FROM: 40,
  HEIST_CRIME: 70,          // a shop above this can be robbed
  LV_BASE: 35,
  LV_CENTRE: 40,
  LV_CENTRE_RADIUS: 24,
  LV_NATURE: 3,
  LV_PARK: 12,
  LV_PARK_RADIUS: 4,
  LV_ZOO: 6,
  LV_ZOO_RADIUS: 5,
  LV_POL: 0.6,
  COMMUTE_MAX: 40,
  // citizens
  ARRIVE_GAIN: 0.10,
  ARRIVE_DIV: 3,
  LEAVE_P_UNEMP: 0.06,
  LEAVE_P_EMP: 0.015,
  LEAVE_FRIEND_DAMP: 0.2,
  FRICTION_P: 0.004,
  BIRTH_DIV: 96,
  BIRTH_FULL_MULT: 0.25,
  ADULT_AGE: 16,
  FRIEND_SAMPLES: 200,
  FRIEND_P: 0.05,
  FRIEND_MAX: 4,
  FUNERAL_P: 0.5,
  PREY_FLIGHT: 10,          // mood lost per predator species next door without a bridging friend
  PREDPREY_WEIGHT: 2,       // a predator–prey friendship counts twice in H
  H_FLOOR: 20,              // H fades in over the first 20 friendships (a sample of one is not an index)
  JOB_SEARCHES: 64,
  CAMPERS_MAX: 8,
  CAMPER_TICKS: 3,
  REHOME_RADIUS: 12,
  // budget (per year)
  TAX_R_PER_CITIZEN: 1.0,
  TAX_C_PER_JOB: 1.5,
  TAX_I_PER_JOB: 2.0,
  UPKEEP_CITIZEN: 12,
  UPKEEP_ROAD: 5,
  UPKEEP_BRIDGE: 12,
  UPKEEP_TIER: 4,
  UPKEEP_PARK: 300,
  UPKEEP_ZOO: 1500,
  UPKEEP_STATION: 400,
  COST: { zoneR: 5, zoneC: 8, zoneI: 8, road: 10, bridge: 40, bulldoze: 2, bulldozeTree: 4, tree: 4, park: 150, zoo: 2500, pond: 40, fire: 500, police: 500 },
  START_CASH: 20000,
  RECEIVERSHIP: -10000,
  // events
  EVENT_P: 1 / 30,
  DISASTER_COOLDOWN: 12,
  MILESTONES: [[50, "hamlet"], [200, "village"], [500, "town"], [1000, "city"], [2000, "metropolis"]],
};

const f2 = (v) => (Math.round(v * 100) / 100).toFixed(2);
const f1 = (v) => (Math.round(v * 10) / 10).toFixed(1);

/**
 * The player-readable rule table. `c` is the census for this tick (see
 * census.js) and `d` the demand breakdown (demand.js) — both are recomputed
 * every tick and cached on the world as `world.last`.
 */
export const RULES = Object.freeze([
  {
    id: "T1", title: "Neutral tax rate falls with size",
    formula: "n = clamp(9 − P/1600, 6, 9)",
    live: (w) => `n = clamp(9 − ${w.last.census.P}/1600, 6, 9) = ${f1(w.last.demand.n)}%  (rates R ${w.rates.R} · C ${w.rates.C} · I ${w.rates.I})`,
  },
  {
    id: "T2", title: "Tax term (additive to the valve)",
    formula: "T = 0.04·(n − rate) below n;  −(0.10·d + 0.0125·d²) above, d = rate − n",
    live: (w) => `T_R ${f2(w.last.demand.T.R)} · T_C ${f2(w.last.demand.T.C)} · T_I ${f2(w.last.demand.T.I)}`,
  },
  {
    id: "D1", title: "Residential wants jobs",
    formula: "rR = (J + 40 − W) / max(W, 40)",
    live: (w) => `rR = (${w.last.census.J} + 40 − ${w.last.census.W}) / max(${w.last.census.W}, 40) = ${f2(w.last.demand.r.R)}`,
  },
  {
    id: "D2", title: "Commerce wants customers (and workers)",
    formula: "rC = (0.22·P + 20 − Jc) / max(Jc, 40) + 0.5·min(0, W/J − 1)",
    live: (w) => `rC = (0.22·${w.last.census.P} + 20 − ${w.last.census.Jc}) / max(${w.last.census.Jc}, 40) + … = ${f2(w.last.demand.r.C)}`,
  },
  {
    id: "D3", title: "Industry sells to the outside world",
    formula: "rI = (ext · 1.15 · Lab − 1) · 2 ;  ext = cycle × (0.85 + 0.15·min(edgeRoads,3)) × events",
    live: (w) => `ext ${f2(w.last.demand.ext)} · Lab ${f2(w.last.census.Lab)} · edge roads ${w.last.census.edgeRoads} → rI = ${f2(w.last.demand.r.I)}`,
  },
  {
    id: "D4", title: "Demand is a leaky integrator",
    formula: "V ← V + 0.15·(clamp(r + T, −1, 1) − V)",
    live: (w) => `V_R ${f2(w.valves.R)} · V_C ${f2(w.valves.C)} · V_I ${f2(w.valves.I)}`,
  },
  {
    id: "D5", title: "The cap: a city can only hold so many until it mixes",
    formula: "Cap = (1200 + 150·parks + 500·zoos + festival) · (1 + 0.5·H) ;  V_R ≤ 1 − P/Cap ;  H fades in over the first 20 friendships",
    live: (w) => `Cap = (1200 + 150·${w.last.census.parks} + 500·${w.last.census.zoos} + ${w.festivalBonus}) · (1 + 0.5·${f2(w.last.census.H)}) = ${Math.round(w.last.demand.cap)} ; P ${w.last.census.P}`,
  },
  {
    id: "G1", title: "A lot needs a road within 3 tiles",
    formula: "access ⇔ roadDist ≤ 3 (BFS through any tile)",
    live: (w) => `${w.last.census.lotsNoRoad} zoned lots have no road`,
  },
  {
    id: "G2", title: "Local score: land value minus smog",
    formula: "local_R = clamp((LV − Pol − 40)/200, ±0.3), refused if Pol > 60 ; local_C = 0.6·(customers) + 0.4·(LV−50)/200 ; local_I = 0.4·(50−LV)/200",
    live: (w) => `mean LV ${f1(w.last.census.meanLV)} · mean Pol ${f1(w.last.census.meanPol)}`,
  },
  {
    id: "G3", title: "Grow and decay",
    formula: "score = V + local ; grow if score > 0.05 and (empty or 70% full): p = (0.25 | 0.10)·score /month ; decay if score < −0.15: p = 0.10·(−score)",
    live: (w) => `last tick: ${w.last.grew} grew · ${w.last.decayed} decayed`,
  },
  {
    id: "G4", title: "Land value permits density",
    formula: "R and C: LV < 30 → 1 storey, < 60 → 2, else 3 ; I: always 3 ; Low density brush caps at 1",
    live: () => "",
  },
  {
    id: "F1", title: "Pollution",
    formula: "each source spreads linearly over its radius: I tier 25/45/70 over 2/3/4 tiles, C tier 3 10 over 2, roads 2 + traffic/4 over 1, fire 50 over 3, pigs 1.5 and skunks 1.0 each over 1 (mess); parks −12 over 2, trees −4; additive, capped 100 — no wind",
    live: (w) => `mean Pol ${f1(w.last.census.meanPol)} · max ${w.last.census.maxPol}`,
  },
  {
    id: "F2", title: "Land value",
    formula: "LV = 35 + 40·(1 − dCentre/24) + 3·nature8 + 12·[park within 4] + 6·[zoo within 5] − 0.6·Pol",
    live: (w) => `mean LV ${f1(w.last.census.meanLV)}`,
  },
  {
    id: "B1", title: "Income per year",
    formula: "rate_R · Σ(0.5 + LV_home/100) + rate_C · 1.5·C jobs filled + rate_I · 2.0·I jobs filled",
    live: (w) => `≈ §${w.last.budget.incomeYr}/yr`,
  },
  {
    id: "B2", title: "Upkeep per year",
    formula: "12·P + 5·roads + 12·bridges + 4·Σ tiers + 300·parks + 1500·zoos + 400·stations",
    live: (w) => `≈ §${w.last.budget.upkeepYr}/yr → net §${w.last.budget.incomeYr - w.last.budget.upkeepYr}/yr`,
  },
  {
    id: "C1", title: "Animals arrive when there are homes and demand",
    formula: "households/month = 0.10 · V_R · vacantR / 3 ; species by what you built",
    live: (w) => `vacant homes ${w.last.census.vacantR} · arrived last tick ${w.last.arrived}`,
  },
  {
    id: "C2", title: "Animals leave when demand is negative",
    formula: "p/household = (0.06 unemployed | 0.015) · (−V_R) · (1 − 0.2·friends) · (1.5 − mood/100)",
    live: (w) => `left last tick ${w.last.left} · unemployed ${w.last.census.U}`,
  },
  {
    id: "C3", title: "Live and grow together",
    formula: "friendships form at work, next door and in parks (p = 0.05·affinity; predator–prey pairs 0.4) ; H = cross-species share, a predator–prey friendship counts twice ; a funeral befriends the mourners",
    live: (w) => `${w.last.census.friendships} friendships · ${w.last.census.predPrey} predator–prey · Zoo City index ${f2(w.last.census.H)} · approval ${Math.round(w.last.census.approval)}`,
  },
  {
    id: "C4", title: "Prey flight",
    formula: "a rabbit, mouse, pig or cow loses 10 mood per predator species living next door — unless someone in the household is friends with that species",
    live: () => "the bridge is a friendship, never a wall",
  },
  {
    id: "S1", title: "Crime",
    formula: "crime = 40 − 0.5·LV + 0.4·animals in the 3×3 + 40·unemployed share − police ; above 60: LV −10, shops −0.2, a shop above 70 can be robbed ; mood −0.3 per point above 40 at home",
    live: (w) => `mean crime on built lots ${f1(w.last.census.meanCrime)} · max ${w.last.census.maxCrime} · unemployed share ${f2(w.last.census.W ? w.last.census.U / w.last.census.W : 0)}`,
  },
  {
    id: "S2", title: "Police cover",
    formula: "a police station (§500, §400/yr, 4 jobs) takes 60 off crime within 3 tiles and 30 within 6",
    live: (w) => `${w.last.census.policeStations} police station${w.last.census.policeStations === 1 ? "" : "s"}`,
  },
  {
    id: "S3", title: "Fire cover",
    formula: "a fire station (§500, §400/yr, 4 jobs) covers 6 tiles: a fire starts there one-sixth as often, burns one month instead of two, and spreads at 0.1 instead of 0.3 — unlikely, never impossible",
    live: (w) => `${w.last.census.fireStations} fire station${w.last.census.fireStations === 1 ? "" : "s"} · ${w.last.census.burning} burning`,
  },
  {
    id: "X1", title: "Traffic is a readout, not a gate",
    formula: "traffic(road) = commuter paths through it ; feeds pollution and the busy sprite only",
    live: (w) => `busiest road ${w.last.census.maxTraffic} commuters`,
  },
]);
