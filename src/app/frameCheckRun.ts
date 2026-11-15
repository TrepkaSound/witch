// The frame check on the page (app/frameCheck.ts has what it is and its scenes): under ?framecheck= the loop stands still
// (window.witch.manual) and this drives the game through the scenes with the tools' own hooks (window.witch.frame, .arena, .shot:
// what the bench drives), one frame per screen refresh, each frame drawn and timed. It is a game of its own: the page's storage is
// the frame check's (platform/storageScope.ts: her settings read, nothing of hers written), and no sound is started.
// The sail (runSail) is the one scene not stepped: the loop let go, the map table's chart opened and sailed from by the check's own
// key presses, and each refresh timed as the page's own loop flies the chart, makes the night, dives, wakes her and takes off.
import type { Controls } from "../rules/game";
import type { Tuning } from "../rules/tuning";
import type { FrameStats } from "../platform/frameStats";
import type { QualityLadder } from "./ladder";
import { RUNGS } from "../rules/ladder";
import { glRendererName } from "../platform/glRenderer";
import { FRAME_CHECK_KEY, localStore } from "../platform/storageScope";
import { SAIL_ANY } from "./chartView";
import { closeChart } from "../ui/chartOverlay";
import { FRAME_CHECK_DT, FRAME_CHECK_FRAMES, FRAME_CHECK_SAIL, FRAME_CHECK_SAIL_PARTS, FRAME_CHECK_SCENES, frameCheckHistory, frameCheckKeys, frameCheckText, keepFrameCheck, median, pressFrameCheckKey, spread, type FrameCheckMessage, type FrameCheckResult, type FrameCheckScene, type FrameCheckSceneResult } from "./frameCheck";

/** The hooks it drives (window.witch: app/hooks.ts). */
export interface FrameCheckHooks {
  readonly tuning: Tuning;
  readonly game: { seed: number; witch: { mode: string }; wake?: { open: boolean } | null };
  /** The sea chart over the night, as the map table opens it (window.witch.chart). */
  chart(table?: string): void;
  view: {
    stats: { drawCalls: number };
    renderer: { info: { render: { triangles: number } }; domElement: HTMLCanvasElement; getContext(): WebGLRenderingContext | WebGL2RenderingContext };
    assets: { whenIdle(urgentOnly?: boolean): Promise<void> };
  };
  frameStats: FrameStats;
  ladder?: QualityLadder;
  manual: boolean;
  frame(c: Controls, dt: number): { step: number; render: number };
  arena(spec: string): void;
  shot(scene: string): { ok: boolean; say: string } | undefined;
}

const idle: Controls = { moveX: 0, moveZ: 0, toggleMode: false, zoom: 0 };
const raf = (): Promise<number> => new Promise(r => requestAnimationFrame(r));
/** The art asked for is in, or `ms` have passed (a scene never waits for ever on a slow machine). */
const settled = (w: FrameCheckHooks, ms = 20000): Promise<void> => Promise.race([w.view.assets.whenIdle(), new Promise<void>(r => setTimeout(r, ms))]);

type RunOptions = { build: string; frames: number; scenes?: readonly FrameCheckScene[]; progress(text: string): void; cancelled(): boolean };
type Row = FrameCheckSceneResult;

/** Runs the scenes, `frames` frames each; `cancelled` is asked each frame. Resolves with the result (null if cancelled). */
export async function runFrameCheck(w: FrameCheckHooks, o: RunOptions): Promise<FrameCheckResult | null> {
  const fs = w.frameStats, L = w.ladder, notes: string[] = [], scenes: Row[] = [], list = o.scenes ?? FRAME_CHECK_SCENES;
  const rung = L?.state.mode === "off" ? 0 : L?.state.rung ?? 0, quality = `${RUNGS[rung]?.label ?? "?"}${L ? `, ladder ${L.current()}` : ""}`;
  const one = (c: Controls) => { L?.apply(w.tuning); fs.beginGpu(); const r = w.frame(c, FRAME_CHECK_DT); fs.endGpu(); return r.step + r.render; };
  await settled(w, 60000);
  for (const [k, s] of list.entries()) {
    o.progress(`Frame check: scene ${k + 1} of ${list.length}, ${s.label}`);
    if (s.sail) {
      let rows: Row[] | null = [];
      try { rows = await runSail(w, o, notes, text => o.progress(`Frame check: scene ${k + 1} of ${list.length}, ${text}`)); }
      catch (e) { notes.push(`sail stopped short: ${String(e)}`); }
      finally { w.manual = true; fs.onGpu = null; }
      if (!rows) return null;
      scenes.push(...rows);
      continue;
    }
    try {
      if (s.arena) w.arena(s.arena);
      if (s.shot) { const r = w.shot(s.shot); if (r && !r.ok) { notes.push(`${s.id} left out: ${r.say}`); continue; } }
    } catch (e) { notes.push(`${s.id} left out: ${String(e)}`); continue; }
    // (a few frames unmeasured, so the scene's own art is asked for and in, and its first-frame work isn't the scene's worst)
    const warm = Math.min(20, Math.ceil(o.frames / 3));
    for (let i = 0; i < warm; i++) { await raf(); one(idle); if (i === 0) await settled(w); }
    const frame: number[] = [], cpu: number[] = [], gpu: number[] = [], draws: number[] = [], tris: number[] = [];
    fs.onGpu = ms => gpu.push(ms);
    let last = await raf();
    one(s.controls(0));
    for (let i = 1; i <= o.frames; i++) {
      const now = await raf();
      if (o.cancelled()) { fs.onGpu = null; return null; }
      frame.push(now - last); last = now;
      if (i === o.frames) break; // (the last frame's time to the next refresh, with nothing more stepped)
      cpu.push(one(s.controls(i)));
      draws.push(w.view.stats.drawCalls); tris.push(w.view.renderer.info.render.triangles);
    }
    for (let i = 0; i < 4 && fs.timesGpu; i++) { await raf(); one(idle); } // (the last frames' GPU times come back a frame or two on)
    fs.onGpu = null;
    scenes.push({ id: s.id, label: s.label, frames: frame.length, frame: spread(frame), cpu: spread(cpu), gpu: gpu.length ? spread(gpu) : null, draws: median(draws), triangles: median(tris) });
  }
  if (!fs.timesGpu) notes.push("this browser doesn't time the GPU (no EXT_disjoint_timer_query_webgl2): frame and cpu only");
  const c = w.view.renderer.domElement, name = glRendererName(w.view.renderer.getContext());
  return { v: 1, build: o.build, date: new Date().toISOString(), gpu: typeof name === "string" ? name : "", canvas: `${innerWidth}x${innerHeight} window, ${c.width}x${c.height} canvas, pixel ratio ${Math.round(devicePixelRatio * 100) / 100}`,
    rung, quality, frames: o.frames, scenes, notes };
}

/** The chart over the night, as ui/chartOverlay.ts leaves it on the window for the tools. */
interface ChartHook {
  chart: { readonly flying: boolean; renderer: { info: { render: { calls: number; triangles: number } } } };
  choose(id: string): void;
  islands(): { id: string; outline?: unknown; sail?: unknown }[];
}
const chartHook = (): ChartHook | undefined => (document.getElementById("chart-overlay") ? (window as unknown as { chart?: ChartHook }).chart : undefined);
const marked = (name: string, since: number): boolean => performance.getEntriesByName(name).some(m => m.startTime >= since);

/** The sail (Ed, 2026-11-15, asked whether to add the voyage between islands on the sea chart as a scene: "Yes"), on the page's own
 *  loop in real time: the map table's chart opened over the night, FRAME_CHECK_SAIL's island chosen (its night's seed fixed: the
 *  chart draws it with Math.random, held for that one draw, as tools/stall/sail-takeoff.cjs holds it) and sailed to by Enter held;
 *  the chart's flight (the night made under it), the dive to her bed, D to get up, the house and forest waited for, then Space: the
 *  take-off to the treetops. Each part a row: every refresh timed, the draw calls and triangles the chart's own renderer's while it's
 *  up. A part that never ends (a short run's wait 40 min, for the cloud's software renderer; else 2 min) is noted and the rest left
 *  out. Its rows; null if cancelled. */
async function runSail(w: FrameCheckHooks, o: RunOptions, notes: string[], say: (text: string) => void): Promise<Row[] | null> {
  const fs = w.frameStats, S = FRAME_CHECK_SAIL, P = FRAME_CHECK_SAIL_PARTS, rows: Row[] = [], cap = o.frames < FRAME_CHECK_FRAMES ? 2400000 : 120000;
  const stats = () => { const c = chartHook()?.chart.renderer.info.render; return c ? { draws: c.calls, triangles: c.triangles } : { draws: w.view.stats.drawCalls, triangles: w.view.renderer.info.render.triangles }; };
  /** A part timed: a row; `until` asked after each refresh once `min` are in (true: done; "fail": given up); `ok` false on a give-up or the cap. */
  const timed = async (part: typeof P[number], min: number, until: (frames: number, ms: number) => boolean | "fail"): Promise<{ ok: boolean } | null> => {
    say(part.label);
    const frame: number[] = [], gpu: number[] = [], draws: number[] = [], tris: number[] = [], t0 = performance.now();
    fs.onGpu = ms => gpu.push(ms);
    let last = await raf(), ok = true;
    for (;;) {
      const now = await raf();
      if (o.cancelled()) { fs.onGpu = null; return null; }
      frame.push(now - last); last = now;
      const d = stats(); draws.push(d.draws); tris.push(d.triangles);
      const u = frame.length >= min ? until(frame.length, performance.now() - t0) : false;
      if (u === true) break;
      if (u === "fail" || performance.now() - t0 > cap) { ok = false; break; }
    }
    fs.onGpu = null;
    rows.push({ id: part.id, label: part.label, frames: frame.length, frame: spread(frame), cpu: null, gpu: gpu.length ? spread(gpu) : null, draws: median(draws), triangles: median(tris) });
    return { ok };
  };
  const key = (type: "keydown" | "keyup", code: string, k: string) => pressFrameCheckKey(window, type, code, k);
  const L = w.ladder;
  if (L && L.state.mode === "auto") L.choose(String(L.state.rung)); // (the page's own loop would move the rung: held where it is)
  try { localStore()?.setItem(SAIL_ANY, "1"); } catch { /* (kept in the page all the same: the check's storage) */ }
  const since = performance.now();
  w.manual = false;
  w.chart(S.table);
  const any = document.querySelector<HTMLElement>("#chart-overlay button.sail-any");
  if (any && any.getAttribute("aria-pressed") !== "true") any.click();
  const ready = () => { const i = chartHook()?.islands().find(q => q.id === S.island); return !!i?.outline && !!i.sail; };
  // 1. the chart, till the island's land has come and for half a scene at least
  let r = await timed(P[0], Math.ceil(o.frames / 2), ready);
  if (!r) return null;
  if (!r.ok) { notes.push(`sail: ${S.island} never came up on the chart to sail to; the rest of the sail left out`); closeChart(); return rows; }
  const random = Math.random;
  Math.random = () => (S.seed + 0.5) / 1e6;
  try { chartHook()?.choose(S.island); } finally { Math.random = random; }
  (document.activeElement as HTMLElement | null)?.blur?.();
  for (let i = 0; i < 5; i++) await raf();
  // 2. Enter held till the chart flies, then its flight to the hand-off (the chart gone, the night the island's)
  let flew = false;
  key("keydown", "Enter", "Enter");
  r = await timed(P[1], 1, (n, ms) => {
    if (!flew && chartHook()?.chart.flying) { flew = true; key("keyup", "Enter", "Enter"); }
    if (!flew) return ms > 10000 && n > 120 ? "fail" : false;
    return !document.getElementById("chart-overlay") && w.game.seed === S.seed;
  });
  if (!flew) key("keyup", "Enter", "Enter");
  if (!r) return null;
  if (!r.ok) { notes.push(flew ? `sail: the flight never handed over to ${S.island} (night seed ${w.game.seed}, wanted ${S.seed}); the rest left out` : "sail: the chart never flew (Enter held on the island); the rest left out"); rows.pop(); closeChart(); return rows; }
  // 3. the dive, till she's landed in her bed
  r = await timed(P[2], 1, () => marked("game:arrived", since));
  if (!r) return null;
  if (!r.ok) { notes.push("sail: the dive never landed; the wake-up and take-off left out"); return rows; }
  // 4. D pressed till she's up (pressed again each half second: her sleep lets every key go), then the house, forest and tufts waited for
  let up = false, down = false;
  r = await timed(P[3], Math.ceil(o.frames / 4), n => {
    if (!up) {
      if (w.game.wake?.open) { up = true; if (down) key("keyup", "KeyD", "d"); }
      else if (n % 30 === 1) { if (down) key("keyup", "KeyD", "d"); key("keydown", "KeyD", "d"); down = true; }
      return false;
    }
    return marked("landing:house-complete", since) && marked("witch:tufts-in", since);
  });
  if (down && !up) key("keyup", "KeyD", "d");
  if (!r) return null;
  if (!up) { notes.push("sail: she never got up from her bed; the take-off left out"); return rows; }
  if (!r.ok) notes.push("sail: took off before the house, forest and tufts were all built");
  // 5. Space: the take-off, to the treetops and a moment more
  let top = 0;
  key("keydown", "Space", " ");
  r = await timed(P[4], 2, n => {
    if (n === 2) key("keyup", "Space", " ");
    if (!top && w.game.witch.mode === "treetop") top = n;
    return !!top && n - top >= Math.ceil(o.frames / 10);
  });
  if (!r) return null;
  if (!r.ok) notes.push(`sail: she never reached the treetops (${w.game.witch.mode})`);
  return rows;
}

/** The page's own part under ?framecheck=: the game begun without a key press (`begin`: play starts, no sound), Esc stopping it
 *  (its keys are held from the game since the link was read: frameCheck.ts holdFrameCheckKeys), the run, then the result: to the page that framed it (the pause page's button), or, the link opened
 *  by itself, kept with the last few and shown over the page as text with a Copy button; window.witch.frameCheck has it for tools. */
export async function bootFrameCheck(o: { build: string; frames: number; scenes?: readonly FrameCheckScene[]; left?: boolean; ready(): boolean; begin(): void }): Promise<void> {
  const hooks = (window as unknown as { witch: FrameCheckHooks & { frameCheck?: unknown } }).witch, framed = window.parent !== window;
  const state: { done: boolean; result: FrameCheckResult | null; text: string; error?: string } = { done: false, result: null, text: "" };
  hooks.frameCheck = state;
  const tell = (m: FrameCheckMessage) => { if (framed) window.parent.postMessage(m, location.origin); };
  let cancelled = false;
  frameCheckKeys.onEscape = () => { if (!state.done) { cancelled = true; tell({ witch: "framecheck", kind: "cancel" }); } };
  for (const type of ["pointerdown", "mousedown", "touchstart", "wheel"]) window.addEventListener(type, e => { if (!(e.target instanceof Element && e.target.closest("#framecheck-out"))) e.stopImmediatePropagation(); }, { capture: true });
  const out = document.createElement("div");
  out.id = "framecheck-out";
  out.style.cssText = "position:fixed;left:12px;top:12px;z-index:1000;max-width:calc(100vw - 24px);box-sizing:border-box;font:12px/1.4 ui-monospace,Menlo,Consolas,monospace;color:#f2ecfb;background:rgba(14,11,28,.86);border:1px solid #b89767;border-radius:6px;padding:6px 10px;white-space:pre-wrap";
  const say = (text: string) => { out.textContent = text; tell({ witch: "framecheck", kind: "progress", text }); };
  document.body.append(out);
  say("Frame check: loading its scene");
  // (a sail in place pushes the night's link and Back's guard: on this page they replace its one entry, so the tab's Back is as it was)
  try { history.pushState = (data, unused, url) => history.replaceState(data, unused, url); } catch { /* (the browser's own then) */ }
  try {
    // (loaded anew from a check's page: its sail fell back to loading the island's link. Nothing played, nothing of hers touched.)
    if (o.left) throw new Error("the sail went wrong and the page was loaded anew (the game's own fallback); nothing measured after it");
    while (!o.ready()) { await new Promise(r => setTimeout(r, 100)); if (cancelled) return; }
    hooks.manual = true;
    o.begin();
    const result = await runFrameCheck(hooks, { build: o.build, frames: o.frames, scenes: o.scenes, progress: say, cancelled: () => cancelled });
    if (!result) { state.done = true; say("Frame check: stopped"); return; }
    state.result = result; state.text = frameCheckText(result);
    if (framed) { out.remove(); tell({ witch: "framecheck", kind: "done", result }); }
    else {
      const prev = frameCheckHistory(localStore(), FRAME_CHECK_KEY)[0] ?? null, text = state.text = frameCheckText(result, prev);
      keepFrameCheck(localStore(), FRAME_CHECK_KEY, result);
      out.textContent = text + "\n";
      const copy = document.createElement("button");
      copy.type = "button"; copy.textContent = "Copy"; copy.style.cssText = "font:inherit;margin-top:4px;cursor:pointer";
      copy.addEventListener("click", () => { void navigator.clipboard?.writeText(text).then(() => { copy.textContent = "Copied"; }, () => { copy.textContent = "Couldn't copy: select the text"; }); });
      out.append(copy);
    }
  } catch (e) {
    state.error = String(e); say(`Frame check failed: ${state.error}`); tell({ witch: "framecheck", kind: "error", text: state.error });
    console.error("frame check", e);
  } finally { state.done = true; }
}
