# Docs: what lives where

The game's design is `DESIGN.md` at the top of the repository; how builders work is `CLAUDE.md`. Everything else written about the game is here, and the data behind it is in `data/`.

## Living guides (kept up to date)

| Where | What |
|---|---|
| `HOW-THE-GAME-WORKS.md` | How the game works, for a new reader. |
| `ART-GUIDE.md`, `art-guide/` | How the art is made, with Ed's rulings and reference pictures. |
| `STYLE.md`, `style/` | The look: palette, ramps, scale. |
| `LINK-SWITCHES.md` | Every link switch (generated: `docs/generated-files.md`). |
| `notes/` | One note an area, read before working on it; `notes/INDEX.md` lists them with the glossary. |
| `rules/` | Current-rules pages, where present. |
| `backlog/` | Ideas and proposals, built or not; `backlog/README.md` gives each one's status. |
| `music/` | Music research. |
| `active-builders.md` | Who is building what now (the coordinator keeps it). |
| `generated-files.md` | Every generated file, what makes it and how it is checked. |

## Plans and records

| Where | What |
|---|---|
| `plans/` | Plans for work that is live, paused or only partly done. When a plan's work is finished, move it to `archive/plans/` and add it to that folder's `README.md`. |
| `archive/` | Finished plans (`archive/plans/`) and one-off reports kept for the record; true when written, never updated. `archive/README.md` lists them. |
| `reports/` | Builder reports on one piece of work (test changes, CI speed, audits). |
| `evidence/` | Write-ups of evidence behind a decision (treehouse layouts, panel proofs); the raw files are in `data/house/`. |
| `review/`, `art-review/` | Pictures and notes made for one of Ed's reviews. |
| `roster-design.md`, `roster-census.md` | The creature roster's design review and its census (the census is written by `tools/roster/audit.mjs`, with its data in `data/roster/`). |
| `creature-graph-staging.md` | The body-graph experiment's staging record (paused work). |

## Data

Machine-written measurements, audits and study results are in `data/`, not here: `data/README.md` names each folder's writer and readers. The What's new entries are in `config/changelog/` (`docs/notes/config.md`, **Changelog fragments**).
