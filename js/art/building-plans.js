// Four additional authored plans per original zone/tier family.
// Coordinates are world units inside one tile; all details remain box solids.
import { box, litSkin, flatSkin } from "./solid.js";

function legacyPlans(z, t, K) {
  const { walled, doorAt, BRICK, CONC_WALL, RUST, SLATE_SKIN: roof, C_ROOF,
    TIMBER: wood, AWNING, AWNING_M, HOOK, STEP, GRASS } = K;
  const material = z === 1 || z === 4 ? BRICK : z === 2 ? CONC_WALL : RUST;
  const skin = (h) => walled(litSkin(material, { height: h }), h,
    { door: doorAt(5), storey: z === 3 ? 10 : 8, sill: z === 2 && t === 1 ? 1 : 3, winH: z === 2 && t === 1 ? 5 : 3 });
  const body = (a, b, w, d, h, c = 0) => box(a, a + w, b, b + d, c, c + h, skin(h));
  const cap = (a, b, w, d, c, h = 1) => box(a, a + w, b, b + d, c, c + h, z === 2 ? C_ROOF : roof);
  const stack = (a, b, h, c = 0) => box(a, a + 2, b, b + 2, c, c + h, litSkin(RUST, { height: h }));
  const pitch = (a, b, w, d, c) => Array.from({ length: 4 }, (_, n) => cap(a + n, b + n, w - 2 * n, d - 2 * n, c + n));
  const garden = (a, b, w, d, c) => box(a, a + w, b, b + d, c, c + 1, flatSkin(GRASS[3], GRASS[1], GRASS[0]));
  const hooks = (a, b, n, c) => [box(a, a + n * 2, b, b + 0.5, c, c + 0.5, wood),
    ...Array.from({ length: n }, (_, k) => box(a + k * 2 + 0.5, a + k * 2 + 1, b, b + 0.5, c - 2, c, HOOK))];
  // Porch/dormer and an L-plan with a low lean-to.
  if (z === 1 && t === 1) return [
    [body(2, 2, 12, 10, 8), ...pitch(1, 1, 14, 12, 8), body(7, 8, 4, 3, 3, 9), cap(6.5, 7.5, 5, 4, 12),
      box(3, 12, 12, 15.5, 0, 1, wood), box(3, 12, 12, 15.5, 6, 7, wood),
      box(3, 3.8, 14.5, 15.3, 1, 6, wood), box(11, 11.8, 14.5, 15.3, 1, 6, wood)],
    [body(1, 1, 8, 14, 8), ...pitch(0.5, 0.5, 9, 15, 8), body(9, 7, 6, 8, 5), cap(9, 6.5, 6.5, 9, 5), stack(11, 9, 9)],
  ];
  // Bay-fronted two-storey and a broad mansard with two dormers.
  if (z === 1 && t === 2) return [
    [body(2, 1, 12, 11, 16), cap(1, 0.5, 14, 12, 16), body(4, 12, 7, 3.5, 13), cap(3.5, 11.5, 8, 4.5, 13), stack(11, 2, 6, 17)],
    [body(1, 1, 14, 14, 16), ...pitch(0.5, 0.5, 15, 15, 16), cap(4.5, 4.5, 7, 7, 20, 2),
      body(3, 11, 3, 3, 3, 17), body(10, 11, 3, 3, 3, 17), cap(2.5, 10.5, 4, 4, 20), cap(9.5, 10.5, 4, 4, 20)],
  ];
  // Corner balconies and a setback roof garden.
  if (z === 1 && t === 3) return [
    [body(2, 2, 12, 12, 32), cap(1, 1, 14, 14, 32), ...[8, 16, 24].flatMap(c => [cap(7, 14, 9, 2, c), cap(14, 7, 2, 9, c)]), body(3, 3, 5, 5, 4, 33)],
    [body(1, 1, 14, 14, 24), cap(0.5, 0.5, 15, 15, 24), body(2, 2, 8, 8, 12, 25), cap(1.5, 1.5, 9, 9, 37),
      garden(2, 12, 12, 2, 25), garden(12, 2, 2, 9, 25), box(3, 10, 10, 11, 25, 26, wood)],
  ];
  // Corner entrance with wraparound canopy; a three-kiosk row.
  if (z === 2 && t === 1) return [
    [body(1, 1, 12, 12, 10), cap(0.5, 0.5, 13, 13, 10), box(3, 15.5, 13, 15.5, 6, 7, AWNING), box(13, 15.5, 3, 15.5, 6, 7, AWNING), body(4, 4, 4, 4, 3, 11)],
    [0, 1, 2].flatMap(n => [body(0.5 + n * 5, 4, 4.5, 9, 8 + (n === 1 ? 3 : 0)), cap(n * 5, 3.5, 5, 10, 8 + (n === 1 ? 3 : 0)), box(n * 5, n * 5 + 5, 13, 15, 5, 6, AWNING)]),
  ];
  // Clock front and an arcade under a raised upper storey.
  if (z === 2 && t === 2) return [
    [body(1, 1, 14, 12, 22), cap(0.5, 0.5, 15, 13, 22), body(6, 9, 5, 6, 8, 22), cap(5.5, 8.5, 6, 7, 30),
      box(6.5, 10.5, 15, 15.3, 24, 28, { ...C_ROOF, side: (a, k) => (Math.abs(a - 2) < 0.4 || Math.abs(k - 2) < 0.4 ? "+" : "(") })],
    [body(1, 1, 14, 9, 20), body(1, 10, 14, 5, 12, 8), cap(0.5, 0.5, 15, 15, 20),
      ...[1, 5, 9, 13].map(a => box(a, a + 1.5, 13, 15, 0, 8, litSkin(CONC_WALL, { height: 8 })))],
  ];
  // A setback tower and two separate shafts sharing a lobby.
  if (z === 2 && t === 3) return [
    [body(1, 1, 14, 14, 20), cap(0.5, 0.5, 15, 15, 20), body(2, 2, 10, 10, 20, 21), cap(1.5, 1.5, 11, 11, 41), body(3, 3, 6, 6, 12, 42), cap(2.5, 2.5, 7, 7, 54)],
    [body(1, 1, 14, 14, 8), cap(0.5, 0.5, 15, 15, 8), body(1, 2, 6, 11, 40, 9), body(9, 2, 6, 11, 32, 9), cap(0.5, 1.5, 7, 12, 49), cap(8.5, 1.5, 7, 12, 41)],
  ];
  // Open shed with a rear stack; a square kiln under stepped masonry.
  if (z === 3 && t === 1) return [
    [body(1, 1, 14, 6, 8), cap(0.5, 0.5, 15, 15, 8), ...[1, 13].map(a => box(a, a + 1, 13, 14, 0, 8, wood)), stack(3, 2, 16), box(5, 10, 10, 14, 0, 2, wood)],
    [body(3, 3, 10, 10, 7), cap(2, 2, 12, 12, 7, 2), cap(4, 4, 8, 8, 9, 2), cap(6, 6, 4, 4, 11, 2), stack(11, 2, 18), box(5, 10, 13, 15, 0, 1, STEP)],
  ];
  // Paired tall chimneys; two workshops connected by a conveyor.
  if (z === 3 && t === 2) return [
    [body(1, 5, 14, 10, 14), ...pitch(0.5, 4.5, 15, 11, 14), stack(2, 1, 28), stack(10, 1, 25)],
    [body(1, 1, 5, 14, 14), body(10, 1, 5, 14, 10), cap(0.5, 0.5, 6, 15, 14), cap(9.5, 0.5, 6, 15, 10), box(6, 10, 7, 10, 8, 10, wood), stack(11, 2, 22)],
  ];
  // Cooling tower and an exposed gantry above a low works.
  if (z === 3 && t === 3) return [
    [body(1, 1, 14, 14, 16), cap(0.5, 0.5, 15, 15, 16), body(3, 3, 9, 9, 5, 17), body(4, 4, 7, 7, 8, 22), body(3, 3, 9, 9, 3, 30), cap(2.5, 2.5, 10, 10, 33), stack(12, 1, 24)],
    [body(1, 1, 14, 14, 12), cap(0.5, 0.5, 15, 15, 12), ...[2, 12].map(a => box(a, a + 2, 6, 8, 13, 32, wood)), box(1, 15, 5, 9, 30, 33, wood), box(7, 7.5, 8, 8.5, 22, 30, HOOK)],
  ];
  // Meat: hook-front stalls, tiled fronts, and increasingly tall chimney halls.
  const H = [0, 8, 14, 22][t];
  return [
    [body(1, 1, 14, 11, H), cap(0.5, 0.5, 15, 12, H), box(1, 15, 12, 15.5, 6, 7, AWNING_M), ...hooks(2, 15, 6, 6),
      ...(t > 1 ? [body(3, 3, 7, 6, 4, H + 1), cap(2.5, 2.5, 8, 7, H + 5)] : [])],
    [body(1, 1, 9, 14, H), cap(0.5, 0.5, 10, 15, H), body(10, 7, 5, 8, H - 3), cap(9.5, 6.5, 6, 9, H - 3), stack(12, 2, H + 11),
      box(1, 6, 15, 15.3, 0, 4, { ...C_ROOF, side: (a, k) => (Math.floor(a) + Math.floor(k)) % 2 ? "&" : "(" }), ...hooks(2, 15.5, 2, 6)],
  ];
}

/** Plans 4 and 5: named uses, rather than rotations of the same envelope. */
export function extraPlans(z, t, K) {
  const { walled, doorAt, BRICK, CONC_WALL, RUST, SLATE_SKIN, C_ROOF,
    TIMBER, AWNING, AWNING_M, HOOK, STEP, GRASS } = K;
  const material = z === 2 ? CONC_WALL : z === 3 ? RUST : BRICK;
  const shell = litSkin(material, {height:24});
  const roof = z === 2 ? C_ROOF : SLATE_SKIN;
  const block = (a,b,w,d,h,c=0,skin=shell) => box(a,a+w,b,b+d,c,c+h,skin);
  const room = (a,b,w,d,h,c=0) => {
    const skin = walled(litSkin(material,{height:h,grain:(x,y)=>((x+3*y)&7)===0?-0.4:0}),h,
      {door: c === 0 ? doorAt(w / 2) : null, storey:8, sill:3, winH:3});
    // Washable tiled dado identifies the processing buildings at street level.
    const tiled = z === 4 && c === 0 ? {...skin,side:(u,k,x,y)=>h-k<2 ? (Math.floor(u)%2?'&':'(') : skin.side(u,k,x,y)} : skin;
    return block(a,b,w,d,h,c,tiled);
  };
  const cap = (a,b,w,d,c,h=1) => block(a,b,w,d,h,c,roof);
  const post = (a,b,h,c=0) => block(a,b,0.8,0.8,h,c,TIMBER);
  const chimney = (a,b,h,c=0) => [block(a,b,2,2,h,c,litSkin(RUST,{height:h,grain:(x,y)=>y%5===0?-0.6:0})),cap(a-0.3,b-0.3,2.6,2.6,c+h)];
  const gable = (a,b,w,d,c) => Array.from({length:4},(_,n)=>cap(a+n,b,w-2*n,d,c+n));
  const planter = (a,b,w,d,c=0) => [block(a,b,w,d,1,c,TIMBER),block(a+0.3,b+0.3,w-0.6,d-0.6,0.7,c+1,flatSkin(GRASS[3],GRASS[1],GRASS[0]))];
  const rail = (a,b,w,c) => [block(a,b,w,0.6,0.5,c+2,TIMBER), ...[0,w/2,w-0.6].map(x=>post(a+x,b,2,c))];
  const goods = (a,b) => [block(a,b,2.5,2.5,2,0,TIMBER),block(a+3,b,2,2,3,0,TIMBER)];
  const hooks = (a,b,w,c) => [block(a,b,w,0.5,0.6,c,TIMBER), ...Array.from({length:Math.floor(w/2)},(_,i)=>block(a+1+2*i,b,0.6,0.5,2,c-2,HOOK))];
  const plans = {
    // Cross-gabled cottage with a garden; duplex with two recessed porches.
    '1:1': [
      [room(2,2,11,9,8),...gable(1,1,13,11,8),room(6,10,6,5,6),...gable(5.5,9.5,7,6,6),...chimney(3,3,5,11),...planter(1,12,3,3)],
      [room(1,1,14,9,8),...gable(0.5,0.5,15,10,8),block(1,10,14,5,0.7,0,STEP),cap(1,10,5,5,6),cap(10,10,5,5,6),post(1,14,6),post(14,14,6),...planter(6.5,12,3,3)],
    ],
    // Split-height walk-up with exterior stair; terraced townhouse over a porch.
    '1:2': [
      [room(1,1,8,13,16),cap(0.5,0.5,9,14,16),room(9,1,6,7,8),cap(9,0.5,6.5,8,8), ...Array.from({length:8},(_,n)=>block(11,14-n*0.8,3,0.9,n+1,0,STEP)),...rail(9,8,6,8),...planter(10,2,4,2,9)],
      [room(2,1,12,9,16),...gable(1,0.5,14,10,16),room(4,10,8,5,8,8),cap(3.5,9.5,9,6,16),post(4,14,8),post(11,14,8),block(3,10,10,5,1,0,STEP),...rail(4,15,8,8),...chimney(3,2,4,19)],
    ],
    // Open-court apartment and stair-stepped terrace flats.
    '1:3': [
      [room(1,1,14,5,32),room(1,6,5,9,24),room(10,6,5,9,24),cap(0.5,0.5,15,6,32),cap(0.5,6,6,9.5,24),cap(9.5,6,6,9.5,24),...planter(6.5,7,3,5),block(6,13,4,2,1,0,STEP)],
      [room(1,1,14,14,16),cap(0.5,0.5,15,15,16),room(1,1,14,9,8,17),cap(0.5,0.5,15,10,25),room(1,1,14,4,8,26),cap(0.5,0.5,15,5,34),...rail(1,14.5,14,17),...rail(1,9.5,14,26),...planter(2,12,4,2,17),...planter(9,7,4,2,26)],
    ],
    // Courtyard shop around a sheltered stall and a tall false-front shop.
    '2:1': [
      [room(1,1,14,6,9),room(1,7,5,8,9),cap(0.5,0.5,15,7,9),cap(0.5,7,6,8.5,9),block(7,10,8,4,1,6,AWNING),post(14,13,6),block(8,12,6,2,2,0,TIMBER),...goods(8,8)],
      [room(3,1,10,13,9),...gable(2.5,0.5,11,14,9),block(2,14,12,1,14),cap(1.5,13.5,13,2,14),block(3,15,10,0.5,1,10,AWNING),block(3,15.2,10,0.4,5,2,walled(shell,5,{sill:1,winH:3,door:doorAt(5)})),block(2,15,12,1,1,0,STEP)],
    ],
    // Central skylight market and a slim office over a broad showroom.
    '2:2': [
      [room(1,1,14,14,16),cap(0.5,0.5,15,15,16),block(5,2,6,12,3,17,C_ROOF),...Array.from({length:4},(_,i)=>block(5.5,2.5+i*3,5,2,0.5,20,flatSkin('=','+','&'))),block(1,14,14,2,1,6,AWNING)],
      [room(1,1,14,14,8),cap(0.5,0.5,15,15,8),room(2,2,6,10,20,9),cap(1.5,1.5,7,11,29),...rail(8,14.5,7,9),...planter(10,10,4,3,9),block(8,6,7,0.6,0.7,11,TIMBER)],
    ],
    // Bridged office wings and a broad cantilever over a narrow core.
    '2:3': [
      [room(1,1,5,14,40),room(10,1,5,14,32),cap(0.5,0.5,6,15,40),cap(9.5,0.5,6,15,32),room(6,6,4,5,7,23),cap(6,5.5,4,6,30),block(6,12,4,3,1,0,STEP)],
      [room(5,3,6,10,24),room(1,1,14,14,16,24),cap(0.5,0.5,15,15,40),block(1,1,14,14,1,24,C_ROOF),block(2,2,12,12,1,0,STEP),room(6,4,4,6,5,41),cap(5.5,3.5,5,7,46)],
    ],
    // Sawtooth repair shed and a crane-loading yard.
    '3:1': [
      [room(1,1,14,11,9),...[0,1,2].flatMap(i=>[cap(1+i*4.5,0.5,4.5,12,9),block(1+i*4.5,1,1,11,2,10,C_ROOF)]),...goods(2,13),...chimney(12,2,6,10)],
      [room(1,1,6,14,9),cap(0.5,0.5,7,15,9),post(10,3,15),post(10,14,15),block(9,2,3,13,1,15,TIMBER),block(10,10,0.5,0.5,6,9,HOOK),...goods(9,5),block(8,11,6,3,1,0,STEP)],
    ],
    // Boiler house and a loading platform beneath a clerestory workshop.
    '3:2': [
      [room(1,1,7,14,16),cap(0.5,0.5,8,15,16),...[0,1].flatMap(i=>[block(9+i*3,3,2.5,8,10,0,litSkin(RUST)),cap(8.7+i*3,2.7,3,8.6,10)]),...chimney(3,2,11,17),block(8,12,7,1,1,5,TIMBER)],
      [room(1,1,14,10,13),cap(0.5,0.5,15,11,13),room(5,2,6,8,4,14),cap(4.5,1.5,7,9,18),block(1,11,14,4,2,0,STEP),block(1,11,14,4,1,9,roof),post(1,14,7,2),post(14,14,7,2),...goods(3,12)],
    ],
    // Three silos with transfer pipe; monitor-roof assembly works.
    '3:3': [
      [room(1,1,14,5,13),cap(0.5,0.5,15,6,13),...[0,1,2].flatMap(i=>[block(1+i*5,8,4,6,25,0,litSkin(RUST,{height:25,grain:(x,y)=>y%5===0?-0.7:0})),cap(0.7+i*5,7.7,4.6,6.6,25),block(2+i*5,5,1,5,1,20,TIMBER)]),...chimney(12,2,18,14)],
      [room(1,1,14,14,22),cap(0.5,0.5,15,15,22),room(5,1,6,14,5,23),cap(4.5,0.5,7,15,28),...[1,12].flatMap(a=>chimney(a,2,12,23)),block(4,15,8,0.5,7,0,TIMBER),block(3,15.5,10,0.5,1,0,STEP)],
    ],
    // Butcher's covered yard and a pitched market counter.
    '4:1': [
      [room(1,1,7,13,8),cap(0.5,0.5,8,14,8),block(8,3,7,12,1,7,AWNING_M),post(14,14,7),block(9,12,5,2,2,0,STEP),...hooks(9,14,5,6),...chimney(3,2,5,9)],
      [room(1,1,14,10,7),...gable(0.5,0.5,15,11,7),block(1,12,14,3,1,5,AWNING_M),post(1,14,5),post(14,14,5),block(2,13,12,2,2,0,STEP),...hooks(2,14.5,12,5)],
    ],
    // Twin smokehouses and a raised processing hall over a delivery arcade.
    '4:2': [
      [...[1,9].flatMap(a=>[room(a,1,6,10,14),...gable(a-0.5,0.5,7,11,14),...chimney(a+2,3,8,17)]),block(1,11,14,4,1,7,AWNING_M),...hooks(2,14,12,7),block(2,12,12,2,2,0,STEP)],
      [room(1,1,14,7,16),room(1,8,14,7,8,8),cap(0.5,0.5,15,15,16),...[1,7,14].map(a=>post(a,14,8)),...hooks(3,14,10,7),block(2,10,12,4,1,0,STEP),...chimney(3,2,8,17)],
    ],
    // Refrigeration plant with loading canopy; tall drying hall and annex.
    '4:3': [
      [room(1,1,14,11,24),cap(0.5,0.5,15,12,24),...[2,9].map(a=>block(a,3,4,6,4,25,C_ROOF)),block(1,12,14,3,1,9,AWNING_M),post(1,14,9),post(14,14,9),...hooks(3,14,10,8),block(2,13,12,2,2,0,STEP)],
      [room(1,1,7,14,32),...gable(0.5,0.5,8,15,32),room(8,5,7,10,14),cap(8,4.5,7.5,11,14),...chimney(11,2,28),block(9,15,6,0.5,1,7,AWNING_M),...hooks(9,15.5,6,6),block(9,14,5,2,2,0,STEP)],
    ],
  };
  return [...legacyPlans(z,t,K), ...plans[`${z}:${t}`]];
}
