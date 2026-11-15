# Release scripts

The coordinator's release scripts, in the repo and hardened (Ed, 2026-11-15: "Do 1-7", item 2 of the software-quality list). They
were shell scripts in the coordinator's scratch folder until 2026-11-14. Only the coordinator runs a release, and only on Ed's
explicit go naming the PRs (CLAUDE.md, **Builders and the coordinator**). Any builder may run `--check`.

How a release goes: `claude/prototype` is the integration branch. `rel.sh` merges the named PRs' heads onto it as
`claude/release-N` and opens the release PR; `pubnow.sh` fast-forwards prototype to that head, merges it into `main` through
the `claude/publish-snapshot` PR, and waits until the public `version.json` shows the new build (`docs/notes/deploys.md`).

## Setup

- Run them from a normal clone of the repo, from its root. No absolute paths: the scripts work on the clone they sit in.
- They need `git` 2.38 or newer, `gh` (signed in, able to push), `jq`, `node`/`npx` and `curl`; `--check` needs only `git`.
- **The work folder** holds the lock, the logs and the release's own checkout (a git worktree, so the clone's checkout is
  never touched). It is `$RELEASE_WORKDIR`, by default `../.witch-release` beside the clone. It is made on first use.
- The release's checkout uses the clone's `node_modules` when both have the same `package-lock.json`; otherwise it runs
  `npm ci` there. So run `npm ci` in the clone once.
- **Commit trailer and PR footer**: set `RELEASE_SESSION_URL` (required for a real run) and `RELEASE_COAUTHOR`
  (`Name <email>`), in the environment or in `$RELEASE_WORKDIR/release.env`:

  ```
  RELEASE_SESSION_URL=https://claude.ai/code/session_...
  RELEASE_COAUTHOR="... <noreply@anthropic.com>"
  ```

## The commands

```
bash tools/release/rel.sh --check <pr|branch|sha> ...
bash tools/release/rel.sh [--dry-run] <N|next> "<title>" "<Ed's go, quoted>" <pr> [<pr> ...]
SKIPGREEN="<pr>:<why>" bash tools/release/rel.sh <N|next> "<title>" "<Ed's go>" <pr> ...
bash tools/release/pubnow.sh [--dry-run] <release PR number> "<title>"
bash tools/release/watchpr.sh [--dry-run] "<branch> [<branch> ...]" "<Ed's go>" <since, e.g. 2026-11-15T09:00:00Z>
source tools/release/chain.sh   # then: waitci <pr>   and   rel <N|next> "<title>" "<Ed's go>" <pr> ...
```

- **`rel.sh --check`**: test-merges the given PRs (or branches, or commits), in order, onto the newest `claude/prototype`, in
  git's object store: no checkout, nothing pushed, no lock, a second or two. Per PR it prints `clean`, or `CONFLICT`
  with the files and what it clashes with (prototype itself, or which earlier PR in the list). Exit 0 clean, 4 on any
  conflict. **Run it before reporting a PR ready, together with the other PRs going out in the same release.** It finds
  textual clashes only: two PRs that merge cleanly but break each other show up in the release's checks (step 7 below),
  which `--dry-run` rehearses.
- **`rel.sh`**: one release. In order: takes the lock; refuses if a release PR is still open; takes the number (`next`) or
  checks the given one against the remote; the same test merge; each PR's head CI green (`SKIPGREEN="<pr>:<why>"` accepts
  one PR's known red, as before); a fresh checkout of prototype; claims `claude/release-N` on the remote; stamps live
  changelog fragments still null; merges each head by SHA; combines the PRs' bench declarations and deletes the ones nothing reads any more, the released PRs' own and earlier
  releases' combined ones (`combine-bench.mjs`; `docs/notes/guardrails.md`);
  checks the merged result (changed JSON parses, no conflict markers, `tsc`, `node tools/config/check.mjs`, inventory,
  glossary); pushes; opens the release PR; starts `pubnow.sh` in the background and hands it the lock. Prints
  `release PR #<n>` and the publish log's path.
- **`pubnow.sh`**: publishes a release PR: waits for its build, fast-forwards prototype, opens and merges the
  publish-snapshot PR into `main`, waits for the deploy, checks the public `version.json` (asking the Pages publisher once
  if it lags 22 minutes), then reports full CI on the release head. Prints `LIVE v<build>` and `FULL CI GREEN after release`
  when all is well; exits 7 on `NOT LIVE`, 8 on `FULL CI FAILED`.
- **`watchpr.sh`**: releases each named branch's PR, one at a time, once its `FINAL:` comment (after `since`) is up and
  its CI is green. It goes through `rel.sh next`, so it shares the lock and the numbering; while another release holds
  the lock it waits. A conflict or any failed release is printed in capitals (`CONFLICT: #<pr> ... NOT RELEASED`, with the
  files), the watcher goes on with the rest and exits 1 at the end.
- **`chain.sh`**: `waitci` and `rel` for chains typed by hand.
- **`--dry-run`** (or `DRY_RUN=1`) on any of them: every read and every local step runs for real (for `rel.sh`: the test
  merge, the CI lookups, the merges and the checks, in the work folder's checkout); each command that would push or
  change GitHub is printed as `DRY RUN, would run: ...` instead. It takes the lock while it runs.

Exit codes (`rel.sh`): 2 usage or setup, 3 CI not green, 4 conflict, 5 locked or a release PR open, 6 number taken, 1 anything else.

## What was fixed, and how (the week of 2026-11-10)

1. **Clashes found late.** `rel.sh --check`, above; the release runs the same test merge before anything else.
2. **Carrying on past errors.** Every script runs under `set -euo pipefail` (`lib.sh`), and nothing of a release is pushed
   until the merged result's changed JSON parses and `node tools/config/check.mjs`, `tsc`, the inventory and the glossary pass.
3. **Duplicate CI runs.** One rule everywhere (`lib.sh`, `ci_state`): a job passed if any run of it passed, or all of its
   runs were skipped; no check runs at all is "none yet", not green; the art check never counts. The workflows already had
   `concurrency:` groups (a newer push cancels the older run of the same branch or PR; `main`'s run and the Pages publisher
   are never cancelled), so no workflow changed; `tools/ci/release-check.test.ts` now guards that.
4. **Races.** A lock folder in the work folder (`lock/`, naming its holder's pid; a dead holder's lock is taken over), held
   from `rel.sh`'s start until `pubnow.sh` ends. The number comes from the remote: the newest `Release N:` PR, then on past
   any `claude/release-<N+1>` branch already pushed; `rel.sh` then creates `claude/release-N` on the remote before building,
   which fails if another chain made it first, and gives it back if the release stops before its PR is open. An open
   `claude/release-*` PR refuses a new release (`RELEASE_IGNORE_OPEN=1` to go on regardless).
5. **Merge retry.** `pubnow.sh` waits 10 s and tries the publish merge up to 6 times, printing each try's HTTP status and
   message; it tries again only on 405, 409 and server errors, and stops at once on a real refusal.
6. **Paths.** Everything is relative to the clone and `$RELEASE_WORKDIR`; the session link and co-author are settings.
7. **The watcher.** Same lock and numbering through `rel.sh`; conflicts are loud and make it exit 1.

8. **The build number** (2026-11-15, release 57 stopped on it): `lib.sh`'s `ci_build` looks up a main commit's CI run with
   `per_page=100` (main's commit soon has more than 30 runs: each PR preview's Pages publish runs there by
   repository_dispatch, and the default 30 lost CI's) and fails, saying so, when it finds none; `rel.sh` and `pubnow.sh` use it.

## Testing

- `npx vitest run tools/ci/combine-bench.test.ts`: combining a release's declarations and which files it clears.
- `npx vitest run tools/ci/release-check.test.ts`: `--check` against throwaway branches in a temp clone (clean, a clash
  between two PRs, a clash with prototype, order, nothing pushed), the CI rule on sample check runs, and the workflows'
  concurrency groups. Offline.
- `shellcheck -x tools/release/*.sh` is clean (0.11).
- By hand, safely: `bash tools/release/rel.sh --check <open PRs>`, then
  `bash tools/release/rel.sh --dry-run next "Dry run" "dry run" <a green PR>` and
  `bash tools/release/pubnow.sh --dry-run <a merged release PR> "Dry run"`.
- Not tested: a real release, publish or watcher run (the real pushes, the PR creation, the merge retry against GitHub,
  the waits). They were only read through and dry-run.

## Settings

`RELEASE_WORKDIR` (work folder), `RELEASE_SESSION_URL`, `RELEASE_COAUTHOR`, `SKIPGREEN`, `DRY_RUN`, `RELEASE_IGNORE_OPEN`;
for tests and forks: `RELEASE_REPO_DIR` (the clone to work on), `RELEASE_REMOTE` (`origin`), `RELEASE_BASE`
(`claude/prototype`), `RELEASE_REPO` (`edsaperia/witch`), `RELEASE_PUBLIC_URL`.
