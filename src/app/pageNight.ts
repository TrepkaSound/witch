// A night's way in and out: the first wake-up, the arrival after a sail, the sea chart and sailing, the bed's next night, the bot
// game, and starting play.
import type { PageHost } from "../main";
import type { View } from "../render/view";
import { findsCtx, partsNow, settleLoan, startDream } from "./pageFinds";
import { drawFrame } from "./frameDraw";
import { slotStorage } from "./saveSlots";
import { type BotKind } from "../rules/botKinds";
import { pleasingWitch } from "../ui/looks";
import { wavesOver } from "../rules/win";
import { withSharedFind, type PersonalKit } from "./sharedFindLoan";
import { closeChart, openChart, type Sailed } from "../ui/chartOverlay";
import { openingWay, sailLandsInBed } from "./opening";
import { wakeInBedroom } from "../rules/opening";
import { fallAsleep, morningAfter, startWake, tuckIn } from "../rules/wakeUp";
import { WorldDrawGate } from "./worldDrawGate";
import { wornGenome } from "../rules/clothesPile";
import { WakeCard } from "../render/wakeUp";
import { carryTiming, clearCarried, mark } from "./timing";
import { type Game } from "../rules/game";
import { diveReach, diveShare, diveTrack } from "../rules/arrive";
import { awaitingSpell } from "../rules/leypulse";
import { loadGenome } from "../ui/creator";
import { HAT_SPELLS } from "../rules/spells";
import { unlockAll } from "./debugUnlock";
import { dreamsAfter } from "./loan";
import { BAGS } from "../rules/bags";
import { ownedRecords } from "./recordSave";
import { loadSave, sailNight, storeSave } from "./chartSave";
import { freshHref } from "../platform/storageScope";
import { endNight, flyIn, startNight, type Night, type NightSpec } from "./night";
import { chartIsland, nightFromHref, nightHref, sailHref, sailOrReload, sailParams, sailWay, stayLabel, type NightWay } from "./sail";
import { hudFade, showStill } from "./arrive";
import { forgetArrival, type Arrival } from "./arrival";
import type { FlightEnd } from "../render/chart/seaChart";
import { logCaughtError } from "../platform/playtestLog";
import { pageMutation } from "./recordingHooks";

/** Her nightie for every morning after a night played (rules/wakeUp.ts morningAfter: her hat in the pile, so no hat-off frames: those
 *  are a first morning's only), drawn in the background from the first night on and kept for good (AssetLibrary.keepLook; Ed,
 *  2026-11-03: "it's the same nightie on every island every morning. Why do we need to keep re-drawing it?"): the same genome
 *  each morning while her look is, so a sail or the bed puts it on at once. Drawn again only when her look changes (its genome
 *  carries her whole outfit, the hidden pieces too, so the art cache keys it anew). */
export function keepNightie(assets: View["assets"], look: unknown): void {
  const after = morningAfter();
  assets.keepLook(wornGenome(look as never, after.pile, after.hatLying));
}

export function personalKit(pageHost: PageHost, game: Game = pageHost.N().game, player = 0): PersonalKit {
  const spells = game.witches[player].spells;
  return { look: (pageHost.page.look() ?? pageHost.creator.genome()) as Record<string, unknown>, hat: spells.hat, parts: { ...spells.parts }, ...(spells.hats ? { hats: [...spells.hats] } : {}) };
}

export function hostCollections(pageHost: PageHost, game: Game) {
  const wardrobe = withSharedFind(game, "wearable", findsCtx(pageHost).owned());
  return { wardrobe, bags: new Set(BAGS.filter(b => wardrobe.has(b.id)).map(b => b.id)), hats: withSharedFind(game, "hat", new Set(game.witches[0].spells.hats ?? HAT_SPELLS.filter(hat => hat.built).map(hat => hat.id))), parts: withSharedFind(game, "part", partsNow(pageHost.loan)), records: withSharedFind(game, "record", new Set(ownedRecords())) };
}


export function aheadMorning(pageHost: PageHost, on: boolean): void {
  if (!on && !pageHost.morningAhead) return;
  pageHost.morningAhead = on ? morningAfter() : null;
  pageHost.showLook();
}

/** The swap point (the transition review, 2026-10-19; Ed: "revisits can draw instantly then redraw during the bedroom sequence"):
 *  the island's trees were drawn at once from what's kept (its own seed, render/artCache.ts islandArtSeed); here, the last moment
 *  she can't see them change (the landing still about to fade; else play starting from behind the bedroom), tonight's own (drawn
 *  ahead by the chart, app/landingBake.ts) take their place where they're ready, and the rest stay the island's all night (never
 *  swapped in play). The one hook: the wake-up sequence takes it over when it comes. */
export function revealArt(pageHost: PageHost): void {
  const F = pageHost.N().flags;
  if (F.artRevealed) return;
  F.artRevealed = true;
  const swapped = pageHost.view.assets.swapTonight();
  if (swapped.length) pageHost.view.retype(swapped);
  mark("game:reveal");
}

/** A sail's night put to bed before its dive (Ed, 2026-10-25, 2a: every sail ends with her asleep in bed; app/opening.ts
 *  sailLandsInBed): her in her bedroom, the camera settled on her there, so the flight's last shot is her room (app/arrive.ts end). Not
 *  under ?opening=old, or without the house's rooms: then her decks as before, and no dream after the dive. */
export function bedFirst(pageHost: PageHost, n: Night): void {
  pageMutation(n.game, "wake: bed arrival", () => bedFirstNow(pageHost, n));
}

export function bedFirstNow(pageHost: PageHost, n: Night): void {
  n.flags.inBed = sailLandsInBed(n.params, n.tuning) && tuckIn(n.game); // (in her bed as the wake-up will have her: nothing moves as it lands)
  pageHost.view.asleepInBed = n.flags.inBed;
  if (n.flags.inBed) aheadMorning(pageHost, true); // (asked as she sailed in place already; the island's link loaded anew, &arrive=1: now)
  else { pageHost.dreamAfterDive = null; aheadMorning(pageHost, false); } // (no morning in bed after all: her look as it is)
}

export function arrived(pageHost: PageHost): void {
  pageHost.mutate("house: arrival", () => arrivedNow(pageHost));
}

export function arrivedNow(pageHost: PageHost): void {
  pageHost.logTiming(); clearCarried(); // (?timing=1: the whole sail, from the chart to her decks)
  pageHost.N().flags.landed = true;
  document.body.classList.remove("arriving"); // (the HUD fades in)
  pageHost.sound.sailing(0); // (sailed in place: the sea and the wind fade as the night's start comes in)
  const n = pageHost.N();
  if (pageHost.view.shaderLandingLimited && n.flags.inBed && !pageHost.view.landingWakeReady()) {
    startWake(n.game, n.game.herTime, { dreaming: true, mirrored: mirrored(pageHost), yesterday: true }); aheadMorning(pageHost, false); pageHost.view.asleepInBed = false; // (the morning's own pile from here: the same look)
    pageHost.landingSleep.begin(n.game); pageHost.view.landingSleeping = true; pageHost.view.foot = 1; pageHost.view.seatK = 0; n.game.clock.paused = true;
    pageHost.input.release(); pageHost.input.clearPresses(); (pageHost.wakeCard ??= new WakeCard()).sleep();
    mark('landing:asleep'); return;
  }
  wakeArrival(pageHost);
}

export function wakeArrival(pageHost: PageHost): void { pageHost.mutate("wake: arrival", () => wakeArrivalNow(pageHost)); }

export function wakeArrivalNow(pageHost: PageHost): void {
  pageHost.view.landingSleeping = false; pageHost.view.asleepInBed = false; // (the wake-up has her in bed from here)
  // (landed asleep in her bed: with a loan settled, dreaming it, the alarm when it ends; else the alarm at once: rules/wakeUp.ts, render/dream.ts)
  const dd = pageHost.dreamAfterDive;
  pageHost.dreamAfterDive = null;
  if (pageHost.N().flags.inBed && startWake(pageHost.N().game, pageHost.N().game.herTime, { dreaming: !!dd, mirrored: mirrored(pageHost), yesterday: true }) && dd) startDream(pageHost, dd); // (a sail: a night played, last night's clothes in their pile)
  aheadMorning(pageHost, false); // (the morning's own pile from here: the look read ahead, so nothing's redrawn)
  if (start(pageHost)) queueCast(pageHost); // (woken in her bedroom, the dive's landing: not yet, rules/wakeUp.ts)
  if (pageHost.N().game.wake) mark("opening:alarm");
  if (!pageHost.gestured) soundNote(pageHost); else pageHost.sound.wake();
}

export function start(pageHost: PageHost): boolean {
  if (pageHost.phone.active || pageHost.N().spec.borrowed) return false;
  if (pageHost.sailing) return false; // (the next night being made in place)
  const { game, flags, arrival } = pageHost.N();
  if (pageHost.landingSleep.holds(game)) return false;
  if (pageHost.bootAsleep) return false; // (asleep under the loading screen till its wake-up: wakeFirst; no key starts the night early)
  if (!flags.ready || !game.clock.paused || pageHost.freeze.frozen) return false;
  if (pageHost.creator.open) return true;
  pageHost.sound.start(); // (browsers keep sound off until the player presses something: the start is that press)
  if (!arrival) revealArt(pageHost); // (play starting from behind the bedroom or the start screen: the island not seen till now)
  pageHost.mutate("start play", () => { game.clock.paused = false; });
  pageHost.startedNights.add(game);
  pageHost.startEl.style.display = "none";
  pageHost.input.clearPresses();
  return true;
}

export function startDirect(pageHost: PageHost): void { if (start(pageHost) && !pageHost.gestured) soundNote(pageHost); }

export function dressCreator(pageHost: PageHost): void {
  if (pageHost.dressed) return;
  pageHost.dressed = true;
  const keys = pageHost.startEl.querySelector<HTMLElement>(".keys");
  if (keys) pageHost.creator.addTab("controls", "❔ Controls", [keys]);
  if (pageHost.shakeEl) pageHost.creator.addTab("options", "⚙ Options", [pageHost.shakeEl]);
  // The zoo (Ed, 2026-10-13: ?zoo, "plus a Zoo button"): every creature in its own block, out of a run.
  pageHost.creator.addButton("Zoo", () => { const u = new URL(location.href); u.searchParams.set("zoo", "1"); location.href = u.toString(); });
}

export function chartOverNight(pageHost: PageHost, table?: string): void {
  const n = pageHost.N(), island = chartIsland(n.tuning.map?.island);
  const here = island ? { island, world: n.tuning.map?.world ?? 0, label: stayLabel(n.game.partyOver ? "over" : n.game.win?.phase === "won" ? "won" : "on") } : undefined;
  if (table) pageHost.chartAt = table;
  openChart((href, to) => { pageHost.chartAt = null; void sailFromChart(pageHost, href, to).catch(error => logCaughtError(error, "chart departure")); }, chartWorldArg(pageHost), { here, onDepart: (to, at) => departFromChart(pageHost, to, at), onStay: () => console.info(`sea chart: ${island} chosen, she's there: back to the night (seed ${pageHost.N().seed}, game time ${pageHost.N().game.clock.time.toFixed(1)} s)`),
    // (the chart down at the water: no deadline for the island's shaders from here, Ed, 2026-11-03: "Don't limit the time, we have to
    // wait for the island to be build anyway; zoom in over the map, switch to the island's sea, fly over the island, and show whatever
    // is built, with mist over it if it's not built". The chart stays up, animated, till they're linked (app/chartView.ts hold); a
    // 15 s grace from here used to cut them short, the dive skipped and the night drawn without what wasn't ready: his v7295 sail.)
    onLandingDue: dueAt => performance.mark("chart:landing-due", { detail: { at: dueAt } }),
    ...(table ? { table: { onLeave: () => { pageHost.chartAt = null; closeChart(); } } } : {}) });
}

/** The world the chart is given: the link's own ?world=, carried on as chart.html's links do (else the save's). */
// (a function: the first load's chart opens before this line runs)
export function chartWorldArg(pageHost: PageHost): number | undefined { return new URLSearchParams(location.search).has("world") ? pageHost.N().tuning.map?.world : undefined; }

/** Sailing from the map table's sea chart (ui/chartOverlay.ts, and window.witch.sail under it): the night recorded on the chart,
 *  unwon if it's still on, then the next night started in place (app/sail.ts; the tuning's sail.inPlace, ?sail=inplace|reload)
 *  or the page loaded anew on the island's link as before; in place, anything going wrong loads it anew all the same, quietly
 *  (Ed's decision 2). Resolves once the new night's start is ready (true) or the page is going (false). */
export async function sailFromChart(pageHost: PageHost, href: string, to: Sailed): Promise<boolean> {
  const returningVisitor = pageHost.phone.visiting || pageHost.N().spec.borrowed === true;
  const pending = pageHost.chartDepartureBoundary.before(); if (pending) await pending;
  if (pageHost.N().spec.borrowed) throw new Error("Return to your own night before sailing.");
  if (returningVisitor) href = sailHref(to.island, to.seed, to.world, location.href);
  const d = pageHost.departing?.island === to.island && pageHost.departing.seed === to.seed ? pageHost.departing : null;
  pageHost.departing = null;
  if (!d) recordSail(pageHost);
  if (sailWay(pageHost.N().params, pageHost.N().tuning) === "reload") { location.href = freshHref(href); return Promise.resolve(false); }
  return sailOrReload(() => sailInPlace(pageHost, to, d?.night), href, h => { location.href = freshHref(h); }, e => {
    console.error("sail in place: it went wrong, so the island's page loads instead", e);
    pageHost.N().playtest.sail(String((e as Error)?.stack ?? e).slice(0, 600));
  });
}

/** The night she's leaving recorded on the chart, unwon if it's still on (in the campaign's world only, as nightOver). */
export function recordSail(pageHost: PageHost): void {
  pageHost.page.onNightEnd?.();
  // (she sleeps as she sails: tonight's loan settled, and its dream after the dive, in bed: Ed, 2026-10-24)
  pageHost.dreamAfterDive = dreamsAfter("sail") ? settleLoan(pageHost, pageHost.N().game.win?.phase === "won") : null;
  const n = pageHost.N(), W = n.tuning.map?.world ?? 0, save = loadSave();
  if (save.world === W) storeSave(sailNight(save, n.tuning.map?.island ?? "", !wavesOver(n.game) && !n.flags.chartRecorded && !n.flags.overRecorded));
  carryTiming(); // (?timing=1: the chart page's steps carried to the next, app/timing.ts)
}

export async function departFromChart(pageHost: PageHost, to: Sailed, at: FlightEnd["cam"] | null): Promise<void> {
  const pending = pageHost.chartDepartureBoundary.before(); if (pending) await pending;
  if (pageHost.N().spec.borrowed) throw new Error("Return to your own night before sailing.");
  if (sailWay(pageHost.N().params, pageHost.N().tuning) === "reload") return Promise.resolve();
  recordSail(pageHost);
  pageHost.view.beginLandingShaders(true); // (the chart's flight committed: no deadline for the island's shaders, below)
  const night = makeSailNight(pageHost, to, undefined, at);
  pageHost.departing = { island: to.island, seed: to.seed, night };
  return night.then(() => undefined, () => undefined);
}

/** The opening's wake-up on a plain first load (app/opening.ts opensInBedroom): home's night made (its start's art drawn, the rest
 *  drawing on behind her while she dresses and walks down: rules/wakeUp.ts), she wakes in her bedroom in the treehouse
 *  (rules/opening.ts), the one wake-up, as every morning. Without the house's rooms, the old start. */
export function wakeFirst(pageHost: PageHost): void {
  pageHost.mutate("wake: first morning", () => wakeFirstNow(pageHost));
}

export function wakeFirstNow(pageHost: PageHost): void {
  const n = pageHost.N();
  pageHost.bootAsleep = false; pageHost.morningAhead = null; pageHost.view.asleepInBed = false; // (the morning itself from here on: its wake-up's pile; the wake-up has her in bed)
  pageHost.firstEver = !wokenBefore(pageHost);
  // (tucked in, not beside her bed: the camera settled on her in it, so nothing moves as the loading screen fades; Ed, 2026-11-05)
  if (!tuckIn(n.game) || !startWake(n.game, n.game.herTime, { mirrored: mirrored(pageHost) })) { pageHost.wakeCard?.hide(); dressCreator(pageHost); pageHost.creator.show(); return; }
  mark("opening:wake");
  start(pageHost);
  if (!pageHost.gestured) soundNote(pageHost); else pageHost.sound.wake(); // (the alarm heard once she's pressed something: browsers keep sound off till then)
}

/** The sail in place (docs/plans/sail-without-reload.md B): the old night's music fading to the sea and the wind, the old night
 *  ended (its game marked disposed under ?debug=sail), the chart's last frame up while the next is made, the night's link pushed
 *  (and Back's guard), the next night made as the boot makes one (app/night.ts startNight: the view taking it, the sliders
 *  carried), its start's art made, then the flight in from the chart's camera (passed in memory), landing as a sail's does. */
export async function sailInPlace(pageHost: PageHost, to: Sailed, made?: Promise<Night>): Promise<void> {
  const arrival: Arrival | undefined = to.end ? { v: 1, island: to.island, world: to.world ?? loadSave().world, at: Date.now(), ...to.end } : undefined;
  if (arrival) { showStill(arrival, !made); hudFade(pageHost.HUD_IDS); document.body.classList.add("arriving"); armGesture(pageHost); } // (made under the flight: no "landing…", the still goes at once)
  const n = await (made ?? makeSailNight(pageHost, to, arrival));
  if (made && arrival) flyIn(n, arrival); // (made under the chart's flight: its hand-off, the still its last frame)
  if (n.arrival) n.arrival.onReveal = () => revealArt(pageHost);
  n.flags.ready = true;
  pageHost.input.clearPresses();
  pageHost.sailing = false;
  if (n.arrival) {
    n.arrival.begin(n.game, !!made); // the camera takes over from the chart's still
    if (pageHost.view.shaderLandingLimited) n.arrival.skip(); // map/house readiness still applies; shaders add no further flight/warm-up wait
  }
  else arrived(pageHost); // (no flight: the chart couldn't fly)
}

/** A sail's night made (sailInPlace, or under the chart's flight: departFromChart): the old night's music fading to the sea and the
 *  wind, the old night ended, the night's link pushed (and Back's guard), the night made (startNight) and its start readied: the
 *  ground, the house and the shaders, not the trees (Ed, 2026-10-24: "Don't wait for the trees": they come under the loading mist,
 *  the dive's own areas first, rules/arrive.ts diveReach); `at`, the chart's hand-off: made under its flight, nothing but the night
 *  itself waited for. */
export async function makeSailNight(pageHost: PageHost, to: Sailed, arrival?: Arrival, at?: FlightEnd["cam"] | null): Promise<Night> {
  pageHost.chartWarmer.pause();
  if (pageHost.sailFail) throw new Error("?debug=sail: the sail in place made to fail"); // (window.witch.sail's test of the fallback)
  if (at === undefined) pageHost.view.beginLandingShaders(false);
  pageHost.sailing = true;
  pageHost.gestured = true; // (she's played: the sound's woken already)
  pageHost.sound.sailing(1);
  const p = sailParams(new URLSearchParams(location.search), to.island, to.seed, to.world);
  // (she'll land asleep in her bed: her next morning's look, her nightie, asked for now, while the chart flies and the night's made)
  if (sailLandsInBed(p, pageHost.N().tuning)) aheadMorning(pageHost, true);
  forgetArrival(); // (the reload's copy, sessionStorage's: a reload later doesn't fly again)
  pageHost.chartHeld = false; pageHost.view.assets.hold(false); // (the chart closed, or flying in: the art workers free for the next island)
  endNight(pageHost.page, pageHost.params.get("debug") === "sail");
  pageHost.backGuard.sailed("?" + p.toString() + location.hash);
  armBack(pageHost);
  const n = await startNight(pageHost.page, { how: "sail", island: to.island, seed: to.seed, world: to.world, arrival, params: p, underChart: at !== undefined }); // (under the chart's zoom: its build given more of each frame, app/night.ts buildSlice)
  pageHost.seedEl.innerHTML = `seed <a href="?seed=${n.seed}">${n.seed}</a>`;
  bedFirst(pageHost, n); // (the flight in ends on her asleep in her bedroom, rules/opening.ts)
  pageHost.worldDraw = new WorldDrawGate();
  pageHost.displayedStep = -1;
  const A = n.tuning.arrive, underChart = !!A && at !== undefined;
  const prep = pageHost.view.prepare({ sail: true, ...(underChart ? { dive: diveReach(n.game.map, A), share: diveShare(n.game.map, A), track: diveTrack(n.game.map, A), underDive: true } : {}) });
  if (underChart) {
    // Made under the chart's flight: it hands over as soon as the night is (its map, and the island's layers the view draws), and
    // the rest is built on under the dive: the shaders, the house, the forest, the ground along its track, shown as they're
    // made, the loading mist over what isn't (Ed, 2026-11-03: "zoom in over the map, switch to the island's sea, fly over the
    // island, and show whatever is built, with mist over it if it's not built"). It used to wait under the chart for the shaders,
    // the track's ground and the hand-off's first frames.
    void prep.catch(e => console.error("the island's build under the dive went wrong", e));
  } else {
    await prep;
    if (pageHost.view.shaderLandingLimited) await pageHost.view.waitForLandingWitch();
  }
  mark("sail:ready");
  return n;
}

/** Another way to a new night (the plan's PR 6: the bed, the bot game's exit): in place as a sail is (the tuning's sail.inPlace,
 *  ?sail=), else, in a bot game for any but its exit (the bot's on the old night), or on anything going wrong, the link loaded as
 *  before (app/sail.ts nightHref's), quietly. */
export function newNight(pageHost: PageHost, how: NightWay): void {
  if (pageHost.sailing) return;
  if (how === "bed" && pageHost.phone.active) {
    if (pageHost.phone.visiting || pageHost.sharedNightChanging) return;
    pageHost.sharedNightChanging = true; pageHost.sharedNightFrom = pageHost.N().game;
  }
  pageHost.page.onNightEnd?.();
  // (she sleeps: tonight's loan settled, won or not, and on the bed's way she dreams it: app/loan.ts, render/dream.ts)
  const settled = settleLoan(pageHost, pageHost.N().game.win?.phase === "won");
  pageHost.dreamNext = dreamsAfter(how) ? settled : null;
  const n = pageHost.N(), href = nightHref(how, location.href);
  const reload = (h: string) => { if (pageHost.sharedNightChanging) pageHost.phone.hangUp(); pageHost.sharedNightChanging = false; pageHost.sharedNightFrom = null; location.href = h; };
  if (!pageHost.sharedNightChanging && ((pageHost.botKind && how !== "bot") || sailWay(n.params, n.tuning) === "reload")) { reload(href); return; }
  void sailOrReload(() => nightInPlace(pageHost, nightFromHref(how, href), href), href, reload, e => {
    console.error(`a new night in place (${how}): it went wrong, so the page loads instead`, e);
    pageHost.N().playtest.sail(String((e as Error)?.stack ?? e).slice(0, 600));
  }).finally(() => { pageHost.sharedNightChanging = false; pageHost.sharedNightFrom = null; });
}

/** A new night in place by one of those ways (docs/plans/sail-without-reload.md B), starting as a fresh load of its link would: the
 *  old night's music faded and the night ended, the link pushed (and Back's guard), the bedroom open as the loading screen (the
 *  start card under ?creator=0), the night made (startNight: the view taking it, the sliders carried), its start's art made;
 *  no flight in. The bot game's exit leaves the bot and her seeded look first. */
export async function nightInPlace(pageHost: PageHost, spec: NightSpec, href: string): Promise<void> {
  pageHost.chartWarmer.pause();
  if (pageHost.sailFail) throw new Error("?debug=sail: the night in place made to fail");
  if (pageHost.freeze.frozen) pageHost.freeze.toggle(); // (a fresh page isn't paused: the bot game's Esc out pauses it too, the freeze's key first)
  pageHost.sailing = true;
  // After the bed in the new opening (Ed's decision 10): asleep in the dark while the next island's made, then the wake-up (one for every morning since Ed, 2026-10-26)
  // in her bedroom, its curtains waiting on that island's build (rules/wakeUp.ts); else the bedroom as the loading screen, as before.
  // Her next morning's look, her nightie, asked for as she falls asleep (aheadMorning): the start below waits for it (view.prepare).
  const wakes = spec.how === "bed" && openingWay(spec.params, pageHost.N().tuning) === "bedroom";
  if (wakes) aheadMorning(pageHost, true);
  pageHost.sound.music?.fadeOut(pageHost.N().tuning.sfx.sail?.fade ?? 1.5); // (a fresh page's music is silent till the home speakers boot)
  pageHost.chartHeld = false; pageHost.view.assets.hold(false);
  endNight(pageHost.page, pageHost.params.get("debug") === "sail");
  if (spec.how === "bot") leaveBot(pageHost);
  const u = new URL(href);
  pageHost.backGuard.sailed(u.search + u.hash);
  armBack(pageHost);
  const room = !wakes && spec.params.get("creator") !== "0";
  pageHost.startEl.classList.add("loading");
  pageHost.startEl.style.display = "none";
  if (room) { dressCreator(pageHost); pageHost.creator.show(); }
  // (asleep in her bed as the veil comes down, the camera settled on her there, and that drawn now: the picture held under the veil
  // while the next night's made is framed as its first, tucked in at the same spot, so nothing moves as the wake-up starts; Ed's
  // "Fix 2", 2026-11-06: it held her standing beside the bed, and the wake-up's first frame jumped to the bed's framing). Drawn twice:
  // the camera aims by the house offset the last draw left (render/view/camera.ts houseCamInput), her place beside the bed's till then.
  if (wakes && pageHost.mutate("wake: asleep in bed", () => fallAsleep(pageHost.N().game))) { pageHost.view.asleepInBed = true; drawFrame(pageHost, pageHost.displayedTime); drawFrame(pageHost, pageHost.displayedTime); pageHost.shake.apply(); }
  if (wakes) (pageHost.wakeCard ??= new WakeCard()).sleep();
  if (wakes && pageHost.dreamNext) startDream(pageHost, pageHost.dreamNext);
  pageHost.dreamNext = null;
  const n = await startNight(pageHost.page, spec);
  pageHost.seedEl.innerHTML = `seed <a href="?seed=${n.seed}">${n.seed}</a>`;
  pageHost.creator.loadout = { hat: n.game.spells.hat }; pageHost.creator.hats = unlockAll() ? undefined : n.game.spells.hats;
  pageHost.worldDraw = new WorldDrawGate();
  pageHost.displayedStep = -1;
  if (wakes) pageHost.view.asleepInBed = tuckIn(n.game); // (in her bed before the start's made round her: its first frames have her drawn there, asleep under the sleep's veil, and the camera on her, as the wake-up will)
  await pageHost.view.prepare();
  n.flags.ready = true;
  pageHost.startEl.classList.remove("loading");
  pageHost.input.clearPresses();
  pageHost.sailing = false;
  if (pageHost.sharedNightChanging) {
    n.flags.ready = n.flags.landed = true; n.flags.last = 0;
    n.game.clock.paused = false; pageHost.startedNights.add(n.game); pageHost.sound.start(); revealArt(pageHost);
    mark("opening:shared-bed");
  }
  else if (wakes && wakeInBedroom(n.game) && startWake(n.game, n.game.herTime, { dreaming: !!pageHost.dream && !pageHost.dream.over, mirrored: mirrored(pageHost), yesterday: true })) { mark("opening:bed"); start(pageHost); } // (after the bed: last night's clothes in their pile)
  else if (!room && !wakes) startDirect(pageHost);
  if (wakes && n.game.wake) tuckIn(n.game); // (the camera settled on her in her bed again, where the wake-up has her: wakeInBedroom put it beside the bed)
  pageHost.view.asleepInBed = false; // (the wake-up has her in bed from here, or there's none)
  aheadMorning(pageHost, false); // (woken, the morning's own pile from here: the look read ahead, so nothing's redrawn)
}

/** The bot game left (its exit in place): the bot and its tag gone, her own look back (the creator's, as a fresh page has it). */
export function leaveBot(pageHost: PageHost): void {
  pageHost.botTag?.dispose();
  pageHost.bot = null; pageHost.botTag = null; pageHost.botKind = null;
  const look = loadGenome();
  pageHost.lookNow = JSON.stringify(look);
  pageHost.showLook();
}

export function chartWorld(pageHost: PageHost): number { return (pageHost.params.has("world") ? pageHost.N().tuning.map?.world ?? 0 : loadSave().world); }

export function soundNote(pageHost: PageHost): void {
  if (document.getElementById("sound-note")) return;
  const el = document.createElement("div");
  // (z 29: just under her eyelids' 30, render/eyelids.ts, so shut eyes cover it; Ed, 2026-11-12: "Lids cover them")
  el.id = "sound-note"; el.textContent = "🔊 press any key for sound";
  el.style.cssText = "position:fixed;left:50%;bottom:72px;transform:translateX(-50%);z-index:29;font:13px ui-monospace,monospace;color:#e8e2f4;background:rgba(10,9,22,.7);border:1px solid #3a2f5c;border-radius:6px;padding:6px 12px;pointer-events:none";
  document.body.append(el);
  const go = () => { pageHost.gestured = true; pageHost.sound.wake(); el.remove(); removeEventListener("keydown", go); removeEventListener("pointerdown", go); };
  addEventListener("keydown", go); addEventListener("pointerdown", go);
}

export function armGesture(pageHost: PageHost): void {
  if (pageHost.gestureArmed) return;
  pageHost.gestureArmed = true;
  for (const ev of ["keydown", "pointerdown"]) addEventListener(ev, () => { pageHost.gestured = true; }, { capture: true });
}

// (a night woken in her bedroom: E at her decks casts it, rules/wakeUp.ts)
export function queueCast(pageHost: PageHost): void { const n = pageHost.N(); if (awaitingSpell(n.game.party) && !n.game.wake) n.flags.castWanted = true; }

export function armBack(pageHost: PageHost): void { if (pageHost.backArmed) return; pageHost.backArmed = true; addEventListener("popstate", () => pageHost.backGuard.popped()); }

export function wokenBefore(pageHost: PageHost): boolean { try { return slotStorage.getItem(pageHost.WOKEN_KEY) === "1"; } catch { return false; } }

export function woke(pageHost: PageHost): void { try { slotStorage.setItem(pageHost.WOKEN_KEY, "1"); } catch { /* storage blocked: her first morning again next time */ } }

export function mirrored(pageHost: PageHost): boolean { try { return slotStorage.getItem(pageHost.MIRROR_KEY) === "1"; } catch { return false; } }

export function sawMirror(pageHost: PageHost): void { try { slotStorage.setItem(pageHost.MIRROR_KEY, "1"); } catch { /* storage blocked: marked again next time */ } }

export function botGame(pageHost: PageHost, kind: BotKind): void {
  if (pageHost.phone.active || pageHost.N().spec.borrowed) return;
  if (pageHost.botKind) return;
  pageHost.botKind = kind;
  const look = pleasingWitch(pageHost.N().seed);
  pageHost.lookNow = JSON.stringify(look); pageHost.showLook(); pageHost.wearHat(look);
  if (pageHost.creator.open) pageHost.creator.hide();
  void Promise.all([import("../rules/bot"), import("../ui/botGame")]).then(([{ BOT_GAME, newBot }, { BotTag }]) => {
    pageHost.bot = newBot(kind, BOT_GAME[kind]); // (the skilled one questing, bringing relics and feeding: rules/bot.ts BOT_GAME)
    pageHost.botTag = new BotTag(kind, () => newNight(pageHost, "bot")); // (back to the start: a night in place on this link without ?bot)
    if (pageHost.N().flags.ready) startDirect(pageHost); // (else the forest's ready starts it)
  });
}
