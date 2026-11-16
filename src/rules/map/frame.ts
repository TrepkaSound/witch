// A stage of the forest map's making (rules/map.ts generateMap calls them in order; split from its body: the same sums in the same order).
// The map's frame: its shape (circle, square or the zoo), the journey's island by roster and its size, the coast's wobble, the
// grid of cells, the warp that varies the areas' sizes, home's cell and circle, and the partition cut round it.
import { siteRules, treehouseDistance } from "./helpers";
import { zooLayout, zooPartition } from "../zooMap";
import { knownKinds, HOME_START, homeIsland, homeRoster, playableIsland, islandOf, type Island } from "../rosters";
import { ZOO_CONFIG, type ZooPlan, zooChartPlan } from "../zoo";
import { shapeOf, reachOf } from "../islandGrowth";
import { makeCoast } from "../mapShape";
import { vnoise } from "../random";
import { makePartition, type Cell, claimable } from "../partition";
import type { Tuning } from "../tuning";
import type { MapPrep } from "../map";
import type { PathNetwork } from "../paths";

/** The few of the map's makings that later stages change or read before they're made: shared, not copied. */
export interface MapLive {
  /** How far out the playable areas reach (areas): the radius map's, or the grown island's furthest. */
  R: number;
  /** The playable areas but home (and, once the find's area is chosen, but it). */
  others: Cell[];
  /** The night's legends' kinds, dealt with the legend areas and again once the route's known. */
  dealtKinds: string[] | null;
  pieceHome: Map<number, string> | null;
  legendKinds: string[];
  landCells: Set<string>;
  pieceSpotOf: (cx: number, cy: number) => { x: number; z: number } | null;
  clearOfStones: (x: number, z: number, r?: number) => boolean;
  map: { paths: PathNetwork };
}

/** The map's frame: everything later stages build on, from the run's seed and the tuning (and, for islandLand, only the land). */
export function mapFrame(runSeed: number, tuning: Tuning, only?: { landStep: number; island: Island }, prep?: MapPrep) {
  const live = {} as MapLive;
  const A = tuning.areaSize * tuning.areaScale;
  // (the sites' least gaps, siteRules: a stone's clearing, the gap between any two sites' footprints and a site's from a lake's water)
  const { stoneClear, siteGap, lakeGap: siteLake, stoneSpacing } = siteRules(tuning);
  // The circular map (Ed, 2026-10-06): playable areas those whose centres lie within radius areas of
  // home's; past them a buffer ring buffer areas deep, then the edge of her flight (from the
  // playable areas' outer edges, half an area past their centres). The grid of cells covers all of
  // that and the warp's play; the forest goes on edge areas beyond, its last areas never seen.
  const MS = tuning.map ?? { shape: "square" as const, radius: 0, buffer: 0, push: 0, drift: 0, edge: 2 };
  const shape: "circle" | "square" = MS.shape === "circle" ? "circle" : "square", round = shape === "circle";
  // The zoo (rules/zoo.ts; Ed, 2026-10-13): a square grid of square blocks, each a real area of the type its row and column give,
  // home the entrance; no warp and no fractal borders (a straight path runs along every border), every block's legend in its clearing.
  // Laid out like the sea chart (Ed, 2026-10-26; rules/zooMap.ts): every island at its chart place, one area across, the
  // streets (the plaza's flagstones) between; a found island (map.found: the kinds she knows; "*" every one, ?all) its area,
  // one not found its biome's lake.
  const zooAt = MS.shape === "zoo" ? zooLayout(MS.world ?? 0, (MS.found ?? []).includes("*") ? "all" : new Set(knownKinds(MS.found ?? [])), { across: A * (ZOO_CONFIG.size ?? 1), gap: ZOO_CONFIG.gap ?? 30, street: ZOO_CONFIG.street, plaza: ZOO_CONFIG.plaza, margin: ZOO_CONFIG.margin ?? 120, areaSize: A, coasts: MS.coasts }, tuning.islands?.coast ?? MS.coast) : null;
  const zoo: ZooPlan | null = zooAt ? zooChartPlan(zooAt) : null;
  // The journey's islands by roster (Ed, 2026-10-11; rules/rosters.ts): map.island a kind plays that kind's island, its shape and
  // areas from its own seed (where it lies on the sea chart) and its size by phase; "home" plays home's (one area per kind she
  // knows, on the run's seed). The run's seed deals the night's legends.
  // The world seed (Ed, 2026-10-11; rules/rosters.ts): an island's shape (its coast, the partition into areas, their types) is
  // its own, from the campaign's world (map.world) and its kind, the same every night (shapeSeed); everything inside it (paths,
  // scenery, set pieces, creatures, the night's legends; map.seed) is the night's, the run's seed.
  const world = MS.world ?? 0;
  // Home (Ed, 2026-11-04: "home has 5 areas chosen at random from the phase 1 creatures, and grows as you unlock islands"; rules/
  // rosters.ts homeRoster): one area per island found (map.found, the save's), at least home.start, filled each night with home's
  // starting kinds whose islands are unfound, chosen by the night's seed; its legends as any island's (rules/rosters.ts dealLegends).
  // islandAreas turns it on.
  const homeStart = Math.max(1, Math.round(tuning.home.start ?? HOME_START));
  const rosterIsland = only ? only.island : !round || zoo ? null : MS.island === "home" ? ((MS.islandAreas ?? 0) > 0 ? homeIsland(world, homeRoster(MS.found ?? [], runSeed, homeStart)) : null) : MS.island && playableIsland(MS.island) ? islandOf(MS.island, world, tuning.islands?.phaseSizes, MS.rosterNeighbourhood) : null; // (never a placeholder's: rules/rosters.ts; its size its phase's, islands.phaseSizes)
  const seed = runSeed, shapeSeed = rosterIsland ? rosterIsland.seed : runSeed;
  // An island of so many areas (Ed, 2026-10-11, the journey's first step: map.islandAreas): home and exactly that many more, the
  // nearest home's (found below, once the areas are cut); until then a radius sure to hold them sizes the grid and the forest.
  const island = rosterIsland ? rosterIsland.size : round && (MS.islandAreas ?? 0) > 0 ? Math.round(MS.islandAreas!) : 0;
  // Its shape by its phase (Ed, 2026-10-11, the journey's irregular islands: rules/islandGrowth.ts, the tuning's map.shapes): home
  // near-round, each phase further out more irregular; the grid sized for its furthest arm.
  const phase = rosterIsland ? rosterIsland.phase : Math.max(0, Math.round(MS.phase ?? 0)), shapeK = shapeOf(phase, MS.shapes), shapeReach = island ? reachOf(shapeK, shapeSeed, rosterIsland?.turn ?? 0) : null;
  // (in its patch on the chart, rules/archipelago.ts: the grid sized for the patch's furthest reach)
  const patch = rosterIsland?.patch, patchMost = patch ? Math.max(...patch) : 0;
  const reach = (areas: number) => (patch ? patchMost / (tuning.areaSize * tuning.areaScale) + 1 : (Math.sqrt((areas + 1) / Math.PI) * 1.4 + 1.5) * (shapeReach?.most ?? 1));
  live.R = island ? reach(island) : MS.radius; let flightR = (live.R + 0.5 + MS.buffer) * A;
  const edgeK = MS.edge ?? 2;
  // The coast's wobble (Ed, 2026-10-06): seeded, the same for every edge; the forest's extent covers its furthest headland.
  // (The grid doesn't change with it, so the coast's knobs never reshuffle the map: its slack of an area holds the
  // playable areas' furthest headland, and the buffer's past it are the forest's anyway.)
  // (a kind's island takes the islands' coast, as its outline on the sea chart and in the dreams: rules/islandShape.ts)
  const coastKnobs = rosterIsland && rosterIsland.kind !== "home" ? tuning.islands?.coast ?? MS.coast : MS.coast;
  const coast = round ? makeCoast(shapeSeed, coastKnobs) : () => 1, most = 1 + (round ? Math.max(0, coastKnobs?.amp ?? 0) : 0);
  const across = (r: number) => 2 * Math.ceil(r + 0.5 + MS.buffer + 1) + 1;
  const n = zoo ? zoo.n : round ? across(live.R) : tuning.mapAreas, margin = round ? Math.ceil(edgeK) : 2;
  // Home grown (more islands found than its start, home.start): its grid's middle stays where the starting home's is, so the
  // partition, home's cell and its first areas are the same every night of the campaign; the grid reaches further round it (from
  // cell `first`).
  const homeBase = rosterIsland?.kind === "home" ? homeStart : 0, grown = homeBase > 0 && island > homeBase;
  // Areas vary in size: the world is warped smoothly before it is cut, so in some stretches of
  // the map the cells spread out (big areas) and in others they crowd (small ones). The warp
  // never folds (its slope stays under 1), so every area keeps its place and the map stays
  // n x n areas. Positions in partition space are in cells.
  const L = 3, V = zoo ? 0 : Math.max(0, Math.min(1, tuning.areaSizeVariance)) * L * 0.3;
  const toPart = (x: number, z: number): [number, number] => {
    const u = x / A, v = z / A;
    return [u + V * (vnoise(u / L, v / L, shapeSeed + 91) - 0.5) * 2, v + V * (vnoise(u / L, v / L, shapeSeed + 92) - 0.5) * 2];
  };
  const toWorld = (u: number, v: number): [number, number] => {
    let x = u * A, z = v * A;
    // (toPart inline, its pair in locals: 30 rounds made 30 tuples a call, a frame's commonest garbage; phase 2's GC
    // audit. The same sums in the same order.)
    for (let i = 0; i < 30; i++) {
      const uu = x / A, vv = z / A;
      const pu = uu + V * (vnoise(uu / L, vv / L, shapeSeed + 91) - 0.5) * 2, pv = vv + V * (vnoise(uu / L, vv / L, shapeSeed + 92) - 0.5) * 2;
      x += (u - pu) * A; z += (v - pv) * A;
    }
    return [x, z];
  };
  // Home first (Ed, 2026-10-05: "Home area should be big enough that the whole circle, centre the
  // dancefloor, edge the treehouse, is within it - should fix this before generating the rest of
  // the areas"). Its cell: the one nearest the middle whose centre lies inside its own area, so the
  // dancefloor stands on its own area's ground. Then its circle: out past the treehouse's footprint
  // and home.margin more, measured through the warp (its edge mapped into partition space), so
  // every point of it is home's; the areas round it are cut round it, their centres kept
  // home.gap of an area beyond it.
  const mid = Math.floor((grown ? across(reach(homeBase)) : n) / 2), first = mid - Math.floor(n / 2), depth = zoo ? 0 : tuning.borderLayers, siteMargin = zoo ? 0 : tuning.siteMargin ?? 0, plain = zooAt ? zooPartition(zooAt, A, shapeSeed) : makePartition(shapeSeed, depth, undefined, { grid: !!zoo, margin: siteMargin });
  const ownsSite = (cx: number, cy: number) => { const s = plain.site(cx, cy), c = plain.partition(s[0], s[1]); return c[0] === cx && c[1] === cy; };
  let centreCell: Cell = zoo ? zoo.home : [mid, mid];
  if (!zoo) for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) if (ownsSite(mid + dx, mid + dy)) { centreCell = [mid + dx, mid + dy]; break; }
  const H = tuning.home, homeSite = plain.site(centreCell[0], centreCell[1]), homeWorld = toWorld(homeSite[0], homeSite[1]);
  const homeRadius = treehouseDistance(tuning) + tuning.treehouse.clear + H.margin; // metres
  let homeR = 0;
  for (let k = 0; k < 96; k++) {
    const a = (k / 96) * Math.PI * 2, [u, v] = toPart(homeWorld[0] + Math.cos(a) * homeRadius, homeWorld[1] + Math.sin(a) * homeRadius);
    homeR = Math.max(homeR, Math.hypot(u - homeSite[0], v - homeSite[1]));
  }
  const basePartition = zooAt ? plain : makePartition(shapeSeed, depth, { cell: centreCell, radius: homeR * 1.03, gap: H.gap }, { grid: !!zoo, margin: siteMargin });
  // (and room for the challenge area's claim on its circle, set once it's chosen, below: until then the partition as cut)
  const partition = claimable(basePartition);
  return { runSeed, tuning, only, prep, live, A, stoneClear, siteGap, siteLake, stoneSpacing, MS, shape, round, zooAt, zoo, world, homeStart, rosterIsland, seed, shapeSeed, island, shapeK, patch, flightR, edgeK, coast, most, n, margin, homeBase, L, V, toPart, toWorld, first, centreCell, homeWorld, homeRadius, basePartition, partition };
}
export type MapFrame = ReturnType<typeof mapFrame>;
