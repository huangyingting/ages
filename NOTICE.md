# Notices

长河 Ages is released under the **GNU General Public License v3.0** (see [LICENSE](LICENSE)).

## Imported content: jiangshan-map

The following content is imported from [jiangshan-map 江山图](https://github.com/DeanChensj/jiangshan-map) by DeanChensj
(GPL-3.0, Copyright © 2026 DeanChensj), pinned to commit `4eb009dec7ceee781f8181a370afaddd11dbcf59`. It is converted by
`scripts/import-jiangshan.ts` into `public/data/atlas/shapes.json` and `src/shared/data/gen/jiangshan.json`:

* territorial phases (165 snapshots of polities from 403 BCE to 1949), administrative divisions (郡 / 州 / 府 / 路 / 省),
  modern provincial outlines and historical lakes;
* chronicle milestones and landmark events, settlements with their names by period, strategic passes, city lore and a
  gazetteer of historical place names;
* people, travellers' journeys, reign eras (年号), dynasty summaries, great works (walls, canals, roads, sea routes), river
  labels and guqin music metadata.

Modifications: re-encoded geometry (delta/VLQ rings), merged with our curated events, places and polities, de-duplicated,
reclassified by event kind and 3D model, era names romanised with pinyin. The nine-dash line is not imported; our own
curated snapshots are kept for 1937–1945 and from 1949.

jiangshan-map's historical GIS references include Tan Qixiang's *Historical Atlas of China* (谭其骧《中国历史地图集》),
**CHGIS** (Harvard-Yenching Institute & Fudan University), **Robert M. Hartwell**'s China Historical GIS and
[aourednik/historical-basemaps](https://github.com/aourednik/historical-basemaps) (GPL-3.0).

**Exception:** prefecture-level boundaries and Warring States territories derived from CHGIS V6 and the Hartwell China
Historical GIS remain subject to their original terms (**academic, non-commercial use only**) and are not relicensed
under GPL-3.0.

## Other sources

* Elevation: [AWS Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Mapzen), derived from SRTM, GMTED2010,
  ETOPO1 and other public-domain sources.
* Background reading: [Wikipedia](https://www.wikipedia.org/), text under CC BY-SA 4.0, fetched live and attributed in the reader.
* Fonts: Chakra Petch (Copyright 2018 The Chakra Petch Project Authors) and Geist / Geist Mono (Copyright 2023 Vercel, with basement.studio),
  bundled in `src/client/fonts/` under the SIL Open Font License 1.1 (licence texts alongside the font files).
* Design language and low-poly model kit adapted from the pocket-planet (Terrastra) project.
