// The command button (?commands=1; docs/plans/combat-skill-and-commands.md, section 3). Ed, 2026-11-17: "square as command, and
// circle as pickup/place. When you're near a berry, square becomes eat."; "The bottom of the stack" commands. A press, on foot on
// the ground: the bottom creature eats when a berry is within berries.feed.reach (15 m) and it has room (rules/sigilButton.ts feeds it);
// else it acts, if it has a verb, a charge and no cooldown (and, for an action at a creature, something in reach): one charge spent,
// its own cooldown begun (no gap shared between creatures: Ed, "zero gap gives a higher skill ceiling"), a buff-giver's buff on her for
// its buffTime, and its order given, carried out in its combat turn (rules/commands/actions.ts). In the treetops it does nothing
// (Ed, answer 7). Everything it changes is on the creature (Creature.cmd).
import type { Controls, Game, Witch } from "../game";
import type { LeashEvent } from "../leash";
import type { Tuning } from "../tuning";
import { stackBottom } from "../leash";
import { feedTarget } from "../berries";
import { LEGEND } from "../creatures";
import { commandProfile, commandsOn } from "../skill/profile";
import { chargesOf, cmdOf } from "./charges";
import { commandTarget } from "./target";

/** What a press of the command button does: feed the bottom creature (sigilButton.ts feeds it), or nothing more (it acted, or fizzled:
 *  the event says which), or null with commands off or not on foot. */
export type CommandPress = "feed" | "done" | null;

/** Whether the press would feed the bottom creature: on foot, it has room, and a berry no one's taken is within reach. */
export function commandFeeds(g: Game, W: Witch, t: Tuning = g.tuning): boolean {
  const b = W.body, bt = stackBottom(W.leash);
  if (W.ko || b.mode !== "ground" || b.seated || b.perch || bt?.kind !== "creature") return false;
  return !!feedTarget(g.berries, g.creatures[bt.id], b.x, b.z, t);
}

/** Witch W's command press this step (her controls c, her clock ht): its event pushed to `events` (a "fizzled" one when nothing acts). */
export function pressCommand(g: Game, W: Witch, c: Controls, t: Tuning, ht: number, events: LeashEvent[]): CommandPress {
  if (!commandsOn(t) || !c.command) return null;
  const b = W.body;
  if (W.ko || b.mode !== "ground" || b.seated || b.perch) return null;
  if (commandFeeds(g, W, t)) return "feed";
  const bt = stackBottom(W.leash), k = bt?.kind === "creature" ? g.creatures[bt.id] : null;
  const fizzle = () => { events.push({ kind: "fizzled", id: k?.id ?? W.id, x: b.x, z: b.z, at: ht }); return "done" as const; };
  if (!k || k.gone || k.level < 1 || k.partyLegend) return fizzle();
  const P = commandProfile(k.species, k.level), s = cmdOf(k);
  if (!P.verb || s.cool > 0 || s.order || chargesOf(k) < 1) return fizzle();
  let target: number | null = null;
  if (P.verb === "Strike" || P.verb === "Snare") {
    const I = W.invites, aim = Math.hypot(c.aimX ?? 0, c.aimZ ?? 0) > 1e-3;
    const tg = commandTarget({ x: b.x, z: b.z, witch: W.id, aimX: aim ? c.aimX! : I.ax, aimZ: aim ? c.aimZ! : I.az, single: !!c.singleStick, vx: b.vx, vz: b.vz, facing: b.facing, lastHit: I.lastHit, now: ht, creatures: g.creatures }, P.reach);
    if (!tg) return fizzle();
    target = tg.id;
  }
  if (k.level < LEGEND) s.charges = chargesOf(k) - 1;
  s.cool = P.cooldown; s.coolFor = P.cooldown; s.flash = undefined;
  if (P.buff) { s.buff = P.buffTime; s.buffStacks = P.buffStacks; }
  if (P.verb !== "Surge") s.order = { verb: P.verb, target, at: g.clock.time + P.cast, witch: W.id };
  events.push({ kind: "cycled", id: k.id, x: b.x, z: b.z, at: ht }); // (its sigil's flare in her stack, as a cycle's: render/leash.ts)
  return "done";
}
