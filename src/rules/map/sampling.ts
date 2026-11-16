// A stage of the forest map's making (rules/map.ts generateMap calls them in order; split from its body: the same sums in the same order).
// Sampling the map: the area at a point (its type and look, its openness), its set piece, home's dancefloor clearing, and
// the soundsystem spots' helpers (on its own ground, off the paths, alone).
import { lakeKnobs, lakeDepth } from "../lakes";
import type { Bounds } from "../mapShape";
import type { AreaSample } from "../map";
import { vnoise, hash2, rng } from "../random";
import { HOME_LOOK, AREA_TYPES } from "./areaTypes";
import { cellKey } from "./helpers";
import { floorClearing } from "../speakers";
import type { MapSpecials } from "./specials";

/** The map's sampling: areaAt, set pieces, and the spots' helpers. */
export function areaSampling(m: MapSpecials) {
  const { tuning, A, seed, shapeSeed, L, V, centreCell, partition, typeOf, siteOf, centre, cells, lakes, live } = m;
 // (the find's area the woods of its nearest; the legend areas their pairs' still)
  // (how far into a lake: rules/lakes.ts; nothing grows or is placed on one or its shore)
  const lakeShore = lakeKnobs(tuning).shore, lakeAt = (x: number, z: number) => (lakes ? lakeDepth({ lakes } as Bounds, x, z) : -Infinity);
  const areaAt = (x: number, z: number): AreaSample => {
    // (toPart inline: no [u, v] tuple a call; phase 2's GC audit, the same sums)
    const uu = x / A, vv = z / A;
    const u = uu + V * (vnoise(uu / L, vv / L, shapeSeed + 91) - 0.5) * 2, v = vv + V * (vnoise(uu / L, vv / L, shapeSeed + 92) - 0.5) * 2, cell = partition.partition(u, v);
    return { cell, type: typeOf(cell[0], cell[1]), look: cell[0] === centreCell[0] && cell[1] === centreCell[1] ? HOME_LOOK : typeOf(cell[0], cell[1]), openness: partition.openness(u, v) };
  };
  // An area that rolls a set piece (setPieceChance of those whose type has one; not home).
  const rollsSetPiece = (cx: number, cy: number) => {
    const t = AREA_TYPES[typeOf(cx, cy)];
    return !!t.setPiece && !(cx === centreCell[0] && cy === centreCell[1]) && hash2(cx, cy, seed + 61) < tuning.setPieceChance;
  };
  // Each set piece at most once per map (Ed, v160): in the area of its type nearest home that
  // rolls one and has room for it; the type's other areas get none.
  live.pieceHome = null;
  const setPieceOf = (cx: number, cy: number) => {
    if (!live.pieceHome) {
      live.pieceHome = new Map();
      const cand: [number, number, number][] = [];
      for (const [x, y] of cells) if (rollsSetPiece(x, y)) cand.push([x, y, Math.hypot(x - centreCell[0], y - centreCell[1]) + hash2(x, y, seed + 63) * 0.5]);
      cand.sort((a, b) => a[2] - b[2]);
      for (const [x, y] of cand) { const t = typeOf(x, y); if (!live.pieceHome.has(t) && live.pieceSpotOf(x, y)) live.pieceHome.set(t, cellKey(x, y)); }
    }
    const t = typeOf(cx, cy);
    return live.pieceHome.get(t) === cellKey(cx, cy) ? AREA_TYPES[t].setPiece! : null;
  };
  // The dancefloor keeps a clearing of its own, however close a neighbouring area's centre.
  const floorR = tuning.dancefloor.radius, floorClear = floorClearing(tuning); // out past the speakers

  // Gameplay is placed first: each area's soundsystem spot is reserved from the start (whether or
  // not the party has reached it yet), then scenery keeps clear of it and of the dancefloor.
  const inCell = (x: number, z: number, cx: number, cy: number) => { const c = areaAt(x, z).cell; return c[0] === cx && c[1] === cy; };
  const soundSpots = new Map<string, { x: number; z: number }>();
  // Off any path, road, railway or stream's corridor (Ed, v160: paths run on unbroken), and never in the dancefloor's ring of
  // speakers or its clearing (Ed, v183).
  const onPath = (x: number, z: number, r = tuning.soundsystemFootprint) => !!live.map.paths.at(x, z, r + 1) || Math.hypot(x - centre.x, z - centre.z) < floorClear + r;
  // An area's own ground nearest its site: the site, or (one area in eight has its site in a neighbour's ground) the nearest point of its own.
  const ownGround = (cx: number, cy: number) => {
    const s = siteOf(cx, cy);
    if (!inCell(s.x, s.z, cx, cy)) for (let d = 2; d < A * 0.75 * 1.5; d += 2) for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d;
      if (inCell(x, z, cx, cy)) return { x, z };
    }
    return { x: s.x, z: s.z };
  };
  // (the nearest spot round `spot`, in the area, that `ok` takes: within `far` metres, every `step`, 16 ways round; null if none)
  const nearestOk = (spot: { x: number; z: number }, cx: number, cy: number, ok: (x: number, z: number) => boolean, far: number, step = 3) => {
    for (let d = step; d < far; d += step) for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2, x = spot.x + Math.cos(a) * d, z = spot.z + Math.sin(a) * d;
      if (inCell(x, z, cx, cy) && ok(x, z)) return { x, z };
    }
    return null;
  };
  // Where an area's stone would stand on its own: beside the area's centre, in its clearing, inside its own ground, off the
  // corridors (the nearest clear spot round it if it fell on one).
  const stoneAlone = (cx: number, cy: number) => {
    const r = rng(seed * 17 + cx * 53 + cy * 911), { x: ax, z: az } = ownGround(cx, cy);
    let spot = { x: ax, z: az };
    for (let i = 0; i < 24; i++) {
      const a = r() * Math.PI * 2, d = 3 + r() * 4, x = ax + Math.cos(a) * d, z = az + Math.sin(a) * d + 3;
      if (inCell(x, z, cx, cy)) { spot = { x, z }; break; }
    }
    if (onPath(spot.x, spot.z)) spot = nearestOk(spot, cx, cy, (x, z) => !onPath(x, z), A * 0.3) ?? spot;
    return spot;
  };
  return { ...m, lakeShore, lakeAt, areaAt, rollsSetPiece, setPieceOf, floorR, floorClear, inCell, soundSpots, onPath, ownGround, nearestOk, stoneAlone };
}
export type MapSampling = ReturnType<typeof areaSampling>;
