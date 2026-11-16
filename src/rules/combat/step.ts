// What one step of every fight shares between its phases (rules/combat.ts stepCombat): the step's base (the fight's speeds set,
// the grid, the spacing's search), then what each creature's turn reads (her party, the packs, the claims, the dodge's tokens,
// the packs' plans). Split from stepCombat's body: the same sums in the same order.
import { LEGEND, type Creature } from "../creatures";
import { foes } from "../creatureStates";
import { packsOf, profileOf, swoopStriking } from "../movement";
import type { Tuning } from "../tuning";
import { attackOf, type Attack, type CombatData, type CombatState, type CombatWorld } from "./data";
import { fighting, targetable, sideOf, Grid } from "./targeting";
import { useData } from "./hits";
import { setFight } from "../fightSettings";
import { rangedOf as rangedRule } from "../attacks/aim";
import { PACKS, stepPacks, packsOn, packKindOf, packAttack, strikingNow, observedPackPlans } from "./packs";
import { noteWitches } from "../momentum";
import { SPACING, drawnRadius, spacingOn } from "../combatSpacing";

/** The step's own: its world, its clock, and the grid every fighter is found in. */
export interface StepBase {
  s: CombatState;
  w: CombatWorld;
  data: CombatData;
  t: Tuning;
  C: Tuning["combat"];
  time: number;
  dt: number;
  /** The combat spacing (rules/combatSpacing.ts) on. */
  spacing: boolean;
  grid: Grid;
  /** How far round itself a waiting creature looks for neighbours (m). */
  spacingSearch: number;
}

type Dodge = NonNullable<Tuning["dodge"]>;
type Profile = NonNullable<ReturnType<typeof profileOf>>;

/** What every creature's turn reads this step (found once a step, after the shots, beams and slime have done their work). */
export interface CombatStep extends StepBase {
  /** Her party (for angry besiegers looking for the nearest of it or a soundsystem). */
  partyList: Creature[];
  /** Packs (Stage 5): creatures of a kind going for the same target, and their tactic. */
  packs: ReturnType<typeof packsOf>;
  /** How many of her posse are on each creature (acquire spreads them over her attackers: Ed, 2026-10-09). */
  claims: Map<number, number>;
  YS: typeof PACKS.styles;
  /** Friends' places round what they fight: hers and happy ones on one creature, by id. */
  onFoe: Map<number, number[]>;
  DA: Dodge["a"] | null;
  DB: Dodge["b"] | null;
  DC: Dodge["c"] | null;
  RG: ReturnType<typeof rangedRule>;
  /** The speed floor at her (m/s): her ground speed times ranged.speedFloor. */
  FLOOR: number;
  /** Committed strikes' tokens: how many wind up or strike at each witch now, how many go for her. */
  striking: Map<number, number>;
  onHer: Map<number, number>;
  /** difficulty.rangedRange. */
  RR: number;
  longer: Map<Attack, Attack>;
  longerAny: Map<Attack, Attack>;
  heavyProfiles: Map<string, Profile>;
  /** Pack combat's directives this step (rules/combat/packs.ts), or null with packs off. */
  PK: ReturnType<typeof stepPacks> | null;
  /** The legends among them, whose telegraphed strikes the waiting keep clear of. */
  legendsHere: Creature[];
  widest: Map<readonly number[], number>;
  ringGaps: Map<string, number>;
}

/** The step begins: the fight's speeds from the tuning, her trail noted, the grid of fighters, the spacing's search. */
export function beginStep(s: CombatState, w: CombatWorld, data: CombatData): StepBase {
  // (Events gather over a frame's steps: stepGame clears them once a frame, for the view.)
  const { time, dt, t } = w, C = t.combat;
  const spacing = spacingOn(t);
  useData(data);
  setFight(t); // (the fight's speeds from the tuning: rules/fightSettings.ts)
  if (t.creatureMomentum?.on) noteWitches(s, w.witches, time); // (her trail, for the creatures' reaction delay: rules/momentum.ts)
  // (the grid every fighter is found in: shots, beams and slime hit what's in it, and each creature's turn looks round it)
  const grid = new Grid(w.active.filter(c => fighting(c)));
  let spacingSearch = SPACING.search;
  if (spacing) for (const c of w.active) spacingSearch = Math.max(spacingSearch, drawnRadius(c, t) * 2 + SPACING.clearance + Math.hypot(c.vx ?? 0, c.vz ?? 0) * SPACING.predict);
  return { s, w, data, t, C, time, dt, spacing, grid, spacingSearch };
}

/** What every creature's turn reads this step: her party, the packs, her posse's claims, friends' places, the dodge's tokens, the
 *  packs' plans (stepPacks), the legends about. */
export function combatStep(b: StepBase): CombatStep {
  const { s, w, data, t, time } = b;
  // Her party (for angry besiegers looking for the nearest of it or a soundsystem).
  const partyList = w.active.filter(o => foes("enraged", sideOf(o)) && targetable(o) && !w.asleep(o)); // (what besiegers go for: the leashed and the happy)
  // Packs (Stage 5): creatures of a kind going for the same target, and their tactic.
  const packs = packsOf(w.active.filter(c => c.fight?.target && fighting(c)).map(c => ({ c, target: JSON.stringify(c.fight!.target) })), time);
  // How many of her posse are on each creature (acquire spreads them over her attackers: Ed, 2026-10-09).
  const claims = new Map<number, number>();
  for (const o of w.active) if (o.leashed && o.fight?.target?.kind === "creature" && !w.parked(o.id)) claims.set(o.fight.target.id, (claims.get(o.fight.target.id) ?? 0) + 1);
  // Friends' places round what they fight (Ed's playtest, 2026-10-29: "friends, even more, bunch up"; packs.json styles.friends): hers
  // and happy ones on one creature, by id, each its own place evenly round it.
  const YS = PACKS.styles, onFoe = new Map<number, number[]>();
  if (YS?.friends.on) for (const o of w.active) if (foes("enraged", sideOf(o)) && o.fight?.target?.kind === "creature" && !w.parked(o.id)) { const id = o.fight.target.id, l = onFoe.get(id); if (l) l.push(o.id); else onFoe.set(id, [o.id]); }

  // Dodging matters (Ed, 2026-10-08; tuning dodge): against the witch, committed strikes (a), predictive aim (b), packs
  // cutting off her retreat (c). Committed strikes' tokens: how many wind up or strike at each witch now, how many go for her.
  const DD = w.t.dodge, DA = DD?.a.on ? DD.a : null, DB = DD?.b.on ? DD.b : null, DC = DD?.c.on ? DD.c : null;
  // Creatures' ranged attacks aim where she's going (Ed, 2026-11-12; tuning ranged, rules/attacks/aim.ts; ?ranged=old the old aim):
  // the speed floor at her, in m/s (her ground speed times ranged.speedFloor), and the rule itself.
  const RG = rangedRule(t), FLOOR = RG.on ? RG.speedFloor * t.groundSpeed : 0;
  const striking = new Map<number, number>(), onHer = new Map<number, number>(), PO = packsOn(t);
  if (DA) for (const o of w.active) {
    const tg = o.fight?.target;
    if (tg?.kind !== "witch") continue;
    onHer.set(tg.id, (onHer.get(tg.id) ?? 0) + 1);
    // (winding up, lunging, or let go within the last dodge.a.gap seconds: so strikes at her come no faster than a dodge can answer)
    const f = o.fight!, cd = ((PO && f.packMove && packAttack(o.species, o.level, f.packMove)) || attackOf(o.species, o.level, data))?.attack.cooldown ?? 0; // (a pack member's own move's: a bolt's cooldown isn't its bite's)
    // (a pack kind's own move too, its charge or its leap: in a pack it's a strike that takes a token, rules/combat/packs.ts)
    if (f.windupUntil > 0 || f.lunge || swoopStriking(o) || (PO && packKindOf(o.species) && strikingNow(o)) || time - (f.readyAt - cd) < DA.gap) striking.set(tg.id, (striking.get(tg.id) ?? 0) + 1); // (a swoop telegraphing, diving or at its bottom too: rules/movement.ts)
  }
  /** A shot or lob at her reaches dodge.b.range times as far (Ed, 2026-10-09: "I think shooters should have longer range"); and every
   *  ranged attack (a shot, a lob, a beam: never a melee one or a pulse round itself) difficulty.rangedRange times as far, at anything
   *  (Ed, 2026-11-03: "ranged attacks have +20% range"). */
  const RR = t.difficulty?.rangedRange ?? 1;
  // Pack combat (rules/combat/packs.ts; Ed, 2026-10-15, behind combat.packs.on): each pack's phase and each member's role and move.
  const PK = packsOn(t) ? stepPacks(s, w, w.packWorld ?? {}) : null;
  if (observedPackPlans.has(s)) observedPackPlans.set(s, PK);
  // (the legends among them, whose telegraphed strikes the waiting keep clear of: found once a step, not once a creature; each one's
  // windup still read as it is when each creature looks, as before)
  const legendsHere = b.spacing ? w.active.filter(o => o.level === LEGEND) : [];
  // (a team's widest body, for its members' waiting gap: max of bodyGap over the members is its own radius plus the widest's, the
  // same sum; worked out once a members list, not once a member; and a ring's gap: its members' bodies and clearances round its
  // circle, shared out; worked out once a ring a step)
  return {
    ...b, partyList, packs, claims, YS, onFoe, DA, DB, DC, RG, FLOOR, striking, onHer, RR,
    longer: new Map(), longerAny: new Map(), heavyProfiles: new Map(), PK, legendsHere, widest: new Map(), ringGaps: new Map(),
  };
}
