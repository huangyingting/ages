/** Small localStorage wrapper (silently in-memory when storage is unavailable, e.g. private mode). */
const mem = new Map<string, string>();
const KEY = 'ages:';

export function load<T>(k: string, d: T): T {
  try {
    const v = localStorage.getItem(KEY + k) ?? mem.get(k);
    return v == null ? d : (JSON.parse(v) as T);
  } catch { return d; }
}

export function save(k: string, v: unknown): void {
  const s = JSON.stringify(v);
  mem.set(k, s);
  try { localStorage.setItem(KEY + k, s); } catch { /* ignore */ }
}

/** Learning progress: events whose story was watched, events marked as learned, and the course's best scores. */
export class Progress {
  watched = new Set<string>(load<string[]>('watched', []));
  learned = new Set<string>(load<string[]>('learned', []));
  best = load<number>('quizBest', 0);

  watch(id: string): void { this.watched.add(id); save('watched', [...this.watched]); }
  toggleLearned(id: string): boolean {
    if (this.learned.has(id)) this.learned.delete(id); else this.learned.add(id);
    save('learned', [...this.learned]);
    return this.learned.has(id);
  }
  quiz(score: number): void { if (score > this.best) { this.best = score; save('quizBest', score); } }
  /** the course: best result per lesson / unit test (`test:<book>-<unit>`), as [right, asked] */
  scores = load<Record<string, [number, number]>>('lessons', {});
  score(id: string, right: number, n: number): void {
    const b = this.scores[id];
    if (!b || right / n >= b[0] / b[1]) { this.scores[id] = [right, n]; save('lessons', this.scores); }
  }
}
