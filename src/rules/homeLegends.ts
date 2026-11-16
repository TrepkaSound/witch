// Home legends (Ed, 2026-11-15): the legends that guard the home area. Two kinds, and one rule for both. The island's own home
// legend (homeGuard: rules/creatures.ts spawnCreatures) was always one; a friendly route legend back from the far end of the route
// is the other, and it guards "Exactly like the home legend" (Ed, 2026-11-15, asked whether it should keep its ring post, defend
// her first and take the party egg). And the party egg is for both: "Both home legends and returned route legends should be
// invitable in this way." What "like the home legend" means in the code is here: who counts (likeHomeLegend) and what one let off
// her leash does (backToGuarding); where a returned one stands is rules/creatures.ts homePost, beside the home legend's own spot. ?homelegends=old (the tuning's
// legends.homeAlike off) plays the rules as they were: a returned one on a ring post, defending her first, and the home legend
// taking no letters. No drawing here.
import type { Creature } from "./creatures"; // (types only: creatures.ts is in combat's import loop, and combat's legends read this file)

/** Guarding home as the home legend does: the home legend itself, or a returned route legend under the 2026-11-15 rule (its
 *  journey's `home`, stamped as it gets back; not one on her leash, a party legend or in the win's dance). */
export const likeHomeLegend = (c: Creature): boolean => !!c.homeGuard || (isHomeLegend(c) && c.legendState === "happy" && !c.leashed && !c.partyLegend && c.finale === undefined && !c.gone); // (as rules/creatures.ts guardsHome)

/** A home legend of either kind, whatever it's doing now: the one a party legend goes back to being when she lets it go. */
export const isHomeLegend = (c: Creature): boolean => !!c.homeGuard || (c.journey?.stage === "guard" && !!c.journey.home);

/** A home legend that was a party legend, let off her leash (its sigil put down, her knockout, the party over): back to guarding
 *  home where it stands, its hat off, fighting again; it takes letters again from an empty meter. (The builder's choice, 2026-11-15:
 *  Ed asked only that both can be invited; a home legend that stayed a party legend would leave home unguarded for the night.) */
export function backToGuarding(c: Creature): void {
  c.partyLegend = undefined; c.leashed = false; c.state = "happy"; c.dancing = false; c.fight = undefined; c.run = undefined; c.moving = false;
}
