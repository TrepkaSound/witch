// Calls and visits (the telephone, Ed's online play): the telephone station's session hooks, the host's and the guest's, and the
// ordinary visit's lifecycle, its own night kept aside while she plays in a friend's (app/visitLifecycle.ts).
import type { PageHost } from "../main";
import type { borrowedNightSaves } from "./nightSave";
import { hostCollections, nightInPlace, personalKit } from "./pageNight";
import { notable } from "../platform/playtestJournal";
import { findsCtx, partsNow } from "./pageFinds";
import { reconcilePickers, workshopNow } from "./pageStations";
import { telephoneStation } from "./telephoneStation";
import { visitHome } from "./visitHome";
import { telephoneNotice, telephoneTrouble } from "../ui/telephone";
import { guestAccess } from "../platform/online/guestAccess";
import { visitSaves } from "./visitSaves";
import { visitLifecycle, synchronizeVisit } from "./visitLifecycle";
import { visitUnlocks } from "./visitUnlocks";
import { stationAuthority } from "../platform/online/stationAuthority";
import { appearance } from "../platform/online/appearance";
import { won } from "../rules/win";
import { withSharedFind } from "./sharedFindLoan";
import { browserSaveSlots } from "./saveSlots";
import { bagOf, setBag } from "../rules/bags";
import { classicPalette, saveGenome } from "../ui/creator";
import { saveLoadout } from "./loadout";
import { setParts } from "../rules/spells";
import { changeLoadout } from "../rules/hatSpells";
import { syncFloorHats } from "../rules/houseRooms";
import { fitBroom } from "./broomSave";
import { loadOwned } from "./owned";
import { ownedToChoose, unlockAll } from "./debugUnlock";
import { hatWithoutLoan, lookWithoutLoan, partsWithoutLoan } from "./loan";
import { chooseRecord, ownedRecords } from "./recordSave";
import { localStore } from "../platform/storageScope";
import { startNight } from "./night";
import { nightFromHref, nightHref } from "./sail";
import { logCaughtError } from "../platform/playtestLog";
import { recordedStep } from "./recordingHooks";

/** The telephone station (app/telephoneStation.ts) and its session's hooks: what she looks like to a friend, the guest room, a
 *  visit's unlocks and loan settled as it ends, the host's approval of a station's choice. (`lifecycleEvidence`: ?shot= only.) */
export function makeTelephone(pageHost: PageHost, lifecycleEvidence: ((proof: Record<string, unknown>) => void) | undefined) {
  return telephoneStation({ lifecycleEvidence, enabled: pageHost.phoneEnabled, callsEnabled: pageHost.phoneCallsEnabled, face: pageHost.phoneFace, trouble: telephoneTrouble, clearFaces: () => { pageHost.phoneFaces.clear(); pageHost.phonePresence.refresh(); }, digit: digit => { if (pageHost.phone.state.status !== "preparing") pageHost.phoneSounds.digit(digit); }, storage: localStore(), session: {
    lifecycleEvidence,
    build: pageHost.BUILD, hostGame: () => pageHost.N().game,
    trace: (stage, detail) => traceVisit(pageHost.visitPreparation, stage, detail),
    predictionEvidence: pageHost.params.has("shot") ? proof => { window.dispatchEvent(new CustomEvent("witch-prediction-evidence", { detail: proof })); } : undefined,
    protocolEvidence: pageHost.params.has("shot") ? proof => { window.dispatchEvent(new CustomEvent("witch-protocol-evidence", { detail: proof })); } : undefined,
    appearance: () => { pageHost.sharedLoans.begin(personalKit(pageHost), pageHost.loan); if (!pageHost.phone.visiting) pageHost.sharedLoans.observe(pageHost.N().game, personalKit(pageHost)); return appearance(pageHost.page.look()) ?? appearance({}); },
    attach: game => { if (!guestAccess.ready) throw new Error("The guest room isn't ready yet."); pageHost.callArrival.attach(game); if (pageHost.remoteArt.has(1)) void pageHost.remoteArt.start(game, 0).catch(error => { logCaughtError(error, "host remote appearance"); pageHost.phone.hangUp(); }); },
    detach: game => pageHost.callArrival.detach(game),
    continuedHost: (previous, next) => {
      pageHost.callArrival.continued(previous, next);
      if (pageHost.remoteArt.has(1)) void pageHost.remoteArt.start(next, 0).catch(error => { logCaughtError(error, "host continued remote appearance"); pageHost.phone.hangUp(); });
    },
    prepareGuest: (game, signal, advanced, continuing) => {
      if (!pageHost.ordinaryVisit) { traceVisit(pageHost.visitPreparation, "save-boundary:unavailable"); return Promise.reject(new Error("This browser isn't ready to protect your saved night.")); }
      if (continuing) { pageHost.completedGuestNights.push(visitUnlocks(pageHost.N().game, 1)); return pageHost.ordinaryVisit.nextNight(game, signal, advanced); }
      pageHost.completedGuestNights.length = 0;
      return pageHost.ordinaryVisit.prepare(game, signal, advanced);
    },
    synchronized: game => { if (pageHost.ordinaryVisit) void synchronizeVisit(pageHost.ordinaryVisit, game, error => { logCaughtError(error, "visit confirmation"); pageHost.phone.hangUp(); }); },
    ended: (role, game) => {
      if (role === "host") pageHost.phone.hangUp("host-session-ended"); // Close the role-bearing socket on departure, not only its game session.
      pageHost.remoteArt.clear();
      if (role === "guest") {
        try { pageHost.returnedUnlocks = game && game.witches.some(w => w.id === 1) ? visitUnlocks(game, 1) : null; }
        catch (error) { pageHost.returnedUnlocks = null; logCaughtError(error, "visit unlock capture"); }
        pageHost.sharedLoans.finish(false, personalKit(pageHost), true);
        void pageHost.ordinaryVisit?.end().catch(error => logCaughtError(error, "visit return"));
      } else if (game) {
        try { pageHost.hostedUnlocks = visitUnlocks(game, 0); }
        catch (error) { pageHost.hostedUnlocks = null; logCaughtError(error, "host unlock capture"); }
        const success = won(game), kit = personalKit(pageHost, game);
        if (success && kit.hats) kit.hats = [...withSharedFind(game, "hat", new Set(kit.hats))];
        const restored = pageHost.sharedLoans.finish(success, kit); pageHost.loan = restored.loan;
        const W = game.witches[0]; changeLoadout(W, restored.kit.hat); setParts(W.spells, { ...restored.kit.parts }); setBag(W.spells, bagOf(restored.kit.look)); W.spells.hats = restored.kit.hats; syncFloorHats(W);
        pageHost.lookNow = JSON.stringify(restored.kit.look); pageHost.creator.adopt(restored.kit.look); pageHost.shownLook = ""; pageHost.owned = null;
        if (success && pageHost.hostedUnlocks) {
          const collection = loadOwned(lookWithoutLoan(restored.kit.look, pageHost.loan));
          pageHost.hostedUnlocks.apply(browserSaveSlots(), { spells: W.spells, owned: () => collection }); pageHost.hostedUnlocks = null;
          saveGenome(lookWithoutLoan(restored.kit.look, pageHost.loan) as never); saveLoadout({ hat: hatWithoutLoan(W.spells.hat, pageHost.loan) as typeof W.spells.hat }); fitBroom(partsWithoutLoan(W.spells.parts, pageHost.loan));
        }
        pageHost.creator.hats = unlockAll() ? undefined : W.spells.hats; pageHost.creator.loadout = { hat: W.spells.hat }; pageHost.view.partsFound = partsNow(pageHost.loan);
        pageHost.stations.reconcile(restored.kit.look as never, ownedToChoose(findsCtx(pageHost).owned()), workshopNow(pageHost)); pageHost.booth.refresh(ownedRecords());
      }
    },
    failed: error => { pageHost.visitPreparation.failure = error.message; logCaughtError(error, "telephone session"); pageHost.phone.hangUp("session-error"); telephoneNotice(error.message); },
    advanceHost: (game, controls, dt) => recordedStep(game, controls, dt, pageHost.BUILD, pageHost.captureRecording),
    authorizeStation: stationAuthority(game => hostCollections(pageHost, game)),
    wardrobe: () => hostCollections(pageHost, pageHost.N().game).wardrobe,
    catalogue: () => { const shared = hostCollections(pageHost, pageHost.N().game); return { wardrobe: [...shared.wardrobe], parts: [...shared.parts], hats: [...shared.hats], records: [...shared.records] }; },
    catalogueApplied: catalogue => { pageHost.creator.hats = catalogue.hats as typeof pageHost.creator.hats; pageHost.view.partsFound = new Set(catalogue.parts); reconcilePickers(pageHost); },
    stationResolved: (player, choice, accepted) => {
      if (player !== (pageHost.phone.visiting ? 1 : 0)) return;
      reconcilePickers(pageHost);
      if (accepted) return;
      const others = pageHost.N().game.witches.filter(w => w.id !== player);
      if (choice.kind === "hat" && choice.id !== "none" && others.some(w => w.spells.hat === choice.id)) telephoneNotice("Your friend is using that hat.");
      if (choice.kind === "broom" && others.some(w => Object.values(choice.fitted).some(id => id !== null && Object.values(w.spells.parts ?? {}).includes(id)))) telephoneNotice("Your friend is using that broom part.");
    },
    stationPalette: () => classicPalette(pageHost.style),
    stationApplied: (player, choice) => {
      if (choice.kind === "party") { pageHost.booth.close(); if (!pageHost.phone.visiting && ownedRecords().includes(choice.id)) chooseRecord(choice.id); }
      if (player !== (pageHost.phone.visiting ? 1 : 0)) return;
      const witch = pageHost.N().game.witches[player]; if (!witch) return;
      if (choice.kind === "hat") {
        pageHost.creator.loadout = { hat: witch.spells.hat };
        if (!pageHost.phone.visiting) saveLoadout({ hat: pageHost.sharedLoans.forSave(personalKit(pageHost)).hat as typeof witch.spells.hat });
      } else if (choice.kind === "broom" && !pageHost.phone.visiting) fitBroom(pageHost.sharedLoans.forSave(personalKit(pageHost)).parts);
    },
    appearanceApplied: (player, look) => {
      if (player !== (pageHost.phone.visiting ? 1 : 0) && pageHost.phone.state.peer) { pageHost.phoneFaces.remember(pageHost.phone.state.peer, look); pageHost.phonePresence.refresh(); }
      if (player === (pageHost.phone.visiting ? 1 : 0)) {
        pageHost.lookNow = JSON.stringify(look); pageHost.creator.adopt(look as never); pageHost.showLook();
        if (!pageHost.phone.visiting) saveGenome(pageHost.sharedLoans.forSave(personalKit(pageHost)).look as never);
        return; // The local witch uses the normal artwork; only approved host wardrobe changes persist.
      }
      void pageHost.remoteArt.look(player, look).then(() => {
        if (pageHost.phone.active && !pageHost.phone.visiting && pageHost.N().game.witches.length === 2) return pageHost.remoteArt.start(pageHost.N().game, 0);
      }).catch(error => { logCaughtError(error, "remote appearance"); pageHost.phone.hangUp(); });
    },
  } });
}

/** The ordinary visit (app/visitLifecycle.ts): her own night and look kept, a friend's night adopted as a borrowed one, and her own
 *  back when it ends (`fresh`: a new morning of her own, the visit's unlocks applied). */
export function makeOrdinaryVisit(pageHost: PageHost, nightSaves: ReturnType<typeof borrowedNightSaves>) {
  return visitLifecycle({
  saves: visitSaves(browserSaveSlots(), nightSaves),
  own: () => ({ night: pageHost.N(), href: location.href, look: pageHost.page.look() as Record<string, unknown> | null, loan: structuredClone(pageHost.loan) }),
  adoptBorrowed: async (game, signal, advanced) => {
    pageHost.visitPreparation.progress = 0; pageHost.visitPreparation.failure = "";
    const reportAdvance = () => { pageHost.visitPreparation.progress++; pageHost.visitPreparation.advancedAt = performance.now(); advanced(); };
    signal.throwIfAborted(); pageHost.sailing = true; pageHost.input.release(); pageHost.input.clearPresses();
    pageHost.loan = null; pageHost.owned = null; // Own private pageHost.loan is retained in the lifecycle snapshot, never reused as a host-world pageHost.loan.
    const p = new URLSearchParams(pageHost.N().params); p.delete("arrive");
    await startNight(pageHost.page, { how: "bed", island: game.tuning.map?.island ?? "home", seed: game.seed, world: game.tuning.map?.world, params: p, resume: game, borrowed: true });
    pageHost.seedEl.innerHTML = `seed <a href="?seed=${pageHost.N().seed}">${pageHost.N().seed}</a>`;
    reportAdvance(); signal.throwIfAborted();
    if (pageHost.remoteArt.has(0)) { await pageHost.remoteArt.start(game, 1, signal); reportAdvance(); }
    const markAt = performance.now(), timingAt = pageHost.view.assets.timings.length;
    const landedAt = new Set([...pageHost.view.assets.typeLog].filter(([, v]) => v.landed !== undefined).map(([id]) => id)); let best = 0;
    const progress = () => {
      const completed = performance.getEntriesByType("mark").filter(m => m.startTime >= markAt && (m.name.startsWith("witch:prep-") || m.name.startsWith("witch:build-"))).length
        + Math.max(0, pageHost.view.assets.timings.length - timingAt) + [...pageHost.view.assets.typeLog].filter(([id, v]) => !landedAt.has(id) && v.landed !== undefined).length;
      if (completed > best) { best = completed; reportAdvance(); }
    };
    const timer = setInterval(progress, 500), clear = () => clearInterval(timer);
    signal.addEventListener("abort", clear, { once: true });
    try { await pageHost.view.prepare(); signal.throwIfAborted(); reportAdvance(); }
    finally { clear(); signal.removeEventListener("abort", clear); }
  },
  playing: game => {
    if (pageHost.page.night?.game !== game) throw new Error("The prepared visit was replaced.");
    pageHost.page.night.flags.ready = pageHost.page.night.flags.landed = true; pageHost.page.night.flags.last = 0;
    pageHost.startedNights.add(game); pageHost.input.clearPresses(); pageHost.sailing = false;
  },
  adoptOwn: async (own, fresh) => {
    pageHost.loan = structuredClone(own.loan); pageHost.owned = null;
    pageHost.lookNow = JSON.stringify(own.look); pageHost.creator.adopt(own.look as never); pageHost.shownLook = "";
    pageHost.creator.hats = unlockAll() ? undefined : own.night.game.spells.hats; pageHost.view.partsFound = partsNow(pageHost.loan);
    if (fresh) {
      const ownCollection = loadOwned(lookWithoutLoan(own.look, own.loan));
      for (const outcome of pageHost.completedGuestNights) outcome.apply(browserSaveSlots(), { spells: own.night.game.spells, owned: () => ownCollection });
      pageHost.completedGuestNights.length = 0;
      pageHost.returnedUnlocks?.apply(browserSaveSlots(), { spells: own.night.game.spells, owned: () => ownCollection });
      pageHost.returnedUnlocks = null; pageHost.owned = null;
      const href = nightHref("bed", own.href); await nightInPlace(pageHost, nightFromHref("bed", href), href); syncFloorHats(pageHost.N().game.witches[0]);
      const homePhone = visitHome(pageHost.N().game); pageHost.input.release(); pageHost.input.clearPresses();
      if (homePhone) await pageHost.phone.returnHome(pageHost.N().game, homePhone);
    } else {
      pageHost.returnedUnlocks = null;
      const restored = await startNight(pageHost.page, { ...own.night.spec, how: "bed", resume: own.night.game, borrowed: false });
      pageHost.seedEl.innerHTML = `seed <a href="?seed=${restored.seed}">${restored.seed}</a>`;
      syncFloorHats(restored.game.witches[0]); await pageHost.view.prepare(); Object.assign(restored.flags, own.night.flags, { last: 0 }); pageHost.sailing = false; pageHost.input.clearPresses();
    }
  },
});
}

/** A visit's preparation, stage by stage (the telephone proofs read it; the L log gets each stage). */
export function traceVisit(prep: { stage: string; at: number; failure: string }, stage: string, detail?: unknown): void {
  prep.stage = stage; prep.at = performance.now();
  const message = (detail as { message?: unknown } | undefined)?.message;
  if (typeof message === "string") prep.failure = message.slice(0, 500);
  notable("telephone-preparation", stage, detail);
}
