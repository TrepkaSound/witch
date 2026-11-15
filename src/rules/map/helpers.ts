// The map's small rules and helpers its stages (rules/map/) share: the treehouse's place, the sites' least gaps, the scenes'
// table, cell keys, which areas touch which, dealing an island's roster, the legend areas' choice. Split from rules/map.ts (which
// still exports what was public), so the stages need not import the map.
import { SCENES as SCENES_RAW, SCENE_BY_ID as SCENE_BY_ID_RAW } from "../../../art/scenes.js";
import { type Cell, type Partition } from "../partition";
import { hash2, rng } from "../random";
import type { Tuning } from "../tuning";
import { speakerRadius } from "../speakers";
import type { Island } from "../rosters";
import { AREA_TYPES } from "./areaTypes";

/** The treehouse's front, where the ley line leaves it: `clear` metres from its foot towards the dancefloor (the oak's Terrace opens
 *  that way: Ed, 2026-10-24; due south while it stood due north). */
export const frontOf = (t: { x: number; z: number }, d: { x: number; z: number }, clear: number) => { const L = Math.hypot(d.x - t.x, d.z - t.z) || 1; return { x: t.x + ((d.x - t.x) / L) * clear, z: t.z + ((d.z - t.z) / L) * clear }; };
/** How far the treehouse's foot stands from the dancefloor's middle (Ed, 2026-10-05: "5m due north of
 *  the dance floor, outside the speaker ring"; north-west since Ed, 2026-10-24, treehouse.angle, and its gap the
 *  tuning's): past the ring's outer edge by gap, plus its footprint. */
export const treehouseDistance = (t: Tuning) => speakerRadius(t) + t.dancefloor.speakers.footprint + t.treehouse.gap + t.treehouse.clear;

/** How far past the challenge circle's clearing (m) its area's claim reaches: the woods' edge round it its own too. */
export const CLAIM_PAD = 4;
/** The sites' least gaps (Ed, 2026-11-04: "minimum distance between sites/circles/dancefloor/treehouse of 50m, tunable. 10m from a
 *  lake edge. If this can't fit, increase area sizes."): stoneClear, a stone's clearing (m: the great stump's roots' ground, or a
 *  runestone's soundsystem's with its margin); siteGap, the least gap edge to edge between any two sites' footprints (stones'
 *  clearings, legends' circles, the challenge's claim or the find's clearing, home's dancefloor clearing and treehouse); lakeGap,
 *  each footprint's from a lake's water; stoneSpacing, so two stones' middles (Ed's "Min 40 m between stumps" of 2026-11-03,
 *  folded in: 84 m now). */
export function siteRules(t: Tuning): { stoneClear: number; siteGap: number; lakeGap: number; stoneSpacing: number } {
  const SM = t.runeMarkers?.stump, stoneClear = SM?.on ? SM.clear : t.soundsystemFootprint + t.treeMarginFromSoundsystem + 4, siteGap = t.siteGap ?? 0;
  return { stoneClear, siteGap, lakeGap: t.siteLakeGap ?? 0, stoneSpacing: 2 * stoneClear + siteGap };
}
/** How far round every stump nothing is grown into its fight (m; Ed, 2026-11-06: berries outside the stump's fight zone; "Mushrooms
 *  shouldn't grow on berry patches, paths, stump fight areas, etc."): the stump's fighting arena's whole extent, arena.radius +
 *  arena.band (both times fight.scale, as arenaOpen has them), plus berries.stumpClear metres (0: the arena's edge; below 0 lets
 *  bushes and mushrooms into its outer band). Measured from the stump (soundsystemSpot: stoneGap), not the area's middle; no berry
 *  bush (rules/berries.ts) or mushroom (rules/mushrooms.ts) grows nearer any stump than this. Never less than nothing: the stump's
 *  roots clearing (hardClear) is kept anyway. */
export function stumpClearance(t: Tuning): number {
  const R = t.arena, arena = R && R.radius > 0 ? (R.radius + R.band) * (t.fight?.scale ?? 1) : 0;
  return Math.max(0, arena + (t.berries?.stumpClear ?? 0));
}
/** A claimed map's neighbours as the partition first cut them (by the map's neighbours), for its prep (prepOf: the island grows
 *  from those, the claim made again from them). */
export const BASE_NEIGHBOURS = new WeakMap<object, [string, string[]][]>();

type SceneDef = { id: string; size: string; suits?: string[]; pieces: [string, number, number, string?][] };
export const SCENES = SCENES_RAW as unknown as SceneDef[], SCENE_BY_ID = SCENE_BY_ID_RAW as unknown as Record<string, SceneDef>;

export const cellKey = (cx: number, cy: number) => cx + "," + cy;
/** The land map's samples (m apart; rules/land.ts). */
export const LAND_STEP = 4;

/** Which areas touch which, found by sampling the partition finely over the cells given. */
export function findNeighbours(p: Partition, lo: number, hi: number, perCell: number): Map<string, Set<string>> {
  const nb = new Map<string, Set<string>>();
  const link = (a: Cell, b: Cell) => {
    if (a[0] === b[0] && a[1] === b[1]) return;
    const ka = cellKey(a[0], a[1]), kb = cellKey(b[0], b[1]);
    if (!nb.has(ka)) nb.set(ka, new Set());
    if (!nb.has(kb)) nb.set(kb, new Set());
    nb.get(ka)!.add(kb); nb.get(kb)!.add(ka);
  };
  const steps = (hi - lo) * perCell;
  let prevRow: Cell[] = [];
  for (let j = 0; j <= steps; j++) {
    const row: Cell[] = [];
    for (let i = 0; i <= steps; i++) {
      const c = p.partition(lo + i / perCell, lo + j / perCell);
      row.push(c);
      if (i > 0) link(c, row[i - 1]);
      if (j > 0) link(c, prevRow[i]);
    }
    prevRow = row;
  }
  return nb;
}


/** A scene's footprint radius (metres), from its pieces' authored offsets: a little more than the
 *  art's own (sceneLayout's footprint, which a test checks it covers), without drawing anything. */
export function sceneFootprint(id: string, tuning: Tuning): number {
  const sc = SCENE_BY_ID[id];
  if (!sc) return 0;
  return Math.max(...sc.pieces.map(([, x, z]) => Math.hypot(x, z))) * tuning.scenes.scale + tuning.scenes.pad;
}

/** Which areas have a sleeping legend (Ed, 2026-10-06: "Legends should only appear in about half of
 *  areas (we can test this ratio); every area makes them too common"): share of the areas but home,
 *  rounded, in a seeded order, spread so they don't clump: first only areas that keep every run of
 *  neighbouring legend areas to two at most; then (an area has about six neighbours, so half can't
 *  all be kept that apart) ones that leave no legend area bordering more than two others; then
 *  any left over, those with the fewest legend neighbours first. */
export function chooseLegendCells(cells: readonly Cell[], home: Cell, neighbours: ReadonlyMap<string, ReadonlySet<string>>, share: number, seed: number): Set<string> {
  const all: { key: string; h: number }[] = [];
  for (const [cx, cy] of cells) if (cx !== home[0] || cy !== home[1]) all.push({ key: cellKey(cx, cy), h: hash2(cx, cy, seed + 901) });
  const want = Math.max(0, Math.min(all.length, Math.round(Math.max(0, Math.min(1, share)) * all.length)));
  const chosen = new Set<string>();
  if (want >= all.length) { for (const a of all) chosen.add(a.key); return chosen; }
  all.sort((a, b) => a.h - b.h);
  const near = (k: string) => [...(neighbours.get(k) ?? [])].filter(x => chosen.has(x));
  // (taking k keeps every clump at two or fewer: k has at most one chosen neighbour, and that one has no other)
  const spread = (k: string) => { const c = near(k); return c.length === 0 || (c.length === 1 && near(c[0]).length === 0); };
  for (const a of all) { if (chosen.size >= want) break; if (spread(a.key)) chosen.add(a.key); }
  // (then: no legend area bordering more than two others)
  const thin = (k: string) => { const c = near(k); return c.length <= 2 && c.every(x => near(x).length < 2); };
  for (const a of all) { if (chosen.size >= want) break; if (!chosen.has(a.key) && thin(a.key)) chosen.add(a.key); }
  while (chosen.size < want) {
    let best: string | null = null, bn = Infinity;
    for (const a of all) if (!chosen.has(a.key)) { const c = near(a.key).length; if (c < bn) { bn = c; best = a.key; } }
    chosen.add(best!);
  }
  return chosen;
}

/** Give an island's areas their types from its roster (Ed, 2026-10-11; rules/rosters.ts): each kind's count of areas, dealt
 *  in a seeded order, then swapped about to keep two of a kind from touching where it can. */
export function assignRoster(island: Island, cells: readonly Cell[], types: Map<string, number>, neighbours: ReadonlyMap<string, ReadonlySet<string>>, seed: number, skip = 0): void {
  const typeOfKind = (k: string) => AREA_TYPES.findIndex(a => a.creature === k);
  const deck: number[] = [];
  for (const { kind, areas } of island.roster) for (let i = 0; i < areas; i++) deck.push(typeOfKind(kind));
  // (`skip`: one of each kind dealt already elsewhere, so the deck is the rest)
  for (const { kind } of skip ? island.roster.slice(0, skip) : []) deck.splice(deck.indexOf(typeOfKind(kind)), 1);
  if (!deck.length || !cells.length) return;
  const keys = cells.map(([x, y]) => cellKey(x, y)), r = rng(seed * 7 + 13);
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  keys.forEach((k, i) => types.set(k, deck[i % deck.length]));
  const clash = (k: string, t: number) => { let c = 0; for (const o of neighbours.get(k) ?? []) if (types.get(o) === t && keys.includes(o)) c++; return c; };
  for (let pass = 0; pass < 6; pass++) {
    let moved = false;
    for (const a of keys) {
      const ta = types.get(a)!;
      if (!clash(a, ta)) continue;
      for (const b of keys) {
        const tb = types.get(b)!;
        if (tb === ta) continue;
        const before = clash(a, ta) + clash(b, tb);
        types.set(a, tb); types.set(b, ta);
        const after = clash(a, tb) + clash(b, ta);
        if (after < before) { moved = true; break; }
        types.set(a, ta); types.set(b, tb);
      }
    }
    if (!moved) break;
  }
}
