// The frame check (Ed, 2026-11-15, to the coordinator's "Check performance on a real machine. Builders measure on a software
// renderer, so costs creep in unnoticed. A frame-time check you can run on your own machine (one link that runs a fixed scene and
// reports milliseconds) would catch it": "And have 8 be a button on the right side pause menu"). The pause page's Frame check
// button, or the link ?framecheck=1: a throwaway game on the bench's seed and start (tools/bench/frames.cjs: seed 123,
// ?opening=old&creator=0) driven a frame at a time at a fixed 1/60 s through four fixed scenes, on this machine's real renderer at
// the player's settings and quality rung (held still for the run, so two runs compare), each drawn frame timed. Then the sail (Ed,
// 2026-11-15, asked whether to add the voyage between islands on the sea chart as a scene: "Yes"): the map table's chart opened,
// the nightly sail take-off check's island and seed sailed to (tools/stall/sail-takeoff.cjs), the dive, the wake-up and the take-off
// from the treehouse, on the page's own loop in real time (a sail waits on the night being made: it can't be stepped), a row a part.
// This file is its fixed data and its sums (the scenes, the statistics, the plain-text table, the last few results kept, the link);
// app/frameCheckRun.ts runs it on the page, ui/frameCheckPanel.ts is the pause page's button and tables.
import type { Controls } from "../rules/game";

/** The fixed step every frame takes (s), as the bench's. */
export const FRAME_CHECK_DT = 1 / 60;
/** Frames a scene: 10 s of play (the link's ?framecheck=quick: half a second, for the cloud's software renderer). */
export const FRAME_CHECK_FRAMES = 600, FRAME_CHECK_QUICK = 30;
/** What the link implies where it doesn't say: the bench's seed and start, the party spell waited for (the decks scene casts it). */
export const FRAME_CHECK_LINK = [["seed", "123"], ["opening", "old"], ["creator", "0"], ["spell", "wait"]] as const;
/** The sail's island and night: the nightly sail take-off check's (tools/stall/sail-takeoff.cjs: raven, seed 864794, by the map
 *  table's chart with "sail anywhere" on, the dive path), so its take-off is the one that check guards. */
export const FRAME_CHECK_SAIL = { island: "raven", seed: 864794, table: "mapTable" } as const;
/** How many results are kept (the newest first). */
export const FRAME_CHECK_KEEP = 5;

const idle: Controls = { moveX: 0, moveZ: 0, toggleMode: false, zoom: 0 };

export interface FrameCheckScene {
  id: string;
  /** For Ed: what it shows. */
  label: string;
  /** How it lines up with the bench (tools/bench/frames.cjs). */
  bench: string;
  /** Put in place before its frames: a debug arena (window.witch.arena) or a quick shot's scene (window.witch.shot). */
  arena?: string;
  shot?: string;
  /** The sail: not stepped but run on the page's own loop (app/frameCheckRun.ts runSail), its parts each a row (FRAME_CHECK_SAIL_PARTS). */
  sail?: true;
  controls(i: number): Controls;
}

export const FRAME_CHECK_SCENES: readonly FrameCheckScene[] = [
  { id: "decks", label: "party start at the decks", bench: "the bench's start (its booth scene), then the party spell cast at 1 s and the home ring booting",
    controls: i => ({ ...idle, castParty: i === 60 }) },
  { id: "ground-flight", label: "ground flight over the forest", bench: "the bench's ground-flight path, frame for frame (flown after the decks scene, not from the start)",
    controls: i => ({ moveX: Math.cos(Math.floor(i / 150) * 1.4), moveZ: -Math.abs(Math.sin(Math.floor(i / 150) * 1.4)), toggleMode: false, zoom: 0 }) },
  { id: "wave-fight", label: "wave fight: a pack, spells, glows and shot marks", bench: "the quick bench's wave-fight arena (wolf*3@2,boar*2@1), its walk-in, wave and circle; 10 s not 5, and she casts every 3/4 s",
    arena: "wolf*3@2,boar*2@1",
    controls: i => (i < 30 ? { ...idle, moveZ: 1 } : { moveX: Math.cos((i - 30) / 40), moveZ: Math.sin((i - 30) / 40), toggleMode: false, zoom: 0, nextWave: i === 30, spell: i % 45 === 0 }) },
  { id: "treehouse", label: "the treehouse (the parlour)", bench: "the quick shot's room:parlour, a slow walk round; no bench scene times the house",
    shot: "room:parlour",
    controls: i => ({ ...idle, moveX: 0.5 * Math.cos(i / 90), moveZ: 0.5 * Math.sin(i / 90) }) },
  { id: "sail", label: "the sail: the sea chart, its flight, the dive, the take-off", bench: "the nightly sail take-off check's voyage (tools/stall/sail-takeoff.cjs: the map table's chart to raven, seed 864794), from this game's home (seed 123, not its 81808); no bench scene times a sail",
    sail: true, controls: () => idle },
];
/** The sail's parts, each a row of the result (their ids as a scene's): in real time on the page's own loop, so `frames` differs a
 *  run (the flight waits for the next night to be made, the bedroom for the house). */
export const FRAME_CHECK_SAIL_PARTS = [
  { id: "sail-chart", label: "sail: the sea chart open at the map table" },
  { id: "sail-flight", label: "sail: the chart's flight to the island (the next night made under it)" },
  { id: "sail-dive", label: "sail: the dive down to her bed" },
  { id: "sail-bedroom", label: "sail: woken in the bedroom, the house and forest still building" },
  { id: "sail-takeoff", label: "sail: the take-off from the treehouse to the treetops" },
] as const;

/** A list of milliseconds, summed up. */
export interface Spread { median: number; p95: number; worst: number }
export interface FrameCheckSceneResult {
  id: string; label: string; frames: number;
  /** Frame to frame, as shown (ms): never under the screen's refresh. */
  frame: Spread;
  /** The frame's own work on the CPU (ms): the rules' step and the view's, up to handing the frame to the GPU; null for the sail's
   *  parts (the page's own loop runs them: only the frames are timed). */
  cpu: Spread | null;
  /** The GPU's time drawing it (ms), null where the browser can't time the GPU. */
  gpu: Spread | null;
  /** Draw calls and triangles a frame (medians). */
  draws: number; triangles: number;
}
export interface FrameCheckResult {
  v: 1;
  build: string;
  /** When it ran (ISO, UTC). */
  date: string;
  /** The GPU's name as the browser gives it ("" where it doesn't). */
  gpu: string;
  /** The canvas drawn (pixels) and the screen's pixel ratio. */
  canvas: string;
  /** The quality ladder's rung it ran at, held for the run (app/ladder.ts), and its words. */
  rung: number; quality: string;
  /** Frames a scene. */
  frames: number;
  scenes: FrameCheckSceneResult[];
  /** What went wrong in a scene, if anything (a scene that couldn't be set up is left out). */
  notes: string[];
}

const r2 = (x: number): number => Math.round(x * 100) / 100;
/** The median, the 95th percentile and the worst of `xs` (ms, to 0.01), all 0 for none. */
export function spread(xs: readonly number[]): Spread {
  if (!xs.length) return { median: 0, p95: 0, worst: 0 };
  const s = [...xs].sort((a, b) => a - b), at = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { median: r2(at(0.5)), p95: r2(at(0.95)), worst: r2(s[s.length - 1]) };
}
export const median = (xs: readonly number[]): number => spread(xs).median;

/** The link's frame check: null without it, else the frames a scene. Its value is words with commas: "1" (or nothing else) the
 *  full run, "quick" the short one, a scene's id to run only the scenes named (framecheck=quick,sail: as the bench's ONLY=), and
 *  "left" (FRAME_CHECK_LEFT: the check's page loaded anew, never by hand). */
export function frameCheckFrames(params: URLSearchParams): number | null {
  const v = params.get("framecheck");
  if (v === null || v === "0") return null;
  return v.split(",").includes("quick") ? FRAME_CHECK_QUICK : FRAME_CHECK_FRAMES;
}
/** The scenes the link asks for (all of them if it names none). */
export function frameCheckScenes(params: URLSearchParams): readonly FrameCheckScene[] {
  const words = (params.get("framecheck") ?? "").split(","), named = FRAME_CHECK_SCENES.filter(s => words.includes(s.id));
  return named.length ? named : FRAME_CHECK_SCENES;
}
/** The word a frame check's page carries if it is ever loaded anew (a sail in place gone wrong falls back to loading the island's
 *  link: platform/storageScope.ts freshHref puts this on it), so the page it lands on is still the check's (its storage, never her
 *  saved game's) and says what happened instead of playing. */
export const FRAME_CHECK_LEFT = "left";
export const frameCheckLeft = (params: URLSearchParams): boolean => (params.get("framecheck") ?? "").split(",").includes(FRAME_CHECK_LEFT);
/** The switches a frame check implies, set where the link doesn't say (the rest of the link is kept). */
export function frameCheckParams(params: URLSearchParams): void {
  if (frameCheckFrames(params) === null) return;
  for (const [k, v] of FRAME_CHECK_LINK) if (!params.has(k)) params.set(k, v);
}
/** The frame check's link from the paused game's: its own page, the quality rung she's playing at pinned ("off": the ladder off),
 *  and the pause page's slider choices carried (d_<id>: her real settings); nothing else of her link (its island, its debug switches). */
export function frameCheckHref(href: string, rung: string, quick = false): string {
  const from = new URL(href), to = new URL(from.pathname, from);
  to.searchParams.set("framecheck", quick ? "quick" : "1");
  to.searchParams.set("ladder", rung);
  for (const [k, v] of from.searchParams) if (k.startsWith("d_")) to.searchParams.set(k, v);
  return to.toString();
}

const ms = (x: number): string => (x >= 100 ? x.toFixed(0) : x.toFixed(1));
const three = (s: Spread | null): string => (s ? `${ms(s.median)} / ${ms(s.p95)} / ${ms(s.worst)}` : "not timed");
const count = (n: number): string => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : String(Math.round(n)));
/** A result's first lines: the build and when, the machine and the rung. */
export function frameCheckHead(r: FrameCheckResult): string[] {
  return [`Frame check ${r.build} · ${r.date.slice(0, 16).replace("T", " ")} UTC`, `GPU: ${r.gpu || "not named by the browser"}`, `${r.canvas} · rung ${r.rung} (${r.quality}) · ${r.frames} frames a scene`];
}
/** The result as plain text, to paste to the coordinator; `prev`, the run before, as a line under each scene. */
export function frameCheckText(r: FrameCheckResult, prev?: FrameCheckResult | null): string {
  const out = [...frameCheckHead(r), "ms as median / p95 / worst"];
  const line = (s: FrameCheckSceneResult) => `frame ${three(s.frame)} · cpu ${three(s.cpu)} · gpu ${three(s.gpu)} · ${count(s.draws)} draws · ${count(s.triangles)} tris${s.frames !== r.frames ? ` · ${s.frames} frames` : ""}`;
  for (const s of r.scenes) {
    out.push(`${s.id}: ${line(s)}`);
    const p = prev?.scenes.find(q => q.id === s.id);
    if (p) out.push(`  was (${prev!.build}): ${line(p)}`);
  }
  if (prev) out.push(`previous run: ${frameCheckHead(prev).join(" · ")}`);
  for (const n of r.notes) out.push(`note: ${n}`);
  return out.join("\n");
}

const isResult = (x: unknown): x is FrameCheckResult => !!x && typeof x === "object" && (x as FrameCheckResult).v === 1 && Array.isArray((x as FrameCheckResult).scenes) && typeof (x as FrameCheckResult).build === "string";
/** The results kept on this browser, newest first (none on anything unreadable). */
export function frameCheckHistory(store: Pick<Storage, "getItem"> | null, key: string): FrameCheckResult[] {
  try { const v: unknown = JSON.parse(store?.getItem(key) ?? "[]"); return Array.isArray(v) ? v.filter(isResult).slice(0, FRAME_CHECK_KEEP) : []; } catch { return []; }
}
/** `r` kept as the newest (the same run kept once); the list as it now stands. */
export function keepFrameCheck(store: Pick<Storage, "getItem" | "setItem"> | null, key: string, r: FrameCheckResult): FrameCheckResult[] {
  const list = [r, ...frameCheckHistory(store, key).filter(q => q.date !== r.date)].slice(0, FRAME_CHECK_KEEP);
  try { store?.setItem(key, JSON.stringify(list)); } catch { /* (storage off: this page's only) */ }
  return list;
}

/** What the frame check's page tells the page that opened it (the pause page's frame over the game), by postMessage. */
export type FrameCheckMessage =
  | { witch: "framecheck"; kind: "progress"; text: string }
  | { witch: "framecheck"; kind: "done"; result: FrameCheckResult }
  | { witch: "framecheck"; kind: "cancel" }
  | { witch: "framecheck"; kind: "error"; text: string };
export const isFrameCheckMessage = (x: unknown): x is FrameCheckMessage => !!x && typeof x === "object" && (x as { witch?: unknown }).witch === "framecheck";

/** The frame check's page keeps every key from its game (the scenes' controls are fixed; Esc would open its own pause page): put on
 *  the window before the game's own key listeners (main.ts, as the link is read), Esc going to `onEscape` (the run's: it stops). */
export const frameCheckKeys: { onEscape: (() => void) | null; own: boolean } = { onEscape: null, own: false };
export function holdFrameCheckKeys(target: Pick<Window, "addEventListener">): void {
  for (const type of ["keydown", "keyup"] as const) target.addEventListener(type, e => {
    if (frameCheckKeys.own) return; // (the check's own press, for the sail: pressFrameCheckKey)
    e.stopImmediatePropagation();
    if (type === "keydown" && e.key === "Escape") { e.preventDefault(); frameCheckKeys.onEscape?.(); }
  }, { capture: true });
}
/** A key pressed or let go by the check itself (the sail: Enter held on the chart, D to get up, Space to take off), let through to
 *  the game as a real one is. */
export function pressFrameCheckKey(target: Pick<Window, "dispatchEvent">, type: "keydown" | "keyup", code: string, key: string): void {
  frameCheckKeys.own = true;
  try { target.dispatchEvent(new KeyboardEvent(type, { code, key, bubbles: true, cancelable: true })); } finally { frameCheckKeys.own = false; }
}
/** No sound from the check's page, whatever the browser would allow it (the sail's own presses would count as her gesture): every
 *  audio context it makes is held suspended. */
export function quietFrameCheck(w: { AudioContext?: typeof AudioContext }): void {
  const AC = w.AudioContext;
  if (!AC) return;
  w.AudioContext = class extends AC {
    constructor(o?: AudioContextOptions) { super(o); void super.suspend().catch(() => undefined); }
    override resume(): Promise<void> { return Promise.resolve(); }
  };
}
