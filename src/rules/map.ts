// The forest map: areas cut by the fractal partition, each given an area type that no neighbour
// shares; the playable ones a circle of them round home (Ed, 2026-10-06; or, ?shape=square, the
// old mapAreas x mapAreas square), then a buffer ring of forest she can fly over but where nothing
// happens, then a margin of areas past it so the forest never visibly ends. World units are metres: x runs east, z runs south, one area cell is areaSize.
// It's made in stages (rules/map/: frame, areaGrid, growth, roster, legendAreas, land, specials, sampling, sites, reserve,
// assemble, scenery, legends, clearings, clearingGrowth), generateMap calling them in order.
import type { Cell, Partition } from "./partition";
import type { Tuning } from "./tuning";
import type { PathNetwork } from "./paths";
import { knownPathGeometry, rememberPathGeometry, pathGeometryProblem, type PathGeometry } from "./pathGeometry";
import { knownHeightPrep, rememberHeightPrep, heightPrepProblem, type HeightPrep } from "./heightSamples";
import type { Bounds } from "./mapShape";
import type { LandData, LandMap } from "./land";
import { knownRoute, type LeyRoute } from "./leyroute";
import type { Island } from "./rosters";
import type { ZooPlan } from "./zoo";
import type { Speaker } from "./speakers";
import { BASE_NEIGHBOURS } from "./map/helpers";
import { mapFrame } from "./map/frame";
import { areaGrid } from "./map/areaGrid";
import { growAreas } from "./map/growth";
import { rosterTypes } from "./map/roster";
import { legendAreasOf } from "./map/legendAreas";
import { landAndCoast } from "./map/land";
import { specialSites } from "./map/specials";
import { areaSampling } from "./map/sampling";
import { siteSpots } from "./map/sites";
import { reservations } from "./map/reserve";
import { assembleMap } from "./map/assemble";
import { groundsAndScenes } from "./map/scenery";
import { nightLegends } from "./map/legends";
import { legendClearings } from "./map/clearings";
import { growClearings } from "./map/clearingGrowth";

export { AREA_TYPES, HOME_LOOK, HOME_SEED, lookSeed, CLASSIC_TYPES, LOOKS, type AreaType, type AreaLayout } from "./map/areaTypes";
export { treehouseDistance, siteRules, stumpClearance, sceneFootprint, chooseLegendCells } from "./map/helpers";

export interface AreaSample {
  cell: Cell;
  type: number;
  /** How its ground looks (LOOKS): its type, or HOME_LOOK in home's area. */
  look: number;
  /** 0 at the nearest area centre, about 1 midway between centres: what clears the trees. */
  openness: number;
}

export interface ForestMap {
  readonly seed: number;
  readonly tuning: Tuning;
  /** Areas across the grid of cells: the playable square's (square map), or the whole flight circle's and a little more (circular). */
  readonly n: number;
  /** The grid's first cell (its cells run first to first + n - 1 each way): 0, but below on a home grown past its 10 areas (its
   *  middle kept where the 10-area home's is). */
  readonly first: number;
  /** Extra rings of areas outside the grid. */
  readonly margin: number;
  /** The zoo's plan (?zoo, rules/zoo.ts), its paths' crossings in metres; undefined on any other map. */
  readonly zoo?: ZooPlan & { junctions: { x: number; z: number }[] };
  /** The map's shape: "circle" (Ed, 2026-10-06) or "square" (as before, ?shape=square). */
  readonly shape: "circle" | "square";
  /** Every playable area (home among them), row by row: those that get a runestone, a soundsystem, a legend and creatures, and wake in waves. */
  readonly cells: readonly Cell[];
  /** Is this area playable? (The circular map: its centre within map.radius areas of home's.) */
  playable(cx: number, cy: number): boolean;
  /** Is this area in the buffer ring: not playable, but where she can fly (scenery only)? */
  inBuffer(cx: number, cy: number): boolean;
  /** Is this area a lake (Ed, 2026-10-11: from phase 1, never home)? Neither playable nor the buffer's: water (bounds.lakes). */
  isLake(cx: number, cy: number): boolean;
  /** The coast (Ed, 2026-10-06: "slightly irregular"): every edge round home, at an angle (radians,
   *  atan2(dz, dx) from the dancefloor), as a factor of its round radius (1 on the square map). The
   *  playable areas reach radius x coast, the buffer theirs x coast; her flight's edge is the coast round them (bounds.land). */
  coast(angle: number): number;
  readonly areaSize: number;
  readonly partition: Partition;
  /** The middle area, whose clearing holds the dancefloor. */
  readonly centreCell: Cell;
  /** Home's circle (metres round the dancefloor), all home's ground: out past the treehouse. */
  readonly homeRadius: number;
  readonly dancefloor: { x: number; z: number; radius: number; /** the ring of speakers round it */ speakers: readonly Speaker[] };
  /** The witch's treehouse: its trunk's foot, just beyond the dancefloor's clearing. */
  readonly treehouse: { x: number; z: number };
  /** The treehouse's front (Ed, 2026-10-05): treehouse.clear metres from its foot towards the dancefloor (frontOf; due south, towards the camera, while it stood due north). */
  readonly treehouseFront: { x: number; z: number };
  /** The old playgrounds and sports grounds: a handful per map, each in a clearing of its own off
   *  an area's centre; kind is the art's arrangement (playground, tennis, baseball, football, basketball). */
  readonly grounds: readonly Ground[];
  /** The scenes: each at most once per map, in an area it suits (Ed, 2026-10-04). */
  readonly scenes: readonly Scene[];
  /** Where the witch starts: at the treehouse (sitting on its terrace). */
  readonly start: { x: number; z: number };
  /** Where the witch may fly (metres): a box, and on the circular map the circle round home (see mapShape.ts). */
  readonly bounds: Bounds;
  /** Everything the map covers, margin included (metres). */
  readonly extent: { minX: number; maxX: number; minZ: number; maxZ: number };
  /** The area type index of an area cell. */
  typeOf(cx: number, cy: number): number;
  /** Which area a point is in, its type, and how open it is (0 at an area's centre). */
  areaAt(x: number, z: number): AreaSample;
  /** Which area a point is in (cheaper than areaAt), and how far in metres it can move in any
   *  direction and surely stay in that area, so a walker need not ask again until it has. */
  cellSafe(x: number, z: number): { cell: Cell; safe: number };
  /** The area's set piece, if this one has one (setPieceChance of the types that have one: 0, none, since Ed, 2026-10-29). */
  setPieceOf(cx: number, cy: number): string | null;
  /** Where an area's soundsystem stands when the party reaches it (reserved from the start). */
  soundsystemSpot(cx: number, cy: number): { x: number; z: number };
  /** Where an area's set piece stands: in its clearing, its footprint clear of every soundsystem
   *  and the dancefloor; null if it has none, or there is no room for it. */
  setPieceSpot(cx: number, cy: number): { x: number; z: number } | null;
  /** Whether a footprint r metres round (x, z) comes within reserveMargin of anything placed for
   *  gameplay (soundsystems, the dancefloor, the treehouse) or of a set piece: scenery keeps out. */
  reserved(x: number, z: number, r: number): boolean;
  /** How far (x, z) is from the nearest area's stone (its great stump or runestone: its soundsystem's spot), metres. */
  stoneGap(x: number, z: number): number;
  /** Whether a footprint r metres round (x, z) lies wholly out of every stone's keep-clear zone (stoneKeepClear metres round its
   *  middle; Ed, 2026-10-29): the special scenery, finds, flasks, legends' clearings, walls, ponds, campfires, picnics and grounds keep out. */
  clearOfStones(x: number, z: number, r?: number): boolean;
  /** How far an area is from home: 0 at the middle area, 1 at the playable map's edge. */
  remoteness(cx: number, cy: number): number;
  /** An area's centre (its layer-0 site), in metres. */
  siteOf(cx: number, cy: number): { x: number; z: number };
  /** The chance a tree grows at a point: 0 in a clearing, rising smoothly to treeDensity. `under`: as if the challenge circle weren't
   *  there (its hidden forest, challengeVeil: the woods round it carried on over its floor). */
  treeWeight(x: number, z: number, under?: boolean): number;
  /** Ground that must stay clear of every tree: the dancefloor's clearing and set pieces'. `under`: as if the challenge circle weren't there. */
  hardClear(x: number, z: number, under?: boolean): boolean;
  /** The challenge circle's clearing while it's hidden (Ed, 2026-11-12; challenge.hide, rules/challenge.ts): where the forest grows
   *  trees and bushes of its own over it (rules/forest.ts Plant.veil), drawn only while it's hidden; null with none or the hiding off. */
  challengeVeil?: { x: number; z: number; r: number } | null;
  /** How far (x, z) is out of its area's fighting arena: 0 in its open middle, rising smoothly over its band to 1 (tuning arena); `cell` if known. */
  arenaOpen(x: number, z: number, cell?: Cell): number;
  /** Whether an area has a sleeping legend (Ed, 2026-10-06: "only in about half of areas"; a fifth since 2026-10-08): legends.share of them, seeded, spread out; never home. */
  hasLegend(cx: number, cy: number): boolean;
  /** The areas with a legend, as "cx,cy" keys. */
  readonly legendCells: ReadonlySet<string>;
  /** The island this map is, when it's one by roster (rules/rosters.ts: a kind's, or home's), else null. */
  readonly island: Island | null;
  /** On an island by roster, the night's legends' kinds (dealt from its roster: one area of each has its legend); else empty. */
  legendKinds: string[];
  /** Each area's sleeping legend's clearing (not home's: it has no legend), or null where none fits. */
  legendClearing(cx: number, cy: number): LegendClearing | null;
  /** Every legend's clearing (for the drawing: its ground ring, and the rendering's twilight and motes). */
  readonly legendClearings: readonly LegendClearing[];
  /** The legend areas (Ed, 2026-10-26): each "cx,cy" key to its pair's, the area of its kind it was grown beside. In the buffer
   *  (inBuffer: no runestone, soundsystem, arena or creatures of its own), its legend's circle at its heart; the legend's own cell
   *  is its pair's, and its pair's legendClearing is the circle there. */
  readonly legendAreas: ReadonlyMap<string, string>;
  isLegendArea(cx: number, cy: number): boolean;
  /** The area a cell counts as (Ed, 2026-10-26: "for legends getting enraged, and also for animals attacking and defending, the
   *  adjacent areas should count as one"): a legend area's pair, else the cell itself (the same array: no allocation). */
  areaOf(cell: Cell): Cell;
  /** Whether two cells count as one area (the same cell, or a legend area and its pair). */
  sameArea(a: Cell, b: Cell): boolean;
  /** Pairs of areas that touch, as "cx,cy|cx,cy" keys, for tests and the debug view. */
  readonly neighbours: ReadonlyMap<string, ReadonlySet<string>>;
  /** Paths, roads and railways, with the corridors they keep clear. */
  readonly paths: PathNetwork;
  /** The areas with a special site where a stone would stand (Ed, 2026-11-03: "Each non-lake area has a stump site or a special
   *  site (find and challenge areas)"): tonight's find's area (tuning findArea), with no stone, wave or creatures of its own (not
   *  playable: like a legend area), the find at its site; with the tuning's challenge on, the challenge circle's (rules/challenge.ts). */
  readonly specialSites: readonly SpecialSite[];
  /** An area's special site, or null (a stone's area, home, the buffer's, a lake). */
  special(cx: number, cy: number): SpecialSite | null;
}

/** A special site (map.specialSites): what's there (the night's find, or the challenge circle), its area, the spot (its site, on
 *  its own ground and off the rails and streams) and the clearing kept round it (m: no trees, bushes or scenery; paths end at its edge). */
export interface SpecialSite {
  kind: "find" | "challenge"; cell: Cell; x: number; z: number; r: number;
  /** The challenge's: its stone circle's radius (m: rules/challengeCircle.ts, by the island's roster; r is that and its margin), and
   *  whether its area claims the whole circle as its own ground (rules/partition.ts claimable; false: no area could, logged). */
  radius?: number; claimed?: boolean;
}


/** flip: the whole arrangement mirrored left to right. */
export interface Ground { kind: string; x: number; z: number; r: number; flip: boolean }
/** A scene (art/scenes.js) on the map: its id, middle, footprint radius, and whether it's mirrored. */
export interface Scene { id: string; x: number; z: number; r: number; mirror: boolean }
/** An area's sleeping legend's clearing (Ed, 2026-10-06): a small circle (x, z, radius r metres) where
 *  nothing grows or stands, the legend lying near its far (north) side at legend; edge: its ring's width. */
export interface LegendClearing { cell: Cell; x: number; z: number; r: number; edge: number; legend: { x: number; z: number } }

/** A seed from the URL: a number is used as is, any other text is hashed. */
export function parseSeed(text: string | null | undefined): number | null {
  if (text == null || text.trim() === "") return null;
  const t = text.trim();
  if (/^\d{1,9}$/.test(t)) return Number(t);
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619);
  return (h >>> 0) % 1000000000;
}

/** Only an island's land (rules/islandShape.ts: the sea chart's and the dreams' outlines): its land map, sampled every `step`
 *  metres, and home's middle; the areas grown as the map grows them, nothing else made. `island` the island (rules/rosters.ts). */
export function islandLand(island: Island, tuning: Tuning, step = 16): { land: LandMap; lakes?: LandMap; home: { x: number; z: number }; areaSize: number; cells: string[] } {
  return generateMap(island.seed, tuning, { landStep: step, island }) as unknown as { land: LandMap; lakes?: LandMap; home: { x: number; z: number }; areaSize: number; cells: string[] };
}

/** The heavy, pure parts of a map's making as plain data (Ed, 2026-10-19, the sailing's option 4: app/mapPrep.ts makes them in a
 *  worker while the chart flies and carries them to the game's page): which areas touch which (in their order: the map's own
 *  iteration order), the land and lakes maps, and the ley line's route (rules/leyroute.ts). generateMap given them makes the same map, without their work. */
export interface MapPrep { neighbours: [string, string[]][]; land: LandData | null; lakes: LandData | null; route: LeyRoute | null; pathGeometry?: PathGeometry; heightSamples?: HeightPrep }

const landData = (L: LandMap | undefined): LandData | null => (L ? { x0: L.x0, z0: L.z0, step: L.step, cols: L.cols, rows: L.rows, dist: L.dist, seg: L.seg, loops: L.loops, segLoop: L.segLoop, segAt: L.segAt, box: L.box } : null);
/** A map's prep (see MapPrep): to make the same map again quickly, on another thread or page. */
export function prepOf(map: ForestMap): MapPrep {
  const b = map.bounds;
  return { neighbours: BASE_NEIGHBOURS.get(map.neighbours) ?? [...map.neighbours].map(([k, v]) => [k, [...v]]), land: landData(b.land), lakes: landData(b.lakes), route: knownRoute(map) ?? null, ...(knownPathGeometry(map) ? { pathGeometry: knownPathGeometry(map) } : {}), ...(knownHeightPrep(map) ? { heightSamples: knownHeightPrep(map) } : {}) };
}

/** What's wrong with a prep, if anything (a record from another build's code, cut short, or not a prep at all): its shapes checked
 *  against each other, so a bad one is never hydrated (app/mapPrep.ts readyMap makes the map afresh instead). Null if sound. */
export function prepProblem(p: unknown): string | null {
  const q = p as Partial<MapPrep> | null;
  if (!q || typeof q !== "object") return "no prep";
  if (!Array.isArray(q.neighbours) || !q.neighbours.every(e => Array.isArray(e) && typeof e[0] === "string" && Array.isArray(e[1]))) return "neighbours";
  const land = (L: LandData | null | undefined, what: string): string | null => {
    if (L == null) return null;
    const n = L.cols * L.rows;
    if (!(Number.isInteger(L.cols) && Number.isInteger(L.rows) && n > 0 && L.step > 0)) return what + " grid";
    if (!(L.dist instanceof Float32Array && L.dist.length === n && L.seg instanceof Int32Array && L.seg.length === n)) return what + " samples";
    if (!(L.segLoop instanceof Int32Array && L.segAt instanceof Int32Array && L.segLoop.length === L.segAt.length && Array.isArray(L.loops))) return what + " stretches";
    if (!L.loops.every(l => l.pts instanceof Float64Array && l.at instanceof Float64Array && l.pts.length === l.at.length * 2)) return what + " loops";
    for (let s = 0; s < L.segLoop.length; s++) { const l = L.loops[L.segLoop[s]]; if (!l || L.segAt[s] < 0 || L.segAt[s] * 2 >= l.pts.length) return what + " stretch " + s; }
    return null;
  };
  if (q.land === undefined || q.lakes === undefined || q.route === undefined) return "parts missing";
  const bad = land(q.land, "land") ?? land(q.lakes, "lakes");
  if (bad) return bad;
  if (q.pathGeometry !== undefined) { const bad = pathGeometryProblem(q.pathGeometry); if (bad) return bad; }
  if (q.heightSamples !== undefined) { const bad = heightPrepProblem(q.heightSamples); if (bad) return bad; }
  if (q.route && !(Array.isArray(q.route.order) && Array.isArray(q.route.stones) && Array.isArray(q.route.links) && q.route.order.length === q.route.stones.length)) return "route";
  return null;
}

/** A map from its ready parts (a worker's prep: app/mapPrep.ts): the map generateMap(seed, tuning) makes, without their work
 *  (src/rules/mapPrep.test.ts). The seam a night started in place takes (docs/plans/sail-without-reload.md, startNight; or
 *  newGame's prep). */
export const hydrateMap = (seed: number, tuning: Tuning, prep: MapPrep): ForestMap => {
  const map = generateMap(seed, tuning, undefined, prep);
  if (prep.pathGeometry && !pathGeometryProblem(prep.pathGeometry)) rememberPathGeometry(map, prep.pathGeometry);
  if (prep.heightSamples && !heightPrepProblem(prep.heightSamples)) rememberHeightPrep(map, prep.heightSamples);
  return map;
};

/** The forest map for a run's seed and the tuning (`only`: islandLand's land alone; `prep`: a worker's ready parts, MapPrep), made
 *  in stages (rules/map/), each building on the last. */
export function generateMap(runSeed: number, tuning: Tuning, only?: { landStep: number; island: Island }, prep?: MapPrep): ForestMap {
  const frame = mapFrame(runSeed, tuning, only, prep); // its shape and size, the warp, home's cell, the partition
  const grid = areaGrid(frame); // which areas touch which, their types, their centres
  const grown = growAreas(grid); // the island grown from home, its lakes, the playable areas
  const typed = legendAreasOf(rosterTypes(grown)); // its kinds by roster; the legend areas grown beside their kinds'
  const land = landAndCoast(typed); // the land, the coast and the lakes
  if (land.early) return land.early; // (islandLand: the land alone)
  const sampled = areaSampling(specialSites(land)); // the find's and challenge's areas; the area at a point, set pieces
  const reserved = reservations(siteSpots(sampled)); // the sites' spots; what's kept clear, hard ground, the trees' weight
  const map = assembleMap(reserved); // the map object, its paths, the night's deal, the path network
  return growClearings(legendClearings(nightLegends(groundsAndScenes(map)))); // grounds and scenes, the night's legends, their clearings
}


/** Whether (x, z) is inside the legend's clearing of the area at cell (Ed, 2026-10-06: "Quest sigils and relics
 *  need to be placed in the circle to have their effect"; relics no more: Ed, 2026-10-18); where an area has no clearing (no room for one),
 *  within fallback metres of its legend at legendAt. */
export function inLegendClearing(map: ForestMap, cell: Cell, x: number, z: number, legendAt: { x: number; z: number }, fallback: number): boolean {
  const c = map.legendClearing(cell[0], cell[1]);
  return c ? Math.hypot(x - c.x, z - c.z) <= c.r : Math.hypot(x - legendAt.x, z - legendAt.z) <= fallback;
}

/** The legends' clearings nearest (x, z), up to out's length or 6, nearest first, into out (reused, so no
 *  garbage a frame); only those within 400 m. For the drawing (the ground's rings, the twilight) and the rules. */
export function nearestClearings(all: readonly LegendClearing[], x: number, z: number, out: LegendClearing[], max = 6): LegendClearing[] {
  out.length = 0;
  for (const c of all) {
    const d = Math.hypot(c.x - x, c.z - z);
    if (d > 400) continue;
    let i = out.length;
    while (i > 0 && Math.hypot(out[i - 1].x - x, out[i - 1].z - z) > d) i--;
    if (i < max) { out.splice(i, 0, c); if (out.length > max) out.length = max; }
  }
  return out;
}

/** The area a point counts as in (map.areaOf: a legend area as its pair; Ed, 2026-10-26: "the adjacent areas should count as
 *  one"), its cell; a map without legend areas (or a test's stand-in) its own cell. */
export function areaCellAt(map: Pick<ForestMap, "cellSafe"> & Partial<Pick<ForestMap, "areaOf">>, x: number, z: number): Cell {
  const c = map.cellSafe(x, z).cell;
  return map.areaOf ? map.areaOf(c) : c;
}
