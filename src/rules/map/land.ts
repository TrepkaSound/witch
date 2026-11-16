// A stage of the forest map's making (rules/map.ts generateMap calls them in order; split from its body: the same sums in the same order).
// The island's land and lakes (rules/land.ts): its playable areas and the buffer ring's, whole, the coast round them, kept a
// strait from its patch's edge; the zoo's lakes and disc. islandLand stops here, with the land alone.
import { type LandMap, landOf, makeLand } from "../land";
import { cellKey, LAND_STEP } from "./helpers";
import type { Cell } from "../partition";
import { patchAt, STRAIT } from "../archipelago";
import type { ForestMap } from "../map";
import { ZOO_CONFIG } from "../zoo";
import type { MapLegendAreas } from "./legendAreas";

/** The land and the lakes; `{ early }` for islandLand (the land alone). */
export function landAndCoast(m: MapLegendAreas) {
  const { only, prep, A, MS, round, zooAt, patch, L, V, toPart, centreCell, partition, lo, hi, neighbours, siteOf, centre, lakeCells, playable, cells, legendAreas, live } = m;
  // The warp's steepest slope (vnoise's gradient is at most 1.5 a component), so a step of d metres
  // moves a point at most d * stretch / A in partition units.
  const stretch = 1 + (2 * V / L) * 1.5 * 2;
  const cellSafe = (x: number, z: number) => { const [u, v] = toPart(x, z), r = partition.partitionSafe(u, v); return { cell: r.cell, safe: (r.safe * A) / stretch }; };
  // The island's land (rules/land.ts; Ed, 2026-10-11): its playable areas and the buffer ring's (the areas whose centres lie
  // within the buffer of them), whole; its coast runs round their borders. Made once here, then asked how far from the water by
  // everything that cares. Past it, the sea.
  const landCells = new Set<string>(); live.landCells = landCells;
  let land: LandMap | undefined, lakes: LandMap | undefined;
  if (round) {
    // (the playable areas, and every area that comes within the buffer's depth of them, `deep` metres: so everything placed for
    // play stands that far from the sea at least, whatever the island's shape; found on a coarse grid swept for its distance to
    // the playable ground)
    const want = new Set<string>(), deep = MS.buffer * A * 0.85, G = 20;
    for (const [cx, cy] of cells) want.add(cellKey(cx, cy));
    for (const k of legendAreas.keys()) want.add(k); // (its legend areas its ground too: the buffer and the coast round them)
    let px0 = Infinity, px1 = -Infinity, pz0 = Infinity, pz1 = -Infinity;
    for (const [cx, cy] of [...cells, ...[...legendAreas.keys()].map((k): Cell => { const [x, y] = k.split(",").map(Number); return [x, y]; })]) { const s = siteOf(cx, cy); px0 = Math.min(px0, s.x); px1 = Math.max(px1, s.x); pz0 = Math.min(pz0, s.z); pz1 = Math.max(pz1, s.z); }
    px0 -= deep + A; px1 += deep + A; pz0 -= deep + A; pz1 += deep + A;
    const gc = Math.ceil((px1 - px0) / G) + 1, gr = Math.ceil((pz1 - pz0) / G) + 1, dd = new Float32Array(gc * gr).fill(Infinity), at: string[] = new Array(gc * gr);
    for (let j = 0; j < gr; j++) for (let i = 0; i < gc; i++) {
      const [u, v] = toPart(px0 + i * G, pz0 + j * G), c = partition.partition(u, v), k = j * gc + i;
      at[k] = cellKey(c[0], c[1]);
      if (playable(c[0], c[1]) || lakeCells.has(at[k]) || legendAreas.has(at[k])) dd[k] = 0; // (a lake is ringed by land as deep: never a lake on the coast)
    }
    const D2 = G * Math.SQRT2, relax = (k: number, q: number, w: number) => { if (dd[q] + w < dd[k]) dd[k] = dd[q] + w; };
    for (let j = 0; j < gr; j++) for (let i = 0; i < gc; i++) { const k = j * gc + i; if (i) relax(k, k - 1, G); if (j) { relax(k, k - gc, G); if (i) relax(k, k - gc - 1, D2); if (i < gc - 1) relax(k, k - gc + 1, D2); } }
    for (let j = gr - 1; j >= 0; j--) for (let i = gc - 1; i >= 0; i--) { const k = j * gc + i; if (i < gc - 1) relax(k, k + 1, G); if (j < gr - 1) { relax(k, k + gc, G); if (i < gc - 1) relax(k, k + gc + 1, D2); if (i) relax(k, k + gc - 1, D2); } }
    // (and in its patch: no land past half a strait in from its edge, so its coast and its neighbour's keep a strait between)
    const inPatch = (k: number) => { if (!patch) return true; const [cx, cy] = at[k].split(",").map(Number), q = siteOf(cx, cy), dx = q.x - centre.x, dz = q.z - centre.z; return Math.hypot(dx, dz) <= patchAt(patch, Math.atan2(dz, dx)) - STRAIT / 2 - A * 0.6; }; // (an area's ground reaches past its centre)
    for (let k = 0; k < dd.length; k++) if (dd[k] <= deep && (dd[k] === 0 || inPatch(k))) want.add(at[k]);
    // (one island: those joined to home's; and any area they ring round taken in, so no stray pond of a ghost area)
    const homeKey = cellKey(centreCell[0], centreCell[1]), todo = [homeKey];
    landCells.add(homeKey);
    while (todo.length) for (const k of neighbours.get(todo.pop()!) ?? []) if (want.has(k) && !landCells.has(k)) { landCells.add(k); todo.push(k); }
    const sea = new Set<string>(), edge: string[] = [];
    for (const k of neighbours.keys()) { const [x, y] = k.split(",").map(Number); if (!landCells.has(k) && (x <= lo || y <= lo || x >= hi - 1 || y >= hi - 1)) { sea.add(k); edge.push(k); } }
    while (edge.length) for (const k of neighbours.get(edge.pop()!) ?? []) if (!landCells.has(k) && !sea.has(k)) { sea.add(k); edge.push(k); }
    for (const k of neighbours.keys()) if (!sea.has(k)) landCells.add(k);
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const k of landCells) { const [cx, cy] = k.split(",").map(Number), s = siteOf(cx, cy); x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); z0 = Math.min(z0, s.z); z1 = Math.max(z1, s.z); }
    // (and never past half a strait in from its patch's edge, whatever its areas' ground: its coast and its neighbour's keep a
    // strait apart, the coast running along the strait where an area would reach over)
    // (by its true distance from the patch's edge near it: the edge crosses the way out from home's middle at a slant)
    const rim = patch ? Array.from(patch, (r, a) => { const t = (a / patch.length) * Math.PI * 2; return [Math.cos(t) * r, Math.sin(t) * r]; }) : [];
    // (each rim segment's middle and half its length: a sample further from the middle than that half plus half a strait, and
    // a metre over for rounding, is further than half a strait from every point of it, so the segment is skipped untested;
    // the rest are measured as before. The land map's samples went round all 96 segments each: a fifth of an island's making.)
    const rimMid = new Float64Array(rim.length * 3);
    for (let i = 0; i < rim.length; i++) {
      const [ax, az] = rim[i], [bx, bz] = rim[(i + 1) % rim.length], half = Math.hypot(bx - ax, bz - az) / 2 + STRAIT / 2 + 1;
      rimMid[i * 3] = (ax + bx) / 2; rimMid[i * 3 + 1] = (az + bz) / 2; rimMid[i * 3 + 2] = half * half;
    }
    const inStrait = (x: number, z: number) => {
      if (!patch) return true;
      const dx = x - centre.x, dz = z - centre.z, r = Math.hypot(dx, dz), out = patchAt(patch, Math.atan2(dz, dx));
      if (r > out - STRAIT / 2) return false;
      if (r < out - STRAIT * 3) return true;
      for (let i = 0; i < rim.length; i++) {
        const mx = dx - rimMid[i * 3], mz = dz - rimMid[i * 3 + 1];
        if (mx * mx + mz * mz > rimMid[i * 3 + 2]) continue;
        const [ax, az] = rim[i], [bx, bz] = rim[(i + 1) % rim.length], ex = bx - ax, ez = bz - az, f = Math.max(0, Math.min(1, ((dx - ax) * ex + (dz - az) * ez) / (ex * ex + ez * ez || 1)));
        if (Math.hypot(dx - ax - ex * f, dz - az - ez * f) < STRAIT / 2) return false;
      }
      return true;
    };
    const isLand = (x: number, z: number) => { if (!inStrait(x, z)) return false; const [u, v] = toPart(x, z), c = partition.partition(u, v); return landCells.has(cellKey(c[0], c[1])); };
    land = prep?.land ? landOf(prep.land) : makeLand(isLand, { minX: x0 - A, maxX: x1 + A, minZ: z0 - A, maxZ: z1 + A }, only?.landStep ?? LAND_STEP, 64, (A * 0.5) ** 2, only ? 1 : 2, true); // (crumbs under a quarter of an area's square taken as what's round them; slivers under about 16 m smoothed; ponds filled: no lakes but those meant)
    // The lakes' own map (the same kind, its "land" the lakes' water: + in a lake, - ashore), over the lakes' areas alone; the
    // island's land above has them as land (her flight's edge, the beach and the sea are the sea's alone).
    if (lakeCells.size) {
      let lx0 = Infinity, lx1 = -Infinity, lz0 = Infinity, lz1 = -Infinity;
      for (const k of lakeCells) { const [cx, cy] = k.split(",").map(Number), s = siteOf(cx, cy); lx0 = Math.min(lx0, s.x); lx1 = Math.max(lx1, s.x); lz0 = Math.min(lz0, s.z); lz1 = Math.max(lz1, s.z); }
      const isLakeAt = (x: number, z: number) => { const [u, v] = toPart(x, z), c = partition.partition(u, v); return lakeCells.has(cellKey(c[0], c[1])); };
      lakes = prep ? (prep.lakes ? landOf(prep.lakes) : undefined) : makeLand(isLakeAt, { minX: lx0 - A, maxX: lx1 + A, minZ: lz0 - A, maxZ: lz1 + A }, only?.landStep ?? LAND_STEP, 32, (A * 0.5) ** 2, only ? 1 : 2, true);
    }
    if (only) return { early: { land, lakes, home: centre, areaSize: A, cells: cells.map(c => cellKey(c[0], c[1])) } as unknown as ForestMap }; // (islandLand: the land alone)
  }
  // The zoo's lakes (the islands not found yet): their own map, as an island's lakes', over their outlines.
  if (zooAt && lakeCells.size) {
    const wet = zooAt.islands.filter(I => !I.found);
    let lx0 = Infinity, lx1 = -Infinity, lz0 = Infinity, lz1 = -Infinity;
    for (const I of wet) { lx0 = Math.min(lx0, I.x - I.most); lx1 = Math.max(lx1, I.x + I.most); lz0 = Math.min(lz0, I.z - I.most); lz1 = Math.max(lz1, I.z + I.most); }
    const isLakeAt = (x: number, z: number) => { const c = partition.partition(x / A, z / A); return lakeCells.has(cellKey(c[0], c[1])); };
    lakes = prep ? (prep.lakes ? landOf(prep.lakes) : undefined) : makeLand(isLakeAt, { minX: lx0 - A, maxX: lx1 + A, minZ: lz0 - A, maxZ: lz1 + A }, LAND_STEP, 32, (A * 0.25) ** 2, 2, true);
  }
  // The zoo's disc (Ed, 2026-10-26: "Around the edge of the zoo, it looks like the map; all around the flagstones give way to
  // water, which falls off the disc as a waterfall, and behind that is space"): its land a disc out `margin` past the furthest
  // coast; past it the sea (rules/mapShape.ts beachOf: the zoo's beach a strip of flagstones' width), its lip and the fall drawn.
  if (zooAt && !land) {
    const R = zooAt.reach + (ZOO_CONFIG.margin ?? 120), h = zooAt.home;
    land = prep?.land ? landOf(prep.land) : makeLand((x, z) => Math.hypot(x - h.x, z - h.z) <= R, { minX: h.x - R, maxX: h.x + R, minZ: h.z - R, maxZ: h.z + R }, 8, 96);
  }
  return { ...m, cellSafe, landCells, land, lakes };
}
export type MapLand = Exclude<ReturnType<typeof landAndCoast>, { early: unknown }>;
