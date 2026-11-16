// A stage of the forest map's making (rules/map.ts generateMap calls them in order; split from its body: the same sums in the same order).
// The night's legends (rules/rosters.ts dealLegends): one area of each dealt kind holds its legend.
import { routeOf } from "../party";
import type { ForestMap } from "../map";
import { AREA_TYPES } from "./areaTypes";
import { dealLegends } from "../rosters";
import { hash2 } from "../random";
import type { MapScenery } from "./scenery";

/** The night's legends: which areas hold one. */
export function nightLegends(m: MapScenery) {
  const { runSeed, tuning, MS, rosterIsland, seed, neighbours, typeOf, legendAreas, legendCells, map, legendSlotOf, live } = m;
  // Each area's sleeping legend's clearing (Ed, 2026-10-06: "Sleeping legends should be in a small
  // circular clearing, where they sit near the top of the circle"): out from the area's middle
  // (where the legend always lay), wholly inside its own area and the map, clear of everything
  // placed before it and of the paths; sized to its legend. Placed after the scenes, before the
  // paths' pieces, so those and all later scenery (trees, decor, berries) keep out of it.
  // The early easy quest (Ed, 2026-10-07: "force a circle into the first three"; rules/quest.ts earlyQuest): one of the first
  // three areas the waves wake always has a legend. When legends.share left all three without, one of them (seeded, one whose
  // kind another of the three doesn't share, so its dream has a creature to want) is given one here, moved from another
  // area so the share holds, before the clearings are cut.
  if (rosterIsland) {
    // The night's legends (rules/rosters.ts dealLegends): one area of each kind dealt; a kind among the route's first three areas
    // (with another kind beside it there, so its dream has a creature to want) dealt where it can be, in its earliest area.
    const order = routeOf(map as unknown as ForestMap).order, kindAt = (k: string) => { const [x, y] = k.split(",").map(Number); return AREA_TYPES[typeOf(x, y)].creature; };
    const first = order.slice(0, 3), early = tuning.legends?.earlyQuest !== false ? first.filter(k => first.some(o => o !== k && kindAt(o) !== kindAt(k))).map(kindAt) : [];
    live.legendKinds = live.dealtKinds ?? dealLegends(rosterIsland, runSeed, new Set(MS.found ?? []), early); // (dealt with the legend areas, above)
    map.legendKinds = live.legendKinds;
    for (const kind of live.legendKinds) {
      const pair = legendSlotOf ? legendSlotOf.get(kind) : [...legendAreas.values()].find(p => kindAt(p) === kind); // (its legend area's pair: the legend's own area)
      if (pair) { legendCells.add(pair); continue; }
      const mine = order.filter(k => kindAt(k) === kind);
      const at = mine.find(k => first.includes(k)) ?? mine[Math.floor(hash2(runSeed, mine.length, 7357 + live.legendKinds.indexOf(kind)) * mine.length)];
      if (at) legendCells.add(at);
    }
  } else if (tuning.legends?.earlyQuest !== false) {
    const order = routeOf(map as unknown as ForestMap).order, first = order.slice(0, 3), kind = (k: string) => { const [x, y] = k.split(",").map(Number); return AREA_TYPES[typeOf(x, y)].creature; };
    if (first.length && !first.some(k => legendCells.has(k))) {
      const fit = first.filter(k => first.some(o => o !== k && kind(o) !== kind(k)));
      // a swap, keeping legends.share and its spread: a legend moves to one of them, from the area the route reaches last
      // or, where that would make a clump of legend areas, from the clump's area beside it
      const last = [...order].reverse().find(k => legendCells.has(k));
      const clump = (k: string, without: string) => { const seen = new Set([k]), todo = [k]; while (todo.length) for (const x of neighbours.get(todo.pop()!) ?? []) if (x !== without && legendCells.has(x) && !seen.has(x)) { seen.add(x); todo.push(x); } return seen.size; };
      const moves = fit.flatMap(k => [last, ...[...(neighbours.get(k) ?? [])].filter(x => legendCells.has(x))].filter((d): d is string => !!d).map(d => ({ k, d, n: clump(k, d) })));
      if (moves.length) {
        const least = Math.min(...moves.map(m => m.n)), best = moves.filter(m => m.n === least), lastFirst = best.filter(m => m.d === last);
        const pick = (lastFirst.length ? lastFirst : best)[Math.floor(hash2(seed, 907, 911) * (lastFirst.length || best.length))];
        legendCells.delete(pick.d); legendCells.add(pick.k);
      }
    }
  }
  return m;
}
export type MapLegends = ReturnType<typeof nightLegends>;
