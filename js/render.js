// render.js — THE ONLY MODULE THAT TOUCHES A CANVAS. SPEC §13.
//
//   createRenderer(canvas, world, art) →
//     { draw(camera, hover, walkers, overlays), invalidate(), pick(sx, sy), pickWalker(sx, sy, list), resize(), setWorld(world), viewportTiles() }
//
// Two layers, one draw order:
//
//   STATIC  the ground (grass, chalk, roads, bridges, kerbs, rubble, flood)
//           painted back-to-front through painter.js into an offscreen canvas
//           covering the viewport plus a margin; redrawn on invalidate() or
//           when the camera leaves the margin. Water tiles are left
//           TRANSPARENT here and painted every frame beneath it, so the
//           palette cycle (4 frames/s) never forces a ground rebuild.
//   DYNAMIC everything that stands or moves, every frame, through the SAME
//           paintScene: buildings, trees, civics, walkers, fire, tents,
//           glyphs, zots, cursor, ghosts. Rebuilding the visible window's
//           standing things each frame is the simplest CORRECT way to get a
//           walker under the tower in front of it (SPEC §13); ~1,000 blits
//           a frame is nothing, and there is no second sort anywhere.
//
// Camera = { x, y, zoom }: the projection-space point under the canvas
// centre and an integer zoom (1 or 2). Sprites are rasterised once from
// their text rows (format.rasterize) and cached per (sprite, tint).
//
// THE HI-RES SET (SPEC §12.6). At zoom 2 every sprite that has a 2× twin
// (art.hires: every box solid and every ground diamond — not the animals,
// trees or glyphs, which are hand-drawn) is drawn from its 2× rows at one
// device pixel per sprite pixel, under a transform of zoom/2, with its
// anchor on the same projection point placeAt put the 1× anchor on; a
// sprite without a twin is drawn as before, scaled by the zoom. The static
// ground layer is built at 2× too, so the roads and the grass sharpen with
// the buildings. S below is that factor: 1 at zoom 1, 2 at zoom 2.

import { toScreen, toWorld, pickTile, HALF_H, HALF_W, TILE_W, TILE_H } from "./iso/iso.js";
import { paintScene, Z_BUILDING } from "./iso/painter.js";
import { rasterize } from "./art/format.js";
import { ZONE, CIVIC, TERRAIN, ROAD, isPart, anchorOf, sideOf } from "./sim/world.js";
import { DECK_TOP } from "./art/roads.js";
import { lotScore, REASON } from "./sim/lots.js";
import { tunnelAxis } from "./sim/reach.js";
import { isWorker } from "./sim/census.js";
import { BAG_FALL } from "./walkers.js";

const MARGIN = 256; // projection px around the viewport kept in the static layer
const REACH_UP = 120; // tallest sprite above its tile's north vertex
const REACH_SIDE = 40;
const BUSY = 40;
const BG = "#d6d1bf"; // beyond the map: the plate's ground, as in the sibling field guides
const RED_TINT = { "=": "0", "(": "0" };
// R chalk (terrain.js chalkKey) is drawn in grass keys because the R accent
// '5' sits two luminance points off the grass mid: a 1-px 'p' (≈156) / 1-px
// 'm' (≈68) staircase. At ×1 a 4-tile R strip still vanished into grass-0 in
// the round-3 screenshot. Grass variant 0 never uses 'm', so remapping just
// that key in the R chalk sprite darkens ONLY the line's shade half and the
// border's inner edge — 'q' (earth dark, ≈46) is a drawn-in-soil line, not
// ink. The bedrock fix is a paler '5' in palette.js; this is the renderer's
// tint table doing what it is for until then.
const R_CHALK_TINT = { m: "q" };

export function createRenderer(canvas, initialWorld, art) {
  let world = initialWorld;
  const ctx = canvas.getContext("2d", { alpha: false });
  const ground = document.createElement("canvas");
  const gctx = ground.getContext("2d");
  let G = null; // { left, top, w, h } of the static layer in projection space
  let dirty = true;
  let water = []; // [[sx, sy] ...] north vertices of water tiles inside G
  let zots = new Map(); // tile → zot kind, computed on rebuild
  let plazaTile = -1;
  let clock = 0;
  let view = { left: 0, top: 0, w: 1, h: 1, zoom: 1 };
  const waterTints = [0, 1, 2, 3, 4, 5].map((f) => art.waterTint(f)); // reused objects: one cache entry each

  // ---- sprite cache -----------------------------------------------------------
  const cache = new Map(); // sprite → Map(tintKey → canvas)
  const tintKeys = new Map(); // tint object → its key string (tints are reused objects or tiny)
  function raster(sprite, tint = null) {
    let slot = cache.get(sprite);
    if (!slot) { slot = new Map(); cache.set(sprite, slot); }
    let key = "";
    if (tint) {
      key = tintKeys.get(tint);
      if (key == null) { key = Object.entries(tint).map(([k, v]) => k + v).join(""); tintKeys.set(tint, key); }
    }
    let c = slot.get(key);
    if (c) return c;
    const img = rasterize(sprite.rows, tint);
    c = document.createElement("canvas");
    c.width = img.w;
    c.height = img.h;
    c.getContext("2d").putImageData(new ImageData(img.data, img.w, img.h), 0, 0);
    slot.set(key, c);
    return c;
  }

  // ---- the hi-res set --------------------------------------------------------------
  const hiOf = new Map(); // sprite → its 2× twin or null (art.hires renders lazily and caches; this saves the call)
  function hi(sprite) {
    if (!art.hires) return null;
    let h = hiOf.get(sprite);
    if (h === undefined) { h = art.hires(sprite); hiOf.set(sprite, h); }
    return h;
  }
  const hiScaleFor = (zoom) => (zoom >= 2 ? 2 : 1);
  /**
   * Blit `sprite` on context `c` whose device transform is projection × base.z
   * + (base.tx, base.ty), with its rows' top-left at projection (sx, sy) — what
   * placeAt returns. With S = 2 and a twin, the twin's rows go down instead at
   * base.z / 2, positioned so ITS anchor sits on the same projection point.
   */
  function blitScaled(c, base, S, sprite, sx, sy, tint) {
    const h = S === 2 ? hi(sprite) : null;
    if (!h) {
      c.setTransform(base.z, 0, 0, base.z, base.tx, base.ty);
      c.drawImage(raster(sprite, tint), sx, sy);
      return;
    }
    c.setTransform(base.z / 2, 0, 0, base.z / 2, base.tx, base.ty);
    c.drawImage(raster(h, tint), 2 * (sx + sprite.anchor[0]) - h.anchor[0], 2 * (sy + sprite.anchor[1]) - h.anchor[1]);
  }

  // ---- geometry -------------------------------------------------------------------
  function resize() {
    const w = Math.max(1, canvas.clientWidth | 0);
    const h = Math.max(1, canvas.clientHeight | 0);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    dirty = true;
  }

  function computeView(camera) {
    const z = camera.zoom || 1;
    const w = canvas.width / z;
    const h = canvas.height / z;
    view = { left: camera.x - w / 2, top: camera.y - h / 2, w, h, zoom: z };
    return view;
  }

  /** Integer tile ranges whose north vertex could put pixels inside a projection rect. */
  function tileRange(rect) {
    const l = rect.left - REACH_SIDE;
    const r = rect.left + rect.w + REACH_SIDE;
    const t = rect.top - REACH_UP;
    const b = rect.top + rect.h + REACH_UP;
    const cs = [toWorld(l, t), toWorld(r, t), toWorld(l, b), toWorld(r, b)];
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [x, y] of cs) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return {
      x0: Math.max(0, Math.floor(x0) - 2), x1: Math.min(world.w - 1, Math.ceil(x1) + 2),
      y0: Math.max(0, Math.floor(y0) - 2), y1: Math.min(world.h - 1, Math.ceil(y1) + 2),
      inside: (sx, sy) => sx >= l - TILE_W && sx <= r + TILE_W && sy >= t - TILE_H && sy <= b + TILE_H,
    };
  }

  function viewportTiles() {
    const r = tileRange(view);
    return { x0: r.x0, y0: r.y0, x1: r.x1, y1: r.y1 };
  }

  const road = (tx, ty) => tx >= 0 && ty >= 0 && tx < world.w && ty < world.h && world.road[ty * world.w + tx] !== ROAD.NONE;
  const waterAt = (tx, ty) => tx >= 0 && ty >= 0 && tx < world.w && ty < world.h && world.terrain[ty * world.w + tx] === TERRAIN.WATER;
  const roadMask = (tx, ty) => (road(tx, ty - 1) ? 1 : 0) | (road(tx + 1, ty) ? 2 : 0) | (road(tx, ty + 1) ? 4 : 0) | (road(tx - 1, ty) ? 8 : 0);
  const wallAt = (tx, ty) => tx >= 0 && ty >= 0 && tx < world.w && ty < world.h && world.wall[ty * world.w + tx] === 1;
  const wallMask = (tx, ty) => (wallAt(tx, ty - 1) ? 1 : 0) | (wallAt(tx + 1, ty) ? 2 : 0) | (wallAt(tx, ty + 1) ? 4 : 0) | (wallAt(tx - 1, ty) ? 8 : 0);
  const railAt = (tx, ty) => tx >= 0 && ty >= 0 && tx < world.w && ty < world.h && world.rail[ty * world.w + tx] > 0;
  const railMask = (tx, ty) => (railAt(tx, ty - 1) ? 1 : 0) | (railAt(tx + 1, ty) ? 2 : 0) | (railAt(tx, ty + 1) ? 4 : 0) | (railAt(tx - 1, ty) ? 8 : 0);
  const railAxis = (tx, ty) => (railAt(tx, ty - 1) || railAt(tx, ty + 1) ? "ns" : "ew");
  /** The oblong standing on (tx, ty), as { tx, ty, side } of its origin, or null: a block (anchor + parts) or the zoo's 2×2. */
  function footprintAt(tx, ty) {
    const i = ty * world.w + tx;
    if (world.big[i]) { const a = anchorOf(world, i); return { tx: a % world.w, ty: (a / world.w) | 0, side: sideOf(world, a) }; }
    const c = world.civic[i];
    if (c === CIVIC.ZOO) return { tx, ty, side: 2 };
    if (c === CIVIC.ZOO_PART) {
      for (let dy = -1; dy <= 0; dy++) for (let dx = -1; dx <= 0; dx++) {
        const ax = tx + dx, ay = ty + dy;
        if (ax >= 0 && ay >= 0 && world.civic[ay * world.w + ax] === CIVIC.ZOO) return { tx: ax, ty: ay, side: 2 };
      }
    }
    return null;
  }

  // ---- the static ground layer ---------------------------------------------------------
  function rebuildGround() {
    const left = Math.floor(view.left - MARGIN);
    const top = Math.floor(view.top - MARGIN);
    const w = Math.ceil(view.w + 2 * MARGIN);
    const h = Math.ceil(view.h + 2 * MARGIN);
    const S = hiScaleFor(view.zoom); // the layer is built at the hi-res scale, S device px per projection px
    if (ground.width !== w * S || ground.height !== h * S) { ground.width = w * S; ground.height = h * S; }
    G = { left, top, w, h, S };
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    gctx.clearRect(0, 0, w * S, h * S);
    gctx.imageSmoothingEnabled = false;
    const base = { z: S, tx: -left * S, ty: -top * S };
    water = [];
    const range = tileRange(G);
    const items = [];
    const flood = art.overlay("flood");
    for (let ty = range.y0; ty <= range.y1; ty++) {
      for (let tx = range.x0; tx <= range.x1; tx++) {
        const [sx, sy] = toScreen(tx, ty);
        if (!range.inside(sx, sy)) continue;
        const i = ty * world.w + tx;
        const isWater = world.terrain[i] === TERRAIN.WATER;
        const hasRoad = world.road[i] !== ROAD.NONE;
        if (isWater) {
          water.push([sx, sy]);
          if (hasRoad) items.push({ sprite: art.bridge(roadMask(tx, ty)), tx, ty, kind: "ground", z: 1 });
        } else {
          let sprite;
          let tint = null;
          if (hasRoad) sprite = art.road(roadMask(tx, ty), world.traffic[i] > BUSY);
          else if (world.rail[i]) sprite = art.rail(railMask(tx, ty));
          else if (world.rubble[i] && world.tier[i] === 0) sprite = art.ground("rubble");
          else if (world.zone[i] !== ZONE.NONE && world.tier[i] === 0) {
            sprite = art.chalk(world.zone[i], world.maxTier[i] === 3);
            if (world.zone[i] === ZONE.R) tint = R_CHALK_TINT;
          } else sprite = art.ground("grass", world.variant[i] % 3);
          items.push({ sprite, tx, ty, kind: "ground", tint });
          if (waterAt(tx, ty - 1)) items.push({ sprite: art.ground("kerb", 0), tx, ty, kind: "ground", z: 1 });
          if (waterAt(tx + 1, ty)) items.push({ sprite: art.ground("kerb", 1), tx, ty, kind: "ground", z: 1 });
          if (waterAt(tx, ty + 1)) items.push({ sprite: art.ground("kerb", 2), tx, ty, kind: "ground", z: 1 });
          if (waterAt(tx - 1, ty)) items.push({ sprite: art.ground("kerb", 3), tx, ty, kind: "ground", z: 1 });
        }
        if (world.flooded[i]) items.push({ sprite: flood, tx, ty, kind: "ground", z: 2 });
      }
    }
    paintScene(items, (sprite, sx, sy, item) => blitScaled(gctx, base, S, sprite, sx, sy, item.tint || null));
    gctx.setTransform(1, 0, 0, 1, 0, 0);
    computeZots(range);
    computePlaza();
    dirty = false;
  }

  /** Zots: lots that want to grow and cannot — no road, smog, no demand — and homes with a jobless worker. */
  function computeZots(range) {
    zots = new Map();
    for (let ty = range.y0; ty <= range.y1; ty++) {
      for (let tx = range.x0; tx <= range.x1; tx++) {
        const i = ty * world.w + tx;
        if (world.zone[i] === ZONE.NONE) continue;
        const s = lotScore(world, i);
        if (s.reason === REASON.NO_ROAD) zots.set(i, "noroad");
        else if (s.reason === REASON.SMOG) zots.set(i, "smog");
        else if (s.reason === REASON.NO_DEMAND) zots.set(i, "nodemand");
      }
    }
    if (world.tick > 0) {
      for (const c of world.citizens) {
        if (c.home < 0 || c.job >= 0 || c.dead) continue;
        if (c.jobless >= 3 && isWorker(world, c) && !zots.has(c.home)) zots.set(c.home, "nojob");
      }
    }
  }

  function computePlaza() {
    plazaTile = -1;
    if (!world.festivalBonus) return;
    const c = world.centroid || { cx: world.start.tx, cy: world.start.ty };
    let bd = Infinity;
    for (let i = 0; i < world.w * world.h; i++) {
      if (world.civic[i] !== CIVIC.PARK) continue;
      const d = Math.max(Math.abs((i % world.w) - c.cx), Math.abs(((i / world.w) | 0) - c.cy));
      if (d < bd) { bd = d; plazaTile = i; }
    }
  }

  const needsRebuild = () =>
    dirty || !G || G.S !== hiScaleFor(view.zoom) ||
    view.left < G.left + 8 || view.top < G.top + 8 ||
    view.left + view.w > G.left + G.w - 8 || view.top + view.h > G.top + G.h - 8;

  // ---- overlays (key O) -----------------------------------------------------------------
  function diamond(sx, sy) {
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + HALF_W, sy + HALF_H);
    ctx.lineTo(sx, sy + TILE_H);
    ctx.lineTo(sx - HALF_W, sy + HALF_H);
    ctx.closePath();
  }
  function drawOverlay(mode, range) {
    for (let ty = range.y0; ty <= range.y1; ty++) {
      for (let tx = range.x0; tx <= range.x1; tx++) {
        const i = ty * world.w + tx;
        if (world.terrain[i] === TERRAIN.WATER) continue;
        let fill = null;
        if (mode === "lv") fill = `rgba(96,132,84,${(world.lv[i] / 100) * 0.65})`;
        else if (mode === "pol") fill = world.pol[i] > 2 ? `rgba(128,72,40,${(world.pol[i] / 100) * 0.75})` : null;
        else if (mode === "crime") fill = world.crime[i] > 5 ? `rgba(150,50,70,${(world.crime[i] / 100) * 0.75})` : world.policeCov[i] ? "rgba(60,110,138,0.18)" : null;
        else if (mode === "dread") fill = world.dread[i] > 2 ? `rgba(110,40,70,${(world.dread[i] / 100) * 0.7})` : null;
        else if (mode === "use") fill = world.use[i] && (world.zone[i] !== ZONE.NONE || world.road[i] !== ROAD.NONE) ? (world.use[i] === 1 ? "rgba(160,70,40,0.55)" : "rgba(40,120,130,0.55)") : null; // the player's line: rust predator-only, teal prey-only
        else if (mode === "score" && world.zone[i] !== ZONE.NONE) {
          const s = lotScore(world, i).score;
          fill = s >= 0 ? `rgba(80,110,150,${Math.min(1, s * 2) * 0.6 + 0.08})` : `rgba(170,70,60,${Math.min(1, -s * 2) * 0.6 + 0.08})`;
        }
        if (!fill) continue;
        const [sx, sy] = toScreen(tx, ty);
        ctx.fillStyle = fill;
        diamond(sx, sy);
        ctx.fill();
      }
    }
    // An open file is a ring, not a brighter red — signal by shape, so it reads on a hot tenement row too.
    if (mode === "crime" && world.events && world.events.files) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,240,220,0.9)";
      for (const f of world.events.files) {
        if (f.until <= world.tick) continue;
        const tx = f.tile % world.w;
        const ty = (f.tile / world.w) | 0;
        if (tx < range.x0 || tx > range.x1 || ty < range.y0 || ty > range.y1) continue;
        const [sx, sy] = toScreen(tx, ty);
        diamond(sx, sy);
        ctx.stroke();
      }
    }
  }

  // ---- the frame ---------------------------------------------------------------------------
  function draw(camera, hover, walkers, overlays, dt = 1 / 60) {
    clock += dt;
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) resize();
    computeView(camera);
    if (needsRebuild()) rebuildGround();
    const z = view.zoom;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    // Projection space → device: scale by zoom, translate by the view's top-left.
    const S = hiScaleFor(z);
    const base = { z, tx: -Math.round(view.left * z), ty: -Math.round(view.top * z) };
    ctx.setTransform(z, 0, 0, z, base.tx, base.ty);

    // Water, cycling, under the transparent holes in the ground layer.
    const waterSprite = art.ground("water");
    const waterTint = waterTints[Math.floor(clock * 4) % 6];
    const vl = view.left - TILE_W, vt = view.top - TILE_H, vr = view.left + view.w + TILE_W, vb = view.top + view.h + TILE_H;
    for (const [sx, sy] of water) if (sx > vl && sx < vr && sy > vt && sy < vb) blitScaled(ctx, base, S, waterSprite, sx - HALF_W, sy, waterTint);
    // The ground layer was built at G.S device px per projection px (needsRebuild remakes it when the zoom crosses 2).
    ctx.setTransform(z / G.S, 0, 0, z / G.S, base.tx, base.ty);
    ctx.drawImage(ground, G.left * G.S, G.top * G.S);
    ctx.setTransform(z, 0, 0, z, base.tx, base.ty);

    const range = tileRange(view);
    if (overlays && overlays !== "off") drawOverlay(overlays, range);

    // Everything that stands or moves, in the one order.
    const items = [];
    const fireFrame = Math.floor(clock * 4) & 1;
    const fire = art.overlay("fire", fireFrame);
    const blink = Math.floor(clock * 1.5) & 1;
    for (let ty = range.y0; ty <= range.y1; ty++) {
      for (let tx = range.x0; tx <= range.x1; tx++) {
        const [sx, sy] = toScreen(tx, ty);
        if (!range.inside(sx, sy)) continue;
        const i = ty * world.w + tx;
        let standing = null;
        if (world.terrain[i] === TERRAIN.TREE) {
          const v = world.variant[i];
          const nearWater = waterAt(tx + 1, ty) || waterAt(tx - 1, ty) || waterAt(tx, ty + 1) || waterAt(tx, ty - 1);
          standing = art.tree(nearWater && v & 1 ? "willow" : v % 3 === 2 ? "tall" : "round");
        } else if (world.tier[i] > 0 && world.zone[i] !== ZONE.NONE) {
          // A block stands on its anchor and its parts stand for nothing (the sprite's footprint keys it; painter.js).
          if (!isPart(world, i)) standing = art.building(world.zone[i], world.tier[i], world.variant[i], sideOf(world, i), world.theme[i]); // the whole variant byte: & 1 the mirror, >> 1 the shop of the pool for C tier 1 (SPEC §12.2d); a 3×3 with a theme draws its landmark (§3c)
        } else if (world.civic[i] === CIVIC.PARK) standing = art.civic("park");
        else if (world.civic[i] === CIVIC.ZOO) standing = art.civic("zoo");
        else if (world.civic[i] === CIVIC.FIRE) standing = art.civic("fire");
        else if (world.civic[i] === CIVIC.POLICE) standing = art.civic("police");
        else if (world.civic[i] === CIVIC.CENTRE) standing = art.civic("centre");
        else if (world.wall[i]) standing = world.road[i] !== ROAD.NONE || world.rail[i] ? art.tunnel(tunnelAxis(world, i)) : art.wall(wallMask(tx, ty)); // a wall stands; a tunnel stands over its road or rail
        else if (world.rail[i] === 2) standing = art.station(railAxis(tx, ty)); // the platform and shelter stand over the track
        if (standing) items.push({ sprite: standing, tx, ty, kind: "building" });
        if (world.burning[i]) items.push({ sprite: fire, tx, ty, kind: "building", z: Z_BUILDING + 1, dy: -6 });
        if (i === plazaTile) items.push({ sprite: art.overlay("plaza"), tx, ty, kind: "ground", z: 3, dy: -2 });
        const zk = zots.get(i);
        if (zk && blink) items.push({ sprite: art.zot(zk), tx, ty, kind: "building", z: Z_BUILDING + 2, dy: -(standing ? standing.h - standing.anchor[1] + 14 : 18) });
      }
    }
    // Cursor, drag ghosts, placement ghost.
    if (hover) {
      if (hover.drag && hover.drag.tiles) {
        const g = art.overlay("ghost");
        const tint = hover.drag.refused ? RED_TINT : null;
        for (const i of hover.drag.tiles) items.push({ sprite: g, tx: i % world.w, ty: (i / world.w) | 0, kind: "ground", z: 3, tint });
      }
      if (hover.ghost) {
        const gh = hover.ghost;
        const g = art.overlay("ghost");
        const tint = gh.ok ? null : RED_TINT;
        for (let dy = 0; dy < gh.h; dy++) for (let dx = 0; dx < gh.w; dx++) items.push({ sprite: g, tx: gh.tx + dx, ty: gh.ty + dy, kind: "ground", z: 3, tint });
        if (gh.sprite) items.push({ sprite: gh.sprite, tx: gh.tx, ty: gh.ty, kind: "building", z: Z_BUILDING + 3, alpha: gh.ok ? 0.55 : 0.3 });
      }
      if (hover.tx != null && hover.tx >= 0 && hover.tx < world.w && hover.ty >= 0 && hover.ty < world.h) {
        // On a tile of an oblong (the zoo, a block) the cursor is keyed as
        // that building, a hair under it (painter.js FOOTPRINTS): keyed as
        // its own tile it would poke through the wall of a block keyed
        // 1.7 cells back, or vanish under the ground it stands on.
        const fp = footprintAt(hover.tx, hover.ty);
        items.push({ sprite: art.overlay("cursor"), tx: hover.tx, ty: hover.ty, kind: "ground", z: fp ? Z_BUILDING - 1 : 4, tint: hover.pinned ? RED_TINT : null, keyAt: fp ? [fp.tx, fp.ty] : undefined, footprint: fp ? [fp.side, fp.side] : undefined });
      }
    }
    // Walkers, tents, meeting glyphs.
    const winter = world.events.active.some((e) => e.id === "bearWinter");
    const list = walkers ? walkers.list() : [];
    const tent = art.overlay("tent");
    const meet = art.overlay("meeting");
    for (const w of list) {
      if (winter && w.species === "bear") continue;
      if (w.tx < range.x0 - 1 || w.tx > range.x1 + 1 || w.ty < range.y0 - 1 || w.ty > range.y1 + 1) continue;
      if (w.tent) {
        const ttx = Math.floor(w.tx), tty = Math.floor(w.ty);
        items.push({ sprite: tent, tx: ttx, ty: tty, kind: "building" });
        items.push({ sprite: art.citizen(w.species, w.facing, 0, w.age), tx: ttx + 0.82, ty: tty + 0.55, kind: "walker" });
        continue;
      }
      // On a bridge the deck sits DECK_TOP px above the water plane (roads.js);
      // shots.mjs lifted its walkers, the renderer did not — they stood in the river.
      const onBridge = world.road[Math.floor(w.ty) * world.w + Math.floor(w.tx)] === ROAD.BRIDGE;
      items.push({ sprite: art.citizen(w.species, w.facing, w.frame, w.age, { hat: w.hat, carry: w.carry }), tx: w.tx, ty: w.ty, kind: "walker", walker: w, dy: onBridge ? -DECK_TOP : w.riding ? -3 : 0 }); // a rider sits up on the train
      if (w.glyph === "meeting" && w.standUntil > 0) items.push({ sprite: meet, tx: w.tx, ty: w.ty, kind: "walker", z: 1000, dy: -24 });
      if (w.kind === "predation" && w.bag != null && w.prey) {
        // The neighbour at the door. First the open sack falls over it (a
        // quadratic drop from 22 px up); then the tied sack stands where it
        // stood, wriggling, until the killer turns for home.
        const p = w.prey;
        if (w.bag < BAG_FALL) {
          const u = w.bag / BAG_FALL;
          items.push({ sprite: art.citizen(p.species, p.facing, 0, p.age), tx: p.tx, ty: p.ty, kind: "walker" });
          items.push({ sprite: art.overlay("sack", 0), tx: p.tx, ty: p.ty, kind: "walker", z: 999, dy: -Math.round(22 * (1 - u * u)) });
        } else {
          items.push({ sprite: art.overlay("sack", 1 + (Math.floor(w.bag * 8) & 1)), tx: p.tx, ty: p.ty, kind: "walker" });
        }
      }
    }
    paintScene(items, (sprite, sx, sy, item) => {
      if (item.alpha != null) ctx.globalAlpha = item.alpha;
      blitScaled(ctx, base, S, sprite, sx, sy + (item.dy || 0), item.tint || null);
      if (item.alpha != null) ctx.globalAlpha = 1;
    });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---- picking ---------------------------------------------------------------------------------
  function toProjection(sx, sy) {
    return [sx / view.zoom + view.left, sy / view.zoom + view.top];
  }
  function pick(sx, sy) {
    const [px, py] = toProjection(sx, sy);
    return pickTile(px, py, world.w, world.h);
  }
  /** The walker under a screen point (its sprite's box), nearest feet first; null if none. */
  function pickWalker(sx, sy, list) {
    const [px, py] = toProjection(sx, sy);
    let best = null;
    let bd = Infinity;
    for (const w of list || []) {
      if (w.tent) continue;
      const sp = art.citizen(w.species, w.facing, w.frame, w.age, { hat: w.hat, carry: w.carry });
      const [nx, ny] = toScreen(w.tx, w.ty);
      const fx = nx, fy = ny + HALF_H; // feet on the ground centre
      const left = fx - sp.anchor[0], top = fy - sp.anchor[1];
      if (px < left - 2 || px > left + sp.w + 2 || py < top - 2 || py > top + sp.h + 2) continue;
      const d = Math.abs(px - fx) + Math.abs(py - fy);
      if (d < bd) { bd = d; best = w; }
    }
    return best;
  }

  /** Screen point of a tile's ground centre, for the UI to anchor things. */
  function tileToScreen(tx, ty) {
    const [nx, ny] = toScreen(tx, ty);
    return [(nx - view.left) * view.zoom, (ny + HALF_H - view.top) * view.zoom];
  }

  function invalidate() { dirty = true; }
  function setWorld(nw) { world = nw; dirty = true; G = null; }

  resize();
  return { draw, invalidate, pick, pickWalker, resize, setWorld, viewportTiles, tileToScreen, get view() { return view; } };
}
