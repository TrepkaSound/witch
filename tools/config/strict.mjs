// When a stale generated reader page fails a check (Ed, 2026-11-15, "Do 1-7", item 1: shared files that don't clash). The pages
// nothing in the game, the build, the typecheck or a tool reads (docs/LINK-SWITCHES.md, config/KNOBS.md with the tuning schema's
// descriptions, docs/notes/INDEX.md) are rewritten at each release by `node tools/config/regen.mjs`, so a builder needn't commit
// them and two builders' copies never have to be merged by hand. Their freshness checks therefore only note a stale page on a
// builder's pull request, and fail on a release: a pull request into main, a push to main, or GENERATED_STRICT=1 (0 forces it off).
//   node tools/config/strict.mjs   says which
import { pathToFileURL } from "node:url";

export function releaseStrict(env = process.env) {
  if (env.GENERATED_STRICT === "1" || env.GENERATED_STRICT === "0") return env.GENERATED_STRICT === "1";
  return env.GITHUB_BASE_REF === "main" || env.GITHUB_REF === "refs/heads/main";
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(releaseStrict() ? "strict: a stale generated page fails (a release)" : "lenient: a stale generated page is only noted (the release rewrites it)");
