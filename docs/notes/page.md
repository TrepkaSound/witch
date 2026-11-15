# The page

<!-- summary: How the game's page is put together: src/main.ts's start-up and wiring, the src/app/page*.ts modules by job, and the page's host (pageHost) they share. -->

Part of Witch's notes (`docs/notes/INDEX.md` is the index). Add to this file when you change how the page is put together.

## Layout (the finished main.ts split, #2085, 2026-11-15)

`src/main.ts` is the page's start-up and top-level wiring: the link read, a saved night restored, the boot's night made, the view,
input, sound and freeze made, and the page's pieces wired in order. Its state (the night's look, the loan, what's open, the frame
loop's measures) lives there as top-level `let`s and `const`s.

The behaviour lives in `src/app/`, one module a job. Each function takes the page's host (`pageHost`, below) first, or only the
pieces it reads:

| File | Its job |
|---|---|
| `pageNight.ts` | A night's way in and out: the first wake-up, the arrival after a sail, the sea chart and sailing, the bed's next night, the bot game, starting play. |
| `pageFinds.ts` | Tonight's find: the loan and its settling, her dream of it, her guidance pin, the finds' keepers (`findsCtx`), spawning a find near her. |
| `pageStations.ts` | The treehouse's stations and the creator: what E at a house object does (`useHouse`), the station panels', DJ booth's and telescope's hooks (`wireStations`, `wireDjBooth`, `wireTelescope`, `wireCreator`). |
| `pagePause.ts` | The pause page: the freeze's hooks (`installFreezeHooks`), its corner buttons, the Potion and Music Labs, the written comment and its restore, the Report's host, the audio watchdog. |
| `pageVisit.ts` | Calls and visits: the telephone station's session hooks (`makeTelephone`) and the ordinary visit's lifecycle (`makeOrdinaryVisit`). |
| `pageDebug.ts` | Debug and the tools: what the playtest log's samples read (`installPlaytestLog`), the overlay's buttons, the decisions panel, the repro text, the output meter's silence log, `window.witch` (`installConsoleHooks`). |
| `pageFrame.ts` | The frame loop: each frame's step, the house's menus, the sound and the overlay. |
| `frameDraw.ts` | One frame drawn and measured (the frame loop's and the bed's next night's). |

**Imports run one way** (no loops; the guardrails' import-loop check): `pageFinds` and `frameDraw` ← `pageNight` ←
`pageStations` ← `pageVisit`; `pageDebug` takes `pageNight` and `pageFinds`; `pageFrame` takes all but `pageVisit`; `pagePause`,
`pageFinds` and `frameDraw` import none of them; only `main.ts` imports `pageVisit` and `pageFrame`. A module that needs a function from one above it
gets it through `pageHost` or a callback, never by importing back.

**Order.** `main.ts` calls the wiring where its earliest eager read is declared; the hooks only assign callbacks, so nothing runs
earlier or later than it did. Where order matters it says so: the build notice's `visibilitychange` listener before the
autosave's; `installConsoleHooks` makes `window.witch` first and wraps its hooks last.

## The page's host (`pageHost`)

`pageHost` (in `main.ts`; its type `PageHost` is `typeof pageHost`) is one object of getters and setters onto `main.ts`'s state,
so the modules read it live (a night swapped in place is seen at once). What's left, and why:

- **About 150 members**, all read by some module. They are the page's state (`loan`, `lookNow`, `sailing`, `chartAt`...), its
  pieces (`view`, `input`, `sound`, `freeze`, `phone`, `stations`...) and `main.ts`'s own helpers (`showLook`, `wearHat`,
  `mutate`, `captureRecording`).
- **Why not narrower everywhere:** most functions read and write several pieces of the page's state at once, and the state is
  `main.ts`'s `let`s (made in order through the boot's `await`s). Giving each its own narrow inputs means moving that state into an
  object of its own first: a redesign, not this split.
- **Narrowed so far:** `partsNow(loan)`, `herHead(view, canvas, game)`, `keepNightie(assets, look)`, `traceVisit(preparation, ...)`,
  `nearestStall(stalls, at)`, `makeRepro({ night, built, build, view, canvas, overlay })`.
- **Next, if wanted:** the state as one typed object (a `PageState` interface) that `main.ts` fills as the boot goes, in place of
  the getters; then the modules can take the parts they need.
