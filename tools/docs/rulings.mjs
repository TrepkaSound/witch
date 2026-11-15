// The stale-ruling check (Ed, 2026-11-15, on "keep the notes honest automatically": "Do 1-7"): builders read comments and notes as
// the truth about Ed's rulings, and a stale one misleads them (2026-11-13: a header said babies "stay invitable" after Ed, 2026-10-31:
// "No, no baby is invitable"). This collects Ed's dated rulings ("Ed, 2026-10-31: "…"", "(Ed, 2026-11-13 …)", the knob notes'
// `decisions`) from the code's comments, config/knobs, config/decisions, the notes and docs/rules, groups them by topic (the tuning
// knob named beside them, the declaration under the comment), and warns where words look out of date. A warnings list: it never
// fails a build unless asked (--strict). Its checks, surest first:
//   replaced   words a later ruling replaced, listed by hand in docs/rules/replaced.json (add one whenever Ed reverses a rule)
//   number     a tuning knob named with a number or on/off that is not its value in config/tuning.json
//   date       one quote of Ed's given two different dates
//   ref        a docs/rules page's `path#name` that no longer resolves (the file gone; the name, or the JSON's key path, not in it)
//   older      (only with --all: noisy) a passage giving an older ruling on a topic that has a later one worded as a change
// A warning looked at and found right is silenced in tools/docs/rulings-ok.json (its key, and why).
//   node tools/docs/rulings.mjs                  the warnings (exit 0)
//   node tools/docs/rulings.mjs --all            with the noisy `older` list
//   node tools/docs/rulings.mjs --topic <text>   Ed's rulings on a knob, a name or a word, newest first: read it before you brief or build
//   node tools/docs/rulings.mjs --strict         exit 1 if there is a warning (not `older`)
//   node tools/docs/rulings.mjs --json           the same as data
// tools/docs/rulings.test.ts tests the parts; CI prints the warnings on every pull request (check-work), never failing on them.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MONTHS = { Oct: "10", Nov: "11", Dec: "12", Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09" };
const CODE = /\.(ts|js|mjs|cjs)$/;
/** Where rulings are read from. Tests are left out: their words are names of what they assert, and they fail on their own. */
const TREES = [["src", CODE], ["art", CODE], ["tools", CODE], ["config/knobs", /\.json$/], ["config/decisions", /\.json$/], ["docs/notes", /\.md$/], ["docs/rules", /\.md$/]];
const SKIP = /(\.test\.[a-z]+$|\.behaviour\.ts$|\.generated\.|\/generated\/|node_modules|^docs\/notes\/INDEX\.md$|^tools\/docs\/rulings)/;

/** Every file the check reads, as repo paths. */
export function files(root = ROOT) {
  const out = [];
  const walk = (dir, want) => {
    for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${e.name}`;
      if (e.isDirectory()) { if (e.name !== "node_modules") walk(rel, want); }
      else if (want.test(e.name) && !SKIP.test(rel)) out.push(rel);
    }
  };
  for (const [dir, want] of TREES) if (fs.existsSync(path.join(root, dir))) walk(dir, want);
  for (const f of ["CLAUDE.md"]) if (fs.existsSync(path.join(root, f))) out.push(f);
  return out.sort();
}

/** A file's passages: the stretches of words a ruling can sit in. Code: each run of comment lines (and the declaration under it);
 *  a note: each line; JSON: each string, with its key path. Each is { line, text, symbol?, key? }. */
export function passages(rel, text) {
  const out = [];
  if (rel.endsWith(".json")) {
    let data; try { data = JSON.parse(text); } catch { return out; }
    const lineOf = s => { const i = text.indexOf(JSON.stringify(s).slice(1, 40)); return i < 0 ? 1 : text.slice(0, i).split("\n").length; };
    const walk = (v, key) => {
      if (typeof v === "string") { if (v.length > 12) out.push({ line: lineOf(v), text: v, key }); }
      else if (Array.isArray(v)) v.forEach(x => walk(x, key));
      else if (v && typeof v === "object") {
        if (v.by === "Ed" && v.date) { out.push({ line: lineOf(v.quote ?? v.rest ?? v.date), text: `Ed, ${v.date}${v.quote ? `: "${v.quote}"` : ""}${v.rest ? ` (${v.rest})` : ""}`, key }); return; }
        for (const [k, x] of Object.entries(v)) walk(x, key === "knobs" || key === "" ? (key === "knobs" ? k : k) : ["what", "notes", "decisions", "links", "note", "label", "rest"].includes(k) ? key : `${key}.${k}`);
      }
    };
    walk(data, "");
    return out;
  }
  const lines = text.split("\n");
  if (rel.endsWith(".md")) {
    lines.forEach((l, i) => { if (l.trim()) out.push({ line: i + 1, text: l, symbol: /^(?:- )?\*\*(.+?)\*\*/.exec(l)?.[1] }); });
    return out;
  }
  const isComment = l => /^\s*(\/\/|\/\*|\*)/.test(l);
  const decl = l => /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\*?|const|let|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/.exec(l)?.[1]
    ?? /^\s*(?:readonly\s+|private\s+|public\s+|static\s+)*(?!(?:if|for|while|switch|return|case|else|do|try|catch|default|new|await|yield|throw)\b)([A-Za-z_$][\w$]*)\??\s*[:(=]/.exec(l)?.[1];
  for (let i = 0; i < lines.length; i++) {
    if (isComment(lines[i])) {
      const start = i; const buf = [];
      while (i < lines.length && isComment(lines[i])) buf.push(lines[i++].replace(/^\s*(\/\/+|\/\*+|\*+\/?)\s?/, "").replace(/\*\/\s*$/, ""));
      out.push({ line: start + 1, text: buf.join(" "), symbol: i < lines.length ? decl(lines[i]) : undefined });
      i--;
    } else {
      const at = lines[i].search(/\/\/ |\/\*\*? /);
      if (at > 0 && !/https?:$/.test(lines[i].slice(0, at))) out.push({ line: i + 1, text: lines[i].slice(at).replace(/^\/\/ |^\/\*\*? |\*\/\s*$/g, ""), symbol: decl(lines[i]) });
    }
  }
  return out;
}

const iso = (d, m, y = "2026") => `${y}-${MONTHS[m.slice(0, 3)]}-${String(d).padStart(2, "0")}`;
const CITE = /\bEd(?:'s)?,?\s+(?:on\s+|of\s+)?(?:(20\d\d-\d\d-\d\d)|(\d{1,2})\s+(Oct|Nov|Dec|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep)[a-z]*(?:\s+(20\d\d))?)/g;

/** The rulings of Ed's cited in a passage: { date, quote } each (quote "" when only the date is given). The quote is what follows
 *  the date in double quotes before the next citation. */
export function citations(text) {
  const out = [], hits = [...text.matchAll(CITE)];
  hits.forEach((m, n) => {
    const date = m[1] ?? iso(m[2], m[3], m[4]);
    const rest = text.slice(m.index + m[0].length, hits[n + 1]?.index ?? text.length);
    const q = /^([^"“]{0,90})["“]([^"”]{4,}?)["”]/.exec(rest);
    // (another date between this one and the quote: the quote is that date's, "Ed, 2026-11-03, replacing the rule of 2026-10-18, "…"")
    out.push({ date, quote: q && !/20\d\d-\d\d-\d\d/.test(q[1]) ? q[2].trim() : "" });
  });
  return out;
}

const get = (obj, dotted) => dotted.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);
/** The tuning knobs a passage names: backticked dotted paths (or a JSON note's own key) that resolve in config/tuning.json. */
export function knobsIn(p, tuning) {
  const out = new Set();
  if (p.key && get(tuning, p.key) !== undefined) out.add(p.key);
  for (const m of p.text.matchAll(/`([A-Za-z_][\w]*(?:\.[\w]+)+)`/g)) if (get(tuning, m[1]) !== undefined) out.add(m[1]);
  return [...out];
}

/** Knobs named with a value that is not the tuning's: "`invites.range` 33", "`cast.on` false", "`x.y` (20)". A value introduced
 *  as the past ("was 33", "from 33", "5 s then") is not read, and only the value straight after the name is. */
export function wrongNumbers(text, tuning) {
  const out = [];
  for (const m of text.matchAll(/(?<![\w./`-])`?([A-Za-z_][\w]*(?:\.[A-Za-z_][\w]*)+)`?(?: is| =|:| \()? ?(-?\d+(?:\.\d+)?|true|false)(?![\w.]*[\w/%:-]|\.\d)(?! ?(?:m|s|ms|px|m\/s)? ?(?:to|or|and|as|x|×|times|then|before|once|-|–)\b)/g)) {
    const live = get(tuning, m[1]);
    if (typeof live !== "number" && typeof live !== "boolean") continue;
    if (/\b(was|were|from|once|old|before|then|had been|used to be|til|until|when|if|with|under|at|sets?|set to|try|e\.g\.|say|like|of)\s*$/i.test(text.slice(Math.max(0, m.index - 24), m.index).replace(/[`*(]/g, ""))) continue;
    const said = m[2] === "true" ? true : m[2] === "false" ? false : Number(m[2]);
    if (typeof said !== typeof live) continue;
    // an on/off is only read as a claim about the default ("`cast.on` false (the default …"): "with x.on false" describes a state
    if (typeof said === "boolean" && !/\bdefault\b/i.test(text.slice(Math.max(0, m.index - 30), m.index + m[0].length + 30))) continue;
    // a rounded value is right: 5.6 for 5.625
    if (typeof said === "number" && Number(live.toFixed((m[2].split(".")[1] ?? "").length)) === said) continue;
    if (said !== live) out.push({ knob: m[1], said, live });
  }
  return out;
}

/** A later ruling worded as a change to what stood before. */
const CHANGES = /\b(no longer|not any more|instead|rather than|goes|gone|scrap|remove|drop the|get rid|revert|undo|stop|never|no\b|don't|shouldn't|should not|only\b|replace|change|too (?:much|many|fast|slow|big|small|long|short|hard|easy))/i;

const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Reads the repo and returns { rulings, topics, warnings, older }. */
export function check(root = ROOT) {
  const read = f => fs.readFileSync(path.join(root, f), "utf8");
  const tuning = JSON.parse(read("config/tuning.json"));
  const replacedFile = "docs/rules/replaced.json", okFile = "tools/docs/rulings-ok.json";
  const replaced = fs.existsSync(path.join(root, replacedFile)) ? JSON.parse(read(replacedFile)).replaced : [];
  const ok = fs.existsSync(path.join(root, okFile)) ? JSON.parse(read(okFile)).ok : {};
  const rulings = [], warnings = [], topics = new Map(), usedOk = new Set();
  const warn = (kind, file, line, key, message) => {
    const id = `${kind} ${file} ${key}`;
    if (id in ok) usedOk.add(id); else warnings.push({ kind, file, line, id, message });
  };
  const topic = t => { if (!topics.has(t)) topics.set(t, []); return topics.get(t); };

  for (const file of files(root)) {
    const text = read(file), ps = passages(file, text);
    for (const p of ps) {
      // replaced: the hand-kept list of words a later ruling replaced
      for (const r of replaced) {
        if ((r.except ?? []).some(x => file.startsWith(x)) || file.startsWith("docs/rules/")) continue;
        for (const pattern of r.stale) {
          const m = new RegExp(pattern, "i").exec(p.text);
          if (m && !(r.unless && new RegExp(r.unless, "i").test(p.text)))
            warn("replaced", file, p.line, `${r.id} ${norm(m[0]).slice(0, 40)}`, `"${m[0]}" but ${r.ruling} (${r.now})`);
        }
      }
      // number: a knob named with a value that is not the tuning's
      if (!file.startsWith("config/decisions/")) for (const w of wrongNumbers(p.text, tuning))
        warn("number", file, p.line, `${w.knob} ${w.said}`, `\`${w.knob}\` given as ${w.said}; config/tuning.json has ${w.live}`);
      const cites = citations(p.text);
      if (!cites.length) continue;
      const knobs = knobsIn(p, tuning), names = [...knobs.map(k => `knob ${k}`)];
      if (p.symbol && CODE.test(file)) names.push(`${file} ${p.symbol}`);
      for (const c of cites) {
        const r = { ...c, file, line: p.line, text: p.text, topics: names };
        rulings.push(r);
        for (const n of names) topic(n).push(r);
      }
    }
    // ref: a rules page's `path#name` must resolve
    if (file.startsWith("docs/rules/") && file.endsWith(".md")) text.split("\n").forEach((l, i) => {
      for (const m of l.matchAll(/`([\w./-]+\.(?:ts|js|mjs|cjs|json|md))#([^`]+)`/g)) {
        const target = path.join(root, m[1]);
        if (!fs.existsSync(target)) { warn("ref", file, i + 1, m[0], `${m[1]} is gone`); continue; }
        const body = fs.readFileSync(target, "utf8");
        const found = m[1].endsWith(".json") ? (() => { try { return get(JSON.parse(body), m[2]) !== undefined; } catch { return false; } })() || body.includes(m[2]) : body.includes(m[2]);
        if (!found) warn("ref", file, i + 1, m[0], `${m[1]} has no "${m[2]}"`);
      }
    });
  }

  // date: one quote, two dates (a quote of 20 letters or more, so "yes" and "do it" don't collide)
  const byQuote = new Map();
  for (const r of rulings) if (r.quote.length >= 20) { const k = norm(r.quote).slice(0, 60); if (!byQuote.has(k)) byQuote.set(k, []); byQuote.get(k).push(r); }
  for (const [k, list] of byQuote) {
    const dates = [...new Set(list.map(r => r.date))].sort();
    if (dates.length < 2) continue;
    const count = d => list.filter(r => r.date === d).length, first = d => list.find(r => r.date === d);
    const at = first(dates[0]);
    warn("date", at.file, at.line, k.slice(0, 40), `"${list[0].quote.slice(0, 70)}" has ${dates.length} dates: ${dates.map(d => `${d} in ${count(d)} place${count(d) > 1 ? "s" : ""} (${first(d).file}:${first(d).line})`).join(", ")}`);
  }

  // older (noisy, --all): a passage whose newest ruling on a topic is older than the topic's newest, when that one reads as a change
  const older = [];
  for (const [name, list] of topics) {
    const quoted = list.filter(r => r.quote), newest = quoted.sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!newest || !CHANGES.test(newest.quote)) continue;
    const seen = new Set();
    for (const r of list) {
      const here = list.filter(x => x.file === r.file && x.line === r.line).map(x => x.date).sort().pop();
      const k = `${r.file}:${r.line}`;
      if (here >= newest.date || seen.has(k) || r.text.includes(newest.date)) continue;
      seen.add(k);
      older.push({ kind: "older", file: r.file, line: r.line, id: `older ${r.file} ${name}`, message: `${name}: cites Ed, ${here}; newer: Ed, ${newest.date}: "${newest.quote.slice(0, 90)}" (${newest.file}:${newest.line})` });
    }
  }
  const order = { replaced: 0, number: 1, date: 2, ref: 3 };
  warnings.sort((a, b) => order[a.kind] - order[b.kind] || a.file.localeCompare(b.file) || a.line - b.line);
  return { rulings, topics, warnings, older, unusedOk: Object.keys(ok).filter(k => !usedOk.has(k)) };
}

/** Ed's rulings that touch a word, a knob or a name, newest first, each quote once. */
export function about(word, rulings) {
  const w = word.toLowerCase(), seen = new Set();
  return rulings.filter(r => r.quote && (r.quote.toLowerCase().includes(w) || r.topics.some(t => t.toLowerCase().includes(w)) || r.text.toLowerCase().includes(w)))
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter(r => { const k = norm(r.quote).slice(0, 60); if (seen.has(k)) return false; seen.add(k); return true; });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), has = a => args.includes(a);
  const r = check();
  if (has("--topic")) {
    const word = args[args.indexOf("--topic") + 1] ?? "";
    const list = about(word, r.rulings);
    for (const x of list) console.log(`${x.date}  "${x.quote}"\n            ${x.file}:${x.line}${x.topics.length ? `  [${x.topics.join("; ")}]` : ""}`);
    console.log(`\n${list.length} ruling${list.length === 1 ? "" : "s"} of Ed's on "${word}", newest first. The newest wins where two disagree; check the code before trusting either.`);
  } else if (has("--json")) {
    console.log(JSON.stringify({ rulings: r.rulings.length, warnings: r.warnings, older: has("--all") ? r.older : undefined, unusedOk: r.unusedOk }, null, 1));
  } else {
    const print = list => { for (const w of list) console.log(`${w.kind.padEnd(8)} ${w.file}:${w.line}\n         ${w.message}\n         key: ${w.id}`); };
    print(r.warnings);
    if (has("--all")) print(r.older);
    for (const k of r.unusedOk) console.log(`unused   tools/docs/rulings-ok.json: "${k}" matches nothing now; delete it`);
    const n = k => r.warnings.filter(w => w.kind === k).length;
    console.log(`\nrulings: ${r.rulings.length} citations of Ed's read; ${r.warnings.length} warning${r.warnings.length === 1 ? "" : "s"} (replaced ${n("replaced")}, number ${n("number")}, date ${n("date")}, ref ${n("ref")})${has("--all") ? `; older ${r.older.length}` : `; ${r.older.length} more under --all (noisy)`}.`);
    if (r.warnings.length) console.log("Each is a comment or note to read against the code: fix the words, or, if they are right, add the key to tools/docs/rulings-ok.json with why.");
    if (has("--strict") && (r.warnings.length || r.unusedOk.length)) process.exitCode = 1;
  }
}
