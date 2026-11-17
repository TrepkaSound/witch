// The species profiles for openings, poise and commands (docs/plans/combat-skill-and-commands.md, section 1, "A species profile";
// Ed, 2026-11-17: "We should aim for a lot of distinct parameters and maximum expressiveness, and then we can have 'what creatures
// have what settings' as design and balancing"). config/combat-skill.json: a global default for each number, any species overriding
// any of them, and any level (youth, adult, legend) overriding the species. Pure lookups, no state.
import raw from "../../../config/combat-skill.json";
import type { Tuning } from "../tuning";

/** A command's verb (section 3): one per role in this slice. */
export type Verb = "Strike" | "Snare" | "Guard" | "Surge";

export interface SkillProfile {
  sit: { time: number };
  poise: { letters: number | string; windup: number; regenDelay: number; regenTime: number };
  stagger: { time: number; cancels: boolean; immune: number };
  daze: { time: number; speed: number };
}

export interface CommandProfile {
  verb?: Verb; name?: string;
  start: number; reach: number; power: number; cast: number; buff: boolean; buffTime: number; buffStacks: number; legendCooldown: number;
  max: number; perBerry: number; cooldown: number;
  knock?: number; taunt?: number; tauntRadius?: number; stun?: number;
}

type Obj = Record<string, unknown>;
const RAW = raw as unknown as { global: Obj; species: Record<string, Obj> };
const LEVELS = ["baby", "youth", "adult", "legend"] as const;

/** b's keys over a's, one level deep for objects. */
const over = (a: Obj, b: Obj | undefined): Obj => {
  if (!b) return a;
  const out: Obj = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" ? { ...(a[k] as Obj), ...(v as Obj) } : v;
  return out;
};

/** Openings on (?skill=1). */
export const skillOn = (t: Tuning): boolean => !!t.skill?.on;
/** Commands on (?commands=1). */
export const commandsOn = (t: Tuning): boolean => !!t.commands?.on;

// module-state: a cache keyed by all its inputs (species, level) over the static config file
const skillCache = new Map<string, SkillProfile | null>();
/** A species' openings at a level, or null for a species without them (only those listing sit or poise: hare, badger, dormouse). */
export function skillProfile(species: string, level: number): SkillProfile | null {
  const key = `${species}/${level}`;
  if (skillCache.has(key)) return skillCache.get(key)!;
  const sp = RAW.species[species];
  let out: SkillProfile | null = null;
  if (sp && (sp.sit || sp.poise)) {
    const lv = sp[LEVELS[Math.max(0, Math.min(3, level))]] as Obj | undefined;
    const pick = (k: keyof SkillProfile) => over(over(RAW.global[k] as Obj, sp[k] as Obj | undefined), lv?.[k] as Obj | undefined);
    out = { sit: pick("sit"), poise: pick("poise"), stagger: pick("stagger"), daze: pick("daze") } as unknown as SkillProfile;
  }
  skillCache.set(key, out);
  return out;
}

// module-state: a cache keyed by all its inputs (species, level) over the static config file
const commandCache = new Map<string, CommandProfile>();
/** A species' command at a level (a legend's numbers are the adult's, its cooldown legendCooldown times as long: Ed, 2026-11-17,
 *  answer 6). Every species gets one, for its charges; only those with a verb act. */
export function commandProfile(species: string, level: number): CommandProfile {
  const key = `${species}/${level}`;
  const hit = commandCache.get(key);
  if (hit) return hit;
  const G = RAW.global.command as Obj, S = (RAW.species[species]?.command ?? {}) as Obj, legend = level >= 3;
  const lv = legend ? "adult" : level <= 1 ? "youth" : "adult";
  const strip = (o: Obj) => Object.fromEntries(Object.entries(o).filter(([k]) => !LEVELS.includes(k as never)));
  const merged = { ...strip(G), ...(G[lv] as Obj), ...strip(S), ...((S[lv] as Obj) ?? {}), ...(legend ? ((S.legend as Obj) ?? {}) : {}) } as unknown as CommandProfile;
  const out = legend ? { ...merged, max: Infinity, cooldown: merged.cooldown * merged.legendCooldown } : merged;
  commandCache.set(key, out);
  return out;
}

/** Letters that break its poise: its share of its meter (invites.hits for its level), or a count; at least one. */
export function poiseLetters(P: SkillProfile, level: number, t: Tuning): number {
  const L = P.poise.letters, hits = t.invites.hits[Math.max(0, Math.min(t.invites.hits.length - 1, level))] ?? 7;
  const n = typeof L === "string" && L.endsWith("%") ? (hits * Number(L.slice(0, -1))) / 100 : Number(L);
  return Math.max(1, Math.round(n));
}
