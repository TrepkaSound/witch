// An island's coastline by its kind: its seed, its size by phase, and its coast's radii round it (rules/mapShape.ts makeCoast).
// Split from rules/islandShape.ts (which still exports all of it), so the zoo's layout (rules/zooMap.ts) can read it without
// importing the map.
import { makeCoast, type CoastKnobs } from "./mapShape";
import { seedName } from "./kinds";
import { sizeOfPhase } from "./rosters";

/** What an island's shape needs: its kind (a legend's species, or "home"), and, from the rosters (islandOf), its phase, seed
 *  and size in areas when known. Until then: the phase is 1, the seed the kind's own (islandSeed), the size by phase. */
export interface IslandSpec { kind: string; phase?: number; seed?: number; areas?: number }

/** A kind's own seed for its island: a hash of its name (FNV-1a), the same on every run. */
export function islandSeed(kind: string): number {
  let h = 2166136261; kind = seedName(kind); // (a renamed kind keeps its island's shape: rules/kinds.ts)
  for (let i = 0; i < kind.length; i++) h = Math.imul(h ^ kind.charCodeAt(i), 16777619);
  return (h >>> 0) % 1000003;
}

/** An island's size in areas by its phase (rules/rosters.ts sizeOfPhase; Ed, 2026-11-04: 10 / 15 / 20 / 25 / 30 areas, 10 / 20 / 30 /
 *  40 / 50 till then; a kind of phase p, the kinds table's (rules/kinds.ts), has its island in phase p + 1; home about 64 at the end). */
export const islandAreas = (phase: number): number => sizeOfPhase(Math.max(1, Math.min(5, Math.round(phase) + 1)));
export const HOME_AREAS = 64;

/** The coastline: `n` radii round the island (from east, clockwise as the map's angles run: atan2(z, x)), each as a share of
 *  the biggest island's radius (HOME_AREAS), so islands keep their sizes against each other; and its seed and areas. */
export function islandCoast(spec: IslandSpec, coast: CoastKnobs | undefined, n = 96): { radii: Float32Array; seed: number; areas: number } {
  const home = spec.kind === "home", seed = spec.seed ?? islandSeed(spec.kind), areas = spec.areas ?? (home ? HOME_AREAS : islandAreas(spec.phase ?? 0));
  const c = makeCoast(seed, coast), size = Math.sqrt(areas / HOME_AREAS), radii = new Float32Array(n);
  for (let k = 0; k < n; k++) radii[k] = size * c(-Math.PI + (k / n) * Math.PI * 2);
  return { radii, seed, areas };
}
