# Map design system

One set of rules for everything drawn on the map: what is shown, how it looks, how it responds and how it moves. The
model is the sister project *pocket-planet*: every item on its globe is one procedural model of its type, standing on a
plinth ring in its type colour, revealed by zoom tier, with one tooltip, one card and one selection mark. Ages applies
the same discipline to a history atlas, where the year decides what stands on the map.

The rules, in short:

1. **One representation per thing.** A thing is shown as a model, a pin or a label. It is never shown as two of them at once.
2. **One look per kind.** Every model stands in a ring of its type colour. Every moving thing is drawn with the same route stroke. Every label follows the [type scale](typography.md).
3. **One behaviour.** Hovering shows the tooltip. Clicking opens the card and adds a selection ring.
4. **The period shows through.** Names, buildings, dress, troop kit and capitals all belong to the year on the timeline.

## 1. Layers

From the ground up (`scene/ink.ts` `INK` orders, then depth-tested models, then the HTML label layer):

| # | Layer | Contents | Notes |
|---|---|---|---|
| 1 | Terrain | relief, water, finer relief streamed in close up | `terrain.ts`, `detail.ts` |
| 2 | Territory | polity fills and borders, the previous phase dashed | crossfades between phases |
| 3 | Works | walls (3D), canals, roads, sea routes | one style table, `WORK` in `fx.ts` |
| 4 | Map ink | route strokes, arrowheads, base rings, selection ring, battlefields | painted flat on the map: no depth test, so hills never cut them |
| 5 | Models | capital, dynasty scenery, event models, story actors | depth-tested and stand on top of the ink |
| 6 | Labels | polities, places, rivers, admin areas, works, pins | HTML, decluttered by priority |
| 7 | UI | tooltip, cards, panels, timeline | |

## 2. What stands on the map

| Content | Shown as | Type colour | When |
|---|---|---|---|
| Capital of the year | period capital model (below) and a capital label | `#b8322a` | always |
| Dynasty people | figure in period dress | `#b8322a` | tier 1 always; tier 2 within distance 32 |
| Buildings and landmarks | landmark model | `#7d5a32` | same tiers |
| Customs | scene model | `#2c6e5c` | same tiers |
| Foods | dish model | `#b4652a` | same tiers |
| Events | kind-glyph pin | kind colour | weight 1 always; weight 2 within distance 75; others within 30–38 |
| Selected event | its model replaces its pin | `#7d5a32` | while selected |
| Places | label only | see typography | by tier and zoom |
| Works | line and italic label | water blue, road brown, wall stone | the works layer |

**Replacement rules (no duplicates):**
- A pin hides while a model stands for its event.
- A site's name label hides while a model of that site stands there (泰山, 赵州桥).
- A landmark yields to its event's own model.
- People stay.

**Base standard.** Every map model stands on a soft contact shadow inside a thin ring of its type colour. The ring is `spawn({ ring })` in `fx.ts`, with colours from `KIND_COLOR` in `atlas.ts`, which match the `.k-*` tooltip glyphs in `styles.css`.
- The ring is map ink, so it is always a perfect circle.
- Its size follows the model's footprint, clamped so that small figures and large dioramas read as the same class of object.
- Models have no name plates. The name is in the tooltip.

**Zoom.** Map models keep a constant screen size when far away and grow as you close in (`mapScale`). Story actors keep a constant screen size so camera shots frame them the same way. Labels grow through `--lz`.

## 3. Interaction

| Gesture | Result |
|---|---|
| Hover over a model or pin | the tooltip (type glyph, name, subtitle) appears, the model grows ×1.18, and a glowing ground ring appears |
| Hover over open land with the admin layer on | the same tooltip names the area |
| Click | opens the card; the object gets the selection ring (the only selection mark) and the camera flies to it |
| Esc | closes the card and clears the selection |

A pin and a model never compete: whichever stands for the event takes the gesture. While a story plays, the dynasty scenery steps aside, and the story owns the map.

## 4. Lines: one route stroke

Everything that moves is drawn with **one stroke** (`trailArrow` in `fx.ts`). This covers journeys, campaigns, fleets, missions and trade.
- **Body:** a brush stroke with a fine dark rim and a soft shadow. It starts slim, like a brush touching paper.
- **Direction:** paper dashes flow along its spine in the direction of travel.
- **Head:** a barbed two-tone dart whose tip lands exactly on the leading point.
- **Width:** constant on screen at every zoom.
- **Colour:** the actor (the dynasty, army or traveller colour), enriched just enough to read on the terrain.

Variants change one property only:

| Variant | Use | Change |
|---|---|---|
| journey (`trail`) | a traveller's legs | weight 1, the traveller walks on from leg to leg |
| route | missions, trade, migrations | weight 0.8 |
| army | campaigns | weight 1.15, troops in formation behind a mounted general and banner |
| retreat | a beaten army falling back | dimmed to 55 % |
| dashed | planned, return or uncertain routes | the body is broken into even dashes |
| fleet | ships in V formation | weight 1, wakes behind the ships |

**Works are not routes.** Walls, canals, roads and sea lanes are infrastructure. They are drawn as static lines, not arrows, using one style per kind (`WORK`). The `build` animation draws a work with exactly the style the permanent works layer uses, so the line a story builds looks the same as the line already on the map.

## 5. Animation standard

| What | Standard |
|---|---|
| Model appears | rises from the ground over `RISE` = 0.7 s with a slight overshoot (easeBack). The shadow and ring grow with it |
| Story marks (route, army, fleet) | grow along their path over the step's `dur`. They then hold for `HOLD` = 3 s (battles 4 s) and fade over `FADE` = 0.8 s, unless `keep` is set |
| Camera | `fly` eases; battle shots (`low`, `close`, `side`, `top`, `shake`) frame the action. Camera moves must serve the content: the play button is shown only for events with a real staged animation, never for a bare camera spin |
| Ambient | figures idle and flags wave; nothing on the map blinks or spins for decoration |
| Story mode | the dynasty scenery hides, and the timeline and map follow the story's year |

## 6. Period specificity

The map should look like its period, not like a generic China:

- **Names:**
  - places, rivers and lakes carry the name used in the year shown (`mapName`, `riverName`);
  - a modern name never appears before it was in use;
  - shifted river courses and vanished lakes appear only in their years.
- **Capital:** one model per architectural period (`capitalModel` in `shared/data/heroes.ts`):

  | Period | Model | Key features |
  |---|---|---|
  | Xia–Shang | `cap_erlitou` | rammed-earth halls with thatched roofs |
  | Zhou | `cap_zhou` | terrace halls |
  | Qin–Han to the Southern and Northern Dynasties | `cap_qinhan` | a terrace palace with que towers |
  | Sui–Tang–Liao | `cap_tang` | the Hanyuan Hall, with flanking pavilions |
  | Song, Western Xia, Jin | `cap_song` | a Xuande-Gate–style gate tower |
  | Yuan | `cap_yuan` | Dadu's 工-shaped hall and a ger |
  | Ming–Qing | `palace` | the Forbidden City hall |
  | ROC and PRC | `monument` | |

- **Dress and arms:**
  - people wear their period's hats and robes (figure toolkit);
  - armies carry their period's kit, troop types and formations.
- **Scenery:** each dynasty shows its own representative people, buildings, customs and foods.
- **Colour:** each dynasty has one colour, used on the timeline, in the legend and on its routes.

## 7. Model standard

Every new or rebuilt model:

1. **Starts from reference images.** Search for the real building, object or costume (Wikimedia Commons, museum or archaeological reconstructions) and record the sources in a comment at the top of its builder.
2. **Follows the builder conventions.**
   - Front faces +z.
   - The footprint fits about ±0.45.
   - It stands on a small low plinth from the shared `ground()` / terrace helpers.
   - It uses flat-shaded low-poly materials from the shared palette.
3. **Reads from the map camera.**
   - A clear silhouette from a high oblique view.
   - Detail kept to what reads at map size.
   - No hairline props: anything thinner than about 0.25 head-heights becomes a stray line on the map.
4. **Keeps a triangle budget** close to the existing models of its class.
5. **Is checked in the gallery** (`gallery.html?k=…`) next to its neighbours, so a family looks like a family.
