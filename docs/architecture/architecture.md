# Architecture and data model

## Overview
```
index.html ── src/client/main.ts (App: wiring, deep links, keyboard, test hooks)
                 │
   ┌─────────────┼───────────────────────────┬──────────────────────────┐
   ▼             ▼                           ▼                          ▼
scene/atlas.ts  story/player.ts            ui/*                       lib/*
 ├ view.ts      runs StoryStep[] against   timeline, card, reader,    i18n (UI strings, lang state)
 ├ terrain.ts   the Atlas (fly, year,      learn, quiz, caption,      wikipedia (MediaWiki client)
 ├ territory.ts caption, army, route,      searchbox, menus, dom      storage (progress), link, speech
 ├ labels.ts    build, spawn, fx…)
 ├ fx.ts
 └ models/* (Web Worker baking)
                 ▲
src/shared/data + src/shared/lib  (pure TS: content + logic, unit-tested, no DOM)
```
* **`src/shared`** has no DOM or three.js imports. It holds the bilingual content and pure logic (timeline axis, search, quiz), which runs unchanged in Vitest and in Node scripts.
* **`src/client/scene`** owns three.js. `Atlas` composes the scene and exposes a small API: `setYear`, `select`, `flyTo`, `setLayer`, `setLang`, `highlight`, `setPickMode`. The story player and UI only talk to that API.
* **`src/client/ui`** is plain DOM built with a tiny `h()` helper. There is no framework. Each component has `el`, a `render()`/`relabel()` and callbacks.

## Stage and projection
`stage.ts` defines the geographic window (lon 66–146°E, lat 0–56°N for East Asia), the terrain file and the home camera. World units are degrees of latitude: `x = (lon − lon0)·cos φ0`, `z = −(lat − lat0)`, with φ0 = 34° so shapes look right in the middle of the map. Heights are exaggerated (×18) on land and flattened under water. `Geo` (`scene/geo.ts`) converts lon/lat to world positions, samples terrain height, and picks lon/lat from a ray.

## Terrain
`scripts/fetch-terrain.ts` downloads AWS Terrain Tiles (Terrarium encoding) for the stage, resamples them from Web Mercator to an equirectangular grid, and writes the 16-bit elevation (R,G) and an ocean/river mask (B) as a lossless WebP (`public/data/terrain/east-asia.webp`). At runtime `terrain.ts` builds a displaced grid mesh with a custom shader that adds hypsometric tint, hillshade, snow, ocean depth, coastline and the territory overlay. The shader writes sRGB directly.

**Close-up detail.** The base grid is about 5.5 km per pixel. When the camera is close (distance ≤ 26) and has stopped moving, `scene/detail.ts` asks a worker (`detail.worker.ts`) for the area in view. The worker fetches Terrarium tiles at a zoom that matches the screen (z5–12, at most 42 tiles, with an LRU cache) and resamples them to a 1024² equirectangular half-float height grid. The shader blends that grid's hillshade and tint into the box, fading out at the edges. Only shading changes: vertex heights stay on the base grid, so models and map ink sit where they did. The feature is off with `?lowfx=1`, and offline it falls back to the base relief.

**Zoom scaling.** Map models (scenery, base and event models) keep a constant screen size when far away and grow as the camera closes in (`mapScale` in `fx.ts`); story and battle models keep a constant screen size so camera shots frame them the same way. Labels grow through the `--lz` CSS variable (see [typography](../design/typography.md)).

## Territories
`territories.ts` lists **snapshots**. Each snapshot is a dated map: its `year` is the first year it applies (usually a dynasty's start) and its title names the year the outline depicts. A snapshot holds ordered **regions**: polity id, rings of `[lon, lat]`, an optional label point and name override, and `hatch` for occupied land. `territory.ts` paints a snapshot into a canvas texture (fills, hatches, inner borders and soft edges). The atlas crossfades between two textures when the snapshot changes. That stage-wide texture is about 4 km per pixel, so close to the ground `territory-detail.ts` repaints the current snapshot for just the area in view (2048² for a box of about ±0.8 × camera distance) once the camera settles, with thin crisp border lines; the terrain shader blends it over the base texture and fills coastal slivers where an outline and the land mask disagree. It is dropped the moment the base snapshot changes, so stale borders never show. The 1937–45 and PRC maps take their geometry from the shape store: the PRC is the union of the official provincial outlines, and Mongolia and the 1940 occupied area are clipped against it so shared borders coincide. `polities.ts` gives each polity a name, colour, role (`main` / `rival` / `neighbor` / `occupied`) and Wikipedia titles. `scripts/compute-areas.ts` (`npm run data:areas`) measures every snapshot once (rings unioned, or XORed for even-odd regions, in an equal-area projection) into `gen/areas.json`: each polity's area and the dynasty's realm (`main` + `protectorate`, plus the Zhou vassals and warring states before 221 BC). `areas.ts` serves them to the year headline, the legend and the timeline's area curve without decoding geometry at runtime.

## Events
`HistEvent` (see `types.ts`) has: id, year/end, kind, lon/lat (or a place id), weight 1–3, bilingual title, summary, key points, people, curriculum refs, a model recipe, Wikipedia titles, and an optional story. Events are written with the compact `ev()` helper in `event-kit.ts` and split by period into `events-early.ts`, `events-middle.ts` and `events-modern.ts`. `events.ts` merges them and builds `EVENT` (id → event).

## Story DSL
A story is plain data, `StoryStep[]`:

| Step | Effect |
|---|---|
| `fly` | camera flight to lon/lat/dist/tilt |
| `year` | moves the timeline (and the territory map) |
| `caption` | bilingual caption, waits a reading time; narration if enabled |
| `army` | a 3D formation (`unit`: foot / horse / mixed) marches along `pts` (or a bowed from→to arc), raising dust and leaving a trail; `follow` keeps the camera on it, `keep` leaves the trail, `retreat` reverses it |
| `clash` | two formations charge from opposite sides (`angle` = side A comes from, clockwise from west) and fight with sparks and dust |
| `fleet` | a line of ships with wakes sails a sea or river route |
| `wipe` | changes the year with a glowing front that spreads the new territory map outwards from a point (conquest, unification) |
| `title` | cinematic title plaque centred over the scene (no letterbox bars) |
| `shot` | camera shot on a battlefield: `wide`, `low`, `close`, `top`, `side` or `shake` |
| `banner` | a 3D-anchored banner over a place (name + subtitle), e.g. a city falling or a capital founded |
| `orbit` | slow camera orbit around the current target |
| `route` | progressive dashed/solid route, optionally carrying a model (ship, camel, train) |
| `build` | wall (segments and towers rise), canal or railway drawn along a path |
| `spawn` | a model rises from the ground with a shadow and label |
| `fx` | battle / fire / smoke / glow / flag / firework particles |
| `highlight` | pulses a polity's territory |
| `wait` | pause |

Steps run in order, and `par: true` starts a step without waiting for it. `storyOf(e)` returns the scripted story or `autoStory(e)`, which stages a title, then by kind a march and clash (wars), a flag and banner (revolutions) or a model and orbit, then the caption. `journeyStory(j)` turns each of the 43 journeys (the seven from jiangshan-map — 秦始皇, 张骞, 诸葛亮, 玄奘, 李白, 苏轼, 王阳明 — plus 36 curated ones in `journeys.ts`, so every era has travellers) into a story: the traveller crosses the map stop by stop, with a banner, a description and a quote at each stop. Campaigns march an army; otherwise a `traveller` model is dressed for the role and year (张骞 as a Han envoy holding the 节 with a pack camel, 玄奘 as a pilgrim monk on foot under a bamboo 笈, 苏轼 on a donkey …). Each leg leaves a brush-stroke trail (a shader ribbon with a dark rim, soft shadow and flowing paper dashes) ending in a barbed arrowhead on the stop. `StoryPlayer` runs on the Fx story clock, so pause and speed affect everything. Skip completes the running tweens, and Stop clears the story layer.

Only events with a real animation offer Play: `hasStory(e)` is true for a scripted story or an automatic one that moves something on the map (`route`, `build`, `army`, `clash`, `fleet`, `wipe`, `highlight` — in practice the wars). Automatic stories that would only fly and orbit the camera are not offered (409 of 928 events keep Play).

## Dynasty scenery
`sceneryOf(era)` (`shared/data/scenery.ts`) picks what stands on the map for the current dynasty. First come the era's curated life items (`shared/data/life.ts`): for every China dynasty its representative people (holding a period prop: brush, sword, fan, pipa…; women in court or armoured dress), buildings, customs and foods, each with a detailed hero model (packs `life-arch1/2`, `life-custom1/2`, `life-food`), a bilingual description and a Wikipedia title. Tier 1 items show at any zoom; tier 2 items (`fx.spawn` `maxD`) stand up only once the camera is zoomed in. They take their true spot or the nearest free spot on a ring around it, at least 1.1° apart. Then come landmark models of the era's key non-war textbook events (buildings, works, ships, inventions; banners, armies and plain scrolls are skipped, as are ones a life item already shows), at most 6, and the first person of its events dressed by role and period (`personModel`, `bare` so they stand without the card plinth), at most 4 and never someone already standing; these keep 1.5° from everything and from the capital's palace. `Atlas.updateScenery` spawns them on the Fx `scenery` layer, keyed by era and language and tied to the 3D models layer. They carry no name plates: each model is registered as a map object (see *Map objects: hover and selection*) and opens the person card or the life card (`Card.showLife`: model, category, dynasty, map and Wikipedia buttons, the rest of the era's life; deep link `#life=<id>`); a landmark opens its event. The era card lists the era's buildings, customs and foods too. A landmark steps aside while its event is selected (the event's own model rises in its place), and the whole layer hides while a story plays (`setStoryMode`).

## Models
## Map objects: hover and selection
Models and icons on the map work the same way, after pocket-planet's globe. `Atlas` keeps a registry of *marks*: every scenery model, the capital's palace and the selected event's model, each with a key (`life:<id>`, `person:<id>`, `event:<id>`, `capital:<id>`), a glyph, a lazily translated title and subtitle, and an `open()` action. `fx.spawn` exposes each model's live state in its group's `userData` (`SpawnState`: current height `top`, footprint `rad`, `shown` at this zoom, and a `boost` the model eases towards). On `pointermove` (rAF-throttled, mouse only) `pickMark` projects each live mark's upright extent (base to top) and takes the one whose segment passes nearest the pointer (reach ≈ 0.42 × its screen height, at least 14 px; nearer models win ties). The hovered model grows 18 %, the cursor becomes a pointer, a cyan `Halo` breathes under it and the `.maptip` tooltip (glyph in the category colour, name, subtitle such as `建筑 · 唐`, a person's title or `627 · 政治`) follows its top every frame. A tap or click opens it (before the pin fallback). Event pins are kind-glyph badges (`ui/icons.ts`); hovering or focusing one (selected or not) shows the same tooltip and halo. Every object behaves the same: hover shows the tooltip, the grow and the cyan ring; a click opens its card and moves the vermilion/gold selection `Halo` under it (`Atlas.focus(key, at)`; `select(e)` focuses the event; with no live mark, e.g. a place label or an object not yet built, the ring sits at `at`). Opening a place or scenery item also flies the camera there, so cards need no separate map button. With the administrative layer on, `pointermove` over open land sets an `{ area, at }` hover that names the prefecture in the same `.maptip` (no glyph, no halo); there is no second tooltip. Nothing else marks a selection: the selected pin just stays lit, with no title pill or pulse. A pin steps aside while a model on the map stands for its event (its landmark, a scenery item that is the same thing, e.g. 赵州桥 via `lifeEvent()`, or the selected event's own model), so one thing is never drawn twice; such a scenery card links to its event under 相关史事. Likewise a person in the people index who also stands on the map as a scenery item has one card: `openPerson` redirects to the scenery card, which then shows lifespan, journey and events. `scene/halo.ts` draws a pocket-planet ring (soft disc, crisp ring, expanding pulse) from flat ring geometry at the object's foot. Hover is off while a story plays or a quiz waits for a map click.

**Design system.** The display, interaction, line and animation rules are in [map design](../design/map-design.md). In code:
- every map model is spawned with a `ring` in its type colour (`KIND_COLOR` in `atlas.ts`, which matches the `.k-*` CSS glyph colours);
- scenery importance sets layout priority (`LEVEL_PRIORITY`), not a separate visual language. `MapTarget` unifies place names, compact markers and models through `bindTarget`; `lifePlace` joins geographical landmarks to a single place destination. Only geographical names accompany models;
- `layoutMarks` runs after the FX update, projecting model bounds into the shared `scene/layout.ts` collision pass. Selected objects come first, followed by the main territory name, models and optional labels. Compact and model forms are mutually exclusive, and transparent model keyboard targets do not intercept map gestures;
- the capital's model comes from `capitalModel(era)` (`shared/data/heroes.ts`), each capital city as its own palace (hero pack `capitals`; one model per subject, see map-design §7);
- `route`, `army`, `fleet` and journeys all draw the one route stroke, `trailArrow`, with only the `StrokeOpts` variants weight, dashed and dim;
- `build` and the works layer share one style table (`WORK`);
- story marks follow the `RISE` / `HOLD` / `FADE` timing constants.

**Map ink.** Routes, journey trails, works lines (canals, roads, sea routes), arrows, glow rings, base rings, battlefields and halos are *map ink* (`scene/ink.ts`): they draw right after the terrain (`INK` render orders, terrain −9, ink −8…−1) with no depth test, alpha-blended in the opaque pass. Hills therefore never nick their shapes, so rings stay perfect circles and lines stay unbroken; 3D models draw afterwards with depth testing and still stand on top.

Models are procedural. `models/kit.ts` has primitives (boxes, cylinders, lathe shapes, roofs) and shared materials. `rich.ts` and `rich2.ts` contain the builders of the 42 `MODEL_KINDS` (registered in `kit.ts`), and the lazily loaded hero packs in `models/heroes/` hold the detailed one-off models (`hero: '<pack>/<name>'`). `build.worker.ts` bakes geometry in a Web Worker and `pack.ts` transfers it as typed arrays. `library.ts` caches one prototype per recipe and hands out clones. Named nodes (`spin`, `flap`, `sway`, `bob`, `flicker`, `smoke`) are animated by `scene/animate.ts`.

## Labels
Labels are HTML elements projected every frame (`scene/labels.ts`). Each has a priority, distance range, anchor and group. A greedy pass hides labels that would overlap a more important one. Groups (places, polity, pins, story, base, scenery) map to the Layers menu. Styles: event pins are round badges with the event kind's glyph on a hairline stem (dark lacquer on the ink map, ivory on the light maps; they light up in the kind colour on hover and stay lit while selected; titles show in the map tooltip); the capital has a small vermilion seal before its name; walls, canals, roads and sea routes are italic cartographic lettering in the work's colour between short rules (dashed for walls and sea routes); 3D models have no plates, their names show in the map tooltip.

## i18n
Content carries `I18n = { zh, en }`. UI strings live in `client/lib/i18n.ts`. `setLang` persists the choice, sets `<html lang>` and notifies listeners, and every component re-renders its text in place. The language comes from the link, then the saved choice, then the browser.

## Wikipedia
`client/lib/wikipedia.ts` calls the MediaWiki action API (`origin=*`, `prop=extracts|pageimages|description`, `explaintext`, `variant=zh-cn`). If an item has no title in the requested language it follows interlanguage links from the other wiki. Responses are cached per session, and failures aren't cached so Retry works. All text is inserted with `textContent`.

## View insets
The side panel (`ui/panel.ts`) floats on the left between the headline and the line key (lesson, quiz, card stacked as views); the card hosts the reader (`ui/reader.ts`), which unfolds to its right and widens the panel; on phones the panel is a bottom sheet above the timeline. `App.updateInset()` measures it (and sets `--lt` / `--lb` / `--lb-read`, the panel's top and bottom limits, the last one above the phase line for the wide reading panel) and calls `View.setInset(left, right, bottom)`, which shifts the projection centre with `camera.setViewOffset`. Every flight and story frames its subject in the visible area, with no per-call maths. During stories the panel hides and the inset eases back to zero.

## Persistence
Persistence uses `localStorage` with the `ages:` prefix: language (`lang`), last year (`year`), map style (`surface`), rendering quality (`quality`), the hub tab (`hubTab`), the chronicle filter (`chCore`), the music track (`track`), the chosen book (`book`), and progress (`watched`, `learned`, `quizBest`, per-lesson `lessons` scores). There is no backend.

**Offline.** Production builds register a service worker (`src/client/sw.js`, written to `dist/sw.js` by the `serviceWorker` plugin in `vite.config.ts`). At install it precaches the shell and every build file — all eras' model packs, the workers, the terrain and the shape store — so after one visit the whole atlas works offline; `public/manifest.webmanifest` makes it installable. Each build gets a new cache version (a hash of the output), and the old cache is dropped on activation. Cross-origin requests (Wikipedia, fine terrain tiles, music) are left to the network.

## Testing
* **Vitest** (`tests/unit`): data integrity (ids, references, coordinates inside the stage, bilingual completeness, curriculum refs, story steps, snapshot order), timeline/search/quiz logic, and that every model kind builds.
* **Playwright** (`tests/e2e`): boot and language, search and card, story playback and controls, timeline and deep links, Wikipedia (mocked, plus offline), quiz to full score, course picker and lesson, journeys and their links, offline reload through the service worker, the share button and the quality setting, load and GPU failure screens, mobile layout. Tests drive the app through the UI and read `window.__atlas.state()`.
