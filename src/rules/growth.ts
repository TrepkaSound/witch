// The starting population (Ed, 2026-10-07: "pre-populate every area by its route position"; countScale, routePopulation,
// below). Nothing grows in a night (Ed, 2026-10-28: "during a night, no creatures are created and none are destroyed"): the
// wave-by-wave growth that lived here (Ed, 2026-10-04) and its counts kept out of sight are gone. growthLevel and grownAt, the
// old growth's level and pace, stay for tools/balance/fightbot.mjs, tools/behaviour and the strength tests. No drawing here.
import type { Level } from "./creatures";
import type { ForestMap } from "./map";
import { COMBAT, strengthOf, type CombatData } from "./combat";
import { buildSwarm, islandShare, phaseReach, POWER_TABLE, type PowerTable, type SwarmTuning } from "./swarm";
import { foundShare } from "./rosters";
import { hash2 } from "./random";

/** The level of an area's `n`th creature grown at `wave`, by the weights (baby, young, adult): the
 *  same for the same seed, area and wave (the balance simulator reads it too). */
export function growthLevel(seed: number, cell: readonly [number, number], wave: number, n: number, weights: readonly number[]): Level {
  const total = weights.reduce((a, b) => a + Math.max(0, b), 0);
  if (!(total > 0)) return 0;
  let u = hash2(cell[0] * 61 + n * 7, cell[1] * 67 + wave * 131, seed + 4421) * total;
  for (let l = 0; l < Math.min(3, weights.length); l++) { u -= Math.max(0, weights[l]); if (u < 0) return l as Level; }
  return Math.min(2, weights.length - 1) as Level;
}

/** A wave came: each still-wild area (`wild` by key) gains its creatures, as counts. */
/** How many times as many creatures an area of `species` holds (Ed, 2026-10-05): 1 / its strength,
 *  so swarms come about three times as many and loners half as many, and an area's fighting value
 *  stays about the same (to two places, so a strength of a third makes exactly three times). */
export const countScale = (species: string) => Math.round(100 / strengthOf(species)) / 100;

/** An area's starting number of a level: `base` times its count scale, rounded, never fewer than
 *  one if there's any to start with. */
export const startCount = (base: number, scale: number) => (base > 0 ? Math.max(1, Math.round(base * scale)) : 0);

/** How many an area grows at `wave`: perWave times its count scale, the fractions carried from
 *  wave to wave (a loner's half a creature a wave is one every other wave). */
export const grownAt = (wave: number, perWave: number, scale: number) => { const k = perWave * scale; return Math.floor(wave * k + 1e-9) - Math.floor((wave - 1) * k + 1e-9); };

/** Pre-population by route (Ed, 2026-10-07: "pre-populate every area by its route position"; no growth on a clock): its
 *  babies, and at least minHostile young or adults; its hostile swarm is population.swarm's (rules/swarm.ts). */
export interface ByRoute {
  /** Babies in every area, start's included (they're 0 F: quest sigils and berries, not danger). */
  babies: number;
  /** At most this many babies in any area, start's included. */
  babyCap: number;
  /** At least this many young or adults in every wild area (Ed, 2026-10-07: "every wild area has at least one hostile wild
   *  creature"); any shortfall made up with young. */
  minHostile?: number;
}

/** How far along the swarm curve an island's last area comes (Ed, 2026-11-04: "we should rebalance this so phase 5 islands get to
 *  full packs"): a kind's island its phase over swarm.fullPhase (rules/swarm.ts phaseReach), home the share of the islands she's
 *  found (rules/rosters.ts foundShare: full packs only once every island is found), a map that's no island by roster (the radius
 *  map, ?island=N) the whole curve. */
export function islandReach(map: Pick<ForestMap, "island" | "tuning">): number {
  const I = map.island;
  if (!I) return 1;
  return I.kind === "home" ? foundShare(map.tuning.map?.found ?? []) : phaseReach(I.phase, map.tuning.population.swarm);
}

/** An area's whole starting population [babies, young, adults] (its legend and its circle's baby aside), by its place on the
 *  route (`index` of `length`, its island's route, as far along the curve as the island's `reach`: islandShare, islandReach): its hostile swarm (rules/swarm.ts buildSwarm) over population.start's young and adults (times
 *  its count scale), at least minHostile of them; and its babies, byRoute.babies (or start's, if more), at most babyCap. */
export function routePopulation(index: number, length: number, R: ByRoute, S: SwarmTuning, start: { babies: number; young: number; adults: number }, species: string, reach = 1, table: PowerTable = POWER_TABLE, data: CombatData = COMBAT): [number, number, number] {
  const scale = countScale(species), [sy, sa] = buildSwarm(islandShare(index, length, reach), S, species, table, data); // (along its own island, as far as its phase: Ed, 2026-11-04)
  const babies = Math.min(Math.max(0, R.babyCap), Math.max(startCount(start.babies, scale), R.babies));
  const young = startCount(start.young, scale) + sy, adults = startCount(start.adults, scale) + sa;
  return [babies, young + Math.max(0, (R.minHostile ?? 0) - young - adults), adults]; // (at least minHostile young or adults: Ed, 2026-10-07)
}

/** Each area's place on the waves' route (1 the first wave's area; rules/party.ts routeOf), by area key. */
export function routeIndex(order: readonly string[]): Map<string, number> {
  return new Map(order.map((k, i) => [k, i + 1]));
}
