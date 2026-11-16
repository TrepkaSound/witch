// A stage of the forest map's making (rules/map.ts generateMap calls them in order; split from its body: the same sums in the same order).
// The legends' clearings with no room: their area grown into the buffer for one, or a circle kept every gap it can;
// then the clearings logged and the map's paths' pieces placed.
import { cellKey, CLAIM_PAD, BASE_NEIGHBOURS } from "./helpers";
import { AREA_TYPES } from "./areaTypes";
import { legendRadius, legendSpot } from "../legendFit";
import { isInside } from "../mapShape";
import type { Claim } from "../partition";
import { routeOf } from "../party";
import type { ForestMap } from "../map";
import type { MapClearings } from "./clearings";

/** The legends' clearings grown where there was no room, and the map finished. */
export function growClearings(m: MapClearings) {
  const { tuning, A, stoneClear, MS, rosterIsland, seed, toPart, centreCell, homeRadius, partition, neighbours, typeOf, siteOf, centre, lakeCells, specials, playable, cells, legendAreas, areaMax, landCells, land, areaAt, floorClear, inCell, soundsystemSpot, TH, treehouse, legendCells, clearings, reserved, stoneGap, clearOfStones, map, LC, moved, SHRINK, apart, legendAreaOfPair, fullOf, placeClearing } = m;
  // Where an area has no room for its legend's circle keeping every gap, nor another of its kind's areas, the area grows (Ed,
  // 2026-11-04: "make the last-resort placement grow the area instead of breaking the gap"; 2026-11-05, on circles still under
  // their size: "you can expand the coastline during map generation"): the circle goes where it keeps every gap, as near the area's
  // heart as it can, and the area claims a circle of ground round it (rules/partition.ts claimable, grown): the circle and CLAIM_PAD
  // more, or as far as reaches the area's own ground, so it's one piece with it, never over another site's footprint (5 m short).
  // The ground taken: the island's land (its playable areas', the buffer's, a legend area's with no legend tonight, or home's past
  // its circle, homeRadius), never home's circle, a legend area's with one, the find's or the challenge's, a lake's or another grown area's, and the buffer's depth from
  // the sea, so the land, coast and lakes are the same every night; each playable or legend area it takes from keeping 40% of its
  // ground or more. An area it now touches becomes its neighbour. Logged.
  const grownCells = new Set<string>(), grownLog: string[] = [], deepIn = MS.buffer * A * 0.85, homeOf = cellKey(centreCell[0], centreCell[1]);
  const growClearing = (cx: number, cy: number, full = false): boolean => {
    const need = full ? fullOf(cx, cy) - 0.01 : 0;
    const k = cellKey(cx, cy), la = legendAreaOfPair.get(k), [gx, gy] = la ? la.split(",").map(Number) : [cx, cy], g = cellKey(gx, gy);
    if (grownCells.has(g)) return false;
    const species = AREA_TYPES[typeOf(cx, cy)].creature, r0 = la ? legendRadius(species, LC, areaMax) : legendRadius(species, LC);
    const nb = neighbours.get(g) ?? new Set<string>(), site = siteOf(gx, gy), B = map.bounds, stone = la ? null : soundsystemSpot(cx, cy);
    const isPlayable = (q: string) => { const [x, y] = q.split(",").map(Number); return playable(x, y); };
    const emptyLegendArea = (q: string) => legendAreas.has(q) && !legendCells.has(legendAreas.get(q)!); // (one with no legend tonight)
    const takes = (q: string) => q === g || (q !== homeOf && (!legendAreas.has(q) || emptyLegendArea(q)) && !grownCells.has(q) && !lakeCells.has(q) && !specials.has(q) && (isPlayable(q) || landCells.has(q)));
    // (each area's ground round it, sampled every 8 m: what an area it takes from keeps)
    const census = new Map<string, number>(), span = A * 2.2, ground: [number, number][] = [];
    for (let dx = -span; dx <= span; dx += 8) for (let dz = -span; dz <= span; dz += 8) { const c = areaAt(site.x + dx, site.z + dz).cell, q = cellKey(c[0], c[1]); census.set(q, (census.get(q) ?? 0) + 64); if (q === g) ground.push([site.x + dx, site.z + dz]); }
    // (round a point surely in the area, nearest it first)
    let ox = site.x, oz = site.z;
    if (!inCell(ox, oz, gx, gy)) found: for (let d = 4; d < A * 1.6; d += 4) for (let i = 0; i < 24; i++) { const b = (i / 24) * Math.PI * 2, x = site.x + Math.cos(b) * d, z = site.z + Math.sin(b) * d; if (inCell(x, z, gx, gy)) { ox = x; oz = z; break found; } }
    const spots: [number, number, number][] = [];
    for (let i = -26; i <= 26; i++) for (let j = -26; j <= 26; j++) { const x = ox + i * A * 0.04, z = oz + j * A * 0.04; spots.push([x, z, Math.hypot(x - ox, z - oz)]); }
    spots.sort((p, q) => p[2] - q[2]);
    const keeps = (x: number, z: number, r: number) => isInside(B, x, z, 15) && (!stone || Math.hypot(x - stone.x, z - stone.z) - r >= (LC.minFromStone ?? 0)) && clearOfStones(x, z, r) && apart(x, z, r) && !reserved(x, z, r) && !map.paths.at(x, z, r * 0.6);
    const claimOf = (x: number, z: number, r: number): { claim: Claim; m2: number; from: string[] } | null => {
      let reach = Infinity;
      for (const [gx0, gz0] of ground) reach = Math.min(reach, Math.hypot(x - gx0, z - gz0));
      const rc = Math.max(r + CLAIM_PAD, reach + 6), [u0, v0] = toPart(x, z);
      // (never over another site's footprint, 5 m short of it: a stone's clearing, a legend's circle, the find's or challenge's, home's)
      let most = Math.min(stoneGap(x, z) - stoneClear, Math.hypot(x - centre.x, z - centre.z) - floorClear, Math.hypot(x - treehouse.x, z - treehouse.z) - TH.clear);
      for (const c of clearings.values()) most = Math.min(most, Math.hypot(x - c.x, z - c.z) - c.r);
      for (const sp of specials.values()) most = Math.min(most, Math.hypot(x - sp.x, z - sp.z) - sp.r - (sp.claimed ? CLAIM_PAD : 0));
      if (rc > most - 5) return null;
      let rp = 0;
      for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2, [u, v] = toPart(x + Math.cos(a) * rc, z + Math.sin(a) * rc); rp = Math.max(rp, Math.hypot(u - u0, v - v0)); }
      rp *= 1.02;
      const taken = new Map<string, number>();
      let mine = false;
      for (let dx = -rc * 1.3; dx <= rc * 1.3; dx += 4) for (let dz = -rc * 1.3; dz <= rc * 1.3; dz += 4) {
        const [u, v] = toPart(x + dx, z + dz);
        if ((u - u0) ** 2 + (v - v0) ** 2 >= rp * rp) continue;
        const c = partition.partition(u, v), q = cellKey(c[0], c[1]);
        if (!(takes(q) || (q === homeOf && Math.hypot(x + dx - centre.x, z + dz - centre.z) > homeRadius + 5)) || (land && land.distAt(x + dx, z + dz) < deepIn)) return null; // (home's: only past its circle, Ed's "the whole circle ... within it" kept)
        if (q === g) mine = true;
        else taken.set(q, (taken.get(q) ?? 0) + 16);
      }
      if (!mine) return null; // (the circle reaches the area's own ground: one piece with it)
      for (const [q, m2] of taken) { const was = census.get(q) ?? 0; if ((isPlayable(q) || legendAreas.has(q) || q === homeOf) && was - m2 < 0.4 * was) return null; }
      return { claim: { cell: [gx, gy], u: u0, v: v0, r: rp }, m2: [...taken.values()].reduce((a, b) => a + b, 0), from: [...taken.keys()] };
    };
    for (const r of new Set([...SHRINK, 0.55, 0.45].map(f => Math.max(LC.radius, r0 * f)).filter(r => r >= need))) for (const [x, z] of spots) {
      if (!keeps(x, z, r)) continue;
      const got = claimOf(x, z, r);
      if (!got) continue;
      partition.grown.push(got.claim);
      // (an area it took ground from that didn't touch it now does: the two made neighbours, the map's prep keeping them as first cut)
      if (got.from.some(q => !nb.has(q))) {
        if (!BASE_NEIGHBOURS.has(neighbours)) BASE_NEIGHBOURS.set(neighbours, [...neighbours].map(([q, v]): [string, string[]] => [q, [...v]]));
        for (const q of got.from) if (!nb.has(q)) { nb.add(q); let o = neighbours.get(q); if (!o) neighbours.set(q, (o = new Set())); o.add(g); }
        if (!neighbours.has(g)) neighbours.set(g, nb);
      }
      grownCells.add(g);
      clearings.set(k, { cell: [gx, gy], x, z, r, edge: LC.edge, legend: legendSpot(species, x, z, r, LC) });
      grownLog.push(`${g} by ${Math.round(got.m2)} m² of ${Math.round(census.get(g) ?? 0)} (its ${r.toFixed(0)} m circle ${Math.round(Math.hypot(x - ox, z - oz))} m off its heart)`);
      return true;
    }
    return false;
  };
  // Each legend's circle (Ed, 2026-11-04: "minimum distance between sites/circles/dancefloor/treehouse of 50m ... If this can't fit,
  // increase area sizes"): where its area has no room for one keeping every gap, the legend moves to another of its kind's areas
  // that has (one of the route's first three for the early quest's, so its quest stays early), before the last resort.
  const routeOrder = rosterIsland || tuning.legends?.earlyQuest !== false ? routeOf(map as unknown as ForestMap).order : [];
  const kindOfCell = (k: string) => { const [x, y] = k.split(",").map(Number); return AREA_TYPES[typeOf(x, y)].creature; };
  // (on a map by legends.share, the move keeps its spread: no more than two neighbouring legend areas together, chooseLegendCells)
  const noRoom: string[] = [];
  const runWith = (o: string, without: string) => { const seen = new Set([o]), todo = [o]; while (todo.length) for (const x of neighbours.get(todo.pop()!) ?? []) if (x !== without && legendCells.has(x) && !seen.has(x)) { seen.add(x); todo.push(x); } return seen.size; };
  for (const [cx, cy] of cells) {
    const k = cellKey(cx, cy);
    if (!legendCells.has(k) || clearings.has(k)) continue; // (no legend, no clearing: home, and the areas legends.share leaves out)
    const early = routeOrder.slice(0, 3).includes(k), kind = kindOfCell(k);
    const alts = (routeOrder.length ? routeOrder : cells.map(c => cellKey(c[0], c[1]))).filter(o => o !== k && !legendCells.has(o) && kindOfCell(o) === kind && (!early || routeOrder.slice(0, 3).includes(o)) && (!!rosterIsland || runWith(o, k) <= 2));
    // (at its full size first: in its area, or another of its kind's; else its area grown for it; else another of those grown; only
    // then a smaller circle, the same way round; never a circle breaking a gap: failing everything, no circle, logged)
    let at: string | undefined;
    for (const full of [true, false]) {
      for (const place of [placeClearing, growClearing]) {
        at = [k, ...alts].find(o => { const [x, y] = o.split(",").map(Number); return place(x, y, full); });
        if (at) break;
      }
      if (at) break;
    }
    if (!at) { noRoom.push(k); continue; }
    if (at !== k) { legendCells.delete(k); legendCells.add(at); moved.push(`${k} to ${at}`); }
  }
  if (moved.length) console.info(`legend clearings: seed ${seed}: ${moved.length} moved to another of its kind's areas, its own having no room keeping every gap: ${moved.join(", ")}`);
  if (grownLog.length) console.info(`legend clearings: seed ${seed}: ${grownLog.length} area${grownLog.length > 1 ? "s" : ""} grown for a legend's circle keeping every gap: ${grownLog.join(", ")}`);
  if (noRoom.length) console.info(`legend clearings: seed ${seed}: no room for a circle keeping every gap, even grown: ${noRoom.join(", ")}`);
  map.legendClearings = [...clearings.values()];
  map.paths.placePieces();
  return map;
}
