# Roadmap

## Phase 2: world history
The data model already carries a `scope` (`'china' | 'world'`) on events and territory snapshots, and the stage, projection and terrain asset are parameterised (`src/shared/data/stage.ts`). Phase 2 plans:

1. **World stage**: a second stage (equirectangular or globe) with its own terrain asset fetched by `scripts/fetch-terrain.ts`, chosen via a stage switcher. The China stage stays the default for phase 1 content.
2. **World events and snapshots** for 《中外历史纲要（下）》 and 九年级 world history. These include ancient civilisations, the classical empires, the age of exploration, revolutions, industrialisation, the world wars and the Cold War.
3. **Parallel timelines**: China and world lanes side by side on one axis, so students can compare (for example, Zheng He and Columbus).
4. **Cross-links** from Chinese events to world events (the Opium War and the industrial revolution, the Silk Road and Rome).
5. More model builders (pyramids, Parthenon, caravel, steam engine), reusing the model kit.

## Later ideas
* Teacher mode: build a lesson as an ordered playlist of events and stories; share it as a link.
* Classroom display mode (large captions, auto-advance).
* Spaced-repetition review of key points.
* Narration with recorded audio instead of Web Speech.
* Optional sync of progress across devices.
