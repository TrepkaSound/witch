// A creature's kind's stances in a fight (rules/combat/moves.ts asks them after its moves): lying in wait and springing (ambush),
// digging in (the badger), bracing behind its tail (the beaver), a flash of light. Split from stepCombat's loop (rules/combat.ts):
// the same sums in the same order.
import { foes, huntsWitch } from "../creatureStates";
import { FIGHT } from "../movement";
import { targetable, sideOf, truce, sheltered } from "./targeting";
import { markStrike } from "./packs";
import { startSpell, strikeNow } from "./strikes";
import type { Turn } from "./fighter";
import type { Moves } from "./moves";

/** Lying in wait (the spider, the snake), springing once its target is close; hunting her it comes from wherever it is. */
export function ambush(T: Turn, M: Moves): boolean {
  const { k, c, f, pd, p, d } = T, { s, time } = k, P = M.P!, S = FIGHT.scale;
  if (P.move?.kind === "ambush" && !c.leashed) {
    // (Hunting her, it doesn't lie in wait: it comes for her from wherever it is in its area, springing once it's close.
    // Ed, 2026-10-08: "the aggro creatures are at the opposite end and they don't come and attack me". In a pack it lies in wait only
    // till its pack engages: then its pack's turns bring it in.)
    if (c.sprung === undefined && d > (P.move.trigger ?? 20) * S) { if (c.hunting === undefined && (!pd || pd.phase === "approach")) { c.moving = false; c.vx = 0; c.vz = 0; c.facing = p.x >= c.x ? 1 : -1; return true; } }
    else if (c.sprung === undefined) {
      c.sprung = time; s.events.push({ kind: "sprung", x: c.x, z: c.z, at: time, id: c.id });
      if (P.move.strike) f.readyAt = Math.min(f.readyAt, time); // (the snake: it strikes as it springs)
    }
  }
  return false;
}

/** The badger digs in when its target comes close: rooted, taking armour times the damage, biting without a lunge. */
export function dig(T: Turn, M: Moves): boolean {
  const { k, c, f, pd, p, d, A, spell } = T, { s, time } = k, P = M.P!, S = FIGHT.scale;
  if (P.move?.kind === "dig" && (!pd || c.dug !== undefined || pd.move === "melee" && pd.role === "lunger")) {
    // The badger digs in when its target comes close: rooted, taking armour times the damage, biting
    // without a lunge at whatever's in reach; then it comes up and the move cools down.
    if (c.dug !== undefined && time < c.dug) {
      c.vx = 0; c.vz = 0; c.moving = false; c.facing = p.x >= c.x ? 1 : -1;
      if (time >= f.readyAt && d <= A.range + p.r + 1.5 * S && strikeNow(k, pd, f.target)) { if (pd) markStrike(pd, c, time); f.windupAt = time; f.windupUntil = time + A.windup * 0.7; f.aimX = p.x; f.aimZ = p.z; s.events.push({ kind: "windup", x: c.x, z: c.z, at: time, id: c.id }); if (spell) startSpell(k, c, f, spell); }
      return true;
    }
    if (c.dug !== undefined) { c.dug = undefined; c.moveReadyAt = time + P.move.cooldown; }
    else if (time >= (c.moveReadyAt ?? 0) && d <= (P.move.trigger ?? 6) * S) { c.dug = time + (P.move.time ?? 3); s.events.push({ kind: "dug", x: c.x, z: c.z, at: time, id: c.id }); return true; }
  }
  return false;
}

/** The beaver braces behind its tail when a shot's coming at it or its target winds up; then it slaps back at once. */
export function block(T: Turn, M: Moves): boolean {
  const { k, c, f, p } = T, { s, w, time } = k, P = M.P!, S = FIGHT.scale;
  if (P.move?.kind === "block") {
    // The beaver braces behind its tail when a shot's coming at it or its target winds up: rooted,
    // shots all but stopped, blows halved; then it slaps back at once.
    if (c.brace !== undefined && time < c.brace) { c.vx = 0; c.vz = 0; c.moving = false; c.facing = p.x >= c.x ? 1 : -1; return true; }
    if (c.brace !== undefined) { c.brace = undefined; c.moveReadyAt = time + P.move.cooldown; f.readyAt = Math.min(f.readyAt, time); }
    else if (time >= (c.moveReadyAt ?? 0)) {
      const R = (P.move.radius ?? 12) * S, side = sideOf(c);
      let threat = s.shots.some(sh => { if (!foes(sh.side, side) || sh.lob) return false; const rx = c.x - sh.x, rz = c.z - sh.z, sv = Math.hypot(sh.vx, sh.vz) || 1; return Math.hypot(rx, rz) < R && (rx * sh.vx + rz * sh.vz) / sv > 0 && Math.abs((rx * -sh.vz + rz * sh.vx) / sv) < 2 * S; });
      if (!threat && f.target.kind === "creature") { const o = w.creatures[f.target.id]; threat = !!o?.fight && o.fight.windupUntil > time && o.fight.target?.kind === "creature" && o.fight.target.id === c.id; }
      if (threat) { c.brace = time + (P.move.time ?? 1.2); s.events.push({ kind: "braced", x: c.x, z: c.z, at: time, id: c.id }); return true; }
    }
  }
  return false;
}

/** A flash: a pulse of light dazzling the other side round it (slowed a moment). Never its whole step. */
export function flash(T: Turn, M: Moves): boolean {
  const { k, c, d } = T, { s, w, time, grid } = k, P = M.P!, S = FIGHT.scale;
  if (P.move?.kind === "flash" && time >= (c.moveReadyAt ?? 0) && d <= (P.move.radius ?? 10) * S) {
    // A flash: a pulse of light dazzling the other side round it (slowed a moment).
    const R = (P.move.radius ?? 10) * S, until = time + (P.move.time ?? 1.5), side = sideOf(c);
    for (const o of grid.near(c.x, c.z, R)) if (o !== c && targetable(o) && foes(sideOf(o), side) && !truce(c, o) && Math.hypot(o.x - c.x, o.z - c.z) <= R) o.slowUntil = Math.max(o.slowUntil ?? 0, until);
    if (huntsWitch(side)) for (const v of w.witches) if (v.onGround && !v.down && !sheltered(v, c) && Math.hypot(v.x - c.x, v.z - c.z) <= R) w.slowWitch?.(v.id, until, P.move.slow ?? 0.6);
    s.events.push({ kind: "flash", x: c.x, z: c.z, at: time, id: c.id });
    c.moveReadyAt = time + P.move.cooldown;
  }
  return false;
}
