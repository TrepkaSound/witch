// Sieges: a soundsystem rising, its besiegers' march, and marching on after a fall (DESIGN.md "Combat, pacing and forecasting").
// Split from rules/combat.ts; everything here is still exported from there.
import { LEGEND, type Creature } from "../creatures";
import { type Cell } from "../partition";
import { enrage } from "../creatureStates";
import { profileOf } from "../movement";
import { type Tuning } from "../tuning";
import { isHomeKey } from "../speakers";
import type { CombatState } from "./data";
import { nearestSound } from "./targeting";

/** The nearest of home's speakers still standing (rules/speakers.ts), or null when none is. */
export function nearestHomeSpeaker(s: CombatState, x: number, z: number): string | null {
  let best: string | null = null, bd = Infinity;
  for (const [key, h] of s.sounds) { if (h.hp <= 0 || !isHomeKey(key)) continue; const d = Math.hypot(h.x - x, h.z - z); if (d < bd) { bd = d; best = key; } }
  return best;
}

/** A soundsystem rises (a wave woke its area): its health, and the wild creatures of the area march on it. */
export function startSiege(s: CombatState, key: string, at: { x: number; z: number }, cell: Cell, creatures: Creature[], t: Tuning, besiege = true): void {
  s.sounds.set(key, { hp: t.combat.soundsystemHealth, max: t.combat.soundsystemHealth, x: at.x, z: at.z, radius: t.combat.soundsystemRadius });
  // Its wild creatures are enraged (#87: part-invited ones too, their meters lost; happy ones never) and besiege it. A friendly
  // area's never (Ed, 2026-10-11: its legend's quest done, they stay as party animals guarding it; enraged, combat left them be,
  // rules/game.ts, so they could never be knocked down and the night, rules/win.ts, could never be won).
  if (besiege) for (const c of creatures) if (!c.gone && !c.leashed && !c.wanderTo && !c.fleeUntil && !c.dazed && !c.friendly && c.cell[0] === cell[0] && c.cell[1] === cell[1] && c.level > 0 && enrage(c)) c.siege = key;
}

/** A kind's top speed (m/s): its fight run, its movement profile's (its creature.js's `movement` speed) else combat.fightRun, a legend's
 *  combat.legendRun, at the fight's speed (fight.speed) and the difficulty's (difficulty.creatureSpeed). */
export function topSpeedOf(species: string, level: number, t: Tuning): number {
  return (level === LEGEND ? t.combat.legendRun : profileOf(species)?.speed ?? t.combat.fightRun) * (t.fight?.speed ?? 1) * (t.difficulty?.creatureSpeed ?? 1);
}

/** A besieger's marching pace (m/s), on its own area's soundsystem or marching on after a fall: combat.marchShare of its top
 *  speed (Ed's playtest, 2026-10-11: "Animals seem to walk very slowly when they're going towards soundsystems"; it was its
 *  walk times marchMult, under 1 m/s, and 5 m/s marching on). */
export const marchSpeedOf = (species: string, level: number, t: Tuning): number => topSpeedOf(species, level, t) * (t.combat.marchShare ?? 0.5);
export const marchSpeed = (c: Creature, t: Tuning): number => marchSpeedOf(c.species, c.level, t);

/** After a soundsystem falls: the survivors march on to the next-nearest still standing. */
export function marchOn(s: CombatState, key: string, creatures: Creature[], centre?: { x: number; z: number }): void {
  // (inward, given the map's centre: Ed, 2026-10-11, "never target a soundsystem further from the centre than they are")
  for (const c of creatures) if (c.siege === key && !c.gone) { c.siege = c.boss ? undefined : nearestSound(s, c.x, c.z, centre) ?? undefined; if (c.fight) c.fight.target = null; } // (a legend stays to guard its area)
}
