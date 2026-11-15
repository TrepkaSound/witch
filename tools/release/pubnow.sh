#!/bin/bash
# Publish a release PR (claude/release-N, already checked locally): wait for its build, fast-forward prototype to it, merge it
# to main through claude/publish-snapshot, wait for CI's deploy, then wait until the PUBLIC version.json shows the new build
# (CI's deploy only writes gh-pages; the Pages publisher puts it live). If the public site lags 22 min (its CDN caches version.json 10 min, ignoring query strings), request the publisher
# once by hand (workflow_dispatch). Full CI on the release head is reported after. Only on Ed's explicit go naming the PRs.
set -u
N=$1; T=$2; R=repos/edsaperia/witch; S=${RELEASE_WORKDIR:?set RELEASE_WORKDIR to a folder holding a clone at ./th}
H=$(gh api $R/pulls/$N --jq .head.sha); echo "PR #$N head $H"
for i in $(seq 1 30); do
  b=$(gh api "$R/commits/$H/check-runs?per_page=100" --jq '.check_runs[]|select(.name=="build")|"\(.status) \(.conclusion)"' | head -1)
  case "$b" in "completed success") break;; "completed "*) echo "build: $b"; exit 2;; esac; sleep 20
done
[ "$b" = "completed success" ] || { echo "build timeout"; exit 1; }
cd $S/th && git fetch -q origin +refs/heads/claude/prototype:refs/remotes/origin/claude/prototype && git fetch -q origin $H || exit 1
git merge-base --is-ancestor origin/claude/prototype $H || { echo "not FF of prototype"; exit 4; }
git push -q origin $H:refs/heads/claude/prototype && git push -q -f origin $H:refs/heads/claude/publish-snapshot || exit 1
M=$(gh api $R/pulls -f title="Publish (fast path): $T" -f head=claude/publish-snapshot -f base=main -f body="Publishes release PR #$N: $T. Its build passed; full CI continues on $H and is reported after.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01SzjrULBxoRwTPW2F6P3sSi" --jq .number) && echo "publish PR #$M"
# (2026-11-13, release 37: merging the moment the PR is made can get 405 "Base branch was modified"; retry a few times)
MS=""; for k in 1 2 3 4 5 6; do sleep 10; MS=$(gh api -X PUT $R/pulls/$M/merge -f merge_method=merge --jq .sha 2>/dev/null) && [ -n "$MS" ] && break; MS=""; done
[ -n "$MS" ] || { echo "merge of publish PR #$M failed"; exit 3; }; echo "main $MS"
for i in $(seq 1 120); do
  r=$(gh api "$R/commits/$MS/check-runs?per_page=100" --jq '.check_runs[]|select(.name=="deploy")|"\(.status) \(.conclusion)"' | head -1)
  case "$r" in "completed success") V=$(gh api "$R/actions/runs?head_sha=$MS" --jq '[.workflow_runs[]|select(.name=="CI")][0].run_number'); echo "DEPLOYED v$V to gh-pages $(date -u +%H:%M)"; break;; "completed "*) echo "deploy: $r"; exit 2;; esac; sleep 20
done
[ -n "${V:-}" ] || { echo "deploy: no success by $(date -u +%H:%M)"; exit 2; }
# Live means the public site serves it (2026-11-09: v7756 sat on gh-pages ~50 min while Pages deployments failed).
pub() { curl -s "https://edsaperia.github.io/witch/version.json?cb=$RANDOM$RANDOM" | sed -n 's/.*"version":"v\([0-9]*\).*/\1/p'; }
asked=""
for i in $(seq 1 120); do
  p=$(pub); if [ -n "$p" ] && [ "$p" -ge "$V" ]; then echo "LIVE v$V (public shows v$p) $(date -u +%H:%M)"; break; fi
  if [ $i -eq 66 ] && [ -z "$asked" ]; then asked=1; echo "public still v$p after 22 min: requesting the Pages publisher"; gh api -X POST "$R/actions/workflows/pages-publish.yml/dispatches" -f ref=main >/dev/null 2>&1 && echo "  requested" || echo "  request FAILED: run Actions → Publish Pages snapshot by hand"; fi
  sleep 20
done
p=$(pub); [ -n "$p" ] && [ "$p" -ge "$V" ] || echo "NOT LIVE after 40 min: public shows v$p, wanted v$V (check Actions → Publish Pages snapshot)"
# Full CI on the PR head, reported after the fact.
for i in $(seq 1 120); do
  pend=$(gh api "$R/commits/$H/check-runs?per_page=100" --jq '[.check_runs[]|select(.name!="art check" and .status!="completed")]|length')
  [ "$pend" = 0 ] && break; sleep 30
done
# (a job counts as passed if any run of it passed: a duplicate run cancelled by a newer one is not a failure; release 46)
fails=$(gh api "$R/commits/$H/check-runs?per_page=100" --jq '[.check_runs[]|select(.name!="art check")]|group_by(.name)|map(select(all(.conclusion!="success" and .conclusion!="skipped"))|.[0].name)|join(",")')
[ -z "$fails" ] && echo "FULL CI GREEN after release" || echo "FULL CI FAILED after release: $fails"
