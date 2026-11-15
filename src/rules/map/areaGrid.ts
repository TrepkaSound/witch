// A stage of the forest map's making (rules/map.ts generateMap calls them in order; split from its body: the same sums in the same order).
// Which areas touch which (or the prep's), each area's type (never a neighbour's), the zoo's blocks, and each area's centre.
import { findNeighbours, cellKey } from "./helpers";
import { rng, hash2 } from "../random";
import { CLASSIC_TYPES, AREA_TYPES } from "./areaTypes";
import { areaIdOf } from "../../../art/areaRenames.js";
import type { MapFrame } from "./frame";

/** The grid of areas: their neighbours, their types and their centres. */
export function areaGrid(m: MapFrame) {
  const { prep, A, round, zoo, shapeSeed, flightR, edgeK, most, n, margin, toWorld, centreCell, homeWorld, partition } = m;
  // (circular: the extent a square round the flight circle, edge areas past it; the cells it covers, and one more for the warp)
  const ext = round ? { minX: homeWorld[0] - flightR * most - edgeK * A, maxX: homeWorld[0] + flightR * most + edgeK * A, minZ: homeWorld[1] - flightR * most - edgeK * A, maxZ: homeWorld[1] + flightR * most + edgeK * A } : null;
  const lo = ext ? Math.floor(Math.min(ext.minX, ext.minZ) / A) - 1 : -margin, hi = ext ? Math.ceil(Math.max(ext.maxX, ext.maxZ) / A) + 1 : n + margin;
  const neighbours = prep ? new Map(prep.neighbours.map(([k, v]) => [k, new Set(v)])) : findNeighbours(partition, lo, hi, 6);

  // Area types: random, never the same as a touching area nor any area within two cells.
  const types = new Map<string, number>();
  const r = rng(shapeSeed * 5 + 1);
  for (let cy = lo; cy < hi; cy++) for (let cx = lo; cx < hi; cx++) {
    const near = new Set<number>(), homeKey = cellKey(centreCell[0], centreCell[1]);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (cellKey(cx + dx, cy + dy) === homeKey) continue; // (home looks like none of them: a meadow of its own)
      const t = types.get(cellKey(cx + dx, cy + dy));
      if (t !== undefined) near.add(t);
    }
    for (const k of neighbours.get(cellKey(cx, cy)) ?? []) { if (k === homeKey) continue; const t = types.get(k); if (t !== undefined) near.add(t); }
    const free = CLASSIC_TYPES.filter(t => !near.has(t));
    const pool = free.length ? free : CLASSIC_TYPES;
    types.set(cellKey(cx, cy), pool[Math.floor(r() * pool.length)]);
  }
  // (the zoo's blocks: each its own area's type; an empty "?" block its row's first area's ground, so the row reads as one biome)
  const zooCells = new Set<string>();
  if (zoo) {
    const byId = (id: string) => AREA_TYPES.findIndex(a => a.id === areaIdOf(id)), first = new Map<string, number>(); // (an old id, renamed since, still finds its area: art/areaRenames.js)
    for (const b of zoo.blocks) if (b.area && !first.has(b.row)) first.set(b.row, byId(b.area));
    for (const b of zoo.blocks) { const t = b.area ? byId(b.area) : first.get(b.row) ?? -1; if (t >= 0) types.set(cellKey(b.cell[0], b.cell[1]), t); if (b.area && t >= 0 && b.found !== false) zooCells.add(cellKey(b.cell[0], b.cell[1])); }
    zooCells.add(cellKey(centreCell[0], centreCell[1]));
  }
  const typeOf = (cx: number, cy: number) => types.get(cellKey(cx, cy)) ?? CLASSIC_TYPES[Math.floor(hash2(cx, cy, shapeSeed + 17) * CLASSIC_TYPES.length)];

  // (an area's centre never moves: each is worked out once, then read from SITES; a fresh object each time, as before)
  const SITES = new Map<number, [number, number]>();
  const siteXZ = (cx: number, cy: number): readonly [number, number] => {
    const k = (cx + 32768) * 65536 + (cy + 32768);
    let w = SITES.get(k);
    if (!w) { const s = partition.site(cx, cy); w = toWorld(s[0], s[1]); SITES.set(k, w); }
    return w;
  };
  const siteOf = (cx: number, cy: number) => { const w = siteXZ(cx, cy); return { x: w[0], z: w[1] }; };
  const centre = siteOf(centreCell[0], centreCell[1]);
  return { ...m, ext, lo, hi, neighbours, types, zooCells, typeOf, siteXZ, siteOf, centre };
}
export type MapGrid = ReturnType<typeof areaGrid>;
