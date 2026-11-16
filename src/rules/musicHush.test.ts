// The haunted hush (Ed, 2026-11-16: "Make it 8 bars"): a haunted breakdown in the form is 12 bars, 8 quiet and then its 4-bar
// drum & bass drop; everything else lands where it did, and ?hauntedhush=old is the music as it was.
import { describe, expect, it } from "vitest";
import styleJson from "../../config/music-style.json";
import { bangerRole, hookHeard, withBanger } from "./musicBanger";
import { hauntedDrop, hushStretch, passAt, withHush } from "./musicHush";
import { Conductor, formClock, planBlock, type MusicCue } from "./musicPlan";
import { arcStep, isHaunted, musicSeed, notesAt, resolveSection, withHaunted, type MusicStyle, type NoteEvent } from "./musicScore";
import { nightStyle, planNight } from "./musicSet";
import { TUNING } from "./tuning";

const base = styleJson as unknown as MusicStyle, old = withHush(base, 4), H = base.haunted!;
const night = (seed: number) => nightStyle(base, planNight(base, { seed, island: "owl", waves: 10 }));
const cueOf = (w: number, extra: Partial<MusicCue> = {}): MusicCue => ({ waves: Array(w).fill(0), nextAt: Infinity, bootUntil: 0, knockedOut: false, siege: 0, ...extra });
function barNotes(style: MusicStyle, seed: number, cue: MusicCue, bar: number): NoteEvent[] {
  const C = new Conductor(style), p = C.plan(cue, bar), f = formClock(style, cue, bar), out: NoteEvent[] = [];
  for (let s = 0; s < 16; s++) out.push(...notesAt(style, p, null, bar * 16 + s, { seed: musicSeed(seed, f.n), formStart: f.start, siege: 0, only: "main" }));
  return out;
}
const isDrum = (style: MusicStyle, e: NoteEvent) => e.midi === null && !/riser|impact|snap|crash/i.test(e.patch) && style.patches[e.patch]?.kind !== "riser";

describe("the haunted hush: 8 quiet bars before the drop (Ed, 2026-11-16: \"Make it 8 bars\")", () => {
  it("is the style's and the tuning's: 8 bars, the breakdown lengthened by 4", () => {
    expect(H.drop.afterBars).toBe(8); expect(H.drop.stretch).toBe(4); expect(TUNING.music.hauntedHush).toBe(8);
    expect(hushStretch(base, "breakdown")).toBe(4); expect(hushStretch(base, "deep")).toBe(0);
    expect(hushStretch(withHaunted(base, false), "breakdown")).toBe(0); expect(hushStretch(old, "breakdown")).toBe(0);
    expect(withHush(base, 8)).toBe(base); expect(withHush(base, undefined)).toBe(base); expect(withHush(base, 4)).toBe(old);
    expect(hauntedDrop(base, 12)).toBe(8); expect(hauntedDrop(base, 8)).toBe(4); expect(hauntedDrop(old, 8)).toBe(4);
  });

  it("plans a haunted breakdown 12 bars long, every wave and pass, the rest of the pass as it was", () => {
    for (const seed of [7, 23, 101]) {
      const style = night(seed);
      for (let w = 0; w < style.arc.length; w++) {
        const S = arcStep(style, w).sections!, cue = cueOf(w);
        let at = 0;
        for (let pass = 0; pass < 5; pass++) {
          const sec = S.breakdown[pass % S.breakdown.length];
          expect(isHaunted(style, sec), `${seed} ${w} ${sec}`).toBe(true); // (every family's breakdown is a haunted section)
          expect(planBlock(style, cue, at)).toMatchObject({ start: at, bars: 16, pass });
          expect(planBlock(style, cue, at + 16)).toMatchObject({ section: S.breaks[pass % S.breaks.length], start: at + 16, bars: 8, pass });
          for (const b of [24, 28, 32]) expect(planBlock(style, cue, at + b)).toMatchObject({ section: sec, start: at + 24, bars: 12, pass });
          expect(passAt(style, S, at + 35)).toMatchObject({ pass, at, extra: 4 });
          at += 36;
        }
      }
    }
  });

  it("keeps all 12 bars a breakdown: the hook slow for 8 bars, then whole with the drum & bass for 4", () => {
    for (const seed of [7, 23, 101]) {
      const style = withBanger(night(seed), true);
      for (let w = 2; w < style.arc.length; w++) for (const top of [0, 36]) {
        const cue = cueOf(w), C = new Conductor(style);
        for (let b = 24; b < 36; b++) {
          const bar = top + b, p = C.plan(cue, bar), sec = resolveSection(style, p.section), fs = formClock(style, cue, bar).start;
          expect(bangerRole(style, p, arcStep(style, p.arc), sec, fs), `${seed} ${w} ${bar}`).toBe("breakdown");
          expect(hookHeard(style, p, sec, bar, fs)).toBe(b < 32 ? "slow" : "whole");
          const es = barNotes(style, seed, cue, bar);
          expect(es.some(e => /^dnb/.test(e.patch)), `${seed} ${w} ${bar}`).toBe(b >= 32);
          if (b < 32) expect(es.filter(e => style.patches[e.patch]?.kind === "kick" || e.patch === "snare")).toEqual([]);
        }
        expect(barNotes(style, seed, cue, top + 32).some(e => e.patch === "impact")).toBe(true);
        for (const b of [30, 31]) expect(barNotes(style, seed, cue, top + b).some(e => /riser/i.test(e.patch))).toBe(true);
        for (const b of [24, 27, 29]) expect(barNotes(style, seed, cue, top + b).some(e => /riser/i.test(e.patch))).toBe(false);
      }
    }
  });

  it("without banger mode too: no drums for 8 bars, then the drum & bass", () => {
    const style = withBanger(night(7), false), cue = cueOf(3);
    for (let b = 24; b < 36; b++) {
      const es = barNotes(style, 7, cue, b);
      expect(es.some(e => style.parts[e.part]?.role === "drum" && isDrum(style, e)), `bar ${b}`).toBe(b >= 32);
    }
  });

  it("has the form's clock wait out the added bars: the quiet sings the C phrase whole, the drop its second half again", () => {
    const cue = cueOf(2, { waves: [0, 8] }), L = 32;
    for (let k = 0; k < 110; k++) {
      const bar = 8 + k, fb = bar - formClock(base, cue, bar).start, pass = Math.floor(k / 36), pos = k - pass * 36;
      expect(fb, `bar ${bar}`).toBe(pass * L + (pos < 32 ? pos : pos - 4));
    }
    // (held through a build and the victory: no step back under either)
    const build = cueOf(2, { nextAt: 40 }), won = cueOf(2, { victory: 34 });
    expect(planBlock(base, build, 32).section).toBe(arcStep(base, 2).build);
    for (let b = 32; b < 40; b++) expect(formClock(base, build, b).start).toBe(0);
    for (let b = 32; b < 120; b++) expect(formClock(base, won, b).start).toBe(0);
  });

  it("leaves the waves, the builds, a knockdown's new record and the victory where they were", () => {
    const cues = [cueOf(1, { waves: [36], bootUntil: 8, nextAt: 200 }), cueOf(3, { nextAt: 61 }), cueOf(2, { knockdowns: [{ at: 41.5, back: 47 }] }), cueOf(4, { victory: 50 })];
    for (const cue of cues) for (let b = 0; b < 240; b += 4) {
      const n = planBlock(base, cue, b), o = planBlock(old, cue, b), special = [base.intro, base.victory, arcStep(base, n.arc).build];
      if (special.includes(o.section) || special.includes(n.section)) expect(n, `bar ${b}`).toEqual(o);
      expect(n.wave).toBe(o.wave); expect(n.arc).toBe(o.arc);
    }
    const k = cues[2];
    expect(formClock(base, k, 46).n).toBe(0); expect(formClock(base, k, 47)).toEqual({ start: 47, n: 1 });
    expect(new Conductor(base).plan(k, 47).start).toBe(47);
    expect(new Conductor(base).plan(k, 47 + 25)).toMatchObject({ start: 47 + 24, bars: 12 });
  });

  it("plays the old 4-bar hush to the note with ?hauntedhush=old, and the drop itself as it was", () => {
    const style = withBanger(night(23), true), was = withBanger(withHush(night(23), 4), true), cue = cueOf(4);
    for (let b = 0; b < 32; b += 4) expect(planBlock(was, cue, b + 64)).toMatchObject({ pass: 2, bars: b < 16 ? 16 : 8 });
    for (let b = 0; b < 96; b++) expect(formClock(was, cue, b).start).toBe(0);
    // (the first 24 bars the same; the old breakdown's quiet half is the new one's first four bars but for its riser)
    const sig = (es: NoteEvent[], shift = 0) => es.map(e => `${e.patch}@${e.step - shift * 16}+${e.offset}:${e.midi}:${e.dur}:${e.vel.toFixed(4)}`).sort();
    for (let b = 0; b < 26; b++) expect(sig(barNotes(style, 23, cue, b)), `bar ${b}`).toEqual(sig(barNotes(was, 23, cue, b)));
    // (the drop: the same parts, four bars later; its last bar's fill is dealt by the bar)
    const parts = (es: NoteEvent[]) => [...new Set(es.map(e => e.patch))].sort();
    for (let b = 28; b < 31; b++) expect(parts(barNotes(style, 23, cue, b + 4)), `drop bar ${b}`).toEqual(parts(barNotes(was, 23, cue, b)));
  });
});
