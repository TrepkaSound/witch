// A4 mechanical extraction from src/main.ts; body identity is checked by tools/refactor/a4-split.mjs.
import type { PageHost } from "../main";
import { spinStep } from "../render/spin";
import { bagOf, setBag } from "../rules/bags";
import { stationLook } from "../platform/online/stationAppearance";

import { startParty } from "../rules/wakeUp";
import { wearFromStation } from "../rules/clothesPile";
import { saveGenome } from "../ui/creator";
import { BOT_KINDS, type BotKind } from "../rules/botKinds";
import { saveLoadout } from "./loadout";
import { setParts } from "../rules/spells";
import { changeLoadout } from "../rules/hatSpells";
import { HOUSE_ROOMS } from "../rules/houseRooms";
import { chooseTrail, fitBroom, loadBroom } from "./broomSave";
import { loadOwned } from "./owned";
import { partsToChoose, unlockAll } from "./debugUnlock";
import { type FindsCtx } from "./finds";
import { hatWithoutLoan, lookWithoutLoan, partsWithoutLoan, withLoan } from "./loan";
import { BagPreview } from "../ui/bagPreview";
import { BAGS } from "../rules/bags";
import { type WorkshopCtx } from "../ui/stationPanel";
import { BRUSH } from "../ui/brushSparkle";
import { chooseRecord } from "./recordSave";
import { integratedGpu } from "./telescope";
import { nightOver } from "./chartSave";

export function reconcilePickers(pageHost: PageHost): void {
  if (!pageHost.phone.active) return;
  pageHost.stations.reconcile((pageHost.page.look() ?? pageHost.creator.genome()) as never, pageHost.menuWardrobe(), pageHost.workshopNow());
  pageHost.booth.refresh(pageHost.menuRecords());
  const witch = pageHost.N().game.witches[pageHost.phone.visiting ? 1 : 0]; if (witch) pageHost.creator.loadout = { hat: witch.spells.hat };
}

export function shutStation(pageHost: PageHost, why: string): void {
  pageHost.stationShuts.push({ why, at: Math.round(performance.now()), frozen: pageHost.freeze.frozen, station: pageHost.stations.station }); if (pageHost.stationShuts.length > 8) pageHost.stationShuts.shift();
  pageHost.stations.close();
}

export function findsCtx(pageHost: PageHost): FindsCtx { return ({ spells: pageHost.N().game.spells, owned: () => (pageHost.owned ??= withLoan("wearable", loadOwned((pageHost.page.look() ?? pageHost.creator.genome()) as Record<string, unknown>), pageHost.loan)) }); }

export function workshopNow(pageHost: PageHost): WorkshopCtx { const { game, tuning } = pageHost.N(), t = game.trunk; return { found: pageHost.phone.active ? new Set(pageHost.phone.catalogue?.parts ?? []) : partsToChoose(pageHost.partsNow()), fitted: pageHost.phone.active ? { ...pageHost.phone.presented(game).spells.parts } : game.witches[0].spells.parts, tonight: t && t.kind === "part" && !t.found ? t.item : null, tuning }; }

export function useHouse(pageHost: PageHost, obj: string): void { return pageHost.mutate("house: use", () => {
  const { game, tuning, flags: { chartRecorded, overRecorded } } = pageHost.N();
  if (obj === "slept" && pageHost.phone.visiting) { pageHost.sailing = true; pageHost.input.release(); pageHost.input.clearPresses(); return; } // The host rolls the shared world; Leave visit is the guest exit.
  if (obj === "slept") { if (!chartRecorded && !overRecorded) nightOver(tuning.map?.island ?? "", { won: false }, undefined, tuning.map?.world ?? 0); setTimeout(() => pageHost.newNight("bed"), 0); return; } // (the sea chart: played, as the afterparty records it; then a new seed: app/newForest.ts; after this frame, in place)
  const o = HOUSE_ROOMS.objects.find(q => q.id === obj);
  if (!o || pageHost.creator.open || game.witches[pageHost.phone.visiting ? 1 : 0]?.ko) return;
  if (o.use.kind === "zoo") pageHost.zoo.open(); // (a station's E and an instrument's: their panels, below in the frame and app/studio.ts)
  else if (o.use.kind === "telephone") pageHost.phone.use(game, o.id);
  else if (o.use.kind === "telescope" && tuning.telescope && !pageHost.telescope.on) { pageHost.scopeAt = o.id; pageHost.telescope.open(game, tuning.telescope); }
}); }

/** The character creator's hooks: her hat from what she owns, its progress bar, the scroll's start and spell sound. */
export function wireCreator(pageHost: PageHost): void {
  pageHost.creator.loadout = { hat: pageHost.N().game.spells.hat };
  pageHost.creator.hats = unlockAll() ? undefined : pageHost.N().game.spells.hats;
  pageHost.creator.onLoadout = l => {
    if (!pageHost.phone.active && pageHost.N().spec.borrowed) return;
    if (pageHost.phone.active) { if (!pageHost.phone.choose({ kind: "hat", id: l.hat })) pageHost.reconcilePickers(); return; }
    pageHost.mutate("dressing: loadout", () => { const { game } = pageHost.N(); changeLoadout(game.witches[0], l.hat); saveLoadout({ hat: hatWithoutLoan(game.spells.hat, pageHost.loan) as typeof game.spells.hat }); pageHost.wearHat(pageHost.page.look()); });
  };
  pageHost.creator.progress = () => { const a = pageHost.view.assets; return { done: a.done, total: a.done + a.pending, ready: !pageHost.sailing && pageHost.N().flags.ready }; }; // (a new night in place: not till it's made)
  // (its room's ambience plays while it's open: overnight, 2026-10-06)
  pageHost.creator.onGesture = () => pageHost.sound.wake();
  pageHost.creator.onStart = g => {
    if (pageHost.phone.active || pageHost.N().spec.borrowed) return; // Also protects the asynchronous borrowed-return interval.
    const who = pageHost.playerPick?.value ?? "human"; // (the dev "Player:" pick: a bot plays the run instead of her)
    if (who !== "human" && BOT_KINDS.includes(who as BotKind)) { pageHost.botGame(who as BotKind); return; }
    if (JSON.stringify(g) !== pageHost.lookNow) { pageHost.lookNow = JSON.stringify(g); pageHost.showLook(); pageHost.wearHat(g); }
    if (pageHost.start()) pageHost.queueCast();
  };
  pageHost.creator.spellSound = (cue, v) => pageHost.sound.sfx?.spell(cue, v);
}

/** The house's station panels (ui/stationPanel.ts): a look, a broom part, a trail chosen, a bag previewed, her teeth brushed, and their way out. */
export function wireStations(pageHost: PageHost): void {
  // (the bags' list: each bag firing, Juliet's BagPreview running the 💌 rules with its stats; Ed, 2026-10-29)
  pageHost.stations.preview = id => (BAGS.some(b => b.id === id) ? new BagPreview(id, { w: 220, h: 110, tuning: pageHost.N().tuning }) : null);
  pageHost.stations.onLook = (g, shelf) => {
    if (!pageHost.phone.active && pageHost.N().spec.borrowed) return;
    if (pageHost.phone.active) {
      if (pageHost.stations.station) { const choice = stationLook(pageHost.stations.station, g, shelf); if (!choice || !pageHost.phone.choose(choice)) pageHost.reconcilePickers(); }
      return; // No raw host/guest mutation or visitor wardrobe save before approval.
    }
    pageHost.mutate("dressing: station look and bag", () => {
    saveGenome(lookWithoutLoan(g as Record<string, unknown>, pageHost.loan) as never); pageHost.creator.adopt(g); // (saved without the loan: app/loan.ts)
    // (not yet dressed: a station's choice puts its piece on her, out of last night's pile: rules/clothesPile.ts; Ed, 2026-10-23; the
    // piece of the shelf it was chosen on, so the shoe rack's Trousers put on only her trousers: Ed, 2026-11-11)
    const w = pageHost.N().game.wake; if (w && pageHost.stations.station) wearFromStation(w, pageHost.stations.station, shelf);
    if (JSON.stringify(g) !== pageHost.lookNow) { pageHost.lookNow = JSON.stringify(g); pageHost.wearHat(g); setBag(pageHost.N().game.witches[0].spells, bagOf(g as Record<string, unknown>)); } // (her bag's 💌 stats follow the bag she wears: rules/bags.ts)
    pageHost.showLook();
    });
  };
  pageHost.stations.onBack = () => pageHost.shutStation("back"); // (menu.back, E by default: platform/bindings.ts; the pad's, circle, comes through padControls)
  pageHost.stations.onChange = () => { const { game } = pageHost.N(); pageHost.view.turnUntil = game.herTime + 0.8; };
  // The basin's Teeth button (Ed, 2026-11-07: "a 'brush your teeth' button that plays a short brushing animation with a little sparkle
  // and a sound, flavour only, no gameplay effect"): her brush frames facing us (render/view/witch.ts), scrubs and a glint
  // (platform/audio/chimes.ts brushTeeth) and a few sparkles at her face as it ends (ui/brushSparkle.ts). Nothing in the rules changes.
  pageHost.stations.onAction = id => {
    if (id !== "teeth") return;
    const t = pageHost.N().game.herTime;
    pageHost.view.brush.from = t; pageHost.view.brush.until = t + BRUSH; pageHost.view.turnUntil = t + BRUSH;
    pageHost.sound.sfx?.brushTeeth(0, BRUSH);
    pageHost.sparkle.play(BRUSH);
  };
  // (Ed, 2026-10-26: she twirls while her new look draws)
  pageHost.stations.onDress = () => { pageHost.view.spin = spinStep(pageHost.view.spin, pageHost.N().game.herTime); };
  // The Workshop's modding stations (Ed, 2026-10-23, one bay then; three since 2026-11-07; docs/backlog/workshop.md): a part chosen goes on her broom at once, mid-night too (its stats
  // and its set's spell with it: rules/spells.ts setParts), and is kept on this browser for the nights after (app/broomSave.ts).
  // Solo keeps fitted parts without any loan; online choices wait for host approval.
  pageHost.stations.onFit = f => {
    if (!pageHost.phone.active && pageHost.N().spec.borrowed) return;
    if (pageHost.phone.active) { if (!pageHost.phone.choose({ kind: "broom", fitted: { ...f } })) pageHost.reconcilePickers(); return; }
    pageHost.mutate("dressing: broom fitting", () => { const { game } = pageHost.N(); setParts(game.witches[0].spells, f); fitBroom(partsWithoutLoan(f, pageHost.loan)); });
  };
  // Her trail's colours (Ed, 2026-11-03: "set the colour set of your trail in the broom station and there are a few presets"; the Broom
  // station's Trail row, render/trailColours.ts): drawn at once and kept with her broom (app/broomSave.ts); cosmetic, her own view only
  // (the other player's trail isn't drawn online), so nothing waits on the host; a borrowed game's isn't kept.
  // (its row drawn from her saved broom before its hook is set, so that isn't a choice)
  { const t = loadBroom().trail ?? null; pageHost.view.trailPreset = t; pageHost.stations.setTrail(t); }
  pageHost.stations.onTrail = id => { pageHost.view.trailPreset = id; if (!pageHost.N().spec.borrowed) chooseTrail(id); };
}

/** Her DJ booth's way out and its "Get this party started" (ui/djBooth.ts). */
export function wireDjBooth(pageHost: PageHost): void {
  pageHost.booth.onBack = () => pageHost.booth.close();
  pageHost.booth.onStart = r => {
    if (pageHost.phone.active) { if (!pageHost.phone.choose({ kind: "party", id: r.id })) pageHost.reconcilePickers(); return; }
    pageHost.mutate("house: DJ party start", () => { chooseRecord(r.id); pageHost.booth.close(); startParty(pageHost.N().game, r.bpm); });
  };
}

/** The telescope's picture finer while she looks through it, and the keys let go as it opens or closes. */
export function wireTelescope(pageHost: PageHost): void {
  pageHost.telescope.onChange = on => {
    const T = pageHost.N().tuning.telescope, res = Number(new URLSearchParams(location.search).get("telescopeRes")) || (T && integratedGpu(pageHost.view.renderer.getContext()) ? T.lowGpuResolution : T?.resolution ?? 1);
    pageHost.view.pixelScale = on ? 1 / Math.max(0.25, Math.min(3, res)) : 1; // (finer than the game's pixels too: Ed, 2026-10-23, "too pixellated")
    pageHost.fit();
    pageHost.input.clearPresses();
  };
}
