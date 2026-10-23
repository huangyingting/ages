import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { MODEL_KINDS } from '../../src/shared/data/event-kit.ts';
import { BUILDERS, buildFresh } from '../../src/client/models/kit.ts';
import { packModel, unpackModel } from '../../src/client/models/pack.ts';

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
