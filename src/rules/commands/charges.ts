// Command charges (?commands=1; docs/plans/combat-skill-and-commands.md, section 3, "Charges: the berry pips"). Ed, 2026-11-17:
// "a berry fills a meter, which has several charges, and there's a cooldown on how quickly you can use a charge"; "I think the current
// buff 'draining' system will be superseded by more deliberate charge uses"; "If you fill a youth's charge bar and then give it another
// berry, it evolves to an adult". So each youth and adult of hers holds charges (its berry pips): a berry gives its level's perBerry,
// up to its max (rules/skill/profile.ts commandProfile); they never drain; a command spends one and starts that creature's own
// cooldown (no gap shared between creatures: Ed, "zero gap gives a higher skill ceiling"). A legend's charges never run out. All of
// it lives on the creature (Creature.cmd), ticked while it follows her.
import { LEGEND, type Creature } from "../creatures";
import type { Tuning } from "../tuning";
import { commandProfile, commandsOn, type Verb } from "../skill/profile";

/** An order given, to be carried out in the creature's combat turn (rules/commands/actions.ts) once the game's clock reaches `at`:
 *  its verb's action, or a Snare's blow landing on its target (`stun`). */
export interface Order { verb: Verb | "stun"; target: number | null; at: number; witch: number }

/** A creature's command state (Creature.cmd), made the first time it's fed, commanded or ticked with ?commands=1. */
export interface CommandState {
  /** Charges held (its pips): none for a legend's (unlimited). */
  charges: number;
  /** Seconds before it can act again, and the length of the cooldown it's in (for the pips' blink: render/leash/pipCharges.ts). */
  cool: number;
  coolFor?: number;
  /** Seconds left of the buff its last use gave her (a buff-giver's: rules/buffs.ts buffsOf), and how strong. */
  buff: number;
  buffStacks?: number;
  /** Seconds left of its "ready again" flash. */
  flash?: number;
  order?: Order;
}

/** Charges a creature starts with (its level's `start`, at most its max). */
const startOf = (c: Pick<Creature, "species" | "level">): number => { const P = commandProfile(c.species, c.level); return Math.max(0, Math.min(P.max, P.start)); };

/** Its command state, made if it has none. */
export function cmdOf(c: Creature): CommandState {
  return (c.cmd ??= { charges: startOf(c), cool: 0, buff: 0 });
}

/** Whether charges count for it: commands on, hers to command (a youth, an adult or a legend; no baby, no party legend). */
export const charged = (c: Pick<Creature, "level" | "partyLegend">, t: Tuning): boolean => commandsOn(t) && c.level >= 1 && !c.partyLegend;

/** Its charges now (a legend's Infinity), capped at its level's max (a youth grown up keeps its charges, up to the adult's max). */
export function chargesOf(c: Pick<Creature, "species" | "level" | "cmd">): number {
  if (c.level >= LEGEND) return Infinity;
  return Math.min(commandProfile(c.species, c.level).max, c.cmd?.charges ?? startOf(c));
}

/** Its charge bar's size: its level's max (a legend's none: unlimited). */
export const chargeMax = (c: Pick<Creature, "species" | "level">): number => commandProfile(c.species, c.level).max;

/** Berries it could eat for charges: enough to fill its bar, and for a youth one more (on a full bar, it evolves). */
export function chargeRoom(c: Pick<Creature, "species" | "level" | "cmd">): number {
  if (c.level >= LEGEND || c.level < 1) return 0;
  const P = commandProfile(c.species, c.level), left = Math.max(0, P.max - chargesOf(c));
  return Math.ceil(left / Math.max(1, P.perBerry)) + (c.level === 1 ? 1 : 0);
}

/** A berry eaten for charges (rules/berries.ts feed): its perBerry more, up to its max; "evolve" for a youth whose bar was full. */
export function feedCharges(c: Creature): "evolve" | "charged" {
  const P = commandProfile(c.species, c.level), had = chargesOf(c);
  if (c.level === 1 && had >= P.max) return "evolve";
  cmdOf(c).charges = Math.min(P.max, had + Math.max(0, P.perBerry));
  return "charged";
}

/** Her followers' cooldowns and buffs run down (rules/buffs.ts drainPips calls it in place of the drain, with ?commands=1). */
export function tickCommands(stack: readonly number[], creatures: readonly Creature[], dt: number): void {
  for (const id of stack) {
    const s = creatures[id]?.cmd;
    if (!s) continue;
    if (s.cool > 0) { s.cool = Math.max(0, s.cool - dt); if (s.cool === 0) s.flash = 0.3; }
    else if (s.flash) s.flash = Math.max(0, s.flash - dt) || undefined;
    if (s.buff > 0) s.buff = Math.max(0, s.buff - dt);
  }
}

/** Its buff on her now (a buff-giver's use, for its buffTime): its stacks, else 0. */
export const buffNow = (c: Pick<Creature, "cmd">): number => ((c.cmd?.buff ?? 0) > 0 ? c.cmd?.buffStacks ?? 1 : 0);
