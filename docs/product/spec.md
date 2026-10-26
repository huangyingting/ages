# Product spec (phase 1: Chinese history)

## Audience and goal
Chinese middle-school (grades 7–8, 统编版 textbooks) and high-school students (《中外历史纲要（上）》), plus their teachers. They should be able to **see** history in space and time: where and when an event happened, what the country looked like then, and how events connect. The app helps students review exam points (考点) rather than replacing the textbook.

## Principles
1. **The map is the hero.** The first screen is the map with a few lines of text on it (headline, period figures, key, timeline); everything deeper opens on demand in the left side panel or a popover under the toolbar ([layout](../design/map-design.md#8-layout)); the card unfolds its Wikipedia article sideways. A vermilion accent, cut-corner controls; the panel slides away during animations, and the camera re-frames itself around it.
2. **Animations that show something.** A flagship event has a scripted animation, and battles get an automatic march and clash. Play is offered only for these; events whose automatic story would just orbit the camera have no Play button.
3. **Bilingual everywhere.** All content and UI strings carry `{ zh, en }`, and switching language never reloads the page.
4. **Textbook-aligned.** Each event lists its textbook units, and the course picker mirrors the books' unit structure.
5. **Honest about uncertainty.** Borders are schematic and labelled as such, and early dates carry "c." / "约".
6. **Light and offline-friendly.** The app is a static site and installable; a service worker keeps it working offline after the first visit. Only the Wikipedia reader (and finer terrain, music) needs the network, and it fails gracefully without it.

## Features (phase 1)

Compact map icons, including geographical locations, share a 22 px diameter. Hover and focus change only their ring,
not their size or text decoration.

| Area | Behaviour |
|---|---|
| Scene | 3D terrain relief of East Asia, territory overlay with crossfades and borders repainted crisply for the area in view when zoomed in (modern maps traced from the official provincial outlines), polity labels, period place, river and lake names (a modern name is never printed before it was in use; shifted Yellow River courses and vanished lakes show only in their years), one label type scale ([typography](../design/typography.md)), finer terrain relief streamed in close up, models and labels that grow as you zoom in, a capital model in its period's architecture (Erlitou halls, Zhou terraces, Qin–Han que palace, Tang Hanyuan Hall, Song Xuande Gate, Yuan Dadu, the Forbidden City, then a monument); dynasty people, buildings, customs, foods and event landmarks use one of two forms: compact circular marker or model with a thin type-coloured base ring. Importance controls display priority, and models and labels share screen-space avoidance; only geographical names remain on the map. Clickable names have a small circular location anchor, replaced by their model's base ring; name and model share one tooltip, card and selection ring. Related event pins step aside, and geographical cards retain dynasty-specific background and reading links. Hover or keyboard focus shows a short tooltip and gentle highlight; hovering a territory names its polity, role and area; click, tap, Enter or Space opens the card directly. Selection persists through zoom and takes priority over surrounding content. Routes, trails and rings are painted on the map as unbroken lines and perfect circles that hills never cut; pan / rotate / zoom (mouse, touch, keyboard) |
| Timeline | Non-linear axis about 1 Ma → today; era bands (click opens the era card); territorial-phase ticks; dots for all 907 events with tooltips; a faint stepped curve of the dynasty's territorial area per phase; floating year flag with reign era; drag, click, arrow keys (Shift ±10), auto-play at 0.5× / 1× / 2×; ‹ › step between events and phases — the buttons sit in one row with the bar (on phones in one row with the phase line, above the bar). Its readout is the map's headline (top left): era, the year, reign; the realm's area and largest polities sit top right |
| Chronicle | 本时期大事 section of the period details, listing the dynasty's events (all / textbook filter); current year highlighted and auto-scrolled; ▶ scripted story |
| Period details | 时期详情 popover (opened from the 时期详情 button in the top-right toolbar or the phase line): phase i/N with step bars, years, capital, area, phase note, every coexisting polity with its area (hover highlights, click flies); line key on the map's lower left; previous phase drawn as a dashed ghost border; borders grow from the old ones when the phase changes |
| Event card | Info panel with a live 3D model preview (turntable); category, year, place, importance, watched status; summary; key points; people; textbook units; prev/next; share link; Play; Wikipedia; mark as learned |
| Era card | Era summary, capital, dates and length, prev/next era, Wikipedia, territorial overview, the era's people, buildings, customs and foods (its events are in the chronicle beside it) |
| Stories | Scripted steps (fly, year, caption, army, route, build, spawn, fx, highlight); every route, campaign, fleet and journey is drawn with one route stroke (weight, dashed and dimmed variants only) and follows one timing standard ([map design](../design/map-design.md)); pause, skip, speed (1× / 1.5× / 2× / 0.75×), narration, stop; captions bilingual |
| Battles | `clash` steps stage two armies on a battlefield decal with camps: troop types (foot, horse, archer, chariot, gun, mixed) equipped by era (bronze chariots and ge, Qin crossbows, Tang/Song lamellar, Mongol horse archers, Ming/Qing firearms, modern rifles), formations (横阵 line, 长蛇阵 column, 锋矢阵 wedge, 鹤翼阵 wings, 方阵 square, 圆阵 circle) with archers in the rear and cavalry on the flanks, arrow volleys, muzzle flashes, trebuchets or cannon and a gate in sieges, a rout and fires; camera shots (wide, low, close, top, side, shake) via the `shot` step and an automatic low → push-in → crane sequence |
| Costumes | People are dressed for their era (Shang/Zhou robes, Qin–Han armour and caps, Tang futou, Song/Ming official dress, Qing queue and mandarin hat, Republic suits and uniforms) |
| Wikipedia reader | unfolds beside the card (the W button or ‹ folds it back; on phones it takes the card's place); zh-CN / en switch; lead, then every section as headings and paragraphs (nothing folded), image, reading time; licence line; offline / missing states |
| Learn | Books → units → events with progress bars; opening an event stacks its card over the textbook |
| Quiz | History mode: 9 questions per round from the chosen book: when / where (map click, graded by km) / order; best score saved. Ancient-places mode: 10 period place names to find on the map with labels hidden, 0–100 points by distance and a final rank. Every answer is revealed on the map |
| Search | Events, eras and places, matched in both languages; `/` focuses |
| Menus | Hub (study: learn, quiz; journeys) and Settings (map style paper / ink / plain, layers, guqin music, full screen, quality 高画质 / 省电流畅 saved per device, language, help); zoom by wheel or pinch |
| Layers | Territory, place names, event pins, 3D models |
| Help | Controls, the timeline hint, category legend, the border disclaimer (not on the map), credits, phase 2 note |
| Deep links | `#e=`, `#y=`, `#p=`, `#person=`, `#life=`, `#j=`, `#lesson=`, `&lang=`, also as query parameters (kept up to date as you browse, so the address bar is always shareable) |

## Acceptance criteria
* The app boots to an interactive map on desktop (1440×900) and phone (Pixel 7) with no console errors.
* Switching 中/EN updates the UI, labels, cards and URL at once, and the choice persists across reloads.
* Search → event card → Play shows captions and story effects; Space pauses and resumes, and Stop restores the card.
* Scrubbing the timeline changes the year readout and the territory snapshot. Deep links open the right year or event.
* The Wikipedia reader shows the lead in both languages, hides reference sections, and shows a retry message offline.
* After one visit the app reloads offline; the card's share button copies its deep link.
* The quiz can be completed with a full score, and the course picker shows progress after "Learned".
* On phones the event card is a full-width bottom sheet above the timeline, and the selected place stays visible above it; on landscape phones (short screens) the panel takes the full height.

All of these are covered by `tests/e2e/app.spec.ts`.

## Out of scope for phase 1
World history, user accounts or cloud sync, teacher dashboards, editing content in the app.
