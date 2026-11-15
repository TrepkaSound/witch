import { describe, expect, it } from "vitest";
import { FRAME_CHECK_KEEP, FRAME_CHECK_SCENES, frameCheckFrames, frameCheckHistory, frameCheckHref, frameCheckParams, frameCheckText, keepFrameCheck, spread, type FrameCheckResult } from "./frameCheck";
import { FRAME_CHECK_KEY, MemoryStorage, makeStorageScope } from "../platform/storageScope";

const result = (build: string, date: string, cpu = 3): FrameCheckResult => ({ v: 1, build, date, gpu: "ANGLE (Test GPU)", canvas: "1920x1080 canvas, pixel ratio 1", rung: 0, quality: "full quality, ladder 0", frames: 600, notes: [],
  scenes: [{ id: "decks", label: "party start at the decks", frames: 600, frame: { median: 16.7, p95: 16.8, worst: 33.4 }, cpu: { median: cpu, p95: cpu + 1, worst: 12 }, gpu: null, draws: 212, triangles: 1234567 }] });

describe("the frame check", () => {
  it("sums a list of frame times", () => {
    expect(spread([])).toEqual({ median: 0, p95: 0, worst: 0 });
    const xs = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(spread(xs)).toEqual({ median: 51, p95: 96, worst: 100 });
  });

  it("flies the bench's ground-flight path, frame for frame", () => {
    // (tools/bench/frames.cjs SCENES ground-flight: the numbers line up with the builders' only while this is the same path)
    const bench = (i: number) => ({ moveX: Math.cos(Math.floor(i / 150) * 1.4), moveZ: -Math.abs(Math.sin(Math.floor(i / 150) * 1.4)), toggleMode: false, zoom: 0 });
    const scene = FRAME_CHECK_SCENES.find(s => s.id === "ground-flight")!;
    for (const i of [0, 149, 150, 599]) expect(scene.controls(i)).toEqual(bench(i));
  });

  it("gives the same controls every run, and casts the party spell once at the decks", () => {
    for (const s of FRAME_CHECK_SCENES) for (const i of [0, 30, 60, 599]) expect(s.controls(i)).toEqual(s.controls(i));
    const decks = FRAME_CHECK_SCENES[0];
    expect(Array.from({ length: 600 }, (_, i) => decks.controls(i)).filter(c => c.castParty).length).toBe(1);
  });

  it("reads the link", () => {
    expect(frameCheckFrames(new URLSearchParams(""))).toBeNull();
    expect(frameCheckFrames(new URLSearchParams("framecheck=0"))).toBeNull();
    expect(frameCheckFrames(new URLSearchParams("framecheck=1"))).toBe(600);
    expect(frameCheckFrames(new URLSearchParams("framecheck=quick"))).toBe(30);
    const p = new URLSearchParams("framecheck=1&seed=7");
    frameCheckParams(p);
    expect(p.toString()).toBe("framecheck=1&seed=7&opening=old&creator=0&spell=wait");
    const plain = new URLSearchParams("seed=7");
    frameCheckParams(plain);
    expect(plain.toString()).toBe("seed=7");
  });

  it("links to its own page at her rung, with her slider choices and nothing else of her link", () => {
    const href = frameCheckHref("https://example.test/witch/pr-9/?seed=55&island=fox&d_fog=0.4&debug=1#x", "3");
    expect(href).toBe("https://example.test/witch/pr-9/?framecheck=1&ladder=3&d_fog=0.4");
    expect(frameCheckHref("https://example.test/witch/", "off", true)).toBe("https://example.test/witch/?framecheck=quick&ladder=off");
  });

  it("keeps the last few results, newest first, and writes them as text with the run before", () => {
    const store = new MemoryStorage();
    for (let i = 0; i < FRAME_CHECK_KEEP + 2; i++) keepFrameCheck(store, FRAME_CHECK_KEY, result(`v${i}`, `2026-11-15T10:0${i}:00.000Z`, i));
    const list = frameCheckHistory(store, FRAME_CHECK_KEY);
    expect(list.map(r => r.build)).toEqual(["v6", "v5", "v4", "v3", "v2"]);
    keepFrameCheck(store, FRAME_CHECK_KEY, list[0]); // (the same run twice: kept once)
    expect(frameCheckHistory(store, FRAME_CHECK_KEY).length).toBe(FRAME_CHECK_KEEP);
    store.setItem(FRAME_CHECK_KEY, "not json");
    expect(frameCheckHistory(store, FRAME_CHECK_KEY)).toEqual([]);
    const text = frameCheckText(list[0], list[1]);
    expect(text.split("\n")).toEqual([
      "Frame check v6 · 2026-11-15 10:06 UTC",
      "GPU: ANGLE (Test GPU)",
      "1920x1080 canvas, pixel ratio 1 · rung 0 (full quality, ladder 0) · 600 frames a scene",
      "ms as median / p95 / worst",
      "decks: frame 16.7 / 16.8 / 33.4 · cpu 6.0 / 7.0 / 12.0 · gpu not timed · 212 draws · 1.23M tris",
      "  was (v5): frame 16.7 / 16.8 / 33.4 · cpu 5.0 / 6.0 / 12.0 · gpu not timed · 212 draws · 1.23M tris",
      "previous run: Frame check v5 · 2026-11-15 10:05 UTC · GPU: ANGLE (Test GPU) · 1920x1080 canvas, pixel ratio 1 · rung 0 (full quality, ladder 0) · 600 frames a scene",
    ]);
  });

  it("never writes over her saved game: her settings are read, every write but its own results stays in the page", () => {
    const real = new MemoryStorage();
    real.setItem("witch.settings", "{\"a\":1}"); real.setItem("witch.ladder:GPU", "{\"rung\":4}"); real.setItem("witch.saves.v1", "her saves"); real.setItem("witch.owned", "her things");
    const before = JSON.stringify([...Array(real.length)].map((_, i) => [real.key(i), real.getItem(real.key(i)!)]));
    const scope = makeStorageScope({ search: "?framecheck=1&fresh=1", local: () => real as unknown as Storage, session: () => real as unknown as Storage, idb: () => ({}) as IDBFactory });
    const local = scope.local()!;
    expect(scope.fresh).toBeNull();
    expect(scope.idb()).toBeUndefined();
    expect(local.getItem("witch.settings")).toBe("{\"a\":1}");
    expect(local.getItem("witch.ladder:GPU")).toBe("{\"rung\":4}");
    expect(local.getItem("witch.saves.v1")).toBeNull();
    expect(local.getItem("witch.owned")).toBeNull();
    local.setItem("witch.settings", "changed"); local.setItem("witch.saves.v1", "its own"); local.setItem("witch.ladder:GPU", "{\"rung\":0}");
    scope.session()!.setItem("witch.night", "its own");
    expect(local.getItem("witch.settings")).toBe("changed");
    expect(JSON.stringify([...Array(real.length)].map((_, i) => [real.key(i), real.getItem(real.key(i)!)]))).toBe(before);
    local.setItem(FRAME_CHECK_KEY, "[]");
    expect(real.getItem(FRAME_CHECK_KEY)).toBe("[]");
  });
});
