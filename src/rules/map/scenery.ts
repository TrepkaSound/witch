// A stage of the forest map's making (rules/map.ts generateMap calls them in order; split from its body: the same sums in the same order).
// The grounds (decor arrangements) and scenes (art/scenes.js) placed in the areas, one featured scene by chance.
import { hash2 } from "../random";
import { sceneFootprint, SCENES } from "./helpers";
import { AREA_TYPES } from "./areaTypes";
import type { MapAssembled } from "./assemble";

/** Grounds and scenes. */
export function groundsAndScenes(m: MapAssembled) {
  const { tuning, seed, centreCell, typeOf, siteOf, cells, inCell, grounds, scenes, reserved, clearOfStones, map } = m;
  // The grounds: some areas (not home) have one, off to the side of the area's centre; its whole
  // clearing keeps clear of everything placed before it (soundsystems, the dancefloor, the
  // treehouse, set pieces, other grounds), turning round the centre to find room, or left out.
  const G = tuning.grounds, usedGrounds = new Set<string>();
  for (const [cx, cy] of cells) {
    if ((cx === centreCell[0] && cy === centreCell[1]) || hash2(cx, cy, seed + 871) >= G.chance) continue;
    // Each kind at most once per map (Ed, v160): the kind it rolled, or the next one not yet used.
    let ki = Math.floor(hash2(cx, cy, seed + 873) * G.kinds.length), tries = 0;
    while (usedGrounds.has(G.kinds[ki]) && tries++ < G.kinds.length) ki = (ki + 1) % G.kinds.length;
    if (usedGrounds.has(G.kinds[ki])) continue;
    const kind = G.kinds[ki], r = G.radius[kind] ?? 8, a = hash2(cx, cy, seed + 875) * Math.PI * 2, site = siteOf(cx, cy);
    search: for (const d of [r + 6, r + 14, r + 24, r + 36, r + 50, r + 66]) for (let k = 0; k < 12; k++) { // (the farther rings: out past the stone's keep-clear zone)
      const b = a + (k / 12) * Math.PI * 2, x = site.x + Math.cos(b) * d, z = site.z + Math.sin(b) * d;
      if (inCell(x, z, cx, cy) && !reserved(x, z, r) && clearOfStones(x, z, r)) { grounds.push({ kind, x, z, r, flip: hash2(cx, cy, seed + 877) < 0.5 }); usedGrounds.add(kind); break search; }
    }
  }
  // Scenes (Ed, 2026-10-04): small vignettes and large landmarks of a few pieces each, each at
  // most once per map, in an area it suits; like a ground, off to the side of the area's centre,
  // its whole footprint clear of everything placed before it and of the paths, mirrored at random.
  const SC = tuning.scenes, usedScenes = new Set<string>();
  const order: [number, number, number][] = [];
  for (const [cx, cy] of cells) if (!(cx === centreCell[0] && cy === centreCell[1])) order.push([cx, cy, hash2(cx, cy, seed + 881)]);
  order.sort((a, b) => a[2] - b[2]);
  const placeScene = (id: string, cx: number, cy: number): boolean => {
    const r = sceneFootprint(id, tuning), a = hash2(cx, cy, seed + 885) * Math.PI * 2, site = siteOf(cx, cy);
    for (const d of [r + 8, r + 16, r + 26, r + 38, r + 52, r + 68]) for (let k = 0; k < 12; k++) { // (the farther rings: out past the stone's keep-clear zone)
      const b = a + (k / 12) * Math.PI * 2, x = site.x + Math.cos(b) * d, z = site.z + Math.sin(b) * d;
      if (inCell(x, z, cx, cy) && !reserved(x, z, r) && clearOfStones(x, z, r) && !map.paths.at(x, z, r * 0.7)) { scenes.push({ id, x, z, r, mirror: hash2(cx, cy, seed + 887) < 0.5 }); usedScenes.add(id); return true; }
    }
    return false;
  };
  // A featured scene, one of its ids (Ed, 2026-10-11: the temple ruins on most islands, the Greek temple or the classical ruins): on a map at its chance, in the first area it suits that has
  // room, else in any area that has room (an island of 10 areas often has none of the types it suits).
  const FS = SC.featured, pool = (FS?.ids ?? []).flatMap(id => (id.endsWith("*") ? SCENES.filter(sc => sc.id.startsWith(id.slice(0, -1))).map(sc => sc.id) : SCENES.some(sc => sc.id === id) ? [id] : [])); // ("temple-*": every scene whose id starts so)
  if (FS && pool.length && hash2(seed, 7, seed + 889) < FS.chance) {
    const fid = pool[Math.floor(hash2(seed, 9, seed + 891) * pool.length)], suits = SCENES.find(sc => sc.id === fid)!.suits ?? [], fit = (c: [number, number, number]) => (suits.includes(AREA_TYPES[typeOf(c[0], c[1])].id) ? 0 : 1);
    for (const [cx, cy] of [...order].sort((p, q) => fit(p) - fit(q) || p[2] - q[2])) if (placeScene(fid, cx, cy)) break;
  }
  for (const [cx, cy, roll] of order) {
    if (roll >= SC.chance) continue;
    const id = AREA_TYPES[typeOf(cx, cy)].id, fits = SCENES.filter(sc => !usedScenes.has(sc.id) && (sc.suits ?? []).includes(id));
    if (!fits.length) continue;
    placeScene(fits[Math.floor(hash2(cx, cy, seed + 883) * fits.length)].id, cx, cy);
  }
  return m;
}
export type MapScenery = ReturnType<typeof groundsAndScenes>;
