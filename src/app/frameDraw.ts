// One frame drawn: the view's render, its time and its parts added to the frame's measures (an exception kept, its parts counted).
import type { PageHost } from "../main";

export function drawFrame(pageHost: PageHost, time: number, repaintHeld = false): void {
  const start = performance.now(), previousParts = pageHost.view.ms;
  try { pageHost.view.render(time, true, repaintHeld); }
  finally {
    pageHost.measuredDraw = (pageHost.measuredDraw ?? 0) + performance.now() - start;
    if (pageHost.view.ms !== previousParts) for (const [name, ms] of Object.entries(pageHost.view.ms)) pageHost.measuredParts[`draw.${name}`] = (pageHost.measuredParts[`draw.${name}`] ?? 0) + ms;
  }
}
