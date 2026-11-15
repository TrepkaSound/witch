# tools/docs

<!-- written by tools/inventory.mjs; edit the scripts' header comments, then run it again -->

## `glossary.mjs`

The glossary's index: each note under docs/notes/ holds its area's entries as bold names opening a line, and docs/notes/INDEX.md lists them, made from the notes, never by hand.

```
node tools/docs/glossary.mjs           checks docs/notes/INDEX.md is as the notes make it (exit 1 if not)
node tools/docs/glossary.mjs --write   writes it
```

## `rulings.mjs`

The stale-ruling check: builders read comments and notes as the truth about Ed's rulings, and a stale one misleads them.

```
node tools/docs/rulings.mjs                  the warnings (exit 0)
node tools/docs/rulings.mjs --all            with the noisy `older` list
node tools/docs/rulings.mjs --topic <text>   Ed's rulings on a knob, a name or a word, newest first: read it before you brief or build
node tools/docs/rulings.mjs --strict         exit 1 if there is a warning (not `older`)
node tools/docs/rulings.mjs --json           the same as data
```

## `tables.mjs`

The docs' tables made from the data: a table in a doc that only copies a data file is written between two marks, from that file, never by hand: <!-- data: <name> -->...

```
node tools/docs/tables.mjs           checks every doc's tables (exit 1 if one is out of date)
node tools/docs/tables.mjs --write   writes them
```

## Also here

- `glossary.test.ts`
- `rulings-ok.json`
- `rulings.test.ts`
- `tables.test.ts`
