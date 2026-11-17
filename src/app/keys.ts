// The page's own keys and buttons outside the game's controls (platform/input.ts): the touch wave buttons and the touch
// controls, the metre rulers (G, the debug button, or ?debug), the minimap (M) and the action bar (H).
import type { View } from "../render/view";
import type { Input } from "../platform/input";
import { setupTouch } from "../ui/touch";
import { bindings } from "../platform/bindings";
import { commandsOn } from "../rules/skill/profile";
import type { Tuning } from "../rules/tuning";

/** The command layout follows the tuning, not the link alone (commands.on, on by default: Ed, 2026-11-17, "Put the switches on by
 *  default and then publish"; "square as command, and circle as pickup/place"): the bindings' defaults (the pad's square commands,
 *  circle uses, only L2 dodges; the controls lists show them) and touch's cmd button. Off (?commands=0), the old bindings exactly. */
export function commandLayout(tuning: Tuning): void {
  const on = commandsOn(tuning), cm = typeof document !== "undefined" ? document.getElementById("command") : null;
  bindings.setCommandLayout(on);
  if (cm) cm.style.display = on ? "" : "none";
}

export function setupDebugKeys(view: View, input: Input, params: URLSearchParams, tuning: Tuning): void {
  document.getElementById("next-wave")!.addEventListener("pointerdown", e => { e.preventDefault(); input.touch.nextWave = true; });
  document.getElementById("pause-waves")!.addEventListener("pointerdown", e => { e.preventDefault(); input.touch.pauseWaves = true; });
  setupTouch(document.body, input.touch);
  commandLayout(tuning);

  // Metre rulers and a ground grid: G, the debug button, or on with ?debug.
  view.rulers.on = params.has("debug");
  const toggleRulers = () => { view.rulers.on = !view.rulers.on; };
  window.addEventListener("keydown", e => { if (e.code === "KeyG" && !e.repeat) toggleRulers(); });
  // M: the debug minimap (the party's spread: woken areas, the next to wake, the candidates).
  window.addEventListener("keydown", e => { if (e.code === "KeyM" && !e.repeat) view.minimap.on = !view.minimap.on; });
  document.getElementById("rulers")!.addEventListener("pointerdown", e => { e.preventDefault(); toggleRulers(); });
}
