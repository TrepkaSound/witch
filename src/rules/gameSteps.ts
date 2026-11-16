// Named steps of a game step (rules/game.ts fixedStep calls them in order) that need nothing of game.ts but its types: her chains
// dragging and tugging, her animals' modes, the beach's witches, and everyone kept where they may be at the end of the step.
// Split from fixedStep's body: the same sums in the same order.
import type { Game, Motion } from "./game";
import { creaturesAshore, lakeKnobs, onLake } from "./lakes";
import { potionPhase } from "./mushrooms";
import { updateModes } from "./travel";
import { leashView } from "./houseGuard";
import { keepEnragedOut } from "./slowTime";
import { beginChains, chainLength, dragWitch } from "./chains";
import { pullsOf, stepPop, stepTug, tautKnobs, yankFrom } from "./tautChain";
import { newKnock } from "./knock";
import { pullOf } from "./spells";
import { stepBeachWitches } from "./beach";
import { landsOn } from "./treehouse";

/** Her chains: each witch dragging, and dragged by, what's on her leash (anchorFrom: where each stood before her step). */
export function dragByChains(g: Game, motions: Motion[], anchorFrom: { x: number; z: number }[], hdt: number): void {
  const t = g.tuning;
  // Her chains (Ed, 2026-11-03; rules/chains.ts): every creature on her leash at leash.chain.length; past it, moving away, she drags it,
  // slowed by the heaviest taut one (a legend's stops her), and it's pulled after her; sliding round the chain's end. Each witch by her
  // own; replaces the old 30 m anchor (and, on the ground, the sigils' pull: rules/witch.ts). Walking, blinking, flying or thrown; not
  // while she's knocked out, up in the treehouse (her followers guard home then: rules/houseGuard.ts), or in the zoo.
  // The taut chain (Ed, 2026-11-12; rules/tautChain.ts, one switch: leash.chain.taut): up in the treetops pulling past a chain's end
  // tugs her down, and pulled on far enough she comes down (never over a lake's water or onto a treehouse floor that way); on foot,
  // pulling a youth's or adult's chain slides its sigil out of her stack, and pulled on it's put down (rules/sigilButton.ts, below,
  // W.popDue); past a legend's she's yanked back toward it. A blow's throw, or a yank, isn't her pulling.
  beginChains();
  g.witches.forEach((W, i) => {
    if (chainLength(t) > 0 && !g.map.bounds.fence && !W.ko && !W.body.perch && !potionPhase(g, W)) {
      const r = dragWitch(W.body, anchorFrom[i], W.leash.stack, g.creatures, t, hdt, pullOf(W.spells)), B = r.body, { deck, ht } = motions[i], P = pullsOf(r.pulls);
      const hold = (!!g.map.bounds.lakes && onLake(g.map.bounds, B.x, B.z, lakeKnobs(t).pad)) || (!!deck && landsOn(deck, B.x, B.z));
      const thrown = !!W.knock && (!!W.knock.kx || !!W.knock.kz), pull = pullOf(W.spells);
      const T = stepTug(B, W.tug ?? 0, r.strain, hdt, t, pull, { hold, free: thrown }, W.tugRate ?? 0);
      W.body = T.body;
      if (T.tug > 0) W.tug = T.tug; else if (W.tug !== undefined) delete W.tug;
      if (T.rate > 0) W.tugRate = T.rate; else if (W.tugRate !== undefined) delete W.tugRate;
      const onFoot = W.body.mode === "ground" && !W.body.seated && !W.body.perch;
      const Pm = stepPop(W.pop ?? null, P, hdt, t, onFoot, pull, thrown);
      if (Pm.meter) W.pop = Pm.meter; else if (W.pop) delete W.pop;
      if (Pm.pop !== null) W.popDue = Pm.pop;
      const y = yankFrom(P, hdt, t, ht, W.yankAt, thrown);
      if (y !== null) {
        const Lg = g.creatures[y], dx = Lg.x - W.body.x, dz = Lg.z - W.body.z, d = Math.hypot(dx, dz) || 1, v = tautKnobs(t)!.yank.metres * t.witch.knock.ease;
        const k = (W.knock ??= newKnock()); k.kx = (dx / d) * v; k.kz = (dz / d) * v; k.at = ht; W.yankAt = ht; // (the knock's easing throw, no stagger)
        g.leashEvents.push({ kind: "yanked", id: y, x: W.body.x, z: W.body.z, at: ht });
      }
    } else { if (W.tug !== undefined) delete W.tug; if (W.tugRate !== undefined) delete W.tugRate; if (W.pop) delete W.pop; }
  });
}

/** Each witch's animals, posse or travelling (rules/travel.ts), from her leash as it stands (each motion's LV). */
export function noteLeashModes(g: Game, motions: Motion[]): void {
  const t = g.tuning;
  // (in the treehouse her followers guard home as if their sigils were placed there, her stack unchanged: rules/houseGuard.ts)
  for (const motion of motions) {
    const { W } = motion;
    const LV = leashView(W, g.creatures, g.map, t);
    updateModes(LV.stack, LV.placed, g.creatures, W.body, W.body.mode === "ground" && !W.body.seated && !W.body.perch && !W.ko, g.map, g.clock.time); // (posse or travelling: rules/travel.ts)
    motion.LV = LV;
  }
}

/** The beach's witches (rules/beach.ts) by where she is and how she moves. */
export function stepBeaches(g: Game, motions: Motion[], dt: number): void {
  if (g.beach) for (const s of g.beach) stepBeachWitches(s, motions.map(({ W, c }) => { const w = W.body; return { x: w.x, z: w.z, onFoot: w.mode === "ground" && !w.seated, moving: !w.stargazing && (Math.hypot(c.moveX, c.moveZ) > 0.05 || Math.hypot(w.vx, w.vz) > 0.3) || !!c.toggleMode }; }), g.clock.time, dt, g.tuning);
}

/** Everyone kept where they may be at the end of the step: out of a sleeping legend's circle, ashore of the lakes, inside the zoo's fences. */
export function keepInPlace(g: Game): void {
  const t = g.tuning;
  // Enraged creatures stay out of a sleeping or restless legend's circle (Ed, 2026-10-06).
  if (g.tuning.legendCircle?.slow.on !== false) keepEnragedOut(g);
  // And everyone on foot stays ashore of the lakes (rules/lakes.ts).
  if (g.map.bounds.lakes) creaturesAshore(g.creatures, g.map.bounds, lakeKnobs(t).pad);
  // And in the zoo every creature stays inside its island's fence, whatever moved it (rules/zooMap.ts); hers go where she goes.
  const F = g.map.bounds.fence;
  if (F) for (const c of g.creatures) {
    if (c.gone || c.leashed) continue;
    const I = F.ofCell(c.cell[0], c.cell[1]);
    if (I) { const p = F.keepIn(I, c.x, c.z); c.x = p.x; c.z = p.z; }
  }
}
