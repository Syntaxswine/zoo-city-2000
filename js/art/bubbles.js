// bubbles.js — a palette-key speech box stretched from four corners and four
// edges, with a three-pixel tail. The letters remain Canvas text (SPEC §12).

import { blank, defineSprite, toRows } from "./format.js";

const CACHE = new Map();

/** A bubble whose BODY is at least w×h; anchor is the tail's final pixel. */
export function bubbleSprite(w, h, tailX = null, tailSide = "bottom") {
  const W = Math.max(9, Math.ceil(w));
  const H = Math.max(7, Math.ceil(h));
  const side = tailSide === "top" ? "top" : "bottom";
  const tip = Math.max(0, Math.min(W - 1, Math.round(tailX == null ? W / 2 : tailX)));
  const key = `${W}x${H}@${side}-${tip}`;
  let sprite = CACHE.get(key);
  if (sprite) return sprite;
  const g = blank(W, H + 3);
  const bodyY = side === "top" ? 3 : 0;
  // Ink '+' and pale concrete '(' are both existing palette keys. The one
  // transparent corner pixel keeps a stretched box from looking mechanical.
  for (let x = 1; x < W - 1; x++) { g[bodyY][x] = "+"; g[bodyY + H - 1][x] = "+"; }
  for (let y = 1; y < H - 1; y++) {
    g[bodyY + y][0] = "+";
    g[bodyY + y][W - 1] = "+";
    for (let x = 1; x < W - 1; x++) g[bodyY + y][x] = "(";
  }
  // Slope the join toward the body centre, including a usable tip at x=0 or
  // x=W-1. That lets the renderer keep the tip exactly on an edge walker.
  const base = tip < W / 2 ? Math.min(W - 1, tip + 1) : Math.max(0, tip - 1);
  if (side === "top") {
    g[3][base] = "(";
    g[2][base] = "+";
    g[2][tip] = "(";
    g[1][tip] = "+";
    g[0][tip] = "+";
  } else {
    g[H - 1][base] = "(";
    g[H][base] = "+";
    g[H][tip] = "(";
    g[H + 1][tip] = "+";
    g[H + 2][tip] = "+";
  }
  const anchor = side === "top" ? [tip, 0] : [tip, H + 2];
  sprite = defineSprite({ name: `bubble-${key}`, rows: toRows(g), anchor, tags: ["bubble", "screen-space", `tail-${side}`] });
  CACHE.set(key, sprite);
  return sprite;
}

export const BUBBLE_SAMPLES = Object.freeze([
  bubbleSprite(54, 15),
  bubbleSprite(120, 15),
  bubbleSprite(180, 15),
]);
