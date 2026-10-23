# 山河 Shanhe · 3D Atlas of Chinese History

A bilingual (中文 / English), animated 3D atlas for learning Chinese history at middle-school and high-school level. Drag the timeline from the Stone Age to today and the territory map repaints itself on a real terrain relief. Tap an event to read its key points and the textbook units it belongs to. Press **Play animation** to watch the event unfold: armies march, walls and canals build themselves, and fleets sail across the map. Procedural 3D models (palaces, chariots, treasure ships, steam trains, rockets) mark each event, and Wikipedia sits one click away for background reading.

It is an original 3D re-imagining inspired by [jiangshan-map](https://github.com/DeanChensj/jiangshan-map) and does not reuse its code. **Phase 1** covers Chinese history; **phase 2** will add world history (see [docs/product/roadmap.md](docs/product/roadmap.md)).

| Desktop | Story animation | Mobile |
|---|---|---|
| ![home](docs/assets/screenshots/desktop-home-zh.jpg) | ![story](docs/assets/screenshots/desktop-story-qin.jpg) | ![mobile](docs/assets/screenshots/mobile-event.jpg) |

## Features
* **3D terrain relief** of East Asia, generated from open elevation data, with rivers, coastlines and a parchment colour scheme.
* **Timeline** spanning about 1 million years. It is non-linear, so dense periods get more room, and shows era bands, event dots, age headings, drag/keyboard scrubbing and auto-play. **26 territory snapshots** (Xia → PRC) crossfade as the year changes, and capitals, period place names (长安 / 西安, 汴京 / 开封 …) and polity labels follow the year.
* **151 curriculum events** in eight categories. Each has a bilingual summary, key points (考点), people, location and its units in the textbooks (七年级上/下, 八年级上/下, 高中《中外历史纲要（上）》), plus a procedural 3D model.
* **41 scripted story animations** with camera flights, armies, campaign arrows, walls, canals, railways, ship routes, battles, fireworks and highlighted states. They have bilingual captions, optional narration (Web Speech), pause / skip / speed controls, and the playhead drives the timeline. All other events get an automatic mini-story.
* **41 procedural 3D models** built from primitives in Web Workers, with simple rigs (flags flap, wheels spin, smoke rises).
* **Wikipedia reader** in Chinese (简体) or English: lead, sections, image, reading time and a link to the full article. It falls back through interlanguage links and works offline gracefully.
* **Learn by textbook unit**: a drawer listing the units for each book, with progress (watched / learned).
* **Quiz** with three question types: *when* (pick the year), *where* (click the map; graded by distance) and *order* (sort events). Every answer is revealed on the map.
* **Compact UI**: two small toolbars, a slim timeline and panels that slide away during stories. The camera re-frames itself so the subject is never under a panel. On phones the card becomes a bottom sheet.
* **Shareable deep links**: `#e=<event>`, `#y=<year>`, `&lang=zh|en`.

## Quick start
```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # typecheck + production build → dist/
npm run preview        # serve dist/ on http://localhost:4173
```
The app is fully static: deploy `dist/` to any static host. Only the Wikipedia reader needs network access, and it calls the public MediaWiki API directly from the browser.

## URL flags
| Flag | Effect |
|---|---|
| `?lowfx=1` | low-cost rendering (DPR 1, no antialiasing); useful on old devices and under software GL |
| `#e=<event id>` | open an event, e.g. `#e=zhenghe`, `#e=qin_unify` |
| `#y=<year>` | jump to a year (negative = BCE), e.g. `#y=-221`, `#y=1405` |
| `&lang=zh\|en` | UI and content language (otherwise the saved choice or the browser language) |

## Keyboard
`/` search · `Space` play/pause (story or timeline) · `←`/`→` previous / next event · `Esc` close or stop · on the timeline, arrow keys step through years (`Shift` × 10).

## Tests
```bash
npm run typecheck
npm test               # Vitest: data integrity, timeline/search/quiz logic, model builders
npm run test:e2e       # Playwright (desktop + mobile); see below for headless Linux
npm run test:all
```
WebGL in containers needs a display and SwiftShader. Run `xvfb-run -a npx playwright test`. The e2e suite saves the screenshots in `docs/assets/screenshots/`.

## Project layout
```
src/shared/data     content: eras, polities, territories, places, events, stories, curriculum (all bilingual)
src/shared/lib      pure logic: timeline axis, search, quiz generation
src/client/scene    three.js: view/camera, terrain, territory painter, labels, fx & particles, atlas composition
src/client/models   procedural model kit, builders, Web Worker baking
src/client/story    story player (runs StoryStep scripts)
src/client/ui       DOM components (timeline, card, reader, learn, quiz, caption, menus)
src/client/lib      i18n, Wikipedia client, storage, deep links, speech
scripts/            fetch-terrain.ts (rebuilds public/data/terrain/east-asia.png)
docs/               product spec, roadmap, architecture & ADRs, content guide
```
See [docs/README.md](docs/README.md).

## Content and accuracy
Territory outlines are schematic simplifications of the maps in school textbooks, drawn for teaching and not authoritative boundaries. The app says so in its help panel and footer. Event content follows the national middle-school (统编版) and high-school curricula. Corrections are welcome. See [docs/content-guide.md](docs/content-guide.md).

## Credits
* Elevation: [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Mapzen), derived from SRTM, GMTED2010, ETOPO1 and other public-domain sources.
* Background reading: [Wikipedia](https://www.wikipedia.org/), text under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), fetched live and attributed in the reader.
* Inspiration: [jiangshan-map](https://github.com/DeanChensj/jiangshan-map). Architecture patterns: the Terrastra project (`../pocket-planet`).
