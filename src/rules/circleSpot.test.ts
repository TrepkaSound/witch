// Where a legend circle's baby's loose sigil lands (rules/stoneStacks.ts circleSpot): at its circle's left or right edge (Ed,
// 2026-11-16: "It is easy to go into a legend's circle and accidentally pick up the legend baby instead of putting down the quest
// sigil. Where in the circle does it land? Perhaps we can move it to the left or right edge."), so where she stands to put a quest
// sigil down is out of the sigil button's pick-up reach of it.
import { describe, expect, it } from "vitest";
import { circleSpot, SIDE_SHARE } from "./stoneStacks";
import { TUNING } from "./tuning";

const LC = TUNING.legendClearing, REACH = TUNING.leash.runeRadius ?? TUNING.leash.pickRadius;
/** Every circle size in the tuning: the default and each species', smallest first. */
const SIZES = [...new Set([LC.radius, ...Object.values(LC.species)])].sort((a, b) => a - b);
/** A circle of radius r at (100, 200), its legend lying legendClearing.back of the radius north of the middle. */
const circle = (r: number) => ({ x: 100, z: 200, r, legendX: 100, legendZ: 200 - r * (LC.back ?? LC.top) });
const anywhere = () => true;

describe("the circle baby's sigil lands at its circle's side (Ed, 2026-11-16)", () => {
  it("due east or west of the middle, inside the circle, clear of the legend, at every circle size", () => {
    expect(SIZES[0]).toBeLessThanOrEqual(10); expect(SIZES[SIZES.length - 1]).toBeGreaterThanOrEqual(24);
    for (const r of SIZES) for (let seed = 0; seed < 40; seed++) {
      const k = circle(r), p = circleSpot(k, 5, seed, anywhere);
      expect(Math.abs(p.x - k.x)).toBeCloseTo(r * SIDE_SHARE, 6);
      expect(p.z).toBeCloseTo(k.z, 6);
      expect(Math.hypot(p.x - k.x, p.z - k.z)).toBeLessThan(r);
      expect(Math.hypot(p.x - k.legendX, p.z - k.legendZ)).toBeGreaterThan(5);
    }
  });

  it("leaves the middle and the front of the circle out of pick-up reach, at every circle size", () => {
    const short: number[] = [];
    for (const r of SIZES) {
      const k = circle(r), p = circleSpot(k, 5, 1, anywhere);
      // where she stands to put a quest sigil down: on the centre line, from the middle to the front edge
      const stands = [0, 0.3, 0.6, 0.9].map(f => ({ x: k.x, z: k.z + r * f }));
      if (stands.some(s => Math.hypot(s.x - p.x, s.z - p.z) <= REACH)) short.push(r);
    }
    expect(short).toEqual([]); // (a circle under 7.1 m would fall short: 0.8 r from the middle is then within the 5.625 m reach)
  });

  it("the side is by the seed: both sides come up, the same seed the same side", () => {
    const k = circle(12), sides = new Set<number>();
    for (let seed = 0; seed < 40; seed++) { const p = circleSpot(k, 5, seed, anywhere); sides.add(Math.sign(p.x - k.x)); expect(circleSpot(k, 5, seed, anywhere)).toEqual(p); }
    expect([...sides].sort()).toEqual([-1, 1]);
  });

  it("the other side if the seeded one isn't free; then along the edge, never the middle or front; with nowhere free, the seeded side", () => {
    for (const r of SIZES) for (let seed = 0; seed < 10; seed++) {
      const k = circle(r), a = circleSpot(k, 5, seed, anywhere);
      const b = circleSpot(k, 5, seed, (x, z) => Math.hypot(x - a.x, z - a.z) > 1);
      expect(b.x - k.x).toBeCloseTo(-(a.x - k.x), 6); expect(b.z).toBeCloseTo(k.z, 6);
      const c = circleSpot(k, 5, seed, (x, z) => Math.hypot(x - a.x, z - a.z) > 1 && Math.hypot(x - b.x, z - b.z) > 1);
      expect(Math.hypot(c.x - k.x, c.z - k.z)).toBeCloseTo(r * SIDE_SHARE, 6);
      expect(Math.abs(c.x - k.x)).toBeGreaterThan(r * 0.6);
      expect(c.z).toBeLessThan(k.z); // (toward the back first)
      // every candidate stays at the side: block them one after another
      const taken: { x: number; z: number }[] = [];
      for (let i = 0; i < 20; i++) {
        const p = circleSpot(k, 5, seed, (x, z) => taken.every(q => Math.hypot(x - q.x, z - q.z) > 0.01));
        expect(Math.abs(p.x - k.x)).toBeGreaterThan(r * 0.6);
        expect(Math.hypot(p.x - k.x, p.z - k.z)).toBeLessThanOrEqual(r * 0.85);
        taken.push(p);
      }
      expect(circleSpot(k, 5, seed, () => false)).toEqual(a);
    }
  });

  it("never on the legend's body: a legend that fills one side sends it to the other", () => {
    const k = { ...circle(12), legendX: 100 + 12 * SIDE_SHARE, legendZ: 200 }, p = circleSpot(k, 5, 3, anywhere);
    expect(Math.hypot(p.x - k.legendX, p.z - k.legendZ)).toBeGreaterThanOrEqual(5);
  });

  it("?circlesigil=old: by its baby's dancing spot, as before", () => {
    for (const r of SIZES) { const k = circle(r), p = circleSpot(k, 3, 1, anywhere, false); expect(Math.hypot(p.x - k.x, p.z - (k.z + r * 0.3))).toBeLessThan(1e-6); }
  });
});
