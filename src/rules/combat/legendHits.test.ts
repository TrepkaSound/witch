import { describe, expect, it } from "vitest";
import { TUNING } from "../tuning";
import { LEGENDS } from "../legends";
import { legendHit, OLD_LEGEND_HIT } from "./legendHits";

// Ed, 2026-11-16: "50 a hit" (a legend's attack on creatures; the charging kinds' trample with it). ?legendhits=old: 10.
describe("a legend's hit on a creature (Ed, 2026-11-16)", () => {
  it("is 50, for its attack and for a charging kind's trample", () => {
    expect(legendHit(TUNING, LEGENDS.attack.damage)).toBe(50);
    expect(legendHit(TUNING, LEGENDS.charge.damage)).toBe(50);
  });
  it("is the old 10 with ?legendhits=old (legends.hardHits off)", () => {
    const old = { ...TUNING, legends: { ...TUNING.legends, hardHits: false } };
    expect(legendHit(old, LEGENDS.attack.damage)).toBe(OLD_LEGEND_HIT);
    expect(legendHit(old, LEGENDS.charge.damage)).toBe(10);
  });
  it("leaves the bombardment of soundsystems alone (Ed, 2026-11-16: \"Keep 150: one lob destroys one\")", () => {
    expect(TUNING.legends.bombard.damage).toBe(150);
  });
});
