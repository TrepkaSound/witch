import { describe, expect, it } from "vitest";
import { hitWitch, newGame as fullGame } from "../../rules/game";
import { smallWorld } from "../../test/worlds";
const newGame = smallWorld(fullGame, "Her ouch depends on one witch's health, not world extent.");
import { TUNING } from "../../rules/tuning";
import type { Sfx } from "./sfx";
import { SfxCues } from "./sfxCues";

// Ed, 2026-10-05: "ouch!"; Ed, 2026-11-15: "I want the ouch sound" (from 2026-10-07 it sat in an `else` that never ran).
describe("her ouch on a hit", () => {
  it("plays once when a hit lands and she stays up, and not when she is knocked down", () => {
    const g = newGame(123, TUNING), heard: string[] = [];
    const sfx = new Proxy({}, { get: (_, k) => () => { if (k === "ouch" || k === "knockdown") heard.push(String(k)); } }) as unknown as Sfx;
    const cues = new SfxCues(sfx), me = g.witches[0];
    g.party.spellAt = -100; // (cast long ago, her intro routine over)
    cues.update(g, 0);
    me.health.hp = 3; g.clock.time = g.herTime = 20;
    hitWitch(g, 0, 20); cues.update(g, 20.02);
    expect(me.ko).toBeFalsy();
    expect(heard).toEqual(["ouch"]);
    me.health.hp = 1; g.clock.time = g.herTime = 30;
    hitWitch(g, 0, 30); cues.update(g, 30.02);
    expect(me.ko).toBeTruthy();
    expect(heard).toEqual(["ouch", "knockdown"]);
  });
});
