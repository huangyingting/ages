# Content guide

All content is bilingual TypeScript data in `src/shared/data`. After editing, run `npm test`: the data tests check ids, references, coordinates, translations, curriculum tags and stories.

## Add an event
Add an `ev({...})` entry to the file for its period (`events-early.ts` up to the Han, `events-middle.ts` up to the Qing, `events-modern.ts` after 1840):
```ts
ev({ id: 'zhenghe', y: 1405, end: 1433, k: 'diplomacy', at: 'nanjing', w: 1, m: 'junk', c: 'g7b.3 hs1.4',
  who: [['郑和', 'Zheng He']],
  t: ['郑和下西洋', 'Voyages of Zheng He'],
  s: ['1405年至1433年，郑和率船队七次远航……', 'Between 1405 and 1433 Zheng He led seven voyages…'],
  p: [['1405—1433年七次', 'seven voyages, 1405–1433']],
  wiki: ['郑和下西洋', 'Ming treasure voyages'] }),
```
| Field | Meaning |
|---|---|
| `id` | unique, snake_case; used in links (`#e=zhenghe`) |
| `y`, `end` | years; negative = BCE (−221 = 221 BCE) |
| `k` | prehistory, politics, war, reform, culture, science, economy, diplomacy, revolution |
| `at` | a place id from `places.ts` or `[lon, lat]` |
| `w` | importance: 1 = textbook headline (pin label visible at every zoom), 2 = key, 3 = supporting (label only when zoomed in) |
| `c` | textbook units: `g7a` 七上, `g7b` 七下, `g8a` 八上, `g8b` 八下, `hs1` 纲要上, then `.unit`; see `curriculum.ts` |
| `m` | model kind (see `MODEL_KINDS` in `event-kit.ts`) or a recipe like `{ kind: 'flag', color: '#c0392b' }` |
| `t`, `s`, `p`, `who` | title, one-paragraph summary, key points (考点), people as `[zh, en]` pairs |
| `wiki` | article titles on zh / en Wikipedia (either may be empty; the reader follows interlanguage links) |

Keep summaries to two or three sentences in textbook terms. Key points should be the facts an exam would ask about.

## Add a story
Add an entry keyed by the event id to `STORIES` in `stories.ts`. Use the helpers `fly()`, `year()`, `cap()` and `lbl()` and the step types listed in [architecture](architecture/architecture.md#story-dsl). Tips:
* Start with `year()` and `fly()`, and alternate action steps with short captions (one idea each).
* Use `par: true` to run an army and a caption together.
* Keep a story under about 40 s at 1×, and end on the outcome caption.

## Add or fix a territory snapshot
Snapshots in `territories.ts` are listed in time order. `year` is when the map starts to apply, and `title` names the year the outline depicts. Regions paint in order, so put large polities first and carve neighbours after them. Use `hatch: true` for occupied areas and a `label` point when the centroid falls in a bad place. Outlines are deliberately simplified (about 10–40 points per ring), so trace them from a textbook map at small scale.

## Places
`places.ts` defines cities and sites with period names (`names: [[from, to, zh, en]]`) and capital periods (`capital: [[from, to]]`). Labels pick the name valid in the current year.

## Models
Builders live in `src/client/models/build-ancient.ts` and `build-modern.ts`. A builder receives a root `THREE.Group` and the recipe, and composes primitives from `kit.ts`. To animate a part, name its node `spin`, `flap`, `sway`, `bob`, `flicker` or `smoke`. Register the kind in `MODEL_KINDS`. The model unit test builds every kind.

## Sensitive content
Follow the textbook framing. Borders are schematic and the disclaimer must stay visible. Do not add contemporary political leaders to the timeline readout.
