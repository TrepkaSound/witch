# Module state

<!-- summary: Every module-level mutable binding in src/ (top-level lets, and top-level collections written after load), what each holds and its category; the four that were game state and where they went; the caches whose keys were short; the check against new ones in src/rules/ and the leak harness. -->

Ed's go, 2026-11-15 (item d of the quality plan: "All four please"; the coordinator's proposal: "Hidden-state audit: list the 161 module-level variables and move any game state onto the game object"). The audit was made on 2026-11-16 from `claude/prototype` at release 61.

The rules must be a pure function of (seed, tuning, inputs). Saved nights, replays, a guest catching up (`fixedStep`'s `guestCatchUp`), the bench's "game unchanged", the frame check's second game and tests running several games in one process (`vite.config.ts` has `isolate: false`) all rely on it. A module-level variable that holds game state breaks that quietly: a loaded night, or a second game, reads what the first left.

## The categories

- **a**: a pure cache or memo, keyed by everything it depends on (an object it hangs off, or a key checked on read), or scratch filled before it's read (or reset every step), that can't change results.
- **b**: render, audio, UI or page state, outside the rules (and the online session's per-game tables, keyed by the `Game` itself).
- **c**: configuration set once at load or boot (tuning, link switches, the potion lab's look settings).
- **d**: game state: it changes during play and affects the rules' results. Moved onto the game.
- **e**: test and tool hooks.

Counts (2026-11-16, after the moves): **a** 98, **b** 377, **c** 20, **d** 4, **e** 6 (505 in all). `node tools/checks/moduleState.mjs --list` finds 496 of them (the rest are found by hand: below); the brief's 161 is the top-level `let`s alone (`git grep -n -E '^let ' -- src`), 93 of them in `src/main.ts`, which keeps its page-level state on purpose (`pageHost`).

## Game state found, and where it went (d)

1. **A friendly legend's progress along the route** (`combat/legend.ts`, `friendRoutes`, a `WeakMap` by creature): lost on a reload, so a legend at a crossing of tonight's route could rejoin the wrong leg. Now the creature's own `routeWalk` (`{ key, at, x, z }`, `key` the route's ley key), saved with the night. Older saves: absent, so it rejoins at the nearest point (as every loaded night did before).
2. **The fight's scale and speeds** (`movementData.ts`, `FIGHT`) and **the combat data `land` reads** (`combat/hits.ts`, `D`): page-wide, set from the tuning by each fight step and read by every step, calm ones too. Their value depended on which game in the page last fought, and a loaded night read the page's start values until its next fight. Now every step of a game begins with its own (`rules/fightSettings.ts`, `fightFor`): the page's start values until the game's first fight step, and its tuning's after. That needs one flag on the game, `Game.fightSet`, an additive change to the save format (`src/app/saveFormat.test.ts` `GAME_MIGRATIONS`; `nightSnapshot.ts` `OPTIONAL`). Older saves: absent, read as not yet fought, exactly as they were read before. Measured honestly: the leak harness below couldn't make the old code give a different result on the bench's path (the readers on calm steps don't move anything there), so this one is a fix of the contract, proven by its unit test, not of an observed drift.
3. **The mushroom light test row** (`mushrooms.ts`, `testRows`, a `WeakMap` by mushroom state): picked samples were lost on a reload while the row was switched off. Now the mushroom state's own `testRow`. Older saves: absent, so the row is made afresh.

Tests: `src/rules/moduleState.test.ts` (the route walk through a save, two legends side by side, each game's fight speeds through another game and a save), `src/rules/mushroomTestRow.test.ts` (the row through a save).

## Caches whose keys were short (a, fixed)

- `combat/data.ts` `SCALED`: an attack at the fight's scale, keyed by its name, so a second combat data's attack of the same name (a test's, a tool's, the Fight Arena's) got the first's. Now keyed by the attack object. Note: `attackOf` hands `scaled` an attack `attackNamed` already scaled; the name key turned that into one scaling by chance, so `SOURCE` now maps a scaling back to its source (without it a fight scale other than 1 scaled twice: the harness's other tuning caught it).
- `combat/choose.ts` `FAR`: a creature's own shot reaching as far as its pack's, keyed by name and level, so the first game's fight scale and difficulty (`adultStrength`) stuck for every game after. Now keyed by the spell's spec, the level and the damage, checked against the pack shot it copies.
- `musicScore.ts` riff, motif, phrase, dance phrase and bass root memos: keyed by seed and such, not by the style (or compose def) they're made from, so another night's style with the same seed read the first's. Now per style (`rules/ownedMemo.ts`).
- Left, noted: `islandShape.ts` `outlines` isn't keyed by the tuning (only the chart worker and tools call it, always with the shipped tuning); `combat/data.ts` `MADE` and the made pack attacks are keyed by name (made from the config files alone).

## The check (`node tools/checks/moduleState.mjs`)

A guardrail like the loop and size checks (`docs/notes/guardrails.md`): compared with the change's merge base, a module-level mutable binding in `src/rules/` that the base didn't have fails: a top-level `let`, or a top-level `const` written after load in its own file (`.set`, `.push`, `X[i] =`, `X.f =`, `Object.assign(X, ...)` and the like). A justified one says why on its line or the comment line above: `// module-state: <why>` (a cache keyed by all its inputs, scratch reset each step). In `config/checks.json` (`module-state`), so `which.mjs` lists it for builders, and in CI's check-work job on PRs. Its tests are in `tools/checks/guardrails.test.ts`.
What it can't see: a write through an alias (`const list = spacingList; list.push(...)`) or inside a closure's own state (`ownedMemo`), and a binding exported and written from another file. Those are the "by hand" rows below.

## The leak harness (`node tools/bench/ts.mjs leaks`)

`tools/bench/leaks.ts` plays the bench's game (waves called in, then the fixed path) on two seeds and compares the fingerprints (`tools/bench/fingerprint.ts`) at checkpoints with each seed played alone in its own process: back to back in one process (each seed after the other), interleaved step by step, saved half way and loaded into a fresh game, the first seed on another tuning (harder, the fight 15% larger) interleaved with the other, the same staggered (the second game begun once the first is fighting: the frame check's or a guest's replica), and the other tuning saved and loaded. About a minute. Exits 1 on any difference.
On 2026-11-16, release 61's base and this change both gave "same as alone" in every mode (seeds 123 and 165272; wave 6, 600 path steps). The bench's quick rules fingerprints were unchanged by the change.

## src/rules/

"written": a top-level `const` written after load. "by hand": found by reading, not by the check.

| Where | Binding | Kind | What it holds | Who writes it | Cat. | Note |
| --- | --- | --- | --- | --- | --- | --- |
| `archipelago.ts:84` | `made` | written | each world's archipelago, by `world|kinds` | archipelago(), rememberArchipelago (a worker's) | **a** | kinds are made from the world alone (rosters.ts worldOf) |
| `arena.ts:36` | `ARENA_PRESETS` | written | the Fight Arena's presets; pack ones added | its own module, at load | **c** |  |
| `attackObservation.ts:23` | `observers` | written | an attack observer per combat state (tools' and tests' probes) | observeAttacks | **e** |  |
| `attacks/species.ts:33` | `MADE` | written | each species' attack spec, by species/level/floor | speciesAttack | **a** | config only |
| `attacks/species.ts:67` | `LEGENDS_MADE` | written | each legend's thrown attack, by species and every throw field | legendAttack | **a** |  |
| `bags.ts:24` | `cache` | written | tuning with a bag's changes, by tuning object | bagTuning | **a** |  |
| `bootRing.ts:39` | `cache` | written | the boot ring's path, by map | its own module | **a** |  |
| `broomParts.ts:96` | `cache` | written | tuning with a broom's parts, by tuning object | its own module | **a** |  |
| `buffs.ts:138` | `tuned` | written | tuning with buffs applied, by tuning object | its own module | **a** |  |
| `buffs.ts:165` | `now` | written | each witch's buffs this step, by her spells/invites objects | setBuffs, every step before her step | **a** | step scratch: rewritten every step from the game's state |
| `chains.ts:44` | `pulled` | written | metres each creature was pulled this step | dragWitch; beginChains clears it every step | **a** | step scratch |
| `chains.ts:46` | `hurried` | written | each taut creature's hurry this step | dragWitch; beginChains clears it every step | **a** | step scratch |
| `clear.ts:24` | `INDEX` | written | a map's area index | its own module | **a** |  |
| `clear.ts:36` | `counts` | let | a counting buffer | clearedAreas, filled before read | **a** | scratch |
| `combat/choose.ts:62` | `FAR` | written | a creature's own shot reaching as far as its pack's | attackFor | **a** | **fixed**: was keyed by name/level only, so the first game's fight scale and difficulty stuck; now by spec, level, damage and the pack shot copied |
| `combat/data.ts:76` | `COMBAT` | written | the combat data; its strengths filled in | its own module, at load | **c** |  |
| `combat/data.ts:88` | `TRAITS` | written | each species' traits, by combat data | traitsOf | **a** |  |
| `combat/data.ts:227` | `profiles` | written | each species' combat profile, by data, checked on read | combatProfile | **a** |  |
| `combat/data.ts:256` | `SCALED` | written | each attack at the fight's scale and speed | scaled | **a** | **fixed**: was keyed by name, so another data's attack of that name was handed out; now by the attack object |
| `combat/data.ts:256` | `SOURCE` | written | a scaled attack's source (so it's never scaled twice) | scaled | **a** | new with the fix above; marked |
| `combat/data.ts:276` | `LAST_SCALED` | written | the last scaling of each attack, checked against attack, scale and speed | scaled | **a** |  |
| `combat/data.ts:280` | `MADE` | written | attacks made at run time (pack moves), by name | madeAttack | **a** | made from config only |
| `combat/data.ts:281` | `maker` | let | who makes a made attack asked for by name | setAttackMaker (combat/packs.ts, at load) | **c** |  |
| `combat/hits.ts:15` | `D` | let | the combat data `land` reads | useData: each fight step; now also each game step (fightFor) | **d** | **moved**: put back per game at every step (rules/fightSettings.ts); in a game it is always COMBAT |
| `combat/legend.ts:68` | `routeLines` | written | tonight's friendly route, by game, checked against the ley key | friendlyLegendRoute | **a** |  |
| `combat/strikes.ts:19` | `THROWN` | written | an attack spec's thrown form | its own module | **a** |  |
| `combatSpacing.ts:75` | `radiiData` | let | the spacing data the radii map was made from | radiiOf | **a** |  |
| `combatSpacing.ts:75` | `radiiMap` | let | calibrated radii by species | radiiOf, remade when the data object changes | **a** |  |
| `combatSpacing.ts:93` | `profileCache` | written | motion profiles, by data | its own module | **a** |  |
| `crossing.ts:31` | `BOXES` | written | a line's bounding box | its own module | **a** |  |
| `dancefloor.ts:53` | `library` | let | the floor patterns (art's and generated) | floorPatterns, once | **a** | config only |
| `dancefloor.ts:315` | `arrivals` | written | each island sigil's stroke timing, by sigil | islandTiles | **a** | grid and stroke are constants |
| `dancefloor.ts:336` | `KINDS_OF` | written | pattern kinds, by object | its own module | **a** |  |
| `forest.ts:134` | `groveBuckets` | written | a map's legend groves by cell | its own module | **a** |  |
| `forest.ts:173` | `rimPieces` | written | a map's rim plants | its own module | **a** |  |
| `forest.ts:270` | `decorOdds` | written | a map's decor odds | its own module | **a** |  |
| `forest.ts:371` | `UNIQUES` | written | a map's unique pieces | its own module | **a** |  |
| `forest.ts:372` | `ruinStarts` | written | where each ruin family starts | its own module, at load | **c** |  |
| `game.ts:561` | `held` | let | simulated positions while drawing | interpolated (the view's frame) | **b** | render scratch in a rules file; put back before it returns |
| `game.ts:562` | `carried` | written | shots carried back while drawing | interpolated | **b** | render scratch |
| `game.ts:563` | `carriedAt` | let | their positions | interpolated | **b** | render scratch |
| `guestEffects.ts:7` | `enabled` | written | games taking a guest's hit effects | enableGuestEffects (online session) | **b** | keyed by the Game, so per game; the online session carries its own snapshot (pendingGuestEffects/restoreGuestEffects) |
| `guestEffects.ts:7` | `queued` | written | a guest's hit effects waiting for the next hit boundary, by game | queueGuestEffects; applyGuestEffects empties it | **b** | as above: per game, consumed within the frame |
| `guestEffects.ts:8` | `automatic` | written | auto-hit records for the guest, by game | recordAutomaticHit; takeAutomaticHits empties it | **b** | as above |
| `guestFurniture.ts:28` | `placeholders` | written | a house object's dust-sheeted stand-in | its own module | **a** |  |
| `guestFurniture.ts:28` | `idle` | written | a broom station's idle stand-in | its own module | **a** |  |
| `heightSamples.ts:12` | `preparedHeights` | written | a map's height samples | its own module | **a** |  |
| `homeArea.ts:8` | `CACHE` | written | a map's home area | its own module | **a** |  |
| `houseGuard.ts:25` | `CACHE` | written | a map's house guard posts | its own module | **a** |  |
| `housePlacement.ts:13` | `artLayouts` | let | a house layout's art identity, by config object | houseArtLayout | **a** |  |
| `housePlacement.ts:21` | `activeLayout` | let | whether Ed's house layout is asked for | setEdLayoutActive (a link switch, at boot) | **c** |  |
| `houseRooms.ts:51` | `HOUSE_ROOMS` | written | the house config, Ed's layout applied or not | the same switch | **c** |  |
| `islandShape.ts:17` | `outlines` | written | an island's outline, by its fields and step | islandOutline | **a** | not keyed by the tuning: only the chart worker and tools call it, always with the shipped tuning. Left |
| `lakes.ts:83` | `koiMade` | written | a map's koi ponds, checked against a key | its own module | **a** |  |
| `legendCircle.ts:10` | `REACH` | written | a clearing list's reach | its own module | **a** |  |
| `leypulse.ts:32` | `chainLens` | written | a chain's link lengths, checked against a key | its own module | **a** |  |
| `leyroute.ts:37` | `ROUTES` | written | a map's ley route | leyRoute, rememberRoute (a worker's) | **a** |  |
| `leyroute.ts:222` | `DRAWN_OVER` | written | a map's stone pairs whose drawn link crosses the challenge circle | leyRoute, while planning the route once | **a** | part of the map's one-time making; read only while planning |
| `mapShape.ts:115` | `beaches` | written | a land map's beach, checked against a key | its own module | **a** |  |
| `momentum.ts:26` | `caches` | written | resolved momentum settings, by tuning | its own module | **a** |  |
| `movementData.ts:60` | `FIGHT` | written | the fight's scale and speeds, from the tuning | each fight step (beginStep); now also each game step (fightFor) | **d** | **moved**: each game step begins with its own (rules/fightSettings.ts, `Game.fightSet`); was whatever the page's last fight step left |
| `musicBanger.ts:196` | `AS` | written | a style seen as a banger | its own module | **a** | by style object |
| `musicBanger.ts:206` | `COMP_AS` | written | the same, composed | its own module | **a** | by style object |
| `musicBanger.ts:257` | `HOOKS` | written | a banger's hooks | its own module | **a** | by banger object |
| `musicBanger.ts:324` | `OSTS` | written | a banger's ostinati | its own module | **a** | by banger object |
| `musicBanger.ts:389` | `KITS` | written | a banger's kits | its own module | **a** | by banger object |
| `musicBanger.ts:419` | `BY_SECTION` | written | a style's sections | its own module | **a** | by style object |
| `musicHush.ts:41` | `HUSH_AS` | written | a style hushed | its own module | **a** | by style object |
| `musicScore.ts:407` | `resolvedCache` | written | a style's resolved parts | its own module | **a** | by style object |
| `musicScore.ts:455` | `HAUNT_AS` | written | a style haunted | its own module | **a** | by style object |
| `musicScore.ts:471` | `MEL_AS` | written | a style's melody variants | its own module | **a** | by style object |
| `musicScore.ts:511` | `SUNG_AS` | written | a style's sung variants | its own module | **a** | by style object |
| `musicScore.ts:943` | `lastPhrase` | let | the last phrase asked for, checked against every input | formNoteAt | **a** |  |
| `musicScore.ts:996` | `DANCE_RULES` | written | bass rules made dancey | its own module | **a** | by rule object |
| `musicScore.ts:1007` | `bassMemo` | written | a bass part's line this bar, checked against style and every input | the score | **a** |  |
| `musicSet.ts:231` | `NIGHT_STYLES` | written | a night set's styles | its own module | **a** | by set and style objects |
| `onlineInputSteps.ts:5` | `traces` | written | a guest's frame trace, by game | the online session | **b** | keyed by the Game; online wiring |
| `onlineInputSteps.ts:9` | `samplers` | written | a guest's input sampler, by game | the online session | **b** | as above |
| `onlineInputSteps.ts:10` | `catchUps` | written | a guest's catch-up inputs, by game | the online session | **b** | as above |
| `onlineInputSteps.ts:11` | `waiting` | written | games waiting on a guest | the online session | **b** | as above |
| `party.ts:95` | `zoneCache` | written | the party's zones, checked against its size and map | partyZones | **a** |  |
| `party.ts:164` | `CELLS` | written | a map's cells by distance | its own module | **a** |  |
| `partyGuests.ts:28` | `cache` | written | a map's party spots | its own module | **a** |  |
| `partyGuests.ts:67` | `ROW_OFFSETS` | written | row offsets | its own module, at load | **c** |  |
| `pathGeometry.ts:10` | `prepared` | written | a map's path geometry | its own module | **a** |  |
| `potionSettings.ts:42` | `values` | written | the potion lab's look and sound settings | setPotionSetting (the potion lab panel) | **c** | read by render and audio only |
| `pulseRoute.ts:26` | `lines` | written | a map's pulse lines | its own module | **a** |  |
| `pulseRoute.ts:42` | `lengths` | written | their lengths | its own module | **a** |  |
| `pulseRoute.ts:43` | `routeLinks` | written | a map's route links | its own module | **a** |  |
| `quest.ts:26` | `EARLY` | written | a map's early quest | its own module | **a** |  |
| `random.ts:5` | `RNG_STATES` | written | each seeded stream's cursor reader, by the stream | rng | **a** | what lets a night snapshot save a stream; per stream object |
| `sigilAvoid.ts:31` | `current` | let | this step's floor sigils | setFloorSigils, set and cleared round each step (try/finally) | **a** | step scratch |
| `stumps.ts:46` | `MADE` | written | a map's stump deal and cuts, checked against a key | its own module | **a** |  |
| `terrain.ts:38` | `MARKS` | written | a map's terrain marks | its own module | **a** |  |
| `terrain.ts:114` | `BOWLS` | written | bowls, by land map | its own module | **a** |  |
| `terrain.ts:142` | `LEVELS` | written | levels, by land map | its own module | **a** |  |
| `terrain.ts:186` | `DRAWN` | written | the hills tuning a map was drawn with | its own module | **a** |  |
| `spacing.ts:32-35` | `cap`, `slots`, `radius`, `cellI`, `cellJ`, `slotOf`, `order`, `keyI`, `keyJ`, `used`, `count`, `start`, `fill`, `pushX`, `pushZ` | let | the spacing pass's work buffers | its own pass, filled before read | **a** | scratch |
| `game.ts` | `spacingList` | by hand | the creatures near a witch this step | stepSpacing (emptied first) | **a** | scratch; written through an alias |
| `win.ts` | `PLACES` | by hand | the conga's places | trailPlaces (length set first) | **a** | scratch; written by the callee |
| `musicScore.ts` | `riffCache, motifCache, phraseCache, dancePhraseFor, rootCache` | by hand | riffs, motifs, phrases and bass roots | the score | **a** | **fixed**: keyed by seed etc. but not the style (or compose def), so another night's style with the same seed read the first's; now per style (rules/ownedMemo.ts) |
| `combat/legend.ts` | `friendRoutes` | by hand | each friendly legend's progress along the route, by creature | walkFriendlyRoute | **d** | **moved** onto the creature (`routeWalk`): it was lost on a reload, so a legend at a crossing could rejoin the wrong leg |
| `mushrooms.ts` | `testRows` | by hand | the light test row's samples while it's switched off, by mushroom state | syncMushroomTestRow | **d** | **moved** onto the mushroom state (`testRow`): picked samples were lost on a reload |

## Everywhere else

One row a file: each binding with its line. All outside the rules (render, UI, audio, page wiring), so none can change a game's results, except through the tuning (c).

| File | Bindings | What they hold | Cat. | Note |
| --- | --- | --- | --- | --- |
| `src/app/chartCache.ts` | `opened`:28 `cold`:31 | the chart's IndexedDB handle and whether it's cold | **b** |  |
| `src/app/chartLayout.ts` | `SHOWN`:32 | islands shown on the chart | **b** |  |
| `src/app/chartOutlines.worker.ts` | `queue`:41 `detail`:41 `job`:41 `busy`:41 `warmMade`:42 `warmKept`:42 `queueTraces`:43 `detailTrace`:44 `made`:192 | the chart worker's queue, job and traces | **b** | a worker's own state |
| `src/app/chartPage.ts` | `last`:18 | the chart page's last frame time | **b** |  |
| `src/app/chartWarm.ts` | `running`:40 | the chart warm-up worker | **b** |  |
| `src/app/fightArena.ts` | `fightSpeed`:18 `panel`:27 `night`:27 `timings`:29 `FORM`:33 | the Fight Arena page: its panel, night, speed, form | **b** | a dev page |
| `src/app/frameCheck.ts` | `frameCheckKeys`:189 | the frame check's held keys | **b** |  |
| `src/app/knobs.ts` | `fightBuilt`:20 | the fight knobs as built, read once after ?tuning= | **c** |  |
| `src/app/ladder.ts` | `live`:134 `pagePx`:135 `LOADED`:137 | the load ladder's live rung and page size | **b** |  |
| `src/app/mapPrep.ts` | `prepUsed`:39 `workerMs`:41 `hydrateMs`:42 | how the page's map was made, and its timings (diagnostics) | **b** | reset by useReadyMap each night |
| `src/app/playerSettings.ts` | `BASE`:82 `current`:116 | the player's settings | **c** | applied to a night's tuning when it starts |
| `src/app/recordingHooks.ts` | `recorders`:9 `unavailable`:10 | recorders hooked in, and whether recording is unavailable | **e** |  |
| `src/app/saveSlots.ts` | `browsers`:201 `unavailable`:202 | the save slots' storage view | **b** |  |
| `src/app/shot.ts` | `lastShot`:130 | the last screenshot | **b** |  |
| `src/app/storageFallback.ts` | `wrappers`:4 | storage wrappers | **b** |  |
| `src/app/telephoneSwitch.ts` | `previousUses`:9 | the telephone switch's earlier uses | **c** |  |
| `src/app/timing.ts` | `longTasks`:29 `longTasksLimited`:31 `observing`:32 | long-task observing | **b** |  |
| `src/app/workerJobTrace.ts` | `queued`:7 `indices`:7 `sequence`:8 `workerSequence`:8 | worker job trace sequence numbers | **b** |  |
| `src/app/zooCoasts.ts` | `held`:11 | the zoo's coasts read for this page | **b** |  |
| `src/editor/treehouseEditor.ts` | `history`:7 `selected`:8 `ready`:8 `zoom`:8 `frame`:11 `map`:11 `room`:22 `object`:22 `plan`:22 `camera`:22 `settings`:22 `pendingBakes`:23 `drag`:82 | the treehouse editor page: history, selection, camera, drag | **b** | a dev page |
| `src/main.ts` | `params`:323 `nightStore`:336 `resumeSave`:336 `resumeGame`:336 `zooPanel`:386 `zooLeaving`:387 `bootSeed`:388 `lookNow`:406 `shownLook`:409 `page`:425 `sailing`:437 `morningAhead`:455 `loadTimes`:463 `loan`:467 `dream`:470 `dreamAsleep`:470 `dreamNext`:472 `dreamAfterDive`:475 `view`:477 `onlineFocus`:478 `loading`:482 `input`:491 `autoTalk`:506 `seedEl`:516 `startEl`:518 `startedNights`:519 `viewRevision`:528 `progressFill`:536 `progressLabel`:536 `chartWarmNextCheck`:551 `sound`:573 `returnedUnlocks`:583 `hostedUnlocks`:584 `sharedNightChanging`:586 `sharedNightFrom`:586 `guestAudioGame`:595 `bootArrival`:605 `gestured`:612 `gestureArmed`:614 `creator`:623 `openPrev`:645 `shutButton`:647 `owned`:652 `stillAt`:652 `liftUp`:652 `chartFound`:664 `zooPaused`:667 `zooHeld`:667 `keysTaken`:682 `scopeAt`:684 `bot`:690 `botTag`:690 `botKind`:690 `potionLab`:711 `pauseSliders`:712 `pauseLoading`:712 `musicLabPanel`:715 `musicLabLoading`:715 `menuGone`:719 `pauseBtns`:724 `leaveVisitButton`:725 `houseAtPause`:728 `dressed`:734 `decide`:740 `decideLoading`:740 `endedNights`:746 `lastRecordedInput`:760 `lastInputAt`:760 `nightWriteReported`:761 `autosave`:763 `worldDraw`:804 `displayedTime`:805 `displayedStep`:805 `wakeCard`:807 `landingSnoreAt`:809 `bootAsleep`:811 `ladder`:816 `findsPanel`:848 `spawnWanted`:862 `chartHeld`:881 `chartWasPaused`:881 `lastShedS`:882 `slowAudioLogged`:883 `chartAt`:891 `departing`:897 `firstEver`:902 `backArmed`:908 `sailFail`:910 `frameHouseEvents`:911 `lastObservedFrame`:919 `measuredStep`:920 `measuredDraw`:920 `measuredParts`:921 | the page: its host (pageHost), the night in hand, the view, loading, sailing, dreams, the zoo, the panels | **b** | kept on purpose (the brief): page wiring, listed, not moved |
| `src/platform/audio/dsp.ts` | `gritCurve`:25 | audio: worklets and modules loaded, impulse and sample caches, ids | **b** |  |
| `src/platform/audio/fireworks.ts` | `CRACKLES`:73 | audio: worklets and modules loaded, impulse and sample caches, ids | **b** |  |
| `src/platform/audio/fof/fof.ts` | `meta`:9 `compiled`:65 `compiledModule`:67 `loaded`:68 `ready`:69 `nextId`:104 | audio: worklets and modules loaded, impulse and sample caches, ids | **b** |  |
| `src/platform/audio/musicAhead.ts` | `styleIds`:57 `styleNext`:58 | audio: worklets and modules loaded, impulse and sample caches, ids | **b** |  |
| `src/platform/audio/musicEngine.ts` | `HAUNT_IMPULSES`:81 `SHARED`:111 | audio: worklets and modules loaded, impulse and sample caches, ids | **b** |  |
| `src/platform/audio/tract/tract.ts` | `ready`:5 `loading`:5 `nextId`:45 | audio: worklets and modules loaded, impulse and sample caches, ids | **b** |  |
| `src/platform/audio/voiceFx.ts` | `IMPULSES`:30 `ENVELOPES`:61 `PREPARING`:66 | audio: worklets and modules loaded, impulse and sample caches, ids | **b** |  |
| `src/platform/audio/voiceSamples.ts` | `loading`:15 | audio: worklets and modules loaded, impulse and sample caches, ids | **b** |  |
| `src/platform/caughtError.ts` | `sink`:2 | page wiring: input keys, error and log sinks, storage scope | **b** |  |
| `src/platform/glRenderer.ts` | `names`:5 | page wiring: input keys, error and log sinks, storage scope | **b** |  |
| `src/platform/input.ts` | `gameKeys`:10 `gameKeysAt`:10 | page wiring: input keys, error and log sinks, storage scope | **b** |  |
| `src/platform/online/entry.ts` | `status`:30 `invite`:30 `game`:32 `presentation`:32 `view`:32 `replica`:33 `tick`:33 `sequence`:33 `ready`:33 `paused`:33 `castWanted`:33 `stopped`:33 `guestPresent`:34 `guestIsReady`:34 `prepared`:34 `synchronized`:34 `failure`:34 `loadingStage`:35 `joining`:36 `frameRequest`:36 `loadingProgress`:37 `reportProgress`:37 `loadingMonitors`:38 `loadingLog`:39 `inputBuffer`:46 `input`:153 `cleaned`:154 `last`:173 | the online page: its game and replica, the session's flags, loading progress, input buffer | **b** | page wiring for the online prototype; the game itself is a Game |
| `src/platform/online/otherWitches.ts` | `mounted`:18 `submitted`:19 | page wiring: input keys, error and log sinks, storage scope | **b** |  |
| `src/platform/playtestJournal.ts` | `active`:183 `context`:184 `trail`:185 | page wiring: input keys, error and log sinks, storage scope | **b** |  |
| `src/platform/playtestLog.ts` | `errors`:19 `errorSink`:30 `errorObserver`:31 | page wiring: input keys, error and log sinks, storage scope | **b** |  |
| `src/platform/storageScope.ts` | `current`:149 `cold`:187 | page wiring: input keys, error and log sinks, storage scope | **b** |  |
| `src/render/alarm.ts` | `RING`:30 `GLYPH`:37 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/artCacheStorage.ts` | `opening`:6 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/artWorker.ts` | `drawing`:20 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/assets.ts` | `prewarmed`:48 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/atlas.ts` | `keepPixels`:20 `noPalette`:49 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/attackFeel.ts` | `windups`:24 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/beach.ts` | `fires`:52 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/bubbles.ts` | `pixelCache`:37 `pixelData`:37 `sprites`:70 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/castShadows.ts` | `CAST_SHADOW_UNIFORMS`:14 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/challenge.ts` | `VEIL_K`:199 `BURST`:203 `FIRED`:329 `FLOOR_LIGHT`:356 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/character.ts` | `cache`:20 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/chart/seaChart.ts` | `tmp`:400 `pooled`:894 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/dream.ts` | `FINE`:43 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/fx/system.ts` | `SYSTEMS`:33 `uploadedField`:35 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/gpuLedger.ts` | `labels`:45 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/grass.ts` | `TUFT_KEPT`:126 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/ground.ts` | `DISCO`:1209 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/height.ts` | `HEIGHT_UNIFORMS`:31 `amplitude`:140 `current`:143 `seenQ`:200 `seenG`:200 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/herEffects.ts` | `can`:36 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/hiz.ts` | `HIZ_UNIFORMS`:18 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/houseDecor.ts` | `placedRooms`:104 `placedDecorWorkedOut`:106 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/impact.ts` | `impacts`:15 `pending`:16 `waits`:16 `holdUntil`:16 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/indicator.ts` | `RING`:30 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/invites.ts` | `turnedCache`:62 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/lakeLooks.ts` | `MADE`:29 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/leash/attackLook.ts` | `K`:50 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/leash/attackSpells.ts` | `dresses`:14 `SHAPE`:28 `LIVE`:29 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/leash/blood.ts` | `AT`:20 `NEON`:115 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/leash/buffIcons.ts` | `slots`:101 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/leash/combat.ts` | `dresses`:30 `herLeft`:47 `herLast`:48 `herGame`:48 `coats`:107 `HEAL_AT`:491 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/leash/deckBpm.ts` | `v`:9 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/leash/decksRing.ts` | `decksPeak`:145 `decksBins`:145 `decksLev`:145 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/leash/projection.ts` | `STACKED`:13 `PLACED`:13 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/leash/rainbow.ts` | `sphere`:34 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/leash/sigilFeel.ts` | `RISE`:105 `BURN`:144 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/leash/stones.ts` | `sides`:29 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/legendCarving.ts` | `cache`:18 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/legendLight.ts` | `coat`:7 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/lightPatternUniforms.ts` | `strength`:12 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/lighting.ts` | `LIGHT_UNIFORMS`:16 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/loadingMist.ts` | `noiseTex`:113 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/markers.ts` | `DEALT`:29 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/overlayTilt.ts` | `tilt`:28 `lifted`:28 `cssPerLow`:28 `cssHeight`:28 `shared`:28 `own`:45 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/overrides.ts` | `decoded`:10 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/partyObjects.ts` | `REFS`:18 `WARM`:264 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/potionCaption.ts` | `box`:5 `lastKey`:6 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/retire.ts` | `held`:10 `late`:10 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/rig/rig.ts` | `luts`:328 `discRadii`:329 `spines`:346 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/rig/rigView.ts` | `stiltGears`:24 `faceMetas`:34 `discSets`:180 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/sleepyFace.ts` | `emojiDrawn`:12 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/slices.ts` | `sliceLog`:53 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/soundsystemGen.ts` | `SETS`:24 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/sprites.ts` | `FADE_MATERIALS`:830 `FADE_MESHES`:831 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/stumpWisps.ts` | `RGB`:23 `FILL`:43 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/thoughtCloud.ts` | `CACHE`:19 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/treeNormalDirs.ts` | `held`:30 `treeDirsStatus`:35 `engaged`:38 `worker`:95 `nextId`:96 `asks`:97 `job`:99 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/view.ts` | `DROPPED`:211 `a4PrivateBridges`:1409 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/view/camera.ts` | `SNAP_FWD`:68 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/view/creatures.ts` | `CAM_UP`:53 `STRIDE`:62 `STEP`:62 `RUN`:62 `PER`:93 `ARTS`:93 `LEGEND_KEYS`:93 `RING_OF`:94 `SHADOW_POOL`:95 `LAST_VIEW`:97 `KEYS`:110 `FACE_KEY`:118 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/view/dodgeEchoes.ts` | `views`:9 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/view/frame.ts` | `scopeEdges`:418 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/view/frameUniforms.ts` | `WILD`:29 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/view/home.ts` | `MOTES`:38 `MOTE_POOL`:38 `moteN`:39 `WISP_LIGHTS`:41 `RANK_RGB`:43 `FACES`:286 `FRAME_KEYS`:288 `STAND`:295 `candlesSeen`:398 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/view/lights.ts` | `NEAR_L`:79 `NEAR_D`:79 `spillRgb`:143 `relicRgb`:181 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/view/refraction.ts` | `casts`:8 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/view/reveal.ts` | `STONES`:27 `P`:62 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/view/scenery.ts` | `JITTERS`:19 `FACES`:43 `NEAR`:43 `jobs`:57 `covers`:65 `rimCache`:100 `potionBuild`:158 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/workshopArt.ts` | `memo`:23 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/render/zooInscriptions.ts` | `font`:77 | render state: GPU objects, pools, drawn art and their caches, per-frame scratch | **b** |  |
| `src/test/preppedGame.ts` | `FILE`:15 `PREPS`:16 `MAPS`:16 | test fixtures: map preps and maps, by test file, seed and tuning | **e** | emptied when a new test file asks |
| `src/ui/bagPreview.ts` | `running`:15 `rafId`:16 `last`:16 | UI: open panels, styles added once, animation frames, image caches | **b** |  |
| `src/ui/brushSparkle.ts` | `cssDone`:32 | UI: open panels, styles added once, animation frames, image caches | **b** |  |
| `src/ui/chartOverlay.ts` | `open`:21 `leaving`:23 | UI: open panels, styles added once, animation frames, image caches | **b** |  |
| `src/ui/cornerPanel.ts` | `shown`:5 | UI: open panels, styles added once, animation frames, image caches | **b** |  |
| `src/ui/creator.ts` | `pixelCache`:830 `pools`:837 | UI: open panels, styles added once, animation frames, image caches | **b** |  |
| `src/ui/djBooth.ts` | `cssDone`:49 | UI: open panels, styles added once, animation frames, image caches | **b** |  |
| `src/ui/keyHint.ts` | `capHtml`:151 | UI: open panels, styles added once, animation frames, image caches | **b** |  |
| `src/ui/loadingScreen.js` | `SWEEP`:24 `RATE`:24 `FLASH`:24 `NOVA`:24 `FADE`:24 `GHOST`:24 `FPS`:24 `DEPTH`:24 | the loading screen's look settings | **c** |  |
| `src/ui/pixelUi.ts` | `installed`:69 | UI: open panels, styles added once, animation frames, image caches | **b** |  |
| `src/ui/stationPanel.ts` | `cssDone`:467 | UI: open panels, styles added once, animation frames, image caches | **b** |  |
| `src/ui/studioPanel.ts` | `styled`:108 | UI: open panels, styles added once, animation frames, image caches | **b** |  |
