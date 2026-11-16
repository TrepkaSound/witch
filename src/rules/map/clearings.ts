// A stage of the forest map's making (rules/map.ts generateMap calls them in order; split from its body: the same sums in the same order).
// The legends' clearings (Ed, 2026-10-06): a circle round each legend, kept apart from every site; placed in its own area
// or another of its kind's.
import { CLAIM_PAD, cellKey } from "./helpers";
import { legendRadius, legendSpot } from "../legendFit";
import { AREA_TYPES } from "./areaTypes";
import { hash2 } from "../random";
import { isInside } from "../mapShape";
import { ZOO_CONFIG } from "../zoo";
import type { MapLegends } from "./legends";

/** The legends' clearings placed. */
export function legendClearings(m: MapLegends) {
  const { tuning, A, stoneClear, siteGap, siteLake, zooAt, seed, centreCell, neighbours, typeOf, siteOf, centre, specials, playable, legendAreas, areaMax, lakes, lakeAt, floorClear, inCell, soundsystemSpot, TH, treehouse, clearings, reserved, stoneGap, clearOfStones, map } = m;
  const LC = tuning.legendClearing, moved: string[] = [], SHRINK = [1, 0.92, 0.85, 0.78, 0.72, 0.65];
  // (a legend's circle siteGap from every other site that isn't a stone, Ed 2026-11-04: "Look at minimum distances between sites
  // too": the other legends' circles, the challenge's claim or the find's clearing, home's dancefloor clearing and treehouse; the
  // stones keep theirs, stoneKeepClear)
  const apart = (x: number, z: number, r: number) => {
    if (Math.hypot(x - centre.x, z - centre.z) < r + floorClear + siteGap || Math.hypot(x - treehouse.x, z - treehouse.z) < r + TH.clear + siteGap) return false;
    for (const c of clearings.values()) if (Math.hypot(x - c.x, z - c.z) < r + c.r + siteGap) return false;
    for (const sp of specials.values()) if (Math.hypot(x - sp.x, z - sp.z) < r + sp.r + (sp.claimed ? CLAIM_PAD : 0) + siteGap) return false;
    if (stoneGap(x, z) < r + stoneClear + siteGap) return false; // (every stone's clearing)
    return !lakes || lakeAt(x, z) <= -(r + siteLake); // (and a lake's water)
  };
  const legendAreaOfPair = new Map([...legendAreas].map(([k, p]) => [p, k]));
  // (one legend's circle in the area at (cx, cy): true where one fits keeping every gap; full, only at its full size, legendRadius's for
  // an area with a stone, never smaller: Ed, 2026-11-05, on a circle under its size, "ideally from world generation all of the areas are
  // large enough that this is not an issue")
  const fullOf = (cx: number, cy: number) => legendRadius(AREA_TYPES[typeOf(cx, cy)].creature, LC);
  const placeClearing = (cx: number, cy: number, full = false): boolean => {
    const need = full ? fullOf(cx, cy) - 0.01 : 0;
    // In its legend area (above): at its heart, where a runestone would stand, sized to fit its legend up to fit.areaMax; clear of
    // the runestones round it (its pair's among them) by minFromOtherStones; failing a full-size spot, smaller in fine steps.
    const la = legendAreaOfPair.get(cellKey(cx, cy));
    if (la) {
      const [lx, ly] = la.split(",").map(Number), species = AREA_TYPES[typeOf(cx, cy)].creature, site = siteOf(lx, ly), a0 = hash2(lx, ly, seed + 893) * Math.PI * 2;
      const r0 = legendRadius(species, LC, areaMax);
      const stones = [...(neighbours.get(la) ?? [])].map(k => k.split(",").map(Number)).filter(([x, y]) => playable(x, y) && !(x === centreCell[0] && y === centreCell[1])).map(([x, y]) => soundsystemSpot(x, y));
      const B = map.bounds, fits = (x: number, z: number, r: number) => {
        if (!isInside(B, x, z, 15) || !inCell(x, z, lx, ly)) return false;
        if (!stones.every(q => Math.hypot(x - q.x, z - q.z) - r >= (LC.minFromOtherStones ?? 0)) || !clearOfStones(x, z, r)) return false;
        for (let k = 0; k < 16; k++) { const b = (k / 16) * Math.PI * 2; if (!inCell(x + Math.cos(b) * r, z + Math.sin(b) * r, lx, ly)) return false; }
        return !reserved(x, z, r) && apart(x, z, r) && !map.paths.at(x, z, r * 0.6);
      };
      const spots: [number, number][] = [[site.x, site.z]];
      for (const f of [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5]) for (let k = 0; k < 16; k++) { const b = a0 + (k / 16) * Math.PI * 2; spots.push([site.x + Math.cos(b) * A * f, site.z + Math.sin(b) * A * f]); }
      placed: for (const k of [1, 0.92, 0.85, 0.78, 0.72, 0.65, 0.55, 0.45]) { const r = Math.max(LC.radius, r0 * k); if (r < need) break; for (const [x, z] of spots) if (fits(x, z, r)) { clearings.set(cellKey(cx, cy), { cell: [lx, ly], x, z, r, edge: LC.edge, legend: legendSpot(species, x, z, r, LC) }); break placed; } }
      if (clearings.has(cellKey(cx, cy))) return true;
    }
    const species = AREA_TYPES[typeOf(cx, cy)].creature, r0 = legendRadius(species, zooAt ? { ...LC, fit: { margin: LC.fit?.margin ?? 3, max: ZOO_CONFIG.legendCap ?? LC.fit?.max ?? 25 } } : LC); // (sized to fit its legend: rules/legendFit.ts; the zoo's cap its own)
    let r = r0;
    const site = siteOf(cx, cy), a0 = hash2(cx, cy, seed + 891) * Math.PI * 2;
    // (the zoo: at its island's middle, Ed 2026-10-26: "Each zoo area has the corresponding legend circle at the centre of it")
    if (zooAt) { clearings.set(cellKey(cx, cy), { cell: [cx, cy], x: site.x, z: site.z, r, edge: LC.edge, legend: legendSpot(species, site.x, site.z, r, LC) }); return true; }
    // Away from its area's runestone (where its soundsystem comes; Ed, 2026-10-06: "The legend circle shouldn't spawn
    // near its runestone"): its edge at least minFromStone metres off, so the circle, its grove and its rim kit stand
    // clear of the stone's clearing and the party's dance space (and a siege gets no safe spot beside its soundsystem).
    const stone = soundsystemSpot(cx, cy), fromStone = (x: number, z: number) => Math.hypot(x - stone.x, z - stone.z) - r;
    // (and every neighbouring area's runestone at least minFromOtherStones off its edge, always: none standing over the legend)
    const others = [...(neighbours.get(cellKey(cx, cy)) ?? [])].map(k => k.split(",").map(Number)).filter(([x, y]) => playable(x, y) && !(x === centreCell[0] && y === centreCell[1])).map(([x, y]) => soundsystemSpot(x, y));
    const clearOfOthers = (x: number, z: number) => others.every(q => Math.hypot(x - q.x, z - q.z) - r >= (LC.minFromOtherStones ?? 0));
    const farEnough = (x: number, z: number) => fromStone(x, z) >= (LC.minFromStone ?? 0);
    const keptClear = (x: number, z: number) => clearOfStones(x, z, r) && apart(x, z, r); // (and its whole circle out of every stone's keep-clear zone, siteGap from the other sites)
    const B = map.bounds, fits = (x: number, z: number) => {
      if (!isInside(B, x, z, 15) || !inCell(x, z, cx, cy)) return false; // (its middle where she can fly)
      if (!farEnough(x, z) || !clearOfOthers(x, z) || !keptClear(x, z)) return false;
      for (let k = 0; k < 16; k++) { const b = (k / 16) * Math.PI * 2; if (!inCell(x + Math.cos(b) * r, z + Math.sin(b) * r, cx, cy)) return false; }
      return !reserved(x, z, r) && !map.paths.at(x, z, r * pathK);
    };
    // (the paths kept wholly out at first; failing that, one may graze its rim)
    let pathK = 1;
    search: for (pathK of [1, 0.6]) for (const f of [0.4, 0.3, 0.5, 0.22, 0.6, 0.15, 0.7, 0.08]) for (let k = 0; k < 16; k++) {
      const b = a0 + (k / 16) * Math.PI * 2, x = site.x + Math.cos(b) * A * f, z = site.z + Math.sin(b) * A * f;
      if (fits(x, z)) { clearings.set(cellKey(cx, cy), { cell: [cx, cy], x, z, r, edge: LC.edge, legend: legendSpot(species, x, z, r, LC) }); break search; }
    }
    // Failing that (an area at the map's edge, or one whose ground lies off its middle): anywhere it fits in the area, nearest the usual distance first.
    if (!clearings.has(cellKey(cx, cy))) {
      // round a point surely in the area (its ground can lie well off its middle)
      let ox = site.x, oz = site.z;
      if (!inCell(ox, oz, cx, cy)) found: for (let d = 4; d < A * 1.6; d += 4) for (let k = 0; k < 24; k++) { const b = (k / 24) * Math.PI * 2, x = site.x + Math.cos(b) * d, z = site.z + Math.sin(b) * d; if (inCell(x, z, cx, cy)) { ox = x; oz = z; break found; } }
      const grid: [number, number, number][] = [];
      for (let i = -14; i <= 14; i++) for (let j = -14; j <= 14; j++) { const x = ox + i * A * 0.08, z = oz + j * A * 0.08; grid.push([x, z, Math.abs(Math.hypot(x - ox, z - oz) - A * 0.4)]); }
      grid.sort((p, q) => p[2] - q[2]);
      pathK = 0.6;
      // (and in a tight area, a smaller circle: the legend fills it more; in fine steps, so a big legend's circle loses no more than it must)
      sized: for (const k of SHRINK) { r = r0 * k; if (r < need) break; for (const [x, z] of grid) if (fits(x, z)) { clearings.set(cellKey(cx, cy), { cell: [cx, cy], x, z, r, edge: LC.edge, legend: legendSpot(species, x, z, r, LC) }); break sized; } }
      // (still none: a grid twice as fine, and the smaller circles a legend area's may take, never under legendClearing.radius, so every
      // site keeps its gap, Ed 2026-11-04: "minimum distance between sites/circles/dancefloor/treehouse of 50m")
      if (!clearings.has(cellKey(cx, cy))) {
        const fine: [number, number, number][] = [];
        for (let i = -28; i <= 28; i++) for (let j = -28; j <= 28; j++) { const x = ox + i * A * 0.04, z = oz + j * A * 0.04; fine.push([x, z, Math.abs(Math.hypot(x - ox, z - oz) - A * 0.4)]); }
        fine.sort((p, q) => p[2] - q[2]);
        finer: for (const k of [...SHRINK, 0.55, 0.45]) { r = Math.max(LC.radius, r0 * k); if (r < need) break; for (const [x, z] of fine) if (fits(x, z)) { clearings.set(cellKey(cx, cy), { cell: [cx, cy], x, z, r, edge: LC.edge, legend: legendSpot(species, x, z, r, LC) }); break finer; } }
      }
    }
    return clearings.has(cellKey(cx, cy));
  };
  return { ...m, LC, moved, SHRINK, apart, legendAreaOfPair, fullOf, placeClearing };
}
export type MapClearings = ReturnType<typeof legendClearings>;
