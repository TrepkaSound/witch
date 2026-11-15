// Combines the bench declarations of a release's PRs into the release branch's own, and clears the ones it no longer needs.
// The bench's declared differences (tools/bench/expect/<branch>.json) are keyed by branch: the release branch carries its PRs'
// together, or "game unchanged" fails on a release whose PR meant to change the game (release 28, 2026-11-12: #1963's camera
// snap). Writes tools/bench/expect/claude/release-<n>.json, or nothing when no PR declares anything; rel.sh runs it.
// Then (guardrails, Ed's go 2026-11-15) it deletes the released PRs' own declarations and earlier releases' combined ones:
// the bench on the release PR reads only release-<n>.json, and after the release nothing reads the others (182 had piled up).
//   node tools/release/combine-bench.mjs <release number> <pr>=<branch> [<pr>=<branch> ...]
import fs from "node:fs";
import path from "node:path";

export const EXPECT = "tools/bench/expect";

/** The release's combined declaration from its PRs' own ({ num, ref, e } each), or null when none declares anything. */
export function combine(n, decls) {
  const out = { reason: [] };
  for (const { num, ref, e } of decls) {
    out.reason.push(`#${num} (${ref}): ${e.reason}`);
    for (const k of ["rules", "frames", "start"]) for (const [a, why] of Object.entries(e[k] ?? {})) { out[k] ??= {}; out[k][a] = out[k][a] ? `${out[k][a]}; ${why}` : why; }
  }
  if (!out.reason.length) return null;
  out.reason = `Release ${n}: ${out.reason.join("; ")}`;
  return out;
}

/** The declaration files a release clears (paths under `dir`): its PRs' own, and every earlier release's combined one. */
export function stale(dir, n, refs) {
  const out = refs.map(ref => `${dir}/${ref}.json`).filter(f => fs.existsSync(f));
  const rel = `${dir}/claude`;
  if (fs.existsSync(rel)) for (const f of fs.readdirSync(rel)) if (/^release-.+\.json$/.test(f) && f !== `release-${n}.json`) out.push(`${rel}/${f}`);
  return [...new Set(out)].sort();
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const [n, ...prs] = process.argv.slice(2);
  if (!/^\d+$/.test(n ?? "")) { console.error("usage: node tools/release/combine-bench.mjs <release number> <pr>=<branch> ..."); process.exit(2); }
  const pairs = prs.map(pr => { const at = pr.indexOf("="); return { num: pr.slice(0, at), ref: pr.slice(at + 1) }; });
  const decls = pairs.filter(p => fs.existsSync(`${EXPECT}/${p.ref}.json`)).map(p => ({ ...p, e: JSON.parse(fs.readFileSync(`${EXPECT}/${p.ref}.json`, "utf8")) }));
  const out = combine(n, decls);
  if (out) {
    fs.mkdirSync(`${EXPECT}/claude`, { recursive: true });
    fs.writeFileSync(`${EXPECT}/claude/release-${n}.json`, JSON.stringify(out, null, 2) + "\n");
    console.log("bench declarations combined");
  }
  const gone = stale(EXPECT, n, pairs.map(p => p.ref));
  for (const f of gone) fs.rmSync(f);
  if (gone.length) console.log(`bench declarations cleared: ${gone.length} (${gone.map(f => path.relative(EXPECT, f)).join(", ")})`);
}
