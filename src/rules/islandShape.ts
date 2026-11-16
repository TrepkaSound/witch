// An island's coastline by its kind (the wave 2 finale: each woken legend dreams of its home island, "the same picture that
// lights up on the sea chart", docs/backlog/journey.md): the shape the map builds an island with, its round radius times the
// coast (rules/mapShape.ts makeCoast, the map's own `map.coast` knobs) at each angle, seeded by the island, sized by its phase.
// Drawn by art/islands.js (islandPixels for a dream bubble, islandPath for the sea chart).
import { islandLand } from "./map";
import type { Island } from "./rosters";
import type { Tuning } from "./tuning";

export { islandSeed, islandAreas, HOME_AREAS, islandCoast, type IslandSpec } from "./islandCoast";

/** An island's real outline (Ed, 2026-10-11, the journey's irregular islands: the shape the map grows it to, rules/islandGrowth.ts
 *  and rules/land.ts, for the sea chart and the dreams): its coast's loops (x, z interleaved, metres from home's middle; `sea` the
 *  sea's coast, else a lake's shore), the box round them, how far its furthest coast lies from home, and its areas' size. Exact,
 *  so not cheap (on a laptop about 0.1 s for a phase 1 island to 2 s for a phase 5 one, its land sampled every `step` metres):
 *  made once per island and remembered; for a whole chart, worth making off the main thread or as islands come into view. */
export interface IslandOutline { loops: { pts: Float32Array; sea: boolean }[]; box: { minX: number; maxX: number; minZ: number; maxZ: number }; far: number; areaSize: number }
const outlines = new Map<string, IslandOutline>();
export function islandOutline(island: Island, tuning: Tuning, step = 16): IslandOutline {
  const key = `${island.kind}|${island.seed}|${island.size}|${island.phase}|${step}|${island.patch ? island.patch[0] : ""}|${island.turn ?? 0}`;
  const had = outlines.get(key);
  if (had) return had;
  const { land, lakes, home, areaSize } = islandLand(island, tuning, step);
  let far = 0;
  const loops = land.loops.map(l => {
    const pts = new Float32Array(l.pts.length);
    for (let i = 0; i < pts.length; i += 2) { pts[i] = l.pts[i] - home.x; pts[i + 1] = l.pts[i + 1] - home.z; if (l.sea) far = Math.max(far, Math.hypot(pts[i], pts[i + 1])); }
    return { pts, sea: l.sea };
  });
  // (its lakes' shores, from their own map (rules/lakes.ts): each loop round a lake's water, turned so the land's on its left)
  for (const l of lakes?.loops ?? []) {
    if (!l.sea) continue; // (an islet in a lake)
    const n = l.pts.length / 2, pts = new Float32Array(l.pts.length);
    for (let i = 0; i < n; i++) { const j = n - 1 - i; pts[i * 2] = l.pts[j * 2] - home.x; pts[i * 2 + 1] = l.pts[j * 2 + 1] - home.z; }
    loops.push({ pts, sea: false });
  }
  const b = land.box, out = { loops, box: { minX: b.minX - home.x, maxX: b.maxX - home.x, minZ: b.minZ - home.z, maxZ: b.maxZ - home.z }, far, areaSize };
  outlines.set(key, out);
  return out;
}
