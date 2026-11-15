// The release scripts' test merge and CI rule (tools/release; Ed, 2026-11-15: "Do 1-7", item 2, after a release stopped on a
// clash that was found late). Offline: `rel.sh --check` runs against throwaway branches in a temp clone of a temp remote, and
// the CI rule reads check runs from a stand-in `gh`. Here, not in tools/release, because tools/ci's tests are already listed.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parse } from "yaml";

const has = (cmd: string) => spawnSync("bash", ["-c", `command -v ${cmd}`]).status === 0;
const REL = path.resolve("tools/release/rel.sh"), LIB = path.resolve("tools/release/lib.sh");
const env = { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" };
let tmp = "", clone = "";
const git = (cwd: string, ...args: string[]) => {
  const r = spawnSync("git", args, { cwd, env, encoding: "utf8" });
  if (r.status !== 0) throw Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout.trim();
};
const write = (file: string, text: string) => fs.writeFileSync(path.join(clone, file), text);
const check = (...items: string[]) => {
  const r = spawnSync("bash", [REL, "--check", ...items], { env: { ...env, RELEASE_REPO_DIR: clone, RELEASE_WORKDIR: path.join(tmp, "work") }, encoding: "utf8" });
  return { status: r.status, out: r.stdout + r.stderr };
};

describe.skipIf(process.platform === "win32" || !has("git"))("rel.sh --check", () => {
  beforeAll(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "release-check-"));
    const remote = path.join(tmp, "remote.git"); clone = path.join(tmp, "clone");
    git(tmp, "init", "-q", "--bare", "remote.git");
    git(tmp, "clone", "-q", remote, "clone");
    git(clone, "checkout", "-q", "-b", "claude/prototype");
    write("a.txt", "one\ntwo\nthree\n"); write("b.txt", "b\n"); write("c.txt", "c\n");
    git(clone, "add", "."); git(clone, "commit", "-q", "-m", "base");
    // first and second change the same line of a.txt; third is apart; stale changes what prototype then changes
    for (const [branch, file, text] of [["first", "a.txt", "one\nFIRST\nthree\n"], ["second", "a.txt", "one\nSECOND\nthree\n"], ["third", "b.txt", "b\nthird\n"], ["stale", "c.txt", "stale\n"]]) {
      git(clone, "checkout", "-q", "-b", branch, "claude/prototype"); write(file, text); git(clone, "commit", "-q", "-am", branch);
    }
    git(clone, "checkout", "-q", "claude/prototype"); write("c.txt", "prototype\n"); git(clone, "commit", "-q", "-am", "prototype moves on");
    git(clone, "push", "-q", "origin", "claude/prototype", "first", "second", "third", "stale");
  });
  afterAll(() => { if (tmp) fs.rmSync(tmp, { recursive: true, force: true }); });

  it("reports clean when the branches merge in order", () => {
    const r = check("first", "third");
    expect(r.out).toContain("first: clean"); expect(r.out).toContain("third: clean"); expect(r.out).toContain("CLEAN");
    expect(r.status).toBe(0);
  });
  it("names the conflicting files and what each clashes with, and still tries the rest", () => {
    const r = check("first", "second", "third", "stale");
    expect(r.out).toContain("first: clean");
    expect(r.out).toMatch(/second: CONFLICT \(clean on claude\/prototype alone; clashes with first\) in:\n {4}a\.txt/);
    expect(r.out).toContain("third: clean");
    expect(r.out).toMatch(/stale: CONFLICT \(clashes with claude\/prototype itself\) in:\n {4}c\.txt/);
    expect(r.status).toBe(4);
  });
  it("takes them in the order given", () => {
    expect(check("second", "first").out).toMatch(/second: clean\nfirst: CONFLICT \(clean on claude\/prototype alone; clashes with second\)/);
  });
  it("pushes nothing, leaves the checkout alone and takes no lock", () => {
    const before = git(clone, "ls-remote", "origin"), head = git(clone, "rev-parse", "HEAD");
    check("first", "second");
    expect(git(clone, "ls-remote", "origin")).toBe(before);
    expect(git(clone, "rev-parse", "HEAD")).toBe(head);
    expect(git(clone, "status", "--porcelain")).toBe("");
    expect(fs.existsSync(path.join(tmp, "work", "lock"))).toBe(false);
  });
  it("fails on a branch that isn't there", () => {
    const r = check("no-such-branch");
    expect(r.status).toBe(1); expect(r.out).toContain("can't fetch branch no-such-branch");
  });
});

describe.skipIf(process.platform === "win32" || !has("jq"))("the release scripts' CI rule", () => {
  // (a stand-in gh that prints the check runs it is given, one per line, as `gh api --paginate --jq` would)
  const state = (runs: [name: string, status: string, conclusion: string | null][]) => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "release-gh-"));
    try {
      fs.writeFileSync(path.join(dir, "runs"), runs.map(([name, status, conclusion]) => JSON.stringify({ name, status, conclusion })).join("\n") + "\n");
      fs.writeFileSync(path.join(dir, "gh"), `#!/bin/sh\ncat "${dir}/runs"\n`, { mode: 0o755 });
      const r = spawnSync("bash", ["-c", `. "${LIB}"; ci_state abc`], { env: { ...env, PATH: `${dir}:${process.env.PATH}`, RELEASE_WORKDIR: dir }, encoding: "utf8" });
      if (r.status !== 0) throw Error(r.stderr);
      return r.stdout.trim();
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  };
  it("a duplicate run cancelled by a newer one is not a failure; the art check and skipped jobs don't count", () => {
    expect(state([["build", "completed", "cancelled"], ["build", "completed", "success"], ["art check", "completed", "failure"], ["smoke", "completed", "skipped"]])).toBe("");
  });
  it("a job with no passing run is pending or failed, by name", () => {
    expect(state([["build", "completed", "cancelled"], ["unit", "in_progress", null], ["smoke", "completed", "failure"]])).toBe("pending: unit; failed: build=cancelled, smoke=failure");
  });
  it("no check runs yet is not green", () => { expect(state([])).toBe("none yet"); });
});

describe("CI runs of one branch", () => {
  // (a newer push cancels the older run of the same branch or PR; main's run, which deploys, is never cancelled)
  const workflow = (name: string) => parse(fs.readFileSync(`.github/workflows/${name}.yml`, "utf8"));
  it("every workflow has a concurrency group", () => {
    for (const f of fs.readdirSync(".github/workflows").filter(f => f.endsWith(".yml"))) {
      const w = workflow(f.slice(0, -4)), jobs = Object.values(w.jobs) as any[];
      expect(w.concurrency?.group ?? jobs.find(j => j.concurrency)?.concurrency.group, f).toBeTruthy();
    }
  });
  it("CI and the art check cancel the older run of the same ref, but never main's", () => {
    const ci = workflow("ci").concurrency, art = workflow("art-check").concurrency;
    expect(ci.group).toContain("github.ref"); expect(ci["cancel-in-progress"]).toBe("${{ github.ref != 'refs/heads/main' }}");
    expect(art.group).toContain("github.ref"); expect(art["cancel-in-progress"]).toBe(true);
    const publisher = workflow("pages-publish").jobs.publish.concurrency;
    expect(publisher.group).toBe("pages-snapshot-publisher"); expect(publisher["cancel-in-progress"]).toBe(false);
  });
});
