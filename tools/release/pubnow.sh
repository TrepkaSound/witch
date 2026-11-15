#!/usr/bin/env bash
# Publish a release PR (claude/release-N, already checked by rel.sh): wait for its build, fast-forward prototype to it, merge it
# to main through claude/publish-snapshot, wait for CI's deploy, then wait until the PUBLIC version.json shows the new build
# (CI's deploy only writes gh-pages; the Pages publisher puts it live). If the public site lags 22 min (its CDN caches
# version.json 10 min, ignoring query strings), request the publisher once by hand (workflow_dispatch). Full CI on the
# release head is reported after. Only on Ed's explicit go naming the PRs. rel.sh starts it and hands it the lock; run
# alone, it takes the lock itself.
#   bash tools/release/pubnow.sh [--dry-run] <release PR number> "<title>"
# --dry-run (or DRY_RUN=1) reads the PR and its build once, then prints the pushes and the merge instead of running
# them, and stops. Exits: 1 build timeout or a failed fetch or push, 2 build or deploy failed, 3 the publish PR's merge
# failed, 4 not a fast-forward of prototype, 5 locked, 7 deployed but not live on the public site, 8 full CI failed after.
# shellcheck source=tools/release/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

if [ "${1:-}" = --dry-run ]; then DRY=1; shift; fi
[ $# -eq 2 ] && [[ $1 =~ ^[0-9]+$ ]] || die 2 "usage: bash tools/release/pubnow.sh [--dry-run] <release PR number> \"<title>\""
N=$1; T=$2
need git gh jq curl
need_session
cd "$REPO_DIR"
lock_traps
if [ -n "${RELEASE_LOCK_INHERITED:-}" ]; then lock_inherit "pubnow.sh $N"; else lock_take "pubnow.sh $N${DRY:+, dry run}"; fi

H=$(gh api "$R/pulls/$N" --jq .head.sha); say "PR #$N head $H"
b=$(job_state "$H" build)
if [ -z "$DRY" ]; then
  for _ in $(seq 1 30); do
    case $b in success) break ;; failed:*) die 2 "build: $b" ;; esac
    sleep 20; b=$(job_state "$H" build)
  done
  [ "$b" = success ] || die 1 "build timeout (10 min): still $b"
fi
say "build: $b"
git fetch -q "$REMOTE" "+refs/heads/$BASE:refs/remotes/$REMOTE/$BASE"
git fetch -q "$REMOTE" "$H"
git merge-base --is-ancestor "$REMOTE/$BASE" "$H" || die 4 "not FF of prototype: $BASE moved since release PR #$N was made"
run git push -q "$REMOTE" "$H:refs/heads/$BASE"
# (the snapshot branch is only ever a pointer to what is being published, so it is overwritten)
run git push -q -f "$REMOTE" "$H:refs/heads/claude/publish-snapshot"
BODY="Publishes release PR #$N: $T. Its build passed; full CI continues on $H and is reported after.$(footer)"
if [ -n "$DRY" ]; then
  run gh api "$R/pulls" -f title="Publish (fast path): $T" -f head=claude/publish-snapshot -f base=main -f body="$BODY" --jq .number
  run gh api -X PUT "$R/pulls/<publish PR>/merge" -f merge_method=merge --jq .sha
  say "DRY RUN done: it would then wait for main's deploy job, for $PUBLIC_VERSION_URL to show the build, and report full CI on $H"
  exit 0
fi
M=$(gh api "$R/pulls" -f title="Publish (fast path): $T" -f head=claude/publish-snapshot -f base=main -f body="$BODY" --jq .number)
say "publish PR #$M"

# The merge. Merging the moment the PR is made can get 405 "Base branch was modified" or "not mergeable" while GitHub
# is still working the PR out (2026-11-13, release 37): wait 10 s, try up to 6 times, and say what each try got.
# Only 405, 409 and server errors are tried again; anything else (403, 404, 422) is a real refusal and stops at once.
MS=""
for k in 1 2 3 4 5 6; do
  sleep 10
  if out=$(gh api -X PUT "$R/pulls/$M/merge" -f merge_method=merge 2>&1); then
    MS=$(jq -r '.sha // empty' <<<"$out" 2>/dev/null || true)
    if [ -n "$MS" ]; then break; fi
    say "merge try $k/6: no merge commit in the answer: $out"
  else
    code=$(grep -oE 'HTTP [0-9]+' <<<"$out" | tail -1 | cut -d' ' -f2 || true)
    msg=$(jq -r '.message // empty' <<<"$(grep -m1 '^{' <<<"$out" || true)" 2>/dev/null || true)
    say "merge try $k/6: HTTP ${code:-?} ${msg:-$(tail -1 <<<"$out")}"
    case ${code:-} in 405|409|5??|"") ;; *) die 3 "merge of publish PR #$M refused (HTTP $code): not retried" ;; esac
  fi
done
[ -n "$MS" ] || die 3 "merge of publish PR #$M failed after 6 tries: merge it by hand, or close it and run pubnow.sh $N again"
say "main $MS"

V=""
for _ in $(seq 1 120); do
  r=$(job_state "$MS" deploy)
  case $r in
    success) V=$(gh api "$R/actions/runs?head_sha=$MS" --jq '[.workflow_runs[]|select(.name=="CI")][0].run_number'); say "DEPLOYED v$V to gh-pages $(date -u +%H:%M)"; break ;;
    failed:*) die 2 "deploy: $r" ;;
  esac
  sleep 20
done
[[ $V =~ ^[0-9]+$ ]] || die 2 "deploy: no success by $(date -u +%H:%M) (40 min)"

# Live means the public site serves it (2026-11-09: v7756 sat on gh-pages ~50 min while Pages deployments failed).
pub() { curl -s "$PUBLIC_VERSION_URL?cb=$RANDOM$RANDOM" | sed -n 's/.*"version":"v\([0-9]*\).*/\1/p' || true; }
live() { p=$(pub); [ -n "$p" ] && [ "$p" -ge "$V" ]; }
asked=""; rc=0
for i in $(seq 1 120); do
  if live; then say "LIVE v$V (public shows v$p) $(date -u +%H:%M)"; break; fi
  if [ "$i" -eq 66 ] && [ -z "$asked" ]; then
    asked=1; say "public still v$p after 22 min: requesting the Pages publisher"
    if gh api -X POST "$R/actions/workflows/pages-publish.yml/dispatches" -f ref=main >/dev/null 2>&1; then say "  requested"; else say "  request FAILED: run Actions → Publish Pages snapshot by hand"; fi
  fi
  sleep 20
done
if ! live; then say "NOT LIVE after 40 min: public shows v$p, wanted v$V (check Actions → Publish Pages snapshot)"; rc=7; fi

# Full CI on the PR head, reported after the fact (lib.sh's rule: a job passed if any run of it passed).
ci=$(ci_state "$H")
for _ in $(seq 1 120); do
  case $ci in *pending*|"none yet") sleep 30; ci=$(ci_state "$H") ;; *) break ;; esac
done
if [ -z "$ci" ]; then say "FULL CI GREEN after release"; else say "FULL CI FAILED after release: $ci"; [ "$rc" != 0 ] || rc=8; fi
exit "$rc"
