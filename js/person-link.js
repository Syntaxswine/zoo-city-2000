// person-link.js — one action for every named citizen link (Part F).
// Pin the durable id first, then centre on the exact target C resolved: a
// live walker, home/holding place, or the permanent record's last address.

import { toScreen, HALF_H } from "./iso/iso.js";

export function pinAndCentre(app, id) {
  if (!app?.input?.pinCitizen(id)) return false;
  const info = app.input.hoverInfo();
  const target = info?.target;
  // A newspaper points the reader to the citizen's address, not to a
  // transient walker frame (or a holding cell). Gone citizens use the
  // archive's last home. Only records without an address fall back to the
  // target C could resolve.
  const home = target?.citizen?.home ?? target?.record?.home;
  const tx = Number.isInteger(home) && home >= 0 ? home % app.world.w : target?.tx;
  const ty = Number.isInteger(home) && home >= 0 ? (home / app.world.w) | 0 : target?.ty;
  if (Number.isFinite(tx) && Number.isFinite(ty)) {
    const [sx, sy] = toScreen(tx, ty);
    app.camera.x = sx;
    app.camera.y = sy + HALF_H;
  }
  app.ui?.updateHover(info);
  return true;
}
