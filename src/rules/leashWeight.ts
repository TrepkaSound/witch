// Taking off with followers (Ed, 2026-11-03: "I think leashed youths shouldn't stop you from taking off, only adults and legends do"):
// who keeps her on the ground. The sigil weight that lived here (Ed, 2026-10-06: every carried sigil pulling on her, slower away,
// drifting, slower to rise, pulled down over the treetops, with a free allowance and each creature's weight by level and species
// strength) is gone (Ed, 2026-11-03: "the weight system goes"): her chains (rules/chains.ts) are the only pull now, at their full
// length, by level. No drawing here.
import type { Creature } from "./creatures";
import type { Tuning } from "./tuning";
import { holdsDown } from "./chains";

/** Who grounds her (Ed, 2026-11-03, replacing the weight rule of 2026-10-18, "One adult stops you taking off. Three young do."): "I
 *  think leashed youths shouldn't stop you from taking off, only adults and legends do." A leashed adult or legend, its sigil in her
 *  stack (a party legend too), stops her taking off from the ground, whatever its species' strength; youths, babies and parked ones
 *  never do. She tries and is pulled straight back down (rules/game.ts keeps her on the ground and says so, the "grounded" leash event;
 *  the view draws the hop, the chains of those holding her rattle, and the thud). Once she's up it doesn't bring her down. */
export interface Grounding { grounded: boolean; /** an adult or a legend on her leash (the same as grounded) */ adult: boolean }
/** `at`: her body, where the caller knows it. At the treehouse (its floors, rooms and balcony: her body's `perch`) no one in her stack
 *  grounds her (Ed, 2026-11-16, asked whether the treehouse floor should be an exception, her followers counting as placed while
 *  she's perched: "Let her take off from the treehouse"); with ?treehousetakeoff=old (treehouse.freeTakeOff off) they do, as before. */
export function groundedBy(stack: readonly number[], creatures: readonly Creature[], t?: Tuning, at?: { perch?: boolean }): Grounding {
  if (at?.perch && t?.treehouse.freeTakeOff !== false) return { grounded: false, adult: false };
  const adult = stack.some(id => holdsDown(creatures[id]));
  return { grounded: adult, adult };
}
