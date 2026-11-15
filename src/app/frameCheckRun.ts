// The frame check on the page (app/frameCheck.ts has what it is and its scenes): under ?framecheck= the loop stands still
// (window.witch.manual) and this drives the game through the scenes with the tools' own hooks (window.witch.frame, .arena, .shot:
// what the bench drives), one frame per screen refresh, each frame drawn and timed. It is a game of its own: the page's storage is
// the frame check's (platform/storageScope.ts: her settings read, nothing of hers written), and no sound is started.
import type { Controls } from "../rules/game";
import type { Tuning } from "../rules/tuning";
import type { FrameStats } from "../platform/frameStats";
import type { QualityLadder } from "./ladder";
import { RUNGS } from "../rules/ladder";
import { glRendererName } from "../platform/glRenderer";
import { FRAME_CHECK_KEY, localStore } from "../platform/storageScope";
import { FRAME_CHECK_DT, FRAME_CHECK_SCENES, frameCheckHistory, frameCheckKeys, frameCheckText, keepFrameCheck, median, spread, type FrameCheckMessage, type FrameCheckResult } from "./frameCheck";

/** The hooks it drives (window.witch: app/hooks.ts). */
export interface FrameCheckHooks {
  readonly tuning: Tuning;
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

/** Runs the scenes, `frames` frames each; `cancelled` is asked each frame. Resolves with the result (null if cancelled). */
export async function runFrameCheck(w: FrameCheckHooks, o: { build: string; frames: number; progress(text: string): void; cancelled(): boolean }): Promise<FrameCheckResult | null> {
  const fs = w.frameStats, L = w.ladder, notes: string[] = [], scenes: FrameCheckResult["scenes"] = [];
  const one = (c: Controls) => { L?.apply(w.tuning); fs.beginGpu(); const r = w.frame(c, FRAME_CHECK_DT); fs.endGpu(); return r.step + r.render; };
  await settled(w, 60000);
  for (const [k, s] of FRAME_CHECK_SCENES.entries()) {
    o.progress(`Frame check: scene ${k + 1} of ${FRAME_CHECK_SCENES.length}, ${s.label}`);
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
  const c = w.view.renderer.domElement, rung = L?.state.mode === "off" ? 0 : L?.state.rung ?? 0, name = glRendererName(w.view.renderer.getContext());
  return { v: 1, build: o.build, date: new Date().toISOString(), gpu: typeof name === "string" ? name : "", canvas: `${c.width}x${c.height} canvas, pixel ratio ${Math.round(devicePixelRatio * 100) / 100}`,
    rung, quality: `${RUNGS[rung]?.label ?? "?"}${L ? `, ladder ${L.current()}` : ""}`, frames: o.frames, scenes, notes };
}

/** The page's own part under ?framecheck=: the game begun without a key press (`begin`: play starts, no sound), Esc stopping it
 *  (its keys are held from the game since the link was read: frameCheck.ts holdFrameCheckKeys), the run, then the result: to the page that framed it (the pause page's button), or, the link opened
 *  by itself, kept with the last few and shown over the page as text with a Copy button; window.witch.frameCheck has it for tools. */
export async function bootFrameCheck(o: { build: string; frames: number; ready(): boolean; begin(): void }): Promise<void> {
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
  try {
    while (!o.ready()) { await new Promise(r => setTimeout(r, 100)); if (cancelled) return; }
    hooks.manual = true;
    o.begin();
    const result = await runFrameCheck(hooks, { build: o.build, frames: o.frames, progress: say, cancelled: () => cancelled });
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
