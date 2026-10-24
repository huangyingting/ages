# Product spec (phase 1: Chinese history)

## Audience and goal
Chinese middle-school (grades 7–8, 统编版 textbooks) and high-school students (《中外历史纲要（上）》), plus their teachers. They should be able to **see** history in space and time: where and when an event happened, what the country looked like then, and how events connect. The app helps students review exam points (考点) rather than replacing the textbook.

## Principles
1. **The map is the hero.** UI chrome is small, stays at the edges and uses a clean modern style: frosted-glass panels, a vermilion accent and foldable chronicle, legend and timeline. Panels slide away during animations, and the camera re-frames itself around open panels.
2. **Animations that show something.** A flagship event has a scripted animation, and battles get an automatic march and clash. Play is offered only for these; events whose automatic story would just orbit the camera have no Play button.
3. **Bilingual everywhere.** All content and UI strings carry `{ zh, en }`, and switching language never reloads the page.
4. **Textbook-aligned.** Each event lists its textbook units, and the Learn drawer mirrors the books' unit structure.
5. **Honest about uncertainty.** Borders are schematic and labelled as such, and early dates carry "c." / "约".
6. **Light and offline-friendly.** The app is a static site. Only the Wikipedia reader needs the network, and it fails gracefully without it.

## Features (phase 1)
| Area | Behaviour |
|---|---|
| Scene | 3D terrain relief of East Asia, territory overlay with crossfades, polity labels, period place, river and lake names (a modern name is never printed before it was in use; shifted Yellow River courses and vanished lakes show only in their years), one label type scale ([typography](../design/typography.md)), finer terrain relief streamed in close up, models and labels that grow as you zoom in, capital marker model, the dynasty's scenery (its representative people, buildings, customs and foods as detailed models with clickable cards, plus landmark models of its key events and more of its people in period dress; detail items appear as you zoom in), event pins as kind-glyph badges; every model and pin shows a tooltip (name and subtitle) on hover, grows with a glowing ground ring, and opens its card on click; the open card's object keeps a selection ring (the only selection mark); a pin hides while a model stands for its event, and a site's name label (e.g. 泰山, 赵州桥) hides while its own model stands there; routes, trails and rings are painted on the map as unbroken lines and perfect circles that hills never cut; pan / rotate / zoom (mouse, touch, keyboard) |
| Timeline | Non-linear axis about 1 Ma → today; age headings; era bands (click opens the era card); territorial-phase ticks; dots for all 907 events with tooltips; floating year flag with reign era; ‹ year › stepper with typed years (1415 / -221 / 前221 / 221 BC); drag, click, arrow keys (Shift ±10), auto-play; readout shows year, era and ruler |
| Chronicle | Right panel listing the dynasty's events (all / textbook filter); current year highlighted and auto-scrolled; ◆ map change, ▶ scripted story; folds to a tab |
| Phase legend | Phase i/N with jump dots, polity chips (hover highlights, click flies), phase note, line key; previous phase drawn as a dashed ghost border |
| Event card | Info panel with a live 3D model preview (turntable); category, year, place, importance, watched status; summary; key points; people; textbook units; prev/next; Play; Wikipedia; mark as learned |
| Era card | Era summary, capital, dates and length, prev/next era, Wikipedia, territorial overview, the era's people, buildings, customs and foods (its events are in the chronicle beside it) |
| Stories | Scripted steps (fly, year, caption, army, route, build, spawn, fx, highlight); pause, skip, speed (1× / 1.5× / 2× / 0.75×), narration, stop; captions bilingual |
| Battles | `clash` steps stage two armies on a battlefield decal with camps: troop types (foot, horse, archer, chariot, gun, mixed) equipped by era (bronze chariots and ge, Qin crossbows, Tang/Song lamellar, Mongol horse archers, Ming/Qing firearms, modern rifles), formations (横阵 line, 长蛇阵 column, 锋矢阵 wedge, 鹤翼阵 wings, 方阵 square, 圆阵 circle) with archers in the rear and cavalry on the flanks, arrow volleys, muzzle flashes, trebuchets or cannon and a gate in sieges, a rout and fires; camera shots (wide, low, close, top, side, shake) via the `shot` step and an automatic low → push-in → crane sequence |
| Costumes | People are dressed for their era (Shang/Zhou robes, Qin–Han armour and caps, Tang futou, Song/Ming official dress, Qing queue and mandarin hat, Republic suits and uniforms) |
| Wikipedia reader | zh-CN / en switch; lead, sections, image, reading time; licence line; offline / missing states |
| Learn | Books → units → events with progress bars; opening an event closes the drawer on phones |
| Quiz | History mode: 9 questions per round from the chosen book: when / where (map click, graded by km) / order; best score saved. Ancient-places mode: 10 period place names to find on the map with labels hidden, 0–100 points by distance and a final rank. Every answer is revealed on the map |
| Search | Events, eras and places, matched in both languages; `/` focuses |
| Menus | Hub (one list: learn, quiz, help, then the journeys) and Settings (map style paper / ink / plain, layers, narration, quality); guqin music toggle and full screen in one cut-corner toolbar (zoom by wheel or pinch); foldable timeline |
| Layers | Territory, place names, event pins, 3D models |
| Help | Controls, category legend, disclaimer, credits, phase 2 note |
| Deep links | `#e=`, `#y=`, `#p=`, `#person=`, `#life=`, `#j=`, `&lang=`, also as query parameters (kept up to date as you browse, so the address bar is always shareable) |

## Acceptance criteria
* The app boots to an interactive map on desktop (1440×900) and phone (Pixel 7) with no console errors.
* Switching 中/EN updates the UI, labels, cards and URL at once, and the choice persists across reloads.
* Search → event card → Play shows captions and story effects; Space pauses and resumes, and Stop restores the card.
* Scrubbing the timeline changes the year readout and the territory snapshot. Deep links open the right year or event.
* The Wikipedia reader shows the lead in both languages, hides reference sections, and shows a retry message offline.
* The quiz can be completed with a full score, and the Learn drawer shows progress after "Learned".
* On phones the event card is a bottom sheet above the timeline, and the selected place stays visible above it.

All of these are covered by `tests/e2e/app.spec.ts`.

## Out of scope for phase 1
World history, user accounts or cloud sync, teacher dashboards, editing content in the app.
