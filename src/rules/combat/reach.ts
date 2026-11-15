// How far a creature's strikes reach: the lunge's length (the long lunge too) and how far round its sigil a parked one guards.
// Split from rules/combat.ts (stepCombat's phases: rules/combat/); everything here is still exported from there.
import { LEGEND, type Creature } from "../creatures";
import { FIGHT } from "../movement";
import { type Tuning } from "../tuning";
import { momentumOf } from "../momentum";
import type { Attack } from "./data";

/** How far a lunge goes (m) from where it stands to its aim (aimX, aimZ), reaching `reach`: with momentum (`chasing`) right to where
 *  it aimed, up to a quarter again its reach; else stopping half its range short. Dug in: none. The strike's own reckoning (below)
 *  and its telegraph's (render/leash/combat.ts: Ed, 2026-11-02, "the end of the line is where the lunge lands"). */
export function lungeOf(c: Creature, A: Attack, reach: number, chasing: boolean, time: number, aimX: number, aimZ: number): number {
  const ad = Math.hypot(aimX - c.x, aimZ - c.z), short = chasing ? 0 : A.range * 0.5, far = chasing ? Math.max(reach, Math.min(reach * 1.25, ad)) : reach;
  return c.dug !== undefined && time < c.dug ? 0 : Math.min(far, Math.max(0, ad - short));
}
/** The long lunge (Ed, 2026-11-13: "Lunge ranges seem very short; they could be twice as long, around 1.5-2 dashes range"; asked how,
 *  "Both": it winds up from far away, and the lunge carries on through and past the spot it aimed at; tuning lunge). For a lunging
 *  attack (its own lunge at least lunge.least metres: a swipe stays a swipe), by how long its kind's lunge is (lunge.full metres and
 *  over the longest: the stoat's, the lynx's; never under lunge.shortest of that): `from`, how far off its target its wind-up may
 *  begin (lunge.from dashes), and `length`, how far the lunge then runs along its line (lunge.through dashes), not stopping where it
 *  aimed. Null: the lunge as it was (?lunge=old, a swipe, anything not a melee blow). */
export function longLunge(A: Attack, t: Tuning): { from: number; length: number } | null {
  const U = t.lunge, own = (A.lunge ?? 0) / FIGHT.scale;
  if (!U?.on || A.delivery !== "melee" || own < U.least) return null;
  const k = Math.max(U.shortest, Math.min(1, own / U.full)), dash = t.dash.distance * FIGHT.scale;
  return { from: U.from * dash * k, length: U.through * dash * k };
}
/** How much of its top waiting pace a pick for a coming round counts on making good toward its ready spot (rules/combat.ts movingGoal):
 *  the crowd's avoidance, its path's curve and its gait's turns cost the rest (measured in the challenge's 128-animal pack, 2026-11-04:
 *  about 8 m/s made good against 15 to 20 m/s top). Low, so it sets off early rather than late: waiting at its ready spot commits it
 *  to nothing. */
export const SET_OFF_PACE = 0.4;
/** A lunge wound up now: how far it will go (m), reckoned as the strike will: the long lunge's full length (longLunge; at a
 *  soundsystem, `atSound`, the lunge as it was), else lungeOf, at her with dodge.a's longer reach and her momentum. */
export function lungeLength(c: Creature, A: Attack, atWitch: boolean, t: Tuning, time: number, aimX: number, aimZ: number, atSound = false): number {
  const long = atSound ? null : longLunge(A, t);
  if (long) return c.dug !== undefined && time < c.dug ? 0 : long.length;
  const DA = t.dodge?.a.on ? t.dodge.a : null, chasing = atWitch && c.level !== LEGEND && !!momentumOf(c.species, t);
  return lungeOf(c, A, (A.lunge ?? 0) * (DA && atWitch ? DA.lunge : 1), chasing, time, aimX, aimZ);
}

/** How far round its sigil a parked party animal guards (m, before FIGHT.scale), past its sigil's area (Ed, 2026-11-04: "A parked
 *  creature should guard its chain length, now that's a fixed number, with home area an exception"): its chain's length
 *  (leash.chain.length, 80), derived from it. Parked in the home area it guards the whole home area and nothing outside it (Ed,
 *  2026-10-11), roaming it freely (Ed, 2026-11-04: rules/leash.ts roamHome), so the radius isn't used there: guard.radius (40)
 *  where asked. No chains (length 0): guard.radius everywhere. */
export const guardRadius = (t: Tuning, inHome: boolean): number => (inHome ? t.guard.radius : t.leash.chain?.length || t.guard.radius);
