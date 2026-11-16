// A stage of the forest map's making (rules/map.ts generateMap calls them in order; split from its body: the same sums in the same order).
// The map object itself (its data and its closures), its path network, the night's deal of legends onto its areas along
// the route, and the path network laid once the sites are placed.
import { speakerRing } from "../speakers";
import { frontOf, cellKey } from "./helpers";
import { ZOO_CONFIG, zooJunctions } from "../zoo";
import { seatOffset } from "../treehouse";
import type { LegendClearing, ForestMap } from "../map";
import { PathNetwork } from "../paths";
import { rememberRoute } from "../leyroute";
import { routeOf } from "../party";
import type { Cell } from "../partition";
import { AREA_TYPES } from "./areaTypes";
import { dealLegends } from "../rosters";
import { legendRadius } from "../legendFit";
import { matchLegendAreas, pairLegendAreas, dealAlongRoute } from "../deal";
import type { MapReserve } from "./reserve";

/** The map assembled: its object, its paths, the night's deal. */
export function assembleMap(m: MapReserve) {
  const { runSeed, tuning, prep, A, stoneClear, MS, shape, zooAt, zoo, rosterIsland, seed, edgeK, coast, n, margin, first, centreCell, homeRadius, partition, ext, lo, hi, neighbours, types, typeOf, siteOf, centre, specials, playable, cells, isLake, inBuffer, typeBeyond, legendAreas, pairCells, slotRoom, LC0, areaMax, isLegendArea, cellSafe, land, challengeAt, themeSpecials, areaAt, setPieceOf, floorR, floorClear, placeSites, soundsystemSpot, TH, treehouse, pieceSpots, setPieceSpot, legendCells, grounds, scenes, clearings, reserved, stoneGap, clearOfStones, bounds, hardClear, arenaOpen, treeWeight, remoteness, areaOf, sameArea, live } = m;
  const map = {
    seed, tuning, n, first, margin, shape, cells, playable, inBuffer, isLake, coast, areaSize: A, partition, centreCell, homeRadius,
    dancefloor: { x: centre.x, z: centre.z, radius: floorR, speakers: speakerRing(centre, tuning) },
    treehouse, treehouseFront: frontOf(treehouse, centre, tuning.treehouse.clear), grounds, scenes,
    start: zooAt ? { x: zooAt.home.x, z: zooAt.home.z + (ZOO_CONFIG.plaza ?? 60) * 0.3 } : { x: treehouse.x + seatOffset(tuning).x, z: treehouse.z + seatOffset(tuning).z }, // (the zoo: on the Ent's plaza, no treehouse) // (her decks: on the Terrace's open rim, or the deck: rules/treehouse.ts)
    bounds,
    extent: ext ? (land ? { minX: Math.min(ext.minX, land.box.minX - edgeK * A), maxX: Math.max(ext.maxX, land.box.maxX + edgeK * A), minZ: Math.min(ext.minZ, land.box.minZ - edgeK * A), maxZ: Math.max(ext.maxZ, land.box.maxZ + edgeK * A) } : ext) : { minX: lo * A, maxX: hi * A, minZ: lo * A, maxZ: hi * A }, // (the forest past the coast all round)
    typeOf, areaAt, cellSafe, siteOf, treeWeight, arenaOpen, hardClear, neighbours, setPieceOf, soundsystemSpot, setPieceSpot, reserved, stoneGap, clearOfStones, remoteness,
    legendAreas, isLegendArea, areaOf, sameArea,
    hasLegend: (cx: number, cy: number) => legendCells.has(cellKey(cx, cy)), legendCells,
    island: rosterIsland, legendKinds: live.legendKinds, zoo: zoo ? { ...zoo, junctions: zoo.layout ? [] : zooJunctions(zoo, A) } : undefined,
    legendClearing: (cx: number, cy: number) => clearings.get(cellKey(cx, cy)) ?? (legendAreas.size ? clearings.get(legendAreas.get(cellKey(cx, cy)) ?? "") ?? null : null), legendClearings: [] as LegendClearing[], // (by its legend's area: a legend area's by its pair)
    paths: null as unknown as PathNetwork,
    specialSites: [...specials.values()], special: (cx: number, cy: number) => (specials.size ? specials.get(cellKey(cx, cy)) ?? null : null),
    challengeVeil: challengeAt && tuning.challenge?.hide?.on ? challengeAt : null, // (its clearing, hidden before the party: rules/forest.ts Plant.veil)
  }; live.map = map;
  if (prep?.route) rememberRoute(map as unknown as ForestMap, prep.route); // (its route, already worked out: rules/leyroute.ts)
  // The paths first (their lines need only the areas), so soundsystems, set pieces and the
  // grounds can keep off them; then the grounds; then the paths' pieces, clear of all of those.
  map.paths = new PathNetwork(map);
  // The night's deal (Ed, 2026-10-28; rules/deal.ts): the island's types dealt again onto its areas along tonight's route, its own
  // kind first, no kind twice in a row; its shapes (areas, lakes, coast, legend areas) left as its world made them. The route
  // first (through the soundsystems' spots, kept off the paths made above: those spots are kept, so the route and its stones stay
  // as planned), then the deal, then everything that follows the types: the shore's forest, the legend areas' pairs and looks,
  // the paths again (the streams between wet areas: the only lines that follow the types), the set pieces and scenes below.
  let legendSlotOf: Map<string, string> | null = null, wetBefore: ((cx: number, cy: number) => boolean) | undefined;
  if (rosterIsland && !zoo && live.others.length > 1) {
    const order = routeOf(map as unknown as ForestMap).order, at = (k: string): Cell => { const [x, y] = k.split(",").map(Number); return [x, y]; };
    for (const k of order) { const [x, y] = at(k); soundsystemSpot(x, y); } // (kept: the route's stones)
    const kindOfType = (t: number) => AREA_TYPES[t]?.creature ?? "", own = rosterIsland.kind === "home" ? null : rosterIsland.kind;
    // (home's deck tonight's kinds, homeRoster: one area each, whatever kinds its areas were made with above)
    const homeDeck = rosterIsland.kind === "home" ? rosterIsland.roster.flatMap(q => Array.from({ length: q.areas }, () => AREA_TYPES.findIndex(a => a.creature === q.kind))) : null;
    const deck = homeDeck && homeDeck.length ? order.map((_, i) => homeDeck[i % homeDeck.length]) : order.map(k => types.get(k)!), found = new Set(MS.found ?? []), before = new Map(types);
    // (the legend areas each of tonight's legends could have, given a deal: those beside one of its kind's areas, the roomiest
    // for it first; tonight's legends as the route's first three areas deal them, rules/rosters.ts dealLegends)
    const slots = [...legendAreas.keys()], homeKey = cellKey(centreCell[0], centreCell[1]);
    const legendsOf = (dealt: number[]) => {
      const kindAt = new Map(order.map((k, i) => [k, kindOfType(dealt[i])]));
      const first = order.slice(0, 3), early = tuning.legends?.earlyQuest !== false ? first.filter(k => first.some(o => o !== k && kindAt.get(o) !== kindAt.get(k))).map(k => kindAt.get(k)!) : [];
      const kinds = dealLegends(rosterIsland, runSeed, found, early), byKind = new Map<string, string[]>();
      for (const kind of kinds) {
        const want = legendRadius(kind, LC0, areaMax), fits = (s: string) => Math.min(slotRoom.get(s) ?? 0, want); // (room up to its need)
        byKind.set(kind, slots.filter(s => [...(neighbours.get(s) ?? [])].some(o => o !== homeKey && kindAt.get(o) === kind)).sort((a, b) => fits(b) - fits(a) || (a < b ? -1 : 1)));
      }
      const slotOf = matchLegendAreas(kinds, k => byKind.get(k) ?? []);
      // (each legend area paired with an area of its own beside it, never one two share, Ed 2026-11-04: "Please fix"; a legend's
      // its kind's, nearest the route's start; an empty one's the area it was grown beside where it can, else any beside it. Where
      // no pairing gives every legend area its own, the night's last legend dealt one keeps its legend in its own area instead,
      // as a kind with no room beside its areas does, till one does: and the deal is scored by the legends that kept theirs)
      const nextTo = (s: string) => [...(neighbours.get(s) ?? [])].filter(o => kindAt.has(o) && o !== homeKey).sort((a, b) => order.indexOf(a) - order.indexOf(b));
      let pairOf = new Map<string, string>();
      const dropped: string[] = [];
      for (;;) {
        const mine = new Map([...slotOf].map(([kind, s]) => [s, kind]));
        const wants = (s: string) => { const kind = mine.get(s), near = nextTo(s); if (kind) return near.filter(o => kindAt.get(o) === kind); const was = legendAreas.get(s)!; return near.includes(was) ? [was, ...near.filter(o => o !== was)] : near; };
        pairOf = pairLegendAreas([...slots.filter(s => mine.has(s)), ...slots.filter(s => !mine.has(s))], wants);
        if (pairOf.size === slots.length || !slotOf.size) break;
        const last = [...slotOf.keys()].pop()!;
        slotOf.delete(last);
        dropped.push(last);
      }
      return { kinds, slotOf, kindAt, pairOf, dropped };
    };
    const { types: dealt } = dealAlongRoute(deck, kindOfType, own, runSeed, d => legendsOf(d).slotOf.size);
    order.forEach((k, i) => types.set(k, dealt[i]));
    typeBeyond();
    themeSpecials();
    // (the legend areas paired again: tonight's legends each beside one of its kind's areas where the matching found one, the rest
    // beside the area they were grown from, each taking its pair's look; one no pairing could give an area of its own, the one it
    // was grown beside, logged)
    const { kinds, slotOf, pairOf, dropped } = legendsOf(dealt), lone: string[] = [];
    if (dropped.length) console.info(`legend areas: seed ${seed}: ${dropped.join(", ")} in an area of its own kind, not a legend area: no pairing gave every legend area its own with it`);
    for (const s of slots) {
      const pair = pairOf.get(s) ?? legendAreas.get(s)!;
      if (!pairOf.has(s)) lone.push(s);
      legendAreas.set(s, pair);
      pairCells.set(s, at(pair));
      types.set(s, types.get(pair)!);
    }
    if (lone.length) console.info(`legend areas: seed ${seed}: ${lone.join(", ")} with no area of its own to pair with`);
    live.dealtKinds = kinds;
    legendSlotOf = new Map([...slotOf].map(([kind, s]) => [kind, legendAreas.get(s)!]));
    live.pieceHome = null;
    pieceSpots.clear();
    wetBefore = (cx, cy) => AREA_TYPES[before.get(cellKey(cx, cy)) ?? typeOf(cx, cy)].wet;
    map.paths = new PathNetwork(map, wetBefore);
  }
  // The path network (Ed, 2026-11-03: "Each non-lake area has a stump site or a special site ...; paths link each of these sites
  // to the sites in adjacent areas. Paths don't have trees on them."): the stones and special sites placed (off the lines above:
  // the railway, the streams), every one of them, and home's dancefloor, joined by a footpath to each touching area's, ending at
  // the edge of its clearing (the stump's roots, the find's patch, the dancefloor's), round the lakes and clear of the stones and
  // the treehouse between (rules/paths.ts). Then the set pieces, grounds, scenes and legends' clearings keep off them, below.
  if (!zooAt) placeSites(); // (every stone and special site, now the lines they keep off are laid)
  if (tuning.paths.network && !zoo) {
    const keepOut: { x: number; z: number; r: number; rim?: boolean }[] = [{ x: centre.x, z: centre.z, r: floorClear }, { x: treehouse.x, z: treehouse.z, r: TH.clear }];
    for (const sp of specials.values()) keepOut.push({ x: sp.x, z: sp.z, r: sp.r, ...(sp.kind === "challenge" ? { rim: true } : {}) });
    for (const [cx, cy] of cells) if (cx !== centreCell[0] || cy !== centreCell[1]) { const q = soundsystemSpot(cx, cy); keepOut.push({ x: q.x, z: q.z, r: tuning.soundsystemFootprint + 3 }); }
    const ends = (cx: number, cy: number) => {
      if (cx === centreCell[0] && cy === centreCell[1]) return { x: centre.x, z: centre.z, r: floorClear + tuning.paths.pathHalf + 3 }; // (out past the keep-out round it)
      const sp = specials.size ? specials.get(cellKey(cx, cy)) : undefined;
      if (sp) return { x: sp.x, z: sp.z, r: sp.r + 1 };
      if (!playable(cx, cy)) return null;
      const q = soundsystemSpot(cx, cy);
      return { x: q.x, z: q.z, r: stoneClear };
    };
    map.paths = new PathNetwork(map, wetBefore, { ends, keepOut });
    live.pieceHome = null;
    pieceSpots.clear();
  }
  return { ...m, map, legendSlotOf };
}
export type MapAssembled = ReturnType<typeof assembleMap>;
