// A creature's charges on its berry pips in her stack (?commands=1; docs/plans/combat-skill-and-commands.md, section 3, "Shown on the
// same pips, with no new ring"; Ed, 2026-11-17: "I think we can do this with the existing berry charge meter, with blinking or something
// like that"). Ready: its lit pips steady and bright. Cooling down: its lit pips dimmed, and the one it spends next blinking (on and off
// at about 2 Hz; under 1.5 s of cooldown, a machine gun's, it only dims and brightens back). Ready again: a flash across its lit pips.
// Six to a row, two rows (Ed, answer 10: "dots in two rows"). A youth's bar is these, pulsing full as a ready-to-grow youth's dots did.
import type { Creature } from "../../rules/creatures";
import type { Tuning } from "../../rules/tuning";
import { commandsOn } from "../../rules/skill/profile";
import { chargeMax, chargesOf } from "../../rules/commands/charges";

/** The display's numbers (section 1, "Global display parameters"). */
export const CHARGE_LOOK = { perRow: 6, blinkHz: 2, blinkFrom: 1.5, cooling: 0.45, off: 0.12, flash: 1.6 };

export interface ChargeDots {
  n: number;
  lit: number;
  perRow: number;
  /** A youth's bar full: the next berry evolves it (its dots pulse). */
  ready: boolean;
  /** Each dot's brightness, times its usual. */
  k(i: number): number;
}

/** Its charge dots, or null with commands off or for a creature without a bar (a baby, a legend, a party legend). */
export function chargeDots(c: Creature, t: Tuning, time: number): ChargeDots | null {
  if (!commandsOn(t) || (c.level !== 1 && c.level !== 2) || c.partyLegend) return null;
  const L = CHARGE_LOOK, max = chargeMax(c), had = Math.min(max, chargesOf(c)), s = c.cmd;
  // (more than two rows' worth, a machine gun's 16: the two rows lit in proportion, its last charge always showing: a display parameter)
  const most = L.perRow * 2, n = Math.min(max, most), lit = max <= most ? had : had >= max ? most : had > 0 ? Math.max(1, Math.floor((had * most) / max)) : 0;
  const cool = s?.cool ?? 0, coolFor = Math.max(1e-6, s?.coolFor ?? cool), flash = (s?.flash ?? 0) > 0;
  const k = (i: number): number => {
    if (i >= lit) return 1;
    if (flash) return L.flash;
    if (cool <= 0) return 1;
    if (i !== lit - 1) return L.cooling;
    if (coolFor < L.blinkFrom) return L.cooling + (1 - L.cooling) * (1 - cool / coolFor);
    return Math.sin(time * Math.PI * 2 * L.blinkHz) > 0 ? 1 : L.off;
  };
  return { n, lit, perRow: L.perRow, ready: c.level === 1 && had >= max, k };
}
