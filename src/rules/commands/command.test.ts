// Creature commands (?commands=1; rules/commands/; docs/plans/combat-skill-and-commands.md, section 5): berries as charges (perBerry,
// up to the level's max; a full youth's next berry evolves it), a press spending one and starting that creature's own cooldown with no
// gap shared between creatures, a buff-giver's period, a legend's endless charges on its longer cooldown, a berry in reach eating
// instead, fizzles, the targeting order in both aiming modes, and the four actions carried out in the fight.
import { describe, expect, it } from "vitest";
import { withTuning } from "../tuning";
import { newGame as fullGame, stepGame, STEP, type Controls, type Game } from "../game";
import { smallWorld } from "../../test/worlds";
import type { Creature } from "../creatures";
import type { LeashEvent } from "../leash";
import { feed, feedRoom } from "../berries";
import { buffsOf } from "../buffs";
import { commandProfile } from "../skill/profile";
import { chargeMax, chargesOf, chargeRoom } from "./charges";
import { commandFeeds, pressCommand } from "./command";
import { commandTarget, type TargetWorld } from "./target";
import { restoreGame, snapshotGame } from "../nightSnapshot";
import { noteLetter } from "../skill/poise";

const newGame = smallWorld(fullGame, "Commands check one witch, two or three creatures by her and the berries' state.");
const ON = withTuning({ commands: { on: true } });
const press: Controls = { moveX: 0, moveZ: 0, toggleMode: false, zoom: 0, command: true, aimX: 1, aimZ: 0 };
const idle: Controls = { moveX: 0, moveZ: 0, toggleMode: false, zoom: 0 };

/** A game with witch 0 on foot, no berries left, and `kinds` (species, level) as creatures: the first n hers (her stack, the last the
 *  bottom), the rest wild, each a few metres east of her. */
function scene(hers: [string, number][], wild: [string, number][] = [], t = ON): { g: Game; mine: Creature[]; foes: Creature[] } {
  const g = newGame(7, t), W = g.witches[0], b = W.body;
  g.clock.paused = false;
  b.seated = false; b.mode = "ground"; b.perch = undefined;
  for (const q of g.berries.berries) q.gone = true;
  const free = g.creatures.filter(k => !k.boss && !k.partyLegend);
  const put = (c: Creature, species: string, level: number, x: number, z: number): Creature => Object.assign(c, { species, level, x, z, tx: x, tz: z, cell: g.map.cellSafe(x, z).cell, asleep: undefined, napUntil: undefined, fight: undefined, gone: undefined, friendly: undefined, statue: undefined });
  const mine = hers.map(([k, lv], i) => { const c = put(free[i], k, lv, b.x - 2, b.z + i); c.leashed = true; W.leash.stack.push(c.id); return c; });
  const foes = wild.map(([k, lv], i) => put(free[hers.length + i], k, lv, b.x + 8 + i * 3, b.z));
  for (const c of g.creatures) if (!mine.includes(c) && !foes.includes(c)) { c.x += 5000; c.tx = c.x; } // (everything else far off)
  g.byArea = null; // (its area index made again from their cells)
  return { g, mine, foes };
}
const pressNow = (g: Game, c: Controls = press, t = g.tuning) => { const ev: LeashEvent[] = []; const r = pressCommand(g, g.witches[0], c, t, g.herTime, ev); return { r, ev }; };

describe("charges: berries fill them, up to the level's max (no drain)", () => {
  it("a berry gives an adult perBerry, capped at max; a full one has no room", () => {
    const { g, mine: [fox] } = scene([["fox", 2]]), P = commandProfile("fox", 2);
    expect(chargesOf(fox)).toBe(P.start);
    feed(g.berries, fox, 1, ON);
    expect(chargesOf(fox)).toBe(P.start + P.perBerry);
    expect(feedRoom(fox, g.berries, ON)).toBe(Math.ceil((P.max - P.start - P.perBerry) / P.perBerry));
    for (let i = 0; i < 5; i++) feed(g.berries, fox, 1, ON);
    expect(chargesOf(fox)).toBe(P.max);
    expect(feedRoom(fox, g.berries, ON)).toBe(0);
  });
  it("a youth's bar is its growth: a berry on a full bar evolves it, keeping its charges", () => {
    const { g, mine: [sq] } = scene([["squirrel", 1]]), P = commandProfile("squirrel", 1);
    expect(chargeRoom(sq)).toBe(Math.ceil((P.max - P.start) / P.perBerry) + 1);
    while (chargesOf(sq) < P.max) feed(g.berries, sq, 1, ON);
    expect(g.berries.evolving.has(sq.id)).toBe(false);
    feed(g.berries, sq, 1, ON);
    expect(g.berries.evolving.get(sq.id)?.to).toBe(2);
    expect(sq.cmd?.charges).toBe(P.max);
  });
  it("no drain: her followers' charges stay put however long she walks", () => {
    const { g, mine: [fox] } = scene([["fox", 2]]);
    feed(g.berries, fox, 1, ON);
    const had = chargesOf(fox);
    for (let i = 0; i < 3 / STEP; i++) stepGame(g, idle, STEP);
    expect(chargesOf(fox)).toBe(had);
  });
});

describe("the press", () => {
  it("spends one charge and starts that creature's own cooldown; another creature can act at once (no shared gap)", () => {
    const { g, mine: [badger, bee] } = scene([["badger", 2], ["bee", 2]], [["dormouse", 1]]);
    feed(g.berries, bee, 1, ON); feed(g.berries, badger, 1, ON);
    const n = chargesOf(bee);
    expect(pressNow(g).r).toBe("done");
    expect(chargesOf(bee)).toBe(n - 1);
    expect(bee.cmd!.cool).toBe(commandProfile("bee", 2).cooldown);
    expect(pressNow(g).ev[0].kind).toBe("fizzled"); // (cooling down)
    expect(chargesOf(bee)).toBe(n - 1);
    g.witches[0].leash.stack.reverse(); // (cycled: the badger at the bottom)
    expect(pressNow(g).ev[0].kind).toBe("cycled");
    expect(badger.cmd!.cool).toBe(commandProfile("badger", 2).cooldown);
    expect(commandProfile("badger", 2).cooldown).toBeGreaterThan(commandProfile("bee", 2).cooldown * 10); // (a spell, a machine gun)
  });
  it("a buff-giver's use puts its buff on her for its period; others give none", () => {
    const { g, mine: [fox, bee] } = scene([["fox", 2], ["bee", 2]]), W = g.witches[0];
    const darters = () => buffsOf(W.leash.stack, g.creatures, g.berries, ON).stacks;
    feed(g.berries, fox, 1, ON);
    expect(darters()).toEqual(buffsOf([], g.creatures, g.berries, ON).stacks); // (fed, but no passive buff)
    pressNow(g);
    expect(darters().darters).toBe(commandProfile("bee", 2).buffStacks);
    for (let t = 0; t < commandProfile("bee", 2).buffTime + 0.1; t += STEP) stepGame(g, idle, STEP);
    expect(darters().darters).toBe(0);
    expect(bee.cmd!.cool).toBe(0);
  });
  it("with no charges it fizzles, spending nothing; a legend never runs out but waits its longer cooldown", () => {
    const { g, mine: [sq] } = scene([["squirrel", 1]], [["dormouse", 1]]);
    sq.cmd = { charges: 0, cool: 0, buff: 0 };
    expect(pressNow(g).ev[0].kind).toBe("fizzled");
    const L = commandProfile("squirrel", 3);
    expect(L.max).toBe(Infinity);
    expect(L.cooldown).toBeCloseTo(commandProfile("squirrel", 2).cooldown * L.legendCooldown);
    sq.level = 3; sq.cmd = undefined;
    for (let i = 0; i < 3; i++) { expect(pressNow(g).ev[0].kind).toBe("cycled"); sq.cmd!.cool = 0; sq.cmd!.order = undefined; }
    expect(chargesOf(sq)).toBe(Infinity);
    expect(chargeMax(sq)).toBe(Infinity);
  });
  it("an action at a creature with nothing in reach fizzles, spending nothing", () => {
    const { g, mine: [fox] } = scene([["fox", 2]]);
    const n = chargesOf(fox);
    expect(pressNow(g).ev[0].kind).toBe("fizzled");
    expect(chargesOf(fox)).toBe(n);
  });
  it("within berries.feed.reach of a berry, with room, it eats instead; full, it commands", () => {
    const { g, mine: [fox] } = scene([["fox", 2]], [["dormouse", 1]]), W = g.witches[0];
    const q = g.berries.berries[0]; q.gone = false; q.claimedBy = null;
    const bush = g.berries.bushes[q.bush]; W.body.x = bush.x + 5; W.body.z = bush.z;
    fox.x = W.body.x - 2; fox.z = W.body.z;
    const foe = g.creatures.find(k => k.species === "dormouse")!; foe.x = W.body.x + 8; foe.z = W.body.z;
    expect(commandFeeds(g, W)).toBe(true);
    expect(pressNow(g).r).toBe("feed");
    fox.cmd = { charges: commandProfile("fox", 2).max, cool: 0, buff: 0 };
    expect(commandFeeds(g, W)).toBe(false);
    expect(pressNow(g).r).toBe("done");
  });
  it("does nothing in the treetops, nor with the switch off", () => {
    const { g } = scene([["bee", 2]]);
    g.witches[0].body.mode = "treetop";
    expect(pressNow(g).r).toBe(null);
    g.witches[0].body.mode = "ground";
    expect(pressNow(g, press, withTuning({ commands: { on: false } })).r).toBe(null); // (?commands=0)
  });
});

describe("targeting (section 3)", () => {
  const W0 = (creatures: Creature[], over: Partial<TargetWorld> = {}): TargetWorld => ({ x: 0, z: 0, witch: 0, aimX: 1, aimZ: 0, single: false, vx: 0, vz: 0, facing: 1, now: 10, creatures, ...over });
  const foe = (id: number, x: number, z: number, more: Partial<Creature> = {}) => ({ id, species: "dormouse", level: 1, x, z, leashed: false, gone: false, ...more }) as Creature;
  it("twin-stick: nearest her aim line within 20°, else her last letter's in 4 s, else the nearest fighting her, else the nearest", () => {
    const ahead = foe(0, 15, 2), side = foe(1, 0, 6, { fight: { target: { kind: "witch", id: 0 }, readyAt: 0, windupUntil: 0, aimX: 0, aimZ: 0 } }), near = foe(2, -4, 0);
    const cs = [ahead, side, near];
    expect(commandTarget(W0(cs), 20)?.id).toBe(0);
    expect(commandTarget(W0(cs, { aimX: -1, aimZ: 1, lastHit: { id: 1, at: 7 } }), 20)?.id).toBe(1);
    expect(commandTarget(W0(cs, { aimX: 0, aimZ: -1, lastHit: { id: 2, at: 5 } }), 20)?.id).toBe(1); // (its letter too long ago: the one fighting her)
    expect(commandTarget(W0([ahead, near], { aimX: 0, aimZ: -1 }), 20)?.id).toBe(2);
    expect(commandTarget(W0(cs), 3)).toBe(null);
  });
  it("single stick: her last letter's first, else nearest in 40° the way she's going", () => {
    const ahead = foe(0, 15, 2), behind = foe(1, -4, 0), cs = [ahead, behind];
    expect(commandTarget(W0(cs, { single: true, vx: 3, vz: 0, lastHit: { id: 1, at: 9 } }), 20)?.id).toBe(1);
    expect(commandTarget(W0(cs, { single: true, vx: 3, vz: 0 }), 20)?.id).toBe(0);
    expect(commandTarget(W0(cs, { single: true, vx: -3, vz: 0 }), 20)?.id).toBe(1);
  });
});

describe("the actions, carried out in the fight", () => {
  const run = (g: Game, s: number) => { for (let i = 0; i < s / STEP; i++) stepGame(g, idle, STEP); };
  it("Strike: the fox casts its own attack at the target", () => {
    const { g, mine: [fox], foes: [d] } = scene([["fox", 2]], [["dormouse", 1]]);
    expect(pressNow(g).ev[0].kind).toBe("cycled");
    run(g, 0.1);
    expect(fox.cmd!.order).toBeUndefined();
    expect(fox.fight?.target).toEqual({ kind: "creature", id: d.id });
    expect(fox.fight?.spellCast).toBeDefined();
  });
  it("Snare: the squirrel's acorn, then the target stunned", () => {
    const { g, mine: [sq], foes: [d] } = scene([["squirrel", 2]], [["dormouse", 1]]);
    pressNow(g);
    run(g, 0.1);
    expect(sq.cmd!.order?.verb).toBe("stun");
    run(g, 2.5);
    expect(d.stunUntil).toBeGreaterThan(0);
  });
  it("Guard: after its cast the badger taunts the wild round her and throws the nearest off her", () => {
    const { g, mine: [badger], foes: [d, e] } = scene([["badger", 2]], [["dormouse", 1], ["hare", 1]]), W = g.witches[0];
    e.x = W.body.x + 1; e.z = W.body.z + 5; e.tx = e.x; e.tz = e.z; // (the nearest, well inside the taunt's 10 m)
    pressNow(g);
    const taunted = new Set<number>();
    let thrownAt = -1;
    for (let i = 0; i < (commandProfile("badger", 2).cast + 0.4) / STEP; i++) {
      stepGame(g, idle, STEP);
      for (const ev of g.combat.events) if (ev.kind === "taunted") taunted.add(ev.id!);
      if (thrownAt < 0 && Math.hypot(e.kx ?? 0, e.kz ?? 0) > 50) thrownAt = g.clock.time;
    }
    expect(taunted.has(e.id)).toBe(true);
    expect(taunted.has(d.id) || Math.hypot(d.x - W.body.x, d.z - W.body.z) > 10).toBe(true);
    expect(e.taunt?.by).toBe(badger.id);
    expect(thrownAt).toBeGreaterThanOrEqual(commandProfile("badger", 2).cast - 1e-6); // (after its cast, not at the press)
    expect(Math.hypot(e.x - W.body.x, e.z - W.body.z)).toBeGreaterThan(10);
  });
});

describe("kept with the night, never in a module (docs/notes/module-state.md)", () => {
  it("charges, cooldowns, orders and poise are saved and loaded with the creature, and a save without them loads", () => {
    const { g, mine: [fox], foes: [d] } = scene([["fox", 2]], [["badger", 1]], withTuning({ commands: { on: true }, skill: { on: true } }));
    feed(g.berries, fox, 1, g.tuning); pressNow(g); noteLetter(d, g.tuning);
    const L = restoreGame(JSON.parse(JSON.stringify(snapshotGame(g))));
    expect(L.creatures[fox.id].cmd).toEqual(fox.cmd);
    expect(L.creatures[d.id].skill).toEqual(d.skill);
    // (an older night: no cmd, no skill on any creature: it loads, and each starts from its defaults)
    for (const c of g.creatures) { delete c.cmd; delete c.skill; }
    const O = restoreGame(JSON.parse(JSON.stringify(snapshotGame(g))));
    expect(chargesOf(O.creatures[fox.id])).toBe(commandProfile("fox", 2).start);
    stepGame(O, idle, STEP);
  });
  it("two games in one process keep their own: one's press changes nothing in the other", () => {
    const a = scene([["bee", 2]]), b = scene([["bee", 2]]);
    pressNow(a.g);
    expect(a.mine[0].cmd!.cool).toBeGreaterThan(0);
    expect(b.mine[0].cmd?.cool ?? 0).toBe(0);
    expect(chargesOf(b.mine[0])).toBe(commandProfile("bee", 2).start);
  });
});
