# Architecture decision records

### ADR-001 · TypeScript + Vite + three.js, no UI framework
**Context:** The app is a single scene plus a handful of small panels, and the reference project (Terrastra) uses the same stack successfully.
**Decision:** Use TypeScript (strict), Vite and three.js. Build UI components with a 20-line `h()` helper instead of React/Vue.
**Consequences:** The bundle is small, the render loop has no reconciliation overhead, and components re-render their own DOM explicitly (`render()` / `relabel()`).

### ADR-002 · Shared/client split
**Decision:** Content and logic live in `src/shared` with no DOM or three.js imports. The client imports them.
**Consequences:** Data integrity, quiz generation, search and the timeline axis are unit-tested in plain Node. Phase 2 content can be authored and validated the same way.

### ADR-003 · A real terrain relief, precomputed to one PNG
**Context:** A flat political map is what jiangshan-map already offers. Mountains, plateaus and rivers explain much of Chinese history (the Hexi Corridor, the Qinling–Huaihe line, the Sichuan basin).
**Decision:** Fetch open elevation tiles once with `scripts/fetch-terrain.ts`, resample them to the stage grid and ship a single PNG (about 2.8 MB) that is shaded in a custom shader.
**Consequences:** No tile server at runtime, and the app works offline. Changing the stage window means re-running the script.

### ADR-004 · Territories as dated snapshots painted to a texture
**Alternatives:** per-year vector morphing, or extruded 3D polygons.
**Decision:** Use hand-simplified outlines per period. Each applies from its dynasty's start, is painted to a canvas and is draped on the terrain with a crossfade.
**Consequences:** Borders follow the relief exactly and look good at every zoom, and authoring stays simple (lists of lon/lat). Borders are schematic, and the app says so.

### ADR-005 · Procedural models built in Web Workers
**Decision:** Following Terrastra, build every model from primitives in code (41 builders). Bake geometry in a worker pool, transfer it as typed arrays and cache one prototype per recipe.
**Consequences:** There are no binary assets or licences to track, and models share materials and a consistent style. Spawn and despawn animate scale rather than opacity because materials are shared.

### ADR-006 · Stories as data (StoryStep DSL)
**Decision:** Animations are arrays of plain steps interpreted by `StoryPlayer` against the Atlas API. They are not imperative code.
**Consequences:** Stories are bilingual, unit-testable (coordinates inside the stage, known polities, known model kinds) and editable by content authors. One story clock drives pause, skip and speed for everything.

### ADR-007 · Bilingual by construction
**Decision:** Every content string is `{ zh, en }`, UI strings live in one dictionary, and the language switches live, with listeners, without a reload.
**Consequences:** Unit tests can enforce completeness, and adding a language later means adding a key to `I18n`.

### ADR-008 · Wikipedia from the browser, not bundled
**Decision:** Fetch extracts on demand from the public MediaWiki API (CORS via `origin=*`), cache them per session, show attribution and the licence, and fall back through interlanguage links.
**Consequences:** There is no server and no copied content to keep current. The reader needs the network and handles offline and missing articles explicitly. Text is always inserted with `textContent`.

### ADR-009 · Camera view insets instead of per-panel layout maths
**Decision:** Shift the projection centre (`camera.setViewOffset`) by half the width or height of whatever panel covers the screen, and ease it.
**Consequences:** Every flight and story keeps its subject visible next to the card, reader or drawer, or above the phone bottom sheet, without touching story coordinates.

### ADR-010 · Hash deep links and localStorage, no backend
**Decision:** The URL hash carries `e`, `y` and `lang` and is updated with `replaceState`. Progress lives in `localStorage`.
**Consequences:** The app can be deployed as a static site and a teacher can share any view as a link. Progress does not sync across devices; that is on the roadmap.
