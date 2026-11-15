// A creature waiting its turn in a fight, with the combat spacing on (rules/combatSpacing.ts): its place in its team's moving
// formation round her (its ring, its ready spot for a coming round), kept clear of telegraphed harm, and its stride round there.
// Once closures in stepCombat's loop (rules/combat.ts); the same sums in the same order.
import { attackNamed, attackOf } from "./data";
import { sideOf, headingOf, lightsNear } from "./targeting";
import { FIGHT, profileOf, startHop, steer } from "../movement";
import { hash2 } from "../random";
import { PACKS, packKindOf } from "./packs";
import { chaseAt, witchWas } from "../momentum";
import { SPACING, clearWaitingSlot, drawnRadius, hazardAvoidance, pathClearsHazard, waitingDrive, waitingProfile, waitingSlot, type WaitingHazard } from "../combatSpacing";
import { teamOf } from "./teams";
import { actionReach } from "./actions";
import { SET_OFF_PACE } from "./reach";
import { hopOf, ringGap, widestOf } from "./strikes";
import type { Turn } from "./fighter";

/** Which way her chaser reckons she's going: as she went mo.delay seconds ago, with momentum; else as she goes now. */
export function waitingHeading(T: Turn): { x: number; z: number } | null {
  const { k, f, mo } = T, { s, w, time } = k;
  if (!mo || f.target?.kind !== "witch") return headingOf(w, f.target!);
  const a = witchWas(s, f.target.id, time - mo.delay - SPACING.headingWindow), b = witchWas(s, f.target.id, time - mo.delay);
  return a && b && Math.hypot(b.x - a.x, b.z - a.z) > SPACING.epsilon ? { x: b.x - a.x, z: b.z - a.z } : null;
}

/** Its place while it waits (the combat spacing's waitingSlot), round `origin` at `range`: in its ring of its team (rules/combat/
 *  teams.ts), or, picked for the next round, its ready spot, set off for in time. */
export function movingGoal(T: Turn, origin: { x: number; z: number }, range: number): { x: number; z: number } {
  const { k, c, pd, p, speed } = T, { s, w, t, time } = k;
  const team = teamOf(s, c.id), members = team?.members ?? pd?.state.members ?? [], wide = widestOf(k, members);
  const gap = wide > -Infinity ? Math.max(0, drawnRadius(c, t) + wide + SPACING.clearance) : 0;
  const tell = pd ? PACKS.rhythms[packKindOf(c.species)?.rhythm ?? "steady"].tell : 0;
  const selected = !team || !!team.actions[c.id] && !team.used.includes(c.id) && pd?.role !== "hurt";
  // (picked for the next round, a big team's, rules/combat/teams.ts: it closes in to be ready as that round's window opens, setting
  // off by its own speed: waitingSlot's return; aloft, no directive, it only waits)
  const coming = !selected && !!pd && pd.role !== "hurt" ? team?.next?.find(n => n.actions[c.id]) : undefined, nextPick = !!coming;
  if (nextPick) {
    // Its ready spot: in the reach its next action engages from (not where its present role waits, a shooter's), on its own bearing
    // from her, re-aimed at her each step. It leaves the ring when, at its own waiting pace (its stride's share of the time on the
    // move), it would only just get there by its round's window opening (its readyBy), with its return lead to spare; till then, its
    // place in the ring. Only a goal: nothing's committed, it strikes only when its round comes.
    const m = waitingProfile(c), ready = Math.max(Math.min(range, actionReach(c, coming!.actions[c.id]!, PACKS) + PACKS.limits.engage * FIGHT.scale * 0.5), drawnRadius(c, t) + p.r + SPACING.clearance);
    const pace = SET_OFF_PACE * speed * m.speed * (m.lift > 0 || m.cadence > 0 ? m.duty + (1 - m.duty) * m.restSpeed : 1), off = Math.hypot(c.x - origin.x, c.z - origin.z);
    if (time >= coming!.readyBy - Math.max(0, off - ready) / Math.max(1, pace) - m.returnLead) {
      const k = off > SPACING.epsilon ? ready / off : 0, a = hash2(c.id, 29, 1620) * Math.PI * 2;
      return off > SPACING.epsilon ? { x: origin.x + (c.x - origin.x) * k, z: origin.z + (c.z - origin.z) * k } : { x: origin.x + Math.cos(a) * ready, z: origin.z + Math.sin(a) * ready };
    }
  }
  const until = nextPick ? Infinity : !selected ? Infinity : pd?.phase === "lull" ? pd.state.until + tell : pd?.phase === "tell" || pd?.phase === "combo" ? pd.state.until : Infinity;
  const seed = team ? hash2(team.seed, 1620, 17) : pd?.state.seed;
  const retreat = pd?.role === "hurt" ? waitingProfile(c).radius * FIGHT.scale : 0;
  // (a big team's rings: its place among the `ring` sharing its ring, and which ring: rules/combat/teams.ts order)
  // (its index in its ring by id among those sharing it, so a ring's places don't all shift as its picks change)
  const cap = Math.floor(t.teamRounds?.ring ?? 20), at = team?.order ? team.order.indexOf(c.id) : -1, rank = at >= 0 ? Math.floor(at / cap) : 0;
  const ring = at >= 0 ? team!.order!.slice(rank * cap, rank * cap + cap) : null;
  // (and its ring's own gap: the room its members' bodies take round it, each its width and the clearance, shared out, not the
  // widest of all 128 for everyone, which made each ring as wide as one ring of all of them)
  const place = ring ? { index: ring.filter(id => id < c.id).length, count: ring.length, rank, gap: ringGap(k, ring) } : { index: Math.max(0, members.indexOf(c.id)), count: members.length, gap };
  // (the waiting room's invite reach is its own setting, combatWaiting.inviteReach, held at the old 33 m when the letters got
  // 42 m: Ed, 2026-11-09, "ranges feel small", so the longer letters reach the circling animals; nor do buffs or a bag push them out)
  return waitingSlot(c, origin, range + retreat, time, FIGHT.scale, SPACING, waitingHeading(T), seed !== undefined ? { seed, ...place, until, minimum: drawnRadius(c, t) + p.r + SPACING.clearance } : undefined,
    { dashReach: t.dash.distance * (t.dash.charges ?? 1), inviteReach: t.combatWaiting.inviteReach, areaRadius: w.areaAt?.(c.homeX, c.homeZ)?.r ?? 0, speed: speed * waitingProfile(c).speed, parameters: t.combatWaiting });
}

/** The telegraphed strikes it keeps clear of while it waits: its target's own body, and the legends' about winding up. */
export function waitingHazardsOf(T: Turn): WaitingHazard[] {
  const { k, c, p } = T, { data, time, legendsHere } = k;
  const waitingHazards: WaitingHazard[] = [{ x: p.x, z: p.z, radius: p.r }];
  for (const other of legendsHere) {
    const warning = other.fight;
    if (sideOf(other) === sideOf(c) || !warning || warning.windupUntil <= time) continue;
    const attack = warning.move ? attackNamed(warning.move, data) : attackOf(other.species, other.level, data)?.attack;
    if (!attack) continue;
    if (attack.delivery === "quake" || attack.delivery === "pulse") waitingHazards.push({ x: other.x, z: other.z, radius: attack.radius ?? 5 });
    else if (attack.delivery === "lob") waitingHazards.push({ x: warning.aimX, z: warning.aimZ, radius: attack.radius ?? 2 });
    else if (attack.delivery === "beam" || attack.delivery === "melee") {
      const angle = Math.atan2(warning.aimZ - other.z, warning.aimX - other.x);
      waitingHazards.push({ x: other.x, z: other.z, endX: other.x + Math.cos(angle) * attack.range, endZ: other.z + Math.sin(angle) * attack.range, radius: attack.width ?? attack.radius ?? 1 });
    }
  }
  return waitingHazards;
}

/** A waiting goal pushed clear of the harm about (hazardAvoidance). */
export function safeWaitingGoal(T: Turn, goal: { x: number; z: number }): { x: number; z: number } {
  const force = hazardAvoidance(T.c, T.waitingHazards, T.k.t);
  return { x: goal.x + force.x, z: goal.z + force.z };
}

/** Its waiting movement round her (the combat spacing's): its place in its team's moving formation (movingGoal), kept clear of its
 *  neighbours and of telegraphed harm, steered to with its momentum, a lifted stride launched toward a clear landing. */
export function waitRound(T: Turn, hers: boolean): void {
  const { k, c, f, mo, p, want, speed, waitingHazards } = T, { s, w, t, time, dt, grid, spacingSearch } = k, S = FIGHT.scale;
  const origin = mo && f.target!.kind === "witch" ? chaseAt(s, f.target!.id, time, mo) ?? p : p;
  const goal = clearWaitingSlot(c, safeWaitingGoal(T, movingGoal(T, origin, want)), grid.near(c.x, c.z, spacingSearch), t);
  const profile = profileOf(c.species) ?? { accel: SPACING.fallbackAccel, fight: [{ kind: "arrive" as const, w: 1 }] };
  steer(c, profile, { px: origin.x, pz: origin.z, pr: p.r, want: 0, range: 0, speed, time, dt, pack: null, neighbours: grid.near(c.x, c.z, spacingSearch), threats: s.shots, side: sideOf(c), ready: false, beat: 60 / t.beat.bpm, momentum: mo, style: goal, lights: profile.fight.some(b => b.kind === "light") ? lightsNear(w, s, c, 40 * S) : undefined, spacing: { tuning: t, data: SPACING, waiting: true } });
  if (waitingDrive(c, time).airborne && f.target!.kind === "witch" && !hers) {
    // Launch in its already momentum-limited heading, toward a clear landing disc.
    const v = Math.hypot(c.vx ?? 0, c.vz ?? 0), length = hopOf(k, speed, c).length * S;
    if (v > SPACING.epsilon) {
      const landing = { x: c.x + c.vx! / v * length, z: c.z + c.vz! / v * length };
      const safe = clearWaitingSlot(c, landing, grid.near(c.x, c.z, spacingSearch), t);
      if (Math.hypot(safe.x - landing.x, safe.z - landing.z) <= SPACING.epsilon && waitingHazards.every(h => pathClearsHazard(c, landing, h, t))) startHop(c, landing.x, landing.z, time, hopOf(k, speed, c));
    }
  }
}
