// Combines the bench declarations of a release's PRs into the release branch's own.
// The bench's declared differences (tools/bench/expect/<branch>.json) are keyed by branch: the release branch carries its PRs'
// together, or "game unchanged" fails on a release whose PR meant to change the game (release 28, 2026-11-12: #1963's camera
// snap). Writes tools/bench/expect/claude/release-<n>.json, or nothing when no PR declares anything; rel.sh runs it.
//   node tools/release/combine-bench.mjs <release number> <pr>=<branch> [<pr>=<branch> ...]
import fs from "node:fs";

const [n, ...prs] = process.argv.slice(2), out = { reason: [] };
if (!/^\d+$/.test(n ?? "")) { console.error("usage: node tools/release/combine-bench.mjs <release number> <pr>=<branch> ..."); process.exit(2); }
for (const pr of prs) {
  const at = pr.indexOf("="), num = pr.slice(0, at), ref = pr.slice(at + 1), f = `tools/bench/expect/${ref}.json`;
  if (!fs.existsSync(f)) continue;
  const e = JSON.parse(fs.readFileSync(f, "utf8"));
  out.reason.push(`#${num} (${ref}): ${e.reason}`);
  for (const k of ["rules", "frames", "start"]) for (const [a, why] of Object.entries(e[k] ?? {})) { out[k] ??= {}; out[k][a] = out[k][a] ? `${out[k][a]}; ${why}` : why; }
}
if (out.reason.length) {
  out.reason = `Release ${n}: ${out.reason.join("; ")}`;
  fs.writeFileSync(`tools/bench/expect/claude/release-${n}.json`, JSON.stringify(out, null, 2) + "\n");
  console.log("bench declarations combined");
}
