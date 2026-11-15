#!/bin/bash
# Release mesh batches F/G one at a time as each posts a FINAL and its CI is green (Ed 2026-11-13 chose "1" for D/E and again for F/G: straight through).
S=${RELEASE_WORKDIR:?set RELEASE_WORKDIR to a folder holding a clone at ./th}; R=repos/edsaperia/witch; cd $S
left="$1"; GO="$2"; SINCE="$3"; n=0
prn() { gh api "$R/pulls?state=open&head=edsaperia:claude/$1" --jq ".[0].number // empty"; }
ready() { local p=$(prn $1) sha f st; [ -n "$p" ] || return 1
  f=$(gh api "$R/issues/$p/comments?per_page=100" | jq -r --arg s "$SINCE" '[.[]|select((.body|startswith("FINAL")) and .created_at>$s)]|length'); [ "$f" -gt 0 ] || return 1
  sha=$(gh api $R/pulls/$p --jq .head.sha)
  st=$(gh api "$R/commits/$sha/check-runs?per_page=100" | jq -r '[.check_runs[]|select(.conclusion!="success" and .conclusion!="skipped" and .conclusion!="neutral")|.name]|length'); [ "$st" = 0 ]; }
for i in $(seq 1 600); do
  for p in $left; do
    if ready $p && ! pgrep -f "rel.sh|pubnow.sh|chain5|rel50b" >/dev/null; then
      n=$(( $(ls rel[0-9]*.log | grep -o "[0-9][0-9]*" | sort -n | tail -1) + 1 )); b=$p; p=$(prn $b); t=$(gh api $R/pulls/$p --jq .title)
      echo "$(date -u +%H:%M) releasing #$p as release $n"
      timeout 900 bash rel.sh $n "$t" "$GO" $p > rel$n.log 2>&1; echo "rel exit $?"
      P=$(grep -o "release PR #[0-9]*" rel$n.log | grep -o "[0-9]*$")
      if [ -z "$P" ]; then tail -3 rel$n.log; left=$(echo $left | sed "s/$b//"); echo "#$p FAILED to release"; continue; fi
      for j in $(seq 1 120); do grep -qE "^LIVE|NOT LIVE|timeout|failure|deploy:|build:|not FF|merge of publish" pub$P.log 2>/dev/null && break; sleep 20; done
      grep -v "unsupported protocol" pub$P.log | tail -3
      left=$(echo $left | sed "s/$b//"); n=$((n+1))
    fi
  done
  [ -z "$(echo $left | tr -d ' ')" ] && { echo "all done"; exit 0; }
  sleep 60
done
echo "gave up waiting; left: $left"
