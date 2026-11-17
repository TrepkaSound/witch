# Performance sweep, November 2026

<!-- summary: The sweep of the game against five frame-drop patterns (lookups in per-frame loops, per-frame allocations, GPU resources not disposed, draw calls, pooling): what was measured, what was fixed and proven unchanged, and the ranked proposals left. -->

Ed's go, 2026-11-17: Ed shared a list of AI tools and asked for one, `gykim80/andrew_game_perf` (MIT), to be added; the coordinator proposed a sweep of Witch against its frame-drop patterns, and Ed said "yes, start it".
The checklist was read as reference only (`skills/game-perf/references/pattern-*.md`); it was not installed. Patterns used: **1** lookups (`find`, `filter`, `indexOf`, `includes`) inside per-frame loops; **6** allocations per frame; **7** GPU resources removed without `dispose()`; **8** per-object draw calls; **9** create-and-destroy cycles where a pool fits. Skipped: 2 to 5 (React and Zustand: not used here) and 10 (the rules already step at a fixed 1/60 s).

The cloud renderer is SwiftShader, so this compares counts (GPU memory counters, allocations, comparisons), not milliseconds. Branch `claude/perf-sweep`, PR #2118. Base `a5b8c7a`.

## What was fixed (each proven: the bench's "game unchanged" plus its own counter)

| # | Pattern | Where | Before | After |
|---|---|---|---|---|
| 1 | 7, a real leak | `render/chart/seaChart.ts` `set`, `reshape` (via `render/free.ts` `freeGeometries`) | every chart opening left about **+107 geometries and +21 textures** on the pooled chart's renderer, for the life of the page (1018, 1125, 1232, 1343 geometries; 38, 59, 80, 102 textures over four openings) | **flat** from the second opening: 148, 112, 112, 112 geometries; 39, 41, 41, 41 textures; 14 programs throughout |
| 2 | 7, a real leak | `render/view.ts` `setWitch` | her hat-off `SpriteBatch` dropped without `release()` on every look change: its instance buffer, its materials and its entries in the fade lists kept (`oldBareBatchFreed: false` five looks out of five) | released every time (`true` five out of five) |
| 3 | 7, a real leak (rare) | `render/houseRooms.ts` `dispose` | the two floors' geometry, materials and painted textures (made in `makeFloor`) never freed when the rooms view goes (a night on an island whose treehouse has no rooms: `view/lifecycle.ts`) | freed with the rest. **Unmeasured**: no tool reaches that swap; read from the code |

How each is the same game: they free only things nothing draws again. The chart's materials are left alive on purpose, so their programs stay linked between openings, as `reset` says; only their buffers and each island's own heights tile go. All three are in `src/render/`; nothing in the rules changed.

**Proof.** `npm run bench:quick` on the base (`a5b8c7a`) and on the branch, then `bench:compare`: "comparable: the rules runs match on everything but build", "match: same state, same pictures" (exit 0). That build also had the team index below (since reverted), so the branch as it stands is a subset of what was compared. The chart and look counters are from two throwaway probes (headless Chromium, the built game, `renderer.info.memory` after each repeat): the chart opened four times in one page on `chart.html?chart=all`, each opening's islands (all 65 with their land) waited for; her look changed five times in one game (`View.setWitch` with `{ hatOff: true }`, her hat-off batch made each time, each new look waited for until drawn).

Two changes were made, measured and taken back:

- **The combat team index** (pattern 1, `rules/combat/teams.ts` `teamOf`): `teamOf` copies every waiting team into a new array and scans each team's members, once per fighting creature per step and per pack, which looks like fighters x members (up to 128 x 128 in the challenge pack). An id index rebuilt by `stepTeams` (the only writer of the teams) gave the same team. **Measured** in the 128-animal pack (`node tools/bench/ts.mjs pack --steps=600`, under Node's CPU profiler): `teamOf` took about 6 ms in all (600 steps) before and 5 ms after, about 0.01 ms a step, and the pack's fight step was 6.4 to 8.4 ms either way (noise run to run). Scanning 128 ids is cheap; not worth a new module-level cache, so it was reverted.
- `coarseMarchers` (`rules/game.ts`) built two lists a step for her leashed creatures' positions; with them gone the function allocated 9.2 KB a step against 8.9 before (seed 871136, wave 28, sampled), inside the noise, so it was reverted rather than claimed.

What both say: at the sizes the game reaches, the rules' lookups and allocations are not where frames go; the leaks are the clear wins.

## Measured but not fixed

### Leaks (pattern 7)

1. **Her looks' atlases** (`render/assets.ts:353`, `:359`, `:360`). **Measured**: with her look changed five times in one game, the renderer's textures rise by exactly 4 a look (168, 172, 176, 180, 184, 188) even once the look cache is full at 4 looks; geometries are flat. The cache's eviction (`witchLooks.delete(old)` past 4 looks), a same-key replacement, and the hat-off atlas replaced (`this.bare = ...`) drop an atlas (albedo and normal) without freeing it. The likely fix is to push each one onto `this.spent`, which `letGo` already frees once neither her batch nor her hat-off batch draws from it. **Not done**: the online players' batches (`platform/online/otherWitches.ts`) are made from her atlas too, and `letGo` doesn't know about them, so an atlas could be freed while one still draws it. That needs `letGo` to hear of every batch first. A look change is a creator visit or a morning, so this is a few MB each time, not per frame.
2. **Tonight's trees can orphan the island's tree atlas** (`render/assets.ts` `swapTonight`, `render/view/lifecycle.ts` `retype`): the old atlas is freed only if a batch already draws that type. Once a night at most, per swapped type. Unmeasured: `tools/sail/leak.cjs` (15 sails, its forced-GC counters per island) is the check for it; not run in this sweep (an hour or more on the cloud renderer).
3. **The clothes pile's mesh** (`render/houseRooms.ts` `pile`) isn't in `dispose`. Same rare swap as fix 3, one small mesh.

### Allocations a frame (pattern 6)

The rules (`node tools/bench/alloc.mjs`, seed 123, wave 20, 900 steps, 17 creatures): **146 KB a step**, spread thin. The biggest are V8's own iterator results (`next`, 15%) from `for...of` over the combat's Maps and Sets (`stepFights`, `coarseMarchers`, `stepPartyWitches`, `stepPacks`, `stepSpacing`, about 1 to 2.5 KB a step each), then `coarseMarchers` itself (8.7 KB: a record a soundsystem and a leashed creature a step), `buffsOf` (a fresh set of Maps each call, twice a step: about 1.7 KB), `deckOf` (a new deck record with the house's floor rectangles every call, about 2 KB a step and 23 KB a frame in the view), `gatherFloorSigils` and `floorGrid` (about 1.6 KB). The phase 2 audit (`docs/archive/perf-housekeeping-review.md`) put the same total at under 0.2% of a frame; nothing here changes that.

The view (`node tools/bench/viewalloc.cjs 123 20 120`, `MODE=treetop`, unminified build): **4.5 MB a frame** over the first 120 frames after the jump to wave 20, at the house, rising. Mostly a scene that is still settling, not steady play:

- `rebuild` (the forest's scenery rebuild, 300 KB a frame): the scenery rebuild hitches Ed deferred on 2026-11-04 (#1325). Left.
- three.js's `setValueV4fArray` (300 KB): the uniform arrays (lights, fires, glades) are `Vector4` lists, which three.js flattens into its own cached `Float32Array`; the allocation is inside the browser's `uniform4fv`. Nothing to fix in the game.
- The house view's frame (`render/houseRooms.ts` `update` and its `toWorld`, about 480 KB): a new point record per corner per piece per frame (`world`, `fromPlan`, `alongRay`). **Proposal**: out-parameter versions. Not done: the file is over the size limit (832 lines) and the change touches every piece's placement.
- `houseApproachDistance` (`rules/treehouseLook.ts`, 190 KB), `terrainAt`, `areaAt`: numbers boxed through `Math.hypot`, which TurboFan doesn't inline. **Proposal**: `Math.sqrt(dx * dx + dz * dz)`. Not done: it can differ in the last bit, so it isn't strictly the same game in the rules (`terrainAt` and `areaAt` are rules code), and it would need a bench declaration.
- `deckOf` called every frame and step (rules/treehouse.ts): **proposal**: memoize by map and tuning (category **a**). Not done: 58 callers, any of which may write into the record it gets.

### Lookups (pattern 1), still there

Sizes are from the code and config, not measured (the bench's late waves have about 17 creatures; only the 128 pack makes them big). Given the team index's measurement above (0.01 ms a step at 128), expect each of these to be small too; measure before fixing:

1. **The combat world's `leashPoint` and `parked`** (`rules/game.ts` `stepFights`): each scans every witch's placed sigils (and stack) per call, called per active creature per step (`combat/choose.ts`, `combat/step.ts`): about (leashed + happy active, 50 to 200) x placed sigils (tens). **Proposal**: a map built once per step. Not done: a knockout mid-step (`rules/knockout.ts`) pushes onto the same live `placed` list the callbacks read, so a map built at the start of the step could miss it; it must be rebuilt on that push, or built lazily and dropped on it.
2. **`movingGoal`'s `team.order.indexOf`** (`rules/combat/waiting.ts`): per waiting creature per step, team size squared for teams past 20. **Proposal**: an index made with `team.order`, kept as the team index above is.
3. **Spell bodies found by id** (`rules/attacks/engine.ts` `S.bodies.find` per telegraph per step; `render/leash/attackSpells.ts` per spell event and telegraph per frame): tens x tens to hundreds. **Proposal**: a map by id kept beside `S.bodies`, updated wherever bodies are added or pruned.
4. **`drawBond`** (`render/leash/stack.ts`, per frame): `leashPoint` (`stack.includes`, `placed.find`) per leashed id, (stack + placed)^2: about 2.5k to 5k with a party of 50. **Proposal**: walk the stack, then the placed list.
5. Small: `combat/legend.ts` (a happy legend filters every creature each step; test `defended.length` first), `combat/engine.ts` (a zone's `hit.includes` per target), `pack.members.indexOf` (packs of 10 to 40).

### Draw calls (pattern 8)

- **The creatures' marks** (`render/looks.ts` `StateMarks`): pooled sprites, but each with its own cloned material, so each mark is its own draw call: the party's sparkles (about 2 per happy or leashed creature on screen), daze stars, anger marks, drops. With 60 in the party, about 120 extra calls. **Proposal**: draw them through the existing `Instances` (`render/leash/glyphs.ts`, per-instance colour and alpha) or one `Points`, one call a kind. Not done: it changes how they're drawn (sorting and blending against the sprites), so it needs Ed's eye. Unmeasured: the bench doesn't record draw calls.
- **The sea chart's islands**: 65 islands x 3 to 7 meshes, about 200 to 400 calls while the chart is open. **Proposal** (low): instance the sigils, halos, sparkles and rings.
- Already instanced: magic, telegraphs and spell glow (`render/fx/batch.ts`), sigils and glyphs (`Instances`), creatures and trees (`SpriteBatch`), holograms, smoke, fireworks, wisps, swoop trails.

### Pooling (pattern 9)

Nothing found per frame or per event that a pool would help. Pools and fixed buffers are already in place: the marks' sprite pool, the full chart (`takeSeaChart`), `SpriteBatch`'s instance pool, the effects' fixed `Points` and instanced meshes; letters, speech bubbles and emoji are DOM or 2D canvases cached by key (capped at 40 and 24). Two small churns are freed correctly and left: `platform/remoteEquipment.ts` (a mesh a broom-parts change) and `render/houseRooms.ts` (a mesh a lying hat).

## Rejected (looked like a hit, isn't)

- `render/areaWindow.ts` `texData`: a DataTexture per copy never disposed, but three.js copies it with `texSubImage2D` and never makes a GL texture for it.
- `render/ground.ts`'s temporary floor tile: disposed right after its copy. `render/hiz.ts` and `render/post.ts`: targets freed or resized in place. `render/strings.ts` `clear`: materials shared on purpose. `render/view/pops.ts`: only under `?debug=cull`.
- `render/leash/combat.ts` `seen x shots.some`: only in the `lookDemo` debug branch. `render/leash/stones.ts`: only for newly loose sigils. `rules/legends.ts` `hasKin`: every 5 s per legend. Lookups into `HOUSE_ROOMS`, `AREA_TYPES` and the music tables: small fixed arrays, or run on load.

## How to repeat

- Chart: open `chart.html?chart=all`, wait until every island has its land, then `chart.view.dispose()` and `chart.mountChart(...)` again; read `chart.view.chart.renderer.info.memory` after each.
- Looks: in a game, `witch.view.setWitch({ ...genome, probe: n }, { hatOff: true })`, then `view.bareBatch ??= view.makeWitchBatch(true)`, frames until `view.lookDrawn`; read `view.renderer.info.memory`.
- Rules allocations: `node tools/bench/alloc.mjs`; the view's: `npx vite build --minify false --outDir <dir>` then `DIST=<dir> node tools/bench/viewalloc.cjs`.
