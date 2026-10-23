import type { I18n } from './i18n.ts';

/**
 * A stage is one 3D map the atlas can show: a geographic window, its terrain file and its default camera.
 * Phase 1 ships only `china` (East Asia). Phase 2 (world history) adds stages such as `world` or `mediterranean`
 * without changing the content model: every event, place and territory carries plain lon/lat coordinates and a
 * `scope`, and the scene projects them with the active stage's bounds.
 */
export interface Stage {
  id: StageId;
  name: I18n;
  bounds: { west: number; east: number; south: number; north: number };
  /** heightmap written by scripts/fetch-terrain.ts (Terrarium-like RG elevation, B = ocean mask) */
  terrain: string;
  /** reference latitude for the plate carrée x-scale (cos φ0) so shapes look right in the middle of the stage */
  refLat: number;
  /** default camera target and distance (world units; the stage is `width` units across) */
  home: { lon: number; lat: number; dist: number; tilt: number };
}

export type StageId = 'china';

export const STAGES: Record<StageId, Stage> = {
  china: {
    id: 'china',
    name: { zh: '中国与东亚', en: 'China & East Asia' },
    bounds: { west: 66, east: 146, south: 0, north: 56 },
    terrain: 'data/terrain/east-asia.png',
    refLat: 34,
    home: { lon: 106, lat: 33, dist: 62, tilt: 0.95 },
  },
};
