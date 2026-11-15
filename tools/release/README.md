# Release scripts (as the coordinator ran them, 2026-11-14)

Copied unchanged from the coordinator's scratch folder so they can be reviewed and hardened in the repo; the only edit is the
working folder, now `$RELEASE_WORKDIR` (it must hold a clone of the repo at `./th`).

- `rel.sh N "title" "Ed's go" PR...`: release N. Branch `claude/release-N` from `claude/prototype`, stamp live changelog
  fragments, merge each PR head if its CI is green (`SKIPGREEN="<pr>:<why>"` accepts a known red), combine the PRs' bench
  declarations, open and merge the release PR into `claude/prototype`, then start `pubnow.sh`.
- `pubnow.sh N "title"`: build, fast-forward prototype, open and merge the publish-snapshot PR into `main` (with retries), wait
  for the Pages deploy, check the public `version.json`, then report the full CI on the release head.
- `watchpr.sh <branch> "<go>" <since>`: release a PR once its "FINAL:" comment (after `since`) is up and its CI is green.
- `chain.sh`: the helpers the coordinator's chains use (`waitci`, `rel`).

Known problems (to fix here): no test-merge before a PR is reported ready; commands carry on past errors; nothing cancels
duplicate CI runs of one branch; two chains can race for the same release number.
