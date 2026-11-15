// Tonight's find: lent till she sleeps, settled (and her dream of it), her guidance pin, the finds' keepers, and spawning one near her.
import type { PageHost } from "../main";
import type { View } from "../render/view";
import type { Game } from "../rules/game";

import { chartOpen } from "../ui/chartOverlay";
import { endDream } from "../rules/wakeUp";
import { saveGenome } from "../ui/creator";
import { saveLoadout } from "./loadout";
import { shelfOf, stationsShowing } from "../rules/wardrobe";
import { fillTrunk, findKind, spawnFind, spawnSpot, type FindKindId } from "../rules/finds";
import { fitBroom, loadBroom } from "./broomSave";
import { foundAll, keepFound, type FindsCtx } from "./finds";
import { loadOwned } from "./owned";
import { homeOf, lend, loanName, settle, withLoan, type Loan } from "./loan";
import { DreamView, dreamArt } from "../render/dream";
import { partStation } from "../rules/kit";
import { loadSave, unvisited } from "./chartSave";
import { guidanceOf, seeGuide } from "../rules/guidance";
import { addNew, dropNew, storeGuide } from "./guideSave";

/** Tonight's find taken (the "found" event): on loan till she sleeps (app/loan.ts), hers to wear or use at once, never written. */
export function lendFind(pageHost: PageHost, kind: FindKindId, id: string): void {
  const { game } = pageHost.N();
  pageHost.loan = lend(kind, id, { look: (pageHost.page.look() ?? pageHost.creator.genome()) as Record<string, unknown> | null, hat: game.spells.hat, parts: game.witches[0].spells.parts });
  if (kind === "wearable" || kind === "bag") findsCtx(pageHost).owned().add(id); // (in what she owns tonight, not in her save)
  pageHost.view.partsFound = partsNow(pageHost.loan);
  // (new in the treehouse: her guidance pin over where it is till she's been there, rules/guidance.ts)
  const at = kind === "part" ? partStation(id) : kind === "hat" ? "hats" : stationsShowing(shelfOf(id)?.id ?? "")[0];
  if (at) { addNew(pageHost.guide, { kind: kind === "part" || kind === "hat" ? kind : "wearable", id, at }); storeGuide(pageHost.guide); }
}

/** The loan settled as she sleeps (the bed, a sail; Ed, 2026-10-24): the night won, kept for good (its kind's own save, and what she
 *  has on of it with it); not, gone back to the sky, what she has on of it back to what she had before. What her dream shows, or
 *  null with nothing on loan. */
export function settleLoan(pageHost: PageHost, won: boolean): { loan: Loan; won: boolean } | null {
  return pageHost.mutate("finds: settle loan", () => settleLoanNow(pageHost, won));
}

export function settleLoanNow(pageHost: PageHost, won: boolean): { loan: Loan; won: boolean } | null {
  const l = pageHost.loan, { game } = pageHost.N();
  if (!l) return null;
  pageHost.loan = null;
  const look = (pageHost.page.look() ?? pageHost.creator.genome()) as Record<string, unknown> | null;
  const woke = settle(l, won, { look, hat: game.spells.hat, parts: game.witches[0].spells.parts }, {
    keep: (kind, id) => keepFound(findsCtx(pageHost), kind, id), look: g => saveGenome(g as never), hat: h => saveLoadout({ hat: h as typeof game.spells.hat }), parts: f => fitBroom(f),
  });
  if (woke && woke !== look) { pageHost.creator.adopt(woke); pageHost.lookNow = JSON.stringify(woke); }
  if (!won) { pageHost.owned = null; dropNew(pageHost.guide, l.id); storeGuide(pageHost.guide); } // (read afresh from her save, the loan not in it; gone back to the sky, no longer new)
  pageHost.view.partsFound = partsNow(pageHost.loan);
  return { loan: l, won };
}

/** Her dream of a settled loan shown (`veil`: over a night not asleep, its own dark under it). */
export function startDream(pageHost: PageHost, s: { loan: Loan; won: boolean }, veil = false): void {
  pageHost.dream?.dispose();
  const of = { item: s.loan.id, name: loanName(s.loan), piece: findKind(s.loan.kind).piece(s.loan.id), won: s.won, home: homeOf(s.loan, id => stationsShowing(shelfOf(id)?.id ?? "")) };
  pageHost.dream = new DreamView(of, dreamArt(of, pageHost.view.assets.style), veil, () => herHead(pageHost.view, pageHost.canvas, pageHost.N().game)).play(veil && pageHost.params.has("shot"));
  pageHost.dreamAsleep = !veil; // (asleep: its end rings the next night's alarm; shown over a night, ?dream= or the dev panel, nothing)
  pageHost.dream.onOver = () => { const n = pageHost.page.night; if (!pageHost.phone.active && !n?.spec.borrowed && pageHost.dreamAsleep && n?.game.wake) pageHost.mutate("wake: dream dismissed", () => endDream(n.game, n.game.herTime)); };
  (window as unknown as { __dream?: DreamView }).__dream = pageHost.dream; // (the shot tools draw it at a time: tools/loan/shots.cjs)
}

/** Her head's top on the page (CSS px) as last drawn (render/view/witch.ts herHead), for her dream's cloud to rise from; null
 *  before she's drawn. */
export function herHead(view: View, canvas: HTMLCanvasElement, game: Game): { x: number; y: number } | null {
  const H = view.herHouseHead, w = game.witch;
  if (w.perch && H.at > 0) return { x: H.x, y: H.y }; // (in the house: as its labels are placed; kept while the next island is made)
  const h = view.herHead, r = canvas.getBoundingClientRect();
  return h.on ? { x: r.left + h.x * r.width, y: r.top + (1 - h.y) * r.height } : null;
}

/** Her guidance pin this frame (rules/guidance.ts): what's next, over it, while she's in the treehouse and not at it. */
export function stepGuide(pageHost: PageHost, now: number): void {
  const game = pageHost.phone.presented(pageHost.N().game);
  if (!pageHost.phone.visiting && !pageHost.N().spec.borrowed && seeGuide(game, 0, pageHost.guide)) storeGuide(pageHost.guide);
  if (now - pageHost.chartFound.at > 1000) pageHost.chartFound = { at: now, unvisited: unvisited(loadSave(), pageHost.N().tuning.map?.island ?? "home") }; // (where she is counts as been to: app/chartSave.ts unvisited)
  const G = guidanceOf(game, 0, pageHost.guide, pageHost.chartFound.unvisited);
  pageHost.guidePin.update(G, !!G && !pageHost.creator.open && !chartOpen() && !pageHost.sailing); // (wherever she is, at its target too: Ed, 2026-10-28)
}

/** The broom parts she has tonight: those she's found, and a part on loan. */
export function partsNow(loan: Loan | null): Set<string> { return withLoan("part", new Set(loadBroom().found), loan); }

/** What the finds' keepers work on (app/finds.ts): tonight's spells and what she owns to wear, kept. */
export function findsCtx(pageHost: PageHost): FindsCtx { return ({ spells: pageHost.N().game.spells, owned: () => (pageHost.owned ??= withLoan("wearable", loadOwned((pageHost.page.look() ?? pageHost.creator.genome()) as Record<string, unknown>), pageHost.loan)) }); }

export function spawnHere(pageHost: PageHost, kind: FindKindId | null, item: string | null): string {
  if (pageHost.phone.active) return "Find spawning is unavailable during a call.";
  return pageHost.mutate("debug: spawn find", () => spawnHereNow(pageHost, kind, item));
}

export function spawnHereNow(pageHost: PageHost, kind: FindKindId | null, item: string | null): string {
  const g = pageHost.N().game, at = spawnSpot(g);
  if (!at) return "no clear ground within 12 m of her (in the treehouse? step out onto the island)";
  if (kind && item) return spawnFind(g, kind, item, at) ? `${kind} ${item} spawned ${Math.round(Math.hypot(at.x - g.witch.x, at.z - g.witch.z))} m from her` : `no ${kind} ${item}`;
  if (g.trunk && g.trunk.item === null) fillTrunk(g, foundAll(findsCtx(pageHost)));
  if (!g.trunk?.item || g.trunk.found) return "no find tonight (all found, or taken)";
  const c = g.map.cellSafe(at.x, at.z).cell;
  Object.assign(g.trunk, { x: at.x, z: at.z, cell: [c[0], c[1]] });
  return `tonight's ${g.trunk.kind} ${g.trunk.item} moved next to her`;
}
