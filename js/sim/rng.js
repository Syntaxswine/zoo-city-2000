// rng.js — the only source of randomness in the game.
//
// No `Math.random` anywhere in js/. A city that grows differently on reload
// would break save/load round-trips and make every bug unreproducible, so
// every random draw comes from a seeded stream that is part of the saved
// state. mulberry32: 32-bit state, one multiply-xorshift per draw, good enough
// for a game and trivially serialisable (the state IS the seed).
//
// Two kinds of draw live here:
//   makeRng(seed)      a STREAM — advances; used by the simulation tick
//   hash01(a, b, salt) a PURE hash of integers — never advances; used by the
//                      painter for per-tile variation (a tile must look the
//                      same every frame and must not consume sim randomness)

/** Turn any string into a 32-bit seed (FNV-1a). */
export function seedFromString(s) {
  let h = 0x811c9dc5;
  const str = String(s);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A resumable random stream. `state` is exposed so a save can carry it and a
 * load can hand it back — `makeRng(saved.state)` continues exactly where the
 * saved game left off.
 */
export function makeRng(seed) {
  let a = (typeof seed === "string" ? seedFromString(seed) : seed) >>> 0;
  const rng = {
    /** Uniform in [0, 1). */
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    /** Integer in [0, n). */
    int(n) {
      return Math.floor(rng.next() * n);
    },
    /** Uniform in [lo, hi). */
    range(lo, hi) {
      return lo + rng.next() * (hi - lo);
    },
    /** True with probability p. */
    chance(p) {
      return rng.next() < p;
    },
    /** One element of a non-empty array. */
    pick(arr) {
      return arr[Math.floor(rng.next() * arr.length)];
    },
    /** Fisher–Yates, in place, returns the array. */
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        const t = arr[i];
        arr[i] = arr[j];
        arr[j] = t;
      }
      return arr;
    },
    get state() {
      return a;
    },
    set state(v) {
      a = v >>> 0;
    },
  };
  return rng;
}

/** Pure integer hash → [0, 1). Same inputs, same answer, forever. */
export function hash01(x, y, salt = 0) {
  let h = (Math.imul(x | 0, 0x9e3779b1) ^ Math.imul(y | 0, 0x85ebca77) ^ Math.imul(salt | 0, 0xc2b2ae3d)) >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b) >>> 0;
  h ^= h >>> 16;
  return h / 4294967296;
}
