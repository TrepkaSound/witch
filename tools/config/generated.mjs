// Inventory maintained generated products, their inputs and consumers; include a read-only writer scan for discovery.
//   node tools/config/generated.mjs --write
//   node tools/config/generated.mjs --check
//   node tools/config/generated.mjs --writers
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { releaseStrict } from './strict.mjs';

export const products = [
  ['config/KNOBS.md', 'tools/config/schema.mjs --docs', 'config/tuning.json; config/schema/tuning.schema.json; config/knobs/*.json', 'GitHub reference; not runtime/build', 'Reader page: the release rewrites it (regen.mjs); stale is only noted on a builder\'s PR, and fails at a release (schema.mjs --check)'],
  ['config/schema/*.schema.json', 'tools/config/schema.mjs --init/--add/--docs', 'Config values; src/rules/configSchemas.ts; tuningSchema.ts; knob words', 'Tests, authoring/editor contract; not game runtime', 'Keep authored constraints; values checked on every PR (schema.mjs --check); the generated descriptions are rewritten at the release with KNOBS.md'],
  ['src/rules/tuning.generated.d.ts', 'tools/config/typegen.mjs --write', 'config/schema/tuning.schema.json; JSON inferred types for unconstrained nodes', 'Typecheck only; erased at build', 'The typecheck reads it: fresh on every PR (typegen.mjs --check); on a clash, rerun, never hand-merge'],
  ['docs/notes/INDEX.md', 'tools/docs/glossary.mjs --write', 'docs/notes/*.md headings, summaries and glossary entries', 'GitHub readers; not runtime/build', 'Reader page: the release rewrites it (regen.mjs); stale is only noted on a builder\'s PR, and fails at a release (glossary.mjs)'],
  ['docs/LINK-SWITCHES.md', 'tools/config/linkSwitches.mjs', 'config/link-switches/*.json (a file a switch), retired/*.json, _about.json; source switch reads', 'GitHub readers; not runtime/build', 'Reader page: the release rewrites it (regen.mjs); stale is only noted on a builder\'s PR, and fails at a release; a switch read but without a file (or the reverse) fails on every PR (linkSwitches.mjs --check)'],
  ['art/mesh/species/index.js', 'tools/creature-mesh/index.mjs', 'art/mesh/species/<id>.js (a file a kind)', 'Game, art tools and tests', 'The game reads it: every kind listed on every PR (index.mjs --check, meshCreatures.test.ts); a line a kind, merge=union, any order'],
  ['config/mesh-lengths.json', 'tools/creature-mesh/lengths.mjs', 'art/mesh plans and shapes', 'Game rules (her line of followers)', 'The game reads it: fresh on every PR (lengths.mjs --check, meshLengths.test.ts); on a clash, rerun, never hand-merge'],
  ['tools/**/README.md', 'tools/inventory.mjs (only marked generated READMEs)', 'Script headers, legacy inventory notes, directory entries', 'GitHub readers; not runtime/build', 'Reader page: the release rewrites it (regen.mjs); stale is only noted on a builder\'s PR, and fails at a release (inventory.mjs --check); hand-written READMEs excluded'],
  ['tools/README.md', 'tools/inventory.mjs', 'Tool directories and script names', 'GitHub readers; not runtime/build', 'Reader page: the release rewrites it (regen.mjs); stale is only noted on a builder\'s PR, and fails at a release (inventory.mjs --check)'],
  ['docs/generated-files.md', 'tools/config/generated.mjs --write', 'products table in generator', 'GitHub readers; not runtime/build', 'Reader page: the release rewrites it (regen.mjs); stale is only noted on a builder\'s PR, and fails at a release (generated.mjs --check)'],
  ['DESIGN.md; docs/**/*.md marked data blocks', 'tools/docs/tables.mjs --write', 'TABLES registry; species/area/attack/other source records', 'GitHub readers; not runtime/build', 'Keep authored prose; the generated blocks as a reader page: the release rewrites them, stale only noted on a builder\'s PR (tables.mjs)'],
  ['art/areas/index.js; art/flora/species/index.js; art/creatures/index.js', 'tools/data.mjs; tools/creatures.mjs', 'Per-area, flora and creature folders', 'Game and art tools/build', 'Keep committed; existing data.mjs areas check / flora check and creatures.mjs check; inventory only here'],
  ['config/combat.json attacks; config/schema/attacks.schema.json', 'tools/attacks/compile.mjs', 'config/attacks.json; src/rules/attacks parser/compiler/schema', 'Combat records at game runtime; schema for authoring', 'Keep committed; existing compile.mjs --check and src/rules/attacks/attacks.test.ts; no regeneration here'],
  ['samples/manifest.json; samples/CREDITS.md; samples/**/*.ogg', 'tools/samples/build.mjs; credits.mjs', 'samples/sources.json; original sample files; audio encoders', 'Audio runtime; credits for readers', 'Keep committed; samples/check.mjs checks credits, licences, listed files and size; NO source-to-encoded-audio freshness check today'],
  ['src/platform/audio/fof/fofModule.ts', 'tools/voice/fof/build.mjs', 'tools/voice/fof/fof.dsp; pinned Faust compiler and libraries', 'Audio runtime', 'Keep committed; NO source freshness check today (audio behaviour checks differ); coordinator follow-up when DSP/compiler inputs change'],
  ['src/platform/audio/tract/tractModule.ts', 'tools/voice/tract/build.mjs', 'worklet.js; vendored Pink Trombone; esbuild', 'Audio runtime', 'Keep committed; NO source freshness check today; coordinator follow-up when worklet/vendor inputs change'],
  ['tools/mushrooms/index.html', 'tools/mushrooms/build-preview.mjs', 'explorer.fragment.html; standalone style in generator', 'Mushroom authoring explorer; not game runtime', 'Keep committed; NO generated-page freshness check today (lab behaviour checks differ); inventory only here'],
  ['config/knobs/*.json; migrated per-species/per-area source records', 'tools/config/knob-docs.mjs; tools/data.mjs; tools/creatures.mjs migration modes', 'Historical prose/config before migration', 'Now authored source; knob words read by docs tools', 'One-time migrations, NOT fresh generated products; never replay over authored edits'],
  ['docs/**/*.json; performance-data/**; audit/report Markdown and evidence', 'Benchmark, audit, profile and study tools (writer scan lists call sites)', 'Named historical revision, seed, environment, recordings/results', 'Review evidence; not game runtime/build', 'Keep intentional snapshots; do not regenerate as freshness check'],
  ['dist/**; dist-*/**; previews/**; upcoming.generated.json; ignored caches', 'Vite; lab/making-of builders; CI; capture/benchmark tools', 'Source code, authored assets, current PR metadata, measured runs', 'Site build or local diagnostic consumers', 'Already generated at build/CI time and ignored; remain uncommitted'],
];

function inventoryText() {
  const lines = ['# Generated files', '', 'Generated by `node tools/config/generated.mjs --write`; edit its products table, not this file.', '',
    'Products are grouped below; composite authored files identify the generated portion. Art/audio products are inventoried without changing their owners’ generators. Historical measurements and one-time migrations are deliberately separate from freshness checks.', '',
    '| Output | Generator | Inputs | Consumer | Policy |', '|---|---|---|---|---|', ...products.map(row => '| ' + row.map(x => x.replaceAll('|', '\\|')).join(' | ') + ' |'), '',
    'Discovery: `node tools/config/generated.mjs --writers` reports file-write call sites in tracked scripts, including dynamic output paths and historical evidence writers. Review those call sites when adding a generator; a static scan cannot infer arbitrary computed destinations or establish that historical evidence is reproducible.', '',
    '## The one rule (Ed, 2026-11-15)', '', 'Generated files stay committed, nobody merges one by hand, and the release rewrites them all: `node tools/config/regen.mjs` (the coordinator, on the combined build; `--check` proves everything fresh). So:', '',
    '1. **Reader pages** (nothing in the game, the build, the typecheck or a tool reads them: the link switches\' page, the knob reference and the schema\'s descriptions, the notes\' index, the docs\' tables, the tools\' READMEs, this page): a builder needn\'t commit them. Their checks only note a stale one on a builder\'s pull request, and fail at a release (a pull request into main, a push to main, or `GENERATED_STRICT=1`: `tools/config/strict.mjs`).',
    '2. **Files the game, the typecheck or a test reads** (the species list, the mesh lengths, the tuning\'s type, the art indexes, the compiled attacks): fresh on every pull request, as before, since the change doesn\'t run without them.',
    '3. **On a clash in any generated file**: take either side and run its generator (or `regen.mjs`); never merge its lines by hand.', '',
    'Freshness gate: `node tools/config/check.mjs`. Every maintained config/docs check runs before CI builds the shared game artifact. No generation runs inside typecheck or at game startup.', ''];
  return lines.join('\n');
}

export function main(args = process.argv.slice(2)) {
  if (args[0] === '--writers') {
    const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(f => /\.[cm]?[jt]s$/.test(f) && !/\.test\./.test(f));
    for (const file of files) for (const [i, line] of fs.readFileSync(file, 'utf8').split(/\r?\n/).entries())
      if (/\b(?:writeFileSync|writeFile|appendFileSync)\s*\(/.test(line)) console.log(`${file}:${i + 1}: ${line.trim()}`);
    return;
  }
  if (args.length !== 1 || !['--check', '--write'].includes(args[0])) throw Error('Use --check, --write or --writers');
  const file = 'docs/generated-files.md', want = inventoryText();
  if (args[0] === '--write') fs.writeFileSync(file, want);
  else if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') !== want) {
    if (releaseStrict()) { console.error(`${file}: stale; fix: node tools/config/generated.mjs --write`); process.exitCode = 1; }
    else console.log(`${file}: stale (noted only: the release rewrites it, node tools/config/regen.mjs)`);
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
