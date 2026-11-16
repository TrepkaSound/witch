// The frame check's stepped scenes put in place (app/frameCheck.ts has the scenes, app/frameCheckRun.ts runs them on the page): her
// broom, the debug arena, the quick shot. Apart from the runner so a test can put the same scenes in place on a game with no page.
import type { Game } from "../rules/game";
import { takeBroom } from "../rules/kit";
import type { FrameCheckScene } from "./frameCheck";

/** What it needs of the page's hooks (window.witch: app/hooks.ts). */
export interface FrameCheckPlacer {
  readonly game: Game;
  arena(spec: string): void;
  shot(scene: string): { ok: boolean; say: string } | undefined;
}

/** Puts a stepped scene in place before its frames; why it's left out, or null.
 *  Her broom first (Ed, 2026-11-16: "The frame check test has the witch walking off the treehouse repeatedly I think because she has
 *  no broom yet"; "she should probably collect her broom and then do the test rather than avoid collecting it"): the check's night
 *  waits for her party spell, so she has none till it's taken (rules/kit.ts), and without one a step off the Terrace's rim is a fall
 *  and back to the magic circle, not a take-off. Taken as E at the rack takes it.
 *  The arena moves her but leaves her as she was: on the house's floor (run by itself she's still at her decks) she'd be put back
 *  onto it by her next step, so she's taken off it, and out of any fall. */
export function placeFrameCheckScene(w: FrameCheckPlacer, s: FrameCheckScene): string | null {
  if (s.broom) takeBroom(w.game, w.game.witches[0]);
  if (s.arena) {
    w.arena(s.arena);
    const { perch: _perch, perchCool: _cool, falling: _falling, fallOrigin: _origin, ...body } = w.game.witch;
    w.game.witch = body;
  }
  if (s.shot) { const r = w.shot(s.shot); if (r && !r.ok) return r.say; }
  return null;
}
