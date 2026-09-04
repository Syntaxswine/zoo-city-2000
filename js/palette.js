// palette.js — the left-hand build remote. DOM only; no sim state lives here.

import { TOOLS, spriteForTool } from "./tools.js";
import { paintSprite } from "./render.js";

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

  function setTool(id) {
    for (const [toolId, button] of buttons) {
      const active = toolId === id;
      button.classList.toggle("on", active);
      button.setAttribute("aria-pressed", String(active));
    }
  }

  setTool(app.input.tool);
  return { setTool, buttons };
}
