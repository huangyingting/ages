import { ERAS, RULERS } from '../data/eras.ts';
import type { Era, Lang, Ruler, Year } from '../data/types.ts';

/**
 * Non-linear time axis. Chinese history spans 1.7 million years but almost all curriculum content is in the last
 * 4,000, so the axis is piecewise linear between anchors: prehistory is squeezed into the first 8 %.
 */
export const ANCHORS: [Year, number][] = [
  [-1_700_000, 0], [-10_000, 0.04], [-2070, 0.08], [-221, 0.30], [618, 0.46], [1368, 0.60], [1840, 0.72], [1949, 0.90], [2025, 1],
];
export const YEAR_MIN = ANCHORS[0][0];
export const YEAR_MAX = ANCHORS[ANCHORS.length - 1][0];

export function yearToT(y: Year): number {
  if (y <= YEAR_MIN) return 0;
  if (y >= YEAR_MAX) return 1;
  for (let i = 1; i < ANCHORS.length; i++) {
    const [y1, t1] = ANCHORS[i];
    if (y <= y1) {
      const [y0, t0] = ANCHORS[i - 1];
      return t0 + ((y - y0) / (y1 - y0)) * (t1 - t0);
    }
  }
  return 1;
}

export function tToYear(t: number): Year {
  if (t <= 0) return YEAR_MIN;
  if (t >= 1) return YEAR_MAX;
  for (let i = 1; i < ANCHORS.length; i++) {
    const [y1, t1] = ANCHORS[i];
    if (t <= t1) {
      const [y0, t0] = ANCHORS[i - 1];
      return Math.round(y0 + ((t - t0) / (t1 - t0)) * (y1 - y0));
    }
  }
  return YEAR_MAX;
}

/** There is no year 0: snap it to 1 CE so dates read naturally. */
export const normYear = (y: Year): Year => (y === 0 ? 1 : Math.round(y));

/** The era for a year (lane 0 preferred; ties go to the later era so a boundary year shows the new dynasty). */
export function eraAt(y: Year, eras: Era[] = ERAS): Era | undefined {
  let best: Era | undefined;
  for (const e of eras) {
    if (y >= e.start && y <= e.end && (e.lane ?? 0) === 0) best = e;
  }
  return best ?? eras.find(e => y >= e.start && y <= e.end);
}

/** All eras covering a year, including second-lane ones (e.g. 辽 alongside 北宋). */
export const erasAt = (y: Year, eras: Era[] = ERAS): Era[] => eras.filter(e => y >= e.start && y <= e.end);

export function rulerAt(y: Year, rulers: Ruler[] = RULERS): Ruler | undefined {
  let best: Ruler | undefined;
  for (const r of rulers) if (y >= r.start && y <= r.end) best = r;
  return best;
}

/** Formats a year for display: 前221年 / 221 BCE, 约170万年前 / c. 1.7 million years ago. */
export function formatYear(y: Year, lang: Lang, opts: { short?: boolean } = {}): string {
  y = normYear(y);
  if (y < -10_000) {
    const ago = -y;
    if (lang === 'zh') return ago >= 10_000 ? `约${+(ago / 10_000).toFixed(1)}万年前` : `约${ago}年前`;
    return ago >= 1_000_000 ? `c. ${+(ago / 1_000_000).toFixed(2)} million years ago` : `c. ${Math.round(ago / 1000)},000 years ago`;
  }
  if (y < 0) return lang === 'zh' ? `前${-y}${opts.short ? '' : '年'}` : `${-y} BCE`;
  return lang === 'zh' ? `${y}${opts.short ? '' : '年'}` : opts.short || y >= 1000 ? `${y}` : `${y} CE`;
}

/** Tick years for the timeline axis at a given pixel width. */
export function ticks(width: number): Year[] {
  const all: Year[] = [-1_000_000, -10_000, -2000, -1500, -1000, -500, 1, 500, 1000, 1500, 1800, 1900, 1950, 2000];
  const minPx = 46;
  const out: Year[] = [];
  let last = -Infinity;
  for (const y of all) {
    const x = yearToT(y) * width;
    if (x - last >= minPx) { out.push(y); last = x; }
  }
  return out;
}
