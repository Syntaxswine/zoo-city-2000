// Shared read-only input for the closing integration instruments.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { load } from '../js/sim/save.js';

export function probeSave(argv, conflicts = []) {
  const at = argv.indexOf('--save');
  if (at < 0) return null;
  const file = argv[at + 1];
  if (!file || file.startsWith('--')) throw Error('--save needs an exported city JSON file');
  if (argv.lastIndexOf('--save') !== at) throw Error('--save may be supplied only once');
  if (conflicts.some(flag => argv.includes(flag))) throw Error('--save cannot be combined with seed/layout generation options');
  const path = resolve(file), json = readFileSync(path, 'utf8');
  return { path, world: load(json) };
}

export function wholeYears(value, min = 1) {
  const years = Number(value);
  if (!Number.isInteger(years) || years < min || years > 200) throw Error('years must be an integer from ' + min + ' to 200');
  return years;
}
