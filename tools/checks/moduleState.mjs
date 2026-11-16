// No new hidden state in src/rules/: a new module-level mutable binding there fails, unless it says why it may stay.
// (Ed's go 2026-11-15, quality plan item d; docs/notes/module-state.md, docs/notes/guardrails.md.) src/rules/ must stay a pure
// function of (seed, tuning, inputs), so a saved night, a replay, a guest catching up and a second game in the same process all
// give the same result, and a module-level mutable binding is where state hides from the Game object.
//
// Finds every module-level mutable binding in a file: a top-level `let`/`var`, and a top-level `const` whose value is written
// after load in its own file (`X.set/add/delete/clear/push/pop/shift/unshift/splice/sort/fill/copyWithin(...)`, `X[i] =`,
// `X.f =`, `Object.assign(X, ...)`). Compared with the change's merge base (no baseline file): a binding in src/rules/ that the
// base didn't have (by name, in that file or, for a renamed file, its old one; in a new file, anywhere in src/rules/) fails,
// unless its line or the comment line above says `// module-state: <why>` (a cache keyed by all its inputs, scratch reset each
// step, ...).
//   node tools/checks/moduleState.mjs [--base <ref>]   the check
//   node tools/checks/moduleState.mjs --list [dir]      every binding found (default src/), as tab-separated lines
import path from "node:path";
import ts from "typescript";
import { baseOf, filesAt, filesNow, renamesSince } from "./git-base.mjs";

export const MARK = /\/\/\s*module-state:\s*\S/;
export const inScope = p => /\.(ts|tsx|js|mjs)$/.test(p) && !/\.test\.[a-z]+$/.test(p) && !p.endsWith(".d.ts") && !/\.generated\./.test(p);
const RULES = "src/rules/";
const WRITERS = new Set(["set", "add", "delete", "clear", "push", "pop", "shift", "unshift", "splice", "sort", "reverse", "fill", "copyWithin"]);

/** Module-level mutable bindings in one file: [{ name, line, kind: "let" | "written", marked, text }]. */
export function bindingsOf(text, file = "x.ts") {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".js") || file.endsWith(".mjs") ? ts.ScriptKind.JS : ts.ScriptKind.TS);
  const lines = text.split("\n"), lineOf = n => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line;
  const marked = l => MARK.test(lines[l] ?? "") || /^\s*\/\//.test(lines[l - 1] ?? "") && MARK.test(lines[l - 1]);
  const out = [], consts = new Map();
  const names = (b, acc = []) => {
    if (ts.isIdentifier(b)) acc.push(b);
    else for (const e of b.elements ?? []) if (!ts.isOmittedExpression(e)) names(e.name, acc);
    return acc;
  };
  for (const st of sf.statements) {
    if (!ts.isVariableStatement(st)) continue;
    const flags = st.declarationList.flags, isConst = (flags & ts.NodeFlags.Const) !== 0 || (flags & ts.NodeFlags.Using) !== 0;
    for (const d of st.declarationList.declarations) for (const id of names(d.name)) {
      const l = lineOf(id);
      if (!isConst) out.push({ name: id.text, line: l + 1, kind: "let", marked: marked(l), text: lines[l].trim() });
      else consts.set(id.text, l);
    }
  }
  // The consts written after load: a write through the name anywhere in the file (shadowing ignored: rare, and only over-reports).
  const written = new Set();
  const root = e => { while (e && (ts.isPropertyAccessExpression(e) || ts.isElementAccessExpression(e) || ts.isParenthesizedExpression(e) || ts.isNonNullExpression(e) || ts.isAsExpression(e))) { if (ts.isIdentifier(e.expression)) return e.expression.text; e = e.expression; } return null; };
  const visit = n => {
    if (ts.isBinaryExpression(n) && n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment && n.operatorToken.kind <= ts.SyntaxKind.LastAssignment) {
      const r = (ts.isPropertyAccessExpression(n.left) || ts.isElementAccessExpression(n.left)) && root(n.left);
      if (r) written.add(r);
    } else if ((ts.isPrefixUnaryExpression(n) || ts.isPostfixUnaryExpression(n)) && (n.operator === ts.SyntaxKind.PlusPlusToken || n.operator === ts.SyntaxKind.MinusMinusToken)) {
      const r = (ts.isPropertyAccessExpression(n.operand) || ts.isElementAccessExpression(n.operand)) && root(n.operand);
      if (r) written.add(r);
    } else if (ts.isCallExpression(n)) {
      const c = n.expression;
      if (ts.isPropertyAccessExpression(c) && WRITERS.has(c.name.text) && ts.isIdentifier(c.expression)) written.add(c.expression.text);
      if (ts.isPropertyAccessExpression(c) && c.name.text === "assign" && ts.isIdentifier(c.expression) && c.expression.text === "Object" && n.arguments[0] && ts.isIdentifier(n.arguments[0])) written.add(n.arguments[0].text);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  for (const [name, l] of consts) if (written.has(name)) out.push({ name, line: l + 1, kind: "written", marked: marked(l), text: lines[l].trim() });
  return out.sort((a, b) => a.line - b.line);
}

/** The bindings in src/rules/ at head that the base didn't have (and that carry no reason). */
export function newBindings(baseFiles, headFiles, renames = new Map()) {
  const back = new Map([...renames].map(([from, to]) => [to, from]));
  const anywhere = new Set(), byFile = new Map();
  for (const [file, text] of Object.entries(baseFiles)) {
    const names = new Set(bindingsOf(text, file).map(b => b.name));
    byFile.set(file, names);
    for (const n of names) anywhere.add(n);
  }
  const out = [];
  for (const [file, text] of Object.entries(headFiles)) {
    if (!file.startsWith(RULES)) continue;
    const before = byFile.get(back.get(file) ?? file);
    for (const b of bindingsOf(text, file)) if (!b.marked && !(before?.has(b.name) ?? anywhere.has(b.name))) out.push({ file, ...b });
  }
  return out;
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const argv = process.argv.slice(2);
  if (argv.includes("--list")) {
    const dir = argv.find(a => !a.startsWith("--")) ?? "src";
    const files = await filesNow([dir], inScope);
    for (const [file, text] of Object.entries(files).sort()) for (const b of bindingsOf(text, file)) console.log(`${file}:${b.line}\t${b.kind}\t${b.name}\t${b.marked ? "marked" : ""}\t${b.text.slice(0, 140)}`);
    process.exit(0);
  }
  const base = baseOf(argv);
  const found = newBindings(filesAt(base.sha, ["src/rules"], inScope), await filesNow(["src/rules"], inScope), renamesSince(base.sha));
  if (!found.length) { console.log(`module-state: no new module-level mutable binding in ${RULES} since ${base.ref}.`); process.exit(0); }
  console.error(`module-state: ${found.length} new module-level mutable binding${found.length === 1 ? "" : "s"} in ${RULES} since ${base.ref} (merge base ${base.sha.slice(0, 9)}):\n`);
  for (const b of found) console.error(`  ${b.file}:${b.line}  ${b.name} (${b.kind === "let" ? "top-level let" : "top-level const written after load"})`);
  console.error(`\nThe rules must stay a pure function of (seed, tuning, inputs): state that changes during a night belongs on the Game`);
  console.error(`(or its witch, creature, party, map), so it's saved, replayed and per-game. A cache keyed by all its inputs, or scratch`);
  console.error(`reset every step, may stay: say why with \`// module-state: <why>\` on its line or the line above. (docs/notes/module-state.md)`);
  process.exit(1);
}
