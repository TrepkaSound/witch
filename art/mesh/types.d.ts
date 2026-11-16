// Types for the mesh creatures' code (art/mesh/), for the art type check (tsconfig.art.json, `npm run typecheck:art`; the how-to
// is in docs/notes/creatures.md, **Writing a mesh creature**, and docs/notes/art-checks.md, **Type-checking the art**). Types only:
// no code here, and nothing at run time reads this file. The art's JavaScript names them in JSDoc comments, e.g.
//   /** @type {import("../types").Ring[]} */
//   /** @satisfies {import("../types").MeshSpecies} */
// The model (art/mesh/shape.js): metres, y up, its head along +z.

/** A point or a direction, [x, y, z]. Plain `number[]` and not a tuple, so `c.map(...)` and spreads stay points. */
export type Vec3 = number[];

/** A colour: a hex string ("#a8643a"), [r, g, b] 0 to 255, or a ring's colour by where on the ring a facet is (art/mesh/shape.js
 *  `loft`: (cos, sin, frac) of its angle from the top) or a dome's by its row (art/mesh/kit/dome.js). */
export type Colour = string | number[] | ((a?: number, b?: number, c?: number, d?: number) => string | number[]);

/** One ring of a loft: an ellipse rx across and ry along `up`, square to the path, riding one bone (art/mesh/shape.js `loft`). */
export interface Ring {
  at: Vec3;
  rx: number;
  ry: number;
  /** The bone it rides: a name in the plan's bones. */
  bone: string;
  colour?: Colour;
  /** Drawn unlit (fox-fire, a lit eye). */
  glow?: boolean;
  /** Which way its ry points (the loft's `up` if not given). */
  up?: Vec3;
  /** Where its first corner sits, a share of a side (0.5: a flat on top). */
  turn?: number;
  /** What its faces are, where the game needs to know ("eye"). */
  tag?: string;
  /** No coat texture on it. */
  plain?: boolean;
}

/** A tube: rings along a path joined into facets, `sides` corners each (art/mesh/shape.js `loft`). */
export interface Loft {
  /** A name armour can find it by (`Armour.on`). */
  name?: string;
  sides?: number;
  up?: Vec3;
  rings: Ring[];
}

/** A cone from a base ring at `at` to a point at `tip`: an ear, a tuft, a claw, a spine (art/mesh/shape.js `cone`). */
export interface Cone {
  at: Vec3;
  rx: number;
  ry: number;
  tip: Vec3;
  bone: string;
  colour?: Colour;
  /** Its tip's colour (its base's if not given). */
  tipColour?: Colour;
  /** true: all of it lit; "tip": only its outer half. */
  glow?: boolean | "tip";
  up?: Vec3;
  sides?: number;
  tag?: string;
  /** How far along it its middle ring is (0.6). */
  split?: number;
  /** How full its middle is kept (a leaf, a lock of fur), and which way the middle is pushed (it curves). */
  bulge?: number;
  bend?: Vec3;
  turn?: number;
}

/** A bone: its name, where its joint is, and its parent's name (none for the root). Parents come before their children. */
export type Bone = [name: string, at: Vec3, parent?: string | null];

/** What every kit part returns (art/mesh/kit/<part>.js), and what plan.js joins. A part may hand back more beside them (a chain
 *  of tail bones, a point to hang things on). */
export interface Pieces {
  bones: Bone[];
  lofts: Loft[];
  cones: Cone[];
  /** What else the part hands back (`@satisfies` keeps each one's own type). */
  [more: string]: unknown;
}

/** A head's ears (art/mesh/kit/head.js, where every field is described). */
export interface Ear {
  shape?: "point" | "round" | "long";
  tall?: number;
  wide?: number;
  /** Moved from a fox's: [out, up, forward]. */
  at?: Vec3;
  lean?: number;
  splay?: number;
  back?: Colour;
  tip?: Colour;
  inner?: Colour;
  /** That side's ear (-1 or 1) bitten short and split. */
  torn?: number;
}

/** A bone moved by its own clock through a cycle (u 0 to 1), on top of the gait's: a gait's `extra` (art/mesh/shape.js `motion`). */
export interface Motion {
  bone: string;
  pos?: (u: number) => Vec3;
  rot?: (u: number) => Vec3;
}

/** A torso (art/mesh/kit/torso.js): its bones, and its skin's rings from rump to neck, which the head's rings carry on. */
export interface Body {
  bones: Bone[];
  rings: Ring[];
  [more: string]: unknown;
}

/** A head (art/mesh/kit/head.js): its pieces, its rings (joined to the torso's into one skin) and its ears' bones. */
export interface Skull extends Pieces {
  rings: Ring[];
  ears?: string[];
}

/** A patch of a loft's skin raised into plate (art/mesh/shape.js `armour`, where every field is described). */
export interface Armour {
  on?: number | string;
  from?: number;
  to?: number;
  round?: number[];
  side?: number;
  thick?: number;
  step?: number;
  lames?: number;
  colour?: Colour;
  rim?: Colour;
  inset?: number;
  gap?: number;
  flare?: number;
  glow?: boolean;
  runes?: { colour?: Colour; round?: number[]; size?: number; every?: number; seed?: number; w?: number; max?: number };
}

/** One leg's timing in a pace (art/mesh/kit/gaits.js): its three upper bones, and where in the cycle its paw comes down. */
export interface LegTiming {
  bones: string[];
  phase: number;
}

/** How a plan gets about (art/mesh/kit/gaits.js and art/mesh/shape.js `motion`, `strides`, where the numbers are described).
 *  Open-ended: a kind's own file adds what its animal needs (a hydra's strike, a hare's sit, a snail's way of sleeping). */
export interface Gait {
  /** art/mesh/shape.js GAIT_TYPES: "walk", "trot", "bound", "glide" or "fly". */
  type?: string;
  seconds?: number;
  legs?: LegTiming[];
  paces?: Record<string, any>;
  tails?: string[][];
  root?: string;
  extra?: Motion[];
  /** How it sleeps, if not as a legend curls and the rest lie on their bellies (art/mesh/gear.js `napping`). */
  sleep?: string;
  curl?: Record<string, number>;
  [more: string]: any;
}

/** A whole creature at one level, as art/mesh/shape.js `shape` builds it (art/mesh/kit/plan.js makes one from parts). */
export interface Plan {
  name: string;
  bones: Bone[];
  lofts: Loft[];
  cones?: Cone[];
  armour?: Armour[];
  gait?: Gait;
  /** Where party gear goes (art/mesh/gear.js). */
  anchors?: { neck: number; skull: number };
  /** How high it floats (a flyer). */
  hover?: number;
  /** Every tube of six sides or more gets this many times as many. */
  fine?: number;
  /** A still pose instead of a walk. */
  still?: any;
}

/** What a species' file exports as MESH (art/mesh/species/<id>.js; art/mesh/plans.js reads them all through species/index.js). */
export interface MeshSpecies {
  id: string;
  /** How tall it stands at each level, baby to legend, in art pixels (`node tools/creature-mesh/sizes.mjs <kind>`). */
  heights: [number, number, number, number];
  /** How it is known to go (art/mesh/shape.js GAIT_TYPES); src/render/meshCreatures.test.ts holds it to its plans. */
  gait: "walk" | "trot" | "bound" | "glide" | "fly";
  /** How many legs it has at each level, if not four (src/render/meshCreatures.test.ts). */
  legs?: number[];
  /** How it curls up to sleep, given to each of its plans as gait.curl (art/mesh/gear.js `napping`). */
  curl?: Record<string, number>;
  /** Its four plans, each a function that builds it afresh. */
  plans: { baby: () => Plan; young: () => Plan; adult: () => Plan; legend: () => Plan };
}
