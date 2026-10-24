import RAW from './gen/areas.json' with { type: 'json' };
import type { Lang } from './i18n.ts';

/** Per snapshot, in thousands of km²: the dynasty's realm `m` and each polity `p` (see scripts/compute-areas.ts). */
const AREAS = RAW as unknown as Record<string, { m: number; p: [string, number][] }>;

/** Area of the dynasty's realm in a snapshot, in thousands of km² (0 when unknown). */
export const realmArea = (snapId: string): number => AREAS[snapId]?.m ?? 0;

/** Area of one polity in a snapshot, in thousands of km² (0 when unknown or tiny). */
export const polityArea = (snapId: string, polity: string): number => AREAS[snapId]?.p.find(([p]) => p === polity)?.[1] ?? 0;

/** The polities drawn in a snapshot with their areas, largest first (tiny ones are left out). */
export const snapPolities = (snapId: string): [string, number][] => AREAS[snapId]?.p ?? [];

/** "约 903 万平方千米" / "≈ 9.03 million km²" (`short`: "903万" / "9.0M") from thousands of km². */
export function formatArea(k: number, lang: Lang, short = false): string {
  if (lang === 'zh') {
    const w = k / 10;
    const n = w >= 100 ? Math.round(w).toLocaleString('zh-CN') : w >= 10 ? String(Math.round(w)) : w.toFixed(1);
    return short ? `${n}万` : `约 ${n} 万平方千米`;
  }
  if (k >= 1000) return short ? `${(k / 1000).toFixed(1)}M` : `≈ ${(k / 1000).toFixed(2)} million km²`;
  return short ? `${Math.round(k)}k` : `≈ ${Math.round(k).toLocaleString('en')},000 km²`;
}
