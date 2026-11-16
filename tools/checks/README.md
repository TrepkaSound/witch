# tools/checks

<!-- written by tools/inventory.mjs; edit the scripts' header comments, then run it again -->

## `art-types.mjs`

The art type check. TypeScript reads art/'s JavaScript with tsconfig.art.json and the types in art/mesh/types.d.ts, and this fails on any error in a checked file.

```
node tools/checks/art-types.mjs            (npm run typecheck:art) the errors in checked files, and the left-out counts
node tools/checks/art-types.mjs --all      every error, left-out files' too
```

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
