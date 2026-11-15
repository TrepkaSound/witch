// The pause page's Frame check (Ed, 2026-11-15: "And have 8 be a button on the right side pause menu"; app/frameCheck.ts has what
// it measures). The button opens the frame check's own page (?framecheck=1) in a frame over the paused game: a throwaway game on
// this machine's real renderer, her own game untouched behind it, exactly where she paused. When it's done the frame goes and the
// result is shown here as a small table a scene, the run before beside it, with a Copy button (plain text, for the coordinator).
// The last few results are kept on this browser (FRAME_CHECK_KEY), so a run before a release compares with one after.
import { button, h } from "./dom";
import { frameCheckHead, frameCheckHistory, frameCheckHref, frameCheckText, isFrameCheckMessage, keepFrameCheck, type FrameCheckResult, type FrameCheckSceneResult, type Spread } from "../app/frameCheck";

export interface FrameCheckPanelHost {
  /** The quality rung she's playing at now, to pin the check at: its number, or "off" with the ladder off (app/ladder.ts). */
  rung(): string;
  /** Whether her game is still paused: resumed under the check (the pad's back button reaches her page), the check stops. */
  paused(): boolean;
  /** Her page's own loop held while the check runs (and let go after): it draws nothing and logs no stalls of its own meanwhile. */
  hold(on: boolean): void;
  /** This browser's storage (null where refused) and the key the results are kept under. */
  store(): Storage | null;
  key: string;
}

const CSS = `
#frame-check { margin: 6px 0 4px; }
#frame-check .fc-head { color: #d6cfe6; font-size: 11px; white-space: pre-wrap; margin: 4px 0; }
#frame-check table { border-collapse: collapse; width: 100%; font-size: 11px; margin: 0 0 6px; }
#frame-check caption { text-align: left; font-weight: 700; color: var(--accent, #e8b46a); padding-top: 3px; }
#frame-check th, #frame-check td { text-align: right; padding: 0 3px; font-weight: 400; white-space: nowrap; }
#frame-check th:first-child, #frame-check td:first-child { text-align: left; }
#frame-check thead th { color: #d6cfe6; }
#frame-check .was { color: #b9b0cf; }
#frame-check-run { position: fixed; inset: 0; z-index: 2000; background: #07060f; }
#frame-check-run iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
#frame-check-run .bar { position: absolute; right: 12px; top: 12px; z-index: 1; }
#frame-check-run button { font: 13px ui-monospace, monospace; color: #e8e2f4; background: rgba(10,9,22,.86); border: 1px solid #3a2f5c; border-radius: 6px; padding: 6px 12px; cursor: pointer; }
`;

const ms = (x: number): string => (x >= 100 ? x.toFixed(0) : x.toFixed(1));
const count = (n: number): string => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : String(Math.round(n)));

/** A scene's table: frame, cpu and gpu by median, p95 and worst, and the run before's median and p95 beside. */
function sceneTable(s: FrameCheckSceneResult, was: FrameCheckSceneResult | undefined): HTMLTableElement {
  const sail = s.id.startsWith("sail-"); // (the sail's parts: as long as they take, not a fixed count)
  const row = (name: string, now: Spread | null, before: Spread | null | undefined) => h("tr", {},
    h("td", { text: name }), ...(now ? [ms(now.median), ms(now.p95), ms(now.worst)] : ["–", "–", "–"]).map(text => h("td", { text })),
    ...(was ? (before ? [ms(before.median), ms(before.p95)] : ["–", "–"]).map(text => h("td", { class: "was", text })) : []));
  return h("table", {},
    h("caption", { text: `${s.label} · ${count(s.draws)} draws · ${count(s.triangles)} tris${sail ? ` · ${s.frames} frames` : ""}` }),
    h("thead", {}, h("tr", {}, ...["ms", "median", "p95", "worst", ...(was ? ["was", "p95"] : [])].map(text => h("th", { text })))),
    h("tbody", {}, row("frame", s.frame, was?.frame), row("cpu", s.cpu, was?.cpu), row("gpu", s.gpu, was?.gpu)));
}

/** The button, its status line and the last result's tables, for the pause page's right pane. */
export function frameCheckPanel(host: FrameCheckPanelHost): HTMLElement {
  const style = document.createElement("style"); style.textContent = CSS; document.head.append(style);
  const status = h("div", { class: "status" }), results = h("div", {});
  let shown: { result: FrameCheckResult; prev: FrameCheckResult | null } | null = null;
  const paint = () => {
    const [result, prev = null] = frameCheckHistory(host.store(), host.key);
    results.replaceChildren();
    shown = result ? { result, prev } : null;
    if (!result) return;
    results.append(h("div", { class: "fc-head", text: [...frameCheckHead(result), ...(prev ? [`was: ${frameCheckHead(prev)[0].replace("Frame check ", "")}, rung ${prev.rung}`] : []), ...result.notes].join("\n") }));
    for (const s of result.scenes) results.append(sceneTable(s, prev?.scenes.find(q => q.id === s.id)));
    results.append(button("Copy", () => {
      if (!shown) return;
      const text = frameCheckText(shown.result, shown.prev), done = () => { status.textContent = "copied: the frame check's result, to paste to the coordinator"; };
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => window.prompt("Copy the frame check's result:", text)); else window.prompt("Copy the frame check's result:", text);
    }, { class: "copyall", title: "Copy this result (and the run before) as plain text, to paste to the coordinator" }));
  };
  let running: (() => void) | null = null;
  const run = (quick: boolean) => {
    if (running) return;
    const frame = h("iframe", { attrs: { src: frameCheckHref(location.href, host.rung(), quick), title: "Frame check", allow: "" } });
    const box = h("div", { id: "frame-check-run" }, frame, h("div", { class: "bar" }, button("Stop the frame check", () => end("stopped"))));
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.contentWindow || e.origin !== location.origin || !isFrameCheckMessage(e.data)) return;
      const m = e.data;
      if (m.kind === "done") { keepFrameCheck(host.store(), host.key, m.result); end("done: its result is below"); }
      else if (m.kind === "cancel") end("stopped");
      else if (m.kind === "error") end(`failed: ${m.text}`);
    };
    const watch = setInterval(() => { if (!host.paused()) end("stopped: the game was resumed"); }, 250);
    const end = (text: string) => { clearInterval(watch); window.removeEventListener("message", onMessage); box.remove(); running = null; host.hold(false); status.textContent = `Frame check ${text}`; paint(); };
    running = () => end("stopped");
    window.addEventListener("message", onMessage);
    frame.addEventListener("load", () => frame.contentWindow?.focus()); // (its keys are the check's: Esc there stops it, never resumes her game)
    document.body.append(box);
    host.hold(true);
    status.textContent = "Frame check running…";
  };
  const start = button("Frame check", e => run(e.shiftKey), { class: "copyall", title: "Measure frame time on this machine: about a minute and a half of fixed scenes (the decks, a flight, a fight, the treehouse, a sail) in a throwaway game (your own stays paused, untouched), then the milliseconds here to copy to the coordinator. Close other heavy tabs first. Shift-click: a half-second run of each scene" });
  paint();
  return h("div", { id: "frame-check" }, start, status, results);
}
