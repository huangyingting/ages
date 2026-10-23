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
`scripts/fetch-terrain.ts` downloads AWS Terrain Tiles (Terrarium encoding) for the stage, resamples them from Web Mercator to an equirectangular grid, and writes a 16-bit-in-RGB PNG (`public/data/terrain/east-asia.png`). At runtime `terrain.ts` builds a displaced grid mesh with a custom shader that adds hypsometric tint, hillshade, snow, ocean depth, coastline and the territory overlay. The shader writes sRGB directly.

## Territories
`territories.ts` lists **snapshots**. Each snapshot is a dated map: its `year` is the first year it applies (usually a dynasty's start) and its title names the year the outline depicts. A snapshot holds ordered **regions**: polity id, rings of `[lon, lat]`, an optional label point and name override, and `hatch` for occupied land. `territory.ts` paints a snapshot into a canvas texture (fills, hatches, inner borders and soft edges). The atlas crossfades between two textures when the snapshot changes. `polities.ts` gives each polity a name, colour, role (`main` / `rival` / `neighbor` / `occupied`) and Wikipedia titles.

## Events
`HistEvent` (see `types.ts`) has: id, year/end, kind, lon/lat (or a place id), weight 1–3, bilingual title, summary, key points, people, curriculum refs, a model recipe, Wikipedia titles, and an optional story. Events are written with the compact `ev()` helper in `event-kit.ts` and split by period into `events-early.ts`, `events-middle.ts` and `events-modern.ts`. `events.ts` merges them and builds `EVENT` (id → event).

## Story DSL
A story is plain data, `StoryStep[]`:

| Step | Effect |
|---|---|
| `fly` | camera flight to lon/lat/dist/tilt |
| `year` | moves the timeline (and the territory map) |
| `caption` | bilingual caption, waits a reading time; narration if enabled |
| `army` | bowed campaign arrow with a marching formation and banner |
| `route` | progressive dashed/solid route, optionally carrying a model (ship, camel, train) |
| `build` | wall (segments and towers rise), canal or railway drawn along a path |
| `spawn` | a model rises from the ground with a shadow and label |
| `fx` | battle / fire / smoke / glow / flag / firework particles |
| `highlight` | pulses a polity's territory |
| `wait` | pause |

Steps run in order, and `par: true` starts a step without waiting for it. `storyOf(e)` returns the scripted story or `autoStory(e)`. `StoryPlayer` runs on the Fx story clock, so pause and speed affect everything. Skip completes the running tweens, and Stop clears the story layer.

## Models
Models are procedural. `models/kit.ts` has primitives (boxes, cylinders, lathe shapes, roofs) and shared materials. `build-ancient.ts` and `build-modern.ts` contain the builders (41 kinds). `build.worker.ts` bakes geometry in a Web Worker and `pack.ts` transfers it as typed arrays. `library.ts` caches one prototype per recipe and hands out clones. Named nodes (`spin`, `flap`, `sway`, `bob`, `flicker`, `smoke`) are animated by `scene/animate.ts`.

## Labels
Labels are HTML elements projected every frame (`scene/labels.ts`). Each has a priority, distance range, anchor and group. A greedy pass hides labels that would overlap a more important one. Groups (places, polity, pins, story, base) map to the Layers menu.

## i18n
Content carries `I18n = { zh, en }`. UI strings live in `client/lib/i18n.ts`. `setLang` persists the choice, sets `<html lang>` and notifies listeners, and every component re-renders its text in place. The language comes from the link, then the saved choice, then the browser.

## Wikipedia
`client/lib/wikipedia.ts` calls the MediaWiki action API (`origin=*`, `prop=extracts|pageimages|description`, `explaintext`, `variant=zh-cn`). If an item has no title in the requested language it follows interlanguage links from the other wiki. Responses are cached per session, and failures aren't cached so Retry works. All text is inserted with `textContent`.

## View insets
The card, reader and drawer cover parts of the screen. `App.updateInset()` measures them and calls `View.setInset(left, right, bottom)`, which shifts the projection centre with `camera.setViewOffset`. Every flight and story frames its subject in the visible area, with no per-call maths. During stories the panels hide and the inset eases back to zero.

## Persistence
Persistence uses `localStorage` with the `shanhe:` prefix: language, last year, chosen book, and progress (watched, learned, best quiz score). There is no backend.

## Testing
* **Vitest** (`tests/unit`): data integrity (ids, references, coordinates inside the stage, bilingual completeness, curriculum refs, story steps, snapshot order), timeline/search/quiz logic, and that every model kind builds.
* **Playwright** (`tests/e2e`): boot and language, search and card, story playback and controls, timeline and deep links, Wikipedia (mocked, plus offline), quiz to full score, learn drawer, mobile layout. Tests drive the app through the UI and read `window.__atlas.state()`.
