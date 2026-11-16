// At the treehouse no one in her stack grounds her (Ed, 2026-11-16, asked whether the treehouse floor should be an exception to
// adults and legends in her stack grounding her: "Let her take off from the treehouse"; rules/leashWeight.ts groundedBy).
// ?treehousetakeoff=old (treehouse.freeTakeOff off): they ground her there too, as before.
import { describe, expect, it } from "vitest";
import { TUNING, type Tuning } from "./tuning";
import { groundedBy } from "./leashWeight";
import { stepGame, STEP, type Controls, type Game } from "./game";
import { smallWorld } from "../test/worlds";
import type { Creature } from "./creatures";
import { preppedGame } from "../test/preppedGame"; // (games on a map made once a file from its prep)
const newGame = smallWorld(preppedGame, "A take-off from the treehouse floor needs only the house and one creature in her stack, independent of area count.");

const OLD: Tuning = { ...TUNING, treehouse: { ...TUNING.treehouse, freeTakeOff: false } };
const idle: Controls = { moveX: 0, moveZ: 0, toggleMode: false, zoom: 0, autoTalk: false };
const crit = (id: number, level: number) => ({ id, x: 0, z: 0, level, species: "wolf", gone: false }) as unknown as Creature;

/** Her standing on the treehouse floor where the night starts (up from her decks), an adult's sigil in her stack, past the landing's wait. */
function atHouse(t: Tuning): Game {
  const g = newGame(7, t), W = g.witches[0];
  g.clock.paused = false; g.party.paused = true;
  W.body = { ...W.body, seated: false };
  for (let i = 0; i < 4 / STEP; i++) stepGame(g, idle, STEP);
  const c = g.creatures.find(o => !o.boss && !o.gone && !o.leashed)!;
  c.level = 2; c.leashed = true; W.leash.stack.push(c.id);
  return g;
}
const press = (g: Game) => { stepGame(g, { ...idle, toggleMode: true }, STEP); return { up: g.witches[0].body.mode !== "ground", grounded: g.leashEvents.some(e => e.kind === "grounded") }; };

describe("taking off at the treehouse with adults or legends in her stack (Ed, 2026-11-16)", () => {
  it("groundedBy: no one grounds her while she's perched; everywhere else an adult or a legend does", () => {
    const cs = [crit(0, 2), crit(1, 3)];
    expect(groundedBy([0, 1], cs, TUNING, { perch: true })).toEqual({ grounded: false, adult: false });
    expect(groundedBy([0], cs, TUNING, { perch: false }).grounded).toBe(true);
    expect(groundedBy([1], cs, TUNING, {}).grounded).toBe(true);
    expect(groundedBy([0], cs, TUNING).grounded).toBe(true);
  });
  it("groundedBy with ?treehousetakeoff=old: they ground her at the treehouse too", () => {
    expect(groundedBy([0], [crit(0, 2)], OLD, { perch: true }).grounded).toBe(true);
  });
  it("on the treehouse floor she rises with an adult in her stack, and nothing says grounded", () => {
    const g = atHouse(TUNING);
    expect(g.witches[0].body.perch).toBe(true);
    expect(press(g)).toEqual({ up: true, grounded: false });
  });
  it("with ?treehousetakeoff=old the same press is refused there, as before", () => {
    const g = atHouse(OLD);
    expect(g.witches[0].body.perch).toBe(true);
    expect(press(g)).toEqual({ up: false, grounded: true });
  });
});
