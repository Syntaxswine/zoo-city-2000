// palette.js — the left-hand build remote. DOM only; no sim state lives here.

import { lockedReason, chapterOf } from "./sim/progression.js";
import { TOOLS } from "./tools.js";
import { KNOBS } from "./sim/rules.js";
import { hasPolice } from "./sim/police-actions.js";

import { remoteIcon } from "./remote-icons.js";
const PURPOSE = {
  R: "Homes for villagers.", C: "Shops and commercial jobs.", I: "Industrial jobs; produces pollution.", M: "Meat supply and jobs; spreads dread and attracts crime.",
  road: "Connects homes, jobs and public services.", wall: "Blocks passage and service coverage except through road or rail tunnels.", rail: "Carries commuters and freight between stations.",
  tree: "Reduces nearby pollution.", park: "Improves nearby land value and raises city capacity; no road required.", largePark: "Raises city capacity and nearby land value; no workers.",
  zoo: "Holds sentenced citizens in prison.", centre: "Treats sentenced citizens, permanently preventing their reproduction and killings.",
  police: "Reduces nearby crime and enables citywide investigations.", fire: "Reduces fire risk, limits spread and can save burning buildings.",
  farm: "Must lie within three tiles of edge-connected river water; ponds do not qualify. Flooding or lost road access stops food production.",
  doctor: "Covered homes receive +2% natural lifespan. Any operating medical facility removes the citywide −3% lifespan penalty. Needs road access and a dry, unburned footprint to operate.",
  hospital: "Covered homes receive +3% natural lifespan; overlapping care does not stack. Any operating medical facility removes the citywide −3% penalty. Needs road access and a dry, unburned footprint to operate.",
  sanitation: "Treats sewage; needs road access and a dry, unburned footprint to operate.", garbage: "Collects refuse and clears accumulated waste; needs road access and a dry, unburned footprint to operate.",
};

export function toolTooltip(world, tool) {
  const zone = tool.op.kind === "zone";
  const cost = KNOBS.COST[zone ? `zone${tool.id}` : tool.id];
  const perTile = zone || ["road", "rail", "wall", "tree", "camera", "bulldoze"].includes(tool.id);
  let price = cost == null ? "Free" : `§${cost.toLocaleString("en-US")}${perTile ? " per tile" : " to build"}`;
  if (tool.id === "road") price += `; bridges §${KNOBS.COST.bridge}/tile`;
  if (tool.id === "rail") price += `; rail bridges §${KNOBS.COST.railBridge}/tile`;
  if (tool.id === "bulldoze") price += `; trees §${KNOBS.COST.bulldozeTree}/tile; occupied demolition cannot be undone`;
  else if (cost != null) price += "; clearing costs extra where needed";
  const needs = zone ? ` Requires road access within ${KNOBS.ROAD_REACH} tiles; buildings grow when demand permits.` : "";
  const locked = lockedReason(world, { ...tool.op, density: 1 });
  return `${tool.label} · Hotkey ${tool.key}\n${price}\n${tool.hint}${needs}${PURPOSE[tool.id] ? `\n${PURPOSE[tool.id]}` : ""}${locked ? `\n🔒 ${locked}` : ""}`;
}

export function createPalette(app) {
  const host = document.getElementById("palette");
  if (!host) throw new Error("palette: #palette is missing");
  host.innerHTML = "";
  const heading = document.createElement("h2");
  heading.textContent = "ZOO CITY";
  const grid = document.createElement("div");
  grid.className = "palette-grid";
  host.append(heading, grid);

  const buttons = new Map();
  const preview = (tool) => {
    const p = app.input.previewTool(tool.id);
    app.ui.setCost(p.text, p.refused);
  };
  const restore = () => app.input.refreshCost();

  for (const tool of TOOLS) {
    let hovered = false, focused = false;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "palette-tool";
    button.dataset.tool = tool.id;
    button.title = toolTooltip(app.world, tool);
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-describedby", "cost");
    button.setAttribute("aria-pressed", "false");

    const icon = document.createElement("span");
    icon.className = "palette-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = remoteIcon(tool.id);
    button.append(icon);

    button.addEventListener("click", () => {
      if (lockedReason(app.world, { ...tool.op, density: 1 })) return;
      app.input.setTool(tool.id); preview(tool);
    });
    button.addEventListener("pointerenter", () => { hovered = true; preview(tool); });
    button.addEventListener("pointerleave", () => { hovered = false; if (!focused) restore(); });
    button.addEventListener("focus", () => { focused = true; preview(tool); });
    button.addEventListener("blur", () => { focused = false; if (!hovered) restore(); });
    grid.append(button);
    buttons.set(tool.id, button);
  }

  const police = document.createElement("div");
  police.className = "police-actions";
  const policeHeading = document.createElement("h2");
  policeHeading.textContent = "Police";
  const actions = document.createElement("div");
  actions.className = "palette-grid";
  const hint = document.createElement("p");
  hint.className = "note";
  hint.textContent = "Inspect a citizen, then Interview or Collect.";
  for (const [kind, label, description] of [
    ["interview", "Interview", "Interrogate the selected citizen: 90% catch chance for an unresolved crime; 5% wrongful collection for an innocent citizen. Once per month."],
    ["collect", "Collect", "Collect the selected citizen: 60% normal sentence, 20% harsher, 10% lighter, 10% meat hall. No undo."],
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "palette-tool";
    button.dataset.action = kind;
    const icon = document.createElement("span");
    icon.className = "palette-icon"; icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = remoteIcon(kind);
    button.append(icon);
    button.title = `${label} · Hotkey: none\nFree · Requires a police station and a selected citizen.\n${description}`;
    button.setAttribute("aria-label", button.title);
    button.addEventListener("click", () => {
      if (app.ui.modalOpen()) return;
      const citizenId = app.input.state.pinnedCitizen;
      if (citizenId == null) {
        app.input.setTool("inspect");
        app.ui.flash("Click a citizen to select them, then press Interview or Collect.");
        return;
      }
      app.doOp({ kind, citizenId });
    });
    actions.append(button);
  }
  police.append(policeHeading, actions, hint);
  host.append(police);
  const refresh = () => {
    police.hidden = !hasPolice(app.world);
    for (const tool of TOOLS) {
      const button = buttons.get(tool.id);
      const reason = lockedReason(app.world, { ...tool.op, density: 1 });
      // Keep locked controls focusable so their names and unlock requirements remain readable.
      button.setAttribute("aria-disabled", String(!!reason));
      button.classList.toggle("locked", !!reason);
      button.title = toolTooltip(app.world, tool);
      button.setAttribute("aria-label", button.title);
    }
    if (chapterOf(app.world) < 2 && app.input.density > 1) app.input.setTool("R");
  };

  function setTool(id) {
    for (const [toolId, button] of buttons) {
      const active = toolId === id;
      button.classList.toggle("on", active);
      button.setAttribute("aria-pressed", String(active));
    }
  }

  setTool(app.input.tool);
  refresh();
  return { setTool, buttons, refresh };
}
