# Skill in fights, and a creature command button

Design note, 2026-11-17. Nothing here is built. It is for Ed to read and answer (the questions are at the end), then for builders to build from. Quotes are Ed's words with their dates. Every claim about today's game cites the code as `path#name`. "Not checked" means I didn't check it.

## Why (Ed, 2026-11-16/17, after a playtest)

- "avoiding attacks is much easier than hitting enemies - you just keep moving around in a slightly irregular way, and you can always run away - but the gameplay progresses when your damage rate is high enough (you successfully invite animals) which is about aiming and hitting. We telegraph attacks that help you dodge, but we don't telegraph movement, which would help you hit, and hitting is the real skill."
- "your creatures mostly draw aggro but you have very little control over how and what they attack, so deploying them doesn't feel very 'skillful'."
- On the directions proposed: "How can we make this into an expressive system with a series of parameters rather than a set of cases?"
- "maybe the latter is actually 'command', and each creature has a specific action that you can use tactically during fights - some buff you, some are about attacking something or defending you etc - and they have a cooldown you can see on the sigil stack".

**Already decided by Ed** (not asked again below):

1. **Who commands:** "The bottom of the stack". That is the creature E already places or feeds; Q, R1 and L1 cycle it.
2. **Cost:** "a berry fills a meter, which has several charges, and there's a cooldown on how quickly you can use a charge."
3. **Pad:** "square as command, and circle as pickup/place. When you're near a berry, square becomes eat."
4. **Charge display:** "I think we can do this with the existing berry charge meter, with blinking or something like that."
5. **No more draining** (2026-11-17): "I think the current buff 'draining' system will be superseded by more deliberate charge uses". So pips no longer drain over time. They go down only when a charge is spent.
6. **A berry gives more than one charge** (2026-11-17): "I think that (for most creatures) a berry will give more than one charge".
7. **Next step:** "A design note first".
8. **A letter is always one hit** (2026-11-17): "I don't think one letter should ever count for more than one hit. A hit is a letter. But e.g. a buff could make you shoot twice as fast, or slow or daze a creature down so that it's easier to hit. We can rebalance around this (number of hits a creature can take, attack speed, etc) if we need to." So skill must raise how many letters land, never what one letter is worth.
9. **More charges** (2026-11-17): "I think creatures should hold more, up to ~12, and Berries could give 3-6 charges each, all depending on how big/long/strong the action is."
10. **Every level acts** (2026-11-17): "both youths and adults and legends should have actions; each level has a stronger action and more charges. If you fill a youth's charge bar and then give it another berry, it evolves to an adult."
11. **Levels change actions and charges, not always upward** (2026-11-17): "not necessarily more charges; let's say the actions and their charge numbers change with each level, and we can explore this in design and balancing. Some adults might have the same effect as a youth but many more charges; some adults might have much stronger effect but fewer or the same number of charges."
12. **No gap between commands; parameters, not caps** (2026-11-17): "I don't think we need to enforce this gap; zero gap gives a higher skill ceiling which is good I think? We should aim for a lot of distinct parameters and maximum expressiveness, and then we can have 'what creatures have what settings' as design and balancing. e.g. 'up to 12 charges' doesn't need to be strict; we may find it's fun for some creatures to have more."
13. **Ed's answers to the first questions** (2026-11-17). They are written into the sections below (5 included a 1 s shared gap, which item 12 removes):
    1. What makes a creature open: all three (sit, stagger, daze), "can vary by creature".
    2. Bigger targets: no.
    3. Buffs: "not all adults give buffs; of the ones that do, using a charge gives you that buff for a period".
    4. Eating: square eats within today's 15 m, if the bottom creature has room.
    5. Cooldowns: per creature, plus the short shared gap. "different creatures have different cooldowns depending on the ability (some are machine guns, some are powerful spells), cycling between animals and using abilities during fights is the skill".
    6. Legends: unlimited charges, on a longer cooldown.
    7. Square in the treetops: nothing. (Ed: "I don't think square cycles in the treetops currently, R1 and L1 do". The code does cycle on the pad's square in the air today, `src/rules/leash.ts` line 275, `(c.sigil && !onGround) || c.cycle`; the answer is the same either way.)
    8. The open cue: a glint or outline on the creature's sprite.
    9. Intent marks: every move whose end the rules know, "but only the ones who are engaging you, or maybe near you, not all of them (not certain about which and when)".
    10. Up to 12 charges: dots in two rows.

## Today, in brief (checked)

- **Letters.** One every 0.55 s. Each flies 45 m/s for 42 m and lands within 0.5 m of a body (`config/tuning.json#invites.cooldown`, `#invites.speed`, `#invites.range`, `#invites.radius`). Every letter that lands is worth the same: `invites.amount` is 1, passed straight to `src/rules/affection.ts#hit` by `src/rules/invites.ts#love`. Nothing about when or how well a letter hit changes what it is worth.
- **Homing.** 120°/s within 30° and 14 m; hats' letters 420/80/18 (`src/rules/invites.ts#const homing`, `config/tuning.json#invites.hard`). Single-stick mode (branch `claude/single-stick`, not merged) adds `invites.singleStick` with the same 420/80/18.
- **Meters.** 7 letters for a youth, 14 for an adult (`config/tuning.json#invites.hits`). A full ring stuns the creature for 20 s and the next letter wins it over (`src/rules/affection.ts#hit`). Her party's blows fill the same ring as hearts (`src/rules/orbit.ts#addHearts`).
- **A creature's fight loop.** It is held in `src/rules/combat/data.ts#Fight` as `readyAt` (attack ready again), `windupAt` and `windupUntil` (the wind-up, then release), plus `lunge`, `aim` and `spellCast`.
  - Melee aim locks 0.18 s before release (`config/tuning.json#dodge.a.commit`). Ranged aim locks at least 0.2 s before release (`#ranged.commit`).
  - Only the hare has a recovery that matters: it sits 0.8 s after its stamp (`src/rules/combat/release.ts#c.sitUntil`, `config/tuning.json#hareStamp.sit`).
  - **Nothing a letter does interrupts a creature.** There is no poise, flinch or cancel anywhere in `src/rules` (searched for interrupt, flinch, poise, stagger). Staggers exist only for her (`src/rules/knock.ts`).
- **Her side.** Every blow costs her one of 4 hits and staggers her 0.25–1 s (`src/rules/knock.ts#knockWitch`). Only one creature winds up at her at a time (`config/tuning.json#dodge.a.tokens`). Waiters circle about 50 m out (`config/tuning.json#combatWaiting`).
- **Berry pips.** An adult holds up to 5 (`config/tuning.json#buffs.pips.max`), each worth 120 s of buff (`#buffs.pips.life`). The pips drain one at a time while it follows her (`src/rules/buffs.ts#drainPips`, called from `src/rules/game.ts` line 851). The last 10 s twinkles (`src/rules/buffs.ts#pipFading`, `src/render/leash/stack.ts` lines 94–106).
  - A youth's growth dots use the same row (`src/render/leash/ranks.ts#youthDots`) and pulse when ready to evolve.
  - Legends have no pips and give a triple buff (`config/tuning.json#buffs.legend`). Babies have one growth dot (`#berries.babyCost`).
- **Buffs.** One buff per group, groups by how each kind retreats (`src/rules/buffs.ts#groupOf`): climbers (dash charge), darters (speed), stalkers (letter speed and range), heavies (extra shots round her), pack hunters (fire rate), shells (chain).
- **E's order.** Mushroom or basket, hat, tonight's find, cast at a stone, flask, feed, then the leash press (`src/rules/sigilButton.ts#stepSigilButton`, `#feedOffer`). Feeding needs a berry within 15 m and room to eat (`config/tuning.json#berries.feed.reach`, `src/rules/berries.ts#feedRoom`). Holding 0.3 s places instead of feeding (`#berries.feed.hold`).
- **Pad today** (`config/bindings.json`):
  - square = `game.use` (in the treetops it cycles the stack: `src/rules/leash.ts` line 275);
  - circle and L2 = dodge;
  - circle = back in menus;
  - R1/L1 cycle, triangle hat, cross rise.
- **Touch today** (`src/ui/touch.ts`): rise, zoom, Sigil (held: hat), spell, dash, 💌. There is no cycle button; Sigil cycles in the treetops.

## 1. The parameter model

**Aim (Ed, 2026-11-17): many distinct parameters and as much expressiveness as possible.** Ed: "We should aim for a lot of distinct parameters and maximum expressiveness, and then we can have 'what creatures have what settings' as design and balancing."

So the model is a broad **catalogue of parameters**:

- **Every parameter has a global default.**
- **Any species may override any parameter, separately for each level** (youth, adult, legend).
- **The ranges below are starting points, not limits.** Ed: "'up to 12 charges' doesn't need to be strict; we may find it's fun for some creatures to have more." The code clamps only what would break it (negative times, zero divisors).
- Which creature gets which settings is design and balance work, done in data, never in code.

The frame is unchanged: **every creature's attack is a loop of four phases** (approach, wind-up, release, recovery), read from the `Fight` fields above (`src/rules/combat/data.ts#Fight`). The parameters act on that loop, and on her commands.

**No parameter changes what a letter is worth: a hit is a letter** (Ed, 2026-11-17). Every parameter either makes a creature easier or harder to hit for a moment, or changes how many letters she lands. Then `invites.hits` (7 and 14) and `invites.cooldown` (0.55 s) can be rebalanced around the new hit rate.

Names below are the profile's keys (section "A species profile"). "Starting default" is the global default.

### Openings: when a creature is easier to hit

| Parameter | Meaning | Starting default | Shown as |
|---|---|---|---|
| `sit.time` | Seconds it holds after it attacks: its punish window (generalises `config/tuning.json#hareStamp.sit`) | 0.5 | it settles (pose), plus the open cue |
| `sit.move` | Its speed while sitting, as a share of normal (0 = stock still) | 0 | — |
| `sit.after` | Which attacks it sits after: `all`, `melee`, `ranged`, `area`, or a list of its moves | `all` | — |
| `poise.letters` | Letters to break its poise. Each still counts one hit on the meter as usual. | 40% of its meter (youth ≈ 3, adult ≈ 6) | a thin arc on its ring, emptying |
| `poise.windup` | Poise worn per letter during its wind-up (poise is not the meter, so this is allowed) | 1 | — |
| `poise.regenDelay` | Seconds after its last hit before poise refills | 1 | — |
| `poise.regenTime` | Seconds to refill from empty | 2 | the arc refilling |
| `stagger.time` | Seconds it stands still when poise breaks | 1 | a wobble, plus the cue at full |
| `stagger.cancels` | Whether a break during a wind-up cancels the attack | true | the tell snaps off |
| `stagger.immune` | Seconds after a stagger before poise can break again | 3 | — |
| `daze.time` | Seconds it is slowed after a stagger | 2 | the cue, fading |
| `daze.speed` | Its speed while dazed, as a share of normal | 0.5 | — |
| `dodge.letters` | Chance per letter aimed at it that it side-steps (an evasive kind; 0 = never) | 0 | a hop aside |
| `homing.resist` | Multiplier on letter homing toward it (below 1: a slippery kind) | 1 | — |

- Holding still and moving slowly make the next letters land; nothing makes them count more.
- No bigger targets: a letter lands only within 0.5 m (`config/tuning.json#invites.radius`; Ed, 2026-11-17, answer 2).
- Which openings a species has, and how strong each is, varies by creature (Ed, answer 1). Any of them can be 0. `dodge.letters` and `homing.resist` work the other way, making a kind harder to hit, so the same catalogue describes evasive creatures too.

### Intent: telegraphing movement

| Parameter | Meaning | Starting default | Shown as |
|---|---|---|---|
| `intent.lead` | Seconds ahead a move is shown | 0.6 | a small mark where it will be |
| `intent.moves` | Which moves are shown: `bound` (`src/rules/combat/approach.ts#boundIn`), `pass` (a waiter's close pass, `src/rules/combatSpacing.ts#waitingDrive`), `dash`, `lunge` (already shown), `charge`, `flee` | all of them (Ed, answer 9) | the same mark |
| `intent.who` | Which creatures show marks: `engaging` (target is her or hers), `near` (within `intent.near`), `both` | `engaging` | — |
| `intent.near` | Metres for `near` | 30 (`config/tuning.json#combat.defendRadius`) | — |
| `intent.max` | Most marks shown at once | 4 | — |

- Ed (answer 9): only those engaging her, "or maybe near you, not all of them (not certain about which and when)". `intent.who` lets both be tried in play.
- A move is shown only when the rules already know where it will end. It is never a guess from velocity alone, so it is honest and costs nothing to compute.

### Precision: hitting well, not lucky homing

| Parameter | Meaning | Starting default | Shown as |
|---|---|---|---|
| `aim.help` | Multiplier on homing rate, cone and range, one per aiming mode (twin-stick reads `invites.homing*`, single-stick `invites.singleStick`) | 1 for both | (feel) |
| `aim.rate`, `aim.cone`, `aim.range` | The three separately, for when one multiplier is too blunt | 1 each | — |
| `aim.lead` | How much homing aims where the creature will be, not where it is (today it leads: `src/rules/invites.ts#const homing`) | 1 | — |

- Bonuses for clean or long hits are dropped: a letter is one hit (Ed, 2026-11-17).
- In single-stick mode homing does the aiming, so openings and commands carry the skill.

### Pressure: making "keep moving" not enough

| Parameter | Meaning | Starting default | Shown as |
|---|---|---|---|
| `pressure.cutoff` | Share of a team's waiters that wait ahead of her heading, not round her | 0.3 | (their movement) |
| `pressure.lead` | Scales how far attacks lead her (`config/tuning.json#dodge.a.lead`, `#ranged.lead`) | 1 | (their aim) |
| `pressure.commit` | Seconds before release its aim locks (`config/tuning.json#dodge.a.commit` 0.18, `#ranged.commit` 0.2), per species | as today | — |
| `pressure.surge` | Speed of its wind-up surge toward her (`config/tuning.json#dodge.a.surge`) | as today | — |

Per-species versions of `dodge.a.tokens` and `dodge.a.width` can join later. They stay global for now.

### Commands (section 3): every number per species and level

Ed: "different creatures have different cooldowns depending on the ability (some are machine guns, some are powerful spells), cycling between animals and using abilities during fights is the skill" (2026-11-17).

**No enforced gap between commands** (Ed, 2026-11-17: "zero gap gives a higher skill ceiling"). Cycling fast and firing ready creatures one after another is part of the skill. A `command.gap` parameter exists at 0, for testing only.

**Each level of each species sets its own:**

| Parameter | Meaning | Starting default |
|---|---|---|
| `verb` | Strike, Daze, Snare, Guard, Surge (section 3), or a named special | by species (the command table) |
| `max` | Charges held: no cap (Ed: "doesn't need to be strict") | youth 6, adult 9 |
| `perBerry` | Charges a berry gives | youth 3, adult 4 |
| `start` | Charges when it joins her or grows up | 1 (today's `config/tuning.json#buffs.pips.start`) |
| `cooldown` | Seconds before it can act again | 5 |
| `cast` | Seconds from the press to the action (0 = instant; a spell can wind up) | 0 |
| `castMove` | Whether she can move while it casts | true |
| `target` | `aim`, `lastHit`, `nearest`, `self`, `allies`, `area`, in order of preference (section 3, Targeting) | by verb |
| `reach` | Metres it can act at | 20 |
| `power` | Damage multiplier on its attack (Strike, Daze) | 1.5 |
| `count` | Projectiles, hits or bounces | its attack's own |
| `radius` | Area of effect, metres | its attack's own |
| `slow`, `slowTime`, `stun`, `root`, `knock`, `pull` | Effect numbers | its attack's own, doubled (Snare) |
| `daze` | Seconds it leaves the target dazed | 0 (Daze: 3) |
| `taunt`, `tauntRadius` | Guard's taunt seconds and metres (reuses `config/tuning.json#combat.taunt`) | 4, 10 |
| `shield`, `shieldTime` | Blows the shield on her stops, and how long it waits | 1, 6 |
| `buff` | Whether a use gives her its group's buff (`src/rules/buffs.ts#groupOf`) | false; true for buff-givers |
| `buffTime`, `buffStacks` | How long, and how strong | 20 s, 1 |
| `heal` | Hits back for her | 0 |
| `party` | Whether her other followers join (Pack call) | false |

**Levels change actions and charges, not always upward** (Ed, 2026-11-17): "Some adults might have the same effect as a youth but many more charges; some adults might have much stronger effect but fewer or the same number of charges." Three shapes, as examples of what the parameters allow, not a scheme to fit:

| Shape | Youth | Adult | Example |
|---|---|---|---|
| **machine gun** | small effect, 6 charges, 4 per berry, cooldown 1 s | same effect, 16 charges, 6 per berry, 0.7 s | dormouse Snipe, bee Buzz, squirrel Bonk |
| **ordinary** | 6 charges, 3 per berry, 5 s | stronger (the grammar's adult, `src/rules/attacks/species.ts#adultOf`), 8 charges, 4 per berry, 5 s | fox Foxfire, hare Stamp |
| **spell** | 3 charges, 3 per berry, 15 s, cast 0.5 s | much stronger, 3 charges, 3 per berry, 20 s | badger Barge, wolf Pack call, griffin Lift |

- **The charge bar replaces growth for youths** (Ed, 2026-11-17). Feeding a youth fills its bar, and one more berry on a full bar makes it an adult.
  - So growing up costs ceil(youth `max` / `perBerry`) + 1 berries: 3 for the machine gun and ordinary shapes above, 2 for the spell. Today it is about 4 for a youth of normal strength (`src/rules/berries.ts#toEvolve`, `config/tuning.json#berries.cost`).
  - So `berries.cost` stops deciding growth. Each species' youth `max` and `perBerry` decide it.
- **Legends:** unlimited charges, on a longer cooldown (Ed, answer 6; starting at 3 times the adult's), with the strongest version (`src/rules/attacks/species.ts#legendOf`). They never eat (`src/rules/berries.ts#feedRoom`). Their entry sets the same parameters, `max` aside.

**Global display parameters:** dots per row (`config/tuning.json#leash.ranks.dotsPerRow`, 6 for charges), blink rate (2 Hz), the shortest cooldown that blinks (1.5 s), and the flash when a creature is ready again.

### What it replaces, reuses, extends

| Existing | Becomes |
|---|---|
| `config/tuning.json#hareStamp.sit` | the hare's `sit.time` (0.8) |
| `src/rules/invites.ts#love` (`I.amount`) | unchanged: a letter is one hit (Ed, 2026-11-17) |
| `config/tuning.json#buffs.pips.max`, `#buffs.pips.life` | replaced by each level's `max` and `perBerry`; `life` is retired; the buff a charge gives lasts its `buffTime` |
| `src/rules/buffs.ts#buffsOf` (buff while fed) | buff only for a while after a buff-giver uses a charge |
| `config/tuning.json#invites.homing`, `#homingCone`, `#homingRange`, `#invites.singleStick` | kept, scaled by `aim.*` and each creature's `homing.resist` |
| `config/tuning.json#dodge.a.lead`, `#ranged.lead` | kept, scaled by `pressure.lead` |
| `src/rules/combatSpacing.ts#waitingSlot` | extended: cutoff places for `pressure.cutoff` of waiters |
| `src/rules/buffs.ts#drainPips` | removed: pips are spent by commands only (Ed, 2026-11-17) |
| `src/rules/combat/hits.ts` taunt (`combat.taunt`) | reused by the defend commands |
| `src/rules/attacks/combatWorld.ts#speciesSpell` | reused: an attack command casts the species' own grammar attack |

### A species profile

Profiles live in a new `config/combat-skill.json`, next to `config/species-attacks.json`. Each species has one sparse entry: any parameter from the catalogue above, at the species level or under a level (`youth`, `adult`, `legend`). A value under a level wins over the species value, which wins over the global default.

```json
{
  "global": { "sit": { "time": 0.5, "move": 0 }, "poise": { "letters": "40%", "windup": 1 }, "stagger": { "time": 1, "cancels": true },
              "daze": { "time": 2, "speed": 0.5 }, "intent": { "lead": 0.6, "who": "engaging" },
              "command": { "youth": { "max": 6, "perBerry": 3, "cooldown": 5 }, "adult": { "max": 9, "perBerry": 4, "cooldown": 5 }, "legendCooldown": 3 } },
  "species": {
    "hare": { "sit": { "time": 0.8 }, "dodge": { "letters": 0.15 },
              "command": { "verb": "Snare", "name": "Stamp", "radius": 4, "slowTime": 2,
                           "adult": { "radius": 6, "max": 8 } } },
    "badger": { "poise": { "letters": "60%", "windup": 2 }, "sit": { "time": 0.9 },
                "command": { "verb": "Guard", "name": "Barge", "knock": 10, "taunt": 3, "cast": 0.5,
                             "youth": { "max": 3, "perBerry": 3, "cooldown": 15 }, "adult": { "knock": 16, "max": 3, "perBerry": 3, "cooldown": 20 } } },
    "dormouse": { "sit": { "time": 0.2 }, "poise": { "letters": "25%" }, "homing": { "resist": 0.7 },
                  "command": { "verb": "Daze", "name": "Snipe", "daze": 1.5,
                               "youth": { "max": 6, "perBerry": 4, "cooldown": 1 }, "adult": { "max": 16, "perBerry": 6, "cooldown": 0.7 } } }
  }
}
```

Home island profiles (the home kinds are `src/rules/rosters.ts#homeKinds`: hedgehog, squirrel, hare, fox, bee, stoat, mole, snail, dormouse, badger):

| Species | Its character | Sit after attacking | Poise | Intent | Command shape |
|---|---|---|---|---|---|
| hedgehog | slow, prickly | 1.0 (curled, rolling back) | 0.6 | none | spell |
| squirrel | lobber, darts in trees | 0.3 | 0.3 | pass | machine gun |
| hare | fast hopper | 0.8 (today's) | 0.3 | bound | ordinary |
| fox | curving wisp | 0.5 | 0.4 | pass | ordinary |
| bee | quick double sting | 0.3 | 0.2 | dash | machine gun |
| stoat | longest lunge | 1.0 (it overshoots) | 0.4 | lunge (already shown) | ordinary |
| mole | heave from below | 0.8 (surfaced) | 0.5 | none | ordinary |
| snail | slime zone | 0 (it's slow anyway) | 0.8 | none | spell |
| dormouse | fast seed | 0.2 | 0.25 | pass | machine gun |
| badger | shoulder-barge | 0.9 | 0.6 | lunge | spell |

## 2. Readability

**The open cue: one look for every species.**

- **A glint outline on the creature's own sprite** (Ed, 2026-11-17, answer 8), in her magic's warm amber, the same as the active buff icon (`src/render/leash/stack.ts`, `AMBER`).
  - Faint during a wind-up, where enough letters can break its poise.
  - Bright while it sits still or is staggered.
  - Fading while it's dazed.
  - Not checked: whether the sprite batch can draw an outline cheaply, or needs a second, slightly larger tinted draw behind the sprite.
- Colour grammar (Ed, 2026-11-03: "the forest is cold, the party is warm"):
  - warnings are the attacker's element colour (the trial, `src/render/leash/attackLook.ts#danger`) or red;
  - what's hers is warm.
  - An opening is an opportunity for her, so it is warm and not red. It also stays clear of the element colours, which mean "danger to you".
- The poise arc rides on the creature's existing meter ring as a thin outer band, so there is no new object. A break flashes it white.
- **No stars for a creature's stagger:** three circling stars mean she is slowed (`src/render/herEffects.ts#HER_EFFECTS`). A staggered creature wobbles, with its outline at full.

**The intent mark.**

- A small dot-and-tick on the ground where the creature will be in `intent.lead` seconds, in the creature's own side colour: cold, its rank colour (`config/tuning.json#leash.ranks.enemy`).
- Its form matches the lunge's dotted front (`src/render/leash/combat.ts#lungeTell`): dots mean "where it goes", and the filled element shape means "where it hurts".

**Big fights.**

- Cues show only for creatures within letter range (42 m).
- At most 3 open cues and 4 intent marks at once, chosen nearest her aim line (twin-stick) or her heading (single-stick).
- Waiters out on the 50 m ring are mostly outside range anyway (`config/tuning.json#combatWaiting`). The one striking token-holder is the one that matters most, and it is always eligible.

## 3. The command button

### Bindings

Ed's pad: **square = command (eat when near a berry), circle = pick up / place.**

| Input | Today | Proposed |
|---|---|---|
| pad square | `game.use`: the whole E list; cycles in the treetops | `game.command`: the bottom creature's action. Eats when a berry is close and the bottom can eat. Does nothing in the treetops. |
| pad circle | dodge (with L2); back in menus | `game.use`: the E list minus feeding (mushroom, hat, find, cast, flask, pick up/place, runs, the hat hold). Still back in menus. |
| pad L2 | dodge | dodge (now the only pad dodge) |
| pad R1 / L1 | cycle | unchanged; now the only pad cycle |
| keyboard E | use; feeds; cycles nothing in the treetops | use, minus feeding (so no more 0.3 s feed-or-place hold) |
| keyboard **F** (new) | (free) | command; eats when near a berry |
| mouse middle (new) | (free) | command |
| touch | Sigil button: use, feed, cycles in the treetops | Sigil: use, cycles in the treetops (touch has no cycle button). New **Command** button beside it, showing the bottom creature's sigil with its pips: command, or eat near a berry. |

**What this means:**

1. **Circle loses dodge.** L2 keeps it. Anyone used to circle-dodging must move to L2: worth a line in What's new.
2. **Feeding leaves E.** The feed-or-place hold (`config/tuning.json#berries.feed.hold`) is no longer needed on any input, because feed and place are now on different buttons. A tap of circle or E always places, which is simpler.
3. **The treetop cycle on square goes.** R1/L1 cover it on the pad, and touch keeps it on Sigil. Followers travel quietly while she's aloft (`config/travel.json#posse`), so a command there would have no one to act. Square in the treetops does nothing (Ed, 2026-11-17, answer 7).
4. **"Near a berry" is today's 15 m** (Ed, answer 4: `config/tuning.json#berries.feed.reach`), when the bottom creature has room (`src/rules/berries.ts#hasRoom`).
   - A creature at its max always commands, and the existing feed tag over the berry (`src/render/feedTag.ts`) shows what the press will do.
   - Worth watching in play: areas have 10–16 berries (`config/tuning.json#berries.perArea`). In a fight near bushes, square will often be eat for a creature that isn't full. Playing as a reload rhythm, that may be right.

### Charges: the berry pips

- **Charges are pips.** Today a berry gives an adult one pip, up to 5 (`src/rules/buffs.ts#addPip`). Under this plan a berry gives the level's `perBerry` pips, up to its `max`; neither is capped (section 1). A command spends one.
  - So feeding is a reload of several shots, and the queued-berry glint lights that many empty pips.
  - Dots in rows (Ed, answer 10): today's row is 4 dots (`config/tuning.json#leash.ranks.dotsPerRow`). At 6 a row, 12 make two rows, the height of a youth's dots today. A creature with many more charges gets more rows, or smaller dots past a set count; that is a display parameter.
  - A creature starts with its level's `start` charges (1 by default, as today's `config/tuning.json#buffs.pips.start`).
- **Pips do not drain** (Ed, 2026-11-17). `drainPips` goes, and `buffs.pips.life` stops meaning time.
- **Buffs come from using a charge** (Ed, answer 3): "not all adults give buffs; of the ones that do, using a charge gives you that buff for a period".
  - A species' profile marks whether its adult is a buff-giver. Which ones is a design choice still open.
  - For a buff-giver, each charge used gives her its group's buff (`src/rules/buffs.ts#groupOf`) for its `buffTime`, at its `buffStacks`. A new use restarts the period.
  - Buffs of different kinds still stack as today (`src/rules/buffs.ts#buffsOf`). The buff icon shows amber while its period runs.
  - A buff-giver's action can be the buff itself (the Surge verb), or another action that also brings the buff.
  - So there are no more passive buffs from feeding. `buffsOf` counts the creatures whose period is running, not those with pips.
- **Cooldowns.** Each creature has its own cooldown, set by its action and level: a machine gun about 1 s, a spell 15–20 s (Ed, answer 5). There is no shared gap (Ed, 2026-11-17: "zero gap gives a higher skill ceiling").
  - Cycling with Q, R1 and L1 to a ready creature and using it is the skill: "cycling between animals and using abilities during fights is the skill".
- **Shown on the same pips, with no new ring:**
  - **ready**: lit pips steady and bright, as today;
  - **cooling down**: lit pips dimmed to about 45%, and the pip that will be spent next blinks slowly (about 2 Hz, on/off);
  - **ready again**: one bright flash across its lit pips, plus a soft tick sound;
  - **no charges**: all pips dark, and its sigil's dots show the existing dim "unlit" look; the feed tag over a nearby berry says square will feed it.
  - A machine gun's cooldown is too short to blink. Below about 1.5 s, the next pip only dims and brightens, with no on/off blink.
  - Today's drain twinkle (fast, 9 rad/s, on the last pip) disappears with draining, so there is no clash.
  - The queued-berry glint (`src/render/leash/ranks.ts#queuedDot`) stays: it fills the next empty pip, never a lit one.
- **Youths command too** (Ed, 2026-11-17). Their growth dots (`src/render/leash/ranks.ts#youthDots`) become their charge bar.
  - Full, the bar pulses as a ready-to-grow youth's dots pulse today (`src/render/leash/stack.ts`, `ready`). The next berry evolves it on the next bar line, as now (`src/rules/berries.ts#feed`).
  - **Spending a youth's charges puts off its growing up.** That is a real choice in a fight: use the action now, or save the charges and grow the youth.
  - A flask's growth spurt still makes every follower an adult at once (`src/rules/berries.ts#growthSpurt`). The new adult keeps its charges, up to the adult's max.
- **Babies** have no action: they never fight (`src/rules/combat/targeting.ts#targetable`), so they never command. Square near a berry feeds a baby as before.
- **Legends** (leashed) have unlimited charges and the strongest action, on a longer cooldown (Ed, answer 6): about 3 times its adult's.
  - With no pips to count, its cooldown blinks on its three buff icons (`src/rules/buffs.ts#iconCount`), or, for a kind with no buff, on a single dot.
- **Party legends** don't follow and fight nobody (`src/rules/partyLegend.ts#pinWitch`; Ed, 2026-10-06: "totally useless"). They don't command.

### The command table

Every kind gets an action from one of **five verbs**. That keeps the code small and the actions readable:

- **Strike** (attack): its own grammar attack, cast now at the target with `command.power` × 1.5 damage. It ignores its attack cooldown and the strike token. The blow fills the target's ring as hearts. **Reuses** `src/rules/attacks/combatWorld.ts#speciesSpell`.
- **Daze** (attack/setup): a Strike that also leaves the target slowed (its `daze` seconds at the target's `daze.speed`) and showing the open cue for 3 s, so her letters land. It never makes a letter count more (Ed, 2026-11-17).
- **Snare** (control): its attack's own effect (slow, root, stun, throw) on the target, doubled and lengthened. **Reuses** the grammar's effects (`src/rules/attacks/combatWorld.ts`).
- **Guard** (defend): it taunts every wild creature within 10 m for 4 s, or puts a one-blow shield on her for 6 s.
  - The taunt **reuses** `combat.taunt` (`src/rules/combat/hits.ts`).
  - The shield is new: one boolean on her that `src/rules/game.ts#hitWitch` checks.
- **Surge** (buff): its group's buff, stronger, for a period, or an instant (a dash charge back, one hit healed). **Reuses** `src/rules/buffs.ts` with a timed stack. Any buff-giver's use also brings its normal buff (above).

| Kind | Group | Its attack (`config/species-attacks.json`) | Role | Command |
|---|---|---|---|---|
| **hedgehog** | shells | ring of quills | defend | **Bristle** (Guard): shield on her; the blow it stops sends a quill ring back |
| **squirrel** | climbers | acorn lob | control | **Bonk** (Snare): an acorn on the target, stunned 0.6 s |
| **hare** | darters | stamp round itself | control | **Stamp** (Snare): bounds to the target and stamps; wild within 4 m slowed 2 s |
| **fox** | pack hunters | curving foxfire wisp | attack | **Foxfire** (Strike): three wisps curving onto the target |
| **bee** | darters | double sting | buff | **Buzz** (Surge): her speed +60% for 6 s |
| **stoat** | pack hunters | longest lunge | attack | **Pounce** (Daze): lunges through the target; dazed 3 s |
| **mole** | shells | ground heave | control | **Heave** (Snare): the ground throws the target up; 1 s helpless |
| **snail** | shells | slime zone, slows | control | **Slick** (Snare): slime round her for 6 s; wild in it at 0.6 speed |
| **dormouse** | stalkers | fast seed | attack | **Snipe** (Daze): a fast seed; the target dazed 3 s |
| **badger** | heavies | shoulder-barge | defend | **Barge** (Guard): barges the creature nearest her, throws it 10 m, taunts it |
| beetle | shells | dung bomb mine | control | **Mine** (Snare): a bomb at her feet; the first wild to step on it is blasted and slowed |
| boar | heavies | goring sweep | defend | **Gore** (Guard): sweeps the arc in front of her, throwing wild back |
| otter | shells | skimming pebble | attack | **Skip** (Strike): a pebble bouncing through up to 3 in her aim |
| heron | stalkers | piercing beak-spear | attack | **Spear** (Daze): pierces along her aim; everything it passes dazed 2 s |
| turtle | shells | water jet, slows | defend | **Shell** (Guard): shield on her for 8 s |
| woodlouse | shells | stop-and-go roll | defend | **Roll guard** (Guard): circles her 4 s, knocking back what it meets |
| butterfly | climbers | dust puff, slows | control | **Dust** (Snare): a cloud on the target, slowed 0.5 for 3 s |
| bat | darters | screech ring, slows | control | **Screech** (Snare): a ring from her slows all wild within 8 m |
| toad | darters | hop-splash lob | buff | **Leap** (Surge): her next blink goes 1.5× and costs no charge |
| raven | climbers | feathers relayed via a packmate | attack | **Relay** (Strike): feathers relayed through her nearest follower to the target |
| elk | pack hunters | frost stamp ring | defend | **Frost ring** (Guard): a ring from her that knocks back and slows |
| wolf | pack hunters | frost bite lunge | attack | **Pack call** (Strike): every follower within 30 m attacks her target now |
| lynx | stalkers | pouncing lunge, stuns | attack | **Pounce** (Daze): stun 1 s, then dazed 3 s |
| ram | heavies | headbutt, throws | defend | **Ram** (Guard): charges the nearest creature on her, throws 12 m |
| salamander | stalkers | fire breath sweep | attack | **Breath** (Strike): sweeps across her aim, burning |
| spider | climbers | web shot, roots | control | **Web** (Snare): roots the target 2 s |
| snake | stalkers | weaving venom spit | control | **Spit** (Snare): slowed 0.5 for 3 s |
| cat | climbers | claw fan | attack | **Flurry** (Strike): three fans at the target |
| stag | pack hunters | marching stamps | control | **Stampline** (Snare): stamps march along her aim, throwing |
| beaver | shells | three logs rolled | defend | **Dam** (Guard): three logs ahead of her block shots 4 s |
| bear | heavies | huge swat | defend | **Swat** (Guard): everything within 6 m of her thrown; taunt 4 s |
| owl | climbers | homing feather | attack | **Seeker** (Daze): a feather that cannot miss |
| arcticfox | stalkers | frost shard bursting in three | attack | **Shard** (Strike): bursts at the target |
| ibex | darters | rockfall line | buff | **Sure-foot** (Surge): she ignores slows and rough ground 6 s |
| redpanda | climbers | boomerang leaf | control | **Hook** (Snare): the leaf drags the target 5 m toward her |
| komodo | stalkers | venom bolt, burn, pool | control | **Venom** (Snare): a burning, slowing pool on the target |
| meerkat | darters | arcing pebbles | buff | **Lookout** (Surge): for 8 s every attack's tell on her starts 0.3 s sooner |
| armadillo | shells | roll that bursts | defend | **Ball** (Guard): blocks the next shot at her and bursts it to pebbles |
| fennec | pack hunters | sand spray, slows | control | **Sandblast** (Snare): spray along her aim, slow |
| lion | pack hunters | roar cone, stuns | control | **Roar** (Snare): a cone along her aim; stunned 0.5 s, then dazed |
| crocodile | shells | whirlpool drag | control | **Whirlpool** (Snare): drags wild in and holds them 2 s |
| dragonfly | darters | chaining spark | attack | **Arc** (Strike): a spark chaining through 4 foes |
| tiger | stalkers | raking fans, pierce | attack | **Rake** (Strike): three raking fans along her aim |
| flyingsquirrel | climbers | acorn splinters | buff | **Glide** (Surge): a blink charge back at once |
| roe | darters | cross kicks | buff | **Spring** (Surge): speed +50% and blink recharge ×2 for 5 s |
| penguin | shells | belly slide, ice patch | control | **Slide** (Snare): slides along her aim, leaving ice that slows wild |
| frosttroll | heavies | three frost rings | defend | **Rings** (Guard): frost rings from her; slows and taunts |
| snowleopard | climbers | frost cross | control | **Frost cross** (Snare): on the target, slowed |
| frostwyrm | stalkers | frost breath | attack | **Breath** (Strike): a wide sweep along her aim |
| griffin | climbers | dive and gust | buff | **Lift** (Surge): carries her 20 m the way she's going |
| sphinx | heavies | gaze beam, stuns | control | **Gaze** (Snare): tracks the target 2 s, then stuns and dazes |
| stegosaurus | heavies | tail-spike spray | defend | **Spikes** (Guard): spikes swept round her, knockback |
| rattlesnake | stalkers | venom traps | control | **Traps** (Snare): two traps either side of her |
| scorpion | shells | sticking sting, cloud | attack | **Sting** (Strike): sticks, then a venom cloud |
| rhino | pack hunters | stampede runners | attack | **Charge** (Strike): charges along her aim, throwing |
| cheetah | pack hunters | dust devil | buff | **Sprint** (Surge): her speed doubled for 3 s |
| hydra | heavies | three homing spits | attack | **Three heads** (Strike): one homing spit at each of the 3 nearest |
| crab | heavies | triangle eruption | defend | **Triangle** (Guard): the ground round her erupts outward |
| featheredserpent | climbers | six spiral feathers | defend | **Orbit** (Guard): feathers circle her 5 s, blocking shots |
| elephant | heavies | stomp rings, throw | defend | **Stomp** (Guard): everything near her thrown |
| jaguar | climbers | long pounce | attack | **Pounce** (Daze): onto the target; dazed 3 s |
| raccoon | pack hunters | returning junk can | control | **Clang** (Snare): the can stuns the target 0.8 s and comes back |
| unicorn | pack hunters | rainbow beam | buff | **Mend** (Surge): one of her hits back |
| polarbear | heavies | icicle rain | defend | **Icicles** (Guard): icicles round her; slows |

- **Spread:**
  - attack 21 (Strike 14, Daze 7);
  - control 20;
  - defend 14;
  - buff 9.
  - Home island: control 4, attack 3, defend 2, buff 1.
- **By group:** heavies lean defend, stalkers attack, darters buff, climbers and shells mixed. So the stack's mix is a real choice.
- **Code reuse:** Strike and Daze cast the existing attack. Snare uses the existing effects with bigger numbers. Guard's taunt reuses `combat.taunt`, and the shield is new. Surge reuses the buff functions.
- **Genuinely new behaviours** are about 10 rows, all optional for a first build: Relay, Pack call, Lift, Lookout, Hook, Mend, Glide, Leap, Sure-foot, Dam/Orbit blocking shots. Those rows can start as the plain verb.

### Targeting

| Aim mode | An attack or control command hits, in order |
|---|---|
| twin-stick (cursor / right stick) | 1. the wild creature nearest her aim line within 20° and the command's reach; 2. else the last creature her letter landed on in the last 4 s; 3. else the nearest creature fighting her |
| single-stick (aim = movement) | 1. the last creature her letter landed on in the last 4 s (in single-stick, homing chose it, so it is "the one I'm working on"); 2. else nearest in a 40° cone ahead; 3. else the nearest fighting her |

- "Along her aim" actions (Spear, Breath, Stampline) use her aim in twin-stick and her heading in single-stick.
- Guard and Surge need no target.
- While she holds square, the chosen target shows the open cue's ring in white for a moment. That is a preview, not a lock-on.

## 4. Balance hooks

- **Damage rate is letters landed per second.** Today she throws one letter every 0.55 s (`config/tuning.json#invites.cooldown`). A youth's 7 hits take at least 3.9 s and an adult's 14 at least 7.7 s, if every letter lands. Against movers far fewer land: the attack legibility audit measured 20.6 s to stun a hare (`docs/plans/attack-legibility-audit.md`, B4).
- **Skill raises the share that lands.** Sits, staggers and dazes are moments when nearly every letter hits. Commands add hearts from her party's blows (`src/rules/orbit.ts#addHearts`, as today), plus Surge buffs such as faster fire (pack hunters, `src/rules/buffs.ts#invitesBuffed`).
- **What to rebalance once the hit rate is measured** (Ed: "number of hits a creature can take, attack speed, etc"):
  - `invites.hits`: up if skilled fights get too short;
  - `invites.cooldown`;
  - how long sits and staggers last.
  A balance-study run before and after would show the change (`docs/notes/balance-study.md`, not run here).
- **The invite meter is unchanged.** Drain (2%/s after 4 s) and the stun work as today.
- **Fight length** falls for skilled play and stays the same for unskilled play. That is the point: hitting becomes the skill. Pressure (cutoffs) stops "just circle" from being safe while the player waits for openings.
- **Berry economy.** Without draining, pips last until spent. A berry gives 3–6 charges. A machine gun empties a berry's worth in a few seconds; a spell's three charges last a minute. Feeding becomes "reloading", which ties berries to fights as Ed wanted ("something she does deliberately and accurately under time pressure", 2026-11-03).

**Tune first, in this order:**

1. `sit.time` (0.5): the size of the window.
2. `poise.letters` (40%) and `stagger.time` (1 s): how often staggers happen, and how long they last.
3. Each prototype species' cooldown, `perBerry` and `max`: the command rhythm, and how often she must feed.
4. `skill.aim.help` (1) for twin-stick: how much luck is left.
5. `invites.hits` (7, 14): rebalanced last, against the new hit rate.

## 5. A first prototype slice

Two switches, each alone testable. Both are on by default since Ed's word of 2026-11-17, "Put the switches on by default and then publish"; `?skill=0` and `?commands=0` turn each off (`?commands=0` also puts the old bindings back).

- `?skill=1`: sit, poise, stagger, daze slow and the open cue, for **hare, badger, dormouse**: the hopper, the bruiser and the sniper. Others are as today.
- `?commands=1`: Ed's bindings, pips as charges with no drain (by level and action size; a youth's bar replacing its growth dots), the blinking cooldown, and commands for **fox (Strike), squirrel (Snare: Bonk), badger (Guard: Barge + taunt), bee (Surge: Buzz)**. That is one per role.

Intent marks, pressure and the other 60 commands come after Ed has played this.

**Files** (all new files are small; nothing grows past the guardrails):

| File | What |
|---|---|
| `config/tuning.json` `skill`, `commands` + `config/schema/tuning.schema.json` + `config/knobs/army.json` | the dials and switches, with notes |
| `config/combat-skill.json` (new) | the 3 + 4 species profiles |
| `src/rules/skill/phase.ts` (new) | a creature's phase (approach, wind-up, release, recovery, stagger) from `Fight` and `sitUntil` |
| `src/rules/skill/poise.ts` (new) | poise, stagger and daze; poise kept on the creature as an optional field (`src/rules/creatures.ts`, 748 lines: room for one line). Letters stay one hit; `src/rules/invites.ts#love` only reports the hit to poise, through an optional hook so `game.ts` needn't grow. |
| `src/rules/combat/` (where speed is set) | a staggered creature holds still; a dazed one moves at `daze.speed` (the exact file not checked) |
| `src/rules/combat/release.ts` | sit after release from the profile, in place of the hare-only sit |
| `src/rules/commands/command.ts`, `actions.ts` (new) | the press, target choice, pip spend, cooldowns; the four actions |
| `src/rules/leash.ts#LeashControls` | `command?: boolean` (Controls extends it, so `src/rules/game.ts`, over 800 lines, is not touched there) |
| `src/rules/buffs.ts` | drain off behind the switch; `addPip` gives perBerry up to the species' max; `cooldownOf` for the view |
| `config/bindings.json`, `src/platform/input.ts`, `src/ui/touch.ts` (+ its HTML) | square/F/middle = command; circle = use; circle no longer dodges |
| `src/render/leash/pipCharges.ts` (new) | the pips' brightness and blink from cooldown state, called from one line in `src/render/leash/stack.ts` |
| `src/render/openCue.ts` (new) | the amber outline and poise arc |

**One builder-session risk:**

- Calling the new commands from the game step means touching `src/rules/game.ts` (1343 lines, ratchet: it may not grow). The builder should call `stepCommands` from where `stepSigilButton` is called, by moving an existing line or two into a helper.
- The stack's draw function may already be over 150 lines (not checked). The pip change should be one replaced expression.
- No module state: cooldowns live on the witch or creature, never in a module-level map (`docs/notes/guardrails.md`, **No new module state**). The existing `WeakMap` cache in `src/rules/buffs.ts` is derived and recomputed each step, and is not a model.

**Tests:**

- `skill/poise.test.ts`: every letter is still exactly one hit; a poise break cancels a wind-up and staggers; sit and stagger hold still; daze slows.
- `commands/command.test.ts`: a berry gives perBerry charges, capped at the level's max; a berry on a full youth evolves it; a legend never runs out but waits its longer cooldown; a buff-giver's use starts its buff period; cooldowns differ by species; spends one pip; cooldown and gap; youth fizzles; berry within 5 m eats instead; targeting order in both modes.
- `buffs.test.ts`: no drain under the switch; buff off at 0 pips.
- `bindings`: square/circle mapping.
- Plus `npm run typecheck`, lint, `size.mjs`, `loops.mjs`, `moduleState.mjs`.

**What Ed looks at in play** (the preview; both are on by default now):

1. Fight a hare: after its stamp it sits still with an amber outline, and nearly every letter thrown then lands.
2. Fight a badger: three or four letters during its crouch break its poise. It wobbles in place, and the barge never comes.
3. Put a fed adult fox at the bottom of the stack and press square at a dormouse. Wisps fly, one pip goes out, and the pip that will be spent next blinks through its cooldown.
4. Bring the bee to the bottom with R1 and press square several times: a machine gun of quick speed bursts, each a pip. Then cycle to the badger for one big barge.
5. Within 15 m of a berry, with a creature that has room, square eats. Further away, or with a full creature, square commands.
6. Circle places; L2 dodges; circle no longer dodges.

## 6. Still open (Ed, 2026-11-17: "we can explore this in design and balancing")

Ed answered the first ten questions on 2026-11-17; they are in **Already decided**, items 11 to 13. What is left to explore in design and play, not to ask as questions yet:

1. Which creatures give buffs, and each one's `buffTime` and `buffStacks`.
2. Every species' settings across the catalogue: its openings, its command at each level, its charges and cooldowns. This is design and balance in data (Ed, 2026-11-17).
3. Which creatures show intent marks: engaging her, or near her, and when.
4. How the outline cue reads on every sprite and at night.
