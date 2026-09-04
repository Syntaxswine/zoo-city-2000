// tools.js — the one DOM-free registry behind the build palette, keys and help.
//
// A tool describes intent, not a particular drag. input.js adds coordinates,
// density and the selected Use value when it turns `op` into a real sim op.

import { ZONE } from "./sim/world.js";

const row = (order, id, key, label, op, sprite, hint) => Object.freeze({
  id, key, label, op: Object.freeze(op), sprite: Object.freeze({ ...sprite, args: Object.freeze([...sprite.args]) }), order, hint,
});

export const TOOLS = Object.freeze([
  row(1, "R", "1", "Residential", { kind: "zone", zone: ZONE.R }, { kind: "building", args: [ZONE.R, 1, 0] }, "zone residential (drag)"),
  row(2, "C", "2", "Commercial", { kind: "zone", zone: ZONE.C }, { kind: "building", args: [ZONE.C, 1, 0] }, "zone commercial (drag)"),
  row(3, "I", "3", "Industrial", { kind: "zone", zone: ZONE.I }, { kind: "building", args: [ZONE.I, 1, 0] }, "zone industrial (drag)"),
  row(4, "M", "4", "Meat", { kind: "zone", zone: ZONE.M }, { kind: "building", args: [ZONE.M, 1, 0] }, "zone meat market (drag) — grey, off the books"),
  row(5, "road", "5", "Road", { kind: "road" }, { kind: "road", args: [5, false] }, "L-drag; Shift = straight; water makes a bridge; a square rail makes a crossing"),
  row(6, "wall", "6", "Wall", { kind: "wall" }, { kind: "wall", args: [5] }, "L-drag; Shift = straight; a road or rail through it is a tunnel"),
  row(7, "rail", "7", "Rail", { kind: "rail" }, { kind: "rail", args: [5] }, "L-drag; Shift = straight; a square road makes a crossing"),
  row(8, "station", "8", "Station", { kind: "station" }, { kind: "station", args: ["ns"] }, "click a plain rail tile; it is a door wherever a road comes within 3 tiles, and riders walk the forecourt"),
  row(9, "camera", "E", "Camera", { kind: "camera" }, { kind: "camera", args: [0] }, "L-drag along a street; needs a police station to do anything, and watches the lots the street serves"),
  row(10, "tree", "9", "Tree", { kind: "tree" }, { kind: "tree", args: ["round"] }, "plant trees (drag)"),
  row(11, "park", "0", "Park", { kind: "park" }, { kind: "civic", args: ["park"] }, "place a 1×1 park"),
  row(12, "zoo", "Z", "Zoo", { kind: "zoo" }, { kind: "civic", args: ["zoo"] }, "place a 2×2 zoo"),
  row(13, "centre", "V", "Pacification", { kind: "centre" }, { kind: "civic", args: ["centre"] }, "place a pacification centre"),
  row(14, "police", "P", "Police", { kind: "police" }, { kind: "civic", args: ["police"] }, "place a police station"),
  row(15, "fire", "F", "Fire station", { kind: "fire" }, { kind: "civic", args: ["fire"] }, "place a fire station"),
  row(16, "inspect", "I", "Inspect", { kind: "inspect" }, { kind: "overlay", args: ["cursor"] }, "pin a lot or citizen; left-drag pans"),
  row(17, "bulldoze", "B", "Bulldoze", { kind: "bulldoze" }, { kind: "ground", args: ["rubble"] }, "clear (drag); occupied lots cannot be undone"),
]);

export const TOOL_BY_ID = Object.freeze(Object.fromEntries(TOOLS.map((tool) => [tool.id, tool])));
export const TOOL_BY_KEY = Object.freeze(Object.fromEntries(TOOLS.map((tool) => [tool.key.toUpperCase(), tool])));
export const PLACE_TOOLS = Object.freeze(TOOLS.filter((tool) => ["station", "park", "zoo", "centre", "police", "fire"].includes(tool.op.kind)).map((tool) => tool.id));

/** Resolve a concrete op back to the registry row that names it. */
export function toolForOp(op) {
  if (!op) return null;
  if (op.kind === "zone") return TOOLS.find((tool) => tool.op.kind === "zone" && tool.op.zone === op.zone) || null;
  return TOOLS.find((tool) => tool.op.kind === op.kind) || null;
}

export function labelForOp(op) {
  return toolForOp(op)?.label || (op?.kind === "use" ? "Use" : String(op?.kind || "Tool"));
}

/** Resolve a registry sprite through the public art API. */
export function spriteForTool(art, toolOrId) {
  const tool = typeof toolOrId === "string" ? TOOL_BY_ID[toolOrId] : toolOrId;
  if (!tool || typeof art?.[tool.sprite.kind] !== "function") throw new Error(`tool sprite: cannot resolve '${tool?.id || toolOrId}'`);
  return art[tool.sprite.kind](...tool.sprite.args);
}

/** The build part of the footer is generated from the registry, never copied. */
export function toolHelp() {
  return TOOLS.map((tool) => `${tool.key} ${tool.label}`).join(" · ");
}
