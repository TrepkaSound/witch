// The small rules a creature's turn in a fight asks of the step (rules/combat/step.ts CombatStep): the dodge's tokens, an attack's
// reach and wind-up at her, an attack in the grammar thrown and wound up, a hopper's bounds, the heavies, her posse's claims, the
// waiting rings' gaps. Once closures inside stepCombat (rules/combat.ts); the same sums in the same order.
import { LEGEND, type Creature } from "../creatures";
import { FIGHT, type profileOf } from "../movement";
import type { Attack, Target } from "./data";
import { sideOf } from "./targeting";
import { newSpells, cast as castSpell, solveAim } from "../attacks/engine";
import { intercept, liftedWindup, trackFor, withSpeedFloor } from "../attacks/aim";
import { bodyReach, hittableOf, reachingFurther, spellWorld } from "../attacks/combatWorld";
import type { AttackSpec } from "../attacks/types";
import { packGate, markStrike, type Directive } from "./packs";
import { momentumOf } from "../momentum";
import { SPACING, drawnRadius, waitingProfile } from "../combatSpacing";
import type { CombatStep } from "./step";

/** Each attack in the grammar as thrown (thrown below): at her (by dodge.b.range) or at anything else. */
type Thrown = { base: Attack; k: number; floor: number; spec: AttackSpec; attack: Attack };
const THROWN = new WeakMap<AttackSpec, { her?: Thrown; any?: Thrown }>();
type Profile = NonNullable<ReturnType<typeof profileOf>>;

/** A hopper's bounds at its run (m/s): each as long as its run takes it over a bound and a beat, so it keeps its own pace, at least styles.hopper.length. */
export function hopOf(k: CombatStep, run: number, creature?: Creature) { const M = k.spacing && creature ? waitingProfile(creature) : null, H = M ? { length: M.stride, time: M.cadence * M.duty, height: M.lift, pause: M.cadence * (1 - M.duty) } : k.YS.hopper, L = Math.max(H.length, (run * (H.time + H.pause)) / (FIGHT.scale * FIGHT.speed)); return L === H.length ? H : { ...H, length: L }; }
/** Her posse's claims kept up as they choose (k: +1 or -1). */
export function claim(k: CombatStep, tg: { kind: string; id?: number } | null | undefined, n: number): void { if (tg?.kind === "creature" && tg.id !== undefined) k.claims.set(tg.id, (k.claims.get(tg.id) ?? 0) + n); }

/** An attack in the grammar starts its windup: its telegraphs and its cast with the engine, released at the windup's end (its own
 *  windup, whatever shortens other shots'). */
export function startSpell(k: CombatStep, c: Creature, f: NonNullable<Creature["fight"]>, atk: { name: string; damage: number; attack: Attack; spec: AttackSpec }): void {
  const { s, w, grid, data, t, time, RG } = k;
  const S = (s.spells ??= newSpells()), spec = f.target ? thrown(k, atk, f.target).spec : atk.spec, W = spellWorld(w, s, grid, S.seed, data), target = hittableOf(w, s, f.target);
  // (at her, its aim followed till it locks, ranged.lock before it can reach her: rules/attacks/aim.ts; its wind-up as it was unless
  // that lock couldn't hold in it)
  const her = f.target?.kind === "witch" ? W.where("witch", f.target.id) : null, sl = her && c.level !== LEGEND ? momentumOf(c.species, t)?.strikeLead ?? 1 : 1;
  const track = her ? trackFor(spec, c.level, RG, sl) : undefined;
  let windup = atk.spec.cast?.windup ?? 0.6;
  if (track && her) windup = liftedWindup(windup, intercept(her, windup, track.lead, (qx, qz) => solveAim(spec, c.x, c.z, qx, qz, c.id, W).time).flight, track);
  f.windupAt = time; f.windupUntil = time + windup; f.aim = track ? { at: time, track } : undefined;
  f.spellCast = castSpell(S, W, spec, atk.name, { id: c.id, x: c.x, z: c.z, side: sideOf(c), species: c.species, heading: Math.atan2(f.aimZ - c.z, f.aimX - c.x) }, target, time, atk.damage, f.windupUntil, { track, centre: RG.on });
}

/** May it start a strike at tg now (a token free; only her strikers are counted)? Takes the token if so. A pack member takes one as
 *  well as its pack's turn and pressure, its call too (Ed, 2026-10-20: the dodge's limit holds inside a pack; fights between
 *  creatures as before). */
export const free = (k: CombatStep, tg: Target): boolean => !k.DA || tg.kind !== "witch" || (k.striking.get(tg.id) ?? 0) < ((k.onHer.get(tg.id) ?? 0) >= k.DA.swarm ? k.DA.swarmTokens : k.DA.tokens);
export const take = (k: CombatStep, tg: Target): void => { if (k.DA && tg.kind === "witch") k.striking.set(tg.id, (k.striking.get(tg.id) ?? 0) + 1); };
export const token = (k: CombatStep, tg: Target): boolean => { if (!free(k, tg)) return false; take(k, tg); return true; };
/** Its windup: a shot or lob at her winds up at most dodge.b.windup (a beam as before: a sweep a blink can't outrun needs its warning). */
export const windupOf = (k: CombatStep, A: Attack, tg: Target) => (k.DB && tg.kind === "witch" && (A.delivery === "shot" || A.delivery === "lob") ? Math.min(A.windup, k.DB.windup) : A.windup);
/** Every ranged attack's reach times difficulty.rangedRange (CombatStep.RR); a melee one or a pulse round itself as it is. */
const rangedOf = (k: CombatStep, A: Attack) => (A.delivery === "shot" || A.delivery === "lob" || A.delivery === "beam" ? k.RR : 1);
/** An attack's reach at tg: a shot or lob at her dodge.b.range times as far, every ranged one difficulty.rangedRange times. */
export const reachOf = (k: CombatStep, A: Attack, tg: Target): Attack => {
  const her = !!k.DB && tg.kind === "witch" && (A.delivery === "shot" || A.delivery === "lob"), n = (her ? k.DB!.range : 1) * rangedOf(k, A);
  if (n === 1) return A;
  const m = her ? k.longer : k.longerAny;
  let L = m.get(A);
  if (!L || L.range !== A.range * n) m.set(A, (L = { ...A, range: A.range * n }));
  return L;
};
/** An attack in the grammar thrown at tg: a shot at her reaching dodge.b.range times as far, its bolt too (rules/attacks/combatWorld.ts
 *  reachingFurther), and fired from no further than its bolt really gets (bodyReach: a frost shard that ends short and bursts, a
 *  roller that slows or stops and goes), so no shot is fired that can't reach. */
export const thrown = (k: CombatStep, sp: { attack: Attack; spec: AttackSpec }, tg: Target): Thrown => {
  const { DB, FLOOR, RG, t } = k;
  const atHer = tg.kind === "witch", her = !!DB && atHer && sp.attack.delivery === "shot", n = (her ? DB!.range : 1) * rangedOf(k, sp.attack), floor = atHer ? FLOOR : 0;
  let m = THROWN.get(sp.spec);
  if (!m) THROWN.set(sp.spec, (m = {}));
  const hit = atHer ? m.her : m.any;
  if (hit && hit.base === sp.attack && hit.k === n && hit.floor === floor) return hit;
  // (at her, a straight bolt or roller flies at least the speed floor: ranged.speedFloor times her ground speed, rules/attacks/aim.ts)
  const far = reachingFurther(sp.spec, n), spec = floor ? withSpeedFloor(far, RG, t.groundSpeed) : far, A = reachOf(k, sp.attack, tg), reach = bodyReach(spec), out: Thrown = { base: sp.attack, k: n, floor, spec, attack: reach < A.range ? { ...A, range: reach } : A };
  if (atHer) m.her = out; else m.any = out;
  return out;
};
/** The heavies (dodge.a.heavy; Ed, 2026-10-09: "Maybe heavies can have a higher top speed, but slow acceleration?"): chasing her,
 *  a top speed above her walk built up slowly, so a burst or a blink gets clear and a long straight retreat is run down. */
export const heavyOf = (k: CombatStep, c: Creature, P: Profile) => {
  let H = k.heavyProfiles.get(c.species);
  if (!H) k.heavyProfiles.set(c.species, (H = { ...P, accel: k.DA!.heavy.accel }));
  return H;
};
/** A committed strike's reach at her, times its attack's range (dodge.a.width). */
export const widthOf = (k: CombatStep, tg: Target) => (k.DA && tg.kind === "witch" ? k.DA.width : 1);
/** Her velocity (the witch tg), or none. */
export const velOf = (k: CombatStep, tg: Target) => { const v = tg.kind === "witch" ? k.w.witches[tg.id] : undefined; return { vx: v?.vx ?? 0, vz: v?.vz ?? 0 }; };
/** May it start a strike now: its pack's turn and pressure (if it's in one), and at her a dodge token. A pack member kept waiting
 *  only by the token holds its combo open (packs.ts: held), so its pack's strikes at her come one after another, not all at once. */
export const strikeNow = (k: CombatStep, pd: Directive | undefined, tg: Target): boolean => {
  if (pd && !packGate(pd)) return false;
  if (token(k, tg)) return true;
  if (pd) pd.state.held = k.time;
  return false;
};
/** A pack member's own move (its charge, leap or burrow: its creature.js's `movement`) as its strike: may it set off now (its turn, its
 *  pack's pressure, a dodge token free: asked, not taken; the token's taken as it sets off, `ownStruck`)? Out of a pack, always. */
export const ownMay = (k: CombatStep, pd: Directive | undefined, tg: Target): boolean => {
  if (!pd) return true;
  if (pd.move !== "melee" || !packGate(pd)) return false;
  if (free(k, tg)) return true;
  pd.state.held = k.time;
  return false;
};
export const ownStruck = (k: CombatStep, pd: Directive | undefined, c: Creature, tg: Target): void => { if (pd) { take(k, tg); markStrike(pd, c, k.time); } };
/** A ring's gap: its members' bodies and clearances round its circle, shared out (once a ring a step). */
export const ringGap = (k: CombatStep, ring: readonly number[]) => { const key = ring.join(","); let g = k.ringGaps.get(key); if (g === undefined) { g = 0; for (const id of ring) { const o = k.w.creatures[id]; if (o) g += 2 * drawnRadius(o, k.t) + SPACING.clearance; } g /= Math.max(1, ring.length); k.ringGaps.set(key, g); } return g; };
/** A team's widest body (once a members list a step). */
export const widestOf = (k: CombatStep, members: readonly number[]) => { let r = k.widest.get(members); if (r === undefined) { r = -Infinity; for (const id of members) { const o = k.w.creatures[id]; if (o) r = Math.max(r, drawnRadius(o, k.t)); } k.widest.set(members, r); } return r; };
