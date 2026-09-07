// palette.js — the left-hand build remote. DOM only; no sim state lives here.

import { TOOLS, spriteForTool } from "./tools.js";
import { paintSprite } from "./render.js";
import { hasPolice } from "./sim/police-actions.js";

const fit = (canvas, sprite) => {
  const scale = Math.min(34 / sprite.w, 28 / sprite.h, 1);
  canvas.style.width = `${Math.max(1, Math.floor(sprite.w * scale))}px`;
  canvas.style.height = `${Math.max(1, Math.floor(sprite.h * scale))}px`;
};

export function createPalette(app) {
  const host = document.getElementById("palette");
  if (!host) throw new Error("palette: #palette is missing");
  host.innerHTML = "";
  const heading = document.createElement("h2");
  heading.textContent = "Build";
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
    button.title = `${tool.key}: ${tool.hint}`;
    button.setAttribute("aria-label", `${tool.label}, key ${tool.key}. ${tool.hint}`);
    button.setAttribute("aria-describedby", "cost");
    button.setAttribute("aria-pressed", "false");

    const icon = document.createElement("span");
    icon.className = "palette-icon";
    const canvas = document.createElement("canvas");
    canvas.className = "tool-sprite";
    canvas.setAttribute("aria-hidden", "true");
    const sprite = spriteForTool(app.art, tool);
    paintSprite(canvas, sprite, 1);
    fit(canvas, sprite);
    icon.append(canvas);

    const copy = document.createElement("span");
    copy.className = "palette-copy";
    const label = document.createElement("span");
    label.className = "palette-label";
    label.textContent = tool.label;
    const key = document.createElement("span");
    key.className = "palette-key";
    key.textContent = tool.key;
    copy.append(label, key);
    button.append(icon, copy);

    button.addEventListener("click", () => { app.input.setTool(tool.id); preview(tool); });
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
    button.textContent = label;
    button.title = description;
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
  const refresh = () => { police.hidden = !hasPolice(app.world); };

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
