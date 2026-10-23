import type { Book, HistEvent, I18n } from '../data/types.ts';

export type Question =
  | { type: 'when'; event: string; prompt: I18n; options: number[]; answer: number }
  | { type: 'where'; event: string; prompt: I18n; lon: number; lat: number }
  | { type: 'order'; events: string[]; prompt: I18n; answer: string[] };

/** Small seeded PRNG so a quiz can be reproduced from its seed (and tested deterministically). */
export function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
function shuffle<T>(a: T[], r: () => number): T[] {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** Plausible wrong years: nearby, distinct, and on the same side of the BCE/CE line where possible. */
function distractors(y: number, r: () => number): number[] {
  const span = y < -1000 ? 300 : y < 0 ? 120 : y < 1800 ? 90 : 12;
  const out = new Set<number>();
  let guard = 0;
  while (out.size < 3 && guard++ < 100) {
    let d = Math.round((r() * 2 - 1) * span);
    if (Math.abs(d) < span / 8) continue;
    if (span > 50) d = Math.round(d / 5) * 5 || 5;
    const c = y + d;
    if (c !== y && c !== 0 && (y < 0) === (c < 0)) out.add(c);
  }
  return [...out];
}

/** Builds a quiz from curriculum events (optionally restricted to a textbook), mixing question types. */
export function makeQuiz(events: HistEvent[], opts: { n?: number; seed?: number; book?: Book } = {}): Question[] {
  const r = rng(opts.seed ?? Date.now());
  const pool = events.filter(e => e.weight <= 2 && e.year > -10_000 && (!opts.book || e.curriculum.some(c => c.book === opts.book)));
  const picks = shuffle(pool, r).slice(0, opts.n ?? 8);
  return picks.map((e, i): Question => {
    const kind = i % 3;
    if (kind === 1) {
      return { type: 'where', event: e.id, lon: e.lon, lat: e.lat, prompt: { zh: `在地图上找到「${e.title.zh}」的发生地`, en: `Find where “${e.title.en}” happened` } };
    }
    if (kind === 2 && pool.length >= 4) {
      const set = shuffle([e, ...shuffle(pool.filter(x => x.id !== e.id && Math.abs(x.year - e.year) > 3), r).slice(0, 3)], r);
      return { type: 'order', events: set.map(x => x.id), answer: set.slice().sort((a, b) => a.year - b.year).map(x => x.id),
        prompt: { zh: '按时间先后排列这些事件', en: 'Put these events in time order' } };
    }
    return { type: 'when', event: e.id, answer: e.year, options: shuffle([e.year, ...distractors(e.year, r)], r),
      prompt: { zh: `「${e.title.zh}」发生在哪一年？`, en: `When did “${e.title.en}” happen?` } };
  });
}

/** Great-circle distance in km, used to grade "where" answers (within 300 km is correct, 800 km is close). */
export function distKm(a: [number, number], b: [number, number]): number {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * rad, dLon = (b[0] - a[0]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const gradeWhere = (km: number): 'correct' | 'close' | 'wrong' => (km <= 300 ? 'correct' : km <= 800 ? 'close' : 'wrong');
