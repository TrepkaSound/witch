// The guardrails (docs/notes/guardrails.md): the import-loop check (tools/checks/loops.mjs) and the size ratchet
// (tools/checks/size.mjs), on small made-up file sets: what counts as a value import, what a new loop edge is, what may grow.
import { describe, expect, it } from "vitest";
// @ts-expect-error (a plain .mjs tool, no types)
import { graphOf, loopsOf, newLoopEdges, valueImports } from "./loops.mjs";
// @ts-expect-error (a plain .mjs tool, no types)
import { functionsOf, grown, lineCount } from "./size.mjs";

describe("import loops", () => {
  it("counts value imports and re-exports, not type-only ones or packages", () => {
    const text = [
      `import type { A } from "./a";`, `import { type B } from "./b";`, `import { type C, d } from "./c";`, `import e from "./e";`,
      `import "./f";`, `export { g } from "./g";`, `export type { H } from "./h";`, `import * as three from "three";`,
      `const lazy = () => import("./lazy");`,
    ].join("\n");
    expect(valueImports(text)).toEqual(["./c", "./e", "./f", "./g"]);
  });

  it("finds the loops and only new edges inside them", () => {
    const base = { "src/a.ts": `import "./b";`, "src/b.ts": `import "./a";`, "src/c.ts": `import "./a";` };
    const baseG = graphOf(base);
    expect(loopsOf(baseG)).toEqual([["src/a.ts", "src/b.ts"]]);
    // a new loop (a -> c closes c -> a), and removing an edge passes
    const worse = graphOf({ ...base, "src/a.ts": `import "./b"; import "./c";` });
    expect(newLoopEdges(baseG, worse).map((e: { from: string; to: string }) => `${e.from}>${e.to}`)).toEqual(["src/a.ts>src/c.ts"]);
    expect(newLoopEdges(baseG, graphOf({ ...base, "src/b.ts": `` }))).toEqual([]);
    // a new edge outside any loop is fine
    expect(newLoopEdges(baseG, graphOf({ ...base, "src/d.ts": `import "./a";` }))).toEqual([]);
    // a renamed file keeps its edges
    const renamed = graphOf({ "src/a2.ts": `import "./b";`, "src/b.ts": `import "./a2";`, "src/c.ts": `import "./a2";` });
    expect(newLoopEdges(baseG, renamed, new Map([["src/a.ts", "src/a2.ts"]]))).toEqual([]);
    // an excused importer
    expect(newLoopEdges(baseG, worse, new Map(), ["src/a.ts"])[0].excused).toBe(true);
  });
});

describe("the size ratchet", () => {
  const body = (n: number) => Array.from({ length: n }, (_, i) => `  const v${i} = ${i};`).join("\n");
  const fn = (name: string, n: number) => `export function ${name}() {\n${body(n - 2)}\n}\n`;

  it("measures top-level functions and class methods", () => {
    const fns = functionsOf(`${fn("big", 160)}const arrow = () => {\n  return 1;\n};\nclass K {\n  m() {\n    return 2;\n  }\n}\n`);
    expect(Object.fromEntries(fns)).toEqual({ big: 160, arrow: 3, "K.m": 3 });
    expect(lineCount("a\nb\n")).toBe(2);
  });

  it("lets big things shrink, not grow; fails new big ones; follows moves; honours an excuse", () => {
    const base = { "src/x.ts": fn("big", 160) };
    expect(grown(base, { "src/x.ts": fn("big", 155) })).toEqual([]);
    expect(grown(base, { "src/x.ts": fn("big", 161) })).toMatchObject([{ file: "src/x.ts", fn: "big", was: 160, now: 161 }]);
    expect(grown(base, { ...base, "src/y.ts": fn("fresh", 151) })).toMatchObject([{ file: "src/y.ts", fn: "fresh", was: 0 }]);
    expect(grown(base, { "src/y.ts": fn("big", 160) })).toEqual([]); // moved to another file
    expect(grown(base, { "src/x.ts": fn("big", 161) }, new Map(), ["src/x.ts#big"])[0].excused).toBe(true);
    const longFile = (n: number) => Array.from({ length: n }, (_, i) => `export const c${i} = ${i};`).join("\n") + "\n";
    expect(grown({ "src/f.ts": longFile(900) }, { "src/f.ts": longFile(850) })).toEqual([]);
    expect(grown({ "src/f.ts": longFile(900) }, { "src/f.ts": longFile(901) })).toMatchObject([{ file: "src/f.ts", was: 900, now: 901 }]);
    expect(grown({ "src/f.ts": longFile(700) }, { "src/f.ts": longFile(801) })).toMatchObject([{ file: "src/f.ts", was: 700, now: 801 }]);
    expect(grown({ "src/f.ts": longFile(900) }, { "src/g.ts": longFile(900) }, new Map([["src/f.ts", "src/g.ts"]]))).toEqual([]);
  });
});
