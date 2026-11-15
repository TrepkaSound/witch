import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHANGELOG, CHANGELOG_VERSIONS, collectChangelog, groupChangelog } from "./changelog";

describe("the changelog (config/changelog/: a frozen archive and one fragment per change)", () => {
  it("groups and sorts version gaps without assuming a consecutive workflow counter", () => {
    const got = collectChangelog({ "old.json": { version: 5955, items: ["old"] }, "new.json": { version: 6322, items: ["new"] } });
    expect(got).toEqual([{ version: 6322, items: ["new"] }, { version: 5955, items: ["old"] }]);
  });
  it("collects the archive and the fragments, the current build's first, then newest version first", () => {
    const versions = CHANGELOG.map(e => e.version);
    expect(versions.filter(v => v === null).length).toBeLessThanOrEqual(1);
    if (versions.includes(null)) expect(versions[0]).toBeNull();
    const nums = versions.filter((v): v is number => v !== null);
    for (let i = 1; i < nums.length; i++) expect(nums[i]).toBeLessThan(nums[i - 1]);
    expect(CHANGELOG.length).toBeGreaterThanOrEqual(34);
  });
  it("merges fragments with the same version into one entry, the newest file's items first, and keeps the archive's as they were", () => {
    const got = collectChangelog({
      "x/archive.json": { entries: [{ version: 12, items: ["old twelve"] }, { version: 10, items: ["ten"] }] },
      "x/2026-10-05-a.json": { version: null, items: ["a"] },
      "x/2026-10-06-b.json": { version: null, items: ["b1", "b2"] },
      "x/2026-10-04-c.json": { version: 14, items: ["c"] },
      "x/2026-10-03-d.json": { version: 12, items: ["d"] },
    });
    expect(got).toEqual([
      { version: null, items: ["b1", "b2", "a"] },
      { version: 14, items: ["c"] },
      { version: 12, items: ["d", "old twelve"] },
      { version: 10, items: ["ten"] },
    ]);
  });
  it("has only well-formed files: the archive, and fragments named <yyyy-mm-dd>-<slug>.json with a version (null or a build number) and their bullets", () => {
    const dir = new URL("../config/changelog/", import.meta.url);
    for (const name of readdirSync(dir)) {
      const f = JSON.parse(readFileSync(new URL(name, dir), "utf8"));
      if (name === "archive.json") { expect(Array.isArray(f.entries)).toBe(true); continue; }
      if (name === "stamped.json") { // (the stamped fragments, folded by tools/config/foldChangelog.mjs)
        for (const g of f.fragments) {
          expect(g.file).toMatch(/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.json$/);
          expect(Number.isInteger(g.version)).toBe(true);
          expect(Array.isArray(g.items) && g.items.length > 0 && g.items.every((i: unknown) => typeof i === "string")).toBe(true);
        }
        continue;
      }
      expect(name).toMatch(/^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.json$/);
      expect(f.version === null || Number.isInteger(f.version)).toBe(true);
      expect(Array.isArray(f.items) && f.items.length > 0 && f.items.every((i: unknown) => typeof i === "string")).toBe(true);
    }
  });
});

describe("the stamped fragments folded into stamped.json (the docs tidy, Ed 2026-11-15)", () => {
  const loose = {
    "x/archive.json": { entries: [{ version: 12, items: ["old twelve"] }] },
    "x/2026-10-07-new.json": { version: null, items: ["n"] },
    "x/2026-10-06-the-freeze.json": { version: 14, title: "Pause for screenshots", items: ["b"] },
    "x/2026-10-05-bigger-areas.json": { version: 14, items: ["a"] },
    "x/2026-10-03-d.json": { version: 12, items: ["d"] },
  };
  const folded = {
    "x/archive.json": loose["x/archive.json"], "x/2026-10-07-new.json": loose["x/2026-10-07-new.json"],
    "x/stamped.json": { fragments: [
      { file: "2026-10-03-d.json", version: 12, items: ["d"] },
      { file: "2026-10-05-bigger-areas.json", version: 14, items: ["a"] },
      { file: "2026-10-06-the-freeze.json", version: 14, title: "Pause for screenshots", items: ["b"] },
    ] },
  };
  it("reads exactly as the fragment files did, titles, dates and order included", () => {
    expect(groupChangelog(folded)).toEqual(groupChangelog(loose));
    expect(collectChangelog(folded)).toEqual(collectChangelog(loose));
  });
  it("refuses a fragment that is both folded and a file", () => {
    expect(() => groupChangelog({ ...folded, "x/2026-10-03-d.json": { version: 12, items: ["d"] } })).toThrow(/both folded and a file/);
  });
});

describe("the changelog grouped for the start screen", () => {
  it("groups each version's fragments as changes, titled by the fragment (or its name), dated by its name, newest first", () => {
    const got = groupChangelog({
      "x/archive.json": { entries: [{ version: 12, items: ["old twelve"] }] },
      "x/2026-10-05-bigger-areas.json": { version: null, items: ["a"] },
      "x/2026-10-06-the-freeze.json": { version: null, title: "Pause for screenshots", items: ["b"] },
      "x/2026-10-03-d.json": { version: 12, items: ["d"] },
    });
    expect(got).toEqual([
      { version: null, date: "2026-10-06", changes: [{ title: "Pause for screenshots", date: "2026-10-06", items: ["b"] }, { title: "Bigger areas", date: "2026-10-05", items: ["a"] }] },
      { version: 12, date: "2026-10-03", changes: [{ title: "D", date: "2026-10-03", items: ["d"] }, { title: null, date: null, items: ["old twelve"] }] },
    ]);
  });
  it("covers the same versions as the flat changelog", () => {
    expect(CHANGELOG_VERSIONS.map(v => v.version)).toEqual(CHANGELOG.map(e => e.version));
  });
});
