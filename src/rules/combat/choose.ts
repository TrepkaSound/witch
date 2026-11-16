// A creature's turn in a fight: which attack it has (rules/combat/turn.ts), what it goes for (guarding round its sigil or its area,
// besieging, turned on her, retreating), and what it does with nothing to fight. Split from stepCombat's loop (rules/combat.ts):
// the same sums in the same order.
import { type Creature } from "../creatures";
import { truce } from "./targeting";
import { FIGHT, landSwoop, profileOf } from "../movement";
import { isHomeKey } from "../speakers";
import { attackOf, type Attack } from "./data";
import { sideOf, targetPos, gaveUp, valid, acquire, moveToward, nearestSound } from "./targeting";
import { ATTACK_LIB } from "../attacks/index";
import { speciesSpell, spellAttack } from "../attacks/combatWorld";
import type { AttackSpec } from "../attacks/types";
import { packAttack, packKindOf, type Directive } from "./packs";
import { advanceMotion } from "../locomotion";
import { guardRadius } from "./reach";
import { nearestHomeSpeaker } from "./siege";
import { claim } from "./strikes";
import type { CombatStep } from "./step";

/** An attack in the grammar a creature fights with: one given it, or its species' own. */
export type Spell = { name: string; attack: Attack; damage: number; spec: AttackSpec };
/** What it fights with this step: an attack in the grammar, its pack role's move, or its old attack by level. */
export type Armed = Spell | NonNullable<ReturnType<typeof packAttack>> | NonNullable<ReturnType<typeof attackOf>>;

/** A species' own attack as a pack member's strike: a lunger's if it's close (a lunge, or an area round itself), a shooter's if it's
 *  from afar (moving and timed as its pack's shooters, reaching as far) and its pack's shot is the plain bolt, not one of its own (the
 *  toad's spores); else none, its pack's own move. Out of a pack, always. Alone (a pack of one: no combo to keep) too, a far one
 *  timed as its pack's shooters, unless its pack's shot is one of its own (Ed's playtest, 2026-10-29, "I didn't seem to see any
 *  projectile attacks": a lone fox, marten or dormouse was its own lunger and never threw its bolt). */
function roleSpell(sp: SpeciesSpell | null, c: Creature, kind: ReturnType<typeof packKindOf> | null, pd: Directive | undefined): SpeciesSpell | null {
  if (!sp || !pd || !kind) return sp;
  const close = sp.attack.delivery === "melee" || sp.attack.delivery === "pulse", alone = pd.state.size < 2;
  const designed = !!kind.ranged && !!(kind.ranged.patch || kind.ranged.attacks || kind.ranged.delivery === "lob"); // (its pack's own designed shot: the toad's spores, the salamander's beam)
  if (pd.team) {
    // A native close attack must not replace the selected projectile, even alone.
    if (pd.action?.delivery === "effect") return null;
    if (pd.move === "melee") return close ? sp : null;
    if (close || designed) return null;
  }
  if (!alone) {
    if (pd.move === "melee") return close ? sp : null;
    if (close && kind.melee) return null;
    if (designed) return null; // (its pack's shot stays)
  } else if (designed && !close) return null; // (alone too: its pack's designed shot, not its own)
  const P = packAttack(c.species, c.level, "ranged");
  if (close || !P) return sp;
  const key = `${c.level}/${sp.damage}`;
  let by = FAR.get(sp.spec);
  if (!by) FAR.set(sp.spec, (by = new Map()));
  let out = by.get(key)?.from === P.attack ? by.get(key)!.out : undefined;
  if (!out) {
    // (it moves and times its shots as its pack's shooters do; what it fires is its own, reaching as far, wound up at least as long)
    const reach = P.attack.range, k = reach / sp.attack.range, windup = Math.max(P.attack.windup, sp.spec.cast?.windup ?? 0.6);
    const spec = { ...sp.spec, cast: { ...sp.spec.cast, range: reach, windup }, ...(sp.spec.life?.range !== undefined ? { life: { ...sp.spec.life, range: sp.spec.life.range * k } } : {}) };
    by.set(key, { from: P.attack, out: (out = { ...sp, spec, attack: { ...P.attack, windup }, damage: sp.damage * (P.attack.cooldown / sp.attack.cooldown) }) });
  }
  return out;
}
type SpeciesSpell = NonNullable<ReturnType<typeof speciesSpell>>;
// (by its own spell's spec, then its level and damage, and checked against the pack's shot it copies: keyed by name and level alone it
// kept the first game's reach and damage, another fight scale's or difficulty's, for every game after: docs/notes/module-state.md)
const FAR = new WeakMap<object, Map<string, { from: object; out: SpeciesSpell }>>();

/** Its attack this step: `spell`, one in the grammar, and `atk`, what it strikes with (none: a baby, which doesn't attack). */
export function attackFor(k: CombatStep, c: Creature, pd: Directive | undefined): { spell: Spell | null; atk: Armed | null } {
  const { s, t, data, PK } = k;
  // (an attack in the grammar given it, rules/attacks/; else its species' own, the default since step 5: ?attacks=old for the old)
  // (its species' own: against a soundsystem its old attack, so the sieges stay as balanced; in a pack, as its role's strike when its
  // range suits the role, a lunger's close (a lunge, or an area round itself), a shooter's from afar, else its pack's own move, so the
  // pack's combos and specials go on as they were)
  const spell = c.spell !== undefined ? spellAttack(c, s.attackLib ?? ATTACK_LIB, data) : !(t.attacks?.species ?? true) || c.fight?.target?.kind === "sound" ? null : roleSpell(speciesSpell(c, data, t.attacks?.reactionFloor), c, PK ? packKindOf(c.species) : null, PK?.get(c.id));
  const atk = spell || (pd && packAttack(c.species, c.level, pd.move)) || attackOf(c.species, c.level, data); // (a pack member: its role's move)
  return { spell, atk };
}

/** What it goes for: its target kept, given up or found (guarding, its posse's claims, a siege's soundsystem or the nearest of her party). */
export function chooseTarget(k: CombatStep, c: Creature, f: NonNullable<Creature["fight"]>, atk: Armed): void {
  const { s, w, t, C, time, grid, claims, partyList } = k;
  // A happy area legend guards its area like a parked party animal with a far bigger reach, round its home (Ed, 2026-10-04).
  const happy = !c.leashed && (c.legendState === "happy" || c.state === "happy"); // (and every happy creature, #87: it defends its own area)
  // (a happy one looks round where it stands, for anything in its own area: area-wide, as it roams it)
  const lp = c.leashed ? w.leashPoint(c.id) : happy ? { x: c.x, z: c.z } : null, guarding = (!!lp && w.parked(c.id)) || happy;
  // Party animals fight only near their leash point (a parked one within guardRadius of its
  // sigil, and in its sigil's area: below); wild ones within aggro of where they are.
  // (Ed's motion scale pass: party animals chase about 40 m from her or their sigil before giving up)
  // (parked with its sigil in the home area, it guards all of that area and nothing outside it: Ed, 2026-10-11; parked in any
  // other area, all of that area plus guard.radius round its sigil: Ed, 2026-10-15, "Placing a sigil in any area should work as
  // home does: the creatures defend the whole area, plus a radius round the sigil")
  // (the radius round its sigil its chain's length off home, Ed 2026-11-04: "A parked creature should guard its chain length, now
  // that's a fixed number, with home area an exception": guardRadius)
  const S = FIGHT.scale, inHome = !!lp && !!w.home?.inside(lp.x, lp.z), parkedIn = c.leashed && guarding && lp ? (inHome ? w.home! : w.areaAt?.(lp.x, lp.z) ?? null) : null, atHome = !!parkedIn && parkedIn === w.home, GR = guardRadius(t, inHome) * S;
  const H = parkedIn && lp ? (atHome ? parkedIn : { x: parkedIn.x, z: parkedIn.z, r: Math.max(parkedIn.r, Math.hypot(lp.x - parkedIn.x, lp.z - parkedIn.z) + GR), inside: (x: number, z: number) => parkedIn.inside(x, z) || Math.hypot(x - lp.x, z - lp.z) <= GR }) : null; // (the circle covers the area and the radius round the sigil, so acquire finds everything in either)
  const reachX = H ? H.x : lp ? lp.x : c.x, reachZ = H ? H.z : lp ? lp.z : c.z, reach = H ? H.r : lp ? (happy ? t.wildLegends.guard * S : guarding ? GR : C.pursuit * S) : C.aggro * S;
  if (f.target && !valid(w, s, c, f.target)) {
    // Lost her party past its band, or she rose (Ed, 2026-10-06: "instead they should retreat
    // and go back to idling"): a wild one that isn't besieging gives up and heads home. (She herself, on
    // the ground, is no longer lost past the band: Ed, 2026-10-31, rules/combat/targeting.ts valid.)
    if (sideOf(c) === "wild" && !c.siege && !c.leashed && gaveUp(w, c, f.target)) c.retreat = true;
    f.target = null;
  }
  // Turned on her (a wild owl's or unicorn's mind control, rules/combat/packs.ts): one of her animals goes for her till it wears off.
  const turned = !!c.mind && time < c.mind.until && !!w.witches[c.mind.of];
  if (c.mind && !turned) { c.mind = undefined; if (f.target?.kind === "witch") f.target = null; }
  const had = !!f.target;
  if (turned) f.target = { kind: "witch", id: c.mind!.of };
  else if (f.target && lp) { const p = targetPos(w, s, f.target); if (!p || (H ? !H.inside(p.x, p.z) : Math.hypot(p.x - lp.x, p.z - lp.z) > reach + atk.attack.range || (happy && !w.inArea(c, p.x, p.z)))) f.target = null; }
  if (!turned && (!f.target || f.windupUntil === 0)) {
    let near = acquire(w, c, reachX, reachZ, reach, atk.attack.range, grid, guarding, H ? o => H.inside(o.x, o.z) : happy ? o => w.inArea(c, o.x, o.z) : undefined, claims);
    // Retreating, it takes up a fight again only with someone back in its own area (no flip-flopping at the band's edge).
    if (near && c.retreat) { const q = targetPos(w, s, near); if (q && w.inArea(c, q.x, q.z)) c.retreat = undefined; else near = null; }
    if (near && c.leashed && !guarding) { claim(k, f.target, -1); claim(k, near, 1); } // (her posse's claims kept up as they choose)
    if (near) f.target = near;
    else if (!f.target && c.siege && !c.leashed) {
      // An angry area's creatures (its quest undone, Ed 2026-10-04) go for the nearest party animal or
      // soundsystem; a legend keeps to its own area's soundsystem.
      if (isHomeKey(c.siege)) c.siege = nearestHomeSpeaker(s, c.x, c.z) ?? c.siege; // (home: the nearest of its speakers still standing)
      f.target = { kind: "sound", key: c.siege };
      if (!c.boss) {
        const sk = nearestSound(s, c.x, c.z, w.centre, c.siege), sh = sk ? s.sounds.get(sk)! : null, sd = sh ? Math.hypot(sh.x - c.x, sh.z - c.z) : Infinity; // (inward: Ed, 2026-10-11)
        let best: Creature | null = null, bd = sd;
        for (const o of partyList) { const dd = Math.hypot(o.x - c.x, o.z - c.z); if (dd < bd && !truce(c, o)) { bd = dd; best = o; } }
        f.target = best ? { kind: "creature", id: best.id } : sk ? { kind: "sound", key: sk } : f.target;
      }
    }
  }
  if (f.target && !had) f.seenAt = time; // (it reacts in a moment: combat.reaction)
}

/** Nothing to fight: a retreating one heads back into its area, any other lets its strike, its dive, its burrow, its leap go. */
export function idle(k: CombatStep, c: Creature, f: NonNullable<Creature["fight"]>): void {
  const { w, C, time, dt } = k;
  if (f.windupUntil) f.windupUntil = 0;
  f.lunge = undefined;
  if (c.retreat) {
    // Retreating: back into its area at its own pace (a charge's run given up), then roaming again
    // once it's in and within combat.retreatHome metres of home (or its run has taken long enough).
    c.charge = undefined; c.vx = 0; c.vz = 0;
    if (c.retreatFrom === undefined) c.retreatFrom = time;
    const sp = (profileOf(c.species)?.speed ?? C.fightRun) * FIGHT.speed * FIGHT.creature;
    const left = moveToward(c, c.anchorX, c.anchorZ, 1, sp, dt);
    if ((w.inArea(c, c.x, c.z) && left <= C.retreatHome * FIGHT.scale) || time - c.retreatFrom > 30) { c.retreat = undefined; c.retreatFrom = undefined; c.tx = c.x; c.tz = c.z; c.fight = undefined; }
    return;
  }
  if (c.swoop) landSwoop(c, time); // (a flyer glides down)
  c.sprung = undefined; // (an ambusher lies in wait again)
  if (c.burrow) c.burrow = undefined; // (a burrower comes up)
  if (c.leap && advanceMotion(c, { route: c.leap }, time, 0) >= 1) c.leap = undefined; // (a leaper comes down, not put there at once)
  c.dug = undefined; c.brace = undefined; // (a digger comes up, a blocker lowers its tail)
}
