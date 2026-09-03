// savesize.mjs — Part B's year-30 save budget, by top-level section.
//
//   node tools/savesize.mjs [--seed 7]

import { createWorld } from "../js/sim/world.js";
import { tick } from "../js/sim/tick.js";
import { toPlain } from "../js/sim/save.js";
import { createMayor } from "./mayor.mjs";
import { legacyStats } from "../js/sim/legacy.js";

const argv = process.argv.slice(2);
const arg = (key, fallback) => { const i = argv.indexOf(key); return i >= 0 ? argv[i + 1] : fallback; };
const bytes = (value) => Buffer.byteLength(JSON.stringify(value));
const BASELINE_CITIZEN_BYTES = 732_000;
const LIMIT = BASELINE_CITIZEN_BYTES * 0.60;

const world = createWorld({ seed: arg("--seed", "7") });
const mayor = createMayor(world, {
  layout: "balanced", rates: [8, 8, 8], schedule: [], parks: 0, markets: 0,
  pacify: false, stations: false, disasters: false, recessionYear: null, zooYear: null,
});
for (let t = 0; t < 30 * 12; t++) { mayor.month(t); tick(world); }

const plain = toPlain(world);
const sections = Object.entries(plain)
  .map(([name, value]) => [name, bytes(value)])
  .sort((a, b) => b[1] - a[1]);
console.log(`year 30 · ${world.citizens.length} citizens · ${bytes(plain)} bytes total`);
for (const [name, size] of sections) console.log(`${name.padEnd(18)} ${String(size).padStart(8)} bytes`);
const citizenBytes = bytes(plain.citizens);
console.log(`citizens: ${citizenBytes} / ${LIMIT} bytes (${(citizenBytes / BASELINE_CITIZEN_BYTES * 100).toFixed(1)}% of the 732 KB baseline)`);
const archive = legacyStats(world);
const archiveJson = bytes(plain.legacy || []);
console.log(`legacy: ${archive.records} permanent records · ${archive.bytes} shorthand bytes · ${archive.mean.toFixed(2)} mean · ${archiveJson} JSON bytes`);
if (citizenBytes > LIMIT) {
  console.error("FAIL: citizen section exceeds Part B's 60% budget");
  process.exitCode = 1;
}
if (archive.mean > 45) {
  console.error("FAIL: permanent citizen shorthand exceeds the 45-byte mean budget");
  process.exitCode = 1;
}
