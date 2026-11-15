#!/usr/bin/env bash
# Helpers for the coordinator's release chains. Source it, then call:
#   waitci <pr>                                waits (up to 75 min) for the PR head's CI, then prints "#<pr> CI: [<what isn't green>]"
#   rel <N|next> "<title>" "<Ed's go>" <pr>... one release through rel.sh and its pubnow.sh, start to live; logs in the work folder
# (source tools/release/chain.sh; sourcing turns on "set -euo pipefail" in the calling shell, as the scripts have it.)
# shellcheck source=tools/release/lib.sh
. "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

waitci() {
  local h ci
  for _ in $(seq 1 75); do
    h=$(gh api "$R/pulls/$1" --jq .head.sha); ci=$(ci_state "$h")
    case $ci in *pending*|"none yet") sleep 60 ;; *) break ;; esac
  done
  say "#$1 CI: [$ci]"
}

rel() {
  local log P rc
  mkdir -p "$WORK"; log=$WORK/rel-$(date -u +%Y%m%dT%H%M%S).log
  timeout 1200 bash "$RELEASE_TOOLS/rel.sh" "$@" > "$log" 2>&1 && rc=0 || rc=$?
  say "rel $1 exit $rc ($log)"; tail -4 "$log"
  [ "$rc" = 0 ] || return "$rc"
  P=$(sed -n 's/^release PR #\([0-9]*\)$/\1/p' "$log" | tail -1)
  [ -n "$P" ] || return 0 # (a dry run opens none)
  for _ in $(seq 1 400); do lock_busy || break; sleep 30; done # pubnow.sh holds the lock until live or failed
  tail -3 "$WORK/pub$P.log"
  grep -q '^LIVE' "$WORK/pub$P.log"
}
