// The size ratchet (guardrails, Ed's go 2026-11-15; docs/notes/guardrails.md): big files and functions in src/ may shrink but
// not grow. Compared with the change's merge base (no baseline file): a file (not a test, not generated) over 800 lines fails if
// it has more lines than at the base, and a top-level function, or a method of a top-level class, over 150 lines likewise; a new
// file or function over the limit fails. Renamed files are followed, and a function moved to another file keeps its size.
// A rare, reviewed exception: a commit trailer `Size-ok: <file> <why>` (a file, or `<file>#<function>` for one function).
// --list prints everything over the limits today.
//   node tools/checks/size.mjs [--base <ref>] [--list]
import path from "node:path";
import ts from "typescript";
import { baseOf, filesAt, filesNow, renamesSince, trailers } from "./git-base.mjs";

export const FILE_LIMIT = 800, FUNCTION_LIMIT = 150;
export const inScope = p => p.startsWith("src/") && /\.(ts|tsx|js|mjs|cjs)$/.test(p) && !/\.test\.[a-z]+$/.test(p)
  && !p.endsWith(".d.ts") && !/\.generated\./.test(p);

export const lineCount = text => (text.length === 0 ? 0 : text.split("\n").length - (text.endsWith("\n") ? 1 : 0));

/** Top-level functions (declarations, and consts holding a function) and top-level classes' methods: Map(name → lines). */
export function functionsOf(text, file = "x.ts") {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out = new Map(), lines = n => sf.getLineAndCharacterOfPosition(n.getEnd()).line - sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const unwrap = e => { while (e && (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isSatisfiesExpression(e))) e = e.expression; return e; };
  const isFn = e => e && (ts.isArrowFunction(e) || ts.isFunctionExpression(e));
  const add = (name, n) => out.set(out.has(name) ? `${name}@${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}` : name, lines(n));
  for (const st of sf.statements) {
    if (ts.isFunctionDeclaration(st) && st.body) add(st.name?.text ?? "default", st);
    else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) if (ts.isIdentifier(d.name) && isFn(unwrap(d.initializer))) add(d.name.text, d);
    } else if (ts.isClassDeclaration(st)) {
      const cls = st.name?.text ?? "default";
      for (const m of st.members) {
        const name = m.name && (ts.isIdentifier(m.name) || ts.isPrivateIdentifier(m.name) || ts.isStringLiteral(m.name)) ? m.name.text : ts.isConstructorDeclaration(m) ? "constructor" : null;
        if (!name) continue;
        if ((ts.isMethodDeclaration(m) || ts.isConstructorDeclaration(m) || ts.isGetAccessor(m) || ts.isSetAccessor(m)) && m.body) add(`${cls}.${name}`, m);
        else if (ts.isPropertyDeclaration(m) && isFn(unwrap(m.initializer))) add(`${cls}.${name}`, m);
      }
    }
  }
  return out;
}

/** What's over the limits in a set of files: [{ file, fn?, lines }]. */
export function overLimits(files) {
  const out = [];
  for (const [file, text] of Object.entries(files)) {
    const n = lineCount(text);
    if (n > FILE_LIMIT) out.push({ file, lines: n });
    for (const [fn, lines] of functionsOf(text, file)) if (lines > FUNCTION_LIMIT) out.push({ file, fn, lines });
  }
  return out.sort((a, b) => b.lines - a.lines);
}

/** The growth past the limits from base to head: [{ file, fn?, was, now, excused }]. */
export function grown(baseFiles, headFiles, renames = new Map(), excused = []) {
  const back = new Map([...renames].map(([from, to]) => [to, from]));
  const ok = key => excused.includes(key);
  // A function moved to another file (a split) keeps its size: matched by name anywhere in the base (the largest, if several).
  const anywhere = new Map();
  for (const [file, text] of Object.entries(baseFiles)) for (const [fn, lines] of functionsOf(text, file)) anywhere.set(fn, Math.max(lines, anywhere.get(fn) ?? 0));
  const out = [];
  for (const [file, text] of Object.entries(headFiles)) {
    const was = baseFiles[back.get(file) ?? file];
    const now = lineCount(text), before = was == null ? 0 : lineCount(was);
    if (now > FILE_LIMIT && now > before) out.push({ file, was: before, now, excused: ok(file) });
    const fnsBefore = was == null ? new Map() : functionsOf(was, file);
    for (const [fn, lines] of functionsOf(text, file)) {
      const b = fnsBefore.get(fn) ?? anywhere.get(fn) ?? 0;
      if (lines > FUNCTION_LIMIT && lines > b) out.push({ file, fn, was: b, now: lines, excused: ok(file) || ok(`${file}#${fn}`) });
    }
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const argv = process.argv.slice(2);
  const head = await filesNow(["src"], inScope);
  if (argv.includes("--list")) {
    for (const o of overLimits(head)) console.log(`${String(o.lines).padStart(5)}  ${o.fn ? `${o.file}#${o.fn}` : o.file}`);
    process.exit(0);
  }
  const base = baseOf(argv);
  const excused = trailers(base.sha, "Size-ok").map(v => v.split(/\s+/)[0]);
  const found = grown(filesAt(base.sha, ["src"], inScope), head, renamesSince(base.sha), excused);
  const name = o => (o.fn ? `${o.file}#${o.fn} (function)` : o.file);
  for (const o of found.filter(o => o.excused)) console.log(`size: excused by a Size-ok trailer: ${name(o)} ${o.was} -> ${o.now} lines`);
  const bad = found.filter(o => !o.excused);
  if (!bad.length) { console.log(`size: nothing over the limits grew since ${base.ref} (files ${FILE_LIMIT} lines, functions ${FUNCTION_LIMIT}).`); process.exit(0); }
  console.error(`size: ${bad.length} file${bad.length === 1 ? "" : "s"} or function${bad.length === 1 ? "" : "s"} over the limit grew since ${base.ref} (merge base ${base.sha.slice(0, 9)}):\n`);
  for (const o of bad) console.error(`  ${name(o)}: ${o.was ? `${o.was} -> ${o.now} lines` : `new, ${o.now} lines`} (limit ${o.fn ? FUNCTION_LIMIT : FILE_LIMIT}; over the limit it may shrink but not grow)`);
  console.error(`\nFix: put the new code in a new or smaller file or function and call it from here; or take out as many lines as you add.`);
  console.error(`A rare, reviewed exception: a commit trailer \`Size-ok: <file>[#<function>] <why>\`. (docs/notes/guardrails.md)`);
  process.exit(1);
}
