// The fight's speeds and data as one game has them (quality plan item d, Ed's go 2026-11-15: docs/notes/module-state.md).
// FIGHT (rules/movementData.ts) and the combat data `land` reads (rules/combat/hits.ts useData) are page-wide, set from the tuning
// by each fight step (rules/combat/step.ts beginStep) and read by every step, calm ones included (a creature's walk, its reach).
// Left alone they were whatever the last fight step of any game in the page set: a night loaded in a calm spell, a second game
// (the frame check's, a guest's replica) or a test after another read another's. So every step of a game begins with its own:
// the page's start values until its first fight step (`fightSet`, kept with the night), its tuning's after, exactly as a game
// played from the start has them.
import { COMBAT } from "./combat/data";
import { useData } from "./combat/hits";
import { FIGHT, resetFight } from "./movementData";
import type { Tuning } from "./tuning";

/** The fight's scale and speeds from the tuning (each fight step, and each step of a game that has fought). */
export function setFight(t: Tuning): void {
  FIGHT.scale = t.fight.scale; FIGHT.speed = t.fight.speed; FIGHT.momentum = t.fight.momentum ?? 1;
  FIGHT.creature = t.difficulty?.creatureSpeed ?? 1; FIGHT.adult = t.difficulty?.adultStrength ?? 1; // (the difficulty: Ed, 2026-11-03)
  if (t.fight.charge) FIGHT.charge = t.fight.charge;
  if (t.fight.leap) FIGHT.leap = t.fight.leap;
  FIGHT.walk = t.groundSpeed;
}

/** A game's step begins (and a new game starts): FIGHT and the combat data as that game's own steps left them. */
export function fightFor(g: { fightSet?: boolean; tuning: Tuning }): void {
  resetFight(); useData(COMBAT);
  if (g.fightSet) setFight(g.tuning);
}
