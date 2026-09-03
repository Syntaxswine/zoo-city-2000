// citizens.js — the KIT. Fourteen species, hand-authored, the organic
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
export const FRAMES = Object.freeze(["stand", "stepA", "stepB", "idle"]);
export const AGES = Object.freeze(["adult", "elder", "cub"]);
/**
 * The species the KIT covers — those with a head overlay below — not every
 * row of the sim's species table. The table can grow ahead of the art; the
 * sim spawns every roster row (`ARRIVING` is everyone), so a species without sprites here throws in the browser; check.mjs asserts kit-vs-roster parity. Sprites
 * exist, and `citizenSprite` throws for one, by name, rather than drawing
 * a headless body. All fourteen rows of the table are drawn today.
 */
const HEAD_SPECIES = { rabbit: 1, mouse: 1, fox: 1, beaver: 1, owl: 1, bear: 1, tortoise: 1, raccoon: 1, pig: 1, cow: 1, wolf: 1, cat: 1, hawk: 1, skunk: 1 };
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
      ".zzy...yyy..",
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
      ".zzy...yyy..",
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
      "..zz...yy...",
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
      "..zz...yy...",
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
      "...zzyyy....",
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
      "...zzyyy....",
      "..zyyyyyyx..",
      "..zyyyyyyx..",
      "..yyyyyyyx..",
      "..yyyyyyxx..",
      "...xyyyxx...",
    ]),
  },
  // Round 5: the skunk — the STRIPE. Authored straight in the cool keys
  // the remap leaves alone, 'Z' white and 'W' near-black, because on its
  // −1 coat the warm 'z' lands on grey 'Y' and an elder's 'z' on 'Z'
  // itself, which would put the stripe's white on every highlight; so no
  // 'z' in any skunk part. SE: a white crown line, a 1-px blaze under it,
  // a pointed muzzle tipped with a '+' nose. The head sits a column right
  // of centre and its crown line right of THAT, so three grey pixels
  // separate it from the tail's white — the first cut had the tail's tip
  // curling over the crown and the two whites fused into a hood at 1×.
  // The far (screen-left) ear is a column inboard of the near one: a head
  // seen three-quarters on, and the plume's lane. NE: the 2-px stripe down
  // the back of the head into the tail's centre.
  skunk: {
    se: part([
      "............",
      "............",
      ".....y...y..",
      "...yyyZZZyx.",
      "...yyyyZyyx.",
      "...yyy+yy+x.",
      "...yyyyyyyx.",
      "....yyyyyy+.",
      "....xyyxx...",
    ]),
    ne: part([
      "............",
      "............",
      "....y....y..",
      "...yyyZZyyx.",
      "...yyyZZyyx.",
      "...yyyZZyyx.",
      "...yyyZZyyx.",
      "...yyyZZyxx.",
      "....xyZZxx..",
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
  // Held HIGH: the plume rises past the head on both facings — the tail
  // is taller than the head. SE (behind): a 'W'-edged, 'Z'-lined plume
  // straight up the screen-left of the figure, 5 wide where it clears the
  // head and fanned at the tip, its root curling to the hip; the head and
  // the arm hide all but a 2–3 px strip below the crown. It does NOT curl
  // over the head: that fused with the crown line at 1×. NE (in front):
  // the plume stands over the back, 8 wide across the shoulders, and its
  // tip shows above the head, whose own stripe carries the line across
  // the rows the head covers.
  skunk: {
    se: [part([".WZW...", "WZZyW..", "WZZyW..", "WZZyW..", "WZyW...", "WZyW...", "WZyW...", "WZyW...", "WZyW...", "WZW....", "WZW....", "WZW....", "WZW....", ".WW....", "..W...."]), 0, 0, true],
    ne: [part([".WyZZyW.", ".WyZZyW.", ".WyZZyW.", "..WZZW..", "..WZZW..", "..WZZW..", "..WZZW..", "..WZZW..", "..WZZW..", "WyyZZyyW", "WyyZZyyW", "WyyZZyyW", "WyyZZyyW", ".WyZZyW."]), 2, 0, false],
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
  // The skunk cub: no ears (the raccoon precedent) — a white crown line on
  // the near half of the crown, two columns clear of the tail's tip, and
  // the tail held up the screen-left, 'Z' down its length to a 'W' root
  // that meets the belt.
  skunk: [part(["WZ......", "WZ......", "WZ..ZZ..", "Z.......", "Z.......", "Z.......", "Z.......", "Z.......", "Z.......", "WW......"]), 0, 0],
};

// =========================================================================
// LOOK MARKS — one small, authored motif per adult species.
//
// A piece row uses `.` for "leave the composed sprite alone" and `_` for an
// intentional hole. Every other character is a palette key. Coordinates are
// in the 12×20 authored SE/NE frame, before a west-facing sprite is mirrored;
// carrying and hats merely translate the same piece with the figure. Keeping
// a literal box beside every piece lets the audit prove that a look cannot
// leak into some unrelated part of the animal.
// =========================================================================

function lookPiece(name, x, y, rows, { inkOnly = false } = {}) {
  const h = rows.length, w = rows[0].length;
  if (w > 6 || h > 6 || rows.some((r) => r.length !== w)) throw new Error(`citizens: bad look piece '${name}'`);
  return Object.freeze({ name, box: Object.freeze([x, y, w, h]), rows: Object.freeze(rows.slice()), inkOnly });
}

export const LOOK_MARKS = Object.freeze({
  fox: Object.freeze({
    name: "white tail-tip",
    se: lookPiece("fox tail-tip se", 1, 15, [".ZZ.", ".ZZ."]),
    ne: lookPiece("fox tail-tip ne", 6, 16, [".ZZ.", ".ZZ."]),
  }),
  rabbit: Object.freeze({
    name: "lop ear",
    se: lookPiece("rabbit lop se", 6, 0, ["__..", "_y..", ".yy.", "..yx", "..xx"]),
    ne: lookPiece("rabbit lop ne", 6, 0, ["__..", "_y..", ".yy.", "..yx", "..xx"]),
  }),
  mouse: Object.freeze({
    name: "notched ear",
    se: lookPiece("mouse notch se", 7, 1, ["....", "..__", ".__."]),
    ne: lookPiece("mouse notch ne", 7, 1, ["....", "..__", ".__."]),
  }),
  beaver: Object.freeze({
    name: "pale chest",
    se: lookPiece("beaver chest se", 4, 9, ["zz..", "zzz.", "zzz.", ".zz."]),
    ne: lookPiece("beaver chest ne", 4, 9, ["zz..", "zzz.", "zzz.", ".zz."]),
  }),
  owl: Object.freeze({
    name: "brow tufts",
    se: lookPiece("owl tufts se", 2, 0, ["+....+", ".+..+.", "+....+"]),
    ne: lookPiece("owl tufts ne", 2, 0, ["+....+", ".+..+.", "+....+"]),
  }),
  bear: Object.freeze({
    name: "muzzle patch",
    se: lookPiece("bear muzzle se", 5, 5, [".+.", ".Y.", "Y.Z", ".Y."]),
    ne: lookPiece("bear nape ne", 5, 5, [".+.", ".Y.", "Y.Z", ".Y."]),
  }),
  tortoise: Object.freeze({
    name: "shell scute",
    se: lookPiece("tortoise scute se", 0, 5, [".u.", "ur.", "uru"], { inkOnly: true }),
    ne: lookPiece("tortoise scute ne", 3, 9, [".r..", "rur.", ".rr.", "..r."], { inkOnly: true }),
  }),
  raccoon: Object.freeze({
    name: "lighter mask",
    se: lookPiece("raccoon mask se", 3, 5, ["ZZZZZZ", ".Z..Z."]),
    ne: lookPiece("raccoon mask ne", 3, 5, ["ZZZZZZ", ".Z..Z."]),
  }),
  pig: Object.freeze({
    name: "cheek spot",
    se: lookPiece("pig spot se", 2, 4, [".+", "++"]),
    ne: lookPiece("pig spot ne", 2, 4, [".+", "++"]),
  }),
  cow: Object.freeze({
    name: "Holstein patch",
    se: lookPiece("cow patch se", 5, 3, ["++..", "+++.", ".++."]),
    ne: lookPiece("cow patch ne", 5, 3, ["++..", "+++.", ".++."]),
  }),
  wolf: Object.freeze({
    name: "grey saddle",
    se: lookPiece("wolf saddle se", 2, 9, ["XXXX..", "XXXXX.", "XXXXX.", ".XXX.."]),
    ne: lookPiece("wolf saddle ne", 2, 9, ["XXXX..", "XXXXX.", "XXXXX.", ".XXX.."]),
  }),
  cat: Object.freeze({
    name: "tabby stripe",
    se: lookPiece("cat stripe se", 4, 3, [".w.", "www", ".w.", ".w."]),
    ne: lookPiece("cat stripe ne", 4, 3, [".w.", "www", ".w.", ".w."]),
  }),
  hawk: Object.freeze({
    name: "chest bars",
    se: lookPiece("hawk bars se", 4, 10, ["w..w", ".ww.", "....", ".ww."]),
    ne: lookPiece("hawk bars ne", 4, 10, ["w..w", ".ww.", "....", ".ww."]),
  }),
  skunk: Object.freeze({
    name: "double stripe",
    se: lookPiece("skunk stripe se", 5, 3, ["Z.Z.", "Z.Z.", "Z.Z.", "Z.Z.", "Z.Z."]),
    ne: lookPiece("skunk stripe ne", 4, 3, ["Z.ZZ.", "Z.ZZ.", "Z.ZZ.", "Z.ZZ.", "Z.ZZ.", "Z.ZZ."]),
  }),
});

// =========================================================================
// Extras: the tent, the centenary hat, the meeting glyph, the sack.
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

// THE SACK (SPEC §14, predation). Burlap in the EARTH ramp — lit upper-left
// like everything else: 'u' the highlight, 't' the cloth, 's' the shade,
// 'r' the dark right edge, 'q' the cord and the open mouth. Three ground
// sprites the size of an adult (12×20, anchor at the feet), so a sack drawn
// where an animal stood hides all of it:
//   0  OPEN   — falling: the closed round end up, the mouth a dark row below
//   1  TIED   — on the ground, gathered at the neck under a cord
//   2  TIED, wriggling — the neck a pixel over, the right side a pixel out
// and one PART for the shoulder: a lump that rides above and behind the
// head, gathered to a cord and a hand at the shoulder (composeAdult, carry).
const SACK_OPEN = defineSprite({
  name: "sack-open",
  anchor: [6, 19],
  tags: ["extra", "sack"],
  rows: part([
    "....uuuu....",
    "..uuuuttt...",
    ".uuuuutttss.",
    ".uuuuttttss.",
    "uuuuutttssss",
    "uuuutttttsss",
    "uuuuttttssss",
    "uuutttttsssr",
    "uuuttttsssrr",
    "uuuttttssrrr",
    "uutttttssrrr",
    "uutttssssrrr",
    "uuttttsssrrr",
    "uutttttssrrr",
    "uuttttsssrrr",
    "uuttttssrrrr",
    "uutttsssrrrr",
    "uuttttssrrrr",
    "urrrrrrrrrrq",
    "qqqqqqqqqqqq",
  ]),
});
const SACK_TIED_ROWS = part([
  ".....tt.....",
  "....utts....",
  "....qqqq....",
  "...uutts....",
  "..uuuttss...",
  ".uuuutttss..",
  ".uuuuttttss.",
  "uuuuutttssss",
  "uuuutttttsss",
  "uuuuttttssss",
  "uuutttttsssr",
  "uuuttttsssrr",
  "uuuttttssrrr",
  "uutttttssrrr",
  "uutttssssrrr",
  "uuttttsssrrr",
  ".uttttssrrr.",
  ".uttssssrrr.",
  "..tssssrrr..",
  "...qqqqqq...",
]);
const SACK_TIED = defineSprite({ name: "sack-tied", anchor: [6, 19], tags: ["extra", "sack"], rows: SACK_TIED_ROWS });
/** The wriggle: the neck and the shoulders (rows 0–6) lean a pixel to the right. */
const SACK_WRIGGLE = defineSprite({
  name: "sack-wriggle",
  anchor: [6, 19],
  tags: ["extra", "sack"],
  rows: SACK_TIED_ROWS.map((r, y) => (y <= 6 ? "." + r.slice(0, 11) : r)),
});
export const SACKS = Object.freeze([SACK_OPEN, SACK_TIED, SACK_WRIGGLE]);
const SACK_SHOULDER = part([
  "..uuuuu..",
  ".uuuuutt.",
  "uuuuuttts",
  "uuuutttss",
  "uuutttsss",
  ".uutttssr",
  ".uuttssr.",
  "..uttss..",
  "...tts...",
  "...qq....",
  "....y....",
]);
const CARRY_OX = 3; // the carrying grid is 18 wide; the figure sits 3 px in — SYMMETRIC, so the mirrored facings land the figure on itself — the sack over its screen-left shoulder
const CARRY_LIFT = 3; // the sack's top rides 3 px above the frame's top row — its bulk BESIDE the head, not over it; the cord and the hand end on row 7, the row above the shoulder (body row 8)

// =========================================================================
// Composition.
// =========================================================================

const BUILD = {
  rabbit: "small", mouse: "small", fox: "small", owl: "small", raccoon: "small", cat: "small", hawk: "small", skunk: "small",
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
function furMap(species, elder, shade = 0) {
  const sp = SPECIES_BY_ID[species];
  if (!sp) throw new Error(`citizens: unknown species '${species}'`);
  const skin = SKIN[species] || sp;
  const ramp = keysOf(skin.fur);
  const n = ramp.length - 1;
  const idx = (i) => Math.max(0, Math.min(n, i + skin.furShift));
  const up = elder && idx(2) < n ? 1 : 0;
  const map = {};
  AUTHOR_KEYS.forEach((k, i) => {
    map[k] = ramp[Math.max(0, Math.min(n, idx(i) + up - shade))];
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
  return lumOf(furMap(species, true, 0).y) > 190 ? "Y" : "Z";
}

/**
 * Brows over the eyes and a muzzle below them (SE, the face); a 2×2 nape
 * patch (NE, the back of the head). Placed from the head rows themselves:
 * the eye row is the first head row with an eye '+' (or an eye-white '('
 * — the raccoon's eyes sit in its mask).
 */
function stampElderMarks(g, head, facing, key, lift, ox = 0) {
  const at = (x0, y) => {
    const x = x0 + ox;
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

const FACE_EYES = Object.freeze({
  rabbit: [5, 8, 6], mouse: [5, 8, 6], fox: [5, 8, 5], beaver: [5, 8, 5],
  owl: [4, 7, 4], bear: [5, 8, 5], tortoise: [5, 7, 5], raccoon: [6, 9, 5],
  pig: [5, 8, 5], cow: [5, 8, 5], wolf: [5, 8, 5], cat: [5, 8, 5],
  hawk: [5, 8, 5], skunk: [6, 9, 5],
});

/** Half of elders wear one tiny pair; the side view keeps its temple arm. */
function stampGlasses(g, species, facing, lift, ox = 0, mirrored = false) {
  const put = (x, y, key) => {
    x = mirrored ? g[0].length - 1 - (x + ox) : x + ox;
    y += lift;
    if (y >= 0 && y < g.length && x >= 0 && x < g[0].length && g[y][x] !== T) g[y][x] = key;
  };
  const [a, b, y] = FACE_EYES[species];
  if (facing === "se") {
    put(a - 1, y, "="); put(a + 1, y, "=");
    put(b - 1, y, "="); put(b + 1, y, "=");
    put(Math.floor((a + b) / 2), y, "+");
  } else {
    for (let x = a - 1; x <= b + 1; x++) put(x, y, x === a - 1 || x === b + 1 ? "+" : "=");
  }
}

function stampLookMark(g, species, facing, lift, ox = 0, mirrored = false) {
  const mark = LOOK_MARKS[species];
  const p = mark && mark[facing];
  if (!p) return;
  const [x0, y0, pw] = p.box;
  for (let y = 0; y < p.rows.length; y++) for (let x = 0; x < p.rows[y].length; x++) {
    let key = p.rows[y][mirrored ? pw - 1 - x : x];
    if (key === ".") continue;
    if (mirrored && key !== "_") key = MIRROR_KEYS[key] || key;
    const gx = (mirrored ? g[0].length - (x0 + ox + pw) : x0 + ox) + x, gy = y0 + y + lift;
    if (gx < 0 || gx >= g[0].length || gy < 0 || gy >= g.length) continue;
    if (key === "_") g[gy][gx] = T;
    else if (!p.inkOnly || g[gy][gx] !== T) g[gy][gx] = key;
  }
}

/**
 * The fourth frame is deliberately a small, species-specific pause rather
 * than a fourth walk cycle. The feet never move: only the silhouette above
 * them changes, so entering idle cannot make a walker hop on its tile.
 */
function stampIdlePose(g, species, facing, lift, ox = 0) {
  const put = (x, y, key) => {
    x += ox; y += lift;
    if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = key;
  };
  const clear = (x, y) => put(x, y, T);
  switch (species) {
    case "rabbit": // sits up on broad haunches
      put(1, 18, "y"); put(10, 18, "x"); put(1, 19, "y"); put(10, 19, "x"); clear(5, 19); clear(6, 19);
      break;
    case "mouse": // leans forward to sniff
      put(10, 7, "y"); put(11, 7, "x"); put(10, 8, "x");
      break;
    case "fox": // curls the tail-tip upward
      put(0, 15, "y"); put(0, 16, "z"); put(1, 17, "z");
      break;
    case "beaver": // checks the famous teeth
      put(6, 7, "("); put(7, 7, "("); put(6, 8, "x");
      break;
    case "owl": // turns its head while its body stays put
      stamp(g, HEAD.owl[facing === "se" ? "ne" : "se"], ox, lift);
      break;
    case "bear": // scratches beside one ear
      put(10, 5, "y"); put(10, 6, "y"); put(9, 7, "x"); put(9, 8, "x");
      break;
    case "tortoise": // withdraws into the shell
      for (let y = 3; y <= 7; y++) for (let x = 3; x <= 8; x++) clear(x, y);
      put(5, 7, "w"); put(6, 7, "+"); put(5, 8, "x"); put(6, 8, "x");
      break;
    case "raccoon": // paws together, rummaging
      put(4, 11, "w"); put(5, 12, "w"); put(6, 12, "w"); put(7, 11, "w");
      break;
    case "pig": // drops the ring snout to root
      put(7, 8, "x"); put(8, 8, "+"); put(9, 8, "+"); put(8, 9, "x");
      break;
    case "cow": // chews sideways
      put(9, 7, "("); put(10, 7, "x"); put(9, 8, "x");
      break;
    case "wolf": // raises a paw to one ear
      put(10, 6, "X"); put(10, 7, "X"); put(9, 8, "W");
      break;
    case "cat": // washes its cheek
      put(8, 4, "y"); put(9, 5, "y"); put(8, 6, "x"); put(7, 7, "x");
      break;
    case "hawk": // folds a wing across its breast to preen
      put(4, 10, "w"); put(5, 11, "w"); put(6, 12, "w"); put(7, 13, "w");
      break;
    case "skunk": // twitches the white plume clear of the crown
      put(1, 1, "Z"); put(2, 2, "Z"); put(2, 3, "W");
      break;
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
  return ((frame % 4) + 4) % 4;
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

function normLook(opts = {}) {
  const value = opts.look || opts;
  const shade = value.shade == null ? 0 : value.shade;
  const mark = value.mark == null ? 0 : value.mark;
  if ((shade !== 0 && shade !== 1) || (mark !== 0 && mark !== 1)) throw new Error("citizens: look shade and mark must be 0 or 1");
  return { shade, mark };
}

function composeAdult(species, facing, frame, elder, hat, carry = false) {
  const lift = (hat ? 4 : 0) + (carry ? CARRY_LIFT : 0);
  const ox = carry ? CARRY_OX : 0;
  const H = 20 + lift;
  const g = blank(12 + 2 * ox, H);
  const idle = frame === 3;
  const body = BODY[BUILD[species]][facing][idle ? 0 : frame];
  const tail = TAIL[species] && TAIL[species][facing];
  const put = (rows, x, y) => stamp(g, rows, x + ox, y + lift);
  // The sack over the shoulder: BEHIND the figure when we see its face (SE),
  // over its back when we see its back (NE). It hangs from the SHOULDER — a
  // fixed row (the body starts at row 8) — never from the head's top, so the
  // body rows of a carrying sprite are the plain sprite's, 3 px in (check.mjs).
  const sackAt = () => stamp(g, SACK_SHOULDER, 0, lift - CARRY_LIFT);
  if (carry && facing === "se") sackAt();
  if (tail && tail[3]) put(tail[0], tail[1], tail[2]);
  const shellBehind = species === "tortoise" && facing === "se";
  if (shellBehind) put(SHELL.se[0], SHELL.se[1], SHELL.se[2]);
  put(body, 0, 8);
  if (species === "hawk") put(WINGS, 0, 9);
  if (PATCHES[species]) for (const [x, y, w, h] of PATCHES[species]) patchFur(g, x + ox, y + lift, w, h, "+");
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
  if (idle) stampIdlePose(g, species, facing, lift, ox);
  if (elder) stampElderMarks(g, head, facing, elderMarkKey(species), lift, ox);
  if (hat) {
    let top = 0;
    while (top < 9 && head[top].split("").every((c) => c === ".")) top++;
    stamp(g, HAT_ROWS, 3 + ox, top + lift - 4);
  }
  if (carry && facing === "ne") sackAt();
  return toRows(g); // AUTHORED keys — mirrored and remapped by citizenSprite
}

function composeCub(species, facing, frame) {
  const g = blank(8, 12);
  const idle = frame === 3;
  stamp(g, CUB_BODY_SE[idle ? 0 : frame], 0, 7);
  stamp(g, CUB_HEAD[facing], 0, 2);
  const mark = CUB_MARK[species];
  if (mark) stamp(g, mark[0], mark[1], mark[2]);
  if (idle) { g[8][1] = "y"; g[9][6] = "x"; }
  return toRows(g);
}

/**
 * Cubs have no adult motif; their second bit is an eight-pixel coat-value
 * treatment. Apply it AFTER mirrorLit so a notch or ear does not make the
 * west-facing pass frame collapse back onto one of the two shade-only rows.
 * Reverse scan order on west starts the treatment from the corresponding
 * outer coat edges after that facing's positional re-lighting.
 */
function cubCoatTreatment(rows, mirrored) {
  const g = rows.map((r) => r.split(""));
  const fur = [];
  for (let y = 0; y < g.length; y++) {
    if (mirrored) {
      for (let x = g[y].length - 1; x >= 0; x--) if (CLASS_OF[g[y][x]] === "fur") fur.push([x, y]);
    } else {
      for (let x = 0; x < g[y].length; x++) if (CLASS_OF[g[y][x]] === "fur") fur.push([x, y]);
    }
  }
  const used = new Set();
  for (const [x, y] of fur) {
    if (g[y][x] === "w") continue;
    g[y][x] = "w"; used.add(`${x},${y}`);
    if (used.size === 4) break;
  }
  let light = 0;
  for (let i = fur.length - 1; i >= 0 && light < 4; i--) {
    const [x, y] = fur[i], k = `${x},${y}`;
    if (used.has(k) || g[y][x] === "z") continue;
    g[y][x] = "z"; light++;
  }
  return toRows(g);
}

const CACHE = new Map();
const PORTRAIT_CACHE = new Map();

/**
 * The composed, cached citizen sprite. `facing` 'se'|'ne'|'sw'|'nw' (or an
 * index into FACINGS), `frame` 0..2 (or 'stand'|'stepA'|'stepB'), `age`
 * 'adult'|'elder'|'cub' (or years). `opts.hat` adds the centenary hat;
 * `opts.carry === "sack"` puts a sack over the shoulder (adults and elders
 * only — the killing is an adult's; the grid widens to 16 and the anchor
 * follows the feet, so the figure stays on its tile).
 */
export function citizenSprite(species, facing = "se", frame = 0, age = "adult", opts = {}) {
  if (!(species in HEAD_SPECIES)) throw new Error(`citizens: no kit for species '${species}' — author its HEAD/BUILD/CUB_MARK here and add it to HEAD_SPECIES (check.mjs asserts every species.js row has kit art)`);
  const f = normFacing(facing);
  const fr = normFrame(frame);
  const ag = normAge(species, age);
  const look = normLook(opts);
  const hat = !!opts.hat && ag !== "cub";
  const carry = opts.carry === "sack" && ag !== "cub";
  // Shade is itself a stable hash bit, so tying glasses to it gives exactly
  // half of elder looks glasses without making a mark toggle change pixels
  // outside that species' declared mark box.
  const glasses = ag === "elder" && look.shade === 1;
  const key = `${species}|${f}|${fr}|${ag}|s${look.shade}m${look.mark}g${glasses ? 1 : 0}|${hat ? "h" : ""}${carry ? "c" : ""}`;
  let s = CACHE.get(key);
  if (s) return s;
  const authored = f === "sw" ? "se" : f === "nw" ? "ne" : f;
  let rows = ag === "cub" ? composeCub(species, authored, fr) : composeAdult(species, authored, fr, ag === "elder", hat, carry);
  // Mirror the AUTHORED grid (so the light stays upper-left), THEN skin it.
  if (f === "sw" || f === "nw") rows = mirrorLit(rows);
  if (ag === "cub" && look.mark) rows = cubCoatTreatment(rows, f === "sw" || f === "nw");
  if (ag !== "cub" && look.mark) {
    const g = rows.map((r) => r.split(""));
    const lift = (hat ? 4 : 0) + (carry ? CARRY_LIFT : 0);
    stampLookMark(g, species, authored, lift, carry ? CARRY_OX : 0, f === "sw" || f === "nw");
    rows = toRows(g);
  }
  if (glasses) {
    const g = rows.map((r) => r.split(""));
    const lift = (hat ? 4 : 0) + (carry ? CARRY_LIFT : 0);
    stampGlasses(g, species, authored, lift, carry ? CARRY_OX : 0, f === "sw" || f === "nw");
    rows = toRows(g);
  }
  rows = remap(rows, furMap(species, ag === "elder", look.shade));
  if (species === "tortoise") rows = outline(rows, "+");
  const h = rows.length;
  const anchor = ag === "cub" ? [4, 11] : [6 + (carry ? CARRY_OX : 0), h - 1];
  s = defineSprite({ name: `citizen-${key}`, rows, anchor, tags: ["citizen", species, ag] });
  CACHE.set(key, s);
  return s;
}

const EXPRESSIONS = Object.freeze(["glad", "flat", "low"]);

/** A framed 16×16 SE head carrying the citizen's age and stable look. */
export function portraitSprite(species, opts = {}) {
  if (!(species in HEAD_SPECIES)) throw new Error(`portrait: unknown species '${species}'`);
  const ag = normAge(species, opts.age == null ? "adult" : opts.age);
  const look = normLook(opts);
  const expression = opts.expression == null ? "flat" : String(opts.expression).toLowerCase();
  if (!EXPRESSIONS.includes(expression)) throw new Error(`portrait: unknown expression '${opts.expression}'`);
  const glasses = ag === "elder" && look.shade === 1;
  const key = `${species}|${ag}|s${look.shade}m${look.mark}g${glasses ? 1 : 0}|${expression}`;
  let sprite = PORTRAIT_CACHE.get(key);
  if (sprite) return sprite;

  // Compose a head-only bust. Cropping the street sprite made the tortoise's
  // shell and the skunk's raised tail dominate a 16px card; here the SAME
  // authored head, coat map, age marks and look piece are deliberately fitted
  // to a common eye line instead.
  const head = ag === "cub" ? CUB_HEAD.se : HEAD[species].se;
  const hg = blank(ag === "cub" ? 8 : 12, ag === "cub" ? 10 : 9);
  if (ag === "cub") {
    stamp(hg, head, 0, 2);
    const cub = CUB_MARK[species];
    if (cub) stamp(hg, cub[0], cub[1], cub[2]);
    if (look.mark) {
      const fur = [];
      for (let y = 0; y < hg.length; y++) for (let x = 0; x < hg[y].length; x++) if (hg[y][x] === "y") fur.push([x, y]);
      const n = Math.min(4, Math.floor(fur.length / 2));
      for (let i = 0; i < n; i++) hg[fur[i][1]][fur[i][0]] = "w";
      for (let i = 0; i < n; i++) { const at = fur[fur.length - 1 - i]; hg[at[1]][at[0]] = "z"; }
    }
  } else {
    stamp(hg, head, 0, 0);
    if (ag === "elder") stampElderMarks(hg, head, "se", elderMarkKey(species), 0, 0);
    if (look.mark) stampLookMark(hg, species, "se", 0, 0, false);
    if (glasses) stampGlasses(hg, species, "se", 0, 0, false);
  }
  let headRows = remap(toRows(hg), furMap(species, ag === "elder", look.shade));
  if (species === "tortoise") headRows = outline(headRows, "+");
  const coat = furMap(species, ag === "elder", look.shade);
  // Remove the street-sized eye/teeth punctuation; the enlarged expression
  // below owns one uncluttered face zone. Species silhouettes and fixed coat
  // markings remain untouched.
  headRows = headRows.map((r) => r.replace(/[+(=]/g, coat.y));
  let bx0 = headRows[0].length, by0 = headRows.length, bx1 = -1, by1 = -1;
  for (let y = 0; y < headRows.length; y++) for (let x = 0; x < headRows[y].length; x++) if (headRows[y][x] !== T) {
    bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y);
  }
  const bw = bx1 - bx0 + 1, bh = by1 - by0 + 1;
  const fit = Math.min(12 / bw, 10 / bh);
  const dw = Math.max(1, Math.round(bw * fit)), dh = Math.max(1, Math.round(bh * fit));
  const g = blank(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) g[y][x] = x === 0 || x === 15 || y === 0 || y === 15 ? "<" : "&";
  // Shoulders turn the head into a portrait rather than a floating crop.
  for (let x = 5; x <= 10; x++) g[12][x] = coat.y;
  for (let x = 4; x <= 11; x++) g[13][x] = x < 8 ? coat.y : coat.x;
  for (let x = 3; x <= 12; x++) g[14][x] = x < 8 ? coat.y : coat.x;
  const dx0 = 2 + Math.floor((12 - dw) / 2), dy0 = 2;
  for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
    const key = headRows[by0 + Math.min(bh - 1, Math.floor(y * bh / dh))][bx0 + Math.min(bw - 1, Math.floor(x * bw / dw))];
    if (key !== T) g[dy0 + y][dx0 + x] = key;
  }

  // Translate body/tail marks into the visible bust when their street piece
  // falls below the head crop. Head marks above were fitted with the head.
  if (look.mark) switch (species) {
    case "fox": g[11][4] = g[11][5] = g[12][5] = "Z"; break; // white tail-tip as a white ruff
    case "beaver": for (let x = 5; x <= 10; x++) g[12][x] = coat.z; break;
    case "owl": g[5][4] = g[5][11] = "+"; break;
    case "tortoise": g[12][5] = g[12][8] = "r"; g[13][6] = g[13][9] = "r"; break;
    case "pig": g[6][4] = g[7][4] = "+"; break;
    case "cow": g[5][4] = g[5][5] = g[6][4] = "+"; break;
    case "wolf": for (let x = 4; x <= 10; x++) g[13][x] = x & 1 ? "X" : "Y"; break;
    case "hawk": for (const y of [12, 14]) for (let x = 5; x <= 10; x++) g[y][x] = "w"; break;
  }
  if (ag === "cub" && look.mark) {
    g[13][4] = g[13][5] = coat.w;
    g[13][10] = g[13][11] = coat.z;
  }

  // One reserved, high-contrast face zone. Four pixels form a clear U, bar,
  // or cap; low adds brows. This survives dark coats at native 16×16.
  const face = coat.z, ink = lumOf(face) > 145 ? "+" : "Z";
  for (let x = 6; x <= 9; x++) { g[8][x] = face; g[9][x] = face; g[10][x] = face; }
  g[7][6] = ink; g[7][9] = ink;
  if (expression === "glad") { g[9][5] = ink; g[10][6] = ink; g[10][9] = ink; g[9][10] = ink; }
  else if (expression === "flat") { for (let x = 6; x <= 9; x++) g[10][x] = ink; }
  else {
    g[7][5] = ink; g[7][10] = ink; g[9][6] = ink; g[9][9] = ink; g[10][5] = ink; g[10][10] = ink;
  }

  // Portrait-scale signatures that need more room than the street face.
  if (species === "beaver") { g[11][7] = "("; g[11][8] = "("; }
  if (species === "tortoise") { for (let x = 4; x <= 11; x++) g[13][x] = x % 3 === 0 ? "r" : "t"; }
  if (species === "hawk") { g[7][10] = "w"; g[8][10] = "-"; g[8][11] = "-"; g[9][11] = "-"; g[10][10] = "-"; }
  if (species === "skunk") { g[2][7] = g[3][7] = g[4][8] = g[5][8] = "Z"; }
  if (glasses) {
    g[7][5] = g[7][7] = g[7][8] = g[7][10] = "=";
    g[7][6] = g[7][9] = ink;
  }

  sprite = defineSprite({ name: `portrait-${key}`, rows: toRows(g), anchor: [8, 15], tags: ["portrait", species, ag, expression] });
  PORTRAIT_CACHE.set(key, sprite);
  return sprite;
}

/** Every look, facing, walk frame, idle and portrait, named for the audit. */
export function allCitizens() {
  const out = [];
  for (const species of SPECIES_IDS)
    for (const age of AGES)
      for (let shade = 0; shade < 2; shade++)
        for (let mark = 0; mark < 2; mark++) {
          const look = { shade, mark };
          for (const facing of FACINGS)
            for (let frame = 0; frame < 3; frame++) {
              const s = citizenSprite(species, facing, frame, age, { look });
              out.push({ name: s.name, sprite: s });
            }
          // Idle is a fourth pose but not a fourth walk frame.
          for (const facing of FACINGS) {
            const idle = citizenSprite(species, facing, 3, age, { look });
            out.push({ name: idle.name, sprite: idle });
          }
          for (const expression of EXPRESSIONS) {
            const p = portraitSprite(species, { age, ...look, expression });
            out.push({ name: p.name, sprite: p });
          }
        }
  const hat = citizenSprite("tortoise", "se", 0, "elder", { hat: true });
  out.push({ name: hat.name, sprite: hat });
  // The carry, both builds, every facing and frame — the audit walks every stamped part.
  for (const species of ["wolf", "fox"])
    for (const facing of FACINGS)
      for (let frame = 0; frame < 3; frame++) {
        const c = citizenSprite(species, facing, frame, "adult", { carry: "sack" });
        out.push({ name: c.name, sprite: c });
      }
  const hc = citizenSprite("tortoise", "se", 0, "elder", { hat: true, carry: "sack" });
  out.push({ name: hc.name, sprite: hc });
  out.push({ name: TENT.name, sprite: TENT }, { name: HAT.name, sprite: HAT }, { name: MEETING.name, sprite: MEETING });
  for (const sk of SACKS) out.push({ name: sk.name, sprite: sk });
  return out;
}
