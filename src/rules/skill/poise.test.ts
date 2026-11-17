// Openings (?skill=1; rules/skill/poise.ts; docs/plans/combat-skill-and-commands.md, section 5): every letter is still exactly one hit;
// letters wear poise (more in a wind-up), a break cancels a wind-up and staggers; sit and stagger hold still; the daze slows; the hare,
// badger and dormouse only; and nothing with the switch off.
import { describe, expect, it } from "vitest";
import { TUNING, withTuning } from "../tuning";
import { newInvites, stepInvites, type Affection } from "../invites";
import { STEP } from "../game";
import type { Creature } from "../creatures";
import { dazeSpeed, noteLetter, openness, poiseShare, sitAfter, staggered, stepSkill } from "./poise";
import { poiseLetters, skillProfile } from "./profile";

const ON = withTuning({ skill: { on: true } }), OFF = withTuning({ skill: { on: false } }); // (on is the default, Ed 2026-11-17; off is ?skill=0)
const wild = (species: string, level = 1, more: Partial<Creature> = {}) => ({ id: 0, species, level, x: 8, z: 0, leashed: false, gone: false, ...more }) as Creature;
const winding = (c: Creature, until = 10) => { c.fight = { target: { kind: "witch", id: 0 }, readyAt: 0, windupUntil: until, windupAt: 0, aimX: 0, aimZ: 0, spellCast: 7 }; };

describe("a letter is one hit (Ed, 2026-11-17: \"A hit is a letter\")", () => {
  it("with openings on, each letter that lands on a hare counts exactly once, as with them off", () => {
    const hits = (t: typeof TUNING) => {
      const c = wild("hare"), counted: number[] = [];
      const A: Affection = { invitable: () => true, blocksLetters: () => false, hit: (_c, amount) => counted.push(amount), affection: () => null };
      const s = newInvites(), T = withTuning({ ...t, invites: { ...t.invites, burst: 5, burstGap: 0.04, multiShot: 1, homing: 0 } });
      for (let i = 0, time = 0; i < 0.6 / STEP; i++, time += STEP) { s.events = []; stepInvites(s, { fire: i === 0, aimX: 1, aimZ: 0 }, { x: 0, z: 0, facing: 1 }, true, [c], A, time, STEP, T); }
      return { counted, c };
    };
    const on = hits(ON), off = hits(OFF);
    expect(on.counted).toEqual([1, 1, 1, 1, 1]);
    expect(off.counted).toEqual(on.counted);
    expect(on.c.skill?.letters).toBe(5); // (noted beside the meter, worn at its next turn)
    expect(off.c.skill).toBeUndefined();
  });
});

describe("poise, stagger and daze", () => {
  it("only the hare, badger and dormouse have openings", () => {
    expect(["hare", "badger", "dormouse"].map(k => !!skillProfile(k, 1))).toEqual([true, true, true]);
    expect(["fox", "squirrel", "bee", "wolf"].map(k => !!skillProfile(k, 1))).toEqual([false, false, false, false]);
  });
  it("letters in a badger's wind-up break its poise: the wind-up and its cast called off, it staggers, then a daze slows it", () => {
    const c = wild("badger"), P = skillProfile("badger", 1)!, full = poiseLetters(P, 1, ON);
    expect(full).toBe(4); // (60% of a youth's 7)
    winding(c);
    for (let i = 0; i < full / P.poise.windup; i++) noteLetter(c, ON); // (each worth poise.windup in its wind-up: 2)
    stepSkill(c, 1, STEP, ON);
    expect(c.fight!.windupUntil).toBe(0);
    expect(c.fight!.spellCast).toBeUndefined();
    expect(staggered(c, 1.5)).toBe(true);
    expect(openness(c, 1.5, ON)).toBe(1);
    expect(dazeSpeed(c, 1.5)).toBe(1); // (staggered: standing still, not slowed)
    expect(staggered(c, 1 + P.stagger.time + 0.01)).toBe(false);
    expect(dazeSpeed(c, 1 + P.stagger.time + 0.5)).toBe(P.daze.speed);
    expect(dazeSpeed(c, 1 + P.stagger.time + P.daze.time + 0.01)).toBe(1);
  });
  it("out of a wind-up a letter wears one; it refills after its delay; it can't break again while immune", () => {
    const c = wild("badger"), P = skillProfile("badger", 1)!, full = poiseLetters(P, 1, ON);
    noteLetter(c, ON); stepSkill(c, 0, STEP, ON);
    expect(c.skill!.poise).toBe(full - 1);
    expect(poiseShare(c, ON)).toBeCloseTo((full - 1) / full);
    for (let time = 0; time < P.poise.regenDelay + P.poise.regenTime + 0.1; time += STEP) stepSkill(c, time, STEP, ON);
    expect(c.skill!.poise).toBe(full);
    for (let i = 0; i < full; i++) noteLetter(c, ON);
    stepSkill(c, 10, STEP, ON);
    expect(staggered(c, 10.1)).toBe(true);
    for (let i = 0; i < full; i++) noteLetter(c, ON);
    stepSkill(c, 11.5, STEP, ON); // (inside stagger.immune: no second break)
    expect(c.skill!.staggerUntil).toBe(10 + P.stagger.time);
  });
  it("it sits after an attack: at once after a shot or a stamp, after its lunge a melee one", () => {
    const hare = wild("hare");
    expect(sitAfter(hare, false, 5, ON)).toBe(true);
    expect(hare.sitUntil).toBeCloseTo(5.8);
    expect(openness(hare, 5.5, ON)).toBe(1);
    const badger = wild("badger");
    badger.fight = { target: null, readyAt: 0, windupUntil: 0, aimX: 0, aimZ: 0, lunge: { dx: 1, dz: 0, left: 3 } };
    expect(sitAfter(badger, true, 5, ON)).toBe(true);
    expect(badger.sitUntil).toBeUndefined();
    stepSkill(badger, 5.1, STEP, ON);
    expect(badger.sitUntil).toBeUndefined(); // (still lunging)
    badger.fight.lunge = undefined;
    stepSkill(badger, 5.3, STEP, ON);
    expect(badger.sitUntil).toBeCloseTo(6.2);
  });
  it("with the switch off (?skill=0) nothing changes: no state, no sit of its own (the hare's own sit stays tuning hareStamp.sit's)", () => {
    const c = wild("badger");
    noteLetter(c, OFF);
    expect(c.skill).toBeUndefined();
    expect(sitAfter(c, false, 1, OFF)).toBe(false);
    expect(openness(c, 1, OFF)).toBe(0);
  });
  it("hers never stagger", () => {
    const c = wild("hare", 1, { leashed: true });
    noteLetter(c, ON);
    expect(c.skill).toBeUndefined();
  });
});
