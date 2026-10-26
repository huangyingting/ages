/** Small localStorage wrapper (silently in-memory when storage is unavailable, e.g. private mode). */
const mem = new Map<string, string>();
const KEY = 'ages:';

/** A saved value, or `d` when there is none or it is not of the default's kind (or fails `ok`): a stale or foreign
 * value under our key (another app on the same origin, an older version) must never break start-up. */
export function load<T>(k: string, d: T, ok?: (v: unknown) => boolean): T {
  try {
    const raw = localStorage.getItem(KEY + k) ?? mem.get(k);
    if (raw == null) return d;
    const v: unknown = JSON.parse(raw);
    if (ok) return ok(v) ? v as T : d;
    if (d == null) return v as T;
    if (Array.isArray(d) !== Array.isArray(v) || typeof v !== typeof d || v === null) return d;
    if (typeof v === 'number' && !Number.isFinite(v)) return d;
    return v as T;
  } catch { return d; }
}

const strings = (v: string[]): string[] => v.filter(x => typeof x === 'string');

export function save(k: string, v: unknown): void {
  const s = JSON.stringify(v);
  mem.set(k, s);
  try { localStorage.setItem(KEY + k, s); } catch { /* ignore */ }
}

/** Learning progress: events whose story was watched, events marked as learned, and the course's best scores. */
export class Progress {
  watched = new Set<string>(strings(load<string[]>('watched', [])));
  learned = new Set<string>(strings(load<string[]>('learned', [])));
  best = load<number>('quizBest', 0);

  watch(id: string): void { this.watched.add(id); save('watched', [...this.watched]); }
  toggleLearned(id: string): boolean {
    if (this.learned.has(id)) this.learned.delete(id); else this.learned.add(id);
    save('learned', [...this.learned]);
    return this.learned.has(id);
  }
  quiz(score: number): void { if (score > this.best) { this.best = score; save('quizBest', score); } }
  /** the course: best result per lesson / unit test (`test:<book>-<unit>`), as [right, asked] */
  scores = load<Record<string, [number, number]>>('lessons', {}, v => !!v && typeof v === 'object' && !Array.isArray(v)
    && Object.values(v).every(x => Array.isArray(x) && x.length === 2 && x.every(n => Number.isFinite(n)) && x[1] > 0));
  score(id: string, right: number, n: number): void {
    const b = this.scores[id];
    if (!b || right / n >= b[0] / b[1]) { this.scores[id] = [right, n]; save('lessons', this.scores); }
  }
}
