// The art type check (Ed's go, 2026-11-15, quality plan item f: "Type-check the art code"; docs/notes/art-checks.md,
// **Type-checking the art**). TypeScript reads art/'s JavaScript with tsconfig.art.json (checkJs on, strict off: the art has no
// parameter types, so `noImplicitAny` would be 7,600 errors of no use) and the types in art/mesh/types.d.ts, and this fails on any
// error in a checked file. Every file under art/ is checked except those under LEFT_OUT: folders and files with errors not yet
// fixed, each with its count when it was left out. TypeScript still reads them (a checked file imports them), but their errors
// only count here. Take a path off the list once it is clean (the check says so); never add one to hide a new error.
// No art file is changed or run: only read.
//   node tools/checks/art-types.mjs            (npm run typecheck:art) the errors in checked files, and the left-out counts
//   node tools/checks/art-types.mjs --all      every error, left-out files' too
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Not checked yet: path (a folder ends in /) → its error count when left out (2026-11-16). */
export const LEFT_OUT = {
  "art/areas.js": 22,
  "art/attackLook.js": 13,
  "art/beach.js": 3,
  "art/bedroom.js": 6,
  "art/body-graph/fixtures.js": 2,
  "art/check.mjs": 46,
  "art/core.js": 6,
  "art/country.js": 18,
  "art/creature-size.js": 1,
  "art/creatures3d.js": 30,
  "art/danceStones.js": 2,
  "art/dancefloor.js": 2,
  "art/decor.js": 2,
  "art/dolphins.js": 2,
  "art/effects.js": 1,
  "art/ent.js": 12,
  "art/export.mjs": 2,
  "art/flora/blob.js": 2,
  "art/furniture.js": 17,
  "art/generator.js": 1,
  "art/genome/parts.js": 12,
  "art/ground.js": 1,
  "art/headless.mjs": 2,
  "art/kraken.js": 2,
  "art/landmarks.js": 21,
  "art/legends.js": 8,
  "art/model3d.js": 4,
  "art/mushrooms.js": 34,
  "art/naps.js": 3,
  "art/party.js": 15,
  "art/partyRelics.js": 2,
  "art/paths.js": 9,
  "art/preview.mjs": 130,
  "art/props/generator.js": 4,
  "art/props/sets.js": 3,
  "art/props/stumps.js": 3,
  "art/relics.js": 3,
  "art/scenes.js": 3,
  "art/setpieces.js": 2,
  "art/sigils.js": 5,
  "art/soundsystem.js": 15,
  "art/soundsystemGen.js": 3,
  "art/sway.js": 2,
  "art/tall.js": 1,
  "art/treehouse.js": 5,
  "art/trees.js": 9,
  "art/tufts.js": 1,
  "art/witch.js": 33,
  "art/witchGenome.js": 5,
  "art/workshop.js": 1
};

/** The left-out entry a repo-relative path falls under, or null if it is checked. */
export const leftOut = (file, list = LEFT_OUT) => Object.keys(list).find(p => (p.endsWith("/") ? file.startsWith(p) : file === p)) ?? null;

/** Every diagnostic tsconfig.art.json gives, as { file (repo-relative, or "" for a global one), line, text }. */
export function diagnostics() {
  const configPath = path.join(root, "tsconfig.art.json");
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error) throw Error(ts.flattenDiagnosticMessageText(read.error.messageText, "\n"));
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, root, undefined, configPath);
  const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
  return ts.getPreEmitDiagnostics(program).map(d => {
    const file = d.file ? path.relative(root, d.file.fileName).split(path.sep).join("/") : "";
    const line = d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : 0;
    return { file, line, code: d.code, text: ts.flattenDiagnosticMessageText(d.messageText, "\n") };
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const all = process.argv.includes("--all"), found = diagnostics(), counts = Object.fromEntries(Object.keys(LEFT_OUT).map(p => [p, 0]));
  const failing = [];
  for (const d of found) {
    const p = d.file.startsWith("art/") ? leftOut(d.file) : null;
    if (p) counts[p]++; else failing.push(d);
    if (!p || all) console.log(`${d.file || "(config)"}${d.line ? `:${d.line}` : ""} TS${d.code}: ${d.text}`);
  }
  const outs = Object.entries(counts), clean = outs.filter(([, n]) => n === 0).map(([p]) => p);
  console.log(`\nart type check: ${failing.length} error${failing.length === 1 ? "" : "s"} in checked files; ${outs.length} paths left out, ${outs.reduce((s, [, n]) => s + n, 0)} errors there`);
  for (const [p, n] of outs.sort((a, b) => b[1] - a[1])) console.log(`  left out: ${p} ${n}${n === 0 ? " (clean: take it off LEFT_OUT in tools/checks/art-types.mjs)" : ""}`);
  if (clean.length) console.log(`${clean.length} left-out path${clean.length === 1 ? " is" : "s are"} clean now.`);
  process.exit(failing.length ? 1 : 0);
}
