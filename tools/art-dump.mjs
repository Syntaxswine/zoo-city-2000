#!/usr/bin/env node
// tools/art-dump.mjs — THE ART RECEIPT. SPEC §12.5.
//
//   node tools/art-dump.mjs            compare the tree against the baseline; exit 1 on drift
//   node tools/art-dump.mjs --write    re-baseline (do this in the SAME commit as the art change)
//   node tools/art-dump.mjs --list     print the drifting names and stop
//
// One line per sprite in `allSprites()`:
//
//   <name>\t<w>x<h>\t<ax>,<ay>\t<ink>\t<hash8>
//
// sorted by name, with a final TOTAL line. The hash is sha256 of the rows
// joined by newlines, truncated to eight hex — enough to name what moved
// without carrying 3,651 sprites' pixels in the tree.
//
// WHY THIS EXISTS. The art audit in check.mjs proves INVARIANTS (a palette
// key everywhere, an anchor inside the sprite, a twin at twice the size with
// the ink within 12%, no box outside the footprint prism). None of that
// notices a sprite QUIETLY CHANGING. When a change is meant to be additive —
// a new ramp whose keys no old sprite uses, a new shadow sprite beside the
// solids — "nothing that existed moved" is the whole claim, and a claim
// wants a number. This turns it into one: 0 drifted, or a list of names.
//
// IT REFUSES. Drift is exit 1, so this is a GATE and not a report. A
// deliberate art change therefore carries its re-baselined receipt in the
// same commit, which is how the diff comes to say which families moved.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { allSprites } from "../js/art/index.js";
import { ink } from "../js/art/format.js";
import { KEYS, colourOf } from "../js/art/palette.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASELINE = resolve(ROOT, "docs", "fixtures", "art-baseline.txt");

const h8 = (s) => createHash("sha256").update(s).digest("hex").slice(0, 8);

/**
 * name → line, for every sprite in the registry, plus one PALETTE line.
 * Duplicate names keep the first (the registry de-duplicates by name).
 *
 * THE PALETTE LINE IS NOT DECORATION. A sprite's rows are palette KEYS, so
 * re-hexing a ramp changes every pixel on screen and not one row in this
 * file. Hashing key→hex alongside the rows is what makes "additive, no
 * existing key's hex moves" (the T2.1 claim) checkable at all.
 */
export function dumpLines() {
  const seen = new Map();
  for (const { name, sprite } of allSprites()) {
    if (seen.has(name)) continue;
    const [ax, ay] = sprite.anchor;
    seen.set(name, `${name}\t${sprite.w}x${sprite.h}\t${ax},${ay}\t${ink(sprite.rows)}\t${h8(sprite.rows.join("\n"))}`);
  }
  const lines = [...seen.values()].sort();
  const palette = [...KEYS].sort().map((k) => `${k}=${colourOf(k).join(",")}`).join(" ");
  lines.unshift(`PALETTE\t${KEYS.length} keys\t${h8(palette)}`);
  lines.push(`TOTAL\t${lines.length - 1}\t${h8(lines.join("\n"))}`);
  return lines;
}

const args = process.argv.slice(2);
const lines = dumpLines();
const text = lines.join("\n") + "\n";

if (args.includes("--write")) {
  const had = existsSync(BASELINE) ? readFileSync(BASELINE, "utf8").split(/\r?\n/).filter(Boolean).length - 2 : 0;
  writeFileSync(BASELINE, text);
  console.log(`art-dump: wrote ${lines.length - 2} sprites to docs/fixtures/art-baseline.txt (was ${had})`);
  console.log(`art-dump: ${lines[lines.length - 1]}`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error("art-dump: no baseline — run `node tools/art-dump.mjs --write` once, and commit it");
  process.exit(1);
}

const old = new Map();
for (const line of readFileSync(BASELINE, "utf8").split(/\r?\n/)) {
  if (!line) continue;
  old.set(line.slice(0, line.indexOf("\t")), line);
}
const now = new Map();
for (const line of lines) now.set(line.slice(0, line.indexOf("\t")), line);

const moved = [], added = [], gone = [];
for (const [name, line] of now) {
  if (name === "TOTAL") continue;
  if (!old.has(name)) added.push(name);
  else if (old.get(name) !== line) moved.push(name);
}
for (const name of old.keys()) if (name !== "TOTAL" && !now.has(name)) gone.push(name);

const drift = moved.length + added.length + gone.length;
const say = (label, list) => {
  if (!list.length) return;
  console.log(`  ${label} ${list.length}: ${list.slice(0, 12).join(", ")}${list.length > 12 ? ` … and ${list.length - 12} more` : ""}`);
};

if (args.includes("--list")) {
  say("MOVED", moved); say("ADDED", added); say("GONE", gone);
  process.exit(drift ? 1 : 0);
}

if (!drift) {
  console.log(`art-dump: ${now.size - 2} sprites and the palette, none moved — ${now.get("TOTAL")}`);
  process.exit(0);
}
console.error(`art-dump: ${drift} sprite(s) drifted from docs/fixtures/art-baseline.txt`);
say("MOVED", moved); say("ADDED", added); say("GONE", gone);
console.error("art-dump: if the change was intended, re-baseline with --write IN THE SAME COMMIT");
process.exit(1);
