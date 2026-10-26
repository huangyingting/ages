import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MODEL_KINDS } from '../../src/shared/data/event-kit.ts';
import { BUILDERS, buildFresh } from '../../src/client/models/kit.ts';
import { packModel, unpackModel } from '../../src/client/models/pack.ts';
import { loadPack, PACK_IDS, parseHero } from '../../src/client/models/heroes/index.ts';
import { LIFE } from '../../src/shared/data/life.ts';
import { ERAS } from '../../src/shared/data/eras.ts';
import { PLACES } from '../../src/shared/data/places.ts';
import { PEOPLE } from '../../src/shared/data/jiangshan.ts';
import * as HEROES from '../../src/shared/data/heroes.ts';
import { personLook } from '../../src/client/models/costume.ts';
import { EVENTS } from '../../src/shared/data/events.ts';
import { STORIES, TRAVELLER } from '../../src/shared/data/stories.ts';
import { sceneryOf } from '../../src/shared/data/scenery.ts';
import { cancelByTag, instance, prefetchEraModels, prototype, prunePrototypes, ready } from '../../src/client/models/library.ts';

const { capitalModel, placeModel, personModel } = HEROES;

const stats = (o: THREE.Object3D) => {
  let meshes = 0, tris = 0;
  o.traverse(x => {
    const m = x as THREE.Mesh;
    if (m.isMesh) { meshes++; tris += (m.geometry.index?.count ?? m.geometry.getAttribute('position').count) / 3; }
  });
  return { meshes, tris };
};

describe('procedural models', () => {
  it('has a builder for every model kind the content uses', () => {
    for (const k of MODEL_KINDS) expect(BUILDERS[k], k).toBeTypeOf('function');
  });
  for (const kind of MODEL_KINDS) {
    it(`builds, bakes and round-trips "${kind}"`, () => {
      const g = buildFresh({ kind });
      const s = stats(g);
      expect(s.tris, kind).toBeGreaterThan(20);
      expect(s.tris, kind).toBeLessThan(60_000);
      expect(s.meshes, kind).toBeLessThan(60);
      const h = g.userData.height as number;
      expect(h, kind).toBeGreaterThan(0.05);
      expect(h, kind).toBeLessThan(2.2);
      const back = unpackModel(packModel(g).model);
      expect(stats(back)).toEqual(s);
    });
  }
});

describe('dynasty life models', () => {
  it('every life item points at an existing hero builder and builds', async () => {
    for (const l of LIFE) {
      const ref = parseHero(l.model.hero);
      if (ref) expect((await loadPack(ref.pack))[ref.name], `${l.id} → ${l.model.hero}`).toBeTypeOf('function');
      const g = buildFresh(l.model);
      const s = stats(g);
      expect(s.tris, l.id).toBeGreaterThan(20);
      expect(s.tris, l.id).toBeLessThan(130_000);
      expect(g.userData.height as number, l.id).toBeGreaterThan(0.05);
    }
  }, 120_000);
});

describe('hero models', () => {
  it('every hero the events, stories and hero tables name exists and builds within budget', async () => {
    const refs = new Map<string, { kind: string; hero: string; style?: string }>();
    const walk = (v: unknown): void => {
      if (!v || typeof v !== 'object') return;
      const o = v as Record<string, unknown>;
      if (typeof o.hero === 'string' && o.hero.includes('/')) {
        const r = { kind: String(o.kind ?? 'gate'), hero: o.hero, style: o.style as string | undefined };
        refs.set(`${r.hero}:${r.style ?? ''}`, r);
      }
      for (const x of Object.values(o)) walk(x);
    };
    walk([EVENTS, STORIES, TRAVELLER, HEROES]);
    expect(refs.size).toBeGreaterThan(20);
    for (const [key, r] of refs) {
      const ref = parseHero(r.hero)!;
      expect((await loadPack(ref.pack))[ref.name], key).toBeTypeOf('function');
      expect(stats(buildFresh(r)).tris, key).toBeLessThan(130_000);
    }
  }, 300_000);
});

describe('period capitals', () => {
  it('gives each capital city its own palace, built from an existing hero, with no duplicates across eras', async () => {
    const at = (id: string) => capitalModel(ERAS.find(e => e.id === id)!);
    expect(at('shang').hero).toBe('capitals/cap_yinxu');
    expect(at('whan').hero).toBe('capitals/cap_qinhan');
    expect(at('xin').hero).toBe('capitals/cap_xin');
    expect(at('sui').hero).toBe('capitals/cap_sui');
    expect(at('wudai').hero).toBe('capitals/cap_wudai');
    expect(at('jin').hero).toBe('capitals/cap_jin');
    expect(at('nsong').hero).toBe('capitals/cap_linan');
    expect(at('ming').hero).toBe('capitals/cap_ming');
    expect(at('qing').hero).toBe('capitals/cap_qing');
    expect(at('prc').hero).toBe('capitals/cap_prc');
    const capKeys = ERAS.map(e => {
      const m = capitalModel(e);
      return `${m.hero ?? m.kind}:${m.style ?? ''}`;
    });
    expect(new Set(capKeys).size).toBe(ERAS.length);
    for (const e of ERAS) {
      const ref = parseHero(capitalModel(e).hero);
      if (!ref) continue;
      expect((await loadPack(ref.pack))[ref.name], `${e.id}`).toBeTypeOf('function');
      expect(stats(buildFresh(capitalModel(e))).tris, e.id).toBeLessThan(130_000);
    }
  }, 120_000);
});

describe('zero model reuse across events, life items, and travellers', () => {
  it('gives every event in EVENTS, every item in LIFE, and every traveller in TRAVELLER a unique model recipe', () => {
    const evKeys = new Map<string, string>();
    for (const e of EVENTS) {
      const m = e.model!;
      const k = `${m.hero ?? m.kind}:${m.style ?? ''}`;
      expect(evKeys.get(k), `${e.id} shares event model key ${k}`).toBeUndefined();
      evKeys.set(k, e.id);
    }
    expect(evKeys.size).toBe(EVENTS.length);

    const lifeKeys = new Map<string, string>();
    for (const l of LIFE) {
      const m = l.model;
      const k = `${m.hero ?? m.kind}:${m.style ?? ''}:${m.person ?? ''}:${m.year ?? ''}:${m.role ?? ''}`;
      expect(lifeKeys.get(k), `${l.id} shares life model key ${k}`).toBeUndefined();
      lifeKeys.set(k, l.id);
    }
    expect(lifeKeys.size).toBe(LIFE.length);

    const travKeys = new Set(Object.values(TRAVELLER).map(v => JSON.stringify(v)));
    expect(travKeys.size).toBe(Object.keys(TRAVELLER).length);
  });
});

describe('place landmark models', () => {
  it('gives every place in PLACES its own unique 3D landmark model with zero duplicates', async () => {
    const keys = new Map<string, string>();
    for (const p of PLACES) {
      const r = placeModel(p);
      const k = `${r.hero ?? r.kind}:${r.style ?? ''}`;
      expect(keys.get(k), `${p.id} (${p.name.zh}) shares model ${k}`).toBeUndefined();
      keys.set(k, p.id);
      const ref = parseHero(r.hero);
      expect(ref, `${p.id} (${p.name.zh}) must have a hero builder`).not.toBeNull();
      expect((await loadPack(ref!.pack))[ref!.name], `${p.id} → ${r.hero}`).toBeTypeOf('function');
      const g = buildFresh(r);
      const s = stats(g);
      expect(s.tris, p.id).toBeGreaterThan(80);
      expect(s.tris, p.id).toBeLessThan(130_000);
      expect(g.userData.height as number, p.id).toBeGreaterThan(0.05);
      expect(g.userData.height as number, p.id).toBeLessThan(2.2);
    }
    expect(keys.size).toBe(PLACES.length);
  }, 180_000);
});

describe('period-dressed figures', () => {
  it('builds dynasty-authentic ruler, scholar, general, woman and steppe outfits across eras', () => {
    const years = [-1500, -150, 400, 700, 1060, 1290, 1500, 1750, 1925, 1980];
    for (const year of years) {
      for (const role of ['ruler', 'scholar', 'general', 'woman']) {
        const g = buildFresh({ kind: 'person', role, year });
        const s = stats(g);
        expect(s.tris, `${role}@${year}`).toBeGreaterThan(200);
        expect(s.tris, `${role}@${year}`).toBeLessThan(30_000);
      }
    }
    const steppe = buildFresh({ kind: 'person', role: 'ruler', year: 1038, eth: 'steppe', prop: 'sword' });
    expect(stats(steppe).tris).toBeGreaterThan(200);
  });

  it('gives named historical figures distinct character-specific portraits, props and vignettes', () => {
    expect(personLook('ruler', 'xianqin', { person: '大禹' }).hat).toBe('douli');
    expect(personLook('scholar', 'weijin', { person: '诸葛亮' }).hat).toBe('guanjin');
    expect(personLook('scholar', 'song', { person: '包拯' }).crescent).toBe(true);
    expect(personLook('scholar', 'suitang', { person: '鉴真' }).blind).toBe(true);
    expect(personLook('scholar', 'song', { person: '苏轼' }).hat).toBe('dongpo');
    expect(personLook('ruler', 'qing', { person: '洪秀全' }).hat).toBe('taiping');
    expect(personLook('scholar', 'modern', { person: '袁隆平' }).hat).toBe('straw');
    expect(personLook('scholar', 'qing', { person: '曹雪芹' }).badge).toBeUndefined();
    expect(personLook('general', 'qinhan', { person: '项羽' }).armor).not.toBe(
      personLook('general', 'weijin', { person: '吕布' }).armor,
    );

    for (const p of PEOPLE) {
      const r = personModel(p);
      const s = stats(buildFresh(r));
      expect(s.tris, p.id).toBeGreaterThan(200);
      if (r.hero) {
        expect(s.tris, p.id).toBeLessThan(130_000);
      } else {
        expect(r.person, p.id).toBe(p.name.zh);
        expect(s.tris, p.id).toBeLessThan(30_000);
      }
    }
  }, 120_000);

  it('supports dynasty-by-dynasty priority loading, prefetching, cancellation and LRU pruning', async () => {
    const qinEra = ERAS.find(e => e.id === 'qin')!;
    const qinCap = capitalModel(qinEra);
    const g = await instance(qinCap, { priority: 100, tag: 'era:qin' });
    expect(g.children.length).toBeGreaterThan(0);
    expect(ready(qinCap)).toBe(true);

    const whanEra = ERAS.find(e => e.id === 'whan')!;
    const whanPrimary = [capitalModel(whanEra), ...sceneryOf(whanEra).filter(s => s.level === 1).map(s => s.model)];
    await prefetchEraModels(whanPrimary.slice(0, 2), 'whan');
    expect(ready(whanPrimary[0])).toBe(true);

    cancelByTag('era:old');
    prunePrototypes([qinCap, ...whanPrimary]);
    expect(ready(qinCap)).toBe(true);
    const cached = await prototype(qinCap);
    expect(cached).toBeDefined();
  }, 60_000);

  it('registers all hero packs via import.meta.glob and gives each place era-differentiated 3D models', async () => {
    expect(PACK_IDS.length).toBeGreaterThanOrEqual(16);
    await loadPack('capitals');
    await loadPack('places-cities');
    await loadPack('places-sites');
    await loadPack('places-atlas');

    // No duplicate entries for merged passes/sites (嘉峪关, 山海关, 赤壁, 雅克萨, 巨鹿)
    for (const landmark of ['嘉峪关', '山海关', '赤壁', '雅克萨', '巨鹿']) {
      expect(PLACES.filter(p => p.name.zh === landmark).length, landmark).toBe(1);
    }

    // All places have unique recipes both without year and within any era year
    const keysAtTang = new Set<string>();
    for (const p of PLACES) {
      const r = placeModel(p, 720);
      const k = `${r.hero ?? r.kind}:${r.style ?? ''}`;
      expect(keysAtTang.has(k), `duplicate recipe at 720 for ${p.id}`).toBe(false);
      keysAtTang.add(k);
    }

    // Jiayuguan and Dunhuang have completely different models in any era
    const jyg = PLACES.find(p => p.id === 'jiayuguan')!;
    const dh = PLACES.find(p => p.id === 'dunhuang')!;
    const jygMing = buildFresh(placeModel(jyg, 1500));
    const dhMing = buildFresh(placeModel(dh, 1500));
    expect(stats(jygMing).tris).not.toBe(stats(dhMing).tris);

    // Same place across different eras produces distinct recipes and distinct 3D geometry
    for (const id of ['xian', 'luoyang', 'beijing', 'dunhuang', 'jiayuguan', 'nanjing', 'kaifeng', 'j0']) {
      const p = PLACES.find(x => x.id === id)!;
      const sampleYears = [-150, 720, 1080, 1500, 1780, 1980];
      const trisByEra = new Set<number>();
      for (const y of sampleYears) {
        const r = placeModel(p, y);
        const s = stats(buildFresh(r));
        expect(s.tris, `${id}@${y}`).toBeGreaterThan(500);
        trisByEra.add(s.tris);
      }
      expect(trisByEra.size, `${id} distinct geometry across 6 eras`).toBe(sampleYears.length);
    }
  }, 60_000);
});
