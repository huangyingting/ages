import { describe, expect, it } from 'vitest';
import { BOOKS, UNITS } from '../../src/shared/data/curriculum.ts';
import { ERAS, RULERS } from '../../src/shared/data/eras.ts';
import { MODEL_KINDS } from '../../src/shared/data/event-kit.ts';
import { EVENTS, storyOf } from '../../src/shared/data/events.ts';
import { PLACE, PLACES, isCapital, mapName, placeExists, placeName } from '../../src/shared/data/places.ts';
import { JOURNEYS, WORKS, reignAt } from '../../src/shared/data/jiangshan.ts';
import { POLITY, POLITIES, polityMatches } from '../../src/shared/data/polities.ts';
import { STAGES } from '../../src/shared/data/stage.ts';
import { STORIES, journeyStory } from '../../src/shared/data/stories.ts';
import { SNAPSHOTS, snapshotAt } from '../../src/shared/data/territories.ts';
import { decodeRing } from '../../src/shared/lib/rings.ts';
import type { I18n, LonLat, Snapshot, StoryStep } from '../../src/shared/data/types.ts';
import { readFileSync } from 'node:fs';

/** Fills imported snapshots from public/data/atlas/shapes.json the way ShapeStore does in the browser (regions only). */
const SHAPES = JSON.parse(readFileSync(new URL('../../public/data/atlas/shapes.json', import.meta.url), 'utf8'));
const hydrated = (s: Snapshot | null): Snapshot | null => {
  if (!s?.shapes || s.regions.length) return s;
  return { ...s, regions: SHAPES.snaps[s.shapes].p.map(([polity, , , , rs]: [string, unknown, unknown, unknown, number[]]) => ({ polity, rings: rs.map(i => decodeRing(SHAPES.rings[i])) })) };
};

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
      // textbook events map to curriculum units; imported chronicle entries need not
      if (e.source !== 'jiangshan') expect(e.curriculum.length, e.id).toBeGreaterThan(0);
      for (const c of e.curriculum) expect(UNITS.some(u => u.book === c.book && u.unit === c.unit), `${e.id} ${c.book}.${c.unit}`).toBe(true);
      if (e.model) expect(MODEL_KINDS, e.id).toContain(e.model.kind);
      if (e.end !== undefined) expect(e.end, e.id).toBeGreaterThanOrEqual(e.year);
      if (e.source !== 'jiangshan') expect(e.wiki?.zh || e.wiki?.en, `${e.id} wiki`).toBeTruthy();
    }
  });
});

describe('territorial snapshots', () => {
  it('are sorted, reference known polities and stay on stage', () => {
    unique(SNAPSHOTS.map(s => s.id));
    for (let i = 1; i < SNAPSHOTS.length; i++) expect(SNAPSHOTS[i].year).toBeGreaterThan(SNAPSHOTS[i - 1].year);
    for (const s0 of SNAPSHOTS) {
      const s = hydrated(s0)!;
      bilingual(s.title, s.id);
      expect(s.regions.length, s.id).toBeGreaterThan(0);
      for (const r of s.regions) {
        expect(POLITY.has(r.polity), `${s.id}: ${r.polity}`).toBe(true);
        for (const ring of r.rings) {
          expect(ring.length, `${s.id}/${r.polity}`).toBeGreaterThanOrEqual(3);
          if (!s.shapes) for (const [lon, lat] of ring) expect(lon >= B.west - 2 && lon <= B.east + 2 && lat >= B.south - 2 && lat <= B.north + 2, `${s.id}/${r.polity} ${lon},${lat}`).toBe(true);
        }
      }
    }
  });

  it('snapshotAt picks the latest snapshot not after the year', () => {
    expect(snapshotAt(-5000)).toBeNull();
    expect(snapshotAt(-221)?.id).toBe('s_qin_a');
    expect(snapshotAt(-222)?.id).toMatch(/^s_zhanguo/);
    expect(snapshotAt(-100)?.id).toMatch(/^s_xihan/);
    expect(snapshotAt(742)?.id).toMatch(/^s_tang/);
    expect(snapshotAt(1405)?.id).toMatch(/^s_ming/);
    expect(snapshotAt(1948)?.id).toMatch(/^s_roc/);
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

  it('never prints a modern name on the map before it was in use', () => {
    const at = (id: string, y: number) => mapName(PLACE.get(id)!, y)?.zh ?? null;
    expect(at('shanghai', -221)).toBeNull();
    expect(at('hongkong', 1500)).toBeNull();
    expect(at('kaifeng', -300)).toBe('大梁');
    expect(at('kaifeng', 750)).toBe('汴州');
    expect(at('shanghai', 2000)).toBe('上海');
    expect(at('banpo', -4000)).toBe('半坡');
    expect(at('banpo', 1500)).toBeNull();
    for (const p of PLACES) for (const y of [-221, 750, 1100]) {
      const n = mapName(p, y);
      if (n && n === p.name && p.since != null) expect(y).toBeGreaterThanOrEqual(p.since);
    }
  });
});

describe('stories', () => {
  const points = (s: StoryStep): LonLat[] => {
    switch (s.do) {
      case 'fly': case 'spawn': case 'fx': case 'clash': case 'banner': case 'wipe': return [[s.lon, s.lat]];
      case 'route': case 'build': case 'fleet': return s.pts;
      case 'army': return [...(s.pts ?? []), ...(s.from ? [s.from] : []), ...(s.to ? [s.to] : [])];
      default: return [];
    }
  };
  it('reference real events, polities, models and on-stage points', () => {
    for (const [id, steps] of Object.entries(STORIES)) {
      expect(EVENTS.some(e => e.id === id), id).toBe(true);
      let at = EVENTS.find(e => e.id === id)?.year ?? 0;
      for (const s of steps) {
        if (s.do === 'year' || s.do === 'wipe') at = s.year;
        if (s.do === 'army') expect(!!s.pts?.length || (!!s.from && !!s.to), `${id} army route`).toBe(true);
        if (s.do === 'title' || s.do === 'banner') bilingual(s.text, id);
        if (s.do === 'clash' && s.labels) for (const l of s.labels) bilingual(l, id);
        for (const [lon, lat] of points(s)) expect(inStage(lon, lat), `${id} ${s.do} ${lon},${lat}`).toBe(true);
        if (s.do === 'highlight') {
          expect(POLITY.has(s.polity), `${id} ${s.polity}`).toBe(true);
          // the highlighted polity must exist on the map at the story's year (curated id or an imported alias)
          const snap = hydrated(snapshotAt(at));
          expect(snap?.regions.some(r => polityMatches(r.polity, s.polity)), `${id} ${s.polity} @${snap?.id}`).toBe(true);
        }
        if ((s.do === 'spawn' || s.do === 'route') && s.model) expect(MODEL_KINDS, id).toContain(s.model.kind);
        if (s.do === 'caption') bilingual(s.text, id);
        if (s.do === 'route' || s.do === 'build') expect(s.pts.length, id).toBeGreaterThanOrEqual(2);
      }
    }
  });
  it('every event can play a story', () => {
    for (const e of EVENTS) expect(storyOf(e).length, e.id).toBeGreaterThan(0);
  });
  it('turn every journey into an on-stage story', () => {
    expect(JOURNEYS.length).toBe(7);
    for (const j of JOURNEYS) {
      const steps = journeyStory(j);
      expect(steps.filter(s => s.do === 'banner').length, j.id).toBe(j.stops.length);
      for (const s of steps) for (const [lon, lat] of points(s)) expect(inStage(lon, lat), `${j.id} ${s.do} ${lon},${lat}`).toBe(true);
    }
  });
  it('open with a title, and unscripted wars stage a battle', () => {
    for (const [id, steps] of Object.entries(STORIES)) expect(steps.some(s => s.do === 'title'), id).toBe(true);
    const war = EVENTS.find(e => e.kind === 'war' && !e.story)!;
    const auto = storyOf(war);
    expect(auto.map(s => s.do)).toEqual(expect.arrayContaining(['title', 'army', 'clash', 'banner', 'caption']));
    const culture = storyOf(EVENTS.find(e => e.kind === 'culture' && !e.story)!);
    expect(culture.some(s => s.do === 'orbit')).toBe(true);
  });
});

describe('imported jiangshan-map content', () => {
  it('adds chronicle events, settlements and period-aware places', () => {
    expect(EVENTS.filter(e => e.source === 'jiangshan').length).toBeGreaterThan(500);
    expect(PLACES.length).toBeGreaterThan(250);
    const j = PLACES.find(p => p.periodOnly && p.names?.length)!;
    expect(placeExists(j, j.names![0].from)).toBe(true);
    expect(placeExists(j, -3000)).toBe(false);
  });
  it('maps curated story polities onto imported regimes', () => {
    expect(polityMatches('qin', 'qin')).toBe(true);
    const tang = POLITIES.find(p => p.id.startsWith('j') && p.name.zh === '唐');
    if (tang) expect(polityMatches(tang.id, 'qin')).toBe(false);
  });
  it('names reign eras in both languages', () => {
    expect(reignAt(627)?.label).toEqual({ zh: '唐太宗 · 贞观元年', en: 'Emp. Taizong · Zhenguan 1' });
    expect(reignAt(1662)?.label.zh).toBe('清圣祖 · 康熙元年');
    expect(reignAt(1950)).toBeUndefined();
  });
  it('dates great works and keeps them on stage', () => {
    expect(WORKS.some(w => w.kind === 'canal' && w.span[0] <= 610 && w.span[1] >= 610)).toBe(true);
    for (const w of WORKS) {
      bilingual(w.name, w.id);
      for (const l of w.lines) for (const [lon, lat] of l) expect(inStage(lon, lat), `${w.id} ${lon},${lat}`).toBe(true);
    }
  });
});
