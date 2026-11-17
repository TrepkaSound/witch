// One creature's turn in a fight, once it has a target (rules/combat/turn.ts): where its target is, the attack it strikes with and
// how far it wants to stand, its momentum, its pace; and the old pack bolt's aim at her. The phases of its turn (rules/combat/
// lunge.ts, packWait.ts, moves.ts, approach.ts, release.ts) read it. Split from stepCombat's loop (rules/combat.ts): the same sums
// in the same order.
import { dazeSpeed } from "../skill/poise"; // (dazed after a stagger, ?skill=1: slowed)
import { LEGEND, type Creature } from "../creatures";
import { FIGHT, landSwoop, profileOf } from "../movement";
import type { Attack, CombatData, Target } from "./data";
import { targetPos, aloftHunted } from "./targeting";
import { intercept, liftedWindup, packTrack, type AimTrack } from "../attacks/aim";
import { PACKS, ownStrike, type Directive } from "./packs";
import { momentumOf } from "../momentum";
import { type WaitingHazard } from "../combatSpacing";
import { actionReach } from "./actions";
import { advanceMotion } from "../locomotion";
import { longLunge } from "./reach";
import { reachOf, thrown, velOf } from "./strikes";
import { waitingHazardsOf } from "./waiting";
import type { Armed, Spell } from "./choose";
import type { CombatStep } from "./step";

/** Its fight, with a target. */
export type Fighting = NonNullable<Creature["fight"]> & { target: Target };

/** One creature's turn, once it has a target. */
export interface Turn {
  k: CombatStep;
  c: Creature;
  f: Fighting;
  /** Its pack's directive (rules/combat/packs.ts), if it's in one. */
  pd: Directive | undefined;
  spell: Spell | null;
  atk: Armed;
  /** She's up out of its reach over its area (rules/combat/targeting.ts aloftHunted): it waits round the point under her. */
  herAloft: boolean;
  /** Where its target is (its radius r), and how far. */
  p: { x: number; z: number; r: number };
  d: number;
  /** Its attack at its target, reaching as far as it does at it (reachOf, thrown). */
  A: Attack;
  K: CombatData["kite"];
  kites: boolean;
  /** Momentum chasing her (rules/momentum.ts), and its strikeLead. */
  mo: ReturnType<typeof momentumOf> | null;
  sl: number;
  waitingHazards: WaitingHazard[];
  /** Its attack as it is, whose reach a shooter keeps to. */
  A0: Attack;
  /** How far from its target it wants to stand. */
  want: number;
  /** Where its own move sets off from (a pack member's charge, leap or burrow), or 0. */
  ownFrom: number;
  long: { from: number; length: number } | null;
  /** Its pace (paceOf), once past its lunge and its reaction. */
  slow: number;
  own: number;
  sprint: number;
  chasing: boolean;
  heavy: boolean;
  speed: number;
}

/** Its turn, once it has a target: null if its target fell this very step. */
export function turnOf(k: CombatStep, c: Creature, f: Fighting, pd: Directive | undefined, spell: Spell | null, atk: Armed): Turn | null {
  const { s, w, data, t, time, spacing } = k;
  // Up out of its reach over its area (a hunter after her: rules/combat/targeting.ts aloftHunted): it waits round the point under
  // her (below), whatever it was doing given up as when it lost her before (a strike, a dive, a burrow, a leap, a charge).
  const herAloft = aloftHunted(w, c, f.target), under = herAloft ? w.witches[(f.target as { id: number }).id] : null;
  if (herAloft) {
    f.windupUntil = 0; f.lunge = undefined; c.charge = undefined; c.sprung = undefined; c.dug = undefined; c.brace = undefined;
    if (c.swoop) landSwoop(c, time);
    if (c.burrow) c.burrow = undefined;
    if (c.leap && advanceMotion(c, { route: c.leap }, time, 0) >= 1) c.leap = undefined;
  }
  const p = targetPos(w, s, f.target) ?? (under ? { x: under.x, z: under.z, r: 0.5 } : null);
  if (!p) { (f as NonNullable<Creature["fight"]>).target = null; f.windupUntil = 0; return null; } // (it fell this very step)
  const d = Math.hypot(p.x - c.x, p.z - c.z), A = spell ? thrown(k, spell, f.target).attack : reachOf(k, atk.attack, f.target), K = data.kite, kites = A.delivery === "shot" && K.species.includes(c.species);
  // Momentum chasing her (tuning creatureMomentum; rules/momentum.ts): its turn limit and reaction delay, and its telegraphed
  // attacks' lead times its strikeLead (lead: her velocity so scaled).
  const mo = f.target.kind === "witch" && c.level !== LEGEND ? momentumOf(c.species, t) : null, sl = mo?.strikeLead ?? 1;
  const T: Turn = { k, c, f, pd, spell, atk, herAloft, p, d, A, K, kites, mo, sl, waitingHazards: [], A0: atk.attack, want: 0, ownFrom: 0, long: null, slow: 1, own: 0, sprint: 0, chasing: false, heavy: false, speed: 0 };
  T.waitingHazards = spacing ? waitingHazardsOf(T) : [];
  // (a shooter keeps its usual distance, A0's, however far it may now fire at her: so she can still reach it with her 💌s)
  const A0 = atk.attack;
  let want = A.delivery === "shot" || A.delivery === "lob" || A.delivery === "beam" ? Math.min(A0.range * (kites ? K.far : 0.8), A.range * 0.9) : A.delivery === "pulse" ? Math.max(0.8, (A.radius ?? 2) * 0.6) : A.range + p.r + (A.lunge ?? 0) * 0.85 - 0.3;
  // A pack member whose strike is its own move (a charge, a leap, a burrow: its creature.js's `movement`), the move ready, waits its turn
  // where that move sets off from, not on top of her: where it stands, if that's in the move's reach (so its turn come it charges,
  // leaps or goes under from there: rules/combat/packs.ts).
  const om = pd && pd.move === "melee" && f.target.kind !== "sound" && time >= (c.moveReadyAt ?? 0) ? ownStrike(c.species) : null;
  const ownFrom = om && om.kind !== "swoop" ? (om.from ?? 10) * 1.4 * FIGHT.scale : 0, ownTo = om?.to ? om.to * 0.8 * (om.kind === "leap" ? FIGHT.leap.reach : 1) * FIGHT.scale : ownFrom;
  if (ownFrom) want = Math.max(want, ownFrom, Math.min(d, ownTo));
  // The long lunge (Ed, 2026-11-13; longLunge above): at her, hers or a wild one (a soundsystem's besiegers as they were), its
  // wind-up may begin long.from off, where it stops and crouches (no surge in), and its lunge runs long.length along its line.
  const long = f.target.kind !== "sound" && !ownFrom && c.level !== LEGEND ? longLunge(A, t) : null;
  if (spacing && pd?.action?.delivery === "effect") want = Math.min(want, actionReach(c, pd.action, PACKS) * 0.8);
  T.want = want; T.ownFrom = ownFrom; T.long = long;
  return T;
}

/** Its speed in a fight (Ed's motion scale pass: about the witch's): its profile's, else combat.fightRun; slowed, or a legend's.
 *  Closing in from afar (Ed: "the creatures in it should be onto me in a few seconds"), it sprints at combat.pursuitRun. */
export function paceOf(T: Turn): void {
  const { k, c, f, A, d } = T, { C, time, DA } = k, S = FIGHT.scale;
  const slow = (c.slowUntil && time < c.slowUntil ? A.slowMult ?? 0.5 : 1) * dazeSpeed(c, time), own = c.level === LEGEND ? C.legendRun : profileOf(c.species)?.speed ?? C.fightRun;
  // (Committed strikes, dodge.a: at her it closes at dodge.a.chase times its sprint wherever she is, so a fast kind can't be outwalked; a slow one still can.)
  const sprint = profileOf(c.species)?.pursuit ?? C.pursuitRun, chasing = !!DA && f.target.kind === "witch" && c.level !== LEGEND;
  const heavy = chasing && DA!.heavy.species.includes(c.species); // (a heavy: its top speed, built up at its slow acceleration in steer)
  const speed = (heavy ? DA!.heavy.speed : chasing ? Math.max(own, sprint * DA!.chase) : c.level !== LEGEND && d > 30 * S ? Math.max(own, sprint) : own) * FIGHT.speed * FIGHT.creature * slow;
  T.slow = slow; T.own = own; T.sprint = sprint; T.chasing = chasing; T.heavy = heavy; T.speed = speed;
}

/** Her velocity (the witch tg), times its strikeLead. */
export const lead = (T: Turn, tg: Target) => { const v = velOf(T.k, tg); return { vx: v.vx * T.sl, vz: v.vz * T.sl }; };
/** The old pack bolt's speed at tg (dodge.b.speed times its own at her, and at least the speed floor: rules/attacks/aim.ts). */
export const oldShotSpeed = (T: Turn, A: Attack, tg: Target) => { const { DB, FLOOR } = T.k, her = tg.kind === "witch"; return Math.max((A.speed ?? 9) * (DB && her ? DB.speed : 1), her ? FLOOR : 0); };
/** Where the old pack bolt or lob at her will meet her if it's let go `toRelease` s from now (rules/attacks/aim.ts intercept). */
export const oldIntercept = (T: Turn, A: Attack, track: AimTrack, toRelease: number) => { const { c, f, p } = T, v = oldShotSpeed(T, A, f.target), fl = A.flight ?? 1.2; return intercept({ x: p.x, z: p.z, ...velOf(T.k, f.target) }, toRelease, track.lead, (qx, qz) => (A.delivery === "lob" ? fl : Math.hypot(qx - c.x, qz - c.z) / v)); };
/** An old pack bolt or lob starting its wind-up at her: its aim followed till it locks (the same lock as every ranged attack's, its
 *  dodge.b.windup lifted where that lock couldn't hold in it). Not one in the grammar: startSpell's. */
export const aimOld = (T: Turn, A: Attack) => {
  const { c, f, spell, sl } = T, { RG, time } = T.k;
  const track = !spell && f.target.kind === "witch" ? packTrack(A.delivery, c.level, RG, sl) : undefined;
  f.aim = track ? { at: time, track } : undefined;
  if (track) f.windupUntil = time + liftedWindup(f.windupUntil - time, oldIntercept(T, A, track, f.windupUntil - time).flight, track);
};
