# The rules as they are now

Read the page for a system before you brief or build on it (Ed, 2026-11-15, on keeping the notes honest automatically: "Do 1-7").
Comments and notes pile up; these pages are short, state only what the game does today, and every line names its code and the
date of Ed's ruling. They were checked line by line against the code on 2026-11-15.

| Page | Covers |
|---|---|
| [creatures.md](creatures.md) | Creatures and babies: ages, how many, states, who hunts her, naps, the bench. |
| [invites.md](invites.md) | Inviting: the letters, the meters, who can and cannot be invited. |
| [legends.md](legends.md) | Legends: where they are, quests, friendly and party legends and their route, their attacks. |
| [combat.md](combat.md) | Combat: attacks, rounds, blows, effects on her, lunges, shot marks. |
| [sieges.md](sieges.md) | Sieges and soundsystems: waves, besiegers, defenders, winning and losing the night. |
| [leash.md](leash.md) | The leash, chains and sigils: the stack, placing, the cast, what grounds her. |
| [movement.md](movement.md) | Her movement: flying, the blink, throws, collisions (only lakes since 2026-11-13). |

`docs/HOW-THE-GAME-WORKS.md` is the long walk-through of the whole game. It is older and was not rechecked line by line; where it and
a page here disagree, the page is the newer check (the stale-ruling check reads it too).

## Keeping them true

1. **The code wins.** If a page and the code disagree, the code is what the game does: fix the page in the same piece of work, and
   tell the coordinator if the code looks wrong. Each page ends with where the code and Ed's latest ruling disagree.
2. **When you change a rule, change its page's line** (and its date and ruling). When Ed reverses or removes a rule, also add the
   old wording to [`replaced.json`](replaced.json), so any comment or note still saying it is caught.
3. **References are checked.** A code reference is `` `path#name` ``: a name that appears in that file, or a key path in that JSON.
   `tools/docs/rulings.test.ts` fails if one no longer resolves, so a page cannot quietly point at code that is gone.

## The stale-ruling check

`node tools/docs/rulings.mjs` reads every citation of Ed's in the code's comments, the knob notes, `config/decisions/` and the
notes, and warns about:

- **replaced**: words that state a rule listed in `replaced.json` as replaced by a later ruling;
- **number**: a tuning knob named with a number (or a default on/off) that `config/tuning.json` no longer has;
- **date**: one quote of Ed's given two different dates;
- **ref**: a reference on these pages that no longer resolves.

It only warns. CI prints the list on every pull request (the check-work job's "Stale rulings" step, which cannot fail the run), and
`node tools/checks/which.mjs` lists it among a builder's checks. Read the warnings in the files you touched. A warning that was
read and is right goes in `tools/docs/rulings-ok.json` with the reason.

`node tools/docs/rulings.mjs --topic <word>` lists Ed's rulings on a knob, a name or a word, newest first: `--topic invitable`,
`--topic invites.range`. The newest wins where two disagree. `--all` adds a noisy list (passages citing an older ruling on a topic
that has a newer one worded as a change); most of it is fine, so it is not printed by default.
