// A stage of the forest map's making (rules/map.ts generateMap calls them in order; split from its body: the same sums in the same order).
// What's kept clear: the legend areas' cells, the grounds and scenes' lists, ground reserved round sites, the stones' gaps,
// the bounds and beach, hard ground (no trees), the arenas, the trees' weight, and which areas count as one.
import { cellKey, chooseLegendCells } from "./helpers";
import type { Ground, Scene, LegendClearing } from "../map";
import { type Bounds, beachOf } from "../mapShape";
import { zooFence } from "../zooMap";
import type { Cell } from "../partition";
import { vnoise, smoothstep } from "../random";
import type { MapSites } from "./sites";

/** What's reserved and kept clear, and the trees' weight. */
export function reservations(m: MapSites) {
  const { tuning, A, round, zooAt, zoo, rosterIsland, seed, shapeSeed, n, toPart, centreCell, partition, neighbours, siteXZ, siteOf, centre, specials, playable, cells, legendAreas, pairCells, land, lakes, challengeAt, lakeShore, lakeAt, areaAt, floorClear, soundsystemSpot, TH, treehouse, setPieceSpot, live } = m;
  const legendCells = zoo ? new Set(cells.filter(([x, y]) => x !== centreCell[0] || y !== centreCell[1]).map(([x, y]) => cellKey(x, y))) : rosterIsland ? new Set<string>() : chooseLegendCells(cells, centreCell, neighbours, tuning.legends?.share ?? 1, seed); // (the playable areas; an island by roster deals its own below, once the route's known)
  live.legendKinds = [];
  const grounds: Ground[] = [], scenes: Scene[] = [], clearings = new Map<string, LegendClearing>();
  const reserved = (x: number, z: number, r: number) => {
    const gap = tuning.reserveMargin, cell = areaAt(x, z).cell;
    for (const c of clearings.values()) if (Math.abs(x - c.x) < r + c.r + gap && Math.abs(z - c.z) < r + c.r + gap && Math.hypot(x - c.x, z - c.z) < r + c.r + gap) return true;
    if (Math.hypot(x - centre.x, z - centre.z) < r + floorClear + gap) return true;
    if (Math.hypot(x - treehouse.x, z - treehouse.z) < r + TH.clear + gap) return true;
    if (lakes && lakeAt(x, z) > -(r + lakeShore + gap)) return true; // (nothing placed on a lake or its shore: rules/lakes.ts)
    for (const g of grounds) if (Math.hypot(x - g.x, z - g.z) < r + g.r + gap) return true;
    for (const c of scenes) if (Math.hypot(x - c.x, z - c.z) < r + c.r + gap) return true;
    for (const sp of specials.values()) if (Math.hypot(x - sp.x, z - sp.z) < r + sp.r + gap) return true; // (a special site's clearing)
    for (const k of [cellKey(cell[0], cell[1]), ...(neighbours.get(cellKey(cell[0], cell[1])) ?? [])]) {
      const [cx, cy] = k.split(",").map(Number);
      if (!(cx === centreCell[0] && cy === centreCell[1]) && playable(cx, cy)) { const q = soundsystemSpot(cx, cy); if (Math.hypot(x - q.x, z - q.z) < r + tuning.soundsystemFootprint + gap) return true; }
      const p = setPieceSpot(cx, cy);
      if (p && Math.hypot(x - p.x, z - p.z) < r + tuning.setPieceFootprint * tuning.setPieceScale + gap) return true;
    }
    return false;
  };
  // The keep-clear zone round every area's great stump, or its runestone where the stumps are off (Ed, 2026-10-29: "No special
  // areas should appear so close to stump/runestone areas; no special scenery, no finds or flasks, no legend circles"): the
  // scenes and set pieces, ruins and freak trees, modern relics, the night's find, the flasks, the legends' clearings, walls and
  // stone rings, ponds and campfires, the party's picnics and campfires and the grounds each keep their whole footprint
  // stoneKeepClear metres from the stone's middle (its soundsystem's spot). How far (x, z) is from the nearest stone's middle:
  const keepClear = tuning.stoneKeepClear ?? 40;
  let stoneSites: { cx: number; cy: number; x: number; z: number }[] | null = null;
  const stoneGap = (x: number, z: number) => {
    stoneSites ??= cells.filter(([cx, cy]) => playable(cx, cy) && !(cx === centreCell[0] && cy === centreCell[1])).map(([cx, cy]) => ({ cx, cy, ...siteOf(cx, cy) }));
    const reach = keepClear + A * 2; // (a stone lies at most about 1.5 areas from its site: soundsystemSpot)
    let best = Infinity;
    for (const s of stoneSites) {
      if (Math.abs(x - s.x) > reach || Math.abs(z - s.z) > reach) continue;
      const q = soundsystemSpot(s.cx, s.cy);
      best = Math.min(best, Math.hypot(x - q.x, z - q.z));
    }
    return best;
  };
  const clearOfStones = (x: number, z: number, r = 0) => stoneGap(x, z) >= keepClear + r; live.clearOfStones = clearOfStones;
  // The beach and the sea past it (the tuning's beach): nothing grows or stands there.
  const pad = A * 0.5;
  const bounds: Bounds = land
    ? { ...land.box, land, lakes, seed: shapeSeed, ...(zooAt ? { fence: zooFence(zooAt, A) } : {}) }
    : { minX: pad, maxX: n * A - pad, minZ: pad, maxZ: n * A - pad, ...(lakes ? { lakes, seed: shapeSeed } : {}), ...(zooAt ? { fence: zooFence(zooAt, A) } : {}) };
  const beach = beachOf(bounds, tuning);
  const hardCell = (x: number, z: number, cell: Cell, under = false) => {
    if (beach && beach.intoSand(x, z) > 0) return true;
    if (zooAt && cell[0] === centreCell[0] && cell[1] === centreCell[1]) return true; // (the zoo's plaza and streets: bare stone)
    if (lakes && lakeAt(x, z) > -lakeShore) return true; // (a lake and its bare shore: rules/lakes.ts)
    if (Math.hypot(x - centre.x, z - centre.z) < floorClear) return true;
    // (the circle lying in this cell: a legend area's is kept under its pair's key; a pair's legend lying next door isn't its own)
    const key = cellKey(cell[0], cell[1]), held = clearings.get(key) ?? (legendAreas.size ? clearings.get(legendAreas.get(key) ?? "") : undefined);
    const lc = held && held.cell[0] === cell[0] && held.cell[1] === cell[1] ? held : undefined;
    if (lc && Math.hypot(x - lc.x, z - lc.z) < lc.r + (vnoise(x / 4, z / 4, seed + 93) - 0.5) * 3) return true; // a sleeping legend's clearing (its edge ragged by a metre and a half either way: the art director on #235)
    const sp = specials.size ? specials.get(key) : undefined;
    if (sp && Math.hypot(x - sp.x, z - sp.z) < sp.r && !(under && sp.kind === "challenge")) return true; // (a special site's clearing: tonight's find on its clear patch)
    if (challengeAt && !under && Math.hypot(x - challengeAt.x, z - challengeAt.z) < challengeAt.r) return true; // (the challenge circle's, whole, whichever area it reaches into)
    if (Math.hypot(x - treehouse.x, z - treehouse.z) < TH.clear) return true;
    for (const g of grounds) if (Math.abs(x - g.x) < g.r && Math.abs(z - g.z) < g.r && Math.hypot(x - g.x, z - g.z) < g.r) return true;
    for (const c of scenes) if (Math.abs(x - c.x) < c.r && Math.abs(z - c.z) < c.r && Math.hypot(x - c.x, z - c.z) < c.r * 0.85) return true; // a scene's ground is clear of trees
    // A set piece keeps a clearing round it, sized with it; a soundsystem a little room.
    const p = setPieceSpot(cell[0], cell[1]);
    if (p && Math.hypot(x - p.x, z - p.z) < tuning.setPieceClear * tuning.setPieceScale) return true;
    if (cell[0] === centreCell[0] && cell[1] === centreCell[1]) return false;
    if (!playable(cell[0], cell[1])) return false; // (no soundsystem ever stands in the buffer's areas)
    const q = soundsystemSpot(cell[0], cell[1]);
    // (a great stump in its place: its roots kept clear of trees, runeMarkers.stump.clear: Ed, 2026-10-29)
    const S = tuning.runeMarkers?.stump;
    return Math.hypot(x - q.x, z - q.z) < Math.max(tuning.soundsystemFootprint + tuning.treeMarginFromSoundsystem, S?.on ? S.clear : 0);
  };
  const hardClear = (x: number, z: number, under = false) => { const [u, v] = toPart(x, z); return hardCell(x, z, partition.partition(u, v), under); };
  // Every area's fighting arena (Ed, 2026-10-05: "each is effectively a fighting arena... not much
  // room to fight in each area"; then "softer edges, the falloff between dense forest and clearing
  // smoother"): mostly open within arena.radius metres of its centre and its soundsystem, the woods
  // thickening along a smooth curve over a band arena.band metres wide beyond, its distance
  // wobbled by noise (arena.noise of the band) so the edge is no ring; both times the fight's scale.
  // Only the playable areas have one: the buffer's by the beach never get a runestone, soundsystem or
  // fight, so an arena there was an empty hole in the woods (Ed, 2026-10-26).
  const arenaIn = (x: number, z: number, cell: Cell) => {
    const R = tuning.arena;
    if (!R || R.radius <= 0 || !playable(cell[0], cell[1])) return 1;
    const k = tuning.fight?.scale ?? 1, s = siteXZ(cell[0], cell[1]), q = soundsystemSpot(cell[0], cell[1]);
    const d = Math.min(Math.hypot(x - s[0], z - s[1]), Math.hypot(x - q.x, z - q.z)), band = R.band * k;
    const wob = (vnoise(x / 14, z / 14, seed + 71) - 0.5) * 2 * R.noise * band;
    const f = Math.min(1, Math.max(0, (d + wob - R.radius * k) / Math.max(0.01, band)));
    return R.curve === "smooth" ? smoothstep(f) : f; // (linear: the woods start thinning in right past the open middle, Ed at v473)
  };
  const arenaOpen = (x: number, z: number, cell?: Cell) => arenaIn(x, z, cell ?? areaAt(x, z).cell);
  const treeWeight = (x: number, z: number, under = false) => {
    const [u, v] = toPart(x, z), cell = partition.partition(u, v);
    if (hardCell(x, z, cell, under)) return 0;
    // Clearings round area centres and random glades, each with a soft edge (Ed: no hard rings).
    const glade = 1 - smoothstep((vnoise(x / tuning.gladeScale, z / tuning.gladeScale, seed + 61) - (1 - tuning.gladeAmount)) / 0.12);
    // (the challenge area: no open middle of its own, the woods right up to its clearing's edge, Ed 2026-11-03: "trees should come
    // close to the circle's edge, with only a narrow clear margin outside it")
    // (hidden, `under`: the woods carried on over its floor, as thick as at its edge: Ed, 2026-11-12, "there are just normal trees")
    if (challengeAt && cell[0] === challengeAt.cell[0] && cell[1] === challengeAt.cell[1]) return under ? glade : smoothstep((Math.hypot(x - challengeAt.x, z - challengeAt.z) - challengeAt.r) / 2) * glade;
    return smoothstep((partition.openness(u, v) - tuning.clearingSize) / Math.max(0.01, tuning.clearingFalloff)) * glade * arenaIn(x, z, cell);
  };

  const remoteness = (cx: number, cy: number) => Math.min(1, Math.hypot(cx - centreCell[0], cy - centreCell[1]) / (round ? live.R : n / 2));
  // (a legend area counts as its pair: the cell itself otherwise, unallocated; on a map without legend areas, no lookup at all)
  const areaOf = (cell: Cell): Cell => (legendAreas.size ? pairCells.get(cellKey(cell[0], cell[1])) ?? cell : cell);
  const sameArea = (a: Cell, b: Cell) => (a[0] === b[0] && a[1] === b[1]) || (legendAreas.size > 0 && (() => { const p = areaOf(a), q = areaOf(b); return p[0] === q[0] && p[1] === q[1]; })());
  return { ...m, legendCells, grounds, scenes, clearings, reserved, stoneGap, clearOfStones, bounds, hardClear, arenaOpen, treeWeight, remoteness, areaOf, sameArea };
}
export type MapReserve = ReturnType<typeof reservations>;
