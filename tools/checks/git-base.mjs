// Shared by the guardrail checks (loops.mjs, size.mjs; docs/notes/guardrails.md): the change's base (its merge base with
// origin/claude/prototype, or --base <ref>), files as they were there (renames followed), and the escape trailers in its commits.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export const git = (args, input) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", maxBuffer: 1 << 30, input });

/** --base <ref> from argv (default origin/claude/prototype), and its merge base with HEAD. */
export function baseOf(argv) {
  const at = argv.indexOf("--base"), ref = at >= 0 ? argv[at + 1] : "origin/claude/prototype";
  return { ref, sha: git(["merge-base", ref, "HEAD"]).trim() };
}

/** Every tracked file at `rev` under `dirs` whose path passes `keep`, as { path: text }. One `git cat-file --batch` call. */
export function filesAt(rev, dirs, keep) {
  const paths = git(["ls-tree", "-r", "--name-only", rev, "--", ...dirs]).split("\n").filter(p => p && keep(p));
  if (!paths.length) return {};
  const out = execFileSync("git", ["cat-file", "--batch"], { cwd: ROOT, maxBuffer: 1 << 30, input: paths.map(p => `${rev}:${p}`).join("\n") + "\n" });
  const files = {};
  let at = 0;
  for (const p of paths) {
    const nl = out.indexOf(10, at), head = out.subarray(at, nl).toString().split(" "), size = Number(head[2]);
    files[p] = out.subarray(nl + 1, nl + 1 + size).toString("utf8");
    at = nl + 1 + size + 1;
  }
  return files;
}

/** The working tree's files under `dirs` (tracked, and untracked but not ignored) whose path passes `keep`. */
export async function filesNow(dirs, keep) {
  const fs = await import("node:fs");
  const paths = git(["ls-files", "--cached", "--others", "--exclude-standard", "--", ...dirs]).split("\n").filter(p => p && keep(p));
  const files = {};
  for (const p of paths) { try { files[p] = fs.readFileSync(path.join(ROOT, p), "utf8"); } catch { /* deleted, not yet staged */ } }
  return files;
}

/** Renames since `base` (old path → new path), so a moved file keeps its history. */
export function renamesSince(base) {
  const map = new Map();
  for (const line of git(["diff", "-M", "--name-status", "--diff-filter=R", base]).split("\n")) {
    const [, from, to] = line.split("\t");
    if (from && to) map.set(from, to);
  }
  return map;
}

/** The values of `Key: value` trailers in the commits since `base` (and in GUARDRAILS_OK, one per line, for a local try). */
export function trailers(base, key) {
  const body = git(["log", "--format=%B", `${base}..HEAD`]) + "\n" + (process.env.GUARDRAILS_OK ?? "");
  const re = new RegExp(`^${key}:\\s*(.+)$`, "gim");
  return [...body.matchAll(re)].map(m => m[1].trim());
}
