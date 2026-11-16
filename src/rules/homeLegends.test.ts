// Home legends (rules/homeLegends.ts; Ed, 2026-11-15): a route legend back home stands "Exactly like the home legend", where the
// home legend stands and apart from it; and "Both home legends and returned route legends should be invitable in this way": the
// party egg's 100 letters, the leash that pins her, and, let go, back to guarding. ?homelegends=old (legends.homeAlike off): as before.
import { describe, expect, it } from "vitest";
import { generateMap } from "./map";
import { guardsHome, homePost, POST_GAP, spawnCreatures, type Creature } from "./creatures";
import { TUNING, withTuning } from "./tuning";
import { homeArea } from "./homeArea";
import { affectionOf, stepGame, type Game } from "./game";
import { hasRune, partyEggOpen, stateOf } from "./creatureStates";
import { letPartyLegendGo } from "./leash";
import { runeOffset } from "./runeOffset";
import { backToGuarding, isHomeLegend, likeHomeLegend } from "./homeLegends";
import { preppedGame } from "../test/preppedGame"; // (games on a map made once a file from its prep)

const T = withTuning({ map: { ...TUNING.map!, island: "tiger", islandAreas: 10 } });
const C = { moveX: 0, moveZ: 0, toggleMode: false, zoom: 0, autoTalk: false };
const returned = (id: number, more: Partial<Creature> = {}) => ({ id, species: "fox", level: 3, boss: true, legendState: "happy", x: 0, z: 0, gone: false, leashed: false, ...more }) as Creature;

describe("where a returned route legend stands", () => {
  const map = generateMap(11, T), creatures = spawnCreatures(map), own = creatures.find(c => c.homeGuard)!, H = homeArea(map);

  it("with no home legend there, exactly where the home legend would stand", () => {
    expect(homePost(map, [], returned(900))).toEqual({ x: own.lairX, z: own.lairZ });
  });

  it("with the island's home legend and other returned legends, each a spot of its own by the same rule: inside home, POST_GAP apart", () => {
    const all = [...creatures], posts = [{ x: own.lairX!, z: own.lairZ! }];
    for (let i = 0; i < 4; i++) {
      const c = returned(all.length), p = homePost(map, all, c);
      c.journey = { stage: "guard", home: true, ...p }; all.push(c); posts.push(p);
      expect(H.inside(p.x, p.z)).toBe(true);
    }
    for (let i = 0; i < posts.length; i++) for (let k = i + 1; k < posts.length; k++) expect(Math.hypot(posts[i].x - posts[k].x, posts[i].z - posts[k].z)).toBeGreaterThanOrEqual(POST_GAP);
    expect(homePost(map, creatures, returned(901))).toEqual(posts[1]); // (the same every time: the island's seed)
  });
});

describe("which legends guard like the home legend", () => {
  it("the home legend; a returned route legend under the new rule; not one from ?homelegends=old or an older save, nor one on her leash or partying", () => {
    expect(likeHomeLegend(returned(1, { homeGuard: true }))).toBe(true);
    expect(likeHomeLegend(returned(1, { journey: { stage: "guard", home: true, x: 1, z: 1 } }))).toBe(true);
    expect(likeHomeLegend(returned(1, { journey: { stage: "guard", x: 1, z: 1 } }))).toBe(false);
    expect(likeHomeLegend(returned(1, { journey: { stage: "back" } }))).toBe(false);
    expect(likeHomeLegend(returned(1, { journey: { stage: "guard", home: true }, partyLegend: true }))).toBe(false);
  });
});

describe("the party egg for home legends", () => {
  function game(): { g: Game; L: Creature } {
    const g = preppedGame(11, T);
    g.clock.paused = false; g.party.spellAt = undefined; g.clearedAt = Infinity;
    const L = g.creatures.find(c => c.homeGuard)!;
    for (const c of g.creatures) if (c !== L && Math.hypot(c.x - L.x, c.z - L.z) < 60) c.gone = true; // (no crowd round it to jostle her)
    g.byArea = null;
    g.witch = { ...g.witch, x: L.x + 4, z: L.z, vx: 0, vz: 0, seated: false, mode: "ground", lift: 0 };
    return { g, L };
  }
  const fill = (g: Game, L: Creature, n: number) => { const A = affectionOf(g); for (let i = 0; i < n; i++) A.hit(L, TUNING.invites.amount, g.clock.time); };
  const press = (g: Game) => { stepGame(g, { ...C, place: true }, 1 / 60); stepGame(g, C, 1 / 60); };

  it("the island's home legend takes letters; the 100th makes it a party legend; leashed it pins her; put down, it goes back to guarding", () => {
    const { g, L } = game(), A = affectionOf(g), E = g.tuning.legends, at = { x: L.x, z: L.z };
    expect(A.invitable(L)).toBe(true); expect(A.blocksLetters(L)).toBe(false);
    fill(g, L, E.partyHits - 1);
    expect(L.partyLegend).toBeFalsy(); expect(hasRune(L)).toBe(false);
    fill(g, L, 1);
    expect(L.partyLegend).toBe(true); expect(L.dancing).toBe(true); expect(hasRune(L, g.clock.time)).toBe(true);
    g.witch = { ...g.witch, x: L.x + 1, z: L.z + runeOffset(L, g.tuning) }; // (on its rune, south of it)
    press(g);
    expect(L.leashed).toBe(true); expect(g.leash.stack).toContain(L.id);
    // She can't go a step past partyReach of it, and it never comes to her.
    for (let i = 0; i < 240; i++) { g.witches[0].health.hp = 99; stepGame(g, { ...C, moveX: 1 }, 1 / 60); }
    expect(Math.hypot(g.witch.x - L.x, g.witch.z - L.z)).toBeLessThanOrEqual(E.partyReach + 1e-6);
    expect({ x: L.x, z: L.z }).toEqual(at);
    press(g); // (its sigil put down)
    expect(L.leashed).toBe(false); expect(g.leash.stack).not.toContain(L.id);
    expect(L.partyLegend).toBeUndefined(); expect(L.dancing).toBe(false); expect(stateOf(L)).toBe("happy"); expect(L.legendState).toBe("happy");
    expect(guardsHome(L)).toBe(true); expect(likeHomeLegend(L)).toBe(true); expect({ x: L.x, z: L.z }).toEqual(at);
    expect(hasRune(L, g.clock.time)).toBe(false);
    expect(affectionOf(g).invitable(L)).toBe(true); // (and it can be given letters again, from nothing)
    for (let i = 0; i < 120; i++) { g.witches[0].health.hp = 99; stepGame(g, { ...C, moveX: 1 }, 1 / 60); }
    expect(Math.hypot(g.witch.x - L.x, g.witch.z - L.z)).toBeGreaterThan(E.partyReach); // (she's free)
  });

  it("with ?homelegends=old the home legend refuses letters as before", () => {
    const { g, L } = game();
    (g as { tuning: typeof TUNING }).tuning = { ...g.tuning, legends: { ...g.tuning.legends, homeAlike: false } };
    const A = affectionOf(g);
    expect(A.invitable(L)).toBe(false); expect(A.blocksLetters(L)).toBe(true);
    fill(g, L, g.tuning.legends.partyHits);
    expect(L.partyLegend).toBeFalsy();
  });

  it("a returned route legend takes the egg too, and let go it goes back to guarding; one from ?homelegends=old stays a party legend as before", () => {
    const now = returned(1, { journey: { stage: "guard", home: true, posted: true, x: 3, z: 4 } }), old = returned(2, { journey: { stage: "guard", x: 3, z: 4 } });
    for (const c of [now, old]) {
      expect(partyEggOpen(c)).toBe(true);
      Object.assign(c, { partyLegend: true, leashed: true, state: "leashed", dancing: true });
      expect(guardsHome(c)).toBe(false);
      letPartyLegendGo(c);
      expect(c.leashed).toBe(false);
    }
    expect(isHomeLegend(now)).toBe(true); expect(now.partyLegend).toBeUndefined(); expect(guardsHome(now)).toBe(true); expect(likeHomeLegend(now)).toBe(true);
    expect(isHomeLegend(old)).toBe(false); expect(old.partyLegend).toBe(true); expect(old.dancing).toBe(true); expect(guardsHome(old)).toBe(false);
    const c = returned(3, { homeGuard: true, partyLegend: true, leashed: true, state: "leashed" }); backToGuarding(c);
    expect([c.partyLegend, c.leashed, c.state]).toEqual([undefined, false, "happy"]);
  });
});
