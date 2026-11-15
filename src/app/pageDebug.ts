// Debug and the tools: what the playtest log's samples read, the debug overlay's buttons, the decisions panel and window.witch.
import type { PageHost } from "../main";
import { chartOverNight, chartWorldArg, sailFromChart, start } from "./pageNight";
import { lendFind, startDream, stepGuide } from "./pageFinds";
import { soloDiagnostic } from "./soloDiagnostic";

import { chartOpen } from "../ui/chartOverlay";
import { wakeInBedroom } from "../rules/opening";
import { startWake } from "../rules/wakeUp";
import { areaUnderWitch } from "../rules/game";
import { compareKey, rendererOf, sceneMode } from "./compareKey";



import { HOUSE_ROOMS, addFloorHat, objectFront, roomAt, fromObject } from "../rules/houseRooms";
import { remoteBodyBatch } from "../platform/online/otherWitches";
import { FIND_KINDS, type FindKindId } from "../rules/finds";
import { lend } from "./loan";
import { GUIDANCE_HOOKS } from "../rules/guidance";
import { freshHref } from "../platform/storageScope";
import { installHooks } from "./hooks";
import { gpuSample } from "../render/view/gpuBudget";
import { endNight, startNight } from "./night";
import { sailHref } from "./sail";
import type { FlightEnd } from "../render/chart/seaChart";
import { observePlaytestErrors } from "../platform/playtestLog";
import { recordedStep, recordingFor } from "./recordingHooks";
import { sceneryListing, scopeMissing } from "../render/view/scenery";
import type { View } from "../render/view";
import type { Night } from "./night";
import type { StallLog } from "../platform/stallLog";
import { SPRITE_UNIFORMS } from "../render/sprites";
import { debugText, machineLines, precisionLines, reproLine, reproQuery, reproState, tuningDiff } from "./repro";
import { currentValue, DECISION_LIST, valuesText } from "../ui/decisions";
import { powerLines } from "./hud";

export function decidePanel(pageHost: PageHost, open: boolean): void {
  if (pageHost.decide || pageHost.decideLoading) return;
  pageHost.decideLoading = true;
  void import("../ui/decide").then(({ DecidePanel }) => { pageHost.decide = new DecidePanel({ mutate: pageHost.tuningMutation, get tuning() { return pageHost.phone.preferences(pageHost.N().game); }, get seed() { return pageHost.N().game.seed; }, version: pageHost.BUILD, live: pageHost.knobLive }, open); });
}

export function keyNow(pageHost: PageHost, spot?: string): ReturnType<typeof compareKey> { return compareKey({ build: pageHost.BUILD, game: pageHost.N().game, canvas: pageHost.canvas, window: { width: innerWidth, height: innerHeight }, renderer: rendererOf(pageHost.view.renderer.getContext()), changed: pageHost.repro.changed(), params: pageHost.N().params, spot, dpr: devicePixelRatio, nav: navigator as Navigator & { deviceMemory?: number } }); }

/** Errors caught on the page go in the playtest comments' breadcrumbs. */
export function installErrorBreadcrumbs(pageHost: PageHost): void {
  observePlaytestErrors(error => pageHost.breadcrumbs.add(pageHost.N().game, "error", error));
}

/** The debug overlay's buttons: the finds' dev panel and "copy debug info". */
export function installDebugButtons(pageHost: PageHost): void {
  document.getElementById("finds-dev-btn")?.addEventListener("click", () => pageHost.findsPanel.toggle());
  document.getElementById("copy-debug")?.addEventListener("click", e => {
    const b = e.currentTarget as HTMLButtonElement, text = pageHost.repro.full();
    void navigator.clipboard?.writeText(text).then(() => { b.textContent = "copied"; }, () => { b.textContent = "copy failed: see console"; console.log(text); }).finally(() => setTimeout(() => { b.textContent = "copy debug info"; }, 1500));
  });
}

/** What each playtest log sample reads (app/night.ts's run: the boot night's, carried to the next night's as they are), and the GPU's trouble kept in it: a lost GL context reloads the night from its repro link. */
export function installPlaytestLog(pageHost: PageHost): void {
  pageHost.N().playtest.stalls = () => pageHost.stallLog.stalls;
  pageHost.N().playtest.debugInfo = () => ({ link: pageHost.repro.link(), machine: pageHost.repro.machine().map(l => l.slice(7)), changed: Object.fromEntries(pageHost.repro.changed()) });
  pageHost.N().playtest.comments = moments => pageHost.commentBook.all(moments);
  pageHost.N().playtest.commentStorage = () => pageHost.commentBook.status();
  pageHost.N().playtest.inputRecording = () => recordingFor(pageHost.N().game, pageHost.BUILD, pageHost.captureRecording).export();
  pageHost.N().playtest.debugText = () => pageHost.repro.full();
  pageHost.N().playtest.viewState = () => { const { game } = pageHost.N(), w = game.witch; return { x: Math.round(w.x), z: Math.round(w.z), mode: w.mode, area: areaUnderWitch(game), zoom: game.camera.zoomStep, timeScale: Math.round((game.timeScale ?? 1) * 100) / 100 }; };
  pageHost.N().playtest.keyState = () => keyNow(pageHost);
  pageHost.N().playtest.sceneState = () => sceneMode(pageHost.N().game);
  pageHost.N().playtest.gpuState = () => gpuSample(pageHost.view);
  pageHost.view.onGpuEvent = what => pageHost.N().playtest.gpuEvent(what, Math.round(pageHost.view.ledger.total / 1048576));
  pageHost.view.onContextRestored = () => {
    pageHost.N().playtest.gpuEvent("context restored: the night loaded again");
    const link = pageHost.repro.link();
    location.replace(freshHref(pageHost.N().params.has("debug") ? link : link.replace(/&debug$/, "")));
  };
  pageHost.N().playtest.frameState = () => {
    const r = pageHost.frameStats.recent(), pct = (a: number[], p: number) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))] * 10) / 10; };
    const S = pageHost.view.stats, { game } = pageHost.N(), w = game.witch;
    return { ms: pct(r.frames, 0.5) ?? 0, p95: pct(r.frames, 0.95) ?? 0, cpu: pct(r.cpu, 0.5) ?? 0, cpu95: pct(r.cpu, 0.95) ?? 0, gpu: pct(r.gpu, 0.5), gpu95: pct(r.gpu, 0.95), over20: r.frames.length ? Math.round((100 * r.frames.filter(x => x > 20).length) / r.frames.length) : 0, draws: S.drawCalls ?? 0, trees: S.trees, bushes: S.bushes, creatures: S.creatures, mode: w.mode, zoom: game.camera.zoomStep, rung: pageHost.ladder.state.rung, ladder: pageHost.ladder.state.mode };
  };
}

/** window.witch (app/hooks.ts), for the smoke test, the tools and the console. In this order: installHooks makes window.witch, the rest add to it, and the guard wraps what's there. */
export function installConsoleHooks(pageHost: PageHost): void {
  installBaseHooks(pageHost);
  installFindHooks(pageHost);
  installSailHooks(pageHost);
  guardConsoleHooks(pageHost);
}

/** window.witch itself (app/hooks.ts), and the telephone proofs' extras. */
function installBaseHooks(pageHost: PageHost): void {
  installHooks({ night: pageHost.N, view: pageHost.view, sound: pageHost.sound, meter: pageHost.meter, shake: pageHost.shake, frameStats: pageHost.frameStats, ladder: pageHost.ladder, loadTimes: pageHost.loadTimes, loop: pageHost.loop, advance: (game, controls, dt) => soloDiagnostic(pageHost.phone.active, pageHost.N().spec.borrowed === true, () => recordedStep(game, controls, dt, pageHost.BUILD, pageHost.captureRecording)) });
  if (pageHost.phoneEnabled && pageHost.phoneCallsEnabled && pageHost.params.has("shot")) {
    (window as unknown as { witch: Record<string, unknown> }).witch.telephoneReplayRecording = () => recordingFor(pageHost.N().game, pageHost.BUILD, pageHost.captureRecording).export();
  }
  if (pageHost.phoneEnabled && pageHost.phoneCallsEnabled) (window as unknown as { witch: Record<string, unknown> }).witch.telephoneProof = () => ({
    preparation: { ...pageHost.visitPreparation }, saveBoundaryReady: pageHost.ordinaryVisit !== null,
    network: pageHost.phone.network(),
    status: pageHost.phone.state.status, active: pageHost.phone.active, visiting: pageHost.phone.visiting,
    seed: pageHost.N().game.seed, borrowed: pageHost.N().spec.borrowed === true, worldReady: pageHost.N().flags.ready,
    viewSeed: pageHost.view.game.seed, viewUsesCanonicalMap: pageHost.view.game.map === pageHost.N().game.map,
    seedLabel: pageHost.seedEl.textContent,
    draw: { dressed: batchProof(pageHost.view, pageHost.view.witchBatch), bare: batchProof(pageHost.view, pageHost.view.bareBatch), remote: batchProof(pageHost.view, remoteBodyBatch(pageHost.view)) },
    players: pageHost.view.game.witches.map(w => ({ id: w.id, x: w.body.x, z: w.body.z, room: w.wake?.room,
      atRoom: roomAt(pageHost.N().game.map.treehouse, w.body.x, w.body.z)?.id ?? null,
      perched: !!w.body.perch, slept: w.house?.slept === true, wakeOpen: w.wake?.open,
      pile: w.wake?.pile, lastBed: w.house?.lastBed,
      nearObjects: HOUSE_ROOMS.objects.filter(o => fromObject(o, pageHost.N().game.map.treehouse, w.body.x, w.body.z) <= HOUSE_ROOMS.reach).map(o => o.id),
      screen: pageHost.view.screenOf(w.body.x, w.body.perch ? pageHost.N().tuning.treehouse.house?.height ?? 0 : 0, w.body.z) })),
    house: { at: pageHost.N().game.map.treehouse, turn: HOUSE_ROOMS.turn ?? 0, shape: HOUSE_ROOMS.shape, bedHold: HOUSE_ROOMS.bed.hold, terrace: HOUSE_ROOMS.terrace,
      objects: HOUSE_ROOMS.objects.map(o => ({ id: o.id, use: o.use.kind, front: objectFront(o, pageHost.N().game.map.treehouse, .6) })) },
    artPending: pageHost.view.assets.pending, artDone: pageHost.view.assets.done, paused: pageHost.freeze.frozen,
    menus: { telephone: pageHost.phone.open, creator: pageHost.creator.open, station: pageHost.stations.station, chart: chartOpen() },
  });
}

/** witch.compareKey, witch.take (tonight's find taken where she stands, for tools/loan/shots.cjs), witch.wakeUp, witch.stationShuts, witch.guide and witch.dream. */
function installFindHooks(pageHost: PageHost): void {
  (window as unknown as { witch: Record<string, unknown> }).witch.compareKey = (spot?: string) => keyNow(pageHost, spot);
  // witch.take(kind, item): tonight's find taken where she stands, as E at it takes it (the kind's claim, the hats' floor, the loan):
  // for the tools (tools/loan/shots.cjs) to look at a night with a find on loan without walking to it.
  (window as unknown as { witch: Record<string, unknown> }).witch.take = (kind: FindKindId, id: string): boolean => {
    const { game } = pageHost.N(), k = FIND_KINDS.find(q => q.id === kind), W = game.witches[0];
    if (!k?.items.includes(id)) return false;
    const c = game.map.cellSafe(game.witch.x, game.witch.z).cell;
    game.trunk = { x: game.witch.x, z: game.witch.z, cell: [c[0], c[1]], kind, item: id, found: true };
    k.claim?.(W.spells, id);
    if (kind === "hat") addFloorHat(W, id);
    lendFind(pageHost, kind, id);
    return true;
  };
  // window.witch.wakeUp(yesterday): a wake-up in her bed as the game starts one (rules/wakeUp.ts startWake), with or without a night
  // played before it (the shots of the first morning's hat on the hats' floor, and of last night's pile).
  (window as unknown as { witch: Record<string, unknown> }).witch.wakeUp = (yesterday: boolean): boolean => { const { game } = pageHost.N(); return wakeInBedroom(game) && startWake(game, game.herTime, { yesterday }); };
  // window.witch.stationShuts: the station panels' last closes, why, when, and whether paused (the pause check's broom bay, closed
  // under the pause on the slow runner now and then: tools/smoke/pause-on-top.cjs prints them when a row fails).
  (window as unknown as { witch: Record<string, unknown> }).witch.stationShuts = pageHost.stationShuts;
  // window.witch.guide: her guidance pin's state, what's kept of it (what's new, the islands seen) the pickups' hooks, and a step of it
  // (window.witch.frame's manual frames don't run the page's loop: shots).
  (window as unknown as { witch: Record<string, unknown> }).witch.guide = { save: pageHost.guide, pin: () => pageHost.guidePin.state, hooks: GUIDANCE_HOOKS, step: () => stepGuide(pageHost, performance.now()) };
  // witch.dream("won" | "lost", kind, item): her dream of such a loan over the night, its own dark under it (as ?dream=); under ?shot=
  // drawn only when asked, window.__dream.draw(seconds) (tools/loan/shots.cjs).
  (window as unknown as { witch: Record<string, unknown> }).witch.dream = (v: string, kind: FindKindId, id: string): boolean => {
    if (!FIND_KINDS.some(q => q.id === kind && q.items.includes(id))) return false;
    startDream(pageHost, { loan: lend(kind, id, { look: null, hat: "none", parts: pageHost.N().game.witches[0].spells.parts }), won: v === "won" }, true);
    return true;
  };
}

/** witch.debugSwap (?debug=sail), witch.land, witch.chart, the zoo, the Studio and the telescope for the tools, and witch.sail. */
function installSailHooks(pageHost: PageHost): void {
  // ?debug=sail (docs/plans/sail-without-reload.md, PR 4b): another night in place, made as a sail will make one (app/night.ts
  // startNight, the view taking it: View.setGame), its start's art made and play started as the start screen's would; for
  // tools/sail/swap.cjs.
  if (pageHost.params.get("debug") === "sail") (window as unknown as { witch: Record<string, unknown> }).witch.debugSwap = async (seed: number, island?: string): Promise<number> => {
    const p = new URLSearchParams(pageHost.params), was = pageHost.N().spec;
    p.set("seed", String(seed));
    if (island !== undefined) p.set("island", island);
    pageHost.sailing = true;
    pageHost.loan = null; // (a debug swap: tonight's loan, if any, just gone)
    endNight(pageHost.page, true); // (its game marked disposed: a reader left on it that steps it throws)
    const n = await startNight(pageHost.page, { how: "debug", island: island ?? was.island, seed, world: was.world, params: p });
    pageHost.seedEl.innerHTML = `seed <a href="?seed=${n.seed}">${n.seed}</a>`;
    await pageHost.view.prepare();
    n.flags.ready = true;
    pageHost.sailing = false;
    start(pageHost);
    return n.seed;
  };
  // window.witch.land(): the tools' own way past a sail's dive (the smoke run, tools/sail/leak.cjs), straight to her bed as a dive whose
  // shader grace ran out lands; no player can (Ed, 2026-11-06: "they shouldn't be skippable because loading must happen"). False if
  // there's no dive under way.
  (window as unknown as { witch: Record<string, unknown> }).witch.land = (): boolean => { const a = pageHost.N().arrival; if (!a || a.done) return false; a.skip(); return true; };
  // window.witch.chart(): the sea chart over the night, as the map table opens it (tools/smoke/quick.cjs: choosing her own island);
  // window.witch.chart("mapTable"), as the table's own, sailing on a hold (tools/sail/hold.cjs).
  (window as unknown as { witch: Record<string, unknown> }).witch.chart = (table?: string) => chartOverNight(pageHost, table);
  // The bestiary book's zoo over the night, for the tools (tools/zoo/perf.cjs): open and close it as the book and its × do.
  (window as unknown as { witch: Record<string, unknown> }).witch.zooOverlay = pageHost.zoo;
  // The Studio's instruments for the tools (tools/studio/check.cjs): where she's at and what it plays (its meter).
  (window as unknown as { witch: Record<string, unknown> }).witch.studio = pageHost.studio;
  // The telescope for the tools (tools/telescope/shots.cjs, tools/stars/shots.cjs): look through it pointed at a bearing and zoom (0
  // wide, 1 close) and an elevation (degrees up; its lowest if not given), or stop.
  (window as unknown as { witch: Record<string, unknown> }).witch.telescope = {
    look: (heading: number, zoom: number, elevation?: number) => { const { game, tuning } = pageHost.N(); if (!tuning.telescope) return false; pageHost.telescope.open(game, tuning.telescope); pageHost.telescope.point(heading, zoom, tuning.telescope, elevation); pageHost.view.telescope = pageHost.telescope.look(tuning.telescope); return true; },
    close: () => { pageHost.telescope.close(); pageHost.view.telescope = null; },
    get on() { return pageHost.telescope.on; },
    get aim() { return pageHost.telescope.aiming; },
    // (what its picture still lacks, for tools/telescope/ready.cjs: tree chunks with no trees drawn, a listing under way, its mist on)
    get missing() { return scopeMissing(pageHost.view); },
    get listing() { return sceneryListing(pageHost.view); },
    get mist() { return !!pageHost.view.loadingMist?.scoped; },
  };
  // window.witch.sail(island, seed, { end, fail }): a sail as the map table's chart sails (sailFromChart, the same path: its record
  // on the chart, the way by sail.inPlace or ?sail=, in place the fallback), for tools/sail/leak.cjs and swap.cjs; `end` the
  // chart's flight end (a plain one out at sea south of the island if not given: its still a dark screen; null, none), `fail`
  // (?debug=sail only) the sail in place made to throw, to see the fallback. Resolves once the night's start is ready.
  (window as unknown as { witch: Record<string, unknown> }).witch.sail = (island: string, seed: number, o: { end?: FlightEnd | null; fail?: boolean } = {}): Promise<boolean> => {
    pageHost.sailFail = !!o.fail && pageHost.params.get("debug") === "sail";
    const world = chartWorldArg(pageHost), end = o.end === null ? undefined : o.end ?? { cam: { x: 0, z: 700, height: 260, pitch: 0.45, fov: 40, speed: 60 }, still: "" };
    return sailFromChart(pageHost, sailHref(island, seed, world, location.href), { island, seed, world, end });
  };
}

/** Known synchronous console mutations use declared boundaries too (soloDiagnostic, a recorded mutation). Arbitrary direct writes to witch.game remain detectable replay failures. Runs after every hook is in place. */
function guardConsoleHooks(pageHost: PageHost): void {
  {
    const hooks = (window as unknown as { witch: Record<string, unknown> }).witch;
    for (const name of ["arena", "arenaAttack", "shot", "guest", "lose", "rainbow", "hit", "take", "wakeUp", "dream"]) {
      const action = hooks[name];
      if (typeof action === "function") hooks[name] = (...args: unknown[]) => soloDiagnostic(pageHost.phone.active, pageHost.N().spec.borrowed === true, () => pageHost.mutate(`debug: ${name}`, () => Reflect.apply(action, hooks, args)));
    }
    for (const name of ["debugSwap", "frame", "frameLive", "soundFrame"]) {
      const action = hooks[name];
      if (typeof action === "function") hooks[name] = (...args: unknown[]) => soloDiagnostic(pageHost.phone.active, pageHost.N().spec.borrowed === true, () => Reflect.apply(action, hooks, args));
    }
    const manual = Object.getOwnPropertyDescriptor(hooks, "manual");
    if (manual?.set) Object.defineProperty(hooks, "manual", { ...manual, set: (on: unknown) => soloDiagnostic(pageHost.phone.active, pageHost.N().spec.borrowed === true, () => manual.set!.call(hooks, on)) });
    const guideStep = (hooks.guide as { step?: () => void } | undefined)?.step;
    if (guideStep) (hooks.guide as { step: () => void }).step = () => soloDiagnostic(pageHost.phone.active, pageHost.N().spec.borrowed === true, guideStep);
  }
}

/** A witch batch as drawn (the telephone proofs': its instances' feet and centres on the screen). */
function batchProof(view: View, batch: View["witchBatch"] | null) {
  if (!batch) return null;
  const material = batch.mesh.material as { depthTest?: boolean; transparent?: boolean };
  const up = SPRITE_UNIFORMS.uUp.value;
  return { count: batch.count, visible: batch.mesh.visible, renderOrder: batch.mesh.renderOrder,
    depthTest: material.depthTest, transparent: material.transparent, atlas: batch.atlas.albedo.uuid,
    matchesDressedAtlas: batch.atlas === view.assets.witch, textureVersion: batch.atlas.albedo.version,
    instances: batch.items.slice(0, 4).map(p => {
      const height = (p.sy === undefined ? p.frame.h : Math.max(1, Math.round(p.frame.h * p.sy))) * batch.metresPerPixel * (p.scale ?? 1);
      return { x: p.x, y: p.y, z: p.z, frame: batch.atlas.frames.indexOf(p.frame),
        feet: view.screenOf(p.x, p.y, p.z, true),
        centre: view.screenOf(p.x + up.x * height / 2, p.y + up.y * height / 2, p.z + up.z * height / 2, true) };
    }) };
}

/** The stall nearest a moment (page seconds), for the playtest log's audio lines. */
export function nearestStall(stalls: StallLog["stalls"], pageS: number): { off: number; ms: number } | undefined {
  let best: { off: number; ms: number } | undefined;
  for (const st of stalls) { const off = Math.round((st.at - pageS) * 10) / 10; if (!best || Math.abs(off) < Math.abs(best.off)) best = { off, ms: Math.max(st.gap, st.work) }; }
  return best;
}

/** The measured output (platform/audio/outputMeter.ts): silence while the music should be heard goes in the playtest log with where
 *  she was and the nearest stall; and each sample's audio carries the clock's account too (under-runs, coarse steps, a true clock). */
export function watchSilence(pageHost: PageHost): void {
  pageHost.meter.onSilence = e => {
    const { game, playtest } = pageHost.N(), w = game.witch, ago = performance.now() / 1000 - e.start;
    const r2 = (x: number) => Math.round(x * 100) / 100, { lastMix, music, audio } = pageHost.sound;
    playtest.silence({ cause: pageHost.meter.reading.clock >= 0.9 ? "game" : "clock", t: Math.round((game.clock.time - ago) * 10) / 10, dur: Math.round(e.dur * 100) / 100, x: Math.round(w.x), z: Math.round(w.z), area: areaUnderWitch(game), mode: w.mode, mix: r2(lastMix?.volume ?? 0), gain: music ? r2((music.output as GainNode).gain.value) : 0, state: audio?.state ?? "none", clock: pageHost.meter.reading.clock, back: e.db, stall: nearestStall(pageHost.stallLog.stalls, e.start) });
    console.warn(`audio: the output silent for ${e.dur.toFixed(2)} s while the music should be heard`);
  };
  // each playtest sample's audio carries the clock's account too: under-runs, coarse clock steps or a true clock
  {
    const log = pageHost.N().playtest, own = log.audioState, cw = pageHost.meter.clockWatch;
    log.audioState = () => ({ ...(own?.() ?? { state: "none", volume: 0, distort: 0, distance: 0, mends: 0 }), clock: { slow: cw.slow, fast: cw.fast, drift: cw.drift, played: cw.outDrift, underruns: cw.underruns, underrunMs: cw.underrunMs, verdict: cw.verdict() } });
  }
}

/** What a builder needs from a screenshot of the overlay (Ed, 2026-10-14; app/repro.ts): the link that rebuilds what she saw, the
 *  machine, and every setting changed from the build's (read a second at most); all of it as text for the debug button and the log. */
export function makeRepro({ night, built, build, view, canvas, overlay }: { night: () => Night; built: object; build: string; view: View; canvas: HTMLCanvasElement; overlay: () => string[] }) {
  let machine: string[] | null = null, diff: [string, unknown][] = [], at = -Infinity;
  const changed = () => { const now = performance.now(); if (now - at > 1000) { at = now; diff = tuningDiff(night().tuning, built); } return diff; };
  const link = () => location.origin + location.pathname + reproQuery(reproState(night().game, changed()), night().params);
  const gl = () => view.renderer.getContext();
  const mach = () => (machine ??= (() => { try { return [...machineLines(gl(), canvas, night().tuning.pixelSize), ...precisionLines(gl())]; } catch { return ["gpu    (unknown)"]; } })());
  const targets = () => { const z = view.post.sizes(), c = SPRITE_UNIFORMS.uCutout.value, d = { x: gl().drawingBufferWidth, y: gl().drawingBufferHeight }, f = (a: [number, number]) => a.join("×");
    return [`rt     scene ${f(z.scene)}  effects ${f(z.fx)}  bloom ${f(z.bloom)}  out ${f(z.out)}  drawing buffer ${d.x}×${d.y}`, `hole   canopy cut-away at ${c.x.toFixed(0)}, ${c.y.toFixed(0)} px  radius ${c.z.toFixed(1)} px  edge ${c.w.toFixed(1)} px`]; };
  /** All of it, for the button and the log: the link, the machine, the targets, the overlay's lines, every setting changed and every test slider. */
  const full = () => debugText(`Witch debug info · ${build} · seed ${night().seed} · ${new Date().toISOString()}`, [
    ["Link", [link()]],
    ["Machine", [...mach(), ...targets()]],
    ["Overlay", [...overlay(), ...powerLines(night().game)]],
    ["Settings changed from the build's", changed().map(([p, v]) => `${p} = ${JSON.stringify(v)}`)],
    ["Test sliders (the pause page)", valuesText(new Map(DECISION_LIST.map(d => [d.id, currentValue(d, night().tuning, night().params)])), "", night().seed).split("\n").slice(1)],
  ]);
  return { link, machine: mach, changed, full, line: () => reproLine(reproState(night().game, changed()), changed().length) };
}
