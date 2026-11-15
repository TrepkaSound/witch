// A stage of the forest map's making (rules/map.ts generateMap calls them in order; split from its body: the same sums in the same order).
// An island by roster: its areas' kinds from its roster (home's from its world's start and the kinds found), and the areas
// past its playable ones taking the nearest playable area's type.
import { cellKey, assignRoster } from "./helpers";
import { homeRoster, homeIsland, foundKinds, homeKinds, REAL_KINDS } from "../rosters";
import { AREA_TYPES } from "./areaTypes";
import type { MapGrowth } from "./growth";

/** The island's areas' kinds by its roster. */
export function rosterTypes(m: MapGrowth) {
  const { MS, world, homeStart, rosterIsland, shapeSeed, homeBase, centreCell, neighbours, types, siteXZ, growOrder, findExtra, playable, cells, live } = m;
  // (an island by roster: its areas' types from the roster, as few of a kind side by side as the swaps can manage)
  // (the find's extra area, the last grown, apart till the find's area is known: it takes that area's kind, below)
  const extraKey = findExtra && growOrder.length > 1 ? growOrder[growOrder.length - 1] : null;
  live.others = cells.filter(([x, y]) => (x !== centreCell[0] || y !== centreCell[1]) && cellKey(x, y) !== extraKey);
  // (home: its areas' kinds as made here are its world's, not the night's, so its legend areas, land and coast are the same every
  // night for what she's found: the first home.start areas dealt as the world's own starting home, each area past them a kind of its
  // own (the kinds found first, in the order found); tonight's kinds (homeRoster, the night's) are dealt onto them along tonight's
  // route, below, as every island's are)
  let shapeKinds: string[] | null = null;
  if (rosterIsland && rosterIsland.kind !== "home") assignRoster(rosterIsland, live.others, types, neighbours, shapeSeed);
  else if (rosterIsland) {
    const at = new Map(growOrder.map((k, i) => [k, i])), inBase = (x: number, y: number) => (at.get(cellKey(x, y)) ?? Infinity) <= homeBase, extra = live.others.filter(([x, y]) => !inBase(x, y)).sort((a, b) => at.get(cellKey(a[0], a[1]))! - at.get(cellKey(b[0], b[1]))!);
    const base = homeRoster([], shapeSeed, homeStart);
    assignRoster(homeIsland(world, base, homeStart), live.others.filter(([x, y]) => inBase(x, y)), types, neighbours, shapeSeed);
    const more = [...new Set([...foundKinds(MS.found ?? []), ...homeKinds(), ...REAL_KINDS])].filter(k => !base.includes(k) && AREA_TYPES.some(a => a.creature === k));
    extra.forEach((c, i) => { const kind = more[i % more.length]; types.set(cellKey(c[0], c[1]), AREA_TYPES.findIndex(a => a.creature === kind)); });
    shapeKinds = [...base, ...more.slice(0, extra.length)];
  }
  // (an island by roster grows only its roster's species, Ed 2026-10-12: every area past its playable ones, the buffer ring's, the
  // sea's and the lakes', takes the type of the nearest playable area but home's, centre to centre, so its shore is its own forest)
  // (again after the night's deal, below: typeBeyond)
  const typeBeyond = () => {
    const own = live.others.map(([x, y]) => { const s = siteXZ(x, y); return { x: s[0], z: s[1], t: types.get(cellKey(x, y))! }; });
    for (const k of [...types.keys()]) {
      const [cx, cy] = k.split(",").map(Number);
      if (playable(cx, cy) || (cx === centreCell[0] && cy === centreCell[1])) continue;
      const s = siteXZ(cx, cy);
      let best = own[0], bd = Infinity;
      for (const o of own) { const d = (o.x - s[0]) ** 2 + (o.z - s[1]) ** 2; if (d < bd) { bd = d; best = o; } }
      types.set(k, best.t);
    }
  };
  if (rosterIsland && live.others.length) typeBeyond();
  return { ...m, extraKey, shapeKinds, typeBeyond };
}
export type MapRoster = ReturnType<typeof rosterTypes>;
