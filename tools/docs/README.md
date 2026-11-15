# tools/docs

<!-- written by tools/inventory.mjs; edit the scripts' header comments, then run it again -->

## `glossary.mjs`

The glossary's index: each note under docs/notes/ holds its area's entries as bold names opening a line, and docs/notes/INDEX.md lists them, made from the notes, never by hand.

```
node tools/docs/glossary.mjs           checks docs/notes/INDEX.md is as the notes make it (noted only; exit 1 if not at a release:
node tools/docs/glossary.mjs --write   writes it
```

## `reflow.mjs`

Breaks a note's giant one-line bullets into a sentence a line, changing no words: git merges by line, so two builders editing different points of one 6000-character bullet clashed every time.

```
node tools/docs/reflow.mjs docs/notes/gameplay.md [more.md ...]   rewrites them
node tools/docs/reflow.mjs --check docs/notes/*.md                lists the lines it would break, changes nothing (exit 1 if any)
```

## `tables.mjs`

The docs' tables made from the data: a table in a doc that only copies a data file is written between two marks, from that file, never by hand: <!-- data: <name> -->...

```
node tools/docs/tables.mjs           checks every doc's tables (noted only; exit 1 if one is out of date at a release: tools/config/strict.mjs)
node tools/docs/tables.mjs --write   writes them
```

## Also here

- `glossary.test.ts`
- `tables.test.ts`
