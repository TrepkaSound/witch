# Data

Machine-written measurements, audits and study results, moved out of `docs/` on 2026-11-15 (Ed, 2026-11-15: "All four please", on the coordinator's docs tidy: "move the bulk data out of the docs"). None of it is read by the game at runtime or by the build. Each file is a snapshot of a named revision, seed or run: keep it, but don't regenerate it as a freshness check (`docs/generated-files.md`). The notes that explain each result stay in `docs/notes/` and link here.

| Folder | What it holds | Written by | Read by | Explained in |
|---|---|---|---|---|
| `art-cache-fingerprints/` | The per-kind art fingerprint map and its historical replay | `tools/art-cache/map.mjs`, `tools/art-cache/history.mjs` (output path given on the command line) | Readers only | its `README.md`; `docs/archive/plans/art-cache-fingerprints.md` |
| `attack-audit/` | Attack audit runs (`stage1*`, `observer-*`, `shelter-1`, …) and the census proposal's cases | `tools/attacks/audit.mjs --out data/attack-audit/<run>`, `tools/attacks/census-proposal.mjs` | `tools/attacks/audit-report.mjs` (reads `stage1b/species.json`) | each run's `README.md`; `docs/plans/attack-system-audit.md` |
| `balance/runs/` | Balance survey runs (JSONL plus their summaries) | `tools/balance/report.mjs` (`runs`, `stuns`, `report --out`) | Readers only | `docs/notes/balance-baselines.md`, `docs/notes/balance-study.md` |
| `balance/expert-results/` | Expert-search pilot, calibration and review results | `tools/balance/expert-search.mjs`, `tools/balance/expert-calibrate.mjs` | Readers only | `docs/notes/expert-search.md` |
| `balance/expert-held-out-pairs.json` | The held-out pairs the expert search must not train on | Hand-kept | `tools/balance/expert-*.mjs`, `tools/balance/survey.mjs`, `tools/balance/expert-coverage-screen.test.mjs` | `docs/notes/expert-search.md` |
| `house/` | Ed's treehouse layout exports, their audit, and the house first-show and precompute evidence | Ed's editor exports; `tools/house/audit-layout.mjs` | `src/editor/*Layout*.test.ts`, `src/editor/editorStartupIdentity.test.ts` (pinned by hash), `config/house/layouts/ed-current-fixes.json` | `docs/notes/house.md`, `docs/evidence/` |
| `performance/` | Benchmark, profile and readiness measurements | The bench, stall and profile tools (`tools/bench/`, `tools/stall/`, …) | Readers only | `docs/notes/performance.md` |
| `projected-fit/` | Projected-fit size and rank audits | `tools/body-graph/fit-size-audit.mjs`, `tools/body-graph/age-size-audit.mjs` (copied from `previews/projected-fit`) | Readers only | `docs/notes/creatures.md` |
| `robustness/` | Startup bundle and log size measurements | `tools/robustness/bundle-size.mjs`, `tools/robustness/measure-log.mjs` (copied from `previews/`) | Readers only | `docs/notes/performance.md`, `docs/notes/balance.md` |
| `roster/` | The species roster census, as data | `tools/roster/audit.mjs` (writes `docs/roster-census.md` beside it) | Readers only | `docs/roster-design.md` |

Adding data: put it in the folder named for the tool that writes it (make one if none fits), give the writing tool that path as its default, and link it from the note that explains it.
