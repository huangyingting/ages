import { describe, expect, it } from 'vitest';
import { BOOKS, UNITS } from '../../src/shared/data/curriculum.ts';
import { EVENT } from '../../src/shared/data/events.ts';
import { LESSONS, unitLessons } from '../../src/shared/data/lessons/index.ts';
import { PLACE } from '../../src/shared/data/places.ts';
import { POLITY } from '../../src/shared/data/polities.ts';
import type { Book, I18n } from '../../src/shared/data/types.ts';
import { ask, courseLessons, lessonQuestions, nextLesson, unitTest } from '../../src/shared/lib/course.ts';

const CJK = /[\u3400-\u9fff]/;
/** English without Chinese characters, Chinese with them. */
const bilingual = (s: I18n | undefined, where: string) => {
  expect(s, where).toBeTruthy();
  expect(s!.zh, where).toMatch(CJK);
  expect(s!.en ?? '', where).not.toMatch(CJK);
  expect((s!.en ?? '').trim().length, where).toBeGreaterThan(1);
};

describe('course content', () => {
  it('has one lesson for every textbook unit, with unique ids', () => {
    expect(new Set(LESSONS.map(l => l.id)).size).toBe(LESSONS.length);
    for (const u of UNITS) expect(unitLessons(u.book, u.unit).length, `${u.book}-${u.unit}`).toBeGreaterThanOrEqual(1);
    for (const l of LESSONS) {
      expect(BOOKS[l.book], l.id).toBeTruthy();
      expect(UNITS.some(u => u.book === l.book && u.unit === l.unit), l.id).toBe(true);
      expect(l.id.startsWith(`${l.book}-${l.unit}`), l.id).toBe(true);
    }
  });

  it('every lesson is bilingual, with ≥3 steps, ≥3 checks and ≥2 take-aways', () => {
    for (const l of LESSONS) {
      bilingual(l.title, l.id); bilingual(l.blurb, l.id);
      expect(l.minutes, l.id).toBeGreaterThan(0);
      expect(l.steps.length, l.id).toBeGreaterThanOrEqual(3);
      expect(l.checks.length, l.id).toBeGreaterThanOrEqual(3);
      expect(l.keys.length, l.id).toBeGreaterThanOrEqual(2);
      l.keys.forEach((k, i) => bilingual(k, `${l.id} key ${i}`));
      // a lesson is taught, not only listed: at least one step is written for it
      expect(l.steps.some(s => s.body), l.id).toBe(true);
      // and checked with at least one written question
      expect(l.checks.some(c => 'q' in c), l.id).toBe(true);
    }
  });

  it('steps point at real events and polities and frame something', () => {
    for (const l of LESSONS) l.steps.forEach((s, i) => {
      const w = `${l.id} step ${i}`;
      if (s.ev) expect(EVENT.get(s.ev), w).toBeTruthy();
      else { bilingual(s.title, w); bilingual(s.body, w); expect(s.year ?? null, w).not.toBeNull(); }
      if (s.title) bilingual(s.title, w);
      if (s.body) bilingual(s.body, w);
      if (s.polity) expect(POLITY.get(s.polity), w).toBeTruthy();
      if (s.at) {
        const [lon, lat, d] = s.at;
        expect(lon, w).toBeGreaterThan(60); expect(lon, w).toBeLessThan(150);
        expect(lat, w).toBeGreaterThan(5); expect(lat, w).toBeLessThan(60);
        if (d != null) { expect(d, w).toBeGreaterThan(4); expect(d, w).toBeLessThan(200); }
      }
      expect(!!(s.ev || s.at || s.polity), `${w} frames nothing`).toBe(true);
    });
  });

  it('checks are answerable', () => {
    for (const l of LESSONS) l.checks.forEach((c, i) => {
      const w = `${l.id} check ${i}`;
      if ('q' in c) {
        bilingual(c.q, w); bilingual(c.why, w);
        expect(c.options.length, w).toBeGreaterThanOrEqual(3);
        expect(c.options.length, w).toBeLessThanOrEqual(5);
        c.options.forEach(o => bilingual(o, w));
        expect(new Set(c.options.map(o => o.zh)).size, w).toBe(c.options.length);
        expect(new Set(c.options.map(o => o.en)).size, w).toBe(c.options.length);
        expect(Number.isInteger(c.answer) && c.answer >= 0 && c.answer < c.options.length, w).toBe(true);
        if (c.ev) expect(EVENT.get(c.ev), w).toBeTruthy();
      } else if ('order' in c) {
        expect(c.order.length, w).toBeGreaterThanOrEqual(3);
        expect(c.order.length, w).toBeLessThanOrEqual(5);
        const evs = c.order.map(id => EVENT.get(id));
        evs.forEach((e, k) => expect(e, `${w} ${c.order[k]}`).toBeTruthy());
        // distinct years, so there is one right order
        expect(new Set(evs.map(e => e!.year)).size, w).toBe(c.order.length);
        if (c.why) bilingual(c.why, w);
      } else {
        expect(EVENT.get(c.where) ?? PLACE.get(c.where), w).toBeTruthy();
        if (c.tol != null) { expect(c.tol, w).toBeGreaterThanOrEqual(100); expect(c.tol, w).toBeLessThanOrEqual(1000); }
        if (c.why) bilingual(c.why, w);
      }
    });
  });

  it('right answers are spread over the option positions', () => {
    for (const b of Object.keys(BOOKS) as Book[]) {
      const pos = LESSONS.filter(l => l.book === b).flatMap(l => l.checks.flatMap(c => ('q' in c ? [c.answer] : [])));
      if (pos.length < 6) continue;
      expect(new Set(pos).size, b).toBeGreaterThanOrEqual(3);
      expect(Math.max(...[0, 1, 2, 3].map(k => pos.filter(p => p === k).length)) / pos.length, b).toBeLessThan(0.6);
    }
  });
});

describe('course engine', () => {
  const l = LESSONS[0];
  it('asks every check, order questions never already in order', () => {
    for (let seed = 1; seed < 30; seed++) {
      const qs = lessonQuestions(l, seed);
      expect(qs.length).toBe(l.checks.length);
      for (const q of qs) if (q.kind === 'order') expect(q.items).not.toEqual(q.answer);
    }
  });

  it('turns order and where checks into graded questions', () => {
    const o = ask({ order: ['han_found', 'qin_unify', 'zhangqian'] });
    expect(o.kind === 'order' && o.answer).toEqual(['qin_unify', 'han_found', 'zhangqian']);
    const w = ask({ where: 'qin_unify' });
    expect(w.kind === 'where' && [w.lon, w.lat, w.tol]).toEqual([EVENT.get('qin_unify')!.lon, EVENT.get('qin_unify')!.lat, 400]);
    expect(w.prompt.zh).toContain('秦');
  });

  it('builds a unit test from the unit’s checks, years and map phases, reproducibly', () => {
    for (const u of UNITS) {
      const t = unitTest(u.book, u.unit, 7);
      expect(t.length, `${u.book}-${u.unit}`).toBeGreaterThanOrEqual(unitLessons(u.book, u.unit).reduce((n, x) => n + x.checks.length, 0));
      for (const q of t) if (q.kind === 'choice') {
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(new Set(q.options.map(o => o.zh)).size).toBe(q.options.length);
      }
      expect(unitTest(u.book, u.unit, 7)).toEqual(t);
    }
  });

  it('runs each level’s lessons in textbook order, the last one with no next', () => {
    for (const level of ['middle', 'high'] as const) {
      const list = courseLessons(level);
      list.forEach((x, i) => expect(nextLesson(x.id)).toBe(list[i + 1]));
    }
  });
});
