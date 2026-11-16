// The haunted hush (Ed, 2026-11-16, asked whether the 4 quiet bars before a haunted breakdown's drum & bass drop should be
// longer: "Make it 8 bars"): the form's breakdown, 8 bars (4 quiet, 4 dropped), is lengthened by the style's
// `haunted.drop.stretch` (4) to 12: 8 quiet, then the same 4-bar drop. A pass round the form is then 36 bars, not 32; the form's
// own clock (its chords and phrases, 32 bars round) waits out the added bars, so the quiet sings the whole of the C phrase and
// the drop plays its second half again, as it always has. The waves, builds, knockdowns and the victory land where they did.
// ?hauntedhush=old (the tuning's music.hauntedHush under the style's 8) is the breakdown as it was, to the note.
import type { ArcStep, MusicStyle } from "./musicScore";

/** The bar (into a haunted section) its drum & bass drops on: `afterBars`, leaving the drop a block at least, on a block line
 *  (an 8-bar section 4 quiet and 4 dropped, a 12-bar one 8 and 4, a 16-bar one 8 and 8); Infinity for none (a section too short
 *  for both). */
export function hauntedDrop(style: MusicStyle, bars: number): number {
  const H = style.haunted, B = Math.max(1, style.blockBars);
  if (!H) return Infinity;
  const at = Math.floor(Math.min(H.drop.afterBars, bars - B) / B) * B;
  return at >= B && at < bars ? at : Infinity;
}

/** The bars a form's breakdown is lengthened by when it plays `section`: the style's stretch (whole blocks) where the haunted
 *  treatment is on and the section is one of its own, else 0. */
export function hushStretch(style: MusicStyle, section: string | undefined): number {
  const H = style.haunted, B = Math.max(1, style.blockBars);
  if (!H || H.on === false || !section || !H.sections.includes(section)) return 0;
  return Math.max(0, Math.floor((H.drop.stretch ?? 0) / B) * B);
}

/** Where `k` bars into a wave's form (from the block its wave landed on, or a knockdown's new record) falls: the pass round the
 *  form, the bar that pass began on, the bars its breakdown is lengthened by, and `shift`, the added bars the form's own clock
 *  has waited out by then (every earlier pass's, and this one's once its 32 bars are done: the drop's bars). */
export function passAt(style: MusicStyle, S: NonNullable<ArcStep["sections"]>, k: number): { pass: number; at: number; extra: number; shift: number } {
  const F = style.form!, L = F.order.length * F.phraseBars, extras = S.breakdown.map(s => hushStretch(style, s));
  if (!extras.some(Boolean) || k < 0) { const pass = Math.max(0, Math.floor(k / L)); return { pass, at: pass * L, extra: 0, shift: 0 }; }
  // (whole rounds of the breakdowns' list at once, then pass by pass)
  const round = extras.reduce((n, e) => n + L + e, 0), rounds = Math.floor(k / round);
  let pass = rounds * extras.length, at = rounds * round;
  while (k >= at + L + extras[pass % extras.length]) { at += L + extras[pass % extras.length]; pass++; }
  const extra = extras[pass % extras.length];
  return { pass, at, extra, shift: at - pass * L + (k - at >= L ? extra : 0) };
}

const HUSH_AS = new WeakMap<MusicStyle, MusicStyle>();
/** The style with the haunted hush of `bars` quiet bars (tuning music.hauntedHush, ?hauntedhush=old): under the style's own
 *  (`afterBars`), the form's breakdown as it was, not lengthened; else, or with no word, the style itself. */
export function withHush(style: MusicStyle, bars: number | undefined): MusicStyle {
  const H = style.haunted;
  if (bars === undefined || !H || !H.drop.stretch || bars >= H.drop.afterBars) return style;
  let out = HUSH_AS.get(style);
  if (!out) HUSH_AS.set(style, (out = { ...style, haunted: { ...H, drop: { ...H.drop, stretch: 0 } } }));
  return out;
}
