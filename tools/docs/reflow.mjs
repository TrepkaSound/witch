// Breaks a note's giant one-line bullets into a sentence a line, changing no words (Ed, 2026-11-15, "Do 1-7", item 1: shared
// files that don't clash): git merges by line, so two builders editing different points of one 6000-character bullet clashed
// every time. A line break inside a paragraph or a list item reads as a space, so the page renders as it did. Only lines over
// 200 characters are touched; each is broken after a sentence's end (and a sentence still over 400 characters after its
// semicolons), never inside `code` or a "quotation" (Ed's words stay whole, to search for), nor before anything Markdown or
// the glossary (tools/docs/glossary.mjs: a bold name opening a line) would read as a new block or entry. Headings, tables,
// fenced code, comments, quotes and the generated tables (tools/docs/tables.mjs) are left alone. Running it twice changes nothing more.
//   node tools/docs/reflow.mjs docs/notes/gameplay.md [more.md ...]   rewrites them
//   node tools/docs/reflow.mjs --check docs/notes/*.md                lists the lines it would break, changes nothing (exit 1 if any)
// A branch that edited a note before it was reflowed: run this on the note there first, then merge; only real clashes are left.
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const LONG = 200, CLAUSE = 400;
const blocky = s => /^(\*\*|[-+*>#|=<]|\d|```|~~~|<!--|\s)/.test(s) || s === "";
/** Where `text` may be broken: after `end` (a regex matching the break's space), outside code and quotations. */
function breaks(text, end) {
  const out = []; let code = false, quote = false, curly = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "`") code = !code; else if (code) continue;
    else if (ch === '"') quote = !quote; else if (ch === "“") curly++; else if (ch === "”") curly = Math.max(0, curly - 1);
    else if (ch === " " && !quote && !curly && end.test(text.slice(Math.max(0, i - 12), i)) && !blocky(text.slice(i + 1)) && text[i + 1] !== " ") out.push(i);
  }
  return out;
}
const cut = (text, at) => { const parts = []; let from = 0; for (const i of at) { parts.push(text.slice(from, i)); from = i + 1; } parts.push(text.slice(from)); return parts; };
const SENTENCE = /(?<!\b(?:e\.g|i\.e|vs|cf|etc|c|approx|[A-Z]))[.?!][)\]"”'*_]*$/, SEMI = /;[)\]"”'*_]*$/;

/** One line, broken (or itself, when short or not prose). `indent` is what its continuation lines start with. */
export function reflowLine(line) {
  if (line.length <= LONG) return [line];
  const m = /^(\s*)((?:[-+*]|\d+[.)])\s+)?(.*)$/.exec(line), [, lead, marker = "", text] = m;
  if (/^(#|\||>|<!--|```|~~~)/.test(text) || (!marker && lead.length >= 4 && false)) return [line];
  const indent = lead + " ".repeat(marker.length);
  const parts = cut(text, breaks(text, SENTENCE)).flatMap(s => (s.length > CLAUSE ? cut(s, breaks(s, SEMI)) : [s]));
  return parts.map((p, i) => (i ? indent : lead + marker) + p);
}

export function reflow(source) {
  const out = []; let fence = false, data = false, comment = false;
  for (const line of source.split("\n")) {
    const t = line.trim();
    if (/^(```|~~~)/.test(t)) fence = !fence;
    if (/^<!-- data: /.test(t)) data = true; if (/^<!-- \/data: /.test(t)) { data = false; out.push(line); continue; }
    if (!fence && !data && /^<!--/.test(t) && !/-->/.test(t)) comment = true;
    if (fence || data || comment || /^(```|~~~)/.test(t)) { out.push(line); if (comment && /-->/.test(t)) comment = false; continue; }
    out.push(...reflowLine(line));
  }
  return out.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), check = args.includes("--check"); let stale = 0;
  for (const file of args.filter(a => a !== "--check")) {
    const was = fs.readFileSync(file, "utf8"), now = reflow(was.replace(/\r\n/g, "\n"));
    if (now.replace(/\s+/g, " ") !== was.replace(/\s+/g, " ")) throw Error(`${file}: the words would change`);
    if (now === was.replace(/\r\n/g, "\n")) continue;
    if (check) { stale++; console.log(`${file}: has lines to break (node tools/docs/reflow.mjs ${file})`); } else { fs.writeFileSync(file, now); console.log(`reflowed ${file}`); }
  }
  if (check && stale) process.exitCode = 1;
}
