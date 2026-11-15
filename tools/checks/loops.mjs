// No new import loops in src/ (guardrails, Ed's go 2026-11-15; docs/notes/guardrails.md). Reads the value imports between src/
// files (not `import type`, not dynamic import()), finds their loops (strongly connected groups), and compares the change with
// its merge base: it fails if the change adds an import edge inside a loop that the base didn't have (a new loop, or a worse
// tangle). Today's loops are allowed and removing imports always passes; no baseline file. A rare, reviewed exception: a commit
// trailer `Loops-ok: <importing file> <why>`. --list prints today's groups.
//   node tools/checks/loops.mjs [--base <ref>] [--list] [--json]
import path from "node:path";
import ts from "typescript";
import { baseOf, filesAt, filesNow, renamesSince, trailers } from "./git-base.mjs";

const CODE = /\.(ts|tsx|js|mjs)$/;
export const inScope = p => p.startsWith("src/") && CODE.test(p) && !/\.test\.[a-z]+$/.test(p) && !p.endsWith(".d.ts");

/** The relative value-import specifiers of one file: static imports and re-exports that bring a value (or run the module). */
export function valueImports(text, file = "x.ts") {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, false, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out = [];
  for (const st of sf.statements) {
    if (ts.isImportDeclaration(st)) {
      const c = st.importClause;
      if (c?.isTypeOnly) continue;
      const nb = c?.namedBindings;
      const onlyTypes = c && !c.name && nb && ts.isNamedImports(nb) && nb.elements.length > 0 && nb.elements.every(e => e.isTypeOnly);
      if (!onlyTypes) out.push(st.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(st) && st.moduleSpecifier) {
      if (st.isTypeOnly) continue;
      const ec = st.exportClause;
      if (ec && ts.isNamedExports(ec) && ec.elements.length > 0 && ec.elements.every(e => e.isTypeOnly)) continue;
      out.push(st.moduleSpecifier.text);
    }
  }
  return out.filter(s => s.startsWith("."));
}

/** A specifier from `from` to a file in `files`, as the bundler would find it, or null. */
export function resolve(from, spec, files) {
  const bare = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec.replace(/\?.*$/, "")));
  const tries = [bare, `${bare}.ts`, `${bare}.tsx`, `${bare}.js`, `${bare}.mjs`, `${bare}/index.ts`, bare.replace(/\.js$/, ".ts")];
  return tries.find(t => t in files && inScope(t)) ?? null;
}

/** The import graph: Map(file → Set(file)). */
export function graphOf(files) {
  const g = new Map();
  for (const [f, text] of Object.entries(files)) {
    const to = new Set();
    for (const s of valueImports(text, f)) { const t = resolve(f, s, files); if (t) to.add(t); }
    g.set(f, to);
  }
  return g;
}

/** Strongly connected groups (Tarjan, iterative); only loops: groups of two or more, or a file importing itself. */
export function loopsOf(g) {
  let index = 0;
  const idx = new Map(), low = new Map(), on = new Set(), stack = [], groups = [];
  for (const root of g.keys()) {
    if (idx.has(root)) continue;
    const work = [[root, [...(g.get(root) ?? [])], 0]];
    idx.set(root, index); low.set(root, index); index++; stack.push(root); on.add(root);
    while (work.length) {
      const top = work[work.length - 1], [v, next] = top;
      if (top[2] < next.length) {
        const w = next[top[2]++];
        if (!g.has(w)) continue;
        if (!idx.has(w)) { idx.set(w, index); low.set(w, index); index++; stack.push(w); on.add(w); work.push([w, [...g.get(w)], 0]); }
        else if (on.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
      } else {
        work.pop();
        if (work.length) { const u = work[work.length - 1][0]; low.set(u, Math.min(low.get(u), low.get(v))); }
        if (low.get(v) === idx.get(v)) {
          const grp = [];
          let w;
          do { w = stack.pop(); on.delete(w); grp.push(w); } while (w !== v);
          if (grp.length > 1 || g.get(v)?.has(v)) groups.push(grp.sort());
        }
      }
    }
  }
  return groups.sort((a, b) => b.length - a.length);
}

/** The shortest import path from `a` to `b` inside one group (breadth first), as a list of files. */
export function pathIn(g, inGrp, a, b) {
  const prev = new Map([[a, null]]), queue = [a];
  while (queue.length) {
    const v = queue.shift();
    if (v === b) break;
    for (const w of g.get(v) ?? []) if (inGrp.has(w) && !prev.has(w)) { prev.set(w, v); queue.push(w); }
  }
  const out = [];
  for (let v = b; v != null; v = prev.get(v)) out.unshift(v);
  return out;
}

/** The edges inside loops at head that the base didn't have (base paths renamed to head's), less the excused ones. */
export function newLoopEdges(baseG, headG, renames = new Map(), excused = []) {
  const name = p => renames.get(p) ?? p;
  const had = new Set();
  for (const [f, to] of baseG) for (const t of to) had.add(`${name(f)}\0${name(t)}`);
  const found = [];
  for (const grp of loopsOf(headG)) {
    const inGrp = new Set(grp);
    for (const f of grp) for (const t of headG.get(f)) {
      if (!inGrp.has(t) || had.has(`${f}\0${t}`)) continue;
      found.push({ from: f, to: t, group: grp, path: pathIn(headG, inGrp, t, f), excused: excused.includes(f) });
    }
  }
  return found;
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const argv = process.argv.slice(2);
  const headG = graphOf(await filesNow(["src"], inScope));
  const groups = loopsOf(headG);
  if (argv.includes("--list")) {
    const json = argv.includes("--json");
    if (json) console.log(JSON.stringify(groups, null, 2));
    else for (const [i, g] of groups.entries()) console.log(`group ${i + 1} (${g.length} files):\n  ${g.join("\n  ")}`);
    if (!json) console.log(`\n${groups.length} import loop groups in src/ (value imports).`);
    process.exit(0);
  }
  const base = baseOf(argv);
  const baseG = graphOf(filesAt(base.sha, ["src"], inScope));
  const excused = trailers(base.sha, "Loops-ok").map(v => v.split(/\s+/)[0]);
  const found = newLoopEdges(baseG, headG, renamesSince(base.sha), excused);
  const bad = found.filter(e => !e.excused);
  for (const e of found.filter(e => e.excused)) console.log(`loops: excused by a Loops-ok trailer: ${e.from} -> ${e.to}`);
  if (!bad.length) { console.log(`loops: no new import edges inside loops since ${base.ref} (${groups.length} groups today).`); process.exit(0); }
  console.error(`loops: ${bad.length} new import edge${bad.length === 1 ? "" : "s"} inside an import loop since ${base.ref} (merge base ${base.sha.slice(0, 9)}):`);
  for (const e of bad) {
    console.error(`\n  NEW EDGE  ${e.from}  ->  ${e.to}`);
    console.error(`  the loop it closes: ${[e.from, ...e.path].join(" -> ")}`);
    console.error(`  in a group of ${e.group.length} files: ${e.group.length <= 12 ? e.group.join(", ") : e.group.slice(0, 12).join(", ") + ", ..."}`);
  }
  console.error(`\nFix: import from a file outside the loop, move the shared piece into its own file that imports neither side, or use`);
  console.error(`\`import type\` if only types are needed. A rare, reviewed exception: a commit trailer \`Loops-ok: <importing file> <why>\`.`);
  console.error(`(docs/notes/guardrails.md)`);
  process.exit(1);
}
