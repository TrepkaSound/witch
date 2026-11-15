// The link switches as data (Ed, 2026-10-28: "Let's do all the docs work. Reformat prose into data where you can"): every ?name=value
// the game reads from its link is a record of its own, config/link-switches/<name>.json (what it does, its values, its group, since
// when, Ed's decision if any): a file a switch, so two builders adding switches never touch the same file (Ed, 2026-11-15, the
// coordinator's "shared files that don't clash"). The retired ones are config/link-switches/retired/<name>.json, and the page's
// words and the families config/link-switches/_about.json. docs/LINK-SWITCHES.md is written from them. Where each is read is found
// by scanning the code (scanLinkSwitches: params.get/has/getAll("name") on a URLSearchParams, src/**/*.ts but the tests, and the
// root's pages) each time, and written nowhere but the page, so it can't drift: src/linkSwitches.test.ts fails on a switch read
// but not registered or one registered but read nowhere.
//   node tools/config/linkSwitches.mjs           rewrite docs/LINK-SWITCHES.md
//   node tools/config/linkSwitches.mjs --check   say what's out of step (as the test does), change nothing; a stale page alone is
//                                                only noted, and fails at a release (tools/config/strict.mjs)
// A new switch: add its file (name, values, does, group, since). The page is rewritten at each release (node tools/config/regen.mjs):
// a builder needn't commit it.
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { releaseStrict } from "./strict.mjs";
import { join, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
export const REGISTRY = "config/link-switches", DOC = "docs/LINK-SWITCHES.md";
export const GROUPS = {
  run: ["The run", "What the night is: its seed, island, world, opening, sail and her kit."],
  view: ["Looks and their costs", "How the world is drawn, to try values live or to measure."],
  debug: ["Debug and tools", "For the builders, the smoke and bench runs, the repro link and the arenas."],
  compare: ["Compare with the old", "Each brings back how something was before a change, to compare against what replaced it."],
};

// a get/has/getAll("name") on something that is a URLSearchParams: a `...params`/`...searchParams`/`link`, or a fresh one
const READ = /([A-Za-z_$][\w$]*|\))\s*\.(?:get|has|getAll)\(\s*(["'])([^"'\s]+)\2\s*\)/g;
const isParams = (recv, before) => /params$/i.test(recv) || recv === "link" || (recv === ")" && /URLSearchParams\((?:[^()]|\([^()]*\))*$/.test(before.slice(-120)));

/** Every switch the code reads, each with the files reading it (relative to the root, sorted). */
export function scanLinkSwitches(root = ROOT) {
  const out = new Map(), files = [];
  const walk = d => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (/\.ts$/.test(f) && !/\.test\.ts$/.test(f)) files.push(p); } };
  walk(join(root, "src"));
  for (const f of readdirSync(root)) if (/\.html$/.test(f)) files.push(join(root, f));
  for (const f of files) {
    const s = readFileSync(f, "utf8"), rel = relative(root, f).replace(/\\/g, "/");
    for (const m of s.matchAll(READ)) if (isParams(m[1], s.slice(0, m.index))) {
      if (!out.has(m[3])) out.set(m[3], new Set());
      out.get(m[3]).add(rel);
    }
  }
  return new Map([...out].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, [...v].sort()]));
}

const json = p => JSON.parse(readFileSync(p, "utf8"));
const records = dir => readdirSync(dir).filter(f => f.endsWith(".json") && !f.startsWith("_")).sort().map(f => ({ file: f, ...json(join(dir, f)) }));
/** The registry, from its folder: the page's words and the families (_about.json), every switch (a file each, by name) and the
 *  retired ones (retired/). Each record carries its `file`, to check it is named for its switch. */
export function loadRegistry(root = ROOT) {
  const dir = join(root, REGISTRY), { intro, patterns, retiredIntro } = json(join(dir, "_about.json"));
  return { intro, switches: records(dir), patterns, retiredIntro, retired: records(join(dir, "retired")) };
}

/** What's out of step between the registry and the code (empty: none). */
export function linkSwitchProblems(reg, scan) {
  const out = [];
  for (const [name, files] of scan) if (!reg.switches.some(s => s.name === name)) out.push(`${name}: read (${files.join(", ")}) but has no ${REGISTRY}/${name}.json`);
  for (const s of [...reg.switches, ...reg.retired]) if (s.file !== `${s.name}.json`) out.push(`${s.file}: holds the switch ${s.name} (name the file for it)`);
  for (const s of reg.switches) {
    if (!scan.has(s.name)) out.push(`${s.name}: has a file in ${REGISTRY} but nothing reads it (retire it: move its file to ${REGISTRY}/retired, with broughtBack and stays)`);
    if (!GROUPS[s.group]) out.push(`${s.name}: no group ${s.group} (${Object.keys(GROUPS).join(", ")})`);
    for (const k of ["does", "since"]) if (!s[k]) out.push(`${s.name}: no ${k}`);
  }
  for (const r of reg.retired) for (const k of ["values", "broughtBack", "stays"]) if (!r[k]) out.push(`retired/${r.file}: no ${k}`);
  return out;
}

const cell = t => String(t).replace(/\|/g, "\\|");
const code = t => `\`${t}\``;
const shown = s => (s.values.length ? s.values.map(v => code(v === "" ? s.name : `${s.name}=${v}`)).join(" / ") : code(s.name));
const short = f => f.replace(/^src\//, "");

/** docs/LINK-SWITCHES.md, written from the registry and the code's reads (each group's switches by name). */
export function renderLinkSwitches(reg, scan = scanLinkSwitches()) {
  const L = ["# Link switches", "", `<!-- Written by tools/config/linkSwitches.mjs from ${REGISTRY}/: edit those, not this (rewritten at each release: node tools/config/regen.mjs). -->`, "", reg.intro, ""];
  for (const [g, [title, about]] of Object.entries(GROUPS)) {
    const rows = reg.switches.filter(s => s.group === g);
    if (!rows.length) continue;
    L.push(`## ${title}`, "", about, "", "| switch | does | since | read in |", "|---|---|---|---|");
    for (const s of rows) L.push(`| ${cell(shown(s))} | ${cell(s.does + (s.decision ? ` *Decision: ${s.decision}.*` : ""))} | ${cell(s.since)} | ${cell((scan.get(s.name) ?? []).map(short).join(", "))} |`);
    L.push("");
  }
  if (reg.patterns?.length) {
    L.push("## Families", "", "Switches named by a pattern, read where the name is built (the test can't see these).", "", "| switch | does | read in |", "|---|---|---|");
    for (const p of reg.patterns) L.push(`| ${cell(code(`${p.name}=${p.values.join("|")}`))} | ${cell(p.does)} | ${cell(p.readIn.map(short).join(", "))} |`);
    L.push("");
  }
  if (reg.retired?.length) {
    L.push("## Retired", "", reg.retiredIntro, "", "| switch | brought back | what stays |", "|---|---|---|");
    for (const r of reg.retired) L.push(`| ${cell(r.values.length ? r.values.map(v => code(`${r.name}=${v}`)).join(" / ") : code(r.name))} | ${cell(r.broughtBack)} | ${cell(r.stays)} |`);
    L.push("");
  }
  return L.join("\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const reg = loadRegistry(), scan = scanLinkSwitches(), p = linkSwitchProblems(reg, scan);
  for (const l of p) console.log(l);
  if (process.argv.includes("--check")) {
    const stale = readFileSync(join(ROOT, DOC), "utf8").replace(/\r\n/g, "\n") !== renderLinkSwitches(reg, scan), strict = releaseStrict();
    if (stale) console.log(`${DOC} is stale${strict ? ": run node tools/config/linkSwitches.mjs" : " (noted only: the release rewrites it, node tools/config/regen.mjs)"}`);
    process.exitCode = p.length || (stale && strict) ? 1 : 0;
  } else {
    writeFileSync(join(ROOT, DOC), renderLinkSwitches(reg, scan));
    console.log(`wrote ${DOC} (${reg.switches.length} switches)${p.length ? `; ${p.length} problem(s) above` : ""}`);
    process.exitCode = p.length ? 1 : 0;
  }
}
