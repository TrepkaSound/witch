cd ${RELEASE_WORKDIR}
R=repos/edsaperia/witch
waitci() { for i in $(seq 1 75); do h=$(gh api $R/pulls/$1 --jq .head.sha); pend=$(gh api "$R/commits/$h/check-runs?per_page=100" --jq '[.check_runs[]|select(.name!="art check" and .status!="completed")]|length'); [ "$pend" = 0 ] && break; sleep 60; done; echo "#$1 CI: [$(gh api "$R/commits/$h/check-runs?per_page=100" --jq '[.check_runs[]|select(.name!="art check")]|group_by(.name)|map(select(all(.conclusion!="success" and .conclusion!="skipped"))|.[0].name)|join(",")')]"; }
rel() { n=$1; t=$2; g=$3; shift 3; timeout 1200 bash rel.sh $n "$t" "$g" "$@" > rel$n.log 2>&1; echo "rel $n exit $?"; tail -4 rel$n.log; P=$(grep -o "release PR #[0-9]*" rel$n.log | grep -o "[0-9]*$"); [ -n "$P" ] || return 4; while pgrep -f "pubnow.sh $P" >/dev/null; do sleep 30; done; grep -v "unsupported protocol" pub$P.log | tail -3; }
while pgrep -f "rel50b.sh" >/dev/null || pgrep -f "rel.sh|pubnow.sh" >/dev/null; do sleep 30; done
echo "== release 50 done"; tail -4 /tmp/claude-0/-home-user/86e06bb6-4523-54d2-a9e5-46c2823f0bd5/tasks/bpmkn2psi.output
waitci 2048; rel 51 "Dancefloor stones: low rounded boulders, no dots" "publish ... 2048; dots: drop them (Ed, 2026-11-13)" 2048
for p in 2046 2047 2051 2055; do waitci $p; done
rel 52 "Analyser rings full circles; no glow over the stump; conga spacing from the meshes; friendly legends walk the route out and back" "publish things (Ed, 2026-11-13, of #2046 #2047 #2051 #2055)" 2046 2047 2051 2055
