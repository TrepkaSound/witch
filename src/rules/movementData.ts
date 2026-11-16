// The creatures' movement data (config/movement.json and each species' own folder): profiles, legend move sets, bodies; the fight's
// scale and speed (FIGHT, set from the tuning each combat step). Split from rules/movement.ts (which still exports all of it), so
// momentum, spacing, the combat spacing and the combat data can read them without importing the movement rules.
import raw from "../../config/movement.json";
import { sectionOf } from "./creatureConfig";


export type BehaviourKind = "arrive" | "keepRange" | "orbit" | "strafe" | "slot" | "separation" | "cohesion" | "wander" | "dodge" | "light";
export interface Behaviour { kind: BehaviourKind; w: number; near?: number; far?: number; radius?: number; swap?: number }
export type TacticKind = "surround" | "pincer" | "hitAndRun" | "volley" | "swarm" | "flank" | "none";
export interface Move { kind: "charge" | "ambush" | "burrow" | "leap" | "dig" | "block" | "trail" | "flash" | "swoop"; cooldown: number;
  /** A swoop (the wild flyers): it circles `radius` m round its target at `circle` m/s, `height` m up (out of reach), now and then
   *  wavering by `jitter` of its radius (a bat's erratic flight); then telegraphs for `windup` seconds (rising to `rise` times its
   *  height meanwhile: the raven climbing out of view, its shadow growing), dives along a line at `speed` m/s at where its target
   *  will be (`lead` of its velocity times the dive's flight time, at the moment it lets go), on `overshoot` m past, skims low for
   *  `bottom` seconds and climbs back up over `climb` seconds; `dives` such dives in a bout, then `cooldown` seconds circling.
   *  Hittable (and invitable) only in the dive and at the bottom. A dive that touches her throws her `knockback` m. */
  circle?: number; jitter?: number; rise?: number; lead?: number; bottom?: number; climb?: number; dives?: number; knockback?: number;
  /** A charge: backs off at this speed (m/s) while it lowers its head (the ram's run-up); its pack mates charge with it (the stags' pair); curled up while it rolls, taking this times the damage (the hedgehog's, the woodlouse's). */ backup?: number; pair?: boolean; curl?: number;
  /** A leap that lands a blow on its target (the lynx's pounce), not a slam round it; an ambush that strikes the moment it springs (the snake's). */ strike?: boolean;
  /** Dig in, block, trail, flash: seconds it lasts (time), the damage it takes meanwhile times armour, a slow's speed times slow, a trail's drop every seconds, a radius. */ armour?: number; slow?: number; every?: number; radius?: number; /** A charge: seconds it lowers its head first (its lane telegraphed); how fast it builds speed and brakes (m/s each second), how fast it turns braking (degrees a second), and how far it runs on past its target before braking (m). */ windup?: number; accel?: number; brake?: number; turn?: number; overshoot?: number; from?: number; to?: number; speed?: number; time?: number; trigger?: number; height?: number }
export interface Profile {
  /** Its speed in a fight (m/s, times tuning fight.speed; the usual is combat.fightRun). */
  speed?: number;
  /** Its sprint closing in from afar (m/s; else combat.pursuitRun): slow kinds (a snail) don't sprint. */
  pursuit?: number;
  /** Its own momentum chasing the witch, over its class's (rules/momentum.ts; tuning creatureMomentum). */
  momentum?: Partial<import("./momentum").Momentum>;
  /** How quickly it changes velocity (m/s per second): heavy creatures turn slowly. */
  accel: number;
  fight: Behaviour[];
  tactics?: { kind: TacticKind; w: number }[];
  move?: Move;
  /** A glider's roam (the flying squirrel: Ed, 2026-10-12, "its movement should glide between trees"): a spot it roams to `min` m or
   *  more off it glides to with `chance`, after its pause, at `speed` m/s, `height` m up at the top of the arc (rules/creatures.ts). */
  glide?: { min: number; speed: number; height: number; chance: number };
}
/** A wild legend's move set (Stage 5): moves (combat.json attacks) in a loop, and its second phase. */
export interface LegendSet { pattern: string[]; phase2: { at: number; pattern: string[]; speed: number; cooldown: number } }
export interface MovementData { repick: number; packRadius: number; profiles: Record<string, Profile>; legends: LegendSet & { bySpecies: Record<string, LegendSet> }; /** Body sizes, for spacing (rules/spacing.ts). */ bodies: import("./spacing").Bodies }
const R = raw as unknown as MovementData;
// (the species' own profiles, legend moves and radii from their folders, over anything the file still holds: rules/creatureConfig.ts)
export const MOVEMENT: MovementData = { ...R, profiles: { ...R.profiles, ...(sectionOf("movement") as Record<string, Profile>) }, legends: { ...R.legends, bySpecies: { ...R.legends.bySpecies, ...(sectionOf("legendMoves") as Record<string, LegendSet>) } }, bodies: { ...R.bodies, radius: { ...R.bodies.radius, ...sectionOf("radius") } } };
/** A species' roaming glide, if it glides (Profile.glide). */
export const glideOf = (species: string): Profile["glide"] => MOVEMENT.profiles[species]?.glide;

/** The fight's scale and speed (Ed's motion scale pass, 2026-10-04; tuning fight, ?fightScale= and
 *  ?fightSpeed=, and live in the debug overlay): every length in a fight (attack ranges, lunges,
 *  radii, knockback, pattern sizes, pursuit) times scale; every fight speed (running, charging,
 *  shots) times speed; momentum: how heavily creatures in a fight change speed and turn (their
 *  accelerations and turn rates divided by it). Set from the tuning at each combat step. */
/** The fight's scale and speed, and (Ed's round 13, 2026-10-06: "charging and jumping creatures should
 *  charge or jump much further ... much more momentum, travelling in wide arcs") every species' charge
 *  and leap scaled: tuning fight.charge (reach: its run's time and overshoot, turn: its turn rate,
 *  brake: how hard it slows) and fight.leap (reach: how far off it leaps from, through: metres past
 *  its target it lands; less than 0, short of it). Set from the tuning each step (rules/combat.ts).
 *  And the difficulty (Ed, 2026-11-03: "the game is much too easy"; tuning difficulty): creature, every creature's movement speed in a
 *  fight times it (its run, sprint, chase, charge, swoop and walk home; not her, not its shots, lunges or leaps); adult, an adult's
 *  health and damage times it (rules/combat/data.ts adultMult). */
export const FIGHT: { scale: number; speed: number; momentum: number; charge: { reach: number; turn: number; brake: number; chase?: number; miss?: number }; leap: { reach: number; through: number; lead?: number }; walk: number; creature: number; adult: number } = { scale: 1, speed: 1, momentum: 1, charge: { reach: 1, turn: 1, brake: 1 }, leap: { reach: 1, through: -1.5 }, walk: 0, creature: 1, adult: 1 };
/** FIGHT as a page starts, put back by newGame, so a night begun after another starts as a fresh
 *  page's does (the first steps run before stepCombat sets it: docs/plans/sail-without-reload.md). */
export function resetFight(): void {
  Object.assign(FIGHT, { scale: 1, speed: 1, momentum: 1, charge: { reach: 1, turn: 1, brake: 1 }, leap: { reach: 1, through: -1.5 }, walk: 0, creature: 1, adult: 1 });
}

export const profileOf = (species: string, data: MovementData = MOVEMENT): Profile | null => data.profiles[species] ?? null;
export const legendSetOf = (species: string, data: MovementData = MOVEMENT): LegendSet => data.legends.bySpecies[species] ?? data.legends;
