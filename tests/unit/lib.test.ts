import { describe, expect, it } from 'vitest';
import { decodeRing, encodeRing } from '../../src/shared/lib/rings.ts';
import { ERAS } from '../../src/shared/data/eras.ts';
import { EVENTS } from '../../src/shared/data/events.ts';
import { JOURNEYS, PEOPLE } from '../../src/shared/data/jiangshan.ts';
import { PLACES } from '../../src/shared/data/places.ts';
import { distKm, gradeWhere, locatePoints, makeLocateQuiz, makeQuiz, rankOf } from '../../src/shared/lib/quiz.ts';
import { CHRONICLE, chapterAt, currentEntry, phaseAt, previousSnap, stepStop } from '../../src/shared/lib/chronicle.ts';
import { search } from '../../src/shared/lib/search.ts';
import { ANCHORS, eraAt, formatYear, parseYear, rulerAt, tToYear, ticks, yearToT } from '../../src/shared/lib/timeline.ts';

describe('timeline', () => {
  it('maps years monotonically onto [0,1] and back', () => {
    let last = -1;
    for (let y = -1_700_000; y <= 2025; y += y < -10_000 ? 50_000 : 7) {
      const t = yearToT(y);
      expect(t).toBeGreaterThanOrEqual(last);
      last = t;
    }
    for (const [y, t] of ANCHORS) { expect(yearToT(y)).toBeCloseTo(t); expect(tToYear(t)).toBe(y); }
    for (const y of [-1046, -221, 220, 960, 1644, 1911, 1978]) expect(Math.abs(tToYear(yearToT(y)) - y)).toBeLessThanOrEqual(1);
  });
  it('finds eras and rulers', () => {
    expect(eraAt(-221)?.id).toBe('qin');
    expect(eraAt(700)?.id).toBe('tang');
    expect(eraAt(1700)?.id).toBe('qing');
    expect(rulerAt(-221)?.name.zh).toContain('秦始皇');
  });
  it('formats years in both languages', () => {
    expect(formatYear(-221, 'zh')).toBe('前221年');
    expect(formatYear(-221, 'en')).toBe('221 BCE');
    expect(formatYear(1949, 'zh')).toBe('1949年');
    expect(formatYear(1949, 'en')).toBe('1949');
    expect(formatYear(25, 'en')).toBe('25 CE');
    expect(formatYear(-1_700_000, 'zh')).toBe('约170万年前');
    expect(formatYear(-1_700_000, 'en')).toBe('c. 1.7 million years ago');
    expect(formatYear(0, 'zh')).toBe('1年');
  });
  it('spaces ticks', () => {
    const t = ticks(1000).map(yearToT);
    for (let i = 1; i < t.length; i++) expect((t[i] - t[i - 1]) * 1000).toBeGreaterThanOrEqual(46);
  });
});

describe('search', () => {
  const src = { events: EVENTS, eras: ERAS, places: PLACES };
  it('matches Chinese and English, events and places', () => {
    expect(search('赤壁', src)[0]).toMatchObject({ type: 'event', id: 'chibi' });
    expect(search('red cliffs', src)[0]).toMatchObject({ type: 'event', id: 'chibi' });
    expect(search('长安', src).some(h => h.type === 'place' && h.id === 'xian')).toBe(true);
    expect(search('tang', src).some(h => h.type === 'era' && h.id === 'tang')).toBe(true);
    expect(search('', src)).toEqual([]);
  });
  it('finds people (by alias), journeys and places by their old names', () => {
    const all = { ...src, people: PEOPLE, journeys: JOURNEYS };
    expect(search('苏东坡', all).some(h => h.type === 'person' && h.id === 'sushi')).toBe(true);
    expect(search('Xuanzang', all).some(h => h.type === 'journey' && h.id === 'xuanzang')).toBe(true);
    const old = search('汴梁', all).find(h => h.type === 'place');
    expect(old && 'sub' in old && old.sub?.zh).toBe('汴梁');
  });
});

describe('quiz', () => {
  it('is deterministic per seed and well-formed', () => {
    const a = makeQuiz(EVENTS, { seed: 42, n: 9 });
    expect(makeQuiz(EVENTS, { seed: 42, n: 9 })).toEqual(a);
    expect(a).toHaveLength(9);
    for (const q of a) {
      if (q.type === 'when') { expect(q.options).toContain(q.answer); expect(new Set(q.options).size).toBe(q.options.length); }
      if (q.type === 'order') expect([...q.answer].sort()).toEqual([...q.events].sort());
    }
  });
  it('filters by textbook', () => {
    const q = makeQuiz(EVENTS, { seed: 1, n: 6, book: 'g8b' });
    const ids = q.flatMap(x => ('event' in x ? [x.event] : []));
    for (const id of ids) expect(EVENTS.find(e => e.id === id)!.curriculum.some(c => c.book === 'g8b')).toBe(true);
  });
  it('grades distances', () => {
    expect(distKm([116.4, 39.9], [121.47, 31.23])).toBeGreaterThan(1000);
    expect(gradeWhere(120)).toBe('correct');
    expect(gradeWhere(500)).toBe('close');
    expect(gradeWhere(2000)).toBe('wrong');
  });
});

describe('ring codec', () => {
  it('round-trips rings at 0.01° precision, including negative and repeated deltas', () => {
    const ring: [number, number][] = [[105.12, 34.56], [105.12, 34.56], [-3.5, -6.01], [159.99, 63.98], [100, 0]];
    const back = decodeRing(encodeRing(ring));
    expect(back).toHaveLength(ring.length);
    back.forEach(([x, y], i) => { expect(x).toBeCloseTo(ring[i][0], 2); expect(y).toBeCloseTo(ring[i][1], 2); });
    expect(encodeRing(ring)).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('chronicle & phases', () => {
  it('lists the events of the dynasty in view and finds the current entry', () => {
    const { era, events } = chapterAt(1415);
    expect(era?.name.zh).toBe('明');
    expect(events.length).toBeGreaterThan(20);
    expect(events.every(e => e.year >= era!.start && e.year <= era!.end)).toBe(true);
    const cur = currentEntry(1415, events)!;
    expect(cur.year).toBeLessThanOrEqual(1415);
    expect(events.find(e => e.year > cur.year && e.year <= 1415)).toBeUndefined();
    expect(CHRONICLE.some(e => e.weight === 3)).toBe(true);
  });

  it('places a year in its territorial phase and links the previous one', () => {
    const ph = phaseAt(1415)!;
    expect(ph.group.length).toBeGreaterThan(1);
    expect(ph.group[ph.index]).toBe(ph.snap);
    expect(ph.from).toBeLessThanOrEqual(1415);
    expect(ph.to).toBeGreaterThanOrEqual(1415);
    const prev = previousSnap(ph.snap)!;
    expect(prev.year).toBeLessThan(ph.snap.year);
  });

  it('steps between event and phase years', () => {
    const next = stepStop(1405, 1);
    expect(next).toBeGreaterThan(1405);
    expect(stepStop(next, -1)).toBe(1405);
    expect(stepStop(-221, -1)).toBeLessThan(-221);
  });

  it('parses typed years in both languages', () => {
    expect(parseYear('1415')).toBe(1415);
    expect(parseYear('-221')).toBe(-221);
    expect(parseYear('前221')).toBe(-221);
    expect(parseYear('公元前221年')).toBe(-221);
    expect(parseYear('221 BC')).toBe(-221);
    expect(parseYear('221 bce')).toBe(-221);
    expect(parseYear('abc')).toBeNull();
  });
});

describe('ancient place quiz', () => {
  it('asks for old names only and is reproducible', () => {
    const a = makeLocateQuiz(PLACES, { n: 10, seed: 7 });
    expect(a).toHaveLength(10);
    expect(makeLocateQuiz(PLACES, { n: 10, seed: 7 })).toEqual(a);
    for (const q of a) {
      if (q.type !== 'locate') throw new Error('locate expected');
      const p = PLACES.find(x => x.id === q.place)!;
      expect(q.name.zh).not.toBe(p.modern?.zh ?? p.name.zh);
      expect(q.prompt.zh).toContain(q.name.zh);
      expect(q.prompt.zh).not.toContain(p.modern?.zh ?? p.name.zh);
    }
    for (const q of makeLocateQuiz(PLACES, { n: 1000, seed: 1 })) {
      const p = q.type === 'locate' ? PLACES.find(x => x.id === q.place)! : null;
      if (p && q.type === 'locate' && q.hint) expect(q.hint.zh).not.toContain(p.modern?.zh ?? p.name.zh);
    }
  });

  it('scores by distance and awards ranks', () => {
    expect(locatePoints(10)).toBe(100);
    expect(locatePoints(350)).toBe(50);
    expect(locatePoints(900)).toBe(0);
    expect(rankOf(950, 1000).zh).toContain('太史令');
    expect(rankOf(0, 1000).zh).toBe('书院童生');
  });
});
