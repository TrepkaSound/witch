// The release's bench declarations (tools/release/combine-bench.mjs): combined from its PRs', and the ones nothing reads any
// more cleared (the released PRs' own, earlier releases' combined ones), on a throwaway folder.
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
// @ts-expect-error (a plain .mjs tool, no types)
import { combine, stale } from "../release/combine-bench.mjs";

describe("a release's bench declarations", () => {
  it("combines its PRs' declarations", () => {
    const out = combine("9", [{ num: "1", ref: "claude/a", e: { reason: "A", rules: { creatures: "why a" } } },
      { num: "2", ref: "claude/b", e: { reason: "B", rules: { creatures: "why b" }, frames: { boot: "look" } } }]);
    expect(out).toEqual({ reason: "Release 9: #1 (claude/a): A; #2 (claude/b): B", rules: { creatures: "why a; why b" }, frames: { boot: "look" } });
    expect(combine("9", [])).toBeNull();
  });

  it("clears the released PRs' own and earlier releases', keeping this release's and other branches'", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "witch-bench-expect-"));
    try {
      fs.mkdirSync(path.join(dir, "claude"));
      for (const f of ["claude/a.json", "claude/other.json", "claude/release-8.json", "claude/release-1101a.json", "claude/release-9.json"]) fs.writeFileSync(path.join(dir, f), "{}");
      expect(stale(dir, "9", ["claude/a", "claude/no-declaration"]).map((f: string) => path.relative(dir, f)))
        .toEqual(["claude/a.json", "claude/release-1101a.json", "claude/release-8.json"]);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });
});
