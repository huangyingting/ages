/**
 * The course's checks (随堂检测): a lesson's written checks turned into questions the player asks, and the unit test
 * (单元测验), made of the unit's lesson checks, "when" questions on its core events and questions on its map phases.
 */
import { BOOKS, UNITS } from '../data/curriculum.ts';
import { EVENT, EVENTS } from '../data/events.ts';
import { LESSONS, unitLessons } from '../data/lessons/index.ts';
import { tr } from '../data/i18n.ts';
import { PLACE } from '../data/places.ts';
import { SNAPSHOTS } from '../data/territories.ts';
import type { Book, Check, I18n, Lesson } from '../data/types.ts';
import { periodQuestion, rng } from './quiz.ts';
import { formatYear } from './timeline.ts';

export type Asked =
  | { kind: 'choice'; prompt: I18n; options: I18n[]; answer: number; why: I18n; ev?: string }
  /** `items` are event ids shown shuffled; `answer` is their time order */
  | { kind: 'order'; prompt: I18n; items: string[]; answer: string[]; why: I18n }
  | { kind: 'where'; prompt: I18n; lon: number; lat: number; tol: number; name: I18n; why: I18n; ev?: string };

const both = (f: (l: 'zh' | 'en') => string): I18n => ({ zh: f('zh'), en: f('en') });
function shuffle<T>(a: T[], r: () => number): T[] {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/** The question a written check asks (order items are shuffled with `r`). */
export function ask(c: Check, r: () => number = Math.random): Asked {
  if ('q' in c) return { kind: 'choice', prompt: c.q, options: c.options, answer: c.answer, why: c.why, ev: c.ev };
  if ('order' in c) {
    const evs = c.order.map(id => EVENT.get(id)!);
    const answer = evs.slice().sort((a, b) => a.year - b.year).map(e => e.id);
    let items = shuffle(c.order, r);
    // never start in the right order
    if (items.every((id, i) => id === answer[i])) items = [...items.slice(1), items[0]];
    return {
      kind: 'order', items, answer,
      prompt: both(l => (l === 'zh' ? '按时间先后排列' : 'Put these in time order')),
      why: c.why ?? both(l => answer.map(id => { const e = EVENT.get(id)!; const y = formatYear(e.year, l); return l === 'zh' ? `${e.title.zh}（${y}）` : `${e.title.en} (${y})`; }).join(' → ')),
    };
  }
  const e = EVENT.get(c.where), p = e ? undefined : PLACE.get(c.where)!;
  const name = e ? e.title : p!.name;
  const at = e ?? p!;
  return {
    kind: 'where', lon: at.lon, lat: at.lat, tol: c.tol ?? 400, name, ev: e?.id,
    prompt: both(l => (l === 'zh' ? `在地图上点出「${name.zh}」的位置` : `Find “${name.en}” on the map`)),
    why: c.why ?? (e ? both(l => `${tr(e.title, l)}${l === 'zh' ? '：' : ': '}${tr(e.site ?? PLACE.get(e.place ?? '')?.name ?? e.title, l)}`) : both(l => tr(p!.modern ?? p!.name, l))),
  };
}

/** A lesson's 随堂检测, in the order written. */
export const lessonQuestions = (lesson: Lesson, seed = Date.now()): Asked[] => { const r = rng(seed); return lesson.checks.map(c => ask(c, r)); };

/** Four year options around `y`, the same side of the BCE/CE line. */
function years(y: number, r: () => number): number[] {
  const span = y < -1000 ? 200 : y < 0 ? 60 : y < 1800 ? 50 : 8;
  const out = new Set([y]);
  for (let guard = 0; out.size < 4 && guard < 200; guard++) {
    const d = Math.round((r() * 2 - 1) * span);
    const c = y + (span > 30 ? Math.round(d / 5) * 5 : d);
    if (c !== 0 && (y < 0) === (c < 0) && Math.abs(c - y) >= Math.max(2, span / 10)) out.add(c);
  }
  return shuffle([...out], r);
}

/** The unit test: the unit's lesson checks, up to three "when" questions on core events and up to two on map phases. */
export function unitTest(book: Book, unit: number, seed = Date.now()): Asked[] {
  const r = rng(seed);
  const u = UNITS.find(x => x.book === book && x.unit === unit);
  if (!u) return [];
  const out: Asked[] = unitLessons(book, unit).flatMap(l => l.checks.map(c => ask(c, r)));
  const core = EVENTS.filter(e => e.weight === 1 && e.year > -10_000 && e.curriculum.some(c => c.book === book && c.unit === unit));
  for (const e of shuffle(core, r).slice(0, 3)) {
    const opts = years(e.year, r);
    if (opts.length < 4) continue;
    out.push({
      kind: 'choice', ev: e.id, answer: opts.indexOf(e.year),
      prompt: both(l => (l === 'zh' ? `「${e.title.zh}」发生在哪一年？` : `When did “${e.title.en}” happen?`)),
      options: opts.map(y => both(l => formatYear(y, l))),
      why: both(l => `${tr(e.title, l)}${l === 'zh' ? '：' : ': '}${formatYear(e.year, l)}`),
    });
  }
  const snaps = shuffle(SNAPSHOTS.filter(s => s.year >= u.range[0] && s.year < u.range[1]), r);
  let n = 0;
  for (const s of snaps) {
    if (n >= 2) break;
    const q = periodQuestion(s);
    if (q) { out.push({ kind: 'choice', prompt: q.prompt, options: q.options, answer: q.answer, why: q.why }); n++; }
  }
  return shuffle(out, r);
}

/** The lesson after this one in its course (middle school runs g7a → g8b; the high-school book on its own). */
export function nextLesson(id: string): Lesson | undefined {
  const l = LESSONS.find(x => x.id === id);
  if (!l) return undefined;
  const list = courseLessons(BOOKS[l.book].level);
  return list[list.indexOf(l) + 1];
}

/** A level's lessons in textbook order. */
export function courseLessons(level: 'middle' | 'high'): Lesson[] {
  const books = (Object.keys(BOOKS) as Book[]).filter(b => BOOKS[b].level === level);
  return LESSONS.filter(l => books.includes(l.book)).sort((a, b) => books.indexOf(a.book) - books.indexOf(b.book) || a.unit - b.unit || LESSONS.indexOf(a) - LESSONS.indexOf(b));
}
