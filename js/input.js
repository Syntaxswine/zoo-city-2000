// input.js — mouse and keyboard → ops. SPEC §11.
//
//   1..0 the first ten palette positions · Z Zoo · V Pacify · P Police · F Fire · I Inspect · B Bulldoze
//   H density · U Use · Space pause · , . speed · Backspace/Ctrl+Z undo · Ctrl+S save · L load · O overlays
//   +/- zoom · WASD / arrows / drag-pan (middle or right button, or left with Inspect)
//   Esc: clears a drag or a pinned card; on a clean map, the title menu (title.js)
//
// Zones, trees and bulldoze are a rectangle drag; roads are an L-drag
// (horizontal leg then vertical, Shift = straight); park and zoo are a
// click-place with a ghost. The strip shows the live cost of the drag; a
// drag the treasury cannot pay draws the refused hatch and does nothing on
// release. Every mutation goes through `app.doOp(op)`, which is the one
// place that calls apply() + renderer.invalidate() + walkers.notify().

import { idx } from "./sim/world.js";
import { costOf, roadL } from "./sim/ops.js";
import { pinTarget } from "./follow.js";
import { TOOL_BY_ID, TOOL_BY_KEY, PLACE_TOOLS, labelForOp } from "./tools.js";
const PAN_SPEED = 700; // projection px per second

export function createInput(canvas, app) {
  const state = {
    tool: "R",
    density: 3, // 3 High, 1 Low
    use: 0, // the Use brush: 0 mixed · 1 predator-only · 2 prey-only
    hover: null, // [tx, ty] | null
    lastHover: null, // last map tile, retained only for palette cost previews
    pinned: null, // tile index | null
    pinnedCitizen: null, // stable citizen id; never a short-lived walker object
    drag: null, // { ax, ay, bx, by, shift }
    pan: null, // { sx, sy, cx, cy }
    mouse: { x: 0, y: 0, inside: false },
    cost: null, // { op, cost, tiles, refused }
  };
  const held = new Set();

  const world = () => app.world;

  const USE_LABEL = ["mixed — everyone", "predator-only — the hunters", "prey-only — everyone but a hunter"];
  function syncThoughts(tile = state.hover) {
    const inspecting = state.tool === "inspect";
    app.walkers.setCursor(inspecting && state.mouse.inside ? tile : null, inspecting ? state.pinnedCitizen : null);
  }
  function repickAfterCameraMove() {
    const tile = state.mouse.inside ? app.renderer.pick(state.mouse.x, state.mouse.y, app.camera) : null;
    const changed = !tile !== !state.hover || (tile && state.hover && (tile[0] !== state.hover[0] || tile[1] !== state.hover[1]));
    state.hover = tile;
    if (tile) state.lastHover = tile;
    syncThoughts();
    if (changed && state.tool !== "inspect") refreshCost();
  }
  function clearPins() {
    state.pinned = null;
    state.pinnedCitizen = null;
    syncThoughts();
  }
  function setTool(id) {
    if (id === "use" && state.tool === "use") { state.use = (state.use + 1) % 3; app.ui.flash(`Use brush: ${USE_LABEL[state.use]}.`); }
    if (id !== "use" && !TOOL_BY_ID[id]) throw new Error(`input: unknown tool '${id}'`);
    state.tool = id;
    state.drag = null;
    state.cost = null;
    app.ui.setTool(id, state.density);
    app.ui.setCost("");
    syncThoughts(id === "inspect" && state.mouse.inside ? state.hover : null);
    if (state.mouse.inside && state.hover && id !== "inspect") refreshCost();
    else if (id !== "use") {
      const preview = previewTool(id);
      if (preview.text) app.ui.setCost(preview.text, preview.refused);
    }
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
    const spec = TOOL_BY_ID[state.tool]?.op;
    switch (spec?.kind || state.tool) {
      case "zone":
        return { kind: "zone", zone: spec.zone, x0: d.ax, y0: d.ay, x1: d.bx, y1: d.by, density: state.density };
      case "tree":
        return { kind: "tree", x0: d.ax, y0: d.ay, x1: d.bx, y1: d.by };
      case "bulldoze":
        return { kind: "bulldoze", x0: d.ax, y0: d.ay, x1: d.bx, y1: d.by };
      case "use":
        return { kind: "use", use: state.use, x0: d.ax, y0: d.ay, x1: d.bx, y1: d.by };
      case "road":
        return { kind: "road", tiles: roadL(w, d.ax, d.ay, d.bx, d.by, d.shift) };
      case "wall":
        return { kind: "wall", tiles: roadL(w, d.ax, d.ay, d.bx, d.by, d.shift) };
      case "rail":
        return { kind: "rail", tiles: roadL(w, d.ax, d.ay, d.bx, d.by, d.shift) };
      case "camera":
        return { kind: "camera", tiles: roadL(w, d.ax, d.ay, d.bx, d.by, d.shift) };
      default:
        return null;
    }
  }

  function clickOp(tx, ty) {
    if (PLACE_TOOLS.includes(state.tool)) return { kind: TOOL_BY_ID[state.tool].op.kind, tx, ty };
    return null;
  }

  function previewOp(id, tx, ty) {
    const tool = TOOL_BY_ID[id];
    if (!tool || tool.op.kind === "inspect") return null;
    const kind = tool.op.kind;
    if (PLACE_TOOLS.includes(id)) return { kind, tx, ty };
    if (kind === "zone") return { kind, zone: tool.op.zone, x0: tx, y0: ty, x1: tx, y1: ty, density: state.density };
    if (kind === "road" || kind === "wall" || kind === "rail" || kind === "camera") return { kind, tiles: [idx(world(), tx, ty)] };
    return { kind, x0: tx, y0: ty, x1: tx, y1: ty };
  }

  function affordable(cost) {
    const w = world();
    if (w.flags.receivership) return false;
    return cost <= w.cash;
  }

  function costLabel(op, plan) {
    const n = plan.tiles.length;
    const name = op.kind === "use" ? `Use ${["mixed", "predator-only", "prey-only"][op.use]}` : labelForOp(op);
    if (plan.reason) return `${name}: ${plan.reason}`; // the old reasons ARE the word "blocked"; a rule with something to say (the level crossing, SPEC §7.9) says it here
    if (!n) return `${name}: nothing to do`;
    const bridges = plan.tiles.filter((t) => t.what === "bridge").length;
    const tunnels = plan.tiles.filter((t) => t.what === "tunnel").length;
    const crossings = plan.tiles.filter((t) => t.what === "crossing").length;
    const extra = bridges ? ` (${bridges} bridge)` : tunnels ? ` (${tunnels} tunnel${tunnels === 1 ? "" : "s"})` : crossings ? ` (${crossings} level crossing${crossings === 1 ? "" : "s"})` : "";
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

  function previewTool(id) {
    const tool = TOOL_BY_ID[id];
    if (!tool) return { text: "", refused: false };
    if (tool.op.kind === "inspect") return { text: `${tool.label}: ${tool.hint}`, refused: false };
    const tile = state.hover || state.lastHover;
    if (!tile) return { text: `${tool.label}: point at the map for its cost`, refused: false };
    const op = previewOp(id, tile[0], tile[1]);
    const plan = costOf(world(), op);
    const refused = !!plan.reason || (plan.tiles.length > 0 && !affordable(plan.cost));
    const label = costLabel(op, plan);
    const text = refused && !plan.reason ? `${label} — ${world().flags.receivership ? "receivership" : "cannot afford"}` : label;
    return { text, refused };
  }

  // ---- pointer -------------------------------------------------------------------------------
  function onDown(e) {
    canvas.focus();
    const [sx, sy] = screenXY(e);
    state.mouse = { x: sx, y: sy, inside: true };
    const tile = app.renderer.pick(sx, sy, app.camera);
    state.hover = tile;
    if (tile) state.lastHover = tile;
    syncThoughts(tile); // touch can begin here without a preceding pointermove
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
      repickAfterCameraMove();
      return;
    }
    const tile = app.renderer.pick(sx, sy, app.camera);
    const changed = !tile !== !state.hover || (tile && state.hover && (tile[0] !== state.hover[0] || tile[1] !== state.hover[1]));
    state.hover = tile;
    if (tile) state.lastHover = tile;
    syncThoughts(tile);
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
    } else if (changed || PLACE_TOOLS.includes(state.tool)) refreshCost();
  }

  function onUp(e) {
    if (state.pan) {
      const p = state.pan;
      state.pan = null;
      if (!p.moved && p.pinTile) {
        // Inspect click: pin (or unpin) the card.
        if (p.pinWalker?.citizen != null && pinTarget(world(), app.walkers.list(), p.pinWalker.citizen)) {
          state.pinnedCitizen = p.pinWalker.citizen;
          state.pinned = null;
        }
        else {
          const i = idx(world(), p.pinTile[0], p.pinTile[1]);
          state.pinned = state.pinned === i ? null : i;
          state.pinnedCitizen = null;
        }
        syncThoughts();
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
    syncThoughts(null); // a pinned citizen still speaks beside its walker while the pointer is over the card
    if (!state.drag) { state.hover = null; app.ui.setCost(""); state.cost = null; }
  }

  function onWheel(e) {
    e.preventDefault();
    const [sx, sy] = screenXY(e);
    app.zoomAt(e.deltaY < 0 ? 1 : -1, sx, sy);
    repickAfterCameraMove();
  }

  // ---- keyboard -------------------------------------------------------------------------------
  const editing = (e) => {
    const t = e.target;
    return t && (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable);
  };
  const activating = (e) => e.target && ["BUTTON", "A"].includes(e.target.tagName);
  const PAN_KEYS = { KeyW: [0, -1], KeyA: [-1, 0], KeyS: [0, 1], KeyD: [1, 0], ArrowUp: [0, -1], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowRight: [1, 0] };
  function command(k, e) {
    const tool = TOOL_BY_KEY[String(k).toUpperCase()];
    if (tool) { setTool(tool.id); return; }
    switch (k) {
      case "h": case "H":
        state.density = state.density === 3 ? 1 : 3;
        app.ui.setTool(state.tool, state.density);
        app.ui.flash(`Density: ${state.density === 3 ? "High (tiers to 3)" : "Low (cottages only)"}`);
        refreshCost(); // an in-flight zone drag now has a different operation
        break;
      case " ": app.togglePause(); break;
      case ",": app.setSpeed(-1); break;
      case ".": app.setSpeed(1); break;
      case "Backspace": app.undo(); break;
      case "u": case "U": setTool("use"); break;
      case "l": case "L": app.load(); break;
      case "o": case "O": app.cycleOverlay(); break;
      case "r": case "R": app.news.toggle(); break;
      case "+": case "=": app.zoomAt(1); repickAfterCameraMove(); break;
      case "-": case "_": app.zoomAt(-1); repickAfterCameraMove(); break;
      case "n": case "N": app.ui.openNewCity(); break;
      case "Escape":
        // Two-step: a drag or a pinned card is cleared first; a clean map opens the title menu.
        if (state.drag || state.pinned != null || state.pinnedCitizen != null) { state.drag = null; clearPins(); state.cost = null; app.ui.setCost(""); }
        else app.title.open();
        break;
      default:
        break;
    }
  }

  function onKey(e) {
    if (e.key === "Escape") {
      // The title menu first (a panel goes back, the menu closes), then the news
      // reader, then the new-city dialog.
      if (app.title && app.title.isOpen()) { app.title.back(); e.preventDefault(); return; }
      if (app.news && app.news.isOpen()) { app.news.close(); e.preventDefault(); return; }
      if (app.ui.modalOpen()) { app.ui.closeModals(); e.preventDefault(); return; }
    }
    // Space by its code too: a synthetic KeyboardEvent can carry key "" with code "Space".
    const key = e.code === "Space" ? " " : e.key;
    if (editing(e)) {
      // Ctrl+S inside the save-name field must neither open the browser's Save
      // Page dialog nor rebuild the panel and erase the name being edited.
      if ((e.ctrlKey || e.metaKey) && e.code === "KeyS") e.preventDefault();
      return;
    }
    // A reader owns its keyboard. In particular Ctrl+S cannot stack a second
    // title/save modal over it. A button inside the reader keeps native
    // Space/Enter activation; a top-strip button left focused behind the
    // reader does not get a phantom click on keyup.
    if (app.news && app.news.isOpen()) {
      const readerControl = activating(e) && e.target.closest?.("#news");
      if (readerControl && (key === " " || key === "Enter")) return;
      held.clear();
      if (app.news.key(e) || activating(e) || key === "Backspace" || e.ctrlKey || e.metaKey) e.preventDefault();
      return;
    }
    // Space/Enter natively activate a focused button or link. Backspace has
    // no native job there and must not navigate. Every other shortcut,
    // especially WASD and palette keys, remains global after a palette click.
    if (activating(e) && (key === " " || key === "Enter" || key === "Backspace")) {
      if (key === "Backspace") e.preventDefault();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.code === "KeyS") {
      e.preventDefault();
      if (!e.repeat && (!app.ui.modalOpen() || (app.title && app.title.isOpen()))) app.save();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.code === "KeyZ") {
      e.preventDefault();
      if (!e.repeat && !app.ui.modalOpen()) app.undo();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (app.ui.modalOpen()) { if (key === "Backspace") e.preventDefault(); return; }
    if (key === " " || key === "Backspace" || PAN_KEYS[e.code] || /^[nN+=\-_]$/.test(key)) e.preventDefault();
    if (PAN_KEYS[e.code]) {
      held.add(e.code);
      return;
    }
    if (e.repeat) return;
    command(key, e);
  }
  function onKeyUp(e) {
    held.delete(e.code);
  }
  // Arrow keys must not scroll the page; WASD pan while held.
  function update(dt) {
    // A modal can open from a mouse click while a pan key is already held, so
    // keydown never gets a chance to clear it. Never move the hidden map.
    if ((app.news && app.news.isOpen()) || app.ui.modalOpen() || (app.title && app.title.isOpen())) {
      held.clear();
      return;
    }
    let dx = 0, dy = 0;
    for (const code of held) {
      const v = PAN_KEYS[code];
      if (v) { dx += v[0]; dy += v[1]; }
    }
    if (dx || dy) {
      const s = (PAN_SPEED * dt) / app.camera.zoom;
      app.camera.x += dx * s;
      app.camera.y += dy * s;
      repickAfterCameraMove();
    }
  }

  // ---- what the renderer and the card need --------------------------------------------------
  function hoverForRenderer() {
    const w = world();
    const h = { tx: -1, ty: -1, pinned: false, drag: null, ghost: null };
    if (state.pinned != null) { h.tx = state.pinned % w.w; h.ty = (state.pinned / w.w) | 0; h.pinned = true; }
    else if (state.hover) { h.tx = state.hover[0]; h.ty = state.hover[1]; }
    if (state.drag && state.cost) h.drag = { tiles: state.cost.tiles, refused: state.cost.refused };
    if (!state.drag && state.hover && PLACE_TOOLS.includes(state.tool) && state.mouse.inside) {
      const [tx, ty] = state.hover;
      const size = state.tool === "zoo" ? 2 : 1;
      const ok = !!state.cost && !state.cost.refused && state.cost.tiles.length > 0;
      h.ghost = { tx, ty, w: size, h: size, ok, sprite: state.tool === "station" ? app.art.station("ns") : app.art.civic(state.tool) };
    }
    return h;
  }

  /** For the hover card: the pinned or hovered thing. */
  function hoverInfo() {
    const w = world();
    if (state.pinnedCitizen != null) {
      const target = pinTarget(w, app.walkers.list(), state.pinnedCitizen);
      if (target) return { citizen: state.pinnedCitizen, walker: target.walker, target, pinned: true };
      clearPins(); // invalid imported/corrupt id only; ending a walk is not an unpin
    }
    if (state.pinned != null) return { tile: state.pinned, pinned: true };
    if (!state.mouse.inside || state.drag) return state.hover ? { tile: idx(w, state.hover[0], state.hover[1]), pinned: false } : null;
    const wk = app.renderer.pickWalker(state.mouse.x, state.mouse.y, app.walkers.list());
    if (wk?.citizen != null) {
      const target = pinTarget(w, app.walkers.list(), wk.citizen);
      if (target) return { citizen: wk.citizen, walker: wk, target, pinned: false };
    }
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
    syncCamera: repickAfterCameraMove,
    hover: hoverForRenderer,
    hoverInfo,
    refreshCost,
    previewTool,
    toggleDensity() { command("H", { preventDefault() {} }); },
    pinCitizen(id) {
      const target = pinTarget(world(), app.walkers.list(), id);
      if (!target) return false;
      state.pinnedCitizen = Number(id);
      state.pinned = null;
      setTool("inspect");
      syncThoughts();
      return true;
    },
    get tool() { return state.tool; },
    get density() { return state.density; },
    unpin() { clearPins(); },
  };
}

