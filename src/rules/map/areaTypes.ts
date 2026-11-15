// The area types: Ed's first 30 and those added since, from their art (art/areas.js) and the game's own numbers
// (config/area-types.json), and home's look. Split from rules/map.ts (which still exports all of it), so the map's stages
// (rules/map/), the paths and the path geometry can read them without importing the map.
import rawTypes from "../../../config/area-types.json";
import { AREAS, HOME_AREA } from "../../../art/areas.js";
import { CLASSIC_SLOTS, KIND_SLOTS } from "../kinds";

/** An area type: Ed's first 30 and those added since (one a kind: rules/kinds.ts) are defined with their art in
 *  art/areas.js; config/area-types.json adds the game's own numbers. Only plain data is read here. */
export interface AreaType {
  id: string;
  name: string;
  /** The creature's species id (in the art module's bestiary). */
  creature: string;
  /** Ed's columns, in words. */
  text: { floor?: string; wall?: string; small?: string; big?: string; set?: string };
  /** The set piece in words, or "" if the type has none. */
  setPiece: string;
  hasWalls: boolean;
  /** The floor's colour, [hue, saturation, value], for the ground before its tile is drawn. */
  floor: [number, number, number];
  treeDensity: number;
  /** The tufts on its ground (config/area-types.json): density 0-1 and which kinds. */
  groundCover: { density: number; kinds: string[] };
  /** How its vegetation is arranged (art/areas.js AREA_LAYOUTS): pattern, density, clump, undergrowth... */
  layout: AreaLayout;
  /** Its flags (art/areas.js; an area recipe's own): more moonlit ponds; wet ground (streams and boardwalks for paths); steep (stairs may stand). */
  ponds: boolean; wet: boolean; steep: boolean;
  /** Its creature may be another area's too (an area recipe's `sharesCreature`; Ed's rule is a creature of its own for every area). */
  sharesCreature: boolean;
}

export interface AreaLayout {
  pattern: string; along?: number | string; density: number; clump: number; undergrowth: number; lean?: { dir: number; amount: number };
  /** Shares of its trees by height class. */
  heightMix?: { sapling: number; mature: number; tall: number; giant: number } | null;
  /** In an open area (its big objects mostly props), its trees' share of them all (0-1): the props keep their own weights. */
  treeShare?: number;
  /** Its ground's features: stream, pools, rocky, mounds, paths, hollows, ridges. */
  terrain?: string[];
  /** How many decorations it has (rate, 0-1) and of which families. */
  decor?: { rate: number; ruins: number; rocks: number; freak: number; lake: number; modern: number };
  /** Its feel in a line (art/areas.js): the zoo's nameplates show it (render/zooPlates.ts). */
  feel?: string;
}

interface ArtArea { id: string; name: string; creature: string; text: AreaType["text"]; floor: [string, number, number, number]; wall?: unknown[]; set?: unknown; layout?: AreaLayout; ponds?: boolean; wet?: boolean; steep?: boolean; sharesCreature?: boolean; settings?: { treeDensity?: number; groundCover?: { density: number; kinds: string[] } } }
const settings = (rawTypes as { types: Record<string, { treeDensity: number; groundCover?: { density: number; kinds: string[] } }> }).types;
export const AREA_TYPES: readonly AreaType[] = (AREAS as unknown as ArtArea[]).map(a => ({
  id: a.id, name: a.name, creature: a.creature, text: a.text,
  setPiece: a.set ? a.text.set ?? "a set piece" : "", hasWalls: !!a.wall?.length,
  floor: [a.floor[1], a.floor[2], a.floor[3]], treeDensity: settings[a.id]?.treeDensity ?? a.settings?.treeDensity ?? 1, // (an area recipe carries its own settings)
  groundCover: settings[a.id]?.groundCover ?? a.settings?.groundCover ?? { density: 0.5, kinds: ["blades"] },
  layout: a.layout ?? { pattern: "scatter", density: 0.6, clump: 0.3, undergrowth: 0.5 },
  ponds: !!a.ponds, wet: !!a.wet, steep: !!a.steep, sharesCreature: !!a.sharesCreature,
}));
/** Home's look (Ed, 2026-10-05: "its own custom floor; a pleasant green meadow with flowers"; party
 *  decorations instead of trees): its ground and flora are its own (art/areas.js HOME_AREA), not one
 *  of the creature area types; home keeps the type it rolls for the rest (its colour, its sigil). */
export const HOME_LOOK = AREA_TYPES.length;
/** The seed a look's art is drawn from (render/artBuild.ts typeSprites: its trees' variants): the look itself, but home's pinned
 *  (Foxtrot, 2026-10-13: HOME_LOOK is the array's end, so every new area type moved it and redrew home, and the bench's pixel
 *  check went red on every animal PR). 60 is what it was with the 60 area types of 2026-10-13, so nothing changed then. */
export const HOME_SEED = 60;
export const lookSeed = (look: number): number => (look === HOME_LOOK ? HOME_SEED : look);
/** The area types a map without a roster deals (the classic map): the kinds in the table's first 32 slots (rules/kinds.ts
 *  CLASSIC_SLOTS; introduced before phase 3 until the roster moved some to the biomes, Ed, 2026-10-23). The journey's new kinds
 *  (later slots, area recipes added at the end of AREA_TYPES) come only through their islands' rosters, so adding one, or moving
 *  one, leaves every classic map as it was. */
export const CLASSIC_TYPES: readonly number[] = AREA_TYPES.map((a, i) => ((KIND_SLOTS[a.creature] ?? 0) < CLASSIC_SLOTS ? i : -1)).filter(i => i >= 0);
const H_ = HOME_AREA as unknown as ArtArea;
/** How the ground looks, by an area sample's `look`: the area types, then home's meadow. */
export const LOOKS: readonly AreaType[] = [...AREA_TYPES, {
  id: H_.id, name: H_.name, creature: AREA_TYPES[0].creature, text: H_.text, setPiece: "", hasWalls: false,
  floor: [H_.floor[1], H_.floor[2], H_.floor[3]], treeDensity: 0,
  groundCover: settings.home?.groundCover ?? { density: 0.9, kinds: ["blades", "clover"] },
  layout: { pattern: "scatter", density: 0, clump: 0.3, undergrowth: 0 }, ponds: false, wet: false, steep: false, sharesCreature: true,
}];
