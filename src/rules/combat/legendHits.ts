// How hard a legend's attack hits a creature (Ed, 2026-11-16, asked how hard, at 10 a hit every 15 s against an adult's 160 health:
// "50 a hit"). Its kind's attack made big, the old lob or beam and a charging kind's trample all hit the same, config/legends.json's
// attack.damage and charge.damage. A blow on her still costs her one hit, and the bombardment of a soundsystem is its own number
// (tuning legends.bombard.damage; Ed, 2026-11-16: "Keep 150: one lob destroys one"). No drawing here.
import type { Tuning } from "../tuning";

/** A legend's hit before Ed's 2026-11-16 ruling, kept for ?legendhits=old (tuning legends.hardHits off). */
export const OLD_LEGEND_HIT = 10;

/** The damage of a legend's hit on a creature: the config's (`now`), or the old 10 with ?legendhits=old. */
export function legendHit(t: Tuning, now: number): number {
  return t.legends.hardHits === false ? Math.min(now, OLD_LEGEND_HIT) : now;
}
