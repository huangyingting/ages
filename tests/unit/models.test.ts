import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MODEL_KINDS } from '../../src/shared/data/event-kit.ts';
import { BUILDERS, buildFresh } from '../../src/client/models/kit.ts';
import { packModel, unpackModel } from '../../src/client/models/pack.ts';
import { loadPack, parseHero } from '../../src/client/models/heroes/index.ts';
import { LIFE } from '../../src/shared/data/life.ts';
import { ERAS } from '../../src/shared/data/eras.ts';
import { capitalModel } from '../../src/shared/data/heroes.ts';

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

describe('period capitals', () => {
  it('gives each dynasty a capital in its own architecture, built from an existing hero', async () => {
    const at = (id: string) => capitalModel(ERAS.find(e => e.id === id)!);
    expect(at('shang').hero).toBe('capitals/cap_erlitou');
    expect(at('whan').hero).toBe('capitals/cap_qinhan');
    expect(at('tang').hero).toBe('capitals/cap_tang');
    expect(at('bsong').hero).toBe('capitals/cap_song');
    expect(at('qing')).toEqual({ kind: 'palace' });
    expect(at('prc')).toEqual({ kind: 'monument' });
    for (const e of ERAS) {
      const ref = parseHero(capitalModel(e).hero);
      if (!ref) continue;
      expect((await loadPack(ref.pack))[ref.name], `${e.id}`).toBeTypeOf('function');
      expect(stats(buildFresh(capitalModel(e))).tris, e.id).toBeLessThan(130_000);
    }
  }, 120_000);
});
