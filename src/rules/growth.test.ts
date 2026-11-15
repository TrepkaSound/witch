import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { COMBAT } from "./combat";
import { growthLevel } from "./growth";
import { newGame, stepGame, simRadius } from "./game";
import { TUNING, withTuning } from "./tuning";

/** Every species at strength 1 for these tests (Ed, 2026-10-08, gave the species strengths by class; these test other
 *  mechanics, written when every species was 1): combat.json strength.species emptied for the block, put back after. */
const SAVED_STRENGTH = { ...COMBAT.strength!.species };
const plainStrength = () => { for (const k of Object.keys(COMBAT.strength!.species)) delete COMBAT.strength!.species[k]; };
const restoreStrength = () => Object.assign(COMBAT.strength!.species, SAVED_STRENGTH);

// (the mechanism at one creature a wave, whatever the tuning file's pace)
const T1 = withTuning({ population: { ...TUNING.population, growth: { ...TUNING.population.growth, on: true, perWave: 1 } } }); // (on: the tuning has it off since Ed's 2026-10-28 "no creatures are created" in a night; the mechanics, kept for the simulators)
// Keep the radius layout: materialization tests use a 500 m view offset and the fixed home-minus(3,2) area, not just local growth counters.
const still = { moveX: 0, moveZ: 0, toggleMode: false, zoom: 0 };

describe("wild areas grow (Ed, 2026-10-04: a creature a wave while wild)", () => {
  beforeAll(plainStrength); afterAll(restoreStrength);

  it("returns valid growth levels with exact seed replay and forced weight endpoints", () => {
    const levels: number[] = [];
    for (let w = 1; w <= 40; w++) for (let cx = 0; cx < 20; cx++) levels.push(growthLevel(123, [cx, 7], w, 0, [1, 1, 1]));
    expect(levels.every(level => level === 0 || level === 1 || level === 2)).toBe(true);
    // C1 reports the original 800-draw shares; validity/replay/forced weights remain blocking.
    expect(growthLevel(123, [3, 4], 9, 0, [1, 1, 1])).toBe(growthLevel(123, [3, 4], 9, 0, [1, 1, 1]));
    for (let w = 1; w < 30; w++) expect(growthLevel(5, [1, 1], w, 0, [0, 0, 1])).toBe(2); // all adults
    for (let w = 1; w < 30; w++) expect(growthLevel(5, [1, 1], w, 0, [1, 0, 0])).toBe(0);
  });

  it("in a game: nothing grows any more (Ed, 2026-10-07: the areas are peopled from the start, rules/clear.test.ts)", () => {
    const g = newGame(123, T1), start = g.creatures.length;
    g.clock.paused = false;
    g.witch = { ...g.witch, seated: false, mode: "treetop", lift: 1 };
    for (let wave = 1; wave <= 3; wave++) { stepGame(g, { ...still, nextWave: true }, 1 / 60); stepGame(g, still, 1 / 60); }
    expect(g.party.wave).toBe(3);
    expect(g.creatures.length).toBe(start);
    expect(simRadius(g)).toBeGreaterThan(T1.haze.far);
  }, 60000);
});
