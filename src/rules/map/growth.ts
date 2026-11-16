// A stage of the forest map's making (rules/map.ts generateMap calls them in order; split from its body: the same sums in the same order).
// The island's areas grown out from home by its shape (and its lakes among them), the special sites' table, and which areas
// are playable.
import { cellKey } from "./helpers";
import { homeEndgame } from "../rosters";
import { type Candidate, lakePlan, type PatchGrowth, growIsland, placeLakes } from "../islandGrowth";
import { STRAIT, patchAt } from "../archipelago";
import type { SpecialSite } from "../map";
import type { Cell } from "../partition";
import type { MapGrid } from "./areaGrid";

/** The island grown: its playable areas, its lakes, and the cells in play. */
export function growAreas(m: MapGrid) {
  const { tuning, A, MS, round, zoo, rosterIsland, shapeSeed, island, shapeK, patch, coast, n, first, centreCell, neighbours, zooCells, siteOf, centre, live } = m;
  // The playable areas and the buffer ring, by their centres' distance from home's.
  // (each by how far its centre lies out along its own direction, as a share of the coast there)
  const fromHome = (cx: number, cy: number) => { const s = siteOf(cx, cy), dx = s.x - centre.x, dz = s.z - centre.z; return Math.hypot(dx, dz) / coast(Math.atan2(dz, dx)); };
  // An area must own some ground: the warped partition can leave a cell with none (every point near its centre another
  // area's), and such a ghost area put its runestone, its legend and its creatures all on one spot in a neighbour's
  // ground (Ed, v1628: "Legend and runestone in the same place"). Ground: any of the neighbour scan's samples, 6 a cell.
  const hasGround = (cx: number, cy: number) => neighbours.has(cellKey(cx, cy));
  // The island's areas (Ed, 2026-10-11): home and `island` more that own ground, grown out from home by its shape
  // (rules/islandGrowth.ts), in the order taken (a grown home's first 10 then the same every night: the growth's order doesn't
  // change with how many it takes); R then the furthest of them (in areas, by cell), for how remote each is.
  // Its lakes (Ed, 2026-10-11: from phase 1, never home): areas of water among its own, grown with it (so it keeps its size
  // in land) and kept off home and its neighbours (rules/islandGrowth.ts placeLakes).
  let grownSet: Set<string> | null = null, growOrder: string[] = [], lakeCells = new Set<string>();
  // (tonight's find in an area of its own, tuning findArea, on an island grown from its areas (the game's: the radius and square
  // maps keep the find as before): the island grown one area more, its last, which takes the find's area's kind each night, below;
  // so the island keeps its playable areas and its roster whichever area holds the find)
  // (none at home till every island on the chart is found, Ed 2026-11-04: "no find at home until endgame"; then its challenge area)
  const findOn = !zoo && !!tuning.findArea?.on && island > 0 && (rosterIsland?.kind !== "home" || homeEndgame(MS.found ?? [], tuning.home.challengeAt)), findExtra = findOn ? 1 : 0;
  // (an area of the grid the island could have grown into, inside its patch: where a legend area may grow, below)
  let growable: (k: string) => boolean = () => false;
  if (island) {
    const cand = new Map<string, Candidate>(), plan = lakePlan(shapeK, shapeSeed), extra = plan.reduce((t, k) => t + k, 0);
    for (let cy = first; cy < first + n; cy++) for (let cx = first; cx < first + n; cx++) if (hasGround(cx, cy)) { const s = siteOf(cx, cy), k = cellKey(cx, cy); cand.set(k, { key: k, dx: (s.x - centre.x) / A, dz: (s.z - centre.z) / A }); }
    // (in its patch: its playable areas kept in from the patch's edge by half a strait, the buffer's depth and most of an area (its
    // ground past its centre), so its land, buffer and all, stops half a strait short of its neighbours'; its reach its own shape)
    let grow: PatchGrowth | undefined;
    if (patch) {
      const inset = STRAIT / 2 + MS.buffer * A * 0.85 + A * 0.75, room = (a: number) => Math.max(A, patchAt(patch, a) - inset) / A;
      let mean = 0;
      for (let k = 0; k < 64; k++) mean += room((k / 64) * Math.PI * 2) / 64;
      grow = { reach: a => room(a) / mean, outside: c => Math.max(0, Math.hypot(c.dx, c.dz) - room(Math.atan2(c.dz, c.dx))) };
    }
    growOrder = growIsland(cellKey(centreCell[0], centreCell[1]), island + findExtra + extra, cand, neighbours, shapeK, shapeSeed, grow, rosterIsland?.turn ?? 0);
    if (extra) { const L = placeLakes(growOrder, island + findExtra, plan, neighbours, shapeSeed); growOrder = L.playable; lakeCells = L.lakes; }
    grownSet = new Set(growOrder);
    growable = k => { const c = cand.get(k); return !!c && (!grow || grow.outside(c) <= 0); };
    live.R = 1;
    for (const k of grownSet) { const [cx, cy] = k.split(",").map(Number); live.R = Math.max(live.R, Math.hypot(cx - centreCell[0], cy - centreCell[1])); }
  }
  // (the zoo: an island not found yet is its biome's lake, Ed 2026-10-26)
  if (zoo) for (const b of zoo.blocks) if (b.found === false) lakeCells.add(cellKey(b.cell[0], b.cell[1]));
  // (the areas with a special site: not playable, chosen once the island's shape is made, below)
  const specials = new Map<string, SpecialSite>();
  const playable = (cx: number, cy: number) => (specials.size === 0 || !specials.has(cellKey(cx, cy))) && cx >= first && cy >= first && cx < first + n && cy < first + n && (zoo ? zooCells.has(cellKey(cx, cy)) : grownSet ? grownSet.has(cellKey(cx, cy)) : !round || fromHome(cx, cy) <= live.R * A) && hasGround(cx, cy);
  const cells: Cell[] = [];
  for (let cy = first; cy < first + n; cy++) for (let cx = first; cx < first + n; cx++) if (playable(cx, cy)) cells.push([cx, cy]);
  const isLake = (cx: number, cy: number) => lakeCells.has(cellKey(cx, cy));
  const inBuffer = (cx: number, cy: number) => round && !playable(cx, cy) && live.landCells.has(cellKey(cx, cy)) && !isLake(cx, cy);
  return { ...m, grownSet, growOrder, lakeCells, findOn, findExtra, growable, specials, playable, cells, isLake, inBuffer };
}
export type MapGrowth = ReturnType<typeof growAreas>;
