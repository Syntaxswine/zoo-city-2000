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
  COST: { zoneR: 5, zoneC: 8, zoneI: 8, zoneM: 12, road: 10, bridge: 40, bulldoze: 2, bulldozeTree: 4, tree: 4, park: 150, zoo: 2500, pond: 40, fire: 500, police: 500, centre: 1500, wall: 8 },
  // ---- crime and punishment (the owner, 2026-09-02; docs/PROPOSAL-CRIME-AND-PUNISHMENT.md) ----
  // Zone M — the grey-market meat hall: stall / meat hall / cold store.
  M_JOBS: [0, 3, 8, 16],
  MEAT_PER_CARN: 0.06,      // rM = (0.06·carnivores + 10 − Jm)/max(Jm, 20): a 1,600 town wants two halls
  MEAT_SEED: 10,
  M_CUSTOMERS_DIV: 40,      // local_M reads carnivores housed within 5 (shops use residents/80)
  JOB_M: { carn: 0.9, omni: 0.5, herb: 0.1 },   // job preference by diet (jobC/jobI are per species)
  // Dread — what a hall does to the street: exactly twice a works' LV shadow at every ring.
  DREAD: [0, 40, 70, 105],
  DREAD_RADIUS: [0, 2, 3, 4],
  LV_DREAD: 0.8,
  DREAD_MOOD_HERB: 0.25,    // herbivore mood −0.25·dread at home, capped, halved with a carnivore friend
  DREAD_MOOD_CAP: 25,
  DREAD_HOME_HERB: 1.0,     // herbivore home score −dread
  DREAD_HOME_CARN: 0.8,     // carnivore home score +0.8·dread — net 0 against the LV term: they do not mind
  DREAD_CARN_MOOD: 5,       // a carnivore inside the smell
  MARKET_PUSH: 0.3,         // herbivore arrival weight ×(1 − 0.3·min(1, halls/3))
  MARKET_PULL: 0.3,         // carnivore arrival weight +0.3·min(1, Jm/40)
  REHOME_DREAD: 40,         // a herbivore household at this much dread may move along the road
  REHOME_DREAD_P: 0.03,     // per month
  // A hall is part of crime.
  CRIME_M: [0, 10, 18, 25],
  CRIME_M_RADIUS: [0, 1, 2, 3],
  CRIME_UNEMP_LOCAL: 3,     // per unemployed adult in the 3×3 ("no jobs means hungry wolves")
  CRIME_UNEMP_HUNTER: 2,    // ×2 if the unemployed adult is a carnivore
  FILE_CRIME: 15,           // an incident's file stains the crime field this much …
  FILE_RADIUS: 2,           // … over this radius …
  FILE_MONTHS: 24,          // … for this long; the INVESTIGATION lasts CASE_MONTHS of it
  // The killing — any adult may kill a neighbour; weights, never gates.
  KILL_P: 0.00005,          // expected killings/month = KILL_P × Σ weights (≈ 0.3/yr in a fed, market-less town)
  KILL_DIET: { carn: 1, omni: 0.1, herb: 0.03 },
  KILL_HUNGRY: 20,          // an unemployed adult ("no jobs means hungry wolves")
  KILL_MARKET: 3,           // a meat hall within the smell of home — a buyer
  KILL_MARKET_LICENSED: 1.5,
  KILL_STAFF: 2,            // a hall's own staff has the knives
  KILL_RADIUS: 3,           // victims live within Chebyshev 3 of the killer
  KILL_OTHER: 0.1,          // a victim that is not the killer's prey
  KILL_BRIDGE: 0.1,         // a victim who is the killer's friend, or has a friend of the killer's kind
  FEAR_MOOD: 15,            // the victim's species, city-wide, for FEAR_MONTHS
  FEAR_MONTHS: 6,
  INQUEST: 200,             // the city pays for every inquest
  MEAT_PRICE: 50,           // what the hall pays the mayor's cut for a body
  // The file, the arrest, the wrongful 5%.
  CASE_MONTHS: 6,
  ARREST_BASE: 0.02,        // p/month = base + cover·policeCov/60 + prior·record → 11% / 50% / 74% over six months at cover 0 / 30 / 60
  ARREST_COVER: 0.18,
  ARREST_PRIOR: 0.05,
  WRONGFUL_P: 0.05,         // the owner's 5%: the wrong animal, random by proximity
  WRONGFUL_RADIUS: 4,
  // Custody and the sentence.
  CELLS_MONTHS: 3,
  PACIFY_MONTHS: 6,
  CENTRE_BEDS: 6,
  CENTRE_JOBS: 4,
  RECORD_WEIGHT: 2,         // ×2 per conviction in the thief pool
  FIXED_MOOD: 5,            // a fixed animal, for life
  HELD_MOOD: 15,            // the cells or the centre, while held
  FIXED_AFFINITY: 0.7,      // a fixed predator's friendship rolls with its prey (0.4 wary otherwise); counted ONCE in H
  RETURN_MOOD: 10,          // the household of an animal home from the centre, for RETURN_MONTHS
  RETURN_MONTHS: 12,
  SOLD_PRICE: 100,          // the hall's price for a convict
  COMPENSATION: 500,        // paid when the wrong animal is named
  NAMED_MOOD: 5,            // the town, for NAMED_MONTHS, when an exoneration prints
  NAMED_MONTHS: 6,
  // Burglary — where crime is high and there is a station to file it.
  BURGLARY_P: 0.006,        // p/month = min(BURGLARY_MAX, 0.006 × hot lots) — a big town's 7–17 hot lots ≈ 1/yr (0.02 gave a 150-animal town six a year)
  BURGLARY_MAX: 0.3,
  BURGLARY_RADIUS: 4,
  BURGLARY_LOSS: 20,        // × tier
  THIEF_UNEMP: 3,
  THIEF_HOME_CRIME: 2,
  THIEF_SPECIES: { fox: 2, raccoon: 2, cat: 2 },
  // The cut, the licence, the raid, the van.
  CUT_PER_JOB: 25,          // an unlicensed hall pays the mayor §25 per filled job per year, untaxed
  LICENCE_COST: 2000,
  UPKEEP_LICENCE: 400,      // per hall per year while licensed
  LICENCE_CRIME_MULT: 0.5,
  RAID_CRIME: 50,
  RAID_FINE: 200,           // × tier
  UPKEEP_CENTRE: 900,
  UPKEEP_WALL: 1,           // a tile a year — masonry needs pointing
  LV_VAN: 6,                // land value near the centre
  LV_VAN_RADIUS: 2,
  VAN_MOOD: 5,              // carnivores within VAN_RADIUS of a centre
  VAN_RADIUS: 4,
  START_CASH: 20000,
  RECEIVERSHIP: -10000,
  CHEAT_CASH: 100000,       // one press of the Options cheat's GIVE ME CASH button — an op, booked under "cheat", in the input log
  CHEAT_MAX: 10000000,      // the most one cheat op may post (a hand-edited log cannot post Infinity)
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
    id: "W1", title: "Walls: a field spreads by flood fill, not by a square",
    formula: "Σ amount·(1 − d/(R+1)), d = the shortest walk round the walls (8-connected, unit diagonals = the old square where none intervene); a wall blocks and receives nothing; a tunnel is open along its road — pollution, dread, crime, cover, land-value halos and a killer's reach all go round",
    live: (w) => `${w.wallCount || 0} wall tile${w.wallCount === 1 ? "" : "s"}${w.last.census.tunnels ? ` · ${w.last.census.tunnels} tunnel${w.last.census.tunnels === 1 ? "" : "s"}` : ""}`,
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
    formula: "friendships form at work, next door and in parks (p = 0.05·affinity; predator–prey pairs 0.4, 0.7 if the predator is fixed) ; H = cross-species share, a predator–prey friendship counts twice — ONCE if the predator is fixed (the knife buys quiet, not the index) ; a funeral befriends the mourners",
    live: (w) => `${w.last.census.friendships} friendships · ${w.last.census.predPrey} predator–prey · Zoo City index ${f2(w.last.census.H)} · approval ${Math.round(w.last.census.approval)}`,
  },
  {
    id: "C4", title: "Prey flight",
    formula: "a rabbit, mouse, pig or cow loses 10 mood per predator species living next door, × the unfixed share of that species in the 3×3 — unless someone in the household is friends with that species",
    live: (w) => `${w.last.census.fixed} fixed animals in town · the bridge is a friendship, never a wall`,
  },
  {
    id: "S1", title: "Crime",
    formula: "crime = 40 − 0.5·LV + 0.4·animals in the 3×3 + 3·unemployed adults in the 3×3 (carnivores ×2) + 40·unemployed share + a meat hall's 10/18/25 over 1/2/3 + 15 within 2 of an open file − police ; above 60: LV −10, shops −0.2, a shop above 70 can be robbed ; mood −0.3 per point above 40 at home",
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
    id: "M1", title: "A meat hall is grey commerce",
    formula: "zone M grows on its own valve rM = (0.06·carnivores + 10 − Jm)/max(Jm, 20) ; 3/8/16 jobs ; staffed by diet (carnivores 0.9, omnivores 0.5, herbivores 0.1) ; unlicensed it pays a cut of §25 per filled job, untaxed",
    live: (w) => `${w.last.census.markets} halls · ${w.last.census.Jm} jobs · V_M ${f2(w.valves.M)} · cut §${w.last.budget.cutYr}/yr${w.events.licence ? " · LICENSED (taxed at the C rate, §400/yr each)" : ""}`,
  },
  {
    id: "M2", title: "Dread — herbivores smell it four tiles off",
    formula: "a hall spreads 40/70/105 over 2/3/4 tiles ; LV −0.8·dread (twice a works) ; herbivores −0.25·dread mood (halved with a carnivore friend), −dread on the home score, and a household at dread ≥ 40 moves along the road at 3%/month ; carnivores +5 inside the smell and do not mind",
    live: (w) => `max dread ${w.last.census.maxDread} · ${w.last.census.herbNear} herbivores within the smell`,
  },
  {
    id: "M3", title: "The licence, the raid",
    formula: "the Butchers' Guild offers a licence when the first hall reaches tier 2: §2,000 + §400/yr per hall, the jobs go on the books at the C rate, crime and the buyer's pull halve ; an unlicensed hall under police cover with crime > 50 can be raided: a storey shut, §200·tier in fines",
    live: (w) => (w.events.licence ? "licensed" : "unlicensed"),
  },
  {
    id: "K1", title: "The killing — no jobs means hungry wolves",
    formula: "killings/month = 0.00005 × Σ over adults of: carnivore 1, omnivore 0.1, herbivore 0.03 ; ×20 unemployed ; ×3 within a hall's smell (×1.5 licensed) ; ×2 hall staff ; ×(0.5 + crime at home/100) ; fixed 0 ; victims live within 3: prey ×1, anyone else ×0.1, a friendship ×0.1 ; adults only ; the wake befriends the mourners",
    live: (w) => `${w.events.killings} killings since founding · ${w.last.census.U} unemployed · ${w.events.files.filter((f) => !f.closed).length} open files`,
  },
  {
    id: "P1", title: "The file and the arrest",
    formula: "every incident opens a file for 6 months ; each month p = 0.02 + 0.18·police cover/60 + 0.05·record → 11% / 50% / 74% over the file at cover 0 / 30 / 60 ; 5% of arrests take the wrong animal, random by proximity ; a file also stains crime +15 within 2 for 24 months",
    live: (w) => `taken in ${w.events.justice.takenIn} · cells ${w.events.justice.cells} · wrongful ${w.events.justice.wrongful} · exonerated ${w.events.justice.exonerated} · cold ${w.events.justice.cold}`,
  },
  {
    id: "P2", title: "The sentence",
    formula: "a predator's first conviction: the Pacification Centre (§1,500, §900/yr, 4 jobs, 6 beds; six months, home FIXED) ; a prey animal, or anyone already fixed: the meat hall (sold; §100 to the cut) ; no centre with a bed, no hall: three months in the cells and a record",
    live: (w) => `${w.last.census.centres} centre${w.last.census.centres === 1 ? "" : "s"} · ${w.last.census.held} held · pacified ${w.events.justice.pacified} · sold ${w.events.justice.sold}`,
  },
  {
    id: "P3", title: "Fixed",
    formula: "no litter (a pair needs two unfixed fertile adults) ; never a killer ; prey next door fear only the unfixed share ; prey friendships at 0.7, counted once in H ; mood −5 for life ; may keep any job, the counter included ; permanent",
    live: (w) => `${w.last.census.fixed} fixed (${w.last.census.wrongful} wrongful) · litters lost last tick ${w.last.littersLost || 0}`,
  },
  {
    id: "X1", title: "Traffic is a readout, not a gate",
    formula: "traffic(road) = commuter paths through it ; feeds pollution and the busy sprite only",
    live: (w) => `busiest road ${w.last.census.maxTraffic} commuters`,
  },
]);
