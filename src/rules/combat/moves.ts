// A creature's kind's own move in a fight (its creature.js's `movement`; Stage 5's movement profiles), each its own phase of its turn
// (rules/combat/turn.ts): a charge, a swoop, a burrow, a leap; then the stances (rules/combat/stances.ts). Each says whether that
// was its step. Split from stepCombat's loop (rules/combat.ts): the same sums in the same order, the moves asked in the same order.
import { FIGHT, profileOf, startCharge, stepBurrow, stepCharge, stepLeap, stepSwoop, swoopStriking } from "../movement";
import { attackOf, type Attack } from "./data";
import { sideOf } from "./targeting";
import { contacted, touch, land, area } from "./hits";
import { observeAttack } from "../attackObservation";
import { packAttack, packGate, markStrike, type Directive } from "./packs";
import { ownMay, ownStruck, reachOf, startSpell, strikeNow, token } from "./strikes";
import { lead, type Turn } from "./fighter";
import type { Armed } from "./choose";
import { ambush, block, dig, flash } from "./stances";
import { swoops } from "./standby";

type Profile = NonNullable<ReturnType<typeof profileOf>>;
/** Its movement profile (the arena's given attack keeps its kind's way of moving but not its special move), and its kind's own moves'
 *  attack and reach (on its old attack's, its species' own being its ordinary strike). */
export interface Moves { P: Profile | null | undefined; marching: boolean; mAtk: Armed; mA: Attack }

/** Its profile and its moves' attack (once past a legend's own fight). A besieger far off marches. */
export function movesOf(T: Turn): Moves {
  const { k, c, f, pd, spell, atk, d, A } = T, { data } = k, S = FIGHT.scale;
  // (one given an attack in the grammar keeps its kind's way of moving but not its special move: its attack is the grammar's)
  const P0 = profileOf(c.species), P: typeof P0 = c.spell !== undefined && spell && P0?.move ? (({ move, ...rest }) => rest)(P0) as typeof P0 : P0, marching = (f.target.kind === "sound" || (!!c.siege && !c.leashed)) && d > 40 * S; // (a besieger far off marches)
  // (its kind's own moves, a charge, a leap, a swoop, a burrow, as they were: on its old attack's reach and budget; its species' own
  // attack is its ordinary strike)
  const plain = spell && c.spell === undefined ? (pd && packAttack(c.species, c.level, pd.move)) || attackOf(c.species, c.level, data) : null, mAtk = plain ?? atk, mA = plain ? reachOf(k, plain.attack, f.target) : A;
  return { P, marching, mAtk, mA };
}

/** Its kind's own move, if it has one ready: the moves asked in turn, each true if it was its step (a flash never is). */
export function signatureMove(T: Turn, M: Moves): boolean {
  if (charge(T, M) || swoop(T, M) || burrow(T, M) || leap(T, M) || ambush(T, M) || dig(T, M) || block(T, M)) return true;
  flash(T, M);
  return false;
}

/** A charge (the boar, the stags in pairs, the ram): its run, its ram on contact, winded if it missed. */
export function charge(T: Turn, M: Moves): boolean {
  const { k, c, f, pd, p, A, speed, heavy } = T, { s, w, t, time, dt, grid, spacing, DA, DB, packs, PK } = k, { mAtk, mA } = M, P = M.P!, S = FIGHT.scale, run = speed;
  if (P.move?.kind === "charge" && f.target.kind !== "sound" && (!!c.charge || ownMay(k, pd, f.target))) { // (in a pack, its strike when its turn comes, and its stampede: rules/combat/packs.ts) // (at a soundsystem its ordinary attack, not one blow a charge: Ed, 2026-10-11)
    const was = c.charge, r = stepCharge(c, P.move, p.x, p.z, mA.range + p.r + 0.3, time, dt, run);
    if (!was && c.charge) ownStruck(k, pd, c, f.target);
    // Predictive aim (dodge.b): a charge at her runs down the lane to where she'll be when it gets there.
    if (DB && !was && c.charge && f.target.kind === "witch") {
      const { vx, vz } = lead(T, f.target), ch = c.charge, arrive = Math.max(0, (ch.from ?? time) - time) + Math.hypot(p.x - c.x, p.z - c.z) / Math.max(1, ch.speed);
      const lx = p.x + vx * arrive * DB.chargeLead - c.x, lz = p.z + vz * arrive * DB.chargeLead - c.z, ld = Math.hypot(lx, lz);
      if (ld > 0.01) { ch.dx = lx / ld; ch.dz = lz / ld; }
    }
    if (heavy && !was && c.charge) c.charge.home = (DA!.heavy.home * Math.PI) / 180; // (a heavy runs her down: its lane swings toward her)
    // A charge that missed (Ed, 2026-10-06: "reward skilful use of blink and accurate invitation aiming"): it stands
    // winded for fight.charge.miss seconds, stars round its head, an opening for her 💌s.
    if (was && !c.charge && !was.struck && !was.hit?.length && (FIGHT.charge.miss ?? 0) > 0) observeAttack(w, s, { kind: "creature", id: c.id }, { source: c.id, attack: "move:charge", delivery: "melee", phase: "self-miss" }, 0, () => { c.stunUntil = time + FIGHT.charge.miss!; c.vx = 0; c.vz = 0; s.events.push({ kind: "stunned", x: c.x, z: c.z, at: time, id: c.id }); });
    // A pair (the stags): its pack mates whose charge is ready set off with it, side by side.
    if (P.move.pair && !was && c.charge) for (const m of packs.get(c.id)?.members ?? []) if (m !== c && !m.charge && time >= (m.moveReadyAt ?? 0) && m.fight?.windupUntil === 0 && !m.fight.lunge) {
      const partner = PK?.get(m.id);
      if (spacing && (!partner || partner.action?.delivery !== "melee" || !ownMay(k, partner, f.target))) continue;
      startCharge(m, P.move, p.x, p.z, time);
      if (spacing) ownStruck(k, partner, m, f.target);
    }
    const ram: Attack = { ...A, modifier: "knockback", knockback: 15 * S };
    if (r === "hit") {
      if (c.charge) (c.charge.hit ??= []).push(f.target.kind === "witch" ? -1 - f.target.id : f.target.kind === "creature" ? f.target.id : -1e9);
      if (!(t.fight.charge?.contact && c.charge?.hit && contacted(f.target, c.charge.hit, true))) land(w, s, c, f.target, mAtk.damage, ram, c.x, c.z);
      f.readyAt = time + A.cooldown; s.events.push({ kind: "charged", x: c.x, z: c.z, at: time, id: c.id }); return true;
    }
    // Contact (Ed, 2026-10-06: "damaging whenever they're touched while in attack mode"): its run hurts every foe it touches, once each.
    if (r === "charging" && t.fight.charge?.contact && c.charge && !c.charge.braking && !(c.charge.from !== undefined && time < c.charge.from)) touch(w, s, c, mAtk.damage, ram, grid, (c.charge.hit ??= []));
    if (r === "charging") return true;
  }
  return false;
}

/** A wild flyer's swoop (the owl, the bat, the raven): circling out of reach, a telegraphed dive along a line, pulling back up. */
export function swoop(T: Turn, M: Moves): boolean {
  const { k, c, f, pd, p, A, sl, want } = T, { s, w, time, dt, grid, spacing, DA } = k, { mAtk } = M, P = M.P!, S = FIGHT.scale;
  if (P.move?.kind === "swoop" && swoops(c) && f.target.kind !== "sound" && (!pd?.team || pd.action?.delivery !== "ranged" || swoopStriking(c))) { // (a selected shot must not become a dive)
    // A wild flyer (the owl, the bat, the raven: hotel's phase-3 flyer table): it circles out of reach, telegraphs, dives along a
    // line at where its target will be and pulls back up; only in the dive and at its bottom can it be hit or invited.
    const tv = f.target.kind === "witch" ? w.witches[f.target.id] : f.target.kind === "creature" ? w.creatures[f.target.id] : null;
    // (in a pack, a bout's first dive is its strike, on its pack's turn and pressure as a lunge, a lane: docs/backlog/combat.md; it
    // circles aloft meanwhile, its lull too; the bout's other dives each a token as before)
    const dv: Directive | undefined = pd && { ...pd, move: "melee" }, tg = f.target;
    const mayDive = () => { if (pd?.team && pd.action?.delivery !== "melee") return false; if (!dv || c.swoop?.left) return token(k, tg); if (!strikeNow(k, dv, tg)) return false; markStrike(dv, c, time); return true; };
    const flight = spacing && pd?.action?.delivery === "effect" && pd.phase === "combo" && !swoopStriking(c)
      ? { ...P.move, radius: Math.min(P.move.radius ?? 12, want / S) } : P.move;
    const r = stepSwoop(c, flight, p.x, p.z, time >= f.readyAt, time, dt, (tv?.vx ?? 0) * sl, (tv?.vz ?? 0) * sl, mayDive, f.target.kind === "witch" && DA ? DA.commit : 0); // (each dive takes a strike's token at her: dodge.a)
    if (r === "tele") { f.readyAt = time + A.cooldown; s.events.push({ kind: "windup", x: c.x, z: c.z, at: time, id: c.id }); }
    if (r === "dive") s.events.push({ kind: "swooped", x: c.x, z: c.z, at: time, id: c.id });
    if (r === "low" && c.swoop?.hit) {
      // Its dive touches every foe it passes (once each). (A soundsystem it never swoops at: above.)
      const dive: Attack = { ...A, delivery: "melee", range: 2.5 * S, ...(P.move.knockback ? { modifier: "knockback" as const, knockback: P.move.knockback * S } : {}) };
      touch(w, s, c, (pd && packAttack(c.species, c.level, "melee"))?.damage ?? mAtk.damage, dive, grid, c.swoop.hit); // (a pack's dive on its melee's budget)
    }
    return true;
  }
  return false;
}

/** The mole: under the ground (untouchable, a moving mound) to its target, then up, striking at once. */
export function burrow(T: Turn, M: Moves): boolean {
  const { k, c, f, pd, p, A, spell, speed } = T, { s, time, dt } = k, P = M.P!, run = speed;
  if (P.move?.kind === "burrow" && (!!c.burrow || !pd || (pd.move === "melee" && packGate(pd)))) { // (in a pack, its way in when its turn comes; it strikes as it surfaces, a token then)
    // The mole: under the ground (untouchable, a moving mound) to its target, then up, striking at once.
    const r = stepBurrow(c, P.move, p.x, p.z, run, time, dt);
    if (r === "burrowed") s.events.push({ kind: "burrowed", x: c.x, z: c.z, at: time, id: c.id });
    if (r === "under" || r === "burrowed") return true;
    if (r === "surfaced") {
      s.events.push({ kind: "surfaced", x: c.x, z: c.z, at: time, id: c.id });
      if (time >= f.readyAt && (!pd || strikeNow(k, pd, f.target))) { if (pd) markStrike(pd, c, time); f.windupAt = time; f.windupUntil = time + Math.min(A.windup, 0.35); f.aimX = p.x; f.aimZ = p.z; s.events.push({ kind: "windup", x: c.x, z: c.z, at: time, id: c.id }); if (spell) startSpell(k, c, f, spell); }
      return true;
    }
  }
  return false;
}

/** The toad's leap in an arc, slamming down; the lynx's low pounce. */
export function leap(T: Turn, M: Moves): boolean {
  const { k, c, f, pd, p, A, sl } = T, { s, w, t, time, grid } = k, { mAtk, mA } = M, P = M.P!, S = FIGHT.scale;
  if (P.move?.kind === "leap" && (!pd || c.leap || pd.move === "melee")) { // (in a pack, its strike when its turn comes; its cloud's leap, rules/combat/packs.ts, lands harmless)
    // The toad: a leap in an arc at its target (a ring shows where it'll land), slamming down: its attack.
    const tv = f.target.kind === "witch" ? w.witches[f.target.id] : f.target.kind === "creature" ? w.creatures[f.target.id] : null, cloudLeap = !!c.leap?.cloud;
    const r = stepLeap(c, P.move, p.x, p.z, !c.leap && time >= f.readyAt && ownMay(k, pd, f.target), time, (tv?.vx ?? 0) * sl, (tv?.vz ?? 0) * sl);
    if (cloudLeap && r === "landed") { s.events.push({ kind: "slammed", x: c.x, z: c.z, at: time, id: c.id }); return true; }
    if (r === "leapt") { ownStruck(k, pd, c, f.target); s.events.push({ kind: "leapt", x: c.x, z: c.z, at: time, id: c.id }); }
    // A low pounce (the lynx's, a strike) hurts every foe it touches in the air (fight.leap.contact); a high leap's slam is its landing.
    if (r === "air" && P.move.strike && t.fight.leap?.contact && c.leap) touch(w, s, c, mAtk.damage, mA, grid, (c.leap.hit ??= []));
    const pounced = c.leap?.hit;
    if (r === "landed") {
      f.readyAt = time + A.cooldown;
      s.events.push({ kind: "slammed", x: c.x, z: c.z, at: time, id: c.id });
      // A pounce (the lynx) lands its blow on its target, if it's still there; a slam (the toad) hits all round.
      if (P.move.strike) { if (!(pounced && contacted(f.target, pounced, false)) && Math.hypot(p.x - c.x, p.z - c.z) <= mA.range + p.r + 1 * S) land(w, s, c, f.target, mAtk.damage, mA, c.x, c.z); }
      else area(w, s, c, sideOf(c), c.species, c.x, c.z, mA.radius ?? 2.4, mAtk.damage, mA, grid);
      return true;
    }
    if (r !== "none") return true;
  }
  return false;
}
