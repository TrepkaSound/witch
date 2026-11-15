// The stale-ruling check (tools/docs/rulings.mjs; Ed, 2026-11-15, on keeping the notes honest automatically: "Do 1-7"): its parts
// read citations, passages and wrong numbers as they should; the rules pages' `path#name` references resolve; and the files it
// reads from parse. The warnings themselves fail nothing: CI prints them (check-work).
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
// @ts-expect-error (a plain .mjs tool, no types)
import { about, check, citations, passages, wrongNumbers } from "./rulings.mjs";

describe("the stale-ruling check", () => {
  it("reads Ed's citations: the date, in either form, and the quote that follows it", () => {
    expect(citations('x (Ed, 2026-10-31: "No, no baby is invitable"; `invitable`) and Ed 2026-11-03, then (Ed, 4 November: "split, keep nightly")')).toEqual([
      { date: "2026-10-31", quote: "No, no baby is invitable" },
      { date: "2026-11-03", quote: "" },
      { date: "2026-11-04", quote: "split, keep nightly" },
    ]);
    expect(citations("Edge, 2026-10-31 and Fred, 2026-10-31")).toEqual([]);
  });

  it("splits code into comment blocks with the declaration under them, notes into lines, knob notes into strings", () => {
    const code = '// One (Ed, 2026-10-04).\n// Two.\nexport function grow(): void {}\nconst a = 1; // trailing (Ed, 2026-10-05)\nconst url = "http://x"; if (a) {}\n';
    expect(passages("src/rules/x.ts", code)).toEqual([
      { line: 1, text: "One (Ed, 2026-10-04). Two.", symbol: "grow" },
      { line: 4, text: "trailing (Ed, 2026-10-05)", symbol: "a" },
    ]);
    expect(passages("docs/notes/x.md", "# T\n\n- **Name** (Ed, 2026-10-04): y\n").map((p: { symbol?: string }) => p.symbol)).toEqual([undefined, "Name"]);
    const knob = JSON.stringify({ knobs: { "invites.range": { what: "How far a letter flies.", decisions: [{ by: "Ed", date: "2026-11-09", quote: "ranges feel small" }] } } });
    expect(passages("config/knobs/x.json", knob).map((p: { key: string; text: string }) => [p.key, p.text])).toEqual([
      ["invites.range", "How far a letter flies."], ["invites.range", 'Ed, 2026-11-09: "ranges feel small"'],
    ]);
  });

  it("finds a knob named with a number that is not the tuning's, and lets the past, ranges and rounding be", () => {
    const tuning = { invites: { range: 42 }, cast: { on: true }, leash: { runeRadius: 5.625 } };
    expect(wrongNumbers("within `invites.range` 33 m of her", tuning)).toEqual([{ knob: "invites.range", said: 33, live: 42 }]);
    expect(wrongNumbers("`invites.range` 42 (was 33); `invites.range` was 33; invites.range (42); `leash.runeRadius` (5.6 m)", tuning)).toEqual([]);
    expect(wrongNumbers("`invites.range` 30 to 50, `invites.range` = 33 m then", tuning)).toEqual([]);
    expect(wrongNumbers("`cast.on` false (the default)", tuning)).toEqual([{ knob: "cast.on", said: false, live: true }]);
    expect(wrongNumbers("drawn with `cast.on` false", tuning)).toEqual([]);
  });

  const result = check() as { rulings: { date: string; quote: string; file: string; topics: string[]; text: string }[]; warnings: { kind: string; file: string; message: string }[]; unusedOk: string[] };

  it("reads the repo's rulings, and lists them by topic, newest first", () => {
    expect(result.rulings.length).toBeGreaterThan(1000);
    const list = about("invitable", result.rulings);
    expect(list.some(r => r.date === "2026-10-31" && /no baby is invitable/i.test(r.quote))).toBe(true);
    expect(list.map(r => r.date)).toEqual(list.map(r => r.date).sort().reverse());
  });

  it("the rules pages' code references resolve (a page that names a file or a name that is gone is itself stale)", () => {
    expect(result.warnings.filter(w => w.kind === "ref").map(w => `${w.file}: ${w.message}`)).toEqual([]);
  });

  it("its two lists parse and every acknowledged warning still matches one", () => {
    const root = path.resolve(__dirname, "../..");
    const replaced = JSON.parse(fs.readFileSync(path.join(root, "docs/rules/replaced.json"), "utf8")).replaced as { id: string; ruling: string; now: string; stale: string[]; unless?: string }[];
    expect(replaced.length).toBeGreaterThan(0);
    for (const r of replaced) {
      expect(r.id && r.ruling && r.now && r.stale.length, r.id).toBeTruthy();
      for (const s of [...r.stale, ...(r.unless ? [r.unless] : [])]) expect(() => new RegExp(s, "i"), `${r.id}: ${s}`).not.toThrow();
    }
    expect(new Set(replaced.map(r => r.id)).size).toBe(replaced.length);
    expect(result.unusedOk).toEqual([]);
  });

  it("catches the comment that started it: babies that 'stay invitable'", () => {
    const replaced = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../docs/rules/replaced.json"), "utf8")).replaced as { id: string; stale: string[]; unless?: string }[];
    const rule = replaced.find(r => r.id === "babies-invitable")!;
    const hit = (t: string) => rule.stale.some(s => new RegExp(s, "i").test(t)) && !(rule.unless && new RegExp(rule.unless, "i").test(t));
    expect(hit("Babies stay invitable while they are wild.")).toBe(true);
    expect(hit("No baby is invitable (Ed, 2026-10-31).")).toBe(false);
  });
});
