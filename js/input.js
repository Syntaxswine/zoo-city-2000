// input.js — mouse and keyboard → ops. SPEC §11.
//
//   1 R · 2 C · 3 I · 4 Road · 5 Tree · 6 Park · 7 Zoo · 8 Bulldoze · 9 Inspect
//   D density · Space pause · , . speed · Z undo · S save · L load · O overlays
//   +/- zoom · WASD / arrows / drag-pan (middle or right button, or left with Inspect)
//   Esc: clears a drag or a pinned card; on a clean map, the title menu (title.js)
//
// Zones, trees and bulldoze are a rectangle drag; roads are an L-drag
// (horizontal leg then vertical, Shift = straight); park and zoo are a
// click-place with a ghost. The strip shows the live cost of the drag; a
// drag the treasury cannot pay draws the refused hatch and does nothing on
// release. Every mutation goes through `app.doOp(op)`, which is the one
// place that calls apply() + renderer.invalidate() + walkers.notify().

import { ZONE, idx } from "./sim/world.js";
import { costOf, roadL } from "./sim/ops.js";

export const TOOLS = [
  { id: "R", key: "1", label: "R", hint: "zone residential (drag)" },
  { id: "C", key: "2", label: "C", hint: "zone commercial (drag)" },
  { id: "I", key: "3", label: "I", hint: "zone industrial (drag)" },
  { id: "M", key: "M", label: "Meat", hint: "zone meat market (drag) §12 — grey, off the books; carnivores staff it, herbivores smell it four tiles off" },
  { id: "road", key: "4", label: "Road", hint: "L-drag; Shift = straight; over water = bridge §40" },
  { id: "tree", key: "5", label: "Tree", hint: "plant trees (drag) §4" },
  { id: "park", key: "6", label: "Park", hint: "1×1, §150 — click" },
  { id: "zoo", key: "7", label: "Zoo", hint: "2×2, §2,500 — click" },
  { id: "fire", key: "F", label: "Fire stn", hint: "1×1, §500 — click; within 6 tiles a fire burns one month and barely spreads" },
  { id: "police", key: "P", label: "Police", hint: "1×1, §500 — click; takes 60 off crime within 3 tiles, 30 within 6" },
  { id: "centre", key: "V", label: "Pacify", hint: "1×1, §1,500, §900/yr, 4 jobs, 6 beds — click; a convicted predator comes home fixed in six months" },
  { id: "bulldoze", key: "8", label: "Bulldoze", hint: "clear (drag) §2, trees §4" },
  { id: "inspect", key: "9", label: "Inspect", hint: "pin a card; left-drag pans" },
];
const TOOL_BY_KEY = Object.fromEntries(TOOLS.map((t) => [t.key, t.id]));
const PLACE_TOOLS = new Set(["park", "zoo", "fire", "police", "centre"]);
const ZONE_OF = { R: ZONE.R, C: ZONE.C, I: ZONE.I, M: ZONE.M };
const PAN_SPEED = 700; // projection px per second

export function createInput(canvas, app) {
  const state = {
    tool: "R",
    density: 3, // 3 High, 1 Low
    hover: null, // [tx, ty] | null
    pinned: null, // tile index | null
    pinnedWalker: null,
    drag: null, // { ax, ay, bx, by, shift }
    pan: null, // { sx, sy, cx, cy }
    mouse: { x: 0, y: 0, inside: false },
    cost: null, // { op, cost, tiles, refused }
  };
  const held = new Set();

  const world = () => app.world;

  function setTool(id) {
    state.tool = id;
    state.drag = null;
    state.cost = null;
    app.ui.setTool(id, state.density);
    app.ui.setCost("");
  }

  function screenXY(e) {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  // ---- ops from the current drag ------------------------------------------------------
  function dragOp() {
    const d = state.drag;
    if (!d) return null;
    const w = world();
    switch (state.tool) {
      case "R": case "C": case "I": case "M":
        return { kind: "zone", zone: ZONE_OF[state.tool], x0: d.ax, y0: d.ay, x1: d.bx, y1: d.by, density: state.density };
      case "tree":
        return { kind: "tree", x0: d.ax, y0: d.ay, x1: d.bx, y1: d.by };
      case "bulldoze":
        return { kind: "bulldoze", x0: d.ax, y0: d.ay, x1: d.bx, y1: d.by };
      case "road":
        return { kind: "road", tiles: roadL(w, d.ax, d.ay, d.bx, d.by, d.shift) };
      default:
        return null;
    }
  }

  function clickOp(tx, ty) {
    if (PLACE_TOOLS.has(state.tool)) return { kind: state.tool, tx, ty };
    return null;
  }

  function affordable(cost) {
    const w = world();
    if (w.flags.receivership) return false;
    return cost <= w.cash;
  }

  function costLabel(op, plan) {
    const n = plan.tiles.length;
    const name = { zone: op.zone === ZONE.R ? "R" : op.zone === ZONE.C ? "C" : op.zone === ZONE.M ? "Meat" : "I", road: "Road", tree: "Tree", bulldoze: "Bulldoze", park: "Park", zoo: "Zoo", fire: "Fire station", police: "Police station", centre: "Pacification centre" }[op.kind];
    if (plan.reason) return `${name}: blocked`;
    if (!n) return `${name}: nothing to do`;
    const bridges = plan.tiles.filter((t) => t.what === "bridge").length;
    const extra = bridges ? ` (${bridges} bridge)` : "";
    // costOf() counts the empty zoned lots a road paves over (`replaced`, no
    // refund) and the built lots a bulldoze empties of animals (`evicts`, not undoable).
    const repl = plan.replaced ? ` · replaces ${plan.replaced} zoned lot${plan.replaced === 1 ? "" : "s"}` : "";
    const ev = plan.evicts ? ` · turns out ${plan.evicts} lot${plan.evicts === 1 ? "" : "s"} (no undo)` : "";
    return `${name} ×${n}${extra} = §${plan.cost.toLocaleString()}${repl}${ev}`;
  }

  function refreshCost() {
    const op = state.drag ? dragOp() : state.hover && clickOp(state.hover[0], state.hover[1]);
    if (!op) { state.cost = null; app.ui.setCost(""); return; }
    const plan = costOf(world(), op);
    const refused = !!plan.reason || (plan.tiles.length > 0 && !affordable(plan.cost));
    state.cost = { op, cost: plan.cost, tiles: plan.tiles.map((t) => t.i), refused, reason: plan.reason };
    const label = costLabel(op, plan);
    app.ui.setCost(refused && !plan.reason ? `${label} — ${world().flags.receivership ? "receivership" : "cannot afford"}` : label, refused);
  }

  // ---- pointer -------------------------------------------------------------------------------
  function onDown(e) {
    canvas.focus();
    const [sx, sy] = screenXY(e);
    const tile = app.renderer.pick(sx, sy);
    const panButton = e.button === 1 || e.button === 2 || (e.button === 0 && state.tool === "inspect");
    if (panButton) {
      state.pan = { sx, sy, cx: app.camera.x, cy: app.camera.y, moved: false };
      if (e.button === 0 && tile) {
        // Inspect: a click pins; a drag pans (decided on up).
        state.pan.pinTile = tile;
        state.pan.pinWalker = app.renderer.pickWalker(sx, sy, app.walkers.list());
      }
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    if (e.button !== 0 || !tile) return;
    const [tx, ty] = tile;
    const op = clickOp(tx, ty);
    if (op) {
      const plan = costOf(world(), op);
      if (plan.reason) { app.ui.flash(`${state.tool}: blocked here`); return; }
      if (!affordable(plan.cost)) { app.ui.flash(world().flags.receivership ? "Receivership: building is frozen" : `§${plan.cost.toLocaleString()} — cannot afford`); return; }
      app.doOp(op);
      refreshCost();
      return;
    }
    state.drag = { ax: tx, ay: ty, bx: tx, by: ty, shift: e.shiftKey };
    canvas.setPointerCapture(e.pointerId);
    refreshCost();
    e.preventDefault();
  }

  function onMove(e) {
    const [sx, sy] = screenXY(e);
    state.mouse = { x: sx, y: sy, inside: true };
    if (state.pan) {
      const z = app.camera.zoom;
      app.camera.x = state.pan.cx - (sx - state.pan.sx) / z;
      app.camera.y = state.pan.cy - (sy - state.pan.sy) / z;
      if (Math.abs(sx - state.pan.sx) + Math.abs(sy - state.pan.sy) > 4) state.pan.moved = true;
      return;
    }
    const tile = app.renderer.pick(sx, sy);
    const changed = !tile !== !state.hover || (tile && state.hover && (tile[0] !== state.hover[0] || tile[1] !== state.hover[1]));
    state.hover = tile;
    if (state.drag) {
      state.drag.shift = e.shiftKey;
      if (tile) { state.drag.bx = tile[0]; state.drag.by = tile[1]; }
      else {
        // Off the map: clamp to the edge so a drag to the border still works.
        const w = world();
        state.drag.bx = Math.max(0, Math.min(w.w - 1, state.drag.bx));
        state.drag.by = Math.max(0, Math.min(w.h - 1, state.drag.by));
      }
      refreshCost();
    } else if (changed || PLACE_TOOLS.has(state.tool)) refreshCost();
  }

  function onUp(e) {
    if (state.pan) {
      const p = state.pan;
      state.pan = null;
      if (!p.moved && p.pinTile) {
        // Inspect click: pin (or unpin) the card.
        if (p.pinWalker) { state.pinnedWalker = p.pinWalker; state.pinned = null; }
        else {
          const i = idx(world(), p.pinTile[0], p.pinTile[1]);
          state.pinned = state.pinned === i ? null : i;
          state.pinnedWalker = null;
        }
      }
      return;
    }
    if (!state.drag) return;
    const op = dragOp();
    state.drag = null;
    if (!op) return;
    const plan = costOf(world(), op);
    if (plan.reason || !plan.tiles.length) { refreshCost(); return; }
    if (!affordable(plan.cost)) {
      app.ui.flash(world().flags.receivership ? "Receivership: building is frozen" : `§${plan.cost.toLocaleString()} — cannot afford`);
      refreshCost();
      return;
    }
    app.doOp(op);
    refreshCost();
  }

  function onLeave() {
    state.mouse.inside = false;
    if (!state.drag) { state.hover = null; app.ui.setCost(""); state.cost = null; }
  }

  function onWheel(e) {
    e.preventDefault();
    const [sx, sy] = screenXY(e);
    app.zoomAt(e.deltaY < 0 ? 1 : -1, sx, sy);
  }

  // ---- keyboard -------------------------------------------------------------------------------
  const typing = (e) => {
    const t = e.target;
    return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
  };
  const PAN_KEYS = { KeyW: [0, -1], KeyA: [-1, 0], KeyS: [0, 1], KeyD: [1, 0], ArrowUp: [0, -1], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowRight: [1, 0] };
  // S and D are both a pan key and a command (save, density): a TAP is the
  // command, a HOLD (> 220 ms, or with another pan key down) is the pan.
  const TAP_MS = 220;
  const downAt = new Map();

  function command(k, e) {
    const toolKey = TOOL_BY_KEY[k] || TOOL_BY_KEY[String(k).toUpperCase()];
    if (toolKey) { setTool(toolKey); return; }
    switch (k) {
      case "d": case "D":
        state.density = state.density === 3 ? 1 : 3;
        app.ui.setTool(state.tool, state.density);
        app.ui.flash(`Density: ${state.density === 3 ? "High (tiers to 3)" : "Low (cottages only)"}`);
        break;
      case " ": app.togglePause(); break;
      case ",": app.setSpeed(-1); break;
      case ".": app.setSpeed(1); break;
      case "z": case "Z": app.undo(); break;
      case "s": case "S": app.save(); break;
      case "l": case "L": app.load(); break;
      case "o": case "O": app.cycleOverlay(); break;
      case "+": case "=": app.zoomAt(1); break;
      case "-": case "_": app.zoomAt(-1); break;
      case "n": case "N": app.ui.openNewCity(); break;
      case "Escape":
        // Two-step: a drag or a pinned card is cleared first; a clean map opens the title menu.
        if (state.drag || state.pinned != null || state.pinnedWalker) { state.drag = null; state.pinned = null; state.pinnedWalker = null; state.cost = null; app.ui.setCost(""); }
        else app.title.open();
        break;
      default:
        break;
    }
  }

  function onKey(e) {
    if (e.key === "Escape") {
      // The title menu first (a panel goes back, the menu closes), then the new-city dialog.
      if (app.title && app.title.isOpen()) { app.title.back(); e.preventDefault(); return; }
      if (app.ui.modalOpen()) { app.ui.closeModals(); e.preventDefault(); return; }
    }
    if (typing(e)) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (app.ui.modalOpen()) return;
    // Space by its code too: a synthetic KeyboardEvent can carry key "" with code "Space".
    const key = e.code === "Space" ? " " : e.key;
    if (key === " " || e.code.startsWith("Arrow") || /^[nN+=\-_]$/.test(key)) e.preventDefault();
    if (PAN_KEYS[e.code]) {
      if (e.repeat) { held.add(e.code); return; }
      if (e.code === "KeyS" || e.code === "KeyD") {
        downAt.set(e.code, performance.now());
        if (held.size) held.add(e.code); // already panning: this one joins
        return;
      }
      held.add(e.code);
      return;
    }
    command(key, e);
  }
  function onKeyUp(e) {
    if (typing(e)) return;
    if ((e.code === "KeyS" || e.code === "KeyD") && downAt.has(e.code)) {
      const t0 = downAt.get(e.code);
      downAt.delete(e.code);
      const wasPan = held.has(e.code);
      held.delete(e.code);
      if (!wasPan && performance.now() - t0 < TAP_MS && !app.ui.modalOpen()) command(e.code === "KeyS" ? "s" : "d", e);
      return;
    }
    held.delete(e.code);
  }
  function promoteHolds() {
    const now = performance.now();
    for (const [code, t0] of downAt) if (now - t0 >= TAP_MS) held.add(code);
  }
  // Arrow keys must not scroll the page; WASD pan while held.
  function update(dt) {
    promoteHolds();
    let dx = 0, dy = 0;
    for (const code of held) {
      const v = PAN_KEYS[code];
      if (v) { dx += v[0]; dy += v[1]; }
    }
    if (dx || dy) {
      const s = (PAN_SPEED * dt) / app.camera.zoom;
      app.camera.x += dx * s;
      app.camera.y += dy * s;
    }
  }

  // ---- what the renderer and the card need --------------------------------------------------
  function hoverForRenderer() {
    const w = world();
    const h = { tx: -1, ty: -1, pinned: false, drag: null, ghost: null };
    if (state.pinned != null) { h.tx = state.pinned % w.w; h.ty = (state.pinned / w.w) | 0; h.pinned = true; }
    else if (state.hover) { h.tx = state.hover[0]; h.ty = state.hover[1]; }
    if (state.drag && state.cost) h.drag = { tiles: state.cost.tiles, refused: state.cost.refused };
    if (!state.drag && state.hover && PLACE_TOOLS.has(state.tool) && state.mouse.inside) {
      const [tx, ty] = state.hover;
      const size = state.tool === "zoo" ? 2 : 1;
      const ok = !!state.cost && !state.cost.refused && state.cost.tiles.length > 0;
      h.ghost = { tx, ty, w: size, h: size, ok, sprite: app.art.civic(state.tool) };
    }
    return h;
  }

  /** For the hover card: the pinned or hovered thing. */
  function hoverInfo() {
    const w = world();
    if (state.pinnedWalker) {
      const alive = app.walkers.list().includes(state.pinnedWalker);
      if (alive) return { walker: state.pinnedWalker, pinned: true };
      state.pinnedWalker = null;
    }
    if (state.pinned != null) return { tile: state.pinned, pinned: true };
    if (!state.mouse.inside || state.drag) return state.hover ? { tile: idx(w, state.hover[0], state.hover[1]), pinned: false } : null;
    const wk = app.renderer.pickWalker(state.mouse.x, state.mouse.y, app.walkers.list());
    if (wk) return { walker: wk, pinned: false };
    if (!state.hover) return null;
    return { tile: idx(w, state.hover[0], state.hover[1]), pinned: false };
  }

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("pointerleave", onLeave);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  window.addEventListener("keydown", onKey);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("blur", () => held.clear());

  return {
    state,
    setTool,
    update,
    hover: hoverForRenderer,
    hoverInfo,
    refreshCost,
    get tool() { return state.tool; },
    get density() { return state.density; },
    unpin() { state.pinned = null; state.pinnedWalker = null; },
  };
}

