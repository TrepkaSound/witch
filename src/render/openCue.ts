// The open cue (?skill=1; docs/plans/combat-skill-and-commands.md, section 2; Ed, 2026-11-17, answer 8: "a glint or outline on the
// creature's sprite"): one look for every species, an outline on its own sprite in her magic's warm amber (an opening is hers to take:
// warm, never the attacker's element colour nor red), bright while it sits or is staggered, fading through its daze, faint while it
// winds up with its poise breakable (rules/skill/poise.ts openness). The sprite shader draws it from the instance's glow, -40 - k
// (render/sprites.ts). A staggered one wobbles in place (no stars: three circling stars mean she is slowed). And its poise as a thin
// arc on its meter ring, emptying as letters wear it and refilling (PoiseArcs). Cues only within her letters' range.
import type { Game } from "../rules/game";
import type { Creature } from "../rules/creatures";
import { openness, poiseShare, staggered } from "../rules/skill/poise";
import { skillOn } from "../rules/skill/profile";
import { bodyRadius } from "../rules/spacing";

/** The sprite glow that says "open, by k (0 to 1)" to the shader. */
export const OPEN_GLOW = -40;
/** Cues only within this many metres of her (her letters' range, invites.range). */
const cueRange = (g: Game): number => g.tuning.invites.range;

/** Its glow with the open cue: the cue when it's open and nothing brighter is on it (a hit's white flash, an evolving glow), else `glow`. */
export function openGlow(c: Creature, g: Game, glow: number): number {
  if (glow > 0 || !skillOn(g.tuning) || Math.hypot(c.x - g.witch.x, c.z - g.witch.z) > cueRange(g)) return glow;
  const k = openness(c, g.clock.time, g.tuning);
  return k > 0.01 ? OPEN_GLOW - Math.min(1, k) : glow;
}

/** How far a staggered one is drawn off its place (m): a quick wobble side to side. */
export const staggerWobble = (c: Creature, g: Game): number => (staggered(c, g.clock.time) ? Math.sin(g.clock.time * 38 + c.id) * 0.07 : 0);

/** Each worn creature's poise arc: a thin band round its middle, in amber, the share left lit (Ed: "a thin arc on its ring, emptying"). */
export class PoiseArcs {
  private els = new Map<number, HTMLDivElement>();
  constructor(private root: HTMLElement) {}

  /** This frame's arcs: `place` puts an element at a world point on the screen (render/invites.ts's), `tops` each creature's height. */
  update(g: Game, place: (el: HTMLElement, x: number, y: number, z: number) => void, tops: Map<number, number>, k: number): void {
    const seen = new Set<number>();
    if (skillOn(g.tuning)) for (const c of g.creatures) {
      if (c.gone || !c.skill || Math.abs(c.x - g.witch.x) > cueRange(g) || Math.abs(c.z - g.witch.z) > cueRange(g)) continue;
      const share = poiseShare(c, g.tuning);
      if (share === null) continue;
      seen.add(c.id);
      let el = this.els.get(c.id);
      if (!el) { el = document.createElement("div"); el.style.position = "absolute"; el.style.pointerEvents = "none"; el.style.borderRadius = "50%"; this.root.append(el); this.els.set(c.id, el); }
      const px = Math.round((bodyRadius(c) * 2 + 1.2) * 9 * k), deg = Math.round(share * 360);
      Object.assign(el.style, { width: `${px}px`, height: `${Math.round(px * 0.5)}px`, marginLeft: `${-px / 2}px`, marginTop: `${-px / 4}px`,
        background: `conic-gradient(rgba(240,184,100,.95) 0 ${deg}deg, rgba(240,184,100,.12) ${deg}deg 360deg)` });
      for (const m of ["mask", "-webkit-mask"]) el.style.setProperty(m, "radial-gradient(closest-side, transparent 78%, #000 80%)");
      place(el, c.x, Math.max(0.5, (tops.get(c.id) ?? 1.2) * 0.55), c.z);
    }
    for (const [id, el] of this.els) if (!seen.has(id)) { el.remove(); this.els.delete(id); }
  }

  /** Another night: every arc gone. */
  clear(): void { for (const el of this.els.values()) el.remove(); this.els.clear(); }
}
