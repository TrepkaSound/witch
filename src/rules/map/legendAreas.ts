// A stage of the forest map's making (rules/map.ts generateMap calls them in order; split from its body: the same sums in the same order).
// The legend areas (Ed, 2026-10-26): on an island by roster, an area of its own for each kind's legend, grown beside one of
// its kind's areas, the roomiest; the night's legends dealt.
import type { Cell } from "../partition";
import { cellKey } from "./helpers";
import { AREA_TYPES } from "./areaTypes";
import { dealLegends, isPlaceholder } from "../rosters";
import { byPlace } from "../kinds";
import { hash2 } from "../random";
import { legendRadius } from "../legendFit";
import type { MapRoster } from "./roster";

/** The legend areas, before the land, so the island's land and coast grow round them. */
export function legendAreasOf(m: MapRoster) {
  const { runSeed, tuning, A, MS, zoo, rosterIsland, shapeSeed, toPart, centreCell, partition, neighbours, types, siteOf, grownSet, lakeCells, growable, shapeKinds, live } = m;
  // The legend areas (Ed, 2026-10-26: "legends are spawned in additional areas that have legend circles where runestones usually
  // are"; "extra areas are added to each island, and the legend areas can be adjacent to the same type of area, so it effectively
  // becomes an area twice the size"; all legends in them; "The route only cares about runestones"; islands grow by them): on an
  // island by roster, each of the night's legends is given an area of its own, grown out of the island's frontier beside one of its
  // kind's areas (its pair), taking the pair's kind and look: the roomiest such (the biggest circle it holds, up to what its
  // legend needs), never beside home or another legend area, nor a lake. No runestone, soundsystem, arena or route stop: its
  // legend's circle at its heart. Here, before the land, so the island's land and coast grow round them; the night's legends dealt
  // here too (the route isn't made yet: the early quest's areas taken as the three nearest home). The pair counts as one area
  // (map.areaOf, map.sameArea): a legend's kin and rage, wild creatures chasing and defending. A kind with no room beside any of
  // its areas keeps its legend in one of its own areas, as before (below, once the route's known).
  const legendAreas = new Map<string, string>(), pairCells = new Map<string, Cell>(); // (a legend area's key -> its pair's key, and its pair's cell)
  const slotRoom = new Map<string, number>(); // (each legend area's room, m: the biggest circle it holds, up to its first kind's need)
  live.dealtKinds = null;
  const LC0 = tuning.legendClearing, areaMax = LC0.fit?.areaMax ?? LC0.fit?.max ?? 25;
  if (rosterIsland && grownSet && !zoo && tuning.legends?.areas !== false && live.others.length) {
    const homeKey = cellKey(centreCell[0], centreCell[1]), nearHome = new Set([homeKey, ...(neighbours.get(homeKey) ?? [])]);
    const kindOf = (k: string) => AREA_TYPES[types.get(k) ?? 0]?.creature;
    const byHome = [...live.others].sort((a, b) => Math.hypot(a[0] - centreCell[0], a[1] - centreCell[1]) - Math.hypot(b[0] - centreCell[0], b[1] - centreCell[1]));
    const first = byHome.slice(0, 3).map(([x, y]) => cellKey(x, y));
    const early = tuning.legends?.earlyQuest !== false ? first.filter(k => first.some(o => o !== k && kindOf(o) !== kindOf(k))).map(kindOf) : [];
    live.dealtKinds = dealLegends(rosterIsland, runSeed, new Set(MS.found ?? []), early);
    // The biggest circle (m, up to `want`) wholly in area k round a spot near its middle (16 points on its rim in it).
    const cellAt = (x: number, z: number) => { const [u, v] = toPart(x, z); return partition.partition(u, v); };
    const room = (k: string, want: number) => {
      const [cx, cy] = k.split(",").map(Number), s = siteOf(cx, cy), inside = (x: number, z: number) => { const c = cellAt(x, z); return c[0] === cx && c[1] === cy; };
      const holds = (x: number, z: number, r: number) => { for (let i = 0; i < 16; i++) { const b = (i / 16) * Math.PI * 2; if (!inside(x + Math.cos(b) * r, z + Math.sin(b) * r)) return false; } return true; };
      let best = 0;
      for (let i = -5; i <= 5 && best < want; i++) for (let j = -5; j <= 5 && best < want; j++) {
        const x = s.x + i * A * 0.07, z = s.z + j * A * 0.07;
        if (!inside(x, z) || !holds(x, z, best + 2)) continue;
        let r = best + 2;
        while (r + 2 <= want && holds(x, z, r + 2)) r += 2;
        best = r;
      }
      return best;
    };
    const taken = new Set<string>(), near = (k: string) => [...(neighbours.get(k) ?? [])];
    // (one for every kind a night could deal here, not just tonight's: the island's shape, and so its land, coast and chart
    // outline, is its world's every night; tonight's legends take theirs, the rest stand empty. The early quest's kinds choose
    // first, then the rest in an order seeded by the island's own seed.)
    const pool = [...new Set(shapeKinds ?? rosterIsland.roster.map(r => r.kind))].filter(k => k !== rosterIsland.kind && !isPlaceholder(k)).sort(byPlace); // (home's: its world's kinds as made above; by name, a kind that took another's place in the other's: rules/kinds.ts)
    const order = [...pool.filter(k => early.includes(k)), ...pool.filter(k => !early.includes(k)).sort((a, b) => hash2(pool.indexOf(a), 3, shapeSeed + 6153) - hash2(pool.indexOf(b), 3, shapeSeed + 6153))];
    order.forEach((kind, ki) => {
      const want = legendRadius(kind, LC0, areaMax);
      let best: { k: string; pair: string; room: number; h: number } | null = null;
      for (const [x, y] of live.others) {
        const pair = cellKey(x, y);
        if (kindOf(pair) !== kind) continue;
        for (const k of near(pair)) {
          if (grownSet!.has(k) || lakeCells.has(k) || nearHome.has(k) || taken.has(k) || !growable(k) || near(k).some(o => taken.has(o) || lakeCells.has(o))) continue;
          const r = room(k, want), h = early.includes(kind) ? Math.hypot(x - centreCell[0], y - centreCell[1]) : hash2(x * 31 + y, ki, shapeSeed + 6151);
          // (the roomiest up to its legend's need; among those that hold it, an early kind's nearest home, else seeded)
          if (!best || Math.min(r, want) > Math.min(best.room, want) || (Math.min(r, want) === Math.min(best.room, want) && h < best.h)) best = { k, pair, room: r, h };
        }
      }
      if (!best) return;
      taken.add(best.k);
      slotRoom.set(best.k, best.room);
      legendAreas.set(best.k, best.pair);
      types.set(best.k, types.get(best.pair)!);
    });
    for (const [k, p] of legendAreas) { const [x, y] = p.split(",").map(Number); pairCells.set(k, [x, y]); }
  }
  const isLegendArea = (cx: number, cy: number) => legendAreas.has(cellKey(cx, cy));
  return { ...m, legendAreas, pairCells, slotRoom, LC0, areaMax, isLegendArea };
}
export type MapLegendAreas = ReturnType<typeof legendAreasOf>;
