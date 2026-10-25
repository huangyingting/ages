# Map design system

One set of rules for everything drawn on the map: what is shown, how it looks, how it responds and how it moves. The
model is the sister project *pocket-planet*: every item on its globe is one procedural model of its type, standing on a
plinth ring in its type colour, revealed by zoom tier, with one tooltip, one card and one selection mark. Ages applies
the same discipline to a history atlas, where the year decides what stands on the map.

The rules, in short:

1. **One object, one destination.** A model or a compact marker represents an object. Its geographical name, if needed, belongs to that same object, not a second entry.
2. **One look per kind.** Every model stands in a ring of its type colour. Every moving thing is drawn with the same route stroke. Every label follows the [type scale](typography.md).
3. **One behaviour.** Hovering shows the tooltip. Clicking opens the card and adds a selection ring.
4. **The period shows through.** Names, buildings, dress, troop kit and capitals all belong to the year on the timeline.

## 1. Layers

**Light.** One warm, low sun from the north-west lights the relief; slopes facing it warm up, slopes away cool down.
Territory colour is multiplied by that same light rather than laid over it, so mountains read through every polity.
A vignette darkens the screen edges (stronger in the ink style, none in plain). The ink style is the dark theme: its
panels turn dark with light text, so map and interface share one key.

From the ground up (`scene/ink.ts` `INK` orders, then depth-tested models, then the HTML label layer):

| # | Layer | Contents | Notes |
|---|---|---|---|
| 1 | Terrain | relief, water, finer relief streamed in close up | `terrain.ts`, `detail.ts` |
| 2 | Territory | polity fills lit by the relief beneath, borders with a pale rim under the line, the previous phase dashed | crossfades between phases |
| 3 | Works | walls (3D), canals, roads, sea routes | one style table, `WORK` in `fx.ts` |
| 4 | Map ink | route strokes, arrowheads, base rings, selection ring, battlefields | painted flat on the map: no depth test, so hills never cut them |
| 5 | Models | capital, dynasty scenery, event models, story actors | depth-tested and stand on top of the ink |
| 6 | Labels | polities, places, rivers, admin areas, works, pins | HTML, decluttered by priority |
| 7 | UI | tooltip, then one right-hand column (header, card, period panel or textbook, reader, quiz) and the bottom timeline | nothing else floats over the map |

## 2. What stands on the map

| Content | Shown as | Type colour | When |
|---|---|---|---|
| Capital of the year | period capital model (below) and a capital label | `#b8322a` | at every zoom, subject to layout |
| Dynasty people | figure in period dress or compact marker | `#b8322a` | by importance and available screen space |
| Buildings and landmarks | landmark model or compact marker | `#7d5a32` | same |
| Customs | scene model or compact marker | `#2c6e5c` | same |
| Foods | dish model or compact marker | `#b4652a` | same |
| Events | kind-glyph pin | kind colour | weight 1 always; weight 2 within distance 75; others within 38; all subject to layout |
| Selected event | its existing landmark, or an event model if none stands for it | `#7d5a32` | while selected |
| Clickable places | circular location icon and name; a model's base ring replaces the icon | see typography | by tier and zoom |
| Works | line and italic label | water blue, road brown, wall stone | the works layer |

**Two forms, one interaction.** The compact form is a round kind glyph, without a stem, glow or second dot. The
expanded form is a model. Both use the same `MapTarget` interaction path. There is no intermediate dot state.
Only geographical names remain on the map; people, events, customs and foods introduce themselves in the tooltip.
Plain river, polity and administrative text is not styled as a button.
All compact icons, including geographical locations and capitals without models, share a 22 px diameter. Their size
stays fixed when hovered or focused; only the ring changes. Text is never underlined. Every place name has the same
size and weight (13 px, 600) in a solid category colour without a halo; tier changes only when a name appears.

**Importance sets priority, not name plates.** `sceneryOf` retains three priority levels, but they no longer dictate
three different appearances or sizes. Up to six representative items are given leading priority; this is not a quota
of visible names. The capital and leading items can use models at the home view. Other items expand within camera
distance 40, with a 2-unit hysteresis band to prevent flickering. Detail items enter within distance 45. Every item is
still subject to screen-space layout. Selected objects bypass the zoom and collision filters, but not layer controls.

**Shared space budget.** `layoutMarks` projects actual model bounds, including rotation, base and shadow, reserving its hover size as well.
`scene/layout.ts` places selected content first, the main territory name next, then models in importance order, and
finally optional text and compact markers. Essential geographic context is not sacrificed to decorative scenery.
Attached names share their model's identity, sit above its projected bounds, and disappear if the model is culled.
Unrelated labels cannot cover a model. A crowded lower-priority model is hidden as a whole; zooming in reveals it again.
Invisible keyboard targets follow visible models without reserving extra space.

**Replacement rules (no duplicates):**
- A model and its compact marker never appear simultaneously.
- `lifePlace` joins curated landmarks to geographical entries (泰山, 赵州桥). The name and model open the same place card;
  that card includes the dynasty-specific description, model and reading link as well as the place's existing history.
- A related event pin steps aside for this object, including in compact form. Selecting its event reuses the landmark
  instead of adding another model.
- Nearby but distinct people and events remain separate objects, subject to the same collision layout.


**Base standard.** Every map model stands on a soft contact shadow inside a thin ring of its type colour. The ring is `spawn({ ring })` in `fx.ts`, with colours from `KIND_COLOR` in `atlas.ts`, which match the `.k-*` tooltip glyphs in `styles.css`.
- The ring is map ink, so it is always a perfect circle.
- Its size follows the model's footprint, clamped so that small figures and large dioramas read as the same class of object.
- Only geographical names accompany models. There are no independent model name plates.

**Zoom.** Map models keep a constant screen size when far away and grow as you close in (`mapScale`). Story actors keep a constant screen size so camera shots frame them the same way. Labels grow through `--lz`.

## 3. Interaction

| Gesture | Result |
|---|---|
| Hover or keyboard focus on a model, marker or clickable name | one tooltip and one highlighted ring; models may grow gently ×1.06, compact icons and text stay unchanged |
| Hover over open land | the same tooltip names the polity under the pointer, with its role and area (with the admin layer on: the administrative area) |
| Click, tap, Enter or Space on a focused object | opens the card directly; the object gets one selection ring, with no second name plate or hover ring. An open **event** also gets a soft light beam rising from its ring (`Beam` in `halo.ts`): the ring's colour, faded from the ground up, fading in and out with the ring and never pulsing, so the one open event can be found from afar |
| Esc | closes the card and clears the selection |

The model's transparent keyboard target does not intercept map dragging. When its geographical name is visible, only
the name is in the tab order. Place text uses semantic buttons with a circular anchor; passive map annotations do not.
Compact icons highlight their own circular border; models use a ground ring. They never show both highlights at once.
Hover and selection use a thin circle and faint tint, with no repeating pulses.
While a story plays, the dynasty scenery steps aside and map-object activation is suspended.

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
| Borders change | moving to the next territorial phase **grows** the borders instead of cross-fading: each changed spot switches in order of its distance from where its new owner already stood (`morph.ts`), so a conqueror spreads out from its old border over 1.4 s. Layer toggles cross-fade (0.8 s); a story's conquest front (`wipeTo`) sweeps from a point |

## 6. Period specificity

The map should look like its period, not like a generic China:

- **Names:**
  - places, rivers and lakes carry the name used in the year shown (`mapName`, `riverName`);
  - a modern name never appears before it was in use;
  - shifted river courses and vanished lakes appear only in their years.
- **Capital:** each capital city stands as its own palace (`capitalModel` in `shared/data/heroes.ts`):

  | Era | Model | Subject |
  |---|---|---|
  | Xia | `cap_erlitou` | Erlitou Palace No. 1 |
  | Shang | `cap_yinxu` | the Yinxu palace-temple zone at Anyang |
  | Western Zhou | `cap_zhou` | the Fengchu courtyard on rammed earth |
  | Eastern Zhou | `cap_luoyi` | Luoyi, with the six-horse royal chariot pit |
  | Qin | `cap_xianyang` | Xianyang Palace No. 1 |
  | Western Han, Xin | `cap_qinhan` | the Weiyang front hall at Chang'an |
  | Eastern Han | `cap_luoyang` | Eastern Han Luoyang |
  | Western Jin | `cap_taiji` | the Taiji Hall of Wei–Jin Luoyang |
  | Eastern Jin | `cap_jiankang` | the palace city of Jiankang |
  | Sui, Tang | `cap_tang` | the Hanyuan Hall of Chang'an |
  | Northern Song | `cap_song` | the Xuande Gate of Kaifeng |
  | Southern Song | `cap_linan` | Lin'an on Phoenix Hill |
  | Yuan | `cap_yuan` | the Daming Hall of Dadu |
  | Ming, Qing | `asia/forbidden` | the Forbidden City |
  | ROC | `cap_nanjing_roc` | the Presidential Palace in Nanjing |
  | PRC | `monument` | the Monument to the People's Heroes |

  Periods without a single capital show a generic period hall on their era card only.

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
   - It stands on the shared `plinth()` (`prims.ts`): one bevelled disc with the same dark walnut side (`PLINTH_SIDE`) for every model, its top in a muted site tone from `SITE` (loess, earth, paving, stone, grass, sand, water, snow…).
   - Trees come from the shared `tree()`: natural leaf clumps and Chinese layered pines, never lollipops or cone firs.
   - Architecture is flat-shaded; organic forms (bodies, pottery, hills, canopies) are smooth.
3. **Reads from the map camera.**
   - A clear silhouette from a high oblique view.
   - Detail kept to what reads at map size.
   - No hairline props: anything thinner than about 0.25 head-heights becomes a stray line on the map.
4. **Keeps a triangle budget** close to the existing models of its class.
5. **Shares one colour grade.** `kit.ts` grades every baked colour once (`gradeColor`): saturation eased, greens pulled toward olive and sage, near-whites turned to warm plaster, the darkest tones lifted. Together with the baked ambient occlusion, this gives every model the same museum-miniature look whatever palette its author used.
6. **Is checked in the gallery** (`gallery.html?k=…`) next to its neighbours, so a family looks like a family.
7. **Belongs to one subject.** A model stands for exactly one place, building, event or thing. A landmark of one city is never reused for another (Shenzhen is not the Lujiazui skyline, Lhasa in 641 is not the 17th-century Potala), and a period's map never shows the same model twice. Generic kinds tell their subjects apart with a `style` (`factory: soviet | oil | joint | jiangnan`, `bridge: hongqiao | lugou` …) or a dedicated hero (`heroes/sites-*.ts`). The data test "gives every subject its own model" enforces this for the map, capitals and stories.
8. **Is realistic, not a toy.** Ages is a history atlas, so models are faithful miniatures:
   - **People** are about 7 heads tall (`figure.ts`, `human.ts`), with small eyes, no blush and no cartoon highlights.
   - **Proportions and form** follow the reference: storey counts, plan shape (square, octagonal, dodecagonal), roof type (庑殿, 歇山, 攒尖, 卷棚), bay counts, bracket depth, bridge span and the shape of each vessel.
   - **Materials and colour** come from the real object: rammed earth, grey brick, weathered timber, vermilion only on columns and walls that were painted, green-grey glazed tile (yellow only for imperial buildings from the Ming on), bronze patina, celadon, iron, undyed hemp and indigo cloth. There are no candy colours, no rainbow crowds and no cartoon clouds.
   - **No anachronisms.** Nothing appears before its time: chef's toques, modern clothes in ancient scenes, chairs before the Song, blue-and-white before the Yuan, or later rebuilds standing in for the original.
   - **Scale inside a diorama is consistent.** People, doors, steps and trees keep their real ratios to the building; a person is about one storey high, not half of it.
   - **Ground matches the site:** loess, paving, grass, sand or water as it is there, without decorative props that were never present.
