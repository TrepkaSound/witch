// A pack member waiting its turn (rules/combat/packs.ts): dug in, biting what comes in reach when its pack lets it; or at its place
// in the lull, prowling round her at that distance (Ed's playtests, 2026-10-23: "lulls between pack attacks seem to have the animals
// stand still instead of retreat"), or the combat spacing's waiting round. Split from stepCombat's loop (rules/combat.ts): the same
// sums in the same order.
import { FIGHT, startHop } from "../movement";
import { moveToward } from "./targeting";
import { PACKS, markStrike, styleOf } from "./packs";
import { hopOf, startSpell, strikeNow } from "./strikes";
import { waitRound } from "./waiting";
import type { Turn } from "./fighter";

/** A pack member waiting (its pack's directive pd, no wind-up, no charge, leap, burrow or swoop): true if that's its step. */
export function packWait(T: Turn): boolean {
  const { k, c, f, p, d, A, spell, speed } = T, pd = T.pd!, { s, time, dt, spacing } = k, S = FIGHT.scale;
  if (c.dug !== undefined && time < c.dug) {
    c.moving = false; c.vx = 0; c.vz = 0; c.facing = p.x >= c.x ? 1 : -1;
    if (time >= f.readyAt && d <= A.range + p.r + 1.5 * FIGHT.scale && strikeNow(k, pd, f.target)) { f.windupAt = time; f.windupUntil = time + A.windup * 0.7; f.aimX = p.x; f.aimZ = p.z; markStrike(pd, c, time); s.events.push({ kind: "windup", x: c.x, z: c.z, at: time, id: c.id }); if (spell) startSpell(k, c, f, spell); }
    return true;
  }
  if (pd.slot) {
    if (pd.still) { c.moving = false; c.vx = 0; c.vz = 0; c.facing = p.x >= c.x ? 1 : -1; return true; }
    // At its place it doesn't halt (Ed's playtests, 2026-10-23: "lulls between pack attacks seem to have the animals stand still
    // instead of retreat"): once there its place moves on round her at that distance, a little slower than it runs, each its own way
    // round, and it keeps up, till its pack comes again. A freeze holds its place first, out of reach and hard to see (combat.md), then prowls.
    const PW = PACKS.prowl, ox = pd.slot.x - p.x, oz = pd.slot.z - p.z, R = Math.hypot(ox, oz);
    let tx = pd.slot.x, tz = pd.slot.z;
    if (pd.phase === "lull" && !pd.freeze && R >= 1) {
      let a = c.packProwl ?? 0;
      const at = (q: number) => { const cs = Math.cos(q), sn = Math.sin(q); return [p.x + ox * cs - oz * sn, p.z + ox * sn + oz * cs]; };
      [tx, tz] = at(a);
      if (Math.hypot(tx - c.x, tz - c.z) <= PW.near * S) { a += (c.id % 2 ? 1 : -1) * (speed * PW.pace * dt) / R; c.packProwl = a; [tx, tz] = at(a); }
    }
    if (c.hop) return true; // (in the air: rules/movement.ts)
    if (spacing && !pd.freeze) { waitRound(T, pd.state.hers); return true; }
    if (styleOf(c.species) === "hopper" && f.target.kind === "witch" && !pd.state.hers) { if (pd.freeze || !startHop(c, tx, tz, time, hopOf(k, speed))) { c.moving = false; c.vx = 0; c.vz = 0; c.facing = p.x >= c.x ? 1 : -1; } return true; } // (a hopper bounds round its lull ring, a beat on the ground between)
    moveToward(c, tx, tz, 0.1, speed, dt);
    return true;
  }
  return false;
}
