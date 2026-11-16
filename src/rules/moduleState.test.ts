// Hidden state moved onto the game (quality plan item d, Ed's go 2026-11-15; docs/notes/module-state.md): each of these was a
// page-wide variable or table, so a saved night, a second game in the same page or a test after another read what it shouldn't.
import { describe, expect, it } from "vitest";
import type { Creature } from "./creatures";
import { walkFriendlyRoute } from "./combat/legend";
import { scaled, type Attack } from "./combat/data";
import { FIGHT } from "./movement";
import { newGame, stepGame, STEP, type Controls, type Game } from "./game";
import { restoreGame, snapshotGame } from "./nightSnapshot";
import { TUNING, type Tuning } from "./tuning";
import { ownedMemo } from "./ownedMemo";
import { preppedGame } from "../test/preppedGame";

const idle: Controls = { moveX: 0, moveZ: 0, toggleMode: false, zoom: 0 };
const roundtrip = (g: Game) => restoreGame(JSON.parse(JSON.stringify(snapshotGame(g))));

describe("a friendly legend's walk along the route is its own, kept with the night", () => {
  // A route crossing itself at (10, 0): its first leg east, and its last leg south through the same point.
  const route = [[0, 0], [20, 0], [20, 20], [10, 20], [10, -10]] as const;
  const legend = () => ({ id: 0, species: "toad", level: 3, x: 10, z: 20, speed: 10, walk: 0, gone: false, leashed: false }) as unknown as Creature;

  it("a saved and loaded legend at the crossing walks on down its last leg, as the one never saved does", () => {
    const c = legend();
    walkFriendlyRoute(c, route, Infinity, 2, 10, undefined, 7); // (joined at 50 m, walked 20: at the crossing, 70 m along)
    expect([c.x, c.z]).toEqual([10, 0]);
    const loaded = JSON.parse(JSON.stringify(c)) as Creature; // (as a saved night holds it)
    walkFriendlyRoute(c, route, Infinity, 0.5, 10, undefined, 7);
    walkFriendlyRoute(loaded, route, Infinity, 0.5, 10, undefined, 7);
    expect([c.x, c.z]).toEqual([10, -5]);
    expect([loaded.x, loaded.z]).toEqual([10, -5]); // (with the walk in a page-wide table it rejoined at the first leg: (15, 0))
  });
  it("two legends on the same spot keep their own progress, and a changed route (its key) makes it rejoin", () => {
    const a = legend(), b = legend();
    walkFriendlyRoute(a, route, Infinity, 2, 10, undefined, 7);
    b.x = 10; b.z = 0; // (standing at the crossing, never having walked: it joins at the first leg)
    walkFriendlyRoute(b, route, Infinity, 0.5, 10, undefined, 7);
    walkFriendlyRoute(a, route, Infinity, 0.5, 10, undefined, 7);
    expect([b.x, b.z]).toEqual([15, 0]);
    expect([a.x, a.z]).toEqual([10, -5]);
    walkFriendlyRoute(a, route, Infinity, 0.5, 10, undefined, 8); // (tonight's route redrawn: joins afresh, nearest the first leg)
    expect(a.routeWalk?.key).toBe(8);
  });
});

describe("each game's steps begin with its own fight speeds (rules/fightSettings.ts)", () => {
  const scaledTuning = (): Tuning => { const t = structuredClone(TUNING); t.fight.scale = 1.7; t.fight.speed = 0.8; return t; };
  const step = (g: Game) => { g.clock.paused = false; stepGame(g, idle, STEP); };

  it("a game that has fought has its tuning's; one that hasn't, the page's start values, whatever ran before", () => {
    const fought = preppedGame(123, scaledTuning()), fresh = preppedGame(123, TUNING);
    fought.fightSet = true; // (as its first fight step leaves it)
    step(fought);
    expect([FIGHT.scale, FIGHT.speed]).toEqual([1.7, 0.8]);
    step(fresh);
    expect([FIGHT.scale, FIGHT.speed]).toEqual([1, 1]);
    step(fought);
    expect([FIGHT.scale, FIGHT.speed]).toEqual([1.7, 0.8]);
  });
  it("a night saved after its first fight and loaded after another game began steps with its own fight speeds", () => {
    const fought = preppedGame(123, scaledTuning());
    fought.fightSet = true;
    const loaded = roundtrip(fought);
    expect(loaded.fightSet).toBe(true);
    newGame(165272, TUNING); // (another night begun meanwhile: newGame puts the page's start values back)
    expect(FIGHT.scale).toBe(1);
    step(loaded);
    expect([FIGHT.scale, FIGHT.speed]).toEqual([1.7, 0.8]);
  });
});

describe("caches keyed by everything they depend on", () => {
  it("scaled: two attacks of one name (another combat data's) are each scaled from their own", () => {
    const a = { range: 2, cooldown: 1, windup: 0.5, delivery: "melee" } as unknown as Attack, b = { ...a, range: 5 } as Attack;
    expect(scaled("module-state-test", a).range).toBe(2 * FIGHT.scale);
    expect(scaled("module-state-test", b).range).toBe(5 * FIGHT.scale);
    expect(scaled("module-state-test", a).range).toBe(2 * FIGHT.scale);
  });
  it("scaled: a scaling handed back in is not scaled twice (attackOf scales what attackNamed scaled)", () => {
    const was = FIGHT.scale, a = { range: 2, cooldown: 1, windup: 0.5, delivery: "melee" } as unknown as Attack;
    FIGHT.scale = 1.5;
    try { expect(scaled("module-state-twice", scaled("module-state-twice", a)).range).toBe(3); } finally { FIGHT.scale = was; }
  });
  it("ownedMemo: one key under two owners (two nights' styles) gives each its own", () => {
    const memo = ownedMemo<string>(2), one = {}, two = {};
    expect(memo(one, "seed 5", () => "one's")).toBe("one's");
    expect(memo(two, "seed 5", () => "two's")).toBe("two's");
    expect(memo(one, "seed 5", () => "made again")).toBe("one's");
  });
});
