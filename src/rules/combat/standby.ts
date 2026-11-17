// A creature's turn in a fight, before it chooses what to do (rules/combat/turn.ts): what holds it this step whatever its fight
// (knocked about, gone, a leap or bound flying on, a swoop glided down, dazed, running off beaten, a legend's own way of fighting,
// out of the fight, stunned, sitting after its stamp), and its way round out of sight while it hides (up a tree, underground).
// Split from stepCombat's loop (rules/combat.ts): the same sums in the same order.
import { LEGEND, type Creature } from "../creatures";
import { runawayArrives } from "../runaway";
import { stateOf } from "../creatureStates";
import { LEGENDS } from "../legends";
import { FIGHT, advanceHop, landSwoop, profileOf } from "../movement";
import { fighting, targetPos } from "./targeting";
import { stepKnock } from "./hits";
import { stepLegendAttack } from "./legend";
import { getUp } from "../orbit";
import { advanceMotion } from "../locomotion";
import type { CombatStep } from "./step";
import { stepSkill, staggered } from "../skill/poise";
import { runOrder } from "../commands/actions";

/** A wild flyer that swoops (its profile's move; hostile: wild or enraged, never hers or happy). */
export const swoops = (c: Creature): boolean => !c.leashed && profileOf(c.species)?.move?.kind === "swoop" && (stateOf(c) === "wild" || stateOf(c) === "enraged");

/** What holds it this step before it fights: undefined if its turn is over (gone, dazed, running off, a legend shooting from afar,
 *  out of the fight, stunned, sitting); else whether a bound was in the air as the step began (`aloft`). */
export function standby(k: CombatStep, c: Creature): boolean | undefined {
  const { s, w, data, grid, t, C, time, dt } = k;
  if (c.cheerUntil !== undefined && time >= c.cheerUntil) c.cheerUntil = undefined; // (its celebration over: back in the fight, rules/affection.ts)
  stepKnock(c, dt);
  if (c.gone) return undefined;
  stepSkill(c, time, dt, t); // (openings, ?skill=1: its sit after a lunge, its poise worn and refilled: rules/skill/poise.ts)
  if (c.cmd?.order) runOrder(k, c); // (a command of hers, ?commands=1: rules/commands/actions.ts)
  // A leap under way flies on whatever holds it this step (a stun, a daze, its pack's turn): its arc goes by the time, so steps
  // missed would put it the rest of the way at once (Ed's playtest, 2026-10-29: "some animals seem to teleport"). It lands as ever.
  if (c.leap && c.fight) advanceMotion(c, { route: c.leap }, time, 0);
  const aloft = !!c.hop; advanceHop(c, time); // (a hopper's bound flies on by the time, whatever else holds it, landing this step or later: rules/movement.ts)
  // A flyer swooping that's no longer a wild one in a fight (invited, leashed, dazed, running off, asleep) glides down (rules/movement.ts).
  if (c.swoop && (!swoops(c) || !fighting(c) || w.asleep(c))) landSwoop(c, time);
  if (c.dazed) {
    // Dazed: it lies still till its daze is over (invited meanwhile, it's whole and happy: states.befriend), then runs off.
    if (stateOf(c) !== "wild") { c.dazed = false; c.dazedUntil = undefined; }
    else if (time >= (c.dazedUntil ?? 0)) { getUp(c, time); s.events.push({ kind: "up", x: c.x, z: c.z, at: time, id: c.id }); } // (not converted: up again, wild, its slots draining: rules/orbit.ts)
    else { c.moving = false; return undefined; }
  }
  // Beaten: it runs for its spot on the beach (rules/runaway.ts; no beach, the map's edge), and lies down asleep there once it's
  // there or out of every witch's sight (gone, off the map's edge, with no beach).
  if (c.fleeUntil) {
    const ax = (c.fleeX ?? c.x) - c.x, az = (c.fleeZ ?? c.z) - c.z, d = Math.hypot(ax, az);
    if (d < 1 || w.unseen(c.x, c.z)) { runawayArrives(c, time); return undefined; }
    const run = Math.max(c.speed * C.fleeMult, t.leash.babies?.farSpeed ?? 0); // (running away: at a baby's run, Ed 2026-10-28)
    c.x += (ax / d) * run * dt; c.z += (az / d) * run * dt;
    c.facing = ax > 0 ? 1 : -1; c.away = az < -Math.abs(ax);
    c.moving = true; c.walk += dt * 8;
    return undefined;
  }
  // An angry or happy legend (#87): it stands in its area and shoots from afar (stepLegendAttack).
  // (Ed, 2026-10-05: "stick with the long range one for now": with legends.closeMoves off, a wild legend that isn't an area's uses it too.)
  if (c.partyLegend) { c.fight = undefined; return undefined; } // (a party legend dances and fights no one: rules/partyLegend.ts)
  if (c.level === LEGEND && !c.leashed && (c.boss ? c.legendState === "angry" || c.legendState === "happy" : !LEGENDS.closeMoves) && fighting(c)) { stepLegendAttack(w, s, c, data, grid); return undefined; }
  // (one of hers busy with berries, or evolving, fights no one, guarding or not: Ed, 2026-11-03, "if you have given the instruction to a
  // creature to eat a berry, it should priotise that over fighting"; a queued one is in rules/berries.ts feeding from the tap till its
  // queue's eaten or cancelled, so its whole queue wins, then it fights as ever)
  if (!fighting(c) || w.asleep(c) || (c.leashed && w.busy(c.id))) { c.fight = undefined; return undefined; }
  // Stunned (an armoured one knocked over): it does nothing for a moment.
  if (c.stunUntil !== undefined && time < c.stunUntil) { c.moving = false; c.vx = 0; c.vz = 0; return undefined; }
  // Staggered, its poise broken (?skill=1, rules/skill/poise.ts): it stands still, its wind-up called off.
  if (staggered(c, time)) { c.moving = false; c.vx = 0; c.vz = 0; return undefined; }
  // Sitting after its own stamp (the hare's: tuning hareStamp.sit; Ed, 2026-11-13, "Stamp, then sit 0.8 s": "its own stamp attack,
  // then a shown sit you can punish"): it stays where it is, no bound, no dodge, no new strike, till its sit is over.
  if (c.sitUntil !== undefined) { if (time < c.sitUntil) { c.moving = false; c.vx = 0; c.vz = 0; return undefined; } c.sitUntil = undefined; }
  return aloft;
}

/** Up the trees, underground or under water (rules/combat/packs.ts): out of sight, it makes its way round to where it comes back down
 *  (Ed's playtest, 2026-10-29: "some animals seem to teleport": it was put there at once), arriving as its hide ends: round her, not
 *  through her, a share of what's left each step (at its own run, straight, it crossed her and came up short and close: a lone mole
 *  burrowing again under her where it should have thrown from out there, #1405), never faster than 48 m/s (under a lunge's 60, the
 *  room left for the spacing's nudge: a short hide, a squirrel's scatter, comes back where that got it, a little short). */
export function hidden(k: CombatStep, c: Creature, aloft: boolean): void {
  const { s, w, time, dt } = k;
  const H = c.packHide!;
  if (H.tx !== undefined && !c.leap && !aloft) { // (a leap or a bound under way carries it: both at once would be a jump)
    const k = Math.min(1, dt / Math.max(dt, H.until - time)), tg = c.fight?.target ? targetPos(w, s, c.fight.target) : null, x0 = c.x, z0 = c.z;
    if (tg) {
      const a0 = Math.atan2(c.z - tg.z, c.x - tg.x), r0 = Math.hypot(c.x - tg.x, c.z - tg.z), a1 = Math.atan2(H.tz! - tg.z, H.tx - tg.x), r1 = Math.hypot(H.tx - tg.x, H.tz! - tg.z);
      let da = a1 - a0; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
      const a = a0 + da * k, r = r0 + (r1 - r0) * k;
      c.x = tg.x + Math.cos(a) * r; c.z = tg.z + Math.sin(a) * r;
    } else { c.x += (H.tx - c.x) * k; c.z += (H.tz! - c.z) * k; }
    const most = 48 * FIGHT.speed * dt, mv = Math.hypot(c.x - x0, c.z - z0);
    if (mv > most) { c.x = x0 + ((c.x - x0) * most) / mv; c.z = z0 + ((c.z - z0) * most) / mv; }
    if (Math.abs(c.x - x0) > 0.02) c.facing = c.x > x0 ? 1 : -1;
    c.moving = Math.hypot(c.x - x0, c.z - z0) > 1e-3; c.walk += dt * 5; // (its shadow runs: render/view/creatures.ts)
  } else if (!c.leap && !aloft) c.moving = false;
  c.vx = 0; c.vz = 0; return;
}
