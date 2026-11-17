// Single-stick aiming (Ed, 2026-11-16, from a playtest: "Hades is apparently single stick - you shoot in the direction you face - the
// playtester was much more familiar with this and found two sticks overwhelming - we could easily offer both with a toggle"; then
// "Single stick setting - yes, let's put a switch on the settings page for this"): the Settings page's Aiming (app/playerSettings.ts),
// platform/input.ts taking the aim off her controls, and rules/invites.ts homing her 💌s harder (invites.singleStick).
import { describe, expect, it } from "vitest";
import { newInvites, stepInvites, type Affection, type InviteControls } from "./invites";
import type { Creature } from "./creatures";
import { TUNING } from "./tuning";
import { STEP } from "./game";
import { Input } from "../platform/input";
import { localControls } from "../platform/inputRecording";
import { wireControls } from "../platform/online/guestInput";
import { clean, DEFAULTS } from "../app/playerSettings";

const critter = (deg: number, d = 12) => ({ id: 1, species: "wolf", level: 1, x: Math.cos((deg * Math.PI) / 180) * d, z: Math.sin((deg * Math.PI) / 180) * d, leashed: false, gone: false }) as Creature;
/** One 💌 thrown at time 0 by her at the origin, going `vx` m/s east: the way it left (degrees from east), and whether it landed. */
function thrown(c: InviteControls, creatures: Creature[], vx = 8, facing = 1) {
  const s = newInvites(), hits: number[] = [], A: Affection = { invitable: () => true, blocksLetters: () => false, hit: k => { hits.push(k.id); }, affection: () => 0 };
  let left = NaN, single: boolean | undefined;
  for (let i = 0, time = 0; i < 1.5 / STEP; i++, time += STEP) {
    stepInvites(s, { ...c, fire: i === 0 }, { x: 0, z: 0, facing, vx, vz: 0 }, true, creatures, A, time, STEP, TUNING);
    if (i === 0) { left = (Math.atan2(s.queue[0]?.az ?? s.az, s.queue[0]?.ax ?? s.ax) * 180) / Math.PI; single = s.letters[0]?.single; }
  }
  return { left, hits, single };
}

describe("single-stick aiming", () => {
  it("single stick: a 💌 thrown while she moves right flies right and homes onto a creature 25° off, and one 50° off, inside the stronger cone", () => {
    const S = TUNING.invites.singleStick!;
    expect([S.homing, S.cone, S.range]).toEqual([420, 80, 18]);
    expect(S.cone).toBeGreaterThan(TUNING.invites.homingCone);
    const near = thrown({ singleStick: true }, [critter(25)]);
    expect(near.left).toBeCloseTo(0, 9); expect(near.single).toBe(true); expect(near.hits).toEqual([1]);
    expect(thrown({ singleStick: true }, [critter(50)]).hits).toEqual([1]);
    // standing still: the way she faces
    expect(Math.abs(thrown({ singleStick: true }, [], 0, -1).left)).toBeCloseTo(180, 9);
  });
  it("twin stick: the aim follows the stick or cursor as before, with the plain homing (50° off is outside its 30° cone)", () => {
    const up = thrown({ singleStick: false, aimX: 0, aimZ: -5 }, []);
    expect(up.left).toBeCloseTo(-90, 9); expect(up.single).toBeUndefined();
    expect(thrown({ singleStick: false, aimX: 1, aimZ: 0 }, [critter(50)]).hits).toEqual([]);
    expect(thrown({ aimX: 1, aimZ: 0 }, [critter(50)]).hits).toEqual([]); // (controls that don't say: twin, as every older recording)
    expect(thrown({ aimX: 1, aimZ: 0 }, [critter(0)]).hits).toEqual([1]);
  });
  it("her controls' word holds for casts that don't say (a guest's cast on the host), until they say twin again", () => {
    const s = newInvites(), A: Affection = { invitable: () => false, blocksLetters: () => false, hit: () => {}, affection: () => null }, her = { x: 0, z: 0, facing: 1 };
    stepInvites(s, { singleStick: true }, her, true, [], A, 0, STEP, TUNING); expect(s.single).toBe(true);
    stepInvites(s, { fire: true, aimX: 0, aimZ: 1 }, her, true, [], A, STEP, STEP, TUNING); expect(s.letters[0].single).toBe(true);
    stepInvites(s, { singleStick: false }, her, true, [], A, 2 * STEP, STEP, TUNING); expect("single" in s).toBe(false);
  });
});

function fakeWindow() {
  const on: Record<string, ((e: unknown) => void)[]> = {};
  const addEventListener = (t: string, f: (e: unknown) => void) => (on[t] ??= []).push(f);
  return { w: { addEventListener } as unknown as Window, send: (t: string, e: object) => { for (const f of on[t] ?? []) f({ repeat: false, preventDefault() {}, ...e }); } };
}

describe("the Aiming setting", () => {
  it("is Twin stick unless chosen, and saved with the rest", () => {
    expect(DEFAULTS.aiming).toBe("twin");
    expect(clean({ aiming: "single" }).aiming).toBe("single");
    expect(clean({ aiming: "sideways" }).aiming).toBe("twin");
  });
  it("twin stick: the cursor aims; single stick: it doesn't, and her controls say so; touch is as ever", () => {
    const k = fakeWindow(), input = new Input(k.w);
    input.aimFrom = (x, y) => ({ x: x - 100, z: y - 100 });
    k.send("pointermove", { pointerType: "mouse", clientX: 130, clientY: 60 });
    const twin = input.read();
    expect([twin.aimX, twin.aimZ, twin.singleStick]).toEqual([30, -40, false]); expect(input.lastAim).toEqual({ x: 30, z: -40 });
    input.aiming = "single";
    k.send("keydown", { code: "KeyD" });
    const single = input.read();
    expect([single.aimX, single.aimZ, single.singleStick, single.moveX]).toEqual([0, 0, true, 1]); expect(input.lastAim).toBeNull();
    input.device = "touch";
    expect(input.read().singleStick).toBe(false);
  });
  it("travels in a recording's controls and a guest's wire controls", () => {
    const c = { moveX: 1, moveZ: 0, toggleMode: false, zoom: 0, fire: true, singleStick: true };
    expect(localControls(c)?.singleStick).toBe(true);
    expect(wireControls(c)?.singleStick).toBe(true);
    expect(wireControls({ ...c, singleStick: 1 })).toBeNull();
  });
});
