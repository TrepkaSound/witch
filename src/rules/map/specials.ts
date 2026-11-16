// A stage of the forest map's making (rules/map.ts generateMap calls them in order; split from its body: the same sums in the same order).
// Tonight's find in an area of its own and the challenge area (Ed, 2026-11-03), chosen once the island's shape is made; the
// island's extra area taking the find's kind; the areas past the playable ones typed again.
import { cellKey, CLAIM_PAD, BASE_NEIGHBOURS } from "./helpers";
import type { Cell, Claim } from "../partition";
import { hash2 } from "../random";
import { AREA_TYPES } from "./areaTypes";
import { challengeCircle } from "../challengeCircle";
import { lakeDepth } from "../lakes";
import type { Bounds } from "../mapShape";
import { placeChallenge } from "../challengePlace";
import type { MapLand } from "./land";

/** The special sites: the find's area and the challenge circle. */
export function specialSites(m: MapLand) {
  const { tuning, A, stoneClear, siteGap, siteLake, MS, rosterIsland, seed, toPart, centreCell, basePartition, partition, lo, neighbours, types, typeOf, siteOf, centre, lakeCells, findOn, specials, cells, extraKey, typeBeyond, legendAreas, landCells, land, lakes, live } = m;
  // Tonight's find in an area of its own (Ed, 2026-11-03: "Each non-lake area has a stump site or a special site (find and challenge
  // areas)"; earlier, "We can also have finds be at the site of their own area rather than in a random place, and then the path
  // network can lead you to them"): one of the island's areas, seeded by the night as the trunk's area was (rules/finds.ts), never
  // home or an area touching it (Ed, 2026-11-03: "The challenge area shouldn't be adjacent to the home area": the find's area is
  // the challenge area's forerunner; an island with none such: its area farthest from home, logged), nor a legend area's pair,
  // nor one whose going would cut the island's playable areas in two, holds the find at its site and is no longer playable: no stone, wave, ley-line stop or creatures of its own (as a
  // legend area). Chosen once the island's shape is made, so its land and coast are the same every night; the island's extra area
  // (above) takes its kind, so tonight's areas and their kinds are the roster's still.
  if (findOn && cells.length > 2) {
    const pairs = new Set(legendAreas.values()), s0 = seed + 8117, homeKey = cellKey(centreCell[0], centreCell[1]);
    const keys = new Set(cells.map(([x, y]) => cellKey(x, y)));
    const joinedIn = (nb: ReadonlyMap<string, ReadonlySet<string>>, k: string) => { const seen = new Set([homeKey, k]), todo = [homeKey]; while (todo.length) for (const q of nb.get(todo.pop()!) ?? []) if (keys.has(q) && !seen.has(q)) { seen.add(q); todo.push(q); } return seen.size === keys.size; };
    const byHome = neighbours.get(homeKey), ok = ([x, y]: Cell) => !pairs.has(cellKey(x, y)) && joinedIn(neighbours, cellKey(x, y));
    const cand = cells.filter(([x, y]) => cellKey(x, y) !== homeKey && !byHome?.has(cellKey(x, y))).sort((a, c) => hash2(a[0], a[1], s0) - hash2(c[0], c[1], s0));
    // (the challenge area, tuning challenge, rules/challenge.ts: its clearing the stone circle and a narrow margin past it, its
    // columns at the circle's edge; Ed, 2026-11-03: "trees should come close to the circle's edge"; the circle sized by the roster,
    // a column a kind: rules/challengeCircle.ts)
    const kinds = rosterIsland ? new Set(rosterIsland.roster.map(q => q.kind)).size : new Set(cells.filter(([x, y]) => cellKey(x, y) !== homeKey).map(([x, y]) => AREA_TYPES[typeOf(x, y)]?.creature)).size;
    const CH = tuning.challenge?.on ? challengeCircle(kinds, tuning) : null, clearR = CH ? Math.max(tuning.findArea!.clear, CH.radius + CH.margin) : tuning.findArea!.clear;
    // The challenge area big enough for its circle (Ed, 2026-11-03: "the area will have to be big to fit a huge circle"): it claims
    // the whole circle and its margin (and CLAIM_PAD more, its woods' edge), every point of it its own ground (rules/partition.ts
    // claimable), taken from the areas round it. Only where that keeps every promise the map makes: the circle wholly on the
    // island's playable ground (never home's, a legend area's, a lake's or the buffer's, so the land, coast and lakes made above
    // are the same every night), every area it takes from left most of its ground, not touching home's afterwards and the island
    // still one piece, and each area it takes from keeping ground siteGap past its claim for its stone's clearing (placeSites moves a
    // stone there if it must). The seeded candidates tried in turn (so it still moves night to night); none fits, the area as before
    // (its circle over its neighbours' ground), logged.
    const fitClaim = ([fx, fy]: Cell) => {
      const k = cellKey(fx, fy), site = siteOf(fx, fy), rc = clearR + CLAIM_PAD, gap = CLAIM_PAD + stoneClear + siteGap; // (a stone's middle from the circle's clearing: the claim's edge, a stone's clearing and siteGap)
      const [u0, v0] = toPart(site.x, site.z);
      let rp = 0;
      for (let i = 0; i < 48; i++) { const a = (i / 48) * Math.PI * 2, [u, v] = toPart(site.x + Math.cos(a) * rc, site.z + Math.sin(a) * rc); rp = Math.max(rp, Math.hypot(u - u0, v - v0)); }
      rp *= 1.02;
      // (its ground the island's: a playable area's, or an inland buffer area's, never home's, a legend area's or a lake's; and, as
      // everything placed for play, the buffer's depth from the sea)
      const allowed = (c: string) => c === k || (c !== homeKey && !legendAreas.has(c) && !lakeCells.has(c) && (keys.has(c) || landCells.has(c)));
      const touched = new Set<string>([k]), deep = MS.buffer * A * 0.85;
      // (the circle's ground, finely, in metres: each point of it the claim takes, an allowed area's and inland)
      for (let dx = -rc * 1.3; dx <= rc * 1.3; dx += 4) for (let dz = -rc * 1.3; dz <= rc * 1.3; dz += 4) {
        const [u, v] = toPart(site.x + dx, site.z + dz);
        if ((u - u0) ** 2 + (v - v0) ** 2 >= rp * rp) continue;
        const c = basePartition.partition(u, v), ck = cellKey(c[0], c[1]);
        if (!allowed(ck) || (land && land.distAt(site.x + dx, site.z + dz) < deep)) return null;
        if (lakes && lakeDepth({ lakes } as Bounds, site.x + dx, site.z + dz) > -siteLake) return null; // (and siteLakeGap off a lake's water)
        touched.add(ck);
      }
      // (which areas touch which, afresh round it: findNeighbours' own samples, over a box holding every touched area's ground whole)
      const per = 6;
      for (let M = 2; M <= 4; M++) {
        const i0 = Math.floor((u0 - rp - M - lo) * per), i1 = Math.ceil((u0 + rp + M - lo) * per), j0 = Math.floor((v0 - rp - M - lo) * per), j1 = Math.ceil((v0 + rp + M - lo) * per);
        const w = i1 - i0 + 1, at: string[] = new Array(w * (j1 - j0 + 1)), was = new Map<string, number>(), now = new Map<string, number>(), far = new Set<string>();
        let edge = false;
        const farP = ((clearR + gap + 6) / A) * 1.1;
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const pu = lo + i / per, pv = lo + j / per, b = basePartition.partition(pu, pv), bk = cellKey(b[0], b[1]), d = Math.hypot(pu - u0, pv - v0), ck = d < rp ? k : bk;
          if (d < rp && !allowed(bk)) return null;
          if (d < rp) touched.add(bk);
          at[(j - j0) * w + (i - i0)] = ck;
          was.set(bk, (was.get(bk) ?? 0) + 1); now.set(ck, (now.get(ck) ?? 0) + 1);
          if (d >= farP) far.add(ck);
          if ((i === i0 || i === i1 || j === j0 || j === j1) && touched.has(bk)) edge = true;
        }
        if (edge) continue; // (a touched area's ground reaches the box's edge: a bigger box)
        // (a playable area it takes from keeps most of its ground, and ground for its stone far enough out; a buffer area, whatever)
        for (const t of touched) if (t !== k && keys.has(t) && ((now.get(t) ?? 0) < Math.max(4, 0.4 * (was.get(t) ?? 0)) || !far.has(t))) return null;
        // The neighbours afterwards: every touched area's links dropped, then those its samples in the box make again.
        const nb = new Map(neighbours), own = (q: string) => { const set = new Set(nb.get(q) ?? []); nb.set(q, set); return set; };
        for (const t of touched) { for (const q of neighbours.get(t) ?? []) own(q).delete(t); own(t).clear(); }
        const link = (a: string, b: string) => { if (a === b || (!touched.has(a) && !touched.has(b))) return; own(a).add(b); own(b).add(a); };
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const q = at[(j - j0) * w + (i - i0)]; if (i > i0) link(q, at[(j - j0) * w + (i - i0 - 1)]); if (j > j0) link(q, at[(j - j0 - 1) * w + (i - i0)]); }
        if (nb.get(homeKey)?.has(k) || !joinedIn(nb, k)) return null;
        return { claim: { cell: [fx, fy] as Cell, u: u0, v: v0, r: rp } satisfies Claim, nb };
      }
      return null;
    };
    // Where the challenge area goes (Ed, 2026-11-04: "The route should avoid going through the challenge area"; "ideally it should
    // be on the edge, and far from the home area"; rules/challengePlace.ts): the candidates each asked, on the island's edge (the
    // buffer ring past it)? clear of the route (every line between two of its neighbours round its circle)? in the island's outer
    // half? those answering yes to more first, in that order, the night's seeded order among equals. One that misses any is logged.
    const placed = CH ? placeChallenge(cand.filter(ok).map(([x, y]) => cellKey(x, y)), { home: homeKey, playable: keys, neighbours, lakes: lakeCells, legends: new Set(legendAreas.keys()), site: q => { const [x, y] = q.split(",").map(Number); return siteOf(x, y); }, clear: clearR }) : null;
    if (placed) { const of = new Map(cand.map(c => [cellKey(c[0], c[1]), c])); cand.splice(0, cand.length, ...placed.map(q => of.get(q.key)!)); }
    let at: Cell | undefined, fit: ReturnType<typeof fitClaim> = null;
    if (CH) for (const c of cand) if (ok(c) && (fit = fitClaim(c))) { at = c; break; }
    if (!at) at = cand.find(ok);
    const how = at && placed?.find(q => q.key === cellKey(at![0], at![1]));
    if (how && !(how.edge && how.clear && how.far)) console.info(`challenge area: seed ${seed}: ${how.key}, not ${[how.edge ? "" : "on the edge", how.clear ? "" : "clear of the route", how.far ? "" : "far from home"].filter(Boolean).join(", ")} (no area that is holds its circle)`);
    if (!at) {
      const far = cells.filter(([x, y]) => cellKey(x, y) !== homeKey).map(c => ({ c, d: Math.hypot(siteOf(c[0], c[1]).x - centre.x, siteOf(c[0], c[1]).z - centre.z) })).sort((a, b) => b.d - a.d).map(o => o.c);
      at = far.find(ok) ?? far[0];
      if (at) console.info(`find area: seed ${seed}: no area clear of home's neighbours; the farthest from home, ${cellKey(at[0], at[1])}`);
      if (at && CH) fit = fitClaim(at);
    }
    if (at) {
      const [fx, fy] = at, k = cellKey(fx, fy), site = siteOf(fx, fy);
      specials.set(k, { kind: CH ? "challenge" : "find", cell: [fx, fy], x: site.x, z: site.z, r: clearR, ...(CH ? { radius: CH.radius, claimed: !!fit } : {}) });
      if (CH && !fit) console.info(`challenge area: seed ${seed}: no area holds its ${CH.radius.toFixed(0)} m circle whole; ${k}, its circle over its neighbours' ground`);
      if (fit) {
        // (its claim set, and which areas touch which made again round it; the partition as cut kept for a map's prep, MapPrep)
        BASE_NEIGHBOURS.set(neighbours, [...neighbours].map(([q, v]): [string, string[]] => [q, [...v]]));
        partition.claim = fit.claim;
        neighbours.clear();
        for (const [q, v] of fit.nb) neighbours.set(q, v as Set<string>);
      }
      if (extraKey && extraKey !== k && types.has(k)) types.set(extraKey, types.get(k)!);
      cells.splice(cells.findIndex(([x, y]) => x === fx && y === fy), 1);
    }
  }
  if (extraKey && !specials.size && live.others.length) { const [x, y] = live.others[0]; types.set(extraKey, types.get(cellKey(x, y))!); } // (no find's area after all: the extra a kind of the roster's)
  live.others = cells.filter(([x, y]) => x !== centreCell[0] || y !== centreCell[1]);
  // The challenge area themed on the island's own animal (Ed, 2026-11-03: "Its type is themed of the island's animal (e.g. the squirrel
  // map's challenge areas have squirrel area trees)"): its trees and ground its kind's area type's, whatever area it replaced (the
  // island's extra area takes that one's kind, so the roster's kinds are all still dealt). Home has no one animal: its challenge area
  // keeps the woods of its nearest area, as the find's area did.
  // (the challenge area's site, if any: its clearing kept whole and its woods close, hardCell and treeWeight below)
  const challengeAt = [...specials.values()].find(sp => sp.kind === "challenge") ?? null;
  const ownType = rosterIsland && rosterIsland.kind !== "home" ? AREA_TYPES.findIndex(a => a.creature === rosterIsland.kind) : -1;
  const themeSpecials = () => { if (ownType >= 0) for (const [k, sp] of specials) if (sp.kind === "challenge") types.set(k, ownType); };
  if (rosterIsland && live.others.length && (specials.size || extraKey)) { typeBeyond(); for (const [k, p] of legendAreas) types.set(k, types.get(p)!); themeSpecials(); }
  return { ...m, challengeAt, themeSpecials };
}
export type MapSpecials = ReturnType<typeof specialSites>;
