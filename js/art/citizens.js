// citizens.js — the KIT. Thirteen species, hand-authored, the organic
// exception to the box law (SPEC §0.5, §12.3).
//
// A citizen is 12×20 (a cub 8×12), composed at first use and cached:
//
//   [tail, if it hangs BEHIND]   body   [tail, if it hangs in FRONT]   head   [hat]
//
// stacked BOTTOM UP and BACK TO FRONT in one pass. The body is shared —
// two builds (small, big) × three frames (stand, stride, pass) — and the
// species is carried by three things only, because three things are all
// that survive at 12 px on a busy map:
//
//   SILHOUETTE   the head/ear overlay and the tail overlay
//   RAMP         warm / cool / olive, from js/sim/species.js
//   VALUE        furShift: rabbit and mouse light, beaver/bear/raccoon dark
//
// Every part is authored in the WARM fur keys w x y z (dark → light) and
// remapped to the species' ramp at compose time; '&' '^' are the shirt (a
// neutral concrete, so head and body separate at 1×), '+' is the eye, '('
// is an eye-white/tooth, '-' the owl's and the hawk's beak. The tortoise
// shell is EARTH (q rim, r scutes, s shade, t/u dome) — a different ramp
// from its limbs on purpose: authored in olive, the shell vanished into the
// limbs. The limbs are NOT olive either, any more (round 4): the species
// table says olive, but olive 'h' sits between grass 'n' and 'o' and the
// whole animal vanished into the lawn (luminance 43/68/96/132 against
// grass 65/91/120/151). The kit overrides the skin ramp for the tortoise
// alone (`SKIN`): warm tan (furWarm 0) limbs under the brown shell, and a
// 1-px '+' outline — the only near-black — so its silhouette closes
// against grass and asphalt alike. The palette is untouched.
//
// Beyond ears and tails, three species carry one more overlay: the cow's
// black patches ('+', painted only where fur already is, so they never
// float — `PATCHES`), the hawk's folded wings over the arms and its fanned
// tail (`WINGS`), and the pig's ring snout, which lives in its head rows.
//
// ELDER = one rung lighter, but only where the light body rung has
// headroom; a coat already at the top of its ramp (rabbit, mouse) keeps
// its two values instead of collapsing to one. Every elder also gets the
// grey marks of age: brows and a muzzle on the face, a nape patch on the
// back of the head — white on a dark coat, grey on a light one.
//
// FACINGS. SE and NE are authored; SW and NW are the AUTHORED grid
// mirrored and RE-LIT BY POSITION (`mirrorLit`) before the species remap:
// the silhouette flips, every pixel that lands where the un-flipped grid
// had the same class of pixel keeps that pixel's key (the sun has not
// moved), and only the asymmetric bits landing on new ground go through
// the rung swap. A plain flip, or `palette.relight` (which only pulls the
// extremes in), leaves the highlight on the screen-right — the first
// round's SW fox had its light leg on the wrong side.
//
// LIGHT is upper-left: screen-left of every body carries 'y', screen-right
// 'x'. The face is on the SE head only — NE is the back of the head, where
// the ears still read (that is the whole point of ears as the ID mark).
//
// The anchor is the feet: [6, 19] for adults, [4, 11] for cubs — the pixel
// that sits on the tile's ground centre.

import { defineSprite, part, blank, stamp, toRows, remap, mirror, T } from "./format.js";
import { keysOf, colourOf } from "./palette.js";
import { SPECIES_BY_ID } from "../sim/species.js";

export const FACINGS = Object.freeze(["se", "ne", "sw", "nw"]);
export const FRAMES = Object.freeze(["stand", "stepA", "stepB"]);
export const AGES = Object.freeze(["adult", "elder", "cub"]);
/**
 * The species the KIT covers — those with a head overlay below — not every
 * row of the sim's species table. The table can grow ahead of the art; the
 * sim's `ARRIVING` set keeps a species off the map until its sprites
 * exist, and `citizenSprite` throws for one, by name, rather than drawing
 * a headless body. All thirteen rows of the table are drawn today.
 */
const HEAD_SPECIES = { rabbit: 1, mouse: 1, fox: 1, beaver: 1, owl: 1, bear: 1, tortoise: 1, raccoon: 1, pig: 1, cow: 1, wolf: 1, cat: 1, hawk: 1 };
export const SPECIES_IDS = Object.freeze(Object.keys(SPECIES_BY_ID).filter((id) => id in HEAD_SPECIES));

// =========================================================================
// BODIES — rows 8..19 of the frame. The NE body is the SE body: at 12 px a
// walking figure seen from behind has the same silhouette and, with light
// from the upper-left, the same shading; the head and tail carry the facing.
// =========================================================================

const SMALL_SE = [
  // stand
  part([
    "...x&&&^x...",
    "..xy&&&^yx..",
    "..xy&&&^yx..",
    "..xy&&&^yx..",
    "..y.&&&^.x..",
    "...xxxxxx...",
    "...yyy.xx...",
    "...yyy.xx...",
    "...yy..xx...",
    "...yy..xx...",
    "..yyy..xxx..",
    "..yyy..xxx..",
  ]),
  // stride: screen-right leg forward (down-right), screen-left leg back (up-left)
  part([
    "...x&&&^x...",
    "..xy&&&^yx..",
    "..xy&&&^yx..",
    "...y&&&^xx..",
    "....&&&^.x..",
    "...xxxxxx...",
    "...yyy.xx...",
    "..yyy..xxx..",
    "..yyy...xx..",
    ".yyy....xxx.",
    ".yyy....xxx.",
    "........xxx.",
  ]),
  // pass: legs together, screen-right foot lifted
  part([
    "...x&&&^x...",
    "..xy&&&^yx..",
    "..xy&&&^yx..",
    "..xy&&&^y...",
    "..y.&&&^x...",
    "...xxxxxx...",
    "...yyy.xx...",
    "...yyy.xx...",
    "...yy..xx...",
    "...yy..xx...",
    "..yyy..xxx..",
    "..yyy.......",
  ]),
];

const BIG_SE = [
  part([
    "..xx&&&&^xx.",
    ".xy&&&&&^^yx",
    ".xy&&&&&^^yx",
    ".xy&&&&&^^yx",
    ".y.&&&&&^^.x",
    "..xxxxxxxx..",
    "..yyyy.xxx..",
    "..yyyy.xxx..",
    "..yyy..xxx..",
    "..yyy..xxx..",
    ".yyyy..xxxx.",
    ".yyyy..xxxx.",
  ]),
  part([
    "..xx&&&&^xx.",
    ".xy&&&&&^^yx",
    ".xy&&&&&^^yx",
    "..y&&&&&^^xx",
    "...&&&&&^^.x",
    "..xxxxxxxx..",
    "..yyyy.xxx..",
    ".yyyy..xxxx.",
    ".yyy....xxx.",
    "yyyy....xxxx",
    "yyyy....xxxx",
    ".........xxx",
  ]),
  part([
    "..xx&&&&^xx.",
    ".xy&&&&&^^yx",
    ".xy&&&&&^^yx",
    ".xy&&&&&^^y.",
    ".y.&&&&&^^x.",
    "..xxxxxxxx..",
    "..yyyy.xxx..",
    "..yyyy.xxx..",
    "..yyy..xxx..",
    "..yyy..xxx..",
    ".yyyy..xxxx.",
    ".yyyy.......",
  ]),
];

export const BODY = {
  small: { se: SMALL_SE, ne: SMALL_SE },
  big: { se: BIG_SE, ne: BIG_SE },
};

// =========================================================================
// HEADS — rows 0..8, stamped at (0, 0). Row 8 is the chin, over the
// shoulders. SE has the face (eyes on the screen-right half, where a figure
// walking down-right looks); NE is the back of the head.
// =========================================================================

const HEAD = {
  rabbit: {
    se: part([
      "...yy.yy....",
      "...yz.yz....",
      "...yz.yz....",
      "...yy.yy....",
      "..yzyyyyx...",
      "..zzyyyyyx..",
      "..zyy+yy+x..",
      "..yyyyyyxx..",
      "...xyyyxx...",
    ]),
    ne: part([
      "...yy.yy....",
      "...yx.yx....",
      "...yx.yx....",
      "...yy.yy....",
      "..yzyyyyx...",
      "..zyyyyyyx..",
      "..zyyyyyyx..",
      "..yyyyyyxx..",
      "...xyyyxx...",
    ]),
  },
  mouse: {
    se: part([
      "............",
      ".yyy...yyy..",
      "yzzy...yzzy.",
      "yzzy...yzzy.",
      ".yyyyyyyyy..",
      "..zzyyyyyx..",
      "..zyy+yy+x..",
      "..yyyyyyyxx.",
      "...xyyyxx...",
    ]),
    ne: part([
      "............",
      ".yyy...yyy..",
      "yxxy...yxxy.",
      "yxxy...yxxy.",
      ".yyyyyyyyy..",
      "..zyyyyyyx..",
      "..zyyyyyyx..",
      "..yyyyyyxx..",
      "...xyyyxx...",
    ]),
  },
  fox: {
    se: part([
      "..y....y....",
      "..yy..yy....",
      "..yzy.yzy...",
      "..yzyyyyyx..",
      "..zzyyyyyx..",
      "..zyy+yy+x..",
      "..yyyyyyzzx.",
      "...yyyyzzzx.",
      "...xyyxxx...",
    ]),
    ne: part([
      "..y....y....",
      "..yy..yy....",
      "..yxy.yxy...",
      "..yyyyyyyx..",
      "..zyyyyyyx..",
      "..zyyyyyyx..",
      "..yyyyyyxx..",
      "...yyyyxx...",
      "...xyyxx....",
    ]),
  },
  beaver: {
    se: part([
      "............",
      "............",
      "..yy...yy...",
      ".yzyyyyyyx..",
      ".yzzyyyyyyx.",
      ".zzyy+yy+yx.",
      ".yyyyyyyyxx.",
      "..yyyyyy((x.",
      "...xyyyxxx..",
    ]),
    ne: part([
      "............",
      "............",
      "..yy...yy...",
      ".yzyyyyyyx..",
      ".yzyyyyyyyx.",
      ".zyyyyyyyyx.",
      ".yyyyyyyyxx.",
      "..yyyyyyyx..",
      "...xyyyxxx..",
    ]),
  },
  owl: {
    se: part([
      ".yy....yy...",
      "..yy..yy....",
      "..yyyyyyy...",
      ".yzzyyyyyy..",
      ".yz(+y(+yx..",
      ".yz(+y(+yx..",
      ".yyyy-yyyx..",
      "..yyyyyyxx..",
      "...xyyyxx...",
    ]),
    ne: part([
      ".yy....yy...",
      "..yy..yy....",
      "..yyyyyyy...",
      ".yzyyyyyyy..",
      ".yzyyyyyyx..",
      ".yyyyyyyyx..",
      ".yyyyyyyyx..",
      "..yyyyyyxx..",
      "...xyyyxx...",
    ]),
  },
  bear: {
    se: part([
      "............",
      "............",
      ".yyy...yyy..",
      ".yzyyyyyyyx.",
      ".yzzyyyyyyx.",
      ".zzyy+yy+yx.",
      ".yyyyyyyyxx.",
      "..yyyyyzxxx.",
      "...xyyyxxx..",
    ]),
    ne: part([
      "............",
      "............",
      ".yyy...yyy..",
      ".yxyyyyyyyx.",
      ".yzyyyyyyyx.",
      ".zyyyyyyyyx.",
      ".yyyyyyyyxx.",
      "..yyyyyyxxx.",
      "...xyyyxxx..",
    ]),
  },
  tortoise: {
    se: part([
      "............",
      "............",
      "............",
      "....yyy.....",
      "...yzyyx....",
      "...yz+y+x...",
      "...yyyyxx...",
      "....yxx.....",
      "....xx......",
    ]),
    ne: part([
      "............",
      "............",
      "............",
      "....yyy.....",
      "...yzyyx....",
      "...yyyyyx...",
      "...yyyyxx...",
      "....yxx.....",
      "....xx......",
    ]),
  },
  raccoon: {
    se: part([
      "............",
      "..yy...yy...",
      "..yzy.yzy...",
      "..yzyyyyyx..",
      "..zzyyyyyx..",
      "..wwww(ww(w.",
      "..zyyyyyyxx.",
      "..yyyyyyxx..",
      "...xyyyxx...",
    ]),
    ne: part([
      "............",
      "..yy...yy...",
      "..yxy.yxy...",
      "..yyyyyyyx..",
      "..zyyyyyyx..",
      "..zyyyyyyx..",
      "..yyyyyyxx..",
      "..yyyyyyxx..",
      "...xyyyxx...",
    ]),
  },
  // Round 4: the livestock and the predators. Each is ONE mark past the
  // shared body: pig = the ring snout (an 'x' ring round 'z' with '+'
  // nostrils — on the pale +1 coat the ring is the one darker rung) and
  // small triangular ears; cow = short 'w' horns, ears out SIDEWAYS, a
  // broad 'x' muzzle three rows deep, and '+' patches; wolf = the fox's
  // pointed ears on the big head and a muzzle one column longer, tipped
  // with a '+' nose; cat = two-row ears, a 'w' nose, and 1-px 'z' whiskers
  // standing one pixel off each cheek; hawk = a round head with 'w' brows
  // and a hooked '-' beak two columns proud of the face.
  pig: {
    se: part([
      "............",
      "..y.....y...",
      ".yzy...yxy..",
      ".yzyyyyyyxx.",
      ".zzyyyyyyyx.",
      ".zyyy+yy+yx.",
      ".yyyywzzzwx.",
      "..yyyw+z+wx.",
      "...xyywwwx..",
    ]),
    ne: part([
      "............",
      "..y.....y...",
      ".yzy...yxy..",
      ".yzyyyyyyxx.",
      ".zyyyyyyyyx.",
      ".zyyyyyyyyx.",
      ".yyyyyyyyxx.",
      "..yyyyyyyx..",
      "...xyyxxx...",
    ]),
  },
  cow: {
    se: part([
      "............",
      ".w.......w..",
      ".wy.....yw..",
      "..++yyyyyx..",
      "yy++yyyyyyxx",
      "yzzyy+yy+yxx",
      ".zyxxxxxxxx.",
      "..yxx+xx+xx.",
      "...xxxxxxx..",
    ]),
    ne: part([
      "............",
      ".w.......w..",
      ".wy.....yw..",
      "..yyyyyyyx..",
      "yyzyyyyyyyxx",
      "yzyyyy+++yxx",
      ".zyyyy+++xx.",
      "..yyyyyyyx..",
      "...xyyyxxx..",
    ]),
  },
  wolf: {
    se: part([
      "..y......y..",
      ".yzy....yxy.",
      ".yzyy..yyxy.",
      ".yzyyyyyyyx.",
      ".zzyyyyyyyx.",
      ".zyyy+yy+yx.",
      ".yyyyyyyzzzx",
      "..yyyyyzzzz+",
      "...xyyxxxx..",
    ]),
    ne: part([
      "..y......y..",
      ".yzy....yxy.",
      ".yzyy..yyxy.",
      ".yzyyyyyyyx.",
      ".zyyyyyyyyx.",
      ".zyyyyyyyyx.",
      ".yyyyyyyyxx.",
      "..yyyyyyxxx.",
      "...xyyyxxx..",
    ]),
  },
  cat: {
    se: part([
      "............",
      "............",
      "..y.....y...",
      "..yzy..yyx..",
      "..zyyyyyyx..",
      "..zyy+yy+x..",
      "z.yyyyywyx.z",
      "z.yyyyyyxx.z",
      "...xyyyxx...",
    ]),
    ne: part([
      "............",
      "............",
      "..y.....y...",
      "..yzy..yyx..",
      "..zyyyyyyx..",
      "..zyyyyyyx..",
      "..yyyyyyyx..",
      "..yyyyyyxx..",
      "...xyyyxx...",
    ]),
  },
  hawk: {
    se: part([
      "............",
      "............",
      "............",
      "...yyyyy....",
      "..zyywyywx..",
      "..zyy+yy+x..",
      "..yyy--yyx..",
      "..yyyy-yxx..",
      "...xyyyxx...",
    ]),
    ne: part([
      "............",
      "............",
      "............",
      "...yyyyy....",
      "..zyyyyyyx..",
      "..zyyyyyyx..",
      "..yyyyyyyx..",
      "..yyyyyyxx..",
      "...xyyyxx...",
    ]),
  },
};

// =========================================================================
// TAILS and the shell — [rows, x, y, behind]. `behind` = stamped before the
// body (it hangs up-left of a figure walking SE); otherwise after.
// =========================================================================

const TAIL = {
  fox: {
    se: [part([".yy.", "yzyy", "yzyy", "yyyy", ".xyy", "..zz"]), 0, 11, true],
    ne: [part([".yy.", "yzyy", "yzyy", ".yyy", ".xyy", "..zz"]), 5, 12, false],
  },
  // The flat tail is authored in x/y, not w/x: the beaver's furShift −1
  // sends both w and x to 'w', and a w/x scale hatch came out one block.
  // A dark rim 'x' (→ 'w') round a LIGHT fill 'z' (→ 'y', the one rung the
  // beaver's dark body never uses): with an x/y hatch the paddle was 6×4
  // dark on dark and, from the back, the beaver was the bear (round 2).
  beaver: {
    se: [part(["xxxxx", "xzxzx", "xzxzx", "xxxxx"]), 0, 15, true],
    ne: [part([".xxxx.", "xzzzzx", "xzxzzx", ".xxxx."]), 3, 15, false],
  },
  raccoon: {
    se: [part([".yy.", "yyy.", "www.", "yyy.", "www.", ".yy."]), 0, 12, true],
    ne: [part(["yyy", "www", "yyy", "www", "yyy", "www"]), 6, 12, false],
  },
  rabbit: {
    se: [part(["zz", "zz"]), 1, 13, true],
    ne: [part(["zz", "zz"]), 5, 13, false],
  },
  mouse: {
    se: [part(["..x.", ".x..", "x...", "x..."]), 0, 13, true],
    ne: [part(["x", "x", ".x", ".x", "..x"]), 6, 13, false],
  },
  // A curl at the rump: on the +1 coat 'x' is the ring-snout rung, one
  // darker than the body, so the curl reads without a key of its own.
  pig: {
    se: [part([".xx", "x.x", "xx."]), 0, 12, true],
    ne: [part([".xx", "x.x", "xx."]), 5, 13, false],
  },
  // A rope with a dark tuft.
  cow: {
    se: [part([".x", ".x", ".x", "ww", "ww"]), 0, 11, true],
    ne: [part([".x", ".x", ".x", "ww", "ww"]), 5, 13, false],
  },
  // Bushy and held LOW — straight down the back-left to the hocks, dark
  // edged ('x' → 'W' on the −1 coat) so it separates from the leg it hangs
  // beside, where the fox's curls up and ends light.
  wolf: {
    se: [part([".yy.", "xzyy", "xzyy", "xyyy", "xyyy", "wxyy", ".wx."]), 0, 12, true],
    ne: [part([".yy.", "yzyy", "yzyy", "yyyy", "xyyy", "xxyy", ".xw."]), 4, 12, false],
  },
  // A 1-px line from the rump UP the back to shoulder height, curling at
  // the tip — the mouse's goes down.
  cat: {
    se: [part(["xx.", "x..", "x..", "x..", "x..", ".x.", "..x"]), 0, 9, true],
    ne: [part([".xx", ".x.", ".x.", ".x.", ".x.", "x.."]), 9, 9, false],
  },
  // A fan, widening away from the hip, with 'w' feather lines.
  hawk: {
    se: [part(["..yy", ".xyy", "xwyw", "xw.w"]), 0, 13, true],
    ne: [part([".yy.", "yyyy", "wywy", "wywy"]), 4, 13, false],
  },
};

/**
 * The hawk's folded wings: stamped over the arms (rows 9–15, both
 * facings), two columns wider than the arm on each side and pointed at
 * the hip, so the shoulders read as wings by silhouette alone. 'z' along
 * the lit left wing (→ earth 't'), 'w' tips (→ 'q').
 */
const WINGS = part([
  ".zy......yx.",
  "xzy......yyx",
  "xzy......yyx",
  "xzy......yyx",
  "wxy......yxw",
  ".wx......xw.",
  "..w......w..",
]);

/**
 * The cow's patches, as [x, y, w, h] rectangles in frame coordinates,
 * painted in '+' ONLY where the composed grid already has a fur pixel —
 * so the same three rectangles land on the thigh, the shin and the arm
 * in every frame, and a lifted leg leaves no patch floating in the air.
 */
const PATCHES = {
  cow: [
    [2, 14, 2, 2],
    [8, 17, 2, 2],
    [10, 10, 2, 2],
  ],
};

/**
 * The tortoise shell. Earth keys — a brown dome lit from the upper-left
 * ('u' highlight, 't' dome, 's' the shaded right), 'r' scute lines, 'q'
 * rim.
 *
 * NE (the back): the dome replaces the shirt, stamped OVER the body — that
 * one reads. SE (the front) is a different picture: a tortoise seen from
 * the front is a low head in front of a dome that rises BEHIND the
 * shoulders, so the SE shell is 12 wide, stamped BEFORE the body at row 3,
 * and the body and head paint over its lower half — the rim shows past
 * both shoulders and the dome stands up behind the neck. Round 2 stamped
 * the same dome over the front body at row 8 and the figure read as an
 * olive person carrying a brown bundle on its belly. The chest carries a
 * flat, lighter PLASTRON of two rows instead ('u'/'t' over the shirt).
 */
const SHELL_NE = part([
  "..qtttsq..",
  ".qtutttsq.",
  "qtutrttssq",
  "qttrttrssq",
  "qssrsssrsq",
  ".qqqqqqqq.",
]);
const SHELL_SE = part([
  "....qttts...",
  "..qtutttssq.",
  ".qtuutrttssq",
  "qttutrttrssq",
  "qtrtttrtttsq",
  "qsrssssrsssq",
]);
const PLASTRON = part(["uuuuutt", "tuuuutt"]);
const SHELL = {
  se: [SHELL_SE, 0, 3],
  ne: [SHELL_NE, 1, 8],
};

// =========================================================================
// CUBS — 8×12. A shared big-headed body with per-species ear marks.
// =========================================================================

const CUB_BODY_SE = [
  part([".x&&&^x.", ".x&&&^x.", "..xxxx..", "..yy.x..", ".yyy.xx."]),
  part([".x&&&^x.", "..&&&^x.", "..xxxx..", ".yy..xx.", "yy....xx"]),
  part([".x&&&^x.", ".x&&&^..", "..xxxx..", "..yy.x..", ".yyy...."]),
];
const CUB_HEAD = {
  se: part(["..yyyy..", ".yzzyyy.", ".yz+y+y.", ".yyyyyx.", "..yyyx.."]),
  ne: part(["..yyyy..", ".yzyyyy.", ".yzyyyy.", ".yyyyyx.", "..yyyx.."]),
};
/** [rows, x, y] stamped after the head, both facings. */
const CUB_MARK = {
  rabbit: [part(["..yy.yy.", "..yz.yz.", "..yy.yy."]), 0, 0],
  mouse: [part([".yy..yy.", "yzy..yzy"]), 0, 1],
  fox: [part(["..y..y..", "..yy.yy."]), 0, 1],
  bear: [part([".yy..yy.", ".yy..yy."]), 0, 1],
  owl: [part([".y....y.", "..y..y.."]), 0, 1],
  raccoon: [part(["w(ww(w"]), 1, 4],
  // A two-pixel dark tail at the feet — without it the beaver cub was the
  // bear cub minus ears.
  beaver: [part(["xx", "xx"]), 0, 10],
  tortoise: [part([".qttsq", "qtrssq", ".qqqq."]), 1, 7],
  // Round 4. A sparse mark can span rows: stamp() skips '.', so ears at
  // the crown and a snout / muzzle / whiskers at the cheek row travel as
  // one part.
  pig: [part(["..y..y..", "........", "........", "........", "...x++x."]), 0, 1],
  cow: [part([".w....w.", "........", "........", "y......x", "..xxxxx."]), 0, 1],
  wolf: [part([".y....y.", ".yy..yy.", "........", "........", "....zz+."]), 0, 1],
  cat: [part(["..y..y..", "........", "........", "........", "z......z"]), 0, 1],
  hawk: [part(["......--", "......-."]), 0, 5],
};

// =========================================================================
// Extras: the tent, the centenary hat, the meeting glyph.
// =========================================================================

export const TENT = defineSprite({
  name: "tent",
  anchor: [11, 11],
  tags: ["extra"],
  rows: part([
    "..........u...........",
    ".........uuu..........",
    "........uutuu.........",
    ".......uuttsuu........",
    "......uuuttssuu.......",
    ".....uuuutttssuu......",
    "....uuuuu+ttsssuu.....",
    "...uuuuu+++ttssssu....",
    "..uuuuuu+++tttsssru...",
    ".uuuuuuu+++ttttsssru..",
    "uuuuuuuu+++tttttssrru.",
    "qqqqqqqqq+qqqqqqqqqqqq",
  ]),
});

const HAT_ROWS = part([
  "..<<<..",
  ".<>><..",
  ".<>><..",
  ".<-><..",
  "<<<<<<<",
]);
export const HAT = defineSprite({ name: "hat", anchor: [3, 4], rows: HAT_ROWS, tags: ["extra"] });

export const MEETING = defineSprite({
  name: "meeting",
  anchor: [4, 6],
  tags: ["extra"],
  rows: part([
    ".(((((((.",
    "(((((((((",
    "((+(+(+((",
    "(((((((((",
    ".(((((((.",
    "...((....",
    "...(.....",
  ]),
});

// =========================================================================
// Composition.
// =========================================================================

const BUILD = {
  rabbit: "small", mouse: "small", fox: "small", owl: "small", raccoon: "small", cat: "small", hawk: "small",
  beaver: "big", bear: "big", tortoise: "big", pig: "big", cow: "big", wolf: "big",
};
const AUTHOR_KEYS = keysOf("furWarm"); // w x y z — the authoring ramp

/**
 * Skin overrides: where the ART disagrees with the species table's ramp.
 * The tortoise's table row says olive; olive vanished into the lawn (see
 * the header), so the kit paints its limbs warm tan instead. The sim is
 * not consulted for colour anywhere else, so nothing else moves.
 */
const SKIN = { tortoise: { fur: "furWarm", furShift: 0 } };

/**
 * Key map: authoring fur keys → the species' ramp, shifted. Elder = one
 * rung lighter ONLY when the light body rung 'y' has headroom; a coat
 * already at the top (rabbit, mouse: furShift +1) keeps its adult map, so
 * every elder keeps two body values and the light law survives. Age on
 * those coats is carried by the ELDER marks instead.
 */
function furMap(species, elder) {
  const sp = SPECIES_BY_ID[species];
  if (!sp) throw new Error(`citizens: unknown species '${species}'`);
  const skin = SKIN[species] || sp;
  const ramp = keysOf(skin.fur);
  const n = ramp.length - 1;
  const idx = (i) => Math.max(0, Math.min(n, i + skin.furShift));
  const up = elder && idx(2) < n ? 1 : 0;
  const map = {};
  AUTHOR_KEYS.forEach((k, i) => {
    map[k] = ramp[Math.min(n, idx(i) + up)];
  });
  return map;
}

/** Relative luminance of a key, 0..255. */
function lumOf(key) {
  const [r, g, b] = colourOf(key);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * The grey of age: white ('Z') on a coat whose face is dark, grey ('Y')
 * on one whose face is already light. Cool keys, outside the warm
 * authoring ramp, so the species remap leaves them alone.
 */
function elderMarkKey(species) {
  return lumOf(furMap(species, true).y) > 190 ? "Y" : "Z";
}

/**
 * Brows over the eyes and a muzzle below them (SE, the face); a 2×2 nape
 * patch (NE, the back of the head). Placed from the head rows themselves:
 * the eye row is the first head row with an eye '+' (or an eye-white '('
 * — the raccoon's eyes sit in its mask).
 */
function stampElderMarks(g, head, facing, key, lift) {
  const at = (x, y) => {
    if (y + lift < 0 || y + lift >= g.length || x < 0 || x >= g[0].length) return;
    if (g[y + lift][x] !== T) g[y + lift][x] = key;
  };
  if (facing === "se") {
    let eyeRow = head.findIndex((r) => r.includes("+"));
    if (eyeRow < 0) eyeRow = head.findIndex((r) => r.includes("("));
    if (eyeRow < 1) return;
    const eyes = [];
    for (let x = 0; x < head[eyeRow].length; x++) if (head[eyeRow][x] === "+" || head[eyeRow][x] === "(") eyes.push(x);
    for (const x of eyes) {
      at(x - 1, eyeRow - 1);
      at(x, eyeRow - 1);
    }
    const mid = Math.round((eyes[0] + eyes[eyes.length - 1]) / 2);
    at(mid, eyeRow + 1);
    at(mid + 1, eyeRow + 1);
  } else {
    // Nape: the two middle columns of rows 6–7.
    for (const y of [6, 7]) for (const x of [5, 6]) at(x, y);
  }
}

/**
 * SW/NW = the AUTHORED grid mirrored, RE-LIT BY POSITION, before the
 * species remap. Flip the silhouette; then every shaded pixel that lands
 * where the un-flipped grid had a pixel of the same class (fur, shirt,
 * shell) takes THAT pixel's key — the light stays exactly where it was,
 * because a body seen from the other side has the same silhouette and the
 * sun has not moved. Only the asymmetric bits that land on new ground (a
 * tail now hanging on the shaded side, the far ear) go through
 * MIRROR_KEYS: middle rungs swapped, extremes flattened toward the middle.
 *
 * Two things were tried and are wrong. `palette.relight` only pulls the
 * extremes in, and a body authored in the middle rungs x/y kept its
 * highlight on the screen-right. A whole-grid rung swap {x:y, y:x} put the
 * light on the left but re-valued every part by the rung it was AUTHORED
 * in: heads (mostly y) went a rung darker, belts (all x) a rung lighter,
 * and a SW cub was a different animal from its SE self.
 */
export const MIRROR_KEYS = Object.freeze({ x: "y", y: "x", z: "y", w: "x", "&": "^", "^": "&", u: "t", t: "s", s: "t" });
const CLASS_OF = {};
for (const k of "wxyz") CLASS_OF[k] = "fur";
for (const k of "&^") CLASS_OF[k] = "shirt";
for (const k of "qrstu") CLASS_OF[k] = "shell";
function mirrorLit(rows) {
  const flipped = mirror(rows);
  return flipped.map((r, y) =>
    r
      .split("")
      .map((c, x) => {
        const cls = CLASS_OF[c];
        if (!cls) return c;
        const o = rows[y][x];
        if (CLASS_OF[o] === cls) return o;
        return MIRROR_KEYS[c] || c;
      })
      .join("")
  );
}

/** Paint `key` over the w×h rectangle at (x, y) — but only where the grid already holds a FUR pixel. */
function patchFur(g, x, y, w, h, key) {
  for (let py = y; py < y + h; py++)
    for (let px = x; px < x + w; px++) {
      if (py < 0 || py >= g.length || px < 0 || px >= g[0].length) continue;
      if (CLASS_OF[g[py][px]] === "fur") g[py][px] = key;
    }
}

/** A 1-px outline in `key` around every opaque pixel (4-neighbours), inside the grid. */
function outline(rows, key) {
  const h = rows.length, w = rows[0].length;
  const g = rows.map((r) => r.split(""));
  const out = rows.map((r) => r.split(""));
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (g[y][x] !== T) continue;
      const near = (y > 0 && g[y - 1][x] !== T) || (y < h - 1 && g[y + 1][x] !== T) || (x > 0 && g[y][x - 1] !== T) || (x < w - 1 && g[y][x + 1] !== T);
      if (near) out[y][x] = key;
    }
  return toRows(out);
}

function normFacing(facing) {
  if (typeof facing === "number") return FACINGS[((facing % 4) + 4) % 4];
  const f = String(facing).toLowerCase();
  if (!FACINGS.includes(f)) throw new Error(`citizens: unknown facing '${facing}'`);
  return f;
}
function normFrame(frame) {
  if (typeof frame === "string") {
    const i = FRAMES.indexOf(frame);
    if (i < 0) throw new Error(`citizens: unknown frame '${frame}'`);
    return i;
  }
  return ((frame % 3) + 3) % 3;
}
/** 'cub' | 'adult' | 'elder', or an age in YEARS resolved by the species table. */
function normAge(species, age) {
  if (typeof age === "number") {
    const sp = SPECIES_BY_ID[species];
    if (age < 16) return "cub";
    if (age >= sp.retire) return "elder";
    return "adult";
  }
  if (!AGES.includes(age)) throw new Error(`citizens: unknown age '${age}'`);
  return age;
}

function composeAdult(species, facing, frame, elder, hat) {
  const lift = hat ? 4 : 0;
  const H = 20 + lift;
  const g = blank(12, H);
  const body = BODY[BUILD[species]][facing][frame];
  const tail = TAIL[species] && TAIL[species][facing];
  const put = (rows, x, y) => stamp(g, rows, x, y + lift);
  if (tail && tail[3]) put(tail[0], tail[1], tail[2]);
  const shellBehind = species === "tortoise" && facing === "se";
  if (shellBehind) put(SHELL.se[0], SHELL.se[1], SHELL.se[2]);
  put(body, 0, 8);
  if (species === "hawk") put(WINGS, 0, 9);
  if (PATCHES[species]) for (const [x, y, w, h] of PATCHES[species]) patchFur(g, x, y + lift, w, h, "+");
  if (tail && !tail[3]) put(tail[0], tail[1], tail[2]);
  const head = HEAD[species][facing];
  if (shellBehind) {
    put(PLASTRON, 3, 9);
    put(head, 0, 0);
  } else if (species === "tortoise") {
    put(head, 0, 0);
    put(SHELL.ne[0], SHELL.ne[1], SHELL.ne[2]);
  } else {
    put(head, 0, 0);
  }
  if (elder) stampElderMarks(g, head, facing, elderMarkKey(species), lift);
  if (hat) {
    let top = 0;
    while (top < 9 && head[top].split("").every((c) => c === ".")) top++;
    stamp(g, HAT_ROWS, 3, top + lift - 4);
  }
  return toRows(g); // AUTHORED keys — mirrored and remapped by citizenSprite
}

function composeCub(species, facing, frame) {
  const g = blank(8, 12);
  stamp(g, CUB_BODY_SE[frame], 0, 7);
  stamp(g, CUB_HEAD[facing], 0, 2);
  const mark = CUB_MARK[species];
  if (mark) stamp(g, mark[0], mark[1], mark[2]);
  return toRows(g);
}

const CACHE = new Map();

/**
 * The composed, cached citizen sprite. `facing` 'se'|'ne'|'sw'|'nw' (or an
 * index into FACINGS), `frame` 0..2 (or 'stand'|'stepA'|'stepB'), `age`
 * 'adult'|'elder'|'cub' (or years). `opts.hat` adds the centenary hat.
 */
export function citizenSprite(species, facing = "se", frame = 0, age = "adult", opts = {}) {
  if (!(species in HEAD_SPECIES)) throw new Error(`citizens: no kit for species '${species}' — author its HEAD/BUILD/CUB_MARK here and add it to HEAD_SPECIES, then to species.js ARRIVING`);
  const f = normFacing(facing);
  const fr = normFrame(frame);
  const ag = normAge(species, age);
  const hat = !!opts.hat && ag !== "cub";
  const key = `${species}|${f}|${fr}|${ag}|${hat ? "h" : ""}`;
  let s = CACHE.get(key);
  if (s) return s;
  const authored = f === "sw" ? "se" : f === "nw" ? "ne" : f;
  let rows = ag === "cub" ? composeCub(species, authored, fr) : composeAdult(species, authored, fr, ag === "elder", hat);
  // Mirror the AUTHORED grid (so the light stays upper-left), THEN skin it.
  if (f === "sw" || f === "nw") rows = mirrorLit(rows);
  rows = remap(rows, furMap(species, ag === "elder"));
  if (species === "tortoise") rows = outline(rows, "+");
  const h = rows.length;
  const anchor = ag === "cub" ? [4, 11] : [6, h - 1];
  s = defineSprite({ name: `citizen-${key}`, rows, anchor, tags: ["citizen", species, ag] });
  CACHE.set(key, s);
  return s;
}

/** Every citizen sprite, named, for the audit: 13 species × 4 facings × 3 frames × 3 ages (+ one hat). */
export function allCitizens() {
  const out = [];
  for (const species of SPECIES_IDS)
    for (const age of AGES)
      for (const facing of FACINGS)
        for (let frame = 0; frame < 3; frame++) {
          const s = citizenSprite(species, facing, frame, age);
          out.push({ name: s.name, sprite: s });
        }
  const hat = citizenSprite("tortoise", "se", 0, "elder", { hat: true });
  out.push({ name: hat.name, sprite: hat });
  out.push({ name: TENT.name, sprite: TENT }, { name: HAT.name, sprite: HAT }, { name: MEETING.name, sprite: MEETING });
  return out;
}
