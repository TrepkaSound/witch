import { describe, expect, it } from "vitest";
import { COMBAT } from "./combat";
import { lanchester, levelValue, powerReport } from "./power";
import { TUNING } from "./tuning";

import { homeHealth } from "./speakers";
import { preppedGame } from "../test/preppedGame"; // (games on a map made once a file from its prep)

describe("fighting value (rules/power.ts)", () => {
  it("is √(hp × dps) by level: babies 0, young 11.6, adults 40, legends 76 (the level gap, 2026-10-07)", () => {
    expect(levelValue(0)).toBe(0);
    expect(levelValue(1)).toBeCloseTo(11.6, 1);
    expect(levelValue(2)).toBeCloseTo(40, 0);
    expect(levelValue(3)).toBeCloseTo(76, 0);
    expect(lanchester(50, 30)).toBeCloseTo(40, 9);
    expect(lanchester(30, 50)).toBe(0);
  });

  it("reads the party and the sieges off a game", () => {
    const g = preppedGame(123, TUNING), two = g.creatures.filter(c => !c.boss && !c.leashed), young = two[0], adult = two[1];
    young.level = 1; adult.level = 2; young.leashed = true; g.leash.stack.push(young.id);
    adult.siege = "home";
    const p = powerReport(g.creatures, g.witches, g.combat.sounds);
    expect(p.leashed).toBeCloseTo(levelValue(1, COMBAT, young.species), 9); // (times its species' strength)
    expect(p.parked).toBe(0);
    expect(p.counts).toEqual([0, 1, 0, 0]);
    expect(p.sieges).toEqual([{ key: "home", value: levelValue(2, COMBAT, adult.species), count: 1, hp: homeHealth(TUNING) }]);
    expect(p.marching).toBeCloseTo(levelValue(2, COMBAT, adult.species), 9);
  }, 30000);
});
