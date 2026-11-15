// Folds the changelog's stamped fragments into one file (the docs tidy, Ed 2026-11-15: "All four please", on the coordinator's
// "fold stamped fragments"): every config/changelog/<yyyy-mm-dd>-<slug>.json whose version is a build number moves into
// config/changelog/stamped.json, under its old file name, and the file is removed. src/changelogData.ts puts them back as the files
// they were, so What's new reads exactly the same. Null fragments stay as files: builders keep adding them, and
// tools/config/stampChangelog.mjs keeps stamping them at each release. Folding is optional and can run any time after a stamp.
//   node tools/config/foldChangelog.mjs            fold every stamped fragment
//   node tools/config/foldChangelog.mjs --dry-run  list what it would fold, change nothing
// tools/config/foldChangelog.test.ts tests it.
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const DIR = "config/changelog";
export const STAMPED = "stamped.json";
const FRAGMENT = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.json$/;
const ABOUT = "What's new fragments already stamped with the build they went live in, folded here by tools/config/foldChangelog.mjs under their old file names (the docs tidy, Ed 2026-11-15). Don't edit by hand: add a new fragment file instead (CLAUDE.md, What's new).";

/** The stamped fragment files in `dir`, sorted. */
export function stampedFragments(dir = join(ROOT, DIR)) {
  return readdirSync(dir).filter(f => FRAGMENT.test(f)).sort().filter(f => Number.isInteger(JSON.parse(readFileSync(join(dir, f), "utf8")).version));
}

/** Moves the stamped fragments into stamped.json, sorted by file name, and removes their files. Returns the names folded. */
export function fold(dir = join(ROOT, DIR), { dryRun = false } = {}) {
  const names = stampedFragments(dir), path = join(dir, STAMPED);
  if (dryRun || !names.length) return names;
  const old = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")).fragments : [];
  const have = new Set(old.map(f => f.file)), add = [];
  for (const file of names) {
    if (have.has(file)) throw Error(`${file} is already folded into ${STAMPED}`);
    const j = JSON.parse(readFileSync(join(dir, file), "utf8"));
    const extra = Object.keys(j).filter(k => !["version", "items", "title"].includes(k));
    if (extra.length) throw Error(`${file}: unexpected fields ${extra.join(", ")}`);
    add.push({ file, version: j.version, ...(j.title !== undefined ? { title: j.title } : {}), items: j.items });
  }
  const fragments = [...old, ...add].sort((a, b) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0);
  writeFileSync(path, "{\n  \"_\": " + JSON.stringify(ABOUT) + ",\n  \"fragments\": [\n" + fragments.map(f => "    " + JSON.stringify(f)).join(",\n") + "\n  ]\n}\n");
  for (const file of names) rmSync(join(dir, file));
  return names;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dryRun = process.argv.includes("--dry-run"), done = fold(join(ROOT, DIR), { dryRun });
  console.log(`${done.length} stamped fragment(s) ${dryRun ? "would be" : ""} folded into ${DIR}/${STAMPED}`.replace("  ", " "));
}
