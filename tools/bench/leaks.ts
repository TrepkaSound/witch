// The hidden-state leak check (quality plan item d, Ed's go 2026-11-15; docs/notes/module-state.md): the rules must be a pure
// function of (seed, tuning, inputs), so a game's state must not depend on what else ran in the same process. Plays the bench's
// game (tools/bench/rules.ts: off the seat, waves called in with the playtest key, then the fixed path) in four ways and compares
// the fingerprints (tools/bench/fingerprint.ts) step for step:
//   alone        each seed in a fresh process (the reference; run.mjs-style, one child process a seed)
//   after        the seeds back to back in this process
//   interleaved  every seed's game made first, then stepped in turn, one step each (two witches' worth of games side by side)
//   resumed      each seed saved mid-run (rules/nightSnapshot.ts), the save loaded into a fresh game, played on from there
//   mixed        the first seed on another tuning (the difficulty and the fight's scale changed, as a player's settings or the
//                Fight Arena change them) stepped in turn with the others on the shipped one: each against its own alone
//   staggered    as mixed, but the others begun only once the first is fighting its waves (a second game made mid-night: the
//                frame check's, a guest's replica), so their quiet first steps follow its fight steps
//   resumed-other  as resumed, the first seed on the other tuning (a loaded night whose fight speeds aren't the page's start ones)
// Prints one line a mode and exits 1 on any difference.
//   node tools/bench/ts.mjs leaks [--seeds=123,165272] [--wave=6] [--steps=600] [--every=150]
//   (--alone=<seed>: the child process's own mode, one seed played and its prints written)
import { execFileSync } from "node:child_process";
import { newGame, stepGame, STEP, type Controls, type Game } from "../../src/rules/game";
import { restoreGame, snapshotGame } from "../../src/rules/nightSnapshot";
import { TUNING, type Tuning } from "../../src/rules/tuning";
import { fingerprint } from "./fingerprint";

const args = new Map(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, "").split("="); return [k, v ?? "1"]; }));
const seeds = (args.get("seeds") ?? "123,165272").split(",").map(Number);
const wave = Number(args.get("wave") ?? 6), steps = Number(args.get("steps") ?? 600), every = Number(args.get("every") ?? 150);
const idle: Controls = { moveX: 0, moveZ: 0, toggleMode: false, zoom: 0 };
const path = (i: number): Controls => {
  const leg = Math.floor(i / 240) % 6, ang = (leg * Math.PI) / 3;
  return { ...idle, moveX: Math.cos(ang), moveZ: Math.sin(ang), toggleMode: i % 600 === 300, sigil: i % 450 === 200 };
};

/** The other tuning (mixed): harder, and the fight a size larger. */
function variant(): Tuning {
  const t = structuredClone(TUNING);
  t.difficulty = { ...t.difficulty, creatureSpeed: 1.45, adultStrength: 1.6 };
  t.fight = { ...t.fight, scale: t.fight.scale * 1.15, speed: t.fight.speed * 0.9 };
  return t;
}

interface Run { g: Game; phase: "reach" | "path"; k: number; i: number; prints: string[] }
const start = (seed: number, tuning = TUNING): Run => {
  const g = newGame(seed, tuning);
  g.clock.paused = false;
  stepGame(g, { ...idle, moveX: 1 }, STEP);
  return { g, phase: "reach", k: 0, i: 0, prints: [] };
};
/** One step of a run; false once it's done. */
function step(r: Run): boolean {
  const g = r.g;
  if (r.phase === "reach") {
    if (g.party.wave < wave && !g.over && r.k < wave * 181 * 4) { stepGame(g, r.k % 181 === 0 ? { ...idle, nextWave: true } : idle, STEP); r.k++; return true; }
    r.phase = "path";
  }
  if (r.i >= steps) return false;
  stepGame(g, path(r.i), STEP);
  r.i++;
  if (r.i % every === 0) r.prints.push(`${r.i}:${r.k}:${fingerprint(g).all}`);
  return true;
}
const play = (seed: number, tuning = TUNING) => { const r = start(seed, tuning); while (step(r)); return r.prints; };

if (args.has("alone")) { console.log(JSON.stringify(play(Number(args.get("alone")), args.has("variant") ? variant() : TUNING))); process.exit(0); }

const child = (s: number, more: string[] = []) => JSON.parse(execFileSync(process.execPath, [process.argv[1], `--alone=${s}`, `--wave=${wave}`, `--steps=${steps}`, `--every=${every}`, ...more], { encoding: "utf8", maxBuffer: 1 << 26 })) as string[];
let alone = new Map(seeds.map(s => [s, child(s)]));
const same = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
let bad = 0;
const report = (mode: string, got: Map<number, string[]>) => {
  const diffs = seeds.filter(s => !same(got.get(s)!, alone.get(s)!));
  bad += diffs.length;
  console.log(`${mode.padEnd(13)} ${diffs.length ? `DIFFERS for seed ${diffs.join(", ")}` : "same as alone"}${diffs.length ? "" : ` (${seeds.map(s => `${s}: ${alone.get(s)!.at(-1)}`).join("; ")})`}`);
  for (const s of diffs) console.log(`  ${s}: alone ${alone.get(s)!.join(" ")}\n  ${" ".repeat(String(s).length)}  here  ${got.get(s)!.join(" ")}`);
};

// after: back to back, twice round (so each seed follows another)
const after = new Map<number, string[]>();
for (const s of [...seeds, ...seeds]) after.set(s, play(s));
report("after", after);

// interleaved: all made, then stepped one step each in turn
const runs = seeds.map(s => start(s));
for (let live = true; live;) { live = false; for (const r of runs) live = step(r) || live; }
report("interleaved", new Map(seeds.map((s, i) => [s, runs[i].prints])));

// resumed: saved half way along the path (through JSON, as a save slot holds it), loaded into a fresh game, played on
const resumed = new Map<number, string[]>();
for (const s of seeds) {
  const r = start(s);
  while (step(r) && !(r.phase === "path" && r.i === Math.floor(steps / 2)));
  r.g = restoreGame(JSON.parse(JSON.stringify(snapshotGame(r.g))));
  r.g.clock.paused = false; // (a loaded night opens paused, as the page shows it)
  while (step(r));
  resumed.set(s, r.prints);
}
report("resumed", resumed);

// mixed: the first seed on the other tuning, stepped in turn with the rest on the shipped one
alone = new Map(seeds.map((s, i) => [s, i ? alone.get(s)! : child(s, ["--variant"])]));
const mixed = seeds.map((s, i) => start(s, i ? TUNING : variant()));
for (let live = true; live;) { live = false; for (const r of mixed) live = step(r) || live; }
report("mixed", new Map(seeds.map((s, i) => [s, mixed[i].prints])));

// staggered: the first on the other tuning, played into its waves; then the rest begun, and all stepped in turn
const first = start(seeds[0], variant());
while (step(first) && first.phase === "reach");
const rest = seeds.slice(1).map(s => start(s)), all = [first, ...rest];
for (let live = true; live;) { live = false; for (const r of all) live = step(r) || live; }
report("staggered", new Map(seeds.map((s, i) => [s, all[i].prints])));

// resumed-other: as resumed, on the other tuning
const other = start(seeds[0], variant());
while (step(other) && !(other.phase === "path" && other.i === Math.floor(steps / 2)));
other.g = restoreGame(JSON.parse(JSON.stringify(snapshotGame(other.g))));
other.g.clock.paused = false;
while (step(other));
report("resumed-other", new Map(seeds.map((s, i) => [s, i ? alone.get(s)! : other.prints])));
process.exit(bad ? 1 : 0);
