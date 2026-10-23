import { describe, expect, it } from 'vitest';
import { BOOKS, UNITS } from '../../src/shared/data/curriculum.ts';
import { ERAS, RULERS } from '../../src/shared/data/eras.ts';
import { MODEL_KINDS } from '../../src/shared/data/event-kit.ts';
import { EVENTS, storyOf } from '../../src/shared/data/events.ts';
import { PLACE, PLACES, isCapital, placeName } from '../../src/shared/data/places.ts';
import { POLITY, POLITIES } from '../../src/shared/data/polities.ts';
import { STAGES } from '../../src/shared/data/stage.ts';
import { STORIES } from '../../src/shared/data/stories.ts';
import { SNAPSHOTS, snapshotAt } from '../../src/shared/data/territories.ts';
import type { I18n, LonLat, StoryStep } from '../../src/shared/data/types.ts';

const B = STAGES.china.bounds;
const inStage = (lon: number, lat: number) => lon >= B.west && lon <= B.east && lat >= B.south && lat <= B.north;
const bilingual = (s: I18n | undefined, what: string) => {
  expect(s, what).toBeDefined();
  expect(s!.zh.trim(), `${what} zh`).not.toBe('');
  expect(s!.en.trim(), `${what} en`).not.toBe('');
};
const unique = (ids: string[]) => expect(ids.filter((id, i) => ids.indexOf(id) !== i)).toEqual([]);

describe('content is bilingual and well-formed', () => {
  it('eras', () => {
    unique(ERAS.map(e => e.id));
    for (const e of ERAS) {
      bilingual(e.name, e.id); bilingual(e.short, e.id); bilingual(e.summary, e.id);
      expect(e.start, e.id).toBeLessThan(e.end);
      if (e.capital) expect(PLACE.has(e.capital), `${e.id} capital ${e.capital}`).toBe(true);
    }
    for (const r of RULERS) {
      bilingual(r.name, r.era);
      expect(ERAS.some(e => e.id === r.era), r.name.zh).toBe(true);
      expect(r.start).toBeLessThanOrEqual(r.end);
    }
  });

  it('places', () => {
    unique(PLACES.map(p => p.id));
    for (const p of PLACES) {
      bilingual(p.name, p.id);
      for (const n of p.names ?? []) bilingual(n.name, p.id);
      expect(inStage(p.lon, p.lat), p.id).toBe(true);
    }
  });

  it('polities', () => {
    unique(POLITIES.map(p => p.id));
    for (const p of POLITIES) { bilingual(p.name, p.id); expect(p.color).toMatch(/^#[0-9a-f]{6}$/i); }
  });

  it('curriculum units', () => {
    for (const u of UNITS) { bilingual(u.title, `${u.book}.${u.unit}`); expect(BOOKS[u.book]).toBeDefined(); }
  });

  it('events', () => {
    unique(EVENTS.map(e => e.id));
    for (let i = 1; i < EVENTS.length; i++) expect(EVENTS[i].year).toBeGreaterThanOrEqual(EVENTS[i - 1].year);
    for (const e of EVENTS) {
      bilingual(e.title, e.id); bilingual(e.summary, e.id);
      for (const p of e.points) bilingual(p, e.id);
      for (const p of e.people ?? []) bilingual(p, e.id);
      expect(inStage(e.lon, e.lat), e.id).toBe(true);
      expect(e.curriculum.length, e.id).toBeGreaterThan(0);
      for (const c of e.curriculum) expect(UNITS.some(u => u.book === c.book && u.unit === c.unit), `${e.id} ${c.book}.${c.unit}`).toBe(true);
      if (e.model) expect(MODEL_KINDS, e.id).toContain(e.model.kind);
      if (e.end !== undefined) expect(e.end, e.id).toBeGreaterThanOrEqual(e.year);
      expect(e.wiki?.zh || e.wiki?.en, `${e.id} wiki`).toBeTruthy();
    }
  });
});

describe('territorial snapshots', () => {
  it('are sorted, reference known polities and stay on stage', () => {
    unique(SNAPSHOTS.map(s => s.id));
    for (let i = 1; i < SNAPSHOTS.length; i++) expect(SNAPSHOTS[i].year).toBeGreaterThan(SNAPSHOTS[i - 1].year);
    for (const s of SNAPSHOTS) {
      bilingual(s.title, s.id);
      for (const r of s.regions) {
        expect(POLITY.has(r.polity), `${s.id}: ${r.polity}`).toBe(true);
        for (const ring of r.rings) {
          expect(ring.length, `${s.id}/${r.polity}`).toBeGreaterThanOrEqual(3);
          for (const [lon, lat] of ring) expect(lon >= B.west - 2 && lon <= B.east + 2 && lat >= B.south - 2 && lat <= B.north + 2, `${s.id}/${r.polity} ${lon},${lat}`).toBe(true);
        }
      }
    }
  });

  it('snapshotAt picks the latest snapshot not after the year', () => {
    expect(snapshotAt(-5000)).toBeNull();
    expect(snapshotAt(-221)?.id).toBe('qin');
    expect(snapshotAt(-222)?.id).toBe('zhanguo');
    expect(snapshotAt(-100)?.id).toBe('whan');
    expect(snapshotAt(1405)?.id).toBe('ming');
    expect(snapshotAt(1948)?.id).toBe('war1940');
    expect(snapshotAt(1949)?.id).toBe('prc1950');
    expect(snapshotAt(2020)?.id).toBe('prc2000');
  });
});

describe('places through time', () => {
  it('uses period names and capital spans', () => {
    const xian = PLACE.get('xian')!;
    expect(placeName(xian, 700).zh).toBe('长安');
    expect(placeName(xian, 2000).zh).toBe('西安');
    expect(isCapital(xian, 700)).toBe(true);
    expect(isCapital(xian, 1500)).toBe(false);
  });
});

describe('stories', () => {
  const points = (s: StoryStep): LonLat[] => {
    switch (s.do) {
      case 'fly': case 'spawn': case 'fx': return [[s.lon, s.lat]];
      case 'route': case 'build': return s.pts;
      case 'army': return [s.from, s.to];
      default: return [];
    }
  };
  it('reference real events, polities, models and on-stage points', () => {
    for (const [id, steps] of Object.entries(STORIES)) {
      expect(EVENTS.some(e => e.id === id), id).toBe(true);
      for (const s of steps) {
        for (const [lon, lat] of points(s)) expect(inStage(lon, lat), `${id} ${s.do} ${lon},${lat}`).toBe(true);
        if (s.do === 'highlight') expect(POLITY.has(s.polity), `${id} ${s.polity}`).toBe(true);
        if ((s.do === 'spawn' || s.do === 'route') && s.model) expect(MODEL_KINDS, id).toContain(s.model.kind);
        if (s.do === 'caption') bilingual(s.text, id);
        if (s.do === 'route' || s.do === 'build') expect(s.pts.length, id).toBeGreaterThanOrEqual(2);
      }
    }
  });
  it('every event can play a story', () => {
    for (const e of EVENTS) expect(storyOf(e).length, e.id).toBeGreaterThan(0);
  });
});
