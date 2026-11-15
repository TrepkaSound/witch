// The pause page (Esc, the ❚❚ button): the freeze's hooks, its corner buttons, the Potion and Music Labs, the written comment and its
// restore, and the audio watchdog. Each function takes the page's host (src/main.ts pageHost) for the live state it reads.
import type { PageHost } from "../main";
import { leaveVisit } from "./visitHome";
import { soloDiagnostic } from "./soloDiagnostic";
import { toggleCornerPanel, closeCornerPanel, cornerPanelRoot } from "../ui/cornerPanel";
import { setUnlockAll, stockMushroomBaskets, syncHatUnlock, unlockAll } from "./debugUnlock";
import { defaultsText, newWitchLink } from "./defaultLook";
import { lookWithoutLoan, partsWithoutLoan } from "./loan";
import { fightLink, newFightSeed } from "./fightArena";
import { mutedAway } from "./settingsPage";
import { gpuLine } from "../render/view/gpuBudget";
import { notable } from "../platform/playtestJournal";
import { recordedStep, recordingFor } from "./recordingHooks";
import { FRAME_CHECK_KEY, freshHref, localStore } from "../platform/storageScope";
import { restoreGame, snapshotGame } from "../rules/nightSnapshot";
import { browserNightStore } from "./nightSave";
import { captureComment, parseCommentFile } from "./playtestComments";
import { LOG_EXPANDED_BYTES } from "../platform/logCodec";
import { replayRecording } from "../platform/inputRecording";
import { SPRITE_UNIFORMS } from "../render/sprites";

export async function openPotionLab(pageHost: PageHost): Promise<void> {
  if (pageHost.phone.active || pageHost.N().spec.borrowed) return;
  const { PotionLab } = await import("../ui/potionLab");
  if (pageHost.phone.active || pageHost.N().spec.borrowed) return;
  pageHost.potionLab ??= new PotionLab(() => pageHost.N().game, pageHost.style, pageHost.BUILD, () => { if (pageHost.freeze.frozen) pageHost.freeze.toggle(); }, (label, action) => soloDiagnostic(pageHost.phone.active, pageHost.N().spec.borrowed === true, () => pageHost.mutate(label, action)));
  if (pageHost.freeze.frozen) pageHost.potionLab.show();
}

export function pauseControls(pageHost: PageHost, on: boolean): void {
  if (!on || (pageHost.dressed && !pageHost.phone.active)) { if (pageHost.pauseBtns) pageHost.pauseBtns.style.display = "none"; closeCornerPanel(); return; }
  if (!pageHost.pauseBtns) {
    pageHost.pauseBtns = document.createElement("div");
    pageHost.pauseBtns.id = "pause-btns"; pageHost.pauseBtns.style.cssText = "position:fixed;right:12px;top:12px;z-index:61;display:flex;gap:8px";
    const keys = pageHost.startEl.querySelector<HTMLElement>(".keys");
    for (const [label, id, title, el] of [["❔ Controls", "controls", "CONTROLS", keys], ["⚙ Options", "options", "OPTIONS", pageHost.shakeEl]] as const) {
      if (!el) continue;
      const b = document.createElement("button");
      b.type = "button"; b.textContent = label;
      b.style.cssText = "font:13px ui-monospace,monospace;color:#e8e2f4;background:rgba(10,9,22,.86);border:1px solid #3a2f5c;border-radius:6px;padding:6px 12px;cursor:pointer";
      b.addEventListener("click", () => toggleCornerPanel(document.body, id, title, [el]));
      pageHost.pauseBtns.append(b);
    }
    pageHost.leaveVisitButton = document.createElement("button"); pageHost.leaveVisitButton.type = "button"; pageHost.leaveVisitButton.textContent = "Leave visit";
    pageHost.leaveVisitButton.addEventListener("click", () => leaveVisit(pageHost.phone.active, () => pageHost.phone.hangUp(), () => { if (pageHost.freeze.frozen) pageHost.freeze.toggle(); }));
    pageHost.pauseBtns.append(pageHost.leaveVisitButton);
    document.body.append(pageHost.pauseBtns);
  }
  pageHost.pauseBtns.style.display = "";
  if (pageHost.leaveVisitButton) pageHost.leaveVisitButton.hidden = !pageHost.phone.active;
}

/** The pause/menu path is also live while a limited arrival holds the entire simulation asleep. */
export function updatePauseMenus(pageHost: PageHost, now: number): void {
  pageHost.settingsPage.update(now / 1000);
  const corner = cornerPanelRoot(), pauseRoots = pageHost.freeze.frozen && !pageHost.settingsPage.open ? (corner ? [corner] : [document.getElementById('pause-sliders'), pageHost.pauseBtns].filter((el): el is HTMLElement => !!el)) : [];
  const opened = pauseRoots.length ? pageHost.freeze.takeOpenPad() : undefined;
  if (pageHost.pauseFocus.update(pauseRoots, pageHost.freeze.pad(), now / 1000, () => { if (corner) closeCornerPanel(); else pageHost.freeze.toggle(); }, corner ? undefined : opened)) pageHost.input.device = 'pad';
}

export function openMusicLab(pageHost: PageHost): void {
  if (pageHost.musicLabPanel) { pageHost.musicLabPanel.show(true); return; }
  if (pageHost.musicLabLoading) return;
  pageHost.musicLabLoading = true;
  void Promise.all([import("../ui/musicLabPanel"), import("./musicLab")]).then(([{ MusicLabPanel }, { MusicLab }]) => {
    const lab = pageHost.sound.lab ?? (pageHost.sound.lab = new MusicLab(pageHost.N().musicStyle));
    pageHost.musicLabPanel = new MusicLabPanel({ lab, sound: pageHost.sound, game: () => pageHost.N().game, nextWave: () => { pageHost.input.touch.nextWave = true; }, noNight: () => !pageHost.N().game.speakerBoot.some(t => t !== null) });
    pageHost.musicLabPanel.show(true);
  }, () => { pageHost.musicLabLoading = false; window.alert("The Music Lab's code couldn't load (a newer build may be up: reload the page)."); });
}

/** The freeze's hooks (platform/freeze.ts): what a frozen step records, when Esc is its, and what pausing opens and closes (the pause page's sliders, its corner buttons, the Report's house reading). */
export function installFreezeHooks(pageHost: PageHost): void {
  pageHost.freeze.mutate = pageHost.mutate;
  pageHost.freeze.advance = (game, controls, dt) => { if (!pageHost.phone.active && !pageHost.N().spec.borrowed) recordedStep(game, controls, dt, pageHost.BUILD, pageHost.captureRecording); };
  pageHost.freeze.started = () => (pageHost.startEl.style.display === "none" || pageHost.creator.open) && !pageHost.studio.at;
  pageHost.freeze.ownsEsc = () => !pageHost.bot && !document.querySelector("#settings-page.open, #potion-lab.open");
  pageHost.freeze.quiet = true;
  pageHost.freeze.onStamp = text => pageHost.pauseSliders?.setStamp(text);
  pageHost.freeze.onToggle = on => {
    if (on) pageHost.houseAtPause = pageHost.view.houseRooms ? { at: Math.round(performance.now()), ...pageHost.view.houseRooms.reportState(pageHost.view) } : null;
    notable("screen", on ? "Paused" : "Resumed");
    pageHost.input.release(); // Held keys and pending presses belong to the old input owner, never to the resumed game.
    pageHost.settingsPage.gate(); // (suspended while paused, and muted in the background if so set: app/settingsPage.ts)
    if (!on) { pageHost.settingsPage.close(); pageHost.potionLab?.close(); }
    pauseControls(pageHost, on);
    pageHost.musicLabPanel?.frozen(on);
    pageHost.creator.frozen = on; // (paused in her room: its keys and clicks wait, Esc resumes; the sliders backed over its panel)
    if (on) void pageHost.newBuild.check().then(() => pageHost.pauseSliders?.paintNewBuild()); // (the pause panel's "Load latest version": playtest 31 Oct item 11)
    if (pageHost.pauseSliders) { pageHost.pauseSliders.show(on, pageHost.creator.open); return; }
    if (!on || pageHost.pauseLoading) return;
    pageHost.pauseLoading = true;
    void Promise.all([import("../ui/decide"), import("../ui/frameCheckPanel")]).then(([{ PauseSliders }, { frameCheckPanel }]) => {
      const report = () => import("../ui/visualReport").then(({ report }) => report(reportHost(pageHost)));
      pageHost.pauseSliders = new PauseSliders({ resetAll: { run: () => pageHost.deleteSaves(null), shown: () => !pageHost.savesLocked() }, newBuild: { latest: () => pageHost.newBuild.latest, load: () => location.reload() }, mutate: pageHost.tuningMutation, saveComment: text => saveComment(pageHost, text), restoreComment: file => restoreComment(pageHost, file), downloadReadableLog: () => { void pageHost.N().playtest.download("text"); }, settings: () => pageHost.settingsPage.show(), get tuning() { return pageHost.phone.preferences(pageHost.N().game); }, get seed() { return pageHost.N().game.seed; }, version: pageHost.BUILD, live: pageHost.knobLive, report, potionLab: () => { void openPotionLab(pageHost); }, frameCheck: () => frameCheckPanel({ rung: () => (pageHost.ladder.state.mode === "off" ? "off" : String(pageHost.ladder.state.rung)), paused: () => pageHost.freeze.frozen, hold: on => { pageHost.loop.manual = on; }, store: localStore, key: FRAME_CHECK_KEY }), musicLab: () => openMusicLab(pageHost), audioTest: () => { window.open("audio-test/", "_blank", "noopener"); }, downloadLog: () => pageHost.N().playtest.download(), unlockAll: { get: () => unlockAll(), set: on => { if (pageHost.phone.active) return; pageHost.mutate("debug: unlock all", () => { setUnlockAll(on); if (on) stockMushroomBaskets(pageHost.N().game); for (const W of pageHost.N().game.witches) syncHatUnlock(W, on, pageHost.params); pageHost.creator.hats = pageHost.N().game.spells.hats; }); } }, defaults: { text: () => defaultsText(lookWithoutLoan((pageHost.page.look() ?? pageHost.creator.genome()) as Record<string, unknown> | null, pageHost.loan), partsWithoutLoan(pageHost.N().game.witches[0].spells.parts, pageHost.loan)), tryIt: () => { window.open(newWitchLink(location.href), "_blank", "noopener"); }, shown: () => pageHost.N().hud.debugOn || unlockAll() }, fightArena: () => { window.open(fightLink(newFightSeed()), "_blank", "noopener"); }, finds: () => pageHost.findsPanel.toggle(true), findsShown: () => pageHost.N().hud.debugOn || pageHost.devFinds, quality: { lines: () => pageHost.ladder.lines(), options: () => pageHost.ladder.options(), current: () => pageHost.ladder.current(), choose: v => { pageHost.ladder.choose(v); pageHost.ladder.apply(pageHost.phone.preferences(pageHost.N().game)); pageHost.viewRevision++; } } });
      requestAnimationFrame(() => pageHost.pauseSliders!.show(pageHost.freeze.frozen, pageHost.creator.open)); // (a frame shut first, so it slides in)
    }, () => { // (its files replaced under it: Ed, 2026-10-14, "the menu does not appear")
      pageHost.pauseLoading = false;
      void pageHost.newBuild.check().then(() => { if (pageHost.newBuild.latest) pageHost.menuGone = true; else window.alert("A newer build of the game is up, so the pause page can't load: reload the page (Shift+Reload)."); });
    });

  };
  pageHost.freeze.extra = () => [gpuLine(pageHost.view)];
}

/** The audio watchdog (app/sound.ts): mends the sound when it should be heard and isn't. */
export function watchAudio(pageHost: PageHost): void {
  pageHost.sound.watch(() => !pageHost.N().game.clock.paused && !pageHost.freeze.frozen && !document.hidden && !mutedAway(), () => pageHost.N().game.speakerBoot.some(t => t !== null), () => pageHost.N().playtest);
}

export async function saveComment(pageHost: PageHost, text: string): Promise<string> {
  const n = pageHost.N();
  const comment = captureComment(n.game, text, { build: pageHost.BUILD, params: n.params.toString(), look: pageHost.page.look() as Record<string, unknown> | null, loan: pageHost.loan,
    flags: { chartRecorded: n.flags.chartRecorded, overRecorded: n.flags.overRecorded } }, pageHost.repro.link(), Object.fromEntries(pageHost.repro.changed()), pageHost.breadcrumbs.recent(n.game), Date.now(), recordingFor(n.game, pageHost.BUILD, pageHost.captureRecording).export());
  const kept = await pageHost.commentBook.add(comment);
  const state = pageHost.commentBook.status();
  let status = kept ? "Written comment kept in the playtest log." : `Comment kept on this page only: ${state.error ?? "browser storage is unavailable"}. Download the log before closing.`;
  if (state.omitted) status += ` ${state.omitted} written report(s) have no saved moment or input replay; their text and context are kept in downloads. ${state.omissionReasons.join(" ")}`;
  return comment.recording?.complete ? status : `${status} Exact input replay is incomplete: ${comment.recording?.failure ?? "unavailable"}.`;
}

export async function restoreComment(pageHost: PageHost, file: File): Promise<void> {
  soloDiagnostic(pageHost.phone.active, pageHost.N().spec.borrowed === true, () => {});
  if (file.size > LOG_EXPANDED_BYTES) throw Error("This log file is too large.");
  const comment = await parseCommentFile(await file.text(), pageHost.BUILD);
  // Validate the full graph before writing or navigating. Importing JSON never executes code.
  const replayed = comment.recording ? replayRecording(comment.recording, pageHost.BUILD) : restoreGame(comment.night.game);
  if (JSON.stringify(snapshotGame(replayed)) !== JSON.stringify(comment.night.game)) throw Error("Input replay differs from the saved comment moment. The log is kept; report this replay failure.");
  soloDiagnostic(pageHost.phone.active, pageHost.N().spec.borrowed === true, () => {});
  await browserNightStore(location.pathname + ":comment-restore").write(comment.night);
  soloDiagnostic(pageHost.phone.active, pageHost.N().spec.borrowed === true, () => {});
  const url = new URL(location.href); url.search = "?restore=comment&resume=1"; location.href = freshHref(url.toString());
}

/** The pause page's Report (ui/visualReport.ts): the frame drawn with each neutral pair, where they differ, the GPU, her place, the
 *  camera and the repro link (and window.__neutralCheck's numbers for the smoke test). */
export function reportHost(pageHost: PageHost) {
  const { game } = pageHost.N(), version = pageHost.BUILD, w = game.witch, c = game.camera;
  return {
    canvas: pageHost.canvas, gl: pageHost.view.renderer.getContext(), tuning: game.tuning, seed: game.seed, version, link: pageHost.repro.link, changed: pageHost.repro.changed,
    witch: (): [number, number] | null => { const u = SPRITE_UNIFORMS.uWitch.value, low = pageHost.view.post.lowSize; return low.x > 0 ? [u.x * pageHost.canvas.width / low.x, (low.y - u.y) * pageHost.canvas.height / low.y] : null; },
    world: () => ({ x: w.x, z: w.z, mode: w.mode, lift: w.lift, area: game.map.areaAt(w.x, w.z).type, camera: { zoomStep: c.zoomStep, zoom: c.zoom, tx: c.tx, ty: c.ty, tz: c.tz }, ...(pageHost.view.houseRooms ? { house: pageHost.view.houseRooms.reportState(pageHost.view) } : {}), ...(pageHost.houseAtPause ? { houseAtPause: pageHost.houseAtPause } : {}) }),
  };
}
