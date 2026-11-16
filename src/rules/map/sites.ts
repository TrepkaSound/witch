// A stage of the forest map's making (rules/map.ts generateMap calls them in order; split from its body: the same sums in the same order).
// Every stone and special site placed (placeSites, once the lines they keep off are laid), the soundsystem spots, the
// treehouse, and each set piece's spot.
import type { Cell } from "../partition";
import { CLAIM_PAD, cellKey, treehouseDistance } from "./helpers";
import { coastAlong } from "../zooMap";
import type { MapSampling } from "./sampling";

/** The sites: stones, soundsystems, the treehouse and the set pieces' spots. */
export function siteSpots(m: MapSampling) {
  const { tuning, A, stoneClear, siteGap, siteLake, stoneSpacing, zooAt, seed, centreCell, neighbours, siteOf, centre, specials, playable, cells, lakes, lakeAt, rollsSetPiece, setPieceOf, floorClear, inCell, soundSpots, onPath, ownGround, nearestOk, stoneAlone, live } = m;
  // Every stone and special site placed at once, in a fixed order (the special sites, then the stones row by row), so each is
  // the same whichever is asked for first: a special site at its area's site (off the corridors), and no stone's clearing nearer
  // another stone's or a special site's footprint than siteGap (Ed, 2026-11-04: "minimum distance between sites/circles/dancefloor/
  // treehouse of 50m"; before, Ed 2026-11-03: "Min 40 m between stumps"; "at least their clearings shouldn't overlap"): one that
  // would be is moved to the nearest spot in its area that's far enough from all placed before it.
  let sited = false;
  const placeSites = () => {
    if (sited) return;
    sited = true;
    // (each placed one's footprint: a stone's clearing, the challenge's claim, the find's clearing; a stone siteGap from each edge to edge)
    const placed: { x: number; z: number; r: number; cell?: Cell }[] = [], moved: string[] = [], wet: string[] = [], shifted: string[] = [];
    let skip: ReadonlySet<number> = new Set(); // (placed ones left out of farEnough: the repair's, below)
    const farEnough = (x: number, z: number) => placed.every((q, i) => skip.has(i) || Math.hypot(q.x - x, q.z - z) >= q.r + stoneClear + siteGap);
    // (and its clearing siteLakeGap off a lake's water (Ed, 2026-11-04: "10m from a lake edge"), and siteGap from home's dancefloor
    // clearing and treehouse; failing that, the stone's own footprint that far off the water, then as far from the others alone)
    const dry = (x: number, z: number, r: number) => !lakes || lakeAt(x, z) <= -(r + siteLake);
    const offHome = (x: number, z: number) => Math.hypot(x - centre.x, z - centre.z) >= floorClear + stoneClear + siteGap && Math.hypot(x - treehouse.x, z - treehouse.z) >= TH.clear + stoneClear + siteGap;
    const tests = [(x: number, z: number) => farEnough(x, z) && dry(x, z, stoneClear) && offHome(x, z), (x: number, z: number) => farEnough(x, z) && dry(x, z, tuning.soundsystemFootprint), farEnough];
    for (const sp of specials.values()) {
      let p = ownGround(sp.cell[0], sp.cell[1]);
      // (a claimed challenge circle stays where its claim is, at its area's site: the lines that cross it are cut at its edge, rules/paths.ts)
      if (sp.claimed) p = { x: sp.x, z: sp.z };
      else if (onPath(p.x, p.z, sp.r)) p = nearestOk(p, sp.cell[0], sp.cell[1], (x, z) => !onPath(x, z, sp.r), A * 0.3, 2) ?? p;
      sp.x = p.x; sp.z = p.z;
      placed.push({ x: p.x, z: p.z, r: sp.r + (sp.claimed ? CLAIM_PAD : 0) });
    }
    const short: number[] = []; // (the stones placed by a weaker test: the repair's, below)
    for (const [cx, cy] of cells) {
      if (cx === centreCell[0] && cy === centreCell[1]) continue;
      let p = stoneAlone(cx, cy);
      if (!tests[0](p.x, p.z)) {
        let q: { x: number; z: number } | null = null, i = 0;
        for (; i < tests.length && !q; i++) q = tests[i](p.x, p.z) ? p : nearestOk(p, cx, cy, (x, z) => tests[i](x, z) && !onPath(x, z), A * 0.75);
        if (q) p = q;
        if (!q || i > 1) short.push(placed.length);
      }
      soundSpots.set(cellKey(cx, cy), p);
      placed.push({ x: p.x, z: p.z, r: stoneClear, cell: [cx, cy] });
    }
    // The repair: a stone with no spot in its area keeping every gap makes room by moving a stone near it within that one's own area
    // (to the nearest spots keeping every gap but with it), where that leaves it a spot that does.
    for (const fi of short) {
      const f = placed[fi], [fx, fy] = f.cell!, near = placed.map((q, i) => ({ q, i })).filter(({ q, i }) => i !== fi && q.cell && Math.hypot(q.x - f.x, q.z - f.z) < (stoneClear * 2 + siteGap) * 2).sort((a, b) => Math.hypot(a.q.x - f.x, a.q.z - f.z) - Math.hypot(b.q.x - f.x, b.q.z - f.z));
      let done = false;
      for (const { q, i: qi } of near) {
        const [qx, qy] = q.cell!, was = { x: q.x, z: q.z };
        // (its spots keeping every gap but with f, nearest first)
        const spots: { x: number; z: number }[] = [];
        skip = new Set([qi, fi]);
        for (let d = 4; d < A * 0.75 && spots.length < 24; d += 4) for (let k = 0; k < 16 && spots.length < 24; k++) {
          const a = (k / 16) * Math.PI * 2, x = was.x + Math.cos(a) * d, z = was.z + Math.sin(a) * d;
          if (inCell(x, z, qx, qy) && tests[0](x, z) && !onPath(x, z)) spots.push({ x, z });
        }
        for (const sq of spots) {
          q.x = sq.x; q.z = sq.z;
          skip = new Set([fi]);
          const g = nearestOk(f, fx, fy, (x, z) => tests[0](x, z) && !onPath(x, z), A * 0.75);
          if (g) { f.x = g.x; f.z = g.z; soundSpots.set(cellKey(qx, qy), { x: q.x, z: q.z }); soundSpots.set(cellKey(fx, fy), { x: f.x, z: f.z }); shifted.push(`${cellKey(qx, qy)} for ${cellKey(fx, fy)}`); done = true; break; }
        }
        skip = new Set();
        if (done) break;
        q.x = was.x; q.z = was.z;
      }
      if (!done) (lakes && !dry(f.x, f.z, stoneClear) ? wet : moved).push(`${fx},${fy}`);
    }
    if (moved.length) console.info(`stones: seed ${seed}: ${moved.length} with no spot ${siteGap} m from the other sites (${stoneSpacing} m between stones) in their areas: ${moved.join(", ")}`);
    if (wet.length) console.info(`stones: seed ${seed}: ${wet.length} with no spot whose clearing keeps off the water in their areas: ${wet.join(", ")}`);
    if (shifted.length) console.info(`stones: seed ${seed}: ${shifted.length} moved to make room for another: ${shifted.join(", ")}`);
  };
  const soundsystemSpot = (cx: number, cy: number) => {
    const key = cellKey(cx, cy), had = soundSpots.get(key);
    if (had) return had;
    // (the zoo: its legend lies at its island's middle, so its runestone stands by the south shore, by the street: Ed, 2026-10-26)
    const zi = zooAt?.islands.find(I => I.cell[0] === cx && I.cell[1] === cy);
    if (zi) { const spot = { x: zi.x, z: zi.z + coastAlong(zi, Math.PI / 2) * 0.72 }; soundSpots.set(key, spot); return spot; } // (toward its south shore, the first coast that way: bays as they are)
    if (!sited && !zooAt && playable(cx, cy) && (cx !== centreCell[0] || cy !== centreCell[1])) { placeSites(); const p = soundSpots.get(key); if (p) return p; }
    const spot = stoneAlone(cx, cy); // (an area with no stone: where one would stand)
    soundSpots.set(key, spot);
    return spot;
  };
  const TH = tuning.treehouse, ta = (TH.angle * Math.PI) / 180;
  const treehouse = { x: centre.x + Math.cos(ta) * treehouseDistance(tuning), z: centre.z + Math.sin(ta) * treehouseDistance(tuning) };
  const pieceSpots = new Map<string, { x: number; z: number } | null>();
  const setPieceSpot = (cx: number, cy: number) => (setPieceOf(cx, cy) ? pieceSpotOf(cx, cy) : null);
  // Where a set piece would stand in an area that rolls one, or null if there's no room.
  const pieceSpotOf = (cx: number, cy: number) => {
    const key = cellKey(cx, cy);
    if (pieceSpots.has(key)) return pieceSpots.get(key)!;
    let spot: { x: number; z: number } | null = null;
    if (rollsSetPiece(cx, cy)) {
      const R = tuning.setPieceFootprint * tuning.setPieceScale, gap = tuning.reserveMargin;
      const sounds = [cellKey(cx, cy), ...(neighbours.get(cellKey(cx, cy)) ?? [])].map(k => k.split(",").map(Number)).filter(([x, y]) => playable(x, y)).map(([x, y]) => soundsystemSpot(x, y));
      const clear = (x: number, z: number) => inCell(x, z, cx, cy)
        && sounds.every(p => Math.hypot(x - p.x, z - p.z) >= R + tuning.soundsystemFootprint + gap)
        && Math.hypot(x - centre.x, z - centre.z) >= R + floorClear + gap
        && Math.hypot(x - treehouse.x, z - treehouse.z) >= R + TH.clear + gap
        && live.clearOfStones(x, z, R)
        && !live.map.paths.at(x, z, R);
      // Its old place (a little north of the centre) if that is clear, else the nearest clear
      // spot round it, out past the stone's keep-clear zone.
      const s = siteOf(cx, cy);
      search: for (let d = 0; d <= A * 0.5; d += 3) for (let k = 0; k < (d ? 16 : 1); k++) {
        const a = (k / 16) * Math.PI * 2, x = s.x + Math.cos(a) * d, z = s.z - 4 + Math.sin(a) * d;
        if (clear(x, z)) { spot = { x, z }; break search; }
      }
    }
    pieceSpots.set(key, spot);
    return spot;
  }; live.pieceSpotOf = pieceSpotOf;
  return { ...m, placeSites, soundsystemSpot, TH, treehouse, pieceSpots, setPieceSpot };
}
export type MapSites = ReturnType<typeof siteSpots>;
