# Map typography

Every map label uses one scale, defined as CSS tokens on `.labels` in `src/client/styles.css`. Each property carries one meaning:

| Property | Meaning |
|---|---|
| **Size** | importance (tier) |
| **Weight** | rank inside a category |
| **Colour** | category: settlement, water, relief, admin, work, polity |
| **Letter-spacing** | areal features (rivers, regions, polities) are spread along their extent |
| **Italic** | man-made lines (walls, canals, roads, sea routes), and English river names |
| **Halo** | every label except polities has a thin halo in the background colour, so it reads over any relief |

## Size tokens

| Token | px | Used for |
|---|---|---|
| `--fs-cap` | 14 | capital of the year |
| `--fs-1` | 13 | tier-1 cities, trunk rivers |
| `--fs-2` | 12 | ordinary places, first-level admin areas |
| `--fs-3` | 11 | tier-3 places, rivers and lakes, admin areas, works |
| `--fs-4` | 10.5 | minor sites (shown only close up) |

Polity names are sized by territory area (`s-xl` 26, `s-l` 19, `s-m` 14, `s-s` 12 px) and keep that size at every zoom.

**Zoom.** `scene/labels.ts` sets `--lz = clamp((24 / distance)^0.18, 0.9, 1.3)` in steps of 0.05. Every token above is multiplied by it, so names grow a little as you zoom in and shrink a little at continental view. The tokens stay in proportion to each other.

## Weight and colour

| Label | Class | Weight | Colour token | Ink (dark) | Paper / plain |
|---|---|---|---|---|---|
| Capital | `.place.cap` | 700 | `--c-cap` + circular location anchor | `#ffe2b0` | `#8f1f16` |
| Tier-1 city | `.place.t1` | 600 | `--c-city` | `#f1ece2` | `#2b2620` |
| Place | `.place` | 500 | `--c-city` | `#f1ece2` | `#2b2620` |
| Tier-3 / minor | `.place.t3`, `.minor` | 400 | `--c-city-2` | `#d6d0c4` | `#5a5248` |
| Mountain, pass | `.place.k-mountain`, `.k-pass` | as tier | `--c-relief` | `#cfc6b4` | `#4a5d6b` |
| Trunk river | `.river.k-trunk` | 600 | `--c-water` | `#9fcbe0` | `#1f5f8b` |
| River, lake | `.river` | 500 | `--c-water` | `#9fcbe0` | `#1f5f8b` |
| Admin area, level 1 | `.admin.l1` | 600 | `--c-admin-1` | `#f2e2bf` | `#47321d` |
| Admin area | `.admin` | 500 | `--c-admin` | `#ddd0b4` | `#5b4a36` |
| Wall, canal, road, sea route | `.work.k-*` | 600 italic | the work's line colour | | |
| Polity | `.polity` | 800 (neighbours 600) | the polity's colour mixed toward the background | | |

Interactive text such as tooltips (`.maptip`) and model tags (`.tag`) belongs to the UI, not the map, and is not covered by these tokens.

Clickable names are semantic buttons with a small circular location anchor. When the place has a model, its base ring
replaces that anchor and the same name sits above the model; both open the same card. Model bounds participate in label
avoidance, so unrelated names never cover models. There are no separate importance-based model name plates.

## Names by period

A map label never shows a name before it was in use:

* **Places** carry dated names (`names` in `src/shared/data/places.ts`). A place with `since` has no name before that year unless an older name is listed. For example, 开封 is 大梁, then 汴州, 东京, 汴梁, and 开封 only from 1368.
* **Rivers and lakes** use `riverName(label, year)`. Shifting courses (the Yellow River's 禹贡, 王景, 北宋北流 and 夺淮 courses, 济水/大清河) and vanished lakes (云梦泽, 巨野泽/梁山泊) appear only in their years. Classical names (河水, 江水, 郁水, 彭蠡泽, 西海, 北海, 蒲昌海, 热海 …) are used before the modern ones. Rivers named only in modern sources (塔里木河, 雅鲁藏布江) are hidden in antiquity.
