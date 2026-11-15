# Config files

<!-- summary: The tuning file (values only) and its schema, the knobs' words in `config/knobs/<section>.json` (what each does, Ed's decisions), the style file, the link switches registry, the generated files' rule, the checks registry, the changelog's fragments. -->

The schema command bundles its existing TypeScript validators and assembled config readers in memory (`tools/config/schema-runtime.mjs`), without a Vite server or module RPC.
This removes the Windows SSR fetchModule60s timeout path rather than raising its deadline.
The same config validation and knob-document freshness checks remain strict; `tools/config/schema-runtime.test.ts` checks assembled-data parity and real CLI rejection of invalid values and stale docs.
No temporary bundle, listener or generated config is written by the loader.

PR1538/canonical6552743521 registers proof-only `telephone=1` in app/telephoneSwitch.ts; omitted/0/other values keep the original quiet-line use and no panel or identity work.
The registry and LINK-SWITCHES page are refreshed through their existing generator.
This is panel visibility only, never permission to enable calls or deploy a relay.

The link-switch scanner records paths with forward slashes on every OS. Its generated-document check ignores checkout CRLF versus LF only; all text and spacing must still match.

The schema reader's combat data imports `LEGEND` from the pure `rules/creatureLevels.ts`, not the creature simulation.
`creatures.ts` retains its original LEGEND/Level exports for callers.
The narrow boundary removes the schema tool's runtime import path to creatures/wildWatch/game without changing assembled combat values or any timeout; parity and dependency-graph tests guard it.
Windows cold/warm gate timing remains separate evidence, under the laptop allocation rule.

Read-only at run time (config mutation, 2026-11-04): the game keeps what it works out while playing in its own module maps, never in the config objects it read.
A pack's moves (`pack:<species>:<melee|ranged>:<level>`, rules/combat/packs.ts `packAttack`) were cached into `COMBAT.attacks`, the combat file's own `attacks`; they now live in rules/combat/data.ts (`madeAttack`), and `attackNamed` finds them by name, making one asked for before anything made it (a shot in flight on a page that hasn't made its move yet).
`withTuning` (tests and experiments) returns a deep copy: it copied only the top, so `withTuning({}).partyObjects.generated = true` changed TUNING for every later test in the worker.
A run of every rules test and three bot nights with every config deep-frozen found no other game code writing into config; the only writers left are test files that set a config value and put it back by hand (legends, combatRoles, strength, pickup, movement, combatSpacing and others).
`src/rules/configReadOnly.test.ts`.

Generated config/docs (A1+A2, Ed's approved architecture review, 2026-10-30): `node tools/config/check.mjs` runs the read-only freshness gates before CI builds the shared game artifact.
Failures name the exact repair command.
`docs/generated-files.md` inventories each output family, generator, inputs, consumers and policy, including audio/art products that retain their owners' checks and historical evidence that must not be regenerated.
The six config/docs families remain committed for GitHub readers and editor/schema contracts.
`tools/inventory-notes.json` supplies descriptions for existing headerless tools without changing their owners' source; new headerless tools still fail the inventory check.
Inventory/glossary/table checks ignore checkout line endings only.

Tuning formatting: `node tools/config/format.mjs --write` keeps every leaf setting on its own line, arrays of objects in blocks, numeric vectors up to four values inline, and existing key order.
`--check` never writes; the formatter refuses any parsed-value change.
Only `config/tuning.json` is formatted by this tool.
Tuning types: `node tools/config/typegen.mjs --write` derives `src/rules/tuning.generated.d.ts` from the schema (unconstrained nodes retain JSON's inferred type), and `--check` enforces freshness.
The validated schema-derived data type must assign to the named public `Tuning` interface; tests/CI validate actual JSON values with full paths, expected types/ranges and allowed choices.
There is no startup validator or generation inside typecheck.
Derivation found and recorded the existing `light.mood` choices (`spooky`/`plain`); no current knob value changed.

Part of Witch's notes (`docs/notes/INDEX.md` is the index): the tuning file and its schema, the style file.
Moved here from CLAUDE.md as it stood (housekeeping, Ed 2026-10-23: a note an area, so pull requests add to their own area's file, not one shared file); every rule kept.
Add to this file, not CLAUDE.md, when you change this area.

Technical-debt cleanup (2026-10-29, #1459): `lasers.maxTilt` was removed from the values, type, schema and reference.
Its old note claimed a limit on beam tilt, but neither the laser rules nor the renderer read it; the dancefloor ring's actual tilt remains `speakerLasers.tilt`.
The retired `runeMarkers.stump.light` group (reach, strength, height, saturate) was removed after merging the current stump polish: no runtime reader remains; the screenshot tool retains an optional fallback for older builds.
The active cast-dial light (`stump.ring.light`) and wisps/moonlight (`stump.wisps`) stay unchanged.
No other tuning value or game behaviour changed.

Config history migration (2026-10-29, #1459): 44 long field notes and dated decisions/quotes from 26 config files moved verbatim to `docs/notes/config-history/`; configs keep one-line explanations and links.
Every non-note value is identical.
The generated house-outline note is updated at its generator too.
Bindings history remains with the gamepad owner while #1456 is open; after that branch is combined, move its `_` note with the same verbatim/non-note-equality check.
Structured knob decisions remain in `config/knobs/`.

- **Tuning file**: `config/tuning.json`, the numbers Ed edits, and only the numbers (no `_` notes since Ed, 2026-10-28: "Reformat prose into data where you can"; a test fails on one) (speeds, camera, density, glow, pixel size, creatures, bloom, tilt-shift).
  Its schema is `config/schema/tuning.schema.json` (every knob's type and range; `src/rules/schema.ts` checks it, `src/rules/tuningSchema.test.ts` fails on an unknown, missing, mistyped or out-of-range knob) and its reference, generated from the schema and the knobs' words, is `config/KNOBS.md`.
  After adding or renaming a knob, or changing its words: `node tools/config/schema.mjs --add --docs` (string choices and name-keyed records go in `TUNING_OVER`, `src/rules/tuningSchema.ts`).
  Changing a value needs nothing (the reference lists no values).
  The other configs I check the same way (`combat.json`, `movement.json`, `travel.json`, `area-types.json`: `src/rules/configSchemas.ts` lists each, its records keyed by name and its string choices; `src/rules/configs.test.ts` checks each against `config/schema/<name>.schema.json` and that the species, attacks and area types they name are real).
  After adding a field to one: `node tools/config/schema.mjs --add` (or `--init` to re-infer every schema).
- **Style file**: `config/style.json`, a style saved in the Witch Art Lab; every sprite is drawn from it.
- **Link switches**: `config/link-switches/<name>.json`, a file a switch (Ed, 2026-11-15, "Do 1-7": so two builders adding switches never touch the same file; it was one `config/link-switches.json` until then, the commonest clash at a release).
  Each is every `?name=value` the game reads from its link as a record: its values, what it does in one sentence, its group (run, view, debug or compare-with-old), since when, Ed's decision if any.
  Where it's read is found from the code each time and written only on the page, never in the record.
  The families named by a pattern (`d_<id>`) and the page's words are `config/link-switches/_about.json`; the retired ones are `config/link-switches/retired/<name>.json` (`broughtBack`, `stays`).
  **Adding a switch**: add its file. **Retiring one**: delete its read and its old code path, and move its file to `retired/`.
  `docs/LINK-SWITCHES.md` is written from them by `node tools/config/linkSwitches.mjs`; a builder needn't run it or commit the page (**Generated files**, below).
  `src/linkSwitches.test.ts` fails on a switch the code reads but has no file, one with a file but read nowhere, or a file not named for its switch.
- **Generated files** (Ed, 2026-11-15, "Do 1-7"; the full list is `docs/generated-files.md`): they stay committed, nobody merges one by hand, and the release rewrites them all with `node tools/config/regen.mjs` (`--check`: everything fresh).
  The reader pages (the link switches' page, `config/KNOBS.md` and the schema's descriptions, `docs/notes/INDEX.md`, the docs' tables, the tools' READMEs, `docs/generated-files.md`) needn't be committed by a builder: `node tools/config/check.mjs` and the tests only note a stale one on a builder's pull request, and fail at a release (a pull request into main, a push to main, or `GENERATED_STRICT=1`: `tools/config/strict.mjs`).
  The files the game, the typecheck or a test reads (`art/mesh/species/index.js`, `config/mesh-lengths.json`, `src/rules/tuning.generated.d.ts`) must still be fresh on every pull request.
  On a clash in any of them, take either side and rerun its generator.
- **Files that merge by line** (Ed, 2026-11-15): `.gitattributes` gives the append-only ones `merge=union` (the cauldron backlog, the species list), so two additions are both kept; the notes are a sentence a line (`node tools/docs/reflow.mjs <note>`, which changes no words; run it on a branch that edited a note before the reflow, then merge).
- **Knob docs** (Ed, 2026-10-28: "Let's do all the docs work. Reformat prose into data where you can"): what each tuning knob does lives in `config/knobs/<section>.json` (map, forest, witch, army, creatures, legends, party, view, light;
  `config/knobs/index.json` has the file's own notes and the sections' order), keyed by knob path: `what` (one plain sentence, what it does in player terms: the coordinator's hand pass, 2026-10-28, done for the biggest entries first, the old words moved whole into `notes`;
  `[n]` marks where decision n was said, in `what` or `notes`), `decisions` (`by`: Ed, Ed's playtest, the coordinator...;
  `date`;
  `quote`: his words exactly, one or several;
  `rest`: what else it said, what it was before), `also` (other knobs the same words cover), `links` (the files it names), `see` (a knob with no words of its own: the one whose words cover it), `notes`.
  A knob's unit and range are the schema's.
  Adding a knob: its entry in its section's file (a top-level knob must have one: `src/rules/knobDocs.test.ts`), a decision with Ed's words and the date when there is one, then `node tools/config/schema.mjs --add --docs`, which writes `config/KNOBS.md` and the schema's `description`s (the first sentence of `what`, for an editor's hover) from them (`src/rules/knobDocs.ts`).
  The files were made from the old notes by `tools/config/knob-docs.mjs` (2026-10-28; it checks every date, quote and word of the notes is kept), which can be re-run on a tuning file that still has notes (`--from`).
- **Checks registry** (Ed, 2026-11-12: "is there text that could be data?"): `config/checks.json`, which check to run when, one record a check: its id and command, what it checks in one line, the changed paths that call for it (globs, and `except`), who runs it (the builder before a FINAL, or the coordinator on the combined build, per Ed's builder rules of 2026-10-29), where CI runs it, the ruling it comes from and the note with its details.
  `node tools/checks/which.mjs [--base <ref>]` lists the checks the current change needs; `tools/checks/which.test.ts` checks the file; `docs/notes/testing.md` shows it as a table (`node tools/docs/tables.mjs --write`).
  It replaced CLAUDE.md's Testing prose.
- **Changelog fragments**: the What's new panel's data, one file per change in `config/changelog/`.
  CLAUDE.md keeps the rules every builder needs; the section as it stood there until 2026-11-12, every rule kept:

  The start screen shows a **What's new** panel: the last three entries of the changelog, newest first.
  The changelog is **one small file per change** in `config/changelog/` (Ed, 2026-10-05: so builders working in parallel don't conflict), collected at build time by `src/changelog.ts`:

  - Every push that changes something Ed can see **adds a new fragment file**, `config/changelog/<yyyy-mm-dd>-<slug>.json` (e.g. `2026-10-05-bigger-areas.json`), holding `{ "version": null, "items": ["…"] }`: its bullets in plain player-facing words ("Trees no longer pop in and out"), not commit-speak.
    Several pushes of one piece of work may add to that same fragment.
  - Leave `version` null.
    At each release the coordinator stamps every fragment it ships with that build's number: `node tools/config/stampChangelog.mjs <release commit> <build>` (`--check [<ref>]` lists live fragments still null).
    Never edit anyone else's fragment.
  - `config/changelog/archive.json` holds everything up to round 9 and is frozen: never edit it. There is no shared list to edit.
  - Fragments with the same version make one entry (the newest file's items first); the current build's (`version: null`) shows as the build being played.
    `src/changelog.test.ts` checks every file's shape.
