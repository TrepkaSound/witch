#!/usr/bin/env bash
# One release, start to publish, so no step is forgotten (the coordinator, 2026-11-09). Only on Ed's explicit go naming the PRs.
#   bash tools/release/rel.sh --check <pr|branch|sha> ...                      test-merge only: nothing pushed, no lock
#   bash tools/release/rel.sh [--dry-run] <N|next> "<title>" "<Ed's go, quoted>" <pr> [<pr> ...]
# --check merges the given PRs, in order, onto the newest claude/prototype in git's object store and reports clean or
# the conflicting files per PR (exit 4 on any conflict). Run it before calling a PR ready, with the others going out.
# The release: 0. takes the lock, refuses if a release PR is still open, takes or checks the number against the remote;
# 1. the same test merge, before anything else; 2. each PR's head CI must be green (SKIPGREEN="<pr>:<why>" accepts a
# known red); 3. a fresh checkout of prototype in the work folder, claude/release-N claimed on the remote; 4. stamps
# live changelog fragments still null with main's build; 5. merges each PR's head by SHA (--no-ff); 6. combines the
# PRs' bench declarations; 7. checks the merged result: changed JSON parses, no conflict markers, tsc, config check,
# inventory, glossary; 8. pushes, opens the release PR; 9. starts pubnow.sh in the background (log: pub<PR>.log in
# the work folder), handing it the lock. --dry-run (or DRY_RUN=1) does every local step and prints, instead of
# running, whatever would push or change GitHub. Exits: 2 usage or setup, 3 CI not green, 4 conflict, 5 locked or a
# release PR open, 6 number taken, 1 anything else.
# shellcheck source=tools/release/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

usage() { sed -n '2,5p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 2; }
MODE=release
while [ $# -gt 0 ]; do
  case $1 in
    --check) MODE=check; shift ;;
    --dry-run) DRY=1; shift ;;
    -h|--help) usage ;;
    --) shift; break ;;
    -*) die 2 "unknown option $1" ;;
    *) break ;;
  esac
done
need git
cd "$REPO_DIR"

if [ "$MODE" = check ]; then
  [ $# -ge 1 ] || usage
  base=$(fetch_base); items=()
  for a in "$@"; do items+=("$(fetch_item "$a")"); done
  say "test merge onto $BASE ${base:0:9}, in order: $*"
  test_merge "$base" "${items[@]}" && rc=0 || rc=$?
  if [ "$rc" = 0 ]; then say "CLEAN: all merge onto $BASE in this order"; else say "CONFLICTS: see above"; fi
  exit "$rc"
fi

[ $# -ge 4 ] || usage
N=$1; TITLE=$2; GO=$3; shift 3; PRS=("$@")
[[ $N =~ ^([0-9]+|next)$ ]] || die 2 "the release number must be a number or \"next\", not \"$N\""
for P in "${PRS[@]}"; do [[ $P =~ ^[0-9]+$ ]] || die 2 "not a PR number: $P"; done
need gh jq node npx
need_session
T=$(trailer)

# 0. one chain at a time; the number from the remote
lock_traps
lock_take "rel.sh $N (${PRS[*]})${DRY:+, dry run}"
open=$(open_release_prs)
if [ -n "$open" ] && [ -z "${RELEASE_IGNORE_OPEN:-}" ]; then
  die 5 "a release PR is still open: $(tr '\n' ' ' <<<"$open"). Another chain is mid-release, or one failed: finish or close it (RELEASE_IGNORE_OPEN=1 to go on regardless)"
fi
if [ "$N" = next ]; then N=$(next_release); else release_taken "$N"; [ -z "$TAKEN" ] || die 6 "release $N is taken: $TAKEN (next free: $(next_release))"; fi
say "release $N${DRY:+ (DRY RUN: nothing is pushed, no PR is opened)}"
BASE_SHA=$(fetch_base)
git fetch -q "$REMOTE" "+refs/heads/main:refs/remotes/$REMOTE/main"

# 1. the PRs' heads, test-merged before anything is built on them
ITEMS=(); HEADS=(); REFS=(); TITLES=()
for P in "${PRS[@]}"; do
  info=$(gh api "$R/pulls/$P" --jq '[.head.sha, .head.ref, .state, .title] | @tsv')
  IFS=$'\t' read -r H REF STATE PT <<<"$info"
  [ "$STATE" = open ] || die 1 "#$P is $STATE, not open"
  git fetch -q "$REMOTE" "$H"
  ITEMS+=("#$P=$H"); HEADS+=("$H"); REFS+=("$REF"); TITLES+=("$PT")
done
say "test merge onto $BASE ${BASE_SHA:0:9}:"
test_merge "$BASE_SHA" "${ITEMS[@]}" || die 4 "conflict: release $N stopped before anything was pushed"

# 2. each PR's head CI
for i in "${!PRS[@]}"; do
  P=${PRS[$i]}; H=${HEADS[$i]}; bad=$(ci_state "$H")
  # SKIPGREEN="<pr>:<why>": that PR's red CI is known and fixed by another PR in this release (Ed's go names both; release 29,
  # 2026-11-12: #1968 red only on the grass test #1969 fixes); the release PR's own full CI is still the check
  case " ${SKIPGREEN:-} " in *" $P:"*) if [ -n "$bad" ]; then say "#$P not green ($bad), accepted: ${SKIPGREEN}"; fi; bad="" ;; esac
  [ -z "$bad" ] || die 3 "#$P head ${H:0:9} not green: $bad"
done
say "CI green on every head"

# 3. a fresh checkout of prototype in the work folder (a worktree of this clone: the clone's own checkout is untouched)
git worktree prune
if [ -e "$TREE" ]; then git worktree remove --force "$TREE" 2>/dev/null || rm -rf "$TREE"; git worktree prune; fi
git worktree add -q --detach "$TREE" "$BASE_SHA"
cd "$TREE"
if [ ! -e node_modules ]; then
  if [ -d "$REPO_DIR/node_modules" ] && cmp -s package-lock.json "$REPO_DIR/package-lock.json"; then ln -s "$REPO_DIR/node_modules" node_modules
  else say "installing dependencies in the work folder (the clone has none, or for another package-lock.json)"; npm ci --no-audit --no-fund >/dev/null; fi
fi
# The number is claimed on the remote now, at prototype: creating the branch fails if another chain made it first
# (the lease on "no such branch" is what makes this create-only; it can't overwrite anything).
BRANCH=refs/heads/claude/release-$N; CLAIMED=""; OPENED=""
unclaim() { # a release that stops before its PR is open gives the number back, if the branch is still the bare claim
  if [ -n "$CLAIMED" ] && [ -z "$OPENED" ]; then
    if git push -q --force-with-lease="$BRANCH:$CLAIMED" "$REMOTE" ":$BRANCH" 2>/dev/null; then say "gave release $N's branch back"
    else say "left claude/release-$N on $REMOTE: delete it or reuse the number by hand"; fi
  fi
}
trap 'unclaim; lock_drop' EXIT
run git push -q --force-with-lease="$BRANCH:" "$REMOTE" "$BASE_SHA:$BRANCH" || die 6 "couldn't claim claude/release-$N on $REMOTE: another chain has it"
[ -n "$DRY" ] || CLAIMED=$BASE_SHA

# 4. stamps: fragments already live on main but still null get main's build number
MAIN=$(git rev-parse "$REMOTE/main"); STAMP=""
if ! node tools/config/stampChangelog.mjs --check "$REMOTE/main" >/dev/null 2>&1; then
  BUILD=$(gh api "$R/actions/runs?head_sha=$MAIN" --jq '[.workflow_runs[]|select(.name=="CI")][0].run_number')
  [[ $BUILD =~ ^[0-9]+$ ]] || die 1 "no CI run number for main ${MAIN:0:9} to stamp the changelog with (got \"$BUILD\")"
  node tools/config/stampChangelog.mjs "$MAIN" "$BUILD"
  git add config/changelog
  if ! git diff --cached --quiet; then git commit -q -m "Stamp changelog fragments for v$BUILD$T"; STAMP=" Also stamps the v$BUILD changelog fragments."; fi
fi

# 5. merge each PR's head by SHA (the test merge passed, so a conflict here means prototype or a head moved under us)
LIST=""; EXPS=()
for i in "${!PRS[@]}"; do
  P=${PRS[$i]}; H=${HEADS[$i]}; PT=${TITLES[$i]}
  if ! git merge -q --no-ff "$H" -m "Merge #$P for release: $PT$T"; then
    say "CONFLICT merging #$P in:"; git diff --name-only --diff-filter=U | sed 's/^/    /'; git merge --abort; die 4 "conflict merging #$P: release $N stopped, nothing of it pushed"
  fi
  LIST+="#$P ($PT), "; EXPS+=("$P=${REFS[$i]}")
done

# 6. the release branch carries its PRs' bench declarations together (combine-bench.mjs)
node "$RELEASE_TOOLS/combine-bench.mjs" "$N" "${EXPS[@]}"
if [ -n "$(git status --porcelain tools/bench/expect)" ]; then git add tools/bench/expect; git commit -q -m "Bench: declare release $N's changes$T"; fi

# 7. checks on the merged result, before anything of it is pushed
CHANGED=$(git diff --name-only --diff-filter=AM "$BASE_SHA" HEAD)
# shellcheck disable=SC2016
{ grep '\.json$' <<<"$CHANGED" || true; } | node -e '
  const fs = require("fs"); let bad = 0;
  for (const f of fs.readFileSync(0, "utf8").split("\n").filter(Boolean)) {
    try { JSON.parse(fs.readFileSync(f, "utf8")); } catch (e) { bad++; console.error(`broken JSON: ${f}: ${e.message}`); }
  }
  process.exit(bad ? 1 : 0);' || die 1 "the merged release has broken JSON: nothing pushed"
if [ -n "$CHANGED" ]; then
  # shellcheck disable=SC2086
  marked=$(IFS=$'\n'; grep -lIE '^(<<<<<<<|>>>>>>>)( |$)' $CHANGED 2>/dev/null || true)
  [ -z "$marked" ] || die 1 "conflict markers left in: $(tr '\n' ' ' <<<"$marked")"
fi
npx tsc --noEmit -p .
node tools/config/check.mjs >/dev/null
node tools/inventory.mjs --check
node tools/docs/glossary.mjs --check >/dev/null
say "checks passed"

# 8. push and open the release PR
run git push -q "$REMOTE" "HEAD:$BRANCH"
BODY="Release: ${LIST%, }, on Ed's go (\"$GO\").$STAMP Each PR head passed full CI before merging.$(footer)"
if [ -n "$DRY" ]; then
  run gh api "$R/pulls" -f title="Release $N: $TITLE" -f head="claude/release-$N" -f base="$BASE" -f body="$BODY" --jq .number
  run bash "$RELEASE_TOOLS/pubnow.sh" "<release PR>" "$TITLE"
  say "DRY RUN done: release $N would merge ${LIST%, }; the merged checkout is $TREE"
  exit 0
fi
RP=$(gh api "$R/pulls" -f title="Release $N: $TITLE" -f head="claude/release-$N" -f base="$BASE" -f body="$BODY" --jq .number)
OPENED=1
say "release PR #$RP"

# 9. publish (waits for the public site; see pubnow.sh), which now holds the lock
RELEASE_LOCK_INHERITED=1 nohup bash "$RELEASE_TOOLS/pubnow.sh" "$RP" "$TITLE" > "$WORK/pub$RP.log" 2>&1 &
lock_hand_to $!
say "publishing: $WORK/pub$RP.log"
