import { pinTarget } from '../js/follow.js';

export function parseFollow(argv) {
  const index = argv.indexOf('--follow');
  const mode = index < 0 ? 'city' : argv[index + 1];
  if (mode === 'citizen') {
    const raw = argv[index + 2];
    if (!raw || !/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) throw Error('--follow citizen requires a non-negative citizen id');
    return { mode, id: Number(raw) };
  }
  if (mode !== 'city' && mode !== 'start' && !/^\d+,\d+$/.test(mode || '')) throw Error('--follow expects city, start, x,y, or citizen <id>');
  return { mode };
}

export function citizenFrame(world, walkers, follow) {
  if (follow.mode !== 'citizen') return null;
  const target = pinTarget(world, walkers, follow.id);
  return { id: follow.id, state: target?.state || 'unavailable',
    tx: target?.tx ?? null, ty: target?.ty ?? null,
    label: target?.citizen ? `${target.citizen.name} ${target.citizen.surname}` : target?.record?.name || `Citizen ${follow.id}`,
    line: target?.line || 'not present in this city yet' };
}
