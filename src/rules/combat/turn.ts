// One creature's turn in a fight, each step (rules/combat.ts stepCombat runs it for every creature about): its phases in order.
// Each phase is its own file under rules/combat/; this reads as their table of contents. Split from stepCombat's loop: the same
// steps in the same order (each `return` here was the loop's `continue`).
import { LEGEND, type Creature } from "../creatures";
import { FIGHT, landSwoop, legendSetOf } from "../movement";
import { stepLegend } from "./legend";
import { standby, hidden, swoops } from "./standby";
import { attackFor, chooseTarget, idle } from "./choose";
import { paceOf, turnOf, type Fighting } from "./fighter";
import { reacting, stepLunge } from "./lunge";
import { waitRound } from "./waiting";
import { packWait } from "./packWait";
import { movesOf, signatureMove } from "./moves";
import { closeIn, steerAndStrike } from "./approach";
import { release, windUp } from "./release";
import type { CombatStep } from "./step";

/** One creature's turn this step: held or not, armed or not, its target, then its lunge, its look, its waiting, its legend's moves,
 *  its kind's own move, its approach, its wind-up and its strike let go. */
export function creatureTurn(k: CombatStep, c: Creature): void {
  const { s, w, data, grid, time } = k;
  // Knocked about, gone, dazed, running off, a legend shooting from afar, out of the fight, stunned or sitting: its turn is over.
  const aloft = standby(k, c);
  if (aloft === undefined) return;
  const pd = c.spell === undefined ? k.PK?.get(c.id) : undefined; // (one given an attack in the grammar (the arena's) fights on its own; a species' own keeps its pack's turns)
  if (c.packHide && k.PK) { hidden(k, c, aloft); return; } // (up a tree, underground, under water: making its way round)
  // A bound already advanced above owns this step, including its landing step.
  // Steering again here adds a second displacement and an attack can interrupt
  // the arc, then snap back onto it next step.
  if (aloft) return;
  const { spell, atk } = attackFor(k, c, pd);
  if (!atk) { c.fight = undefined; return; } // babies don't attack
  const f = (c.fight ??= { target: null, readyAt: time + atk.attack.cooldown * 0.5 * (c.rand() + 0.5), windupUntil: 0, aimX: 0, aimZ: 0 });
  chooseTarget(k, c, f, atk);
  if (!f.target) { idle(k, c, f); return; }
  const T = turnOf(k, c, f as Fighting, pd, spell, atk);
  if (!T) return; // (it fell this very step)
  if (f.lunge) { stepLunge(T); return; } // (its lunge under way)
  if (reacting(T)) return;
  paceOf(T);
  // A pack member falling back in its lull, a hurt one keeping away (rules/combat/packs.ts); dug in (the badger's cover, its hold), it
  // stands, biting what comes in reach when its pack lets it.
  if (!pd?.slot || pd.phase !== "lull") c.packProwl = undefined; // (a new lull's prowl starts from its place)
  // She's up out of reach over its area (herAloft): it does as it would waiting its turn to attack, round the point under
  // her, and nothing else; none of its strikes start (Ed, 2026-11-03: "I suggest that they just act how they would when they're
  // waiting to attack"). Its team holds in its lull meanwhile (rules/combat/teams.ts), so her landing starts a fresh round.
  if (T.herAloft) { if (!c.hop && !c.leap) waitRound(T, false); return; }
  if (pd && f.windupUntil === 0 && !c.charge && !c.leap && !c.burrow && !swoops(c) && packWait(T)) return; // (a flyer in a pack circles aloft through its lull: below)
  // A wild legend fights by its move set (Stage 5): long, telegraphed moves in a pattern, and a second phase.
  if (c.level === LEGEND && !c.leashed && !(f.target.kind === "sound" && T.d > 40 * FIGHT.scale)) { stepLegend(w, s, c, f, T.p, T.d, legendSetOf(c.species), data, grid); return; }
  const M = movesOf(T);
  if (f.windupUntil === 0 && M.P && !M.marching) {
    // A movement profile (Stage 5): its signature move, then its behaviours and its pack's tactic.
    if (!signatureMove(T, M)) steerAndStrike(T, M);
    return;
  }
  if (c.swoop) landSwoop(c, time); // (a flyer marching on a soundsystem far off, or a party one: on the ground)
  if (f.windupUntil === 0) { closeIn(T, M); return; }
  const wound = windUp(T);
  if (!wound) return;
  release(T, wound.aimed);
}
