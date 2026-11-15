// One shape for every creature, built as one object literal (rules/creatures.ts makeCreature): the required fields, then
// every optional one. Set one by one after the fact (keyed stores) they tipped V8 into dictionary mode, every field read a
// hash lookup; a literal keeps fast properties. The literal is the only list of the fields (the typecheck fails on one of
// Creature's left out of it: EveryField); this pins that every creature keeps exactly its fields, in its order, so one set
// after the fact outside the literal is caught.
import { describe, expect, it } from "vitest";
import { makeCreature, spawnCreatures } from "./creatures";
import { generateMap } from "./map";
import { rng } from "./random";
import { TUNING } from "./tuning";
import { largestWorldTuning } from "../test/worlds";

const REQUIRED = ["id", "species", "level", "cell", "homeX", "homeZ", "range", "anchorX", "anchorZ", "x", "z", "tx", "tz", "rest", "speed", "facing", "away", "moving", "walk", "seen", "leashed", "rand"];

describe("a creature's shape", () => {
  it("has every field, required then optional in one order, for every creature (legends too)", () => {
    // Largest shipped world: the spawn roster must include ordinary creatures, legends and circles together.
    const map = generateMap(123, largestWorldTuning(TUNING)), all = spawnCreatures(map), want = Object.keys(makeCreature(map, all[0].cell, 0, -1, rng(1)));
    expect(want.slice(0, REQUIRED.length)).toEqual(REQUIRED);
    expect(want.length).toBeGreaterThan(100); // (the optional ones follow: 109 of them on 2026-11-15)
    expect(new Set(want).size).toBe(want.length);
    for (const c of [all[0], all.find(c => c.boss)!, all.find(c => c.circle)!]) expect(Object.keys(c)).toEqual(want);
  });
});
