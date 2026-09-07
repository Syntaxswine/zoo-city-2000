// DOM-free perspective and collision geometry. World axes: x, height, tile-y.
export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const add = (a, b, s = 1) => a.map((v, i) => v + b[i] * s);
export function cameraAt(target, yaw, pitch, distance, aspect) {
  const forward = [-Math.sin(yaw) * Math.cos(pitch), -Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)];
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const up = [-Math.sin(yaw) * Math.sin(pitch), Math.cos(pitch), -Math.cos(yaw) * Math.sin(pitch)];
  return { eye: add(target, forward, -distance), forward, right, up, aspect, f: 1.8 };
}
export function project(p, c, width, height) {
  const d = add(p, c.eye, -1), z = dot(d, c.forward);
  if (z <= 0.08) return null;
  return [(dot(d, c.right) * c.f / c.aspect / z + 1) * width / 2,
    (1 - dot(d, c.up) * c.f / z) * height / 2, z];
}
export function screenRay(x, y, c, width, height) {
  return add(add(c.forward, c.right, (2 * x / width - 1) * c.aspect / c.f), c.up, (1 - 2 * y / height) / c.f);
}
export function hitBox(origin, dir, box) {
  let near = 0, far = Infinity;
  for (let a = 0; a < 3; a++) {
    if (Math.abs(dir[a]) < 1e-9) { if (origin[a] < box[a] || origin[a] > box[a + 3]) return Infinity; continue; }
    let u = (box[a] - origin[a]) / dir[a], v = (box[a + 3] - origin[a]) / dir[a];
    if (u > v) [u, v] = [v, u];
    near = Math.max(near, u); far = Math.min(far, v);
    if (near > far) return Infinity;
  }
  return near;
}
export function canStand(world, x, z, radius = 0.16) {
  for (let tz = Math.floor(z - radius); tz <= Math.floor(z + radius); tz++) {
    for (let tx = Math.floor(x - radius); tx <= Math.floor(x + radius); tx++) {
      if (tx < 0 || tz < 0 || tx >= world.w || tz >= world.h) return false;
      const i = tz * world.w + tx;
      if (world.road[i] || world.rail[i]) continue;
      if (world.terrain[i] === 1 || world.terrain[i] === 2 || world.tier[i] || world.big[i] || world.wall[i] || world.civic[i] > 3) return false;
    }
  }
  return true;
}
export function moveAnimal(world, p, dx, dz) {
  // Substeps prevent tunnelling even after a delayed frame; slide along walls.
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.08));
  for (let n = 0; n < steps; n++) {
    if (canStand(world, p.x + dx / steps, p.z)) p.x += dx / steps;
    if (canStand(world, p.x, p.z + dz / steps)) p.z += dz / steps;
  }
}
