export const ZOOM_LEVELS = Object.freeze([1, 2, 3, 4]);

// Calculate from the current camera, not the last rendered view. Several
// wheel events may arrive before the next frame.
export function zoomCamera(camera, dir, width, height, sx = width / 2, sy = height / 2) {
  const index = ZOOM_LEVELS.indexOf(camera.zoom);
  const zoom = ZOOM_LEVELS[Math.max(0, Math.min(ZOOM_LEVELS.length - 1, index + Math.sign(dir)))];
  if (zoom === camera.zoom) return false;
  camera.x += (sx - width / 2) * (1 / camera.zoom - 1 / zoom);
  camera.y += (sy - height / 2) * (1 / camera.zoom - 1 / zoom);
  camera.zoom = zoom;
  return true;
}
