// The four commands of the first slice (?commands=1; docs/plans/combat-skill-and-commands.md, sections 3 and 5: "fox (Strike),
// squirrel (Snare: Bonk), badger (Guard: Barge + taunt), bee (Surge: Buzz). That is one per role."), carried out in the commanded
// creature's combat turn (rules/combat/standby.ts), where its own attack can be cast:
// - Strike: its own grammar attack cast now at the target, its damage times `power`, whatever its attack's cooldown or the strike
//   tokens (rules/attacks/combatWorld.ts speciesSpell, rules/combat/strikes.ts startSpell); its blow fills the target's ring as hearts.
// - Snare: its own attack cast at the target, and the target stunned `stun` seconds as the blow lands (its flight reckoned, not
//   tracked: a prototype's shortcut).
// - Guard: after its `cast`, every wild one within `tauntRadius` of her turns on it for `taunt` seconds (the taunt of
//   rules/combat/hits.ts), and the one nearest her is thrown `knock` metres away from her; it then goes for that one.
// - Surge: its buff on her, given at the press (rules/commands/command.ts), so nothing here.
import { LEGEND, type Creature } from "../creatures";
import { speciesSpell } from "../attacks/combatWorld";
import { targetable } from "../combat/targeting";
import { startSpell } from "../combat/strikes";
import { foes, stateOf } from "../creatureStates";
import { commandProfile } from "../skill/profile";
import type { CombatStep } from "../combat/step";

/** A wild one hers can hit. */
const wildFoe = (o: Creature | undefined): o is Creature => !!o && !o.gone && !o.leashed && targetable(o) && foes("leashed", stateOf(o));

/** Its order, once the clock reaches it. */
export function runOrder(k: CombatStep, c: Creature): void {
  const s = c.cmd!, o = s.order!, { w, time } = k;
  if (time < o.at) return;
  s.order = undefined;
  if (!c.leashed || c.gone) return;
  const P = commandProfile(c.species, c.level), tg = o.target !== null ? w.creatures[o.target] : undefined;
  if (o.verb === "stun") { if (wildFoe(tg)) tg.stunUntil = Math.max(tg.stunUntil ?? 0, time + (P.stun ?? 0.6)); return; }
  if (o.verb === "Strike" || o.verb === "Snare") {
    if (!wildFoe(tg)) return;
    const windup = castAt(k, c, tg, o.verb === "Strike" ? P.power : 1);
    if (o.verb === "Snare" && windup !== null) s.order = { verb: "stun", target: tg.id, at: time + windup + Math.min(1.5, Math.hypot(tg.x - c.x, tg.z - c.z) / 18), witch: o.witch };
    return;
  }
  if (o.verb === "Guard") guard(k, c, o.witch);
}

/** Its own attack cast at tg now, its damage times `power`: the wind-up's length, or null if it has none. */
function castAt(k: CombatStep, c: Creature, tg: Creature, power: number): number | null {
  const atk = speciesSpell(c, k.data, k.t.attacks?.reactionFloor);
  if (!atk) return null;
  const f = (c.fight ??= { target: null, readyAt: k.time, windupUntil: 0, aimX: tg.x, aimZ: tg.z });
  f.target = { kind: "creature", id: tg.id }; f.aimX = tg.x; f.aimZ = tg.z; f.lunge = undefined;
  startSpell(k, c, f, { ...atk, damage: atk.damage * power });
  return f.windupUntil - k.time;
}

/** Guard: the taunt round her, the nearest thrown off her, and it going for that one. */
function guard(k: CombatStep, c: Creature, witch: number): void {
  const { w, s, time } = k, P = commandProfile(c.species, c.level), her = w.witches.find(h => h.id === witch);
  if (!her) return;
  const R = P.tauntRadius ?? 10;
  let near: Creature | null = null, nd = Infinity;
  for (const o of w.active) {
    if (!wildFoe(o)) continue;
    const d = Math.hypot(o.x - her.x, o.z - her.z);
    if (d > Math.max(R, P.reach)) continue;
    if (d < nd) { nd = d; near = o; }
    if (d <= R && o.level !== LEGEND) { o.taunt = { by: c.id, until: time + (P.taunt ?? 3) }; s.events.push({ kind: "taunted", x: o.x, z: o.z, at: time, id: o.id }); }
  }
  if (!near) return;
  // (thrown: its knock eased off over a moment, rules/combat/hits.ts stepKnock, which carries it about speed / 10 metres)
  const dx = near.x - her.x, dz = near.z - her.z, d = Math.hypot(dx, dz) || 1, v = (P.knock ?? 10) * 10;
  near.kx = (dx / d) * v; near.kz = (dz / d) * v; near.hurtAt = time;
  const f = (c.fight ??= { target: null, readyAt: time, windupUntil: 0, aimX: near.x, aimZ: near.z });
  f.target = { kind: "creature", id: near.id }; f.readyAt = Math.min(f.readyAt, time);
}
