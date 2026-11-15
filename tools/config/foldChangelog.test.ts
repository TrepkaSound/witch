// The changelog folder (tools/config/foldChangelog.mjs): stamped fragments move into stamped.json, null ones stay files, and What's new
// reads the same before and after.
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { groupChangelog, type ChangelogFile } from "../../src/changelogData";
import { fold } from "./foldChangelog.mjs";
import { nullFragments, stamp } from "./stampChangelog.mjs";

const made: string[] = [];
afterEach(() => { for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true }); });
function dir(files: Record<string, string>): string {
  const d = join(mkdtempSync(join(tmpdir(), "fold-")), "changelog");
  made.push(join(d, ".."));
  mkdirSync(d, { recursive: true });
  for (const [f, text] of Object.entries(files)) writeFileSync(join(d, f), text);
  return d;
}
const read = (d: string) => Object.fromEntries(readdirSync(d).map(f => [f, JSON.parse(readFileSync(join(d, f), "utf8")) as ChangelogFile]));

describe("foldChangelog", () => {
  it("folds only stamped fragments, keeps null ones as files, and What's new reads the same", () => {
    const d = dir({
      "archive.json": '{ "entries": [{ "version": 3, "items": ["old"] }] }',
      "2026-11-01-a.json": '{ "version": 7100, "items": ["A"] }',
      "2026-11-02-b.json": '{ "version": 7100, "title": "Bee", "items": ["B1", "B2"] }',
      "2026-11-03-c.json": '{ "version": null, "items": ["C"] }',
    });
    const before = groupChangelog(read(d));
    expect(fold(d, { dryRun: true })).toEqual(["2026-11-01-a.json", "2026-11-02-b.json"]);
    expect(readdirSync(d).length).toBe(4);
    expect(fold(d)).toEqual(["2026-11-01-a.json", "2026-11-02-b.json"]);
    expect(readdirSync(d).sort()).toEqual(["2026-11-03-c.json", "archive.json", "stamped.json"]);
    expect(groupChangelog(read(d))).toEqual(before);
  });

  it("keeps stamping working: the folded file is never a null fragment, and a later stamp then fold adds to it", () => {
    const d = dir({ "2026-11-01-a.json": '{ "version": 7100, "items": ["A"] }', "2026-11-03-c.json": '{ "version": null, "items": ["C"] }' });
    fold(d);
    expect(nullFragments(d)).toEqual(["2026-11-03-c.json"]);
    expect(stamp(["2026-11-03-c.json"], 7200, d)).toEqual(["2026-11-03-c.json"]);
    writeFileSync(join(d, "2026-11-04-new.json"), '{ "version": null, "items": ["new"] }');
    const before = groupChangelog(read(d));
    expect(fold(d)).toEqual(["2026-11-03-c.json"]);
    expect(JSON.parse(readFileSync(join(d, "stamped.json"), "utf8")).fragments.map((f: { file: string }) => f.file)).toEqual(["2026-11-01-a.json", "2026-11-03-c.json"]);
    expect(groupChangelog(read(d))).toEqual(before);
    expect(nullFragments(d)).toEqual(["2026-11-04-new.json"]);
  });
});
