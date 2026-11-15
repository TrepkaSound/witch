# tools/checks

<!-- written by tools/inventory.mjs; edit the scripts' header comments, then run it again -->

## `git-base.mjs`

Shared by the guardrail checks: the change's base, files as they were there, and the escape trailers in its commits.

## `loops.mjs`

No new import loops in src/.

```
node tools/checks/loops.mjs [--base <ref>] [--list] [--json]
```

## `size.mjs`

The size ratchet: big files and functions in src/ may shrink but not grow.

```
node tools/checks/size.mjs [--base <ref>] [--list]
```

## `which.mjs`

Which checks the current change needs, from its changed files and config/checks.json: the builder's before a FINAL, and the coordinator's on the combined build.

```
node tools/checks/which.mjs [--base <ref>] [--json] [--all] [path ...]
```

## Also here

- `guardrails.test.ts`
- `which.test.ts`
