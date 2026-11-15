// The link switches as data (config/link-switches/<name>.json, a file a switch; Ed, 2026-10-28: "Reformat prose into data where you
// can"): every switch the code reads has its file, every one with a file is read, and docs/LINK-SWITCHES.md is the page written from
// them and the code's own reads (tools/config/linkSwitches.mjs). On a failure: add the switch's file, or move it to retired/. The
// page is rewritten at each release (node tools/config/regen.mjs), so its freshness is checked only then (tools/config/strict.mjs).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { releaseStrict } from "../tools/config/strict.mjs";
import { DOC, GROUPS, ROOT, linkSwitchProblems, loadRegistry, renderLinkSwitches, scanLinkSwitches } from "../tools/config/linkSwitches.mjs";

const reg = loadRegistry(), scan = scanLinkSwitches();

describe("the link switches (config/link-switches/)", () => {
  it("finds the reads it should (the scan itself)", () => {
    for (const name of ["seed", "island", "zoo", "shot", "fight", "chart", "arrive", "look"]) expect(scan.has(name), name).toBe(true);
    expect(scan.get("chart")).toContain("index.html"); // (the root's pages too)
    expect(scan.has("pull")).toBe(false); // (a Map's get isn't a switch: rules/broomParts.ts)
  });

  it("registers every switch the code reads, and reads every one it registers, each in a file of its name", () => {
    expect(linkSwitchProblems(reg, scan)).toEqual([]);
  });

  it("gives each a plain sentence, its values, a group and a date, once", () => {
    const names = reg.switches.map((s: { name: string }) => s.name);
    expect(new Set(names).size).toBe(names.length);
    for (const s of reg.switches) {
      expect(Object.keys(GROUPS), s.name).toContain(s.group);
      expect(s.does, s.name).toMatch(/^[A-Z].*[.!?]$/);
      expect(Array.isArray(s.values), s.name).toBe(true);
      expect(s.since, s.name).toMatch(/^\d{4}-\d\d-\d\d$|^#\d+$/);
    }
  });

  it("writes every switch and where it's read into docs/LINK-SWITCHES.md", () => {
    const page = renderLinkSwitches(reg, scan);
    for (const s of reg.switches) expect(page, s.name).toContain(`\`${s.name}`);
    expect(page).toContain("| app/linkParams.ts"); // (where it's read comes from the code, not from a record)
  });

  it.skipIf(!releaseStrict())("has docs/LINK-SWITCHES.md fresh at a release (node tools/config/regen.mjs)", () => {
    expect(readFileSync(join(ROOT, DOC), "utf8").replace(/\r\n/g, "\n")).toBe(renderLinkSwitches(reg, scan));
  });
});
