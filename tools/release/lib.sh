#!/usr/bin/env bash
# What the release scripts share: where things are, stop on error, the dry run, the lock, the next release number,
# reading a commit's CI, and the test merge. Source it (rel.sh, pubnow.sh, watchpr.sh and chain.sh do); see README.md.
# (SC2034: the scripts that source this use the names; SC2016: jq programs are meant to stay unexpanded)
# shellcheck shell=bash disable=SC2034,SC2016
set -euo pipefail

RELEASE_TOOLS=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# The clone the scripts work on: the one they sit in, unless RELEASE_REPO_DIR names another (the test does).
REPO_DIR=${RELEASE_REPO_DIR:-$(cd "$RELEASE_TOOLS/../.." && pwd)}
REMOTE=${RELEASE_REMOTE:-origin}
BASE=${RELEASE_BASE:-claude/prototype}
R=repos/${RELEASE_REPO:-edsaperia/witch}
PUBLIC_VERSION_URL=${RELEASE_PUBLIC_URL:-https://edsaperia.github.io/witch/version.json}
# The work folder: the lock, the logs and the release's own checkout (a git worktree), beside the clone and never in
# it, so the clone's tests and tools don't walk into a second copy of the game.
WORK=${RELEASE_WORKDIR:-$(dirname "$REPO_DIR")/.witch-release}
TREE=$WORK/tree
LOCK=$WORK/lock
# Settings that outlive one command (RELEASE_SESSION_URL, RELEASE_COAUTHOR) can sit in the work folder.
# shellcheck disable=SC1091
if [ -f "$WORK/release.env" ]; then . "$WORK/release.env"; fi
DRY=${DRY_RUN:-}

say() { printf '%s\n' "$*"; }
die() { local code=$1; shift; printf '%s\n' "$*" >&2; exit "$code"; }
need() { local c; for c in "$@"; do command -v "$c" >/dev/null || die 2 "needs $c on the PATH"; done; }

# Everything that changes the remote or GitHub goes through run: a dry run prints it instead.
run() {
  if [ -n "$DRY" ]; then printf 'DRY RUN, would run:'; printf ' %q' "$@"; printf '\n'; else "$@"; fi
}

# The commit trailer and the PR footer (the session's link is the coordinator's own, so it is a setting, not code).
trailer() {
  local t=""
  [ -z "${RELEASE_COAUTHOR:-}" ] || t+=$'\n'"Co-Authored-By: $RELEASE_COAUTHOR"
  [ -z "${RELEASE_SESSION_URL:-}" ] || t+=$'\n'"Claude-Session: $RELEASE_SESSION_URL"
  [ -z "$t" ] || printf '\n%s' "$t"
}
footer() {
  printf '\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)'
  [ -z "${RELEASE_SESSION_URL:-}" ] || printf '\n\n%s' "$RELEASE_SESSION_URL"
}
need_session() {
  [ -n "$DRY" ] || [ -n "${RELEASE_SESSION_URL:-}" ] ||
    die 2 "set RELEASE_SESSION_URL (and RELEASE_COAUTHOR) in the environment or in $WORK/release.env: commits and PRs carry them"
}

# --- The lock: one release chain at a time on this machine (a folder is made atomically; it names its holder's pid).
LOCK_MINE=""
lock_busy() {
  local pid; [ -d "$LOCK" ] || return 1
  pid=$(cat "$LOCK/pid" 2>/dev/null || true)
  [ -z "$pid" ] || kill -0 "$pid" 2>/dev/null
}
lock_what() { cat "$LOCK/what" 2>/dev/null || echo "unknown"; }
lock_take() { # $1: what holds it, for the message another chain gets
  mkdir -p "$WORK"
  if ! mkdir "$LOCK" 2>/dev/null; then
    if lock_busy; then die 5 "another release is running: $(lock_what) (pid $(cat "$LOCK/pid" 2>/dev/null || echo "?"); lock $LOCK)"; fi
    say "stale lock (its holder, $(lock_what), is gone): taking it"
    mv "$LOCK" "$LOCK.stale.$$" 2>/dev/null && rm -rf "$LOCK.stale.$$"
    mkdir "$LOCK" 2>/dev/null || die 5 "another release took the lock first: $(lock_what)"
  fi
  echo "$$" > "$LOCK/pid"; echo "$1, since $(date -u +%Y-%m-%dT%H:%MZ)" > "$LOCK/what"; LOCK_MINE=1
}
lock_drop() { if [ -n "$LOCK_MINE" ]; then rm -rf "$LOCK"; LOCK_MINE=""; fi; }
# rel.sh hands its lock to the pubnow.sh it starts, so the chain holds it until the release is live or has failed.
lock_hand_to() { echo "$1" > "$LOCK/pid"; LOCK_MINE=""; }
lock_inherit() { echo "$$" > "$LOCK/pid"; echo "$1, since $(date -u +%Y-%m-%dT%H:%MZ)" > "$LOCK/what"; LOCK_MINE=1; }
lock_traps() { trap 'lock_drop' EXIT; trap 'exit 143' TERM; trap 'exit 130' INT; trap 'exit 129' HUP; }

# --- CI on a commit. A job counts as passed if any run of it passed (a duplicate run cancelled by a newer one is not
# a failure; release 46), or if every run of it was skipped. The art check never holds a release (Ed, 2026-11-01).
ci_runs() { gh api --paginate "$R/commits/$1/check-runs?per_page=100" --jq '.check_runs[]|{name,status,conclusion}' | jq -s .; }
CI_JOBS='map(select(.name!="art check")) | group_by(.name) | map({name: .[0].name,
  ok: (any(.[]; .conclusion=="success") or all(.[]; .status=="completed" and (.conclusion=="skipped" or .conclusion=="neutral"))),
  pending: any(.[]; .status!="completed"),
  why: ([.[] | .conclusion // .status] | unique | join("/"))})'
# Prints nothing when green; else "none yet", "pending: a, b" and/or "failed: c=failure".
ci_state() {
  ci_runs "$1" | jq -r "$CI_JOBS"' | if length==0 then "none yet" else
    [ (map(select((.ok|not) and .pending)) | if length>0 then "pending: " + (map(.name)|join(", ")) else empty end),
      (map(select((.ok|not) and (.pending|not))) | if length>0 then "failed: " + (map("\(.name)=\(.why)")|join(", ")) else empty end)
    ] | join("; ") end'
}
# One job on a commit: success, pending, none, or failed:<conclusions>.
job_state() {
  ci_runs "$1" | jq -r --arg n "$2" "$CI_JOBS"' | map(select(.name==$n)) |
    if length==0 then "none" elif .[0].ok then "success" elif .[0].pending then "pending" else "failed:" + .[0].why end'
}

# --- Release numbers come from the remote, never a local log: the newest "Release N: ..." PR from claude/release-N,
# then on past any claude/release-<N+1> branch another chain has already pushed. (Branches claude/release-1520 to
# -1843 are from when releases were named after a PR number; counting only on from the PRs' newest skips them.)
release_branches() { git ls-remote --heads "$REMOTE" 'refs/heads/claude/release-*' | sed -n 's#.*refs/heads/claude/release-\([0-9][0-9]*\)$#\1#p'; }
release_pr_numbers() {
  gh api "$R/pulls?state=all&base=$BASE&per_page=100&sort=created&direction=desc" \
    --jq '.[] | select(.head.ref|test("^claude/release-[0-9]+$")) | (.head.ref|sub("claude/release-";"")) as $n | select(.title|startswith("Release \($n):")) | $n'
}
next_release() {
  local n branches
  n=$(release_pr_numbers | sort -n | tail -1); n=${n:-0}
  branches=$(release_branches)
  while grep -qx "$((n + 1))" <<<"$branches"; do n=$((n + 1)); done
  echo "$((n + 1))"
}
release_taken() { # $1: a number; sets TAKEN to why it is used, or to nothing
  local pr; TAKEN=""
  if release_branches | grep -qx "$1"; then TAKEN="branch claude/release-$1 exists on $REMOTE"; return 0; fi
  pr=$(gh api "$R/pulls?state=all&head=$(cut -d/ -f2 <<<"$R"):claude/release-$1&per_page=1" --jq '.[0].number // empty')
  if [ -n "$pr" ]; then TAKEN="PR #$pr was release $1"; fi
}
# A release PR still open means a chain (here or elsewhere) is mid-release, or one failed and needs a look.
open_release_prs() {
  gh api --paginate "$R/pulls?state=open&base=$BASE&per_page=100" --jq '.[] | select(.head.ref|test("^claude/release-")) | "#\(.number) (\(.head.ref))"'
}

# --- The test merge: each item ("label=sha") merged in order onto <base>, in git's object store only (no checkout,
# nothing pushed). Prints clean or the conflicting files per item, and which earlier item or the base it clashes with;
# a conflicting item is left out of what the later ones are tried on. Returns 4 if any item conflicts.
test_merge() {
  local base=$1 cur=$1 bad=0 item label sha out rc tree where prev plabel psha ptree pc
  local -a merged=()
  shift
  for item; do
    label=${item%%=*}; sha=${item#*=}
    if git merge-base --is-ancestor "$sha" "$cur"; then say "$label: already in, nothing to merge"; continue; fi
    out=$(git merge-tree --write-tree --name-only --no-messages "$cur" "$sha") && rc=0 || rc=$?
    if [ "$rc" = 0 ]; then
      tree=$(sed -n 1p <<<"$out")
      cur=$(GIT_AUTHOR_NAME=release-check GIT_AUTHOR_EMAIL=release-check@localhost GIT_COMMITTER_NAME=release-check \
        GIT_COMMITTER_EMAIL=release-check@localhost git commit-tree "$tree" -p "$cur" -p "$sha" -m "test merge $label")
      merged+=("$item"); say "$label: clean"
    elif [ "$rc" = 1 ]; then
      bad=4; where=""
      if git merge-tree --write-tree "$base" "$sha" >/dev/null 2>&1; then
        for prev in ${merged[@]+"${merged[@]}"}; do
          plabel=${prev%%=*}; psha=${prev#*=}
          ptree=$(git merge-tree --write-tree "$base" "$psha" 2>/dev/null | sed -n 1p) || continue
          pc=$(GIT_AUTHOR_NAME=release-check GIT_AUTHOR_EMAIL=release-check@localhost GIT_COMMITTER_NAME=release-check \
            GIT_COMMITTER_EMAIL=release-check@localhost git commit-tree "$ptree" -p "$base" -p "$psha" -m "test merge $plabel")
          git merge-tree --write-tree "$pc" "$sha" >/dev/null 2>&1 || where+="${where:+, }$plabel"
        done
        where="clean on $BASE alone; clashes with ${where:-the earlier ones together}"
      else
        where="clashes with $BASE itself"
      fi
      say "$label: CONFLICT ($where) in:"; sed 1d <<<"$out" | sed '/^$/d; s/^/    /'
    else
      die 1 "git merge-tree failed on $label ($sha), exit $rc: needs git 2.38 or newer"
    fi
  done
  return "$bad"
}

# A PR number, a branch name or a full commit id, fetched: prints "label=sha".
fetch_item() {
  local a=$1
  if [[ $a =~ ^#?[0-9]+$ ]]; then
    a=${a#\#}; git fetch -q "$REMOTE" "refs/pull/$a/head" || die 1 "can't fetch PR #$a from $REMOTE"
    echo "#$a=$(git rev-parse FETCH_HEAD)"
  elif [[ $a =~ ^[0-9a-f]{40}$ ]]; then
    git fetch -q "$REMOTE" "$a" || die 1 "can't fetch $a from $REMOTE"; echo "${a:0:9}=$a"
  else
    git fetch -q "$REMOTE" "refs/heads/$a" || die 1 "can't fetch branch $a from $REMOTE"
    echo "$a=$(git rev-parse FETCH_HEAD)"
  fi
}
fetch_base() {
  git fetch -q "$REMOTE" "+refs/heads/$BASE:refs/remotes/$REMOTE/$BASE" || die 1 "can't fetch $BASE from $REMOTE"
  git rev-parse "refs/remotes/$REMOTE/$BASE"
}
