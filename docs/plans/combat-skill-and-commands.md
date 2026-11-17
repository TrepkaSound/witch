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

One idea: **every creature's attack is a loop of four phases**. Approach, wind-up, release, recovery, read from the `Fight` fields above. Four families of numbers act on that loop.

Each number has a **global dial** in tuning. A species changes only what makes it itself, in a small profile. Ten global dials.

**No dial changes what a letter is worth: a hit is a letter** (Ed, 2026-11-17). Every dial either makes a creature easier to hit for a moment, or makes her land more letters. Then `invites.hits` (7 and 14) and `invites.cooldown` (0.55 s) can be rebalanced around the new hit rate.

### Openings: when a creature is easier to hit

| # | Dial (`skill.*`) | Meaning | Range | Default | Shown as |
|---|---|---|---|---|---|
| 1 | `recover.sit` | Seconds a creature holds still after it attacks: its punish window | 0–1.5 | 0.5 | it visibly settles (pose), plus the open cue |
| 2 | `poise.share` | Poise as a share of its meter: letters to break it (youth 7 × 0.4 ≈ 3, adult ≈ 6). Each of those letters still counts one hit on the meter as usual. | 0–1 | 0.4 | a thin arc on its ring, emptying |
| 3 | `poise.stagger` | Seconds it is staggered when poise breaks: it stands still. A break during a wind-up cancels the attack. | 0–2 | 1.0 | a wobble, plus the cue at full |
| 4 | `open.slow` | Its speed while dazed, after a stagger and after a Daze command, as a share of normal | 0–1 | 0.5 for 2 s | the cue, fading |
| 5 | `open.reach` | Extra letter reach on an open creature (today a letter lands within 0.5 m: `config/tuning.json#invites.radius`) | 0–1 m | 0 (off) | none |

- Poise refills 1 s after the last hit, at its full value over 2 s. That is fixed, and not a dial until a playtest says so.
- Holding still and moving slowly make the next letters land; nothing makes them count more.
- **`recover.sit` generalises `hareStamp.sit`.** The hare's 0.8 becomes its species override, and `src/rules/combat/release.ts#c.sitUntil` sets the sit for every species.
- `open.reach` is the one "bigger target" lever. It starts off; question 2 asks whether to have it at all.

### Intent: telegraphing movement

| # | Dial | Meaning | Range | Default | Shown as |
|---|---|---|---|---|---|
| 6 | `intent.lead` | How many seconds ahead a creature's next move is shown | 0–1.2 | 0.6 | a small mark where it will be |
| 7 | `intent.moves` | Which moves are shown: `bound` (hare's hop: landing known at take-off, `src/rules/combat/approach.ts#boundIn`), `lunge` (already shown), `pass` (a waiter's close pass, `src/rules/combatSpacing.ts#waitingDrive`), `dash` (a darting step) | list | `["bound","pass"]` | the same mark |

- A move is shown only when the rules already know where it will end: a bound, a lunge, or a waiter's goal along its path.
- It is never a guess drawn from velocity alone. So it is honest, and it costs nothing to compute.

### Precision: hitting well, not lucky homing

| # | Dial | Meaning | Range | Default | Shown as |
|---|---|---|---|---|---|
| 8 | `aim.help` | One multiplier on homing rate, cone and range, per aiming mode (twin-stick reads `invites.homing*`, single-stick `invites.singleStick`) | 0–1.5 | 1 for both | nothing (feel) |

- Homing picks the nearest invitable creature in its cone (`src/rules/invites.ts#const homing`).
- Bonuses for clean or long hits were in the first draft. They are dropped, because a letter is one hit (Ed, 2026-11-17).
- In single-stick mode homing does the aiming, so openings and commands carry the skill. That fits single-stick being the easier mode.

### Pressure: making "keep moving" not enough

| # | Dial | Meaning | Range | Default | Shown as |
|---|---|---|---|---|---|
| 9 | `pressure.cutoff` | Share of a team's waiters that set their waiting place ahead of her heading, not round her | 0–1 | 0.3 | (their movement) |
| 10 | `pressure.lead` | Scales how far attacks lead her (`config/tuning.json#dodge.a.lead`, `#ranged.lead`, both 1 today) | 0.5–1.5 | 1 | (their aim) |

Reused, not new: `dodge.a.tokens` (how many strike at once) and `dodge.a.width` (lane widths) stay as they are.

### Commands (section 3) add three dials

`command.cooldown` (6 s per creature), `command.gap` (1 s between any two commands) and `command.power` (1, a multiplier on every command's numbers).

Per species, the profile sets its action's size (small, ordinary or big), and that gives two numbers per level, by how big, long or strong the action is (Ed, 2026-11-17: "up to ~12, and Berries could give 3-6 charges each, all depending on how big/long/strong the action is"):

- `command.max`: the most charges it holds. It replaces `buffs.pips.max` (5).
- `command.perBerry`: how many charges one berry gives, 3 to 6.

Each level has a stronger action and more charges (Ed, 2026-11-17).

- **Strength by level** reuses the grammar's own growth: the adult's attack is the young one grown (`src/rules/attacks/species.ts#adultOf`), and the legend's is exaggerated (`#legendOf`).
- **The charge bar replaces growth for youths.** Feeding a youth fills its bar. One more berry on a full bar makes it an adult.
  - Berries to grow up become about ceil(youth max / per berry) + 1: 3 in every row below. Today it is about 4 for a youth of normal strength (`src/rules/berries.ts#toEvolve`, `config/tuning.json#berries.cost`).
  - So `berries.cost` stops deciding growth.

| Action size | Examples | Youth (holds / per berry) | Adult | Legend |
|---|---|---|---|---|
| small, quick | Bonk, Snipe, Buzz, Spit | 8 / 4 | 12 / 6 | 16 |
| ordinary | most Strikes, Snares, Daze | 6 / 3 | 9 / 4 | 12 |
| big, long | the Guards that throw, Pack call, Lift, Mend, Whirlpool | 4 / 3 | 6 / 3 | 9 |

Legends never eat (`src/rules/berries.ts#feedRoom`; Ed, 2026-10-04: legends are never grown). How a legend's charges come back is question 6.

### What it replaces, reuses, extends

| Existing | Becomes |
|---|---|
| `config/tuning.json#hareStamp.sit` | the hare's `recover.sit` override (0.8) |
| `src/rules/invites.ts#love` (`I.amount`) | unchanged: a letter is one hit (Ed, 2026-11-17) |
| `config/tuning.json#invites.radius` | kept, plus `open.reach` on an open creature (off at first) |
| `config/tuning.json#buffs.pips.max`, `#buffs.pips.life` | replaced by each species' `command.max` and `perBerry`; life no longer used |
| `config/tuning.json#invites.homing`, `#homingCone`, `#homingRange`, `#invites.singleStick` | kept, scaled by `aim.help` |
| `config/tuning.json#dodge.a.lead`, `#ranged.lead` | kept, scaled by `pressure.lead` |
| `src/rules/combatSpacing.ts#waitingSlot` | extended: cutoff places for `pressure.cutoff` of waiters |
| `src/rules/buffs.ts#drainPips` | removed: pips are spent by commands only (Ed, 2026-11-17) |
| `src/rules/combat/hits.ts` taunt (`combat.taunt`) | reused by the defend commands |
| `src/rules/attacks/combatWorld.ts#speciesSpell` | reused: an attack command casts the species' own grammar attack |

### A species profile

Profiles live in a new `config/combat-skill.json`, next to `config/species-attacks.json`: one sparse entry per species, with only what differs from the globals.

```json
{
  "global": { "recover": { "sit": 0.5 }, "poise": { "share": 0.4, "stagger": 1 }, "open": { "slow": 0.5, "slowTime": 2, "reach": 0 },
              "intent": { "lead": 0.6, "moves": ["bound", "pass"] } },
  "species": {
    "hare":     { "recover": { "sit": 0.8 }, "intent": { "moves": ["bound"] }, "command": "stamp", "size": "ordinary" },
    "badger":   { "poise": { "share": 0.6 }, "recover": { "sit": 0.9 }, "command": "barge", "size": "big" },
    "dormouse": { "recover": { "sit": 0.2 }, "poise": { "share": 0.25 }, "command": "snipe", "size": "small" }
  }
}
```

Home island profiles (the home kinds are `src/rules/rosters.ts#homeKinds`: hedgehog, squirrel, hare, fox, bee, stoat, mole, snail, dormouse, badger):

| Species | Its character | Sit after attacking | Poise | Intent | Action size |
|---|---|---|---|---|---|
| hedgehog | slow, prickly | 1.0 (curled, rolling back) | 0.6 | none | big |
| squirrel | lobber, darts in trees | 0.3 | 0.3 | pass | small |
| hare | fast hopper | 0.8 (today's) | 0.3 | bound | ordinary |
| fox | curving wisp | 0.5 | 0.4 | pass | ordinary |
| bee | quick double sting | 0.3 | 0.2 | dash | small |
| stoat | longest lunge | 1.0 (it overshoots) | 0.4 | lunge (already shown) | ordinary |
| mole | heave from below | 0.8 (surfaced) | 0.5 | none | ordinary |
| snail | slime zone | 0 (it's slow anyway) | 0.8 | none | big |
| dormouse | fast seed | 0.2 | 0.25 | pass | small |
| badger | shoulder-barge | 0.9 | 0.6 | lunge | big |

## 2. Readability

**The open cue: one look for every species.**

- A thin ring of her magic's warm amber on the ground under the creature, the same amber as the active buff icon (`src/render/leash/stack.ts`, `AMBER`). It is faint during a wind-up, where enough letters can break its poise. It is bright while the creature sits still or is staggered, and fades while it's dazed.
- Colour grammar (Ed, 2026-11-03: "the forest is cold, the party is warm"):
  - warnings are the attacker's element colour (the trial, `src/render/leash/attackLook.ts#danger`) or red;
  - what's hers is warm.
  - An opening is an opportunity for her, so it is warm and never red. It also stays clear of the element colours, which mean "danger to you".
- The poise arc rides on the creature's existing meter ring as a thin outer band, so there is no new object. A break flashes it white.
- **No stars for a creature's stagger:** three circling stars mean she is slowed (`src/render/herEffects.ts#HER_EFFECTS`). A staggered creature wobbles, with its amber ring at full.

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
3. **The treetop cycle on square goes.** R1/L1 cover it on the pad, and touch keeps it on Sigil. Followers travel quietly while she's aloft (`config/travel.json#posse`), so a command there would have no one to act. Square in the treetops does nothing; that's question 7.
4. **"Near a berry" needs a smaller reach than 15 m.** Areas have 10–16 berries (`config/tuning.json#berries.perArea`). At 15 m, square would turn into eat in a large part of every fight, and the command would be unreliable.
   - The proposal is a separate `command.eatReach` of 5 m: she must stand by the bush.
   - Square eats only when the bottom creature has room (`src/rules/berries.ts#hasRoom`). A full creature always commands.
   - The existing feed tag over the berry (`src/render/feedTag.ts`) keeps showing exactly what the press will do. Question 4.

### Charges: the berry pips

- **Charges are pips.** Today a berry gives an adult one pip, up to 5 (`src/rules/buffs.ts#addPip`). Under this plan a berry gives `perBerry` pips (3 to 6), up to the species' `max` (6 to 12; see section 1). A command spends one.
  - So feeding is a reload of several shots, and the queued-berry glint lights that many empty pips.
  - Up to 12 pips need more room: today's row is 4 dots a row (`config/tuning.json#leash.ranks.dotsPerRow`). At 6 a row, 12 make two rows, the same height as a youth's dots. Question 10 offers a number instead.
  - A fresh adult starts with 1 pip, as today (`config/tuning.json#buffs.pips.start`).
- **Pips do not drain** (Ed, 2026-11-17). `drainPips` goes, and `buffs.pips.life` stops meaning time.
- **Buffs.** An adult's group buff stays on while it has at least one pip (as today, `src/rules/buffs.ts#buffsOf`: `pipFuel > 0`).
  - Spending its last charge switches its passive buff off until she feeds it again.
  - So every press is a choice: spend now for a tactical action, or keep one pip to hold the buff. Question 3 offers the alternative, buffs always on.
- **Cooldown.** Each creature has its own `command.cooldown` (6 s), plus a short shared `command.gap` (1 s).
  - The shared gap stops cycling-and-pressing from emptying the whole stack in a second. The per-creature cooldown makes Q mid-fight a real choice.
  - Ed's "a cooldown on how quickly you can use a charge" fits either; question 5 asks which.
- **Shown on the same pips, with no new ring:**
  - **ready**: lit pips steady and bright, as today;
  - **cooling down**: lit pips dimmed to about 45%, and the pip that will be spent next blinks slowly (about 2 Hz, on/off);
  - **ready again**: one bright flash across its lit pips, plus a soft tick sound;
  - **no charges**: all pips dark; its buff icon goes to the existing "unfed" pink twinkle (`src/rules/buffs.ts#IconState`), which already means "feed me".
  - Today's drain twinkle (fast, 9 rad/s, on the last pip) disappears with draining, so there is no clash.
  - The queued-berry glint (`src/render/leash/ranks.ts#queuedDot`) stays: it fills the next empty pip, never a lit one.
- **Youths command too** (Ed, 2026-11-17). Their growth dots (`src/render/leash/ranks.ts#youthDots`) become their charge bar.
  - Full, the bar pulses as a ready-to-grow youth's dots pulse today (`src/render/leash/stack.ts`, `ready`). The next berry evolves it on the next bar line, as now (`src/rules/berries.ts#feed`).
  - **Spending a youth's charges puts off its growing up.** That is a real choice in a fight: use the action now, or save the charges and grow the youth.
  - A flask's growth spurt still makes every follower an adult at once (`src/rules/berries.ts#growthSpurt`). The new adult keeps its charges, up to the adult's max.
- **Babies** have no action: they never fight (`src/rules/combat/targeting.ts#targetable`), so they never command. Square near a berry feeds a baby as before.
- **Legends** (leashed) have the most charges and the strongest action, legend-sized by the grammar (`src/rules/attacks/species.ts#legendOf`).
  - They never eat. Recommended: one charge comes back every 20 s while it follows her (question 6).
  - Their charges show as pips like everyone's. The three buff icons stay as they are.
- **Party legends** don't follow and fight nobody (`src/rules/partyLegend.ts#pinWitch`; Ed, 2026-10-06: "totally useless"). They don't command.

### The command table

Every kind gets an action from one of **five verbs**. That keeps the code small and the actions readable:

- **Strike** (attack): its own grammar attack, cast now at the target with `command.power` × 1.5 damage. It ignores its attack cooldown and the strike token. The blow fills the target's ring as hearts. **Reuses** `src/rules/attacks/combatWorld.ts#speciesSpell`.
- **Daze** (attack/setup): a Strike that also leaves the target slowed (`open.slow`) and showing the open cue for 3 s, so her letters land. It never makes a letter count more (Ed, 2026-11-17).
- **Snare** (control): its attack's own effect (slow, root, stun, throw) on the target, doubled and lengthened. **Reuses** the grammar's effects (`src/rules/attacks/combatWorld.ts`).
- **Guard** (defend): it taunts every wild creature within 10 m for 4 s, or puts a one-blow shield on her for 6 s.
  - The taunt **reuses** `combat.taunt` (`src/rules/combat/hits.ts`).
  - The shield is new: one boolean on her that `src/rules/game.ts#hitWitch` checks.
- **Surge** (buff): its group's buff at 3 stacks for 6 s, or an instant (a dash charge back, one hit healed). **Reuses** `src/rules/buffs.ts` with a timed extra stack.

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
- **Berry economy.** Without draining, pips last until spent. A berry gives 3–6 charges on a 6 s cooldown, so one berry covers about 18–36 s of commanding. A creature full at 12 lasts a long fight. Feeding becomes "reloading", which ties berries to fights as Ed wanted ("something she does deliberately and accurately under time pressure", 2026-11-03).

**Tune first, in this order:**

1. `skill.recover.sit` (0.5): the size of the window.
2. `skill.poise.share` (0.4) and `poise.stagger` (1 s): how often staggers happen, and how long they last.
3. `command.cooldown` (6 s) with `perBerry` and `max`: the command rhythm, and how often she must feed.
4. `skill.aim.help` (1) for twin-stick: how much luck is left.
5. `invites.hits` (7, 14): rebalanced last, against the new hit rate.

## 5. A first prototype slice

Two switches, each off by default and each alone testable:

- `?skill=1`: sit, poise, stagger, daze slow and the open cue, for **hare, badger, dormouse**: the hopper, the bruiser and the sniper. Others are as today.
- `?commands=1`: Ed's bindings, pips as charges with no drain (by level and action size; a youth's bar replacing its growth dots), the blinking cooldown, and commands for **fox (Strike), squirrel (Snare: Bonk), badger (Guard: Barge + taunt), bee (Surge: Buzz)**. That is one per role.

Intent marks, `open.reach`, pressure and the other 60 commands come after Ed has played this.

**Files** (all new files are small; nothing grows past the guardrails):

| File | What |
|---|---|
| `config/tuning.json` `skill`, `commands` + `config/schema/tuning.schema.json` + `config/knobs/army.json` | the dials and switches, with notes |
| `config/combat-skill.json` (new) | the 3 + 4 species profiles |
| `src/rules/skill/phase.ts` (new) | a creature's phase (approach, wind-up, release, recovery, stagger) from `Fight` and `sitUntil` |
| `src/rules/skill/poise.ts` (new) | poise, stagger and daze; poise kept on the creature as an optional field (`src/rules/creatures.ts`, 748 lines: room for one line). Letters stay one hit; `src/rules/invites.ts#love` only reports the hit to poise, through an optional hook so `game.ts` needn't grow. |
| `src/rules/combat/` (where speed is set) | a staggered creature holds still; a dazed one moves at `open.slow` (the exact file not checked) |
| `src/rules/combat/release.ts` | sit after release from the profile, in place of the hare-only sit |
| `src/rules/commands/command.ts`, `actions.ts` (new) | the press, target choice, pip spend, cooldowns; the four actions |
| `src/rules/leash.ts#LeashControls` | `command?: boolean` (Controls extends it, so `src/rules/game.ts`, over 800 lines, is not touched there) |
| `src/rules/buffs.ts` | drain off behind the switch; `addPip` gives perBerry up to the species' max; `cooldownOf` for the view |
| `config/bindings.json`, `src/platform/input.ts`, `src/ui/touch.ts` (+ its HTML) | square/F/middle = command; circle = use; circle no longer dodges |
| `src/render/leash/pipCharges.ts` (new) | the pips' brightness and blink from cooldown state, called from one line in `src/render/leash/stack.ts` |
| `src/render/openCue.ts` (new) | the amber ring and poise arc |

**One builder-session risk:**

- Calling the new commands from the game step means touching `src/rules/game.ts` (1343 lines, ratchet: it may not grow). The builder should call `stepCommands` from where `stepSigilButton` is called, by moving an existing line or two into a helper.
- The stack's draw function may already be over 150 lines (not checked). The pip change should be one replaced expression.
- No module state: cooldowns live on the witch or creature, never in a module-level map (`docs/notes/guardrails.md`, **No new module state**). The existing `WeakMap` cache in `src/rules/buffs.ts` is derived and recomputed each step, and is not a model.

**Tests:**

- `skill/poise.test.ts`: every letter is still exactly one hit; a poise break cancels a wind-up and staggers; sit and stagger hold still; daze slows.
- `commands/command.test.ts`: a berry gives perBerry charges, capped at the level's max; a berry on a full youth evolves it; a legend's charge returns over time; spends one pip; cooldown and gap; youth fizzles; berry within 5 m eats instead; targeting order in both modes.
- `buffs.test.ts`: no drain under the switch; buff off at 0 pips.
- `bindings`: square/circle mapping.
- Plus `npm run typecheck`, lint, `size.mjs`, `loops.mjs`, `moduleState.mjs`.

**What Ed looks at in play** (the preview with `?skill=1&commands=1`):

1. Fight a hare: after its stamp it sits still and glows amber, and nearly every letter thrown then lands.
2. Fight a badger: three or four letters during its crouch break its poise. It wobbles in place, and the barge never comes.
3. Put a fed adult fox at the bottom of the stack and press square at a dormouse. Wisps fly, one pip goes out, and the pip that will be spent next blinks for 6 s.
4. Bring the bee to the bottom with R1 and press square: a speed burst.
5. Stand by a berry with a creature that has room: square eats. Step away: square commands.
6. Circle places; L2 dodges; circle no longer dodges.

## 6. Open questions for Ed

Each has a recommended answer first.

1. **What makes a creature open** (easier to hit)?
   a. All three: it sits still after attacking, it staggers when poise breaks, and it's slowed (dazed) after a stagger or a Daze command (recommended).
   b. Only the sit after attacking.
   c. Only commands (Daze, Snare) make creatures open.
2. **Bigger targets:** should an open creature also be easier to hit by having a wider letter reach (`open.reach`)?
   a. No; holding still and slowing are enough (recommended).
   b. Yes, a little (0.5 m to 1 m) while open.
   c. Try it behind a switch and decide in play.
3. **Buffs and charges:** with draining gone, how should the passive buff relate to the pips?
   a. On while it has at least 1 pip, so spending the last turns it off (recommended: every press is a choice).
   b. Always on for a fed adult, whatever its pips.
   c. Buffs removed; commands replace them.
4. **When square eats:** how close must a berry be for square to eat instead of command?
   a. Within 5 m, and only if the bottom creature has room (recommended).
   b. Within today's 15 m, if it has room.
   c. Never automatically: hold square to eat, tap to command.
5. **Cooldown:** per creature or shared?
   a. Per creature 6 s, plus a 1 s gap between any two commands (recommended: cycling with Q becomes tactical).
   b. One shared cooldown for every command.
   c. Per creature only, no shared gap.
6. **Legends' charges:** legends never eat berries, so how do their charges come back?
   a. One charge every 20 s while it follows her, up to its max (recommended).
   b. Unlimited charges, on a longer cooldown (3 × an adult's).
   c. They come back only when she sleeps; a legend's charges are a night's supply.
7. **Square in the treetops:** what should it do now that it no longer cycles?
   a. Nothing (recommended: R1/L1 cycle, and followers don't fight while she's aloft).
   b. Cycle the stack, as today.
   c. Command anyway (followers would act from where they are).
8. **The open cue's look:**
   a. A warm amber ground ring under the creature, brighter while it's still or staggered (recommended: matches "hers is warm").
   b. A glint or outline on the creature's sprite.
   c. A small mark over its head.
9. **Movement intent marks:** for which moves?
   a. Hops and waiters' close passes only, first (recommended).
   b. Every move whose end the rules know (hops, passes, dashes, charges).
   c. None yet; try openings and commands first.
10. **Showing up to 12 charges** in the sigil bar:
    a. Dots, 6 or 8 a row in two rows, the same height as a youth's dots today; a legend's 16 in two rows of 8 (recommended).
    b. A small number beside the sigil, with one dot that blinks for the cooldown.
    c. Dots in a ring round the sigil.
