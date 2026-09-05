// Part E's two additional, authored plans per original zone/tier family.
// Coordinates are world units inside one tile; all details remain box solids.
import { box, litSkin, flatSkin } from "./solid.js";

export function extraPlans(z, t, K) {
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
