// What a command at a creature goes for (docs/plans/combat-skill-and-commands.md, section 3, "Targeting"), in both aiming modes
// (twin-stick, and the single stick of release 63, where homing does the aiming). Twin-stick: the wild one nearest her aim line within
// 20° and the command's reach; else the last one her letter landed on in the last 4 s; else the nearest fighting her. Single stick:
// the last one her letter landed on in the last 4 s (homing chose it: "the one I'm working on"); else the nearest in a 40° cone the
// way she's going; else the nearest fighting her. Either way, last, the nearest wild one in reach. Pure: reads the game, writes nothing.
import type { Creature } from "../creatures";
import { foes, stateOf } from "../creatureStates";
import { targetable } from "../combat/targeting";

/** What the choice reads: her place, her aim (a direction, or none), whether she aims with one stick, the way she's going, her last
 *  letter's landing (her clock), her clock now, and the creatures. */
export interface TargetWorld {
  x: number; z: number; witch: number;
  aimX: number; aimZ: number; single: boolean; vx: number; vz: number; facing: number;
  lastHit?: { id: number; at: number }; now: number;
  creatures: readonly Creature[];
}

const AIM_CONE = (20 * Math.PI) / 180, AHEAD_CONE = (40 * Math.PI) / 180, LAST_HIT = 4;

/** A wild one hers can fight, in reach of her. */
const foeInReach = (o: Creature | undefined, W: TargetWorld, reach: number): o is Creature =>
  !!o && !o.gone && !o.leashed && targetable(o) && foes("leashed", stateOf(o)) && Math.hypot(o.x - W.x, o.z - W.z) <= reach;

/** The one nearest the direction (dx, dz) within `cone` radians either side, nearest by angle (twin-stick) or by distance (single stick). */
function inCone(W: TargetWorld, reach: number, dx: number, dz: number, cone: number, byAngle: boolean): Creature | null {
  const dl = Math.hypot(dx, dz);
  if (dl < 1e-3) return null;
  let best: Creature | null = null, bestK = Infinity;
  for (const o of W.creatures) {
    if (!foeInReach(o, W, reach)) continue;
    const ox = o.x - W.x, oz = o.z - W.z, d = Math.hypot(ox, oz) || 1e-6, a = Math.acos(Math.max(-1, Math.min(1, (ox * dx + oz * dz) / (d * dl))));
    if (a > cone) continue;
    const k = byAngle ? a : d;
    if (k < bestK) { bestK = k; best = o; }
  }
  return best;
}

/** The nearest in reach, those fighting her only if `herOnly`. */
function nearest(W: TargetWorld, reach: number, herOnly: boolean): Creature | null {
  let best: Creature | null = null, bestD = Infinity;
  for (const o of W.creatures) {
    if (!foeInReach(o, W, reach)) continue;
    if (herOnly && !(o.fight?.target?.kind === "witch" && o.fight.target.id === W.witch)) continue;
    const d = Math.hypot(o.x - W.x, o.z - W.z);
    if (d < bestD) { bestD = d; best = o; }
  }
  return best;
}

/** The creature a command at one goes for, or null (nothing in reach: the press fizzles, no charge spent). */
export function commandTarget(W: TargetWorld, reach: number): Creature | null {
  const last = W.lastHit && W.now - W.lastHit.at <= LAST_HIT ? W.creatures[W.lastHit.id] : undefined, lastOk = foeInReach(last, W, reach) ? last : null;
  if (W.single) {
    const v = Math.hypot(W.vx, W.vz), [hx, hz] = v > 0.5 ? [W.vx, W.vz] : [W.facing, 0];
    return lastOk ?? inCone(W, reach, hx, hz, AHEAD_CONE, false) ?? nearest(W, reach, true) ?? nearest(W, reach, false);
  }
  return inCone(W, reach, W.aimX, W.aimZ, AIM_CONE, true) ?? lastOk ?? nearest(W, reach, true) ?? nearest(W, reach, false);
}
