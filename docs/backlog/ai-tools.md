# AI tools for solo game developers (to come back to)

**Not built; a reading list.** Ed, 2026-11-17: "Put these URLs in the backlog and we'll come back to them." From a post (18 tools, by use case). None has been opened or licence-checked yet: the cloud sessions couldn't reach them. Several are non-commercial; check each licence before using anything in the game.

## The coordinator's first read (from the descriptions only)

Worth a look:
1. [gykim80/andrew_game_perf](https://github.com/gykim80/andrew_game_perf): finds and fixes 10 frame-drop patterns in AI-generated game code (three.js, PixiJS, Phaser, React). Use as a checklist: a builder reviews our render code against the 10 patterns and reports, with Frame check numbers before and after any fix.
2. [achrefelouafi/LinearAbiltyCastingThreeJS](https://github.com/achrefelouafi/LinearAbiltyCastingThreeJS): a League-of-Legends-style skill-shot sandbox with hand-written shader effects. A study reference for crisp shots, impacts and cues (letters are skill shots; see `docs/plans/combat-skill-and-commands.md`).
3. [Friedrich-M/UniMate](https://github.com/Friedrich-M/UniMate): text-to-animation across skeletons (humans, quadrupeds, birds, snakes). Our gaits are code (`art/mesh/kit/gaits.js`), so reference only.

Probably not a fit (the game's look is drawn by code; no external assets, engines or DCC tools):
- Asset generators: [OpenDCAI/GameFactory-3A](https://github.com/OpenDCAI/GameFactory-3A), [scenario-labs/skills](https://github.com/scenario-labs/skills), [lovisdotio/video-to-game](https://github.com/lovisdotio/video-to-game) (needs a fal API key), [viettranx/3dviz-pro-max](https://github.com/viettranx/3dviz-pro-max), [aldegad/sprite-gen](https://github.com/aldegad/sprite-gen), [MaxLiu22/Motion2MixamoRig](https://github.com/MaxLiu22/Motion2MixamoRig).
- Engine and DCC skills: [Unity-Technologies/skills](https://github.com/Unity-Technologies/skills), [EL4CTEO/blender-skills](https://github.com/EL4CTEO/blender-skills).
- Pixel clean-up: [handsupmin/mono-pix](https://github.com/handsupmin/mono-pix) (our pixel art is rendered, not AI-drawn).
- Agent kits and guides, likely little over our own notes: [eremes81/game-design-ai-practice](https://github.com/eremes81/game-design-ai-practice) (combat, balance, level design chapters), [dudwns0921/claude-gamedev-kit](https://github.com/dudwns0921/claude-gamedev-kit), [majidmanzarpour/threejs-game-skills](https://github.com/majidmanzarpour/threejs-game-skills), [MengTo/Skills](https://github.com/MengTo/Skills) (combat animations, monster systems, playtesting).
- Examples: [boona13/mykonos-island-voxels](https://github.com/boona13/mykonos-island-voxels) (a click-to-stack build system), [alchaincyf/3d-vibe-coding-handbook](https://github.com/alchaincyf/3d-vibe-coding-handbook) (386 pages, Chinese: image-to-3D, retopology, rigging; an index by symptom).
