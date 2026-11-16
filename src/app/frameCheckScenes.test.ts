// The frame check's stepped scenes, walked against the game (Ed, 2026-11-16: "The frame check test has the witch walking off the
// treehouse repeatedly I think because she has no broom yet"): a night that waits for her party spell, as the check's link makes
// it, each scene put in place as the page's runner does (app/frameCheckPlace.ts) and its 600 frames of controls stepped.
import { describe, expect, it } from "vitest";
import { TUNING } from "../rules/tuning";
import { stepGame, type Game } from "../rules/game";
import { setupArena } from "../rules/arena";
import { deckOf, onFloor } from "../rules/treehouse";
import { roomAt } from "../rules/houseRooms";
import { hasBroom, newKit } from "../rules/kit";
import { smallWorld } from "../test/worlds";
import { preppedGame } from "../test/preppedGame";
import { applyShot } from "./shot";
import { FRAME_CHECK_DT, FRAME_CHECK_FRAMES, FRAME_CHECK_SCENES, type FrameCheckScene } from "./frameCheck";
import { placeFrameCheckScene } from "./frameCheckPlace";

const newGame = smallWorld(preppedGame, "The frame check's scenes use the house, the forest by it and the arena's open ground, independent of distant areas.");
/** The check's night (app/gameParams.ts under ?creator=0&spell=wait): waiting for her spell, her kit not yet taken, she at her decks. */
const night = (): Game => { const g = newGame(123, TUNING); g.clock.paused = false; g.party.spellAt = null; for (const W of g.witches) W.kit = newKit(true); return g; };
const scene = (id: string): FrameCheckScene => FRAME_CHECK_SCENES.find(s => s.id === id)!;
/** A scene put in place and stepped; `each` is asked after every frame. Its falls (a step off the house with no broom). */
function run(g: Game, s: FrameCheckScene, each: (i: number) => void = () => undefined): number {
  expect(placeFrameCheckScene({ game: g, arena: spec => setupArena(g, spec), shot: q => applyShot(g, q) }, s)).toBeNull();
  let falls = 0;
  for (let i = 0; i < FRAME_CHECK_FRAMES; i++) {
    const was = g.witch.falling !== undefined;
    stepGame(g, s.controls(i), FRAME_CHECK_DT);
    if (!was && g.witch.falling !== undefined) falls++;
    each(i);
  }
  return falls;
}

describe("the frame check's stepped scenes", () => {
  it("fall off the house with no broom: what Ed saw (the flight's controls, her broom not taken)", () => {
    const g = night();
    run(g, scene("decks"));
    const home = { x: g.witch.x, z: g.witch.z };
    expect(run(g, { ...scene("ground-flight"), broom: undefined })).toBeGreaterThan(1);
    expect(Math.hypot(g.witch.x - home.x, g.witch.z - home.z)).toBeLessThan(40); // (never got away from the house)
  });

  it("run in order with her broom taken: she flies from the Terrace, fights at the arena and walks the Parlour, never falling", () => {
    const g = night(), deck = deckOf(g.map, g.tuning)!;
    expect(run(g, scene("decks"))).toBe(0);
    expect(hasBroom(g.witches[0])).toBe(false); // (at her decks she needs none)
    const home = { x: g.witch.x, z: g.witch.z };
    expect(run(g, scene("ground-flight"))).toBe(0);
    expect(hasBroom(g.witches[0])).toBe(true);
    expect(g.witch.mode).toBe("treetop");
    expect(g.witch.perch).toBeFalsy();
    expect(Math.hypot(g.witch.x - home.x, g.witch.z - home.z)).toBeGreaterThan(60); // (away over the forest)
    let off = 0;
    expect(run(g, scene("wave-fight"), () => { if (g.witch.perch || onFloor(deck, g.witch.x, g.witch.z)) off++; })).toBe(0);
    expect(off).toBe(0); // (at the arena, not back on the house)
    const rooms: (string | undefined)[] = [], at: { x: number; z: number }[] = [];
    expect(run(g, scene("treehouse"), () => { at.push({ x: g.witch.x, z: g.witch.z }); rooms.push(g.witch.mode === "ground" && g.witch.perch ? roomAt(deck, g.witch.x, g.witch.z)?.id : "off"); })).toBe(0);
    expect(rooms.filter(r => r !== "parlour")).toEqual([]); // (all 600 frames on foot in the Parlour)
    expect(Math.max(...at.map(p => Math.hypot(p.x - at[0].x, p.z - at[0].z)))).toBeGreaterThan(3); // (and she does walk round it)
  });

  it("the fight run by itself (a link naming one scene) is at the arena, not back at her decks", () => {
    const g = night(), deck = deckOf(g.map, g.tuning)!;
    let off = 0;
    expect(run(g, scene("wave-fight"), () => { if (g.witch.perch || onFloor(deck, g.witch.x, g.witch.z)) off++; })).toBe(0);
    expect(off).toBe(0);
  });
});
