# Declared bench differences

One file per branch that means to change the game: `tools/bench/expect/<branch>.json` (e.g. `claude/my-branch.json`),
`{ "reason": "...", "frames": { "<scene>": "why" }, "rules": { "<state part>": "why" } }`. See `tools/bench/README.md` and
`tools/bench/expect.cjs`.

At release, `tools/release/combine-bench.mjs` combines the released PRs' declarations into `claude/release-<n>.json` and
deletes their own files and earlier releases' combined ones (`docs/notes/guardrails.md`): what stays here is the latest
release's file and the declarations of branches not yet released.
