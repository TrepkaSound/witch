#!/usr/bin/env bash
# Releases PRs one at a time, each once its "FINAL:" comment (made after <since>) is up and its CI is green (Ed 2026-11-13
# chose "1" for the mesh batches D/E and again for F/G: straight through). Only on Ed's explicit go covering those PRs.
#   bash tools/release/watchpr.sh [--dry-run] "<branch> [<branch> ...]" "<Ed's go, quoted>" <since, e.g. 2026-11-15T09:00:00Z>
# Branches are named without their claude/ prefix. Each ready PR goes through rel.sh as release "next" (the number from
# the remote), under rel.sh's lock: while another release holds the lock the watcher waits and tries again. A PR whose
# release fails (a CONFLICT most of all) is reported in capitals, dropped from the list, and makes the watcher exit 1
# at the end; the others still go out. Logs: watch-<branch>.log and pub<PR>.log in the work folder. Checks every minute
# for 10 hours. --dry-run passes --dry-run to rel.sh and stops after one pass.
# shellcheck source=tools/release/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

if [ "${1:-}" = --dry-run ]; then DRY=1; shift; fi
[ $# -eq 3 ] || die 2 "usage: bash tools/release/watchpr.sh [--dry-run] \"<branch> ...\" \"<Ed's go>\" <since, ISO time>"
read -r -a left <<<"$1"; GO=$2; SINCE=$3
[[ $SINCE =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9:]+Z$ ]] || die 2 "since must be a UTC time like 2026-11-15T09:00:00Z, not \"$SINCE\""
need git gh jq
need_session
cd "$REPO_DIR"; mkdir -p "$WORK"
OWNER=$(cut -d/ -f2 <<<"$R"); failed=()

prn() { gh api "$R/pulls?state=open&head=$OWNER:claude/$1" --jq '.[0].number // empty'; }
ready() { # $1: a PR number; a FINAL comment after SINCE, and green CI on its head
  local f sha
  f=$(gh api --paginate "$R/issues/$1/comments?per_page=100" --jq ".[] | select((.body|startswith(\"FINAL\")) and .created_at > \"$SINCE\") | .id" | head -1)
  [ -n "$f" ] || return 1
  sha=$(gh api "$R/pulls/$1" --jq .head.sha)
  [ -z "$(ci_state "$sha")" ]
}
drop() { local b keep=(); for b in ${left[@]+"${left[@]}"}; do [ "$b" = "$1" ] || keep+=("$b"); done; left=(${keep[@]+"${keep[@]}"}); }

for _ in $(seq 1 600); do
  for b in ${left[@]+"${left[@]}"}; do
    p=$(prn "$b"); [ -n "$p" ] || continue
    ready "$p" || continue
    if lock_busy; then say "$(date -u +%H:%M) #$p is ready; waiting for the lock ($(lock_what))"; continue; fi
    t=$(gh api "$R/pulls/$p" --jq .title); log=$WORK/watch-$b.log
    say "$(date -u +%H:%M) releasing #$p ($b)${DRY:+, dry run}"
    DRY_RUN=$DRY timeout 900 bash "$RELEASE_TOOLS/rel.sh" next "$t" "$GO" "$p" > "$log" 2>&1 && rc=0 || rc=$?
    case $rc in
      0) ;;
      5) say "  the lock or an open release PR is in the way; trying again next minute: $(tail -1 "$log")"; continue ;;
      4) say "CONFLICT: #$p ($b) NOT RELEASED:"; grep -A50 -m1 'CONFLICT' "$log" || tail -5 "$log"; failed+=("#$p ($b): conflict"); drop "$b"; continue ;;
      *) say "FAILED: #$p ($b) NOT RELEASED (rel.sh exit $rc):"; tail -5 "$log"; failed+=("#$p ($b): rel.sh exit $rc"); drop "$b"; continue ;;
    esac
    if [ -n "$DRY" ]; then tail -3 "$log"; drop "$b"; continue; fi
    P=$(sed -n 's/^release PR #\([0-9]*\)$/\1/p' "$log" | tail -1)
    # pubnow.sh holds the lock until the release is live or has failed (it gives up by itself within about 2 hours)
    for _ in $(seq 1 400); do lock_busy || break; sleep 20; done
    tail -3 "$WORK/pub$P.log" || true
    grep -q '^LIVE' "$WORK/pub$P.log" || { say "FAILED: #$p ($b) release PR #$P did not go live: see $WORK/pub$P.log"; failed+=("#$p ($b): publish of release PR #$P"); }
    drop "$b"
  done
  if [ ${#left[@]} -eq 0 ] || [ -n "$DRY" ]; then
    if [ ${#failed[@]} -gt 0 ]; then say "done, with FAILURES:"; printf '  %s\n' "${failed[@]}"; exit 1; fi
    say "all done"; exit 0
  fi
  sleep 60
done
say "gave up waiting after 10 hours; left: ${left[*]}${failed[0]:+; FAILED: ${failed[*]}}"
exit 1
