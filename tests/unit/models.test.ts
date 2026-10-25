import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MODEL_KINDS } from '../../src/shared/data/event-kit.ts';
import { BUILDERS, buildFresh } from '../../src/client/models/kit.ts';
import { packModel, unpackModel } from '../../src/client/models/pack.ts';
import { loadPack, parseHero } from '../../src/client/models/heroes/index.ts';
import { LIFE } from '../../src/shared/data/life.ts';
import { ERAS } from '../../src/shared/data/eras.ts';
import { PEOPLE } from '../../src/shared/data/jiangshan.ts';
import * as HEROES from '../../src/shared/data/heroes.ts';
import { personLook } from '../../src/client/models/costume.ts';
import { EVENTS } from '../../src/shared/data/events.ts';
import { STORIES, TRAVELLER } from '../../src/shared/data/stories.ts';

const { capitalModel, personModel } = HEROES;

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
  it('gives each capital city its own palace, built from an existing hero', async () => {
    const at = (id: string) => capitalModel(ERAS.find(e => e.id === id)!);
    expect(at('shang').hero).toBe('capitals/cap_yinxu');
    expect(at('whan').hero).toBe('capitals/cap_qinhan');
    expect(at('nsong').hero).toBe('capitals/cap_linan');
    expect(at('qing').hero).toBe('asia/forbidden');
    expect(at('prc')).toEqual({ kind: 'monument' });
    for (const e of ERAS) {
      const ref = parseHero(capitalModel(e).hero);
      if (!ref) continue;
      expect((await loadPack(ref.pack))[ref.name], `${e.id}`).toBeTypeOf('function');
      expect(stats(buildFresh(capitalModel(e))).tris, e.id).toBeLessThan(130_000);
    }
  }, 120_000);
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
});
