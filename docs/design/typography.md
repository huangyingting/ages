# Typography

Two scales: the map's labels (below) and the [interface](#interface-type).

## Map labels

Every map label uses one scale, defined as CSS tokens on `.labels` in `src/client/styles.css`. Each property carries one meaning:

| Property | Meaning |
|---|---|
| **Size** | label type: every place name has one size; only rivers, admin areas and polities scale by their own rank |
| **Weight** | place names are all 600; other labels use weight for rank inside their category |
| **Colour** | category: settlement, capital, water, relief, admin, work, polity |
| **Letter-spacing** | areal features (rivers, regions, polities) are spread along their extent |
| **Italic** | man-made lines (walls, canals, roads, sea routes), and English river names |
| **No halo** | labels are solid, high-contrast colours with no glow or text shadow |

### Size tokens

| Token | px | Used for |
|---|---|---|
| `--fs-place` | 13 | every place name: capitals, cities, sites, mountains, passes, waters |
| `--fs-1` | 13 | trunk rivers |
| `--fs-2` | 12 | first-level admin areas |
| `--fs-3` | 11 | rivers and lakes, admin areas, works |

Place tiers decide only priority and the distance at which a name appears, never its size, weight or opacity.

Polity names are sized by territory area (`s-xl` 26, `s-l` 19, `s-m` 14, `s-s` 12 px) and keep that size at every zoom.

**Zoom.** `scene/labels.ts` sets `--lz = clamp((24 / distance)^0.18, 0.9, 1.3)` in steps of 0.05. Every token above is multiplied by it, so names grow a little as you zoom in and shrink a little at continental view. The tokens stay in proportion to each other.

### Weight and colour

| Label | Class | Weight | Colour token | Ink (dark) | Paper / plain |
|---|---|---|---|---|---|
| Capital | `.place.cap` | 600 | `--c-cap` | `#ffd38a` | `#a3180d` |
| Place (any tier) | `.place` | 600 | `--c-city` | `#fbf7ee` | `#1c1814` |
| Mountain, pass | `.place.k-mountain`, `.k-pass` | 600 | `--c-relief` | `#cfc6b4` | `#33475a` |
| Water site | `.place.k-water` | 600 | `--c-water` | `#9fcbe0` | `#134f7a` |
| Trunk river | `.river.k-trunk` | 600 | `--c-water` | `#9fcbe0` | `#134f7a` |
| River, lake | `.river` | 500 | `--c-water` | `#9fcbe0` | `#134f7a` |
| Admin area, level 1 | `.admin.l1` | 600 | `--c-admin-1` | `#f2e2bf` | `#3a2715` |
| Admin area | `.admin` | 500 | `--c-admin` | `#ddd0b4` | `#4a3a28` |
| Wall, canal, road, sea route | `.work.k-*` | 600 italic | the work's line colour | | |
| Polity | `.polity` | 800 (neighbours 600) | the polity's colour mixed toward the background | | |

Interactive text such as tooltips (`.maptip`) and model tags (`.tag`) belongs to the UI, not the map, and is not covered by these tokens.

Clickable names are semantic buttons with the same 22 px circular icon as other compact markers; capitals differ only by colour.
Hover and keyboard focus highlight only the circle, without underlining text or resizing the icon. When the place has a model, its base ring
replaces that anchor and the same name sits above the model; both open the same card. Model bounds participate in label
avoidance, so unrelated names never cover models. There are no separate importance-based model name plates.

### Names by period

A map label never shows a name before it was in use:

* **Places** carry dated names (`names` in `src/shared/data/places.ts`). A place with `since` has no name before that year unless an older name is listed. For example, 开封 is 大梁, then 汴州, 东京, 汴梁, and 开封 only from 1368.
* **Rivers and lakes** use `riverName(label, year)`. Shifting courses (the Yellow River's 禹贡, 王景, 北宋北流 and 夺淮 courses, 济水/大清河) and vanished lakes (云梦泽, 巨野泽/梁山泊) appear only in their years. Classical names (河水, 江水, 郁水, 彭蠡泽, 西海, 北海, 蒲昌海, 热海 …) are used before the modern ones. Rivers named only in modern sources (塔里木河, 雅鲁藏布江) are hidden in antiquity.

## Interface type

Every interface size is a `--t-*` token on `:root` in `src/client/styles.css`; no rule uses a raw pixel size (the map's
polity names, above, are the only exception). Weight carries rank inside a size; colour carries role.

| Token | px | Used for |
|---|---|---|
| `--t-2xs` | 11 | axis ticks, badges, small counts, dates in lists, legend notes |
| `--t-xs` | 12 | secondary text: meta lines, notes, chips, segmented controls, tooltips' subtitles |
| `--t-s` | 13 | body UI: list rows, buttons, search, section headers, facts |
| `--t-m` | 14 | emphasised body: view titles, card summary, reading text, the phase line |
| `--t-l` | 16 | the era name in the headline, the phase title in 时期详情, quiz questions |
| `--t-xl` | 20 | card and article titles, banners |
| `--t-2xl` | 28 | the realm's area figure; the year on phones |
| `--t-3xl` | 40 | the year in the headline — the largest type on screen |

| Colour | Value (light / ink) | Role |
|---|---|---|
| `--ink` | `#2d2a25` / `#ece6da` | primary text — warm charcoal, never pure black |
| `--ink-2` | `#5b564e` / `#b5ad9f` | secondary text |
| `--ink-3` | `#8e877c` / `#7f786d` | tertiary: labels, units, dates |
| `--zhu` | `#c8372d` | the one accent: selection, the current entry, dates of the current phase |
