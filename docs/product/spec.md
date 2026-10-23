# Product spec (phase 1: Chinese history)

## Audience and goal
Chinese middle-school (grades 7–8, 统编版 textbooks) and high-school students (《中外历史纲要（上）》), plus their teachers. They should be able to **see** history in space and time: where and when an event happened, what the country looked like then, and how events connect. The app helps students review exam points (考点) rather than replacing the textbook.

## Principles
1. **The map is the hero.** UI chrome is small and translucent, and stays at the edges. Panels slide away during animations, and the camera re-frames itself around open panels.
2. **Every event can be watched.** A flagship event has a scripted animation; every other event gets an automatic fly-in, model and caption.
3. **Bilingual everywhere.** All content and UI strings carry `{ zh, en }`, and switching language never reloads the page.
4. **Textbook-aligned.** Each event lists its textbook units, and the Learn drawer mirrors the books' unit structure.
5. **Honest about uncertainty.** Borders are schematic and labelled as such, and early dates carry "c." / "约".
6. **Light and offline-friendly.** The app is a static site. Only the Wikipedia reader needs the network, and it fails gracefully without it.

## Features (phase 1)
| Area | Behaviour |
|---|---|
| Scene | 3D terrain relief of East Asia, territory overlay with crossfades, polity labels, period place names, capital marker model, event pins; pan / rotate / zoom (mouse, touch, keyboard) |
| Timeline | Non-linear axis about 1 Ma → today; age headings; era bands (click opens the era card); event dots with tooltips; drag, click, arrow keys, auto-play; readout shows year, era and ruler |
| Event card | Category, year, place, importance, watched status; summary; key points; people; textbook units; prev/next; Play animation; Wikipedia; mark as learned |
| Era card | Era summary, dates, capital, prev/next era, Wikipedia, list of its events |
| Stories | Scripted steps (fly, year, caption, army, route, build, spawn, fx, highlight); pause, skip, speed (1× / 1.5× / 2× / 0.75×), narration, stop; captions bilingual |
| Wikipedia reader | zh-CN / en switch; lead, sections, image, reading time; licence line; offline / missing states |
| Learn | Books → units → events with progress bars; opening an event closes the drawer on phones |
| Quiz | 9 questions per round from the chosen book: when / where (map click, graded by km) / order; every answer is revealed on the map; best score saved |
| Search | Events, eras and places, matched in both languages; `/` focuses |
| Layers | Territory, place names, event pins, 3D models |
| Help | Controls, category legend, disclaimer, credits, phase 2 note |
| Deep links | `#e=`, `#y=`, `&lang=` (kept up to date as you browse, so the address bar is always shareable) |

## Acceptance criteria
* The app boots to an interactive map on desktop (1440×900) and phone (Pixel 7) with no console errors.
* Switching 中/EN updates the UI, labels, cards and URL at once, and the choice persists across reloads.
* Search → event card → Play animation shows captions and story effects; Space pauses and resumes, and Stop restores the card.
* Scrubbing the timeline changes the year readout and the territory snapshot. Deep links open the right year or event.
* The Wikipedia reader shows the lead in both languages, hides reference sections, and shows a retry message offline.
* The quiz can be completed with a full score, and the Learn drawer shows progress after "Learned".
* On phones the event card is a bottom sheet above the timeline, and the selected place stays visible above it.

All of these are covered by `tests/e2e/app.spec.ts`.

## Out of scope for phase 1
World history, user accounts or cloud sync, teacher dashboards, editing content in the app.
