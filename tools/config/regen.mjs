// Rewrites every generated file from its sources, in one go (Ed, 2026-11-15, "Do 1-7", item 1: shared files that don't clash).
// The one rule for generated files: they stay committed, nobody merges one by hand, and the release rewrites them all with this.
// So a builder commits only the ones their own change needs to run (the species list, the mesh lengths, the tuning's type), a
// clash in one is settled by taking either side and running this, and the reader pages (docs/LINK-SWITCHES.md, config/KNOBS.md,
// docs/notes/INDEX.md, the docs' tables, the tools' READMEs) may be stale on a builder's pull request: their checks only note it
// there, and fail at a release (tools/config/strict.mjs). docs/generated-files.md lists every product.
//   node tools/config/regen.mjs           the coordinator, on the combined build before a release; anyone, after a clash
//   node tools/config/regen.mjs --check   everything fresh, as a release needs it (the strict checks, whatever the branch)
import { spawnSync } from 'node:child_process';

const WRITE = [
  ['tools/config/format.mjs', '--write'],
  ['tools/config/schema.mjs', '--docs'],
  ['tools/config/typegen.mjs', '--write'],
  ['tools/config/linkSwitches.mjs'],
  ['tools/docs/glossary.mjs', '--write'],
  ['tools/docs/tables.mjs', '--write'],
  ['tools/creature-mesh/index.mjs'],
  ['tools/creature-mesh/lengths.mjs'],
  ['tools/inventory.mjs'],
  ['tools/config/generated.mjs', '--write'],
];
const CHECK = [['tools/config/check.mjs'], ['tools/creature-mesh/index.mjs', '--check'], ['tools/creature-mesh/lengths.mjs', '--check']];
let failed = 0;
for (const args of process.argv.includes('--check') ? CHECK : WRITE) {
  const r = spawnSync(process.execPath, args, { stdio: 'inherit', env: { ...process.env, GENERATED_STRICT: '1' } });
  if (r.status !== 0) { console.error(`failed: node ${args.join(' ')}`); failed++; }
}
process.exitCode = failed ? 1 : 0;
