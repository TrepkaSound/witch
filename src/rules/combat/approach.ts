// A creature closing in on its target and starting its strike (rules/combat/turn.ts): with a movement profile, steered by its
// behaviours, its pack's tactic, its fight style's place or the combat spacing's waiting place, its hop aimed, its wind-up started
// when it may; without one (marching, or no profile), straight in, a kiter backing off. Split from stepCombat's loop (rules/
// combat.ts): the same sums in the same order.
import { FIGHT, startHop, steer } from "../movement";
import { hash2 } from "../random";
import { foes } from "../creatureStates";
import { sideOf, headingOf, lightsNear, moveToward } from "./targeting";
import { packGate, markStrike, strikingNow, styleOf, packKindOf } from "./packs";
import { chaseAt } from "../momentum";
import { SPACING, bodyGap, clearWaitingSlot, pathClearsHazard, waitingDrive } from "../combatSpacing";
import { teamOf } from "./teams";
import { free, heavyOf, hopOf, startSpell, strikeNow, velOf, windupOf } from "./strikes";
import { movingGoal, safeWaitingGoal } from "./waiting";
import { marchSpeed } from "./siege";
import { aimOld, type Turn } from "./fighter";
import type { Moves } from "./moves";

/** With a movement profile and no wind-up: its fight style's or its pack's place, steered to; its bound aimed; its strike started. */
export function steerAndStrike(T: Turn, M: Moves): void {
  const { k, c, f, pd, p, d, A, A0, spell, mo, want, long, ownFrom, speed, heavy, waitingHazards } = T, { s, w, t, time, dt, grid, spacing, spacingSearch, DA, DC, YS, onFoe, packs, PK } = k, P = M.P!, S = FIGHT.scale, run = speed;
  const burst = c.sprung !== undefined && time - c.sprung < (P.move?.time ?? 0) ? P.move?.speed ?? 1 : 1;
  const heading = headingOf(w, f.target), lights = P.fight.some(b => b.kind === "light") ? lightsNear(w, s, c, 40 * S) : undefined;
  // Packs cutting off her retreat (dodge.c): while she runs, its share of a pack of these kinds make for places ahead of her, sprinting.
  const pk = packs.get(c.id) ?? null;
  let cutoff: { ahead: number; angle: number; reach: number } | undefined;
  if (DC && pk && pk.members.length > 1 && f.target.kind === "witch" && (DC.species.includes(c.species) || (!!PK && !!packKindOf(c.species)))) { // (every pack kind, with packs on: combat.md)
    const { vx, vz } = velOf(k, f.target), her = Math.hypot(vx, vz), i = pk.members.indexOf(c);
    if (her > DC.moving * FIGHT.walk * FIGHT.speed && Math.floor((i + 1) * DC.share) > Math.floor(i * DC.share)) cutoff = { ahead: her * DC.ahead, angle: DC.angle, reach: DC.reach };
  }
  // (a pack member steers by its role, rules/combat/packs.ts; its kind's tactic, its creature.js's `movement`, places it (the wolves'
  // surround, the pincer, the flank), a shooter firing from its place, but the one whose lunge it is goes straight in (a slot held
  // it off waiting for its place); a volley keeps its line and its beat throughout. Hit and run is the pack's lull.)
  const tactic = pd && pk && !(spacing && pd.action?.delivery === "effect") && (pk.tactic === "volley" || (!(pd.move === "melee" && packGate(pd) && free(k, f.target)) && (pk.tactic === "surround" || pk.tactic === "pincer" || pk.tactic === "flank"))) ? pk : null;
  // (Momentum: chasing her and closing in to strike, a pack's tell and combo too, it makes for where she was mo.delay seconds
  // ago, leading that by mo.chaseLead seconds of how she was going then, and turns no faster than its limit. Ed, 2026-10-27: on
  // the run-in and the wind-up; released lunges use their independent strikeTurn limit.)
  const chase = mo;
  const herAt = chase && f.target.kind === "witch" ? chaseAt(s, f.target.id, time, chase) ?? p : p;
  // Its fight style's place while it waits its turn (packs.json _styles; Ed's playtest, 2026-10-29: "circling, flanking, more
  // dynamic"), a wild pack's melee member in the tell and the combo; or a friend's place round what it fights.
  const sty0 = pd && !pd.state.hers && f.target.kind === "witch" ? styleOf(c.species) : "steady"; // (at her: between creatures, as before)
  const sty = !spacing && pd && (pd.phase === "tell" || pd.phase === "combo" || (sty0 === "circler" && pd.phase === "approach")) ? sty0 : "steady"; // (legacy diagnostic baseline only)
  // (a shooter keeps its place and fires from it, at its own range; a melee one leaves it when its turn comes, and strikes)
  const shooter = pd?.move === "ranged", myTurn = !shooter && !!pd && packGate(pd) && free(k, f.target), keep = (r: number) => (shooter ? want : r);
  let place: { x: number; z: number } | null = null;
  const ring = (r: number, carrot: number) => { const dir = (pd ? pd.state.seed : hash2(c.id, 5, 7)) < 0.5 ? 1 : -1, a = Math.atan2(c.z - p.z, c.x - p.x) + dir * carrot; return { x: p.x + Math.cos(a) * r, z: p.z + Math.sin(a) * r }; };
  const behind = !!heading && (c.x - p.x) * heading.x + (c.z - p.z) * heading.z < 0; // (behind her as she goes: a circler runs her down)
  if (sty === "circler" && !myTurn && !behind && !(pd!.phase === "approach" && d > keep(want + YS.circler.orbit * S) + YS.circler.spiral * 2 * S)) place = ring(Math.max(keep(want + YS.circler.orbit * S), pd!.phase === "approach" ? d - YS.circler.spiral * S : 0), YS.circler.carrot);
  else if (sty === "hopper" && !myTurn) place = ring(keep(want + YS.hopper.ring * S), 0.5);
  else if (sty === "flanker" && !myTurn && pk) {
    // (behind or beside her by her heading; standing, by the way she faces her pack)
    const i = Math.max(0, pk.members.indexOf(c)), h = heading ?? { x: pk.cx - p.x, z: pk.cz - p.z }, front = Math.atan2(h.z, h.x), F = YS.flanker;
    const off = ((F.from + (F.to - F.from) * ((Math.floor(i / 2) * 0.618 + 0.25) % 1)) * Math.PI) / 180, a = front + (i % 2 ? 1 : -1) * off, R = Math.max(keep(want * F.out), 1);
    place = { x: p.x + Math.cos(a) * R, z: p.z + Math.sin(a) * R };
  }
  if (!place && f.target.kind === "creature" && foes("enraged", sideOf(c))) {
    const l = onFoe.get(f.target.id), i = l ? l.indexOf(c.id) : -1;
    if (l && l.length > 1 && i >= 0) { const a = hash2(f.target.id, 7, 1029) * Math.PI * 2 + (i / l.length) * Math.PI * 2, R = Math.max(want * 0.95, 1); place = { x: p.x + Math.cos(a) * R, z: p.z + Math.sin(a) * R }; }
  }
  // A shooter can attack without a melee token, and an independent animal has no
  // pack turn at all. Neither is waiting merely because `myTurn` is false.
  // Approach remains pursuit: starting a waiting circuit here can prevent the
  // pack ever reaching its engagement threshold or a species move's run-up.
  const effectReady = spacing && pd?.action?.delivery === "effect" && pd.phase === "combo" && !pd.team?.used.includes(c.id);
  const attackReady = effectReady || time >= f.readyAt && (!pd || packGate(pd));
  const waiting = !!pd && pd.phase !== "approach" && !strikingNow(c) && !attackReady;
  if (spacing && waiting) {
    if (f.target.kind === "witch" || teamOf(s, c.id)) place = movingGoal(T, herAt, want);
    else if (f.target.kind === "creature" && place) {
      const l = onFoe.get(f.target.id) ?? [], target = w.creatures[f.target.id];
      let gap = 0;
      for (const id of l) gap = Math.max(gap, bodyGap(c, w.creatures[id], t));
      const R = Math.max(want, target ? bodyGap(c, target, t) : 0, l.length > 1 ? gap / (2 * Math.sin(Math.PI / l.length)) : 0);
      const a = Math.atan2(place.z - p.z, place.x - p.x);
      place = { x: p.x + Math.cos(a) * R, z: p.z + Math.sin(a) * R };
    }
    if (place) place = clearWaitingSlot(c, safeWaitingGoal(T, place), grid.near(c.x, c.z, spacingSearch), t);
  }
  // (a hopper bounds there, or in toward her for its strike, a beat on the ground between; the last stretch, it runs in and
  // strikes as any)
  if (!spacing && sty0 === "hopper") {
    if (c.hop) return;
    const shoot = shooter && time >= f.readyAt && d <= A.range * 0.95; // (a shooter fires between bounds when it's ready: below)
    const g = shoot ? null : place ?? (Math.hypot(p.x - c.x, p.z - c.z) > want + YS.hopper.ring * S ? { x: p.x + ((c.x - p.x) / Math.max(1e-3, d)) * (want + YS.hopper.ring * S * 0.5), z: p.z + ((c.z - p.z) / Math.max(1e-3, d)) * (want + YS.hopper.ring * S * 0.5) } : null);
    if (g && Math.hypot(g.x - c.x, g.z - c.z) > 2 * S) { if (!startHop(c, g.x, g.z, time, hopOf(k, speed))) { c.moving = false; c.vx = 0; c.vz = 0; c.facing = p.x >= c.x ? 1 : -1; } return; }
  }
  const may = steer(c, heavy ? heavyOf(k, c, P) : P, { px: herAt.x, pz: herAt.z, pr: p.r, want, range: A0.range, fire: A.range, speed: cutoff ? Math.max(run * burst, DC!.sprint * FIGHT.speed * FIGHT.creature) : run * burst, time, dt, pack: pd ? tactic : pk, neighbours: grid.near(c.x, c.z, spacing ? spacingSearch : 12 * S), threats: s.shots, side: sideOf(c), ready: time >= f.readyAt, beat: 60 / t.beat.bpm, heading, lights, cutoff, arriveAt: DA && A.delivery === "melee" && f.target.kind === "witch" && !ownFrom ? A.range + p.r : undefined, ...(long ? { strike: long.from } : {}), momentum: chase, now: herAt === p ? undefined : p, style: place, ...(spacing ? { spacing: { tuning: t, data: SPACING, waiting } } : {}) });
  // A bounding kind whose strike is an area round itself (the hare's stamp), its turn come and out of reach: its bound is aimed
  // to land it in that reach, beside where she'll be as it lands. (Till 2026-11-13 it bounded on at its full stride the way it was
  // already going, some 36 m a bound at a hare's run, past her 7 to 12 m off and out the other side, so its turn ran out before
  // it was ever within the 4 m its stamp starts from: the audit's "its own stamp almost never fires",
  // docs/plans/attack-legibility-audit.md. Ed, 2026-11-13: "Stamp, then sit 0.8 s".)
  const boundIn = spacing && !!pd && pd.move === "melee" && !!spell && A.delivery === "pulse" && attackReady && !waiting && !may && !strikingNow(c) && waitingDrive(c, time).airborne;
  if (boundIn) {
    const H = hopOf(k, speed, c), full = H.length * S, reach = Math.max(0.5, want * 0.8), hv = velOf(k, f.target);
    let gx = p.x, gz = p.z;
    for (let k = 0; k < 2; k++) { // (where she'll be when it comes down: its flight for that far, rules/movement.ts startHop)
      const L = Math.min(Math.hypot(gx - c.x, gz - c.z), full), fl = Math.max(0.15 / FIGHT.speed, (H.time * Math.sqrt(L / full)) / FIGHT.speed, L / (50 * FIGHT.speed));
      gx = p.x + hv.vx * fl; gz = p.z + hv.vz * fl;
    }
    const gd = Math.hypot(gx - c.x, gz - c.z);
    if (gd > reach + 1.5 * S) startHop(c, c.x + ((gx - c.x) / gd) * (gd - reach), c.z + ((gz - c.z) / gd) * (gd - reach), time, H);
  } else if (spacing && waitingDrive(c, time).airborne && (!may || waiting || pd?.action?.delivery === "effect") && !strikingNow(c)) {
    const v = Math.hypot(c.vx ?? 0, c.vz ?? 0), length = hopOf(k, speed, c).length * S;
    if (v > SPACING.epsilon) {
      const landing = { x: c.x + c.vx! / v * length, z: c.z + c.vz! / v * length };
      const safe = clearWaitingSlot(c, landing, grid.near(c.x, c.z, spacingSearch), t);
      if (Math.hypot(safe.x - landing.x, safe.z - landing.z) <= SPACING.epsilon && waitingHazards.every(h => pathClearsHazard(c, landing, h, t))) startHop(c, landing.x, landing.z, time, hopOf(k, speed, c));
    }
  }
  if (may && time >= f.readyAt && strikeNow(k, pd, f.target)) {
    if (pd) markStrike(pd, c, time);
    f.windupAt = time; f.windupUntil = time + windupOf(k, A, f.target); f.aimX = p.x; f.aimZ = p.z; aimOld(T, A); // (it glides to a stop as it winds up: below)
    s.events.push({ kind: "windup", x: c.x, z: c.z, at: time, id: c.id });
    if (spell) startSpell(k, c, f, spell);
  }
}

/** No wind-up, and no profile to steer by (or marching on a soundsystem far off): straight in, round a lake on the way; a kiter
 *  backs off when its target comes too close; in reach, it winds up when it may (the long lunge from out at long.from). */
export function closeIn(T: Turn, M: Moves): void {
  const { k, c, f, pd, p, d, A, A0, K, kites, spell, want, long, speed } = T, { s, w, time, dt } = k, { marching } = M;
  const farStart = !!long && d > want && d <= long.from && time >= f.readyAt && strikeNow(k, pd, f.target); // (the long lunge: wound up from out here)
  if (d > want && !farStart) { const q = w.round?.(c.x, c.z, p.x, p.z); moveToward(c, q ? q.x : p.x, q ? q.z : p.z, q ? 0 : want, marching ? marchSpeed(c, w.t) : speed, dt); return; } // (round a lake on the way: rules/lakes.ts)
  // A kiter backs off when its target comes too close, keeping its distance while it shoots.
  if (kites && d < A0.range * K.near && d > 0.01) { c.x -= ((p.x - c.x) / d) * speed * dt; c.z -= ((p.z - c.z) / d) * speed * dt; c.moving = true; c.walk += dt * 6; c.facing = p.x >= c.x ? 1 : -1; if (time < f.readyAt) return; }
  c.moving = false; c.facing = p.x >= c.x ? 1 : -1;
  if (farStart || (time >= f.readyAt && strikeNow(k, pd, f.target))) {
    if (pd) markStrike(pd, c, time);
    f.windupAt = time; f.windupUntil = time + windupOf(k, A, f.target); f.aimX = p.x; f.aimZ = p.z; aimOld(T, A);
    s.events.push({ kind: "windup", x: c.x, z: c.z, at: time, id: c.id });
    if (spell) startSpell(k, c, f, spell);
  }
}
