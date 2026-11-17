// Openings (?skill=1; docs/plans/combat-skill-and-commands.md, sections 1 and 5; Ed, 2026-11-17: "go for the prototype"): for the
// species with a profile (rules/skill/profile.ts: the hare, the badger, the dormouse), a sit after each attack, poise worn by her
// letters (more during a wind-up), a stagger when it breaks (cancelling a wind-up), then a daze that slows it; and the open cue
// the view draws from them. Ed, 2026-11-17: "I don't think one letter should ever count for more than one hit. A hit is a letter.
// But e.g. a buff could make you shoot twice as fast, or slow or daze a creature down so that it's easier to hit." So nothing here
// touches the meter: a letter counts its one hit as ever (rules/affection.ts), and is noted here besides. All state is on the
// creature (Creature.skill), on the world's clock; the letters are counted as they land and worn at the creature's next turn.
import type { Creature } from "../creatures";
import type { Tuning } from "../tuning";
import { poiseLetters, skillOn, skillProfile, type SkillProfile } from "./profile";

/** A creature's openings state (Creature.skill), made the first time a letter lands on it with ?skill=1. */
export interface SkillState {
  /** Poise left, in letters (full: profile poise.letters). */
  poise: number;
  /** When a letter last wore it (its refill waits poise.regenDelay from then). */
  hitAt: number;
  /** Letters landed since its last turn, worn then. */
  letters?: number;
  /** Staggered till then: it stands still, its wind-up (if any) cancelled. */
  staggerUntil?: number;
  /** Dazed till then, after the stagger: slowed to daze.speed. */
  dazeUntil?: number;
  /** Its poise can't break again till then. */
  immuneUntil?: number;
  /** A melee strike let go: it sits this long once its lunge is over. */
  sitAfterLunge?: number;
}

/** Its profile while openings are on and it's wild (hers never stagger), else null. */
const profileNow = (c: Creature, t: Tuning): SkillProfile | null => (skillOn(t) && !c.leashed && !c.boss ? skillProfile(c.species, c.level) : null);

/** A letter of hers landed on it (rules/invites.ts love): counted, to wear its poise at its next turn. One hit on the meter as ever. */
export function noteLetter(c: Creature, t: Tuning): void {
  const P = profileNow(c, t);
  if (!P) return;
  const s = (c.skill ??= { poise: poiseLetters(P, c.level, t), hitAt: -Infinity });
  s.letters = (s.letters ?? 0) + 1;
}

/** Winding up an attack now. */
export const windingUp = (c: Creature, time: number): boolean => !!c.fight && c.fight.windupUntil > time;

/** Its turn's openings (rules/combat/standby.ts, every creature about, each step): a sit after its lunge, its poise refilling, and the
 *  letters since its last turn worn, breaking it into a stagger. */
export function stepSkill(c: Creature, time: number, dt: number, t: Tuning): void {
  const s = c.skill;
  if (!s) return;
  const P = profileNow(c, t);
  if (!P) { c.skill = undefined; return; }
  if (s.sitAfterLunge !== undefined && !c.fight?.lunge) { c.sitUntil = time + s.sitAfterLunge; s.sitAfterLunge = undefined; c.vx = 0; c.vz = 0; c.moving = false; }
  const full = poiseLetters(P, c.level, t);
  if (!s.letters && time - s.hitAt >= P.poise.regenDelay) s.poise = Math.min(full, s.poise + (full * dt) / Math.max(1e-6, P.poise.regenTime));
  for (let n = s.letters ?? 0; n > 0; n--) {
    if (time < (s.immuneUntil ?? -Infinity)) break;
    s.poise -= windingUp(c, time) ? P.poise.windup : 1;
    s.hitAt = time;
    if (s.poise <= 1e-9) { breakPoise(c, s, P, full, time); break; }
  }
  s.letters = undefined;
}

/** Its poise broken: staggered (its wind-up, or a lunge under way, called off), then dazed; it can't break again for stagger.immune. */
function breakPoise(c: Creature, s: SkillState, P: SkillProfile, full: number, time: number): void {
  s.staggerUntil = time + P.stagger.time; s.dazeUntil = s.staggerUntil + P.daze.time; s.immuneUntil = s.staggerUntil + P.stagger.immune;
  s.poise = full; s.sitAfterLunge = undefined;
  const f = c.fight;
  if (f && P.stagger.cancels && (f.windupUntil > time || f.lunge)) {
    f.windupUntil = 0; f.windupAt = undefined; f.spellCast = undefined; f.aim = undefined; f.lunge = undefined; // (the engine drops its cast: rules/attacks/combatWorld.ts stillCasting)
    f.readyAt = Math.max(f.readyAt, s.staggerUntil + 0.3);
  }
  c.vx = 0; c.vz = 0; c.moving = false;
}

/** Staggered now: it holds still (rules/combat/standby.ts). */
export const staggered = (c: Creature, time: number): boolean => !!c.skill?.staggerUntil && time < c.skill.staggerUntil;

/** Its speed's share while dazed after a stagger (rules/combat/fighter.ts paceOf): daze.speed, else 1. */
export function dazeSpeed(c: Creature, time: number): number {
  const s = c.skill;
  if (!s?.dazeUntil || time >= s.dazeUntil || time < (s.staggerUntil ?? 0)) return 1;
  return skillProfile(c.species, c.level)?.daze.speed ?? 1;
}

/** Its strike let go (rules/combat/release.ts): with openings on and a profile, it sits sit.time (after its lunge, a melee one) and
 *  this returns true; else false (the hare's own sit as before: tuning hareStamp.sit). */
export function sitAfter(c: Creature, melee: boolean, time: number, t: Tuning): boolean {
  const P = profileNow(c, t);
  if (!P) return false;
  if (P.sit.time <= 0) return true;
  if (melee) (c.skill ??= { poise: poiseLetters(P, c.level, t), hitAt: -Infinity }).sitAfterLunge = P.sit.time;
  else { c.sitUntil = time + P.sit.time; c.vx = 0; c.vz = 0; c.moving = false; }
  return true;
}

/** How open it is, 0 to 1, for the open cue (render/openCue.ts; Ed, 2026-11-17, answer 8: "a glint or outline on the creature's
 *  sprite"): full while it sits or is staggered, fading through its daze, faint while it winds up (its poise breakable), else 0. */
export function openness(c: Creature, time: number, t: Tuning): number {
  const P = profileNow(c, t);
  if (!P) return 0;
  const s = c.skill;
  if (staggered(c, time) || (c.sitUntil !== undefined && time < c.sitUntil)) return 1;
  if (s?.dazeUntil && time < s.dazeUntil) return 0.25 + 0.55 * ((s.dazeUntil - time) / Math.max(1e-6, P.daze.time));
  if (windingUp(c, time) && time >= (s?.immuneUntil ?? -Infinity)) return 0.35;
  return 0;
}

/** Its poise's share left (0 to 1) for the view's arc, or null when there's nothing to show (full, or no openings). */
export function poiseShare(c: Creature, t: Tuning): number | null {
  const P = profileNow(c, t), s = c.skill;
  if (!P || !s) return null;
  const k = Math.max(0, Math.min(1, s.poise / poiseLetters(P, c.level, t)));
  return k >= 0.999 ? null : k;
}
